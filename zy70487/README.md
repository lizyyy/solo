# 消息积压分层命令行工具

基于临时权限临时票的消息积压分层处理系统，支持状态提前结束拦截、批量处理预览、多维度历史查询及人工复核追踪。

## 功能特性

- **临时权限票管理**：支持创建临时权限票，控制处理权限有效期
- **智能拦截规则**：6条内置拦截规则，重点支持状态提前结束拦截
- **批量处理预览**：处理前可预览影响范围，确认后再执行
- **部分成功处理**：遇到部分成功时，不整批标记成功，保留每条明细
- **多维度查询过滤**：支持按批次、操作者、风险类型过滤历史记录
- **人工复核追踪**：复核不直接覆盖结论，关联客服工单原始记录

## 安装

```bash
npm install
npm run build
npm link
```

## 使用说明

### 1. 创建临时权限票

创建一个即将在12小时后过期的临时票（用于测试状态提前结束拦截）：

```bash
backlog ticket:create \
  -n "TICKET-2024-001" \
  -a "张经理" \
  -d "RISK_CONTROL" \
  -p "批量处理权限" \
  -r "日常积压消息处理" \
  -s "2024-01-16T00:00:00" \
  -e "2024-01-16T12:00:00" \
  -c "管理员"
```

保存输出中的 ticket ID，后续步骤需要使用。

### 2. 导入批次数据

```bash
# 导入正常批次
backlog batch:import \
  -f test-data/normal-batch.json \
  -n "BATCH-NORMAL-001" \
  -m "日常咨询处理批次" \
  -o "李专员" \
  -t "<上一步得到的ticket-id>"

# 导入包含拦截记录的批次
backlog batch:import \
  -f test-data/blocked-batch.json \
  -n "BATCH-BLOCKED-001" \
  -m "混合风险处理批次" \
  -o "王专员" \
  -t "<上一步得到的ticket-id>"
```

### 3. 预览批次处理结果

```bash
backlog batch:preview -i "<batch-id>"
```

### 4. 执行批次处理

```bash
# 带确认提示
backlog batch:process -i "<batch-id>"

# 跳过确认直接执行
backlog batch:process -i "<batch-id>" -y
```

### 5. 查询记录

```bash
# 查询所有记录
backlog record:query

# 按批次过滤
backlog record:query -b "<batch-id>"

# 按风险类型过滤
backlog record:query -r "HIGH"

# 按操作人过滤
backlog record:query -o "王专员"

# 按状态过滤
backlog record:query -s "EARLY_TERMINATION_BLOCKED"

# 组合过滤
backlog record:query -b "<batch-id>" -r "HIGH" -o "王专员"
```

### 6. 查看记录详情

```bash
backlog record:detail -i "<record-id>"
```

### 7. 人工复核记录

```bash
backlog record:review \
  -i "<record-id>" \
  -r "风控主管" \
  -o "经核实，该用户为误判，已解除风控" \
  -t "CS-2024-00123" \
  -c "SUCCESS"
```

### 8. 列出所有批次

```bash
backlog batch:list
```

## 拦截规则说明

| 规则ID | 规则名称 | 触发条件 | 说明 |
|--------|----------|----------|------|
| rule-001 | 高风险直接拦截 | riskType = HIGH | 高风险消息必须人工复核 |
| rule-002 | 风险分超标拦截 | riskScore >= 80 | 高评分需人工审核 |
| rule-003 | **状态提前结束拦截** | 临时票距到期不足24小时且记录为PENDING状态 | **重点拦截规则**，防止权限到期前提前结束 |
| rule-004 | 敏感内容拦截 | 内容包含：投诉、举报、违规、欺诈、报警、维权、赔偿、起诉 | 敏感关键词拦截 |
| rule-005 | 身份证格式异常拦截 | 身份证号不符合18位标准格式 | 身份信息核验 |
| rule-006 | 手机号黑名单拦截 | 手机号在预设黑名单中（13800138000） | 历史高风险号码 |

## 测试数据说明

- **normal-batch.json**：5条正常材料，均能通过处理
- **blocked-batch.json**：5条记录，包含3条会被拦截的坏材料：
  - 郑十：HIGH风险 + 风险分88分 + 黑名单手机号（13800138000）→ 多重拦截
  - 冯十一：内容包含"投诉"关键词 → 敏感内容拦截
  - 陈十二：身份证格式错误（17位）→ 格式异常拦截

## 项目结构

```
.
├── src/
│   ├── cli.ts          # 命令行入口
│   ├── processor.ts    # 核心业务逻辑
│   ├── blockRules.ts   # 拦截规则定义
│   ├── database.ts     # 数据持久层
│   └── types.ts        # 类型定义
├── test-data/
│   ├── normal-batch.json
│   └── blocked-batch.json
├── data/               # 运行时数据目录（自动创建）
├── package.json
├── tsconfig.json
└── README.md
```
