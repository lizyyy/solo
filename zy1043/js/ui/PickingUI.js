/**
 * 拣货单 UI
 * 管理拣货单的导入、路线生成和显示
 */

class PickingUI {
    constructor(uiManager) {
        this.uiManager = uiManager;
        this.warehouse = uiManager.warehouse;
        this.pickingOrder = null;
        this.optimizedRoute = null;
        this.manualRoute = null;
        
        this.init();
    }
    
    init() {
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        document.getElementById('btnImportPicking')?.addEventListener('click', () => {
            this.uiManager.modalUI.showImportPickingModal();
        });
        
        document.getElementById('btnGenerateRoute')?.addEventListener('click', () => {
            this.generateRoute();
        });
        
        document.getElementById('btnClearPicking')?.addEventListener('click', () => {
            this.clearPicking();
        });
    }
    
    updatePickingDisplay(pickingOrder) {
        this.pickingOrder = pickingOrder;
        this.updateRouteInfo();
        this.updateRouteList();
    }
    
    updateRouteDisplay(route) {
        if (route && route.isManual) {
            this.manualRoute = route;
        } else {
            this.optimizedRoute = route;
        }
        this.updateRouteInfo();
    }
    
    updateRouteInfo() {
        const optimizedDistanceEl = document.getElementById('optimizedDistance');
        const manualDistanceEl = document.getElementById('manualDistance');
        const differenceEl = document.getElementById('routeDifference');
        
        if (this.optimizedRoute && optimizedDistanceEl) {
            optimizedDistanceEl.textContent = `${this.optimizedRoute.distance.toFixed(1)} m`;
        } else if (optimizedDistanceEl) {
            optimizedDistanceEl.textContent = '--';
        }
        
        if (this.manualRoute && manualDistanceEl) {
            manualDistanceEl.textContent = `${this.manualRoute.distance.toFixed(1)} m`;
        } else if (manualDistanceEl) {
            manualDistanceEl.textContent = '--';
        }
        
        if (this.optimizedRoute && this.manualRoute && differenceEl) {
            const diff = this.manualRoute.distance - this.optimizedRoute.distance;
            const percent = this.optimizedRoute.distance > 0 
                ? (diff / this.optimizedRoute.distance * 100).toFixed(1) 
                : 0;
            
            if (diff > 0) {
                differenceEl.textContent = `推荐路线短 ${diff.toFixed(1)} m (${percent}%)`;
                differenceEl.style.color = '#4ade80';
            } else if (diff < 0) {
                differenceEl.textContent = `手动路线短 ${Math.abs(diff).toFixed(1)} m`;
                differenceEl.style.color = '#fbbf24';
            } else {
                differenceEl.textContent = '两条路线距离相同';
                differenceEl.style.color = '#888';
            }
        } else if (differenceEl) {
            differenceEl.textContent = '--';
            differenceEl.style.color = '#888';
        }
    }
    
    updateRouteList() {
        const routeListEl = document.getElementById('routeList');
        if (!routeListEl) return;
        
        if (!this.optimizedRoute || !this.optimizedRoute.points) {
            routeListEl.classList.add('hidden');
            return;
        }
        
        routeListEl.classList.remove('hidden');
        
        const points = this.optimizedRoute.points;
        
        routeListEl.innerHTML = points.map((point, index) => {
            const isStart = point.isStart;
            const isEnd = point.isEnd;
            const name = point.name || `点 ${index + 1}`;
            const distance = point.distanceFromPrev !== undefined 
                ? `+${point.distanceFromPrev.toFixed(1)}m` 
                : '';
            
            return `
                <div class="route-list-item" data-index="${index}" draggable="true">
                    <span class="drag-handle">⋮⋮</span>
                    <span class="route-item-number">${index + 1}</span>
                    <div class="route-item-info">
                        <div class="route-item-name">
                            ${isStart ? '🚪 ' : ''}${name}${isEnd ? ' 🚪' : ''}
                        </div>
                        ${point.skus ? `<div class="route-item-details">SKU: ${point.skus.join(', ')}</div>` : ''}
                    </div>
                    <span class="route-item-distance">${distance}</span>
                </div>
            `;
        }).join('');
        
        this.setupDragSort(routeListEl);
    }
    
    setupDragSort(container) {
        let draggedItem = null;
        let draggedIndex = -1;
        
        container.querySelectorAll('.route-list-item').forEach(item => {
            item.addEventListener('dragstart', (e) => {
                if (e.target.classList.contains('drag-handle')) {
                    draggedItem = item;
                    draggedIndex = parseInt(item.dataset.index);
                    item.classList.add('dragging');
                    e.dataTransfer.effectAllowed = 'move';
                }
            });
            
            item.addEventListener('dragend', () => {
                item.classList.remove('dragging');
                draggedItem = null;
                draggedIndex = -1;
            });
            
            item.addEventListener('dragover', (e) => {
                e.preventDefault();
                if (draggedItem && item !== draggedItem) {
                    item.classList.add('drag-over');
                }
            });
            
            item.addEventListener('dragleave', () => {
                item.classList.remove('drag-over');
            });
            
            item.addEventListener('drop', (e) => {
                e.preventDefault();
                item.classList.remove('drag-over');
                
                if (draggedItem && item !== draggedItem) {
                    const targetIndex = parseInt(item.dataset.index);
                    this.reorderRoute(draggedIndex, targetIndex);
                }
            });
        });
    }
    
    reorderRoute(fromIndex, toIndex) {
        if (!this.optimizedRoute || !this.optimizedRoute.points) return;
        
        const points = [...this.optimizedRoute.points];
        const [removed] = points.splice(fromIndex, 1);
        points.splice(toIndex, 0, removed);
        
        const manualRoute = RouteOptimizer.calculateRouteWithOrder(
            this.warehouse,
            this.pickingOrder,
            points.map((p, i) => i)
        );
        manualRoute.isManual = true;
        manualRoute.points = points;
        
        this.manualRoute = manualRoute;
        
        this.uiManager.app.currentRoute = manualRoute;
        this.uiManager.sceneManager.renderRoute(manualRoute);
        
        this.updateRouteInfo();
    }
    
    generateRoute() {
        if (!this.pickingOrder || !this.pickingOrder.items.length) {
            this.uiManager.showNotification('请先导入拣货单', 'error');
            return;
        }
        
        const validation = DataValidator.validatePickingOrder(this.pickingOrder, this.warehouse);
        
        if (!validation.valid) {
            this.uiManager.showNotification(`数据验证失败: ${validation.errors.length} 个错误`, 'error');
            console.error('Validation errors:', validation.errors);
            return;
        }
        
        const route = RouteOptimizer.optimize(this.warehouse, this.pickingOrder, {
            algorithm: '2opt',
            startFromEntrance: true,
            endAtEntrance: true
        });
        
        route.isManual = false;
        this.optimizedRoute = route;
        this.manualRoute = null;
        
        this.uiManager.app.currentRoute = route;
        this.uiManager.sceneManager.renderRoute(route);
        
        eventBus.emit(Constants.EVENTS.ROUTE_UPDATED, route);
        
        this.uiManager.showNotification(`路线已生成，距离: ${route.distance.toFixed(1)} m`);
        this.updateRouteList();
        this.updateRouteInfo();
    }
    
    clearPicking() {
        this.pickingOrder = null;
        this.optimizedRoute = null;
        this.manualRoute = null;
        this.uiManager.app.pickingOrder = null;
        this.uiManager.app.currentRoute = null;
        
        this.uiManager.sceneManager.clearRoute();
        
        const routeListEl = document.getElementById('routeList');
        if (routeListEl) {
            routeListEl.classList.add('hidden');
        }
        
        this.updateRouteInfo();
        this.uiManager.updateStatusBar();
        
        this.uiManager.showNotification('拣货单已清空');
    }
    
    importPickingData(data, format = 'json') {
        try {
            let items = [];
            
            if (format === 'json') {
                items = this.parseJsonPickingData(data);
            } else if (format === 'csv') {
                items = this.parseCsvPickingData(data);
            }
            
            const pickingOrder = new PickingOrder({
                items: items,
                importedAt: Date.now()
            });
            
            const validation = DataValidator.validatePickingOrder(pickingOrder, this.warehouse);
            
            if (!validation.valid && validation.errors.length > 0) {
                this.showValidationErrors(validation.errors);
            }
            
            this.pickingOrder = pickingOrder;
            this.uiManager.app.pickingOrder = pickingOrder;
            
            eventBus.emit(Constants.EVENTS.PICKING_IMPORTED, pickingOrder);
            
            return pickingOrder;
            
        } catch (e) {
            console.error('Import error:', e);
            throw new Error(`解析数据失败: ${e.message}`);
        }
    }
    
    parseJsonPickingData(data) {
        let parsed;
        
        if (typeof data === 'string') {
            parsed = JSON.parse(data);
        } else {
            parsed = data;
        }
        
        if (Array.isArray(parsed)) {
            return parsed;
        }
        
        if (parsed.items) {
            return parsed.items;
        }
        
        throw new Error('无法识别的 JSON 格式');
    }
    
    parseCsvPickingData(csvText) {
        const lines = csvText.trim().split('\n');
        if (lines.length < 2) {
            throw new Error('CSV 文件格式错误: 至少需要表头和一行数据');
        }
        
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        const items = [];
        
        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',').map(v => v.trim());
            const item = {};
            
            headers.forEach((header, index) => {
                item[header] = values[index] || '';
            });
            
            items.push({
                orderNo: item.orderno || item.order_no || item['订单号'] || '',
                sku: item.sku || item['sku'] || '',
                quantity: parseInt(item.quantity || item.qty || item['数量'] || '0'),
                shelfSlot: item.shelfslot || item.shelf_slot || item.slot || item['货架位'] || ''
            });
        }
        
        return items;
    }
    
    showValidationErrors(errors) {
        const errorPanel = document.getElementById('pickingErrors');
        const errorList = document.getElementById('pickingErrorList');
        
        if (errorPanel && errorList) {
            errorPanel.classList.remove('hidden');
            errorList.innerHTML = errors.map(err => `<li>${err.message}</li>`).join('');
        }
    }
    
    setWarehouse(warehouse) {
        this.warehouse = warehouse;
    }
}
