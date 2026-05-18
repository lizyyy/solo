const request = require('supertest');
const app = require('../src/app');
const fs = require('fs');
const path = require('path');

describe('亲子游泳馆水温记录API - 边界测试', () => {
  let testRecordId;
  let testRecordNo = `TEST_${Date.now()}`;

  describe('1. 缺字段验证测试', () => {
    test('缺少必填字段record_no应返回400错误', async () => {
      const response = await request(app)
        .post('/api/records')
        .send({
          pool_name: '测试游泳馆',
          pool_no: 'POOL001',
          pool_type: '亲子池',
          record_date: '2024-01-15',
          time_slot: '上午',
          time_slot_start: '09:00',
          time_slot_end: '12:00',
          standard_temp_min: 31,
          standard_temp_max: 33,
          actual_temp: 32,
          measure_time: '09:30',
          measure_person: '测试员'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    test('缺少必填字段pool_name应返回400错误', async () => {
      const response = await request(app)
        .post('/api/records')
        .send({
          record_no: testRecordNo + '_1',
          pool_no: 'POOL001',
          pool_type: '亲子池',
          record_date: '2024-01-15',
          time_slot: '上午',
          time_slot_start: '09:00',
          time_slot_end: '12:00',
          standard_temp_min: 31,
          standard_temp_max: 33,
          actual_temp: 32,
          measure_time: '09:30',
          measure_person: '测试员',
          is_temp_compliant: 1
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    test('无效的日期格式应返回400错误', async () => {
      const response = await request(app)
        .post('/api/records')
        .send({
          record_no: testRecordNo + '_2',
          pool_name: '测试游泳馆',
          pool_no: 'POOL001',
          pool_type: '亲子池',
          record_date: '2024/01/15',
          time_slot: '上午',
          time_slot_start: '09:00',
          time_slot_end: '12:00',
          standard_temp_min: 31,
          standard_temp_max: 33,
          actual_temp: 32,
          measure_time: '09:30',
          measure_person: '测试员',
          is_temp_compliant: 1
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    test('无效的泳池类型应返回400错误', async () => {
      const response = await request(app)
        .post('/api/records')
        .send({
          record_no: testRecordNo + '_3',
          pool_name: '测试游泳馆',
          pool_no: 'POOL001',
          pool_type: '未知类型',
          record_date: '2024-01-15',
          time_slot: '上午',
          time_slot_start: '09:00',
          time_slot_end: '12:00',
          standard_temp_min: 31,
          standard_temp_max: 33,
          actual_temp: 32,
          measure_time: '09:30',
          measure_person: '测试员',
          is_temp_compliant: 1
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('2. 重复提交测试', () => {
    test('首次提交成功', async () => {
      const response = await request(app)
        .post('/api/records')
        .send({
          record_no: testRecordNo + '_dup',
          pool_name: '测试游泳馆',
          pool_no: 'POOL001',
          pool_type: '亲子池',
          record_date: '2024-01-15',
          time_slot: '上午',
          time_slot_start: '09:00',
          time_slot_end: '12:00',
          standard_temp_min: 31,
          standard_temp_max: 33,
          actual_temp: 32,
          measure_time: '09:30',
          measure_person: '测试员',
          is_temp_compliant: 1
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      testRecordId = response.body.id;
    });

    test('重复提交相同record_no应返回400错误', async () => {
      const response = await request(app)
        .post('/api/records')
        .send({
          record_no: testRecordNo + '_dup',
          pool_name: '测试游泳馆',
          pool_no: 'POOL001',
          pool_type: '亲子池',
          record_date: '2024-01-15',
          time_slot: '上午',
          time_slot_start: '09:00',
          time_slot_end: '12:00',
          standard_temp_min: 31,
          standard_temp_max: 33,
          actual_temp: 32,
          measure_time: '09:30',
          measure_person: '测试员',
          is_temp_compliant: 1
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('记录编号已存在');
    });
  });

  describe('3. 状态越级测试', () => {
    let statusTestRecordId;

    beforeAll(async () => {
      const response = await request(app)
        .post('/api/records')
        .send({
          record_no: testRecordNo + '_status',
          pool_name: '测试游泳馆',
          pool_no: 'POOL001',
          pool_type: '亲子池',
          record_date: '2024-01-15',
          time_slot: '上午',
          time_slot_start: '09:00',
          time_slot_end: '12:00',
          standard_temp_min: 31,
          standard_temp_max: 33,
          actual_temp: 32,
          measure_time: '09:30',
          measure_person: '测试员',
          is_temp_compliant: 1
        });
      statusTestRecordId = response.body.id;
    });

    test('从pending直接跳到completed应返回400错误（越级）', async () => {
      const response = await request(app)
        .put(`/api/records/${statusTestRecordId}/status`)
        .send({
          new_status: 'completed',
          operator: '测试员'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('状态不允许');
    });

    test('从pending跳到confirmed应成功（允许的状态流转）', async () => {
      const response = await request(app)
        .put(`/api/records/${statusTestRecordId}/status`)
        .send({
          new_status: 'confirmed',
          operator: '测试员'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.new_status).toBe('confirmed');
    });

    test('从confirmed跳到compensating应成功', async () => {
      const response = await request(app)
        .put(`/api/records/${statusTestRecordId}/status`)
        .send({
          new_status: 'compensating',
          operator: '测试员'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.new_status).toBe('compensating');
    });

    test('从compensating跳到completed应成功', async () => {
      const response = await request(app)
        .put(`/api/records/${statusTestRecordId}/status`)
        .send({
          new_status: 'completed',
          operator: '测试员'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.new_status).toBe('completed');
    });
  });

  describe('4. 水温不达标人工备注继续推进测试', () => {
    let manualReviewRecordId;

    beforeAll(async () => {
      const response = await request(app)
        .post('/api/records')
        .send({
          record_no: testRecordNo + '_manual',
          pool_name: '测试游泳馆',
          pool_no: 'POOL001',
          pool_type: '亲子池',
          record_date: '2024-01-15',
          time_slot: '上午',
          time_slot_start: '09:00',
          time_slot_end: '12:00',
          standard_temp_min: 31,
          standard_temp_max: 33,
          actual_temp: 30,
          measure_time: '09:30',
          measure_person: '测试员',
          is_temp_compliant: 0,
          is_compensation_consistent: 1,
          affected_periods: '全时段水温偏低2度'
        });
      manualReviewRecordId = response.body.id;
    });

    test('水温不达标且补偿表一致的记录状态应为manual_review', async () => {
      const response = await request(app)
        .get(`/api/records/${manualReviewRecordId}`);

      expect(response.status).toBe(200);
      expect(response.body.data.status).toBe('manual_review');
    });

    test('未填写备注的人工审核应返回400错误', async () => {
      const response = await request(app)
        .post(`/api/records/${manualReviewRecordId}/manual-review`)
        .send({
          operator: '测试员',
          new_status: 'confirmed'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    test('填写备注后人工审核继续推进应成功', async () => {
      const response = await request(app)
        .post(`/api/records/${manualReviewRecordId}/manual-review`)
        .send({
          operator: '测试员',
          manual_remark: '经核实，该时段为设备预热期，不影响正常教学，无需补偿',
          new_status: 'confirmed'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.new_status).toBe('confirmed');
    });

    test('状态日志应记录人工审核操作', async () => {
      const response = await request(app)
        .get(`/api/records/${manualReviewRecordId}/logs`);

      expect(response.status).toBe(200);
      expect(response.body.data.length).toBeGreaterThan(0);
      const manualReviewLog = response.body.data.find(log => log.old_status === 'manual_review');
      expect(manualReviewLog).toBeDefined();
    });
  });

  describe('5. 导出接口统一计算口径测试', () => {
    test('统计汇总接口应返回正确数据', async () => {
      const response = await request(app).get('/api/summary');
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('total');
      expect(response.body.data).toHaveProperty('compliant');
      expect(response.body.data).toHaveProperty('nonCompliant');
      expect(response.body.data).toHaveProperty('byPoolType');
    });

    test('详情接口应包含统一计算的衍生字段', async () => {
      const response = await request(app).get(`/api/records/${testRecordId}`);
      expect(response.status).toBe(200);
      expect(response.body.data).toHaveProperty('temp_status');
      expect(response.body.data).toHaveProperty('temp_diff');
      expect(response.body.data).toHaveProperty('is_temp_in_range');
      expect(response.body.data).toHaveProperty('status_label');
    });
  });

  describe('6. 导入坏记录处理测试', () => {
    test('导入CSV应能识别坏记录并保存原始数据和错误原因', async () => {
      const csvContent = `record_no,pool_name,pool_no,pool_type,record_date,time_slot,time_slot_start,time_slot_end,standard_temp_min,standard_temp_max,actual_temp,measure_time,measure_person,is_temp_compliant
GOOD001,测试游泳馆,POOL001,亲子池,2024-01-15,上午,09:00,12:00,31,33,32,09:30,测试员,1
BAD001,,POOL001,亲子池,2024-01-15,上午,09:00,12:00,31,33,32,09:30,测试员,1
BAD002,测试游泳馆,POOL001,未知类型,2024-01-15,上午,09:00,12:00,31,33,32,09:30,测试员,1`;

      const testCsvPath = path.join(__dirname, 'test_import.csv');
      fs.writeFileSync(testCsvPath, csvContent);

      const response = await request(app)
        .post('/api/import/csv')
        .attach('file', testCsvPath)
        .field('operator', '测试员');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.summary.success).toBe(1);
      expect(response.body.summary.failed).toBe(2);
      expect(response.body.badRecords.length).toBe(2);

      response.body.badRecords.forEach(bad => {
        expect(bad).toHaveProperty('original_data');
        expect(bad).toHaveProperty('errorReason');
        expect(bad).toHaveProperty('suggestion');
      });

      fs.unlinkSync(testCsvPath);
    });
  });

  describe('7. 历史数据迁移测试', () => {
    test('迁移历史数据应成功并保存前后对照', async () => {
      const migrationData = {
        operator: '测试迁移员',
        records: [
          {
            old_system_id: `TEST_OLD_${Date.now()}`,
            pool_name: '迁移测试游泳馆',
            record_date: '2023-11-15',
            water_temp: 30.5,
            status: '待处理',
            remark: '迁移测试记录'
          }
        ]
      };

      const response = await request(app)
        .post('/api/migration/migrate')
        .send(migrationData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.summary.successCount).toBe(1);
      expect(response.body.results[0].status).toBe('success');
    });

    test('迁移前后字段对照应能正确获取', async () => {
      const migrationData = {
        operator: '测试迁移员',
        records: [
          {
            old_system_id: `TEST_COMPARE_${Date.now()}`,
            pool_name: '对照测试游泳馆',
            record_date: '2023-12-01',
            water_temp: 31.0,
            status: '已处理',
            remark: '对照测试记录'
          }
        ]
      };

      await request(app)
        .post('/api/migration/migrate')
        .send(migrationData);

      const response = await request(app)
        .get(`/api/migration/comparison/${migrationData.records[0].old_system_id}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('old_record');
      expect(response.body.data).toHaveProperty('new_record');
      expect(response.body.data).toHaveProperty('field_mapping');
      expect(response.body.data.old_record.pool_name).toBe(migrationData.records[0].pool_name);
    });
  });
});