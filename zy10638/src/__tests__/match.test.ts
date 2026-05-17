import request from 'supertest';
import app from '../app';
import matchService from '../services/matchService';
import { MatchStatus } from '../types';

describe('停车计费后端无牌车人工匹配 API', () => {
  describe('1. 完整流转测试', () => {
    it('应完成从创建到已结算的完整状态流转', async () => {
      const entryId = await matchService.createEntry({
        entryTime: new Date('2024-01-15T08:30:00'),
        photoUrl: '/photos/car_001.jpg',
        parkingSpot: 'A-001',
        plateNumber: ''
      });

      const paymentId = await matchService.createPayment({
        paymentTime: new Date('2024-01-15T10:45:00'),
        amount: 25.00,
        paymentMethod: '微信支付',
        transactionId: 'TXN_20240115_001'
      });

      const createRes = await request(app)
        .post('/api/matches')
        .send({
          entryId,
          paymentId,
          manualNote: '无牌车入场，需人工确认',
          matchedBy: '操作员A'
        });

      expect(createRes.status).toBe(201);
      const matchId = createRes.body.id;

      const detailRes1 = await request(app).get(`/api/matches/${matchId}`);
      expect(detailRes1.status).toBe(200);
      expect(detailRes1.body.status).toBe(MatchStatus.PENDING);

      await request(app)
        .put(`/api/matches/${matchId}/status`)
        .send({
          status: MatchStatus.MATCHED,
          changedBy: '审核员B',
          changeNote: '照片与支付记录匹配无误'
        });

      const detailRes2 = await request(app).get(`/api/matches/${matchId}`);
      expect(detailRes2.body.status).toBe(MatchStatus.MATCHED);

      await request(app)
        .post(`/api/matches/${matchId}/note`)
        .send({
          note: '财务已确认到账',
          changedBy: '财务C'
        });

      await request(app)
        .put(`/api/matches/${matchId}/status`)
        .send({
          status: MatchStatus.SETTLED,
          changedBy: '管理员D',
          changeNote: '已完成结算'
        });

      const detailRes3 = await request(app).get(`/api/matches/${matchId}`);
      expect(detailRes3.status).toBe(200);
      expect(detailRes3.body.status).toBe(MatchStatus.SETTLED);
      expect(detailRes3.body.manualNote).toContain('财务已确认到账');

      const historyRes = await request(app).get(`/api/matches/${matchId}/history`);
      expect(historyRes.status).toBe(200);
      expect(historyRes.body.length).toBeGreaterThanOrEqual(3);

      const listRes = await request(app).get('/api/matches?status=settled');
      expect(listRes.status).toBe(200);
      expect(listRes.body.list.length).toBe(1);
      expect(listRes.body.list[0].id).toBe(matchId);

      const exportRes = await request(app).get('/api/matches/export/data');
      expect(exportRes.status).toBe(200);
      const exported = exportRes.body.find((r: any) => r.匹配ID === matchId);
      expect(exported).toBeDefined();
      expect(exported.状态).toBe(MatchStatus.SETTLED);
      expect(exported.交易单号).toBe('TXN_20240115_001');
    });
  });

  describe('2. 冲突记录测试', () => {
    it('同一支付单匹配两次入场应在详情和导出中体现', async () => {
      const paymentId = await matchService.createPayment({
        paymentTime: new Date('2024-01-16T12:00:00'),
        amount: 15.00,
        paymentMethod: '支付宝',
        transactionId: 'TXN_20240116_CONFLICT'
      });

      const entryId1 = await matchService.createEntry({
        entryTime: new Date('2024-01-16T09:00:00'),
        photoUrl: '/photos/car_conflict_1.jpg',
        parkingSpot: 'B-001'
      });

      const entryId2 = await matchService.createEntry({
        entryTime: new Date('2024-01-16T09:30:00'),
        photoUrl: '/photos/car_conflict_2.jpg',
        parkingSpot: 'B-002'
      });

      const match1Res = await request(app)
        .post('/api/matches')
        .send({
          entryId: entryId1,
          paymentId,
          manualNote: '第一次匹配',
          matchedBy: '操作员A'
        });
      const matchId1 = match1Res.body.id;

      const match2Res = await request(app)
        .post('/api/matches')
        .send({
          entryId: entryId2,
          paymentId,
          manualNote: '第二次匹配，可能存在冲突',
          matchedBy: '操作员B'
        });
      const matchId2 = match2Res.body.id;

      await request(app)
        .put(`/api/matches/${matchId2}/status`)
        .send({
          status: MatchStatus.DISPUTED,
          changedBy: '审核员',
          changeNote: '发现同一支付单匹配了两次入场，需核查'
        });

      const detailRes1 = await request(app).get(`/api/matches/${matchId1}`);
      expect(detailRes1.status).toBe(200);
      expect(detailRes1.body.otherMatchesForPayment.length).toBe(1);
      expect(detailRes1.body.otherMatchesForPayment[0].id).toBe(matchId2);

      const detailRes2 = await request(app).get(`/api/matches/${matchId2}`);
      expect(detailRes2.status).toBe(200);
      expect(detailRes2.body.status).toBe(MatchStatus.DISPUTED);
      expect(detailRes2.body.otherMatchesForPayment.length).toBe(1);

      const exportRes = await request(app).get('/api/matches/export/data');
      expect(exportRes.status).toBe(200);
      
      const exported1 = exportRes.body.find((r: any) => r.匹配ID === matchId1);
      const exported2 = exportRes.body.find((r: any) => r.匹配ID === matchId2);
      
      expect(exported1).toBeDefined();
      expect(exported2).toBeDefined();
      expect(exported1.重复匹配).toContain(matchId2);
      expect(exported2.重复匹配).toContain(matchId1);

      const listRes = await request(app).get('/api/matches?status=disputed');
      expect(listRes.body.list.length).toBe(1);
      expect(listRes.body.list[0].id).toBe(matchId2);
    });
  });

  describe('3. 导入坏行测试', () => {
    it('批量导入时应正确区分成功记录和失败记录', async () => {
      const importData = [
        {
          entryTime: '2024-01-17T08:00:00',
          photoUrl: '/photos/valid_1.jpg',
          parkingSpot: 'C-001',
          plateNumber: '京A12345',
          paymentTime: '2024-01-17T10:00:00',
          amount: 20.00,
          paymentMethod: '微信支付',
          transactionId: 'TXN_IMPORT_001',
          manualNote: '正常记录1'
        },
        {
          entryTime: '',
          photoUrl: '/photos/bad_1.jpg',
          parkingSpot: 'C-002',
          paymentTime: '2024-01-17T10:30:00',
          amount: 15.00,
          paymentMethod: '支付宝',
          transactionId: 'TXN_IMPORT_BAD_1'
        },
        {
          entryTime: '2024-01-17T09:00:00',
          photoUrl: '/photos/valid_2.jpg',
          parkingSpot: 'C-003',
          paymentTime: '2024-01-17T11:00:00',
          amount: 18.00,
          paymentMethod: '微信支付',
          transactionId: 'TXN_IMPORT_002',
          manualNote: '正常记录2'
        },
        {
          entryTime: '2024-01-17T09:30:00',
          photoUrl: '/photos/bad_2.jpg',
          parkingSpot: 'C-004',
          paymentTime: '',
          amount: 25.00,
          paymentMethod: '支付宝',
          transactionId: ''
        },
        {
          entryTime: '2024-01-17T10:00:00',
          photoUrl: '/photos/valid_3.jpg',
          parkingSpot: 'C-005',
          plateNumber: '京B67890',
          paymentTime: '2024-01-17T12:00:00',
          amount: 30.00,
          paymentMethod: '现金',
          transactionId: 'TXN_IMPORT_003'
        }
      ];

      const importRes = await request(app)
        .post('/api/matches/import')
        .send(importData);

      expect(importRes.status).toBe(200);
      expect(importRes.body.success).toBe(3);
      expect(importRes.body.failed).toBe(2);
      expect(importRes.body.errors.length).toBe(2);

      const errorRows = importRes.body.errors.map((e: any) => e.row);
      expect(errorRows).toContain(2);
      expect(errorRows).toContain(4);

      const error1 = importRes.body.errors.find((e: any) => e.row === 2);
      expect(error1.message).toContain('缺少入场必填字段');

      const error2 = importRes.body.errors.find((e: any) => e.row === 4);
      expect(error2.message).toContain('缺少支付必填字段');

      const listRes = await request(app).get('/api/matches?pageSize=10');
      expect(listRes.body.total).toBe(3);

      const transactions = listRes.body.list.map((m: any) => m.payment.transactionId);
      expect(transactions).toContain('TXN_IMPORT_001');
      expect(transactions).toContain('TXN_IMPORT_002');
      expect(transactions).toContain('TXN_IMPORT_003');

      const exportRes = await request(app).get('/api/matches/export/data');
      expect(exportRes.body.length).toBe(3);
    });
  });

  describe('4. API 边界测试', () => {
    it('查询不存在的匹配记录应返回404', async () => {
      const res = await request(app).get('/api/matches/non-existent-id');
      expect(res.status).toBe(404);
    });

    it('更新不存在的匹配记录状态应返回400', async () => {
      const res = await request(app)
        .put('/api/matches/non-existent-id/status')
        .send({ status: MatchStatus.MATCHED });
      expect(res.status).toBe(400);
    });

    it('创建匹配时使用无效的entryId应返回400', async () => {
      const res = await request(app)
        .post('/api/matches')
        .send({
          entryId: 'invalid-id',
          paymentId: 'invalid-payment-id'
        });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Entry record not found');
    });

    it('使用无效的状态值应返回400', async () => {
      const entryId = await matchService.createEntry({
        entryTime: new Date(),
        photoUrl: '/photos/test.jpg',
        parkingSpot: 'D-001'
      });
      const paymentId = await matchService.createPayment({
        paymentTime: new Date(),
        amount: 10,
        paymentMethod: '测试',
        transactionId: 'TXN_INVALID_STATUS'
      });
      const matchId = await matchService.createMatch({ entryId, paymentId });

      const res = await request(app)
        .put(`/api/matches/${matchId}/status`)
        .send({ status: 'invalid-status' });
      expect(res.status).toBe(400);
    });
  });
});
