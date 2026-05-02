"""数据模型定义"""

from dataclasses import dataclass, field
from datetime import date, datetime
from decimal import Decimal
from enum import Enum, auto
from typing import Dict, List, Optional, Any


class VerificationStatus(Enum):
    """校验状态枚举"""

    PASSED = auto()
    FAILED = auto()
    WARNING = auto()
    PENDING = auto()


class FileType(Enum):
    """文件类型枚举"""

    PDF_RECEIPT = "pdf_receipt"
    CSV_ERP = "csv_erp"
    JSON_INVOICE = "json_invoice"
    CSV_LEDGER = "csv_ledger"
    UNKNOWN = "unknown"


@dataclass
class ScannedFile:
    """扫描到的文件信息"""

    file_path: str
    file_name: str
    file_size: int
    file_hash: str
    modified_time: datetime
    file_type: FileType = FileType.UNKNOWN


@dataclass
class ReceiptInfo:
    """网银回单信息"""

    file_path: str
    file_hash: str
    payer_name: str = ""
    payer_account: str = ""
    payee_name: str = ""
    payee_account: str = ""
    amount: Decimal = Decimal("0")
    payment_date: Optional[date] = None
    payment_time: Optional[datetime] = None
    transaction_id: str = ""
    remark: str = ""
    bank_name: str = ""
    raw_text: str = ""


@dataclass
class ERPPayment:
    """ERP 付款记录"""

    payment_id: str = ""
    payee_name: str = ""
    payee_account: str = ""
    amount: Decimal = Decimal("0")
    payment_date: Optional[date] = None
    invoice_number: str = ""
    supplier_code: str = ""
    department: str = ""
    remark: str = ""
    source_file: str = ""


@dataclass
class InvoiceItem:
    """发票清单项"""

    invoice_number: str = ""
    invoice_date: Optional[date] = None
    amount: Decimal = Decimal("0")
    tax_amount: Decimal = Decimal("0")
    total_amount: Decimal = Decimal("0")
    supplier_name: str = ""
    supplier_tax_id: str = ""
    goods_name: str = ""
    payment_id: str = ""
    source_file: str = ""


@dataclass
class SupplierLedger:
    """供应商台账"""

    supplier_code: str = ""
    supplier_name: str = ""
    bank_account: str = ""
    bank_name: str = ""
    tax_id: str = ""
    contact_person: str = ""
    contact_phone: str = ""
    address: str = ""
    source_file: str = ""


@dataclass
class VerificationRule:
    """校验规则配置"""

    name: str
    enabled: bool = True
    severity: str = "error"
    params: Dict[str, Any] = field(default_factory=dict)


@dataclass
class VerificationResult:
    """单次校验结果"""

    rule_name: str
    status: VerificationStatus
    message: str
    details: Dict[str, Any] = field(default_factory=dict)


@dataclass
class PaymentVerification:
    """付款记录校验结果"""

    payment_id: str
    receipt_info: Optional[ReceiptInfo] = None
    erp_payment: Optional[ERPPayment] = None
    invoice: Optional[InvoiceItem] = None
    supplier: Optional[SupplierLedger] = None
    verification_results: List[VerificationResult] = field(default_factory=list)
    overall_status: VerificationStatus = VerificationStatus.PENDING


@dataclass
class ArchiveManifest:
    """归档清单"""

    archive_id: str
    archive_date: datetime
    source_directory: str
    target_directory: str
    total_files: int = 0
    valid_files: int = 0
    invalid_files: int = 0
    files: List[Dict[str, Any]] = field(default_factory=list)
    verification_summary: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ReportData:
    """报告数据"""

    report_id: str
    generated_at: datetime
    period_start: Optional[date] = None
    period_end: Optional[date] = None
    total_payments: int = 0
    verified_payments: int = 0
    passed_payments: int = 0
    failed_payments: int = 0
    warning_payments: int = 0
    duplicate_receipts: List[Dict[str, Any]] = field(default_factory=list)
    missing_documents: List[Dict[str, Any]] = field(default_factory=list)
    amount_mismatches: List[Dict[str, Any]] = field(default_factory=list)
    verification_details: List[PaymentVerification] = field(default_factory=list)
