import { Request, Response } from 'express';
import { Project, OperationLog, ConstructionNode, sequelize } from '../models';
import { ProjectStatus } from '../types';
import { recordChangeHistory } from '../utils/historyUtils';

const statusTransitions: Record<ProjectStatus, ProjectStatus[]> = {
  [ProjectStatus.DRAFT]: [ProjectStatus.VOTING],
  [ProjectStatus.VOTING]: [ProjectStatus.VOTE_PASSED, ProjectStatus.VOTE_REJECTED],
  [ProjectStatus.VOTE_PASSED]: [ProjectStatus.BUDGETING],
  [ProjectStatus.VOTE_REJECTED]: [ProjectStatus.DRAFT, ProjectStatus.CANCELLED],
  [ProjectStatus.BUDGETING]: [ProjectStatus.BUDGET_APPROVED],
  [ProjectStatus.BUDGET_APPROVED]: [ProjectStatus.CONSTRUCTION],
  [ProjectStatus.CONSTRUCTION]: [ProjectStatus.INSPECTION],
  [ProjectStatus.INSPECTION]: [ProjectStatus.PUBLIC_NOTICE, ProjectStatus.REVIEW],
  [ProjectStatus.PUBLIC_NOTICE]: [ProjectStatus.OBJECTION, ProjectStatus.COMPLETED],
  [ProjectStatus.OBJECTION]: [ProjectStatus.REVIEW, ProjectStatus.PUBLIC_NOTICE],
  [ProjectStatus.REVIEW]: [ProjectStatus.PUBLIC_NOTICE, ProjectStatus.CANCELLED],
  [ProjectStatus.COMPLETED]: [],
  [ProjectStatus.CANCELLED]: []
};

export const getProjects = async (req: Request, res: Response) => {
  try {
    const projects = await Project.findAll({
      order: [['createdAt', 'DESC']]
    });
    res.json({ success: true, data: projects });
  } catch (error) {
    res.status(500).json({ success: false, message: '获取项目列表失败' });
  }
};

export const getProjectById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const project = await Project.findByPk(id, {
      include: [
        { association: 'votes' },
        { association: 'quotes' },
        { association: 'nodes', order: [['nodeOrder', 'ASC']] },
        { association: 'photos' },
        { association: 'objections' },
        { association: 'changeHistories', order: [['changeTime', 'DESC']] },
        { association: 'operationLogs', order: [['operationTime', 'DESC']] }
      ]
    });
    
    if (!project) {
      return res.status(404).json({ success: false, message: '项目不存在' });
    }
    
    res.json({ success: true, data: project });
  } catch (error) {
    res.status(500).json({ success: false, message: '获取项目详情失败' });
  }
};

export const createProject = async (req: Request, res: Response) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { name, description, location, estimatedAmount, responsiblePerson, createdBy } = req.body;
    
    const project = await Project.create({
      name,
      description,
      location,
      estimatedAmount,
      responsiblePerson,
      createdBy,
      status: ProjectStatus.DRAFT
    }, { transaction });
    
    await OperationLog.create({
      projectId: project.id,
      operationType: 'CREATE',
      operationContent: `创建项目: ${name}`,
      operator: createdBy
    }, { transaction });
    
    await transaction.commit();
    res.json({ success: true, data: project });
  } catch (error) {
    await transaction.rollback();
    res.status(500).json({ success: false, message: '创建项目失败' });
  }
};

export const updateProject = async (req: Request, res: Response) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { id } = req.params;
    const { updatedBy, ...updates } = req.body;
    
    const project = await Project.findByPk(id);
    if (!project) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: '项目不存在' });
    }
    
    const oldValues = project.toJSON();
    await project.update(updates, { transaction });
    
    for (const [key, value] of Object.entries(updates)) {
      await recordChangeHistory(id, 'Project', id, key, oldValues[key as keyof typeof oldValues], value, updatedBy);
    }
    
    await OperationLog.create({
      projectId: id,
      operationType: 'UPDATE',
      operationContent: '更新项目信息',
      operator: updatedBy
    }, { transaction });
    
    await transaction.commit();
    res.json({ success: true, data: project });
  } catch (error) {
    await transaction.rollback();
    res.status(500).json({ success: false, message: '更新项目失败' });
  }
};

export const transitionStatus = async (req: Request, res: Response) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { id } = req.params;
    const { newStatus, operator, remark } = req.body;
    
    const project = await Project.findByPk(id, { transaction });
    if (!project) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: '项目不存在' });
    }
    
    const currentStatus = project.status as ProjectStatus;
    const allowedTransitions = statusTransitions[currentStatus];
    
    if (!allowedTransitions.includes(newStatus as ProjectStatus)) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: '不允许的状态转换' });
    }
    
    const oldStatus = project.status;
    await project.update({ status: newStatus }, { transaction });
    
    await OperationLog.create({
      projectId: id,
      operationType: 'STATUS_TRANSITION',
      operationContent: remark || `状态从 ${oldStatus} 变更为 ${newStatus}`,
      operator,
      fromStatus: oldStatus,
      toStatus: newStatus
    }, { transaction });
    
    if (newStatus === ProjectStatus.BUDGET_APPROVED) {
      const defaultNodes = [
        { nodeType: 'material_preparation', nodeName: '材料准备', nodeOrder: 1, deductionAmount: 5000 },
        { nodeType: 'foundation_construction', nodeName: '基础施工', nodeOrder: 2, deductionAmount: 15000 },
        { nodeType: 'main_construction', nodeName: '主体施工', nodeOrder: 3, deductionAmount: 30000 },
        { nodeType: 'installation', nodeName: '设备安装', nodeOrder: 4, deductionAmount: 20000 },
        { nodeType: 'testing', nodeName: '调试验收', nodeOrder: 5, deductionAmount: 10000 },
        { nodeType: 'cleanup', nodeName: '现场清理', nodeOrder: 6, deductionAmount: 5000 }
      ];
      
      const nodes = defaultNodes.map(n => ({
        ...n,
        projectId: id,
        isCompleted: false,
        isDeducted: false
      }));
      
      const createdNodes = await ConstructionNode.bulkCreate(nodes, { transaction });
      await project.update({ currentNodeId: createdNodes[0].id }, { transaction });
    }
    
    await transaction.commit();
    res.json({ success: true, data: project });
  } catch (error) {
    await transaction.rollback();
    res.status(500).json({ success: false, message: '状态转换失败' });
  }
};

export const getStatusTransitions = (_req: Request, res: Response) => {
  res.json({ success: true, data: statusTransitions });
};
