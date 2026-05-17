# MES 工序返工派发 API 系统

生产制造执行系统（MES）工序返工派发管理API，支持正常流程、驳回流程、人工复核流程的完整状态流转。

## 核心功能

### 业务流程
- **正常流程**: 创建 → 开始返工 → 提交复检 → 复检通过 → 完成
- **驳回流程**: 提交复检 → 复检驳回 → 重新返工
- **人工复核**: 状态冲突/异常 → 人工备注 → 强制推进流程

### 状态定义
| 状态码 | 状态名称 | 说明 |
|--------|----------|------|
| pending_production | 待生产 | 返工任务已创建，等待开始 |
| in_rework | 返工中 | 正在进行返工操作 |
| pending_review | 待复检 | 返工完成，等待质量复检 |
| rejected | 已驳回 | 复检未通过，需重新返工 |
| completed | 已完成 | 复检通过，返工流程结束 |
| conflict | 状态冲突 | MES回写失败或状态不一致 |

### 核心数据模型
1. **工单 (Work Order)**: 工单号、产品名称、数量、状态
2. **工序 (Process)**: 工序编码、工序名称、工序顺序
3. **返工原因 (Rework Reason)**: 原因编码、原因名称、描述
4. **责任班组 (Responsibility Team)**: 班组编码、班组名称、组长
5. **返工任务 (Rework Task)**: 关联以上四要素、数量、状态、备注、人工备注

## 快速开始

### 1. 安装依赖
```bash
npm install
```

### 2. 初始化样例数据
```bash
npm run init-data
```

样例数据包含：
- 5条工单数据
- 4道标准工序
- 4种返工原因
- 4个责任班组
- 6条返工任务（覆盖所有6种状态）
  - 任务1: 待生产状态
  - 任务2: 返工中状态
  - 任务3: 待复检状态
  - 任务4: 已驳回状态（驳回流程样例）
  - 任务5: 已完成状态（完整流转样例）
  - 任务6: 状态冲突（人工备注处理样例）

### 3. 启动服务
```bash
npm start
```

服务默认运行在 `http://localhost:3000`

## API 接口文档

### 基础信息
- 基础URL: `http://localhost:3000/api`
- 数据格式: JSON
- 字符编码: UTF-8

### 工单管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/work-orders` | 获取工单列表 |
| POST | `/work-orders` | 创建工单 |

**创建工单请求示例:**
```json
{
  "work_order_no": "WO2024001",
  "product_name": "电机组件A1",
  "quantity": 100,
  "status": "pending"
}
```

### 工序管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/processes` | 获取工序列表 |
| POST | `/processes` | 创建工序 |

### 返工原因管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/rework-reasons` | 获取返工原因列表 |
| POST | `/rework-reasons` | 创建返工原因 |

### 责任班组管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/responsibility-teams` | 获取责任班组列表 |
| POST | `/responsibility-teams` | 创建责任班组 |

### 返工任务核心接口

#### 1. 获取返工任务列表
```
GET /rework-tasks?status={status}&page={page}&page_size={page_size}
```

**查询参数:**
- `status`: 可选，按状态筛选
- `page`: 页码，默认1
- `page_size`: 每页条数，默认20

**响应示例:**
```json
{
  "data": [
    {
      "id": "xxx",
      "rework_no": "RW2024051800001",
      "work_order_no": "WO2024001",
      "product_name": "电机组件A1",
      "process_name": "测试工序",
      "reason_name": "功能异常",
      "team_name": "测试一班",
      "quantity": 5,
      "status": "pending_production",
      "status_label": "待生产",
      "remark": "功能测试失败",
      "created_by": "操作员A",
      "created_at": "2024-05-18T10:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "page_size": 20,
    "total": 6
  }
}
```

#### 2. 获取返工任务详情
```
GET /rework-tasks/{id}
```

#### 3. 获取返工任务状态历史
```
GET /rework-tasks/{id}/history
```

#### 4. 创建返工任务
```
POST /rework-tasks
```

**请求示例:**
```json
{
  "work_order_id": "工单ID",
  "process_id": "工序ID",
  "rework_reason_id": "返工原因ID",
  "responsibility_team_id": "责任班组ID",
  "quantity": 5,
  "remark": "测试不合格",
  "created_by": "操作员A"
}
```

#### 5. 开始返工
```
POST /rework-tasks/{id}/start
```

**请求示例:**
```json
{
  "operator": "操作员A",
  "remark": "开始返工处理"
}
```

#### 6. 提交复检
```
POST /rework-tasks/{id}/submit-review
```

**请求示例:**
```json
{
  "operator": "操作员A",
  "remark": "返工完成，申请复检"
}
```

#### 7. 复检（通过/驳回）
```
POST /rework-tasks/{id}/review
```

**请求示例（通过）:**
```json
{
  "operator": "质检员A",
  "passed": true,
  "remark": "复检合格"
}
```

**请求示例（驳回）:**
```json
{
  "operator": "质检员A",
  "passed": false,
  "remark": "仍存在焊点问题，需重新返工"
}
```

#### 8. 重新返工（从驳回状态）
```
POST /rework-tasks/{id}/rework-again
```

**请求示例:**
```json
{
  "operator": "操作员A",
  "remark": "根据复检意见重新返工"
}
```

#### 9. 人工干预/强制推进
```
POST /rework-tasks/{id}/manual-override
```

**请求示例:**
```json
{
  "operator": "系统管理员",
  "manual_remark": "MES系统同步异常，人工确认返工已完成，强制推进",
  "target_status": "pending_review"
}
```

**使用场景:**
- MES回写失败导致状态不一致
- 返工完成但主工单状态未更新
- 特殊情况需要跳过某些流程节点

#### 10. 导出CSV
```
GET /rework-tasks/export/csv?status={status}
```

### 批量导入接口

#### 批量导入返工任务
```
POST /import/batch
```

**请求示例:**
```json
{
  "file_name": "rework_import_20240518.xlsx",
  "created_by": "管理员",
  "items": [
    {
      "work_order_no": "WO2024001",
      "process_code": "PROC001",
      "reason_code": "REASON001",
      "team_code": "TEAM001",
      "quantity": 5,
      "remark": "批量导入"
    },
    {
      "work_order_no": "INVALID_WO",
      "process_code": "PROC001",
      "reason_code": "REASON001",
      "team_code": "TEAM001",
      "quantity": 3,
      "remark": "这行会导入失败"
    }
  ]
}
```

**响应示例:**
```json
{
  "batch_no": "IMP2024051800001",
  "total": 2,
  "success": 1,
  "failed": 1,
  "errors": [
    {
      "row": 2,
      "data": {...},
      "error": "工单不存在: INVALID_WO"
    }
  ]
}
```

#### 获取导入记录
```
GET /import/records
```

#### 获取导入错误详情
```
GET /import/records/{id}/errors
```

### 辅助接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/statuses` | 获取所有状态字典 |
| GET | `/health` | 服务健康检查 |

## 验收测试要点

### 1. 完整流转测试
- [ ] 创建返工任务 → 状态为"待生产"
- [ ] 开始返工 → 状态变为"返工中"
- [ ] 提交复检 → 状态变为"待复检"
- [ ] 复检通过 → 状态变为"已完成"
- [ ] 查看历史记录 → 4条状态变更记录完整

### 2. 驳回流程测试
- [ ] 创建任务 → 开始返工 → 提交复检
- [ ] 复检驳回 → 状态变为"已驳回"
- [ ] 重新返工 → 状态变为"返工中"
- [ ] 查看历史记录 → 驳回和重新返工记录完整

### 3. 冲突记录测试
- [ ] 查看冲突状态任务详情
- [ ] 查看人工备注字段内容
- [ ] 验证 is_manual_override 标记为1
- [ ] 历史记录中显示人工干预操作

### 4. 导入坏行测试
- [ ] 批量导入包含有效和无效数据
- [ ] 验证成功计数和失败计数
- [ ] 查看导入错误记录详情
- [ ] 错误记录中包含行号、原始数据和错误原因

### 5. 列表、详情、历史、导出互相对齐
- [ ] 列表数据与详情数据一致
- [ ] 详情状态与历史记录最新状态一致
- [ ] 导出CSV内容与列表内容完全匹配
- [ ] 状态标签显示正确（中文）

## 项目结构

```
.
├── package.json          # 项目配置
├── server.js            # 服务入口
├── database.js          # 数据库初始化和连接
├── routes.js            # API路由定义
├── utils.js             # 工具函数和状态定义
├── init-sample-data.js  # 样例数据初始化脚本
└── mes_rework.db        # SQLite数据库文件（运行后生成）
```

## 技术栈

- **运行时**: Node.js
- **Web框架**: Express.js
- **数据库**: SQLite3
- **数据导出**: json2csv
- **唯一ID**: uuid

## 异常处理机制

### 状态流转验证
系统内置状态流转验证，不允许非法状态跳转：
- 待生产 → 返工中 / 已驳回
- 返工中 → 待复检 / 冲突
- 待复检 → 已完成 / 已驳回 / 冲突
- 已驳回 → 待生产 / 返工中
- 冲突 → 待复检 / 返工中 / 已完成
- 已完成 → （终止状态，不可变更）

### 人工干预兜底
当出现以下情况时，可使用人工干预接口：
- MES系统回写失败
- 网络异常导致状态不同步
- 特殊业务场景需要跳过流程节点

人工干预会记录：
- 操作人信息
- 人工备注说明
- is_manual_override 标记
- 状态历史完整记录
