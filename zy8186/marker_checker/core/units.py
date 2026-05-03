class UnitConverter:
    UNIT_FACTORS = {
        'mm': 1.0,
        'cm': 10.0,
        'm': 1000.0,
        'inch': 25.4,
        'in': 25.4,
        'yard': 914.4,
        'yd': 914.4,
    }
    
    @classmethod
    def convert(cls, value, from_unit, to_unit):
        if from_unit not in cls.UNIT_FACTORS:
            raise ValueError(f"Unknown unit: {from_unit}")
        if to_unit not in cls.UNIT_FACTORS:
            raise ValueError(f"Unknown unit: {to_unit}")
        
        value_mm = value * cls.UNIT_FACTORS[from_unit]
        return value_mm / cls.UNIT_FACTORS[to_unit]
    
    @classmethod
    def to_mm(cls, value, unit):
        return cls.convert(value, unit, 'mm')
    
    @classmethod
    def from_mm(cls, value_mm, unit):
        return cls.convert(value_mm, 'mm', unit)
    
    @classmethod
    def get_all_units(cls):
        return list(cls.UNIT_FACTORS.keys())
