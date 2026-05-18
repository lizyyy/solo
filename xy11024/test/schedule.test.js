const request = require('supertest');
const app = require('../src/app');
const dataStore = require('../src/store/dataStore');
const { SCHEDULE_STATUS, REHAB_PROGRAMS } = require('../src/models/Schedule');

describe('产后康复排程API - 边界测试', () => {
  beforeEach(() => {
    dataStore.clear();
  });

  describe('导入接口 - 缺字段测试', () => {
    it('缺少patientId应该返回错误', async () => {
      const response = await request(app)
        .post('/api/schedule/import')
        .send({
          patientName: '张三',
          programCode: 'P001',
          programName: REHAB_PROGRAMS.PELVIC_FLOOR,
          scheduledDate: '2024-01-15',
          scheduledTime: '09:00'
        });

      expect(response.status).toBe(200);
      expect(response.body.summary.error).toBe(1);
      const result = response.body.results[0];
      expect(result.success).toBe(false);
      expect(result.errors.some(e => e.field === 'patientId')).toBe(true);
    });

    it('缺少programName应该返回错误', async () => {
      const response = await request(app)
        .post('/api/schedule/import')
        .send({
          patientId: 'P2024001',
          patientName: '张三',
          programCode: 'P001',
          scheduledDate: '2024-01-15',
          scheduledTime: '09:00'
        });

      expect(response.status).toBe(200);
      expect(response.body.summary.error).toBe(1);
      const result = response.body.results[0];
      expect(result.success).toBe(false);
      expect(result.errors.some(e => e.field === 'programName')).toBe(true);
    });

    it('缺少scheduledTime应该返回错误', async () => {
      const response = await request(app)
        .post('/api/schedule/import')
        .send({
          patientId: 'P2024001',
          patientName: '张三',
          programCode: 'P001',
          programName: REHAB_PROGRAMS.PELVIC_FLOOR,
          scheduledDate: '2024-01-15'
        });

      expect(response.status).toBe(200);
      expect(response.body.summary.error).toBe(1);
    });
  });

  describe('导入接口 - 重复提交测试', () => {
    it('同一患者相同时间相同项目应该判定为重复', async () => {
      const scheduleData = {
        patientId: 'P2024001',
        patientName: '张三',
        programCode: 'P001',
        programName: REHAB_PROGRAMS.PELVIC_FLOOR,
        scheduledDate: '2024-01-15',
        scheduledTime: '09:00',
        therapistName: '李医师',
        roomNumber: '301'
      };

      await request(app)
        .post('/api/schedule/import')
        .send(scheduleData);

      const response = await request(app)
        .post('/api/schedule/import')
        .send(scheduleData);

      expect(response.status).toBe(200);
      expect(response.body.summary.error).toBe(1);
      const result = response.body.results[0];
      expect(result.success).toBe(false);
      expect(result.errors[0].field).toBe('duplicate');
      expect(result.errors[0].message).toContain('重复提交');
      expect(result.errors[0].suggestion).toBeDefined();
      expect(result.originalData).toBeDefined();
    });

    it('不同时间的相同项目不应判定为重复', async () => {
      const scheduleData1 = {
        patientId: 'P2024001',
        patientName: '张三',
        programCode: 'P001',
        programName: REHAB_PROGRAMS.PELVIC_FLOOR,
        scheduledDate: '2024-01-15',
        scheduledTime: '09:00'
      };

      const scheduleData2 = {
        ...scheduleData1,
        scheduledTime: '10:00'
      };

      await request(app)
        .post('/api/schedule/import')
        .send(scheduleData1);

      const response = await request(app)
        .post('/api/schedule/import')
        .send(scheduleData2);

      expect(response.status).toBe(200);
      expect(response.body.summary.success).toBe(1);
      expect(response.body.summary.error).toBe(0);
    });
  });

  describe('状态更新 - 状态越级测试', () => {
    let scheduleId;

    beforeEach(async () => {
      const response = await request(app)
        .post('/api/schedule/import')
        .send({
          patientId: 'P2024001',
          patientName: '张三',
          programCode: 'P001',
          programName: REHAB_PROGRAMS.PELVIC_FLOOR,
          scheduledDate: '2024-01-15',
          scheduledTime: '09:00'
        });
      scheduleId = response.body.results[0].schedule.id;
    });

    it('从待确认直接跳到已完成应该失败（越级）', async () => {
      const response = await request(app)
        .patch(`/api/schedule/${scheduleId}/status`)
        .send({ status: SCHEDULE_STATUS.COMPLETED });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('状态不能越级');
      expect(response.body.suggestion).toBeDefined();
    });

    it('从待确认到已确认应该成功', async () => {
      const response = await request(app)
        .patch(`/api/schedule/${scheduleId}/status`)
        .send({ status: SCHEDULE_STATUS.CONFIRMED });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.schedule.status).toBe(SCHEDULE_STATUS.CONFIRMED);
    });

    it('从已完成回到进行中应该失败（回退）', async () => {
      await request(app)
        .patch(`/api/schedule/${scheduleId}/status`)
        .send({ status: SCHEDULE_STATUS.CONFIRMED });
      await request(app)
        .patch(`/api/schedule/${scheduleId}/status`)
        .send({ status: SCHEDULE_STATUS.IN_PROGRESS });
      await request(app)
        .patch(`/api/schedule/${scheduleId}/status`)
        .send({ status: SCHEDULE_STATUS.COMPLETED });

      const response = await request(app)
        .patch(`/api/schedule/${scheduleId}/status`)
        .send({ status: SCHEDULE_STATUS.IN_PROGRESS });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('状态不能回退');
    });

    it('任何状态都可以取消', async () => {
      const response = await request(app)
        .patch(`/api/schedule/${scheduleId}/status`)
        .send({ status: SCHEDULE_STATUS.CANCELLED });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.schedule.status).toBe(SCHEDULE_STATUS.CANCELLED);
    });
  });

  describe('禁忌项和提醒不一致测试', () => {
    it('存在未解除禁忌项却安排热敷应该标记需人工审核', async () => {
      const response = await request(app)
        .post('/api/schedule/import')
        .send({
          patientId: 'P2024002',
          patientName: '李四',
          programCode: 'H001',
          programName: REHAB_PROGRAMS.HOT_COMPRESS,
          scheduledDate: '2024-01-15',
          scheduledTime: '10:00',
          contraindications: '皮肤破损,急性感染',
          contraindicationsResolved: false
        });

      expect(response.status).toBe(200);
      expect(response.body.summary.warning).toBe(1);
      const result = response.body.results[0];
      expect(result.success).toBe(true);
      expect(result.needsManualReview).toBe(true);
      expect(result.errors.some(e => e.field === 'contraindications')).toBe(true);
      expect(result.errors[0].message).toContain('未解除禁忌项却安排热敷');
      expect(result.errors[0].suggestion).toBeDefined();
      expect(result.originalData).toBeDefined();
    });

    it('已开启提醒但未设置提醒时间应该标记需人工审核', async () => {
      const response = await request(app)
        .post('/api/schedule/import')
        .send({
          patientId: 'P2024003',
          patientName: '王五',
          programCode: 'P001',
          programName: REHAB_PROGRAMS.PELVIC_FLOOR,
          scheduledDate: '2024-01-15',
          scheduledTime: '14:00',
          reminderEnabled: true,
          reminderTime: ''
        });

      expect(response.status).toBe(200);
      expect(response.body.summary.warning).toBe(1);
      const result = response.body.results[0];
      expect(result.needsManualReview).toBe(true);
      expect(result.errors.some(e => e.field === 'reminderTime')).toBe(true);
    });

    it('提醒已关闭但仍设置了提醒时间应该标记需人工审核', async () => {
      const response = await request(app)
        .post('/api/schedule/import')
        .send({
          patientId: 'P2024004',
          patientName: '赵六',
          programCode: 'P001',
          programName: REHAB_PROGRAMS.PELVIC_FLOOR,
          scheduledDate: '2024-01-15',
          scheduledTime: '15:00',
          reminderEnabled: false,
          reminderTime: '2024-01-15T14:30:00'
        });

      expect(response.status).toBe(200);
      expect(response.body.summary.warning).toBe(1);
      const result = response.body.results[0];
      expect(result.needsManualReview).toBe(true);
      expect(result.errors.some(e => e.field === 'reminderEnabled')).toBe(true);
    });
  });

  describe('人工审核接口测试', () => {
    it('没有填写备注应该拒绝审核', async () => {
      const scheduleData = {
        patientId: 'P2024005',
        patientName: '钱七',
        programCode: 'H001',
        programName: REHAB_PROGRAMS.HOT_COMPRESS,
        scheduledDate: '2024-01-15',
        scheduledTime: '11:00',
        contraindications: '皮肤破损',
        contraindicationsResolved: false
      };

      const response = await request(app)
        .post('/api/schedule/review')
        .send({
          scheduleData,
          manualNotes: ''
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('请填写人工审核备注');
    });

    it('填写备注后应该成功导入', async () => {
      const scheduleData = {
        patientId: 'P2024005',
        patientName: '钱七',
        programCode: 'H001',
        programName: REHAB_PROGRAMS.HOT_COMPRESS,
        scheduledDate: '2024-01-15',
        scheduledTime: '11:00',
        contraindications: '皮肤破损',
        contraindicationsResolved: false
      };

      const response = await request(app)
        .post('/api/schedule/review')
        .send({
          scheduleData,
          manualNotes: '经医生确认，皮肤破损已愈合，可以进行热敷'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('已成功导入');
      expect(response.body.schedule.manualNotes).toBe('经医生确认，皮肤破损已愈合，可以进行热敷');
      expect(response.body.schedule.needsManualReview).toBe(false);
    });
  });

  describe('批量导入测试', () => {
    it('混合正常数据、缺字段、重复数据的批量导入应该正确统计', async () => {
      const response = await request(app)
        .post('/api/schedule/import')
        .send({
          data: [
            {
              patientId: 'P2024001',
              patientName: '张三',
              programCode: 'P001',
              programName: REHAB_PROGRAMS.PELVIC_FLOOR,
              scheduledDate: '2024-01-15',
              scheduledTime: '09:00'
            },
            {
              patientId: '',
              patientName: '李四',
              programCode: 'P002',
              programName: REHAB_PROGRAMS.ABDOMINAL_RECOVERY,
              scheduledDate: '2024-01-15',
              scheduledTime: '10:00'
            },
            {
              patientId: 'P2024001',
              patientName: '张三',
              programCode: 'P001',
              programName: REHAB_PROGRAMS.PELVIC_FLOOR,
              scheduledDate: '2024-01-15',
              scheduledTime: '09:00'
            },
            {
              patientId: 'P2024003',
              patientName: '王五',
              programCode: 'H001',
              programName: REHAB_PROGRAMS.HOT_COMPRESS,
              scheduledDate: '2024-01-15',
              scheduledTime: '14:00',
              contraindications: '高热',
              contraindicationsResolved: false
            }
          ]
        });

      expect(response.status).toBe(200);
      expect(response.body.summary.total).toBe(4);
      expect(response.body.summary.success).toBe(2);
      expect(response.body.summary.error).toBe(2);
      expect(response.body.summary.warning).toBe(1);
    });
  });

  describe('导出接口测试', () => {
    it('应该能够导出所有排程数据', async () => {
      await request(app)
        .post('/api/schedule/import')
        .send({
          data: [
            {
              patientId: 'P2024001',
              patientName: '张三',
              programCode: 'P001',
              programName: REHAB_PROGRAMS.PELVIC_FLOOR,
              scheduledDate: '2024-01-15',
              scheduledTime: '09:00'
            },
            {
              patientId: 'P2024002',
              patientName: '李四',
              programCode: 'P002',
              programName: REHAB_PROGRAMS.MASSAGE,
              scheduledDate: '2024-01-15',
              scheduledTime: '10:00'
            }
          ]
        });

      const response = await request(app)
        .get('/api/schedule/export');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.total).toBe(2);
      expect(response.body.data.length).toBe(2);
    });
  });
});
