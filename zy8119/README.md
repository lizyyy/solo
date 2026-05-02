# 临时园区离线门禁控制器权限包签发工具

一个用于给临时园区的离线门禁控制器签发权限包的 Python CLI 工具。

## 功能特性

- **解析模块**: 解析人员 CSV、门区规则 YAML、设备时钟 JSONL、权限申请 CSV
- **规则引擎**: 
  - 权限时间窗校验
  - 互斥门区检测
  - 设备时钟漂移校验
  - 角色权限校验
  - 撤权后重发警告
- **签发模块**: 
  - HMAC-SHA256 签名
  - 设备权限包生成
  - 权限包完整性验证
- **报告模块**: 
  - 生成审计报告 (audit_report.md)
  - 生成违规记录 (violations.csv)

## 目录结构

```
access_gate_cli/
├── __init__.py
├── parser/                 # 解析模块
│   ├── __init__.py
│   ├── csv_parser.py       # CSV 文件解析
│   ├── yaml_parser.py      # YAML 文件解析
│   └── jsonl_parser.py     # JSONL 文件解析
├── rules/                  # 规则引擎模块
│   ├── __init__.py
│   └── engine.py           # 规则验证逻辑
├── issuer/                 # 签发模块
│   ├── __init__.py
│   └── package_generator.py # 权限包生成和签名
├── reporter/               # 报告模块
│   ├── __init__.py
│   └── report_generator.py # 审计报告生成
└── cli/                    # CLI 入口
    ├── __init__.py
    └── main.py             # 命令行主程序

samples/                    # 示例数据
├── personnel.csv           # 人员信息
├── zone_rules.yaml         # 门区规则和设备配置
├── device_clock.jsonl      # 设备时钟数据
└── access_requests.csv     # 权限申请

tests/                      # 测试用例
├── __init__.py
├── test_parser.py          # 解析器测试
├── test_rules.py           # 规则引擎测试
└── test_issuer.py          # 签发模块测试

output/                     # 输出目录 (运行后生成)
├── device_packages/        # 设备权限包
│   ├── DEV001.json
│   ├── DEV002.json
│   └── ...
├── audit_report.md         # 审计报告
└── violations.csv          # 违规记录
```

## 安装依赖

```bash
pip install pyyaml pytest
```

或者使用 requirements.txt (如果需要创建):

```bash
pip install -r requirements.txt
```

## 快速开始

### 运行 Demo

使用示例数据运行工具：

```bash
python -m access_gate_cli \
    --personnel samples/personnel.csv \
    --zone-rules samples/zone_rules.yaml \
    --device-clock samples/device_clock.jsonl \
    --access-requests samples/access_requests.csv \
    --output-dir ./output
```

或者使用短参数：

```bash
python -m access_gate_cli \
    -p samples/personnel.csv \
    -z samples/zone_rules.yaml \
    -c samples/device_clock.jsonl \
    -r samples/access_requests.csv \
    -o ./output
```

### 预期输出

运行后会在 `./output` 目录生成：

```
output/
├── device_packages/
│   ├── DEV001.json    # 主大门控制器权限包
│   ├── DEV002.json    # 设备机房控制器权限包
│   ├── DEV003.json    # 数据中心控制器权限包
│   └── DEV004.json    # 行政办公区控制器权限包
├── audit_report.md     # 详细审计报告
└── violations.csv      # 违规记录汇总
```

控制台输出示例：

```
======================================================================
临时园区离线门禁控制器权限包签发工具
======================================================================

[步骤 1/5] 解析输入文件...
  ✓ 读取人员信息: 6 条记录
  ✓ 读取门区规则: 4 个门区, 4 台设备
  ✓ 读取设备时钟: 4 台设备
  ✓ 读取权限申请: 12 条申请

[步骤 2/5] 规则引擎验证...
  ⚠ 发现违规: X 项违规, X 项警告

[步骤 3/5] 生成设备权限包...
  ✓ 生成权限包: DEV001.json (X 条权限)
  ✓ 生成权限包: DEV002.json (X 条权限)
  ...

[步骤 4/5] 验证生成的权限包...
  ✓ HMAC 签名验证: DEV001
  ✓ HMAC 签名验证: DEV002
  ...

[步骤 5/5] 生成审计报告...
  ✓ 生成审计报告: audit_report.md
  ✓ 生成违规记录: violations.csv

======================================================================
执行完成!
======================================================================

输出目录: /path/to/output

权限包数量: X
违规数量: X (BLOCKING)
警告数量: X (NON-BLOCKING)

成功生成的权限包:
  - device_packages/DEV001.json (X 条权限)
  ...

检测到的违规 (需要关注):
  1. [HIGH] Zone '设备机房' and '数据中心' are mutually exclusive...
  2. [HIGH] Role 'visitor' not allowed in zone '设备机房'...
  ...
```

## 输入文件格式

### 1. 人员信息 (personnel.csv)

```csv
personnel_id,name,department,card_id,role
P001,张三,工程部,CARD001,engineer
P002,李四,安保部,CARD002,security
```

字段说明：
- `personnel_id`: 人员唯一标识
- `name`: 姓名
- `department`: 部门
- `card_id`: 门禁卡号
- `role`: 角色 (engineer/security/admin/visitor)

### 2. 门区规则 (zone_rules.yaml)

```yaml
zones:
  - zone_id: Z001
    zone_name: 主大门
    device_ids:
      - DEV001
    allowed_roles:
      - engineer
      - security
      - admin
      - visitor
    time_windows:
      - start_time: "08:00"
        end_time: "20:00"
        days: [0, 1, 2, 3, 4, 5, 6]  # 0=周一, 6=周日
    mutex_zones: []  # 互斥门区列表

devices:
  - device_id: DEV001
    device_name: 主大门控制器
    location: 园区正门
    hmac_key: "secret_key_dev001_2024"
    clock_drift_threshold_seconds: 300  # 时钟漂移阈值(秒)
```

### 3. 设备时钟 (device_clock.jsonl)

每行一个 JSON 对象：

```jsonl
{"device_id": "DEV001", "device_time": "2024-05-15 10:00:00", "server_time": "2024-05-15 10:00:00", "drift_seconds": 0.0}
{"device_id": "DEV002", "device_time": "2024-05-15 10:02:30", "server_time": "2024-05-15 10:00:00", "drift_seconds": 150.0}
```

字段说明：
- `device_id`: 设备 ID
- `device_time`: 设备本地时间
- `server_time`: 服务器参考时间
- `drift_seconds`: 漂移秒数 (设备时间 - 服务器时间)

### 4. 权限申请 (access_requests.csv)

```csv
request_id,personnel_id,zone_id,start_time,end_time,request_type,priority
REQ001,P001,Z001,2024-05-15 09:00:00,2024-05-15 18:00:00,grant,0
REQ002,P001,Z001,2024-05-15 10:00:00,2024-05-15 12:00:00,revoke,0
```

字段说明：
- `request_id`: 申请唯一标识
- `personnel_id`: 人员 ID
- `zone_id`: 门区 ID
- `start_time`: 权限开始时间
- `end_time`: 权限结束时间
- `request_type`: 申请类型 (grant=授权, revoke=撤权)
- `priority`: 优先级

## 规则校验说明

### 1. 时间窗校验 (Time Window Validation)

检查权限申请的时间是否在门区允许的时间窗口内。

示例：
- 门区允许时间: 08:00 - 20:00
- 申请时间: 21:00 - 22:00 → **违规**

### 2. 互斥门区检测 (Mutex Zone Detection)

检查是否同时申请了互斥的门区权限。

示例：
- Z002 (设备机房) 和 Z003 (数据中心) 互斥
- 同时申请这两个门区且时间重叠 → **违规**

### 3. 时钟漂移校验 (Clock Drift Validation)

检查设备时钟与服务器时间的偏差是否超过阈值。

示例：
- 阈值: 120 秒
- 实际漂移: 180 秒 → **违规**

### 4. 角色权限校验 (Role Permission Validation)

检查人员角色是否被允许访问该门区。

示例：
- 门区只允许: engineer, admin
- 申请角色: visitor → **违规**

### 5. 撤权后重发警告 (Revoke Reissue Warning)

检测人员在被撤权后重新申请同一门区权限。

这是警告级别，不会阻止申请，但会记录在案。

## 权限包格式

生成的设备权限包是 JSON 格式：

```json
{
  "version": "1.0.0",
  "device_id": "DEV001",
  "generated_at": "2024-05-15T10:00:00",
  "access_entries": [
    {
      "personnel_id": "P001",
      "name": "张三",
      "card_id": "CARD001",
      "role": "engineer",
      "zone_id": "Z001",
      "access_type": "grant",
      "start_time": "2024-05-15T09:00:00",
      "end_time": "2024-05-15T18:00:00",
      "request_id": "REQ001",
      "priority": 0
    }
  ],
  "package_hash": "a1b2c3d4...",
  "hmac_signature": "e5f6a7b8..."
}
```

### HMAC 签名验证流程

门禁控制器加载权限包时的验证步骤：

1. **计算包哈希**: 对除 `hmac_signature` 和 `package_hash` 外的所有字段的 JSON 字符串计算 SHA256 哈希
2. **验证哈希**: 比较计算出的哈希与 `package_hash` 字段是否一致
3. **生成签名数据**: 将 JSON 字符串 + 包哈希拼接
4. **验证 HMAC**: 使用设备专属密钥计算 HMAC-SHA256，与 `hmac_signature` 比较

## 运行测试

```bash
pytest tests/ -v
```

或者运行特定测试文件：

```bash
pytest tests/test_parser.py -v
pytest tests/test_rules.py -v
pytest tests/test_issuer.py -v
```

## 违规类型说明

| 违规类型 | 严重程度 | 说明 |
|---------|---------|------|
| `time_window_violation` | HIGH | 权限时间不在门区允许的时间窗内 |
| `mutex_zone_violation` | HIGH | 同时拥有互斥门区的权限 |
| `clock_drift_violation` | MEDIUM/HIGH | 设备时钟漂移超过阈值 |
| `role_not_allowed` | HIGH | 人员角色不允许访问该门区 |
| `invalid_time_range` | HIGH | 开始时间晚于结束时间 |
| `revoke_reissue_warning` | MEDIUM | 被撤权后重新申请同一门区 |
| `missing_personnel` | HIGH | 申请中的人员 ID 不存在 |
| `missing_zone` | HIGH | 申请中的门区 ID 不存在 |
| `missing_device` | MEDIUM | 设备缺少时钟数据 |
| `invalid_request_type` | HIGH | 无效的申请类型 |

严重程度说明：
- `CRITICAL`: 紧急问题，必须立即处理
- `HIGH`: 高风险，阻止申请通过
- `MEDIUM`: 中等风险，警告但不阻止
- `LOW`: 低风险，仅记录

## 命令行参数

```
usage: access_gate_cli [-h] --personnel PERSONNEL --zone-rules ZONE_RULES
                       --device-clock DEVICE_CLOCK --access-requests ACCESS_REQUESTS
                       [--output-dir OUTPUT_DIR] [--version]

临时园区离线门禁控制器权限包签发工具

optional arguments:
  -h, --help            show this help message and exit
  --personnel PERSONNEL, -p PERSONNEL
                        人员信息 CSV 文件路径
  --zone-rules ZONE_RULES, -z ZONE_RULES
                        门区规则 YAML 文件路径
  --device-clock DEVICE_CLOCK, -c DEVICE_CLOCK
                        设备时钟 JSONL 文件路径
  --access-requests ACCESS_REQUESTS, -r ACCESS_REQUESTS
                        权限申请 CSV 文件路径
  --output-dir OUTPUT_DIR, -o OUTPUT_DIR
                        输出目录路径 (默认: ./output)
  --version, -v         show program's version number and exit
```

## 示例数据说明

示例数据 `samples/` 目录包含以下场景：

**人员**:
- P001 张三 (engineer) - 会触发互斥门区违规
- P002 李四 (security) - 正常申请
- P003 王五 (admin) - 正常申请
- P004 赵六 (visitor) - 会触发角色不允许违规
- P005 钱七 (engineer) - 会触发撤权后重发警告
- P006 孙八 (visitor) - 未申请

**门区**:
- Z001 主大门 - 允许所有角色，时间 08:00-20:00
- Z002 设备机房 - 仅 engineer/admin，与 Z003 互斥
- Z003 数据中心 - 仅 engineer/admin，与 Z002 互斥
- Z004 行政办公区 - 仅 admin/security

**设备时钟**:
- DEV003 数据中心控制器 - 漂移 180 秒 (超过阈值 120 秒) → 时钟漂移违规

**权限申请设计的违规场景**:
1. REQ005 + REQ006: P001 同时申请 Z002 和 Z003 (时间重叠) → **互斥门区违规**
2. REQ007: P004 (visitor) 申请 Z002 → **角色不允许违规**
3. REQ008: P001 (engineer) 申请 Z004 (仅 admin/security) → **角色不允许违规**
4. REQ009: 时间 21:00-22:00 申请 Z001 (允许 08:00-20:00) → **时间窗违规**
5. REQ011 + REQ012: 先撤销再重新授予 → **撤权后重发警告**
6. DEV003 时钟漂移 → **时钟漂移违规**

运行 demo 后可以在 `output/violations.csv` 和 `output/audit_report.md` 中看到这些违规的详细信息。

## 注意事项

1. **HMAC 密钥安全**: 生产环境中，设备的 HMAC 密钥应该妥善保管，不应明文存储在配置文件中
2. **时间同步**: 建议定期同步设备时钟，避免时钟漂移问题
3. **离线部署**: 权限包生成后需要通过 U 盘或其他离线方式传输到门禁控制器
4. **权限撤销**: 离线门禁控制器需要特殊处理权限撤销，建议在新的权限包中包含撤销指令

## License

MIT License
