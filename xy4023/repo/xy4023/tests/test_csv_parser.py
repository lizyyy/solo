import os
import tempfile
import pytest
from decimal import Decimal

from hydrocalc.csv_parser import CsvParser, REQUIRED_INVENTORY_FIELDS, REQUIRED_RECIPE_FIELDS
from hydrocalc.models import ValidationErrorType


class TestCsvParserInventory:
    def test_parse_valid_inventory(self):
        csv_content = """名称,纯度,元素组成,剩余克数,单价(元/克)
硝酸钙,0.98,"N:0.1186,Ca:0.1697",500,0.015
硝酸钾,0.99,"N:0.1385,K:0.3867",300,0.020
"""
        with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False) as f:
            f.write(csv_content)
            temp_path = f.name

        try:
            parser = CsvParser()
            inv, errors = parser.parse_inventory(temp_path)

            assert len(errors) == 0
            assert inv is not None
            assert len(inv.list_materials()) == 2

            calcium_nitrate = inv.get_material("硝酸钙")
            assert calcium_nitrate is not None
            assert calcium_nitrate.purity == Decimal("0.98")
            assert calcium_nitrate.remaining_grams == Decimal("500")
            assert "N" in calcium_nitrate.element_composition
            assert "Ca" in calcium_nitrate.element_composition
        finally:
            os.unlink(temp_path)

    def test_parse_inventory_missing_field(self):
        csv_content = """名称,纯度,剩余克数,单价(元/克)
硝酸钙,0.98,500,0.015
"""
        with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False) as f:
            f.write(csv_content)
            temp_path = f.name

        try:
            parser = CsvParser()
            inv, errors = parser.parse_inventory(temp_path)

            assert len(errors) == 1
            assert errors[0].error_type == ValidationErrorType.MISSING_FIELD
            assert inv is None
        finally:
            os.unlink(temp_path)

    def test_parse_inventory_duplicate_name(self):
        csv_content = """名称,纯度,元素组成,剩余克数,单价(元/克)
硝酸钙,0.98,"N:0.1186",500,0.015
硝酸钙,0.99,"N:0.1186",300,0.015
"""
        with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False) as f:
            f.write(csv_content)
            temp_path = f.name

        try:
            parser = CsvParser()
            inv, errors = parser.parse_inventory(temp_path)

            assert len(errors) == 1
            assert errors[0].error_type == ValidationErrorType.DUPLICATE_MATERIAL
        finally:
            os.unlink(temp_path)

    def test_parse_inventory_unknown_element(self):
        csv_content = """名称,纯度,元素组成,剩余克数,单价(元/克)
硝酸钙,0.98,"X:0.1186",500,0.015
"""
        with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False) as f:
            f.write(csv_content)
            temp_path = f.name

        try:
            parser = CsvParser()
            inv, errors = parser.parse_inventory(temp_path)

            assert len(errors) == 1
            assert errors[0].error_type == ValidationErrorType.UNKNOWN_ELEMENT
        finally:
            os.unlink(temp_path)

    def test_parse_inventory_invalid_purity(self):
        csv_content = """名称,纯度,元素组成,剩余克数,单价(元/克)
硝酸钙,1.5,"N:0.1186",500,0.015
"""
        with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False) as f:
            f.write(csv_content)
            temp_path = f.name

        try:
            parser = CsvParser()
            inv, errors = parser.parse_inventory(temp_path)

            assert len(errors) == 1
            assert errors[0].error_type == ValidationErrorType.INVALID_PURITY
        finally:
            os.unlink(temp_path)

    def test_parse_inventory_negative_remaining(self):
        csv_content = """名称,纯度,元素组成,剩余克数,单价(元/克)
硝酸钙,0.98,"N:0.1186",-50,0.015
"""
        with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False) as f:
            f.write(csv_content)
            temp_path = f.name

        try:
            parser = CsvParser()
            inv, errors = parser.parse_inventory(temp_path)

            assert len(errors) == 1
            assert errors[0].error_type == ValidationErrorType.NEGATIVE_VALUE
        finally:
            os.unlink(temp_path)


class TestCsvParserRecipe:
    def test_parse_valid_recipe(self):
        csv_content = """目标体积(L),元素,ppm下限,ppm上限,禁用原料,备注
10,N,150,180,"",叶菜
10,P,40,60,"",
"""
        with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False) as f:
            f.write(csv_content)
            temp_path = f.name

        try:
            parser = CsvParser()
            rec, errors = parser.parse_recipe(temp_path)

            assert len(errors) == 0
            assert rec is not None
            assert rec.target_volume_liters == Decimal("10")
            assert len(rec.element_limits) == 2
            assert "N" in rec.element_limits
            assert "P" in rec.element_limits

            n_limit = rec.element_limits["N"]
            assert n_limit.min_ppm == Decimal("150")
            assert n_limit.max_ppm == Decimal("180")
        finally:
            os.unlink(temp_path)

    def test_parse_recipe_missing_field(self):
        csv_content = """目标体积(L),元素,ppm下限,禁用原料,备注
10,N,150,"",叶菜
"""
        with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False) as f:
            f.write(csv_content)
            temp_path = f.name

        try:
            parser = CsvParser()
            rec, errors = parser.parse_recipe(temp_path)

            assert len(errors) == 1
            assert errors[0].error_type == ValidationErrorType.MISSING_FIELD
            assert rec is None
        finally:
            os.unlink(temp_path)

    def test_parse_recipe_conflicting_limits(self):
        csv_content = """目标体积(L),元素,ppm下限,ppm上限,禁用原料,备注
10,N,200,100,"",叶菜
"""
        with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False) as f:
            f.write(csv_content)
            temp_path = f.name

        try:
            parser = CsvParser()
            rec, errors = parser.parse_recipe(temp_path)

            assert len(errors) == 1
            assert errors[0].error_type == ValidationErrorType.CONFLICTING_LIMITS
        finally:
            os.unlink(temp_path)

    def test_parse_recipe_unknown_element(self):
        csv_content = """目标体积(L),元素,ppm下限,ppm上限,禁用原料,备注
10,X,150,180,"",叶菜
"""
        with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False) as f:
            f.write(csv_content)
            temp_path = f.name

        try:
            parser = CsvParser()
            rec, errors = parser.parse_recipe(temp_path)

            assert len(errors) == 1
            assert errors[0].error_type == ValidationErrorType.UNKNOWN_ELEMENT
        finally:
            os.unlink(temp_path)

    def test_parse_recipe_inconsistent_volume(self):
        csv_content = """目标体积(L),元素,ppm下限,ppm上限,禁用原料,备注
10,N,150,180,"",
20,P,40,60,"",
"""
        with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False) as f:
            f.write(csv_content)
            temp_path = f.name

        try:
            parser = CsvParser()
            rec, errors = parser.parse_recipe(temp_path)

            assert len(errors) == 1
            assert errors[0].error_type == ValidationErrorType.CONFLICTING_LIMITS
        finally:
            os.unlink(temp_path)
