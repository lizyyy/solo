# 约束满足宿舍分配 - 教研追溯系统

## 这是什么

一个小而真的教研追溯系统，不是冷冰冰的功能清单，而是一份**能复盘的记录**和**可重新跑的命令**。

## 核心设计原则

1. **分母为0的问题不自动归正常** - 留给数据复核人复核
2. **保留原始截图状态** - 作为复盘依据
3. **批注补录后演示结果自动更新** - 教研流程可见
4. **每一步都有记录** - 方便吴老师给新人讲流程

## 三种入口方式

### 1. 命令行（推荐，最完整）

```bash
# 一键跑完整演示
python3 run_demo.py

# 查看课堂演示结果
python3 -m dorm_allocator.cli --data-dir ./demo_data/runtime demo

# 生成复盘报告
python3 -m dorm_allocator.cli --data-dir ./demo_data/runtime report <RUN_ID>

# 生成HTML小看板
python3 -m dorm_allocator.dashboard --data-dir ./demo_data/runtime --output dashboard.html
```

### 2. API 接口

```bash
# 启动API服务
python3 -m dorm_allocator.api

# 浏览器访问: http://localhost:8000/docs
```

### 3. HTML 小看板

直接打开 `demo_dashboard.html` 在浏览器中查看。

## 完整工作流程（给新人讲的故事）

### 第一步：旧公式截图第一次导入

**场景**：张助教从旧课件截图里抠出5条宿舍分配数据，直接导入系统。

**发生了什么**：
- 系统检测到李华和赵伟的分母为0，但截图里显示是空字符串
- **关键点**：系统没有自动填1或报错跳过，而是**原样保留空字符串**，标记为待复核
- 因为：旧公式截图里的结论不能直接照抄

**命令回放**：
```bash
python3 -m dorm_allocator.cli import demo_data/old_screenshot_data.json \
  --operator 张助教 --role teacher
```

---

### 第二步：教研负责人吴老师补看老师批注

**场景**：王老师的批注后来才补到群里，吴老师回看时发现...

**发生了什么**：
- 李华：情况特殊，教务处数据缺失，需要核实
- 赵伟：转学生，数据还没同步完整
- 其他三条：数据正确，可以通过

**关键点**：批注补录后，课堂演示结果里的"状态说明"、"为何保留"、"下一步"都会跟着变

**命令回放**（用记录ID操作）：
```bash
# 加批注
python3 -m dorm_allocator.cli annotate <RECORD_ID> \
  "李华同学情况特殊，需要联系教务处核实" \
  --author 王老师 --role teacher

# 吴老师审核
python3 -m dorm_allocator.cli review <RECORD_ID> \
  "已回看批注，确认流程合规" \
  --reviewer 吴老师 --role teaching_research_head --status needs_correction
```

---

### 第三步：数据复核人处理分母为0的问题

**场景**：数据复核员小刘收到通知，去教务处核实后修正数据。

**发生了什么**：
- 李华的分母从0 → 90（核实了真实数据）
- 赵伟的分母从0 → 85（转学生数据同步完成）

**关键点**：修正记录作为批注保留，完整追溯链不丢失

**命令回放**：
```bash
python3 -m dorm_allocator.cli correct <RECORD_ID> 90 \
  --operator "数据复核员小刘" --note "联系教务处核实，优先级权重应为90"
```

---

### 第四步：基于批注重跑，生成完整课堂演示

**场景**：吴老师把所有记录带上批注重新跑一遍，用于下一堂课的演示。

**命令回放**：
```bash
python3 -m dorm_allocator.cli rerun <PREV_RUN_ID> \
  --operator 吴老师 --role teaching_research_head
```

## 课堂演示结果里有什么

不是一张简单的表格，每条记录都包含：

| 字段 | 说明 |
|------|------|
| **公式** | 用的什么公式 |
| **计算过程** | 具体怎么算的 |
| **状态说明** | 现在是什么状态 |
| **为何保留** | 为什么这条还在系统里，不是被删掉 |
| **缺少材料** | 还缺什么才能走完流程 |
| **下一步** | 该做什么 |
| **联系人** | 找谁 |
| **批注历史** | 谁说了什么 |

## 项目结构

```
.
├── dorm_allocator/
│   ├── __init__.py      # 导出入口
│   ├── models.py        # 数据模型
│   ├── core.py          # 核心业务逻辑
│   ├── cli.py           # 命令行
│   ├── api.py           # FastAPI接口
│   └── dashboard.py     # HTML小看板
├── demo_data/
│   ├── old_screenshot_data.json   # 旧公式截图模拟数据
│   ├── teacher_annotations.md     # 老师后补的批注
│   └── runtime/                   # 运行时数据
├── run_demo.py          # 一键完整演示
├── demo_dashboard.html  # 生成的小看板
└── requirements.txt
```

## 给教研负责人吴老师的提示

给新人讲流程时，可以按这个顺序展示：

1. 先 `demo` 命令看第一次导入的结果（有问题，但没有批注）
2. 讲为什么分母为0的还留着
3. 展示补录批注后结果怎么变
4. 讲数据复核人怎么介入
5. 最后看完整的重跑结果

配合 `demo_dashboard.html` 看图说话效果更好。
