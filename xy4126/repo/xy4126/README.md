# 异常包裹证据包归档员

快递驿站站长专用的本地自动化工具，用于管理异常包裹的照片、备注和赔付申请材料。

## 功能特性

- **文件扫描与归集**: 自动扫描目录，按运单号归集照片和文件
- **智能校验**: 检测缺照片、备注冲突、重复运单、时间倒序、赔付金额异常等问题
- **复核管理**: 保存人工处理意见，支持状态变更
- **报告导出**: 生成Markdown申诉包、CSV问题清单和JSON审计记录

## 安装

```bash
cd /path/to/xy4126
pip install -r requirements.txt
```

### 依赖说明

| 依赖库 | 用途 |
|--------|------|
| click | 命令行界面 |
| Pillow | 图片EXIF元数据解析 |
| python-dateutil | 日期时间处理 |
| pytest | 测试框架 |

## 项目结构

```
xy4126/
├── cli.py                 # 命令行主入口
├── config.py              # 配置文件
├── requirements.txt       # 依赖列表
├── README.md             # 本文档
├── models/               # 数据模型
│   ├── __init__.py
│   └── models.py         # 核心数据类定义
├── indexers/             # 文件索引模块
│   ├── __init__.py
│   └── file_indexer.py   # 目录扫描、运单号提取、文件分类
├── parsers/              # 数据解析模块
│   ├── __init__.py
│   ├── csv_parser.py     # CSV文件解析（客服备注、赔付申请）
│   └── metadata_parser.py # 图片元数据解析
├── validators/           # 规则引擎
│   ├── __init__.py
│   └── validators.py     # 7条校验规则实现
├── storage/              # 状态存储
│   ├── __init__.py
│   └── session_store.py  # 工作会话持久化
├── reports/              # 报告导出
│   ├── __init__.py
│   └── exporter.py       # Markdown/CSV/JSON导出
├── tests/                # 测试文件
│   ├── __init__.py
│   ├── test_waybill_extractor.py
│   └── test_validators.py
└── sample_data/          # 示例数据
    ├── service_notes.csv
    └── claim_applications.csv
```

## 快速开始

### 1. 创建临时测试目录

```bash
mkdir -p /tmp/test_packages/{photos,csv}
cd /tmp/test_packages
```

### 2. 准备测试文件

创建一些模拟的图片文件（文件名包含运单号）：

```bash
# 创建空文件模拟照片
touch photos/SF1234567890123_面单.jpg
touch photos/SF1234567890123_破损.jpg
touch photos/YT9876543210987_包裹.png
touch photos/ZT1122334455667_面单.jpg
```

复制示例CSV文件：

```bash
cp /path/to/xy4126/sample_data/*.csv /tmp/test_packages/csv/
```

### 3. 扫描目录

```bash
cd /path/to/xy4126
python cli.py scan /tmp/test_packages/photos --session-name "测试会话"
```

### 4. 运行校验

```bash
python cli.py check \
  --csv-file /tmp/test_packages/csv/service_notes.csv \
  --claim-file /tmp/test_packages/csv/claim_applications.csv
```

### 5. 添加复核意见

```bash
# 查看所有问题
python cli.py review --list

# 对问题添加处理意见
python cli.py review <问题ID> \
  --content "已核实，材料齐全" \
  --author "张站长" \
  --status resolved
```

### 6. 导出报告

```bash
# 导出所有报告
python cli.py export --all

# 或单独导出
python cli.py export --summary    # 仅导出汇总
python cli.py export --issues     # 仅导出问题清单
python cli.py export --claims     # 仅导出申诉包
```

## 命令详解

### scan - 扫描目录

```bash
python cli.py scan <目录路径> [选项]
```

| 选项 | 说明 |
|------|------|
| `--session-name, -n` | 会话名称 |
| `--recursive/--no-recursive, -r/-R` | 是否递归扫描子目录（默认是） |
| `--exclude, -e` | 排除的目录或文件模式（可多次使用） |

**运单号识别规则**：

工具会自动从文件名中提取运单号，支持以下格式：

- 顺丰: `SF1234567890123`, `SF_1234567890123`
- 圆通: `YT9876543210`, `圆通_9876543210987`
- 中通: `ZT1122334455667`
- 京东: `JD2233445566778`
- 申通: `77XXXXXXXXXXXXX`, `46XXXXXXXXXXXXX`
- 韵达: `39XXXXXXXXXXXXX`, `16XXXXXXXXXXXXX`
- 邮政/EMS: `95XXXXXXXXXXXXX`, `96XXXXXXXXXXXXX`
- 含关键词: `运单号_1234567890`, `快递单号_1234567890`

**文件分类规则**：

根据文件名关键词自动分类：

| 关键词 | 分类 |
|--------|------|
| 面单、运单、waybill | 面单照片 |
| 包裹、包装、外箱、package | 包裹照片 |
| 破损、损坏、问题件、damage | 破损照片 |
| 备注、客服、note | 客服备注CSV |
| 赔付、理赔、索赔、claim | 赔付申请表 |

### check - 运行校验

```bash
python cli.py check [选项]
```

| 选项 | 说明 |
|------|------|
| `--session-id, -s` | 指定会话ID（默认使用最新会话） |
| `--csv-file, -c` | 客服备注CSV文件（可多次使用） |
| `--claim-file, -f` | 赔付申请表CSV文件（可多次使用） |

**校验规则**：

| 规则 | 严重程度 | 说明 |
|------|----------|------|
| **重复运单校验** | CRITICAL/WARNING | 同一运单多次赔付申请且金额不一致 → 严重；金额一致 → 警告 |
| **照片缺失校验** | CRITICAL/WARNING/INFO | 有赔付申请但缺面单/破损照片 → 严重；照片数量不足 → 警告；无照片 → 提示 |
| **时间戳缺失校验** | CRITICAL/WARNING | 所有照片无时间戳 → 严重；部分缺失 → 警告 |
| **时间倒序校验** | CRITICAL/WARNING | 照片时间倒序（可能伪造）→ 严重；赔付时间早于照片 → 警告 |
| **备注冲突校验** | CRITICAL | 同一运单备注矛盾（如"破损"vs"完好"）→ 严重 |
| **赔付金额异常** | CRITICAL/WARNING/INFO | 金额过高（>¥10000）→ 严重；金额较高（>¥2000）或过低（<¥1）→ 警告；申请与核定不一致 → 提示 |
| **赔付材料缺失** | CRITICAL/WARNING | 有赔付申请但缺证据材料 → 严重；缺客服备注 → 警告 |

**冲突关键词检测**：

```
破损 ↔ 完好
损坏 ↔ 正常
湿 ↔ 干
泡水 ↔ 干燥
丢失 ↔ 送达
少件 ↔ 完整
拒签 ↔ 签收
退回 ↔ 妥投
延误 ↔ 准时
超时 ↔ 正常
```

### review - 复核管理

```bash
python cli.py review [问题ID] [选项]
```

| 选项 | 说明 |
|------|------|
| `--session-id, -s` | 指定会话ID |
| `--waybill, -w` | 按运单号添加备注 |
| `--content, -c` | 备注内容 |
| `--author, -a` | 作者名称（默认"站长"） |
| `--status, -t` | 状态变更: pending/reviewed/resolved/dismissed |
| `--list, -l` | 列出所有问题 |

**状态说明**：

| 状态 | 说明 |
|------|------|
| `pending` | 待处理（默认） |
| `reviewed` | 已复核 |
| `resolved` | 已解决 |
| `dismissed` | 已忽略 |

### export - 导出报告

```bash
python cli.py export [选项]
```

| 选项 | 说明 |
|------|------|
| `--session-id, -s` | 指定会话ID |
| `--output-dir, -o` | 输出目录（默认 ./exports） |
| `--all/--no-all, -a/-A` | 导出所有报告（默认） |
| `--summary, -m` | 仅导出会话汇总 |
| `--issues, -i` | 仅导出问题清单CSV |
| `--packages, -p` | 仅导出包裹清单CSV |
| `--audit, -d` | 仅导出审计记录JSON |
| `--claims, -c` | 仅导出申诉包（仅赔付申请的包裹） |
| `--waybill, -w` | 指定运单号导出单个申诉包 |

**导出格式**：

1. **Markdown申诉包** (`申诉包_<运单号>.md`)
   - 基本信息：运单号、照片统计、备注数、赔付申请数
   - 赔付申请信息：金额、原因、申请人、时间
   - 客服备注记录：内容、操作人、时间
   - 证据照片清单：文件名、路径、拍摄时间、大小
   - 校验问题汇总：严重程度、描述、复核状态

2. **CSV问题清单** (`问题清单_<会话ID>.csv`)
   - 问题ID、运单号、问题类型、严重程度、问题描述
   - 影响文件、影响备注、复核状态、问题详情（JSON）

3. **CSV包裹清单** (`包裹清单_<会话ID>.csv`)
   - 运单号、照片总数、面单/包裹/破损照片数
   - 备注数量、赔付申请数、申请金额
   - 问题数、严重问题数、最早/最晚照片时间

4. **JSON审计记录** (`审计记录_<会话ID>.json`)
   - 完整的会话信息、统计摘要
   - 所有包裹详情（含照片、备注、赔付申请）
   - 所有问题详情（含复核记录）

5. **Markdown会话汇总** (`会话汇总_<会话ID>.md`)
   - 统计概览（包裹数、文件数、问题数、严重问题数）
   - 包裹清单表格（含严重问题标识）
   - 问题详情列表

### sessions - 会话管理

```bash
python cli.py sessions [选项]
```

| 选项 | 说明 |
|------|------|
| `--list, -l` | 列出所有会话 |
| `--delete, -d` | 删除指定会话 |
| `--info, -i` | 查看指定会话详情 |

**会话存储位置**：`~/.package_archivist/sessions/`

## CSV文件格式

### 客服备注CSV

```csv
运单号,备注内容,操作人,时间
SF1234567890123,客户反映包裹外包装有破损，建议开箱检查,张站长,2024-05-01 14:30:00
YT9876543210987,收件人不在家，已电话联系约定明天派送,李客服,2024-05-02 09:15:00
```

**支持的列名别名**：

| 必需列 | 别名 |
|--------|------|
| 运单号 | waybill_number, waybill, tracking_number, tracking, 快递单号, 单号, 物流号 |
| 备注内容 | content, remark, note, 内容, 备注, 说明, 客服备注 |
| 操作人（可选） | 客服 |
| 时间（可选） | 日期 |

### 赔付申请表CSV

```csv
运单号,赔付金额,赔付原因,申请人,申请时间,状态,备注
SF1234567890123,500.00,外包装破损导致内件损坏,幸福驿站,2024-05-02 10:00:00,pending,电子产品，价值约800元
YT9876543210987,200.00,延误赔付,阳光驿站,2024-05-03 14:30:00,reviewed,生鲜快递超时
```

**支持的列名别名**：

| 必需列 | 别名 |
|--------|------|
| 运单号 | waybill_number, waybill, tracking_number, tracking, 快递单号, 单号, 物流号 |
| 赔付金额 | amount, 金额, 申请金额, 理赔金额, 索赔金额 |
| 赔付原因（可选） | 原因 |
| 申请人（可选） | 驿站 |
| 申请时间（可选） | 时间 |
| 状态（可选） | - |
| 核定金额（可选） | 审批金额 |
| 预期金额（可选） | - |

**金额格式**：

- 支持: `500`, `500.00`, `¥500`, `￥500`, `500元`, `1,000.00`

## 运行测试

```bash
cd /path/to/xy4126
python -m pytest tests/ -v
```

或运行单个测试文件：

```bash
python -m pytest tests/test_waybill_extractor.py -v
python -m pytest tests/test_validators.py -v
```

## 完整工作流程示例

### 场景：驿站每日异常包裹处理

#### 步骤1：准备工作目录

```bash
# 创建今日工作目录
mkdir -p /workspace/20240501/{photos,csv}

# 照片文件名规范示例：
# SF1234567890123_面单_20240501.jpg
# SF1234567890123_包裹_20240501.jpg
# SF1234567890123_破损_20240501_1.jpg
# SF1234567890123_破损_20240501_2.jpg
# YT9876543210987_面单.jpg
# YT9876543210987_包裹.png
```

#### 步骤2：导出客服系统备注

从快递客服系统导出CSV到 `/workspace/20240501/csv/service_notes.csv`

#### 步骤3：导出赔付申请表

从赔付系统导出CSV到 `/workspace/20240501/csv/claim_applications.csv`

#### 步骤4：扫描并归集

```bash
cd /path/to/xy4126
python cli.py scan /workspace/20240501/photos --session-name "20240501 异常包裹"
```

#### 步骤5：运行校验

```bash
python cli.py check \
  --csv-file /workspace/20240501/csv/service_notes.csv \
  --claim-file /workspace/20240501/csv/claim_applications.csv
```

**示例校验输出**：

```
🔍 运行校验规则...

📋 校验结果:
   总问题数: 5
   🔴 严重问题: 2
   🟡 警告问题: 2
   ℹ️ 提示信息: 1

问题详情:

   [🔴 严重] [SF1234567890123]
   运单 [SF1234567890123] 存在 2 条赔付申请且金额不一致: ¥500, ¥600
   状态: 待处理

   [🔴 严重] [ZT1122334455667]
   运单 [ZT1122334455667] 赔付金额 ¥15000 过高，超过阈值 ¥10000，请重点审核
   状态: 待处理

   [🟡 警告] [JD2233445566778]
   运单 [JD2233445566778] 赔付金额为0元，请确认
   状态: 待处理
```

#### 步骤6：人工复核

```bash
# 查看所有问题
python cli.py review --list

# 处理重复赔付问题
python cli.py review <问题ID> \
  --content "核实发现为两次不同赔付申请，分别对应损坏和延误，金额均合理" \
  --author "李站长" \
  --status resolved

# 处理高额赔付问题
python cli.py review <问题ID> \
  --content "金额确认为贵重物品丢失，已核实材料齐全" \
  --author "李站长" \
  --status reviewed

# 处理零金额问题
python cli.py review <问题ID> \
  --content "该申请为测试数据，已标记忽略" \
  --author "李站长" \
  --status dismissed
```

#### 步骤7：导出报告

```bash
# 导出所有报告到指定目录
python cli.py export --all --output-dir /workspace/20240501/exports/

# 查看导出结果
ls /workspace/20240501/exports/
# 会话汇总_<会话ID>.md
# 包裹清单_<会话ID>.csv
# 问题清单_<会话ID>.csv
# 审计记录_<会话ID>.json
# 申诉包_SF1234567890123.md
# 申诉包_YT9876543210987.md
```

#### 步骤8：归档

将导出的申诉包文件上传到快递公司申诉系统，完成处理。

## 常见问题

### Q1: 文件名中没有运单号怎么办？

工具无法自动识别没有运单号的文件名。建议：

1. 手动重命名文件，添加运单号前缀
2. 或将文件放入以运单号命名的子目录
3. 未识别的文件会在扫描结果中列出

### Q2: 运单号识别错误怎么办？

工具使用正则表达式匹配运单号。如果识别有误：

1. 检查文件名格式是否符合规范
2. 可在文件名中使用"运单号_"前缀强制识别，如：`运单号_SF1234567890123.jpg`

### Q3: 照片时间戳从哪里获取？

工具按以下优先级获取时间：

1. EXIF元数据中的 `DateTimeOriginal`（拍摄时间）
2. EXIF元数据中的 `DateTimeDigitized`
3. 文件创建时间
4. 文件修改时间

**注意**：截图、保存的图片可能丢失EXIF数据，建议保持原始照片文件。

### Q4: 会话数据保存在哪里？

默认位置：`~/.package_archivist/sessions/`

每个会话包含：
- `index.json` - 会话索引
- `<会话ID>.json` - 完整会话数据

## 数据模型说明

### PackageEvidence（包裹证据包）

每个运单号对应一个包裹证据包，包含：

| 字段 | 说明 |
|------|------|
| waybill_number | 运单号 |
| photos | 其他照片 |
| waybill_photos | 面单照片 |
| package_photos | 包裹照片 |
| damage_photos | 破损照片 |
| service_notes | 客服备注 |
| claim_applications | 赔付申请 |
| issues | 关联的问题 |
| review_notes | 复核记录 |

### ValidationIssue（校验问题）

| 字段 | 说明 |
|------|------|
| issue_id | 问题ID |
| issue_type | 问题类型枚举 |
| severity | 严重程度枚举 |
| message | 问题描述 |
| waybill_number | 关联运单号 |
| affected_files | 影响的文件 |
| affected_notes | 影响的备注 |
| review_status | 复核状态 |
| review_notes | 复核记录列表 |
| metadata | 扩展元数据 |

### ReviewNote（复核记录）

| 字段 | 说明 |
|------|------|
| note_id | 记录ID |
| issue_id | 关联问题ID |
| waybill_number | 关联运单号 |
| author | 作者 |
| content | 内容 |
| timestamp | 时间 |
| status_change | 状态变更 |
| metadata | 扩展元数据 |

## 许可证

本工具仅供内部使用。
