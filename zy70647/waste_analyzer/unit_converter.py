from typing import Dict
from .models import Unit


class UnitConverter:
    BASE_UNIT = Unit.G

    CONVERSION_FACTORS: Dict[Unit, float] = {
        Unit.G: 1.0,
        Unit.KG: 1000.0,
        Unit.JIN: 500.0,
        Unit.PIECE: 1.0,
        Unit.BAG: 1.0,
        Unit.BOX: 1.0,
    }

    WEIGHT_UNITS = {Unit.G, Unit.KG, Unit.JIN}
    COUNT_UNITS = {Unit.PIECE, Unit.BAG, Unit.BOX}

    @classmethod
    def convert(cls, quantity: float, from_unit: Unit, to_unit: Unit) -> float:
        if from_unit == to_unit:
            return quantity

        if from_unit in cls.WEIGHT_UNITS and to_unit in cls.WEIGHT_UNITS:
            base_quantity = quantity * cls.CONVERSION_FACTORS[from_unit]
            return base_quantity / cls.CONVERSION_FACTORS[to_unit]

        if from_unit in cls.COUNT_UNITS and to_unit in cls.COUNT_UNITS:
            return quantity

        raise ValueError(
            f"无法在不同类型单位间转换: {from_unit.value} -> {to_unit.value}"
        )

    @classmethod
    def to_base_unit(cls, quantity: float, unit: Unit) -> float:
        return cls.convert(quantity, unit, cls.BASE_UNIT)

    @classmethod
    def from_base_unit(cls, base_quantity: float, target_unit: Unit) -> float:
        return cls.convert(base_quantity, cls.BASE_UNIT, target_unit)

    @classmethod
    def is_compatible(cls, unit1: Unit, unit2: Unit) -> bool:
        if unit1 == unit2:
            return True
        if unit1 in cls.WEIGHT_UNITS and unit2 in cls.WEIGHT_UNITS:
            return True
        if unit1 in cls.COUNT_UNITS and unit2 in cls.COUNT_UNITS:
            return True
        return False
