from typing import List, Dict
from models import OrderRecord, ChargingLog, PaymentReceipt, FailedRecord, ProcessResult

def apply_rules(orders, charging_logs, payments, batch_id):
    normal_items = []
    pending_items = []
    failed_items = []

    logs_by_pile = {}
    for log in charging_logs:
        pn = log.pile_number
        if pn not in logs_by_pile:
            logs_by_pile[pn] = []
        logs_by_pile[pn].append(log)

    payments_by_order = {}
    for payment in payments:
        oid = payment.order_id
        if oid not in payments_by_order:
            payments_by_order[oid] = []
        payments_by_order[oid].append(payment)

    for order in orders:
        order_payments = payments_by_order.get(order.order_id, [])
        order_logs = logs_by_pile.get(order.pile_number, [])

        is_failed = False
        fail_reason = ""
        suggested_action = ""
        error_type = ""

        if order.charged_kwh == 0 or (order.status in ["充电失败", "failed", "FAIL"]):
            paid_amount = sum(p.amount for p in order_payments if p.type in ["payment", "支付"])
            refund_amount = sum(p.amount for p in order_payments if p.type in ["refund", "退款"])
            if paid_amount > 0 and refund_amount == 0:
                is_failed = True
                error_type = "未启动扣费"
                fail_reason = "充电失败但已扣费 " + str(paid_amount) + " 元，未发起退款"
                suggested_action = "立即核实订单，发起退款流程，并通知用户"

