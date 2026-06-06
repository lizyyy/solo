# 采样包授权链路 (Sampling Auth Chain)

一个用于处理票务授权流程的系统，支持票务导入、混批检测、授权提醒、录音师复核等完整业务流程。

## 功能特性

- 📊 **票务导出表导入**: 支持CSV格式批量导入票务数据
- ⚠️ **混批自动检测**: 自动识别赠票和售票混在同一批次的情况
- 🔔 **智能授权提醒**: 自动生成授权提醒，说明原因、缺什么材料、下一步找谁
- 🎵 **音频备注管理**: 版权运营小鹿可补录音频文件备注，提醒自动联动更新
- 🎙️ **录音师复核**: 混批情况留给录音师复核，不自动归为正常
- 🔍 **授权溯源**: 完整的授权链路追踪，可回跳票务表和音频备注
- 🖥️ **三种入口**: 命令行(CLI)、REST API、Web小看板
- 📈 **可视化展示**: 支持图表数据导出，可用于3D或图表展示

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 构建项目

```bash
npm run build
```

### 3. 一键跑通演示流程

```bash
npm run cli -- demo
```

这将自动执行完整的7步演示流程：
1. 导入样例票务导出表
2. 查看批次列表（自动标记混批）
3. 查看版权运营小鹿的待办提醒
4. 版权运营小鹿补录音频备注
5. 查看录音师的待办提醒
6. 录音师复核混批中的赠票
7. 查看票据授权溯源链路

## 命令行(CLI)使用指南

### 导入票务导出表

```bash
npm run cli -- import <csv文件路径>
```

示例：
```bash
npm run cli -- import ./data/samples/tickets_sample.csv
```

### 查看所有批次

```bash
npm run cli -- batches
```

### 查看批次详情

```bash
npm run cli -- batch <批次ID>
```

示例：
```bash
npm run cli -- batch BATCH_2024_001
```

### 查看授权提醒

```bash
# 查看所有提醒
npm run cli -- reminders

# 查看录音师待办
npm run cli -- reminders recording_engineer

# 查看版权运营小鹿待办
npm run cli -- reminders copyright_operations
```

### 版权运营小鹿补录音频备注

```bash
npm run cli -- add-remark <票据ID> "备注内容"
```

示例：
```bash
npm run cli -- add-remark 1 "确认音频质量合格，采样可用"
```

### 录音师复核

```bash
# 通过
npm run cli -- review <票据ID> approve "复核说明"

# 驳回
npm run cli -- review <票据ID> reject "驳回原因"
```

示例：
```bash
npm run cli -- review 3 approve "该赠票嘉宾确认在授权范围内"
```

### 查看授权溯源链路

```bash
npm run cli -- trace <票据ID>
```

示例：
```bash
npm run cli -- trace 3
```

### 查看整体统计概览

```bash
npm run cli -- overview
```

## API接口使用

### 启动API服务

```bash
npm run api
```

服务启动后：
- API地址: `http://localhost:3000`
- 小看板: `http://localhost:3000/dashboard.html`

### API接口列表

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/health` | 健康检查 |
| GET | `/api/batches` | 获取所有批次 |
| GET | `/api/batches/:batchId` | 获取批次详情（含可视化数据） |
| GET | `/api/tickets/batch/:batchId` | 获取批次下的所有票据 |
| GET | `/api/tickets/:ticketId` | 获取单张票据详情 |
| GET | `/api/reminders` | 获取授权提醒（?role=recording_engineer 过滤） |
| POST | `/api/tickets/:ticketId/remark` | 补录音频备注 |
| POST | `/api/tickets/:ticketId/review` | 录音师复核 |
| GET | `/api/trace/:ticketId` | 获取授权溯源链路 |
| GET | `/api/overview` | 获取整体统计和图表数据 |
| POST | `/api/import` | 导入票务CSV文件 |

## Web小看板

启动API服务后，访问 `http://localhost:3000/dashboard.html` 即可使用Web小看板：

- 查看批次统计卡片
- 浏览批次列表（混批高亮标记）
- 按角色查看授权提醒
- 在线补录音频备注
- 录音师在线复核
- 查看授权溯源链路

## 核心业务流程

### 三步核心流程

```
第一步: 票务导出表导入
    ↓
系统自动检测混批 → 生成初始授权提醒
    ↓
第二步: 版权运营小鹿补看音频文件备注
    ↓
备注更新 → 授权提醒自动联动更新（状态、原因、下一步）
    ↓
第三步: 录音师复核（混批情况）
    ↓
授权完成 / 驳回
```

### 混批处理逻辑

当检测到一个批次中同时存在赠票和售票时：

1. **不自动归为正常** - 所有票据标记为 `needs_review`
2. **分配给录音师** - 提醒负责人设为 `recording_engineer`
3. **说明原因** - 提醒中明确说明"该票所属批次存在赠票与售票混排情况"
4. **列出缺失材料** - 标注需要"录音师复核确认"
5. **指引下一步** - 说明需要录音师确认授权边界

### 授权提醒内容

每条授权提醒都包含：

- **状态**: pending / needs_review / audio_verified / approved / rejected
- **原因**: 为什么会有这条提醒
- **缺失材料**: 还缺什么材料
- **下一步**: 该找谁、做什么

## 数据文件说明

### 票务CSV格式

样例文件: `data/samples/tickets_sample.csv`

```csv
batch_id,ticket_no,ticket_type,attendee_name,price,purchase_date,audio_file_id,audio_remark
BATCH_2024_001,T001,paid,张三,199.00,2024-01-15,AUDIO_001,
BATCH_2024_001,T003,complimentary,王嘉宾,0.00,2024-01-10,AUDIO_003,
```

字段说明:
- `batch_id`: 批次ID（同一批次的票使用相同ID）
- `ticket_no`: 票号（唯一）
- `ticket_type`: 票据类型，`paid`(售票) 或 `complimentary`(赠票)
- `attendee_name`: 参会人姓名
- `price`: 票价（赠票为0）
- `purchase_date`: 购买日期
- `audio_file_id`: 关联的音频文件ID（可选）
- `audio_remark`: 音频备注（可选）

## 项目结构

```
.
├── src/
│   ├── types.ts              # 类型定义
│   ├── db/
│   │   └── database.ts       # 数据存储（JSON文件）
│   ├── services/
│   │   ├── ticketImporter.ts  # 票务导入和解析
│   │   ├── authReminder.ts   # 授权提醒系统
│   │   ├── audioManager.ts   # 音频文件管理
│   │   └── visualizer.ts     # 可视化数据生成
│   ├── cli/
│   │   └── index.ts          # 命令行接口
│   ├── api/
│   │   └── server.ts         # REST API服务
│   └── index.ts              # 库入口
├── public/
│   └── dashboard.html        # Web小看板
├── data/
│   ├── samples/
│   │   └── tickets_sample.csv # 样例数据
│   └── db.json               # 运行时数据库（自动生成）
├── package.json
├── tsconfig.json
└── README.md
```

## 常见问题

### Q: 如何重置数据？
A: 删除 `data/db.json` 文件即可重置所有数据。

### Q: 混批的票能自动通过吗？
A: 不能。混批的票会一直留在 `needs_review` 状态，必须等录音师手动复核。

### Q: 补录音频备注后提醒会变吗？
A: 会的。系统会自动更新提醒的状态、原因、缺失材料和下一步指引。

### Q: 能用于生产环境吗？
A: 当前版本使用JSON文件存储，适合小规模使用。如需大规模部署，建议替换为专业数据库。

## 技术栈

- Node.js + TypeScript
- Express (API服务)
- Commander (CLI框架)
- Chalk + cli-table3 (命令行美化)
- CSV-Parse (CSV解析)
