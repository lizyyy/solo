/**
 * 拖拽状态管理模块
 * 处理船只的拖拽、放置和状态管理
 */

const DragState = (function() {
    'use strict';

    // 拖拽状态
    let dragState = {
        isDragging: false,
        draggedShip: null,
        sourceContainer: null,
        sourceIndex: -1,
        dragOffsetX: 0,
        dragOffsetY: 0
    };

    // 允许的拖拽源和目标容器
    const allowedContainers = {
        'waiting-ships': ['lock-chamber'],
        'lock-chamber': ['waiting-ships']
    };

    // 事件回调函数
    let onDragStartCallback = null;
    let onDragEndCallback = null;
    let onDropCallback = null;
    let onInvalidDropCallback = null;

    /**
     * 初始化拖拽功能
     * @param {Object} callbacks - 回调函数对象
     */
    function init(callbacks = {}) {
        // 设置回调函数
        onDragStartCallback = callbacks.onDragStart || null;
        onDragEndCallback = callbacks.onDragEnd || null;
        onDropCallback = callbacks.onDrop || null;
        onInvalidDropCallback = callbacks.onInvalidDrop || null;

        // 绑定全局事件
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);

        // 添加触摸事件支持
        document.addEventListener('touchmove', handleTouchMove, { passive: false });
        document.addEventListener('touchend', handleTouchEnd);
    }

    /**
     * 清理拖拽功能
     */
    function destroy() {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.removeEventListener('touchmove', handleTouchMove);
        document.removeEventListener('touchend', handleTouchEnd);
    }

    /**
     * 开始拖拽
     * @param {Object} ship - 被拖拽的船只对象
     * @param {HTMLElement} shipElement - 船只DOM元素
     * @param {string} sourceContainerId - 源容器ID
     * @param {number} sourceIndex - 源容器中的索引
     * @param {Event} event - 鼠标/触摸事件
     */
    function startDrag(ship, shipElement, sourceContainerId, sourceIndex, event) {
        if (!ship || !shipElement) return;

        // 阻止默认行为
        event.preventDefault();
        event.stopPropagation();

        // 设置拖拽状态
        dragState.isDragging = true;
        dragState.draggedShip = ship;
        dragState.sourceContainer = sourceContainerId;
        dragState.sourceIndex = sourceIndex;

        // 计算拖拽偏移量
        const rect = shipElement.getBoundingClientRect();
        const clientX = event.clientX || (event.touches && event.touches[0].clientX);
        const clientY = event.clientY || (event.touches && event.touches[0].clientY);
        
        dragState.dragOffsetX = clientX - rect.left;
        dragState.dragOffsetY = clientY - rect.top;

        // 创建拖拽元素的克隆
        const clone = shipElement.cloneNode(true);
        clone.id = `drag-clone-${ship.id}`;
        clone.classList.add('dragging');
        clone.style.position = 'fixed';
        clone.style.zIndex = '1000';
        clone.style.pointerEvents = 'none';
        clone.style.opacity = '0.8';
        
        // 设置初始位置
        clone.style.left = `${rect.left}px`;
        clone.style.top = `${rect.top}px`;
        clone.style.width = `${rect.width}px`;
        
        document.body.appendChild(clone);
        dragState.dragElement = clone;

        // 高亮源元素
        shipElement.classList.add('drag-source');

        // 调用回调函数
        if (onDragStartCallback) {
            onDragStartCallback(ship, sourceContainerId);
        }
    }

    /**
     * 处理鼠标移动
     * @param {MouseEvent} event - 鼠标事件
     */
    function handleMouseMove(event) {
        if (!dragState.isDragging || !dragState.dragElement) return;

        const clientX = event.clientX;
        const clientY = event.clientY;

        updateDragPosition(clientX, clientY);
        highlightDropTarget(clientX, clientY);
    }

    /**
     * 处理触摸移动
     * @param {TouchEvent} event - 触摸事件
     */
    function handleTouchMove(event) {
        if (!dragState.isDragging || !dragState.dragElement) return;

        event.preventDefault(); // 阻止滚动

        const touch = event.touches[0];
        const clientX = touch.clientX;
        const clientY = touch.clientY;

        updateDragPosition(clientX, clientY);
        highlightDropTarget(clientX, clientY);
    }

    /**
     * 更新拖拽元素位置
     * @param {number} clientX - 鼠标X坐标
     * @param {number} clientY - 鼠标Y坐标
     */
    function updateDragPosition(clientX, clientY) {
        if (!dragState.dragElement) return;

        const newLeft = clientX - dragState.dragOffsetX;
        const newTop = clientY - dragState.dragOffsetY;

        dragState.dragElement.style.left = `${newLeft}px`;
        dragState.dragElement.style.top = `${newTop}px`;
    }

    /**
     * 高亮放置目标
     * @param {number} clientX - 鼠标X坐标
     * @param {number} clientY - 鼠标Y坐标
     */
    function highlightDropTarget(clientX, clientY) {
        // 移除所有之前的高亮
        document.querySelectorAll('.drop-target').forEach(el => {
            el.classList.remove('drop-target', 'valid-drop', 'invalid-drop');
        });

        // 找到当前鼠标位置下的容器
        const elements = document.elementsFromPoint(clientX, clientY);
        let targetContainer = null;

        for (const el of elements) {
            if (el.id && (el.id === 'waiting-ships' || el.id === 'lock-chamber')) {
                targetContainer = el;
                break;
            }
        }

        if (!targetContainer) return;

        // 检查是否是有效的放置目标
        const isValidTarget = isValidDropTarget(dragState.sourceContainer, targetContainer.id);

        targetContainer.classList.add('drop-target');
        targetContainer.classList.add(isValidTarget ? 'valid-drop' : 'invalid-drop');
    }

    /**
     * 检查是否是有效的放置目标
     * @param {string} sourceId - 源容器ID
     * @param {string} targetId - 目标容器ID
     * @returns {boolean} - 是否有效
     */
    function isValidDropTarget(sourceId, targetId) {
        if (!sourceId || !targetId) return false;
        if (sourceId === targetId) return false; // 不能放到同一个容器

        const allowedTargets = allowedContainers[sourceId];
        return allowedTargets && allowedTargets.includes(targetId);
    }

    /**
     * 处理鼠标松开
     * @param {MouseEvent} event - 鼠标事件
     */
    function handleMouseUp(event) {
        if (!dragState.isDragging) return;

        const clientX = event.clientX;
        const clientY = event.clientY;

        finishDrag(clientX, clientY);
    }

    /**
     * 处理触摸结束
     * @param {TouchEvent} event - 触摸事件
     */
    function handleTouchEnd(event) {
        if (!dragState.isDragging) return;

        const touch = event.changedTouches[0];
        const clientX = touch.clientX;
        const clientY = touch.clientY;

        finishDrag(clientX, clientY);
    }

    /**
     * 完成拖拽
     * @param {number} clientX - 鼠标X坐标
     * @param {number} clientY - 鼠标Y坐标
     */
    function finishDrag(clientX, clientY) {
        // 找到目标容器
        const elements = document.elementsFromPoint(clientX, clientY);
        let targetContainer = null;

        for (const el of elements) {
            if (el.id && (el.id === 'waiting-ships' || el.id === 'lock-chamber')) {
                targetContainer = el;
                break;
            }
        }

        let dropSuccess = false;

        if (targetContainer && isValidDropTarget(dragState.sourceContainer, targetContainer.id)) {
            // 有效的放置
            if (onDropCallback) {
                dropSuccess = onDropCallback(
                    dragState.draggedShip,
                    dragState.sourceContainer,
                    dragState.sourceIndex,
                    targetContainer.id
                );
            }
        } else {
            // 无效的放置
            if (onInvalidDropCallback) {
                onInvalidDropCallback(
                    dragState.draggedShip,
                    dragState.sourceContainer,
                    targetContainer ? targetContainer.id : null
                );
            }
        }

        // 清理拖拽状态
        cleanupDrag();

        // 调用拖拽结束回调
        if (onDragEndCallback) {
            onDragEndCallback(dragState.draggedShip, dropSuccess);
        }
    }

    /**
     * 清理拖拽状态
     */
    function cleanupDrag() {
        // 移除拖拽元素
        if (dragState.dragElement) {
            dragState.dragElement.remove();
            dragState.dragElement = null;
        }

        // 移除源元素的高亮
        const sourceElement = document.querySelector(`.drag-source[data-ship-id="${dragState.draggedShip?.id}"]`);
        if (sourceElement) {
            sourceElement.classList.remove('drag-source');
        }

        // 移除所有放置目标的高亮
        document.querySelectorAll('.drop-target').forEach(el => {
            el.classList.remove('drop-target', 'valid-drop', 'invalid-drop');
        });

        // 重置拖拽状态
        dragState = {
            isDragging: false,
            draggedShip: null,
            sourceContainer: null,
            sourceIndex: -1,
            dragOffsetX: 0,
            dragOffsetY: 0,
            dragElement: null
        };
    }

    /**
     * 创建可拖拽的船只元素
     * @param {Object} ship - 船只对象
     * @param {string} containerId - 容器ID
     * @param {number} index - 在容器中的索引
     * @returns {HTMLElement} - 可拖拽的DOM元素
     */
    function createDraggableShipElement(ship, containerId, index) {
        const element = document.createElement('div');
        element.className = `ship-item ship-${ship.type}`;
        element.dataset.shipId = ship.id;
        element.dataset.containerId = containerId;
        element.dataset.index = index;
        
        // 设置船只内容
        element.innerHTML = `
            <div class="ship-name">${ship.name}</div>
            <div class="ship-info">
                <span class="ship-type">${LevelData.getShipTypeName(ship.type)}</span>
                <span class="ship-direction">${ship.targetDirection === 'up' ? '↑ 上行' : '↓ 下行'}</span>
                <span class="ship-priority">优先级: ${ship.priority}</span>
            </div>
            <div class="ship-deadline">
                截止: ${LevelData.formatTime(ship.deadline)}
            </div>
        `;

        // 绑定拖拽事件
        element.addEventListener('mousedown', (e) => {
            startDrag(ship, element, containerId, index, e);
        });

        element.addEventListener('touchstart', (e) => {
            startDrag(ship, element, containerId, index, e);
        }, { passive: false });

        return element;
    }

    /**
     * 渲染船只到容器
     * @param {Array} ships - 船只数组
     * @param {string} containerId - 容器ID
     */
    function renderShipsToContainer(ships, containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        // 清空容器
        container.innerHTML = '';

        // 渲染每艘船
        ships.forEach((ship, index) => {
            const element = createDraggableShipElement(ship, containerId, index);
            container.appendChild(element);
        });
    }

    /**
     * 获取当前拖拽状态
     * @returns {Object} - 拖拽状态
     */
    function getDragState() {
        return { ...dragState };
    }

    /**
     * 取消当前拖拽
     */
    function cancelDrag() {
        if (dragState.isDragging) {
            if (onInvalidDropCallback) {
                onInvalidDropCallback(
                    dragState.draggedShip,
                    dragState.sourceContainer,
                    null
                );
            }
            cleanupDrag();
        }
    }

    // 公开API
    return {
        init,
        destroy,
        startDrag,
        createDraggableShipElement,
        renderShipsToContainer,
        getDragState,
        cancelDrag,
        isValidDropTarget
    };
})();
