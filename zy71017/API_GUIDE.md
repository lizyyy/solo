# 食堂过敏原替换 API - 使用指南

## 项目概述
基于 Spring Boot + H2 内存数据库的学校食堂过敏原替换管理系统。

## 核心功能
- ✅ **数据导入**: 过敏原、菜品、学生名单
- ✅ **过敏原校验**: 检测替换菜品是否引入新过敏原
- ✅ **替换状态机**: DRAFT → VALIDATING → VALIDATED/CONFLICT_DETECTED → PENDING_CONFIRMATION → CONFIRMED → COMPLETED → LOCKED
- ✅ **回执去重**: 防止同一学生重复提交回执
- ✅ **餐次锁定**: 完成后锁定防止重复修改
- ✅ **人工复核**: 冲突场景支持人工审核
- ✅ **撤销功能**: 支持撤销未锁定的替换
- ✅ **报告导出**: Excel 格式供餐报告

## 启动服务
```bash
mvn spring-boot:run
```

服务地址: `http://localhost:8080`
H2控制台: `http://localhost:8080/h2-console`

---

## API 接口列表

### 1. 基础数据接口

#### 1.1 过敏原管理
```
GET  /api/data/allergens       # 获取所有过敏原
POST /api/data/allergens       # 导入/更新过敏原
```
请求体:
```json
{
  "code": "EGG",
  "name": "鸡蛋",
  "description": "鸡蛋及蛋制品"
}
```

#### 1.2 菜品管理
```
GET  /api/data/dishes          # 获取所有菜品
POST /api/data/dishes          # 导入/更新菜品
```
请求体:
```json
{
  "code": "D001",
  "name": "番茄炒蛋",
  "description": "经典家常菜",
  "allergenCodes": ["EGG"]
}
```

#### 1.3 学生管理
```
GET  /api/data/students        # 获取所有学生
POST /api/data/students        # 导入/更新学生
```
请求体:
```json
{
  "studentNo": "S001",
  "name": "小明",
  "grade": "三年级",
  "className": "一班",
  "parentName": "明爸爸",
  "parentPhone": "13800138001",
  "parentEmail": "ming@test.com",
  "allergenCodes": ["EGG", "MILK"]
}
```

---

### 2. 替换请求接口

#### 2.1 创建替换请求
```
POST /api/replacements
```
请求体:
```json
{
  "mealDate": "2026-05-25",
  "mealType": "LUNCH",
  "originalDishId": 3,
  "replacementDishId": 11,
  "reason": "食材缺货临时替换",
  "createdBy": "admin"
}
```

#### 2.2 查询替换
```
GET /api/replacements          # 获取所有替换
GET /api/replacements/{id}     # 获取单个替换详情
```

#### 2.3 执行校验
```
POST /api/replacements/{id}/validate
```
**返回校验结果**:
- `valid`: 校验是否通过
- `hasAllergenConflict`: 是否有过敏原冲突
- `hasDuplicateReplacement`: 是否重复替换
- `mealLocked`: 餐次是否锁定
- `conflictDetail`: 冲突详情（影响学生列表）

#### 2.4 人工复核
```
POST /api/replacements/{id}/review
```
请求体:
```json
{
  "approved": true,
  "notes": "家长已同意特殊安排",
  "reviewer": "supervisor"
}
```

#### 2.5 发起家长确认
```
POST /api/replacements/{id}/start-confirmation?operator=admin
```

#### 2.6 提交家长回执
```
POST /api/replacements/{id}/confirmations/{studentId}
```
请求体:
```json
{
  "status": "CONFIRMED",
  "comment": "家长同意替换",
  "operator": "parent_user"
}
```
状态值: `PENDING`, `CONFIRMED`, `REJECTED`

#### 2.7 查询回执列表
```
GET /api/replacements/{id}/confirmations
```

#### 2.8 完成替换
```
POST /api/replacements/{id}/complete?operator=admin
```

#### 2.9 撤销替换
```
POST /api/replacements/{id}/revoke
```
请求体:
```json
{
  "reason": "取消临时调整",
  "operator": "admin"
}
```

#### 2.10 锁定替换
```
POST /api/replacements/{id}/lock?operator=supervisor
```

---

### 3. 报告接口

#### 3.1 生成供餐报告
```
POST /api/reports/generate
```
请求体:
```json
{
  "mealDate": "2026-05-25",
  "mealType": "LUNCH",
  "operator": "admin"
}
```

#### 3.2 查询报告
```
GET /api/reports               # 获取所有报告
GET /api/reports/{id}          # 获取单个报告
```

#### 3.3 终审报告（锁定餐次）
```
POST /api/reports/{id}/finalize?operator=supervisor
```

#### 3.4 导出Excel报告
```
GET /api/reports/{id}/export
```
返回: Excel 文件下载

---

## 预置样例场景

系统启动时自动初始化 5 个典型场景：

| 场景 | 说明 | 状态 |
|------|------|------|
| 场景1 | 正常流程：清蒸鱼→西红柿炖牛腩 | VALIDATED |
| 场景2 | 冲突流程：红烧肉→牛奶炖蛋（含鸡蛋/牛奶） | CONFLICT_DETECTED |
| 场景3 | 待确认：宫保鸡丁→虾仁炒蛋 | PENDING_CONFIRMATION |
| 场景4 | 已撤销：番茄炒蛋→牛奶炖蛋 | REVOKED |
| 场景5 | 待复核：麻婆豆腐→豆浆 | CONFLICT_DETECTED |

---

## 数据校验规则

### 过敏原校验
1. **新过敏原检测**: 替换菜品 - 原菜品 = 新增过敏原
2. **相同过敏原警告**: 替换菜品 ∩ 原菜品 ≠ ∅ 时警告
3. **受影响学生**: 对新增过敏原过敏的学生列表

### 重复替换检测
同一餐次、同一原菜品，不允许同时存在多个活跃替换

### 回执去重
- 数据库唯一约束: `replacement_id + student_id`
- 业务校验: 非 PENDING 状态不可重复提交

### 餐次锁定
- 替换完成后可单独锁定
- 报告终审后自动锁定该餐次所有完成替换
- 锁定后禁止撤销和重复创建

---

## 状态流转图

```
DRAFT → VALIDATING ─┬─→ VALIDATED ────────┐
                    │                      │
                    └─→ CONFLICT_DETECTED ─┤  (人工复核)
                                           │
                PENDING_CONFIRMATION ←────┘
                       │
                       ▼
         PENDING → CONFIRMED → PROCESSING → COMPLETED → LOCKED
                       │
                       ▼
                   REVOKED
```

---

## 统计与导出一致性

接口返回数据与导出报告数据来源统一，可互相校验：

| 统计项 | API字段 | Excel列 |
|--------|---------|---------|
| 学生总数 | totalStudents | 学生总数 |
| 替换菜品数 | replacementCount | 替换菜品数 |
| 过敏原冲突数 | allergenConflictCount | 过敏原冲突数 |
| 影响学生数 | affectedStudentsCount | 影响学生数 |
| 已确认回执 | confirmedCount | 已确认回执 |
| 待确认回执 | pendingConfirmationCount | 待确认回执 |
| 已拒绝回执 | rejectedCount | 已拒绝回执 |
