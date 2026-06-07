import { create } from 'zustand';
import type {
  Project,
  Point,
  ReviewNote,
  JudgmentTrace,
  AnomalyStats,
  ImportRecord,
  HandoverRecord,
} from '../types';

interface ProjectState {
  projects: Project[];
  currentProject: Project | null;
  selectedPointId: string | null;
  isLoading: boolean;
  lastImportResult: { success: boolean; error?: string; filename?: string } | null;

  loadProjects: () => void;
  saveProjects: () => void;
  setCurrentProject: (project: Project | null) => void;
  addProject: (project: Project) => void;
  updateProject: (project: Project) => void;
  deleteProject: (projectId: string) => void;
  selectPoint: (pointId: string | null) => void;
  addReviewNote: (note: Omit<ReviewNote, 'id' | 'createdAt'>) => void;
  addJudgmentTrace: (trace: Omit<JudgmentTrace, 'id' | 'timestamp'>) => void;
  addImportRecord: (record: Omit<ImportRecord, 'id' | 'importedAt'>) => void;
  addHandoverRecord: (record: Omit<HandoverRecord, 'id' | 'handedOverAt'>) => void;
  importProject: (
    data: unknown,
    filename: string
  ) => { success: boolean; error?: string };
  getAnomalyStats: () => AnomalyStats | null;
  generateHandoverReport: () => string;
  clearLastImportResult: () => void;
}

const generateId = () => Math.random().toString(36).substring(2, 11);

const STORAGE_KEY = 'flood-drill-projects';

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  currentProject: null,
  selectedPointId: null,
  isLoading: false,
  lastImportResult: null,

  loadProjects: () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const projects = JSON.parse(stored) as Project[];
        set({ projects });
      }
    } catch (error) {
      console.error('Failed to load projects:', error);
    }
  },

  saveProjects: () => {
    const { projects } = get();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
  },

  setCurrentProject: (project) => {
    set({ currentProject: project, selectedPointId: null });
  },

  addProject: (project) => {
    set((state) => ({
      projects: [...state.projects, project],
    }));
    get().saveProjects();
  },

  updateProject: (updatedProject) => {
    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === updatedProject.id ? updatedProject : p
      ),
      currentProject:
        state.currentProject?.id === updatedProject.id
          ? updatedProject
          : state.currentProject,
    }));
    get().saveProjects();
  },

  deleteProject: (projectId) => {
    set((state) => ({
      projects: state.projects.filter((p) => p.id !== projectId),
      currentProject:
        state.currentProject?.id === projectId ? null : state.currentProject,
    }));
    get().saveProjects();
  },

  selectPoint: (pointId) => {
    set({ selectedPointId: pointId });
  },

  addReviewNote: (note) => {
    const { currentProject } = get();
    if (!currentProject) return;

    const newNote: ReviewNote = {
      ...note,
      id: generateId(),
      createdAt: new Date().toISOString(),
    };

    const updatedProject: Project = {
      ...currentProject,
      reviewNotes: [...currentProject.reviewNotes, newNote],
      updatedAt: new Date().toISOString(),
    };

    get().updateProject(updatedProject);
  },

  addJudgmentTrace: (trace) => {
    const { currentProject } = get();
    if (!currentProject) return;

    const newTrace: JudgmentTrace = {
      ...trace,
      id: generateId(),
      timestamp: new Date().toISOString(),
    };

    const updatedProject: Project = {
      ...currentProject,
      judgmentTraces: [...currentProject.judgmentTraces, newTrace],
      updatedAt: new Date().toISOString(),
    };

    get().updateProject(updatedProject);
  },

  addImportRecord: (record) => {
    const { currentProject } = get();
    if (!currentProject) return;

    const newRecord: ImportRecord = {
      ...record,
      id: generateId(),
      importedAt: new Date().toISOString(),
    };

    const updatedProject: Project = {
      ...currentProject,
      importRecords: [...(currentProject.importRecords || []), newRecord],
      updatedAt: new Date().toISOString(),
    };

    get().updateProject(updatedProject);
  },

  addHandoverRecord: (record) => {
    const { currentProject } = get();
    if (!currentProject) return;

    const newRecord: HandoverRecord = {
      ...record,
      id: generateId(),
      handedOverAt: new Date().toISOString(),
    };

    const updatedProject: Project = {
      ...currentProject,
      handoverRecords: [...(currentProject.handoverRecords || []), newRecord],
      updatedAt: new Date().toISOString(),
    };

    get().updateProject(updatedProject);
  },

  importProject: (data, filename) => {
    try {
      const project = data as Project;

      if (!project.name || !Array.isArray(project.points)) {
        const error = '数据格式错误：缺少必要字段';
        set({ lastImportResult: { success: false, error, filename } });
        return { success: false, error };
      }

      const errors: string[] = [];

      project.points.forEach((point: Point, index: number) => {
        if (!point.id) {
          errors.push(`点位 ${index + 1} (${point.name || '未命名'}): 缺少ID`);
        }
        if (!point.position) {
          errors.push(
            `点位 ${point.name || point.id || index + 1}: 缺少坐标数据`
          );
        }
        if (point.hasPhoto && !point.photoUrl) {
          errors.push(
            `点位 ${point.name || point.id || index + 1}: 标记有照片但实际数据缺失`
          );
        }
      });

      if (errors.length > 0) {
        const error = errors.join('\n');
        set({ lastImportResult: { success: false, error, filename } });
        return { success: false, error };
      }

      const newProject: Project = {
        ...project,
        id: generateId(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        importRecords: project.importRecords || [],
        handoverRecords: project.handoverRecords || [],
      };

      const importRecord: ImportRecord = {
        id: generateId(),
        filename,
        importedAt: new Date().toISOString(),
        operator: '当前用户',
        success: true,
        sourceOrigin: project.source || '未知来源',
      };

      newProject.importRecords.push(importRecord);

      const importTrace: JudgmentTrace = {
        id: generateId(),
        action: 'import_success',
        operator: '当前用户',
        timestamp: new Date().toISOString(),
        remark: `文件「${filename}」导入成功，共 ${project.points.length} 个点位`,
      };

      if (!newProject.judgmentTraces) {
        newProject.judgmentTraces = [];
      }
      newProject.judgmentTraces.push(importTrace);

      get().addProject(newProject);
      set({ lastImportResult: { success: true, filename } });
      return { success: true };
    } catch (error) {
      const errorMsg = '导入失败：JSON格式无效，请检查文件内容';
      set({ lastImportResult: { success: false, error: errorMsg, filename } });
      return { success: false, error: errorMsg };
    }
  },

  clearLastImportResult: () => {
    set({ lastImportResult: null });
  },

  getAnomalyStats: () => {
    const { currentProject } = get();
    if (!currentProject) return null;

    const stats: AnomalyStats = {
      coordinate_offset: 0,
      duplicate_name: 0,
      missing_photo: 0,
      cross_floor: 0,
      total: 0,
    };

    const countedPoints = new Set<string>();

    currentProject.points.forEach((point) => {
      point.anomalies.forEach((anomaly) => {
        if (!countedPoints.has(point.id)) {
          countedPoints.add(point.id);
          stats.total++;
        }
        stats[anomaly.type]++;
      });
    });

    return stats;
  },

  generateHandoverReport: () => {
    const { currentProject } = get();
    if (!currentProject) return '';

    const stats = get().getAnomalyStats();
    const formatTime = (iso: string) =>
      new Date(iso).toLocaleString('zh-CN');

    const anomalyList = currentProject.points
      .filter((p) => p.anomalies.length > 0)
      .map((p) => {
        const anomalyTypes = p.anomalies
          .map((a) => {
            const labels: Record<string, string> = {
              coordinate_offset: '坐标偏移',
              duplicate_name: '设备重名',
              missing_photo: '缺少照片',
              cross_floor: '跨楼层关联',
            };
            return labels[a.type] || a.type;
          })
          .join('、');
        return `      <li><strong>${p.name}</strong> (${p.deviceId})：${anomalyTypes}</li>`;
      })
      .join('\n');

    const reviewNotesList = currentProject.reviewNotes
      .map(
        (n) => `
      <div class="note ${n.isSupplementary ? 'supplementary' : ''}">
        <div class="note-header">
          <span class="note-operator">${n.operator}</span>
          <span class="note-time">${formatTime(n.createdAt)}</span>
          ${n.isSupplementary ? '<span class="note-tag">补录</span>' : ''}
        </div>
        <div class="note-content">${n.content}</div>
        ${n.originalContent ? `<div class="note-original">原始内容：${n.originalContent}</div>` : ''}
      </div>`
      )
      .join('\n');

    const judgmentTracesList = currentProject.judgmentTraces
      .slice(-15)
      .map(
        (t) => `
      <div class="trace-item">
        <span class="trace-time">${formatTime(t.timestamp)}</span>
        <span class="trace-operator">${t.operator}</span>
        <span class="trace-action">${t.action}</span>
        <span class="trace-remark">${t.remark}</span>
      </div>`
      )
      .join('\n');

    const keyDecisions = currentProject.handoverRecords
      .map((h) => h.keyDecisionsSummary)
      .filter(Boolean)
      .join('；');

    const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>${currentProject.name} - 交接报告</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Noto Sans SC', -apple-system, sans-serif;
      background: #f1f5f9;
      padding: 40px 20px;
      color: #1e293b;
    }
    .container {
      max-width: 900px;
      margin: 0 auto;
      background: white;
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.08);
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%);
      color: white;
      padding: 32px 40px;
    }
    .header h1 { font-size: 24px; margin-bottom: 8px; }
    .header .meta { font-size: 14px; opacity: 0.9; }
    .section { padding: 28px 40px; border-bottom: 1px solid #e2e8f0; }
    .section:last-child { border-bottom: none; }
    .section h2 {
      font-size: 16px;
      color: #1e3a5f;
      margin-bottom: 16px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: 12px;
    }
    .stat-card {
      background: #f8fafc;
      border-radius: 8px;
      padding: 16px;
      text-align: center;
    }
    .stat-card .number { font-size: 28px; font-weight: 700; color: #2563eb; }
    .stat-card .label { font-size: 12px; color: #64748b; margin-top: 4px; }
    .stat-card.anomaly .number { color: #e63946; }
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px 24px;
    }
    .info-item {
      display: flex;
      gap: 8px;
      font-size: 14px;
    }
    .info-item .label { color: #64748b; min-width: 80px; }
    .info-item .value { color: #1e293b; font-weight: 500; }
    ul.anomaly-list {
      list-style: none;
      padding: 0;
    }
    ul.anomaly-list li {
      padding: 8px 0;
      border-bottom: 1px dashed #e2e8f0;
      font-size: 14px;
    }
    ul.anomaly-list li:last-child { border-bottom: none; }
    .note {
      background: #f8fafc;
      border-radius: 8px;
      padding: 12px 16px;
      margin-bottom: 12px;
      border-left: 4px solid #2563eb;
    }
    .note.supplementary {
      border-left-color: #f59e0b;
      background: #fffbeb;
    }
    .note-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 6px;
      font-size: 12px;
    }
    .note-operator { font-weight: 600; color: #1e293b; }
    .note-time { color: #64748b; }
    .note-tag {
      background: #f59e0b;
      color: white;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 11px;
    }
    .note-content { font-size: 14px; line-height: 1.6; }
    .note-original {
      font-size: 12px;
      color: #94a3b8;
      margin-top: 6px;
      font-style: italic;
    }
    .trace-item {
      display: grid;
      grid-template-columns: 160px 80px 100px 1fr;
      gap: 12px;
      padding: 10px 0;
      border-bottom: 1px dashed #e2e8f0;
      font-size: 13px;
      align-items: start;
    }
    .trace-item:last-child { border-bottom: none; }
    .trace-time { color: #64748b; font-family: monospace; }
    .trace-operator { color: #1e3a5f; font-weight: 500; }
    .trace-action {
      background: #e0f2fe;
      color: #0369a1;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 12px;
      text-align: center;
    }
    .trace-remark { color: #334155; }
    .key-decisions {
      background: #dbeafe;
      border-radius: 8px;
      padding: 16px;
      font-size: 14px;
      line-height: 1.7;
      color: #1e40af;
    }
    .footer {
      padding: 20px 40px;
      background: #f8fafc;
      font-size: 12px;
      color: #94a3b8;
      text-align: center;
    }
    .coords {
      display: flex;
      gap: 16px;
      flex-wrap: wrap;
    }
    .coord-tag {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      border-radius: 20px;
      font-size: 13px;
      background: #f1f5f9;
    }
    .coord-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🌊 ${currentProject.name}</h1>
      <div class="meta">方案交接报告 · 生成时间 ${new Date().toLocaleString('zh-CN')}</div>
    </div>

    <div class="section">
      <h2>📊 概览统计</h2>
      <div class="stats-grid">
        <div class="stat-card">
          <div class="number">${currentProject.points.length}</div>
          <div class="label">点位总数</div>
        </div>
        <div class="stat-card anomaly">
          <div class="number">${stats?.total || 0}</div>
          <div class="label">异常点位</div>
        </div>
        <div class="stat-card">
          <div class="number">${currentProject.coordinateSystems.length}</div>
          <div class="label">坐标系</div>
        </div>
        <div class="stat-card">
          <div class="number">${currentProject.reviewNotes.length}</div>
          <div class="label">评审备注</div>
        </div>
      </div>
    </div>

    <div class="section">
      <h2>📋 基本信息</h2>
      <div class="info-grid">
        <div class="info-item">
          <span class="label">方案名称</span>
          <span class="value">${currentProject.name}</span>
        </div>
        <div class="info-item">
          <span class="label">数据来源</span>
          <span class="value">${currentProject.source || '未知'}</span>
        </div>
        <div class="info-item">
          <span class="label">创建时间</span>
          <span class="value">${formatTime(currentProject.createdAt)}</span>
        </div>
        <div class="info-item">
          <span class="label">更新时间</span>
          <span class="value">${formatTime(currentProject.updatedAt)}</span>
        </div>
        <div class="info-item">
          <span class="label">方案经理</span>
          <span class="value">${currentProject.operator || '未指定'}</span>
        </div>
        <div class="info-item">
          <span class="label">状态</span>
          <span class="value">${currentProject.status === 'completed' ? '已完成' : '进行中'}</span>
        </div>
      </div>
      <div style="margin-top: 16px;">
        <div style="font-size: 14px; color: #64748b; margin-bottom: 8px;">坐标系说明（不强行合并，分开显示）：</div>
        <div class="coords">
          ${currentProject.coordinateSystems
            .map(
              (c) => `
            <div class="coord-tag">
              <span class="coord-dot" style="background: ${c.color}"></span>
              ${c.name}
            </div>`
            )
            .join('')}
        </div>
      </div>
    </div>

    <div class="section">
      <h2>⚠️ 异常清单（共 ${stats?.total || 0} 个，全部计入，无隐藏）</h2>
      <ul class="anomaly-list">
${anomalyList || '      <li style="color: #64748b;">无异常</li>'}
      </ul>
    </div>

    ${keyDecisions ? `<div class="section"><h2>🔑 关键判定摘要</h2><div class="key-decisions">${keyDecisions}</div></div>` : ''}

    <div class="section">
      <h2>📝 评审备注（含原始记录，不清洗）</h2>
${reviewNotesList}
    </div>

    <div class="section">
      <h2>📜 判断轨迹（最近15条）</h2>
${judgmentTracesList}
    </div>

    <div class="footer">
      本报告由城市雨洪淹没演练评审系统自动生成 · 接手人可直接查看完整判断链路，无需追问方案经理
    </div>
  </div>
</body>
</html>`;

    return html;
  },
}));
