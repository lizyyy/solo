import { db } from '@/lib/db'
import { createPointLocation, createApprovalRecord } from '@/lib/merge-detect'

const SAMPLE_POINTS = [
  { name: '中山路与解放路交叉口', district: '朝阳区', longitude: 116.473654, latitude: 39.921890, complaintId: 'TS-2024-001', complaintTime: '2024-03-15', approvalRef: 'SP-2024-089', designCapacity: 120, actualDemand: 95, constructionPeriod: '2024-04-01~2024-06-30', maintenancePeriod: '2024-07-01~2024-09-30', sourceTrace: '审批台账-第12页' },
  { name: '中山路与解放路交叉口', district: '朝阳区', longitude: 116.473701, latitude: 39.921912, complaintId: 'TS-2024-015', complaintTime: '2024-03-20', approvalRef: 'SP-2024-089', designCapacity: 120, actualDemand: 130, constructionPeriod: '2024-04-01~2024-06-30', maintenancePeriod: '2024-07-01~2024-09-30', sourceTrace: '12345热线转办单' },
  { name: '建设大道与光华路交叉口', district: '海淀区', longitude: 116.315432, latitude: 39.968765, complaintId: 'TS-2024-002', complaintTime: '2024-04-02', approvalRef: 'SP-2024-091', designCapacity: 80, actualDemand: 80, constructionPeriod: '2024-05-01~2024-07-31', maintenancePeriod: '2024-08-01~2024-10-31', sourceTrace: '审批台账-第15页' },
  { name: '建设大道与光华路交叉口', district: '海淀区', longitude: 116.315445, latitude: 39.968770, complaintId: 'TS-2024-008', complaintTime: '2024-04-05', approvalRef: 'SP-2024-091', designCapacity: 80, actualDemand: 80, constructionPeriod: '2024-05-01~2024-07-31', maintenancePeriod: '2024-08-01~2024-10-31', sourceTrace: '居民投诉登记表' },
  { name: '人民路与民主街交叉口', district: '朝阳区', longitude: null, latitude: null, complaintId: '', complaintTime: '2024-05-10', approvalRef: '', designCapacity: null, actualDemand: null, constructionPeriod: '', maintenancePeriod: '', sourceTrace: '口头反馈' },
  { name: '长安街与复兴路交叉口', district: '西城区', longitude: 116.356789, latitude: 39.908765, complaintId: 'TS-2024-003', complaintTime: '2024-03-28', approvalRef: 'SP-2024-092', designCapacity: 200, actualDemand: 200, constructionPeriod: '2024-06-01~2024-08-31', maintenancePeriod: '2024-09-01~2024-11-30', sourceTrace: '审批台账-第18页' },
  { name: '长安街与复兴路交叉口', district: '西城区', longitude: 116.356790, latitude: 39.908770, complaintId: 'TS-2024-003', complaintTime: '2024-03-28', approvalRef: 'SP-2024-092', designCapacity: 200, actualDemand: 200, constructionPeriod: '2024-06-01~2024-08-31', maintenancePeriod: '2024-09-01~2024-11-30', sourceTrace: '重复录入' },
]

const SAMPLE_APPROVALS = [
  { approvalRef: 'SP-2024-089', locationName: '中山路与解放路交叉口', district: '朝阳区', content: '同意建设雨水花园，设计容量150m³', approvalStatus: '已批准', approvedAt: '2024-03-10', designCapacity: 150, constructionPeriod: '2024-04-01~2024-06-30', maintenancePeriod: '2024-07-01~2024-09-30', sourceFile: '审批台账.xlsx' },
  { approvalRef: 'SP-2024-091', locationName: '建设大道与光华路交叉口', district: '海淀区', content: '同意建设雨水花园，设计容量80m³', approvalStatus: '已批准', approvedAt: '2024-04-01', designCapacity: 80, constructionPeriod: '2024-05-01~2024-07-31', maintenancePeriod: '2024-08-01~2024-10-31', sourceFile: '审批台账.xlsx' },
  { approvalRef: 'SP-2024-092', locationName: '长安街与复兴路交叉口', district: '西城区', content: '同意建设雨水花园，设计容量180m³', approvalStatus: '已批准', approvedAt: '2024-03-25', designCapacity: 180, constructionPeriod: '2024-05-15~2024-08-15', maintenancePeriod: '2024-08-16~2024-11-15', sourceFile: '审批台账.xlsx' },
]

export async function loadSampleData() {
  const existingPoints = await db.points.count()
  if (existingPoints > 0) return false

  const points = SAMPLE_POINTS.map(d => createPointLocation(d))
  const approvals = SAMPLE_APPROVALS.map(d => createApprovalRecord(d))

  await db.points.bulkAdd(points)
  await db.approvals.bulkAdd(approvals)
  return true
}
