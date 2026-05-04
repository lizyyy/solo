#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
首页仪表盘
"""

import tkinter as tk
from tkinter import ttk
from typing import TYPE_CHECKING
from datetime import datetime, timedelta

if TYPE_CHECKING:
    from ui.main_window import MainWindow


class DashboardPage(ttk.Frame):
    """首页仪表盘"""
    
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
            text="🧪 试剂领用安全闸 - 中学化学实验室管理系统",
            style='Title.TLabel'
        ).pack(side=tk.LEFT)
        
        ttk.Label(
            title_frame,
            text=f"当前时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
            style='Header.TLabel'
        ).pack(side=tk.RIGHT)
        
        # 统计卡片区域
        stats_frame = ttk.LabelFrame(self, text="📊 数据概览", padding=10)
        stats_frame.pack(fill=tk.X, pady=5)
        
        # 创建统计卡片
        self.stats_labels = {}
        stats = [
            ('试剂总数', 'reagent_count', '#4169E1'),
            ('待审批预约', 'pending_bookings', '#FF8C00'),
            ('已领用', 'collected_bookings', '#1E90FF'),
            ('今日预约', 'today_bookings', '#228B22'),
            ('低库存预警', 'low_stock', '#FF4444'),
            ('即将过期', 'expiring_soon', '#FF6B6B'),
        ]
        
        for idx, (label_text, key, color) in enumerate(stats):
            card = ttk.Frame(stats_frame, relief=tk.RIDGE, borderwidth=2)
            card.grid(row=0, column=idx, padx=10, pady=5, sticky='nsew')
            
            ttk.Label(
                card,
                text=label_text,
                font=('Microsoft YaHei', 10)
            ).pack(pady=(5, 0))
            
            value_label = ttk.Label(
                card,
                text="0",
                font=('Microsoft YaHei', 24, 'bold'),
                foreground=color
            )
            value_label.pack(pady=(0, 5))
            
            self.stats_labels[key] = value_label
        
        # 配置网格权重
        for i in range(len(stats)):
            stats_frame.columnconfigure(i, weight=1)
        
        # 待处理事项区域
        alerts_frame = ttk.LabelFrame(self, text="⚠️ 待处理事项", padding=10)
        alerts_frame.pack(fill=tk.BOTH, expand=True, pady=5)
        
        # 创建两个列：待审批预约 和 低库存/过期预警
        paned = ttk.PanedWindow(alerts_frame, orient=tk.HORIZONTAL)
        paned.pack(fill=tk.BOTH, expand=True)
        
        # 左侧：待审批预约
        pending_frame = ttk.LabelFrame(paned, text="📋 待审批预约", padding=5)
        paned.add(pending_frame, weight=1)
        
        # 创建表格
        pending_columns = ('id', 'class_name', 'experiment_name', 'teacher_name', 'experiment_date')
        self.pending_tree = ttk.Treeview(
            pending_frame, 
            columns=pending_columns,
            show='headings',
            height=8
        )
        
        # 设置列
        self.pending_tree.heading('id', text='编号')
        self.pending_tree.heading('class_name', text='班级')
        self.pending_tree.heading('experiment_name', text='实验名称')
        self.pending_tree.heading('teacher_name', text='任课老师')
        self.pending_tree.heading('experiment_date', text='实验日期')
        
        self.pending_tree.column('id', width=60, anchor='center')
        self.pending_tree.column('class_name', width=100, anchor='center')
        self.pending_tree.column('experiment_name', width=180)
        self.pending_tree.column('teacher_name', width=100)
        self.pending_tree.column('experiment_date', width=120, anchor='center')
        
        # 添加滚动条
        pending_scroll = ttk.Scrollbar(pending_frame, orient=tk.VERTICAL, command=self.pending_tree.yview)
        self.pending_tree.configure(yscrollcommand=pending_scroll.set)
        
        self.pending_tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        pending_scroll.pack(side=tk.RIGHT, fill=tk.Y)
        
        # 双击打开审批
        self.pending_tree.bind('<Double-1>', self._on_pending_double_click)
        
        # 右侧：低库存和过期预警
        alert_frame = ttk.LabelFrame(paned, text="🔔 库存预警", padding=5)
        paned.add(alert_frame, weight=1)
        
        # 创建预警列表
        alert_columns = ('type', 'name', 'message')
        self.alert_tree = ttk.Treeview(
            alert_frame,
            columns=alert_columns,
            show='headings',
            height=8
        )
        
        self.alert_tree.heading('type', text='类型')
        self.alert_tree.heading('name', text='试剂名称')
        self.alert_tree.heading('message', text='详情')
        
        self.alert_tree.column('type', width=80, anchor='center')
        self.alert_tree.column('name', width=120)
        self.alert_tree.column('message', width=250)
        
        alert_scroll = ttk.Scrollbar(alert_frame, orient=tk.VERTICAL, command=self.alert_tree.yview)
        self.alert_tree.configure(yscrollcommand=alert_scroll.set)
        
        self.alert_tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        alert_scroll.pack(side=tk.RIGHT, fill=tk.Y)
        
        # 快捷操作区
        quick_frame = ttk.LabelFrame(self, text="⚡ 快捷操作", padding=10)
        quick_frame.pack(fill=tk.X, pady=5)
        
        quick_buttons = [
            ('📝 新建预约', lambda: self.main_window.show_page('booking')),
            ('🧪 查看库存', lambda: self.main_window.show_page('reagent')),
            ('✅ 审批管理', lambda: self.main_window.show_page('approval')),
            ('📊 报表导出', lambda: self.main_window.show_page('report')),
        ]
        
        for idx, (text, command) in enumerate(quick_buttons):
            btn = ttk.Button(
                quick_frame,
                text=text,
                command=command,
                style='Primary.TButton'
            )
            btn.grid(row=0, column=idx, padx=10, pady=5)
    
    def refresh(self):
        """刷新数据"""
        # 更新统计数据
        self._update_stats()
        
        # 更新待审批列表
        self._update_pending_list()
        
        # 更新预警列表
        self._update_alerts()
    
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
        
        # 已领用
        collected = booking_service.get_all_bookings(status='collected')
        self.stats_labels['collected_bookings'].config(text=str(len(collected)))
        
        # 今日预约
        today = datetime.now().date()
        today_bookings = booking_service.get_bookings_by_date(today, today)
        self.stats_labels['today_bookings'].config(text=str(len(today_bookings)))
        
        # 低库存预警
        low_stock = reagent_service.get_low_stock_reagents()
        self.stats_labels['low_stock'].config(text=str(len(low_stock)))
        
        # 即将过期
        expiring = reagent_service.get_expiring_reagents(days=30)
        self.stats_labels['expiring_soon'].config(text=str(len(expiring)))
    
    def _update_pending_list(self):
        """更新待审批列表"""
        # 清空现有数据
        for item in self.pending_tree.get_children():
            self.pending_tree.delete(item)
        
        booking_service = self.main_window.booking_service
        pending = booking_service.get_all_bookings(status='pending')
        
        for b in pending:
            self.pending_tree.insert('', tk.END, values=(
                b['id'],
                b['class_name'],
                b['experiment_name'],
                b['teacher_name'],
                b['experiment_date']
            ), iid=b['id'])
    
    def _update_alerts(self):
        """更新预警列表"""
        # 清空现有数据
        for item in self.alert_tree.get_children():
            self.alert_tree.delete(item)
        
        reagent_service = self.main_window.reagent_service
        
        # 低库存
        low_stock = reagent_service.get_low_stock_reagents()
        for r in low_stock:
            self.alert_tree.insert('', tk.END, values=(
                '低库存',
                r['name'],
                f"可用: {r['available_quantity']}{r['unit']}, 安全库存: {r['minimum_quantity']}{r['unit']}"
            ), tags=('danger',))
        
        # 即将过期
        expiring = reagent_service.get_expiring_reagents(days=30)
        for r in expiring:
            days = int(r.get('days_remaining', 0))
            self.alert_tree.insert('', tk.END, values=(
                '即将过期',
                r['name'],
                f"有效期: {r['expiry_date']}, 剩余 {days} 天"
            ), tags=('warning',))
        
        # 设置标签颜色
        self.alert_tree.tag_configure('danger', foreground='#FF4444')
        self.alert_tree.tag_configure('warning', foreground='#FF8C00')
    
    def _on_pending_double_click(self, event):
        """双击待审批预约"""
        selection = self.pending_tree.selection()
        if selection:
            booking_id = int(selection[0])
            self.main_window.current_booking_id = booking_id
            self.main_window.show_page('approval')
