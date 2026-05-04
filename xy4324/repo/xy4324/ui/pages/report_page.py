#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
报表导出页面
"""

import tkinter as tk
from tkinter import ttk, messagebox, filedialog
from typing import TYPE_CHECKING
from datetime import datetime, date, timedelta

if TYPE_CHECKING:
    from ui.main_window import MainWindow


class ReportPage(ttk.Frame):
    """报表导出页面"""
    
    def __init__(self, parent, main_window: 'MainWindow'):
        super().__init__(parent)
        
        self.main_window = main_window
        self.config = main_window.config
        
        self._create_widgets()
    
    def _create_widgets(self):
        """创建界面组件"""
        # 标题
        title_frame = ttk.Frame(self)
        title_frame.pack(fill=tk.X, pady=(0, 10))
        
        ttk.Label(
            title_frame,
            text="📋 报表导出",
            style='Title.TLabel'
        ).pack(side=tk.LEFT)
        
        # 主内容区域
        main_frame = ttk.Frame(self)
        main_frame.pack(fill=tk.BOTH, expand=True, pady=5)
        
        # 左侧：导出功能区
        left_frame = ttk.LabelFrame(main_frame, text="📊 导出功能", padding=10)
        left_frame.pack(side=tk.LEFT, fill=tk.Y, padx=5, pady=5)
        
        # 数据概览卡片
        overview_frame = ttk.LabelFrame(left_frame, text="数据概览", padding=10)
        overview_frame.pack(fill=tk.X, pady=5)
        
        # 统计信息
        self.stats_labels = {}
        stats = [
            ('试剂总数', 'reagent_count'),
            ('待审批预约', 'pending_bookings'),
            ('已领用预约', 'collected_bookings'),
            ('已完成预约', 'completed_bookings'),
        ]
        
        for label_text, key in stats:
            stat_row = ttk.Frame(overview_frame)
            stat_row.pack(fill=tk.X, pady=3)
            
            ttk.Label(stat_row, text=f"{label_text}:", width=15).pack(side=tk.LEFT)
            
            value_label = ttk.Label(stat_row, text="0", font=('Microsoft YaHei', 10, 'bold'))
            value_label.pack(side=tk.LEFT, padx=10)
            
            self.stats_labels[key] = value_label
        
        # 导出区域
        export_frame = ttk.LabelFrame(left_frame, text="导出功能", padding=10)
        export_frame.pack(fill=tk.BOTH, expand=True, pady=5)
        
        # 库存台账导出
        inventory_frame = ttk.LabelFrame(export_frame, text="📦 库存台账", padding=5)
        inventory_frame.pack(fill=tk.X, pady=5)
        
        ttk.Label(
            inventory_frame,
            text="导出完整的试剂库存台账，包含所有试剂信息、库存数量、有效期等。",
            foreground='#666666',
            wraplength=200,
            justify='left'
        ).pack(anchor='w', pady=3)
        
        ttk.Button(
            inventory_frame,
            text="📤 导出库存台账 CSV",
            command=self._export_inventory
        ).pack(anchor='w', pady=5)
        
        # 预约记录导出
        booking_frame = ttk.LabelFrame(export_frame, text="📅 预约记录", padding=5)
        booking_frame.pack(fill=tk.X, pady=5)
        
        ttk.Label(
            booking_frame,
            text="导出实验预约记录，可以按日期范围筛选。",
            foreground='#666666',
            wraplength=200,
            justify='left'
        ).pack(anchor='w', pady=3)
        
        # 日期范围选择
        date_frame = ttk.Frame(booking_frame)
        date_frame.pack(fill=tk.X, pady=3)
        
        ttk.Label(date_frame, text="开始日期:").pack(side=tk.LEFT)
        self.start_date_var = tk.StringVar()
        self.start_date_entry = ttk.Entry(date_frame, textvariable=self.start_date_var, width=12)
        self.start_date_entry.pack(side=tk.LEFT, padx=3)
        
        ttk.Label(date_frame, text="结束日期:").pack(side=tk.LEFT, padx=(10, 0))
        self.end_date_var = tk.StringVar()
        self.end_date_entry = ttk.Entry(date_frame, textvariable=self.end_date_var, width=12)
        self.end_date_entry.pack(side=tk.LEFT, padx=3)
        
        # 设置默认日期（本月1日到今天）
        today = date.today()
        first_day = today.replace(day=1)
        self.start_date_var.set(first_day.strftime("%Y-%m-%d"))
        self.end_date_var.set(today.strftime("%Y-%m-%d"))
        
        ttk.Button(
            booking_frame,
            text="📤 导出预约记录 CSV",
            command=self._export_bookings
        ).pack(anchor='w', pady=5)
        
        # 交接单导出
        handover_frame = ttk.LabelFrame(export_frame, text="📄 安全交接单", padding=5)
        handover_frame.pack(fill=tk.X, pady=5)
        
        ttk.Label(
            handover_frame,
            text="导出Markdown格式的安全交接单，包含预约信息、试剂清单、安全注意事项、签名区域等。",
            foreground='#666666',
            wraplength=200,
            justify='left'
        ).pack(anchor='w', pady=3)
        
        # 选择预约
        select_frame = ttk.Frame(handover_frame)
        select_frame.pack(fill=tk.X, pady=3)
        
        ttk.Label(select_frame, text="选择预约:").pack(side=tk.LEFT)
        self.booking_combobox = ttk.Combobox(select_frame, width=25, state='readonly')
        self.booking_combobox.pack(side=tk.LEFT, padx=5)
        
        ttk.Button(
            handover_frame,
            text="📄 导出安全交接单 MD",
            command=self._export_handover
        ).pack(anchor='w', pady=5)
        
        # 右侧：最近的活动记录
        right_frame = ttk.LabelFrame(main_frame, text="📋 最近的活动记录", padding=10)
        right_frame.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, padx=5, pady=5)
        
        # 选项卡
        self.notebook = ttk.Notebook(right_frame)
        self.notebook.pack(fill=tk.BOTH, expand=True)
        
        # 选项卡1：最近的预约
        bookings_tab = ttk.Frame(self.notebook)
        self.notebook.add(bookings_tab, text="📅 最近预约")
        
        # 创建预约表格
        booking_columns = (
            'id', 'class_name', 'experiment_name', 'teacher_name',
            'experiment_date', 'status'
        )
        
        self.bookings_tree = ttk.Treeview(
            bookings_tab,
            columns=booking_columns,
            show='headings',
            height=15
        )
        
        self.bookings_tree.heading('id', text='编号')
        self.bookings_tree.heading('class_name', text='班级')
        self.bookings_tree.heading('experiment_name', text='实验名称')
        self.bookings_tree.heading('teacher_name', text='任课老师')
        self.bookings_tree.heading('experiment_date', text='实验日期')
        self.bookings_tree.heading('status', text='状态')
        
        self.bookings_tree.column('id', width=50, anchor='center')
        self.bookings_tree.column('class_name', width=100, anchor='center')
        self.bookings_tree.column('experiment_name', width=180)
        self.bookings_tree.column('teacher_name', width=80)
        self.bookings_tree.column('experiment_date', width=100, anchor='center')
        self.bookings_tree.column('status', width=100, anchor='center')
        
        bookings_scroll = ttk.Scrollbar(bookings_tab, orient=tk.VERTICAL, command=self.bookings_tree.yview)
        self.bookings_tree.configure(yscrollcommand=bookings_scroll.set)
        
        self.bookings_tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        bookings_scroll.pack(side=tk.RIGHT, fill=tk.Y)
        
        # 选项卡2：库存预警
        alerts_tab = ttk.Frame(self.notebook)
        self.notebook.add(alerts_tab, text="⚠️ 库存预警")
        
        # 创建预警表格
        alert_columns = (
            'type', 'name', 'message'
        )
        
        self.alerts_tree = ttk.Treeview(
            alerts_tab,
            columns=alert_columns,
            show='headings',
            height=15
        )
        
        self.alerts_tree.heading('type', text='类型')
        self.alerts_tree.heading('name', text='试剂名称')
        self.alerts_tree.heading('message', text='详情')
        
        self.alerts_tree.column('type', width=100, anchor='center')
        self.alerts_tree.column('name', width=150)
        self.alerts_tree.column('message', width=350)
        
        alerts_scroll = ttk.Scrollbar(alerts_tab, orient=tk.VERTICAL, command=self.alerts_tree.yview)
        self.alerts_tree.configure(yscrollcommand=alerts_scroll.set)
        
        self.alerts_tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        alerts_scroll.pack(side=tk.RIGHT, fill=tk.Y)
        
        # 选项卡3：试剂统计
        stats_tab = ttk.Frame(self.notebook)
        self.notebook.add(stats_tab, text="📊 试剂统计")
        
        # 按危险等级统计
        danger_frame = ttk.LabelFrame(stats_tab, text="按危险等级统计", padding=10)
        danger_frame.pack(fill=tk.X, pady=5)
        
        self.danger_stats_label = ttk.Label(
            danger_frame,
            text="加载中...",
            font=('Microsoft YaHei', 10)
        )
        self.danger_stats_label.pack(anchor='w')
        
        # 按类别统计
        category_frame = ttk.LabelFrame(stats_tab, text="按类别统计", padding=10)
        category_frame.pack(fill=tk.BOTH, expand=True, pady=5)
        
        self.category_stats_label = ttk.Label(
            category_frame,
            text="加载中...",
            font=('Microsoft YaHei', 10)
        )
        self.category_stats_label.pack(anchor='w')
    
    def refresh(self):
        """刷新数据"""
        self._update_stats()
        self._update_bookings_list()
        self._update_alerts_list()
        self._update_booking_combobox()
        self._update_stats_tab()
    
    def _update_stats(self):
        """更新统计数据"""
        booking_service = self.main_window.booking_service
        reagent_service = self.main_window.reagent_service
        
        # 试剂总数
        reagents = reagent_service.get_all_reagents()
        self.stats_labels['reagent_count'].config(text=str(len(reagents)))
        
        # 待审批预约
        pending = booking_service.get_all_bookings(status='pending')
        self.stats_labels['pending_bookings'].config(text=str(len(pending)))
        
        # 已领用预约
        collected = booking_service.get_all_bookings(status='collected')
        self.stats_labels['collected_bookings'].config(text=str(len(collected)))
        
        # 已完成预约（已归还）
        returned = booking_service.get_all_bookings(status='returned')
        partial = booking_service.get_all_bookings(status='partial_returned')
        self.stats_labels['completed_bookings'].config(text=str(len(returned) + len(partial)))
    
    def _update_bookings_list(self):
        """更新预约列表"""
        for item in self.bookings_tree.get_children():
            self.bookings_tree.delete(item)
        
        booking_service = self.main_window.booking_service
        bookings = booking_service.get_all_bookings()
        
        # 状态信息
        status_info = self.config.booking_status
        
        for b in bookings:
            status_name = status_info.get(b['status'], {}).get('name', b['status'])
            
            # 标签颜色
            tags = ()
            if b['status'] == 'pending':
                tags = ('pending',)
            elif b['status'] == 'approved':
                tags = ('approved',)
            elif b['status'] == 'rejected':
                tags = ('rejected',)
            elif b['status'] == 'collected':
                tags = ('collected',)
            elif b['status'] in ['returned', 'partial_returned']:
                tags = ('returned',)
            
            self.bookings_tree.insert('', tk.END, values=(
                b['id'],
                b['class_name'],
                b['experiment_name'],
                b['teacher_name'],
                b['experiment_date'],
                status_name
            ), tags=tags)
        
        # 设置标签颜色
        self.bookings_tree.tag_configure('pending', foreground='#FF8C00')
        self.bookings_tree.tag_configure('approved', foreground='#228B22')
        self.bookings_tree.tag_configure('rejected', foreground='#FF4444')
        self.bookings_tree.tag_configure('collected', foreground='#1E90FF')
        self.bookings_tree.tag_configure('returned', foreground='#9370DB')
    
    def _update_alerts_list(self):
        """更新预警列表"""
        for item in self.alerts_tree.get_children():
            self.alerts_tree.delete(item)
        
        reagent_service = self.main_window.reagent_service
        
        # 低库存
        low_stock = reagent_service.get_low_stock_reagents()
        for r in low_stock:
            self.alerts_tree.insert('', tk.END, values=(
                '低库存',
                r['name'],
                f"可用: {r['available_quantity']}{r['unit']}, 安全库存: {r['minimum_quantity']}{r['unit']}"
            ), tags=('danger',))
        
        # 即将过期
        expiring = reagent_service.get_expiring_reagents(days=30)
        for r in expiring:
            days = int(r.get('days_remaining', 0))
            self.alerts_tree.insert('', tk.END, values=(
                '即将过期',
                r['name'],
                f"有效期: {r['expiry_date']}, 剩余 {days} 天"
            ), tags=('warning',))
        
        # 设置标签颜色
        self.alerts_tree.tag_configure('danger', foreground='#FF4444')
        self.alerts_tree.tag_configure('warning', foreground='#FF8C00')
    
    def _update_booking_combobox(self):
        """更新预约选择下拉框"""
        booking_service = self.main_window.booking_service
        bookings = booking_service.get_all_bookings()
        
        # 构建选项
        values = []
        self.booking_ids = []
        
        for b in bookings:
            display = f"#{b['id']} - {b['class_name']} - {b['experiment_name']}"
            values.append(display)
            self.booking_ids.append(b['id'])
        
        self.booking_combobox['values'] = values
        
        if values:
            self.booking_combobox.current(0)
    
    def _update_stats_tab(self):
        """更新统计选项卡"""
        reagent_service = self.main_window.reagent_service
        reagents = reagent_service.get_all_reagents()
        
        # 按危险等级统计
        danger_counts = {1: 0, 2: 0, 3: 0, 4: 0}
        for r in reagents:
            level = r['danger_level']
            if level in danger_counts:
                danger_counts[level] += 1
        
        danger_names = {
            1: '🔴 高危险',
            2: '🟠 中危险',
            3: '🟡 低危险',
            4: '🟢 一般'
        }
        
        danger_text = "按危险等级统计：\n"
        for level in [1, 2, 3, 4]:
            danger_text += f"  {danger_names[level]}: {danger_counts[level]} 种\n"
        
        self.danger_stats_label.config(text=danger_text)
        
        # 按类别统计
        category_names = {k: v['name'] for k, v in self.config.reagent_categories.items()}
        category_counts = {k: 0 for k in category_names.keys()}
        
        for r in reagents:
            cat = r['category']
            if cat in category_counts:
                category_counts[cat] += 1
        
        category_text = "按类别统计：\n"
        for cat, name in category_names.items():
            category_text += f"  {name}: {category_counts[cat]} 种\n"
        
        self.category_stats_label.config(text=category_text)
    
    def _export_inventory(self):
        """导出库存台账"""
        export_service = self.main_window.export_service
        default_name = export_service.generate_filename('inventory', 'csv')
        
        file_path = filedialog.asksaveasfilename(
            title='保存库存台账',
            initialfile=default_name,
            defaultextension='.csv',
            filetypes=[('CSV文件', '*.csv'), ('所有文件', '*.*')]
        )
        
        if not file_path:
            return
        
        try:
            export_service.export_inventory_csv(file_path)
            messagebox.showinfo('成功', f'库存台账已保存至:\n{file_path}')
        except Exception as e:
            messagebox.showerror('错误', f'导出失败:\n{str(e)}')
    
    def _export_bookings(self):
        """导出预约记录"""
        # 解析日期
        try:
            start_date_text = self.start_date_var.get().strip()
            end_date_text = self.end_date_var.get().strip()
            
            start_date = None
            end_date = None
            
            if start_date_text:
                start_date = datetime.strptime(start_date_text, "%Y-%m-%d").date()
            if end_date_text:
                end_date = datetime.strptime(end_date_text, "%Y-%m-%d").date()
        
        except ValueError:
            messagebox.showwarning('提示', '日期格式错误，请使用 YYYY-MM-DD 格式')
            return
        
        export_service = self.main_window.export_service
        default_name = export_service.generate_filename('bookings', 'csv')
        
        file_path = filedialog.asksaveasfilename(
            title='保存预约记录',
            initialfile=default_name,
            defaultextension='.csv',
            filetypes=[('CSV文件', '*.csv'), ('所有文件', '*.*')]
        )
        
        if not file_path:
            return
        
        try:
            export_service.export_bookings_csv(file_path, start_date, end_date)
            messagebox.showinfo('成功', f'预约记录已保存至:\n{file_path}')
        except Exception as e:
            messagebox.showerror('错误', f'导出失败:\n{str(e)}')
    
    def _export_handover(self):
        """导出安全交接单"""
        selection = self.booking_combobox.current()
        if selection < 0:
            messagebox.showwarning('提示', '请选择要导出的预约')
            return
        
        booking_id = self.booking_ids[selection]
        
        export_service = self.main_window.export_service
        default_name = export_service.generate_filename(f'handover_{booking_id}', 'md')
        
        file_path = filedialog.asksaveasfilename(
            title='保存安全交接单',
            initialfile=default_name,
            defaultextension='.md',
            filetypes=[('Markdown文件', '*.md'), ('所有文件', '*.*')]
        )
        
        if not file_path:
            return
        
        try:
            export_service.export_booking_markdown(booking_id, file_path)
            messagebox.showinfo('成功', f'安全交接单已保存至:\n{file_path}')
        except Exception as e:
            messagebox.showerror('错误', f'导出失败:\n{str(e)}')
