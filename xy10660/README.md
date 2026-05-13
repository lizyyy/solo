# 企业证照年检催办系统

## 项目概述

企业证照年检催办全栈Web应用，解决企业证照管理混乱、负责人不清晰、年检超期等问题。

### 核心功能

1. **证照列表管理**：查看所有企业证照信息，支持按公司、类型、状态筛选
2. **Excel导入导出**：批量导入证照数据，导出报表
3. **年检提交流程**：内置四条演示路径
4. **操作时间线**：记录每一步操作，重启后数据不丢失
5. **幂等性保障**：防止重复提交
6. **异常拦截**：负责人缺失自动拦截

### 技术栈

- **后端**：Node.js + Express + SQLite
- **前端**：React + Ant Design
- **数据处理**：xlsx (Excel导入导出)

## 快速开始

### 1. 安装依赖

```bash
# 安装后端依赖
npm install

# 安装前端依赖
cd client
npm install
cd ..
```

### 2. 初始化数据库和测试数据

```bash
npm run init-db
```

### 3. 启动服务

#### 方式一：同时启动前后端

```bash
npm run dev
```

#### 方式二：分别启动

```bash
# 启动后端 (端口 3001)
npm run server

# 启动前端 (端口 3000)
cd client
npm start
```

### 4. 访问应用

打开浏览器访问：http://localhost:3000

## 演示路径说明

系统内置四条演示路径，可在左侧边栏直接点击：

| 路径 | 按钮 | 说明 |
|------|------|------|
| 成功路径 | 绿色 | 材料齐全、负责人有效、审核通过 |
| 拦截路径 | 红色 | 负责人信息缺失，系统自动拦截 |
| 人工修正 | 蓝色 | 缺少已审核材料，进入人工复核流程 |
| 重复提交 | 紫色 | 演示幂等性校验，重复请求自动去重 |

### 每条路径展示的规则：

1. **成功路径**：验证完整的年检提交流程
2. **拦截路径**：展示负责人异常的拦截规则
3. **人工修正**：展示材料附件复核流程
4. **重复提交**：展示幂等性机制，避免重复操作

## API接口说明

### 证照管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/licenses | 获取证照列表，支持筛选 |
| GET | /api/licenses/:id | 获取单个证照详情 |
| POST | /api/licenses | 创建证照记录 |
| PUT | /api/licenses/:id | 更新证照信息 |
| POST | /api/licenses/:id/submit | 提交年检申请 |
| POST | /api/licenses/:id/review | 人工审核 |
| GET | /api/licenses/:id/timeline | 获取证照操作时间线 |

### 导入导出

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/licenses/export | 导出Excel报表 |
| POST | /api/licenses/import | 批量导入Excel数据 |

### 公司管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/companies | 获取公司列表 |
| POST | /api/companies | 新增公司 |

### 操作日志

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/logs | 获取操作日志 |

### 演示接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/demo/success | 触发成功路径演示 |
| POST | /api/demo/blocked | 触发拦截路径演示 |
| POST | /api/demo/manual | 触发人工修正演示 |
| POST | /api/demo/duplicate | 触发重复提交通路演示 |

## 业务规则说明

### 1. 年检截止日期变更

- 在更新证照时自动记录变更历史
- 时间线中可查看每次变更的具体时间和操作人

### 2. 负责人异常处理

- 提交年检时校验负责人信息是否存在
- 负责人缺失时自动拦截，并记录失败原因
- 操作状态标记为 `blocked`

### 3. 材料附件复核

- 提交前检查是否存在已审核的附件
- 缺少已审核附件时进入 `reviewing` 状态
- 需要人工审核后才能完成年检

### 4. 幂等性机制

- 通过 `requestId` 实现请求去重
- 重复提交返回已有结果，不产生副作用
- 操作状态标记为 `idempotent`

### 5. 失败原因记录

- 所有失败操作都记录详细原因
- 可在时间线和操作日志中查看
- 支持问题追溯和排查

## 数据模型

### companies (公司表)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT | 主键 |
| name | TEXT | 公司名称 |
| credit_code | TEXT | 统一社会信用代码 |
| registered_address | TEXT | 注册地址 |
| legal_representative | TEXT | 法人代表 |

### license_types (证照类型表)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT | 主键 |
| name | TEXT | 类型名称 |
| code | TEXT | 类型编码 |
| description | TEXT | 描述 |
| validity_period | INTEGER | 有效期(天) |

### licenses (证照表)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT | 主键 |
| company_id | TEXT | 关联公司ID |
| license_type_id | TEXT | 关联证照类型ID |
| license_number | TEXT | 证照编号 |
| issue_date | DATE | 发证日期 |
| expiry_date | DATE | 有效期至 |
| annual_check_deadline | DATE | 年检截止日期 |
| responsible_person | TEXT | 负责人 |
| responsible_phone | TEXT | 联系电话 |
| status | TEXT | 状态: pending/completed/reviewing |
| risk_level | TEXT | 风险等级: low/medium/high |

### attachments (附件表)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT | 主键 |
| license_id | TEXT | 关联证照ID |
| file_name | TEXT | 文件名 |
| file_path | TEXT | 文件路径 |
| file_size | INTEGER | 文件大小 |
| uploader | TEXT | 上传人 |
| status | TEXT | 状态: pending/approved/rejected |
| reviewed_by | TEXT | 审核人 |
| reviewed_at | DATETIME | 审核时间 |
| review_comment | TEXT | 审核意见 |

### operation_logs (操作日志表)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT | 主键 |
| license_id | TEXT | 关联证照ID |
| operation_type | TEXT | 操作类型 |
| operation_status | TEXT | 操作状态: success/blocked/manual/idempotent |
| operator | TEXT | 操作人 |
| details | TEXT | 操作详情 |
| failure_reason | TEXT | 失败原因 |
| request_id | TEXT | 请求ID(用于幂等) |
| created_at | DATETIME | 创建时间 |

## 目录结构

```
.
├── server/
│   ├── index.js              # 服务入口
│   ├── database.js           # 数据库配置
│   ├── routes/
│   │   ├── licenses.js       # 证照路由
│   │   ├── companies.js      # 公司路由
│   │   ├── logs.js           # 日志路由
│   │   └── demo.js           # 演示路由
│   ├── services/
│   │   ├── licenseService.js # 证照业务逻辑
│   │   ├── exportService.js  # 导出服务
│   │   └── importService.js  # 导入服务
│   └── scripts/
│       └── initData.js       # 初始化数据脚本
├── client/
│   ├── src/
│   │   ├── index.js          # 前端入口
│   │   └── App.js            # 主应用组件
│   └── package.json
├── data/                      # SQLite数据库文件
├── uploads/                   # 文件上传目录
├── package.json
└── README.md
```

## 报告查看

### 1. 操作日志

在主页面下方可查看最近10条操作日志，包含：
- 操作类型
- 操作状态（不同颜色区分）
- 操作详情
- 失败原因（如有）
- 操作人
- 操作时间

### 2. 证照时间线

点击证照列表中的「查看时间线」，可查看该证照的完整操作历史，按时间顺序展示，包含每次操作的状态和详细信息。

### 3. Excel导出报表

点击「导出Excel」可下载完整的证照列表报表，包含：
- 公司名称
- 统一社会信用代码
- 证照类型
- 证照编号
- 发证日期
- 有效期至
- 年检截止日期
- 负责人
- 联系电话
- 状态
- 风险等级

## 常见问题

### Q: 如何重置数据库？
A: 删除 `data/license.db` 文件，然后重新运行 `npm run init-db`。

### Q: 如何添加更多演示数据？
A: 可修改 `server/scripts/initData.js` 文件，添加更多测试数据后重新运行初始化脚本。

### Q: 端口被占用怎么办？
A: 修改 `server/index.js` 中的端口号，或修改 `client/package.json` 中的proxy配置。

## 许可证

MIT License
