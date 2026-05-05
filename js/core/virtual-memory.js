/**
 * 虚拟内存模拟核心模块
 * 实现虚拟地址翻译、页表管理、TLB缓存、置换算法
 */

class VirtualMemorySimulator {
    constructor(config) {
        this.pageSize = config.pageSize || 4096;
        this.physicalFrames = config.physicalFrames || 4;
        this.tlbSize = config.tlbSize || 4;
        this.replacementPolicy = config.replacementPolicy || 'lru';
        this.accessSequence = config.accessSequence || [];
        this.randomSeed = config.randomSeed || Date.now();
        
        this.reset();
    }
    
    reset() {
        this.pageTable = new Map();
        this.tlb = new Map();
        this.physicalMemory = new Array(this.physicalFrames).fill(null);
        this.frameUsage = new Map();
        this.tlbUsage = new Map();
        this.time = 0;
        
        this.stats = {
            totalAccesses: 0,
            tlbHits: 0,
            tlbMisses: 0,
            pageFaults: 0,
            replacements: 0
        };
        
        this.history = [];
    }
    
    getPageNumber(virtualAddress) {
        return Math.floor(virtualAddress / this.pageSize);
    }
    
    getOffset(virtualAddress) {
        return virtualAddress % this.pageSize;
    }
    
    translateAddress(virtualAddress) {
        const pageNumber = this.getPageNumber(virtualAddress);
        const offset = this.getOffset(virtualAddress);
        
        this.time++;
        this.stats.totalAccesses++;
        
        const historyEntry = {
            time: this.time,
            virtualAddress,
            pageNumber,
            offset,
            tlbHit: false,
            pageFault: false,
            replacement: false,
            evictedPage: null,
            physicalFrame: null
        };
        
        let physicalFrame = null;
        
        if (this.tlbSize > 0 && this.tlb.has(pageNumber)) {
            this.stats.tlbHits++;
            historyEntry.tlbHit = true;
            physicalFrame = this.tlb.get(pageNumber);
            this.tlbUsage.set(pageNumber, this.time);
        } else {
            if (this.tlbSize > 0) {
                this.stats.tlbMisses++;
            }
            
            if (this.pageTable.has(pageNumber) && this.pageTable.get(pageNumber).valid) {
                physicalFrame = this.pageTable.get(pageNumber).frame;
                this.updateTLB(pageNumber, physicalFrame);
            } else {
                this.stats.pageFaults++;
                historyEntry.pageFault = true;
                
                const freeFrame = this.findFreeFrame();
                if (freeFrame !== null) {
                    physicalFrame = freeFrame;
                    this.loadPage(pageNumber, physicalFrame);
                    this.updateTLB(pageNumber, physicalFrame);
                } else {
                    this.stats.replacements++;
                    historyEntry.replacement = true;
                    
                    const evictedPage = this.selectVictimPage();
                    historyEntry.evictedPage = evictedPage;
                    
                    physicalFrame = this.pageTable.get(evictedPage).frame;
                    this.unloadPage(evictedPage);
                    this.loadPage(pageNumber, physicalFrame);
                    this.updateTLB(pageNumber, physicalFrame);
                }
            }
        }
        
        if (physicalFrame !== null) {
            this.frameUsage.set(physicalFrame, this.time);
            if (this.pageTable.has(pageNumber)) {
                this.pageTable.get(pageNumber).lastUsed = this.time;
            }
            historyEntry.physicalFrame = physicalFrame;
        }
        
        this.history.push(historyEntry);
        
        return {
            physicalAddress: physicalFrame * this.pageSize + offset,
            physicalFrame,
            offset,
            ...historyEntry
        };
    }
    
    findFreeFrame() {
        for (let i = 0; i < this.physicalFrames; i++) {
            if (this.physicalMemory[i] === null) {
                return i;
            }
        }
        return null;
    }
    
    selectVictimPage() {
        const residentPages = [];
        for (const [pageNumber, entry] of this.pageTable) {
            if (entry.valid) {
                residentPages.push({
                    pageNumber,
                    frame: entry.frame,
                    loadedTime: entry.loadedTime,
                    lastUsed: entry.lastUsed
                });
            }
        }
        
        if (residentPages.length === 0) {
            return null;
        }
        
        switch (this.replacementPolicy) {
            case 'fifo':
                return this.selectVictimFIFO(residentPages);
            case 'lru':
                return this.selectVictimLRU(residentPages);
            case 'optimal':
                return this.selectVictimOptimal(residentPages);
            default:
                return this.selectVictimLRU(residentPages);
        }
    }
    
    selectVictimFIFO(residentPages) {
        let earliest = residentPages[0];
        for (const page of residentPages) {
            if (page.loadedTime < earliest.loadedTime) {
                earliest = page;
            }
        }
        return earliest.pageNumber;
    }
    
    selectVictimLRU(residentPages) {
        let leastRecentlyUsed = residentPages[0];
        for (const page of residentPages) {
            if (page.lastUsed < leastRecentlyUsed.lastUsed) {
                leastRecentlyUsed = page;
            }
        }
        return leastRecentlyUsed.pageNumber;
    }
    
    selectVictimOptimal(residentPages) {
        const currentIndex = this.history.length;
        const remainingAccesses = this.accessSequence.slice(currentIndex + 1);
        const futurePageNumbers = remainingAccesses.map(addr => this.getPageNumber(addr));
        
        let victim = null;
        let maxFutureUse = -1;
        
        for (const page of residentPages) {
            const nextUse = futurePageNumbers.indexOf(page.pageNumber);
            if (nextUse === -1) {
                return page.pageNumber;
            }
            if (nextUse > maxFutureUse) {
                maxFutureUse = nextUse;
                victim = page.pageNumber;
            }
        }
        
        return victim !== null ? victim : residentPages[0].pageNumber;
    }
    
    loadPage(pageNumber, frame) {
        this.physicalMemory[frame] = pageNumber;
        
        if (!this.pageTable.has(pageNumber)) {
            this.pageTable.set(pageNumber, {
                valid: true,
                frame: frame,
                loadedTime: this.time,
                lastUsed: this.time
            });
        } else {
            this.pageTable.get(pageNumber).valid = true;
            this.pageTable.get(pageNumber).frame = frame;
            this.pageTable.get(pageNumber).loadedTime = this.time;
            this.pageTable.get(pageNumber).lastUsed = this.time;
        }
        
        this.frameUsage.set(frame, this.time);
    }
    
    unloadPage(pageNumber) {
        if (this.pageTable.has(pageNumber)) {
            const frame = this.pageTable.get(pageNumber).frame;
            this.pageTable.get(pageNumber).valid = false;
            this.physicalMemory[frame] = null;
            this.frameUsage.delete(frame);
            
            if (this.tlb.has(pageNumber)) {
                this.tlb.delete(pageNumber);
                this.tlbUsage.delete(pageNumber);
            }
        }
    }
    
    updateTLB(pageNumber, frame) {
        if (this.tlbSize === 0) return;
        
        if (this.tlb.has(pageNumber)) {
            this.tlbUsage.set(pageNumber, this.time);
            return;
        }
        
        if (this.tlb.size >= this.tlbSize) {
            const tlbEntries = Array.from(this.tlb.keys());
            let victim = tlbEntries[0];
            let oldestTime = this.tlbUsage.get(victim);
            
            for (const entry of tlbEntries) {
                const entryTime = this.tlbUsage.get(entry);
                if (entryTime < oldestTime) {
                    oldestTime = entryTime;
                    victim = entry;
                }
            }
            
            this.tlb.delete(victim);
            this.tlbUsage.delete(victim);
        }
        
        this.tlb.set(pageNumber, frame);
        this.tlbUsage.set(pageNumber, this.time);
    }
    
    run() {
        this.reset();
        
        for (const address of this.accessSequence) {
            this.translateAddress(address);
        }
        
        return this.getResults();
    }
    
    getResults() {
        return {
            config: {
                pageSize: this.pageSize,
                physicalFrames: this.physicalFrames,
                tlbSize: this.tlbSize,
                replacementPolicy: this.replacementPolicy,
                accessSequence: [...this.accessSequence],
                randomSeed: this.randomSeed
            },
            stats: {
                ...this.stats,
                tlbHitRate: this.stats.totalAccesses > 0 && this.tlbSize > 0 
                    ? (this.stats.tlbHits / this.stats.totalAccesses * 100).toFixed(2)
                    : 0,
                pageFaultRate: this.stats.totalAccesses > 0 
                    ? (this.stats.pageFaults / this.stats.totalAccesses * 100).toFixed(2)
                    : 0
            },
            history: [...this.history],
            pageTable: Array.from(this.pageTable.entries()).map(([pageNumber, entry]) => ({
                pageNumber,
                ...entry
            })),
            tlb: Array.from(this.tlb.entries()).map(([pageNumber, frame]) => ({
                pageNumber,
                frame,
                lastUsed: this.tlbUsage.get(pageNumber)
            })),
            physicalMemory: [...this.physicalMemory]
        };
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = VirtualMemorySimulator;
}
