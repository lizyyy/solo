# 麻醉监护记录复盘工具

宠物医院麻醉护士专用的手术日麻醉监护记录复盘工具，帮助复盘手术过程中的麻醉监护记录，自动检测潜在风险。

## 功能特性

- **数据导入**: 支持导入病例 CSV、分钟生命体征 JSONL、用药扫描 CSV 和麻醉规则 YAML
- **时间线查看**: 按病例查看完整的麻醉时间线，包括生命体征、用药记录和关键事件
- **用药剂量分析**: 查看和分析用药剂量，与规则对比检测超限
- **恢复状态追踪**: 追踪麻醉恢复状态
- **自动风险检测**:
  - 🟡 体征数据断采（超过设定阈值）
  - 🔴 用药剂量超限（超过规则限制）
  - 🟡 重复用药扫描（短时间内重复扫码）
  - 🔵 跨午夜数据归属错误（数据跨越午夜需确认归属）
- **数据导出**:
  - 导出 `anesthesia_review.md` 麻醉复盘报告
  - 导出 `issues.csv` 问题列表

## 技术栈

- **前端**: React 18
- **数据处理**: csv-parser, js-yaml

## 快速开始

### 环境要求

- Node.js 16+
- npm 或 yarn

### 安装依赖

```bash
npm install
```

### 启动开发服务器

```bash
npm start
```

服务器启动后，在浏览器中访问 http://localhost:3000

### 构建生产版本

```bash
npm run build
```

构建完成后，`build` 目录包含可部署的静态文件。

## 使用说明

### 1. 加载数据

有两种方式加载数据：

**方式一：使用示例数据**
- 点击顶部导航栏的「加载示例数据」按钮

**方式二：导入自己的数据**
- 在主界面依次导入以下文件：
  1. 病例信息 (CSV)
  2. 分钟生命体征 (JSONL)
  3. 用药扫描 (CSV)
  4. 麻醉规则 (YAML)

### 2. 查看病例

- 左侧侧边栏显示病例列表
- 每个病例卡片显示：
  - 动物名称
  - 病例ID、类型、手术类型
  - 风险提示徽章（🔴错误、🟡警告、🔵提示）
- 点击病例卡片查看详细信息

### 3. 病例详情

病例详情页面包含以下信息：

**病例摘要**
- 基本信息：病例ID、动物名称、类型、年龄、体重
- 手术信息：手术类型、日期、麻醉时长、恢复状态

**风险检测**
- 风险统计卡片
- 详细问题列表，按严重程度分类显示

**麻醉时间线**
- 按时间顺序展示：
  - 关键事件（麻醉开始/结束）
  - 生命体征记录
  - 用药记录
  - 风险事件

**用药记录**
- 表格形式展示所有用药记录
- 包含：时间、药物名称、剂量、单位、给药方式

**生命体征摘要**
- 心率、体温、血氧、血压的统计数据
- 最小值、最大值、平均值

### 4. 导出数据

**导出分析报告**
- 选择任意病例
- 点击顶部「导出分析报告」按钮
- 自动下载 `anesthesia_review_xxx.md` 文件

**导出问题列表**
- 点击顶部「导出问题列表」按钮
- 自动下载 `issues.csv` 文件

## 数据格式说明

### 病例 CSV 格式

```csv
id,patientName,species,age,weight,surgeryDate,startTime,endTime,procedure,anesthesiologist
CASE001,旺财,犬,3岁,12.5,2024-05-01,09:00,10:30,去势手术,李医生
```

### 分钟生命体征 JSONL 格式

每行一个 JSON 对象：

```json
{
  "caseId": "CASE001",
  "timestamp": "2024-05-01T09:00:00",
  "heartRate": 110,
  "systolicBP": 105,
  "diastolicBP": 65,
  "spo2": 98,
  "etco2": 38,
  "temperature": 37.8
}
```

### 用药扫描 CSV 格式

```csv
caseId,timestamp,drugName,dosage,unit,route,weight
CASE001,2024-05-01T08:55:00,丙泊酚,50,mg,IV,12.5
```

### 麻醉规则 YAML 格式

```yaml
vitals:
  gapThresholdMinutes: 5

medications:
  dosageLimits:
    丙泊酚:
      maxDosePerKg: 6.0
      minDosePerKg: 2.0
    芬太尼:
      maxDosePerKg: 0.005
      minDosePerKg: 0.002
```

## 示例数据

项目包含完整的示例数据，位于 `sample-data/` 目录：

- `cases.csv` - 3个示例病例
- `vitals.jsonl` - 分钟生命体征记录
- `medications.csv` - 用药扫描记录
- `rules.yaml` - 麻醉规则配置

示例数据中特意设计了以下问题用于演示：

| 病例 | 问题类型 | 说明 |
|------|----------|------|
| CASE001 | 体征断采 | 09:04 到 09:12 间隔8分钟（阈值5分钟） |
| CASE001 | 重复扫描 | 芬太尼在09:05:00和09:05:10两次扫描 |
| CASE001 | 剂量超限 | 头孢唑林剂量500mg超过阈值375mg |
| CASE003 | 跨午夜 | 05-02 00:15 数据归属检查 |

## 项目结构

```
.
├── sample-data/         # 示例数据
│   ├── cases.csv
│   ├── vitals.jsonl
│   ├── medications.csv
│   └── rules.yaml
├── src/
│   ├── components/      # React 组件
│   │   ├── CaseSidebar.js
│   │   ├── CaseDetail.js
│   │   └── ImportSection.js
│   ├── utils/           # 工具函数
│   │   ├── issueDetector.js   # 风险检测
│   │   ├── exporter.js        # 导出功能
│   │   ├── fileParser.js      # 文件解析
│   │   └── sampleData.js      # 示例数据
│   ├── App.js           # 主应用组件
│   ├── index.js         # 入口文件
│   └── index.css        # 样式文件
├── public/
│   └── index.html       # HTML 模板
├── package.json
└── README.md
```

## 许可证

MIT License
