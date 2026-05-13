import { Request, Response } from 'express';
import { BudgetQuote, OperationLog, sequelize } from '../models';
import { recordChangeHistory } from '../utils/historyUtils';

export const getQuotes = async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const quotes = await BudgetQuote.findAll({
      where: { projectId },
      order: [['quotationTime', 'DESC']]
    });
    res.json({ success: true, data: quotes });
  } catch (error) {
    res.status(500).json({ success: false, message: '获取报价列表失败' });
  }
};

export const createQuote = async (req: Request, res: Response) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { projectId } = req.params;
    const { itemName, quantity, unitPrice, totalPrice, supplier, remarks } = req.body;
    
    const quote = await BudgetQuote.create({
      projectId,
      itemName,
      quantity,
      unitPrice,
      totalPrice,
      supplier,
      remarks,
      quotationTime: new Date(),
      isApproved: false
    }, { transaction });
    
    await OperationLog.create({
      projectId,
      operationType: 'BUDGET_CREATE',
      operationContent: `创建预算报价: ${itemName}`,
      operator: 'system'
    }, { transaction });
    
    await transaction.commit();
    res.json({ success: true, data: quote });
  } catch (error) {
    await transaction.rollback();
    res.status(500).json({ success: false, message: '创建报价失败' });
  }
};

export const updateQuote = async (req: Request, res: Response) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { id } = req.params;
    const { updatedBy, ...updates } = req.body;
    
    const quote = await BudgetQuote.findByPk(id, { transaction });
    if (!quote) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: '报价不存在' });
    }
    
    const oldValues = quote.toJSON();
    await quote.update(updates, { transaction });
    
    for (const [key, value] of Object.entries(updates)) {
      await recordChangeHistory(
        quote.projectId, 
        'BudgetQuote', 
        id, 
        key, 
        oldValues[key as keyof typeof oldValues], 
        value, 
        updatedBy
      );
    }
    
    await OperationLog.create({
      projectId: quote.projectId,
      operationType: 'BUDGET_UPDATE',
      operationContent: `更新预算报价: ${quote.itemName}`,
      operator: updatedBy
    }, { transaction });
    
    await transaction.commit();
    res.json({ success: true, data: quote });
  } catch (error) {
    await transaction.rollback();
    res.status(500).json({ success: false, message: '更新报价失败' });
  }
};

export const approveQuote = async (req: Request, res: Response) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { id } = req.params;
    const { approvedBy } = req.body;
    
    const quote = await BudgetQuote.findByPk(id, { transaction });
    if (!quote) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: '报价不存在' });
    }
    
    await quote.update({
      isApproved: true,
      approvedBy,
      approvedTime: new Date()
    }, { transaction });
    
    await OperationLog.create({
      projectId: quote.projectId,
      operationType: 'BUDGET_APPROVE',
      operationContent: `批准预算报价: ${quote.itemName}`,
      operator: approvedBy
    }, { transaction });
    
    await transaction.commit();
    res.json({ success: true, data: quote });
  } catch (error) {
    await transaction.rollback();
    res.status(500).json({ success: false, message: '批准报价失败' });
  }
};

export const getBudgetSummary = async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    
    const quotes = await BudgetQuote.findAll({ where: { projectId } });
    
    const summary = {
      totalCount: quotes.length,
      totalAmount: quotes.reduce((sum, q) => sum + (q.totalPrice || 0), 0),
      approvedCount: quotes.filter(q => q.isApproved).length,
      approvedAmount: quotes.filter(q => q.isApproved).reduce((sum, q) => sum + (q.totalPrice || 0), 0),
      pendingCount: quotes.filter(q => !q.isApproved).length,
      pendingAmount: quotes.filter(q => !q.isApproved).reduce((sum, q) => sum + (q.totalPrice || 0), 0)
    };
    
    res.json({ success: true, data: summary });
  } catch (error) {
    res.status(500).json({ success: false, message: '获取预算汇总失败' });
  }
};
