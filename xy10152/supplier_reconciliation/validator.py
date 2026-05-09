from datetime import date, datetime
from typing import Dict, Any, List, Optional
from .models import Document, DocumentType


class DataValidator:
    REQUIRED_FIELDS = {
        DocumentType.INVOICE: ["doc_number", "supplier_id", "supplier_name", "amount", "doc_date"],
        DocumentType.GRN: ["doc_number", "supplier_id", "supplier_name", "amount", "doc_date"],
        DocumentType.PAYMENT: ["doc_number", "supplier_id", "supplier_name", "amount", "doc_date"],
    }
    
    DATE_FORMATS = ["%Y-%m-%d", "%Y/%m/%d", "%Y%m%d", "%d-%m-%Y", "%d/%m/%Y"]
    
    def __init__(self, strict: bool = False):
        self.strict = strict
    
    def parse_date(self, date_value: Any) -> Optional[date]:
        if date_value is None:
            return None
        
        if isinstance(date_value, float):
            import math
            if math.isnan(date_value):
                return None
        
        if isinstance(date_value, date):
            return date_value
        if isinstance(date_value, datetime):
            return date_value.date()
        
        date_str = str(date_value).strip()
        if date_str == "" or date_str.lower() == "nan":
            return None
        
        for fmt in self.DATE_FORMATS:
            try:
                return datetime.strptime(date_str, fmt).date()
            except ValueError:
                continue
        
        if self.strict:
            return None
        
        from dateutil import parser
        try:
            return parser.parse(date_str, fuzzy=True).date()
        except (ValueError, TypeError):
            return None
    
    def parse_amount(self, amount_value: Any) -> Optional[float]:
        if amount_value is None:
            return None
        
        if isinstance(amount_value, float):
            import math
            if math.isnan(amount_value):
                return None
            return amount_value
        
        if isinstance(amount_value, int):
            return float(amount_value)
        
        amount_str = str(amount_value).strip()
        if amount_str == "" or amount_str.lower() == "nan":
            return None
        
        amount_str = amount_str.replace(",", "").replace("￥", "").replace("¥", "").replace("$", "")
        amount_str = amount_str.strip()
        
        try:
            return float(amount_str)
        except ValueError:
            return None
    
    def validate_row(self, row: Dict[str, Any], doc_type: DocumentType) -> tuple[bool, List[str], Dict[str, Any]]:
        errors = []
        cleaned_data = {}
        
        required_fields = self.REQUIRED_FIELDS.get(doc_type, [])
        for field in required_fields:
            if field not in row or row.get(field) is None or str(row.get(field, "")).strip() == "":
                errors.append(f"缺少必填字段: {field}")
        
        for key, value in row.items():
            if value is None:
                cleaned_data[key] = ""
            else:
                cleaned_data[key] = str(value).strip() if isinstance(value, str) else value
        
        doc_date = self.parse_date(row.get("doc_date"))
        if doc_date is None:
            errors.append(f"无法解析日期: {row.get('doc_date')}")
        cleaned_data["doc_date_parsed"] = doc_date
        
        due_date = self.parse_date(row.get("due_date")) if row.get("due_date") else None
        cleaned_data["due_date_parsed"] = due_date
        
        amount = self.parse_amount(row.get("amount"))
        if amount is None:
            errors.append(f"无法解析金额: {row.get('amount')}")
        elif amount < 0:
            errors.append(f"金额不能为负数: {amount}")
        cleaned_data["amount_parsed"] = amount
        
        if due_date and doc_date and due_date < doc_date:
            errors.append(f"到期日期 ({due_date}) 早于凭证日期 ({doc_date})")
        
        is_valid = len(errors) == 0
        return is_valid, errors, cleaned_data
    
    def create_document(self, row: Dict[str, Any], doc_type: DocumentType) -> Document:
        is_valid, errors, cleaned_data = self.validate_row(row, doc_type)
        
        doc = Document(
            doc_type=doc_type,
            doc_number=str(row.get("doc_number", "")).strip(),
            supplier_id=str(row.get("supplier_id", "")).strip(),
            supplier_name=str(row.get("supplier_name", "")).strip(),
            amount=cleaned_data.get("amount_parsed") or 0.0,
            doc_date=cleaned_data.get("doc_date_parsed") or date.today(),
            due_date=cleaned_data.get("due_date_parsed"),
            description=str(row.get("description", "")).strip(),
            reference=str(row.get("reference", "")).strip(),
            metadata={k: v for k, v in row.items() if k not in [
                "doc_number", "supplier_id", "supplier_name", "amount", 
                "doc_date", "due_date", "description", "reference"
            ]}
        )
        
        doc.validation_errors = errors
        doc.is_valid = is_valid
        
        return doc
