// 智能笔记应用主类
class NotesApp {
    constructor() {
        this.notes = [];
        this.currentNote = null;
        this.settings = {
            theme: 'light',
            fontSize: 'medium',
            autoSave: true,
            cloudSync: false,
            userId: '',
            aiEnabled: true,
            aiProvider: 'openai',
            aiApiKey: '',
            aiModel: 'gpt-3.5-turbo',
            customStyleUrl: ''
        };
        this.aiManager = null;
        this.isPreviewMode = false;
        this.isFullscreen = false;
        this.autoSaveTimer = null;
        this.isCreatingNote = false;
        this.syncTimer = null;
        this.lastSyncTime = null;
    }

    // 初始化应用
    // 修改初始化方法
    async init() {
        await this.loadSettings();

        // 如果启用了云同步，每次打开网页都重新激活云同步
        if (this.settings.cloudSync) {
            try {
                this.showToast('正在重新激活云同步...');

                // 先停止可能存在的自动同步
                this.stopAutoSync();

                const cst = document.getElementById('cloud-sync-toggle');
                // 取消打开云同步
                cst.addEventListener('onload', (e) => this.toggleCloudSync(e.target.checked));
                //等待 1.5s
                await new Promise(resolve => setTimeout(resolve, 1500));
                // 重新激活云同步
                cst.addEventListener('onload', (e) => this.toggleCloudSync(e.target.checked));
                // 重新启动自动同步
                await this.syncFromCloud();
                await this.syncSettingsFromCloud();

                this.startAutoSync();

                this.showToast('云同步已重新激活，数据已同步');
            } catch (error) {
                console.error('重新激活云同步失败:', error);
                this.showToast('云同步重新激活失败: ' + error.message, 'error');
                // 如果云端同步失败，仍然加载本地数据
                await this.loadNotes();
            }
        } else {
            // 如果未启用云同步，正常加载本地笔记
            await this.loadNotes();
        }

        this.initAI();
        this.initChatHistory();
        this.setupEventListeners();
        this.initMarkdownToolbar();
        this.applyTheme();
        this.applyFontSize();
        this.updateSettingsUI();
        await this.renderNotesList();

        // 如果没有笔记，显示欢迎信息
        if (this.notes.length === 0) {
            this.showWelcomeMessage();
        } else {
            // 加载第一篇笔记
            await this.loadNote(this.notes[0].id);
        }
    }

    // 设置事件监听器
    setupEventListeners() {
        // 工具栏按钮
        const menuBtn = document.getElementById('menu-btn');
        const newNoteBtn = document.getElementById('new-note-btn');
        const searchBtn = document.getElementById('search-btn');
        const settingsBtn = document.getElementById('settings-btn');

        if (menuBtn) menuBtn.addEventListener('click', () => this.toggleSidebar());
        if (newNoteBtn) newNoteBtn.addEventListener('click', () => this.createNote());
        if (searchBtn) searchBtn.addEventListener('click', () => this.focusSearch());
        if (settingsBtn) settingsBtn.addEventListener('click', () => this.toggleSettings());

        // 编辑器按钮
        const aiImproveBtn = document.getElementById('ai-improve-btn');
        const aiSummarizeBtn = document.getElementById('ai-summarize-btn');
        const aiTranslateBtn = document.getElementById('ai-translate-btn');
        const aiAssistantBtn = document.getElementById('ai-assistant-btn');
        const previewBtn = document.getElementById('preview-btn');
        const fullscreenBtn = document.getElementById('fullscreen-btn');
        const saveBtn = document.getElementById('save-btn');

        if (aiImproveBtn) aiImproveBtn.addEventListener('click', () => this.improveTextWithAI());
        if (aiSummarizeBtn) aiSummarizeBtn.addEventListener('click', () => this.summarizeWithAI());
        if (aiTranslateBtn) aiTranslateBtn.addEventListener('click', () => this.translateWithAI());
        if (aiAssistantBtn) aiAssistantBtn.addEventListener('click', () => this.toggleAIChat());
        if (previewBtn) previewBtn.addEventListener('click', () => this.togglePreview());
        if (fullscreenBtn) fullscreenBtn.addEventListener('click', () => this.toggleFullscreen());
        if (saveBtn) saveBtn.addEventListener('click', () => this.saveCurrentNote());

        // 设置面板
        const closeSettings = document.getElementById('close-settings');
        const themeSelect = document.getElementById('theme-select');
        const fontSizeSelect = document.getElementById('font-size-select');
        const autoSaveToggle = document.getElementById('auto-save-toggle');
        const cloudSyncToggle = document.getElementById('cloud-sync-toggle');
        const userIdInput = document.getElementById('user-id-input');
        const aiEnabledToggle = document.getElementById('ai-enabled-toggle');
        const aiProviderSelect = document.getElementById('ai-provider-select');
        const aiApiKey = document.getElementById('ai-api-key');
        const aiModelSelect = document.getElementById('ai-model-select');
        const markdownDemoBtn = document.getElementById('markdown-demo-btn');
        const customStyleUrlInput = document.getElementById('custom-style-url');

        if (closeSettings) closeSettings.addEventListener('click', () => this.toggleSettings());
        if (themeSelect) themeSelect.addEventListener('change', (e) => this.changeTheme(e.target.value));
        if (fontSizeSelect) fontSizeSelect.addEventListener('change', (e) => this.changeFontSize(e.target.value));
        if (autoSaveToggle) autoSaveToggle.addEventListener('change', (e) => this.toggleAutoSave(e.target.checked));
        if (cloudSyncToggle) cloudSyncToggle.addEventListener('change', (e) => this.toggleCloudSync(e.target.checked));
        if (userIdInput) userIdInput.addEventListener('input', (e) => this.updateUserId(e.target.value));
        if (aiEnabledToggle) aiEnabledToggle.addEventListener('change', (e) => this.toggleAI(e.target.checked));
        if (aiProviderSelect) aiProviderSelect.addEventListener('change', (e) => this.changeAIProvider(e.target.value));
        if (aiApiKey) aiApiKey.addEventListener('input', (e) => this.updateAIApiKey(e.target.value));
        if (markdownDemoBtn) markdownDemoBtn.addEventListener('click', () => this.showMarkdownDemo());
        if (customStyleUrlInput) customStyleUrlInput.addEventListener('input', (e) => this.updateCustomStyleUrl(e.target.value));
        if (aiModelSelect) aiModelSelect.addEventListener('change', (e) => this.changeAIModel(e.target.value));

        // AI 聊天面板
        const closeAIChat = document.getElementById('close-ai-chat');
        const aiChatClear = document.getElementById('ai-chat-clear');
        const aiChatInput = document.getElementById('ai-chat-input');
        const aiChatSend = document.getElementById('ai-chat-send');

        if (closeAIChat) closeAIChat.addEventListener('click', () => this.toggleAIChat());
        if (aiChatClear) aiChatClear.addEventListener('click', () => this.clearAIChat());
        if (aiChatInput) {
            aiChatInput.addEventListener('input', (e) => this.onAIChatInputChange(e));
            aiChatInput.addEventListener('keydown', (e) => this.onAIChatKeyDown(e));
        }
        if (aiChatSend) aiChatSend.addEventListener('click', () => this.sendAIMessage());

        // AI 聊天建议按钮
        document.querySelectorAll('.suggestion-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.onSuggestionClick(e.target.dataset.suggestion));
        });

        // 编辑器事件
        const noteTitle = document.getElementById('note-title');
        const editor = document.getElementById('editor');

        if (noteTitle) noteTitle.addEventListener('input', () => this.onTitleChange());
        if (editor) editor.addEventListener('input', () => this.onContentChange());

        // 搜索
        const searchInputForEvent = document.getElementById('search-input');
        if (searchInputForEvent) searchInputForEvent.addEventListener('input', (e) => this.searchNotes(e.target.value));

        // 键盘快捷键
        document.addEventListener('keydown', (e) => this.handleKeyboardShortcuts(e));

        // 窗口事件
        // 窗口事件
        window.addEventListener('beforeunload', async (e) => {
            // 保存当前笔记
            this.saveCurrentNote();

            // 如果启用了云同步，强制同步一次
            if (this.settings.cloudSync) {
                try {
                    // 使用同步方式确保在页面关闭前完成同步
                    await this.syncToCloud();
                    console.log('页面关闭前同步完成');
                } catch (error) {
                    console.error('页面关闭前同步失败:', error);
                    // 即使同步失败也不阻止页面关闭
                }
            }
        });
        window.addEventListener('resize', () => this.handleResize());
        document.addEventListener('visibilitychange', async () => {
            if (document.hidden && this.settings.cloudSync) {
                // 页面变为不可见时（切换标签页），进行同步
                try {
                    await this.syncToCloud();
                    console.log('标签页切换时同步完成');
                } catch (error) {
                    console.error('标签页切换时同步失败:', error);
                }
            }
        });
    }

    // 创建新笔记
    createNote() {
        // 防止重复创建
        if (this.isCreatingNote) {
            return;
        }

        this.isCreatingNote = true;

        const note = {
            id: this.generateId(),
            title: '无标题',
            content: '',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            tags: []
        };

        this.notes.unshift(note);
        this.saveNotes();
        this.renderNotesList();
        this.loadNote(note.id);

        // 聚焦标题输入框
        setTimeout(() => {
            document.getElementById('note-title').focus();
            document.getElementById('note-title').select();
            this.isCreatingNote = false;
        }, 100);
    }

    // 加载笔记
    loadNote(noteId) {
        const note = this.notes.find(n => n.id === noteId);
        if (!note) return;

        // 保存当前笔记
        if (this.currentNote) {
            this.saveCurrentNote();
        }

        this.currentNote = note;

        // 更新UI
        document.getElementById('note-title').value = note.title;
        document.getElementById('editor').value = note.content;

        // 更新预览
        if (this.isPreviewMode) {
            this.updatePreview();
        }

        // 更新笔记列表选中状态
        this.updateNotesListSelection(noteId);

        // 隐藏空状态
        this.hideEmptyState();
    }

    // 保存当前笔记
    async saveCurrentNote(showToast = true) {
        if (!this.currentNote) return;

        const title = document.getElementById('note-title').value.trim() || '无标题';
        const content = document.getElementById('editor').value;

        // 更新当前笔记对象
        this.currentNote.title = title;
        this.currentNote.content = content;
        this.currentNote.updatedAt = new Date().toISOString();

        // 确保在notes数组中也更新了对应的笔记
        const noteIndex = this.notes.findIndex(note => note.id === this.currentNote.id);
        if (noteIndex !== -1) {
            this.notes[noteIndex] = { ...this.currentNote };
        }

        this.saveNotes();
        await this.renderNotesList();

        // 如果启用云同步，立即同步到云端（实时同步）
        if (this.settings.cloudSync) {
            try {
                await this.syncToCloudSilent();
            } catch (error) {
                console.error('实时同步失败:', error);
            }
        }

        // 显示保存成功提示
        if (showToast) {
            this.showToast('笔记已保存');
        }
    }

    // 删除笔记
    async deleteNote(noteId) {
        if (!confirm('确定要删除这篇笔记吗？')) return;

        const index = this.notes.findIndex(n => n.id === noteId);
        if (index === -1) return;

        // 暂停自动同步，避免删除操作被覆盖
        const wasAutoSyncRunning = !!this.syncTimer;
        if (wasAutoSyncRunning) {
            this.stopAutoSync();
        }

        try {
            // 删除笔记
            this.notes.splice(index, 1);

            // 立即保存到本地
            localStorage.setItem('notes', JSON.stringify(this.notes));

            // 如果启用了云同步，立即同步删除操作到云端
            if (this.settings.cloudSync) {
                this.updateSyncIndicator('syncing');
                await this.syncToCloud();
                this.updateSyncIndicator('success');
            }

            this.renderNotesList();

            // 如果删除的是当前笔记
            if (this.currentNote && this.currentNote.id === noteId) {
                if (this.notes.length > 0) {
                    this.loadNote(this.notes[0].id);
                } else {
                    this.currentNote = null;
                    this.showWelcomeMessage();
                }
            }

            this.showToast('笔记已删除');

        } catch (error) {
            console.error('删除笔记失败:', error);
            this.showToast('删除失败: ' + error.message, 'error');
            // 重新加载笔记列表，恢复状态
            await this.loadNotes();
            this.renderNotesList();
        } finally {
            // 恢复自动同步
            if (wasAutoSyncRunning && this.settings.cloudSync) {
                // 延迟1秒后恢复自动同步，确保删除操作完全完成
                setTimeout(() => {
                    this.startAutoSync();
                }, 1000);
            }
        }
    }

    // 搜索笔记
    searchNotes(query) {
        const filteredNotes = query.trim() === ''
            ? this.notes
            : this.notes.filter(note =>
                note.title.toLowerCase().includes(query.toLowerCase()) ||
                note.content.toLowerCase().includes(query.toLowerCase())
            );

        this.renderNotesList(filteredNotes);
    }

    // 渲染笔记列表
    renderNotesList(notes = this.notes) {
        const notesList = document.getElementById('notes-list');

        if (notes.length === 0) {
            notesList.innerHTML = `
                <div class="empty-state">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor" opacity="0.3">
                        <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
                    </svg>
                    <p>暂无笔记</p>
                    <p>点击"新建"创建第一篇笔记</p>
                </div>
            `;
            return;
        }

        notesList.innerHTML = notes.map(note => `
            <div class="note-item ${this.currentNote && this.currentNote.id === note.id ? 'active' : ''}" 
                 data-note-id="${note.id}">
                <div class="note-title">${this.escapeHtml(note.title)}</div>
                <div class="note-preview">${this.escapeHtml(note.content.substring(0, 100))}${note.content.length > 100 ? '...' : ''}</div>
                <div class="note-date">${this.formatDate(note.updatedAt)}</div>
                <button class="delete-note-btn" data-note-id="${note.id}" title="删除笔记">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z"/>
                    </svg>
                </button>
            </div>
        `).join('');

        // 添加点击事件
        notesList.querySelectorAll('.note-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (!e.target.closest('.delete-note-btn')) {
                    this.loadNote(item.dataset.noteId);
                }
            });
        });

        // 添加删除按钮事件
        notesList.querySelectorAll('.delete-note-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.deleteNote(btn.dataset.noteId);
            });
        });
    }

    // 切换预览模式
    togglePreview() {
        this.isPreviewMode = !this.isPreviewMode;
        const editor = document.getElementById('editor');
        const preview = document.getElementById('preview');
        const previewBtn = document.getElementById('preview-btn');

        if (this.isPreviewMode) {
            editor.style.display = 'none';
            preview.style.display = 'block';
            previewBtn.classList.add('active');
            this.updatePreview();
        } else {
            editor.style.display = 'block';
            preview.style.display = 'none';
            previewBtn.classList.remove('active');
        }
    }

    // 更新预览内容
    updatePreview() {
        const content = document.getElementById('editor').value;
        const preview = document.getElementById('preview');
        preview.innerHTML = this.markdownToHtml(content);
    }

    // 使用 marked.js 和 KaTeX 的 Markdown 转 HTML
    markdownToHtml(markdown) {
        try {
            // 配置 marked.js
            marked.setOptions({
                breaks: true,
                gfm: true,
                tables: true,
                sanitize: false,
                smartLists: true,
                smartypants: true,
                highlight: function (code, lang) {
                    // 简单的代码高亮
                    return `<code class="language-${lang || 'text'}">${this.escapeHtml(code)}</code>`;
                }.bind(this)
            });

            // 使用 marked 解析 Markdown
            let html = marked.parse(markdown);

            // 渲染数学公式
            if (typeof renderMathInElement !== 'undefined') {
                // 创建临时容器来渲染数学公式
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = html;

                // 渲染 KaTeX 公式
                renderMathInElement(tempDiv, {
                    delimiters: [
                        { left: '$$', right: '$$', display: true },
                        { left: '$', right: '$', display: false },
                        { left: '\\[', right: '\\]', display: true },
                        { left: '\\(', right: '\\)', display: false }
                    ],
                    throwOnError: false,
                    errorColor: '#cc0000'
                });

                html = tempDiv.innerHTML;
            }

            return html;
        } catch (error) {
            console.error('Markdown 解析错误:', error);
            // 降级到简单的文本显示
            return `<pre>${this.escapeHtml(markdown)}</pre>`;
        }
    }

    // 切换全屏模式
    toggleFullscreen() {
        this.isFullscreen = !this.isFullscreen;
        document.body.classList.toggle('fullscreen', this.isFullscreen);

        const fullscreenBtn = document.getElementById('fullscreen-btn');
        if (fullscreenBtn) {
            fullscreenBtn.classList.toggle('active', this.isFullscreen);
        }
    }

    // 切换侧边栏
    toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        sidebar.classList.toggle('open');
    }

    // 更新同步指示器
    updateSyncIndicator(status, message = '') {
        const indicator = document.getElementById('sync-indicator');
        const statusText = indicator.querySelector('.sync-status');

        if (!this.settings.cloudSync) {
            indicator.style.display = 'none';
            return;
        }

        indicator.style.display = 'flex';
        indicator.className = 'sync-indicator ' + status;

        switch (status) {
            case 'syncing':
                statusText.textContent = '同步中...';
                break;
            case 'success':
                statusText.textContent = '已同步';
                break;
            case 'error':
                statusText.textContent = message || '同步失败';
                break;
            default:
                statusText.textContent = '已同步';
        }
    }

    // 启动自动同步
    startAutoSync() {
        this.stopAutoSync();

        if (!this.settings.cloudSync) {
            this.updateSyncIndicator('hidden');
            return;
        }

        this.updateSyncIndicator('success');

        // 每15秒同步一次
        this.syncTimer = setInterval(async () => {
            await this.performAutoSync();
        }, 15000);
    }

    // 停止自动同步
    stopAutoSync() {
        if (this.syncTimer) {
            clearInterval(this.syncTimer);
            this.syncTimer = null;
        }
    }

    // 执行自动同步
    async performAutoSync() {
        if (!this.settings.cloudSync) {
            return;
        }

        // 如果当前没有定时器（可能被删除操作暂停），则不执行同步
        if (!this.syncTimer) {
            return;
        }

        try {
            this.updateSyncIndicator('syncing');

            // 先同步到云端
            await this.syncToCloudSilent();

            // 再从云端同步
            await this.syncFromCloudSilent();

            this.updateSyncIndicator('success');
            this.lastSyncTime = new Date();
        } catch (error) {
            console.error('自动同步失败:', error);
            this.updateSyncIndicator('error', '同步失败');
        }
    }

    // 切换设置面板
    toggleSettings() {
        const settingsPanel = document.getElementById('settings-panel');
        if (settingsPanel) {
            settingsPanel.classList.toggle('open');
        }
    }

    // 聚焦搜索框
    focusSearch() {
        const searchInput = document.getElementById('search-input');
        if (searchInput) {
            searchInput.focus();
        }
    }

    // 标题变化处理
    onTitleChange() {
        if (this.settings.autoSave) {
            this.scheduleAutoSave();
        }

        // 增加实时同步调度
        if (this.settings.cloudSync) {
            this.scheduleRealTimeSync();
        }
    }

    // 内容变化处理
    onContentChange() {
        if (this.isPreviewMode) {
            this.updatePreview();
        }

        if (this.settings.autoSave) {
            this.scheduleAutoSave();
        }

        // 增加实时同步调度
        if (this.settings.cloudSync) {
            this.scheduleRealTimeSync();
        }
    }

    // 安排自动保存
    scheduleAutoSave() {
        if (this.autoSaveTimer) {
            clearTimeout(this.autoSaveTimer);
        }

        this.autoSaveTimer = setTimeout(async () => {
            await this.saveCurrentNote(false); // 不显示提示
        }, 500); // 减少到500毫秒
    }

    scheduleRealTimeSync() {
        if (this.realTimeSyncTimer) {
            clearTimeout(this.realTimeSyncTimer);
        }

        this.realTimeSyncTimer = setTimeout(async () => {
            if (this.settings.cloudSync && this.currentNote) {
                try {
                    await this.syncToCloudSilent();
                } catch (error) {
                    console.error('实时同步失败:', error);
                }
            }
        }, 1000); // 1秒防抖
    }

    // 键盘快捷键处理
    handleKeyboardShortcuts(e) {
        // Ctrl/Cmd + S: 保存
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            this.saveCurrentNote();
        }

        // Ctrl/Cmd + N: 新建笔记
        if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
            e.preventDefault();
            this.createNote();
        }

        // Ctrl/Cmd + P: 切换预览
        if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
            e.preventDefault();
            this.togglePreview();
        }

        // F11: 全屏
        if (e.key === 'F11') {
            e.preventDefault();
            this.toggleFullscreen();
        }

        // Escape: 退出全屏或关闭面板
        if (e.key === 'Escape') {
            if (this.isFullscreen) {
                this.toggleFullscreen();
            } else {
                const settingsPanel = document.getElementById('settings-panel');
                if (settingsPanel.classList.contains('open')) {
                    this.toggleSettings();
                }
            }
        }
    }

    // 窗口大小变化处理
    handleResize() {
        // 在移动设备上自动关闭侧边栏
        if (window.innerWidth <= 768) {
            const sidebar = document.getElementById('sidebar');
            sidebar.classList.remove('open');
        }
    }

    // 更改主题
    changeTheme(theme) {
        this.settings.theme = theme;
        this.saveSettings();
        this.applyTheme();
    }

    // 应用主题
    applyTheme() {
        const theme = this.settings.theme === 'auto'
            ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
            : this.settings.theme;

        document.documentElement.setAttribute('data-theme', theme);
        document.getElementById('theme-select').value = this.settings.theme;
    }

    // 更改字体大小
    changeFontSize(fontSize) {
        this.settings.fontSize = fontSize;
        this.saveSettings();
        this.applyFontSize();
    }

    // 应用字体大小
    applyFontSize() {
        document.body.className = document.body.className.replace(/font-\w+/g, '');
        document.body.classList.add(`font-${this.settings.fontSize}`);
        document.getElementById('font-size-select').value = this.settings.fontSize;
    }

    // 切换自动保存
    toggleAutoSave(enabled) {
        this.settings.autoSave = enabled;
        this.saveSettings();
        document.getElementById('auto-save-toggle').checked = enabled;
    }

    // 切换云同步
    async toggleCloudSync(enabled) {
        this.settings.cloudSync = enabled;
        document.getElementById('cloud-sync-toggle').checked = enabled;

        if (enabled) {
            this.showToast('正在启用云同步...');
            try {
                await this.syncFromCloud();
                await this.syncSettingsFromCloud();
                this.showToast('云同步已启用');
                // 启动自动同步
                this.startAutoSync();
            } catch (error) {
                this.showToast('云同步启用失败: ' + error.message, 'error');
                this.settings.cloudSync = false;
                this.saveSettings();
                document.getElementById('cloud-sync-toggle').checked = false;
                // 停止自动同步
                this.stopAutoSync();
                this.updateSyncIndicator('hidden');
            }
        } else {
            this.showToast('云同步已关闭');
            // 停止自动同步
            this.stopAutoSync();
            this.updateSyncIndicator('hidden');
        }

        // 保存设置
        try {
            await this.saveSettingsAndSync();
        } catch (error) {
            console.error('保存设置失败:', error);
        }
    }

    // 显示消息提示
    showMessage(message, type = 'info') {
        // 创建消息元素
        const messageDiv = document.createElement('div');
        messageDiv.className = `message-toast message-${type}`;
        messageDiv.textContent = message;

        // 添加到页面
        document.body.appendChild(messageDiv);

        // 显示动画
        setTimeout(() => {
            messageDiv.classList.add('show');
        }, 10);

        // 3秒后自动隐藏
        setTimeout(() => {
            messageDiv.classList.remove('show');
            setTimeout(() => {
                if (messageDiv.parentNode) {
                    messageDiv.parentNode.removeChild(messageDiv);
                }
            }, 300);
        }, 3000);
    }

    // 显示欢迎信息
    showWelcomeMessage() {
        document.getElementById('note-title').value = '欢迎使用智能笔记';
        document.getElementById('editor').value = `# 欢迎使用智能笔记应用！

这是一个功能强大的笔记应用，支持：

## 主要功能
- **Markdown 支持**: 使用 Markdown 语法编写笔记
- **实时预览**: 切换预览模式查看渲染效果
- **自动保存**: 自动保存您的编辑内容
- **搜索功能**: 快速搜索笔记内容
- **主题切换**: 支持浅色、深色主题
- **全屏编辑**: 专注写作的全屏模式

## 快捷键
- **Ctrl/Cmd + S**: 保存笔记
- **Ctrl/Cmd + N**: 新建笔记
- **Ctrl/Cmd + P**: 切换预览模式
- **F11**: 全屏模式
- **Esc**: 退出全屏或关闭面板

开始创建您的第一篇笔记吧！`;

        this.hideEmptyState();
    }

    // 隐藏空状态
    hideEmptyState() {
        const emptyState = document.querySelector('.empty-state');
        if (emptyState) {
            emptyState.style.display = 'none';
        }
    }

    // 更新笔记列表选中状态
    updateNotesListSelection(noteId) {
        document.querySelectorAll('.note-item').forEach(item => {
            item.classList.toggle('active', item.dataset.noteId === noteId);
        });
    }

    // 显示提示消息
    showToast(message, duration = 3000) {
        // 创建提示元素
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: var(--primary-color);
            color: white;
            padding: 12px 24px;
            border-radius: 8px;
            box-shadow: var(--shadow-md);
            z-index: 10000;
            animation: fadeIn 0.3s ease-in;
        `;

        document.body.appendChild(toast);

        // 自动移除
        setTimeout(() => {
            toast.style.animation = 'fadeOut 0.3s ease-out';
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }, duration);
    }

    // 生成唯一ID
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    // 格式化日期
    formatDate(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diff = now - date;

        if (diff < 60000) { // 1分钟内
            return '刚刚';
        } else if (diff < 3600000) { // 1小时内
            return `${Math.floor(diff / 60000)}分钟前`;
        } else if (diff < 86400000) { // 1天内
            return `${Math.floor(diff / 3600000)}小时前`;
        } else if (diff < 604800000) { // 1周内
            return `${Math.floor(diff / 86400000)}天前`;
        } else {
            return date.toLocaleDateString('zh-CN');
        }
    }

    // HTML 转义
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // 保存笔记到本地存储
    async saveNotes(skipCloudSync = false) {
        localStorage.setItem('notes', JSON.stringify(this.notes));

        // 如果启用了云同步且未跳过云同步，同步到云端
        if (this.settings.cloudSync && !skipCloudSync) {
            try {
                await this.syncToCloud();
            } catch (error) {
                console.error('云同步失败:', error);
                this.showToast('云同步失败: ' + error.message, 'error');
            }
        }
    }

    // 从本地存储加载笔记
    async loadNotes() {
        const saved = localStorage.getItem('notes');
        if (saved) {
            this.notes = JSON.parse(saved);
        }

        // 如果启用了云同步，从云端同步
        if (this.settings.cloudSync) {
            try {
                await this.syncFromCloud();
            } catch (error) {
                console.error('从云端同步失败:', error);
                // 不显示错误提示，避免在初始化时干扰用户
            }
        }
    }

    // 保存设置到本地存储
    saveSettings() {
        localStorage.setItem('settings', JSON.stringify(this.settings));

        // 如果启用了云同步，异步同步设置到云端（不等待）
        if (this.settings.cloudSync) {
            this.syncSettingsToCloud().catch(error => {
                console.error('同步设置到云端失败:', error);
            });
        }
    }

    // 保存设置到本地存储和云端（等待同步完成）
    async saveSettingsAndSync() {
        localStorage.setItem('settings', JSON.stringify(this.settings));

        // 如果启用了云同步，同步设置到云端
        if (this.settings.cloudSync) {
            try {
                await this.syncSettingsToCloud();
            } catch (error) {
                console.error('同步设置到云端失败:', error);
                throw error;
            }
        }
    }

    // 从本地存储和云端加载设置
    async loadSettings() {
        const saved = localStorage.getItem('settings');
        if (saved) {
            this.settings = { ...this.settings, ...JSON.parse(saved) };
        }

        // 记录原始的云同步状态
        const originalCloudSync = this.settings.cloudSync;

        // 如果启用了云同步，尝试从云端加载设置
        if (this.settings.cloudSync) {
            try {
                await this.syncSettingsFromCloud();

                // 如果从云端同步后cloudSync状态发生变化，需要相应处理
                if (originalCloudSync !== this.settings.cloudSync) {
                    if (this.settings.cloudSync) {
                        // 云同步被启用，但这里不启动自动同步，因为init方法会处理
                        console.log('云同步状态已从云端更新为启用');
                    } else {
                        // 云同步被禁用
                        this.stopAutoSync();
                        console.log('云同步状态已从云端更新为禁用');
                    }
                }
            } catch (error) {
                console.error('从云端加载设置失败:', error);
            }
        }
    }

    updateSettingsUI() {
        // 更新基本设置
        const themeSelect = document.getElementById('theme-select');
        const fontSizeSelect = document.getElementById('font-size-select');
        const autoSaveToggle = document.getElementById('auto-save-toggle');
        const cloudSyncToggle = document.getElementById('cloud-sync-toggle');
        const userIdInput = document.getElementById('user-id-input');

        if (themeSelect) themeSelect.value = this.settings.theme;
        if (fontSizeSelect) fontSizeSelect.value = this.settings.fontSize;
        if (autoSaveToggle) autoSaveToggle.checked = this.settings.autoSave;
        if (cloudSyncToggle) cloudSyncToggle.checked = this.settings.cloudSync;
        if (userIdInput) userIdInput.value = this.settings.userId || '';

        // 更新自定义样式URL
        const customStyleUrlInput = document.getElementById('custom-style-url');
        if (customStyleUrlInput) customStyleUrlInput.value = this.settings.customStyleUrl || '';

        // 更新AI设置
        this.updateAIUI();

        // 应用自定义样式
        this.applyCustomStyle();
    }

    // 云端同步方法
    async syncToCloud() {
        if (!this.settings.cloudSync) return;

        try {
            // 调试日志：检查发送的数据
            console.log('准备同步到云端的笔记数据:', this.notes.map(note => ({
                id: note.id,
                title: note.title,
                contentLength: note.content ? note.content.length : 0,
                hasContent: !!note.content
            })));

            const response = await fetch('/api/sync/notes', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    notes: this.notes,
                    userId: this.getUserId()
                })
            });

            if (!response.ok) {
                throw new Error(`同步失败: ${response.status}`);
            }

            const result = await response.json();
            console.log('同步到云端成功:', result.length, '条笔记');

            // 调试日志：检查返回的数据
            console.log('云端返回的笔记数据:', result.map(note => ({
                id: note.id,
                title: note.title,
                contentLength: note.content ? note.content.length : 0,
                hasContent: !!note.content
            })));
        } catch (error) {
            console.error('同步到云端失败:', error);
            throw error;
        }
    }

    // 静默同步到云端（不抛出错误）
    async syncToCloudSilent() {
        if (!this.settings.cloudSync) return;

        try {
            const response = await fetch('/api/sync/notes', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    notes: this.notes,
                    userId: this.getUserId()
                })
            });

            if (!response.ok) {
                throw new Error(`同步失败: ${response.status}`);
            }

            const result = await response.json();
        } catch (error) {
            // 静默处理错误，不抛出
            console.error('静默同步到云端失败:', error);
        }
    }

    async syncFromCloud() {
        if (!this.settings.cloudSync) return;

        try {
            const response = await fetch(`/api/notes?userId=${this.getUserId()}`);

            if (!response.ok) {
                throw new Error(`获取云端数据失败: ${response.status}`);
            }

            const cloudNotes = await response.json();

            // 调试日志：检查从云端获取的数据
            console.log('从云端获取的笔记数据:', cloudNotes.map(note => ({
                id: note.id,
                title: note.title,
                contentLength: note.content ? note.content.length : 0,
                hasContent: !!note.content
            })));

            // 合并本地和云端笔记
            const mergedNotes = this.mergeNotes(this.notes, cloudNotes);

            if (mergedNotes.length !== this.notes.length ||
                JSON.stringify(mergedNotes) !== JSON.stringify(this.notes)) {
                this.notes = mergedNotes;
                localStorage.setItem('notes', JSON.stringify(this.notes));
                this.renderNotesList();
                console.log('从云端同步成功:', this.notes.length, '条笔记');

                // 调试日志：检查合并后的数据
                console.log('合并后的笔记数据:', this.notes.map(note => ({
                    id: note.id,
                    title: note.title,
                    contentLength: note.content ? note.content.length : 0,
                    hasContent: !!note.content
                })));
            }
        } catch (error) {
            console.error('从云端同步失败:', error);
            throw error;
        }
    }

    // 静默从云端同步（不抛出错误）
    async syncFromCloudSilent() {
        if (!this.settings.cloudSync) return;

        try {
            const response = await fetch(`/api/notes?userId=${this.getUserId()}`);

            if (!response.ok) {
                throw new Error(`获取云端数据失败: ${response.status}`);
            }

            const cloudNotes = await response.json();

            // 合并本地和云端笔记
            const mergedNotes = this.mergeNotes(this.notes, cloudNotes);

            if (mergedNotes.length !== this.notes.length ||
                JSON.stringify(mergedNotes) !== JSON.stringify(this.notes)) {
                this.notes = mergedNotes;
                localStorage.setItem('notes', JSON.stringify(this.notes));
                this.renderNotesList();
            }
        } catch (error) {
            // 静默处理错误，不抛出
            console.error('静默从云端同步失败:', error);
        }
    }

    // 合并本地和云端笔记
    mergeNotes(localNotes, cloudNotes) {
        const notesMap = new Map();

        // 先添加本地笔记
        localNotes.forEach(note => {
            notesMap.set(note.id, note);
        });

        // 合并云端笔记（云端的更新时间更新的会覆盖本地）
        cloudNotes.forEach(cloudNote => {
            const localNote = notesMap.get(cloudNote.id);
            if (!localNote || new Date(cloudNote.updatedAt) > new Date(localNote.updatedAt)) {
                notesMap.set(cloudNote.id, cloudNote);
            }
        });

        // 转换为数组并按更新时间排序
        return Array.from(notesMap.values()).sort((a, b) =>
            new Date(b.updatedAt) - new Date(a.updatedAt)
        );
    }

    // 获取用户ID（优先使用用户设置的ID，否则使用系统生成的ID）
    getUserId() {
        // 如果用户设置了自定义ID，使用自定义ID
        if (this.settings.userId && this.settings.userId.trim()) {
            return this.settings.userId.trim();
        }

        // 否则使用系统生成的ID
        let userId = localStorage.getItem('userId');
        if (!userId) {
            userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('userId', userId);
        }
        return userId;
    }

    // 检查云端同步状态
    async checkSyncStatus() {
        if (!this.settings.cloudSync) return null;

        try {
            const response = await fetch(`/api/sync/status?userId=${this.getUserId()}`);

            if (!response.ok) {
                throw new Error(`获取同步状态失败: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('检查同步状态失败:', error);
            return null;
        }
    }

    // 同步设置到云端
    async syncSettingsToCloud() {
        if (!this.settings.cloudSync) return;

        try {
            const response = await fetch('/api/settings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    userId: this.getUserId(),
                    settings: this.settings
                })
            });

            if (!response.ok) {
                throw new Error(`同步设置失败: ${response.status}`);
            }

            console.log('设置同步到云端成功');
        } catch (error) {
            console.error('同步设置到云端失败:', error);
            throw error;
        }
    }

    // 从云端同步设置
    async syncSettingsFromCloud() {
        if (!this.settings.cloudSync) return;

        try {
            const response = await fetch(`/api/settings?userId=${this.getUserId()}`);

            if (!response.ok) {
                throw new Error(`获取云端设置失败: ${response.status}`);
            }

            const cloudSettings = await response.json();

            if (cloudSettings && cloudSettings.settings) {
                // 合并云端设置到本地设置
                const mergedSettings = { ...this.settings, ...cloudSettings.settings };

                // 检查是否有变化
                if (JSON.stringify(mergedSettings) !== JSON.stringify(this.settings)) {
                    this.settings = mergedSettings;
                    localStorage.setItem('settings', JSON.stringify(this.settings));
                    this.updateSettingsUI();
                    console.log('从云端同步设置成功');
                }
            }
        } catch (error) {
            console.error('从云端同步设置失败:', error);
            throw error;
        }
    }

    // AI 相关方法
    initAI() {
        this.aiManager = new AIManager(this.settings);
        this.updateAIUI();
    }

    updateAIUI() {
        const aiEnabled = this.settings.aiEnabled;
        const aiSettings = document.querySelectorAll('.ai-settings');

        aiSettings.forEach(setting => {
            setting.style.display = aiEnabled ? 'block' : 'none';
        });

        // 更新 AI 按钮状态
        const aiButtons = ['ai-improve-btn', 'ai-summarize-btn', 'ai-translate-btn'];
        aiButtons.forEach(btnId => {
            const btn = document.getElementById(btnId);
            if (btn) {
                btn.disabled = !aiEnabled || !this.settings.aiApiKey;
                btn.style.opacity = btn.disabled ? '0.5' : '1';
            }
        });

        // 更新设置面板的值
        document.getElementById('ai-enabled-toggle').checked = aiEnabled;
        document.getElementById('ai-provider-select').value = this.settings.aiProvider;
        document.getElementById('ai-api-key').value = this.settings.aiApiKey;

        // 先更新模型选项，再设置当前模型值
        this.updateAIModelOptions();
        document.getElementById('ai-model-select').value = this.settings.aiModel;
    }

    toggleAI(enabled) {
        this.settings.aiEnabled = enabled;
        this.saveSettings();
        this.updateAIUI();
        this.showMessage(enabled ? 'AI 功能已启用' : 'AI 功能已禁用');
    }

    changeAIProvider(provider) {
        this.settings.aiProvider = provider;
        this.saveSettings();
        this.aiManager.updateSettings(this.settings);
        this.updateAIModelOptions();
        this.showMessage(`AI 服务商已切换到 ${provider}`);
    }

    updateAIApiKey(apiKey) {
        this.settings.aiApiKey = apiKey;
        this.saveSettings();
        this.aiManager.updateSettings(this.settings);
        this.updateAIUI();
    }

    updateUserId(userId) {
        this.settings.userId = userId;
        this.saveSettings();
        this.showMessage('用户ID已更新，下次同步将使用新的ID');
    }

    changeAIModel(model) {
        this.settings.aiModel = model;
        this.saveSettings();
        this.aiManager.updateSettings(this.settings);
        this.showMessage(`AI 模型已切换到 ${model}`);
    }

    // 更新自定义样式URL
    updateCustomStyleUrl(url) {
        this.settings.customStyleUrl = url;
        this.saveSettings();
        this.applyCustomStyle();
        if (url) {
            this.showMessage('自定义样式已应用');
        } else {
            this.showMessage('自定义样式已移除');
        }
    }

    // 应用自定义样式
    applyCustomStyle() {
        // 移除之前的自定义样式
        const existingCustomStyle = document.getElementById('custom-style');
        if (existingCustomStyle) {
            existingCustomStyle.remove();
        }

        // 如果有自定义样式URL，则加载
        if (this.settings.customStyleUrl) {
            const link = document.createElement('link');
            link.id = 'custom-style';
            link.rel = 'stylesheet';
            link.href = this.settings.customStyleUrl;
            link.onerror = () => {
                this.showMessage('自定义样式加载失败，请检查URL是否正确', 'error');
            };
            document.head.appendChild(link);
        }
    }

    // 显示Markdown演示
    showMarkdownDemo() {
        const demoContent = `# Markdown 语法演示

## 基础语法

### 文本格式
**粗体文本**  
*斜体文本*  
~~删除线~~  
\`行内代码\`

### 列表
#### 无序列表
- 项目 1
- 项目 2
  - 子项目 2.1
  - 子项目 2.2

#### 有序列表
1. 第一项
2. 第二项
3. 第三项

### 链接和图片
[链接文本](https://example.com)
![图片描述](https://via.placeholder.com/150)

### 引用
> 这是一个引用块
> 可以包含多行内容

### 代码块
\`\`\`javascript
function hello() {
    console.log("Hello, World!");
}
\`\`\`

### 表格
| 列1 | 列2 | 列3 |
|-----|-----|-----|
| 内容1 | 内容2 | 内容3 |
| 内容4 | 内容5 | 内容6 |

---

## 数学公式

### 行内公式
这是一个行内公式：$E = mc^2$

### 公式块
$$
\\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}
$$

$$
\\begin{pmatrix}
a & b \\\\
c & d
\\end{pmatrix}
$$

### 更多数学示例
- 分数：$\\frac{a}{b}$
- 根号：$\\sqrt{x^2 + y^2}$
- 求和：$\\sum_{i=1}^{n} x_i$
- 积分：$\\int_0^1 f(x) dx$
- 极限：$\\lim_{x \\to \\infty} f(x)$

---

## 任务列表
- [x] 已完成的任务
- [ ] 未完成的任务
- [ ] 另一个任务

## 水平分割线

---

这就是 Markdown 的基本语法演示！`;

        // 创建新笔记并填入演示内容
        const note = {
            id: this.generateId(),
            title: 'Markdown 演示',
            content: demoContent,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            tags: []
        };

        this.notes.unshift(note);
        this.saveNotes();
        this.renderNotesList();
        this.loadNote(note.id);
        this.showMessage('Markdown 演示笔记已创建');

        // 关闭设置面板
        this.toggleSettings();
    }

    updateAIModelOptions() {
        const modelSelect = document.getElementById('ai-model-select');
        const provider = this.settings.aiProvider;

        // 清空现有选项
        modelSelect.innerHTML = '';

        // 根据服务商添加对应的模型选项
        const modelOptions = {
            openai: [
                { value: 'gpt-3.5-turbo', text: 'GPT-3.5 Turbo' },
                { value: 'gpt-4', text: 'GPT-4' },
                { value: 'gpt-4-turbo', text: 'GPT-4 Turbo' }
            ],
            anthropic: [
                { value: 'claude-3-haiku', text: 'Claude 3 Haiku' },
                { value: 'claude-3-sonnet', text: 'Claude 3 Sonnet' },
                { value: 'claude-3-opus', text: 'Claude 3 Opus' }
            ],
            gemini: [
                { value: 'gemini-pro', text: 'Gemini Pro' },
                { value: 'gemini-pro-vision', text: 'Gemini Pro Vision' }
            ],
            deepseek: [
                { value: 'deepseek-chat', text: 'DeepSeek Chat' },
                { value: 'deepseek-reasoner', text: 'DeepSeek Reasoner' }
            ]
        };

        const options = modelOptions[provider] || [];
        options.forEach(option => {
            const optionElement = document.createElement('option');
            optionElement.value = option.value;
            optionElement.textContent = option.text;
            modelSelect.appendChild(optionElement);
        });

        // 设置默认值
        if (options.length > 0) {
            this.settings.aiModel = options[0].value;
            modelSelect.value = this.settings.aiModel;
            this.saveSettings();
        }
    }

    async improveTextWithAI() {
        if (!this.checkAIAvailable()) return;

        const editor = document.getElementById('editor');
        const selectedText = this.getSelectedText(editor);
        const textToImprove = selectedText || editor.value;

        if (!textToImprove.trim()) {
            this.showMessage('请先输入或选择要改进的文本');
            return;
        }

        this.showLoading('AI 正在改进文本...');

        try {
            // 使用非流式方式，等待完整响应后再更新笔记
            const improvedText = await this.aiManager.improveText(textToImprove);

            if (selectedText) {
                this.replaceSelectedText(editor, improvedText);
            } else {
                editor.value = improvedText;
            }

            this.onContentChange();

            this.showMessage('文本改进完成');
        } catch (error) {
            this.showMessage('AI 改进失败: ' + error.message);
        } finally {
            this.hideLoading();
        }
    }

    async summarizeWithAI() {
        if (!this.checkAIAvailable()) return;

        const editor = document.getElementById('editor');
        const content = editor.value;

        if (!content.trim()) {
            this.showMessage('请先输入要总结的内容');
            return;
        }

        this.showLoading('AI 正在生成摘要...');

        try {
            // 使用非流式方式，等待完整响应后再更新笔记
            const summary = await this.aiManager.summarizeText(content);

            // 在内容开头插入摘要
            const summarySection = `## 摘要\n\n${summary}\n\n---\n\n`;
            editor.value = summarySection + content;

            this.onContentChange();

            this.showMessage('摘要生成完成');
        } catch (error) {
            this.showMessage('AI 摘要失败: ' + error.message);
        } finally {
            this.hideLoading();
        }
    }

    async translateWithAI() {
        if (!this.checkAIAvailable()) return;

        const editor = document.getElementById('editor');
        const selectedText = this.getSelectedText(editor);
        const textToTranslate = selectedText || editor.value;

        if (!textToTranslate.trim()) {
            this.showMessage('请先输入或选择要翻译的文本');
            return;
        }

        // 简单的语言检测和目标语言设置
        const targetLang = this.detectLanguageAndGetTarget(textToTranslate);

        this.showLoading('AI 正在翻译...');

        try {
            const translatedText = await this.aiManager.translateText(textToTranslate, targetLang);

            if (selectedText) {
                this.replaceSelectedText(editor, translatedText);
            } else {
                editor.value = translatedText;
            }

            this.onContentChange();
            this.showMessage('翻译完成');
        } catch (error) {
            this.showMessage('AI 翻译失败: ' + error.message);
        } finally {
            this.hideLoading();
        }
    }

    checkAIAvailable() {
        if (!this.settings.aiEnabled) {
            this.showMessage('请先在设置中启用 AI 功能');
            return false;
        }

        if (!this.settings.aiApiKey) {
            this.showMessage('请先在设置中配置 AI API 密钥');
            return false;
        }

        return true;
    }

    getSelectedText(textarea) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        return textarea.value.substring(start, end);
    }

    replaceSelectedText(textarea, newText) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const before = textarea.value.substring(0, start);
        const after = textarea.value.substring(end);
        textarea.value = before + newText + after;

        // 设置新的光标位置
        const newCursorPos = start + newText.length;
        textarea.setSelectionRange(newCursorPos, newCursorPos);
    }

    detectLanguageAndGetTarget(text) {
        // 简单的中英文检测
        const chineseRegex = /[\u4e00-\u9fff]/;
        const hasChinese = chineseRegex.test(text);

        return hasChinese ? 'English' : '中文';
    }

    showLoading(message = '加载中...') {
        const loading = document.getElementById('loading');
        const loadingText = loading.querySelector('p');
        loadingText.textContent = message;
        loading.style.display = 'flex';
    }

    hideLoading() {
        document.getElementById('loading').style.display = 'none';
    }

    // AI 聊天相关方法
    toggleAIChat() {
        const chatPanel = document.getElementById('ai-chat-panel');
        if (chatPanel) {
            chatPanel.classList.toggle('open');

            if (chatPanel.classList.contains('open')) {
                // 聚焦输入框
                setTimeout(() => {
                    const aiChatInput = document.getElementById('ai-chat-input');
                    if (aiChatInput) {
                        aiChatInput.focus();
                    }
                }, 300);
            }
        }
    }

    clearAIChat() {
        const messagesContainer = document.getElementById('ai-chat-messages');
        // 保留欢迎消息
        const welcomeMessage = messagesContainer.querySelector('.ai-message');
        messagesContainer.innerHTML = '';
        messagesContainer.appendChild(welcomeMessage);

        // 清空对话历史
        this.chatHistory = [];
        this.showMessage('对话已清空');
    }

    onAIChatInputChange(e) {
        const input = e.target;
        const sendBtn = document.getElementById('ai-chat-send');

        // 自动调整高度
        input.style.height = 'auto';
        input.style.height = Math.min(input.scrollHeight, 100) + 'px';

        // 控制发送按钮状态
        sendBtn.disabled = !input.value.trim();
    }

    onAIChatKeyDown(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            this.sendAIMessage();
        }
    }

    onSuggestionClick(suggestion) {
        const input = document.getElementById('ai-chat-input');
        input.value = suggestion;
        input.focus();
        this.onAIChatInputChange({ target: input });
    }

    async sendAIMessage() {
        if (!this.checkAIAvailable()) {
            this.toggleAIChat();
            this.toggleSettings();
            return;
        }

        const input = document.getElementById('ai-chat-input');
        const message = input.value.trim();

        if (!message) return;

        // 添加用户消息到界面
        this.addChatMessage(message, 'user');

        // 清空输入框
        input.value = '';
        input.style.height = 'auto';
        document.getElementById('ai-chat-send').disabled = true;

        // 显示 AI 正在输入
        this.showAITyping();

        try {
            // 获取当前笔记内容作为上下文
            const currentNote = this.getCurrentNoteContent();
            const contextMessage = currentNote ? `当前笔记内容：\n${currentNote}\n\n用户问题：${message}` : message;

            // 准备消息历史
            const messages = [
                {
                    role: 'system',
                    content: '你是一个智能助手，可以帮助用户解答问题、提供建议和进行对话。请友好、专业地回应用户。'
                },
                ...this.chatHistory,
                {
                    role: 'user',
                    content: contextMessage
                }
            ];

            // 移除输入指示器
            this.hideAITyping();

            // 创建AI消息容器用于流式显示
            const aiMessageElement = this.addChatMessage('', 'ai');
            const contentElement = aiMessageElement.querySelector('.message-content p');

            let fullResponse = '';

            // 使用流式响应
            await this.aiManager.makeStreamRequest(messages, (chunk) => {
                fullResponse += chunk;
                contentElement.textContent = fullResponse;
                // 滚动到底部
                const messagesContainer = document.getElementById('ai-chat-messages');
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            });

            // 更新对话历史
            this.chatHistory.push(
                { role: 'user', content: message },
                { role: 'assistant', content: fullResponse }
            );

            // 限制对话历史长度
            if (this.chatHistory.length > 20) {
                this.chatHistory = this.chatHistory.slice(-20);
            }

        } catch (error) {
            this.hideAITyping();
            this.addChatMessage(`抱歉，AI 服务出现错误：${error.message}`, 'ai');
        }
    }

    addChatMessage(content, type) {
        const messagesContainer = document.getElementById('ai-chat-messages');
        const messageDiv = document.createElement('div');
        messageDiv.className = type === 'user' ? 'user-message' : 'ai-message';

        const avatar = document.createElement('div');
        avatar.className = type === 'user' ? 'user-avatar' : 'ai-avatar';

        if (type === 'user') {
            avatar.innerHTML = `
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12,4A4,4 0 0,1 16,8A4,4 0 0,1 12,12A4,4 0 0,1 8,8A4,4 0 0,1 12,4M12,14C16.42,14 20,15.79 20,18V20H4V18C4,15.79 7.58,14 12,14Z"/>
                </svg>
            `;
        } else {
            avatar.innerHTML = `
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12,2A2,2 0 0,1 14,4C14,4.74 13.6,5.39 13,5.73V7A1,1 0 0,1 12,8A1,1 0 0,1 11,7V5.73C10.4,5.39 10,4.74 10,4A2,2 0 0,1 12,2M21,9V7H15L13.5,7.5C13.1,7.4 12.6,7.4 12.1,7.5L10.5,7H3V9H10L11.4,9.5C11.8,9.6 12.2,9.6 12.6,9.5L14,9H21M12,10.5A0.5,0.5 0 0,1 12.5,11A0.5,0.5 0 0,1 12,11.5A0.5,0.5 0 0,1 11.5,11A0.5,0.5 0 0,1 12,10.5M12,13A1.5,1.5 0 0,1 13.5,14.5A1.5,1.5 0 0,1 12,16A1.5,1.5 0 0,1 10.5,14.5A1.5,1.5 0 0,1 12,13M12,17C14.33,17 16.3,18.12 17.35,19.65C17.75,20.22 17.6,21 17,21.35C16.67,21.53 16.26,21.53 15.93,21.35C15.03,20.92 13.57,20.5 12,20.5C10.43,20.5 8.97,20.92 8.07,21.35C7.74,21.53 7.33,21.53 7,21.35C6.4,21 6.25,20.22 6.65,19.65C7.7,18.12 9.67,17 12,17Z"/>
                </svg>
            `;
        }

        const messageContent = document.createElement('div');
        messageContent.className = 'message-content';
        messageContent.innerHTML = `<p>${this.formatMessageContent(content)}</p>`;

        messageDiv.appendChild(avatar);
        messageDiv.appendChild(messageContent);

        messagesContainer.appendChild(messageDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;

        return messageDiv;
    }

    showAITyping() {
        const messagesContainer = document.getElementById('ai-chat-messages');
        const typingDiv = document.createElement('div');
        typingDiv.className = 'ai-message ai-typing-message';
        typingDiv.innerHTML = `
            <div class="ai-avatar">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12,2A2,2 0 0,1 14,4C14,4.74 13.6,5.39 13,5.73V7A1,1 0 0,1 12,8A1,1 0 0,1 11,7V5.73C10.4,5.39 10,4.74 10,4A2,2 0 0,1 12,2M21,9V7H15L13.5,7.5C13.1,7.4 12.6,7.4 12.1,7.5L10.5,7H3V9H10L11.4,9.5C11.8,9.6 12.2,9.6 12.6,9.5L14,9H21M12,10.5A0.5,0.5 0 0,1 12.5,11A0.5,0.5 0 0,1 12,11.5A0.5,0.5 0 0,1 11.5,11A0.5,0.5 0 0,1 12,10.5M12,13A1.5,1.5 0 0,1 13.5,14.5A1.5,1.5 0 0,1 12,16A1.5,1.5 0 0,1 10.5,14.5A1.5,1.5 0 0,1 12,13M12,17C14.33,17 16.3,18.12 17.35,19.65C17.75,20.22 17.6,21 17,21.35C16.67,21.53 16.26,21.53 15.93,21.35C15.03,20.92 13.57,20.5 12,20.5C10.43,20.5 8.97,20.92 8.07,21.35C7.74,21.53 7.33,21.53 7,21.35C6.4,21 6.25,20.22 6.65,19.65C7.7,18.12 9.67,17 12,17Z"/>
                </svg>
            </div>
            <div class="ai-typing">
                <span></span>
                <span></span>
                <span></span>
            </div>
        `;

        messagesContainer.appendChild(typingDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    hideAITyping() {
        const typingMessage = document.querySelector('.ai-typing-message');
        if (typingMessage) {
            typingMessage.remove();
        }
    }

    getCurrentNoteContent() {
        const title = document.getElementById('note-title').value;
        const content = document.getElementById('editor').value;

        if (!title && !content) return null;

        return `标题：${title || '无标题'}\n内容：${content || '暂无内容'}`;
    }

    formatMessageContent(content) {
        // 简单的 Markdown 格式化
        return content
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/`(.*?)`/g, '<code>$1</code>')
            .replace(/\n/g, '<br>');
    }

    // 初始化聊天历史
    initChatHistory() {
        this.chatHistory = [];
    }

    // 初始化 Markdown 工具栏
    initMarkdownToolbar() {
        const markdownBtns = document.querySelectorAll('.markdown-btn');
        markdownBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const syntax = btn.dataset.syntax;
                this.insertMarkdownSyntax(syntax);
            });
        });

        // 添加键盘快捷键
        const editor = document.getElementById('editor');
        if (editor) {
            editor.addEventListener('keydown', (e) => {
                if (e.ctrlKey || e.metaKey) {
                    switch (e.key.toLowerCase()) {
                        case 'b':
                            e.preventDefault();
                            this.insertMarkdownSyntax('bold');
                            break;
                        case 'i':
                            e.preventDefault();
                            this.insertMarkdownSyntax('italic');
                            break;
                        case 'k':
                            e.preventDefault();
                            this.insertMarkdownSyntax('link');
                            break;
                    }
                }
            });
        }
    }

    // 插入 Markdown 语法
    insertMarkdownSyntax(syntax) {
        const editor = document.getElementById('editor');
        if (!editor) return;

        const start = editor.selectionStart;
        const end = editor.selectionEnd;
        const selectedText = editor.value.substring(start, end);
        const beforeText = editor.value.substring(0, start);
        const afterText = editor.value.substring(end);

        let insertText = '';
        let cursorOffset = 0;

        switch (syntax) {
            case 'bold':
                insertText = `**${selectedText || '粗体文本'}**`;
                cursorOffset = selectedText ? 0 : -4;
                break;
            case 'italic':
                insertText = `*${selectedText || '斜体文本'}*`;
                cursorOffset = selectedText ? 0 : -2;
                break;
            case 'strikethrough':
                insertText = `~~${selectedText || '删除线文本'}~~`;
                cursorOffset = selectedText ? 0 : -4;
                break;
            case 'h1':
                insertText = this.insertHeading(beforeText, selectedText || '标题 1', 1);
                cursorOffset = selectedText ? 0 : -3;
                break;
            case 'h2':
                insertText = this.insertHeading(beforeText, selectedText || '标题 2', 2);
                cursorOffset = selectedText ? 0 : -3;
                break;
            case 'h3':
                insertText = this.insertHeading(beforeText, selectedText || '标题 3', 3);
                cursorOffset = selectedText ? 0 : -3;
                break;
            case 'quote':
                insertText = this.insertQuote(beforeText, selectedText || '引用文本');
                cursorOffset = selectedText ? 0 : -2;
                break;
            case 'code':
                insertText = `\`${selectedText || '代码'}\``;
                cursorOffset = selectedText ? 0 : -2;
                break;
            case 'codeblock':
                insertText = this.insertCodeBlock(beforeText, selectedText || '代码块');
                cursorOffset = selectedText ? 0 : -3;
                break;
            case 'ul':
                insertText = this.insertList(beforeText, selectedText || '列表项', '-');
                cursorOffset = selectedText ? 0 : -3;
                break;
            case 'ol':
                insertText = this.insertList(beforeText, selectedText || '列表项', '1.');
                cursorOffset = selectedText ? 0 : -3;
                break;
            case 'checkbox':
                insertText = this.insertCheckbox(beforeText, selectedText || '任务项');
                cursorOffset = selectedText ? 0 : -3;
                break;
            case 'link':
                const linkText = selectedText || '链接文本';
                const url = prompt('请输入链接地址:', 'https://');
                if (url !== null) {
                    insertText = `[${linkText}](${url})`;
                    cursorOffset = 0;
                } else {
                    return;
                }
                break;
            case 'image':
                const altText = selectedText || '图片描述';
                const imageUrl = prompt('请输入图片地址:', 'https://');
                if (imageUrl !== null) {
                    insertText = `![${altText}](${imageUrl})`;
                    cursorOffset = 0;
                } else {
                    return;
                }
                break;
            case 'table':
                insertText = this.insertTable(beforeText);
                cursorOffset = -15;
                break;
            case 'math-inline':
                insertText = `$${selectedText || 'x^2 + y^2 = z^2'}$`;
                cursorOffset = selectedText ? 0 : -1;
                break;
            case 'math-block':
                insertText = this.insertMathBlock(beforeText, selectedText || 'E = mc^2');
                cursorOffset = selectedText ? 0 : -3;
                break;
            default:
                return;
        }

        // 更新编辑器内容
        editor.value = beforeText + insertText + afterText;

        // 设置光标位置
        const newCursorPos = start + insertText.length + cursorOffset;
        editor.setSelectionRange(newCursorPos, newCursorPos);

        // 触发输入事件以保存内容
        editor.dispatchEvent(new Event('input'));

        // 聚焦编辑器
        editor.focus();
    }

    // 插入标题
    insertHeading(beforeText, text, level) {
        const prefix = '#'.repeat(level) + ' ';
        const needsNewline = beforeText && !beforeText.endsWith('\n');
        return (needsNewline ? '\n' : '') + prefix + text;
    }

    // 插入引用
    insertQuote(beforeText, text) {
        const needsNewline = beforeText && !beforeText.endsWith('\n');
        return (needsNewline ? '\n' : '') + '> ' + text;
    }

    // 插入代码块
    insertCodeBlock(beforeText, text) {
        const needsNewline = beforeText && !beforeText.endsWith('\n');
        return (needsNewline ? '\n' : '') + '```\n' + text + '\n```';
    }

    // 插入列表
    insertList(beforeText, text, marker) {
        const needsNewline = beforeText && !beforeText.endsWith('\n');
        return (needsNewline ? '\n' : '') + marker + ' ' + text;
    }

    // 插入复选框
    insertCheckbox(beforeText, text) {
        const needsNewline = beforeText && !beforeText.endsWith('\n');
        return (needsNewline ? '\n' : '') + '- [ ] ' + text;
    }

    // 插入表格
    insertTable(beforeText) {
        const needsNewline = beforeText && !beforeText.endsWith('\n');
        const table = `| 列1 | 列2 | 列3 |
|-----|-----|-----|
| 内容1 | 内容2 | 内容3 |`;
        return (needsNewline ? '\n' : '') + table;
    }

    // 插入数学公式块
    insertMathBlock(beforeText, formula) {
        const needsNewline = beforeText && !beforeText.endsWith('\n');
        return (needsNewline ? '\n' : '') + `$$\n${formula}\n$$`;
    }
}

// 应用初始化
document.addEventListener('DOMContentLoaded', () => {
    window.notesApp = new NotesApp();
    window.notesApp.init().catch(error => {
        console.error('应用初始化失败:', error);
    });
});

// Service Worker 注册
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => {
                console.log('SW registered: ', registration);
            })
            .catch(registrationError => {
                console.log('SW registration failed: ', registrationError);
            });
    });
}