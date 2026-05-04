# 舞蹈教室管理系统后端 API

专为小舞蹈教室设计的本地后端 API，解决学生管理、课次预约、请假补课、课包管理、候补排队、签到扣课、老师课酬结算等实际业务痛点。

## 核心功能

### 数据模型
- **学生管理**：学生基本信息、家长联系方式
- **老师管理**：老师基本信息、课时费设置
- **班级管理**：班级名称、舞种、容量、带班老师
- **课包管理**：有效期、冻结/恢复、扣课、余额重算、使用记录
- **课次管理**：预约、请假、到课、旷课、补课、候补转正
- **签到管理**：签到状态追踪
- **请假管理**：请假申请、自动生成补课券
- **补课券管理**：有效期、使用追踪
- **候补管理**：自动排队、空位提醒、候补转正
- **通知待办**：系统通知、待办事项提醒

### 业务规则校验
- ✅ 班级容量限制
- ✅ 同一学生同一时间冲突检测
- ✅ 补课券过期检查
- ✅ 课包余额不足检查
- ✅ 课包冻结状态检查
- ✅ 课包过期检查
- ✅ 重复预约检查
- ✅ 已签到不能标记旷课
- ✅ 已完成课次不能操作

### 导出功能
- 📄 学生课包余额导出（JSON/CSV）
- 📄 老师课酬结算导出（JSON/CSV）
- 📄 月度报表导出（JSON/Markdown）

## 技术栈

- **运行时**: Node.js 18+
- **语言**: TypeScript
- **Web框架**: Express
- **数据库**: SQLite (better-sqlite3)
- **ORM**: 原生 SQL (轻量级封装)
- **测试**: Node.js 内置 test runner

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 启动服务

```bash
# 开发模式
npm run dev

# 或构建后启动
npm run build
npm start
```

服务启动后访问 http://localhost:3000

### 3. 初始化种子数据（可选）

```bash
npm run seed
```

### 4. 运行自检（验证核心业务规则）

```bash
npm run self-check
```

### 5. 运行测试

```bash
npm test
```

## 完整业务链路示例

以下是一条完整的业务链路，可直接用 curl 执行。

### 准备环境

先启动服务：

```bash
npm run dev
```

### 步骤 1：创建老师

```bash
# 创建李老师（芭蕾老师）
curl -X POST http://localhost:3000/api/teachers \
  -H "Content-Type: application/json" \
  -d '{
    "name": "李老师",
    "phone": "13800138001",
    "email": "li@dance.com",
    "hourly_rate": 200
  }'

# 创建王老师（街舞老师）
curl -X POST http://localhost:3000/api/teachers \
  -H "Content-Type: application/json" \
  -d '{
    "name": "王老师",
    "phone": "13800138002",
    "email": "wang@dance.com",
    "hourly_rate": 180
  }'
```

### 步骤 2：创建学生

```bash
# 创建张小雨（学生1）
curl -X POST http://localhost:3000/api/students \
  -H "Content-Type: application/json" \
  -d '{
    "name": "张小雨",
    "phone": "13900139001",
    "guardian_name": "张妈妈",
    "guardian_phone": "13900139001",
    "gender": "female",
    "birth_date": "2015-03-15",
    "notes": "喜欢芭蕾，有2年基础"
  }'

# 创建李小阳（学生2）
curl -X POST http://localhost:3000/api/students \
  -H "Content-Type: application/json" \
  -d '{
    "name": "李小阳",
    "phone": "13900139002",
    "guardian_name": "李爸爸",
    "guardian_phone": "13900139002",
    "gender": "male",
    "birth_date": "2014-07-20",
    "notes": "街舞爱好者"
  }'

# 创建王小花（学生3）
curl -X POST http://localhost:3000/api/students \
  -H "Content-Type: application/json" \
  -d '{
    "name": "王小花",
    "phone": "13900139003",
    "guardian_name": "王妈妈",
    "guardian_phone": "13900139003",
    "gender": "female",
    "birth_date": "2016-01-10"
  }'
```

### 步骤 3：创建班级

```bash
# 创建少儿芭蕾基础班（李老师带课）
curl -X POST http://localhost:3000/api/classes \
  -H "Content-Type: application/json" \
  -d '{
    "name": "少儿芭蕾基础班",
    "teacher_id": "替换为李老师的ID",
    "dance_style": "ballet",
    "capacity": 8,
    "description": "适合4-8岁儿童的芭蕾基础课程"
  }'

# 创建少儿街舞班（王老师带课）
curl -X POST http://localhost:3000/api/classes \
  -H "Content-Type: application/json" \
  -d '{
    "name": "少儿街舞班",
    "teacher_id": "替换为王老师的ID",
    "dance_style": "hiphop",
    "capacity": 10,
    "description": "适合6-12岁儿童的街舞课程"
  }'
```

### 步骤 4：创建课包模板并给学生购买课包

```bash
# 创建课包模板
curl -X POST http://localhost:3000/api/packages/templates \
  -H "Content-Type: application/json" \
  -d '{
    "name": "40次课包",
    "total_lessons": 40,
    "price": 5000,
    "valid_days": 365,
    "description": "40次课程，12个月有效期（推荐）"
  }'

# 给张小雨购买40次课包
curl -X POST http://localhost:3000/api/packages \
  -H "Content-Type: application/json" \
  -d '{
    "student_id": "替换为张小雨的ID",
    "name": "40次课包",
    "total_lessons": 40,
    "valid_days": 365
  }'

# 给李小阳购买20次课包
curl -X POST http://localhost:3000/api/packages \
  -H "Content-Type: application/json" \
  -d '{
    "student_id": "替换为李小阳的ID",
    "name": "20次课包",
    "total_lessons": 20,
    "valid_days": 180
  }'

# 给王小花购买10次课包
curl -X POST http://localhost:3000/api/packages \
  -H "Content-Type: application/json" \
  -d '{
    "student_id": "替换为王小花的ID",
    "name": "10次体验课包",
    "total_lessons": 10,
    "valid_days": 90
  }'
```

### 步骤 5：创建课次

```bash
# 创建下周六上午9:00-10:30的芭蕾课
curl -X POST http://localhost:3000/api/lessons \
  -H "Content-Type: application/json" \
  -d '{
    "class_id": "替换为芭蕾班的ID",
    "teacher_id": "替换为李老师的ID",
    "start_time": "2026-05-10 09:00:00",
    "end_time": "2026-05-10 10:30:00",
    "location": "1号舞蹈室",
    "capacity": 8
  }'

# 创建下下周六上午9:00-10:30的芭蕾课
curl -X POST http://localhost:3000/api/lessons \
  -H "Content-Type: application/json" \
  -d '{
    "class_id": "替换为芭蕾班的ID",
    "teacher_id": "替换为李老师的ID",
    "start_time": "2026-05-17 09:00:00",
    "end_time": "2026-05-17 10:30:00",
    "location": "1号舞蹈室",
    "capacity": 2
  }'
```

### 步骤 6：预约上课

```bash
# 张小雨预约5月10日的芭蕾课
curl -X POST http://localhost:3000/api/bookings \
  -H "Content-Type: application/json" \
  -d '{
    "student_id": "替换为张小雨的ID",
    "lesson_id": "替换为5月10日芭蕾课的ID",
    "package_id": "替换为张小雨的课包ID"
  }'

# 王小花预约5月10日的芭蕾课
curl -X POST http://localhost:3000/api/bookings \
  -H "Content-Type: application/json" \
  -d '{
    "student_id": "替换为王小花的ID",
    "lesson_id": "替换为5月10日芭蕾课的ID",
    "package_id": "替换为王小花的课包ID"
  }'
```

### 步骤 7：请假生成补课券

```bash
# 张小雨请假5月10日的课，需要先获取预约ID
# 先查询张小雨的预约（或从步骤6的响应中获取）
curl http://localhost:3000/api/students/替换为张小雨的ID

# 申请请假（会自动生成补课券，有效期90天）
curl -X POST http://localhost:3000/api/leaves/替换为预约ID \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "孩子发烧，身体不适"
  }'

# 查看张小雨的补课券
curl http://localhost:3000/api/makeup-tickets/student/替换为张小雨的ID
```

### 步骤 8：候补转正

```bash
# 创建一个容量为2的课次，让3个学生来约，第3个进候补
# 先让张小雨和王小花预约5月17日的课（容量2）

# 张小雨预约
curl -X POST http://localhost:3000/api/bookings \
  -H "Content-Type: application/json" \
  -d '{
    "student_id": "替换为张小雨的ID",
    "lesson_id": "替换为5月17日芭蕾课的ID",
    "package_id": "替换为张小雨的课包ID"
  }'

# 王小花预约
curl -X POST http://localhost:3000/api/bookings \
  -H "Content-Type: application/json" \
  -d '{
    "student_id": "替换为王小花的ID",
    "lesson_id": "替换为5月17日芭蕾课的ID",
    "package_id": "替换为王小花的课包ID"
  }'

# 李小阳尝试预约（应该会失败，因为容量已满）
curl -X POST http://localhost:3000/api/bookings \
  -H "Content-Type: application/json" \
  -d '{
    "student_id": "替换为李小阳的ID",
    "lesson_id": "替换为5月17日芭蕾课的ID",
    "package_id": "替换为李小阳的课包ID"
  }'

# 李小阳加入候补
curl -X POST http://localhost:3000/api/waitlists \
  -H "Content-Type: application/json" \
  -d '{
    "student_id": "替换为李小阳的ID",
    "lesson_id": "替换为5月17日芭蕾课的ID"
  }'

# 查看候补列表
curl http://localhost:3000/api/lessons/替换为5月17日芭蕾课的ID/waitlist

# 张小雨取消预约，空出一个位置
# 先获取张小雨的预约ID，然后取消
curl -X POST http://localhost:3000/api/bookings/替换为张小雨5月17日预约的ID/cancel

# 现在可以将李小阳的候补转正
# 获取候补ID，然后转正
curl -X POST http://localhost:3000/api/waitlists/替换为李小阳的候补ID/convert \
  -H "Content-Type: application/json" \
  -d '{
    "package_id": "替换为李小阳的课包ID"
  }'
```

### 步骤 9：签到扣课

```bash
# 王小花签到5月10日的课（需要预约ID）
curl -X POST http://localhost:3000/api/bookings/替换为王小花5月10日预约的ID/checkin

# 查看王小花的课包余额变化
curl http://localhost:3000/api/packages/替换为王小花的课包ID/balance
```

### 步骤 10：使用补课券补课

```bash
# 张小雨用补课券补5月17日的课
curl -X POST http://localhost:3000/api/makeup-tickets/use \
  -H "Content-Type: application/json" \
  -d '{
    "ticket_id": "替换为张小雨的补课券ID",
    "lesson_id": "替换为5月17日芭蕾课的ID"
  }'
```

### 步骤 11：月底导出对账

```bash
# 导出学生课包余额（JSON格式）
curl http://localhost:3000/api/export/student-balances

# 导出学生课包余额（CSV格式）
curl http://localhost:3000/api/export/student-balances?format=csv -o student_balances.csv

# 导出老师课酬（JSON格式）
curl http://localhost:3000/api/export/teacher-payments

# 导出月度报表（JSON格式）
curl http://localhost:3000/api/export/monthly/2026/5

# 导出月度报表（Markdown格式）
curl http://localhost:3000/api/export/monthly/2026/5?format=md -o monthly_report.md
```

## 异常样例

以下是一些常见的错误场景及其响应：

### 场景 1：重复预约

```bash
curl -X POST http://localhost:3000/api/bookings \
  -H "Content-Type: application/json" \
  -d '{
    "student_id": "已预约过该课次的学生ID",
    "lesson_id": "课次ID",
    "package_id": "课包ID"
  }'
```

**响应：**
```json
{
  "success": false,
  "error": "STUDENT_ALREADY_BOOKED",
  "message": "学生已预约该课次",
  "details": {
    "lesson_id": "...",
    "student_id": "..."
  }
}
```

### 场景 2：课次已满

```bash
curl -X POST http://localhost:3000/api/bookings \
  -H "Content-Type: application/json" \
  -d '{
    "student_id": "学生ID",
    "lesson_id": "已满的课次ID",
    "package_id": "课包ID"
  }'
```

**响应：**
```json
{
  "success": false,
  "error": "CLASS_CAPACITY_FULL",
  "message": "课次已满，可加入候补",
  "details": {
    "capacity": 8,
    "booked": 8
  }
}
```

### 场景 3：时间冲突

```bash
curl -X POST http://localhost:3000/api/bookings \
  -H "Content-Type: application/json" \
  -d '{
    "student_id": "学生ID",
    "lesson_id": "与已有预约时间冲突的课次ID",
    "package_id": "课包ID"
  }'
```

**响应：**
```json
{
  "success": false,
  "error": "TIME_SLOT_CONFLICT",
  "message": "学生在同一时间已有其他预约",
  "details": {
    "conflict_lesson_ids": ["..."],
    "start_time": "2026-05-10 09:00:00",
    "end_time": "2026-05-10 10:30:00"
  }
}
```

### 场景 4：课包余额不足

```bash
curl -X POST http://localhost:3000/api/bookings \
  -H "Content-Type: application/json" \
  -d '{
    "student_id": "学生ID",
    "lesson_id": "课次ID",
    "package_id": "余额不足的课包ID"
  }'
```

**响应：**
```json
{
  "success": false,
  "error": "INSUFFICIENT_LESSONS",
  "message": "课包余额不足",
  "details": {
    "package_id": "...",
    "balance": 0
  }
}
```

### 场景 5：课包已过期

```bash
curl -X POST http://localhost:3000/api/bookings \
  -H "Content-Type: application/json" \
  -d '{
    "student_id": "学生ID",
    "lesson_id": "课次ID",
    "package_id": "已过期的课包ID"
  }'
```

**响应：**
```json
{
  "success": false,
  "error": "PACKAGE_EXPIRED",
  "message": "课包已过期",
  "details": {
    "package_id": "...",
    "valid_to": "2026-04-01 00:00:00"
  }
}
```

### 场景 6：课包已冻结

```bash
curl -X POST http://localhost:3000/api/bookings/checkin \
  -H "Content-Type: application/json" \
  -d '{
    "booking_id": "使用冻结课包的预约ID"
  }'
```

**响应：**
```json
{
  "success": false,
  "error": "PACKAGE_FROZEN",
  "message": "课包已被冻结",
  "details": {
    "package_id": "..."
  }
}
```

### 场景 7：补课券已过期

```bash
curl -X POST http://localhost:3000/api/makeup-tickets/use \
  -H "Content-Type: application/json" \
  -d '{
    "ticket_id": "已过期的补课券ID",
    "lesson_id": "课次ID"
  }'
```

**响应：**
```json
{
  "success": false,
  "error": "MAKEUP_TICKET_EXPIRED",
  "message": "补课券已过期",
  "details": {
    "ticket_id": "...",
    "valid_to": "2026-04-01 00:00:00"
  }
}
```

### 场景 8：已在候补列表中

```bash
curl -X POST http://localhost:3000/api/waitlists \
  -H "Content-Type: application/json" \
  -d '{
    "student_id": "已在候补的学生ID",
    "lesson_id": "课次ID"
  }'
```

**响应：**
```json
{
  "success": false,
  "error": "ALREADY_ON_WAITLIST",
  "message": "学生已在该课次的候补列表中",
  "details": {
    "lesson_id": "...",
    "student_id": "...",
    "position": 1
  }
}
```

## API 端点

### 老师管理
| 方法 | 路径 | 描述 |
|------|------|------|
| POST | /api/teachers | 创建老师 |
| GET | /api/teachers | 获取所有老师（?active=true 只获取活跃） |
| GET | /api/teachers/:id | 获取单个老师 |
| PUT | /api/teachers/:id | 更新老师 |
| POST | /api/teachers/:id/deactivate | 停用老师 |
| POST | /api/teachers/:id/activate | 激活老师 |

### 学生管理
| 方法 | 路径 | 描述 |
|------|------|------|
| POST | /api/students | 创建学生 |
| GET | /api/students | 获取所有学生（?active=true 只获取活跃, ?q=搜索关键词） |
| GET | /api/students/:id | 获取单个学生（含课包信息） |
| GET | /api/students/:id/balances | 获取学生课包余额 |
| PUT | /api/students/:id | 更新学生 |
| POST | /api/students/:id/deactivate | 停用学生 |
| POST | /api/students/:id/activate | 激活学生 |

### 班级管理
| 方法 | 路径 | 描述 |
|------|------|------|
| POST | /api/classes | 创建班级 |
| GET | /api/classes | 获取所有班级（?active=true 只获取活跃, ?teacher_id=老师ID） |
| GET | /api/classes/:id | 获取单个班级（含老师信息） |
| PUT | /api/classes/:id | 更新班级 |
| POST | /api/classes/:id/deactivate | 停用班级 |
| POST | /api/classes/:id/activate | 激活班级 |

### 课包管理
| 方法 | 路径 | 描述 |
|------|------|------|
| POST | /api/packages/templates | 创建课包模板 |
| POST | /api/packages | 给学生创建课包 |
| GET | /api/packages/student/:studentId | 获取学生的所有课包 |
| GET | /api/packages/student/:studentId/active | 获取学生的有效课包 |
| GET | /api/packages/:id | 获取单个课包（含使用记录） |
| GET | /api/packages/:id/balance | 获取课包余额 |
| POST | /api/packages/:id/freeze | 冻结课包 |
| POST | /api/packages/:id/unfreeze | 解冻课包 |
| POST | /api/packages/:id/deduct | 手动扣课 |
| POST | /api/packages/:id/refund | 手动退还课次 |
| POST | /api/packages/:id/adjust | 调整课包余额 |
| POST | /api/packages/:id/recalculate | 重算课包余额 |

### 课次管理
| 方法 | 路径 | 描述 |
|------|------|------|
| POST | /api/lessons | 创建课次 |
| GET | /api/lessons | 按时间范围获取课次（?start_time=&end_time=） |
| GET | /api/lessons/:id | 获取单个课次（含预约和候补信息） |
| POST | /api/lessons/:id/complete | 标记课次完成 |
| GET | /api/lessons/:lesson_id/waitlist | 获取课次的候补列表 |

### 预约管理
| 方法 | 路径 | 描述 |
|------|------|------|
| POST | /api/bookings | 预约课次 |
| POST | /api/bookings/:id/cancel | 取消预约 |
| POST | /api/bookings/:booking_id/checkin | 签到 |
| POST | /api/bookings/:booking_id/absent | 标记旷课 |

### 请假管理
| 方法 | 路径 | 描述 |
|------|------|------|
| POST | /api/leaves/:booking_id | 申请请假（自动生成补课券） |

### 补课券管理
| 方法 | 路径 | 描述 |
|------|------|------|
| POST | /api/makeup-tickets/use | 使用补课券补课 |
| GET | /api/makeup-tickets/student/:student_id | 获取学生的可用补课券 |

### 候补管理
| 方法 | 路径 | 描述 |
|------|------|------|
| POST | /api/waitlists | 加入候补 |
| POST | /api/waitlists/:waitlist_id/convert | 候补转正 |

### 通知管理
| 方法 | 路径 | 描述 |
|------|------|------|
| GET | /api/notifications | 获取所有通知 |
| GET | /api/notifications/unread | 获取未读通知 |
| POST | /api/notifications/:id/read | 标记为已读 |
| POST | /api/notifications/read-all | 标记所有为已读 |
| GET | /api/todos | 获取待办事项 |

### 导出功能
| 方法 | 路径 | 描述 |
|------|------|------|
| GET | /api/export/student-balances | 导出学生课包余额（?format=json/csv） |
| GET | /api/export/teacher-payments | 导出老师课酬（?format=json/csv&year=&month=） |
| GET | /api/export/monthly/:year/:month | 导出月度报表（?format=json/md） |

## 错误码

| 错误码 | 描述 |
|--------|------|
| STUDENT_NOT_FOUND | 学生不存在 |
| TEACHER_NOT_FOUND | 老师不存在 |
| CLASS_NOT_FOUND | 班级不存在 |
| LESSON_NOT_FOUND | 课次不存在 |
| PACKAGE_NOT_FOUND | 课包不存在 |
| BOOKING_NOT_FOUND | 预约不存在 |
| LEAVE_NOT_FOUND | 请假记录不存在 |
| MAKEUP_TICKET_NOT_FOUND | 补课券不存在 |
| WAITLIST_NOT_FOUND | 候补记录不存在 |
| CLASS_CAPACITY_FULL | 班级容量已满 |
| STUDENT_ALREADY_BOOKED | 学生已预约该课次 |
| TIME_SLOT_CONFLICT | 时间冲突 |
| PACKAGE_EXPIRED | 课包已过期 |
| PACKAGE_FROZEN | 课包已冻结 |
| INSUFFICIENT_LESSONS | 课包余额不足 |
| MAKEUP_TICKET_EXPIRED | 补课券已过期 |
| MAKEUP_TICKET_USED | 补课券已使用 |
| LESSON_ALREADY_STARTED | 课次已开始 |
| LESSON_COMPLETED | 课次已完成 |
| ALREADY_ON_WAITLIST | 已在候补列表中 |
| WAITLIST_EMPTY | 候补列表为空 |
| INVALID_INPUT | 输入无效 |
| OPERATION_NOT_ALLOWED | 操作不允许 |

## 数据库结构

### 核心表

1. **teachers** - 老师表
2. **students** - 学生表
3. **classes** - 班级表
4. **package_templates** - 课包模板表
5. **student_packages** - 学生课包表
6. **lessons** - 课次表
7. **lesson_bookings** - 课次预约表
8. **leaves** - 请假表
9. **makeup_tickets** - 补课券表
10. **waitlists** - 候补表
11. **notifications** - 通知表
12. **teacher_payments** - 老师课酬记录表
13. **package_usage_logs** - 课包使用记录表

## 项目结构

```
src/
├── controllers/          # 控制器层
│   ├── teacher.controller.ts
│   ├── student.controller.ts
│   ├── class.controller.ts
│   ├── package.controller.ts
│   ├── lesson.controller.ts
│   ├── notification.controller.ts
│   └── export.controller.ts
├── database/             # 数据库层
│   ├── connection.ts     # 数据库连接
│   └── schema.ts         # 数据库Schema
├── middleware/           # 中间件
│   └── error-handler.ts  # 错误处理
├── repositories/         # 数据访问层
│   ├── base.ts           # 基础CRUD
│   └── index.ts          # 所有Repository
├── routes/               # 路由
│   └── index.ts
├── scripts/              # 脚本
│   ├── seed.ts           # 种子数据
│   └── self-check.ts     # 自检脚本
├── services/             # 业务逻辑层
│   ├── teacher.service.ts
│   ├── student.service.ts
│   ├── class.service.ts
│   ├── package.service.ts
│   ├── lesson.service.ts
│   ├── notification.service.ts
│   ├── export.service.ts
│   └── index.ts
├── tests/                # 测试
│   └── core.test.ts
├── types/                # 类型定义
│   └── index.ts
├── utils/                # 工具函数
│   └── date.ts
├── errors/               # 错误定义
│   └── index.ts
└── server.ts             # 服务入口
```

## 注意事项

1. **数据持久化**：使用 SQLite 数据库，数据文件位于 `data/dance-studio.db`
2. **时间格式**：所有时间使用 `YYYY-MM-DD HH:mm:ss` 格式
3. **时区**：系统使用本地时区，建议服务器和客户端时区一致
4. **容量限制**：创建课次时可指定容量，不指定则使用班级容量
5. **补课券有效期**：默认 90 天，可在代码中调整
6. **课包有效期**：创建时指定，从创建日期开始计算

## 扩展建议

1. **添加认证**：如果需要多用户或远程访问，建议添加 JWT 认证
2. **添加日志**：目前只有简单的控制台日志，可考虑集成 winston 等日志库
3. **添加缓存**：对于频繁查询的数据（如课次列表），可添加缓存层
4. **添加API文档**：可集成 Swagger/OpenAPI 自动生成文档
5. **添加数据验证**：目前只有简单的业务校验，可添加更完善的输入验证

## License

MIT
