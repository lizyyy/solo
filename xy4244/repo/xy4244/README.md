# 签到凭证演练台

一个用于小型开源社区线下工作坊的本地"签到凭证演练台"。支持离线二维码凭证验证、签名校验、状态管理和审计日志。

## 功能特性

- **凭证签发**: 为参与者签发带有HMAC-SHA256签名的离线二维码凭证
- **入场核验**: 支持浏览器扫码或手动输入令牌，验证凭证真伪、过期、重复入场
- **异常复核**: 处理异常情况（过期、撤销、重复入场等）
- **数据导入导出**: 支持CSV导入报名数据，导出Markdown/CSV/JSON审计包
- **数据持久化**: 使用SQLite本地存储，刷新/重启后数据不丢失
- **审计日志**: 所有操作都记录审计日志，支持追溯

## 项目结构

```
xy4244/
├── config/
│   └── index.js          # 配置文件
├── data/                  # SQLite数据库存储目录
├── public/
│   ├── css/
│   │   └── style.css     # 样式文件
│   ├── js/
│   │   └── common.js     # 前端公共工具
│   ├── index.html        # 首页仪表盘
│   ├── issue.html        # 签发凭证页面
│   ├── verify.html       # 入场核验页面
│   ├── review.html       # 异常复核页面
│   └── export.html       # 导出报告页面
├── samples/
│   └── sample_participants.csv  # 示例CSV数据
├── src/
│   ├── api/
│   │   └── index.js      # API路由
│   ├── signature/
│   │   └── index.js      # 签名校验模块
│   ├── state-machine/
│   │   └── index.js      # 状态机模块
│   └── storage/
│       └── index.js      # 存储模块
├── package.json
├── server.js              # 主服务器文件
└── README.md
```

## 安装步骤

### 1. 环境要求

- Node.js >= 14.0.0
- npm >= 6.0.0

### 2. 安装依赖

```bash
npm install
```

### 3. 启动服务

```bash
npm start
```

服务启动后，访问 http://localhost:3000

## 使用流程

### 第一阶段：准备工作（活动前）

1. **导入参与者数据**
   - 访问 http://localhost:3000/issue.html
   - 选择"导入报名数据"标签页
   - 上传CSV文件（格式见下方）
   - 或手动添加参与者

2. **签发凭证**
   - 进入"参与者列表"标签页
   - 点击"签发凭证"按钮
   - 可设置生效时间和过期时间（默认7天）
   - 系统生成二维码和令牌，可复制保存

3. **发送凭证**
   - 将二维码图片或令牌发送给参与者
   - 参与者保存凭证（离线可用）

### 第二阶段：现场核验（活动当天）

1. **入场核验**
   - 访问 http://localhost:3000/verify.html
   - 方式一：点击"启动摄像头"扫码
   - 方式二：选择"手动输入"标签页，粘贴令牌

2. **验证流程**
   - 系统自动验证：
     - 签名是否有效（防篡改）
     - 是否已过期
     - 是否已入场（防重复）
     - 是否已撤销

3. **处理结果**
   - **验证通过**: 显示"确认入场"按钮，点击完成签到
   - **验证失败**: 显示失败原因，可跳转至异常复核

### 第三阶段：异常处理

1. **异常复核**
   - 访问 http://localhost:3000/review.html
   - 查看异常凭证列表（已入场、已撤销、已过期）
   - 快速查询：输入凭证令牌或ID

2. **操作选项**
   - **查看详情**: 查看凭证完整信息
   - **提交复核**: 记录复核备注和结果
   - **撤销凭证**: 撤销有效凭证（如冒名顶替）

### 第四阶段：活动结束

1. **导出报告**
   - 访问 http://localhost:3000/export.html
   - 选择导出格式：
     - **JSON**: 完整审计数据包（推荐备份）
     - **CSV**: 参与者列表、凭证状态、审计日志
     - **Markdown**: 格式化报告（含统计概览）

2. **数据分析**
   - 查看仪表盘统计：参与者数、入场数、撤销数
   - 导出审计日志进行后续分析

## CSV格式说明

### 导入CSV格式

```csv
name,email,phone
张三,zhangsan@example.com,13800138001
李四,lisi@example.com,13800138002
```

**字段说明**:
- `name` 或 `姓名`: 参与者姓名（必填）
- `email` 或 `邮箱`: 邮箱（可选）
- `phone` 或 `电话`: 电话（可选）

## 凭证格式说明

### 凭证令牌结构

凭证令牌采用 `Base64(payload).signature` 格式：

```
eyJpZCI6ImNyZWRf...<base64编码的JSON>.a1b2c3d4...<HMAC签名>
```

### Payload内容

```json
{
  "id": "cred_1234567890_abcdef",
  "participant_id": "uuid-participant-id",
  "name": "张三",
  "email": "zhangsan@example.com",
  "phone": "13800138001",
  "issued_at": 1717000000000,
  "valid_from": 1717000000000,
  "valid_until": 1717604800000,
  "metadata": {}
}
```

### 签名算法

使用 HMAC-SHA256 算法对 payload 进行签名：

```javascript
const signature = crypto.createHmac('sha256', secretKey)
  .update(JSON.stringify(payload))
  .digest('hex');
```

## 凭证状态机

```
┌──────────┐     issue      ┌──────────┐
│  (null)  │───────────────>│  active  │
└──────────┘                └────┬─────┘
                                │
         ┌──────────────────────┼──────────────────────┐
         │                      │                      │
    check_in                revoke                  expire
         │                      │                      │
         v                      v                      v
    ┌──────────┐          ┌──────────┐          ┌──────────┐
    │checked_in│          │ revoked  │          │ expired  │
    └──────────┘          └──────────┘          └──────────┘
```

**状态说明**:
- `active`: 凭证有效，可入场
- `checked_in`: 已入场，不可重复入场
- `revoked`: 已撤销，不可使用
- `expired`: 已过期，不可使用

## API接口文档

### 参与者管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/participants | 获取参与者列表 |
| POST | /api/participants | 添加参与者 |
| GET | /api/participants/:id | 获取参与者详情 |

### 凭证管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/credentials/issue | 签发凭证 |
| POST | /api/credentials/verify | 验证凭证 |
| POST | /api/credentials/checkin | 入场签到 |
| POST | /api/credentials/revoke | 撤销凭证 |
| GET | /api/credentials | 获取凭证列表 |
| GET | /api/credentials/:id | 获取凭证详情 |

### 数据导入导出

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/import/csv | 导入参与者CSV |
| GET | /api/export/json | 导出JSON审计包 |
| GET | /api/export/csv?type=xxx | 导出CSV（type: participants/credentials/audit-logs） |
| GET | /api/export/markdown | 导出Markdown报告 |

### 其他

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/health | 健康检查 |
| GET | /api/statistics | 获取统计数据 |
| GET | /api/audit-logs | 获取审计日志 |
| POST | /api/review | 提交复核记录 |

## 配置说明

配置文件位于 `config/index.js`：

```javascript
{
  server: {
    port: 3000,           // 服务端口
    host: 'localhost'      // 绑定地址
  },
  database: {
    path: './data/checkin.db'  // SQLite数据库路径
  },
  signature: {
    algorithm: 'HS256',    // 签名算法
    secret: 'your-secret', // 签名密钥（建议通过环境变量设置）
    expiresIn: '7d'        // 默认过期时间
  }
}
```

**环境变量**:
- `PORT`: 服务端口
- `DB_PATH`: 数据库路径
- `SIGNATURE_SECRET`: 签名密钥

## 安全考虑

1. **签名密钥**: 生产环境请设置 `SIGNATURE_SECRET` 环境变量
2. **离线验证**: 本系统设计为本地使用，不建议直接暴露到公网
3. **数据备份**: 定期导出JSON审计包进行备份
4. **访问控制**: 建议在可信网络环境下使用

## 本地验证流程示例

### 场景：张三入场签到

1. **准备阶段**
   ```bash
   # 1. 启动服务
   npm start
   
   # 2. 访问 http://localhost:3000/issue.html
   # 3. 导入张三的数据
   # 4. 为张三签发凭证，获取令牌：
   # eyJpZCI6ImNyZWRf...abc123
   ```

2. **核验阶段**
   ```bash
   # 1. 访问 http://localhost:3000/verify.html
   # 2. 手动输入张三的令牌
   # 3. 系统验证：
   #    - 签名有效 ✓
   #    - 未过期 ✓
   #    - 未入场 ✓
   # 4. 点击"确认入场"
   # 5. 张三状态变为"已入场"
   ```

3. **重复入场测试**
   ```bash
   # 1. 再次使用同一令牌核验
   # 2. 系统提示：重复入场
   # 3. 跳转至异常复核页面
   ```

4. **导出报告**
   ```bash
   # 1. 访问 http://localhost:3000/export.html
   # 2. 导出 JSON 审计包
   # 3. 包含：参与者、凭证、日志、撤销记录
   ```

## 常见问题

**Q: 数据存储在哪里？**
A: 使用SQLite数据库，默认存储在 `data/checkin.db` 文件中。

**Q: 凭证可以离线验证吗？**
A: 凭证令牌包含完整信息和签名，理论上可以离线验证。但本系统的状态管理（已入场、已撤销）需要数据库支持。

**Q: 如何备份数据？**
A: 有两种方式：
1. 直接复制 `data/checkin.db` 文件
2. 通过导出页面导出 JSON 审计包

**Q: 支持多台设备同时核验吗？**
A: 支持，但需要确保所有设备访问同一个服务器（同一数据库）。建议在局域网内使用。

## 许可证

MIT License
