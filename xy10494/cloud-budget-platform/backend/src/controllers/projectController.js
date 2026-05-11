const { Op } = require('sequelize');
const { Project, TagRule, User } = require('../db/models');

async function getProjects(req, res) {
  try {
    const { page = 1, pageSize = 10, search = '', isActive } = req.query;
    const offset = (page - 1) * pageSize;
    const where = {};

    if (search) {
      where[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { code: { [Op.iLike]: `%${search}%` } },
      ];
    }

    if (isActive !== undefined && isActive !== '') {
      where.isActive = isActive === 'true';
    }

    const { count, rows } = await Project.findAndCountAll({
      where,
      include: [
        { model: User, as: 'owner', attributes: ['id', 'fullName', 'email'] },
        { model: TagRule, as: 'tagRules', where: { isActive: true }, required: false },
      ],
      order: [['createdAt', 'DESC']],
      offset,
      limit: parseInt(pageSize),
    });

    res.json({
      success: true,
      data: rows,
      pagination: {
        total: count,
        page: parseInt(page),
        pageSize: parseInt(pageSize),
      },
    });
  } catch (error) {
    console.error('获取项目列表失败:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
}

async function getProjectById(req, res) {
  try {
    const { id } = req.params;
    const project = await Project.findByPk(id, {
      include: [
        { model: User, as: 'owner', attributes: ['id', 'fullName', 'email'] },
        { model: TagRule, as: 'tagRules', order: [['priority', 'DESC']] },
      ],
    });

    if (!project) {
      return res.status(404).json({ success: false, message: '项目不存在' });
    }

    res.json({ success: true, data: project });
  } catch (error) {
    console.error('获取项目详情失败:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
}

async function createProject(req, res) {
  try {
    const { name, code, description, budgetAmount, budgetPeriod, ownerId } = req.body;

    const existing = await Project.findOne({ where: { code } });
    if (existing) {
      return res.status(400).json({ success: false, message: '项目代码已存在' });
    }

    const project = await Project.create({
      name,
      code,
      description,
      budgetAmount: parseFloat(budgetAmount) || 0,
      budgetPeriod: budgetPeriod || 'monthly',
      ownerId,
      isActive: true,
    });

    res.json({ success: true, data: project, message: '项目创建成功' });
  } catch (error) {
    console.error('创建项目失败:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
}

async function updateProject(req, res) {
  try {
    const { id } = req.params;
    const { name, description, budgetAmount, budgetPeriod, ownerId, isActive } = req.body;

    const project = await Project.findByPk(id);
    if (!project) {
      return res.status(404).json({ success: false, message: '项目不存在' });
    }

    await project.update({
      name,
      description,
      budgetAmount: budgetAmount !== undefined ? parseFloat(budgetAmount) : project.budgetAmount,
      budgetPeriod: budgetPeriod || project.budgetPeriod,
      ownerId,
      isActive: isActive !== undefined ? isActive : project.isActive,
    });

    res.json({ success: true, data: project, message: '项目更新成功' });
  } catch (error) {
    console.error('更新项目失败:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
}

async function deleteProject(req, res) {
  try {
    const { id } = req.params;
    const project = await Project.findByPk(id);

    if (!project) {
      return res.status(404).json({ success: false, message: '项目不存在' });
    }

    await project.update({ isActive: false });

    res.json({ success: true, message: '项目已停用' });
  } catch (error) {
    console.error('删除项目失败:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
}

async function getTagRules(req, res) {
  try {
    const { projectId } = req.params;
    const rules = await TagRule.findAll({
      where: { projectId },
      order: [['priority', 'DESC']],
    });

    res.json({ success: true, data: rules });
  } catch (error) {
    console.error('获取标签规则失败:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
}

async function createTagRule(req, res) {
  try {
    const { projectId } = req.params;
    const { tagKey, tagValue, matchType, priority } = req.body;

    const rule = await TagRule.create({
      projectId,
      tagKey,
      tagValue,
      matchType: matchType || 'exact',
      priority: priority !== undefined ? parseInt(priority) : 0,
      isActive: true,
    });

    res.json({ success: true, data: rule, message: '标签规则创建成功' });
  } catch (error) {
    console.error('创建标签规则失败:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
}

async function updateTagRule(req, res) {
  try {
    const { id } = req.params;
    const { tagKey, tagValue, matchType, priority, isActive } = req.body;

    const rule = await TagRule.findByPk(id);
    if (!rule) {
      return res.status(404).json({ success: false, message: '标签规则不存在' });
    }

    await rule.update({
      tagKey: tagKey || rule.tagKey,
      tagValue: tagValue || rule.tagValue,
      matchType: matchType || rule.matchType,
      priority: priority !== undefined ? parseInt(priority) : rule.priority,
      isActive: isActive !== undefined ? isActive : rule.isActive,
    });

    res.json({ success: true, data: rule, message: '标签规则更新成功' });
  } catch (error) {
    console.error('更新标签规则失败:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
}

async function deleteTagRule(req, res) {
  try {
    const { id } = req.params;
    const rule = await TagRule.findByPk(id);

    if (!rule) {
      return res.status(404).json({ success: false, message: '标签规则不存在' });
    }

    await rule.destroy();

    res.json({ success: true, message: '标签规则删除成功' });
  } catch (error) {
    console.error('删除标签规则失败:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
}

module.exports = {
  getProjects,
  getProjectById,
  createProject,
  updateProject,
  deleteProject,
  getTagRules,
  createTagRule,
  updateTagRule,
  deleteTagRule,
};
