# 助学金材料有效期与家庭成员一致性审核系统

## 项目概述

本系统是学院助学金材料审核的后端API，用于离线筛选缺章、过期证明和家庭成员表不一致的问题。

## 技术栈

- **后端框架**: FastAPI
- **数据库**: SQLite + SQLAlchemy ORM
- **数据验证**: Pydantic
- **报表导出**: Excel (openpyxl) + CSV + Pandas

## 核心功能

### 1. 文件清点
- 自动核对必填材料清单（低保、贫困、残疾、孤儿、家庭收入、医疗证明、申请表、身份证复印件）
- 标记缺少的必填材料

### 2. 有效期校验
- 检查证明文件的签发日期和有效期
- 自动识别过期证明
- 支持按类型配置有效天数

### 3. 成员一致性检查
- 验证家庭成员身份证号唯一性
- 检查家庭收入来源是否已指定
- 验证必填字段完整性

### 4. 缺项分级
- 按严重程度分级：缺少材料(严重)、过期材料(错误)、缺章(错误)、家庭信息问题(警告)
- 自动设置审核状态：通过/待审核

### 5. 报告导出
- 导出单个学生审核报告（Excel）
- 导出批量审核汇总报告（Excel）
- 导出CSV格式报告

## 错误响应类型

| 错误码 | 类型 | 说明 |
|--------|------|------|
| MISSING_FIELD | 缺字段 | 请求参数缺失或无效 |
| STATUS_NOT_ALLOWED | 状态不允许 | 材料已处理，无法修改 |
| NEED_MANUAL_REVIEW | 需要人工复核 | 系统异常或特殊情况 |
| ALREADY_PROCESSED | 已处理 | 记录已存在或重复提交 |

## 项目结构

```
.
├── main.py              # FastAPI主程序，包含所有路由
├── models.py            # SQLAlchemy数据模型
├── schemas.py           # Pydantic请求/响应模型
├── services.py          # 核心业务逻辑服务
├── exporter.py          # 报告导出模块
├── database.py          # 数据库配置
├── requirements.txt     # 依赖包列表
├── test_self_check.py   # 自检脚本
├── student_aid.db       # SQLite数据库文件（自动生成）
└── exports/             # 导出报告目录（自动生成）
```

## 快速开始

### 1. 安装依赖
```bash
pip install -r requirements.txt
```

### 2. 运行自检
```bash
python test_self_check.py
```

### 3. 启动服务
```bash
python main.py
# 或
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 4. 访问API文档
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## 主要API接口

### 学生管理
- `POST /students/` - 创建学生（含家庭成员）
- `GET /students/` - 获取学生列表
- `GET /students/{student_id}` - 获取单个学生详情

### 材料管理
- `POST /students/{student_id}/materials/` - 添加学生材料
- `GET /material-types/` - 获取材料类型列表
- `PUT /materials/{material_id}/status/` - 更新材料状态

### 审核功能
- `GET /review/{student_id}` - 审核单个学生
- `POST /review/batch/` - 批量审核所有学生
- `GET /review/issues/` - 按问题类型筛选学生

### 报告与导出
- `POST /reports/{student_id}` - 生成审核报告
- `GET /reports/` - 获取所有报告
- `GET /export/student/{student_id}` - 导出单个学生报告(Excel)
- `GET /export/batch/` - 导出批量审核报告(Excel)
- `GET /export/csv/` - 导出CSV格式报告

## 数据模型

### Student (学生)
- student_id: 学号
- name: 姓名
- gender: 性别
- grade: 年级
- major: 专业
- phone: 联系电话
- id_card: 身份证号
- address: 家庭住址

### FamilyMember (家庭成员)
- name: 姓名
- relation: 关系
- age: 年龄
- id_card: 身份证号
- workplace: 工作单位
- annual_income: 年收入
- health_status: 健康状况
- is_source_of_income: 是否为收入来源

### MaterialType (材料类型)
- code: 类型编码
- name: 类型名称
- validity_days: 有效天数
- is_required: 是否必填
- need_stamp: 是否需要盖章
- sort_order: 排序

### StudentMaterial (学生材料)
- material_type_id: 材料类型ID
- file_name: 文件名
- upload_date: 上传日期
- issue_date: 签发日期
- expiry_date: 有效期至
- has_stamp: 是否有章
- status: 状态(pending/approved/rejected/need_review/processed)
- remarks: 备注

### ReviewReport (审核报告)
- report_code: 报告编号
- total_materials: 材料总数
- missing_materials: 缺少材料数
- expired_materials: 过期材料数
- no_stamp_materials: 缺章材料数
- family_consistency_issues: 家庭一致性问题数
- total_issues: 总问题数
- critical_issues: 严重问题数
- status: 审核状态
- reviewer: 审核人
- review_date: 审核日期

## 使用示例

### 创建学生
```bash
curl -X POST http://localhost:8000/students/ \
  -H "Content-Type: application/json" \
  -d '{
    "student_id": "2024001",
    "name": "张三",
    "grade": "2024级",
    "major": "计算机科学",
    "family_members": [
      {"name": "张父", "relation": "父亲", "is_source_of_income": true}
    ]
  }'
```

### 审核学生
```bash
curl http://localhost:8000/review/2024001
```

### 导出报告
```bash
curl -O http://localhost:8000/export/batch/
```

## 自检功能

运行 `python test_self_check.py` 将自动完成：
1. 初始化材料类型
2. 导入测试学生数据
3. 提交材料样本
4. 单个学生审核测试
5. 批量审核测试
6. 按问题类型筛选测试
7. 生成审核报告
8. 导出Excel和CSV报告

## 注意事项

1. 数据库文件 `student_aid.db` 会在首次启动时自动创建
2. `exports/` 目录用于存放导出的报告文件，自动创建
3. 材料类型会在首次启动时自动初始化8种默认类型
4. 所有日期字段使用 YYYY-MM-DD 格式
