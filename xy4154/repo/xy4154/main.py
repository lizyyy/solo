"""
撤展装箱核验台 - 主程序入口
博物馆临展撤展装箱管理系统
"""

import sys
import os
from pathlib import Path

# 确保核心模块可以被导入
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))


def run_gui():
    """运行GUI界面"""
    from gui.main_window import main as gui_main
    gui_main()


def print_help():
    """打印帮助信息"""
    help_text = """
撤展装箱核验台 v1.0.0

用法:
    python main.py          启动GUI界面
    python main.py --help   显示此帮助信息

功能:
    • 导入展品清单CSV
    • 导入装箱扫描JSONL
    • 导入照片目录
    • 智能规则校验（漏扫、重复装箱、签名缺失等）
    • 异常复核追踪
    • 多格式导出（Markdown、CSV、JSON）

示例数据:
    查看 sample_data/ 目录获取示例文件格式

数据存储:
    默认数据库路径: ~/.exhibit_verifier/exhibit_verifier.db
"""
    print(help_text)


def main():
    """主函数"""
    if len(sys.argv) > 1:
        if sys.argv[1] in ['--help', '-h', 'help']:
            print_help()
            return
        else:
            print(f"未知参数: {sys.argv[1]}")
            print("使用 --help 查看帮助信息")
            return
    
    # 启动GUI
    print("启动撤展装箱核验台...")
    run_gui()


if __name__ == "__main__":
    main()
