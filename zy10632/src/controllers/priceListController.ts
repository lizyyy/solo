import { Request, Response } from 'express';
import priceListService from '../services/priceListService';
import exportService from '../services/exportService';
import fs from 'fs';

export const createPriceList = async (req: Request, res: Response) => {
  try {
    const result = await priceListService.createPriceList(req.body);
    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: '存在门店价格冲突',
        conflicts: result.conflicts,
        next_steps: result.next_steps
      });
    }
    res.json({ success: true, data: result.data });
  } catch (error) {
    res.status(500).json({ success: false, message: '创建失败' });
  }
};

export const updatePriceList = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { operator_id, operator_name, ...updateData } = req.body;
    const result = await priceListService.updatePriceList(id, updateData, operator_id, operator_name);
    
    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.conflicts ? '存在门店价格冲突' : '更新失败',
        conflicts: result.conflicts,
        next_steps: result.next_steps
      });
    }
    res.json({ success: true, data: result.data });
  } catch (error) {
    res.status(500).json({ success: false, message: '更新失败' });
  }
};

export const submitForApproval = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { operator_id, operator_name } = req.body;
    const result = await priceListService.submitForApproval(id, operator_id, operator_name);
    
    if (!result.success) {
      return res.status(400).json({ success: false, message: '提交审核失败' });
    }
    res.json({ success: true, data: result.data });
  } catch (error) {
    res.status(500).json({ success: false, message: '提交审核失败' });
  }
};

export const approvePriceList = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await priceListService.approvePriceList(id, req.body);
    
    if (!result.success) {
      return res.status(400).json({ success: false, message: '审核失败' });
    }
    res.json({ success: true, data: result.data });
  } catch (error) {
    res.status(500).json({ success: false, message: '审核失败' });
  }
};

export const rollbackPriceList = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { operator_id, operator_name, remark } = req.body;
    const result = await priceListService.rollbackPriceList(id, operator_id, operator_name, remark);
    
    if (!result.success) {
      return res.status(400).json({ success: false, message: '撤回失败' });
    }
    res.json({ success: true, data: result.data });
  } catch (error) {
    res.status(500).json({ success: false, message: '撤回失败' });
  }
};

export const getPriceListDetail = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const priceList = await priceListService.getPriceListById(id);
    
    if (!priceList) {
      return res.status(404).json({ success: false, message: '价目表不存在' });
    }

    const stores = await priceListService.getPriceListStores(id);
    const items = await priceListService.getPriceListItems(id);
    const history = await priceListService.getPriceListHistory(id);

    res.json({
      success: true,
      data: {
        ...priceList,
        stores,
        items,
        history
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: '获取详情失败' });
  }
};

export const getPriceListList = async (req: Request, res: Response) => {
  try {
    const { status, keyword, page, page_size } = req.query;
    const result = await priceListService.getPriceListList({
      status: status as string,
      keyword: keyword as string,
      page: page ? parseInt(page as string) : undefined,
      pageSize: page_size ? parseInt(page_size as string) : undefined
    });
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: '获取列表失败' });
  }
};

export const exportPriceLists = async (req: Request, res: Response) => {
  try {
    const { status, keyword } = req.query;
    const filePath = await exportService.exportPriceLists({
      status: status as string,
      keyword: keyword as string
    });
    
    res.download(filePath, (err) => {
      if (err) {
        res.status(500).json({ success: false, message: '导出失败' });
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: '导出失败' });
  }
};

export const exportPriceListDetail = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const filePath = await exportService.exportPriceListDetail(id);
    
    res.download(filePath, (err) => {
      if (err) {
        res.status(500).json({ success: false, message: '导出失败' });
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: '导出失败' });
  }
};

export const getStores = async (_req: Request, res: Response) => {
  try {
    const stores = await priceListService.getAllStores();
    res.json({ success: true, data: stores });
  } catch (error) {
    res.status(500).json({ success: false, message: '获取门店列表失败' });
  }
};
