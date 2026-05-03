import tkinter as tk
from tkinter import ttk, messagebox, filedialog
from pathlib import Path
from datetime import datetime
from typing import Optional, Dict, Any

import config
from models.workbench import Workbench, WorkbenchItem
from models.issue import Issue
from models.enums import IssueSeverity, OrderStatus
from parsers.import_manager import ImportManager
from rules.rule_engine import RuleEngine
from storage.local_storage import LocalStorage
from storage.history import HistoryManager
from exporters.markdown_exporter import MarkdownExporter
from exporters.csv_exporter import CSVExporter
from exporters.json_exporter import JSONExporter
from gui.import_page import ImportPage
from gui.workbench_page import WorkbenchPage
from gui.export_page import ExportPage


class ReviewWorkbenchApp:
    def __init__(self):
        self.root = tk.Tk()
        self.root.title("取模返工复核台")
        self.root.geometry("1400x900")
        self.root.minsize(1000, 700)

        self._setup_style()

        self.workbench: Optional[Workbench] = None
        self.storage = LocalStorage()
        self.history = HistoryManager()
        self.import_manager = ImportManager()
        self.rule_engine = RuleEngine(config.CHECK_CONFIG)

        self.current_page = None
        self.pages: Dict[str, Any] = {}

        self._load_workbench()
        self._create_menu()
        self._create_toolbar()
        self._create_statusbar()
        self._create_main_content()

        self.root.protocol("WM_DELETE_WINDOW", self._on_close)

    def _setup_style(self):
        style = ttk.Style()
        style.theme_use('clam')

        style.configure('Title.TLabel', font=('Microsoft YaHei', 14, 'bold'))
        style.configure('Subtitle.TLabel', font=('Microsoft YaHei', 11))
        style.configure('Info.TLabel', font=('Microsoft YaHei', 9))
        style.configure('Status.TLabel', font=('Microsoft YaHei', 9), foreground='gray')

        style.configure('Critical.TLabel', foreground='#dc3545', font=('Microsoft YaHei', 9, 'bold'))
        style.configure('High.TLabel', foreground='#fd7e14', font=('Microsoft YaHei', 9, 'bold'))
        style.configure('Medium.TLabel', foreground='#ffc107', font=('Microsoft YaHei', 9))
        style.configure('Low.TLabel', foreground='#28a745', font=('Microsoft YaHei', 9))
        style.configure('Success.TLabel', foreground='#28a745', font=('Microsoft YaHei', 9, 'bold'))

        style.configure('Action.TButton', font=('Microsoft YaHei', 10), padding=5)
        style.configure('Toolbar.TButton', font=('Microsoft YaHei', 9), padding=3)

    def _load_workbench(self):
        self.workbench = self.storage.load()
        if not self.workbench:
            self.workbench = Workbench(name="今日复核台")

    def _create_menu(self):
        menubar = tk.Menu(self.root)
        self.root.config(menu=menubar)

        file_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="文件(F)", menu=file_menu, underline=3)

        file_menu.add_command(label="新建工作台", command=self._new_workbench)
        file_menu.add_separator()
        file_menu.add_command(label="保存", command=self._save_workbench)
        file_menu.add_command(label="另存为...", command=self._save_workbench_as)
        file_menu.add_command(label="打开...", command=self._open_workbench)
        file_menu.add_separator()
        file_menu.add_command(label="导入数据", command=self._show_import_page)
        file_menu.add_separator()
        file_menu.add_command(label="退出", command=self._on_close)

        edit_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="编辑(E)", menu=edit_menu, underline=3)

        edit_menu.add_command(label="撤销", command=self._undo, accelerator="Ctrl+Z")
        edit_menu.add_command(label="重做", command=self._redo, accelerator="Ctrl+Y")
        edit_menu.add_separator()
        edit_menu.add_command(label="运行检查", command=self._run_rules)

        view_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="视图(V)", menu=view_menu, underline=3)

        view_menu.add_command(label="工作台", command=lambda: self._show_page("workbench"))
        view_menu.add_command(label="问题列表", command=lambda: self._show_issues_only())

        export_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="导出(X)", menu=export_menu, underline=3)

        export_menu.add_command(label="Markdown交付单", command=lambda: self._export_markdown())
        export_menu.add_command(label="CSV问题表", command=lambda: self._export_csv_issues())
        export_menu.add_command(label="CSV订单表", command=lambda: self._export_csv_orders())
        export_menu.add_command(label="JSON审计包", command=lambda: self._export_json_audit())

        help_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="帮助(H)", menu=help_menu, underline=3)

        help_menu.add_command(label="关于", command=self._show_about)

        self.root.bind_all("<Control-s>", lambda e: self._save_workbench())
        self.root.bind_all("<Control-z>", lambda e: self._undo())
        self.root.bind_all("<Control-y>", lambda e: self._redo())

    def _create_toolbar(self):
        toolbar = ttk.Frame(self.root)
        toolbar.pack(side=tk.TOP, fill=tk.X, padx=5, pady=5)

        ttk.Button(toolbar, text="导入数据", style='Toolbar.TButton',
                   command=self._show_import_page).pack(side=tk.LEFT, padx=2)

        ttk.Button(toolbar, text="运行检查", style='Toolbar.TButton',
                   command=self._run_rules).pack(side=tk.LEFT, padx=2)

        ttk.Separator(toolbar, orient=tk.VERTICAL).pack(side=tk.LEFT, padx=10, fill=tk.Y)

        self.undo_btn = ttk.Button(toolbar, text="撤销", style='Toolbar.TButton',
                                    command=self._undo, state=tk.DISABLED)
        self.undo_btn.pack(side=tk.LEFT, padx=2)

        self.redo_btn = ttk.Button(toolbar, text="重做", style='Toolbar.TButton',
                                    command=self._redo, state=tk.DISABLED)
        self.redo_btn.pack(side=tk.LEFT, padx=2)

        ttk.Separator(toolbar, orient=tk.VERTICAL).pack(side=tk.LEFT, padx=10, fill=tk.Y)

        ttk.Button(toolbar, text="导出", style='Toolbar.TButton',
                   command=self._show_export_page).pack(side=tk.LEFT, padx=2)

        ttk.Separator(toolbar, orient=tk.VERTICAL).pack(side=tk.LEFT, padx=10, fill=tk.Y)

        self.save_btn = ttk.Button(toolbar, text="保存", style='Toolbar.TButton',
                                    command=self._save_workbench)
        self.save_btn.pack(side=tk.LEFT, padx=2)

        self._update_undo_redo_buttons()

    def _create_statusbar(self):
        statusbar = ttk.Frame(self.root)
        statusbar.pack(side=tk.BOTTOM, fill=tk.X)

        self.status_label = ttk.Label(statusbar, text="就绪", style='Status.TLabel')
        self.status_label.pack(side=tk.LEFT, padx=10, pady=2)

        self.item_count_label = ttk.Label(statusbar, text="订单: 0", style='Status.TLabel')
        self.item_count_label.pack(side=tk.RIGHT, padx=10, pady=2)

        self.issue_count_label = ttk.Label(statusbar, text="问题: 0", style='Status.TLabel')
        self.issue_count_label.pack(side=tk.RIGHT, padx=10, pady=2)

        self._update_statusbar()

    def _create_main_content(self):
        self.main_frame = ttk.Frame(self.root)
        self.main_frame.pack(side=tk.TOP, fill=tk.BOTH, expand=True, padx=5, pady=5)

        self._show_page("workbench")

    def _show_page(self, page_name: str):
        for widget in self.main_frame.winfo_children():
            widget.destroy()

        self.current_page = page_name

        if page_name == "import":
            self.pages["import"] = ImportPage(self.main_frame, self)
            self.pages["import"].pack(fill=tk.BOTH, expand=True)
        elif page_name == "workbench":
            self.pages["workbench"] = WorkbenchPage(self.main_frame, self)
            self.pages["workbench"].pack(fill=tk.BOTH, expand=True)
        elif page_name == "export":
            self.pages["export"] = ExportPage(self.main_frame, self)
            self.pages["export"].pack(fill=tk.BOTH, expand=True)

    def _update_statusbar(self):
        if self.workbench:
            item_count = self.workbench.item_count
            issue_count = self.workbench.total_issues
            unresolved_count = self.workbench.total_unresolved_issues

            self.item_count_label.config(text=f"订单: {item_count}")

            if unresolved_count > 0:
                self.issue_count_label.config(text=f"问题: {unresolved_count}/{issue_count}", foreground='#dc3545')
            else:
                self.issue_count_label.config(text=f"问题: 0/{issue_count}")

    def _update_undo_redo_buttons(self):
        if self.history.can_undo:
            self.undo_btn.config(state=tk.NORMAL)
        else:
            self.undo_btn.config(state=tk.DISABLED)

        if self.history.can_redo:
            self.redo_btn.config(state=tk.NORMAL)
        else:
            self.redo_btn.config(state=tk.DISABLED)

    def _set_status(self, message: str):
        self.status_label.config(text=message)
        self.root.update_idletasks()

    def _new_workbench(self):
        if self.workbench and self.workbench.item_count > 0:
            if not messagebox.askyesno("确认", "当前工作台有数据，确定要新建吗？"):
                return

        self._save_to_history("新建工作台")
        self.workbench = Workbench(name="新建复核台")
        self._show_page("workbench")
        self._update_statusbar()
        self._set_status("已新建工作台")

    def _save_workbench(self):
        if not self.workbench:
            return

        self._save_to_history("保存前状态")

        result = self.storage.save(self.workbench)
        if result.success:
            self._set_status(result.message)
            messagebox.showinfo("保存成功", result.message)
        else:
            messagebox.showerror("保存失败", "\n".join(result.errors))

    def _save_workbench_as(self):
        if not self.workbench:
            return

        file_path = filedialog.asksaveasfilename(
            title="另存为",
            defaultextension=".json",
            filetypes=[("JSON文件", "*.json"), ("所有文件", "*.*")]
        )

        if file_path:
            result = self.storage.export_to_file(Path(file_path), self.workbench)
            if result.success:
                self._set_status(result.message)
                messagebox.showinfo("保存成功", result.message)
            else:
                messagebox.showerror("保存失败", "\n".join(result.errors))

    def _open_workbench(self):
        file_path = filedialog.askopenfilename(
            title="打开工作台文件",
            filetypes=[("JSON文件", "*.json"), ("所有文件", "*.*")]
        )

        if file_path:
            workbench, result = self.storage.import_from_file(Path(file_path))
            if result.success:
                self._save_to_history("打开文件前状态")
                self.workbench = workbench
                self._show_page("workbench")
                self._update_statusbar()
                self._set_status(result.message)
            else:
                messagebox.showerror("打开失败", "\n".join(result.errors))

    def _save_to_history(self, description: str):
        if self.workbench:
            self.history.create_snapshot_action(
                action="修改",
                description=description,
                workbench=self.workbench
            )
            self._update_undo_redo_buttons()

    def _undo(self):
        if not self.history.can_undo:
            return

        snapshot = self.history.undo()
        if snapshot:
            self.workbench = Workbench.from_dict(snapshot)
            self._show_page("workbench")
            self._update_statusbar()
            self._update_undo_redo_buttons()
            self._set_status(f"已撤销: {self.history.get_undo_description() or ''}")

    def _redo(self):
        if not self.history.can_redo:
            return

        snapshot = self.history.redo()
        if snapshot:
            self.workbench = Workbench.from_dict(snapshot)
            self._show_page("workbench")
            self._update_statusbar()
            self._update_undo_redo_buttons()
            self._set_status(f"已重做: {self.history.get_redo_description() or ''}")

    def _run_rules(self):
        if not self.workbench or self.workbench.item_count == 0:
            messagebox.showwarning("提示", "工作台没有数据，请先导入数据")
            return

        self._set_status("正在运行检查规则...")
        self.root.update()

        self._save_to_history("运行检查前")

        result = self.rule_engine.run_and_apply(self.workbench)

        self._update_statusbar()
        self._show_page("workbench")

        if result.success:
            stats = result.stats
            message = f"检查完成\n\n"
            message += f"总问题数: {stats['total_issues']}\n"
            message += f"严重: {stats['by_severity'].get('严重', 0)}\n"
            message += f"高: {stats['by_severity'].get('高', 0)}\n"
            message += f"中: {stats['by_severity'].get('中', 0)}\n"
            message += f"低: {stats['by_severity'].get('低', 0)}"

            self._set_status(f"检查完成，发现 {stats['total_issues']} 个问题")
            messagebox.showinfo("检查结果", message)
        else:
            messagebox.showerror("检查失败", "\n".join(result.errors))

    def _show_import_page(self):
        self._show_page("import")

    def _show_export_page(self):
        self._show_page("export")

    def _show_issues_only(self):
        if "workbench" in self.pages:
            self.pages["workbench"].filter_issues_only()

    def _export_markdown(self):
        if not self.workbench or self.workbench.item_count == 0:
            messagebox.showwarning("提示", "工作台没有数据")
            return

        file_path = filedialog.asksaveasfilename(
            title="导出Markdown交付单",
            defaultextension=".md",
            filetypes=[("Markdown文件", "*.md"), ("所有文件", "*.*")]
        )

        if file_path:
            exporter = MarkdownExporter()
            result = exporter.export(self.workbench, Path(file_path))
            if result.success:
                messagebox.showinfo("导出成功", result.message)
            else:
                messagebox.showerror("导出失败", "\n".join(result.errors))

    def _export_csv_issues(self):
        if not self.workbench:
            return

        file_path = filedialog.asksaveasfilename(
            title="导出问题表",
            defaultextension=".csv",
            filetypes=[("CSV文件", "*.csv"), ("所有文件", "*.*")]
        )

        if file_path:
            exporter = CSVExporter()
            result = exporter.export_issues(self.workbench, Path(file_path))
            if result.success:
                messagebox.showinfo("导出成功", result.message)
            else:
                messagebox.showerror("导出失败", "\n".join(result.errors))

    def _export_csv_orders(self):
        if not self.workbench:
            return

        file_path = filedialog.asksaveasfilename(
            title="导出订单表",
            defaultextension=".csv",
            filetypes=[("CSV文件", "*.csv"), ("所有文件", "*.*")]
        )

        if file_path:
            exporter = CSVExporter()
            result = exporter.export_orders(self.workbench, Path(file_path))
            if result.success:
                messagebox.showinfo("导出成功", result.message)
            else:
                messagebox.showerror("导出失败", "\n".join(result.errors))

    def _export_json_audit(self):
        if not self.workbench:
            return

        file_path = filedialog.asksaveasfilename(
            title="导出审计包",
            defaultextension=".json",
            filetypes=[("JSON文件", "*.json"), ("所有文件", "*.*")]
        )

        if file_path:
            exporter = JSONExporter()
            result = exporter.export_audit_package(self.workbench, Path(file_path))
            if result.success:
                messagebox.showinfo("导出成功", result.message)
            else:
                messagebox.showerror("导出失败", "\n".join(result.errors))

    def _show_about(self):
        messagebox.showinfo(
            "关于",
            "取模返工复核台 v1.0\n\n"
            "牙科义齿加工所前台管理系统\n"
            "用于检查模型编号串单、咬合关系缺图、返工原因没闭环等问题"
        )

    def _on_close(self):
        if self.workbench and self.workbench.item_count > 0:
            if messagebox.askyesnocancel("确认退出", "是否保存当前工作台数据？"):
                self._save_workbench()
                self.root.destroy()
            else:
                self.root.destroy()
        else:
            self.root.destroy()

    def run(self):
        self._set_status("就绪 - 请导入数据开始复核")
        self.root.mainloop()
