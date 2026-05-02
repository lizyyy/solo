"""
主窗口
窑烧曲线复盘台的主GUI界面
"""

import tkinter as tk
from tkinter import ttk, filedialog, messagebox, scrolledtext
from datetime import datetime
from typing import Optional, List, Dict, Any
import uuid

from ..models import (
    FiringRecord, Risk, RiskLevel, RiskType, ReviewStatus,
    TemperaturePoint, FiringPlan, GlazeBatch, WorkPiece, Observation
)
from ..parsers import (
    TemperatureParser, FiringPlanParser, 
    GlazeBatchParser, WorkPieceParser, ObservationParser
)
from ..rules import RuleEngine
from ..persistence import DataStore
from ..import_export import MarkdownExporter, CSVExporter


class MainWindow:
    """主窗口类"""
    
    def __init__(self, root: tk.Tk):
        self.root = root
        self.root.title("窑烧曲线复盘台")
        self.root.geometry("1400x900")
        self.root.minsize(1000, 700)
        
        self.current_record: Optional[FiringRecord] = None
        self.data_store = DataStore()
        self.rule_engine = RuleEngine()
        
        self._create_menu()
        self._create_layout()
        self._refresh_record_list()
    
    def _create_menu(self):
        """创建菜单栏"""
        menubar = tk.Menu(self.root)
        self.root.config(menu=menubar)
        
        file_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="文件", menu=file_menu)
        file_menu.add_command(label="新建记录", command=self._new_record)
        file_menu.add_separator()
        file_menu.add_command(label="保存记录", command=self._save_record)
        file_menu.add_command(label="加载记录", command=self._load_record)
        file_menu.add_separator()
        file_menu.add_command(label="导出Markdown报告", command=self._export_markdown)
        file_menu.add_command(label="导出CSV问题清单", command=self._export_csv_risks)
        file_menu.add_separator()
        file_menu.add_command(label="退出", command=self.root.quit)
        
        import_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="导入", menu=import_menu)
        import_menu.add_command(label="温度数据 (CSV)", command=self._import_temperature)
        import_menu.add_command(label="烧成计划 (JSON)", command=self._import_firing_plan)
        import_menu.add_command(label="釉料批次表 (CSV)", command=self._import_glaze_batches)
        import_menu.add_command(label="作品列表 (CSV)", command=self._import_work_pieces)
        import_menu.add_command(label="观察备注", command=self._import_observations)
        
        analyze_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="分析", menu=analyze_menu)
        analyze_menu.add_command(label="执行规则检查", command=self._run_analysis)
        analyze_menu.add_command(label="生成时间线", command=self._generate_timeline)
        
        help_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="帮助", menu=help_menu)
        help_menu.add_command(label="关于", command=self._show_about)
    
    def _create_layout(self):
        """创建界面布局"""
        main_paned = ttk.PanedWindow(self.root, orient=tk.HORIZONTAL)
        main_paned.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)
        
        left_frame = ttk.Frame(main_paned, width=300)
        main_paned.add(left_frame, weight=0)
        
        right_paned = ttk.PanedWindow(main_paned, orient=tk.VERTICAL)
        main_paned.add(right_paned, weight=3)
        
        top_right = ttk.Frame(right_paned)
        right_paned.add(top_right, weight=2)
        
        bottom_right = ttk.Frame(right_paned)
        right_paned.add(bottom_right, weight=1)
        
        self._create_left_panel(left_frame)
        self._create_top_right_panel(top_right)
        self._create_bottom_right_panel(bottom_right)
    
    def _create_left_panel(self, parent):
        """创建左侧面板 - 记录列表"""
        label_frame = ttk.LabelFrame(parent, text="烧成记录列表", padding=5)
        label_frame.pack(fill=tk.BOTH, expand=True)
        
        toolbar = ttk.Frame(label_frame)
        toolbar.pack(fill=tk.X, pady=(0, 5))
        
        ttk.Button(toolbar, text="新建", command=self._new_record, width=8).pack(side=tk.LEFT, padx=2)
        ttk.Button(toolbar, text="加载", command=self._load_record, width=8).pack(side=tk.LEFT, padx=2)
        ttk.Button(toolbar, text="删除", command=self._delete_record, width=8).pack(side=tk.LEFT, padx=2)
        
        columns = ("name", "date", "risks", "status")
        self.record_tree = ttk.Treeview(
            label_frame, 
            columns=columns,
            show="headings",
            selectmode=tk.BROWSE
        )
        
        self.record_tree.heading("name", text="记录名称")
        self.record_tree.heading("date", text="日期")
        self.record_tree.heading("risks", text="问题数")
        self.record_tree.heading("status", text="状态")
        
        self.record_tree.column("name", width=120)
        self.record_tree.column("date", width=80)
        self.record_tree.column("risks", width=50)
        self.record_tree.column("status", width=60)
        
        scrollbar = ttk.Scrollbar(label_frame, orient=tk.VERTICAL, command=self.record_tree.yview)
        self.record_tree.configure(yscrollcommand=scrollbar.set)
        
        self.record_tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
        
        self.record_tree.bind("<<TreeviewSelect>>", self._on_record_selected)
    
    def _create_top_right_panel(self, parent):
        """创建右上方面板 - 标签页"""
        self.notebook = ttk.Notebook(parent)
        self.notebook.pack(fill=tk.BOTH, expand=True)
        
        overview_frame = ttk.Frame(self.notebook, padding=10)
        self.notebook.add(overview_frame, text="概览")
        self._create_overview_tab(overview_frame)
        
        risk_frame = ttk.Frame(self.notebook, padding=10)
        self.notebook.add(risk_frame, text="风险问题")
        self._create_risk_tab(risk_frame)
        
        timeline_frame = ttk.Frame(self.notebook, padding=10)
        self.notebook.add(timeline_frame, text="时间线")
        self._create_timeline_tab(timeline_frame)
        
        data_frame = ttk.Frame(self.notebook, padding=10)
        self.notebook.add(data_frame, text="原始数据")
        self._create_data_tab(data_frame)
    
    def _create_overview_tab(self, parent):
        """创建概览标签页"""
        info_frame = ttk.LabelFrame(parent, text="基本信息", padding=10)
        info_frame.pack(fill=tk.X, pady=(0, 10))
        
        row1 = ttk.Frame(info_frame)
        row1.pack(fill=tk.X, pady=5)
        
        ttk.Label(row1, text="记录名称:").pack(side=tk.LEFT)
        self.record_name_var = tk.StringVar()
        ttk.Entry(row1, textvariable=self.record_name_var, width=40).pack(side=tk.LEFT, padx=(10, 20))
        
        ttk.Label(row1, text="记录ID:").pack(side=tk.LEFT)
        self.record_id_label = ttk.Label(row1, text="-")
        self.record_id_label.pack(side=tk.LEFT, padx=10)
        
        row2 = ttk.Frame(info_frame)
        row2.pack(fill=tk.X, pady=5)
        
        ttk.Label(row2, text="开始时间:").pack(side=tk.LEFT)
        self.start_time_label = ttk.Label(row2, text="-")
        self.start_time_label.pack(side=tk.LEFT, padx=10)
        
        ttk.Label(row2, text="结束时间:").pack(side=tk.LEFT)
        self.end_time_label = ttk.Label(row2, text="-")
        self.end_time_label.pack(side=tk.LEFT, padx=10)
        
        ttk.Label(row2, text="总时长:").pack(side=tk.LEFT)
        self.duration_label = ttk.Label(row2, text="-")
        self.duration_label.pack(side=tk.LEFT, padx=10)
        
        stats_frame = ttk.LabelFrame(parent, text="统计信息", padding=10)
        stats_frame.pack(fill=tk.X, pady=(0, 10))
        
        self.stats_labels = {}
        stats = [
            ("最高温度", "max_temp"),
            ("数据点数", "data_points"),
            ("作品数量", "work_count"),
            ("釉料批次", "batch_count"),
            ("总问题数", "total_risks"),
            ("待复核", "pending_risks")
        ]
        
        for i, (label, key) in enumerate(stats):
            frame = ttk.Frame(stats_frame)
            frame.grid(row=i // 3, column=i % 3, padx=20, pady=10, sticky="w")
            
            ttk.Label(frame, text=f"{label}:", font=("Arial", 10, "bold")).pack(side=tk.LEFT)
            self.stats_labels[key] = ttk.Label(frame, text="-", font=("Arial", 12))
            self.stats_labels[key].pack(side=tk.LEFT, padx=10)
        
        action_frame = ttk.LabelFrame(parent, text="操作", padding=10)
        action_frame.pack(fill=tk.X, pady=(0, 10))
        
        ttk.Button(action_frame, text="📁 导入温度数据", command=self._import_temperature, width=20).pack(side=tk.LEFT, padx=5)
        ttk.Button(action_frame, text="📋 导入烧成计划", command=self._import_firing_plan, width=20).pack(side=tk.LEFT, padx=5)
        ttk.Button(action_frame, text="🎨 导入釉料批次", command=self._import_glaze_batches, width=20).pack(side=tk.LEFT, padx=5)
        ttk.Button(action_frame, text="🖼️ 导入作品列表", command=self._import_work_pieces, width=20).pack(side=tk.LEFT, padx=5)
        ttk.Button(action_frame, text="📝 导入观察备注", command=self._import_observations, width=20).pack(side=tk.LEFT, padx=5)
        
        ttk.Button(action_frame, text="🔍 执行分析检查", command=self._run_analysis, width=20).pack(side=tk.LEFT, padx=5)
        ttk.Button(action_frame, text="💾 保存记录", command=self._save_record, width=20).pack(side=tk.LEFT, padx=5)
    
    def _create_risk_tab(self, parent):
        """创建风险问题标签页"""
        toolbar = ttk.Frame(parent)
        toolbar.pack(fill=tk.X, pady=(0, 5))
        
        ttk.Label(toolbar, text="筛选:").pack(side=tk.LEFT, padx=(0, 5))
        
        self.risk_filter_var = tk.StringVar(value="全部")
        filter_combo = ttk.Combobox(
            toolbar, 
            textvariable=self.risk_filter_var,
            values=["全部", "严重", "高", "中", "低", "待复核", "已确认", "已忽略"],
            width=15,
            state="readonly"
        )
        filter_combo.pack(side=tk.LEFT, padx=5)
        filter_combo.bind("<<ComboboxSelected>>", self._filter_risks)
        
        ttk.Button(toolbar, text="批量复核", command=self._batch_review, width=10).pack(side=tk.LEFT, padx=5)
        ttk.Button(toolbar, text="导出问题清单", command=self._export_csv_risks, width=15).pack(side=tk.LEFT, padx=5)
        
        columns = ("level", "type", "title", "description", "time", "status")
        self.risk_tree = ttk.Treeview(
            parent, 
            columns=columns,
            show="headings",
            selectmode=tk.EXTENDED
        )
        
        self.risk_tree.heading("level", text="级别")
        self.risk_tree.heading("type", text="类型")
        self.risk_tree.heading("title", text="标题")
        self.risk_tree.heading("description", text="描述")
        self.risk_tree.heading("time", text="时间")
        self.risk_tree.heading("status", text="状态")
        
        self.risk_tree.column("level", width=60)
        self.risk_tree.column("type", width=100)
        self.risk_tree.column("title", width=150)
        self.risk_tree.column("description", width=300)
        self.risk_tree.column("time", width=120)
        self.risk_tree.column("status", width=80)
        
        scrollbar_y = ttk.Scrollbar(parent, orient=tk.VERTICAL, command=self.risk_tree.yview)
        scrollbar_x = ttk.Scrollbar(parent, orient=tk.HORIZONTAL, command=self.risk_tree.xview)
        self.risk_tree.configure(yscrollcommand=scrollbar_y.set, xscrollcommand=scrollbar_x.set)
        
        self.risk_tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scrollbar_y.pack(side=tk.RIGHT, fill=tk.Y)
        
        self.risk_tree.bind("<Double-1>", self._on_risk_double_click)
    
    def _create_timeline_tab(self, parent):
        """创建时间线标签页"""
        toolbar = ttk.Frame(parent)
        toolbar.pack(fill=tk.X, pady=(0, 5))
        
        ttk.Button(toolbar, text="刷新时间线", command=self._generate_timeline, width=15).pack(side=tk.LEFT, padx=5)
        
        self.timeline_text = scrolledtext.ScrolledText(
            parent, 
            wrap=tk.WORD,
            font=("Consolas", 10),
            bg="#f5f5f5"
        )
        self.timeline_text.pack(fill=tk.BOTH, expand=True)
        
        self.timeline_text.tag_configure("header", font=("Arial", 12, "bold"), foreground="#1565c0")
        self.timeline_text.tag_configure("time", font=("Consolas", 10, "bold"), foreground="#333333")
        self.timeline_text.tag_configure("temp", foreground="#2e7d32")
        self.timeline_text.tag_configure("risk_critical", foreground="#d32f2f", font=("Arial", 10, "bold"))
        self.timeline_text.tag_configure("risk_high", foreground="#f57c00", font=("Arial", 10, "bold"))
        self.timeline_text.tag_configure("risk_medium", foreground="#fbc02d", font=("Arial", 10))
        self.timeline_text.tag_configure("risk_low", foreground="#388e3c", font=("Arial", 10))
        self.timeline_text.tag_configure("observation", foreground="#7b1fa2")
    
    def _create_data_tab(self, parent):
        """创建原始数据标签页"""
        data_notebook = ttk.Notebook(parent)
        data_notebook.pack(fill=tk.BOTH, expand=True)
        
        temp_frame = ttk.Frame(data_notebook, padding=5)
        data_notebook.add(temp_frame, text="温度数据")
        self._create_temp_data_panel(temp_frame)
        
        plan_frame = ttk.Frame(data_notebook, padding=5)
        data_notebook.add(plan_frame, text="烧成计划")
        self._create_plan_data_panel(plan_frame)
        
        batch_frame = ttk.Frame(data_notebook, padding=5)
        data_notebook.add(batch_frame, text="釉料批次")
        self._create_batch_data_panel(batch_frame)
        
        work_frame = ttk.Frame(data_notebook, padding=5)
        data_notebook.add(work_frame, text="作品列表")
        self._create_work_data_panel(work_frame)
        
        obs_frame = ttk.Frame(data_notebook, padding=5)
        data_notebook.add(obs_frame, text="观察备注")
        self._create_obs_data_panel(obs_frame)
    
    def _create_temp_data_panel(self, parent):
        """创建温度数据面板"""
        columns = ("time", "avg", "max", "min", "diff")
        self.temp_tree = ttk.Treeview(
            parent, 
            columns=columns,
            show="headings"
        )
        
        self.temp_tree.heading("time", text="时间")
        self.temp_tree.heading("avg", text="平均温度")
        self.temp_tree.heading("max", text="最高温度")
        self.temp_tree.heading("min", text="最低温度")
        self.temp_tree.heading("diff", text="温差")
        
        scrollbar = ttk.Scrollbar(parent, orient=tk.VERTICAL, command=self.temp_tree.yview)
        self.temp_tree.configure(yscrollcommand=scrollbar.set)
        
        self.temp_tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
    
    def _create_plan_data_panel(self, parent):
        """创建烧成计划面板"""
        columns = ("segment", "start_temp", "end_temp", "rate", "hold_time")
        self.plan_tree = ttk.Treeview(
            parent, 
            columns=columns,
            show="headings"
        )
        
        self.plan_tree.heading("segment", text="阶段")
        self.plan_tree.heading("start_temp", text="起始温度")
        self.plan_tree.heading("end_temp", text="目标温度")
        self.plan_tree.heading("rate", text="升温速率")
        self.plan_tree.heading("hold_time", text="保温时间")
        
        scrollbar = ttk.Scrollbar(parent, orient=tk.VERTICAL, command=self.plan_tree.yview)
        self.plan_tree.configure(yscrollcommand=scrollbar.set)
        
        self.plan_tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
    
    def _create_batch_data_panel(self, parent):
        """创建釉料批次面板"""
        columns = ("batch_id", "glaze_name", "quantity", "status")
        self.batch_tree = ttk.Treeview(
            parent, 
            columns=columns,
            show="headings"
        )
        
        self.batch_tree.heading("batch_id", text="批次ID")
        self.batch_tree.heading("glaze_name", text="釉料名称")
        self.batch_tree.heading("quantity", text="数量")
        self.batch_tree.heading("status", text="状态")
        
        scrollbar = ttk.Scrollbar(parent, orient=tk.VERTICAL, command=self.batch_tree.yview)
        self.batch_tree.configure(yscrollcommand=scrollbar.set)
        
        self.batch_tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
    
    def _create_work_data_panel(self, parent):
        """创建作品列表面板"""
        columns = ("work_id", "title", "artist", "glaze_batch", "layer")
        self.work_tree = ttk.Treeview(
            parent, 
            columns=columns,
            show="headings"
        )
        
        self.work_tree.heading("work_id", text="作品ID")
        self.work_tree.heading("title", text="名称")
        self.work_tree.heading("artist", text="艺术家")
        self.work_tree.heading("glaze_batch", text="釉料批次")
        self.work_tree.heading("layer", text="放置层位")
        
        scrollbar = ttk.Scrollbar(parent, orient=tk.VERTICAL, command=self.work_tree.yview)
        self.work_tree.configure(yscrollcommand=scrollbar.set)
        
        self.work_tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
    
    def _create_obs_data_panel(self, parent):
        """创建观察备注面板"""
        columns = ("time", "content", "author", "category")
        self.obs_tree = ttk.Treeview(
            parent, 
            columns=columns,
            show="headings"
        )
        
        self.obs_tree.heading("time", text="时间")
        self.obs_tree.heading("content", text="内容")
        self.obs_tree.heading("author", text="记录人")
        self.obs_tree.heading("category", text="分类")
        
        scrollbar = ttk.Scrollbar(parent, orient=tk.VERTICAL, command=self.obs_tree.yview)
        self.obs_tree.configure(yscrollcommand=scrollbar.set)
        
        self.obs_tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
    
    def _create_bottom_right_panel(self, parent):
        """创建右下方面板 - 详情和日志"""
        detail_frame = ttk.LabelFrame(parent, text="详情查看", padding=5)
        detail_frame.pack(fill=tk.BOTH, expand=True)
        
        self.detail_text = scrolledtext.ScrolledText(
            detail_frame, 
            wrap=tk.WORD,
            font=("Arial", 10),
            height=8
        )
        self.detail_text.pack(fill=tk.BOTH, expand=True)
    
    def _refresh_record_list(self):
        """刷新记录列表"""
        for item in self.record_tree.get_children():
            self.record_tree.delete(item)
        
        records = self.data_store.list_records()
        
        for rec in records:
            name = rec.get('name', '未命名')
            date = rec.get('updated_at', '-')
            if date != '-':
                try:
                    dt = datetime.fromisoformat(date)
                    date = dt.strftime('%m-%d')
                except:
                    pass
            
            risks = rec.get('risk_count', 0)
            pending = rec.get('pending_risks', 0)
            
            if pending > 0:
                status = f"待复核({pending})"
            else:
                status = "已完成" if risks == 0 else "有问题"
            
            self.record_tree.insert("", tk.END, iid=rec.get('record_id', ''), values=(name, date, risks, status))
    
    def _on_record_selected(self, event):
        """记录被选中"""
        selection = self.record_tree.selection()
        if not selection:
            return
        
        record_id = selection[0]
        self._load_record_by_id(record_id)
    
    def _load_record_by_id(self, record_id: str):
        """按ID加载记录"""
        record = self.data_store.load_record(record_id)
        if record:
            self.current_record = record
            self._update_ui_with_record()
    
    def _update_ui_with_record(self):
        """用记录数据更新UI"""
        if not self.current_record:
            return
        
        self.record_name_var.set(self.current_record.name)
        self.record_id_label.config(text=self.current_record.record_id)
        
        if self.current_record.start_time:
            self.start_time_label.config(text=self.current_record.start_time.strftime('%Y-%m-%d %H:%M'))
        else:
            self.start_time_label.config(text="-")
        
        if self.current_record.end_time:
            self.end_time_label.config(text=self.current_record.end_time.strftime('%Y-%m-%d %H:%M'))
        else:
            self.end_time_label.config(text="-")
        
        if self.current_record.duration:
            hours = int(self.current_record.duration.total_seconds() // 3600)
            minutes = int((self.current_record.duration.total_seconds() % 3600) // 60)
            self.duration_label.config(text=f"{hours}小时{minutes}分钟")
        else:
            self.duration_label.config(text="-")
        
        self.stats_labels['max_temp'].config(text=f"{self.current_record.max_temperature:.1f}°C")
        self.stats_labels['data_points'].config(text=str(len(self.current_record.temperature_data)))
        self.stats_labels['work_count'].config(text=str(len(self.current_record.work_pieces)))
        self.stats_labels['batch_count'].config(text=str(len(self.current_record.glaze_batches)))
        self.stats_labels['total_risks'].config(text=str(len(self.current_record.risks)))
        self.stats_labels['pending_risks'].config(text=str(len(self.current_record.get_pending_risks())))
        
        self._update_risk_list()
        self._update_data_trees()
        self._generate_timeline()
    
    def _update_risk_list(self):
        """更新风险列表"""
        for item in self.risk_tree.get_children():
            self.risk_tree.delete(item)
        
        if not self.current_record:
            return
        
        filter_value = self.risk_filter_var.get()
        
        for risk in self.current_record.risks:
            if not self._should_show_risk(risk, filter_value):
                continue
            
            level_icon = self._get_level_icon(risk.level)
            time_str = risk.timestamp.strftime('%Y-%m-%d %H:%M') if risk.timestamp else "-"
            
            values = (
                level_icon,
                risk.risk_type.value,
                risk.title,
                risk.description[:60] + "..." if len(risk.description) > 60 else risk.description,
                time_str,
                risk.review_status.value
            )
            
            self.risk_tree.insert("", tk.END, iid=risk.risk_id, values=values)
    
    def _should_show_risk(self, risk: Risk, filter_value: str) -> bool:
        """检查风险是否应该显示"""
        if filter_value == "全部":
            return True
        elif filter_value == "严重":
            return risk.level == RiskLevel.CRITICAL
        elif filter_value == "高":
            return risk.level == RiskLevel.HIGH
        elif filter_value == "中":
            return risk.level == RiskLevel.MEDIUM
        elif filter_value == "低":
            return risk.level == RiskLevel.LOW
        elif filter_value == "待复核":
            return risk.review_status == ReviewStatus.PENDING
        elif filter_value == "已确认":
            return risk.review_status == ReviewStatus.CONFIRMED
        elif filter_value == "已忽略":
            return risk.review_status == ReviewStatus.DISMISSED
        
        return True
    
    def _get_level_icon(self, level: RiskLevel) -> str:
        """获取级别图标"""
        icons = {
            RiskLevel.CRITICAL: "🔴",
            RiskLevel.HIGH: "🟠",
            RiskLevel.MEDIUM: "🟡",
            RiskLevel.LOW: "🟢"
        }
        return icons.get(level, "⚪")
    
    def _filter_risks(self, event=None):
        """过滤风险列表"""
        self._update_risk_list()
    
    def _update_data_trees(self):
        """更新数据树"""
        for tree in [self.temp_tree, self.plan_tree, self.batch_tree, self.work_tree, self.obs_tree]:
            for item in tree.get_children():
                tree.delete(item)
        
        if not self.current_record:
            return
        
        for point in self.current_record.temperature_data:
            values = (
                point.timestamp.strftime('%H:%M:%S'),
                f"{point.avg_temperature:.1f}°C",
                f"{point.max_temperature:.1f}°C",
                f"{point.min_temperature:.1f}°C",
                f"{point.temperature_difference:.1f}°C"
            )
            self.temp_tree.insert("", tk.END, values=values)
        
        if self.current_record.firing_plan:
            for segment in self.current_record.firing_plan.segments:
                hold_time = "-"
                if segment.hold_time:
                    minutes = int(segment.hold_time.total_seconds() // 60)
                    hold_time = f"{minutes}分钟"
                
                values = (
                    segment.name,
                    f"{segment.start_temperature:.0f}°C",
                    f"{segment.end_temperature:.0f}°C",
                    f"{segment.rate:.0f}°C/h",
                    hold_time
                )
                self.plan_tree.insert("", tk.END, values=values)
        
        for batch in self.current_record.glaze_batches:
            quantity = f"{batch.quantity} {batch.unit}" if batch.quantity else "-"
            values = (batch.batch_id, batch.glaze_name, quantity, batch.status)
            self.batch_tree.insert("", tk.END, values=values)
        
        for work in self.current_record.work_pieces:
            values = (
                work.work_id,
                work.title or "-",
                work.artist or "-",
                work.glaze_batch_id or "-",
                work.shelf_layer or "-"
            )
            self.work_tree.insert("", tk.END, values=values)
        
        for obs in self.current_record.observations:
            values = (
                obs.timestamp.strftime('%Y-%m-%d %H:%M'),
                obs.content[:50] + "..." if len(obs.content) > 50 else obs.content,
                obs.author or "-",
                obs.category or "-"
            )
            self.obs_tree.insert("", tk.END, values=values)
    
    def _on_risk_double_click(self, event):
        """风险双击事件"""
        selection = self.risk_tree.selection()
        if not selection or not self.current_record:
            return
        
        risk_id = selection[0]
        risk = None
        
        for r in self.current_record.risks:
            if r.risk_id == risk_id:
                risk = r
                break
        
        if risk:
            self._show_risk_detail(risk)
            self._show_review_dialog(risk)
    
    def _show_risk_detail(self, risk: Risk):
        """显示风险详情"""
        self.detail_text.delete(1.0, tk.END)
        
        detail = f"""风险ID: {risk.risk_id}
风险类型: {risk.risk_type.value}
严重程度: {risk.level.value}
复核状态: {risk.review_status.value}

标题: {risk.title}

描述:
{risk.description}

相关数据:
"""
        self.detail_text.insert(tk.END, detail)
        
        for key, value in risk.related_data.items():
            self.detail_text.insert(tk.END, f"  {key}: {value}\n")
        
        if risk.review_notes:
            self.detail_text.insert(tk.END, f"\n复核备注:\n{risk.review_notes}\n")
        
        if risk.reviewed_by:
            self.detail_text.insert(tk.END, f"\n复核人: {risk.reviewed_by}\n")
            if risk.reviewed_at:
                self.detail_text.insert(tk.END, f"复核时间: {risk.reviewed_at.strftime('%Y-%m-%d %H:%M')}\n")
    
    def _show_review_dialog(self, risk: Risk):
        """显示复核对话框"""
        dialog = tk.Toplevel(self.root)
        dialog.title("复核风险")
        dialog.geometry("450x350")
        dialog.transient(self.root)
        dialog.grab_set()
        
        ttk.Label(dialog, text=f"风险: {risk.title}", font=("Arial", 12, "bold")).pack(pady=10)
        
        ttk.Label(dialog, text="复核状态:").pack(anchor="w", padx=20)
        status_var = tk.StringVar(value=risk.review_status.value)
        status_frame = ttk.Frame(dialog)
        status_frame.pack(fill=tk.X, padx=20, pady=5)
        
        for status in [ReviewStatus.PENDING, ReviewStatus.CONFIRMED, ReviewStatus.DISMISSED, ReviewStatus.RESOLVED]:
            ttk.Radiobutton(
                status_frame, 
                text=status.value,
                value=status.value,
                variable=status_var
            ).pack(side=tk.LEFT, padx=5)
        
        ttk.Label(dialog, text="复核备注:").pack(anchor="w", padx=20, pady=(10, 0))
        notes_text = scrolledtext.ScrolledText(dialog, height=6, width=50)
        notes_text.pack(fill=tk.X, padx=20, pady=5)
        
        if risk.review_notes:
            notes_text.insert(tk.END, risk.review_notes)
        
        def save_review():
            for status in ReviewStatus:
                if status.value == status_var.get():
                    risk.review_status = status
                    break
            
            risk.review_notes = notes_text.get(1.0, tk.END).strip()
            if not risk.review_notes:
                risk.review_notes = None
            
            risk.reviewed_at = datetime.now()
            
            self._update_risk_list()
            if self.current_record:
                self.stats_labels['pending_risks'].config(
                    text=str(len(self.current_record.get_pending_risks()))
                )
            
            dialog.destroy()
        
        btn_frame = ttk.Frame(dialog)
        btn_frame.pack(pady=20)
        
        ttk.Button(btn_frame, text="保存", command=save_review, width=15).pack(side=tk.LEFT, padx=10)
        ttk.Button(btn_frame, text="取消", command=dialog.destroy, width=15).pack(side=tk.LEFT, padx=10)
    
    def _batch_review(self):
        """批量复核"""
        selection = self.risk_tree.selection()
        if not selection:
            messagebox.showinfo("提示", "请先选择要复核的风险")
            return
        
        dialog = tk.Toplevel(self.root)
        dialog.title("批量复核")
        dialog.geometry("400x250")
        dialog.transient(self.root)
        dialog.grab_set()
        
        ttk.Label(dialog, text=f"已选择 {len(selection)} 个风险", font=("Arial", 12)).pack(pady=15)
        
        ttk.Label(dialog, text="设置状态为:").pack(anchor="w", padx=30)
        status_var = tk.StringVar(value=ReviewStatus.CONFIRMED.value)
        
        status_frame = ttk.Frame(dialog)
        status_frame.pack(fill=tk.X, padx=30, pady=10)
        
        for status in [ReviewStatus.CONFIRMED, ReviewStatus.DISMISSED, ReviewStatus.RESOLVED]:
            ttk.Radiobutton(
                status_frame, 
                text=status.value,
                value=status.value,
                variable=status_var
            ).pack(side=tk.LEFT, padx=10)
        
        def apply_batch():
            new_status = None
            for status in ReviewStatus:
                if status.value == status_var.get():
                    new_status = status
                    break
            
            if new_status and self.current_record:
                for risk_id in selection:
                    for risk in self.current_record.risks:
                        if risk.risk_id == risk_id:
                            risk.review_status = new_status
                            risk.reviewed_at = datetime.now()
                            break
                
                self._update_risk_list()
                self.stats_labels['pending_risks'].config(
                    text=str(len(self.current_record.get_pending_risks()))
                )
            
            dialog.destroy()
            messagebox.showinfo("完成", f"已更新 {len(selection)} 个风险的状态")
        
        btn_frame = ttk.Frame(dialog)
        btn_frame.pack(pady=20)
        
        ttk.Button(btn_frame, text="应用", command=apply_batch, width=15).pack(side=tk.LEFT, padx=10)
        ttk.Button(btn_frame, text="取消", command=dialog.destroy, width=15).pack(side=tk.LEFT, padx=10)
    
    def _generate_timeline(self):
        """生成时间线"""
        self.timeline_text.delete(1.0, tk.END)
        
        if not self.current_record:
            self.timeline_text.insert(tk.END, "请先加载或创建烧成记录\n", "header")
            return
        
        self.timeline_text.insert(tk.END, "烧成时间线\n\n", "header")
        
        if not self.current_record.timeline and self.current_record.risks:
            self.current_record.timeline = self.rule_engine.generate_timeline_events(
                self.current_record, 
                self.current_record.risks
            )
        
        if not self.current_record.timeline:
            self.timeline_text.insert(tk.END, "暂无时间线数据\n")
            return
        
        sorted_events = sorted(self.current_record.timeline, key=lambda e: e.timestamp)
        
        for event in sorted_events:
            time_str = event.timestamp.strftime('%Y-%m-%d %H:%M:%S')
            self.timeline_text.insert(tk.END, f"[{time_str}] ", "time")
            
            if event.event_type == "temperature_reading":
                self.timeline_text.insert(tk.END, f"🌡️ {event.title}\n", "temp")
            elif event.event_type == "risk":
                level_tag = "risk_low"
                metadata = event.metadata
                if metadata:
                    level = metadata.get("risk_level", "")
                    if level == "严重":
                        level_tag = "risk_critical"
                    elif level == "高":
                        level_tag = "risk_high"
                    elif level == "中":
                        level_tag = "risk_medium"
                
                self.timeline_text.insert(tk.END, f"⚠️ {event.title}\n", level_tag)
            elif event.event_type == "observation":
                self.timeline_text.insert(tk.END, f"📝 {event.title}\n", "observation")
            else:
                self.timeline_text.insert(tk.END, f"{event.title}\n")
            
            if event.description:
                for line in event.description.split('\n'):
                    self.timeline_text.insert(tk.END, f"    {line}\n")
    
    def _new_record(self):
        """新建记录"""
        dialog = tk.Toplevel(self.root)
        dialog.title("新建烧成记录")
        dialog.geometry("400x150")
        dialog.transient(self.root)
        dialog.grab_set()
        
        ttk.Label(dialog, text="记录名称:").pack(pady=15)
        name_var = tk.StringVar(value=f"烧成记录_{datetime.now().strftime('%Y%m%d')}")
        name_entry = ttk.Entry(dialog, textvariable=name_var, width=40)
        name_entry.pack(pady=5)
        
        def create():
            name = name_var.get().strip()
            if not name:
                messagebox.showwarning("警告", "请输入记录名称")
                return
            
            record_id = f"FR-{datetime.now().strftime('%Y%m%d%H%M%S')}"
            self.current_record = FiringRecord(
                record_id=record_id,
                name=name
            )
            
            self._update_ui_with_record()
            dialog.destroy()
        
        btn_frame = ttk.Frame(dialog)
        btn_frame.pack(pady=15)
        
        ttk.Button(btn_frame, text="创建", command=create, width=15).pack(side=tk.LEFT, padx=10)
        ttk.Button(btn_frame, text="取消", command=dialog.destroy, width=15).pack(side=tk.LEFT, padx=10)
    
    def _save_record(self):
        """保存记录"""
        if not self.current_record:
            messagebox.showwarning("警告", "没有可保存的记录")
            return
        
        name = self.record_name_var.get().strip()
        if name:
            self.current_record.name = name
        
        try:
            self.data_store.save_record(self.current_record)
            self._refresh_record_list()
            messagebox.showinfo("成功", "记录已保存")
        except Exception as e:
            messagebox.showerror("错误", f"保存失败: {str(e)}")
    
    def _load_record(self):
        """加载记录"""
        file_path = filedialog.askopenfilename(
            title="选择记录文件",
            filetypes=[("JSON文件", "*.json"), ("所有文件", "*.*")]
        )
        
        if file_path:
            record_id = Path(file_path).stem
            self._load_record_by_id(record_id)
    
    def _delete_record(self):
        """删除记录"""
        selection = self.record_tree.selection()
        if not selection:
            messagebox.showinfo("提示", "请先选择要删除的记录")
            return
        
        record_id = selection[0]
        summary = self.data_store.get_record_summary(record_id)
        name = summary.get('name', record_id) if summary else record_id
        
        if messagebox.askyesno("确认删除", f"确定要删除记录 '{name}' 吗？\n删除前会自动创建备份。"):
            if self.data_store.delete_record(record_id):
                self._refresh_record_list()
                if self.current_record and self.current_record.record_id == record_id:
                    self.current_record = None
                messagebox.showinfo("成功", "记录已删除（已备份）")
            else:
                messagebox.showerror("错误", "删除失败")
    
    def _import_temperature(self):
        """导入温度数据"""
        if not self.current_record:
            messagebox.showwarning("警告", "请先创建或加载记录")
            return
        
        file_path = filedialog.askopenfilename(
            title="选择温度数据文件",
            filetypes=[("CSV文件", "*.csv"), ("所有文件", "*.*")]
        )
        
        if file_path:
            parser = TemperatureParser()
            points = parser.parse(file_path)
            
            if parser.has_errors():
                messagebox.showerror("错误", "\n".join(parser.get_errors()))
                return
            
            self.current_record.temperature_data = points
            
            if parser.has_warnings():
                messagebox.showwarning("警告", "\n".join(parser.get_warnings()))
            
            messagebox.showinfo("成功", f"成功导入 {len(points)} 个温度数据点")
            self._update_ui_with_record()
    
    def _import_firing_plan(self):
        """导入烧成计划"""
        if not self.current_record:
            messagebox.showwarning("警告", "请先创建或加载记录")
            return
        
        file_path = filedialog.askopenfilename(
            title="选择烧成计划文件",
            filetypes=[("JSON文件", "*.json"), ("所有文件", "*.*")]
        )
        
        if file_path:
            parser = FiringPlanParser()
            plan = parser.parse(file_path)
            
            if parser.has_errors():
                messagebox.showerror("错误", "\n".join(parser.get_errors()))
                return
            
            if plan:
                self.current_record.firing_plan = plan
                messagebox.showinfo("成功", f"成功导入烧成计划: {plan.name}")
                self._update_ui_with_record()
            
            if parser.has_warnings():
                messagebox.showwarning("警告", "\n".join(parser.get_warnings()))
    
    def _import_glaze_batches(self):
        """导入釉料批次"""
        if not self.current_record:
            messagebox.showwarning("警告", "请先创建或加载记录")
            return
        
        file_path = filedialog.askopenfilename(
            title="选择釉料批次文件",
            filetypes=[("CSV文件", "*.csv"), ("所有文件", "*.*")]
        )
        
        if file_path:
            parser = GlazeBatchParser()
            batches = parser.parse(file_path)
            
            if parser.has_errors():
                messagebox.showerror("错误", "\n".join(parser.get_errors()))
                return
            
            self.current_record.glaze_batches = batches
            
            if parser.has_warnings():
                messagebox.showwarning("警告", "\n".join(parser.get_warnings()))
            
            messagebox.showinfo("成功", f"成功导入 {len(batches)} 个釉料批次")
            self._update_ui_with_record()
    
    def _import_work_pieces(self):
        """导入作品列表"""
        if not self.current_record:
            messagebox.showwarning("警告", "请先创建或加载记录")
            return
        
        file_path = filedialog.askopenfilename(
            title="选择作品列表文件",
            filetypes=[("CSV文件", "*.csv"), ("所有文件", "*.*")]
        )
        
        if file_path:
            parser = WorkPieceParser()
            works = parser.parse(file_path)
            
            if parser.has_errors():
                messagebox.showerror("错误", "\n".join(parser.get_errors()))
                return
            
            self.current_record.work_pieces = works
            
            if parser.has_warnings():
                messagebox.showwarning("警告", "\n".join(parser.get_warnings()))
            
            messagebox.showinfo("成功", f"成功导入 {len(works)} 个作品")
            self._update_ui_with_record()
    
    def _import_observations(self):
        """导入观察备注"""
        if not self.current_record:
            messagebox.showwarning("警告", "请先创建或加载记录")
            return
        
        file_path = filedialog.askopenfilename(
            title="选择观察备注文件",
            filetypes=[("CSV文件", "*.csv"), ("文本文件", "*.txt"), ("所有文件", "*.*")]
        )
        
        if file_path:
            parser = ObservationParser()
            observations = parser.parse(file_path)
            
            if parser.has_errors():
                messagebox.showerror("错误", "\n".join(parser.get_errors()))
                return
            
            self.current_record.observations = observations
            
            if parser.has_warnings():
                messagebox.showwarning("警告", "\n".join(parser.get_warnings()))
            
            messagebox.showinfo("成功", f"成功导入 {len(observations)} 条观察备注")
            self._update_ui_with_record()
    
    def _run_analysis(self):
        """执行规则检查"""
        if not self.current_record:
            messagebox.showwarning("警告", "请先创建或加载记录")
            return
        
        if not self.current_record.temperature_data and not self.current_record.work_pieces:
            messagebox.showwarning("警告", "没有可分析的数据，请先导入温度数据或作品信息")
            return
        
        risks = self.rule_engine.check_all(self.current_record)
        self.current_record.risks = risks
        
        warnings = self.rule_engine.get_rule_warnings()
        if warnings:
            warn_msg = []
            for rule_name, msgs in warnings.items():
                warn_msg.append(f"[{rule_name}]")
                warn_msg.extend(msgs)
            messagebox.showwarning("分析警告", "\n".join(warn_msg))
        
        summary = self.rule_engine.get_risk_summary(risks)
        
        if risks:
            self.current_record.timeline = self.rule_engine.generate_timeline_events(
                self.current_record, risks
            )
            
            msg = f"分析完成！\n\n"
            msg += f"发现问题: {summary['total_risks']} 个\n"
            msg += f"  严重: {summary['by_level'].get('严重', 0)}\n"
            msg += f"  高: {summary['by_level'].get('高', 0)}\n"
            msg += f"  中: {summary['by_level'].get('中', 0)}\n"
            msg += f"  低: {summary['by_level'].get('低', 0)}"
            
            messagebox.showinfo("分析完成", msg)
        else:
            messagebox.showinfo("分析完成", "未发现任何问题！")
        
        self._update_ui_with_record()
    
    def _export_markdown(self):
        """导出Markdown报告"""
        if not self.current_record:
            messagebox.showwarning("警告", "没有可导出的记录")
            return
        
        default_name = f"{self.current_record.name}_复盘报告.md"
        file_path = filedialog.asksaveasfilename(
            title="保存Markdown报告",
            defaultextension=".md",
            initialfile=default_name,
            filetypes=[("Markdown文件", "*.md"), ("所有文件", "*.*")]
        )
        
        if file_path:
            try:
                exporter = MarkdownExporter()
                exporter.export(self.current_record, file_path)
                messagebox.showinfo("成功", f"报告已导出到:\n{file_path}")
            except Exception as e:
                messagebox.showerror("错误", f"导出失败: {str(e)}")
    
    def _export_csv_risks(self):
        """导出CSV问题清单"""
        if not self.current_record:
            messagebox.showwarning("警告", "没有可导出的记录")
            return
        
        default_name = f"{self.current_record.name}_问题清单.csv"
        file_path = filedialog.asksaveasfilename(
            title="保存问题清单",
            defaultextension=".csv",
            initialfile=default_name,
            filetypes=[("CSV文件", "*.csv"), ("所有文件", "*.*")]
        )
        
        if file_path:
            try:
                exporter = CSVExporter()
                exporter.export_risks(self.current_record, file_path, include_resolved=True)
                messagebox.showinfo("成功", f"问题清单已导出到:\n{file_path}")
            except Exception as e:
                messagebox.showerror("错误", f"导出失败: {str(e)}")
    
    def _show_about(self):
        """显示关于对话框"""
        about_text = """窑烧曲线复盘台 v1.0.0

一款专为陶艺工作室主理人设计的
窑烧数据管理与分析工具

功能特性:
• 导入温度数据、烧成计划、釉料批次
• 自动检测升温速率、保温时间、温差问题
• 釉料批次与作品匹配检查
• 人工复核与本地保存
• 导出Markdown报告和CSV问题清单

© 2024 窑烧曲线复盘台开发团队
"""
        messagebox.showinfo("关于", about_text)
