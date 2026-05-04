#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
预约管理页面
"""

import tkinter as tk
from tkinter import ttk, messagebox
from typing import TYPE_CHECKING, Optional, List, Dict
from datetime import datetime, date

if TYPE_CHECKING:
    from ui.main_window import MainWindow


class BookingPage(ttk.Frame):
    """预约管理页面"""
    
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
            text="📅 实验预约管理",
            style='Title.TLabel'
        ).pack(side=tk.LEFT)
        
        # 工具栏
        toolbar = ttk.Frame(self)
        toolbar.pack(fill=tk.X, pady=5)
        
        ttk.Button(toolbar, text="➕ 新建预约", command=self._new_booking).pack(side=tk.LEFT, padx=2)
        ttk.Button(toolbar, text="✏️ 编辑预约", command=self._edit_booking).pack(side=tk.LEFT, padx=2)
        ttk.Button(toolbar, text="🗑️ 删除预约", command=self._delete_booking, style='Danger.TButton').pack(side=tk.LEFT, padx=2)
        
        ttk.Separator(toolbar, orient=tk.VERTICAL).pack(side=tk.LEFT, fill=tk.Y, padx=10, pady=2)
        
        ttk.Label(toolbar, text="状态筛选:").pack(side=tk.LEFT, padx=5)
        self.status_filter = ttk.Combobox(toolbar, width=12, state='readonly')
        status_options = ['全部', '待审批', '已通过', '已拒绝', '已领用', '已归还', '部分归还']
        self.status_filter['values'] = status_options
        self.status_filter.current(0)
        self.status_filter.pack(side=tk.LEFT, padx=5)
        self.status_filter.bind('<<ComboboxSelected>>', lambda e: self.refresh())
        
        ttk.Button(toolbar, text="🔄 刷新", command=self.refresh).pack(side=tk.LEFT, padx=2)
        
        # 主内容区域
        main_paned = ttk.PanedWindow(self, orient=tk.VERTICAL)
        main_paned.pack(fill=tk.BOTH, expand=True, pady=5)
        
        # 上部分：预约列表
        list_frame = ttk.LabelFrame(main_paned, text="📋 预约列表", padding=5)
        main_paned.add(list_frame, weight=2)
        
        # 创建表格
        columns = (
            'id', 'class_name', 'experiment_name', 'teacher_name',
            'booking_date', 'experiment_date', 'student_count', 'item_count', 'status'
        )
        
        self.booking_tree = ttk.Treeview(
            list_frame,
            columns=columns,
            show='headings',
            height=10
        )
        
        # 设置列头
        self.booking_tree.heading('id', text='编号')
        self.booking_tree.heading('class_name', text='班级')
        self.booking_tree.heading('experiment_name', text='实验名称')
        self.booking_tree.heading('teacher_name', text='任课老师')
        self.booking_tree.heading('booking_date', text='预约日期')
        self.booking_tree.heading('experiment_date', text='实验日期')
        self.booking_tree.heading('student_count', text='人数')
        self.booking_tree.heading('item_count', text='试剂数')
        self.booking_tree.heading('status', text='状态')
        
        # 设置列宽
        self.booking_tree.column('id', width=60, anchor='center')
        self.booking_tree.column('class_name', width=100, anchor='center')
        self.booking_tree.column('experiment_name', width=180)
        self.booking_tree.column('teacher_name', width=100)
        self.booking_tree.column('booking_date', width=100, anchor='center')
        self.booking_tree.column('experiment_date', width=100, anchor='center')
        self.booking_tree.column('student_count', width=60, anchor='center')
        self.booking_tree.column('item_count', width=60, anchor='center')
        self.booking_tree.column('status', width=100, anchor='center')
        
        # 滚动条
        scroll_y = ttk.Scrollbar(list_frame, orient=tk.VERTICAL, command=self.booking_tree.yview)
        self.booking_tree.configure(yscrollcommand=scroll_y.set)
        
        self.booking_tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scroll_y.pack(side=tk.RIGHT, fill=tk.Y)
        
        # 绑定选择事件
        self.booking_tree.bind('<<TreeviewSelect>>', self._on_select)
        
        # 下部分：预约详情
        detail_frame = ttk.LabelFrame(main_paned, text="📝 预约详情（试剂清单）", padding=5)
        main_paned.add(detail_frame, weight=1)
        
        # 试剂清单表格
        item_columns = (
            'reagent_name', 'category', 'danger_level', 'concentration',
            'unit', 'requested_quantity', 'issued_quantity', 'returned_quantity', 'remarks'
        )
        
        self.item_tree = ttk.Treeview(
            detail_frame,
            columns=item_columns,
            show='headings',
            height=6
        )
        
        self.item_tree.heading('reagent_name', text='试剂名称')
        self.item_tree.heading('category', text='类别')
        self.item_tree.heading('danger_level', text='危险等级')
        self.item_tree.heading('concentration', text='浓度/纯度')
        self.item_tree.heading('unit', text='单位')
        self.item_tree.heading('requested_quantity', text='申请量')
        self.item_tree.heading('issued_quantity', text='已发放')
        self.item_tree.heading('returned_quantity', text='已归还')
        self.item_tree.heading('remarks', text='备注')
        
        self.item_tree.column('reagent_name', width=150)
        self.item_tree.column('category', width=80, anchor='center')
        self.item_tree.column('danger_level', width=80, anchor='center')
        self.item_tree.column('concentration', width=100)
        self.item_tree.column('unit', width=60, anchor='center')
        self.item_tree.column('requested_quantity', width=70, anchor='center')
        self.item_tree.column('issued_quantity', width=70, anchor='center')
        self.item_tree.column('returned_quantity', width=70, anchor='center')
        self.item_tree.column('remarks', width=150)
        
        item_scroll = ttk.Scrollbar(detail_frame, orient=tk.VERTICAL, command=self.item_tree.yview)
        self.item_tree.configure(yscrollcommand=item_scroll.set)
        
        self.item_tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        item_scroll.pack(side=tk.RIGHT, fill=tk.Y)
    
    def refresh(self):
        """刷新数据"""
        self._update_booking_list()
        self._clear_items()
    
    def _update_booking_list(self):
        """更新预约列表"""
        for item in self.booking_tree.get_children():
            self.booking_tree.delete(item)
        
        booking_service = self.main_window.booking_service
        
        # 获取筛选条件
        status_filter = self.status_filter.get()
        status_map = {
            '待审批': 'pending',
            '已通过': 'approved',
            '已拒绝': 'rejected',
            '已领用': 'collected',
            '已归还': 'returned',
            '部分归还': 'partial_returned'
        }
        
        status = status_map.get(status_filter) if status_filter != '全部' else None
        bookings = booking_service.get_all_bookings(status)
        
        # 状态名称和颜色
        status_info = self.config.booking_status
        
        category_names = {k: v['name'] for k, v in self.config.reagent_categories.items()}
        danger_names = {k: v['name'] for k, v in self.config.danger_levels.items()}
        
        for b in bookings:
            status_name = status_info.get(b['status'], {}).get('name', b['status'])
            status_color = status_info.get(b['status'], {}).get('color', '#000000')
            
            # 设置标签颜色
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
            
            self.booking_tree.insert('', tk.END, values=(
                b['id'],
                b['class_name'],
                b['experiment_name'],
                b['teacher_name'],
                b['booking_date'],
                b['experiment_date'],
                b['student_count'],
                b.get('item_count', 0),
                status_name
            ), tags=tags, iid=b['id'])
        
        # 设置标签颜色
        self.booking_tree.tag_configure('pending', foreground='#FF8C00')
        self.booking_tree.tag_configure('approved', foreground='#228B22')
        self.booking_tree.tag_configure('rejected', foreground='#FF4444')
        self.booking_tree.tag_configure('collected', foreground='#1E90FF')
        self.booking_tree.tag_configure('returned', foreground='#9370DB')
    
    def _on_select(self, event):
        """选择事件"""
        selection = self.booking_tree.selection()
        if selection:
            booking_id = int(selection[0])
            self.main_window.current_booking_id = booking_id
            self._show_booking_items(booking_id)
    
    def _show_booking_items(self, booking_id: int):
        """显示预约的试剂清单"""
        for item in self.item_tree.get_children():
            self.item_tree.delete(item)
        
        booking_service = self.main_window.booking_service
        items = booking_service.get_booking_items(booking_id)
        
        category_names = {k: v['name'] for k, v in self.config.reagent_categories.items()}
        danger_names = {k: v['name'] for k, v in self.config.danger_levels.items()}
        
        for item in items:
            # 组合浓度/纯度
            conc_parts = []
            if item.get('reagent_concentration'):
                conc_parts.append(item['reagent_concentration'])
            conc = '/'.join(conc_parts) if conc_parts else '-'
            
            # 危险等级标签
            danger_level = item['reagent_danger_level']
            tags = ()
            if danger_level == 1:
                tags = ('high_risk',)
            elif danger_level == 2:
                tags = ('medium_risk',)
            
            self.item_tree.insert('', tk.END, values=(
                item['reagent_name'],
                category_names.get(item['reagent_category'], item['reagent_category']),
                danger_names.get(danger_level, f'等级{danger_level}'),
                conc,
                item['reagent_unit'],
                item['requested_quantity'],
                item['issued_quantity'] or 0,
                item['returned_quantity'] or 0,
                item['remarks'] or '-'
            ), tags=tags)
        
        # 设置标签颜色
        self.item_tree.tag_configure('high_risk', foreground='#FF4444')
        self.item_tree.tag_configure('medium_risk', foreground='#FF8C00')
    
    def _clear_items(self):
        """清空试剂清单"""
        for item in self.item_tree.get_children():
            self.item_tree.delete(item)
    
    def _new_booking(self):
        """新建预约"""
        self._show_booking_dialog(None)
    
    def _edit_booking(self):
        """编辑预约"""
        selection = self.booking_tree.selection()
        if not selection:
            messagebox.showwarning('提示', '请先选择要编辑的预约')
            return
        
        booking_id = int(selection[0])
        
        # 检查是否可以编辑
        booking_service = self.main_window.booking_service
        booking = booking_service.get_booking(booking_id)
        
        if not booking:
            messagebox.showerror('错误', '预约不存在')
            return
        
        # 只有待审批状态可以编辑
        if booking['status'] != 'pending':
            messagebox.showwarning('提示', '只有待审批状态的预约可以编辑')
            return
        
        self._show_booking_dialog(booking_id)
    
    def _delete_booking(self):
        """删除预约"""
        selection = self.booking_tree.selection()
        if not selection:
            messagebox.showwarning('提示', '请先选择要删除的预约')
            return
        
        if not messagebox.askyesno('确认', '确定要删除选中的预约吗？'):
            return
        
        booking_id = int(selection[0])
        booking_service = self.main_window.booking_service
        
        if booking_service.delete_booking(booking_id):
            messagebox.showinfo('成功', '预约已删除')
            self.refresh()
        else:
            messagebox.showerror('错误', '删除失败。只有待审批状态的预约可以删除。')
    
    def _show_booking_dialog(self, booking_id: Optional[int]):
        """显示预约编辑对话框"""
        # 这里简化处理，实际项目中可以创建完整的对话框
        messagebox.showinfo(
            '提示', 
            '预约编辑功能可以在此实现。\n\n'
            '功能包括：\n'
            '- 选择班级\n'
            '- 输入实验名称、日期、人数\n'
            '- 从试剂库中选择需要的试剂\n'
            '- 填写申请数量\n\n'
            '当前系统已预置示例预约数据供测试。'
        )
