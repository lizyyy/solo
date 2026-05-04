#!/usr/bin/env python3
"""
宠物寄养店自动化管理系统 - 主入口
"""

import os
import sys
from pathlib import Path

project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

from src.config import Config
from src.api_server import create_app
from src.database import init_db
from src.archiver import Archiver
from src.risk_detector import RiskDetector
from src.exporter import Exporter


def run_server():
    """运行 HTTP API 服务器"""
    config = Config()
    
    print("=" * 60)
    print("  宠物寄养店自动化管理系统 - HTTP API 服务器")
    print("=" * 60)
    print(f"  服务器地址: http://{config.server_host}:{config.server_port}")
    print(f"  调试模式: {'开启' if config.server_debug else '关闭'}")
    print(f"  输入目录: {config.incoming_dir}")
    print(f"  归档目录: {config.archive_dir}")
    print(f"  数据库: {config.database_path}")
    print("=" * 60)
    print()
    print("可用 API 端点:")
    print("  GET  /api/health              - 健康检查")
    print("  POST /api/scan                - 扫描并处理输入目录")
    print("  GET  /api/risks               - 查询风险列表")
    print("  GET  /api/risks/<id>          - 查询单个风险")
    print("  POST /api/risks/<id>/confirm  - 确认风险")
    print("  POST /api/risks/<id>/resolve  - 解决风险")
    print("  POST /api/risks/<id>/dismiss  - 忽略风险")
    print("  GET  /api/pets                - 获取宠物列表")
    print("  GET  /api/pets/<id>           - 获取宠物详情")
    print("  POST /api/confirmations       - 添加确认记录")
    print("  GET  /api/confirmations       - 获取确认记录")
    print("  GET  /api/export/markdown     - 导出 Markdown 交接单")
    print("  GET  /api/export/json         - 导出 JSON 审计包")
    print("  GET  /api/export/all          - 导出所有文件")
    print("  GET  /api/stats               - 获取统计信息")
    print()
    
    init_db()
    
    app = create_app(config)
    app.run(
        host=config.server_host,
        port=config.server_port,
        debug=config.server_debug
    )


def run_scan():
    """扫描输入目录并处理文件"""
    config = Config()
    
    print("=" * 60)
    print("  宠物寄养店自动化管理系统 - 扫描模式")
    print("=" * 60)
    
    init_db()
    
    archiver = Archiver(config)
    
    print(f"\n正在扫描输入目录: {config.incoming_dir}")
    
    results = archiver.scan_incoming_directory()
    
    print(f"\n扫描完成，共处理 {len(results)} 个文件:")
    for result in results:
        status = "✓" if result['success'] else "✗"
        print(f"  {status} {result['file_name']} - {result.get('error') or '成功'}")
    
    print("\n正在进行风险检测...")
    
    risk_detector = RiskDetector(config)
    risk_results = risk_detector.run_all_detections()
    
    total_risks = sum(len(v) for v in risk_results.values())
    print(f"\n检测到 {total_risks} 个风险:")
    for risk_type, risks in risk_results.items():
        if risks:
            print(f"  - {risk_type}: {len(risks)} 个")
    
    if total_risks > 0:
        print("\n风险详情:")
        for risk_type, risks in risk_results.items():
            for risk in risks:
                print(f"  [{risk['pet_name']}] {risk['description']}")
    
    return results


def run_export(date_str: str = None):
    """导出交接单和审计包"""
    from datetime import datetime, date
    
    config = Config()
    
    print("=" * 60)
    print("  宠物寄养店自动化管理系统 - 导出模式")
    print("=" * 60)
    
    init_db()
    
    target_date = date.today()
    if date_str:
        try:
            target_date = datetime.strptime(date_str, '%Y-%m-%d').date()
        except ValueError:
            print(f"错误: 无效的日期格式 '{date_str}'，请使用 YYYY-MM-DD 格式")
            return
    
    print(f"\n导出日期: {target_date.strftime('%Y-%m-%d')}")
    
    exporter = Exporter(config)
    
    print("\n正在生成 Markdown 交接单...")
    md_path = exporter.export_markdown_handover(target_date)
    print(f"  ✓ 已生成: {md_path}")
    
    print("\n正在生成 JSON 审计包...")
    json_path = exporter.export_json_audit(target_date)
    print(f"  ✓ 已生成: {json_path}")
    
    print("\n" + "=" * 60)
    print("导出完成!")
    print("=" * 60)
    
    return {'markdown': md_path, 'json': json_path}


def run_init():
    """初始化项目目录和数据库"""
    config = Config()
    
    print("=" * 60)
    print("  宠物寄养店自动化管理系统 - 初始化")
    print("=" * 60)
    
    directories = [
        config.incoming_dir,
        config.archive_dir,
        config.export_dir,
        config.database_path.parent
    ]
    
    print("\n正在创建目录...")
    for directory in directories:
        directory.mkdir(parents=True, exist_ok=True)
        print(f"  ✓ {directory}")
    
    print("\n正在初始化数据库...")
    init_db()
    print(f"  ✓ 数据库: {config.database_path}")
    
    print("\n" + "=" * 60)
    print("初始化完成!")
    print("=" * 60)
    print()
    print("下一步:")
    print("  1. 将示例数据复制到输入目录:")
    print(f"     cp examples/* {config.incoming_dir}/")
    print("  2. 运行扫描: python main.py scan")
    print("  3. 启动服务器: python main.py server")
    print()


def main():
    """主函数"""
    import argparse
    
    parser = argparse.ArgumentParser(
        description='宠物寄养店自动化管理系统',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例用法:
  python main.py init              # 初始化项目
  python main.py server            # 启动 HTTP 服务器
  python main.py scan              # 扫描并处理文件
  python main.py export            # 导出今日交接单
  python main.py export 2026-05-04 # 导出指定日期的交接单
        """
    )
    
    subparsers = parser.add_subparsers(dest='command', help='可用命令')
    
    subparsers.add_parser('init', help='初始化项目目录和数据库')
    
    subparsers.add_parser('server', help='启动 HTTP API 服务器')
    
    subparsers.add_parser('scan', help='扫描输入目录并处理文件')
    
    export_parser = subparsers.add_parser('export', help='导出交接单和审计包')
    export_parser.add_argument('date', nargs='?', help='日期 (YYYY-MM-DD)，默认今日')
    
    args = parser.parse_args()
    
    if args.command == 'init':
        run_init()
    elif args.command == 'server':
        run_server()
    elif args.command == 'scan':
        run_scan()
    elif args.command == 'export':
        run_export(args.date)
    else:
        parser.print_help()


if __name__ == '__main__':
    main()
