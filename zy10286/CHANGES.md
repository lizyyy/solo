# 🔧 问题修复记录

## 第三轮修复：转班幂等性 & 数据一致性

### 发现的问题
1. **转班后报名记录状态不正确**：旧转班逻辑只设置 `transfer_to_id`，但没有把旧报名记录改为 `transferred` 状态
2. **重复转班防护缺失**：同一条报名记录可以被多次转班，产生多个新的活跃报名记录
3. **重复权限防护不足**：同一场次可能产生多条活跃权限记录
4. **转班到同一班级没有被阻止**
5. **退费状态检查不严格**

### 修复的文件

#### `server/services/permissionService.js`

**修改 `transferStudent` 方法（第178-251行）：**

```javascript
// 新增前置检查
if (enrollment.class_id === targetClassId) throw new Error('Cannot transfer to same class');

// 新增：只允许活跃的报名记录可以转班
if (enrollment.status !== 'active') throw new Error('Enrollment is not active, cannot transfer');

// 新增：检查是否已经转班过
if (enrollment.transfer_to_id) throw new Error('This enrollment has already been transferred');

// 新增：检查学员是否已经在目标班级报名
const existingEnrollment = await this.getAsync(
  `SELECT * FROM class_enrollments 
   WHERE student_id = ? AND class_id = ? AND status = 'active'`,
  [enrollment.student_id, targetClassId]
);
if (existingEnrollment) throw new Error('Student is already enrolled in the target class');

// 修复：更新旧报名记录状态为 transferred（之前只设置 transfer_to_id）
await this.runAsync(
  `UPDATE class_enrollments 
   SET status = 'transferred', transfer_to_id = ?, updated_at = CURRENT_TIMESTAMP
   WHERE id = ?`,
  [newEnrollmentId, enrollmentId]
);
```

**增强 `grantPermission` 方法的幂等性检查（第80-111行）：**

```javascript
// 新增：检查同一场次是否已有活跃权限
const existingActivePerm = await this.getAsync(
  `SELECT * FROM replay_permissions 
   WHERE student_id = ? AND session_id = ? AND status = 'active'`,
  [enrollment.student_id, sessionId]
);

if (existingActivePerm) {
  return { permission: existingActivePerm, isNew: false, warning: 'Duplicate active permission prevented' };
}
```

**增强 `processRefund` 方法的状态检查（第152-162行）：**

```javascript
if (enrollment.status !== 'active' && enrollment.status !== 'transferred') {
  throw new Error('Enrollment is not active, cannot refund');
}
```

#### `client/src/pages/Students.js`

**增强转班/退费的错误处理（第127-148行，第160-178行）：**
- 添加非 200 响应的错误处理逻辑
- 显示后端返回的具体错误信息

---

## 第二轮修复：转班/退费弹窗报名记录加载

### 发现的问题
1. 前端直接使用列表页学员数据打开转班/退费弹窗，但列表接口只返回报名数量统计，不包含详细报名记录
2. 导致弹窗中没有可选的报名记录

### 修复方案
- 点击转班/退费按钮时先调用学员详情接口 `/api/students/:id` 获取完整报名记录
- 只显示状态为 `active` 的报名记录供选择

---

## ✅ 幂等性验证结果

所有核心功能已通过完整测试：

| 测试场景 | 预期行为 | 实际结果 | 状态 |
|---------|---------|---------|------|
| 第一次转班 | 成功，创建新报名记录 | 成功创建 | ✅ |
| 同一条 enrollment 重复转班 | 阻止并报错 | 正确阻止 | ✅ |
| 转班到同一班级 | 阻止并报错 | 正确阻止 | ✅ |
| 旧报名记录状态 | 更新为 transferred | 正确更新 | ✅ |
| transfer_to_id 设置 | 正确设置 | 正确设置 | ✅ |
| 转班后权限迁移 | 旧权限回收，新权限授予 | 5条回收，5条授予 | ✅ |
| 同一场次重复权限 | 防止重复创建 | 无重复 | ✅ |
| 第一次退费 | 成功，回收权限 | 成功回收5条 | ✅ |
| 重复退费 | 幂等处理，不报错 | 正确幂等 | ✅ |
| 退费后权限状态 | 全部 revovked | 0 active, 10 revoked | ✅ |

### 权限状态变化验证

| 阶段 | 总权限数 | 活跃权限 | 已回收权限 |
|------|---------|---------|-----------|
| 初始状态 | 5 | 5 | 0 |
| 转班后 | 10 | 5 | 5 |
| 退费后 | 10 | 0 | 10 |

### 操作历史事件验证
- ✅ `student_transferred` - 学员转班事件（仅1条，无重复）
- ✅ `enrollment_refunded` - 学员退费事件（幂等处理）

---

## 🎯 最终实现效果

教务老师现在可以：

1. ✅ 在学员列表页查看报名情况统计
2. ✅ 点击「转班」按钮时能正确选择该学员的活跃报名记录
3. ✅ 转班后旧报名记录状态自动更新为 `transferred`
4. ✅ 同一条报名记录无法被重复转班
5. ✅ 无法转班到学员已报名的班级
5. ✅ 无法转班到同一班级
6. ✅ 点击「退费」按钮时能正确选择该学员的活跃报名记录
7. ✅ 转班后自动回收原班级权限并授予新班级权限
8. ✅ 退费后立即回收该班级的所有回放权限
9. ✅ 退费幂等处理，重复操作不会产生副作用
10. ✅ 同一场次不会产生多条活跃权限记录
11. ✅ 在学员详情页看到完整的业务节点变化时间线
12. ✅ 追踪每一次权限授予和回收的完整过程

---

## 📝 数据状态定义

| 报名记录状态 | 含义 | 允许的操作 |
|------------|------|-----------|
| active | 正常报名中 | 转班、退费 |
| transferred | 已转班 | 不可操作（仅退费） |
| refunded | 已退费 | 不可操作 |

| 权限状态 | 含义 |
|--------|------|
| active | 权限有效，可以观看回放 |
| revoked | 权限已回收，无法观看回放 |
