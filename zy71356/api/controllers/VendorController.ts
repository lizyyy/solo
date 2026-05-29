import { Request, Response } from 'express';
import { VendorService } from '../services/VendorService';
import { Vendor } from '../../shared/types';

export class VendorController {
  private vendorService: VendorService;

  constructor() {
    this.vendorService = new VendorService();
  }

  getAll = (req: Request, res: Response) => {
    try {
      const vendors = this.vendorService.getAllVendors();
      res.json(vendors);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  };

  getById = (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const vendor = this.vendorService.getVendorById(id);
      if (!vendor) {
        res.status(404).json({ error: '摊主不存在' });
        return;
      }
      res.json(vendor);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  };

  create = (req: Request, res: Response) => {
    try {
      const data = req.body as Omit<Vendor, 'id' | 'createdAt' | 'updatedAt'>;
      const vendor = this.vendorService.createVendor(data);
      res.status(201).json(vendor);
    } catch (error: any) {
      res.status(400).json({
        error: error.message,
        source: req.body.source || '手动录入',
      });
    }
  };

  update = (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const data = req.body as Partial<Vendor>;
      const vendor = this.vendorService.updateVendor(id, data);
      if (!vendor) {
        res.status(404).json({ error: '摊主不存在' });
        return;
      }
      res.json(vendor);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  };

  delete = (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const success = this.vendorService.deleteVendor(id);
      if (!success) {
        res.status(404).json({ error: '摊主不存在' });
        return;
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  };

  bulkImport = (req: Request, res: Response) => {
    try {
      const { data, source } = req.body;
      if (!Array.isArray(data)) {
        res.status(400).json({ error: '数据格式错误，需要数组' });
        return;
      }
      const result = this.vendorService.bulkImport(data, source || '批量导入');
      res.json({
        success: result.success.length,
        errors: result.errors,
        imported: result.success,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  };
}
