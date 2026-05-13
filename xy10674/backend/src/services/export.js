const ExcelJS = require('exceljs');
const { Op } = require('sequelize');
const {
  StoreCollection,
  DamagePhoto,
  ModificationHistory,
  SupplierHandover,
  DepositFlow,
  PalletCode,
  Store,
  Supplier,
  User
} = require('../models');

class ExportService {
  async exportDepositReport(filters = {}) {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = '托盘押金系统';
    workbook.created = new Date();

    // 主数据工作表
    const mainWorksheet = workbook.addWorksheet('押金赔付汇总');
    this._addMainSheetHeaders(mainWorksheet);

    // 修改历史工作表
    const historyWorksheet = workbook.addWorksheet('修改历史记录');
    this._addHistorySheetHeaders(historyWorksheet);

    // 查询数据
    const whereCondition = this._buildWhereCondition(filters);
    
    const collections = await StoreCollection.findAll({
      where: whereCondition,
      include: [
        { model: Store, as: 'Store' },
        { model: PalletCode, as: 'PalletCode' },
        { model: User, as: 'Creator' },
        { model: User, as: 'Verifier' },
        { model: DamagePhoto, as: 'DamagePhotos' }
      ],
      order: [['created_at', 'DESC']]
    });

    // 填充主表数据
    for (let i = 0; i < collections.length; i++) {
      const collection = collections[i];
      const damagePhotos = collection.DamagePhotos || [];
      
      mainWorksheet.addRow([
        i + 1,
        collection.collection_no,
        collection.Store?.store_name || '',
        collection.PalletCode?.pallet_code || '',
        collection.collection_date,
        collection.collection_quantity,
        collection.damaged_quantity,
        collection.refund_amount,
        collection.collection_status,
        collection.Creator?.name || '',
        collection.Verifier?.name || '',
        collection.created_at,
        damagePhotos.length,
        collection.remark || ''
      ]);
    }

    // 查询所有相关的修改历史
    const collectionIds = collections.map(c => c.id);
    const modificationHistory = await ModificationHistory.findAll({
      where: {
        table_name: ['store_collections', 'damage_photos'],
        record_id: { [Op.in]: collectionIds }
      },
      include: [{ model: User, as: 'User' }],
      order: [['modified_at', 'DESC']]
    });

    // 填充修改历史表
    for (let i = 0; i < modificationHistory.length; i++) {
      const history = modificationHistory[i];
      historyWorksheet.addRow([
        i + 1,
        history.table_name,
        history.record_id,
        history.field_name,
        history.old_value,
        history.new_value,
        history.User?.name || '',
        history.modified_at,
        history.operation_type,
        history.reason || ''
      ]);
    }

    // 破损照片详情工作表
    const photoWorksheet = workbook.addWorksheet('破损照片详情');
    this._addPhotoSheetHeaders(photoWorksheet);

    const allPhotos = await DamagePhoto.findAll({
      where: {
        store_collection_id: { [Op.in]: collectionIds }
      },
      include: [
        { model: StoreCollection, as: 'StoreCollection' },
        { model: User, as: 'Creator' },
        { model: User, as: 'Reviewer' }
      ]
    });

    for (let i = 0; i < allPhotos.length; i++) {
      const photo = allPhotos[i];
      photoWorksheet.addRow([
        i + 1,
        photo.StoreCollection?.collection_no || '',
        photo.photo_url,
        photo.photo_description || '',
        photo.damage_level,
        photo.review_status,
        photo.review_comment || '',
        photo.Creator?.name || '',
        photo.Reviewer?.name || '',
        photo.created_at,
        photo.reviewed_at || ''
      ]);
    }

    return workbook;
  }

  async exportSupplierHandoverReport(filters = {}) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('供应商交接记录');

    worksheet.columns = [
      { header: '序号', width: 8 },
      { header: '交接单号', width: 20 },
      { header: '供应商', width: 20 },
      { header: '托盘编码', width: 15 },
      { header: '交接日期', width: 12 },
      { header: '交接数量', width: 12 },
      { header: '押金金额', width: 12 },
      { header: '状态', width: 10 },
      { header: '创建人', width: 12 },
      { header: '审核人', width: 12 },
      { header: '创建时间', width: 20 },
      { header: '备注', width: 30 }
    ];

    const whereCondition = this._buildWhereCondition(filters);
    const handovers = await SupplierHandover.findAll({
      where: whereCondition,
      include: [
        { model: Supplier, as: 'Supplier' },
        { model: PalletCode, as: 'PalletCode' },
        { model: User, as: 'Creator' },
        { model: User, as: 'Verifier' }
      ],
      order: [['created_at', 'DESC']]
    });

    for (let i = 0; i < handovers.length; i++) {
      const handover = handovers[i];
      worksheet.addRow([
        i + 1,
        handover.handover_no,
        handover.Supplier?.supplier_name || '',
        handover.PalletCode?.pallet_code || '',
        handover.handover_date,
        handover.handover_quantity,
        handover.deposit_amount,
        handover.handover_status,
        handover.Creator?.name || '',
        handover.Verifier?.name || '',
        handover.created_at,
        handover.remark || ''
      ]);
    }

    return workbook;
  }

  async exportDepositFlowReport(filters = {}) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('押金流水记录');

    worksheet.columns = [
      { header: '序号', width: 8 },
      { header: '流水号', width: 20 },
      { header: '流水类型', width: 12 },
      { header: '关联类型', width: 15 },
      { header: '关联ID', width: 10 },
      { header: '金额', width: 12 },
      { header: '状态', width: 10 },
      { header: '拦截原因', width: 30 },
      { header: '创建人', width: 12 },
      { header: '处理人', width: 12 },
      { header: '创建时间', width: 20 },
      { header: '处理时间', width: 20 },
      { header: '备注', width: 30 }
    ];

    const whereCondition = this._buildWhereCondition(filters);
    const flows = await DepositFlow.findAll({
      where: whereCondition,
      include: [
        { model: User, as: 'Creator' },
        { model: User, as: 'Processor' }
      ],
      order: [['created_at', 'DESC']]
    });

    for (let i = 0; i < flows.length; i++) {
      const flow = flows[i];
      worksheet.addRow([
        i + 1,
        flow.flow_no,
        flow.flow_type,
        flow.related_type,
        flow.related_id,
        flow.amount,
        flow.flow_status,
        flow.blocked_reason || '',
        flow.Creator?.name || '',
        flow.Processor?.name || '',
        flow.created_at,
        flow.processed_at || '',
        flow.remark || ''
      ]);
    }

    return workbook;
  }

  _addMainSheetHeaders(worksheet) {
    worksheet.columns = [
      { header: '序号', width: 8 },
      { header: '回收单号', width: 20 },
      { header: '门店', width: 20 },
      { header: '托盘编码', width: 15 },
      { header: '回收日期', width: 12 },
      { header: '回收数量', width: 12 },
      { header: '破损数量', width: 12 },
      { header: '退款金额', width: 12 },
      { header: '状态', width: 15 },
      { header: '创建人', width: 12 },
      { header: '审核人', width: 12 },
      { header: '创建时间', width: 20 },
      { header: '照片数量', width: 12 },
      { header: '备注', width: 30 }
    ];
  }

  _addHistorySheetHeaders(worksheet) {
    worksheet.columns = [
      { header: '序号', width: 8 },
      { header: '表名', width: 20 },
      { header: '记录ID', width: 10 },
      { header: '字段名', width: 20 },
      { header: '原值', width: 30 },
      { header: '新值', width: 30 },
      { header: '修改人', width: 12 },
      { header: '修改时间', width: 20 },
      { header: '操作类型', width: 12 },
      { header: '原因', width: 30 }
    ];
  }

  _addPhotoSheetHeaders(worksheet) {
    worksheet.columns = [
      { header: '序号', width: 8 },
      { header: '回收单号', width: 20 },
      { header: '照片URL', width: 40 },
      { header: '照片描述', width: 30 },
      { header: '破损等级', width: 12 },
      { header: '审核状态', width: 12 },
      { header: '审核意见', width: 30 },
      { header: '上传人', width: 12 },
      { header: '审核人', width: 12 },
      { header: '上传时间', width: 20 },
      { header: '审核时间', width: 20 }
    ];
  }

  _buildWhereCondition(filters) {
    const where = {};

    if (filters.startDate && filters.endDate) {
      where.created_at = {
        [Op.between]: [filters.startDate, filters.endDate]
      };
    }

    if (filters.modifiedBy) {
      where.created_by = filters.modifiedBy;
    }

    if (filters.status) {
      where.collection_status = filters.status;
    }

    return where;
  }
}

module.exports = new ExportService();
