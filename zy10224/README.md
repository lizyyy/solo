# 口腔正畸复诊排队 CLI (ortho_queue)

一个专为口腔正畸前台设计的复诊排队管理工具，帮助处理日常改约、急诊插队和提醒管理。

## 功能特性

### 🗂️ 数据管理
- **患者管理**: 维护患者基本信息、复诊周期、当前阶段、联系方式、提醒方式
- **医生管理**: 医生信息、日接诊上限
- **预约记录**: 预约历史、状态跟踪
- **改约历史**: 完整的改约追踪
- **提醒记录**: 短信/电话/微信/邮件提醒管理

### ⚠️ 冲突检测
- **复诊间隔过短**: 自动检测并警告间隔不足的复诊
- **医生满号**: 自动检测医生当日是否已满（常规号+急诊号）
- **急诊重复插队**: 防止同一患者当日重复急诊
- **提醒撤回**: 取消或改约时自动处理已发送提醒

### 🔄 去重机制
- 预约编码唯一（`APT-{患者ID}-{日期}` 或 `EMG-{患者ID}-{日期}`）
- 重复导入自动跳过
- 同患者同日同类型预约自动去重

### 📊 核心命令
- **今日队列**: 查看今日预约列表，急诊优先排序
- **冲突报告**: 显示所有冲突及原因
- **改约建议**: 自动推荐可行的改约日期
- **提醒清单**: 导出前台可用的提醒列表

## 安装

```bash
cd /path/to/zy10224
pip install -r requirements.txt
```

## 快速开始

### 1. 安装依赖
```bash
pip install -r requirements.txt
```

### 2. 导入示例数据
```bash
python -m ortho_queue import-batch --file sample_data.json
```

### 3. 查看今日队列
```bash
python -m ortho_queue today --date 2026-05-12
```

### 4. 查看提醒清单（可导出 CSV）
```bash
python -m ortho_queue reminder list --date 2026-05-11 --export csv
```

## 命令参考

### 创建预约
```bash
python -m ortho_queue appointment create \
  --patient-id P007 \
  --patient-name 周九 \
  --doctor 李医生 \
  --date 2026-05-14 \
  --stage 常规复诊 \
  --interval 28 \
  --phone 13800138007
```

### 创建急诊
```bash
python -m ortho_queue appointment create \
  --patient-id P008 \
  --patient-name 吴十 \
  --doctor 王医生 \
  --date 2026-05-12 \
  --emergency \
  --emergency-reason "弓丝断裂" \
  --phone 13800138008
```

### 改约
```bash
# 查看建议日期
python -m ortho_queue appointment reschedule \
  --code APT-P001-20260512 \
  --suggest

# 实际改约
python -m ortho_queue appointment reschedule \
  --code APT-P001-20260512 \
  --new-date 2026-05-15 \
  --reason "患者时间冲突"
```

### 取消预约
```bash
python -m ortho_queue appointment cancel \
  --code APT-P001-20260512 \
  --reason "患者取消"
```

### 创建提醒
```bash
python -m ortho_queue reminder create \
  --code APT-P001-20260512 \
  --date 2026-05-11 \
  --type 短信
```

### 批量导入
```bash
# JSON 格式
python -m ortho_queue import-batch --file appointments.json

# CSV 格式
python -m ortho_queue import-batch --file appointments.csv

# 预检查（不实际导入）
python -m ortho_queue import-batch --file appointments.json --dry-run
```

## 数据字段说明

### 阶段 (Stage)
- 初诊
- 方案确认
- 托槽粘接
- 常规复诊
- 紧急调整
- 保持器佩戴
- 结束复诊

### 提醒方式 (Reminder Type)
- 短信
- 电话
- 微信
- 邮件

### 急诊原因 (Emergency Reason)
- 托槽脱落
- 弓丝断裂
- 结扎丝扎嘴
- 疼痛难忍
- 其他紧急情况

### 预约状态 (Status)
- 待确认
- 已确认
- 已完成
- 已取消
- 已改约
- 急诊

## 配置

数据存储位置：
- 数据库: `~/.ortho_queue/appointments.db`
- 导出文件: `~/.ortho_queue/exports/`

可通过环境变量自定义：
```bash
export ORTHO_QUEUE_CONFIG=/custom/path
```

## 业务规则

1. **复诊间隔**: 默认 28 天，可按患者自定义。急诊不受限制。
2. **医生日上限**: 默认 8 个常规号 + 2 个急诊号（25%）。
3. **急诊优先级**: 同一医生当日急诊号单独计算，不占用常规号额度。
4. **提醒撤回**: 改约或取消时，已发送的提醒会被标记为撤回。
5. **去重规则**: 患者ID + 日期 + 类型（常规/急诊）唯一标识预约。

## 示例场景

### 场景1: 前台接到改约电话
```bash
# 1. 查看原预约信息
python -m ortho_queue today --date 2026-05-12

# 2. 查看建议日期
python -m ortho_queue appointment reschedule --code APT-P001-20260512 --suggest

# 3. 执行改约
python -m ortho_queue appointment reschedule \
  --code APT-P001-20260512 \
  --new-date 2026-05-15 \
  --reason "患者感冒"
```

### 场景2: 急诊患者来院
```bash
# 1. 创建急诊（自动检测冲突）
python -m ortho_queue appointment create \
  --patient-id P009 \
  --patient-name 郑十一 \
  --doctor 李医生 \
  --date 2026-05-12 \
  --emergency \
  --emergency-reason "托槽脱落"

# 2. 查看今日队列（急诊排在前面）
python -m ortho_queue today --date 2026-05-12
```

### 场景3: 导出今日提醒清单
```bash
python -m ortho_queue reminder list --date 2026-05-11 --export csv
# 输出: ~/.ortho_queue/exports/reminders_20260511.csv
```
