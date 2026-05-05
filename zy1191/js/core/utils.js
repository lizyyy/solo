/**
 * 工具函数模块
 * 提供通用的辅助函数
 */

const Utils = {
    formatBytes(bytes, decimals = 2) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i];
    },
    
    parseAccessSequence(sequenceStr) {
        if (!sequenceStr || sequenceStr.trim() === '') {
            return [];
        }
        
        return sequenceStr.trim()
            .split(/\s+/)
            .map(addr => {
                const trimmed = addr.trim();
                if (trimmed.startsWith('0x') || trimmed.startsWith('0X')) {
                    return parseInt(trimmed, 16);
                }
                return parseInt(trimmed, 10);
            })
            .filter(addr => !isNaN(addr) && addr >= 0);
    },
    
    parsePoolOperations(operationsStr) {
        if (!operationsStr || operationsStr.trim() === '') {
            return [];
        }
        
        const operations = [];
        const parts = operationsStr.trim().split(/\s+/);
        
        for (let i = 0; i < parts.length; i++) {
            const part = parts[i].trim();
            if (part === '') continue;
            
            const colonIndex = part.indexOf(':');
            if (colonIndex === -1) continue;
            
            const operation = part.substring(0, colonIndex).toLowerCase();
            const valueStr = part.substring(colonIndex + 1);
            
            if (operation === 'alloc') {
                const size = parseInt(valueStr, 10);
                if (!isNaN(size) && size > 0) {
                    operations.push({ type: 'alloc', size });
                }
            } else if (operation === 'free') {
                const allocationId = parseInt(valueStr, 10);
                if (!isNaN(allocationId) && allocationId >= 0) {
                    operations.push({ type: 'free', allocationId });
                }
            }
        }
        
        return operations;
    },
    
    generateRandomAccessSequence(count, maxAddress, seed) {
        const random = this.seededRandom(seed);
        const sequence = [];
        
        for (let i = 0; i < count; i++) {
            sequence.push(Math.floor(random() * maxAddress));
        }
        
        return sequence;
    },
    
    seededRandom(seed) {
        if (seed === undefined || seed === null) {
            seed = Date.now();
        }
        
        let s = seed;
        return function() {
            s = (s * 9301 + 49297) % 233280;
            return s / 233280;
        };
    },
    
    exportToJSON(data) {
        return JSON.stringify(data, null, 2);
    },
    
    exportToMarkdown(experiment) {
        if (!experiment) {
            return '# 实验报告\n\n无效的实验数据';
        }
        
        let markdown = `# 实验报告\n\n`;
        markdown += `**实验名称**: ${experiment.name || '未命名'}\n\n`;
        markdown += `**实验类型**: ${experiment.type === 'vm' ? '虚拟内存模拟' : '内存池模拟'}\n\n`;
        markdown += `**创建时间**: ${new Date(experiment.timestamp).toLocaleString()}\n\n`;
        markdown += `---\n\n`;
        
        if (experiment.type === 'vm') {
            markdown += `## 实验配置\n\n`;
            markdown += `| 参数 | 值 |\n`;
            markdown += `|------|-----|\n`;
            markdown += `| 页大小 | ${this.formatBytes(experiment.config.pageSize)} |\n`;
            markdown += `| 物理页数 | ${experiment.config.physicalFrames} |\n`;
            markdown += `| TLB 容量 | ${experiment.config.tlbSize} 条 |\n`;
            markdown += `| 置换策略 | ${this.getPolicyName(experiment.config.replacementPolicy)} |\n\n`;
            
            markdown += `## 实验结果\n\n`;
            markdown += `### 统计信息\n\n`;
            markdown += `| 指标 | 值 |\n`;
            markdown += `|------|-----|\n`;
            markdown += `| 总访问次数 | ${experiment.stats.totalAccesses} |\n`;
            markdown += `| TLB 命中次数 | ${experiment.stats.tlbHits} |\n`;
            markdown += `| TLB 命中率 | ${experiment.stats.tlbHitRate}% |\n`;
            markdown += `| 缺页次数 | ${experiment.stats.pageFaults} |\n`;
            markdown += `| 缺页率 | ${experiment.stats.pageFaultRate}% |\n`;
            markdown += `| 置换次数 | ${experiment.stats.replacements} |\n\n`;
            
            markdown += `### 访问序列\n\n`;
            markdown += `\`\`\`\n${experiment.config.accessSequence.join(' ')}\n\`\`\`\n\n`;
            
            markdown += `### 访问时间线\n\n`;
            for (const entry of experiment.history) {
                const status = [];
                if (entry.tlbHit) status.push('TLB命中');
                if (entry.pageFault) status.push('缺页');
                if (entry.replacement) status.push('置换');
                if (status.length === 0) status.push('正常');
                
                markdown += `- **时间 ${entry.time}**: 虚拟地址 ${entry.virtualAddress} (页${entry.pageNumber}, 偏移${entry.offset}) -> 物理帧 ${entry.physicalFrame} [${status.join(', ')}]`;
                if (entry.evictedPage !== null) {
                    markdown += ` (置换页${entry.evictedPage})`;
                }
                markdown += `\n`;
            }
        } else {
            markdown += `## 实验配置\n\n`;
            markdown += `| 参数 | 值 |\n`;
            markdown += `|------|-----|\n`;
            markdown += `| 池类型 | ${experiment.config.poolType === 'object' ? '对象池' : '内存池'} |\n`;
            markdown += `| 总池大小 | ${this.formatBytes(experiment.config.totalSize)} |\n`;
            markdown += `| 对象/块大小 | ${this.formatBytes(experiment.config.objectSize)} |\n`;
            markdown += `| 对齐规则 | ${experiment.config.alignment} 字节 |\n\n`;
            
            markdown += `## 实验结果\n\n`;
            markdown += `### 统计信息\n\n`;
            markdown += `| 指标 | 值 |\n`;
            markdown += `|------|-----|\n`;
            markdown += `| 总分配次数 | ${experiment.stats.totalAllocations} |\n`;
            markdown += `| 总释放次数 | ${experiment.stats.totalFrees} |\n`;
            markdown += `| 分配失败次数 | ${experiment.stats.allocationFailures} |\n`;
            markdown += `| 空间使用率 | ${experiment.stats.utilizationRate}% |\n`;
            markdown += `| 内部碎片率 | ${experiment.stats.internalFragmentationRate}% |\n`;
            markdown += `| 外部碎片 | ${this.formatBytes(experiment.stats.externalFragmentation)} |\n`;
            markdown += `| 总槽位数 | ${experiment.stats.totalSlots} |\n`;
            markdown += `| 已使用槽位 | ${experiment.stats.usedSlots} |\n`;
            markdown += `| 空闲槽位 | ${experiment.stats.freeSlots} |\n\n`;
            
            markdown += `### 操作时间线\n\n`;
            for (const entry of experiment.history) {
                if (entry.operation === 'alloc') {
                    markdown += `- **时间 ${entry.time}**: 分配 ${entry.requestedSize} 字节`;
                    if (entry.success) {
                        markdown += ` -> 成功 (分配ID: ${entry.allocationId}, 偏移: ${entry.offset}, 实际大小: ${entry.actualSize}, 填充: ${entry.padding})`;
                    } else {
                        markdown += ` -> 失败 (${entry.error})`;
                    }
                } else {
                    markdown += `- **时间 ${entry.time}**: 释放 分配ID ${entry.allocationId}`;
                    if (entry.success) {
                        markdown += ` -> 成功 (槽位: ${entry.slotIndex}, 偏移: ${entry.offset}, 大小: ${entry.size})`;
                    } else {
                        markdown += ` -> 失败 (${entry.error})`;
                    }
                }
                markdown += `\n`;
            }
        }
        
        markdown += `\n---\n\n`;
        markdown += `*此报告由虚拟内存和内存池实验台自动生成*\n`;
        
        return markdown;
    },
    
    getPolicyName(policy) {
        const policyNames = {
            'fifo': 'FIFO (先进先出)',
            'lru': 'LRU (最近最少使用)',
            'optimal': 'Optimal (最优)'
        };
        return policyNames[policy] || policy;
    },
    
    downloadFile(content, filename, type) {
        const blob = new Blob([content], { type: type });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Utils;
}
