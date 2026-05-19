# 门店品控管理系统

一个专门为门店品控负责人设计的后端系统，用于管理菜品留样、冰箱温度记录和废弃记录，实现品控追溯链路的完整闭环。

## 核心功能

- ✅ **数据导入**: 支持从 Excel 导入留样记录、从 CSV 导入温度日志
- ✅ **数据校验**: 自动校验导入数据，坏记录不会直接吞掉
- ✅ **错误追溯**: 保留原始位置、失败原因和修改建议
- ✅ **批量操作**: 批量复核记录，失败重试不破坏已成功记录
- ✅ **状态管理**: 完整的记录状态变更流程（待复核 → 已复核）
- ✅ **报告生成**: 支持导出月度报告、导出错误记录

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 生成样例数据

```bash
npm run dev -- sample-data
```

这会生成两个文件:
- `data/sample_retention.xlsx` - 留样记录样例（含 3 条正常数据 + 2 条错误数据）
- `data/temperature_log.csv` - 温度记录样例（含 5 条正常数据 + 2 条错误数据）

### 3. 导入数据

**导入留样记录:**
```bash
npm run dev -- import --type sample --file data/sample_retention.xlsx
```

**导入温度记录:**
```bash
npm run dev -- import --type temperature --file data/temperature_log.csv
```

导入完成后会显示:
- 总计记录数
- 成功记录数
- 失败记录数及原因

### 4. 查看待复核记录

```bash
npm run dev -- pending
```

### 5. 复核记录

**复核所有待复核记录:**
```bash
npm run dev -- verify-all --user 品控主管
```

**复核指定记录:**
```bash
npm run dev -- verify --type sample --ids id1,id2,id3 --user 品控主管
```

### 6. 查看复核概要

```bash
# 查看今日概要
npm run dev -- review

# 查看指定日期
npm run dev -- review --date 2024-05-20
```

### 7. 导出数据

**导出月度报告:**
```bash
npm run dev -- export --type monthly --year 2024 --month 5
```

**导出留样记录:**
```bash
npm run dev -- export --type sample --start 2024-05-01 --end 2024-05-31
```

**导出温度记录:**
```bash
npm run dev -- export --type temperature --start 2024-05-01 --end 2024-05-31
```

**导出错误记录:**
```bash
npm run dev -- export --type errors --import-id <导入记录ID>
```

### 8. 完整流程测试

```bash
npm run dev -- test
```

这个命令会自动执行完整流程：
1. 生成样例数据
2. 导入留样和温度记录（包含故意设计的错误数据）
3. 查看待复核记录
4. 批量复核所有记录
5. 查看复核概要
6. 导出月度报告

## 命令详解

### import - 导入数据

| 参数 | 说明 | 必填 |
|------|------|------|
| --type, -t | 导入类型: sample\|temperature | 是 |
| --file, -f | 文件路径 | 是 |
| --user, -u | 操作人 | 否，默认 system |

**示例:**
```bash
npm run dev -- import -t sample -f ./data/my_samples.xlsx
```

### retry - 重试失败的导入

| 参数 | 说明 | 必填 |
|------|------|------|
| --import-id, -i | 导入记录ID | 是 |

**示例:**
```bash
npm run dev -- retry -i xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

### review - 查看复核概要

| 参数 | 说明 | 必填 |
|------|------|------|
| --date, -d | 日期 (YYYY-MM-DD) | 否，默认今日 |

**示例:**
```bash
npm run dev -- review -d 2024-05-20
```

### verify - 批量复核记录

| 参数 | 说明 | 必填 |
|------|------|------|
| --type, -t | 记录类型: sample\|temperature | 是 |
| --ids, -i | 记录ID列表，逗号分隔 | 是 |
| --user, -u | 复核人 | 否，默认 system |

**示例:**
```bash
npm run dev -- verify -t sample -i aaaa,bbbb,cccc
```

### verify-all - 复核所有待复核记录

| 参数 | 说明 | 必填 |
|------|------|------|
| --user, -u | 复核人 | 否，默认 system |

**示例:**
```bash
npm run dev -- verify-all -u 品控主管
```

### export - 导出数据

| 参数 | 说明 | 必填 |
|------|------|------|
| --type, -t | 导出类型: sample\|temperature\|all\|monthly\|errors | 是 |
| --start, -s | 开始日期 (YYYY-MM-DD) | 否，默认今日 |
| --end, -e | 结束日期 (YYYY-MM-DD) | 否，默认今日 |
| --output, -o | 输出目录 | 否，默认 ./data/export |
| --year, -y | 年份（月度报告用） | 否，默认今年 |
| --month, -m | 月份（月度报告用） | 否，默认本月 |
| --import-id, -i | 导入记录ID（导出错误用） | 条件必填 |

**示例:**
```bash
# 导出月度报告
npm run dev -- export -t monthly -y 2024 -m 5

# 导出错误记录
npm run dev -- export -t errors -i <导入记录ID>
```

## 数据文件格式

### 留样记录 Excel 格式

| 列名 | 说明 | 必填 |
|------|------|------|
| 日期 | YYYY-MM-DD 格式 | 是 |
| 菜品名称 | - | 是 |
| 菜品类型 | 热菜/凉菜/主食等 | 是 |
| 数量 | 大于0的数字 | 是 |
| 留样人 | - | 是 |
| 留样时间 | YYYY-MM-DD HH:mm:ss 格式 | 是 |
| 存放位置 | - | 是 |
| 废弃日期 | YYYY-MM-DD 格式 | 是 |
| 备注 | - | 否 |

### 温度记录 CSV 格式

| 列名 | 说明 | 必填 |
|------|------|------|
| 日期 | YYYY-MM-DD 格式 | 是 |
| 冰箱编号 | - | 是 |
| 冰箱名称 | - | 是 |
| 温度 | 数字 | 是 |
| 最低温度 | 温度阈值下限 | 是 |
| 最高温度 | 温度阈值上限 | 是 |
| 测量人 | - | 是 |
| 测量时间 | YYYY-MM-DD HH:mm:ss 格式 | 是 |
| 备注 | - | 否 |

## 数据库结构

数据存储在 SQLite 数据库 `data/quality_control.db` 中，包含以下表：

- `sample_retention` - 留样记录表
- `temperature_log` - 温度记录表
- `discard_record` - 废弃记录表
- `import_record` - 导入批次记录表
- `failed_record` - 失败记录详情表

## 项目结构

```
├── src/
│   ├── models/
│   │   ├── types.ts          # 类型定义
│   │   └── database.ts       # 数据库初始化
│   ├── services/
│   │   ├── validation.ts     # 数据校验服务
│   │   ├── importService.ts  # 数据导入服务
│   │   ├── qualityService.ts # 品控业务服务
│   │   └── exportService.ts  # 导出服务
│   ├── sampleData.ts         # 样例数据生成
│   └── cli.ts                # CLI 入口
├── data/                     # 数据目录
│   ├── export/               # 导出文件
│   └── quality_control.db    # SQLite 数据库
├── package.json
├── tsconfig.json
└── README.md
```

## 常见问题

**Q: 导入失败的数据会怎么样？**
A: 失败的数据会完整保留在 `failed_record` 表中，包含原始数据、错误原因和修改建议，可以随时导出查看。

**Q: 批量操作部分失败怎么办？**
A: 成功的记录会正常保存，失败的记录会单独列出，可以单独修复后重试，不会影响已经成功的记录。

**Q: 温度异常怎么处理？**
A: 系统自动判断温度是否在正常范围内，异常温度会在复核概要中高亮显示。

## 技术栈

- **Node.js** - 运行环境
- **TypeScript** - 类型安全
- **SQLite** - 本地数据库
- **ExcelJS** - Excel 文件处理
- **csv-parser** - CSV 文件处理
- **yargs** - CLI 命令框架

## License

MIT