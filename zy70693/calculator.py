from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional
from parser import DataRow, DataSourceType


@dataclass
class DeductionDetail:
    equipment_id: str
    equipment_name: str
    item_type: str
    unit_price: float
    quantity: int = 1

    @property
    def total(self) -> float:
        return self.unit_price * self.quantity


@dataclass
class PointsCalculation:
    rental_id: str
    member_id: str
    member_name: str
    base_points: int
    deduction_amount: float
    points_compensation: int
    deduction_details: List[DeductionDetail] = field(default_factory=list)
    final_points: int = 0


class DepositPointsCalculator:
    def __init__(self):
        self.members: Dict[str, DataRow] = {}
        self.rentals: Dict[str, DataRow] = {}
        self.equipments: Dict[str, DataRow] = {}
        self.return_checks: Dict[str, List[DataRow]] = {}
        self.deposits: Dict[str, DataRow] = {}
        self.points_per_yuan: float = 10.0
        self.level_multipliers: Dict[str, float] = {
            '普通': 1.0,
            '银卡': 1.2,
            '金卡': 1.5,
            '钻石': 2.0
        }

    def load_data(self, rows: List[DataRow]) -> None:
        for row in rows:
            if not row.is_valid:
                continue
            data = row.parsed_data
            if row.source_type == DataSourceType.MEMBER:
                self.members[data['member_id']] = row
            elif row.source_type == DataSourceType.RENTAL:
                self.rentals[data['rental_id']] = row
            elif row.source_type == DataSourceType.EQUIPMENT:
                self.equipments[data['equipment_id']] = row
            elif row.source_type == DataSourceType.RETURN_CHECK:
                rental_id = data['rental_id']
                if rental_id not in self.return_checks:
                    self.return_checks[rental_id] = []
                self.return_checks[rental_id].append(row)
            elif row.source_type == DataSourceType.DEPOSIT:
                self.deposits[data['rental_id']] = row

    def calculate_all(self) -> List[PointsCalculation]:
        results = []
        for rental_id in sorted(self.rentals.keys()):
            calc = self.calculate_rental(rental_id)
            if calc:
                results.append(calc)
        return sorted(results, key=lambda x: x.rental_id)

    def calculate_rental(self, rental_id: str) -> Optional[PointsCalculation]:
        if rental_id not in self.rentals:
            return None

        rental_row = self.rentals[rental_id]
        rental_data = rental_row.parsed_data
        member_id = rental_data['member_id']

        member_name = ''
        member_level = '普通'
        base_points = 0
        if member_id in self.members:
            member_data = self.members[member_id].parsed_data
            member_name = member_data['member_name']
            member_level = member_data['member_level']
            base_points = member_data['current_points']

        calc = PointsCalculation(
            rental_id=rental_id,
            member_id=member_id,
            member_name=member_name,
            base_points=base_points,
            deduction_amount=0.0,
            points_compensation=0
        )

        if rental_id in self.return_checks:
            for check_row in sorted(self.return_checks[rental_id], 
                                  key=lambda r: r.parsed_data['equipment_id']):
                check_data = check_row.parsed_data
                eq_id = check_data['equipment_id']
                if eq_id not in self.equipments:
                    continue

                eq_data = self.equipments[eq_id].parsed_data

                if eq_data['hook_included'] and not check_data['hook_returned']:
                    calc.deduction_details.append(DeductionDetail(
                        equipment_id=eq_id,
                        equipment_name=eq_data['equipment_name'],
                        item_type='鱼钩',
                        unit_price=eq_data['hook_price']
                    ))
                    calc.deduction_amount += eq_data['hook_price']

                if eq_data['line_included'] and not check_data['line_returned']:
                    calc.deduction_details.append(DeductionDetail(
                        equipment_id=eq_id,
                        equipment_name=eq_data['equipment_name'],
                        item_type='鱼线',
                        unit_price=eq_data['line_price']
                    ))
                    calc.deduction_amount += eq_data['line_price']

                if eq_data['net_included'] and not check_data['net_returned']:
                    calc.deduction_details.append(DeductionDetail(
                        equipment_id=eq_id,
                        equipment_name=eq_data['equipment_name'],
                        item_type='鱼护',
                        unit_price=eq_data['net_price']
                    ))
                    calc.deduction_amount += eq_data['net_price']

        multiplier = self.level_multipliers.get(member_level, 1.0)
        calc.points_compensation = int(round(calc.deduction_amount * self.points_per_yuan * multiplier))
        calc.final_points = base_points + calc.points_compensation

        return calc

    def get_calculation_summary(self) -> Dict[str, Any]:
        calculations = self.calculate_all()
        total_deduction = sum(c.deduction_amount for c in calculations)
        total_points_compensation = sum(c.points_compensation for c in calculations)
        rentals_with_deduction = sum(1 for c in calculations if c.deduction_amount > 0)

        return {
            'total_rentals': len(calculations),
            'rentals_with_deduction': rentals_with_deduction,
            'total_deduction_amount': round(total_deduction, 2),
            'total_points_compensation': total_points_compensation,
            'average_points_per_rental': round(total_points_compensation / max(len(calculations), 1), 2)
        }

    def get_calculations_by_member(self, member_id: str) -> List[PointsCalculation]:
        calculations = self.calculate_all()
        return [c for c in calculations if c.member_id == member_id]
