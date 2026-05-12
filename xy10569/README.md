# 校园借书逾期 API

校园图书借阅管理系统 - 专门解决班级集体借书、老师批量归还场景下的逾期和丢书责任追溯问题。

## 功能特性

### 核心业务模块
- **班级集体借书**: 支持老师作为责任人，为整个班级批量借书
- **批量归还**: 老师一次归还多本图书，自动分配到具体学生
- **逾期计费**: 自动计算逾期天数、生成罚款，支持罚款上限
- **丢书赔偿**: 支持报失、赔偿、找回退款全流程
- **续借管理**: 支持续借次数限制，记录续借历史

### 关键规则实现
- ✅ 同一本书重复借出检测
- ✅ 班级代借责任人追踪
- ✅ 续借次数限制（默认2次）
- ✅ 逾期罚款上限（默认50元）
- ✅ 丢书找回后退款
- ✅ 操作幂等性（重复执行安全）
- ✅ 人工修正审计追踪（前后差异 + 操作者）

### 状态管理
借阅状态流转:
```
available → borrowed → renewed → overdue → returned
                                      ↓
                                    lost → reported → compensated / found
```

罚款状态流转:
```
pending → partial → paid / waived
```

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 初始化样例数据

```bash
npm run seed
```

这会创建:
- 3个班级（高三1班、高三2班、高二1班）
- 3位教师
- 24名学生
- 12本图书
- 多条借阅、逾期、丢书记录

### 3. 运行完整演示

```bash
npm run demo
```

演示覆盖:
1. ✅ 正常借还流程
2. ✅ 班级集体借书 + 批量归还
3. ✅ 逾期计费 + 罚款上限
4. ✅ 丢书赔偿 + 找回退款
5. ✅ 免罚审批（人工修正）
6. ✅ 失败路径演示

### 4. 启动服务

```bash
npm start
```

服务启动后访问: http://localhost:3000

## API 接口说明

### 基础数据管理

#### 学生管理
```bash
# 创建学生
POST /api/students
{
  "student_no": "S20240101",
  "name": "张三",
  "class_id": "class-uuid",
  "gender": "男"
}

# 查询学生
GET /api/students?class_id=xxx&name=张

# 查询单个学生
GET /api/students/:id

# 更新学生
PUT /api/students/:id
```

#### 班级管理
```bash
# 创建班级
POST /api/classes
{
  "name": "高三(1)班",
  "grade": "高三",
  "head_teacher_id": "teacher-uuid"
}

# 查询班级
GET /api/classes

# 班级学生
GET /api/classes/:id/students
```

#### 图书管理
```bash
# 创建图书
POST /api/books
{
  "isbn": "978-7-01-001",
  "title": "红楼梦",
  "author": "曹雪芹",
  "price": 58.00,
  "location": "文学区-A1"
}

# 查询图书
GET /api/books?status=available&title=红楼
```

---

### 借阅管理

#### 单独借书
```bash
POST /api/borrow/borrow
{
  "student_id": "student-uuid",
  "book_id": "book-uuid",
  "loan_days": 30,
  "request_id": "optional-request-id"  # 可选，用于幂等
}
```

**失败场景**: 图书已被借出时返回:
```json
{
  "success": false,
  "code": "BOOK_ALREADY_BORROWED",
  "error": "图书已被借出",
  "existingBorrow": {
    "studentName": "张三",
    "borrowDate": "...",
    "dueDate": "..."
  }
}
```

#### 班级集体借书
```bash
POST /api/borrow/batch-borrow
{
  "class_id": "class-uuid",
  "teacher_id": "teacher-uuid",
  "books": [
    { "student_id": "s1", "book_id": "b1" },
    { "student_id": "s2", "book_id": "b2" }
  ]
}
```

#### 续借
```bash
POST /api/borrow/renew/:borrowId
{
  "reason": "需要延长阅读时间"
}
```

**失败场景**: 超过续借次数时返回:
```json
{
  "success": false,
  "code": "MAX_RENEW_EXCEEDED",
  "error": "已达到最大续借次数(2次)"
}
```

#### 归还
```bash
POST /api/borrow/return/:borrowId
{
  "return_date": "2024-01-15T00:00:00Z"  # 可选，默认当前时间
}
```

#### 查询借阅记录
```bash
GET /api/borrow?status=borrowed&student_id=xxx&class_id=xxx
GET /api/borrow/:id
GET /api/borrow/student/:studentId
GET /api/borrow/:id/renew-history
GET /api/borrow/:id/overdue-status
```

#### 刷新逾期状态
```bash
POST /api/borrow/refresh-overdue
```

---

### 批量归还

#### 快速批量归还（推荐）
```bash
POST /api/batch-returns/quick
{
  "borrow_ids": ["borrow-1", "borrow-2", "borrow-3"],
  "return_date": "2024-01-15T00:00:00Z",  # 可选
  "request_id": "batch-return-001"        # 幂等ID，必填
}
```

**幂等性说明**: 使用相同的 `request_id` 重复调用，只会执行一次，返回相同结果。

#### 分步批量归还
```bash
# 1. 创建批量归还记录
POST /api/batch-returns/create
{
  "request_id": "batch-return-001",
  "return_date": "2024-01-15T00:00:00Z"
}

# 2. 添加归还项目
POST /api/batch-returns/:batchId/add-item
{
  "borrow_id": "borrow-1"
}

# 3. 执行归还处理
POST /api/batch-returns/:batchId/process
{
  "return_date": "2024-01-15T00:00:00Z"
}
```

#### 查询批量归还
```bash
GET /api/batch-returns
GET /api/batch-returns/:id
GET /api/batch-returns/request/:requestId
```

---

### 财务管理

#### 逾期罚款
```bash
# 查询罚款
GET /api/financial/fines?status=pending&student_id=xxx
GET /api/financial/fines/:id
GET /api/financial/fines/student/:studentId

# 缴纳罚款
POST /api/financial/fines/:id/pay
{
  "amount": 10.50
}

# 减免罚款
POST /api/financial/fines/:id/waive
{
  "amount": 10.50,
  "reason": "学生因病住院无法按时归还"
}

# 刷新所有逾期罚款
POST /api/financial/fines/refresh
```

#### 丢书赔偿
```bash
# 报失
POST /api/financial/lost-books/report
{
  "borrow_id": "borrow-uuid",
  "reported_date": "2024-01-10T00:00:00Z"
}

# 找回
POST /api/financial/lost-books/:id/found
{
  "found_date": "2024-01-20T00:00:00Z"
}

# 缴纳赔偿
POST /api/financial/lost-books/:id/pay
{
  "amount": 50.00
}

# 查询丢书记录
GET /api/financial/lost-books?status=reported
GET /api/financial/lost-books/:id
```

---

### 报告与查询

#### 学生借阅状态
```bash
GET /api/reports/student/:studentId/status
```

返回:
```json
{
  "success": true,
  "student": { "id": "...", "name": "张三" },
  "summary": {
    "totalBorrows": 10,
    "activeBorrows": 3,
    "overdueCount": 1,
    "pendingFineAmount": 15.50,
    "totalOutstanding": 65.50
  },
  "details": { "borrows": [...], "fines": {...}, "lostBooks": {...} }
}
```

#### 班级未还清单
```bash
GET /api/reports/class/:classId/unreturned
```

返回:
```json
{
  "success": true,
  "class": { "id": "...", "name": "高三(1)班" },
  "summary": {
    "totalStudents": 40,
    "studentsWithBooks": 15,
    "studentsWithOverdue": 3,
    "totalUnreturned": 20,
    "overdueCount": 5
  },
  "byStudent": {
    "student-id": {
      "student": {...},
      "books": [...],
      "overdueCount": 1
    }
  },
  "unreturnedBooks": [...]
}
```

#### 财务统计
```bash
GET /api/reports/financial
```

返回:
```json
{
  "success": true,
  "summary": {
    "totalReceivable": 500.00,
    "totalReceived": 350.00,
    "totalWaived": 50.00,
    "totalRefunded": 30.00,
    "totalOutstanding": 100.00
  },
  "overdueFines": {...},
  "lostBooks": {...},
  "waivers": {...}
}
```

#### 审计日志
```bash
GET /api/reports/audit/:entityType/:entityId
```

支持的 entityType: `student`, `class`, `teacher`, `book`, `borrow`, `fine`, `lost_book`, `batch_return`

返回包含:
- 操作类型（CREATE, UPDATE, RETURN, RENEW, PAY, WAIVE等）
- 操作人ID和名称
- 变更前后的值（diff）
- 请求ID（用于关联相关操作）

#### 导出报告
```bash
# JSON格式
GET /api/reports/export

# 文本格式（便于打印/查看）
GET /api/reports/export?format=text
```

#### 仪表盘概览
```bash
GET /api/reports/dashboard
```

---

## 操作人身份

通过请求头 `X-Operator-ID` 指定操作人：

```bash
curl -H "X-Operator-ID: teacher_zhang" http://localhost:3000/api/...
```

内置操作人:
- `admin` - 系统管理员
- `teacher_zhang` - 张老师
- `teacher_li` - 李老师
- `librarian` - 图书管理员

---

## 主要演示路径

### 路径一: 正常借还闭环
```
学生借书 → 续借 → 按时归还
```

### 路径二: 班级集体借书 → 批量归还
```
老师作为责任人 → 为班级多个学生集体借书
  ↓
老师批量归还多本书
  ↓
系统自动分配到具体学生
  ↓
自动计算每本的逾期费用
```

### 路径三: 逾期罚款闭环
```
学生借书 → 逾期 → 还书时自动生成罚款
  ↓
学生缴纳罚款（或部分缴纳）
  ↓
老师可减免（需记录原因和操作人）
```

### 路径四: 丢书赔偿闭环
```
学生借书 → 报告丢失
  ↓
生成赔偿记录（图书价格 × 赔偿倍率）
  ↓
学生缴纳赔偿
  ↓
[可选] 图书找回 → 退款处理
```

---

## 失败路径演示

### 场景1: 重复借阅同一本书
```bash
# 第一个学生借书
POST /api/borrow/borrow
{ "student_id": "s1", "book_id": "b1" }  # 成功

# 第二个学生尝试借同一本书
POST /api/borrow/borrow  
{ "student_id": "s2", "book_id": "b1" }  # 失败：BOOK_ALREADY_BORROWED
```

### 场景2: 超过续借次数
```bash
# 第1次续借 ✅
POST /api/borrow/renew/:id

# 第2次续借 ✅
POST /api/borrow/renew/:id

# 第3次续借 ❌ MAX_RENEW_EXCEEDED
POST /api/borrow/renew/:id
```

### 场景3: 幂等性测试
```bash
# 第一次调用 ✅
POST /api/batch-returns/quick
{ "borrow_ids": [...], "request_id": "test-001" }

# 使用相同request_id重复调用 ✅
# 返回 isIdempotent: true，表示是幂等命中
POST /api/batch-returns/quick
{ "borrow_ids": [...], "request_id": "test-001" }
```

---

## 业务规则配置

在 `src/config.js` 中可调整:

```javascript
rules: {
  defaultLoanDays: 30,      // 默认借书天数
  maxRenewTimes: 2,         // 最大续借次数
  renewDays: 30,            // 每次续借天数
  overdueRatePerDay: 0.1,   // 逾期日费率（元/天）
  maxOverdueFine: 50,       // 单本逾期罚款上限
  lostBookRatio: 2.0,       // 丢书赔偿倍率
  overdueGraceDays: 3       // 逾期宽限期（天）
}
```

---

## 数据库

使用 SQLite，数据库文件位置: `./data/library.db`

主要数据表:
- `classes` - 班级
- `students` - 学生
- `teachers` - 教师
- `books` - 图书
- `borrow_records` - 借阅记录
- `batch_borrows` - 集体借书批次
- `renew_records` - 续借记录
- `batch_returns` - 批量归还
- `batch_return_items` - 批量归还明细
- `overdue_fines` - 逾期罚款
- `lost_books` - 丢书赔偿
- `waivers` - 减免记录
- `audit_logs` - 审计日志

---

## 启动流程

完整使用流程:

```bash
# 1. 安装
npm install

# 2. 初始化数据
npm run seed

# 3. 运行演示（可选）
npm run demo

# 4. 启动服务
npm start

# 5. 访问API
curl http://localhost:3000/
curl http://localhost:3000/api/reports/dashboard
curl http://localhost:3000/api/reports/export?format=text
```

---

## 验证业务闭环

不看源码，通过以下接口判断业务是否真的闭环:

### 1. 学生状态验证
```
GET /api/reports/student/:id/status
```
检查:
- `activeBorrows` 是否与实际借阅一致
- `overdueCount` 是否准确
- `pendingFineAmount` 是否等于待缴罚款

### 2. 班级状态验证
```
GET /api/reports/class/:id/unreturned
```
检查:
- `totalUnreturned` 是否等于未还图书总数
- `studentsWithBooks` 是否等于有未还书的学生数
- 每本书是否能对应到具体学生

### 3. 财务验证
```
GET /api/reports/financial
```
检查:
- `totalReceivable` = `overdueFines.totalAmount` + `lostBooks.totalAmount`
- `totalReceived` = `overdueFines.paidAmount` + `lostBooks.paidAmount`
- `totalOutstanding` = 各学生 `totalOutstanding` 之和

### 4. 审计追踪验证
```
GET /api/reports/audit/borrow/:borrowId
```
检查:
- 是否记录了每个状态变更
- 是否记录了操作人
- 是否有前后差异（diff）
