import csv
from decimal import Decimal, InvalidOperation
from typing import Dict, List, Optional, Tuple

from .models import (
    Inventory,
    Material,
    RecipeTarget,
    ElementLimit,
    ValidationError,
    ValidationErrorType,
    STANDARD_ELEMENTS,
)


REQUIRED_INVENTORY_FIELDS = ["名称", "纯度", "元素组成", "剩余克数", "单价(元/克)"]
REQUIRED_RECIPE_FIELDS = ["目标体积(L)", "元素", "ppm下限", "ppm上限", "禁用原料", "备注"]


class CsvParser:
    def __init__(self):
        self.errors: List[ValidationError] = []

    def parse_inventory(self, file_path: str) -> Tuple[Optional[Inventory], List[ValidationError]]:
        self.errors = []
        inventory = Inventory()
        seen_names: Dict[str, int] = {}

        try:
            with open(file_path, "r", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                fieldnames = reader.fieldnames or []

                for field in REQUIRED_INVENTORY_FIELDS:
                    if field not in fieldnames:
                        self.errors.append(ValidationError(
                            error_type=ValidationErrorType.MISSING_FIELD,
                            message=f"缺少必要字段: {field}",
                            field=field,
                        ))

                if self.errors:
                    return None, self.errors

                for row_num, row in enumerate(reader, start=2):
                    name = row.get("名称", "").strip()

                    if name in seen_names:
                        self.errors.append(ValidationError(
                            error_type=ValidationErrorType.DUPLICATE_MATERIAL,
                            message=f"原料名称重复: {name} (首次出现在第{seen_names[name]}行)",
                            field="名称",
                            row_number=row_num,
                        ))
                        continue

                    if not name:
                        self.errors.append(ValidationError(
                            error_type=ValidationErrorType.MISSING_FIELD,
                            message="原料名称不能为空",
                            field="名称",
                            row_number=row_num,
                        ))
                        continue

                    seen_names[name] = row_num

                    try:
                        purity_str = row.get("纯度", "").strip()
                        if not purity_str:
                            self.errors.append(ValidationError(
                                error_type=ValidationErrorType.MISSING_FIELD,
                                message="纯度不能为空",
                                field="纯度",
                                row_number=row_num,
                            ))
                            continue

                        purity = Decimal(purity_str)
                        if purity_str.endswith("%") or "%" in purity_str:
                            purity = Decimal(purity_str.replace("%", "")) / Decimal("100")

                        if purity <= 0 or purity > 1:
                            self.errors.append(ValidationError(
                                error_type=ValidationErrorType.INVALID_PURITY,
                                message=f"纯度必须在(0, 1]范围内: {purity_str}",
                                field="纯度",
                                row_number=row_num,
                            ))
                            continue
                    except InvalidOperation:
                        self.errors.append(ValidationError(
                            error_type=ValidationErrorType.INVALID_UNIT,
                            message=f"纯度格式无效: {purity_str}",
                            field="纯度",
                            row_number=row_num,
                        ))
                        continue

                    element_composition: Dict[str, Decimal] = {}
                    elements_str = row.get("元素组成", "").strip()
                    if elements_str:
                        for part in elements_str.split(","):
                            part = part.strip()
                            if ":" not in part:
                                self.errors.append(ValidationError(
                                    error_type=ValidationErrorType.INVALID_UNIT,
                                    message=f"元素组成格式错误，应为'元素:比例'格式: {part}",
                                    field="元素组成",
                                    row_number=row_num,
                                ))
                                continue

                            elem, ratio_str = part.split(":", 1)
                            elem = elem.strip().upper()
                            ratio_str = ratio_str.strip()

                            if elem not in STANDARD_ELEMENTS:
                                similar = self._find_similar_element(elem)
                                msg = f"未知元素: {elem}"
                                if similar:
                                    msg += f" (可能是指 {similar}?)"
                                self.errors.append(ValidationError(
                                    error_type=ValidationErrorType.UNKNOWN_ELEMENT,
                                    message=msg,
                                    field="元素组成",
                                    row_number=row_num,
                                ))
                                continue

                            try:
                                ratio = Decimal(ratio_str)
                                if ratio_str.endswith("%") or "%" in ratio_str:
                                    ratio = Decimal(ratio_str.replace("%", "")) / Decimal("100")
                                if ratio < 0 or ratio > 1:
                                    self.errors.append(ValidationError(
                                        error_type=ValidationErrorType.INVALID_UNIT,
                                        message=f"元素比例必须在[0, 1]范围内: {ratio_str}",
                                        field="元素组成",
                                        row_number=row_num,
                                    ))
                                    continue
                                element_composition[elem] = ratio
                            except InvalidOperation:
                                self.errors.append(ValidationError(
                                    error_type=ValidationErrorType.INVALID_UNIT,
                                    message=f"元素比例格式无效: {ratio_str}",
                                    field="元素组成",
                                    row_number=row_num,
                                ))
                                continue

                    try:
                        remaining_str = row.get("剩余克数", "").strip()
                        if not remaining_str:
                            self.errors.append(ValidationError(
                                error_type=ValidationErrorType.MISSING_FIELD,
                                message="剩余克数不能为空",
                                field="剩余克数",
                                row_number=row_num,
                            ))
                            continue
                        remaining = Decimal(remaining_str)
                        if remaining < 0:
                            self.errors.append(ValidationError(
                                error_type=ValidationErrorType.NEGATIVE_VALUE,
                                message=f"剩余克数不能为负数: {remaining_str}",
                                field="剩余克数",
                                row_number=row_num,
                            ))
                            continue
                    except InvalidOperation:
                        self.errors.append(ValidationError(
                            error_type=ValidationErrorType.INVALID_UNIT,
                            message=f"剩余克数格式无效: {remaining_str}",
                            field="剩余克数",
                            row_number=row_num,
                        ))
                        continue

                    try:
                        price_str = row.get("单价(元/克)", "").strip()
                        if not price_str:
                            self.errors.append(ValidationError(
                                error_type=ValidationErrorType.MISSING_FIELD,
                                message="单价不能为空",
                                field="单价(元/克)",
                                row_number=row_num,
                            ))
                            continue
                        price = Decimal(price_str)
                        if price < 0:
                            self.errors.append(ValidationError(
                                error_type=ValidationErrorType.NEGATIVE_VALUE,
                                message=f"单价不能为负数: {price_str}",
                                field="单价(元/克)",
                                row_number=row_num,
                            ))
                            continue
                    except InvalidOperation:
                        self.errors.append(ValidationError(
                            error_type=ValidationErrorType.INVALID_UNIT,
                            message=f"单价格式无效: {price_str}",
                            field="单价(元/克)",
                            row_number=row_num,
                        ))
                        continue

                    try:
                        material = Material(
                            name=name,
                            purity=purity,
                            element_composition=element_composition,
                            remaining_grams=remaining,
                            price_per_gram=price,
                        )
                        inventory.add_material(material)
                    except ValueError as e:
                        self.errors.append(ValidationError(
                            error_type=ValidationErrorType.INVALID_UNIT,
                            message=str(e),
                            row_number=row_num,
                        ))

        except FileNotFoundError:
            self.errors.append(ValidationError(
                error_type=ValidationErrorType.MISSING_FIELD,
                message=f"文件不存在: {file_path}",
            ))
        except Exception as e:
            self.errors.append(ValidationError(
                error_type=ValidationErrorType.INVALID_UNIT,
                message=f"文件读取错误: {e}",
            ))

        return (None if self.errors else inventory), self.errors

    def parse_recipe(self, file_path: str) -> Tuple[Optional[RecipeTarget], List[ValidationError]]:
        self.errors = []
        element_limits: Dict[str, ElementLimit] = {}
        target_volume: Optional[Decimal] = None
        forbidden_materials: List[str] = []
        notes_list: List[str] = []

        try:
            with open(file_path, "r", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                fieldnames = reader.fieldnames or []

                for field in REQUIRED_RECIPE_FIELDS:
                    if field not in fieldnames:
                        self.errors.append(ValidationError(
                            error_type=ValidationErrorType.MISSING_FIELD,
                            message=f"缺少必要字段: {field}",
                            field=field,
                        ))

                if self.errors:
                    return None, self.errors

                for row_num, row in enumerate(reader, start=2):
                    volume_str = row.get("目标体积(L)", "").strip()
                    element = row.get("元素", "").strip().upper()
                    min_str = row.get("ppm下限", "").strip()
                    max_str = row.get("ppm上限", "").strip()
                    forbidden = row.get("禁用原料", "").strip()
                    note = row.get("备注", "").strip()

                    if volume_str:
                        try:
                            volume = Decimal(volume_str)
                            if volume <= 0:
                                self.errors.append(ValidationError(
                                    error_type=ValidationErrorType.NEGATIVE_VALUE,
                                    message=f"目标体积必须大于0: {volume_str}",
                                    field="目标体积(L)",
                                    row_number=row_num,
                                ))
                                continue
                            if target_volume is None:
                                target_volume = volume
                            elif target_volume != volume:
                                self.errors.append(ValidationError(
                                    error_type=ValidationErrorType.CONFLICTING_LIMITS,
                                    message=f"目标体积不一致: 之前是{target_volume}L, 当前是{volume}L",
                                    field="目标体积(L)",
                                    row_number=row_num,
                                ))
                                continue
                        except InvalidOperation:
                            self.errors.append(ValidationError(
                                error_type=ValidationErrorType.INVALID_UNIT,
                                message=f"目标体积格式无效: {volume_str}",
                                field="目标体积(L)",
                                row_number=row_num,
                            ))
                            continue

                    if element:
                        if element not in STANDARD_ELEMENTS:
                            similar = self._find_similar_element(element)
                            msg = f"未知元素: {element}"
                            if similar:
                                msg += f" (可能是指 {similar}?)"
                            self.errors.append(ValidationError(
                                error_type=ValidationErrorType.UNKNOWN_ELEMENT,
                                message=msg,
                                field="元素",
                                row_number=row_num,
                            ))
                            continue

                        if element in element_limits:
                            self.errors.append(ValidationError(
                                error_type=ValidationErrorType.DUPLICATE_MATERIAL,
                                message=f"元素重复定义: {element}",
                                field="元素",
                                row_number=row_num,
                            ))
                            continue

                        try:
                            min_ppm = Decimal(min_str) if min_str else Decimal("0")
                            max_ppm = Decimal(max_str) if max_str else Decimal("999999")

                            if min_ppm < 0:
                                self.errors.append(ValidationError(
                                    error_type=ValidationErrorType.NEGATIVE_VALUE,
                                    message=f"ppm下限不能为负数: {min_str}",
                                    field="ppm下限",
                                    row_number=row_num,
                                ))
                                continue

                            if max_ppm < 0:
                                self.errors.append(ValidationError(
                                    error_type=ValidationErrorType.NEGATIVE_VALUE,
                                    message=f"ppm上限不能为负数: {max_str}",
                                    field="ppm上限",
                                    row_number=row_num,
                                ))
                                continue

                            if min_ppm > max_ppm:
                                self.errors.append(ValidationError(
                                    error_type=ValidationErrorType.CONFLICTING_LIMITS,
                                    message=f"ppm下限({min_str})不能大于上限({max_str})",
                                    row_number=row_num,
                                ))
                                continue

                            element_limits[element] = ElementLimit(
                                element=element,
                                min_ppm=min_ppm,
                                max_ppm=max_ppm,
                            )
                        except InvalidOperation:
                            self.errors.append(ValidationError(
                                error_type=ValidationErrorType.INVALID_UNIT,
                                message=f"ppm值格式无效",
                                row_number=row_num,
                            ))
                            continue

                    if forbidden:
                        for mat in forbidden.split(","):
                            mat = mat.strip()
                            if mat and mat not in forbidden_materials:
                                forbidden_materials.append(mat)

                    if note and note not in notes_list:
                        notes_list.append(note)

        except FileNotFoundError:
            self.errors.append(ValidationError(
                error_type=ValidationErrorType.MISSING_FIELD,
                message=f"文件不存在: {file_path}",
            ))
        except Exception as e:
            self.errors.append(ValidationError(
                error_type=ValidationErrorType.INVALID_UNIT,
                message=f"文件读取错误: {e}",
            ))

        if target_volume is None and not self.errors:
            self.errors.append(ValidationError(
                error_type=ValidationErrorType.MISSING_FIELD,
                message="未指定目标体积",
                field="目标体积(L)",
            ))

        if not element_limits and not self.errors:
            self.errors.append(ValidationError(
                error_type=ValidationErrorType.MISSING_FIELD,
                message="未指定任何元素目标",
                field="元素",
            ))

        notes = "; ".join(notes_list)

        if self.errors:
            return None, self.errors

        assert target_volume is not None
        return RecipeTarget(
            target_volume_liters=target_volume,
            element_limits=element_limits,
            forbidden_materials=forbidden_materials,
            notes=notes,
        ), self.errors

    def write_inventory(self, inventory: Inventory, file_path: str) -> None:
        with open(file_path, "w", encoding="utf-8", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=REQUIRED_INVENTORY_FIELDS)
            writer.writeheader()

            for material in inventory.list_materials():
                elements_str = ", ".join(
                    f"{elem}:{float(ratio):.6f}".rstrip("0").rstrip(".")
                    for elem, ratio in material.element_composition.items()
                )
                writer.writerow({
                    "名称": material.name,
                    "纯度": float(material.purity),
                    "元素组成": elements_str,
                    "剩余克数": float(material.remaining_grams),
                    "单价(元/克)": float(material.price_per_gram),
                })

    def _find_similar_element(self, elem: str) -> Optional[str]:
        elem_upper = elem.upper()
        for standard in STANDARD_ELEMENTS:
            if elem_upper == standard:
                return standard
            if len(elem_upper) >= 2 and standard.startswith(elem_upper[0]):
                if elem_upper[1] == standard[1] if len(standard) >= 2 else False:
                    return standard
            if len(elem_upper) == 1 and standard.startswith(elem_upper):
                return standard
        return None
