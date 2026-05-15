# 目录权限漂移检测工具 (dir-perm-cli)

检测权限审批流程中的"空值被误判为成功"的经典漂移场景。

## 功能特性

- 检测审批节点空值被标记为已批准的权限漂移
- 检测权限目标路径为空但申请原因已填写的异常
- 支持重复提交检测和跨批次冲突提示
- 本地持久化存储，重启后数据不丢失
- 导出结果包含会议纪要附件的修正前后值
- 支持按审批节点回查相关提交记录

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 查看可用样例

```bash
python main.py samples
```

### 3. 提交正常材料进行检测

```bash
python main.py submit samples/normal_material.json \
  --batch-id BATCH-2026-001 \
  --title "高峰门店5月常规权限申请" \
  --department "零售运营部" \
  --submitter "张三"
```

### 4. 提交坏材料（触发空值陷阱检测）

```bash
python main.py submit samples/bad_material_null_trap.json \
  --batch-id BATCH-2026-001 \
  --title "高峰门店紧急权限申请(含空值)" \
  --department "零售运营部" \
  --submitter "李四"
```

## 主要命令

### submit - 提交材料检测
```bash
python main.py submit <文件路径> --batch-id <批次ID> --title <标题> --department <部门> --submitter <提交人>
```

### list - 列出所有提交记录
```bash
python main.py list
python main.py list --batch-id BATCH-2026-001  # 按批次筛选
```

### show - 查看单个提交详情
```bash
python main.py show <提交ID>
```

### export - 导出检测结果
```bash
python main.py export -o results.json
python main.py export --batch-id BATCH-2026-001 -o results.json
```

### query-node - 按审批节点回查
```bash
python main.py query-node --node-id N001
python main.py query-node --node-name "门店经理"
python main.py query-node --batch-id BATCH-2026-001
```

### samples - 列出可用样例
```bash
python main.py samples
```

## 样例说明

### normal_material.json - 正常材料
- 3个完整的权限项（收银机01、收银机02、库存查询终端）
- 3个审批节点，审批人、时间、意见均完整
- 1个会议纪要附件，包含修改前后对比
- 预期检测结果：全部通过

### bad_material_null_trap.json - 坏材料（空值陷阱）
- 3个权限项，其中2个权限目标路径为空（但申请原因已填写）
- 3个审批节点，其中2个节点状态标记为"已批准"，但审批人、时间、意见均为空值
- 1个会议纪要附件，修改说明为空
- 预期检测结果：空值成功陷阱检测失败，发现权限漂移风险

## 检测规则

| 规则ID | 检测项 | 说明 |
|--------|--------|------|
| R001 | 必填字段校验 | 检查权限项必填字段是否缺失 |
| R002 | 权限路径格式校验 | 检查权限目标路径格式 |
| R003 | 审批链完整性校验 | 检查已批准节点是否缺少审批人或时间 |
| R004 | 空值成功陷阱检测 | 检测状态为已批准但所有字段为空的节点，以及权限路径为空但申请原因已填写的项 |
| R005 | 会议纪要一致性校验 | 检查会议纪要附件的修改说明是否完整 |

## 核心原理

"空值被误判为成功"是最经典的权限漂移场景之一：

1. **审批节点空值陷阱**：审批状态标记为"已批准"，但审批人、审批时间、审批意见均为空。这种情况通常是审批流程的BUG，导致未实际审批的请求被误判为已通过。

2. **权限路径空值陷阱**：权限申请的目标路径为空，但申请原因已填写。这种情况下，系统可能会默认授予根目录或全部目录访问权限，造成权限溢出。

本工具通过材料哈希实现重复提交检测，使用 TinyDB 进行本地持久化，确保处理结论和材料摘要在本地重启后仍然可查。
