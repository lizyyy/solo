"""CLI入口 - 酸碱滴定数据处理工具"""

import argparse
import json
import os
import sys
from pathlib import Path
from typing import List, Optional

from .models import default_experiment_config, ExperimentConfig
from . import parser as data_parser
from . import calculation
from . import buffer_solver
from . import reporter


def load_config(config_path: Optional[str] = None) -> ExperimentConfig:
    """加载实验配置，如果不存在则使用默认配置"""
    if config_path and os.path.exists(config_path):
        try:
            import yaml
            with open(config_path, 'r', encoding='utf-8') as f:
                config_dict = yaml.safe_load(f)
            config = default_experiment_config()
            if 'experiment_name' in config_dict:
                config.experiment_name = config_dict['experiment_name']
            if 'analyst' in config_dict:
                config.analyst = config_dict['analyst']
            if 'analysis_params' in config_dict:
                params = config_dict['analysis_params']
                for key, value in params.items():
                    if hasattr(config.analysis_params, key):
                        setattr(config.analysis_params, key, value)
            return config
        except Exception as e:
            print(f"警告: 无法加载配置文件 {config_path}: {e}，使用默认配置")
            return default_experiment_config()
    return default_experiment_config()


def save_config(config: ExperimentConfig, output_path: str):
    """保存配置为YAML文件"""
    try:
        import yaml
        config_dict = {
            'experiment_name': config.experiment_name,
            'created_at': config.created_at.isoformat(),
            'analyst': config.analyst,
            'analysis_params': {
                'smoothing_window': config.analysis_params.smoothing_window,
                'smoothing_polyorder': config.analysis_params.smoothing_polyorder,
                'equivalence_point_method': config.analysis_params.equivalence_point_method,
                'derivative_threshold': config.analysis_params.derivative_threshold,
                'outlier_method': config.analysis_params.outlier_method,
                'outlier_iqr_factor': config.analysis_params.outlier_iqr_factor,
                'blank_correction_enabled': config.analysis_params.blank_correction_enabled,
            },
            'notes': config.notes,
        }
        with open(output_path, 'w', encoding='utf-8') as f:
            yaml.dump(config_dict, f, allow_unicode=True, default_flow_style=False, sort_keys=False)
        print(f"配置已保存到: {output_path}")
    except ImportError:
        print("警告: PyYAML未安装，无法保存为YAML格式。尝试保存为JSON...")
        with open(output_path.replace('.yaml', '.json'), 'w', encoding='utf-8') as f:
            json.dump(config_dict, f, ensure_ascii=False, indent=2)
        print(f"配置已保存到: {output_path.replace('.yaml', '.json')}")


def cmd_init(args):
    """init命令处理 - 创建实验配置"""
    output = args.output or 'experiment_config.yaml'
    config = default_experiment_config()
    
    if args.name:
        config.experiment_name = args.name
    if args.analyst:
        config.analyst = args.analyst
    
    save_config(config, output)
    print(f"\n已创建实验配置: {output}")
    print("默认分析参数:")
    print(f"  - 平滑窗口大小: {config.analysis_params.smoothing_window}")
    print(f"  - 等当点检测方法: {config.analysis_params.equivalence_point_method}")
    print(f"  - 离群点检测因子: {config.analysis_params.outlier_iqr_factor}")
    print("\n可用缓冲体系:")
    for name, system in config.buffer_systems.items():
        print(f"  - {name}: {system.name} (pH {system.effective_ph_range[0]}-{system.effective_ph_range[1]})")


def cmd_import(args):
    """import命令处理 - 导入滴定CSV数据"""
    config = load_config(args.config)
    files = args.files
    output = args.output or 'import_results.json'
    
    print(f"开始导入 {len(files)} 个文件...")
    results = []
    
    for file_path in files:
        print(f"处理: {file_path}")
        result = data_parser.parse_titration_csv(file_path)
        results.append(result)
        
        if result.success:
            print(f"  ✓ 成功: 样品 {result.sample_id}, {result.point_count} 个数据点")
            if result.warnings:
                for warning in result.warnings:
                    print(f"  ⚠  警告: {warning}")
        else:
            print(f"  ✗ 失败: {result.errors[0] if result.errors else '未知错误'}")
    
    success_count = sum(1 for r in results if r.success)
    print(f"\n导入完成: {success_count}/{len(results)} 成功")
    
    output_data = {
        'import_time': data_parser.datetime.now().isoformat(),
        'total_files': len(files),
        'success_count': success_count,
        'results': []
    }
    
    for result in results:
        result_dict = {
            'file_path': result.file_path,
            'sample_id': result.sample_id,
            'success': result.success,
            'point_count': result.point_count,
            'errors': result.errors,
            'warnings': result.warnings,
        }
        if result.curve:
            result_dict['curve_summary'] = {
                'sample_id': result.curve.sample_id,
                'sample_type': result.curve.sample_type.value,
                'point_count': len(result.curve.points),
                'temperature': result.curve.temperature,
                'initial_ph': result.curve.initial_ph,
                'final_ph': result.curve.final_ph,
                'min_ph': result.curve.min_ph,
                'max_ph': result.curve.max_ph,
            }
            result_dict['points'] = [
                {'volume': p.volume, 'ph': p.ph, 'temperature': p.temperature, 'index': p.index}
                for p in result.curve.points
            ]
        output_data['results'].append(result_dict)
    
    with open(output, 'w', encoding='utf-8') as f:
        json.dump(output_data, f, ensure_ascii=False, indent=2)
    print(f"结果已保存到: {output}")
    
    return output_data


def cmd_fit(args):
    """fit命令处理 - 拟合分析"""
    config = load_config(args.config)
    
    if args.data and os.path.exists(args.data):
        with open(args.data, 'r', encoding='utf-8') as f:
            import_data = json.load(f)
        curves_data = [r for r in import_data.get('results', []) if r.get('success')]
        print(f"从导入数据加载 {len(curves_data)} 条曲线")
    else:
        print("错误: 需要提供--data参数指定导入的JSON数据")
        sys.exit(1)
    
    output = args.output or 'fitted_results.json'
    blank_sample = args.blank
    
    print(f"\n开始拟合分析...")
    print(f"分析参数:")
    print(f"  - 平滑窗口: {config.analysis_params.smoothing_window}")
    print(f"  - 等当点方法: {config.analysis_params.equivalence_point_method}")
    print(f"  - 空白校正: {'启用' if config.analysis_params.blank_correction_enabled else '禁用'}")
    if blank_sample:
        print(f"  - 空白样品: {blank_sample}")
    
    fit_results = []
    blank_curve = None
    
    for curve_data in curves_data:
        sample_id = curve_data.get('sample_id', 'unknown')
        
        points = []
        for i, p in enumerate(curve_data.get('points', [])):
            points.append(calculation.TitrationPoint(
                volume=p.get('volume', 0),
                ph=p.get('ph', 0),
                temperature=p.get('temperature'),
                index=i,
            ))
        
        curve_summary = curve_data.get('curve_summary', {})
        curve = calculation.TitrationCurve(
            sample_id=sample_id,
            points=points,
            temperature=curve_summary.get('temperature'),
            source_file=curve_data.get('file_path', ''),
        )
        
        if blank_sample and sample_id == blank_sample:
            blank_curve = curve
            print(f"\n识别为空白样品: {sample_id}")
            continue
        
        print(f"\n拟合分析: {sample_id}")
        
        fit_result = calculation.analyze_titration_curve(
            curve=curve,
            params=config.analysis_params,
            blank_curve=blank_curve if config.analysis_params.blank_correction_enabled else None,
        )
        
        fit_results.append(fit_result)
        
        print(f"  数据质量: {fit_result.quality.value}")
        if fit_result.primary_equivalence:
            ep = fit_result.primary_equivalence
            print(f"  主要等当点: 体积={ep.volume:.4f} mL, pH={ep.ph:.2f}")
        if fit_result.outlier_count > 0:
            print(f"  离群点数量: {fit_result.outlier_count}")
        for warning in fit_result.warnings:
            print(f"  ⚠  警告: {warning}")
    
    output_data = {
        'fit_time': data_parser.datetime.now().isoformat(),
        'parameters': {
            'smoothing_window': config.analysis_params.smoothing_window,
            'smoothing_polyorder': config.analysis_params.smoothing_polyorder,
            'equivalence_point_method': config.analysis_params.equivalence_point_method,
            'blank_correction_enabled': config.analysis_params.blank_correction_enabled,
            'blank_sample': blank_sample,
        },
        'results': []
    }
    
    for fit_result in fit_results:
        result_dict = {
            'sample_id': fit_result.sample_id,
            'blank_corrected': fit_result.blank_corrected,
            'blank_volume': fit_result.blank_volume,
            'quality': fit_result.quality.value,
            'outlier_count': fit_result.outlier_count,
            'outliers': fit_result.outliers,
            'warnings': fit_result.warnings,
            'statistics': fit_result.statistics,
        }
        
        if fit_result.primary_equivalence:
            ep = fit_result.primary_equivalence
            result_dict['primary_equivalence'] = {
                'volume': ep.volume,
                'ph': ep.ph,
                'method': ep.method,
                'index': ep.index,
                'derivative_value': ep.derivative_value,
                'confidence': ep.confidence,
            }
        
        result_dict['equivalence_points'] = [
            {
                'volume': ep.volume,
                'ph': ep.ph,
                'method': ep.method,
                'index': ep.index,
                'derivative_value': ep.derivative_value,
                'confidence': ep.confidence,
            }
            for ep in fit_result.equivalence_points
        ]
        
        if fit_result.smoothed_curve:
            result_dict['smoothed_points'] = [
                {'volume': p.volume, 'ph': p.ph}
                for p in fit_result.smoothed_curve.points
            ]
        
        output_data['results'].append(result_dict)
    
    with open(output, 'w', encoding='utf-8') as f:
        json.dump(output_data, f, ensure_ascii=False, indent=2)
    print(f"\n拟合结果已保存到: {output}")
    
    return output_data


def cmd_buffer(args):
    """buffer命令处理 - 缓冲液配方计算"""
    config = load_config(args.config)
    
    if args.list_systems:
        print("\n可用缓冲体系:")
        for name, system in config.buffer_systems.items():
            print(f"\n【{name}】{system.name}")
            print(f"  有效pH范围: {system.effective_ph_range[0]} - {system.effective_ph_range[1]}")
            print(f"  描述: {system.description}")
            print(f"  酸组分: {system.acid.name} ({system.acid.formula}, {system.acid.concentration} {system.acid.concentration_unit})")
            print(f"  碱组分: {system.base.name} ({system.base.formula}, {system.base.concentration} {system.base.concentration_unit})")
            if system.acid.pka:
                print(f"  pKa值: {', '.join(map(str, system.acid.pka))}")
        return
    
    if args.ph is None or args.volume is None:
        print("错误: 缓冲液配方计算需要 --ph 和 --volume 参数")
        sys.exit(1)
    
    target_ph = args.ph
    target_volume = args.volume
    temperature = args.temperature or 25.0
    system_name = args.system
    output = args.output or 'buffer_formula.json'
    
    if system_name and system_name not in config.buffer_systems:
        print(f"错误: 未知的缓冲体系 '{system_name}'")
        print(f"可用体系: {', '.join(config.buffer_systems.keys())}")
        sys.exit(1)
    
    if not system_name:
        best_system = None
        best_distance = float('inf')
        
        for name, system in config.buffer_systems.items():
            ph_min, ph_max = system.effective_ph_range
            if ph_min <= target_ph <= ph_max:
                if system.acid.pka:
                    closest_pka = min(system.acid.pka, key=lambda p: abs(p - target_ph))
                    distance = abs(closest_pka - target_ph)
                    if distance < best_distance:
                        best_distance = distance
                        best_system = name
        
        if best_system:
            system_name = best_system
            print(f"自动选择缓冲体系: {system_name} (目标pH={target_ph:.2f} 在有效范围内)")
        else:
            print(f"警告: 目标pH={target_ph:.2f} 不在任何缓冲体系的有效范围内")
            for name, system in config.buffer_systems.items():
                ph_min, ph_max = system.effective_ph_range
                print(f"  {name}: {ph_min} - {ph_max}")
            print("请使用 --system 参数手动选择体系，或调整目标pH")
            sys.exit(1)
    
    buffer_system = config.buffer_systems[system_name]
    
    print(f"\n缓冲液配方计算:")
    print(f"  目标pH: {target_ph:.2f}")
    print(f"  目标体积: {target_volume:.1f} mL")
    print(f"  温度: {temperature:.1f}°C")
    print(f"  缓冲体系: {system_name} ({buffer_system.name})")
    
    recipe = buffer_solver.calculate_buffer_recipe(
        target_ph=target_ph,
        target_volume=target_volume,
        buffer_system=buffer_system,
        temperature=temperature,
    )
    
    print(f"\n【配方结果】")
    print(f"  理论pH: {recipe.theoretical_ph:.3f}")
    print(f"  pH偏差: {recipe.ph_deviation:.4f}")
    print(f"  缓冲容量: {recipe.buffer_capacity:.6f} mol/(L·pH)")
    
    print(f"\n【组分用量】")
    print(f"  酸 ({buffer_system.acid.name}):")
    print(f"    体积: {recipe.acid_volume:.2f} mL")
    if recipe.acid_mass:
        print(f"    质量: {recipe.acid_mass:.4f} g")
    print(f"  碱 ({buffer_system.base.name}):")
    print(f"    体积: {recipe.base_volume:.2f} mL")
    if recipe.base_mass:
        print(f"    质量: {recipe.base_mass:.4f} g")
    print(f"  加水至: {target_volume:.1f} mL")
    
    if recipe.warnings:
        print(f"\n【警告】")
        for warning in recipe.warnings:
            print(f"  ⚠  {warning}")
    
    if recipe.is_outside_optimal_range:
        print(f"\n  ⚠  注意: 目标pH在缓冲体系最佳范围之外，缓冲能力可能较弱")
    
    output_data = {
        'calculation_time': data_parser.datetime.now().isoformat(),
        'target_ph': target_ph,
        'target_volume': target_volume,
        'temperature': temperature,
        'system_name': system_name,
        'system_info': {
            'name': buffer_system.name,
            'effective_ph_range': list(buffer_system.effective_ph_range),
            'description': buffer_system.description,
            'acid': {
                'name': buffer_system.acid.name,
                'formula': buffer_system.acid.formula,
                'concentration': buffer_system.acid.concentration,
                'concentration_unit': buffer_system.acid.concentration_unit,
                'pka': buffer_system.acid.pka,
            },
            'base': {
                'name': buffer_system.base.name,
                'formula': buffer_system.base.formula,
                'concentration': buffer_system.base.concentration,
                'concentration_unit': buffer_system.base.concentration_unit,
                'pka': buffer_system.base.pka,
            },
        },
        'recipe': {
            'acid_volume': recipe.acid_volume,
            'base_volume': recipe.base_volume,
            'acid_mass': recipe.acid_mass,
            'base_mass': recipe.base_mass,
            'theoretical_ph': recipe.theoretical_ph,
            'buffer_capacity': recipe.buffer_capacity,
            'ph_deviation': recipe.ph_deviation,
            'warnings': recipe.warnings,
            'is_outside_optimal_range': recipe.is_outside_optimal_range,
        },
        'instructions': [
            f"1. 量取 {recipe.acid_volume:.2f} mL {buffer_system.acid.name}",
            f"2. 量取 {recipe.base_volume:.2f} mL {buffer_system.base.name}",
            f"3. 混合后用去离子水定容至 {target_volume:.1f} mL",
            f"4. 充分混匀后，使用pH计验证实际pH值",
        ],
    }
    
    with open(output, 'w', encoding='utf-8') as f:
        json.dump(output_data, f, ensure_ascii=False, indent=2)
    print(f"\n配方已保存到: {output}")
    
    return output_data


def cmd_report(args):
    """report命令处理 - 生成报告"""
    config = load_config(args.config)
    output_dir = args.output or 'report'
    
    os.makedirs(output_dir, exist_ok=True)
    
    print(f"\n生成实验报告...")
    print(f"输出目录: {output_dir}")
    
    fitted_data = None
    if args.fitted and os.path.exists(args.fitted):
        with open(args.fitted, 'r', encoding='utf-8') as f:
            fitted_data = json.load(f)
        print(f"已加载拟合数据: {args.fitted}")
    
    buffer_data = None
    if args.buffer and os.path.exists(args.buffer):
        with open(args.buffer, 'r', encoding='utf-8') as f:
            buffer_data = json.load(f)
        print(f"已加载缓冲液配方: {args.buffer}")
    
    if not fitted_data and not buffer_data:
        print("警告: 未提供拟合数据或缓冲液配方，报告将仅包含基本信息")
    
    report_files = reporter.generate_report(
        config=config,
        fitted_data=fitted_data,
        buffer_data=buffer_data,
        output_dir=output_dir,
        generate_plots=args.plots,
    )
    
    print(f"\n报告生成完成!")
    print(f"生成的文件:")
    for name, path in report_files.items():
        print(f"  - {name}: {path}")
    
    return report_files


def main():
    """主入口函数"""
    parser = argparse.ArgumentParser(
        prog='titration',
        description='酸碱滴定数据处理工具 - 支持数据导入、拟合、缓冲液配方计算和报告导出',
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    
    parser.add_argument('--version', action='version', version=f'%(prog)s 0.1.0')
    
    subparsers = parser.add_subparsers(dest='command', help='可用命令')
    
    init_parser = subparsers.add_parser('init', help='初始化实验配置')
    init_parser.add_argument('--output', '-o', type=str, help='输出配置文件路径 (默认: experiment_config.yaml)')
    init_parser.add_argument('--name', '-n', type=str, help='实验名称')
    init_parser.add_argument('--analyst', '-a', type=str, help='分析人员')
    init_parser.set_defaults(func=cmd_init)
    
    import_parser = subparsers.add_parser('import', help='导入滴定CSV数据')
    import_parser.add_argument('files', nargs='+', help='CSV文件路径')
    import_parser.add_argument('--config', '-c', type=str, help='实验配置文件路径')
    import_parser.add_argument('--output', '-o', type=str, help='输出JSON文件路径 (默认: import_results.json)')
    import_parser.set_defaults(func=cmd_import)
    
    fit_parser = subparsers.add_parser('fit', help='拟合分析 - 空白校正、平滑、等当点识别、离群点标记')
    fit_parser.add_argument('--data', '-d', type=str, required=True, help='导入的JSON数据文件路径')
    fit_parser.add_argument('--config', '-c', type=str, help='实验配置文件路径')
    fit_parser.add_argument('--blank', '-b', type=str, help='空白样品名称 (用于空白校正)')
    fit_parser.add_argument('--output', '-o', type=str, help='输出JSON文件路径 (默认: fitted_results.json)')
    fit_parser.set_defaults(func=cmd_fit)
    
    buffer_parser = subparsers.add_parser('buffer', help='缓冲液配方计算')
    buffer_parser.add_argument('--ph', type=float, help='目标pH值')
    buffer_parser.add_argument('--volume', '-v', type=float, help='目标体积 (mL)')
    buffer_parser.add_argument('--temperature', '-t', type=float, default=25.0, help='温度 (°C, 默认: 25.0)')
    buffer_parser.add_argument('--system', '-s', type=str, help='缓冲体系名称 (默认自动选择)')
    buffer_parser.add_argument('--list-systems', action='store_true', help='列出所有可用缓冲体系')
    buffer_parser.add_argument('--config', '-c', type=str, help='实验配置文件路径')
    buffer_parser.add_argument('--output', '-o', type=str, help='输出JSON文件路径 (默认: buffer_formula.json)')
    buffer_parser.set_defaults(func=cmd_buffer)
    
    report_parser = subparsers.add_parser('report', help='生成实验报告')
    report_parser.add_argument('--fitted', '-f', type=str, help='拟合结果JSON文件')
    report_parser.add_argument('--buffer', '-b', type=str, help='缓冲液配方JSON文件')
    report_parser.add_argument('--config', '-c', type=str, help='实验配置文件路径')
    report_parser.add_argument('--output', '-o', type=str, help='输出目录 (默认: report)')
    report_parser.add_argument('--plots', '-p', action='store_true', help='生成滴定曲线图 (需要matplotlib)')
    report_parser.set_defaults(func=cmd_report)
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        sys.exit(0)
    
    args.func(args)


if __name__ == '__main__':
    main()
