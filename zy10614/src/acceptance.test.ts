import { candidateService } from './services/candidate.service';
import { importService } from './services/import.service';
import { exportService } from './services/export.service';
import { store } from './store';
import { SourceChannel, MergeAction, CandidateStatus } from './types';

describe('招聘系统后端候选人简历查重合并 - 验收测试', () => {
  beforeEach(() => {
    store.clearAll();
  });

  describe('1. 完整流转测试', () => {
    it('应该完成从创建到审核合并的完整流程', () => {
      console.log('\n=== 完整流转测试 ===\n');

      const result1 = candidateService.createCandidate({
        name: '张三',
        phone: '13800138001',
        email: 'zhangsan@example.com',
        sourceChannel: SourceChannel.HEADHUNTER,
        position: '后端工程师'
      });
      console.log('1. 创建候选人(猎头):', result1.candidate.name, '状态:', result1.candidate.status);
      expect(result1.candidate.status).toBe(CandidateStatus.PENDING_MERGE);

      const listBefore = candidateService.listCandidates({ page: 1, pageSize: 10 });
      console.log('2. 列表查询 - 待合并状态数量:', listBefore.data.filter(c => c.status === CandidateStatus.PENDING_MERGE).length);
      expect(listBefore.data.length).toBe(1);

      const detail = candidateService.getCandidate(result1.candidate.id);
      console.log('3. 详情查询:', detail?.name, detail?.email);
      expect(detail).toBeDefined();

      const updated = candidateService.updateCandidate(result1.candidate.id, {
        position: '高级后端工程师'
      });
      console.log('4. 更新职位:', updated?.position);
      expect(updated?.position).toBe('高级后端工程师');

      const reviewed = candidateService.reviewCandidate({
        candidateId: result1.candidate.id,
        action: MergeAction.KEEP_INDEPENDENT,
        operator: 'HR管理员'
      });
      console.log('5. 审核保留独立:', reviewed?.status);
      expect(reviewed?.status).toBe(CandidateStatus.KEEP_INDEPENDENT);

      const history = candidateService.getMergeHistory(result1.candidate.id);
      console.log('6. 合并历史记录数:', history.length);
      expect(history.length).toBeGreaterThan(0);

      const csv = exportService.exportToCsv();
      const hasData = csv.includes('张三');
      console.log('7. 导出CSV包含数据:', hasData);
      expect(hasData).toBe(true);

      console.log('\n✅ 完整流转测试通过!');
    });
  });

  describe('2. 冲突记录测试 - 猎头和官网同时提交同一候选人', () => {
    it('应该正确检测并处理冲突', () => {
      console.log('\n=== 冲突记录测试 ===\n');

      const result1 = candidateService.createCandidate({
        name: '李四',
        phone: '13900139001',
        email: 'lisi@example.com',
        sourceChannel: SourceChannel.HEADHUNTER,
        position: '产品经理'
      });
      console.log('1. 猎头创建李四:', result1.candidate.name, '状态:', result1.candidate.status);
      expect(result1.candidate.status).toBe(CandidateStatus.PENDING_MERGE);

      const result2 = candidateService.createCandidate({
        name: '李四',
        phone: '13900139001',
        email: 'lisi_official@example.com',
        sourceChannel: SourceChannel.OFFICIAL_WEBSITE,
        position: '高级产品经理'
      });
      console.log('2. 官网创建李四(相同手机号):', result2.candidate.name, '状态:', result2.candidate.status, '冲突数:', result2.conflicts.length);
      expect(result2.candidate.status).toBe(CandidateStatus.CONFLICT_REVIEW);
      expect(result2.conflicts.length).toBe(1);

      const candidate1After = candidateService.getCandidate(result1.candidate.id);
      console.log('3. 猎头李四状态变更为:', candidate1After?.status);
      expect(candidate1After?.status).toBe(CandidateStatus.CONFLICT_REVIEW);

      const conflictList = candidateService.listCandidates({ status: CandidateStatus.CONFLICT_REVIEW });
      console.log('4. 冲突待审列表数量:', conflictList.data.length);
      expect(conflictList.data.length).toBe(2);

      const merged = candidateService.reviewCandidate({
        candidateId: result2.candidate.id,
        action: MergeAction.MERGE,
        operator: 'HR管理员',
        remark: '重复简历，合并到主记录',
        targetCandidateId: result1.candidate.id
      });
      console.log('5. 审核合并官网李四到猎头李四:', merged?.status);
      expect(merged?.status).toBe(CandidateStatus.MERGED);
      expect(merged?.mergedIntoId).toBe(result1.candidate.id);

      const candidate1Final = candidateService.getCandidate(result1.candidate.id);
      console.log('6. 猎头李四最终状态(冲突解决后):', candidate1Final?.status);
      expect(candidate1Final?.status).toBe(CandidateStatus.PENDING_MERGE);

      const allHistory = candidateService.getAllMergeHistories();
      console.log('7. 全部合并历史记录数:', allHistory.length);
      expect(allHistory.length).toBe(1);

      const exportData = exportService.exportToJson();
      const mergedRecord = exportData.find(e => e.姓名 === '李四' && e.状态 === '已合并');
      console.log('8. 导出数据包含已合并记录:', !!mergedRecord);
      expect(mergedRecord).toBeDefined();

      console.log('\n✅ 冲突记录测试通过!');
    });
  });

  describe('3. 导入坏行测试 - 行级错误处理不中断整批', () => {
    it('应该正确处理导入中的坏行，给出详细错误信息', async () => {
      console.log('\n=== 导入坏行测试 ===\n');

      const csvContent = `姓名,手机号,邮箱,来源渠道,应聘职位
王五,13700137001,wangwu@example.com,猎头,前端工程师
赵六,invalid_phone,zhaoliu@example.com,官网,后端工程师
钱七,13600136001,invalid_email,内推,测试工程师
孙八,13500135001,sunba@example.com,未知渠道,运维工程师
周九,13400134001,zhoujiu@example.com,智联,架构师`;

      const buffer = Buffer.from(csvContent, 'utf-8');
      
      console.log('1. 开始导入CSV，包含5条记录，其中3条有错误');
      const result = await importService.importFromCsv('test_import.csv', buffer);
      
      console.log('2. 导入结果 - 成功:', result.successCount, '失败:', result.failedCount);
      expect(result.successCount).toBe(2);
      expect(result.failedCount).toBe(3);

      console.log('\n3. 详细错误信息:');
      result.errors.forEach((err, idx) => {
        console.log(`   ${idx + 1}. 行${err.rowNumber}: ${err.field} - ${err.message}`);
      });
      expect(result.errors.length).toBe(3);

      const phoneError = result.errors.find(e => e.field === '手机号');
      console.log('\n4. 手机号格式错误行:', phoneError?.rowNumber);
      expect(phoneError).toBeDefined();

      const emailError = result.errors.find(e => e.field === '邮箱');
      console.log('5. 邮箱格式错误行:', emailError?.rowNumber);
      expect(emailError).toBeDefined();

      const channelError = result.errors.find(e => e.field === '来源渠道');
      console.log('6. 来源渠道错误行:', channelError?.rowNumber);
      expect(channelError).toBeDefined();

      const importRecord = importService.getImportRecord(result.importId);
      console.log('\n7. 导入记录状态:', importRecord?.status);
      expect(importRecord?.status).toBe('completed');

      const candidates = candidateService.listCandidates({ page: 1, pageSize: 10 });
      console.log('8. 系统中候选人总数:', candidates.data.length);
      expect(candidates.data.length).toBe(2);

      const exportData = exportService.exportToJson();
      console.log('9. 导出数据与列表查询一致:', exportData.length === candidates.data.length);
      expect(exportData.length).toBe(candidates.data.length);

      console.log('\n✅ 导入坏行测试通过!');
    });
  });

  describe('4. 综合验证 - 列表、详情、历史、导出互相对应', () => {
    it('应该保证各接口数据一致性', async () => {
      console.log('\n=== 综合验证测试 ===\n');

      for (let i = 1; i <= 3; i++) {
        candidateService.createCandidate({
          name: `测试用户${i}`,
          phone: `1380013800${i}`,
          email: `user${i}@example.com`,
          sourceChannel: i === 1 ? SourceChannel.HEADHUNTER : SourceChannel.OFFICIAL_WEBSITE,
          position: `职位${i}`
        });
      }

      const list = candidateService.listCandidates({ page: 1, pageSize: 10 });
      console.log('1. 列表查询返回:', list.data.length, '条记录');
      expect(list.data.length).toBe(3);

      const details = await Promise.all(
        list.data.map(c => candidateService.getCandidate(c.id))
      );
      console.log('2. 详情查询全部存在:', details.every(d => d !== undefined));
      expect(details.every(d => d !== undefined)).toBe(true);

      const histories = details.map(d => 
        d ? candidateService.getMergeHistory(d.id) : []
      );
      const totalHistory = histories.reduce((sum, h) => sum + h.length, 0);
      console.log('3. 各候选人合并历史总计:', totalHistory, '条');

      const allHistory = candidateService.getAllMergeHistories();
      console.log('4. 全部合并历史接口返回:', allHistory.length, '条');
      expect(allHistory.length).toBe(totalHistory);

      const exportData = exportService.exportToJson();
      console.log('5. 导出数据数量与列表一致:', exportData.length === list.data.length);
      expect(exportData.length).toBe(list.data.length);

      const listIds = list.data.map(c => c.id).sort();
      const exportIds = exportData.map(e => e['候选人ID']).sort();
      const idsMatch = JSON.stringify(listIds) === JSON.stringify(exportIds);
      console.log('6. 导出ID与列表ID完全匹配:', idsMatch);
      expect(idsMatch).toBe(true);

      const csvContent = exportService.exportToCsv();
      const hasBom = csvContent.startsWith('\uFEFF');
      console.log('7. CSV导出包含BOM头(支持Excel中文):', hasBom);
      expect(hasBom).toBe(true);

      console.log('\n✅ 综合验证测试通过!');
    });
  });
});
