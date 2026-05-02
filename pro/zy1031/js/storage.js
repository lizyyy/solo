/**
 * 存储模块
 * 负责复盘备注的持久化存储
 */

const Storage = {
    // 备注数据
    notesData: {},
    
    /**
     * 初始化存储模块
     */
    init() {
        this.loadNotes();
        this.bindEvents();
    },
    
    /**
     * 绑定事件
     */
    bindEvents() {
        // 保存备注按钮
        const saveNotesBtn = document.getElementById('saveNotesBtn');
        if (saveNotesBtn) {
            saveNotesBtn.addEventListener('click', () => {
                this.saveNotes();
            });
        }
        
        // 清空备注按钮
        const clearNotesBtn = document.getElementById('clearNotesBtn');
        if (clearNotesBtn) {
            clearNotesBtn.addEventListener('click', () => {
                this.clearNotes();
            });
        }
        
        // 选择训练数据时加载备注
        const notesDataSelect = document.getElementById('notesDataSelect');
        if (notesDataSelect) {
            notesDataSelect.addEventListener('change', () => {
                const dataId = notesDataSelect.value;
                if (dataId) {
                    this.loadNotesForData(dataId);
                }
            });
        }
    },
    
    /**
     * 从本地存储加载备注
     */
    loadNotes() {
        const savedNotes = localStorage.getItem(CONFIG.storage.notes);
        if (savedNotes) {
            try {
                this.notesData = JSON.parse(savedNotes);
            } catch (e) {
                console.error('解析备注数据失败:', e);
                this.notesData = {};
            }
        }
    },
    
    /**
     * 保存备注到本地存储
     */
    saveNotesToStorage() {
        localStorage.setItem(CONFIG.storage.notes, JSON.stringify(this.notesData));
    },
    
    /**
     * 保存当前备注
     */
    saveNotes() {
        const notesDataSelect = document.getElementById('notesDataSelect');
        const dataId = notesDataSelect?.value;
        
        if (!dataId) {
            Utils.showToast('请先选择训练数据', 'warning');
            return;
        }
        
        // 获取表单数据
        const notes = {
            dataId: dataId,
            date: document.getElementById('notesDate')?.value || '',
            topic: document.getElementById('notesTopic')?.value || '',
            rating: document.getElementById('notesRating')?.value || '',
            problems: document.getElementById('notesProblems')?.value || '',
            progress: document.getElementById('notesProgress')?.value || '',
            nextSteps: document.getElementById('notesNextSteps')?.value || '',
            other: document.getElementById('notesOther')?.value || '',
            updatedAt: new Date().toISOString()
        };
        
        // 验证必填项
        if (!notes.date) {
            Utils.showToast('请填写训练日期', 'warning');
            return;
        }
        
        // 保存到数据结构
        this.notesData[dataId] = notes;
        this.saveNotesToStorage();
        
        Utils.showToast('备注保存成功！', 'success');
    },
    
    /**
     * 加载指定训练数据的备注
     * @param {string} dataId 训练数据ID
     */
    loadNotesForData(dataId) {
        const notes = this.notesData[dataId];
        
        // 如果有保存的备注，加载到表单
        if (notes) {
            if (document.getElementById('notesDate')) {
                document.getElementById('notesDate').value = notes.date || '';
            }
            if (document.getElementById('notesTopic')) {
                document.getElementById('notesTopic').value = notes.topic || '';
            }
            if (document.getElementById('notesRating')) {
                document.getElementById('notesRating').value = notes.rating || '';
            }
            if (document.getElementById('notesProblems')) {
                document.getElementById('notesProblems').value = notes.problems || '';
            }
            if (document.getElementById('notesProgress')) {
                document.getElementById('notesProgress').value = notes.progress || '';
            }
            if (document.getElementById('notesNextSteps')) {
                document.getElementById('notesNextSteps').value = notes.nextSteps || '';
            }
            if (document.getElementById('notesOther')) {
                document.getElementById('notesOther').value = notes.other || '';
            }
        } else {
            // 如果没有保存的备注，预填充一些信息
            const trainingData = DataManager.getTrainingData(dataId);
            if (trainingData) {
                if (document.getElementById('notesDate')) {
                    document.getElementById('notesDate').value = trainingData.trainingDate || '';
                }
                if (document.getElementById('notesTopic')) {
                    document.getElementById('notesTopic').value = trainingData.name || '';
                }
            }
            
            // 清空其他字段
            this.clearFormFields();
        }
    },
    
    /**
     * 清空表单字段
     */
    clearFormFields() {
        const fields = [
            'notesRating',
            'notesProblems',
            'notesProgress',
            'notesNextSteps',
            'notesOther'
        ];
        
        for (const fieldId of fields) {
            const field = document.getElementById(fieldId);
            if (field) {
                field.value = '';
            }
        }
    },
    
    /**
     * 清空当前备注
     */
    clearNotes() {
        const confirmed = confirm('确定要清空当前备注吗？');
        if (!confirmed) return;
        
        this.clearFormFields();
        Utils.showToast('备注已清空', 'info');
    },
    
    /**
     * 获取指定训练数据的备注
     * @param {string} dataId 训练数据ID
     * @returns {Object|null} 备注对象
     */
    getNotes(dataId) {
        return this.notesData[dataId] || null;
    },
    
    /**
     * 检查是否有备注
     * @param {string} dataId 训练数据ID
     * @returns {boolean} 是否有备注
     */
    hasNotes(dataId) {
        return !!this.notesData[dataId];
    },
    
    /**
     * 删除指定训练数据的备注
     * @param {string} dataId 训练数据ID
     */
    deleteNotes(dataId) {
        if (this.notesData[dataId]) {
            delete this.notesData[dataId];
            this.saveNotesToStorage();
        }
    },
    
    /**
     * 获取所有备注摘要
     * @returns {Array} 备注摘要列表
     */
    getAllNotesSummaries() {
        return Object.entries(this.notesData).map(([dataId, notes]) => ({
            dataId,
            date: notes.date,
            topic: notes.topic,
            rating: notes.rating,
            updatedAt: notes.updatedAt
        }));
    }
};
