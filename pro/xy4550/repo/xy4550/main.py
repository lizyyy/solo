"""
岩土实验室三轴试验复核工具
主命令行入口
"""
import argparse
import sys
import os
from typing import Dict, Any

# 添加项目根目录到路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from test_manager import TestManager
from tabulate import tabulate


def print_header():
    """打印工具标题"""
    print("=" * 60)
    print("        岩土实验室三轴试验复核工具")
    print("        Triaxial Test Review Tool")
    print("=" * 60)
    print()


def list_tests(manager: TestManager):
    """列出所有可用的试验"""
    print("📋 可用试验列表:")
    print()
    
    # 从试样登记获取所有试验
    if manager.data_loader.sample_registry is not None:
        df = manager.data_loader.sample_registry
        table_data = []
        for _, row in df.iterrows():
            table_data.append([
                row['test_id'],
                row['sample_name'],
                row['soil_type'],
                row['depth'],
                row['test_date'],
                row['operator']
            ])
        
        headers = ['试验编号', '试样名称', '土类', '埋深(m)', '试验日期', '操作人员']
        print(tabulate(table_data, headers=headers, tablefmt='grid'))
    else:
        print("  未加载试样登记数据")
    print()


def process_test(manager: TestManager, test_id: str, 
                 override_peak: float = None,
                 override_residual: float = None,
                 override_failure_strain: float = None,
                 manual_judgment: str = None,
                 remarks: str = None):
    """处理单个试验"""
    print(f"🔍 正在处理试验: {test_id}")
    print()
    
    try:
        result = manager.process_test(
            test_id,
            override_peak_stress=override_peak,
            override_residual_stress=override_residual,
            override_failure_strain=override_failure_strain,
            manual_judgment=manual_judgment,
            manual_remarks=remarks
        )
        
        print_processing_result(result)
        return result
        
    except Exception as e:
        print(f"❌ 处理失败: {str(e)}")
        import traceback
        traceback.print_exc()
        return None


def print_processing_result(result: Dict[str, Any]):
    """打印处理结果"""
    if not result:
        return
    
    print("✅ 处理完成!")
    print()
    
    # 基本信息
    sample_info = result.get('sample_info', {})
    if sample_info:
        print("📝 试样基本信息:")
        print(f"  - 试样编号: {sample_info.get('sample_id', '-')}")
        print(f"  - 试样名称: {sample_info.get('sample_name', '-')}")
        print(f"  - 土类: {sample_info.get('soil_type', '-')}")
        print(f"  - 埋深: {sample_info.get('depth', '-')} m")
        print()
    
    # 强度参数
    calc = result.get('calculations', {})
    
    print("📊 强度参数计算结果:")
    peak = calc.get('peak_strength', {})
    residual = calc.get('residual_strength', {})
    
    table_data = []
    table_data.append(['峰值强度', f"{peak.get('peak_stress_kPa', '-')} kPa", f"应变: {peak.get('peak_strain_percent', '-')} %"])
    table_data.append(['残余强度', f"{residual.get('residual_stress_kPa', '-')} kPa", f"方法: {residual.get('method', '-')}"])
    
    print(tabulate(table_data, headers=['参数', '数值', '备注'], tablefmt='simple'))
    print()
    
    # 破坏时刻
    failure = calc.get('failure_point', {})
    recommended = failure.get('recommended_failure', {})
    if recommended:
        print("⏰ 破坏时刻识别:")
        print(f"  - 推荐准则: {recommended.get('criterion', '-')}")
        print(f"  - 破坏应变: {recommended.get('strain_percent', '-')} %")
        print(f"  - 破坏应力: {recommended.get('stress_kPa', '-')} kPa")
        print()
    
    # 孔压异常
    pp_anomaly = calc.get('pore_pressure_anomaly', {})
    print("💧 孔压异常检测:")
    if pp_anomaly.get('has_anomalies'):
        print(f"  ⚠️ 检测到 {pp_anomaly.get('anomaly_count', 0)} 处异常")
        print(f"     高严重度: {pp_anomaly.get('high_severity_count', 0)} 处")
    else:
        print(f"  ✅ 未检测到异常")
    print()
    
    # 饱和度
    saturation = calc.get('saturation', {})
    if saturation:
        print("🌊 饱和度检查:")
        status = "✅" if saturation.get('is_saturated') else "❌"
        print(f"  {status} B值: {saturation.get('b_value', '-')} (阈值: {saturation.get('threshold', '-')})")
        print(f"     状态: {saturation.get('status', '-')}")
        print()
    
    # 仪器校准
    calibration = calc.get('instrument_calibration', {})
    if calibration:
        print("🔧 仪器校准检查:")
        inst_info = calibration.get('instrument_info', {})
        risk_status = {
            '高风险': '🔴',
            '中风险': '🟡',
            '低风险': '🟢',
            '无风险': '✅'
        }.get(calibration.get('risk_level'), '❓')
        
        print(f"  {risk_status} 仪器: {inst_info.get('instrument_name', '-')} ({inst_info.get('instrument_id', '-')})")
        print(f"     校准日期: {calibration.get('calibration_date', '-')}")
        print(f"     有效期至: {calibration.get('expiry_date', '-')}")
        print(f"     距过期: {calibration.get('days_until_expiry', '-')} 天")
        print(f"     状态: {calibration.get('status', '-')}")
        print()
    
    # 人工改判
    manual = result.get('manual_overrides', {})
    if manual:
        print("✏️ 人工改判记录:")
        for key, value in manual.items():
            if key == 'judgment':
                print(f"  - 人工判定: {value.get('value', '-')}")
            elif key == 'remarks':
                print(f"  - 人工备注: {value.get('value', '-')}")
            elif key == 'peak_stress':
                print(f"  - 峰值强度: {value.get('original', '-')} → {value.get('override', '-')} kPa")
            elif key == 'residual_stress':
                print(f"  - 残余强度: {value.get('original', '-')} → {value.get('override', '-')} kPa")
            elif key == 'failure_strain':
                print(f"  - 破坏应变: {value.get('original', '-')} → {value.get('override', '-')} %")
        print()
    
    # 最终判定
    final = result.get('final_judgment', {})
    print("🏁 最终判定:")
    
    status_icon = {
        '合格': '✅',
        '不合格': '❌',
        '需人工复核': '⚠️',
        '待复核': '⏳'
    }.get(final.get('overall_status'), '❓')
    
    risk_icon = {
        '高': '🔴',
        '中': '🟡',
        '低': '🟢'
    }.get(final.get('risk_level'), '❓')
    
    print(f"  整体状态: {status_icon} {final.get('overall_status', '-')}")
    print(f"  风险等级: {risk_icon} {final.get('risk_level', '-')}")
    print(f"  自动判定: {final.get('auto_judgment', '-')}")
    print(f"  最终判定: {final.get('final_judgment', '-')}")
    print()
    
    # 问题和警告
    issues = final.get('issues', [])
    warnings = final.get('warnings', [])
    recommendations = final.get('recommendations', [])
    
    if issues:
        print("❌ 问题:")
        for i, issue in enumerate(issues, 1):
            print(f"  {i}. {issue}")
        print()
    
    if warnings:
        print("⚠️ 警告:")
        for i, warning in enumerate(warnings, 1):
            print(f"  {i}. {warning}")
        print()
    
    if recommendations:
        print("💡 建议:")
        for i, rec in enumerate(recommendations, 1):
            print(f"  {i}. {rec}")
        print()


def export_results(manager: TestManager, test_id: str, 
                   markdown: bool = True,
                   json: bool = True,
                   output_dir: str = None):
    """导出结果"""
    print(f"📤 正在导出试验 {test_id} 的结果...")
    print()
    
    exported_files = []
    
    try:
        if markdown:
            md_path = manager.export_to_markdown(test_id, output_dir)
            exported_files.append(('Markdown复核单', md_path))
            print(f"  ✅ Markdown复核单已导出: {md_path}")
        
        if json:
            json_path = manager.export_to_json(test_id, output_dir)
            exported_files.append(('JSON明细', json_path))
            print(f"  ✅ JSON明细已导出: {json_path}")
        
        print()
        print("📦 导出完成!")
        print()
        
        return exported_files
        
    except Exception as e:
        print(f"❌ 导出失败: {str(e)}")
        import traceback
        traceback.print_exc()
        return None


def interactive_mode(manager: TestManager):
    """交互模式"""
    print("🎮 进入交互模式")
    print("输入 'help' 查看可用命令，'quit' 退出")
    print()
    
    while True:
        try:
            cmd = input("triaxial> ").strip()
            
            if not cmd:
                continue
            
            parts = cmd.split()
            command = parts[0].lower()
            
            if command in ['quit', 'exit', 'q']:
                print("👋 再见!")
                break
            
            elif command == 'help':
                print_help()
            
            elif command == 'list':
                list_tests(manager)
            
            elif command == 'process':
                if len(parts) < 2:
                    print("❌ 请指定试验编号: process <test_id>")
                    print("   例如: process T001")
                else:
                    process_test(manager, parts[1])
            
            elif command == 'export':
                if len(parts) < 2:
                    print("❌ 请指定试验编号: export <test_id> [--md|--json]")
                    print("   例如: export T001")
                else:
                    test_id = parts[1]
                    md = True
                    js = True
                    if '--md' in parts:
                        js = False
                    if '--json' in parts:
                        md = False
                    export_results(manager, test_id, md, js)
            
            elif command == 'show':
                if len(parts) < 2:
                    print("❌ 请指定试验编号: show <test_id>")
                else:
                    result = manager.get_processed_test(parts[1])
                    if result:
                        print_processing_result(result)
                    else:
                        print(f"❌ 未找到试验 {parts[1]} 的处理数据")
            
            elif command == 'judge':
                if len(parts) < 3:
                    print("❌ 用法: judge <test_id> <judgment> [remarks]")
                    print("   judgment: 合格/不合格/需复核")
                    print("   例如: judge T001 合格 数据正常")
                else:
                    test_id = parts[1]
                    judgment = parts[2]
                    remarks = ' '.join(parts[3:]) if len(parts) > 3 else None
                    
                    result = manager.update_manual_judgment(
                        test_id,
                        manual_judgment=judgment,
                        manual_remarks=remarks
                    )
                    if result:
                        print(f"✅ 已更新人工判定")
                        print_processing_result(result)
            
            elif command == 'override':
                if len(parts) < 4:
                    print("❌ 用法: override <test_id> <type> <value>")
                    print("   type: peak|residual|strain")
                    print("   例如: override T001 peak 380.0")
                else:
                    test_id = parts[1]
                    override_type = parts[2].lower()
                    try:
                        value = float(parts[3])
                    except ValueError:
                        print("❌ 数值格式错误")
                        continue
                    
                    kwargs = {}
                    if override_type == 'peak':
                        kwargs['override_peak_stress'] = value
                    elif override_type == 'residual':
                        kwargs['override_residual_stress'] = value
                    elif override_type == 'strain':
                        kwargs['override_failure_strain'] = value
                    else:
                        print(f"❌ 未知的改判类型: {override_type}")
                        continue
                    
                    result = manager.update_manual_judgment(test_id, **kwargs)
                    if result:
                        print(f"✅ 已更新参数")
                        print_processing_result(result)
            
            else:
                print(f"❌ 未知命令: {command}")
                print("输入 'help' 查看可用命令")
            
            print()
        
        except KeyboardInterrupt:
            print("\n👋 再见!")
            break
        except Exception as e:
            print(f"❌ 错误: {str(e)}")
            import traceback
            traceback.print_exc()


def print_help():
    """打印帮助信息"""
    print("📖 可用命令:")
    print()
    print("  list              - 列出所有可用试验")
    print("  process <id>      - 处理指定试验")
    print("  show <id>         - 显示已处理试验的结果")
    print("  export <id>       - 导出试验结果 (默认导出md和json)")
    print("    --md            - 仅导出Markdown")
    print("    --json          - 仅导出JSON")
    print("  judge <id> <judgment> [remarks]")
    print("                    - 人工判定 (合格/不合格/需复核)")
    print("  override <id> <type> <value>")
    print("                    - 人工改判参数")
    print("    type: peak      - 峰值强度 (kPa)")
    print("          residual  - 残余强度 (kPa)")
    print("          strain    - 破坏应变 (%)")
    print("  help              - 显示此帮助信息")
    print("  quit/exit/q       - 退出程序")
    print()


def main():
    """主函数"""
    parser = argparse.ArgumentParser(
        description='岩土实验室三轴试验复核工具',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog='''
示例用法:
  python main.py                    # 进入交互模式
  python main.py --list             # 列出所有试验
  python main.py --process T001     # 处理试验 T001
  python main.py --export T001      # 导出试验 T001 的结果
        '''
    )
    
    parser.add_argument('--list', action='store_true',
                        help='列出所有可用的试验')
    parser.add_argument('--process', type=str, metavar='TEST_ID',
                        help='处理指定的试验')
    parser.add_argument('--show', type=str, metavar='TEST_ID',
                        help='显示已处理试验的结果')
    parser.add_argument('--export', type=str, metavar='TEST_ID',
                        help='导出试验结果')
    parser.add_argument('--md', action='store_true',
                        help='仅导出Markdown格式 (与--export配合使用)')
    parser.add_argument('--json', action='store_true',
                        help='仅导出JSON格式 (与--export配合使用)')
    
    # 人工改判参数
    parser.add_argument('--judgment', type=str, choices=['合格', '不合格', '需复核'],
                        help='人工判定结果')
    parser.add_argument('--remarks', type=str,
                        help='人工备注')
    parser.add_argument('--override-peak', type=float, metavar='VALUE',
                        help='人工改判的峰值强度 (kPa)')
    parser.add_argument('--override-residual', type=float, metavar='VALUE',
                        help='人工改判的残余强度 (kPa)')
    parser.add_argument('--override-strain', type=float, metavar='VALUE',
                        help='人工改判的破坏应变 (%)')
    
    args = parser.parse_args()
    
    # 初始化
    print_header()
    
    manager = TestManager()
    print("📂 正在加载数据...")
    try:
        manager.initialize_data()
        print("✅ 数据加载完成!")
        print()
    except Exception as e:
        print(f"⚠️  数据加载警告: {str(e)}")
        print("   部分功能可能不可用")
        print()
    
    # 处理命令行参数
    if args.list:
        list_tests(manager)
    
    elif args.process:
        process_test(
            manager,
            args.process,
            override_peak=args.override_peak,
            override_residual=args.override_residual,
            override_failure_strain=args.override_strain,
            manual_judgment=args.judgment,
            remarks=args.remarks
        )
    
    elif args.show:
        result = manager.get_processed_test(args.show)
        if result:
            print_processing_result(result)
        else:
            print(f"❌ 未找到试验 {args.show} 的处理数据")
            print(f"   请先使用 --process {args.show} 处理试验")
    
    elif args.export:
        md = True
        js = True
        if args.md:
            js = False
        if args.json:
            md = False
        export_results(manager, args.export, md, js)
    
    else:
        # 进入交互模式
        interactive_mode(manager)


if __name__ == '__main__':
    main()
