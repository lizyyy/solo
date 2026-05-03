import tkinter as tk
from tkinter import ttk, filedialog, messagebox, scrolledtext
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Optional
import uuid

from config import SAMPLES_DIR, TIMEZONES
from models import (
    VoyagePlan, SensorReading, ZoneRule, ManualRecord,
    TankStatus, RiskIssue, RiskLevel, RiskType, AnalysisReport,
    TimelineEvent
)
from data_importer import DataImporter
from timeline_builder import TimelineBuilder
from risk_detector import RiskDetector
from data_exporter import DataExporter


class BallastWaterReviewerApp:
    def __init__(self, root: tk.Tk):
        self.root = root
        self.root.title("压载水换舱记录复核工具")
        self.root.geometry("1400x900")
        self.root.minsize(1200, 800)
        
        self.importer = DataImporter()
        self.timeline_builder = TimelineBuilder()
        self.risk_detector = RiskDetector()
        self.exporter = DataExporter()
        
        self.tank_statuses: Dict[str, TankStatus] = {}
        self.issues: List[RiskIssue] = []
        self.filtered_issues: List[RiskIssue] = []
        self.selected_issue: Optional[RiskIssue] = None
        
        self._create_menu()
        self._create_main_layout()
        self._create_status_bar()
    
    def _create_menu(self):
        menubar = tk.Menu(self.root)
        self.root.config(menu=menubar)
        
        file_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="文件", menu=file_menu)
        file_menu.add_command(label="导入航次计划 CSV", command=self._import_voyage_plan)
        file_menu.add_command(label="导入传感器数据 JSONL", command=self._import_sensor_data)
        file_menu.add_command(label="导入海区规则 YAML", command=self._import_zone_rules)
        file_menu.add_command(label="导入人工记录 JSON", command=self._import_manual_records)
        file_menu.add_separator()
        file_menu.add_command(label="加载示例数据", command=self._load_sample_data)
        file_menu.add_separator()
        file_menu.add_command(label="导出 issues.csv", command=self._export_issues_csv)
        file_menu.add_command(label="导出 ballast_report.md", command=self._export_report_md)
        file_menu.add_command(label="导出全部", command=self._export_all)
        file_menu.add_separator()
        file_menu.add_command(label="退出", command=self.root.quit)
        
        analysis_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="分析", menu=analysis_menu)
        analysis_menu.add_command(label="重建时间线", command=self._rebuild_timeline)
        analysis_menu.add_command(label="检测风险", command=self._detect_risks)
        analysis_menu.add_command(label="执行完整分析", command=self._run_full_analysis)
        
        help_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="帮助", menu=help_menu)
        help_menu.add_command(label="关于", command=self._show_about)
    
    def _create_main_layout(self):
        main_paned = ttk.PanedWindow(self.root, orient=tk.HORIZONTAL)
        main_paned.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)
        
        left_frame = ttk.Frame(main_paned)
        main_paned.add(left_frame, weight=1)
        
        right_frame = ttk.Frame(main_paned)
        main_paned.add(right_frame, weight=2)
        
        self._create_left_panel(left_frame)
        self._create_right_panel(right_frame)
    
    def _create_left_panel(self, parent):
        notebook = ttk.Notebook(parent)
        notebook.pack(fill=tk.BOTH, expand=True)
        
        overview_frame = ttk.Frame(notebook)
        notebook.add(overview_frame, text="概览")
        self._create_overview_tab(overview_frame)
        
        timeline_frame = ttk.Frame(notebook)
        notebook.add(timeline_frame, text="时间线")
        self._create_timeline_tab(timeline_frame)
        
        tanks_frame = ttk.Frame(notebook)
        notebook.add(tanks_frame, text="压载舱状态")
        self._create_tanks_tab(tanks_frame)
    
    def _create_overview_tab(self, parent):
        import_frame = ttk.LabelFrame(parent, text="数据导入状态", padding=10)
        import_frame.pack(fill=tk.X, pady=5)
        
        self.import_status = {
            "voyage_plan": tk.StringVar(value="未导入"),
            "sensor_data": tk.StringVar(value="未导入"),
            "zone_rules": tk.StringVar(value="未导入"),
            "manual_records": tk.StringVar(value="未导入")
        }
        
        row = 0
        ttk.Label(import_frame, text="航次计划:").grid(row=row, column=0, sticky=tk.W, pady=2)
        ttk.Label(import_frame, textvariable=self.import_status["voyage_plan"]).grid(row=row, column=1, sticky=tk.W, pady=2)
        ttk.Button(import_frame, text="导入", command=self._import_voyage_plan).grid(row=row, column=2, padx=5)
        row += 1
        
        ttk.Label(import_frame, text="传感器数据:").grid(row=row, column=0, sticky=tk.W, pady=2)
        ttk.Label(import_frame, textvariable=self.import_status["sensor_data"]).grid(row=row, column=1, sticky=tk.W, pady=2)
        ttk.Button(import_frame, text="导入", command=self._import_sensor_data).grid(row=row, column=2, padx=5)
        row += 1
        
        ttk.Label(import_frame, text="海区规则:").grid(row=row, column=0, sticky=tk.W, pady=2)
        ttk.Label(import_frame, textvariable=self.import_status["zone_rules"]).grid(row=row, column=1, sticky=tk.W, pady=2)
        ttk.Button(import_frame, text="导入", command=self._import_zone_rules).grid(row=row, column=2, padx=5)
        row += 1
        
        ttk.Label(import_frame, text="人工记录:").grid(row=row, column=0, sticky=tk.W, pady=2)
        ttk.Label(import_frame, textvariable=self.import_status["manual_records"]).grid(row=row, column=1, sticky=tk.W, pady=2)
        ttk.Button(import_frame, text="导入", command=self._import_manual_records).grid(row=row, column=2, padx=5)
        
        quick_frame = ttk.LabelFrame(parent, text="快捷操作", padding=10)
        quick_frame.pack(fill=tk.X, pady=5)
        
        ttk.Button(quick_frame, text="📦 加载示例数据", command=self._load_sample_data).pack(side=tk.LEFT, padx=5)
        ttk.Button(quick_frame, text="🔍 执行完整分析", command=self._run_full_analysis).pack(side=tk.LEFT, padx=5)
        ttk.Button(quick_frame, text="📊 导出报告", command=self._export_all).pack(side=tk.LEFT, padx=5)
        
        stats_frame = ttk.LabelFrame(parent, text="分析统计", padding=10)
        stats_frame.pack(fill=tk.BOTH, expand=True, pady=5)
        
        self.stats_text = scrolledtext.ScrolledText(stats_frame, wrap=tk.WORD, state=tk.DISABLED)
        self.stats_text.pack(fill=tk.BOTH, expand=True)
        
        self._update_stats("尚未执行分析，请先导入数据并执行分析。")
    
    def _create_timeline_tab(self, parent):
        control_frame = ttk.Frame(parent)
        control_frame.pack(fill=tk.X, pady=5)
        
        ttk.Label(control_frame, text="选择压载舱:").pack(side=tk.LEFT, padx=5)
        
        self.tank_selector = ttk.Combobox(control_frame, state="readonly", width=20)
        self.tank_selector.pack(side=tk.LEFT, padx=5)
        self.tank_selector.bind("<<ComboboxSelected>>", self._on_tank_selected)
        
        ttk.Button(control_frame, text="刷新", command=self._refresh_timeline).pack(side=tk.LEFT, padx=5)
        
        timeline_container = ttk.Frame(parent)
        timeline_container.pack(fill=tk.BOTH, expand=True, pady=5)
        
        self.timeline_text = scrolledtext.ScrolledText(timeline_container, wrap=tk.WORD, state=tk.DISABLED)
        self.timeline_text.pack(fill=tk.BOTH, expand=True)
    
    def _create_tanks_tab(self, parent):
        columns = ("tank_id", "current_volume", "max_volume", "load_rate", "status", "event_count", "issue_count")
        
        self.tanks_tree = ttk.Treeview(parent, columns=columns, show="headings", height=20)
        
        self.tanks_tree.heading("tank_id", text="压载舱")
        self.tanks_tree.heading("current_volume", text="当前体积(m³)")
        self.tanks_tree.heading("max_volume", text="最大体积(m³)")
        self.tanks_tree.heading("load_rate", text="装载率")
        self.tanks_tree.heading("status", text="状态")
        self.tanks_tree.heading("event_count", text="事件数")
        self.tanks_tree.heading("issue_count", text="问题数")
        
        self.tanks_tree.column("tank_id", width=80)
        self.tanks_tree.column("current_volume", width=100)
        self.tanks_tree.column("max_volume", width=100)
        self.tanks_tree.column("load_rate", width=80)
        self.tanks_tree.column("status", width=80)
        self.tanks_tree.column("event_count", width=80)
        self.tanks_tree.column("issue_count", width=80)
        
        scrollbar = ttk.Scrollbar(parent, orient=tk.VERTICAL, command=self.tanks_tree.yview)
        self.tanks_tree.configure(yscrollcommand=scrollbar.set)
        
        self.tanks_tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
    
    def _create_right_panel(self, parent):
        notebook = ttk.Notebook(parent)
        notebook.pack(fill=tk.BOTH, expand=True)
        
        issues_frame = ttk.Frame(notebook)
        notebook.add(issues_frame, text="风险问题")
        self._create_issues_tab(issues_frame)
        
        detail_frame = ttk.Frame(notebook)
        notebook.add(detail_frame, text="问题详情")
        self._create_detail_tab(detail_frame)
        
        rules_frame = ttk.Frame(notebook)
        notebook.add(rules_frame, text="海区规则")
        self._create_rules_tab(rules_frame)
    
    def _create_issues_tab(self, parent):
        filter_frame = ttk.LabelFrame(parent, text="筛选条件", padding=5)
        filter_frame.pack(fill=tk.X, pady=5)
        
        ttk.Label(filter_frame, text="风险等级:").pack(side=tk.LEFT, padx=5)
        self.level_filter = ttk.Combobox(filter_frame, state="readonly", width=15)
        self.level_filter['values'] = ("全部", "严重", "高", "中", "低")
        self.level_filter.current(0)
        self.level_filter.pack(side=tk.LEFT, padx=5)
        self.level_filter.bind("<<ComboboxSelected>>", self._apply_filters)
        
        ttk.Label(filter_frame, text="风险类型:").pack(side=tk.LEFT, padx=5)
        self.type_filter = ttk.Combobox(filter_frame, state="readonly", width=20)
        self.type_filter['values'] = ("全部", "海区违规排放", "排放量超标", "传感器断采", "人工记录冲突", "泵阀状态冲突", "缺失传感器数据", "跨时区问题")
        self.type_filter.current(0)
        self.type_filter.pack(side=tk.LEFT, padx=5)
        self.type_filter.bind("<<ComboboxSelected>>", self._apply_filters)
        
        ttk.Label(filter_frame, text="确认状态:").pack(side=tk.LEFT, padx=5)
        self.confirmed_filter = ttk.Combobox(filter_frame, state="readonly", width=15)
        self.confirmed_filter['values'] = ("全部", "未确认", "已确认")
        self.confirmed_filter.current(0)
        self.confirmed_filter.pack(side=tk.LEFT, padx=5)
        self.confirmed_filter.bind("<<ComboboxSelected>>", self._apply_filters)
        
        ttk.Button(filter_frame, text="重置筛选", command=self._reset_filters).pack(side=tk.LEFT, padx=10)
        
        columns = ("issue_id", "tank_id", "risk_type", "risk_level", "timestamp", "description", "is_confirmed")
        
        self.issues_tree = ttk.Treeview(parent, columns=columns, show="headings", height=20)
        
        self.issues_tree.heading("issue_id", text="问题ID")
        self.issues_tree.heading("tank_id", text="压载舱")
        self.issues_tree.heading("risk_type", text="风险类型")
        self.issues_tree.heading("risk_level", text="风险等级")
        self.issues_tree.heading("timestamp", text="时间")
        self.issues_tree.heading("description", text="描述")
        self.issues_tree.heading("is_confirmed", text="状态")
        
        self.issues_tree.column("issue_id", width=80)
        self.issues_tree.column("tank_id", width=80)
        self.issues_tree.column("risk_type", width=120)
        self.issues_tree.column("risk_level", width=80)
        self.issues_tree.column("timestamp", width=150)
        self.issues_tree.column("description", width=300)
        self.issues_tree.column("is_confirmed", width=80)
        
        scrollbar = ttk.Scrollbar(parent, orient=tk.VERTICAL, command=self.issues_tree.yview)
        self.issues_tree.configure(yscrollcommand=scrollbar.set)
        
        self.issues_tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
        
        self.issues_tree.bind("<<TreeviewSelect>>", self._on_issue_selected)
    
    def _create_detail_tab(self, parent):
        self.detail_text = scrolledtext.ScrolledText(parent, wrap=tk.WORD, state=tk.DISABLED)
        self.detail_text.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)
        
        action_frame = ttk.Frame(parent)
        action_frame.pack(fill=tk.X, pady=5)
        
        ttk.Label(action_frame, text="确认人:").pack(side=tk.LEFT, padx=5)
        self.confirmed_by_entry = ttk.Entry(action_frame, width=20)
        self.confirmed_by_entry.pack(side=tk.LEFT, padx=5)
        
        ttk.Label(action_frame, text="备注:").pack(side=tk.LEFT, padx=5)
        self.notes_entry = ttk.Entry(action_frame, width=40)
        self.notes_entry.pack(side=tk.LEFT, padx=5)
        
        ttk.Button(action_frame, text="✅ 确认问题", command=self._confirm_issue).pack(side=tk.LEFT, padx=10)
        ttk.Button(action_frame, text="🔄 刷新详情", command=self._refresh_detail).pack(side=tk.LEFT, padx=5)
    
    def _create_rules_tab(self, parent):
        columns = ("zone_id", "zone_name", "latitude_range", "longitude_range", "max_discharge", "is_prohibited")
        
        self.rules_tree = ttk.Treeview(parent, columns=columns, show="headings", height=20)
        
        self.rules_tree.heading("zone_id", text="区域ID")
        self.rules_tree.heading("zone_name", text="区域名称")
        self.rules_tree.heading("latitude_range", text="纬度范围")
        self.rules_tree.heading("longitude_range", text="经度范围")
        self.rules_tree.heading("max_discharge", text="最大排放量(m³)")
        self.rules_tree.heading("is_prohibited", text="是否禁止")
        
        self.rules_tree.column("zone_id", width=80)
        self.rules_tree.column("zone_name", width=150)
        self.rules_tree.column("latitude_range", width=120)
        self.rules_tree.column("longitude_range", width=120)
        self.rules_tree.column("max_discharge", width=120)
        self.rules_tree.column("is_prohibited", width=80)
        
        scrollbar = ttk.Scrollbar(parent, orient=tk.VERTICAL, command=self.rules_tree.yview)
        self.rules_tree.configure(yscrollcommand=scrollbar.set)
        
        self.rules_tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
        
        desc_frame = ttk.LabelFrame(parent, text="区域描述", padding=10)
        desc_frame.pack(fill=tk.X, pady=5)
        
        self.rule_desc_text = scrolledtext.ScrolledText(desc_frame, wrap=tk.WORD, state=tk.DISABLED, height=4)
        self.rule_desc_text.pack(fill=tk.BOTH, expand=True)
        
        self.rules_tree.bind("<<TreeviewSelect>>", self._on_rule_selected)
    
    def _create_status_bar(self):
        self.status_bar = ttk.Label(self.root, text="就绪", relief=tk.SUNKEN, anchor=tk.W)
        self.status_bar.pack(side=tk.BOTTOM, fill=tk.X)
    
    def _update_status(self, message: str):
        self.status_bar.config(text=message)
    
    def _update_stats(self, message: str):
        self.stats_text.config(state=tk.NORMAL)
        self.stats_text.delete(1.0, tk.END)
        self.stats_text.insert(tk.END, message)
        self.stats_text.config(state=tk.DISABLED)
    
    def _import_voyage_plan(self):
        file_path = filedialog.askopenfilename(
            title="选择航次计划CSV文件",
            filetypes=[("CSV文件", "*.csv"), ("所有文件", "*.*")]
        )
        if file_path:
            try:
                self.importer.import_voyage_plan(file_path)
                self.import_status["voyage_plan"].set(f"已导入 ({Path(file_path).name})")
                self._update_status(f"已导入航次计划: {Path(file_path).name}")
                messagebox.showinfo("成功", "航次计划导入成功！")
            except Exception as e:
                messagebox.showerror("错误", f"导入失败: {str(e)}")
    
    def _import_sensor_data(self):
        file_path = filedialog.askopenfilename(
            title="选择传感器数据JSONL文件",
            filetypes=[("JSONL文件", "*.jsonl"), ("所有文件", "*.*")]
        )
        if file_path:
            try:
                self.importer.import_sensor_data(file_path)
                self.import_status["sensor_data"].set(f"已导入 ({len(self.importer.sensor_readings)} 条)")
                self._update_status(f"已导入传感器数据: {len(self.importer.sensor_readings)} 条")
                messagebox.showinfo("成功", f"传感器数据导入成功！共 {len(self.importer.sensor_readings)} 条记录。")
            except Exception as e:
                messagebox.showerror("错误", f"导入失败: {str(e)}")
    
    def _import_zone_rules(self):
        file_path = filedialog.askopenfilename(
            title="选择海区规则YAML文件",
            filetypes=[("YAML文件", "*.yaml *.yml"), ("所有文件", "*.*")]
        )
        if file_path:
            try:
                self.importer.import_zone_rules(file_path)
                self.import_status["zone_rules"].set(f"已导入 ({len(self.importer.zone_rules)} 条规则)")
                self._update_status(f"已导入海区规则: {len(self.importer.zone_rules)} 条")
                self._refresh_rules_table()
                messagebox.showinfo("成功", f"海区规则导入成功！共 {len(self.importer.zone_rules)} 条规则。")
            except Exception as e:
                messagebox.showerror("错误", f"导入失败: {str(e)}")
    
    def _import_manual_records(self):
        file_path = filedialog.askopenfilename(
            title="选择人工记录JSON文件",
            filetypes=[("JSON文件", "*.json"), ("所有文件", "*.*")]
        )
        if file_path:
            try:
                self.importer.import_manual_records(file_path)
                self.import_status["manual_records"].set(f"已导入 ({len(self.importer.manual_records)} 条)")
                self._update_status(f"已导入人工记录: {len(self.importer.manual_records)} 条")
                messagebox.showinfo("成功", f"人工记录导入成功！共 {len(self.importer.manual_records)} 条记录。")
            except Exception as e:
                messagebox.showerror("错误", f"导入失败: {str(e)}")
    
    def _load_sample_data(self):
        try:
            samples_path = Path(SAMPLES_DIR)
            
            voyage_plan_path = samples_path / "voyage_plan.csv"
            if voyage_plan_path.exists():
                self.importer.import_voyage_plan(str(voyage_plan_path))
                self.import_status["voyage_plan"].set(f"已导入 (示例数据)")
            
            sensor_data_path = samples_path / "sensor_data.jsonl"
            if sensor_data_path.exists():
                self.importer.import_sensor_data(str(sensor_data_path))
                self.import_status["sensor_data"].set(f"已导入 ({len(self.importer.sensor_readings)} 条)")
            
            zone_rules_path = samples_path / "zone_rules.yaml"
            if zone_rules_path.exists():
                self.importer.import_zone_rules(str(zone_rules_path))
                self.import_status["zone_rules"].set(f"已导入 ({len(self.importer.zone_rules)} 条规则)")
                self._refresh_rules_table()
            
            manual_records_path = samples_path / "manual_records.json"
            if manual_records_path.exists():
                self.importer.import_manual_records(str(manual_records_path))
                self.import_status["manual_records"].set(f"已导入 ({len(self.importer.manual_records)} 条)")
            
            self._update_status("示例数据已加载完成")
            messagebox.showinfo("成功", "示例数据加载完成！可以执行分析了。")
        except Exception as e:
            messagebox.showerror("错误", f"加载示例数据失败: {str(e)}")
    
    def _rebuild_timeline(self):
        if not self.importer.sensor_readings and not self.importer.manual_records:
            messagebox.showwarning("警告", "请先导入传感器数据或人工记录")
            return
        
        try:
            self.tank_statuses = self.timeline_builder.build_timeline(
                self.importer.sensor_readings,
                self.importer.manual_records,
                self.importer.voyage_plan
            )
            
            tanks = sorted(self.tank_statuses.keys())
            self.tank_selector['values'] = tanks
            if tanks:
                self.tank_selector.current(0)
            
            self._refresh_tanks_table()
            self._refresh_timeline()
            
            self._update_status(f"时间线重建完成，共 {len(self.tank_statuses)} 个压载舱")
            messagebox.showinfo("成功", f"时间线重建完成！共 {len(self.tank_statuses)} 个压载舱。")
        except Exception as e:
            messagebox.showerror("错误", f"重建时间线失败: {str(e)}")
    
    def _detect_risks(self):
        if not self.tank_statuses:
            messagebox.showwarning("警告", "请先重建时间线")
            return
        
        try:
            self.risk_detector.set_voyage_plan(self.importer.voyage_plan)
            self.risk_detector.set_zone_rules(self.importer.zone_rules)
            
            self.issues = self.risk_detector.detect_risks(
                self.tank_statuses,
                self.importer.sensor_readings,
                self.importer.manual_records
            )
            
            self.filtered_issues = self.issues.copy()
            self._refresh_issues_table()
            self._refresh_tanks_table()
            self._update_stats_text()
            
            self._update_status(f"风险检测完成，共发现 {len(self.issues)} 个问题")
            messagebox.showinfo("成功", f"风险检测完成！共发现 {len(self.issues)} 个问题。")
        except Exception as e:
            messagebox.showerror("错误", f"风险检测失败: {str(e)}")
    
    def _run_full_analysis(self):
        self._rebuild_timeline()
        if self.tank_statuses:
            self._detect_risks()
    
    def _update_stats_text(self):
        if not self.issues:
            self._update_stats("尚未发现风险问题。")
            return
        
        critical_count = len([i for i in self.issues if i.risk_level == RiskLevel.CRITICAL])
        high_count = len([i for i in self.issues if i.risk_level == RiskLevel.HIGH])
        medium_count = len([i for i in self.issues if i.risk_level == RiskLevel.MEDIUM])
        low_count = len([i for i in self.issues if i.risk_level == RiskLevel.LOW])
        
        unconfirmed_count = len([i for i in self.issues if not i.is_confirmed])
        confirmed_count = len([i for i in self.issues if i.is_confirmed])
        
        tanks_with_issues = set()
        for issue in self.issues:
            tanks_with_issues.add(issue.tank_id)
        
        stats = f"""=== 压载水换舱复核分析统计 ===

总问题数: {len(self.issues)}
涉及压载舱数: {len(tanks_with_issues)}

风险等级分布:
  🔴 严重 (CRITICAL): {critical_count}
  🟠 高风险 (HIGH): {high_count}
  🟡 中等 (MEDIUM): {medium_count}
  🟢 低风险 (LOW): {low_count}

确认状态:
  ❌ 未确认: {unconfirmed_count}
  ✅ 已确认: {confirmed_count}

航次信息:
  航次编号: {self.importer.voyage_plan.voyage_id if self.importer.voyage_plan else 'N/A'}
  船舶名称: {self.importer.voyage_plan.vessel_name if self.importer.voyage_plan else 'N/A'}
"""
        self._update_stats(stats)
    
    def _refresh_rules_table(self):
        for item in self.rules_tree.get_children():
            self.rules_tree.delete(item)
        
        for rule in self.importer.zone_rules:
            lat_range = f"{rule.latitude_min} ~ {rule.latitude_max}"
            lon_range = f"{rule.longitude_min} ~ {rule.longitude_max}"
            prohibited = "是" if rule.is_prohibited else "否"
            
            self.rules_tree.insert("", tk.END, values=(
                rule.zone_id,
                rule.zone_name,
                lat_range,
                lon_range,
                f"{rule.max_discharge_volume:.0f}",
                prohibited
            ), iid=rule.zone_id)
    
    def _refresh_issues_table(self):
        for item in self.issues_tree.get_children():
            self.issues_tree.delete(item)
        
        for issue in self.filtered_issues:
            self.issues_tree.insert("", tk.END, values=(
                issue.issue_id,
                issue.tank_id,
                issue.risk_type.value,
                issue.risk_level.value,
                issue.timestamp.strftime('%Y-%m-%d %H:%M:%S'),
                issue.description,
                "已确认" if issue.is_confirmed else "未确认"
            ), iid=issue.issue_id)
    
    def _refresh_tanks_table(self):
        for item in self.tanks_tree.get_children():
            self.tanks_tree.delete(item)
        
        for tank_id, tank_status in sorted(self.tank_statuses.items()):
            load_rate = (tank_status.current_volume / tank_status.max_volume * 100) if tank_status.max_volume > 0 else 0
            tank_issues = [i for i in self.issues if i.tank_id == tank_id]
            
            self.tanks_tree.insert("", tk.END, values=(
                tank_id,
                f"{tank_status.current_volume:.2f}",
                f"{tank_status.max_volume:.2f}",
                f"{load_rate:.1f}%",
                tank_status.status,
                len(tank_status.history),
                len(tank_issues)
            ), iid=tank_id)
    
    def _refresh_timeline(self):
        selected_tank = self.tank_selector.get()
        if not selected_tank or selected_tank not in self.tank_statuses:
            return
        
        tank_status = self.tank_statuses[selected_tank]
        events = tank_status.history
        
        timeline_text = f"=== 压载舱 {selected_tank} 时间线 ===\n\n"
        timeline_text += f"当前状态: {tank_status.status}\n"
        timeline_text += f"当前体积: {tank_status.current_volume:.2f} m³\n"
        timeline_text += f"事件总数: {len(events)}\n\n"
        timeline_text += "-" * 60 + "\n\n"
        
        for event in sorted(events, key=lambda x: x.timestamp):
            timeline_text += f"[{event.timestamp.strftime('%Y-%m-%d %H:%M:%S')}]\n"
            timeline_text += f"  事件类型: {event.event_type}\n"
            timeline_text += f"  数据来源: {event.source}\n"
            timeline_text += f"  体积变化: {event.volume_change:+.2f} m³\n"
            timeline_text += f"  变化前: {event.volume_before:.2f} m³\n"
            timeline_text += f"  变化后: {event.volume_after:.2f} m³\n"
            
            if event.details:
                timeline_text += f"  详情:\n"
                for key, value in event.details.items():
                    timeline_text += f"    {key}: {value}\n"
            
            timeline_text += "\n"
        
        self.timeline_text.config(state=tk.NORMAL)
        self.timeline_text.delete(1.0, tk.END)
        self.timeline_text.insert(tk.END, timeline_text)
        self.timeline_text.config(state=tk.DISABLED)
    
    def _refresh_detail(self):
        if not self.selected_issue:
            self.detail_text.config(state=tk.NORMAL)
            self.detail_text.delete(1.0, tk.END)
            self.detail_text.insert(tk.END, "请从问题列表中选择一个问题查看详情。")
            self.detail_text.config(state=tk.DISABLED)
            return
        
        issue = self.selected_issue
        detail_text = f"""=== 问题详情 ===

问题ID: {issue.issue_id}
压载舱: {issue.tank_id}
风险类型: {issue.risk_type.value}
风险等级: {issue.risk_level.value}
发生时间: {issue.timestamp.strftime('%Y-%m-%d %H:%M:%S')}

描述:
{issue.description}

位置:
  纬度: {issue.location.get('lat', 0):.4f}
  经度: {issue.location.get('lon', 0):.4f}

受影响体积: {issue.affected_volume:.2f} m³

确认状态: {'✅ 已确认' if issue.is_confirmed else '❌ 未确认'}
"""
        if issue.is_confirmed:
            detail_text += f"确认人: {issue.confirmed_by or 'N/A'}\n"
            if issue.confirmed_time:
                detail_text += f"确认时间: {issue.confirmed_time.strftime('%Y-%m-%d %H:%M:%S')}\n"
        
        if issue.notes:
            detail_text += f"\n备注: {issue.notes}\n"
        
        if issue.source_data:
            detail_text += f"\n源数据详情:\n"
            for key, value in issue.source_data.items():
                detail_text += f"  {key}: {value}\n"
        
        self.detail_text.config(state=tk.NORMAL)
        self.detail_text.delete(1.0, tk.END)
        self.detail_text.insert(tk.END, detail_text)
        self.detail_text.config(state=tk.DISABLED)
    
    def _apply_filters(self, event=None):
        level_filter = self.level_filter.get()
        type_filter = self.type_filter.get()
        confirmed_filter = self.confirmed_filter.get()
        
        self.filtered_issues = self.issues.copy()
        
        if level_filter != "全部":
            level_map = {
                "严重": RiskLevel.CRITICAL,
                "高": RiskLevel.HIGH,
                "中": RiskLevel.MEDIUM,
                "低": RiskLevel.LOW
            }
            if level_filter in level_map:
                self.filtered_issues = [i for i in self.filtered_issues if i.risk_level == level_map[level_filter]]
        
        if type_filter != "全部":
            type_map = {
                "海区违规排放": RiskType.ZONE_VIOLATION,
                "排放量超标": RiskType.VOLUME_EXCEEDED,
                "传感器断采": RiskType.SENSOR_GAP,
                "人工记录冲突": RiskType.MANUAL_CONFLICT,
                "泵阀状态冲突": RiskType.PUMP_STATUS_CONFLICT,
                "缺失传感器数据": RiskType.MISSING_SENSOR,
                "跨时区问题": RiskType.TIMEZONE_ISSUE
            }
            if type_filter in type_map:
                self.filtered_issues = [i for i in self.filtered_issues if i.risk_type == type_map[type_filter]]
        
        if confirmed_filter == "未确认":
            self.filtered_issues = [i for i in self.filtered_issues if not i.is_confirmed]
        elif confirmed_filter == "已确认":
            self.filtered_issues = [i for i in self.filtered_issues if i.is_confirmed]
        
        self._refresh_issues_table()
        self._update_status(f"筛选后共 {len(self.filtered_issues)} 个问题")
    
    def _reset_filters(self):
        self.level_filter.current(0)
        self.type_filter.current(0)
        self.confirmed_filter.current(0)
        self.filtered_issues = self.issues.copy()
        self._refresh_issues_table()
        self._update_status(f"筛选已重置，共 {len(self.issues)} 个问题")
    
    def _on_tank_selected(self, event=None):
        self._refresh_timeline()
    
    def _on_issue_selected(self, event=None):
        selection = self.issues_tree.selection()
        if not selection:
            return
        
        issue_id = selection[0]
        for issue in self.issues:
            if issue.issue_id == issue_id:
                self.selected_issue = issue
                self._refresh_detail()
                break
    
    def _on_rule_selected(self, event=None):
        selection = self.rules_tree.selection()
        if not selection:
            return
        
        zone_id = selection[0]
        for rule in self.importer.zone_rules:
            if rule.zone_id == zone_id:
                self.rule_desc_text.config(state=tk.NORMAL)
                self.rule_desc_text.delete(1.0, tk.END)
                self.rule_desc_text.insert(tk.END, rule.description)
                self.rule_desc_text.config(state=tk.DISABLED)
                break
    
    def _confirm_issue(self):
        if not self.selected_issue:
            messagebox.showwarning("警告", "请先选择一个问题")
            return
        
        confirmed_by = self.confirmed_by_entry.get().strip()
        if not confirmed_by:
            messagebox.showwarning("警告", "请输入确认人姓名")
            return
        
        notes = self.notes_entry.get().strip()
        
        self.risk_detector.confirm_issue(
            self.selected_issue.issue_id,
            confirmed_by,
            notes
        )
        
        self._refresh_detail()
        self._refresh_issues_table()
        self._update_stats_text()
        
        self._update_status(f"问题 {self.selected_issue.issue_id} 已确认")
        messagebox.showinfo("成功", "问题已确认！")
    
    def _export_issues_csv(self):
        if not self.issues:
            messagebox.showwarning("警告", "没有可导出的问题数据")
            return
        
        try:
            filepath = self.exporter.export_issues_csv(self.issues)
            self._update_status(f"已导出到: {filepath}")
            messagebox.showinfo("成功", f"issues.csv 已导出到:\n{filepath}")
        except Exception as e:
            messagebox.showerror("错误", f"导出失败: {str(e)}")
    
    def _export_report_md(self):
        if not self.issues:
            messagebox.showwarning("警告", "没有可导出的报告数据")
            return
        
        try:
            report = self._create_analysis_report()
            filepath = self.exporter.export_ballast_report_md(report, self.issues, self.tank_statuses)
            self._update_status(f"已导出到: {filepath}")
            messagebox.showinfo("成功", f"ballast_report.md 已导出到:\n{filepath}")
        except Exception as e:
            messagebox.showerror("错误", f"导出失败: {str(e)}")
    
    def _export_all(self):
        if not self.issues:
            messagebox.showwarning("警告", "没有可导出的数据")
            return
        
        try:
            report = self._create_analysis_report()
            results = self.exporter.export_all(report, self.issues, self.tank_statuses)
            
            result_text = "导出成功！\n\n"
            result_text += f"issues.csv: {results['issues_csv']}\n"
            result_text += f"ballast_report.md: {results['report_md']}\n"
            result_text += f"状态文件: {results['state_json']}"
            
            self._update_status("所有文件已导出")
            messagebox.showinfo("成功", result_text)
        except Exception as e:
            messagebox.showerror("错误", f"导出失败: {str(e)}")
    
    def _create_analysis_report(self) -> AnalysisReport:
        issues_by_type = {}
        for issue in self.issues:
            type_name = issue.risk_type.value
            if type_name not in issues_by_type:
                issues_by_type[type_name] = 0
            issues_by_type[type_name] += 1
        
        issues_by_level = {}
        for issue in self.issues:
            level_name = issue.risk_level.value
            if level_name not in issues_by_level:
                issues_by_level[level_name] = 0
            issues_by_level[level_name] += 1
        
        tanks_with_issues = set()
        for issue in self.issues:
            tanks_with_issues.add(issue.tank_id)
        
        recommendations = []
        critical_count = len([i for i in self.issues if i.risk_level == RiskLevel.CRITICAL and not i.is_confirmed])
        if critical_count > 0:
            recommendations.append(f"有 {critical_count} 个严重问题未确认，需立即处理")
        
        missing_sensors = [i for i in self.issues if i.risk_type == RiskType.MISSING_SENSOR and not i.is_confirmed]
        if missing_sensors:
            recommendations.append(f"有 {len(missing_sensors)} 个压载舱缺少传感器数据")
        
        sensor_gaps = [i for i in self.issues if i.risk_type == RiskType.SENSOR_GAP and not i.is_confirmed]
        if sensor_gaps:
            recommendations.append(f"检测到 {len(sensor_gaps)} 处传感器数据断采")
        
        zone_violations = [i for i in self.issues if i.risk_type == RiskType.ZONE_VIOLATION and not i.is_confirmed]
        if zone_violations:
            recommendations.append(f"检测到 {len(zone_violations)} 处海区违规排放")
        
        recommendations.append("请确认所有风险问题后再靠港")
        recommendations.append("建议导出完整报告存档")
        
        return AnalysisReport(
            report_id=str(uuid.uuid4())[:8],
            voyage_id=self.importer.voyage_plan.voyage_id if self.importer.voyage_plan else "UNKNOWN",
            generated_time=datetime.now(),
            total_tanks=len(self.tank_statuses),
            tanks_with_issues=len(tanks_with_issues),
            total_issues=len(self.issues),
            issues_by_type=issues_by_type,
            issues_by_level=issues_by_level,
            tanks=self.tank_statuses,
            recommendations=recommendations
        )
    
    def _show_about(self):
        about_text = """压载水换舱记录复核工具
版本: 1.0.0

功能:
- 导入航次计划、传感器数据、海区规则、人工记录
- 重建每个压载舱的换舱时间线
- 检测海区违规排放、排放量超标、传感器断采等风险
- 支持筛选风险、人工确认并持久保存
- 导出 issues.csv 和 ballast_report.md

边界处理:
- 跨时区航次自动识别
- 缺失传感器数据检测
"""
        messagebox.showinfo("关于", about_text)


def main():
    root = tk.Tk()
    app = BallastWaterReviewerApp(root)
    root.mainloop()


if __name__ == "__main__":
    main()
