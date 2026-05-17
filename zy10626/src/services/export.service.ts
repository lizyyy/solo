import { Parser } from 'json2csv';
import { queryChecklists } from './checklist.service';
import { QueryParams, CheckList } from '../types';

export async function exportChecklistsToCSV(params: QueryParams): Promise<string> {
  const { list } = await queryChecklists({ ...params, pageSize: 10000 });

  const fields = [
    { label: '检查单号', value: 'checklistNo' },
    { label: '患者姓名', value: 'patientName' },
    { label: '身份证号', value: 'patientIdCard' },
    { label: '联系电话', value: 'patientPhone' },
    { label: '检查项目', value: 'examItemName' },
    { label: '项目编码', value: 'examItemCode' },
    { label: '科室', value: 'department' },
    { label: '号源日期', value: 'timeSlotDate' },
    { label: '号源时段', value: 'timeSlotTime' },
    { label: '状态', value: 'status' },
    { label: '释放原因', value: 'releaseReason' },
    { label: '释放备注', value: 'releaseRemark' },
    { label: '操作人', value: 'operator' },
    { label: '业务对象', value: 'businessObject' },
    { label: '创建时间', value: 'createdAt' },
    { label: '释放时间', value: 'releasedAt' }
  ];

  const json2csvParser = new Parser({ fields });
  return json2csvParser.parse(list);
}

export function getExportTemplate(): string {
  const fields = [
    'patientName', 'patientIdCard', 'patientPhone',
    'examItemCode', 'timeSlotDate', 'timeSlotTime',
    'operator', 'businessObject', 'needRelease',
    'releaseReason', 'releaseRemark'
  ];

  const headers = [
    '患者姓名', '身份证号', '联系电话',
    '检查项目编码', '号源日期(YYYY-MM-DD)', '号源时段(HH:mm-HH:mm)',
    '操作人', '业务对象', '是否需要释放(true/false)',
    '释放原因', '释放备注'
  ];

  const json2csvParser = new Parser({ fields, header: true });
  const dummyRow = fields.reduce((acc: any, field) => {
    acc[field] = '';
    return acc;
  }, {});

  return json2csvParser.parse([dummyRow]);
}
