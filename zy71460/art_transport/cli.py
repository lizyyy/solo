import argparse
import json
import sys
from art_transport.loader import load_artworks, load_cities, load_routes, load_constraints
from art_transport.batch import plan_all_batches
from art_transport.validator import (
    check_high_value_mixed_packing,
    check_temp_timeout,
    check_route_duplication,
    apply_warnings_to_results,
)
from art_transport.models import ConstraintConfig


def main():
    parser = argparse.ArgumentParser(
        description="艺术品运输路径优化 — 在保险金额、温控与路线时间之间取舍"
    )
    parser.add_argument("--artworks", required=True, help="作品清单 JSON 文件路径")
    parser.add_argument("--cities", required=True, help="城市清单 JSON 文件路径")
    parser.add_argument("--routes", required=True, help="路线清单 JSON 文件路径")
    parser.add_argument("--constraints", default=None, help="约束配置 JSON 文件路径（可选，有默认值）")
    parser.add_argument("--source-name", default="cli_input", help="数据来源名称")
    parser.add_argument("--source-version", default="1.0", help="数据版本")
    parser.add_argument("--output", default=None, help="输出 JSON 文件路径（不指定则输出到 stdout）")
    parser.add_argument("--show-formulas", action="store_true", help="输出时包含公式计算细节")
    parser.add_argument("--show-intermediates", action="store_true", help="输出时包含中间量（温控违规、保险暴露）")

    args = parser.parse_args()

    artworks = load_artworks(args.artworks, args.source_name, args.source_version)
    cities = load_cities(args.cities, args.source_name, args.source_version)
    routes = load_routes(args.routes, args.source_name, args.source_version)
    config = load_constraints(args.constraints, args.source_name, args.source_version)

    artworks_map = {a.artwork_id: a for a in artworks}
    routes_map = {r.route_id: r for r in routes}

    batches, path_results = plan_all_batches(artworks, routes, config)

    all_warnings = []
    all_warnings.extend(check_high_value_mixed_packing(path_results, artworks_map, config))
    all_warnings.extend(check_temp_timeout(path_results, artworks_map, routes_map))
    all_warnings.extend(check_route_duplication(path_results, routes_map))

    adjusted_results = apply_warnings_to_results(path_results, all_warnings, config)

    output = {
        "data_sources": {
            "artworks": {"file": args.artworks, "source": args.source_name, "version": args.source_version},
            "cities": {"file": args.cities, "source": args.source_name, "version": args.source_version},
            "routes": {"file": args.routes, "source": args.source_name, "version": args.source_version},
            "constraints": {"file": args.constraints or "(defaults)", "source": args.source_name, "version": args.source_version},
        },
        "constraint_config": config.to_dict(),
        "batches": [b.to_dict() for b in batches],
        "path_results": [r.to_dict() for r in adjusted_results],
        "warnings": [w.to_dict() for w in all_warnings],
        "summary": _build_summary(batches, adjusted_results, all_warnings),
    }

    if not args.show_formulas:
        for pr in output["path_results"]:
            pr.pop("formula_detail", None)
    if not args.show_intermediates:
        for pr in output["path_results"]:
            pr.pop("temp_violations", None)
            pr.pop("insurance_exposures", None)

    text = json.dumps(output, ensure_ascii=False, indent=2)
    if args.output:
        with open(args.output, "w", encoding="utf-8") as f:
            f.write(text)
        print(f"结果已写入 {args.output}", file=sys.stderr)
    else:
        print(text)


def _build_summary(batches, results, warnings) -> dict:
    total_insurance = sum(r.total_insurance_cny for r in results)
    total_distance = sum(r.total_distance_km for r in results)
    special_handling = [r.batch_id for r in results if r.formula_detail.get("requires_special_handling")]
    high_sev = [w for w in warnings if w.severity == "high"]
    medium_sev = [w for w in warnings if w.severity == "medium"]
    return {
        "total_batches": len(batches),
        "total_artworks": sum(len(b.artworks) for b in batches),
        "total_insurance_cny": round(total_insurance, 2),
        "total_distance_km": round(total_distance, 2),
        "warnings_count": len(warnings),
        "high_severity_warnings": len(high_sev),
        "medium_severity_warnings": len(medium_sev),
        "batches_requiring_special_handling": special_handling,
        "risk_score_range": {
            "min": round(min(r.composite_risk_score for r in results), 6) if results else 0,
            "max": round(max(r.composite_risk_score for r in results), 6) if results else 0,
        },
    }


if __name__ == "__main__":
    main()
