# SQL参数擦除风险片段复检后端API

## 项目概述
用于慢查询样本脱敏处理的复检系统，确保发给供应商的SQL日志中不包含客户名、手机号等敏感信息。

## 核心功能
- SQL解析与参数定位
- 规则替换与风险片段识别
- 人工复检与修正
- 处理状态追踪
- 报告导出

## 快速启动

### 1. 安装依赖
```bash
pip install -r requirements.txt
```

### 2. 启动服务
```bash
python main.py
```
服务将在 http://localhost:8000 启动

API文档: http://localhost:8000/docs

### 3. 造数（初始化测试数据）
```bash
python seed_data.py
```

## 主流程CURL示例

### 创建擦除任务
```bash
curl -X POST "http://localhost:8000/api/v1/tasks" \
  -H "Content-Type: application/json" \
  -d '{
    "sql_content": "SELECT * FROM users WHERE name = '\''张三'\'' AND phone = '\''13800138000'\''",
    "params": {"name": "张三", "phone": "13800138000"},
    "created_by": "admin"
  }'
```

### 查询任务列表
```bash
curl "http://localhost:8000/api/v1/tasks?status=pending&page=1&page_size=10"
```

### 获取任务详情
```bash
curl "http://localhost:8000/api/v1/tasks/1"
```

### 自动擦除处理
```bash
curl -X POST "http://localhost:8000/api/v1/tasks/1/auto-process" \
  -H "Content-Type: application/json" \
  -d '{"processor": "system"}'
```

### 人工修正
```bash
curl -X POST "http://localhost:8000/api/v1/tasks/1/manual-review" \
  -H "Content-Type: application/json" \
  -d '{
    "processed_sql": "SELECT * FROM users WHERE name = '\''[姓名]'\'' AND phone = '\''[手机号]'\''",
    "reviewer": "admin",
    "conclusion": "approved",
    "comments": "已确认脱敏正确"
  }'
```

### 撤回任务
```bash
curl -X POST "http://localhost:8000/api/v1/tasks/1/withdraw" \
  -H "Content-Type: application/json" \
  -d '{"operator": "admin", "reason": "数据有误"}'
```

### 导出报告
```bash
curl -X GET "http://localhost:8000/api/v1/tasks/1/export" --output report.xlsx
```

## 冲突路径说明

### 状态流转规则
```
pending → processing → reviewed → completed
   ↓          ↓          ↓
 withdrawn  withdrawn   withdrawn
```

- **pending**: 待处理，可撤回
- **processing**: 处理中，可撤回
- **reviewed**: 已复检，可撤回
- **completed**: 已完成，不可撤回
- **withdrawn**: 已撤回，终态

### 冲突处理
1. 重复处理同一任务 → 返回400，提示状态错误
2. 撤回已完成任务 → 返回400，不可撤回
3. 修改不存在的任务 → 返回404

## 运行测试
```bash
pytest test_api.py -v
```

## 数据库表结构

### tasks
- 任务主表，存储SQL原始内容和处理状态

### risk_fragments
- 风险片段表，记录识别到的敏感数据位置

### erase_rules
- 脱敏规则表，配置正则匹配和替换方式

### operation_logs
- 操作日志表，记录所有状态变更和人工操作
