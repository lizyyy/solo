import tkinter as tk
from tkinter import ttk, messagebox
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from database.schema import DatabaseSchema
from database.connection import DatabaseConnection
from gui.main_window import MainWindow
from config import APP_NAME


def initialize_database():
    try:
        DatabaseSchema.initialize()
        DatabaseSchema.seed_default_data()
        return True
    except Exception as e:
        messagebox.showerror('初始化失败', f'数据库初始化失败: {str(e)}')
        return False


def main():
    if not initialize_database():
        return
    
    root = tk.Tk()
    root.title(APP_NAME)
    
    style = ttk.Style()
    style.theme_use('clam')
    
    app = MainWindow(root)
    
    root.protocol('WM_DELETE_WINDOW', root.quit)
    
    root.mainloop()


if __name__ == '__main__':
    main()
