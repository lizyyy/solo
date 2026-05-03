#!/usr/bin/env python3
"""
陶瓷窑炉烧成曲线复盘系统 - 主程序入口
使用原生 tkinter/ttk 以确保兼容性
"""

import tkinter as tk
from tkinter import ttk, filedialog, messagebox
import matplotlib
matplotlib.use('TkAgg')
from matplotlib.backends.backend_tkagg import FigureCanvasTkAgg, NavigationToolbar2Tk
from matplotlib.figure import Figure
import matplotlib.dates as mdates
import matplotlib.pyplot as plt
from datetime import datetime, timedelta
from pathlib import Path
from typing import List, Dict, Any, Optional

from modules.data_parser import DataParser, TemperaturePoint, KilnBatch
from modules.rule_engine import RuleEngine, Issue, RiskType
from modules.persistence import StatePersistence
from modules.exporter import Exporter


class KilnReviewApp:
    def __init__(self, root):
        self.root = root
        self.root.title("陶瓷窑炉烧成曲线复盘系统")
        self.root.geometry("1400x900")
        self.root.minsize(1200, 800)
        
        self.data_parser = DataParser()
        self.rule_engine = None
        self.persistence = StatePersistence()
        self.exporter = None
        
        self.current_batch_id = None
        self.selected_issue_id = None
        self.issue_markers = []
        
        self._setup_styles()
        self._create_menu()
        self._create_main_layout()
        
        self._status_var.set("就绪 - 请导入数据文件开始分析")

    def _setup_styles(self):
        style = ttk.Style()
        style.configure("Treeview", rowheight=28)
        style.configure("TLabelframe", padding=5)
        style.configure("Status.TLabel", foreground="gray", font=("Arial", 10))
        style.theme_use('clam')

    def _create_menu(self):
        menubar = tk.Menu(self.root)
        self.root.config(menu=menubar)
        
        file_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="文件", menu=file_menu)
        file_menu.add_command(label="导入批次数据 (CSV)", command=self._import_batches)
        file_menu.add_command(label="导入温度日志 (JSONL)", command=self._import_temp_log)
        file_menu.add_command(label="导入配方规则 (YAML)", command=self._import_recipes)
        file_menu.add_command(label="导入操作员记录 (CSV)", command=self._import_notes)
        file_menu.add_separator()
        file_menu.add_command(label="导入Sample数据", command=self._load_sample_data)
        file_menu.add_separator()
        file_menu.add_command(label="导出问题列表 (CSV)", command=self._export_issues_csv)
        file_menu.add_command(label="导出复查报告 (MD)", command=self._export_review_md)
        file_menu.add_separator()
        file_menu.add_command(label="清除所有状态", command=self._clear_state)
        file_menu.add_separator()
        file_menu.add_command(label="退出", command=self.root.quit)
        
        analysis_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="分析", menu=analysis_menu)
        analysis_menu.add_command(label="重新分析所有批次", command=self._reanalyze_all)
        analysis_menu.add_command(label="分析当前批次", command=self._reanalyze_current)
        
        help_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="帮助", menu=help_menu)
        help_menu.add_command(label="使用说明", command=self._show_help)
        help_menu.add_command(label="关于", command=self._show_about)

    def _create_main_layout(self):
        main_paned = ttk.PanedWindow(self.root, orient=tk.HORIZONTAL)
        main_paned.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)
        
        left_frame = ttk.Frame(main_paned, width=350)
        main_paned.add(left_frame, weight=0)
        
        right_frame = ttk.Frame(main_paned)
        main_paned.add(right_frame, weight=1)
        
        self._create_left_panel(left_frame)
        self._create_right_panel(right_frame)
        
        status_frame = ttk.Frame(self.root)
        status_frame.pack(fill=tk.X, padx=5, pady=(0, 5))
        self._status_var = tk.StringVar()
        status_label = ttk.Label(status_frame, textvariable=self._status_var, style="Status.TLabel")
        status_label.pack(side=tk.LEFT)

    def _create_left_panel(self, parent):
        notebook = ttk.Notebook(parent)
        notebook.pack(fill=tk.BOTH, expand=True)
        
        batch_frame = ttk.Frame(notebook, padding=5)
        notebook.add(batch_frame, text="批次列表")
        self._create_batch_panel(batch_frame)
        
        issue_frame = ttk.Frame(notebook, padding=5)
        notebook.add(issue_frame, text="问题列表")
        self._create_issue_panel(issue_frame)
        
        detail_frame = ttk.Frame(notebook, padding=5)
        notebook.add(detail_frame, text="问题详情")
        self._create_detail_panel(detail_frame)

    def _create_batch_panel(self, parent):
        filter_frame = ttk.LabelFrame(parent, text="筛选条件", padding=5)
        filter_frame.pack(fill=tk.X, pady=5)
        
        ttk.Label(filter_frame, text="窑炉:").grid(row=0, column=0, sticky=tk.W, padx=2)
        self._kiln_var = tk.StringVar()
        self._kiln_combo = ttk.Combobox(filter_frame, textvariable=self._kiln_var, width=12)
        self._kiln_combo.grid(row=0, column=1, sticky=tk.W, padx=2)
        self._kiln_combo.bind("<<ComboboxSelected>>", self._on_kiln_selected)
        
        ttk.Button(filter_frame, text="全部", command=self._show_all_batches).grid(row=0, column=2, padx=2)
        ttk.Button(filter_frame, text="有问题", command=self._show_problem_batches).grid(row=0, column=3, padx=2)
        
        tree_frame = ttk.LabelFrame(parent, text="批次", padding=5)
        tree_frame.pack(fill=tk.BOTH, expand=True, pady=5)
        
        columns = ("batch_id", "kiln_id", "status", "issues")
        self._batch_tree = ttk.Treeview(tree_frame, columns=columns, show="headings", height=10)
        self._batch_tree.heading("batch_id", text="批次ID")
        self._batch_tree.heading("kiln_id", text="窑炉")
        self._batch_tree.heading("status", text="状态")
        self._batch_tree.heading("issues", text="问题数")
        self._batch_tree.column("batch_id", width=100)
        self._batch_tree.column("kiln_id", width=60)
        self._batch_tree.column("status", width=60)
        self._batch_tree.column("issues", width=60)
        
        scrollbar_y = ttk.Scrollbar(tree_frame, orient=tk.VERTICAL, command=self._batch_tree.yview)
        scrollbar_x = ttk.Scrollbar(tree_frame, orient=tk.HORIZONTAL, command=self._batch_tree.xview)
        self._batch_tree.configure(yscrollcommand=scrollbar_y.set, xscrollcommand=scrollbar_x.set)
        
        self._batch_tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scrollbar_y.pack(side=tk.RIGHT, fill=tk.Y)
        
        self._batch_tree.bind("<<TreeviewSelect>>", self._on_batch_selected)

    def _create_issue_panel(self, parent):
        tree_frame = ttk.LabelFrame(parent, text="检测到的问题", padding=5)
        tree_frame.pack(fill=tk.BOTH, expand=True)
        
        columns = ("issue_id", "type", "severity", "time", "status")
        self._issue_tree = ttk.Treeview(tree_frame, columns=columns, show="headings", height=12)
        self._issue_tree.heading("issue_id", text="问题ID")
        self._issue_tree.heading("type", text="类型")
        self._issue_tree.heading("severity", text="严重程度")
        self._issue_tree.heading("time", text="发生时间")
        self._issue_tree.heading("status", text="状态")
        self._issue_tree.column("issue_id", width=80)
        self._issue_tree.column("type", width=90)
        self._issue_tree.column("severity", width=70)
        self._issue_tree.column("time", width=120)
        self._issue_tree.column("status", width=70)
        
        scrollbar = ttk.Scrollbar(tree_frame, orient=tk.VERTICAL, command=self._issue_tree.yview)
        self._issue_tree.configure(yscrollcommand=scrollbar.set)
        
        self._issue_tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
        
        self._issue_tree.bind("<<TreeviewSelect>>", self._on_issue_selected)
        self._issue_tree.bind("<Double-1>", self._on_issue_double_click)
        
        btn_frame = ttk.Frame(parent)
        btn_frame.pack(fill=tk.X, pady=5)
        ttk.Button(btn_frame, text="定位到曲线", command=self._locate_issue_on_chart).pack(side=tk.LEFT, padx=2)
        ttk.Button(btn_frame, text="确认问题", command=self._confirm_issue_dialog).pack(side=tk.LEFT, padx=2)
        ttk.Button(btn_frame, text="标记误报", command=self._mark_false_positive).pack(side=tk.LEFT, padx=2)

    def _create_detail_panel(self, parent):
        info_frame = ttk.LabelFrame(parent, text="问题详情", padding=5)
        info_frame.pack(fill=tk.X, pady=5)
        
        self._detail_text = tk.Text(info_frame, wrap=tk.WORD, height=15, font=("Arial", 10))
        scrollbar = ttk.Scrollbar(info_frame, orient=tk.VERTICAL, command=self._detail_text.yview)
        self._detail_text.configure(yscrollcommand=scrollbar.set)
        
        self._detail_text.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
        
        confirm_frame = ttk.LabelFrame(parent, text="人工确认", padding=5)
        confirm_frame.pack(fill=tk.X, pady=5)
        
        ttk.Label(confirm_frame, text="确认人:").grid(row=0, column=0, sticky=tk.W, padx=2)
        self._confirmer_var = tk.StringVar()
        ttk.Entry(confirm_frame, textvariable=self._confirmer_var, width=15).grid(row=0, column=1, sticky=tk.W, padx=2)
        
        ttk.Label(confirm_frame, text="备注:").grid(row=1, column=0, sticky=tk.NW, padx=2)
        self._confirm_notes = tk.Text(confirm_frame, height=3, width=30, font=("Arial", 9))
        self._confirm_notes.grid(row=1, column=1, sticky=tk.W, padx=2, pady=2)
        
        btn_frame2 = ttk.Frame(confirm_frame)
        btn_frame2.grid(row=2, column=0, columnspan=2, pady=5)
        ttk.Button(btn_frame2, text="确认问题", command=self._do_confirm_issue).pack(side=tk.LEFT, padx=2)
        ttk.Button(btn_frame2, text="标记误报", command=self._do_mark_false_positive).pack(side=tk.LEFT, padx=2)
        ttk.Button(btn_frame2, text="清除确认", command=self._clear_confirmation).pack(side=tk.LEFT, padx=2)

    def _create_right_panel(self, parent):
        chart_frame = ttk.LabelFrame(parent, text="烧成曲线", padding=5)
        chart_frame.pack(fill=tk.BOTH, expand=True)
        
        self._fig = Figure(figsize=(10, 6), dpi=100)
        self._ax = self._fig.add_subplot(111)
        self._canvas = FigureCanvasTkAgg(self._fig, master=chart_frame)
        self._canvas.draw()
        self._canvas.get_tk_widget().pack(fill=tk.BOTH, expand=True)
        
        toolbar = NavigationToolbar2Tk(self._canvas, chart_frame)
        toolbar.update()
        
        info_frame = ttk.LabelFrame(parent, text="批次信息", padding=5)
        info_frame.pack(fill=tk.X, pady=5)
        
        self._batch_info_text = tk.Text(info_frame, wrap=tk.WORD, height=4, font=("Arial", 9))
        self._batch_info_text.pack(fill=tk.X)
        self._batch_info_text.insert(tk.END, "请选择一个批次查看详情")
        self._batch_info_text.config(state=tk.DISABLED)

    def _update_status(self, message):
        self._status_var.set(message)
        self.root.update_idletasks()

    def _import_batches(self):
        filepath = filedialog.askopenfilename(
            title="选择批次数据文件",
            filetypes=[("CSV文件", "*.csv"), ("所有文件", "*.*")]
        )
        if filepath:
            self.data_parser.parse_kiln_batches(filepath)
            self._update_status(f"已导入批次数据: {len(self.data_parser.batches)} 个批次")
            self._refresh_batch_list()

    def _import_temp_log(self):
        filepath = filedialog.askopenfilename(
            title="选择温度日志文件",
            filetypes=[("JSONL文件", "*.jsonl"), ("所有文件", "*.*")]
        )
        if filepath:
            self.data_parser.parse_temperature_log(filepath)
            count = sum(len(v) for v in self.data_parser.temperature_data.values())
            self._update_status(f"已导入温度数据: {count} 个数据点")

    def _import_recipes(self):
        filepath = filedialog.askopenfilename(
            title="选择配方规则文件",
            filetypes=[("YAML文件", "*.yaml"), ("YAML文件", "*.yml"), ("所有文件", "*.*")]
        )
        if filepath:
            self.data_parser.parse_recipe_rules(filepath)
            self._update_status(f"已导入配方: {len(self.data_parser.recipes)} 个")

    def _import_notes(self):
        filepath = filedialog.askopenfilename(
            title="选择操作员记录文件",
            filetypes=[("CSV文件", "*.csv"), ("所有文件", "*.*")]
        )
        if filepath:
            self.data_parser.parse_operator_notes(filepath)
            count = sum(len(v) for v in self.data_parser.operator_notes.values())
            self._update_status(f"已导入操作员记录: {count} 条")

    def _load_sample_data(self):
        sample_dir = Path(__file__).parent / "sample_data"
        if not sample_dir.exists():
            messagebox.showerror("错误", "Sample数据目录不存在")
            return
        
        self._update_status("正在加载Sample数据...")
        self.root.update()
        
        batches_path = sample_dir / "kiln_batches.csv"
        temp_path = sample_dir / "temperature_log.jsonl"
        recipes_path = sample_dir / "recipe_rules.yaml"
        notes_path = sample_dir / "operator_notes.csv"
        
        try:
            if batches_path.exists():
                self.data_parser.parse_kiln_batches(str(batches_path))
            if temp_path.exists():
                self.data_parser.parse_temperature_log(str(temp_path))
            if recipes_path.exists():
                self.data_parser.parse_recipe_rules(str(recipes_path))
            if notes_path.exists():
                self.data_parser.parse_operator_notes(str(notes_path))
            
            self._reanalyze_all()
            self._update_status(f"Sample数据加载完成 - {len(self.data_parser.batches)} 个批次")
        except Exception as e:
            messagebox.showerror("加载失败", str(e))

    def _reanalyze_all(self):
        if not self.data_parser.batches:
            messagebox.showwarning("警告", "没有可分析的批次数据")
            return
        
        self._update_status("正在分析所有批次...")
        self.root.update()
        
        self.rule_engine = RuleEngine(self.data_parser)
        self.rule_engine.analyze_all_batches()
        
        if self.persistence:
            all_issues = self.rule_engine.get_all_issues()
            self.persistence.apply_saved_confirmations(all_issues)
        
        self._refresh_batch_list()
        self._update_status(f"分析完成 - 检测到 {len(self.rule_engine.get_all_issues())} 个问题")

    def _reanalyze_current(self):
        if not self.current_batch_id:
            messagebox.showwarning("警告", "请先选择一个批次")
            return
        
        if self.rule_engine:
            self.rule_engine.analyze_batch(self.current_batch_id)
            self._refresh_issue_list()
            self._update_status(f"已重新分析批次 {self.current_batch_id}")

    def _refresh_batch_list(self):
        for item in self._batch_tree.get_children():
            self._batch_tree.delete(item)
        
        kilns = self.data_parser.get_unique_kilns()
        self._kiln_combo['values'] = kilns
        if kilns and not self._kiln_var.get():
            self._kiln_var.set(kilns[0])
        
        all_batches = list(self.data_parser.batches.values())
        for batch in all_batches:
            issues = []
            if self.rule_engine:
                issues = self.rule_engine.get_batch_issues(batch.batch_id)
            
            issue_count = len(issues)
            status = batch.status
            
            tag = "normal"
            if any(i.severity == "high" for i in issues):
                tag = "high_risk"
            elif any(i.severity == "medium" for i in issues):
                tag = "medium_risk"
            
            self._batch_tree.insert("", tk.END, values=(
                batch.batch_id,
                batch.kiln_id,
                status,
                issue_count if issue_count > 0 else ""
            ), tags=(tag,), iid=batch.batch_id)
        
        self._batch_tree.tag_configure("high_risk", background="#ffcccc")
        self._batch_tree.tag_configure("medium_risk", background="#fff0cc")

    def _show_all_batches(self):
        self._refresh_batch_list()

    def _show_problem_batches(self):
        for item in self._batch_tree.get_children():
            self._batch_tree.delete(item)
        
        if not self.rule_engine:
            return
        
        for batch_id, issues in self.rule_engine.issues.items():
            if issues:
                batch = self.data_parser.batches.get(batch_id)
                if batch:
                    high_count = sum(1 for i in issues if i.severity == "high")
                    tag = "normal"
                    if high_count > 0:
                        tag = "high_risk"
                    elif any(i.severity == "medium" for i in issues):
                        tag = "medium_risk"
                    
                    self._batch_tree.insert("", tk.END, values=(
                        batch.batch_id,
                        batch.kiln_id,
                        batch.status,
                        len(issues)
                    ), tags=(tag,), iid=batch.batch_id)
        
        self._batch_tree.tag_configure("high_risk", background="#ffcccc")
        self._batch_tree.tag_configure("medium_risk", background="#fff0cc")

    def _on_kiln_selected(self, event=None):
        selected_kiln = self._kiln_var.get()
        if not selected_kiln:
            self._refresh_batch_list()
            return
        
        for item in self._batch_tree.get_children():
            self._batch_tree.delete(item)
        
        batches = self.data_parser.get_batches_by_kiln(selected_kiln)
        for batch in batches:
            issues = []
            if self.rule_engine:
                issues = self.rule_engine.get_batch_issues(batch.batch_id)
            
            issue_count = len(issues)
            tag = "normal"
            if any(i.severity == "high" for i in issues):
                tag = "high_risk"
            elif any(i.severity == "medium" for i in issues):
                tag = "medium_risk"
            
            self._batch_tree.insert("", tk.END, values=(
                batch.batch_id,
                batch.kiln_id,
                batch.status,
                issue_count if issue_count > 0 else ""
            ), tags=(tag,), iid=batch.batch_id)
        
        self._batch_tree.tag_configure("high_risk", background="#ffcccc")
        self._batch_tree.tag_configure("medium_risk", background="#fff0cc")

    def _on_batch_selected(self, event=None):
        selection = self._batch_tree.selection()
        if not selection:
            return
        
        batch_id = selection[0]
        self.current_batch_id = batch_id
        
        self._update_batch_info(batch_id)
        self._plot_curve(batch_id)
        self._refresh_issue_list()

    def _update_batch_info(self, batch_id):
        if batch_id not in self.data_parser.batches:
            return
        
        batch = self.data_parser.batches[batch_id]
        
        self._batch_info_text.config(state=tk.NORMAL)
        self._batch_info_text.delete(1.0, tk.END)
        
        info = f"批次: {batch.batch_id} | 窑炉: {batch.kiln_id} | 配方: {batch.recipe_name}\n"
        info += f"开始: {batch.start_time.strftime('%Y-%m-%d %H:%M')} | "
        if batch.end_time:
            info += f"结束: {batch.end_time.strftime('%Y-%m-%d %H:%M')}\n"
        info += f"目标温度: {batch.target_temp}°C | 操作员: {batch.operator or '未知'}"
        
        self._batch_info_text.insert(tk.END, info)
        self._batch_info_text.config(state=tk.DISABLED)

    def _plot_curve(self, batch_id):
        self._ax.clear()
        self.issue_markers = []
        
        if batch_id not in self.data_parser.batches:
            self._ax.text(0.5, 0.5, "无数据", ha='center', va='center', transform=self._ax.transAxes)
            self._canvas.draw()
            return
        
        batch = self.data_parser.batches[batch_id]
        temp_points = self.data_parser.get_batch_temperature_data(batch_id)
        
        if not temp_points:
            self._ax.text(0.5, 0.5, "无温度数据", ha='center', va='center', transform=self._ax.transAxes)
            self._canvas.draw()
            return
        
        valid_points = [p for p in temp_points if p.is_valid]
        invalid_points = [p for p in temp_points if not p.is_valid]
        
        if valid_points:
            times = [p.timestamp for p in valid_points]
            temps = [p.temperature for p in valid_points]
            self._ax.plot(times, temps, 'b-', label='温度曲线', linewidth=1.5)
            self._ax.scatter(times, temps, c='blue', s=8, zorder=5)
        
        if invalid_points:
            inv_times = [p.timestamp for p in invalid_points]
            inv_temps = [p.temperature for p in invalid_points]
            self._ax.scatter(inv_times, inv_temps, c='gray', s=15, marker='x', label='无效数据')
        
        if batch.target_temp:
            self._ax.axhline(y=batch.target_temp, color='green', linestyle='--', 
                             alpha=0.7, label=f'目标温度 ({batch.target_temp}°C)')
        
        if self.rule_engine:
            issues = self.rule_engine.get_batch_issues(batch_id)
            for i, issue in enumerate(issues):
                color = 'red' if issue.severity == "high" else 'orange'
                marker = self._ax.axvline(x=issue.timestamp, color=color, linestyle=':', 
                                          alpha=0.6, linewidth=2)
                
                if valid_points:
                    closest_temp = min(valid_points, key=lambda p: abs(p.timestamp - issue.timestamp))
                    y_pos = closest_temp.temperature
                else:
                    y_pos = batch.target_temp if batch.target_temp else 1000
                
                y_offset = (i % 3) * 30
                text = self._ax.annotate(
                    issue.issue_id,
                    xy=(issue.timestamp, y_pos),
                    xytext=(10, 10 + y_offset),
                    textcoords='offset points',
                    bbox=dict(boxstyle='round,pad=0.3', fc='yellow', alpha=0.7),
                    arrowprops=dict(arrowstyle='->', connectionstyle='arc3,rad=0')
                )
                self.issue_markers.append((marker, text, issue.issue_id))
        
        self._ax.set_xlabel('时间')
        self._ax.set_ylabel('温度 (°C)')
        self._ax.set_title(f'烧成曲线 - 批次 {batch_id}')
        self._ax.legend(loc='upper left')
        self._ax.grid(True, alpha=0.3)
        
        self._ax.xaxis.set_major_formatter(mdates.DateFormatter('%m-%d %H:%M'))
        self._fig.autofmt_xdate()
        
        self._canvas.draw()

    def _refresh_issue_list(self):
        for item in self._issue_tree.get_children():
            self._issue_tree.delete(item)
        
        if not self.current_batch_id or not self.rule_engine:
            return
        
        issues = self.rule_engine.get_batch_issues(self.current_batch_id)
        
        risk_type_names = {
            RiskType.HEATING_RATE_EXCEED: "升温超限",
            RiskType.INSUFFICIENT_HOLDING: "保温不足",
            RiskType.PROBE_DISCONNECTION: "探头断采",
            RiskType.MIDNIGHT_ALIGNMENT_ERROR: "批次错位"
        }
        
        severity_names = {"high": "高", "medium": "中", "low": "低"}
        
        for issue in sorted(issues, key=lambda x: {"high": 0, "medium": 1, "low": 2}.get(x.severity, 3)):
            status = "待确认"
            if issue.confirmed_at:
                status = "误报" if issue.is_false_positive else "已确认"
            
            tag = "normal"
            if issue.severity == "high":
                tag = "high_risk"
            elif issue.severity == "medium":
                tag = "medium_risk"
            
            if issue.confirmed_at:
                tag = "confirmed"
            
            self._issue_tree.insert("", tk.END, values=(
                issue.issue_id,
                risk_type_names.get(issue.risk_type, issue.risk_type.value),
                severity_names.get(issue.severity, issue.severity),
                issue.timestamp.strftime('%m-%d %H:%M'),
                status
            ), tags=(tag,), iid=issue.issue_id)
        
        self._issue_tree.tag_configure("high_risk", background="#ffcccc")
        self._issue_tree.tag_configure("medium_risk", background="#fff0cc")
        self._issue_tree.tag_configure("confirmed", background="#ccffcc")

    def _on_issue_selected(self, event=None):
        selection = self._issue_tree.selection()
        if not selection:
            return
        
        issue_id = selection[0]
        self.selected_issue_id = issue_id
        self._show_issue_detail(issue_id)

    def _on_issue_double_click(self, event=None):
        self._locate_issue_on_chart()

    def _show_issue_detail(self, issue_id):
        if not self.rule_engine:
            return
        
        all_issues = self.rule_engine.get_all_issues()
        issue = next((i for i in all_issues if i.issue_id == issue_id), None)
        
        if not issue:
            return
        
        self._detail_text.delete(1.0, tk.END)
        
        risk_type_names = {
            RiskType.HEATING_RATE_EXCEED: "升温速率超限",
            RiskType.INSUFFICIENT_HOLDING: "保温不足",
            RiskType.PROBE_DISCONNECTION: "探头断采",
            RiskType.MIDNIGHT_ALIGNMENT_ERROR: "跨午夜批次归属错位"
        }
        
        text = f"问题ID: {issue.issue_id}\n"
        text += f"风险类型: {risk_type_names.get(issue.risk_type, issue.risk_type.value)}\n"
        text += f"严重程度: {'高' if issue.severity == 'high' else '中'}\n"
        text += f"发生时间: {issue.timestamp.strftime('%Y-%m-%d %H:%M:%S')}\n"
        text += f"描述: {issue.description}\n\n"
        
        if issue.details:
            text += "详细信息:\n"
            for key, value in issue.details.items():
                if isinstance(value, float):
                    text += f"  {key}: {value:.2f}\n"
                else:
                    text += f"  {key}: {value}\n"
            text += "\n"
        
        if issue.confirmed_at:
            text += "确认信息:\n"
            text += f"  确认人: {issue.confirmed_by or '未知'}\n"
            text += f"  确认时间: {issue.confirmed_at.strftime('%Y-%m-%d %H:%M:%S')}\n"
            text += f"  是否误报: {'是' if issue.is_false_positive else '否'}\n"
            if issue.notes:
                text += f"  备注: {issue.notes}\n"
        
        self._detail_text.insert(tk.END, text)

    def _locate_issue_on_chart(self):
        if not self.selected_issue_id or not self.issue_markers:
            return
        
        for marker, text, issue_id in self.issue_markers:
            if issue_id == self.selected_issue_id:
                if hasattr(marker, 'get_xdata'):
                    x_pos = marker.get_xdata()[0]
                    ylim = self._ax.get_ylim()
                    self._ax.set_xlim(left=x_pos - timedelta(minutes=30), right=x_pos + timedelta(minutes=30))
                    self._canvas.draw()
                break

    def _confirm_issue_dialog(self):
        if not self.selected_issue_id:
            messagebox.showwarning("警告", "请先选择一个问题")
            return
        self._do_confirm_issue()

    def _mark_false_positive(self):
        if not self.selected_issue_id:
            messagebox.showwarning("警告", "请先选择一个问题")
            return
        self._do_mark_false_positive()

    def _do_confirm_issue(self):
        if not self.selected_issue_id or not self.rule_engine:
            return
        
        confirmer = self._confirmer_var.get() or "操作员"
        notes = self._confirm_notes.get(1.0, tk.END).strip()
        
        if self.rule_engine.confirm_issue(
            self.selected_issue_id,
            confirmed_by=confirmer,
            is_false_positive=False,
            notes=notes
        ):
            if self.persistence:
                all_issues = self.rule_engine.get_all_issues()
                self.persistence.save_confirmations(all_issues)
                self.persistence.log_review_action(
                    "confirm", self.selected_issue_id, 
                    self.current_batch_id or "", confirmer, notes
                )
            
            self._refresh_issue_list()
            self._show_issue_detail(self.selected_issue_id)
            self._update_status(f"已确认问题: {self.selected_issue_id}")
            messagebox.showinfo("成功", "问题已确认")

    def _do_mark_false_positive(self):
        if not self.selected_issue_id or not self.rule_engine:
            return
        
        confirmer = self._confirmer_var.get() or "操作员"
        notes = self._confirm_notes.get(1.0, tk.END).strip()
        
        if self.rule_engine.confirm_issue(
            self.selected_issue_id,
            confirmed_by=confirmer,
            is_false_positive=True,
            notes=notes
        ):
            if self.persistence:
                all_issues = self.rule_engine.get_all_issues()
                self.persistence.save_confirmations(all_issues)
                self.persistence.log_review_action(
                    "false_positive", self.selected_issue_id,
                    self.current_batch_id or "", confirmer, notes
                )
            
            self._refresh_issue_list()
            self._show_issue_detail(self.selected_issue_id)
            self._update_status(f"已标记为误报: {self.selected_issue_id}")
            messagebox.showinfo("成功", "已标记为误报")

    def _clear_confirmation(self):
        if not self.selected_issue_id or not self.rule_engine:
            return
        
        all_issues = self.rule_engine.get_all_issues()
        for issue in all_issues:
            if issue.issue_id == self.selected_issue_id:
                issue.confirmed_by = None
                issue.confirmed_at = None
                issue.is_false_positive = False
                issue.notes = ""
                
                if self.persistence:
                    self.persistence.save_confirmations([i for i in all_issues if i.confirmed_at])
                
                self._refresh_issue_list()
                self._show_issue_detail(self.selected_issue_id)
                self._update_status(f"已清除确认: {self.selected_issue_id}")
                break

    def _export_issues_csv(self):
        if not self.rule_engine:
            messagebox.showwarning("警告", "没有可导出的问题数据")
            return
        
        filepath = filedialog.asksaveasfilename(
            title="保存问题列表",
            defaultextension=".csv",
            filetypes=[("CSV文件", "*.csv"), ("所有文件", "*.*")],
            initialfile="issues.csv"
        )
        
        if filepath:
            all_issues = self.rule_engine.get_all_issues()
            exporter = Exporter(self.data_parser, all_issues)
            if exporter.export_issues_csv(filepath):
                self._update_status(f"已导出到: {filepath}")
                messagebox.showinfo("成功", f"问题列表已导出到:\n{filepath}")
            else:
                messagebox.showerror("错误", "导出失败")

    def _export_review_md(self):
        if not self.rule_engine:
            messagebox.showwarning("警告", "没有可导出的报告数据")
            return
        
        filepath = filedialog.asksaveasfilename(
            title="保存复查报告",
            defaultextension=".md",
            filetypes=[("Markdown文件", "*.md"), ("所有文件", "*.*")],
            initialfile="firing_review.md"
        )
        
        if filepath:
            all_issues = self.rule_engine.get_all_issues()
            exporter = Exporter(self.data_parser, all_issues)
            if exporter.export_firing_review_md(filepath):
                self._update_status(f"已导出到: {filepath}")
                messagebox.showinfo("成功", f"复查报告已导出到:\n{filepath}")
            else:
                messagebox.showerror("错误", "导出失败")

    def _clear_state(self):
        if messagebox.askyesno("确认", "确定要清除所有确认状态和历史记录吗？"):
            if self.persistence:
                self.persistence.clear_all_state()
            self._update_status("已清除所有状态")

    def _show_help(self):
        help_text = """陶瓷窑炉烧成曲线复盘系统 - 使用说明

1. 导入数据:
   - 文件菜单 -> 导入对应的4类数据文件
   - 或直接点击 "导入Sample数据" 测试

2. 查看批次:
   - 左侧 "批次列表" 选择窑炉筛选
   - 点击 "有问题" 只显示有风险的批次
   - 红底色表示高风险，黄底色表示中风险

3. 分析问题:
   - 选择批次后自动绘制温度曲线
   - "问题列表" 显示检测到的风险
   - 双击问题可在曲线上定位

4. 人工确认:
   - 填写确认人和备注
   - 点击 "确认问题" 或 "标记误报"

5. 导出报告:
   - 文件菜单 -> 导出问题列表或复查报告

风险类型说明:
- 升温速率超限: 升温过快可能导致坯体开裂
- 保温不足: 保温时间不够可能导致烧结不完全
- 探头断采: 温度数据缺失可能影响控制
- 跨午夜批次归属错位: 批次可能归属错误日期
"""
        messagebox.showinfo("使用说明", help_text)

    def _show_about(self):
        about_text = """陶瓷窑炉烧成曲线复盘系统
版本 1.0

用于复盘陶瓷窑炉烧成曲线，检测潜在风险，
记录人工确认，导出复查报告。

支持导入:
- kiln_batches.csv - 批次数据
- temperature_log.jsonl - 温度日志
- recipe_rules.yaml - 配方规则
- operator_notes.csv - 操作员记录
"""
        messagebox.showinfo("关于", about_text)


def main():
    root = tk.Tk()
    app = KilnReviewApp(root)
    root.mainloop()


if __name__ == "__main__":
    main()
