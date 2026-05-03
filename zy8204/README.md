# 钻孔岩芯编录质量复核工具

一个用于岩土勘察组复核钻孔岩芯编录质量的本地 Web 前端工具。

## 功能特性

- 📊 **数据可视化**：深度连续条带、岩性分层、取芯率/RQD 曲线
- 🔍 **智能检测**：自动检测深度断档、箱号重复、RQD 超范围、层位跨孔命名不一致等问题
- 📁 **多格式支持**：支持导入 `boreholes.csv`、`core_boxes.json` 和 `rules.yaml`
- 🎯 **交互定位**：点击问题列表可定位到对应箱位
- 📤 **报告导出**：支持导出 `issues.csv` 和 `review_report.md`
- 🧪 **内置示例**：提供示例数据，快速体验功能

## 快速开始

### 安装依赖

```bash
npm install
```

### 启动开发服务器

```bash
npm run dev
```

然后在浏览器中打开显示的本地地址（通常是 `http://localhost:5173`）。

### 构建生产版本

```bash
npm run build
```

## 数据格式

### 1. boreholes.csv (钻孔信息表)

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| borehole_id | string | 是 | 钻孔编号 |
| total_depth | number | 是 | 总深度 (米) |
| location | string | 否 | 位置 |
| project | string | 否 | 项目名称 |
| date | string | 否 | 日期 |
| engineer | string | 否 | 工程师 |

示例：
```csv
borehole_id,total_depth,location,project
ZK-001,45.5,A区1号点位,岩土勘察项目一期
ZK-002,38.0,A区2号点位,岩土勘察项目一期
```

### 2. core_boxes.json (岩芯箱数据)

每个岩芯箱对象包含以下字段：

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| borehole_id | string | 是 | 所属钻孔编号 |
| box_number | number | 是 | 箱号 |
| start_depth | number | 是 | 起始深度 (米) |
| end_depth | number | 是 | 结束深度 (米) |
| lithology | string | 否 | 岩性名称 |
| rqd | number | 否 | RQD 值 (0-100) |
| recovery_rate | number | 否 | 取芯率 (0-100) |
| description | string | 否 | 描述 |

示例：
```json
[
  {
    "borehole_id": "ZK-001",
    "box_number": 1,
    "start_depth": 0.0,
    "end_depth": 2.0,
    "lithology": "素填土",
    "rqd": 100,
    "recovery_rate": 98,
    "description": "黄褐色，稍密"
  }
]
```

### 3. rules.yaml (校验规则配置，可选)

用于自定义校验参数：

```yaml
depth_gap_threshold: 0.1    # 深度断档阈值 (米)
rqd_min: 0                   # RQD 最小值
rqd_max: 100                 # RQD 最大值
recovery_min: 0              # 取芯率最小值
recovery_max: 100            # 取芯率最大值
check_lithology_consistency: true  # 检查岩性一致性
check_box_sequence: true            # 检查箱号顺序
check_continuous_depth: true        # 检查深度连续性
```

## 检测规则

### 错误级别 (Error)

| 代码 | 说明 |
|------|------|
| DEPTH_GAP | 深度断档 - 两个岩芯箱之间存在深度间隙 |
| DEPTH_OVERLAP | 深度重叠 - 两个岩芯箱的深度区间存在重叠 |
| DUPLICATE_BOX_NUMBER | 箱号重复 - 同一钻孔中箱号重复 |
| RQD_OUT_OF_RANGE | RQD 值超范围 - RQD 超出 0-100 范围 |
| RQD_INVALID | RQD 值无效 - RQD 值不是有效数字 |
| RECOVERY_INVALID | 取芯率值无效 - 取芯率不是有效数字 |

### 警告级别 (Warning)

| 代码 | 说明 |
|------|------|
| RECOVERY_OUT_OF_RANGE | 取芯率超范围 - 取芯率超出 0-100 范围 |
| BOX_SEQUENCE_MISMATCH | 箱号顺序与深度不一致 |
| MISSING_BOX_NUMBER | 缺失箱号 - 箱号序列中存在断档 |
| TOTAL_DEPTH_MISMATCH | 总深度不一致 - 声明总深度与实际岩芯箱最大深度不符 |
| NO_CORE_BOXES | 无岩芯箱数据 - 钻孔声明但无对应岩芯箱 |
| LITHOLOGY_VARIANT | 岩性命名不一致 - 发现相似但不同的岩性命名 |

### 提示级别 (Info)

| 代码 | 说明 |
|------|------|
| LITHOLOGY_CROSS_BOREHOLE | 跨钻孔岩性统计 - 统计各岩性在不同钻孔中的分布 |

## 项目结构

```
src/
├── components/
│   ├── DepthStrip.vue        # 深度条带组件
│   ├── LithologyLog.vue       # 岩性分层日志组件
│   ├── CurvesChart.vue        # RQD/取芯率曲线图表
│   └── IssuesList.vue         # 问题列表组件
├── data/
│   └── sampleData.js          # 示例数据
├── stores/
│   └── appStore.js            # 状态管理
├── utils/
│   ├── parsers.js             # 数据解析器 (CSV/JSON/YAML)
│   ├── depthCalculator.js     # 深度区间计算
│   ├── rulesEngine.js         # 规则引擎
│   └── exporter.js            # 导出功能
├── App.vue                    # 主应用组件
├── main.js                    # 入口文件
└── style.css                  # 全局样式
```

## 使用说明

1. **加载数据**：
   - 点击"加载示例数据"按钮快速体验
   - 或通过"导入"按钮分别导入 `boreholes.csv`、`core_boxes.json` 和 `rules.yaml`

2. **选择钻孔**：
   - 在顶部下拉框中选择要查看的钻孔
   - 下拉框会显示每个钻孔的箱数和问题数

3. **查看可视化**：
   - 左侧深度条带：显示深度刻度
   - 中间岩性日志：显示各岩性分层，点击可选中
   - 右侧曲线图表：显示 RQD 和取芯率的柱状图

4. **查看问题**：
   - 右侧面板显示问题列表
   - 可按类型过滤（全部/错误/警告/提示）
   - 点击问题项可自动定位到对应箱位

5. **导出报告**：
   - 点击"导出 issues.csv"导出问题列表
   - 点击"导出 review_report.md"导出完整复核报告

## 技术栈

- **框架**：Vue 3 (Composition API)
- **构建工具**：Vite
- **图表库**：Chart.js + vue-chartjs
- **数据解析**：Papaparse (CSV), yaml (YAML)
- **样式**：原生 CSS

## License

MIT
