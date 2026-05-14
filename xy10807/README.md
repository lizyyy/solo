# 多租户 API 权限矩阵系统

一个企业级的多租户 API 权限管理系统，支持部门级权限控制、权限继承、审批流、调用拦截等功能。

## 技术栈

- **后端**: Node.js + Express + SQLite
- **前端**: React + Axios
- **权限规则**: RBAC (基于角色的访问控制) + 权限继承

## 核心功能

### 数据模型
1. **租户 (Tenant)**: 企业级隔离，支持多租户
2. **部门 (Department)**: 树形层级结构，支持父子部门
3. **角色 (Role)**: 部门内的职位角色
4. **API 资源 (API Resource)**: 受保护的接口资源，含敏感度级别
5. **权限包 (Permission Package)**: 权限的集合，支持可继承配置
6. **审批记录 (Approval)**: 权限变更审批流程
7. **调用拒绝 (Rejection)**: 无权限调用记录

### 权限规则
- ✅ **权限继承**: 子部门自动继承上级部门的可继承权限
- ✅ **最小权限校验**: 三级权限体系 (read → write → admin)
- ✅ **审批流**: 权限变更需审批流程
- ✅ **调用拦截**: 无权限调用自动拦截并记录
- ✅ **矩阵导出**: 完整权限矩阵支持 CSV 导出

### 界面功能
- **控制台**: API 调用测试、系统概览
- **异常队列**: 调用拒绝记录管理、人工修正
- **状态按钮**: 审批通过/拒绝操作
- **历史轨迹**: 所有调用请求日志，含输入、结果、责任节点
- **导出入口**: 权限矩阵 CSV 导出

## 快速开始

### 1. 安装依赖

```bash
# 安装根目录依赖（用于同时启动前后端）
npm install

# 安装后端依赖
cd server && npm install && cd ..

# 安装前端依赖
cd client && npm install && cd ..
```

### 2. 初始化数据

```bash
# 执行种子数据脚本
npm run seed
```

初始化后会创建以下示例数据：
- **租户**: ACME 科技有限公司
- **部门**: 技术部、财务部、后端开发组（隶属于技术部）
- **角色**: 技术总监、后端开发工程师、财务专员
- **API 资源**: 用户列表查询、用户创建、财务报表、系统配置、日志查询
- **权限包**: 基础权限包（可继承）、开发权限包、财务权限包、管理员权限包

### 3. 启动服务

```bash
# 方式一：同时启动前后端（推荐）
npm run dev

# 方式二：分别启动
# 后端服务 (端口 3001)
cd server && npm run dev

# 前端服务 (端口 3000)
cd client && npm start
```

访问地址: http://localhost:3000

## API 接口文档

### 租户管理
```bash
# 获取所有租户
GET /api/tenants

# 创建租户
POST /api/tenants
{ "name": "租户名称"
```

### 部门管理
```bash
# 获取租户下所有部门
GET /api/tenants/:tenantId/departments

# 创建部门
POST /api/tenants/:tenantId/departments
{ "name": "部门名称", "parent_id": "父部门ID" }
```

### 角色管理
```bash
# 获取部门下所有角色
GET /api/departments/:departmentId/roles

# 创建角色
POST /api/departments/:departmentId/roles
{ "name": "角色名称", "description": "描述" }
```

### API 资源管理
```bash
# 获取所有 API 资源
GET /api/api-resources

# 创建 API 资源
POST /api/api-resources
{ "name": "API名称", "path": "/api/xxx", "method": "GET", "description": "描述", "sensitivity_level": "normal" }
```

### 权限包管理
```bash
# 获取租户下所有权限包
GET /api/tenants/:tenantId/permission-packages

# 创建权限包
POST /api/tenants/:tenantId/permission-packages
{ "name": "权限包名称", "description": "描述", "is_inheritable": true }

# 给权限包添加 API 权限
POST /api/permission-packages/:packageId/permissions
{ "api_resource_id": "APIID", "access_level": "read" }

# 给角色分配权限包
POST /api/roles/:roleId/assign-package
{ "package_id": "权限包ID", "assigned_by": "操作人" }
```

### 权限检查与调用
```bash
# 检查角色权限（含继承）
GET /api/roles/:roleId/permissions?department_id=xxx&tenant_id=xxx

# 调用 API（会检查权限）
POST /api/call-api
{
  "tenant_id": "租户ID",
  "department_id": "部门ID",
  "role_id": "角色ID",
  "api_resource_id": "API资源ID",
  "requester": "请求人",
  "input": { "请求参数对象" }
}

# 单独检查权限
POST /api/check-permission
{
  "tenant_id": "租户ID",
  "department_id": "部门ID",
  "role_id": "角色ID",
  "api_resource_id": "API资源ID",
  "required_access_level": "read"
}
```

### 审批流程
```bash
# 获取审批列表
GET /api/approvals?tenant_id=xxx&status=pending

# 创建审批
POST /api/approvals
{
  "tenant_id": "租户ID",
  "department_id": "部门ID",
  "role_id": "角色ID",
  "requester": "请求人",
  "request_type": "PERMISSION_REQUEST",
  "request_data": { "原因": "..." }
}

# 通过审批
POST /api/approvals/:approvalId/approve
{ "approver": "审批人", "comment": "审批意见" }

# 拒绝审批
POST /api/approvals/:approvalId/reject
{ "approver": "审批人", "comment": "拒绝原因" }
```

### 异常与日志
```bash
# 获取调用拒绝列表
GET /api/rejections?tenant_id=xxx&resolved=false

# 人工修正（人工修正
POST /api/rejections/:rejectionId/resolve
{ "resolved_by": "操作人" }

# 获取请求日志
GET /api/request-logs?tenant_id=xxx&limit=50

# 获取权限矩阵
GET /api/tenants/:tenantId/permission-matrix

# 导出权限矩阵 CSV
GET /api/tenants/:tenantId/permission-matrix/export
```

## 测试场景

### 场景 1: 成功调用

1. 在控制台选择
2. 部门选择"后端开发组"
3. 角色选择"后端开发工程师"
4. API 选择"用户列表查询"
5. 点击"执行 API 调用"
6. 预期结果: ✅ 调用成功

### 场景 2: 无权限（调用被拒绝

1. 在控制台选择
2. 部门选择"后端开发组"
3. 角色选择"后端开发工程师"
4. API 选择"财务报表"
5. 点击"执行 API 调用"
6. 预期结果: ❌ 调用失败（无权限）
7. 查看"异常队列"，可以看到拒绝记录

### 场景 3: 提交审批

1. 点击"场景 3: 提交审批"按钮
2. 切换到"审批流程"标签页
3. 可以看到新创建的待审批记录
4. 点击"✅ 通过"或"❌ 拒绝"进行审批
5. 审批状态会实时更新

### 场景 4: 人工修正异常

1. 先执行场景 2 产生一条拒绝记录
2. 切换到"异常队列"标签页
3. 找到待处理记录，点击"✅ 人工修正"
4. 记录状态变为已处理

### 场景 5: 查看调用历史

1. 执行几次 API 调用后
2. 切换到"历史轨迹"标签页
3. 可以看到所有调用记录
4. 每条记录包含: 时间、请求者、责任节点、状态、错误信息

### 场景 6: 权限继承验证

1. 选择部门"后端开发组"，角色"后端开发工程师"
2. 查看当前角色权限，会显示继承自"技术部"的可继承权限
3. 权限标签上有"👴 继承"标识，表示来自上级部门

### 场景 7: 导出权限矩阵

1. 切换到"权限矩阵"标签页
2. 点击右上角"📥 导出 CSV"按钮
3. 浏览器会下载完整的权限矩阵文件

## 项目结构

```
.
├── server/                 # 后端服务
│   ├── src/
│   │   ├── index.js          # 入口文件
│   │   ├── database.js      # 数据库初始化
│   │   ├── routes.js       # API 路由
│   │   ├── seed.js         # 种子数据
│   │   └── services/
│   │       └── permissionService.js  # 权限服务
│   ├── data/               # SQLite 数据库文件
│   └── package.json
├── client/                 # 前端应用
│   ├── public/
│   ├── src/
│   │   ├── index.js
│   │   └── App.js          # 主界面组件
│   └── package.json
├── package.json             # 根项目配置
└── README.md
```

## 核心权限级别说明

| 级别 | 说明 | 颜色 |
|------|------|------|
| read | 只读权限，可查看数据 | 绿色 |
| write | 读写权限，可修改数据 | 蓝色 |
| admin | 管理权限，完整操作 | 紫色 |

高级别权限自动包含低级别权限的所有能力。

## 权限继承规则

1. 子部门会继承父部门所有标记为"可继承"的权限包
2. 权限包的"is_inheritable"字段控制是否可被继承
3. 继承的权限会在界面上显示"👴 继承"标识
4. 子部门可以拥有的权限优先级高于继承的权限

## 数据持久化

所有数据存储在 SQLite 数据库中 (server/data/permissions.db)，刷新页面后数据不会丢失。包括：
- 所有请求的输入参数
- 调用结果
- 责任节点信息
- 审批状态
- 异常处理记录

## 开发说明

### 后端开发
```bash
cd server
npm run dev    # 开发模式，自动重启
```

### 前端开发
```bash
cd client
npm start      # 开发模式，热重载
```

## License

MIT
