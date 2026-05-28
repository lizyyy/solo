"""数据加载器 - 支持从JSON/CSV加载交易数据"""

import json
import csv
from datetime import date, datetime
from pathlib import Path
from typing import List, Optional

from .models import (
    DealStructure,
    UnderlyingAsset,
    CashFlowRecord,
    Tranche,
    ServicingFee,
    DefaultRecord,
    TriggerEvent,
    AllocationReportSample,
    AssetStatus,
    TrancheType,
    PaymentType,
    TriggerEventType,
)


class DataLoader:
    """交易数据加载器"""

    @staticmethod
    def _parse_date(date_str: str) -> date:
        formats = ["%Y-%m-%d", "%Y/%m/%d", "%d-%m-%Y", "%m/%d/%Y"]
        for fmt in formats:
            try:
                return datetime.strptime(date_str, fmt).date()
            except ValueError:
                continue
        raise ValueError(f"无法解析日期: {date_str}")

    @staticmethod
    def load_from_json(file_path: str) -> DealStructure:
        """从JSON文件加载交易数据"""
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        deal_data = data.get('deal', {})

        assets = [
            UnderlyingAsset(
                asset_id=a['asset_id'],
                original_balance=float(a['original_balance']),
                current_balance=float(a['current_balance']),
                coupon_rate=float(a['coupon_rate']),
                origination_date=DataLoader._parse_date(a['origination_date']),
                maturity_date=DataLoader._parse_date(a['maturity_date']),
                status=AssetStatus(a.get('status', 'performing')),
                borrower_id=a.get('borrower_id'),
                collateral_type=a.get('collateral_type'),
                custom_fields=a.get('custom_fields', {})
            )
            for a in deal_data.get('assets', [])
        ]

        cashflows = [
            CashFlowRecord(
                record_id=cf['record_id'],
                asset_id=cf['asset_id'],
                payment_date=DataLoader._parse_date(cf['payment_date']),
                payment_type=PaymentType(cf['payment_type']),
                amount=float(cf['amount']),
                is_recovery=cf.get('is_recovery', False),
                recovery_asset_id=cf.get('recovery_asset_id'),
                source_account=cf.get('source_account'),
                reference=cf.get('reference'),
                custom_fields=cf.get('custom_fields', {})
            )
            for cf in deal_data.get('cashflows', [])
        ]

        tranches = [
            Tranche(
                tranche_id=t['tranche_id'],
                tranche_name=t['tranche_name'],
                tranche_type=TrancheType(t['tranche_type']),
                original_balance=float(t['original_balance']),
                current_balance=float(t['current_balance']),
                coupon_rate=float(t['coupon_rate']),
                payment_priority=int(t['payment_priority']),
                payment_type=PaymentType(t.get('payment_type', 'principal_and_interest')),
                is_shortfall_carry=t.get('is_shortfall_carry', True),
                custom_fields=t.get('custom_fields', {})
            )
            for t in deal_data.get('tranches', [])
        ]

        servicing_fees = [
            ServicingFee(
                fee_id=sf['fee_id'],
                fee_name=sf['fee_name'],
                rate=float(sf['rate']),
                calculation_base=sf['calculation_base'],
                payment_priority=int(sf['payment_priority']),
                is_flat_fee=sf.get('is_flat_fee', False),
                flat_amount=float(sf['flat_amount']) if sf.get('flat_amount') else None,
                arrears=float(sf.get('arrears', 0.0)),
                custom_fields=sf.get('custom_fields', {})
            )
            for sf in deal_data.get('servicing_fees', [])
        ]

        default_records = [
            DefaultRecord(
                default_id=d['default_id'],
                asset_id=d['asset_id'],
                default_date=DataLoader._parse_date(d['default_date']),
                original_default_amount=float(d['original_default_amount']),
                remaining_default_amount=float(d['remaining_default_amount']),
                recovery_amount=float(d.get('recovery_amount', 0.0)),
                write_off_amount=float(d.get('write_off_amount', 0.0)),
                custom_fields=d.get('custom_fields', {})
            )
            for d in deal_data.get('default_records', [])
        ]

        trigger_events = [
            TriggerEvent(
                event_id=te['event_id'],
                event_name=te['event_name'],
                event_type=TriggerEventType(te['event_type']),
                test_formula=te['test_formula'],
                threshold=float(te['threshold']),
                actual_value=float(te.get('actual_value', 0.0)),
                cure_period=int(te.get('cure_period', 0)),
                custom_fields=te.get('custom_fields', {})
            )
            for te in deal_data.get('trigger_events', [])
        ]

        allocation_samples = [
            AllocationReportSample(
                sample_id=s['sample_id'],
                report_date=DataLoader._parse_date(s['report_date']),
                tranche_id=s['tranche_id'],
                expected_payment_type=PaymentType(s['expected_payment_type']),
                expected_amount=float(s['expected_amount']),
                custom_fields=s.get('custom_fields', {})
            )
            for s in deal_data.get('allocation_samples', [])
        ]

        return DealStructure(
            deal_id=deal_data.get('deal_id', 'UNKNOWN'),
            deal_name=deal_data.get('deal_name', 'Unknown ABS Deal'),
            closing_date=DataLoader._parse_date(deal_data.get('closing_date', '2020-01-01')),
            next_payment_date=DataLoader._parse_date(deal_data.get('next_payment_date', '2025-02-25')),
            assets=assets,
            cashflows=cashflows,
            tranches=tranches,
            servicing_fees=servicing_fees,
            default_records=default_records,
            trigger_events=trigger_events,
            allocation_samples=allocation_samples,
            reserve_account_balance=float(deal_data.get('reserve_account_balance', 0.0)),
            collection_account_balance=float(deal_data.get('collection_account_balance', 0.0)),
            reinvestment_account_balance=float(deal_data.get('reinvestment_account_balance', 0.0)),
        )

    @staticmethod
    def deal_to_json(deal: DealStructure, file_path: str):
        """将交易数据导出为JSON"""
        data = {
            "deal": {
                "deal_id": deal.deal_id,
                "deal_name": deal.deal_name,
                "closing_date": deal.closing_date.isoformat(),
                "next_payment_date": deal.next_payment_date.isoformat(),
                "reserve_account_balance": deal.reserve_account_balance,
                "collection_account_balance": deal.collection_account_balance,
                "reinvestment_account_balance": deal.reinvestment_account_balance,
                "assets": [
                    {
                        "asset_id": a.asset_id,
                        "original_balance": a.original_balance,
                        "current_balance": a.current_balance,
                        "coupon_rate": a.coupon_rate,
                        "origination_date": a.origination_date.isoformat(),
                        "maturity_date": a.maturity_date.isoformat(),
                        "status": a.status.value,
                        "borrower_id": a.borrower_id,
                        "collateral_type": a.collateral_type,
                        "custom_fields": a.custom_fields
                    }
                    for a in deal.assets
                ],
                "cashflows": [
                    {
                        "record_id": cf.record_id,
                        "asset_id": cf.asset_id,
                        "payment_date": cf.payment_date.isoformat(),
                        "payment_type": cf.payment_type.value,
                        "amount": cf.amount,
                        "is_recovery": cf.is_recovery,
                        "recovery_asset_id": cf.recovery_asset_id,
                        "source_account": cf.source_account,
                        "reference": cf.reference,
                        "custom_fields": cf.custom_fields
                    }
                    for cf in deal.cashflows
                ],
                "tranches": [
                    {
                        "tranche_id": t.tranche_id,
                        "tranche_name": t.tranche_name,
                        "tranche_type": t.tranche_type.value,
                        "original_balance": t.original_balance,
                        "current_balance": t.current_balance,
                        "coupon_rate": t.coupon_rate,
                        "payment_priority": t.payment_priority,
                        "payment_type": t.payment_type.value,
                        "is_shortfall_carry": t.is_shortfall_carry,
                        "custom_fields": t.custom_fields
                    }
                    for t in deal.tranches
                ],
                "servicing_fees": [
                    {
                        "fee_id": sf.fee_id,
                        "fee_name": sf.fee_name,
                        "rate": sf.rate,
                        "calculation_base": sf.calculation_base,
                        "payment_priority": sf.payment_priority,
                        "is_flat_fee": sf.is_flat_fee,
                        "flat_amount": sf.flat_amount,
                        "arrears": sf.arrears,
                        "custom_fields": sf.custom_fields
                    }
                    for sf in deal.servicing_fees
                ],
                "default_records": [
                    {
                        "default_id": d.default_id,
                        "asset_id": d.asset_id,
                        "default_date": d.default_date.isoformat(),
                        "original_default_amount": d.original_default_amount,
                        "remaining_default_amount": d.remaining_default_amount,
                        "recovery_amount": d.recovery_amount,
                        "write_off_amount": d.write_off_amount,
                        "custom_fields": d.custom_fields
                    }
                    for d in deal.default_records
                ],
                "trigger_events": [
                    {
                        "event_id": te.event_id,
                        "event_name": te.event_name,
                        "event_type": te.event_type.value,
                        "test_formula": te.test_formula,
                        "threshold": te.threshold,
                        "actual_value": te.actual_value,
                        "cure_period": te.cure_period,
                        "custom_fields": te.custom_fields
                    }
                    for te in deal.trigger_events
                ],
                "allocation_samples": [
                    {
                        "sample_id": s.sample_id,
                        "report_date": s.report_date.isoformat(),
                        "tranche_id": s.tranche_id,
                        "expected_payment_type": s.expected_payment_type.value,
                        "expected_amount": s.expected_amount,
                        "actual_amount": s.actual_amount,
                        "variance": s.variance,
                        "is_matched": s.is_matched,
                        "custom_fields": s.custom_fields
                    }
                    for s in deal.allocation_samples
                ],
            }
        }

        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
