import tkinter as tk
from tkinter import ttk, filedialog, messagebox, scrolledtext
from pathlib import Path
from typing import List, Optional, Dict, Any
from datetime import datetime
import sys

sys.path.insert(0, str(Path(__file__).parent.parent))

from models import (
    Student, ScreeningResult, DeviceLog, CalibrationCertificate,
    ValidationIssue, ReviewStatus, IssueType, IssueSeverity
)
from parsers import (
    parse_students_csv,
    parse_screening_results_json,
    parse_device_logs_json,
    parse_calibration_certificate
)
from validators import run_all_validations, ValidatorEngine, ValidationSummary
from storage import StorageManager, ReviewState
from exporters import (
    export_markdown_report,
    export_csv_issues,
    export_json_audit
)
from config import APP_NAME, APP_VERSION


class MainWindow:
    def __init__(self, root: tk.Tk):
        self.root = root
        self.root.title(f"{APP_NAME} v{APP_VERSION}")
        self.root.geometry("1200x800")
        self.root.minsize(1000, 700)
        
        self.storage = StorageManager()
        self.current_state: ReviewState = self.storage.get_current_state()
        self.last_summary: Optional[ValidationSummary] = None
        self.current_issues: List[ValidationIssue] = []
        
        self._setup_styles()
        self._create_menu()
        self._create_notebook()
        self._create_status_bar()
        
        self._load_initial_state()
    
    def _setup_styles(self):
        style = ttk.Style()
        style.configure("Title.TLabel", font=("Microsoft YaHei UI", 14, "bold"))
        style.configure("Heading.TLabel", font=("Microsoft YaHei UI", 11, "bold"))
        style.configure("Info.TLabel", font=("Microsoft YaHei UI", 10))
        style.configure("Critical.TLabel", foreground="#dc3545", font=("Microsoft YaHei UI", 10, "bold"))
        style.configure("High.TLabel", foreground="#fd7e14", font=("Microsoft YaHei UI", 10, "bold"))
        style.configure("Medium.TLabel", foreground="#ffc107", font=("Microsoft YaHei UI", 10, "bold"))
        style.configure("Low.TLabel", foreground="#28a745", font=("Microsoft YaHei UI", 10, "bold"))
        style.configure("Success.TLabel", foreground="#28a745", font=("Microsoft YaHei UI", 10))
    
    def _create_menu(self):
        menubar = tk.Menu(self.root)
        self.root.config(menu=menubar)
        
        file_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="文件(F)", menu=file_menu, underline=3)
        
        file_menu.add_command(label="新建会话", command=self._new_session)
        file_menu.add_separator()
        file_menu.add_command(label="保存状态", command=self._save_state)
        file_menu.add_command(label="加载状态", command=self._load_state_dialog)
        file_menu.add_separator()
        file_menu.add_command(label="导出报告", command=self._export_report_dialog)
        file_menu.add_command(label="导出问题清单", command=self._export_csv_dialog)
        file_menu.add_command(label="导出审计包", command=self._export_audit_dialog)
        file_menu.add_separator()
        file_menu.add_command(label="退出", command=self.root.quit)
        
        edit_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="编辑(E)", menu=edit_menu, underline=3)
        
        edit_menu.add_command(label="清空所有数据", command=self._clear_all_data)
        edit_menu.add_separator()
        edit_menu.add_command(label="重新校验", command=self._run_validation)
        
        help_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="帮助(H)", menu=help_menu, underline=3)
        
        help_menu.add_command(label="关于", command=self._show_about)
    
    def _create_notebook(self):
        self.notebook = ttk.Notebook(self.root)
        self.notebook.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)
        
        self._create_import_tab()
        self._create_overview_tab()
        self._create_issues_tab()
        self._create_review_tab()
        self._create_export_tab()
    
    def _create_import_tab(self):
        import_frame = ttk.Frame(self.notebook, padding=10)
        self.notebook.add(import_frame, text="  📂 导入文件  ")
        
        title_label = ttk.Label(import_frame, text="数据导入", style="Title.TLabel")
        title_label.pack(anchor=tk.W, pady=(0, 10))
        
        desc_label = ttk.Label(
            import_frame, 
            text="导入学生名单CSV、筛查结果JSON、设备日志JSON和校准证书文件。支持多种格式自动解析。",
            style="Info.TLabel",
            wraplength=800
        )
        desc_label.pack(anchor=tk.W, pady=(0, 15))
        
        file_frame = ttk.LabelFrame(import_frame, text="文件导入", padding=10)
        file_frame.pack(fill=tk.X, pady=5)
        
        btn_frame = ttk.Frame(file_frame)
        btn_frame.pack(fill=tk.X)
        
        ttk.Button(btn_frame, text="导入学生名单 (CSV)", command=self._import_students).pack(side=tk.LEFT, padx=5)
        ttk.Button(btn_frame, text="导入筛查结果 (JSON)", command=self._import_screening_results).pack(side=tk.LEFT, padx=5)
        ttk.Button(btn_frame, text="导入设备日志 (JSON)", command=self._import_device_logs).pack(side=tk.LEFT, padx=5)
        ttk.Button(btn_frame, text="导入校准证书 (JSON/TXT)", command=self._import_certificate).pack(side=tk.LEFT, padx=5)
        
        list_frame = ttk.LabelFrame(import_frame, text="已导入文件", padding=10)
        list_frame.pack(fill=tk.BOTH, expand=True, pady=10)
        
        columns = ("filename", "filetype", "count", "import_time")
        self.import_tree = ttk.Treeview(list_frame, columns=columns, show="headings", height=8)
        
        self.import_tree.heading("filename", text="文件名")
        self.import_tree.heading("filetype", text="文件类型")
        self.import_tree.heading("count", text="记录数")
        self.import_tree.heading("import_time", text="导入时间")
        
        self.import_tree.column("filename", width=250)
        self.import_tree.column("filetype", width=120)
        self.import_tree.column("count", width=80, anchor=tk.CENTER)
        self.import_tree.column("import_time", width=180)
        
        scrollbar = ttk.Scrollbar(list_frame, orient=tk.VERTICAL, command=self.import_tree.yview)
        self.import_tree.configure(yscrollcommand=scrollbar.set)
        
        self.import_tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
        
        status_frame = ttk.LabelFrame(import_frame, text="数据统计", padding=10)
        status_frame.pack(fill=tk.X, pady=10)
        
        self.import_status_labels: Dict[str, ttk.Label] = {}
        
        status_items = [
            ("students", "学生数:", "0"),
            ("results", "筛查结果:", "0"),
            ("logs", "设备日志:", "0"),
            ("certificates", "校准证书:", "0"),
        ]
        
        for idx, (key, label_text, default) in enumerate(status_items):
            frame = ttk.Frame(status_frame)
            frame.pack(side=tk.LEFT, padx=30)
            
            ttk.Label(frame, text=label_text, style="Info.TLabel").pack(side=tk.LEFT)
            value_label = ttk.Label(frame, text=default, style="Info.TLabel")
            value_label.pack(side=tk.LEFT, padx=5)
            self.import_status_labels[key] = value_label
        
        action_frame = ttk.Frame(import_frame)
        action_frame.pack(fill=tk.X, pady=10)
        
        ttk.Button(action_frame, text="🔄 开始校验", command=self._run_validation, 
                   style="Accent.TButton").pack(side=tk.RIGHT, padx=5)
        ttk.Button(action_frame, text="🗑️ 清空数据", command=self._clear_all_data).pack(side=tk.RIGHT, padx=5)
    
    def _create_overview_tab(self):
        overview_frame = ttk.Frame(self.notebook, padding=10)
        self.notebook.add(overview_frame, text="  📊 数据概览  ")
        
        title_label = ttk.Label(overview_frame, text="数据概览", style="Title.TLabel")
        title_label.pack(anchor=tk.W, pady=(0, 10))
        
        notebook = ttk.Notebook(overview_frame)
        notebook.pack(fill=tk.BOTH, expand=True)
        
        students_frame = ttk.Frame(notebook, padding=10)
        notebook.add(students_frame, text=" 学生名单 ")
        
        columns = ("student_id", "name", "gender", "age", "grade", "class_name", "has_result")
        self.students_tree = ttk.Treeview(students_frame, columns=columns, show="headings", height=15)
        
        self.students_tree.heading("student_id", text="学生ID")
        self.students_tree.heading("name", text="姓名")
        self.students_tree.heading("gender", text="性别")
        self.students_tree.heading("age", text="年龄")
        self.students_tree.heading("grade", text="年级")
        self.students_tree.heading("class_name", text="班级")
        self.students_tree.heading("has_result", text="有结果")
        
        self.students_tree.column("student_id", width=100)
        self.students_tree.column("name", width=100)
        self.students_tree.column("gender", width=60, anchor=tk.CENTER)
        self.students_tree.column("age", width=60, anchor=tk.CENTER)
        self.students_tree.column("grade", width=80)
        self.students_tree.column("class_name", width=80)
        self.students_tree.column("has_result", width=80, anchor=tk.CENTER)
        
        scrollbar1 = ttk.Scrollbar(students_frame, orient=tk.VERTICAL, command=self.students_tree.yview)
        self.students_tree.configure(yscrollcommand=scrollbar1.set)
        
        self.students_tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scrollbar1.pack(side=tk.RIGHT, fill=tk.Y)
        
        results_frame = ttk.Frame(notebook, padding=10)
        notebook.add(results_frame, text=" 筛查结果 ")
        
        columns = ("screening_id", "student_id", "name", "device_id", "date", "status", "left_max", "right_max")
        self.results_tree = ttk.Treeview(results_frame, columns=columns, show="headings", height=15)
        
        self.results_tree.heading("screening_id", text="筛查ID")
        self.results_tree.heading("student_id", text="学生ID")
        self.results_tree.heading("name", text="姓名")
        self.results_tree.heading("device_id", text="设备ID")
        self.results_tree.heading("date", text="筛查日期")
        self.results_tree.heading("status", text="结果状态")
        self.results_tree.heading("left_max", text="左耳最大阈值")
        self.results_tree.heading("right_max", text="右耳最大阈值")
        
        self.results_tree.column("screening_id", width=120)
        self.results_tree.column("student_id", width=100)
        self.results_tree.column("name", width=100)
        self.results_tree.column("device_id", width=100)
        self.results_tree.column("date", width=140)
        self.results_tree.column("status", width=80)
        self.results_tree.column("left_max", width=100, anchor=tk.CENTER)
        self.results_tree.column("right_max", width=100, anchor=tk.CENTER)
        
        scrollbar2 = ttk.Scrollbar(results_frame, orient=tk.VERTICAL, command=self.results_tree.yview)
        self.results_tree.configure(yscrollcommand=scrollbar2.set)
        
        self.results_tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scrollbar2.pack(side=tk.RIGHT, fill=tk.Y)
        
        devices_frame = ttk.Frame(notebook, padding=10)
        notebook.add(devices_frame, text=" 设备与校准 ")
        
        columns = ("device_id", "calibration_date", "valid_until", "status", "days_remaining", "log_count")
        self.devices_tree = ttk.Treeview(devices_frame, columns=columns, show="headings", height=15)
        
        self.devices_tree.heading("device_id", text="设备ID")
        self.devices_tree.heading("calibration_date", text="校准日期")
        self.devices_tree.heading("valid_until", text="有效期至")
        self.devices_tree.heading("status", text="状态")
        self.devices_tree.heading("days_remaining", text="剩余天数")
        self.devices_tree.heading("log_count", text="日志条数")
        
        self.devices_tree.column("device_id", width=120)
        self.devices_tree.column("calibration_date", width=120)
        self.devices_tree.column("valid_until", width=120)
        self.devices_tree.column("status", width=100, anchor=tk.CENTER)
        self.devices_tree.column("days_remaining", width=100, anchor=tk.CENTER)
        self.devices_tree.column("log_count", width=100, anchor=tk.CENTER)
        
        scrollbar3 = ttk.Scrollbar(devices_frame, orient=tk.VERTICAL, command=self.devices_tree.yview)
        self.devices_tree.configure(yscrollcommand=scrollbar3.set)
        
        self.devices_tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scrollbar3.pack(side=tk.RIGHT, fill=tk.Y)
    
    def _create_issues_tab(self):
        issues_frame = ttk.Frame(self.notebook, padding=10)
        self.notebook.add(issues_frame, text="  ⚠️ 校验问题  ")
        
        title_frame = ttk.Frame(issues_frame)
        title_frame.pack(fill=tk.X, pady=(0, 10))
        
        ttk.Label(title_frame, text="校验问题", style="Title.TLabel").pack(side=tk.LEFT)
        
        self.issues_summary_label = ttk.Label(title_frame, text="", style="Info.TLabel")
        self.issues_summary_label.pack(side=tk.LEFT, padx=20)
        
        filter_frame = ttk.LabelFrame(issues_frame, text="筛选条件", padding=10)
        filter_frame.pack(fill=tk.X, pady=5)
        
        ttk.Label(filter_frame, text="严重程度:", style="Info.TLabel").pack(side=tk.LEFT, padx=5)
        self.severity_filter = ttk.Combobox(filter_frame, values=["全部", "严重", "高", "中", "低"], width=10, state="readonly")
        self.severity_filter.set("全部")
        self.severity_filter.pack(side=tk.LEFT, padx=5)
        self.severity_filter.bind("<<ComboboxSelected>>", lambda e: self._filter_issues())
        
        ttk.Label(filter_frame, text="问题类型:", style="Info.TLabel").pack(side=tk.LEFT, padx=(20, 5))
        self.type_filter = ttk.Combobox(filter_frame, values=["全部"], width=15, state="readonly")
        self.type_filter.set("全部")
        self.type_filter.pack(side=tk.LEFT, padx=5)
        self.type_filter.bind("<<ComboboxSelected>>", lambda e: self._filter_issues())
        
        ttk.Label(filter_frame, text="复核状态:", style="Info.TLabel").pack(side=tk.LEFT, padx=(20, 5))
        self.review_filter = ttk.Combobox(filter_frame, values=["全部", "未复核", "确认问题", "排除问题", "已解决"], width=12, state="readonly")
        self.review_filter.set("全部")
        self.review_filter.pack(side=tk.LEFT, padx=5)
        self.review_filter.bind("<<ComboboxSelected>>", lambda e: self._filter_issues())
        
        ttk.Button(filter_frame, text="刷新", command=self._refresh_issues_tree).pack(side=tk.RIGHT, padx=10)
        
        list_frame = ttk.Frame(issues_frame)
        list_frame.pack(fill=tk.BOTH, expand=True, pady=10)
        
        columns = ("severity", "type", "title", "affected", "review_status", "id")
        self.issues_tree = ttk.Treeview(list_frame, columns=columns, show="headings", height=15)
        
        self.issues_tree.heading("severity", text="严重程度")
        self.issues_tree.heading("type", text="问题类型")
        self.issues_tree.heading("title", text="标题")
        self.issues_tree.heading("affected", text="涉及对象")
        self.issues_tree.heading("review_status", text="复核状态")
        self.issues_tree.heading("id", text="问题ID")
        
        self.issues_tree.column("severity", width=80, anchor=tk.CENTER)
        self.issues_tree.column("type", width=120)
        self.issues_tree.column("title", width=350)
        self.issues_tree.column("affected", width=150)
        self.issues_tree.column("review_status", width=100, anchor=tk.CENTER)
        self.issues_tree.column("id", width=100)
        
        scrollbar = ttk.Scrollbar(list_frame, orient=tk.VERTICAL, command=self.issues_tree.yview)
        self.issues_tree.configure(yscrollcommand=scrollbar.set)
        
        self.issues_tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
        
        self.issues_tree.bind("<<TreeviewSelect>>", self._on_issue_select)
        
        detail_frame = ttk.LabelFrame(issues_frame, text="问题详情", padding=10)
        detail_frame.pack(fill=tk.X, pady=5)
        
        self.issue_detail_text = scrolledtext.ScrolledText(detail_frame, height=5, wrap=tk.WORD, font=("Microsoft YaHei UI", 10))
        self.issue_detail_text.pack(fill=tk.X)
    
    def _create_review_tab(self):
        review_frame = ttk.Frame(self.notebook, padding=10)
        self.notebook.add(review_frame, text="  ✅ 问题复核  ")
        
        title_label = ttk.Label(review_frame, text="问题复核", style="Title.TLabel")
        title_label.pack(anchor=tk.W, pady=(0, 10))
        
        desc_label = ttk.Label(
            review_frame,
            text="对校验发现的问题进行人工复核。确认问题需要跟进，排除问题为误报，或标记为已解决。",
            style="Info.TLabel",
            wraplength=800
        )
        desc_label.pack(anchor=tk.W, pady=(0, 15))
        
        list_frame = ttk.LabelFrame(review_frame, text="待复核问题", padding=10)
        list_frame.pack(fill=tk.BOTH, expand=True, pady=5)
        
        columns = ("select", "severity", "title", "affected", "description", "current_status")
        self.review_tree = ttk.Treeview(list_frame, columns=columns, show="headings", height=10)
        
        self.review_tree.heading("select", text="选择")
        self.review_tree.heading("severity", text="严重程度")
        self.review_tree.heading("title", text="标题")
        self.review_tree.heading("affected", text="涉及对象")
        self.review_tree.heading("description", text="描述")
        self.review_tree.heading("current_status", text="当前状态")
        
        self.review_tree.column("select", width=50, anchor=tk.CENTER)
        self.review_tree.column("severity", width=80, anchor=tk.CENTER)
        self.review_tree.column("title", width=200)
        self.review_tree.column("affected", width=120)
        self.review_tree.column("description", width=350)
        self.review_tree.column("current_status", width=100, anchor=tk.CENTER)
        
        scrollbar = ttk.Scrollbar(list_frame, orient=tk.VERTICAL, command=self.review_tree.yview)
        self.review_tree.configure(yscrollcommand=scrollbar.set)
        
        self.review_tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
        
        review_action_frame = ttk.LabelFrame(review_frame, text="复核操作", padding=10)
        review_action_frame.pack(fill=tk.X, pady=10)
        
        ttk.Label(review_action_frame, text="复核备注:", style="Info.TLabel").pack(side=tk.LEFT, padx=5)
        self.review_notes_entry = ttk.Entry(review_action_frame, width=50)
        self.review_notes_entry.pack(side=tk.LEFT, padx=5)
        
        ttk.Label(review_action_frame, text="复核人:", style="Info.TLabel").pack(side=tk.LEFT, padx=(20, 5))
        self.reviewer_entry = ttk.Entry(review_action_frame, width=20)
        self.reviewer_entry.pack(side=tk.LEFT, padx=5)
        
        btn_frame = ttk.Frame(review_frame)
        btn_frame.pack(fill=tk.X, pady=10)
        
        ttk.Button(btn_frame, text="✅ 确认问题", command=lambda: self._mark_issues(ReviewStatus.CONFIRMED)).pack(side=tk.LEFT, padx=5)
        ttk.Button(btn_frame, text="❌ 排除问题", command=lambda: self._mark_issues(ReviewStatus.REJECTED)).pack(side=tk.LEFT, padx=5)
        ttk.Button(btn_frame, text="✓ 已解决", command=lambda: self._mark_issues(ReviewStatus.RESOLVED)).pack(side=tk.LEFT, padx=5)
        ttk.Button(btn_frame, text="↩️ 重置为未复核", command=lambda: self._mark_issues(ReviewStatus.UNREVIEWED)).pack(side=tk.LEFT, padx=5)
        
        ttk.Button(btn_frame, text="刷新列表", command=self._refresh_review_tree).pack(side=tk.RIGHT, padx=5)
        ttk.Button(btn_frame, text="全选", command=self._select_all_review).pack(side=tk.RIGHT, padx=5)
    
    def _create_export_tab(self):
        export_frame = ttk.Frame(self.notebook, padding=10)
        self.notebook.add(export_frame, text="  📤 导出报告  ")
        
        title_label = ttk.Label(export_frame, text="数据导出", style="Title.TLabel")
        title_label.pack(anchor=tk.W, pady=(0, 10))
        
        desc_label = ttk.Label(
            export_frame,
            text="导出Markdown交付报告、CSV问题清单和JSON审计包。导出文件可用于存档、汇报和审计追踪。",
            style="Info.TLabel",
            wraplength=800
        )
        desc_label.pack(anchor=tk.W, pady=(0, 20))
        
        export_options_frame = ttk.LabelFrame(export_frame, text="导出选项", padding=15)
        export_options_frame.pack(fill=tk.X, pady=10)
        
        options_frame = ttk.Frame(export_options_frame)
        options_frame.pack(fill=tk.X)
        
        self.include_raw_var = tk.BooleanVar(value=True)
        ttk.Checkbutton(options_frame, text="导出时包含原始数据", variable=self.include_raw_var).pack(side=tk.LEFT)
        
        ttk.Label(options_frame, text="会话名称:", style="Info.TLabel").pack(side=tk.LEFT, padx=(30, 5))
        self.session_name_entry = ttk.Entry(options_frame, width=30)
        self.session_name_entry.insert(0, "默认会话")
        self.session_name_entry.pack(side=tk.LEFT, padx=5)
        
        buttons_frame = ttk.Frame(export_frame)
        buttons_frame.pack(fill=tk.X, pady=20)
        
        md_frame = ttk.LabelFrame(buttons_frame, text="Markdown 交付报告", padding=10)
        md_frame.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, padx=5)
        
        ttk.Label(
            md_frame,
            text="生成完整的交付报告，包含数据概览、问题汇总、设备状态和筛查统计。",
            style="Info.TLabel",
            wraplength=300
        ).pack(pady=5)
        ttk.Button(md_frame, text="导出 Markdown 报告", command=self._export_report_dialog).pack(pady=10)
        
        csv_frame = ttk.LabelFrame(buttons_frame, text="CSV 问题清单", padding=10)
        csv_frame.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, padx=5)
        
        ttk.Label(
            csv_frame,
            text="导出问题列表为CSV格式，便于在Excel中查看和筛选。",
            style="Info.TLabel",
            wraplength=300
        ).pack(pady=5)
        ttk.Button(csv_frame, text="导出 CSV 问题清单", command=self._export_csv_dialog).pack(pady=10)
        
        json_frame = ttk.LabelFrame(buttons_frame, text="JSON 审计包", padding=10)
        json_frame.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, padx=5)
        
        ttk.Label(
            json_frame,
            text="导出完整的审计数据包，包含所有原始数据和复核记录。用于存档和审计追踪。",
            style="Info.TLabel",
            wraplength=300
        ).pack(pady=5)
        ttk.Button(json_frame, text="导出 JSON 审计包", command=self._export_audit_dialog).pack(pady=10)
        
        status_frame = ttk.LabelFrame(export_frame, text="导出状态", padding=10)
        status_frame.pack(fill=tk.X, pady=10)
        
        self.export_status_label = ttk.Label(status_frame, text="就绪 - 请选择要导出的格式", style="Info.TLabel")
        self.export_status_label.pack(anchor=tk.W)
    
    def _create_status_bar(self):
        self.status_bar = ttk.Frame(self.root)
        self.status_bar.pack(side=tk.BOTTOM, fill=tk.X)
        
        self.status_label = ttk.Label(self.status_bar, text="就绪", relief=tk.SUNKEN, anchor=tk.W)
        self.status_label.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=5, pady=2)
        
        self.time_label = ttk.Label(self.status_bar, text=datetime.now().strftime("%Y-%m-%d %H:%M:%S"), 
                                    relief=tk.SUNKEN, anchor=tk.E)
        self.time_label.pack(side=tk.RIGHT, padx=5, pady=2)
        
        self._update_time()
    
    def _update_time(self):
        self.time_label.config(text=datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
        self.root.after(1000, self._update_time)
    
    def _load_initial_state(self):
        self._refresh_import_status()
        self._refresh_overview_tables()
    
    def _update_status(self, message: str):
        self.status_label.config(text=message)
    
    def _import_students(self):
        file_path = filedialog.askopenfilename(
            title="选择学生名单CSV文件",
            filetypes=[("CSV文件", "*.csv"), ("所有文件", "*.*")]
        )
        if not file_path:
            return
        
        path = Path(file_path)
        students, errors = parse_students_csv(path)
        
        if errors:
            messagebox.showwarning("导入警告", f"导入过程中发现问题:\n" + "\n".join(errors[:10]))
        
        if students:
            self.current_state.students.extend(students)
            self.storage.add_imported_file(path, "students", len(students))
            self._update_status(f"成功导入 {len(students)} 名学生")
            self._refresh_import_status()
            self._refresh_overview_tables()
            self._save_state()
        else:
            messagebox.showerror("导入失败", "未能从文件中解析出任何学生数据")
    
    def _import_screening_results(self):
        file_path = filedialog.askopenfilename(
            title="选择筛查结果JSON文件",
            filetypes=[("JSON文件", "*.json"), ("所有文件", "*.*")]
        )
        if not file_path:
            return
        
        path = Path(file_path)
        results, errors = parse_screening_results_json(path)
        
        if errors:
            messagebox.showwarning("导入警告", f"导入过程中发现问题:\n" + "\n".join(errors[:10]))
        
        if results:
            self.current_state.screening_results.extend(results)
            self.storage.add_imported_file(path, "screening_results", len(results))
            self._update_status(f"成功导入 {len(results)} 条筛查结果")
            self._refresh_import_status()
            self._refresh_overview_tables()
            self._save_state()
        else:
            messagebox.showerror("导入失败", "未能从文件中解析出任何筛查结果")
    
    def _import_device_logs(self):
        file_path = filedialog.askopenfilename(
            title="选择设备日志JSON文件",
            filetypes=[("JSON文件", "*.json"), ("所有文件", "*.*")]
        )
        if not file_path:
            return
        
        path = Path(file_path)
        logs, errors = parse_device_logs_json(path)
        
        if errors:
            messagebox.showwarning("导入警告", f"导入过程中发现问题:\n" + "\n".join(errors[:10]))
        
        if logs:
            self.current_state.device_logs.extend(logs)
            self.storage.add_imported_file(path, "device_logs", len(logs))
            self._update_status(f"成功导入 {len(logs)} 条设备日志")
            self._refresh_import_status()
            self._refresh_overview_tables()
            self._save_state()
        else:
            messagebox.showerror("导入失败", "未能从文件中解析出任何设备日志")
    
    def _import_certificate(self):
        file_path = filedialog.askopenfilename(
            title="选择校准证书文件",
            filetypes=[("JSON文件", "*.json"), ("文本文件", "*.txt"), ("所有文件", "*.*")]
        )
        if not file_path:
            return
        
        path = Path(file_path)
        certificates, errors = parse_calibration_certificate(path)
        
        if errors:
            messagebox.showwarning("导入警告", f"导入过程中发现问题:\n" + "\n".join(errors[:10]))
        
        if certificates:
            self.current_state.certificates.extend(certificates)
            self.storage.add_imported_file(path, "certificates", len(certificates))
            self._update_status(f"成功导入 {len(certificates)} 份校准证书")
            self._refresh_import_status()
            self._refresh_overview_tables()
            self._save_state()
        else:
            messagebox.showerror("导入失败", "未能从文件中解析出任何校准证书")
    
    def _refresh_import_status(self):
        state = self.current_state
        
        self.import_status_labels["students"].config(text=str(len(state.students)))
        self.import_status_labels["results"].config(text=str(len(state.screening_results)))
        self.import_status_labels["logs"].config(text=str(len(state.device_logs)))
        self.import_status_labels["certificates"].config(text=str(len(state.certificates)))
        
        for item in self.import_tree.get_children():
            self.import_tree.delete(item)
        
        for imported_file in state.imported_files:
            filetype_names = {
                "students": "学生名单",
                "screening_results": "筛查结果",
                "device_logs": "设备日志",
                "certificates": "校准证书",
            }
            filetype_display = filetype_names.get(imported_file.file_type, imported_file.file_type)
            
            self.import_tree.insert("", tk.END, values=(
                imported_file.file_name,
                filetype_display,
                imported_file.record_count,
                imported_file.import_timestamp.strftime("%Y-%m-%d %H:%M:%S")
            ))
    
    def _refresh_overview_tables(self):
        state = self.current_state
        
        for item in self.students_tree.get_children():
            self.students_tree.delete(item)
        
        student_ids_with_results = set()
        for r in state.screening_results:
            student_ids_with_results.add(r.student_id)
        
        for student in state.students:
            has_result = "✓" if student.student_id in student_ids_with_results else "-"
            self.students_tree.insert("", tk.END, values=(
                student.student_id,
                student.name or "-",
                student.gender or "-",
                student.age if student.age else "-",
                student.grade or "-",
                student.class_name or "-",
                has_result
            ))
        
        for item in self.results_tree.get_children():
            self.results_tree.delete(item)
        
        student_name_map = {s.student_id: s.name for s in state.students if s.name}
        
        for result in state.screening_results:
            student_name = student_name_map.get(result.student_id, "-")
            left_max = result.get_left_ear_max_threshold()
            right_max = result.get_right_ear_max_threshold()
            
            self.results_tree.insert("", tk.END, values=(
                result.screening_id,
                result.student_id,
                student_name,
                result.device_id or "-",
                result.screening_date.strftime("%Y-%m-%d %H:%M") if result.screening_date else "-",
                result.status.value if result.status else "-",
                left_max if left_max is not None else "-",
                right_max if right_max is not None else "-"
            ))
        
        for item in self.devices_tree.get_children():
            self.devices_tree.delete(item)
        
        device_ids = set()
        for r in state.screening_results:
            if r.device_id:
                device_ids.add(r.device_id)
        for l in state.device_logs:
            if l.device_id:
                device_ids.add(l.device_id)
        for c in state.certificates:
            if c.device_id:
                device_ids.add(c.device_id)
        
        for device_id in sorted(device_ids):
            cert = None
            for c in state.certificates:
                if c.device_id == device_id:
                    cert = c
                    break
            
            log_count = sum(1 for l in state.device_logs if l.device_id == device_id)
            
            if cert:
                status = cert.get_status()
                status_text = "✓ 有效" if status.value == "valid" else "✗ 过期" if status.value == "expired" else "?"
                days_remaining = cert.get_days_remaining()
                
                self.devices_tree.insert("", tk.END, values=(
                    device_id,
                    cert.calibration_date.strftime("%Y-%m-%d") if cert.calibration_date else "-",
                    cert.valid_until.strftime("%Y-%m-%d") if cert.valid_until else "-",
                    status_text,
                    days_remaining if days_remaining is not None else "-",
                    log_count
                ))
            else:
                self.devices_tree.insert("", tk.END, values=(
                    device_id,
                    "-",
                    "-",
                    "⚠ 无证书",
                    "-",
                    log_count
                ))
    
    def _run_validation(self):
        state = self.current_state
        
        if not state.students and not state.screening_results:
            messagebox.showwarning("无数据", "请先导入学生名单或筛查结果数据")
            return
        
        self._update_status("正在执行校验...")
        self.root.update()
        
        issues, summary = run_all_validations(
            students=state.students,
            screening_results=state.screening_results,
            device_logs=state.device_logs,
            certificates=state.certificates
        )
        
        state.issues = issues
        self.current_issues = issues
        self.last_summary = summary
        
        summary_text = (
            f"共发现 {summary.total_issues} 个问题: "
            f"严重 {summary.critical_issues}, 高 {summary.high_issues}, "
            f"中 {summary.medium_issues}, 低 {summary.low_issues}"
        )
        self.issues_summary_label.config(text=summary_text)
        
        type_names = {
            "calibration_expired": "校准过期",
            "calibration_missing": "缺少校准",
            "result_missing": "结果缺失",
            "result_duplicate": "重复结果",
            "channel_swapped": "通道接反",
            "threshold_anomaly": "阈值异常",
            "threshold_extreme": "极端阈值",
            "log_time_drift": "时间漂移",
            "invalid_data": "无效数据",
            "missing_field": "缺失字段",
            "other": "其他",
        }
        
        unique_types = ["全部"]
        seen = set()
        for issue in issues:
            t = type_names.get(issue.issue_type.value, issue.issue_type.value)
            if t not in seen:
                unique_types.append(t)
                seen.add(t)
        
        self.type_filter["values"] = unique_types
        
        self._refresh_issues_tree()
        self._refresh_review_tree()
        self._save_state()
        
        self._update_status(f"校验完成，发现 {summary.total_issues} 个问题")
        messagebox.showinfo("校验完成", f"校验完成，共发现 {summary.total_issues} 个问题\n\n{summary_text}")
    
    def _refresh_issues_tree(self):
        for item in self.issues_tree.get_children():
            self.issues_tree.delete(item)
        
        severity_map = {
            IssueSeverity.CRITICAL: "严重",
            IssueSeverity.HIGH: "高",
            IssueSeverity.MEDIUM: "中",
            IssueSeverity.LOW: "低",
        }
        
        type_names = {
            "calibration_expired": "校准过期",
            "calibration_missing": "缺少校准",
            "result_missing": "结果缺失",
            "result_duplicate": "重复结果",
            "channel_swapped": "通道接反",
            "threshold_anomaly": "阈值异常",
            "threshold_extreme": "极端阈值",
            "log_time_drift": "时间漂移",
            "invalid_data": "无效数据",
            "missing_field": "缺失字段",
            "other": "其他",
        }
        
        review_names = {
            ReviewStatus.UNREVIEWED: "未复核",
            ReviewStatus.CONFIRMED: "确认问题",
            ReviewStatus.REJECTED: "排除问题",
            ReviewStatus.RESOLVED: "已解决",
        }
        
        for issue in self.current_issues:
            affected_parts = []
            if issue.affected_student_id:
                affected_parts.append(f"学生: {issue.affected_student_id}")
            if issue.affected_device_id:
                affected_parts.append(f"设备: {issue.affected_device_id}")
            affected_text = ", ".join(affected_parts) if affected_parts else "-"
            
            self.issues_tree.insert("", tk.END, iid=issue.issue_id, values=(
                severity_map.get(issue.severity, issue.severity.value),
                type_names.get(issue.issue_type.value, issue.issue_type.value),
                issue.title,
                affected_text,
                review_names.get(issue.review_status, issue.review_status.value),
                issue.issue_id[:8] + "..."
            ))
    
    def _filter_issues(self):
        pass
    
    def _on_issue_select(self, event):
        selection = self.issues_tree.selection()
        if not selection:
            return
        
        issue_id = selection[0]
        issue = None
        
        for i in self.current_issues:
            if i.issue_id == issue_id:
                issue = i
                break
        
        if issue:
            self.issue_detail_text.delete(1.0, tk.END)
            detail_text = (
                f"标题: {issue.title}\n"
                f"描述: {issue.description}\n"
                f"\n"
                f"严重程度: {issue.severity.value}\n"
                f"问题类型: {issue.issue_type.value}\n"
                f"复核状态: {issue.review_status.value}\n"
                f"\n"
            )
            
            if issue.affected_device_id:
                detail_text += f"涉及设备: {issue.affected_device_id}\n"
            if issue.affected_student_id:
                detail_text += f"涉及学生ID: {issue.affected_student_id}\n"
            if issue.affected_screening_id:
                detail_text += f"涉及筛查ID: {issue.affected_screening_id}\n"
            
            if issue.review_notes:
                detail_text += f"\n复核备注: {issue.review_notes}\n"
            
            if issue.details:
                detail_text += f"\n详细信息: {issue.details}\n"
            
            self.issue_detail_text.insert(1.0, detail_text)
    
    def _refresh_review_tree(self):
        for item in self.review_tree.get_children():
            self.review_tree.delete(item)
        
        severity_map = {
            IssueSeverity.CRITICAL: "严重",
            IssueSeverity.HIGH: "高",
            IssueSeverity.MEDIUM: "中",
            IssueSeverity.LOW: "低",
        }
        
        review_names = {
            ReviewStatus.UNREVIEWED: "未复核",
            ReviewStatus.CONFIRMED: "确认问题",
            ReviewStatus.REJECTED: "排除问题",
            ReviewStatus.RESOLVED: "已解决",
        }
        
        for issue in self.current_issues:
            affected_parts = []
            if issue.affected_student_id:
                affected_parts.append(f"学生: {issue.affected_student_id}")
            if issue.affected_device_id:
                affected_parts.append(f"设备: {issue.affected_device_id}")
            affected_text = ", ".join(affected_parts) if affected_parts else "-"
            
            self.review_tree.insert("", tk.END, iid=issue.issue_id, values=(
                "☐",
                severity_map.get(issue.severity, issue.severity.value),
                issue.title,
                affected_text,
                issue.description[:80] + "..." if len(issue.description) > 80 else issue.description,
                review_names.get(issue.review_status, issue.review_status.value)
            ))
    
    def _select_all_review(self):
        pass
    
    def _mark_issues(self, status: ReviewStatus):
        notes = self.review_notes_entry.get().strip()
        reviewer = self.reviewer_entry.get().strip()
        
        selected = self.review_tree.selection()
        if not selected:
            messagebox.showwarning("无选择", "请先在列表中选择要复核的问题")
            return
        
        count = 0
        for issue_id in selected:
            for issue in self.current_issues:
                if issue.issue_id == issue_id:
                    issue.mark_reviewed(status, notes if notes else None, reviewer if reviewer else None)
                    count += 1
                    
                    for state_issue in self.current_state.issues:
                        if state_issue.issue_id == issue_id:
                            state_issue.mark_reviewed(status, notes if notes else None, reviewer if reviewer else None)
                            break
                    break
        
        if count > 0:
            self._save_state()
            self._refresh_issues_tree()
            self._refresh_review_tree()
            self._update_status(f"已复核 {count} 个问题")
            messagebox.showinfo("复核完成", f"成功复核 {count} 个问题")
    
    def _new_session(self):
        if messagebox.askyesno("确认", "创建新会话将清除所有当前数据。是否继续？"):
            self.current_state = self.storage.create_new_session("新会话")
            self.current_issues = []
            self.last_summary = None
            
            self._refresh_import_status()
            self._refresh_overview_tables()
            self._refresh_issues_tree()
            self._refresh_review_tree()
            
            self.issues_summary_label.config(text="")
            self._update_status("已创建新会话")
    
    def _save_state(self):
        self.storage.set_current_state(self.current_state)
    
    def _load_state_dialog(self):
        file_path = filedialog.askopenfilename(
            title="选择状态文件",
            filetypes=[("JSON文件", "*.json"), ("所有文件", "*.*")]
        )
        if not file_path:
            return
        
        from storage import LocalStorage
        storage = LocalStorage(Path(file_path))
        state = storage.load()
        
        if state:
            self.current_state = state
            self.current_issues = state.issues
            self._refresh_import_status()
            self._refresh_overview_tables()
            self._refresh_issues_tree()
            self._refresh_review_tree()
            self._update_status("状态加载成功")
        else:
            messagebox.showerror("加载失败", "无法从所选文件加载状态")
    
    def _clear_all_data(self):
        if messagebox.askyesno("确认", "确定要清空所有导入的数据吗？"):
            self.current_state.clear_all()
            self.current_issues = []
            self.last_summary = None
            
            self._refresh_import_status()
            self._refresh_overview_tables()
            self._refresh_issues_tree()
            self._refresh_review_tree()
            
            self.issues_summary_label.config(text="")
            self._save_state()
            self._update_status("已清空所有数据")
    
    def _export_report_dialog(self):
        file_path = filedialog.asksaveasfilename(
            title="保存Markdown报告",
            defaultextension=".md",
            filetypes=[("Markdown文件", "*.md"), ("所有文件", "*.*")],
            initialfile=f"交付报告_{datetime.now().strftime('%Y%m%d_%H%M%S')}.md"
        )
        if not file_path:
            return
        
        session_name = self.session_name_entry.get().strip() or "默认会话"
        
        success = export_markdown_report(
            output_path=Path(file_path),
            students=self.current_state.students,
            screening_results=self.current_state.screening_results,
            device_logs=self.current_state.device_logs,
            certificates=self.current_state.certificates,
            issues=self.current_issues,
            summary=self.last_summary,
            session_name=session_name
        )
        
        if success:
            self.export_status_label.config(text=f"✓ 报告已导出到: {file_path}")
            self._update_status("Markdown报告导出成功")
            messagebox.showinfo("导出成功", f"报告已保存到:\n{file_path}")
        else:
            self.export_status_label.config(text="✗ 报告导出失败")
            messagebox.showerror("导出失败", "导出报告时发生错误")
    
    def _export_csv_dialog(self):
        file_path = filedialog.asksaveasfilename(
            title="保存CSV问题清单",
            defaultextension=".csv",
            filetypes=[("CSV文件", "*.csv"), ("所有文件", "*.*")],
            initialfile=f"问题清单_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
        )
        if not file_path:
            return
        
        success = export_csv_issues(
            output_path=Path(file_path),
            issues=self.current_issues,
            students=self.current_state.students
        )
        
        if success:
            self.export_status_label.config(text=f"✓ CSV已导出到: {file_path}")
            self._update_status("CSV问题清单导出成功")
            messagebox.showinfo("导出成功", f"问题清单已保存到:\n{file_path}")
        else:
            self.export_status_label.config(text="✗ CSV导出失败")
            messagebox.showerror("导出失败", "导出问题清单时发生错误")
    
    def _export_audit_dialog(self):
        file_path = filedialog.asksaveasfilename(
            title="保存JSON审计包",
            defaultextension=".json",
            filetypes=[("JSON文件", "*.json"), ("所有文件", "*.*")],
            initialfile=f"审计包_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        )
        if not file_path:
            return
        
        session_name = self.session_name_entry.get().strip() or "默认会话"
        include_raw = self.include_raw_var.get()
        
        success = export_json_audit(
            output_path=Path(file_path),
            students=self.current_state.students,
            screening_results=self.current_state.screening_results,
            device_logs=self.current_state.device_logs,
            certificates=self.current_state.certificates,
            issues=self.current_issues,
            summary=self.last_summary,
            session_name=session_name,
            include_raw_data=include_raw
        )
        
        if success:
            self.export_status_label.config(text=f"✓ 审计包已导出到: {file_path}")
            self._update_status("JSON审计包导出成功")
            messagebox.showinfo("导出成功", f"审计包已保存到:\n{file_path}")
        else:
            self.export_status_label.config(text="✗ 审计包导出失败")
            messagebox.showerror("导出失败", "导出审计包时发生错误")
    
    def _show_about(self):
        messagebox.showinfo(
            "关于",
            f"{APP_NAME}\n"
            f"版本: {APP_VERSION}\n\n"
            f"用于流动听力筛查车的数据核验工具\n"
            f"支持导入学生名单、筛查结果、设备日志和校准证书\n"
            f"自动校验校准有效期、结果缺失、阈值异常和时间漂移等问题"
        )


def run_app():
    root = tk.Tk()
    app = MainWindow(root)
    root.mainloop()


if __name__ == "__main__":
    run_app()
