import { KeyType, ValueType, IndexStats, OperationResult, OperationStep, BPlusTreeVisualization, BPlusTreeNodeVisual } from '../types';

class BPlusTreeNode {
  keys: KeyType[];
  values: (ValueType | BPlusTreeNode)[];
  isLeaf: boolean;
  next: BPlusTreeNode | null;
  prev: BPlusTreeNode | null;
  parent: BPlusTreeNode | null;
  pageId: number;

  constructor(isLeaf: boolean, pageId: number) {
    this.keys = [];
    this.values = [];
    this.isLeaf = isLeaf;
    this.next = null;
    this.prev = null;
    this.parent = null;
    this.pageId = pageId;
  }
}

export class BPlusTreeIndex {
  private root: BPlusTreeNode;
  private order: number;
  private pageCounter: number;
  private stats: IndexStats;
  private steps: OperationStep[];

  constructor(order: number = 5) {
    this.order = order;
    this.pageCounter = 1;
    this.root = new BPlusTreeNode(true, this.pageCounter++);
    this.stats = this.createEmptyStats();
    this.steps = [];
  }

  private createEmptyStats(): IndexStats {
    return {
      pageAccesses: 0,
      bucketConflicts: 0,
      tableLookups: 0,
      estimatedTime: 0,
    };
  }

  private addStep(type: OperationStep['type'], description: string, pageId?: number): void {
    this.steps.push({
      type,
      pageId,
      description,
      timestamp: Date.now(),
    });
  }

  private readPage(node: BPlusTreeNode): void {
    this.stats.pageAccesses++;
    this.stats.estimatedTime += 5;
    this.addStep('read', `读取页 ${node.pageId}（${node.isLeaf ? '叶子节点' : '内部节点'}）`, node.pageId);
  }

  private writePage(node: BPlusTreeNode): void {
    this.stats.pageAccesses++;
    this.stats.estimatedTime += 10;
    this.addStep('write', `写入页 ${node.pageId}（${node.isLeaf ? '叶子节点' : '内部节点'}）`, node.pageId);
  }

  private compareKeys(a: KeyType, b: KeyType): number {
    if (typeof a === 'number' && typeof b === 'number') {
      return a - b;
    }
    return String(a).localeCompare(String(b));
  }

  private findLeaf(key: KeyType): BPlusTreeNode {
    let current = this.root;
    this.readPage(current);

    while (!current.isLeaf) {
      let i = 0;
      while (i < current.keys.length && this.compareKeys(key, current.keys[i]) >= 0) {
        i++;
      }
      current = current.values[i] as BPlusTreeNode;
      this.readPage(current);
    }

    return current;
  }

  search(key: KeyType): OperationResult {
    this.stats = this.createEmptyStats();
    this.steps = [];

    this.addStep('lookup', `开始等值查询: key = ${key}`);

    const leaf = this.findLeaf(key);

    for (let i = 0; i < leaf.keys.length; i++) {
      if (this.compareKeys(key, leaf.keys[i]) === 0) {
        this.stats.tableLookups++;
        this.stats.estimatedTime += 2;
        this.addStep('lookup', `在叶子节点 ${leaf.pageId} 找到 key = ${key}，进行回表查询`);
        return {
          success: true,
          key,
          value: leaf.values[i] as ValueType,
          stats: { ...this.stats },
          steps: [...this.steps],
          message: `等值查询成功，找到 key = ${key}`,
        };
      }
    }

    return {
      success: false,
      key,
      stats: { ...this.stats },
      steps: [...this.steps],
      message: `等值查询失败，未找到 key = ${key}`,
    };
  }

  rangeSearch(startKey: KeyType, endKey: KeyType): OperationResult {
    this.stats = this.createEmptyStats();
    this.steps = [];

    this.addStep('lookup', `开始范围查询: [${startKey}, ${endKey}]`);

    const results: ValueType[] = [];
    let currentLeaf = this.findLeaf(startKey);

    while (currentLeaf) {
      for (let i = 0; i < currentLeaf.keys.length; i++) {
        const key = currentLeaf.keys[i];
        if (this.compareKeys(key, startKey) >= 0 && this.compareKeys(key, endKey) <= 0) {
          results.push(currentLeaf.values[i] as ValueType);
          this.stats.tableLookups++;
          this.stats.estimatedTime += 2;
        }
        if (this.compareKeys(key, endKey) > 0) {
          break;
        }
      }

      if (currentLeaf.next) {
        currentLeaf = currentLeaf.next;
        this.readPage(currentLeaf);
      } else {
        break;
      }
    }

    this.addStep('lookup', `范围查询完成，找到 ${results.length} 条记录`);

    return {
      success: results.length > 0,
      stats: { ...this.stats },
      steps: [...this.steps],
      message: `范围查询 [${startKey}, ${endKey}] 完成，找到 ${results.length} 条记录`,
    };
  }

  prefixSearch(prefix: string): OperationResult {
    this.stats = this.createEmptyStats();
    this.steps = [];

    this.addStep('lookup', `开始前缀查询: prefix = "${prefix}"`);

    const results: ValueType[] = [];
    let currentLeaf = this.findLeaf(prefix);

    while (currentLeaf) {
      for (let i = 0; i < currentLeaf.keys.length; i++) {
        const key = String(currentLeaf.keys[i]);
        if (key.startsWith(prefix)) {
          results.push(currentLeaf.values[i] as ValueType);
          this.stats.tableLookups++;
          this.stats.estimatedTime += 2;
        }
        if (key.localeCompare(prefix + String.fromCharCode(255)) > 0) {
          break;
        }
      }

      if (currentLeaf.next) {
        currentLeaf = currentLeaf.next;
        this.readPage(currentLeaf);
      } else {
        break;
      }
    }

    this.addStep('lookup', `前缀查询完成，找到 ${results.length} 条记录`);

    return {
      success: results.length > 0,
      stats: { ...this.stats },
      steps: [...this.steps],
      message: `前缀查询 "${prefix}" 完成，找到 ${results.length} 条记录`,
    };
  }

  insert(key: KeyType, value: ValueType): OperationResult {
    this.stats = this.createEmptyStats();
    this.steps = [];

    this.addStep('write', `开始插入: key = ${key}`);

    const leaf = this.findLeaf(key);

    for (let i = 0; i < leaf.keys.length; i++) {
      if (this.compareKeys(key, leaf.keys[i]) === 0) {
        this.stats.tableLookups++;
        leaf.values[i] = value;
        this.writePage(leaf);
        this.addStep('write', `更新已存在的 key = ${key}`);
        return {
          success: true,
          key,
          value,
          stats: { ...this.stats },
          steps: [...this.steps],
          message: `更新 key = ${key} 成功`,
        };
      }
    }

    this.insertIntoLeaf(leaf, key, value);

    if (leaf.keys.length >= this.order) {
      this.splitLeaf(leaf);
    }

    this.addStep('write', `插入完成: key = ${key}`);

    return {
      success: true,
      key,
      value,
      stats: { ...this.stats },
      steps: [...this.steps],
      message: `插入 key = ${key} 成功`,
    };
  }

  private insertIntoLeaf(leaf: BPlusTreeNode, key: KeyType, value: ValueType): void {
    let i = 0;
    while (i < leaf.keys.length && this.compareKeys(leaf.keys[i], key) < 0) {
      i++;
    }

    leaf.keys.splice(i, 0, key);
    leaf.values.splice(i, 0, value);
    this.writePage(leaf);
  }

  private splitLeaf(leaf: BPlusTreeNode): void {
    const mid = Math.floor(leaf.keys.length / 2);
    const newLeaf = new BPlusTreeNode(true, this.pageCounter++);

    this.addStep('split', `叶子节点 ${leaf.pageId} 页分裂，创建新页 ${newLeaf.pageId}`, leaf.pageId);

    newLeaf.keys = leaf.keys.slice(mid);
    newLeaf.values = leaf.values.slice(mid);
    leaf.keys = leaf.keys.slice(0, mid);
    leaf.values = leaf.values.slice(0, mid);

    newLeaf.next = leaf.next;
    newLeaf.prev = leaf;
    if (leaf.next) {
      leaf.next.prev = newLeaf;
    }
    leaf.next = newLeaf;

    newLeaf.parent = leaf.parent;

    this.writePage(leaf);
    this.writePage(newLeaf);

    this.insertIntoParent(leaf, newLeaf.keys[0], newLeaf);
  }

  private insertIntoParent(left: BPlusTreeNode, key: KeyType, right: BPlusTreeNode): void {
    if (left.parent === null) {
      const newRoot = new BPlusTreeNode(false, this.pageCounter++);
      this.addStep('split', `创建新根节点 ${newRoot.pageId}`);

      newRoot.keys = [key];
      newRoot.values = [left, right];

      left.parent = newRoot;
      right.parent = newRoot;
      this.root = newRoot;

      this.writePage(newRoot);
      return;
    }

    const parent = left.parent;
    let i = 0;
    while (i < parent.values.length && parent.values[i] !== left) {
      i++;
    }

    parent.keys.splice(i, 0, key);
    parent.values.splice(i + 1, 0, right);
    right.parent = parent;

    this.writePage(parent);

    if (parent.keys.length >= this.order) {
      this.splitInternal(parent);
    }
  }

  private splitInternal(node: BPlusTreeNode): void {
    const mid = Math.floor(node.keys.length / 2);
    const newNode = new BPlusTreeNode(false, this.pageCounter++);
    const midKey = node.keys[mid];

    this.addStep('split', `内部节点 ${node.pageId} 页分裂，创建新页 ${newNode.pageId}`, node.pageId);

    newNode.keys = node.keys.slice(mid + 1);
    newNode.values = node.values.slice(mid + 1);
    node.keys = node.keys.slice(0, mid);
    node.values = node.values.slice(0, mid + 1);

    for (const child of newNode.values as BPlusTreeNode[]) {
      child.parent = newNode;
    }

    newNode.parent = node.parent;

    this.writePage(node);
    this.writePage(newNode);

    this.insertIntoParent(node, midKey, newNode);
  }

  delete(key: KeyType): OperationResult {
    this.stats = this.createEmptyStats();
    this.steps = [];

    this.addStep('write', `开始删除: key = ${key}`);

    const leaf = this.findLeaf(key);
    let index = -1;

    for (let i = 0; i < leaf.keys.length; i++) {
      if (this.compareKeys(key, leaf.keys[i]) === 0) {
        index = i;
        break;
      }
    }

    if (index === -1) {
      return {
        success: false,
        key,
        stats: { ...this.stats },
        steps: [...this.steps],
        message: `删除失败，未找到 key = ${key}`,
      };
    }

    leaf.keys.splice(index, 1);
    leaf.values.splice(index, 1);
    this.stats.tableLookups++;
    this.writePage(leaf);

    const minKeys = Math.floor((this.order - 1) / 2);

    if (leaf.keys.length >= minKeys || leaf === this.root) {
      this.addStep('write', `删除完成: key = ${key}`);
      return {
        success: true,
        key,
        stats: { ...this.stats },
        steps: [...this.steps],
        message: `删除 key = ${key} 成功`,
      };
    }

    this.handleUnderflow(leaf);

    this.addStep('write', `删除完成: key = ${key}`);

    return {
      success: true,
      key,
      stats: { ...this.stats },
      steps: [...this.steps],
      message: `删除 key = ${key} 成功`,
    };
  }

  private handleUnderflow(node: BPlusTreeNode): void {
    const parent = node.parent;
    if (!parent) return;

    const minKeys = Math.floor((this.order - 1) / 2);
    let nodeIndex = parent.values.indexOf(node);

    const leftSibling = nodeIndex > 0 ? (parent.values[nodeIndex - 1] as BPlusTreeNode) : null;
    const rightSibling = nodeIndex < parent.values.length - 1 ? (parent.values[nodeIndex + 1] as BPlusTreeNode) : null;

    if (leftSibling && leftSibling.keys.length > minKeys) {
      this.borrowFromLeft(node, leftSibling, parent, nodeIndex - 1);
      return;
    }

    if (rightSibling && rightSibling.keys.length > minKeys) {
      this.borrowFromRight(node, rightSibling, parent, nodeIndex);
      return;
    }

    if (leftSibling) {
      this.mergeNodes(leftSibling, node, parent, nodeIndex - 1);
    } else if (rightSibling) {
      this.mergeNodes(node, rightSibling, parent, nodeIndex);
    }
  }

  private borrowFromLeft(node: BPlusTreeNode, left: BPlusTreeNode, parent: BPlusTreeNode, parentIndex: number): void {
    this.addStep('rebalance', `从左兄弟节点 ${left.pageId} 借一个键值`, node.pageId);

    if (node.isLeaf) {
      const borrowedKey = left.keys.pop()!;
      const borrowedValue = left.values.pop()!;
      node.keys.unshift(borrowedKey);
      node.values.unshift(borrowedValue);
      parent.keys[parentIndex] = borrowedKey;
    } else {
      const borrowedKey = left.keys.pop()!;
      const borrowedValue = left.values.pop()! as BPlusTreeNode;
      node.keys.unshift(parent.keys[parentIndex]);
      node.values.unshift(borrowedValue);
      parent.keys[parentIndex] = borrowedKey;
      borrowedValue.parent = node;
    }

    this.writePage(left);
    this.writePage(node);
    this.writePage(parent);
  }

  private borrowFromRight(node: BPlusTreeNode, right: BPlusTreeNode, parent: BPlusTreeNode, parentIndex: number): void {
    this.addStep('rebalance', `从右兄弟节点 ${right.pageId} 借一个键值`, node.pageId);

    if (node.isLeaf) {
      const borrowedKey = right.keys.shift()!;
      const borrowedValue = right.values.shift()!;
      node.keys.push(borrowedKey);
      node.values.push(borrowedValue);
      parent.keys[parentIndex] = right.keys[0] || borrowedKey;
    } else {
      const borrowedKey = right.keys.shift()!;
      const borrowedValue = right.values.shift()! as BPlusTreeNode;
      node.keys.push(parent.keys[parentIndex]);
      node.values.push(borrowedValue);
      parent.keys[parentIndex] = borrowedKey;
      borrowedValue.parent = node;
    }

    this.writePage(right);
    this.writePage(node);
    this.writePage(parent);
  }

  private mergeNodes(left: BPlusTreeNode, right: BPlusTreeNode, parent: BPlusTreeNode, parentIndex: number): void {
    this.addStep('merge', `合并节点 ${left.pageId} 和 ${right.pageId}`, left.pageId);

    if (left.isLeaf) {
      left.keys.push(...right.keys);
      left.values.push(...right.values);
      left.next = right.next;
      if (right.next) {
        right.next.prev = left;
      }
    } else {
      left.keys.push(parent.keys[parentIndex], ...right.keys);
      for (const child of right.values as BPlusTreeNode[]) {
        child.parent = left;
      }
      left.values.push(...right.values);
    }

    parent.keys.splice(parentIndex, 1);
    parent.values.splice(parentIndex + 1, 1);

    this.writePage(left);
    this.writePage(parent);

    if (parent === this.root && parent.keys.length === 0) {
      this.root = left;
      left.parent = null;
      this.addStep('merge', `根节点变为空，设置新根为 ${left.pageId}`);
    } else if (parent.keys.length < Math.floor((this.order - 1) / 2)) {
      this.handleUnderflow(parent);
    }
  }

  getVisualization(): BPlusTreeVisualization {
    const nodeMap = new Map<BPlusTreeNode, string>();
    const nodeList: BPlusTreeNodeVisual[] = [];
    let idCounter = 0;

    const traverse = (node: BPlusTreeNode, level: number): string => {
      const id = `node_${idCounter++}`;
      nodeMap.set(node, id);

      const visualNode: BPlusTreeNodeVisual = {
        id,
        keys: [...node.keys],
        isLeaf: node.isLeaf,
        level,
      };

      if (!node.isLeaf) {
        visualNode.children = [];
        for (const child of node.values as BPlusTreeNode[]) {
          visualNode.children.push(traverse(child, level + 1));
        }
      }

      nodeList.push(visualNode);
      return id;
    };

    traverse(this.root, 0);

    for (const node of nodeMap.keys()) {
      if (node.isLeaf) {
        const visual = nodeList.find(n => n.id === nodeMap.get(node))!;
        if (node.next) {
          visual.nextLeaf = nodeMap.get(node.next);
        }
        if (node.prev) {
          visual.prevLeaf = nodeMap.get(node.prev);
        }
      }
    }

    const rootVisual = nodeList.find(n => n.id === nodeMap.get(this.root))!;
    const leaves = nodeList.filter(n => n.isLeaf);
    const internals = nodeList.filter(n => !n.isLeaf);

    return {
      root: rootVisual,
      height: Math.max(...nodeList.map(n => n.level)) + 1,
      order: this.order,
      leafCount: leaves.length,
      internalNodeCount: internals.length,
    };
  }

  getStats(): { keyCount: number; height: number } {
    let count = 0;
    let node = this.findLeaf(-Infinity as KeyType);
    while (node) {
      count += node.keys.length;
      node = node.next;
    }

    const viz = this.getVisualization();
    return { keyCount: count, height: viz.height };
  }
}
