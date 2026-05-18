# 门店排班系统临时借调班次 API

## 功能特性

- ✅ 完整的借调班次生命周期管理（待确认→已借调→冲突待判→已归档）
- ✅ 操作历史全记录：操作来源、操作者、操作时间、变更内容
- ✅ 智能冲突检测：同一员工同时段排班自动检测
- ✅ 冲突人工处理机制：备注后可继续推进，不卡死流程
- ✅ CSV导出功能
- ✅ 贴近真实业务的种子数据

## 状态说明

| 状态 | 说明 |
|------|------|
| pending_confirmation | 待确认 |
| transferred | 已借调 |
| conflict_pending | 冲突待判 |
| archived | 已归档 |

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 初始化数据库

```bash
npm run init-db
```

### 3. 导入种子数据

```bash
npm run seed
```

### 4. 启动服务

```bash
npm start
# 开发模式
npm run dev
```

服务运行在: http://localhost:3000

## API 接口

### 1. 创建借调记录

```http
POST /api/transfers
Content-Type: application/json

{
  "employee_id": "e001",
  "employee_code": "EMP2024001",
  "employee_name": "张小明",
  "original_store_id": "s001",
  "original_store_code": "BJ-CY-001",
  "original_store_name": "北京朝阳门店",
  "target_store_id": "s002",
  "target_store_code": "BJ-HD-002",
  "target_store_name": "北京海淀门店",
  "shift_date": "2024-06-01",
  "shift_template_id": "st001",
  "shift_template_name": "早班",
  "shift_start_time": "07:00",
  "shift_end_time": "15:30",
  "remark": "国庆支援",
  "operator_id": "m001",
  "operator_name": "张经理",
  "operation_from": "Web后台"
}
```

### 2. 获取借调列表

```http
GET /api/transfers?status=pending_confirmation&page=1&page_size=10
```

支持查询参数：
- `status`: 状态过滤
- `employee_name`: 员工姓名模糊搜索
- `shift_date_start`: 开始日期
- `shift_date_end`: 结束日期
- `page`, `page_size`: 分页

### 3. 获取借调详情

```http
GET /api/transfers/:id
```

### 4. 获取操作历史

```http
GET /api/transfers/:id/history
```

### 5. 更新状态

```http
PUT /api/transfers/:id/status
Content-Type: application/json

{
  "new_status": "transferred",
  "operator_id": "m001",
  "operator_name": "张经理",
  "operation_from": "Web后台",
  "note": "确认可以借调"
}
```

### 6. 处理冲突

```http
PUT /api/transfers/:id/resolve-conflict
Content-Type: application/json

{
  "operator_id": "m001",
  "operator_name": "张经理",
  "operation_from": "Web后台",
  "resolve_note": "已协调，原门店班次取消，优先借调"
}
```

### 7. 归档

```http
PUT /api/transfers/:id/archive
Content-Type: application/json

{
  "operator_id": "m001",
  "operator_name": "张经理",
  "operation_from": "Web后台",
  "note": "借调完成"
}
```

### 8. 导出CSV

```http
GET /api/transfers/export
```

## 验收数据说明

执行 `npm run seed` 后会生成以下验收数据：

### 1. 完整流转记录 (张小明)
- **借调单号**: TRYYYYMMDD0001
- **员工**: 张小明 (EMP2024001)
- **门店**: 北京朝阳门店 → 北京海淀门店
- **班次**: 早班 07:00-15:30
- **流转路径**: 待确认 → 已借调 → 已归档
- **操作人**: 张经理(创建) → 李店长(确认) → 张经理(归档)
- **操作来源**: Web后台 → 门店终端 → Web后台

### 2. 冲突记录 (王小丽)
- **借调单号**: TRYYYYMMDD0002
- **员工**: 王小丽 (EMP2024003)
- **门店**: 北京海淀门店 → 北京朝阳门店
- **班次**: 中班 11:00-19:30
- **状态**: 冲突待判
- **冲突原因**: 原门店仍排同一时段，时间重叠
- **操作人**: 王主管
- **操作来源**: 移动端

### 3. 导入坏行记录
- **批次号**: BATCHYYYYMMDD001
- **行号**: 第5行
- **错误**: 员工不存在; 原门店不存在; 班次日期格式错误(2024-13-01)
- **导入人**: admin

### 4. 待确认记录 (陈小燕)
- **借调单号**: TRYYYYMMDD0003
- **员工**: 陈小燕 (EMP2024005)
- **门店**: 上海浦东门店 → 深圳南山门店
- **班次**: 晚班 14:00-22:30
- **状态**: 待确认
- **操作人**: 赵总监
- **操作来源**: Web后台

## 项目结构

```
.
├── src/
│   ├── app.js                      # 主应用入口
│   ├── config/
│   │   └── database.js            # 数据库配置
│   ├── controllers/
│   │   └── transferController.js  # 控制器
│   ├── routes/
│   │   └── transferRoutes.js      # 路由
│   ├── services/
│   │   └── transferService.js     # 业务逻辑
│   └── scripts/
│       ├── initDB.js              # 建表脚本
│       └── seedData.js            # 种子数据
├── data/                          # 数据库文件目录
├── package.json
└── README.md
```

## 核心设计要点

### 1. 历史记录追踪
每条操作都会记录：
- `operation_type`: 操作类型(create/update_status/resolve_conflict/archive)
- `old_status`: 变更前状态
- `new_status`: 变更后状态
- `operator_id`: 操作人ID
- `operator_name`: 操作人姓名
- `operation_from`: 操作来源(Web后台/门店终端/移动端等)
- `note`: 备注说明
- `created_at`: 操作时间

### 2. 冲突处理机制
- 创建时自动检测同一员工同一时段是否已有排班
- 检测到冲突时自动置为 `conflict_pending` 状态并记录冲突说明
- 提供专门的冲突处理接口，人工备注后可继续推进流程
- **不卡死流程**，所有状态流转都可通过API操作

### 3. 数据完整性
- 所有外键都关联到真实业务数据（门店、员工、班次模板）
- 字段丰富，不是只有id、name、status
- 包含真实业务场景：国庆支援、618活动、新店开业等
