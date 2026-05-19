# 社区食堂配餐管理系统

针对一线社区食堂负责人需求开发，支持老人忌口、慢病标签、配送路线管理，批量操作容错处理。

## 功能特性

- ✅ **老人档案管理**：支持忌口、慢病标签、配送路线配置
- ✅ **菜单管理**：菜品过敏原标记、适合/不适合的慢病标签
- ✅ **配送管理**：按路线、志愿者分配，支持配送顺序
- ✅ **智能复核**：自动检测忌口/慢病冲突，提前预警
- ✅ **批量操作容错**：批量导入/复核时，成功记录保留，失败记录单独展示
- ✅ **错误追踪**：导入失败记录保留原始位置、错误原因和修改建议

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 初始化数据库

```bash
canteen init
# 或
python -m canteen.cli init
```

### 3. 导入数据

#### 导入老人档案（CSV）

```bash
# 正常数据导入
canteen import_data elderly examples/elderly_normal.csv

# 含错误的数据导入（查看错误处理效果）
canteen import_data elderly examples/elderly_with_errors.csv
```

**CSV格式说明**：
```csv
name,id_card,phone,gender,age,address,community,building,room,route_code,dietary_restrictions,chronic_diseases,notes
张大爷,110101194001011234,13800138001,男,85,幸福路1号,幸福社区,1号楼,101室,A01,辛辣,糖尿病,高血压
```

#### 导入菜单（JSON）

```bash
canteen import_data menu examples/menu.json
```

#### 导入每日菜单（JSON）

```bash
canteen import_data daily_menu examples/daily_menu.json
```

#### 导入配送表（CSV）

```bash
canteen import_data delivery examples/delivery_normal.csv
```

### 4. 复核配送

#### 查看待复核配送

```bash
canteen review list-pending
canteen review list-pending --date 2024-01-15
canteen review list-pending --route A01
```

**复核时自动检测**：
- 老人忌口与菜品过敏原冲突
- 慢病与菜品不适合标签冲突

#### 单条复核

```bash
canteen review delivery 1 --approve --notes "已确认无误" --reviewer "张管理员"
canteen review delivery 2 --reject --notes "菜品与慢病冲突"
```

#### 批量复核

```bash
canteen review batch 1 2 3 4 5 --approve
```

**批量操作特性**：
- 成功的记录会被保存
- 失败的记录会单独列出
- 重试时不会影响已成功的记录

### 5. 导出数据

#### 导出配送单

```bash
canteen export_data deliveries 2024-01-15
canteen export_data deliveries 2024-01-15 --route A01
canteen export_data deliveries 2024-01-15 --output delivery_20240115.json
```

#### 导出导入失败的记录

```bash
canteen export_data failed-imports 1 --output failed_records.json
```

## 数据格式说明

### 老人档案字段

| 字段 | 必填 | 说明 |
|------|------|------|
| name | 是 | 姓名 |
| id_card | 是 | 身份证号（18位，支持X结尾） |
| phone | 否 | 手机号（11位） |
| gender | 否 | 性别 |
| age | 否 | 年龄（0-150） |
| address | 否 | 地址 |
| community | 否 | 社区 |
| building | 否 | 楼栋 |
| room | 否 | 房间号 |
| route_code | 否 | 配送路线代码 |
| dietary_restrictions | 否 | 忌口（逗号分隔，如：辛辣,海鲜） |
| chronic_diseases | 否 | 慢病（逗号分隔，如：糖尿病,高血压） |
| notes | 否 | 备注 |

### 菜品字段

| 字段 | 必填 | 说明 |
|------|------|------|
| name | 是 | 菜品名称 |
| category | 否 | 分类 |
| price | 否 | 价格 |
| ingredients | 否 | 食材列表 |
| allergens | 否 | 过敏原列表 |
| suitable_diseases | 否 | 适合的慢病列表 |
| unsuitable_diseases | 否 | 不适合的慢病列表 |
| is_vegetarian | 否 | 是否素食 |
| is_soft | 否 | 是否软食 |

## 错误处理示例

### 导入失败记录详情

```
导入完成!
总记录数: 6
成功: 2
失败: 4

失败记录详情:
  行 4: 身份证号格式错误: 12345678
    建议: 请检查身份证号是否为18位有效格式
  行 5: 手机号格式错误: 12345
    建议: 请检查手机号是否为11位有效格式
  行 6: 年龄范围错误: 200
    建议: 请检查以下字段: age: Input should be less than or equal to 150
  行 7: 身份证号已存在: 110101194001011234
    建议: 请检查是否重复导入
```

### 复核时的规则警告

```
待复核配送记录 (3条):
  ID: 1 - 张大爷 - 2024-01-15 - 午餐 [有1条警告!]
    ! 张大爷 忌口 辛辣，但菜品 辣椒炒肉 含有该成分
  ID: 2 - 李奶奶 - 2024-01-15 - 午餐
  ID: 3 - 王爷爷 - 2024-01-15 - 午餐 [有1条警告!]
    ! 王爷爷 患有 痛风，菜品 清蒸鲈鱼 不适合该病症
```

## 项目结构

```
canteen/
├── __init__.py          # 包初始化
├── database.py          # 数据库连接和会话管理
├── models.py            # 数据模型定义
├── schemas.py           # 数据验证schema
├── services.py          # 业务逻辑服务
├── exceptions.py        # 异常定义
└── cli.py               # 命令行接口

examples/                # 样例数据
├── elderly_normal.csv   # 正常老人档案
├── elderly_with_errors.csv # 含错误的老人档案
├── menu.json            # 菜品数据
├── daily_menu.json      # 每日菜单
├── delivery_normal.csv  # 正常配送表
└── delivery_with_errors.csv # 含错误的配送表

requirements.txt         # 依赖列表
pyproject.toml           # 项目配置
README.md                # 本文档
```

## 业务层核心设计

### 导入服务 (BaseImportService)

- **原子操作**：每条记录独立处理，失败不影响其他记录
- **错误追踪**：记录原始行号、错误信息、修改建议
- **幂等性**：重复导入会被检测并提示

### 复核服务 (ReviewService)

- **规则引擎**：自动检测忌口和慢病冲突
- **批量操作**：部分成功部分失败，不破坏已成功的记录
- **审计追踪**：记录复核人、复核时间、备注

### 导出服务 (ExportService)

- **灵活筛选**：按日期、路线筛选
- **完整信息**：导出时包含老人忌口和慢病标签，方便配送员查看

## 存储层设计

### 核心表

1. **elderly** - 老人档案
   - 主键：id
   - 唯一键：id_card
   - JSON字段：dietary_restrictions, chronic_diseases

2. **menu_items** - 菜品
   - 主键：id
   - JSON字段：ingredients, allergens, suitable_diseases, unsuitable_diseases

3. **delivery_assignments** - 配送记录
   - 主键：id
   - 外键：elderly_id
   - 状态字段：review_status (pending/approved/rejected)

4. **import_records** - 导入记录
   - 主键：id
   - 统计字段：total_count, success_count, failed_count

5. **import_details** - 导入详情
   - 主键：id
   - 外键：import_record_id
   - 错误追踪：row_number, raw_data, error_message, fix_suggestion

## 常见问题

### Q: 批量导入失败怎么办？

A: 系统会自动保留成功的记录，失败的记录可以通过以下命令导出：
```bash
canteen export_data failed-imports <导入记录ID>
```
修正后重新导入即可，已成功的记录不会被重复导入。

### Q: 复核时发现冲突怎么办？

A: 系统会显示具体冲突原因，您可以：
1. 拒绝该配送记录，重新安排菜品
2. 确认后仍然通过（特殊情况）
3. 查看建议后修改老人档案或菜单

### Q: 如何添加新的慢病标签？

A: 直接在CSV的chronic_diseases字段中用逗号分隔添加即可，系统会自动识别。

## 许可证

MIT
