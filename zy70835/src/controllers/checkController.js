const CheckService = require('../services/checkService');
const BatchService = require('../services/batchService');

class CheckController {
  static async create(req, res) {
    try {
      const {
        batch_id, student_id, student_name, class_name,
        temperature, has_medication, medication_details,
        parent_confirmed, parent_name, parent_phone, handler
      } = req.body;

      if (!batch_id || !student_id || !student_name || !class_name || !handler) {
        return res.status(400).json({
          success: false,
          message: '缺少必要参数'
        });
      }

      const recordData = {
        batch_id: parseInt(batch_id),
        student_id,
        student_name,
        class_name,
        temperature: parseFloat(temperature) || 36.5,
        has_medication: has_medication ? 1 : 0,
        medication_details: medication_details || '',
        parent_confirmed: parent_confirmed ? 1 : 0,
        parent_name: parent_name || '',
        parent_phone: parent_phone || '',
        handler
      };

      const record = await CheckService.createRecord(recordData);
      
      res.json({
        success: true,
        data: record,
        message: '晨检记录创建成功'
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  static async getById(req, res) {
    try {
      const { id } = req.params;
      const record = await CheckService.getRecordDetail(id);
      
      if (!record) {
        return res.status(404).json({
          success: false,
          message: '记录不存在'
        });
      }

      res.json({
        success: true,
        data: record
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  static async updateStatus(req, res) {
    try {
      const { id } = req.params;
      const { new_status, new_abnormal_type, operator, reason } = req.body;

      if (!new_status || !operator || !reason) {
        return res.status(400).json({
          success: false,
          message: '缺少必要参数: new_status, operator, reason'
        });
      }

      const record = await CheckService.updateRecordStatus(
        parseInt(id),
        new_status,
        new_abnormal_type || null,
        operator,
        reason
      );

      res.json({
        success: true,
        data: record,
        message: '状态更新成功'
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  static async triggerReview(req, res) {
    try {
      const { id } = req.params;
      const { operator, review_reason } = req.body;

      if (!operator || !review_reason) {
        return res.status(400).json({
          success: false,
          message: '缺少必要参数: operator, review_reason'
        });
      }

      const record = await CheckService.triggerReview(
        parseInt(id),
        operator,
        review_reason
      );

      res.json({
        success: true,
        data: record,
        message: '复核流程已触发'
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  static async updateFollowUp(req, res) {
    try {
      const { id } = req.params;
      const { follow_up_status, follow_up_remark, operator } = req.body;

      if (!follow_up_status || !operator) {
        return res.status(400).json({
          success: false,
          message: '缺少必要参数: follow_up_status, operator'
        });
      }

      const record = await CheckService.updateFollowUp(
        parseInt(id),
        follow_up_status,
        follow_up_remark || '',
        operator
      );

      res.json({
        success: true,
        data: record,
        message: '回访状态更新成功'
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  static async getByClass(req, res) {
    try {
      const { class_name } = req.params;
      const records = await CheckService.getClassRecords(class_name);

      res.json({
        success: true,
        data: records
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  static getTypes(req, res) {
    res.json({
      success: true,
      data: {
        status_types: CheckService.getStatusTypes(),
        abnormal_types: CheckService.getAbnormalTypes(),
        status_descriptions: CheckService.getStatusDescriptions(),
        abnormal_descriptions: CheckService.getAbnormalDescriptions()
      }
    });
  }
}

module.exports = CheckController;