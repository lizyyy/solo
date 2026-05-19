# 客服质检系统

基于 FastAPI 的客服转写文本质检系统，自动检测道歉缺失、退款承诺缺失、敏感词、说话人缺失和时间戳重叠。

## 功能特性

- ✅ **扫描检测**: 自动检测5类违规问题
- ✅ **人工复核**: 支持对扫描结果进行人工审核
- ✅ **汇总统计**: 提供质检数据统计概览
- ✅ **Excel导出**: 支持导出质检结果到Excel
- ✅ **幂等性保证**: 重复提交相同ID结果一致
- ✅ **敏感数据脱敏**: 手机号、邮箱、身份证、银行卡自动脱敏
- ✅ **规则版本控制**: 规则更新后自动重新扫描

## 违规类型

| 类型 | 说明 | 严重程度 |
|------|------|----------|
| missing_apology | 投诉场景缺少道歉 | high |
| missing_refund_promise | 退款请求缺少承诺 | high |
| sensitive_word | 包含敏感词汇 | high |
| missing_speaker | 缺少说话人标识 | low |
| timestamp_overlap | 时间戳重叠 | medium |

## 快速开始

### 1. 安装依赖并启动服务

```bash
chmod +x start.sh
./start.sh
```

或手动执行：

```bash
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 2. 运行测试脚本

新开一个终端窗口：

```bash
python test_flow.py
```

### 3. 访问API文档

打开浏览器访问：http://localhost:8000/docs

## API 接口

### 扫描转写文本
```bash
POST /api/scan
Content-Type: application/json

{
  "transcript_id": "CALL001",
  "segments": [
    {"speaker": "客服", "text": "您好", "start_time": 0.0, "end_time": 2.0}
  ],
  "metadata": {"is_complaint": false}
}
```

### 人工复核
```bash
POST /api/review
Content-Type: application/json

{
  "transcript_id": "CALL001",
  "status": "approved",
  "reviewer": "张三",
  "comment": "已核实"
}
```

### 获取扫描结果
```bash
GET /api/result/{transcript_id}
```

### 汇总统计
```bash
GET /api/summary
```

### 导出Excel
```bash
POST /api/export
```

### 获取规则配置
```bash
GET /api/rules
```

## 使用 curl 测试

```bash
# 健康检查
curl http://localhost:8000/health

# 扫描转写文本
curl -X POST http://localhost:8000/api/scan \
  -H "Content-Type: application/json" \
  -d '{
    "transcript_id": "TEST001",
    "segments": [
      {"speaker": "客服", "text": "您好，请问有什么可以帮您？", "start_time": 0.0, "end_time": 3.5},
      {"speaker": "客户", "text": "我要投诉", "start_time": 4.0, "end_time": 6.0},
      {"speaker": "客服", "text": "非常抱歉", "start_time": 6.5, "end_time": 9.0}
    ]
  }'

# 查看汇总
curl http://localhost:8000/api/summary

# 导出Excel
curl -X POST http://localhost:8000/api/export -o result.xlsx
```

## 项目结构

```
.
├── app/
│   ├── __init__.py
│   ├── main.py          # FastAPI 主应用
│   ├── models.py        # 数据模型
│   ├── rules.py         # 规则引擎
│   └── storage.py       # 数据存储
├── data/                # 数据目录（自动创建）
│   ├── scan_results.json
│   ├── review_records.json
│   └── app.log
├── requirements.txt
├── start.sh
├── test_flow.py
└── README.md
```

## 数据安全

所有敏感数据（手机号、邮箱、身份证、银行卡号）会在以下位置自动脱敏：

- API 返回结果
- 导出的Excel文件
- 系统日志
- 持久化存储文件

## 规则更新

如需更新检测规则，请修改 `app/rules.py` 中的关键字列表或检测逻辑。更新后：

1. 增加 `RULE_VERSION` 版本号
2. 重启服务
3. 重新扫描时会自动使用新规则
