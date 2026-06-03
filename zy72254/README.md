# 消防疏散路线推演系统

## 概述

本系统用于消防疏散路线的推演和障碍物管理，重点解决**同一障碍物被标了两个名字**的问题。所有边界规则已固化在代码中，不依赖口头约定。

---

## 核心边界规则（代码已实现）

### 一、同一障碍物多名称问题处理

#### 判定规则（代码位置：[BoundaryRules.ts](file:///Users/lzy/pro/solo/workspaces/zy72254/src/core/BoundaryRules.ts)）

系统自动检测以下情况判定为"同一障碍物被标了两个名字"：

1. **名称归一化匹配**（[normalizeName](file:///Users/lzy/pro/solo/workspaces/zy72254/src/core/BoundaryRules.ts#L52-L68)）
   - 自动忽略大小写、空格、下划线、横杠
   - 例如："消防栓_1"、"消防栓-1"、"消防栓 1"、"消防栓1" 判定为同一名称

2. **几何重叠检测**（[checkOverlappingGeometry](file:///Users/lzy/pro/solo/workspaces/zy72254/src/core/BoundaryRules.ts#L165-L189)）
   - 两个障碍物边界框重叠率 ≥ 80%
   - 或两个障碍物中心点距离 ≤ 0.5米

3. **检测时机**（[detectConflicts](file:///Users/lzy/pro/solo/workspaces/zy72254/src/core/BoundaryRules.ts#L70-L133)）
   - CAD图层导入后自动检测
   - 每次数据变更后重新检测

#### 修改规则（代码位置：[resolveConflict](file:///Users/lzy/pro/solo/workspaces/zy72254/src/core/BoundaryRules.ts#L191-L268)）

检测到冲突后，提供四种处理方式：

| 处理方式 | 说明 | 适用场景 |
|---------|------|---------|
| **合并为一个** | 合并两个障碍物的所有信息，保留全部名称、CAD图层、测距仪记录 | 确认为同一物体 |
| **保留第一个** | 保留先导入的，标记第二个为重复 | 先导入的更准确 |
| **保留第二个** | 保留后导入的，覆盖第一个 | 后导入的更准确 |
| **留待复核** | 不自动处理，保留冲突状态 | 需要培训学员人工确认 |

> **重要**：冲突默认状态为 `pending_review`（待复核），**不会自动归为正常**，必须人工确认。

#### 回滚规则（代码位置：[rollbackMerge](file:///Users/lzy/pro/solo/workspaces/zy72254/src/core/BoundaryRules.ts#L331-L353)）

1. 所有合并操作均保留快照，支持一键回滚
2. 回滚后恢复两个独立的障碍物，所有数据完整还原
3. 回滚操作本身也会被记录到历史

---

### 二、重复导入CAD图层规则（代码位置：[CADImporter.ts](file:///Users/lzy/pro/solo/workspaces/zy72254/src/core/CADImporter.ts)）

1. **同一批次重复导入**（[importCADLayer](file:///Users/lzy/pro/solo/workspaces/zy72254/src/core/CADImporter.ts#L74-L141)）
   - 按 `来源:图层名` 做去重键
   - 已处理的图层直接跳过，**不会造成数量翻倍**

2. **跨批次重复导入**（[reimportSameLayers](file:///Users/lzy/pro/solo/workspaces/zy72254/src/core/CADImporter.ts#L188-L209)）
   - 检测到已存在的图层时执行增量更新
   - 新增CAD图层信息到现有障碍物，不创建新障碍物
   - 返回明确的跳过数量提示

3. **导入摘要**（[ImportSummary](file:///Users/lzy/pro/solo/workspaces/zy72254/src/types/index.ts#L133-L139)）
   - 每次导入返回：新增数、更新数、跳过数、冲突数

---

### 三、历史记录规则（代码位置：[HistoryTracker.ts](file:///Users/lzy/pro/solo/workspaces/zy72254/src/core/HistoryTracker.ts)）

1. **变更追踪**（[trackObstructionUpdate](file:///Users/lzy/pro/solo/workspaces/zy72254/src/core/HistoryTracker.ts#L65-L95)）
   - 记录每个字段的修改前后值
   - 小魏改了一条备注，历史里能看出：`备注: 旧内容 → 新内容`

2. **差异对比**（[compareVersions](file:///Users/lzy/pro/solo/workspaces/zy72254/src/core/HistoryTracker.ts#L309-L339)）
   - 支持任意两个版本的完整对比
   - 输出人性化的差异描述，不用翻内部字段

3. **回滚支持**
   - 每条历史记录标记 `rollbackAvailable`
   - 回滚后标记为已使用，防止重复回滚

---

### 四、3D/图表展示溯源规则（代码位置：[DisplayService.ts](file:///Users/lzy/pro/solo/workspaces/zy72254/src/core/DisplayService.ts)）

1. **服务复核机制**（[getSourceTrace](file:///Users/lzy/pro/solo/workspaces/zy72254/src/core/DisplayService.ts#L170-L190)）
   - 3D视图或图表中的每一个元素，点击后必须能回溯到：
     - 原始CAD图层名（含导入时间、导入来源）
     - 测距仪记录（含测量人、测量时间、测量距离）
     - 所有曾用名称列表

2. **冲突可视化**（[render3D](file:///Users/lzy/pro/solo/workspaces/zy72254/src/core/DisplayService.ts#L103-L117)）
   - 有名称冲突的障碍物用红色标记
   - 悬停显示冲突描述："同一障碍物被标记了两个名称，需要培训学员复核确认"

3. **源数据验证**（[verifyDisplaySource](file:///Users/lzy/pro/solo/workspaces/zy72254/src/core/DisplayService.ts#L192-L224)）
   - 每个显示元素都可验证其数据来源
   - 禁止"只剩漂亮画面"而丢失原始数据链路

---

### 五、错误提示规则（代码位置：[ErrorHandler.ts](file:///Users/lzy/pro/solo/workspaces/zy72254/src/core/ErrorHandler.ts)）

所有错误提示必须包含三部分，**禁止只吐内部字段名**：

1. **人话错误信息**：直接说问题
2. **操作建议**：告诉用户怎么办
3. **详细信息**：必要的上下文

#### 错误示例

| 不推荐（内部字段） | 推荐（人话） |
|------------------|-------------|
| `obstruction_id conflicts with existing` | `发现障碍物名称冲突，请点击冲突标记查看详情，选择合并、保留或留待培训学员复核` |
| `layer_name duplicate` | `检测到重复导入的CAD图层，系统已自动跳过，请检查导入源确认是否需要更新现有数据` |
| `status invalid for operation` | `在"存在待复核冲突"状态下不能执行"更新三维视图"操作，请先处理所有冲突` |

---

## 标准三步工作流程（代码位置：[ProcessOrchestrator.ts](file:///Users/lzy/pro/solo/workspaces/zy72254/src/core/ProcessOrchestrator.ts)）

### 第一步：CAD图层名第一次导入

```typescript
const result = await orchestrator.step1_importCADLayers(
  rawCADLayers,    // 原始CAD图层数据
  '小魏',          // 操作人
  'B栋三楼施工图.dwg'  // 导入来源
);
```

**自动处理**：
- 为每个图层创建障碍物记录
- 自动检测名称冲突
- 冲突障碍物标记为 `pending_review`，**不自动归正常**
- 返回待复核列表给培训学员

---

### 第二步：航测内业小魏补看测距仪记录

```typescript
const result = await orchestrator.step2_supplementRangefinder(
  [
    {
      obstructionId: 'obs_xxx',
      measuredBy: '小魏',
      distance: 5.23,
      fromPoint: { x: 0, y: 0, z: 0 },
      toPoint: { x: 5.23, y: 0, z: 0 },
      notes: '距离疏散门5.23米，影响通行'
    }
  ],
  '小魏'  // 操作人
);
```

**自动处理**：
- 验证测距仪数据有效性（距离与坐标匹配）
- 将测距仪记录关联到对应障碍物
- 记录历史变更，备注修改可追溯
- 仍有冲突时禁止进入下一步，提示"需要培训学员复核"

---

### 第三步：三维标注视图更新

```typescript
const result = await orchestrator.step3_update3DView(
  DisplayMode.VIEW_3D,  // 或 DisplayMode.CHART
  '培训学员'            // 操作人
);
```

**前置检查**：
- 所有冲突必须已处理（状态不是 `pending_review`）
- 通过后才能渲染3D视图或图表
- 每个显示元素保留完整溯源链路

---

## 快速开始

### 安装依赖
```bash
npm install
```

### 构建
```bash
npm run build
```

### 运行测试
```bash
npm test
```

### 类型检查
```bash
npm run typecheck
```

---

## 使用示例

```typescript
import {
  FireEvacuationSimulation,
  DisplayMode,
  ConflictResolution,
  RawCADLayer
} from './src';

// 1. 初始化系统
const sim = new FireEvacuationSimulation();

// 2. 准备CAD图层数据（模拟从DWG导入）
const cadLayers: RawCADLayer[] = [
  {
    layerName: '消防栓-001',
    originalName: '消防栓-001',
    geometry: [
      { x: 10, y: 20, z: 0 },
      { x: 12, y: 20, z: 0 },
      { x: 12, y: 22, z: 0 },
      { x: 10, y: 22, z: 0 }
    ],
    isOnEvacuationRoute: true,
    hazardLevel: 'medium'
  },
  {
    layerName: '消防栓_001',  // 同一障碍物，不同命名
    originalName: '消防栓_001',
    geometry: [
      { x: 10, y: 20, z: 0 },
      { x: 12, y: 20, z: 0 },
      { x: 12, y: 22, z: 0 },
      { x: 10, y: 22, z: 0 }
    ],
    isOnEvacuationRoute: true,
    hazardLevel: 'medium'
  }
];

// 3. 第一步：导入CAD图层
const step1 = await sim.step1_importCADLayers(cadLayers, '小魏', 'B栋三楼.dwg');
console.log('冲突数量:', step1.data?.conflictCount);  // 应该是1

// 4. 查看待复核项
if (step1.requiresReview && step1.reviewItems) {
  for (const item of step1.reviewItems) {
    console.log('待复核:', item.conflictingNames, '-', item.description);
  }
}

// 5. 培训学员复核并处理冲突
const conflict = step1.data!.obstructions.find(o => o.conflictInfo);
const other = step1.data!.obstructions.find(
  o => o.id !== conflict!.id && o.conflictInfo
);

const resolveResult = await sim.resolvePendingConflict(
  conflict!.id,
  other!.id,
  ConflictResolution.MERGE,    // 合并为一个
  '培训学员',
  '消防栓001'                   // 规范名称
);

// 6. 第二步：小魏补充测距仪记录
const step2 = await sim.step2_supplementRangefinder(
  [
    {
      obstructionId: resolveResult.data!.primary.id,
      measuredBy: '小魏',
      distance: 3.5,
      fromPoint: { x: 0, y: 0, z: 0 },
      toPoint: { x: 3.5, y: 0, z: 0 },
      notes: '离安全出口3.5米，阻碍宽度0.8米'
    }
  ],
  '小魏'
);

// 7. 小魏改备注（历史可查）
await sim.updateObstructionNotes(
  resolveResult.data!.primary.id,
  '经现场复核，确认为同一消防栓，合并后名称：消防栓001',
  '小魏'
);

// 8. 查看历史记录
const history = sim.getObstructionHistory(resolveResult.data!.primary.id);
console.log('变更历史:', history.map(h => h.diffDescription));

// 9. 第三步：更新3D视图
const step3 = await sim.step3_update3DView(DisplayMode.VIEW_3D, '培训学员');

// 10. 点击3D元素，溯源原始数据
const detail = await sim.selectItemForReview(
  resolveResult.data!.primary.id,
  'obstruction'
);
console.log('原始CAD图层:', detail.data?.sourceTrace.cadLayers);
console.log('测距仪记录:', detail.data?.sourceTrace.rangefinderRecords);
```

---

## 目录结构

```
src/
├── types/
│   └── index.ts              # 所有类型定义
├── models/
│   ├── ObstructionModel.ts   # 障碍物模型
│   ├── EvacuationRouteModel.ts # 疏散路线模型
│   └── RangefinderModel.ts   # 测距仪记录模型
├── core/
│   ├── BoundaryRules.ts      # ⭐ 边界规则（冲突检测、合并、回滚）
│   ├── CADImporter.ts        # CAD图层导入（防重复）
│   ├── HistoryTracker.ts     # 历史记录（变更追踪、差异对比）
│   ├── DisplayService.ts     # 3D/图表展示（带溯源）
│   ├── ErrorHandler.ts       # 错误提示（人话）
│   └── ProcessOrchestrator.ts# 三步流程编排
├── utils/
│   └── idGenerator.ts        # ID生成器
└── index.ts                  # 入口文件
```

---

## 关键参数配置（[BoundaryRules.ts](file:///Users/lzy/pro/solo/workspaces/zy72254/src/core/BoundaryRules.ts#L21-L29)）

```typescript
export const BOUNDARY_RULES = {
  GEOMETRY_OVERLAP_THRESHOLD: 0.8,    // 几何重叠率阈值80%
  POSITION_PROXIMITY_THRESHOLD: 0.5,  // 位置接近阈值0.5米
  NAME_NORMALIZATION: {
    TRIM_SPACES: true,                // 去除空格
    CASE_INSENSITIVE: true,           // 忽略大小写
    REMOVE_SPECIAL_CHARS: true        // 去除特殊字符
  }
};
```

---

## 注意事项

1. **十分钟原则**：系统设计优先考虑培训学员开会前的快速使用
   - 冲突检测自动完成，不用翻CAD图层名
   - 错误提示直接说问题，不用查文档
   - 三步流程清晰，不用理解内部逻辑

2. **复核优先原则**：
   - 所有冲突默认待复核，不自动处理
   - 留足时间给培训学员确认，不急于归正常

3. **数据可追溯原则**：
   - 每个数据都能回溯到原始来源（CAD或测距仪）
   - 每次修改都有历史记录
   - 关键操作支持回滚

---

## 边界规则检查清单

✅ 同一障碍物多名称自动检测  
✅ 冲突处理四种方式（合并/保留1/保留2/留待复核）  
✅ 合并操作支持回滚  
✅ 重复导入CAD不翻倍  
✅ 历史记录显示改前改后差异  
✅ 3D/图表点击可溯源到CAD和测距仪  
✅ 错误提示说人话  
✅ 三步流程强制顺序  
✅ 冲突未解决不能进入下一步  
✅ 所有规则同时写在代码和README中
