const Incident = require('../models/Incident');
const XLSX = require('xlsx');
const Joi = require('joi');

const incidentSchema = Joi.object({
  title: Joi.string().required(),
  description: Joi.string().required(),
  severity: Joi.string().valid('critical', 'high', 'medium', 'low').required(),
  startTime: Joi.date().required(),
  detectedBy: Joi.string().required(),
  owner: Joi.string().required(),
  tags: Joi.array().items(Joi.string()),
});

const statusTransitionRules = {
  detecting: ['verifying', 'archived'],
  verifying: ['fixing', 'detecting', 'archived'],
  fixing: ['monitoring', 'verifying', 'archived'],
  monitoring: ['reviewing', 'fixing', 'archived'],
  reviewing: ['archived', 'monitoring'],
  archived: [],
};

exports.createIncident = async (req, res) => {
  try {
    const { error, value } = incidentSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const incident = new Incident({
      ...value,
      status: 'detecting',
      timelines: [{
        timestamp: new Date(),
        event: '事故创建',
        operator: value.detectedBy,
        description: '事故单已创建，进入发现阶段',
      }],
    });

    await incident.save();
    res.status(201).json(incident);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getIncidents = async (req, res) => {
  try {
    const { status, severity, page = 1, limit = 20 } = req.query;
    const query = {};
    
    if (status) query.status = status;
    if (severity) query.severity = severity;

    const incidents = await Incident.find(query)
      .sort({ startTime: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));
    
    const total = await Incident.countDocuments(query);

    res.json({
      data: incidents,
      pagination: { page: parseInt(page), limit: parseInt(limit), total },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getIncidentById = async (req, res) => {
  try {
    const incident = await Incident.findById(req.params.id);
    if (!incident) {
      return res.status(404).json({ error: 'Incident not found' });
    }
    res.json(incident);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateIncidentStatus = async (req, res) => {
  try {
    const { newStatus, operator, reason } = req.body;
    const incident = await Incident.findById(req.params.id);

    if (!incident) {
      return res.status(404).json({ error: 'Incident not found' });
    }

    if (!statusTransitionRules[incident.status].includes(newStatus)) {
      return res.status(400).json({
        error: `Invalid status transition from ${incident.status} to ${newStatus}`,
        allowedTransitions: statusTransitionRules[incident.status],
      });
    }

    const oldStatus = incident.status;
    incident.status = newStatus;

    if (newStatus === 'archived') {
      incident.archivedAt = new Date();
      incident.archivedBy = operator;
    }

    if (newStatus === 'monitoring' && oldStatus === 'fixing') {
      incident.endTime = new Date();
    }

    incident.timelines.push({
      timestamp: new Date(),
      event: `状态变更: ${oldStatus} -> ${newStatus}`,
      operator,
      description: reason || '状态变更',
    });

    await incident.save();
    res.json(incident);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.addTimeline = async (req, res) => {
  try {
    const incident = await Incident.findById(req.params.id);
    if (!incident) {
      return res.status(404).json({ error: 'Incident not found' });
    }

    incident.timelines.push({
      ...req.body,
      timestamp: req.body.timestamp || new Date(),
    });

    incident.timelines.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    await incident.save();
    res.json(incident);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.addEvidence = async (req, res) => {
  try {
    const incident = await Incident.findById(req.params.id);
    if (!incident) {
      return res.status(404).json({ error: 'Incident not found' });
    }

    incident.evidences.push(req.body);
    await incident.save();
    res.json(incident);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.addAffectedInterface = async (req, res) => {
  try {
    const incident = await Incident.findById(req.params.id);
    if (!incident) {
      return res.status(404).json({ error: 'Incident not found' });
    }

    incident.affectedInterfaces.push(req.body);
    await incident.save();
    res.json(incident);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.addActionItem = async (req, res) => {
  try {
    const incident = await Incident.findById(req.params.id);
    if (!incident) {
      return res.status(404).json({ error: 'Incident not found' });
    }

    incident.actionItems.push(req.body);
    await incident.save();
    res.json(incident);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateActionItemStatus = async (req, res) => {
  try {
    const incident = await Incident.findById(req.params.id);
    if (!incident) {
      return res.status(404).json({ error: 'Incident not found' });
    }

    const actionItem = incident.actionItems.id(req.params.actionItemId);
    if (!actionItem) {
      return res.status(404).json({ error: 'Action item not found' });
    }

    const oldStatus = actionItem.status;
    actionItem.status = req.body.status;
    if (req.body.status === 'completed') {
      actionItem.completedAt = new Date();
    }

    incident.timelines.push({
      timestamp: new Date(),
      event: `行动项状态变更: ${oldStatus} -> ${req.body.status}`,
      operator: req.body.operator,
      description: `行动项: ${actionItem.title}`,
    });

    await incident.save();
    res.json(incident);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.setReviewConclusion = async (req, res) => {
  try {
    const incident = await Incident.findById(req.params.id);
    if (!incident) {
      return res.status(404).json({ error: 'Incident not found' });
    }

    incident.reviewConclusion = {
      ...req.body,
      reviewedAt: new Date(),
    };

    incident.timelines.push({
      timestamp: new Date(),
      event: '复盘结论录入',
      operator: req.body.reviewedBy,
      description: '复盘结论已录入',
    });

    await incident.save();
    res.json(incident);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.addCompensation = async (req, res) => {
  try {
    const incident = await Incident.findById(req.params.id);
    if (!incident) {
      return res.status(404).json({ error: 'Incident not found' });
    }

    incident.compensationRecords.push({
      ...req.body,
      executedAt: new Date(),
    });

    incident.timelines.push({
      timestamp: new Date(),
      event: '手动补偿执行',
      operator: req.body.operator,
      description: req.body.description,
    });

    await incident.save();
    res.json(incident);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.addFailureReason = async (req, res) => {
  try {
    const incident = await Incident.findById(req.params.id);
    if (!incident) {
      return res.status(404).json({ error: 'Incident not found' });
    }

    if (!incident.failureReasons) {
      incident.failureReasons = [];
    }
    incident.failureReasons.push(req.body.reason);

    await incident.save();
    res.json(incident);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.exportIncident = async (req, res) => {
  try {
    const incident = await Incident.findById(req.params.id);
    if (!incident) {
      return res.status(404).json({ error: 'Incident not found' });
    }

    const exportData = {
      基本信息: [
        { 字段: '事故ID', 值: incident.incidentId },
        { 字段: '标题', 值: incident.title },
        { 字段: '描述', 值: incident.description },
        { 字段: '严重程度', 值: incident.severity },
        { 字段: '状态', 值: incident.status },
        { 字段: '开始时间', 值: incident.startTime?.toLocaleString() },
        { 字段: '结束时间', 值: incident.endTime?.toLocaleString() || '未结束' },
        { 字段: '责任人', 值: incident.owner },
        { 字段: '发现人', 值: incident.detectedBy },
      ],
      影响接口: incident.affectedInterfaces.map((a, i) => ({
        序号: i + 1,
        接口名称: a.name,
        HTTP方法: a.method,
        路径: a.path,
        影响数量: a.affectedCount,
        错误率: `${a.errorRate}%`,
        客户影响: a.customerImpact,
      })),
      证据链: incident.evidences.map((e, i) => ({
        序号: i + 1,
        类型: e.type,
        标题: e.title,
        链接地址: e.url,
        上传人: e.uploadedBy,
        描述: e.description,
      })),
      时间线: incident.timelines.map((t, i) => ({
        序号: i + 1,
        时间: new Date(t.timestamp).toLocaleString(),
        事件: t.event,
        操作人: t.operator,
        描述: t.description,
      })),
      行动项: incident.actionItems.map((a, i) => ({
        序号: i + 1,
        标题: a.title,
        描述: a.description,
        负责人: a.assignee,
        状态: a.status,
        优先级: a.priority,
        截止时间: a.dueDate ? new Date(a.dueDate).toLocaleString() : '无',
      })),
      失败原因追溯: (incident.failureReasons || []).map((r, i) => ({
        序号: i + 1,
        失败原因: r,
      })),
      手动补偿记录: incident.compensationRecords.map((c, i) => ({
        序号: i + 1,
        补偿类型: c.type,
        补偿描述: c.description,
        操作人: c.operator,
        执行结果: c.result,
        执行时间: new Date(c.executedAt).toLocaleString(),
      })),
    };

    if (incident.reviewConclusion) {
      exportData.复盘结论 = [
        { 字段: '根因', 值: incident.reviewConclusion.rootCause },
        { 字段: '根因分类', 值: incident.reviewConclusion.rootCauseCategory },
        { 字段: '影响总结', 值: incident.reviewConclusion.impactSummary },
        { 字段: '经验教训', 值: incident.reviewConclusion.lessonsLearned },
        { 字段: '改进措施', 值: (incident.reviewConclusion.improvementMeasures || []).join('; ') },
        { 字段: '复盘人', 值: incident.reviewConclusion.reviewedBy },
      ];
    }

    const wb = XLSX.utils.book_new();
    Object.entries(exportData).forEach(([sheetName, data]) => {
      const ws = XLSX.utils.json_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    });

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=incident-${incident.incidentId}.xlsx`);
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getTimelineSummary = async (req, res) => {
  try {
    const incident = await Incident.findById(req.params.id);
    if (!incident) {
      return res.status(404).json({ error: 'Incident not found' });
    }

    const phases = {
      detecting: { start: null, end: null, events: [] },
      verifying: { start: null, end: null, events: [] },
      fixing: { start: null, end: null, events: [] },
      monitoring: { start: null, end: null, events: [] },
      reviewing: { start: null, end: null, events: [] },
    };

    let currentPhase = 'detecting';
    incident.timelines.forEach((timeline) => {
      const match = timeline.event.match(/状态变更: (\w+) -> (\w+)/);
      if (match) {
        phases[match[1]].end = timeline.timestamp;
        phases[match[2]].start = timeline.timestamp;
        currentPhase = match[2];
      }
      phases[currentPhase].events.push(timeline);
    });

    if (!phases.detecting.start && incident.timelines.length > 0) {
      phases.detecting.start = incident.timelines[0].timestamp;
    }

    const summary = Object.entries(phases)
      .filter(([, data]) => data.start || data.events.length > 0)
      .map(([phase, data]) => ({
        phase,
        duration: data.start && data.end 
          ? Math.round((new Date(data.end) - new Date(data.start)) / 60000)
          : null,
        eventCount: data.events.length,
        ...data,
      }));

    res.json({ summary, totalEvents: incident.timelines.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
