const { StoreCollection, Store, PalletCode, User, DamagePhoto, ModificationHistory, OperationLog } = require('../models');
const businessRules = require('../services/businessRules');
const { recordUpdate, recordCreate } = require('../utils/history');
const moment = require('moment');

class StoreCollectionController {
  async create(req, res) {
    try {
      const userId = req.userId;
      const data = req.body;

      // 业务规则校验
      const validation = await businessRules.validate('store_collection', data);

      if (!validation.isValid) {
        return res.status(400).json({
          message: '数据校验失败',
          errors: validation.failedRules,
          scenario: validation.failedRules.some(r => r.isDuplicate) ? 'duplicate' : 'blocked'
        });
      }

      // 生成回收单号
      const collectionNo = `RC${moment().format('YYYYMMDDHHmmss')}${Math.floor(Math.random() * 1000)}`;

      const collection = await StoreCollection.create({
        ...data,
        collection_no: collectionNo,
        collection_status: validation.needReview ? 'pending_review' : 'verified',
        created_by: userId
      });

      // 记录创建历史
      await recordCreate('store_collections', collection.id, userId, data);

      // 记录操作日志
      await OperationLog.create({
        user_id: userId,
        operation: 'create',
        module: 'store_collection',
        record_id: collection.id,
        detail: `创建回收记录: ${collectionNo}`,
        ip_address: req.ip
      });

      const scenario = validation.needReview ? 'needs_review' : 'normal';

      res.status(201).json({
        message: '创建成功',
        data: collection,
        scenario,
        needReview: validation.needReview
      });
    } catch (error) {
      console.error('创建回收记录失败:', error);
      res.status(500).json({ message: '创建失败', error: error.message });
    }
  }

  async update(req, res) {
    try {
      const { id } = req.params;
      const userId = req.userId;
      const data = req.body;
      const { reason } = req.body;

      const collection = await StoreCollection.findByPk(id);
      if (!collection) {
        return res.status(404).json({ message: '记录不存在' });
      }

      // 业务规则校验
      const validation = await businessRules.validate('store_collection', { ...collection.toJSON(), ...data }, id);

      if (!validation.isValid) {
        return res.status(400).json({
          message: '数据校验失败',
          errors: validation.failedRules
        });
      }

      const oldData = collection.toJSON();

      // 更新数据
      await collection.update(data);

      // 记录修改历史
      await recordUpdate('store_collections', id, userId, oldData, data, reason);

      // 记录操作日志
      await OperationLog.create({
        user_id: userId,
        operation: 'update',
        module: 'store_collection',
        record_id: id,
        detail: `修改回收记录: ${collection.collection_no}, 原因: ${reason || '未说明'}`,
        ip_address: req.ip
      });

      res.json({
        message: '更新成功',
        data: collection
      });
    } catch (error) {
      console.error('更新回收记录失败:', error);
      res.status(500).json({ message: '更新失败', error: error.message });
    }
  }

  async review(req, res) {
    try {
      const { id } = req.params;
      const userId = req.userId;
      const { review_status, review_comment } = req.body;

      const collection = await StoreCollection.findByPk(id);
      if (!collection) {
        return res.status(404).json({ message: '记录不存在' });
      }

      const oldData = collection.toJSON();
      const newStatus = review_status === 'approve' ? 'verified' : 'rejected';

      await collection.update({
        collection_status: newStatus,
        verified_by: userId,
        verified_at: new Date()
      });

      // 记录修改历史
      await recordUpdate('store_collections', id, userId, oldData, {
        collection_status: newStatus,
        verified_by: userId,
        verified_at: new Date()
      }, review_comment);

      // 记录操作日志
      await OperationLog.create({
        user_id: userId,
        operation: 'review',
        module: 'store_collection',
        record_id: id,
        detail: `审核回收记录: ${collection.collection_no}, 结果: ${newStatus}, 意见: ${review_comment || '无'}`,
        ip_address: req.ip
      });

      res.json({
        message: '审核成功',
        data: collection
      });
    } catch (error) {
      console.error('审核失败:', error);
      res.status(500).json({ message: '审核失败', error: error.message });
    }
  }

  async getDetail(req, res) {
    try {
      const { id } = req.params;

      const collection = await StoreCollection.findByPk(id, {
        include: [
          { model: Store, as: 'Store' },
          { model: PalletCode, as: 'PalletCode' },
          { model: User, as: 'Creator' },
          { model: User, as: 'Verifier' },
          { model: DamagePhoto, as: 'DamagePhotos', include: [{ model: User, as: 'Creator' }, { model: User, as: 'Reviewer' }] }
        ]
      });

      if (!collection) {
        return res.status(404).json({ message: '记录不存在' });
      }

      // 获取修改历史时间线
      const history = await ModificationHistory.findAll({
        where: {
          table_name: 'store_collections',
          record_id: id
        },
        include: [{ model: User, as: 'User' }],
        order: [['modified_at', 'DESC']]
      });

      // 获取操作日志时间线
      const operationLogs = await OperationLog.findAll({
        where: {
          module: 'store_collection',
          record_id: id
        },
        include: [{ model: User, as: 'User' }],
        order: [['created_at', 'DESC']]
      });

      res.json({
        data: collection,
        timeline: [...history, ...operationLogs].sort((a, b) =>
          new Date(b.modified_at || b.created_at) - new Date(a.modified_at || a.created_at)
        )
      });
    } catch (error) {
      console.error('获取详情失败:', error);
      res.status(500).json({ message: '获取详情失败', error: error.message });
    }
  }

  async list(req, res) {
    try {
      const { page = 1, pageSize = 10, status, store_id, startDate, endDate } = req.query;

      const where = {};
      if (status) where.collection_status = status;
      if (store_id) where.store_id = store_id;
      if (startDate && endDate) {
        where.created_at = {
          [require('sequelize').Op.between]: [startDate, endDate]
        };
      }

      const { count, rows } = await StoreCollection.findAndCountAll({
        where,
        include: [
          { model: Store, as: 'Store' },
          { model: PalletCode, as: 'PalletCode' },
          { model: User, as: 'Creator' }
        ],
        order: [['created_at', 'DESC']],
        limit: parseInt(pageSize),
        offset: (parseInt(page) - 1) * parseInt(pageSize)
      });

      res.json({
        data: rows,
        total: count,
        page: parseInt(page),
        pageSize: parseInt(pageSize)
      });
    } catch (error) {
      console.error('获取列表失败:', error);
      res.status(500).json({ message: '获取列表失败', error: error.message });
    }
  }
}

module.exports = new StoreCollectionController();
