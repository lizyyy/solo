# 🔐 无密码登录训练场 - Passkey/WebAuthn 演练沙盒

一个用于内网安全培训的本地 Passkey/WebAuthn 演练沙盒，可以让学员亲身体验注册挑战值、凭据 ID、签名计数器、撤销设备和重放攻击之间的关系。

## ✨ 核心功能

### 🎯 真实 WebAuthn 模式
- 使用浏览器原生 WebAuthn API 进行真实的 Passkey 注册和登录
- 支持 Touch ID、Face ID、Windows Hello 或安全密钥
- 完整的验证流程和审计日志

### 🎮 教学模拟器模式
- 无需真实 Passkey 设备即可进行演练
- 使用可复现的本地密钥对模拟 authenticator 响应
- 支持演示各种攻击场景

### 🛡️ 安全检测
- ✅ 挑战值一次性使用和过期检测
- ✅ RP ID / Origin / UserHandle 校验
- ✅ 重复凭据检测
- ✅ 已撤销凭据检测
- ✅ 重放攻击检测
- ✅ 签名计数器倒退检测（克隆攻击）
- ✅ 用户不存在/凭据不存在检测
- ✅ 签名验证

### 📊 培训特性
- **三栏界面**：左侧用户管理、中间操作流、右侧详情视图
- **实时审计日志**：记录每一步操作和风险检测
- **攻击演示**：在模拟器模式下演示重放攻击和计数器倒退攻击
- **导出功能**：Markdown 培训复盘报告和 JSON 审计包

## 📁 项目结构

```
passkey-training-sandbox/
├── server/
│   ├── index.js              # 服务器入口
│   ├── config.js             # 配置文件
│   ├── database.js           # SQLite 数据库初始化
│   ├── routes/
│   │   └── index.js          # API 路由层
│   └── services/
│       ├── userService.js    # 用户管理服务
│       ├── credentialService.js  # 凭据存储服务
│       ├── challengeService.js   # 挑战值服务
│       ├── auditService.js       # 审计日志服务
│       ├── webauthnService.js    # WebAuthn 核心校验逻辑
│       ├── simulatorService.js   # 教学模拟器服务
│       └── exportService.js      # 导出服务
├── public/
│   ├── index.html            # 训练工作台界面
│   ├── css/
│   │   └── style.css         # 样式文件
│   └── js/
│       ├── app.js            # 前端主应用
│       └── webauthn-adapter.js  # WebAuthn/模拟器适配器
├── data/                     # SQLite 数据库存储目录
├── package.json
└── README.md
```

## 🚀 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 启动服务

```bash
npm start
```

### 3. 访问应用

打开浏览器访问：http://localhost:3000

## 📖 使用指南

### 模式选择

在页面右上角可以切换两种模式：

- **真实 WebAuthn 模式**：使用浏览器原生 WebAuthn API，需要支持 Passkey 的设备
- **教学模拟器模式**：使用软件模拟，无需真实设备，可演示攻击场景

### 核心流程

#### 1. 创建用户

1. 在左侧面板的"演练用户"区域输入用户名和显示名
2. 点击"创建用户"按钮
3. 用户列表会显示新创建的用户

#### 2. 注册 Passkey

**模拟器模式：**
1. 从左侧选择一个用户
2. 在"注册 Passkey"标签页中，点击"生成新密钥对"
3. 输入设备备注（如"公司笔记本"）
4. 点击"开始注册"

**真实模式：**
1. 从左侧选择一个用户
2. 输入设备备注
3. 点击"开始注册"
4. 按照浏览器提示完成生物识别认证

#### 3. 登录验证

1. 切换到"登录验证"标签页
2. 选择要使用的凭据（设备）
3. 点击"开始登录"
4. 完成认证

#### 4. 撤销凭据（模拟设备丢失）

1. 切换到"撤销与模拟"标签页
2. 选择要撤销的凭据
3. 点击"撤销凭据"
4. 尝试使用已撤销的凭据登录，会被拒绝

**恢复凭据**：点击"恢复凭据"可以模拟"找回设备"场景

#### 5. 攻击演示（仅模拟器模式）

##### 重放攻击演示
演示攻击者截获并重复使用认证响应的场景：

1. 切换到"攻击演示"标签页
2. 选择一个凭据
3. 点击"演示重放攻击"
4. 观察后端如何通过标记挑战值为"已使用"来检测攻击

##### 签名计数器倒退攻击演示
演示克隆设备使用旧计数器值的场景：

1. 确保该凭据至少有过一次成功登录（用于初始化计数器）
2. 点击"演示计数器倒退"
3. 观察后端如何检测计数器不递增的异常

### 导出功能

- **导出 JSON**：下载完整的审计数据包，包含所有用户、凭据和操作记录
- **导出报告**：下载 Markdown 格式的培训复盘报告

## 🔍 安全检测详解

### 挑战值（Challenge）管理

- **一次性使用**：每个挑战值只能使用一次，使用后标记为 `used=1`
- **过期检测**：挑战值默认 5 分钟后过期
- **重放检测**：尝试使用已使用的挑战值会被拒绝

### 签名计数器（Sign Count）

- 每次认证后，计数器值必须递增
- 如果收到的计数器值 ≤ 存储值，说明可能是克隆攻击
- 计数器为 0 时不进行检测（某些 authenticator 不支持计数器）

### 凭据撤销

- 撤销凭据时，设置 `is_revoked=1` 并记录 `revoked_at` 时间戳
- 已撤销的凭据尝试登录时会被立即拒绝
- 所有操作都会被记录到审计日志

### Origin / RP ID 验证

- 验证请求的 Origin 是否与配置一致（`http://localhost:3000`）
- 验证 authenticatorData 中的 RP ID 哈希是否匹配
- 防止跨域攻击

## 📝 审计日志字段

每次操作都会记录以下信息：

| 字段 | 说明 |
|------|------|
| `action` | 操作类型（注册开始/完成/失败、登录开始/完成/失败、撤销凭据等） |
| `userId` | 关联的用户 ID |
| `credentialId` | 关联的凭据 ID |
| `success` | 操作是否成功 |
| `errorCode` | 失败时的错误码 |
| `errorMessage` | 失败时的错误信息 |
| `riskFlags` | 检测到的风险标记（如 `challenge_replay`、`sign_count_rollback`） |
| `details` | 操作详细信息（JSON 格式） |
| `createdAt` | 操作时间戳 |

## 🎓 培训场景建议

### 场景 1：正常注册和登录流程

1. 创建用户 `alice`
2. 注册一个 Passkey（设备备注："个人手机"）
3. 使用该凭据进行登录
4. 观察右侧"当前操作详情"中的挑战值、凭据 ID、签名计数器变化

### 场景 2：设备丢失与恢复

1. 注册一个凭据后，在"撤销与模拟"标签页中撤销它
2. 尝试使用该凭据登录，观察被拒绝
3. 查看审计日志中的风险标记
4. 恢复凭据，再次登录成功

### 场景 3：攻击演示（模拟器模式）

1. 使用模拟器模式完成注册和一次正常登录
2. 在"攻击演示"标签页中演示重放攻击
3. 观察后端如何检测并阻止攻击
4. 查看审计日志中的 `challenge_replay` 风险标记
5. 演示签名计数器倒退攻击，观察 `sign_count_rollback` 风险标记

## ⚙️ 配置说明

在 `server/config.js` 中可以修改配置：

```javascript
{
  server: {
    port: 3000,           // 服务端口
    host: 'localhost'      // 绑定地址
  },
  webauthn: {
    rpId: 'localhost',     // RP ID（必须与访问域名一致）
    rpName: '无密码登录训练场',
    origin: 'http://localhost:3000',
    challengeTimeout: 5 * 60 * 1000  // 挑战值超时时间（毫秒）
  },
  database: {
    path: './data/passkey.db.json'  // JSON 文件数据库路径
  }
}
```

## 🔧 技术栈

### 后端
- **Node.js** + **Express**：Web 服务器
- **纯 JSON 文件存储**：无需原生依赖，兼容所有 Node.js 版本
- **crypto** 模块：加密签名验证

### 前端
- **原生 JavaScript**：无框架依赖，兼容现代浏览器
- **WebAuthn API**：浏览器原生 Passkey 支持

## 📋 注意事项

1. **WebAuthn 要求**：真实 WebAuthn 模式需要：
   - 浏览器支持（Chrome、Safari、Edge、Firefox 现代版本）
   - 安全上下文（HTTPS 或 localhost）
   - 支持 Passkey 的设备（Touch ID、Face ID、Windows Hello 或 FIDO2 安全密钥）

2. **数据持久化**：
   - 所有数据存储在 `data/passkey.db.json` JSON 文件中
   - 刷新页面和重启服务后数据不会丢失
   - 如需重置，删除该文件即可

3. **模拟器模式限制**：
   - 密钥对存储在服务器内存中，重启服务后会丢失
   - 仅用于教学演示，不应用于生产环境

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License
