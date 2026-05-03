# Visa Checker - 签证材料核对工具

一个本地运行的签证材料核对工具，无需联网。自动匹配材料文件、检查缺件、验证日期、生成报告。

## 功能特性

- ✅ **材料自动匹配**：根据文件名自动识别申请人和材料类型
- ✅ **缺件检查**：检查是否缺少必需的申请材料
- ✅ **护照有效期校验**：检查护照是否过期或有效期不足
- ✅ **保险覆盖检查**：验证保险日期是否覆盖整个行程
- ✅ **酒店天数核对**：检查酒店预订天数是否匹配行程
- ✅ **在职证明日期**：验证在职证明开具日期是否在有效期内
- ✅ **行程日期冲突**：检测行程日期是否连续、是否有矛盾
- ✅ **文件命名规范**：检查文件名是否规范，建议重命名
- ✅ **多格式报告**：支持 JSON、Markdown、HTML 三种报告格式
- ✅ **打包导出**：支持 dry-run 预览和打包导出材料包

## 安装

### 环境要求

- Python 3.8+
- pip

### 安装步骤

```bash
# 1. 进入项目目录
cd zy1096

# 2. 安装依赖
pip install -e .

# 或者
pip install -r requirements.txt
```

### 验证安装

```bash
visa-checker --help
```

## 快速开始

### 1. 准备工作目录

创建以下目录结构：

```
你的工作目录/
├── applicants.csv      # 申请人信息
├── itinerary.csv       # 行程信息
├── rules.json          # 校验规则（可选，使用默认规则）
└── materials/          # 材料文件目录
    ├── A001_passport.pdf
    ├── A001_photo.jpg
    ├── A002_passport.pdf
    └── ...
```

### 2. 运行核对

```bash
# 使用默认路径
visa-checker check

# 或指定路径
visa-checker check \
  --applicants ./my_applicants.csv \
  --itinerary ./my_itinerary.csv \
  --materials ./my_materials \
  --output ./my_output
```

### 3. 查看报告

报告会生成在 `output/` 目录下：

- `report_YYYYMMDD.json` - JSON 格式报告
- `report_YYYYMMDD.md` - Markdown 格式报告
- `report_YYYYMMDD.html` - HTML 格式报告（可直接用浏览器打开）

## 命令详解

### check - 核对材料并生成报告

```bash
visa-checker check [OPTIONS]
```

**选项：**

| 选项 | 简写 | 说明 | 默认值 |
|------|------|------|--------|
| `--applicants` | `-a` | 申请人 CSV 文件路径 | `./applicants.csv` |
| `--itinerary` | `-i` | 行程 CSV 文件路径 | `./itinerary.csv` |
| `--rules` | `-r` | 规则 JSON 文件路径 | `./rules.json` |
| `--materials` | `-m` | 材料目录路径 | `./materials` |
| `--date` | `-d` | 核对日期 (YYYY-MM-DD) | 今天 |
| `--output` | `-o` | 输出目录 | `./output` |
| `--format` | `-f` | 报告格式 (可多次指定) | json, md, html |

**示例：**

```bash
# 基本用法
visa-checker check

# 指定核对日期（模拟未来/过去时间）
visa-checker check --date 2026-06-01

# 只生成 JSON 和 HTML 报告
visa-checker check -f json -f html
```

### dry-run - 预览重命名建议

```bash
visa-checker dry-run [OPTIONS]
```

预览文件重命名建议，**不会实际修改文件**。

**示例：**

```bash
visa-checker dry-run
```

### rename - 执行文件重命名

```bash
visa-checker rename [OPTIONS]
```

**警告：此命令会修改原始文件！**

**选项：**

| 选项 | 简写 | 说明 |
|------|------|------|
| `--yes` | `-y` | 直接执行，不确认 |

**示例：**

```bash
# 交互式确认后执行
visa-checker rename

# 直接执行（用于脚本）
visa-checker rename -y
```

### package - 打包导出材料包

```bash
visa-checker package [OPTIONS]
```

将材料整理打包，按申请人分类，使用规范文件名。

**选项：**

| 选项 | 简写 | 说明 | 默认值 |
|------|------|------|--------|
| `--format` | `-f` | 导出格式: folder 或 zip | `folder` |
| `--skip-report` | | 不生成报告 | |
| `--yes` | `-y` | 忽略警告直接执行 | |

**示例：**

```bash
# 导出为文件夹
visa-checker package

# 导出为 ZIP 压缩包
visa-checker package --format zip

# 忽略警告直接打包（用于紧急情况）
visa-checker package --yes
```

## 文件格式说明

### applicants.csv - 申请人信息

| 字段 | 必需 | 说明 | 示例 |
|------|------|------|------|
| applicant_id | ✅ | 申请人编号 | A001 |
| name | ✅ | 姓名 | 张三 |
| passport_number | ✅ | 护照号 | E12345678 |
| passport_expiry_date | ✅ | 护照有效期 | 2030-12-31 |
| birth_date | | 出生日期 | 1990-05-15 |
| nationality | | 国籍 | 中国 |
| email | | 邮箱 | zhangsan@example.com |
| phone | | 电话 | 13800138001 |

**示例：**

```csv
applicant_id,name,passport_number,passport_expiry_date,birth_date,nationality,email,phone
A001,张三,E12345678,2030-12-31,1990-05-15,中国,zhangsan@example.com,13800138001
A002,李四,E87654321,2029-06-15,1988-11-20,中国,lisi@example.com,13800138002
```

### itinerary.csv - 行程信息

| 字段 | 必需 | 说明 | 示例 |
|------|------|------|------|
| applicant_id | ✅ | 申请人编号 | A001 |
| date | ✅ | 日期 | 2026-06-10 |
| city | ✅ | 城市 | 巴黎 |
| country | ✅ | 国家 | 法国 |
| hotel_name | | 酒店名称 | Paris Central Hotel |
| notes | | 备注 | 埃菲尔铁塔 |

**示例：**

```csv
applicant_id,date,city,country,hotel_name,notes
A001,2026-06-10,巴黎,法国,Paris Central Hotel,抵达巴黎
A001,2026-06-11,巴黎,法国,Paris Central Hotel,埃菲尔铁塔
A001,2026-06-12,巴黎,法国,Paris Central Hotel,卢浮宫
```

### rules.json - 校验规则（可选）

```json
{
  "passport_min_validity_months": 6,
  "employment_cert_max_age_days": 30,
  "insurance_buffer_days": 2,
  "required_documents": [
    "passport",
    "photo",
    "employment_cert",
    "bank_statement",
    "flight_itinerary",
    "hotel_booking",
    "insurance"
  ],
  "photo_requirements": {
    "size": "35x45mm",
    "background": "white",
    "max_age_months": 6
  },
  "document_naming_pattern": "{applicant_id}_{document_type}.{ext}"
}
```

### 材料文件命名规范

**推荐格式：** `{申请人编号}_{材料类型}.{扩展名}`

**示例：**
- `A001_passport.pdf` - 护照扫描件
- `A001_photo.jpg` - 证件照
- `A001_employment_cert.pdf` - 在职证明
- `A001_bank_statement.pdf` - 银行流水
- `A001_flight_itinerary.pdf` - 机票行程单
- `A001_hotel_booking.pdf` - 酒店预订单
- `A001_insurance.pdf` - 保险单

**支持的材料类型关键词：**

| 类型 | 识别关键词 |
|------|-----------|
| passport | passport, 护照, huzhao |
| photo | photo, 证件照, 照片, zhaopian |
| employment_cert | employment, 在职证明, 工作证明 |
| bank_statement | bank, statement, 银行流水, 流水 |
| flight_itinerary | flight, 机票, 行程单 |
| hotel_booking | hotel, 酒店, 住宿 |
| insurance | insurance, 保险, baoxian |

## 校验规则详解

### 护照有效期检查

- **护照是否过期**：比较护照有效期与当前日期
- **有效期是否足够**：护照有效期需覆盖行程结束后 N 个月（默认 6 个月）

### 保险覆盖检查

工具通过分析文件名中的日期来判断保险覆盖范围。

**推荐文件名格式：** `A001_insurance_20260601-20260615.pdf`

检查项：
- 保险生效日期是否早于等于行程开始日期
- 保险结束日期是否晚于等于行程结束日期

### 酒店天数检查

**推荐文件名格式：** `A001_hotel_booking_20260610_20260614.pdf`

检查项：
- 入住日期是否早于等于行程开始日期
- 退房日期是否晚于等于行程结束日期

### 在职证明日期检查

**推荐文件名格式：** `A001_employment_cert_20260420.pdf`

检查项：
- 开具日期是否在有效期内（默认 30 天）

### 行程日期冲突检查

- 检查行程日期是否连续
- 检测是否有日期缺失

## 风险等级说明

| 等级 | 颜色 | 说明 |
|------|------|------|
| CRITICAL | 🔴 红色 | 严重问题，必须解决（如缺件、护照过期） |
| HIGH | 🟠 橙色 | 高风险问题，建议解决（如有效期不足） |
| MEDIUM | 🟡 黄色 | 中等问题，需要注意 |
| LOW | 🔵 蓝色 | 轻微问题，建议改进 |
| OK | 🟢 绿色 | 正常，无问题 |

## 样例数据

项目提供两套样例数据：

### 1. 正常样例 - examples/normal/

所有材料齐全、命名规范、日期正确。

```bash
# 测试正常样例
cd examples/normal
visa-checker check
```

预期结果：无严重问题，报告显示所有申请人状态为正常。

### 2. 有问题样例 - examples/problematic/

包含各种常见问题：

- **B001 赵六**：
  - 护照已过期（2024-01-15）
  - 行程日期不连续（缺 6月2日）
  - 缺少在职证明、机票、酒店、保险

- **B002 孙七**：
  - 护照有效期不足（2026-03-01，行程6月10日开始）
  - 保险只覆盖2天，少1天
  - 酒店只订1天，行程3天
  - 在职证明开具于2个月前，超过30天有效期
  - 文件命名不规范

- **B003 周八**：
  - 保险晚开始1天
  - 酒店少1天
  - 文件命名不规范

```bash
# 测试有问题样例
cd examples/problematic
visa-checker check
```

预期结果：会检测到多个严重问题和高风险问题。

## 常见问题

### Q1: 日期格式支持哪些？

支持以下格式：
- `2026-06-10` (推荐)
- `2026/06/10`
- `10-06-2026`
- `10/06/2026`
- `2026年06月10日`
- `2026.06.10`
- `20260610` (8位数字)

### Q2: 文件名不规范会怎么样？

工具会：
1. 尝试通过关键词识别材料类型
2. 给出重命名建议
3. 在报告中标记为低风险问题

### Q3: 如何处理无法匹配的文件？

无法匹配的文件会：
1. 在报告中列出
2. 打包时放入 `_unmatched/` 目录
3. 建议手动重命名

### Q4: 可以只检查部分申请人吗？

当前版本会检查所有在 `applicants.csv` 中的申请人。如需单独检查，建议创建独立的工作目录。

### Q5: 工具会修改我的原始文件吗？

默认不会。只有执行 `visa-checker rename` 命令时才会修改原始文件。建议先使用 `dry-run` 预览。

## 错误提示说明

| 错误信息 | 原因 | 解决方案 |
|---------|------|---------|
| 申请人文件不存在 | applicants.csv 路径错误 | 检查文件路径或使用 `-a` 指定 |
| 材料目录为空 | materials/ 目录不存在或为空 | 创建目录并放入材料文件 |
| 日期格式错误 | CSV 中的日期无法解析 | 使用标准日期格式 YYYY-MM-DD |
| 规则文件缺少字段 | rules.json 不完整 | 补充缺失字段或删除 rules.json 使用默认值 |
| 存在严重问题 | 检测到必须解决的问题 | 先解决问题，或使用 `--yes` 强制打包 |

## 项目结构

```
visa_checker/
├── __init__.py
├── models.py          # 数据模型定义
├── utils.py           # 工具函数（日期解析等）
├── parser.py          # CSV/JSON 解析模块
├── matcher.py         # 材料匹配模块
├── validator.py       # 规则校验引擎
├── reporter.py        # 报告生成模块
├── exporter.py        # 打包导出模块
└── cli.py             # 命令行入口

examples/
├── normal/            # 正常样例
│   ├── applicants.csv
│   ├── itinerary.csv
│   ├── rules.json
│   └── materials/
└── problematic/       # 有问题样例
    ├── applicants.csv
    ├── itinerary.csv
    ├── rules.json
    └── materials/
```

## 技术栈

- **语言**: Python 3.8+
- **命令行**: Click
- **日期处理**: python-dateutil
- **模板**: Jinja2 (HTML 报告)

## 更新日志

### v1.0.0 (2026-05-04)

- 初始版本发布
- 支持材料自动匹配
- 支持护照有效期、保险、酒店、在职证明日期校验
- 支持行程日期冲突检测
- 支持 JSON、Markdown、HTML 三种报告格式
- 支持 dry-run 预览和打包导出
- 提供正常和有问题两套样例数据

## 许可证

MIT License
