const { v4: uuidv4 } = require('uuid');
const db = require('../models');
const auditService = require('./auditService');
const idempotencyService = require('./idempotencyService');
const lockService = require('./lockService');

const inventoryService = {
  async createInventory(data, userId, requestId) {
    const t = await db.sequelize.transaction();

    try {
      const requestCheck = await idempotencyService.isRequestProcessed(requestId);
      if (requestCheck.processed) {
        await t.rollback();
        return {
          ...requestCheck.result,
          isDuplicate: true
        };
      }

      await idempotencyService.registerRequest(requestId, 'CREATE_INVENTORY', data, userId, t);
      await idempotencyService.markProcessing(requestId, t);

      const product = await db.Product.findByPk(data.productId, { transaction: t });
      if (!product) {
        throw new Error('商品不存在');
      }

      const existingInventory = await db.Inventory.findOne({
        where: { storeId: data.storeId, productId: data.productId },
        transaction: t
      });

      if (existingInventory) {
        throw new Error('该商品在门店已存在库存记录');
      }

      const inventory = await db.Inventory.create({
        id: uuidv4(),
        storeId: data.storeId,
        productId: data.productId,
        quantity: data.quantity || 0,
        price: data.price || product.basePrice,
        minStock: data.minStock || 0,
        maxStock: data.maxStock || 99999,
        version: 0,
        lastUpdatedAt: new Date()
      }, { transaction: t });

      await db.InventorySnapshot.create({
        id: uuidv4(),
        inventoryId: inventory.id,
        quantity: inventory.quantity,
        price: inventory.price,
        version: 0,
        snapshotAt: new Date()
      }, { transaction: t });

      const beforeState = { quantity: 0, price: 0 };
      const afterState = { quantity: inventory.quantity, price: inventory.price };
      const changeDetails = {
        type: 'CREATE',
        fields: {
          quantity: { from: 0, to: inventory.quantity },
          price: { from: 0, to: inventory.price }
        }
      };

      await auditService.createLog({
        inventoryId: inventory.id,
        userId,
        operationType: 'CREATE',
        requestId,
        beforeState,
        afterState,
        changeDetails,
        transaction: t
      });

      const result = {
        success: true,
        data: inventory,
        message: '库存创建成功'
      };

      await idempotencyService.markCompleted(requestId, result, t);
      await t.commit();

      return result;
    } catch (error) {
      await t.rollback();
      throw error;
    }
  },

  async adjustInventory(inventoryId, adjustment, userId, requestId) {
    const t = await db.sequelize.transaction();

    try {
      const requestCheck = await idempotencyService.isRequestProcessed(requestId);
      if (requestCheck.processed) {
        await t.rollback();
        return {
          ...requestCheck.result,
          isDuplicate: true
        };
      }

      await idempotencyService.registerRequest(requestId, 'ADJUST_INVENTORY', { inventoryId, adjustment }, userId, t);
      await idempotencyService.markProcessing(requestId, t);

      const lock = await lockService.acquireLock('INVENTORY', inventoryId, userId, 'ADJUST');
      if (!lock.success) {
        throw new Error(`库存记录被锁定: ${lock.message}`);
      }

      const inventory = await db.Inventory.findByPk(inventoryId, { transaction: t });
      if (!inventory) {
        await lockService.releaseLock('INVENTORY', inventoryId);
        throw new Error('库存记录不存在');
      }

      const beforeState = {
        quantity: inventory.quantity,
        price: inventory.price,
        version: inventory.version
      };

      const newQuantity = inventory.quantity + adjustment.quantity;
      if (newQuantity < 0) {
        await lockService.releaseLock('INVENTORY', inventoryId);
        throw new Error('库存数量不能为负数');
      }

      const updatedInventory = await inventory.update({
        quantity: newQuantity,
        price: adjustment.price !== undefined ? adjustment.price : inventory.price,
        version: inventory.version + 1,
        lastUpdatedAt: new Date()
      }, { transaction: t });

      await db.InventorySnapshot.create({
        id: uuidv4(),
        inventoryId: inventory.id,
        quantity: updatedInventory.quantity,
        price: updatedInventory.price,
        version: updatedInventory.version,
        snapshotAt: new Date()
      }, { transaction: t });

      const afterState = {
        quantity: updatedInventory.quantity,
        price: updatedInventory.price,
        version: updatedInventory.version
      };

      const changeDetails = {
        type: 'ADJUST',
        fields: {
          quantity: {
            from: inventory.quantity,
            to: newQuantity,
            change: adjustment.quantity
          }
        },
        reason: adjustment.reason
      };

      if (adjustment.price !== undefined) {
        changeDetails.fields.price = {
          from: inventory.price,
          to: adjustment.price
        };

        await db.PriceChangeRecord.create({
          id: uuidv4(),
          inventoryId: inventory.id,
          oldPrice: inventory.price,
          newPrice: adjustment.price,
          reason: adjustment.reason || '价格调整',
          userId,
          effectiveFrom: new Date()
        }, { transaction: t });
      }

      await auditService.createLog({
        inventoryId: inventory.id,
        userId,
        operationType: 'ADJUST',
        requestId,
        beforeState,
        afterState,
        changeDetails,
        transaction: t
      });

      const result = {
        success: true,
        data: updatedInventory,
        message: '库存调整成功'
      };

      await idempotencyService.markCompleted(requestId, result, t);
      await lockService.releaseLock('INVENTORY', inventoryId);
      await t.commit();

      return result;
    } catch (error) {
      await t.rollback();
      throw error;
    }
  },

  async updatePrice(inventoryId, newPrice, reason, userId, requestId) {
    const t = await db.sequelize.transaction();

    try {
      const requestCheck = await idempotencyService.isRequestProcessed(requestId);
      if (requestCheck.processed) {
        await t.rollback();
        return {
          ...requestCheck.result,
          isDuplicate: true
        };
      }

      await idempotencyService.registerRequest(requestId, 'PRICE_CHANGE', { inventoryId, newPrice, reason }, userId, t);
      await idempotencyService.markProcessing(requestId, t);

      const lock = await lockService.acquireLock('INVENTORY', inventoryId, userId, 'PRICE_CHANGE');
      if (!lock.success) {
        throw new Error(`库存记录被锁定: ${lock.message}`);
      }

      const inventory = await db.Inventory.findByPk(inventoryId, { transaction: t });
      if (!inventory) {
        await lockService.releaseLock('INVENTORY', inventoryId);
        throw new Error('库存记录不存在');
      }

      if (Number(inventory.price) === Number(newPrice)) {
        await lockService.releaseLock('INVENTORY', inventoryId);
        await t.rollback();
        return {
          success: true,
          data: inventory,
          message: '价格未变化',
          noChange: true
        };
      }

      const beforeState = {
        quantity: inventory.quantity,
        price: inventory.price,
        version: inventory.version
      };

      const updatedInventory = await inventory.update({
        price: newPrice,
        version: inventory.version + 1,
        lastUpdatedAt: new Date()
      }, { transaction: t });

      await db.InventorySnapshot.create({
        id: uuidv4(),
        inventoryId: inventory.id,
        quantity: inventory.quantity,
        price: newPrice,
        version: updatedInventory.version,
        snapshotAt: new Date()
      }, { transaction: t });

      await db.PriceChangeRecord.create({
        id: uuidv4(),
        inventoryId: inventory.id,
        oldPrice: inventory.price,
        newPrice,
        reason: reason || '价格变更',
        userId,
        effectiveFrom: new Date()
      }, { transaction: t });

      const afterState = {
        quantity: inventory.quantity,
        price: newPrice,
        version: updatedInventory.version
      };

      const changeDetails = {
        type: 'PRICE_CHANGE',
        fields: {
          price: {
            from: inventory.price,
            to: newPrice
          }
        },
        reason
      };

      await auditService.createLog({
        inventoryId: inventory.id,
        userId,
        operationType: 'PRICE_CHANGE',
        requestId,
        beforeState,
        afterState,
        changeDetails,
        transaction: t
      });

      const result = {
        success: true,
        data: updatedInventory,
        message: '价格更新成功'
      };

      await idempotencyService.markCompleted(requestId, result, t);
      await lockService.releaseLock('INVENTORY', inventoryId);
      await t.commit();

      return result;
    } catch (error) {
      await t.rollback();
      throw error;
    }
  },

  async transferStock(transferData, userId, requestId) {
    const { fromStoreId, toStoreId, productId, quantity, remarks } = transferData;
    
    if (!fromStoreId || !toStoreId || !productId || !quantity) {
      throw new Error('缺少必要的调拨参数');
    }

    if (fromStoreId === toStoreId) {
      throw new Error('调出门店和调入门店不能相同');
    }

    if (quantity <= 0) {
      throw new Error('调拨数量必须大于0');
    }

    const t = await db.sequelize.transaction();
    let lockFrom = null;
    let lockTo = null;

    try {
      const requestCheck = await idempotencyService.isRequestProcessed(requestId);
      if (requestCheck.processed) {
        await t.rollback();
        return {
          ...requestCheck.result,
          isDuplicate: true
        };
      }

      await idempotencyService.registerRequest(requestId, 'TRANSFER', transferData, userId, t);
      await idempotencyService.markProcessing(requestId, t);

      const fromInventory = await db.Inventory.findOne({
        where: { storeId: fromStoreId, productId: productId },
        transaction: t
      });

      if (!fromInventory) {
        throw new Error('调出门店不存在该商品库存');
      }

      if (fromInventory.quantity < quantity) {
        throw new Error(`调出门店库存不足，当前库存: ${fromInventory.quantity}, 调拨数量: ${quantity}`);
      }

      let toInventory = await db.Inventory.findOne({
        where: { storeId: toStoreId, productId: productId },
        transaction: t
      });

      const lockKeys = [fromInventory.id];
      if (toInventory) {
        lockKeys.push(toInventory.id);
      }
      lockKeys.sort();

      lockFrom = await lockService.acquireLock('INVENTORY', fromInventory.id, userId, `TRANSFER_OUT-${productId}`);
      if (!lockFrom.success) {
        throw new Error(`调出门店库存被锁定: ${lockFrom.message}`);
      }

      const refreshedFrom = await db.Inventory.findByPk(fromInventory.id, { transaction: t });
      if (!refreshedFrom || refreshedFrom.version !== fromInventory.version) {
        throw new Error('调出门店库存已被其他操作修改，请重试');
      }

      if (refreshedFrom.quantity < quantity) {
        throw new Error(`调出门店库存不足，当前库存: ${refreshedFrom.quantity}`);
      }

      if (toInventory) {
        lockTo = await lockService.acquireLock('INVENTORY', toInventory.id, userId, `TRANSFER_IN-${productId}`);
        if (!lockTo.success) {
          throw new Error(`调入门店库存被锁定: ${lockTo.message}`);
        }

        const refreshedTo = await db.Inventory.findByPk(toInventory.id, { transaction: t });
        if (!refreshedTo || refreshedTo.version !== toInventory.version) {
          throw new Error('调入门店库存已被其他操作修改，请重试');
        }
      }

      const orderNo = 'TR' + Date.now() + Math.random().toString(36).substr(2, 4).toUpperCase();
      const order = await db.TransferOrder.create({
        id: uuidv4(),
        orderNo,
        fromStoreId,
        toStoreId,
        productId,
        quantity,
        status: 'PENDING',
        createdBy: userId,
        remarks
      }, { transaction: t });

      const beforeFrom = {
        quantity: refreshedFrom.quantity,
        price: refreshedFrom.price,
        version: refreshedFrom.version
      };

      await refreshedFrom.update({
        quantity: refreshedFrom.quantity - quantity,
        version: refreshedFrom.version + 1,
        lastUpdatedAt: new Date()
      }, { transaction: t });

      await db.InventorySnapshot.create({
        id: uuidv4(),
        inventoryId: refreshedFrom.id,
        quantity: refreshedFrom.quantity - quantity,
        price: refreshedFrom.price,
        version: refreshedFrom.version + 1,
        snapshotAt: new Date()
      }, { transaction: t });

      const product = await db.Product.findByPk(productId, { transaction: t });
      let beforeTo = { quantity: 0 };

      if (!toInventory) {
        toInventory = await db.Inventory.create({
          id: uuidv4(),
          storeId: toStoreId,
          productId,
          quantity,
          price: product.basePrice,
          minStock: 0,
          maxStock: 99999,
          version: 0,
          lastUpdatedAt: new Date()
        }, { transaction: t });
      } else {
        beforeTo = {
          quantity: toInventory.quantity,
          price: toInventory.price,
          version: toInventory.version
        };
        await toInventory.update({
          quantity: toInventory.quantity + quantity,
          version: toInventory.version + 1,
          lastUpdatedAt: new Date()
        }, { transaction: t });
      }

      await db.InventorySnapshot.create({
        id: uuidv4(),
        inventoryId: toInventory.id,
        quantity: toInventory.quantity,
        price: toInventory.price,
        version: toInventory.version,
        snapshotAt: new Date()
      }, { transaction: t });

      await auditService.createLog({
        inventoryId: refreshedFrom.id,
        userId,
        operationType: 'TRANSFER_OUT',
        requestId,
        beforeState: beforeFrom,
        afterState: {
          quantity: beforeFrom.quantity - quantity,
          price: beforeFrom.price,
          version: beforeFrom.version + 1
        },
        changeDetails: {
          type: 'TRANSFER_OUT',
          quantity,
          toStoreId,
          orderNo,
          versionChange: `v${beforeFrom.version} -> v${beforeFrom.version + 1}`
        },
        transaction: t
      });

      await auditService.createLog({
        inventoryId: toInventory.id,
        userId,
        operationType: 'TRANSFER_IN',
        requestId,
        beforeState: beforeTo,
        afterState: {
          quantity: beforeTo.quantity + quantity,
          price: toInventory.price,
          version: toInventory.version
        },
        changeDetails: {
          type: 'TRANSFER_IN',
          quantity,
          fromStoreId,
          orderNo,
          versionChange: beforeTo.version !== undefined ? `v${beforeTo.version} -> v${toInventory.version}` : 'v0 (新建)'
        },
        transaction: t
      });

      await order.update({ status: 'RECEIVED', receivedBy: userId }, { transaction: t });

      const result = {
        success: true,
        data: {
          order: { ...order.toJSON(), status: 'RECEIVED' },
          fromInventory: {
            id: refreshedFrom.id,
            beforeQuantity: beforeFrom.quantity,
            afterQuantity: beforeFrom.quantity - quantity,
            version: beforeFrom.version + 1
          },
          toInventory: {
            id: toInventory.id,
            beforeQuantity: beforeTo.quantity,
            afterQuantity: beforeTo.quantity + quantity,
            version: toInventory.version
          }
        },
        message: '调拨成功'
      };

      await idempotencyService.markCompleted(requestId, result, t);
      await t.commit();

      return result;
    } catch (error) {
      await t.rollback();
      throw error;
    } finally {
      if (lockFrom) {
        await lockService.releaseLock('INVENTORY', fromInventory ? fromInventory.id : '');
      }
      if (lockTo) {
        await lockService.releaseLock('INVENTORY', toInventory ? toInventory.id : '');
      }
    }
  },

  async getInventory(options = {}) {
    const { storeId, productId, lowStock = false, limit = 50, offset = 0 } = options;
    const where = {};

    if (storeId) where.storeId = storeId;
    if (productId) where.productId = productId;
    if (lowStock) {
      where.quantity = { [db.Sequelize.Op.lte]: db.Sequelize.col('minStock') };
    }

    return await db.Inventory.findAndCountAll({
      where,
      include: [
        { model: db.Store },
        { model: db.Product }
      ],
      order: [['lastUpdatedAt', 'DESC']],
      limit,
      offset
    });
  },

  async getInventoryById(id) {
    return await db.Inventory.findByPk(id, {
      include: [
        { model: db.Store },
        { model: db.Product }
      ]
    });
  }
};

module.exports = inventoryService;
