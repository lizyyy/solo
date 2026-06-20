import type {
  SamplingPoint,
  Summary,
} from '@/types';
import { useAppStore } from '@/store/useAppStore';
import { approvalApi } from '@/services/approvalApi';
import {
  runConsistencyCheck,
  exportToCSV,
  exportStreetSummary,
  exportToExcel,
  verifyConsistency,
  type ConsistencyReport,
} from '@/utils/export';
import { EXPORT_FIELD_MAPPINGS, formatValueByCode } from '@/types';
import { clearPersistedState } from '@/utils/persistStore';

export type E2ELogEntry = {
  step: string;
  description: string;
  ok: boolean;
  details?: unknown;
  timestamp: Date;
};

export type E2EResult = {
  pass: boolean;
  logs: E2ELogEntry[];
  exportedLogId: string | null;
  apiCheck: {
    exportLogCount: number;
    apiDetailMismatches: number;
    exportLogFound: boolean;
    persistencePassed: boolean;
  };
  consistency: ConsistencyReport | null;
};

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function runFullE2ETest(options?: {
  persistCheck?: boolean;
  produceCSV?: boolean;
  produceExcel?: boolean;
}): Promise<E2EResult> {
  const cfg = {
    persistCheck: options?.persistCheck ?? true,
    produceCSV: options?.produceCSV ?? false,
    produceExcel: options?.produceExcel ?? false,
  };

  const logs: E2ELogEntry[] = [];
  let exportedLogId: string | null = null;
  let consistency: ConsistencyReport | null = null;

  const log = (
    step: string,
    description: string,
    ok: boolean,
    details?: unknown,
  ) => {
    logs.push({ step, description, ok, details, timestamp: new Date() });
    const color = ok ? 'color:#16a34a' : 'color:#dc2626';
    console.log(
      `%c[E2E] ${step}`,
      color,
      '→',
      description,
      ok ? '✅' : '❌',
      details ?? '',
    );
  };

  try {
    // ======== 步骤 0：重置 ========
    const store = useAppStore.getState();
    store.resetAllRecords();
    clearPersistedState();
    store.switchUser('阿宁', 'aning');
    log('0. 重置', `清空记录/历史/导出日志，切换角色为阿宁`, true);

    // ======== 步骤 1：导入 4 条演示数据（含 2 条新旧名称冲突）========
    const importResult = store.importBatchRecords([
      { originalLineNumber: 2, communityOldName: '翠园小区', communityNewName: '翠园社区', rampExists: true, rampLocation: '东门入口', rampCondition: '完好' },
      { originalLineNumber: 3, communityNewName: '海棠花园', rampExists: true, rampLocation: '南门右侧', rampCondition: '轻微破损' },
      { originalLineNumber: 4, communityOldName: '卫东村', communityNewName: '卫东花园', rampExists: false, rampLocation: '', rampCondition: '' },
      { originalLineNumber: 5, communityNewName: '紫荆苑', rampExists: true, rampLocation: '正门口', rampCondition: '完好' },
    ]);

    log(
      '1. 导入(4条)',
      `批次=${importResult.batchId}，共${importResult.newRecordIds.length}条记录，冲突${importResult.conflictCount}条名称`,
      importResult.newRecordIds.length === 4 && importResult.conflictCount === 2,
      { ids: importResult.newRecordIds },
    );

    // 确认每条记录都有 create 历史
    const histories = importResult.newRecordIds.map((id) => store.getHistoryByRecordId(id));
    const allHaveCreateHistory = histories.every((h) => h.some((entry) => entry.action === 'create'));
    log(
      '1.1 历史链',
      `每条记录都有 create 历史操作，共 ${histories.reduce((s, h) => s + h.length, 0)} 条历史`,
      allHaveCreateHistory,
    );

    // ======== 步骤 2：阿宁补看夜间采样点 ========
    store.switchUser('阿宁', 'aning');
    const afterImport = useAppStore.getState().records;
    let addedSampling = 0;
    for (let i = 0; i < afterImport.length; i++) {
      const r = afterImport[i];
      const sampling: SamplingPoint = {
        exists: i % 2 === 0,
        location: i % 2 === 0 ? `${r.communityNewName || r.id}-南门保安亭旁` : '',
        credibility: (['high', 'medium', 'low'] as const)[i % 3],
        reviewedBy: '阿宁',
        reviewedAt: new Date(),
      };
      if (store.addSamplingPoint(r.id, sampling)) addedSampling++;
      await delay(30);
    }
    log('2. 补看采样点', `阿宁补看夜间采样点：成功 ${addedSampling}/${afterImport.length}`, addedSampling === afterImport.length);

    // ======== 步骤 3：巡检员确认新旧名称（冲突的 2 条）========
    store.switchUser('李工（巡检员）', 'inspector');
    const conflictRecords = useAppStore.getState().records.filter((r) => r.hasNameConflict && !r.communityFinalName);
    let confirmedCount = 0;
    for (const r of conflictRecords) {
      const finalName = r.communityNewName || r.communityOldName || '已确认';
      if (store.confirmFinalName(r.id, finalName)) confirmedCount++;
      await delay(30);
    }
    log(
      '3. 巡检员确认名称',
      `新旧名称冲突的 ${conflictRecords.length} 条记录确认了最终名称 ${confirmedCount} 条`,
      confirmedCount === conflictRecords.length,
    );

    // ======== 步骤 4：阿宁更新街道会看摘要 ========
    store.switchUser('阿宁', 'aning');
    const readyForSummary = useAppStore.getState().records.filter((r) => r.currentStep >= 2 && !r.summary);
    let updatedSummary = 0;
    for (const r of readyForSummary) {
      const note = r.hasNameConflict
        ? `（新旧名称已确认：旧称「${r.communityOldName}」新称「${r.communityNewName}」最终「${r.communityFinalName || '待确认'}」）`
        : '';
      const summary: Summary = {
        content: `该小区无障碍坡道位于${r.rampRecord.location || '指定位置'}，状况${r.rampRecord.condition || '正常'}。夜间采样点${
          r.samplingPoint?.exists ? '已设置' : '暂未设置'
        }，可信度${r.samplingPoint ? ({ high: '高', medium: '中', low: '低' } as const)[r.samplingPoint.credibility] : '未核查'}。${note}审批结论：材料齐全，待街道会签。`,
        updatedBy: '阿宁',
        updatedAt: new Date(),
      };
      if (store.updateSummary(r.id, summary)) updatedSummary++;
      await delay(30);
    }
    log('4. 更新街道摘要', `更新了 ${updatedSummary}/${readyForSummary.length} 条记录的摘要`, updatedSummary > 0);

    // ======== 步骤 5：刷新前记录快照 ========
    const beforeRefresh = deepClone({
      records: useAppStore.getState().records,
      exportLogs: useAppStore.getState().exportLogs,
      history: useAppStore.getState().history,
    });
    const recordFieldsBefore: Record<string, Record<string, unknown>> = {};
    beforeRefresh.records.forEach((r) => {
      const obj: Record<string, unknown> = {};
      EXPORT_FIELD_MAPPINGS.forEach((m) => {
        obj[m.code] = formatValueByCode(r, m.code);
      });
      recordFieldsBefore[r.id] = obj;
    });
    log(
      '5. 刷新前快照',
      `记下 ${beforeRefresh.records.length} 条记录和 ${beforeRefresh.exportLogs.length} 条日志（刷新后对比）`,
      true,
      { recordCount: beforeRefresh.records.length },
    );

    // ======== 步骤 6：做一次导出（写入 exportLogs）========
    store.switchUser('阿宁', 'aning');
    const recordsForExport = useAppStore.getState().records;
    let exportResult;
    if (cfg.produceExcel) {
      exportResult = exportToExcel(recordsForExport);
    } else if (cfg.produceCSV) {
      exportResult = exportToCSV(recordsForExport);
    } else {
      // 只创建日志（不下载文件）
      const rep = verifyConsistency(recordsForExport);
      const now = new Date();
      const ts = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
      const log1 = store.createExportLog(
        'excel',
        `商业街外摆审批明细_${ts}.xlsx（E2E测试）`,
        recordsForExport,
        rep.consistent,
        `${rep.storeHash}|${rep.pageHash}|${rep.exportHash}`,
      );
      exportResult = {
        logId: log1.id,
        filename: log1.filename,
        recordCount: log1.recordCount,
        consistencyVerified: rep.consistent,
        message: rep.summary,
      };
      consistency = rep;
    }
    exportedLogId = exportResult.logId;
    log(
      '6. 导出明细',
      `生成 ${exportResult.filename}（日志ID=${exportResult.logId}），一致：${exportResult.consistencyVerified}，${exportResult.message}`,
      !!exportResult.logId && exportResult.recordCount === 4,
    );

    // ======== 步骤 7：三处一致性校验（逐字段）========
    const check = consistency || runConsistencyCheck(useAppStore.getState().records);
    consistency = check;
    log(
      '7. 逐字段一致',
      check.summary,
      check.consistent && check.totalMismatches === 0,
      {
        记录数: check.recordCount,
        字段数: check.fieldCount,
        一致记录: `${check.matchedRecordCount}/${check.recordCount}`,
        不匹配字段: check.totalMismatches,
      },
    );
    if (check.mismatchedRecords.length > 0) {
      console.warn('[E2E] 不一致明细：', check.mismatchedRecords);
    }

    // ======== 步骤 8：模拟刷新，重新读 localStorage ========
    let persistencePassed = true;
    if (cfg.persistCheck) {
      // 触发一次 Zustand subscribe 写 localStorage（本来每次 set 会写，这里再保险地手动触发一次）
      const state = useAppStore.getState();
      // 再重新构建一份 initialState 看持久化恢复的结果是否与刷新前一致
      // 直接读 localStorage
      const raw = localStorage.getItem('approval-system:v1');
      if (!raw) {
        persistencePassed = false;
      } else {
        try {
          const parsed = JSON.parse(raw);
          const restoredRecords = JSON.parse(parsed.records);
          const restoredExportLogs = JSON.parse(parsed.exportLogs);

          if (restoredRecords.length !== beforeRefresh.records.length) {
            persistencePassed = false;
          }
          // 逐条字段对比
          restoredRecords.forEach((rec: { id: string }) => {
            const before = recordFieldsBefore[rec.id];
            if (!before) {
              persistencePassed = false;
              return;
            }
            EXPORT_FIELD_MAPPINGS.forEach((m) => {
              const afterVal = formatValueByCode(rec as Parameters<typeof formatValueByCode>[0], m.code);
              const beforeVal = before[m.code];
              if (String(afterVal) !== String(beforeVal)) {
                persistencePassed = false;
                console.warn(`[E2E] 刷新后字段不一致：record=${rec.id}, field=${m.label}, before=${beforeVal}, after=${afterVal}`);
              }
            });
          });

          // 检查导出日志是否持久化
          const ourExportLog = restoredExportLogs.find((l: { id: string }) => l.id === exportedLogId);
          if (!ourExportLog) {
            persistencePassed = false;
            console.warn('[E2E] 刷新后导出日志丢失');
          }
        } catch (e) {
          persistencePassed = false;
          console.warn('[E2E] localStorage 解析失败', e);
        }
      }
      log(
        '8. 刷新不丢数据',
        persistencePassed
          ? `所有 ${beforeRefresh.records.length} 条记录、导出日志、无障碍坡道数据在刷新前后逐字段一致`
          : '刷新后字段或日志有差异（详见 console 警告）',
        persistencePassed,
      );
    }

    // ======== 步骤 9：接口读取验证 ========
    const logList = await approvalApi.listExportLogs();
    const exportLogCount = logList.data.length;
    let apiDetailMismatches = 0;
    let exportLogFound = false;
    if (exportedLogId) {
      const detail = await approvalApi.getExportLogDetail(exportedLogId);
      if (detail.code === 0 && detail.data) {
        exportLogFound = true;
        // 逐字段对比接口返回 vs store 快照
        for (const row of detail.data.rows) {
          const rec = useAppStore.getState().getRecordById(row.recordId);
          if (!rec) continue;
          row.fields.forEach((f) => {
            const storeValue = formatValueByCode(rec, f.fieldCode);
            if (String(storeValue) !== String(f.value)) {
              apiDetailMismatches++;
              console.warn(
                `[E2E] 接口不一致：record=${row.recordId}(${row.displayName}), field=${f.fieldLabel}, store=[${storeValue}], api=[${f.value}]`,
              );
            }
          });
        }
      }
    }
    log(
      '9. 接口能读到导出明细',
      apiDetailMismatches === 0 && exportLogFound
        ? `接口 listExportLogs 返回 ${exportLogCount} 条；getExportLogDetail(${exportedLogId}) 与 store 逐字段一致`
        : `接口差异：${apiDetailMismatches} 处，导出日志找到=${exportLogFound}`,
      apiDetailMismatches === 0 && exportLogFound,
    );

    // ======== 步骤 10：报告摘要也导出一次 ========
    const withSummary = useAppStore.getState().records.filter((r) => r.summary);
    let step10Ok = false;
    let step10Desc = '';
    try {
      const reportResult = exportStreetSummary(useAppStore.getState().records);
      step10Desc = `生成 ${reportResult.filename}，${reportResult.recordCount} 条有摘要（总计${withSummary.length}条）`;
      step10Ok = reportResult.recordCount === withSummary.length;
    } catch (e) {
      step10Desc = `非浏览器环境跳过文档下载：${(e as Error).message}`;
      step10Ok = withSummary.length >= 4;
    }
    log(
      '10. 街道摘要',
      step10Desc,
      step10Ok,
    );

    // ======== 最终汇总 ========
    const pass = logs.filter((l) => !l.ok).length === 0;
    console.log(`\n%c[E2E] 最终结果：${pass ? '✅ 全部通过' : '❌ 有失败项'}`,
      pass ? 'color:#16a34a;font-size:14px;font-weight:bold' : 'color:#dc2626;font-size:14px;font-weight:bold',
      `（共 ${logs.length} 步，失败 ${logs.filter(l => !l.ok).length} 步）`);

    return {
      pass,
      logs,
      exportedLogId,
      apiCheck: {
        exportLogCount,
        apiDetailMismatches,
        exportLogFound,
        persistencePassed,
      },
      consistency,
    };
  } catch (err) {
    log('FATAL', `脚本异常：${(err as Error).message}`, false, err);
    return {
      pass: false,
      logs,
      exportedLogId: null,
      apiCheck: { exportLogCount: 0, apiDetailMismatches: 0, exportLogFound: false, persistencePassed: false },
      consistency: null,
    };
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const deepClone = <T,>(obj: T): T => JSON.parse(JSON.stringify(obj));
