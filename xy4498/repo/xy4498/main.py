#!/usr/bin/env python3
"""
陶瓷窑炉烧成曲线复盘工具
"""

import sys
import os
from datetime import datetime
from typing import List, Dict, Any

# 添加当前目录到Python路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from core import KilnManager
from models import TemperatureLog, BodyThickness, GlazeRecipe, KilnPosition


def print_menu():
    """打印主菜单"""
    print("\n" + "=" * 50)
    print("    陶瓷窑炉烧成曲线复盘工具")
    print("=" * 50)
    print("\n1. 创建新窑次")
    print("2. 加载已有窑次")
    print("3. 列出所有窑次")
    print("4. 导入数据")
    print("5. 分析当前窑次")
    print("6. 查看分析摘要")
    print("7. 按窑位查看问题原因")
    print("8. 添加缺陷记录")
    print("9. 添加复核结论")
    print("10. 导出Markdown报告")
    print("11. 导出JSON明细")
    print("12. 保存当前窑次")
    print("0. 退出")
    print("-" * 50)


def create_new_kiln_run(manager: KilnManager):
    """创建新窑次"""
    name = input("请输入窑次名称: ").strip()
    if not name:
        name = f"窑次-{datetime.now().strftime('%Y%m%d-%H%M%S')}"
    
    manager.create_new_kiln_run(name)
    print(f"\n✅ 已创建窑次: {name}")


def load_kiln_run(manager: KilnManager):
    """加载已有窑次"""
    kiln_runs = manager.list_kiln_runs()
    
    if not kiln_runs:
        print("\n❌ 没有找到任何窑次记录")
        return
    
    print("\n可用的窑次:")
    for i, kr in enumerate(kiln_runs, 1):
        print(f"{i}. {kr.get('name', '未命名')} (ID: {kr.get('id')[:8]}...)")
    
    try:
        choice = int(input("\n请选择要加载的窑次编号: ")) - 1
        if 0 <= choice < len(kiln_runs):
            kiln_run_id = kiln_runs[choice]['id']
            manager.load_kiln_run(kiln_run_id)
            print(f"\n✅ 已加载窑次: {kiln_runs[choice].get('name')}")
        else:
            print("\n❌ 无效的选择")
    except ValueError:
        print("\n❌ 请输入有效的数字")


def list_kiln_runs(manager: KilnManager):
    """列出所有窑次"""
    kiln_runs = manager.list_kiln_runs()
    
    if not kiln_runs:
        print("\n❌ 没有找到任何窑次记录")
        return
    
    print(f"\n共找到 {len(kiln_runs)} 个窑次记录:")
    print("-" * 80)
    print(f"{'名称':<20} {'窑位数':<8} {'缺陷数':<8} {'开始时间':<20}")
    print("-" * 80)
    
    for kr in kiln_runs:
        start_date = kr.get('start_date', '')[:19] if kr.get('start_date') else ''
        print(f"{kr.get('name', '未命名'):<20} "
              f"{kr.get('position_count', 0):<8} "
              f"{kr.get('defect_count', 0):<8} "
              f"{start_date:<20}")


def import_data(manager: KilnManager):
    """导入数据"""
    if not manager.current_kiln_run:
        print("\n❌ 请先创建或加载一个窑次")
        return
    
    print("\n数据导入菜单:")
    print("1. 导入温度日志 (CSV/JSON/Excel)")
    print("2. 导入坯体厚度 (CSV/JSON/Excel)")
    print("3. 导入釉料配方 (CSV/JSON/Excel)")
    print("4. 导入窑位摆放 (CSV/JSON/Excel)")
    print("5. 导入缺陷记录 (CSV/JSON/Excel)")
    print("0. 返回主菜单")
    
    choice = input("\n请选择要导入的数据类型: ").strip()
    
    if choice == '0':
        return
    
    file_path = input("请输入文件路径: ").strip()
    
    if not os.path.exists(file_path):
        print(f"\n❌ 文件不存在: {file_path}")
        return
    
    try:
        if choice == '1':
            logs = manager.import_temperature_logs(file_path)
            print(f"\n✅ 成功导入 {len(logs)} 条温度日志")
        elif choice == '2':
            thicknesses = manager.import_body_thicknesses(file_path)
            print(f"\n✅ 成功导入 {len(thicknesses)} 条坯体厚度记录")
        elif choice == '3':
            recipes = manager.import_glaze_recipes(file_path)
            print(f"\n✅ 成功导入 {len(recipes)} 个釉料配方")
        elif choice == '4':
            positions = manager.import_kiln_positions(file_path)
            print(f"\n✅ 成功导入 {len(positions)} 个窑位")
        elif choice == '5':
            defects = manager.import_defect_records(file_path)
            print(f"\n✅ 成功导入 {len(defects)} 条缺陷记录")
    except Exception as e:
        print(f"\n❌ 导入失败: {e}")


def analyze_kiln_run(manager: KilnManager):
    """分析当前窑次"""
    if not manager.current_kiln_run:
        print("\n❌ 请先创建或加载一个窑次")
        return
    
    print("\n正在分析窑次数据...")
    
    try:
        result = manager.analyze()
        summary = result.summary
        
        print(f"\n✅ 分析完成!")
        print(f"\n总体风险评估: {summary.get('overall_risk', '未知')}")
        
        warnings = summary.get('warnings', [])
        if warnings:
            print("\n⚠️ 警告事项:")
            for warning in warnings:
                print(f"   - {warning}")
        
        hr_summary = summary.get('heating_rate', {})
        print(f"\n升温速率分析:")
        print(f"   - 总分析段数: {hr_summary.get('total_segments', 0)}")
        print(f"   - 异常段数: {hr_summary.get('unacceptable_count', 0)}")
        
        ts_summary = summary.get('thermal_shock', {})
        print(f"\n热冲击风险分析:")
        print(f"   - 分析窑位数: {ts_summary.get('total_positions', 0)}")
        print(f"   - 高风险窑位数: {ts_summary.get('high_risk_count', 0)}")
        
    except Exception as e:
        print(f"\n❌ 分析失败: {e}")


def view_analysis_summary(manager: KilnManager):
    """查看分析摘要"""
    if not manager.analysis_result:
        print("\n❌ 请先运行分析")
        return
    
    summary = manager.get_analysis_summary()
    
    print("\n" + "=" * 60)
    print("分析摘要")
    print("=" * 60)
    
    print(f"\n总体风险评估: {summary.get('overall_risk', '未知')}")
    
    warnings = summary.get('warnings', [])
    if warnings:
        print("\n⚠️ 警告事项:")
        for warning in warnings:
            print(f"   - {warning}")
    
    hr = summary.get('heating_rate', {})
    print(f"\n🔥 升温速率分析:")
    print(f"   - 总分析段数: {hr.get('total_segments', 0)}")
    print(f"   - 异常段数: {hr.get('unacceptable_count', 0)}")
    if hr.get('avg_rate'):
        print(f"   - 平均升温速率: {hr['avg_rate']:.2f} °C/分钟")
    
    ins = summary.get('insulation', {})
    print(f"\n🌡️  保温偏差分析:")
    print(f"   - 总保温阶段数: {ins.get('total_stages', 0)}")
    print(f"   - 异常阶段数: {ins.get('unacceptable_count', 0)}")
    
    ts = summary.get('thermal_shock', {})
    print(f"\n⚡ 热冲击风险分析:")
    print(f"   - 分析窑位数: {ts.get('total_positions', 0)}")
    print(f"   - 高风险窑位数: {ts.get('high_risk_count', 0)}")
    by_risk = ts.get('by_risk_level', {})
    if by_risk:
        print(f"   - 风险分布: {by_risk}")
    
    gd = summary.get('glaze_defects', {})
    print(f"\n🎨 釉面缺陷分析:")
    print(f"   - 总缺陷数: {gd.get('total_defects', 0)}")
    by_type = gd.get('by_type', {})
    if by_type:
        print(f"   - 按缺陷类型分布: {by_type}")


def view_position_analysis(manager: KilnManager):
    """按窑位查看问题原因"""
    if not manager.current_kiln_run:
        print("\n❌ 请先创建或加载一个窑次")
        return
    
    if not manager.analysis_result:
        print("\n❌ 请先运行分析")
        return
    
    positions = manager.current_kiln_run.kiln_positions
    
    if not positions:
        print("\n❌ 没有窑位数据")
        return
    
    print("\n可用的窑位:")
    for i, pos in enumerate(positions, 1):
        print(f"{i}. {pos.code} (行: {pos.row}, 列: {pos.column})")
    
    try:
        choice = int(input("\n请选择窑位编号 (输入0查看所有): "))
        
        if choice == 0:
            print("\n" + "=" * 60)
            print("所有窑位分析")
            print("=" * 60)
            
            for pos in positions:
                print(f"\n--- 窑位: {pos.code} ---")
                try:
                    analysis = manager.get_position_analysis(pos.id)
                    
                    tsr = analysis.get('thermal_shock_risk')
                    if tsr:
                        print(f"热冲击风险等级: {tsr.get('risk_level')}")
                        factors = tsr.get('risk_factors', [])
                        if factors:
                            print(f"风险因素: {'; '.join(factors)}")
                    
                    defects = analysis.get('defect_associations', [])
                    if defects:
                        print(f"缺陷记录: {len(defects)} 条")
                        for defect in defects:
                            print(f"  - {defect.get('defect_type')}: {defect.get('possible_causes', [])[:2]}")
                            
                except Exception as e:
                    print(f"分析失败: {e}")
        else:
            if 1 <= choice <= len(positions):
                pos = positions[choice - 1]
                print(f"\n--- 窑位: {pos.code} ---")
                
                analysis = manager.get_position_analysis(pos.id)
                
                tsr = analysis.get('thermal_shock_risk')
                if tsr:
                    print(f"\n热冲击风险:")
                    print(f"   - 风险等级: {tsr.get('risk_level')}")
                    print(f"   - 最大升温速率: {tsr.get('max_temp_change_rate'):.2f} °C/分钟")
                    if tsr.get('body_thickness'):
                        print(f"   - 坯体厚度: {tsr.get('body_thickness'):.1f} cm")
                    factors = tsr.get('risk_factors', [])
                    if factors:
                        print(f"   - 风险因素:")
                        for factor in factors:
                            print(f"      * {factor}")
                    if tsr.get('recommendation'):
                        print(f"\n   - 建议:")
                        for line in tsr.get('recommendation').split('\n'):
                            print(f"      {line}")
                
                defects = analysis.get('defect_associations', [])
                if defects:
                    print(f"\n缺陷关联分析:")
                    for defect in defects:
                        print(f"\n   - 缺陷类型: {defect.get('defect_type')}")
                        if defect.get('glaze_recipe_name'):
                            print(f"     釉料配方: {defect.get('glaze_recipe_name')}")
                        if defect.get('temp_difference'):
                            print(f"     温度差: {defect.get('temp_difference'):.1f} °C")
                        causes = defect.get('possible_causes', [])
                        if causes:
                            print(f"     可能原因:")
                            for cause in causes:
                                print(f"      * {cause}")
                
                review = analysis.get('review')
                if review:
                    print(f"\n复核结论:")
                    print(f"   - 结论: {review.get('conclusion')}")
                    print(f"   - 复核人: {review.get('reviewer')}")
                    if review.get('root_cause'):
                        print(f"   - 根本原因: {review.get('root_cause')}")
                    if review.get('corrective_action'):
                        print(f"   - 纠正措施: {review.get('corrective_action')}")
            else:
                print("\n❌ 无效的选择")
    except ValueError:
        print("\n❌ 请输入有效的数字")


def add_defect_record(manager: KilnManager):
    """添加缺陷记录"""
    if not manager.current_kiln_run:
        print("\n❌ 请先创建或加载一个窑次")
        return
    
    positions = manager.current_kiln_run.kiln_positions
    
    if not positions:
        print("\n❌ 没有窑位数据")
        return
    
    print("\n可用的窑位:")
    for i, pos in enumerate(positions, 1):
        print(f"{i}. {pos.code}")
    
    try:
        choice = int(input("\n请选择窑位编号: ")) - 1
        if 0 <= choice < len(positions):
            pos = positions[choice]
            
            defect_type = input("请输入缺陷类型 (如: 开裂、气泡、针孔等): ").strip()
            if not defect_type:
                print("\n❌ 缺陷类型不能为空")
                return
            
            print("\n严重程度:")
            print("1. 轻微")
            print("2. 中等")
            print("3. 严重")
            severity_choice = input("请选择严重程度 (默认: 轻微): ").strip()
            
            severity_map = {'1': '轻微', '2': '中等', '3': '严重'}
            severity = severity_map.get(severity_choice, '轻微')
            
            description = input("请输入缺陷描述 (可选): ").strip()
            
            defect = manager.add_defect_record(
                position_id=pos.id,
                defect_type=defect_type,
                severity=severity,
                description=description if description else None
            )
            
            print(f"\n✅ 已添加缺陷记录: {defect.defect_type} ({defect.severity})")
        else:
            print("\n❌ 无效的选择")
    except ValueError:
        print("\n❌ 请输入有效的数字")


def add_review_conclusion(manager: KilnManager):
    """添加复核结论"""
    if not manager.current_kiln_run:
        print("\n❌ 请先创建或加载一个窑次")
        return
    
    positions = manager.current_kiln_run.kiln_positions
    
    if not positions:
        print("\n❌ 没有窑位数据")
        return
    
    print("\n可用的窑位:")
    for i, pos in enumerate(positions, 1):
        print(f"{i}. {pos.code}")
    
    try:
        choice = int(input("\n请选择窑位编号: ")) - 1
        if 0 <= choice < len(positions):
            pos = positions[choice]
            
            reviewer = input("请输入复核人姓名: ").strip()
            if not reviewer:
                print("\n❌ 复核人不能为空")
                return
            
            print("\n结论选项:")
            print("1. 合格")
            print("2. 轻微缺陷")
            print("3. 严重缺陷")
            print("4. 报废")
            conclusion_choice = input("请选择结论: ").strip()
            
            conclusion_map = {
                '1': '合格',
                '2': '轻微缺陷',
                '3': '严重缺陷',
                '4': '报废'
            }
            conclusion = conclusion_map.get(conclusion_choice)
            
            if not conclusion:
                print("\n❌ 无效的结论选择")
                return
            
            root_cause = input("请输入根本原因分析 (可选): ").strip()
            corrective_action = input("请输入纠正措施 (可选): ").strip()
            notes = input("请输入备注 (可选): ").strip()
            
            review = manager.add_review_conclusion(
                position_id=pos.id,
                reviewer=reviewer,
                conclusion=conclusion,
                root_cause=root_cause if root_cause else None,
                corrective_action=corrective_action if corrective_action else None,
                notes=notes if notes else None
            )
            
            print(f"\n✅ 已添加复核结论: {review.conclusion}")
        else:
            print("\n❌ 无效的选择")
    except ValueError:
        print("\n❌ 请输入有效的数字")


def export_markdown_report(manager: KilnManager):
    """导出Markdown报告"""
    if not manager.current_kiln_run:
        print("\n❌ 请先创建或加载一个窑次")
        return
    
    output_path = input("请输入输出文件路径 (默认: report.md): ").strip()
    if not output_path:
        output_path = 'report.md'
    
    try:
        report = manager.generate_markdown_report(output_path)
        print(f"\n✅ Markdown报告已导出到: {output_path}")
        print(f"\n报告预览 (前200字符):")
        print(report[:200] + "..." if len(report) > 200 else report)
    except Exception as e:
        print(f"\n❌ 导出失败: {e}")


def export_json(manager: KilnManager):
    """导出JSON明细"""
    if not manager.current_kiln_run:
        print("\n❌ 请先创建或加载一个窑次")
        return
    
    output_path = input("请输入输出文件路径 (默认: data.json): ").strip()
    if not output_path:
        output_path = 'data.json'
    
    try:
        data = manager.export_json(output_path)
        print(f"\n✅ JSON明细已导出到: {output_path}")
        print(f"\n数据概览:")
        print(f"   - 窑次ID: {data.get('kiln_run', {}).get('id')}")
        print(f"   - 窑次名称: {data.get('kiln_run', {}).get('name')}")
        print(f"   - 窑位数: {len(data.get('kiln_run', {}).get('kiln_positions', []))}")
        print(f"   - 缺陷数: {len(data.get('kiln_run', {}).get('defect_records', []))}")
    except Exception as e:
        print(f"\n❌ 导出失败: {e}")


def save_kiln_run(manager: KilnManager):
    """保存当前窑次"""
    if not manager.current_kiln_run:
        print("\n❌ 没有当前窑次记录")
        return
    
    try:
        kiln_run_id = manager.save_kiln_run()
        print(f"\n✅ 窑次已保存, ID: {kiln_run_id}")
    except Exception as e:
        print(f"\n❌ 保存失败: {e}")


def main():
    """主函数"""
    print("\n欢迎使用陶瓷窑炉烧成曲线复盘工具!")
    
    manager = KilnManager()
    
    while True:
        if manager.current_kiln_run:
            print(f"\n当前窑次: {manager.current_kiln_run.name}")
        
        print_menu()
        choice = input("\n请选择操作 (0-12): ").strip()
        
        if choice == '0':
            print("\n感谢使用! 再见!")
            break
        elif choice == '1':
            create_new_kiln_run(manager)
        elif choice == '2':
            load_kiln_run(manager)
        elif choice == '3':
            list_kiln_runs(manager)
        elif choice == '4':
            import_data(manager)
        elif choice == '5':
            analyze_kiln_run(manager)
        elif choice == '6':
            view_analysis_summary(manager)
        elif choice == '7':
            view_position_analysis(manager)
        elif choice == '8':
            add_defect_record(manager)
        elif choice == '9':
            add_review_conclusion(manager)
        elif choice == '10':
            export_markdown_report(manager)
        elif choice == '11':
            export_json(manager)
        elif choice == '12':
            save_kiln_run(manager)
        else:
            print("\n❌ 无效的选择，请重新输入")


if __name__ == '__main__':
    main()
