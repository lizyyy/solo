# 自习室座位爽约和噪音投诉分析台

一个本地运行的数据分析与可视化工具，专为小自习室店主设计，帮助分析预约数据、识别风险座位、优化运营策略。

## ✨ 功能特性

### 📊 数据导入与校验
- 支持导入 `bookings.csv`、`checkins.csv`、`complaints.csv`、`seats.json` 四种数据文件
- 自动进行字段校验：必填字段检查、数据类型检查、格式校验
- 跨文件引用校验：检查 booking_id、seat_id 等引用是否有效
- 详细的错误提示和警告信息

### 📈 核心指标计算
- **爽约率**：未签到预约占总预约的比例
- **迟到率**：迟到签到占已签到预约的比例
- **投诉率**：有投诉的预约占总预约的比例
- **退款率**：退款相关投诉占总预约的比例
- **座位利用率**：实际使用的座位时段占总可用时段的比例

### 🎨 可视化展示
- **趋势分析图表**：每日爽约率、迟到率、投诉数趋势折线图
- **区域分析**：各区域爽约率、迟到率、投诉率对比柱状图
- **时段分析**：各时段指标雷达图
- **座位热力图**：按风险评分着色的座位布局图，鼠标悬停显示详细信息

### ⚠️ 风险分析
- 自动检测高风险会员（爽约率过高、迟到率过高、被投诉过多）
- 识别问题区域（噪音投诉过多、投诉率过高）
- 发现高风险座位（投诉过多、爽约率过高、利用率异常）
- 定位问题时段（爽约率、迟到率过高）

### 🎯 规则配置
- 可配置的阈值参数：
  - 连续爽约次数阈值
  - 迟到分钟数阈值
  - 高爽约率阈值
  - 高迟到率阈值
  - 高投诉率阈值
  - 高退款率阈值
  - 区域噪音投诉阈值
  - 座位投诉阈值
  - 会员被投诉阈值
  - 低/高利用率阈值

### 💡 调整建议
自动生成优化建议：
- 高风险会员提醒
- 噪音问题区域调整
- 高爽约时段保证金调整
- 低利用率座位优化

### 📄 报告导出
支持三种格式导出：
- **JSON**：结构化数据，适合二次开发
- **Markdown**：格式化文档，适合编辑和分享
- **HTML**：带样式的网页报告，适合直接查看

报告包含：
- 数据校验结果
- 核心指标概览
- 风险分析详情
- 调整建议
- 详细数据分析（按区域、按时段）

## 🚀 快速开始

### 1. 安装依赖

```bash
cd zy1081
pip3 install -r requirements.txt
```

### 2. 启动服务

```bash
python3 app.py
```

### 3. 访问系统

在浏览器中打开：**http://localhost:5001**

系统会自动加载 `data/` 目录下的示例数据，您可以立即看到分析效果。

## 📁 项目结构

```
zy1081/
├── app.py                    # Flask后端服务入口
├── requirements.txt          # Python依赖
├── README.md                # 本文档
├── backend/                 # 后端模块
│   ├── data_parser.py       # 数据解析模块（读取、校验）
│   ├── metrics_calculator.py # 指标计算模块
│   ├── rules_engine.py      # 规则判断模块
│   └── report_exporter.py   # 报告导出模块
├── data/                    # 数据文件目录
│   ├── bookings.csv         # 预约记录
│   ├── checkins.csv         # 签到记录
│   ├── complaints.csv       # 投诉记录
│   └── seats.json           # 座位配置
└── static/
    └── index.html           # 前端可视化界面
```

## 📋 数据格式说明

### 1. bookings.csv（预约记录）

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| booking_id | string | 是 | 预约唯一标识 |
| member_id | string | 是 | 会员标识 |
| seat_id | string | 是 | 座位标识 |
| date | string | 是 | 预约日期，格式 YYYY-MM-DD |
| time_slot | string | 是 | 时段：morning/afternoon/evening/night |
| status | string | 是 | 状态：confirmed/cancelled/no-show/checked-in |
| deposit_amount | float | 是 | 保证金金额 |
| is_member | boolean | 是 | 是否为会员 |
| created_at | string | 否 | 创建时间 |

### 2. checkins.csv（签到记录）

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| checkin_id | string | 是 | 签到唯一标识 |
| booking_id | string | 是 | 关联的预约标识 |
| member_id | string | 是 | 会员标识 |
| seat_id | string | 是 | 座位标识 |
| checkin_time | string | 是 | 签到时间，格式 YYYY-MM-DD HH:MM:SS |
| late_minutes | integer | 是 | 迟到分钟数，0为准时 |
| checkout_time | string | 否 | 离开时间 |
| actual_duration_minutes | integer | 否 | 实际使用时长 |

### 3. complaints.csv（投诉记录）

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| complaint_id | string | 是 | 投诉唯一标识 |
| booking_id | string | 是 | 关联的预约标识 |
| member_id | string | 是 | 投诉人标识 |
| seat_id | string | 是 | 涉及座位 |
| complaint_type | string | 是 | 投诉类型：noise/refund/service/other |
| complaint_time | string | 是 | 投诉时间，格式 YYYY-MM-DD HH:MM:SS |
| status | string | 是 | 处理状态 |
| complaint_detail | string | 否 | 投诉详情 |
| reported_by_zone | string | 否 | 投诉人所在区域 |
| noise_level_estimate | integer | 否 | 噪音估计值（0-120） |
| handling_action | string | 否 | 处理措施 |
| resolution_time | string | 否 | 解决时间 |

### 4. seats.json（座位配置）

```json
{
  "zones": [
    {
      "id": "A",
      "name": "安静区",
      "description": "靠近窗户，适合专注学习",
      "max_noise_level": 40,
      "deposit_required": 50
    }
  ],
  "seats": [
    {
      "id": "A1",
      "zone": "A",
      "position": {"row": 1, "col": 1},
      "type": "single",
      "features": ["power", "usb"]
    }
  ],
  "time_slots": {
    "morning": {"start": "08:00", "end": "12:00", "name": "上午时段"},
    "afternoon": {"start": "12:00", "end": "18:00", "name": "下午时段"},
    "evening": {"start": "18:00", "end": "22:00", "name": "晚上时段"},
    "night": {"start": "22:00", "end": "06:00", "name": "夜间时段"}
  }
}
```

## 🎯 使用流程

### 1. 准备数据
将您的 data 文件放入 `data/` 目录，替换示例数据。

### 2. 启动系统
```bash
python3 app.py
```

### 3. 查看概览
- 查看核心指标（爽约率、迟到率、投诉率等）
- 检查数据校验结果，确认数据格式正确

### 4. 分析趋势
- 查看每日趋势图，识别问题时段
- 按区域分析，发现问题区域
- 按时段分析，了解各时段表现

### 5. 查看热力图
- 直观了解各座位的风险评分
- 识别高风险座位位置

### 6. 风险分析
- 查看高风险会员、区域、座位、时段
- 了解具体问题和建议

### 7. 调整规则
- 在"规则配置"页面调整阈值
- 保存后系统会自动重新分析

### 8. 导出报告
- 选择报告格式（JSON/Markdown/HTML）
- 预览报告内容
- 下载报告文件

## 🔧 API 接口

### 健康检查
```
GET /api/health
```

### 加载数据
```
POST /api/data/load
```

### 获取数据状态
```
GET /api/data/status
```

### 获取核心指标
```
GET /api/metrics/overview
```

### 获取区域指标
```
GET /api/metrics/by-zone
```

### 获取时段指标
```
GET /api/metrics/by-time-slot
```

### 获取会员指标
```
GET /api/metrics/by-member?type=all|high_risk
```

### 获取热力图数据
```
GET /api/metrics/heatmap
```

### 获取每日趋势
```
GET /api/metrics/daily-trend
```

### 获取/更新规则阈值
```
GET /api/rules/thresholds
PUT /api/rules/thresholds
```

### 获取风险分析结果
```
GET /api/rules/analysis?level=all|critical|high|medium|low
```

### 模拟调整效果
```
POST /api/rules/simulate
```

### 导出报告
```
POST /api/report/export
GET /api/report/download/<format>
```

## 📊 示例数据说明

项目包含完整的示例数据，展示了一个典型自习室一周的运营情况：

- **50条预约记录**：覆盖各种状态（已签到、爽约、取消）
- **31条签到记录**：包含准时和迟到的情况
- **15条投诉记录**：噪音投诉、退款投诉等
- **18个座位**：分布在3个区域（安静区A、普通区B、讨论区C）

示例数据特意设计了一些"问题"场景，用于展示系统的分析能力：
- 会员 M002 有较高的爽约率
- 某些时段爽约率超过阈值
- 部分区域有噪音投诉
- 个别座位投诉率较高

您可以通过这些示例数据了解系统的各项功能，然后替换为自己的真实数据。

## ⚠️ 注意事项

1. **端口占用**：默认使用端口 5001，如果被占用请修改 `app.py` 中的端口配置
2. **数据格式**：请严格按照数据格式说明准备 CSV 文件，日期和时间格式必须正确
3. **中文编码**：CSV 文件请使用 UTF-8 编码保存
4. **引用完整性**：确保 checkins 和 complaints 中的 booking_id 在 bookings 中存在
5. **开发模式**：当前使用 Flask 的 debug 模式，生产环境请使用 WSGI 服务器

## 🛠️ 技术栈

- **后端**：Python + Flask + Flask-CORS
- **数据处理**：pandas + numpy
- **前端**：原生 HTML/CSS/JavaScript + Chart.js
- **数据格式**：CSV + JSON

## 📝 更新日志

### v1.0.0
- 初始版本发布
- 实现数据解析和校验功能
- 实现核心指标计算
- 实现规则引擎和风险分析
- 实现报告导出（JSON/Markdown/HTML）
- 实现可视化界面（图表、热力图）
- 提供完整的示例数据

---

**享受数据分析带来的运营优化！** 🎉
