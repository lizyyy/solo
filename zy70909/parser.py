import csv
import io
import json
from datetime import datetime
from typing import List, Dict, Any, Optional
from fastapi import HTTPException
from models import OrderRecord, ChargingLog, PaymentReceipt

def parse_datetime(dt_str):
    if not dt_str:
        return None
    formats = ["%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S", "%Y/%m/%d %H:%M:%S"]
    for fmt in formats:
        try:
            return datetime.strptime(dt_str.strip(), fmt)
        except:
            continue
    return None

def parse_csv_file(content):
    try:
        return list(csv.DictReader(io.StringIO(content.decode("utf-8-sig"))))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"CSV error: {e}")

def parse_json_file(content):
    try:
        data = json.loads(content.decode("utf-8"))
        return data if isinstance(data, list) else [data]
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"JSON error: {e}")

def get_val(row, keys):
    return next((row.get(k) for k in keys if row.get(k)), None)

def normalize_order_record(row):
    return OrderRecord(
        order_id=get_val(row, ["订单号", "order_id", "orderId", "id"]) or "",
        station_id=get_val(row, ["站点ID", "station_id"]) or "",
        pile_number=get_val(row, ["桩编号", "桩号", "pile_number", "pileNumber"]) or "",
        user_id=get_val(row, ["用户ID", "user_id"]) or "",
        start_time=parse_datetime(get_val(row, ["开始时间", "start_time"])),
        end_time=parse_datetime(get_val(row, ["结束时间", "end_time"])),
        charge_duration=float(get_val(row, ["充电时长", "duration"]) or 0),
        charged_kwh=float(get_val(row, ["充电量", "charged_kwh", "kwh"]) or 0),
        total_amount=float(get_val(row, ["订单金额", "total_amount", "amount"]) or 0),
        payment_amount=float(get_val(row, ["支付金额", "payment_amount"]) or 0),
        refund_amount=float(get_val(row, ["退款金额", "refund_amount"]) or 0),
        status=get_val(row, ["订单状态", "status"]) or "unknown",
        source_platform=get_val(row, ["来源平台", "platform", "source"]) or "unknown",
        payment_status=get_val(row, ["支付状态", "payment_status"]),
        refund_status=get_val(row, ["退款状态", "refund_status"]),
        raw_data=row
    )

def normalize_charging_log(row):
    return ChargingLog(
        log_id=get_val(row, ["日志ID", "log_id", "id"]) or "",
        pile_number=get_val(row, ["桩编号", "桩号", "pile_number"]) or "",
        start_time=parse_datetime(get_val(row, ["开始时间", "start_time"])),
        end_time=parse_datetime(get_val(row, ["结束时间", "end_time"])),
        start_soc=float(get_val(row, ["起始SOC", "start_soc"]) or 0),
        end_soc=float(get_val(row, ["结束SOC", "end_soc"]) or 0),
        charged_kwh=float(get_val(row, ["充电量", "charged_kwh"]) or 0),
        voltage=float(get_val(row, ["电压", "voltage"]) or 0),
        current=float(get_val(row, ["电流", "current"]) or 0),
        power=float(get_val(row, ["功率", "power"]) or 0),
        status=get_val(row, ["状态", "status"]) or "unknown",
        error_code=get_val(row, ["错误码", "error_code"]),
        raw_data=row
    )

def normalize_payment_receipt(row):
    return PaymentReceipt(
        receipt_id=get_val(row, ["回执ID", "receipt_id", "payment_id", "id"]) or "",
        order_id=get_val(row, ["订单号", "order_id", "orderId"]) or "",
        transaction_id=get_val(row, ["交易流水号", "transaction_id"]) or "",
        amount=float(get_val(row, ["金额", "amount"]) or 0),
        payment_time=parse_datetime(get_val(row, ["支付时间", "payment_time"])),
        payment_method=get_val(row, ["支付方式", "payment_method"]) or "unknown",
        status=get_val(row, ["状态", "status"]) or "completed",
        type=get_val(row, ["类型", "type"]) or "payment",
        raw_data=row
    )
