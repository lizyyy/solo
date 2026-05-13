import { Request, Response } from 'express';
import { ConstructionNode, Project, InspectionPhoto, OperationLog, sequelize } from '../models';
import { canCompleteNode, completeNode } from '../utils/nodeInterceptor';
import { processDeduction, checkDeductionStatus } from '../utils/deductionUtils';

export const getNodes = async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const nodes = await ConstructionNode.findAll({
      where: { projectId },
      order: [['nodeOrder', 'ASC']],
      include: [{ association: 'nodePhotos' }]
    });
    res.json({ success: true, data: nodes });
  } catch (error) {
    res.status(500).json({ success: false, message: '获取施工节点失败' });
  }
};

export const getNodeById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const node = await ConstructionNode.findByPk(id, {
      include: [{ association: 'nodePhotos' }]
    });
    
    if (!node) {
      return res.status(404).json({ success: false, message: '施工节点不存在' });
    }
    
    res.json({ success: true, data: node });
  } catch (error) {
    res.status(500).json({ success: false, message: '获取施工节点失败' });
  }
};

export const completeConstructionNode = async (req: Request, res: Response) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { id } = req.params;
    const { completedBy, remarks } = req.body;
    
    const result = await completeNode(id, completedBy, remarks);
    
    if (!result.success) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: result.message });
    }
    
    const node = await ConstructionNode.findByPk(id, { transaction });
    if (node && result.nextNodeId) {
      await Project.update(
        { currentNodeId: result.nextNodeId },
        { where: { id: node.projectId }, transaction }
      );
    }
    
    await OperationLog.create({
      projectId: node!.projectId,
      operationType: 'NODE_COMPLETE',
      operationContent: `完成施工节点: ${node!.nodeName}`,
      operator: completedBy
    }, { transaction });
    
    await transaction.commit();
    res.json({ success: true, data: node, nextNodeId: result.nextNodeId });
  } catch (error) {
    await transaction.rollback();
    res.status(500).json({ success: false, message: '完成节点失败' });
  }
};

export const checkNodeCanComplete = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await canCompleteNode(id);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: '检查节点状态失败' });
  }
};

export const processNodeDeduction = async (req: Request, res: Response) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { id } = req.params;
    const { requestId, amount, processedBy } = req.body;
    
    const result = await processDeduction(id, requestId, amount, processedBy);
    
    if (!result.success && !result.alreadyProcessed) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: result.message });
    }
    
    const node = await ConstructionNode.findByPk(id, { transaction });
    
    await OperationLog.create({
      projectId: node!.projectId,
      operationType: 'DEDUCTION',
      operationContent: result.alreadyProcessed 
        ? `重复回调检测: 请求 ${requestId} 已处理过` 
        : `完成扣减: ${node!.nodeName}, 金额: ${amount}`,
      operator: processedBy
    }, { transaction });
    
    await transaction.commit();
    res.json({ 
      success: true, 
      data: node, 
      alreadyProcessed: result.alreadyProcessed,
      message: result.message
    });
  } catch (error) {
    await transaction.rollback();
    res.status(500).json({ success: false, message: '扣减处理失败' });
  }
};

export const getDeductionStatus = async (req: Request, res: Response) => {
  try {
    const { requestId } = req.params;
    const result = await checkDeductionStatus(requestId);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: '检查扣减状态失败' });
  }
};
