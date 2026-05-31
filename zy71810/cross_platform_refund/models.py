from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional, Dict, Any
from uuid import uuid4

from config import SUPPLEMENT_STATUS


@dataclass
class ReconciliationRecord:
    交易流水号: str
    交易时间: datetime
    交易金额: float
    支付平台: str
    商户订单号: Optional[str] = None
    用户账号: Optional[str] = None
    商品名称: Optional[str] = None
    备注: Optional[str] = None
    原始备注: Optional[str] = None
    来源文件: str = ""
    导入时间: datetime = field(default_factory=datetime.now)
    
    def to_dict(self) -> Dict[str, Any]:
        result = {
            "交易流水号": self.交易流水号,
            "交易时间": self.交易时间.strftime("%Y-%m-%d %H:%M:%S") if isinstance(self.交易时间, datetime) else self.交易时间,
            "交易金额": self.交易金额,
            "支付平台": self.支付平台,
            "商户订单号": self.商户订单号 or "",
            "用户账号": self.用户账号 or "",
            "商品名称": self.商品名称 or "",
            "备注": self.备注 or "",
            "原始备注": self.原始备注 or "",
            "来源文件": self.来源文件,
            "导入时间": self.导入时间.strftime("%Y-%m-%d %H:%M:%S")
        }
        return result


@dataclass
class RefundFlowRecord:
    退款流水号: str
    原交易流水号: str
    退款金额: float
    退款时间: datetime
    退款状态: str
    退款原因: Optional[str] = None
    操作人: Optional[str] = None
    备注: Optional[str] = None
    来源文件: str = ""
    导入时间: datetime = field(default_factory=datetime.now)
    
    def to_dict(self) -> Dict[str, Any]:
        result = {
            "退款流水号": self.退款流水号,
            "原交易流水号": self.原交易流水号,
            "退款金额": self.退款金额,
            "退款时间": self.退款时间.strftime("%Y-%m-%d %H:%M:%S") if isinstance(self.退款时间, datetime) else self.退款时间,
            "退款状态": self.退款状态,
            "退款原因": self.退款原因 or "",
            "操作人": self.操作人 or "",
            "备注": self.备注 or "",
            "来源文件": self.来源文件,
            "导入时间": self.导入时间.strftime("%Y-%m-%d %H:%M:%S")
        }
        return result


@dataclass
class SupplementRecord:
    补单编号: str
    原交易流水号: str
    退款流水号: Optional[str] = None
    补单金额: float = 0.0
    补单状态: str = SUPPLEMENT_STATUS["PENDING"]
    补单说明: Optional[str] = None
    处理口径: str = "系统自动匹配"
    是否人工修改: bool = False
    修改前内容: Optional[Dict[str, Any]] = None
    修改人: Optional[str] = None
    修改时间: Optional[datetime] = None
    创建时间: datetime = field(default_factory=datetime.now)
    确认时间: Optional[datetime] = None
    撤回时间: Optional[datetime] = None
    关联对账单信息: Optional[Dict[str, Any]] = None
    关联退款流水信息: Optional[Dict[str, Any]] = None
    
    def __post_init__(self):
        if not self.补单编号:
            self.补单编号 = f"BD{datetime.now().strftime('%Y%m%d')}{uuid4().hex[:6].upper()}"
    
    def confirm(self, operator: Optional[str] = None) -> None:
        if self.补单状态 == SUPPLEMENT_STATUS["REVOKED"]:
            from errors import InvalidStatusTransitionError
            raise InvalidStatusTransitionError(
                self.补单编号, self.补单状态, SUPPLEMENT_STATUS["CONFIRMED"]
            )
        self.补单状态 = SUPPLEMENT_STATUS["CONFIRMED"]
        self.确认时间 = datetime.now()
        if operator:
            self.修改人 = operator
    
    def mark_manual_modified(self, modified_fields: Dict[str, Any], operator: Optional[str] = None) -> None:
        if self.补单状态 == SUPPLEMENT_STATUS["REVOKED"]:
            from errors import InvalidStatusTransitionError
            raise InvalidStatusTransitionError(
                self.补单编号, self.补单状态, SUPPLEMENT_STATUS["MANUAL_MODIFIED"]
            )
        self.修改前内容 = self.modified_content_to_dict()
        for key, value in modified_fields.items():
            if hasattr(self, key):
                setattr(self, key, value)
        self.补单状态 = SUPPLEMENT_STATUS["MANUAL_MODIFIED"]
        self.是否人工修改 = True
        self.处理口径 = "人工修改确认"
        self.修改时间 = datetime.now()
        if operator:
            self.修改人 = operator
    
    def revoke(self, operator: Optional[str] = None) -> None:
        if self.补单状态 == SUPPLEMENT_STATUS["PENDING"]:
            from errors import InvalidStatusTransitionError
            raise InvalidStatusTransitionError(
                self.补单编号, self.补单状态, SUPPLEMENT_STATUS["REVOKED"]
            )
        self.补单状态 = SUPPLEMENT_STATUS["REVOKED"]
        self.撤回时间 = datetime.now()
        if operator:
            self.修改人 = operator
    
    def modified_content_to_dict(self) -> Dict[str, Any]:
        return {
            "补单金额": self.补单金额,
            "补单说明": self.补单说明,
            "处理口径": self.处理口径
        }
    
    def to_dict(self) -> Dict[str, Any]:
        result = {
            "补单编号": self.补单编号,
            "原交易流水号": self.原交易流水号,
            "退款流水号": self.退款流水号 or "",
            "补单金额": self.补单金额,
            "补单状态": self.补单状态,
            "补单说明": self.补单说明 or "",
            "处理口径": self.处理口径,
            "是否人工修改": "是" if self.是否人工修改 else "否",
            "修改人": self.修改人 or "",
            "修改时间": self.修改时间.strftime("%Y-%m-%d %H:%M:%S") if self.修改时间 else "",
            "创建时间": self.创建时间.strftime("%Y-%m-%d %H:%M:%S"),
            "确认时间": self.确认时间.strftime("%Y-%m-%d %H:%M:%S") if self.确认时间 else "",
            "撤回时间": self.撤回时间.strftime("%Y-%m-%d %H:%M:%S") if self.撤回时间 else ""
        }
        if self.关联对账单信息:
            result.update({f"对账单_{k}": v for k, v in self.关联对账单信息.items() if k in ["交易时间", "交易金额", "支付平台", "商户订单号"]})
        if self.关联退款流水信息:
            result.update({f"退款_{k}": v for k, v in self.关联退款流水信息.items() if k in ["退款时间", "退款状态", "退款原因"]})
        return result
