"""
主程序入口
命令行接口
"""
import argparse
import sys
from pathlib import Path

from sensor_audit import AuditPipeline
from sensor_audit.sample_generator import SampleDataGenerator


def generate_sample_data(args):
    generator = SampleDataGenerator(seed=args.seed)
    generator.generate(
        num_sensors=args.num_sensors,
        num_days=args.num_days,
        samples_per_day=args.samples_per_day,
        output_file=args.output
    )


def run_audit(args):
    if args.config:
        pipeline = AuditPipeline(config_file=args.config)
    else:
        pipeline = AuditPipeline()
    
    results = pipeline.run(
        input_file=args.input,
        output_prefix=args.prefix,
        reference_sensor_id=args.reference_sensor
    )
    
    return results


def main():
    parser = argparse.ArgumentParser(
        description='传感器漂移校准审计系统',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog='''
示例用法:
  # 生成示例数据
  python main.py generate --output data/test_data.csv
  
  # 运行审计（使用默认配置）
  python main.py audit --input data/sample_sensor_data.csv
  
  # 使用自定义配置和输出前缀
  python main.py audit --input data/my_data.csv --config config/audit_config.json --prefix my_audit
  
  # 指定参考传感器进行校准
  python main.py audit --input data/sample_sensor_data.csv --reference_sensor SENSOR_000
        '''
    )
    
    subparsers = parser.add_subparsers(dest='command', help='可用命令')
    
    gen_parser = subparsers.add_parser('generate', help='生成示例数据')
    gen_parser.add_argument('--num-sensors', type=int, default=5, help='传感器数量 (默认: 5)')
    gen_parser.add_argument('--num-days', type=int, default=30, help='数据天数 (默认: 30)')
    gen_parser.add_argument('--samples-per-day', type=int, default=12, help='每天采样次数 (默认: 12)')
    gen_parser.add_argument('--output', type=str, default='data/sample_sensor_data.csv', help='输出文件路径')
    gen_parser.add_argument('--seed', type=int, default=42, help='随机种子 (默认: 42)')
    gen_parser.set_defaults(func=generate_sample_data)
    
    audit_parser = subparsers.add_parser('audit', help='运行审计流程')
    audit_parser.add_argument('--input', type=str, required=True, help='输入CSV文件路径')
    audit_parser.add_argument('--config', type=str, help='配置文件路径 (JSON)')
    audit_parser.add_argument('--prefix', type=str, default='audit_report', help='输出文件前缀')
    audit_parser.add_argument('--reference-sensor', type=str, help='参考传感器ID用于校准')
    audit_parser.set_defaults(func=run_audit)
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        sys.exit(1)
    
    args.func(args)


if __name__ == '__main__':
    main()
