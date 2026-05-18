# 报销预算文件科目调拨复算 CLI

一个离线、无依赖网络的报销预算科目调拨复算工具，支持解析、校验、汇总和异常报告生成。

## 功能特性

- ✅ **文件解析**: 支持 CSV 和 Excel 格式的报销数据文件
- ✅ **数据校验**: 字段完整性、科目有效性、部门匹配校验
- ✅ **预算汇总**: 调拨后预算占用计算，支持跨部门调拨
- ✅ **异常处理**: 遇到退款、跨部门、科目停用继续处理
- ✅ **报告生成**: 汇总报告、异常报告、调拨明细 CSV
- ✅ **复跑稳定**: 幂等设计，多次运行结果一致

## 安装

```bash
# 安装依赖
npm install

# 全局安装 CLI
npm link
```

## 快速开始

### 1. 查看科目列表

```bash
budget-recalc list-subjects
```

### 2. 校验文件格式

```bash
budget-recalc validate sample_data.csv
```

### 3. 执行完整复算

```bash
# 基本用法
budget-recalc run sample_data.csv

# 指定输出目录
budget-recalc run sample_data.csv -o ./my_output

# 带初始预算
budget-recalc run sample_data.csv --initial-budget '{"差旅费":50000,"办公费":30000}'
```

## 完整命令链示例

```bash
# 1. 安装依赖
npm install

# 2. 链接 CLI
npm link

# 3. 查看科目列表
budget-recalc list-subjects

# 4. 校验样例数据
budget-recalc validate sample_data.csv

# 5. 执行复算
budget-recalc run sample_data.csv

# 6. 查看输出结果
ls output/
```

## 样例数据说明

`sample_data.csv` 包含以下测试场景：

| 报销单号 | 场景 | 预期结果 |
|---------|------|---------|
| BX2025001 | 正常调拨 | 差旅费→办公费，处理成功 |
| BX2025002 | 正常调拨 | 业务招待费→市场推广费，处理成功 |
| BX2025003 | 正常调拨 | 咨询服务费→研发费用，处理成功 |
| BX2025004 | 正常调拨 | 差旅费→员工福利费，处理成功 |
| BX2025005 | 同科目调拨 | 无需调拨，跳过处理 |
| BX2025006 | 正常调拨 | 设备采购费→研发费用，处理成功 |
| BX2025007 | 退款冲销 | 负金额，执行预算冲销 |
| BX2025008 | 科目停用 | 调拨到停用科目，跳过处理 |
| BX2025009 | 无效科目 | 原科目无效，校验错误 |
| BX2025010 | 金额为0 | 金额无效，校验错误 |
| BX2025011 | 停用科目 | 调拨到停用科目，跳过处理 |
| BX2025012 | 同科目调拨 | 无需调拨，跳过处理 |

## 输出文件说明

运行 `budget-recalc run` 后，`output` 目录会生成 3 个文件：

1. **budget_recalc_汇总报告_{timestamp}.json**
   - 复算批次和时间
   - 解析、校验、汇总统计
   - 各科目调拨前后占用对比
   - 各部门调拨汇总

2. **budget_recalc_异常报告_{timestamp}.json**
   - 错误明细（含行号、报销单号）
   - 警告明细（含行号、报销单号）
   - 跳过处理记录（含跳过原因）

3. **budget_recalc_调拨明细_{timestamp}.csv**
   - 所有成功处理的调拨记录
   - 包含调拨类型、处理状态、处理备注

## 项目结构

```
.
├── src/
│   ├── cli.js          # CLI 入口和命令定义
│   ├── parser.js       # 文件解析模块
│   ├── validator.js    # 数据校验模块
│   ├── aggregator.js   # 预算汇总模块
│   └── reporter.js     # 报告生成模块
├── sample_data.csv     # 样例数据
├── package.json
└── README.md
```

## 模块说明

### parser.js (解析模块)
- 读取 CSV/Excel 文件
- 验证必填字段存在
- 转换记录格式

### validator.js (校验模块)
- 验证预算科目有效性
- 检查部门有效性
- 识别退款记录
- 检测停用科目
- 校验金额合法性

### aggregator.js (汇总模块)
- 计算调拨后预算占用
- 处理退款冲销逻辑
- 跳过无效记录（继续处理剩余）
- 按科目和部门汇总

### reporter.js (报告模块)
- 生成结构化 JSON 报告
- 控制台彩色输出
- 导出 CSV 明细

## 测试

```bash
# 使用样例数据运行测试
node src/cli.js run sample_data.csv
```

## 验收标准

运行 `budget-recalc run sample_data.csv` 应满足：

1. 总记录数：12 条
2. 校验通过：10 条
3. 校验错误：2 条（BX2025009 无效科目、BX2025010 金额0）
4. 处理记录：6 条（正常调拨 + 退款）
5. 跳过记录：6 条（同科目3条 + 停用科目2条 + 错误1条）
6. 退款记录：1 条（BX2025007）
7. 异常报告中清晰标注各异常原因
