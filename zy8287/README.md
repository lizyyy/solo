# 会展运营复盘看板

一个基于 React + TypeScript + ECharts 的本地会展数据可视化看板，支持客流、成交数据的多维度聚合分析。

## 功能特性

### 数据导入与聚合
- 支持导入客流数据 (`events.csv`)、成交数据 (`orders.csv`)、展商数据 (`booths.json`)、时段目标 (`targets.csv`)
- 按展馆、摊位、时间段聚合客流、转化率、客单价和目标差距
- 自动计算目标达成率、差距百分比等关键指标

### 可视化组件
1. **时段趋势图** - 展示各时段客流量、订单数、成交额、转化率、客单价的变化趋势
2. **展馆热力图** - 按客流量分布展示各展馆热度
3. **摊位排行榜** - TOP10 排行（按成交额/客流量/转化率）
4. **数据明细表** - 支持排序、搜索、分页的详细数据表格

### 交互功能
- **图表联动** - 点击任一图表或选择筛选器时，其它图表和表格会同步更新
- **多维筛选** - 支持按展馆、时段、行业进行多维度筛选
- **筛选保存** - 支持保存和加载常用筛选口径
- **筛选重置** - 一键清除所有筛选条件

### 数据导出
- **导出为 PNG** - 将当前可视区域导出为图片
- **导出为 CSV** - 导出筛选后的汇总数据
- **导出为 Excel** - 导出筛选后的汇总数据 + 客流明细 + 订单明细（多 Sheet）

### 边界情况处理
- **空筛选结果** - 当筛选条件无匹配数据时，展示友好提示并提供重置按钮
- **重复订单号** - 自动检测重复订单号并展示警告提示，数据处理时自动去重

## 技术栈

- **前端框架**: React 18 + TypeScript
- **构建工具**: Vite
- **图表库**: ECharts + echarts-for-react
- **样式框架**: Tailwind CSS
- **数据处理**:
  - PapaParse (CSV 解析)
  - SheetJS (Excel 导出)
  - html2canvas (PNG 导出)

## 项目结构

```
zy8287/
├── src/
│   ├── components/          # 组件目录
│   │   ├── BoothRanking.tsx          # 摊位排行组件
│   │   ├── DataImportModal.tsx       # 数据导入模态框
│   │   ├── DataTable.tsx             # 数据明细表格
│   │   ├── FilterPanel.tsx           # 筛选面板
│   │   ├── HallHeatmap.tsx           # 展馆热力图
│   │   ├── SaveFilterModal.tsx       # 保存筛选模态框
│   │   ├── TimeSlotTrendChart.tsx    # 时段趋势图
│   │   └── WarningAlert.tsx          # 警告提示
│   ├── context/             # 状态管理
│   │   └── DashboardContext.tsx      # Dashboard Context
│   ├── data/                # 示例数据
│   │   ├── booths.json      # 展商数据
│   │   ├── events.csv       # 客流数据
│   │   ├── orders.csv       # 成交数据（含重复订单示例）
│   │   └── targets.csv      # 时段目标
│   ├── pages/               # 页面
│   │   └── Dashboard.tsx    # 主看板页面
│   ├── types/               # 类型定义
│   │   └── index.ts
│   ├── utils/               # 工具函数
│   │   ├── dataAggregator.ts    # 数据聚合
│   │   ├── dataParser.ts        # 数据解析
│   │   └── exportUtils.ts       # 导出工具
│   ├── App.tsx              # 根组件
│   ├── main.tsx             # 入口文件
│   └── index.css            # 全局样式
├── index.html               # HTML 模板
├── package.json             # 依赖配置
├── tailwind.config.js       # Tailwind 配置
├── tsconfig.json            # TypeScript 配置
├── vite.config.ts           # Vite 配置
└── README.md                # 本文档
```

## 快速开始

### 环境要求
- Node.js >= 18.0.0
- npm >= 9.0.0 或 yarn >= 1.22.0

### 安装依赖

```bash
npm install
```

或使用 yarn：

```bash
yarn install
```

### 本地开发启动

```bash
npm run dev
```

或使用 yarn：

```bash
yarn dev
```

启动后，浏览器会自动打开 `http://localhost:3000`

### 本地预览（生产构建）

```bash
# 构建生产版本
npm run build

# 预览构建结果
npm run preview
```

或使用 yarn：

```bash
yarn build
yarn preview
```

## 数据格式说明

### 客流数据 (events.csv)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 事件唯一标识 |
| timestamp | string | 时间戳 |
| timeSlot | string | 时段（如：09:00-10:00） |
| hallId | string | 展馆 ID |
| boothId | string | 摊位 ID |
| visitorId | string | 访客 ID |
| entryType | string | 入场方式（scan/manual/camera） |
| duration | number | 停留时长（分钟） |

### 成交数据 (orders.csv)

| 字段 | 类型 | 说明 |
|------|------|------|
| orderId | string | 订单号 |
| timestamp | string | 时间戳 |
| timeSlot | string | 时段 |
| hallId | string | 展馆 ID |
| boothId | string | 摊位 ID |
| visitorId | string | 访客 ID |
| amount | number | 成交金额 |
| productCategory | string | 产品类别 |
| paymentMethod | string | 支付方式 |
| status | string | 订单状态（completed/refunded/pending） |

### 展商数据 (booths.json)

```json
[
  {
    "boothId": "B001",
    "hallId": "H1",
    "hallName": "1号展馆",
    "boothName": "智能科技A区",
    "exhibitor": "未来科技有限公司",
    "industry": "人工智能",
    "boothSize": "120㎡",
    "position": { "row": 1, "col": 1 }
  }
]
```

### 时段目标 (targets.csv)

| 字段 | 类型 | 说明 |
|------|------|------|
| timeSlot | string | 时段 |
| hallId | string | 展馆 ID |
| targetVisitors | number | 目标客流量 |
| targetOrders | number | 目标订单数 |
| targetRevenue | number | 目标成交额 |

## 使用指南

### 1. 查看示例数据
项目启动后会自动加载 `src/data/` 目录下的示例数据，包含：
- 50 条客流记录（覆盖 3 个展馆、5 个时段）
- 25 条订单记录（其中包含 2 条重复订单号用于测试边界情况）
- 12 个展商信息（3 个展馆）
- 各时段目标数据

### 2. 导入自定义数据
1. 点击页面右上角「导入数据」按钮
2. 分别上传对应的 CSV/JSON 文件
3. 支持分别导入客流、成交、展商、目标四类数据
4. 导入后数据会自动聚合并更新所有图表

### 3. 使用筛选功能
- **展馆筛选** - 点击筛选面板中的展馆标签
- **时段筛选** - 点击筛选面板中的时段标签，或直接点击趋势图上的时段
- **行业筛选** - 点击筛选面板中的行业标签
- 所有筛选条件会即时同步到所有图表和表格

### 4. 图表联动
- 点击时段趋势图上的任一时段数据点，会自动筛选该时段
- 点击展馆热力图上的任一展馆，会自动筛选该展馆
- 点击摊位排行榜上的任一条目，会自动筛选该摊位
- 再次点击已选择的项可清除筛选

### 5. 保存筛选口径
1. 设置好筛选条件后，点击「保存筛选」按钮
2. 输入筛选名称（如：「上午时段 1号馆」）
3. 点击保存
4. 已保存的筛选会显示在筛选面板底部，点击即可快速加载

### 6. 数据导出
- **导出 PNG** - 点击「导出」→「导出为 PNG」，将当前页面可视区域保存为图片
- **导出 CSV** - 点击「导出」→「导出为 CSV」，仅导出汇总数据
- **导出 Excel** - 点击「导出」→「导出为 Excel」，导出汇总数据 + 客流明细 + 订单明细（3 个 Sheet）

## 边界情况处理

### 空筛选结果
当筛选条件过于严格导致无匹配数据时：
- 展示友好的空状态提示
- 显示「重置筛选条件」按钮，点击可一键清除所有筛选

### 重复订单号
当导入的订单数据中存在重复订单号时：
- 在页面顶部显示黄色警告提示
- 警告中列出所有重复的订单号
- 数据处理时会自动去重，仅保留第一条记录
- 统计指标基于去重后的数据计算

## 指标说明

### 核心指标
- **客流量** - 指定范围内的访客总人数
- **订单数** - 指定范围内的成交订单总数（仅统计 status=completed）
- **成交额** - 指定范围内的成交总金额
- **转化率** - 订单数 / 客流量
- **客单价** - 成交额 / 订单数

### 目标差距指标
- **差距值** - 实际值 - 目标值（正数表示超额完成，负数表示未达成）
- **差距百分比** - 差距值 / 目标值（正数表示超额完成百分比）

## 开发说明

### 项目配置
- 开发服务器端口：3000（可在 `vite.config.ts` 中修改）
- TypeScript 严格模式：已启用
- Tailwind CSS：已配置自定义主题色

### 状态管理
使用 React Context + useReducer 进行状态管理，主要包含：
- 原始数据（events, orders, booths, targets）
- 筛选条件
- 聚合后的数据
- 已保存的筛选
- 数据验证警告

### 扩展开发
如需添加新功能或修改现有功能：
1. 类型定义在 `src/types/index.ts`
2. 数据处理逻辑在 `src/utils/`
3. 组件在 `src/components/`
4. 状态管理在 `src/context/DashboardContext.tsx`

## License

MIT License

## 支持

如有问题或建议，请提交 Issue 或联系开发团队。
