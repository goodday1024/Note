class NoteSummarizerPopup {
    constructor() {
        this.selectedNoteId = null;
        this.isNewNote = false;
        this.init();
    }
    
    async init() {
        await this.loadSettings();
        this.setupEventListeners();
        await this.loadNotes();
        await this.syncSettingsFromServer();
    }
    
    async loadSettings() {
        const settings = await chrome.storage.sync.get([
            'userId',
            'deepseekApiKey',
            'notesServerUrl',
            'workspace',
            'selectedNoteId',
            'isNewNote'
        ]);
        
        document.getElementById('userId').value = settings.userId || '';
        document.getElementById('apiKey').value = settings.deepseekApiKey || '';
        document.getElementById('notesServerUrl').value = settings.notesServerUrl || 'http://localhost:3000';
        document.getElementById('workspace').value = settings.workspace || 'public';
        this.selectedNoteId = settings.selectedNoteId;
        this.isNewNote = settings.isNewNote || false;
        
        this.updateUserInfo();
    }
    
    async saveSettings() {
        const settings = {
            userId: document.getElementById('userId').value,
            deepseekApiKey: document.getElementById('apiKey').value,
            notesServerUrl: document.getElementById('notesServerUrl').value,
            workspace: document.getElementById('workspace').value,
            selectedNoteId: this.selectedNoteId,
            isNewNote: this.isNewNote
        };
        
        await chrome.storage.sync.set(settings);
        this.updateUserInfo();
    }
    
    updateUserInfo() {
        const userId = document.getElementById('userId').value;
        const userInfo = document.getElementById('userInfo');
        
        if (userId) {
            userInfo.textContent = `当前用户: ${userId}`;
            userInfo.style.display = 'block';
        } else {
            userInfo.style.display = 'none';
        }
    }
    
    setupEventListeners() {
        document.getElementById('summarizeBtn').addEventListener('click', () => this.summarizeAndAppend());
        document.getElementById('refreshNotes').addEventListener('click', () => this.loadNotes());
        document.getElementById('syncSettings').addEventListener('click', () => this.syncSettingsFromServer());
        
        // 保存设置当输入改变时
        ['userId', 'apiKey', 'notesServerUrl', 'workspace'].forEach(id => {
            document.getElementById(id).addEventListener('change', () => {
                this.saveSettings();
                if (id === 'userId' || id === 'notesServerUrl') {
                    this.loadNotes();
                }
            });
        });
        
        document.getElementById('workspace').addEventListener('change', () => this.loadNotes());
        document.getElementById('userId').addEventListener('input', () => this.updateUserInfo());
    }
    
    async syncSettingsFromServer() {
        const userId = document.getElementById('userId').value;
        const notesServerUrl = document.getElementById('notesServerUrl').value;
        
        if (!userId || !notesServerUrl) {
            this.showStatus('请先配置用户ID和服务器地址', 'error');
            return;
        }
        
        try {
            this.showStatus('正在同步设置...', 'loading');
            
            const response = await fetch(`${notesServerUrl}/api/settings?userId=${userId}`);
            if (response.ok) {
                const serverSettings = await response.json();
                
                // 同步服务器设置到本地
                if (serverSettings.aiApiKey) {
                    document.getElementById('apiKey').value = serverSettings.aiApiKey;
                }
                
                await this.saveSettings();
                this.showStatus('设置同步成功', 'success');
                document.getElementById('syncStatus').textContent = `最后同步: ${new Date().toLocaleString()}`;
            } else {
                this.showStatus('同步设置失败，将使用本地设置', 'error');
            }
        } catch (error) {
            console.error('同步设置失败:', error);
            this.showStatus('同步设置失败，将使用本地设置', 'error');
        }
    }
    
    async loadNotes() {
        const userId = document.getElementById('userId').value;
        const notesServerUrl = document.getElementById('notesServerUrl').value;
        const workspace = document.getElementById('workspace').value;
        
        if (!userId || !notesServerUrl) {
            const notesList = document.getElementById('notesList');
            notesList.innerHTML = '<div style="padding: 20px; text-align: center; color: #666;">请先配置用户ID和服务器地址</div>';
            return;
        }
        
        try {
            const response = await fetch(`${notesServerUrl}/api/notes?workspace=${workspace}&userId=${userId}`);
            const notes = await response.json();
            
            this.renderNotesList(notes);
        } catch (error) {
            console.error('加载笔记失败:', error);
            this.showStatus('加载笔记失败，请检查服务器地址和用户ID', 'error');
        }
    }
    
    renderNotesList(notes) {
        const notesList = document.getElementById('notesList');
        
        // 添加新建笔记选项
        let html = `
            <div class="note-item new-note-option ${this.isNewNote ? 'selected' : ''}" data-note-id="new">
                <strong>📝 新建笔记</strong>
                <div style="font-size: 12px; color: #6c757d; margin-top: 2px;">
                    创建新笔记并追加总结内容
                </div>
            </div>
        `;
        
        if (notes.length === 0) {
            html += '<div style="padding: 20px; text-align: center; color: #666;">暂无现有笔记</div>';
        } else {
            html += notes.map(note => `
                <div class="note-item ${note.id === this.selectedNoteId && !this.isNewNote ? 'selected' : ''}" data-note-id="${note.id}">
                    <strong>${note.title || '无标题'}</strong>
                    <div style="font-size: 12px; color: #666; margin-top: 2px;">
                        ${new Date(note.updatedAt).toLocaleString()}
                    </div>
                </div>
            `).join('');
        }
        
        notesList.innerHTML = html;
        
        // 添加点击事件
        notesList.querySelectorAll('.note-item').forEach(item => {
            item.addEventListener('click', () => {
                // 移除之前的选中状态
                notesList.querySelectorAll('.note-item').forEach(i => i.classList.remove('selected'));
                // 添加选中状态
                item.classList.add('selected');
                
                const noteId = item.dataset.noteId;
                if (noteId === 'new') {
                    this.isNewNote = true;
                    this.selectedNoteId = null;
                } else {
                    this.isNewNote = false;
                    this.selectedNoteId = noteId;
                }
                
                this.saveSettings();
            });
        });
    }
    
    async summarizeAndAppend() {
        const userId = document.getElementById('userId').value;
        const apiKey = document.getElementById('apiKey').value;
        const notesServerUrl = document.getElementById('notesServerUrl').value;
        
        if (!userId) {
            this.showStatus('请先配置用户ID', 'error');
            return;
        }
        
        if (!apiKey) {
            this.showStatus('请先配置DeepSeek API Key', 'error');
            return;
        }
        
        if (!notesServerUrl) {
            this.showStatus('请先配置笔记服务器地址', 'error');
            return;
        }
        
        if (!this.isNewNote && !this.selectedNoteId) {
            this.showStatus('请先选择要追加的笔记或选择新建笔记', 'error');
            return;
        }
        
        this.showStatus('正在获取网页内容...', 'loading');
        document.getElementById('summarizeBtn').disabled = true;
        
        try {
            // 获取当前标签页信息
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            // 获取网页内容
            const [result] = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                function: this.extractPageContent
            });
            
            const pageContent = result.result;
            
            this.showStatus('正在使用DeepSeek总结内容...', 'loading');
            
            // 调用DeepSeek API总结内容
            const summary = await this.callDeepSeekAPI(pageContent, apiKey);
            
            this.showStatus('正在保存到笔记...', 'loading');
            
            // 保存到笔记
            if (this.isNewNote) {
                await this.createNewNoteWithSummary(summary, tab.url, tab.title, notesServerUrl, userId);
            } else {
                await this.appendToNote(summary, tab.url, notesServerUrl, userId);
            }
            
            this.showStatus('成功保存到笔记！', 'success');
            
            // 刷新笔记列表
            await this.loadNotes();
            
        } catch (error) {
            console.error('操作失败:', error);
            this.showStatus(`操作失败: ${error.message}`, 'error');
        } finally {
            document.getElementById('summarizeBtn').disabled = false;
        }
    }
    
    extractPageContent() {
        // 移除脚本和样式标签
        const scripts = document.querySelectorAll('script, style, nav, header, footer, aside');
        scripts.forEach(el => el.remove());
        
        // 获取主要内容
        const content = document.body.innerText || document.body.textContent || '';
        
        // 清理和压缩文本
        return content
            .replace(/\s+/g, ' ')
            .replace(/\n\s*\n/g, '\n')
            .trim()
            .substring(0, 8000); // 限制长度
    }
    
    async callDeepSeekAPI(content, apiKey) {
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
                temperature: 0.7
            })
        });
        
        if (!response.ok) {
            throw new Error(`DeepSeek API调用失败: ${response.status}`);
        }
        
        const data = await response.json();
        return data.choices[0].message.content;
    }
    
    async createNewNoteWithSummary(summary, url, pageTitle, notesServerUrl, userId) {
        const workspace = document.getElementById('workspace').value;
        const domain = new URL(url).hostname;
        const timestamp = new Date().toLocaleString();
        
        // 生成新笔记ID
        const noteId = 'note_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        
        // 创建笔记标题
        const noteTitle = `${domain} - ${pageTitle || '网页总结'}`;
        
        // 格式化笔记内容
        const noteContent = `# ${noteTitle}\n\n## 来自 DeepSeek 对 ${domain} 的总结\n\n**时间**: ${timestamp}  \n**链接**: [${url}](${url})\n\n${summary}\n`;
        
        const response = await fetch(`${notesServerUrl}/api/notes`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
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
        
        // 更新选中的笔记
        this.selectedNoteId = noteId;
        this.isNewNote = false;
        await this.saveSettings();
    }
    
    async appendToNote(summary, url, notesServerUrl, userId) {
        const workspace = document.getElementById('workspace').value;
        
        // 首先获取当前笔记内容
        const notesResponse = await fetch(`${notesServerUrl}/api/notes?workspace=${workspace}&userId=${userId}`);
        const notes = await notesResponse.json();
        const currentNote = notes.find(note => note.id === this.selectedNoteId);
        
        if (!currentNote) {
            throw new Error('找不到选中的笔记');
        }
        
        // 格式化要追加的内容
        const domain = new URL(url).hostname;
        const timestamp = new Date().toLocaleString();
        const appendContent = `\n\n---\n\n## 来自 DeepSeek 对 ${domain} 的总结\n\n**时间**: ${timestamp}  \n**链接**: [${url}](${url})\n\n${summary}\n`;
        
        // 追加内容到笔记
        const updatedContent = (currentNote.content || '') + appendContent;
        
        const response = await fetch(`${notesServerUrl}/api/notes`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                id: this.selectedNoteId,
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
    
    showStatus(message, type) {
        const status = document.getElementById('status');
        status.textContent = message;
        status.className = `status ${type}`;
        status.style.display = 'block';
        
        if (type === 'success') {
            setTimeout(() => {
                status.style.display = 'none';
            }, 3000);
        }
    }
}

// 初始化
new NoteSummarizerPopup();