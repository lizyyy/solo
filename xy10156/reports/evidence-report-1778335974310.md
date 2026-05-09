# 测试覆盖证据报告

**项目:** test-coverage-demo  
**生成时间:** 2026/5/9 22:12:54  

## 统计概览

| 指标 | 数值 |
|------|------|
| 需求总数 | 5 |
| 已覆盖需求 | 4 |
| 未覆盖需求 | 1 |
| **需求覆盖率** | **80.00%** |
| 测试用例总数 | 7 |
| 通过 | 4 |
| 失败 | 1 |
| 待执行 | 2 |
| **测试通过率** | **57.14%** |

## 关键发现

1. 需求覆盖率为 80.00%，仍有 1 个需求未覆盖
2. 测试用例通过率为 57.14%，有 1 个用例失败
3. 未覆盖的需求: REQ-005

## 证据映射详情

### [REQ-001] 用户登录功能

- **状态:** ✅ 已覆盖
- **描述:** 用户可以通过用户名和密码登录系统

#### 关联测试用例 (2)

- **✅ [TC-001] 验证正确的用户名和密码可以登录**
  - 代码路径: `authService.js:login`, `userController.js:handleLogin`
- **✅ [TC-002] 验证错误的密码无法登录**
  - 代码路径: `authService.js:login`, `authService.js:verifyPassword`

### [REQ-002] 用户注册功能

- **状态:** ✅ 已覆盖
- **描述:** 新用户可以创建账户

#### 关联测试用例 (2)

- **✅ [TC-003] 验证新用户可以注册**
  - 代码路径: `authService.js:register`, `userController.js:handleRegister`
- **❌ [TC-004] 验证重复用户名无法注册**
  - 代码路径: `authService.js:register`, `userRepository.js:findByUsername`

### [REQ-003] 密码重置功能

- **状态:** ✅ 已覆盖
- **描述:** 用户可以通过邮箱重置密码

#### 关联测试用例 (1)

- **⏳ [TC-005] 验证密码重置流程**
  - 代码路径: `passwordService.js:requestReset`, `emailService.js:sendResetEmail`

### [REQ-004] 用户信息管理

- **状态:** ✅ 已覆盖
- **描述:** 用户可以查看和编辑个人信息

#### 关联测试用例 (2)

- **✅ [TC-006] 验证用户可以查看个人信息**
  - 代码路径: `userService.js:getProfile`, `userController.js:getUserInfo`
- **⏳ [TC-007] 验证用户可以编辑个人信息**
  - 代码路径: `userService.js:updateProfile`, `userController.js:updateUserInfo`

### [REQ-005] 权限控制

- **状态:** ❌ 未覆盖
- **描述:** 系统根据用户角色控制访问权限

> ⚠️ 无关联测试用例

