/**
 * 笔记管理模块
 * 负责笔记的创建、加载、保存、删除等操作
 */
class NoteManager {
    constructor(app) {
        this.app = app;
    }
    
    // 创建新笔记
    createNote(template = null) {
        if (template) {
            this.app.showTemplateModal();
            return;
        }
        
        const note = {
            id: Date.now().toString(),
            title: '无标题',
            content: '',
            workspace: this.app.currentWorkspace,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        this.app.notes.unshift(note);
        this.app.saveNotes();
        this.app.renderNotesList();
        this.loadNote(note.id);
        
        // Focus on title
        setTimeout(() => {
            document.getElementById('noteTitle').focus();
            document.getElementById('noteTitle').select();
        }, 100);
    }
    
    // 加载笔记
    loadNote(noteId) {
        const note = this.app.notes.find(n => n.id === noteId);
        if (!note) return;
        
        this.app.currentNote = note;
        document.getElementById('noteTitle').value = note.title;
        // 在加载到编辑器时，将完整的base64数据转换为收起格式
        const processedContent = this.app.processContentForDisplay(note.content);
        document.getElementById('editor').value = processedContent;
        
        this.app.updateActiveNote(noteId);
        this.app.updatePreview();
    }
    
    // 保存当前笔记
    saveCurrentNote() {
        if (!this.app.currentNote) return;
        
        const title = document.getElementById('noteTitle').value.trim() || '无标题';
        const content = document.getElementById('editor').value;
        
        this.app.currentNote.title = title;
        this.app.currentNote.content = this.app.processContentForSave(content);
        this.app.currentNote.updatedAt = new Date().toISOString();
        
        this.app.saveNotes();
        this.app.renderNotesList();
        this.app.updateActiveNote(this.app.currentNote.id);
    }
    
    // 删除当前笔记（改进版本，解决404错误和重复问题）
    async deleteCurrentNote() {
        if (!this.app.currentNote) {
            alert('没有选中的笔记');
            return;
        }
        
        const noteTitle = this.app.currentNote.title || '未命名笔记';
        if (!confirm(`确定要删除笔记 "${noteTitle}" 吗？`)) {
            return;
        }
        
        const noteId = this.app.currentNote.id;
        
        try {
            // 1. 先记录删除操作（删除优先策略）
            this.app.cloudSyncManager.recordDeletedNote(noteId);
            
            // 2. 执行本地删除
            const noteIndex = this.app.dataManager.notes.findIndex(note => note.id === noteId);
            if (noteIndex !== -1) {
                this.app.dataManager.notes.splice(noteIndex, 1);
                this.app.dataManager.saveNotes();
            }
            
            // 3. 尝试删除云端数据（如果启用了云同步）
            if (this.app.settings.cloudSync) {
                try {
                    const response = await fetch(`${this.app.settings.serverUrl}/api/notes/${this.app.settings.userId}/${noteId}`, {
                        method: 'DELETE',
                        headers: {
                            'Content-Type': 'application/json'
                        }
                    });
                    
                    // 只有在非404错误时才记录错误
                    if (!response.ok && response.status !== 404) {
                        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                    }
                    
                    if (response.status === 404) {
                        console.log('云端笔记不存在，删除操作完成');
                    } else {
                        console.log('云端笔记删除成功');
                    }
                } catch (error) {
                    // 网络错误或其他错误，记录但不阻止删除流程
                    console.warn('云端删除请求失败，但本地删除已完成:', error.message);
                }
            }
            
            // 4. 更新UI
            this.app.currentNote = null;
            this.app.uiManager.renderNotesList();
            
            // 5. 加载其他笔记或显示空白
            if (this.app.dataManager.notes.length > 0) {
                this.loadNote(this.app.dataManager.notes[0].id);
            } else {
                const editor = document.getElementById('editor');
                const preview = document.getElementById('preview');
                if (editor) editor.value = '';
                if (preview) preview.innerHTML = '';
            }
            
            // 6. 立即同步一次（确保删除记录同步到云端）
            if (this.app.settings.cloudSync) {
                setTimeout(() => {
                    this.app.cloudSyncManager.syncNow();
                }, 500);
            }
            
            console.log(`笔记 "${noteTitle}" 删除成功`);
            
        } catch (error) {
            console.error('删除笔记失败:', error);
            alert(`删除笔记失败: ${error.message}`);
        }
    }
    
    // 内容变化处理
    onContentChange() {
        if (this.app.settings.autoSave) {
            clearTimeout(this.app.autoSaveTimer);
            this.app.autoSaveTimer = setTimeout(() => {
                this.saveCurrentNote();
            }, 1000);
        }
        
        this.app.updatePreview();
        // 延迟设置图片切换按钮，避免频繁更新
        clearTimeout(this.app.imageToggleTimeout);
        this.app.imageToggleTimeout = setTimeout(() => {
            // 图片切换逻辑
        }, 500);
    }
    
    // 导入笔记
    importNote() {
        document.getElementById('fileInput').click();
    }
    
    // 处理文件导入
    handleFileImport(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (event) => {
            const content = event.target.result;
            const fileName = file.name.replace(/\.[^/.]+$/, ""); // Remove extension
            
            const note = {
                id: Date.now().toString(),
                title: fileName,
                content: content,
                workspace: this.app.currentWorkspace,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            
            this.app.notes.unshift(note);
            this.app.saveNotes();
            this.app.renderNotesList();
            this.loadNote(note.id);
        };
        
        reader.readAsText(file);
        e.target.value = ''; // Reset file input
    }
}

// 导出类
window.NoteManager = NoteManager;