import { Request, Response } from 'express';
import { Parser } from 'json2csv';
import * as whitelistService from '../services/whitelistService';
import { shouldBypassAudit } from '../services/cacheService';
import { WhitelistStatus } from '../types';

export const listRecords = async (req: Request, res: Response): Promise<void> => {
  try {
    const { status, account, auditor } = req.query;
    const records = await whitelistService.listRecords({
      status: status as WhitelistStatus,
      account: account as string,
      auditor: auditor as string
    });
    res.json({ success: true, data: records });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getRecord = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const record = await whitelistService.getRecordById(id);
    if (!record) {
      res.status(404).json({ success: false, error: '记录不存在' });
      return;
    }
    res.json({ success: true, data: record });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const createRecord = async (req: Request, res: Response): Promise<void> => {
  try {
    const record = await whitelistService.createRecord(req.body);
    res.status(201).json({ success: true, data: record });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
};

export const importRecords = async (req: Request, res: Response): Promise<void> => {
  try {
    const { records, createdBy } = req.body;
    if (!Array.isArray(records)) {
      res.status(400).json({ success: false, error: 'records必须是数组' });
      return;
    }
    const result = await whitelistService.importRecords(
      records.map(r => ({ ...r, createdBy: createdBy || 'system' }))
    );
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const submitExpire = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { operator, remark } = req.body;
    const record = await whitelistService.submitExpire(id, operator, remark);
    res.json({ success: true, data: record });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
};

export const approveExpire = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { operator, remark } = req.body;
    const record = await whitelistService.approveExpire(id, operator, remark);
    res.json({ success: true, data: record });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
};

export const withdraw = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { operator, remark } = req.body;
    const record = await whitelistService.withdraw(id, operator, remark);
    res.json({ success: true, data: record });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
};

export const requestRestore = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { operator, remark } = req.body;
    const record = await whitelistService.requestRestore(id, operator, remark);
    res.json({ success: true, data: record });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
};

export const approveRestore = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { operator, remark } = req.body;
    const record = await whitelistService.approveRestore(id, operator, remark);
    res.json({ success: true, data: record });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
};

export const addRemark = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { operator, remark } = req.body;
    const record = await whitelistService.addRemark(id, operator, remark);
    res.json({ success: true, data: record });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
};

export const getHistory = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const history = await whitelistService.getHistory(id);
    res.json({ success: true, data: history });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const exportRecords = async (req: Request, res: Response): Promise<void> => {
  try {
    const { status, account } = req.query;
    const records = await whitelistService.exportRecords({
      status: status as WhitelistStatus,
      account: account as string
    });

    const fields = [
      'id',
      'account',
      'reason',
      'validFrom',
      'validTo',
      'auditor',
      'status',
      'remark',
      'createdAt',
      'updatedAt',
      'createdBy'
    ];

    const json2csvParser = new Parser({ fields });
    const csv = json2csvParser.parse(records);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=whitelist_${Date.now()}.csv`);
    res.send('\uFEFF' + csv);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const checkAuditBypass = async (req: Request, res: Response): Promise<void> => {
  try {
    const { account } = req.params;
    const result = shouldBypassAudit(account);
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};
