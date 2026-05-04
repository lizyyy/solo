#!/usr/bin/env python3
import argparse
import sys
import os
from datetime import datetime

# 添加当前目录到路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from database import (
    init_db, get_all_pieces, get_all_kiln_batches, 
    get_kiln_batch, get_all_kiln_shelves,
    create_kiln_batch, add_shelf_placement, get_batch_placements,
    add_review_record
)
from import_service import import_all, import_pieces_from_csv, import_kiln_shelves_from_json, import_glaze_conflicts_from_json
from export_service import export_all
from validation_service import validate_entire_batch

def print_help():
    help_text = """
窑烧排窑预检器 - 命令行工具

用法: python cli.py [命令] [选项]

命令:
  init              初始化数据库
  import            导入数据
    --pieces FILE   导入作品CSV文件
    --shelves FILE  导入窑炉层板JSON文件
    --glazes FILE   导入釉药禁忌表JSON文件
  
  list              列出数据
    --pieces        列出所有作品
    --batches       列出所有窑次
    --shelves       列出所有层板
  
  batch             窑次管理
    --create NAME   创建新窑次 (需配合--temp指定温区)
    --temp ZONE     指定窑次温区
    --list          列出窑次
    --show ID       显示窑次详情
    --validate ID   校验窑次
  
  place             安排作品到层板
    --batch ID      窑次ID
    --piece CODE    作品编号
    --shelf NUM     层板编号
  
  export            导出数据
    --batch ID      窑次ID
    --all           导出所有格式
    --markdown      导出Markdown装窑单
    --csv           导出CSV取件清单
    --json          导出JSON审计包
    --output DIR    输出目录 (可选)
  
  serve             启动Web服务器
    --port PORT     端口号 (默认: 5000)
    --host HOST     主机地址 (默认: 127.0.0.1)

示例:
  python cli.py init
  python cli.py import --pieces data/pieces.csv --shelves data/shelves.json --glazes data/glazes.json
  python cli.py batch --create "2026-05-04-01" --temp "高温"
  python cli.py place --batch 1 --piece "P001" --shelf 1
  python cli.py batch --validate 1
  python cli.py export --batch 1 --all
  python cli.py serve --port 8080
"""
    print(help_text)

def cmd_init(args):
    print("正在初始化数据库...")
    init_db()
    print("数据库初始化完成!")

def cmd_import(args):
    results = {}
    
    if args.pieces:
        print(f"导入作品数据: {args.pieces}")
        results['pieces'] = import_pieces_from_csv(args.pieces)
        print(f"  新增: {results['pieces']['imported']}, 更新: {results['pieces']['updated']}")
    
    if args.shelves:
        print(f"导入窑炉层板: {args.shelves}")
        results['shelves'] = import_kiln_shelves_from_json(args.shelves)
        print(f"  导入: {results['shelves']['imported']}")
    
    if args.glazes:
        print(f"导入釉药禁忌表: {args.glazes}")
        results['conflicts'] = import_glaze_conflicts_from_json(args.glazes)
        print(f"  导入: {results['conflicts']['imported']}")
    
    if not results:
        print("请指定至少一个导入文件: --pieces, --shelves, 或 --glazes")

def cmd_list(args):
    if args.pieces:
        print("\n作品列表:")
        print("-" * 80)
        pieces = get_all_pieces()
        if not pieces:
            print("  暂无作品数据")
        else:
            for p in pieces:
                print(f"  [{p['piece_code']}] {p['owner_name']} - {p['height']}x{p['width']}x{p['depth']}cm")
                print(f"      泥料: {p['clay_type']}, 釉药: {p['glaze_type']}, 温区: {p['temperature_zone']}")
                print(f"      付款: {p['payment_status']}")
    
    if args.batches:
        print("\n窑次列表:")
        print("-" * 80)
        batches = get_all_kiln_batches()
        if not batches:
            print("  暂无窑次数据")
        else:
            for b in batches:
                print(f"  [ID:{b['id']}] {b['batch_code']} - {b.get('batch_name', '未命名')}")
                print(f"      温区: {b['target_temperature_zone']}, 状态: {b['status']}")
    
    if args.shelves:
        print("\n层板列表:")
        print("-" * 80)
        shelves = get_all_kiln_shelves()
        if not shelves:
            print("  暂无层板数据")
        else:
            for s in shelves:
                print(f"  [层板{s['shelf_number']}] 最大高度: {s['max_height']}cm, 温区: {s['temperature_zone']}")

def cmd_batch(args):
    if args.create:
        if not args.temp:
            print("错误: 创建窑次需要指定温区 (--temp)")
            return
        
        print(f"创建窑次: {args.create}, 温区: {args.temp}")
        batch_id = create_kiln_batch(
            batch_code=args.create,
            target_temperature_zone=args.temp,
            batch_name=args.create
        )
        print(f"窑次创建成功, ID: {batch_id}")
    
    elif args.list:
        cmd_list(argparse.Namespace(batches=True, pieces=False, shelves=False))
    
    elif args.show:
        batch = get_kiln_batch(args.show)
        if not batch:
            print(f"未找到窑次 ID: {args.show}")
            return
        
        print(f"\n窑次详情:")
        print("-" * 80)
        print(f"  ID: {batch['id']}")
        print(f"  编号: {batch['batch_code']}")
        print(f"  名称: {batch.get('batch_name', '未命名')}")
        print(f"  温区: {batch['target_temperature_zone']}")
        print(f"  状态: {batch['status']}")
        
        placements = get_batch_placements(args.show)
        if placements:
            print(f"\n  已安排作品 ({len(placements)}件):")
            for p in placements:
                print(f"    层板{p['shelf_number']}: [{p['piece_code']}] {p['owner_name']}")
        else:
            print(f"\n  暂无安排作品")
    
    elif args.validate:
        print(f"校验窑次 ID: {args.validate}")
        result = validate_entire_batch(args.validate)
        
        print(f"\n校验结果:")
        print("-" * 80)
        print(f"  作品总数: {result['total_pieces']}")
        print(f"  整体状态: {'✅ 通过' if result['valid'] else '❌ 有问题'}")
        
        summary = result['summary']
        print(f"\n  问题统计:")
        print(f"    高度问题: {summary['height_issues']}")
        print(f"    温区问题: {summary['temperature_issues']}")
        print(f"    付款问题: {summary['payment_issues']}")
        print(f"    高风险釉药冲突: {summary['high_glaze_conflicts']}")
        print(f"    中风险釉药冲突: {summary['medium_glaze_conflicts']}")
        print(f"    总问题数: {summary['total_issues']}")
        
        if not result['valid']:
            print(f"\n  详细问题:")
            for v in result['validations']:
                if not v['valid']:
                    print(f"\n    作品 {v['piece_code']} (层板{v['shelf_number']}):")
                    for check in v['validations']:
                        if not check['valid']:
                            icon = '❌'
                            if check.get('overridden'):
                                icon = '⚠️ (已改判)'
                            print(f"      {icon} [{check['check_type']}] {check['message']}")
            
            if result['glaze_conflicts']:
                print(f"\n    釉药冲突:")
                for conflict in result['glaze_conflicts']:
                    icon = '🔴' if conflict.get('severity') == 'high' else '🟡'
                    print(f"      {icon} 层板{conflict.get('shelf_number')}: {conflict['message']}")

def cmd_place(args):
    if not args.batch or not args.piece or not args.shelf:
        print("错误: 安排作品需要指定 --batch, --piece, 和 --shelf")
        return
    
    from database import get_piece_by_code, get_all_kiln_shelves
    
    piece = get_piece_by_code(args.piece)
    if not piece:
        print(f"错误: 未找到作品编号: {args.piece}")
        return
    
    shelves = get_all_kiln_shelves()
    shelf = next((s for s in shelves if s['shelf_number'] == int(args.shelf)), None)
    
    if not shelf:
        print(f"错误: 未找到层板编号: {args.shelf}")
        return
    
    print(f"安排作品 [{args.piece}] 到层板 {args.shelf}")
    
    placement_id = add_shelf_placement(
        batch_id=args.batch,
        piece_id=piece['id'],
        shelf_id=shelf['id']
    )
    
    print(f"安排成功, 放置记录ID: {placement_id}")

def cmd_export(args):
    if not args.batch:
        print("错误: 导出需要指定窑次 ID (--batch)")
        return
    
    print(f"导出窑次 ID: {args.batch}")
    
    if args.all:
        results = export_all(args.batch)
        print(f"\n导出结果:")
        if results.get('markdown'):
            print(f"  Markdown装窑单: {results['markdown']}")
        if results.get('csv'):
            print(f"  CSV取件清单: {results['csv']}")
        if results.get('json'):
            print(f"  JSON审计包: {results['json']}")
    else:
        from export_service import (
            export_kiln_list_to_markdown,
            export_pickup_list_to_csv,
            export_audit_package_to_json
        )
        
        if args.markdown:
            path = export_kiln_list_to_markdown(args.batch)
            print(f"  Markdown装窑单: {path}")
        if args.csv:
            path = export_pickup_list_to_csv(args.batch)
            print(f"  CSV取件清单: {path}")
        if args.json:
            path = export_audit_package_to_json(args.batch)
            print(f"  JSON审计包: {path}")
        
        if not args.markdown and not args.csv and not args.json:
            print("请指定导出格式: --all, --markdown, --csv, 或 --json")

def cmd_serve(args):
    port = args.port or 5000
    host = args.host or '127.0.0.1'
    
    print(f"启动Web服务器: http://{host}:{port}")
    print(f"按 Ctrl+C 停止服务器")
    
    from app import app
    app.run(host=host, port=port, debug=True)

def main():
    parser = argparse.ArgumentParser(description='窑烧排窑预检器', add_help=False)
    
    subparsers = parser.add_subparsers(dest='command', help='可用命令')
    
    # init 命令
    subparsers.add_parser('init', help='初始化数据库')
    
    # import 命令
    import_parser = subparsers.add_parser('import', help='导入数据')
    import_parser.add_argument('--pieces', help='作品CSV文件路径')
    import_parser.add_argument('--shelves', help='窑炉层板JSON文件路径')
    import_parser.add_argument('--glazes', help='釉药禁忌表JSON文件路径')
    
    # list 命令
    list_parser = subparsers.add_parser('list', help='列出数据')
    list_parser.add_argument('--pieces', action='store_true', help='列出作品')
    list_parser.add_argument('--batches', action='store_true', help='列出窑次')
    list_parser.add_argument('--shelves', action='store_true', help='列出层板')
    
    # batch 命令
    batch_parser = subparsers.add_parser('batch', help='窑次管理')
    batch_parser.add_argument('--create', help='创建新窑次(编号)')
    batch_parser.add_argument('--temp', help='窑次温区')
    batch_parser.add_argument('--list', action='store_true', help='列出窑次')
    batch_parser.add_argument('--show', type=int, help='显示窑次详情(ID)')
    batch_parser.add_argument('--validate', type=int, help='校验窑次(ID)')
    
    # place 命令
    place_parser = subparsers.add_parser('place', help='安排作品到层板')
    place_parser.add_argument('--batch', type=int, help='窑次ID')
    place_parser.add_argument('--piece', help='作品编号')
    place_parser.add_argument('--shelf', type=int, help='层板编号')
    
    # export 命令
    export_parser = subparsers.add_parser('export', help='导出数据')
    export_parser.add_argument('--batch', type=int, help='窑次ID')
    export_parser.add_argument('--all', action='store_true', help='导出所有格式')
    export_parser.add_argument('--markdown', action='store_true', help='导出Markdown装窑单')
    export_parser.add_argument('--csv', action='store_true', help='导出CSV取件清单')
    export_parser.add_argument('--json', action='store_true', help='导出JSON审计包')
    export_parser.add_argument('--output', help='输出目录')
    
    # serve 命令
    serve_parser = subparsers.add_parser('serve', help='启动Web服务器')
    serve_parser.add_argument('--port', type=int, default=5000, help='端口号')
    serve_parser.add_argument('--host', default='127.0.0.1', help='主机地址')
    
    args = parser.parse_args()
    
    if not args.command:
        print_help()
        return
    
    # 确保数据库已初始化
    init_db()
    
    # 执行命令
    if args.command == 'init':
        cmd_init(args)
    elif args.command == 'import':
        cmd_import(args)
    elif args.command == 'list':
        cmd_list(args)
    elif args.command == 'batch':
        cmd_batch(args)
    elif args.command == 'place':
        cmd_place(args)
    elif args.command == 'export':
        cmd_export(args)
    elif args.command == 'serve':
        cmd_serve(args)

if __name__ == '__main__':
    main()
