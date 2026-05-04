import os
import sys
import argparse
import json
from typing import List, Dict, Any
from datetime import datetime

# 添加当前目录到Python路径
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)

from scanner import FileScanner
from checker import Checker
from state_manager import StateManager
from config import config


def setup_logging():
    """设置日志"""
    import logging
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[
            logging.FileHandler(config.log_file, encoding='utf-8'),
            logging.StreamHandler()
        ]
    )


def scan_directory(directory_path: str) -> List[Dict[str, Any]]:
    """扫描目录"""
    scanner = FileScanner()
    results = scanner.scan_directory(directory_path)
    
    if results:
        print(f"扫描完成，找到 {len(results)} 个节目文件夹:")
        for i, result in enumerate(results, 1):
            print(f"  {i}. {result['folder_name']} ({result['program_name']})")
            files = result['files']
            print(f"     - 音频: {len(files['audio'])} 个")
            print(f"     - 字幕: {len(files['subtitles'])} 个")
            print(f"     - 封面: {len(files['covers'])} 个")
            print(f"     - 备注: {len(files['notes'])} 个")
            print(f"     - 剪辑单: {len(files['edit_lists'])} 个")
    else:
        print(f"未找到匹配的节目文件夹")
        print(f"支持的节目模式:")
        for program_id, program_config in config.programs.items():
            print(f"  - {program_config.name}: {program_config.folder_pattern}")
    
    return results


def check_directory(directory_path: str) -> List[Dict[str, Any]]:
    """检查目录中的所有节目"""
    # 先扫描
    scanner = FileScanner()
    scan_results = scanner.scan_directory(directory_path)
    
    if not scan_results:
        print(f"未找到匹配的节目文件夹")
        return []
    
    # 保存扫描结果
    state_manager = StateManager()
    state_manager.save_project_scan(directory_path, scan_results)
    
    # 检查每个节目
    checker = Checker()
    check_results = []
    
    print(f"开始检查 {len(scan_results)} 个节目...")
    print("-" * 60)
    
    for scan_result in scan_results:
        print(f"\n检查: {scan_result['folder_name']}")
        check_result = checker.check_program(scan_result)
        check_results.append(check_result)
        
        # 保存检查结果
        state_manager.save_check_result(check_result)
        
        # 输出检查摘要
        status = check_result["overall_status"]
        stats = check_result["stats"]
        status_icon = "✓" if status == "passed" else "⚠" if status == "warning" else "✗"
        status_color = "\033[92m" if status == "passed" else "\033[93m" if status == "warning" else "\033[91m"
        reset_color = "\033[0m"
        
        print(f"  状态: {status_color}{status_icon} {status}{reset_color}")
        print(f"  统计: 总计 {stats['total']}, 通过 {stats['passed']}, 失败 {stats['failed']}, 警告 {stats['warning']}")
        
        # 显示失败和警告的检查项
        for check in check_result["checks"]:
            if check["status"] in ["failed", "warning"]:
                severity_color = "\033[91m" if check["severity"] == "high" else "\033[93m" if check["severity"] == "medium" else "\033[94m"
                print(f"  [{check['type']}] {severity_color}{check['status']}: {check['message']}{reset_color}")
    
    print("\n" + "-" * 60)
    print(f"检查完成！结果已保存到: {config.state_file}")
    
    # 显示待处理项
    pending_items = state_manager.get_pending_items(directory_path)
    if pending_items:
        print(f"\n待处理项 ({len(pending_items)} 个):")
        for i, item in enumerate(pending_items, 1):
            severity_color = "\033[91m" if item["severity"] == "high" else "\033[93m" if item["severity"] == "medium" else "\033[94m"
            print(f"  {i}. [{item['program_name']}] {item['folder_name']}")
            print(f"     {severity_color}{item['check_type']}: {item['message']}{reset_color}")
    else:
        print("\n所有检查项均已通过！")
    
    return check_results


def show_pending(directory_path: str = None):
    """显示待处理项"""
    state_manager = StateManager()
    pending_items = state_manager.get_pending_items(directory_path)
    
    if pending_items:
        print(f"待处理项 ({len(pending_items)} 个):")
        print("-" * 60)
        
        for i, item in enumerate(pending_items, 1):
            status_color = "\033[91m" if item["check_status"] == "failed" else "\033[93m"
            severity_color = "\033[91m" if item["severity"] == "high" else "\033[93m" if item["severity"] == "medium" else "\033[94m"
            reset_color = "\033[0m"
            
            print(f"\n{i}. 节目: {item['program_name']}")
            print(f"   文件夹: {item['folder_name']}")
            print(f"   检查类型: {item['check_type']}")
            print(f"   状态: {status_color}{item['check_status']}{reset_color}")
            print(f"   严重程度: {severity_color}{item['severity']}{reset_color}")
            print(f"   消息: {item['message']}")
    else:
        print("没有待处理项，所有检查项均已通过！")
    
    return pending_items


def confirm_fix(folder_path: str, check_type: str):
    """确认修复"""
    state_manager = StateManager()
    
    if state_manager.confirm_fix(folder_path, check_type):
        print(f"✓ 已确认修复: {folder_path} - {check_type}")
    else:
        print(f"✗ 未找到检查结果: {folder_path}")


def export_report(output_path: str, directory_path: str = None, format: str = None):
    """导出报告"""
    state_manager = StateManager()
    
    if state_manager.export_report_to_file(output_path, directory_path, format):
        print(f"✓ 报告已导出到: {output_path}")
    else:
        print(f"✗ 导出报告失败")


def start_web_server(host: str = None, port: int = None):
    """启动Web服务器"""
    host = host or config.web_host
    port = port or config.web_port
    
    print(f"启动Web服务器: http://{host}:{port}")
    print("按 Ctrl+C 停止服务器")
    
    # 导入并启动Flask应用
    from web_app import create_app
    app = create_app()
    
    try:
        app.run(host=host, port=port, debug=True, use_reloader=False)
    except KeyboardInterrupt:
        print("\n服务器已停止")


def reset_state(force: bool = False):
    """重置状态"""
    state_manager = StateManager()
    
    if force:
        state_manager.reset_state()
        print("✓ 状态已重置")
        return
    
    # 确认
    response = input("确定要重置所有状态吗？这将删除所有检查历史。(y/N): ")
    if response.lower() == 'y':
        state_manager.reset_state()
        print("✓ 状态已重置")
    else:
        print("操作已取消")


def main():
    """主函数"""
    setup_logging()
    
    parser = argparse.ArgumentParser(
        description="播客交付巡检工具 - 扫描和检查播客节目文件",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例用法:
  # 扫描目录查看节目
  python cli.py scan /path/to/projects
  
  # 检查目录中的所有节目
  python cli.py check /path/to/projects
  
  # 查看待处理项
  python cli.py pending
  python cli.py pending /path/to/projects
  
  # 确认修复
  python cli.py confirm /path/to/folder file_existence
  
  # 导出报告
  python cli.py export report.json
  python cli.py export report.html --format html
  
  # 启动Web服务器
  python cli.py web
  python cli.py web --host 0.0.0.0 --port 8080
  
  # 重置状态
  python cli.py reset
        """
    )
    
    # 子命令
    subparsers = parser.add_subparsers(dest="command", help="可用命令")
    
    # scan 命令
    scan_parser = subparsers.add_parser("scan", help="扫描目录中的节目文件夹")
    scan_parser.add_argument("directory", help="要扫描的目录路径")
    
    # check 命令
    check_parser = subparsers.add_parser("check", help="检查目录中的所有节目")
    check_parser.add_argument("directory", help="要检查的目录路径")
    
    # pending 命令
    pending_parser = subparsers.add_parser("pending", help="显示待处理项")
    pending_parser.add_argument("directory", nargs="?", help="可选，指定目录路径")
    
    # confirm 命令
    confirm_parser = subparsers.add_parser("confirm", help="确认修复某个检查项")
    confirm_parser.add_argument("folder", help="文件夹路径")
    confirm_parser.add_argument("check_type", help="检查类型（如 file_existence, audio_duration 等）")
    
    # export 命令
    export_parser = subparsers.add_parser("export", help="导出检查报告")
    export_parser.add_argument("output", help="输出文件路径")
    export_parser.add_argument("--directory", "-d", help="指定目录路径")
    export_parser.add_argument("--format", "-f", choices=["json", "csv", "html"], help="导出格式（默认根据文件扩展名推断）")
    
    # web 命令
    web_parser = subparsers.add_parser("web", help="启动Web服务器")
    web_parser.add_argument("--host", "-H", help="监听地址（默认: 127.0.0.1）")
    web_parser.add_argument("--port", "-p", type=int, help="监听端口（默认: 5000）")
    
    # reset 命令
    reset_parser = subparsers.add_parser("reset", help="重置所有状态（删除检查历史）")
    reset_parser.add_argument("--force", "-f", action="store_true", help="强制重置，不提示确认")
    
    # 解析参数
    args = parser.parse_args()
    
    # 执行命令
    if args.command == "scan":
        scan_directory(args.directory)
    
    elif args.command == "check":
        check_directory(args.directory)
    
    elif args.command == "pending":
        show_pending(args.directory)
    
    elif args.command == "confirm":
        confirm_fix(args.folder, args.check_type)
    
    elif args.command == "export":
        export_report(args.output, args.directory, args.format)
    
    elif args.command == "web":
        start_web_server(args.host, args.port)
    
    elif args.command == "reset":
        reset_state(args.force)
    
    else:
        # 没有命令，显示帮助
        parser.print_help()


if __name__ == "__main__":
    main()
