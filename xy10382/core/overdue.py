from datetime import datetime, date
from typing import Dict, List, Optional
from dataclasses import dataclass, field

from models import Sale


@dataclass
class OverdueInfo:
    sale_id: str
    sale_date: str
    due_date: str
    total_amount: float
    days_overdue: int
    overdue_seasons: List[str]
    cross_season: bool
    overdue_amount: float


def _get_season(dt: date) -> str:
    month = dt.month
    if 1 <= month <= 3:
        return '春季'
    elif 4 <= month <= 6:
        return '夏季'
    elif 7 <= month <= 9:
        return '秋季'
    else:
        return '冬季'


def _get_season_by_date(date_str: str) -> str:
    dt = datetime.strptime(date_str, '%Y-%m-%d').date()
    return _get_season(dt)


class OverdueCalculator:
    def __init__(self, reference_date: Optional[date] = None):
        self.reference_date = reference_date or date.today()

    def calculate_overdue(self, sale: Sale, paid_amount: float) -> Optional[OverdueInfo]:
        if not sale.due_date:
            return None

        due_date = datetime.strptime(sale.due_date, '%Y-%m-%d').date()
        sale_date = datetime.strptime(sale.sale_date, '%Y-%m-%d').date()
        remaining = max(0.0, sale.total_amount - paid_amount)

        if remaining <= 0:
            return None

        if self.reference_date <= due_date:
            return None

        days_overdue = (self.reference_date - due_date).days

        due_season = _get_season(due_date)
        current_season = _get_season(self.reference_date)
        seasons = []

        year = due_date.year
        month = due_date.month
        current_dt = date(year, month, 1)

        while current_dt <= self.reference_date:
            season = _get_season(current_dt)
            if season not in seasons:
                seasons.append(season)
            if current_dt.month == 12:
                current_dt = date(current_dt.year + 1, 1, 1)
            else:
                current_dt = date(current_dt.year, current_dt.month + 1, 1)

        cross_season = len(seasons) > 1

        return OverdueInfo(
            sale_id=sale.id,
            sale_date=sale.sale_date,
            due_date=sale.due_date,
            total_amount=sale.total_amount,
            days_overdue=days_overdue,
            overdue_seasons=seasons,
            cross_season=cross_season,
            overdue_amount=remaining
        )
