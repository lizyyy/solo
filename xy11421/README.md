# 二手车整备多源导入巡检工具

一个用于二手车整备业务的多源数据导入、巡检、分析的CLI工具。

## 功能特性

- **多源数据导入**: 支持检测单、维修报价、照片清单、班次记录、手工改价表五种数据源
- **脏数据检测**: 自动识别缺字段、跨日、改名、金额/数量冲突等异常记录
- **权限控制**: 录入、复核、主管、只读四种角色，权限分明
- **历史追溯**: 记录每一步操作的前后差异，支持审计
- **返厂分析**: 追踪多次返厂车辆的利润和责任人
- **数据导出**: 支持按批次、按状态导出原始数据和异常记录

## 快速开始

### 1. 安装依赖

```bash
npm install
npm run build
npm link
```

### 2. 初始化数据库

```bash
# 使用主管账号初始化（默认用户: wang_super）
car-inspect init

# 或指定用户
car-inspect --user wang_super init
```

### 3. 查看可用用户

```bash
car-inspect users
```

默认用户：
- `zhang_entry` - 张三（录入员）
- `li_review` - 李四（复核员）
- `wang_super` - 王五（主管）
- `zhao_read` - 赵六（只读）

### 4. 导入样例数据

```bash
# 导入检测单
car-inspect import inspection samples/inspection.csv

# 导入维修报价
car-inspect import repair_quote samples/repair_quote.csv

# 导入照片清单
car-inspect import photo_list samples/photo_list.csv

# 导入班次记录
car-inspect import shift_record samples/shift_record.csv

# 追加工改价表
car-inspect import manual_price samples/manual_price.csv
```

### 5. 检查脏记录

```bash
# 查看所有脏记录
car-inspect check

# 只看待修复
car-inspect check --pending

# 按类型过滤
car-inspect check -t inspection
```

### 6. 修复脏记录

```bash
# 修复指定脏记录
car-inspect fix <dirty_id> "修正后的值"
```

### 7. 生成报告

```bash
# 查看多次返厂车辆
car-inspect report --returns

# 查看责任人统计
car-inspect report --persons

# 查看车辆详情
car-inspect report --car LSVAM4187C2184702
```

### 8. 查看历史记录

```bash
# 查看所有历史
car-inspect history

# 查看指定记录的历史
car-inspect history --source inspection --id <record_id>
```

### 9. 导出数据

```bash
# 导出所有数据
car-inspect export output/all_data.json

# 导出指定批次失败记录
car-inspect export output/failed.json --failed <batch_id>

# 只导出脏记录
car-inspect export output/dirty.json --dirty
```

## 权限说明

| 角色 | 可见字段 | 可执行操作 |
|------|---------|-----------|
| 录入员 (entry) | 基础字段 | init, import, check, view |
| 复核员 (review) | 基础字段+批次号 | init, import, check, fix, view, report |
| 主管 (supervisor) | 全部字段 | 全部操作 |
| 只读 (readonly) | 关键字段 | view, report |

## 脏数据类型

| 类型 | 说明 |
|------|------|
| missing_field | 缺少必填字段 |
| cross_date | 日期跨期超过30天 |
| name_changed | 同一VIN车型名称变更 |
| amount_conflict | 金额冲突或异常 |
| quantity_conflict | 数量异常 |
| duplicate | 重复记录 |

## 完整流程示例

### 主流程（正常操作）

```bash
# 1. 初始化
car-inspect init

# 2. 依次导入数据源
car-inspect import inspection samples/inspection.csv
car-inspect import repair_quote samples/repair_quote.csv
car-inspect import photo_list samples/photo_list.csv

# 3. 检查脏数据
car-inspect check

# 4. 查看导入批次
car-inspect batches

# 5. 生成返厂报告
car-inspect report --returns

# 6. 导出结果
car-inspect export output/result.json --dirty
```

### 制造异常

在CSV中修改以下内容制造异常：
1. **缺少字段**: 删除某行的 inspector 字段值
2. **跨日期**: 将日期改为 2023-01-01
3. **改名**: 将同一VIN的车型名改为不同名称
4. **金额冲突**: 将 totalPrice 改为与 quantity*unitPrice 不符
5. **数量异常**: 将 photoCount 改为 -5

### 查看导出结果

```bash
# 导出脏记录详情
car-inspect export output/dirty_records.json --dirty

# 查看导出文件
cat output/dirty_records.json | jq
```

## 测试

```bash
# 运行所有测试
npm test

# 监听模式
npm run test:watch
```

测试重点：
- 状态变化：导入 -> 检测脏 -> 修复 -> 验证
- 幂等性：重复导入同一文件的行为
- 权限控制：不同角色的操作限制
- 数据一致性：修复前后数据追踪

## 目录结构

```
.
├── src/
│   ├── cli/           # CLI命令处理
│   ├── config/        # 配置（用户、权限）
│   ├── database/      # 数据库操作
│   ├── services/      # 业务逻辑
│   │   ├── import.ts      # 导入服务
│   │   ├── dirtyCheck.ts  # 脏数据检测
│   │   ├── history.ts     # 历史记录
│   │   ├── carReturn.ts   # 返厂分析
│   │   └── export.ts      # 导出服务
│   ├── types/         # 类型定义
│   └── index.ts       # 入口文件
├── samples/           # 样例数据
└── README.md
```

## 命令参考

```
car-inspect [command]

命令:
  car-inspect init                    初始化数据库
  car-inspect import <type> <file>    导入数据
  car-inspect check                   检查脏记录
  car-inspect fix <id> <value>        修复脏记录
  car-inspect report                  生成报告
  car-inspect history                 查看历史记录
  car-inspect export <path>           导出数据
  car-inspect whoami                  显示当前用户
  car-inspect users                   列出所有用户
  car-inspect batches                 查看导入批次

选项:
  -u, --user <username>  指定操作用户
  -h, --help             显示帮助
  -V, --version          显示版本号
```
