// 后台服务工作者 - 支持持续运行的AI总结
class BackgroundSummarizer {
    constructor() {
        this.activeTasks = new Map(); // 活跃的总结任务
        this.taskQueue = []; // 任务队列
        this.isProcessing = false;
        this.init();
    }
    
    init() {
        // 监听来自popup的消息
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            this.handleMessage(request, sender, sendResponse);
            return true; // 保持消息通道开放
        });
        
        // 监听标签页更新，自动处理队列中的任务
        chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
            if (changeInfo.status === 'complete') {
                this.processQueue();
            }
        });
    }
    
    async handleMessage(request, sender, sendResponse) {
        switch (request.action) {
            case 'startSummarize':
                await this.startSummarizeTask(request.data, sendResponse);
                break;
            case 'getTaskStatus':
                this.getTaskStatus(request.taskId, sendResponse);
                break;
            case 'cancelTask':
                this.cancelTask(request.taskId, sendResponse);
                break;
            case 'getActiveTasks':
                sendResponse({ tasks: Array.from(this.activeTasks.values()) });
                break;
        }
    }
    
    async startSummarizeTask(data, sendResponse) {
        const taskId = 'task_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        
        const task = {
            id: taskId,
            status: 'pending', // pending, processing, streaming, completed, error
            progress: 0,
            data: data,
            result: '',
            error: null,
            startTime: Date.now(),
            streamChunks: []
        };
        
        this.activeTasks.set(taskId, task);
        this.taskQueue.push(taskId);
        
        sendResponse({ success: true, taskId });
        
        // 立即开始处理队列
        this.processQueue();
    }
    
    async processQueue() {
        if (this.isProcessing || this.taskQueue.length === 0) {
            return;
        }
        
        this.isProcessing = true;
        
        while (this.taskQueue.length > 0) {
            const taskId = this.taskQueue.shift();
            const task = this.activeTasks.get(taskId);
            
            if (!task || task.status === 'cancelled') {
                continue;
            }
            
            try {
                await this.processTask(task);
            } catch (error) {
                console.error('处理任务失败:', error);
                task.status = 'error';
                task.error = error.message;
            }
        }
        
        this.isProcessing = false;
    }
    
    async processTask(task) {
        try {
            task.status = 'processing';
            task.progress = 10;
            this.notifyProgress(task);
            
            // 1. 获取网页内容
            const pageContent = await this.extractPageContent(task.data.tabId);
            task.progress = 30;
            this.notifyProgress(task);
            
            // 2. 调用流式API
            task.status = 'streaming';
            task.progress = 40;
            this.notifyProgress(task);
            
            const summary = await this.callStreamingAPI(pageContent, task.data.apiKey, task);
            task.progress = 80;
            this.notifyProgress(task);
            
            // 3. 保存到笔记
            await this.saveToNote(summary, task.data, task);
            
            task.status = 'completed';
            task.progress = 100;
            task.result = summary;
            this.notifyProgress(task);
            
            // 5分钟后清理完成的任务
            setTimeout(() => {
                this.activeTasks.delete(task.id);
            }, 5 * 60 * 1000);
            
        } catch (error) {
            task.status = 'error';
            task.error = error.message;
            this.notifyProgress(task);
            throw error;
        }
    }
    
    async extractPageContent(tabId) {
        return new Promise((resolve, reject) => {
            chrome.tabs.sendMessage(tabId, { action: 'getPageContent' }, (response) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(`无法获取页面内容: ${chrome.runtime.lastError.message}`));
                    return;
                }
                
                if (response && response.success) {
                    if (!response.content || response.content.trim() === '') {
                        reject(new Error('页面内容为空，可能是页面还未完全加载或内容被阻止访问'));
                        return;
                    }
                    resolve(response.content);
                } else {
                    reject(new Error(response?.error || '获取页面内容失败'));
                }
            });
        });
    }
    
    async callStreamingAPI(content, apiKey, task) {
        const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'deepseek-chat',
                messages: [
                    {
                        role: 'user',
                        content: `请总结以下网页内容，包含主要事件、人物、时间、地点、评价等信息，用中文回答：\n\n${content}`
                    }
                ],
                max_tokens: 1000,
                temperature: 0.7,
                stream: true // 启用流式响应
            })
        });
        
        if (!response.ok) {
            throw new Error(`DeepSeek API调用失败: ${response.status}`);
        }
        
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let summary = '';
        
        try {
            while (true) {
                const { done, value } = await reader.read();
                
                if (done) break;
                
                const chunk = decoder.decode(value);
                const lines = chunk.split('\n');
                
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6);
                        
                        if (data === '[DONE]') {
                            break;
                        }
                        
                        try {
                            const parsed = JSON.parse(data);
                            const content = parsed.choices?.[0]?.delta?.content;
                            
                            if (content) {
                                summary += content;
                                task.streamChunks.push(content);
                                task.result = summary;
                                
                                // 实时通知进度
                                this.notifyProgress(task);
                            }
                        } catch (e) {
                            // 忽略解析错误
                        }
                    }
                }
            }
        } finally {
            reader.releaseLock();
        }
        
        return summary;
    }
    
    async saveToNote(summary, taskData, task) {
        const { notesServerUrl, userId, workspace, isNewNote, selectedNoteId, tabUrl, tabTitle } = taskData;
        
        if (isNewNote) {
            await this.createNewNoteWithSummary(summary, tabUrl, tabTitle, notesServerUrl, userId, workspace);
        } else {
            await this.appendToNote(summary, tabUrl, notesServerUrl, userId, workspace, selectedNoteId);
        }
    }
    
    async createNewNoteWithSummary(summary, url, pageTitle, notesServerUrl, userId, workspace) {
        const domain = new URL(url).hostname;
        const timestamp = new Date().toLocaleString();
        const noteId = 'note_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        const noteTitle = `${domain} - ${pageTitle || '网页总结'}`;
        const noteContent = `# ${noteTitle}\n\n## 来自 DeepSeek 对 ${domain} 的总结\n\n**时间**: ${timestamp}  \n**链接**: [${url}](${url})\n\n${summary}\n`;
        
        const response = await fetch(`${notesServerUrl}/api/notes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: noteId,
                title: noteTitle,
                content: noteContent,
                workspace: workspace,
                userId: userId
            })
        });
        
        if (!response.ok) {
            throw new Error(`创建笔记失败: ${response.status}`);
        }
    }
    
    async appendToNote(summary, url, notesServerUrl, userId, workspace, selectedNoteId) {
        // 获取现有笔记
        const notesResponse = await fetch(`${notesServerUrl}/api/notes?workspace=${workspace}&userId=${userId}`);
        const notes = await notesResponse.json();
        const currentNote = notes.find(note => note.id === selectedNoteId);
        
        if (!currentNote) {
            throw new Error('找不到选中的笔记');
        }
        
        const domain = new URL(url).hostname;
        const timestamp = new Date().toLocaleString();
        const appendContent = `\n\n---\n\n## 来自 DeepSeek 对 ${domain} 的总结\n\n**时间**: ${timestamp}  \n**链接**: [${url}](${url})\n\n${summary}\n`;
        const updatedContent = (currentNote.content || '') + appendContent;
        
        const response = await fetch(`${notesServerUrl}/api/notes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: selectedNoteId,
                title: currentNote.title,
                content: updatedContent,
                workspace: workspace,
                userId: userId
            })
        });
        
        if (!response.ok) {
            throw new Error(`更新笔记失败: ${response.status}`);
        }
    }
    
    notifyProgress(task) {
        // 通知所有监听的popup窗口
        chrome.runtime.sendMessage({
            action: 'taskProgress',
            task: {
                id: task.id,
                status: task.status,
                progress: task.progress,
                result: task.result,
                error: task.error,
                streamChunks: task.streamChunks
            }
        }).catch(() => {
            // 忽略没有监听者的错误
        });
    }
    
    getTaskStatus(taskId, sendResponse) {
        const task = this.activeTasks.get(taskId);
        if (task) {
            sendResponse({ 
                success: true, 
                task: {
                    id: task.id,
                    status: task.status,
                    progress: task.progress,
                    result: task.result,
                    error: task.error
                }
            });
        } else {
            sendResponse({ success: false, error: '任务不存在' });
        }
    }
    
    cancelTask(taskId, sendResponse) {
        const task = this.activeTasks.get(taskId);
        if (task) {
            task.status = 'cancelled';
            this.activeTasks.delete(taskId);
            sendResponse({ success: true });
        } else {
            sendResponse({ success: false, error: '任务不存在' });
        }
    }
}

// 初始化后台总结器
const backgroundSummarizer = new BackgroundSummarizer();

chrome.runtime.onInstalled.addListener(() => {
    console.log('网页总结插件已安装 - 支持后台持续运行');
});