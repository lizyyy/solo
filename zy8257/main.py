import tkinter as tk
from tkinter import ttk, filedialog, messagebox, simpledialog
from datetime import datetime, date
from typing import Optional, List, Dict, Any
import os
import sys

from models import Issue, IssueType, Severity
from data_loader import DataLoader
from timeline_builder import TimelineBuilder
from anomaly_detector import AnomalyDetector
from exporter import Exporter
from state_manager import StateManager


class ColdChamberManagerApp:
    def __init__(self, root: tk.Tk):
        self.root = root
        self.root.title("殡仪馆冷藏柜流转管理系统")
        self.root.geometry("1400x900")
        self.root.minsize(1200, 700)
        
        self.data_loader: Optional[DataLoader] = None
        self.timeline_builder: Optional[TimelineBuilder] = None
        self.anomaly_detector: Optional[AnomalyDetector] = None
        self.exporter: Optional[Exporter] = None
        self.state_manager = StateManager()
        
        self.current_issues: List[Issue] = []
        self.selected_issue: Optional[Issue] = None
        
        self._setup_styles()
        self._create_menu()
        self._create_main_layout()
        
        self.data_directory = os.path.join(os.path.dirname(os.path.abspath(__file__)), "sample_data")
        if os.path.exists(self.data_directory):
            self._load_default_data()

    def _setup_styles(self):
        style = ttk.Style()
        style.configure('Title.TLabel', font=('Microsoft YaHei', 14, 'bold'))
        style.configure('Header.TLabel', font=('Microsoft YaHei', 11, 'bold'))
        style.configure('Info.TLabel', font=('Microsoft YaHei', 10))
        style.configure('Critical.TLabel', foreground='red', font=('Microsoft YaHei', 10, 'bold'))
        style.configure('High.TLabel', foreground='orange', font=('Microsoft YaHei', 10))
        style.configure('Medium.TLabel', foreground='gold', font=('Microsoft YaHei', 10))
        style.configure('Resolved.TLabel', foreground='green', font=('Microsoft YaHei', 10))

    def _create_menu(self):
        menubar = tk.Menu(self.root)
        self.root.config(menu=menubar)
        
        file_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="文件", menu=file_menu)
        file_menu.add_command(label="导入数据文件...", command=self._import_all_data)
        file_menu.add_separator()
        file_menu.add_command(label="导出问题列表 (CSV)", command=self._export_issues_csv)
        file_menu.add_command(label="导出审核报告 (MD)", command=self._export_chamber_review)
        file_menu.add_separator()
        file_menu.add_command(label="导出状态备份", command=self._export_state)
        file_menu.add_command(label="导入状态备份", command=self._import_state)
        file_menu.add_separator()
        file_menu.add_command(label="退出", command=self.root.quit)
        
        view_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="查看", menu=view_menu)
        view_menu.add_command(label="查看所有冷藏柜状态", command=self._show_all_chambers)
        view_menu.add_command(label="查看逝者时间线", command=self._show_deceased_selector)
        
        help_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="帮助", menu=help_menu)
        help_menu.add_command(label="关于", command=self._show_about)

    def _create_main_layout(self):
        main_frame = ttk.Frame(self.root, padding="10")
        main_frame.grid(row=0, column=0, sticky=(tk.W, tk.E, tk.N, tk.S))
        
        self.root.columnconfigure(0, weight=1)
        self.root.rowconfigure(0, weight=1)
        main_frame.columnconfigure(1, weight=1)
        main_frame.rowconfigure(1, weight=1)
        
        filter_frame = ttk.LabelFrame(main_frame, text="筛选条件", padding="10")
        filter_frame.grid(row=0, column=0, columnspan=2, sticky=(tk.W, tk.E), pady=(0, 10))
        
        ttk.Label(filter_frame, text="开始日期:").grid(row=0, column=0, padx=(0, 5), pady=5)
        self.start_date_var = tk.StringVar(value="")
        self.start_date_entry = ttk.Entry(filter_frame, textvariable=self.start_date_var, width=15)
        self.start_date_entry.grid(row=0, column=1, padx=(0, 20), pady=5)
        
        ttk.Label(filter_frame, text="结束日期:").grid(row=0, column=2, padx=(0, 5), pady=5)
        self.end_date_var = tk.StringVar(value="")
        self.end_date_entry = ttk.Entry(filter_frame, textvariable=self.end_date_var, width=15)
        self.end_date_entry.grid(row=0, column=3, padx=(0, 20), pady=5)
        
        ttk.Label(filter_frame, text="柜号:").grid(row=0, column=4, padx=(0, 5), pady=5)
        self.chamber_var = tk.StringVar(value="全部")
        self.chamber_combo = ttk.Combobox(filter_frame, textvariable=self.chamber_var, width=15, state='readonly')
        self.chamber_combo['values'] = ['全部']
        self.chamber_combo.grid(row=0, column=5, padx=(0, 20), pady=5)
        
        ttk.Label(filter_frame, text="问题类型:").grid(row=0, column=6, padx=(0, 5), pady=5)
        self.issue_type_var = tk.StringVar(value="全部")
        self.issue_type_combo = ttk.Combobox(filter_frame, textvariable=self.issue_type_var, width=15, state='readonly')
        self.issue_type_combo['values'] = ['全部', IssueType.TEMPERATURE_OUT_OF_RANGE, IssueType.CHAMBER_OVERLAP, 
                                            IssueType.MISSING_SIGNATURE, IssueType.MIDNIGHT_MISALIGNMENT,
                                            IssueType.MISSING_FIELD, IssueType.DUPLICATE_HANDOVER]
        self.issue_type_combo.grid(row=0, column=7, padx=(0, 20), pady=5)
        
        ttk.Label(filter_frame, text="状态:").grid(row=0, column=8, padx=(0, 5), pady=5)
        self.status_var = tk.StringVar(value="全部")
        self.status_combo = ttk.Combobox(filter_frame, textvariable=self.status_var, width=10, state='readonly')
        self.status_combo['values'] = ['全部', '未处理', '已处理']
        self.status_combo.grid(row=0, column=9, padx=(0, 20), pady=5)
        
        ttk.Button(filter_frame, text="应用筛选", command=self._apply_filters).grid(row=0, column=10, padx=(0, 10), pady=5)
        ttk.Button(filter_frame, text="重置筛选", command=self._reset_filters).grid(row=0, column=11, pady=5)
        
        left_frame = ttk.Frame(main_frame)
        left_frame.grid(row=1, column=0, sticky=(tk.W, tk.E, tk.N, tk.S), padx=(0, 10))
        left_frame.rowconfigure(0, weight=1)
        left_frame.columnconfigure(0, weight=1)
        
        issues_frame = ttk.LabelFrame(left_frame, text="问题列表", padding="5")
        issues_frame.grid(row=0, column=0, sticky=(tk.W, tk.E, tk.N, tk.S))
        issues_frame.rowconfigure(0, weight=1)
        issues_frame.columnconfigure(0, weight=1)
        
        columns = ('issue_id', 'issue_type', 'severity', 'deceased_id', 'chamber_id', 
                   'start_time', 'status', 'description')
        self.issues_tree = ttk.Treeview(issues_frame, columns=columns, show='headings', height=15)
        
        self.issues_tree.heading('issue_id', text='问题ID')
        self.issues_tree.heading('issue_type', text='类型')
        self.issues_tree.heading('severity', text='严重程度')
        self.issues_tree.heading('deceased_id', text='逝者ID')
        self.issues_tree.heading('chamber_id', text='柜号')
        self.issues_tree.heading('start_time', text='时间')
        self.issues_tree.heading('status', text='状态')
        self.issues_tree.heading('description', text='描述')
        
        self.issues_tree.column('issue_id', width=100)
        self.issues_tree.column('issue_type', width=100)
        self.issues_tree.column('severity', width=80)
        self.issues_tree.column('deceased_id', width=80)
        self.issues_tree.column('chamber_id', width=60)
        self.issues_tree.column('start_time', width=120)
        self.issues_tree.column('status', width=70)
        self.issues_tree.column('description', width=300)
        
        issues_scroll = ttk.Scrollbar(issues_frame, orient=tk.VERTICAL, command=self.issues_tree.yview)
        self.issues_tree.configure(yscrollcommand=issues_scroll.set)
        
        self.issues_tree.grid(row=0, column=0, sticky=(tk.W, tk.E, tk.N, tk.S))
        issues_scroll.grid(row=0, column=1, sticky=(tk.N, tk.S))
        
        self.issues_tree.bind('<<TreeviewSelect>>', self._on_issue_select)
        
        action_frame = ttk.Frame(left_frame)
        action_frame.grid(row=1, column=0, sticky=(tk.W, tk.E), pady=(10, 0))
        
        ttk.Button(action_frame, text="标记为已处理", command=self._mark_resolved).pack(side=tk.LEFT, padx=(0, 10))
        ttk.Button(action_frame, text="取消已处理", command=self._mark_unresolved).pack(side=tk.LEFT, padx=(0, 10))
        ttk.Button(action_frame, text="查看时间线", command=self._view_timeline).pack(side=tk.LEFT, padx=(0, 10))
        ttk.Button(action_frame, text="刷新列表", command=self._refresh_issues_list).pack(side=tk.LEFT, padx=(0, 10))
        
        right_frame = ttk.Frame(main_frame)
        right_frame.grid(row=1, column=1, sticky=(tk.W, tk.E, tk.N, tk.S))
        right_frame.rowconfigure(0, weight=2)
        right_frame.rowconfigure(1, weight=1)
        right_frame.columnconfigure(0, weight=1)
        
        detail_frame = ttk.LabelFrame(right_frame, text="问题详情", padding="5")
        detail_frame.grid(row=0, column=0, sticky=(tk.W, tk.E, tk.N, tk.S), pady=(0, 10))
        detail_frame.rowconfigure(0, weight=1)
        detail_frame.columnconfigure(0, weight=1)
        
        self.detail_text = tk.Text(detail_frame, wrap=tk.WORD, font=('Microsoft YaHei', 10))
        detail_scroll = ttk.Scrollbar(detail_frame, orient=tk.VERTICAL, command=self.detail_text.yview)
        self.detail_text.configure(yscrollcommand=detail_scroll.set)
        
        self.detail_text.grid(row=0, column=0, sticky=(tk.W, tk.E, tk.N, tk.S))
        detail_scroll.grid(row=0, column=1, sticky=(tk.N, tk.S))
        
        stats_frame = ttk.LabelFrame(right_frame, text="统计信息", padding="5")
        stats_frame.grid(row=1, column=0, sticky=(tk.W, tk.E, tk.N, tk.S))
        
        self.stats_label = ttk.Label(stats_frame, text="暂无数据，请先导入数据文件", style='Info.TLabel')
        self.stats_label.pack(anchor=tk.W, padx=10, pady=10)
        
        status_frame = ttk.Frame(self.root, padding="5")
        status_frame.grid(row=1, column=0, sticky=(tk.W, tk.E))
        
        self.status_label = ttk.Label(status_frame, text="就绪")
        self.status_label.pack(side=tk.LEFT)
        
        self.data_status_label = ttk.Label(status_frame, text="未加载数据", foreground='orange')
        self.data_status_label.pack(side=tk.RIGHT)

    def _update_status(self, message: str):
        self.status_label.config(text=message)
        self.root.update()

    def _load_default_data(self):
        deceased_path = os.path.join(self.data_directory, "deceased.csv")
        chamber_path = os.path.join(self.data_directory, "cold_chamber_logs.jsonl")
        handover_path = os.path.join(self.data_directory, "handover.csv")
        rules_path = os.path.join(self.data_directory, "rules.yaml")
        
        if os.path.exists(deceased_path) and os.path.exists(chamber_path):
            self._load_data(deceased_path, chamber_path, handover_path, rules_path)

    def _import_all_data(self):
        deceased_path = filedialog.askopenfilename(
            title="选择逝者信息文件 (deceased.csv)",
            filetypes=[("CSV文件", "*.csv"), ("所有文件", "*.*")]
        )
        if not deceased_path:
            return
        
        chamber_path = filedialog.askopenfilename(
            title="选择冷藏柜日志文件 (cold_chamber_logs.jsonl)",
            filetypes=[("JSONL文件", "*.jsonl"), ("所有文件", "*.*")]
        )
        if not chamber_path:
            return
        
        handover_path = filedialog.askopenfilename(
            title="选择交接记录文件 (handover.csv)",
            filetypes=[("CSV文件", "*.csv"), ("所有文件", "*.*")]
        )
        if not handover_path:
            return
        
        rules_path = filedialog.askopenfilename(
            title="选择规则配置文件 (rules.yaml)",
            filetypes=[("YAML文件", "*.yaml"), ("YAML文件", "*.yml"), ("所有文件", "*.*")]
        )
        
        self._load_data(deceased_path, chamber_path, handover_path, rules_path)

    def _load_data(
        self, 
        deceased_path: str, 
        chamber_path: str, 
        handover_path: str, 
        rules_path: str
    ):
        self._update_status("正在加载数据...")
        
        try:
            self.data_loader = DataLoader()
            load_issues = self.data_loader.load_all(
                deceased_path, chamber_path, handover_path, rules_path
            )
            
            self._update_status("正在构建时间线...")
            self.timeline_builder = TimelineBuilder(self.data_loader)
            self.timeline_builder.build_timelines()
            
            self._update_status("正在检测异常...")
            self.anomaly_detector = AnomalyDetector(self.data_loader, self.timeline_builder)
            self.anomaly_detector.detect_all()
            
            self.state_manager.sync_with_issues(self.anomaly_detector.all_issues)
            
            self.exporter = Exporter(self.data_loader, self.timeline_builder, self.anomaly_detector)
            
            chambers = self.timeline_builder.get_all_chambers()
            self.chamber_combo['values'] = ['全部'] + chambers
            
            self.current_issues = self.anomaly_detector.all_issues.copy()
            self._refresh_issues_list()
            self._update_statistics()
            
            self.data_status_label.config(text="数据已加载", foreground='green')
            self._update_status(f"数据加载完成，共发现 {len(self.current_issues)} 个问题")
            
        except Exception as e:
            messagebox.showerror("错误", f"数据加载失败: {str(e)}")
            self._update_status("数据加载失败")

    def _refresh_issues_list(self):
        for item in self.issues_tree.get_children():
            self.issues_tree.delete(item)
        
        for issue in self.current_issues:
            status_text = "已处理" if issue.is_resolved else "未处理"
            start_time_str = issue.start_time.strftime('%Y-%m-%d %H:%M') if issue.start_time else "N/A"
            
            values = (
                issue.issue_id,
                issue.issue_type,
                issue.severity,
                issue.deceased_id or "",
                issue.chamber_id or "",
                start_time_str,
                status_text,
                issue.description[:50] + "..." if len(issue.description) > 50 else issue.description
            )
            
            item = self.issues_tree.insert('', tk.END, values=values, iid=issue.issue_id)
            
            if issue.is_resolved:
                self.issues_tree.tag_configure('resolved', foreground='gray')
                self.issues_tree.item(item, tags=('resolved',))
            elif issue.severity == Severity.CRITICAL:
                self.issues_tree.tag_configure('critical', foreground='red')
                self.issues_tree.item(item, tags=('critical',))
            elif issue.severity == Severity.HIGH:
                self.issues_tree.tag_configure('high', foreground='orange')
                self.issues_tree.item(item, tags=('high',))

    def _on_issue_select(self, event):
        selected = self.issues_tree.selection()
        if not selected:
            return
        
        issue_id = selected[0]
        for issue in self.current_issues:
            if issue.issue_id == issue_id:
                self.selected_issue = issue
                self._show_issue_detail(issue)
                break

    def _show_issue_detail(self, issue: Issue):
        self.detail_text.delete('1.0', tk.END)
        
        lines = [
            f"问题ID: {issue.issue_id}\n",
            f"问题类型: {issue.issue_type}\n",
            f"严重程度: {issue.severity}\n",
            f"逝者ID: {issue.deceased_id or 'N/A'}\n",
            f"柜号: {issue.chamber_id or 'N/A'}\n",
            "\n"
        ]
        
        if issue.start_time:
            lines.append(f"开始时间: {issue.start_time.strftime('%Y-%m-%d %H:%M:%S')}\n")
        if issue.end_time:
            lines.append(f"结束时间: {issue.end_time.strftime('%Y-%m-%d %H:%M:%S')}\n")
        
        lines.extend([
            f"\n处理状态: {'已处理' if issue.is_resolved else '未处理'}\n",
            f"\n问题描述:\n{issue.description}\n",
        ])
        
        if issue.is_resolved:
            lines.extend([
                f"\n--- 处理信息 ---\n",
                f"处理人: {issue.resolved_by or 'N/A'}\n",
                f"处理时间: {issue.resolved_at.strftime('%Y-%m-%d %H:%M:%S') if issue.resolved_at else 'N/A'}\n",
                f"处理备注: {issue.resolve_notes or '无'}\n"
            ])
        
        if issue.related_records:
            lines.append(f"\n--- 相关记录 ({len(issue.related_records)} 条) ---\n")
            for idx, rec in enumerate(issue.related_records, 1):
                lines.append(f"\n记录 {idx}:\n")
                for key, value in rec.items():
                    lines.append(f"  {key}: {value}\n")
        
        self.detail_text.insert('1.0', ''.join(lines))

    def _apply_filters(self):
        if self.anomaly_detector is None:
            messagebox.showwarning("警告", "请先导入数据文件")
            return
        
        start_date = None
        end_date = None
        chamber_id = None
        issue_type = None
        is_resolved = None
        
        start_date_str = self.start_date_var.get().strip()
        if start_date_str:
            try:
                start_date = datetime.strptime(start_date_str, '%Y-%m-%d')
            except ValueError:
                try:
                    start_date = datetime.strptime(start_date_str, '%Y/%m/%d')
                except ValueError:
                    messagebox.showerror("错误", "日期格式错误，请使用 YYYY-MM-DD 格式")
                    return
        
        end_date_str = self.end_date_var.get().strip()
        if end_date_str:
            try:
                end_date = datetime.strptime(end_date_str, '%Y-%m-%d')
            except ValueError:
                try:
                    end_date = datetime.strptime(end_date_str, '%Y/%m/%d')
                except ValueError:
                    messagebox.showerror("错误", "日期格式错误，请使用 YYYY-MM-DD 格式")
                    return
        
        if self.chamber_var.get() != '全部':
            chamber_id = self.chamber_var.get()
        
        if self.issue_type_var.get() != '全部':
            issue_type = self.issue_type_var.get()
        
        if self.status_var.get() == '未处理':
            is_resolved = False
        elif self.status_var.get() == '已处理':
            is_resolved = True
        
        self.current_issues = self.anomaly_detector.filter_issues(
            start_date=start_date,
            end_date=end_date,
            chamber_id=chamber_id,
            issue_type=issue_type,
            is_resolved=is_resolved
        )
        
        self._refresh_issues_list()
        self._update_status(f"筛选完成，共 {len(self.current_issues)} 条记录")

    def _reset_filters(self):
        self.start_date_var.set("")
        self.end_date_var.set("")
        self.chamber_var.set("全部")
        self.issue_type_var.set("全部")
        self.status_var.set("全部")
        
        if self.anomaly_detector:
            self.current_issues = self.anomaly_detector.all_issues.copy()
            self._refresh_issues_list()
            self._update_status("筛选已重置")

    def _mark_resolved(self):
        if self.selected_issue is None:
            selected = self.issues_tree.selection()
            if not selected:
                messagebox.showwarning("警告", "请先选择一个问题")
                return
            issue_id = selected[0]
            for issue in self.current_issues:
                if issue.issue_id == issue_id:
                    self.selected_issue = issue
                    break
        
        if self.selected_issue is None:
            return
        
        if self.selected_issue.is_resolved:
            messagebox.showinfo("提示", "该问题已处理")
            return
        
        resolved_by = simpledialog.askstring("处理人", "请输入处理人姓名:")
        if resolved_by is None:
            return
        
        resolve_notes = simpledialog.askstring("处理备注", "请输入处理备注（可选）:")
        if resolve_notes is None:
            resolve_notes = ""
        
        self.anomaly_detector.mark_resolved(
            self.selected_issue.issue_id,
            resolved_by,
            resolve_notes
        )
        
        self.state_manager.mark_issue_resolved(
            self.selected_issue.issue_id,
            resolved_by,
            resolve_notes
        )
        
        self.selected_issue.is_resolved = True
        self.selected_issue.resolved_by = resolved_by
        self.selected_issue.resolved_at = datetime.now()
        self.selected_issue.resolve_notes = resolve_notes
        
        self._show_issue_detail(self.selected_issue)
        self._refresh_issues_list()
        self._update_statistics()
        self._update_status(f"问题 {self.selected_issue.issue_id} 已标记为已处理")

    def _mark_unresolved(self):
        if self.selected_issue is None:
            selected = self.issues_tree.selection()
            if not selected:
                messagebox.showwarning("警告", "请先选择一个问题")
                return
            issue_id = selected[0]
            for issue in self.current_issues:
                if issue.issue_id == issue_id:
                    self.selected_issue = issue
                    break
        
        if self.selected_issue is None:
            return
        
        if not self.selected_issue.is_resolved:
            messagebox.showinfo("提示", "该问题尚未处理")
            return
        
        self.selected_issue.is_resolved = False
        self.selected_issue.resolved_by = ""
        self.selected_issue.resolved_at = None
        self.selected_issue.resolve_notes = ""
        
        self.state_manager.mark_issue_unresolved(self.selected_issue.issue_id)
        
        self._show_issue_detail(self.selected_issue)
        self._refresh_issues_list()
        self._update_statistics()
        self._update_status(f"问题 {self.selected_issue.issue_id} 已取消处理标记")

    def _view_timeline(self):
        if self.timeline_builder is None:
            messagebox.showwarning("警告", "请先导入数据文件")
            return
        
        if self.selected_issue is None:
            messagebox.showwarning("警告", "请先选择一个问题")
            return
        
        deceased_id = self.selected_issue.deceased_id
        chamber_id = self.selected_issue.chamber_id
        
        timeline_window = tk.Toplevel(self.root)
        timeline_window.title("时间线查看")
        timeline_window.geometry("800x600")
        
        notebook = ttk.Notebook(timeline_window)
        notebook.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)
        
        if deceased_id:
            deceased_frame = ttk.Frame(notebook, padding="10")
            notebook.add(deceased_frame, text=f"逝者: {deceased_id}")
            
            deceased_text = tk.Text(deceased_frame, wrap=tk.WORD, font=('Microsoft YaHei', 10))
            deceased_scroll = ttk.Scrollbar(deceased_frame, orient=tk.VERTICAL, command=deceased_text.yview)
            deceased_text.configure(yscrollcommand=deceased_scroll.set)
            
            deceased_text.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
            deceased_scroll.pack(side=tk.RIGHT, fill=tk.Y)
            
            deceased = self.data_loader.deceased_dict.get(deceased_id)
            if deceased:
                deceased_text.insert(tk.END, f"=== 逝者信息 ===\n")
                deceased_text.insert(tk.END, f"ID: {deceased.deceased_id}\n")
                deceased_text.insert(tk.END, f"姓名: {deceased.name}\n")
                deceased_text.insert(tk.END, f"性别: {deceased.gender}\n")
                if deceased.birth_date:
                    deceased_text.insert(tk.END, f"出生日期: {deceased.birth_date.strftime('%Y-%m-%d')}\n")
                if deceased.death_date:
                    deceased_text.insert(tk.END, f"死亡日期: {deceased.death_date.strftime('%Y-%m-%d')}\n")
                deceased_text.insert(tk.END, "\n")
            
            timeline = self.timeline_builder.get_deceased_timeline(deceased_id)
            if timeline:
                deceased_text.insert(tk.END, f"=== 时间线记录 ({len(timeline)} 条) ===\n\n")
                for event in timeline:
                    deceased_text.insert(tk.END, f"[{event.timestamp.strftime('%Y-%m-%d %H:%M:%S')}] ")
                    deceased_text.insert(tk.END, f"{event.event_type}")
                    if event.chamber_id:
                        deceased_text.insert(tk.END, f" (柜号: {event.chamber_id})")
                    deceased_text.insert(tk.END, "\n")
                    
                    if event.details.get("temperature") is not None:
                        deceased_text.insert(tk.END, f"  温度: {event.details['temperature']}°C\n")
                    if event.details.get("operator"):
                        deceased_text.insert(tk.END, f"  操作员: {event.details['operator']}\n")
                    if event.details.get("remarks"):
                        deceased_text.insert(tk.END, f"  备注: {event.details['remarks']}\n")
                    deceased_text.insert(tk.END, "\n")
        
        if chamber_id:
            chamber_frame = ttk.Frame(notebook, padding="10")
            notebook.add(chamber_frame, text=f"冷藏柜: {chamber_id}")
            
            chamber_text = tk.Text(chamber_frame, wrap=tk.WORD, font=('Microsoft YaHei', 10))
            chamber_scroll = ttk.Scrollbar(chamber_frame, orient=tk.VERTICAL, command=chamber_text.yview)
            chamber_text.configure(yscrollcommand=chamber_scroll.set)
            
            chamber_text.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
            chamber_scroll.pack(side=tk.RIGHT, fill=tk.Y)
            
            status = self.timeline_builder.get_chamber_status(chamber_id)
            if status:
                chamber_text.insert(tk.END, f"=== 冷藏柜状态 ===\n")
                if status.current_occupant:
                    chamber_text.insert(tk.END, f"当前占用者: {status.current_occupant}\n")
                    if status.current_start_time:
                        chamber_text.insert(tk.END, f"入柜时间: {status.current_start_time.strftime('%Y-%m-%d %H:%M:%S')}\n")
                else:
                    chamber_text.insert(tk.END, "当前状态: 空闲\n")
                chamber_text.insert(tk.END, "\n")
                
                if status.occupancy_history:
                    chamber_text.insert(tk.END, f"=== 占用历史 ({len(status.occupancy_history)} 条) ===\n\n")
                    for idx, occ in enumerate(status.occupancy_history, 1):
                        start_str = occ['start_time'].strftime('%Y-%m-%d %H:%M') if occ['start_time'] else 'N/A'
                        end_str = occ['end_time'].strftime('%Y-%m-%d %H:%M') if occ['end_time'] else '进行中'
                        chamber_text.insert(tk.END, f"{idx}. 逝者: {occ['deceased_id']}\n")
                        chamber_text.insert(tk.END, f"   入柜: {start_str}\n")
                        chamber_text.insert(tk.END, f"   出柜: {end_str}\n\n")
                
                if status.temperature_history:
                    chamber_text.insert(tk.END, f"=== 温度记录 (最近20条) ===\n\n")
                    recent_temps = status.temperature_history[-20:]
                    for temp in recent_temps:
                        time_str = temp['timestamp'].strftime('%Y-%m-%d %H:%M:%S')
                        temp_str = f"{temp['temperature']}°C"
                        chamber_text.insert(tk.END, f"{time_str}: {temp_str}\n")

    def _update_statistics(self):
        if self.anomaly_detector is None:
            self.stats_label.config(text="暂无数据，请先导入数据文件")
            return
        
        all_issues = self.anomaly_detector.all_issues
        total = len(all_issues)
        unresolved = len([i for i in all_issues if not i.is_resolved])
        resolved = total - unresolved
        
        critical = len([i for i in all_issues if i.severity == Severity.CRITICAL])
        high = len([i for i in all_issues if i.severity == Severity.HIGH])
        medium = len([i for i in all_issues if i.severity == Severity.MEDIUM])
        
        stats_text = (
            f"总问题数: {total}  |  未处理: {unresolved}  |  已处理: {resolved}\n"
            f"严重: {critical}  |  高: {high}  |  中: {medium}\n"
        )
        
        chambers = self.timeline_builder.get_all_chambers() if self.timeline_builder else []
        stats_text += f"冷藏柜数量: {len(chambers)}"
        
        self.stats_label.config(text=stats_text)

    def _export_issues_csv(self):
        if self.exporter is None:
            messagebox.showwarning("警告", "请先导入数据文件")
            return
        
        file_path = filedialog.asksaveasfilename(
            title="保存问题列表",
            defaultextension=".csv",
            filetypes=[("CSV文件", "*.csv"), ("所有文件", "*.*")],
            initialfile="issues.csv"
        )
        
        if file_path:
            if self.exporter.export_issues_csv(file_path):
                messagebox.showinfo("成功", f"文件已保存到: {file_path}")
            else:
                messagebox.showerror("错误", "导出失败")

    def _export_chamber_review(self):
        if self.exporter is None:
            messagebox.showwarning("警告", "请先导入数据文件")
            return
        
        file_path = filedialog.asksaveasfilename(
            title="保存审核报告",
            defaultextension=".md",
            filetypes=[("Markdown文件", "*.md"), ("所有文件", "*.*")],
            initialfile="chamber_review.md"
        )
        
        if file_path:
            if self.exporter.export_chamber_review_md(file_path):
                messagebox.showinfo("成功", f"文件已保存到: {file_path}")
            else:
                messagebox.showerror("错误", "导出失败")

    def _export_state(self):
        file_path = filedialog.asksaveasfilename(
            title="保存状态备份",
            defaultextension=".json",
            filetypes=[("JSON文件", "*.json"), ("所有文件", "*.*")],
            initialfile=f"state_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        )
        
        if file_path:
            if self.state_manager.export_state(file_path):
                messagebox.showinfo("成功", f"状态已备份到: {file_path}")
            else:
                messagebox.showerror("错误", "备份失败")

    def _import_state(self):
        file_path = filedialog.askopenfilename(
            title="选择状态备份文件",
            filetypes=[("JSON文件", "*.json"), ("所有文件", "*.*")]
        )
        
        if file_path:
            merge = messagebox.askyesno(
                "导入选项",
                "是否合并现有状态？\n\n选择'是'将保留现有记录并添加新记录\n选择'否'将完全替换现有状态"
            )
            
            if self.state_manager.import_state(file_path, merge=merge):
                if self.anomaly_detector:
                    self.state_manager.sync_with_issues(self.anomaly_detector.all_issues)
                    self._refresh_issues_list()
                    self._update_statistics()
                messagebox.showinfo("成功", "状态已导入")
            else:
                messagebox.showerror("错误", "导入失败")

    def _show_all_chambers(self):
        if self.timeline_builder is None:
            messagebox.showwarning("警告", "请先导入数据文件")
            return
        
        chambers_window = tk.Toplevel(self.root)
        chambers_window.title("冷藏柜状态一览")
        chambers_window.geometry("900x600")
        
        frame = ttk.Frame(chambers_window, padding="10")
        frame.pack(fill=tk.BOTH, expand=True)
        
        columns = ('chamber_id', 'status', 'occupant', 'occupant_since', 'issue_count', 'unresolved_count')
        tree = ttk.Treeview(frame, columns=columns, show='headings', height=15)
        
        tree.heading('chamber_id', text='柜号')
        tree.heading('status', text='状态')
        tree.heading('occupant', text='当前占用者')
        tree.heading('occupant_since', text='入柜时间')
        tree.heading('issue_count', text='问题总数')
        tree.heading('unresolved_count', text='未处理问题')
        
        tree.column('chamber_id', width=80)
        tree.column('status', width=80)
        tree.column('occupant', width=100)
        tree.column('occupant_since', width=150)
        tree.column('issue_count', width=80)
        tree.column('unresolved_count', width=100)
        
        scroll = ttk.Scrollbar(frame, orient=tk.VERTICAL, command=tree.yview)
        tree.configure(yscrollcommand=scroll.set)
        
        tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scroll.pack(side=tk.RIGHT, fill=tk.Y)
        
        chambers = self.timeline_builder.get_all_chambers()
        for chamber_id in chambers:
            status = self.timeline_builder.get_chamber_status(chamber_id)
            issues = self.anomaly_detector.get_issues_by_chamber(chamber_id) if self.anomaly_detector else []
            unresolved = [i for i in issues if not i.is_resolved]
            
            if status:
                if status.current_occupant:
                    status_text = "占用中"
                    occupant = status.current_occupant
                    since = status.current_start_time.strftime('%Y-%m-%d %H:%M') if status.current_start_time else "N/A"
                else:
                    status_text = "空闲"
                    occupant = "-"
                    since = "-"
                
                values = (
                    chamber_id,
                    status_text,
                    occupant,
                    since,
                    len(issues),
                    len(unresolved)
                )
                
                item = tree.insert('', tk.END, values=values)
                
                if unresolved:
                    tree.tag_configure('has_issues', foreground='red')
                    tree.item(item, tags=('has_issues',))

    def _show_deceased_selector(self):
        if self.timeline_builder is None or self.data_loader is None:
            messagebox.showwarning("警告", "请先导入数据文件")
            return
        
        selector_window = tk.Toplevel(self.root)
        selector_window.title("选择逝者查看时间线")
        selector_window.geometry("500x400")
        
        frame = ttk.Frame(selector_window, padding="10")
        frame.pack(fill=tk.BOTH, expand=True)
        
        ttk.Label(frame, text="选择逝者ID:").pack(anchor=tk.W, pady=(0, 5))
        
        list_frame = ttk.Frame(frame)
        list_frame.pack(fill=tk.BOTH, expand=True)
        
        deceased_ids = self.timeline_builder.get_all_deceased_ids()
        
        listbox = tk.Listbox(list_frame, font=('Microsoft YaHei', 10))
        scroll = ttk.Scrollbar(list_frame, orient=tk.VERTICAL, command=listbox.yview)
        listbox.configure(yscrollcommand=scroll.set)
        
        for did in deceased_ids:
            deceased = self.data_loader.deceased_dict.get(did)
            if deceased:
                listbox.insert(tk.END, f"{did} - {deceased.name}")
            else:
                listbox.insert(tk.END, did)
        
        listbox.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scroll.pack(side=tk.RIGHT, fill=tk.Y)
        
        def on_view():
            selection = listbox.curselection()
            if not selection:
                messagebox.showwarning("警告", "请先选择一个逝者")
                return
            
            index = selection[0]
            did = deceased_ids[index]
            
            if self.exporter:
                file_path = filedialog.asksaveasfilename(
                    title="保存逝者时间线",
                    defaultextension=".md",
                    filetypes=[("Markdown文件", "*.md"), ("所有文件", "*.*")],
                    initialfile=f"timeline_{did}.md"
                )
                
                if file_path:
                    if self.exporter.export_deceased_timeline(file_path, did):
                        messagebox.showinfo("成功", f"时间线已保存到: {file_path}")
                    else:
                        messagebox.showerror("错误", "导出失败")
        
        ttk.Button(frame, text="导出时间线", command=on_view).pack(pady=(10, 0))

    def _show_about(self):
        about_text = """殡仪馆冷藏柜流转管理系统
版本: 1.0.0

功能说明:
- 导入逝者信息、冷藏柜日志、交接记录和规则配置
- 按逝者和冷藏柜重建流转时间线
- 自动检测温度超窗、重叠占用、签收缺失、跨午夜错位等问题
- 按日期/柜号筛选问题
- 人工标记已处理并本地保存
- 导出问题列表和审核报告

支持的问题类型:
1. 温度超窗 - 冷藏柜温度超出正常范围
2. 同柜重叠占用 - 同一冷藏柜被多人占用时间重叠
3. 交接签收缺失 - 交接记录缺少签收确认
4. 跨午夜归属错位 - 占用时间跨午夜需确认值班归属
5. 字段缺失 - 数据记录缺少必填字段
6. 重复交接 - 存在重复的交接记录
"""
        messagebox.showinfo("关于", about_text)


def main():
    root = tk.Tk()
    app = ColdChamberManagerApp(root)
    root.mainloop()


if __name__ == "__main__":
    main()
