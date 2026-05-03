# 水产养殖溶氧-投喂异常复盘看板

一个用于水产养殖场技术员离线分析池塘传感器数据、投喂事件、增氧机操作和死亡巡检记录的可视化分析工具。

## 功能特点

- **多格式数据导入**: 支持 CSV（传感器、死亡巡检）、JSONL（投喂事件）、YAML（增氧机台账）
- **智能风险检测**:
  - 低溶氧持续
  - 投喂后溶氧下坠
  - 增氧机响应延迟
  - 传感器漂移
  - 不明原因死亡
- **可视化分析**:
  - 溶氧时间线图表
  - 风险事件统计
  - 按池塘/日期筛选
  - 投喂事件和死亡记录查看
- **数据导出**:
  - 风险事件导出为 CSV (`risk_events.csv`)
  - 复盘报告导出为 Markdown (`review_report.md`)

## 项目结构

```
src/
├── components/
│   └── Dashboard.tsx       # 主界面组件
├── modules/
│   ├── dataParser/         # 数据解析模块
│   │   └── index.ts
│   ├── ruleEngine/         # 规则计算模块
│   │   └── index.ts
│   └── exporter/           # 导出模块
│       └── index.ts
├── types/
│   └── index.ts            # TypeScript 类型定义
├── App.tsx
└── index.css

public/sample-data/         # 示例数据
├── sensor.csv
├── feeding.jsonl
├── aerator.yaml
└── mortality.csv
```

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 启动开发服务器

```bash
npm run dev
```

### 3. 在浏览器中打开

访问 http://localhost:5173

## 使用方法

### 方式一：使用示例数据（推荐首次体验）

1. 点击页面上的 **"加载示例数据（包含异常样例）"** 按钮
2. 系统会自动加载预设的示例数据（包含多个异常场景）
3. 点击 **"开始分析数据"** 按钮

### 方式二：手动上传自己的数据

1. 准备四个数据文件：
   - **池塘传感器 CSV**: 包含溶氧、温度等实时数据
   - **投喂机事件 JSONL**: 每行一个 JSON 对象，记录投喂事件
   - **增氧机台账 YAML**: 增氧机启停记录
   - **死亡巡检 CSV**: 死亡数量、原因等记录

2. 点击对应卡片选择文件上传
3. 点击 **"开始分析数据"** 按钮

### 数据格式要求

#### 1. 传感器数据 (CSV)

```csv
pondId,timestamp,dissolvedOxygen,temperature,pH
A,2026-05-01 00:00:00,6.8,25.2,7.8
```

字段说明：
- `pondId`: 池塘编号
- `timestamp`: 时间戳 (支持多种格式)
- `dissolvedOxygen`: 溶氧值 (mg/L)
- `temperature`: 温度 (°C)
- `pH`: pH 值 (可选)

#### 2. 投喂事件 (JSONL)

每行一个 JSON 对象：

```json
{"pondId": "A", "timestamp": "2026-05-01 08:00:00", "feedType": "配合饲料", "feedAmount": 25.5, "feedingDuration": 30}
```

字段说明：
- `pondId`: 池塘编号
- `timestamp`: 投喂时间
- `feedType`: 饲料类型
- `feedAmount`: 投喂量 (kg)
- `feedingDuration`: 投喂时长 (分钟)

#### 3. 增氧机台账 (YAML)

```yaml
- pondId: "A"
  aeratorId: "A-A1"
  power: 1.5
  logs:
    - timestamp: "2026-05-01 05:00:00"
      action: "start"
    - timestamp: "2026-05-01 08:00:00"
      action: "stop"
```

字段说明：
- `pondId`: 池塘编号
- `aeratorId`: 增氧机编号
- `power`: 功率 (kW)
- `logs.action`: start 或 stop
- `logs.timestamp`: 操作时间

#### 4. 死亡巡检 (CSV)

```csv
pondId,timestamp,count,cause,notes
A,2026-05-01 07:30:00,2,水质差,夜间低溶氧导致
```

字段说明：
- `pondId`: 池塘编号
- `timestamp`: 巡检时间
- `count`: 死亡数量 (尾)
- `cause`: 原因 (空、"unknown"、"不明"等表示不明原因)
- `notes`: 备注

### 筛选功能

- **池塘筛选**: 点击池塘标签可筛选特定池塘
- **日期筛选**: 选择开始/结束日期限定分析时间范围

### 导出功能

1. **导出风险CSV**: 导出所有检测到的风险事件为 CSV 文件
2. **导出复盘报告**: 导出完整的分析报告为 Markdown 文件

## 示例数据中的异常样例

示例数据包含以下异常场景，可用于测试系统的检测能力：

### 1. 低溶氧持续 (池塘 A)
- **时间段**: 2026-05-01 03:30 至 05:30
- **溶氧范围**: 2.3 mg/L ~ 3.8 mg/L
- **持续时间**: 约 2 小时
- **严重程度**: Critical

### 2. 投喂后溶氧下坠 (池塘 B)
- **投喂时间**: 2026-05-01 09:30
- **投喂量**: 45 kg 高蛋白饲料
- **溶氧变化**: 从 7.0 mg/L 降至 3.8 mg/L
- **下降幅度**: 3.2 mg/L
- **严重程度**: Critical

### 3. 增氧机响应延迟 (池塘 A)
- **低溶氧开始**: 03:30
- **增氧机启动**: 05:00
- **延迟时间**: 90 分钟
- **严重程度**: High

### 4. 传感器漂移 (池塘 C)
- **5月1日溶氧**: 6.2 ~ 7.4 mg/L (正常范围)
- **5月2日溶氧**: 3.9 ~ 4.5 mg/L (异常偏低)
- **漂移幅度**: ~3.0 mg/L
- **严重程度**: Critical

### 5. 不明原因死亡 (池塘 B、C)
- **池塘 B**: 2026-05-01 14:00 死亡 5 尾，原因"不明原因"
- **池塘 C**: 2026-05-02 死亡 11 尾，原因"unknown"或"不明原因"
- **严重程度**: High / Critical

## 风险检测规则

| 风险类型 | 触发条件 | 默认阈值 |
|---------|---------|---------|
| 低溶氧持续 | 溶氧持续低于阈值超过指定时间 | < 4.0 mg/L 持续 > 60 分钟 |
| 投喂后溶氧下坠 | 投喂后指定时间内溶氧下降超过阈值 | 下降 > 1.5 mg/L |
| 增氧机响应延迟 | 低溶氧发生后增氧机启动延迟 | 延迟 > 30 分钟 |
| 传感器漂移 | 数据前后段平均溶氧差异过大 | 差异 > 0.5 mg/L |
| 不明原因死亡 | 死亡记录原因为空/不明 | cause 为空或 "unknown" |

## 技术栈

- **前端框架**: React 18 + TypeScript
- **构建工具**: Vite
- **样式**: Tailwind CSS
- **图表**: Recharts
- **数据处理**:
  - papaparse (CSV 解析)
  - yaml (YAML 解析)
  - dayjs (日期处理)

## 本地运行完整步骤

```bash
# 1. 克隆或进入项目目录
cd /path/to/project

# 2. 安装依赖
npm install

# 3. 启动开发服务器
npm run dev

# 4. 浏览器访问
# 打开 http://localhost:5173

# 5. 构建生产版本 (可选)
npm run build

# 6. 预览生产版本
npm run preview
```

## 注意事项

1. **文件编码**: 请确保上传的 CSV 文件使用 UTF-8 编码
2. **时间格式**: 支持多种时间格式，推荐使用 `YYYY-MM-DD HH:mm:ss`
3. **数据质量**: 建议检查数据是否有缺失值，异常值可能影响分析结果
4. **离线使用**: 系统完全在浏览器中运行，数据不会上传到任何服务器

## License

MIT
