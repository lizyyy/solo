from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional, List, Dict, Any
from enum import Enum


class DiffType(str, Enum):
    NONE = "无差异"
    AMOUNT_MISMATCH = "金额不匹配"
    DUPLICATE_CLAIM = "重复认领"
    MISSING_RECORD = "记录缺失"
    NULL_VALUE = "空值异常"
    BOUNDARY_CASE = "边界记录"
    LATE_ATTACHMENT = "晚到附件更新"
    MANUAL_REMARK = "人工补录备注"


class RecordSource(str, Enum):
    BANK_RECEIPT = "银行回单"
    BUSINESS_LEDGER = "业务台账"
    MONTHLY_STATEMENT = "月底对账表"
    SCREENSHOT = "群截图"
    SUPPLEMENT_NOTE = "补录说明"


@dataclass
class HistoryEntry:
    timestamp: datetime
    field_name: str
    old_value: Optional[str]
    new_value: Optional[str]
    operator: str = "系统"
    reason: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "时间": self.timestamp.strftime("%Y-%m-%d %H:%M:%S"),
            "字段": self.field_name,
            "原值": self.old_value,
            "新值": self.new_value,
            "操作人": self.operator,
            "原因": self.reason,
        }


@dataclass
class Attachment:
    id: str
    type: str
    path: str
    description: Optional[str] = None
    received_at: Optional[datetime] = None
    is_late: bool = False


@dataclass
class TransactionRecord:
    id: str
    store_id: str
    store_name: str
    trade_date: str
    amount: Optional[float]
    batch_no: Optional[str] = None
    source: RecordSource = RecordSource.MONTHLY_STATEMENT
    original_remark: Optional[str] = None
    current_remark: Optional[str] = None
    diff_type: DiffType = DiffType.NONE
    diff_reason: Optional[str] = None
    attachments: List[Attachment] = field(default_factory=list)
    history: List[HistoryEntry] = field(default_factory=list)
    matched_ids: List[str] = field(default_factory=list)
    duplicate_with: List[str] = field(default_factory=list)
    is_processed: bool = False
    raw_data: Dict[str, Any] = field(default_factory=dict)

    def add_history(self, field_name: str, old_value: Optional[str], 
                    new_value: Optional[str], operator: str = "系统",
                    reason: Optional[str] = None):
        if old_value != new_value:
            self.history.append(HistoryEntry(
                timestamp=datetime.now(),
                field_name=field_name,
                old_value=old_value,
                new_value=new_value,
                operator=operator,
                reason=reason
            ))

    def add_attachment(self, attachment: Attachment):
        self.attachments.append(attachment)

    def set_diff(self, diff_type: DiffType, reason: str):
        self.diff_type = diff_type
        self.diff_reason = reason
        self.is_processed = True

    def update_remark(self, new_remark: str, operator: str = "人工", 
                      reason: str = "补录备注"):
        old_remark = self.current_remark
        self.current_remark = new_remark
        self.add_history("备注", old_remark, new_remark, operator, reason)
        if self.diff_type == DiffType.NONE:
            self.diff_type = DiffType.MANUAL_REMARK
        if not self.diff_reason:
            self.diff_reason = reason
        self.is_processed = True

    def to_summary_dict(self) -> Dict[str, Any]:
        return {
            "记录ID": self.id,
            "门店编号": self.store_id,
            "门店名称": self.store_name,
            "交易日期": self.trade_date,
            "金额": self.amount,
            "批次号": self.batch_no,
            "数据来源": self.source.value,
            "差异类型": self.diff_type.value,
            "差异原因": self.diff_reason,
            "当前备注": self.current_remark,
            "附件数量": len(self.attachments),
            "历史变更次数": len(self.history),
        }

    def to_detail_dict(self) -> Dict[str, Any]:
        result = {
            "记录ID": self.id,
            "门店编号": self.store_id,
            "门店名称": self.store_name,
            "交易日期": self.trade_date,
            "金额": self.amount,
            "批次号": self.batch_no,
            "数据来源": self.source.value,
            "原始备注": self.original_remark,
            "当前备注": self.current_remark,
            "差异类型": self.diff_type.value,
            "差异原因": self.diff_reason,
            "是否已处理": "是" if self.is_processed else "否",
            "匹配记录ID": ",".join(self.matched_ids),
            "重复认领ID": ",".join(self.duplicate_with),
            "附件列表": "; ".join([f"[{a.type}]{a.path}" for a in self.attachments]),
            "晚到附件": "是" if any(a.is_late for a in self.attachments) else "否",
        }
        for i, h in enumerate(self.history, 1):
            h_dict = h.to_dict()
            result[f"历史变更{i}_时间"] = h_dict["时间"]
            result[f"历史变更{i}_字段"] = h_dict["字段"]
            result[f"历史变更{i}_原值"] = h_dict["原值"]
            result[f"历史变更{i}_新值"] = h_dict["新值"]
            result[f"历史变更{i}_操作人"] = h_dict["操作人"]
            result[f"历史变更{i}_原因"] = h_dict["原因"]
        return result
