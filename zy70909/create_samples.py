import json
import os

# 创建订单 CSV
csv_content = (
    "订单号,站点ID,桩编号,用户ID,开始时间,结束时间,充电时长,充电量,订单金额,支付金额,退款金额,订单状态,来源平台,支付状态\n"
    "ORD202405150001,ST001,A01-B03,USER001,2024-05-15 08:30:00,2024-05-15 09:15:00,45,32.5,48.75,48.75,0,已完成,小桔充电,已支付\n"
    "ORD202405150002,ST001,A02-C01,USER002,2024-05-15 10:00:00,2024-05-15 10:05:00,5,0,25.00,25.00,0,充电失败,特来电,已支付\n"
    "ORD202405150003,ST002,A05-B12,USER003,2024-05-15 11:20:00,2024-05-15 12:00:00,40,25.0,999.00,999.00,0,已完成,星星充电,已支付\n"
    "ORD202405150004,ST001,A03-D02,USER004,2024-05-15 13:00:00,2024-05-15 13:30:00,30,18.5,27.75,27.75,27.75,已退款,小桔充电,已退款\n"
    "ORD202405150005,ST003,B01-A01,USER005,2024-05-15 14:00:00,2024-05-15 14:45:00,45,40.2,60.30,60.30,0,已完成,小桔充电,已支付\n"
    "ORD202405150006,ST002,C02-E05,USER006,2024-05-15 15:30:00,2024-05-15 16:00:00,30,22.1,33.15,0,0,已完成,银联充电,未支付\n"
)

with open('sample_orders.csv', 'w', encoding='utf-8-sig') as f:
    f.write(csv_content)
print("sample_orders.csv created")

charging_logs = [
    {
        "log_id": "LOG202405150001",
        "pile_number": "A01-B03",
        "start_time": "2024-05-15 08:30:02",
        "end_time": "2024-05-15 09:14:58",
        "start_soc": 25,
        "end_soc": 85,
        "charged_kwh": 32.5,
        "voltage": 380,
        "current": 120,
        "power": 45.6,
        "status": "completed",
        "error_code": None
    },
    {
        "log_id": "LOG202405150002",
        "pile_number": "A02-C01",
        "start_time": "2024-05-15 10:00:05",
        "end_time": "2024-05-15 10:00:15",
        "start_soc": 45,
        "end_soc": 45,
        "charged_kwh": 0,
        "voltage": 0,
        "current": 0,
        "power": 0,
        "status": "failed",
        "error_code": "E001-通信中断"
    },
    {
        "log_id": "LOG202405150003",
        "pile_number": "A05-B12",
        "start_time": "2024-05-15 11:20:01",
        "end_time": "2024-05-15 11:59:59",
        "start_soc": 30,
        "end_soc": 70,
        "charged_kwh": 25.0,
        "voltage": 380,
        "current": 100,
        "power": 38.0,
        "status": "completed",
        "error_code": None
    },
    {
        "log_id": "LOG202405150004",
        "pile_number": "B01-A01",
        "start_time": "2024-05-15 14:00:03",
        "end_time": "2024-05-15 14:44:55",
        "start_soc": 15,
        "end_soc": 90,
        "charged_kwh": 40.2,
        "voltage": 400,
        "current": 150,
        "power": 60.0,
        "status": "completed",
        "error_code": None
    }
]

with open('sample_charging_logs.json', 'w', encoding='utf-8') as f:
    json.dump(charging_logs, f, ensure_ascii=False, indent=2)
print("sample_charging_logs.json created")

payments = [
    {
        "receipt_id": "PAY202405150001",
        "order_id": "ORD202405150001",
        "transaction_id": "TXN20240515083001",
        "amount": 48.75,
        "payment_time": "2024-05-15 09:15:00",
        "payment_method": "微信支付",
        "status": "success",
        "type": "payment",
        "source": "小桔充电"
    },
    {
        "receipt_id": "PAY202405150002",
        "order_id": "ORD202405150002",
        "transaction_id": "TXN20240515100001",
        "amount": 25.00,
        "payment_time": "2024-05-15 10:00:00",
        "payment_method": "支付宝",
        "status": "success",
        "type": "payment",
        "source": "特来电"
    },
    {
        "receipt_id": "PAY202405150003",
        "order_id": "ORD202405150003",
        "transaction_id": "TXN20240515112001",
        "amount": 999.00,
        "payment_time": "2024-05-15 12:00:00",
        "payment_method": "微信支付",
        "status": "success",
        "type": "payment",
        "source": "星星充电"
    },
    {
        "receipt_id": "PAY202405150004",
        "order_id": "ORD202405150004",
        "transaction_id": "TXN20240515130001",
        "amount": 27.75,
        "payment_time": "2024-05-15 13:00:00",
        "payment_method": "微信支付",
        "status": "success",
        "type": "payment",
        "source": "小桔充电"
    },
    {
        "receipt_id": "REF202405150001",
        "order_id": "ORD202405150004",
        "transaction_id": "TXN20240515133501",
        "amount": 27.75,
        "payment_time": "2024-05-15 13:35:00",
        "payment_method": "原路退回",
        "status": "success",
        "type": "refund",
        "source": "小桔充电"
    },
    {
        "receipt_id": "REF202405150002",
        "order_id": "ORD202405150004",
        "transaction_id": "TXN20240515134001",
        "amount": 27.75,
        "payment_time": "2024-05-15 13:40:00",
        "payment_method": "原路退回",
        "status": "success",
        "type": "refund",
        "source": "运营平台"
    },
    {
        "receipt_id": "PAY202405150005",
        "order_id": "ORD202405150005",
        "transaction_id": "TXN20240515140001",
        "amount": 60.30,
        "payment_time": "2024-05-15 14:45:00",
        "payment_method": "支付宝",
        "status": "success",
        "type": "payment",
        "source": "小桔充电"
    }
]

with open('sample_payments.json', 'w', encoding='utf-8') as f:
    json.dump(payments, f, ensure_ascii=False, indent=2)
print("sample_payments.json created")

print("All sample files created successfully!")
