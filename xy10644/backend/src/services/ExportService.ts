import ExcelJS from 'exceljs';
import { db } from '../database';
import { OperationLogService } from './OperationLogService';
import { TemperatureBoxService } from './TemperatureBoxService';
import { DelayExchangeService } from './DelayExchangeService';
import { RiderHandoverService } from './RiderHandoverService';
import { GPSService } from './GPSService';

export class ExportService {
  static async exportReport(
    operatorId: string,
    operatorName: string,
    filters?: {
      changedBy?: string;
      startTime?: string;
      endTime?: string;
    }
  ): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = '冷链药品配送系统';
    workbook.created = new Date();

    const boxesSheet = workbook.addWorksheet('温度箱列表');
    boxesSheet.columns = [
      { header: '箱号', key: 'boxCode', width: 15 },
      { header: '订单号', key: 'orderId', width: 15 },
      { header: '药品名称', key: 'medicineName', width: 20 },
      { header: '温度范围', key: 'tempRange', width: 15 },
      { header: '当前温度', key: 'currentTemp', width: 12 },
      { header: '状态', key: 'status', width: 12 },
      { header: '创建时间', key: 'createdAt', width: 20 },
      { header: '创建人', key: 'createdBy', width: 15 }
    ];

    const boxes = await TemperatureBoxService.getAllBoxes();
    boxes.forEach(box => {
      boxesSheet.addRow({
        boxCode: box.boxCode,
        orderId: box.orderId,
        medicineName: box.medicineName,
        tempRange: `${box.minTemp}°C ~ ${box.maxTemp}°C`,
        currentTemp: `${box.currentTemp}°C`,
        status: box.status,
        createdAt: box.createdAt,
        createdBy: box.createdBy
      });
    });

    const exchangesSheet = workbook.addWorksheet('延误换箱记录');
    exchangesSheet.columns = [
      { header: '箱号', key: 'boxCode', width: 15 },
      { header: '旧箱号', key: 'oldBoxCode', width: 15 },
      { header: '原因类型', key: 'reasonType', width: 15 },
      { header: '原因说明', key: 'reason', width: 30 },
      { header: '延误分钟', key: 'delayMinutes', width: 12 },
      { header: '修改人', key: 'changedBy', width: 15 },
      { header: '修改时间', key: 'changedAt', width: 20 },
      { header: '审核人', key: 'reviewedBy', width: 15 },
      { header: '审核时间', key: 'reviewedAt', width: 20 },
      { header: '状态', key: 'status', width: 12 },
      { header: '影响记录ID', key: 'affectedRecords', width: 30 }
    ];

    let exchanges = await DelayExchangeService.getAllExchanges();
    if (filters?.changedBy) {
      exchanges = exchanges.filter(e => e.changedBy === filters.changedBy);
    }
    if (filters?.startTime) {
      exchanges = exchanges.filter(e => e.changedAt >= filters.startTime!);
    }
    if (filters?.endTime) {
      exchanges = exchanges.filter(e => e.changedAt <= filters.endTime!);
    }

    for (const exchange of exchanges) {
      const box = await TemperatureBoxService.getBox(exchange.boxId);
      const oldBox = exchange.oldBoxId ? await TemperatureBoxService.getBox(exchange.oldBoxId) : null;
      exchangesSheet.addRow({
        boxCode: box?.boxCode || exchange.boxId,
        oldBoxCode: oldBox?.boxCode || exchange.oldBoxId || '-',
        reasonType: exchange.reasonType,
        reason: exchange.reason,
        delayMinutes: exchange.delayMinutes,
        changedBy: exchange.changedBy,
        changedAt: exchange.changedAt,
        reviewedBy: exchange.reviewedBy || '-',
        reviewedAt: exchange.reviewedAt || '-',
        status: exchange.status,
        affectedRecords: exchange.affectedRecordIds.join(', ')
      });
    }

    const handoverSheet = workbook.addWorksheet('骑手交接记录');
    handoverSheet.columns = [
      { header: '箱号', key: 'boxCode', width: 15 },
      { header: '骑手姓名', key: 'riderName', width: 15 },
      { header: '来源骑手', key: 'fromRiderName', width: 15 },
      { header: '交接位置', key: 'location', width: 20 },
      { header: '交接温度', key: 'temperature', width: 12 },
      { header: '交接时间', key: 'handoverTime', width: 20 },
      { header: '确认时间', key: 'confirmedTime', width: 20 },
      { header: '状态', key: 'status', width: 12 }
    ];

    for (const box of boxes) {
      const handovers = await RiderHandoverService.getHandoversByBox(box.id);
      handovers.forEach(h => {
        handoverSheet.addRow({
          boxCode: box.boxCode,
          riderName: h.riderName,
          fromRiderName: h.fromRiderName || '-',
          location: h.location,
          temperature: `${h.temperatureAtHandover}°C`,
          handoverTime: h.handoverTime,
          confirmedTime: h.confirmedTime || '-',
          status: h.status
        });
      });
    }

    const gpsSheet = workbook.addWorksheet('GPS温度节点');
    gpsSheet.columns = [
      { header: '箱号', key: 'boxCode', width: 15 },
      { header: '纬度', key: 'latitude', width: 15 },
      { header: '经度', key: 'longitude', width: 15 },
      { header: '温度', key: 'temperature', width: 12 },
      { header: '电量', key: 'battery', width: 10 },
      { header: '时间', key: 'timestamp', width: 20 }
    ];

    for (const box of boxes) {
      const nodes = await GPSService.getNodesByBox(box.id);
      nodes.forEach(n => {
        gpsSheet.addRow({
          boxCode: box.boxCode,
          latitude: n.latitude,
          longitude: n.longitude,
          temperature: `${n.temperature}°C`,
          battery: `${n.batteryLevel}%`,
          timestamp: n.timestamp
        });
      });
    }

    const logsSheet = workbook.addWorksheet('操作日志');
    logsSheet.columns = [
      { header: '操作类型', key: 'operationType', width: 15 },
      { header: '实体类型', key: 'entityType', width: 18 },
      { header: '实体ID', key: 'entityId', width: 36 },
      { header: '操作人ID', key: 'operatorId', width: 15 },
      { header: '操作人姓名', key: 'operatorName', width: 15 },
      { header: '操作时间', key: 'operateTime', width: 20 },
      { header: '修改前', key: 'beforeValue', width: 50 },
      { header: '修改后', key: 'afterValue', width: 50 },
      { header: '备注', key: 'remarks', width: 30 }
    ];

    let logs = await OperationLogService.getAllLogs();
    if (filters?.changedBy) {
      logs = logs.filter(l => l.operatorId === filters.changedBy);
    }
    if (filters?.startTime) {
      logs = logs.filter(l => l.operateTime >= filters.startTime!);
    }
    if (filters?.endTime) {
      logs = logs.filter(l => l.operateTime <= filters.endTime!);
    }

    logs.forEach(log => {
      logsSheet.addRow({
        operationType: log.operationType,
        entityType: log.entityType,
        entityId: log.entityId,
        operatorId: log.operatorId,
        operatorName: log.operatorName,
        operateTime: log.operateTime,
        beforeValue: log.beforeValue ? JSON.stringify(log.beforeValue) : '-',
        afterValue: log.afterValue ? JSON.stringify(log.afterValue) : '-',
        remarks: log.remarks || '-'
      });
    });

    await OperationLogService.createLog(
      'export',
      'report',
      'all',
      operatorId,
      operatorName,
      null,
      { recordCount: logs.length, filters },
      '导出完整报告'
    );

    return await workbook.xlsx.writeBuffer() as Buffer;
  }

  static async exportTimeline(boxId: string, operatorId: string, operatorName: string): Promise<Buffer> {
    const box = await TemperatureBoxService.getBox(boxId);
    if (!box) {
      throw new Error('温度箱不存在');
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = '冷链药品配送系统';

    const timelineSheet = workbook.addWorksheet(`时间线-${box.boxCode}`);
    timelineSheet.columns = [
      { header: '时间', key: 'time', width: 25 },
      { header: '类型', key: 'type', width: 15 },
      { header: '描述', key: 'description', width: 40 },
      { header: '操作人', key: 'operator', width: 15 },
      { header: '详细数据', key: 'details', width: 50 }
    ];

    const timeline: any[] = [];
    const handovers = await RiderHandoverService.getHandoversByBox(boxId);
    handovers.forEach(h => {
      timeline.push({
        time: h.handoverTime,
        type: '骑手交接',
        description: `${h.riderName} 在 ${h.location} 交接`,
        operator: h.riderName,
        details: `温度: ${h.temperatureAtHandover}°C, 状态: ${h.status}`
      });
    });

    const exchanges = await DelayExchangeService.getExchangesByBox(boxId);
    exchanges.forEach(e => {
      timeline.push({
        time: e.changedAt,
        type: '延误换箱',
        description: e.reason,
        operator: e.changedBy,
        details: `延误: ${e.delayMinutes}分钟, 状态: ${e.status}`
      });
    });

    const logs = await OperationLogService.getLogsByEntity('temperature_box', boxId);
    logs.forEach(l => {
      timeline.push({
        time: l.operateTime,
        type: '状态变更',
        description: l.remarks || '',
        operator: l.operatorName,
        details: l.afterValue ? JSON.stringify(l.afterValue) : ''
      });
    });

    timeline.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
    timeline.forEach(item => timelineSheet.addRow(item));

    await OperationLogService.createLog(
      'export',
      'timeline',
      boxId,
      operatorId,
      operatorName,
      null,
      { boxCode: box.boxCode },
      '导出时间线报告'
    );

    return await workbook.xlsx.writeBuffer() as Buffer;
  }
}
