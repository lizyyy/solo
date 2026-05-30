#!/usr/bin/env python3
import sys
import os
import argparse
import json

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from models import DataStore
from cop_calc import calc_cop, format_calc_detail
from slicing import slice_by_temp_bands, slice_hourly, format_slice_table
from comparison import compare_schemes, format_comparison
from diagnostics import Diagnostics


def cmd_import(args, store: DataStore):
    ftype = args.type
    filepath = args.file

    if not os.path.exists(filepath):
        print(f"文件不存在: {filepath}")
        sys.exit(1)

    try:
        if ftype == "equipment":
            obj = store.import_equipment(filepath)
            print(f"已导入设备: {obj.name} (型号={obj.model})")
        elif ftype == "temp_curve":
            obj = store.import_temp_curve(filepath)
            print(f"已导入温度曲线: {obj.location} {obj.season}")
        elif ftype == "electricity":
            obj = store.import_electricity(filepath)
            print(f"已导入电价: {obj.name} (有效电价={obj.effective_rate():.4f} 元/kWh)")
        elif ftype == "fuel":
            obj = store.import_competing_fuel(filepath)
            print(f"已导入替代燃料: {obj.name}")
        else:
            print(f"未知类型: {ftype}")
            sys.exit(1)

        print(store.summary())
    except Exception as e:
        print(f"导入失败: {e}")
        print(f"  文件: {filepath}")
        print(f"  类型: {ftype}")
        print(f"  建议: 检查JSON格式是否匹配要求，参考data/目录下的样例文件")
        sys.exit(1)


def cmd_calc(args, store: DataStore):
    eq_name = args.equipment
    outdoor = args.outdoor
    water = args.water
    load = args.load

    if eq_name not in store.equipments:
        print(f"未找到设备 '{eq_name}'，已导入设备: {list(store.equipments.keys())}")
        sys.exit(1)

    eq = store.equipments[eq_name]
    result = calc_cop(eq, outdoor, water, load)

    errors = Diagnostics.check_calc_result(result, eq)
    print(format_calc_detail(result))

    if errors or args.audit:
        print()
        print(Diagnostics.format_report(errors))


def cmd_slice(args, store: DataStore):
    eq_name = args.equipment
    tc_key = args.temp_curve
    elec_name = args.electricity
    water = args.water
    load = args.load

    if eq_name not in store.equipments:
        print(f"未找到设备 '{eq_name}'")
        sys.exit(1)
    if tc_key not in store.temp_curves:
        print(f"未找到温度曲线 '{tc_key}'，可用: {list(store.temp_curves.keys())}")
        sys.exit(1)
    if elec_name not in store.electricity:
        print(f"未找到电价 '{elec_name}'")
        sys.exit(1)

    eq = store.equipments[eq_name]
    tc = store.temp_curves[tc_key]
    ed = store.electricity[elec_name]

    eq_errors = Diagnostics.check_equipment(eq)
    tc_errors = Diagnostics.check_temp_curve(tc, eq)
    all_errors = eq_errors + tc_errors
    errors_only = [e for e in all_errors if e.level == "ERROR"]
    if errors_only:
        print(Diagnostics.format_report(all_errors))
        print("\n存在错误，请修正后再计算。如需强制计算请添加 --force 参数")
        if not args.force:
            sys.exit(1)

    if args.hourly:
        results = slice_hourly(eq, tc, ed, water, load)
    else:
        results = slice_by_temp_bands(eq, tc, ed, water, load)

    print(format_slice_table(results, show_audit=args.audit))

    if all_errors:
        print()
        print(Diagnostics.format_report(all_errors))


def cmd_compare(args, store: DataStore):
    eq_names = args.equipments
    tc_key = args.temp_curve
    elec_name = args.electricity
    water = args.water
    load = args.load

    schemes = []
    for name in eq_names:
        if name not in store.equipments:
            print(f"未找到设备 '{name}'")
            sys.exit(1)
        schemes.append({"equipment": store.equipments[name]})

    if tc_key not in store.temp_curves:
        print(f"未找到温度曲线 '{tc_key}'")
        sys.exit(1)
    if elec_name not in store.electricity:
        print(f"未找到电价 '{elec_name}'")
        sys.exit(1)

    tc = store.temp_curves[tc_key]
    ed = store.electricity[elec_name]

    baseline_fuel = None
    if args.fuel and args.fuel in store.competing_fuels:
        baseline_fuel = store.competing_fuels[args.fuel]

    investment_costs = {}
    if args.investment:
        for pair in args.investment:
            parts = pair.split("=")
            if len(parts) == 2:
                investment_costs[parts[0]] = float(parts[1])

    results = compare_schemes(
        schemes, tc, ed, water, load,
        baseline_fuel=baseline_fuel,
        investment_costs=investment_costs if investment_costs else None
    )

    print(format_comparison(results, show_audit=args.audit))


def cmd_diagnose(args, store: DataStore):
    all_errors = []

    for eq in store.equipments.values():
        all_errors.extend(Diagnostics.check_equipment(eq))

    for tc in store.temp_curves.values():
        for eq in store.equipments.values():
            all_errors.extend(Diagnostics.check_temp_curve(tc, eq))

    for ed in store.electricity.values():
        all_errors.extend(Diagnostics.check_electricity(ed))

    all_errors.extend(Diagnostics.check_duplicate_imports(store))

    print(Diagnostics.format_report(all_errors))


def cmd_list(args, store: DataStore):
    print(store.summary())

    if args.equipments:
        for eq in store.equipments.values():
            print(f"\n  设备: {eq.name} (型号: {eq.model})")
            print(f"    运行范围: 室外[{eq.operating_range.outdoor_min_c}, {eq.operating_range.outdoor_max_c}]°C, 出水[{eq.operating_range.water_outlet_min_c}, {eq.operating_range.water_outlet_max_c}]°C")
            print(f"    Carnot分数: {eq.carnot_fraction or '(自动推导)'}")
            print(f"    额定工况点:")
            for rp in eq.rated_points:
                print(f"      室外{rp.outdoor_temp_c:+.0f}°C / 出水{rp.water_outlet_temp_c:.0f}°C → 制热{rp.heating_capacity_kw:.1f}kW, 压机{rp.compressor_power_kw:.1f}kW, COP={rp.cop:.2f}")

    if args.curves:
        for key, tc in store.temp_curves.items():
            print(f"\n  温度曲线: {key}")
            print(f"    地点: {tc.location}, 季节: {tc.season}, 设计温度: {tc.design_outdoor_temp_c}°C")
            print(f"    频段数: {len(tc.bins)}, 总小时: {sum(b.hours for b in tc.bins):.0f}")

    if args.electricity:
        for ed in store.electricity.values():
            print(f"\n  电价: {ed.name}")
            print(f"    有效电价: {ed.effective_rate():.4f} 元/kWh")
            if ed.flat_rate_yuan_per_kwh:
                print(f"    平电价: {ed.flat_rate_yuan_per_kwh} 元/kWh")
            if ed.time_of_use:
                for r in ed.time_of_use:
                    print(f"    分时 {r.label}: {r.price_per_kwh} 元/kWh ({r.hours_per_year}h/年)")


def cmd_run(args, store: DataStore):
    scenario_path = args.scenario
    if not os.path.exists(scenario_path):
        print(f"场景文件不存在: {scenario_path}")
        sys.exit(1)

    with open(scenario_path, "r", encoding="utf-8") as f:
        scenario = json.load(f)

    base_dir = os.path.dirname(os.path.abspath(scenario_path))

    def resolve(p):
        if os.path.isabs(p):
            return p
        return os.path.join(base_dir, p)

    print("=" * 60)
    print("  热泵COP试算台 - 批量场景运行")
    print("=" * 60)

    print("\n── 第1步: 导入材料 ──")
    for item in scenario.get("import", []):
        ftype = item["type"]
        filepath = resolve(item["file"])
        print(f"\n  导入 {ftype}: {item['file']}")
        try:
            if ftype == "equipment":
                obj = store.import_equipment(filepath)
                print(f"    ✓ 设备: {obj.name} (型号={obj.model})")
            elif ftype == "temp_curve":
                obj = store.import_temp_curve(filepath)
                print(f"    ✓ 温度曲线: {obj.location} {obj.season}")
            elif ftype == "electricity":
                obj = store.import_electricity(filepath)
                print(f"    ✓ 电价: {obj.name} (有效={obj.effective_rate():.4f} 元/kWh)")
            elif ftype == "fuel":
                obj = store.import_competing_fuel(filepath)
                print(f"    ✓ 替代燃料: {obj.name}")
        except Exception as e:
            print(f"    ✗ 导入失败: {e}")
            print(f"      文件: {filepath}")
            print(f"      建议: 检查JSON格式，参考data/样例")
            sys.exit(1)

    print(f"\n{store.summary()}")

    print("\n── 第2步: 数据诊断 ──")
    all_errors = []
    for eq in store.equipments.values():
        all_errors.extend(Diagnostics.check_equipment(eq))
    for tc in store.temp_curves.values():
        for eq in store.equipments.values():
            all_errors.extend(Diagnostics.check_temp_curve(tc, eq))
    for ed in store.electricity.values():
        all_errors.extend(Diagnostics.check_electricity(ed))
    all_errors.extend(Diagnostics.check_duplicate_imports(store))

    print(Diagnostics.format_report(all_errors))
    errors_only = [e for e in all_errors if e.level == "ERROR"]
    if errors_only and not args.force:
        print("\n存在错误，中止运行。请修正后重试，或使用 --force 强制继续")
        sys.exit(1)

    water = scenario.get("water_outlet_temp_c", 45.0)
    load = scenario.get("heating_load_kw", 100.0)

    print(f"\n── 第3步: 单点COP验证 ──")
    for point in scenario.get("verify_points", []):
        eq_name = point.get("equipment") or list(store.equipments.keys())[0]
        if eq_name not in store.equipments:
            print(f"  设备 '{eq_name}' 未找到，跳过")
            continue
        eq = store.equipments[eq_name]
        t_out = point["outdoor_temp_c"]
        t_water = point.get("water_outlet_temp_c", water)
        result = calc_cop(eq, t_out, t_water, load)
        print(format_calc_detail(result))
        print()

    print("── 第4步: 工况切片 ──")
    tc_key = scenario.get("temp_curve_key") or list(store.temp_curves.keys())[0]
    elec_name = scenario.get("electricity_name") or list(store.electricity.keys())[0]
    for eq_name in scenario.get("slice_equipments", list(store.equipments.keys())):
        if eq_name not in store.equipments:
            print(f"  设备 '{eq_name}' 未找到，跳过")
            continue
        print(f"\n  设备: {eq_name}, 温度曲线: {tc_key}, 电价: {elec_name}")
        eq = store.equipments[eq_name]
        tc = store.temp_curves[tc_key]
        ed = store.electricity[elec_name]
        slices = slice_by_temp_bands(eq, tc, ed, water, load)
        print(format_slice_table(slices, show_audit=args.audit))
        print()

    print("── 第5步: 方案费用对比 ──")
    eq_names = scenario.get("compare_equipments", list(store.equipments.keys()))
    schemes = []
    for name in eq_names:
        if name in store.equipments:
            schemes.append({"equipment": store.equipments[name]})

    if schemes and tc_key in store.temp_curves and elec_name in store.electricity:
        tc = store.temp_curves[tc_key]
        ed = store.electricity[elec_name]
        baseline_fuel = None
        fuel_name = scenario.get("baseline_fuel")
        if fuel_name and fuel_name in store.competing_fuels:
            baseline_fuel = store.competing_fuels[fuel_name]
        investment_costs = scenario.get("investment_costs")

        results = compare_schemes(
            schemes, tc, ed, water, load,
            baseline_fuel=baseline_fuel,
            investment_costs=investment_costs
        )
        print(format_comparison(results, show_audit=args.audit))
    else:
        print("  数据不足，跳过对比")

    print("\n" + "=" * 60)
    print("  场景运行完毕")
    print("=" * 60)


def _load_data_files(args, store: DataStore):
    data_files = getattr(args, 'data', None) or []
    for df in data_files:
        if not os.path.exists(df):
            print(f"数据文件不存在: {df}")
            sys.exit(1)
        with open(df, "r", encoding="utf-8") as f:
            raw = json.load(f)
        if "rated_points" in raw and "operating_range" in raw:
            store.import_equipment(df)
        elif "bins" in raw and "location" in raw:
            store.import_temp_curve(df)
        elif "energy_per_unit_kwh" in raw:
            store.import_competing_fuel(df)
        elif "flat_rate_yuan_per_kwh" in raw or "time_of_use" in raw:
            store.import_electricity(df)
        else:
            print(f"无法识别数据文件类型: {df}")
            sys.exit(1)


def main():
    parser = argparse.ArgumentParser(
        prog="cop_studio",
        description="热泵COP试算台 - 暖通工程师方案比较工具"
    )
    sub = parser.add_subparsers(dest="command", help="子命令")

    p_import = sub.add_parser("import", help="导入材料数据")
    p_import.add_argument("type", choices=["equipment", "temp_curve", "electricity", "fuel"], help="数据类型")
    p_import.add_argument("file", help="JSON文件路径")

    p_calc = sub.add_parser("calc", help="计算单点COP")
    p_calc.add_argument("--equipment", "-e", required=True, help="设备名称")
    p_calc.add_argument("--outdoor", "-t", type=float, required=True, help="室外温度(°C)")
    p_calc.add_argument("--water", "-w", type=float, required=True, help="出水温度(°C)")
    p_calc.add_argument("--load", "-l", type=float, default=None, help="热负荷(kW)")
    p_calc.add_argument("--data", "-d", nargs="*", default=[], help="预先加载的数据文件(自动识别类型)")
    p_calc.add_argument("--audit", action="store_true", help="显示审计轨迹")

    p_slice = sub.add_parser("slice", help="工况切片")
    p_slice.add_argument("--equipment", "-e", required=True)
    p_slice.add_argument("--temp-curve", "-c", required=True, help="温度曲线键名(地点_季节)")
    p_slice.add_argument("--electricity", "-p", required=True, help="电价名称")
    p_slice.add_argument("--water", "-w", type=float, required=True, help="出水温度(°C)")
    p_slice.add_argument("--load", "-l", type=float, required=True, help="热负荷(kW)")
    p_slice.add_argument("--data", "-d", nargs="*", default=[], help="预先加载的数据文件")
    p_slice.add_argument("--hourly", action="store_true", help="逐频段输出")
    p_slice.add_argument("--force", action="store_true", help="忽略错误强制计算")
    p_slice.add_argument("--audit", action="store_true", help="显示审计轨迹")

    p_compare = sub.add_parser("compare", help="方案费用对比")
    p_compare.add_argument("--equipments", "-e", nargs="+", required=True, help="设备名称(可多个)")
    p_compare.add_argument("--temp-curve", "-c", required=True)
    p_compare.add_argument("--electricity", "-p", required=True)
    p_compare.add_argument("--water", "-w", type=float, required=True, help="出水温度(°C)")
    p_compare.add_argument("--load", "-l", type=float, required=True, help="热负荷(kW)")
    p_compare.add_argument("--fuel", "-f", default=None, help="替代燃料名称")
    p_compare.add_argument("--investment", "-i", nargs="*", default=None, help="投资额 设备名=金额")
    p_compare.add_argument("--data", "-d", nargs="*", default=[], help="预先加载的数据文件")
    p_compare.add_argument("--audit", action="store_true", help="显示审计轨迹")

    p_diag = sub.add_parser("diagnose", help="诊断已导入数据")
    p_diag.add_argument("--data", "-d", nargs="*", default=[], help="预先加载的数据文件")

    p_list = sub.add_parser("list", help="列出已导入数据")
    p_list.add_argument("--data", "-d", nargs="*", default=[], help="预先加载的数据文件")
    p_list.add_argument("--equipments", action="store_true", help="显示设备详情")
    p_list.add_argument("--curves", action="store_true", help="显示温度曲线详情")
    p_list.add_argument("--electricity", action="store_true", help="显示电价详情")

    p_run = sub.add_parser("run", help="批量运行场景")
    p_run.add_argument("scenario", help="场景JSON文件路径")
    p_run.add_argument("--force", action="store_true", help="忽略错误强制运行")
    p_run.add_argument("--audit", action="store_true", help="显示审计轨迹")

    args = parser.parse_args()
    store = DataStore()

    if args.command is None:
        parser.print_help()
        sys.exit(0)

    _load_data_files(args, store)

    if args.command == "import":
        cmd_import(args, store)
    elif args.command == "calc":
        cmd_calc(args, store)
    elif args.command == "slice":
        cmd_slice(args, store)
    elif args.command == "compare":
        cmd_compare(args, store)
    elif args.command == "diagnose":
        cmd_diagnose(args, store)
    elif args.command == "list":
        cmd_list(args, store)
    elif args.command == "run":
        cmd_run(args, store)


if __name__ == "__main__":
    main()
