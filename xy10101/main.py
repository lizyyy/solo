import pandas as pd
import numpy as np
import sys
import os
import traceback
from datetime import datetime

from config import CONFIG, OUTPUT_DIR, DATA_DIR
from reproducible_pipeline import ReproduciblePipeline
from data_loader import DataLoader
from quality_control import QualityControl
from gap_filler import GapFiller
from report_generator import ReportGenerator
from file_exporter import FileExporter


def run_pipeline(file_path: str = None):
    pipeline = ReproduciblePipeline(CONFIG)
    logger = pipeline.get_logger()
    
    try:
        pipeline.record_start('雨量站缺测补全处理流水线')
        
        logger.info("=" * 60)
        logger.info("开始执行雨量站缺测补全处理流水线")
        logger.info("=" * 60)
        
        logger.info("\n[步骤 1/6] 数据加载与预处理")
        logger.info("-" * 60)
        
        data_loader = DataLoader(CONFIG)
        original_df = data_loader.load_data(file_path)
        loading_errors = data_loader.get_loading_errors()
        
        pipeline.record_step('data_loading', 'success', {
            'total_records': len(original_df),
            'stations': original_df[CONFIG['station_column']].nunique(),
            'loading_errors_count': len(loading_errors)
        })
        
        pipeline.record_data_stats('原始数据', {
            '总记录数': len(original_df),
            '站点数': original_df[CONFIG['station_column']].nunique(),
            '时间范围': f"{original_df[CONFIG['time_column']].min()} ~ {original_df[CONFIG['time_column']].max()}",
            '缺失值数': original_df[CONFIG['value_column']].isna().sum(),
            '加载错误数': len(loading_errors)
        })
        
        logger.info("\n[步骤 2/6] 质量控制 (QC)")
        logger.info("-" * 60)
        
        qc = QualityControl(CONFIG)
        qc_df, qc_summary = qc.run_quality_control(original_df)
        
        failed_samples = qc.get_failed_samples()
        
        pipeline.record_step('quality_control', 'success', {
            'pass_count': len(qc_df[qc_df['qc_flag'] == 'PASS']),
            'missing_count': len(qc_df[qc_df['qc_flag'] == 'MISSING']),
            'fail_count': len(qc_df[qc_df['qc_flag'] != 'PASS']) - len(qc_df[qc_df['qc_flag'] == 'MISSING']),
            'failed_samples_count': len(failed_samples)
        })
        
        pipeline.record_data_stats('质量控制后', {
            '通过质控': len(qc_df[qc_df['qc_flag'] == 'PASS']),
            '缺测数': len(qc_df[qc_df['qc_flag'] == 'MISSING']),
            '异常数': len(qc_df[qc_df['qc_flag'].isin(['FAIL', 'SPIKE', 'CONSTANT', 'LOGIC'])]),
            '异常样本详情数': len(failed_samples)
        })
        
        logger.info("\n[步骤 3/6] 缺测补全处理")
        logger.info("-" * 60)
        
        gap_filler = GapFiller(CONFIG)
        filled_df, fill_summary = gap_filler.fill_gaps(qc_df)
        
        fill_results = gap_filler.get_fill_results()
        fill_method_stats = gap_filler.get_fill_method_stats()
        
        pipeline.record_step('gap_filling', 'success', {
            'total_filled': fill_summary.get('total_filled', 0),
            'fill_methods': fill_method_stats
        })
        
        pipeline.record_data_stats('补全处理后', {
            '补全记录数': fill_summary.get('total_filled', 0),
            '补全方法分布': fill_method_stats
        })
        
        logger.info("\n[步骤 4/6] 生成报告")
        logger.info("-" * 60)
        
        report_gen = ReportGenerator(CONFIG)
        reports = report_gen.generate_reports(
            original_df, qc_df, filled_df,
            qc_summary, fill_summary, qc, loading_errors
        )
        
        pipeline.record_step('report_generation', 'success', {
            'figures_generated': len(reports.get('figures', {})),
            'tables_generated': len(reports.get('tables', {}))
        })
        
        logger.info("\n[步骤 5/6] 导出文件")
        logger.info("-" * 60)
        
        exporter = FileExporter(CONFIG)
        exported_files = exporter.export_all(
            reports, filled_df, pipeline.get_pipeline_log(), 
            loading_errors, OUTPUT_DIR
        )
        
        pipeline.record_step('file_export', 'success', {
            'exported_files': exported_files
        })
        
        logger.info("\n[步骤 6/6] 保存流水线记录")
        logger.info("-" * 60)
        
        pipeline_log_file = pipeline.save_pipeline_log()
        
        pipeline.record_end('success', {
            'total_records_processed': len(original_df),
            'filled_count': fill_summary.get('total_filled', 0),
            'output_directory': OUTPUT_DIR
        })
        
        print_final_summary(original_df, qc_df, filled_df, qc_summary, 
                           fill_summary, exported_files, failed_samples)
        
        return {
            'status': 'success',
            'original_df': original_df,
            'qc_df': qc_df,
            'filled_df': filled_df,
            'qc_summary': qc_summary,
            'fill_summary': fill_summary,
            'reports': reports,
            'exported_files': exported_files,
            'failed_samples': failed_samples
        }
        
    except Exception as e:
        error_details = {
            'error_type': type(e).__name__,
            'error_message': str(e),
            'traceback': traceback.format_exc()
        }
        
        pipeline.record_step('pipeline_failure', 'failed', 
                           error_details, e)
        pipeline.record_end('failed', error_details)
        
        logger.error(f"\n流水线执行失败: {e}")
        logger.error(f"详细错误:\n{traceback.format_exc()}")
        
        try:
            pipeline.save_pipeline_log()
        except:
            pass
            
        return {
            'status': 'failed',
            'error': str(e),
            'error_details': error_details
        }


def print_final_summary(original_df, qc_df, filled_df, 
                       qc_summary, fill_summary, 
                       exported_files, failed_samples):
    station_col = CONFIG['station_column']
    value_col = CONFIG['value_column']
    
    print("\n" + "=" * 70)
    print("  雨量站缺测补全报告 - 处理完成")
    print("=" * 70)
    
    print("\n【数据统计】")
    print("-" * 40)
    print(f"  总记录数:      {len(original_df):,} 条")
    print(f"  站点数量:      {original_df[station_col].nunique()} 个")
    print(f"  时间范围:      {original_df[CONFIG['time_column']].min().strftime('%Y-%m-%d %H:%M')}")
    print(f"               ~ {original_df[CONFIG['time_column']].max().strftime('%Y-%m-%d %H:%M')}")
    print(f"  原始数据均值:  {original_df[value_col].mean():.2f} mm")
    print(f"  补全后均值:    {filled_df['filled_value'].mean():.2f} mm")
    
    print("\n【质量控制结果】")
    print("-" * 40)
    pass_count = len(qc_df[qc_df['qc_flag'] == 'PASS'])
    missing_count = len(qc_df[qc_df['qc_flag'] == 'MISSING'])
    fail_count = len(qc_df[qc_df['qc_flag'].isin(['FAIL', 'SPIKE', 'CONSTANT', 'LOGIC'])])
    
    print(f"  通过质控:      {pass_count:,} 条 ({pass_count/len(qc_df)*100:.1f}%)")
    print(f"  缺测记录:      {missing_count:,} 条 ({missing_count/len(qc_df)*100:.1f}%)")
    print(f"  异常记录:      {fail_count:,} 条 ({fail_count/len(qc_df)*100:.1f}%)")
    
    if failed_samples:
        print(f"\n  异常样本详情 ({len(failed_samples)} 条):")
        for i, sample in enumerate(failed_samples[:10], 1):
            print(f"    [{i}] {sample['test_name']}: "
                  f"{sample['station']} @ {sample['time']} - {sample['reason']}")
        if len(failed_samples) > 10:
            print(f"    ... 还有 {len(failed_samples) - 10} 条异常样本详情见导出文件")
    
    print("\n【缺测补全结果】")
    print("-" * 40)
    total_filled = fill_summary.get('total_filled', 0)
    method_stats = fill_summary.get('fill_method_stats', {})
    
    print(f"  补全记录数:    {total_filled:,} 条")
    if method_stats:
        print(f"  补全方法分布:")
        for method, count in method_stats.items():
            print(f"    - {method}: {count} 条 ({count/total_filled*100:.1f}%)")
            
    by_station_fill = fill_summary.get('by_station', {})
    print(f"\n  各站点补全情况:")
    for station, stats in by_station_fill.items():
        print(f"    - {station}: {stats['filled_count']} 条 ({stats['fill_ratio']:.1f}%)")
    
    print("\n【输出文件】")
    print("-" * 40)
    print(f"  输出目录:      {OUTPUT_DIR}")
    print(f"\n  生成的文件:")
    for file_type, file_path in exported_files.items():
        if isinstance(file_path, dict):
            for sub_type, sub_path in file_path.items():
                print(f"    - {file_type} ({sub_type}): {os.path.basename(sub_path)}")
        else:
            print(f"    - {file_type}: {os.path.basename(file_path)}")
    
    print("\n" + "=" * 70)
    print("  处理完成！详细报告请查看输出目录中的文件")
    print("=" * 70)


def main():
    import argparse
    
    parser = argparse.ArgumentParser(
        description='雨量站缺测补全报告生成系统',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例用法:
  python main.py                              # 使用 data 目录下最新的数据文件
  python main.py -f data/my_data.csv          # 指定数据文件
  python main.py --generate-sample            # 生成示例数据并运行
        """
    )
    
    parser.add_argument(
        '-f', '--file',
        type=str,
        help='输入数据文件路径 (CSV/Excel)'
    )
    
    parser.add_argument(
        '--generate-sample',
        action='store_true',
        help='先生成示例数据再运行'
    )
    
    args = parser.parse_args()
    
    if args.generate_sample:
        print("正在生成示例数据...")
        from generate_sample_data import generate_sample_data
        sample_path = generate_sample_data()
        args.file = sample_path
        print()
    
    input_file = args.file
    if input_file is None:
        files = [f for f in os.listdir(DATA_DIR) 
                if f.endswith(('.csv', '.txt', '.xlsx', '.xls'))]
        if not files:
            print("未找到数据文件！正在生成示例数据...")
            from generate_sample_data import generate_sample_data
            sample_path = generate_sample_data()
            input_file = sample_path
        else:
            files.sort()
            input_file = os.path.join(DATA_DIR, files[-1])
    
    result = run_pipeline(input_file)
    
    if result['status'] == 'success':
        print("\n处理成功完成！")
        return 0
    else:
        print(f"\n处理失败: {result['error']}")
        print(f"详细信息请查看日志文件")
        return 1


if __name__ == '__main__':
    sys.exit(main())
