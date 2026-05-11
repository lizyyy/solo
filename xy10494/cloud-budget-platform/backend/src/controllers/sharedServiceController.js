const { Op } = require('sequelize');
const { SharedService, AllocationRatio, Project } = require('../db/models');

async function getSharedServices(req, res) {
  try {
    const { isActive } = req.query;
    const where = {};

    if (isActive !== undefined && isActive !== '') {
      where.isActive = isActive === 'true';
    }

    const services = await SharedService.findAll({
      where,
      include: [
        {
          model: AllocationRatio,
          as: 'ratios',
          where: { isActive: true },
          required: false,
          include: [
            { model: Project, as: 'project', attributes: ['id', 'name', 'code'] },
          ],
        },
      ],
      order: [['createdAt', 'DESC']],
    });

    res.json({ success: true, data: services });
  } catch (error) {
    console.error('获取共享服务失败:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
}

async function getSharedServiceById(req, res) {
  try {
    const { id } = req.params;
    const service = await SharedService.findByPk(id, {
      include: [
        {
          model: AllocationRatio,
          as: 'ratios',
          order: [['effectiveMonth', 'DESC']],
          include: [
            { model: Project, as: 'project', attributes: ['id', 'name', 'code'] },
          ],
        },
      ],
    });

    if (!service) {
      return res.status(404).json({ success: false, message: '共享服务不存在' });
    }

    res.json({ success: true, data: service });
  } catch (error) {
    console.error('获取共享服务详情失败:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
}

async function createSharedService(req, res) {
  try {
    const { name, code, description, tagKey, tagValue } = req.body;

    const existing = await SharedService.findOne({ where: { code } });
    if (existing) {
      return res.status(400).json({ success: false, message: '服务代码已存在' });
    }

    const service = await SharedService.create({
      name,
      code,
      description,
      tagKey,
      tagValue,
      isActive: true,
    });

    res.json({ success: true, data: service, message: '共享服务创建成功' });
  } catch (error) {
    console.error('创建共享服务失败:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
}

async function updateSharedService(req, res) {
  try {
    const { id } = req.params;
    const { name, description, tagKey, tagValue, isActive } = req.body;

    const service = await SharedService.findByPk(id);
    if (!service) {
      return res.status(404).json({ success: false, message: '共享服务不存在' });
    }

    await service.update({
      name,
      description,
      tagKey,
      tagValue,
      isActive: isActive !== undefined ? isActive : service.isActive,
    });

    res.json({ success: true, data: service, message: '共享服务更新成功' });
  } catch (error) {
    console.error('更新共享服务失败:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
}

async function deleteSharedService(req, res) {
  try {
    const { id } = req.params;
    const service = await SharedService.findByPk(id);

    if (!service) {
      return res.status(404).json({ success: false, message: '共享服务不存在' });
    }

    await service.update({ isActive: false });

    res.json({ success: true, message: '共享服务已停用' });
  } catch (error) {
    console.error('删除共享服务失败:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
}

async function getAllocationRatios(req, res) {
  try {
    const { sharedServiceId, effectiveMonth } = req.params;
    const where = { sharedServiceId, isActive: true };

    if (effectiveMonth) {
      where.effectiveMonth = effectiveMonth;
    }

    const ratios = await AllocationRatio.findAll({
      where,
      include: [
        { model: Project, as: 'project', attributes: ['id', 'name', 'code'] },
      ],
      order: [['createdAt', 'DESC']],
    });

    const totalRatio = ratios.reduce((sum, r) => sum + parseFloat(r.ratio), 0);

    res.json({
      success: true,
      data: ratios,
      totalRatio: parseFloat(totalRatio.toFixed(4)),
    });
  } catch (error) {
    console.error('获取分摊比例失败:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
}

async function createOrUpdateAllocationRatios(req, res) {
  try {
    const { sharedServiceId } = req.params;
    const { ratios, effectiveMonth } = req.body;

    if (!Array.isArray(ratios) || ratios.length === 0) {
      return res.status(400).json({ success: false, message: '分摊比例不能为空' });
    }

    const totalRatio = ratios.reduce((sum, r) => sum + parseFloat(r.ratio), 0);
    if (Math.abs(totalRatio - 1) > 0.0001) {
      return res.status(400).json({
        success: false,
        message: `分摊比例总和必须为100%，当前为 ${(totalRatio * 100).toFixed(2)}%`,
      });
    }

    await AllocationRatio.update(
      { isActive: false },
      { where: { sharedServiceId, effectiveMonth, isActive: true } }
    );

    const newRatios = await AllocationRatio.bulkCreate(
      ratios.map((r) => ({
        sharedServiceId,
        projectId: r.projectId,
        ratio: parseFloat(r.ratio),
        effectiveMonth,
        isActive: true,
      }))
    );

    res.json({ success: true, data: newRatios, message: '分摊比例保存成功' });
  } catch (error) {
    console.error('保存分摊比例失败:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
}

module.exports = {
  getSharedServices,
  getSharedServiceById,
  createSharedService,
  updateSharedService,
  deleteSharedService,
  getAllocationRatios,
  createOrUpdateAllocationRatios,
};
