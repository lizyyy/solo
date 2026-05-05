/**
 * 内存池和对象池模拟核心模块
 * 实现内存分配、释放、对齐、碎片统计等功能
 */

class MemoryPoolSimulator {
    constructor(config) {
        this.poolType = config.poolType || 'object';
        this.totalSize = config.totalSize || 65536;
        this.objectSize = config.objectSize || 256;
        this.alignment = config.alignment || 4;
        this.operations = config.operations || [];
        
        this.reset();
    }
    
    reset() {
        this.pool = [];
        this.freeBlocks = [];
        this.usedBlocks = [];
        this.allocations = [];
        
        this.stats = {
            totalAllocations: 0,
            totalFrees: 0,
            allocationFailures: 0,
            usedBytes: 0,
            paddingBytes: 0,
            internalFragmentation: 0,
            externalFragmentation: 0
        };
        
        this.history = [];
        this.time = 0;
        
        this.initializePool();
    }
    
    initializePool() {
        if (this.poolType === 'object') {
            const alignedObjectSize = this.alignUp(this.objectSize, this.alignment);
            const maxObjects = Math.floor(this.totalSize / alignedObjectSize);
            
            for (let i = 0; i < maxObjects; i++) {
                const slot = {
                    index: i,
                    offset: i * alignedObjectSize,
                    size: alignedObjectSize,
                    used: false,
                    allocationId: null,
                    requestedSize: null,
                    padding: 0
                };
                this.pool.push(slot);
                this.freeBlocks.push(slot);
            }
            
            const actualUsed = maxObjects * alignedObjectSize;
            if (actualUsed < this.totalSize) {
                this.stats.paddingBytes += (this.totalSize - actualUsed);
            }
        } else {
            const initialBlock = {
                index: 0,
                offset: 0,
                size: this.totalSize,
                used: false,
                allocationId: null,
                requestedSize: null,
                padding: 0
            };
            this.pool.push(initialBlock);
            this.freeBlocks.push(initialBlock);
        }
    }
    
    alignUp(size, alignment) {
        if (alignment <= 1) return size;
        const remainder = size % alignment;
        if (remainder === 0) return size;
        return size + (alignment - remainder);
    }
    
    alignDown(size, alignment) {
        if (alignment <= 1) return size;
        return Math.floor(size / alignment) * alignment;
    }
    
    allocate(requestedSize) {
        this.time++;
        const historyEntry = {
            time: this.time,
            operation: 'alloc',
            requestedSize,
            success: false,
            allocationId: null,
            slotIndex: null,
            offset: null,
            actualSize: null,
            padding: null
        };
        
        if (requestedSize <= 0) {
            this.stats.allocationFailures++;
            historyEntry.error = 'Invalid size';
            this.history.push(historyEntry);
            return null;
        }
        
        if (this.poolType === 'object') {
            if (requestedSize > this.objectSize) {
                this.stats.allocationFailures++;
                historyEntry.error = 'Size exceeds object size';
                this.history.push(historyEntry);
                return null;
            }
            
            if (this.freeBlocks.length === 0) {
                this.stats.allocationFailures++;
                historyEntry.error = 'No free slots available';
                this.history.push(historyEntry);
                return null;
            }
            
            const slot = this.freeBlocks.shift();
            const alignedSize = this.alignUp(requestedSize, this.alignment);
            const padding = slot.size - alignedSize;
            
            slot.used = true;
            slot.requestedSize = requestedSize;
            slot.padding = padding;
            slot.allocationId = this.stats.totalAllocations;
            
            this.usedBlocks.push(slot);
            this.allocations.push({
                id: slot.allocationId,
                slotIndex: slot.index,
                offset: slot.offset,
                size: alignedSize,
                requestedSize,
                padding
            });
            
            this.stats.totalAllocations++;
            this.stats.usedBytes += alignedSize;
            this.stats.paddingBytes += padding;
            this.stats.internalFragmentation += padding;
            
            historyEntry.success = true;
            historyEntry.allocationId = slot.allocationId;
            historyEntry.slotIndex = slot.index;
            historyEntry.offset = slot.offset;
            historyEntry.actualSize = alignedSize;
            historyEntry.padding = padding;
        } else {
            const alignedSize = this.alignUp(requestedSize, this.alignment);
            
            let bestFit = null;
            let bestFitIndex = -1;
            
            for (let i = 0; i < this.freeBlocks.length; i++) {
                const block = this.freeBlocks[i];
                if (block.size >= alignedSize) {
                    if (bestFit === null || block.size < bestFit.size) {
                        bestFit = block;
                        bestFitIndex = i;
                    }
                }
            }
            
            if (bestFit === null) {
                this.stats.allocationFailures++;
                historyEntry.error = 'No free block large enough';
                this.history.push(historyEntry);
                return null;
            }
            
            this.freeBlocks.splice(bestFitIndex, 1);
            
            const padding = bestFit.size - alignedSize;
            const allocationId = this.stats.totalAllocations;
            
            bestFit.used = true;
            bestFit.requestedSize = requestedSize;
            bestFit.padding = 0;
            bestFit.allocationId = allocationId;
            
            if (padding > 0) {
                const originalOffset = bestFit.offset;
                const originalSize = bestFit.size;
                
                bestFit.size = alignedSize;
                
                const remainingBlock = {
                    index: this.pool.length,
                    offset: originalOffset + alignedSize,
                    size: padding,
                    used: false,
                    allocationId: null,
                    requestedSize: null,
                    padding: 0
                };
                
                this.pool.push(remainingBlock);
                this.freeBlocks.push(remainingBlock);
                
                const insertIndex = this.pool.findIndex(b => b.index === bestFit.index);
                if (insertIndex !== -1) {
                    this.pool.splice(insertIndex + 1, 0, remainingBlock);
                    this.pool.splice(this.pool.length - 1, 1);
                }
            }
            
            this.usedBlocks.push(bestFit);
            this.allocations.push({
                id: allocationId,
                slotIndex: bestFit.index,
                offset: bestFit.offset,
                size: alignedSize,
                requestedSize,
                padding: 0
            });
            
            this.stats.totalAllocations++;
            this.stats.usedBytes += alignedSize;
            
            historyEntry.success = true;
            historyEntry.allocationId = allocationId;
            historyEntry.slotIndex = bestFit.index;
            historyEntry.offset = bestFit.offset;
            historyEntry.actualSize = alignedSize;
            historyEntry.padding = 0;
        }
        
        this.history.push(historyEntry);
        return historyEntry;
    }
    
    free(allocationId) {
        this.time++;
        const historyEntry = {
            time: this.time,
            operation: 'free',
            allocationId,
            success: false,
            slotIndex: null,
            offset: null,
            size: null
        };
        
        const allocationIndex = this.allocations.findIndex(a => a.id === allocationId);
        if (allocationIndex === -1) {
            historyEntry.error = 'Allocation not found';
            this.history.push(historyEntry);
            return null;
        }
        
        const allocation = this.allocations[allocationIndex];
        const slot = this.pool.find(s => s.index === allocation.slotIndex);
        
        if (!slot || !slot.used) {
            historyEntry.error = 'Slot not found or already free';
            this.history.push(historyEntry);
            return null;
        }
        
        slot.used = false;
        slot.allocationId = null;
        slot.requestedSize = null;
        
        if (this.poolType === 'object') {
            this.stats.usedBytes -= slot.size;
            this.stats.internalFragmentation -= slot.padding;
            this.stats.paddingBytes -= slot.padding;
        } else {
            this.stats.usedBytes -= slot.size;
        }
        
        slot.padding = 0;
        
        const usedIndex = this.usedBlocks.findIndex(b => b.index === slot.index);
        if (usedIndex !== -1) {
            this.usedBlocks.splice(usedIndex, 1);
        }
        
        this.freeBlocks.push(slot);
        this.freeBlocks.sort((a, b) => a.offset - b.offset);
        
        if (this.poolType === 'memory') {
            this.mergeAdjacentFreeBlocks();
        }
        
        this.allocations.splice(allocationIndex, 1);
        this.stats.totalFrees++;
        
        historyEntry.success = true;
        historyEntry.slotIndex = slot.index;
        historyEntry.offset = slot.offset;
        historyEntry.size = slot.size;
        
        this.history.push(historyEntry);
        return historyEntry;
    }
    
    mergeAdjacentFreeBlocks() {
        if (this.freeBlocks.length < 2) return;
        
        this.freeBlocks.sort((a, b) => a.offset - b.offset);
        
        let merged = true;
        while (merged) {
            merged = false;
            
            for (let i = 0; i < this.freeBlocks.length - 1; i++) {
                const current = this.freeBlocks[i];
                const next = this.freeBlocks[i + 1];
                
                if (current.offset + current.size === next.offset) {
                    current.size += next.size;
                    
                    const nextIndex = this.pool.findIndex(b => b.index === next.index);
                    if (nextIndex !== -1) {
                        this.pool.splice(nextIndex, 1);
                    }
                    
                    this.freeBlocks.splice(i + 1, 1);
                    merged = true;
                    break;
                }
            }
        }
    }
    
    calculateExternalFragmentation() {
        if (this.poolType === 'object') return 0;
        
        let totalFree = 0;
        let maxFreeBlock = 0;
        
        for (const block of this.freeBlocks) {
            totalFree += block.size;
            if (block.size > maxFreeBlock) {
                maxFreeBlock = block.size;
            }
        }
        
        if (totalFree === 0) return 0;
        return totalFree - maxFreeBlock;
    }
    
    run() {
        this.reset();
        
        for (const operation of this.operations) {
            if (operation.type === 'alloc') {
                this.allocate(operation.size);
            } else if (operation.type === 'free') {
                this.free(operation.allocationId);
            }
        }
        
        this.stats.externalFragmentation = this.calculateExternalFragmentation();
        
        return this.getResults();
    }
    
    getResults() {
        this.stats.externalFragmentation = this.calculateExternalFragmentation();
        
        const totalBytes = this.poolType === 'object' 
            ? this.pool.length * (this.pool.length > 0 ? this.pool[0].size : 0)
            : this.totalSize;
        
        const usedRatio = totalBytes > 0 ? (this.stats.usedBytes / totalBytes * 100).toFixed(2) : 0;
        const internalFragmentationRate = totalBytes > 0 
            ? (this.stats.internalFragmentation / totalBytes * 100).toFixed(2) 
            : 0;
        
        return {
            config: {
                poolType: this.poolType,
                totalSize: this.totalSize,
                objectSize: this.objectSize,
                alignment: this.alignment,
                operations: [...this.operations]
            },
            stats: {
                ...this.stats,
                utilizationRate: usedRatio,
                internalFragmentationRate: internalFragmentationRate,
                totalSlots: this.pool.length,
                usedSlots: this.usedBlocks.length,
                freeSlots: this.freeBlocks.length
            },
            history: [...this.history],
            pool: this.pool.map(slot => ({
                ...slot
            })),
            allocations: [...this.allocations]
        };
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = MemoryPoolSimulator;
}
