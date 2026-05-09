#!/usr/bin/env python3
import argparse
import sys
from pathlib import Path

from toll_audit_cli import __version__
from toll_audit_cli.audit_engine import AuditEngine


def parse_args():
    parser = argparse.ArgumentParser(
        prog='toll-audit',
        description='公路收费稽核样本 CLI - 检测车型不符和路径异常',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
使用示例：
  python3 toll_audit.py audit samples/toll_records_1.csv
  python3 toll_audit.py audit samples/toll_records_2.json
  python3 toll_audit.py audit samples/batch_1.csv -o reports/report_1.json
  python3 toll_audit.py dashboard

数据格式说明（CSV/JSON）：
  必填字段：record_id, plate_number, entry_station, exit_station, 
           entry_time, exit_time, vehicle_type, weight, toll_amount
  
  车型支持：1型客车, 2型客车, 3型客车, 4型客车, 1型货车-6型货车
  时间格式：ISO 8601（如：2024-01-15T08:30:00 或 2024-01-15 08:30:00）
        """
    )
    
    parser.add_argument('-v', '--version', action='version', 
                       version=f'%(prog)s {__version__}')
    
    subparsers = parser.add_subparsers(dest='command', help='可用命令')
    
    audit_parser = subparsers.add_parser('audit', help='执行收费稽核')
    audit_parser.add_argument('file', help='通行记录文件路径（CSV或JSON）')
    audit_parser.add_argument('-o', '--output', help='输出报告路径（JSON）',
                            default=None)
    
    dashboard_parser = subparsers.add_parser('dashboard', 
                                            help='查看稽核数据总览')
    
    return parser.parse_args()


def print_header():
    print("""
╔══════════════════════════════════════════════════════════════════╗
║                                                                  ║
║              公路收费稽核样本 CLI v1.0.0                           ║
║              Toll Audit CLI - Sample Implementation              ║
║                                                                  ║
╚══════════════════════════════════════════════════════════════════╝
    """)


def print_usage_guide():
    print("""
【快速开始 - 从空数据到最终报表】

第1步：准备通行记录数据
  └─ 创建 CSV 或 JSON 文件，包含以下必填字段：
     record_id, plate_number, entry_station, exit_station,
     entry_time, exit_time, vehicle_type, weight, toll_amount

第2步：执行稽核命令
  └─ python3 toll_audit.py audit <数据文件路径>

第3步：查看控制台输出
  └─ 输出包含：
     • 数据导入统计（有效/无效/重复记录数）
     • 车型规则校验结果（通过/异常数，通过率）
     • 路径校验结果（通过/异常数，通过率）
     • 稽核结果汇总（需人工复核的记录详情）

第4步：生成报告（可选）
  └─ python3 toll_audit.py audit <文件> -o <报告路径>

第5步：查看总览
  └─ python3 toll_audit.py dashboard

【核心稽核逻辑】
  1. 车型不符检测：根据载重判断车型是否匹配
  2. 路径异常检测：根据行驶时间判断路径是否异常
  3. 边界处理：重复提交跳过、缺失字段标记、状态冲突处理

【异常证据链】
  车型不符 → 载重与车型标准不符 → 需人工复核
  路径异常 → 行驶时间超出预期范围 → 需人工复核
    """)


def run_audit(args):
    file_path = Path(args.file)
    if not file_path.exists():
        print(f"错误：文件不存在 - {file_path}")
        sys.exit(1)
    
    engine = AuditEngine()
    
    try:
        report = engine.run_audit(str(file_path))
        
        if args.output:
            output_path = engine.export_report(report, args.output)
            print(f"\n稽核报告已导出: {output_path}")
        
        return report
    except Exception as e:
        print(f"稽核执行失败: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


def show_dashboard(engine: AuditEngine = None):
    if engine is None:
        print("\n【稽核数据总览】")
        print("  注：当前会话未处理数据，请先运行 'audit' 命令")
        return
    
    stats = engine.get_overall_stats()
    
    print("\n" + "="*60)
    print("【稽核数据总览看板】")
    print("="*60)
    print(f"\n  总处理记录数:      {stats['total_processed']}")
    print(f"  通过记录数:         {stats['passed']}")
    print(f"  疑似异常数:         {stats['suspicious']}")
    print(f"  需人工复核数:       {stats['needs_manual_review']}")
    print(f"  整体通过率:         {stats['pass_rate']:.1f}%")
    
    if stats['suspicious'] > 0:
        print("\n【待处理事项】")
        print(f"  - 有 {stats['needs_manual_review']} 条记录需要人工复核")
        print("  - 请查看控制台输出中的详细证据链")
    
    print("\n" + "="*60 + "\n")


def main():
    args = parse_args()
    
    if args.command is None:
        print_header()
        print_usage_guide()
        return
    
    print_header()
    
    if args.command == 'audit':
        run_audit(args)
    elif args.command == 'dashboard':
        show_dashboard()
    else:
        print(f"未知命令: {args.command}")
        sys.exit(1)


if __name__ == "__main__":
    main()
