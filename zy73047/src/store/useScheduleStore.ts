import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  BearingSchedule,
  SensorLog,
  Material,
  ProcessRecord,
  HistoryVersion,
  ScheduleConclusion,
  HandoffStatus,
} from '@/types';
import {
  seedSchedules,
  seedSensorLogs,
  seedMaterials,
  seedProcessRecords,
  seedHistoryVersions,
} from '@/data/seed';
import { logsToCsv, uid } from '@/lib/utils';

interface StoreState {
  schedules: BearingSchedule[];
  sensorLogs: SensorLog[];
  materials: Material[];
  processRecords: ProcessRecord[];
  historyVersions: HistoryVersion[];

  getScheduleById: (id: string) => BearingSchedule | undefined;
  getLogsBySchedule: (scheduleId: string) => SensorLog[];
  getMaterialsBySchedule: (scheduleId: string) => Material[];
  getProcessRecordsBySchedule: (scheduleId: string) => ProcessRecord[];
  getVersionsBySchedule: (scheduleId: string) => HistoryVersion[];
  getHandoffGroups: () => {
    releasable: BearingSchedule[];
    missing: BearingSchedule[];
    pending: BearingSchedule[];
  };

  supplementNote: (
    scheduleId: string,
    payload: { content: string; operator: string }
  ) => void;

  rejudge: (
    scheduleId: string,
    payload: {
      newConclusion: ScheduleConclusion;
      rejudgeReason: string;
      remark?: string;
      operator: string;
      affectedLogIds?: string[];
    }
  ) => void;

  setHandoffStatus: (
    scheduleId: string,
    status: HandoffStatus,
    operator: string
  ) => void;

  exportMarkdownReport: (scheduleId: string) => string;
  exportMaterialPackage: (scheduleId: string) => {
    'sensor_logs.csv': string;
    'process_records.json': string;
    'report.md': string;
  };

  resetToSeed: () => void;
}

export const useScheduleStore = create<StoreState>()(
  persist(
    (set, get) => ({
      schedules: seedSchedules,
      sensorLogs: seedSensorLogs,
      materials: seedMaterials,
      processRecords: seedProcessRecords,
      historyVersions: seedHistoryVersions,

      getScheduleById: (id) => get().schedules.find((s) => s.id === id),

      getLogsBySchedule: (scheduleId) =>
        get()
          .sensorLogs.filter((l) => l.scheduleId === scheduleId)
          .sort((a, b) => +new Date(a.timestamp) - +new Date(b.timestamp)),

      getMaterialsBySchedule: (scheduleId) =>
        get().materials.filter((m) => m.scheduleIds.includes(scheduleId)),

      getProcessRecordsBySchedule: (scheduleId) =>
        get()
          .processRecords.filter((p) => p.scheduleId === scheduleId)
          .sort((a, b) => +new Date(a.timestamp) - +new Date(b.timestamp)),

      getVersionsBySchedule: (scheduleId) =>
        get()
          .historyVersions.filter((v) => v.scheduleId === scheduleId)
          .sort((a, b) => a.versionNo - b.versionNo),

      getHandoffGroups: () => {
        const all = get().schedules;
        return {
          releasable: all.filter((s) => s.handoff === 'releasable'),
          missing: all.filter((s) => s.handoff === 'missing_material'),
          pending: all.filter((s) => s.handoff === 'pending'),
        };
      },

      supplementNote: (scheduleId, { content, operator }) => {
        const now = new Date().toISOString();
        const rec: ProcessRecord = {
          id: uid('pr'),
          scheduleId,
          type: 'supplement',
          operator,
          content,
          timestamp: now,
        };
        set((s) => ({
          processRecords: [...s.processRecords, rec],
          schedules: s.schedules.map((sch) =>
            sch.id === scheduleId
              ? { ...sch, primaryRemark: sch.primaryRemark + '\n[补录] ' + content, updatedAt: now }
              : sch
          ),
        }));
      },

      rejudge: (scheduleId, { newConclusion, rejudgeReason, remark, operator, affectedLogIds }) => {
        const now = new Date().toISOString();
        const state = get();
        const schedule = state.schedules.find((s) => s.id === scheduleId);
        if (!schedule) return;

        const oldConclusion = schedule.conclusion;
        const versionNo = schedule.versionCount + 1;
        const newRemark = remark ?? schedule.primaryRemark;

        const version: HistoryVersion = {
          id: uid('hv'),
          scheduleId,
          versionNo,
          snapshot: {
            conclusion: newConclusion,
            remark: newRemark,
            materialBatchNos: [...schedule.materialBatchNos],
            status:
              newConclusion === 'normal' || newConclusion === 'rejudged_normal'
                ? 'handoff_ready'
                : 'reviewing',
          },
          changeSummary: `改判：${oldConclusion} → ${newConclusion}`,
          operator,
          createdAt: now,
        };

        const rec: ProcessRecord = {
          id: uid('pr'),
          scheduleId,
          type: 'rejudge',
          operator,
          content: `改判：从 ${oldConclusion} 改为 ${newConclusion}`,
          oldConclusion,
          newConclusion,
          rejudgeReason,
          affectedLogIds,
          timestamp: now,
        };

        set((s) => ({
          historyVersions: [...s.historyVersions, version],
          processRecords: [...s.processRecords, rec],
          schedules: s.schedules.map((sch) =>
            sch.id === scheduleId
              ? {
                  ...sch,
                  conclusion: newConclusion,
                  primaryRemark: newRemark,
                  status:
                    newConclusion === 'normal' || newConclusion === 'rejudged_normal'
                      ? 'handoff_ready'
                      : 'reviewing',
                  handoff:
                    sch.materialBatchNos.length > 0 &&
                    (newConclusion === 'normal' || newConclusion === 'rejudged_normal')
                      ? 'releasable'
                      : sch.handoff,
                  versionCount: versionNo,
                  updatedAt: now,
                }
              : sch
          ),
        }));
      },

      setHandoffStatus: (scheduleId, status, operator) => {
        const now = new Date().toISOString();
        set((s) => ({
          schedules: s.schedules.map((sch) =>
            sch.id === scheduleId ? { ...sch, handoff: status, updatedAt: now } : sch
          ),
        }));
      },

      exportMarkdownReport: (scheduleId) => {
        const s = get();
        const sch = s.getScheduleById(scheduleId);
        if (!sch) return '';
        const logs = s.getLogsBySchedule(scheduleId);
        const mats = s.getMaterialsBySchedule(scheduleId);
        const recs = s.getProcessRecordsBySchedule(scheduleId);
        const vs = s.getVersionsBySchedule(scheduleId);

        const fmt = (iso: string) => {
          const d = new Date(iso);
          return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
            d.getDate()
          ).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(
            d.getMinutes()
          ).padStart(2, '0')}`;
        };

        const abnormalCount = logs.filter((l) => l.status === 'anomaly').length;
        const gapCount = logs.filter((l) => l.status === 'gap').length;

        let md = `# 桥梁支座备件排程报告 — ${sch.scheduleNo}\n\n`;
        md += `## 1. 基本信息\n\n`;
        md += `| 字段 | 值 |\n|---|---|\n`;
        md += `| 桥梁名称 | ${sch.bridgeName} |\n`;
        md += `| 支座编号 | ${sch.bearingCode} |\n`;
        md += `| 位置 | ${sch.position} |\n`;
        md += `| 当前结论 | ${sch.conclusion} |\n`;
        md += `| 交接状态 | ${sch.handoff} |\n`;
        md += `| 版本数 | v${sch.versionCount} |\n`;
        md += `| 创建时间 | ${fmt(sch.createdAt)} |\n`;
        md += `| 最近更新 | ${fmt(sch.updatedAt)} |\n\n`;
        md += `**结论备注**：\n\n> ${sch.primaryRemark.split('\n').join('\n> ')}\n\n`;

        md += `## 2. 传感器日志摘要\n\n`;
        md += `- 共 ${logs.length} 条采集记录\n`;
        md += `- 正常：${logs.length - abnormalCount - gapCount} 条\n`;
        md += `- 异常：${abnormalCount} 条（**未被均值掩盖，保留原始值**）\n`;
        md += `- 断档：${gapCount} 条（已附原始说明）\n\n`;
        md += `### 异常与断档明细\n\n`;
        md += `| 时间 | 类型 | 原始值 | 传感器日志原始说法 | 关联材料 |\n|---|---|---|---|---|\n`;
        logs
          .filter((l) => l.status !== 'normal')
          .forEach((l) => {
            md += `| ${fmt(l.timestamp)} | ${l.status === 'gap' ? '断档(' + l.anomalyType + ')' : '异常(' + l.anomalyType + ')'} | ${l.status === 'gap' ? '-' : l.rawValue} | ${l.rawDescription.replace(/\|/g, '\\|')} | ${l.materialBatchNo ?? '-'} |\n`;
          });
        md += `\n`;

        md += `## 3. 追溯材料小包\n\n`;
        if (mats.length === 0) {
          md += `> ⚠️ **缺材料**：当前排程尚未关联材料批次，请补充入库后再放行。\n\n`;
        } else {
          md += `| 批次号 | 名称 | 规格 | 数量 | 入库号 | 供应商 |\n|---|---|---|---|---|---|\n`;
          mats.forEach((m) => {
            md += `| ${m.batchNo} | ${m.name} | ${m.spec} | ${m.qty} | ${m.inboundNo} | ${m.supplier} |\n`;
          });
          md += `\n`;
        }

        md += `## 4. 处理记录与补录\n\n`;
        if (recs.length === 0) {
          md += `_暂无处理记录_\n\n`;
        } else {
          recs.forEach((r, i) => {
            md += `### ${i + 1}. [${r.type}] ${r.operator} — ${fmt(r.timestamp)}\n\n`;
            md += `- 内容：${r.content}\n`;
            if (r.oldConclusion && r.newConclusion) {
              md += `- 结论变更：\`${r.oldConclusion}\` → \`${r.newConclusion}\`\n`;
            }
            if (r.rejudgeReason) {
              md += `- **改判原因**：${r.rejudgeReason}\n`;
            }
            if (r.affectedLogIds && r.affectedLogIds.length) {
              md += `- 涉及日志：${r.affectedLogIds.join(', ')}\n`;
            }
            md += `\n`;
          });
        }

        md += `## 5. 历史版本（改判追溯）\n\n`;
        md += `| 版本 | 时间 | 操作人 | 结论 | 备注摘要 | 变更说明 |\n|---|---|---|---|---|---|\n`;
        vs.forEach((v) => {
          md += `| v${v.versionNo} | ${fmt(v.createdAt)} | ${v.operator} | ${v.snapshot.conclusion} | ${v.snapshot.remark.slice(0, 40)}${v.snapshot.remark.length > 40 ? '…' : ''} | ${v.changeSummary} |\n`;
        });
        md += `\n`;

        md += `---\n\n_报告由桥梁支座备件排程系统自动生成，现场调度小宋可凭此报告连同传感器日志CSV、处理记录JSON一起交接。_\n`;
        return md;
      },

      exportMaterialPackage: (scheduleId) => {
        const s = get();
        const sch = s.getScheduleById(scheduleId);
        const logs = s.getLogsBySchedule(scheduleId);
        const recs = s.getProcessRecordsBySchedule(scheduleId);
        return {
          'sensor_logs.csv': logsToCsv(logs),
          'process_records.json': JSON.stringify(
            { schedule: sch, processRecords: recs },
            null,
            2
          ),
          'report.md': s.exportMarkdownReport(scheduleId),
        };
      },

      resetToSeed: () =>
        set({
          schedules: seedSchedules,
          sensorLogs: seedSensorLogs,
          materials: seedMaterials,
          processRecords: seedProcessRecords,
          historyVersions: seedHistoryVersions,
        }),
    }),
    {
      name: 'bridge-bearing-schedule-store',
    }
  )
);
