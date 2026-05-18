# 智能门锁售后换件导入系统

## 项目简介

专门针对智能门锁售后换件场景设计的数据导入接口，处理真实业务中的各类边界情况。

## 目录结构

```
xy11059/
├── app.py                      # Flask主应用
├── models.py                   # 数据模型定义
├── services/
│   ├── __init__.py
│   └── import_service.py       # 导入服务核心逻辑
├── requirements.txt            # 依赖包
├── test_data_normal.csv        # 正常测试数据
├── test_data_edge_cases.csv    # 边界情况测试数据
├── test_import.py              # 自动化测试脚本
└── README.md
```

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动服务

```bash
python app.py
```

服务将在 `http://localhost:5000` 启动

### 3. 运行测试

```bash
python test_import.py
```

## API接口

### 导入换件记录

**POST** `/api/import/replace`

支持上传 Excel (.xlsx) 或 CSV 文件

#### 请求参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| file | File | 是 | 数据文件 |
| allow_manual_override | String | 否 | 是否开启人工覆盖模式 (true/false) |
| manual_notes | String | 否 | 人工备注信息 |

#### 响应示例

```json
{
  "success": true,
  "summary": {
    "total": 10,
    "success": 7,
    "bad_rows": 3,
    "warnings": 2
  },
  "bad_rows": [
    {
      "row": 5,
      "original_data": { ... },
      "error": "缺少必填字段: 换件单号",
      "suggestion": "请补充必填字段后重新导入"
    }
  ],
  "warning_rows": [
    {
      "row": 3,
      "record_id": "HJ20240101007",
      "warnings": ["旧配件未回收却设置状态为\"旧件回收\""],
      "note": "已通过人工覆盖模式导入"
    }
  ]
}
```

### 查询所有记录

**GET** `/api/replace/records`

### 查询单条记录

**GET** `/api/replace/record/{record_id}`

## 数据字段说明

### 必填字段

| 字段名 | 说明 | 示例 |
|--------|------|------|
| 换件单号 | 唯一标识 | HJ20240101001 |
| 客户姓名 | 客户姓名 | 张三 |
| 客户电话 | 联系电话 | 13800138001 |
| 门锁型号 | 产品型号 | 鹿客S50 |
| 门锁序列号 | 产品SN | S50-20231001-0001 |
| 故障类型 | 故障分类 | 指纹模块故障 |
| 新配件编码 | 配件SKU | FP-MOD-S50-V2 |
| 新配件名称 | 配件名称 | 指纹识别模块V2 |
| 状态 | 当前状态 | 待审核 |

### 可选字段

- 客户地址
- 购买日期
- 保修状态（在保/过保）
- 故障描述
- 旧配件编码/名称
- 旧配件是否回收
- 旧配件回收日期
- 新配件出库仓库
- 新配件发货日期
- 上门工程师姓名/电话
- 上门服务日期

### 状态流转

```
待审核 → 配件出库 → 工程师上门 → 换件完成 → 旧件回收 → 售后闭环
```

## 边界情况处理

### 1. 缺字段校验

- 检测所有必填字段
- 坏行返回原始数据、错误原因、处理建议

### 2. 重复提交校验

- 换件单号唯一索引
- 检测到重复立即标记为坏行

### 3. 状态越级校验

- 无效状态值检测
- 高级状态（换件完成及以上）必须有工程师上门信息
- 售后闭环状态要求旧配件已回收

### 4. 旧配件未回收校验

- 状态为"旧件回收"或"售后闭环"时，旧配件必须标记为已回收
- 有旧配件编码但未标记回收的一致性检查

### 5. 日期逻辑校验

- 上门服务日期不能早于新配件发货日期

### 6. 人工覆盖模式

- 开启 `allow_manual_override=true` 后，允许通过上述业务校验
- 记录人工备注和标记
- 返回警告信息供后续追溯

## 测试样例说明

### test_data_normal.csv - 正常数据

包含4条完整的正常业务数据，涵盖不同品牌、不同故障类型、不同状态的真实场景。

### test_data_edge_cases.csv - 边界情况

包含10条测试数据，覆盖以下边界情况：

| 行号 | 边界类型 | 说明 |
|------|----------|------|
| 2 | 旧件未回收 | 状态为旧件回收但未标记回收 |
| 3 | 售后闭环不一致 | 状态为闭环但旧件未回收 |
| 4 | 旧件未回收 | 有旧配件编码但未标记回收 |
| 5 | 缺失换件单号 | 必填字段为空 |
| 6 | 缺失故障类型 | 必填字段为空 |
| 7 | 无效状态值 | 状态为"已完成"不在枚举中 |
| 8 | 缺少工程师信息 | 状态为闭环但无工程师信息 |
| 9 | 日期逻辑异常 | 上门日期早于发货日期 |
| 10 | 重复提交 | 换件单号与第一条数据重复 |

## 扩展开发

### 添加前端

可以在项目根目录创建 `templates/` 和 `static/` 目录，使用 Flask 模板引擎开发管理界面。

### 添加定时任务

推荐使用 APScheduler：

```python
from apscheduler.schedulers.background import BackgroundScheduler

scheduler = BackgroundScheduler()
scheduler.add_job(func=your_task, trigger="interval", seconds=3600)
scheduler.start()
```

### 数据库切换

当前使用 SQLite，如需切换到 MySQL/PostgreSQL，修改 `app.py` 中的数据库连接字符串即可。

## 技术栈

- **框架**: Flask 3.0
- **ORM**: Flask-SQLAlchemy
- **数据处理**: Pandas
- **数据库**: SQLite (默认)
