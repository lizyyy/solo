# 摄影器材租赁店相机租金结算 CLI

专为摄影器材租赁店打造的租金结算命令行工具，支持真实业务场景：分批归还、镜头滤镜丢失、逾期计费、物品损坏赔偿等。

## 功能特性

- ✅ **真实业务字段**：订单号、客户姓名、相机/镜头型号、租期、押金等完整字段
- 📦 **分批归还检测**：自动识别部分归还的订单，提示剩余物品
- 🔍 **滤镜丢失检测**：自动检测是否归还滤镜，计算赔偿费用
- 📊 **详细结算报告**：基础租金、逾期费、赔偿费、押金退还等明细
- ⚠️ **数据异常摘要**：保留源文件和行号，给出修复建议（运营同事无需查看源码）
- 🔄 **可复跑输出**：修复数据后重新执行命令即可重新计算
- 📁 **导出CSV结果**：结算结果、业务预警、数据异常分别导出

## 文件用途说明

```
camera-rental-settlement/
├── package.json              # 项目配置和依赖
├── bin/
│   └── rental-settle.js      # CLI命令入口
├── src/
│   ├── calculator.js         # 租金结算核心逻辑（分批归还、滤镜丢失等）
│   ├── file-reader.js        # 文件读取器（支持CSV/JSON）
│   └── report-generator.js   # 报告生成器（控制台输出+CSV导出）
├── examples/
│   ├── 租赁订单-202405.csv   # 真实业务样例数据（含异常数据）
│   └── run-example.js        # 一键运行示例脚本
└── output/                   # 结算结果输出目录（自动创建）
```

## 安装方法

```bash
# 进入项目目录
cd /path/to/project

# 安装依赖
npm install

# 全局安装（可选，方便在任意目录使用）
npm link
```

## 快速开始

### 方式一：运行示例数据

```bash
npm run test
# 或直接运行
node examples/run-example.js
```

### 方式二：使用CLI命令

#### 1. 查看帮助

```bash
# 查看所有命令
node bin/rental-settle.js --help

# 查看字段说明
node bin/rental-settle.js fields
```

#### 2. 生成数据模板

```bash
node bin/rental-settle.js template ./我的订单.csv
```

#### 3. 计算租金结算

```bash
# 基础用法（控制台输出 + 导出CSV）
node bin/rental-settle.js calculate examples/租赁订单-202405.csv

# 指定输出目录
node bin/rental-settle.js calculate examples/租赁订单-202405.csv -o ./我的结果

# 仅在控制台显示，不导出文件
node bin/rental-settle.js calculate examples/租赁订单-202405.csv --no-export
```

## 数据格式说明

### 必填字段

| 字段名 | 说明 | 示例 |
|--------|------|------|
| orderId | 订单编号（唯一标识） | RENT20240501 |
| customerName | 客户姓名 | 张小明 |
| cameraModel | 相机型号 | Sony A7M4 |
| rentalStartDate | 租用开始日期 | 2024-05-01 |
| rentalEndDate | 租用结束日期 | 2024-05-03 |
| dailyRate | 日租金（元/天） | 299 |
| depositAmount | 押金金额（元） | 5000 |

### 可选字段

| 字段名 | 说明 | 示例 |
|--------|------|------|
| lensModel | 镜头型号 | Sony 24-70mm F2.8 GM II |
| filterIncluded | 是否包含滤镜 | 是/否 |
| actualReturnDate | 实际归还日期 | 2024-05-04 |
| itemsReturned | 已归还物品（逗号分隔） | 相机,镜头,滤镜 |
| damageReported | 是否有损坏 | 是/否 |
| notes | 备注 | 婚礼拍摄 |

## 业务规则

### 计费规则
- **基础租金** = 实际租用天数 × 日租金
- **逾期费用** = 逾期天数 × 日租金 × 1.5
- **押金结算** = 押金 - 总费用（正数退还，负数补差价）

### 赔偿规则
- 相机丢失：¥5000
- 镜头丢失：¥2000
- 滤镜丢失：¥200
- 物品损坏：¥500

### 分批归还检测
- 对比"已归还物品"与应归还物品
- 物品不全时标记为"分批归还"
- 提示未归还物品，建议确认后续归还时间

### 滤镜丢失检测
- filterIncluded = "是"时检测是否归还滤镜
- 自动计算滤镜赔偿费用
- 给出业务预警和处理建议

## 数据异常摘要示例

```
【数据异常摘要】
  运营同事可根据以下信息直接修改原始数据文件

  1. 数据错误
    来源文件: /Users/mac/pro/solo/workspaces/xy11176/examples/租赁订单-202405.csv
    行号: 第 7 行
    错误原因: 日租金必须是正数，当前值: -100
    订单信息: 订单号=RENT20240507, 客户=周慧敏
    修复建议: 请输入有效的日租金金额（如：459），不能为负数或零
```

## 完整使用示例

### 步骤1：准备数据文件

编辑 `租赁订单.csv`：

```csv
orderId,customerName,cameraModel,lensModel,filterIncluded,rentalStartDate,rentalEndDate,dailyRate,depositAmount,actualReturnDate,itemsReturned,damageReported,notes
RENT20240501,张小明,Sony A7M4,Sony 24-70mm GM,是,2024-05-01,2024-05-03,299,5000,2024-05-03,相机,镜头,滤镜,否,正常归还
RENT20240502,李小红,Canon R5,Canon RF 70-200mm,是,2024-05-05,2024-05-10,399,8000,2024-05-12,相机,镜头,是,逾期2天，镜头有划痕
RENT20240503,王小华,Nikon Z6 II,Nikon Z 24-120mm,是,2024-05-08,2024-05-12,259,4000,2024-05-12,相机,镜头,否,滤镜丢失
```

### 步骤2：执行结算

```bash
node bin/rental-settle.js calculate 租赁订单.csv
```

### 步骤3：查看结果

输出目录包含3个文件：
1. `租赁订单-结算结果.csv` - 完整的结算明细
2. `租赁订单-业务预警.csv` - 分批归还、滤镜丢失等预警
3. `租赁订单-数据异常.csv` - 数据错误及修复建议

### 步骤4：修复数据并重跑

根据异常摘要修改原始数据，然后重新执行：

```bash
node bin/rental-settle.js calculate 租赁订单.csv
```

## 业务场景演示

### 场景1：分批归还

**订单数据：**
```
orderId: RENT20240505
customerName: 刘美丽
itemsReturned: 相机
lensModel: Sony 16-35mm F2.8 GM
filterIncluded: 是
```

**预警输出：**
```
【业务预警】
  1. 分批归还警告
    文件: xxx.csv 第 6 行
    订单: RENT20240505 - 刘美丽
    已归还: 相机
    未归还: 镜头, 滤镜
    建议: 请确认剩余物品归还时间，未归还物品将按日计算逾期费用
```

### 场景2：滤镜丢失

**订单数据：**
```
filterIncluded: 是
itemsReturned: 相机,镜头
```

**预警输出：**
```
【业务预警】
  1. 镜头滤镜丢失警告
    文件: xxx.csv 第 4 行
    订单: RENT20240503 - 王小华
    赔偿费用: ¥200
    建议: 已自动计算滤镜赔偿费用，可与客户协商是否免赔
```

### 场景3：可复跑验证

第一次运行检测到数据异常 → 修改CSV文件 → 再次运行 → 异常消除，结算完成

## 命令参考

```bash
# 计算结算
rental-settle calculate <file> [options]
  -o, --output <directory>   指定输出目录（默认: ./output）
  --no-export                仅控制台显示，不导出CSV

# 生成模板
rental-settle template [output]

# 查看字段说明
rental-settle fields

# 查看版本
rental-settle --version
```

## 常见问题

**Q: 如何处理多批次归还的订单？**
A: 每次归还后更新 `itemsReturned` 字段，重新执行计算即可。系统会自动识别剩余未归还物品。

**Q: 赔偿金额可以调整吗？**
A: 当前版本使用固定赔偿标准。如需自定义，可修改 `src/calculator.js` 中的 `calculateCompensation` 方法。

**Q: 数据异常会影响其他订单的计算吗？**
A: 不会。异常订单会被跳过，其他正常订单会继续计算并输出结果。

**Q: 导出的CSV可以用Excel打开吗？**
A: 可以，CSV格式完全兼容Excel、WPS等表格软件。

## 技术栈

- Node.js
- Commander.js (CLI框架)
- csv-parser / csv-writer (CSV处理)
- chalk (终端彩色输出)
