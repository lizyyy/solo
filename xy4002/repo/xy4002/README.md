# 社区活动物资借还登记系统

一个基于 Node.js Express + SQLite 的全栈 Web 应用，用于社区活动物资的借还登记管理。

## 功能特性

### 物资管理
- 登记新物资（名称、分类、数量、单位、描述）
- 编辑物资信息
- 报废物资（报废后不可再借出）
- 搜索筛选（按名称、分类、状态）
- 显示在库、借出、逾期数量统计

### 借还管理
- 办理物资借出
  - 选择物资、填写借出数量
  - 登记居民姓名、联系方式
  - 设置预计归还日期
  - 自动检查库存是否充足
  - 防止重复借出（同一件物资借出后，可用数量减少）
- 办理物资归还
  - 记录实际归还时间
  - 添加归还备注
  - 自动恢复可用库存

### 状态管理
- **在库（active）**：物资正常可用
- **借出中（borrowed）**：物资已借出未归还
- **已逾期（overdue）**：超过预计归还日期未归还（自动标记）
- **已报废（scrapped）**：物资已报废，不可再借出

### 操作流水
- 所有状态变化自动记录操作流水
- 支持按操作类型筛选（登记、编辑、借出、归还、报废、导入）
- 记录操作时间、相关物资、操作描述

### 数据导入导出
- **CSV 导入**：批量导入物资数据初始化
  - 支持列名：name/物资名称、category/分类、total_quantity/总数量、available_quantity/可用数量、unit/单位、description/描述
- **CSV 导出**：
  - 导出库存清单（物资列表）
  - 导出借还记录
  - 导出操作流水

## 技术栈

- **后端**：Node.js + Express
- **数据库**：SQLite3
- **模板引擎**：EJS
- **前端**：HTML + CSS + JavaScript
- **数据处理**：csv-parser、json2csv、multer

## 项目结构

```
├── app.js                 # 主应用入口
├── database.js            # 数据库初始化和连接
├── package.json           # 项目依赖配置
├── materials.db           # SQLite 数据库文件（运行后生成）
├── views/                 # 视图模板
│   ├── materials.ejs      # 物资列表页
│   ├── material_detail.ejs # 物资详情页
│   ├── material_form.ejs  # 物资表单页（新增/编辑）
│   ├── borrow_form.ejs    # 借出表单页
│   ├── borrow_records.ejs # 借还记录列表页
│   ├── borrow_record_detail.ejs # 借还记录详情页
│   ├── logs.ejs           # 操作流水页
│   ├── import.ejs         # 导入页
│   └── import_result.ejs  # 导入结果页
├── public/                # 静态资源
│   └── css/
│       └── style.css      # 样式文件
└── uploads/               # 文件上传临时目录（运行后生成）
```

## 数据库设计

### materials 表（物资表）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键，自增 |
| name | TEXT | 物资名称 |
| category | TEXT | 分类 |
| total_quantity | INTEGER | 总数量 |
| available_quantity | INTEGER | 可用数量 |
| unit | TEXT | 单位（默认：个） |
| description | TEXT | 描述 |
| status | TEXT | 状态（active/scrapped，默认：active） |
| created_at | DATETIME | 创建时间 |
| updated_at | DATETIME | 更新时间 |

### borrow_records 表（借还记录表）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键，自增 |
| material_id | INTEGER | 关联物资ID |
| resident_name | TEXT | 居民姓名 |
| resident_phone | TEXT | 联系电话 |
| borrow_quantity | INTEGER | 借出数量 |
| expected_return_date | DATE | 预计归还日期 |
| actual_return_date | DATETIME | 实际归还时间 |
| return_remark | TEXT | 归还备注 |
| status | TEXT | 状态（borrowed/overdue/returned，默认：borrowed） |
| created_at | DATETIME | 创建时间 |
| updated_at | DATETIME | 更新时间 |

### operation_logs 表（操作流水表）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键，自增 |
| operation_type | TEXT | 操作类型（register/edit/borrow/return/scrap/import） |
| material_id | INTEGER | 关联物资ID（可选） |
| borrow_record_id | INTEGER | 关联借还记录ID（可选） |
| description | TEXT | 操作描述 |
| created_at | DATETIME | 创建时间 |

## 安装与启动

### 环境要求
- Node.js 14+
- npm 或 yarn

### 安装依赖

```bash
npm install
```

### 启动应用

```bash
npm start
```

或

```bash
node app.js
```

应用启动后访问：http://localhost:3000

### 初始化数据库

首次运行时，数据库会自动初始化并创建所需的表结构，同时会插入一些示例数据：
- 折叠桌（20张）
- 折叠椅（50把）
- 音响设备（2套）
- 投影仪（3台）
- 帐篷（5顶）

## 主要接口

### 页面路由

| 路由 | 方法 | 说明 |
|------|------|------|
| `/` | GET | 首页，重定向到物资列表 |
| `/materials` | GET | 物资列表页 |
| `/materials/new` | GET | 新增物资表单页 |
| `/materials/:id` | GET | 物资详情页 |
| `/materials/:id/edit` | GET | 编辑物资表单页 |
| `/borrow/new` | GET | 办理借出表单页 |
| `/borrow-records` | GET | 借还记录列表页 |
| `/borrow-records/:id` | GET | 借还记录详情页 |
| `/logs` | GET | 操作流水页 |
| `/import` | GET | CSV导入页 |

### 表单提交接口

| 路由 | 方法 | 说明 |
|------|------|------|
| `/materials` | POST | 新增物资 |
| `/materials/:id` | POST | 更新物资 |
| `/materials/:id/scrap` | POST | 报废物资 |
| `/borrow` | POST | 办理借出 |
| `/return/:id` | POST | 办理归还 |
| `/import` | POST | CSV导入物资 |

### 数据导出接口

| 路由 | 方法 | 说明 |
|------|------|------|
| `/export/inventory` | GET | 导出库存清单CSV |
| `/export/borrows` | GET | 导出借还记录CSV |
| `/export/logs` | GET | 导出操作流水CSV |

## 使用说明

### 登记物资
1. 点击导航栏"物资管理"
2. 点击"登记新物资"按钮
3. 填写物资信息（名称、分类、数量、单位、描述）
4. 点击"登记物资"提交

### 办理借出
1. 点击导航栏"办理借出"
2. 选择要借出的物资（仅显示可用数量>0的物资）
3. 填写借出数量、预计归还日期
4. 填写居民姓名、联系电话
5. 点击"确认借出"提交

### 办理归还
1. 在"借还记录"列表中找到需要归还的记录
2. 点击"归还"按钮，或进入详情页办理归还
3. 可添加归还备注
4. 确认后完成归还，库存自动恢复

### 报废物资
1. 进入物资详情页
2. 填写报废原因（可选）
3. 点击"报废物资"按钮
4. 确认后物资状态变为"已报废"，不可再借出

### 数据持久化
- 所有数据存储在 SQLite 数据库文件 `materials.db` 中
- 刷新页面或重启应用后数据不会丢失
- 所有状态变更都会记录到操作流水表

## 注意事项

1. **物资借出规则**：
   - 借出时会自动检查可用库存
   - 借出后可用数量减少
   - 报废物资无法借出
   - 有未归还记录的物资无法报废

2. **逾期处理**：
   - 系统每分钟自动检查逾期记录
   - 超过预计归还日期未归还的记录会自动标记为"已逾期"
   - 逾期记录会在列表中高亮显示

3. **CSV 导入**：
   - 仅支持 UTF-8 编码的 CSV 文件
   - 必须包含物资名称列（name 或 物资名称）
   - 其他列为可选，未提供时使用默认值

## 开发说明

如需修改样式，请编辑 `public/css/style.css` 文件。

如需修改页面布局，请编辑 `views/` 目录下的 EJS 模板文件。

如需修改业务逻辑，请编辑 `app.js` 文件。
