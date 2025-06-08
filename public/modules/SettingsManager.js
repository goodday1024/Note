/**
 * 设置管理模块
 * 负责应用设置、主题、AI功能等配置管理
 */
class SettingsManager {
    constructor(app) {
        this.app = app;
    }
    
    // 应用设置
    applySettings() {
        this.changeTheme(this.app.settings.theme);
        this.changeFontSize(this.app.settings.fontSize);
        this.updateAutoSave(this.app.settings.autoSave);
        this.updateAISettings();
        this.changeMarkdownTheme(this.app.settings.markdownTheme);
        this.updateCustomThemeUrl(this.app.settings.customThemeUrl);
        this.updateCloudSyncUI();
    }
    
    // 更改主题
    changeTheme(theme) {
        this.app.settings.theme = theme;
        document.body.className = `theme-${theme}`;
        
        // Update theme select
        const themeSelect = document.getElementById('themeSelect');
        if (themeSelect) {
            themeSelect.value = theme;
        }
        
        this.app.dataManager.saveSettings();
    }
    
    // 更改字体大小
    changeFontSize(size) {
        this.app.settings.fontSize = size;
        const editor = document.getElementById('editor');
        const preview = document.getElementById('preview');
        
        if (editor) {
            editor.style.fontSize = `${size}px`;
        }
        if (preview) {
            preview.style.fontSize = `${size}px`;
        }
        
        // Update slider
        const fontSizeSlider = document.getElementById('fontSizeSlider');
        const fontSizeValue = document.getElementById('fontSizeValue');
        if (fontSizeSlider) {
            fontSizeSlider.value = size;
        }
        if (fontSizeValue) {
            fontSizeValue.textContent = `${size}px`;
        }
        
        this.app.dataManager.saveSettings();
    }
    
    // 切换自动保存
    toggleAutoSave(enabled) {
        this.app.settings.autoSave = enabled;
        this.updateAutoSave(enabled);
        this.app.dataManager.saveSettings();
    }
    
    // 更新自动保存状态
    updateAutoSave(enabled) {
        const autoSaveCheckbox = document.getElementById('autoSave');
        if (autoSaveCheckbox) {
            autoSaveCheckbox.checked = enabled;
        }
        
        if (!enabled && this.app.autoSaveTimer) {
            clearTimeout(this.app.autoSaveTimer);
            this.app.autoSaveTimer = null;
        }
    }
    
    // 切换AI功能
    toggleAI(enabled) {
        this.app.settings.aiEnabled = enabled;
        this.updateAISettings();
        this.app.dataManager.saveSettings();
    }
    
    // 更新AI设置
    updateAISettings() {
        const aiEnabled = document.getElementById('aiEnabled');
        const aiApiKey = document.getElementById('aiApiKey');
        const aiBaseUrl = document.getElementById('aiBaseUrl');
        const aiModel = document.getElementById('aiModel');
        const aiSettings = document.querySelector('.ai-settings');
        
        if (aiEnabled) {
            aiEnabled.checked = this.app.settings.aiEnabled;
        }
        
        if (aiSettings) {
            aiSettings.style.display = this.app.settings.aiEnabled ? 'block' : 'none';
        }
        
        if (aiApiKey) {
            aiApiKey.value = this.app.settings.aiApiKey;
        }
        
        if (aiBaseUrl) {
            aiBaseUrl.value = this.app.settings.aiBaseUrl;
        }
        
        if (aiModel) {
            aiModel.value = this.app.settings.aiModel;
        }
    }
    
    // 更新AI设置项
    updateAISetting(key, value) {
        this.app.settings[key] = value;
        this.app.dataManager.saveSettings();
    }
    
    // 更改Markdown主题
    changeMarkdownTheme(theme) {
        this.app.settings.markdownTheme = theme;
        
        // Remove existing theme stylesheets
        const existingThemes = document.querySelectorAll('link[data-markdown-theme]');
        existingThemes.forEach(link => link.remove());
        
        // Add new theme stylesheet
        if (theme !== 'default') {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.setAttribute('data-markdown-theme', theme);
            
            if (theme === 'custom' && this.app.settings.customThemeUrl) {
                link.href = this.app.settings.customThemeUrl;
            } else {
                link.href = `https://cdnjs.cloudflare.com/ajax/libs/github-markdown-css/5.2.0/github-markdown-${theme}.min.css`;
            }
            
            document.head.appendChild(link);
        }
        
        // Update select
        const markdownThemeSelect = document.getElementById('markdownThemeSelect');
        if (markdownThemeSelect) {
            markdownThemeSelect.value = theme;
        }
        
        // Show/hide custom theme URL input
        const customThemeContainer = document.querySelector('.custom-theme-container');
        if (customThemeContainer) {
            customThemeContainer.style.display = theme === 'custom' ? 'block' : 'none';
        }
        
        this.app.dataManager.saveSettings();
        this.app.uiManager.updatePreview();
    }
    
    // 更新自定义主题URL
    updateCustomThemeUrl(url) {
        this.app.settings.customThemeUrl = url;
        
        const customThemeUrl = document.getElementById('customThemeUrl');
        if (customThemeUrl) {
            customThemeUrl.value = url;
        }
        
        // If custom theme is selected, reload it
        if (this.app.settings.markdownTheme === 'custom') {
            this.changeMarkdownTheme('custom');
        }
        
        this.app.dataManager.saveSettings();
    }
    
    // 更新云同步UI
    updateCloudSyncUI() {
        const cloudSync = document.getElementById('cloudSync');
        const serverUrl = document.getElementById('serverUrl');
        const userId = document.getElementById('userId');
        const cloudSettings = document.querySelector('.cloud-settings');
        
        if (cloudSync) {
            cloudSync.checked = this.app.settings.cloudSync;
        }
        
        if (cloudSettings) {
            cloudSettings.style.display = this.app.settings.cloudSync ? 'block' : 'none';
        }
        
        if (serverUrl) {
            serverUrl.value = this.app.settings.serverUrl;
        }
        
        if (userId) {
            userId.value = this.app.settings.userId;
        }
    }
    
    // 重置设置
    resetSettings() {
        if (confirm('确定要重置所有设置吗？这将清除所有自定义配置。')) {
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
            
            this.app.settings = defaultSettings;
            this.app.dataManager.saveSettings();
            this.applySettings();
            
            alert('设置已重置为默认值');
        }
    }
    
    // 导出设置
    exportSettings() {
        const settings = {
            settings: this.app.settings,
            workspaces: this.app.workspaces,
            currentWorkspace: this.app.currentWorkspace,
            exportTime: new Date().toISOString()
        };
        
        const blob = new Blob([JSON.stringify(settings, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `settings-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }
    
    // 导入设置
    importSettings(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                
                if (data.settings && typeof data.settings === 'object') {
                    // 保留当前的云同步连接状态
                    const currentSyncStatus = {
                        cloudSync: this.app.settings.cloudSync,
                        serverUrl: this.app.settings.serverUrl,
                        userId: this.app.settings.userId
                    };
                    
                    this.app.settings = Object.assign({}, data.settings, currentSyncStatus);
                    this.app.dataManager.saveSettings();
                    this.applySettings();
                }
                
                if (data.workspaces && Array.isArray(data.workspaces)) {
                    this.app.workspaces = data.workspaces;
                    this.app.dataManager.saveWorkspaces();
                    this.app.dataManager.loadWorkspace();
                }
                
                if (data.currentWorkspace && this.app.workspaces.includes(data.currentWorkspace)) {
                    this.app.dataManager.switchWorkspace(data.currentWorkspace);
                }
                
                alert('设置导入成功！');
                
            } catch (error) {
                console.error('导入设置失败:', error);
                alert('导入设置失败，请检查文件格式！');
            }
        };
        
        reader.readAsText(file);
    }
    
    // 获取设置摘要
    getSettingsSummary() {
        return {
            theme: this.app.settings.theme,
            fontSize: this.app.settings.fontSize,
            autoSave: this.app.settings.autoSave,
            aiEnabled: this.app.settings.aiEnabled,
            markdownTheme: this.app.settings.markdownTheme,
            cloudSync: this.app.settings.cloudSync,
            workspacesCount: this.app.workspaces.length,
            currentWorkspace: this.app.currentWorkspace
        };
    }
    
    // 验证设置
    validateSettings() {
        const issues = [];
        
        if (this.app.settings.fontSize < 10 || this.app.settings.fontSize > 24) {
            issues.push('字体大小超出合理范围 (10-24px)');
        }
        
        if (this.app.settings.aiEnabled && !this.app.settings.aiApiKey) {
            issues.push('AI功能已启用但未设置API密钥');
        }
        
        if (this.app.settings.cloudSync && !this.app.settings.userId) {
            issues.push('云同步已启用但未设置用户ID');
        }
        
        if (this.app.settings.markdownTheme === 'custom' && !this.app.settings.customThemeUrl) {
            issues.push('选择了自定义Markdown主题但未设置URL');
        }
        
        return issues;
    }
}

// 导出类
window.SettingsManager = SettingsManager;