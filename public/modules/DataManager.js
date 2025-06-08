/**
 * 数据管理模块
 * 负责数据持久化、本地存储等功能
 */
class DataManager {
    constructor(app) {
        this.app = app;
    }
    
    // 初始化数据源（修复重复问题）
    initDataSource() {
        if (this.app.settings.cloudSync) {
            // 开启云端同步时，先从本地加载，然后等待云端同步
            this.loadNotes();
            console.log('云端同步已开启，本地数据已加载，等待云端同步...');
        } else {
            // 未开启云端同步时，从localStorage加载
            this.loadNotes();
        }
    }

    // 保存笔记数据
    saveNotes() {
        if (this.app.settings.cloudSync && this.app.syncStatus.connected) {
            // 开启同步：只保存到云端
            this.app.cloudSyncManager.syncToCloud();
        } else {
            // 未开启同步：只保存到localStorage
            localStorage.setItem('notes', JSON.stringify(this.app.notes));
        }
    }
    
    // 保存工作区数据
    saveWorkspaces() {
        localStorage.setItem('workspaces', JSON.stringify(this.app.workspaces));
    }
    
    // 保存设置
    saveSettings() {
        localStorage.setItem('settings', JSON.stringify(this.app.settings));
        
        // 如果开启云端同步，同时同步设置到云端
        if (this.app.settings.cloudSync && this.app.syncStatus.connected) {
            this.app.cloudSyncManager.syncSettingsToCloud();
        }
    }
    
    // 保存同步状态
    saveSyncStatus() {
        // 只保存需要持久化的状态信息
        const statusToSave = {
            lastSync: this.app.syncStatus.lastSync,
            error: this.app.syncStatus.error
        };
        localStorage.setItem('syncStatus', JSON.stringify(statusToSave));
    }
    
    // 加载工作区
    loadWorkspace() {
        const workspaceSelect = document.getElementById('workspaceSelect');
        workspaceSelect.innerHTML = '';
        
        this.app.workspaces.forEach(workspace => {
            const option = document.createElement('option');
            option.value = workspace;
            option.textContent = workspace;
            if (workspace === this.app.currentWorkspace) {
                option.selected = true;
            }
            workspaceSelect.appendChild(option);
        });
    }
    
    // 切换工作区
    switchWorkspace(workspace) {
        this.app.currentWorkspace = workspace;
        localStorage.setItem('currentWorkspace', workspace);
        this.app.renderNotesList();
        
        // Clear current note if it doesn't belong to new workspace
        if (this.app.currentNote && this.app.currentNote.workspace !== workspace) {
            this.app.currentNote = null;
            document.getElementById('noteTitle').value = '';
            document.getElementById('editor').value = '';
            this.app.updatePreview();
        }
        
        // Load first note in new workspace
        const workspaceNotes = this.app.notes.filter(note => note.workspace === workspace);
        if (workspaceNotes.length > 0 && !this.app.currentNote) {
            this.app.noteManager.loadNote(workspaceNotes[0].id);
        }
    }
    
    // 创建新工作区
    createWorkspace() {
        const name = prompt('请输入工作区名称:');
        if (name && name.trim() && !this.app.workspaces.includes(name.trim())) {
            this.app.workspaces.push(name.trim());
            this.saveWorkspaces();
            this.loadWorkspace();
        }
    }
    
    // 创建默认教程
    createDefaultTutorial() {
        if (this.app.notes.length === 0 && !this.app.settings.cloudSync) {
            const tutorialNote = {
                id: Date.now().toString(),
                title: '欢迎使用笔记应用',
                content: `# 欢迎使用笔记应用

这是一个功能强大的Markdown笔记应用，支持以下特性：

## 基本功能
- **Markdown编辑**：支持完整的Markdown语法
- **实时预览**：编辑时实时查看渲染效果
- **多工作区**：可以创建不同的工作区来组织笔记
- **自动保存**：编辑内容会自动保存

## 高级功能
- **数学公式**：支持LaTeX数学公式渲染
- **代码高亮**：支持多种编程语言的语法高亮
- **图片插入**：可以插入本地图片
- **导出功能**：支持导出为PDF、HTML等格式

## 云端同步
- **多设备同步**：可以在多个设备间同步笔记
- **删除优先**：删除操作优先级最高，确保数据一致性
- **自动备份**：定期自动同步到云端

## 快捷键
- **Ctrl+S**：保存笔记
- **Ctrl+N**：创建新笔记
- **Ctrl+P**：切换预览模式
- **Ctrl+F**：全屏模式

开始使用吧！`,
                workspace: this.app.currentWorkspace,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            
            this.app.notes.push(tutorialNote);
            this.saveNotes();
        }
    }
    
    // 处理内容显示（收起base64图片）
    processContentForDisplay(content) {
        return content.replace(/!\[([^\]]*)\]\(data:image\/[^;]+;base64,([A-Za-z0-9+\/=]{100,})\)/g, 
            (match, alt, base64) => {
                const preview = base64.substring(0, 50);
                return `![${alt}](data:image/*;base64,${preview}...)`;
            }
        );
    }
    
    // 处理内容保存（展开base64图片）
    processContentForSave(content) {
        // 这里可以添加展开收起的base64图片的逻辑
        // 目前直接返回原内容
        return content;
    }
    
    // 清理已删除笔记记录
    cleanupDeletedNotesRecord() {
        const deletedNotes = this.app.cloudSyncManager.getDeletedNoteIds();
        const existingNoteIds = this.app.notes.map(note => note.id);
        
        // 移除已经不存在的笔记ID
        const cleanedDeletedNotes = deletedNotes.filter(id => 
            !existingNoteIds.includes(id)
        );
        
        localStorage.setItem('deletedNotes', JSON.stringify(cleanedDeletedNotes));
    }
    
    // 清空已删除笔记记录
    clearDeletedNotesRecord() {
        localStorage.removeItem('deletedNotes');
    }
    
    // 导出数据
    exportData() {
        const data = {
            notes: this.app.notes,
            workspaces: this.app.workspaces,
            settings: this.app.settings,
            currentWorkspace: this.app.currentWorkspace,
            exportTime: new Date().toISOString()
        };
        
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `notes-backup-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }
    
    // 导入数据
    importData(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                
                if (data.notes && Array.isArray(data.notes)) {
                    // 合并笔记数据
                    const existingIds = new Set(this.app.notes.map(note => note.id));
                    const newNotes = data.notes.filter(note => !existingIds.has(note.id));
                    
                    this.app.notes = [...this.app.notes, ...newNotes];
                    this.saveNotes();
                }
                
                if (data.workspaces && Array.isArray(data.workspaces)) {
                    // 合并工作区数据
                    const newWorkspaces = data.workspaces.filter(ws => !this.app.workspaces.includes(ws));
                    this.app.workspaces = [...this.app.workspaces, ...newWorkspaces];
                    this.saveWorkspaces();
                    this.loadWorkspace();
                }
                
                if (data.settings && typeof data.settings === 'object') {
                    // 选择性合并设置（保留当前的云同步设置）
                    const currentCloudSettings = {
                        cloudSync: this.app.settings.cloudSync,
                        serverUrl: this.app.settings.serverUrl,
                        userId: this.app.settings.userId
                    };
                    
                    this.app.settings = Object.assign({}, data.settings, currentCloudSettings);
                    this.saveSettings();
                    this.app.applySettings();
                }
                
                this.app.renderNotesList();
                alert('数据导入成功！');
                
            } catch (error) {
                console.error('导入数据失败:', error);
                alert('导入数据失败，请检查文件格式！');
            }
        };
        
        reader.readAsText(file);
    }
    
    // 获取存储使用情况
    getStorageUsage() {
        let totalSize = 0;
        
        for (let key in localStorage) {
            if (localStorage.hasOwnProperty(key)) {
                totalSize += localStorage[key].length;
            }
        }
        
        return {
            totalSize: totalSize,
            formattedSize: this.formatBytes(totalSize),
            notesCount: this.app.notes.length,
            workspacesCount: this.app.workspaces.length
        };
    }
    
    // 格式化字节数
    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}

// 导出类
window.DataManager = DataManager;