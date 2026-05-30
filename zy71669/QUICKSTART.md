# 厨房油烟扩散模拟系统 - 快速开始指南

## 🚀 5分钟从零到报告

### 1. 生成示例配置
```bash
npm run example
# 或
npx ts-node src/cli/index.ts example
```
这会在 `examples/basic-kitchen.json` 生成一个完整的厨房配置文件。

### 2. 运行模拟
```bash
npm run example:run
# 或
npx ts-node src/cli/index.ts run examples/basic-kitchen.json
```
完成后在 `output/` 目录查看结果：
- `kitchen-001-report.html` - 完整HTML报告
- `kitchen-001-heatmap.svg` - 热力图
- `kitchen-001-result.json` - 原始数据

### 3. 对比两个方案
```bash
npm run example:compare
# 或
npx ts-node src/cli/index.ts compare examples/basic-kitchen.json examples/high-airflow.json
```

### 4. 验证方案合规性
```bash
npx ts-node src/cli/index.ts validate examples/basic-kitchen.json
```

## 📋 CLI命令参考

| 命令 | 功能 | 示例 |
|------|------|------|
| `run <file>` | 运行模拟并生成报告 | `run input.json -o out/ -f html` |
| `compare <f1> <f2>` | 对比两个方案 | `compare v1.json v2.json` |
| `validate <file>` | 验证方案数据 | `validate plan.json` |
| `report <file>` | 仅生成报告 | `report plan.json -f markdown` |
| `example` | 生成示例配置 | `example -o my-kitchen.json` |

### 常用选项
- `-o, --output <dir>`: 输出目录 (默认: ./output)
- `-f, --format <format>`: 报告格式 (html/markdown/json)
- `--no-heatmap`: 不生成热力图

## 🏗️ 项目结构

```
.
├── src/
│   ├── cli/index.ts           # CLI入口
│   ├── types/index.ts         # 类型定义
│   ├── simulation/
│   │   ├── engine.ts          # 核心模拟引擎
│   │   └── comparison.ts      # 方案对比
│   ├── validation/rules.ts    # 验证规则系统
│   ├── visualization/
│   │   └── heatmap.ts         # 热力图渲染
│   ├── reporting/generator.ts # 报告生成
│   └── utils/units.ts         # 单位转换和常量
├── examples/                   # 示例配置
├── output/                     # 输出目录
└── package.json
```

## 🔧 核心概念

### 物理模型
- **扩散近似**: 使用简化的对流-扩散方程模拟油烟传播
- **网格采样**: 0.1-0.5m分辨率的网格离散化
- **浮力效应**: 热油烟上升导致的速度场修正

### 异常分类
| 类别 | 说明 | 示例 |
|------|------|------|
| 📊 **数据问题** | 输入数据格式错误 | 坐标超出边界、负值风量 |
| 📏 **规则问题** | 不符合设计规范 | 浓度超限、风量不足 |
| 📦 **材料问题** | 必要数据缺失 | 缺少灶位、版本信息不全 |

### 单位说明
| 量 | 单位 | 说明 |
|----|------|------|
| 长度 | m | 米 |
| 风量 | m³/h | 立方米/小时 |
| 浓度 | mg/m³ | 毫克/立方米 |
| 温度 | °C | 摄氏度 |

## 📝 配置文件说明

### 核心字段
```json
{
  "dimensions": { "width": 8, "height": 6, "unit": "m" },  // 厨房尺寸
  "gridResolution": 0.2,                                    // 网格分辨率
  "stoves": [],       // 灶位数组
  "exhaustVents": [], // 排烟口数组
  "detectionPoints": [], // 检测点数组
  "obstacles": [],    // 障碍物数组
  "version": {}       // 版本追踪信息
}
```

### 灶位类型
- `wok`: 炒锅 (高排放)
- `fryer`: 炸炉
- `grill`: 烤架
- `steamer`: 蒸箱 (低排放)
- `oven`: 烤箱

## 🎯 典型工作流

### 新建方案
1. 复制示例配置或使用 `example` 命令生成模板
2. 修改厨房尺寸、灶位、排烟口参数
3. 运行 `validate` 检查数据完整性
4. 运行 `run` 执行模拟
5. 查看报告和热力图
6. 根据异常建议调整参数
7. 重复步骤3-6直到方案达标

### 方案迭代
1. 复制现有配置文件，更新版本号
2. 修改参数（如增加风量、移动排烟口）
3. 使用 `compare` 对比新旧方案
4. 评估改进效果

## 🔍 异常处理

常见问题及解决：

| 异常 | 类别 | 解决方案 |
|------|------|----------|
| 风量低于推荐值70% | 规则问题 | 增加排烟口风量或数量 |
| 灶位距离排烟口过远 | 规则问题 | 调整排烟口位置到灶位上方 |
| 检测点浓度超限 | 规则问题 | 优化排烟口布局，增加风量 |
| 障碍物重叠 | 数据问题 | 调整障碍物坐标 |
| 版本信息不完整 | 材料问题 | 填写创建人/修改人信息 |

## 📊 结果解读

### 统计指标
- **最大浓度**: 油烟峰值，需关注是否超限
- **平均浓度**: 整体空气质量
- **排风效率**: 排烟系统综合效率 (目标: >80%)
- **总风量**: 系统总排风量

### 热力图解读
- 🔵 蓝色区域: 浓度低 (理想)
- 🟢 绿色区域: 浓度中等
- 🟡 黄色区域: 浓度偏高
- 🔴 红色区域: 浓度高 (需优化)

### 检测点状态
- ✅ 正常: 浓度在阈值内
- ❌ 超限: 浓度超过阈值，需要整改

## 💡 最佳实践

1. **网格分辨率**: 0.2m是精度和速度的良好平衡
2. **排烟口位置**: 尽量覆盖灶位正上方
3. **风量匹配**: 炒锅建议3000m³/h/台，炸炉2500m³/h/台
4. **检测点设置**: 在厨师呼吸区(灶前1.5m)、入口、备餐区设点
5. **版本管理**: 每次修改都更新版本号和备注

## 🛠️ 扩展开发

### 添加新的验证规则
编辑 `src/validation/rules.ts`，在 `validationRules` 数组中添加新规则。

### 自定义热力图配色
编辑 `src/visualization/heatmap.ts` 中的 `COLOR_SCHEMES`。

### 调整模拟参数
编辑 `src/simulation/engine.ts` 中的 `DEFAULT_CONFIG`：
- `maxIterations`: 最大迭代次数
- `diffusionFactor`: 扩散系数
- `advectionFactor`: 对流系数

---

**需要帮助？** 先看示例配置 `examples/basic-kitchen.json`，然后跑一遍 `npm run example`，对着输出理解每个字段的作用。
