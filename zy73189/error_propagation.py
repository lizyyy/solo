"""error_propagation.py — 误差传播计算核心。

对一道题在一个参数版本下：
1. 把每个变量的(值, 不确定度)成对换算到 SI 基本单位（避免单位换算导致结果偏移）；
2. 用 sympy 解析公式、求各偏导数（符号解，便于解释）；
3. 代入计算结果值与传播不确定度 σ = sqrt(Σ (∂f/∂x·σx)²)；
4. 检测异常（除零、复数结果、量纲不一致、未知变量、解析失败），
   每条异常都追溯到题目清单的 original_statement，绝不给出含糊警告；
5. 产出"截图说明"——把公式→偏导→结果/异常串成一条可追溯链。
"""

import sympy as sp

import units as U


# 常数符号（不会被当作变量名误读为虚数单位等）
_CONST_LOCALS = {"pi": sp.pi, "e": sp.E, "E": sp.E}


def _apply_overrides(variables, overrides):
    """对题目变量施加版本覆盖，返回新的变量字典。"""
    merged = {}
    for name, spec in variables.items():
        m = dict(spec)
        merged[name] = m
    for name, patch in (overrides or {}).items():
        if name in merged:
            merged[name].update(patch)
        else:
            merged[name] = dict(patch)
    return merged


def _classify(val):
    """把 sympy 值分类为有限浮点或异常类别。"""
    val = sp.sympify(val)
    if val.has(sp.zoo) or val is sp.zoo:
        return ("zoo", None)
    if val.has(sp.oo) or val == sp.oo or val == -sp.oo:
        return ("oo", None)
    if val.has(sp.nan) or val == sp.nan:
        return ("nan", None)
    if val.has(sp.I):
        try:
            c = complex(sp.N(val))
            return ("complex", c)
        except Exception:
            return ("complex", None)
    try:
        f = float(sp.N(val))
        if f != f:
            return ("nan", None)
        return ("finite", f)
    except (TypeError, ValueError):
        return ("symbolic", str(val))


def _is_finite(val):
    return _classify(val)[0] == "finite"


def compute(question, version_label, version_desc, overrides):
    """计算一道题在一个版本下的误差传播结果。返回结果字典。"""
    qid = question["id"]
    title = question.get("title", "")
    formula_str = question["formula"]
    result_unit = question.get("result_unit", "")
    category = question.get("category", "standard")
    original_statement = question.get("original_statement", "")
    boundary_kind = question.get("boundary_kind")

    variables = _apply_overrides(question["variables"], overrides)

    exceptions = []
    notes = []

    # ---- 输入换算到 SI（值与不确定度成对）----
    inputs = []
    var_symbols = {}
    var_dims = {}
    si_subs = {}
    for name, spec in variables.items():
        unit = spec.get("unit", "")
        try:
            value = float(spec.get("value", 0))
            unc = float(spec.get("uncertainty", 0))
            value_si, unc_si = U.to_si(value, unc, unit)
            _, dim = U.parse_unit(unit)
            dim_ok = True
        except U.UnitError as e:
            value = unc = value_si = unc_si = None
            dim = {}
            dim_ok = False
            exceptions.append(_exc(
                "unknown_unit", qid, formula_str,
                "变量 %s 的单位 %s 无法识别：%s" % (name, unit, e),
                original_statement))
        sym = sp.Symbol(name)
        var_symbols[name] = sym
        var_dims[name] = dim
        si_subs[sym] = value_si if value_si is not None else 0
        inputs.append({
            "name": name, "value": value, "uncertainty": unc, "unit": unit,
            "value_si": value_si, "uncertainty_si": unc_si,
            "dim_name": U.dim_name(dim) if dim_ok else "未知",
        })

    # ---- 解析公式（显式 locals，避免 I 被当作虚数单位）----
    locals_map = dict(_CONST_LOCALS)
    locals_map.update(var_symbols)
    try:
        expr = sp.sympify(formula_str, locals=locals_map)
    except Exception as e:
        exceptions.append(_exc(
            "parse_error", qid, formula_str,
            "公式 %s 解析失败：%s" % (formula_str, e),
            original_statement))
        return _result(qid, version_label, version_desc, title, category,
                       boundary_kind, original_statement, formula_str,
                       result_unit, inputs, [], exceptions, notes,
                       None, None, None, None, "未知", "未知", False)

    # ---- 未知变量检查 ----
    used_names = {str(s) for s in expr.free_symbols}
    for nm in used_names:
        if nm not in var_symbols and nm not in ("pi", "e", "E"):
            exceptions.append(_exc(
                "unknown_variable", qid, formula_str,
                "公式 %s 中出现题目未定义的变量 %s。" % (formula_str, nm),
                original_statement))

    # ---- 偏导数（符号）----
    partials = []
    for name, sym in var_symbols.items():
        d = sp.diff(expr, sym)
        partials.append({"var": name, "symbolic": str(d)})

    # ---- 结果值（SI）----
    result_value_si = None
    result_uncertainty_si = None
    result_value = None
    result_uncertainty = None

    if not exceptions:
        try:
            res_sym = expr.subs(si_subs)
        except ZeroDivisionError:
            res_sym = sp.zoo
        except Exception as e:
            res_sym = sp.Symbol("__err__")
            exceptions.append(_exc(
                "eval_error", qid, formula_str,
                "公式 %s 计算时出错：%s" % (formula_str, e),
                original_statement))
            res_sym = sp.zoo

        rkind, rdata = _classify(res_sym)

        # 偏导数值（SI）与各贡献项
        contribs = []
        bad_partial = False
        for p in partials:
            dsym = sp.sympify(p["symbolic"], locals=locals_map)
            try:
                dval = dsym.subs(si_subs)
            except ZeroDivisionError:
                dval = sp.zoo
            kind, data = _classify(dval)
            if kind != "finite":
                bad_partial = True
            p["value_si"] = data if kind == "finite" else None
            p["value_class"] = kind
            contribs.append((p["var"], kind, data))

        # ---- 异常判定（优先按结果本身的性质分类）----
        zero_vars = [p["name"] for p in inputs
                     if p["value"] is not None and abs(p["value"]) < 1e-15]
        if rkind == "complex":
            exceptions.append(_exc(
                "complex_result", qid, formula_str,
                "公式 %s 代入后得到复数结果（约 %s），无实数解。" % (
                    formula_str, _fmt_complex(rdata)),
                original_statement))
        elif rkind in ("zoo", "oo", "nan") or bad_partial:
            if zero_vars:
                culprit = "输入变量 %s 取值为 0，使公式 %s 出现除零" % (
                    "、".join(zero_vars), formula_str)
                etype = "divide_by_zero"
            else:
                culprit = "公式 %s 计算得到非有限值（%s）" % (formula_str, rkind)
                etype = "non_finite"
            exceptions.append(_exc(
                etype, qid, formula_str,
                "%s；结果无法给出有限值。" % culprit,
                original_statement))
        elif rkind == "complex":
            exceptions.append(_exc(
                "complex_result", qid, formula_str,
                "公式 %s 代入后得到复数结果（约 %s），无实数解。" % (
                    formula_str, _fmt_complex(rdata)),
                original_statement))
        else:
            # 有限实数：计算传播不确定度
            result_value_si = rdata
            sum_sq = 0.0
            for inp, p in zip(inputs, partials):
                if p["value_si"] is None:
                    continue
                sigma = inp["uncertainty_si"] or 0.0
                term = (p["value_si"] * sigma) ** 2
                sum_sq += term
                if abs(sigma) < 1e-15:
                    notes.append("变量 %s 不确定度为 0，对误差零贡献。" % inp["name"])
            import math
            result_uncertainty_si = math.sqrt(sum_sq) if sum_sq >= 0 else None
            # 换算回 result_unit
            try:
                result_value, result_uncertainty = U.from_si(
                    result_value_si, result_uncertainty_si, result_unit)
            except U.UnitError as e:
                exceptions.append(_exc(
                    "unknown_unit", qid, formula_str,
                    "结果单位 %s 无法识别：%s" % (result_unit, e),
                    original_statement))

    # ---- 量纲校验 ----
    res_dim = U.expr_dimension(expr, var_dims)
    try:
        _, unit_dim = U.parse_unit(result_unit)
        unit_dim_name = U.dim_name(unit_dim)
    except U.UnitError:
        unit_dim = None
        unit_dim_name = "未知"
    res_dim_name = U.dim_name(res_dim) if res_dim is not None else "未知"
    dim_match = (res_dim is not None and unit_dim is not None
                 and U.dim_equal(res_dim, unit_dim))
    if res_dim is not None and unit_dim is not None and not dim_match:
        exceptions.append(_exc(
            "unit_dimension_mismatch", qid, formula_str,
            "公式结果量纲为 %s，但 result_unit=%s 的量纲为 %s，二者不一致。" % (
                res_dim_name, result_unit, unit_dim_name),
            original_statement))

    status = "exception" if exceptions else ("warning" if notes else "ok")
    explanation = _build_explanation(
        qid, title, formula_str, result_unit, inputs, partials,
        result_value, result_uncertainty, exceptions, notes, original_statement)

    return _result(qid, version_label, version_desc, title, category,
                   boundary_kind, original_statement, formula_str, result_unit,
                   inputs, partials, exceptions, notes,
                   result_value_si, result_uncertainty_si,
                   result_value, result_uncertainty,
                   res_dim_name, unit_dim_name, dim_match, explanation)


def _exc(etype, qid, formula, message, original_statement):
    return {
        "type": etype,
        "message": message,
        "original_statement": original_statement,
        "trace": "%s → 公式 %s → %s → 原始说法：%s" % (
            qid, formula, _etype_cn(etype),
            original_statement),
    }


def _etype_cn(etype):
    return {
        "divide_by_zero": "除零异常",
        "non_finite": "非有限值异常",
        "complex_result": "复数结果异常",
        "unit_dimension_mismatch": "量纲不一致",
        "unknown_unit": "未知单位",
        "unknown_variable": "未知变量",
        "parse_error": "公式解析失败",
        "eval_error": "计算出错",
    }.get(etype, etype)


def _fmt_complex(c):
    if c is None:
        return "复数"
    return "%.4g %+.4gi" % (c.real, c.imag)


def _build_explanation(qid, title, formula, result_unit, inputs, partials,
                       result_value, result_uncertainty, exceptions, notes,
                       original_statement):
    lines = []
    lines.append("【截图说明】题目 %s《%s》" % (qid, title))
    lines.append("公式：%s" % formula)
    parts = []
    for inp in inputs:
        if inp["value"] is None:
            parts.append("%s=?" % inp["name"])
            continue
        parts.append("%s=%s±%s %s→SI %s±%s" % (
            inp["name"], _fmt(inp["value"]), _fmt(inp["uncertainty"]),
            inp["unit"], _fmt(inp["value_si"]), _fmt(inp["uncertainty_si"])))
    lines.append("输入（→SI）：" + "；".join(parts))
    deriv_parts = []
    for p in partials:
        deriv_parts.append("∂f/∂%s=%s" % (p["var"], p["symbolic"]))
    lines.append("偏导数：" + "，".join(deriv_parts))
    if exceptions:
        for e in exceptions:
            lines.append("异常[%s]：%s" % (_etype_cn(e["type"]), e["message"]))
            lines.append("追溯：%s" % e["trace"])
    else:
        lines.append("结果：%s ± %s %s（SI：%s ± %s）" % (
            _fmt(result_value), _fmt(result_uncertainty), result_unit,
            _fmt(result_value if result_value is not None else None),
            _fmt(result_uncertainty if result_uncertainty is not None else None)))
    for n in notes:
        lines.append("提示：%s" % n)
    lines.append("原始说法：%s" % original_statement)
    return "\n".join(lines)


def _fmt(v):
    if v is None:
        return "—"
    if isinstance(v, float):
        if abs(v) >= 1000 or (abs(v) < 0.01 and v != 0):
            return "%.4e" % v
        return "%.4g" % v
    return str(v)


def _result(qid, version, version_desc, title, category, boundary_kind,
            original_statement, formula, result_unit, inputs, partials,
            exceptions, notes, result_value_si, result_uncertainty_si,
            result_value, result_uncertainty, res_dim_name, unit_dim_name,
            dim_match, explanation=""):
    return {
        "question_id": qid,
        "version": version,
        "version_desc": version_desc,
        "title": title,
        "category": category,
        "boundary_kind": boundary_kind,
        "original_statement": original_statement,
        "formula": formula,
        "result_unit": result_unit,
        "inputs": inputs,
        "partials": partials,
        "exceptions": exceptions,
        "notes": notes,
        "result_value_si": result_value_si,
        "result_uncertainty_si": result_uncertainty_si,
        "result_value": result_value,
        "result_uncertainty": result_uncertainty,
        "result_dim_name": res_dim_name,
        "result_unit_dim_name": unit_dim_name,
        "dim_match": dim_match,
        "status": "exception" if exceptions else ("warning" if notes else "ok"),
        "explanation": explanation,
    }
