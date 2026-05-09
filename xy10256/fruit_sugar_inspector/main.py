#!/usr/bin/env python3
import sys
import os
import argparse
import json
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from modules import (
    BatchImporter, Sampler, Classifier, AnomalyDetector, Reporter,
    CONFIG
)


def print_header(title: str):
    print('\n' + '=' * 70)
    print(f'{title:^70}')
    print('=' * 70 + '\n')


def process_batch(batch_file: str, seed: int = None, verbose: bool = False) -> dict:
    print_header('水果糖度抽检器 - 开始处理')
    
    base_dir = os.path.dirname(os.path.abspath(__file__))
    output_dir = os.path.join(base_dir, CONFIG['output_dir'])
    
    importer = BatchImporter()
    sampler = Sampler(seed=seed)
    classifier = Classifier()
    detector = AnomalyDetector()
    reporter = Reporter(output_dir=output_dir)
    
    if verbose:
        print('[步骤 1/6] 正在导入批次数据...')
    
    batch_data = importer.load_batch(batch_file)
    validation_result = importer.validate_batch(batch_data)
    
    if not validation_result['valid']:
        print('\n[错误] 批次数据验证失败!')
        for err in validation_result['errors']:
            print(f'  - {err}')
        return {'success': False, 'errors': validation_result['errors']}
    
    print(f'批次信息: {batch_data["batch_id"]} ({batch_data["fruit_type"]})')
    print(f'批次大小: {batch_data["batch_size"]} 个')
    print(f'测量数据: {len(batch_data.get("measurements", []))} 条')
    
    if verbose:
        print('\n[步骤 2/6] 正在计算抽样数量...')
    
    batch_size = len(batch_data.get('measurements', []))
    sampling_info = sampler.calculate_sample_size(batch_size)
    
    print(f'\n抽样信息:')
    print(f'  最低要求: {sampling_info["min_required"]} 个')
    print(f'  推荐数量: {sampling_info["recommended"]} 个')
    print(f'  实际抽样: {sampling_info["sample_size"]} 个')
    print(f'  抽样比例: {sampling_info["sample_ratio"]:.1%}')
    
    if not sampling_info['meets_min_requirement']:
        print(f'  [警告] 抽样数量不足最低要求!')
    
    if verbose:
        print('\n[步骤 3/6] 正在选择样本...')
    
    measurements = batch_data.get('measurements', [])
    samples = sampler.select_samples(
        measurements=measurements,
        sample_size=sampling_info['sample_size'],
        strategy='stratified'
    )
    sampling_stats = sampler.get_sampling_stats()
    
    if verbose:
        print(f'样本统计: 糖度范围 {sampling_stats["sugar_min"]:.1f} - {sampling_stats["sugar_max"]:.1f}, '
              f'平均 {sampling_stats["sugar_avg"]:.2f}')
    
    intermediate = reporter.generate_intermediate_results(
        data={
            'batch_info': validation_result['summary'],
            'sampling_info': sampling_info,
            'selected_samples': samples
        },
        filename=f'intermediate_{batch_data["batch_id"]}_{datetime.now().strftime("%Y%m%d_%H%M%S")}.json'
    )
    
    if verbose:
        print(f'\n[步骤 4/6] 正在进行等级判定...')
    
    classification_results = classifier.classify_all_samples(
        samples=samples,
        fruit_type=batch_data['fruit_type']
    )
    batch_grade_info = classifier.determine_batch_grade()
    
    print(f'\n分级结果:')
    print(f'  建议批次等级: {batch_grade_info["batch_grade"]}')
    print(f'  分级置信度: {batch_grade_info["confidence"]:.1%}')
    print(f'  等级分布:')
    for grade, dist in batch_grade_info['distribution'].items():
        print(f'    - {grade}: {dist["count"]} 个 ({dist["percentage"]:.1%})')
    
    if verbose:
        print('\n[步骤 5/6] 正在进行异常检测...')
    
    anomaly_result = detector.detect_all(
        samples=samples,
        classification_results=classification_results,
        batch_grade_info=batch_grade_info,
        fruit_type=batch_data['fruit_type']
    )
    
    status_map = {
        'normal': '正常',
        'has_anomalies': '存在异常',
        'needs_review': '待复核',
        'intercepted': '已拦截'
    }
    print(f'\n异常检测:')
    print(f'  总体状态: {status_map.get(anomaly_result["overall_status"], anomaly_result["overall_status"])}')
    print(f'  需要拦截: {"是" if anomaly_result["interception_needed"] else "否"}')
    print(f'  需要复核: {"是" if anomaly_result["review_needed"] else "否"}')
    
    if anomaly_result['alerts']:
        print(f'\n  [警报] ({len(anomaly_result["alerts"])} 项):')
        for alert in anomaly_result['alerts']:
            print(f'    - {alert["message"]}')
    
    if anomaly_result['warnings']:
        print(f'\n  [警告] ({len(anomaly_result["warnings"])} 项):')
        for warning in anomaly_result['warnings']:
            print(f'    - {warning["message"]}')
    
    if verbose:
        print('\n[步骤 6/6] 正在生成报告...')
    
    report = reporter.generate_final_report(
        batch_info=batch_data,
        validation_result=validation_result,
        sampling_info=sampling_info,
        sampling_stats=sampling_stats,
        batch_grade_info=batch_grade_info,
        anomaly_result=anomaly_result,
        classification_details=classification_results
    )
    
    saved_files = reporter.save_report(report, format_type='both')
    
    print_header('处理完成')
    print(f'批次编号: {batch_data["batch_id"]}')
    print(f'最终状态: {status_map.get(anomaly_result["overall_status"], anomaly_result["overall_status"])}')
    print(f'建议等级: {batch_grade_info["batch_grade"]}')
    print(f'\n生成的文件:')
    print(f'  中间结果: {intermediate}')
    print(f'  JSON报告: {saved_files["json"]}')
    print(f'  TXT报告:  {saved_files["txt"]}')
    
    return {
        'success': True,
        'batch_id': batch_data['batch_id'],
        'status': anomaly_result['overall_status'],
        'grade': batch_grade_info['batch_grade'],
        'confidence': batch_grade_info['confidence'],
        'reports': saved_files
    }


def generate_samples_command(args):
    from sample_generator import generate_all_samples
    
    base_dir = os.path.dirname(os.path.abspath(__file__))
    sample_dir = os.path.join(base_dir, args.output or CONFIG['sample_dir'])
    
    if not os.path.exists(sample_dir):
        os.makedirs(sample_dir)
    
    generate_all_samples(sample_dir)


def list_samples_command(args):
    base_dir = os.path.dirname(os.path.abspath(__file__))
    sample_dir = os.path.join(base_dir, args.dir or CONFIG['sample_dir'])
    
    if not os.path.exists(sample_dir):
        print(f'目录不存在: {sample_dir}')
        return
    
    sample_files = [f for f in os.listdir(sample_dir) if f.endswith('.json')]
    
    if not sample_files:
        print(f'未找到样例数据文件')
        return
    
    print(f'\n样例数据目录: {sample_dir}')
    print(f'共找到 {len(sample_files)} 个批次文件:\n')
    
    for f in sorted(sample_files):
        filepath = os.path.join(sample_dir, f)
        try:
            with open(filepath, 'r', encoding='utf-8') as file:
                data = json.load(file)
            size = os.path.getsize(filepath)
            desc = data.get('description', '无描述')
            measurements = len(data.get('measurements', []))
            print(f'  {f:<25} {data["fruit_type"]:<8} {measurements:>6} 条  {size/1024:>6.1f} KB')
            print(f'    描述: {desc}')
            print()
        except Exception as e:
            print(f'  {f}: 读取失败 ({e})')


def process_command(args):
    if not os.path.exists(args.file):
        print(f'[错误] 文件不存在: {args.file}')
        return
    
    process_batch(
        batch_file=args.file,
        seed=args.seed,
        verbose=args.verbose
    )


def main():
    parser = argparse.ArgumentParser(
        description='水果分拣糖度抽检器 - 按糖度抽检分级系统',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog='''
使用示例:
  python main.py generate                              # 生成样例数据
  python main.py list                                  # 列出样例数据
  python main.py process -f data/samples/BATCH_APPLE_001.json  # 处理单个批次
  python main.py process -f data/samples/BATCH_APPLE_001.json -v  # 详细模式
        '''
    )
    
    subparsers = parser.add_subparsers(dest='command', help='可用命令')
    
    generate_parser = subparsers.add_parser('generate', help='生成样例数据')
    generate_parser.add_argument('-o', '--output', help='输出目录', default=None)
    generate_parser.set_defaults(func=generate_samples_command)
    
    list_parser = subparsers.add_parser('list', help='列出可用的样例数据')
    list_parser.add_argument('-d', '--dir', help='数据目录', default=None)
    list_parser.set_defaults(func=list_samples_command)
    
    process_parser = subparsers.add_parser('process', help='处理批次数据')
    process_parser.add_argument('-f', '--file', required=True, help='批次数据文件路径')
    process_parser.add_argument('-s', '--seed', type=int, help='随机种子（用于复现抽样）', default=None)
    process_parser.add_argument('-v', '--verbose', action='store_true', help='详细输出模式')
    process_parser.set_defaults(func=process_command)
    
    args = parser.parse_args()
    
    if args.command is None:
        parser.print_help()
        return
    
    args.func(args)


if __name__ == '__main__':
    main()
