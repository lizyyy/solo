import { createObjectCsvWriter } from 'csv-writer';
import path from 'path';
import fs from 'fs';
import { SampleService } from './SampleService';
import { TemperatureService } from './TemperatureService';
import { ExceptionService } from './ExceptionService';

const exportDir = path.join(__dirname, '../../exports');

if (!fs.existsSync(exportDir)) {
  fs.mkdirSync(exportDir, { recursive: true });
}

export class ExportService {
  static async exportSampleChain(sampleId: string): Promise<string> {
    const sample = await SampleService.getSampleById(sampleId);
    if (!sample) {
      throw new Error('样本不存在');
    }

    const transfers = await SampleService.getTransferHistory(sampleId);
    const responsibilityChain = await SampleService.getResponsibilityChain(sampleId);
    const temperatureHistory = await TemperatureService.getTemperatureHistory(sampleId);
    const exceptions = await ExceptionService.getExceptions({ sampleId });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `sample-chain-${sample.barcode}-${timestamp}.csv`;
    const filepath = path.join(exportDir, filename);

    const csvWriter = createObjectCsvWriter({
      path: filepath,
      header: [
        { id: 'section', title: '数据段' },
        { id: 'field', title: '字段' },
        { id: 'value', title: '值' },
        { id: 'time', title: '时间' },
        { id: 'handler', title: '处理人' }
      ]
    });

    const records: any[] = [];

    records.push({
      section: '样本基本信息',
      field: '条码',
      value: sample.barcode,
      time: sample.createdAt,
      handler: sample.currentHandler
    });
    records.push({
      section: '样本基本信息',
      field: '类型',
      value: sample.type,
      time: '',
      handler: ''
    });
    records.push({
      section: '样本基本信息',
      field: '状态',
      value: sample.status,
      time: sample.updatedAt,
      handler: sample.currentHandler
    });

    transfers.forEach((transfer, index) => {
      records.push({
        section: `交接记录 #${index + 1}`,
        field: '从',
        value: `${transfer.fromHandler} @ ${transfer.fromLocation}`,
        time: transfer.transferTime,
        handler: transfer.fromHandler
      });
      records.push({
        section: `交接记录 #${index + 1}`,
        field: '到',
        value: `${transfer.toHandler} @ ${transfer.toLocation}`,
        time: transfer.transferTime,
        handler: transfer.toHandler
      });
      if (transfer.temperature !== undefined) {
        records.push({
          section: `交接记录 #${index + 1}`,
          field: '温度',
          value: `${transfer.temperature}°C`,
          time: transfer.transferTime,
          handler: ''
        });
      }
    });

    responsibilityChain.forEach((link, index) => {
      records.push({
        section: `责任链 #${index + 1}`,
        field: link.role,
        value: link.action,
        time: link.startTime,
        handler: link.handler
      });
    });

    temperatureHistory.forEach((record, index) => {
      records.push({
        section: `温度记录 #${index + 1}`,
        field: '温度',
        value: `${record.temperature}°C`,
        time: record.recordTime,
        handler: record.recordedBy
      });
    });

    exceptions.forEach((exception, index) => {
      records.push({
        section: `异常记录 #${index + 1}`,
        field: exception.type,
        value: exception.description,
        time: exception.reportedAt,
        handler: exception.reportedBy
      });
    });

    await csvWriter.writeRecords(records);
    return filename;
  }

  static async exportBatchSamples(batchId: string): Promise<string> {
    const samples = await SampleService.getAllSamples({ batchId });
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `batch-samples-${batchId}-${timestamp}.csv`;
    const filepath = path.join(exportDir, filename);

    const csvWriter = createObjectCsvWriter({
      path: filepath,
      header: [
        { id: 'barcode', title: '条码' },
        { id: 'type', title: '类型' },
        { id: 'status', title: '状态' },
        { id: 'collectionPoint', title: '采集点' },
        { id: 'destinationLab', title: '目的实验室' },
        { id: 'currentLocation', title: '当前位置' },
        { id: 'currentHandler', title: '当前处理人' },
        { id: 'createdAt', title: '创建时间' },
        { id: 'updatedAt', title: '更新时间' }
      ]
    });

    await csvWriter.writeRecords(samples);
    return filename;
  }

  static getExportFilePath(filename: string): string {
    return path.join(exportDir, filename);
  }
}
