import request from 'supertest';
import app from './app';
import { repository } from './repository';
import { prescriptionService } from './service';
import { PrescriptionStatus } from './models';

describe('在线医疗问诊处方撤回通知 API 测试', () => {
  beforeEach(() => {
    repository.clear();
  });

  describe('1. 完整流转测试 - 成功撤回流程', () => {
    it('应完成从创建到撤回审核通过并关闭的完整流程', async () => {
      const createRes = await request(app)
        .post('/api/prescriptions')
        .send({
          prescriptionNo: 'RX2024001',
          consultation: {
            patientName: '张三',
            patientId: 'P001',
            diagnosis: '上呼吸道感染',
            consultTime: new Date().toISOString()
          },
          doctor: {
            name: '李医生',
            department: '内科',
            licenseNo: 'DOC12345'
          },
          medicines: [
            { name: '阿莫西林', specification: '0.5g*24粒', dosage: '每日3次，每次1粒', quantity: 2, price: 25.5 }
          ]
        });

      expect(createRes.status).toBe(201);
      const prescriptionId = createRes.body.id;
      expect(createRes.body.status).toBe(PrescriptionStatus.PRESCRIBED);

      const withdrawRes = await request(app)
        .post(`/api/prescriptions/${prescriptionId}/withdraw`)
        .send({
          reason: '患者过敏史未记录，需要重新开方',
          operatorId: 'OP001',
          operatorName: '李医生'
        });

      expect(withdrawRes.status).toBe(200);
      expect(withdrawRes.body.status).toBe(PrescriptionStatus.WITHDRAWING);
      expect(withdrawRes.body.withdrawalRecords.length).toBe(1);

      const auditRes = await request(app)
        .post(`/api/prescriptions/${prescriptionId}/audit`)
        .send({
          approved: true,
          remark: '情况属实，同意撤回',
          operatorId: 'ADMIN001',
          operatorName: '张主任'
        });

      expect(auditRes.status).toBe(200);
      expect(auditRes.body.status).toBe(PrescriptionStatus.NOTIFIED);

      const closeRes = await request(app)
        .post(`/api/prescriptions/${prescriptionId}/close`);

      expect(closeRes.status).toBe(200);
      expect(closeRes.body.status).toBe(PrescriptionStatus.CLOSED);

      const detailRes = await request(app).get(`/api/prescriptions/${prescriptionId}`);
      expect(detailRes.status).toBe(200);
      expect(detailRes.body.status).toBe(PrescriptionStatus.CLOSED);

      const historyRes = await request(app).get(`/api/prescriptions/${prescriptionId}/history`);
      expect(historyRes.status).toBe(200);
      expect(historyRes.body.length).toBeGreaterThanOrEqual(2);

      const listRes = await request(app).get('/api/prescriptions');
      expect(listRes.status).toBe(200);
      const found = listRes.body.find((p: any) => p.id === prescriptionId);
      expect(found).toBeDefined();
      expect(found.status).toBe(PrescriptionStatus.CLOSED);
    });
  });

  describe('2. 冲突记录测试 - 药房已配药后撤回', () => {
    it('药房已配药后发起撤回应返回冲突错误', async () => {
      const createRes = await request(app)
        .post('/api/prescriptions')
        .send({
          prescriptionNo: 'RX2024002',
          consultation: {
            patientName: '李四',
            patientId: 'P002',
            diagnosis: '高血压',
            consultTime: new Date().toISOString()
          },
          doctor: {
            name: '王医生',
            department: '心内科',
            licenseNo: 'DOC67890'
          },
          medicines: [
            { name: '硝苯地平缓释片', specification: '10mg*30片', dosage: '每日2次，每次1片', quantity: 1, price: 32.0 }
          ]
        });

      const prescriptionId = createRes.body.id;

      const dispenseRes = await request(app)
        .post(`/api/prescriptions/${prescriptionId}/dispensed`);
      expect(dispenseRes.status).toBe(200);
      expect(dispenseRes.body.isDispensed).toBe(true);
      expect(dispenseRes.body.status).toBe(PrescriptionStatus.DISPENSED);

      const withdrawRes = await request(app)
        .post(`/api/prescriptions/${prescriptionId}/withdraw`)
        .send({
          reason: '剂量需要调整',
          operatorId: 'OP002',
          operatorName: '王医生'
        });

      expect(withdrawRes.status).toBe(409);
      expect(withdrawRes.body.error).toContain('已配药');

      const detailRes = await request(app).get(`/api/prescriptions/${prescriptionId}`);
      expect(detailRes.body.status).toBe(PrescriptionStatus.DISPENSED);

      const listRes = await request(app).get('/api/prescriptions?status=dispensed');
      expect(listRes.status).toBe(200);
      const found = listRes.body.find((p: any) => p.id === prescriptionId);
      expect(found).toBeDefined();
    });
  });

  describe('3. 导入坏行测试', () => {
    it('导入时应正确识别坏行并返回错误详情', async () => {
      const importData = [
        {
          prescriptionNo: 'RX2024003',
          patientName: '王五',
          patientId: 'P003',
          diagnosis: '糖尿病',
          consultTime: new Date().toISOString(),
          doctorName: '赵医生',
          department: '内分泌科',
          licenseNo: 'DOC11111',
          medicines: '[{"name":"二甲双胍","specification":"0.5g*30片","dosage":"每日2次","quantity":2,"price":45.0}]'
        },
        {
          prescriptionNo: 'RX2024003',
          patientName: '重复处方号',
          medicines: '[]'
        },
        {
          patientName: '缺少处方号',
          medicines: '[{"name":"测试药"}]'
        },
        {
          prescriptionNo: 'RX2024006',
          medicines: ''
        }
      ];

      const importRes = await request(app)
        .post('/api/prescriptions/import')
        .send(importData);

      expect(importRes.status).toBe(200);
      expect(importRes.body.success).toBe(1);
      expect(importRes.body.failed).toBe(3);
      expect(importRes.body.errors.length).toBe(3);

      const duplicateError = importRes.body.errors.find((e: any) => e.row === 2);
      expect(duplicateError).toBeDefined();
      expect(duplicateError.message).toContain('已存在');

      const missingNoError = importRes.body.errors.find((e: any) => e.row === 3);
      expect(missingNoError).toBeDefined();
      expect(missingNoError.message).toContain('处方号');

      const listRes = await request(app).get('/api/prescriptions');
      expect(listRes.body.length).toBe(1);
      expect(listRes.body[0].prescriptionNo).toBe('RX2024003');

      const exportRes = await request(app).get('/api/prescriptions/export/json');
      expect(exportRes.status).toBe(200);
      expect(exportRes.body.length).toBe(1);
    });
  });

  describe('4. 审核驳回流程测试', () => {
    it('应支持审核驳回并能正确关闭', async () => {
      const createRes = await request(app)
        .post('/api/prescriptions')
        .send({
          prescriptionNo: 'RX2024007',
          consultation: {
            patientName: '孙七',
            patientId: 'P007',
            diagnosis: '感冒',
            consultTime: new Date().toISOString()
          },
          doctor: {
            name: '周医生',
            department: '全科',
            licenseNo: 'DOC77777'
          },
          medicines: [
            { name: '感冒灵', specification: '10g*9袋', dosage: '每日3次', quantity: 1, price: 15.0 }
          ]
        });

      const prescriptionId = createRes.body.id;

      await request(app)
        .post(`/api/prescriptions/${prescriptionId}/withdraw`)
        .send({
          reason: '不想吃药了',
          operatorId: 'OP007',
          operatorName: '周医生'
        });

      const auditRes = await request(app)
        .post(`/api/prescriptions/${prescriptionId}/audit`)
        .send({
          approved: false,
          remark: '撤回理由不充分，不予通过',
          operatorId: 'ADMIN002',
          operatorName: '刘主任'
        });

      expect(auditRes.status).toBe(200);
      expect(auditRes.body.status).toBe(PrescriptionStatus.REJECTED);

      const closeRes = await request(app)
        .post(`/api/prescriptions/${prescriptionId}/close`);
      expect(closeRes.status).toBe(200);
      expect(closeRes.body.status).toBe(PrescriptionStatus.CLOSED);

      const historyRes = await request(app).get(`/api/prescriptions/${prescriptionId}/history`);
      expect(historyRes.body.length).toBe(2);
    });
  });

  describe('5. 数据一致性验证 - 列表、详情、历史、导出互相对上', () => {
    it('各接口返回的数据应保持一致', async () => {
      const createRes = await request(app)
        .post('/api/prescriptions')
        .send({
          prescriptionNo: 'RX2024008',
          consultation: {
            patientName: '吴八',
            patientId: 'P008',
            diagnosis: '咳嗽',
            consultTime: new Date().toISOString()
          },
          doctor: {
            name: '郑医生',
            department: '呼吸科',
            licenseNo: 'DOC88888'
          },
          medicines: [
            { name: '止咳糖浆', specification: '100ml', dosage: '每日3次，每次10ml', quantity: 1, price: 28.0 }
          ]
        });

      const prescriptionId = createRes.body.id;

      await request(app)
        .post(`/api/prescriptions/${prescriptionId}/withdraw`)
        .send({
          reason: '症状缓解',
          operatorId: 'OP008',
          operatorName: '郑医生'
        });

      await request(app)
        .post(`/api/prescriptions/${prescriptionId}/audit`)
        .send({
          approved: true,
          remark: '同意',
          operatorId: 'ADMIN003',
          operatorName: '陈主任'
        });

      const listRes = await request(app).get('/api/prescriptions');
      const listItem = listRes.body.find((p: any) => p.id === prescriptionId);
      expect(listItem).toBeDefined();
      expect(listItem.status).toBe(PrescriptionStatus.NOTIFIED);
      expect(listItem.prescriptionNo).toBe('RX2024008');

      const detailRes = await request(app).get(`/api/prescriptions/${prescriptionId}`);
      expect(detailRes.body.id).toBe(listItem.id);
      expect(detailRes.body.status).toBe(listItem.status);
      expect(detailRes.body.prescriptionNo).toBe(listItem.prescriptionNo);
      expect(detailRes.body.withdrawalRecords.length).toBe(2);

      const historyRes = await request(app).get(`/api/prescriptions/${prescriptionId}/history`);
      expect(historyRes.body.length).toBe(detailRes.body.withdrawalRecords.length);

      const exportData = await prescriptionService.exportPrescriptions();
      const exportItem = exportData.find((p: any) => p.id === prescriptionId);
      expect(exportItem).toBeDefined();
      expect(exportItem.prescriptionNo).toBe(listItem.prescriptionNo);
      expect(exportItem.status).toBe(listItem.status);
      expect(exportItem.withdrawalCount).toBe(detailRes.body.withdrawalRecords.length);
    });
  });

  describe('6. 状态流转边界测试', () => {
    it('不允许非法的状态转换', async () => {
      const createRes = await request(app)
        .post('/api/prescriptions')
        .send({
          prescriptionNo: 'RX2024009',
          consultation: { patientName: '测试', patientId: 'P009', diagnosis: '测试', consultTime: new Date().toISOString() },
          doctor: { name: '测试医生', department: '测试', licenseNo: 'TEST001' },
          medicines: [{ name: '测试药', specification: '测试', dosage: '测试', quantity: 1, price: 1 }]
        });

      const prescriptionId = createRes.body.id;

      const invalidClose = await request(app)
        .post(`/api/prescriptions/${prescriptionId}/close`);
      expect(invalidClose.status).toBe(400);

      const invalidAudit = await request(app)
        .post(`/api/prescriptions/${prescriptionId}/audit`)
        .send({ approved: true, operatorId: 'test', operatorName: '测试' });
      expect(invalidAudit.status).toBe(400);
    });
  });
});
