import pytest
from decimal import Decimal

from hydrocalc.models import (
    Material,
    ElementLimit,
    Inventory,
    STANDARD_ELEMENTS,
)


class TestMaterial:
    def test_create_valid_material(self):
        material = Material(
            name="硝酸钙",
            purity=Decimal("0.98"),
            element_composition={"N": Decimal("0.1186"), "Ca": Decimal("0.1697")},
            remaining_grams=Decimal("500"),
            price_per_gram=Decimal("0.015"),
        )
        assert material.name == "硝酸钙"
        assert material.purity == Decimal("0.98")
        assert material.remaining_grams == Decimal("500")

    def test_invalid_purity_zero(self):
        with pytest.raises(ValueError, match="纯度必须在"):
            Material(
                name="测试",
                purity=Decimal("0"),
                element_composition={},
                remaining_grams=Decimal("100"),
                price_per_gram=Decimal("0.01"),
            )

    def test_invalid_purity_over_one(self):
        with pytest.raises(ValueError, match="纯度必须在"):
            Material(
                name="测试",
                purity=Decimal("1.5"),
                element_composition={},
                remaining_grams=Decimal("100"),
                price_per_gram=Decimal("0.01"),
            )

    def test_negative_remaining(self):
        with pytest.raises(ValueError, match="剩余克数不能为负数"):
            Material(
                name="测试",
                purity=Decimal("0.99"),
                element_composition={},
                remaining_grams=Decimal("-10"),
                price_per_gram=Decimal("0.01"),
            )

    def test_get_element_content(self):
        material = Material(
            name="硝酸钙",
            purity=Decimal("0.98"),
            element_composition={"N": Decimal("0.1186"), "Ca": Decimal("0.1697")},
            remaining_grams=Decimal("500"),
            price_per_gram=Decimal("0.015"),
        )
        n_content = material.get_element_content("N")
        expected = Decimal("0.1186") * Decimal("0.98")
        assert abs(n_content - expected) < Decimal("0.0001")

    def test_get_nonexistent_element(self):
        material = Material(
            name="硝酸钙",
            purity=Decimal("0.98"),
            element_composition={"N": Decimal("0.1186")},
            remaining_grams=Decimal("500"),
            price_per_gram=Decimal("0.015"),
        )
        assert material.get_element_content("K") == Decimal("0")


class TestElementLimit:
    def test_valid_limit(self):
        limit = ElementLimit(
            element="N",
            min_ppm=Decimal("150"),
            max_ppm=Decimal("180"),
        )
        assert limit.element == "N"
        assert limit.min_ppm == Decimal("150")
        assert limit.max_ppm == Decimal("180")

    def test_min_greater_than_max(self):
        with pytest.raises(ValueError, match="下限.*不能大于上限"):
            ElementLimit(
                element="N",
                min_ppm=Decimal("200"),
                max_ppm=Decimal("100"),
            )

    def test_negative_min(self):
        with pytest.raises(ValueError, match="ppm下限不能为负数"):
            ElementLimit(
                element="N",
                min_ppm=Decimal("-10"),
                max_ppm=Decimal("100"),
            )


class TestInventory:
    def test_add_material(self):
        inv = Inventory()
        material = Material(
            name="硝酸钾",
            purity=Decimal("0.99"),
            element_composition={"N": Decimal("0.1385"), "K": Decimal("0.3867")},
            remaining_grams=Decimal("300"),
            price_per_gram=Decimal("0.02"),
        )
        inv.add_material(material)
        assert inv.get_material("硝酸钾") is material

    def test_add_duplicate_material(self):
        inv = Inventory()
        material = Material(
            name="硝酸钾",
            purity=Decimal("0.99"),
            element_composition={},
            remaining_grams=Decimal("300"),
            price_per_gram=Decimal("0.02"),
        )
        inv.add_material(material)

        with pytest.raises(ValueError, match="原料已存在"):
            inv.add_material(material)

    def test_deduct_material(self):
        inv = Inventory()
        material = Material(
            name="硝酸钾",
            purity=Decimal("0.99"),
            element_composition={},
            remaining_grams=Decimal("300"),
            price_per_gram=Decimal("0.02"),
        )
        inv.add_material(material)

        inv.deduct("硝酸钾", Decimal("100"))
        assert material.remaining_grams == Decimal("200")

    def test_deduct_insufficient(self):
        inv = Inventory()
        material = Material(
            name="硝酸钾",
            purity=Decimal("0.99"),
            element_composition={},
            remaining_grams=Decimal("100"),
            price_per_gram=Decimal("0.02"),
        )
        inv.add_material(material)

        with pytest.raises(ValueError, match="库存不足"):
            inv.deduct("硝酸钾", Decimal("200"))


class TestStandardElements:
    def test_contains_common_elements(self):
        assert "N" in STANDARD_ELEMENTS
        assert "P" in STANDARD_ELEMENTS
        assert "K" in STANDARD_ELEMENTS
        assert "Ca" in STANDARD_ELEMENTS
        assert "Mg" in STANDARD_ELEMENTS
        assert "S" in STANDARD_ELEMENTS
        assert "Fe" in STANDARD_ELEMENTS
        assert "Mn" in STANDARD_ELEMENTS
        assert "Zn" in STANDARD_ELEMENTS
        assert "Cu" in STANDARD_ELEMENTS
        assert "B" in STANDARD_ELEMENTS
        assert "Mo" in STANDARD_ELEMENTS
        assert "Cl" in STANDARD_ELEMENTS
