const path = require('path');
const fs = require('fs');
const multer = require('multer');
const importService = require('../services/importService');
const itemService = require('../services/itemService');

const upload = multer({ dest: 'uploads/' });

class ItemController {
  async createBatch(req, res) {
    try {
      const { batchType, sourceFile, createdBy, remark } = req.body;
      const result = await importService.createBatch(batchType, sourceFile, createdBy, remark);
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async uploadLostItemsCSV(req, res) {
    try {
      const { batchId, operator } = req.body;
      
      if (!req.file) {
        return res.status(400).json({ success: false, error: '请上传CSV文件' });
      }

      const result = await importService.importLostItemsFromCSV(
        req.file.path,
        parseInt(batchId),
        operator
      );

      fs.unlinkSync(req.file.path);

      res.json({ success: true, data: result });
    } catch (error) {
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async uploadRouteSchedulesJSON(req, res) {
    try {
      const { batchId, operator } = req.body;
      
      if (!req.file) {
        return res.status(400).json({ success: false, error: '请上传JSON文件' });
      }

      const result = await importService.importRouteSchedulesFromJSON(
        req.file.path,
        parseInt(batchId),
        operator
      );

      fs.unlinkSync(req.file.path);

      res.json({ success: true, data: result });
    } catch (error) {
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async listBatches(req, res) {
    try {
      const { page = 1, pageSize = 20 } = req.query;
      const result = await importService.listBatches(parseInt(page), parseInt(pageSize));
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async listItems(req, res) {
    try {
      const result = await itemService.listItems(req.query);
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async getItemDetail(req, res) {
    try {
      const { itemId } = req.params;
      const item = await itemService.getItemById(parseInt(itemId));
      if (!item) {
        return res.status(404).json({ success: false, error: '物品不存在' });
      }
      res.json({ success: true, data: item });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async processItem(req, res) {
    try {
      const { itemId } = req.params;
      const { action, reason, operator, remark } = req.body;
      const result = await itemService.processItem(
        parseInt(itemId),
        action,
        reason,
        operator,
        remark
      );
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async returnForModification(req, res) {
    try {
      const { itemId } = req.params;
      const { reason, operator } = req.body;
      const result = await itemService.returnForModification(parseInt(itemId), reason, operator);
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async markProcessed(req, res) {
    try {
      const { itemId } = req.params;
      const { reason, operator } = req.body;
      const result = await itemService.markProcessed(parseInt(itemId), reason, operator);
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async markCompleted(req, res) {
    try {
      const { itemId } = req.params;
      const { reason, operator } = req.body;
      const result = await itemService.markCompleted(parseInt(itemId), reason, operator);
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async issuePickupVoucher(req, res) {
    try {
      const { itemId } = req.params;
      const { issuer, expireDays } = req.body;
      const result = await itemService.issuePickupVoucher(
        parseInt(itemId),
        issuer,
        expireDays ? parseInt(expireDays) : 7
      );
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async pickupItem(req, res) {
    try {
      const { voucherNo } = req.params;
      const { receiverName, receiverPhone, receiverIdCard, operator } = req.body;
      const result = await itemService.pickupItem(
        voucherNo,
        receiverName,
        receiverPhone,
        receiverIdCard,
        operator
      );
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async getVoucherDetail(req, res) {
    try {
      const { voucherNo } = req.params;
      const voucher = await itemService.getVoucherByNo(voucherNo);
      if (!voucher) {
        return res.status(404).json({ success: false, error: '凭证不存在' });
      }
      res.json({ success: true, data: voucher });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async traceVoucher(req, res) {
    try {
      const { voucherNo } = req.params;
      const result = await itemService.traceVoucherSource(voucherNo);
      if (!result) {
        return res.status(404).json({ success: false, error: '凭证不存在' });
      }
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async getItemsByRoute(req, res) {
    try {
      const { routeNo, shiftNo } = req.query;
      if (!routeNo) {
        return res.status(400).json({ success: false, error: '请提供线路号' });
      }
      const result = await itemService.getItemsByRoute(routeNo, shiftNo);
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async getItemsByDriver(req, res) {
    try {
      const { driverName } = req.query;
      if (!driverName) {
        return res.status(400).json({ success: false, error: '请提供司机姓名' });
      }
      const result = await itemService.getItemsByDriver(driverName);
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async exportItems(req, res) {
    try {
      const csv = await itemService.exportItems(req.query);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="lost_items_${Date.now()}.csv"`);
      res.send('\uFEFF' + csv);
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async checkOverdue(req, res) {
    try {
      const { overdueDays = 30 } = req.body;
      const result = await itemService.checkOverdueItems(parseInt(overdueDays));
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async checkSameName(req, res) {
    try {
      const result = await itemService.checkSameNameItems();
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async importImageIndex(req, res) {
    try {
      const { imageDataList, batchNo, uploadedBy } = req.body;
      const result = await importService.importImageIndex(imageDataList, batchNo, uploadedBy);
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
}

module.exports = new ItemController();
