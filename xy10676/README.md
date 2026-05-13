# 合同归档续约提醒管理系统

一个全栈 Web 应用，提供统一的合同管理入口，整合电子签状态、纸质归档、风险报告等功能。

## 功能特性

### 前端功能
- 🔍 搜索过滤：按合同编号、名称、甲乙双方搜索
- 📋 列表筛选：按电子签状态、纸质归档、负责人筛选
- 🚨 异常看板：合同到期、待签署、未归档等异常提醒
- 📊 数据看板：统计合同总数、生效合同、待签合同等
- 📄 报告导出：按责任人和处理时间筛选，支持 CSV 导出
- 📝 变更历史：保留电子签状态、纸质归档、付款节点的修改前后值

### 后端业务规则
- ✅ 付款节点变更需复核审批
- ✅ 续约条款拦截：无续约条款无法标记续约
- ✅ 提前续约拦截：距离到期超过 30 天无法续约
- ✅ 重复提交拦截：合同编号唯一校验
- ✅ 操作记录：每次流转保存操作人和时间

## 本地启动

### 环境要求
- Node.js >= 16
- npm 或 yarn

### 安装依赖
```bash
# 安装根目录依赖
npm install

# 安装后端依赖
cd backend
npm install
cd ..

# 安装前端依赖
cd frontend
npm install
cd ..

# 或一键安装
npm run install:all
```

### 初始化数据库
```bash
# 创建数据库表
npm run init:db

# 导入样例数据
npm run seed
```

### 启动应用
```bash
# 同时启动前后端
npm run dev

# 或分别启动
npm run server  # 后端端口 3001
npm run client  # 前端端口 3000
```

访问 http://localhost:3000 即可使用系统。

## 接口演示

### 合同相关接口

#### 1. 获取合同列表
```bash
GET /api/contracts?page=1&limit=10&search=软件开发&electronic_sign_status=signed&responsible_person=李员工

# 响应
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 4,
    "totalPages": 1
  }
}
```

#### 2. 创建合同（成功路径）
```bash
POST /api/contracts
Content-Type: application/json

{
  "contract_no": "HT-2024-005",
  "contract_name": "技术咨询服务合同",
  "party_a": "甲方科技有限公司",
  "party_b": "乙方咨询公司",
  "contract_amount": 50000,
  "start_date": "2024-01-01",
  "end_date": "2024-12-31",
  "renewal_clause": "双方无异议自动续约",
  "electronic_sign_status": "pending",
  "paper_archived": 0,
  "payment_nodes": [
    {"date": "2024-01-01", "amount": 25000, "description": "首付款"},
    {"date": "2024-07-01", "amount": 25000, "description": "尾款"}
  ],
  "responsible_person": "李员工",
  "status": "active"
}
```

#### 3. 失败路径：重复提交合同
```bash
POST /api/contracts
Content-Type: application/json

{
  "contract_no": "HT-2024-001",  # 已存在的合同编号
  "contract_name": "重复合同",
  ...
}

# 响应 (400 Bad Request)
{
  "error": "合同编号已存在"
}
```

#### 4. 更新合同状态
```bash
PUT /api/contracts/1
Content-Type: application/json

{
  "electronic_sign_status": "signed",
  "paper_archived": 1,
  "changed_by": "李员工"
}

# 响应
{
  "message": "更新成功",
  "changes": 2,
  "fields": ["electronic_sign_status", "paper_archived"]
}
```

#### 5. 失败路径：无续约条款时标记续约
```bash
PUT /api/contracts/2  # HT-2024-002 无续约条款
Content-Type: application/json

{
  "status": "renewed",
  "changed_by": "李员工"
}

# 响应 (400 Bad Request)
{
  "error": "无续约条款，无法标记为已续约",
  "code": "NO_RENEWAL_CLAUSE"
}
```

#### 6. 失败路径：提前续约（距离到期超过30天）
```bash
PUT /api/contracts/4  # HT-2024-004 距离到期超过30天
Content-Type: application/json

{
  "status": "renewed",
  "changed_by": "李员工"
}

# 响应 (400 Bad Request)
{
  "error": "距离合同到期超过30天，无法提前续约",
  "days_until_end": 180,
  "code": "RENEWAL_TOO_EARLY"
}
```

### 付款节点变更（需复核流程）

#### 1. 提交付款节点变更
```bash
PUT /api/contracts/1
Content-Type: application/json

{
  "payment_nodes": [
    {"date": "2024-01-01", "amount": 30000, "description": "首付款（变更后）"},  # 金额从25000改为30000
    {"date": "2024-07-01", "amount": 20000, "description": "尾款"}
  ],
  "changed_by": "李员工"
}

# 响应 (202 Accepted)
{
  "message": "付款节点变更需复核，已提交审批",
  "flow_id": 1,
  "requires_review": true
}
```

#### 2. 复核审批付款节点变更
```bash
PUT /api/flows/1/review
Content-Type: application/json

{
  "reviewed_by": "张经理",
  "review_status": "approved",
  "comments": "同意变更"
}

# 响应
{
  "message": "复核通过",
  "flow_id": 1
}
```

### 异常相关接口

#### 1. 扫描并生成异常
```bash
POST /api/exceptions/generate

# 响应
{
  "message": "异常扫描完成，新增 5 条异常记录",
  "total_scanned": 4,
  "new_exceptions": 5
}
```

#### 2. 获取异常列表
```bash
GET /api/exceptions?resolved=false&severity=high
```

### 报告导出接口

#### 1. 按负责人筛选导出
```bash
GET /api/reports/contracts?responsible_person=李员工&start_date=2024-01-01&end_date=2024-12-31&format=csv
```

## 样例数据说明

导入样例数据后，系统包含以下测试数据：

### 用户
- 系统管理员 (manager)
- 张经理 (manager) - 有复核权限
- 李员工 (user)
- 王员工 (user)

### 合同
1. **HT-2024-001** - 软件开发服务合同（已签署、已归档、即将到期）
2. **HT-2024-002** - 设备采购合同（待签署、未归档、5天后到期）
3. **HT-2024-003** - 年度运维服务合同（已到期）
4. **HT-2024-004** - 咨询服务合同（待签署、未归档）

## 数据库表结构

### contracts - 合同主表
- id, contract_no, contract_name, party_a, party_b
- contract_amount, start_date, end_date, renewal_clause
- electronic_sign_status, paper_archived, payment_nodes
- responsible_person, status, created_at, updated_at

### status_history - 状态历史表
- id, contract_id, field_name, old_value, new_value
- changed_by, changed_at

### flow_records - 流转记录表
- id, contract_id, action_type, action_data
- operator, reviewed_by, reviewed_at, review_status
- comments, created_at

### exceptions - 异常表
- id, contract_id, exception_type, description, severity
- resolved, resolved_by, resolved_at, created_at

### users - 用户表
- id, username, name, role, created_at

## 技术栈

### 后端
- Node.js + Express
- SQLite3 数据库
- Joi 参数校验
- json2csv 导出

### 前端
- React 18
- React Router 6
- Ant Design 5
- Axios HTTP 客户端
- Day.js 日期处理
