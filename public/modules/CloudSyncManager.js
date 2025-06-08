/**
 * 云同步管理模块
 * 负责云端数据同步、删除优先策略等功能
 */
class CloudSyncManager {
    constructor(app) {
        this.app = app;
    }
    
    // 初始化云端同步
    async initCloudSync() {
        if (!this.app.settings.cloudSync) {
            this.app.updateSyncIndicator('disconnected', '未启用');
            return;
        }
        
        this.app.updateSyncIndicator('syncing', '连接中...');
        
        try {
            // 测试连接
            const response = await fetch(`${this.app.settings.serverUrl}/api/health`, {
                method: 'GET',
                mode: 'cors',
                credentials: 'omit',
                headers: {
                    'Accept': 'application/json'
                }
            });
            
            if (response.ok) {
                this.app.syncStatus.connected = true;
                this.app.syncStatus.error = null;
                this.app.saveSyncStatus();
                this.app.updateSyncIndicator('connected', '已连接');
                
                // 启动定期同步
                this.startAutoSync();
                
                // 初始同步
                await this.syncFromCloud();
            } else {
                throw new Error('服务器连接失败');
            }
        } catch (error) {
            this.app.syncStatus.connected = false;
            this.app.syncStatus.error = error.message;
            this.app.saveSyncStatus();
            this.app.updateSyncIndicator('error', '连接失败');
            console.error('云端同步初始化失败:', error);
        }
    }
    
    // 更新同步指示器
    updateSyncIndicator(status, text) {
        const indicator = document.getElementById('syncIndicator');
        const icon = document.getElementById('syncIcon');
        const textElement = document.getElementById('syncText');
        
        if (!this.app.settings.cloudSync) {
            indicator.style.display = 'none';
            return;
        }
        
        indicator.style.display = 'flex';
        indicator.className = `sync-indicator ${status}`;
        textElement.textContent = text;
        
        switch (status) {
            case 'connected':
                icon.className = 'fas fa-cloud';
                break;
            case 'syncing':
                icon.className = 'fas fa-sync-alt';
                break;
            case 'error':
                icon.className = 'fas fa-exclamation-triangle';
                break;
            default:
                icon.className = 'fas fa-cloud-slash';
        }
    }
    
    // 同步到云端
    async syncToCloud() {
        if (!this.app.settings.cloudSync || !this.app.syncStatus.connected || this.app.syncStatus.syncing) {
            return;
        }
        
        this.app.syncStatus.syncing = true;
        this.app.updateSyncIndicator('syncing', '同步中...');
        
        try {
            const response = await fetch(`${this.app.settings.serverUrl}/api/sync/notes`, {
                method: 'POST',
                mode: 'cors',
                credentials: 'omit',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    notes: this.app.notes,
                    userId: this.app.settings.userId
                })
            });
            
            if (response.ok) {
                this.app.syncStatus.lastSync = new Date();
                this.app.saveSyncStatus();
                this.app.updateSyncIndicator('connected', '同步完成');
                
                // 2秒后恢复到已连接状态
                setTimeout(() => {
                    if (this.app.syncStatus.connected) {
                        this.app.updateSyncIndicator('connected', '已连接');
                    }
                }, 2000);
            } else {
                throw new Error('同步失败');
            }
        } catch (error) {
            this.app.syncStatus.error = error.message;
            this.app.saveSyncStatus();
            this.app.updateSyncIndicator('error', '同步失败');
            console.error('云端同步失败:', error);
        } finally {
            this.app.syncStatus.syncing = false;
        }
    }
    
    // 从云端同步数据（删除优先策略，修复重复问题）
    async syncFromCloud() {
        if (!this.app.settings.cloudSync) return;
        
        try {
            this.app.syncStatus.syncing = true;
            this.updateSyncIndicator('syncing', '同步中...');
            
            const response = await fetch(`${this.app.settings.serverUrl}/api/notes?userId=${this.app.settings.userId}`, {
                method: 'GET',
                mode: 'cors',
                credentials: 'omit',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                if (response.status === 404) {
                    // 用户首次使用，云端没有数据
                    console.log('云端暂无数据，保持本地数据');
                    this.app.syncStatus.connected = true;
                    this.app.syncStatus.lastSync = new Date();
                    this.app.syncStatus.error = null;
                    return;
                }
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const cloudNotes = await response.json();
            
            if (Array.isArray(cloudNotes)) {
                // 获取本地已删除的笔记ID
                const deletedNoteIds = this.getDeletedNoteIds();
                
                // 过滤掉云端中已被本地删除的笔记
                const filteredCloudNotes = cloudNotes.filter(note => !deletedNoteIds.includes(note.id));
                
                // 使用删除优先合并策略
                const mergedNotes = this.mergeNotesWithDeletePriority(this.app.notes, filteredCloudNotes);
                
                // 只有在合并后的笔记与当前笔记不同时才更新
                if (JSON.stringify(mergedNotes) !== JSON.stringify(this.app.notes)) {
                    this.app.notes = mergedNotes;
                    this.app.renderNotesList();
                    
                    // 如果当前没有选中笔记且有笔记存在，加载第一个
                    if (!this.app.currentNote && this.app.notes.length > 0) {
                        this.app.noteManager.loadNote(this.app.notes[0].id);
                    }
                    
                    console.log('云端同步完成，数据已更新');
                } else {
                    console.log('云端同步完成，数据无变化');
                }
                
                // 清理云端已删除的笔记
                if (deletedNoteIds.length > 0) {
                    await this.cleanupDeletedNotesFromCloud(deletedNoteIds);
                }
                
                // 同步设置
                await this.syncSettingsFromCloud();
            }
            
            this.app.syncStatus.connected = true;
            this.app.syncStatus.lastSync = new Date();
            this.app.syncStatus.error = null;
            
        } catch (error) {
            console.error('云端同步失败:', error);
            this.app.syncStatus.connected = false;
            this.app.syncStatus.error = error.message;
        } finally {
            this.app.syncStatus.syncing = false;
            this.app.saveSyncStatus();
            if (this.app.syncStatus.connected) {
                this.updateSyncIndicator('connected', '已连接');
            } else {
                this.updateSyncIndicator('error', '同步失败');
            }
        }
    }
    
    // 获取已删除笔记ID列表
    getDeletedNoteIds() {
        const deletedNotes = localStorage.getItem('deletedNotes');
        return deletedNotes ? JSON.parse(deletedNotes) : [];
    }
    
    // 记录删除的笔记
    recordDeletedNote(noteId) {
        const deletedNotes = this.getDeletedNoteIds();
        if (!deletedNotes.includes(noteId)) {
            deletedNotes.push(noteId);
            localStorage.setItem('deletedNotes', JSON.stringify(deletedNotes));
        }
    }
    
    // 清理云端已删除的笔记
    async cleanupDeletedNotesFromCloud(deletedNoteIds) {
        for (const noteId of deletedNoteIds) {
            try {
                await fetch(`${this.app.settings.serverUrl}/api/notes/${noteId}?userId=${this.app.settings.userId}`, {
                    method: 'DELETE',
                    mode: 'cors',
                    credentials: 'omit',
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json'
                    }
                });
                console.log(`清理云端已删除笔记: ${noteId}`);
            } catch (error) {
                console.error(`清理云端笔记失败 ${noteId}:`, error);
            }
        }
    }
    
    // 合并笔记（删除优先策略）
    mergeNotesWithDeletePriority(localNotes, cloudNotes) {
        const merged = new Map();
        const deletedNotes = this.getDeletedNoteIds();
        
        // 添加本地笔记（排除已删除的）
        localNotes.forEach(note => {
            if (!deletedNotes.includes(note.id)) {
                merged.set(note.id, note);
            }
        });
        
        // 合并云端笔记（排除已删除的，云端优先）
        cloudNotes.forEach(cloudNote => {
            if (!deletedNotes.includes(cloudNote.id)) {
                const localNote = merged.get(cloudNote.id);
                if (!localNote || new Date(cloudNote.updatedAt) > new Date(localNote.updatedAt)) {
                    merged.set(cloudNote.id, {
                        id: cloudNote.id,
                        title: cloudNote.title,
                        content: cloudNote.content,
                        workspace: cloudNote.workspace,
                        createdAt: cloudNote.createdAt,
                        updatedAt: cloudNote.updatedAt
                    });
                }
            }
        });
        
        return Array.from(merged.values()).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    }
    
    // 同步设置从云端
    async syncSettingsFromCloud() {
        try {
            const response = await fetch(`${this.app.settings.serverUrl}/api/settings?userId=${this.app.settings.userId}`, {
                method: 'GET',
                mode: 'cors',
                credentials: 'omit',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            });
            if (response.ok) {
                const data = await response.json();
                
                // 完全同步所有设置（包括主题、Markdown样式、AI功能等）
                this.app.settings = Object.assign({}, this.app.settings, data.settings);
                
                // 更新工作区
                if (data.workspaces) {
                    this.app.workspaces = data.workspaces;
                    localStorage.setItem('workspaces', JSON.stringify(this.app.workspaces));
                    this.app.loadWorkspace();
                }
                
                // 保存设置
                localStorage.setItem('settings', JSON.stringify(this.app.settings));
                this.app.applySettings();
            }
        } catch (error) {
            console.error('同步设置失败:', error);
        }
    }
    
    // 同步设置到云端
    async syncSettingsToCloud() {
        if (!this.app.settings.cloudSync || !this.app.syncStatus.connected) {
            return;
        }
        
        try {
            await fetch(`${this.app.settings.serverUrl}/api/settings`, {
                method: 'POST',
                mode: 'cors',
                credentials: 'omit',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    userId: this.app.settings.userId,
                    settings: this.app.settings,
                    workspaces: this.app.workspaces
                })
            });
        } catch (error) {
            console.error('同步设置到云端失败:', error);
        }
    }
    
    // 启动自动同步
    startAutoSync() {
        if (this.app.syncTimer) {
            clearInterval(this.app.syncTimer);
        }
        
        // 每5分钟自动同步一次
        this.app.syncTimer = setInterval(() => {
            if (this.app.settings.cloudSync && this.app.syncStatus.connected) {
                this.syncFromCloud();
            }
        }, 5 * 60 * 1000);
    }
    
    // 停止自动同步
    stopAutoSync() {
        if (this.app.syncTimer) {
            clearInterval(this.app.syncTimer);
            this.app.syncTimer = null;
        }
    }
    
    // 立即同步
    async syncNow() {
        if (!this.app.settings.cloudSync) {
            alert('请先启用云端同步功能');
            return;
        }
        
        if (!this.app.syncStatus.connected) {
            await this.initCloudSync();
        }
        
        if (this.app.syncStatus.connected) {
            await this.syncFromCloud();
            await this.syncToCloud();
        }
    }
    
    // 显示同步状态
    showSyncStatus() {
        const status = this.app.syncStatus;
        let message = `同步状态:\n`;
        message += `连接状态: ${status.connected ? '已连接' : '未连接'}\n`;
        message += `服务器地址: ${this.app.settings.serverUrl}\n`;
        message += `用户ID: ${this.app.settings.userId}\n`;
        
        if (status.lastSync) {
            message += `最后同步: ${new Date(status.lastSync).toLocaleString()}\n`;
        }
        
        if (status.error) {
            message += `错误信息: ${status.error}\n`;
        }
        
        alert(message);
    }
    
    // 切换云端同步
    async toggleCloudSync(enabled) {
        this.app.settings.cloudSync = enabled;
        
        if (enabled) {
            // 如果用户ID为默认值或为空，自动生成新的用户ID
            if (!this.app.settings.userId || this.app.settings.userId === 'default' || this.app.settings.userId.trim() === '') {
                this.app.settings.userId = this.app.generateRandomUserId();
                // 更新UI中的用户ID输入框
                const userIdInput = document.getElementById('userId');
                if (userIdInput) {
                    userIdInput.value = this.app.settings.userId;
                }
            }
            
            // 切换到云端数据源
            this.app.notes = [];
            this.app.currentNote = null;
            this.app.renderNotesList();
            document.getElementById('editor').value = '';
            document.getElementById('preview').innerHTML = '';
            
            this.initCloudSync();
        } else {
            this.stopAutoSync();
            this.app.syncStatus.connected = false;
            this.updateSyncIndicator('disconnected', '未连接');
            
            // 切换到本地数据源
            this.app.notes = JSON.parse(localStorage.getItem('notes') || '[]') || [];
            this.app.currentNote = null;
            this.app.renderNotesList();
            if (this.app.notes.length > 0) {
                this.app.noteManager.loadNote(this.app.notes[0].id);
            } else {
                document.getElementById('editor').value = '';
                document.getElementById('preview').innerHTML = '';
            }
        }
        
        this.app.saveSettings();
    }
    
    // 更新服务器URL
    updateServerUrl(url) {
        this.app.settings.serverUrl = url;
        this.app.saveSettings();
        
        if (this.app.settings.cloudSync) {
            // 重新初始化连接
            this.app.syncStatus.connected = false;
            this.initCloudSync();
        }
    }
    
    // 更新用户ID
    updateUserId(userId) {
        this.app.settings.userId = userId;
        this.app.saveSettings();
        
        if (this.app.settings.cloudSync) {
            // 重新初始化连接
            this.app.syncStatus.connected = false;
            this.initCloudSync();
        }
    }
}

// 导出类
window.CloudSyncManager = CloudSyncManager;