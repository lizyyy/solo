# 地下车站调度系统 - 社群运营操作指南

## 一、玩家反馈样例怎么放

### 1.1 反馈样例目录结构
```
./feedback/
  ├── ACT_MAY_2026/           # 按活动ID分目录
  │   ├── P001_screenshot.png  # 玩家截图，命名规则：玩家ID_描述.png
  │   ├── P001_chat.jpg        # 与玩家的聊天记录
  │   ├── P002_screenshot.png
  │   └── feedback_log.csv     # 反馈汇总表（导入系统用）
  └── attachments/             # 通用附件目录
```

### 1.2 反馈汇总表格式 (feedback_log.csv)
CSV文件需要包含以下字段：

| 字段 | 必填 | 说明 | 示例 |
|------|------|------|------|
| player_id | 是 | 玩家ID | P001 |
| activity_id | 是 | 活动ID | ACT_MAY_2026 |
| task_id | 是 | 任务ID | TASK_001 |
| completion_time | 是 | 完成时间(ISO格式) | 2026-05-20T10:30:00 |
| reward_amount | 是 | 应发奖励金额 | 50.0 |
| source | 是 | 数据来源 | app/web/customer_service |
| attachment_path | 否 | 附件路径 | ./feedback/ACT_MAY_2026/P001_screenshot.png |
| raw_data | 否 | 原始数据(JSON格式) | {"channel":"wechat"} |

### 1.3 导入命令
```bash
# 批量导入玩家反馈记录
python3 cli.py batch --input ./feedback/ACT_MAY_2026/feedback_log.csv

# 指定活动截止时间（晚于这个时间的记录会标记为"晚到"）
python3 cli.py batch --input ./feedback/ACT_MAY_2026/feedback_log.csv \
  --deadline 2026-05-22T23:59:59 \
  --operator 客服_小王
```

### 1.4 样例数据
```csv
player_id,activity_id,task_id,completion_time,reward_amount,source,attachment_path
P001,ACT_MAY_2026,TASK_001,2026-05-20T10:30:00,50.0,customer_service,./feedback/ACT_MAY_2026/P001_screenshot.png
P002,ACT_MAY_2026,TASK_001,2026-05-20T11:00:00,50.0,customer_service,./feedback/ACT_MAY_2026/P002_screenshot.png
```

---

## 二、去哪看奖励漏发

### 2.1 查看所有漏发记录
```bash
python3 cli.py missed
```

输出示例：
```
══════════════ 漏发奖励列表 ══════════════
记录ID: ACT_MAY_TASK_001_P003_abc123
  玩家: P003
  活动: ACT_MAY_2026 / 任务: TASK_001
  应发奖励: 100.0
  完成时间: 2026-05-20 14:00:00
  异常描述: 奖励漏发: 支付系统超时
```

### 2.2 标记一条记录为漏发
```bash
python3 cli.py missed --mark ACT_MAY_TASK_001_P003_abc123 \
  --reason "玩家反馈未到账，核实后确认漏发" \
  --operator 客服_小王
```

### 2.3 补发后标记为已发奖
```bash
python3 cli.py missed --mark-sent ACT_MAY_TASK_001_P003_abc123 \
  --operator 财务_小李
```

### 2.4 查看记录详细状态时间线
当玩家有疑问时，用这条命令查看完整处理历史：
```bash
python3 cli.py timeline --record-id ACT_MAY_TASK_001_P003_abc123
```

输出示例：
```
══════════════ 记录状态回看 ══════════════
记录ID: ACT_MAY_TASK_001_P003_abc123
玩家ID: P003
活动ID: ACT_MAY_2026
任务ID: TASK_001
完成时间: 2026-05-20 14:00:00
奖励金额: 100.0
当前状态: 漏发
来源: customer_service

────────── 处理时间线 ──────────
[1] 2026-05-25 10:30:00  状态变更
       (初始) → 正常
       操作人: system
       原因: 记录正常，待发奖

[2] 2026-05-25 10:30:00  状态变更
       正常 → 待发奖
       操作人: system
       原因: 自动进入待发奖队列

[3] 2026-05-26 14:15:00  异常发现 [high] [未解决]
       类型: 奖励金额不符
       描述: 奖励漏发: 玩家反馈未到账，核实后确认漏发

[4] 2026-05-26 14:15:00  状态变更
       待发奖 → 漏发
       操作人: 客服_小王
       原因: 标记为漏发: 玩家反馈未到账，核实后确认漏发
```

---

## 三、导出活动复盘前怎么复核

### 3.1 第一步：导出前复核（必须做！）
```bash
python3 cli.py export --activity-id ACT_MAY_2026 --review
```

输出示例：
```
══════════════ 导出前复核 ══════════════
待导出记录数: 156
问题记录数: 3
建议: 存在 3 条记录有未解决异常，请先处理
是否可导出: False

问题详情:
  - ACT_MAY_TASK_001_P007_xxx (玩家 P007): 存在 1 个未解决异常
  - ACT_MAY_TASK_002_P012_xxx (玩家 P012): 存在 1 个未解决异常
  - ACT_MAY_TASK_003_P023_xxx (玩家 P023): 存在 2 个未解决异常

导出摘要:
  total_records: 156
  total_reward: 12580.0
  待发奖: 120
  晚到: 30
  人工更正: 6
  with_anomalies: 3
  with_corrections: 6
```

### 3.2 第二步：处理未解决的异常
查看所有未解决异常：
```bash
python3 cli.py anomaly --list
```

查看特定异常详情：
```bash
python3 cli.py anomaly --anomaly-id ANOM_20260526_abc12345
```

解决异常：
```bash
python3 cli.py anomaly --resolve ANOM_20260526_abc12345 \
  --reason "已核实，补发50元" \
  --operator 运营_小张
```

### 3.3 第三步：需要人工更正的记录
如果需要调整奖励金额或其他信息：
```bash
python3 cli.py correct --record-id ACT_MAY_TASK_001_P007_xxx \
  --reward-amount 80.0 \
  --reason "活动规则理解有误，应为80元" \
  --operator 运营_小张
```

### 3.4 第四步：再次复核，确认无误后导出
```bash
# 再次复核，确保没有问题
python3 cli.py export --activity-id ACT_MAY_2026 --review

# 正式导出
python3 cli.py export --activity-id ACT_MAY_2026 --operator 运营_小张
```

输出示例：
```
══════════════ 导出结果 ══════════════
成功导出 156 条记录
导出批次: EXPORT_20260526_153000_abc123
文件路径: ./exports/reward_export_ACT_MAY_2026_20260526_153000.csv
导出数量: 156 条
导出摘要:
  total_records: 156
  total_reward: 12580.0
  ...
═══════════════════════════════════════
```

### 3.5 第五步：验证导出一致性（可选，建议做）
```bash
python3 cli.py export --verify EXPORT_20260526_153000_abc123
```

输出示例：
```
══════════════ 导出一致性校验 ══════════════
批次ID: EXPORT_20260526_153000_abc123
校验结果: 通过 ✓
校验和匹配: True
摘要匹配: True
═══════════════════════════════════════════
```

### 3.6 查看导出历史
```bash
python3 cli.py export --history --activity-id ACT_MAY_2026
```

---

## 四、常用命令速查表

| 功能 | 命令 |
|------|------|
| 批量导入记录 | `python3 cli.py batch --input data.csv` |
| 查看记录时间线 | `python3 cli.py timeline --record-id <ID>` |
| 列出未解决异常 | `python3 cli.py anomaly --list` |
| 查看异常详情 | `python3 cli.py anomaly --anomaly-id <ID>` |
| 解决异常 | `python3 cli.py anomaly --resolve <ID> --reason "..."` |
| 导出前复核 | `python3 cli.py export --activity-id <活动ID> --review` |
| 导出数据 | `python3 cli.py export --activity-id <活动ID>` |
| 校验导出一致性 | `python3 cli.py export --verify <导出批次ID>` |
| 人工更正记录 | `python3 cli.py correct --record-id <ID> --reward-amount 100 --reason "..."` |
| 查看漏发列表 | `python3 cli.py missed` |
| 标记漏发 | `python3 cli.py missed --mark <ID> --reason "..."` |
| 标记已发奖 | `python3 cli.py missed --mark-sent <ID>` |
| 查看系统统计 | `python3 cli.py stats` |

---

## 五、数据保存位置

| 类型 | 路径 |
|------|------|
| 系统数据 | `./data/dispatch_records.pkl` |
| 导出文件 | `./exports/reward_export_*.csv` |
| 导出日志 | `./exports/export_log.json` |
| 玩家反馈 | `./feedback/<活动ID>/` |

> **重要提示**：定期备份 `./data/` 目录，避免数据丢失。
