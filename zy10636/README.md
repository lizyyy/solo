# 设备维保系统巡检漏检补录 API

基于 Node.js + Express + TypeScript + SQLite 构建的设备维保巡检漏检补录管理系统，支持正常流、驳回流、人工复核流三种流程。

## 功能特性

### 核心数据
- 设备管理（设备编码、名称、类型、位置、部门等）
- 巡检人员管理（员工号、姓名、部门、联系方式等）
- 巡检记录（设备、巡检人、计划时间、补录原因等）

### 状态管理
- `pending` - 待巡检
- `missed_pending` - 漏检待补
- `supplemented` - 已补录
- `confirmed` - 已确认
- `rejected` - 已驳回
- `manual_review` - 人工复核

### 流程类型
- `normal` - 正常流
- `rejection` - 驳回流
- `manual_review` - 人工复核流

### 业务规则
- 补录时间早于实际发现时间时自动拦截
- 拦截后转入人工复核流
- 返回所需材料清单（说明文档、照片、日志、签字、视频等）
- 全流程操作历史可追溯

## 快速开始

### 1. 安装依赖
```bash
npm install
```

### 2. 初始化种子数据
```bash
npm run seed
```

种子数据包含：
- 5台设备（数控机床、工业机器人、空压机、检测仪器、叉车）
- 4名巡检人员
- 5条巡检记录（覆盖所有状态和流程类型）

### 3. 启动服务
```bash
npm run dev
```

服务将在 http://localhost:3000 启动

### 4. 运行验收测试
```bash
# 在另一个终端窗口执行
npm test
```

## API 接口

### 巡检记录
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/inspection/records` | 创建漏检记录 |
| GET | `/api/inspection/records` | 获取记录列表（支持筛选、分页） |
| GET | `/api/inspection/records/:id` | 获取记录详情 |
| GET | `/api/inspection/records/:id/history` | 获取操作历史 |

### 流程操作
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/inspection/records/:id/submit` | 提交补录 |
| POST | `/api/inspection/records/:id/confirm` | 确认补录 |
| POST | `/api/inspection/records/:id/reject` | 驳回补录 |
| POST | `/api/inspection/records/:id/approve-review` | 人工复核通过 |

### 导入导出
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/inspection/export/records` | 导出记录列表 (CSV) |
| GET | `/api/inspection/export/records/:id` | 导出单条记录详情 (CSV) |
| POST | `/api/inspection/import/records` | 批量导入记录（支持坏行识别） |

### 基础数据
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/devices` | 获取设备列表 |
| GET | `/api/devices/:id` | 获取设备详情 |
| GET | `/api/inspectors` | 获取巡检人员列表 |
| GET | `/api/inspectors/:id` | 获取巡检人员详情 |

## 完整流程示例

### 正常流
```
漏检待补 (missed_pending)
    ↓ 提交补录
已补录 (supplemented)
    ↓ 确认
已确认 (confirmed)
```

### 驳回流
```
漏检待补 (missed_pending)
    ↓ 提交补录
已补录 (supplemented)
    ↓ 驳回
已驳回 (rejected)
    ↓ 重新提交
已补录 (supplemented)
    ↓ 确认
已确认 (confirmed)
```

### 人工复核流
```
漏检待补 (missed_pending)
    ↓ 提交补录 (补录时间 < 发现时间)
人工复核 (manual_review)
    ↓ 复核通过
已补录 (supplemented)
    ↓ 确认
已确认 (confirmed)
```

## 项目结构

```
src/
├── types/              # 类型定义
│   └── index.ts
├── database/           # 数据库配置
│   └── index.ts
│   └── seed.ts        # 种子数据
├── models/             # 数据模型
│   ├── Device.ts
│   ├── Inspector.ts
│   └── InspectionRecord.ts
├── services/           # 业务逻辑
│   ├── InspectionService.ts
│   └── ExportService.ts
├── controllers/        # 控制器
│   └── InspectionController.ts
├── routes/             # 路由
│   ├── inspection.ts
│   ├── device.ts
│   └── inspector.ts
├── test/               # 测试
│   └── acceptance.test.ts
└── index.ts           # 入口文件
```

## 验收测试覆盖

1. ✅ 创建漏检记录
2. ✅ 完整流转（正常流）
3. ✅ 冲突记录（人工复核流，含材料提示）
4. ✅ 驳回流（驳回后重新提交）
5. ✅ 列表查询（按状态/流程类型筛选、分页）
6. ✅ 详情查询
7. ✅ 操作历史查询
8. ✅ 批量导入（含坏行识别）
9. ✅ 导出功能（CSV）
