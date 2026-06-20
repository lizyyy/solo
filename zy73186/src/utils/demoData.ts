import { persistenceService } from '@/services/persistence';
import { generateId } from '@/utils/hash';
import type { Session, Material, ComputationStep, AuditLog, SuspendedTask, Report } from '@/types';

export const initializeDemoData = async (): Promise<void> => {
  try {
    const now = Date.now();

    const demoSessionId = generateId();
    const historicalMaterialId = generateId();
    const boundaryMaterialId = generateId();
    const verbalMaterialId = generateId();

    const demoSession: Session = {
      id: demoSessionId,
      status: 'computing',
      createdAt: now - 3600000,
      updatedAt: now - 1800000,
      currentStep: 1,
      progress: {
        totalSteps: 3,
        currentStep: 1,
        completionPercentage: 66.67,
        recoveryPoints: [0, 1],
        lastSavedAt: now - 1800000,
        lastModifiedBy: '数学老师老叶',
      },
    };

    const historicalMaterial: Material = {
      id: historicalMaterialId,
      sessionId: demoSessionId,
      type: 'historical_answer',
      name: '2024年高考物理第12题参考答案',
      content: `## 2024年高考物理第12题参考答案

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

### 评分标准
- 第1问：4分，公式正确2分，结果正确2分
- 第2问：6分，有效值计算3分，欧姆定律应用3分
- 第3问：5分，功率公式2分，计算正确3分

**注意：单位换算错误扣1分，有效数字保留不当扣0.5分**`,
      contentHash: generateId(),
      version: 1,
      versions: [
        {
          id: generateId(),
          materialId: historicalMaterialId,
          version: 1,
          content: `## 2024年高考物理第12题参考答案

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

### 评分标准
- 第1问：4分，公式正确2分，结果正确2分
- 第2问：6分，有效值计算3分，欧姆定律应用3分
- 第3问：5分，功率公式2分，计算正确3分

**注意：单位换算错误扣1分，有效数字保留不当扣0.5分**`,
          contentHash: generateId(),
          timestamp: now - 3600000,
          createdAt: now - 3600000,
          createdBy: '数学老师老叶',
          diff: null,
        },
      ],
      hasCaliberChanged: false,
      createdAt: now - 3600000,
      updatedAt: now - 3600000,
    };

    const boundaryMaterial: Material = {
      id: boundaryMaterialId,
      sessionId: demoSessionId,
      type: 'boundary_sample',
      name: '边界样本-单位换算误差案例',
      content: `## 误差边界复核样本

### 样本描述
某同学在解答上述题目时，将线圈面积S=0.02m²误读为S=200cm²，在计算过程中进行了单位换算，但换算因子使用错误。

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
3. 给出正确的误差边界`,
      contentHash: generateId(),
      version: 1,
      versions: [
        {
          id: generateId(),
          materialId: boundaryMaterialId,
          version: 1,
          content: `## 误差边界复核样本

### 样本描述
某同学在解答上述题目时，将线圈面积S=0.02m²误读为S=200cm²，在计算过程中进行了单位换算，但换算因子使用错误。

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
3. 给出正确的误差边界`,
          contentHash: generateId(),
          timestamp: now - 3000000,
          createdAt: now - 3000000,
          createdBy: '数学老师老叶',
          diff: null,
        },
      ],
      hasCaliberChanged: false,
      createdAt: now - 3000000,
      updatedAt: now - 3000000,
    };

    const verbalMaterial: Material = {
      id: verbalMaterialId,
      sessionId: demoSessionId,
      type: 'verbal_note',
      name: '临时口头说明-老叶补充',
      content: `## 临时口头说明

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

如果发现学生有单位换算的习惯性错误，要在报告中特别指出，并给出针对性的改进建议。`,
      contentHash: generateId(),
      version: 1,
      versions: [
        {
          id: generateId(),
          materialId: verbalMaterialId,
          version: 1,
          content: `## 临时口头说明

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

如果发现学生有单位换算的习惯性错误，要在报告中特别指出，并给出针对性的改进建议。`,
          contentHash: generateId(),
          timestamp: now - 2400000,
          createdAt: now - 2400000,
          createdBy: '数学老师老叶',
          diff: null,
        },
      ],
      hasCaliberChanged: false,
      createdAt: now - 2400000,
      updatedAt: now - 2400000,
    };

    const step1: ComputationStep = {
      id: generateId(),
      sessionId: demoSessionId,
      stepOrder: 1,
      description: '感应电动势最大值计算',
      formula: 'Em = n * B * S * ω',
      inputValues: {
        n: { value: 100, unit: '匝', error: 0 },
        B: { value: 0.5, unit: 'T', error: 0.01 },
        S: { value: 0.02, unit: 'm²', error: 0.0001 },
        ω: { value: 314.16, unit: 'rad/s', error: 0.01 },
      },
      unitConversion: {
        originalUnit: 'cm²',
        targetUnit: 'm²',
        conversionFactor: 0.0001,
        intermediateValue: 0.02,
        formula: '200 cm² × 10⁻⁴ = 0.02 m²',
      },
      partialDerivatives: {
        n: 3.1416,
        B: 628.32,
        S: 15708,
        ω: 1,
      },
      errorContribution: {
        B: 6.2832,
        S: 1.5708,
        ω: 0.01,
      },
      result: 314.16,
      resultUnit: 'V',
      manuallyModified: false,
      createdAt: now - 2400000,
      updatedAt: now - 2400000,
    };

    const step2: ComputationStep = {
      id: generateId(),
      sessionId: demoSessionId,
      stepOrder: 2,
      description: '电路电流有效值计算',
      formula: 'I = (Em / √2) / (R + r)',
      inputValues: {
        Em: { value: 314.16, unit: 'V', error: 6.47 },
        R: { value: 9, unit: 'Ω', error: 0.1 },
        r: { value: 1, unit: 'Ω', error: 0.01 },
      },
      unitConversion: {
        originalUnit: 'V',
        targetUnit: 'V',
        conversionFactor: 1,
        intermediateValue: 314.16,
        formula: '无单位换算',
      },
      partialDerivatives: {
        Em: 0.07071,
        R: -2.2214,
        r: -2.2214,
      },
      errorContribution: {
        Em: 0.4575,
        R: 0.2221,
        r: 0.0222,
      },
      result: 22.214,
      resultUnit: 'A',
      manuallyModified: false,
      createdAt: now - 2100000,
      updatedAt: now - 2100000,
    };

    const auditLog1: AuditLog = {
      id: generateId(),
      sessionId: demoSessionId,
      actionType: 'material_upload',
      description: '上传历史答案文档：2024年高考物理第12题参考答案',
      operator: '数学老师老叶',
      timestamp: now - 3600000,
      metadata: {
        materialType: 'historical_answer',
        materialName: '2024年高考物理第12题参考答案',
      },
    };

    const auditLog2: AuditLog = {
      id: generateId(),
      sessionId: demoSessionId,
      actionType: 'material_upload',
      description: '上传边界样本：单位换算误差案例',
      operator: '数学老师老叶',
      timestamp: now - 3000000,
      metadata: {
        materialType: 'boundary_sample',
        materialName: '边界样本-单位换算误差案例',
      },
    };

    const auditLog3: AuditLog = {
      id: generateId(),
      sessionId: demoSessionId,
      actionType: 'computation_start',
      description: '开始计算：感应电动势最大值',
      operator: '现场老师',
      timestamp: now - 2400000,
      metadata: {
        formula: 'Em = n * B * S * ω',
        variables: 'n, B, S, ω',
      },
    };

    const auditLog4: AuditLog = {
      id: generateId(),
      sessionId: demoSessionId,
      actionType: 'computation_complete',
      description: '完成计算：感应电动势最大值 = 314.16 V',
      operator: '系统',
      timestamp: now - 2400000,
      metadata: {
        result: '314.16 V',
        unitConversion: 'cm² → m²',
      },
    };

    const suspendedTask: SuspendedTask = {
      id: generateId(),
      sessionId: demoSessionId,
      status: 'pending',
      reason: 'duplicate_sample',
      description: '检测到边界样本与2023年同类样本相似度为89.2%，已自动挂起等待确认',
      createdBy: '系统',
      createdAt: now - 1800000,
      duplicateInfo: {
        existingSessionId: generateId(),
        existingSampleHash: generateId(),
        newSampleHash: boundaryMaterial.contentHash,
        similarity: 0.892,
      },
    };

    await persistenceService.saveSession(demoSession);
    await persistenceService.saveMaterial(historicalMaterial);
    await persistenceService.saveMaterial(boundaryMaterial);
    await persistenceService.saveMaterial(verbalMaterial);
    await persistenceService.saveComputationStep(step1);
    await persistenceService.saveComputationStep(step2);
    await persistenceService.saveAuditLog(auditLog1);
    await persistenceService.saveAuditLog(auditLog2);
    await persistenceService.saveAuditLog(auditLog3);
    await persistenceService.saveAuditLog(auditLog4);
    await persistenceService.saveSuspendedTask(suspendedTask);

    console.log('Demo data initialized successfully');
  } catch (error) {
    console.error('Failed to initialize demo data:', error);
  }
};
