const { Op, fn, col } = require('sequelize');
const {
  Anomaly,
  BillRecord,
  Project,
  SharedService,
  User,
} = require('../db/models');

async function getAnomalies(req, res) {
  try {
    const {
      page = 1,
      pageSize = 20,
      billMonth,
      anomalyType,
      severity,
      status,
    } = req.query;

    const offset = (page - 1) * pageSize;
    const where = {};

    if (billMonth) where.billMonth = billMonth;
    if (anomalyType) where.anomalyType = anomalyType;
    if (severity) where.severity = severity;
    if (status) where.status = status;

    const { count, rows } = await Anomaly.findAndCountAll({
      where,
      include: [
        {
          model: BillRecord,
          as: 'billRecord',
          attributes: ['id', 'resourceId', 'resourceName', 'costAmount', 'tags', 'environment'],
        },
        {
          model: SharedService,
          as: 'sharedService',
          attributes: ['id', 'name', 'code'],
        },
        {
          model: User,
          as: 'resolvedBy',
          attributes: ['id', 'fullName'],
        },
      ],
      order: [
        ['severity', 'DESC'],
        ['status', 'ASC'],
        ['createdAt', 'DESC'],
      ],
      offset,
      limit: parseInt(pageSize),
    });

    const stats = await Anomaly.findAll({
      where: billMonth ? { billMonth } : {},
      attributes: [
        'anomalyType',
        'severity',
        'status',
        [fn('COUNT', col('id')), 'count'],
      ],
      group: ['anomalyType', 'severity', 'status'],
    });

    res.json({
      success: true,
      data: rows,
      stats,
      pagination: {
        total: count,
        page: parseInt(page),
        pageSize: parseInt(pageSize),
      },
    });
  } catch (error) {
    console.error('获取异常列表失败:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
}

async function getAnomalyById(req, res) {
  try {
    const { id } = req.params;
    const anomaly = await Anomaly.findByPk(id, {
      include: [
        {
          model: BillRecord,
          as: 'billRecord',
          include: [
            { model: Project, as: 'project', attributes: ['id', 'name', 'code'] },
          ],
        },
        {
          model: SharedService,
          as: 'sharedService',
        },
        {
          model: User,
          as: 'resolvedBy',
          attributes: ['id', 'fullName', 'email'],
        },
      ],
    });

    if (!anomaly) {
      return res.status(404).json({ success: false, message: '异常记录不存在' });
    }

    res.json({ success: true, data: anomaly });
  } catch (error) {
    console.error('获取异常详情失败:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
}

async function updateAnomalyStatus(req, res) {
  try {
    const { id } = req.params;
    const { status, resolutionNote } = req.body;

    const anomaly = await Anomaly.findByPk(id);
    if (!anomaly) {
      return res.status(404).json({ success: false, message: '异常记录不存在' });
    }

    const updateData = {
      status: status || anomaly.status,
      resolvedBy: req.user.id,
      resolvedAt: new Date(),
      resolutionNote: resolutionNote || anomaly.resolutionNote,
    };

    await anomaly.update(updateData);

    res.json({ success: true, message: '异常状态更新成功', data: anomaly });
  } catch (error) {
    console.error('更新异常状态失败:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
}

async function getAnomalyStats(req, res) {
  try {
    const { billMonth } = req.query;
    const where = billMonth ? { billMonth } : {};

    const [byType, bySeverity, byStatus] = await Promise.all([
      Anomaly.findAll({
        where,
        attributes: ['anomalyType', [fn('COUNT', col('id')), 'count']],
        group: ['anomalyType'],
      }),
      Anomaly.findAll({
        where,
        attributes: ['severity', [fn('COUNT', col('id')), 'count']],
        group: ['severity'],
      }),
      Anomaly.findAll({
        where,
        attributes: ['status', [fn('COUNT', col('id')), 'count']],
        group: ['status'],
      }),
    ]);

    const typeMap = {
      no_tags: '无标签资源',
      tag_conflict: '标签冲突',
      allocation_over_total: '分摊超额',
      duplicate_import: '重复导入',
      allocation_ratio_invalid: '分摊比例异常',
    };

    const severityMap = {
      low: '低',
      medium: '中',
      high: '高',
      critical: '严重',
    };

    const statusMap = {
      open: '待处理',
      in_progress: '处理中',
      resolved: '已解决',
      ignored: '已忽略',
    };

    res.json({
      success: true,
      data: {
        byType: byType.map((item) => ({
          type: item.anomalyType,
          typeName: typeMap[item.anomalyType] || item.anomalyType,
          count: parseInt(item.get('count')),
        })),
        bySeverity: bySeverity.map((item) => ({
          severity: item.severity,
          severityName: severityMap[item.severity] || item.severity,
          count: parseInt(item.get('count')),
        })),
        byStatus: byStatus.map((item) => ({
          status: item.status,
          statusName: statusMap[item.status] || item.status,
          count: parseInt(item.get('count')),
        })),
      },
    });
  } catch (error) {
    console.error('获取异常统计失败:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
}

module.exports = {
  getAnomalies,
  getAnomalyById,
  updateAnomalyStatus,
  getAnomalyStats,
};
