# 🚢 邮轮客舱维护工具

一个用于邮轮客舱工程组的本地全栈工具，帮助分析客舱温湿度传感器数据、风机盘管巡检表、冷凝水报警和乘客客诉，智能判断哪些舱房需要优先检修、哪些只是短时开门造成的误报。

## ✨ 功能特性

- **数据导入**: 支持 CSV 文件上传和示例数据一键导入
- **智能分析**: 规则引擎自动判断风险等级和误报
- **可视化展示**: 按甲板/舱房展示风险证据和维修状态
- **人工改判**: 支持人工调整判定结果，添加备注
- **数据持久化**: SQLite 数据库存储，数据刷新不丢失
- **多格式导出**: 支持 Markdown 维修交班单和 JSON 明细导出

## 🏗️ 技术栈

### 后端
- **Node.js**: 服务端运行环境
- **Express**: Web 框架
- **SQLite3**: 轻量级数据库
- **Multer**: 文件上传处理
- **csv-parser**: CSV 文件解析

### 前端
- **React**: 前端框架
- **Ant Design**: UI 组件库
- **React Router**: 路由管理
- **Axios**: HTTP 客户端

## 📁 项目结构

```
cabin-maintenance-tool/
├── package.json                 # 根项目配置
├── server/                      # 后端代码
│   ├── index.js                # 服务器入口
│   ├── database.js             # 数据库配置
│   └── routes/                 # API 路由
│       ├── sensorRoutes.js     # 传感器数据 API
│       ├── inspectionRoutes.js # 巡检数据 API
│       ├── alarmRoutes.js      # 报警数据 API
│       ├── complaintRoutes.js  # 客诉数据 API
│       ├── analysisRoutes.js   # 分析引擎 API
│       ├── exportRoutes.js     # 数据导出 API
│       └── sampleRoutes.js     # 示例数据 API
├── client/                      # 前端代码
│   ├── package.json            # 前端依赖配置
│   ├── public/
│   │   └── index.html          # HTML 模板
│   └── src/
│       ├── index.js            # 前端入口
│       ├── index.css           # 全局样式
│       ├── App.js              # 主应用组件
│       ├── services/
│       │   └── api.js          # API 服务封装
│       └── pages/              # 页面组件
│           ├── Dashboard.js    # 仪表板
│           ├── DataImport.js   # 数据导入
│           ├── Analysis.js     # 舱房分析
│           ├── Export.js       # 数据导出
│           └── Settings.js     # 系统设置
├── data/                        # 数据库文件目录
│   └── cabin_maintenance.db    # SQLite 数据库（运行时生成）
├── uploads/                     # 临时上传文件目录
└── README.md                    # 本文档
```

## 🚀 快速开始

### 环境要求

- Node.js >= 16.0.0
- npm >= 8.0.0

### 安装步骤

1. **克隆项目**（如果还没有的话）
```bash
cd /path/to/project
```

2. **安装后端依赖**
```bash
npm install
```

3. **安装前端依赖**
```bash
cd client
npm install
cd ..
```

或者使用一键安装：
```bash
npm run install-all
```

### 运行项目

#### 开发模式

1. **启动后端服务器**（端口 5000）
```bash
npm run server
```

2. **启动前端开发服务器**（端口 3000，新开终端）
```bash
npm run client
```

或者使用 concurrently 同时启动前后端：
```bash
npm run dev
```

#### 生产模式

1. **构建前端**
```bash
cd client
npm run build
cd ..
```

2. **启动服务器**
```bash
npm start
```

访问地址：
- 前端: http://localhost:3000
- 后端 API: http://localhost:5001

## 📖 使用指南

### 1. 数据导入

进入「数据导入」页面，有两种方式导入数据：

#### 方式一：导入示例数据（推荐用于快速体验）
- 点击「导入示例数据」按钮
- 系统将自动生成包含 60 个舱房的完整测试数据
- 包括：传感器数据、巡检记录、报警记录、客诉记录

#### 方式二：上传 CSV 文件
支持上传以下类型的 CSV 文件：

**温湿度传感器数据 CSV 格式：**
```csv
舱房号,时间戳,温度,湿度
5003,2024-01-15 08:00:00,24.5,55
5003,2024-01-15 08:15:00,24.8,56
...
```

**风机盘管巡检表 CSV 格式：**
```csv
舱房号,巡检日期,巡检员,风机盘管状态,滤网状态,冷凝水管状态
5003,2024-01-15,张三,正常,干净,通畅
...
```

**冷凝水报警 CSV 格式：**
```csv
舱房号,报警时间,报警类型,报警级别,描述,状态
5003,2024-01-15 15:30:00,冷凝水报警,高,冷凝水管温度异常,未确认
...
```

**乘客客诉 CSV 格式：**
```csv
舱房号,投诉时间,投诉人,投诉类型,描述,状态,优先级
5003,2024-01-15 16:00:00,李先生,空调问题,舱房温度过高,待处理,高
...
```

> 注意：列名支持中英文，系统会自动识别。

### 2. 运行分析

导入数据后，点击「运行分析」按钮，系统将：
- 分析每个舱房的传感器数据
- 检查报警和客诉记录
- 判断风险等级（高/中/低/正常/误报）
- 确定维修优先级

### 3. 舱房分析

进入「舱房分析」页面，可以：

- **查看风险分布**: 按风险等级筛选舱房
- **按甲板筛选**: 查看特定甲板的舱房状态
- **查看详情**: 点击舱房号查看详细分析和风险证据
- **人工改判**: 对系统判定进行调整，添加备注

#### 人工改判功能

当系统判定不准确时，可以进行人工改判：
1. 点击「改判」按钮
2. 修改风险等级、维修状态、优先级
3. 填写改判原因
4. 添加备注信息

> 人工改判的数据会被标记，下次系统自动分析时不会被覆盖。

### 4. 数据导出

进入「数据导出」页面，支持两种导出格式：

#### Markdown 维修交班单
- 按优先级分类展示需要检修的舱房
- 包含风险证据和备注信息
- 适合打印或在交班会上使用
- 可转换为 PDF 格式

#### JSON 明细数据
- 完整的结构化数据
- 包含所有相关记录（传感器、报警、巡检、客诉）
- 适合进一步分析或导入其他系统

## 🔧 分析规则说明

### 风险评估规则

| 规则项 | 触发条件 | 风险分数 |
|--------|----------|----------|
| 温度过高 | > 26°C | +15 |
| 温度过低 | < 20°C | +15 |
| 湿度过高 | > 70% | +10 |
| 湿度过低 | < 40% | +10 |
| 冷凝水报警 | 存在未确认报警 | +25 |
| 巡检异常 | 风机盘管/滤网状态异常 | +20 |
| 乘客客诉 | 存在未解决客诉 | +30 |
| 持续异常 | 连续5个读数异常 | +20 |
| 频繁报警 | 近期3条以上报警 | +25 |

### 风险等级划分

| 风险等级 | 分数范围 | 维修建议 |
|----------|----------|----------|
| 高风险 | ≥ 50 | 需优先检修 |
| 中风险 | ≥ 30 | 需检修 |
| 低风险 | ≥ 15 | 建议检查 |
| 正常 | < 15 | 无需维修 |
| 误报 | - | 误报排除 |

### 误报检测规则

系统会自动检测可能的误报情况：

1. **短时开门检测**
   - 报警前后温度稳定
   - 报警时温度骤降（> 2°C）
   - 报警后温度快速恢复

2. **单次异常检测**
   - 只有单次读数异常
   - 前后读数均正常
   - 无其他关联报警或客诉

## 📊 API 接口文档

### 数据导入

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | /api/sensors/upload | 上传传感器 CSV |
| POST | /api/inspections/upload | 上传巡检 CSV |
| POST | /api/alarms/upload | 上传报警 CSV |
| POST | /api/complaints/upload | 上传客诉 CSV |
| POST | /api/sample/import | 导入示例数据 |
| POST | /api/sample/clear | 清除所有数据 |

### 数据分析

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | /api/analysis/recalculate | 重新分析所有舱房 |
| GET | /api/analysis | 获取分析结果列表 |
| GET | /api/analysis/:cabinNumber | 获取单个舱房详情 |
| PUT | /api/analysis/:cabinNumber/override | 人工改判 |
| GET | /api/analysis/summary/stats | 获取统计数据 |

### 数据导出

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | /api/export/markdown | 导出 Markdown 报告 |
| GET | /api/export/json | 导出 JSON 数据 |
| GET | /api/export/:cabinNumber/json | 导出单个舱房 JSON |

### 数据查询

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | /api/sensors | 获取传感器数据 |
| GET | /api/sensors/cabins | 获取所有舱房列表 |
| GET | /api/sensors/summary | 获取传感器数据统计 |
| GET | /api/inspections | 获取巡检数据 |
| GET | /api/alarms | 获取报警数据 |
| GET | /api/complaints | 获取客诉数据 |

## 🔒 数据持久化

- 所有数据存储在 SQLite 数据库中：`data/cabin_maintenance.db`
- 人工改判和备注信息永久保存
- 系统自动分析不会覆盖人工改判的数据
- 数据库文件可以直接备份和迁移

## 🛠️ 开发说明

### 数据库表结构

主要数据表：
- `cabins`: 舱房基本信息
- `sensor_data`: 温湿度传感器数据
- `inspection_data`: 风机盘管巡检记录
- `alarm_data`: 报警记录
- `complaints`: 客诉记录
- `cabin_analysis`: 舱房分析结果（包含人工改判）
- `system_config`: 系统配置

### 添加自定义规则

分析规则定义在 `server/routes/analysisRoutes.js` 中，可以根据实际需求修改：

1. 修改阈值配置：
```javascript
const CONFIG = {
  TEMPERATURE_LOW: 20,    // 温度下限
  TEMPERATURE_HIGH: 26,   // 温度上限
  HUMIDITY_LOW: 40,       // 湿度下限
  HUMIDITY_HIGH: 70,      // 湿度上限
  // ...
};
```

2. 修改风险分数：
```javascript
RISK_SCORES: {
  temperature_high: 15,
  humidity_high: 10,
  // ...
}
```

## 📝 更新日志

### v1.0.0 (2024-01-15)
- 初始版本发布
- 实现数据导入功能（CSV 上传 + 示例数据）
- 实现智能分析引擎
- 实现人工改判功能
- 实现 Markdown 和 JSON 导出
- 实现数据持久化存储

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License

## 📞 支持

如有问题，请查看代码或联系开发团队。
