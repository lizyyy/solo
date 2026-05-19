# 客服质检系统

自动检测外包转写文本中的道歉、退款承诺和敏感词，帮助质检组长高效完成质检工作。

## 功能特性

1. **智能扫描检测**
   - 检测客服对话中是否包含道歉用语
   - 检测客户表达不满时客服是否明确给出退款承诺
   - 敏感词匹配检测，支持自定义敏感词库

2. **数据导入导出**
   - 支持导入TXT格式的转写文本
   - 支持导入CSV格式的通话元数据
   - 支持导出CSV/Excel/JSON格式的质检结果

3. **人工复核流程**
   - 待复核问题列表
   - 问题状态标记（待复核/已确认/已驳回）
   - 审核人记录和时间戳

4. **幂等性保证**
   - 重复导入相同内容不会产生重复记录
   - 基于内容哈希的去重机制

5. **敏感字段脱敏**
   - 手机号、姓名等敏感字段在API返回时自动脱敏
   - 导出文件时也会自动脱敏
   - 支持自定义脱敏规则

6. **坏记录处理**
   - 格式错误记录自动捕获
   - 保留原始位置和错误原因
   - 提供修改建议

## 快速开始

### 1. 启动服务

```bash
./start.sh
```

服务启动后访问：
- 首页: http://localhost:8000
- API文档: http://localhost:8000/docs
- 交互文档: http://localhost:8000/redoc

### 2. 运行演示脚本

打开新终端，运行：

```bash
./demo.sh
```

脚本会自动完成以下操作：
- 导入敏感词表
- 导入3条通话转写文本
- 测试重复导入幂等性
- 查看质检记录和问题
- 标记问题状态
- 查看汇总统计
- 导出CSV结果

## API接口说明

### 导入接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/v1/import/transcription` | POST | 导入转写文本 |
| `/api/v1/import/metadata` | POST | 导入通话元数据 |
| `/api/v1/import/sensitive-words` | POST | 导入敏感词表 |

### 扫描接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/v1/scan` | POST | 执行扫描检测 |

### 记录查询

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/v1/records` | GET | 获取所有质检记录 |
| `/api/v1/records/{id}` | GET | 获取单条记录详情 |

### 问题复核

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/v1/issues/pending` | GET | 获取待复核问题列表 |
| `/api/v1/issues/mark` | POST | 标记问题状态 |

### 汇总和导出

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/v1/summary` | GET | 获取质检汇总统计 |
| `/api/v1/export` | POST | 导出质检结果 |

### 敏感词管理

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/v1/sensitive-words` | GET | 获取所有敏感词 |
| `/api/v1/sensitive-words` | POST | 添加敏感词 |
| `/api/v1/sensitive-words/{id}` | DELETE | 删除敏感词 |

### 其他接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/v1/bad-records` | GET | 获取坏记录列表 |
| `/api/v1/clear-all` | POST | 清除所有数据 |

## 文件格式说明

### 转写文本格式 (TXT)

支持以下分隔符：制表符(\t)、竖线(|)、逗号(,)

```
说话人 开始时间 结束时间 文本内容
客服	0.0	5.0	您好，请问有什么可以帮您？
客户	5.5	10.0	我要退款
```

### 元数据格式 (CSV)

```csv
call_id,agent_id,agent_name,customer_phone,customer_name,call_start_time,call_duration,call_type,satisfaction_score
call_001,AG001,张三,13800138000,李四,2024-01-15 09:30:00,240,complaint,3
```

### 敏感词格式 (TXT)

```
敏感词	分类	严重程度(1-5)
傻逼	辱骂	5
投诉	警示	3
```

## 目录结构

```
quality_inspection/
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI主入口
│   ├── models/              # 数据模型
│   │   ├── __init__.py
│   │   └── models.py
│   ├── services/            # 业务逻辑
│   │   ├── __init__.py
│   │   ├── scanner.py       # 文本扫描引擎
│   │   ├── importer.py      # 文件导入
│   │   └── exporter.py      # 导出功能
│   ├── api/                 # API路由
│   │   ├── __init__.py
│   │   └── routes.py
│   ├── utils/               # 工具函数
│   │   ├── __init__.py
│   │   ├── masking.py       # 敏感字段脱敏
│   │   └── storage.py       # 数据存储
│   └── data/                # 数据文件目录
├── tests/                   # 测试数据
│   ├── transcriptions/
│   ├── metadata/
│   └── sensitive_words/
├── requirements.txt
├── start.sh                 # 启动脚本
├── demo.sh                  # 演示脚本
└── README.md
```

## 问题类型说明

| 类型 | 说明 |
|------|------|
| missing_apology | 缺少道歉用语 |
| missing_refund_promise | 缺少退款承诺 |
| sensitive_word | 检测到敏感词 |
| bad_record | 格式错误的坏记录 |

## 审核状态说明

| 状态 | 说明 |
|------|------|
| pending | 待复核 |
| confirmed | 已确认（问题属实） |
| rejected | 已驳回（问题不属实） |

## 技术栈

- **FastAPI**: 高性能Web框架
- **Pydantic**: 数据验证
- **Pandas**: 数据处理
- **OpenPyXL**: Excel文件生成
- **chardet**: 编码检测

## 注意事项

1. 所有敏感字段（手机号、姓名等）在API返回和导出时都会自动脱敏
2. 重复导入相同内容的文件不会产生重复记录
3. 坏记录会被保留并可单独查询，不会丢失数据
4. 数据默认存储在JSON文件中，无需数据库
