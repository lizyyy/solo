# SSO 属性映射测试报告

**生成时间**: 2026-05-19T07:19:57.975242

## 执行摘要

### 属性映射验证
- 总用户数: 4
- 成功: 2
- 失败: 2
- 成功率: 50.00%

### 测试用户回放
- 总测试用户数: 3
- 匹配: 0
- 差异: 3
- 匹配率: 0.00%

### 角色冲突检测
- 总冲突数: 1
- 有冲突用户数: 1

## 详细报告

### 属性映射错误详情

#### 用户: U003
- **email**: 邮箱格式无效: wangwu@
  - 源值: `wangwu@`
  - 映射值: `wangwu@`
  - 源位置: examples/identity.csv:4

#### 用户: U004
- **department**: department不能为空
  - 源值: ``
  - 映射值: ``
  - 源位置: examples/identity.csv:5

### 回放差异详情

#### 用户: U001
- **displayName** (unexpected):
  - 期望: `None`
  - 实际: `张三`
- **employeeId** (unexpected):
  - 期望: `None`
  - 实际: `E001`

#### 用户: U002
- **displayName** (unexpected):
  - 期望: `None`
  - 实际: `李四`
- **employeeId** (unexpected):
  - 期望: `None`
  - 实际: `E002`
- **角色差异**:
  - 期望: `viewer, product_owner`
  - 实际: `admin, viewer, product_owner`

#### 用户: U003
- **displayName** (unexpected):
  - 期望: `None`
  - 实际: `王五`
- **email** (value_mismatch):
  - 期望: `wangwu@example.com`
  - 实际: `wangwu@`
- **employeeId** (unexpected):
  - 期望: `None`
  - 实际: `E003`
- **角色差异**:
  - 期望: `marketer, viewer`
  - 实际: `marketer`

### 角色冲突详情

#### 用户: U003
- **missing_role** (error): 角色缺失: viewer

## ⚠️ 检测到错误

请查看详细报告中的错误信息，并根据源文件位置进行修正。