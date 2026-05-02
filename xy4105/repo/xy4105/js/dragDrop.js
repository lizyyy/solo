export class DragDropManager {
    constructor(options = {}) {
        this.draggedElement = null;
        this.draggedData = null;
        this.dropZones = [];
        this.draggableElements = [];
        
        this.onDragStart = options.onDragStart || (() => {});
        this.onDragEnd = options.onDragEnd || (() => {});
        this.onDrop = options.onDrop || (() => {});
        this.onDragOver = options.onDragOver || (() => {});
        this.onDragLeave = options.onDragLeave || (() => {});
        
        this.touchStartX = 0;
        this.touchStartY = 0;
        this.isTouchDragging = false;
    }

    init() {
        document.addEventListener('dragstart', (e) => this.handleDragStart(e));
        document.addEventListener('dragend', (e) => this.handleDragEnd(e));
        document.addEventListener('dragover', (e) => this.handleDragOver(e));
        document.addEventListener('dragleave', (e) => this.handleDragLeave(e));
        document.addEventListener('drop', (e) => this.handleDrop(e));
        
        document.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: true });
        document.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: false });
        document.addEventListener('touchend', (e) => this.handleTouchEnd(e));
    }

    makeDraggable(element, data) {
        element.setAttribute('draggable', 'true');
        element.classList.add('draggable');
        element.dataset.dragData = JSON.stringify(data);
        this.draggableElements.push(element);
        return element;
    }

    makeDropZone(element, zoneType, options = {}) {
        element.classList.add('drop-zone');
        element.dataset.dropZoneType = zoneType;
        this.dropZones.push({ element, type: zoneType, options });
        return element;
    }

    handleDragStart(e) {
        if (!e.target.classList.contains('draggable')) return;
        
        this.draggedElement = e.target;
        this.draggedData = this.extractDragData(e.target);
        
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', JSON.stringify(this.draggedData));
        
        e.target.classList.add('dragging');
        
        this.onDragStart(this.draggedData, e.target);
    }

    handleDragEnd(e) {
        if (!this.draggedElement) return;
        
        this.draggedElement.classList.remove('dragging');
        this.draggedElement = null;
        this.draggedData = null;
        
        this.clearDropZoneHighlights();
        this.onDragEnd();
    }

    handleDragOver(e) {
        const dropZone = this.findDropZone(e.target);
        if (!dropZone) return;
        
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        
        this.highlightDropZone(dropZone.element, 'active');
        this.onDragOver(this.draggedData, dropZone.type, dropZone.options, e);
    }

    handleDragLeave(e) {
        const dropZone = this.findDropZone(e.target);
        if (!dropZone) return;
        
        if (!e.relatedTarget || !dropZone.element.contains(e.relatedTarget)) {
            this.unhighlightDropZone(dropZone.element);
            this.onDragLeave(this.draggedData, dropZone.type, e);
        }
    }

    handleDrop(e) {
        e.preventDefault();
        
        const dropZone = this.findDropZone(e.target);
        if (!dropZone || !this.draggedData) return;
        
        this.clearDropZoneHighlights();
        
        const position = this.getDropPosition(e, dropZone);
        
        this.onDrop(this.draggedData, dropZone.type, position, dropZone.options, e);
    }

    handleTouchStart(e) {
        const target = e.target.closest('.draggable');
        if (!target) return;
        
        const touch = e.touches[0];
        this.touchStartX = touch.clientX;
        this.touchStartY = touch.clientY;
        this.touchTarget = target;
        this.isTouchDragging = false;
    }

    handleTouchMove(e) {
        if (!this.touchTarget) return;
        
        const touch = e.touches[0];
        const deltaX = Math.abs(touch.clientX - this.touchStartX);
        const deltaY = Math.abs(touch.clientY - this.touchStartY);
        
        if (deltaX > 10 || deltaY > 10) {
            if (!this.isTouchDragging) {
                this.startTouchDrag();
            }
            
            e.preventDefault();
            this.updateTouchDragPosition(touch);
            
            const dropZone = this.findDropZoneAtPoint(touch.clientX, touch.clientY);
            this.updateDropZoneHighlight(dropZone);
        }
    }

    handleTouchEnd(e) {
        if (!this.isTouchDragging || !this.touchTarget) {
            this.touchTarget = null;
            return;
        }
        
        const touch = e.changedTouches[0];
        const dropZone = this.findDropZoneAtPoint(touch.clientX, touch.clientY);
        
        if (dropZone && this.draggedData) {
            const position = this.getDropPositionFromPoint(touch.clientX, touch.clientY, dropZone);
            this.onDrop(this.draggedData, dropZone.type, position, dropZone.options, e);
        }
        
        this.endTouchDrag();
    }

    startTouchDrag() {
        this.isTouchDragging = true;
        this.draggedElement = this.touchTarget;
        this.draggedData = this.extractDragData(this.touchTarget);
        
        this.touchTarget.classList.add('dragging', 'touch-dragging');
        
        this.createDragProxy(this.touchTarget);
        
        this.onDragStart(this.draggedData, this.touchTarget);
    }

    createDragProxy(element) {
        const proxy = element.cloneNode(true);
        proxy.classList.add('drag-proxy');
        proxy.style.position = 'fixed';
        proxy.style.pointerEvents = 'none';
        proxy.style.zIndex = '9999';
        proxy.style.opacity = '0.8';
        
        const rect = element.getBoundingClientRect();
        proxy.style.left = rect.left + 'px';
        proxy.style.top = rect.top + 'px';
        proxy.style.width = rect.width + 'px';
        proxy.style.height = rect.height + 'px';
        
        document.body.appendChild(proxy);
        this.dragProxy = proxy;
    }

    updateTouchDragPosition(touch) {
        if (!this.dragProxy) return;
        
        const rect = this.dragProxy.getBoundingClientRect();
        this.dragProxy.style.left = (touch.clientX - rect.width / 2) + 'px';
        this.dragProxy.style.top = (touch.clientY - rect.height / 2) + 'px';
    }

    updateDropZoneHighlight(dropZone) {
        this.clearDropZoneHighlights();
        if (dropZone) {
            this.highlightDropZone(dropZone.element, 'active');
        }
    }

    endTouchDrag() {
        if (this.dragProxy) {
            this.dragProxy.remove();
            this.dragProxy = null;
        }
        
        if (this.touchTarget) {
            this.touchTarget.classList.remove('dragging', 'touch-dragging');
        }
        
        this.clearDropZoneHighlights();
        
        this.touchTarget = null;
        this.draggedElement = null;
        this.draggedData = null;
        this.isTouchDragging = false;
        
        this.onDragEnd();
    }

    extractDragData(element) {
        try {
            return JSON.parse(element.dataset.dragData);
        } catch {
            return null;
        }
    }

    findDropZone(element) {
        const dropZoneEl = element.closest('.drop-zone');
        if (!dropZoneEl) return null;
        
        return this.dropZones.find(dz => dz.element === dropZoneEl);
    }

    findDropZoneAtPoint(x, y) {
        for (const dz of this.dropZones) {
            const rect = dz.element.getBoundingClientRect();
            if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
                return dz;
            }
        }
        return null;
    }

    getDropPosition(e, dropZone) {
        const rect = dropZone.element.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        return {
            x, y,
            clientX: e.clientX,
            clientY: e.clientY,
            rect
        };
    }

    getDropPositionFromPoint(clientX, clientY, dropZone) {
        const rect = dropZone.element.getBoundingClientRect();
        const x = clientX - rect.left;
        const y = clientY - rect.top;
        
        return {
            x, y,
            clientX,
            clientY,
            rect
        };
    }

    highlightDropZone(element, type) {
        element.classList.add('drop-zone-' + type);
    }

    unhighlightDropZone(element) {
        element.classList.remove('drop-zone-active', 'drop-zone-invalid');
    }

    clearDropZoneHighlights() {
        this.dropZones.forEach(dz => {
            dz.element.classList.remove('drop-zone-active', 'drop-zone-invalid');
        });
    }

    updateDraggableData(element, data) {
        element.dataset.dragData = JSON.stringify(data);
    }

    removeDraggable(element) {
        element.classList.remove('draggable');
        element.removeAttribute('draggable');
        delete element.dataset.dragData;
        this.draggableElements = this.draggableElements.filter(el => el !== element);
    }

    removeDropZone(element) {
        element.classList.remove('drop-zone');
        delete element.dataset.dropZoneType;
        this.dropZones = this.dropZones.filter(dz => dz.element !== element);
    }

    destroy() {
        this.draggableElements.forEach(el => {
            el.classList.remove('draggable');
            el.removeAttribute('draggable');
            delete el.dataset.dragData;
        });
        
        this.dropZones.forEach(dz => {
            dz.element.classList.remove('drop-zone');
            delete dz.element.dataset.dropZoneType;
        });
        
        this.draggableElements = [];
        this.dropZones = [];
    }
}