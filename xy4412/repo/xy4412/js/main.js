const App = {
    currentId: null,
    currentData: null,
    currentRisks: [],
    isDirty: false,
    autoSaveTimer: null,
    
    init() {
        window.App = this;
        
        const sceneInit = Scene3D.init('three-canvas');
        if (!sceneInit) {
            console.error('3D场景初始化失败');
        }
        
        UI.init();
        UI.updateRehearsalList();
        
        const lastRehearsal = Storage.getLastUsedRehearsal();
        if (lastRehearsal) {
            this.loadRehearsal(lastRehearsal.id, false);
        } else {
            this.createNewRehearsal('新预演', false);
        }
        
        this.startAutoSave();
        this.setupUnloadWarning();
        
        console.log('吊点安全预演工具已初始化');
    },
    
    createNewRehearsal(name, showNotification = true) {
        if (this.isDirty && this.currentData) {
            UI.showModal(
                '保存当前预演？',
                `当前预演"${this.currentData.rehearsalName}"有未保存的更改，是否保存？`,
                () => {
                    this.saveCurrentRehearsal();
                    this.createNewRehearsalInternal(name, showNotification);
                },
                true
            );
        } else {
            this.createNewRehearsalInternal(name, showNotification);
        }
    },
    
    createNewRehearsalInternal(name, showNotification = true) {
        const { id, data } = Storage.createNewRehearsal(name);
        this.currentId = id;
        this.currentData = data;
        this.isDirty = false;
        
        this.loadIntoScene();
        this.analyzeRisks();
        
        UI.updateAll(this.currentData, this.currentRisks);
        UI.updateRehearsalList();
        
        Storage.setLastUsedRehearsal(id);
        
        if (showNotification) {
            Utils.showNotification('新预演已创建', 'success');
        }
    },
    
    loadRehearsal(id, showNotification = true) {
        if (this.isDirty && this.currentData) {
            UI.showModal(
                '保存当前预演？',
                `当前预演"${this.currentData.rehearsalName}"有未保存的更改，是否保存？`,
                () => {
                    this.saveCurrentRehearsal();
                    this.loadRehearsalInternal(id, showNotification);
                },
                true
            );
        } else {
            this.loadRehearsalInternal(id, showNotification);
        }
    },
    
    loadRehearsalInternal(id, showNotification = true) {
        const data = Storage.getRehearsal(id);
        if (!data) {
            Utils.showNotification('预演数据不存在', 'error');
            return;
        }
        
        this.currentId = id;
        this.currentData = data;
        this.isDirty = false;
        
        this.loadIntoScene();
        this.analyzeRisks();
        
        UI.updateAll(this.currentData, this.currentRisks);
        UI.updateRehearsalList();
        
        const select = document.getElementById('rehearsalList');
        if (select) {
            select.value = id;
        }
        
        Storage.setLastUsedRehearsal(id);
        
        if (showNotification) {
            Utils.showNotification('预演已加载', 'success');
        }
    },
    
    saveCurrentRehearsal() {
        if (!this.currentId || !this.currentData) {
            Utils.showNotification('没有可保存的预演', 'warning');
            return;
        }
        
        const success = Storage.saveRehearsal(this.currentId, this.currentData);
        
        if (success) {
            this.isDirty = false;
            UI.updateRehearsalList();
            Utils.showNotification('预演已保存', 'success');
        } else {
            Utils.showNotification('保存失败', 'error');
        }
    },
    
    loadIntoScene() {
        if (this.currentData) {
            Scene3D.loadData(this.currentData);
        }
    },
    
    analyzeRisks() {
        if (!this.currentData) {
            this.currentRisks = [];
            return;
        }
        
        this.currentRisks = RiskEngine.analyzeAll(this.currentData);
        
        const hoistLoads = RiskEngine.calculateHoistLoads(this.currentData);
        
        for (const hoist of this.currentData.hoists) {
            const load = hoistLoads[hoist.id] || 0;
            const ratio = hoist.ratedLoad > 0 ? load / hoist.ratedLoad : 0;
            
            let riskLevel = 'safe';
            if (ratio >= APP_CONFIG.RISK_THRESHOLDS.OVERLOAD_RATIO_CRITICAL) {
                riskLevel = 'critical';
            } else if (ratio >= APP_CONFIG.RISK_THRESHOLDS.OVERLOAD_RATIO_WARNING) {
                riskLevel = 'warning';
            }
            
            Scene3D.updateHoistStatus(hoist, riskLevel);
        }
    },
    
    markDirty() {
        this.isDirty = true;
        this.analyzeRisks();
        UI.updateAll(this.currentData, this.currentRisks);
    },
    
    importData(rawData, type) {
        if (!this.currentData) {
            this.currentData = Utils.deepClone(DEFAULT_DATA);
        }
        
        switch (type) {
            case 'truss':
                const trusses = DataImporter.parseTrussData(rawData);
                if (trusses.length > 0) {
                    this.currentData.trusses = trusses;
                }
                break;
                
            case 'equipment':
                const equipment = DataImporter.parseEquipmentData(rawData);
                if (equipment.length > 0) {
                    this.currentData.equipment = equipment;
                }
                break;
                
            case 'hoists':
                const hoists = DataImporter.parseHoistData(rawData);
                if (hoists.length > 0) {
                    this.currentData.hoists = hoists;
                }
                break;
                
            case 'loadCells':
                const loadCells = DataImporter.parseLoadCellData(rawData);
                if (loadCells.length > 0) {
                    this.currentData.loadCells = loadCells;
                }
                break;
        }
        
        this.markDirty();
        this.loadIntoScene();
    },
    
    clearData(type) {
        if (!this.currentData) return;
        
        switch (type) {
            case 'trusses':
                this.currentData.trusses = [];
                break;
            case 'equipment':
                this.currentData.equipment = [];
                break;
            case 'hoists':
                this.currentData.hoists = [];
                break;
            case 'loadCells':
                this.currentData.loadCells = [];
                break;
        }
        
        this.markDirty();
        this.loadIntoScene();
        Utils.showNotification(`已清除${this.getTypeName(type)}数据`, 'info');
    },
    
    getTypeName(type) {
        const names = {
            'trusses': '桁架',
            'equipment': '设备',
            'hoists': '葫芦',
            'loadCells': '拉力计',
        };
        return names[type] || type;
    },
    
    selectEquipment(equipmentId) {
        const eq = this.currentData.equipment.find(e => e.id === equipmentId);
        if (!eq) return;
        
        const obj = Scene3D.objects.equipment.find(o => o.userData.dataId === equipmentId);
        if (obj) {
            if (Scene3D.selectedObject) {
                Scene3D.restoreObjectMaterial(Scene3D.selectedObject);
            }
            Scene3D.selectedObject = obj;
            Scene3D.highlightObject(obj, 0x00ff00);
        }
        
        Utils.showNotification(`已选中 ${eq.name}，可使用键盘方向键调整位置`, 'info');
    },
    
    onEquipmentMoved(equipment) {
        this.markDirty();
    },
    
    onDeleteObject(dataType, dataId) {
        if (!this.currentData) return;
        
        if (dataType === 'equipment') {
            const index = this.currentData.equipment.findIndex(e => e.id === dataId);
            if (index !== -1) {
                const eq = this.currentData.equipment[index];
                this.currentData.equipment.splice(index, 1);
                Scene3D.removeEquipment(dataId);
                this.markDirty();
                Utils.showNotification(`已删除 ${eq.name}`, 'info');
            }
        }
    },
    
    onSceneObjectSelected(obj) {
        if (!obj) return;
        
        const dataType = obj.userData.dataType;
        const dataId = obj.userData.dataId;
        
        if (dataType === 'equipment') {
            const eq = this.currentData.equipment.find(e => e.id === dataId);
            if (eq) {
                Utils.showNotification(`已选中 ${eq.name}，可使用键盘方向键调整位置`, 'info');
            }
        }
    },
    
    startAutoSave() {
        this.autoSaveTimer = setInterval(() => {
            if (this.isDirty && this.currentId) {
                Storage.saveRehearsal(this.currentId, this.currentData);
                this.isDirty = false;
                console.log('自动保存已执行');
            }
        }, APP_CONFIG.AUTO_SAVE_INTERVAL);
    },
    
    stopAutoSave() {
        if (this.autoSaveTimer) {
            clearInterval(this.autoSaveTimer);
            this.autoSaveTimer = null;
        }
    },
    
    setupUnloadWarning() {
        window.addEventListener('beforeunload', (e) => {
            if (this.isDirty) {
                e.preventDefault();
                e.returnValue = '您有未保存的更改，确定要离开吗？';
                return e.returnValue;
            }
        });
    },
};

document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
