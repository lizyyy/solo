import { Request, Response } from 'express';
import { importService } from '../services/importService';
import { DepositRule } from '../types';

export const importRentalOrders = async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请上传CSV文件' });
    }

    const result = await importService.importRentalOrdersFromCSVBuffer(req.file.buffer);
    res.json({
      message: '租赁订单导入完成',
      ...result,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const importRepairRecords = async (req: Request, res: Response) => {
  try {
    const { content } = req.body;
    if (!content) {
      return res.status(400).json({ error: '请提供JSON内容' });
    }

    const result = await importService.importRepairRecordsFromJSONContent(content);
    res.json({
      message: '维修记录导入完成',
      ...result,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const importDepositRules = async (req: Request, res: Response) => {
  try {
    const { rules } = req.body;
    if (!rules || !Array.isArray(rules)) {
      return res.status(400).json({ error: '请提供规则数组' });
    }

    const result = await importService.importDepositRules(rules as Omit<DepositRule, 'id'>[]);
    res.json({
      message: '押金规则导入完成',
      ...result,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
