# DC Change Preview

数据中心变更预演 CLI 工具。在正式变更前模拟上架/迁移/下架步骤，校验 U 位冲突、回路余量、双电源同路、端口/VLAN 不匹配等问题。

## 功能特性

- **U 位冲突检测**: 检查目标机柜的 U 位是否已被占用
- **PDU 回路余量校验**: 验证设备接入的电路是否有足够余量
- **双电源同路检测**: 检测双电源设备是否连接到同一回路
- **端口/VLAN 匹配检查**: 验证端口和 VLAN 配置是否一致
- **引用设备存在性校验**: 确保变更步骤引用的设备实际存在
- **端口释放检测**: 迁移后旧端口是否正确释放

## 安装

```bash
cd dc_change_preview
pip install -e .
```

## 输入文件格式

### 机柜资产 CSV (rack_assets.csv)

```csv
device_id,name,device_type,rack_id,u_start,u_end,power_circuits,primary_switch_port,secondary_switch_port,status
srv-001,Web Server 1,server,RACK-A01,1,2,circuit-A1;circuit-B1,port-001,,online
```

### PDU 回路 JSON (pdu_circuits.json)

```json
{
  "pdus": [
    {
      "pdu_id": "PDU-A01",
      "rack_id": "RACK-A01",
      "circuits": [
        {"circuit_id": "circuit-A1", "phase": "A", "max_amps": 20.0, "used_amps": 8.0}
      ]
    }
  ]
}
```

### 交换机端口 CSV (switch_ports.csv)

```csv
port_id,switch_id,port_name,vlan,status,connected_device_id
port-001,sw-001,Gi0/1,vlan100,occupied,srv-001
```

### 变更计划 YAML (change_plan.yaml)

```yaml
plan_id: PLAN-2024-001
description: 变更计划描述

steps:
  - step_id: STEP-001
    change_type: add
    device_id: srv-001
    target_rack_id: RACK-A01
    target_u_start: 10
    target_u_end: 11
    target_switch_port: port-005
    target_vlan: vlan100
    notes: 新增服务器
```

change_type 支持: `add`, `remove`, `move`

## 使用方法

### 方式一：指定单个文件

```bash
dc-preview preview \
  --assets rack_assets.csv \
  --pdu pdu_circuits.json \
  --ports switch_ports.csv \
  --plan change_plan.yaml \
  --output out
```

### 方式二：指定数据目录（使用默认文件名）

```bash
dc-preview preview --data-dir ./sample --output out
```

### 验证输入文件

```bash
dc-preview validate --data-dir ./sample
```

## 输出文件

运行后会在 `--output` 目录生成以下文件：

| 文件 | 说明 |
|------|------|
| `risk_report.csv` | 所有风险问题列表 |
| `executable_steps.md` | 可执行的变更步骤 |
| `rollback_suggestions.md` | 回滚建议 |
| `summary.json` | 执行摘要 |

## 样例数据

`sample/` 目录包含完整的测试数据：

- `rack_assets.csv` - 10 台设备
- `pdu_circuits.json` - 5 个 PDU
- `switch_ports.csv` - 20 个端口
- `change_plan.yaml` - 6 个变更步骤（含边界场景）

## Demo 命令

```bash
cd dc_change_preview
pip install -e .

dc-preview preview --data-dir ./sample --output out

echo "=== Risk Report ===" && cat out/risk_report.csv
echo "" && echo "=== Executable Steps ===" && cat out/executable_steps.md
echo "" && echo "=== Rollback Suggestions ===" && cat out/rollback_suggestions.md
```

## 项目结构

```
dc_change_preview/
├── src/dc_change_preview/
│   ├── __init__.py
│   ├── models.py          # 数据模型
│   ├── csv_reader.py       # CSV 读取器
│   ├── json_reader.py      # JSON 读取器
│   ├── yaml_reader.py      # YAML 读取器
│   ├── readers.py          # 读取器统一导出
│   ├── rule_engine.py      # 规则引擎
│   ├── simulator.py        # 变更模拟器
│   ├── reporter.py         # 报告生成器
│   └── cli.py              # CLI 接口
├── sample/                  # 样例数据
├── tests/                   # 单元测试
├── pyproject.toml
├── setup.py
└── README.md
```
