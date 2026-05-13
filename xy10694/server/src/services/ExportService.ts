import ExcelJS from 'exceljs';
import { Op } from 'sequelize';
import { v4 as uuidv4 } from 'uuid';
import WorkOrder, { WorkOrderStatus } from '../models/WorkOrder';
import WorkOrderPhoto from '../models/WorkOrderPhoto';
import ResidentAddress from '../models/ResidentAddress';
import ProblemType from '../models/ProblemType';
import GridWorker from '../models/GridWorker';
import ResponsibleUnit from '../models/ResponsibleUnit';
import FollowUp from '../models/FollowUp';
import OperationLog, { OperationType } from '../models/OperationLog';
import ModificationHistory, { EntityType } from '../models/ModificationHistory';
import path from 'path';

interface ExportParams {
  startDate?: Date;
  endDate?: Date;
  responsiblePersonId?: string;
  status?: WorkOrderStatus;
  operatorId: string;
  operatorName: string;
}

class ExportService {
  async exportWorkOrders(params: ExportParams): Promise<string> {
    const { startDate, endDate, responsiblePersonId, status, operatorId, operatorName } = params;

    const where: any = {};
    if (startDate && endDate) {
      where.createdAt = { [Op.between]: [startDate, endDate] };
    }
    if (status) where.status = status;

    const workOrders = await WorkOrder.findAll({
      where,
      include: [
        { model: ResidentAddress, as: 'residentAddress' },
        { model: ProblemType, as: 'problemType' },
        { model: GridWorker, as: 'gridWorker' },
        { model: ResponsibleUnit, as: 'responsibleUnit' }
      ],
      order: [['createdAt', 'DESC']]
    });

    let filteredOrders = workOrders;
    if (responsiblePersonId) {
      filteredOrders = workOrders.filter(order => 
        order.gridWorkerId === responsiblePersonId || 
        order.responsibleUnitId === responsiblePersonId
      );
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('工单列表');

    worksheet.columns = [
      { header: '工单编号', key: 'orderNo', width: 20 },
      { header: '居民姓名', key: 'residentName', width: 15 },
      { header: '联系电话', key: 'phone', width: 15 },
      { header: '地址', key: 'address', width: 40 },
      { header: '问题类型', key: 'problemType', width: 20 },
      { header: '网格员', key: 'gridWorker', width: 15 },
      { header: '责任单位', key: 'responsibleUnit', width: 20 },
      { header: '状态', key: 'status', width: 12 },
      { header: '场景', key: 'scene', width: 12 },
      { header: '描述', key: 'description', width: 40 },
      { header: '创建时间', key: 'createdAt', width: 20 },
      { header: '完成时间', key: 'completedAt', width: 20 }
    ];

    for (const order of filteredOrders) {
      const residentAddress = (order as any).residentAddress;
      const problemType = (order as any).problemType;
      const gridWorker = (order as any).gridWorker;
      const responsibleUnit = (order as any).responsibleUnit;

      worksheet.addRow({
        orderNo: order.orderNo,
        residentName: residentAddress?.residentName || '',
        phone: residentAddress?.phone || '',
        address: `${residentAddress?.province || ''}${residentAddress?.city || ''}${residentAddress?.district || ''}${residentAddress?.street || ''}${residentAddress?.community || ''}`,
        problemType: problemType?.name || '',
        gridWorker: gridWorker?.name || '',
        responsibleUnit: responsibleUnit?.name || '',
        status: this.getStatusText(order.status),
        scene: this.getSceneText(order.scene),
        description: order.description,
        createdAt: order.createdAt?.toLocaleString('zh-CN'),
        completedAt: order.completedAt?.toLocaleString('zh-CN') || ''
      });
    }

    const photosWorksheet = workbook.addWorksheet('照片修改记录');
    photosWorksheet.columns = [
      { header: '工单编号', key: 'orderNo', width: 20 },
      { header: '照片类型', key: 'photoType', width: 15 },
      { header: '照片URL', key: 'photoUrl', width: 40 },
      { header: '上传人', key: 'uploadedBy', width: 15 },
      { header: '上传时间', key: 'createdAt', width: 20 },
      { header: '影响记录', key: 'affectedRecords', width: 40 }
    ];

    const photos = await WorkOrderPhoto.findAll({
      where: {
        workOrderId: filteredOrders.map(o => o.id)
      },
      include: [{ model: WorkOrder, as: 'workOrder' }]
    });

    const photoModifications = await ModificationHistory.findAll({
      where: {
        entityType: EntityType.WORK_ORDER_PHOTO,
        entityId: photos.map(p => p.id)
      }
    });

    for (const photo of photos) {
      const modifications = photoModifications.filter(m => m.entityId === photo.id);
      const affectedRecords = modifications.map(m => `${m.fieldName}: ${m.oldValue} → ${m.newValue} (${m.modifiedByName})`).join('; ');

      photosWorksheet.addRow({
        orderNo: (photo as any).workOrder?.orderNo || '',
        photoType: this.getPhotoTypeText(photo.photoType),
        photoUrl: photo.photoUrl,
        uploadedBy: photo.uploadedByName,
        createdAt: photo.createdAt?.toLocaleString('zh-CN'),
        affectedRecords: affectedRecords || '无修改'
      });
    }

    const historyWorksheet = workbook.addWorksheet('修改历史记录');
    historyWorksheet.columns = [
      { header: '实体类型', key: 'entityType', width: 20 },
      { header: '字段名', key: 'fieldName', width: 20 },
      { header: '原值', key: 'oldValue', width: 30 },
      { header: '新值', key: 'newValue', width: 30 },
      { header: '修改人', key: 'modifiedByName', width: 15 },
      { header: '修改原因', key: 'reason', width: 30 },
      { header: '影响记录', key: 'affectedRecords', width: 40 },
      { header: '修改时间', key: 'createdAt', width: 20 }
    ];

    const allModifications = await ModificationHistory.findAll({
      where: {
        createdAt: startDate && endDate ? { [Op.between]: [startDate, endDate] } : undefined
      },
      order: [['createdAt', 'DESC']]
    });

    for (const mod of allModifications) {
      historyWorksheet.addRow({
        entityType: this.getEntityTypeText(mod.entityType),
        fieldName: mod.fieldName,
        oldValue: mod.oldValue,
        newValue: mod.newValue,
        modifiedByName: mod.modifiedByName,
        reason: mod.reason,
        affectedRecords: mod.affectedRecords,
        createdAt: mod.createdAt?.toLocaleString('zh-CN')
      });
    }

    await OperationLog.create({
      id: uuidv4(),
      workOrderId: null,
      operationType: OperationType.EXPORT,
      operatorId,
      operatorName,
      description: `导出工单数据: ${filteredOrders.length}条`
    });

    const exportDir = path.join(__dirname, '../../exports');
    const filename = `工单导出_${new Date().getTime()}.xlsx`;
    const filePath = path.join(exportDir, filename);

    await workbook.xlsx.writeFile(filePath);

    return filePath;
  }

  private getStatusText(status: WorkOrderStatus): string {
    const map: { [key in WorkOrderStatus]: string } = {
      [WorkOrderStatus.PENDING]: '待处理',
      [WorkOrderStatus.ASSIGNED]: '已分派',
      [WorkOrderStatus.PROCESSING]: '处理中',
      [WorkOrderStatus.REVIEWING]: '复核中',
      [WorkOrderStatus.COMPLETED]: '已完成',
      [WorkOrderStatus.REJECTED]: '已拒绝',
      [WorkOrderStatus.BLOCKED]: '已拦截'
    };
    return map[status] || status;
  }

  private getSceneText(scene: string): string {
    const map: { [key: string]: string } = {
      normal: '正常流程',
      blocked: '规则拦截',
      review: '人工复核',
      duplicate: '重复提交'
    };
    return map[scene] || scene;
  }

  private getPhotoTypeText(type: string): string {
    const map: { [key: string]: string } = {
      report: '报事照片',
      process: '处理照片',
      completion: '完成照片'
    };
    return map[type] || type;
  }

  private getEntityTypeText(type: EntityType): string {
    const map: { [key in EntityType]: string } = {
      [EntityType.RESIDENT_ADDRESS]: '居民地址',
      [EntityType.PROBLEM_TYPE]: '问题类型',
      [EntityType.GRID_WORKER]: '网格员',
      [EntityType.WORK_ORDER]: '工单',
      [EntityType.WORK_ORDER_PHOTO]: '工单照片'
    };
    return map[type] || type;
  }
}

export default new ExportService();
