# 印刷车间品控CLI工具 (PQC)

一个基于SQLite的轻量级印刷车间品质控制命令行工具，管理Lab颜色测量数据、纸张批次、返工记录等。

## 功能特性

- **阈值管理**: 支持标准Lab值和公差配置
- **纸张批次管理**: 纸张入库和批次追踪
- **印刷批次管理**: 批量导入测量数据
- **自动判定**: Lab值自动比对和合格判定
- **留样标记**: 接近阈值或超差样本自动标记
- **复核流程**: 人工复核和状态更新
- **质检单生成**: 完整的检验报告
- **趋势分析**: 质量趋势统计
- **幂等性**: 重复导入结果稳定

## 安装

```bash
npm install
npm run build
npm link
```

## 使用说明

### 1. 导入阈值配置

```bash
pqc import-thresholds examples/thresholds.csv
```

CSV格式:
```csv
name,standardL,standardA,standardB,deltaLMax,deltaAMax,deltaBMax,deltaEMax
```

### 2. 导入纸张批次

```bash
pqc import-paper examples/paper.csv
```

CSV格式:
```csv
batchNo,supplier,paperType,weight,receivedDate,status,notes
```

### 3. 导入印刷批次及测量数据

```bash
pqc import-batch examples/print_batch.csv
```

CSV格式参考 `examples/print_batch.csv`

### 4. 评估批次质量

```bash
pqc evaluate PRINT202405001
```

### 5. 查看批次测量数据

```bash
pqc measurements PRINT202405001
```

### 6. 复核批次

```bash
pqc review PRINT202405001 approve 王经理 -r "经复核，色差在可接受范围内"
```

### 7. 生成质检单

```bash
pqc report PRINT202405001 质检员 -o report.txt
```

### 8. 查看质量趋势

```bash
pqc trend -d 30
```

### 9. 列出所有阈值

```bash
pqc list-thresholds
```

### 10. 列出所有印刷批次

```bash
pqc list-batches
```

## 数据存储

数据库文件默认位置: `~/.pqc/quality-control.db`

## 项目结构

```
.
├── src/
│   ├── cli.ts              # CLI入口
│   ├── types.ts            # 类型定义
│   ├── database/
│   │   ├── db.ts           # 数据库操作
│   │   └── schema.ts       # 数据库初始化
│   └── services/
│       ├── qualityService.ts  # 品质判定服务
│       └── importService.ts   # 导入服务
├── examples/                # 示例CSV文件
├── package.json
└── tsconfig.json
```
