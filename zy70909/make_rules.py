import os

code = '''from typing import List, Dict
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
'''

with open('rules.py', 'w') as f:
    f.write(code)
print('rules.py part 1 written')
