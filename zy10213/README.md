# 物业电梯维保派单 CLI

一个简单易用的命令行工具，帮助物业公司管理小区电梯的维保工作。

## 环境要求

- Python 3.7 或更高版本
- 不需要安装任何第三方库

## 快速开始

### 第1步：查看帮助

```bash
cd 项目目录
python3 -m elevator_cli --help
```

### 第2步：初始化基础信息

按以下顺序执行：

```bash
# 1. 添加楼栋
python3 -m elevator_cli building add "1号楼" --floors 18
python3 -m elevator_cli building add "2号楼" --floors 24

# 2. 添加电梯（每栋楼的电梯编号要唯一）
python3 -m elevator_cli elevator add "1号楼" "1#-1" --cycle 30
python3 -m elevator_cli elevator add "1号楼" "1#-2" --cycle 30
python3 -m elevator_cli elevator add "2号楼" "2#-1" --cycle 30

# 3. 添加维修师傅
python3 -m elevator_cli tech add "张师傅" --phone "13800138000"
python3 -m elevator_cli tech add "李师傅" --phone "13900139000"

# 4. 登记师傅休假（可选）
python3 -m elevator_cli tech vacation "张师傅" 2026-05-20 2026-05-22 --reason "年假"
```

### 第3步：日常操作

#### 场景1：创建周期维保计划

周期维保单会按电梯维保周期自动计算下次计划日期：

```bash
python3 -m elevator_cli order periodic "1#-1" --building "1号楼"
```

#### 场景2：收到物业群故障报修（电梯异响等）

```bash
python3 -m elevator_cli order fault "1#-1" --building "1号楼" --desc "电梯运行有异响，业主在群里反映"
```

#### 场景3：派单给师傅

```bash
python3 -m elevator_cli order assign P20260511001 "张师傅"
```

#### 场景4：师傅完成维保后登记

```bash
python3 -m elevator_cli order complete P20260511001 --proof "https://公司系统/照片地址" --notes "已检查导轨并润滑，异响消除"
```

#### 场景5：查看每日工作

每天早上运行一次，查看今天需要处理的工单：

```bash
python3 -m elevator_cli report all
```

## 命令速查

### 楼栋管理
| 命令 | 说明 |
|------|------|
| `python3 -m elevator_cli building add "楼栋名" --floors N` | 添加楼栋 |
| `python3 -m elevator_cli building list` | 列出所有楼栋 |

### 电梯管理
| 命令 | 说明 |
|------|------|
| `python3 -m elevator_cli elevator add "楼栋名" "电梯编号" --cycle 30` | 添加电梯，周期默认30天 |
| `python3 -m elevator_cli elevator list` | 列出所有电梯 |

### 师傅管理
| 命令 | 说明 |
|------|------|
| `python3 -m elevator_cli tech add "姓名" --phone "电话"` | 添加师傅 |
| `python3 -m elevator_cli tech list` | 列出所有在职师傅 |
| `python3 -m elevator_cli tech vacation "姓名" 开始日期 结束日期 --reason "原因"` | 登记休假 |

### 维保单管理
| 命令 | 说明 |
|------|------|
| `python3 -m elevator_cli order periodic "电梯编号" --building "楼栋名"` | 创建周期维保单 |
| `python3 -m elevator_cli order fault "电梯编号" --building "楼栋名" --desc "故障描述"` | 创建故障报修单 |
| `python3 -m elevator_cli order assign 单号 "师傅姓名"` | 派单 |
| `python3 -m elevator_cli order complete 单号 --proof "凭证链接" --notes "完成说明"` | 完成登记 |
| `python3 -m elevator_cli order escalate 单号 --notes "升级原因"` | 升级工单 |
| `python3 -m elevator_cli order list` | 列出所有维保单 |

### 统计报表
| 命令 | 说明 |
|------|------|
| `python3 -m elevator_cli report today` | 今日待处理工单 |
| `python3 -m elevator_cli report overdue` | 已逾期工单 |
| `python3 -m elevator_cli report escalate` | 需要升级的工单 |
| `python3 -m elevator_cli report monthly --year 2026 --month 5` | 月度完成率 |
| `python3 -m elevator_cli report all` | 综合日报（推荐每天执行） |

## 常见问题（为什么被拦？）

系统会自动拦截不符合规则的操作，并告诉你原因。

### 1. 为什么不能创建故障单？

**错误示例：**
```
【错误】电梯 [1#-1] 已有周期维保计划冲突
       原因说明：当前周期单：P20260511001（计划：2026-05-11），故障单优先级高但不能重复派单，请先完成或取消周期单，再创建故障单
```

**原因：** 同一电梯同一时间只能有一张未完成的工单。

**解决办法：**
- 如果故障紧急，先完成那张周期单，再创建故障单
- 或者把周期单升级处理

### 2. 为什么不能完成工单？

**错误示例：**
```
【错误】维保单 [P20260501001] 已逾期 10 天，不能标记为正常完成
       原因说明：到期日期：2026-05-06，实际完成：2026-05-16，逾期工单需要走升级流程：python3 -m elevator_cli order escalate P20260501001
```

**原因：** 过了截止日期还没完成，不能直接标记"正常完成"。

**解决办法：** 先升级工单，再处理：
```bash
python3 -m elevator_cli order escalate P20260501001 --notes "因配件缺货延迟"
```

### 3. 为什么不能派单给张师傅？

**错误示例：**
```
【错误】师傅 [张师傅] 在 [2026-05-20] 休假
       原因说明：休假期间：2026-05-20 ~ 2026-05-22，原因：年假，请更换师傅或调整派单日期
```

**原因：** 师傅已登记休假，系统自动拦截。

**解决办法：** 派给其他师傅，或者调整计划日期。

### 4. 为什么不能重复创建同一张单？

**错误示例（开启去重时）：**
```
【错误】导入记录已存在（单号：P20260511001）
       原因说明：import_hash=[xxx] 已被使用，避免重复导入
```

**原因：** 你用了 `--dup-key` 参数，系统检测到相同内容的单已经创建过。

**解决办法：** 不用重复创建，用已有的单号继续操作即可。

### 5. 如何避免重复导入？

如果从Excel或其他系统批量导入，建议加 `--dup-key` 参数：

```bash
python3 -m elevator_cli order periodic "1#-1" --building "1号楼" --dup-key
```

系统会根据"楼栋+电梯+日期+类型"自动生成指纹，同样的内容不会重复创建。

## 数据存储

所有数据保存在项目目录下的 `data/` 文件夹中，是普通的 JSON 文件，可以直接备份：

```
data/
├── buildings.json    # 楼栋数据
├── elevators.json    # 电梯数据
├── technicians.json  # 师傅数据
├── vacations.json    # 休假记录
└── orders.json       # 维保单数据
```

## 建议的每日工作流程

### 早上
```bash
python3 -m elevator_cli report all
```
看看今天要做什么、有没有逾期的、哪些需要升级。

### 收到故障报修时
```bash
python3 -m elevator_cli order fault "电梯编号" --building "楼栋名" --desc "故障描述"
python3 -m elevator_cli order assign 单号 "师傅姓名"
```

### 师傅完成后
```bash
python3 -m elevator_cli order complete 单号 --proof "凭证链接" --notes "完成说明"
```

### 月底
```bash
python3 -m elevator_cli report monthly
```
查看本月完成率，做工作总结。

## 维保单号规则

- 周期维保单：`P` + 日期 + 序号，例如 `P20260511001`
- 故障报修单：`F` + 日期 + 序号，例如 `F20260511001`

## 工单状态说明

| 状态 | 说明 |
|------|------|
| 待派单 | 刚创建，还没派给师傅 |
| 已派单 | 已派给师傅，等待处理 |
| 已完成 | 正常完成 |
| 已逾期 | 过了截止日期还没完成 |
| 已升级 | 升级处理中 |

## 截止日期规则

- 周期维保单：计划日期 + 5 天
- 故障报修单：计划日期 + 2 天

## 升级阈值

逾期超过 3 天的工单会自动出现在"需要升级"列表中。

## 示例场景

### 场景：业主在群里说电梯异响

**物业人员操作：**

1. 先看看这台电梯有没有未完成的工单：
```bash
python3 -m elevator_cli order list
```

2. 创建故障单：
```bash
python3 -m elevator_cli order fault "1#-1" --building "1号楼" --desc "业主群反映电梯运行有异响"
```
→ 系统生成单号：`F20260511001`

3. 派单给李师傅（张师傅今天休假）：
```bash
python3 -m elevator_cli order assign F20260511001 "李师傅"
```

4. 李师傅完成后，登记完成：
```bash
python3 -m elevator_cli order complete F20260511001 --proof "https://xxx" --notes "调整门机参数，异响消除"
```

5. 查看今天工作完成情况：
```bash
python3 -m elevator_cli report all
```
