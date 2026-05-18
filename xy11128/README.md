# 进口食品店临期批次调价 CLI

## 项目说明

本工具用于进口食品店临期商品的统一调价处理，将正常结果和异常结果分开输出，方便人工复核。

## 业务场景覆盖

- 拆箱销售：整箱商品拆零后单独定价
- 组合装：主商品与赠品/子商品关联处理
- 可复跑：首次调价失败的记录可重新跑批处理

## 文件用途说明

| 文件路径 | 用途说明 |
|---------|---------|
| [data/input.csv](file:///Users/mac/pro/solo/workspaces/xy11128/data/input.csv) | 临期批次调价样例输入数据，包含18条进口食品记录，覆盖多种业务场景和异常情况 |
| [src/cli.js](file:///Users/mac/pro/solo/workspaces/xy11128/src/cli.js) | CLI 主程序，实现数据验证、调价计算、结果分离功能 |
| [output/normal_records.csv](file:///Users/mac/pro/solo/workspaces/xy11128/output/normal_records.csv) | 正常调价结果文件（执行后生成） |
| [output/abnormal_records.csv](file:///Users/mac/pro/solo/workspaces/xy11128/output/abnormal_records.csv) | 异常待复核结果文件（执行后生成） |

## 安装依赖

```bash
npm install
```

## 使用命令（按真实处理顺序）

### 1. 预览调价结果

先预览不生成文件，检查数据完整性：

```bash
npm run preview
# 或
node src/cli.js preview --input data/input.csv
```

### 2. 正式执行调价

确认预览无误后，执行正式调价，生成结果文件：

```bash
npm run execute
# 或
node src/cli.js execute --input data/input.csv
```

### 3. 查看调价报告

查看汇总报告，重点关注异常记录：

```bash
npm run report
# 或
node src/cli.js report
```

## 调价规则

| 剩余保质期 | 折扣率 | 定价策略 |
|-----------|-------|---------|
| ≤7天      | 70% off | 紧急清仓 |
| ≤14天     | 50% off | 深度折扣 |
| ≤30天     | 30% off | 常规临期 |
| >30天     | 15% off | 轻度临期 |

**注意**：调整后价格不低于进货价的1.1倍。

## 异常检测规则

- 批次号或SKU为空
- 库存数量非数字、负数或为0
- 剩余保质期非数字、负数或为0
- 进货价缺失或无效
- 原售价无效
