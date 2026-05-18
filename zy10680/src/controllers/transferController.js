const transferService = require('../services/transferService');
const { Parser } = require('json2csv');

const createTransfer = async (req, res) => {
  try {
    const { operator_id, operator_name, operation_from, ...data } = req.body;
    
    if (!operator_id || !operator_name || !operation_from) {
      return res.status(400).json({ error: '操作者信息不完整' });
    }

    const requiredFields = [
      'employee_id', 'employee_code', 'employee_name',
      'original_store_id', 'original_store_code', 'original_store_name',
      'target_store_id', 'target_store_code', 'target_store_name',
      'shift_date', 'shift_template_id', 'shift_template_name',
      'shift_start_time', 'shift_end_time'
    ];

    for (const field of requiredFields) {
      if (!data[field]) {
        return res.status(400).json({ error: `缺少必填字段: ${field}` });
      }
    }

    const result = await transferService.createTransfer(
      data,
      operator_id,
      operator_name,
      operation_from
    );

    res.json({ success: true, data: result });
  } catch (err) {
    console.error('创建借调记录失败:', err);
    res.status(500).json({ error: err.message });
  }
};

const getTransferList = async (req, res) => {
  try {
    const params = {
      status: req.query.status,
      employee_name: req.query.employee_name,
      shift_date_start: req.query.shift_date_start,
      shift_date_end: req.query.shift_date_end,
      page: req.query.page ? parseInt(req.query.page) : null,
      page_size: req.query.page_size ? parseInt(req.query.page_size) : null
    };

    const result = await transferService.getTransferList(params);
    res.json({ success: true, data: result.list, total: result.total });
  } catch (err) {
    console.error('获取借调列表失败:', err);
    res.status(500).json({ error: err.message });
  }
};

const getTransferDetail = async (req, res) => {
  try {
    const { id } = req.params;
    const transfer = await transferService.getTransferDetail(id);
    
    if (!transfer) {
      return res.status(404).json({ error: '借调记录不存在' });
    }

    res.json({ success: true, data: transfer });
  } catch (err) {
    console.error('获取借调详情失败:', err);
    res.status(500).json({ error: err.message });
  }
};

const getTransferHistory = async (req, res) => {
  try {
    const { id } = req.params;
    const history = await transferService.getTransferHistory(id);
    res.json({ success: true, data: history });
  } catch (err) {
    console.error('获取借调历史失败:', err);
    res.status(500).json({ error: err.message });
  }
};

const updateTransferStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { new_status, operator_id, operator_name, operation_from, note } = req.body;

    if (!new_status || !operator_id || !operator_name || !operation_from) {
      return res.status(400).json({ error: '参数不完整' });
    }

    const result = await transferService.updateTransferStatus(
      id,
      new_status,
      operator_id,
      operator_name,
      operation_from,
      note
    );

    res.json({ success: true, data: result });
  } catch (err) {
    console.error('更新借调状态失败:', err);
    res.status(500).json({ error: err.message });
  }
};

const resolveConflict = async (req, res) => {
  try {
    const { id } = req.params;
    const { operator_id, operator_name, operation_from, resolve_note } = req.body;

    if (!operator_id || !operator_name || !operation_from || !resolve_note) {
      return res.status(400).json({ error: '参数不完整' });
    }

    const result = await transferService.resolveConflict(
      id,
      operator_id,
      operator_name,
      operation_from,
      resolve_note
    );

    res.json({ success: true, data: result });
  } catch (err) {
    console.error('处理冲突失败:', err);
    res.status(500).json({ error: err.message });
  }
};

const archiveTransfer = async (req, res) => {
  try {
    const { id } = req.params;
    const { operator_id, operator_name, operation_from, note } = req.body;

    if (!operator_id || !operator_name || !operation_from) {
      return res.status(400).json({ error: '参数不完整' });
    }

    const result = await transferService.archiveTransfer(
      id,
      operator_id,
      operator_name,
      operation_from,
      note
    );

    res.json({ success: true, data: result });
  } catch (err) {
    console.error('归档借调失败:', err);
    res.status(500).json({ error: err.message });
  }
};

const exportTransfers = async (req, res) => {
  try {
    const data = await transferService.getAllTransfersForExport();
    
    const json2csvParser = new Parser();
    const csv = json2csvParser.parse(data);
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=transfer_shifts_${Date.now()}.csv`);
    res.send('\uFEFF' + csv);
  } catch (err) {
    console.error('导出借调记录失败:', err);
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  createTransfer,
  getTransferList,
  getTransferDetail,
  getTransferHistory,
  updateTransferStatus,
  resolveConflict,
  archiveTransfer,
  exportTransfers
};
