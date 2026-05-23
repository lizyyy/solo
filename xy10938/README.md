# 🚗 洗车会员排队API服务

本地后端API服务，提供完整的洗车店排队管理功能。

## ✨ 功能特性

- **会员管理**: 会员注册、查询、余额管理
- **工位管理**: 工位状态管理、自动分配
- **排队管理**: 取号、叫号、完成、过号、补排、取消
- **预约管理**: 会员预约、预约锁位
- **异常处理**: 完整的异常捕获和日志记录
- **报告导出**: 日报生成、CSV导出
- **数据持久化**: SQLite本地数据库

## 📁 项目结构

```
car-wash-queue-api/
├── config/
│   ├── app.js              # 应用配置
│   └── database.js         # 数据库配置
├── src/
│   ├── server.js           # 服务入口
│   ├── db.js               # 数据库连接
│   ├── middleware/
│   │   └── exceptionLogger.js  # 异常日志中间件
│   ├── routes/
│   │   ├── member.js       # 会员路由
│   │   ├── station.js      # 工位路由
│   │   ├── queue.js        # 排队路由
│   │   ├── appointment.js  # 预约路由
│   │   └── report.js       # 报告路由
│   └── services/
│       ├── memberService.js    # 会员业务
│       ├── stationService.js   # 工位业务
│       ├── queueService.js     # 排队业务
│       ├── appointmentService.js  # 预约业务
│       └── reportService.js    # 报告业务
├── scripts/
│   ├── init-db.js         # 数据库初始化
│   ├── seed-data.js       # 示例数据
│   └── self-test.js       # 自检脚本
├── data/                   # 数据库文件目录
├── package.json
├── API_DOCS.md           # 完整接口文档
└── README.md
```

## 🚀 快速开始

### 1. 安装依赖
```bash
npm install
```

### 2. 初始化数据库和示例数据
```bash
npm run setup
```

### 3. 运行自检（可选）
```bash
npm run test
```

### 4. 启动服务
```bash
npm start
```

服务启动后访问: http://localhost:3000

## 🔧 NPM 命令

| 命令 | 说明 |
|------|------|
| `npm start` | 启动服务 |
| `npm run dev` | 开发模式（自动重启） |
| `npm run init-db` | 初始化数据库 |
| `npm run seed` | 插入示例数据 |
| `npm run setup` | 初始化 + 示例数据 |
| `npm run test` | 运行自检脚本 |

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

自检脚本覆盖以下测试场景：

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

## 📋 示例数据

运行 `npm run seed` 后会插入：
- 5个测试会员（张三、李四、王五、赵六、孙七）
- 4个工位
- 8条排队记录（包含各种状态）

## 🛠️ 技术栈

- **Node.js** - 运行环境
- **Express** - Web框架
- **SQLite (better-sqlite3)** - 数据库
- **Moment.js** - 时间处理
- **CORS** - 跨域支持

## 📄 License

MIT
