import pandas as pd
import json
from datetime import datetime
from typing import List, Dict, Any
from io import StringIO, BytesIO
from . import schemas


def parse_deposit_csv(file_content: bytes, batch_id: int) -> List[schemas.DepositRecordCreate]:
    content = file_content.decode('utf-8-sig')
    df = pd.read_csv(StringIO(content))

    df.columns = [col.strip().lower().replace(' ', '_') for col in df.columns]

    required_columns = ['store_code', 'deposit_date', 'deposit_amount']
    for col in required_columns:
        if col not in df.columns:
            raise ValueError(f"CSV缺少必需列: {col}")

    records = []
    for _, row in df.iterrows():
        deposit_date = pd.to_datetime(row['deposit_date']).to_pydatetime()

        record = schemas.DepositRecordCreate(
            batch_id=batch_id,
            store_code=str(row['store_code']).strip(),
            deposit_date=deposit_date,
            deposit_amount=float(row['deposit_amount']),
            deposit_bank=str(row.get('deposit_bank', '')).strip() or None,
            deposit_slip_no=str(row.get('deposit_slip_no', '')).strip() or None,
            cashier=str(row.get('cashier', '')).strip() or None,
            remarks=str(row.get('remarks', '')).strip() or None
        )
        records.append(record)

    return records


def parse_sales_json(file_content: bytes, batch_id: int) -> List[schemas.SalesRecordCreate]:
    content = file_content.decode('utf-8')
    data = json.loads(content)

    if isinstance(data, dict) and 'records' in data:
        records_data = data['records']
    elif isinstance(data, list):
        records_data = data
    else:
        raise ValueError("JSON格式不正确，应为数组或包含records字段的对象")

    records = []
    for item in records_data:
        sale_date = item.get('sale_date') or item.get('date') or item.get('trans_date')
        if isinstance(sale_date, str):
            sale_date = datetime.fromisoformat(sale_date.replace('Z', '+00:00'))

        record = schemas.SalesRecordCreate(
            batch_id=batch_id,
            store_code=str(item.get('store_code', item.get('store', ''))).strip(),
            sale_date=sale_date,
            sale_amount=float(item.get('sale_amount', item.get('amount', 0))),
            payment_method=str(item.get('payment_method', item.get('payment', ''))).strip() or None,
            transaction_no=str(item.get('transaction_no', item.get('trans_no', ''))).strip() or None,
            cashier=str(item.get('cashier', '')).strip() or None,
            remarks=str(item.get('remarks', '')).strip() or None
        )
        records.append(record)

    return records


def parse_petty_cash_csv(file_content: bytes, batch_id: int) -> List[schemas.PettyCashRecordCreate]:
    content = file_content.decode('utf-8-sig')
    df = pd.read_csv(StringIO(content))

    df.columns = [col.strip().lower().replace(' ', '_') for col in df.columns]

    required_columns = ['store_code', 'account_no', 'trans_date', 'trans_type', 'trans_amount']
    for col in required_columns:
        if col not in df.columns:
            raise ValueError(f"CSV缺少必需列: {col}")

    records = []
    for _, row in df.iterrows():
        trans_date = pd.to_datetime(row['trans_date']).to_pydatetime()

        record = schemas.PettyCashRecordCreate(
            batch_id=batch_id,
            store_code=str(row['store_code']).strip(),
            account_no=str(row['account_no']).strip(),
            trans_date=trans_date,
            trans_type=str(row['trans_type']).strip().lower(),
            trans_amount=float(row['trans_amount']),
            balance=float(row['balance']) if pd.notna(row.get('balance')) else None,
            purpose=str(row.get('purpose', '')).strip() or None,
            handler=str(row.get('handler', '')).strip() or None,
            voucher_no=str(row.get('voucher_no', '')).strip() or None,
            remarks=str(row.get('remarks', '')).strip() or None
        )
        records.append(record)

    return records


def export_records_to_excel(records: List[Dict[str, Any]], record_type: str) -> bytes:
    df = pd.DataFrame(records)

    output = BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, sheet_name=record_type, index=False)

    output.seek(0)
    return output.getvalue()


def export_records_to_csv(records: List[Dict[str, Any]]) -> bytes:
    df = pd.DataFrame(records)
    return df.to_csv(index=False, encoding='utf-8-sig').encode('utf-8-sig')
