# 校园宿舍维修管理 CLI (dorm-repair)

宿管每周汇总宿舍维修时，原来只有报修描述很难区分：
- 🔍 **自然损坏** vs **学生责任**
- 🔁 **重复报修**（同一房间同一问题反复报）
- 📊 按**楼栋、责任类型、材料消耗、回访结果**的统计

这个 CLI 工具完整解决这些问题。

---

## 📋 功能特性

| 功能 | 说明 |
|------|------|
| 自动责任认定 | 根据报修描述关键词 + 类别规则（如门锁默认学生责任） |
| 重复报修检测 | 30天窗口内，同一房间同类问题自动标记 |
| 材料库存控制 | 出库时检查库存，不足拦截 |
| 状态流转控制 | 未回访不能关闭，回访为"需返工/未确认"不能关闭 |
| 学生责任费用 | 学生责任单自动计算材料费用 |
| 审计留痕 | 人工修改责任类型记录前后差异、操作人、原因 |
| 幂等性 | 重复执行关闭等操作无副作用 |
| 多维度统计 | 楼栋、责任类型、回访结果、材料成本、维修时长 |

---

## 🚀 本地启动

### 1. 环境要求
- Python >= 3.9

### 2. 安装
```bash
cd /path/to/project
pip install -e .
```

> 提示：如果提示 `dorm-repair` 不在 PATH，添加 `/Users/xxx/Library/Python/3.9/bin` 到 PATH，或使用 `python3 -m dorm_repair.cli` 代替。

### 3. 初始化（加载演示数据）
```bash
export PATH="/Users/$(whoami)/Library/Python/3.9/bin:$PATH"
dorm-repair init --with-sample
```

这会：
1. 在 `./.dorm-repair-data/` 创建 SQLite 数据库
2. 自动导入宿舍、维修人员、材料库存
3. 生成 7 条演示维修单（覆盖水龙头、门锁、电路、家具场景）

---

## 📊 主要演示路径

### 🔹 路径 1：查看整体状况
```bash
# 1. 列出所有维修单
dorm-repair list-orders

# 2. 运行检查（发现问题、库存预警、辅导员跟进）
dorm-repair check

# 3. 生成汇总报告
dorm-repair report
```

**预期结果：**
- 看到 7 条维修单，状态各不相同
- RO-20260509-A101RP 被标记为 **repeat**（重复报修，关联 RO-20260507-A101PL）
- RO-20260508-A102LK 为 **student_responsible**（学生责任），费用 ¥85
- 报告显示闭环率、未闭环事项、辅导员跟进房间

---

### 🔹 路径 2：查看单详情（完整生命周期）
```bash
# 查看已关闭的水龙头维修单（有完整历史）
dorm-repair detail RO-20260507-A101PL

# 查看重复报修单
dorm-repair detail RO-20260509-A101RP

# 查看学生责任的门锁维修（待回访）
dorm-repair detail RO-20260508-A102LK --audit
```

**看到的信息：**
- 状态变化历史（提交 → 分配 → 维修中 → 完成 → 回访 → 关闭）
- 材料使用记录（水龙头 + 生料带 = ¥50）
- 审计日志（`--audit` 标志）

---

### 🔹 路径 3：完整处理一个新报修单

让我们处理家具维修单 RO-20260511-B102FR（床架松动）：

```bash
# Step 1: 查看当前状态
dorm-repair detail RO-20260511-B102FR

# Step 2: 分配维修人员
dorm-repair assign RO-20260511-B102FR P002 --operator "张宿管"

# Step 3: 开始维修
dorm-repair start RO-20260511-B102FR --operator "李师傅"

# Step 4: 添加材料
dorm-repair add-material RO-20260511-B102FR M010 2 --operator "李师傅"

# Step 5: 完成维修
dorm-repair complete RO-20260511-B102FR "加固床架螺丝" "更换松动连接件" --operator "李师傅"

# Step 6: 回访（满意）
dorm-repair followup RO-20260511-B102FR satisfied --remarks "床架稳固，学生满意" --operator "王宿管"

# Step 7: 关闭
dorm-repair close RO-20260511-B102FR --operator "张宿管"

# Step 8: 查看最终状态和历史
dorm-repair detail RO-20260511-B102FR
```

---

### 🔹 路径 4：人工修正责任（留痕）

场景：原来判定为自然损坏的椅子维修，后来发现是学生打闹造成的：

```bash
# 查看原责任
dorm-repair detail RO-20260510-B101FR

# 人工修改
dorm-repair update-responsibility RO-20260510-B101FR student_responsible "经查实为学生打闹损坏椅子" --operator "后勤主任"

# 查看变更（看审计日志）
dorm-repair detail RO-20260510-B101FR --audit
```

**审计日志会记录：**
- 操作人：后勤主任
- 变更前：natural_damage
- 变更后：student_responsible
- 原因：经查实为学生打闹损坏椅子

---

## ❌ 失败路径演示

### 失败场景 1：未回访不能关闭

```bash
# 查看 RO-20260508-A102LK 状态是 completed（已完成维修，但未回访）
dorm-repair detail RO-20260508-A102LK

# 尝试直接关闭 → 会失败
dorm-repair close RO-20260508-A102LK
```

**预期错误：**
```
错误: 报修单当前状态 completed 不能关闭，需先完成回访 (followed_up)
```

**正确做法：**
```bash
# 先回访
dorm-repair followup RO-20260508-A102LK satisfied --remarks "门锁已修好，学生满意" --operator "刘老师"

# 再关闭
dorm-repair close RO-20260508-A102LK
```

---

### 失败场景 2：材料库存不足

```bash
# 查看库存
dorm-repair list-materials

# 尝试给某个单添加超量材料
dorm-repair add-material RO-20260512-A202PL M001 1000
```

**预期错误：**
```
错误: 材料 水龙头(冷) 库存不足: 当前 19.0个，需要 1000个
```

---

### 失败场景 3：回访结果为"需返工"不能关闭

```bash
# 查看 RO-20260509-A201EL 回访结果是 needs_rework
dorm-repair detail RO-20260509-A201EL

# 尝试关闭 → 失败
dorm-repair close RO-20260509-A201EL
```

**预期错误：**
```
错误: 回访结果为 needs_rework，不能关闭订单
```

**正确做法：** 需要重新维修并再次回访确认。

---

## 📈 报告解读（判断业务是否闭环）

运行 `dorm-repair report` 后，关键指标：

| 指标 | 说明 | 目标 |
|------|------|------|
| **闭环率** | 已关闭 / 总单数 | 越高越好 |
| **未闭环事项** | 列表显示等待天数、状态 | 应尽量为空 |
| **辅导员跟进** | 学生责任单需辅导员确认收费 | 需处理完 |
| **待回访数** | completed 状态的单数 | 应尽快处理 |
| **维修时长** | 平均/最长/最短 | 监控效率 |
| **材料成本** | 按类型统计 | 成本分析 |

**判断闭环的简单方法：**
1. ✅ 报告底部显示 `✓ 业务已完全闭环！`
2. ❌ 或显示 `⚠ 存在未闭环事项，请关注上表`

---

## 📁 输入数据格式

使用 `dorm-repair gen-csv /path/to/output` 生成模板 CSV：

### dormitories.csv（宿舍名单）
| 字段 | 说明 |
|------|------|
| dorm_id | 宿舍唯一ID（如 A1-101） |
| building | 楼栋 |
| room_number | 房间号 |
| floor | 楼层 |
| capacity | 容量 |
| students | JSON 数组（如 ["张三","李四"]） |
| counselor | 辅导员姓名 |

### repair_persons.csv（维修人员）
| 字段 | 说明 |
|------|------|
| staff_id | 工号 |
| name | 姓名 |
| phone | 电话 |
| skills | JSON 数组（如 ["水电","管道"]） |
| work_area | JSON 数组（如 ["A1","A2"]） |

### materials.csv（材料库存）
| 字段 | 说明 |
|------|------|
| material_id | 材料ID |
| name | 名称 |
| unit | 单位 |
| unit_price | 单价 |
| current_stock | 当前库存 |
| min_stock | 最低库存预警 |

---

## 🔧 完整命令参考

```bash
dorm-repair --help                    # 查看所有命令

# 初始化和导入
dorm-repair init --with-sample        # 初始化并加载演示数据
dorm-repair import-csv dormitories ./dorms.csv
dorm-repair gen-csv ./templates       # 生成 CSV 模板

# 查询
dorm-repair list-orders               # 列出维修单
dorm-repair list-orders --status closed
dorm-repair list-orders --building A1
dorm-repair list-dorms                # 列出宿舍
dorm-repair list-materials            # 列出材料库存
dorm-repair detail RO-xxx --audit     # 查看详情+审计日志

# 操作
dorm-repair assign RO-xxx P001
dorm-repair start RO-xxx
dorm-repair add-material RO-xxx M001 2
dorm-repair complete RO-xxx "维修内容1" "维修内容2"
dorm-repair followup RO-xxx satisfied --remarks "..."
dorm-repair close RO-xxx

# 管理
dorm-repair check                     # 运行健康检查
dorm-repair report                    # 生成汇总报告
dorm-repair report --json ./report.json
dorm-repair update-responsibility RO-xxx natural_damage "原因" --operator "管理员"
```

---

## 🔄 状态机

```
submitted (提交)
    │
    ├─→ repeat (重复报修) ─┐
    │                      │
    └─→ assigned (已分配)  │
           │               │
           ▼               │
     in_progress (维修中)  │
           │               │
           ▼               │
      completed (已完成)   │
           │               │
           ▼               │
    followed_up (已回访)   │
           │               │
           ▼               │
       closed (关闭) ◄─────┘
```

**关键规则：**
- `completed` → 必须先回访才能关闭
- `followed_up` 且结果为 `satisfied` → 才能关闭
- `repeat` 状态也可以被分配处理（或合并到原单）

---

## 📊 演示数据概览

| 单号 | 类型 | 责任 | 状态 | 说明 |
|------|------|------|------|------|
| RO-20260507-A101PL | 水龙头 | 自然损坏 | closed | 已闭环，有完整历史 |
| RO-20260509-A101RP | 水龙头 | 自然损坏 | repeat | 重复报修（关联上一单） |
| RO-20260508-A102LK | 门锁 | 学生责任 | completed | 待回访，费用 ¥85 |
| RO-20260509-A201EL | 电路 | 自然损坏 | followed_up | 回访为需返工 |
| RO-20260510-B101FR | 椅子 | 自然损坏 | assigned | 已分配，待维修 |
| RO-20260511-B102FR | 床架 | 自然损坏 | submitted | 新单，未分配 |
| RO-20260512-A202PL | 花洒 | 待定 | submitted | 新单，未分配 |

---

## 🎯 业务价值

1. **自动分类**：从"水龙头漏水"自动识别为 plumbing + 自然损坏
2. **责任清晰**：门锁默认学生责任，关键词"撞坏"也触发学生责任
3. **防漏回访**：未回访的单关不掉，倒逼回访闭环
4. **成本可控**：材料出库检查库存，学生责任自动计费
5. **可追溯**：人工修改有审计，所有操作有历史记录
6. **一眼看懂**：报告直接给结论"业务已完全闭环"或"存在未闭环事项"
