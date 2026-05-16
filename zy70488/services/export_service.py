import uuid
import hashlib
import pandas as pd
from datetime import datetime
from typing import List, Dict, Any
from pathlib import Path

from models import (
    DeviceLedger,
    DuplicateRecord,
    AbnormalRecord,
    ExportRequest,
    ExportResult,
    ApprovalNode,
)


class ExportService:
    def __init__(self, export_dir: str = "./data/exports"):
        self.export_dir = Path(export_dir)
        self.export_dir.mkdir(parents=True, exist_ok=True)

    def export_abnormal_records(
        self,
        abnormal_records: List[AbnormalRecord],
        receipts: Dict[str, DeviceLedger],
        include_original_data: bool = True,
    ) -> ExportResult:
        export_data = []
        
        for record in abnormal_records:
            receipt = receipts.get(record.receipt_id)
            if receipt:
                row = {
                    "异常ID": record.id,
                    "异常类型": record.abnormal_type,
                    "异常描述": record.description,
                    "字段名": record.field_name,
                    "原始值": record.original_value,
                    "期望值": record.expected_value,
                    "检测时间": record.detected_at.strftime("%Y-%m-%d %H:%M:%S"),
                    "收据ID": receipt.id,
                    "原始输入ID": receipt.original_id,
                    "来源文件": receipt.source_file,
                    "原始行号": receipt.row_number,
                    "门店编号": receipt.store_code,
                    "门店名称": receipt.store_name,
                    "设备编号": receipt.device_code,
                    "设备名称": receipt.device_name,
                    "收据编号": receipt.receipt_number,
                    "审批节点": receipt.approval_node,
                    "报告口径": receipt.report_caliber,
                }
                
                if receipt.meeting_attachments:
                    for idx, att in enumerate(receipt.meeting_attachments, 1):
                        row[f"附件{idx}_名称"] = att.file_name
                        row[f"附件{idx}_原始值"] = att.original_value
                        row[f"附件{idx}_修正值"] = att.corrected_value or ""
                        row[f"附件{idx}_上传人"] = att.uploader
                
                if include_original_data:
                    for key, value in receipt.raw_data.items():
                        row[f"原始_{key}"] = str(value)
                
                export_data.append(row)
        
        df = pd.DataFrame(export_data)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"异常记录_{timestamp}.xlsx"
        file_path = self.export_dir / filename
        
        df.to_excel(file_path, index=False, engine="openpyxl")
        
        checksum = self._calculate_checksum(file_path)
        
        return ExportResult(
            file_path=str(file_path),
            record_count=len(export_data),
            export_time=datetime.now(),
            checksum=checksum,
        )

    def export_duplicate_records(
        self,
        duplicate_records: List[DuplicateRecord],
        receipts: Dict[str, DeviceLedger],
        include_original_data: bool = True,
    ) -> ExportResult:
        export_data = []
        
        for record in duplicate_records:
            original = receipts.get(record.original_receipt_id)
            duplicate = receipts.get(record.duplicate_receipt_id)
            
            if original and duplicate:
                row = {
                    "重复记录ID": record.id,
                    "重复原因": record.duplicate_reason,
                    "重复字段": ", ".join(record.duplicate_fields),
                    "置信度": record.confidence,
                    "检测时间": record.detected_at.strftime("%Y-%m-%d %H:%M:%S"),
                    "已复核": "是" if record.reviewed else "否",
                    "复核人": record.reviewer or "",
                    "复核意见": record.review_comment or "",
                }
                
                for prefix, rec in [("原始", original), ("重复", duplicate)]:
                    row[f"{prefix}_收据ID"] = rec.id
                    row[f"{prefix}_原始输入ID"] = rec.original_id
                    row[f"{prefix}_来源文件"] = rec.source_file
                    row[f"{prefix}_原始行号"] = rec.row_number
                    row[f"{prefix}_门店"] = rec.store_name
                    row[f"{prefix}_设备编号"] = rec.device_code
                    row[f"{prefix}_收据编号"] = rec.receipt_number
                    row[f"{prefix}_审批节点"] = rec.approval_node
                    
                    if include_original_data:
                        for key, value in rec.raw_data.items():
                            row[f"{prefix}_{key}"] = str(value)
                
                export_data.append(row)
        
        df = pd.DataFrame(export_data)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"重复记录_{timestamp}.xlsx"
        file_path = self.export_dir / filename
        
        df.to_excel(file_path, index=False, engine="openpyxl")
        
        checksum = self._calculate_checksum(file_path)
        
        return ExportResult(
            file_path=str(file_path),
            record_count=len(export_data),
            export_time=datetime.now(),
            checksum=checksum,
        )

    def export_by_approval_node(
        self,
        receipts: List[DeviceLedger],
        approval_node: ApprovalNode,
        include_attachments: bool = True,
    ) -> ExportResult:
        export_data = []
        
        for receipt in receipts:
            row = {
                "收据ID": receipt.id,
                "原始输入ID": receipt.original_id,
                "来源文件": receipt.source_file,
                "原始行号": receipt.row_number,
                "门店编号": receipt.store_code,
                "门店名称": receipt.store_name,
                "设备编号": receipt.device_code,
                "设备名称": receipt.device_name,
                "设备类型": receipt.device_type,
                "品牌": receipt.brand,
                "型号": receipt.model,
                "序列号": receipt.serial_number,
                "采购日期": receipt.purchase_date,
                "采购金额": receipt.purchase_amount,
                "收据编号": receipt.receipt_number,
                "收据日期": receipt.receipt_date,
                "供应商": receipt.supplier,
                "经办人": receipt.operator,
                "审批节点": receipt.approval_node,
                "审批状态": receipt.approval_status,
                "报告口径": receipt.report_caliber,
            }
            
            if include_attachments and receipt.meeting_attachments:
                for idx, att in enumerate(receipt.meeting_attachments, 1):
                    row[f"附件{idx}_名称"] = att.file_name
                    row[f"附件{idx}_原始值"] = att.original_value
                    row[f"附件{idx}_修正值"] = att.corrected_value or ""
                    row[f"附件{idx}_修正对比"] = f"{att.original_value} → {att.corrected_value}" if att.corrected_value else ""
            
            export_data.append(row)
        
        df = pd.DataFrame(export_data)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"按审批节点导出_{approval_node}_{timestamp}.xlsx"
        file_path = self.export_dir / filename
        
        df.to_excel(file_path, index=False, engine="openpyxl")
        
        checksum = self._calculate_checksum(file_path)
        
        return ExportResult(
            file_path=str(file_path),
            record_count=len(export_data),
            export_time=datetime.now(),
            checksum=checksum,
        )

    def _calculate_checksum(self, file_path: Path) -> str:
        with open(file_path, "rb") as f:
            return hashlib.md5(f.read()).hexdigest()
