"""
单位换算模块测试
"""

import pytest
from plate_planner.units import (
    parse_concentration, convert_volume, to_ul, from_ul,
    normalize_concentration_unit, _get_concentration_type,
    VolumeUnit, ConcentrationUnit
)


class TestConcentrationConversion:
    def test_same_unit_ng_ul(self):
        result = parse_concentration(100.0, "ng/ul", "ng/ul")
        assert result == 100.0

    def test_ng_ul_to_pg_ul(self):
        result = parse_concentration(1.0, "ng/ul", "pg/ul")
        assert result == 1000.0

    def test_pg_ul_to_ng_ul(self):
        result = parse_concentration(1000.0, "pg/ul", "ng/ul")
        assert result == 1.0

    def test_ug_ul_to_ng_ul(self):
        result = parse_concentration(1.0, "ug/ul", "ng/ul")
        assert result == 1000.0

    def test_mg_ml_to_ng_ul(self):
        result = parse_concentration(1.0, "mg/ml", "ng/ul")
        assert result == 1000.0

    def test_ng_ml_to_ng_ul(self):
        result = parse_concentration(1000.0, "ng/ml", "ng/ul")
        assert result == 1.0


class TestMolarConversion:
    def test_same_unit_um(self):
        result = parse_concentration(10.0, "uM", "uM")
        assert result == 10.0

    def test_um_to_nm(self):
        result = parse_concentration(1.0, "uM", "nM")
        assert result == 1000.0

    def test_nm_to_um(self):
        result = parse_concentration(1000.0, "nM", "uM")
        assert result == 1.0

    def test_mm_to_um(self):
        result = parse_concentration(1.0, "mM", "uM")
        assert result == 1000.0


class TestVolumeConversion:
    def test_ul_to_ml(self):
        result = convert_volume(1000.0, "ul", "ml")
        assert result == 1.0

    def test_ml_to_ul(self):
        result = convert_volume(1.0, "ml", "ul")
        assert result == 1000.0

    def test_to_ul(self):
        result = to_ul(1.0, "ml")
        assert result == 1000.0

    def test_from_ul(self):
        result = from_ul(1000.0, "ml")
        assert result == 1.0

    def test_ul_to_nl(self):
        result = convert_volume(1.0, "ul", "nl")
        assert result == 1000.0

    def test_l_to_ul(self):
        result = convert_volume(0.001, "l", "ul")
        assert result == 1000.0


class TestNormalizeUnit:
    def test_normalize_ng_ul(self):
        assert normalize_concentration_unit("ng/ul") == "ng/ul"

    def test_normalize_with_mu(self):
        assert normalize_concentration_unit("μg/μl") == "ug/ul"

    def test_normalize_um(self):
        assert normalize_concentration_unit("μM") == "uM"

    def test_normalize_nm(self):
        assert normalize_concentration_unit("nM") == "nM"

    def test_normalize_mm(self):
        assert normalize_concentration_unit("mM") == "mM"


class TestConcentrationType:
    def test_mass_per_volume_type(self):
        assert _get_concentration_type("ng/ul") == "mass_per_volume"
        assert _get_concentration_type("pg/ul") == "mass_per_volume"
        assert _get_concentration_type("mg/ml") == "mass_per_volume"

    def test_molar_type(self):
        assert _get_concentration_type("uM") == "molar"
        assert _get_concentration_type("nM") == "molar"
        assert _get_concentration_type("mM") == "molar"

    def test_unknown_type_raises(self):
        with pytest.raises(ValueError):
            _get_concentration_type("unknown")
