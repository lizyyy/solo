# 三维配载复核工具

一个基于 Vite + TypeScript + React Three Fiber 的小型货船三维配载复核工具。

## 功能特性

- 📦 **文件导入**: 支持导入 `bays.json`、`cargo_manifest.csv` 和 `stability_rules.yaml`
- 🎯 **3D 可视化**: 使用 Three.js 渲染舱位和货箱的三维视图
- 🖱️ **交互配载**: 点击选择货箱和舱位，分配货物位置
- 📊 **实时计算**: 实时计算总重、重心、左右/前后平衡
- ⚠️ **规则校验**: 检测舱位超载和危险品隔离冲突
- ↩️ **撤销/重做**: 支持操作历史回退
- 💾 **保存方案**: 保存配载方案到本地存储
- 📝 **导出报告**: 生成 Markdown 格式的配载报告

## 技术架构

```
src/
├── types/          # 类型定义
├── parsers/        # 文件解析模块
│   ├── baysParser.ts      # bays.json 解析
│   ├── cargoParser.ts     # cargo_manifest.csv 解析
│   └── rulesParser.ts     # stability_rules.yaml 解析
├── calculator/     # 规则计算模块
│   └── stowageCalculator.ts  # 配载计算逻辑
├── store/          # 状态持久化模块
│   └── stowageStore.ts     # 状态管理和导出功能
├── components/     # UI 组件
│   ├── Scene/      # 3D 渲染组件
│   │   ├── StowageScene.tsx
│   │   ├── BayMesh.tsx
│   │   └── CargoMesh.tsx
│   └── UI/         # 界面组件
│       ├── FileImport.tsx
│       ├── ControlPanel.tsx
│       ├── CalculationPanel.tsx
│       └── SavePanel.tsx
└── tests/          # 测试文件
```

## 安装与运行

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build

# 运行测试
npm test
```

## 使用方法

### 导入数据文件

点击「导入文件」按钮，选择以下三个文件：

1. **bays.json** - 舱位配置文件
2. **cargo_manifest.csv** - 货物清单
3. **stability_rules.yaml** - 稳定性规则

或者点击「加载示例数据」按钮使用内置的示例数据。

### 配载操作

1. 从左侧「未配载货物」列表中选择一个货箱
2. 从「舱位列表」中选择目标舱位
3. 点击「分配到舱位」按钮完成配载
4. 使用「移除配载」按钮取消已配载的货物
5. 使用「撤销」/「重做」按钮回退或恢复操作

### 查看计算结果

右侧面板实时显示：
- 总重量
- 重心坐标 (X/Y/Z)
- 左右平衡
- 前后平衡
- 超载警告
- 危险品隔离冲突

### 导出报告

点击「导出报告」按钮生成 `load_plan_report.md` 文件。

## 文件格式说明

### bays.json

```json
[
  {
    "id": "bay-1",
    "name": "A1",
    "position": { "x": -8, "y": 0, "z": -5 },
    "dimensions": { "width": 6, "height": 4, "depth": 8 },
    "maxWeight": 200,
    "isDeck": false
  }
]
```

### cargo_manifest.csv

```csv
containerNo,weight,category,dangerousClass,length,width,height
CSLU1234567,25,general,,12,2.4,2.6
DGXU9999991,15,dangerous,Class3,6,2.4,2.6
```

### stability_rules.yaml

```yaml
maxTotalWeight: 1000
maxDeckWeight: 300
maxCargoHoldWeight: 700
balanceLimits:
  maxPortStarboardDifference: 100
  maxForeAftDifference: 80
dangerousGoods:
  isolationDistance: 5
  Class3: Class8
  Class8: Class3
```

## 边界处理

- **缺失箱重**: 使用默认值 20 吨
- **重复箱号**: 在导入时检测并报告错误
- **无效数据**: 提供详细的解析错误信息

## License

MIT