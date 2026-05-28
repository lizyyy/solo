const UNIT = Object.freeze({
  LENGTH: 'mm',
  WEIGHT: 'g',
  VOLUME: 'mm³',
});

const ROTATION_MAP = Object.freeze({
  LWH: { label: '长×宽×高', axes: [0, 1, 2] },
  LHW: { label: '长×高×宽', axes: [0, 2, 1] },
  WLH: { label: '宽×长×高', axes: [1, 0, 2] },
  WHL: { label: '宽×高×长', axes: [1, 2, 0] },
  HLW: { label: '高×长×宽', axes: [2, 0, 1] },
  HWL: { label: '高×宽×长', axes: [2, 1, 0] },
});

const UPRIGHT_ROTATIONS = Object.freeze(['LWH', 'WLH']);

const ALL_ROTATIONS = Object.freeze(Object.keys(ROTATION_MAP));

const PACK_STATUS = Object.freeze({
  SUCCESS: 'SUCCESS',
  PARTIAL: 'PARTIAL',
  FAILED_WEIGHT: 'FAILED_WEIGHT',
  FAILED_SIZE: 'FAILED_SIZE',
  FAILED_FRAGILE: 'FAILED_FRAGILE',
  FAILED_NO_FIT: 'FAILED_NO_FIT',
});

const PACK_STATUS_LABEL = Object.freeze({
  [PACK_STATUS.SUCCESS]: '全部装入',
  [PACK_STATUS.PARTIAL]: '部分装入',
  [PACK_STATUS.FAILED_WEIGHT]: '重量超限',
  [PACK_STATUS.FAILED_SIZE]: '尺寸超限',
  [PACK_STATUS.FAILED_FRAGILE]: '易碎冲突',
  [PACK_STATUS.FAILED_NO_FIT]: '空间不足',
});

const SENSITIVE_FIELDS = Object.freeze(['costPrice', 'customerName', 'customerPhone']);

const DATA_SOURCE = Object.freeze({
  PRODUCT: 'PRODUCT',
  BOX_TYPE: 'BOX_TYPE',
  ORDER: 'ORDER',
  PACKING_REPORT: 'PACKING_REPORT',
});

const DATA_SOURCE_LABEL = Object.freeze({
  [DATA_SOURCE.PRODUCT]: '商品主数据',
  [DATA_SOURCE.BOX_TYPE]: '箱型主数据',
  [DATA_SOURCE.ORDER]: '订单数据',
  [DATA_SOURCE.PACKING_REPORT]: '装箱报告',
});

class Product {
  constructor({ id, name, length, width, height, weight, fragile = false, allowedRotations = null, costPrice = null }) {
    this.source = DATA_SOURCE.PRODUCT;
    this.id = String(id);
    this.name = name;
    this.length = Number(length);
    this.width = Number(width);
    this.height = Number(height);
    this.weight = Number(weight);
    this.fragile = Boolean(fragile);
    this.allowedRotations = allowedRotations || (fragile ? [...UPRIGHT_ROTATIONS] : [...ALL_ROTATIONS]);
    this.costPrice = costPrice;
    this._validate();
  }

  _validate() {
    if (this.length <= 0 || this.width <= 0 || this.height <= 0) {
      throw new Error(`商品 ${this.id} 尺寸必须为正数，当前: ${this.length}×${this.width}×${this.height} ${UNIT.LENGTH}`);
    }
    if (this.weight < 0) {
      throw new Error(`商品 ${this.id} 重量不能为负，当前: ${this.weight} ${UNIT.WEIGHT}`);
    }
    for (const r of this.allowedRotations) {
      if (!ROTATION_MAP[r]) {
        throw new Error(`商品 ${this.id} 包含无效旋转标识: ${r}，合法值: ${ALL_ROTATIONS.join(', ')}`);
      }
    }
  }

  volume() {
    return this.length * this.width * this.height;
  }

  rotatedDims(rotationKey) {
    const src = [this.length, this.width, this.height];
    const axes = ROTATION_MAP[rotationKey].axes;
    return { dx: src[axes[0]], dy: src[axes[1]], dz: src[axes[2]] };
  }

  masked() {
    const copy = { ...this };
    for (const f of SENSITIVE_FIELDS) {
      if (copy[f] != null) copy[f] = '***';
    }
    return copy;
  }

  auditTrail() {
    return { source: this.source, id: this.id, timestamp: new Date().toISOString(), action: 'ACCESS' };
  }
}

class BoxType {
  constructor({ id, name, innerLength, innerWidth, innerHeight, maxWeight, wallThickness = 0, costPrice = null }) {
    this.source = DATA_SOURCE.BOX_TYPE;
    this.id = String(id);
    this.name = name;
    this.innerLength = Number(innerLength);
    this.innerWidth = Number(innerWidth);
    this.innerHeight = Number(innerHeight);
    this.maxWeight = Number(maxWeight);
    this.wallThickness = Number(wallThickness);
    this.costPrice = costPrice;
    this._validate();
  }

  _validate() {
    if (this.innerLength <= 0 || this.innerWidth <= 0 || this.innerHeight <= 0) {
      throw new Error(`箱型 ${this.id} 内径必须为正数，当前: ${this.innerLength}×${this.innerWidth}×${this.innerHeight} ${UNIT.LENGTH}`);
    }
    if (this.maxWeight <= 0) {
      throw new Error(`箱型 ${this.id} 承重必须为正数，当前: ${this.maxWeight} ${UNIT.WEIGHT}`);
    }
    if (this.wallThickness < 0) {
      throw new Error(`箱型 ${this.id} 壁厚不能为负，当前: ${this.wallThickness} ${UNIT.LENGTH}`);
    }
  }

  innerVolume() {
    return this.innerLength * this.innerWidth * this.innerHeight;
  }

  masked() {
    const copy = { ...this };
    for (const f of SENSITIVE_FIELDS) {
      if (copy[f] != null) copy[f] = '***';
    }
    return copy;
  }
}

class OrderItem {
  constructor({ productId, quantity }) {
    this.productId = String(productId);
    this.quantity = Math.max(1, Math.floor(Number(quantity)));
  }
}

class Order {
  constructor({ id, items, customerName = null, customerPhone = null }) {
    this.source = DATA_SOURCE.ORDER;
    this.id = String(id);
    this.items = items.map(i => new OrderItem(i));
    this.customerName = customerName;
    this.customerPhone = customerPhone;
  }

  totalQuantity() {
    return this.items.reduce((s, i) => s + i.quantity, 0);
  }

  masked() {
    const copy = { ...this };
    for (const f of SENSITIVE_FIELDS) {
      if (copy[f] != null) copy[f] = '***';
    }
    return copy;
  }
}

class Placement {
  constructor({ productId, productName, position, dimensions, rotation, fragile, weight }) {
    this.productId = productId;
    this.productName = productName;
    this.position = { ...position };
    this.dimensions = { ...dimensions };
    this.rotation = rotation;
    this.fragile = fragile;
    this.weight = weight;
  }

  volume() {
    return this.dimensions.dx * this.dimensions.dy * this.dimensions.dz;
  }

  toDisplay() {
    const r = ROTATION_MAP[this.rotation];
    return {
      productId: this.productId,
      productName: this.productName,
      position: `(${this.position.x}, ${this.position.y}, ${this.position.z}) ${UNIT.LENGTH}`,
      dimensions: `${this.dimensions.dx}×${this.dimensions.dy}×${this.dimensions.dz} ${UNIT.LENGTH}`,
      rotation: r ? r.label : this.rotation,
      fragile: this.fragile ? '是' : '否',
      weight: `${this.weight} ${UNIT.WEIGHT}`,
    };
  }
}

class PackingReport {
  constructor({ id, orderId, boxTypeId, boxTypeName, placements, unpackedItems, utilization, weightUtilization, totalWeight, status, failures }) {
    this.source = DATA_SOURCE.PACKING_REPORT;
    this.id = id;
    this.orderId = orderId;
    this.boxTypeId = boxTypeId;
    this.boxTypeName = boxTypeName;
    this.placements = placements;
    this.unpackedItems = unpackedItems;
    this.utilization = utilization;
    this.weightUtilization = weightUtilization;
    this.totalWeight = totalWeight;
    this.status = status;
    this.failures = failures;
    this.createdAt = new Date().toISOString();
  }

  summary() {
    return {
      id: this.id,
      orderId: this.orderId,
      boxTypeId: this.boxTypeId,
      boxTypeName: this.boxTypeName,
      placedCount: this.placements.length,
      unpackedCount: this.unpackedItems.length,
      volumeUtilization: `${(this.utilization * 100).toFixed(1)}%`,
      weightUtilization: `${(this.weightUtilization * 100).toFixed(1)}%`,
      totalWeight: `${this.totalWeight} ${UNIT.WEIGHT}`,
      status: this.status,
      statusLabel: PACK_STATUS_LABEL[this.status],
    };
  }

  masked() {
    const copy = { ...this };
    copy.placements = this.placements.map(p => ({ ...p }));
    copy.unpackedItems = this.unpackedItems.map(u => ({ ...u }));
    return copy;
  }
}
