# 园区访客通行验收回放链路服务

## 概述

园区访客通行验收回放链路服务 - 管理访客预约、闸机记录、临时车牌的导入、对账和导出。

## 快速开始

### 1. 编译项目

```bash
go mod tidy
go build -o visitor-pass .
```

### 2. 初始化数据库

```bash
./visitor-pass init
```

### 3. 启动API服务

```bash
./visitor-pass serve
# 或指定端口
./visitor-pass serve -p 8080
```

### 4. 运行测试数据演示

```bash
# 先启动服务，然后另开终端执行
./visitor-pass gendata
```

## 默认账号

密码同用户名：

| 用户名 | 角色 | 权限说明 |
|--------|------|----------|
| supervisor | 主管 | 所有权限、用户管理、冻结数据 |
| reviewer | 复核员 | 复核数据、发起对账、查看审计日志 |
| data_entry | 录入员 | 导入数据、查看数据 |
| readonly | 只读 | 仅查看数据 |

## CLI 命令

```
visitor-pass init     # 初始化数据库
visitor-pass serve    # 启动API服务
visitor-pass gendata  # 生成测试数据并演示完整流程
visitor-pass help     # 查看帮助
```

## API 接口

### 认证
```
POST /api/auth/login
Content-Type: application/json
{
  "username": "supervisor",
  "password": "supervisor"
}
```

### 导入数据
```
POST /api/import/appointments   # 导入访客预约
POST /api/import/gate-records  # 导入闸机记录
POST /api/import/plate-images  # 导入临时车牌截图
```

### 查询
```
GET /api/appointments?batch_id=xxx
GET /api/gate-records?batch_id=xxx
GET /api/plate-images?batch_id=xxx
GET /api/batches
GET /api/import/failures?batch_id=xxx
```

### 操作
```
POST /api/appointments/:id/review    # 复核预约
POST /api/appointments/:id/freeze    # 冻结预约
POST /api/batches/:id/freeze         # 冻结批次
POST /api/reconciliation/run?batch_id=xxx  # 执行对账
GET  /api/reconciliation/results     # 对账结果
GET  /api/reconciliation/export/:id  # 导出报表
```

### 审计
```
GET /api/audit/logs
```

## 核心功能

### 1. 权限控制
- **录入员**: 只能导入和查看数据，敏感字段不可见
- **复核员**: 可以复核数据、发起对账、查看审计日志
- **主管**: 所有权限，包括用户管理、冻结数据
- **只读**: 只能查看数据，不能修改

### 2. 状态冻结
- 冻结后的记录和批次无法修改
- 确保数据完整性和审计可追溯性

### 3. 坏数据隔离
- 导入失败的记录单独存储在 import_failures 表
- 失败原因和字段错误可查
- 不影响正常数据的汇总统计

### 4. 跨日风险检测
- 自动检测过期未收回权限
- 检测跨日未出场访客（有入场无出场）
- 对账结果中列出所有异常详情

### 5. 审计日志
- 所有操作都记录审计日志
- 包含用户、动作、资源、IP、时间等信息

## 数据持久化

数据存储在 `~/.visitor-pass/visitor.db` (SQLite)

重启服务后所有数据保留。

## 目录结构

```
.
├── cmd/                    # CLI命令
│   ├── root.go            # 根命令
│   ├── init.go            # 初始化命令
│   ├── serve.go           # 启动服务
│   └── gendata.go         # 测试数据生成
├── internal/
│   ├── api/               # API层
│   │   ├── router.go      # 路由定义
│   │   ├── handler.go     # 请求处理
│   │   └── middleware.go  # 中间件（认证、权限、审计）
│   ├── auth/              # 认证权限
│   │   └── auth.go        # JWT、密码哈希、RBAC权限
│   ├── config/            # 配置
│   │   └── config.go      # 数据库配置
│   ├── model/             # 数据模型
│   │   └── model.go       # 所有实体定义
│   ├── repository/        # 数据访问层
│   │   ├── migrate.go     # 数据库迁移
│   │   ├── audit.go       # 审计和用户操作
│   │   └── repository.go  # CRUD操作
│   └── service/           # 业务逻辑
│       └── reconciliation.go  # 对账、导入、验证
├── main.go                # 入口
├── go.mod
└── README.md
```

## 退出码

| 退出码 | 说明 |
|--------|------|
| 0 | 成功 |
| 1 | 通用错误 |

## 安保主管视角重点

1. **命令脚本**: 所有操作可通过CLI或API自动化
2. **HTTP读写**: RESTful API，支持集成到现有系统
3. **本地持久化**: SQLite数据库，数据不丢，重启可查
4. **数据可追溯**: 每个汇总数字都能追到单条记录
5. **状态冻结**: 冻结后数据不可篡改，保证审计完整性
6. **坏数据隔离**: 失败数据单独存放，不污染汇总
