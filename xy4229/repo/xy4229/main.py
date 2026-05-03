"""字幕无障碍校准台 - 主入口文件"""
import sys
import os

# 添加项目根目录到路径
project_root = os.path.dirname(os.path.abspath(__file__))
if project_root not in sys.path:
    sys.path.insert(0, project_root)


def run_gui():
    """运行 GUI 界面"""
    try:
        import tkinter as tk
        from tkinter import ttk
        
        from src.gui.main_window import SubtitleCalibrationApp
        
        root = tk.Tk()
        
        # 设置主题
        try:
            style = ttk.Style()
            available_themes = style.theme_names()
            if 'clam' in available_themes:
                style.theme_use('clam')
            elif 'alt' in available_themes:
                style.theme_use('alt')
        except Exception as e:
            print(f"主题设置警告: {e}")
        
        app = SubtitleCalibrationApp(root)
        root.mainloop()
        
    except ImportError as e:
        print(f"错误: 缺少必要的模块 - {e}")
        print("请确保已安装 Python tkinter 库")
        sys.exit(1)
    except Exception as e:
        print(f"运行错误: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


def main():
    """主函数"""
    print("=" * 50)
    print("字幕无障碍校准台 v1.0.0")
    print("=" * 50)
    print()
    
    # 检查命令行参数
    if len(sys.argv) > 1:
        # 简单的命令行参数处理
        if sys.argv[1] == '--help' or sys.argv[1] == '-h':
            print_help()
            return
        elif sys.argv[1] == '--version' or sys.argv[1] == '-v':
            print("版本: 1.0.0")
            return
    
    # 默认运行 GUI
    run_gui()


def print_help():
    """打印帮助信息"""
    help_text = """
字幕无障碍校准台 - 帮助信息

用法:
  python main.py [选项]

选项:
  -h, --help      显示此帮助信息
  -v, --version   显示版本信息

功能说明:
  本工具用于帮助社区无障碍影院的放映志愿者
  进行字幕校准工作，主要功能包括：
  
  1. 导入数据:
     - SRT 字幕文件
     - 视频时间码 CSV
     - 环境音标注 JSON
     - 观众反馈记录 CSV
  
  2. 自动检查:
     - 字幕延迟/过早
     - 说话人漏标
     - 音效提示缺失
     - 阅读速度过快
     - 时间轴重叠
  
  3. 偏移调整:
     - 全局偏移
     - 批量偏移
     - 单条偏移
     - 智能建议
  
  4. 导出功能:
     - 修订后的 SRT 字幕
     - Markdown 格式校准报告
     - CSV 格式问题清单

快捷键:
  Ctrl+N  新建项目
  Ctrl+O  打开项目
  Ctrl+S  保存项目
  F5      运行分析
"""
    print(help_text.strip())


if __name__ == '__main__':
    main()
