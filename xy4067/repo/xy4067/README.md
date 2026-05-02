# 义齿打印交付核对员

口腔义齿加工室用本地 Python CLI 工具，用于校验义齿订单、模型文件、树脂批号和后处理记录的一致性。

## 功能特性

- ✅ **牙位格式校验** - 检查牙位编号是否符合标准格式（1-32 或 FDI 两位编码）
- ✅ **文件哈希校验** - 计算并验证模型文件的 SHA256 哈希值，防止文件篡改
- ✅ **材料/色号匹配** - 验证材料类型与色号的兼容性
- ✅ **树脂批号有效期** - 检查树脂批号是否过期或即将过期
- ✅ **后处理时长** - 验证后处理时长是否符合标准要求
- ✅ **重复病例检测** - 检测是否存在同一患者同一牙位的重复订单
- ✅ **患者ID一致性** - 验证模型文件名中的患者ID与订单是否一致

## 安装

### 方式一：直接使用（推荐）

```bash
# 克隆或下载项目
cd xy4067

# 安装依赖
pip install -r requirements.txt

# 直接运行
python main.py --help
```

### 方式二：安装为系统命令

```bash
cd xy4067
pip install -e .

# 现在可以直接使用
denture-checker --help
```

## 命令列表

| 命令 | 说明 |
|------|------|
| `init` | 初始化工作区目录结构 |
| `import-order` | 导入订单 CSV 文件 |
| `scan` | 扫描模型文件和后处理记录 |
| `check` | 执行校验规则，问题写入隔离区 |
| `pack` | 只复制通过项并生成交付清单 |
| `report` | 导出 Markdown/CSV/JSON 格式报告 |
| `self-test` | 运行自检程序验证系统功能 |
| `generate-sample` | 生成示例测试数据 |

## 快速开始

### 方式一：使用临时目录验证全流程

```bash
# 1. 创建一个临时工作目录
mkdir -p /tmp/denture_test
cd /tmp/denture_test

# 2. 生成示例数据（包含错误病例用于测试）
python /path/to/xy4067/main.py generate-sample . --count 5 --include-errors

# 3. 查看生成的目录结构
ls -la
# 应该看到：orders/ models/ records/ quarantine/ output/ reports/

# 4. 扫描模型文件和后处理记录
python /path/to/xy4067/main.py scan

# 5. 执行校验（会自动从 orders 目录导入订单）
python /path/to/xy4067/main.py check

# 6. 查看隔离区中的问题病例
ls -la quarantine/
cat quarantine/quarantine.json

# 7. 打包通过校验的病例
python /path/to/xy4067/main.py pack

# 8. 生成校验报告
python /path/to/xy4067/main.py report

# 9. 查看生成的报告
ls -la reports/
cat reports/*.md
```

### 方式二：逐步操作演示

#### 1. 初始化工作区

```bash
# 创建工作目录
mkdir my_workspace
cd my_workspace

# 初始化目录结构
python /path/to/xy4067/main.py init

# 查看目录结构
ls -la
# orders/      - 订单CSV文件
# models/      - STL/3MF模型文件
# records/     - 后处理记录
# quarantine/  - 隔离区
# output/      - 输出目录
# reports/     - 报告目录
```

#### 2. 准备订单CSV

在 `orders/` 目录下创建订单 CSV 文件，支持中英文列名：

```csv
case_id,patient_id,patient_name,gender,age,tooth_position,material_type,color_shade,resin_batch,resin_expiration
CASE-001,P2024050001,张三,男,35,11,12,树脂,A2,RES-2024-001,2025-12-31
CASE-002,P2024050002,李四,女,42,13-16,陶瓷,A3,CER-2024-015,2025-06-30
CASE-003,P2024050003,王五,男,28,99,树脂,A1,RES-2024-002,2024-01-01
```

或者使用中文列名：

```csv
病例编号,患者编号,患者姓名,性别,年龄,牙位,材料类型,色号,树脂批号,有效期
CASE-001,P2024050001,张三,男,35,11,12,树脂,A2,RES-2024-001,2025-12-31
```

#### 3. 准备模型文件

将 STL/3MF 文件放入 `models/` 目录，建议命名格式：
- `P{患者ID}_T{牙位}.stl`
- `{病例编号}_{牙位}.3mf`

例如：
```
models/
├── P2024050001_T11.stl
├── P2024050001_T12.stl
├── P2024050002_T13.stl
└── CASE-003_99.stl
```

#### 4. 准备后处理记录

在 `records/` 目录下创建后处理记录文件，支持 JSON、CSV、TXT 格式：

**JSON 格式示例：**
```json
{
  "case_id": "CASE-001",
  "processing_type": "清洗固化",
  "start_time": "2024-05-01 14:00:00",
  "end_time": "2024-05-01 14:30:00",
  "operator": "技师A",
  "notes": "正常后处理"
}
```

**CSV 格式示例：**
```csv
case_id,processing_type,start_time,end_time,operator,notes
CASE-001,清洗固化,2024-05-01 14:00:00,2024-05-01 14:30:00,技师A,正常后处理
```

**TXT 格式示例：**
```
case_id: CASE-001
processing_type: 清洗固化
start_time: 2024-05-01 14:00:00
end_time: 2024-05-01 14:30:00
operator: 技师A
notes: 正常后处理
```

#### 5. 执行完整流程

```bash
# 1. 扫描文件
python /path/to/xy4067/main.py scan

# 2. 导入订单（可选，check 命令会自动导入）
python /path/to/xy4067/main.py import-order orders/你的订单.csv

# 3. 执行校验
python /path/to/xy4067/main.py check

# 4. 查看隔离区
ls quarantine/
cat quarantine/quarantine.json

# 5. 打包通过的病例
python /path/to/xy4067/main.py pack

# 6. 生成报告
python /path/to/xy4067/main.py report

# 7. 查看报告
cat reports/validation_report_*.md
```

## 校验规则详解

### 1. 牙位格式校验 (tooth_position_format)

- **严重程度**: critical
- **说明**: 检查牙位编号是否符合标准
- **有效格式**:
  - 数字 1-32（通用牙位编号）
  - 两位 FDI 编码（如 11, 12, 21, 22 等）
  - 范围表示（如 13-16 表示 13,14,15,16）
  - 逗号分隔（如 11,12,21）

### 2. 文件哈希校验 (file_hash_consistency)

- **严重程度**: critical
- **说明**: 计算模型文件的 SHA256 哈希值
- **功能**:
  - 检测重复文件（相同哈希值）
  - 可与预期哈希比对检测文件篡改

### 3. 材料/色号匹配 (material_color_match)

- **严重程度**: critical
- **说明**: 验证材料类型与色号的兼容性
- **有效色号**:
  - 树脂: A1, A2, A3, A3.5, A4, B1, B2, B3, B4, C1, C2, C3, C4, D2, D3, D4
  - 陶瓷: 同上 + BL1, BL2, BL3, BL4
  - 金属: NC, 原色, 金色, 银色
  - 复合: A1, A2, A3, A3.5, A4, B1, B2, C1, C2, D2, D3

### 4. 树脂批号有效期 (resin_batch_expiration)

- **严重程度**: critical
- **说明**: 检查树脂批号的有效期
- **规则**:
  - 已过期 → 严重错误
  - 30 天内过期 → 警告

### 5. 后处理时长 (post_processing_duration)

- **严重程度**: warning
- **说明**: 验证后处理时长是否符合标准
- **标准时长**:
  - 清洗: 10-30 分钟
  - 清洗固化: 20-60 分钟
  - 固化: 15-45 分钟
  - 抛光: 30-120 分钟
  - 染色: 20-60 分钟

### 6. 重复病例检测 (duplicate_case_detection)

- **严重程度**: warning
- **说明**: 检测同一患者同一牙位的重复订单

### 7. 患者ID一致性 (patient_id_consistency)

- **严重程度**: critical
- **说明**: 验证模型文件名中的患者ID与订单是否一致

## 工作区目录结构

```
工作区/
├── .denture_checker_config.json  # 工作区配置文件
├── orders/                        # 订单CSV文件
│   └── orders_20240501.csv
├── models/                        # 模型文件 (STL, 3MF, OBJ, PLY)
│   ├── P2024050001_T11.stl
│   └── P2024050002_T13-T16.3mf
├── records/                       # 后处理记录 (JSON, CSV, TXT)
│   ├── post_processing_001.json
│   └── records.csv
├── quarantine/                    # 隔离区
│   ├── quarantine.json           # 问题病例记录
│   └── CASE-003/                 # 隔离的病例文件
├── output/                        # 输出目录
│   └── delivery_20240501_143000/
│       ├── CASE-001/
│       ├── CASE-002/
│       ├── delivery_manifest.csv
│       └── delivery_manifest.json
└── reports/                       # 报告目录
    ├── validation_report_20240501_143000.md
    ├── validation_report_20240501_143000.csv
    └── validation_report_20240501_143000.json
```

## 自检程序

运行自检程序验证系统所有功能是否正常：

```bash
# 快速自检（使用临时目录，完成后自动清理）
python main.py self-test

# 保留测试工作区以便查看
python main.py self-test -w /tmp/test_workspace -k
```

## 常见问题

### Q1: CSV 文件编码问题

如果 CSV 文件是 Excel 导出的，可能使用 GBK 编码。可以指定编码：

```bash
python main.py import-order orders.csv --encoding gbk
```

### Q2: 模型文件名格式

系统会自动从文件名中提取患者ID和牙位，支持以下格式：
- `P12345678_T11.stl` → 患者ID: 12345678, 牙位: 11
- `12345678_T11-T12.stl` → 患者ID: 12345678, 牙位: 11-12
- `Patient12345678.stl` → 患者ID: 12345678

### Q3: 隔离区文件

问题病例会被记录在 `quarantine/quarantine.json` 中，同时相关模型文件会被复制到隔离区目录。修复问题后可以手动处理。

## 技术栈

- **语言**: Python 3.8+
- **CLI 框架**: Click
- **数据结构**: Dataclasses
- **哈希计算**: hashlib (SHA256)

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request！
