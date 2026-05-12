# 外卖骑手申诉 CLI 工具

一个本地可运行的外卖骑手申诉处理 CLI 工具，帮助站长高效处理骑手对超时、差评、取消单的申诉。

## 功能特性

- **数据导入**: 支持导入订单、骑手轨迹、商家出餐、天气事件、平台处罚、申诉数据
- **智能审核**: 基于规则引擎自动审核申诉，结合轨迹、商家出餐、天气等多维度证据
- **状态追踪**: 完整记录申诉生命周期，支持查看历史状态变化
- **人工修正**: 支持人工干预申诉结果，记录修正前后差异和操作者
- **报告生成**: 导出结构化申诉报告，包含证据、判定理由、退回金额等
- **幂等保证**: 重复导入、重复审核不会产生副作用
- **内置样例**: 包含超时、差评、取消单、暴雨等真实场景演示数据

## 快速开始

### 环境要求

- Node.js >= 16
- npm 或 yarn

### 安装

```bash
# 安装依赖
npm install

# 编译 TypeScript
npm run build
```

### 本地启动

方式一：使用 ts-node 直接运行
```bash
npx ts-node src/index.ts --help
```

方式二：编译后运行
```bash
npm run build
node dist/index.js --help
```

（可选）全局安装
```bash
npm link
appeal --help
```

## 核心命令

### 1. init - 初始化系统

```bash
# 初始化空数据库
appeal init

# 初始化并导入内置样例数据
appeal init --sample-data
```

**说明**:
- 创建工作目录 `~/.rider-appeal/`
- 创建 SQLite 数据库 `appeal.db`
- 初始化 9 张数据表

### 2. import - 导入数据

```bash
# 导入内置样例数据
appeal import --sample

# 从文件导入订单数据
appeal import -t orders -f ./data/orders.json

# 从文件导入轨迹数据
appeal import -t trajectories -f ./data/trajectories.json

# 从文件导入申诉
appeal import -t appeals -f ./data/appeals.json
```

**支持的数据类型**:
- `orders` - 订单信息
- `trajectories` - 骑手轨迹
- `meals` - 商家出餐
- `weather` - 天气事件
- `penalties` - 平台处罚
- `appeals` - 申诉申请

### 3. check - 审核申诉

```bash
# 审核所有待处理申诉
appeal check --all

# 审核指定申诉
appeal check --id <appeal-id>

# 显示详细审核过程
appeal check --all --detail
```

### 4. list - 查看申诉列表

```bash
# 查看所有申诉
appeal list

# 按状态过滤
appeal list -s pending
appeal list -s approved
appeal list -s rejected

# 按类型过滤
appeal list -t timeout
appeal list -t bad_review
appeal list -t cancellation

# 按骑手过滤
appeal list -r RIDER-001

# 按订单号过滤
appeal list -o ORDER-TIMEOUT-001
```

### 5. detail - 查看申诉详情

```bash
# 查看基本详情
appeal detail <appeal-id>

# 查看详情 + 历史记录
appeal detail <appeal-id> --history

# 查看详情 + 证据详情
appeal detail <appeal-id> --evidence
```

### 6. report - 生成申诉报告

```bash
# 在终端显示报告
appeal report <appeal-id>

# 导出为 JSON 格式
appeal report <appeal-id> -f json

# 导出到文件
appeal report <appeal-id> --export
```

### 7. correct - 人工修正

```bash
# 人工修正申诉结果
appeal correct <appeal-id> \
  -s approved \
  -a 50.00 \
  -r "复查发现确实是商家出餐问题" \
  -o "站长-王小明"
```

**参数说明**:
- `-s, --status`: 新状态 (approved | rejected)
- `-a, --amount`: 新的退回金额
- `-r, --reason`: 修正原因（必填）
- `-o, --operator`: 操作员名称

### 8. stats - 查看统计

```bash
appeal stats
```

### 9. demo - 一键演示

```bash
appeal demo
```

## 主要演示路径

### 完整演示流程

```bash
# 1. 初始化并导入样例数据
appeal init --sample-data

# 2. 查看申诉列表
appeal list

# 3. 审核所有申诉
appeal check --all --detail

# 4. 查看审核结果
appeal list

# 5. 查看某个申诉详情（取一个通过的申诉 ID）
appeal detail <appeal-id> --history

# 6. 生成报告
appeal report <appeal-id>

# 7. 查看统计
appeal stats
```

### 内置样例场景

系统内置 5 个典型场景：

| 场景 | 订单号 | 申诉类型 | 预期结果 | 说明 |
|------|--------|----------|----------|------|
| 超时-商家出餐晚 | ORDER-TIMEOUT-001 | timeout | 通过 | 商家出餐延迟 13 分钟导致超时 |
| 超时-暴雨天气 | ORDER-TIMEOUT-002 | timeout | 通过 | 配送时遭遇特大暴雨 |
| 差评申诉 | ORDER-REVIEW-001 | bad_review | 通过 | 商家出餐慢导致差评 |
| 取消单申诉 | ORDER-CANCEL-001 | cancellation | 通过 | 用户主动取消订单 |
| 无证据超时 | ORDER-FAIL-001 | timeout | 驳回 | 缺少轨迹和商家数据 |

## 失败路径演示

### 场景：无证据的超时申诉

```bash
# 初始化（如未初始化）
appeal init --sample-data

# 查看所有申诉，找到 ORDER-FAIL-001
appeal list -t timeout

# 审核该订单的申诉（查看详情）
appeal check --all --detail

# 验证结果：申诉被驳回
appeal list -s rejected

# 查看驳回详情
appeal detail <rejected-appeal-id> --evidence
```

**失败原因**:
- 缺少轨迹数据 (`trajectories: []`)
- 缺少商家出餐数据 (`merchantMeals: []`)
- 无法证明超时非骑手责任
- 规则检查通过率 < 60%

### 场景：重复申诉

```bash
# 尝试对已有申诉的订单再次导入同类型申诉
echo '[
  {
    "orderNo": "ORDER-TIMEOUT-001",
    "riderId": "RIDER-001",
    "appealType": "timeout",
    "appealReason": "再次申诉"
  }
]' > /tmp/duplicate_appeal.json

appeal import -t appeals -f /tmp/duplicate_appeal.json
```

**预期**: 导入失败，提示"该订单已有同类型申诉，不允许重复申诉"

## 审核规则说明

### 超时申诉 (timeout) 规则

| 规则ID | 规则名称 | 权重 | 通过条件 |
|--------|----------|------|----------|
| R001 | 订单存在处罚记录 | 10 | 有 active 状态处罚 |
| R002 | 订单确实超时 | 15 | 实际送达 > 承诺时间 |
| R003 | 商家出餐超时 | 25 | 出餐延迟 > 15 分钟 |
| R004 | 恶劣天气影响 | 25 | 配送时段有暴雨/暴雪等 |
| R005 | 轨迹完整无断点 | 15 | 无超过 5 分钟的间隔 |
| R006 | 到店等待时间长 | 10 | 等待 > 10 分钟 |

通过条件：**权重和 >= 60%**

### 差评申诉 (bad_review) 规则

| 规则ID | 规则名称 | 权重 | 通过条件 |
|--------|----------|------|----------|
| R011 | 商家出餐超时导致 | 30 | 出餐延迟 > 15 分钟 |
| R012 | 恶劣天气影响 | 25 | 配送时段有恶劣天气 |
| R013 | 轨迹正常 | 25 | 轨迹完整无异常 |
| R014 | 配送时间合理 | 20 | 超时 > 30 分钟或商家超时 |

通过条件：**权重和 >= 60%**

### 取消单申诉 (cancellation) 规则

| 规则ID | 规则名称 | 权重 | 通过条件 |
|--------|----------|------|----------|
| R021 | 订单已取消 | 10 | 订单状态是 cancelled |
| R022 | 取消方非骑手 | 30 | 用户/商家/系统发起取消 |
| R023 | 商家出餐过慢 | 30 | 接单后 > 30 分钟才出餐 |
| R024 | 恶劣天气导致 | 30 | 取消时段有恶劣天气 |

通过条件：**权重和 >= 60%**

## 数据格式说明

### 订单数据 (orders)

```json
[
  {
    "orderNo": "ORDER-001",
    "riderId": "RIDER-001",
    "riderName": "张三",
    "merchantId": "MERCHANT-001",
    "merchantName": "XX餐馆",
    "userId": "USER-001",
    "userName": "李女士",
    "merchantAddress": "XX路XX号",
    "deliveryAddress": "YY路YY号",
    "estimatedDeliveryTime": 1800000,
    "actualDeliveryTime": 1715000000000,
    "promisedTime": 1715000000000,
    "createTime": 1715000000000,
    "acceptTime": 1715000060000,
    "arriveMerchantTime": 1715000180000,
    "pickUpTime": 1715000600000,
    "deliverTime": 1715001000000,
    "status": "completed"
  }
]
```

### 轨迹数据 (trajectories)

```json
[
  {
    "orderNo": "ORDER-001",
    "riderId": "RIDER-001",
    "timestamp": 1715000000000,
    "latitude": 39.9042,
    "longitude": 116.4074,
    "speed": 15.5,
    "eventType": "moving"
  }
]
```

### 申诉数据 (appeals)

```json
[
  {
    "orderNo": "ORDER-001",
    "riderId": "RIDER-001",
    "appealType": "timeout",
    "appealReason": "商家出餐慢，不是我的责任",
    "submitTime": 1715000000000
  }
]
```

## 项目结构

```
.
├── src/
│   ├── index.ts              # CLI 入口
│   ├── types/
│   │   └── index.ts          # 类型定义
│   ├── db/
│   │   └── database.ts       # 数据库管理
│   ├── utils/
│   │   ├── config.ts         # 配置管理
│   │   └── logger.ts         # 日志工具
│   ├── services/
│   │   ├── importService.ts  # 数据导入服务
│   │   ├── checkService.ts   # 审核规则引擎
│   │   ├── reportService.ts  # 报告服务
│   │   └── historyService.ts # 历史记录服务
│   └── data/
│       └── sampleData.ts     # 内置样例数据
├── package.json
├── tsconfig.json
└── README.md
```

## 数据库表结构

| 表名 | 说明 |
|------|------|
| orders | 订单信息 |
| rider_trajectories | 骑手轨迹 |
| merchant_meals | 商家出餐 |
| weather_events | 天气事件 |
| platform_penalties | 平台处罚 |
| appeals | 申诉记录 |
| appeal_corrections | 人工修正记录 |
| appeal_histories | 申诉历史记录 |

## 配置

可以通过环境变量自定义工作目录：

```bash
export APPEAL_DIR=/path/to/custom/dir
```

默认工作目录：`~/.rider-appeal/`

## 业务闭环验证

使用 `appeal report <id>` 生成报告，报告包含：

1. **申诉基本信息** - 申诉 ID、订单号、骑手、类型、状态
2. **订单信息** - 订单状态、时间节点
3. **处罚信息** - 处罚类型、金额、原因
4. **审核结果** - 通过/驳回、判定理由、退回金额
5. **人工修正记录** - 修正前后对比、操作员、原因
6. **完整历史记录** - 状态流转全过程

无需查看源码，仅通过报告即可判断：
- 申诉基于哪些证据？
- 审核通过/驳回的理由是什么？
- 处罚金额是否退回？
- 是否有人工干预？
- 整个过程是否有完整记录？

## License

MIT
