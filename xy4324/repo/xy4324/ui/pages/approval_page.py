#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
审批管理页面
"""

import tkinter as tk
from tkinter import ttk, messagebox, scrolledtext
from typing import TYPE_CHECKING, Optional
from datetime import datetime

if TYPE_CHECKING:
    from ui.main_window import MainWindow


class ApprovalPage(ttk.Frame):
    """审批管理页面"""
    
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
            text="✅ 审批管理",
            style='Title.TLabel'
        ).pack(side=tk.LEFT)
        
        # 主内容区域
        main_paned = ttk.PanedWindow(self, orient=tk.HORIZONTAL)
        main_paned.pack(fill=tk.BOTH, expand=True, pady=5)
        
        # 左侧：待审批列表
        left_frame = ttk.LabelFrame(main_paned, text="📋 待审批预约", padding=5)
        main_paned.add(left_frame, weight=1)
        
        # 创建待审批表格
        pending_columns = (
            'id', 'class_name', 'experiment_name', 'teacher_name',
            'experiment_date', 'student_count', 'item_count'
        )
        
        self.pending_tree = ttk.Treeview(
            left_frame,
            columns=pending_columns,
            show='headings',
            height=12
        )
        
        self.pending_tree.heading('id', text='编号')
        self.pending_tree.heading('class_name', text='班级')
        self.pending_tree.heading('experiment_name', text='实验名称')
        self.pending_tree.heading('teacher_name', text='任课老师')
        self.pending_tree.heading('experiment_date', text='实验日期')
        self.pending_tree.heading('student_count', text='人数')
        self.pending_tree.heading('item_count', text='试剂数')
        
        self.pending_tree.column('id', width=50, anchor='center')
        self.pending_tree.column('class_name', width=80, anchor='center')
        self.pending_tree.column('experiment_name', width=150)
        self.pending_tree.column('teacher_name', width=80)
        self.pending_tree.column('experiment_date', width=90, anchor='center')
        self.pending_tree.column('student_count', width=50, anchor='center')
        self.pending_tree.column('item_count', width=50, anchor='center')
        
        pending_scroll = ttk.Scrollbar(left_frame, orient=tk.VERTICAL, command=self.pending_tree.yview)
        self.pending_tree.configure(yscrollcommand=pending_scroll.set)
        
        self.pending_tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        pending_scroll.pack(side=tk.RIGHT, fill=tk.Y)
        
        # 绑定选择事件
        self.pending_tree.bind('<<TreeviewSelect>>', self._on_select_pending)
        
        # 右侧：详情和安全检查
        right_frame = ttk.LabelFrame(main_paned, text="📝 预约详情与安全检查", padding=5)
        main_paned.add(right_frame, weight=2)
        
        # 创建右侧布局
        right_paned = ttk.PanedWindow(right_frame, orient=tk.VERTICAL)
        right_paned.pack(fill=tk.BOTH, expand=True)
        
        # 上部：预约信息和试剂清单
        info_frame = ttk.LabelFrame(right_paned, text="预约信息", padding=5)
        right_paned.add(info_frame, weight=1)
        
        # 预约基本信息
        info_details = ttk.Frame(info_frame)
        info_details.pack(fill=tk.X, pady=5)
        
        ttk.Label(info_details, text="班级:", font=('Microsoft YaHei', 10, 'bold')).grid(row=0, column=0, sticky='w', padx=5)
        self.info_class = ttk.Label(info_details, text="-")
        self.info_class.grid(row=0, column=1, sticky='w', padx=5)
        
        ttk.Label(info_details, text="实验名称:", font=('Microsoft YaHei', 10, 'bold')).grid(row=0, column=2, sticky='w', padx=5)
        self.info_experiment = ttk.Label(info_details, text="-")
        self.info_experiment.grid(row=0, column=3, sticky='w', padx=5)
        
        ttk.Label(info_details, text="任课老师:", font=('Microsoft YaHei', 10)).grid(row=0, column=4, sticky='w', padx=5)
        self.info_teacher = ttk.Label(info_details, text="-")
        self.info_teacher.grid(row=0, column=5, sticky='w', padx=5)
        
        ttk.Label(info_details, text="实验日期:", font=('Microsoft YaHei', 10)).grid(row=1, column=0, sticky='w', padx=5, pady=3)
        self.info_date = ttk.Label(info_details, text="-")
        self.info_date.grid(row=1, column=1, sticky='w', padx=5, pady=3)
        
        ttk.Label(info_details, text="学生人数:", font=('Microsoft YaHei', 10)).grid(row=1, column=2, sticky='w', padx=5, pady=3)
        self.info_students = ttk.Label(info_details, text="-")
        self.info_students.grid(row=1, column=3, sticky='w', padx=5, pady=3)
        
        # 试剂清单表格
        reagent_columns = (
            'name', 'danger_level', 'category', 'concentration',
            'unit', 'requested', 'available', 'location'
        )
        
        self.reagent_tree = ttk.Treeview(
            info_frame,
            columns=reagent_columns,
            show='headings',
            height=5
        )
        
        self.reagent_tree.heading('name', text='试剂名称')
        self.reagent_tree.heading('danger_level', text='危险等级')
        self.reagent_tree.heading('category', text='类别')
        self.reagent_tree.heading('concentration', text='浓度')
        self.reagent_tree.heading('unit', text='单位')
        self.reagent_tree.heading('requested', text='申请量')
        self.reagent_tree.heading('available', text='可用库存')
        self.reagent_tree.heading('location', text='存放位置')
        
        self.reagent_tree.column('name', width=120)
        self.reagent_tree.column('danger_level', width=70, anchor='center')
        self.reagent_tree.column('category', width=70, anchor='center')
        self.reagent_tree.column('concentration', width=80)
        self.reagent_tree.column('unit', width=50, anchor='center')
        self.reagent_tree.column('requested', width=60, anchor='center')
        self.reagent_tree.column('available', width=70, anchor='center')
        self.reagent_tree.column('location', width=80)
        
        reagent_scroll = ttk.Scrollbar(info_frame, orient=tk.VERTICAL, command=self.reagent_tree.yview)
        self.reagent_tree.configure(yscrollcommand=reagent_scroll.set)
        
        self.reagent_tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, pady=5)
        reagent_scroll.pack(side=tk.RIGHT, fill=tk.Y, pady=5)
        
        # 中部：安全检查结果
        safety_frame = ttk.LabelFrame(right_paned, text="🔒 安全检查结果", padding=5)
        right_paned.add(safety_frame, weight=1)
        
        # 安全检查按钮
        btn_frame = ttk.Frame(safety_frame)
        btn_frame.pack(fill=tk.X, pady=5)
        
        ttk.Button(btn_frame, text="🔍 执行安全检查", command=self._run_safety_check).pack(side=tk.LEFT, padx=5)
        
        # 安全检查结果显示
        self.safety_text = scrolledtext.ScrolledText(
            safety_frame,
            wrap=tk.WORD,
            font=('Microsoft YaHei', 10),
            height=8
        )
        self.safety_text.pack(fill=tk.BOTH, expand=True, pady=5)
        
        # 底部：审批操作
        action_frame = ttk.LabelFrame(right_frame, text="⚡ 审批操作", padding=10)
        action_frame.pack(fill=tk.X, pady=5)
        
        # 审批人
        ttk.Label(action_frame, text="审批人:").grid(row=0, column=0, sticky='w', padx=5)
        self.approver_var = tk.StringVar(value="管理员")
        self.approver_entry = ttk.Entry(action_frame, textvariable=self.approver_var, width=20)
        self.approver_entry.grid(row=0, column=1, sticky='w', padx=5)
        
        ttk.Label(action_frame, text="审批意见:").grid(row=0, column=2, sticky='w', padx=5)
        self.comments_entry = ttk.Entry(action_frame, width=40)
        self.comments_entry.grid(row=0, column=3, sticky='w', padx=5)
        
        # 按钮
        btn_frame2 = ttk.Frame(action_frame)
        btn_frame2.grid(row=1, column=0, columnspan=4, pady=10)
        
        ttk.Button(
            btn_frame2,
            text="✅ 通过审批",
            command=lambda: self._do_approval(True),
            style='Success.TButton'
        ).pack(side=tk.LEFT, padx=10)
        
        ttk.Button(
            btn_frame2,
            text="❌ 拒绝审批",
            command=lambda: self._do_approval(False),
            style='Danger.TButton'
        ).pack(side=tk.LEFT, padx=10)
        
        ttk.Button(
            btn_frame2,
            text="📄 导出交接单",
            command=self._export_handover
        ).pack(side=tk.LEFT, padx=10)
        
        # 配置列权重
        for i in range(4):
            action_frame.columnconfigure(i, weight=1)
    
    def refresh(self):
        """刷新数据"""
        self._update_pending_list()
        self._clear_details()
        
        # 如果有当前选中的预约，加载它
        if self.main_window.current_booking_id:
            # 检查是否还在待审批列表
            items = self.pending_tree.get_children()
            if str(self.main_window.current_booking_id) in items:
                self.pending_tree.selection_set(str(self.main_window.current_booking_id))
                self._load_booking_details(self.main_window.current_booking_id)
    
    def _update_pending_list(self):
        """更新待审批列表"""
        for item in self.pending_tree.get_children():
            self.pending_tree.delete(item)
        
        approval_service = self.main_window.approval_service
        pending = approval_service.get_pending_approvals()
        
        for b in pending:
            self.pending_tree.insert('', tk.END, values=(
                b['id'],
                b['class_name'],
                b['experiment_name'],
                b['teacher_name'],
                b['experiment_date'],
                b['student_count'],
                b.get('item_count', 0)
            ), iid=b['id'])
    
    def _on_select_pending(self, event):
        """选择待审批预约"""
        selection = self.pending_tree.selection()
        if selection:
            booking_id = int(selection[0])
            self.main_window.current_booking_id = booking_id
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
        self.info_teacher.config(text=booking['teacher_name'] or booking.get('class_teacher', ''))
        self.info_date.config(text=booking['experiment_date'])
        self.info_students.config(text=str(booking['student_count']))
        
        # 显示试剂清单
        for item in self.reagent_tree.get_children():
            self.reagent_tree.delete(item)
        
        items = booking_service.get_booking_items(booking_id)
        
        category_names = {k: v['name'] for k, v in self.config.reagent_categories.items()}
        danger_names = {k: v['name'] for k, v in self.config.danger_levels.items()}
        
        for item in items:
            danger_level = item['reagent_danger_level']
            tags = ()
            if danger_level == 1:
                tags = ('high_risk',)
            elif danger_level == 2:
                tags = ('medium_risk',)
            
            self.reagent_tree.insert('', tk.END, values=(
                item['reagent_name'],
                danger_names.get(danger_level, f'等级{danger_level}'),
                category_names.get(item['reagent_category'], item['reagent_category']),
                item['reagent_concentration'] or '-',
                item['reagent_unit'],
                item['requested_quantity'],
                item['reagent_available'],
                item.get('reagent_location', '-')
            ), tags=tags)
        
        # 设置标签颜色
        self.reagent_tree.tag_configure('high_risk', foreground='#FF4444')
        self.reagent_tree.tag_configure('medium_risk', foreground='#FF8C00')
        
        # 清空安全检查结果
        self.safety_text.delete(1.0, tk.END)
        self.safety_text.insert(tk.END, "请点击「执行安全检查」按钮查看安全检查结果。\n")
    
    def _clear_details(self):
        """清空详情"""
        self.info_class.config(text='-')
        self.info_experiment.config(text='-')
        self.info_teacher.config(text='-')
        self.info_date.config(text='-')
        self.info_students.config(text='-')
        
        for item in self.reagent_tree.get_children():
            self.reagent_tree.delete(item)
        
        self.safety_text.delete(1.0, tk.END)
    
    def _run_safety_check(self):
        """执行安全检查"""
        selection = self.pending_tree.selection()
        if not selection:
            messagebox.showwarning('提示', '请先选择要检查的预约')
            return
        
        booking_id = int(selection[0])
        
        self.safety_text.delete(1.0, tk.END)
        self.safety_text.insert(tk.END, f"正在执行安全检查...\n预约编号: {booking_id}\n{'='*50}\n\n")
        
        # 执行安全检查
        safety_service = self.main_window.safety_service
        results, all_safe = safety_service.check_all_safety(booking_id)
        
        # 显示结果
        approval_service = self.main_window.approval_service
        formatted = approval_service.format_safety_results(results)
        
        self.safety_text.insert(tk.END, formatted)
        self.safety_text.insert(tk.END, f"\n{'='*50}\n")
        
        if all_safe:
            self.safety_text.insert(tk.END, "✅ 所有安全检查通过！\n", 'success')
        else:
            has_blocking = any(r.is_blocking() for r in results)
            if has_blocking:
                self.safety_text.insert(tk.END, "❌ 存在阻断性问题，无法通过审批！\n", 'danger')
            else:
                self.safety_text.insert(tk.END, "⚠️ 存在警告问题，请确认后再审批。\n", 'warning')
        
        # 配置标签颜色
        self.safety_text.tag_configure('success', foreground='#228B22', font=('Microsoft YaHei', 10, 'bold'))
        self.safety_text.tag_configure('warning', foreground='#FF8C00', font=('Microsoft YaHei', 10, 'bold'))
        self.safety_text.tag_configure('danger', foreground='#FF4444', font=('Microsoft YaHei', 10, 'bold'))
    
    def _do_approval(self, is_approved: bool):
        """执行审批"""
        selection = self.pending_tree.selection()
        if not selection:
            messagebox.showwarning('提示', '请先选择要审批的预约')
            return
        
        booking_id = int(selection[0])
        approver = self.approver_var.get().strip()
        
        if not approver:
            messagebox.showwarning('提示', '请输入审批人姓名')
            return
        
        # 确认
        action = "通过" if is_approved else "拒绝"
        if not messagebox.askyesno('确认', f'确定要{action}该预约吗？'):
            return
        
        # 执行审批
        approval_service = self.main_window.approval_service
        comments = self.comments_entry.get().strip()
        
        result = approval_service.perform_approval(booking_id, approver, is_approved, comments)
        
        if result['success']:
            messagebox.showinfo('成功', result['message'])
            self.refresh()
        else:
            messagebox.showerror('错误', result['message'])
    
    def _export_handover(self):
        """导出交接单"""
        selection = self.pending_tree.selection()
        if not selection:
            # 也可以选择其他已审批的预约
            pass
        
        # 简化处理，提示功能
        messagebox.showinfo(
            '导出交接单',
            '此功能将导出Markdown格式的安全交接单。\n\n'
            '包含内容：\n'
            '- 预约基本信息\n'
            '- 试剂详细清单（含危险等级）\n'
            '- 安全注意事项\n'
            '- 交接签名区域\n\n'
            '可通过菜单「文件」→「导出库存台账/预约记录」导出CSV文件。'
        )
