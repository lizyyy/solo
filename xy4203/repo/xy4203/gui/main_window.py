#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
主窗口模块 - 整合所有功能模块
"""

import tkinter as tk
from tkinter import ttk, filedialog, messagebox
from typing import Optional, List, Dict, Any
import os
import numpy as np
from datetime import datetime

from gui.image_viewer import ImageViewer
from gui.annotation_tool import AnnotationTool
from persistence.data_store import DataStore, ProjectData, ReviewRecord
from annotation_parser.csv_parser import CSVParser
from image_processing.comparator import ImageComparator
from image_processing.defect_analyzer import DefectAnalyzer
from image_processing.color_analyzer import ColorAnalyzer
from rule_engine.page_checker import PageChecker
from rule_engine.area_calculator import AreaCalculator
from rule_engine.color_checker import ColorChecker as RuleColorChecker


class MainWindow:
    """
    主窗口类
    整合所有功能模块，提供完整的用户界面
    """
    
    def __init__(self, root: tk.Tk):
        """
        初始化主窗口
        
        Args:
            root: Tkinter根窗口
        """
        self.root = root
        self.root.title("修复前后影像比对台 - 古籍修复质量管控系统")
        self.root.geometry("1400x900")
        self.root.minsize(1000, 700)
        
        # 初始化数据存储
        self.data_store = DataStore()
        
        # 当前项目
        self.current_project: Optional[ProjectData] = None
        
        # 当前页码
        self.current_page: int = 1
        
        # 分析器实例
        self.csv_parser = CSVParser()
        self.image_comparator = ImageComparator()
        self.defect_analyzer = DefectAnalyzer()
        self.color_analyzer = ColorAnalyzer()
        self.page_checker = PageChecker()
        self.area_calculator = AreaCalculator()
        self.rule_color_checker = RuleColorChecker()
        
        # 分析结果
        self.analysis_results: Dict[str, Any] = {}
        
        # 创建菜单
        self._create_menu()
        
        # 创建工具栏
        self._create_toolbar()
        
        # 创建主界面布局
        self._create_main_layout()
        
        # 创建状态栏
        self._create_statusbar()
        
        # 初始化界面状态
        self._update_ui_state()
    
    def _create_menu(self):
        """创建菜单栏"""
        menubar = tk.Menu(self.root)
        self.root.config(menu=menubar)
        
        # 文件菜单
        file_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="文件", menu=file_menu)
        
        file_menu.add_command(label="新建项目", command=self._new_project, accelerator="Ctrl+N")
        file_menu.add_command(label="打开项目", command=self._open_project, accelerator="Ctrl+O")
        file_menu.add_separator()
        file_menu.add_command(label="导入修复前图像", command=self._import_before_images)
        file_menu.add_command(label="导入修复后图像", command=self._import_after_images)
        file_menu.add_command(label="导入病害标注CSV", command=self._import_defect_csv)
        file_menu.add_command(label="导入材料记录CSV", command=self._import_material_csv)
        file_menu.add_separator()
        file_menu.add_command(label="保存项目", command=self._save_project, accelerator="Ctrl+S")
        file_menu.add_separator()
        file_menu.add_command(label="导出复核单 (Markdown)", command=self._export_markdown)
        file_menu.add_command(label="导出问题清单 (CSV)", command=self._export_csv_issues)
        file_menu.add_command(label="导出审计包 (JSON)", command=self._export_json_audit)
        file_menu.add_separator()
        file_menu.add_command(label="退出", command=self.root.quit, accelerator="Ctrl+Q")
        
        # 编辑菜单
        edit_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="编辑", menu=edit_menu)
        
        edit_menu.add_command(label="撤销", accelerator="Ctrl+Z", state=tk.DISABLED)
        edit_menu.add_command(label="重做", accelerator="Ctrl+Y", state=tk.DISABLED)
        edit_menu.add_separator()
        edit_menu.add_command(label="清除所有标注", command=self._clear_all_annotations)
        
        # 视图菜单
        view_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="视图", menu=view_menu)
        
        view_menu.add_command(label="并排显示", command=lambda: self._set_view_mode(ImageViewer.MODE_SIDE_BY_SIDE))
        view_menu.add_command(label="叠加显示", command=lambda: self._set_view_mode(ImageViewer.MODE_OVERLAY))
        view_menu.add_command(label="差异图", command=lambda: self._set_view_mode(ImageViewer.MODE_DIFFERENCE))
        view_menu.add_separator()
        view_menu.add_command(label="放大", command=lambda: self.image_viewer.zoom_in(), accelerator="Ctrl++")
        view_menu.add_command(label="缩小", command=lambda: self.image_viewer.zoom_out(), accelerator="Ctrl+-")
        view_menu.add_command(label="适应窗口", command=lambda: self.image_viewer.fit_to_window(), accelerator="Ctrl+0")
        
        # 分析菜单
        analyze_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="分析", menu=analyze_menu)
        
        analyze_menu.add_command(label="运行完整分析", command=self._run_full_analysis)
        analyze_menu.add_separator()
        analyze_menu.add_command(label="分析缺损变化", command=self._analyze_defects)
        analyze_menu.add_command(label="分析颜色变化", command=self._analyze_colors)
        analyze_menu.add_command(label="检查页码一致性", command=self._check_pages)
        
        # 帮助菜单
        help_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="帮助", menu=help_menu)
        
        help_menu.add_command(label="使用说明", command=self._show_help)
        help_menu.add_command(label="关于", command=self._show_about)
        
        # 绑定快捷键
        self.root.bind("<Control-n>", lambda e: self._new_project())
        self.root.bind("<Control-o>", lambda e: self._open_project())
        self.root.bind("<Control-s>", lambda e: self._save_project())
    
    def _create_toolbar(self):
        """创建工具栏"""
        toolbar = ttk.Frame(self.root)
        toolbar.pack(fill=tk.X, padx=5, pady=2)
        
        # 项目操作
        ttk.Button(toolbar, text="新建", command=self._new_project, width=6).pack(side=tk.LEFT, padx=2)
        ttk.Button(toolbar, text="打开", command=self._open_project, width=6).pack(side=tk.LEFT, padx=2)
        ttk.Button(toolbar, text="保存", command=self._save_project, width=6).pack(side=tk.LEFT, padx=2)
        
        ttk.Separator(toolbar, orient=tk.VERTICAL).pack(side=tk.LEFT, fill=tk.Y, padx=10)
        
        # 数据导入
        ttk.Button(toolbar, text="导入图像", command=self._import_images, width=8).pack(side=tk.LEFT, padx=2)
        ttk.Button(toolbar, text="导入CSV", command=self._import_csvs, width=8).pack(side=tk.LEFT, padx=2)
        
        ttk.Separator(toolbar, orient=tk.VERTICAL).pack(side=tk.LEFT, fill=tk.Y, padx=10)
        
        # 分析操作
        ttk.Button(toolbar, text="运行分析", command=self._run_full_analysis, width=8).pack(side=tk.LEFT, padx=2)
        
        ttk.Separator(toolbar, orient=tk.VERTICAL).pack(side=tk.LEFT, fill=tk.Y, padx=10)
        
        # 页码导航
        ttk.Label(toolbar, text="页码:").pack(side=tk.LEFT, padx=2)
        
        self.page_var = tk.StringVar(value="1")
        self.page_spinbox = ttk.Spinbox(
            toolbar, 
            from_=1, 
            to=1000,
            textvariable=self.page_var,
            width=6,
            command=self._on_page_changed
        )
        self.page_spinbox.pack(side=tk.LEFT, padx=2)
        
        ttk.Button(toolbar, text="←", command=self._prev_page, width=3).pack(side=tk.LEFT, padx=1)
        ttk.Button(toolbar, text="→", command=self._next_page, width=3).pack(side=tk.LEFT, padx=1)
        
        ttk.Separator(toolbar, orient=tk.VERTICAL).pack(side=tk.LEFT, fill=tk.Y, padx=10)
        
        # 导出操作
        ttk.Button(toolbar, text="导出", command=self._show_export_dialog, width=6).pack(side=tk.LEFT, padx=2)
    
    def _create_main_layout(self):
        """创建主界面布局"""
        # 主面板
        main_paned = ttk.PanedWindow(self.root, orient=tk.HORIZONTAL)
        main_paned.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)
        
        # 左侧面板（项目和问题列表）
        left_frame = ttk.Frame(main_paned, width=300)
        main_paned.add(left_frame, weight=1)
        
        # 项目信息标签
        project_label_frame = ttk.LabelFrame(left_frame, text="项目信息", padding=5)
        project_label_frame.pack(fill=tk.X, pady=5)
        
        self.project_info_label = ttk.Label(
            project_label_frame, 
            text="未打开项目",
            justify=tk.LEFT
        )
        self.project_info_label.pack(fill=tk.X)
        
        # 问题列表标签
        issues_label_frame = ttk.LabelFrame(left_frame, text="问题列表", padding=5)
        issues_label_frame.pack(fill=tk.BOTH, expand=True, pady=5)
        
        # 创建问题列表树形视图
        columns = ("type", "severity", "page", "message")
        self.issues_tree = ttk.Treeview(
            issues_label_frame,
            columns=columns,
            show="headings",
            height=10
        )
        
        # 设置列标题
        self.issues_tree.heading("type", text="类型")
        self.issues_tree.heading("severity", text="严重程度")
        self.issues_tree.heading("page", text="页码")
        self.issues_tree.heading("message", text="描述")
        
        # 设置列宽
        self.issues_tree.column("type", width=80)
        self.issues_tree.column("severity", width=70)
        self.issues_tree.column("page", width=50)
        self.issues_tree.column("message", width=150)
        
        # 添加滚动条
        issues_scroll_y = ttk.Scrollbar(issues_label_frame, orient=tk.VERTICAL, command=self.issues_tree.yview)
        self.issues_tree.configure(yscrollcommand=issues_scroll_y.set)
        
        self.issues_tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        issues_scroll_y.pack(side=tk.RIGHT, fill=tk.Y)
        
        # 中间面板（图像查看器和标注工具）
        center_paned = ttk.PanedWindow(main_paned, orient=tk.VERTICAL)
        main_paned.add(center_paned, weight=3)
        
        # 图像查看器
        viewer_label_frame = ttk.LabelFrame(center_paned, text="图像查看", padding=5)
        center_paned.add(viewer_label_frame, weight=2)
        
        self.image_viewer = ImageViewer(viewer_label_frame)
        self.image_viewer.pack(fill=tk.BOTH, expand=True)
        
        # 标注工具
        annotation_label_frame = ttk.LabelFrame(center_paned, text="人工圈选标注", padding=5)
        center_paned.add(annotation_label_frame, weight=1)
        
        self.annotation_tool = AnnotationTool(annotation_label_frame)
        self.annotation_tool.pack(fill=tk.BOTH, expand=True)
        
        # 右侧面板（分析结果和复核记录）
        right_frame = ttk.Frame(main_paned, width=350)
        main_paned.add(right_frame, weight=1)
        
        # 分析结果标签
        analysis_label_frame = ttk.LabelFrame(right_frame, text="分析结果", padding=5)
        analysis_label_frame.pack(fill=tk.BOTH, expand=True, pady=5)
        
        # 创建分析结果文本区域
        self.analysis_text = tk.Text(
            analysis_label_frame,
            wrap=tk.WORD,
            width=40,
            height=20,
            font=("Arial", 10)
        )
        
        analysis_scroll_y = ttk.Scrollbar(analysis_label_frame, orient=tk.VERTICAL, command=self.analysis_text.yview)
        self.analysis_text.configure(yscrollcommand=analysis_scroll_y.set)
        
        self.analysis_text.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        analysis_scroll_y.pack(side=tk.RIGHT, fill=tk.Y)
        
        # 复核记录标签
        review_label_frame = ttk.LabelFrame(right_frame, text="复核记录", padding=5)
        review_label_frame.pack(fill=tk.X, pady=5)
        
        # 复核状态
        ttk.Label(review_label_frame, text="复核状态:").grid(row=0, column=0, sticky=tk.W, pady=2)
        
        self.review_status_var = tk.StringVar(value="未开始")
        review_status_combo = ttk.Combobox(
            review_label_frame,
            textvariable=self.review_status_var,
            values=["未开始", "复核中", "已通过", "需注意", "需重新检查"],
            state="readonly",
            width=12
        )
        review_status_combo.grid(row=0, column=1, sticky=tk.W, pady=2)
        
        ttk.Label(review_label_frame, text="复核人:").grid(row=1, column=0, sticky=tk.W, pady=2)
        
        self.reviewer_var = tk.StringVar()
        reviewer_entry = ttk.Entry(review_label_frame, textvariable=self.reviewer_var, width=15)
        reviewer_entry.grid(row=1, column=1, sticky=tk.W, pady=2)
        
        ttk.Label(review_label_frame, text="复核备注:").grid(row=2, column=0, sticky=tk.NW, pady=2)
        
        self.review_notes_text = tk.Text(review_label_frame, width=18, height=4, wrap=tk.WORD)
        self.review_notes_text.grid(row=2, column=1, sticky=tk.W, pady=2)
        
        ttk.Button(
            review_label_frame, 
            text="保存复核记录", 
            command=self._save_review_record
        ).grid(row=3, column=0, columnspan=2, pady=5)
    
    def _create_statusbar(self):
        """创建状态栏"""
        statusbar = ttk.Frame(self.root)
        statusbar.pack(fill=tk.X, side=tk.BOTTOM)
        
        self.status_label = ttk.Label(
            statusbar,
            text="就绪",
            relief=tk.SUNKEN,
            anchor=tk.W
        )
        self.status_label.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=5)
        
        self.page_info_label = ttk.Label(
            statusbar,
            text="",
            relief=tk.SUNKEN,
            anchor=tk.E
        )
        self.page_info_label.pack(side=tk.RIGHT, padx=5)
    
    def _update_status(self, message: str):
        """更新状态栏"""
        self.status_label.config(text=message)
    
    def _update_ui_state(self):
        """更新界面状态"""
        has_project = self.current_project is not None
        
        # 更新工具栏状态
        # (这里可以根据需要启用/禁用按钮)
        
        # 更新项目信息
        if has_project:
            project = self.current_project
            info_text = (
                f"项目: {project.project_name}\n"
                f"页数: {len(project.page_numbers)}\n"
                f"问题数: {len(project.issues)}\n"
                f"创建时间: {project.created_at[:10] if project.created_at else '-'}"
            )
            self.project_info_label.config(text=info_text)
        else:
            self.project_info_label.config(text="未打开项目")
    
    # ==================== 项目操作 ====================
    
    def _new_project(self):
        """新建项目"""
        # 简单对话框获取项目名称
        dialog = tk.Toplevel(self.root)
        dialog.title("新建项目")
        dialog.geometry("400x180")
        dialog.transient(self.root)
        dialog.grab_set()
        
        ttk.Label(dialog, text="项目名称:").pack(pady=10)
        name_var = tk.StringVar()
        name_entry = ttk.Entry(dialog, textvariable=name_var, width=40)
        name_entry.pack(pady=5)
        name_entry.focus_set()
        
        ttk.Label(dialog, text="项目描述:").pack(pady=5)
        desc_var = tk.StringVar()
        desc_entry = ttk.Entry(dialog, textvariable=desc_var, width=40)
        desc_entry.pack(pady=5)
        
        def on_ok():
            name = name_var.get().strip()
            if not name:
                messagebox.showwarning("警告", "请输入项目名称")
                return
            
            # 创建项目
            project = self.data_store.create_project(name, desc_var.get())
            self.current_project = project
            
            # 更新界面
            self._update_ui_state()
            self._update_status(f"已创建项目: {name}")
            
            dialog.destroy()
        
        button_frame = ttk.Frame(dialog)
        button_frame.pack(pady=15)
        
        ttk.Button(button_frame, text="确定", command=on_ok, width=10).pack(side=tk.LEFT, padx=10)
        ttk.Button(button_frame, text="取消", command=dialog.destroy, width=10).pack(side=tk.LEFT, padx=10)
        
        # 等待对话框关闭
        self.root.wait_window(dialog)
    
    def _open_project(self):
        """打开项目"""
        # 获取项目列表
        projects = self.data_store.list_projects()
        
        if not projects:
            messagebox.showinfo("信息", "没有可用的项目")
            return
        
        # 创建选择对话框
        dialog = tk.Toplevel(self.root)
        dialog.title("选择项目")
        dialog.geometry("500x350")
        dialog.transient(self.root)
        dialog.grab_set()
        
        # 创建项目列表
        columns = ("name", "created", "pages", "issues")
        tree = ttk.Treeview(dialog, columns=columns, show="headings", height=12)
        
        tree.heading("name", text="项目名称")
        tree.heading("created", text="创建时间")
        tree.heading("pages", text="页数")
        tree.heading("issues", text="问题数")
        
        tree.column("name", width=150)
        tree.column("created", width=100)
        tree.column("pages", width=60)
        tree.column("issues", width=60)
        
        # 填充数据
        for project in projects:
            tree.insert("", tk.END, values=(
                project["project_name"],
                project["created_at"][:10] if project["created_at"] else "-",
                project["page_count"],
                project["issue_count"]
            ), iid=project["project_id"])
        
        scrollbar = ttk.Scrollbar(dialog, orient=tk.VERTICAL, command=tree.yview)
        tree.configure(yscrollcommand=scrollbar.set)
        
        tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, padx=10, pady=10)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y, pady=10)
        
        selected_id = [None]
        
        def on_select(event=None):
            selection = tree.selection()
            if selection:
                selected_id[0] = selection[0]
        
        tree.bind("<<TreeviewSelect>>", on_select)
        tree.bind("<Double-1>", lambda e: on_ok())
        
        def on_ok():
            if selected_id[0]:
                # 加载项目
                project = self.data_store.load_project(selected_id[0])
                if project:
                    self.current_project = project
                    self._update_ui_state()
                    self._load_project_data()
                    self._update_status(f"已打开项目: {project.project_name}")
                dialog.destroy()
            else:
                messagebox.showwarning("警告", "请选择一个项目")
        
        button_frame = ttk.Frame(dialog)
        button_frame.pack(pady=10)
        
        ttk.Button(button_frame, text="打开", command=on_ok, width=10).pack(side=tk.LEFT, padx=10)
        ttk.Button(button_frame, text="取消", command=dialog.destroy, width=10).pack(side=tk.LEFT, padx=10)
        
        self.root.wait_window(dialog)
    
    def _save_project(self):
        """保存项目"""
        if self.current_project is None:
            messagebox.showwarning("警告", "没有打开的项目")
            return
        
        # 保存当前复核记录
        self._save_review_record()
        
        # 保存项目
        if self.data_store.save_project():
            self._update_status("项目已保存")
        else:
            messagebox.showerror("错误", "保存项目失败")
    
    def _load_project_data(self):
        """加载项目数据"""
        if self.current_project is None:
            return
        
        # 更新页码
        if self.current_project.page_numbers:
            self.page_spinbox.config(to=max(self.current_project.page_numbers))
            self.current_page = min(self.current_project.page_numbers)
            self.page_var.set(str(self.current_page))
        
        # 加载问题列表
        self._refresh_issues_list()
        
        # 加载分析结果
        self._refresh_analysis_text()
        
        # 加载当前页图像
        self._load_current_page_images()
    
    # ==================== 数据导入 ====================
    
    def _import_images(self):
        """导入图像"""
        if self.current_project is None:
            messagebox.showwarning("警告", "请先创建或打开项目")
            return
        
        # 让用户选择修复前后图像
        messagebox.showinfo("提示", "请先选择修复前图像，然后选择修复后图像")
        
        # 选择修复前图像
        before_paths = filedialog.askopenfilenames(
            title="选择修复前图像",
            filetypes=[("图像文件", "*.jpg *.jpeg *.png *.bmp *.tif *.tiff"), ("所有文件", "*.*")]
        )
        
        if not before_paths:
            return
        
        # 选择修复后图像
        after_paths = filedialog.askopenfilenames(
            title="选择修复后图像",
            filetypes=[("图像文件", "*.jpg *.jpeg *.png *.bmp *.tif *.tiff"), ("所有文件", "*.*")]
        )
        
        if not after_paths:
            return
        
        # 匹配图像对
        if len(before_paths) != len(after_paths):
            messagebox.showwarning("警告", f"修复前图像数量({len(before_paths)})与修复后图像数量({len(after_paths)})不一致")
        
        # 使用页码检查器从文件名提取页码
        for i, (before_path, after_path) in enumerate(zip(before_paths, after_paths)):
            # 尝试从文件名提取页码
            page_num = self.page_checker.extract_page_number_from_filename(before_path)
            
            if page_num is None:
                # 如果无法提取，使用序号+1
                page_num = i + 1
            
            # 添加到项目
            self.current_project.add_image_paths(page_num, before_path, after_path)
            
            if page_num not in self.current_project.page_numbers:
                self.current_project.page_numbers.append(page_num)
        
        # 排序页码
        self.current_project.page_numbers.sort()
        
        # 更新界面
        if self.current_project.page_numbers:
            self.page_spinbox.config(to=max(self.current_project.page_numbers))
            self.current_page = min(self.current_project.page_numbers)
            self.page_var.set(str(self.current_page))
        
        self._update_ui_state()
        self._load_current_page_images()
        self._update_status(f"已导入 {len(before_paths)} 对图像")
    
    def _import_before_images(self):
        """导入修复前图像"""
        # 简化实现，使用_import_images
        messagebox.showinfo("提示", "请使用工具栏的\"导入图像\"按钮")
    
    def _import_after_images(self):
        """导入修复后图像"""
        # 简化实现
        messagebox.showinfo("提示", "请使用工具栏的\"导入图像\"按钮")
    
    def _import_csvs(self):
        """导入CSV文件"""
        if self.current_project is None:
            messagebox.showwarning("警告", "请先创建或打开项目")
            return
        
        # 选择病害标注CSV
        defect_csv = filedialog.askopenfilename(
            title="选择病害标注CSV文件",
            filetypes=[("CSV文件", "*.csv"), ("所有文件", "*.*")]
        )
        
        if defect_csv:
            try:
                self.csv_parser.parse_defect_csv(defect_csv)
                self.current_project.defect_csv_path = defect_csv
                self._update_status(f"已导入病害标注: {os.path.basename(defect_csv)}")
            except Exception as e:
                messagebox.showerror("错误", f"解析病害标注CSV失败: {e}")
        
        # 选择材料记录CSV
        material_csv = filedialog.askopenfilename(
            title="选择材料记录CSV文件",
            filetypes=[("CSV文件", "*.csv"), ("所有文件", "*.*")]
        )
        
        if material_csv:
            try:
                self.csv_parser.parse_material_csv(material_csv)
                self.current_project.material_csv_path = material_csv
                self._update_status(f"已导入材料记录: {os.path.basename(material_csv)}")
            except Exception as e:
                messagebox.showerror("错误", f"解析材料记录CSV失败: {e}")
    
    def _import_defect_csv(self):
        """导入病害标注CSV"""
        self._import_csvs()
    
    def _import_material_csv(self):
        """导入材料记录CSV"""
        self._import_csvs()
    
    # ==================== 页码导航 ====================
    
    def _on_page_changed(self):
        """页码改变事件"""
        try:
            new_page = int(self.page_var.get())
            if self.current_project and new_page in self.current_project.page_numbers:
                self.current_page = new_page
                self._load_current_page_images()
                self._load_current_page_annotations()
                self._load_current_page_review()
        except ValueError:
            pass
    
    def _prev_page(self):
        """上一页"""
        if self.current_project and self.current_project.page_numbers:
            current_idx = self.current_project.page_numbers.index(self.current_page)
            if current_idx > 0:
                self.current_page = self.current_project.page_numbers[current_idx - 1]
                self.page_var.set(str(self.current_page))
                self._load_current_page_images()
                self._load_current_page_annotations()
                self._load_current_page_review()
    
    def _next_page(self):
        """下一页"""
        if self.current_project and self.current_project.page_numbers:
            current_idx = self.current_project.page_numbers.index(self.current_page)
            if current_idx < len(self.current_project.page_numbers) - 1:
                self.current_page = self.current_project.page_numbers[current_idx + 1]
                self.page_var.set(str(self.current_page))
                self._load_current_page_images()
                self._load_current_page_annotations()
                self._load_current_page_review()
    
    def _load_current_page_images(self):
        """加载当前页图像"""
        if self.current_project is None:
            return
        
        before_path = self.current_project.before_image_paths.get(self.current_page)
        after_path = self.current_project.after_image_paths.get(self.current_page)
        
        if before_path and after_path:
            # 加载到图像查看器
            self.image_viewer.load_images(before_path, after_path)
            
            # 也加载一份到标注工具（使用并排显示）
            import cv2
            before_img = cv2.imread(before_path)
            after_img = cv2.imread(after_path)
            
            if before_img is not None and after_img is not None:
                # 调整后图像尺寸以匹配前图像
                if before_img.shape != after_img.shape:
                    after_img = cv2.resize(after_img, (before_img.shape[1], before_img.shape[0]))
                
                # 水平拼接
                side_by_side = np.hstack([before_img, after_img])
                self.annotation_tool.load_image(side_by_side)
        
        # 更新页码信息
        if self.current_project and self.current_project.page_numbers:
            total = len(self.current_project.page_numbers)
            current = self.current_project.page_numbers.index(self.current_page) + 1
            self.page_info_label.config(text=f"第 {current}/{total} 页 (页码: {self.current_page})")
    
    def _load_current_page_annotations(self):
        """加载当前页人工标注"""
        if self.current_project is None:
            return
        
        annotations = self.current_project.manual_annotations.get(self.current_page, [])
        self.annotation_tool.set_annotations(annotations)
    
    def _load_current_page_review(self):
        """加载当前页复核记录"""
        if self.current_project is None:
            return
        
        review = self.current_project.review_records.get(self.current_page)
        
        if review:
            self.review_status_var.set(review.review_status or "未开始")
            self.reviewer_var.set(review.reviewer_name or "")
            self.review_notes_text.delete(1.0, tk.END)
            self.review_notes_text.insert(tk.END, review.review_notes or "")
        else:
            self.review_status_var.set("未开始")
            self.reviewer_var.set("")
            self.review_notes_text.delete(1.0, tk.END)
    
    def _save_review_record(self):
        """保存当前页复核记录"""
        if self.current_project is None:
            return
        
        # 创建或更新复核记录
        review = ReviewRecord(
            page_number=self.current_page,
            review_status=self.review_status_var.get(),
            reviewer_name=self.reviewer_var.get(),
            review_notes=self.review_notes_text.get(1.0, tk.END).strip(),
            review_date=datetime.now().isoformat()
        )
        
        # 获取当前人工标注
        annotations = self.annotation_tool.get_annotations()
        review.manual_annotations = annotations
        
        # 保存到项目
        self.current_project.review_records[self.current_page] = review
        
        # 同时保存人工标注到项目
        self.current_project.manual_annotations[self.current_page] = annotations
    
    # ==================== 分析功能 ====================
    
    def _run_full_analysis(self):
        """运行完整分析"""
        if self.current_project is None:
            messagebox.showwarning("警告", "请先打开项目并导入数据")
            return
        
        self._update_status("正在运行分析...")
        self.root.update()
        
        try:
            # 1. 检查页码
            self._check_pages()
            
            # 2. 分析缺损
            self._analyze_defects()
            
            # 3. 分析颜色
            self._analyze_colors()
            
            # 4. 检查材料记录匹配
            self._check_material_match()
            
            self._update_status("分析完成")
            messagebox.showinfo("完成", "完整分析已完成，请查看问题列表和分析结果")
            
        except Exception as e:
            self._update_status("分析失败")
            messagebox.showerror("错误", f"分析过程中发生错误: {e}")
    
    def _check_pages(self):
        """检查页码一致性"""
        if self.current_project is None:
            return
        
        # 获取图像页码
        image_pages = list(self.current_project.before_image_paths.keys())
        
        # 获取标注页码
        annotation_pages = self.csv_parser.get_page_numbers()
        
        # 获取材料记录页码
        material_pages = [m.page_number for m in self.csv_parser.material_records]
        
        # 检查页码序列
        if image_pages:
            issues = self.page_checker.check_page_sequence(image_pages)
            for issue in issues:
                self._add_issue_to_project("page", issue.severity, issue.page_number, issue.message)
        
        # 检查跨数据一致性
        if image_pages or annotation_pages:
            issues = self.page_checker.check_image_page_correlation(
                image_pages, annotation_pages, material_pages
            )
            for issue in issues:
                page = issue.page_number if issue.page_number else (issue.pages[0] if issue.pages else None)
                self._add_issue_to_project("page", issue.severity, page, issue.message)
        
        self._refresh_issues_list()
        self._refresh_analysis_text()
    
    def _analyze_defects(self):
        """分析缺损变化"""
        if self.current_project is None:
            return
        
        # 遍历每一页进行分析
        for page_num in self.current_project.page_numbers:
            before_path = self.current_project.before_image_paths.get(page_num)
            after_path = self.current_project.after_image_paths.get(page_num)
            
            if before_path and after_path:
                # 加载图像并分析
                if self.defect_analyzer.load_images(before_path, after_path):
                    analysis = self.defect_analyzer.analyze_defect_changes()
                    
                    # 检查面积漏算
                    # 获取标注的缺损
                    annotated_defects = []
                    for defect in self.csv_parser.get_defects_by_page(page_num):
                        annotated_defects.append({
                            "id": defect.id,
                            "area": defect.area,
                            "bounding_box": (
                                int(defect.position_x - defect.width/2),
                                int(defect.position_y - defect.height/2),
                                int(defect.width),
                                int(defect.height)
                            ),
                            "defect_type": defect.defect_type
                        })
                    
                    # 获取检测到的缺损
                    detected_defects = analysis.get("defects_after", [])
                    
                    # 比较
                    issues = self.area_calculator.compare_annotation_vs_actual(
                        annotated_defects, detected_defects,
                        self.defect_analyzer.get_image_size()[0],
                        self.defect_analyzer.get_image_size()[1]
                    )
                    
                    for issue in issues:
                        self._add_issue_to_project("area", issue.severity, page_num, issue.message)
        
        self._refresh_issues_list()
        self._refresh_analysis_text()
    
    def _analyze_colors(self):
        """分析颜色变化"""
        if self.current_project is None:
            return
        
        # 遍历每一页进行分析
        for page_num in self.current_project.page_numbers:
            before_path = self.current_project.before_image_paths.get(page_num)
            after_path = self.current_project.after_image_paths.get(page_num)
            
            if before_path and after_path:
                # 加载图像
                import cv2
                before_img = cv2.imread(before_path)
                after_img = cv2.imread(after_path)
                
                if before_img is not None and after_img is not None:
                    # 使用规则引擎的色差检查器
                    issues = self.rule_color_checker.check_color_changes(
                        before_img, after_img, page_num
                    )
                    
                    for issue in issues:
                        self._add_issue_to_project("color", issue.severity, page_num, issue.message)
        
        self._refresh_issues_list()
        self._refresh_analysis_text()
    
    def _check_material_match(self):
        """检查材料记录匹配"""
        if self.current_project is None:
            return
        
        # 获取材料记录
        material_records = []
        for record in self.csv_parser.material_records:
            material_records.append({
                "page_number": record.page_number,
                "usage_area": record.usage_area,
                "material_name": record.material_name
            })
        
        # 获取标注缺损
        annotated_defects = []
        for defect in self.csv_parser.defect_annotations:
            annotated_defects.append({
                "page_number": defect.page_number,
                "area": defect.area,
                "defect_type": defect.defect_type
            })
        
        # 按页码分组检查
        page_numbers = set([m["page_number"] for m in material_records] + 
                           [d["page_number"] for d in annotated_defects])
        
        for page_num in page_numbers:
            page_materials = [m for m in material_records if m["page_number"] == page_num]
            page_defects = [d for d in annotated_defects if d["page_number"] == page_num]
            
            issues = self.area_calculator.check_material_area_match(
                page_materials, page_defects, []
            )
            
            for issue in issues:
                self._add_issue_to_project("material", issue.severity, page_num, issue.message)
        
        self._refresh_issues_list()
        self._refresh_analysis_text()
    
    def _add_issue_to_project(self, issue_type: str, severity: str, page: Optional[int], message: str):
        """添加问题到项目"""
        if self.current_project is None:
            return
        
        issue = {
            "id": f"issue_{len(self.current_project.issues) + 1}",
            "type": issue_type,
            "severity": severity,
            "page_number": page,
            "message": message,
            "timestamp": datetime.now().isoformat(),
            "reviewed": False
        }
        
        self.current_project.issues.append(issue)
    
    def _refresh_issues_list(self):
        """刷新问题列表"""
        # 清除现有项
        for item in self.issues_tree.get_children():
            self.issues_tree.delete(item)
        
        if self.current_project is None:
            return
        
        # 添加问题
        for issue in self.current_project.issues:
            # 转换严重程度为中文
            severity_map = {
                "high": "高",
                "medium": "中",
                "low": "低",
                "warning": "警告"
            }
            
            # 转换问题类型为中文
            type_map = {
                "page": "页码",
                "area": "面积",
                "color": "颜色",
                "material": "材料"
            }
            
            self.issues_tree.insert("", tk.END, values=(
                type_map.get(issue.get("type", "unknown"), issue.get("type", "unknown")),
                severity_map.get(issue.get("severity", "unknown"), issue.get("severity", "unknown")),
                issue.get("page_number", "-") or "-",
                issue.get("message", "")[:50]
            ))
    
    def _refresh_analysis_text(self):
        """刷新分析结果文本"""
        self.analysis_text.delete(1.0, tk.END)
        
        if self.current_project is None:
            return
        
        # 生成分析报告
        report_lines = []
        report_lines.append("=" * 50)
        report_lines.append("分析结果报告")
        report_lines.append("=" * 50)
        report_lines.append("")
        
        # 项目信息
        report_lines.append(f"项目名称: {self.current_project.project_name}")
        report_lines.append(f"分析时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        report_lines.append("")
        
        # 统计信息
        total_pages = len(self.current_project.page_numbers)
        total_issues = len(self.current_project.issues)
        
        severity_counts = {"high": 0, "medium": 0, "low": 0, "warning": 0}
        type_counts = {"page": 0, "area": 0, "color": 0, "material": 0}
        
        for issue in self.current_project.issues:
            severity = issue.get("severity", "low")
            if severity in severity_counts:
                severity_counts[severity] += 1
            
            issue_type = issue.get("type", "unknown")
            if issue_type in type_counts:
                type_counts[issue_type] += 1
        
        report_lines.append(f"总页数: {total_pages}")
        report_lines.append(f"总问题数: {total_issues}")
        report_lines.append("")
        
        report_lines.append("问题严重程度分布:")
        report_lines.append(f"  高严重度: {severity_counts['high']}")
        report_lines.append(f"  中严重度: {severity_counts['medium']}")
        report_lines.append(f"  低严重度: {severity_counts['low']}")
        report_lines.append(f"  警告: {severity_counts['warning']}")
        report_lines.append("")
        
        report_lines.append("问题类型分布:")
        report_lines.append(f"  页码问题: {type_counts['page']}")
        report_lines.append(f"  面积问题: {type_counts['area']}")
        report_lines.append(f"  颜色问题: {type_counts['color']}")
        report_lines.append(f"  材料问题: {type_counts['material']}")
        report_lines.append("")
        
        report_lines.append("-" * 50)
        report_lines.append("问题详情:")
        report_lines.append("-" * 50)
        report_lines.append("")
        
        for i, issue in enumerate(self.current_project.issues, 1):
            severity_map = {"high": "高", "medium": "中", "low": "低", "warning": "警告"}
            type_map = {"page": "页码", "area": "面积", "color": "颜色", "material": "材料"}
            
            report_lines.append(f"问题 #{i}:")
            report_lines.append(f"  类型: {type_map.get(issue.get('type', 'unknown'), issue.get('type', 'unknown'))}")
            report_lines.append(f"  严重程度: {severity_map.get(issue.get('severity', 'unknown'), issue.get('severity', 'unknown'))}")
            report_lines.append(f"  页码: {issue.get('page_number', '-') or '-'}")
            report_lines.append(f"  描述: {issue.get('message', '')}")
            report_lines.append("")
        
        # 写入文本框
        self.analysis_text.insert(tk.END, "\n".join(report_lines))
    
    def _set_view_mode(self, mode: str):
        """设置查看模式"""
        # 这个功能由ImageViewer处理
        # 这里需要更新image_viewer的模式
        if hasattr(self, 'image_viewer'):
            self.image_viewer.current_mode = mode
            self.image_viewer._on_mode_changed()
    
    def _clear_all_annotations(self):
        """清除所有标注"""
        if messagebox.askyesno("确认", "确定要清除所有标注吗？"):
            self.annotation_tool.clear()
            if self.current_project:
                self.current_project.manual_annotations.pop(self.current_page, None)
    
    # ==================== 导出功能 ====================
    
    def _show_export_dialog(self):
        """显示导出对话框"""
        dialog = tk.Toplevel(self.root)
        dialog.title("导出选项")
        dialog.geometry("350x250")
        dialog.transient(self.root)
        dialog.grab_set()
        
        ttk.Label(dialog, text="选择导出格式:", font=("Arial", 11, "bold")).pack(pady=15)
        
        export_var = tk.StringVar(value="markdown")
        
        ttk.Radiobutton(
            dialog, 
            text="复核单 (Markdown)",
            variable=export_var,
            value="markdown"
        ).pack(anchor=tk.W, padx=50, pady=5)
        
        ttk.Radiobutton(
            dialog, 
            text="问题清单 (CSV)",
            variable=export_var,
            value="csv"
        ).pack(anchor=tk.W, padx=50, pady=5)
        
        ttk.Radiobutton(
            dialog, 
            text="审计包 (JSON)",
            variable=export_var,
            value="json"
        ).pack(anchor=tk.W, padx=50, pady=5)
        
        def on_export():
            format_type = export_var.get()
            dialog.destroy()
            
            if format_type == "markdown":
                self._export_markdown()
            elif format_type == "csv":
                self._export_csv_issues()
            elif format_type == "json":
                self._export_json_audit()
        
        button_frame = ttk.Frame(dialog)
        button_frame.pack(pady=20)
        
        ttk.Button(button_frame, text="导出", command=on_export, width=10).pack(side=tk.LEFT, padx=10)
        ttk.Button(button_frame, text="取消", command=dialog.destroy, width=10).pack(side=tk.LEFT, padx=10)
        
        self.root.wait_window(dialog)
    
    def _export_markdown(self):
        """导出Markdown复核单"""
        if self.current_project is None:
            messagebox.showwarning("警告", "没有打开的项目")
            return
        
        from export.markdown_exporter import MarkdownExporter
        
        save_path = filedialog.asksaveasfilename(
            title="保存复核单",
            defaultextension=".md",
            filetypes=[("Markdown文件", "*.md"), ("所有文件", "*.*")]
        )
        
        if save_path:
            try:
                exporter = MarkdownExporter()
                exporter.export(self.current_project, save_path)
                self._update_status(f"已导出复核单: {os.path.basename(save_path)}")
                messagebox.showinfo("完成", "复核单已成功导出")
            except Exception as e:
                messagebox.showerror("错误", f"导出失败: {e}")
    
    def _export_csv_issues(self):
        """导出CSV问题清单"""
        if self.current_project is None:
            messagebox.showwarning("警告", "没有打开的项目")
            return
        
        from export.csv_exporter import CSVExporter
        
        save_path = filedialog.asksaveasfilename(
            title="保存问题清单",
            defaultextension=".csv",
            filetypes=[("CSV文件", "*.csv"), ("所有文件", "*.*")]
        )
        
        if save_path:
            try:
                exporter = CSVExporter()
                exporter.export_issues(self.current_project, save_path)
                self._update_status(f"已导出问题清单: {os.path.basename(save_path)}")
                messagebox.showinfo("完成", "问题清单已成功导出")
            except Exception as e:
                messagebox.showerror("错误", f"导出失败: {e}")
    
    def _export_json_audit(self):
        """导出JSON审计包"""
        if self.current_project is None:
            messagebox.showwarning("警告", "没有打开的项目")
            return
        
        from export.json_exporter import JSONExporter
        
        save_path = filedialog.asksaveasfilename(
            title="保存审计包",
            defaultextension=".json",
            filetypes=[("JSON文件", "*.json"), ("所有文件", "*.*")]
        )
        
        if save_path:
            try:
                exporter = JSONExporter()
                exporter.export(self.current_project, save_path)
                self._update_status(f"已导出审计包: {os.path.basename(save_path)}")
                messagebox.showinfo("完成", "审计包已成功导出")
            except Exception as e:
                messagebox.showerror("错误", f"导出失败: {e}")
    
    # ==================== 帮助功能 ====================
    
    def _show_help(self):
        """显示帮助"""
        help_text = """
修复前后影像比对台 - 使用说明

基本操作流程:
1. 创建或打开项目
2. 导入修复前后图像
3. 导入病害标注CSV和材料记录CSV
4. 运行完整分析
5. 人工圈选复核
6. 导出结果

主要功能:
- 并排/叠加查看修复前后图像
- 自动检测缺损区域变化
- 分析颜色变化和色差
- 检查页码、面积、材料记录一致性
- 支持人工圈选标注
- 导出复核单、问题清单、审计包

快捷键:
- Ctrl+N: 新建项目
- Ctrl+O: 打开项目
- Ctrl+S: 保存项目
- Ctrl++: 放大
- Ctrl+-: 缩小
- Ctrl+0: 适应窗口
        """
        
        messagebox.showinfo("使用说明", help_text.strip())
    
    def _show_about(self):
        """显示关于"""
        about_text = """
修复前后影像比对台
版本 1.0.0

古籍修复质量管控系统
用于检测页码串错、面积漏算、色差异常等问题

功能模块:
- 图像处理: 图像比对、缺损分析、色差计算
- 标注解析: CSV文件解析
- 规则引擎: 页码、面积、颜色检查
- 持久化: 项目数据保存
- 导出: Markdown、CSV、JSON
        """
        
        messagebox.showinfo("关于", about_text.strip())
