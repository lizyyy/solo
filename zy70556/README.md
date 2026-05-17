# Redis 键空间体检 CLI 工具

一个用于分析Redis键空间使用情况的Python工具包，帮助团队识别没有过期时间的键、分析内存占用、按前缀归类并分配负责人。

## 功能特性

- 🔍 **实时扫描**: 直接连接Redis扫描键空间，使用SCAN命令避免阻塞
- 📂 **离线分析**: 支持从JSON/CSV文件导入分析数据
- ⏰ **TTL分组**: PERMANENT、NOT_FOUND、TTL_1H、TTL_1D、TTL_1W、TTL_1M、TTL_LONG
- 📊 **内存聚合**: 按前缀统计内存占用，识别内存热点
- 👤 **负责人映射**: 支持前缀与负责人/服务的关联映射
- 📋 **多种报告**: 终端摘要、JSON/CSV机器可读结果、HTML可视化报告
- 🚫 **异常处理**: 保留坏行/异常样本的原始位置和原因

## 安装

```bash
# 方式一：使用 pip 安装（推荐）
pip install -e .

# 方式二：安装依赖
pip install -r requirements.txt
```

## 目录结构

```
redis_key_analyzer/
├── __init__.py          # 包初始化
├── scanner.py           # Redis扫描器和数据加载
├── analyzer.py          # 键空间分析逻辑（TTL分组、内存聚合、前缀归属）
├── report.py            # 报告生成器（终端、JSON、CSV、HTML）
├── cli.py               # 命令行接口
├── data/                # 数据目录（含样例数据）
└── reports/             # 报告输出目录
```

## 快速开始

### 0. 核心流程：扫描 -> 保存原始键 -> 离线分析（闭环）

工具支持完整的扫描-分析闭环：

1. **`scan` 命令**：扫描 Redis 并生成以下两种文件：
   - `*_raw_keys.json`：原始键列表（可再次用于离线分析）
   - 分析报告（JSON/CSV/HTML）

2. **`analyze` 命令**：从原始键列表重新分析，支持更换 Owner 映射

### 1. 先体验离线分析（无需Redis）

使用内置的样例数据，直接体验完整的分析流程：

```bash
# 使用样例数据进行离线分析
python3 -m redis_key_analyzer analyze redis_key_analyzer/data/sample_keys.json --output sample_report

# 使用样例Owner映射进行分析
python3 -m redis_key_analyzer analyze redis_key_analyzer/data/sample_keys.json \
    --owner-mapping redis_key_analyzer/data/sample_mapping.json \
    --output sample_with_owner
```

报告将生成在 `redis_key_analyzer/reports/` 目录下。

### 2. 初始化Owner映射配置文件

```bash
# 生成映射模板
python3 -m redis_key_analyzer init-mapping

# 指定输出文件名
python3 -m redis_key_analyzer init-mapping --output my_owner_mapping.json
```

Owner映射文件示例：
```json
{
    "user:": "用户服务",
    "order:": "订单服务",
    "product:": "商品服务",
    "cache:": "缓存服务",
    "session:": "会话服务"
}
```

### 2. 扫描Redis键空间并生成报告

```bash
# 基本使用（连接本地Redis localhost:6379 db 0）
python3 -m redis_key_analyzer scan

# 指定Redis连接参数
python3 -m redis_key_analyzer scan --host 192.168.1.100 --port 6379 --db 0 --password your_password

# 只扫描特定模式的键
python3 -m redis_key_analyzer scan --pattern "user:*"

# 使用Owner映射文件
python3 -m redis_key_analyzer scan --owner-mapping owner_mapping.json

# 限制扫描的最大键数（适用于大型Redis）
python3 -m redis_key_analyzer scan --max-keys 10000

# 指定输出目录
python3 -m redis_key_analyzer scan --output-dir ./my_reports
```

### 5. 从已保存的扫描文件进行离线分析

使用 `scan` 命令生成的 `*_raw_keys.json` 文件进行离线分析：

```bash
# 使用 scan 生成的原始键列表文件
python3 -m redis_key_analyzer analyze redis_key_analyzer/reports/redis_scan_xxx_raw_keys.json

# 使用自定义Owner映射重新分析（无需重新扫描Redis）
python3 -m redis_key_analyzer analyze redis_key_analyzer/reports/redis_scan_xxx_raw_keys.json \
    --owner-mapping new_mapping.json \
    --output new_analysis
```

### 原始键列表 JSON 格式

`*_raw_keys.json` 文件格式如下，可被 `load_from_file` 正确读取：

```json
[
    {
        "key": "user:1001:profile",
        "ttl": "PERMANENT",
        "ttl_seconds": null,
        "memory_bytes": 2048,
        "key_type": "string",
        "prefix": "user:1001",
        "has_expiry": false,
        "scan_timestamp": "2026-05-17T10:30:00.000000"
    },
    ...
]
```

## 输出报告说明

报告生成在 `redis_key_analyzer/reports/` 目录下，包含：

| 文件 | 格式 | 说明 |
|------|------|------|
| `*.json` | JSON | 完整的分析结果，包含摘要、前缀分析、坏记录 |
| `*.csv` | CSV | 分析摘要和前缀详情，适合导入Excel |
| `*.html` | HTML | 可视化报告，包含表格和统计信息 |

报告内容包括：
- 总键数量、总内存使用、永久键统计
- TTL分布统计
- 键类型分布统计
- Top N内存占用前缀分析
- 坏记录列表（处理失败的键）

## TTL分类说明

| 分类 | 说明 |
|------|------|
| PERMANENT | 永久键（无过期时间） |
| NOT_FOUND | 键不存在 |
| TTL_1H | 剩余时间 < 1小时 |
| TTL_1D | 剩余时间 < 1天 |
| TTL_1W | 剩余时间 < 1周 |
| TTL_1M | 剩余时间 < 1个月 |
| TTL_LONG | 剩余时间 >= 1个月 |

## 命令行工具说明

所有命令都可以通过 `python3 -m redis_key_analyzer <command> --help` 查看详细帮助。

如果配置了PATH环境变量，也可以直接使用 `redis-key-analyzer` 命令。

## 注意事项

1. 扫描大型Redis实例时，建议使用 `--max-keys` 参数限制扫描数量
2. 扫描过程中Redis性能可能会略有下降，建议在低峰期执行
3. 密码参数会在命令行中显示，生产环境建议使用环境变量或配置文件

## 项目状态

✅ 核心功能完整可用
✅ 命令行接口已接通
✅ 样例数据已提供，可直接体验流程
✅ 所有报告格式均可正常生成
