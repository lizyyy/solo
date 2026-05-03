# 离线重连影子审计台 (MQTT Shadow Replay Auditor)

园区物联网运维专用的本地 MQTT 设备影子回放器，用于解决设备离线重连后旧 retained 消息覆盖新配置、QoS 重投导致重复执行等问题。

## 功能特性

- **import** - 导入并校验 MQTT 消息日志 (JSONL)、设备期望配置 (YAML) 和告警规则
- **replay** - 按时间轴模拟 MQTT 订阅/发布/retain/QoS 协议行为
- **check** - 自动检测并标出版本倒退、重复命令、过期影子、离线期间告警漏发等违规
- **review** - 保存人工裁决记录
- **report** - 导出审计报告为 Markdown、CSV、JSON 格式

## 项目结构

```
mqtt-shadow-replay-auditor/
├── src/
│   ├── cli/                 # CLI 入口
│   │   └── index.ts
│   ├── types/               # 类型定义
│   │   └── index.ts
│   ├── parser/              # 解析模块
│   │   ├── index.ts
│   │   ├── mqtt-log-parser.ts    # MQTT 日志解析
│   │   └── yaml-config-parser.ts # YAML 配置解析
│   ├── model/               # MQTT 模型
│   │   ├── index.ts
│   │   ├── device-shadow.ts     # 设备影子管理
│   │   └── session-manager.ts   # 会话管理
│   ├── replay/              # 回放引擎
│   │   ├── index.ts
│   │   ├── timeline.ts          # 时间轴管理
│   │   └── replay-engine.ts     # 核心回放引擎
│   ├── rules/               # 规则引擎
│   │   ├── index.ts
│   │   ├── version-regression-rule.ts  # 版本倒退检测
│   │   ├── duplicate-command-rule.ts   # 重复命令检测
│   │   ├── expired-shadow-rule.ts      # 过期影子检测
│   │   ├── missed-alert-rule.ts        # 告警漏发检测
│   │   └── rule-engine.ts               # 统一规则引擎
│   ├── storage/             # 存储模块
│   │   ├── index.ts
│   │   └── review-storage.ts      # 人工裁决存储
│   └── export/              # 导出模块
│       ├── index.ts
│       └── exporter.ts            # 多格式导出
├── examples/                # 示例数据
│   ├── mqtt-messages.jsonl  # MQTT 消息日志示例
│   ├── device-config.yaml   # 设备配置示例
│   └── alert-rules.yaml     # 告警规则示例
├── tests/                   # 测试用例
│   ├── parser.test.ts
│   ├── replay.test.ts
│   └── rules.test.ts
├── package.json
├── tsconfig.json
├── jest.config.js
└── README.md
```

## 安装

```bash
# 安装依赖
npm install

# 编译 TypeScript
npm run build
```

## 快速开始

### 1. 导入并校验数据

```bash
# 使用示例数据
npm start -- import \
  --log examples/mqtt-messages.jsonl \
  --devices examples/device-config.yaml \
  --rules examples/alert-rules.yaml
```

### 2. 回放 MQTT 消息

```bash
npm start -- replay \
  --log examples/mqtt-messages.jsonl \
  --devices examples/device-config.yaml \
  --rules examples/alert-rules.yaml
```

### 3. 检测违规

```bash
npm start -- check \
  --log examples/mqtt-messages.jsonl \
  --devices examples/device-config.yaml \
  --rules examples/alert-rules.yaml \
  --expired-hours 24 \
  --duplicate-window 5000
```

### 4. 保存人工裁决

```bash
npm start -- review \
  --violation-id "violation-uuid" \
  --decision "accept" \
  --reason "确认是版本倒退问题" \
  --reviewer "运维工程师A"
```

### 5. 导出审计报告

```bash
# Markdown 格式
npm start -- report \
  --log examples/mqtt-messages.jsonl \
  --devices examples/device-config.yaml \
  --rules examples/alert-rules.yaml \
  --format markdown \
  --output report.md

# JSON 格式
npm start -- report \
  --log examples/mqtt-messages.jsonl \
  --devices examples/device-config.yaml \
  --rules examples/alert-rules.yaml \
  --format json \
  --output report.json

# CSV 格式
npm start -- report \
  --log examples/mqtt-messages.jsonl \
  --devices examples/device-config.yaml \
  --rules examples/alert-rules.yaml \
  --format csv \
  --output report.csv
```

### 6. 列出已保存的报告

```bash
npm start -- list-reports
```

## CLI 命令详解

### import 命令

导入并校验 MQTT 消息日志和配置文件。

**选项：**
- `--log <path>` - MQTT 消息日志文件路径 (JSONL 格式)
- `--devices <path>` - 设备配置文件路径 (YAML 格式)
- `--rules <path>` - 告警规则文件路径 (YAML 格式)

**验证内容：**
- 消息格式有效性
- 必填字段检查
- 时间戳合法性
- QoS 级别 (0/1/2)
- 设备配置完整性
- 告警规则有效性

### replay 命令

按时间轴模拟 MQTT 协议行为。

**选项：**
- `--log <path>` - MQTT 消息日志文件路径
- `--devices <path>` - 设备配置文件路径
- `--rules <path>` - 告警规则文件路径
- `--speed <number>` - 回放速度倍数 (默认: 1)
- `--start <timestamp>` - 开始时间戳
- `--end <timestamp>` - 结束时间戳

**模拟内容：**
- 订阅/取消订阅管理
- 消息发布与投递
- Retain 消息存储与投递
- QoS 级别处理 (0/1/2)
- 设备影子更新
- 会话状态管理

### check 命令

检测违规行为。

**选项：**
- `--log <path>` - MQTT 消息日志文件路径
- `--devices <path>` - 设备配置文件路径
- `--rules <path>` - 告警规则文件路径
- `--expired-hours <number>` - 影子过期阈值 (小时，默认: 24)
- `--duplicate-window <number>` - 重复检测窗口 (毫秒，默认: 5000)

**检测规则：**

1. **版本倒退 (version_regression)**
   - 检测设备影子版本号是否倒退
   - 严重级别: critical
   - 场景: 旧 retained 消息覆盖新配置

2. **重复命令 (duplicate_command)**
   - 检测 QoS 重投导致的重复消息
   - 严重级别: warning/info
   - 场景: QoS 1/2 重传导致重复执行

3. **过期影子 (expired_shadow)**
   - 检测长时间未更新的设备影子
   - 严重级别: critical/warning
   - 场景: 设备重连时旧影子覆盖新配置

4. **Retain 覆盖 (retain_override)**
   - 检测旧 retained 消息覆盖新消息
   - 严重级别: critical
   - 场景: 时间戳错误导致消息时序混乱

5. **告警漏发 (missed_alert)**
   - 检测离线期间的告警
   - 严重级别: critical/warning
   - 场景: 设备离线期间发送的告警

### review 命令

保存人工裁决记录。

**选项：**
- `--violation-id <id>` - 违规 ID (必填)
- `--decision <type>` - 裁决类型 (必填)
  - `accept` - 接受违规
  - `reject` - 拒绝违规 (误报)
  - `need_more_info` - 需要更多信息
- `--reason <text>` - 裁决原因 (必填)
- `--reviewer <name>` - 裁决人名称 (默认: system)
- `--data-dir <path>` - 数据存储目录 (默认: data)

### report 命令

导出审计报告。

**选项：**
- `--log <path>` - MQTT 消息日志文件路径
- `--devices <path>` - 设备配置文件路径
- `--rules <path>` - 告警规则文件路径
- `--format <type>` - 导出格式 (默认: markdown)
  - `markdown` - Markdown 格式
  - `csv` - CSV 格式
  - `json` - JSON 格式
- `--output <path>` - 输出文件路径
- `--no-details` - 不包含详细信息
- `--data-dir <path>` - 数据存储目录

**报告内容：**
- 报告元数据 (ID、生成时间、审计周期)
- 汇总统计 (消息数、设备数、违规数)
- 违规详情 (按严重级别分类)
- 人工裁决记录
- 设备状态列表
- Retain 消息列表

## 数据格式

### MQTT 消息日志 (JSONL)

每行一条 JSON 消息：

```json
{
  "id": "msg-001",
  "timestamp": 1746316800000,
  "topic": "gateway/device-001/telemetry",
  "payload": "{\"temperature\":25.5}",
  "qos": 1,
  "retain": false,
  "dup": false,
  "direction": "in",
  "clientId": "device-001"
}
```

**字段说明：**
- `id` - 消息唯一标识
- `timestamp` - 时间戳 (毫秒)
- `topic` - MQTT 主题
- `payload` - 消息载荷
- `qos` - 服务质量 (0/1/2)
- `retain` - 是否为 retained 消息
- `dup` - 是否为重传消息
- `direction` - 消息方向 (in/out)
- `clientId` - 客户端 ID

**支持的主题格式：**
- AWS IoT 影子格式: `$aws/things/{deviceId}/shadow/{operation}`
- 自定义影子格式: `shadow/{deviceId}/{operation}`
- 普通主题: `{any/topic}`

### 设备配置 (YAML)

```yaml
devices:
  - deviceId: device-001
    name: 温度传感器-A区
    type: temperature-sensor
    shadowVersion: 3
    desiredConfig:
      setpoint: 24
      interval: 60
    lastSeen: 1746317340000
    status: online
```

**字段说明：**
- `deviceId` - 设备唯一标识
- `name` - 设备名称
- `type` - 设备类型
- `shadowVersion` - 期望的影子版本
- `desiredConfig` - 期望配置
- `lastSeen` - 最后见时间戳
- `status` - 设备状态 (online/offline/unknown)

### 告警规则 (YAML)

```yaml
rules:
  - id: rule-001
    name: 温度过高告警
    description: 当温度超过阈值时触发告警
    condition:
      type: threshold
      parameters:
        field: temperature
        operator: gt
        value: 35
    severity: critical
    enabled: true
    topicPattern: gateway/+/telemetry
```

**条件类型：**
- `threshold` - 阈值条件
- `state_change` - 状态变化条件
- `timeout` - 超时条件
- `custom` - 自定义条件

**严重级别：**
- `critical` - 严重
- `warning` - 警告
- `info` - 信息

## 运行测试

```bash
# 运行所有测试
npm test

# 运行测试并生成覆盖率报告
npm run test:coverage
```

## 验证流程

### 完整验证流程示例

1. **准备数据**
   ```bash
   # 确保示例数据存在
   ls examples/
   ```

2. **导入数据**
   ```bash
   npm start -- import \
     --log examples/mqtt-messages.jsonl \
     --devices examples/device-config.yaml \
     --rules examples/alert-rules.yaml
   ```

3. **回放消息**
   ```bash
   npm start -- replay \
     --log examples/mqtt-messages.jsonl \
     --devices examples/device-config.yaml \
     --rules examples/alert-rules.yaml
   ```

4. **检测违规**
   ```bash
   npm start -- check \
     --log examples/mqtt-messages.jsonl \
     --devices examples/device-config.yaml \
     --rules examples/alert-rules.yaml
   ```

   **预期输出：**
   - 检测到 device-001 的版本倒退 (版本 3 → 2)
   - 检测到 device-004 的版本倒退 (版本 10 → 8)
   - 检测到重复命令 (DUP 标志的消息)

5. **生成报告**
   ```bash
   npm start -- report \
     --log examples/mqtt-messages.jsonl \
     --devices examples/device-config.yaml \
     --rules examples/alert-rules.yaml \
     --format markdown \
     --output audit-report.md
   ```

6. **查看报告**
   ```bash
   cat audit-report.md
   ```

### 示例数据中的违规场景

示例数据 `examples/mqtt-messages.jsonl` 包含以下违规场景：

1. **版本倒退 - device-001**
   - msg-002: 影子更新，版本 3
   - msg-006: 影子更新，版本 2 (倒退)

2. **版本倒退 - device-004**
   - msg-011: 影子更新，版本 10
   - msg-012: 影子更新，版本 8 (倒退)

3. **重复命令 - server-001**
   - msg-007: 命令发送，DUP=false
   - msg-008: 命令发送，DUP=true (重传)

## 依赖

- **Node.js** >= 16.x
- **TypeScript** >= 5.x
- **Jest** - 测试框架
- **commander** - CLI 框架
- **js-yaml** - YAML 解析
- **fast-csv** - CSV 导出
- **uuid** - 唯一 ID 生成
- **chalk** - 终端颜色输出

## License

MIT

## 贡献

欢迎提交 Issue 和 Pull Request。

## 更新日志

### v1.0.0
- 初始版本发布
- 实现核心功能：import, replay, check, review, report
- 支持多种数据格式导入导出
- 完整的测试覆盖
