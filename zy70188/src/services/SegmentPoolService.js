const { Op } = require('sequelize');
const { SegmentPool } = require('../models');
const logger = require('../config/logger');
const { createAuditLog, actions, modules } = require('../utils/audit');
const { 
  ResourceNotFoundError, 
  ValidationError,
  ConcurrentModificationError 
} = require('../utils/errors');

class SegmentPoolService {
  async createSegmentPool(data, operator = {}) {
    if (data.start_number >= data.end_number) {
      throw new ValidationError('起始号码必须小于结束号码');
    }

    const existSegment = await SegmentPool.findOne({
      where: { segment_code: data.segment_code }
    });

    if (existSegment) {
      throw new ValidationError(`号段编码「${data.segment_code}」已存在`);
    }

    const segmentPool = await SegmentPool.create({
      segment_code: data.segment_code,
      segment_name: data.segment_name,
      prefix: data.prefix || '',
      start_number: data.start_number,
      end_number: data.end_number,
      current_number: data.start_number - 1,
      status: data.status || 'active',
      description: data.description || '',
      created_by: operator.id,
      updated_by: operator.id
    });

    await createAuditLog({
      action: actions.CREATE_SEGMENT,
      actionDescription: `创建号段「${segmentPool.segment_name}」(${segmentPool.segment_code})，号段范围: ${segmentPool.start_number}-${segmentPool.end_number}`,
      module: modules.SEGMENT_POOL,
      operatorId: operator.id,
      operatorName: operator.name,
      afterData: segmentPool
    });

    logger.info(`创建号段成功: ${segmentPool.segment_code}`);
    return segmentPool;
  }

  async listSegmentPools(params = {}) {
    const { page = 1, pageSize = 20, status, keyword } = params;
    const offset = (page - 1) * pageSize;

    const where = {};
    if (status) {
      where.status = status;
    }
    if (keyword) {
      where[Op.or] = [
        { segment_code: { [Op.like]: `%${keyword}%` } },
        { segment_name: { [Op.like]: `%${keyword}%` } }
      ];
    }

    const { count, rows } = await SegmentPool.findAndCountAll({
      where,
      order: [['created_at', 'DESC']],
      offset,
      limit: pageSize
    });

    const segments = rows.map(segment => ({
      ...segment.toJSON(),
      available_count: segment.getAvailableCount(),
      is_exhausted: segment.isExhausted()
    }));

    return {
      list: segments,
      pagination: {
        page,
        pageSize,
        total: count,
        totalPages: Math.ceil(count / pageSize)
      }
    };
  }

  async getSegmentPoolById(id) {
    const segmentPool = await SegmentPool.findByPk(id);
    if (!segmentPool) {
      throw new ResourceNotFoundError('号段池不存在');
    }
    return {
      ...segmentPool.toJSON(),
      available_count: segmentPool.getAvailableCount(),
      is_exhausted: segmentPool.isExhausted()
    };
  }

  async updateSegmentPool(id, data, operator = {}) {
    const segmentPool = await SegmentPool.findByPk(id);
    if (!segmentPool) {
      throw new ResourceNotFoundError('号段池不存在');
    }

    const beforeData = { ...segmentPool.toJSON() };

    if (data.segment_code && data.segment_code !== segmentPool.segment_code) {
      const existSegment = await SegmentPool.findOne({
        where: { 
          segment_code: data.segment_code,
          id: { [Op.ne]: id }
        }
      });
      if (existSegment) {
        throw new ValidationError(`号段编码「${data.segment_code}」已存在`);
      }
    }

    await segmentPool.update({
      segment_name: data.segment_name || segmentPool.segment_name,
      prefix: data.prefix !== undefined ? data.prefix : segmentPool.prefix,
      description: data.description !== undefined ? data.description : segmentPool.description,
      status: data.status || segmentPool.status,
      updated_by: operator.id
    });

    await createAuditLog({
      action: actions.UPDATE_SEGMENT,
      actionDescription: `更新号段「${segmentPool.segment_name}」(${segmentPool.segment_code})信息`,
      module: modules.SEGMENT_POOL,
      operatorId: operator.id,
      operatorName: operator.name,
      beforeData,
      afterData: segmentPool
    });

    logger.info(`更新号段成功: ${segmentPool.segment_code}`);
    return segmentPool;
  }

  async updateCurrentNumber(segmentPoolId, newNumber, version) {
    const segmentPool = await SegmentPool.findByPk(segmentPoolId);
    if (!segmentPool) {
      throw new ResourceNotFoundError('号段池不存在');
    }

    if (segmentPool.version !== version) {
      throw new ConcurrentModificationError('号段池数据已被其他操作修改');
    }

    const result = await SegmentPool.update(
      {
        current_number: newNumber,
        version: version + 1
      },
      {
        where: {
          id: segmentPoolId,
          version: version
        }
      }
    );

    if (result[0] === 0) {
      throw new ConcurrentModificationError('号段池更新失败，可能已被其他操作修改');
    }

    return true;
  }

  async getActiveSegmentPool() {
    const segmentPool = await SegmentPool.findOne({
      where: { status: 'active' },
      order: [['created_at', 'ASC']]
    });
    return segmentPool;
  }

  async getSegmentPoolStats() {
    const totalSegments = await SegmentPool.count();
    const activeSegments = await SegmentPool.count({ where: { status: 'active' } });
    const exhaustedSegments = await SegmentPool.count({ where: { status: 'exhausted' } });
    
    const activePools = await SegmentPool.findAll({
      where: { status: 'active' },
      attributes: ['start_number', 'end_number', 'current_number']
    });

    let totalAvailable = 0;
    let totalUsed = 0;
    activePools.forEach(pool => {
      totalUsed += pool.current_number - pool.start_number + 1;
      totalAvailable += pool.end_number - pool.current_number;
    });

    return {
      total_segments: totalSegments,
      active_segments: activeSegments,
      exhausted_segments: exhaustedSegments,
      total_used: totalUsed,
      total_available: totalAvailable
    };
  }
}

module.exports = new SegmentPoolService();
