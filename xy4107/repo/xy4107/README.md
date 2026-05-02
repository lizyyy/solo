# 🔐 无密码登录彩排台

## Passkey Rehearsal Platform - WebAuthn 演练测试工具

一个给公司内训平台管理员使用的本地 Passkey 演练服务，用于上线前测试 WebAuthn 注册、登录、设备丢失和备用码等完整流程。

---

## ✨ 核心功能

### 📝 注册演练
- 用户创建与管理
- WebAuthn 凭证注册（支持真实协议和模拟模式）
- 挑战值生成与过期管理
- 公钥存储
- 备用码自动生成

### 🔑 登录演练
- 登录挑战生成
- 多设备选择
- 模拟模式验证
- 备用码登录

### ❌ 设备丢失演练
- 凭证撤销
- 撤销原因记录
- 状态更新

### 📋 审计与查询
- 完整审计日志
- 多条件筛选（用户、操作、时间范围）
- 操作统计

### 📦 导入导出
- CSV 用户批量导入
- CSV 用户导出
- Markdown 安全演练报告
- JSON 审计数据包

### 💾 数据持久化
- 所有数据存储在本地 JSON 文件
- 刷新或重启服务后数据不丢失
- 支持数据重置

---

## 📁 项目结构

```
xy4107/
├── config.js              # 配置文件
├── package.json           # 项目依赖
├── server.js              # 服务入口
├── README.md              # 本文档
├── data/                  # 数据存储目录（运行时自动创建）
│   ├── users.json         # 用户数据
│   ├── credentials.json   # 凭证数据
│   ├── challenges.json    # 挑战数据
│   ├── audit.json         # 审计日志
│   └── backupCodes.json   # 备用码数据
├── src/                   # 源代码
│   ├── storage.js         # 存储层（文件持久化）
│   ├── webauthn.js        # WebAuthn 适配与模拟
│   ├── stateMachine.js    # 业务状态机
│   ├── importExport.js    # 导入导出模块
│   └── routes/            # API 路由
│       ├── users.js       # 用户管理 API
│       ├── auth.js        # 认证 API
│       └── audit.js       # 审计与导入导出 API
├── public/                # 前端界面
│   ├── index.html         # 主页面
│   └── app.js             # 前端逻辑
└── test/                  # 测试
    └── test.js            # 集成测试
```

---

## 🚀 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 启动服务

```bash
npm start
```

服务启动后，访问：**http://localhost:3000**

### 3. 运行测试

```bash
npm test
```

---

## 📖 使用指南

### 界面概览

访问 http://localhost:3000 后，你会看到 6 个主要标签页：

| 标签页 | 功能描述 |
|--------|----------|
| 📊 仪表板 | 系统统计、快捷操作、最近审计记录 |
| 📝 注册演练 | 模拟用户注册 WebAuthn 凭证 |
| 🔑 登录演练 | 模拟登录、备用码登录、设备撤销 |
| 👥 用户管理 | 查看和管理所有用户 |
| 📋 审计日志 | 查看完整操作记录，支持筛选 |
| 📦 导入导出 | CSV导入、数据导出、加载示例数据 |

---

### 演练场景 1: 注册流程

**目标：** 测试用户注册 WebAuthn 凭证的完整流程

**步骤：**

1. 切换到 **📝 注册演练** 标签页
2. 填写用户信息：
   - 用户名：`testuser`
   - 显示名称：`测试用户`
   - 邮箱：`test@example.com`
   - 设备名称：`MacBook Pro (测试)`
   - 设备类型：`内置设备`
   - ✅ 勾选「使用模拟模式」（无需真实 Passkey 设备）

3. 点击 **🚀 开始注册流程**
   - 系统会创建用户并生成注册挑战值
   - 挑战值会显示在右侧

4. 点击 **✅ 完成注册 (模拟验证)**
   - 系统模拟 WebAuthn 验证过程
   - 生成凭证信息和 10 个备用码
   - **请保存备用码！** 后续测试会用到

5. 验证结果：
   - 查看凭证信息（设备名称、公钥、计数器）
   - 查看生成的 10 个备用码

---

### 演练场景 2: 登录流程

**目标：** 测试用户使用 Passkey 登录的流程

**步骤：**

1. 切换到 **🔑 登录演练** 标签页
2. 在「步骤 1: 发起登录挑战」区域：
   - 用户名：`testuser`（刚注册的用户）
   - ✅ 勾选「使用模拟模式」

3. 点击 **🔐 获取登录挑战**
   - 系统查找用户并生成登录挑战
   - 显示可用的凭证设备列表

4. 在「步骤 2: 选择设备并验证」区域：
   - 选择凭证设备（应该能看到刚才注册的设备）
   - 点击 **✅ 完成登录 (模拟验证)**

5. 验证结果：
   - 显示登录成功信息
   - 记录登录用户和使用的设备

---

### 演练场景 3: 备用码登录

**目标：** 测试设备丢失时使用备用码登录的流程

**前置条件：** 完成「演练场景 1: 注册流程」，已保存备用码

**步骤：**

1. 在 **🔑 登录演练** 标签页的「🔐 使用备用码登录」区域：
   - 用户 ID：可以在「用户管理」中查看，或从注册结果中获取
   - 备用码：使用注册时生成的任意一个备用码（如：`ABCD1234`）

2. 点击 **🔑 使用备用码登录**

3. 验证结果：
   - 显示登录成功
   - 显示剩余备用码数量（应该是 9 个，因为用了 1 个）

4. 验证备用码已失效：
   - 尝试再次使用同一个备用码登录
   - 应该会提示「备用码无效或已被使用」

---

### 演练场景 4: 设备丢失与凭证撤销

**目标：** 测试设备丢失后管理员撤销凭证的流程

**前置条件：** 完成「演练场景 1: 注册流程」

**步骤：**

1. 在 **🔑 登录演练** 标签页的「❌ 模拟设备丢失演练」区域：
   - 点击 **📋 加载用户凭证**
   - 在弹窗中输入用户名：`testuser`

2. 或者，从 **👥 用户管理** 标签页：
   - 找到 `testuser` 用户
   - 点击「撤销凭证」链接

3. 选择要撤销的凭证：
   - 应该能看到 `testuser` 的活跃凭证
   - 撤销原因：`设备丢失 - MacBook Pro 被盗`

4. 点击 **❌ 撤销凭证**
   - 确认撤销操作

5. 验证撤销生效：
   - 切换到 **🔑 登录演练** 标签页
   - 尝试用 `testuser` 登录
   - 应该提示「该用户没有可用的登录凭证」

6. 查看审计记录：
   - 切换到 **📋 审计日志** 标签页
   - 应该能看到 `CREDENTIAL_REVOKED` 记录

---

### 演练场景 5: 批量用户导入

**目标：** 测试从 CSV 批量导入用户的功能

**步骤：**

1. 切换到 **📦 导入导出** 标签页
2. 准备 CSV 文件（或使用系统提供的示例）：
   - 点击「下载示例 CSV」获取模板
   - 或者直接在文本框中粘贴以下内容：

```csv
username,displayName,email
zhangsan,张三,zhangsan@example.com
lisi,李四,lisi@example.com
wangwu,王五,wangwu@example.com
zhaoliu,赵六,zhaoliu@example.com
```

3. 在「或直接粘贴 CSV 内容」文本框中粘贴 CSV 内容
4. 点击 **📥 导入用户**
5. 验证结果：
   - 显示导入统计（总计、成功、失败数量）
   - 切换到 **👥 用户管理** 标签页，应该能看到新导入的用户
   - 切换到 **📋 审计日志** 标签页，应该能看到 `USER_IMPORTED` 记录

---

### 演练场景 6: 导出演练报告

**目标：** 测试导出安全演练报告和审计数据包的功能

**前置条件：** 已完成至少一个演练场景

**步骤：**

1. 导出 Markdown 安全演练报告：
   - 切换到 **📦 导入导出** 标签页
   - 点击 **📄 导出 Markdown 报告**
   - 下载并打开 `security-report.md`
   - 报告应包含：
     - 系统概览（用户统计、凭证统计）
     - 操作统计
     - 详细审计日志
     - 用户详情
     - 安全建议

2. 导出 JSON 审计包：
   - 点击 **📦 导出 JSON 审计包**
   - 下载并打开 `audit-package.json`
   - 包含完整数据结构：
     - metadata（导出元数据）
     - statistics（统计数据）
     - users（用户列表）
     - credentials（凭证列表）
     - auditLogs（审计日志）

3. 导出用户 CSV：
   - 点击 **👥 导出用户 CSV**
   - 下载所有用户的基本信息

---

## 🔧 API 接口

### 健康检查
```bash
GET /api/health
```

### 用户管理
```bash
# 获取所有用户
GET /api/users

# 获取单个用户详情
GET /api/users/:userId

# 创建用户
POST /api/users
Content-Type: application/json
{
  "username": "testuser",
  "displayName": "测试用户",
  "email": "test@example.com"
}

# 删除用户
DELETE /api/users/:userId
```

### 认证接口
```bash
# 开始注册
POST /api/auth/register/start
Content-Type: application/json
{
  "username": "testuser",
  "displayName": "测试用户",
  "email": "test@example.com",
  "deviceInfo": {
    "name": "MacBook Pro",
    "type": "platform"
  },
  "useSimulation": true
}

# 完成注册
POST /api/auth/register/complete
Content-Type: application/json
{
  "userId": "user-uuid",
  "useSimulation": true
}

# 开始登录
POST /api/auth/login/start
Content-Type: application/json
{
  "username": "testuser",
  "useSimulation": true
}

# 完成登录
POST /api/auth/login/complete
Content-Type: application/json
{
  "userId": "user-uuid",
  "credentialId": "credential-uuid",
  "useSimulation": true
}

# 备用码登录
POST /api/auth/login/backup-code
Content-Type: application/json
{
  "userId": "user-uuid",
  "code": "ABCD1234"
}

# 撤销凭证
POST /api/auth/credentials/:credentialId/revoke
Content-Type: application/json
{
  "reason": "设备丢失"
}

# 重新生成备用码
POST /api/auth/users/:userId/backup-codes/regenerate
```

### 审计与导入导出
```bash
# 获取审计日志
GET /api/audit
GET /api/audit?userId=xxx&action=REGISTRATION_COMPLETED&startDate=2024-01-01&endDate=2024-12-31

# 获取统计数据
GET /api/audit/stats

# 导入用户
POST /api/audit/import/users
Content-Type: application/json
{
  "csvContent": "username,displayName,email\nzhangsan,张三,zhangsan@example.com"
}

# 导出用户 CSV
GET /api/audit/export/users

# 导出 Markdown 报告
GET /api/audit/export/report
GET /api/audit/export/report?userId=xxx

# 导出 JSON 审计包
GET /api/audit/export/audit
GET /api/audit/export/audit?action=CREDENTIAL_REVOKED

# 获取示例 CSV
GET /api/audit/sample/csv

# 重置所有数据
POST /api/audit/reset
```

---

## ⚙️ 配置说明

编辑 `config.js` 可修改以下配置：

```javascript
module.exports = {
  rpID: 'localhost',           // 依赖方 ID（用于 WebAuthn）
  rpName: '无密码登录彩排台',   // 依赖方名称
  origin: 'http://localhost:3000',  // 服务地址
  port: 3000,                   // 服务端口
  dataDir: './data',            // 数据存储目录
  challengeTimeout: 5 * 60 * 1000,  // 挑战过期时间（毫秒）
  backupCodeCount: 10,          // 每个用户的备用码数量
  backupCodeLength: 8           // 备用码长度
};
```

---

## 🧪 测试说明

项目包含完整的集成测试，测试所有核心功能：

```bash
npm test
```

测试覆盖以下场景：
1. 用户创建
2. 凭证注册（模拟模式）
3. 登录认证（模拟模式）
4. 备用码登录
5. 凭证撤销
6. 备用码重新生成
7. CSV 用户导入
8. 审计日志记录
9. Markdown 报告导出
10. JSON 审计包导出
11. 统计数据
12. 数据持久化验证

---

## 🔒 安全注意事项

### 本地使用
- 此工具设计为**本地演练使用**，请勿暴露到公网
- 数据存储在本地 `data/` 目录，包含敏感信息（公钥、备用码等）
- 测试完成后可使用「重置所有数据」功能清除测试数据

### 生产环境对比
- 模拟模式 (`useSimulation: true`) 仅供演练使用
- 真实 WebAuthn 协议需要：
  - HTTPS 连接（或 localhost）
  - 真实的 Passkey 设备（Touch ID、Face ID、YubiKey 等）
  - 浏览器支持 WebAuthn API

### 备用码最佳实践
- 备用码应**一次性使用**，使用后立即失效
- 建议每个用户至少保存 10 个备用码
- 设备更换后应**重新生成**备用码，旧码自动失效
- 备用码应**安全存储**，不要与设备放在一起

---

## 📋 演练检查清单

上线前建议完成以下演练：

### ✅ 注册流程
- [ ] 用户创建成功
- [ ] 注册挑战生成
- [ ] 凭证注册成功
- [ ] 备用码生成（10 个）
- [ ] 审计日志记录正确

### ✅ 登录流程
- [ ] 登录挑战生成
- [ ] 凭证选择可用
- [ ] 登录验证成功
- [ ] 凭证计数器更新
- [ ] 审计日志记录正确

### ✅ 备用码流程
- [ ] 备用码登录成功
- [ ] 已使用的备用码失效
- [ ] 剩余备用码计数正确
- [ ] 审计日志记录正确

### ✅ 设备丢失流程
- [ ] 凭证撤销成功
- [ ] 撤销后无法登录
- [ ] 撤销原因记录
- [ ] 审计日志记录正确

### ✅ 导入导出
- [ ] CSV 导入成功
- [ ] Markdown 报告导出完整
- [ ] JSON 审计包结构正确
- [ ] 所有数据持久化

---

## 🆘 常见问题

### Q: 为什么需要模拟模式？
A: 模拟模式允许在没有真实 Passkey 设备的情况下演练完整流程。这对于：
- 没有 Touch ID/Face ID 的设备
- 批量测试场景
- 自动化测试
- 离线演练

### Q: 数据存在哪里？会丢失吗？
A: 所有数据存储在 `data/` 目录下的 JSON 文件中：
- `users.json` - 用户数据
- `credentials.json` - 凭证数据
- `challenges.json` - 挑战数据（会自动清理过期项）
- `audit.json` - 审计日志
- `backupCodes.json` - 备用码数据

只要不删除 `data/` 目录，数据就不会丢失，重启服务后依然存在。

### Q: 如何重置所有数据？
A: 有两种方式：
1. 在 Web 界面的 **📊 仪表板** 点击「🗑️ 重置所有数据」
2. 调用 API: `POST /api/audit/reset`
3. 手动删除 `data/` 目录下的所有 JSON 文件

### Q: 支持真实的 WebAuthn 协议吗？
A: 支持！代码中包含完整的 WebAuthn 实现：
- `src/webauthn.js` 使用 `@simplewebauthn/server` 库
- 注册接口支持 `useSimulation: false`
- 登录接口支持 `useSimulation: false`

注意：真实 WebAuthn 需要：
- HTTPS 连接（localhost 除外）
- 支持 WebAuthn 的浏览器
- 真实的 Passkey 设备

### Q: 备用码格式是怎样的？
A: 备用码使用以下规则生成：
- 长度：8 位字符
- 字符集：`ABCDEFGHJKLMNPQRSTUVWXYZ23456789`（排除易混淆的 0、O、1、I、l）
- 格式：大写字母和数字组合
- 示例：`ABCD1234`, `WXYZ7890`

---

## 📄 许可证

MIT License

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

---

## 📧 联系

如有问题，请查看代码中的注释或提交 Issue。

---

**最后更新:** 2024年

**版本:** 1.0.0
