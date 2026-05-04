#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
归还登记页面
"""

import tkinter as tk
from tkinter import ttk, messagebox
from typing import TYPE_CHECKING
from datetime import datetime

if TYPE_CHECKING:
    from ui.main_window import MainWindow


class ReturnPage(ttk.Frame):
    """归还登记页面"""
    
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
            text="📥 归还登记",
            style='Title.TLabel'
        ).pack(side=tk.LEFT)
        
        # 说明
        ttk.Label(
            title_frame,
            text="对已领用的试剂进行归还登记",
            foreground='#666666'
        ).pack(side=tk.LEFT, padx=20)
        
        # 主内容区域
        main_paned = ttk.PanedWindow(self, orient=tk.HORIZONTAL)
        main_paned.pack(fill=tk.BOTH, expand=True, pady=5)
        
        # 左侧：已领用的预约列表
        left_frame = ttk.LabelFrame(main_paned, text="📋 已领用的预约", padding=5)
        main_paned.add(left_frame, weight=1)
        
        # 状态筛选
        filter_frame = ttk.Frame(left_frame)
        filter_frame.pack(fill=tk.X, pady=5)
        
        ttk.Label(filter_frame, text="状态筛选:").pack(side=tk.LEFT, padx=5)
        self.status_filter = ttk.Combobox(filter_frame, width=15, state='readonly')
        self.status_filter['values'] = ['全部', '已领用(未归还)', '部分归还']
        self.status_filter.current(0)
        self.status_filter.pack(side=tk.LEFT, padx=5)
        self.status_filter.bind('<<ComboboxSelected>>', lambda e: self.refresh())
        
        ttk.Button(filter_frame, text="🔄 刷新", command=self.refresh).pack(side=tk.LEFT, padx=10)
        
        # 创建表格
        columns = (
            'id', 'class_name', 'experiment_name', 'teacher_name',
            'experiment_date', 'status'
        )
        
        self.booking_tree = ttk.Treeview(
            left_frame,
            columns=columns,
            show='headings',
            height=12
        )
        
        self.booking_tree.heading('id', text='编号')
        self.booking_tree.heading('class_name', text='班级')
        self.booking_tree.heading('experiment_name', text='实验名称')
        self.booking_tree.heading('teacher_name', text='任课老师')
        self.booking_tree.heading('experiment_date', text='实验日期')
        self.booking_tree.heading('status', text='状态')
        
        self.booking_tree.column('id', width=50, anchor='center')
        self.booking_tree.column('class_name', width=100, anchor='center')
        self.booking_tree.column('experiment_name', width=180)
        self.booking_tree.column('teacher_name', width=80)
        self.booking_tree.column('experiment_date', width=100, anchor='center')
        self.booking_tree.column('status', width=100, anchor='center')
        
        scroll_y = ttk.Scrollbar(left_frame, orient=tk.VERTICAL, command=self.booking_tree.yview)
        self.booking_tree.configure(yscrollcommand=scroll_y.set)
        
        self.booking_tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scroll_y.pack(side=tk.RIGHT, fill=tk.Y)
        
        # 绑定选择事件
        self.booking_tree.bind('<<TreeviewSelect>>', self._on_select_booking)
        
        # 右侧：归还详情
        right_frame = ttk.LabelFrame(main_paned, text="📝 归还详情", padding=5)
        main_paned.add(right_frame, weight=2)
        
        # 预约基本信息
        info_frame = ttk.LabelFrame(right_frame, text="预约信息", padding=5)
        info_frame.pack(fill=tk.X, pady=5)
        
        info_details = ttk.Frame(info_frame)
        info_details.pack(fill=tk.X)
        
        ttk.Label(info_details, text="班级:", font=('Microsoft YaHei', 10, 'bold')).grid(row=0, column=0, sticky='w', padx=5)
        self.info_class = ttk.Label(info_details, text="-")
        self.info_class.grid(row=0, column=1, sticky='w', padx=5)
        
        ttk.Label(info_details, text="实验名称:", font=('Microsoft YaHei', 10, 'bold')).grid(row=0, column=2, sticky='w', padx=5)
        self.info_experiment = ttk.Label(info_details, text="-")
        self.info_experiment.grid(row=0, column=3, sticky='w', padx=5)
        
        ttk.Label(info_details, text="当前状态:", font=('Microsoft YaHei', 10)).grid(row=0, column=4, sticky='w', padx=5)
        self.info_status = ttk.Label(info_details, text="-")
        self.info_status.grid(row=0, column=5, sticky='w', padx=5)
        
        # 试剂归还清单
        reagent_frame = ttk.LabelFrame(right_frame, text="试剂归还清单", padding=5)
        reagent_frame.pack(fill=tk.BOTH, expand=True, pady=5)
        
        # 创建表格
        reagent_columns = (
            'id', 'name', 'danger_level', 'unit',
            'issued', 'returned_before', 'to_return', 'condition'
        )
        
        self.reagent_tree = ttk.Treeview(
            reagent_frame,
            columns=reagent_columns,
            show='headings',
            height=6
        )
        
        self.reagent_tree.heading('id', text='ID')
        self.reagent_tree.heading('name', text='试剂名称')
        self.reagent_tree.heading('danger_level', text='危险等级')
        self.reagent_tree.heading('unit', text='单位')
        self.reagent_tree.heading('issued', text='已发放')
        self.reagent_tree.heading('returned_before', text='已归还')
        self.reagent_tree.heading('to_return', text='本次归还')
        self.reagent_tree.heading('condition', text='状态')
        
        self.reagent_tree.column('id', width=40, anchor='center')
        self.reagent_tree.column('name', width=150)
        self.reagent_tree.column('danger_level', width=70, anchor='center')
        self.reagent_tree.column('unit', width=50, anchor='center')
        self.reagent_tree.column('issued', width=60, anchor='center')
        self.reagent_tree.column('returned_before', width=60, anchor='center')
        self.reagent_tree.column('to_return', width=70, anchor='center')
        self.reagent_tree.column('condition', width=100, anchor='center')
        
        reagent_scroll = ttk.Scrollbar(reagent_frame, orient=tk.VERTICAL, command=self.reagent_tree.yview)
        self.reagent_tree.configure(yscrollcommand=reagent_scroll.set)
        
        self.reagent_tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        reagent_scroll.pack(side=tk.RIGHT, fill=tk.Y)
        
        # 归还说明
        note_frame = ttk.LabelFrame(right_frame, text="📋 归还说明", padding=5)
        note_frame.pack(fill=tk.X, pady=5)
        
        note_text = (
            "归还注意事项:\n"
            "1. 高危险试剂必须双人归还确认\n"
            "2. 剩余试剂必须密封保存，标签清晰\n"
            "3. 如实记录剩余量和试剂状态\n"
            "4. 清洁实验区域后再完成归还登记"
        )
        
        self.note_label = ttk.Label(
            note_frame,
            text=note_text,
            foreground='#666666',
            justify='left'
        )
        self.note_label.pack(anchor='w')
        
        # 操作区
        action_frame = ttk.LabelFrame(right_frame, text="⚡ 归还操作", padding=10)
        action_frame.pack(fill=tk.X, pady=5)
        
        # 归还人
        ttk.Label(action_frame, text="归还人:").grid(row=0, column=0, sticky='w', padx=5)
        self.returner_var = tk.StringVar()
        self.returner_entry = ttk.Entry(action_frame, textvariable=self.returner_var, width=20)
        self.returner_entry.grid(row=0, column=1, sticky='w', padx=5)
        
        ttk.Label(action_frame, text="备注:").grid(row=0, column=2, sticky='w', padx=5)
        self.remarks_entry = ttk.Entry(action_frame, width=40)
        self.remarks_entry.grid(row=0, column=3, sticky='w', padx=5)
        
        # 按钮
        btn_frame = ttk.Frame(action_frame)
        btn_frame.grid(row=1, column=0, columnspan=4, pady=10)
        
        ttk.Button(
            btn_frame,
            text="✅ 确认归还",
            command=self._confirm_return,
            style='Success.TButton'
        ).pack(side=tk.LEFT, padx=5)
        
        # 配置列权重
        for i in range(4):
            action_frame.columnconfigure(i, weight=1)
    
    def refresh(self):
        """刷新数据"""
        self._update_booking_list()
        self._clear_details()
    
    def _update_booking_list(self):
        """更新已领用的预约列表"""
        for item in self.booking_tree.get_children():
            self.booking_tree.delete(item)
        
        booking_service = self.main_window.booking_service
        
        # 获取筛选条件
        status_filter = self.status_filter.get()
        
        # 获取对应状态的预约
        if status_filter == '已领用(未归还)':
            bookings = booking_service.get_all_bookings(status='collected')
        elif status_filter == '部分归还':
            bookings = booking_service.get_all_bookings(status='partial_returned')
        else:
            # 全部（已领用和部分归还）
            bookings_collected = booking_service.get_all_bookings(status='collected')
            bookings_partial = booking_service.get_all_bookings(status='partial_returned')
            bookings = bookings_collected + bookings_partial
        
        # 状态信息
        status_info = self.config.booking_status
        
        for b in bookings:
            status_name = status_info.get(b['status'], {}).get('name', b['status'])
            
            # 标签颜色
            tags = ()
            if b['status'] == 'collected':
                tags = ('collected',)
            elif b['status'] == 'partial_returned':
                tags = ('partial',)
            
            self.booking_tree.insert('', tk.END, values=(
                b['id'],
                b['class_name'],
                b['experiment_name'],
                b['teacher_name'],
                b['experiment_date'],
                status_name
            ), tags=tags, iid=b['id'])
        
        # 设置标签颜色
        self.booking_tree.tag_configure('collected', foreground='#1E90FF')
        self.booking_tree.tag_configure('partial', foreground='#DDA0DD')
    
    def _on_select_booking(self, event):
        """选择预约"""
        selection = self.booking_tree.selection()
        if selection:
            booking_id = int(selection[0])
            self._load_booking_details(booking_id)
    
    def _load_booking_details(self, booking_id: int):
        """加载预约详情"""
        booking_service = self.main_window.booking_service
        booking = booking_service.get_booking(booking_id)
        
        if not booking:
            return
        
        # 显示基本信息
        self.info_class.config(text=booking['class_name'])
        self.info_experiment.config(text=booking['experiment_name'])
        
        status_info = self.config.booking_status
        status_name = status_info.get(booking['status'], {}).get('name', booking['status'])
        self.info_status.config(text=status_name)
        
        # 显示试剂清单
        for item in self.reagent_tree.get_children():
            self.reagent_tree.delete(item)
        
        items = booking_service.get_booking_items(booking_id)
        
        danger_names = {k: v['name'] for k, v in self.config.danger_levels.items()}
        
        for item in items:
            # 只显示有发放的试剂
            issued = item.get('issued_quantity', 0)
            if issued <= 0:
                continue
            
            danger_level = item['reagent_danger_level']
            tags = ()
            if danger_level == 1:
                tags = ('high_risk',)
            elif danger_level == 2:
                tags = ('medium_risk',)
            
            returned_before = item.get('returned_quantity', 0)
            remaining = issued - returned_before
            
            # 默认本次归还=剩余未归还
            to_return = remaining
            
            self.reagent_tree.insert('', tk.END, values=(
                item['id'],  # booking_item id
                item['reagent_name'],
                danger_names.get(danger_level, f'等级{danger_level}'),
                item['reagent_unit'],
                issued,
                returned_before,
                to_return,
                '良好'
            ), tags=tags)
        
        # 设置标签颜色
        self.reagent_tree.tag_configure('high_risk', foreground='#FF4444')
        self.reagent_tree.tag_configure('medium_risk', foreground='#FF8C00')
    
    def _clear_details(self):
        """清空详情"""
        self.info_class.config(text='-')
        self.info_experiment.config(text='-')
        self.info_status.config(text='-')
        
        for item in self.reagent_tree.get_children():
            self.reagent_tree.delete(item)
    
    def _confirm_return(self):
        """确认归还"""
        selection = self.booking_tree.selection()
        if not selection:
            messagebox.showwarning('提示', '请先选择要归还的预约')
            return
        
        booking_id = int(selection[0])
        returner = self.returner_var.get().strip()
        
        if not returner:
            messagebox.showwarning('提示', '请输入归还人姓名')
            return
        
        # 确认
        if not messagebox.askyesno('确认归还', f'确认登记归还吗？\n归还人: {returner}'):
            return
        
        # 构建归还数据
        returned_items = []
        for item_id in self.reagent_tree.get_children():
            values = self.reagent_tree.item(item_id, 'values')
            booking_item_id = int(values[0])
            to_return = float(values[6])  # 本次归还
            condition = values[7]  # 状态
            
            if to_return > 0:
                returned_items.append({
                    'booking_item_id': booking_item_id,
                    'returned_quantity': to_return,
                    'condition': condition
                })
        
        if not returned_items:
            messagebox.showwarning('提示', '没有要归还的试剂')
            return
        
        # 执行归还
        booking_service = self.main_window.booking_service
        remarks = self.remarks_entry.get().strip()
        
        try:
            booking_service.return_reagents(
                booking_id,
                returner,
                returned_items
            )
            
            messagebox.showinfo('成功', '归还登记完成！')
            self.refresh()
            self.returner_var.set('')
            self.remarks_entry.delete(0, tk.END)
            
        except Exception as e:
            messagebox.showerror('错误', f'归还登记失败:\n{str(e)}')
