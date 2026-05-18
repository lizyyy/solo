# 门禁离线日志补开记录稽核 CLI

自动核对门禁离线补开记录与正常通行记录，快速发现重复记录、缺失记录和特殊类型记录。

## 业务背景

门禁系统在离线状态下的通行记录会在设备重连后补传。手工核对补开记录时，很容易出现：
- 重复补开导致的重复记录
- 设备故障导致的记录缺失
- 特殊场景（离线重连、临时访客、设备换号）无法快速识别

本工具通过自动化稽核解决以上问题。

## 功能特性

- ✅ **记录匹配**：基于时间（5分钟容差）、卡号、设备号自动匹配补开记录与正常通行记录
- ✅ **重复检测**：自动识别补开日志中的重复记录
- ✅ **缺失检测**：自动发现正常日志中有但补开日志中缺失的记录
- ✅ **特殊类型识别**：标记「离线重连」「临时访客」「设备换号」三类特殊记录
- ✅ **多格式输出**：支持 pretty、json、csv 三种输出格式
- ✅ **可追溯**：完整的字段信息输出，便于 diff 对比规则变更影响

## 快速开始

### 安装依赖

```bash
npm install
```

### 运行稽核

```bash
# 使用主样例文件运行稽核
node bin/access-audit.js audit -n samples/normal-pass-log.csv -o samples/offline-makeup-log.csv

# 指定输出格式为 JSON
node bin/access-audit.js audit -n samples/normal-pass-log.csv -o samples/offline-makeup-log.csv -f json

# 保存稽核结果到文件
node bin/access-audit.js audit -n samples/normal-pass-log.csv -o samples/offline-makeup-log.csv -f json -O result.json
```

### 命令选项

| 选项 | 缩写 | 说明 |
|------|------|------|
| `--normal` | `-n` | 正常通行日志文件路径 (CSV) **必填** |
| `--offline` | `-o` | 离线补开日志文件路径 (CSV) **必填** |
| `--format` | `-f` | 输出格式：pretty / json / csv (默认: pretty) |
| `--output` | `-O` | 输出文件路径，不指定则输出到控制台 |

## 文件格式说明

### 正常通行日志 (normal-pass-log.csv)

| 字段名 | 说明 | 示例 |
|--------|------|------|
| 通行时间 | 通行发生的时间 | 2026-05-10 08:30:15 |
| 卡号 | 门禁卡号 | 1001 |
| 姓名 | 持卡人姓名 | 张三 |
| 设备编号 | 门禁设备编号 | DEV001 |
| 设备名称 | 门禁设备名称 | 大门入口 |
| 通行方向 | 进/出 | 进 |
| 通行结果 | 认证结果 | 成功 |

### 离线补开日志 (offline-makeup-log.csv)

| 字段名 | 说明 | 示例 |
|--------|------|------|
| 补开时间 | 补开记录的时间 | 2026-05-10 08:30:15 |
| 员工卡号 | 门禁卡号 | 1001 |
| 员工姓名 | 持卡人姓名 | 张三 |
| 门禁设备 | 门禁设备编号 | DEV001 |
| 设备名称 | 门禁设备名称 | 大门入口 |
| 通行方向 | 进/出 | 进 |
| 认证结果 | 认证结果 | 成功 |
| 离线重连 | 是否离线重连产生 | 是/否 |
| 临时访客 | 是否临时访客 | 是/否 |
| 设备换号 | 是否设备换号产生 | 是/否 |

## 稽核结果说明

### 统计信息字段

```
【门禁离线日志补开记录稽核摘要】
正常日志: X 条, 补开日志: Y 条
匹配成功: Z 条 (W%)
⚠️  重复记录: A 条
⚠️  缺失记录: B 条
📡 离线重连记录: C 条
👥 临时访客记录: D 条
🔄 设备换号记录: E 条
✅ 稽核通过 / ❌ 稽核不通过
```

### 异常记录详情

- **重复记录**：补开日志中完全相同的记录（时间、卡号、设备、方向均一致）
- **缺失记录**：正常日志中存在但补开日志中没有匹配到的记录

## 样例目录结构

```
samples/
├── normal-pass-log.csv          # 主样例：正常通行日志（10条）
├── offline-makeup-log.csv       # 主样例：离线补开日志（9条）
├── scenario-perfect-match/      # 场景1：完美匹配
│   ├── normal-log.csv
│   └── offline-log.csv
├── scenario-with-duplicates/    # 场景2：包含重复记录
│   ├── normal-log.csv
│   └── offline-log.csv
├── scenario-with-missing/       # 场景3：包含缺失记录
│   ├── normal-log.csv
│   └── offline-log.csv
└── scenario-special-types/      # 场景4：特殊类型识别
    ├── normal-log.csv
    └── offline-log.csv

expected-outputs/                # 期望输出文件
├── main-scenario-result.json
└── perfect-match.json
```

## 运行测试

```bash
# 运行所有测试
npm test

# 运行测试并监听文件变化
npm run test:watch

# 查看测试覆盖率
npm run test:coverage
```

## 规则变更与 Diff 对比

当稽核规则发生变更时，可通过以下方式验证影响：

1. 修改 `src/index.js` 中的稽核逻辑
2. 重新运行稽核并保存结果到新文件：
   ```bash
   node bin/access-audit.js audit -n samples/normal-pass-log.csv -o samples/offline-makeup-log.csv -f json -O result-new.json
   ```
3. 对比新旧结果：
   ```bash
   diff expected-outputs/main-scenario-result.json result-new.json
   ```

**可通过 diff 清晰看出变化的字段**：
- `统计信息.离线重连`：离线重连记录数量变化
- `统计信息.临时访客`：临时访客记录数量变化  
- `统计信息.设备换号`：设备换号记录数量变化
- `稽核详情[].特殊类型`：每条记录的特殊类型标记
- `摘要`：对应特殊类型的统计行

## 业务规则说明

### 匹配规则

1. **卡号必须完全一致**
2. **设备编号必须完全一致**
3. **时间容差：5分钟** - 正常通行时间与补开时间相差5分钟内视为匹配

### 重复记录判定

补开日志中，以下字段完全相同的记录视为重复：
- 通行时间（或补开时间）
- 卡号
- 设备编号
- 通行方向

### 特殊类型标记

| 类型 | 判定条件 | 输出位置 |
|------|----------|----------|
| 离线重连 | 补开记录中「离线重连」字段为「是」 | 稽核详情.特殊类型 / 统计信息.离线重连 |
| 临时访客 | 补开记录中「临时访客」字段为「是」 | 稽核详情.特殊类型 / 统计信息.临时访客 |
| 设备换号 | 补开记录中「设备换号」字段为「是」 | 稽核详情.特殊类型 / 统计信息.设备换号 |
