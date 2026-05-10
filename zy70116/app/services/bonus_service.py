from decimal import Decimal, ROUND_HALF_UP
from datetime import datetime
from typing import Optional, Tuple

from sqlalchemy.orm import Session

from ..models.account import BonusRule


class BonusService:
    @staticmethod
    def calculate_bonus(db: Session, deposit_amount: Decimal) -> Tuple[Decimal, Optional[int]]:
        today = datetime.now().strftime("%Y-%m-%d")
        
        rules = db.query(BonusRule).filter(
            BonusRule.is_active == True,
            BonusRule.min_deposit_amount <= deposit_amount,
            (BonusRule.start_date.is_(None) | (BonusRule.start_date <= today)),
            (BonusRule.end_date.is_(None) | (BonusRule.end_date >= today))
        ).order_by(BonusRule.min_deposit_amount.desc()).all()
        
        for rule in rules:
            if rule.max_deposit_amount and deposit_amount > rule.max_deposit_amount:
                continue
            
            if rule.is_percentage:
                bonus = deposit_amount * rule.bonus_rate
            else:
                bonus = rule.bonus_amount
            
            bonus = bonus.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            return bonus, rule.id
        
        return Decimal("0.00"), None
