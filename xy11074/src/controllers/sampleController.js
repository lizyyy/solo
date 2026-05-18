const store = require('../data/store');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const path = require('path');
const fs = require('fs');

class SampleController {
  async createSample(req, res) {
    try {
      const { operator, ...sampleData } = req.body;
      const sample = store.addSample(sampleData, operator || '系统');
      const nextSteps = store.getNextSteps(sample.sampleId);
      res.status(201).json({
        success: true,
        data: sample.toJSON(),
        nextSteps: nextSteps.nextSteps
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  async updateSample(req, res) {
    try {
      const { sampleId } = req.params;
      const { operator, ...updateData } = req.body;
      const sample = store.updateSample(sampleId, updateData, operator || '系统');
      if (!sample) {
        return res.status(404).json({
          success: false,
          error: '打样记录不存在'
        });
      }
      const nextSteps = store.getNextSteps(sampleId);
      res.json({
        success: true,
        data: sample.toJSON(),
        nextSteps: nextSteps.nextSteps
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  async getSample(req, res) {
    try {
      const { sampleId } = req.params;
      const sample = store.getSample(sampleId);
      if (!sample) {
        return res.status(404).json({
          success: false,
          error: '打样记录不存在'
        });
      }
      const nextSteps = store.getNextSteps(sampleId);
      res.json({
        success: true,
        data: sample.toJSON(),
        nextSteps: nextSteps.nextSteps
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  async getSamples(req, res) {
    try {
      const samples = store.getSamples(req.query);
      res.json({
        success: true,
        data: samples.map(s => s.toJSON()),
        total: samples.length
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  async batchImport(req, res) {
    try {
      const { operator, samples } = req.body;
      if (!Array.isArray(samples) || samples.length === 0) {
        return res.status(400).json({
          success: false,
          error: '批量导入数据不能为空'
        });
      }
      const result = store.batchImport(samples, operator || '系统');
      res.status(201).json({
        success: true,
        batchId: result.batchId,
        count: result.count,
        data: result.samples.map(s => s.toJSON())
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  async checkOldDesignNewOrder(req, res) {
    try {
      const { sampleId } = req.params;
      const result = store.checkOldDesignNewOrder(sampleId);
      if (!result) {
        return res.status(404).json({
          success: false,
          error: '打样记录不存在'
        });
      }
      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  async checkTrackerConsistency(req, res) {
    try {
      const { sampleId } = req.params;
      const result = store.checkTrackerConsistency(sampleId);
      if (!result) {
        return res.status(404).json({
          success: false,
          error: '打样记录不存在'
        });
      }
      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  async getNextSteps(req, res) {
    try {
      const { sampleId } = req.params;
      const result = store.getNextSteps(sampleId);
      if (!result) {
        return res.status(404).json({
          success: false,
          error: '打样记录不存在'
        });
      }
      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  async exportSamples(req, res) {
    try {
      const samples = store.getSamples(req.query);
      const exportDir = path.join(__dirname, '../../exports');
      if (!fs.existsSync(exportDir)) {
        fs.mkdirSync(exportDir, { recursive: true });
      }
      const filename = `打样记录_${new Date().toISOString().slice(0, 10)}.csv`;
      const filepath = path.join(exportDir, filename);
      const csvWriter = createCsvWriter({
        path: filepath,
        header: [
          { id: 'sampleId', title: '打样编号' },
          { id: 'companyId', title: '企业编号' },
          { id: 'companyName', title: '企业名称' },
          { id: 'contactPerson', title: '联系人' },
          { id: 'contactPhone', title: '联系电话' },
          { id: 'giftCategory', title: '礼品类别' },
          { id: 'giftName', title: '礼品名称' },
          { id: 'giftModel', title: '礼品型号' },
          { id: 'material', title: '材质' },
          { id: 'specification', title: '规格' },
          { id: 'color', title: '颜色' },
          { id: 'quantity', title: '打样数量' },
          { id: 'unitPrice', title: '单价' },
          { id: 'totalAmount', title: '总金额' },
          { id: 'customizationType', title: '定制类型' },
          { id: 'printingMethod', title: '印刷方式' },
          { id: 'logoPosition', title: 'LOGO位置' },
          { id: 'designVersion', title: '设计版本' },
          { id: 'designConfirmed', title: '设计是否确认' },
          { id: 'sampleStatus', title: '打样状态' },
          { id: 'sampler', title: '打样员' },
          { id: 'expectedDeliveryDate', title: '预计交期' },
          { id: 'actualDeliveryDate', title: '实际交期' },
          { id: 'qualityCheckResult', title: '质检结果' },
          { id: 'customerFeedback', title: '客户反馈' },
          { id: 'createdBy', title: '创建人' },
          { id: 'createdAt', title: '创建时间' },
          { id: 'isBatchImport', title: '是否批量导入' },
          { id: 'batchId', title: '批次号' }
        ]
      });
      const records = samples.map(s => ({
        ...s.toJSON(),
        designConfirmed: s.designConfirmed ? '是' : '否',
        isBatchImport: s.isBatchImport ? '是' : '否'
      }));
      await csvWriter.writeRecords(records);
      res.download(filepath, filename, (err) => {
        if (err) {
          res.status(500).json({
            success: false,
            error: '导出失败'
          });
        }
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }
}

module.exports = new SampleController();