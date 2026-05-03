#!/usr/bin/env python3
"""
主窗口模块
负责提供应用的主界面和用户交互
"""

import tkinter as tk
from tkinter import ttk, filedialog, messagebox, scrolledtext
from datetime import datetime
from typing import Dict, List, Any, Optional
import sys
import os

# 添加项目根目录到路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from parser.data_parser import DataParser
from parser.validators import DataValidator
from engine.rule_engine import RuleEngine
from engine.risk_assessor import RiskAssessor
from storage.state_manager import StateManager
from exporter.exporter import Exporter


class MainWindow:
    """主窗口类"""
    
    def __init__(self, root: tk.Tk):
        """
        初始化主窗口
        
        Args:
            root: Tkinter根窗口
        """
        self.root = root
        self.root.title("人工增雨作业放行盘")
        self.root.geometry("1400x900")
        self.root.minsize(1200, 800)
        
        # 初始化核心组件
        self.data_parser = DataParser()
        self.data_validator = DataValidator()
        self.rule_engine = RuleEngine()
        self.risk_assessor = RiskAssessor()
        self.state_manager = StateManager()
        self.exporter = Exporter()
        
        # 当前数据和状态
        self.parsed_data = {
            'radar_data': [],
            'airspace_approvals': [],
            'operation_points': [],
            'ammunition_inventory': [],
            'personnel_qualifications': []
        }
        self.current_risks = []
        self.current_session = None
        
        # 创建界面
        self._create_menu_bar()
        self._create_main_layout()
        self._create_status_bar()
        
        # 创建新会话
        self._create_new_session()
        
        # 绑定事件
        self.root.protocol("WM_DELETE_WINDOW", self._on_close)
    
    def _create_menu_bar(self):
        """创建菜单栏"""
        menu_bar = tk.Menu(self.root)
        self.root.config(menu=menu_bar)
        
        # 文件菜单
        file_menu = tk.Menu(menu_bar, tearoff=0)
        menu_bar.add_cascade(label="文件", menu=file_menu)
        file_menu.add_command(label="新建作业", command=self._create_new_session)
        file_menu.add_command(label="打开历史作业", command=self._open_session)
        file_menu.add_separator()
        file_menu.add_command(label="导入数据", command=self._import_data)
        file_menu.add_separator()
        file_menu.add_command(label="导出放行单", command=self._export_release_note)
        file_menu.add_command(label="导出风险清单", command=self._export_risk_list)
        file_menu.add_command(label="导出审计包", command=self._export_audit_package)
        file_menu.add_separator()
        file_menu.add_command(label="退出", command=self._on_close)
        
        # 操作菜单
        operation_menu = tk.Menu(menu_bar, tearoff=0)
        menu_bar.add_cascade(label="操作", menu=operation_menu)
        operation_menu.add_command(label="执行风险检查", command=self._run_risk_check)
        operation_menu.add_command(label="标记复核完成", command=self._mark_reviewed)
        operation_menu.add_separator()
        operation_menu.add_command(label="放行作业", command=self._approve_operation)
        operation_menu.add_command(label="驳回作业", command=self._reject_operation)
        
        # 帮助菜单
        help_menu = tk.Menu(menu_bar, tearoff=0)
        menu_bar.add_cascade(label="帮助", menu=help_menu)
        help_menu.add_command(label="关于", command=self._show_about)
    
    def _create_main_layout(self):
        """创建主布局"""
        # 主容器
        main_frame = ttk.Frame(self.root)
        main_frame.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)
        
        # 左侧面板 - 数据概览和风险列表
        left_frame = ttk.Frame(main_frame, width=400)
        left_frame.pack(side=tk.LEFT, fill=tk.Y, padx=(0, 5))
        left_frame.pack_propagate(False)
        
        # 右侧面板 - 地图和时间轴
        right_frame = ttk.Frame(main_frame)
        right_frame.pack(side=tk.RIGHT, fill=tk.BOTH, expand=True)
        
        # 左侧面板内容
        self._create_left_panel(left_frame)
        
        # 右侧面板内容
        self._create_right_panel(right_frame)
    
    def _create_left_panel(self, parent: ttk.Frame):
        """创建左侧面板"""
        # 会话信息
        session_frame = ttk.LabelFrame(parent, text="会话信息", padding=10)
        session_frame.pack(fill=tk.X, pady=(0, 5))
        
        self.session_info_label = ttk.Label(session_frame, text="作业编号: -\n状态: 待复核")
        self.session_info_label.pack(anchor=tk.W)
        
        # 数据概览
        data_frame = ttk.LabelFrame(parent, text="数据概览", padding=10)
        data_frame.pack(fill=tk.X, pady=(0, 5))
        
        self.data_overview_text = scrolledtext.ScrolledText(data_frame, height=8, width=40, state=tk.DISABLED)
        self.data_overview_text.pack(fill=tk.X)
        
        # 风险摘要
        risk_summary_frame = ttk.LabelFrame(parent, text="风险摘要", padding=10)
        risk_summary_frame.pack(fill=tk.X, pady=(0, 5))
        
        self.risk_summary_label = ttk.Label(risk_summary_frame, text="总风险数: 0\n严重: 0, 高: 0, 中: 0, 警告: 0")
        self.risk_summary_label.pack(anchor=tk.W)
        
        # 总体风险状态
        risk_status_frame = ttk.Frame(risk_summary_frame)
        risk_status_frame.pack(fill=tk.X, pady=(5, 0))
        
        self.overall_risk_label = ttk.Label(risk_status_frame, text="总体风险: -", font=("Arial", 12, "bold"))
        self.overall_risk_label.pack(anchor=tk.W)
        
        self.can_proceed_label = ttk.Label(risk_status_frame, text="", font=("Arial", 10))
        self.can_proceed_label.pack(anchor=tk.W)
        
        # 风险列表
        risk_list_frame = ttk.LabelFrame(parent, text="风险列表", padding=10)
        risk_list_frame.pack(fill=tk.BOTH, expand=True)
        
        # 创建风险列表Treeview
        columns = ('severity', 'category', 'title', 'description')
        self.risk_tree = ttk.Treeview(risk_list_frame, columns=columns, show='headings', height=10)
        
        self.risk_tree.heading('severity', text='严重程度')
        self.risk_tree.heading('category', text='类别')
        self.risk_tree.heading('title', text='标题')
        self.risk_tree.heading('description', text='描述')
        
        self.risk_tree.column('severity', width=80)
        self.risk_tree.column('category', width=80)
        self.risk_tree.column('title', width=100)
        self.risk_tree.column('description', width=150)
        
        # 滚动条
        risk_scrollbar = ttk.Scrollbar(risk_list_frame, orient=tk.VERTICAL, command=self.risk_tree.yview)
        self.risk_tree.configure(yscrollcommand=risk_scrollbar.set)
        
        self.risk_tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        risk_scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
        
        # 绑定选择事件
        self.risk_tree.bind('<<TreeviewSelect>>', self._on_risk_select)
        
        # 操作按钮
        button_frame = ttk.Frame(parent)
        button_frame.pack(fill=tk.X, pady=(10, 0))
        
        ttk.Button(button_frame, text="执行风险检查", command=self._run_risk_check).pack(side=tk.LEFT, padx=(0, 5))
        ttk.Button(button_frame, text="导入数据", command=self._import_data).pack(side=tk.LEFT)
    
    def _create_right_panel(self, parent: ttk.Frame):
        """创建右侧面板"""
        # 上半部分 - 地图显示
        map_frame = ttk.LabelFrame(parent, text="地图视图", padding=10)
        map_frame.pack(fill=tk.BOTH, expand=True, pady=(0, 5))
        
        # 创建地图画布
        self.map_canvas = tk.Canvas(map_frame, bg='white', highlightthickness=1, highlightbackground='gray')
        self.map_canvas.pack(fill=tk.BOTH, expand=True)
        
        # 绑定调整大小事件
        self.map_canvas.bind('<Configure>', self._on_map_resize)
        
        # 下半部分 - 时间轴
        timeline_frame = ttk.LabelFrame(parent, text="时间轴", padding=10)
        timeline_frame.pack(fill=tk.X)
        
        # 创建时间轴画布
        self.timeline_canvas = tk.Canvas(timeline_frame, bg='white', height=120, highlightthickness=1, highlightbackground='gray')
        self.timeline_canvas.pack(fill=tk.X)
        
        # 详情面板
        detail_frame = ttk.LabelFrame(parent, text="详情", padding=10)
        detail_frame.pack(fill=tk.BOTH, expand=True, pady=(5, 0))
        
        self.detail_text = scrolledtext.ScrolledText(detail_frame, height=8, state=tk.DISABLED)
        self.detail_text.pack(fill=tk.BOTH, expand=True)
    
    def _create_status_bar(self):
        """创建状态栏"""
        self.status_bar = ttk.Label(self.root, text="就绪", relief=tk.SUNKEN, anchor=tk.W)
        self.status_bar.pack(side=tk.BOTTOM, fill=tk.X)
    
    def _create_new_session(self):
        """创建新会话"""
        session_id = self.state_manager.create_new_session("未命名作业")
        self.current_session = self.state_manager.get_current_status()
        self._update_session_display()
        self._update_status(f"已创建新会话: {session_id}")
    
    def _open_session(self):
        """打开历史会话"""
        sessions = self.state_manager.get_all_sessions()
        
        if not sessions:
            messagebox.showinfo("提示", "没有历史会话")
            return
        
        # 简单的会话选择对话框
        session_window = tk.Toplevel(self.root)
        session_window.title("选择历史作业")
        session_window.geometry("600x400")
        
        # 创建列表
        columns = ('session_id', 'operation_name', 'status', 'created_at')
        tree = ttk.Treeview(session_window, columns=columns, show='headings')
        
        tree.heading('session_id', text='作业编号')
        tree.heading('operation_name', text='作业名称')
        tree.heading('status', text='状态')
        tree.heading('created_at', text='创建时间')
        
        tree.column('session_id', width=150)
        tree.column('operation_name', width=150)
        tree.column('status', width=100)
        tree.column('created_at', width=150)
        
        # 填充数据
        for session in sessions:
            created_at = session.get('created_at', '')
            if isinstance(created_at, datetime):
                created_at_str = created_at.strftime('%Y-%m-%d %H:%M')
            else:
                created_at_str = str(created_at)
            
            status = session.get('status', 'pending')
            status_display = self.state_manager.get_status_display(status)
            
            tree.insert('', tk.END, values=(
                session.get('session_id', ''),
                session.get('operation_name', ''),
                status_display,
                created_at_str
            ))
        
        tree.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)
        
        def on_select():
            selection = tree.selection()
            if selection:
                item = tree.item(selection[0])
                session_id = item['values'][0]
                if self.state_manager.load_session(session_id):
                    self.current_session = self.state_manager.get_current_status()
                    self._update_session_display()
                    self._update_status(f"已加载会话: {session_id}")
                    session_window.destroy()
                else:
                    messagebox.showerror("错误", "加载会话失败")
        
        button_frame = ttk.Frame(session_window)
        button_frame.pack(fill=tk.X, padx=10, pady=10)
        
        ttk.Button(button_frame, text="打开", command=on_select).pack(side=tk.RIGHT, padx=(5, 0))
        ttk.Button(button_frame, text="取消", command=session_window.destroy).pack(side=tk.RIGHT)
    
    def _import_data(self):
        """导入数据"""
        file_path = filedialog.askopenfilename(
            title="选择数据文件",
            filetypes=[
                ("所有支持的格式", "*.csv *.json *.yaml *.yml"),
                ("CSV文件", "*.csv"),
                ("JSON文件", "*.json"),
                ("YAML文件", "*.yaml *.yml"),
                ("所有文件", "*.*")
            ]
        )
        
        if not file_path:
            return
        
        try:
            # 解析文件
            parsed_data = self.data_parser.parse_file(file_path)
            
            # 更新当前数据
            for key in self.parsed_data:
                if parsed_data.get(key):
                    self.parsed_data[key].extend(parsed_data[key])
            
            # 验证数据
            is_valid, errors = self.data_validator.validate_all(self.parsed_data)
            
            # 添加数据源记录
            if self.current_session:
                filename = os.path.basename(file_path)
                self.state_manager.add_data_source(file_path, filename)
                self.state_manager.save_session()
            
            # 更新显示
            self._update_data_overview()
            self._update_map_display()
            self._update_timeline_display()
            
            if errors:
                error_msg = f"数据验证发现 {len(errors)} 个问题:\n"
                for error in errors[:10]:
                    error_msg += f"- {error.get('type', '').upper()}: {error.get('message', '')}\n"
                if len(errors) > 10:
                    error_msg += f"... 还有 {len(errors) - 10} 个问题"
                messagebox.showwarning("数据验证警告", error_msg)
            
            self._update_status(f"已导入数据: {os.path.basename(file_path)}")
            
        except Exception as e:
            messagebox.showerror("导入失败", f"导入数据时出错: {str(e)}")
    
    def _run_risk_check(self):
        """执行风险检查"""
        if not any(self.parsed_data.values()):
            messagebox.showwarning("警告", "请先导入数据")
            return
        
        try:
            # 执行规则检查
            self.current_risks = self.rule_engine.check_all_rules(self.parsed_data)
            
            # 评估风险
            self.risk_assessor.assess_risks(self.current_risks)
            
            # 更新显示
            self._update_risk_display()
            self._update_map_display()
            self._update_timeline_display()
            
            risk_count = len(self.current_risks)
            self._update_status(f"风险检查完成，发现 {risk_count} 个风险点")
            
        except Exception as e:
            messagebox.showerror("检查失败", f"执行风险检查时出错: {str(e)}")
    
    def _mark_reviewed(self):
        """标记复核完成"""
        if self.current_session is None:
            messagebox.showwarning("警告", "请先创建或打开会话")
            return
        
        # 简单的备注输入对话框
        notes_window = tk.Toplevel(self.root)
        notes_window.title("复核备注")
        notes_window.geometry("400x200")
        
        ttk.Label(notes_window, text="请输入复核备注:").pack(anchor=tk.W, padx=10, pady=10)
        
        notes_text = scrolledtext.ScrolledText(notes_window, height=5)
        notes_text.pack(fill=tk.BOTH, expand=True, padx=10, pady=(0, 10))
        
        def on_confirm():
            notes = notes_text.get('1.0', tk.END).strip()
            if self.state_manager.update_status('reviewed', notes):
                self.current_session = self.state_manager.get_current_status()
                self._update_session_display()
                self._update_status("已标记为复核完成")
                notes_window.destroy()
            else:
                messagebox.showerror("错误", "更新状态失败")
        
        button_frame = ttk.Frame(notes_window)
        button_frame.pack(fill=tk.X, padx=10, pady=10)
        
        ttk.Button(button_frame, text="确认", command=on_confirm).pack(side=tk.RIGHT, padx=(5, 0))
        ttk.Button(button_frame, text="取消", command=notes_window.destroy).pack(side=tk.RIGHT)
    
    def _approve_operation(self):
        """放行作业"""
        if self.current_session is None:
            messagebox.showwarning("警告", "请先创建或打开会话")
            return
        
        # 检查是否有严重风险
        critical_risks = [r for r in self.current_risks if r.get('severity') == 'critical']
        high_risks = [r for r in self.current_risks if r.get('severity') == 'high']
        
        if critical_risks or high_risks:
            if not messagebox.askyesno("确认", 
                f"存在 {len(critical_risks)} 个严重风险和 {len(high_risks)} 个高风险，\n"
                "确定要放行吗？"):
                return
        
        # 输入放行意见
        approval_window = tk.Toplevel(self.root)
        approval_window.title("放行意见")
        approval_window.geometry("400x200")
        
        ttk.Label(approval_window, text="请输入放行意见:").pack(anchor=tk.W, padx=10, pady=10)
        
        approval_text = scrolledtext.ScrolledText(approval_window, height=5)
        approval_text.pack(fill=tk.BOTH, expand=True, padx=10, pady=(0, 10))
        
        def on_approve():
            notes = approval_text.get('1.0', tk.END).strip()
            if self.state_manager.update_status('approved', notes):
                self.current_session = self.state_manager.get_current_status()
                self._update_session_display()
                self._update_status("已放行作业")
                approval_window.destroy()
            else:
                messagebox.showerror("错误", "更新状态失败")
        
        button_frame = ttk.Frame(approval_window)
        button_frame.pack(fill=tk.X, padx=10, pady=10)
        
        ttk.Button(button_frame, text="确认放行", command=on_approve).pack(side=tk.RIGHT, padx=(5, 0))
        ttk.Button(button_frame, text="取消", command=approval_window.destroy).pack(side=tk.RIGHT)
    
    def _reject_operation(self):
        """驳回作业"""
        if self.current_session is None:
            messagebox.showwarning("警告", "请先创建或打开会话")
            return
        
        # 输入驳回原因
        reject_window = tk.Toplevel(self.root)
        reject_window.title("驳回原因")
        reject_window.geometry("400x200")
        
        ttk.Label(reject_window, text="请输入驳回原因:").pack(anchor=tk.W, padx=10, pady=10)
        
        reject_text = scrolledtext.ScrolledText(reject_window, height=5)
        reject_text.pack(fill=tk.BOTH, expand=True, padx=10, pady=(0, 10))
        
        def on_reject():
            reason = reject_text.get('1.0', tk.END).strip()
            if not reason:
                messagebox.showwarning("警告", "请输入驳回原因")
                return
            if self.state_manager.update_status('rejected', reason):
                self.current_session = self.state_manager.get_current_status()
                self._update_session_display()
                self._update_status("已驳回作业")
                reject_window.destroy()
            else:
                messagebox.showerror("错误", "更新状态失败")
        
        button_frame = ttk.Frame(reject_window)
        button_frame.pack(fill=tk.X, padx=10, pady=10)
        
        ttk.Button(button_frame, text="确认驳回", command=on_reject).pack(side=tk.RIGHT, padx=(5, 0))
        ttk.Button(button_frame, text="取消", command=reject_window.destroy).pack(side=tk.RIGHT)
    
    def _export_release_note(self):
        """导出放行单"""
        if self.current_session is None:
            messagebox.showwarning("警告", "请先创建或打开会话")
            return
        
        file_path = filedialog.asksaveasfilename(
            title="保存放行单",
            defaultextension=".md",
            initialfile=self.exporter.generate_filename('放行单', 'md', 
                self.current_session.get('session_id', '')),
            filetypes=[("Markdown文件", "*.md"), ("所有文件", "*.*")]
        )
        
        if not file_path:
            return
        
        if self.exporter.export_markdown_release_note(
            self.current_session,
            self.current_risks,
            self.parsed_data,
            file_path
        ):
            self._update_status(f"已导出行单: {file_path}")
            messagebox.showinfo("成功", f"放行单已导出到:\n{file_path}")
        else:
            messagebox.showerror("错误", "导出放行单失败")
    
    def _export_risk_list(self):
        """导出风险清单"""
        if not self.current_risks:
            messagebox.showwarning("警告", "没有风险数据可导出")
            return
        
        file_path = filedialog.asksaveasfilename(
            title="保存风险清单",
            defaultextension=".csv",
            initialfile=self.exporter.generate_filename('风险清单', 'csv',
                self.current_session.get('session_id', '') if self.current_session else ''),
            filetypes=[("CSV文件", "*.csv"), ("所有文件", "*.*")]
        )
        
        if not file_path:
            return
        
        if self.exporter.export_csv_risk_list(self.current_risks, file_path):
            self._update_status(f"已导出风险清单: {file_path}")
            messagebox.showinfo("成功", f"风险清单已导出到:\n{file_path}")
        else:
            messagebox.showerror("错误", "导出风险清单失败")
    
    def _export_audit_package(self):
        """导出审计包"""
        if self.current_session is None:
            messagebox.showwarning("警告", "请先创建或打开会话")
            return
        
        file_path = filedialog.asksaveasfilename(
            title="保存审计包",
            defaultextension=".json",
            initialfile=self.exporter.generate_filename('审计包', 'json',
                self.current_session.get('session_id', '')),
            filetypes=[("JSON文件", "*.json"), ("所有文件", "*.*")]
        )
        
        if not file_path:
            return
        
        if self.exporter.export_json_audit_package(
            self.current_session,
            self.current_risks,
            self.parsed_data,
            file_path
        ):
            self._update_status(f"已导出审计包: {file_path}")
            messagebox.showinfo("成功", f"审计包已导出到:\n{file_path}")
        else:
            messagebox.showerror("错误", "导出审计包失败")
    
    def _update_session_display(self):
        """更新会话显示"""
        if self.current_session:
            session_id = self.current_session.get('session_id', '未知')
            status = self.current_session.get('status', 'pending')
            status_display = self.state_manager.get_status_display(status)
            status_color = self.state_manager.get_status_color(status)
            
            self.session_info_label.config(
                text=f"作业编号: {session_id}\n状态: {status_display}"
            )
        else:
            self.session_info_label.config(text="作业编号: -\n状态: 待复核")
    
    def _update_data_overview(self):
        """更新数据概览"""
        self.data_overview_text.config(state=tk.NORMAL)
        self.data_overview_text.delete('1.0', tk.END)
        
        overview = "数据概览:\n"
        overview += "=" * 30 + "\n"
        overview += f"雷达回波数据: {len(self.parsed_data['radar_data'])} 条\n"
        overview += f"空域批复数据: {len(self.parsed_data['airspace_approvals'])} 条\n"
        overview += f"作业点位数据: {len(self.parsed_data['operation_points'])} 条\n"
        overview += f"弹药库存数据: {len(self.parsed_data['ammunition_inventory'])} 条\n"
        overview += f"人员资质数据: {len(self.parsed_data['personnel_qualifications'])} 条\n"
        
        # 弹药统计
        if self.parsed_data['ammunition_inventory']:
            total_quantity = sum(item.get('quantity', 0) for item in self.parsed_data['ammunition_inventory'])
            overview += f"\n弹药总库存: {total_quantity} 发\n"
        
        self.data_overview_text.insert('1.0', overview)
        self.data_overview_text.config(state=tk.DISABLED)
    
    def _update_risk_display(self):
        """更新风险显示"""
        # 清空现有数据
        for item in self.risk_tree.get_children():
            self.risk_tree.delete(item)
        
        # 获取格式化的风险列表
        display_risks = self.risk_assessor.get_risks_for_display()
        
        # 填充数据
        for risk in display_risks:
            self.risk_tree.insert('', tk.END, values=(
                risk.get('severity_name', ''),
                risk.get('category_name', ''),
                risk.get('title', ''),
                risk.get('description', '')
            ))
        
        # 更新风险摘要
        summary = self.risk_assessor.get_risk_summary()
        
        if 'error' in summary:
            self.risk_summary_label.config(text="总风险数: 0\n严重: 0, 高: 0, 中: 0, 警告: 0")
            self.overall_risk_label.config(text="总体风险: -")
            self.can_proceed_label.config(text="")
            return
        
        risk_counts = summary.get('risk_counts', {})
        critical = risk_counts.get('critical', {}).get('count', 0)
        high = risk_counts.get('high', {}).get('count', 0)
        medium = risk_counts.get('medium', {}).get('count', 0)
        warning = risk_counts.get('warning', {}).get('count', 0)
        
        self.risk_summary_label.config(
            text=f"总风险数: {summary['total_risks']}\n"
                 f"严重: {critical}, 高: {high}, 中: {medium}, 警告: {warning}"
        )
        
        # 更新总体风险
        overall_risk_name = summary.get('overall_risk_name', '未知')
        self.overall_risk_label.config(text=f"总体风险: {overall_risk_name}")
        
        # 更新能否作业
        can_proceed = summary.get('can_proceed', False)
        if can_proceed:
            self.can_proceed_label.config(text="✓ 可以作业", foreground='green')
        else:
            self.can_proceed_label.config(text="✗ 禁止作业", foreground='red')
    
    def _update_map_display(self):
        """更新地图显示"""
        self.map_canvas.delete('all')
        
        # 获取画布尺寸
        width = self.map_canvas.winfo_width()
        height = self.map_canvas.winfo_height()
        
        if width < 10 or height < 10:
            return
        
        # 绘制背景
        self.map_canvas.create_rectangle(0, 0, width, height, fill='#F5F5F5', outline='')
        
        # 绘制网格
        grid_size = 50
        for x in range(0, width, grid_size):
            self.map_canvas.create_line(x, 0, x, height, fill='#E0E0E0', dash=(2, 2))
        for y in range(0, height, grid_size):
            self.map_canvas.create_line(0, y, width, y, fill='#E0E0E0', dash=(2, 2))
        
        # 如果没有数据，显示提示
        if not self.parsed_data['operation_points'] and not self.parsed_data['radar_data']:
            self.map_canvas.create_text(
                width/2, height/2,
                text="请导入数据以显示地图视图",
                fill='#999999',
                font=('Arial', 14)
            )
            return
        
        # 计算边界
        all_points = []
        all_points.extend(self.parsed_data['operation_points'])
        all_points.extend(self.parsed_data['radar_data'])
        
        if not all_points:
            return
        
        # 获取经纬度范围
        lats = [p.get('latitude', 0) for p in all_points]
        lons = [p.get('longitude', 0) for p in all_points]
        
        min_lat, max_lat = min(lats), max(lats)
        min_lon, max_lon = min(lons), max(lons)
        
        # 添加边距
        lat_margin = (max_lat - min_lat) * 0.2 if max_lat != min_lat else 0.1
        lon_margin = (max_lon - min_lon) * 0.2 if max_lon != min_lon else 0.1
        
        min_lat -= lat_margin
        max_lat += lat_margin
        min_lon -= lon_margin
        max_lon += lon_margin
        
        # 坐标转换函数
        def lat_to_y(lat):
            if max_lat == min_lat:
                return height / 2
            return height - ((lat - min_lat) / (max_lat - min_lat)) * (height - 40) - 20
        
        def lon_to_x(lon):
            if max_lon == min_lon:
                return width / 2
            return ((lon - min_lon) / (max_lon - min_lon)) * (width - 40) + 20
        
        # 绘制作业点位
        for point in self.parsed_data['operation_points']:
            lat = point.get('latitude', 0)
            lon = point.get('longitude', 0)
            name = point.get('name', '未知点位')
            
            x = lon_to_x(lon)
            y = lat_to_y(lat)
            
            # 绘制点位
            self.map_canvas.create_oval(x-8, y-8, x+8, y+8, fill='#4CAF50', outline='#2E7D32', width=2)
            self.map_canvas.create_text(x, y+15, text=name, fill='#1B5E20', font=('Arial', 10))
        
        # 绘制雷达回波
        for radar in self.parsed_data['radar_data']:
            lat = radar.get('latitude', 0)
            lon = radar.get('longitude', 0)
            reflectivity = radar.get('reflectivity', 0)
            movement_direction = radar.get('movement_direction', 0)
            movement_speed = radar.get('movement_speed', 0)
            
            x = lon_to_x(lon)
            y = lat_to_y(lat)
            
            # 根据反射率确定颜色和大小
            if reflectivity >= 50:
                color = '#F44336'
                size = 25
            elif reflectivity >= 40:
                color = '#FF9800'
                size = 20
            elif reflectivity >= 30:
                color = '#FFEB3B'
                size = 15
            else:
                color = '#9E9E9E'
                size = 10
            
            # 绘制回波
            self.map_canvas.create_oval(x-size, y-size, x+size, y+size, fill=color, outline='', stipple='gray50')
            self.map_canvas.create_text(x, y-size-10, text=f'{reflectivity}dBZ', fill=color, font=('Arial', 9))
            
            # 绘制移动方向箭头
            if movement_speed > 0:
                import math
                angle_rad = math.radians(movement_direction - 90)  # 转换为画布坐标系
                arrow_length = min(movement_speed, 30)
                
                end_x = x + math.cos(angle_rad) * arrow_length
                end_y = y + math.sin(angle_rad) * arrow_length
                
                self.map_canvas.create_line(x, y, end_x, end_y, fill=color, arrow=tk.LAST, width=2)
        
        # 绘制风险区域（如果有风险）
        for risk in self.current_risks:
            if risk.get('category') == 'wind_impact_zone' and risk.get('details'):
                details = risk.get('details', {})
                radar = details.get('radar', {})
                point = details.get('operation_point', {})
                
                if radar and point:
                    radar_lat = radar.get('latitude', 0)
                    radar_lon = radar.get('longitude', 0)
                    point_lat = point.get('latitude', 0)
                    point_lon = point.get('longitude', 0)
                    
                    rx = lon_to_x(radar_lon)
                    ry = lat_to_y(radar_lat)
                    px = lon_to_x(point_lon)
                    py = lat_to_y(point_lat)
                    
                    # 绘制连接线
                    self.map_canvas.create_line(rx, ry, px, py, fill='#F44336', dash=(4, 2), width=2)
        
        # 绘制图例
        legend_y = 10
        self.map_canvas.create_text(15, legend_y, text="图例:", anchor=tk.W, font=('Arial', 10, 'bold'))
        legend_y += 20
        
        # 作业点位
        self.map_canvas.create_oval(15, legend_y-5, 25, legend_y+5, fill='#4CAF50', outline='#2E7D32')
        self.map_canvas.create_text(35, legend_y, text="作业点位", anchor=tk.W, font=('Arial', 9))
        legend_y += 20
        
        # 回波强度
        for label, color, size in [
            (">=50dBZ", '#F44336', 8),
            ("40-50dBZ", '#FF9800', 6),
            ("30-40dBZ", '#FFEB3B', 5),
            ("<30dBZ", '#9E9E9E', 4)
        ]:
            self.map_canvas.create_oval(15, legend_y-size, 15+size*2, legend_y+size, fill=color, outline='')
            self.map_canvas.create_text(35, legend_y, text=label, anchor=tk.W, font=('Arial', 9))
            legend_y += 18
    
    def _update_timeline_display(self):
        """更新时间轴显示"""
        self.timeline_canvas.delete('all')
        
        width = self.timeline_canvas.winfo_width()
        height = self.timeline_canvas.winfo_height()
        
        if width < 10 or height < 10:
            return
        
        # 绘制背景
        self.timeline_canvas.create_rectangle(0, 0, width, height, fill='#FAFAFA', outline='')
        
        # 绘制时间轴线
        axis_y = height // 2
        self.timeline_canvas.create_line(50, axis_y, width-50, axis_y, fill='#666666', width=2)
        
        # 收集所有时间点
        time_events = []
        
        # 空域批复时间
        for approval in self.parsed_data['airspace_approvals']:
            start_time = approval.get('start_time')
            end_time = approval.get('end_time')
            approval_number = approval.get('approval_number', '未知')
            
            if start_time and end_time:
                time_events.append({
                    'type': 'airspace_period',
                    'start': start_time,
                    'end': end_time,
                    'label': f'空域批复 {approval_number}',
                    'color': '#4CAF50'
                })
        
        # 雷达数据时间
        for radar in self.parsed_data['radar_data']:
            time = radar.get('time')
            reflectivity = radar.get('reflectivity', 0)
            
            if time:
                if reflectivity >= 50:
                    color = '#F44336'
                elif reflectivity >= 40:
                    color = '#FF9800'
                elif reflectivity >= 30:
                    color = '#FFEB3B'
                else:
                    color = '#9E9E9E'
                
                time_events.append({
                    'type': 'radar_point',
                    'time': time,
                    'label': f'雷达 {reflectivity}dBZ',
                    'color': color
                })
        
        # 如果没有时间事件，显示提示
        if not time_events:
            self.timeline_canvas.create_text(
                width/2, height/2,
                text="请导入数据以显示时间轴",
                fill='#999999',
                font=('Arial', 12)
            )
            return
        
        # 确定时间范围
        all_times = []
        for event in time_events:
            if event['type'] == 'airspace_period':
                all_times.append(event['start'])
                all_times.append(event['end'])
            else:
                all_times.append(event['time'])
        
        min_time = min(all_times)
        max_time = max(all_times)
        
        # 添加边距
        time_range = max_time - min_time
        if time_range.total_seconds() == 0:
            time_range = timedelta(hours=1)
        
        margin = time_range * 0.1
        min_time -= margin
        max_time += margin
        
        # 时间转换函数
        def time_to_x(t):
            total_seconds = (max_time - min_time).total_seconds()
            if total_seconds == 0:
                return (width - 100) / 2 + 50
            elapsed = (t - min_time).total_seconds()
            return (elapsed / total_seconds) * (width - 100) + 50
        
        # 绘制时间刻度
        tick_count = 5
        total_seconds = (max_time - min_time).total_seconds()
        
        for i in range(tick_count + 1):
            tick_time = min_time + timedelta(seconds=total_seconds * i / tick_count)
            x = time_to_x(tick_time)
            
            # 绘制刻度线
            self.timeline_canvas.create_line(x, axis_y-5, x, axis_y+5, fill='#666666', width=1)
            
            # 绘制时间标签
            time_str = tick_time.strftime('%H:%M')
            self.timeline_canvas.create_text(x, axis_y+15, text=time_str, fill='#666666', font=('Arial', 9))
        
        # 绘制时间段（空域批复）
        period_y = axis_y - 30
        for event in time_events:
            if event['type'] == 'airspace_period':
                start_x = time_to_x(event['start'])
                end_x = time_to_x(event['end'])
                
                # 绘制时间段矩形
                self.timeline_canvas.create_rectangle(
                    start_x, period_y-10, end_x, period_y+10,
                    fill=event['color'], outline='#2E7D32', stipple='gray50'
                )
                
                # 绘制标签
                mid_x = (start_x + end_x) / 2
                self.timeline_canvas.create_text(
                    mid_x, period_y-20,
                    text=event['label'],
                    fill='#1B5E20',
                    font=('Arial', 9)
                )
        
        # 绘制时间点（雷达数据）
        point_y = axis_y + 30
        for event in time_events:
            if event['type'] == 'radar_point':
                x = time_to_x(event['time'])
                
                # 绘制点
                self.timeline_canvas.create_oval(
                    x-6, point_y-6, x+6, point_y+6,
                    fill=event['color'], outline=''
                )
        
        # 绘制当前时间指示器
        now = datetime.now()
        if min_time <= now <= max_time:
            now_x = time_to_x(now)
            self.timeline_canvas.create_line(
                now_x, 10, now_x, height-10,
                fill='#2196F3', width=2, dash=(4, 2)
            )
            self.timeline_canvas.create_text(
                now_x, 5,
                text=f'当前时间 {now.strftime("%H:%M")}',
                fill='#2196F3',
                font=('Arial', 9)
            )
    
    def _on_risk_select(self, event):
        """风险选择事件"""
        selection = self.risk_tree.selection()
        if not selection:
            return
        
        # 获取选中的风险索引
        item_id = selection[0]
        index = self.risk_tree.index(item_id)
        
        if 0 <= index < len(self.current_risks):
            risk = self.current_risks[index]
            self._show_risk_detail(risk)
    
    def _show_risk_detail(self, risk: Dict[str, Any]):
        """显示风险详情"""
        self.detail_text.config(state=tk.NORMAL)
        self.detail_text.delete('1.0', tk.END)
        
        severity = risk.get('severity', 'low')
        severity_name = self.risk_assessor.SEVERITY_NAMES.get(severity, severity)
        category = risk.get('category', 'unknown')
        category_name = self.risk_assessor.CATEGORY_NAMES.get(category, category)
        
        detail = f"风险详情\n"
        detail += "=" * 40 + "\n\n"
        detail += f"严重程度: {severity_name}\n"
        detail += f"类    别: {category_name}\n"
        detail += f"标    题: {risk.get('title', '')}\n\n"
        detail += f"详细描述:\n{risk.get('description', '')}\n\n"
        
        # 显示详细信息
        details = risk.get('details')
        if details:
            detail += "相关数据:\n"
            detail += "-" * 40 + "\n"
            
            if isinstance(details, dict):
                for key, value in details.items():
                    if isinstance(value, dict):
                        detail += f"\n{key}:\n"
                        for k, v in value.items():
                            detail += f"  {k}: {v}\n"
                    else:
                        detail += f"{key}: {value}\n"
            else:
                detail += f"{details}\n"
        
        # 显示时间戳
        timestamp = risk.get('timestamp')
        if timestamp:
            if isinstance(timestamp, datetime):
                timestamp_str = timestamp.strftime('%Y-%m-%d %H:%M:%S')
            else:
                timestamp_str = str(timestamp)
            detail += f"\n\n检测时间: {timestamp_str}"
        
        self.detail_text.insert('1.0', detail)
        self.detail_text.config(state=tk.DISABLED)
    
    def _on_map_resize(self, event):
        """地图调整大小事件"""
        self._update_map_display()
    
    def _update_status(self, message: str):
        """更新状态栏"""
        self.status_bar.config(text=message)
    
    def _show_about(self):
        """显示关于对话框"""
        messagebox.showinfo(
            "关于",
            "人工增雨作业放行盘 v1.0\n\n"
            "用于人工增雨作业前的安全复核\n\n"
            "功能:\n"
            "- 导入CSV/JSON/YAML数据\n"
            "- 风险检查（禁飞时段、风向影响区、弹药过期、资质过期）\n"
            "- 地图和时间轴可视化\n"
            "- 复核、放行/驳回状态管理\n"
            "- 导出放行单、风险清单、审计包"
        )
    
    def _on_close(self):
        """关闭窗口事件"""
        # 检查是否有未保存的更改
        if self.current_session:
            if messagebox.askyesno("确认退出", "是否保存当前会话？"):
                self.state_manager.save_session()
        
        self.root.destroy()
