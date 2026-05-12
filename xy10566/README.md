# 学校食堂食品留样台账 CLI

学校食堂每天都要留样，但冰箱格子、到期销毁和抽检记录靠纸本很容易漏。这是一个专为学校食堂设计的食品留样台账管理命令行工具。

## 📋 功能特性

- **init**: 初始化留样仓库，支持加载内置样例数据（早餐、午餐、晚餐）
- **import**: 批量导入菜品、批次、留样、抽检等数据
- **check**: 检查所有留样状态，发现超期、重量不足、异常抽检等问题
- **detail**: 查看留样、菜品、批次等详细信息及关联数据
- **report**: 生成综合报告，展示业务闭环状态
- **correct**: 人工修正数据，保留前后差异和操作者信息

## 🔒 核心业务规则

- **同一菜品重复留样**: 不允许同一菜品同一批次重复留样
- **留样重量不足**: 留样重量必须 >= 200g
- **保存时限**: 默认48小时，最长72小时，超期自动标记为异常
- **抽检异常**: 抽检异常自动锁定相关批次
- **操作幂等**: 重复执行同一操作不会产生副作用
- **人工修正**: 所有修正必须记录前后差异和操作者

## 🚀 本地启动

### 环境要求

- Python 3.8+

### 安装

```bash
cd /Users/mac/pro/solo/workspaces/xy10566

# 安装（可选）
pip install -e .

# 或者直接运行
python -m food_sample_ledger --help
```

### 快速开始

```bash
# 1. 初始化仓库（空仓库）
python -m food_sample_ledger init

# 2. 初始化仓库并加载样例数据
python -m food_sample_ledger init --with-samples

# 3. 初始化仓库并包含异常数据
python -m food_sample_ledger init --with-samples --include-overdue
```

## 📊 造数指南

### 内置样例数据

使用 `--with-samples` 参数即可获得完整的样例数据，包含：

| 餐次 | 菜品名称 | 类别 |
|------|---------|------|
| 早餐 | 皮蛋瘦肉粥 | 粥类 |
| 早餐 | 小笼包 | 面点 |
| 早餐 | 茶叶蛋 | 蛋类 |
| 午餐 | 西红柿炒鸡蛋 | 热菜 |
| 午餐 | 糖醋里脊 | 热菜 |
| 午餐 | 紫菜蛋花汤 | 汤类 |
| 晚餐 | 清炒时蔬 | 热菜 |
| 晚餐 | 红烧排骨 | 热菜 |
| 晚餐 | 玉米排骨汤 | 汤类 |

### 自定义导入数据

创建导入文件（参考 `examples/import_sample.json`）：

```json
{
  "dishes": [
    {
      "name": "红烧茄子",
      "category": "热菜",
      "meal_type": "午餐",
      "supplier": "蔬菜供应商",
      "responsible_person": "张大厨"
    }
  ],
  "batches": [],
  "samples": [],
  "inspections": []
}
```

导入命令：

```bash
python -m food_sample_ledger import examples/import_sample.json
```

## 🎯 主要演示路径

### 路径一：正常业务流程

```bash
# Step 1: 初始化并加载样例数据
python -m food_sample_ledger init --with-samples

# Step 2: 检查当前状态
python -m food_sample_ledger check

# Step 3: 查看某个留样详情
# 先用 --json 格式获取所有留样ID
python -m food_sample_ledger check --details --json | python -c "import sys,json;d=json.load(sys.stdin);print([s['id'] for s in d['data']['details'].get('overdue_samples', [])])"

# 查看留样详情（替换 <sample_id> 为实际ID）
python -m food_sample_ledger detail sample <sample_id>

# Step 4: 生成综合报告
python -m food_sample_ledger report

# Step 5: 生成完整报告
python -m food_sample_ledger report --type full
```

### 路径二：人工修正

```bash
# 假设需要修正某个留样的备注信息
python -m food_sample_ledger correct sample <sample_id> '{"notes": "补充留样备注信息"}' --operator "管理员" --reason "信息补录"
```

## ❌ 失败路径演示

### 场景一：重复初始化（幂等性测试）

```bash
# 第一次初始化
python -m food_sample_ledger init --with-samples

# 重复执行（应该提示已初始化，幂等处理）
python -m food_sample_ledger init --with-samples
```

预期结果：显示"仓库已初始化（幂等处理），无需重复操作"

### 场景二：留样重量不足

```bash
# 尝试导入重量不足的留样
cat > examples/bad_sample.json << 'EOF'
{
  "samples": [{
    "dish_id": "实际菜品ID",
    "batch_id": "实际批次ID",
    "sample_weight": 100.0,
    "sample_box_code": "BOX-006",
    "fridge_location_id": "实际冰箱位置ID",
    "sampler": "李师傅"
  }]
}
EOF

python -m food_sample_ledger import examples/bad_sample.json
```

预期结果：报错"留样重量不足，要求至少200.0g，实际100.0g"

### 场景三：超期留样未销毁

```bash
# 初始化包含超期数据
python -m food_sample_ledger init --with-samples --include-overdue

# 检查状态
python -m food_sample_ledger check --details
```

预期结果：报告中显示有超期留样需要处理

### 场景四：抽检异常锁定批次

```bash
# 先初始化并获取留样ID
python -m food_sample_ledger init --with-samples

# 创建异常抽检记录（需要通过代码调用CLI）
# 预期：相关批次被自动锁定
```

## 📈 报告解读

使用 `report` 命令生成的报告包含以下关键指标：

| 指标 | 说明 | 正常状态 |
|------|------|----------|
| active_samples | 有效留样数 | >0 |
| overdue_samples | 超期留样数 | 0 |
| destroyed_samples | 已销毁留样数 | 累计 |
| abnormal_inspections | 异常抽检数 | 0 |
| locked_batches | 锁定批次数 | 0 |
| responsible_persons | 责任人清单 | 明确 |

当报告显示：
- ✅ "报告生成完成，业务状态正常"：业务闭环正常
- ⚠️ "超期留样、锁定批次、异常抽检"：需要立即处理

## 🔄 业务闭环验证

1. **初始化** → `init --with-samples`
2. **状态检查** → `check` 查看当前留样
3. **问题发现** → 检查 `overdue_samples`, `abnormal_inspections`
4. **问题处理** → 销毁超期留样、跟踪异常抽检
5. **修正记录** → `correct` 保留操作痕迹
6. **闭环验证** → `report` 确认所有指标正常

## 📁 目录结构

```
food_sample_ledger/
├── __init__.py
├── __main__.py
├── cli.py                  # CLI入口
├── models/                 # 数据模型
│   ├── base.py
│   ├── dish.py
│   ├── batch.py
│   ├── fridge.py
│   ├── sample_box.py
│   ├── sample.py
│   ├── inspection.py
│   ├── correction.py
│   └── daily_menu.py
├── services/               # 业务服务
│   ├── __init__.py
│   └── sample_service.py
├── commands/               # CLI命令实现
│   ├── __init__.py
│   ├── init.py
│   ├── import_cmd.py
│   ├── check.py
│   ├── detail.py
│   ├── report.py
│   └── correct.py
├── utils/                  # 工具类
│   ├── __init__.py
│   ├── storage.py
│   └── validators.py
└── data/                   # 样例数据
    ├── __init__.py
    └── sample_data.py
```

## 📝 命令参考

### init

```bash
# 初始化空仓库
python -m food_sample_ledger init

# 初始化并加载样例数据
python -m food_sample_ledger init --with-samples

# 初始化并包含异常数据（用于测试）
python -m food_sample_ledger init --with-samples --include-overdue
```

### check

```bash
# 快速检查
python -m food_sample_ledger check

# 详细检查（显示异常详情）
python -m food_sample_ledger check --details

# JSON格式输出
python -m food_sample_ledger check --json
```

### detail

```bash
# 查看留样详情
python -m food_sample_ledger detail sample <sample_id>

# 查看菜品详情
python -m food_sample_ledger detail dish <dish_id>

# 查看批次详情
python -m food_sample_ledger detail batch <batch_id>
```

### report

```bash
# 摘要报告
python -m food_sample_ledger report

# 完整报告
python -m food_sample_ledger report --type full

# JSON格式
python -m food_sample_ledger report --json
```

### correct

```bash
# 修正留样信息
python -m food_sample_ledger correct sample <sample_id> '{"notes": "新备注"}' \
  --operator "张三" --reason "信息补充"

# 修正菜品责任
python -m food_sample_ledger correct dish <dish_id> '{"responsible_person": "李四"}' \
  --operator "管理员" --reason "人员调整"
```

## 🎓 操作培训建议

1. **新人培训**: 使用 `--with-samples` 初始化样例数据进行练习
2. **测试环境**: 使用 `--include-overdue` 模拟异常场景
3. **日常巡检**: 每日执行 `check` 命令检查状态
4. **定期审计**: 每周执行 `report` 命令生成报告存档
5. **操作追溯**: 所有人工修正通过 `correct` 命令执行，保留痕迹

## ⚠️ 注意事项

- 数据目录默认为 `./data`，可通过 `--data-dir` 指定
- 重复执行初始化命令不会覆盖现有数据（幂等）
- 人工修正会永久记录前后差异和操作者
- 抽检异常会自动锁定相关批次，请谨慎操作
