# 客服敏感话术抽检 CLI (CSQC)

围绕质检团队从客服会话中抽检敏感话术、承诺赔付和未闭环问题的完整工作流。

## 功能特性

- **init**: 初始化项目和SQLite数据库
- **import**: 导入会话、客服名单、敏感规则、赔付政策
- **check**: 扫描敏感话术，处理多次命中、转人工归属、幂等性
- **detail**: 查看扫描详情、命中详情、历史记录
- **report**: 生成复核统计、未闭环问题、处理建议
- **review**: 人工复核，标记误报/确认违规/修正，记录差异和操作者

## 本地启动

```bash
# 1. 安装依赖
pip install click rich

# 2. 安装项目（可选，或直接用 python -m csqc）
pip install -e .

# 3. 查看帮助
csqc --help
# 或
python -m csqc --help
```

## 造数（内置样例）

样例数据覆盖4类典型场景：

| 会话ID | 场景类型 | 客服 | 问题说明 |
|--------|----------|------|----------|
| S001 | 退款承诺 | 李咨询(A002) | 承诺全额退款，未核查条件 |
| S002 | 违规保证(赔付) | 赵安抚(A004) | 承诺现金补偿，违反政策 |
| S003 | 违规保证(绝对化) | 王解答(A003) | 100%保证、绝对、肯定 |
| S004 | 情绪安抚+转人工 | 张客服(A001) | 用户生气，转人工，责任归属 |
| S005 | 正常解释(无命中) | 李咨询(A002) | 正常发票咨询，正常流程 |
| S006 | 违规保证(过期承诺) | 王解答(A003) | 永久、终身、永不收费 |

## 完整演示路径

### 第一步：初始化项目

```bash
# 创建工作目录
mkdir my_audit
cd my_audit

# 初始化项目
csqc init
# 或 python -m csqc init

# 查看项目结构
ls -la
```

### 第二步：导入样例数据

```bash
# 一键导入所有样例数据
csqc import all --sample
# 或分开导入：
# csqc import agents --sample
# csqc import rules --sample
# csqc import policies --sample
# csqc import sessions --sample
```

### 第三步：扫描敏感话术

```bash
# 首次扫描
csqc check

# 查看扫描结果，记录返回的 scan_id
```

观察要点：
- 系统会扫描所有6个会话
- S001命中：退款承诺（全额退款）
- S002命中：违规保证（补偿）+ 情绪安抚（生气、骗人）
- S003命中：绝对保证（肯定、100%、绝对、保证）
- S004命中：情绪安抚（生气）+ 转人工（请稍候）
- S005无命中（正常解释）
- S006命中：过期承诺（永久、终身、永不）
- 注意转人工场景的责任归属

### 第四步：查看详情

```bash
# 查看扫描历史
csqc detail --history

# 查看某次扫描详情（用上面返回的scan_id，比如1）
csqc detail --scan-id 1

# 查看单个命中详情（hit_id从上面获得，比如1）
csqc detail --hit-id 1
```

观察要点：
- 上下文展示（context_before/context_after）
- 用户原话引用（user_quote）
- 转人工后的责任归属（transfer_to_agent）
- 多次命中在同一消息中被标记

### 第五步：人工复核

```bash
# 标记一条为误报
csqc review --hit-id 1 --decision false_positive --reviewer "质检主管" --comment "按退款政策第1条，质量问题可退款，不算违规" --yes

# 标记一条为确认违规
csqc review --hit-id 3 --decision confirmed --reviewer "质检主管" --comment "现金补偿违反政策第3条，上限100元" --yes

# 修正一条（记录前后差异）
csqc review --hit-id 5 --decision corrected --corrected-text "一般3-5天" --reviewer "质检主管" --comment "'肯定'是口语化，不构成绝对承诺" --yes
```

观察要点：
- 幂等性：再次执行完全相同的命令会被跳过
- 修正模式：会记录 original_hit_text → corrected_hit_text
- 所有复核记录都会保留 reviewer 和 created_at

### 第六步：查看复核历史

```bash
# 查看复核历史
csqc detail --review-history

# 查看某个命中的复核历史
csqc detail --hit-id 1
```

### 第七步：生成报告

```bash
# 生成简要报告
csqc report

# 生成完整报告（含按客服统计）
csqc report --full

# 导出为JSON
csqc report --output report.json
```

观察要点：
- 总览统计：会话数、客服数、活跃规则
- 扫描情况：扫描次数、命中会话数、总命中数
- 复核情况：已复核数、确认违规数、误报数、误报率
- 按规则统计：查看哪类问题高频
- 未闭环问题：列出未复核的记录
- 处理建议：基于统计的智能建议

### 第八步：幂等性验证

```bash
# 再次执行扫描（不重新扫描已扫描的会话）
csqc check

# 使用 --rescan 强制重新扫描（生成新的scan记录，但幂等性保持）
csqc check --rescan

# 再次执行相同的复核命令
csqc review --hit-id 1 --decision false_positive --reviewer "质检主管" --comment "按退款政策第1条，质量问题可退款，不算违规" --yes
# 会提示：幂等保护: 相同内容的复核记录已存在，跳过
```

## 失败路径演示

### 场景1：规则误报

```bash
# S003 中 "完全没问题" 被 GUARANTEE_001 命中
# 实际上这是正常口语，不算违规保证

# 操作：标记为误报
csqc review --hit-id 5 --decision false_positive --reviewer "质检主管" --comment "这是正常口语表达，不是绝对承诺" --yes
```

失败分析：
- 规则"GUARANTEE_001"包含"完全没问题"作为关键词
- 实际语境中这是客服信心表达，不是承诺
- 复核系统提供了误报标记功能，后续可优化规则

### 场景2：正常对话被误判

```bash
# 查看S005，它没有命中任何规则
csqc detail --session-id S005
```

成功分析：
- 发票咨询是正常业务
- 没有敏感承诺
- 没有负面情绪
- 没有未闭环
- 系统正确地没有标记

### 场景3：重复扫描的幂等性

```bash
# 第一次扫描
csqc check

# 第二次扫描（不指定--rescan）
csqc check
# 注意：已扫描的会话不会重复扫描

# 第三次扫描 + --rescan
csqc check --rescan
# 注意：这是一次新的扫描，但对同一消息同一规则的命中不会重复记录
```

幂等性保证：
- 未使用--rescan时，跳过已扫描会话
- 使用--rescan时，生成新scan_id，但相同(session, rule, message_index)的命中被标记为is_duplicate=1

### 场景4：转人工的责任归属

```bash
# 查看 S004 的命中详情
csqc detail --session-id S004

# 观察：
# - A001 说"请稍候"（转人工信号）
# - transfer_to_agent 指向 AS001
# - 系统会保留原始责任人 A001
```

责任归属逻辑：
- 触发转人工的客服是原始责任人（A001）
- 后续处理者是AS001，但问题发起者仍是A001
- 系统记录两者，便于追溯完整链路

## 核心设计决策

### 1. 幂等性处理

- 扫描幂等：已扫描会话（有last_scan_id）默认跳过
- 重新扫描幂等：同一会话+规则+消息索引，被标记为is_duplicate=1
- 复核幂等：同一hit_id+reviewer+decision+original_text+corrected_text，跳过

### 2. 责任归属

- 转人工场景：记录触发转人工的客服（原始责任人）和转接目标
- 便于追溯：谁发起了问题，谁接手处理

### 3. 用户原话引用

- 命中时自动查找近5条用户消息
- 提取包含相关关键词的用户原话
- 帮助质检理解上下文

### 4. 审计追踪

- 所有复核记录包含：
  - reviewer：操作人
  - created_at：操作时间
  - original_hit_text：原命中
  - corrected_hit_text：修正后（如有）
  - comment：备注

## 数据结构

### 会话 JSON 格式

```json
{
  "session_id": "S001",
  "customer_id": "C1001",
  "start_time": "2024-01-15 10:30:00",
  "end_time": "2024-01-15 10:45:00",
  "status": "closed",
  "messages": [
    {
      "sender": "user",
      "content": "我买的衣服质量有问题，要求退款",
      "time": "2024-01-15 10:30:00"
    },
    {
      "sender": "agent",
      "agent_id": "A002",
      "content": "您放心，我马上给您全额退款。",
      "time": "2024-01-15 10:32:00"
    }
  ]
}
```

### 规则 JSON 格式

```json
{
  "rule_id": "REFUND_001",
  "name": "退款承诺",
  "category": "退款承诺",
  "keywords": ["全额退款", "直接退款", "马上退款"],
  "severity": "high",
  "description": "客服承诺退款，需检查是否符合退款政策",
  "is_active": true
}
```

## 命令速查

| 命令 | 说明 |
|------|------|
| `csqc init` | 初始化项目 |
| `csqc init --force` | 强制重新初始化（会删除数据） |
| `csqc import all --sample` | 导入所有样例数据 |
| `csqc import sessions sessions.json` | 导入自定义会话 |
| `csqc check` | 扫描敏感话术 |
| `csqc check --rescan` | 强制重新扫描 |
| `csqc check --session-id S001` | 仅扫描指定会话 |
| `csqc detail --history` | 查看扫描历史 |
| `csqc detail --scan-id 1` | 查看某次扫描详情 |
| `csqc detail --hit-id 1` | 查看单个命中详情 |
| `csqc detail --session-id S001` | 查看某会话所有命中 |
| `csqc detail --review-history` | 查看复核历史 |
| `csqc report` | 生成报告 |
| `csqc report --full` | 完整报告（含客服统计） |
| `csqc report --output report.json` | 导出JSON |
| `csqc review --hit-id 1 --decision false_positive` | 标记误报 |
| `csqc review --hit-id 1 --decision confirmed` | 确认违规 |
| `csqc review --hit-id 1 --decision corrected --corrected-text "..."` | 修正命中 |

## 样例覆盖的场景

1. **退款承诺 (S001)**: 客服承诺"全额退款"
2. **赔付承诺 (S002)**: 客服承诺"50元现金补偿"
3. **绝对保证 (S003)**: "肯定"、"100%"、"绝对"
4. **情绪安抚 (S004)**: 用户"生气"，客服转人工
5. **正常解释 (S005)**: 正常发票咨询，无问题
6. **过期承诺 (S006)**: "永久有效"、"终身享受"、"永不收费"
