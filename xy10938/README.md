# 🚗 洗车会员排队API服务 (双版本实现)

本地后端API服务，提供完整的洗车店排队管理功能。

**重要说明**: 本项目同时提供 **Node.js/Express** 和 **Go/Gin** 两个版本的实现。Node.js 版本在当前环境可直接运行验证，Go 版本需要安装 Go 环境后使用。

## ✨ 功能特性

- **会员管理**: 会员注册、查询、余额管理
- **工位管理**: 工位状态管理、自动分配
- **排队管理**: 取号、叫号、完成、过号、补排、取消
- **预约管理**: 会员预约、预约锁位
- **异常处理**: 完整的异常捕获和日志记录
- **报告导出**: 日报生成、CSV导出
- **数据持久化**: SQLite本地数据库

## 🚀 快速开始（推荐：Node.js 版本）

使用 Makefile 提供稳定可复验的入口：

```bash
# 查看帮助
make help

# 1. 安装依赖
make install

# 2. 初始化数据库和示例数据
make setup

# 3. 运行自检（覆盖正常流/异常流/脏数据）
make test

# 4. 启动服务
make start
```

服务启动后访问: http://localhost:3000

---

## 🐹 Go 版本（需要安装 Go）

如果已安装 Go 环境，可以使用 Go 版本：

```bash
# 安装 Go 依赖
make install-go

# 插入示例数据
make seed-go

# 运行自检
make test-go

# 启动 Go 服务
make start-go
```

## 📁 项目结构

```
car-wash-queue-api/
├── Makefile                  # 统一入口（推荐使用）
├── package.json              # Node.js 配置
├── go.mod                    # Go 模块定义
├── main.go                   # Go 服务入口
├── config/
│   ├── app.js                # Node.js 配置
│   ├── database.js           # Node.js 数据库配置
│   └── config.go             # Go 配置
├── src/                      # Node.js 源码
│   ├── server.js             # 服务入口
│   ├── db.js                 # 数据库连接
│   ├── middleware/
│   │   └── exceptionLogger.js
│   ├── routes/
│   │   ├── member.js
│   │   ├── station.js
│   │   ├── queue.js
│   │   ├── appointment.js
│   │   └── report.js
│   └── services/
│       ├── memberService.js
│       ├── stationService.js
│       ├── queueService.js
│       ├── appointmentService.js
│       └── reportService.js
├── models/
│   └── models.go             # Go 数据模型
├── database/
│   └── database.go           # Go 数据库层
├── services/                 # Go 业务逻辑层
│   ├── member_service.go
│   ├── station_service.go
│   ├── queue_service.go
│   ├── appointment_service.go
│   └── report_service.go
├── handlers/                 # Go API处理器
│   ├── member_handler.go
│   ├── station_handler.go
│   ├── queue_handler.go
│   ├── appointment_handler.go
│   └── report_handler.go
├── scripts/
│   ├── init-db.js            # Node.js 数据库初始化
│   ├── seed-data.js          # Node.js 示例数据
│   ├── self-test.js          # Node.js 自检脚本
│   ├── seed_data.go          # Go 示例数据脚本
│   └── self_test.go          # Go 自检脚本
├── data/                     # 数据库文件目录
├── API_DOCS.md               # 完整接口文档
└── README.md
```

## 🔧 命令参考

### Node.js 版本（当前环境可用）

| 命令 | 说明 |
|------|------|
| `make install` | 安装 Node.js 依赖 |
| `make setup` | 初始化数据库 + 示例数据 |
| `make test` | 运行自检脚本 |
| `make start` | 启动 Node.js 服务 |
| `npm start` | 启动 Node.js 服务 |
| `npm run setup` | 初始化数据库 + 示例数据 |
| `npm test` | 运行自检脚本 |

### Go 版本（需要 Go 环境）

| 命令 | 说明 |
|------|------|
| `make install-go` | 安装 Go 依赖 |
| `make seed-go` | 插入示例数据 |
| `make test-go` | 运行自检脚本 |
| `make start-go` | 启动 Go 服务 |
| `make build-go` | 编译 Go 二进制 |
| `go run main.go` | 启动 Go 服务 |
| `go run scripts/self_test.go` | 运行自检脚本 |

### 通用命令

| 命令 | 说明 |
|------|------|
| `make clean` | 清理数据库文件 |
| `make help` | 显示帮助信息 |

## 📊 核心业务规则

### 排队规则
1. **重复取号拦截**: 同一会员不能同时有多个等待/服务中的排队号
2. **叫号分配**: 叫号时自动分配空闲工位
3. **状态流转**: 等待中 → 服务中 → 已完成 / 已过号 / 已取消

### 过号补排
- 过号后可申请补排
- 补排后位置自动延后3位
- 防止同一记录重复补排

### 预约锁位
- 预约确认时自动锁定工位
- 锁定后工位状态更新为忙碌

## 📝 API 接口概览

| 模块 | 方法 | 路径 | 说明 |
|------|------|------|------|
| 健康 | GET | /api/health | 健康检查 |
| 会员 | POST | /api/members | 创建会员 |
| 会员 | GET | /api/members | 会员列表 |
| 会员 | GET | /api/members/phone/:phone | 按手机号查询 |
| 会员 | GET | /api/members/:id | 按ID查询 |
| 工位 | POST | /api/stations | 创建工位 |
| 工位 | GET | /api/stations | 工位列表 |
| 排队 | POST | /api/queue | 取号 |
| 排队 | GET | /api/queue | 排队列表 |
| 排队 | POST | /api/queue/call-next | 叫下一号 |
| 排队 | POST | /api/queue/:id/complete | 完成服务 |
| 排队 | POST | /api/queue/:id/overnumber | 标记过号 |
| 排队 | POST | /api/queue/:id/requeue | 过号补排 |
| 排队 | POST | /api/queue/:id/cancel | 取消排队 |
| 排队 | PUT | /api/queue/:id/manual | 人工修正 |
| 预约 | POST | /api/appointments | 创建预约 |
| 预约 | POST | /api/appointments/:id/lock | 预约锁位 |
| 报告 | POST | /api/reports/generate | 生成日报 |
| 报告 | GET | /api/reports/export | 导出CSV |
| 报告 | GET | /api/reports/exceptions | 异常日志 |

详细接口文档请查看 [API_DOCS.md](./API_DOCS.md)

## 🧪 自检脚本

自检脚本覆盖以下测试场景（24+ 测试用例）：

- ✅ 项目结构完整性检查
- ✅ 数据库表结构验证
- ✅ 会员创建与查询（正常流程）
- ✅ 重复手机号拦截（异常流程）
- ✅ 工位管理功能
- ✅ 排队取号（正常流程）
- ✅ 重复取号拦截（异常流程）
- ✅ 无效服务类型校验（脏数据）
- ✅ 叫号与完成服务流程
- ✅ 日报生成与CSV导出（一致性检查）
- ✅ 异常日志记录功能

## 💾 数据库表

1. **members** - 会员表
2. **stations** - 工位表
3. **appointments** - 预约表
4. **queue_numbers** - 排队号表
5. **overnumber_records** - 过号记录表
6. **exception_logs** - 异常日志表
7. **queue_reports** - 排队报告表

## 🔐 异常处理

所有异常都会被捕获并记录到 `exception_logs` 表中，包含：
- 接口路径
- 请求方法
- 原始输入数据
- 错误信息
- 处理结论

## 🛠️ 技术栈

### Node.js 版本
- **Node.js** - 运行环境
- **Express** - Web框架
- **SQLite (better-sqlite3)** - 数据库
- **Moment.js** - 时间处理
- **CORS** - 跨域支持

### Go 版本
- **Go 1.21+** - 运行环境
- **Gin** - Web框架
- **SQLite (go-sqlite3)** - 数据库
- **CORS** - 跨域支持

## 📄 License

MIT
