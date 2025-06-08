/**
 * UI管理模块
 * 负责界面渲染、事件监听、预览更新等功能
 */
class UIManager {
    constructor(app) {
        this.app = app;
    }
    
    // 设置事件监听器
    setupEventListeners() {
        // Sidebar events
        document.getElementById('newNote').addEventListener('click', () => this.app.noteManager.createNote());
        document.getElementById('importNote').addEventListener('click', () => this.app.noteManager.importNote());
        document.getElementById('settings').addEventListener('click', () => this.showSettings());
        document.getElementById('workspaceSelect').addEventListener('change', (e) => this.app.switchWorkspace(e.target.value));
        document.getElementById('newWorkspace').addEventListener('click', () => this.app.createWorkspace());
        
        // Toolbar events
        document.getElementById('saveNote').addEventListener('click', () => this.app.noteManager.saveCurrentNote());
        document.getElementById('deleteNote').addEventListener('click', () => this.app.noteManager.deleteCurrentNote());
        document.getElementById('exportPDF').addEventListener('click', () => this.app.exportToPDF());
        document.getElementById('exportHTML').addEventListener('click', () => this.app.exportToHTML());
        document.getElementById('exportImage').addEventListener('click', () => this.app.exportToImage());
        document.getElementById('exportMarkdown').addEventListener('click', () => this.app.exportToMarkdown());
        document.getElementById('togglePreview').addEventListener('click', () => this.togglePreview());
        document.getElementById('fullscreen').addEventListener('click', () => this.toggleFullscreen());
        
        // Editor events
        document.getElementById('noteTitle').addEventListener('input', () => this.app.noteManager.onContentChange());
        document.getElementById('editor').addEventListener('input', (e) => {
            this.app.noteManager.onContentChange();
        });
        document.getElementById('editor').addEventListener('keydown', (e) => {
            this.app.handleAITrigger(e);
        });
        document.getElementById('editor').addEventListener('scroll', () => this.syncScroll());
        document.getElementById('editor').addEventListener('click', (e) => this.handleEditorClick(e));
        
        // Markdown toolbar events
        document.getElementById('markdownToolbar').addEventListener('click', (e) => {
            if (e.target.closest('button')) {
                this.handleMarkdownAction(e.target.closest('button'));
            }
        });
        
        // Modal events
        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.target.closest('.modal').classList.remove('show');
            });
        });
        
        // File input events
        document.getElementById('fileInput').addEventListener('change', (e) => this.app.noteManager.handleFileImport(e));
        document.getElementById('imageInput').addEventListener('change', (e) => this.handleImageInsert(e));
        document.getElementById('fileAttachment').addEventListener('change', (e) => this.handleFileAttachment(e));
        
        // Settings events
        document.getElementById('themeSelect').addEventListener('change', (e) => this.app.changeTheme(e.target.value));
        document.getElementById('fontSizeSlider').addEventListener('input', (e) => this.app.changeFontSize(e.target.value));
        document.getElementById('autoSave').addEventListener('change', (e) => this.app.toggleAutoSave(e.target.checked));
        document.getElementById('aiEnabled').addEventListener('change', (e) => this.app.toggleAI(e.target.checked));
        document.getElementById('aiApiKey').addEventListener('input', (e) => this.app.updateAISetting('aiApiKey', e.target.value));
        document.getElementById('aiBaseUrl').addEventListener('input', (e) => this.app.updateAISetting('aiBaseUrl', e.target.value));
        document.getElementById('aiModel').addEventListener('input', (e) => this.app.updateAISetting('aiModel', e.target.value));
        
        // Markdown theme events
        document.getElementById('markdownThemeSelect').addEventListener('change', (e) => this.app.changeMarkdownTheme(e.target.value));
        document.getElementById('customThemeUrl').addEventListener('input', (e) => this.app.updateCustomThemeUrl(e.target.value));
        
        // Cloud sync events
        document.getElementById('cloudSync').addEventListener('change', (e) => this.app.cloudSyncManager.toggleCloudSync(e.target.checked));
        document.getElementById('serverUrl').addEventListener('input', (e) => this.app.cloudSyncManager.updateServerUrl(e.target.value));
        document.getElementById('userId').addEventListener('input', (e) => this.app.cloudSyncManager.updateUserId(e.target.value));
        document.getElementById('syncNow').addEventListener('click', () => this.app.cloudSyncManager.syncNow());
        document.getElementById('syncStatus').addEventListener('click', () => this.app.cloudSyncManager.showSyncStatus());
        
        // Mobile sidebar toggle
        document.getElementById('sidebarToggle').addEventListener('click', () => this.toggleSidebar());
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleKeyboardShortcuts(e));
        
        // Window events
        window.addEventListener('beforeunload', () => this.app.noteManager.saveCurrentNote());
        window.addEventListener('resize', () => this.handleResize());
        
        // Touch events for mobile
        this.setupTouchEvents();
    }
    
    // 渲染笔记列表
    renderNotesList() {
        const notesList = document.getElementById('notesList');
        const workspaceNotes = this.app.notes.filter(note => note.workspace === this.app.currentWorkspace);
        
        if (workspaceNotes.length === 0) {
            notesList.innerHTML = '<div style="text-align: center; color: #6b7280; padding: 20px;">暂无笔记</div>';
            return;
        }
        
        notesList.innerHTML = workspaceNotes.map(note => {
            const preview = note.content.substring(0, 100).replace(/\n/g, ' ');
            const date = new Date(note.updatedAt).toLocaleDateString('zh-CN');
            
            return `
                <div class="note-item" data-note-id="${note.id}" onclick="app.noteManager.loadNote('${note.id}')">
                    <div class="note-item-title">${note.title}</div>
                    <div class="note-item-preview">${preview}</div>
                    <div class="note-item-date">${date}</div>
                </div>
            `;
        }).join('');
    }
    
    // 更新活动笔记
    updateActiveNote(noteId) {
        document.querySelectorAll('.note-item').forEach(item => {
            item.classList.remove('active');
        });
        
        const activeItem = document.querySelector(`[data-note-id="${noteId}"]`);
        if (activeItem) {
            activeItem.classList.add('active');
        }
    }
    
    // 更新预览
    updatePreview() {
        const content = document.getElementById('editor').value;
        const preview = document.getElementById('preview');
        
        if (!content.trim()) {
            preview.innerHTML = '<div style="color: #6b7280; text-align: center; padding: 40px;">预览将在这里显示</div>';
            return;
        }
        
        try {
            // 在预览时展开图片数据
            const expandedContent = this.app.processContentForSave(content);
            let html = marked.parse(expandedContent);
            
            // Process math formulas
            html = this.processMathFormulas(html);
            
            // Process code blocks
            html = this.processCodeBlocks(html);
            
            preview.innerHTML = html;
            
            // Highlight code
            preview.querySelectorAll('pre code').forEach(block => {
                hljs.highlightElement(block);
            });
            
        } catch (error) {
            console.error('Markdown parsing error:', error);
            preview.innerHTML = '<div style="color: #ef4444;">预览解析错误</div>';
        }
    }
    
    // 处理数学公式
    processMathFormulas(html) {
        // Process display math ($$...$$)
        html = html.replace(/\$\$([^$]+)\$\$/g, (match, formula) => {
            try {
                return katex.renderToString(formula, { displayMode: true });
            } catch (e) {
                return `<span style="color: red;">Math Error: ${e.message}</span>`;
            }
        });
        
        // Process inline math ($...$)
        html = html.replace(/\$([^$]+)\$/g, (match, formula) => {
            try {
                return katex.renderToString(formula, { displayMode: false });
            } catch (e) {
                return `<span style="color: red;">Math Error: ${e.message}</span>`;
            }
        });
        
        return html;
    }
    
    // 处理代码块
    processCodeBlocks(html) {
        // This is handled by marked.js and highlight.js
        return html;
    }
    
    // 切换预览模式
    togglePreview() {
        this.app.isPreviewMode = !this.app.isPreviewMode;
        const editor = document.getElementById('editor');
        const preview = document.getElementById('preview');
        const toggleBtn = document.getElementById('togglePreview');
        
        if (this.app.isPreviewMode) {
            editor.style.display = 'none';
            preview.style.display = 'block';
            preview.style.width = '100%';
            toggleBtn.innerHTML = '<i class="fas fa-edit"></i> 编辑';
        } else {
            editor.style.display = 'block';
            preview.style.display = 'block';
            preview.style.width = '50%';
            toggleBtn.innerHTML = '<i class="fas fa-eye"></i> 预览';
        }
    }
    
    // 切换全屏模式
    toggleFullscreen() {
        const container = document.querySelector('.container');
        const sidebar = document.querySelector('.sidebar');
        const toolbar = document.querySelector('.toolbar');
        
        if (!document.fullscreenElement) {
            container.requestFullscreen().then(() => {
                sidebar.style.display = 'none';
                toolbar.style.display = 'none';
                container.classList.add('fullscreen-mode');
            });
        } else {
            document.exitFullscreen().then(() => {
                sidebar.style.display = 'block';
                toolbar.style.display = 'flex';
                container.classList.remove('fullscreen-mode');
            });
        }
    }
    
    // 切换侧边栏
    toggleSidebar() {
        const sidebar = document.querySelector('.sidebar');
        const main = document.querySelector('.main');
        
        sidebar.classList.toggle('collapsed');
        main.classList.toggle('expanded');
    }
    
    // 显示设置
    showSettings() {
        document.getElementById('settingsModal').classList.add('show');
    }
    
    // 同步滚动
    syncScroll() {
        const editor = document.getElementById('editor');
        const preview = document.getElementById('preview');
        
        const scrollPercentage = editor.scrollTop / (editor.scrollHeight - editor.clientHeight);
        preview.scrollTop = scrollPercentage * (preview.scrollHeight - preview.clientHeight);
    }
    
    // 处理编辑器点击
    handleEditorClick(e) {
        // 处理图片点击等事件
    }
    
    // 处理Markdown工具栏操作
    handleMarkdownAction(button) {
        const action = button.dataset.action;
        const editor = document.getElementById('editor');
        const start = editor.selectionStart;
        const end = editor.selectionEnd;
        const selectedText = editor.value.substring(start, end);
        
        let replacement = '';
        let cursorOffset = 0;
        
        switch (action) {
            case 'bold':
                replacement = `**${selectedText}**`;
                cursorOffset = selectedText ? 0 : -2;
                break;
            case 'italic':
                replacement = `*${selectedText}*`;
                cursorOffset = selectedText ? 0 : -1;
                break;
            case 'heading':
                replacement = `# ${selectedText}`;
                cursorOffset = selectedText ? 0 : 0;
                break;
            case 'link':
                replacement = `[${selectedText || '链接文本'}](url)`;
                cursorOffset = selectedText ? -4 : -9;
                break;
            case 'image':
                replacement = `![${selectedText || '图片描述'}](url)`;
                cursorOffset = selectedText ? -4 : -10;
                break;
            case 'code':
                replacement = `\`${selectedText}\``;
                cursorOffset = selectedText ? 0 : -1;
                break;
            case 'quote':
                replacement = `> ${selectedText}`;
                cursorOffset = selectedText ? 0 : 0;
                break;
            case 'list':
                replacement = `- ${selectedText}`;
                cursorOffset = selectedText ? 0 : 0;
                break;
        }
        
        editor.value = editor.value.substring(0, start) + replacement + editor.value.substring(end);
        
        const newCursorPos = start + replacement.length + cursorOffset;
        editor.setSelectionRange(newCursorPos, newCursorPos);
        editor.focus();
        
        this.app.noteManager.onContentChange();
    }
    
    // 处理图片插入
    handleImageInsert(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (event) => {
            const base64 = event.target.result;
            const editor = document.getElementById('editor');
            const cursorPos = editor.selectionStart;
            const imageMarkdown = `![图片](${base64})`;
            
            editor.value = editor.value.substring(0, cursorPos) + imageMarkdown + editor.value.substring(cursorPos);
            editor.setSelectionRange(cursorPos + imageMarkdown.length, cursorPos + imageMarkdown.length);
            
            this.app.noteManager.onContentChange();
        };
        
        reader.readAsDataURL(file);
        e.target.value = ''; // Reset file input
    }
    
    // 处理文件附件
    handleFileAttachment(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        // 这里可以实现文件上传到服务器的逻辑
        // 目前只是简单地插入文件名
        const editor = document.getElementById('editor');
        const cursorPos = editor.selectionStart;
        const fileMarkdown = `[${file.name}](附件:${file.name})`;
        
        editor.value = editor.value.substring(0, cursorPos) + fileMarkdown + editor.value.substring(cursorPos);
        editor.setSelectionRange(cursorPos + fileMarkdown.length, cursorPos + fileMarkdown.length);
        
        this.app.noteManager.onContentChange();
        e.target.value = ''; // Reset file input
    }
    
    // 处理键盘快捷键
    handleKeyboardShortcuts(e) {
        if (e.ctrlKey || e.metaKey) {
            switch (e.key) {
                case 's':
                    e.preventDefault();
                    this.app.noteManager.saveCurrentNote();
                    break;
                case 'n':
                    e.preventDefault();
                    this.app.noteManager.createNote();
                    break;
                case 'p':
                    e.preventDefault();
                    this.togglePreview();
                    break;
                case 'f':
                    e.preventDefault();
                    this.toggleFullscreen();
                    break;
            }
        }
    }
    
    // 处理窗口大小变化
    handleResize() {
        // 响应式布局调整
        const sidebar = document.querySelector('.sidebar');
        const main = document.querySelector('.main');
        
        if (window.innerWidth < 768) {
            sidebar.classList.add('mobile');
            main.classList.add('mobile');
        } else {
            sidebar.classList.remove('mobile');
            main.classList.remove('mobile');
        }
    }
    
    // 设置触摸事件（移动端）
    setupTouchEvents() {
        let startX = 0;
        let startY = 0;
        
        document.addEventListener('touchstart', (e) => {
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
        });
        
        document.addEventListener('touchend', (e) => {
            const endX = e.changedTouches[0].clientX;
            const endY = e.changedTouches[0].clientY;
            const diffX = startX - endX;
            const diffY = startY - endY;
            
            // 水平滑动切换侧边栏
            if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 50) {
                if (diffX > 0) {
                    // 向左滑动，隐藏侧边栏
                    document.querySelector('.sidebar').classList.add('collapsed');
                } else {
                    // 向右滑动，显示侧边栏
                    document.querySelector('.sidebar').classList.remove('collapsed');
                }
            }
        });
    }
}

// 导出类
window.UIManager = UIManager;