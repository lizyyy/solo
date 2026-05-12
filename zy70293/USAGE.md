# 社区雨水花园养护 CLI 使用指南

## 概述

本 CLI 工具用于管理社区雨水花园的养护工作，支持降雨记录导入、积水记录管理、植物状态跟踪和志愿者巡查安排。

## 安装

```bash
pip install -e .
```

## 命令说明

### 1. init - 初始化样例数据

```bash
rain-garden init
rain-garden init --force  # 强制覆盖现有数据
```

**功能：** 创建完整的样例数据，包括：
- 3 个雨水花园点位
- 3 条降雨记录
- 3 条积水记录
- 3 条植物状态记录
- 3 条巡查安排

---

### 2. import - 导入数据文件

```bash
# 导入降雨数据
rain-garden import examples/rainfall_sample.csv --type rainfall

# 导入积水数据
rain-garden import examples/ponding_sample.csv --type ponding

# 指定数据源
rain-garden import file.csv --type rainfall --source "2024年5月气象站数据"
```

**支持格式：** CSV、Excel (.xlsx, .xls)

**降雨数据字段：**
- `garden_id` - 花园ID（必需）
- `date` - 日期
- `rainfall` - 降雨量（mm）

**积水数据字段：**
- `garden_id` - 花园ID（必需）
- `date` - 日期
- `depth` - 积水深度（cm）
- `duration` - 持续时间（分钟）
- `location` - 积水位置
- `recorder` - 记录人
- `photo_reference` - 照片参考（可选）

**输出说明：**
- `[SUCCESS] 成功导入: X 条` - 正常导入
- `[WARNING] 第 N 行: ... 跳过` - 数据问题，需修正后重跑
- `[ERROR] 第 N 行: 处理失败 - ...` - 导入失败

---

### 3. check - 执行数据检查

```bash
# 执行所有检查
rain-garden check

# 只检查特定类型
rain-garden check --type garden      # 花园状态
rain-garden check --type rainfall    # 降雨验证
rain-garden check --type ponding     # 积水匹配
rain-garden check --type plant       # 植物健康
rain-garden check --type inspection  # 巡查安排

# 不保存到历史
rain-garden check --no-save
```

**检查类型说明：**

1. **花园状态检查 (garden_status)**
   - 验证花园是否正常运行
   - 状态：`is_active=True`

2. **降雨验证检查 (rainfall_verification)**
   - 验证降雨数据是否经过确认
   - 状态：`is_verified=True/False`

3. **积水匹配检查 (ponding_matching)**
   - 验证积水记录是否与原始数据匹配
   - 状态：`is_matched=True/False`

4. **植物健康检查 (plant_health)**
   - 检查植物健康状态
   - 状态映射：良好→PASS, 一般→MANUAL, 差→FAIL

5. **巡查安排检查 (inspection_schedule)**
   - 检查巡查任务状态
   - 状态：已完成→PASS, 待执行/已取消→MANUAL, 逾期→FAIL

**检查结果状态说明：**

| 状态 | 含义 | 输出表现 | 处理方式 |
|------|------|----------|----------|
| PASS | 通过检查 | 绿色 [SUCCESS] | 无需处理 |
| MANUAL | 需要人工确认 | 黄色 [WARNING] | 需人工核对数据 |
| FAIL | 检查失败 | 红色 [ERROR] | 需处理后重跑 |

**验收输出示例：**

1. **正常处理（全通过）：**
   ```
   [SUCCESS] 通过检查: 12
   [INFO] 需要人工处理: 0
   [INFO] 检查失败: 0
   [SUCCESS] 样例数据初始化完成！
   ```

2. **失败原因（需处理）：**
   ```
   [ERROR] 第 3 行: garden_id 'invalid-id' 不存在，跳过
   [WARNING] 存在失败记录，请检查数据后重新导入
   
   [INFO] 通过检查: 8
   [WARNING] 需要人工处理: 3
   [ERROR] 检查失败: 1
   [WARNING] 存在失败项，请处理后重新运行检查
   ```

3. **修正后重跑：**
   - 修正数据文件中的问题行
   - 重新执行 `import` 或 `check` 命令
   - 观察 `失败: 0` 和 `检查失败: 0`

---

### 4. history - 查看历史记录

```bash
# 查看所有历史
rain-garden history

# 查看特定类型
rain-garden history --type rainfall
rain-garden history --type ponding
rain-garden history --type plant
rain-garden history --type inspection
rain-garden history --type check

# 筛选特定花园
rain-garden history --garden-id garden-001

# 调整显示数量
rain-garden history --limit 50
```

---

### 5. export - 导出数据

```bash
# 导出所有数据为 JSON
rain-garden export output

# 导出特定类型
rain-garden export rainfall_data --type rainfall --format json
rain-garden export ponding_data --type ponding --format csv
rain-garden export check_results --type check --format excel

# 指定格式
rain-garden export full_report --format json
rain-garden export full_report --format csv
rain-garden export full_report --format excel
```

**导出格式：**
- `json` - JSON 格式，保留完整结构
- `csv` - CSV 格式，合并为单表
- `excel` - Excel 格式，按数据类型分工作表

---

## 数据存储

所有数据存储在当前目录的 `rain_garden_data.json` 文件中。

**数据结构：**
- `gardens` - 雨水花园点位
- `rainfall_records` - 降雨记录
- `ponding_records` - 积水记录
- `plant_status` - 植物状态
- `inspection_schedules` - 巡查安排
- `check_results` - 检查结果历史

---

## 验收场景示例

### 场景 1: 花园点位生效验证

```bash
# 初始化数据
rain-garden init

# 检查花园状态
rain-garden check --type garden
```

**预期输出：**
- 2 个活跃花园显示 PASS
- 1 个停用花园显示 MANUAL

### 场景 2: 降雨导入可靠性

```bash
# 导入降雨数据
rain-garden import examples/rainfall_sample.csv --type rainfall

# 检查验证状态
rain-garden check --type rainfall
```

**预期输出：**
- 新导入记录显示 MANUAL（待验证）
- 样例中已验证记录显示 PASS

### 场景 3: 积水记录匹配验证

```bash
# 导入积水数据
rain-garden import examples/ponding_sample.csv --type ponding

# 检查匹配状态
rain-garden check --type ponding
```

**预期输出：**
- 新导入记录显示 MANUAL（待匹配）
- 已匹配记录显示 PASS

### 场景 4: 修正后重跑

1. 首次导入，部分行失败
2. 编辑 CSV 文件修正错误数据
3. 重新导入
4. 观察 `成功导入` 数量增加，`失败` 数量为 0

---

## 常见问题

**Q: 如何验证花园点位是否生效？**
A: 运行 `rain-garden check --type garden`，PASS 表示生效，MANUAL 表示停用待确认。

**Q: 降雨导入后如何确认可靠性？**
A: 运行 `rain-garden check --type rainfall`，PASS 表示已验证，MANUAL 表示待人工确认。

**Q: 积水记录如何与原始数据对比？**
A: 运行 `rain-garden check --type ponding`，检查 `is_matched` 状态，可结合 `history` 查看详细记录。

**Q: 如何处理检查失败的项？**
A: 
1. 查看失败原因
2. 根据原因修正数据（如验证降雨、匹配积水）
3. 重新运行 `check` 确认 PASS
