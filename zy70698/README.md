# 材料包备料管理系统 API

手作课老师开课前按报名人数准备材料包的后端管理系统，支持临时退课换课的库存动态调整、缺料预警和备料报告导出。

## 技术栈

- **FastAPI**: Web 框架
- **SQLite**: 数据库
- **SQLAlchemy**: ORM
- **Pydantic**: 数据验证

## 核心功能

### 1. 报名锁料
- 学员报名课程时自动锁定对应材料包库存
- 支持一个课程配置多个材料包
- 每人材料消耗数量可配置

### 2. 退课释放
- 退课时自动释放锁定的材料包库存
- 记录退课原因和类型
- 支持人工复核标记

### 3. 换课转移
- 自动从原课程释放材料
- 自动锁定新课程材料
- 记录换课轨迹

### 4. 缺料预警
- 报名时实时检查库存
- 临界值预警（可配置）
- 缺料时标记需要人工复核
- 报告中高亮显示缺料情况

### 5. 备料报告
- 按课程统计报名和退课人数
- 材料需求汇总
- 缺料预警详情
- 支持导出结构化数据

## 错误响应规范

| 错误类型 | 说明 | 场景示例 |
|---------|------|---------|
| validation_error | 字段验证错误 | 必填字段缺失、数据格式错误 |
| state_error | 状态不允许操作 | 已退课学员重复退课、已复核记录重复复核 |

错误响应格式:
```json
{
    "error_code": "ALREADY_REGISTERED",
    "error_type": "state_error",
    "message": "该学员已报名此课程",
    "details": {"registration_id": 1}
}
```

主要错误码:
- `ALREADY_REGISTERED`: 重复报名
- `INVALID_STATUS`: 状态不允许操作
- `ALREADY_REVIEWED`: 已复核
- `COURSE_FULL`: 课程已满
- `MATERIAL_NOT_FOUND`: 材料包不存在

## 项目结构

```
.
├── main.py              # FastAPI 主应用和路由
├── models.py            # SQLAlchemy 数据模型
├── schemas.py           # Pydantic 数据结构
├── crud.py              # 业务逻辑实现
├── database.py          # 数据库配置
├── requirements.txt     # 依赖清单
├── test_self_check.py   # 自检脚本
└── material_kit.db      # SQLite 数据库（运行后生成）
```

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 运行自检脚本

```bash
python test_self_check.py
```

### 3. 启动服务

```bash
python main.py
```

或使用 uvicorn:

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 4. 访问 API 文档

打开浏览器访问: http://localhost:8000/docs

## API 接口说明

### 课程管理
- `POST /courses/` - 创建课程
- `GET /courses/` - 获取课程列表

### 学员管理
- `POST /students/` - 创建/查询学员
- `GET /students/` - 获取学员列表

### 材料包管理
- `POST /material-kits/` - 创建材料包
- `PUT /material-kits/{id}` - 更新材料包
- `GET /material-kits/` - 获取材料包列表（支持预警筛选）

### 报名管理
- `POST /registrations/` - 学员报名（自动锁料）
- `GET /courses/{course_id}/registrations/` - 课程报名列表

### 退课管理
- `POST /drop-course/` - 退课（自动释放）
- `POST /transfer-course/` - 换课（转移库存）
- `GET /drop-records/` - 退课记录列表
- `POST /drop-records/{id}/review/` - 复核退课记录

### 备料报告
- `POST /preparation-reports/` - 生成备料报告
- `GET /preparation-reports/` - 获取报告列表
- `GET /preparation-reports/{id}/export/` - 导出报告数据

### 库存管理
- `GET /stock-records/` - 库存变更记录

## 自检脚本功能

`test_self_check.py` 包含完整功能验证:

1. **导入基础数据** - 创建课程、学员、材料包、课程材料配置
2. **报名与锁料** - 验证报名流程和库存锁定逻辑
3. **筛选与查询** - 测试状态筛选、预警查询、库存记录查询
4. **退课与材料释放** - 验证退课流程和库存释放逻辑
5. **换课功能** - 验证换课流程和库存转移逻辑
6. **错误处理机制** - 验证各种错误场景的正确响应
7. **缺料预警** - 验证缺料检测、预警标记、报告生成
8. **报告导出** - 验证报告导出格式和数据完整性

## 使用示例

### 1. 创建课程材料配置

```python
# 先创建课程和材料包
# 然后配置关联
POST /course-material-kits/
{
    "course_id": 1,
    "material_kit_id": 1,
    "quantity_per_student": 1
}
```

### 2. 学员报名

```python
POST /registrations/
{
    "course_id": 1,
    "student_id": 1,
    "notes": "线上报名"
}

# 响应包含是否需要人工复核标记
```

### 3. 生成备料报告

```python
POST /preparation-reports/
{
    "course_id": 1,
    "generated_by": "张老师"
}
```

## 数据模型说明

### Course (课程)
- 课程名称、描述、时间
- 最大报名人数
- 启用状态

### Student (学员)
- 姓名、手机号（唯一）、邮箱
- 手机号用于去重识别

### MaterialKit (材料包)
- 名称、描述、单位
- 总库存、已锁定数量、可用数量
- 预警阈值

### Registration (报名记录)
- 课程ID、学员ID
- 状态 (registered/dropped/transferred)
- 报名/取消时间

### DropRecord (退课记录)
- 关联报名ID
- 退课类型 (normal/transfer)
- 是否需要复核、已复核状态
- 复核人、复核时间

### StockRecord (库存记录)
- 材料包ID
- 变更类型 (reserve/release)
- 变更数量、前后值
- 关联报名/退课记录ID

### PreparationReport (备料报告)
- 课程ID、报告日期
- 报名统计数据
- 材料汇总（JSON存储）
- 预警详情（JSON存储）
