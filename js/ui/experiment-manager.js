/**
 * 实验管理器模块
 * 处理实验的保存、加载、对比和导出
 */

const STORAGE_KEY = 'vm_memory_pool_experiments';

function saveCurrentExperiment() {
    const nameInput = document.getElementById('experiment-name');
    const name = nameInput.value.trim();
    
    if (!name) {
        alert('请输入实验名称');
        return;
    }
    
    let experiment = null;
    let type = null;
    
    const vmResult = getCurrentVMResult();
    const poolResult = getCurrentPoolResult();
    
    if (vmResult) {
        experiment = vmResult;
        type = 'vm';
    } else if (poolResult) {
        experiment = poolResult;
        type = 'pool';
    } else {
        alert('请先运行虚拟内存或内存池模拟');
        return;
    }
    
    const savedExperiments = getSavedExperiments();
    
    const experimentData = {
        id: Date.now().toString(),
        name: name,
        type: type,
        timestamp: Date.now(),
        config: experiment.config,
        stats: experiment.stats,
        history: experiment.history,
        extra: {}
    };
    
    if (type === 'vm') {
        experimentData.extra = {
            pageTable: experiment.pageTable,
            tlb: experiment.tlb,
            physicalMemory: experiment.physicalMemory
        };
    } else {
        experimentData.extra = {
            pool: experiment.pool,
            allocations: experiment.allocations
        };
    }
    
    savedExperiments.push(experimentData);
    saveExperimentsToStorage(savedExperiments);
    
    nameInput.value = '';
    loadSavedExperiments();
    
    alert(`实验 "${name}" 已保存`);
}

function getSavedExperiments() {
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        return data ? JSON.parse(data) : [];
    } catch (e) {
        console.error('Failed to load experiments:', e);
        return [];
    }
}

function saveExperimentsToStorage(experiments) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(experiments));
    } catch (e) {
        console.error('Failed to save experiments:', e);
        alert('保存失败: 存储空间可能已满');
    }
}

function loadSavedExperiments() {
    const savedExperiments = getSavedExperiments();
    const container = document.getElementById('saved-experiments');
    const compareSelect = document.getElementById('compare-experiments');
    
    if (savedExperiments.length === 0) {
        container.innerHTML = '<div class="text-center text-gray-500 py-8">暂无保存的实验</div>';
        compareSelect.innerHTML = '';
        return;
    }
    
    const table = document.createElement('div');
    table.className = 'border rounded-lg overflow-hidden';
    
    const header = document.createElement('div');
    header.className = 'bg-gray-100 page-table-row font-semibold';
    header.innerHTML = `
        <div class="page-table-cell">实验名称</div>
        <div class="page-table-cell">类型</div>
        <div class="page-table-cell">创建时间</div>
        <div class="page-table-cell">操作</div>
    `;
    table.appendChild(header);
    
    compareSelect.innerHTML = '';
    
    for (const exp of savedExperiments) {
        const row = document.createElement('div');
        row.className = 'page-table-row';
        
        const typeText = exp.type === 'vm' ? '虚拟内存' : '内存池';
        const date = new Date(exp.timestamp);
        
        row.innerHTML = `
            <div class="page-table-cell font-semibold">${escapeHtml(exp.name)}</div>
            <div class="page-table-cell">
                <span class="px-2 py-1 rounded text-xs ${exp.type === 'vm' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}">
                    ${typeText}
                </span>
            </div>
            <div class="page-table-cell text-sm">${date.toLocaleString()}</div>
            <div class="page-table-cell">
                <button class="text-blue-600 hover:text-blue-800 text-sm mr-2" onclick="loadExperiment('${exp.id}')">
                    加载
                </button>
                <button class="text-red-600 hover:text-red-800 text-sm" onclick="deleteExperiment('${exp.id}')">
                    删除
                </button>
            </div>
        `;
        table.appendChild(row);
        
        const option = document.createElement('option');
        option.value = exp.id;
        option.textContent = `${exp.name} (${typeText})`;
        compareSelect.appendChild(option);
    }
    
    container.innerHTML = '';
    container.appendChild(table);
}

function loadExperiment(id) {
    const savedExperiments = getSavedExperiments();
    const experiment = savedExperiments.find(e => e.id === id);
    
    if (!experiment) {
        alert('实验不存在');
        return;
    }
    
    if (experiment.type === 'vm') {
        switchTab('vm');
        
        document.getElementById('vm-page-size').value = experiment.config.pageSize;
        document.getElementById('vm-physical-frames').value = experiment.config.physicalFrames;
        document.getElementById('vm-tlb-size').value = experiment.config.tlbSize;
        document.getElementById('vm-replacement-policy').value = experiment.config.replacementPolicy;
        document.getElementById('vm-access-sequence').value = experiment.config.accessSequence.join(' ');
        document.getElementById('vm-random-seed').value = experiment.config.randomSeed || '';
        
        const result = {
            config: experiment.config,
            stats: experiment.stats,
            history: experiment.history,
            pageTable: experiment.extra.pageTable,
            tlb: experiment.extra.tlb,
            physicalMemory: experiment.extra.physicalMemory
        };
        
        currentVMResult = result;
        displayVMResults(result);
    } else {
        switchTab('pool');
        
        document.getElementById('pool-type').value = experiment.config.poolType;
        document.getElementById('pool-total-size').value = experiment.config.totalSize;
        document.getElementById('pool-object-size').value = experiment.config.objectSize;
        document.getElementById('pool-alignment').value = experiment.config.alignment;
        
        const opsStr = experiment.config.operations.map(op => {
            if (op.type === 'alloc') {
                return `alloc:${op.size}`;
            } else {
                return `free:${op.allocationId}`;
            }
        }).join(' ');
        document.getElementById('pool-operations').value = opsStr;
        
        const result = {
            config: experiment.config,
            stats: experiment.stats,
            history: experiment.history,
            pool: experiment.extra.pool,
            allocations: experiment.extra.allocations
        };
        
        currentPoolResult = result;
        displayPoolResults(result);
    }
    
    alert(`实验 "${experiment.name}" 已加载`);
}

function deleteExperiment(id) {
    const savedExperiments = getSavedExperiments();
    const index = savedExperiments.findIndex(e => e.id === id);
    
    if (index === -1) {
        alert('实验不存在');
        return;
    }
    
    const experiment = savedExperiments[index];
    
    if (!confirm(`确定要删除实验 "${experiment.name}" 吗？`)) {
        return;
    }
    
    savedExperiments.splice(index, 1);
    saveExperimentsToStorage(savedExperiments);
    loadSavedExperiments();
}

function compareExperiments() {
    const compareSelect = document.getElementById('compare-experiments');
    const selectedOptions = Array.from(compareSelect.selectedOptions);
    
    if (selectedOptions.length < 2) {
        alert('请至少选择两个实验进行对比');
        return;
    }
    
    const savedExperiments = getSavedExperiments();
    const selectedExperiments = selectedOptions.map(option => 
        savedExperiments.find(e => e.id === option.value)
    ).filter(Boolean);
    
    if (selectedExperiments.length < 2) {
        alert('无法找到选中的实验');
        return;
    }
    
    const types = new Set(selectedExperiments.map(e => e.type));
    if (types.size > 1) {
        alert('只能对比相同类型的实验（虚拟内存或内存池）');
        return;
    }
    
    displayComparisonResults(selectedExperiments);
}

function displayComparisonResults(experiments) {
    const container = document.getElementById('comparison-result');
    const content = document.getElementById('comparison-content');
    
    container.classList.remove('hidden');
    
    const isVM = experiments[0].type === 'vm';
    
    let html = '';
    
    html += '<div class="mb-6">';
    html += '<h3 class="text-lg font-semibold mb-4 text-gray-700">对比实验</h3>';
    html += '<div class="grid grid-cols-1 md:grid-cols-' + experiments.length + ' gap-4">';
    
    for (const exp of experiments) {
        const date = new Date(exp.timestamp);
        html += `
            <div class="bg-gray-50 p-4 rounded-lg">
                <h4 class="font-semibold text-gray-800">${escapeHtml(exp.name)}</h4>
                <p class="text-sm text-gray-500">${date.toLocaleString()}</p>
            </div>
        `;
    }
    html += '</div>';
    html += '</div>';
    
    html += '<div class="mb-6">';
    html += '<h3 class="text-lg font-semibold mb-4 text-gray-700">关键指标对比</h3>';
    html += '<div class="overflow-x-auto">';
    html += '<table class="min-w-full divide-y divide-gray-200">';
    html += '<thead class="bg-gray-50">';
    html += '<tr>';
    html += '<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">指标</th>';
    for (const exp of experiments) {
        html += `<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">${escapeHtml(exp.name)}</th>`;
    }
    html += '</tr>';
    html += '</thead>';
    html += '<tbody class="bg-white divide-y divide-gray-200">';
    
    if (isVM) {
        const metrics = [
            { key: 'tlbHitRate', label: 'TLB 命中率', format: v => v + '%' },
            { key: 'pageFaultRate', label: '缺页率', format: v => v + '%' },
            { key: 'totalAccesses', label: '总访问次数', format: v => v },
            { key: 'tlbHits', label: 'TLB 命中次数', format: v => v },
            { key: 'tlbMisses', label: 'TLB 未命中次数', format: v => v },
            { key: 'pageFaults', label: '缺页次数', format: v => v },
            { key: 'replacements', label: '置换次数', format: v => v }
        ];
        
        for (const metric of metrics) {
            html += '<tr>';
            html += `<td class="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">${metric.label}</td>`;
            for (const exp of experiments) {
                const value = exp.stats[metric.key];
                html += `<td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500">${metric.format(value)}</td>`;
            }
            html += '</tr>';
        }
    } else {
        const metrics = [
            { key: 'utilizationRate', label: '空间使用率', format: v => v + '%' },
            { key: 'internalFragmentationRate', label: '内部碎片率', format: v => v + '%' },
            { key: 'externalFragmentation', label: '外部碎片', format: v => Utils.formatBytes(v) },
            { key: 'totalAllocations', label: '总分配次数', format: v => v },
            { key: 'totalFrees', label: '总释放次数', format: v => v },
            { key: 'allocationFailures', label: '分配失败次数', format: v => v },
            { key: 'totalSlots', label: '总槽位数', format: v => v },
            { key: 'usedSlots', label: '已使用槽位', format: v => v },
            { key: 'freeSlots', label: '空闲槽位', format: v => v }
        ];
        
        for (const metric of metrics) {
            html += '<tr>';
            html += `<td class="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">${metric.label}</td>`;
            for (const exp of experiments) {
                const value = exp.stats[metric.key];
                html += `<td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500">${metric.format(value)}</td>`;
            }
            html += '</tr>';
        }
    }
    
    html += '</tbody>';
    html += '</table>';
    html += '</div>';
    html += '</div>';
    
    html += '<div class="mb-6">';
    html += '<h3 class="text-lg font-semibold mb-4 text-gray-700">配置对比</h3>';
    html += '<div class="overflow-x-auto">';
    html += '<table class="min-w-full divide-y divide-gray-200">';
    html += '<thead class="bg-gray-50">';
    html += '<tr>';
    html += '<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">配置项</th>';
    for (const exp of experiments) {
        html += `<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">${escapeHtml(exp.name)}</th>`;
    }
    html += '</tr>';
    html += '</thead>';
    html += '<tbody class="bg-white divide-y divide-gray-200">';
    
    if (isVM) {
        const configs = [
            { key: 'pageSize', label: '页大小', format: v => Utils.formatBytes(v) },
            { key: 'physicalFrames', label: '物理页数', format: v => v },
            { key: 'tlbSize', label: 'TLB 容量', format: v => v + ' 条' },
            { key: 'replacementPolicy', label: '置换策略', format: v => Utils.getPolicyName(v) }
        ];
        
        for (const config of configs) {
            html += '<tr>';
            html += `<td class="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">${config.label}</td>`;
            for (const exp of experiments) {
                const value = exp.config[config.key];
                html += `<td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500">${config.format(value)}</td>`;
            }
            html += '</tr>';
        }
    } else {
        const configs = [
            { key: 'poolType', label: '池类型', format: v => v === 'object' ? '对象池' : '内存池' },
            { key: 'totalSize', label: '总池大小', format: v => Utils.formatBytes(v) },
            { key: 'objectSize', label: '对象大小', format: v => Utils.formatBytes(v) },
            { key: 'alignment', label: '对齐规则', format: v => v + ' 字节' }
        ];
        
        for (const config of configs) {
            html += '<tr>';
            html += `<td class="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">${config.label}</td>`;
            for (const exp of experiments) {
                const value = exp.config[config.key];
                html += `<td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500">${config.format(value)}</td>`;
            }
            html += '</tr>';
        }
    }
    
    html += '</tbody>';
    html += '</table>';
    html += '</div>';
    html += '</div>';
    
    content.innerHTML = html;
}

function exportExperiment(format) {
    let experiment = null;
    let name = 'experiment';
    
    const vmResult = getCurrentVMResult();
    const poolResult = getCurrentPoolResult();
    
    if (vmResult) {
        experiment = {
            ...vmResult,
            type: 'vm',
            name: '虚拟内存实验',
            timestamp: Date.now()
        };
        name = 'virtual_memory_experiment';
    } else if (poolResult) {
        experiment = {
            ...poolResult,
            type: 'pool',
            name: '内存池实验',
            timestamp: Date.now()
        };
        name = 'memory_pool_experiment';
    } else {
        alert('请先运行虚拟内存或内存池模拟');
        return;
    }
    
    if (format === 'json') {
        const jsonContent = Utils.exportToJSON(experiment);
        Utils.downloadFile(jsonContent, `${name}_${Date.now()}.json`, 'application/json');
    } else {
        const markdownContent = Utils.exportToMarkdown(experiment);
        Utils.downloadFile(markdownContent, `${name}_${Date.now()}.md`, 'text/markdown');
    }
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
