import json
from typing import List, Dict, Any


def render_html_comparison(
    validation_results: List,
    golden_records: List[Dict[str, Any]],
    model_records: List[Dict[str, Any]],
    output_path: str
):
    golden_by_id = {r["recipe_id"]: r for r in golden_records}
    model_by_id = {r["recipe_id"]: r for r in model_records}

    all_ids = set(golden_by_id.keys()) | set(model_by_id.keys())

    total_errors = sum(len(r.errors) for r in validation_results)
    total_warnings = sum(len(r.warnings) for r in validation_results)

    total_fields = sum(
        r.ingredient_match.get("total_golden", 0)
        for r in validation_results
    )
    correct_fields = sum(
        r.ingredient_match.get("matched", 0)
        for r in validation_results
    )
    field_accuracy = (correct_fields / total_fields * 100) if total_fields > 0 else 0

    template_path = __file__.rsplit("/", 1)[0] + "/templates/comparison_template.html"
    try:
        with open(template_path, "r", encoding="utf-8") as f:
            template = f.read()
    except FileNotFoundError:
        template = _get_default_template()

    recipes_html_parts = []
    for recipe_id in sorted(all_ids):
        golden = golden_by_id.get(recipe_id, {})
        model = model_by_id.get(recipe_id, {})
        val_result = next((r for r in validation_results if r.recipe_id == recipe_id), None)

        has_errors = val_result.errors if val_result else []
        has_warnings = val_result.warnings if val_result else []

        recipes_html_parts.append(_render_recipe_card(recipe_id, golden, model, val_result))

    html = template
    html = html.replace("{{total_recipes}}", str(len(all_ids)))
    html = html.replace("{{field_accuracy}}", f"{field_accuracy:.2f}")
    html = html.replace("{{total_errors}}", str(total_errors))
    html = html.replace("{{total_warnings}}", str(total_warnings))
    html = html.replace("{{recipes_html}}", "\n".join(recipes_html_parts))

    with open(output_path, "w", encoding="utf-8") as f:
        f.write(html)


def _render_recipe_card(recipe_id: str, golden: Dict, model: Dict, val_result) -> str:
    recipe_name = golden.get("recipe_name", model.get("recipe_name", recipe_id))
    has_errors = bool(val_result.errors) if val_result else False
    has_warnings = bool(val_result.warnings) if val_result else False

    card = f'''<div class="recipe-card" data-has-errors="{'true' if has_errors else 'false'}" data-has-warnings="{'true' if has_warnings else 'false'}">'''
    card += f'''<div class="recipe-header" onclick="toggleRecipe('{recipe_id}')">'''
    card += f'<h3>{recipe_name} ({recipe_id})</h3>'
    if val_result:
        if val_result.errors:
            card += '<div>'
            for e in val_result.errors[:3]:
                card += f'<span class="tag tag-error">{e.get("type", "error")}</span>'
            if len(val_result.errors) > 3:
                card += f'<span class="tag tag-error">+{len(val_result.errors)-3} more</span>'
            card += '</div>'
        if val_result.warnings:
            card += '<div>'
            for w in val_result.warnings[:3]:
                card += f'<span class="tag tag-warning">{w.get("type", "warning")}</span>'
            if len(val_result.warnings) > 3:
                card += f'<span class="tag tag-warning">+{len(val_result.warnings)-3} more</span>'
            card += '</div>'
    card += '</div>'

    card += f'<div class="recipe-body" id="recipe-{recipe_id}">'
    card += '<div class="comparison">'

    card += '<div class="panel golden"><h3>Golden 标准</h3>'
    card += _render_panel_content(golden)
    card += '</div>'

    card += '<div class="panel model"><h3>模型输出</h3>'
    card += _render_panel_content(model)
    card += '</div>'

    card += '</div>'

    if val_result and (val_result.errors or val_result.warnings):
        card += '<div class="error-box"><h4>校验结果</h4>'
        for err in val_result.errors:
            card += f'''<div class="error-item"><strong>{err.get("type", "error")}</strong>: {err.get("message", "")}</div>'''
        for warn in val_result.warnings:
            card += f'''<div class="error-item"><strong>{warn.get("type", "warning")}</strong>: {warn.get("message", "")}</div>'''
        card += '</div>'

    card += '</div></div>'
    return card


def _render_panel_content(data: Dict) -> str:
    if not data:
        return "<p>无数据</p>"

    html = f"<p><strong>菜名:</strong> {data.get('recipe_name', 'N/A')}</p>"

    ingredients = data.get("ingredients", [])
    html += "<p><strong>食材:</strong></p><ul>"
    for ing in ingredients:
        html += f"<li>{ing.get('name', '')} - {ing.get('quantity', '')} {ing.get('unit', '')}</li>"
    html += "</ul>"

    steps = data.get("steps", [])
    html += "<p><strong>步骤:</strong></p><table><tr><th>#</th><th>指令</th><th>火候</th></tr>"
    for step in sorted(steps, key=lambda x: x.get("step_number", 0)):
        html += f"<tr><td>{step.get('step_number', '')}</td><td>{step.get('instruction', '')}</td><td>{step.get('heat_level', 'N/A')}</td></tr>"
    html += "</table>"

    return html


def _get_default_template() -> str:
    return '''<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>菜谱结构化抽取对比报告</title>
    <style>
        body { font-family: sans-serif; padding: 20px; }
        .recipe-card { border: 1px solid #ccc; margin: 10px 0; padding: 10px; }
        .recipe-header { cursor: pointer; background: #f0f0f0; padding: 10px; }
        .recipe-body { display: none; padding: 10px; }
        .open { display: block; }
        .comparison { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .golden { border-left: 3px solid green; }
        .model { border-left: 3px solid red; }
        .error-box { background: #ffe6e6; padding: 10px; margin-top: 10px; }
    </style>
</head>
<body>
    <h1>菜谱结构化抽取对比报告</h1>
    {{recipes_html}}
    <script>
        function toggleRecipe(id) {
            document.getElementById('recipe-' + id).classList.toggle('open');
        }
    </script>
</body>
</html>'''