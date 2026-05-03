# 🏃 跑步训练负荷分析工具 Running Analyzer

一个本地的跑步训练负荷和跑鞋轮换分析工具，帮助跑者在每周复盘时了解训练风险、跑鞋状态和健康关联。

## ✨ 核心功能

### 1. 数据导入与校验
- 支持 `runs.csv`（跑步记录）、`shoes.json`（跑鞋信息）、`soreness.csv`（疼痛日志）
- 自动校验字段缺失、日期格式错误、鞋款不存在、距离或配速异常
- 精确定位到行号的错误提示

### 2. 数据归一化与筛选
- 自动识别多种日期格式（YYYY-MM-DD, DD/MM/YYYY, YYYY/MM/DD 等）
- 归一化路面类型（公路/越野/田径场/跑步机）
- 归一化训练类型（轻松跑/间歇/节奏/长距离/比赛）
- 支持按周/月、鞋款、路面、训练类型筛选

### 3. 风险指标计算
- **ACWR 急慢比**：近7天负荷 / 近28天周均负荷，>1.5 警告，>2.0 危险
- **跑量突增**：检测周跑量增长超过 20% 或 5km
- **连续高强度**：连续 3 天以上高强度训练（配速 < 4:30/km）
- **长距离占比**：单周长距离占比超过 40%
- **休息不足**：连续 6 天跑步未休息

### 4. 跑鞋管理
- 累计里程统计（包含初始里程）
- 最近使用频率检测
- 轮换建议（单鞋占比过高、长期未穿）
- 退役提醒（建议 800km 退役，600km 预警）

### 5. 疼痛关联分析
- 疼痛部位统计与严重程度
- 自动分析疼痛前 3 天内的跑步因素
- 鞋款关联、路面关联、训练类型关联

### 6. 可视化界面
- Web 仪表盘（Chart.js 图表）
- 风险卡片（高/中风险分类显示）
- 周跑量趋势图
- 鞋款里程分布图
- 疼痛部位分布图

### 7. 报告导出
- Markdown 格式（适合复制到笔记软件）
- HTML 格式（美观的网页报告）
- JSON 格式（结构化数据，便于二次处理）

## 📁 项目结构

```
running-analyzer/
├── config/
│   └── index.js          # 配置参数（阈值、路径等）
├── core/
│   ├── validator.js      # 数据校验模块
│   ├── aggregator.js     # 数据聚合与筛选
│   ├── riskAnalyzer.js   # 风险指标计算
│   ├── shoeAnalyzer.js   # 跑鞋分析
│   ├── sorenessAnalyzer.js # 疼痛关联分析
│   └── reportGenerator.js # 报告生成
├── utils/
│   ├── date.js           # 日期处理工具
│   └── normalization.js  # 数据归一化工具
├── server/
│   └── index.js          # Express Web 服务
├── public/
│   └── index.html        # 前端仪表盘
├── data/
│   ├── runs.csv          # 跑步记录（示例数据）
│   ├── shoes.json        # 跑鞋信息（示例数据）
│   └── soreness.csv      # 疼痛日志（示例数据）
├── package.json
└── README.md
```

## 🚀 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 准备数据

在 `data/` 目录下准备三个文件：

#### runs.csv - 跑步记录
| 字段 | 必填 | 说明 | 示例 |
|------|------|------|------|
| date | 是 | 日期 | 2026-04-30 |
| distance | 是 | 距离(km) | 8.5 |
| duration | 否 | 时长(分钟) | 48 |
| pace | 否 | 配速(分/公里) | 5.6 |
| elevation | 否 | 爬升(m) | 80 |
| surface | 否 | 路面类型 | road, trail, track, treadmill |
| training_type | 否 | 训练类型 | easy, interval, tempo, long_run, race |
| shoe | 否 | 鞋款名称 | 耐克 ZoomX Vaporfly |
| heart_rate | 否 | 平均心率 | 150 |
| calories | 否 | 消耗卡路里 | 600 |
| notes | 否 | 备注 | 轻松跑 |

#### shoes.json - 跑鞋信息
```json
[
  {
    "name": "耐克 ZoomX Vaporfly",
    "brand": "Nike",
    "model": "ZoomX Vaporfly Next% 3",
    "purchase_date": "2026-01-15",
    "initial_mileage": 150,
    "notes": "碳板竞速鞋",
    "retired": false
  }
]
```

#### soreness.csv - 疼痛日志
| 字段 | 说明 |
|------|------|
| date | 日期 |
| location | 疼痛部位（膝盖/小腿/跟腱等） |
| side | 左右侧（left/right/both） |
| severity | 严重程度(1-10) |
| description | 描述 |
| notes | 备注 |

### 3. 启动服务

```bash
npm start
```

然后打开浏览器访问：**http://localhost:3000**

### 4. API 端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/` | GET | 仪表盘页面 |
| `/api/analyze` | GET | 完整分析结果 |
| `/api/risks` | GET | 风险分析详情 |
| `/api/shoes` | GET | 跑鞋分析详情 |
| `/api/soreness` | GET | 疼痛分析详情 |
| `/api/report/markdown` | GET | 导出 Markdown 报告 |
| `/api/report/html` | GET | 导出 HTML 报告 |
| `/api/report/json` | GET | 导出 JSON 报告 |
| `/api/validate` | GET | 数据校验结果 |
| `/api/runs` | GET | 所有跑步记录列表 |

## ⚙️ 配置说明

在 `config/index.js` 中可以调整以下参数：

### 数据校验阈值
```javascript
validation: {
  minDistance: 0.1,      // 最小有效距离(km)
  maxDistance: 100,       // 最大有效距离(km)
  minPace: 2,            // 最快配速(分/公里)
  maxPace: 8,            // 最慢配速(分/公里)
  minElevation: -100,    // 最低爬升(m)
  maxElevation: 2000     // 最高爬升(m)
}
```

### 风险阈值
```javascript
risks: {
  acwrWarnThreshold: 1.5,        // ACWR 警告阈值
  acwrDangerThreshold: 2.0,       // ACWR 危险阈值
  weeklyIncreaseThreshold: 0.2,    // 周增长百分比阈值(20%)
  weeklyAbsoluteIncreaseThreshold: 5, // 周增长绝对阈值(5km)
  maxConsecutiveHighDays: 3,       // 连续高强度天数阈值
  highIntensityPaceThreshold: 4.5, // 高强度配速阈值(4:30/km)
  longRunDistanceThreshold: 16,     // 长距离定义(16km)
  longRunRatioThreshold: 0.4,       // 长距离占比阈值(40%)
  acuteDays: 7,                      // 急性期天数
  chronicDays: 28                    // 慢性期天数
}
```

### 跑鞋参数
```javascript
shoes: {
  maxMileage: 800,           // 建议退役里程(km)
  warningMileage: 600,       // 预警里程(km)
  maxDaysSinceWorn: 14,      // 长期未穿阈值(天)
  maxDaysSinceWornWarning: 7 // 未穿警告阈值(天)
}
```

### 疼痛关联参数
```javascript
soreness: {
  correlationWindowDays: 3,    // 关联窗口天数
  minCorrelationSamples: 3     // 最小关联样本数
}
```

## 📊 风险指标说明

### ACWR (Acute Chronic Workload Ratio) 急慢比
- **计算方式**：近7天训练负荷 ÷ 近28天周均训练负荷
- **安全范围**：0.5 - 1.5
- **警告**：1.5 - 2.0（注意控制训练量）
- **危险**：> 2.0（有较高受伤风险）
- **偏低**：< 0.5（训练量下降过快）

### 跑量突增
- 周跑量增长超过前一周的 20% 或 5km
- 跑量突增是跑步受伤的主要原因之一
- 建议遵循 "10% 规则"：周跑量增长不超过前一周的 10%

### 连续高强度训练
- 配速快于 4:30/km 被视为高强度
- 连续 3 天以上高强度训练增加受伤风险
- 高强度训练后应安排恢复日

### 跑鞋里程建议
- 一般跑鞋建议 600-800km 退役
- 碳板鞋可能更早需要更换（400-600km）
- 越野鞋在粗糙路面磨损更快

## 🔄 典型使用流程

### 每周复盘
1. 从运动手表/APP 导出新的跑步记录
2. 更新 `runs.csv` 添加新数据
3. 如有疼痛，更新 `soreness.csv`
4. 启动服务 `npm start`
5. 打开仪表盘查看风险分析
6. 检查跑鞋状态
7. 导出报告保存到笔记软件

### 数据更新建议
- **跑步记录**：每次跑完后更新
- **跑鞋信息**：购买新鞋时添加，退役时标记 retired: true
- **疼痛日志**：出现疼痛时记录，恢复时可加备注

## 🎯 示例数据

项目提供了示例数据，展示了典型的风险场景：
- 近几周跑量逐步增加，ACWR 接近警告阈值
- Salomon Speedcross 越野鞋已接近退役里程
- 膝盖和跟腱疼痛可能与越野路面有关

可以通过示例数据熟悉界面和报告格式，然后替换为自己的数据。

## 🛠️ 技术栈

- **后端**：Node.js + Express
- **前端**：原生 HTML/CSS/JavaScript + Chart.js
- **数据处理**：moment.js（日期处理）+ csv-parse（CSV 解析）
- **命令行**：chalk（彩色输出）+ table（表格输出）

## 📝 注意事项

1. **数据备份**：建议定期备份 `data/` 目录下的文件
2. **初始里程**：如果跑鞋不是全新购买，记得设置 `initial_mileage`
3. **配速计算**：如果只提供了 `duration` 和 `distance`，会自动计算配速
4. **日期格式**：支持多种日期格式，但建议统一使用 YYYY-MM-DD
5. **参考日期**：分析以当前日期为基准，可以通过 `?referenceDate=2026-04-30` 参数指定

## 🤝 贡献

欢迎提交 Issue 和 Pull Request 来改进这个工具！

## 📄 许可证

MIT License

---

**Running Analyzer** - 让跑步更科学、更安全 🏃‍♂️💨
