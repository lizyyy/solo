# 研学活动保险 CLI 使用指南

## 一、项目概述

这是一个围绕研学活动出发前核对的命令行工具，解决以下核心痛点：
- 学生名单与保险/授权的姓名身份证不一致
- 保险未生效、过期或覆盖不到活动期
- 家长授权缺失或未签字
- 临时退团后保险未及时作废
- 重复学生名单、重复导入数据

最终输出三类学生清单：**可出发 ✅ / 禁止出发 ❌ / 需补材料 ⚠️**

---

## 二、本地启动

### 前置依赖
- Python 3.8+
- pip

### 安装方式 A（推荐开发者方式，直接运行）
```bash
cd /Users/mac/pro/solo/workspaces/xy10584
pip install -r requirements.txt
python -m research_insurance.cli --help
```

### 安装方式 B（安装为系统命令 `ri`）
```bash
cd /Users/mac/pro/solo/workspaces/xy10584
pip install -e .
ri --help
```

> 以下文档使用 `ri` 命令示例，如果你用方式 A，替换为 `python -m research_insurance.cli`

---

## 三、快速开始（一键演示）

```bash
ri demo
```

这条命令会自动执行：
1. `ri init` - 初始化工作目录
2. 导入内置样例数据
3. `ri check --trip-start 2026-05-15` - 执行检查
4. `ri detail S001` - 查看某个学生详情
5. `ri report --export` - 导出报告

---

## 四、内置样例数据说明

共 5 名学生，覆盖所有典型场景：

| 学生 | 学号 | 场景 | 预期结果 |
|------|------|------|----------|
| 张三 | S001 | ✅ 一切正常：保险有效、已授权、已派车 | [可出发] |
| 李四 | S002 | ⚠️ 保险身份证不一致：保险存的是 9999 结尾，名单是 2345 | [禁止出发] |
| 王五 | S003 | ⚠️ 保险未生效（2026-05-20 才生效）+ 家长未签字 | [禁止出发] |
| 赵六 | S004 | 🚪 已退团（生病住院），保险已作废 | [禁止出发] |
| 孙七 | S005 | ⚠️ 未购买保险 | [禁止出发] |

---

## 五、主要命令详解

### 5.1 `ri init` - 初始化
在当前目录创建 `.research-insurance/` 工作空间：
```
.research-insurance/
├── insurance.db      # SQLite 数据库
├── data/             # 可放置导入的原始文件
├── exports/          # 导出的 JSON 报告
└── history/          # 历史记录
```

### 5.2 `ri import` - 导入数据

支持 `--sample` 内置样例，也支持自定义 JSON 文件：

```bash
# 一键导入所有样例
ri import all-sample

# 单独导入某一类
ri import students --sample
ri import insurance --sample
ri import authorization --sample
ri import vehicles --sample
ri import withdrawals --sample

# 使用自定义文件
ri import students my_students.json
```

### 5.3 `ri check` - 执行检查

```bash
# 检查所有人（指定出发日期用于校验保险覆盖）
ri check --trip-start 2026-05-15

# 只检查某一个学生
ri check --student-id S002 --trip-start 2026-05-15
```

输出示例：
```
=== 检查报告 (2026-05-12T10:30:00) ===
总人数: 5
可出发: 1      [张三]
禁止出发: 4    [李四、王五、赵六、孙七]
需补材料: 0

[可出发名单]
  ✅ 张三 (110101****1234)

[禁止出发名单]
  ❌ 李四
      - 身份证不一致: 名单是[110101201202022345] vs 保险是[110101201202029999]
  ❌ 王五
      - 保险尚未生效: 生效日期2026-05-20
      - 家长未签字确认
  ...
```

### 5.4 `ri detail <学生ID>` - 查看详情

```bash
ri detail S002
```

展示：学生基本信息 + 保险 + 授权 + 车辆 + 退团 + 最新检查结果 + **审计日志**

### 5.5 `ri report` - 历史报告

```bash
# 看最新一次的报告
ri report

# 看历史上某一次
ri report --check-time 2026-05-12T10:30:00

# 导出为 JSON（给团队其他人看）
ri report --export
```

导出文件位置：`.research-insurance/exports/report_xxx.json`

### 5.6 `ri fix` - 人工修正（重要）

修正学生信息时 **必须提供操作人和原因**，系统自动记录审计日志：

```bash
# 修正李四的身份证（把错误的 9999 改成正确的 2345）
ri fix S002 --field id_card --new-value 110101201202022345 --operator "张老师" --reason "保险录入时手误输错"
```

### 5.7 `ri audit` - 查看所有操作历史

```bash
ri audit --limit 20
```

每条记录包含：**操作类型 + 操作人 + 原因 + 变更前后 JSON diff**

### 5.8 `ri list` - 查看已导入数据

```bash
ri list --type students
ri list --type insurance
ri list --type authorization
ri list --type vehicles
ri list --type withdrawals
```

### 5.9 `ri reset` - 清空重来

```bash
ri reset --yes
```

---

## 六、核心校验规则

| 规则 | 严重程度 | 描述 |
|------|----------|------|
| 姓名/身份证不一致 | ❌ 禁止出发 | 名单 vs 保险 vs 授权 三者比对 |
| 保险不存在 | ❌ 禁止出发 | 未找到对应保险保单 |
| 保险未生效 | ❌ 禁止出发 | start_date > 今天 |
| 保险已过期 | ❌ 禁止出发 | end_date < 今天 |
| 保险覆盖不到活动 | ❌ 禁止出发 | end_date < trip_start |
| 保险状态作废 | ❌ 禁止出发 | status != valid |
| 授权不存在 | ❌ 禁止出发 | 未找到授权书 |
| 授权未签字 | ❌ 禁止出发 | signature_status = false |
| 未分配车辆 | ❌ 禁止出发 | 车辆列表中无该学生 |
| 已退团 | ❌ 禁止出发 | 只要有退团记录一律不能走 |
| 退团后保险未作废 | ❌ 禁止出发 | 提醒财务/行政及时作废 |
| 无紧急联系电话 | ❌ 禁止出发 | 授权书必须填 |
| 无紧急联系人 | ⚠️ 警告 | 建议补充 |
| 药物过敏/特殊需求 | ⚠️ 警告 | 提示带队老师注意 |
| 车辆超员 | ❌ 禁止出发 | 实际人数 > 核载人数 |

---

## 七、幂等性说明

多次执行相同操作不会产生副作用：

| 操作 | 幂等行为 |
|------|----------|
| `ri init` | 已初始化则跳过 |
| `ri import students` | 身份证已存在则跳过（UNIQUE 约束） |
| `ri import insurance` | 保单号已存在则跳过 |
| `ri import authorization` | 学生身份证已有授权则跳过 |
| `ri import vehicles` | 车牌已存在则跳过 |
| `ri import withdrawals` | 学生已退团状态则跳过（不重复处理） |
| `ri check` | 多次执行生成多条报告（按时间戳区分） |

---

## 八、演示路径

### 路径 A：正常演示路径（看到业务闭环）

```bash
# 1. 初始化
ri init

# 2. 导入样例
ri import all-sample

# 3. 执行检查
ri check --trip-start 2026-05-15

# 4. 查看张三详情（一切正常）
ri detail S001

# 5. 修正李四的身份证错误
ri fix S002 --field id_card --new-value 110101201202022345 --operator "张老师" --reason "保险录入错误"

# 6. 再次检查，看李四状态变化
ri check --trip-start 2026-05-15

# 7. 查看审计日志
ri audit

# 8. 导出最终报告
ri report --export
```

### 路径 B：失败路径（故意看到错误）

```bash
ri init
ri import students --sample
ri check --trip-start 2026-05-15
```

此时只导入了学生名单，**保险、授权、车辆都没有**：
- 输出：5 人全部 ❌ 禁止出发
- 原因：未找到保险保单、未找到家长授权书、未分配车辆座位

---

## 九、自定义数据格式

如果不使用 `--sample`，可以按以下格式准备 JSON 文件：

### students.json
```json
[
  {
    "id": "S001",
    "name": "张三",
    "id_card": "110101201201011234",
    "school": "北京市第一实验小学",
    "class_name": "三年级(2)班",
    "guardian_name": "张大明",
    "guardian_phone": "13800000001"
  }
]
```

### insurance.json
```json
[
  {
    "student_name": "张三",
    "student_id_card": "110101201201011234",
    "policy_number": "INS202605001",
    "insurance_company": "平安保险",
    "start_date": "2026-05-10",
    "end_date": "2026-05-20",
    "amount": 200000
  }
]
```

### authorization.json
```json
[
  {
    "student_name": "张三",
    "student_id_card": "110101201201011234",
    "guardian_name": "张大明",
    "guardian_id_card": "110101198001011234",
    "relation": "父亲",
    "signature_status": true,
    "emergency_contact": "张大明",
    "emergency_phone": "13800000001",
    "medical_allergy": "无",
    "special_needs": "无"
  }
]
```

### vehicles.json
```json
[
  {
    "plate_number": "京A12345",
    "driver_name": "王师傅",
    "driver_phone": "13900000001",
    "capacity": 20,
    "route": "学校 -> 故宫 -> 科技馆",
    "student_ids": ["S001", "S002"]
  }
]
```

### withdrawals.json
```json
[
  {
    "student_id": "S004",
    "reason": "生病住院，无法参加",
    "withdrawal_date": "2026-05-11",
    "operator": "刘老师",
    "refund_status": "processing"
  }
]
```

---

## 十、不看源码也能判断业务闭环

查看 `ri report` 的输出或导出的 JSON：

1. **可出发名单** ✅
   - 所有关键校验项都通过
   - 保险有效 + 已授权签字 + 已派车 + 身份一致

2. **禁止出发名单** ❌
   - 有严重阻断性问题
   - 必须处理后才能出发

3. **需补材料名单** ⚠️
   - 有问题但非阻断性
   - 出发前补齐即可

**业务闭环判断标准：**
- 当「禁止出发 + 需补材料」名单为空时 = 可以放心出发
- 当还有学生在禁止出发名单时 = 不能出发
- 所有修正操作都有审计日志可追溯 = 合规闭环
