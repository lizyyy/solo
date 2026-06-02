import type { PlanVersion, DiffResult, TraceNode } from '@/types';
import { mockPlans } from '@/mocks/plans';

let plansData: PlanVersion[] = [...mockPlans];

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export const planService = {
  async getPlans(params?: { pointId?: string }): Promise<PlanVersion[]> {
    await delay(300);
    let result = [...plansData];
    if (params?.pointId) {
      result = result.filter(p => p.pointIds.includes(params.pointId));
    }
    return result.sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  },

  async getPlanById(id: string): Promise<PlanVersion | null> {
    await delay(200);
    return plansData.find(p => p.id === id) || null;
  },

  async getPlanVersions(planId: string): Promise<PlanVersion[]> {
    await delay(300);
    const baseId = planId.replace(/-v\d+$/, '');
    return plansData
      .filter(p => p.id.startsWith(baseId))
      .sort((a, b) => a.version.localeCompare(b.version));
  },

  async compareVersions(versionId1: string, versionId2: string): Promise<DiffResult[]> {
    await delay(400);
    const v1 = plansData.find(p => p.id === versionId1);
    const v2 = plansData.find(p => p.id === versionId2);
    if (!v1 || !v2) {
      throw new Error('版本不存在');
    }
    const diffs: DiffResult[] = [];
    if (v1.content !== v2.content) {
      diffs.push({
        field: '方案内容',
        oldValue: v1.content,
        newValue: v2.content,
        changeType: 'modified',
      });
    }
    if (v1.changeReason !== v2.changeReason) {
      diffs.push({
        field: '变更原因',
        oldValue: v1.changeReason,
        newValue: v2.changeReason,
        changeType: 'added',
      });
    }
    if (v1.bypassRoutes.length !== v2.bypassRoutes.length) {
      diffs.push({
        field: '绕行路线',
        oldValue: `${v1.bypassRoutes.length}条路线`,
        newValue: `${v2.bypassRoutes.length}条路线`,
        changeType: 'modified',
      });
    }
    if (v1.suggestions.length !== v2.suggestions.length) {
      diffs.push({
        field: '业务建议',
        oldValue: `${v1.suggestions.length}条建议`,
        newValue: `${v2.suggestions.length}条建议`,
        changeType: 'modified',
      });
    }
    return diffs;
  },

  async createPlan(data: Omit<PlanVersion, 'id' | 'createdAt'>): Promise<PlanVersion> {
    await delay(500);
    const baseId = `plan${Date.now()}`;
    const newPlan: PlanVersion = {
      ...data,
      id: `${baseId}-${data.version}`,
      createdAt: new Date().toISOString(),
    };
    if (data.previousVersionId) {
      const prevIndex = plansData.findIndex(p => p.id === data.previousVersionId);
      if (prevIndex !== -1) {
        plansData[prevIndex] = {
          ...plansData[prevIndex],
          nextVersionId: newPlan.id,
          isActive: false,
        };
      }
    }
    plansData.push(newPlan);
    return newPlan;
  },

  async getTraceChain(planId: string): Promise<TraceNode[]> {
    await delay(300);
    const plan = plansData.find(p => p.id === planId);
    if (!plan) {
      return [];
    }
    const trace: TraceNode[] = [];
    trace.push({
      id: plan.id,
      type: 'plan',
      title: plan.title,
      time: plan.createdAt,
      relation: '当前方案',
    });
    for (const pointId of plan.pointIds) {
      trace.push({
        id: pointId,
        type: 'point',
        title: `点位 ${pointId}`,
        time: plan.createdAt,
        relation: '涉及点位',
      });
    }
    if (plan.previousVersionId) {
      const prevPlan = plansData.find(p => p.id === plan.previousVersionId);
      if (prevPlan) {
        trace.push({
          id: prevPlan.id,
          type: 'plan',
          title: prevPlan.title,
          time: prevPlan.createdAt,
          relation: '历史版本',
        });
      }
    }
    return trace;
  },
};
