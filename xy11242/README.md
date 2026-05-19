# 公益书库管理系统

一个真正能落地的公益书库志愿者后端管理系统，解决捐书入库时ISBN、品相、年级标签混乱问题。

## 核心功能

### 1. 数据校验
- ISBN格式自动校验（支持10位和13位ISBN校验位验证）
- 品相标准化（全新/九成新/八成新/七成新/有破损）
- 年级标签标准化（学前到高三，成人）

### 2. 多渠道数据导入
- **扫码CSV导入**：支持批量扫码数据导入
- **Markdown人工备注导入**：解析自然格式的人工记录
- **API录入**：支持单条和批量录入

### 3. 坏记录处理
- 失败记录不直接丢弃
- 保留原始位置、失败原因
- 提供可修改建议
- 支持重试导入，不影响已成功记录

### 4. 多维度筛选与查询
- 按负责人筛选
- 按状态筛选（待入库/校验中/已入库/已驳回/已归档/异常）
- 按异常类型筛选
- 按时间范围筛选
- 按年级、品相筛选

### 5. 报告导出
- 导出Excel/CSV格式的书籍清单（与查询结果1:1对应）
- 月度复盘报告（统计书籍总数、异常率、志愿者贡献等）
- 坏记录导出报告

### 6. 状态变更追踪
- 完整的状态变更历史记录
- 记录操作人和变更原因

## 快速开始

### 1. 安装依赖
```bash
pip install -r requirements.txt
```

### 2. 启动服务
```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 3. 访问接口文档
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## 项目结构
```
├── app/
│   ├── __init__.py
│   ├── database.py          # 数据库配置
│   ├── models.py            # 数据模型
│   ├── schemas.py           # Pydantic模式 + ISBN校验器
│   ├── crud.py              # 数据操作
│   ├── import_service.py    # 导入服务（CSV/Markdown）
│   └── report_service.py    # 报告导出服务
├── main.py                  # API主入口
├── requirements.txt         # 依赖列表
├── test_data.csv           # 测试CSV数据
└── test_notes.md           # 测试Markdown数据
```

## 核心API示例

### 导入扫码CSV
```bash
curl -X POST "http://localhost:8000/import/csv?imported_by=志愿者A" \
  -F "file=@test_data.csv"
```

### 导入Markdown备注
```bash
curl -X POST "http://localhost:8000/import/markdown?imported_by=志愿者B" \
  -F "file=@test_notes.md"
```

### 查询书籍（多条件筛选）
```bash
# 查询张三负责的、状态异常的书籍
curl "http://localhost:8000/books/?volunteer=张三&status=EXCEPTION"
```

### 导出Excel报告
```bash
curl "http://localhost:8000/export/books/excel?volunteer=张三" \
  -o 书籍清单.xlsx
```

### 月度复盘
```bash
# 获取2024年5月统计摘要
curl "http://localhost:8000/report/monthly/summary?year=2024&month=5"

# 导出月度复盘Excel
curl "http://localhost:8000/report/monthly/excel?year=2024&month=5" \
  -o 月度复盘.xlsx
```

### 批量状态更新
```bash
curl -X POST "http://localhost:8000/books/batch/status?new_status=APPROVED&changed_by=管理员&reason=审核通过" \
  -H "Content-Type: application/json" \
  -d "[1, 2, 3]"
```

## 数据模型说明

### Book（书籍）
- 基础信息：ISBN、书名、作者、出版社
- 分类信息：品相、年级标签
- 状态信息：状态、负责人、架位
- 来源信息：导入来源、导入批次
- 时间戳：创建时间、更新时间

### StatusHistory（状态历史）
- 记录每次状态变更
- 包含旧状态、新状态、操作人、变更原因

### BookException（异常记录）
- 记录书籍的各类异常
- 异常类型：ISBN错误、信息缺失、品相标注错误等
- 支持标记已解决

### ImportLog（导入日志）
- 记录每次批量导入
- 包含成功/失败数量统计
- 关联坏记录

### BadRecord（坏记录）
- 保存导入失败的原始数据
- 失败原因和修改建议
- 重试状态追踪

## 工作流程建议

1. **数据导入**：志愿者扫码后导出CSV，或直接整理Markdown备注
2. **系统导入**：通过API导入文件，系统自动校验
3. **异常处理**：查看坏记录和异常书籍，修正后重试
4. **审核上架**：批量更新状态为"已入库"
5. **月底复盘**：导出月度报告，核对数据和历史动作

## 技术栈
- **框架**: FastAPI + Pydantic
- **数据库**: SQLAlchemy ORM（支持SQLite/MySQL/PostgreSQL）
- **导出**: openpyxl（Excel）、csv
- **解析**: markdown + 正则表达式

## 扩展建议
- 添加用户认证和权限管理
- 对接真实的ISBN数据库进行验证
- 添加前端管理界面
- 支持更多导入格式（Excel等）
- 添加数据备份和恢复功能
