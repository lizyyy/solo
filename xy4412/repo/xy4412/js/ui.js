const UI = {
    currentFilter: 'all',
    
    init() {
        this.bindFileInputs();
        this.bindButtons();
        this.bindRiskFilters();
        this.bindReviewControls();
        this.bindRehearsalControls();
        this.bindSceneControls();
        this.bindEquipmentDrag();
    },
    
    bindFileInputs() {
        const fileTruss = document.getElementById('fileTruss');
        const fileEquipment = document.getElementById('fileEquipment');
        const fileHoists = document.getElementById('fileHoists');
        const fileLoadCells = document.getElementById('fileLoadCells');
        
        if (fileTruss) {
            fileTruss.addEventListener('change', async (e) => {
                await this.handleFileImport(e, 'truss');
            });
        }
        
        if (fileEquipment) {
            fileEquipment.addEventListener('change', async (e) => {
                await this.handleFileImport(e, 'equipment');
            });
        }
        
        if (fileHoists) {
            fileHoists.addEventListener('change', async (e) => {
                await this.handleFileImport(e, 'hoists');
            });
        }
        
        if (fileLoadCells) {
            fileLoadCells.addEventListener('change', async (e) => {
                await this.handleFileImport(e, 'loadCells');
            });
        }
        
        const btnClearTruss = document.getElementById('btnClearTruss');
        const btnClearEquipment = document.getElementById('btnClearEquipment');
        const btnClearHoists = document.getElementById('btnClearHoists');
        const btnClearLoadCells = document.getElementById('btnClearLoadCells');
        
        if (btnClearTruss) {
            btnClearTruss.addEventListener('click', () => {
                if (window.App) {
                    window.App.clearData('trusses');
                }
            });
        }
        
        if (btnClearEquipment) {
            btnClearEquipment.addEventListener('click', () => {
                if (window.App) {
                    window.App.clearData('equipment');
                }
            });
        }
        
        if (btnClearHoists) {
            btnClearHoists.addEventListener('click', () => {
                if (window.App) {
                    window.App.clearData('hoists');
                }
            });
        }
        
        if (btnClearLoadCells) {
            btnClearLoadCells.addEventListener('click', () => {
                if (window.App) {
                    window.App.clearData('loadCells');
                }
            });
        }
    },
    
    async handleFileImport(e, type) {
        const file = e.target.files[0];
        if (!file) return;
        
        try {
            const rawData = await DataImporter.parseFile(file);
            
            if (window.App) {
                window.App.importData(rawData, type);
            }
            
            Utils.showNotification(`成功导入 ${file.name}`, 'success');
        } catch (error) {
            console.error('导入文件失败:', error);
            Utils.showNotification(`导入失败: ${error.message}`, 'error');
        }
        
        e.target.value = '';
    },
    
    bindButtons() {
        const btnNewRehearsal = document.getElementById('btnNewRehearsal');
        const btnSaveRehearsal = document.getElementById('btnSaveRehearsal');
        const btnLoadRehearsal = document.getElementById('btnLoadRehearsal');
        
        if (btnNewRehearsal) {
            btnNewRehearsal.addEventListener('click', () => {
                this.showNewRehearsalModal();
            });
        }
        
        if (btnSaveRehearsal) {
            btnSaveRehearsal.addEventListener('click', () => {
                if (window.App) {
                    window.App.saveCurrentRehearsal();
                }
            });
        }
        
        if (btnLoadRehearsal) {
            btnLoadRehearsal.addEventListener('click', () => {
                const rehearsalList = document.getElementById('rehearsalList');
                if (rehearsalList && rehearsalList.value) {
                    if (window.App) {
                        window.App.loadRehearsal(rehearsalList.value);
                    }
                } else {
                    Utils.showNotification('请先选择一个预演', 'warning');
                }
            });
        }
        
        const btnExportMarkdown = document.getElementById('btnExportMarkdown');
        const btnExportJSON = document.getElementById('btnExportJSON');
        const btnExportAll = document.getElementById('btnExportAll');
        
        if (btnExportMarkdown) {
            btnExportMarkdown.addEventListener('click', () => {
                if (window.App && window.App.currentData && window.App.currentRisks) {
                    Exporter.downloadMarkdown(window.App.currentData, window.App.currentRisks);
                    Utils.showNotification('Markdown 报告已导出', 'success');
                }
            });
        }
        
        if (btnExportJSON) {
            btnExportJSON.addEventListener('click', () => {
                if (window.App && window.App.currentData && window.App.currentRisks) {
                    Exporter.downloadJSON(window.App.currentData, window.App.currentRisks);
                    Utils.showNotification('JSON 审计包已导出', 'success');
                }
            });
        }
        
        if (btnExportAll) {
            btnExportAll.addEventListener('click', () => {
                if (window.App && window.App.currentData && window.App.currentRisks) {
                    Exporter.downloadAll(window.App.currentData, window.App.currentRisks);
                    Utils.showNotification('完整报告已导出', 'success');
                }
            });
        }
    },
    
    bindRiskFilters() {
        const filterBtns = document.querySelectorAll('.filter-btn');
        
        filterBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                filterBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                this.currentFilter = btn.dataset.filter;
                
                if (window.App && window.App.currentRisks) {
                    this.updateRiskList(window.App.currentRisks);
                }
            });
        });
    },
    
    bindReviewControls() {
        const reviewTextarea = document.getElementById('reviewTextarea');
        const reviewStatus = document.getElementById('reviewStatus');
        
        if (reviewTextarea) {
            reviewTextarea.addEventListener('input', Utils.debounce(() => {
                if (window.App && window.App.currentData) {
                    window.App.currentData.reviewNotes = reviewTextarea.value;
                    window.App.markDirty();
                }
            }, 500));
        }
        
        if (reviewStatus) {
            reviewStatus.addEventListener('change', () => {
                if (window.App && window.App.currentData) {
                    window.App.currentData.reviewStatus = reviewStatus.value;
                    window.App.markDirty();
                }
            });
        }
    },
    
    bindRehearsalControls() {
        const rehearsalList = document.getElementById('rehearsalList');
        
        if (rehearsalList) {
            rehearsalList.addEventListener('change', () => {
            });
        }
    },
    
    bindSceneControls() {
        const btnTopView = document.getElementById('btnTopView');
        const btnFrontView = document.getElementById('btnFrontView');
        const btnSideView = document.getElementById('btnSideView');
        const btnResetView = document.getElementById('btnResetView');
        const btnToggleGrid = document.getElementById('btnToggleGrid');
        
        if (btnTopView) {
            btnTopView.addEventListener('click', () => {
                Scene3D.setView('top');
            });
        }
        
        if (btnFrontView) {
            btnFrontView.addEventListener('click', () => {
                Scene3D.setView('front');
            });
        }
        
        if (btnSideView) {
            btnSideView.addEventListener('click', () => {
                Scene3D.setView('side');
            });
        }
        
        if (btnResetView) {
            btnResetView.addEventListener('click', () => {
                Scene3D.setView('reset');
            });
        }
        
        if (btnToggleGrid) {
            btnToggleGrid.addEventListener('click', () => {
                Scene3D.toggleGrid();
            });
        }
    },
    
    bindEquipmentDrag() {
    },
    
    showNewRehearsalModal() {
        this.showModal(
            '新建预演',
            `
                <div style="margin-bottom: 16px;">
                    <label style="display: block; margin-bottom: 8px; font-weight: 500;">预演名称</label>
                    <input type="text" id="newRehearsalName" 
                           placeholder="输入预演名称..." 
                           style="width: 100%; padding: 10px; border: 1px solid #e5e7eb; border-radius: 4px; font-size: 14px;">
                </div>
                <div style="color: #6b7280; font-size: 12px;">
                    提示: 新预演将包含默认的基础桁架和葫芦配置。
                </div>
            `,
            () => {
                const nameInput = document.getElementById('newRehearsalName');
                const name = nameInput ? nameInput.value.trim() : '';
                if (window.App) {
                    window.App.createNewRehearsal(name || '新预演');
                }
            },
            true
        );
        
        setTimeout(() => {
            const nameInput = document.getElementById('newRehearsalName');
            if (nameInput) {
                nameInput.focus();
            }
        }, 100);
    },
    
    showModal(title, content, onConfirm, showCancel = true) {
        const overlay = document.getElementById('modal-overlay');
        const modalTitle = document.getElementById('modal-title');
        const modalContent = document.getElementById('modal-content');
        const cancelBtn = document.getElementById('modal-cancel');
        const confirmBtn = document.getElementById('modal-confirm');
        
        if (modalTitle) modalTitle.textContent = title;
        if (modalContent) modalContent.innerHTML = content;
        
        if (cancelBtn) {
            cancelBtn.style.display = showCancel ? 'inline-flex' : 'none';
        }
        
        if (overlay) {
            overlay.classList.remove('hidden');
        }
        
        this.currentModalCallback = onConfirm;
    },
    
    hideModal() {
        const overlay = document.getElementById('modal-overlay');
        if (overlay) {
            overlay.classList.add('hidden');
        }
        this.currentModalCallback = null;
    },
    
    updateDataSummary(data) {
        if (!data) return;
        
        const countTruss = document.getElementById('countTruss');
        const countEquipment = document.getElementById('countEquipment');
        const countHoists = document.getElementById('countHoists');
        const countLoadCells = document.getElementById('countLoadCells');
        
        if (countTruss) {
            const totalPoints = data.trusses.reduce((sum, t) => sum + (t.points ? t.points.length : 0), 0);
            countTruss.textContent = totalPoints;
        }
        
        if (countEquipment) {
            countEquipment.textContent = data.equipment.length;
        }
        
        if (countHoists) {
            countHoists.textContent = data.hoists.length;
        }
        
        if (countLoadCells) {
            countLoadCells.textContent = data.loadCells.length;
        }
    },
    
    updateEquipmentList(data) {
        const container = document.getElementById('equipment-items');
        if (!container) return;
        
        container.innerHTML = '';
        
        if (!data || !data.equipment || data.equipment.length === 0) {
            container.innerHTML = '<div style="padding: 20px; text-align: center; color: #6b7280; font-size: 13px;">暂无设备数据</div>';
            return;
        }
        
        data.equipment.forEach(eq => {
            const item = document.createElement('div');
            item.className = 'equipment-item';
            item.draggable = true;
            item.dataset.equipmentId = eq.id;
            
            const statusClass = eq.mountedOn ? 'placed' : 'unplaced';
            const typeLabel = this.getEquipmentTypeLabel(eq.type);
            
            item.innerHTML = `
                <div class="equipment-info">
                    <div class="equipment-name">${eq.name}</div>
                    <div class="equipment-weight">${typeLabel} · ${eq.weight}kg</div>
                </div>
                <div class="equipment-status ${statusClass}"></div>
            `;
            
            item.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', JSON.stringify({
                    type: 'equipment',
                    id: eq.id,
                }));
                item.classList.add('dragging');
            });
            
            item.addEventListener('dragend', () => {
                item.classList.remove('dragging');
            });
            
            item.addEventListener('dblclick', () => {
                if (window.App) {
                    window.App.selectEquipment(eq.id);
                }
            });
            
            container.appendChild(item);
        });
    },
    
    updateHoistList(data) {
        const container = document.getElementById('hoist-items');
        if (!container) return;
        
        container.innerHTML = '';
        
        if (!data || !data.hoists || data.hoists.length === 0) {
            container.innerHTML = '<div style="padding: 20px; text-align: center; color: #6b7280; font-size: 13px;">暂无葫芦数据</div>';
            return;
        }
        
        const hoistLoads = RiskEngine.calculateHoistLoads(data);
        
        data.hoists.forEach(hoist => {
            const load = hoistLoads[hoist.id] || 0;
            const ratio = hoist.ratedLoad > 0 ? (load / hoist.ratedLoad * 100).toFixed(1) : '0';
            const safetyRope = hoist.hasSafetyRope ? '有安全绳' : '无安全绳';
            
            let loadStatus = 'safe';
            if (ratio > 110) loadStatus = 'critical';
            else if (ratio > 90) loadStatus = 'warning';
            
            const item = document.createElement('div');
            item.className = `hoist-item hoist-${loadStatus}`;
            
            item.innerHTML = `
                <div class="hoist-name">${hoist.name}</div>
                <div class="hoist-details">
                    <span>额定: ${hoist.ratedLoad}kg</span>
                    <span>当前: ${load.toFixed(1)}kg</span>
                    <span>${safetyRope}</span>
                </div>
            `;
            
            container.appendChild(item);
        });
    },
    
    updateRiskList(risks) {
        const container = document.getElementById('risk-list');
        if (!container) return;
        
        const filteredRisks = RiskEngine.filterRisksByType(risks, this.currentFilter);
        
        container.innerHTML = '';
        
        if (filteredRisks.length === 0) {
            container.innerHTML = '<div style="padding: 20px; text-align: center; color: #6b7280; font-size: 13px;">暂无风险</div>';
            return;
        }
        
        filteredRisks.forEach(risk => {
            const item = document.createElement('div');
            item.className = `risk-item ${risk.level}`;
            
            item.innerHTML = `
                <div class="risk-title">${risk.title}</div>
                <div class="risk-description">${risk.description}</div>
                <div class="risk-suggestion">💡 ${risk.suggestion}</div>
            `;
            
            item.addEventListener('click', () => {
                this.highlightRiskObject(risk);
            });
            
            container.appendChild(item);
        });
    },
    
    updateRiskStats(risks) {
        const stats = RiskEngine.getRiskStats(risks);
        
        const criticalCount = document.getElementById('criticalCount');
        const warningCount = document.getElementById('warningCount');
        const infoCount = document.getElementById('infoCount');
        
        if (criticalCount) criticalCount.textContent = stats.critical;
        if (warningCount) warningCount.textContent = stats.warning;
        if (infoCount) infoCount.textContent = stats.info;
    },
    
    updateRehearsalList() {
        const select = document.getElementById('rehearsalList');
        if (!select) return;
        
        const rehearsals = Storage.getRehearsalList();
        
        select.innerHTML = '<option value="">选择预演...</option>';
        
        rehearsals.forEach(rehearsal => {
            const option = document.createElement('option');
            option.value = rehearsal.id;
            option.textContent = `${rehearsal.name} (${Utils.formatDate(rehearsal.updatedAt)})`;
            select.appendChild(option);
        });
    },
    
    updateReviewControls(data) {
        if (!data) return;
        
        const reviewTextarea = document.getElementById('reviewTextarea');
        const reviewStatus = document.getElementById('reviewStatus');
        
        if (reviewTextarea) {
            reviewTextarea.value = data.reviewNotes || '';
        }
        
        if (reviewStatus) {
            reviewStatus.value = data.reviewStatus || 'pending';
        }
    },
    
    highlightRiskObject(risk) {
        if (!risk.affectedObject) return;
        
        const affected = risk.affectedObject;
        
        if (affected.type === 'hoist') {
            const hoistObj = Scene3D.objects.hoists.find(o => o.userData.dataId === affected.id);
            if (hoistObj) {
                Scene3D.highlightObject(hoistObj, 0xff0000);
                setTimeout(() => {
                    Scene3D.restoreObjectMaterial(hoistObj);
                }, 2000);
            }
        } else if (affected.type === 'equipment') {
            const eqObj = Scene3D.objects.equipment.find(o => o.userData.dataId === affected.id);
            if (eqObj) {
                Scene3D.highlightObject(eqObj, 0xff0000);
                setTimeout(() => {
                    Scene3D.restoreObjectMaterial(eqObj);
                }, 2000);
            }
        } else if (affected.type === 'multiple' && affected.items) {
            affected.items.forEach(item => {
                if (item.type === 'hoist') {
                    const hoistObj = Scene3D.objects.hoists.find(o => o.userData.dataId === item.id);
                    if (hoistObj) {
                        Scene3D.highlightObject(hoistObj, 0xff0000);
                    }
                } else if (item.type === 'equipment') {
                    const eqObj = Scene3D.objects.equipment.find(o => o.userData.dataId === item.id);
                    if (eqObj) {
                        Scene3D.highlightObject(eqObj, 0xff0000);
                    }
                }
            });
            
            setTimeout(() => {
                affected.items.forEach(item => {
                    if (item.type === 'hoist') {
                        const hoistObj = Scene3D.objects.hoists.find(o => o.userData.dataId === item.id);
                        if (hoistObj) {
                            Scene3D.restoreObjectMaterial(hoistObj);
                        }
                    } else if (item.type === 'equipment') {
                        const eqObj = Scene3D.objects.equipment.find(o => o.userData.dataId === item.id);
                        if (eqObj) {
                            Scene3D.restoreObjectMaterial(eqObj);
                        }
                    }
                });
            }, 2000);
        }
    },
    
    getEquipmentTypeLabel(type) {
        const labels = {
            'fixture': '灯具',
            'speaker': '音箱',
            'other': '其他',
        };
        return labels[type] || type;
    },
    
    updateAll(data, risks) {
        this.updateDataSummary(data);
        this.updateEquipmentList(data);
        this.updateHoistList(data);
        this.updateRiskList(risks);
        this.updateRiskStats(risks);
        this.updateReviewControls(data);
    },
};

document.addEventListener('DOMContentLoaded', () => {
    const modalOverlay = document.getElementById('modal-overlay');
    const modalClose = document.getElementById('modal-close');
    const modalCancel = document.getElementById('modal-cancel');
    const modalConfirm = document.getElementById('modal-confirm');
    
    if (modalOverlay) {
        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) {
                UI.hideModal();
            }
        });
    }
    
    if (modalClose) {
        modalClose.addEventListener('click', () => {
            UI.hideModal();
        });
    }
    
    if (modalCancel) {
        modalCancel.addEventListener('click', () => {
            UI.hideModal();
        });
    }
    
    if (modalConfirm) {
        modalConfirm.addEventListener('click', () => {
            if (UI.currentModalCallback) {
                UI.currentModalCallback();
            }
            UI.hideModal();
        });
    }
});
