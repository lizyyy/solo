import { KeyType, ValueType, IndexStats, OperationResult, OperationStep, HashVisualization, HashBucketVisual, HashEntryVisual } from '../types';

interface HashEntry {
  key: KeyType;
  value: ValueType;
  hash: number;
  next: HashEntry | null;
}

class HashBucket {
  id: number;
  entries: HashEntry | null;
  count: number;

  constructor(id: number) {
    this.id = id;
    this.entries = null;
    this.count = 0;
  }
}

export class HashIndex {
  private buckets: HashBucket[];
  private entryCount: number;
  private loadFactor: number;
  private initialBucketCount: number;
  private stats: IndexStats;
  private steps: OperationStep[];
  private bucketCounter: number;

  constructor(initialBuckets: number = 16, loadFactor: number = 0.75) {
    this.initialBucketCount = initialBuckets;
    this.buckets = this.createBuckets(initialBuckets);
    this.entryCount = 0;
    this.loadFactor = loadFactor;
    this.bucketCounter = initialBuckets;
    this.stats = this.createEmptyStats();
    this.steps = [];
  }

  private createBuckets(count: number): HashBucket[] {
    const buckets: HashBucket[] = [];
    for (let i = 0; i < count; i++) {
      buckets.push(new HashBucket(i));
    }
    return buckets;
  }

  private createEmptyStats(): IndexStats {
    return {
      pageAccesses: 0,
      bucketConflicts: 0,
      tableLookups: 0,
      estimatedTime: 0,
    };
  }

  private addStep(type: OperationStep['type'], description: string, bucketId?: number): void {
    this.steps.push({
      type,
      bucketId,
      description,
      timestamp: Date.now(),
    });
  }

  private readBucket(bucket: HashBucket): void {
    this.stats.pageAccesses++;
    this.stats.estimatedTime += 5;
    this.addStep('read', `读取桶 ${bucket.id}`, bucket.id);
  }

  private writeBucket(bucket: HashBucket): void {
    this.stats.pageAccesses++;
    this.stats.estimatedTime += 10;
    this.addStep('write', `写入桶 ${bucket.id}`, bucket.id);
  }

  private hash(key: KeyType): number {
    let hashValue = 0;
    const keyStr = String(key);
    
    for (let i = 0; i < keyStr.length; i++) {
      const char = keyStr.charCodeAt(i);
      hashValue = ((hashValue << 5) - hashValue) + char;
      hashValue = hashValue & hashValue;
    }
    
    return Math.abs(hashValue);
  }

  private getBucketIndex(hash: number): number {
    return hash % this.buckets.length;
  }

  private compareKeys(a: KeyType, b: KeyType): boolean {
    if (typeof a === 'number' && typeof b === 'number') {
      return a === b;
    }
    return String(a) === String(b);
  }

  search(key: KeyType): OperationResult {
    this.stats = this.createEmptyStats();
    this.steps = [];

    const hash = this.hash(key);
    const bucketIndex = this.getBucketIndex(hash);
    const bucket = this.buckets[bucketIndex];

    this.addStep('lookup', `开始等值查询: key = ${key}, hash = ${hash}, bucket = ${bucketIndex}`);
    this.readBucket(bucket);

    let current = bucket.entries;
    let chainPosition = 0;

    while (current) {
      chainPosition++;
      
      if (this.compareKeys(current.key, key)) {
        this.stats.tableLookups++;
        this.stats.estimatedTime += 2;
        this.addStep('lookup', `在桶 ${bucketIndex} 的链表第 ${chainPosition} 位找到 key = ${key}，进行回表查询`, bucketIndex);
        return {
          success: true,
          key,
          value: current.value,
          stats: { ...this.stats },
          steps: [...this.steps],
          message: `等值查询成功，找到 key = ${key}`,
        };
      }

      if (chainPosition > 1) {
        this.stats.bucketConflicts++;
        this.stats.estimatedTime += 3;
        this.addStep('conflict', `哈希冲突！在桶 ${bucketIndex} 继续遍历链表第 ${chainPosition} 位`, bucketIndex);
      }

      current = current.next;
    }

    return {
      success: false,
      key,
      stats: { ...this.stats },
      steps: [...this.steps],
      message: `等值查询失败，未找到 key = ${key}`,
    };
  }

  rangeSearch(_startKey: KeyType, _endKey: KeyType): OperationResult {
    this.stats = this.createEmptyStats();
    this.steps = [];

    this.addStep('lookup', `范围查询不适合哈希索引，需要全表扫描`);

    this.stats.pageAccesses = this.buckets.length;
    this.stats.estimatedTime = this.buckets.length * 5 + this.entryCount * 2;
    this.stats.tableLookups = this.entryCount;

    this.addStep('lookup', `需要扫描 ${this.buckets.length} 个桶和 ${this.entryCount} 条记录`);

    return {
      success: false,
      stats: { ...this.stats },
      steps: [...this.steps],
      message: `范围查询对哈希索引效率极低，需要全表扫描`,
    };
  }

  prefixSearch(_prefix: string): OperationResult {
    this.stats = this.createEmptyStats();
    this.steps = [];

    this.addStep('lookup', `前缀查询不适合哈希索引，需要全表扫描`);

    this.stats.pageAccesses = this.buckets.length;
    this.stats.estimatedTime = this.buckets.length * 5 + this.entryCount * 2;
    this.stats.tableLookups = this.entryCount;

    this.addStep('lookup', `需要扫描 ${this.buckets.length} 个桶和 ${this.entryCount} 条记录`);

    return {
      success: false,
      stats: { ...this.stats },
      steps: [...this.steps],
      message: `前缀查询对哈希索引效率极低，需要全表扫描`,
    };
  }

  insert(key: KeyType, value: ValueType): OperationResult {
    this.stats = this.createEmptyStats();
    this.steps = [];

    const hash = this.hash(key);
    const bucketIndex = this.getBucketIndex(hash);
    const bucket = this.buckets[bucketIndex];

    this.addStep('write', `开始插入: key = ${key}, hash = ${hash}, bucket = ${bucketIndex}`);
    this.readBucket(bucket);

    let current = bucket.entries;
    let chainPosition = 0;

    while (current) {
      chainPosition++;
      
      if (this.compareKeys(current.key, key)) {
        current.value = value;
        this.writeBucket(bucket);
        this.addStep('write', `更新已存在的 key = ${key}`, bucketIndex);
        return {
          success: true,
          key,
          value,
          stats: { ...this.stats },
          steps: [...this.steps],
          message: `更新 key = ${key} 成功`,
        };
      }

      if (chainPosition > 1) {
        this.stats.bucketConflicts++;
        this.stats.estimatedTime += 3;
        this.addStep('conflict', `哈希冲突！在桶 ${bucketIndex} 遍历链表第 ${chainPosition} 位`, bucketIndex);
      }

      current = current.next;
    }

    const newEntry: HashEntry = {
      key,
      value,
      hash,
      next: bucket.entries,
    };

    bucket.entries = newEntry;
    bucket.count++;
    this.entryCount++;
    this.writeBucket(bucket);

    if (bucket.count > 1) {
      this.stats.bucketConflicts++;
      this.addStep('conflict', `新插入的 key = ${key} 与桶 ${bucketIndex} 中已有 ${bucket.count - 1} 个元素发生哈希冲突`, bucketIndex);
    }

    const currentLoadFactor = this.entryCount / this.buckets.length;
    this.addStep('write', `插入完成，当前负载因子: ${currentLoadFactor.toFixed(2)}, 阈值: ${this.loadFactor}`);

    if (currentLoadFactor >= this.loadFactor) {
      this.resize();
    }

    return {
      success: true,
      key,
      value,
      stats: { ...this.stats },
      steps: [...this.steps],
      message: `插入 key = ${key} 成功`,
    };
  }

  private resize(): void {
    const oldBucketCount = this.buckets.length;
    const newBucketCount = oldBucketCount * 2;

    this.addStep('resize', `开始扩容: ${oldBucketCount} -> ${newBucketCount} 个桶`);

    const oldBuckets = this.buckets;
    this.buckets = this.createBuckets(newBucketCount);
    this.bucketCounter = newBucketCount;
    this.entryCount = 0;

    for (const bucket of oldBuckets) {
      this.readBucket(bucket);
      
      let current = bucket.entries;
      while (current) {
        const next = current.next;
        
        const newBucketIndex = this.getBucketIndex(current.hash);
        const newBucket = this.buckets[newBucketIndex];

        this.readBucket(newBucket);

        current.next = newBucket.entries;
        newBucket.entries = current;
        newBucket.count++;
        this.entryCount++;

        this.writeBucket(newBucket);

        if (newBucket.count > 1) {
          this.stats.bucketConflicts++;
          this.addStep('conflict', `重哈希时 key = ${current.key} 在新桶 ${newBucketIndex} 发生冲突`, newBucketIndex);
        }

        current = next;
      }
    }

    const newLoadFactor = this.entryCount / this.buckets.length;
    this.addStep('resize', `扩容完成，新负载因子: ${newLoadFactor.toFixed(2)}`);
  }

  delete(key: KeyType): OperationResult {
    this.stats = this.createEmptyStats();
    this.steps = [];

    const hash = this.hash(key);
    const bucketIndex = this.getBucketIndex(hash);
    const bucket = this.buckets[bucketIndex];

    this.addStep('write', `开始删除: key = ${key}, hash = ${hash}, bucket = ${bucketIndex}`);
    this.readBucket(bucket);

    let current = bucket.entries;
    let prev: HashEntry | null = null;
    let chainPosition = 0;

    while (current) {
      chainPosition++;

      if (this.compareKeys(current.key, key)) {
        if (prev === null) {
          bucket.entries = current.next;
        } else {
          prev.next = current.next;
        }

        bucket.count--;
        this.entryCount--;
        this.stats.tableLookups++;
        this.writeBucket(bucket);

        this.addStep('write', `删除成功: key = ${key} 在桶 ${bucketIndex} 的链表第 ${chainPosition} 位`, bucketIndex);

        return {
          success: true,
          key,
          stats: { ...this.stats },
          steps: [...this.steps],
          message: `删除 key = ${key} 成功`,
        };
      }

      if (chainPosition > 1) {
        this.stats.bucketConflicts++;
        this.stats.estimatedTime += 3;
        this.addStep('conflict', `哈希冲突！在桶 ${bucketIndex} 继续遍历链表第 ${chainPosition} 位`, bucketIndex);
      }

      prev = current;
      current = current.next;
    }

    return {
      success: false,
      key,
      stats: { ...this.stats },
      steps: [...this.steps],
      message: `删除失败，未找到 key = ${key}`,
    };
  }

  getVisualization(): HashVisualization {
    const buckets: HashBucketVisual[] = [];
    let maxChainLength = 0;
    let totalChainLength = 0;

    for (const bucket of this.buckets) {
      const entries: HashEntryVisual[] = [];
      let current = bucket.entries;
      
      while (current) {
        entries.push({
          key: current.key,
          valuePointer: current.hash,
          hash: current.hash,
        });
        current = current.next;
      }

      const chainLength = entries.length;
      maxChainLength = Math.max(maxChainLength, chainLength);
      totalChainLength += chainLength;

      buckets.push({
        id: bucket.id,
        entries,
        chainLength,
        isOverflow: chainLength > 3,
      });
    }

    const avgChainLength = this.buckets.length > 0 ? totalChainLength / this.buckets.length : 0;

    return {
      buckets,
      loadFactor: this.entryCount / this.buckets.length,
      bucketCount: this.buckets.length,
      entryCount: this.entryCount,
      maxChainLength,
      avgChainLength,
    };
  }

  getStats(): { entryCount: number; bucketCount: number; loadFactor: number } {
    return {
      entryCount: this.entryCount,
      bucketCount: this.buckets.length,
      loadFactor: this.entryCount / this.buckets.length,
    };
  }
}
