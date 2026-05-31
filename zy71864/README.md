# 数列递推诊断系统 - 启动说明

## 项目概述

数列递推诊断系统是一款面向中学数学教研团队的智能诊断工具，帮助教研人员快速、准确地批量诊断学生数列递推题的答题情况。

### 已实现的核心功能

1. ✅ **题库版本留底机制** - 修改题目时自动创建新版本，旧版本归档，等价答案自动复制
2. ✅ **等价答案识别** - 支持等差数列、等比数列、线性非齐次递推的等价判断
3. ✅ **幂等性处理** - 同一批材料第二次诊断时返回历史记录，不创建新记录
4. ✅ **人性化错误提示** - 错误信息使用自然语言，不含技术术语和堆栈
5. ✅ **筛选条件持久化** - 保存筛选条件，确保屏幕显示与导出讲评稿一致
6. ✅ **空集边界处理** - 明确指出空记录来源（讲评记录/题库表），给出处理建议和联系人

## 技术架构

- **后端**: FastAPI + SQLAlchemy + SQLite
- **前端**: React 18 + TypeScript + Ant Design + Zustand
- **诊断引擎**: 自定义数列递推验证器，支持多种递推类型解析和等价判断

## 目录结构

```
zy71864/
├── backend/                    # 后端应用
│   ├── app/
│   │   ├── routers/           # API 路由
│   │   ├── services/          # 业务逻辑
│   │   ├── models.py          # 数据模型
│   │   ├── schemas.py         # Pydantic Schema
│   │   ├── database.py        # 数据库连接
│   │   ├── config.py          # 配置
│   │   └── errors.py          # 错误定义
│   ├── tests/                 # 测试用例
│   ├── main.py                # 应用入口
│   └── requirements.txt       # Python 依赖
├── frontend/                   # 前端应用
│   ├── src/
│   │   ├── api/               # API 接口
│   │   ├── components/        # 公共组件
│   │   ├── pages/             # 页面组件
│   │   ├── store/             # 状态管理
│   │   ├── types/             # TypeScript 类型
│   │   ├── utils/             # 工具函数
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── package.json
│   └── vite.config.ts
└── .trae/documents/           # 项目文档
    ├── 数列递推诊断系统_PRD.md
    └── 数列递推诊断系统_技术架构.md
```

## 启动步骤

### 1. 启动后端服务

```bash
cd backend
pip install -r requirements.txt
python main.py
```

后端服务将在 `http://localhost:8000` 启动，API 文档地址：
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

### 2. 启动前端服务

```bash
cd frontend
npm install
npm run dev
```

前端服务将在 `http://localhost:3000` 启动。

### 3. 运行测试

```bash
cd backend
python -m pytest tests/test_diagnosis.py -v
# 或者
python -m unittest tests.test_diagnosis -v
```

## API 接口列表

### 题库管理
- `GET /api/v1/questions` - 获取题目列表
- `POST /api/v1/questions` - 创建题目
- `PUT /api/v1/questions/{id}` - 更新题目（自动创建新版本）
- `GET /api/v1/questions/{question_no}/versions` - 获取题目版本历史
- `POST /api/v1/questions/equivalent-answers` - 添加等价答案

### 讲评记录
- `GET /api/v1/evaluation-records` - 获取讲评记录列表
- `POST /api/v1/evaluation-records` - 创建单条记录
- `POST /api/v1/evaluation-records/batch` - 批量创建记录
- `POST /api/v1/evaluation-records/upload` - Excel/CSV 文件导入

### 诊断
- `GET /api/v1/diagnosis/batches` - 获取诊断批次列表
- `POST /api/v1/diagnosis/run` - 发起诊断
- `GET /api/v1/diagnosis/batches/{id}` - 获取批次详情
- `GET /api/v1/diagnosis/batches/{id}/results` - 获取诊断结果
- `POST /api/v1/diagnosis/export` - 导出讲评稿

### 筛选条件
- `GET /api/v1/filter-conditions` - 获取筛选条件列表
- `GET /api/v1/filter-conditions/current` - 获取当前使用的条件
- `POST /api/v1/filter-conditions` - 保存筛选条件
- `PUT /api/v1/filter-conditions/{id}/set-current` - 设为当前条件

## 核心业务流程

### 诊断流程
1. 用户在「讲评记录」页面选择需要诊断的记录
2. 在「诊断中心」输入批次名称，点击「开始诊断」
3. 系统先进行空集边界检查：
   - 如发现空记录，提示来源（讲评记录/题库表）、数量、处理方式
   - 用户处理后重试
4. 系统生成材料哈希值，检查是否已诊断过：
   - 如已诊断过，返回历史记录并提示（幂等性）
   - 如未诊断过，创建新批次开始诊断
5. 诊断引擎逐个处理：
   - 与标准答案比对，正确则标记为正确
   - 不正确则匹配等价答案库，匹配成功标记为等价正确
   - 都不匹配则分类错误类型，生成人性化错误提示
6. 展示诊断汇总和详情
7. 用户可保存筛选条件后导出讲评稿

### 版本留底流程
1. 用户修改题目时，系统自动将旧版本标记为非活跃
2. 创建新版本，版本号+1，关联父版本ID
3. 自动复制原有的等价答案配置到新版本
4. 历史诊断记录仍可追溯到对应版本的题目

## 错误类型说明

| 错误类型 | 说明 | 联系人 |
|---------|------|--------|
| format_error | 学生答案格式不正确 | 讲评老师 |
| type_mismatch | 递推类型不匹配（等差/等比混淆） | 任课老师 |
| wrong_common_difference | 公差计算错误 | 讲评老师 |
| wrong_common_ratio | 公比计算错误 | 讲评老师 |
| wrong_coefficient | 递推系数错误 | 讲评老师 |
| wrong_constant | 常数项错误 | 讲评老师 |
| calculation_error | 其他计算错误 | 讲评老师 |

## 数据库表结构

1. **question_bank** - 题库表（含版本留底）
2. **equivalent_answer** - 等价答案表
3. **evaluation_record** - 讲评记录表
4. **filter_condition** - 筛选条件表
5. **diagnosis_batch** - 诊断批次表（幂等性控制）
6. **diagnosis_result** - 诊断结果表

## 注意事项

1. 首次启动后端会自动创建数据库和初始数据
2. 数据库文件位于 `backend/sequence_diagnosis.db`
3. 前端开发模式下已配置代理，API 请求会自动转发到后端
4. 导出的讲评稿使用 Excel 格式，包含完整的诊断详情和改进建议
