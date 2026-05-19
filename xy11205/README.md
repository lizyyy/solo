# 社区药房疫苗/胰岛素到货管理系统

用于管理社区药房疫苗和胰岛素的到货记录、温度监控、照片存档及复核流程。支持本地持久化存储，错误记录追踪，以及完整的审计日志。

## 功能特性

- ✅ **到货单管理**: 支持CSV批量导入，记录批号、产品类型、数量、签收人等
- ✅ **温度记录**: 支持JSON导入，记录冷链温度数据
- ✅ **照片管理**: 支持包装、破损、签收单照片记录
- ✅ **错误处理**: 坏记录保留原始位置、失败原因和修改建议
- ✅ **复核流程**: 支持待审核、通过、驳回三种状态
- ✅ **审计日志**: 所有操作都有完整记录，包含操作人、角色、时间
- ✅ **本地持久化**: SQLite数据库，重启服务数据不丢失
- ✅ **历史查询**: 支持按状态、批号等搜索历史记录
- ✅ **导出功能**: 支持JSON/CSV格式导出

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 导入正常到货单数据

```bash
# 导入正常数据
node src/scripts/importArrival.js data/samples/arrival_normal.csv 张药师 pharmacist
```

### 3. 导入带错误的到货单数据（测试错误处理）

```bash
# 导入含错误的数据，系统会自动记录失败原因
node src/scripts/importArrival.js data/samples/arrival_with_errors.csv 李库管 warehouse_manager
```

### 4. 查看未解决的导入错误

```bash
node src/scripts/review.js errors
```

### 5. 查看待复核列表

```bash
node src/scripts/review.js list
```

### 6. 查看订单详情

```bash
node src/scripts/review.js detail <订单ID>
```

### 7. 复核订单

```bash
# 通过复核
node src/scripts/review.js approve <订单ID> 王审核 reviewer

# 驳回订单
node src/scripts/review.js reject <订单ID> 王审核 reviewer
```

### 8. 导入温度记录

> 注意：导入前需要先修改 `data/samples/temperature_normal.json` 中的 arrival_order_id 为实际订单ID

```bash
node src/scripts/importTemperature.js data/samples/temperature_normal.json 刘库管 warehouse_manager
```

### 9. 导入照片记录

```bash
node src/scripts/importPhotos.js data/samples/photos_normal.json 陈审核 reviewer
```

### 10. 查看历史记录

```bash
# 查看所有历史
node src/scripts/history.js list

# 查看已通过的
node src/scripts/history.js list reviewed

# 查看统计信息
node src/scripts/history.js stat

# 按批号搜索
node src/scripts/history.js search VAC-2024

# 查看审计日志
node src/scripts/history.js audit
```

### 11. 导出数据

```bash
# 导出JSON格式
node src/scripts/export.js json

# 导出CSV格式，只导出已通过的
node src/scripts/export.js csv data/exports reviewed

# 导出审计日志
node src/scripts/export.js audit

# 导出所有导入错误
node src/scripts/export.js errors
```

## 角色说明

系统支持三种角色，所有操作都需要指定角色：

| 角色 | 英文标识 | 说明 |
|------|---------|------|
| 仓库管理员 | warehouse_manager | 负责入库操作、温度记录、照片上传 |
| 药师 | pharmacist | 负责签收、初步检查 |
| 审核员 | reviewer | 负责最终复核、审批 |

## 数据字段说明

### 到货单字段

| 字段 | 必填 | 说明 |
|------|------|------|
| batch_number | 是 | 批号，至少3个字符 |
| product_type | 是 | 产品类型: vaccine（疫苗）或 insulin（胰岛素） |
| product_name | 是 | 产品名称 |
| quantity | 是 | 数量，必须大于0的整数 |
| arrival_date | 是 | 到货日期，有效日期格式 |
| receiver | 是 | 签收人 |
| signature | 是 | 签名标识 |
| damage_status | 否 | 破损状态: none / minor / severe |
| damage_description | 否 | 破损描述 |

### 温度记录字段

| 字段 | 必填 | 说明 |
|------|------|------|
| arrival_order_id | 是 | 关联的到货单ID |
| temperature | 是 | 温度值，范围: -80°C ~ 30°C |
| record_time | 是 | 记录时间 |
| recorder | 是 | 记录人 |

### 照片记录字段

| 字段 | 必填 | 说明 |
|------|------|------|
| arrival_order_id | 是 | 关联的到货单ID |
| photo_path | 是 | 照片文件路径 |
| photo_type | 是 | 照片类型: package（包装）/ damage（破损）/ receipt（签收单） |
| uploaded_by | 是 | 上传人 |
| upload_time | 否 | 上传时间，默认当前时间 |

## 目录结构

```
.
├── src/
│   ├── models/
│   │   └── database.js          # 数据库模型和初始化
│   ├── services/
│   │   ├── arrivalService.js    # 到货单服务
│   │   ├── temperatureService.js # 温度记录服务
│   │   ├── photoService.js      # 照片记录服务
│   │   ├── auditService.js      # 审计日志服务
│   │   └── errorService.js      # 错误处理服务
│   ├── utils/
│   │   └── validator.js         # 数据验证工具
│   └── scripts/
│       ├── importArrival.js     # 到货单导入脚本
│       ├── importTemperature.js # 温度记录导入脚本
│       ├── importPhotos.js      # 照片记录导入脚本
│       ├── review.js            # 复核脚本
│       ├── export.js            # 导出脚本
│       └── history.js           # 历史查询脚本
├── data/
│   ├── samples/                 # 样例数据
│   │   ├── arrival_normal.csv
│   │   ├── arrival_with_errors.csv
│   │   ├── temperature_normal.json
│   │   ├── temperature_with_errors.json
│   │   └── photos_normal.json
│   └── exports/                 # 导出文件目录
└── database/
    └── pharmacy.db              # SQLite数据库文件
```

## 测试样例说明

### 正常数据样例

- `arrival_normal.csv`: 5条正常到货单记录
- `temperature_normal.json`: 5条正常温度记录
- `photos_normal.json`: 5条正常照片记录

### 异常数据样例

`arrival_with_errors.csv` 包含以下错误场景：
- 第3行：批号为空，产品类型无效
- 第4行：数量为负数（-50）
- 第5行：缺少数量字段，日期无效
- 第6行：缺少批号和产品类型字段

`temperature_with_errors.json` 包含以下错误场景：
- 温度值不是数字
- 温度超出合理范围（150°C）
- 日期格式无效
- 缺少必填字段

## 注意事项

1. 所有操作都需要提供操作人姓名和角色，用于审计
2. 导入数据时遇到错误不会中断，系统会记录错误并继续处理后续数据
3. 数据库文件保存在 `database/pharmacy.db`，删除即清空所有数据
4. 温度记录和照片记录需要先有对应的到货单记录才能导入
5. 样例数据中的 arrival_order_id 需要替换为实际导入后生成的订单ID
