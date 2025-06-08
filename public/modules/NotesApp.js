/**
 * 笔记应用核心类
 * 负责应用的初始化和主要功能协调
 */
class NotesApp {
    constructor() {
        this.currentNote = null;
        this.currentWorkspace = localStorage.getItem('currentWorkspace') || 'public';
        this.workspaces = JSON.parse(localStorage.getItem('workspaces') || '[]') || ['public', 'private'];
        
        // 默认设置
        const defaultSettings = {
            theme: 'light',
            fontSize: 14,
            autoSave: true,
            aiEnabled: false,
            aiApiKey: '',
            aiBaseUrl: 'https://api.deepseek.com',
            aiModel: 'deepseek-chat',
            markdownTheme: 'github',
            customThemeUrl: '',
            cloudSync: false,
            serverUrl: window.location.origin,
            userId: 'default'
        };
        
        const savedSettings = JSON.parse(localStorage.getItem('settings') || '{}') || {};
        this.settings = Object.assign({}, defaultSettings, savedSettings);
        this.autoSaveTimer = null;
        this.isPreviewMode = false;
        
        // 从localStorage恢复同步状态
        const savedSyncStatus = JSON.parse(localStorage.getItem('syncStatus') || '{}') || {};
        this.syncStatus = {
            connected: false,
            syncing: false,
            lastSync: savedSyncStatus.lastSync || null,
            error: savedSyncStatus.error || null
        };
        this.syncTimer = null;
        
        // 根据云端同步设置决定数据源
        this.initDataSource();
        
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.loadWorkspace();
        this.createDefaultTutorial();
        this.renderNotesList();
        this.applySettings();
        this.setupMarkdownRenderer();
        this.setupDrawingCanvas();
        this.initCloudSync();
        
        // Setup image toggle handlers for editor
        document.getElementById('editor').addEventListener('input', () => {
            // Image toggle handlers will be added here if needed
        });
        
        // Load first note if exists
        if (this.notes.length > 0) {
            this.loadNote(this.notes[0].id);
        }
    }
    
    async initDataSource() {
        if (this.settings.cloudSync) {
            // 开启同步：优先从云端加载数据
            this.notes = [];
            // 云端数据将在initCloudSync中加载
        } else {
            // 未开启同步：从localStorage加载数据
            this.notes = JSON.parse(localStorage.getItem('notes') || '[]') || [];
        }
    }
    
    // 生成随机用户ID
    generateRandomUserId() {
        return 'user_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now().toString(36);
    }
}

// 导出类
window.NotesApp = NotesApp;