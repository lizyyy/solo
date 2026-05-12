# 远程设备指令审计 CLI 工具

## 项目简介

这是一个为运维人员设计的远程设备指令审计CLI工具，专门用于解决边缘设备批量下发配置时"半成功半失败却没人知道"的问题。

### 核心功能

- **审计指令参数**: 记录所有下发的指令内容和参数
- **审计设备响应**: 记录每个设备的执行结果和响应日志
- **审计失败重试**: 记录重试次数、失败原因和最终状态

### 核心规则

1. **危险指令需确认**: 执行危险操作前必须确认
2. **离线设备跳过**: 自动跳过离线设备，不影响整体进度
3. **同批次重复下发幂等**: 防止重复执行相同指令
4. **参数缺失检查**: 自动校验必需参数
5. **重试上限控制**: 防止无限重试
6. **重复执行幂等**: 已完成的批次不会重复执行
7. **人工修正审计**: 人工操作必须记录前后差异和操作者

## 快速开始

### 环境要求

- Python 3.6+
- 无需额外依赖（使用标准库）

### 本地启动

1. **初始化环境**

```bash
python3 device_audit_cli.py init
```

这将创建工作目录 `~/.device_audit/` 和 SQLite 数据库。

2. **导入样例数据**

```bash
python3 device_audit_cli.py import --examples
```

内置样例包含：
- **9个设备**: 3个网关、3个摄像头、3个传感器
- **5个分组**: 全部设备、网关、摄像头、传感器、机房A
- **5个指令模板**: 心跳检测、同步配置、重启、摄像头快照、读取传感器

3. **检查数据**

```bash
python3 device_audit_cli.py check
```

## 主要演示路径

### 路径一：完全成功流程

```bash
# 1. 查看指令模板详情
python3 device_audit_cli.py detail --template TPL-CAM-SNAPSHOT

# 2. 查看设备详情
python3 device_audit_cli.py detail --device CAM-001

# 3. 创建批次 (安全指令，无需确认)
python3 device_audit_cli.py create-batch \
  --template TPL-CAM-SNAPSHOT \
  --group GRP-CAM \
  --params '{"output_path": "/tmp/snapshot.jpg"}' \
  --operator "zhangsan"

# 4. 执行批次 (使用创建命令输出的批次ID)
python3 device_audit_cli.py run --batch <批次ID>

# 5. 查看批次详情
python3 device_audit_cli.py detail --batch <批次ID>

# 6. 生成审计报告
python3 device_audit_cli.py report --batch <批次ID>
```

**预期结果**: 所有在线摄像头设备执行成功，报告显示"完全成功，业务闭环"

### 路径二：失败路径（包含人工处理）

```bash
# 1. 查看危险指令
python3 device_audit_cli.py detail --template TPL-CONFIG-SYNC

# 2. 创建危险指令批次 (需要交互式确认)
python3 device_audit_cli.py create-batch \
  --template TPL-CONFIG-SYNC \
  --group GRP-ALL \
  --params '{"device_ip": "192.168.1.1"}' \
  --operator "admin"

# 3. 执行批次 (模拟部分失败，需要多次运行测试重试逻辑)
python3 device_audit_cli.py run --batch <批次ID>

# 4. 查看失败详情
python3 device_audit_cli.py detail --batch <批次ID>

# 5. 人工修正失败设备
python3 device_audit_cli.py manual-fix \
  --execution <执行记录ID> \
  --status manual \
  --reason "现场技术人员已手动配置" \
  --operator "on_site_tech"

# 6. 生成最终报告
python3 device_audit_cli.py report --batch <批次ID>
```

**预期结果**: 
- 离线设备被自动跳过
- 部分设备执行失败（随机模拟）
- 人工修正后状态变为 'manual'
- 报告显示"已记录人工处理，可视为闭环"

## 一键演示

```bash
python3 demo_flow.py
```

此脚本将自动运行完整的演示流程，包括：
1. 初始化环境
2. 导入样例数据
3. 数据检查
4. 成功路径演示（摄像头快照）
5. 失败路径演示（危险指令 + 离线设备 + 失败设备 + 人工修正）
6. 总体审计报告

## 命令详解

### init - 初始化环境

```bash
python3 device_audit_cli.py init
```

- 创建工作目录 `~/.device_audit/`
- 创建 SQLite 数据库 `audit.db`
- 初始化配置文件

### import - 导入数据

```bash
# 导入样例数据
python3 device_audit_cli.py import --examples

# 从文件导入
python3 device_audit_cli.py import --devices devices.json
python3 device_audit_cli.py import --groups groups.json
python3 device_audit_cli.py import --templates templates.json
```

### check - 数据检查

```bash
python3 device_audit_cli.py check
```

检查内容：
- 设备总数、在线/离线状态
- 分组数量
- 指令模板数量
- 离线设备列表
- 无IP地址设备
- 空分组
- 重复设备ID

### detail - 查看详情

```bash
# 查看设备详情
python3 device_audit_cli.py detail --device CAM-001

# 查看指令模板详情
python3 device_audit_cli.py detail --template TPL-PING

# 查看批次详情
python3 device_audit_cli.py detail --batch BATCH-xxx
```

### create-batch - 创建指令批次

```bash
python3 device_audit_cli.py create-batch \
  --template <模板ID> \
  [--devices <设备ID列表>] \
  [--group <分组ID>] \
  [--params '{"key": "value"}'] \
  [--operator <操作者>] \
  [--force]
```

**参数说明**:
- `--template`: 指令模板ID（必需）
- `--devices`: 目标设备ID列表，逗号分隔（与 group 二选一）
- `--group`: 目标分组ID（与 devices 二选一）
- `--params`: JSON格式的参数
- `--operator`: 操作者名称
- `--force`: 强制执行危险指令，跳过确认

**业务规则**:
1. 危险指令需要交互式确认（除非使用 --force）
2. 自动检查必需参数
3. 检查相同的待执行批次（幂等性）
4. 自动跳过离线设备（可配置）
5. 记录审计日志

### run - 执行批次

```bash
python3 device_audit_cli.py run --batch <批次ID>
```

**业务规则**:
1. 已完成的批次不会重复执行（幂等性）
2. 执行状态为 pending 或 failed 的设备
3. 检查最大重试次数
4. 记录每次执行的响应日志
5. 记录审计日志

### manual-fix - 人工修正

```bash
python3 device_audit_cli.py manual-fix \
  --execution <执行记录ID> \
  --status <新状态> \
  [--reason <修正原因>] \
  [--operator <操作者>] \
  [--force]
```

**状态选项**: success, failed, skipped, manual

**业务规则**:
1. 必须记录操作者
2. 必须记录修正原因
3. 必须记录状态前后差异（审计日志）
4. 需要交互式确认（除非使用 --force）

### report - 生成审计报告

```bash
# 总体报告
python3 device_audit_cli.py report

# 指定批次报告
python3 device_audit_cli.py report --batch <批次ID>
```

**报告内容**:
- 设备统计（总数、在线、离线）
- 批次统计
- 执行统计（成功、失败、跳过、待处理、人工处理）
- 失败设备详情（IP、类型、错误信息）
- 跳过设备详情（原因）
- 人工处理设备列表
- 审计日志（操作历史）
- **业务闭环检查**

## 业务闭环检查

报告末尾的"业务闭环检查"是核心功能，帮助运维人员快速判断：

| 状态 | 含义 | 建议动作 |
|------|------|----------|
| ✅ 完全成功，业务闭环 | 所有设备执行成功 | 无需操作 |
| ⚠️ 存在X个失败设备 | 部分设备失败，需要人工干预 | 使用 manual-fix 命令 |
| 👤 存在X个人工处理的设备 | 失败设备已人工处理 | 可视为闭环 |
| ⏳ 还有X个设备待执行 | 执行未完成 | 继续执行或检查设备 |

## 数据库结构

### 核心表

1. **devices**: 设备表
   - id, name, type, ip, status

2. **groups**: 分组表
   - id, name, description

3. **device_group_mapping**: 设备分组关联表
   - device_id, group_id

4. **command_templates**: 指令模板表
   - id, name, type, content, is_dangerous, params_json

5. **batches**: 批次表
   - id, command_template_id, params_json, status, created_by

6. **executions**: 执行记录表
   - id, batch_id, device_id, status, attempt_count, max_attempts, last_error, request_log, response_log

7. **audit_logs**: 审计日志表
   - id, batch_id, execution_id, device_id, action, before_data, after_data, operator, reason

## 配置文件

配置文件位置: `~/.device_audit/config.json`

```json
{
  "work_dir": "/Users/xxx/.device_audit",
  "max_retries": 3,
  "skip_offline": true,
  "idempotent_check": true
}
```

- `max_retries`: 最大重试次数（默认3）
- `skip_offline`: 是否跳过离线设备（默认true）
- `idempotent_check`: 是否启用幂等性检查（默认true）

## 数据格式示例

### 设备清单 (devices.json)

```json
[
  {
    "id": "GW-001",
    "name": "主网关-机房A",
    "type": "gateway",
    "ip": "192.168.1.1",
    "status": "online"
  }
]
```

### 分组 (groups.json)

```json
{
  "groups": [
    {
      "id": "GRP-GW",
      "name": "网关设备",
      "description": "网络网关设备",
      "devices": ["GW-001", "GW-002", "GW-003"]
    }
  ]
}
```

### 指令模板 (templates.json)

```json
[
  {
    "id": "TPL-PING",
    "name": "设备心跳检测",
    "type": "status",
    "content": "ping -c 3 {target_ip}",
    "is_dangerous": 0,
    "params": {
      "required": ["target_ip"]
    }
  }
]
```

## 常见问题

### Q: 如何重置数据？

```bash
rm -rf ~/.device_audit
python3 device_audit_cli.py init
python3 device_audit_cli.py import --examples
```

### Q: 危险指令有哪些？

内置的危险指令（is_dangerous = 1）:
- TPL-CONFIG-SYNC: 同步配置文件
- TPL-REBOOT: 重启设备

### Q: 如何添加自己的危险指令？

在导入的 templates.json 中设置 `"is_dangerous": 1`。

### Q: 执行记录如何手动标记为成功？

```bash
python3 device_audit_cli.py manual-fix \
  --execution <执行记录ID> \
  --status success \
  --reason "问题已排查，确认执行成功" \
  --operator "your_name"
```

## 工作流程总结

```
init → import → check → create-batch → run → detail → report
                                    ↓
                              如有失败
                                    ↓
                              manual-fix
                                    ↓
                              report (最终确认闭环)
```

这个工具确保了：
- 每个操作都有审计日志
- 危险操作有确认机制
- 离线设备不影响整体进度
- 失败设备可追踪、可重试
- 人工操作有记录、可追溯
- 最终报告会告诉你业务是否真的闭环
