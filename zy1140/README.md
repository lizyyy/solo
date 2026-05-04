# Apple Health 健康数据复盘工具

一个完全本地运行的 Apple 健康数据复盘工具，用于分析 Apple Watch 和 iPhone 导出的健康记录。

## 功能特性

### 数据导入与解析
- ✅ 导入 Apple Health `export.xml` 文件
- ✅ 解析 `workout-routes` 中的 GPX 路线文件
- ✅ 解析 `daily-notes.csv` 自定义备注（熬夜、喝酒、出差、生病等）
- ✅ 解析 `thresholds.json` 阈值配置
- ✅ 支持数据类型：步数、睡眠、心率、静息心率、心率变异性、运动、活动能量

### 数据处理
- ✅ 单位转换（能量、距离、时间）
- ✅ 时区处理
- ✅ 设备来源识别
- ✅ 自动去重
- ✅ 缺失日期填充
- ✅ 坏格式数据容错
- ✅ 本地 SQLite 持久化存储

### 可视化与分析
- ✅ **总览仪表板**：睡眠时长和睡眠债、静息心率趋势、心率区间、运动负荷、步数和活动能量
- ✅ **日历热力图**：按天查看各指标的分布，支持添加每日备注
- ✅ **运动详情**：运动记录列表、路线摘要、心率变化
- ✅ **异常检测**：基于阈值的规则引擎，检测"连续三天睡眠不足后静息心率偏高"、"运动量突然翻倍但恢复不足"、"数据明显缺失"等异常

### 阈值与报告
- ✅ **阈值设置**：可在页面调整睡眠、心率、步数等阈值，调整后重新计算异常
- ✅ **每日备注**：支持给每天添加备注和标签（熬夜、喝酒、出差等）
- ✅ **报告导出**：支持 Markdown、HTML、CSV、JSON 四种格式，包含关键指标、异常日解释、缺失数据提醒和筛选条件

## 技术栈

### 后端
- **Node.js** + **Express** - 服务器框架
- **sql.js** - 纯 JavaScript SQLite 实现（无需本地编译）
- **xml2js** - XML 解析
- **papaparse** - CSV 解析
- **gpx-parse** - GPX 路线解析
- **dayjs** - 日期处理
- **Jest** + **Supertest** - 测试框架

### 前端
- **React** + **Vite** - 前端框架
- **React Router** - 路由管理
- **Zustand** - 状态管理
- **Chart.js** + **react-chartjs-2** - 图表可视化
- **TailwindCSS** - 样式框架
- **Lucide React** - 图标库
- **Axios** - HTTP 客户端
- **date-fns** - 日期处理

## 快速开始

### 环境要求
- Node.js >= 16.0.0
- npm >= 8.0.0

### 安装依赖

```bash
# 安装后端依赖
cd backend
npm install

# 安装前端依赖
cd ../frontend
npm install
```

### 启动开发环境

**方式一：分别启动**

```bash
# 终端 1 - 启动后端
cd backend
npm run dev

# 终端 2 - 启动前端
cd frontend
npm run dev
```

**方式二：使用统一脚本**

在项目根目录：

```bash
# 安装并启动（需要先配置）
npm install
npm run dev
```

### 访问应用
- 前端地址：http://localhost:3000
- 后端 API：http://localhost:8080

### 首次使用

1. 打开浏览器访问 http://localhost:3000
2. 点击"数据导入"页面
3. 上传你的 Apple Health 数据（或使用种子数据测试）
4. 上传完成后，返回"总览"页面查看分析结果

## 数据导入

### 从 Apple Health 导出数据

1. 打开 iPhone 上的"健康"App
2. 点击右上角你的头像
3. 滚动到底部，点击"导出所有健康数据"
4. 选择"存储到文件"保存
5. 解压后会得到 `export.xml` 和 `workout-routes/` 文件夹

### 支持的文件格式

| 文件名 | 类型 | 说明 |
|--------|------|------|
| `export.xml` | Apple Health XML | 主数据文件，包含步数、心率、睡眠等 |
| `*.gpx` | GPX 路线 | 运动路线文件，包含 GPS 轨迹 |
| `daily-notes.csv` | CSV | 自定义每日备注 |
| `thresholds.json` | JSON | 阈值配置文件 |

### 自定义每日备注 (daily-notes.csv)

格式示例：
```csv
date,text,stay_up,alcohol,travel,sick,stress,coffee
2026-04-01,今天状态不错,0,0,0,0,0,1
2026-04-02,昨晚熬夜到两点,1,0,0,0,1,2
```

### 阈值配置 (thresholds.json)

格式示例：
```json
{
  "thresholds": [
    {
      "category": "sleep",
      "key": "minSleepHours",
      "value": 6,
      "unit": "hours",
      "description": "低于此值视为睡眠不足"
    }
  ]
}
```

### 使用种子数据测试

项目提供了测试用的种子数据：

```
data/
├── seeds/
│   ├── export-sample.xml      # 示例健康数据（含异常场景）
│   ├── daily-notes-sample.csv # 示例备注
│   ├── thresholds-sample.json  # 示例阈值
│   └── route-sample.gpx        # 示例 GPX 路线
└── examples/
    ├── bad-format.xml          # 异常 XML（用于测试容错）
    ├── bad-format.csv          # 异常 CSV
    └── bad-format.json         # 异常 JSON
```

## API 端点概览

### 健康检查
- `GET /api/health` - 健康检查
- `GET /api/status` - 状态检查

### 数据导入
- `POST /api/import/upload` - 单文件上传
- `POST /api/import/multiple` - 多文件上传
- `GET /api/import/history` - 导入历史

### 数据查询
- `GET /api/data/summary` - 范围汇总
- `GET /api/data/daily/:date` - 单日详情
- `GET /api/data/workouts` - 运动列表
- `GET /api/data/workouts/:id` - 运动详情
- `GET /api/data/calendar-heatmap` - 日历热力图
- `GET /api/data/metrics` - 指标时间序列

### 备注管理
- `GET /api/notes` - 获取备注列表
- `GET /api/notes/:date` - 获取单日备注
- `POST /api/notes/:date` - 保存备注
- `PUT /api/notes/:date/tags` - 更新标签

### 阈值管理
- `GET /api/thresholds` - 获取阈值列表
- `POST /api/thresholds/:category/:key` - 保存阈值
- `PUT /api/thresholds/batch` - 批量更新
- `POST /api/thresholds/reset` - 重置为默认值

### 异常检测
- `GET /api/anomalies` - 获取异常列表
- `POST /api/anomalies/detect` - 运行异常检测
- `PUT /api/anomalies/:id/dismiss` - 忽略异常
- `GET /api/anomalies/types` - 获取异常类型说明
- `GET /api/anomalies/stats` - 异常统计

### 报告导出
- `GET /api/report/generate?format=json` - 生成 JSON 报告
- `GET /api/report/generate?format=csv` - 生成 CSV 报告
- `GET /api/report/generate?format=markdown` - 生成 Markdown 报告
- `GET /api/report/generate?format=html` - 生成 HTML 报告

## 异常检测类型

| 类型 | 说明 | 严重程度 |
|------|------|----------|
| `sleep_deficit` | 睡眠不足 | 可配置 |
| `resting_hr_high` | 静息心率偏高 | 可配置 |
| `resting_hr_low` | 静息心率偏低 | 可配置 |
| `hrv_low` | 心率变异性偏低 | 可配置 |
| `workout_spike` | 运动量突增 | 高 |
| `data_missing` | 数据缺失 | 中 |
| `steps_low` | 活动量过低 | 低 |
| `sleep_debt_accumulated` | 睡眠债累积 | 严重 |
| `recovery_insufficient` | 恢复不足警告 | 高 |

**注意**：异常检测仅用于数据复盘，**不是医疗诊断**。如有健康问题请咨询专业医生。

## 项目结构

```
apple-health-dashboard/
├── backend/
│   ├── src/
│   │   ├── database/           # 数据库模块
│   │   │   └── index.js
│   │   ├── parsers/            # 文件解析器
│   │   │   ├── xmlParser.js    # Apple Health XML 解析
│   │   │   ├── gpxParser.js    # GPX 路线解析
│   │   │   ├── csvParser.js    # CSV 解析
│   │   │   └── jsonParser.js   # JSON 解析
│   │   ├── routes/             # API 路由
│   │   │   ├── data.js
│   │   │   ├── import.js
│   │   │   ├── notes.js
│   │   │   ├── thresholds.js
│   │   │   ├── anomalies.js
│   │   │   └── report.js
│   │   ├── services/           # 业务逻辑
│   │   │   ├── dataProcessor.js    # 数据处理
│   │   │   └── anomalyDetector.js  # 异常检测
│   │   ├── utils/              # 工具函数
│   │   │   ├── date.js
│   │   │   ├── units.js
│   │   │   └── file.js
│   │   └── index.js            # 入口文件
│   ├── data/                   # 运行时数据目录
│   │   ├── db/                 # SQLite 数据库
│   │   └── uploads/            # 上传文件
│   ├── package.json
│   └── jest.config.js
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── charts/         # 图表组件
│   │   │   ├── common/         # 公共组件
│   │   │   ├── layout/         # 布局组件
│   │   │   └── ui/             # UI 组件
│   │   ├── pages/              # 页面组件
│   │   │   ├── Dashboard.jsx       # 总览
│   │   │   ├── Import.jsx          # 导入
│   │   │   ├── CalendarHeatmap.jsx # 日历热力图
│   │   │   ├── Workouts.jsx        # 运动详情
│   │   │   ├── Anomalies.jsx       # 异常检测
│   │   │   ├── Settings.jsx        # 阈值设置
│   │   │   └── Report.jsx          # 报告导出
│   │   ├── services/           # API 服务
│   │   ├── store/              # Zustand 状态管理
│   │   ├── utils/              # 工具函数
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   └── tailwind.config.js
│
├── data/                       # 种子数据和样例
│   ├── seeds/                  # 种子数据
│   └── examples/               # 异常输入样例
│
└── README.md
```

## 运行测试

### 后端测试

```bash
cd backend

# 运行所有测试
npm test

# 监视模式
npm run test:watch

# 运行特定测试
npm test -- date.test.js
```

### 测试覆盖范围

- `utils/date.test.js` - 日期处理工具测试
- `utils/units.test.js` - 单位转换工具测试
- `parsers/xmlParser.test.js` - XML 解析器测试
- `parsers/csvParser.test.js` - CSV 解析器测试

## 配置说明

### 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | `8080` | 后端端口 |
| `NODE_ENV` | `development` | 运行环境 |

### 前端代理配置

前端 Vite 已配置代理，`/api` 请求会自动转发到 `http://localhost:8080`。

## 注意事项

1. **数据隐私**：所有数据完全本地存储，不会上传到任何服务器。SQLite 数据库文件位于 `backend/data/db/`。

2. **文件大小**：Apple Health 导出的 XML 文件可能很大（几百 MB），导入时请耐心等待。

3. **时区**：Apple Health 数据包含时区信息，解析时会自动处理。

4. **异常检测**：异常检测仅用于数据复盘参考，**不是医疗诊断**。

5. **数据备份**：建议定期备份 `backend/data/` 目录。

## 常见问题

### Q: 导入时提示"文件太大"？
A: 后端已配置最大 50MB 的请求限制。如果文件过大，可以尝试：
- 压缩后再导入（支持 zip 解压需要额外开发）
- 分批次导出数据

### Q: 为什么有些数据没有显示？
A: 可能的原因：
- 数据格式不正确
- 日期范围不匹配
- 查看导入历史确认是否有错误

### Q: 如何重置所有数据？
A: 删除 `backend/data/db/health.db` 文件，重启后端服务即可。

### Q: 支持哪些 Apple Watch 型号？
A: 所有能导出 Apple Health 数据的 Apple Watch 和 iPhone 都支持。

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request！

## 更新日志

### v1.0.0
- 初始版本发布
- 支持 Apple Health XML、GPX、CSV、JSON 导入
- 实现总览仪表板、日历热力图、运动详情、异常检测
- 支持阈值设置和每日备注
- 支持四种格式报告导出
