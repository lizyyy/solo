"""初始化器 - 创建样例数据"""

import os
import json
from typing import List

from .models import (
    DossierCatalog,
    TransferBatch,
    ReceiptRecord,
    TransferStage,
    ReceiptStatus,
    ReturnReason,
    InitResult,
)
from .storage import Storage


SAMPLE_DATA_DIR = "samples"


class Initializer:
    """项目初始化器"""
    
    def __init__(self, storage: Storage):
        self.storage = storage
    
    def init(self, force: bool = False) -> InitResult:
        messages: List[str] = []
        
        if self.storage.has_data() and not force:
            return InitResult(
                success=False,
                error="项目已有数据，使用 --force 参数强制覆盖"
            )
        
        if force:
            self.storage.reset()
            messages.append("已重置现有数据")
        
        samples_dir = os.path.join(self.storage.project_path, SAMPLE_DATA_DIR)
        os.makedirs(samples_dir, exist_ok=True)
        
        catalog = self._create_sample_catalog()
        batches = self._create_sample_batches()
        receipts = self._create_sample_receipts()
        
        catalog_path = os.path.join(samples_dir, "catalog.json")
        batches_path = os.path.join(samples_dir, "batches.json")
        receipts_path = os.path.join(samples_dir, "receipts.json")
        
        with open(catalog_path, 'w', encoding='utf-8') as f:
            json.dump([{
                "case_id": c.case_id,
                "item_id": c.item_id,
                "item_name": c.item_name,
                "page_start": c.page_start,
                "page_end": c.page_end,
                "page_count": c.page_count,
                "notes": c.notes or ""
            } for c in catalog], f, ensure_ascii=False, indent=2)
        messages.append(f"✓ 创建样例: {catalog_path}")
        
        with open(batches_path, 'w', encoding='utf-8') as f:
            json.dump([{
                "batch_id": b.batch_id,
                "case_id": b.case_id,
                "from_stage": b.from_stage.value,
                "to_stage": b.to_stage.value,
                "total_pages": b.total_pages,
                "dossier_count": b.dossier_count,
                "transfer_date": b.transfer_date,
                "transfer_person": b.transfer_person,
                "notes": b.notes or ""
            } for b in batches], f, ensure_ascii=False, indent=2)
        messages.append(f"✓ 创建样例: {batches_path}")
        
        with open(receipts_path, 'w', encoding='utf-8') as f:
            json.dump([{
                "receipt_id": r.receipt_id,
                "batch_id": r.batch_id,
                "case_id": r.case_id,
                "receipt_date": r.receipt_date,
                "receipt_person": r.receipt_person,
                "received_page_count": r.received_page_count,
                "missing_pages": r.missing_pages or "",
                "extra_pages": r.extra_pages or "",
                "status": r.status.value,
                "return_reason": r.return_reason.value if r.return_reason else "",
                "return_notes": r.return_notes or ""
            } for r in receipts], f, ensure_ascii=False, indent=2)
        messages.append(f"✓ 创建样例: {receipts_path}")
        
        for c in catalog:
            self.storage.save_catalog(c)
        for b in batches:
            self.storage.save_batch(b)
        for r in receipts:
            self.storage.save_receipt(r)
        messages.append("✓ 样例数据已导入数据库")
        
        self.storage.add_history("init", True, "初始化项目并导入样例数据")
        
        return InitResult(success=True, messages=messages)
    
    def _create_sample_catalog(self) -> List[DossierCatalog]:
        return [
            DossierCatalog(
                case_id="(2024)京民初字第001号",
                item_id="C001",
                item_name="起诉状",
                page_start=1,
                page_end=3,
                page_count=3
            ),
            DossierCatalog(
                case_id="(2024)京民初字第001号",
                item_id="C002",
                item_name="证据材料清单",
                page_start=4,
                page_end=5,
                page_count=2
            ),
            DossierCatalog(
                case_id="(2024)京民初字第001号",
                item_id="C003",
                item_name="合同复印件",
                page_start=6,
                page_end=15,
                page_count=10
            ),
            DossierCatalog(
                case_id="(2024)京民初字第001号",
                item_id="C004",
                item_name="开庭传票",
                page_start=16,
                page_end=17,
                page_count=2
            ),
            DossierCatalog(
                case_id="(2024)京民初字第001号",
                item_id="C005",
                item_name="庭审笔录",
                page_start=18,
                page_end=25,
                page_count=8
            ),
            DossierCatalog(
                case_id="(2024)京民初字第001号",
                item_id="C006",
                item_name="判决书",
                page_start=26,
                page_end=30,
                page_count=5
            ),
            DossierCatalog(
                case_id="(2024)京民初字第002号",
                item_id="C001",
                item_name="起诉状",
                page_start=1,
                page_end=2,
                page_count=2
            ),
            DossierCatalog(
                case_id="(2024)京民初字第002号",
                item_id="C002",
                item_name="证据清单",
                page_start=3,
                page_end=10,
                page_count=8
            ),
            DossierCatalog(
                case_id="(2024)京民初字第002号",
                item_id="C003",
                item_name="送达回证",
                page_start=11,
                page_end=12,
                page_count=2
            ),
        ]
    
    def _create_sample_batches(self) -> List[TransferBatch]:
        return [
            TransferBatch(
                batch_id="BATCH-2024001",
                case_id="(2024)京民初字第001号",
                from_stage=TransferStage.FILING,
                to_stage=TransferStage.TRIAL,
                total_pages=30,
                dossier_count=1,
                transfer_date="2024-01-15",
                transfer_person="张三",
                notes="民事案件一审移送"
            ),
            TransferBatch(
                batch_id="BATCH-2024002",
                case_id="(2024)京民初字第001号",
                from_stage=TransferStage.TRIAL,
                to_stage=TransferStage.ARCHIVE,
                total_pages=30,
                dossier_count=1,
                transfer_date="2024-03-20",
                transfer_person="李四",
                notes="判决生效后归档"
            ),
            TransferBatch(
                batch_id="BATCH-2024003",
                case_id="(2024)京民初字第002号",
                from_stage=TransferStage.FILING,
                to_stage=TransferStage.TRIAL,
                total_pages=12,
                dossier_count=1,
                transfer_date="2024-02-01",
                transfer_person="王五",
                notes=""
            ),
            TransferBatch(
                batch_id="BATCH-2024004",
                case_id="(2024)京民初字第002号",
                from_stage=TransferStage.TRIAL,
                to_stage=TransferStage.ARCHIVE,
                total_pages=12,
                dossier_count=1,
                transfer_date="2024-04-10",
                transfer_person="赵六",
                notes=""
            ),
        ]
    
    def _create_sample_receipts(self) -> List[ReceiptRecord]:
        return [
            ReceiptRecord(
                receipt_id="RCPT-2024001",
                batch_id="BATCH-2024001",
                case_id="(2024)京民初字第001号",
                receipt_date="2024-01-16",
                receipt_person="审判庭A",
                received_page_count=30,
                status=ReceiptStatus.RECEIVED
            ),
            ReceiptRecord(
                receipt_id="RCPT-2024002",
                batch_id="BATCH-2024002",
                case_id="(2024)京民初字第001号",
                receipt_date="2024-03-21",
                receipt_person="档案室",
                received_page_count=28,
                missing_pages="10,27-28",
                status=ReceiptStatus.RETURNED,
                return_reason=ReturnReason.MISSING_PAGES,
                return_notes="发现缺页，退回审判庭补正"
            ),
            ReceiptRecord(
                receipt_id="RCPT-2024003",
                batch_id="BATCH-2024003",
                case_id="(2024)京民初字第002号",
                receipt_date="2024-02-02",
                receipt_person="审判庭B",
                received_page_count=12,
                status=ReceiptStatus.RECEIVED
            ),
            ReceiptRecord(
                receipt_id="RCPT-2024004",
                batch_id="BATCH-2024004",
                case_id="(2024)京民初字第002号",
                receipt_date="2024-04-11",
                receipt_person="档案室",
                received_page_count=12,
                status=ReceiptStatus.RECEIVED
            ),
        ]
