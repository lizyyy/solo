# 口腔技工义齿返修管理系统 API

## 项目概述

这是一个完整的口腔技工义齿返修管理系统API原型，实现了从医生处方 → 模型批次 → 制作工序 → 返修申请 → 责任归因 → 返修解决的完整业务闭环。

### 核心辨识度
- **义齿模型批次**：每个处方可以创建多个批次，批次关联模型编号、技师等生产信息
- **返修原因**：预设10种常见返修原因（贴合问题、颜色偏差、形态不对、设计错误等）
- **责任归因**：每个返修申请必须关联责任部门（主/次）、责任人、严重程度，实现可追溯

## 项目结构

```
.
├── package.json          # 项目配置
├── data/                 # SQLite数据库目录（运行时创建）
│   └── dental.db
├── src/
│   ├── app.js           # 主应用入口
│   ├── config/
│   │   └── database.js  # 数据库配置
│   ├── models/          # 数据模型层
│   │   ├── prescription.js    # 处方模型
│   │   ├── batch.js           # 模型批次模型
│   │   ├── workOrder.js       # 制作工序模型
│   │   ├── return.js          # 返修申请模型
│   │   ├── responsibility.js  # 责任归因模型
│   │   └── report.js          # 报表模型
│   ├── services/        # 业务服务层
│   │   ├── prescriptionService.js
│   │   ├── batchService.js
│   │   └── returnService.js
│   ├── routes/          # 路由层
│   │   ├── prescriptions.js
│   │   ├── batches.js
│   │   ├── returns.js
│   │   ├── reports.js
│   │   └── enums.js
│   └── utils/           # 工具类
│       ├── enums.js     # 枚举定义
│       └── response.js  # 响应格式
└── scripts/             # 脚本目录
    ├── init-db.js        # 数据库初始化
    ├── test-main-flow.js # 主流程测试
    └── test-exceptions.js # 异常场景测试
```

## 快速开始

### 1. 安装依赖
```bash
npm install
```

### 2. 初始化数据库
```bash
npm run init-db
```

### 3. 启动服务
```bash
npm start
```

服务启动后访问：http://localhost:3001

### 4. 运行测试
```bash
# 主流程测试
npm test

# 异常场景测试
npm run test-exception
```

## 核心数据模型

### 处方 (Prescription)
- `doctorName`: 医生姓名
- `patientName`: 患者姓名
- `clinic`: 门诊
- `toothPosition`: 牙位
- `dentureType`: 义齿类型
- `status`: 状态（待生产/生产中/已完成/已退回/返工中/已交付）
- `returnCount`: 返修次数

### 模型批次 (Batch)
- `prescriptionId`: 关联处方ID
- `batchNumber`: 批次号
- `modelNumber`: 模型号
- `technician`: 技师
- `status`: 状态（已创建/生产中/已完成/已退回/返工中/已结案）
- `reworkCount`: 返工次数

### 制作工序 (WorkOrder)
自动生成8道工序：
1. 模型检查
2. CAD设计
3. 3D打印/铸造
4. 蜡型制作
5. 金属铸造
6. 上瓷
7. 抛光精修
8. 质量检验

### 返修申请 (Return)
- `prescriptionId`: 处方ID
- `batchId`: 批次ID
- `reason`: 返修原因（见下方枚举）
- `status`: 状态（已提交/已归因/返工中/已解决/已关闭）

### 责任归因 (Responsibility)
- `returnId`: 关联返修申请
- `primaryDepartment`: 主要责任部门
- `secondaryDepartments`: 次要责任部门（数组）
- `operator`: 责任人
- `processCode/processName`: 关联工序
- `severity`: 严重程度（low/medium/high）
- `description`: 问题描述

## 返修原因枚举

| 代码 | 说明 |
|------|------|
| `fit_issue` | 贴合问题 |
| `color_mismatch` | 颜色偏差 |
| `shape_incorrect` | 形态不对 |
| `design_error` | 设计错误 |
| `model_distortion` | 模型变形 |
| `breakage` | 崩瓷/断裂 |
| `patient_discomfort` | 患者不适 |
| `margin_fit` | 边缘密合度 |
| `occlusion_issue` | 咬合问题 |
| `material_defect` | 材料缺陷 |

## 部门枚举

| 代码 | 说明 |
|------|------|
| `clinic` | 门诊 |
| `design` | 设计部 |
| `molding` | 取模部 |
| `wax` | 蜡型部 |
| `casting` | 铸造部 |
| `porcelain` | 上瓷部 |
| `polishing` | 抛光部 |
| `qc` | 质检部 |
| `delivery` | 交付部 |

## 状态流转

### 处方状态流转
```
待生产 → 生产中 → 已完成 → 已退回 → 返工中 → 已完成 → 已交付
                 ↑                        ↑
                 └────────────────────────┘
```

### 返修状态流转
```
已提交 → 已归因 → 返工中 → 已解决 → 已关闭
   ↓         ↓        ↓         ↓
(提交申请) (责任归因) (开始返工) (质检通过)
```

## API 接口

### 基础路径：`http://localhost:3001/api`

### 枚举接口
```
GET /enums              # 获取所有枚举值
GET /enums/return-reasons  # 获取返修原因
GET /enums/departments     # 获取部门列表
```

### 处方接口
```
GET    /prescriptions              # 处方列表
POST   /prescriptions              # 创建处方
GET    /prescriptions/:id          # 处方详情
GET    /prescriptions/:id/details  # 处方详情（含批次）
PATCH  /prescriptions/:id/status   # 更新状态
```

### 批次接口
```
GET    /batches                    # 批次列表
POST   /batches                    # 创建批次（自动生成工序）
GET    /batches/:id                # 批次详情
GET    /batches/:id/workorders     # 批次工序
POST   /batches/:id/start          # 开始生产
POST   /batches/workorders/:id/complete  # 完成工序
POST   /batches/:id/reset-rework   # 重置返工
```

### 返修接口
```
GET    /returns                    # 返修列表
POST   /returns                    # 提交返修申请
GET    /returns/:id                # 返修详情
GET    /returns/:id/details        # 返修详情（含责任归因）
POST   /returns/:id/assign-responsibility  # 责任归因
POST   /returns/:id/start-rework   # 开始返工
POST   /returns/:id/resolve        # 解决返修
```

### 报表接口
```
GET    /reports/overview           # 总体统计
GET    /reports/responsibility     # 责任归因报表
GET    /reports/responsibility-stats  # 责任归因统计
GET    /reports/prescription/:id/history  # 处方返修历史
```

## 业务规则

### 强制约束（业务化错误）

| 错误码 | 说明 | 触发场景 |
|--------|------|----------|
| 40000 | 参数错误 | 缺少必填字段 |
| 40010 | 状态流转无效 | 跳过归因直接返工、未返工就解决 |
| 40011 | 无效责任部门 | 传入不存在的部门代码 |
| 40401 | 批次不存在 | 访问无效批次ID |
| 40402 | 处方不存在 | 访问无效处方ID |
| 40403 | 工序不存在 | 访问无效工序ID |
| 40404 | 返修申请不存在 | 访问无效返修ID |
| 40405 | 无效返修原因 | 传入不存在的原因代码 |
| 40900 | 数据冲突 | 批次不属于处方 |
| 40901 | 批次已完成 | 完成后再次开始生产 |
| 40904 | 已完成归因 | 重复进行责任归因 |

### 自动状态更新

1. **创建批次**：自动生成8道工序
2. **开始生产**：批次→生产中，处方→生产中
3. **完成所有工序**：批次→已完成，处方→已完成
4. **提交返修**：批次→已退回，处方→已退回，处方返修计数+1
5. **责任归因**：返修→已归因
6. **开始返工**：返修→返工中，处方→返工中，批次→返工中
7. **解决返修**：返修→已解决，处方→已完成，批次→已完成

## 响应格式

### 成功响应
```json
{
  "code": 0,
  "message": "操作成功",
  "data": { /* 业务数据 */ },
  "timestamp": 1715414400000
}
```

### 错误响应
```json
{
  "code": 40402,
  "message": "处方不存在",
  "details": null,
  "timestamp": 1715414400000
}
```

## 主流程演示（测试输出）

主流程测试会模拟完整业务场景，输出包含：
- 处方创建（状态：待生产）
- 批次创建（自动生成8道工序）
- 开始生产（状态：生产中）
- 完成所有工序（自动更新批次和处方状态）
- 提交返修申请（原因：颜色偏差）
- 责任归因（主：上瓷部，次：质检部）
- 开始返工
- 完成返工工序
- 解决返修
- 查看总体统计报表
- 查看责任归因报表

## 异常场景测试

18个异常场景全覆盖：
- 参数验证（缺少必填字段）
- 数据不存在（处方/批次/返修/工序）
- 状态流转限制（跳过归因、未返工就解决）
- 业务规则（重复归因、批次不匹配）
- 数据校验（无效原因、无效部门）

## 样例数据

测试脚本会自动生成样例数据，包括：
- 处方：张医生、患者李明、北京口腔医院
- 批次：BATCH-2026-0511-001、模型号MDL-001
- 返修原因：颜色偏差
- 责任归因：上瓷部、质检部

## 关键设计亮点

1. **模型批次追溯**：每个批次独立管理，支持同一处方多次返工
2. **工序自动生成**：创建批次时自动生成8道标准工序
3. **返修原因标准化**：10种预设原因，便于统计分析
4. **责任归因可追溯**：主/次责任部门、责任人、严重程度
5. **状态自动流转**：业务操作自动触发相关实体状态更新
6. **业务化错误码**：不是简单的HTTP错误，而是具有业务含义的错误码
7. **实时统计报表**：返修率、返工率、责任部门分布等

## 技术栈

- **Node.js** - 运行环境
- **Express** - Web框架
- **SQLite3** - 嵌入式数据库（无需安装）
- **UUID** - 生成唯一ID
- **Day.js** - 日期处理

## 注意事项

1. 服务默认端口为3001（避免与其他服务冲突）
2. 数据库文件位于 `data/dental.db`
3. 每次运行测试前会清空数据库重新初始化
4. 所有测试脚本都包含完整的错误处理和状态验证
