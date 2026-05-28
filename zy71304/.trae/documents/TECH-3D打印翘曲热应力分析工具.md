## 1. 架构设计

本项目为纯前端单页应用，所有计算和数据存储均在浏览器端完成，无需后端服务。采用React组件化架构，Zustand进行状态管理，ECharts实现数据可视化。

```mermaid
graph TD
    A["React UI层"] --> B["状态管理层(Zustand)"]
    B --> C["业务逻辑层"]
    C --> D["数据校验模块"]
    C --> E["热应力计算模块"]
    C --> F["建议生成模块"]
    A --> G["图表可视化(ECharts)"]
    B --> H["本地持久化(localStorage)"]
    I["Mock数据"] --> B
```

## 2. 技术描述

- **前端框架**: React@18 + TypeScript
- **构建工具**: Vite@5
- **样式方案**: TailwindCSS@3
- **状态管理**: Zustand@4
- **图表库**: ECharts@5
- **图标库**: lucide-react
- **路由**: react-router-dom@6
- **数据持久化**: localStorage
- **无后端服务**: 所有计算在前端完成，mock数据内置

## 3. 路由定义

| 路由 | 页面名称 | 组件路径 |
|------|----------|----------|
| `/` | 参数录入页 | `src/pages/ParameterInput.tsx` |
| `/analysis` | 应力分析页 | `src/pages/StressAnalysis.tsx` |
| `/tracking` | 问题追踪页 | `src/pages/IssueTracking.tsx` |
| `/compare` | 参数对比页 | `src/pages/ParameterCompare.tsx` |
| `/report` | 报告导出页 | `src/pages/ReportExport.tsx` |

## 4. 数据模型

### 4.1 数据模型定义

```mermaid
erDiagram
    MATERIAL ||--o{ PRINT_BATCH : "使用"
    PRINT_BATCH ||--o{ STRESS_RESULT : "生成"
    PRINT_BATCH ||--o{ ISSUE_TRACK : "关联"
    PRINT_BATCH ||--o{ CORRECTION : "包含"
    
    MATERIAL {
        string id "材料ID"
        string name "材料名称"
        float thermalExpansionCoeff "热膨胀系数(μm/m·°C)"
        float glassTransitionTemp "玻璃化转变温度(°C)"
        float meltingTemp "熔化温度(°C)"
        float adhesionStrength "粘附力评级(1-5)"
        float recommendedBedTemp "推荐床温(°C)"
        float recommendedNozzleTemp "推荐喷嘴温度(°C)"
    }
    
    PRINT_BATCH {
        string id "批次ID"
        string materialId "材料ID"
        float bedTemp "床温(°C)"
        float nozzleTemp "喷嘴温度(°C)"
        float ambientTemp "环境温度(°C)"
        float modelWidth "模型宽度(mm)"
        float modelHeight "模型高度(mm)"
        float modelDepth "模型深度(mm)"
        string widthUnit "宽度单位"
        string heightUnit "高度单位"
        string depthUnit "深度单位"
        float coolingFanSpeed "冷却风扇转速(%)"
        float layerHeight "层高(mm)"
        float printSpeed "打印速度(mm/s)"
        datetime createdAt "创建时间"
        string status "状态"
    }
    
    STRESS_RESULT {
        string id "结果ID"
        string batchId "批次ID"
        float temperatureDiff "温差(°C)"
        float tempDiffSign "温差符号(1/-1)"
        float shrinkageRate "收缩率(%)"
        float totalShrinkage "总收缩量(mm)"
        float stressRiskScore "应力风险评分(0-100)"
        string riskLevel "风险等级"
        json stressDistribution "应力分布数据"
        json temperatureCurve "温度曲线数据"
        string tempDiffSignError "温差符号错误标记"
        string materialParamMissing "材料参数缺失标记"
        string unitMixed "单位混用标记"
    }
    
    ISSUE_TRACK {
        string id "追踪ID"
        string batchId "批次ID"
        string issueType "问题类型"
        string description "问题描述"
        string detailRowId "关联明细行ID"
        string discoveredBy "发现人"
        datetime discoveredAt "发现时间"
        string status "状态(discovered/corrected/confirmed)"
    }
    
    CORRECTION {
        string id "修正ID"
        string issueTrackId "追踪ID"
        string suggestion "修正建议"
        json adjustedParams "调整后参数"
        float expectedImprovement "预期改善率(%)"
        string correctedBy "修正人"
        datetime correctedAt "修正时间"
        string confirmationResult "确认结果"
        string confirmedBy "确认人"
        datetime confirmedAt "确认时间"
    }
```

### 4.2 核心计算逻辑

#### 热收缩估算公式
```
收缩率 = 热膨胀系数 × (喷嘴温度 - 环境温度) × 10^-4
总收缩量 = 模型尺寸 × 收缩率
```

#### 应力风险评分
```
基础分 = 收缩率权重 × 收缩率 + 温差权重 × 温差 + 尺寸权重 × 模型尺寸
冷却惩罚 = 冷却速度过快惩罚系数
床温补偿 = 床温接近玻璃化转变温度的奖励系数
风险评分 = MAX(0, MIN(100, 基础分 + 冷却惩罚 - 床温补偿))
```

#### 三类错误检测口径

1. **温差符号错误**：
   - 检测条件：喷嘴温度 < 床温 或 床温 < 环境温度
   - 处理口径：单独标注符号方向，展示正确的温度梯度逻辑（喷嘴 > 床温 > 环境），提供一键修正

2. **材料参数缺失**：
   - 检测条件：材料热膨胀系数为空或为0
   - 处理口径：列出具体缺失字段，提供该材料的标准参数参考值，支持一键填充

3. **尺寸单位混用**：
   - 检测条件：长宽高三个维度使用不同单位
   - 处理口径：识别各维度单位，展示单位转换对比表，支持一键转换为统一单位（默认mm）

## 5. 目录结构

```
src/
├── components/          # 可复用组件
│   ├── ParameterForm/   # 参数表单组件
│   ├── StressChart/     # 应力图表组件
│   ├── IssueTimeline/   # 问题时间轴组件
│   ├── CompareTable/    # 参数对比表格
│   ├── ReportPreview/   # 报告预览组件
│   └── DataValidation/  # 数据校验组件
├── pages/               # 页面组件
│   ├── ParameterInput.tsx
│   ├── StressAnalysis.tsx
│   ├── IssueTracking.tsx
│   ├── ParameterCompare.tsx
│   └── ReportExport.tsx
├── store/               # Zustand状态
│   └── usePrintStore.ts
├── utils/               # 工具函数
│   ├── stressCalculator.ts    # 应力计算
│   ├── dataValidator.ts       # 数据校验
│   ├── suggestionEngine.ts    # 建议生成
│   ├── unitConverter.ts       # 单位转换
│   └── exportUtils.ts         # 导出工具
├── types/               # TypeScript类型
│   └── index.ts
├── data/                # Mock数据
│   ├── materials.ts     # 材料数据
│   └── mockBatches.ts   # 历史批次数据
├── App.tsx
├── main.tsx
└── index.css
```

## 6. 核心模块技术要点

### 6.1 可交互应力热力图
- 使用ECharts heatmap系列，自定义tooltip展示明细数据
- 点击热力图单元格触发事件，定位到对应明细数据行
- 实现等高线式的风险等级渐变色彩

### 6.2 图表联动
- 热力图、温度曲线、数据表格三者联动
- 选中某一区域时，其他图表同步高亮对应数据范围

### 6.3 本地数据持久化
- 使用localStorage存储历史分析记录
- 实现自动保存和版本管理
- 支持导入/导出JSON格式的分析数据

### 6.4 三段式问题追踪
- 时间轴组件展示"发现-修正-确认"全流程
- 每个阶段支持添加备注和附件（图片URL）
- 状态变更时自动记录时间戳和操作人
