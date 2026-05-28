class Space {
  constructor(x, y, z, dx, dy, dz) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.dx = dx;
    this.dy = dy;
    this.dz = dz;
  }

  volume() {
    return this.dx * this.dy * this.dz;
  }

  canFit(dx, dy, dz) {
    return dx <= this.dx && dy <= this.dy && dz <= this.dz;
  }

  clone() {
    return new Space(this.x, this.y, this.z, this.dx, this.dy, this.dz);
  }
}

class BinPacker {
  constructor(boxType, constraintEngine) {
    this.boxType = boxType;
    this.constraintEngine = constraintEngine;
    this.spaces = [];
    this.placements = [];
    this.fragileColumns = [];
    this.currentWeight = 0;

    const d = boxType;
    this.spaces.push(new Space(0, 0, 0, d.innerLength, d.innerWidth, d.innerHeight));
  }

  pack(items) {
    const expanded = [];
    for (const item of items) {
      for (let i = 0; i < item.quantity; i++) {
        expanded.push(item.product);
      }
    }
    expanded.sort((a, b) => b.volume() - a.volume());

    const unpacked = [];
    const failures = [];

    for (const product of expanded) {
      const result = this._placeItem(product);
      if (!result.placed) {
        unpacked.push({ productId: product.id, productName: product.name, weight: product.weight, fragile: product.fragile });
        if (result.failure) failures.push(result.failure);
      }
    }

    return this._buildReport(unpacked, failures);
  }

  _placeItem(product) {
    const bestFit = this._findBestFit(product);
    if (!bestFit) {
      return { placed: false, failure: this._diagnoseFailure(product) };
    }

    const constraintResult = this.constraintEngine.validatePlacement(
      product,
      bestFit.rotated,
      bestFit.space,
      this.currentWeight,
      this.boxType,
      this.fragileColumns
    );

    if (!constraintResult.valid) {
      return {
        placed: false,
        failure: {
          status: this._classifyConstraintFailure(constraintResult.violations),
          message: constraintResult.violations.map(v => this.constraintEngine.explainViolation(v)).join('; '),
          productId: product.id,
          productName: product.name,
        },
      };
    }

    this.placements.push(new Placement({
      productId: product.id,
      productName: product.name,
      position: { x: bestFit.space.x, y: bestFit.space.y, z: bestFit.space.z },
      dimensions: { dx: bestFit.rotated.dx, dy: bestFit.rotated.dy, dz: bestFit.rotated.dz },
      rotation: bestFit.rotation,
      fragile: product.fragile,
      weight: product.weight,
    }));

    this.currentWeight += product.weight;

    if (product.fragile) {
      this.fragileColumns.push({
        x: bestFit.space.x,
        y: bestFit.space.y,
        dx: bestFit.rotated.dx,
        dy: bestFit.rotated.dy,
        zStart: bestFit.space.z + bestFit.rotated.dz,
      });
    }

    this._splitSpace(bestFit.space, bestFit.rotated);

    return { placed: true };
  }

  _findBestFit(product) {
    let bestSafe = null;
    let bestSafeScore = Infinity;
    let bestOverlap = null;
    let bestOverlapScore = Infinity;

    for (const rotation of product.allowedRotations) {
      if (!ROTATION_MAP[rotation]) continue;
      const rotated = product.rotatedDims(rotation);

      for (const space of this.spaces) {
        if (!space.canFit(rotated.dx, rotated.dy, rotated.dz)) continue;

        const waste = space.volume() - (rotated.dx * rotated.dy * rotated.dz);
        const touchFloor = space.z === 0 ? 1000 : 0;
        const score = waste - touchFloor;

        if (this._overlapsFragileColumn(space, rotated)) {
          if (score < bestOverlapScore) {
            bestOverlapScore = score;
            bestOverlap = { space, rotated, rotation };
          }
        } else {
          if (score < bestSafeScore) {
            bestSafeScore = score;
            bestSafe = { space, rotated, rotation };
          }
        }
      }
    }

    return bestSafe || bestOverlap;
  }

  _overlapsFragileColumn(space, rotated) {
    for (const col of this.fragileColumns) {
      const xOverlap = space.x < col.x + col.dx && space.x + rotated.dx > col.x;
      const yOverlap = space.y < col.y + col.dy && space.y + rotated.dy > col.y;
      const zOverlap = space.z >= col.zStart;
      if (xOverlap && yOverlap && zOverlap) return true;
    }
    return false;
  }

  _splitSpace(space, rotated) {
    const idx = this.spaces.indexOf(space);
    if (idx === -1) return;
    this.spaces.splice(idx, 1);

    if (space.dx - rotated.dx > 0) {
      this.spaces.push(new Space(
        space.x + rotated.dx, space.y, space.z,
        space.dx - rotated.dx, space.dy, space.dz
      ));
    }
    if (space.dy - rotated.dy > 0) {
      this.spaces.push(new Space(
        space.x, space.y + rotated.dy, space.z,
        rotated.dx, space.dy - rotated.dy, space.dz
      ));
    }
    if (space.dz - rotated.dz > 0) {
      this.spaces.push(new Space(
        space.x, space.y, space.z + rotated.dz,
        rotated.dx, rotated.dy, space.dz - rotated.dz
      ));
    }

    this._pruneSpaces();
  }

  _pruneSpaces() {
    this.spaces = this.spaces.filter(s => s.dx > 0 && s.dy > 0 && s.dz > 0);
    this.spaces.sort((a, b) => a.volume() - b.volume());
  }

  _diagnoseFailure(product) {
    if (this.currentWeight + product.weight > this.boxType.maxWeight) {
      return {
        status: PACK_STATUS.FAILED_WEIGHT,
        message: `商品 ${product.name}(${product.id}): 累计重量 ${this.currentWeight + product.weight}${UNIT.WEIGHT} 超过箱体承重 ${this.boxType.maxWeight}${UNIT.WEIGHT}`,
        productId: product.id,
        productName: product.name,
      };
    }

    const boxD = this.boxType;
    let anyRotationFitsBox = false;
    for (const rot of product.allowedRotations) {
      if (!ROTATION_MAP[rot]) continue;
      const r = product.rotatedDims(rot);
      if (r.dx <= boxD.innerLength && r.dy <= boxD.innerWidth && r.dz <= boxD.innerHeight) {
        anyRotationFitsBox = true;
        break;
      }
    }

    if (!anyRotationFitsBox) {
      return {
        status: PACK_STATUS.FAILED_SIZE,
        message: `商品 ${product.name}(${product.id}): 允许旋转下尺寸 ${product.length}×${product.width}×${product.height}${UNIT.LENGTH} 均超过箱体内径 ${boxD.innerLength}×${boxD.innerWidth}×${boxD.innerHeight}${UNIT.LENGTH}`,
        productId: product.id,
        productName: product.name,
      };
    }

    if (product.fragile) {
      return {
        status: PACK_STATUS.FAILED_FRAGILE,
        message: `商品 ${product.name}(${product.id}): 易碎品无可放置位置，上方空间已被占用`,
        productId: product.id,
        productName: product.name,
      };
    }

    if (this._wouldOverlapFragileColumn(product)) {
      return {
        status: PACK_STATUS.FAILED_FRAGILE,
        message: `商品 ${product.name}(${product.id}): 所有可用空间均会压到下方易碎品，存在易碎受压风险`,
        productId: product.id,
        productName: product.name,
      };
    }

    return {
      status: PACK_STATUS.FAILED_NO_FIT,
      message: `商品 ${product.name}(${product.id}): 剩余空间不足以容纳`,
      productId: product.id,
      productName: product.name,
    };
  }

  _wouldOverlapFragileColumn(product) {
    if (this.fragileColumns.length === 0) return false;
    for (const rotation of product.allowedRotations) {
      if (!ROTATION_MAP[rotation]) continue;
      const rotated = product.rotatedDims(rotation);
      for (const space of this.spaces) {
        if (!space.canFit(rotated.dx, rotated.dy, rotated.dz)) continue;
        if (!this._overlapsFragileColumn(space, rotated)) return false;
      }
    }
    return true;
  }

  _classifyConstraintFailure(violations) {
    for (const v of violations) {
      if (v.code === CONSTRAINT_CODE.WEIGHT_EXCEEDED) return PACK_STATUS.FAILED_WEIGHT;
      if (v.code === CONSTRAINT_CODE.FRAGILE_COLLISION) return PACK_STATUS.FAILED_FRAGILE;
      if (v.code === CONSTRAINT_CODE.DIMENSION_EXCEEDED) return PACK_STATUS.FAILED_SIZE;
    }
    return PACK_STATUS.PARTIAL;
  }

  _buildReport(unpacked, failures) {
    const boxVol = this.boxType.innerVolume();
    let placedVol = 0;
    for (const p of this.placements) placedVol += p.volume();

    const utilization = boxVol > 0 ? placedVol / boxVol : 0;
    const weightUtil = this.boxType.maxWeight > 0 ? this.currentWeight / this.boxType.maxWeight : 0;

    let status = PACK_STATUS.SUCCESS;
    if (unpacked.length > 0) {
      const priorities = [PACK_STATUS.FAILED_WEIGHT, PACK_STATUS.FAILED_FRAGILE, PACK_STATUS.FAILED_SIZE, PACK_STATUS.FAILED_NO_FIT, PACK_STATUS.PARTIAL];
      for (const p of priorities) {
        if (failures.some(f => f.status === p)) { status = p; break; }
      }
    }

    return new PackingReport({
      id: `RPT-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
      orderId: null,
      boxTypeId: this.boxType.id,
      boxTypeName: this.boxType.name,
      placements: this.placements,
      unpackedItems: unpacked,
      utilization,
      weightUtilization: weightUtil,
      totalWeight: this.currentWeight,
      status,
      failures,
    });
  }
}
