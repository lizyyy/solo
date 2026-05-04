#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
领用登记页面
"""

import tkinter as tk
from tkinter import ttk, messagebox
from typing import TYPE_CHECKING
from datetime import datetime

if TYPE_CHECKING:
    from ui.main_window import MainWindow


class CollectionPage(ttk.Frame):
    """领用登记页面"""
    
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
            text="📤 领用登记",
            style='Title.TLabel'
        ).pack(side=tk.LEFT)
        
        # 说明
        ttk.Label(
            title_frame,
            text="对已通过审批的预约进行领用登记",
            foreground='#666666'
        ).pack(side=tk.LEFT, padx=20)
        
        # 主内容区域
        main_paned = ttk.PanedWindow(self, orient=tk.HORIZONTAL)
        main_paned.pack(fill=tk.BOTH, expand=True, pady=5)
        
        # 左侧：已通过审批的预约列表
        left_frame = ttk.LabelFrame(main_paned, text="📋 已通过审批的预约", padding=5)
        main_paned.add(left_frame, weight=1)
        
        # 创建表格
        columns = (
            'id', 'class_name', 'experiment_name', 'teacher_name',
            'experiment_date', 'student_count', 'item_count'
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
        self.booking_tree.heading('student_count', text='人数')
        self.booking_tree.heading('item_count', text='试剂数')
        
        self.booking_tree.column('id', width=50, anchor='center')
        self.booking_tree.column('class_name', width=80, anchor='center')
        self.booking_tree.column('experiment_name', width=150)
        self.booking_tree.column('teacher_name', width=80)
        self.booking_tree.column('experiment_date', width=90, anchor='center')
        self.booking_tree.column('student_count', width=50, anchor='center')
        self.booking_tree.column('item_count', width=50, anchor='center')
        
        scroll_y = ttk.Scrollbar(left_frame, orient=tk.VERTICAL, command=self.booking_tree.yview)
        self.booking_tree.configure(yscrollcommand=scroll_y.set)
        
        self.booking_tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scroll_y.pack(side=tk.RIGHT, fill=tk.Y)
        
        # 绑定选择事件
        self.booking_tree.bind('<<TreeviewSelect>>', self._on_select_booking)
        
        # 右侧：领用详情
        right_frame = ttk.LabelFrame(main_paned, text="📝 领用详情", padding=5)
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
        
        ttk.Label(info_details, text="实验日期:", font=('Microsoft YaHei', 10)).grid(row=0, column=4, sticky='w', padx=5)
        self.info_date = ttk.Label(info_details, text="-")
        self.info_date.grid(row=0, column=5, sticky='w', padx=5)
        
        # 试剂清单
        reagent_frame = ttk.LabelFrame(right_frame, text="试剂清单（可修改实际发放数量）", padding=5)
        reagent_frame.pack(fill=tk.BOTH, expand=True, pady=5)
        
        # 创建表格
        reagent_columns = (
            'id', 'name', 'danger_level', 'category', 'concentration',
            'unit', 'requested', 'available', 'issued', 'location'
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
        self.reagent_tree.heading('category', text='类别')
        self.reagent_tree.heading('concentration', text='浓度')
        self.reagent_tree.heading('unit', text='单位')
        self.reagent_tree.heading('requested', text='申请量')
        self.reagent_tree.heading('available', text='可用库存')
        self.reagent_tree.heading('issued', text='实际发放')
        self.reagent_tree.heading('location', text='存放位置')
        
        self.reagent_tree.column('id', width=40, anchor='center')
        self.reagent_tree.column('name', width=120)
        self.reagent_tree.column('danger_level', width=70, anchor='center')
        self.reagent_tree.column('category', width=70, anchor='center')
        self.reagent_tree.column('concentration', width=80)
        self.reagent_tree.column('unit', width=50, anchor='center')
        self.reagent_tree.column('requested', width=60, anchor='center')
        self.reagent_tree.column('available', width=70, anchor='center')
        self.reagent_tree.column('issued', width=70, anchor='center')
        self.reagent_tree.column('location', width=80)
        
        reagent_scroll = ttk.Scrollbar(reagent_frame, orient=tk.VERTICAL, command=self.reagent_tree.yview)
        self.reagent_tree.configure(yscrollcommand=reagent_scroll.set)
        
        self.reagent_tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        reagent_scroll.pack(side=tk.RIGHT, fill=tk.Y)
        
        # 安全提示
        warning_frame = ttk.LabelFrame(right_frame, text="⚠️ 安全提示", padding=5)
        warning_frame.pack(fill=tk.X, pady=5)
        
        self.warning_text = ttk.Label(
            warning_frame,
            text="请选择一个预约查看详情。\n领用前请执行安全检查，确认试剂数量、有效期、相容性等。",
            foreground='#FF8C00',
            justify='left'
        )
        self.warning_text.pack(anchor='w')
        
        # 操作区
        action_frame = ttk.LabelFrame(right_frame, text="⚡ 领用操作", padding=10)
        action_frame.pack(fill=tk.X, pady=5)
        
        # 领用人
        ttk.Label(action_frame, text="领用人:").grid(row=0, column=0, sticky='w', padx=5)
        self.collector_var = tk.StringVar()
        self.collector_entry = ttk.Entry(action_frame, textvariable=self.collector_var, width=20)
        self.collector_entry.grid(row=0, column=1, sticky='w', padx=5)
        
        ttk.Label(action_frame, text="备注:").grid(row=0, column=2, sticky='w', padx=5)
        self.remarks_entry = ttk.Entry(action_frame, width=40)
        self.remarks_entry.grid(row=0, column=3, sticky='w', padx=5)
        
        # 按钮
        btn_frame = ttk.Frame(action_frame)
        btn_frame.grid(row=1, column=0, columnspan=4, pady=10)
        
        ttk.Button(
            btn_frame,
            text="🔍 执行安全检查",
            command=self._run_safety_check
        ).pack(side=tk.LEFT, padx=5)
        
        ttk.Button(
            btn_frame,
            text="📄 导出交接单",
            command=self._export_handover
        ).pack(side=tk.LEFT, padx=5)
        
        ttk.Button(
            btn_frame,
            text="✅ 确认领用",
            command=self._confirm_collection,
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
        """更新已通过审批的预约列表"""
        for item in self.booking_tree.get_children():
            self.booking_tree.delete(item)
        
        booking_service = self.main_window.booking_service
        
        # 获取已通过审批但未领用的预约
        approved = booking_service.get_all_bookings(status='approved')
        
        for b in approved:
            self.booking_tree.insert('', tk.END, values=(
                b['id'],
                b['class_name'],
                b['experiment_name'],
                b['teacher_name'],
                b['experiment_date'],
                b['student_count'],
                b.get('item_count', 0)
            ), iid=b['id'])
    
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
        self.info_date.config(text=booking['experiment_date'])
        
        # 显示试剂清单
        for item in self.reagent_tree.get_children():
            self.reagent_tree.delete(item)
        
        items = booking_service.get_booking_items(booking_id)
        
        category_names = {k: v['name'] for k, v in self.config.reagent_categories.items()}
        danger_names = {k: v['name'] for k, v in self.config.danger_levels.items()}
        
        # 检查是否有高危险试剂
        has_high_risk = any(i['reagent_danger_level'] == 1 for i in items)
        
        for item in items:
            danger_level = item['reagent_danger_level']
            tags = ()
            if danger_level == 1:
                tags = ('high_risk',)
            elif danger_level == 2:
                tags = ('medium_risk',)
            
            self.reagent_tree.insert('', tk.END, values=(
                item['id'],  # booking_item id
                item['reagent_name'],
                danger_names.get(danger_level, f'等级{danger_level}'),
                category_names.get(item['reagent_category'], item['reagent_category']),
                item['reagent_concentration'] or '-',
                item['reagent_unit'],
                item['requested_quantity'],
                item['reagent_available'],
                item['requested_quantity'],  # 默认实际发放=申请量
                item.get('reagent_location', '-')
            ), tags=tags)
        
        # 设置标签颜色
        self.reagent_tree.tag_configure('high_risk', foreground='#FF4444')
        self.reagent_tree.tag_configure('medium_risk', foreground='#FF8C00')
        
        # 更新安全提示
        if has_high_risk:
            self.warning_text.config(
                text="⚠️ 【重要提醒】本次领用包含高危险试剂！\n"
                     "   - 请双人双锁管理\n"
                     "   - 请详细记录领用和归还\n"
                     "   - 使用时需有老师在场\n\n"
                     "请执行安全检查确认库存、有效期、相容性等。",
                foreground='#FF4444'
            )
        else:
            self.warning_text.config(
                text="请执行安全检查确认库存、有效期、相容性等。\n"
                     "确认无误后点击「确认领用」完成登记。",
                foreground='#FF8C00'
            )
    
    def _clear_details(self):
        """清空详情"""
        self.info_class.config(text='-')
        self.info_experiment.config(text='-')
        self.info_date.config(text='-')
        
        for item in self.reagent_tree.get_children():
            self.reagent_tree.delete(item)
        
        self.warning_text.config(
            text="请选择一个预约查看详情。\n领用前请执行安全检查，确认试剂数量、有效期、相容性等。",
            foreground='#FF8C00'
        )
    
    def _run_safety_check(self):
        """执行安全检查"""
        selection = self.booking_tree.selection()
        if not selection:
            messagebox.showwarning('提示', '请先选择要检查的预约')
            return
        
        booking_id = int(selection[0])
        
        # 执行安全检查
        safety_service = self.main_window.safety_service
        results, all_safe = safety_service.check_all_safety(booking_id)
        
        # 格式化显示结果
        approval_service = self.main_window.approval_service
        formatted = approval_service.format_safety_results(results)
        
        # 显示结果对话框
        has_blocking = any(r.is_blocking() for r in results)
        
        if has_blocking:
            messagebox.showerror(
                '安全检查结果 - 存在阻断性问题',
                f"预约编号: {booking_id}\n\n{formatted}\n\n"
                "❌ 存在阻断性问题，无法进行领用！\n"
                "请先解决库存不足、过期等问题后再操作。"
            )
        elif not all_safe:
            if messagebox.askyesno(
                '安全检查结果 - 存在警告',
                f"预约编号: {booking_id}\n\n{formatted}\n\n"
                "⚠️ 存在警告问题，是否继续领用？\n\n"
                "建议确认警告信息后再操作。"
            ):
                pass
        else:
            messagebox.showinfo(
                '安全检查结果 - 全部通过',
                f"预约编号: {booking_id}\n\n{formatted}\n\n"
                "✅ 所有安全检查通过！\n可以进行领用登记。"
            )
    
    def _confirm_collection(self):
        """确认领用"""
        selection = self.booking_tree.selection()
        if not selection:
            messagebox.showwarning('提示', '请先选择要领用的预约')
            return
        
        booking_id = int(selection[0])
        collector = self.collector_var.get().strip()
        
        if not collector:
            messagebox.showwarning('提示', '请输入领用人姓名')
            return
        
        # 确认
        if not messagebox.askyesno('确认领用', f'确认登记领用吗？\n领用人: {collector}'):
            return
        
        # 获取试剂发放数量
        issued_quantities = {}
        for item_id in self.reagent_tree.get_children():
            values = self.reagent_tree.item(item_id, 'values')
            booking_item_id = int(values[0])
            issued = float(values[8])  # 实际发放
            issued_quantities[booking_item_id] = issued
        
        # 执行领用
        booking_service = self.main_window.booking_service
        
        try:
            booking_service.collect_reagents(
                booking_id,
                collector,
                issued_quantities
            )
            
            messagebox.showinfo('成功', '领用登记完成！')
            self.refresh()
            self.collector_var.set('')
            self.remarks_entry.delete(0, tk.END)
            
        except Exception as e:
            messagebox.showerror('错误', f'领用登记失败:\n{str(e)}')
    
    def _export_handover(self):
        """导出交接单"""
        selection = self.booking_tree.selection()
        if not selection:
            messagebox.showwarning('提示', '请先选择要导出的预约')
            return
        
        booking_id = int(selection[0])
        
        # 选择保存路径
        from tkinter import filedialog
        export_service = self.main_window.export_service
        default_name = export_service.generate_filename(f'handover_{booking_id}', 'md')
        
        file_path = filedialog.asksaveasfilename(
            title='保存交接单',
            initialfile=default_name,
            defaultextension='.md',
            filetypes=[('Markdown文件', '*.md'), ('所有文件', '*.*')]
        )
        
        if not file_path:
            return
        
        try:
            export_service.export_booking_markdown(booking_id, file_path)
            messagebox.showinfo('成功', f'交接单已保存至:\n{file_path}')
        except Exception as e:
            messagebox.showerror('错误', f'导出失败:\n{str(e)}')
