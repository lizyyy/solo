# 影院 DCP/KDM 放映包预检器

Cinema DCP/KDM Playback Package Pre-checker

## 功能特点

- 解析 DCP manifest JSON、CPL/PKL XML、KDM XML、影厅设备 CSV 和排片 YAML
- 扫描资产映射，检测 CPL 引用缺失资产
- 校验 KDM 有效期是否覆盖排片场次
- 校验服务器证书指纹是否匹配
- 检测同场次混入不同版本的问题
- 生成 kdm_audit.md、issues.csv 和 timeline.html 报告

## 安装

```bash
pip install -e .
```

## 依赖

```bash
pip install pyyaml
```

## 使用方法

### 基本用法

```bash
dcp-checker \
  --manifest dcp_manifest.json \
  --kdm kdm_valid.xml \
  --screens screens.csv \
  --schedule schedule.yaml
```

### 完整示例（含多 KDM、输出目录、自动打开 HTML）

```bash
dcp-checker \
  --manifest sample_data/dcp_manifest.json \
  --kdm sample_data/kdm_valid.xml sample_data/kdm_expired.xml \
  --screens sample_data/screens.csv \
  --schedule sample_data/schedule.yaml \
  --output output/ \
  --open
```

### 短参数格式

```bash
dcp-checker -m sample_data/dcp_manifest.json \
  -k sample_data/kdm_valid.xml \
  -s sample_data/screens.csv \
  -y sample_data/schedule.yaml \
  -o output/
```

## 输入文件格式

### DCP Manifest (JSON)

```json
{
  "Id": "urn:uuid:...",
  "Assets": [...],
  "CPLs": [...],
  "PKLs": [...]
}
```

### KDM XML

标准 SMPTE KDM XML 格式，需包含：
- `ContentTitleText`
- `KDMValidityStart` / `KDMValidityEnd`
- `ServerFingerprint`
- `ScreenList`
- `CPL` 引用

### 影厅设备 CSV

```csv
screen_id,screen_name,server_type,server_serial,server_fingerprint,projector_type,projector_serial,lamp_hours
SCREEN01,Main Hall 1,Barco S4,SN-BARCO-001,AA:BB:CC:...,Barco DP4K,SN-PROJ-001,450
```

### 排片 YAML

```yaml
showtimes:
  - screen_id: SCREEN01
    screen_name: Main Hall 1
    title: Movie Title
    show_date: "2026-05-15"
    show_time: "14:00"
    cpl_id: "urn:uuid:..."
    cpl_uuid: "urn:uuid:..."
    required_assets: [...]
    duration_seconds: 7200
```

## 输出报告

### kdm_audit.md

Markdown 格式的综合审计报告，包含：
- 执行摘要
- 问题汇总表
- 银幕覆盖率统计
- 详细问题列表

### issues.csv

CSV 格式的问题清单，字段包括：
- severity, category, screen_id, title, description, cpl_id, cpl_uuid, recommended_action

### timeline.html

可交互的 HTML 时间线视图：
- 按时间排序的场次列表
- 颜色编码状态标识
- 可在浏览器中打开查看

## 已知问题检测

1. **MISSING_ASSET** - CPL/PKL 引用的资产在 manifest 中不存在
2. **FINGERPRINT_MISMATCH** - KDM 服务器指纹与影厅设备 CSV 不匹配
3. **MISSING_KDM** - 排片场次没有对应的 KDM
4. **KDM_NOT_YET_VALID** - 场次安排在 KDM 生效之前
5. **KDM_EXPIRED** - 场次安排在 KDM 过期之后
6. **VERSION_MIXING** - 同一时间同一银幕有多个不同 CPL

## 测试

```bash
python -m pytest tests/ -v
```

## 项目结构

```
dcp_checker/
├── __init__.py
├── parser.py      # 解析模块：manifest, CPL/PKL XML, KDM XML, CSV, YAML
├── rules.py       # 验证规则：资产引用、指纹匹配、KDM 有效期
├── coverage.py    # 排片覆盖分析
├── reporter.py    # 报告生成：Markdown, CSV, HTML
└── cli.py         # 命令行接口
```

## License

MIT
