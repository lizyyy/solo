"""归档事务模块 - 按供应商和月份复制合格文件并写 manifest"""

import json
import shutil
from collections import defaultdict
from datetime import date, datetime
from decimal import Decimal
from pathlib import Path
from typing import Any, Dict, List, Optional

from tqdm import tqdm

from .models import (
    ArchiveManifest,
    ERPPayment,
    InvoiceItem,
    PaymentVerification,
    ReceiptInfo,
    SupplierLedger,
    VerificationStatus,
)
from .utils import ensure_directory, generate_id, normalize_text


class ArchiveOrganizer:
    """归档组织器"""

    def __init__(
        self,
        target_directory: str,
        archive_id: Optional[str] = None,
    ):
        """初始化归档组织器

        Args:
            target_directory: 目标归档目录
            archive_id: 归档 ID（自动生成时为 None）
        """
        self.target_directory = Path(target_directory).resolve()
        self.archive_id = archive_id or generate_id("ARCHIVE_")
        self.archive_date = datetime.now()

        ensure_directory(self.target_directory)

    def _sanitize_name(self, name: str) -> str:
        """清理文件名/目录名，移除非法字符

        Args:
            name: 原始名称

        Returns:
            清理后的名称
        """
        if not name:
            return "未知"

        name = normalize_text(name)
        invalid_chars = r'[<>:"/\\|?*]'
        name = __import__("re").sub(invalid_chars, "_", name)
        name = name.strip(". ")

        return name if name else "未知"

    def _get_archive_path(
        self,
        receipt: ReceiptInfo,
        payment: Optional[ERPPayment] = None,
        supplier: Optional[SupplierLedger] = None,
    ) -> Path:
        """获取归档文件的目标路径

        Args:
            receipt: 回单信息
            payment: 对应的 ERP 付款记录
            supplier: 对应的供应商信息

        Returns:
            目标文件路径
        """
        supplier_name = "未知供应商"
        if supplier and supplier.supplier_name:
            supplier_name = supplier.supplier_name
        elif payment and payment.payee_name:
            supplier_name = payment.payee_name
        elif receipt.payee_name:
            supplier_name = receipt.payee_name

        supplier_dir = self._sanitize_name(supplier_name)

        payment_date = None
        if receipt.payment_date:
            payment_date = receipt.payment_date
        elif payment and payment.payment_date:
            payment_date = payment.payment_date

        if payment_date:
            month_dir = f"{payment_date.year}年{payment_date.month:02d}月"
        else:
            month_dir = "未知日期"

        original_name = Path(receipt.file_path).name
        name_part = Path(original_name).stem
        ext_part = Path(original_name).suffix

        amount_str = ""
        if receipt.amount > 0:
            amount_str = f"_{receipt.amount:0.2f}"

        new_name = f"{name_part}{amount_str}{ext_part}"
        new_name = self._sanitize_name(new_name)

        target_path = self.target_directory / supplier_dir / month_dir / new_name

        counter = 1
        while target_path.exists():
            new_name_with_suffix = f"{name_part}{amount_str}_{counter:03d}{ext_part}"
            target_path = self.target_directory / supplier_dir / month_dir / new_name_with_suffix
            counter += 1

        return target_path

    def archive_receipt(
        self,
        receipt: ReceiptInfo,
        payment: Optional[ERPPayment] = None,
        supplier: Optional[SupplierLedger] = None,
        copy: bool = True,
    ) -> Dict[str, Any]:
        """归档单个回单文件

        Args:
            receipt: 回单信息
            payment: 对应的 ERP 付款记录
            supplier: 对应的供应商信息
            copy: 是否复制文件（False 时仅记录信息）

        Returns:
            归档信息字典
        """
        source_path = Path(receipt.file_path)
        target_path = self._get_archive_path(receipt, payment, supplier)

        if not source_path.exists():
            return {
                "success": False,
                "error": f"源文件不存在: {source_path}",
                "source": str(source_path),
            }

        if copy:
            ensure_directory(target_path.parent)

            try:
                shutil.copy2(source_path, target_path)
            except Exception as e:
                return {
                    "success": False,
                    "error": str(e),
                    "source": str(source_path),
                    "target": str(target_path),
                }

        return {
            "success": True,
            "source": str(source_path),
            "target": str(target_path),
            "file_hash": receipt.file_hash,
            "amount": str(receipt.amount),
            "payee_name": receipt.payee_name,
            "payment_date": str(receipt.payment_date) if receipt.payment_date else None,
            "supplier_name": supplier.supplier_name if supplier else None,
            "payment_id": payment.payment_id if payment else None,
        }

    def create_manifest(
        self,
        files: List[Dict[str, Any]],
        verification_summary: Dict[str, Any],
        source_directory: str,
    ) -> ArchiveManifest:
        """创建归档清单

        Args:
            files: 已归档文件列表
            verification_summary: 校验摘要
            source_directory: 源目录

        Returns:
            ArchiveManifest 对象
        """
        valid_count = sum(1 for f in files if f.get("success", False))
        invalid_count = len(files) - valid_count

        return ArchiveManifest(
            archive_id=self.archive_id,
            archive_date=self.archive_date,
            source_directory=source_directory,
            target_directory=str(self.target_directory),
            total_files=len(files),
            valid_files=valid_count,
            invalid_files=invalid_count,
            files=files,
            verification_summary=verification_summary,
        )

    def save_manifest(self, manifest: ArchiveManifest) -> Path:
        """保存归档清单到 JSON 文件

        Args:
            manifest: 归档清单对象

        Returns:
            保存的文件路径
        """
        manifest_path = self.target_directory / f"MANIFEST_{self.archive_id}.json"

        manifest_dict = {
            "archive_id": manifest.archive_id,
            "archive_date": manifest.archive_date.isoformat(),
            "source_directory": manifest.source_directory,
            "target_directory": manifest.target_directory,
            "statistics": {
                "total_files": manifest.total_files,
                "valid_files": manifest.valid_files,
                "invalid_files": manifest.invalid_files,
            },
            "verification_summary": manifest.verification_summary,
            "files": manifest.files,
        }

        with open(manifest_path, "w", encoding="utf-8") as f:
            json.dump(manifest_dict, f, ensure_ascii=False, indent=2)

        return manifest_path


class ArchiveManager:
    """归档管理器 - 整合校验和归档"""

    def __init__(
        self,
        source_directory: str,
        target_directory: str,
        receipts: List[ReceiptInfo],
        erp_payments: List[ERPPayment],
        invoices: List[InvoiceItem],
        suppliers: List[SupplierLedger],
        payment_verifications: List[PaymentVerification],
    ):
        """初始化归档管理器

        Args:
            source_directory: 源目录
            target_directory: 目标归档目录
            receipts: 回单信息列表
            erp_payments: ERP 付款记录列表
            invoices: 发票清单列表
            suppliers: 供应商台账列表
            payment_verifications: 付款校验结果列表
        """
        self.source_directory = source_directory
        self.target_directory = target_directory
        self.receipts = receipts
        self.erp_payments = erp_payments
        self.invoices = invoices
        self.suppliers = suppliers
        self.payment_verifications = payment_verifications

        self.organizer = ArchiveOrganizer(target_directory)

        self._build_indexes()

    def _build_indexes(self) -> None:
        """构建索引"""
        self.receipt_by_hash: Dict[str, ReceiptInfo] = {}
        for receipt in self.receipts:
            if receipt.file_hash:
                self.receipt_by_hash[receipt.file_hash] = receipt

        self.payment_by_id: Dict[str, ERPPayment] = {}
        for payment in self.erp_payments:
            if payment.payment_id:
                self.payment_by_id[payment.payment_id] = payment

        self.supplier_by_code: Dict[str, SupplierLedger] = {}
        self.supplier_by_name: Dict[str, SupplierLedger] = {}
        for supplier in self.suppliers:
            if supplier.supplier_code:
                self.supplier_by_code[supplier.supplier_code] = supplier
            if supplier.supplier_name:
                self.supplier_by_name[supplier.supplier_name] = supplier

        self.verification_by_payment_id: Dict[str, PaymentVerification] = {}
        for pv in self.payment_verifications:
            if pv.payment_id:
                self.verification_by_payment_id[pv.payment_id] = pv

    def _is_valid_for_archive(self, receipt: ReceiptInfo) -> bool:
        """检查回单是否适合归档

        Args:
            receipt: 回单信息

        Returns:
            是否适合归档
        """
        for pv in self.payment_verifications:
            if pv.receipt_info and pv.receipt_info.file_hash == receipt.file_hash:
                if pv.overall_status == VerificationStatus.FAILED:
                    return False
                break

        return True

    def _get_supplier_for_receipt(self, receipt: ReceiptInfo) -> Optional[SupplierLedger]:
        """为回单查找对应的供应商

        Args:
            receipt: 回单信息

        Returns:
            供应商信息或 None
        """
        for pv in self.payment_verifications:
            if pv.receipt_info and pv.receipt_info.file_hash == receipt.file_hash:
                if pv.supplier:
                    return pv.supplier
                if pv.erp_payment:
                    if pv.erp_payment.supplier_code in self.supplier_by_code:
                        return self.supplier_by_code[pv.erp_payment.supplier_code]
                    if pv.erp_payment.payee_name in self.supplier_by_name:
                        return self.supplier_by_name[pv.erp_payment.payee_name]

        if receipt.payee_name in self.supplier_by_name:
            return self.supplier_by_name[receipt.payee_name]

        return None

    def _get_payment_for_receipt(self, receipt: ReceiptInfo) -> Optional[ERPPayment]:
        """为回单查找对应的付款记录

        Args:
            receipt: 回单信息

        Returns:
            ERP 付款记录或 None
        """
        for pv in self.payment_verifications:
            if pv.receipt_info and pv.receipt_info.file_hash == receipt.file_hash:
                if pv.erp_payment:
                    return pv.erp_payment

        return None

    def archive_all(
        self,
        only_valid: bool = True,
        show_progress: bool = True,
    ) -> Dict[str, Any]:
        """执行所有文件归档

        Args:
            only_valid: 是否仅归档校验通过的文件
            show_progress: 是否显示进度

        Returns:
            归档结果字典
        """
        archived_files: List[Dict[str, Any]] = []

        receipts_to_archive = self.receipts
        if only_valid:
            receipts_to_archive = [r for r in self.receipts if self._is_valid_for_archive(r)]

        if show_progress:
            receipts_to_archive = tqdm(receipts_to_archive, desc="归档文件", unit="个")

        for receipt in receipts_to_archive:
            supplier = self._get_supplier_for_receipt(receipt)
            payment = self._get_payment_for_receipt(receipt)

            result = self.organizer.archive_receipt(
                receipt=receipt,
                payment=payment,
                supplier=supplier,
                copy=True,
            )
            archived_files.append(result)

        verification_summary = self._generate_verification_summary()

        manifest = self.organizer.create_manifest(
            files=archived_files,
            verification_summary=verification_summary,
            source_directory=self.source_directory,
        )

        manifest_path = self.organizer.save_manifest(manifest)

        success_count = sum(1 for f in archived_files if f.get("success", False))
        failed_count = len(archived_files) - success_count

        return {
            "archive_id": self.organizer.archive_id,
            "archive_date": self.organizer.archive_date.isoformat(),
            "source_directory": self.source_directory,
            "target_directory": str(self.organizer.target_directory),
            "manifest_path": str(manifest_path),
            "statistics": {
                "total_receipts": len(self.receipts),
                "archived_receipts": len(receipts_to_archive),
                "success_count": success_count,
                "failed_count": failed_count,
            },
            "verification_summary": verification_summary,
            "files": archived_files,
        }

    def _generate_verification_summary(self) -> Dict[str, Any]:
        """生成校验摘要

        Returns:
            校验摘要字典
        """
        total = len(self.payment_verifications)
        passed = sum(1 for pv in self.payment_verifications if pv.overall_status == VerificationStatus.PASSED)
        failed = sum(1 for pv in self.payment_verifications if pv.overall_status == VerificationStatus.FAILED)
        warning = sum(1 for pv in self.payment_verifications if pv.overall_status == VerificationStatus.WARNING)
        pending = sum(1 for pv in self.payment_verifications if pv.overall_status == VerificationStatus.PENDING)

        return {
            "total_payments": total,
            "passed": passed,
            "failed": failed,
            "warning": warning,
            "pending": pending,
            "by_status": {
                "PASSED": passed,
                "FAILED": failed,
                "WARNING": warning,
                "PENDING": pending,
            },
        }


def archive_valid_receipts(
    source_directory: str,
    target_directory: str,
    receipts: List[ReceiptInfo],
    erp_payments: List[ERPPayment],
    invoices: List[InvoiceItem],
    suppliers: List[SupplierLedger],
    payment_verifications: List[PaymentVerification],
    only_valid: bool = True,
) -> Dict[str, Any]:
    """便捷函数：归档合格回单

    Args:
        source_directory: 源目录
        target_directory: 目标归档目录
        receipts: 回单信息列表
        erp_payments: ERP 付款记录列表
        invoices: 发票清单列表
        suppliers: 供应商台账列表
        payment_verifications: 付款校验结果列表
        only_valid: 是否仅归档校验通过的文件

    Returns:
        归档结果字典
    """
    manager = ArchiveManager(
        source_directory=source_directory,
        target_directory=target_directory,
        receipts=receipts,
        erp_payments=erp_payments,
        invoices=invoices,
        suppliers=suppliers,
        payment_verifications=payment_verifications,
    )
    return manager.archive_all(only_valid=only_valid)
