from typing import List, Dict, Any, Tuple


class ValidationResult:
    def __init__(self, recipe_id: str):
        self.recipe_id = recipe_id
        self.errors: List[Dict[str, Any]] = []
        self.warnings: List[Dict[str, Any]] = []
        self.ingredient_match: Dict[str, Any] = {}
        self.step_order_errors: List[Dict[str, Any]] = []
        self.heat_level_errors: List[Dict[str, Any]] = []

    def add_error(self, field: str, expected: Any, actual: Any, message: str):
        self.errors.append({
            "field": field,
            "expected": expected,
            "actual": actual,
            "message": message
        })

    def add_warning(self, field: str, message: str):
        self.warnings.append({
            "field": field,
            "message": message
        })


def validate_ingredients(
    golden: List[Dict[str, Any]],
    model_output: List[Dict[str, Any]],
    fuzzy_match: bool = True
) -> Tuple[Dict[str, Any], List[Dict[str, Any]]]:
    errors = []
    g_names = {ing["name"] for ing in golden}
    m_names = {ing["name"] for ing in model_output}

    missing = g_names - m_names
    extra = m_names - g_names

    match_details = {
        "total_golden": len(golden),
        "total_model": len(model_output),
        "matched": len(g_names & m_names),
        "missing": list(missing),
        "extra": list(extra)
    }

    for g_ing in golden:
        if g_ing["name"] not in m_names:
            errors.append({
                "type": "missing_ingredient",
                "ingredient": g_ing["name"],
                "expected_quantity": g_ing.get("quantity"),
                "expected_unit": g_ing.get("unit")
            })
            continue

        m_ing = next(ing for ing in model_output if ing["name"] == g_ing["name"])

        if fuzzy_match:
            q_match = normalize_quantity(g_ing.get("quantity", "")) == normalize_quantity(m_ing.get("quantity", ""))
        else:
            q_match = g_ing.get("quantity") == m_ing.get("quantity")

        if not q_match:
            errors.append({
                "type": "quantity_mismatch",
                "ingredient": g_ing["name"],
                "expected_quantity": g_ing.get("quantity"),
                "actual_quantity": m_ing.get("quantity")
            })

        if g_ing.get("unit") != m_ing.get("unit"):
            errors.append({
                "type": "unit_mismatch",
                "ingredient": g_ing["name"],
                "expected_unit": g_ing.get("unit"),
                "actual_unit": m_ing.get("unit")
            })

    for m_ing in model_output:
        if m_ing["name"] not in g_names:
            errors.append({
                "type": "extra_ingredient",
                "ingredient": m_ing["name"],
                "actual_quantity": m_ing.get("quantity")
            })

    return match_details, errors


def normalize_quantity(q: str) -> str:
    if not q:
        return ""
    q = q.lower().strip()
    q = q.replace("ml", "").replace("克", "").replace("g", "").replace("个", "").strip()
    return q


def validate_step_order(
    golden: List[Dict[str, Any]],
    model_output: List[Dict[str, Any]],
    strict: bool = False
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    errors = []
    warnings = []

    g_steps = sorted(golden, key=lambda x: x.get("step_number", 0))
    m_steps_sorted = sorted(model_output, key=lambda x: x.get("step_number", 0))

    g_order = [s["step_number"] for s in g_steps]
    m_order = [s["step_number"] for s in m_steps_sorted]

    if g_order != m_order:
        if strict:
            errors.append({
                "type": "step_order_mismatch",
                "expected_order": g_order,
                "actual_order": m_order
            })
        else:
            warnings.append({
                "type": "step_order_out_of_sequence",
                "expected_order": g_order,
                "actual_order": m_order,
                "message": "Step numbers are not in proper sequence"
            })

    for i, g_step in enumerate(golden):
        matching_m_step = None
        for m_step in model_output:
            if g_step.get("instruction") == m_step.get("instruction"):
                matching_m_step = m_step
                break

        if matching_m_step is None and not strict:
            warnings.append({
                "type": "step_instruction_changed",
                "step_number": g_step.get("step_number"),
                "expected_instruction": g_step.get("instruction"),
                "actual_instruction": matching_m_step.get("instruction") if matching_m_step else None
            })

    return errors, warnings


def validate_heat_levels(
    golden: List[Dict[str, Any]],
    model_output: List[Dict[str, Any]],
    allowed_values: List[str],
    allow_missing: bool = True
) -> List[Dict[str, Any]]:
    errors = []

    for g_step in golden:
        step_num = g_step.get("step_number")
        g_heat = g_step.get("heat_level")
        g_instruction = g_step.get("instruction")

        matching_m_step = None
        for m_step in model_output:
            if m_step.get("instruction") == g_instruction or m_step.get("step_number") == step_num:
                matching_m_step = m_step
                break

        if matching_m_step:
            m_heat = matching_m_step.get("heat_level")

            if m_heat not in allowed_values and m_heat is not None:
                errors.append({
                    "type": "invalid_heat_level",
                    "step_number": step_num,
                    "expected_heat": g_heat,
                    "actual_heat": m_heat
                })
            elif g_heat != m_heat:
                if g_heat is None and not allow_missing:
                    errors.append({
                        "type": "heat_level_missing",
                        "step_number": step_num,
                        "actual_heat": m_heat
                    })
                elif g_heat is not None and m_heat is not None:
                    errors.append({
                        "type": "heat_level_mismatch",
                        "step_number": step_num,
                        "expected_heat": g_heat,
                        "actual_heat": m_heat
                    })

    return errors


def validate_recipe(
    golden: Dict[str, Any],
    model_output: Dict[str, Any],
    schema: Dict[str, Any]
) -> ValidationResult:
    result = ValidationResult(golden.get("recipe_id", "unknown"))

    golden_ingredients = golden.get("ingredients", [])
    model_ingredients = model_output.get("ingredients", [])

    ing_match, ing_errors = validate_ingredients(
        golden_ingredients,
        model_ingredients,
        fuzzy_match=schema.get("validation_rules", {}).get("quantity_fuzzy_match", True)
    )
    result.ingredient_match = ing_match
    for err in ing_errors:
        result.add_error("ingredients", err.get("expected"), err.get("actual"), str(err))

    golden_steps = golden.get("steps", [])
    model_steps = model_output.get("steps", [])

    step_errors, step_warnings = validate_step_order(
        golden_steps,
        model_steps,
        strict=schema.get("validation_rules", {}).get("step_order_strict", False)
    )
    result.step_order_errors = step_errors
    for err in step_errors:
        result.add_error("steps", err.get("expected"), err.get("actual"), str(err))
    for warn in step_warnings:
        result.add_warning("steps", str(warn))

    allowed_heats = schema.get("recipe_schema", {}).get("steps", {}).get("item_schema", {}).get("heat_level", {}).get("allowed_values", [])
    heat_errors = validate_heat_levels(
        golden_steps,
        model_steps,
        allowed_heats,
        allow_missing=schema.get("validation_rules", {}).get("allow_missing_heat", True)
    )
    result.heat_level_errors = heat_errors
    for err in heat_errors:
        result.add_error("heat_level", err.get("expected_heat"), err.get("actual_heat"), str(err))

    if "recipe_name" in golden and golden["recipe_name"] != model_output.get("recipe_name"):
        result.add_error("recipe_name", golden["recipe_name"], model_output.get("recipe_name"), "Recipe name mismatch")

    return result


def validate_all(
    golden_records: List[Dict[str, Any]],
    model_records: List[Dict[str, Any]],
    schema: Dict[str, Any]
) -> List[ValidationResult]:
    results = []
    golden_by_id = {r["recipe_id"]: r for r in golden_records}

    for m_record in model_records:
        recipe_id = m_record.get("recipe_id")
        if recipe_id in golden_by_id:
            result = validate_recipe(golden_by_id[recipe_id], m_record, schema)
        else:
            result = ValidationResult(recipe_id)
            result.add_error("recipe_id", "exists in golden", recipe_id, "Recipe not found in golden set")
        results.append(result)

    for g_record in golden_records:
        if g_record["recipe_id"] not in [r.get("recipe_id") for r in model_records]:
            result = ValidationResult(g_record["recipe_id"])
            result.add_error("recipe_id", "exists in model output", g_record["recipe_id"], "Recipe not found in model outputs")
            results.append(result)

    return results