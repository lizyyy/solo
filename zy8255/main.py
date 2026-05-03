#!/usr/bin/env python3
"""
影院排片核对工具 - 主入口
"""

import tkinter as tk
from tkinter import ttk, messagebox
from pathlib import Path
import sys

# 添加项目根目录到路径
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

from cinema_review.gui.main_window import CinemaReviewApp
from cinema_review.utils.persistence import StateManager


def main():
    """主函数"""
    # 检查数据目录
    data_dir = project_root / "data"
    sample_dir = data_dir / "sample"
    
    if not sample_dir.exists():
        sample_dir.mkdir(parents=True, exist_ok=True)
        print(f"已创建示例数据目录: {sample_dir}")
        print("请将数据文件放入 data/ 目录或 data/sample/ 目录")
    
    # 初始化状态管理器
    state_manager = StateManager(project_root / "output" / "review_state.json")
    
    # 创建主窗口
    root = tk.Tk()
    app = CinemaReviewApp(root, project_root, state_manager)
    
    # 设置窗口标题
    root.title("影院排片核对工具 - Cinema Review Tool")
    
    # 设置窗口大小
    screen_width = root.winfo_screenwidth()
    screen_height = root.winfo_screenheight()
    window_width = min(1400, screen_width - 100)
    window_height = min(900, screen_height - 100)
    window_x = (screen_width - window_width) // 2
    window_y = (screen_height - window_height) // 2
    
    root.geometry(f"{window_width}x{window_height}+{window_x}+{window_y}")
    
    # 启动主循环
    root.mainloop()


if __name__ == "__main__":
    main()
