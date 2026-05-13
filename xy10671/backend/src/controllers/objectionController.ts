import { Request, Response } from 'express';
import { PublicObjection, OperationLog, sequelize } from '../models';

export const getObjections = async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const objections = await PublicObjection.findAll({
      where: { projectId },
      order: [['objectionTime', 'DESC']]
    });
    res.json({ success: true, data: objections });
  } catch (error) {
    res.status(500).json({ success: false, message: '获取异议列表失败' });
  }
};

export const createObjection = async (req: Request, res: Response) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { projectId } = req.params;
    const { objectionPerson, objectionContent } = req.body;
    
    const objection = await PublicObjection.create({
      projectId,
      objectionPerson,
      objectionContent,
      objectionTime: new Date(),
      isResolved: false
    }, { transaction });
    
    await OperationLog.create({
      projectId,
      operationType: 'OBJECTION_CREATE',
      operationContent: `收到公示异议: ${objectionPerson}`,
      operator: objectionPerson
    }, { transaction });
    
    await transaction.commit();
    res.json({ success: true, data: objection });
  } catch (error) {
    await transaction.rollback();
    res.status(500).json({ success: false, message: '创建异议失败' });
  }
};

export const resolveObjection = async (req: Request, res: Response) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { id } = req.params;
    const { resolvedBy, resolutionContent } = req.body;
    
    const objection = await PublicObjection.findByPk(id, { transaction });
    if (!objection) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: '异议不存在' });
    }
    
    await objection.update({
      isResolved: true,
      resolvedBy,
      resolvedTime: new Date(),
      resolutionContent
    }, { transaction });
    
    await OperationLog.create({
      projectId: objection.projectId,
      operationType: 'OBJECTION_RESOLVE',
      operationContent: `处理公示异议: ${objection.objectionPerson}`,
      operator: resolvedBy
    }, { transaction });
    
    await transaction.commit();
    res.json({ success: true, data: objection });
  } catch (error) {
    await transaction.rollback();
    res.status(500).json({ success: false, message: '处理异议失败' });
  }
};
