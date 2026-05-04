# 潮汐装卸排程工具

一个为小码头调度员设计的本地潮汐装卸排程工具，用于计算驳船安全靠泊与装卸的时间窗。

## 功能特性

### 核心功能
- **数据导入**: 支持导入潮位/流速CSV、泊位占用表JSON、驳船吃水JSON
- **智能排程**: 自动计算每艘船可安全靠泊与装卸的时间窗
- **风险识别**: 自动识别低潮搁浅、同泊位冲突、流速超限和夜间人手不足
- **可视化调整**: 时间轴上可拖动调整方案
- **数据持久化**: 保存复核备注，刷新后不丢失
- **导出功能**: 导出Markdown交班单和JSON审计包

### 风险检测
- ✅ 低潮搁浅风险 (吃水 + 富裕水深 > 潮位)
- ✅ 同泊位时间冲突
- ✅ 流速超限 (超过安全流速限制)
- ✅ 夜间作业 (人手不足警告)

## 项目结构

```
xy4401/
├── server/                 # 后端代码
│   ├── index.js           # 服务入口
│   ├── routes/
│   │   ├── uploads.js     # 上传接口
│   │   ├── scheduling.js  # 排程接口
│   │   └── export.js      # 导出接口
│   └── utils/
│       ├── fileManager.js # 文件管理
│       └── schedulingEngine.js # 排程引擎
├── client/                 # 前端代码
│   ├── src/
│   │   ├── views/         # 页面组件
│   │   │   ├── DataImport.vue    # 数据导入
│   │   │   ├── Scheduling.vue    # 排程调整
│   │   │   └── ScheduleList.vue  # 历史排程
│   │   ├── components/    # 公共组件
│   │   │   └── TimelineView.vue  # 时间轴组件
│   │   ├── stores/        # 状态管理
│   │   ├── api/           # API接口
│   │   ├── router/        # 路由
│   │   └── main.js        # 入口文件
│   └── package.json
├── examples/              # 示例数据
├── package.json
└── README.md
```

## 安装与运行

### 环境要求
- Node.js 16+
- npm 或 yarn

### 安装依赖

```bash
# 安装后端依赖
npm install

# 安装前端依赖
cd client
npm install
cd ..
```

### 运行开发环境

```bash
# 启动后端服务 (端口 3000)
npm run server

# 新开终端，启动前端开发服务器 (端口 5173)
cd client
npm run dev
```

或者使用 concurrently 同时启动前后端：

```bash
npm run dev
```

### 访问应用
- 前端: http://localhost:5173
- 后端API: http://localhost:3000

## 使用指南

### 1. 数据导入

在"数据导入"页面，需要导入三类数据：

#### 潮位/流速数据 (CSV)
示例文件: `examples/tide_data.csv`

格式说明:
```csv
时间,潮位(m),流速(节)
2026-05-04 00:00,2.5,0.8
2026-05-04 01:00,2.8,1.0
...
```

#### 泊位数据 (JSON)
示例文件: `examples/berth_data.json`

包含泊位配置和泊位列表，配置项包括：
- 工作时间 (默认 8:00-18:00)
- 富裕水深 (默认 0.5m)
- 最大允许流速 (默认 2.0节)

#### 驳船数据 (JSON)
示例文件: `examples/barge_data.json`

包含驳船的吃水、长度、货种、预计装卸时间等信息。

### 2. 排程计算

导入所有数据后，点击"前往排程计算"进入排程页面：

1. 点击"计算排程"按钮
2. 系统将自动计算每艘驳船的可用时间窗
3. 在时间轴上查看分配结果

### 3. 调整方案

时间轴支持拖拽调整：
- 按住驳船事件块左右拖动调整时间
- 上下拖动切换泊位
- 点击事件块查看详情和可用时间窗列表

### 4. 保存与导出

- 点击"保存排程"保存当前方案
- 添加交班备注
- 导出 Markdown 交班单用于打印
- 导出 JSON 审计包用于存档

## 数据格式说明

### 潮汐CSV字段
| 字段名 | 说明 | 示例 |
|--------|------|------|
| 时间/time | 时间戳 | 2026-05-04 08:00 |
| 潮位/height/level | 潮位高度(米) | 4.0 |
| 流速/current/speed | 水流速度(节) | 1.5 |

### 泊位JSON结构
```json
{
  "config": {
    "workStartHour": 8,
    "workEndHour": 18,
    "underKeelClearance": 0.5,
    "maxCurrentSpeed": 2.0
  },
  "berths": [
    {
      "id": "b1",
      "name": "1号泊位",
      "maxDraft": 5.0,
      "maxLength": 120,
      "allowedCargoTypes": ["煤炭", "矿石"]
    }
  ]
}
```

### 驳船JSON结构
```json
{
  "barges": [
    {
      "id": "ship001",
      "name": "东方号",
      "draft": 3.5,
      "length": 85,
      "cargoType": "煤炭",
      "loadingTime": 180,
      "notes": "装载动力煤"
    }
  ]
}
```

## 排程算法说明

### 安全条件判断

驳船可安全作业的条件：
1. **潮位安全**: 潮位 >= 吃水 + 富裕水深
2. **流速安全**: 流速绝对值 <= 最大允许流速
3. **工作时间**: 在规定工作时段内 (默认 8:00-18:00)
4. **泊位可用**: 泊位最大吃水 >= 驳船吃水

### 时间窗计算

系统会：
1. 逐小时检查潮汐数据
2. 合并连续的安全时段
3. 过滤掉时长不足的时间窗
4. 按优先级排序 (白天优先、无警告优先)

### 冲突检测

- **泊位冲突**: 同一泊位的作业时间重叠
- **低潮风险**: 潮位接近安全临界值
- **高流速风险**: 流速接近上限
- **夜间作业**: 包含夜间时段

## 技术栈

### 后端
- Node.js + Express
- csv-parser (CSV解析)
- moment (日期处理)
- uuid (唯一ID)
- fs-extra (文件操作)

### 前端
- Vue 3 (Composition API)
- Vite (构建工具)
- Vue Router (路由)
- Pinia (状态管理)
- Axios (HTTP客户端)
- Day.js (日期处理)

## 许可证

MIT License
