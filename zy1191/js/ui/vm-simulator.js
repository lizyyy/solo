/**
 * 虚拟内存模拟器UI模块
 * 处理UI交互和结果展示
 */

let currentVMResult = null;

function runVirtualMemorySimulation() {
    const pageSize = parseInt(document.getElementById('vm-page-size').value);
    const physicalFrames = parseInt(document.getElementById('vm-physical-frames').value);
    const tlbSize = parseInt(document.getElementById('vm-tlb-size').value);
    const replacementPolicy = document.getElementById('vm-replacement-policy').value;
    const accessSequenceStr = document.getElementById('vm-access-sequence').value;
    const randomSeedStr = document.getElementById('vm-random-seed').value;
    
    let accessSequence = Utils.parseAccessSequence(accessSequenceStr);
    let randomSeed = randomSeedStr ? parseInt(randomSeedStr) : null;
    
    if (accessSequence.length === 0) {
        accessSequence = Utils.generateRandomAccessSequence(20, 4096 * 10, randomSeed);
        document.getElementById('vm-access-sequence').value = accessSequence.join(' ');
    }
    
    const config = {
        pageSize,
        physicalFrames,
        tlbSize,
        replacementPolicy,
        accessSequence,
        randomSeed: randomSeed || Date.now()
    };
    
    const simulator = new VirtualMemorySimulator(config);
    currentVMResult = simulator.run();
    
    displayVMResults(currentVMResult);
    
    return currentVMResult;
}

function resetVirtualMemorySimulation() {
    document.getElementById('vm-access-sequence').value = '';
    document.getElementById('vm-random-seed').value = '';
    
    document.getElementById('vm-tlb-hit-rate').textContent = '0%';
    document.getElementById('vm-page-fault-rate').textContent = '0%';
    document.getElementById('vm-total-accesses').textContent = '0';
    document.getElementById('vm-replacement-count').textContent = '0';
    
    document.getElementById('vm-timeline').innerHTML = '<div class="text-center text-gray-500 py-8">请先运行模拟</div>';
    document.getElementById('vm-page-table').innerHTML = '<div class="text-center text-gray-500 py-8">请先运行模拟</div>';
    document.getElementById('vm-tlb').innerHTML = '<div class="text-center text-gray-500 py-8">请先运行模拟</div>';
    document.getElementById('vm-physical-memory').innerHTML = '<div class="text-center text-gray-500 py-8">请先运行模拟</div>';
    
    currentVMResult = null;
}

function displayVMResults(result) {
    if (!result) return;
    
    document.getElementById('vm-tlb-hit-rate').textContent = result.stats.tlbHitRate + '%';
    document.getElementById('vm-page-fault-rate').textContent = result.stats.pageFaultRate + '%';
    document.getElementById('vm-total-accesses').textContent = result.stats.totalAccesses;
    document.getElementById('vm-replacement-count').textContent = result.stats.replacements;
    
    displayVMTimeline(result.history);
    displayVMPageTable(result.pageTable);
    displayVMTLB(result.tlb, result.config.tlbSize);
    displayVMPhysicalMemory(result.physicalMemory, result.config.pageSize);
}

function displayVMTimeline(history) {
    const timelineContainer = document.getElementById('vm-timeline');
    timelineContainer.innerHTML = '';
    
    if (!history || history.length === 0) {
        timelineContainer.innerHTML = '<div class="text-center text-gray-500 py-8">暂无数据</div>';
        return;
    }
    
    for (const entry of history) {
        const statusClasses = [];
        const statusTexts = [];
        
        if (entry.tlbHit) {
            statusClasses.push('bg-green-100 text-green-800');
            statusTexts.push('TLB命中');
        } else if (entry.tlbHit === false && history[0].tlbHit !== undefined) {
            statusClasses.push('bg-yellow-100 text-yellow-800');
            statusTexts.push('TLB未命中');
        }
        
        if (entry.pageFault) {
            statusClasses.push('bg-red-100 text-red-800');
            statusTexts.push('缺页');
        }
        
        if (entry.replacement) {
            statusClasses.push('bg-purple-100 text-purple-800');
            statusTexts.push('置换');
        }
        
        if (statusClasses.length === 0) {
            statusClasses.push('bg-blue-100 text-blue-800');
            statusTexts.push('正常');
        }
        
        const item = document.createElement('div');
        item.className = 'timeline-item';
        item.innerHTML = `
            <div class="flex items-start">
                <div class="flex-1">
                    <div class="flex items-center justify-between mb-2">
                        <span class="font-semibold text-gray-800">时间 ${entry.time}</span>
                        <div class="flex space-x-2">
                            ${statusTexts.map((text, i) => 
                                `<span class="px-2 py-1 rounded text-xs font-medium ${statusClasses[i]}">${text}</span>`
                            ).join('')}
                        </div>
                    </div>
                    <div class="text-sm text-gray-700">
                        <p>虚拟地址: <span class="font-mono">${entry.virtualAddress}</span></p>
                        <p>页号: <span class="font-mono">${entry.pageNumber}</span>, 偏移: <span class="font-mono">${entry.offset}</span></p>
                        ${entry.physicalFrame !== null ? 
                            `<p>物理帧: <span class="font-mono">${entry.physicalFrame}</span></p>` : ''}
                        ${entry.evictedPage !== null ? 
                            `<p class="text-red-600">置换页: <span class="font-mono">${entry.evictedPage}</span></p>` : ''}
                    </div>
                </div>
            </div>
        `;
        timelineContainer.appendChild(item);
    }
}

function displayVMPageTable(pageTable) {
    const container = document.getElementById('vm-page-table');
    container.innerHTML = '';
    
    if (!pageTable || pageTable.length === 0) {
        container.innerHTML = '<div class="text-center text-gray-500 py-8">暂无数据</div>';
        return;
    }
    
    const table = document.createElement('div');
    table.className = 'border rounded-lg overflow-hidden';
    
    const header = document.createElement('div');
    header.className = 'bg-gray-100 page-table-row font-semibold';
    header.innerHTML = `
        <div class="page-table-cell">页号</div>
        <div class="page-table-cell">有效位</div>
        <div class="page-table-cell">物理帧</div>
        <div class="page-table-cell">加载时间</div>
        <div class="page-table-cell">最后使用</div>
    `;
    table.appendChild(header);
    
    for (const entry of pageTable) {
        const row = document.createElement('div');
        row.className = `page-table-row ${entry.valid ? '' : 'opacity-50'}`;
        row.innerHTML = `
            <div class="page-table-cell">${entry.pageNumber}</div>
            <div class="page-table-cell">
                <span class="px-2 py-1 rounded text-xs ${entry.valid ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'}">
                    ${entry.valid ? '有效' : '无效'}
                </span>
            </div>
            <div class="page-table-cell">${entry.valid ? entry.frame : '-'}</div>
            <div class="page-table-cell">${entry.loadedTime || '-'}</div>
            <div class="page-table-cell">${entry.lastUsed || '-'}</div>
        `;
        table.appendChild(row);
    }
    
    container.appendChild(table);
}

function displayVMTLB(tlbEntries, tlbSize) {
    const container = document.getElementById('vm-tlb');
    container.innerHTML = '';
    
    if (tlbSize === 0) {
        container.innerHTML = '<div class="text-center text-gray-500 py-8">TLB 已禁用（容量为 0）</div>';
        return;
    }
    
    const tlbMap = new Map();
    for (const entry of tlbEntries) {
        tlbMap.set(entry.pageNumber, entry);
    }
    
    for (let i = 0; i < tlbSize; i++) {
        const entry = i < tlbEntries.length ? tlbEntries[i] : null;
        const div = document.createElement('div');
        div.className = `tlb-entry ${entry ? 'active' : 'inactive'}`;
        div.innerHTML = `
            <div class="flex-1">
                <div class="flex items-center justify-between">
                    <span class="font-semibold">TLB 条目 ${i}</span>
                    <span class="text-sm text-gray-500">${entry ? '已使用' : '空闲'}</span>
                </div>
                ${entry ? `
                    <div class="mt-2 text-sm">
                        <p>页号: <span class="font-mono">${entry.pageNumber}</span></p>
                        <p>物理帧: <span class="font-mono">${entry.frame}</span></p>
                        <p>最后使用: <span class="font-mono">${entry.lastUsed}</span></p>
                    </div>
                ` : ''}
            </div>
        `;
        container.appendChild(div);
    }
}

function displayVMPhysicalMemory(physicalMemory, pageSize) {
    const container = document.getElementById('vm-physical-memory');
    container.innerHTML = '';
    
    if (!physicalMemory || physicalMemory.length === 0) {
        container.innerHTML = '<div class="text-center text-gray-500 py-8">暂无数据</div>';
        return;
    }
    
    const table = document.createElement('div');
    table.className = 'border rounded-lg overflow-hidden';
    
    const header = document.createElement('div');
    header.className = 'bg-gray-100 page-table-row font-semibold';
    header.innerHTML = `
        <div class="page-table-cell">物理帧</div>
        <div class="page-table-cell">页号</div>
        <div class="page-table-cell">地址范围</div>
        <div class="page-table-cell">状态</div>
    `;
    table.appendChild(header);
    
    for (let i = 0; i < physicalMemory.length; i++) {
        const pageNumber = physicalMemory[i];
        const isUsed = pageNumber !== null;
        const row = document.createElement('div');
        row.className = `page-table-row ${isUsed ? '' : 'opacity-50'}`;
        
        const startAddr = i * pageSize;
        const endAddr = startAddr + pageSize - 1;
        
        row.innerHTML = `
            <div class="page-table-cell">${i}</div>
            <div class="page-table-cell">${isUsed ? pageNumber : '-'}</div>
            <div class="page-table-cell font-mono text-sm">${startAddr} - ${endAddr}</div>
            <div class="page-table-cell">
                <span class="px-2 py-1 rounded text-xs ${isUsed ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-500'}">
                    ${isUsed ? '已占用' : '空闲'}
                </span>
            </div>
        `;
        table.appendChild(row);
    }
    
    container.appendChild(table);
}

function getCurrentVMResult() {
    return currentVMResult;
}
