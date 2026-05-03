import tkinter as tk
from tkinter import ttk, messagebox, filedialog
from pathlib import Path
from datetime import datetime
from typing import Optional

from exporters.markdown_exporter import MarkdownExporter
from exporters.csv_exporter import CSVExporter
from exporters.json_exporter import JSONExporter


class ExportPage(ttk.Frame):
    def __init__(self, parent, app):
        super().__init__(parent)
        self.app = app
        self._create_ui()
        self._update_stats()

    def _create_ui(self):
        self.columnconfigure(0, weight=1)
        self.rowconfigure(2, weight=1)

        title_frame = ttk.Frame(self)
        title_frame.grid(row=0, column=0, sticky="ew", padx=10, pady=10)

        ttk.Label(
            title_frame,
            text="导出数据",
            style='Title.TLabel'
        ).pack(side=tk.LEFT)

        ttk.Label(
            title_frame,
            text="导出Markdown交付单、CSV问题表和JSON审计包",
            style='Subtitle.TLabel'
        ).pack(side=tk.LEFT, padx=20)

        stats_frame = ttk.LabelFrame(self, text="当前工作台统计")
        stats_frame.grid(row=1, column=0, sticky="ew", padx=10, pady=5)

        self.stats_labels = {}
        stats_items = [
            ("total", "总订单数"),
            ("with_issues", "有问题订单"),
            ("issues", "总问题数"),
            ("unresolved", "未解决问题"),
            ("reworks", "返工记录"),
        ]

        for i, (key, label) in enumerate(stats_items):
            ttk.Label(stats_frame, text=f"{label}:", style='Info.TLabel').grid(
                row=0, column=i*2, sticky="w", padx=10, pady=5
            )
            self.stats_labels[key] = ttk.Label(stats_frame, text="0", style='Info.TLabel')
            self.stats_labels[key].grid(row=0, column=i*2+1, sticky="w", padx=5, pady=5)

        main_frame = ttk.Frame(self)
        main_frame.grid(row=2, column=0, sticky="nsew", padx=10, pady=10)
        main_frame.columnconfigure(0, weight=1)
        main_frame.columnconfigure(1, weight=1)
        main_frame.rowconfigure(0, weight=1)

        markdown_frame = ttk.LabelFrame(main_frame, text="Markdown交付单")
        markdown_frame.grid(row=0, column=0, sticky="nsew", padx=5, pady=5)

        desc = (
            "导出完整的交付单文档，包含：\n"
            "• 订单基本信息\n"
            "• 加工状态和返工记录\n"
            "• 问题清单（按严重程度排序）\n"
            "• 照片和STL文件列表\n"
            "• 复核备注\n\n"
            "适合打印或发给医生确认"
        )
        ttk.Label(markdown_frame, text=desc, style='Info.TLabel', justify=tk.LEFT).pack(
            anchor=tk.W, padx=10, pady=10
        )

        self.include_issues_var = tk.BooleanVar(value=True)
        ttk.Checkbutton(
            markdown_frame, text="包含问题清单", variable=self.include_issues_var
        ).pack(anchor=tk.W, padx=10, pady=2)

        self.include_photos_var = tk.BooleanVar(value=True)
        ttk.Checkbutton(
            markdown_frame, text="包含照片列表", variable=self.include_photos_var
        ).pack(anchor=tk.W, padx=10, pady=2)

        self.include_stl_var = tk.BooleanVar(value=True)
        ttk.Checkbutton(
            markdown_frame, text="包含STL文件列表", variable=self.include_stl_var
        ).pack(anchor=tk.W, padx=10, pady=2)

        ttk.Button(
            markdown_frame, text="导出Markdown", style='Action.TButton',
            command=self._export_markdown
        ).pack(anchor=tk.W, padx=10, pady=10)

        csv_frame = ttk.LabelFrame(main_frame, text="CSV问题表/订单表")
        csv_frame.grid(row=0, column=1, sticky="nsew", padx=5, pady=5)

        desc = (
            "导出CSV格式表格，适合用Excel打开：\n"
            "• 问题表：所有问题的详细列表\n"
            "• 订单表：所有订单的汇总信息\n"
            "• 返工表：返工记录汇总\n\n"
            "适合做数据分析或报表"
        )
        ttk.Label(csv_frame, text=desc, style='Info.TLabel', justify=tk.LEFT).pack(
            anchor=tk.W, padx=10, pady=10
        )

        btn_frame1 = ttk.Frame(csv_frame)
        btn_frame1.pack(anchor=tk.W, padx=10, pady=5)

        ttk.Button(
            btn_frame1, text="导出问题表", style='Action.TButton',
            command=self._export_csv_issues
        ).pack(side=tk.LEFT, padx=5)

        self.include_resolved_var = tk.BooleanVar(value=True)
        ttk.Checkbutton(
            btn_frame1, text="包含已解决", variable=self.include_resolved_var
        ).pack(side=tk.LEFT, padx=5)

        btn_frame2 = ttk.Frame(csv_frame)
        btn_frame2.pack(anchor=tk.W, padx=10, pady=5)

        ttk.Button(
            btn_frame2, text="导出订单表", style='Action.TButton',
            command=self._export_csv_orders
        ).pack(side=tk.LEFT, padx=5)

        ttk.Button(
            btn_frame2, text="导出返工表", style='Action.TButton',
            command=self._export_csv_reworks
        ).pack(side=tk.LEFT, padx=5)

        json_frame = ttk.LabelFrame(main_frame, text="JSON审计包")
        json_frame.grid(row=1, column=0, columnspan=2, sticky="nsew", padx=5, pady=5)

        desc = (
            "导出完整的JSON格式数据，包含：\n"
            "• 审计元数据（导出时间、版本等）\n"
            "• 统计摘要（按严重程度、问题类型分类）\n"
            "• 所有订单的完整数据\n\n"
            "适合数据备份、系统集成或审计追溯"
        )
        ttk.Label(json_frame, text=desc, style='Info.TLabel', justify=tk.LEFT).pack(
            anchor=tk.W, padx=10, pady=10
        )

        self.include_full_data_var = tk.BooleanVar(value=True)
        ttk.Checkbutton(
            json_frame, text="包含完整数据（照片、STL、问题详情）", variable=self.include_full_data_var
        ).pack(anchor=tk.W, padx=10, pady=2)

        btn_frame3 = ttk.Frame(json_frame)
        btn_frame3.pack(anchor=tk.W, padx=10, pady=10)

        ttk.Button(
            btn_frame3, text="导出审计包", style='Action.TButton',
            command=self._export_json_audit
        ).pack(side=tk.LEFT, padx=5)

        ttk.Button(
            btn_frame3, text="导出日报", style='Action.TButton',
            command=self._export_json_daily
        ).pack(side=tk.LEFT, padx=5)

        button_frame = ttk.Frame(self)
        button_frame.grid(row=3, column=0, sticky="e", padx=10, pady=10)

        ttk.Button(
            button_frame,
            text="返回工作台",
            style='Action.TButton',
            command=self._back_to_workbench
        ).pack(side=tk.RIGHT, padx=5)

    def _update_stats(self):
        if not self.app.workbench:
            for key in self.stats_labels:
                self.stats_labels[key].config(text="0")
            return

        total = self.app.workbench.item_count
        with_issues = len(self.app.workbench.items_with_issues)
        issues = self.app.workbench.total_issues
        unresolved = self.app.workbench.total_unresolved_issues

        reworks = 0
        for item in self.app.workbench.items.values():
            if item.processing_status:
                reworks += item.processing_status.rework_count

        self.stats_labels["total"].config(text=str(total))
        self.stats_labels["with_issues"].config(text=str(with_issues))
        self.stats_labels["issues"].config(text=str(issues))
        self.stats_labels["unresolved"].config(text=str(unresolved))
        self.stats_labels["reworks"].config(text=str(reworks))

    def _back_to_workbench(self):
        self.app._show_page("workbench")

    def _export_markdown(self):
        if not self.app.workbench or self.app.workbench.item_count == 0:
            messagebox.showwarning("提示", "工作台没有数据")
            return

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        default_name = f"交付单_{timestamp}.md"

        file_path = filedialog.asksaveasfilename(
            title="导出Markdown交付单",
            defaultextension=".md",
            initialfile=default_name,
            filetypes=[("Markdown文件", "*.md"), ("所有文件", "*.*")]
        )

        if not file_path:
            return

        exporter = MarkdownExporter()
        result = exporter.export(
            self.app.workbench,
            Path(file_path),
            include_issues=self.include_issues_var.get(),
            include_photos=self.include_photos_var.get(),
            include_stl=self.include_stl_var.get(),
        )

        if result.success:
            messagebox.showinfo("导出成功", result.message)
        else:
            messagebox.showerror("导出失败", "\n".join(result.errors))

    def _export_csv_issues(self):
        if not self.app.workbench:
            messagebox.showwarning("提示", "工作台没有数据")
            return

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        default_name = f"问题表_{timestamp}.csv"

        file_path = filedialog.asksaveasfilename(
            title="导出问题表",
            defaultextension=".csv",
            initialfile=default_name,
            filetypes=[("CSV文件", "*.csv"), ("所有文件", "*.*")]
        )

        if not file_path:
            return

        exporter = CSVExporter()
        result = exporter.export_issues(
            self.app.workbench,
            Path(file_path),
            include_resolved=self.include_resolved_var.get(),
        )

        if result.success:
            messagebox.showinfo("导出成功", result.message)
        else:
            messagebox.showerror("导出失败", "\n".join(result.errors))

    def _export_csv_orders(self):
        if not self.app.workbench:
            messagebox.showwarning("提示", "工作台没有数据")
            return

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        default_name = f"订单表_{timestamp}.csv"

        file_path = filedialog.asksaveasfilename(
            title="导出订单表",
            defaultextension=".csv",
            initialfile=default_name,
            filetypes=[("CSV文件", "*.csv"), ("所有文件", "*.*")]
        )

        if not file_path:
            return

        exporter = CSVExporter()
        result = exporter.export_orders(self.app.workbench, Path(file_path))

        if result.success:
            messagebox.showinfo("导出成功", result.message)
        else:
            messagebox.showerror("导出失败", "\n".join(result.errors))

    def _export_csv_reworks(self):
        if not self.app.workbench:
            messagebox.showwarning("提示", "工作台没有数据")
            return

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        default_name = f"返工表_{timestamp}.csv"

        file_path = filedialog.asksaveasfilename(
            title="导出返工表",
            defaultextension=".csv",
            initialfile=default_name,
            filetypes=[("CSV文件", "*.csv"), ("所有文件", "*.*")]
        )

        if not file_path:
            return

        exporter = CSVExporter()
        result = exporter.export_rework_summary(self.app.workbench, Path(file_path))

        if result.success:
            messagebox.showinfo("导出成功", result.message)
        else:
            messagebox.showerror("导出失败", "\n".join(result.errors))

    def _export_json_audit(self):
        if not self.app.workbench:
            messagebox.showwarning("提示", "工作台没有数据")
            return

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        default_name = f"审计包_{timestamp}.json"

        file_path = filedialog.asksaveasfilename(
            title="导出审计包",
            defaultextension=".json",
            initialfile=default_name,
            filetypes=[("JSON文件", "*.json"), ("所有文件", "*.*")]
        )

        if not file_path:
            return

        exporter = JSONExporter()
        result = exporter.export_audit_package(
            self.app.workbench,
            Path(file_path),
            include_full_data=self.include_full_data_var.get(),
        )

        if result.success:
            messagebox.showinfo("导出成功", result.message)
        else:
            messagebox.showerror("导出失败", "\n".join(result.errors))

    def _export_json_daily(self):
        if not self.app.workbench:
            messagebox.showwarning("提示", "工作台没有数据")
            return

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        default_name = f"日报_{timestamp}.json"

        file_path = filedialog.asksaveasfilename(
            title="导出日报",
            defaultextension=".json",
            initialfile=default_name,
            filetypes=[("JSON文件", "*.json"), ("所有文件", "*.*")]
        )

        if not file_path:
            return

        exporter = JSONExporter()
        result = exporter.export_daily_report(self.app.workbench, Path(file_path))

        if result.success:
            messagebox.showinfo("导出成功", result.message)
        else:
            messagebox.showerror("导出失败", "\n".join(result.errors))
