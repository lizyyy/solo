import tkinter as tk
from tkinter import ttk, messagebox
from datetime import datetime
from typing import Optional, List

from models.workbench import WorkbenchItem
from models.issue import Issue
from models.enums import IssueSeverity, ReviewStatus, OrderStatus


class WorkbenchPage(ttk.Frame):
    def __init__(self, parent, app):
        super().__init__(parent)
        self.app = app
        self.selected_item: Optional[WorkbenchItem] = None
        self.show_issues_only = False

        self._create_ui()
        self._refresh_list()

    def _create_ui(self):
        self.columnconfigure(1, weight=1)
        self.rowconfigure(0, weight=1)

        self._create_left_panel()
        self._create_right_panel()

    def _create_left_panel(self):
        left_frame = ttk.Frame(self, width=400)
        left_frame.grid(row=0, column=0, sticky="ns", padx=5, pady=5)
        left_frame.grid_propagate(False)

        filter_frame = ttk.Frame(left_frame)
        filter_frame.pack(fill=tk.X, padx=5, pady=5)

        ttk.Label(filter_frame, text="筛选:", style='Info.TLabel').pack(side=tk.LEFT, padx=5)

        self.filter_var = tk.StringVar(value="all")
        ttk.Radiobutton(
            filter_frame, text="全部", variable=self.filter_var, value="all",
            command=self._apply_filter
        ).pack(side=tk.LEFT, padx=5)

        ttk.Radiobutton(
            filter_frame, text="有问题", variable=self.filter_var, value="issues",
            command=self._apply_filter
        ).pack(side=tk.LEFT, padx=5)

        ttk.Radiobutton(
            filter_frame, text="加急", variable=self.filter_var, value="urgent",
            command=self._apply_filter
        ).pack(side=tk.LEFT, padx=5)

        search_frame = ttk.Frame(left_frame)
        search_frame.pack(fill=tk.X, padx=5, pady=5)

        ttk.Label(search_frame, text="搜索:", style='Info.TLabel').pack(side=tk.LEFT, padx=5)

        self.search_var = tk.StringVar()
        self.search_var.trace("w", self._on_search)
        ttk.Entry(search_frame, textvariable=self.search_var).pack(
            side=tk.LEFT, fill=tk.X, expand=True, padx=5
        )

        list_frame = ttk.LabelFrame(left_frame, text="订单列表")
        list_frame.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)

        columns = ("model_id", "patient", "doctor", "status", "issues")
        self.tree = ttk.Treeview(
            list_frame,
            columns=columns,
            show="headings",
            selectmode=tk.BROWSE,
        )

        self.tree.heading("model_id", text="模型编号")
        self.tree.heading("patient", text="患者")
        self.tree.heading("doctor", text="医生")
        self.tree.heading("status", text="状态")
        self.tree.heading("issues", text="问题")

        self.tree.column("model_id", width=100)
        self.tree.column("patient", width=80)
        self.tree.column("doctor", width=80)
        self.tree.column("status", width=70)
        self.tree.column("issues", width=50)

        self.tree.pack(fill=tk.BOTH, expand=True)
        self.tree.bind("<<TreeviewSelect>>", self._on_select)

        scrollbar = ttk.Scrollbar(list_frame, orient=tk.VERTICAL, command=self.tree.yview)
        self.tree.configure(yscrollcommand=scrollbar.set)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)

        stats_frame = ttk.Frame(left_frame)
        stats_frame.pack(fill=tk.X, padx=5, pady=5)

        self.total_label = ttk.Label(stats_frame, text="总: 0", style='Info.TLabel')
        self.total_label.pack(side=tk.LEFT, padx=5)

        self.issues_label = ttk.Label(stats_frame, text="问题: 0", style='Info.TLabel')
        self.issues_label.pack(side=tk.LEFT, padx=5)

        self.unresolved_label = ttk.Label(stats_frame, text="未解决: 0", style='Critical.TLabel')
        self.unresolved_label.pack(side=tk.LEFT, padx=5)

    def _create_right_panel(self):
        right_frame = ttk.Frame(self)
        right_frame.grid(row=0, column=1, sticky="nsew", padx=5, pady=5)
        right_frame.columnconfigure(0, weight=1)
        right_frame.rowconfigure(1, weight=1)

        self.header_label = ttk.Label(
            right_frame,
            text="请选择一个订单查看详情",
            style='Title.TLabel'
        )
        self.header_label.grid(row=0, column=0, sticky="w", padx=5, pady=5)

        notebook = ttk.Notebook(right_frame)
        notebook.grid(row=1, column=0, sticky="nsew")

        self.info_frame = ttk.Frame(notebook)
        notebook.add(self.info_frame, text="基本信息")

        self.issues_frame = ttk.Frame(notebook)
        notebook.add(self.issues_frame, text="问题列表")

        self.photos_frame = ttk.Frame(notebook)
        notebook.add(self.photos_frame, text="照片")

        self.stl_frame = ttk.Frame(notebook)
        notebook.add(self.stl_frame, text="STL文件")

        self.review_frame = ttk.Frame(notebook)
        notebook.add(self.review_frame, text="复核备注")

        self._setup_info_tab()
        self._setup_issues_tab()
        self._setup_photos_tab()
        self._setup_stl_tab()
        self._setup_review_tab()

    def _setup_info_tab(self):
        self.info_frame.columnconfigure(1, weight=1)

        row = 0
        ttk.Label(self.info_frame, text="模型编号:", style='Info.TLabel').grid(
            row=row, column=0, sticky="w", padx=10, pady=5
        )
        self.info_model_id = ttk.Label(self.info_frame, text="-", style='Subtitle.TLabel')
        self.info_model_id.grid(row=row, column=1, sticky="w", padx=10, pady=5)

        row += 1
        ttk.Label(self.info_frame, text="患者姓名:", style='Info.TLabel').grid(
            row=row, column=0, sticky="w", padx=10, pady=5
        )
        self.info_patient = ttk.Label(self.info_frame, text="-", style='Info.TLabel')
        self.info_patient.grid(row=row, column=1, sticky="w", padx=10, pady=5)

        row += 1
        ttk.Label(self.info_frame, text="医生姓名:", style='Info.TLabel').grid(
            row=row, column=0, sticky="w", padx=10, pady=5
        )
        self.info_doctor = ttk.Label(self.info_frame, text="-", style='Info.TLabel')
        self.info_doctor.grid(row=row, column=1, sticky="w", padx=10, pady=5)

        row += 1
        ttk.Label(self.info_frame, text="牙位:", style='Info.TLabel').grid(
            row=row, column=0, sticky="w", padx=10, pady=5
        )
        self.info_tooth = ttk.Label(self.info_frame, text="-", style='Info.TLabel')
        self.info_tooth.grid(row=row, column=1, sticky="w", padx=10, pady=5)

        row += 1
        ttk.Label(self.info_frame, text="修复类型:", style='Info.TLabel').grid(
            row=row, column=0, sticky="w", padx=10, pady=5
        )
        self.info_restoration = ttk.Label(self.info_frame, text="-", style='Info.TLabel')
        self.info_restoration.grid(row=row, column=1, sticky="w", padx=10, pady=5)

        row += 1
        ttk.Label(self.info_frame, text="材料:", style='Info.TLabel').grid(
            row=row, column=0, sticky="w", padx=10, pady=5
        )
        self.info_material = ttk.Label(self.info_frame, text="-", style='Info.TLabel')
        self.info_material.grid(row=row, column=1, sticky="w", padx=10, pady=5)

        row += 1
        ttk.Label(self.info_frame, text="比色:", style='Info.TLabel').grid(
            row=row, column=0, sticky="w", padx=10, pady=5
        )
        self.info_shade = ttk.Label(self.info_frame, text="-", style='Info.TLabel')
        self.info_shade.grid(row=row, column=1, sticky="w", padx=10, pady=5)

        row += 1
        ttk.Separator(self.info_frame, orient=tk.HORIZONTAL).grid(
            row=row, column=0, columnspan=2, sticky="ew", padx=10, pady=10
        )

        row += 1
        ttk.Label(self.info_frame, text="当前状态:", style='Info.TLabel').grid(
            row=row, column=0, sticky="w", padx=10, pady=5
        )
        self.info_status = ttk.Label(self.info_frame, text="-", style='Info.TLabel')
        self.info_status.grid(row=row, column=1, sticky="w", padx=10, pady=5)

        row += 1
        ttk.Label(self.info_frame, text="返工次数:", style='Info.TLabel').grid(
            row=row, column=0, sticky="w", padx=10, pady=5
        )
        self.info_rework_count = ttk.Label(self.info_frame, text="0", style='Info.TLabel')
        self.info_rework_count.grid(row=row, column=1, sticky="w", padx=10, pady=5)

        row += 1
        ttk.Label(self.info_frame, text="交付日期:", style='Info.TLabel').grid(
            row=row, column=0, sticky="w", padx=10, pady=5
        )
        self.info_delivery = ttk.Label(self.info_frame, text="-", style='Info.TLabel')
        self.info_delivery.grid(row=row, column=1, sticky="w", padx=10, pady=5)

    def _setup_issues_tab(self):
        self.issues_frame.columnconfigure(0, weight=1)
        self.issues_frame.rowconfigure(0, weight=1)

        columns = ("severity", "type", "title", "status", "resolved")
        self.issues_tree = ttk.Treeview(
            self.issues_frame,
            columns=columns,
            show="headings",
            selectmode=tk.BROWSE,
        )

        self.issues_tree.heading("severity", text="严重程度")
        self.issues_tree.heading("type", text="问题类型")
        self.issues_tree.heading("title", text="问题标题")
        self.issues_tree.heading("status", text="复核状态")
        self.issues_tree.heading("resolved", text="是否解决")

        self.issues_tree.column("severity", width=80)
        self.issues_tree.column("type", width=100)
        self.issues_tree.column("title", width=300)
        self.issues_tree.column("status", width=80)
        self.issues_tree.column("resolved", width=80)

        self.issues_tree.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)
        self.issues_tree.bind("<<TreeviewSelect>>", self._on_issue_select)

        scrollbar = ttk.Scrollbar(self.issues_frame, orient=tk.VERTICAL, command=self.issues_tree.yview)
        self.issues_tree.configure(yscrollcommand=scrollbar.set)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)

        detail_frame = ttk.LabelFrame(self.issues_frame, text="问题详情")
        detail_frame.pack(fill=tk.X, padx=5, pady=5)

        detail_frame.columnconfigure(1, weight=1)

        ttk.Label(detail_frame, text="描述:", style='Info.TLabel').grid(
            row=0, column=0, sticky="nw", padx=5, pady=5
        )
        self.issue_desc = tk.Text(detail_frame, height=4, wrap=tk.WORD)
        self.issue_desc.grid(row=0, column=1, sticky="ew", padx=5, pady=5)

        ttk.Label(detail_frame, text="复核备注:", style='Info.TLabel').grid(
            row=1, column=0, sticky="nw", padx=5, pady=5
        )
        self.issue_review = tk.Text(detail_frame, height=3, wrap=tk.WORD)
        self.issue_review.grid(row=1, column=1, sticky="ew", padx=5, pady=5)

        btn_frame = ttk.Frame(detail_frame)
        btn_frame.grid(row=2, column=0, columnspan=2, sticky="e", padx=5, pady=5)

        ttk.Button(
            btn_frame, text="标记已解决", style='Action.TButton',
            command=self._resolve_issue
        ).pack(side=tk.RIGHT, padx=5)

        ttk.Button(
            btn_frame, text="保存备注", style='Action.TButton',
            command=self._save_issue_notes
        ).pack(side=tk.RIGHT, padx=5)

    def _setup_photos_tab(self):
        self.photos_frame.columnconfigure(0, weight=1)
        self.photos_frame.rowconfigure(0, weight=1)

        columns = ("type", "filename", "taken_at", "size")
        self.photos_tree = ttk.Treeview(
            self.photos_frame,
            columns=columns,
            show="headings",
            selectmode=tk.BROWSE,
        )

        self.photos_tree.heading("type", text="照片类型")
        self.photos_tree.heading("filename", text="文件名")
        self.photos_tree.heading("taken_at", text="拍摄时间")
        self.photos_tree.heading("size", text="大小")

        self.photos_tree.column("type", width=100)
        self.photos_tree.column("filename", width=250)
        self.photos_tree.column("taken_at", width=150)
        self.photos_tree.column("size", width=80)

        self.photos_tree.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)

        scrollbar = ttk.Scrollbar(self.photos_frame, orient=tk.VERTICAL, command=self.photos_tree.yview)
        self.photos_tree.configure(yscrollcommand=scrollbar.set)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)

    def _setup_stl_tab(self):
        self.stl_frame.columnconfigure(0, weight=1)
        self.stl_frame.rowconfigure(0, weight=1)

        columns = ("filename", "jaw", "size", "triangles")
        self.stl_tree = ttk.Treeview(
            self.stl_frame,
            columns=columns,
            show="headings",
            selectmode=tk.BROWSE,
        )

        self.stl_tree.heading("filename", text="文件名")
        self.stl_tree.heading("jaw", text="颌位")
        self.stl_tree.heading("size", text="大小")
        self.stl_tree.heading("triangles", text="三角形数")

        self.stl_tree.column("filename", width=250)
        self.stl_tree.column("jaw", width=80)
        self.stl_tree.column("size", width=100)
        self.stl_tree.column("triangles", width=100)

        self.stl_tree.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)

        scrollbar = ttk.Scrollbar(self.stl_frame, orient=tk.VERTICAL, command=self.stl_tree.yview)
        self.stl_tree.configure(yscrollcommand=scrollbar.set)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)

    def _setup_review_tab(self):
        self.review_frame.columnconfigure(0, weight=1)
        self.review_frame.rowconfigure(0, weight=1)

        ttk.Label(self.review_frame, text="复核备注:", style='Info.TLabel').pack(
            anchor=tk.W, padx=10, pady=5
        )

        self.review_text = tk.Text(self.review_frame, wrap=tk.WORD)
        self.review_text.pack(fill=tk.BOTH, expand=True, padx=10, pady=5)

        btn_frame = ttk.Frame(self.review_frame)
        btn_frame.pack(fill=tk.X, padx=10, pady=10)

        ttk.Button(
            btn_frame, text="保存备注", style='Action.TButton',
            command=self._save_review_notes
        ).pack(side=tk.RIGHT, padx=5)

        ttk.Button(
            btn_frame, text="运行检查", style='Action.TButton',
            command=self._run_check_current
        ).pack(side=tk.RIGHT, padx=5)

    def _refresh_list(self):
        for item in self.tree.get_children():
            self.tree.delete(item)

        if not self.app.workbench:
            self._update_stats()
            return

        search_text = self.search_var.get().lower()
        filter_type = self.filter_var.get()

        for model_id, item in self.app.workbench.items.items():
            if search_text:
                match = False
                if search_text in model_id.lower():
                    match = True
                elif item.order and search_text in item.order.patient_name.lower():
                    match = True
                elif item.order and search_text in item.order.doctor_name.lower():
                    match = True
                if not match:
                    continue

            if filter_type == "issues" and not item.has_issues:
                continue

            if filter_type == "urgent":
                if not (item.order and item.order.is_urgent):
                    continue

            patient_name = item.order.patient_name if item.order else "-"
            doctor_name = item.order.doctor_name if item.order else "-"
            status = item.processing_status.current_status.value if item.processing_status else "-"

            issue_count = item.unresolved_issue_count
            issue_tag = "⚠️" if issue_count > 0 else "✓"

            self.tree.insert("", tk.END, iid=model_id, values=(
                model_id,
                patient_name,
                doctor_name,
                status,
                f"{issue_tag} {issue_count}",
            ))

        self._update_stats()

    def _update_stats(self):
        if not self.app.workbench:
            self.total_label.config(text="总: 0")
            self.issues_label.config(text="问题: 0")
            self.unresolved_label.config(text="未解决: 0")
            return

        total = self.app.workbench.item_count
        with_issues = len(self.app.workbench.items_with_issues)
        unresolved = self.app.workbench.total_unresolved_issues

        self.total_label.config(text=f"总: {total}")
        self.issues_label.config(text=f"问题: {with_issues}")
        self.unresolved_label.config(text=f"未解决: {unresolved}")

    def _on_select(self, event):
        selection = self.tree.selection()
        if not selection:
            return

        model_id = selection[0]
        self.selected_item = self.app.workbench.get_item(model_id)

        if self.selected_item:
            self._load_item_details()

    def _load_item_details(self):
        item = self.selected_item
        if not item:
            return

        order = item.order
        status = item.processing_status

        self.header_label.config(text=f"模型 {item.model_id} - {order.patient_name if order else '未知'}")

        self.info_model_id.config(text=item.model_id)
        self.info_patient.config(text=order.patient_name if order else "-")
        self.info_doctor.config(text=order.doctor_name if order else "-")
        self.info_tooth.config(text=", ".join(order.tooth_positions) if order and order.tooth_positions else "-")
        self.info_restoration.config(text=order.restoration_type if order and order.restoration_type else "-")
        self.info_material.config(text=order.material if order and order.material else "-")
        self.info_shade.config(text=order.shade if order and order.shade else "-")

        if status:
            self.info_status.config(text=status.current_status.value)
            self.info_rework_count.config(text=str(status.rework_count))
            if status.expected_delivery_date:
                self.info_delivery.config(text=status.expected_delivery_date.strftime('%Y-%m-%d'))
            elif order and order.delivery_date:
                self.info_delivery.config(text=order.delivery_date.strftime('%Y-%m-%d'))
            else:
                self.info_delivery.config(text="-")
        else:
            self.info_status.config(text="-")
            self.info_rework_count.config(text="0")
            self.info_delivery.config(text="-")

        self._load_issues()
        self._load_photos()
        self._load_stl()
        self._load_review_notes()

    def _load_issues(self):
        for item in self.issues_tree.get_children():
            self.issues_tree.delete(item)

        if not self.selected_item or not self.selected_item.issues:
            return

        for issue in self.selected_item.issues:
            resolved = "已解决" if issue.is_resolved else "未解决"
            self.issues_tree.insert("", tk.END, iid=issue.internal_id, values=(
                issue.severity.value,
                issue.issue_type.value,
                issue.title,
                issue.review_status.value,
                resolved,
            ))

    def _load_photos(self):
        for item in self.photos_tree.get_children():
            self.photos_tree.delete(item)

        if not self.selected_item or not self.selected_item.photos:
            return

        for photo in self.selected_item.photos:
            taken_at = photo.taken_at.strftime('%Y-%m-%d %H:%M') if photo.taken_at else "-"
            size_mb = photo.file_size / 1024 / 1024
            self.photos_tree.insert("", tk.END, values=(
                photo.photo_type.value,
                photo.file_name,
                taken_at,
                f"{size_mb:.2f} MB",
            ))

    def _load_stl(self):
        for item in self.stl_tree.get_children():
            self.stl_tree.delete(item)

        if not self.selected_item or not self.selected_item.stl_files:
            return

        for stl in self.selected_item.stl_files:
            jaw = stl.jaw or "-"
            size_mb = stl.file_size / 1024 / 1024
            triangles = stl.triangle_count or "-"
            self.stl_tree.insert("", tk.END, values=(
                stl.file_name,
                jaw,
                f"{size_mb:.2f} MB",
                triangles,
            ))

    def _load_review_notes(self):
        self.review_text.delete(1.0, tk.END)
        if self.selected_item and self.selected_item.review_notes:
            self.review_text.insert(tk.END, self.selected_item.review_notes)

    def _on_issue_select(self, event):
        selection = self.issues_tree.selection()
        if not selection or not self.selected_item:
            return

        issue_id = selection[0]
        for issue in self.selected_item.issues:
            if issue.internal_id == issue_id:
                self.issue_desc.delete(1.0, tk.END)
                self.issue_desc.insert(tk.END, issue.description or "")

                self.issue_review.delete(1.0, tk.END)
                self.issue_review.insert(tk.END, issue.reviewer_notes or "")
                break

    def _resolve_issue(self):
        selection = self.issues_tree.selection()
        if not selection or not self.selected_item:
            messagebox.showwarning("提示", "请选择一个问题")
            return

        self.app._save_to_history("解决问题前状态")

        issue_id = selection[0]
        for issue in self.selected_item.issues:
            if issue.internal_id == issue_id:
                issue.is_resolved = True
                issue.resolved_at = datetime.now()
                issue.review_status = ReviewStatus.RESOLVED
                break

        self._load_issues()
        self._refresh_list()
        self.app._update_statusbar()
        self.app._update_undo_redo_buttons()

        messagebox.showinfo("成功", "已标记为已解决")

    def _save_issue_notes(self):
        selection = self.issues_tree.selection()
        if not selection or not self.selected_item:
            messagebox.showwarning("提示", "请选择一个问题")
            return

        self.app._save_to_history("保存问题备注前状态")

        notes = self.issue_review.get(1.0, tk.END).strip()

        issue_id = selection[0]
        for issue in self.selected_item.issues:
            if issue.internal_id == issue_id:
                issue.reviewer_notes = notes
                issue.review_status = ReviewStatus.REVIEWED
                issue.reviewed_at = datetime.now()
                break

        self._load_issues()
        self.app._update_undo_redo_buttons()

        messagebox.showinfo("成功", "备注已保存")

    def _save_review_notes(self):
        if not self.selected_item:
            return

        self.app._save_to_history("保存复核备注前状态")

        notes = self.review_text.get(1.0, tk.END).strip()
        self.selected_item.review_notes = notes

        self.app._update_undo_redo_buttons()
        messagebox.showinfo("成功", "复核备注已保存")

    def _run_check_current(self):
        if not self.selected_item:
            return

        self.app._save_to_history("运行单项检查前状态")

        result = self.app.rule_engine.run_and_apply(
            self.app.workbench,
            self.selected_item
        )

        self._load_issues()
        self._refresh_list()
        self.app._update_statusbar()
        self.app._update_undo_redo_buttons()

        messagebox.showinfo("检查完成", f"发现 {len(result.issues)} 个问题")

    def _apply_filter(self):
        self._refresh_list()

    def _on_search(self, *args):
        self._refresh_list()

    def filter_issues_only(self):
        self.filter_var.set("issues")
        self._refresh_list()
