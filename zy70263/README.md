# 水上乐园腕带押金 API

## 安装运行

```bash
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

API 文档: http://localhost:8000/docs

## 样例入口

运行完整测试流程：
```bash
python test_flow.py
```

## 核心操作

**腕带生命周期**: 发放 → 冻结押金 → 激活 → 消费/储值 → 结算

```bash
# 发放腕带
curl -X POST http://localhost:8000/api/wristbands \
  -H "Content-Type: application/json" \
  -d '{"wristband_no": "A001", "visitor_name": "张三", "deposit_amount": 20}'

# 冻结押金
curl -X POST http://localhost:8000/api/wristbands/A001/freeze

# 激活并储值
curl -X POST "http://localhost:8000/api/wristbands/A001/activate?initial_deposit=100"

# 消费
curl -X POST http://localhost:8000/api/wristbands/A001/consume \
  -H "Content-Type: application/json" \
  -d '{"amount": 35, "description": "小吃消费"}'

# 遗失补办
curl -X POST http://localhost:8000/api/wristbands/A001/loss \
  -H "Content-Type: application/json" \
  -d '{"new_wristband_no": "A002", "replacement_fee": 10}'

# 闭园结算
curl -X POST http://localhost:8000/api/settlement
```

## 检查结果

```bash
# 查看统计
curl http://localhost:8000/api/statistics

# 查看腕带详情
curl http://localhost:8000/api/wristbands/A001

# 查看交易记录
curl http://localhost:8000/api/wristbands/A001/transactions

# 查看结算历史
curl http://localhost:8000/api/settlements

# 下载结算导出文件
curl http://localhost:8000/api/settlements/1/export -o settlement.csv
```

## 幂等性验证

```bash
# 验证重复结算不会产生重复数据
python test_idempotency.py
```
