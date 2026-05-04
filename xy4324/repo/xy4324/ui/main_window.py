#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
主窗口
"""

import tkinter as tk
from tkinter import ttk, messagebox, filedialog
from typing import Optional, Dict, Any
from datetime import datetime, date

from config import get_config
from database import create_sample_data
from services import (
    ReagentService, BookingService, ApprovalService, 
    ExportService, SafetyService
)
from ui.pages import (
    DashboardPage, ReagentPage, BookingPage, 
    ApprovalPage, CollectionPage, ReturnPage,
    ReportPage
)


class MainWindow:
    """主窗口类"""
    
    def __init__(self, root: tk.Tk):
        self.root = root
        self.config = get_config()
        
        # 服务实例
        self.reagent_service = ReagentService()
        self.booking_service = BookingService()
        self.approval_service = ApprovalService()
        self.export_service = ExportService()
        self.safety_service = SafetyService()
        
        # 当前选中的预约ID
        self.current_booking_id: Optional[int] = None
        
        # 初始化示例数据
        self._init_sample_data()
        
        # 设置样式
        self._setup_styles()
        
        # 创建界面
        self._create_menu()
        self._create_toolbar()
        self._create_main_content()
        
        # 绑定事件
        self._bind_events()
        
        # 显示首页
        self.show_page('dashboard')
    
    def _init_sample_data(self):
        """初始化示例数据"""
        try:
            created = create_sample_data()
            if created:
                print("已初始化示例数据")
        except Exception as e:
            print(f"初始化示例数据失败: {e}")
    
    def _setup_styles(self):
        """设置样式"""
        style = ttk.Style()
        
        # 主题
        style.theme_use('clam')
        
        # 配置颜色
        style.configure('Title.TLabel', font=('Microsoft YaHei', 14, 'bold'))
        style.configure('Header.TLabel', font=('Microsoft YaHei', 11, 'bold'))
        style.configure('Danger.TLabel', foreground='#FF4444', font=('Microsoft YaHei', 10, 'bold'))
        style.configure('Warning.TLabel', foreground='#FF8C00', font=('Microsoft YaHei', 10))
        style.configure('Success.TLabel', foreground='#228B22', font=('Microsoft YaHei', 10))
        
        # Treeview样式
        style.configure('Treeview', rowheight=28, font=('Microsoft YaHei', 10))
        style.configure('Treeview.Heading', font=('Microsoft YaHei', 10, 'bold'))
        
        # 按钮样式
        style.configure('Primary.TButton', font=('Microsoft YaHei', 10))
        style.configure('Danger.TButton', foreground='#FF4444', font=('Microsoft YaHei', 10))
        style.configure('Success.TButton', foreground='#228B22', font=('Microsoft YaHei', 10))
    
    def _create_menu(self):
        """创建菜单栏"""
        menubar = tk.Menu(self.root)
        self.root.config(menu=menubar)
        
        # 文件菜单
        file_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label='文件', menu=file_menu)
        
        file_menu.add_command(label='导入试剂CSV', command=self._import_reagents)
        file_menu.add_separator()
        file_menu.add_command(label='导出库存台账', command=self._export_inventory)
        file_menu.add_command(label='导出预约记录', command=self._export_bookings)
        file_menu.add_separator()
        file_menu.add_command(label='退出', command=self.root.quit)
        
        # 工具菜单
        tool_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label='工具', menu=tool_menu)
        
        tool_menu.add_command(label='重新初始化示例数据', command=self._reinit_sample_data)
        tool_menu.add_separator()
        tool_menu.add_command(label='打开数据目录', command=self._open_data_dir)
        
        # 帮助菜单
        help_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label='帮助', menu=help_menu)
        
        help_menu.add_command(label='关于', command=self._show_about)
    
    def _create_toolbar(self):
        """创建工具栏"""
        toolbar = tk.Frame(self.root, bg='#f0f0f0', relief=tk.RAISED, bd=1)
        toolbar.pack(side=tk.TOP, fill=tk.X)
        
        # 导航按钮
        nav_buttons = [
            ('📊 首页', 'dashboard'),
            ('🧪 试剂库存', 'reagent'),
            ('📅 实验预约', 'booking'),
            ('✅ 审批管理', 'approval'),
            ('📤 领用登记', 'collection'),
            ('📥 归还登记', 'return'),
            ('📋 报表导出', 'report'),
        ]
        
        self.nav_buttons = {}
        
        for idx, (text, page_name) in enumerate(nav_buttons):
            btn = ttk.Button(
                toolbar, 
                text=text,
                command=lambda p=page_name: self.show_page(p),
                style='Primary.TButton'
            )
            btn.pack(side=tk.LEFT, padx=2, pady=2)
            self.nav_buttons[page_name] = btn
        
        # 分隔符
        ttk.Separator(toolbar, orient=tk.VERTICAL).pack(side=tk.LEFT, fill=tk.Y, padx=5, pady=2)
        
        # 状态显示
        self.status_label = ttk.Label(toolbar, text="就绪", style='Header.TLabel')
        self.status_label.pack(side=tk.RIGHT, padx=10, pady=2)
    
    def _create_main_content(self):
        """创建主内容区域"""
        # 主内容框架
        self.main_frame = tk.Frame(self.root)
        self.main_frame.pack(side=tk.TOP, fill=tk.BOTH, expand=True, padx=5, pady=5)
        
        # 页面容器
        self.pages: Dict[str, Any] = {}
        
        # 创建各个页面
        self.pages['dashboard'] = DashboardPage(self.main_frame, self)
        self.pages['reagent'] = ReagentPage(self.main_frame, self)
        self.pages['booking'] = BookingPage(self.main_frame, self)
        self.pages['approval'] = ApprovalPage(self.main_frame, self)
        self.pages['collection'] = CollectionPage(self.main_frame, self)
        self.pages['return'] = ReturnPage(self.main_frame, self)
        self.pages['report'] = ReportPage(self.main_frame, self)
        
        # 隐藏所有页面
        for page in self.pages.values():
            page.pack_forget()
    
    def _bind_events(self):
        """绑定事件"""
        # 窗口关闭事件
        self.root.protocol("WM_DELETE_WINDOW", self._on_close)
    
    def show_page(self, page_name: str):
        """显示指定页面"""
        # 隐藏所有页面
        for name, page in self.pages.items():
            if name == page_name:
                page.pack(fill=tk.BOTH, expand=True)
                page.refresh()
            else:
                page.pack_forget()
        
        # 更新导航按钮状态
        for name, btn in self.nav_buttons.items():
            if name == page_name:
                btn.state(['pressed'])
            else:
                btn.state(['!pressed'])
    
    def set_status(self, message: str):
        """设置状态栏消息"""
        self.status_label.config(text=message)
    
    def show_message(self, title: str, message: str, icon: str = 'info'):
        """显示消息对话框"""
        if icon == 'info':
            messagebox.showinfo(title, message)
        elif icon == 'warning':
            messagebox.showwarning(title, message)
        elif icon == 'error':
            messagebox.showerror(title, message)
        elif icon == 'question':
            return messagebox.askyesno(title, message)
    
    def _import_reagents(self):
        """导入试剂CSV"""
        file_path = filedialog.askopenfilename(
            title='选择CSV文件',
            filetypes=[('CSV文件', '*.csv'), ('所有文件', '*.*')]
        )
        
        if not file_path:
            return
        
        try:
            success, fail, errors = self.reagent_service.import_from_csv(file_path)
            
            if errors:
                error_msg = "\n".join(errors[:10])
                if len(errors) > 10:
                    error_msg += f"\n... 还有 {len(errors) - 10} 条错误"
                
                messagebox.showwarning(
                    '导入完成',
                    f'成功导入 {success} 条，失败 {fail} 条\n\n错误信息:\n{error_msg}'
                )
            else:
                messagebox.showinfo(
                    '导入成功',
                    f'成功导入 {success} 条试剂记录'
                )
            
            # 刷新试剂页面
            if 'reagent' in self.pages:
                self.pages['reagent'].refresh()
        
        except Exception as e:
            messagebox.showerror('导入失败', f'导入过程中发生错误:\n{str(e)}')
    
    def _export_inventory(self):
        """导出库存台账"""
        default_name = self.export_service.generate_filename('inventory', 'csv')
        file_path = filedialog.asksaveasfilename(
            title='保存库存台账',
            initialfile=default_name,
            defaultextension='.csv',
            filetypes=[('CSV文件', '*.csv'), ('所有文件', '*.*')]
        )
        
        if not file_path:
            return
        
        try:
            self.export_service.export_inventory_csv(file_path)
            messagebox.showinfo('导出成功', f'库存台账已保存至:\n{file_path}')
        except Exception as e:
            messagebox.showerror('导出失败', f'导出过程中发生错误:\n{str(e)}')
    
    def _export_bookings(self):
        """导出预约记录"""
        default_name = self.export_service.generate_filename('bookings', 'csv')
        file_path = filedialog.asksaveasfilename(
            title='保存预约记录',
            initialfile=default_name,
            defaultextension='.csv',
            filetypes=[('CSV文件', '*.csv'), ('所有文件', '*.*')]
        )
        
        if not file_path:
            return
        
        try:
            self.export_service.export_bookings_csv(file_path)
            messagebox.showinfo('导出成功', f'预约记录已保存至:\n{file_path}')
        except Exception as e:
            messagebox.showerror('导出失败', f'导出过程中发生错误:\n{str(e)}')
    
    def _reinit_sample_data(self):
        """重新初始化示例数据"""
        if not messagebox.askyesno('确认', '重新初始化示例数据将清空现有数据，是否继续？'):
            return
        
        try:
            # 这里简化处理，实际应该删除所有数据后重新创建
            messagebox.showinfo('提示', '请删除 data/lab_management.db 文件后重启程序')
        except Exception as e:
            messagebox.showerror('错误', str(e))
    
    def _open_data_dir(self):
        """打开数据目录"""
        import subprocess
        import platform
        
        data_dir = str(self.config.data_dir)
        
        try:
            if platform.system() == 'Windows':
                os.startfile(data_dir)
            elif platform.system() == 'Darwin':
                subprocess.run(['open', data_dir])
            else:
                subprocess.run(['xdg-open', data_dir])
        except Exception as e:
            messagebox.showinfo('数据目录', f'数据目录位置:\n{data_dir}')
    
    def _show_about(self):
        """显示关于对话框"""
        messagebox.showinfo(
            '关于',
            '试剂领用安全闸 v1.0.0\n\n'
            '中学化学实验室试剂管理系统\n\n'
            '功能特点:\n'
            '- 试剂库存管理 (CSV导入导出)\n'
            '- 实验预约管理\n'
            '- 智能安全检查 (库存/有效期/相容性)\n'
            '- 领用归还审批流程\n'
            '- 审计日志记录\n'
            '- Markdown交接单导出'
        )
    
    def _on_close(self):
        """窗口关闭事件"""
        if messagebox.askyesno('确认退出', '确定要退出系统吗？'):
            self.root.destroy()
