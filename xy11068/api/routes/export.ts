import express, { Request, Response } from 'express';
import { ReturnApplication, ReturnStatus } from '../../shared/types';
import { mockReturns } from '../data/mockData';

const router = express.Router();

let returnsStore: ReturnApplication[] = JSON.parse(JSON.stringify(mockReturns));

const exportFields = [
  { key: 'id', label: '归还单号' },
  { key: 'teamName', label: '讲解组名称' },
  { key: 'responsiblePerson', label: '负责人' },
  { key: 'phone', label: '联系电话' },
  { key: 'returnDate', label: '归还日期' },
  { key: 'submitSource', label: '提交来源' },
  { key: 'submitTime', label: '提交时间' },
  { key: 'operator', label: '操作者' },
  { key: 'status', label: '状态' },
  { key: 'deviceCount', label: '设备数量' },
  { key: 'hasIssues', label: '是否有问题' },
  { key: 'issueCount', label: '问题数量' }
];

router.post('/', (req: Request, res: Response) => {
  const {
    format = 'json',
    fields = exportFields.map(f => f.key),
    filters = {},
    includeDevices = false
  } = req.body;
  
  let data = [...returnsStore];
  
  if (filters.status) {
    data = data.filter(r => r.status === filters.status);
  }
  
  if (filters.startDate) {
    data = data.filter(r => r.returnDate >= filters.startDate);
  }
  
  if (filters.endDate) {
    data = data.filter(r => r.returnDate <= filters.endDate);
  }
  
  if (filters.teamName) {
    data = data.filter(r => r.teamName.includes(filters.teamName));
  }
  
  const mappedData = data.map(app => {
    const result: any = {};
    fields.forEach((field: string) => {
      if (field === 'hasIssues') {
        result[field] = app.validationIssues.length > 0 ? '是' : '否';
      } else if (field === 'issueCount') {
        result[field] = app.validationIssues.length;
      } else if (field === 'status') {
        const statusMap: Record<ReturnStatus, string> = {
          [ReturnStatus.DRAFT]: '待提交',
          [ReturnStatus.PENDING]: '待审核',
          [ReturnStatus.APPROVED]: '审核通过',
          [ReturnStatus.REJECTED]: '审核驳回',
          [ReturnStatus.OWNERSHIP_ISSUE]: '归属不清',
          [ReturnStatus.PROCESSING]: '问题处理中',
          [ReturnStatus.STORED]: '设备入库',
          [ReturnStatus.COMPLETED]: '已完成',
          [ReturnStatus.ISSUE_RECORDED]: '问题记录'
        };
        result[field] = statusMap[app.status as ReturnStatus] || app.status;
      } else if (field === 'submitSource') {
        const sourceMap: Record<string, string> = {
          web: 'Web端',
          miniapp: '小程序',
          backend: '后台录入'
        };
        result[field] = sourceMap[app.submitSource] || app.submitSource;
      } else {
        result[field] = (app as any)[field];
      }
    });
    
    if (includeDevices) {
      result.devices = app.devices.map(d => ({
        设备编号: d.deviceId,
        设备类型: d.deviceType === 'adult' ? '成人讲解器' : d.deviceType === 'child' ? '儿童讲解器' : '团体讲解器',
        电量状态: d.batteryStatus === 'full' ? '充足(>80%)' : d.batteryStatus === 'normal' ? '一般(50-80%)' : d.batteryStatus === 'low' ? '偏低(<50%)' : '需充电',
        借出日期: d.borrowDate,
        借出团队: d.borrowTeam,
        设备状态: d.condition === 'normal' ? '正常' : d.condition === 'damaged' ? '损坏' : '丢失',
        备注: d.remarks
      }));
    }
    
    return result;
  });
  
  const fieldLabels: Record<string, string> = {};
  exportFields.forEach(f => {
    fieldLabels[f.key] = f.label;
  });
  
  if (format === 'json') {
    res.json({
      success: true,
      data: {
        fields: fields.map((f: string) => ({ key: f, label: fieldLabels[f] || f })),
        records: mappedData,
        total: mappedData.length,
        exportTime: new Date().toISOString()
      }
    });
  } else {
    res.json({
      success: true,
      data: {
        fields: fields.map((f: string) => ({ key: f, label: fieldLabels[f] || f })),
        records: mappedData,
        total: mappedData.length,
        exportTime: new Date().toISOString(),
        message: '表格格式前端可以使用xlsx库导出为Excel'
      }
    });
  }
});

router.get('/fields', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: exportFields
  });
});

export default router;
