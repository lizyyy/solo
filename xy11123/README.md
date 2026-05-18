# 农资门店农资实名台账 CLI

专门用于处理农资门店实名台账数据的命令行工具，解决反复修改同一条记录、身份证尾号缺失、退货记录等问题。

## 功能特性

- ✅ **重复记录合并**：自动识别并合并反复修改的同一条记录，保留最终版本
- ✅ **身份证尾号缺失检测**：自动标记身份证号不完整的记录
- ✅ **退货记录识别**：自动识别退货或负数数量的记录
- ✅ **稳定排序**：按购买日期、购买人姓名、农资名称稳定排序，便于 diff 比较
- ✅ **可追溯性**：每条记录保留源文件和源行号信息
- ✅ **修改历史**：记录每次修改的来源，便于审计
- ✅ **双日志模式**：简洁模式（默认）和详细模式（-v）

## 安装

```bash
npm install
npm link
```

## 使用方法

### 基本用法

```bash
nongzi-ledger data/sample-ledger.csv
```

### 详细模式（显示每条记录处理过程）

```bash
nongzi-ledger data/sample-ledger.csv -v
```

### 保留所有记录（不合并重复修改）

```bash
nongzi-ledger data/sample-ledger.csv -k
```

### 指定输出文件

```bash
nongzi-ledger data/sample-ledger.csv -o output/my-output.csv -r output/my-report.md
```

## 项目结构

```
.
├── bin/
│   └── nongzi-ledger.js      # CLI 入口脚本
├── src/
│   ├── index.js              # 命令行解析器
│   ├── processor.js          # 核心处理器
│   └── report.js             # 报告生成器
├── data/
│   └── sample-ledger.csv     # 样例数据
├── test/
│   └── run-test.js           # 测试脚本
├── output/                   # 输出目录（自动创建）
└── package.json
```

## 核心业务列

输出文件按以下稳定顺序排列关键业务列：

1. 序号
2. 购买日期
3. 购买人姓名
4. 身份证号
5. 联系电话
6. 住址
7. 农资名称
8. 规格型号
9. 数量
10. 单位
11. 单价
12. 金额
13. 生产厂家
14. 农药登记证号
15. 销售人
16. 备注
17. 记录状态
18. _源文件（附加）
19. _源行号（附加）
20. _修改次数（附加）

## 运行测试

```bash
npm test
```

测试脚本会运行三种模式并在 output/ 目录生成结果文件。

## 比较两次运行差异

由于输出使用稳定排序，您可以直接使用 diff 命令比较两次处理结果：

```bash
diff output/ledger-cleaned.csv output/old-ledger-cleaned.csv
```

## 许可证

MIT