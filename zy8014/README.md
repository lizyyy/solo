# 跨境报关资料预检与补证清单生成器

一个本地 Python CLI 工具，用于跨境报关资料的预检和补证清单生成。

## 功能特性

- **多格式导入**: 支持舱单 CSV、装箱清单 JSON、申报规则 YAML
- **字段标准化**: 自动标准化 HS 编码、重量/体积单位、国家代码、箱号等
- **多重校验**: 校验品名、HS 编码、重量体积、箱号、禁限品
- **差异核对**: 舱单与装箱单数据交叉核对
- **风险分级**: 根据问题严重程度自动分级
- **补证生成**: 自动生成补证任务清单
- **报告输出**: 输出风险分级 CSV、补证任务 CSV、Markdown 复盘报告

### 重点处理场景

1. **多票合箱**: 同一集装箱多个提单号的识别与处理
2. **撤单重复报文**: 检测已撤单申报和重复申报
3. **缺失 HS 编码**: 识别并标记缺失的 HS 编码
4. **重量体积不一致**: 舱单与装箱单数据差异检测

## 项目结构

```
zy8014/
├── pyproject.toml          # 项目配置
├── README.md               # 本文件
├── src/
│   └── customs_inspector/
│       ├── __init__.py     # 模块导出
│       ├── models.py       # 数据模型定义
│       ├── importer.py     # 数据导入 (CSV/JSON/YAML)
│       ├── normalizer.py   # 字段标准化
│       ├── rule_engine.py  # 规则校验引擎
│       ├── reconciler.py   # 数据核对与差异分析
│       ├── exporter.py     # 报告导出
│       └── cli.py          # 命令行入口
├── sample/                 # 示例数据
│   ├── manifest.csv        # 舱单示例
│   ├── packing_tkt001.json # 装箱清单示例 (多份)
│   ├── packing_tkt002.json
│   ├── packing_tkt003.json
│   ├── packing_tkt004.json
│   ├── packing_tkt005.json
│   └── rules.yaml          # 申报规则示例
└── tests/                  # 测试文件
    ├── __init__.py
    ├── test_importer.py
    ├── test_normalizer.py
    ├── test_rule_engine.py
    └── test_reconciler.py
```

## 安装

```bash
# 安装依赖
pip install -e .

# 安装开发依赖 (用于测试)
pip install -e ".[dev]"
```

## 快速开始

### 运行预检

使用示例数据运行预检：

```bash
# 一键命令 (自动创建 out 目录)
customs-inspector \
  --manifest sample/manifest.csv \
  --packing sample/packing_tkt001.json sample/packing_tkt002.json sample/packing_tkt003.json sample/packing_tkt004.json sample/packing_tkt005.json \
  --rules sample/rules.yaml \
  --output out/ \
  --verbose
```

或使用短参数：

```bash
customs-inspector \
  -m sample/manifest.csv \
  -p sample/packing_*.json \
  -r sample/rules.yaml \
  -o out/ \
  -v
```

### 输出文件

运行后，`out/` 目录将包含：

- `correction_tasks.csv` - 补证任务清单
- `risk_summary.csv` - 风险汇总
- `inspection_report.md` - 详细的 Markdown 复盘报告

### 运行测试

```bash
pytest -v
```

## 命令行参数

| 参数 | 短参数 | 必需 | 说明 |
|------|--------|------|------|
| `--manifest` | `-m` | 是 | 舱单 CSV 文件路径 |
| `--packing` | `-p` | 是 | 装箱清单 JSON 文件路径 (支持多个) |
| `--rules` | `-r` | 是 | 申报规则 YAML 文件路径 |
| `--output` | `-o` | 否 | 输出目录路径 (默认: ./out) |
| `--tolerance` | 无 | 否 | 重量体积差异容差百分比 (默认: 5.0) |
| `--verbose` | `-v` | 否 | 显示详细输出 |

## 数据格式说明

### 舱单 CSV 格式

必填字段：
- `ticket_no` / `TicketNo` / `ticket`: 提单号
- `container_no` / `ContainerNo` / `container`: 集装箱号
- `description` / `Description` / `goods_name`: 品名描述

可选字段：
- `hs_code` / `HSCode` / `hs`: HS 编码
- `weight` / `Weight` / `gross_weight`: 重量
- `weight_unit`: 重量单位 (默认 KG)
- `volume` / `Volume` / `cbm`: 体积
- `volume_unit`: 体积单位 (默认 CBM)
- `quantity`: 数量
- `origin_country`: 原产国
- `destination_country`: 目的国
- `is_cancelled` / `cancelled`: 是否已撤单
- `voyage_no` / `VoyageNo`: 航次号
- `vessel_name` / `VesselName`: 船名
- `eta` / `ETA`: 预计到港时间
- `etd` / `ETD`: 预计离港时间

### 装箱清单 JSON 格式

```json
{
  "ticket_no": "TKT001",
  "packing_date": "2024-05-08",
  "total_weight": 2300,
  "total_volume": 37.8,
  "items": [
    {
      "ticket_no": "TKT001",
      "container_no": "MSKU1234567",
      "description": "塑料零件 Plastic Parts",
      "hs_code": "3926.9090",
      "weight": 1500,
      "weight_unit": "KG",
      "volume": 25.5,
      "volume_unit": "CBM",
      "quantity": 100,
      "package_type": "CTN",
      "marks": "MADE IN CHINA"
    }
  ]
}
```

### 申报规则 YAML 格式

```yaml
rules:
  - rule_id: PROHIBIT_001
    rule_name: 禁止进口象牙制品
    rule_type: prohibited
    priority: 1
    conditions:
      hs_codes:
        - "9601*"
      keywords:
        - "象牙"
        - "ivory"
    risk_level: CRITICAL
    description: 象牙制品属于国际禁运商品
    required_certificates: []

  - rule_id: RESTRICT_001
    rule_name: 限制进口化工产品
    rule_type: restricted
    priority: 2
    conditions:
      hs_codes:
        - "3808*"
        - "3824*"
      keywords:
        - "化工"
        - "chemical"
    risk_level: HIGH
    description: 化工产品需要特殊许可证
    required_certificates:
      - "危险化学品进口许可证"
      - "MSDS报告"

  - rule_id: CERT_001
    rule_name: 机电产品需提供3C认证
    rule_type: certificate
    priority: 3
    conditions:
      hs_codes:
        - "84*"
        - "85*"
      keywords:
        - "机械"
        - "电子"
    risk_level: MEDIUM
    description: 大部分机电产品需要3C强制性认证
    required_certificates:
      - "3C认证证书"
      - "产品说明书"
```

#### 规则类型

| 类型 | 说明 |
|------|------|
| `prohibited` | 禁运商品，发现后标记为 CRITICAL 风险 |
| `restricted` | 限制商品，需要特定许可证 |
| `certificate` | 需要特定证件/认证的商品 |

#### 风险等级

| 等级 | 说明 |
|------|------|
| `CRITICAL` | 极其严重，必须立即处理 |
| `HIGH` | 严重，需要优先处理 |
| `MEDIUM` | 中等，应尽快处理 |
| `LOW` | 轻微，建议检查 |

#### HS 编码匹配模式

- 精确匹配: `"3926.9090"` - 完全匹配
- 前缀匹配: `"84*"` - 匹配以 84 开头的所有 HS 编码

## 模块说明

### models.py

定义核心数据模型：
- `Manifest` / `ManifestItem`: 舱单数据
- `PackingList` / `PackingItem`: 装箱清单数据
- `DeclarationRule`: 申报规则
- `ValidationError`: 校验错误
- `CorrectionTask`: 补证任务
- `ContainerReconciliation`: 集装箱核对结果
- `InspectionResult`: 整体检验结果

### importer.py

数据导入模块，支持：
- CSV 舱单导入
- JSON 装箱清单导入
- YAML 规则导入

### normalizer.py

字段标准化模块：
- HS 编码格式化 (添加空格分隔符)
- 重量单位转换 (支持 KG, G, LB, T 等)
- 体积单位转换 (支持 CBM, L, GAL 等)
- 国家代码标准化 (中文/英文 → ISO 2 位代码)
- 箱号格式化

### rule_engine.py

规则校验引擎：
- HS 编码有效性校验
- 重量/体积/箱号缺失检测
- 禁运商品检测
- 限制商品检测
- 补证任务生成

### reconciler.py

数据核对模块：
- 多票合箱检测
- 重量/体积差异对比
- 重复申报检测
- 撤单报文检测
- 舱单与装箱单数据一致性核对

### exporter.py

报告导出模块：
- 补证任务 CSV 导出
- 风险汇总 CSV 导出
- Markdown 复盘报告导出

## 风险分级逻辑

整体风险等级根据最高级别的问题决定：

1. 存在 `CRITICAL` 问题 → 整体 `CRITICAL`
2. 存在 `HIGH` 问题 → 整体 `HIGH`
3. 存在 `MEDIUM` 问题 → 整体 `MEDIUM`
4. 无问题 → `LOW`

## 许可证

MIT License
