# 电子证据材料脱敏打包工具

法院书记员专用的电子证据材料脱敏打包工具，支持庭前批量处理电子证据，按角色生成原告/被告/法官三个资料包，自动遮盖敏感信息，并输出可复查的脱敏报告。

## 功能特性

- **一致性校验 (validate)**: 检查案件清单与实际文件是否一致
- **角色化打包 (pack)**: 按原告/被告/法官三个角色分别生成脱敏资料包
- **智能脱敏**: 自动识别并遮盖身份证号、手机号、住址、未授权证人姓名
- **报告导出 (export)**: 生成脱敏报告、缺失文件列表、可复查的映射日志
- **多重警告**: 同名当事人、跨文件引用、规则漏配时给出清晰告警

## 安装

```bash
# 克隆仓库后进入项目目录
cd zy8260

# 安装依赖
pip install -e .

# 或使用 pip install
pip install click pyyaml
```

## 快速开始：Demo 命令

运行以下命令即可体验完整流程：

```bash
# 方式一：一键执行完整流程 (推荐)
evidence-redactor all \
  --manifest sample_data/case_manifest.yaml \
  --evidence-dir sample_data/evidence_files \
  --participants sample_data/participants.csv \
  --rules sample_data/redact_rules.yaml \
  --output ./demo_output

# 方式二：分步执行
# 1. 先校验
evidence-redactor validate \
  --manifest sample_data/case_manifest.yaml \
  --evidence-dir sample_data/evidence_files \
  --participants sample_data/participants.csv

# 2. 再打包
evidence-redactor pack \
  --manifest sample_data/case_manifest.yaml \
  --evidence-dir sample_data/evidence_files \
  --participants sample_data/participants.csv \
  --rules sample_data/redact_rules.yaml \
  --output ./demo_output

# 3. 最后导出报告
evidence-redactor export \
  --manifest sample_data/case_manifest.yaml \
  --evidence-dir sample_data/evidence_files \
  --participants sample_data/participants.csv \
  --output ./demo_output
```

## 输入文件说明

### 1. 案件清单 (case_manifest.yaml)

定义案件基本信息和证据文件清单：

```yaml
case:
  case_id: "(2026)京民初字第00123号"
  case_name: "张三诉李四买卖合同纠纷案"
  court: "北京市朝阳区人民法院"

evidence:
  - id: EV-001
    filename: "起诉状.txt"
    category: "诉讼文书"
    visibility: "all"           # 可见性: all / plaintiff / defendant / judge_only
    description: "原告起诉状"
```

**visibility 字段说明**:
- `all`: 所有角色可见
- `plaintiff`: 仅原告可见
- `defendant`: 仅被告可见
- `judge_only`: 仅法官可见 (如未授权证人证言)

### 2. 参与人员 (participants.csv)

包含所有当事人、律师、证人信息：

| 列名 | 说明 | 示例 |
|------|------|------|
| id | 唯一编号 | P-001 |
| 姓名 | 当事人姓名 | 张三 |
| 角色 | 原告/被告/法官/证人/律师 | 原告 |
| 身份证号 | 身份证号 | 110101198506152345 |
| 手机号 | 联系电话 | 13800138001 |
| 地址 | 住址 | 北京市朝阳区建国路88号 |
| 授权 | 是否授权公开（证人） | 是/否 |
| 交叉引用 | 相关当事人ID（同名区分用） | P-001 |

**特殊场景**:
- **同名当事人**: 两个"张三"会被标记为警告，需确认是否同一人
- **未授权证人**: 授权字段为"否"的证人，其姓名将在原告/被告包中脱敏
- **跨文件引用**: 交叉引用字段用于关联同名但不同ID的记录

### 3. 脱敏规则 (redact_rules.yaml)

定义敏感信息识别和替换规则：

```yaml
rules:
  - id: R-001
    type: id_card
    pattern: "\\b(\\d{6})\\d{8}(\\d{4})\\b"
    replacement: "\\1********\\2"  # 保留前6后4
    description: "身份证号脱敏"
    enabled: true
    priority: 10
```

**内置规则类型**:
- 身份证号: 18位/15位身份证自动识别
- 手机号: 11位手机号，保留前3后4
- 住址: 省市县 + 路/街/号 等关键词
- 银行卡号: 16-19位卡号
- 证人姓名: 未授权证人自动脱敏
- 当事人姓名: 对方当事人姓名自动脱敏

### 4. 证据文件 (evidence_files/)

支持的文件格式:
- `.txt`: 纯文本文件
- `.csv`: 逗号分隔值文件
- `.json`: JSON 格式文件

## 输出文件说明

运行后在输出目录生成以下文件：

### 资料包 ZIP

```
demo_output/
├── plaintiff_package_20260504.zip    # 原告资料包
├── defendant_package_20260504.zip    # 被告资料包
└── judge_package_20260504.zip        # 法官资料包 (完整无脱敏)
```

每个 ZIP 包含:
- 按可见性规则筛选的证据文件
- 脱敏处理后的敏感信息
- MANIFEST.txt (文件清单和脱敏统计)

### 报告和日志

| 文件名 | 说明 |
|--------|------|
| `redaction_report.html` | 脱敏报告（HTML格式，可浏览器打开） |
| `summary.txt` | 处理摘要（文本格式） |
| `missing_files.csv` | 缺失/额外文件列表 |
| `audit_log.json` | 审计日志（完整记录） |
| `redaction_mapping.json` | 脱敏映射日志（可复查） |

### 脱敏映射日志格式

```json
{
  "generated_at": "2026-05-04T10:30:00",
  "packages": {
    "plaintiff": {
      "count": 15,
      "mappings": [
        {
          "original": "110101198506152345",
          "redacted": "110101********2345",
          "rule_id": "R-001",
          "file_path": "sample_data/evidence_files/起诉状.txt",
          "line_number": 5,
          "char_offset": 12
        }
      ]
    }
  }
}
```

## 脱敏规则详解

### 1. 身份证号脱敏

**规则**: `(\d{6})\d{8}(\d{4})` → `\1********\2`

**效果**:
- 原始: `110101198506152345`
- 脱敏后: `110101********2345`

### 2. 手机号脱敏

**规则**: `(\d{3})\d{4}(\d{4})` → `\1****\2`

**效果**:
- 原始: `13800138001`
- 脱敏后: `138****8001`

### 3. 住址脱敏

**规则**: 识别省市县 + 路/街/号等关键词

**效果**:
- 原始: `北京市朝阳区建国路88号现代城A座1501室`
- 脱敏后: `北京市朝阳***路***号***现代城`

### 4. 未授权证人姓名脱敏 (仅原告/被告包)

**逻辑**: 参与者 CSV 中授权字段为"否"的证人

**效果**:
- 原始: `王五` (2字)
- 脱敏后: `王*`

- 原始: `王小明` (3字)
- 脱敏后: `王*明`

### 5. 对方当事人姓名脱敏

**逻辑**: 原告包中脱敏被告姓名，被告包中脱敏原告姓名

**效果** (原告包中):
- 原始: `李四`
- 脱敏后: `李*`

## 警告场景说明

工具会在以下场景发出警告：

### 1. 同名当事人警告

```
⚠️ 发现同名当事人: 张三 (ID: P-001, P-003)
   建议: 请确认这些是否为同一人，如是请合并；如不是请补充区分标识
```

**处理方式**:
- 检查 participants.csv 中的交叉引用字段
- 如为同一人，合并记录；如为不同人，补充中间名或备注

### 2. 未授权证人警告

```
⚠️ 发现 1 名未授权证人，其姓名将在原告/被告包中脱敏
```

**处理方式**:
- 证人王五的证言仅法官包中完整显示
- 原告/被告包中，王五的姓名会被脱敏为王*

### 3. 缺失文件警告

```
⚠️ 发现 2 个缺失文件:
   - 补充协议.txt
   - 质量检测报告.pdf
```

**处理方式**:
- 检查清单中列出的文件是否实际存在
- 如文件确实缺失，从清单中移除或补充文件

### 4. 额外文件警告

```
⚠️ 存在但未列入清单的文件: 备忘录.txt
```

**处理方式**:
- 确认该文件是否需要作为证据
- 如需纳入，添加到 case_manifest.yaml

## 命令参考

### validate 命令

```bash
evidence-redactor validate \
  --manifest <case_manifest.yaml> \
  --evidence-dir <evidence_files/> \
  --participants <participants.csv>
```

**检查项**:
- 案件清单格式是否正确
- 证据文件是否存在
- 参与者信息完整性
- 清单与目录一致性
- 同名当事人检测
- 交叉引用有效性

### pack 命令

```bash
evidence-redactor pack \
  --manifest <case_manifest.yaml> \
  --evidence-dir <evidence_files/> \
  --participants <participants.csv> \
  --rules <redact_rules.yaml> \
  --output <output_dir>
```

**处理流程**:
1. 按可见性规则筛选文件
2. 为各角色创建独立目录
3. 应用脱敏规则处理敏感信息
4. 记录脱敏映射日志
5. 生成 ZIP 压缩包

### export 命令

```bash
evidence-redactor export \
  --manifest <case_manifest.yaml> \
  --evidence-dir <evidence_files/> \
  --participants <participants.csv> \
  --output <output_dir>
```

**生成文件**:
- 脱敏报告 (HTML)
- 缺失文件列表 (CSV)
- 审计日志 (JSON)
- 处理摘要 (TXT)

### all 命令

```bash
evidence-redactor all \
  --manifest <case_manifest.yaml> \
  --evidence-dir <evidence_files/> \
  --participants <participants.csv> \
  --rules <redact_rules.yaml> \
  --output <output_dir>
  [--skip-validate]
```

**执行顺序**:
1. validate (一致性校验)
2. pack (角色化打包)
3. export (报告导出)

## 示例数据说明

本项目包含完整的示例数据，位于 `sample_data/` 目录：

```
sample_data/
├── case_manifest.yaml          # 案件清单（7个证据文件）
├── participants.csv            # 参与者列表（6人，含2个同名张三）
├── redact_rules.yaml           # 脱敏规则配置
└── evidence_files/
    ├── 起诉状.txt               # 含身份证、手机号、住址
    ├── 答辩状.txt               # 被告方信息
    ├── 银行流水.csv             # 交易记录
    ├── 买卖合同.txt             # 合同文本
    ├── 通讯记录.txt             # 微信聊天摘要
    ├── 证人证言_王五.json       # 未授权证人（仅法官可见）
    └── 证人证言_赵六.json       # 已授权证人
```

**示例中包含的测试场景**:
- ✅ 两个同名"张三"（原告和第三人）- 触发警告
- ✅ 未授权证人"王五"- 原告/被告包中姓名脱敏
- ✅ 跨文件引用"张三 P-001"引用"张三 P-003"
- ✅ 仅法官可见的证人证言（visibility: judge_only）
- ✅ 多种文件格式（txt/csv/json）
- ✅ 多处身份证号、手机号、住址

## 项目结构

```
zy8260/
├── pyproject.toml                    # 项目配置
├── README.md                         # 本文档
├── src/
│   └── evidence_redactor/
│       ├── __init__.py               # 版本信息
│       ├── cli.py                    # 命令行入口
│       ├── models.py                 # 数据模型
│       ├── validator.py              # 一致性校验
│       ├── redactor.py               # 脱敏规则引擎
│       ├── packager.py               # 角色化打包
│       └── exporter.py               # 报告导出
└── sample_data/                      # 示例数据
    ├── case_manifest.yaml
    ├── participants.csv
    ├── redact_rules.yaml
    └── evidence_files/
        ├── 起诉状.txt
        ├── 答辩状.txt
        ├── 银行流水.csv
        ├── 买卖合同.txt
        ├── 通讯记录.txt
        ├── 证人证言_王五.json
        └── 证人证言_赵六.json
```

## 常见问题

### Q: 为什么有些文件在法官包中存在，但在原告/被告包中不存在？

A: 案件清单中设置了 `visibility: judge_only` 的文件，仅法官可见。例如未授权证人的证言通常仅法官可见。

### Q: 同样的姓名，为什么在法官包中不脱敏，在原告/被告包中脱敏？

A: 这是预期行为：
- 法官包: 完整原始数据，无脱敏
- 原告包: 脱敏被告姓名、未授权证人姓名
- 被告包: 脱敏原告姓名、未授权证人姓名

### Q: 如何添加自定义脱敏规则？

A: 编辑 `redact_rules.yaml`，添加新规则：

```yaml
- id: R-100
  type: custom
  pattern: "某某公司"
  replacement: "某公司"
  description: "特定公司名称脱敏"
  enabled: true
  priority: 5
```

### Q: 脱敏后的数据如何恢复原始值？

A: 查看 `redaction_mapping.json` 文件，其中记录了每一处脱敏的原始值、脱敏后值、文件位置和规则。法官可以通过此映射日志进行复查。

### Q: 工具支持哪些文件格式？

A: 当前支持:
- `.txt`: 按行处理文本
- `.csv`: 逐单元格处理
- `.json`: 递归处理所有字符串值

如需支持其他格式（如 Word/Excel/PDF），需先转换为上述格式或扩展工具。

## 许可证

本工具仅供内部使用。
