# 前端导入校验差异回放器

> 解决运营上传表格后只看到失败总数，不知道每一行为什么失败的痛点。

## ✨ 功能特性

| 功能 | 描述 |
|------|------|
| **多输入支持** | 支持 CSV、XLSX、XLS 格式文件导入 |
| **详细校验** | 逐行校验，精准定位每个字段的错误原因 |
| **失败重试** | 支持单条重试、批量重试、编辑后重试 |
| **历史记录** | 所有导入任务持久化存储，可随时追溯 |
| **报告导出** | 支持 CSV、JSON、Excel 格式报告导出 |
| **可复验命令** | CLI 工具支持离线复验，无需依赖 Web |
| **坏数据不静默** | 所有错误都会明确暴露，不会被跳过 |
| **幂等处理** | 相同文件 + 相同规则重复导入只处理一次 |

## 🚀 快速开始

### 环境要求

- Node.js >= 18
- npm >= 9

### 安装依赖

```bash
npm install
```

### 启动开发环境

```bash
# 同时启动后端和前端
npm run dev

# 或分别启动
npm run dev:server    # 后端服务 http://localhost:3000
npm run dev:web       # 前端界面 http://localhost:5173
```

## 📋 验收示例

### 示例 1：使用 CLI 导入用户数据

**1. 查看可用的校验规则**

```bash
npm run build:cli
node dist/cli/index.js schemas
```

预期输出：
```
[xxx] 用户导入
  类型: user
  字段:
    - username (用户名) [必填] | 规则: minLength, maxLength, unique
    - email (邮箱) [必填] | 规则: unique
    - age (年龄) [可选] | 规则: min, max
    - status (状态) [必填] | 规则: enum

[xxx] 商品导入
  ...

[xxx] 订单导入
  ...
```

**2. 导入示例用户数据（包含多种错误）**

```bash
node dist/cli/index.js import examples/users.csv -s $(node dist/cli/index.js schemas --json 2>/dev/null | jq -r '.[] | select(.name=="用户导入") | .id' 2>/dev/null || echo "请手动指定 schema id")
```

或者先获取 schema id：
```bash
# 用一个简单的方式获取第一个用户 schema
node -e "const { ImportService } = require('./dist/server/services/importService'); const s = new ImportService(); console.log(s.getSchemas().find(x=>x.type==='user')?.id);"
```

然后导入：
```bash
node dist/cli/index.js import examples/users.csv -s <刚才获取的schema-id>
```

预期输出：
```
导入文件: /path/to/examples/users.csv
校验规则: 用户导入
文件格式: csv
----------------------------------------

✓ 导入任务完成
任务ID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
文件名: users.csv

统计:
  总计: 8
  成功: 1
  失败: 7
  成功率: 12.5%

错误统计:
  - 邮箱 必须是有效的邮箱地址 (1 条记录)
  - 状态 必须是 active, inactive, pending 之一 (2 条记录)
  - 邮箱 "zhangsan@example.com" 已存在，值必须唯一 (1 条记录)
  - 年龄不能小于0 (1 条记录)
  - 年龄不能大于150 (1 条记录)
  - 邮箱 不能为空 (1 条记录)
  - 用户名长度不能小于2位 (1 条记录)

提示: 使用 "import-validator replay <任务ID>" 查看详细错误
      使用 "import-validator retry <任务ID>" 重试失败行
```

**3. 复验详细错误**

```bash
node dist/cli/index.js replay <任务ID>
```

预期输出会逐行显示每条数据的具体错误：
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
行号: 2 | 状态: failed

数据:
  username: 李四
  email: lisi@example.com
  age: 30
  status: deleted

错误:
  status: 状态 必须是 active, inactive, pending 之一
    实际值: deleted
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
...
```

**4. 重试失败的行**

```bash
node dist/cli/index.js retry <任务ID>
```

### 示例 2：使用 Web 界面

**1. 打开界面**

```bash
npm run dev
```

访问 http://localhost:5173

**2. 上传商品数据**

1. 选择「商品导入」类型
2. 上传 `examples/products.csv`
3. 点击「开始校验」

**3. 查看校验结果**

- 总记录数: 7
- 成功: 2
- 失败: 5

错误详情会显示：
- `sku` 格式错误（小写字母）
- `price` 为负数
- `stock` 不是有效整数
- `sku` 重复
- `sku` 为空

**4. 重试功能**

1. 点击「查看详情」
2. 在失败行列表中，点击「编辑」修改错误数据
3. 或勾选多条失败行，点击「批量重试」

### 示例 3：导出报告

```bash
# 导出为 CSV
node dist/cli/index.js export <任务ID> -f csv

# 导出为 JSON
node dist/cli/index.js export <任务ID> -f json

# 导出为 Excel
node dist/cli/index.js export <任务ID> -f xlsx
```

### 示例 4：验证幂等性

**多次导入同一个文件：**

```bash
# 第一次导入
node dist/cli/index.js import examples/users.csv -s <schema-id>

# 第二次导入（相同文件）
node dist/cli/index.js import examples/users.csv -s <schema-id>
```

**预期行为**：第二次导入会直接返回之前的结果，不会重复创建新任务。

## 🎯 内置校验规则

### 字段类型

- `string` - 字符串
- `number` - 数字（小数）
- `integer` - 整数
- `boolean` - 布尔值
- `email` - 邮箱地址
- `date` - 日期

### 校验规则

| 规则 | 描述 | 示例值 |
|------|------|--------|
| `minLength` | 最小长度 | 2 |
| `maxLength` | 最大长度 | 50 |
| `min` | 最小值 | 0 |
| `max` | 最大值 | 150 |
| `pattern` | 正则匹配 | `^[A-Z0-9-]+$` |
| `enum` | 枚举值 | `['active', 'inactive']` |
| `unique` | 全局唯一 | - |

### 内置校验模板

| 模板 | 类型 | 说明 |
|------|------|------|
| 用户导入 | `user` | 用户名、邮箱、年龄、状态 |
| 商品导入 | `product` | SKU、名称、价格、库存 |
| 订单导入 | `order` | 订单号、客户、金额、日期 |

## 📖 CLI 命令参考

```bash
# 查看帮助
import-validator --help

# 列出历史任务
import-validator list
import-validator list -l 10

# 列出校验规则
import-validator schemas

# 导入并校验
import-validator import users.csv -s <schema-id>
import-validator import products.xlsx -s <schema-id> -f xlsx

# 复验详细结果
import-validator replay <job-id>
import-validator replay <job-id> -f    # 仅失败行
import-validator replay <job-id> -s    # 仅成功行
import-validator replay <job-id> -r 2,4,6    # 指定行号
import-validator replay <job-id> -j    # JSON 输出

# 重试失败行
import-validator retry <job-id>
import-validator retry <job-id> -r 2,3    # 重试指定行
import-validator retry <job-id> -e '{"2": {"email": "new@example.com"}}'    # 编辑后重试

# 导出报告
import-validator export <job-id> -f csv
import-validator export <job-id> -f xlsx -o ./report.xlsx

# 仅校验不保存历史
import-validator validate users.csv -s <schema-id>
```

## 🔧 构建与部署

```bash
# 构建所有模块
npm run build

# 单独构建
npm run build:server
npm run build:web
npm run build:cli

# 生产环境启动
npm start
```

## 📁 项目结构

```
import-validator-replayer/
├── server/                 # 后端服务
│   ├── index.ts           # Express 入口
│   ├── database.ts        # SQLite 数据库
│   └── services/
│       ├── fileParser.ts  # 文件解析器（CSV/XLSX）
│       ├── validator.ts   # 校验引擎
│       ├── importService.ts  # 导入服务
│       └── reportService.ts  # 报告服务
├── web/                   # 前端界面
│   └── src/
│       ├── views/         # 页面组件
│       ├── api.ts         # API 封装
│       └── main.ts        # 入口
├── cli/                   # 命令行工具
│   └── index.ts
├── shared/                # 共享类型定义
│   └── types.ts
├── examples/              # 示例数据
│   ├── users.csv
│   ├── products.csv
│   └── orders.csv
└── data/                  # 运行时数据（自动创建）
    ├── import-validator.db
    ├── uploads/
    └── reports/
```

## 🎨 技术栈

| 层级 | 技术 |
|------|------|
| 后端 | Node.js + Express + TypeScript |
| 前端 | Vue 3 + Vite + Element Plus |
| 数据库 | SQLite (better-sqlite3) |
| 文件解析 | papaparse + xlsx |
| CLI | Commander.js |

## ⚠️ 错误处理原则

1. **坏数据不静默** - 任何校验错误都会被记录和展示，不会被跳过
2. **错误信息明确** - 每个错误包含：字段名、规则类型、错误消息、实际值
3. **统计聚合** - 按错误类型聚合统计，帮助用户快速定位问题
4. **可追溯** - 所有历史数据保留，支持随时复验

## 🔒 幂等性保证

以下情况被视为相同任务，只会执行一次：

- 相同的文件路径 + 相同的最后修改时间 + 相同的文件大小
- 相同的校验规则

重新导入时会直接返回之前的结果，不会产生重复数据。

## 📝 License

MIT
