import pandas as pd
import json
from typing import List, Optional, Dict, Any
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_
from app.models import (
    DeclarationBatch, DeclarationItem, HsCode, RejectionNotice,
    TaxCertificate, OperationLog, BatchStatus, DeclarationItemStatus, OperationType
)
from app.schemas import (
    DeclarationBatchCreate, DeclarationItemCreate, HsCodeCreate,
    RejectionNoticeCreate, TaxCertificateCreate, OperationLogCreate
)


class CustomsService:
    def __init__(self, db: Session):
        self.db = db

    def _log_operation(self, operation_type: OperationType, operator: str,
                       reason: str = None, batch_id: int = None, item_id: int = None,
                       before_data: str = None, after_data: str = None, remark: str = None):
        log = OperationLog(
            operation_type=operation_type,
            operator=operator,
            reason=reason,
            batch_id=batch_id,
            item_id=item_id,
            before_data=before_data,
            after_data=after_data,
            remark=remark
        )
        self.db.add(log)
        self.db.commit()
        return log

    def import_hs_codes_from_json(self, json_data: str, operator: str) -> List[HsCode]:
        data = json.loads(json_data)
        hs_codes = []
        for item in data:
            existing = self.db.query(HsCode).filter(HsCode.code == item.get("code")).first()
            if existing:
                existing.name = item.get("name", existing.name)
                existing.tax_rate = item.get("tax_rate", existing.tax_rate)
                existing.additional_tax_rate = item.get("additional_tax_rate", existing.additional_tax_rate)
                existing.category_code = item.get("category_code", existing.category_code)
                existing.category_name = item.get("category_name", existing.category_name)
                hs_codes.append(existing)
            else:
                hs_code = HsCode(
                    code=item.get("code"),
                    name=item.get("name"),
                    tax_rate=item.get("tax_rate"),
                    additional_tax_rate=item.get("additional_tax_rate", 0),
                    unit=item.get("unit"),
                    category_code=item.get("category_code"),
                    category_name=item.get("category_name"),
                    effective_date=item.get("effective_date"),
                    expiry_date=item.get("expiry_date"),
                    remark=item.get("remark")
                )
                self.db.add(hs_code)
                hs_codes.append(hs_code)
        self.db.commit()
        self._log_operation(
            operation_type=OperationType.UPDATE_TAX_RATE,
            operator=operator,
            reason=f"导入/更新了{len(hs_codes)}条税则编码"
        )
        return hs_codes

    def import_declaration_from_csv(self, csv_file: Any, batch_no: str, operator: str,
                                    declaration_port: str = None, declaration_date: datetime = None,
                                    ebp_no: str = None, currency: str = "CNY") -> DeclarationBatch:
        df = pd.read_csv(csv_file)

        batch = DeclarationBatch(
            batch_no=batch_no,
            declaration_port=declaration_port,
            declaration_date=declaration_date,
            ebp_no=ebp_no,
            currency=currency,
            created_by=operator,
            status=BatchStatus.PENDING,
            total_items=len(df)
        )
        self.db.add(batch)
        self.db.flush()

        total_amount = 0
        total_tax = 0

        for _, row in df.iterrows():
            item = DeclarationItem(
                batch_id=batch.id,
                item_no=str(row.get("item_no", "")),
                sku=str(row.get("sku", "")),
                product_name=str(row.get("product_name", "")),
                specification=str(row.get("specification", "")),
                hs_code=str(row.get("hs_code", "")),
                origin_country=str(row.get("origin_country", "")),
                quantity=float(row.get("quantity", 0)) if pd.notna(row.get("quantity")) else None,
                unit=str(row.get("unit", "")),
                unit_price=float(row.get("unit_price", 0)) if pd.notna(row.get("unit_price")) else None,
                total_price=float(row.get("total_price", 0)) if pd.notna(row.get("total_price")) else None,
                currency=str(row.get("currency", currency)),
                exchange_rate=float(row.get("exchange_rate", 1.0)) if pd.notna(row.get("exchange_rate")) else 1.0,
                category_code=str(row.get("category_code", "")),
                category_name=str(row.get("category_name", "")),
                remark=str(row.get("remark", "")) if pd.notna(row.get("remark")) else None
            )

            if item.total_price and item.exchange_rate:
                item.total_price_cny = item.total_price * item.exchange_rate
                total_amount += item.total_price_cny

            if item.hs_code:
                hs_code = self.db.query(HsCode).filter(
                    HsCode.code == item.hs_code,
                    HsCode.is_valid == True
                ).first()
                if hs_code:
                    item.tax_rate = hs_code.tax_rate + hs_code.additional_tax_rate
                    if item.total_price_cny and item.tax_rate:
                        item.tax_amount_cny = item.total_price_cny * item.tax_rate / 100
                        total_tax += item.tax_amount_cny
                    item.category_code = hs_code.category_code
                    item.category_name = hs_code.category_name

            self.db.add(item)

        batch.total_amount = total_amount
        batch.total_tax = total_tax
        self.db.commit()

        self._log_operation(
            operation_type=OperationType.CREATE_BATCH,
            operator=operator,
            reason=f"创建申报批次 {batch_no}，包含{len(df)}条记录",
            batch_id=batch.id
        )

        return batch

    def import_rejection_notice(self, batch_id: int, rejection_no: str,
                                rejection_reason: str, handler: str,
                                rejection_date: datetime = None,
                                rejection_type: str = None) -> RejectionNotice:
        notice = RejectionNotice(
            batch_id=batch_id,
            rejection_no=rejection_no,
            rejection_date=rejection_date or datetime.now(),
            rejection_reason=rejection_reason,
            rejection_type=rejection_type,
            handler=handler
        )
        self.db.add(notice)

        batch = self.db.query(DeclarationBatch).filter(DeclarationBatch.id == batch_id).first()
        if batch:
            batch.status = BatchStatus.RETURNED

        self.db.commit()

        self._log_operation(
            operation_type=OperationType.RETURN_ITEM,
            operator=handler,
            reason=f"收到退单: {rejection_reason}",
            batch_id=batch_id
        )

        return notice

    def convert_currency(self, item_id: int, target_currency: str,
                         exchange_rate: float, operator: str, reason: str) -> DeclarationItem:
        item = self.db.query(DeclarationItem).filter(DeclarationItem.id == item_id).first()
        if not item:
            raise ValueError("申报明细不存在")

        before_data = json.dumps({
            "currency": item.currency,
            "exchange_rate": item.exchange_rate,
            "total_price_cny": item.total_price_cny
        }, ensure_ascii=False)

        item.currency = target_currency
        item.exchange_rate = exchange_rate
        if item.total_price:
            item.total_price_cny = item.total_price * exchange_rate
            if item.tax_rate:
                item.tax_amount_cny = item.total_price_cny * item.tax_rate / 100

        self.db.commit()

        after_data = json.dumps({
            "currency": item.currency,
            "exchange_rate": item.exchange_rate,
            "total_price_cny": item.total_price_cny
        }, ensure_ascii=False)

        self._log_operation(
            operation_type=OperationType.CURRENCY_CONVERT,
            operator=operator,
            reason=reason,
            item_id=item_id,
            before_data=before_data,
            after_data=after_data
        )

        return item

    def merge_category(self, item_ids: List[int], target_category_code: str,
                       target_category_name: str, operator: str, reason: str) -> List[DeclarationItem]:
        items = self.db.query(DeclarationItem).filter(DeclarationItem.id.in_(item_ids)).all()
        updated_items = []

        for item in items:
            before_data = json.dumps({
                "category_code": item.category_code,
                "category_name": item.category_name
            }, ensure_ascii=False)

            item.category_code = target_category_code
            item.category_name = target_category_name
            updated_items.append(item)

            after_data = json.dumps({
                "category_code": item.category_code,
                "category_name": item.category_name
            }, ensure_ascii=False)

            self._log_operation(
                operation_type=OperationType.CATEGORY_MERGE,
                operator=operator,
                reason=reason,
                item_id=item.id,
                before_data=before_data,
                after_data=after_data
            )

        self.db.commit()
        return updated_items

    def process_supplement_tax(self, item_id: int, certificate_no: str,
                               tax_amount: float, reason: str, operator: str,
                               tax_type: str = "补税", certificate_type: str = "补税凭证",
                               source_type: str = None, source_id: str = None) -> TaxCertificate:
        item = self.db.query(DeclarationItem).filter(DeclarationItem.id == item_id).first()
        if not item:
            raise ValueError("申报明细不存在")

        before_data = json.dumps({
            "is_supplement_tax": item.is_supplement_tax,
            "supplement_tax_count": item.supplement_tax_count,
            "tax_amount_cny": item.tax_amount_cny
        }, ensure_ascii=False)

        item.is_supplement_tax = True
        item.supplement_tax_count += 1
        item.status = DeclarationItemStatus.SUPPLEMENT_TAX
        if item.tax_amount_cny:
            item.tax_amount_cny += tax_amount
        else:
            item.tax_amount_cny = tax_amount

        certificate = TaxCertificate(
            certificate_no=certificate_no,
            item_id=item_id,
            batch_id=item.batch_id,
            declaration_item_no=item.item_no,
            certificate_type=certificate_type,
            issue_date=datetime.now(),
            tax_type=tax_type,
            tax_amount=tax_amount,
            reason=reason,
            handler=operator,
            source_type=source_type,
            source_id=source_id
        )
        self.db.add(certificate)
        self.db.commit()

        after_data = json.dumps({
            "is_supplement_tax": item.is_supplement_tax,
            "supplement_tax_count": item.supplement_tax_count,
            "tax_amount_cny": item.tax_amount_cny
        }, ensure_ascii=False)

        self._log_operation(
            operation_type=OperationType.SUPPLEMENT_TAX,
            operator=operator,
            reason=reason,
            item_id=item_id,
            batch_id=item.batch_id,
            before_data=before_data,
            after_data=after_data
        )

        return certificate

    def mark_item_processed(self, item_id: int, operator: str,
                            status: DeclarationItemStatus, remark: str = None) -> DeclarationItem:
        item = self.db.query(DeclarationItem).filter(DeclarationItem.id == item_id).first()
        if not item:
            raise ValueError("申报明细不存在")

        before_data = json.dumps({"status": item.status}, ensure_ascii=False)
        item.status = status
        if remark:
            item.remark = remark
        self.db.commit()

        after_data = json.dumps({"status": status}, ensure_ascii=False)

        self._log_operation(
            operation_type=OperationType.PROCESS_ITEM,
            operator=operator,
            reason=remark or f"标记为{status}",
            item_id=item_id,
            before_data=before_data,
            after_data=after_data
        )

        return item

    def return_item_for_correction(self, item_id: int, operator: str,
                                    reason: str) -> DeclarationItem:
        item = self.db.query(DeclarationItem).filter(DeclarationItem.id == item_id).first()
        if not item:
            raise ValueError("申报明细不存在")

        before_data = json.dumps({"status": item.status}, ensure_ascii=False)
        item.status = DeclarationItemStatus.NEEDS_CORRECTION
        self.db.commit()

        after_data = json.dumps({"status": DeclarationItemStatus.NEEDS_CORRECTION}, ensure_ascii=False)

        self._log_operation(
            operation_type=OperationType.RETURN_ITEM,
            operator=operator,
            reason=reason,
            item_id=item_id,
            before_data=before_data,
            after_data=after_data
        )

        return item

    def export_items(self, batch_id: int = None, status: DeclarationItemStatus = None,
                     hs_code: str = None, is_supplement_tax: bool = None,
                     operator: str = None) -> List[DeclarationItem]:
        query = self.db.query(DeclarationItem)

        if batch_id:
            query = query.filter(DeclarationItem.batch_id == batch_id)
        if status:
            query = query.filter(DeclarationItem.status == status)
        if hs_code:
            query = query.filter(DeclarationItem.hs_code == hs_code)
        if is_supplement_tax is not None:
            query = query.filter(DeclarationItem.is_supplement_tax == is_supplement_tax)

        items = query.all()

        if operator:
            self._log_operation(
                operation_type=OperationType.EXPORT,
                operator=operator,
                reason=f"导出{len(items)}条申报明细",
                batch_id=batch_id
            )

        return items

    def query_by_batch_no(self, batch_no: str) -> Optional[DeclarationBatch]:
        return self.db.query(DeclarationBatch).filter(DeclarationBatch.batch_no == batch_no).first()

    def query_by_rejection_no(self, rejection_no: str) -> Optional[RejectionNotice]:
        return self.db.query(RejectionNotice).filter(RejectionNotice.rejection_no == rejection_no).first()

    def query_tax_certificate(self, certificate_no: str) -> Optional[TaxCertificate]:
        return self.db.query(TaxCertificate).filter(TaxCertificate.certificate_no == certificate_no).first()

    def trace_tax_certificate(self, certificate_no: str) -> Dict[str, Any]:
        certificate = self.query_tax_certificate(certificate_no)
        if not certificate:
            return None

        item = self.db.query(DeclarationItem).filter(DeclarationItem.id == certificate.item_id).first()
        batch = None
        if item:
            batch = self.db.query(DeclarationBatch).filter(DeclarationBatch.id == item.batch_id).first()

        operations = self.db.query(OperationLog).filter(
            or_(
                OperationLog.item_id == certificate.item_id,
                and_(OperationLog.batch_id == certificate.batch_id, OperationLog.item_id.is_(None))
            )
        ).order_by(OperationLog.operation_time).all()

        return {
            "certificate": certificate,
            "item": item,
            "batch": batch,
            "operations": operations
        }
