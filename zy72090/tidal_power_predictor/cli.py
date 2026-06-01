#!/usr/bin/env python3
import argparse
import sys
import os
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from tidal_power_predictor.core.calculator import TidalPowerCalculator
from tidal_power_predictor.core.data_processor import TidalDataProcessor
from tidal_power_predictor.data.sample_data import create_sample_dataset, get_sample_data_summary
from tidal_power_predictor.report.generator import ReportGenerator


def print_header(text: str):
    print("\n" + "=" * 60)
    print(f"  {text}")
    print("=" * 60)


def print_formula_explanation():
    print_header("潮汐发电功率计算公式")
    print("""
【势能法 - 最常用，适用于有潮差和流量数据时】
  P = ρ × g × H × Q × η / 1000
  
  其中：
  - P: 发电功率 (kW)
  - ρ: 海水密度 = 1025 kg/m³
  - g: 重力加速度 = 9.81 m/s²
  - H: 有效潮差 (m)
  - Q: 流量 (m³/s)
  - η: 水轮机效率 (通常 0.75-0.85)

【动能法 - 适用于有流速和过流面积数据时】
  P = 0.5 × ρ × A × v³ × η / 1000
  
  其中：
  - A: 过流面积 (m²)
  - v: 水流速度 (m/s)

【简化估算法 - 只有潮差数据时凑合算】
  P = ρ × g × H × Q_typical × η / 1000
  (Q_typical 默认取 500 m³/s 做参考)

★ 边界值提醒：
  - 经济潮差下限: 0.5m，低于这个数基本不划算
  - 常见潮差上限: 15m，全球最大也就16m左右
  - 效率正常范围: 30% - 95%，超了就要怀疑数据
""")


def print_status_icon(status: str) -> str:
    icons = {
        "success": "✅",
        "needs_review": "⚠️",
        "failed": "❌",
        "pending": "⏳"
    }
    return icons.get(status, "❓")


def print_results_table(results, summary):
    print_header("潮汐发电功率预测 - 处理结果")
    
    print(f"\n{'记录ID':<15} {'测站':<15} {'功率(kW)':>12} {'方法':<18} {'状态':<12} {'置信度':>8}")
    print("-" * 90)
    
    for r in results:
        power_str = f"{r.predicted_power:.2f}" if r.predicted_power else "N/A"
        conf_str = f"{r.confidence_score:.1%}" if r.confidence_score > 0 else "N/A"
        status_text = {
            "success": "计算成功",
            "needs_review": "待确认",
            "failed": "失败",
            "pending": "待处理"
        }.get(r.status, r.status)
        
        print(f"{r.record_id:<15} {r.station_name[:14]:<15} {power_str:>12} {r.calculation_method[:17]:<18} {print_status_icon(r.status)} {status_text:<10} {conf_str:>8}")


def print_summary(summary):
    print_header("汇总统计")
    print(f"""
  总记录数:      {summary.total_records}
  计算成功:      {summary.success_count} 条 ✅
  待人工确认:    {summary.needs_review_count} 条 ⚠️
  计算失败:      {summary.failed_count} 条 ❌
  旧口径数据:    {summary.old_portal_count} 条 📜
  重复记录组:    {summary.duplicate_count} 组 🔍
  
  成功记录总功率: {summary.total_power_kwh:.2f} kW
  平均置信度:     {summary.avg_confidence:.1%}
    """)
    
    if summary.duplicates:
        print("  重复记录详情:")
        for dup in summary.duplicates:
            print(f"    - {dup.primary_record_id} 的重复项: {', '.join(dup.duplicate_record_ids)}")
    print()


def print_details(results):
    print_header("每条记录的详细信息（点这里看明细）")
    
    for idx, result in enumerate(results, 1):
        print(f"\n--- [{idx}] {result.record_id} ---")
        print(f"  测站: {result.station_name}")
        print(f"  时间: {result.timestamp.strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"  数据来源: {result.input.data_source}")
        print(f"  状态: {print_status_icon(result.status)} {result.status}")
        
        if result.predicted_power:
            print(f"  预测功率: {result.predicted_power:.2f} kW")
            print(f"  计算方法: {result.calculation_method}")
            print(f"  置信度: {result.confidence_score:.1%}")
        
        if result.issues:
            print(f"  问题列表 ({len(result.issues)}项):")
            for issue in result.issues:
                level_icon = "❌" if issue.level == "error" else "⚠️"
                print(f"    {level_icon} [{issue.field}] {issue.message}")
                if issue.suggestion:
                    print(f"       💡 建议: {issue.suggestion}")
        
        print(f"  处理备注: {result.processing_notes}")
        if result.input.notes:
            print(f"  原始备注: {result.input.notes}")


def main():
    parser = argparse.ArgumentParser(
        description="潮汐发电功率预测工具 - 专为产品同事小岑打造",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  python cli.py                    # 使用样例数据跑一遍
  python cli.py --export output.csv # 导出结果到CSV
  python cli.py --report report.html # 生成HTML分析报告
  python cli.py --formula          # 查看计算公式说明
  python cli.py --details          # 查看每条记录的详细信息
        """
    )
    parser.add_argument("--export", "-e", metavar="FILE", help="导出结果到CSV文件")
    parser.add_argument("--report", "-r", metavar="FILE", help="生成HTML分析报告")
    parser.add_argument("--formula", "-f", action="store_true", help="显示计算公式说明")
    parser.add_argument("--details", "-d", action="store_true", help="显示详细处理信息")
    parser.add_argument("--summary-only", "-s", action="store_true", help="只显示汇总")
    
    args = parser.parse_args()

    if args.formula:
        print_formula_explanation()
        return

    print("\n🌊 潮汐发电功率预测工具 v1.0")
    print("   让汇总页和明细数据不再脱节！")

    print(get_sample_data_summary())

    samples = create_sample_dataset()
    processor = TidalDataProcessor()
    
    print("正在处理数据...")
    results, summary = processor.process_batch(samples)

    if not args.summary_only:
        print_results_table(results, summary)
    
    print_summary(summary)

    if args.details:
        print_details(results)

    if args.export:
        processor.export_to_csv(results, args.export)
        print(f"\n✅ CSV结果已导出到: {os.path.abspath(args.export)}")
        print("   所有警告、失败原因都完整保留在CSV里，")
        print("   没有数据会悄悄消失，请放心！")

    if args.report:
        report_gen = ReportGenerator()
        report_gen.generate_html_report(results, summary, args.report)
        print(f"\n✅ HTML报告已生成: {os.path.abspath(args.report)}")
        print("   打开即可查看交互式图表和明细数据，")
        print("   点击图表可直接跳转到对应明细！")

    print_header("小贴士")
    print("""
  👉 需要人工确认的记录不会被计入"成功"统计
  👉 旧口径数据的置信度会打8折，注意区分
  👉 CSV导出包含所有字段，可直接给老板看的汇总页用
  👉 HTML报告支持图表点明细，汇报给老板很方便
  👉 计算失败的原因都写在"警告信息"列里了
    """)


if __name__ == "__main__":
    main()
