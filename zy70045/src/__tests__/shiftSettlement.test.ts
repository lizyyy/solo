import { store } from '../storage/inMemoryStore';
import { shiftService } from '../services/shiftService';
import { productionService } from '../services/productionService';
import { downtimeService } from '../services/downtimeService';
import { snapshotService } from '../services/snapshotService';
import { handoverService } from '../services/handoverService';
import { revisionService } from '../services/revisionService';

describe('Shift Settlement Service Tests', () => {
  beforeEach(() => {
    store.reset();
  });

  describe('班次管理测试', () => {
    it('应该能创建新班次', () => {
      const shift = shiftService.startShift({
        lineId: 'line1',
        teamId: 'team1',
        teamName: '早班A组',
      });

      expect(shift.lineId).toBe('line1');
      expect(shift.teamId).toBe('team1');
      expect(shift.status).toBe('active');
      expect(shift.version).toBe(1);
    });

    it('同一产线不能同时有两个进行中的班次', () => {
      shiftService.startShift({
        lineId: 'line1',
        teamId: 'team1',
        teamName: '早班A组',
      });

      expect(() => {
        shiftService.startShift({
          lineId: 'line1',
          teamId: 'team2',
          teamName: '晚班B组',
        });
      }).toThrow('已有进行中的班次');
    });

    it('应该能结束班次', () => {
      const shift = shiftService.startShift({
        lineId: 'line1',
        teamId: 'team1',
        teamName: '早班A组',
      });

      const endedShift = shiftService.endShift(shift.id);

      expect(endedShift.status).toBe('handover');
      expect(endedShift.endTime).toBeDefined();
      expect(endedShift.version).toBe(2);
    });
  });

  describe('产量和废品管理测试', () => {
    it('应该能添加产量记录', () => {
      const shift = shiftService.startShift({
        lineId: 'line1',
        teamId: 'team1',
        teamName: '早班A组',
      });

      const production = productionService.addProduction({
        shiftId: shift.id,
        productId: 'product1',
        productName: '产品A',
        quantity: 100,
        createdBy: 'user1',
      });

      expect(production.shiftId).toBe(shift.id);
      expect(production.quantity).toBe(100);
      expect(production.status).toBe('pending');
    });

    it('产量必须大于0', () => {
      const shift = shiftService.startShift({
        lineId: 'line1',
        teamId: 'team1',
        teamName: '早班A组',
      });

      expect(() => {
        productionService.addProduction({
          shiftId: shift.id,
          productId: 'product1',
          productName: '产品A',
          quantity: 0,
          createdBy: 'user1',
        });
      }).toThrow('产量必须大于0');
    });

    it('应该能确认产量记录', () => {
      const shift = shiftService.startShift({
        lineId: 'line1',
        teamId: 'team1',
        teamName: '早班A组',
      });

      const production = productionService.addProduction({
        shiftId: shift.id,
        productId: 'product1',
        productName: '产品A',
        quantity: 100,
        createdBy: 'user1',
      });

      const confirmed = productionService.confirmProduction(production.id);

      expect(confirmed.status).toBe('confirmed');
      expect(confirmed.version).toBe(2);
    });

    it('应该能添加废品记录', () => {
      const shift = shiftService.startShift({
        lineId: 'line1',
        teamId: 'team1',
        teamName: '早班A组',
      });

      const waste = productionService.addWaste({
        shiftId: shift.id,
        productId: 'product1',
        productName: '产品A',
        quantity: 5,
        reason: '外观缺陷',
        createdBy: 'user1',
      });

      expect(waste.quantity).toBe(5);
      expect(waste.reason).toBe('外观缺陷');
      expect(waste.status).toBe('pending');
    });

    it('废品原因不能为空', () => {
      const shift = shiftService.startShift({
        lineId: 'line1',
        teamId: 'team1',
        teamName: '早班A组',
      });

      expect(() => {
        productionService.addWaste({
          shiftId: shift.id,
          productId: 'product1',
          productName: '产品A',
          quantity: 5,
          reason: '',
          createdBy: 'user1',
        });
      }).toThrow('废品原因不能为空');
    });

    it('应该正确计算班次汇总', () => {
      const shift = shiftService.startShift({
        lineId: 'line1',
        teamId: 'team1',
        teamName: '早班A组',
      });

      const prod1 = productionService.addProduction({
        shiftId: shift.id,
        productId: 'product1',
        productName: '产品A',
        quantity: 100,
        createdBy: 'user1',
      });
      const prod2 = productionService.addProduction({
        shiftId: shift.id,
        productId: 'product1',
        productName: '产品A',
        quantity: 50,
        createdBy: 'user1',
      });
      const waste1 = productionService.addWaste({
        shiftId: shift.id,
        productId: 'product1',
        productName: '产品A',
        quantity: 5,
        reason: '外观缺陷',
        createdBy: 'user1',
      });

      productionService.confirmProduction(prod1.id);
      productionService.confirmProduction(prod2.id);
      productionService.confirmWaste(waste1.id);

      const summary = productionService.calculateShiftSummary(shift.id);

      expect(summary.productionTotal).toBe(150);
      expect(summary.wasteTotal).toBe(5);
      expect(summary.netProduction).toBe(145);
      expect(summary.wasteRate).toBeCloseTo(3.33, 1);
    });
  });

  describe('停机分摊测试', () => {
    it('应该能计算时间重叠', () => {
      const downtimeStart = new Date('2026-05-09T08:00:00');
      const downtimeEnd = new Date('2026-05-09T08:30:00');
      const shiftStart = new Date('2026-05-09T07:00:00');
      const shiftEnd = new Date('2026-05-09T11:00:00');

      const overlap = downtimeService.calculateOverlapMinutes(
        downtimeStart,
        downtimeEnd,
        shiftStart,
        shiftEnd
      );

      expect(overlap).toBe(30);
    });

    it('应该能记录停机', () => {
      const startTime = new Date('2026-05-09T08:00:00');
      const endTime = new Date('2026-05-09T08:30:00');

      const downtime = downtimeService.recordDowntime({
        lineId: 'line1',
        startTime,
        endTime,
        reason: '设备故障',
        createdBy: 'user1',
      });

      expect(downtime.durationMinutes).toBe(30);
      expect(downtime.status).toBe('pending');
    });

    it('应该能分摊停机到多个班次', () => {
      const shift1Start = new Date('2026-05-09T07:00:00');
      const shift1End = new Date('2026-05-09T11:00:00');
      const shift2Start = new Date('2026-05-09T11:00:00');
      const shift2End = new Date('2026-05-09T15:00:00');

      const shift1 = shiftService.startShift({
        lineId: 'line1',
        teamId: 'team1',
        teamName: '早班A组',
        startTime: shift1Start,
      });
      shiftService.endShift(shift1.id, shift1End);

      const shift2 = shiftService.startShift({
        lineId: 'line1',
        teamId: 'team2',
        teamName: '中班B组',
        startTime: shift2Start,
      });
      shiftService.endShift(shift2.id, shift2End);

      const downtimeStart = new Date('2026-05-09T10:30:00');
      const downtimeEnd = new Date('2026-05-09T11:30:00');

      const downtime = downtimeService.recordDowntime({
        lineId: 'line1',
        startTime: downtimeStart,
        endTime: downtimeEnd,
        reason: '设备故障',
        createdBy: 'user1',
      });

      const alloc1 = downtimeService.allocateDowntime(downtime.id, shift1.id);
      const alloc2 = downtimeService.allocateDowntime(downtime.id, shift2.id);

      expect(alloc1.durationMinutes).toBe(30);
      expect(alloc2.durationMinutes).toBe(30);
      expect(alloc1.percentage).toBe(50);
      expect(alloc2.percentage).toBe(50);
    });
  });

  describe('快照和历史一致性测试', () => {
    it('应该能创建班次快照', () => {
      const shift = shiftService.startShift({
        lineId: 'line1',
        teamId: 'team1',
        teamName: '早班A组',
      });

      const prod = productionService.addProduction({
        shiftId: shift.id,
        productId: 'product1',
        productName: '产品A',
        quantity: 100,
        createdBy: 'user1',
      });
      productionService.confirmProduction(prod.id);

      const waste = productionService.addWaste({
        shiftId: shift.id,
        productId: 'product1',
        productName: '产品A',
        quantity: 5,
        reason: '外观缺陷',
        createdBy: 'user1',
      });
      productionService.confirmWaste(waste.id);

      const snapshot = snapshotService.createSnapshot(shift.id);

      expect(snapshot.productionTotal).toBe(100);
      expect(snapshot.wasteTotal).toBe(5);
      expect(snapshot.isConfirmed).toBe(false);
    });

    it('修正后历史快照应保持不变', () => {
      const shift = shiftService.startShift({
        lineId: 'line1',
        teamId: 'team1',
        teamName: '早班A组',
      });

      const prod = productionService.addProduction({
        shiftId: shift.id,
        productId: 'product1',
        productName: '产品A',
        quantity: 100,
        createdBy: 'user1',
      });
      productionService.confirmProduction(prod.id);

      const snapshot1 = snapshotService.createSnapshot(shift.id);

      expect(snapshot1.productionTotal).toBe(100);

      revisionService.reviseProduction(prod.id, {
        revisedBy: 'admin',
        reason: '产量统计错误',
        changes: {
          quantity: 120 },
      });

      const snapshot2 = snapshotService.createSnapshot(shift.id);

      expect(snapshot2.productionTotal).toBe(120);

      const historySnapshots = snapshotService.getSnapshotHistory(shift.id);

      expect(historySnapshots[0].productionTotal).toBe(100);
      expect(historySnapshots[1].productionTotal).toBe(120);

      expect(snapshot1.productionTotal).toBe(100);
    });
  });

  describe('交接确认测试', () => {
    it('应该能正确完成交接确认流程', () => {
      const shift = shiftService.startShift({
        lineId: 'line1',
        teamId: 'team1',
        teamName: '早班A组',
      });

      const prod = productionService.addProduction({
        shiftId: shift.id,
        productId: 'product1',
        productName: '产品A',
        quantity: 100,
        createdBy: 'user1',
      });
      productionService.confirmProduction(prod.id);

      const waste = productionService.addWaste({
        shiftId: shift.id,
        productId: 'product1',
        productName: '产品A',
        quantity: 5,
        reason: '外观缺陷',
        createdBy: 'user1',
      });
      productionService.confirmWaste(waste.id);

      const endedShift = shiftService.endShift(shift.id);

      const confirmedShift = handoverService.confirmHandover(endedShift.id, {
        handoverFrom: '张三',
        handoverTo: '李四',
      });

      expect(confirmedShift.status).toBe('confirmed');
      expect(confirmedShift.version).toBe(3);

      const latestSnapshot = snapshotService.getLatestSnapshot(shift.id);
      expect(latestSnapshot).toBeDefined();
      expect(latestSnapshot!.handoverFrom).toBe('张三');
      expect(latestSnapshot!.handoverTo).toBe('李四');
      expect(latestSnapshot!.isConfirmed).toBe(true);
    });

    it('有待确认记录时不能交接', () => {
      const shift = shiftService.startShift({
        lineId: 'line1',
        teamId: 'team1',
        teamName: '早班A组',
      });

      productionService.addProduction({
        shiftId: shift.id,
        productId: 'product1',
        productName: '产品A',
        quantity: 100,
        createdBy: 'user1',
      });

      const endedShift = shiftService.endShift(shift.id);

      expect(() => {
        handoverService.confirmHandover(endedShift.id, {
          handoverFrom: '张三',
          handoverTo: '李四',
        });
      }).toThrow('待确认的产量记录');
    });
  });

  describe('修正记录测试', () => {
    it('应该能修正产量并记录历史', () => {
      const shift = shiftService.startShift({
        lineId: 'line1',
        teamId: 'team1',
        teamName: '早班A组',
      });

      const prod = productionService.addProduction({
        shiftId: shift.id,
        productId: 'product1',
        productName: '产品A',
        quantity: 100,
        createdBy: 'user1',
      });

      const revised = revisionService.reviseProduction(prod.id, {
        revisedBy: 'admin',
        reason: '统计错误，应为120',
        changes: {
          quantity: 120 },
      });

      expect(revised.quantity).toBe(120);
      expect(revised.status).toBe('revised');
      expect(revised.version).toBe(2);

      const history = revisionService.getRevisionHistory(prod.id, 'production');

      expect(history.length).toBe(1);
      expect(history[0].changes.quantity?.from).toBe(100);
      expect(history[0].changes.quantity?.to).toBe(120);
      expect(history[0].reason).toBe('统计错误，应为120');
    });

    it('应该能将产量重新分配到其他班次', () => {
      const shift1 = shiftService.startShift({
        lineId: 'line1',
        teamId: 'team1',
        teamName: '早班A组',
      });
      shiftService.endShift(shift1.id);

      const shift2 = shiftService.startShift({
        lineId: 'line2',
        teamId: 'team2',
        teamName: '中班B组',
      });

      const prod = productionService.addProduction({
        shiftId: shift1.id,
        productId: 'product1',
        productName: '产品A',
        quantity: 100,
        createdBy: 'user1',
      });

      const shift1Productions = productionService.getShiftProductions(shift1.id);
      expect(shift1Productions.total).toBe(100);

      const revised = revisionService.reviseProduction(prod.id, {
        revisedBy: 'admin',
        reason: '归错班组了，应归中班',
        changes: {
          shiftId: shift2.id },
      });

      expect(revised.shiftId).toBe(shift2.id);

      const shift1ProductionsAfter = productionService.getShiftProductions(shift1.id);
      const shift2ProductionsAfter = productionService.getShiftProductions(shift2.id);

      expect(shift1ProductionsAfter.total).toBe(0);
      expect(shift2ProductionsAfter.total).toBe(100);
    });
  });

  describe('日报导出测试', () => {
    it('应该能生成日报', () => {
      const shift1Start = new Date('2026-05-09T07:00:00');
      const shift1End = new Date('2026-05-09T11:00:00');
      const shift2Start = new Date('2026-05-09T11:00:00');
      const shift2End = new Date('2026-05-09T15:00:00');

      const shift1 = shiftService.startShift({
        lineId: 'line1',
        teamId: 'team1',
        teamName: '早班A组',
        startTime: shift1Start,
      });
      const prod1 = productionService.addProduction({
        shiftId: shift1.id,
        productId: 'product1',
        productName: '产品A',
        quantity: 100,
        createdBy: 'user1',
      });
      productionService.confirmProduction(prod1.id);
      shiftService.endShift(shift1.id, shift1End);

      const shift2 = shiftService.startShift({
        lineId: 'line1',
        teamId: 'team2',
        teamName: '中班B组',
        startTime: shift2Start,
      });
      const prod2 = productionService.addProduction({
        shiftId: shift2.id,
        productId: 'product1',
        productName: '产品A',
        quantity: 150,
        createdBy: 'user2',
      });
      productionService.confirmProduction(prod2.id);
      shiftService.endShift(shift2.id, shift2End);

      const report = handoverService.generateDailyReport('2026-05-09', 'line1');

      expect(report.shifts.length).toBe(2);
      expect(report.dailyTotal.production).toBe(250);
    });

    it('应该能导出CSV格式', () => {
      const shiftStart = new Date('2026-05-09T07:00:00');
      const shiftEnd = new Date('2026-05-09T11:00:00');

      const shift = shiftService.startShift({
        lineId: 'line1',
        teamId: 'team1',
        teamName: '早班A组',
        startTime: shiftStart,
      });
      const prod = productionService.addProduction({
        shiftId: shift.id,
        productId: 'product1',
        productName: '产品A',
        quantity: 100,
        createdBy: 'user1',
      });
      productionService.confirmProduction(prod.id);
      shiftService.endShift(shift.id, shiftEnd);
      handoverService.confirmHandover(shift.id, {
        handoverFrom: '张三',
        handoverTo: '李四',
      });

      const csv = handoverService.exportDailyReportAsCSV('2026-05-09', 'line1');

      expect(csv).toContain('日期');
      expect(csv).toContain('总产量');
      expect(csv).toContain('100');
      expect(csv).toContain('早班A组');
    });
  });

  describe('历史查询一致性测试', () => {
    it('按版本查询应返回历史快照数据', () => {
      const shift = shiftService.startShift({
        lineId: 'line1',
        teamId: 'team1',
        teamName: '早班A组',
      });

      const prod = productionService.addProduction({
        shiftId: shift.id,
        productId: 'product1',
        productName: '产品A',
        quantity: 100,
        createdBy: 'user1',
      });
      productionService.confirmProduction(prod.id);

      const snapshot1 = snapshotService.createSnapshot(shift.id);

      revisionService.reviseProduction(prod.id, {
        revisedBy: 'admin',
        reason: '统计错误',
        changes: {
          quantity: 150 },
      });

      const snapshot2 = snapshotService.createSnapshot(shift.id);

      const version1 = snapshotService.getSnapshot(shift.id, 1);
      const version2 = snapshotService.getSnapshot(shift.id, 2);

      expect(version1!.productionTotal).toBe(100);
      expect(version2!.productionTotal).toBe(150);

      expect(snapshot1.id).not.toBe(snapshot2.id);
      expect(snapshot1.snapshotTime.getTime()).toBeLessThanOrEqual(snapshot2.snapshotTime.getTime());
    });

    it('修正后的日报和历史日报数据应保持一致', () => {
      const shiftStart = new Date('2026-05-09T07:00:00');
      const shiftEnd = new Date('2026-05-09T11:00:00');

      const shift = shiftService.startShift({
        lineId: 'line1',
        teamId: 'team1',
        teamName: '早班A组',
        startTime: shiftStart,
      });

      const prod = productionService.addProduction({
        shiftId: shift.id,
        productId: 'product1',
        productName: '产品A',
        quantity: 100,
        createdBy: 'user1',
      });
      productionService.confirmProduction(prod.id);

      const waste = productionService.addWaste({
        shiftId: shift.id,
        productId: 'product1',
        productName: '产品A',
        quantity: 5,
        reason: '外观缺陷',
        createdBy: 'user1',
      });
      productionService.confirmWaste(waste.id);

      shiftService.endShift(shift.id, shiftEnd);
      handoverService.confirmHandover(shift.id, {
        handoverFrom: '张三',
        handoverTo: '李四',
      });

      const snapshotsBeforeRevision = snapshotService.getSnapshotHistory(shift.id);
      const report1 = handoverService.generateDailyReport('2026-05-09', 'line1');
      expect(report1.dailyTotal.production).toBe(100);
      expect(report1.dailyTotal.netProduction).toBe(95);

      revisionService.reviseProduction(prod.id, {
        revisedBy: 'admin',
        reason: '统计错误',
        changes: {
          quantity: 120 },
      });

      snapshotService.createSnapshot(shift.id);

      const report2 = handoverService.generateDailyReport('2026-05-09', 'line1');

      expect(report2.dailyTotal.production).toBe(120);
      expect(report2.dailyTotal.netProduction).toBe(115);

      const snapshots = snapshotService.getSnapshotHistory(shift.id);

      expect(snapshots.length).toBeGreaterThan(snapshotsBeforeRevision.length);
      expect(snapshotsBeforeRevision[0].productionTotal).toBe(100);
      expect(snapshots[snapshots.length - 1].productionTotal).toBe(120);
    });
  });

  describe('状态显示测试', () => {
    it('应该能显示班次状态', () => {
      const shift = shiftService.startShift({
        lineId: 'line1',
        teamId: 'team1',
        teamName: '早班A组',
      });

      const status1 = shiftService.getShiftStatus(shift.id);
      expect(status1.status).toBe('active');
      expect(status1.isRevised).toBe(false);

      shiftService.endShift(shift.id);
      const status2 = shiftService.getShiftStatus(shift.id);
      expect(status2.status).toBe('handover');

      handoverService.reviseShift(shift.id, {
        revisedBy: 'admin',
        reason: '测试修正',
        changes: {
          teamName: '早班A组(修正)' },
      });

      const status3 = shiftService.getShiftStatus(shift.id);
      expect(status3.status).toBe('revised');
      expect(status3.isRevised).toBe(true);
      expect(status3.lastRevisedAt).toBeDefined();
    });
  });

  describe('用户场景回归测试', () => {
    it('修正产量后日报应反映最新数据（用户场景：100+50修正为100+80=180）', () => {
      const shiftStart = new Date('2026-05-09T08:00:00');
      const shiftEnd = new Date('2026-05-09T16:00:00');

      const shift = shiftService.startShift({
        lineId: 'line1',
        teamId: 'team1',
        teamName: '早班A组',
        startTime: shiftStart,
      });

      const prod1 = productionService.addProduction({
        shiftId: shift.id,
        productId: 'product1',
        productName: '产品A',
        quantity: 100,
        createdBy: 'user1',
        timestamp: new Date('2026-05-09T10:00:00'),
      });
      productionService.confirmProduction(prod1.id);

      const prod2 = productionService.addProduction({
        shiftId: shift.id,
        productId: 'product1',
        productName: '产品A',
        quantity: 50,
        createdBy: 'user1',
        timestamp: new Date('2026-05-09T14:00:00'),
      });
      productionService.confirmProduction(prod2.id);

      const waste = productionService.addWaste({
        shiftId: shift.id,
        productId: 'product1',
        productName: '产品A',
        quantity: 10,
        reason: '外观缺陷',
        createdBy: 'user1',
      });
      productionService.confirmWaste(waste.id);

      shiftService.endShift(shift.id, shiftEnd);

      const reportBeforeRevision = handoverService.generateDailyReport('2026-05-09', 'line1');
      expect(reportBeforeRevision.dailyTotal.production).toBe(150);
      expect(reportBeforeRevision.dailyTotal.netProduction).toBe(140);

      handoverService.confirmHandover(shift.id, {
        handoverFrom: '张三',
        handoverTo: '李四',
      });

      const reportAfterHandover = handoverService.generateDailyReport('2026-05-09', 'line1');
      expect(reportAfterHandover.dailyTotal.production).toBe(150);

      revisionService.reviseProduction(prod2.id, {
        revisedBy: 'admin',
        reason: '发现少统计了30件，应为80件',
        changes: {
          quantity: 80 },
      });

      const reportAfterRevision = handoverService.generateDailyReport('2026-05-09', 'line1');
      expect(reportAfterRevision.dailyTotal.production).toBe(180);
      expect(reportAfterRevision.dailyTotal.netProduction).toBe(170);

      const snapshots = snapshotService.getSnapshotHistory(shift.id);
      expect(snapshots.length).toBeGreaterThanOrEqual(1);
      expect(snapshots[snapshots.length - 1].productionTotal).toBe(150);

      const revisions = revisionService.getRevisionHistory(prod2.id, 'production');
      expect(revisions.length).toBe(1);
      expect(revisions[0].changes.quantity?.from).toBe(50);
      expect(revisions[0].changes.quantity?.to).toBe(80);
    });
  });
});
