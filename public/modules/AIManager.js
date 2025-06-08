/**
 * AI助手管理模块
 * 负责处理@chat和@writer等AI触发器功能
 */
class AIManager {
    constructor(app) {
        this.app = app;
        this.isProcessing = false;
    }
    
    // 处理AI触发器
    async handleAITrigger(trigger, content, position) {
        if (!this.app.settings.aiEnabled) {
            this.showAIError('AI功能未启用，请在设置中开启');
            return;
        }
        
        if (!this.app.settings.aiApiKey) {
            this.showAIError('请先在设置中配置AI API密钥');
            return;
        }
        
        if (this.isProcessing) {
            this.showAIError('AI正在处理中，请稍候...');
            return;
        }
        
        this.isProcessing = true;
        this.showAIStatus('AI正在思考中...');
        
        try {
            let response;
            
            switch (trigger) {
                case '@chat':
                    response = await this.handleChatRequest(content);
                    break;
                case '@writer':
                    response = await this.handleWriterRequest(content);
                    break;
                default:
                    throw new Error(`未知的AI触发器: ${trigger}`);
            }
            
            if (response) {
                this.insertAIResponse(response, position);
                this.showAIStatus('AI回复已插入', 'success');
            }
            
        } catch (error) {
            console.error('AI处理错误:', error);
            this.showAIError(`AI处理失败: ${error.message}`);
        } finally {
            this.isProcessing = false;
            setTimeout(() => this.hideAIStatus(), 3000);
        }
    }
    
    // 处理聊天请求
    async handleChatRequest(content) {
        const messages = [
            {
                role: 'system',
                content: '你是一个有用的AI助手，请用简洁明了的方式回答用户的问题。'
            },
            {
                role: 'user',
                content: content
            }
        ];
        
        return await this.callAIAPI(messages);
    }
    
    // 处理写作请求
    async handleWriterRequest(content) {
        const messages = [
            {
                role: 'system',
                content: '你是一个专业的写作助手，请根据用户的要求帮助完善、扩展或改写内容。请直接提供改进后的内容，不需要额外的解释。'
            },
            {
                role: 'user',
                content: content
            }
        ];
        
        return await this.callAIAPI(messages);
    }
    
    // 调用AI API
    async callAIAPI(messages) {
        const response = await fetch(`${this.app.settings.aiBaseUrl}/v1/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.app.settings.aiApiKey}`
            },
            body: JSON.stringify({
                model: this.app.settings.aiModel,
                messages: messages,
                temperature: 0.7,
                max_tokens: 2000
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (!data.choices || !data.choices[0] || !data.choices[0].message) {
            throw new Error('AI API返回格式错误');
        }
        
        return data.choices[0].message.content;
    }
    
    // 插入AI回复
    insertAIResponse(response, position) {
        const editor = document.getElementById('editor');
        if (!editor) return;
        
        const currentContent = editor.value;
        const beforeCursor = currentContent.substring(0, position.start);
        const afterCursor = currentContent.substring(position.end);
        
        // 格式化AI回复
        const formattedResponse = `\n\n**AI回复:**\n\n${response}\n\n---\n`;
        
        // 插入回复
        const newContent = beforeCursor + formattedResponse + afterCursor;
        editor.value = newContent;
        
        // 设置光标位置到回复末尾
        const newCursorPosition = beforeCursor.length + formattedResponse.length;
        editor.setSelectionRange(newCursorPosition, newCursorPosition);
        
        // 触发内容变化事件
        this.app.noteManager.onContentChange();
        
        // 滚动到插入位置
        editor.focus();
        this.scrollToPosition(editor, newCursorPosition);
    }
    
    // 滚动到指定位置
    scrollToPosition(editor, position) {
        const lines = editor.value.substring(0, position).split('\n');
        const lineNumber = lines.length;
        const lineHeight = parseInt(getComputedStyle(editor).lineHeight) || 20;
        const scrollTop = (lineNumber - 1) * lineHeight;
        
        editor.scrollTop = Math.max(0, scrollTop - editor.clientHeight / 2);
    }
    
    // 显示AI状态
    showAIStatus(message, type = 'info') {
        let statusElement = document.getElementById('ai-status');
        
        if (!statusElement) {
            statusElement = document.createElement('div');
            statusElement.id = 'ai-status';
            statusElement.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                padding: 10px 15px;
                border-radius: 5px;
                color: white;
                font-size: 14px;
                z-index: 10000;
                max-width: 300px;
                word-wrap: break-word;
                transition: all 0.3s ease;
            `;
            document.body.appendChild(statusElement);
        }
        
        // 设置样式
        const colors = {
            info: '#2196F3',
            success: '#4CAF50',
            error: '#f44336',
            warning: '#FF9800'
        };
        
        statusElement.style.backgroundColor = colors[type] || colors.info;
        statusElement.textContent = message;
        statusElement.style.display = 'block';
        statusElement.style.opacity = '1';
    }
    
    // 显示AI错误
    showAIError(message) {
        this.showAIStatus(message, 'error');
        setTimeout(() => this.hideAIStatus(), 5000);
    }
    
    // 隐藏AI状态
    hideAIStatus() {
        const statusElement = document.getElementById('ai-status');
        if (statusElement) {
            statusElement.style.opacity = '0';
            setTimeout(() => {
                statusElement.style.display = 'none';
            }, 300);
        }
    }
    
    // 检测AI触发器
    detectAITrigger(text, cursorPosition) {
        const triggers = ['@chat', '@writer'];
        
        for (const trigger of triggers) {
            const triggerIndex = text.lastIndexOf(trigger, cursorPosition);
            if (triggerIndex !== -1) {
                // 检查触发器前是否是行首或空格
                const beforeTrigger = triggerIndex > 0 ? text[triggerIndex - 1] : '\n';
                if (beforeTrigger === '\n' || beforeTrigger === ' ') {
                    // 查找触发器后的内容
                    const afterTrigger = text.substring(triggerIndex + trigger.length);
                    const nextLineIndex = afterTrigger.indexOf('\n');
                    const content = nextLineIndex !== -1 ? 
                        afterTrigger.substring(0, nextLineIndex).trim() : 
                        afterTrigger.trim();
                    
                    if (content) {
                        return {
                            trigger,
                            content,
                            position: {
                                start: triggerIndex,
                                end: triggerIndex + trigger.length + (nextLineIndex !== -1 ? nextLineIndex : afterTrigger.length)
                            }
                        };
                    }
                }
            }
        }
        
        return null;
    }
    
    // 处理编辑器键盘事件
    handleEditorKeydown(event) {
        // 检测 Ctrl+Enter 或 Cmd+Enter 触发AI
        if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
            const editor = event.target;
            const cursorPosition = editor.selectionStart;
            const text = editor.value;
            
            const aiTrigger = this.detectAITrigger(text, cursorPosition);
            if (aiTrigger) {
                event.preventDefault();
                this.handleAITrigger(aiTrigger.trigger, aiTrigger.content, aiTrigger.position);
            }
        }
    }
    
    // 获取AI使用统计
    getAIStats() {
        const stats = JSON.parse(localStorage.getItem('ai-stats') || '{}');
        return {
            totalRequests: stats.totalRequests || 0,
            chatRequests: stats.chatRequests || 0,
            writerRequests: stats.writerRequests || 0,
            lastUsed: stats.lastUsed || null,
            errors: stats.errors || 0
        };
    }
    
    // 更新AI使用统计
    updateAIStats(trigger, success = true) {
        const stats = this.getAIStats();
        
        stats.totalRequests++;
        stats.lastUsed = new Date().toISOString();
        
        if (success) {
            if (trigger === '@chat') {
                stats.chatRequests++;
            } else if (trigger === '@writer') {
                stats.writerRequests++;
            }
        } else {
            stats.errors++;
        }
        
        localStorage.setItem('ai-stats', JSON.stringify(stats));
    }
    
    // 清除AI使用统计
    clearAIStats() {
        localStorage.removeItem('ai-stats');
    }
    
    // 测试AI连接
    async testAIConnection() {
        if (!this.app.settings.aiEnabled || !this.app.settings.aiApiKey) {
            throw new Error('AI功能未启用或未配置API密钥');
        }
        
        try {
            const response = await this.callAIAPI([
                {
                    role: 'user',
                    content: '请回复"连接测试成功"'
                }
            ]);
            
            return response.includes('连接测试成功') || response.includes('成功');
        } catch (error) {
            throw new Error(`连接测试失败: ${error.message}`);
        }
    }
}

// 导出类
window.AIManager = AIManager;