/**
 * 模态框 UI
 * 管理所有模态框的显示和交互
 */

class ModalUI {
    constructor(uiManager) {
        this.uiManager = uiManager;
        this.warehouse = uiManager.warehouse;
    }
    
    showAddObjectModal() {
        const modal = document.getElementById('addObjectModal');
        if (!modal) return;
        
        this.resetAddObjectForm();
        modal.classList.add('show');
        
        this.setupAddObjectModalListeners();
    }
    
    hideAddObjectModal() {
        const modal = document.getElementById('addObjectModal');
        if (modal) {
            modal.classList.remove('show');
        }
    }
    
    resetAddObjectForm() {
        const typeSelect = document.getElementById('objectTypeSelect');
        const nameInput = document.getElementById('objectNameInput');
        const lengthInput = document.getElementById('objectLengthInput');
        const widthInput = document.getElementById('objectWidthInput');
        const heightInput = document.getElementById('objectHeightInput');
        const xInput = document.getElementById('objectXInput');
        const zInput = document.getElementById('objectZInput');
        const rotationInput = document.getElementById('objectRotationInput');
        const colorInput = document.getElementById('objectColorInput');
        const colorText = document.getElementById('objectColorText');
        const shelfSlotsGroup = document.getElementById('shelfSlotsGroup');
        const shelfSlotsText = document.getElementById('shelfSlotsText');
        
        if (typeSelect) typeSelect.value = 'shelf';
        if (nameInput) nameInput.value = '';
        if (lengthInput) lengthInput.value = '2';
        if (widthInput) widthInput.value = '1';
        if (heightInput) heightInput.value = '2.5';
        if (xInput) xInput.value = '0';
        if (zInput) zInput.value = '0';
        if (rotationInput) rotationInput.value = '0';
        if (colorInput) colorInput.value = '#3b82f6';
        if (colorText) colorText.value = '#3b82f6';
        if (shelfSlotsGroup) shelfSlotsGroup.style.display = 'block';
        if (shelfSlotsText) shelfSlotsText.value = '[]';
    }
    
    setupAddObjectModalListeners() {
        const typeSelect = document.getElementById('objectTypeSelect');
        const colorInput = document.getElementById('objectColorInput');
        const colorText = document.getElementById('objectColorText');
        const shelfSlotsGroup = document.getElementById('shelfSlotsGroup');
        
        if (typeSelect) {
            typeSelect.addEventListener('change', () => {
                const type = typeSelect.value;
                const colors = {
                    'shelf': '#3b82f6',
                    'zone': '#10b981',
                    'entrance': '#f59e0b',
                    'forbidden': '#ef4444'
                };
                
                if (colorInput) colorInput.value = colors[type] || '#3b82f6';
                if (colorText) colorText.value = colors[type] || '#3b82f6';
                
                if (shelfSlotsGroup) {
                    shelfSlotsGroup.style.display = type === 'shelf' ? 'block' : 'none';
                }
            });
        }
        
        if (colorInput && colorText) {
            colorInput.addEventListener('input', () => {
                colorText.value = colorInput.value;
            });
            colorText.addEventListener('input', () => {
                if (/^#[0-9A-Fa-f]{6}$/.test(colorText.value)) {
                    colorInput.value = colorText.value;
                }
            });
        }
        
        document.getElementById('closeAddObject')?.addEventListener('click', () => {
            this.hideAddObjectModal();
        });
        
        document.getElementById('cancelAddObject')?.addEventListener('click', () => {
            this.hideAddObjectModal();
        });
        
        document.getElementById('confirmAddObject')?.addEventListener('click', () => {
            this.confirmAddObject();
        });
    }
    
    confirmAddObject() {
        const typeSelect = document.getElementById('objectTypeSelect');
        const nameInput = document.getElementById('objectNameInput');
        const lengthInput = document.getElementById('objectLengthInput');
        const widthInput = document.getElementById('objectWidthInput');
        const heightInput = document.getElementById('objectHeightInput');
        const xInput = document.getElementById('objectXInput');
        const zInput = document.getElementById('objectZInput');
        const rotationInput = document.getElementById('objectRotationInput');
        const colorText = document.getElementById('objectColorText');
        const shelfSlotsText = document.getElementById('shelfSlotsText');
        
        const type = typeSelect?.value || 'shelf';
        const name = nameInput?.value?.trim() || this.getDefaultName(type);
        const length = parseFloat(lengthInput?.value || '2');
        const width = parseFloat(widthInput?.value || '1');
        const height = parseFloat(heightInput?.value || '2.5');
        const x = parseFloat(xInput?.value || '0');
        const z = parseFloat(zInput?.value || '0');
        const rotation = parseFloat(rotationInput?.value || '0');
        const color = Utils.hexToColor(colorText?.value || '#3b82f6');
        
        let slots = [];
        if (type === 'shelf' && shelfSlotsText?.value) {
            try {
                slots = JSON.parse(shelfSlotsText.value);
            } catch (e) {
                console.warn('Invalid slots JSON:', e);
            }
        }
        
        const objData = {
            type: type,
            name: name,
            x: x,
            z: z,
            rotation: rotation,
            length: length,
            width: width,
            height: height,
            color: color
        };
        
        if (type === 'shelf') {
            objData.slots = slots;
        }
        
        if (type === 'entrance') {
            objData.isDefaultStart = this.warehouse.getEntrances().length === 0;
            objData.isDefaultEnd = this.warehouse.getEntrances().length === 0;
        }
        
        const obj = this.warehouse.addObject(objData);
        this.uiManager.sceneManager.renderObject(obj);
        
        this.hideAddObjectModal();
        this.uiManager.showNotification(`已添加对象: ${obj.name}`);
    }
    
    getDefaultName(type) {
        const count = this.warehouse.getObjectsByType(type).length + 1;
        const typeNames = {
            'shelf': '货架',
            'zone': '货区',
            'entrance': '出入口',
            'forbidden': '禁放区'
        };
        return `${typeNames[type] || '对象'} ${count}`;
    }
    
    showImportPickingModal() {
        const modal = document.getElementById('importPickingModal');
        if (!modal) return;
        
        this.resetImportPickingForm();
        modal.classList.add('show');
        
        this.setupImportPickingModalListeners();
    }
    
    hideImportPickingModal() {
        const modal = document.getElementById('importPickingModal');
        if (modal) {
            modal.classList.remove('show');
        }
    }
    
    resetImportPickingForm() {
        const formatSelect = document.getElementById('pickingFormatSelect');
        const dataText = document.getElementById('pickingDataText');
        const errorPanel = document.getElementById('pickingErrors');
        
        if (formatSelect) formatSelect.value = 'json';
        if (dataText) dataText.value = '';
        if (errorPanel) errorPanel.classList.add('hidden');
    }
    
    setupImportPickingModalListeners() {
        const fileDropArea = document.getElementById('fileDropArea');
        const fileInput = document.getElementById('fileInput');
        const formatSelect = document.getElementById('pickingFormatSelect');
        
        if (fileDropArea && fileInput) {
            fileDropArea.addEventListener('click', () => {
                fileInput.click();
            });
            
            fileDropArea.addEventListener('dragover', (e) => {
                e.preventDefault();
                fileDropArea.classList.add('drag-over');
            });
            
            fileDropArea.addEventListener('dragleave', () => {
                fileDropArea.classList.remove('drag-over');
            });
            
            fileDropArea.addEventListener('drop', (e) => {
                e.preventDefault();
                fileDropArea.classList.remove('drag-over');
                this.handleFileDrop(e.dataTransfer.files);
            });
            
            fileInput.addEventListener('change', (e) => {
                this.handleFileDrop(e.target.files);
            });
        }
        
        if (formatSelect) {
            formatSelect.addEventListener('change', () => {
                const dataText = document.getElementById('pickingDataText');
                if (dataText) {
                    if (formatSelect.value === 'json') {
                        dataText.placeholder = '[{"orderNo": "ORD001", "sku": "SKU001", "quantity": 10, "shelfSlot": "A-01-A1"}, ...]';
                    } else {
                        dataText.placeholder = 'orderNo,sku,quantity,shelfSlot\nORD001,SKU001,10,A-01-A1';
                    }
                }
            });
        }
        
        document.getElementById('closeImportPicking')?.addEventListener('click', () => {
            this.hideImportPickingModal();
        });
        
        document.getElementById('cancelImportPicking')?.addEventListener('click', () => {
            this.hideImportPickingModal();
        });
        
        document.getElementById('confirmImportPicking')?.addEventListener('click', () => {
            this.confirmImportPicking();
        });
    }
    
    handleFileDrop(files) {
        if (!files || files.length === 0) return;
        
        const file = files[0];
        const reader = new FileReader();
        
        reader.onload = (e) => {
            const content = e.target.result;
            const dataText = document.getElementById('pickingDataText');
            const formatSelect = document.getElementById('pickingFormatSelect');
            
            if (dataText) {
                dataText.value = content;
            }
            
            if (formatSelect) {
                if (file.name.toLowerCase().endsWith('.csv')) {
                    formatSelect.value = 'csv';
                } else {
                    formatSelect.value = 'json';
                }
            }
        };
        
        reader.readAsText(file);
    }
    
    confirmImportPicking() {
        const formatSelect = document.getElementById('pickingFormatSelect');
        const dataText = document.getElementById('pickingDataText');
        
        const format = formatSelect?.value || 'json';
        const data = dataText?.value?.trim();
        
        if (!data) {
            this.uiManager.showNotification('请输入或选择数据文件', 'error');
            return;
        }
        
        try {
            const pickingOrder = this.uiManager.pickingUI.importPickingData(data, format);
            this.hideImportPickingModal();
            this.uiManager.showNotification(`成功导入 ${pickingOrder.items.length} 条拣货记录`);
        } catch (e) {
            this.uiManager.showNotification(e.message, 'error');
        }
    }
    
    showReportModal() {
        const modal = document.getElementById('reportModal');
        if (!modal) return;
        
        this.generateReportPreview();
        modal.classList.add('show');
        
        this.setupReportModalListeners();
    }
    
    hideReportModal() {
        const modal = document.getElementById('reportModal');
        if (modal) {
            modal.classList.remove('show');
        }
    }
    
    generateReportPreview() {
        const formatSelect = document.getElementById('reportFormatSelect');
        const previewText = document.getElementById('reportPreview');
        
        const format = formatSelect?.value || 'markdown';
        
        const reportData = {
            warehouse: this.warehouse,
            pickingOrder: this.uiManager.app.pickingOrder,
            currentRoute: this.uiManager.app.currentRoute,
            conflicts: this.warehouse.conflicts
        };
        
        let content;
        if (format === 'html') {
            content = ReportGenerator.generateHTML(reportData);
        } else {
            content = ReportGenerator.generateMarkdown(reportData);
        }
        
        if (previewText) {
            previewText.value = content;
        }
    }
    
    setupReportModalListeners() {
        const formatSelect = document.getElementById('reportFormatSelect');
        
        if (formatSelect) {
            formatSelect.addEventListener('change', () => {
                this.generateReportPreview();
            });
        }
        
        document.getElementById('closeReport')?.addEventListener('click', () => {
            this.hideReportModal();
        });
        
        document.getElementById('cancelReport')?.addEventListener('click', () => {
            this.hideReportModal();
        });
        
        document.getElementById('exportReport')?.addEventListener('click', () => {
            this.exportReport();
        });
    }
    
    exportReport() {
        const formatSelect = document.getElementById('reportFormatSelect');
        const previewText = document.getElementById('reportPreview');
        
        const format = formatSelect?.value || 'markdown';
        const content = previewText?.value || '';
        
        if (!content) {
            this.uiManager.showNotification('报告内容为空', 'error');
            return;
        }
        
        const blob = new Blob([content], { 
            type: format === 'html' ? 'text/html;charset=utf-8' : 'text/markdown;charset=utf-8' 
        });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `warehouse_report_${Date.now()}.${format === 'html' ? 'html' : 'md'}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.hideReportModal();
        this.uiManager.showNotification('报告已导出');
    }
    
    showImportProjectModal() {
        const modal = document.getElementById('importProjectModal');
        if (!modal) return;
        
        this.resetImportProjectForm();
        modal.classList.add('show');
        
        this.setupImportProjectModalListeners();
    }
    
    hideImportProjectModal() {
        const modal = document.getElementById('importProjectModal');
        if (modal) {
            modal.classList.remove('show');
        }
    }
    
    resetImportProjectForm() {
        const jsonText = document.getElementById('projectJsonText');
        if (jsonText) {
            jsonText.value = '';
        }
    }
    
    setupImportProjectModalListeners() {
        const fileDropArea = document.getElementById('projectFileDropArea');
        const fileInput = document.getElementById('projectFileInput');
        
        if (fileDropArea && fileInput) {
            fileDropArea.addEventListener('click', () => {
                fileInput.click();
            });
            
            fileDropArea.addEventListener('dragover', (e) => {
                e.preventDefault();
                fileDropArea.classList.add('drag-over');
            });
            
            fileDropArea.addEventListener('dragleave', () => {
                fileDropArea.classList.remove('drag-over');
            });
            
            fileDropArea.addEventListener('drop', (e) => {
                e.preventDefault();
                fileDropArea.classList.remove('drag-over');
                this.handleProjectFileDrop(e.dataTransfer.files);
            });
            
            fileInput.addEventListener('change', (e) => {
                this.handleProjectFileDrop(e.target.files);
            });
        }
        
        document.getElementById('closeImportProject')?.addEventListener('click', () => {
            this.hideImportProjectModal();
        });
        
        document.getElementById('cancelImportProject')?.addEventListener('click', () => {
            this.hideImportProjectModal();
        });
        
        document.getElementById('confirmImportProject')?.addEventListener('click', () => {
            this.confirmImportProject();
        });
    }
    
    handleProjectFileDrop(files) {
        if (!files || files.length === 0) return;
        
        const file = files[0];
        const reader = new FileReader();
        
        reader.onload = (e) => {
            const content = e.target.result;
            const jsonText = document.getElementById('projectJsonText');
            
            if (jsonText) {
                jsonText.value = content;
            }
        };
        
        reader.readAsText(file);
    }
    
    confirmImportProject() {
        const jsonText = document.getElementById('projectJsonText');
        const data = jsonText?.value?.trim();
        
        if (!data) {
            this.uiManager.showNotification('请输入或选择项目文件', 'error');
            return;
        }
        
        try {
            const projectData = JSON.parse(data);
            this.uiManager.loadProject(projectData);
            this.hideImportProjectModal();
        } catch (e) {
            this.uiManager.showNotification(`解析项目失败: ${e.message}`, 'error');
        }
    }
}
