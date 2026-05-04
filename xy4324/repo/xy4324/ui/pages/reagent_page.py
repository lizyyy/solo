#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
试剂库存管理页面
"""

import tkinter as tk
from tkinter import ttk, messagebox, filedialog
from typing import TYPE_CHECKING, Optional, List
from datetime import datetime

if TYPE_CHECKING:
    from ui.main_window import MainWindow


class ReagentPage(ttk.Frame):
    """试剂库存管理页面"""
    
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
            text="🧪 试剂库存管理",
            style='Title.TLabel'
        ).pack(side=tk.LEFT)
        
        # 工具栏
        toolbar = ttk.Frame(self)
        toolbar.pack(fill=tk.X, pady=5)
        
        # 搜索框
        ttk.Label(toolbar, text="搜索:").pack(side=tk.LEFT, padx=5)
        self.search_var = tk.StringVar()
        self.search_entry = ttk.Entry(toolbar, textvariable=self.search_var, width=30)
        self.search_entry.pack(side=tk.LEFT, padx=5)
        
        ttk.Button(toolbar, text="🔍 搜索", command=self._do_search).pack(side=tk.LEFT, padx=2)
        ttk.Button(toolbar, text="🔄 重置", command=self._reset_search).pack(side=tk.LEFT, padx=2)
        
        ttk.Separator(toolbar, orient=tk.VERTICAL).pack(side=tk.LEFT, fill=tk.Y, padx=10, pady=2)
        
        # 操作按钮
        ttk.Button(toolbar, text="➕ 添加", command=self._add_reagent).pack(side=tk.LEFT, padx=2)
        ttk.Button(toolbar, text="✏️ 编辑", command=self._edit_reagent).pack(side=tk.LEFT, padx=2)
        ttk.Button(toolbar, text="🗑️ 删除", command=self._delete_reagent, style='Danger.TButton').pack(side=tk.LEFT, padx=2)
        
        ttk.Separator(toolbar, orient=tk.VERTICAL).pack(side=tk.LEFT, fill=tk.Y, padx=10, pady=2)
        
        ttk.Button(toolbar, text="📥 导入CSV", command=self._import_csv).pack(side=tk.LEFT, padx=2)
        ttk.Button(toolbar, text="📤 导出CSV", command=self._export_csv).pack(side=tk.LEFT, padx=2)
        
        # 危险等级筛选
        ttk.Separator(toolbar, orient=tk.VERTICAL).pack(side=tk.LEFT, fill=tk.Y, padx=10, pady=2)
        
        ttk.Label(toolbar, text="危险等级:").pack(side=tk.LEFT, padx=5)
        self.danger_filter = ttk.Combobox(toolbar, width=12, state='readonly')
        self.danger_filter['values'] = ['全部', '高危险', '中危险', '低危险', '一般']
        self.danger_filter.current(0)
        self.danger_filter.pack(side=tk.LEFT, padx=5)
        self.danger_filter.bind('<<ComboboxSelected>>', lambda e: self.refresh())
        
        # 主内容区域
        main_paned = ttk.PanedWindow(self, orient=tk.VERTICAL)
        main_paned.pack(fill=tk.BOTH, expand=True, pady=5)
        
        # 上部分：试剂列表
        list_frame = ttk.LabelFrame(main_paned, text="📋 试剂列表", padding=5)
        main_paned.add(list_frame, weight=2)
        
        # 创建表格
        columns = (
            'id', 'name', 'category', 'danger_level', 'concentration',
            'unit', 'available_quantity', 'total_quantity', 'location',
            'shelf', 'expiry_date', 'remarks'
        )
        
        self.reagent_tree = ttk.Treeview(
            list_frame,
            columns=columns,
            show='headings',
            height=12
        )
        
        # 设置列头
        self.reagent_tree.heading('id', text='ID')
        self.reagent_tree.heading('name', text='试剂名称')
        self.reagent_tree.heading('category', text='类别')
        self.reagent_tree.heading('danger_level', text='危险等级')
        self.reagent_tree.heading('concentration', text='浓度/纯度')
        self.reagent_tree.heading('unit', text='单位')
        self.reagent_tree.heading('available_quantity', text='可用量')
        self.reagent_tree.heading('total_quantity', text='总量')
        self.reagent_tree.heading('location', text='存放位置')
        self.reagent_tree.heading('shelf', text='货架')
        self.reagent_tree.heading('expiry_date', text='有效期')
        self.reagent_tree.heading('remarks', text='备注')
        
        # 设置列宽
        self.reagent_tree.column('id', width=50, anchor='center')
        self.reagent_tree.column('name', width=150)
        self.reagent_tree.column('category', width=80, anchor='center')
        self.reagent_tree.column('danger_level', width=80, anchor='center')
        self.reagent_tree.column('concentration', width=100)
        self.reagent_tree.column('unit', width=60, anchor='center')
        self.reagent_tree.column('available_quantity', width=80, anchor='center')
        self.reagent_tree.column('total_quantity', width=70, anchor='center')
        self.reagent_tree.column('location', width=80)
        self.reagent_tree.column('shelf', width=70)
        self.reagent_tree.column('expiry_date', width=100, anchor='center')
        self.reagent_tree.column('remarks', width=150)
        
        # 滚动条
        scroll_y = ttk.Scrollbar(list_frame, orient=tk.VERTICAL, command=self.reagent_tree.yview)
        scroll_x = ttk.Scrollbar(list_frame, orient=tk.HORIZONTAL, command=self.reagent_tree.xview)
        self.reagent_tree.configure(yscrollcommand=scroll_y.set, xscrollcommand=scroll_x.set)
        
        self.reagent_tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scroll_y.pack(side=tk.RIGHT, fill=tk.Y)
        
        # 绑定双击编辑
        self.reagent_tree.bind('<Double-1>', lambda e: self._edit_reagent())
        
        # 下部分：试剂详情
        detail_frame = ttk.LabelFrame(main_paned, text="📝 试剂详情", padding=10)
        main_paned.add(detail_frame, weight=1)
        
        # 创建详情显示区域
        self._create_detail_view(detail_frame)
    
    def _create_detail_view(self, parent):
        """创建详情视图"""
        # 使用网格布局
        details_frame = ttk.Frame(parent)
        details_frame.pack(fill=tk.X, pady=5)
        
        # 第一行
        ttk.Label(details_frame, text="试剂名称:", font=('Microsoft YaHei', 10, 'bold')).grid(row=0, column=0, sticky='w', padx=5, pady=3)
        self.detail_name = ttk.Label(details_frame, text="-", font=('Microsoft YaHei', 10))
        self.detail_name.grid(row=0, column=1, sticky='w', padx=5, pady=3)
        
        ttk.Label(details_frame, text="英文名称:", font=('Microsoft YaHei', 10)).grid(row=0, column=2, sticky='w', padx=5, pady=3)
        self.detail_english = ttk.Label(details_frame, text="-")
        self.detail_english.grid(row=0, column=3, sticky='w', padx=5, pady=3)
        
        ttk.Label(details_frame, text="CAS号:", font=('Microsoft YaHei', 10)).grid(row=0, column=4, sticky='w', padx=5, pady=3)
        self.detail_cas = ttk.Label(details_frame, text="-")
        self.detail_cas.grid(row=0, column=5, sticky='w', padx=5, pady=3)
        
        # 第二行
        ttk.Label(details_frame, text="类别:", font=('Microsoft YaHei', 10, 'bold')).grid(row=1, column=0, sticky='w', padx=5, pady=3)
        self.detail_category = ttk.Label(details_frame, text="-")
        self.detail_category.grid(row=1, column=1, sticky='w', padx=5, pady=3)
        
        ttk.Label(details_frame, text="危险等级:", font=('Microsoft YaHei', 10, 'bold')).grid(row=1, column=2, sticky='w', padx=5, pady=3)
        self.detail_danger = ttk.Label(details_frame, text="-")
        self.detail_danger.grid(row=1, column=3, sticky='w', padx=5, pady=3)
        
        ttk.Label(details_frame, text="浓度:", font=('Microsoft YaHei', 10)).grid(row=1, column=4, sticky='w', padx=5, pady=3)
        self.detail_concentration = ttk.Label(details_frame, text="-")
        self.detail_concentration.grid(row=1, column=5, sticky='w', padx=5, pady=3)
        
        # 第三行
        ttk.Label(details_frame, text="可用数量:", font=('Microsoft YaHei', 10, 'bold')).grid(row=2, column=0, sticky='w', padx=5, pady=3)
        self.detail_available = ttk.Label(details_frame, text="-")
        self.detail_available.grid(row=2, column=1, sticky='w', padx=5, pady=3)
        
        ttk.Label(details_frame, text="总数量:", font=('Microsoft YaHei', 10)).grid(row=2, column=2, sticky='w', padx=5, pady=3)
        self.detail_total = ttk.Label(details_frame, text="-")
        self.detail_total.grid(row=2, column=3, sticky='w', padx=5, pady=3)
        
        ttk.Label(details_frame, text="安全库存:", font=('Microsoft YaHei', 10)).grid(row=2, column=4, sticky='w', padx=5, pady=3)
        self.detail_minimum = ttk.Label(details_frame, text="-")
        self.detail_minimum.grid(row=2, column=5, sticky='w', padx=5, pady=3)
        
        # 第四行
        ttk.Label(details_frame, text="存放位置:", font=('Microsoft YaHei', 10)).grid(row=3, column=0, sticky='w', padx=5, pady=3)
        self.detail_location = ttk.Label(details_frame, text="-")
        self.detail_location.grid(row=3, column=1, sticky='w', padx=5, pady=3)
        
        ttk.Label(details_frame, text="货架:", font=('Microsoft YaHei', 10)).grid(row=3, column=2, sticky='w', padx=5, pady=3)
        self.detail_shelf = ttk.Label(details_frame, text="-")
        self.detail_shelf.grid(row=3, column=3, sticky='w', padx=5, pady=3)
        
        ttk.Label(details_frame, text="有效期:", font=('Microsoft YaHei', 10)).grid(row=3, column=4, sticky='w', padx=5, pady=3)
        self.detail_expiry = ttk.Label(details_frame, text="-")
        self.detail_expiry.grid(row=3, column=5, sticky='w', padx=5, pady=3)
        
        # 第五行：备注
        ttk.Label(details_frame, text="备注:", font=('Microsoft YaHei', 10)).grid(row=4, column=0, sticky='nw', padx=5, pady=3)
        self.detail_remarks = ttk.Label(details_frame, text="-", wraplength=500, justify='left')
        self.detail_remarks.grid(row=4, column=1, columnspan=5, sticky='w', padx=5, pady=3)
        
        # 配置列权重
        for i in range(6):
            details_frame.columnconfigure(i, weight=1)
    
    def refresh(self):
        """刷新数据"""
        self._update_reagent_list()
        self._clear_detail()
    
    def _update_reagent_list(self):
        """更新试剂列表"""
        # 清空
        for item in self.reagent_tree.get_children():
            self.reagent_tree.delete(item)
        
        reagent_service = self.main_window.reagent_service
        reagents = reagent_service.get_all_reagents()
        
        # 获取筛选条件
        search_text = self.search_var.get().lower()
        danger_filter = self.danger_filter.get()
        
        # 危险等级映射
        danger_map = {
            '高危险': 1,
            '中危险': 2,
            '低危险': 3,
            '一般': 4
        }
        
        # 类别名称映射
        category_names = {k: v['name'] for k, v in self.config.reagent_categories.items()}
        danger_names = {k: v['name'] for k, v in self.config.danger_levels.items()}
        
        for r in reagents:
            # 筛选
            if danger_filter != '全部':
                if r['danger_level'] != danger_map.get(danger_filter):
                    continue
            
            if search_text:
                search_fields = [
                    str(r.get('name', '')).lower(),
                    str(r.get('english_name', '')).lower(),
                    str(r.get('cas_number', '')).lower(),
                    str(r.get('remarks', '')).lower()
                ]
                if not any(search_text in f for f in search_fields):
                    continue
            
            # 组合浓度/纯度
            conc_parts = []
            if r.get('concentration'):
                conc_parts.append(r['concentration'])
            if r.get('purity'):
                conc_parts.append(r['purity'])
            concentration = '/'.join(conc_parts) if conc_parts else '-'
            
            # 危险等级颜色标签
            danger_level = r['danger_level']
            tags = ()
            if danger_level == 1:
                tags = ('high_risk',)
            elif danger_level == 2:
                tags = ('medium_risk',)
            
            self.reagent_tree.insert('', tk.END, values=(
                r['id'],
                r['name'],
                category_names.get(r['category'], r['category']),
                danger_names.get(danger_level, f'等级{danger_level}'),
                concentration,
                r['unit'],
                r['available_quantity'],
                r['total_quantity'],
                r['location'] or '-',
                r['shelf'] or '-',
                r['expiry_date'] or '-',
                r['remarks'] or '-'
            ), tags=tags, iid=r['id'])
        
        # 设置标签颜色
        self.reagent_tree.tag_configure('high_risk', foreground='#FF4444')
        self.reagent_tree.tag_configure('medium_risk', foreground='#FF8C00')
        
        # 绑定选择事件
        self.reagent_tree.bind('<<TreeviewSelect>>', self._on_select)
    
    def _on_select(self, event):
        """选择事件"""
        selection = self.reagent_tree.selection()
        if selection:
            reagent_id = int(selection[0])
            self._show_reagent_detail(reagent_id)
    
    def _show_reagent_detail(self, reagent_id: int):
        """显示试剂详情"""
        reagent_service = self.main_window.reagent_service
        reagent = reagent_service.get_reagent(reagent_id)
        
        if not reagent:
            return
        
        category_names = {k: v['name'] for k, v in self.config.reagent_categories.items()}
        danger_names = {k: v['name'] for k, v in self.config.danger_levels.items()}
        
        self.detail_name.config(text=reagent['name'])
        self.detail_english.config(text=reagent['english_name'] or '-')
        self.detail_cas.config(text=reagent['cas_number'] or '-')
        self.detail_category.config(text=category_names.get(reagent['category'], reagent['category']))
        
        danger_name = danger_names.get(reagent['danger_level'], f'等级{reagent["danger_level"]}')
        self.detail_danger.config(text=danger_name)
        
        conc_parts = []
        if reagent.get('concentration'):
            conc_parts.append(reagent['concentration'])
        if reagent.get('purity'):
            conc_parts.append(reagent['purity'])
        self.detail_concentration.config(text='/'.join(conc_parts) if conc_parts else '-')
        
        self.detail_available.config(text=f"{reagent['available_quantity']} {reagent['unit']}")
        self.detail_total.config(text=f"{reagent['total_quantity']} {reagent['unit']}")
        self.detail_minimum.config(text=f"{reagent['minimum_quantity']} {reagent['unit']}")
        self.detail_location.config(text=reagent['location'] or '-')
        self.detail_shelf.config(text=reagent['shelf'] or '-')
        self.detail_expiry.config(text=reagent['expiry_date'] or '-')
        self.detail_remarks.config(text=reagent['remarks'] or '-')
    
    def _clear_detail(self):
        """清空详情"""
        self.detail_name.config(text='-')
        self.detail_english.config(text='-')
        self.detail_cas.config(text='-')
        self.detail_category.config(text='-')
        self.detail_danger.config(text='-')
        self.detail_concentration.config(text='-')
        self.detail_available.config(text='-')
        self.detail_total.config(text='-')
        self.detail_minimum.config(text='-')
        self.detail_location.config(text='-')
        self.detail_shelf.config(text='-')
        self.detail_expiry.config(text='-')
        self.detail_remarks.config(text='-')
    
    def _do_search(self):
        """执行搜索"""
        self._update_reagent_list()
    
    def _reset_search(self):
        """重置搜索"""
        self.search_var.set('')
        self.danger_filter.current(0)
        self._update_reagent_list()
    
    def _add_reagent(self):
        """添加试剂"""
        self._show_reagent_dialog(None)
    
    def _edit_reagent(self):
        """编辑试剂"""
        selection = self.reagent_tree.selection()
        if not selection:
            messagebox.showwarning('提示', '请先选择要编辑的试剂')
            return
        
        reagent_id = int(selection[0])
        self._show_reagent_dialog(reagent_id)
    
    def _delete_reagent(self):
        """删除试剂"""
        selection = self.reagent_tree.selection()
        if not selection:
            messagebox.showwarning('提示', '请先选择要删除的试剂')
            return
        
        if not messagebox.askyesno('确认', '确定要删除选中的试剂吗？这将标记为停用。'):
            return
        
        reagent_id = int(selection[0])
        reagent_service = self.main_window.reagent_service
        
        if reagent_service.delete_reagent(reagent_id):
            messagebox.showinfo('成功', '试剂已删除')
            self.refresh()
        else:
            messagebox.showerror('错误', '删除失败')
    
    def _show_reagent_dialog(self, reagent_id: Optional[int]):
        """显示试剂编辑对话框"""
        # 这里简化处理，实际项目中可以创建完整的对话框
        # 暂时使用简单消息框提示
        messagebox.showinfo('提示', '完整的试剂编辑对话框可以在此实现。\n\n当前版本可以通过CSV导入来批量管理试剂。')
    
    def _import_csv(self):
        """导入CSV"""
        self.main_window._import_reagents()
        self.refresh()
    
    def _export_csv(self):
        """导出CSV"""
        self.main_window._export_inventory()
