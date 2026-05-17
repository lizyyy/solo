const { PreparedMeal, PreparedMealStatus } = require('../models/PreparedMeal');
const Inventory = require('../models/Inventory');
const { OffShelvesHistory, OperationSource, OffShelvesReason } = require('../models/OffShelvesHistory');
const { v4: uuidv4 } = require('uuid');

const getPreparedMeals = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, category, keyword } = req.query;
    const query = {};
    
    if (status) query.status = status;
    if (category) query.category = category;
    if (keyword) {
      query.$or = [
        { name: { $regex: keyword, $options: 'i' } },
        { sku: { $regex: keyword, $options: 'i' } }
      ];
    }

    const preparedMeals = await PreparedMeal.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await PreparedMeal.countDocuments(query);

    res.json({
      data: preparedMeals,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getPreparedMealById = async (req, res) => {
  try {
    const preparedMeal = await PreparedMeal.findById(req.params.id);
    if (!preparedMeal) {
      return res.status(404).json({ error: '预制菜不存在' });
    }
    res.json(preparedMeal);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const batchOffShelves = async (req, res) => {
  const { 
    skus, 
    reason, 
    reasonDetail, 
    operationSource, 
    operator, 
    forceOffShelves = false,
    evidence = [],
    storeCodes
  } = req.body;

  if (!skus || skus.length === 0) {
    return res.status(400).json({ error: '请选择要下架的预制菜' });
  }

  if (!reason || !Object.values(OffShelvesReason).includes(reason)) {
    return res.status(400).json({ error: '请选择有效的下架原因' });
  }

  if (!operationSource || !Object.values(OperationSource).includes(operationSource)) {
    return res.status(400).json({ error: '请指定操作来源' });
  }

  if (!operator || !operator.id || !operator.name) {
    return res.status(400).json({ error: '请提供操作者信息' });
  }

  const batchId = uuidv4();
  const results = {
    success: [],
    failed: [],
    conflicts: []
  };

  const session = await PreparedMeal.startSession();
  session.startTransaction();

  try {
    for (const sku of skus) {
      const preparedMeal = await PreparedMeal.findOne({ sku }).session(session);
      if (!preparedMeal) {
        results.failed.push({ sku, error: '预制菜不存在' });
        continue;
      }

      const previousStatus = preparedMeal.status;

      const inventoryQuery = { sku };
      if (storeCodes && storeCodes.length > 0) {
        inventoryQuery.storeCode = { $in: storeCodes };
      }
      const inventories = await Inventory.find(inventoryQuery).session(session);
      
      const storesWithInventory = inventories.filter(inv => inv.availableQuantity > 0);
      
      if (storesWithInventory.length > 0 && !forceOffShelves) {
        for (const inv of storesWithInventory) {
          await OffShelvesHistory.create([{
            batchId,
            preparedMealId: preparedMeal._id,
            storeId: inv.storeId,
            sku: preparedMeal.sku,
            storeCode: inv.storeCode,
            previousStatus,
            newStatus: previousStatus,
            reason,
            reasonDetail,
            operationSource,
            operator,
            hasInventoryConflict: true,
            inventoryConflictDetail: {
              storeCode: inv.storeCode,
              quantity: inv.quantity,
              availableQuantity: inv.availableQuantity
            },
            forceOffShelves: false,
            evidence
          }], { session });

          results.conflicts.push({
            sku: preparedMeal.sku,
            name: preparedMeal.name,
            storeCode: inv.storeCode,
            availableQuantity: inv.availableQuantity,
            message: '门店仍有库存，如需立即下架请使用强制下架'
          });
        }
        continue;
      }

      preparedMeal.status = PreparedMealStatus.OFF_SHELVES_PROCESSING;
      preparedMeal.updatedBy = operator.id;
      await preparedMeal.save({ session });

      await OffShelvesHistory.create([{
        batchId,
        preparedMealId: preparedMeal._id,
        sku: preparedMeal.sku,
        previousStatus,
        newStatus: PreparedMealStatus.OFF_SHELVES_PROCESSING,
        reason,
        reasonDetail,
        operationSource,
        operator,
        hasInventoryConflict: storesWithInventory.length > 0,
        inventoryConflictDetail: storesWithInventory.length > 0 ? {
          storeCode: storesWithInventory[0].storeCode,
          quantity: storesWithInventory[0].quantity,
          availableQuantity: storesWithInventory[0].availableQuantity
        } : null,
        forceOffShelves,
        evidence
      }], { session });

      results.success.push({
        sku: preparedMeal.sku,
        name: preparedMeal.name,
        previousStatus,
        newStatus: PreparedMealStatus.OFF_SHELVES_PROCESSING
      });
    }

    await session.commitTransaction();
    session.endSession();

    res.json({
      batchId,
      results,
      summary: {
        total: skus.length,
        success: results.success.length,
        failed: results.failed.length,
        conflicts: results.conflicts.length
      }
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({ error: error.message });
  }
};

const confirmOffShelved = async (req, res) => {
  const { skus, operator, remarks } = req.body;
  const batchId = uuidv4();

  try {
    const results = [];
    for (const sku of skus) {
      const preparedMeal = await PreparedMeal.findOne({ sku });
      if (!preparedMeal) continue;

      if (preparedMeal.status !== PreparedMealStatus.OFF_SHELVES_PROCESSING) {
        results.push({ sku, success: false, message: '预制菜不在下架处理中状态' });
        continue;
      }

      const previousStatus = preparedMeal.status;
      preparedMeal.status = PreparedMealStatus.OFF_SHELVED;
      preparedMeal.updatedBy = operator.id;
      await preparedMeal.save();

      const lastHistory = await OffShelvesHistory.findOne({ sku }).sort({ createdAt: -1 });

      await OffShelvesHistory.create({
        batchId,
        preparedMealId: preparedMeal._id,
        sku: preparedMeal.sku,
        previousStatus,
        newStatus: PreparedMealStatus.OFF_SHELVED,
        reason: lastHistory?.reason || OffShelvesReason.OTHER,
        reasonDetail: remarks || '确认下架完成',
        operationSource: OperationSource.HEADQUARTERS,
        operator,
        remarks
      });

      results.push({ sku, success: true, name: preparedMeal.name });
    }

    res.json({ batchId, results });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const recoverPreparedMeal = async (req, res) => {
  const { skus, operator, remarks } = req.body;
  const batchId = uuidv4();

  try {
    const results = [];
    for (const sku of skus) {
      const preparedMeal = await PreparedMeal.findOne({ sku });
      if (!preparedMeal) continue;

      if (preparedMeal.status !== PreparedMealStatus.OFF_SHELVED && preparedMeal.status !== PreparedMealStatus.RECOVERABLE) {
        results.push({ sku, success: false, message: '预制菜状态不可恢复' });
        continue;
      }

      const previousStatus = preparedMeal.status;
      preparedMeal.status = PreparedMealStatus.AVAILABLE;
      preparedMeal.updatedBy = operator.id;
      await preparedMeal.save();

      await OffShelvesHistory.create({
        batchId,
        preparedMealId: preparedMeal._id,
        sku: preparedMeal.sku,
        previousStatus,
        newStatus: PreparedMealStatus.AVAILABLE,
        reason: OffShelvesReason.OTHER,
        reasonDetail: remarks || '恢复上架',
        operationSource: OperationSource.HEADQUARTERS,
        operator,
        remarks
      });

      results.push({ sku, success: true, name: preparedMeal.name });
    }

    res.json({ batchId, results });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getPreparedMeals,
  getPreparedMealById,
  batchOffShelves,
  confirmOffShelved,
  recoverPreparedMeal
};
