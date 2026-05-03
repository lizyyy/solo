# linen-audit-cli - 连锁酒店布草洗涤流转夜审复核CLI工具

一个用于连锁酒店布草洗涤流转夜审复核的 TypeScript CLI 工具，能够读取客房退房记录、RFID 扫描数据、送洗批次和供应商洗涤规则，自动检测布草流转中的各种问题。

## 功能特性

- ✅ **数据读取**: 支持读取 CSV、JSONL、YAML 格式的数据文件
- 🔍 **智能检测**: 自动识别布草流转中的各类问题
- 📋 **三命令模式**:
  - `validate`: 快速验证，检查严重问题
  - `review`: 完整复核，生成详细报告
  - `export`: 导出结果到 CSV 和 Markdown 文件

## 检测的问题类型

| 问题类型 | 严重程度 | 说明 |
|----------|----------|------|
| DUPLICATE_TAG_IN_BATCH | ❌ ERROR | 同一标签在批次中重复入袋 |
| CROSS_STORE_MIX | ❌ ERROR | 不同门店的布草混装在同一批次 |
| OVERDUE_RETURN | ❌ ERROR | 送洗批次超时未返回 |
| SOIL_LEVEL_RULE_MISMATCH | ⚠️ WARNING | 脏污等级与供应商洗涤规则不匹配 |
| MISSING_RFID_SCAN | ⚠️ WARNING | 客房退房后布草缺少 RFID 扫描 |
| BATCH_NOT_SENT | ⚠️ WARNING | 批次已创建但未送洗 |
| UNKNOWN_SOIL_LEVEL | ⚠️ WARNING | 脏污等级未知 |
| CROSS_MIDNIGHT_CHECKOUT | ℹ️ INFO | 跨午夜退房（凌晨 0:00-6:00）|

## 安装

```bash
# 克隆项目
git clone <repository-url>
cd linen-audit-cli

# 安装依赖
npm install

# 编译 TypeScript
npm run build

# 全局链接（可选）
npm link
```

## 数据文件格式

工具需要以下四个数据文件，默认放在 `./data` 目录下：

### 1. rooms.csv - 客房退房记录

```csv
room_number,checkout_time,store_id,store_name
101,2026-05-03T23:30:00,ST001,建国门店
102,2026-05-03T23:45:00,ST001,建国门店
103,2026-05-04T00:15:00,ST001,建国门店
```

**字段说明**:
- `room_number`: 客房号
- `checkout_time`: 退房时间（ISO 8601 格式）
- `store_id`: 门店 ID
- `store_name`: 门店名称

### 2. linen_tags.jsonl - RFID 标签扫描记录

每行为一个 JSON 对象：

```json
{"tag_id": "LT001", "type": "床单", "store_id": "ST001", "last_scan": "2026-05-03T23:35:00", "scan_location": "客房101", "soil_level": "中度", "status": "待送洗"}
{"tag_id": "LT002", "type": "枕套", "store_id": "ST001", "last_scan": "2026-05-03T23:35:00", "scan_location": "客房101", "soil_level": "轻度", "status": "待送洗"}
```

**字段说明**:
- `tag_id`: 标签唯一 ID
- `type`: 布草类型（床单、枕套、被套、毛巾、浴巾等）
- `store_id`: 所属门店 ID
- `last_scan`: 最后扫描时间
- `scan_location`: 扫描位置
- `soil_level`: 脏污等级（轻度、中度、重度、特殊、未知）
- `status`: 当前状态

### 3. laundry_batches.yaml - 送洗批次信息

```yaml
batches:
  - batch_id: BATCH001
    store_id: ST001
    created_at: 2026-05-03T23:50:00
    sent_at: 2026-05-04T00:30:00
    vendor_id: V001
    status: 已送洗
    expected_return: 2026-05-04T18:00:00
    returned_at: null
    tags:
      - tag_id: LT001
        scan_time: 2026-05-03T23:50:00
      - tag_id: LT002
        scan_time: 2026-05-03T23:50:00
```

**字段说明**:
- `batch_id`: 批次 ID
- `store_id`: 门店 ID
- `created_at`: 批次创建时间
- `sent_at`: 送洗时间（null 表示未送洗）
- `vendor_id`: 供应商 ID
- `status`: 批次状态（已创建、已送洗、已返回）
- `expected_return`: 预计返回时间
- `returned_at`: 实际返回时间
- `tags`: 批次包含的标签列表

### 4. vendor_rules.csv - 供应商洗涤规则

```csv
vendor_id,vendor_name,soil_level,linen_type,treatment_type,wash_temperature,dry_temperature,special_instructions
V001,洁净洗涤,轻度,床单,标准洗,40,60,
V001,洁净洗涤,中度,床单,标准洗,50,65,
V001,洁净洗涤,重度,床单,强力洗,60,70,预处理
V001,洁净洗涤,特殊,毛巾,消毒洗,80,80,高温消毒
```

**字段说明**:
- `vendor_id`: 供应商 ID
- `vendor_name`: 供应商名称
- `soil_level`: 脏污等级
- `linen_type`: 布草类型
- `treatment_type`: 处理类型
- `wash_temperature`: 洗涤温度
- `dry_temperature`: 烘干温度
- `special_instructions`: 特殊说明

## 使用方法

### 1. validate - 快速验证

快速检查数据中的严重问题，适合日常快速检查。

```bash
# 使用默认数据目录 ./data
npm start -- validate

# 指定数据目录
npm start -- validate ./my-data

# 显示详细信息
npm start -- validate -v
npm start -- validate --verbose
```

**输出示例**:

```
📂 正在从目录读取数据: /path/to/data
   ✅ 读取到 7 条客房退房记录
   ✅ 读取到 15 条 RFID 标签记录
   ✅ 读取到 6 条送洗批次记录
   ✅ 读取到 21 条供应商洗涤规则

🔍 正在执行夜审复核检查...

发现的问题详情:

❌ 严重问题:
------------------------------------------------------------
❌ [1] 标签 LT001 在批次 BATCH001 中重复入袋
   门店: ST001
   描述: 标签 LT001 在批次 BATCH001 中被扫描 2 次，扫描时间分别为: 2026-05-03T23:50:00, 2026-05-03T23:51:00
   涉及实体: LT001, BATCH001

❌ [2] 批次 BATCH001 存在跨店混包
   门店: ST001
   描述: 批次 BATCH001 属于门店 ST001，但包含来自其他门店的标签: LT007
   涉及实体: BATCH001, LT007

❌ [3] 批次 BATCH005 超时未回
   门店: ST001
   描述: 批次 BATCH005 预计返回时间为 2026-05-02T18:00:00，当前已超时 X 小时
   涉及实体: BATCH005

⚠️  警告:
------------------------------------------------------------
⚠️ [1] 客房 101 退房后部分布草缺少 RFID 扫描
   门店: ST001
   描述: 客房 101 于 2026-05-03T23:30:00 退房，以下布草标签缺少退房后的 RFID 扫描...
   涉及实体: 101, ...

============================================================
验证结果摘要
============================================================

  ❌ 错误: 3 个
  ⚠️  警告: 6 个
  ℹ️  信息: 3 个

  状态: ❌ 验证失败，存在 3 个严重问题需要处理

============================================================
```

### 2. review - 完整复核

进行完整的夜审复核，生成详细的汇总报告。

```bash
# 基本复核
npm start -- review

# 显示详细汇总
npm start -- review -d
npm start -- review --detailed

# 显示所有问题详情
npm start -- review -v
npm start -- review --verbose

# 组合使用
npm start -- review -d -v
```

**输出示例**:

```
================================================================================
📋 夜审复核报告
================================================================================

📈 总体概况:
------------------------------------------------------------
  🛏️  今日退房客房数: 7
  🏷️  涉及布草标签数: 15
  📦  送洗批次数量: 6
  🌙  跨午夜退房数量: 3

⚠️  问题汇总:
------------------------------------------------------------
  ❌ 严重问题: 3 个
  ⚠️  警告: 6 个
  ℹ️  信息提示: 3 个
  🔄  重复入袋标签: 1 个
  🏪  跨店混包批次: 1 个
  ⏰  超时未回批次: 1 个

📊 门店汇总:
------------------------------------------------------------------------------------------
  门店ID    名称      客房   标签   批次   错误   警告   
------------------------------------------------------------------------------------------
  ST001     建国门店  4      10     4      3      4      ❌
  ST002     三里屯店  2      3      1      0      1      ⚠️
  ST003     国贸店    1      2      1      0      1      ⚠️

📋 问题类型统计:
------------------------------------------------------------
  ❌ DUPLICATE_TAG_IN_BATCH          1     个
  ❌ CROSS_STORE_MIX                  1     个
  ❌ OVERDUE_RETURN                   1     个
  ⚠️ MISSING_RFID_SCAN                3     个
  ⚠️ BATCH_NOT_SENT                   1     个
  ⚠️ UNKNOWN_SOIL_LEVEL               1     个
  ⚠️ SOIL_LEVEL_RULE_MISMATCH         1     个
  ℹ️ CROSS_MIDNIGHT_CHECKOUT          3     个

📦 送洗批次流转状态:
------------------------------------------------------------------------------------------
  批次ID       门店    状态      标签数   送洗时间              预计返回
------------------------------------------------------------------------------------------
  BATCH001     ST001   🚚 已送洗  5      2026-05-04T00:30:00  2026-05-04T18:00:00
  BATCH002     ST002   🚚 已送洗  2      2026-05-03T23:00:00  2026-05-04T12:00:00
  BATCH003     ST001   🚚 已送洗  3      2026-05-04T01:00:00  2026-05-04T20:00:00
  BATCH004     ST003   🚚 已送洗  1      2026-05-04T01:30:00  2026-05-04T22:00:00
  BATCH005     ST001   🚚 已送洗  2      2026-05-02T09:00:00  2026-05-02T18:00:00
  BATCH006     ST001   ⏳ 已创建  2      -                      -

🌙 跨午夜退房提醒:
------------------------------------------------------------
  以下客房退房时间在凌晨 0:00-6:00 之间，请确认是否为实际退房时间:

  🏨 建国门店 (ST001) - 客房 103
     退房时间: 2026-05-04T00:15:00 (0:15)

  🏨 建国门店 (ST001) - 客房 104
     退房时间: 2026-05-04T01:00:00 (1:0)

  🏨 国贸店 (ST003) - 客房 301
     退房时间: 2026-05-04T00:30:00 (0:30)

================================================================================
❌ 复核状态: 未通过 (存在 3 个严重问题)
================================================================================
```

### 3. export - 导出结果

将复核结果导出到 `issues.csv` 和 `linen_review.md` 文件。

```bash
# 导出到数据目录
npm start -- export

# 指定输出目录
npm start -- export -o ./output
npm start -- export --output ./output

# 同时指定数据目录和输出目录
npm start -- export ./my-data -o ./my-output
```

**输出示例**:

```
📂 正在从目录读取数据: /path/to/data
   ✅ 读取到 7 条客房退房记录
   ✅ 读取到 15 条 RFID 标签记录
   ✅ 读取到 6 条送洗批次记录
   ✅ 读取到 21 条供应商洗涤规则

📝 正在生成 issues.csv...
   ✅ 已保存到: /path/to/data/issues.csv
      共 12 条记录

📄 正在生成 linen_review.md...
   ✅ 已保存到: /path/to/data/linen_review.md

============================================================
导出完成!
============================================================

  📋 issues.csv: /path/to/data/issues.csv
  📄 linen_review.md: /path/to/data/linen_review.md

  ⚠️  注意: 存在 3 个严重问题需要处理

============================================================
```

## 生成的文件说明

### issues.csv

包含所有检测到的问题，格式如下：

| ID | 类型 | 严重程度 | 标题 | 描述 | 涉及实体 | 门店ID | 时间戳 | 详情 |
|----|------|----------|------|------|----------|--------|--------|------|
| ISSUE_xxx | DUPLICATE_TAG_IN_BATCH | ERROR | 标签 LT001 在批次 BATCH001 中重复入袋 | ... | LT001; BATCH001 | ST001 | 2026-05-04T... | {"batchId":...} |

### linen_review.md

完整的复核报告，包含：
1. 总体概况
2. 问题汇总
3. 问题类型分布
4. 严重问题详情
5. 警告详情
6. 信息提示
7. 送洗批次清单
8. 复核结论

## 示例数据

项目包含完整的示例数据，位于 `./data` 目录：

- `rooms.csv`: 7 条客房退房记录（包含跨午夜退房）
- `linen_tags.jsonl`: 15 条 RFID 标签记录（包含各种问题场景）
- `laundry_batches.yaml`: 6 条送洗批次记录（包含重复入袋、跨店混包、超时未回）
- `vendor_rules.csv`: 21 条供应商洗涤规则

这些示例数据精心设计，包含了各种问题场景，方便测试和演示。

## 项目结构

```
linen-audit-cli/
├── src/
│   ├── index.ts              # 主入口文件
│   ├── types.ts              # TypeScript 类型定义
│   ├── readers.ts            # 数据读取模块
│   ├── analyzer.ts           # 业务逻辑核心
│   └── commands/
│       ├── validate.ts       # validate 命令实现
│       ├── review.ts         # review 命令实现
│       └── export.ts         # export 命令实现
├── data/                      # 示例数据目录
│   ├── rooms.csv
│   ├── linen_tags.jsonl
│   ├── laundry_batches.yaml
│   └── vendor_rules.csv
├── package.json
├── tsconfig.json
└── README.md
```

## 依赖库

- [commander](https://github.com/tj/commander.js): CLI 命令行解析
- [csv-parse](https://csv.js.org/parse/): CSV 文件解析
- [csv-stringify](https://csv.js.org/stringify/): CSV 字符串生成
- [js-yaml](https://github.com/nodeca/js-yaml): YAML 文件解析
- [luxon](https://moment.github.io/luxon/): 日期时间处理
- [fs-extra](https://github.com/jprichardson/node-fs-extra): 文件系统操作增强

## License

MIT
