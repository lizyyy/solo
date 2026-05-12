# 课程直播回放授权管理系统

专为教育机构设计的课程直播回放权限管理平台，解决退费后仍能观看、多账号共享、权限过期等问题。

## ✨ 核心功能

### 🔐 权限管理
- **自动授权**：学员报名时自动授予对应班级所有场次的回放权限
- **自动回收**：退费时自动回收该学员对应班级的所有回放权限
- **手动管理**：支持教务人员手动回收或恢复权限

### 🔄 转班流程
- 一键完成学员转班操作
- 自动回收原班级权限
- 自动授予新班级权限
- 完整记录转班历史

### 💰 退费管理
- 退费后立即回收权限
- 记录退费原因和操作人
- 防止退费学员继续观看

### ⚠️ 异常检测
系统自动检测以下异常情况：

| 异常类型 | 严重程度 | 说明 | 处理方式 |
|---------|---------|------|---------|
| 退费后仍有权限 | 🔴 高危 | 学员已退费但权限仍为活跃状态 | 自动检测并告警，需人工复核 |
| 权限过期仍标记有效 | 🟠 中等 | 权限已过期但状态仍为活跃 | 自动检测并告警 |
| 重复权限 | 🟠 中等 | 同一场次有多条权限记录 | 需人工确认是否合法 |
| 多账号绑定 | 🟢 低危 | 同一学员绑定多个账号 | 需人工确认是否账号共享 |
| 退费后仍尝试访问 | 🔴 高危 | 已退费学员尝试观看回放 | 记录日志并告警 |

### 📊 访问审计
- 完整记录所有回放访问行为
- 记录访问账号、时间、IP地址
- 记录被拒绝的访问及原因
- 支持按学员、场次、时间筛选

### 📈 业务时间线
- 可视化展示学员完整生命周期
- 报名、转班、退费等关键节点一目了然
- 权限授予/回收历史可追溯

## 🚀 快速开始

### 环境要求
- Node.js >= 16.0.0
- npm 或 yarn

### 安装步骤

1. **安装后端依赖**
```bash
npm install
```

2. **安装前端依赖**
```bash
cd client
npm install
cd ..
```

3. **初始化数据库和样例数据**
```bash
npm run init-data
```

4. **启动开发服务器**
```bash
npm run dev
```

5. **访问系统**
   - 前端管理界面: http://localhost:3000
   - 后端API服务: http://localhost:3001

### 生产部署
```bash
# 构建前端
npm run build

# 启动生产服务
npm start
```

## 📋 样例数据说明

运行 `npm run init-data` 会创建以下测试数据：

### 班级数据
- Python全栈班-01期（含5个直播场次）
- Java架构师班-03期（含5个直播场次）
- 前端高级班-02期（含5个直播场次）

### 学员数据
- 张三（手机号: 13800138001）
- 李四（手机号: 13800138002）
- 王五（手机号: 13800138003）
- 赵六（手机号: 13800138004）
- 孙七（手机号: 13800138005）

每个学员都绑定了手机号和邮箱两个账号。

## 🎯 功能演示

### 运行演示脚本
```bash
npm run demo
```

演示脚本会自动执行以下操作：

1. **权限检查演示**：验证学员访问权限控制
2. **转班流程演示**：将学员从一个班级转到另一个班级，自动处理权限迁移
3. **退费流程演示**：模拟学员退费，观察权限自动回收
4. **异常检测演示**：运行异常检测，发现潜在问题

### 操作前后差异对比

#### 转班前后
| 维度 | 转班前 | 转班后 |
|-----|-------|-------|
| 原班级权限 | 活跃 | 已回收 |
| 新班级权限 | 无 | 已授予 |
| 报名记录 | 原班级 | 新班级 + 转班记录 |

#### 退费前后
| 维度 | 退费前 | 退费后 |
|-----|-------|-------|
| 权限状态 | 活跃 | 已回收 |
| 报名状态 | 在读 | 已退费 |
| 访问控制 | 允许观看 | 拒绝访问 |
| 异常检测 | 无异常 | 检测到退费访问尝试（如有） |

## 📐 核心业务规则

### 权限生命周期
```
报名 → 自动授权 → 观看回放 ─┬─ 正常结业 → 权限过期
                               ├─ 转班 → 回收旧权限 + 授予新权限
                               └─ 退费 → 立即回收权限
```

### 防重复机制
- 同一学员在同一班级只能有一个活跃报名记录
- 同一学员对同一场次只能有一个活跃权限记录
- 重复导入或提交时自动去重，幂等处理

### 必须人工复核的情况
1. **多账号绑定异常**：需确认是否学员本人使用还是账号共享
2. **重复权限记录**：需确认是否为系统问题还是特殊情况
3. **退费后访问尝试**：需确认是否账号被他人盗用

## 🔧 API接口说明

### 班级管理
- `GET /api/classes` - 获取班级列表
- `POST /api/classes` - 创建班级
- `GET /api/classes/:id` - 获取班级详情
- `PUT /api/classes/:id` - 更新班级

### 学员管理
- `GET /api/students` - 获取学员列表
- `POST /api/students` - 创建学员
- `GET /api/students/:id` - 获取学员详情（含报名记录和账号）

### 报名管理
- `POST /api/enrollments` - 学员报名
- `POST /api/enrollments/:id/refund` - 学员退费
- `POST /api/enrollments/:id/transfer` - 学员转班

### 权限管理
- `GET /api/permissions` - 获取权限列表
- `POST /api/permissions/:id/revoke` - 回收权限
- `POST /api/permissions/check-access` - 访问权限检查

### 异常检测
- `GET /api/anomalies` - 获取异常列表
- `POST /api/anomalies/detect` - 运行异常检测
- `PUT /api/anomalies/:id/resolve` - 标记异常已处理

### 访问日志
- `GET /api/logs` - 获取访问日志

### 操作事件
- `GET /api/events` - 获取操作历史

## 📁 项目结构

```
.
├── server/                    # 后端服务
│   ├── index.js              # 服务入口
│   ├── database/             # 数据库相关
│   │   └── schema.js         # 数据库Schema
│   ├── services/             # 业务逻辑
│   │   └── permissionService.js  # 权限核心服务
│   ├── routes/               # API路由
│   │   ├── classes.js
│   │   ├── students.js
│   │   ├── sessions.js
│   │   ├── enrollments.js
│   │   ├── permissions.js
│   │   ├── anomalies.js
│   │   ├── logs.js
│   │   └── events.js
│   └── scripts/              # 脚本工具
│       ├── initData.js       # 初始化样例数据
│       └── demo.js           # 功能演示脚本
├── client/                    # 前端应用
│   ├── src/
│   │   ├── index.js          # 入口文件
│   │   ├── App.js            # 主应用
│   │   ├── App.css           # 样式文件
│   │   └── pages/            # 页面组件
│   │       ├── Dashboard.js  # 控制台
│   │       ├── Classes.js    # 班级管理
│   │       ├── Students.js   # 学员管理
│   │       ├── StudentTimeline.js  # 学员时间线
│   │       ├── Sessions.js   # 直播场次
│   │       ├── Permissions.js  # 权限管理
│   │       ├── Anomalies.js  # 异常检测
│   │       └── Logs.js       # 访问日志
│   └── public/
├── data/                      # 数据库文件目录（自动创建）
├── package.json               # 项目配置
└── README.md                  # 本文档
```

## 🗄️ 数据库设计

核心数据表：

| 表名 | 说明 | 关键字段 |
|-----|------|---------|
| classes | 班级表 | name, course_name, start_date, end_date, status |
| students | 学员表 | name, phone, email, id_card, status |
| student_accounts | 学员账号表 | student_id, account_type, account_identifier, is_primary |
| class_enrollments | 报名记录表 | class_id, student_id, status, refund_date, transfer_from_id |
| live_sessions | 直播场次表 | class_id, title, session_date, replay_url, replay_expiry_date |
| replay_permissions | 权限记录表 | student_id, session_id, enrollment_id, granted_at, expires_at, revoked_at, status, source |
| access_logs | 访问日志表 | student_id, account_identifier, session_id, access_type, was_allowed, deny_reason |
| business_events | 操作事件表 | event_type, entity_type, entity_id, description, operator |
| permission_anomalies | 异常记录表 | anomaly_type, severity, student_id, session_id, description, status, resolver |

## 💡 使用技巧

1. **定期运行异常检测**：建议每天检查一次异常检测页面，及时发现权限问题
2. **查看学员时间线**：在学员详情页可以看到该学员的完整操作历史
3. **访问日志审计**：定期查看访问日志，发现异常访问模式
4. **权限来源追踪**：权限列表中可以查看每个权限是通过报名、转班还是手动授予的

## 🤝 常见问题

**Q: 退费后权限多久生效？**
A: 立即生效，退费操作完成的同时回收所有相关权限。

**Q: 转班后原来的观看记录还在吗？**
A: 历史观看记录会保留，但原班级的回放权限会被回收。

**Q: 可以给退费学员临时开通权限吗？**
A: 可以，在权限管理页面手动恢复即可，但建议谨慎操作并记录原因。

**Q: 多账号绑定一定是异常吗？**
A: 不一定，有些学员可能同时用手机号和微信登录，需要人工确认是否合理。

**Q: 系统会自动处理异常吗？**
A: 系统只会检测并告警，所有异常都需要人工确认处理。
