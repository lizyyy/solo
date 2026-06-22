import { persistenceService } from '@/services/persistence';
import { generateId, computeContentHash } from '@/utils/hash';
import type {
  Session,
  Material,
  ComputationStep,
  AuditLog,
  SuspendedTask,
  Report,
  MaterialVersion,
  BoundaryCondition,
  StoredSession,
} from '@/types';
import { reportGenerator } from '@/services/reportGenerator';
import { errorPropagationEngine, generateErrorPropagationSteps } from '@/services/errorPropagation';
import { boundaryChecker } from '@/services/boundaryChecker';
import { useSessionStore } from '@/stores/useSessionStore';
import { useMaterialStore } from '@/stores/useMaterialStore';
import { useComputationStore } from '@/stores/useComputationStore';
import { useAuditStore } from '@/stores/useAuditStore';
import { useReportStore } from '@/stores/useReportStore';

const LS_BACKUP_KEY = 'ep_boundary_backup_v1';

const createVersion = (
  materialId: string,
  version: number,
  content: string,
  createdBy: string,
  timestamp: number,
  diff: any[] = []
): MaterialVersion => ({
  id: generateId(),
  materialId,
  version,
  content,
  contentHash: computeContentHash(content),
  diff,
  createdBy,
  timestamp,
  createdAt: timestamp,
});

export const initializeDemoData = async (force: boolean = false): Promise<void> => {
  try {
    console.log('[DemoData] Starting initialization, force=', force);

    const now = Date.now();

    let existingSessions: any[] = [];
    try {
      console.log('[DemoData] Checking existing sessions...');
      existingSessions = await Promise.race([
        persistenceService.getAllSessions(),
        new Promise<any[]>((_, reject) => setTimeout(() => reject(new Error('getAllSessions timeout')), 5000)),
      ]);
      console.log('[DemoData] Found existing sessions:', existingSessions.length);
    } catch (e) {
      console.warn('[DemoData] getAllSessions failed or timed out, treating as empty:', e);
      existingSessions = [];
    }

    if (!force && existingSessions.length > 0) {
      console.log('[DemoData] Demo data already exists in IndexedDB, hydrating stores...');
      hydrateStoresFromPersistence();
      return;
    }

    if (!force) {
      try {
        const lsBackup = localStorage.getItem(LS_BACKUP_KEY);
        if (lsBackup) {
          const backup = JSON.parse(lsBackup);
          if (backup.sessions && backup.sessions.length > 0) {
            console.log('[DemoData] Found localStorage backup with', backup.sessions.length, 'sessions, hydrating...');
            hydrateStoresFromPersistence();
            return;
          }
        }
      } catch (e) {
        console.warn('[DemoData] Failed to check localStorage backup:', e);
      }
    }

    console.log('[DemoData] Creating unit conversion demo session...');
    const unitSession = createUnitConversionDemoSession(now);
    console.log('[DemoData] Unit conversion demo session created in memory');

    console.log('[DemoData] Creating duplicate sample demo session...');
    const duplicateSession = createDuplicateSampleDemoSession(now - 7200000);
    console.log('[DemoData] Duplicate sample demo session created in memory');

    console.log('[DemoData] Creating parameter compare demo session...');
    const compareSession = createParameterCompareDemoSession(now - 14400000);
    console.log('[DemoData] Parameter compare demo session created in memory');

    const allSessions = [unitSession, duplicateSession, compareSession];
    console.log('[DemoData] All 3 sessions created in memory');

    console.log('[DemoData] Hydrating stores from in-memory sessions...');
    hydrateStoresFromSessions(allSessions);
    console.log('[DemoData] Stores hydrated, UI should now show all data');

    console.log('[DemoData] Starting async persistence to IndexedDB (fire-and-forget, non-blocking)...');
    saveSessionsAsync(allSessions);

    console.log('[DemoData] Initialization complete (persistence running in background)');
  } catch (error) {
    console.error('[DemoData] Initialization failed:', error);
    console.error('[DemoData] Error details:', error instanceof Error ? error.stack : error);
    console.warn('[DemoData] Continuing with best-effort recovery');
  }
};

function hydrateStoresFromSessions(storedSessions: StoredSession[]): void {
  try {
    const sessions: Session[] = [];
    const allMaterials: Material[] = [];
    const allSteps: ComputationStep[] = [];
    const allLogs: AuditLog[] = [];
    const allTasks: SuspendedTask[] = [];
    const allReports: Report[] = [];

    storedSessions.forEach((stored) => {
      sessions.push(stored.session);
      if (stored.materials) allMaterials.push(...stored.materials);
      if (stored.computationSteps) allSteps.push(...stored.computationSteps);
      if (stored.auditLogs) allLogs.push(...stored.auditLogs);
      if (stored.suspendedTasks) allTasks.push(...stored.suspendedTasks);
      if (stored.report) allReports.push(stored.report);
    });

    (useSessionStore as any).setState({
      sessions,
      currentSession: sessions[0] || null,
      isLoading: false,
    });

    (useMaterialStore as any).setState({
      materials: allMaterials,
      isLoading: false,
    });

    (useComputationStore as any).setState({
      steps: allSteps,
      isLoading: false,
    });

    (useAuditStore as any).setState({
      logs: allLogs,
      auditLogs: allLogs,
      suspendedTasks: allTasks,
      isLoading: false,
    });

    (useReportStore as any).setState({
      reports: allReports,
      currentReport: allReports[0] || null,
      isLoading: false,
    });

    try {
      const backup = {
        sessions,
        materials: allMaterials,
        computationSteps: allSteps,
        auditLogs: allLogs,
        suspendedTasks: allTasks,
        reports: allReports,
        savedAt: Date.now(),
      };
      const backupStr = JSON.stringify(backup);
      localStorage.setItem(LS_BACKUP_KEY, backupStr);
      console.log('[DemoData] localStorage backup saved, size:', backupStr.length, 'bytes');
    } catch (lsErr) {
      console.warn('[DemoData] localStorage backup failed:', lsErr);
    }

    console.log(
      '[DemoData] Hydrated:',
      sessions.length, 'sessions,',
      allMaterials.length, 'materials,',
      allSteps.length, 'steps,',
      allLogs.length, 'logs,',
      allTasks.length, 'tasks,',
      allReports.length, 'reports'
    );
  } catch (err) {
    console.error('[DemoData] Hydrate stores failed:', err);
    console.warn('[DemoData] UI may show empty data');
  }
}

function hydrateStoresFromPersistence(): void {
  try {
    const lsBackup = localStorage.getItem(LS_BACKUP_KEY);
    if (lsBackup) {
      try {
        const backup = JSON.parse(lsBackup);
        (useSessionStore as any).setState({
          sessions: backup.sessions || [],
          currentSession: (backup.sessions && backup.sessions[0]) || null,
          isLoading: false,
        });
        (useMaterialStore as any).setState({ materials: backup.materials || [], isLoading: false });
        (useComputationStore as any).setState({ steps: backup.computationSteps || [], isLoading: false });
        (useAuditStore as any).setState({
          logs: backup.auditLogs || [],
          auditLogs: backup.auditLogs || [],
          suspendedTasks: backup.suspendedTasks || [],
          isLoading: false,
        });
        console.log('[DemoData] Restored from localStorage backup:', (backup.sessions || []).length, 'sessions');
        return;
      } catch (parseErr) {
        console.warn('[DemoData] Parse localStorage backup failed:', parseErr);
      }
    }
    console.log('[DemoData] No localStorage backup found');
  } catch (err) {
    console.warn('[DemoData] Hydrate from persistence failed:', err);
  }
}

async function saveSessionsAsync(sessions: StoredSession[]): Promise<void> {
  for (let i = 0; i < sessions.length; i++) {
    const s = sessions[i];
    try {
      console.log(`[DemoData] Async saving session ${i + 1}/${sessions.length}: ${s.session.id}`);
      await Promise.race([
        persistenceService.saveFullSession(s),
        new Promise<void>((_, reject) => setTimeout(() => reject(new Error('saveFullSession timeout (30s)')), 30000)),
      ]);
      console.log(`[DemoData] Session ${i + 1} saved to IndexedDB successfully`);
    } catch (err) {
      console.error(`[DemoData] Session ${i + 1} save to IndexedDB failed:`, err?.message || err);
      console.warn(`[DemoData] Session ${i + 1} is in memory and localStorage, IndexedDB failure is non-critical`);
    }
  }
  console.log('[DemoData] All async IndexedDB persistence attempts finished');
}

function createUnitConversionDemoSession(baseTime: number): StoredSession {
  console.log('[DemoData] createUnitConversionDemoSession: start');
  const sessionId = generateId();
  const historicalId = generateId();
  const boundaryId = generateId();
  const verbalId = generateId();
  console.log('[DemoData] createUnitConversionDemoSession: generated ids');

  const historicalContent = `## 2024年高考物理第12题参考答案

### 题目
一矩形金属线圈在匀强磁场中绕垂直于磁场的轴匀速转动，线圈匝数n=100匝，面积S=0.02m²，线圈总电阻r=1Ω，磁场的磁感应强度B=0.5T，线圈转动的角速度ω=100π rad/s。

求：
1. 线圈中产生的感应电动势的最大值
2. 若外接电阻R=9Ω，求电路中的电流有效值
3. 求电阻R上消耗的电功率

### 参考答案

1. 感应电动势最大值：
   Em = nBSω = 100 × 0.5 × 0.02 × 100π = 100π ≈ 314 V

2. 感应电动势有效值：
   E = Em / √2 = 100π / √2 ≈ 222 V
   
   电路总电阻：R总 = R + r = 9 + 1 = 10 Ω
   
   电流有效值：I = E / R总 = 222 / 10 = 22.2 A

3. 电阻R上消耗的电功率：
   P = I²R = (22.2)² × 9 = 492.84 × 9 ≈ 4435.56 W ≈ 4.44 kW

### 边界条件（隐含）
根据历史答案，感应电动势最大值应在 [300, 330] V 范围内
电流有效值应在 [21, 24] A 范围内
电功率应在 [4000, 4800] W 范围内

### 评分标准
- 第1问：4分，公式正确2分，结果正确2分
- 第2问：6分，有效值计算3分，欧姆定律应用3分
- 第3问：5分，功率公式2分，计算正确3分

**注意：单位换算错误扣1分，有效数字保留不当扣0.5分**
根据参考答案第2页第3条，所有结果均需保留两位有效数字`;

  const boundaryContent = `## 误差边界复核样本 - 单位换算案例

### 样本描述
某同学在解答上述题目时，将线圈面积S=0.02m²误读为S=200cm²，在计算过程中进行了单位换算，但换算因子使用错误。

### 边界条件（明确）
Em ∈ [300, 330] (V)
I ∈ [21, 24] (A)
P ∈ [4000, 4800] (W)

### 学生解答过程

1. 感应电动势最大值：
   S = 200 cm² = 0.02 m² ✓（这一步是对的）
   Em = nBSω = 100 × 0.5 × 200 × 100π
   （这里忘记了单位换算，直接使用了200而不是0.02）
   
   Em = 100 × 0.5 × 200 × 100π = 1,000,000π ≈ 3,140,000 V

### 误差来源分析
- 单位换算遗漏：cm²到m²的换算因子为10⁻⁴
- 正确换算：200 cm² = 200 × 10⁻⁴ m² = 0.02 m²
- 错误结果：直接使用200代入，导致结果放大了10⁴倍

### 复核要求
1. 识别单位换算错误点
2. 计算误差传播系数
3. 给出正确的误差边界
4. 验证结果是否在历史答案规定的边界范围内`;

  const verbalContent = `## 临时口头说明

老叶补充：
这个题目在去年的复习中出现过类似的单位换算问题。当时有学生把"厘米"直接当"米"来用，结果差了两个数量级。

这次要特别注意：
1. 面积单位换算：cm² → m² 是 10⁻⁴，不是10⁻²
2. 角速度的单位是rad/s，不是rpm
3. 有效值和最大值的关系是√2，不是2

另外，要提醒学生们：
- 写公式的时候要带单位
- 每一步换算都要写清楚
- 最后结果要检查量纲是否正确

如果发现学生有单位换算的习惯性错误，要在报告中特别指出，并给出针对性的改进建议。

根据历史答案原话："单位换算错误扣1分"，这个标准要严格执行。`;

  const session: Session = {
    id: sessionId,
    status: 'completed',
    createdAt: baseTime - 3600000,
    updatedAt: baseTime - 600000,
    currentStep: 4,
    progress: {
      totalSteps: 5,
      currentStep: 4,
      completionPercentage: 100,
      recoveryPoints: [0, 1, 2, 3, 4],
      lastSavedAt: baseTime - 600000,
      lastModifiedBy: '现场老师',
    },
    title: '案例1：单位换算导致边界变化',
  };

  const historicalMaterial: Material = {
    id: historicalId,
    sessionId,
    type: 'historical_answer',
    name: '2024年高考物理第12题参考答案',
    content: historicalContent,
    contentHash: computeContentHash(historicalContent),
    version: 1,
    versions: [
      createVersion(
        historicalId,
        1,
        historicalContent,
        '数学老师老叶',
        baseTime - 3600000
      ),
    ],
    hasCaliberChanged: false,
    createdAt: baseTime - 3600000,
    updatedAt: baseTime - 3600000,
  };

  const boundaryMaterial: Material = {
    id: boundaryId,
    sessionId,
    type: 'boundary_sample',
    name: '边界样本-单位换算误差案例',
    content: boundaryContent,
    contentHash: computeContentHash(boundaryContent),
    version: 1,
    versions: [
      createVersion(
        boundaryId,
        1,
        boundaryContent,
        '数学老师老叶',
        baseTime - 3300000
      ),
    ],
    hasCaliberChanged: false,
    createdAt: baseTime - 3300000,
    updatedAt: baseTime - 3300000,
  };

  const verbalMaterial: Material = {
    id: verbalId,
    sessionId,
    type: 'verbal_note',
    name: '临时口头说明-老叶补充',
    content: verbalContent,
    contentHash: computeContentHash(verbalContent),
    version: 1,
    versions: [
      createVersion(
        verbalId,
        1,
        verbalContent,
        '数学老师老叶',
        baseTime - 3000000
      ),
    ],
    hasCaliberChanged: false,
    createdAt: baseTime - 3000000,
    updatedAt: baseTime - 3000000,
  };

  const boundaryConditions: BoundaryCondition[] = [
    { variable: 'Em', lowerBound: 300, upperBound: 330, unit: 'V', sourceMaterialId: boundaryId },
    { variable: 'I', lowerBound: 21, upperBound: 24, unit: 'A', sourceMaterialId: boundaryId },
    { variable: 'P', lowerBound: 4000, upperBound: 4800, unit: 'W', sourceMaterialId: boundaryId },
  ];

  const variables1 = [
    { name: 'n', value: 100, unit: '匝', error: 0, targetUnit: '匝' },
    { name: 'B', value: 0.5, unit: 'T', error: 0.01, targetUnit: 'T' },
    { name: 'S', value: 200, unit: 'cm²', error: 0.1, targetUnit: 'm²' },
    { name: 'ω', value: 314.16, unit: 'rad/s', error: 0.01, targetUnit: 'rad/s' },
  ];

  console.log('[DemoData] createUnitConversionDemoSession: calling compute 1');
  const result1 = errorPropagationEngine.compute({
    formula: 'n * B * S * ω',
    variables: variables1,
    resultUnit: 'V',
    description: '感应电动势最大值计算（含单位换算）',
    boundaryConditions: [boundaryConditions[0]],
  });
  console.log('[DemoData] createUnitConversionDemoSession: compute 1 done, result=', result1.finalResult);
  console.log('[DemoData] createUnitConversionDemoSession: result1 totalError=', result1.totalError);
  console.log('[DemoData] createUnitConversionDemoSession: result1 steps count=', result1.steps?.length);

  const steps1 = result1.steps.map((s) => ({ ...s, sessionId }));
  console.log('[DemoData] createUnitConversionDemoSession: steps1 processed');

  const variables2 = [
    { name: 'Em', value: result1.finalResult, unit: 'V', error: result1.totalError, targetUnit: 'V' },
    { name: 'R', value: 9, unit: 'Ω', error: 0.1, targetUnit: 'Ω' },
    { name: 'r', value: 1, unit: 'Ω', error: 0.01, targetUnit: 'Ω' },
  ];

  console.log('[DemoData] createUnitConversionDemoSession: calling compute 2');
  const result2 = errorPropagationEngine.compute({
    formula: '(Em / 1.4142) / (R + r)',
    variables: variables2,
    resultUnit: 'A',
    description: '电路电流有效值计算',
    boundaryConditions: [boundaryConditions[1]],
  });
  console.log('[DemoData] createUnitConversionDemoSession: compute 2 done, result=', result2.finalResult);
  console.log('[DemoData] createUnitConversionDemoSession: result2 steps count=', result2.steps?.length);

  const steps2 = result2.steps.map((s) => ({
    ...s,
    sessionId,
    stepOrder: s.stepOrder + steps1.length,
  }));
  console.log('[DemoData] createUnitConversionDemoSession: steps2 processed');

  const variables3 = [
    { name: 'I', value: result2.finalResult, unit: 'A', error: result2.totalError, targetUnit: 'A' },
    { name: 'R', value: 9, unit: 'Ω', error: 0.1, targetUnit: 'Ω' },
  ];

  console.log('[DemoData] createUnitConversionDemoSession: calling compute 3');
  const result3 = errorPropagationEngine.compute({
    formula: 'I^2 * R',
    variables: variables3,
    resultUnit: 'W',
    description: '电阻R上消耗的电功率计算',
    boundaryConditions: [boundaryConditions[2]],
  });
  console.log('[DemoData] createUnitConversionDemoSession: compute 3 done, result=', result3.finalResult);

  const steps3 = result3.steps.map((s) => ({
    ...s,
    sessionId,
    stepOrder: s.stepOrder + steps1.length + steps2.length,
  }));
  console.log('[DemoData] createUnitConversionDemoSession: steps3 processed');

  const allSteps = [...steps1, ...steps2, ...steps3];
  console.log('[DemoData] createUnitConversionDemoSession: allSteps merged, total steps=', allSteps.length);

  console.log('[DemoData] createUnitConversionDemoSession: creating audit logs');
  const auditLogs: AuditLog[] = [
    {
      id: generateId(),
      sessionId,
      actionType: 'material_upload',
      description: '上传历史答案文档：2024年高考物理第12题参考答案',
      operator: '数学老师老叶',
      timestamp: baseTime - 3600000,
      metadata: { materialType: 'historical_answer', materialName: historicalMaterial.name },
    },
    {
      id: generateId(),
      sessionId,
      actionType: 'material_upload',
      description: '上传边界样本：单位换算误差案例',
      operator: '数学老师老叶',
      timestamp: baseTime - 3300000,
      metadata: { materialType: 'boundary_sample', materialName: boundaryMaterial.name },
    },
    {
      id: generateId(),
      sessionId,
      actionType: 'material_upload',
      description: '上传临时口头说明：老叶补充',
      operator: '数学老师老叶',
      timestamp: baseTime - 3000000,
      metadata: { materialType: 'verbal_note', materialName: verbalMaterial.name },
    },
    {
      id: generateId(),
      sessionId,
      actionType: 'computation_start',
      description: '开始计算：感应电动势最大值（含单位换算）',
      operator: '现场老师',
      timestamp: baseTime - 2700000,
      metadata: { formula: 'n * B * S * ω', variables: 'n, B, S, ω', unitConversion: 'cm² → m²' },
    },
    {
      id: generateId(),
      sessionId,
      actionType: 'computation_complete',
      description: `完成计算：感应电动势最大值 = ${result1.finalResult.toFixed(2)} V`,
      operator: '系统',
      timestamp: baseTime - 2600000,
      metadata: { result: `${result1.finalResult.toFixed(2)} V`, boundaryCheck: result1.boundaryPassed ? 'PASSED' : 'FAILED' },
    },
    {
      id: generateId(),
      sessionId,
      actionType: 'computation_start',
      description: '开始计算：电路电流有效值',
      operator: '现场老师',
      timestamp: baseTime - 2400000,
      metadata: { formula: '(Em / √2) / (R + r)', variables: 'Em, R, r' },
    },
    {
      id: generateId(),
      sessionId,
      actionType: 'computation_complete',
      description: `完成计算：电流有效值 = ${result2.finalResult.toFixed(2)} A`,
      operator: '系统',
      timestamp: baseTime - 2300000,
      metadata: { result: `${result2.finalResult.toFixed(2)} A`, boundaryCheck: result2.boundaryPassed ? 'PASSED' : 'FAILED' },
    },
    {
      id: generateId(),
      sessionId,
      actionType: 'computation_start',
      description: '开始计算：电阻R上消耗的电功率',
      operator: '现场老师',
      timestamp: baseTime - 2100000,
      metadata: { formula: 'I^2 * R', variables: 'I, R' },
    },
    {
      id: generateId(),
      sessionId,
      actionType: 'computation_complete',
      description: `完成计算：电功率 = ${result3.finalResult.toFixed(2)} W`,
      operator: '系统',
      timestamp: baseTime - 2000000,
      metadata: { result: `${result3.finalResult.toFixed(2)} W`, boundaryCheck: result3.boundaryPassed ? 'PASSED' : 'FAILED' },
    },
    {
      id: generateId(),
      sessionId,
      actionType: 'generate_report',
      description: '生成误差传播边界复核报告',
      operator: '现场老师',
      timestamp: baseTime - 1800000,
      metadata: { reportType: 'markdown', sections: 8 },
    },
  ];
  console.log('[DemoData] createUnitConversionDemoSession: auditLogs created, count=', auditLogs.length);

  const materials = [historicalMaterial, boundaryMaterial, verbalMaterial];
  console.log('[DemoData] createUnitConversionDemoSession: materials array created');

  console.log('[DemoData] createUnitConversionDemoSession: generating report');
  const report = reportGenerator.generate(
    session,
    materials,
    allSteps,
    auditLogs,
    '现场老师'
  );
  console.log('[DemoData] createUnitConversionDemoSession: report generated, content length=', report.content?.length);

  console.log('[DemoData] createUnitConversionDemoSession: returning StoredSession (save will be async)');
  return {
    session,
    materials: [historicalMaterial, boundaryMaterial, verbalMaterial],
    computationSteps: allSteps,
    auditLogs,
    suspendedTasks: [],
    report,
  };
}

function createDuplicateSampleDemoSession(baseTime: number): StoredSession {
  console.log('[DemoData] createDuplicateSampleDemoSession: start');
  const sessionId = generateId();
  const historicalId = generateId();
  const boundaryId = generateId();

  const historicalContent = `## 2023年期末物理考试第8题参考答案

### 题目
已知一物体做匀加速直线运动，初速度v₀=5 m/s，加速度a=2 m/s²，运动时间t=10 s。

求：
1. 物体的末速度v
2. 物体的位移s

### 参考答案

1. 末速度：v = v₀ + at = 5 + 2 × 10 = 25 m/s

2. 位移：s = v₀t + ½at² = 5 × 10 + 0.5 × 2 × 10² = 50 + 100 = 150 m

### 边界条件
v ∈ [24, 26] (m/s)
s ∈ [145, 155] (m)

根据历史答案第3页第2条，位移计算结果必须在145-155m范围内，否则判定为误差超限。`;

  const boundaryContent = `## 误差边界复核样本 - 重复样本

### 样本描述
某同学提交的解答与2023年期末物理考试第8题完全相同，疑似重复提交。

### 学生解答

1. 末速度：
   v = v₀ + at = 5 + 2 × 10 = 25 m/s

2. 位移：
   s = v₀t + ½at² = 5 × 10 + 0.5 × 2 × 10² = 50 + 100 = 150 m

### 复核说明
此样本与历史数据库中2023年期末物理考试第8题的边界样本相似度高达92.3%。
根据系统规则，相似度≥85%的边界样本需要人工确认后才能继续处理。

请确认：
1. 这是新的独立样本，还是重复提交？
2. 如果是新样本，是否需要调整边界条件？
3. 如果是重复提交，是否需要合并到原有会话？`;

  const session: Session = {
    id: sessionId,
    status: 'suspended',
    createdAt: baseTime - 1800000,
    updatedAt: baseTime - 1200000,
    currentStep: 1,
    progress: {
      totalSteps: 3,
      currentStep: 1,
      completionPercentage: 33.33,
      recoveryPoints: [0, 1],
      lastSavedAt: baseTime - 1200000,
      lastModifiedBy: '系统',
    },
    title: '案例2：重复样本挂起确认',
  };

  const historicalMaterial: Material = {
    id: historicalId,
    sessionId,
    type: 'historical_answer',
    name: '2023年期末物理考试第8题参考答案',
    content: historicalContent,
    contentHash: computeContentHash(historicalContent),
    version: 1,
    versions: [
      createVersion(
        historicalId,
        1,
        historicalContent,
        '数学老师老叶',
        baseTime - 1800000
      ),
    ],
    hasCaliberChanged: false,
    createdAt: baseTime - 1800000,
    updatedAt: baseTime - 1800000,
  };

  const boundaryMaterial: Material = {
    id: boundaryId,
    sessionId,
    type: 'boundary_sample',
    name: '边界样本-疑似重复提交',
    content: boundaryContent,
    contentHash: computeContentHash(boundaryContent),
    version: 1,
    versions: [
      createVersion(
        boundaryId,
        1,
        boundaryContent,
        '现场老师',
        baseTime - 1500000
      ),
    ],
    hasCaliberChanged: false,
    createdAt: baseTime - 1500000,
    updatedAt: baseTime - 1500000,
  };

  const boundaryConditions: BoundaryCondition[] = [
    { variable: 'v', lowerBound: 24, upperBound: 26, unit: 'm/s', sourceMaterialId: historicalId },
    { variable: 's', lowerBound: 145, upperBound: 155, unit: 'm', sourceMaterialId: historicalId },
  ];

  const variables = [
    { name: 'v₀', value: 5, unit: 'm/s', error: 0.1, targetUnit: 'm/s' },
    { name: 'a', value: 2, unit: 'm/s²', error: 0.05, targetUnit: 'm/s²' },
    { name: 't', value: 10, unit: 's', error: 0.01, targetUnit: 's' },
  ];

  console.log('[DemoData] createDuplicateSampleDemoSession: calling compute');
  const result = errorPropagationEngine.compute({
    formula: 'v₀ + a * t',
    variables,
    resultUnit: 'm/s',
    description: '末速度计算',
    boundaryConditions: [boundaryConditions[0]],
  });
  console.log('[DemoData] createDuplicateSampleDemoSession: compute done, result=', result.finalResult);

  const steps = result.steps.map((s) => ({ ...s, sessionId }));

  const auditLogs: AuditLog[] = [
    {
      id: generateId(),
      sessionId,
      actionType: 'material_upload',
      description: '上传历史答案文档：2023年期末物理考试第8题参考答案',
      operator: '现场老师',
      timestamp: baseTime - 1800000,
      metadata: { materialType: 'historical_answer', materialName: historicalMaterial.name },
    },
    {
      id: generateId(),
      sessionId,
      actionType: 'material_upload',
      description: '上传边界样本：疑似重复提交',
      operator: '现场老师',
      timestamp: baseTime - 1500000,
      metadata: { materialType: 'boundary_sample', materialName: boundaryMaterial.name },
    },
    {
      id: generateId(),
      sessionId,
      actionType: 'suspend',
      description: '检测到重复样本，相似度92.3%，已自动挂起',
      operator: '系统',
      timestamp: baseTime - 1400000,
      metadata: { similarity: 0.923, reason: 'duplicate_sample' },
    },
    {
      id: generateId(),
      sessionId,
      actionType: 'computation_start',
      description: '开始计算：末速度（挂起前已执行）',
      operator: '现场老师',
      timestamp: baseTime - 1300000,
      metadata: { formula: 'v₀ + a * t', variables: 'v₀, a, t' },
    },
  ];

  const suspendedTask: SuspendedTask = {
    id: generateId(),
    sessionId,
    status: 'pending',
    reason: 'duplicate_sample',
    description: '检测到边界样本与2023年期末物理考试第8题样本相似度为92.3%，已自动挂起等待人工确认',
    createdBy: '系统',
    createdAt: baseTime - 1400000,
    duplicateInfo: {
      similarity: 0.923,
      existingSessionId: generateId(),
      existingSampleHash: computeContentHash(historicalContent),
      newSampleHash: boundaryMaterial.contentHash,
      existingSessionTitle: '2023年期末物理考试第8题复核',
    },
  };

  console.log('[DemoData] createDuplicateSampleDemoSession: returning StoredSession (save will be async)');
  return {
    session,
    materials: [historicalMaterial, boundaryMaterial],
    computationSteps: steps,
    auditLogs,
    suspendedTasks: [suspendedTask],
    report: undefined as any,
  };
}

function createParameterCompareDemoSession(baseTime: number): StoredSession {
  console.log('[DemoData] createParameterCompareDemoSession: start');
  const sessionId = generateId();
  const historicalId = generateId();
  const boundaryId = generateId();
  const verbalId = generateId();

  const historicalContent = `## 实验数据复核 - 弹簧劲度系数测定

### 实验背景
某同学做"探究弹簧弹力与弹簧伸长量的关系"实验，获得两组实验数据。
根据胡克定律：F = kx，其中k为弹簧的劲度系数。

### 历史答案原话

根据教材第45页第3节，弹簧劲度系数的计算公式为：
k = ΔF / Δx

其中ΔF为弹力变化量，Δx为弹簧伸长量变化量。

### 两组实验数据

**第一组参数（室温20°C）：**
- 拉力F₁ = 10 N
- 伸长量x₁ = 0.05 m
- 拉力F₂ = 20 N
- 伸长量x₂ = 0.10 m

**第二组参数（室温30°C）：**
- 拉力F₁ = 10 N
- 伸长量x₁ = 0.052 m（温度升高，弹簧变软）
- 拉力F₂ = 20 N
- 伸长量x₂ = 0.105 m

### 边界条件
根据实验要求，劲度系数k应在 [190, 210] N/m 范围内
相对误差不得超过5%

### 评分标准
- 公式正确：3分
- 单位正确：2分
- 结果在边界范围内：3分
- 两组参数对比分析：2分

**注意：必须进行两组参数的对照分析，说明温度对弹簧劲度系数的影响。**`;

  const boundaryContent = `## 误差边界复核样本 - 两组参数对照

### 边界条件
k ∈ [190, 210] (N/m)
相对误差 ≤ 5%

### 复核要求
1. 分别计算两组参数的劲度系数k₁和k₂
2. 计算每组的误差传播
3. 对比两组结果的差异
4. 判断两组结果是否都在边界范围内
5. 分析温度变化对实验结果的影响

### 参考公式
k = ΔF / Δx = (F₂ - F₁) / (x₂ - x₁)

误差传播公式：
σ_k = |k| × √[(σ_ΔF / ΔF)² + (σ_Δx / Δx)²]`;

  const verbalContent = `## 临时口头说明

老叶补充：
这个实验是历届学生最容易出错的地方。主要问题有：

1. 很多学生忘记单位换算，把cm直接当m用
2. 不知道要做两组对照，说明温度影响
3. 误差传播公式记错，把加法当成乘法

这次复核要特别注意：
- 检查每组的单位是否正确
- 验证两组结果是否都在边界内
- 重点分析温度导致的差异

根据历史答案原话："必须进行两组参数的对照分析"，这是评分标准中的硬性要求。`;

  const session: Session = {
    id: sessionId,
    status: 'completed',
    createdAt: baseTime - 3600000,
    updatedAt: baseTime - 300000,
    currentStep: 6,
    progress: {
      totalSteps: 7,
      currentStep: 6,
      completionPercentage: 100,
      recoveryPoints: [0, 1, 2, 3, 4, 5, 6],
      lastSavedAt: baseTime - 300000,
      lastModifiedBy: '现场老师',
    },
    title: '案例3：两组参数对照分析',
  };

  const historicalMaterial: Material = {
    id: historicalId,
    sessionId,
    type: 'historical_answer',
    name: '实验数据复核 - 弹簧劲度系数测定',
    content: historicalContent,
    contentHash: computeContentHash(historicalContent),
    version: 2,
    versions: [
      createVersion(
        historicalId,
        1,
        historicalContent.replace('[190, 210]', '[180, 220]'),
        '数学老师老叶',
        baseTime - 3600000
      ),
      createVersion(
        historicalId,
        2,
        historicalContent,
        '数学老师老叶',
        baseTime - 3300000,
        [
          { type: 'modified', value: '[190, 210]', oldValue: '[180, 220]' },
        ]
      ),
    ],
    hasCaliberChanged: true,
    createdAt: baseTime - 3600000,
    updatedAt: baseTime - 3300000,
  };

  const boundaryMaterial: Material = {
    id: boundaryId,
    sessionId,
    type: 'boundary_sample',
    name: '边界样本-两组参数对照',
    content: boundaryContent,
    contentHash: computeContentHash(boundaryContent),
    version: 1,
    versions: [
      createVersion(
        boundaryId,
        1,
        boundaryContent,
        '数学老师老叶',
        baseTime - 3000000
      ),
    ],
    hasCaliberChanged: false,
    createdAt: baseTime - 3000000,
    updatedAt: baseTime - 3000000,
  };

  const verbalMaterial: Material = {
    id: verbalId,
    sessionId,
    type: 'verbal_note',
    name: '临时口头说明-老叶补充',
    content: verbalContent,
    contentHash: computeContentHash(verbalContent),
    version: 1,
    versions: [
      createVersion(
        verbalId,
        1,
        verbalContent,
        '数学老师老叶',
        baseTime - 2700000
      ),
    ],
    hasCaliberChanged: false,
    createdAt: baseTime - 2700000,
    updatedAt: baseTime - 2700000,
  };

  const boundaryConditions: BoundaryCondition[] = [
    { variable: 'k', lowerBound: 190, upperBound: 210, unit: 'N/m', sourceMaterialId: boundaryId },
  ];

  const variables1 = [
    { name: 'F₂', value: 20, unit: 'N', error: 0.1, targetUnit: 'N' },
    { name: 'F₁', value: 10, unit: 'N', error: 0.1, targetUnit: 'N' },
    { name: 'x₂', value: 0.10, unit: 'm', error: 0.001, targetUnit: 'm' },
    { name: 'x₁', value: 0.05, unit: 'm', error: 0.001, targetUnit: 'm' },
  ];

  console.log('[DemoData] createParameterCompareDemoSession: calling compute 1');
  const result1 = errorPropagationEngine.compute({
    formula: '(F₂ - F₁) / (x₂ - x₁)',
    variables: variables1,
    resultUnit: 'N/m',
    description: '第一组参数（20°C）- 劲度系数计算',
    boundaryConditions,
  });
  console.log('[DemoData] createParameterCompareDemoSession: compute 1 done, result=', result1.finalResult);

  const steps1 = result1.steps.map((s) => ({ ...s, sessionId }));

  const variables2 = [
    { name: 'F₂', value: 20, unit: 'N', error: 0.1, targetUnit: 'N' },
    { name: 'F₁', value: 10, unit: 'N', error: 0.1, targetUnit: 'N' },
    { name: 'x₂', value: 0.105, unit: 'm', error: 0.001, targetUnit: 'm' },
    { name: 'x₁', value: 0.052, unit: 'm', error: 0.001, targetUnit: 'm' },
  ];

  console.log('[DemoData] createParameterCompareDemoSession: calling compute 2');
  const result2 = errorPropagationEngine.compute({
    formula: '(F₂ - F₁) / (x₂ - x₁)',
    variables: variables2,
    resultUnit: 'N/m',
    description: '第二组参数（30°C）- 劲度系数计算',
    boundaryConditions,
  });
  console.log('[DemoData] createParameterCompareDemoSession: compute 2 done, result=', result2.finalResult);

  const steps2 = result2.steps.map((s) => ({
    ...s,
    sessionId,
    stepOrder: s.stepOrder + steps1.length,
  }));

  const allSteps = [...steps1, ...steps2];

  const auditLogs: AuditLog[] = [
    {
      id: generateId(),
      sessionId,
      actionType: 'material_upload',
      description: '上传历史答案文档：弹簧劲度系数测定',
      operator: '数学老师老叶',
      timestamp: baseTime - 3600000,
      metadata: { materialType: 'historical_answer', materialName: historicalMaterial.name },
    },
    {
      id: generateId(),
      sessionId,
      actionType: 'material_update',
      description: '更新历史答案文档：边界条件从[180, 220]调整为[190, 210]（检测到口径变更）',
      operator: '数学老师老叶',
      timestamp: baseTime - 3300000,
      metadata: { materialType: 'historical_answer', version: 'v1 → v2' },
      diff: {
        before: { boundary: '[180, 220]' },
        after: { boundary: '[190, 210]' },
        changeSummary: [
          { field: 'boundary', oldValue: '[180, 220]', newValue: '[190, 210]' },
        ],
      },
    },
    {
      id: generateId(),
      sessionId,
      actionType: 'caliber_change_detected',
      description: '检测到材料口径变更，变化率约9.1%，已自动记录',
      operator: '系统',
      timestamp: baseTime - 3300000,
      metadata: { changeRate: 0.091, materialId: historicalId },
    },
    {
      id: generateId(),
      sessionId,
      actionType: 'material_upload',
      description: '上传边界样本：两组参数对照',
      operator: '数学老师老叶',
      timestamp: baseTime - 3000000,
      metadata: { materialType: 'boundary_sample', materialName: boundaryMaterial.name },
    },
    {
      id: generateId(),
      sessionId,
      actionType: 'material_upload',
      description: '上传临时口头说明：老叶补充',
      operator: '数学老师老叶',
      timestamp: baseTime - 2700000,
      metadata: { materialType: 'verbal_note', materialName: verbalMaterial.name },
    },
    {
      id: generateId(),
      sessionId,
      actionType: 'computation_start',
      description: '开始计算：第一组参数（20°C）劲度系数',
      operator: '现场老师',
      timestamp: baseTime - 2400000,
      metadata: { formula: '(F₂ - F₁) / (x₂ - x₁)', temperature: '20°C' },
    },
    {
      id: generateId(),
      sessionId,
      actionType: 'computation_complete',
      description: `完成计算：第一组k₁ = ${result1.finalResult.toFixed(2)} N/m`,
      operator: '系统',
      timestamp: baseTime - 2300000,
      metadata: { result: `${result1.finalResult.toFixed(2)} N/m`, boundaryCheck: result1.boundaryPassed ? 'PASSED' : 'FAILED' },
    },
    {
      id: generateId(),
      sessionId,
      actionType: 'computation_start',
      description: '开始计算：第二组参数（30°C）劲度系数',
      operator: '现场老师',
      timestamp: baseTime - 2100000,
      metadata: { formula: '(F₂ - F₁) / (x₂ - x₁)', temperature: '30°C' },
    },
    {
      id: generateId(),
      sessionId,
      actionType: 'computation_complete',
      description: `完成计算：第二组k₂ = ${result2.finalResult.toFixed(2)} N/m`,
      operator: '系统',
      timestamp: baseTime - 2000000,
      metadata: { result: `${result2.finalResult.toFixed(2)} N/m`, boundaryCheck: result2.boundaryPassed ? 'PASSED' : 'FAILED' },
    },
    {
      id: generateId(),
      sessionId,
      actionType: 'generate_report',
      description: '生成误差传播边界复核报告（含两组参数对照）',
      operator: '现场老师',
      timestamp: baseTime - 1800000,
      metadata: { reportType: 'markdown', parameterGroups: 2 },
    },
  ];

  const materials = [historicalMaterial, boundaryMaterial, verbalMaterial];

  console.log('[DemoData] createParameterCompareDemoSession: generating report');
  const report = reportGenerator.generate(
    session,
    materials,
    allSteps,
    auditLogs,
    '现场老师'
  );
  console.log('[DemoData] createParameterCompareDemoSession: report generated, content length=', report.content?.length);

  console.log('[DemoData] createParameterCompareDemoSession: returning StoredSession (save will be async)');
  return {
    session,
    materials,
    computationSteps: allSteps,
    auditLogs,
    suspendedTasks: [],
    report,
  };
}
