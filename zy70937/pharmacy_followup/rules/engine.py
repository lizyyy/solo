from typing import List, Dict, Any, Tuple, Optional
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
import pandas as pd
from models import FollowupRule, Customer, PurchaseRecord


class RuleEngine:
    def __init__(self, db: Session):
        self.db = db
        self.active_rules = self._load_active_rules()

    def _load_active_rules(self) -> List[FollowupRule]:
        return self.db.query(FollowupRule).filter(FollowupRule.is_active == True).all()

    def validate_purchase_record(
        self, record: Dict[str, Any], customer: Optional[Customer] = None
    ) -> Tuple[str, List[str], str]:
        errors = []
        warnings = []
        matched_rules = []

        customer_id = record.get("customer_id")
        if not customer_id or (isinstance(customer_id, float) and pd.isna(customer_id)):
            errors.append("缺少顾客ID")

        drug_name = record.get("drug_name")
        if not drug_name or (isinstance(drug_name, float) and pd.isna(drug_name)):
            errors.append("缺少药品名称")

        purchase_date = record.get("purchase_date")
        if not purchase_date or (isinstance(purchase_date, float) and pd.isna(purchase_date)):
            errors.append("缺少购药日期")
        else:
            try:
                purchase_date = pd.to_datetime(record["purchase_date"]).date()
                if purchase_date > datetime.now().date():
                    warnings.append("购药日期晚于当前日期")
            except Exception:
                errors.append("购药日期格式不正确")

        if customer and customer.disease_type:
            for rule in self.active_rules:
                if rule.rule_type == "interval" and rule.disease_type == customer.disease_type:
                    drug_name = str(record.get("drug_name", "") or "")
                    if rule.drug_name and rule.drug_name in drug_name:
                        matched_rules.append(rule.rule_id)

                if rule.rule_type == "forbidden" and rule.disease_type == customer.disease_type:
                    forbidden = rule.forbidden_drugs or []
                    drug_name = str(record.get("drug_name", "") or "")
                    for forbidden_drug in forbidden:
                        if forbidden_drug and forbidden_drug in drug_name:
                            errors.append(f"禁忌药警告: {customer.disease_type}患者禁用{forbidden_drug}")
                            matched_rules.append(rule.rule_id)

        if errors:
            return "failed", matched_rules, "; ".join(errors)
        if warnings:
            return "pending", matched_rules, "; ".join(warnings)
        return "normal", matched_rules, ""

    def validate_customer_record(self, record: Dict[str, Any]) -> Tuple[str, List[str], str]:
        errors = []
        warnings = []
        matched_rules = []

        if not record.get("name"):
            errors.append("缺少顾客姓名")

        if not record.get("customer_id"):
            warnings.append("缺少顾客ID，将自动生成")

        phone = record.get("phone", "")
        if phone:
            import re
            clean_phone = re.sub(r"\D", "", phone)
            if len(clean_phone) != 11:
                warnings.append("手机号格式可能不正确")

        id_card = record.get("id_card", "")
        if id_card and len(id_card) not in [15, 18]:
            warnings.append("身份证号格式可能不正确")

        if errors:
            return "failed", matched_rules, "; ".join(errors)
        if warnings:
            return "pending", matched_rules, "; ".join(warnings)
        return "normal", matched_rules, ""

    def generate_followup_reminders(
        self, customer: Customer, purchase_records: List[PurchaseRecord]
    ) -> List[Dict[str, Any]]:
        reminders = []
        if not purchase_records:
            return reminders

        latest_records = {}
        for pr in purchase_records:
            drug_key = pr.drug_name
            if drug_key not in latest_records or pr.purchase_date > latest_records[drug_key].purchase_date:
                latest_records[drug_key] = pr

        for drug_name, latest_record in latest_records.items():
            for rule in self.active_rules:
                if rule.rule_type != "interval":
                    continue
                if rule.disease_type and rule.disease_type != customer.disease_type:
                    continue
                if rule.drug_name and rule.drug_name not in drug_name:
                    continue

                interval_days = rule.interval_days or 30
                purchase_date = latest_record.purchase_date
                if hasattr(purchase_date, 'date'):
                    purchase_date = purchase_date.date()
                next_followup = purchase_date + timedelta(days=interval_days)
                today = datetime.now().date()

                if next_followup <= today:
                    reminder_type = "overdue"
                    content = f"【{customer.name}】您好，您上次购买{drug_name}已超过{interval_days}天，请来店复诊或电话咨询。"
                elif (next_followup - today).days <= 7:
                    reminder_type = "upcoming"
                    content = f"【{customer.name}】您好，您购买的{drug_name}即将到随访时间，请于{next_followup.strftime('%Y-%m-%d')}前来店复诊。"
                else:
                    continue

                reminders.append({
                    "customer_id": customer.customer_id,
                    "customer_name": customer.name,
                    "drug_name": drug_name,
                    "last_purchase_date": latest_record.purchase_date,
                    "next_followup_date": next_followup,
                    "reminder_type": reminder_type,
                    "content": content,
                    "rule_id": rule.rule_id,
                })

        return reminders

    def suggest_handling(self, error_message: str, record_type: str) -> str:
        suggestions = {
            "缺少顾客ID": "请补充顾客会员ID或创建新会员档案",
            "缺少药品名称": "请核对购药小票，补充药品名称",
            "缺少购药日期": "请补充购药日期",
            "购药日期格式不正确": "请使用YYYY-MM-DD格式填写日期",
            "购药日期晚于当前日期": "请检查购药日期是否填写错误",
            "缺少顾客姓名": "请补充顾客姓名",
            "手机号格式可能不正确": "请核对手机号是否为11位有效号码",
            "身份证号格式可能不正确": "请核对身份证号格式",
            "禁忌药警告": "请立即联系顾客和处方医生，确认用药安全，必要时进行用药干预",
        }

        matched_suggestions = []
        for key, suggestion in suggestions.items():
            if key in error_message:
                matched_suggestions.append(suggestion)

        if not matched_suggestions:
            matched_suggestions.append("请人工核对数据后重新导入，或联系系统管理员")

        return "；".join(matched_suggestions)
