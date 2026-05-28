class ConstraintViolation {
  constructor(code, message, details) {
    this.code = code;
    this.message = message;
    this.details = details;
  }
}

const CONSTRAINT_CODE = Object.freeze({
  WEIGHT_EXCEEDED: 'WEIGHT_EXCEEDED',
  DIMENSION_EXCEEDED: 'DIMENSION_EXCEEDED',
  FRAGILE_COLLISION: 'FRAGILE_COLLISION',
  ROTATION_DENIED: 'ROTATION_DENIED',
  INVALID_INPUT: 'INVALID_INPUT',
});

const CONSTRAINT_LABEL = Object.freeze({
  [CONSTRAINT_CODE.WEIGHT_EXCEEDED]: '重量超限',
  [CONSTRAINT_CODE.DIMENSION_EXCEEDED]: '尺寸超限',
  [CONSTRAINT_CODE.FRAGILE_COLLISION]: '易碎冲突',
  [CONSTRAINT_CODE.ROTATION_DENIED]: '旋转受限',
  [CONSTRAINT_CODE.INVALID_INPUT]: '输入无效',
});

class ConstraintEngine {
  constructor() {
    this.violations = [];
    this.log = [];
  }

  reset() {
    this.violations = [];
    this.log = [];
  }

  validatePlacement(product, rotatedDims, space, currentWeight, boxType, fragileColumns) {
    this.violations = [];

    this._checkWeight(product, currentWeight, boxType);
    this._checkDimensions(rotatedDims, boxType);
    this._checkRotation(product);
    this._checkFragile(product, rotatedDims, space, fragileColumns);

    const valid = this.violations.length === 0;
    if (!valid) {
      this._logViolation(product, this.violations);
    }

    return { valid, violations: [...this.violations] };
  }

  validateProduct(product) {
    const v = [];
    if (product.length <= 0 || product.width <= 0 || product.height <= 0) {
      v.push(new ConstraintViolation(CONSTRAINT_CODE.INVALID_INPUT, `尺寸必须为正数`, { length: product.length, width: product.width, height: product.height }));
    }
    if (product.weight < 0) {
      v.push(new ConstraintViolation(CONSTRAINT_CODE.INVALID_INPUT, `重量不能为负`, { weight: product.weight }));
    }
    return { valid: v.length === 0, violations: v };
  }

  validateBoxType(boxType) {
    const v = [];
    if (boxType.innerLength <= 0 || boxType.innerWidth <= 0 || boxType.innerHeight <= 0) {
      v.push(new ConstraintViolation(CONSTRAINT_CODE.INVALID_INPUT, `内径必须为正数`, {}));
    }
    if (boxType.maxWeight <= 0) {
      v.push(new ConstraintViolation(CONSTRAINT_CODE.INVALID_INPUT, `承重必须为正数`, {}));
    }
    return { valid: v.length === 0, violations: v };
  }

  _checkWeight(product, currentWeight, boxType) {
    if (currentWeight + product.weight > boxType.maxWeight) {
      this.violations.push(new ConstraintViolation(
        CONSTRAINT_CODE.WEIGHT_EXCEEDED,
        `商品 ${product.name}(${product.id}): 累计重量 ${currentWeight + product.weight}${UNIT.WEIGHT} 超过箱体承重 ${boxType.maxWeight}${UNIT.WEIGHT}`,
        { currentWeight, itemWeight: product.weight, maxWeight: boxType.maxWeight }
      ));
    }
  }

  _checkDimensions(rotatedDims, boxType) {
    if (rotatedDims.dx > boxType.innerLength || rotatedDims.dy > boxType.innerWidth || rotatedDims.dz > boxType.innerHeight) {
      this.violations.push(new ConstraintViolation(
        CONSTRAINT_CODE.DIMENSION_EXCEEDED,
        `旋转后尺寸 ${rotatedDims.dx}×${rotatedDims.dy}×${rotatedDims.dz}${UNIT.LENGTH} 超过箱体内径 ${boxType.innerLength}×${boxType.innerWidth}×${boxType.innerHeight}${UNIT.LENGTH}`,
        { rotatedDims, boxInnerDims: { length: boxType.innerLength, width: boxType.innerWidth, height: boxType.innerHeight } }
      ));
    }
  }

  _checkRotation(product) {
    for (const r of product.allowedRotations) {
      if (!ROTATION_MAP[r]) {
        this.violations.push(new ConstraintViolation(
          CONSTRAINT_CODE.ROTATION_DENIED,
          `商品 ${product.name}(${product.id}) 包含无效旋转标识: ${r}`,
          { rotation: r, allowed: product.allowedRotations }
        ));
      }
    }
  }

  _checkFragile(product, rotatedDims, space, fragileColumns) {
    if (fragileColumns.length === 0) return;

    for (const col of fragileColumns) {
      const xOverlap = space.x < col.x + col.dx && space.x + rotatedDims.dx > col.x;
      const yOverlap = space.y < col.y + col.dy && space.y + rotatedDims.dy > col.y;
      const zOverlap = space.z >= col.zStart;

      if (xOverlap && yOverlap && zOverlap) {
        this.violations.push(new ConstraintViolation(
          CONSTRAINT_CODE.FRAGILE_COLLISION,
          `商品 ${product.name}(${product.id})${product.fragile ? '(易碎)' : ''} 放置于 (${space.x},${space.y},${space.z}) 会压到下方易碎品`,
          { placementPos: space, fragileColumn: col }
        ));
        break;
      }
    }
  }

  _logViolation(product, violations) {
    this.log.push({
      timestamp: new Date().toISOString(),
      productId: product.id,
      productName: product.name,
      violations: violations.map(v => ({ code: v.code, message: v.message })),
    });
  }

  explainViolation(violation) {
    const label = CONSTRAINT_LABEL[violation.code] || violation.code;
    return `[${label}] ${violation.message}`;
  }
}
