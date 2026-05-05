/**
 * 内存池和对象池模拟器UI模块
 * 处理UI交互和结果展示
 */

let currentPoolResult = null;

function runMemoryPoolSimulation() {
    const poolType = document.getElementById('pool-type').value;
    const totalSize = parseInt(document.getElementById('pool-total-size').value);
    const objectSize = parseInt(document.getElementById('pool-object-size').value);
    const alignment = parseInt(document.getElementById('pool-alignment').value);
    const operationsStr = document.getElementById('pool-operations').value;
    
    const operations = Utils.parsePoolOperations(operationsStr);
    
    if (operations.length === 0) {
        const defaultOps = [
            { type: 'alloc', size: 256 },
            { type: 'alloc', size: 512 },
            { type: 'alloc', size: 128 },
            { type: 'free', allocationId: 1 },
            { type: 'alloc', size: 384 },
            { type: 'free', allocationId: 0 },
            { type: 'alloc', size: 256 }
        ];
        document.getElementById('pool-operations').value = 'alloc:256 alloc:512 alloc:128 free:1 alloc:384 free:0 alloc:256';
    }
    
    const config = {
        poolType,
        totalSize,
        objectSize,
        alignment,
        operations
    };
    
    const simulator = new MemoryPoolSimulator(config);
    currentPoolResult = simulator.run();
    
    displayPoolResults(currentPoolResult);
    
    return currentPoolResult;
}

function resetMemoryPoolSimulation() {
    document.getElementById('pool-operations').value = '';
    
    document.getElementById('pool-utilization-rate').textContent = '0%';
    document.getElementById('pool-internal-fragmentation').textContent = '0%';
    document.getElementById('pool-external-fragmentation').textContent = '0 字节';
    document.getElementById('pool-allocation-failures').textContent = '0';
    
    document.getElementById('pool-slots').innerHTML = '<div class="text-center text-gray-500 py-8">请先运行模拟</div>';
    document.getElementById('pool-memory-map').innerHTML = '<div class="text-center text-gray-500 py-8">请先运行模拟</div>';
    document.getElementById('pool-timeline').innerHTML = '<div class="text-center text-gray-500 py-8">请先运行模拟</div>';
    
    currentPoolResult = null;
}

function displayPoolResults(result) {
    if (!result) return;
    
    document.getElementById('pool-utilization-rate').textContent = result.stats.utilizationRate + '%';
    document.getElementById('pool-internal-fragmentation').textContent = result.stats.internalFragmentationRate + '%';
    document.getElementById('pool-external-fragmentation').textContent = Utils.formatBytes(result.stats.externalFragmentation);
    document.getElementById('pool-allocation-failures').textContent = result.stats.allocationFailures;
    
    displayPoolSlots(result.pool);
    displayPoolMemoryMap(result.pool, result.config.poolType);
    displayPoolTimeline(result.history);
}

function displayPoolSlots(pool) {
    const container = document.getElementById('pool-slots');
    container.innerHTML = '';
    
    if (!pool || pool.length === 0) {
        container.innerHTML = '<div class="text-center text-gray-500 py-8">暂无数据</div>';
        return;
    }
    
    const table = document.createElement('div');
    table.className = 'border rounded-lg overflow-hidden';
    
    const header = document.createElement('div');
    header.className = 'bg-gray-100 page-table-row font-semibold';
    header.innerHTML = `
        <div class="page-table-cell">槽位索引</div>
        <div class="page-table-cell">偏移地址</div>
        <div class="page-table-cell">大小</div>
        <div class="page-table-cell">请求大小</div>
        <div class="page-table-cell">填充</div>
        <div class="page-table-cell">状态</div>
        <div class="page-table-cell">分配ID</div>
    `;
    table.appendChild(header);
    
    for (const slot of pool) {
        const row = document.createElement('div');
        row.className = `page-table-row ${slot.used ? '' : 'opacity-70'}`;
        
        const statusClass = slot.used ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800';
        const statusText = slot.used ? '已使用' : '空闲';
        
        row.innerHTML = `
            <div class="page-table-cell">${slot.index}</div>
            <div class="page-table-cell font-mono">0x${slot.offset.toString(16).toUpperCase()}</div>
            <div class="page-table-cell">${Utils.formatBytes(slot.size)}</div>
            <div class="page-table-cell">${slot.requestedSize !== null ? Utils.formatBytes(slot.requestedSize) : '-'}</div>
            <div class="page-table-cell">
                ${slot.padding > 0 ? 
                    `<span class="text-red-600">${slot.padding} 字节</span>` : 
                    '-'}
            </div>
            <div class="page-table-cell">
                <span class="px-2 py-1 rounded text-xs ${statusClass}">
                    ${statusText}
                </span>
            </div>
            <div class="page-table-cell">
                ${slot.allocationId !== null ? slot.allocationId : '-'}
            </div>
        `;
        table.appendChild(row);
    }
    
    container.appendChild(table);
}

function displayPoolMemoryMap(pool, poolType) {
    const container = document.getElementById('pool-memory-map');
    container.innerHTML = '';
    
    if (!pool || pool.length === 0) {
        container.innerHTML = '<div class="text-center text-gray-500 py-8">暂无数据</div>';
        return;
    }
    
    const totalSize = pool.reduce((sum, slot) => sum + slot.size, 0);
    
    const wrapper = document.createElement('div');
    wrapper.className = 'space-y-4';
    
    const header = document.createElement('div');
    header.className = 'flex items-center justify-between';
    header.innerHTML = `
        <div class="text-sm text-gray-600">内存映射 (总大小: ${Utils.formatBytes(totalSize)})</div>
        <div class="flex space-x-4 text-sm">
            <span class="flex items-center">
                <span class="w-3 h-3 bg-blue-500 rounded mr-1"></span>
                已使用
            </span>
            <span class="flex items-center">
                <span class="w-3 h-3 bg-green-500 rounded mr-1"></span>
                空闲
            </span>
            <span class="flex items-center">
                <span class="w-3 h-3 bg-red-500 rounded mr-1"></span>
                填充/碎片
            </span>
        </div>
    `;
    wrapper.appendChild(header);
    
    const visualizer = document.createElement('div');
    visualizer.className = 'border rounded-lg overflow-hidden';
    
    const bar = document.createElement('div');
    bar.className = 'flex h-12';
    
    for (const slot of pool) {
        const widthPercent = (slot.size / totalSize * 100);
        const segment = document.createElement('div');
        
        let bgColor = 'bg-green-400';
        if (slot.used) {
            bgColor = 'bg-blue-500';
            if (slot.padding > 0) {
                bgColor = 'bg-purple-500';
            }
        } else if (slot.size < 64 && poolType === 'memory') {
            bgColor = 'bg-red-400';
        }
        
        segment.className = `${bgColor} flex items-center justify-center text-white text-xs font-mono transition-all hover:opacity-80`;
        segment.style.width = `${widthPercent}%`;
        segment.title = `槽位 ${slot.index}: ${Utils.formatBytes(slot.size)} ${slot.used ? '(已使用)' : '(空闲)'}`;
        
        if (widthPercent > 5) {
            segment.innerHTML = `<span class="truncate px-1">${slot.index}</span>`;
        }
        
        bar.appendChild(segment);
    }
    
    visualizer.appendChild(bar);
    
    const legend = document.createElement('div');
    legend.className = 'p-3 bg-gray-50 text-sm';
    
    const usedSlots = pool.filter(s => s.used);
    const freeSlots = pool.filter(s => !s.used);
    const totalPadding = pool.reduce((sum, s) => sum + (s.padding || 0), 0);
    
    legend.innerHTML = `
        <div class="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div>
                <span class="text-gray-600">已使用槽位:</span>
                <span class="font-semibold text-blue-600">${usedSlots.length}</span>
            </div>
            <div>
                <span class="text-gray-600">空闲槽位:</span>
                <span class="font-semibold text-green-600">${freeSlots.length}</span>
            </div>
            <div>
                <span class="text-gray-600">总填充:</span>
                <span class="font-semibold text-red-600">${Utils.formatBytes(totalPadding)}</span>
            </div>
            <div>
                <span class="text-gray-600">总槽位:</span>
                <span class="font-semibold">${pool.length}</span>
            </div>
        </div>
    `;
    
    visualizer.appendChild(legend);
    wrapper.appendChild(visualizer);
    
    container.appendChild(wrapper);
}

function displayPoolTimeline(history) {
    const timelineContainer = document.getElementById('pool-timeline');
    timelineContainer.innerHTML = '';
    
    if (!history || history.length === 0) {
        timelineContainer.innerHTML = '<div class="text-center text-gray-500 py-8">暂无数据</div>';
        return;
    }
    
    for (const entry of history) {
        const item = document.createElement('div');
        item.className = 'timeline-item';
        
        let statusClass = entry.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';
        let statusText = entry.success ? '成功' : '失败';
        let operationText = entry.operation === 'alloc' ? '分配' : '释放';
        
        let details = '';
        if (entry.operation === 'alloc') {
            if (entry.success) {
                details = `
                    <p>请求大小: <span class="font-mono">${Utils.formatBytes(entry.requestedSize)}</span></p>
                    <p>实际大小: <span class="font-mono">${Utils.formatBytes(entry.actualSize)}</span></p>
                    <p>偏移地址: <span class="font-mono">0x${entry.offset.toString(16).toUpperCase()}</span></p>
                    <p>分配ID: <span class="font-mono">${entry.allocationId}</span></p>
                    ${entry.padding > 0 ? `<p class="text-red-600">填充: <span class="font-mono">${entry.padding} 字节</span></p>` : ''}
                `;
            } else {
                details = `
                    <p>请求大小: <span class="font-mono">${Utils.formatBytes(entry.requestedSize)}</span></p>
                    <p class="text-red-600">错误: ${entry.error}</p>
                `;
            }
        } else {
            if (entry.success) {
                details = `
                    <p>分配ID: <span class="font-mono">${entry.allocationId}</span></p>
                    <p>槽位索引: <span class="font-mono">${entry.slotIndex}</span></p>
                    <p>偏移地址: <span class="font-mono">0x${entry.offset.toString(16).toUpperCase()}</span></p>
                    <p>释放大小: <span class="font-mono">${Utils.formatBytes(entry.size)}</span></p>
                `;
            } else {
                details = `
                    <p>分配ID: <span class="font-mono">${entry.allocationId}</span></p>
                    <p class="text-red-600">错误: ${entry.error}</p>
                `;
            }
        }
        
        item.innerHTML = `
            <div class="flex items-start">
                <div class="flex-1">
                    <div class="flex items-center justify-between mb-2">
                        <span class="font-semibold text-gray-800">
                            时间 ${entry.time}: ${operationText}
                        </span>
                        <span class="px-2 py-1 rounded text-xs font-medium ${statusClass}">
                            ${statusText}
                        </span>
                    </div>
                    <div class="text-sm text-gray-700">
                        ${details}
                    </div>
                </div>
            </div>
        `;
        
        timelineContainer.appendChild(item);
    }
}

function getCurrentPoolResult() {
    return currentPoolResult;
}
