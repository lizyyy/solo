import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from waste_analyzer.unit_converter import UnitConverter
from waste_analyzer.models import Unit


class TestUnitConverter:
    def test_kg_to_g_conversion(self):
        result = UnitConverter.convert(1, Unit.KG, Unit.G)
        assert result == 1000.0

    def test_g_to_kg_conversion(self):
        result = UnitConverter.convert(1000, Unit.G, Unit.KG)
        assert result == 1.0

    def test_jin_to_g_conversion(self):
        result = UnitConverter.convert(1, Unit.JIN, Unit.G)
        assert result == 500.0

    def test_piece_conversion(self):
        result = UnitConverter.convert(10, Unit.PIECE, Unit.PIECE)
        assert result == 10.0

    def test_compatible_units(self):
        assert UnitConverter.is_compatible(Unit.KG, Unit.G) is True
        assert UnitConverter.is_compatible(Unit.KG, Unit.JIN) is True
        assert UnitConverter.is_compatible(Unit.KG, Unit.PIECE) is False


class TestDataLoader:
    def test_clean_number(self):
        from waste_analyzer.data_loader import DataLoader
        loader = DataLoader()
        assert loader._clean_float("1,000") == 1000.0
        assert loader._clean_float(100) == 100.0


if __name__ == "__main__":
    test = TestUnitConverter()
    test.test_kg_to_g_conversion()
    test.test_g_to_kg_conversion()
    test.test_jin_to_g_conversion()
    test.test_piece_conversion()
    test.test_compatible_units()
    print("All unit converter tests passed!")
