# 售货机临期品调拨 CLI - 验收说明

## 一、验收概述

本工具用于管理多点位售货机的临期商品调拨和降价，确保过期和补货记录同步。

## 二、安装和环境准备

### 2.1 系统要求

- Node.js >= 16.0.0
- npm 或 yarn 包管理器

### 2.2 安装依赖

```bash
npm install
```

### 2.3 运行验收测试

```bash
npm test
```

## 三、验收场景

### 场景 1: 正常处理 - 初始化样例数据

**操作:**
```bash
node src/index.js init
```

**预期输出 (代表通过):**
- ✓ 绿色的 "初始化完成！" 提示
- 显示点位、商品、库存、效期扫描的插入数量
- 退出码: 0

**验证要点:**
- 4个点位数据已插入
- 5个商品数据已插入  
- 10条库存记录已插入
- 6条效期扫描记录已插入

---

### 场景 2: 正常处理 - 执行全面检查

**操作:**
```bash
node src/index.js check
```

**预期输出 (代表通过):**
- 显示 "检查结果汇总" 表格
- 包含以下指标:
  - 总点位数量
  - 总商品数量
  - 临期商品数量
  - 紧急临期数量
  - 调拨建议数量
  - 降价建议数量
  - 发现问题数量
  - 通过检查项
  - 失败检查项

**输出含义说明:**

| 输出状态 | 含义 | 是否需要人工处理 |
|---------|------|-----------------|
| ✓ 绿色 "检查通过！所有关键指标正常。" | 无严重和警告级别问题 | 否 |
| ✗ 红色 "检查失败！存在需要紧急处理的问题。" | 存在严重级别问题 | **是 - 紧急** |
| ⚠ 黄色 "检查完成，存在需要关注的问题..." | 存在警告级别问题 | **是 - 建议** |

---

### 场景 3: 正常处理 - 导入有效数据

**操作:**
```bash
node src/index.js import test/sample_inventory_good.csv -t inventory -d
```

**预期输出 (代表通过):**
- 显示 "读取到 10 条记录"
- 显示 "10 条记录验证通过"
- 显示 "试运行完成。上述记录将会被导入。"
- 退出码: 0

---

### 场景 4: 失败原因 - 导入无效数据

**操作:**
```bash
node src/index.js import test/sample_inventory_bad.csv -t inventory
```

**预期输出 (代表需要人工处理):**
- 红色显示 "发现 X 个验证错误:"
- 列出具体的错误原因，例如:
  - `quantity 不能小于 0`
  - `expiry_date 日期格式无效`
  - `location_id 不能为空`
  - `product_id 不能为空`

**失败原因示例及处理方式:**

| 错误信息 | 原因 | 处理方式 |
|---------|------|---------|
| `quantity 不能小于 0` | 库存数量为负数 | 修正为非负整数 |
| `expiry_date 日期格式无效` | 日期格式错误 | 使用 YYYY-MM-DD 格式 |
| `location_id 不能为空` | 缺少点位ID | 补充点位ID字段 |
| `product_id 不能为空` | 缺少商品ID | 补充商品ID字段 |

---

### 场景 5: 修正后重跑 - 导入修正后的数据

**操作步骤:**

1. 首先导入错误数据，观察失败:
```bash
node src/index.js import test/sample_inventory_bad.csv -t inventory -d
```

2. 修正数据（使用已修正的 sample_inventory_fixed.csv）

3. 重新导入修正后的数据:
```bash
node src/index.js import test/sample_inventory_fixed.csv -t inventory -d
```

**预期输出 (代表修正成功):**
- 显示 "10 条记录验证通过"
- 没有 "验证错误" 的提示
- 显示 "试运行完成。上述记录将会被导入。"
- 退出码: 0

---

### 场景 6: 查看历史记录

**操作:**
```bash
node src/index.js history
```

**预期输出:**
- 显示 "历史检查记录" 表格
- 包含列: ID、检查日期、点位、商品、临期、紧急、问题、状态

**状态列含义:**

| 状态 | 颜色 | 含义 |
|-----|------|------|
| 通过 | 绿色 | 检查通过，无问题 |
| 警告 | 黄色 | 存在警告级别问题 |
| 失败 | 红色 | 存在严重级别问题 |

**查看详细记录:**
```bash
node src/index.js history --id 1
```

---

### 场景 7: 导出检查结果

**操作:**

导出所有数据 (JSON):
```bash
node src/index.js export -t all -f json
```

导出问题清单 (CSV):
```bash
node src/index.js export -t issues -f csv
```

导出调拨建议:
```bash
node src/index.js export -t transfers
```

导出临期商品列表:
```bash
node src/index.js export -t expiring
```

**预期输出:**
- 显示 "导出成功！"
- 显示记录数
- 显示输出文件路径

---

## 四、检查问题类型说明

### 4.1 严重问题 (Critical) - 红色

| 问题类型 | 描述 | 处理建议 |
|---------|------|---------|
| `expired_product` | 商品已过期 | 立即下架处理 |
| `critical_expiry_price_reduction` | 紧急临期需降价 | 执行5折降价 |
| `missing_expiry_scan` | 临期商品缺少效期扫描 | 立即补录扫描 |

### 4.2 警告问题 (Warning) - 黄色

| 问题类型 | 描述 | 处理建议 |
|---------|------|---------|
| `transfer_suggested` | 建议调拨到其他点位 | 执行调拨操作 |
| `expiry_date_mismatch` | 效期日期不一致 | 核对库存和扫描数据 |
| `missing_inventory` | 缺少库存记录 | 补充库存配置 |

### 4.3 信息提示 (Info) - 蓝色

| 问题类型 | 描述 | 处理建议 |
|---------|------|---------|
| `zero_quantity` | 库存为0 | 可选择补货或清理 |
| `expiry_scan_stale` | 扫描数据过时 | 建议重新扫描 |

---

## 五、退出码含义

| 退出码 | 含义 | 是否通过验收 |
|-------|------|-------------|
| 0 | 执行成功 | ✓ 是 |
| 1 | 检查失败或执行出错 | ✗ 否 |

---

## 六、手动验收步骤

### 步骤 1: 安装依赖
```bash
npm install
```

### 步骤 2: 初始化样例数据
```bash
node src/index.js init
```
**验证:** 看到 "初始化完成！" 和各项插入数量

### 步骤 3: 执行首次检查
```bash
node src/index.js check
```
**验证:** 看到检查结果汇总表格，包含各类统计数据

### 步骤 4: 测试导入功能
```bash
node src/index.js import test/sample_inventory_good.csv -t inventory -d
```
**验证:** 看到 "10 条记录验证通过"

### 步骤 5: 测试错误导入
```bash
node src/index.js import test/sample_inventory_bad.csv -t inventory -d
```
**验证:** 看到具体的验证错误信息

### 步骤 6: 测试修正后导入
```bash
node src/index.js import test/sample_inventory_fixed.csv -t inventory -d
```
**验证:** 看到 "10 条记录验证通过"，无错误

### 步骤 7: 查看历史记录
```bash
node src/index.js history
```
**验证:** 看到历史检查记录列表

### 步骤 8: 导出结果
```bash
node src/index.js export -t issues -f json
```
**验证:** 看到 "导出成功！" 提示

### 步骤 9: 运行完整测试
```bash
npm test
```
**验证:** 所有 10 个测试通过

---

## 七、数据文件格式说明

### 7.1 点位数据 (locations)

| 字段 | 类型 | 必填 | 说明 |
|-----|------|-----|------|
| id | string | ✓ | 点位唯一标识 |
| name | string | ✓ | 点位名称 |
| address | string | ✗ | 点位地址 |

示例:
```csv
id,name,address
LOC001,地铁站A出口售货机,地铁1号线A出口
```

### 7.2 商品数据 (products)

| 字段 | 类型 | 必填 | 说明 |
|-----|------|-----|------|
| id | string | ✓ | 商品唯一标识 |
| name | string | ✓ | 商品名称 |
| category | string | ✗ | 商品分类 |
| unit | string | ✗ | 计量单位 |
| price | number | ✓ | 原价 |

示例:
```csv
id,name,category,unit,price
PRD001,瓶装矿泉水,饮料,瓶,2.5
```

### 7.3 库存数据 (inventory)

| 字段 | 类型 | 必填 | 说明 |
|-----|------|-----|------|
| location_id | string | ✓ | 点位ID |
| product_id | string | ✓ | 商品ID |
| quantity | integer | ✓ | 库存数量 (>=0) |
| batch_number | string | ✗ | 批次号 |
| expiry_date | date | ✓ | 有效期 (YYYY-MM-DD) |

示例:
```csv
location_id,product_id,quantity,batch_number,expiry_date
LOC001,PRD001,20,B20260401,2026-06-10
```

### 7.4 效期扫描数据 (expiry-scans)

| 字段 | 类型 | 必填 | 说明 |
|-----|------|-----|------|
| location_id | string | ✓ | 点位ID |
| product_id | string | ✓ | 商品ID |
| batch_number | string | ✗ | 批次号 |
| expiry_date | date | ✓ | 有效期 |
| scan_date | date | ✓ | 扫描日期 |
| source | string | ✗ | 扫描来源 |

示例:
```csv
location_id,product_id,batch_number,expiry_date,scan_date,source
LOC001,PRD002,B20260505,2026-06-01,2026-05-10,manual
```

---

## 八、边界条件测试

### 8.1 售货机点位边界

- 单个点位检查: `node src/index.js check -l LOC001`
- 跨点位调拨: 自动检测源点位和目标点位的库存差异

### 8.2 临期效期边界

- 临界期 (7天内): 触发调拨建议
- 紧急期 (3天内): 触发降价建议 (5折)
- 已过期: 标记为严重问题

### 8.3 调拨降价边界

- 调拨条件: 目标点位库存 < 10
- 降价条件: 临期 <= 3天
- 调拨数量: `min(源库存, 10 - 目标库存)`

---

## 九、常见问题

### Q1: 如何开始使用?
```bash
npm install
node src/index.js init
node src/index.js check
```

### Q2: 如何修改临期阈值?
编辑 `src/config.js`:
```javascript
const EXPIRY_THRESHOLD_DAYS = 7;  // 临期阈值
const CRITICAL_EXPIRY_DAYS = 3;   // 紧急阈值
```

### Q3: 数据存储在哪里?
- 默认位置: `./data/vending.db` (SQLite 数据库)
- 可通过环境变量 `VENDING_DATA_DIR` 自定义

### Q4: 如何重置数据?
```bash
node src/index.js init --force
```

### Q5: 如何导出数据?
```bash
node src/index.js export -t issues -f csv
```

---

## 十、验收结论

完成以下所有步骤即视为验收通过:

1. ✓ `npm install` 安装成功
2. ✓ `node src/index.js init` 初始化样例数据成功
3. ✓ `node src/index.js check` 执行检查并显示结果
4. ✓ 能够区分正常处理、失败原因、修正后重跑三种场景
5. ✓ `node src/index.js history` 查看历史记录
6. ✓ `node src/index.js export` 导出检查结果
7. ✓ `npm test` 所有测试用例通过
