#!/usr/bin/env python3
import argparse
import csv
import sys
import os
from typing import List, Dict, Optional

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.queue_model import MMcQueueModel, QueueResult
from core.data_validator import DataValidator, ValidationResult
from core.result_tracker import ResultTracker


class PortQueueSimulatorCLI:
    """港口泊位排队模拟 CLI 界面"""
    
    def __init__(self):
        self.validator = DataValidator()
        self.tracker = ResultTracker()
        self.current_filter = None
    
    def load_csv(self, filepath: str) -> List[Dict]:
        """从CSV加载数据"""
        records = []
        with open(filepath, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                records.append(row)
        return records
    
    def display_formulas(self):
        """显示公式参考"""
        print("\n" + "="*80)
        print("【M/M/c 排队模型公式参考】")
        print("="*80)
        for key, formula in MMcQueueModel.FORMULA_REFERENCES.items():
            print(f"  {key}: {formula}")
        print()
    
    def display_units(self):
        """显示单位说明"""
        print("\n" + "="*80)
        print("【单位说明】")
        print("="*80)
        for key, unit in MMcQueueModel.UNITS.items():
            print(f"  {key}: {unit}")
        print()
    
    def display_boundary_limits(self):
        """显示边界值"""
        print("\n" + "="*80)
        print("【边界值参考】")
        print("="*80)
        for key, value in MMcQueueModel.BOUNDARY_LIMITS.items():
            print(f"  {key}: {value}")
        print()
    
    def display_results(self, results: List[QueueResult], show_all: bool = False):
        """显示计算结果"""
        print("\n" + "="*80)
        print("【港口泊位排队模拟结果】")
        print("="*80)
        
        if self.current_filter:
            print(f"当前筛选条件: {self.current_filter}")
            print()
        
        for i, result in enumerate(results, 1):
            status_icon = "✓" if result.success else "✗"
            review_icon = "⚠" if result.requires_manual_review else " "
            legacy_icon = "◇" if result.legacy_calculation else " "
            
            print(f"\n{'─'*80}")
            print(f"记录 [{i}] ID: {result.record_id}")
            print(f"  状态: {status_icon} | 人工审核: {review_icon} | 旧口径: {legacy_icon}")
            print(f"  来源: {result.source}")
            print(f"  计算方法: {result.calculation_method}")
            
            if not result.success:
                print(f"  ❌ 失败原因: {result.error_reason}")
                continue
            
            print(f"\n  【输入参数】")
            print(f"    到达率 λ: {result.arrival_rate} 艘/小时")
            print(f"    服务率 μ: {result.service_rate} 艘/小时")
            print(f"    泊位数量 c: {result.num_servers}")
            
            print(f"\n  【计算结果】")
            print(f"    服务强度 ρ: {result.rho:.4f} (理想值 < 0.95)")
            print(f"    系统空闲概率 P0: {result.P0:.4f}")
            print(f"    排队等待船舶数 Lq: {result.Lq:.2f} 艘")
            print(f"    系统中船舶总数 L: {result.L:.2f} 艘")
            print(f"    平均排队等待时间 Wq: {result.Wq:.2f} 小时")
            print(f"    系统平均逗留时间 W: {result.W:.2f} 小时")
            print(f"    需要等待概率 P_wait: {result.P_wait:.4f}")
            
            if result.requires_manual_review:
                print(f"\n  ⚠  人工审核备注: {result.review_notes}")
        
        print(f"\n{'='*80}")
    
    def display_statistics(self):
        """显示统计信息"""
        stats = self.tracker.get_statistics()
        
        print("\n" + "="*80)
        print("【统计汇总】")
        print("="*80)
        print(f"  总记录数: {stats['total_records']}")
        print(f"  计算成功: {stats['success_count']}")
        print(f"  计算失败: {stats['failed_count']}")
        print(f"  例外记录: {stats['exception_count']} {stats['exception_records']}")
        print(f"  需人工审核: {stats['manual_review_count']} {stats['manual_review_records']}")
        print(f"  旧口径记录: {stats['legacy_count']} {stats['legacy_records']}")
        print()
    
    def display_trace(self, record_id: str):
        """显示单条记录的追溯信息"""
        trace = self.tracker.get_record_trace(record_id)
        if not trace:
            print(f"\n❌ 未找到记录: {record_id}")
            return
        
        print("\n" + "="*80)
        print(f"【记录追溯】{record_id}")
        print("="*80)
        for key, value in trace.items():
            print(f"  {key}: {value}")
        print()
    
    def apply_filter(self, filter_type: str, filter_value: str) -> List[QueueResult]:
        """应用筛选条件"""
        self.current_filter = f"{filter_type} = {filter_value}"
        
        def filter_condition(record):
            if filter_type == 'status':
                if filter_value == 'success':
                    return record.result and record.result.success
                elif filter_value == 'failed':
                    return record.result and not record.result.success
            elif filter_type == 'review':
                return record.result and record.result.requires_manual_review
            elif filter_type == 'legacy':
                return record.result and record.result.legacy_calculation
            elif filter_type == 'source':
                return filter_value in (record.result.source if record.result else '')
            return True
        
        filtered = self.tracker.filter_records(filter_condition)
        return [r.result for r in filtered if r.result]
    
    def run(self, args):
        """运行CLI"""
        if args.formulas:
            self.display_formulas()
            return
        
        if args.units:
            self.display_units()
            return
        
        if args.boundaries:
            self.display_boundary_limits()
            return
        
        if not args.input:
            print("❌ 请指定输入文件 (-i/--input)")
            return
        
        print("\n📊 港口泊位排队模拟系统")
        print("-" * 40)
        
        records = self.load_csv(args.input)
        print(f"加载记录数: {len(records)}")
        
        validation_result = self.validator.validate_dataset(records)
        if validation_result.issues:
            print(f"\n⚠  数据验证发现 {len(validation_result.issues)} 个问题:")
            for issue in validation_result.issues[:10]:
                severity = "❌" if issue.severity == 'error' else "⚠"
                print(f"  {severity} [{issue.record_id}] {issue.message}")
            if len(validation_result.issues) > 10:
                print(f"  ... 还有 {len(validation_result.issues) - 10} 个问题")
        
        results = self.tracker.process_records(
            records, 
            validation_result,
            filter_condition=self.current_filter
        )
        
        if args.filter:
            filter_parts = args.filter.split('=')
            if len(filter_parts) == 2:
                results = self.apply_filter(filter_parts[0].strip(), filter_parts[1].strip())
        
        self.display_results(results, show_all=args.verbose)
        self.display_statistics()
        
        if args.trace:
            self.display_trace(args.trace)
        
        if args.output:
            self.export_to_csv(results, args.output)
            print(f"✅ 结果已导出到: {args.output}")
        
        if args.trace_export:
            self.tracker.export_to_json(args.trace_export)
            print(f"✅ 追溯信息已导出到: {args.trace_export}")
    
    def export_to_csv(self, results: List[QueueResult], filepath: str):
        """导出结果到CSV"""
        with open(filepath, 'w', encoding='utf-8', newline='') as f:
            writer = csv.writer(f)
            writer.writerow([
                '记录ID', '来源', '计算方法', '计算状态',
                '到达率(艘/小时)', '服务率(艘/小时)', '泊位数量',
                '服务强度ρ', '系统空闲概率P0',
                '排队船舶数Lq(艘)', '系统船舶数L(艘)',
                '排队时间Wq(小时)', '逗留时间W(小时)',
                '等待概率P_wait', '需人工审核', '审核备注',
                '旧口径计算', '失败原因', '筛选条件'
            ])
            
            for result in results:
                writer.writerow([
                    result.record_id,
                    result.source,
                    result.calculation_method,
                    '成功' if result.success else '失败',
                    result.arrival_rate,
                    result.service_rate,
                    result.num_servers,
                    f"{result.rho:.4f}" if result.rho else '',
                    f"{result.P0:.4f}" if result.P0 else '',
                    f"{result.Lq:.2f}" if result.Lq else '',
                    f"{result.L:.2f}" if result.L else '',
                    f"{result.Wq:.2f}" if result.Wq else '',
                    f"{result.W:.2f}" if result.W else '',
                    f"{result.P_wait:.4f}" if result.P_wait else '',
                    '是' if result.requires_manual_review else '否',
                    result.review_notes or '',
                    '是' if result.legacy_calculation else '否',
                    result.error_reason or '',
                    self.current_filter or ''
                ])


def main():
    parser = argparse.ArgumentParser(
        description='港口泊位排队模拟系统 - 基于M/M/c排队模型',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  python -m cli.main -i data/sample.csv                    # 基本使用
  python -m cli.main -i data/sample.csv -o results.csv     # 导出结果
  python -m cli.main -i data/sample.csv --filter status=success  # 筛选成功记录
  python -m cli.main --formulas                            # 查看公式
  python -m cli.main --units                               # 查看单位
  python -m cli.main --boundaries                          # 查看边界值
        """
    )
    
    parser.add_argument('-i', '--input', help='输入CSV文件路径')
    parser.add_argument('-o', '--output', help='输出结果CSV文件路径')
    parser.add_argument('--trace', help='查看指定记录的追溯信息')
    parser.add_argument('--trace-export', help='导出完整追溯信息到JSON')
    parser.add_argument('--filter', help='筛选条件，如: status=success, review=True')
    parser.add_argument('-v', '--verbose', action='store_true', help='显示详细信息')
    parser.add_argument('--formulas', action='store_true', help='显示公式参考')
    parser.add_argument('--units', action='store_true', help='显示单位说明')
    parser.add_argument('--boundaries', action='store_true', help='显示边界值参考')
    
    args = parser.parse_args()
    
    cli = PortQueueSimulatorCLI()
    cli.run(args)


if __name__ == '__main__':
    main()
