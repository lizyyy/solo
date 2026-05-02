"""
撤展装箱核验台 - 主窗口GUI
使用Tkinter实现桌面应用界面
"""

import os
import sys
import tkinter as tk
from tkinter import ttk, filedialog, messagebox, scrolledtext
from datetime import datetime
from typing import Optional, Dict, Any, List
from pathlib import Path

# 将项目根目录添加到路径
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

from core.models import ProjectData, ReviewComment, Anomaly
from core.parser import DataImporter
from core.validator import RuleEngine
from core.database import DatabaseManager
from core.exporter import DataExporter


class AppState:
    """应用状态管理"""
    
    def __init__(self):
        self.current_project_id: Optional[str] = None
        self.current_project_data: Optional[ProjectData] = None
        self.csv_path: Optional[str] = None
        self.jsonl_path: Optional[str] = None
        self.photo_dir: Optional[str] = None
        self.db_manager = DatabaseManager()
        self.rule_engine = RuleEngine()
        self.last_validation_stats: Optional[Dict[str, Any]] = None


class MainWindow:
    """主窗口类"""
    
    def __init__(self, root: tk.Tk):
        self.root = root
        self.root.title("撤展装箱核验台 v1.0.0")
        self.root.geometry("1400x900")
        self.root.minsize(1000, 700)
        
        # 初始化状态
        self.state = AppState()
        
        # 设置样式
        self._setup_styles()
        
        # 创建菜单栏
        self._create_menu()
        
        # 创建主界面
        self._create_main_interface()
        
        # 状态栏
        self._create_status_bar()
    
    def _setup_styles(self):
        """设置Tkinter样式"""
        style = ttk.Style()
        
        # 尝试使用主题
        try:
            style.theme_use('clam')
        except tk.TclError:
            pass
        
        # 自定义样式
        style.configure('Title.TLabel', font=('Microsoft YaHei', 14, 'bold'))
        style.configure('Info.TLabel', font=('Microsoft YaHei', 10))
        style.configure('Critical.TLabel', foreground='red', font=('Microsoft YaHei', 10, 'bold'))
        style.configure('High.TLabel', foreground='dark orange', font=('Microsoft YaHei', 10))
        style.configure('Medium.TLabel', foreground='goldenrod', font=('Microsoft YaHei', 10))
        style.configure('Low.TLabel', foreground='green', font=('Microsoft YaHei', 10))
        style.configure('Success.TLabel', foreground='green', font=('Microsoft YaHei', 10))
        
        # Treeview样式
        style.configure('Treeview', font=('Microsoft YaHei', 9), rowheight=25)
        style.configure('Treeview.Heading', font=('Microsoft YaHei', 10, 'bold'))
    
    def _create_menu(self):
        """创建菜单栏"""
        menubar = tk.Menu(self.root)
        self.root.config(menu=menubar)
        
        # 文件菜单
        file_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="文件", menu=file_menu)
        
        file_menu.add_command(label="新建项目", command=self._new_project)
        file_menu.add_command(label="打开项目", command=self._open_project)
        file_menu.add_command(label="保存项目", command=self._save_project)
        file_menu.add_separator()
        file_menu.add_command(label="退出", command=self.root.quit)
        
        # 导入菜单
        import_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="导入", menu=import_menu)
        
        import_menu.add_command(label="导入展品清单CSV", command=self._import_csv)
        import_menu.add_command(label="导入装箱扫描JSONL", command=self._import_jsonl)
        import_menu.add_command(label="导入照片目录", command=self._import_photos)
        import_menu.add_separator()
        import_menu.add_command(label="全部导入", command=self._import_all)
        
        # 操作菜单
        action_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="操作", menu=action_menu)
        
        action_menu.add_command(label="执行校验", command=self._run_validation)
        action_menu.add_separator()
        action_menu.add_command(label="重新加载数据", command=self._reload_data)
        
        # 导出菜单
        export_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="导出", menu=export_menu)
        
        export_menu.add_command(label="导出Markdown交接单", command=self._export_markdown)
        export_menu.add_command(label="导出CSV异常表", command=self._export_anomalies_csv)
        export_menu.add_command(label="导出CSV装箱清单", command=self._export_manifest_csv)
        export_menu.add_command(label="导出JSON审计包", command=self._export_audit_json)
        export_menu.add_separator()
        export_menu.add_command(label="全部导出", command=self._export_all)
        
        # 帮助菜单
        help_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="帮助", menu=help_menu)
        
        help_menu.add_command(label="关于", command=self._show_about)
    
    def _create_main_interface(self):
        """创建主界面"""
        # 主框架
        main_frame = ttk.Frame(self.root, padding="10")
        main_frame.pack(fill=tk.BOTH, expand=True)
        
        # 顶部信息区
        self._create_header(main_frame)
        
        # 中间标签页区域
        self._create_notebook(main_frame)
    
    def _create_header(self, parent: ttk.Frame):
        """创建顶部信息区"""
        header_frame = ttk.LabelFrame(parent, text="项目信息", padding="10")
        header_frame.pack(fill=tk.X, pady=(0, 10))
        
        # 第一行：项目名称和统计
        row1 = ttk.Frame(header_frame)
        row1.pack(fill=tk.X)
        
        ttk.Label(row1, text="项目名称:", style='Info.TLabel').pack(side=tk.LEFT, padx=(0, 5))
        self.project_name_var = tk.StringVar(value="未命名项目")
        ttk.Label(row1, textvariable=self.project_name_var, style='Title.TLabel').pack(side=tk.LEFT)
        
        # 统计标签
        self.stats_frame = ttk.Frame(row1)
        self.stats_frame.pack(side=tk.RIGHT)
        
        self.exhibit_count_label = ttk.Label(self.stats_frame, text="展品: 0", style='Info.TLabel')
        self.exhibit_count_label.pack(side=tk.LEFT, padx=10)
        
        self.scan_count_label = ttk.Label(self.stats_frame, text="扫描: 0", style='Info.TLabel')
        self.scan_count_label.pack(side=tk.LEFT, padx=10)
        
        self.photo_count_label = ttk.Label(self.stats_frame, text="照片: 0", style='Info.TLabel')
        self.photo_count_label.pack(side=tk.LEFT, padx=10)
        
        self.anomaly_count_label = ttk.Label(self.stats_frame, text="异常: 0", style='Info.TLabel')
        self.anomaly_count_label.pack(side=tk.LEFT, padx=10)
        
        # 第二行：文件路径信息
        row2 = ttk.Frame(header_frame)
        row2.pack(fill=tk.X, pady=(10, 0))
        
        # CSV路径
        csv_frame = ttk.Frame(row2)
        csv_frame.pack(fill=tk.X, pady=2)
        ttk.Label(csv_frame, text="展品清单:", width=10, style='Info.TLabel').pack(side=tk.LEFT)
        self.csv_path_var = tk.StringVar(value="未选择")
        ttk.Label(csv_frame, textvariable=self.csv_path_var, style='Info.TLabel', 
                  foreground='gray').pack(side=tk.LEFT, fill=tk.X, expand=True)
        
        # JSONL路径
        jsonl_frame = ttk.Frame(row2)
        jsonl_frame.pack(fill=tk.X, pady=2)
        ttk.Label(jsonl_frame, text="扫描记录:", width=10, style='Info.TLabel').pack(side=tk.LEFT)
        self.jsonl_path_var = tk.StringVar(value="未选择")
        ttk.Label(jsonl_frame, textvariable=self.jsonl_path_var, style='Info.TLabel',
                  foreground='gray').pack(side=tk.LEFT, fill=tk.X, expand=True)
        
        # 照片目录
        photo_frame = ttk.Frame(row2)
        photo_frame.pack(fill=tk.X, pady=2)
        ttk.Label(photo_frame, text="照片目录:", width=10, style='Info.TLabel').pack(side=tk.LEFT)
        self.photo_path_var = tk.StringVar(value="未选择")
        ttk.Label(photo_frame, textvariable=self.photo_path_var, style='Info.TLabel',
                  foreground='gray').pack(side=tk.LEFT, fill=tk.X, expand=True)
    
    def _create_notebook(self, parent: ttk.Frame):
        """创建标签页"""
        self.notebook = ttk.Notebook(parent)
        self.notebook.pack(fill=tk.BOTH, expand=True)
        
        # 1. 展品清单标签页
        self._create_exhibits_tab()
        
        # 2. 装箱扫描标签页
        self._create_scans_tab()
        
        # 3. 扫描时间线标签页
        self._create_timeline_tab()
        
        # 4. 异常清单标签页
        self._create_anomalies_tab()
        
        # 5. 照片证据标签页
        self._create_photos_tab()
    
    def _create_exhibits_tab(self):
        """创建展品清单标签页"""
        tab = ttk.Frame(self.notebook, padding="10")
        self.notebook.add(tab, text="展品清单")
        
        # 工具栏
        toolbar = ttk.Frame(tab)
        toolbar.pack(fill=tk.X, pady=(0, 10))
        
        ttk.Button(toolbar, text="导入CSV", command=self._import_csv).pack(side=tk.LEFT, padx=5)
        ttk.Button(toolbar, text="刷新", command=self._refresh_exhibits).pack(side=tk.LEFT, padx=5)
        
        # 搜索框
        search_frame = ttk.Frame(toolbar)
        search_frame.pack(side=tk.RIGHT, padx=5)
        
        ttk.Label(search_frame, text="搜索:").pack(side=tk.LEFT, padx=2)
        self.exhibit_search_var = tk.StringVar()
        self.exhibit_search_var.trace('w', self._filter_exhibits)
        ttk.Entry(search_frame, textvariable=self.exhibit_search_var, width=30).pack(side=tk.LEFT)
        
        # 表格
        columns = ('exhibit_id', 'name', 'category', 'location', 'is_fragile', 'condition', 'notes')
        self.exhibits_tree = ttk.Treeview(tab, columns=columns, show='headings', height=20)
        
        # 设置列
        self.exhibits_tree.heading('exhibit_id', text='展品编号')
        self.exhibits_tree.heading('name', text='展品名称')
        self.exhibits_tree.heading('category', text='类别')
        self.exhibits_tree.heading('location', text='原位置')
        self.exhibits_tree.heading('is_fragile', text='是否易碎')
        self.exhibits_tree.heading('condition', text='状态')
        self.exhibits_tree.heading('notes', text='备注')
        
        self.exhibits_tree.column('exhibit_id', width=100)
        self.exhibits_tree.column('name', width=200)
        self.exhibits_tree.column('category', width=100)
        self.exhibits_tree.column('location', width=100)
        self.exhibits_tree.column('is_fragile', width=80, anchor=tk.CENTER)
        self.exhibits_tree.column('condition', width=80)
        self.exhibits_tree.column('notes', width=200)
        
        # 滚动条
        scrollbar_y = ttk.Scrollbar(tab, orient=tk.VERTICAL, command=self.exhibits_tree.yview)
        scrollbar_x = ttk.Scrollbar(tab, orient=tk.HORIZONTAL, command=self.exhibits_tree.xview)
        self.exhibits_tree.configure(yscrollcommand=scrollbar_y.set, xscrollcommand=scrollbar_x.set)
        
        self.exhibits_tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scrollbar_y.pack(side=tk.RIGHT, fill=tk.Y)
    
    def _create_scans_tab(self):
        """创建装箱扫描标签页"""
        tab = ttk.Frame(self.notebook, padding="10")
        self.notebook.add(tab, text="装箱扫描")
        
        # 工具栏
        toolbar = ttk.Frame(tab)
        toolbar.pack(fill=tk.X, pady=(0, 10))
        
        ttk.Button(toolbar, text="导入JSONL", command=self._import_jsonl).pack(side=tk.LEFT, padx=5)
        ttk.Button(toolbar, text="刷新", command=self._refresh_scans).pack(side=tk.LEFT, padx=5)
        
        # 箱号筛选
        filter_frame = ttk.Frame(toolbar)
        filter_frame.pack(side=tk.RIGHT, padx=5)
        
        ttk.Label(filter_frame, text="箱号筛选:").pack(side=tk.LEFT, padx=2)
        self.box_filter_var = tk.StringVar(value="全部")
        self.box_filter_combo = ttk.Combobox(filter_frame, textvariable=self.box_filter_var, width=15)
        self.box_filter_combo.pack(side=tk.LEFT, padx=2)
        self.box_filter_combo.bind('<<ComboboxSelected>>', self._filter_scans_by_box)
        
        # 表格
        columns = ('scan_id', 'exhibit_id', 'box_number', 'scan_time', 'operator', 
                   'temperature', 'humidity', 'has_signature', 'buffer_verified')
        self.scans_tree = ttk.Treeview(tab, columns=columns, show='headings', height=20)
        
        self.scans_tree.heading('scan_id', text='扫描ID')
        self.scans_tree.heading('exhibit_id', text='展品编号')
        self.scans_tree.heading('box_number', text='箱号')
        self.scans_tree.heading('scan_time', text='扫描时间')
        self.scans_tree.heading('operator', text='操作人')
        self.scans_tree.heading('temperature', text='温度')
        self.scans_tree.heading('humidity', text='湿度')
        self.scans_tree.heading('has_signature', text='签名')
        self.scans_tree.heading('buffer_verified', text='缓冲确认')
        
        self.scans_tree.column('scan_id', width=100)
        self.scans_tree.column('exhibit_id', width=100)
        self.scans_tree.column('box_number', width=80, anchor=tk.CENTER)
        self.scans_tree.column('scan_time', width=150)
        self.scans_tree.column('operator', width=80)
        self.scans_tree.column('temperature', width=60, anchor=tk.CENTER)
        self.scans_tree.column('humidity', width=60, anchor=tk.CENTER)
        self.scans_tree.column('has_signature', width=60, anchor=tk.CENTER)
        self.scans_tree.column('buffer_verified', width=80, anchor=tk.CENTER)
        
        # 滚动条
        scrollbar_y = ttk.Scrollbar(tab, orient=tk.VERTICAL, command=self.scans_tree.yview)
        scrollbar_x = ttk.Scrollbar(tab, orient=tk.HORIZONTAL, command=self.scans_tree.xview)
        self.scans_tree.configure(yscrollcommand=scrollbar_y.set, xscrollcommand=scrollbar_x.set)
        
        self.scans_tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scrollbar_y.pack(side=tk.RIGHT, fill=tk.Y)
    
    def _create_timeline_tab(self):
        """创建扫描时间线标签页"""
        tab = ttk.Frame(self.notebook, padding="10")
        self.notebook.add(tab, text="扫描时间线")
        
        # 说明标签
        ttk.Label(tab, text="按时间顺序展示所有扫描记录", style='Info.TLabel').pack(anchor=tk.W, pady=(0, 10))
        
        # 工具栏
        toolbar = ttk.Frame(tab)
        toolbar.pack(fill=tk.X, pady=(0, 10))
        
        ttk.Button(toolbar, text="刷新", command=self._refresh_timeline).pack(side=tk.LEFT, padx=5)
        
        # 时间线文本区域
        self.timeline_text = scrolledtext.ScrolledText(
            tab, wrap=tk.WORD, font=('Microsoft YaHei', 10),
            bg='#fafafa', relief=tk.SOLID, borderwidth=1
        )
        self.timeline_text.pack(fill=tk.BOTH, expand=True)
        self.timeline_text.config(state=tk.DISABLED)
        
        # 配置标签颜色
        self.timeline_text.tag_configure('time', foreground='blue', font=('Microsoft YaHei', 10, 'bold'))
        self.timeline_text.tag_configure('box', foreground='dark green', font=('Microsoft YaHei', 10, 'bold'))
        self.timeline_text.tag_configure('exhibit', foreground='purple')
        self.timeline_text.tag_configure('operator', foreground='gray')
        self.timeline_text.tag_configure('warning', foreground='red', font=('Microsoft YaHei', 10, 'bold'))
        self.timeline_text.tag_configure('check', foreground='green')
        self.timeline_text.tag_configure('cross', foreground='red')
    
    def _create_anomalies_tab(self):
        """创建异常清单标签页"""
        tab = ttk.Frame(self.notebook, padding="10")
        self.notebook.add(tab, text="异常清单")
        
        # 工具栏
        toolbar = ttk.Frame(tab)
        toolbar.pack(fill=tk.X, pady=(0, 10))
        
        ttk.Button(toolbar, text="执行校验", command=self._run_validation).pack(side=tk.LEFT, padx=5)
        ttk.Button(toolbar, text="刷新", command=self._refresh_anomalies).pack(side=tk.LEFT, padx=5)
        ttk.Separator(toolbar, orient=tk.VERTICAL).pack(side=tk.LEFT, fill=tk.Y, padx=10)
        
        # 严重程度筛选
        ttk.Label(toolbar, text="严重程度:").pack(side=tk.LEFT, padx=2)
        self.severity_filter_var = tk.StringVar(value="全部")
        severity_combo = ttk.Combobox(toolbar, textvariable=self.severity_filter_var, 
                                        values=["全部", "严重", "高", "中", "低"], width=10)
        severity_combo.pack(side=tk.LEFT, padx=2)
        severity_combo.bind('<<ComboboxSelected>>', self._filter_anomalies)
        
        # 状态筛选
        ttk.Label(toolbar, text="状态:").pack(side=tk.LEFT, padx=(10, 2))
        self.status_filter_var = tk.StringVar(value="全部")
        status_combo = ttk.Combobox(toolbar, textvariable=self.status_filter_var,
                                     values=["全部", "未解决", "已解决"], width=10)
        status_combo.pack(side=tk.LEFT, padx=2)
        status_combo.bind('<<ComboboxSelected>>', self._filter_anomalies)
        
        # 表格
        columns = ('anomaly_type', 'severity', 'exhibit_id', 'box_number', 
                   'description', 'is_resolved', 'detected_time')
        self.anomalies_tree = ttk.Treeview(tab, columns=columns, show='headings', height=15)
        
        self.anomalies_tree.heading('anomaly_type', text='异常类型')
        self.anomalies_tree.heading('severity', text='严重程度')
        self.anomalies_tree.heading('exhibit_id', text='展品编号')
        self.anomalies_tree.heading('box_number', text='箱号')
        self.anomalies_tree.heading('description', text='描述')
        self.anomalies_tree.heading('is_resolved', text='状态')
        self.anomalies_tree.heading('detected_time', text='检测时间')
        
        self.anomalies_tree.column('anomaly_type', width=120)
        self.anomalies_tree.column('severity', width=80, anchor=tk.CENTER)
        self.anomalies_tree.column('exhibit_id', width=100)
        self.anomalies_tree.column('box_number', width=80)
        self.anomalies_tree.column('description', width=300)
        self.anomalies_tree.column('is_resolved', width=80, anchor=tk.CENTER)
        self.anomalies_tree.column('detected_time', width=150)
        
        # 滚动条
        scrollbar_y = ttk.Scrollbar(tab, orient=tk.VERTICAL, command=self.anomalies_tree.yview)
        self.anomalies_tree.configure(yscrollcommand=scrollbar_y.set)
        
        # 表格和详情区的PanedWindow
        paned = ttk.PanedWindow(tab, orient=tk.VERTICAL)
        paned.pack(fill=tk.BOTH, expand=True)
        
        # 上部分：表格
        tree_frame = ttk.Frame(paned)
        self.anomalies_tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scrollbar_y.pack(side=tk.RIGHT, fill=tk.Y)
        paned.add(tree_frame, weight=2)
        
        # 下部分：详情和复核
        detail_frame = ttk.LabelFrame(paned, text="异常详情 & 复核", padding="10")
        paned.add(detail_frame, weight=1)
        
        self._create_anomaly_detail_panel(detail_frame)
        
        # 绑定选择事件
        self.anomalies_tree.bind('<<TreeviewSelect>>', self._on_anomaly_selected)
    
    def _create_anomaly_detail_panel(self, parent: ttk.LabelFrame):
        """创建异常详情和复核面板"""
        # 左侧：详情
        left_frame = ttk.Frame(parent)
        left_frame.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, padx=(0, 10))
        
        ttk.Label(left_frame, text="异常描述:", style='Info.TLabel').pack(anchor=tk.W)
        self.anomaly_desc_text = scrolledtext.ScrolledText(left_frame, height=4, width=50, wrap=tk.WORD)
        self.anomaly_desc_text.pack(fill=tk.BOTH, expand=True, pady=(5, 10))
        self.anomaly_desc_text.config(state=tk.DISABLED)
        
        ttk.Label(left_frame, text="处理建议:", style='Info.TLabel').pack(anchor=tk.W)
        self.anomaly_suggest_text = scrolledtext.ScrolledText(left_frame, height=3, width=50, wrap=tk.WORD)
        self.anomaly_suggest_text.pack(fill=tk.BOTH, expand=True)
        self.anomaly_suggest_text.config(state=tk.DISABLED)
        
        # 右侧：复核
        right_frame = ttk.LabelFrame(parent, text="人工复核", padding="10")
        right_frame.pack(side=tk.RIGHT, fill=tk.Y)
        
        ttk.Label(right_frame, text="复核人:").pack(anchor=tk.W)
        self.reviewer_var = tk.StringVar()
        ttk.Entry(right_frame, textvariable=self.reviewer_var, width=30).pack(fill=tk.X, pady=5)
        
        ttk.Label(right_frame, text="复核意见:").pack(anchor=tk.W)
        self.review_comment_text = scrolledtext.ScrolledText(right_frame, height=5, width=35, wrap=tk.WORD)
        self.review_comment_text.pack(fill=tk.BOTH, expand=True, pady=5)
        
        # 复选框
        self.is_approved_var = tk.BooleanVar(value=False)
        ttk.Checkbutton(right_frame, text="复核通过", variable=self.is_approved_var).pack(anchor=tk.W)
        
        self.follow_up_var = tk.BooleanVar(value=False)
        ttk.Checkbutton(right_frame, text="需要跟进", variable=self.follow_up_var).pack(anchor=tk.W)
        
        # 按钮
        btn_frame = ttk.Frame(right_frame)
        btn_frame.pack(fill=tk.X, pady=(10, 0))
        
        ttk.Button(btn_frame, text="提交复核", command=self._submit_review).pack(side=tk.LEFT, padx=2)
        ttk.Button(btn_frame, text="标记解决", command=self._mark_resolved).pack(side=tk.LEFT, padx=2)
    
    def _create_photos_tab(self):
        """创建照片证据标签页"""
        tab = ttk.Frame(self.notebook, padding="10")
        self.notebook.add(tab, text="照片证据")
        
        # 工具栏
        toolbar = ttk.Frame(tab)
        toolbar.pack(fill=tk.X, pady=(0, 10))
        
        ttk.Button(toolbar, text="导入照片目录", command=self._import_photos).pack(side=tk.LEFT, padx=5)
        ttk.Button(toolbar, text="刷新", command=self._refresh_photos).pack(side=tk.LEFT, padx=5)
        
        # 表格
        columns = ('file_name', 'file_size', 'capture_time', 'exhibit_references', 'box_references')
        self.photos_tree = ttk.Treeview(tab, columns=columns, show='headings', height=20)
        
        self.photos_tree.heading('file_name', text='文件名')
        self.photos_tree.heading('file_size', text='文件大小')
        self.photos_tree.heading('capture_time', text='拍摄时间')
        self.photos_tree.heading('exhibit_references', text='关联展品')
        self.photos_tree.heading('box_references', text='关联箱号')
        
        self.photos_tree.column('file_name', width=250)
        self.photos_tree.column('file_size', width=100, anchor=tk.CENTER)
        self.photos_tree.column('capture_time', width=150)
        self.photos_tree.column('exhibit_references', width=150)
        self.photos_tree.column('box_references', width=100)
        
        # 滚动条
        scrollbar_y = ttk.Scrollbar(tab, orient=tk.VERTICAL, command=self.photos_tree.yview)
        scrollbar_x = ttk.Scrollbar(tab, orient=tk.HORIZONTAL, command=self.photos_tree.xview)
        self.photos_tree.configure(yscrollcommand=scrollbar_y.set, xscrollcommand=scrollbar_x.set)
        
        self.photos_tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scrollbar_y.pack(side=tk.RIGHT, fill=tk.Y)
    
    def _create_status_bar(self):
        """创建状态栏"""
        self.status_bar = ttk.Frame(self.root)
        self.status_bar.pack(side=tk.BOTTOM, fill=tk.X)
        
        self.status_label = ttk.Label(self.status_bar, text="就绪", relief=tk.SUNKEN, anchor=tk.W)
        self.status_label.pack(side=tk.LEFT, fill=tk.X, expand=True)
        
        self.version_label = ttk.Label(self.status_bar, text="v1.0.0", relief=tk.SUNKEN, anchor=tk.E)
        self.version_label.pack(side=tk.RIGHT)
    
    # ==================== 菜单命令实现 ====================
    
    def _set_status(self, message: str):
        """设置状态栏消息"""
        self.status_label.config(text=message)
        self.root.update_idletasks()
    
    def _new_project(self):
        """新建项目"""
        project_name = filedialog.asksaveasfilename(
            title="新建项目",
            defaultextension="",
            initialfile="未命名项目"
        )
        if project_name:
            # 从路径中提取名称
            name = Path(project_name).stem
            self.state.current_project_data = ProjectData(project_name=name)
            self.state.current_project_id = None
            self.project_name_var.set(name)
            self._update_stats()
            self._clear_all_tables()
            self._set_status(f"已创建新项目: {name}")
    
    def _open_project(self):
        """打开项目"""
        projects = self.state.db_manager.list_projects()
        
        if not projects:
            messagebox.showinfo("提示", "没有保存的项目")
            return
        
        # 简单对话框选择项目
        dialog = tk.Toplevel(self.root)
        dialog.title("选择项目")
        dialog.geometry("400x300")
        dialog.transient(self.root)
        dialog.grab_set()
        
        ttk.Label(dialog, text="选择要打开的项目:", style='Info.TLabel').pack(pady=10)
        
        # 列表框
        listbox = tk.Listbox(dialog, font=('Microsoft YaHei', 10), height=10)
        listbox.pack(fill=tk.BOTH, expand=True, padx=20, pady=10)
        
        project_map = {}
        for i, proj in enumerate(projects):
            display_name = f"{proj['project_name']} ({proj['created_at'][:10]})"
            listbox.insert(tk.END, display_name)
            project_map[i] = proj['project_id']
        
        def on_select():
            selection = listbox.curselection()
            if selection:
                project_id = project_map[selection[0]]
                dialog.destroy()
                self._load_project(project_id)
        
        btn_frame = ttk.Frame(dialog)
        btn_frame.pack(pady=10)
        ttk.Button(btn_frame, text="打开", command=on_select).pack(side=tk.LEFT, padx=5)
        ttk.Button(btn_frame, text="取消", command=dialog.destroy).pack(side=tk.LEFT, padx=5)
    
    def _load_project(self, project_id: str):
        """加载项目"""
        self._set_status("正在加载项目...")
        
        project_data = self.state.db_manager.load_project_data(project_id)
        if project_data:
            self.state.current_project_id = project_id
            self.state.current_project_data = project_data
            self.project_name_var.set(project_data.project_name)
            self._update_stats()
            self._refresh_all_tables()
            self._set_status(f"已加载项目: {project_data.project_name}")
        else:
            messagebox.showerror("错误", "加载项目失败")
            self._set_status("就绪")
    
    def _save_project(self):
        """保存项目"""
        if not self.state.current_project_data:
            messagebox.showwarning("警告", "没有可保存的项目数据")
            return
        
        self._set_status("正在保存项目...")
        
        try:
            project_id = self.state.db_manager.save_project_data(
                self.state.current_project_data,
                self.state.current_project_id
            )
            self.state.current_project_id = project_id
            self._set_status("项目已保存")
            messagebox.showinfo("成功", "项目已保存")
        except Exception as e:
            messagebox.showerror("错误", f"保存失败: {str(e)}")
            self._set_status("就绪")
    
    def _import_csv(self):
        """导入CSV"""
        file_path = filedialog.askopenfilename(
            title="选择展品清单CSV",
            filetypes=[("CSV文件", "*.csv"), ("所有文件", "*.*")]
        )
        if file_path:
            self.state.csv_path = file_path
            self.csv_path_var.set(Path(file_path).name)
            
            if not self.state.current_project_data:
                self.state.current_project_data = ProjectData(project_name="导入项目")
            
            # 解析CSV
            from core.parser import CSVParser
            exhibits, errors = CSVParser.parse(file_path)
            
            if errors:
                messagebox.showwarning("解析警告", f"解析过程中发现 {len(errors)} 个错误:\n" + "\n".join(errors[:5]))
            
            self.state.current_project_data.exhibits = exhibits
            self._update_stats()
            self._refresh_exhibits()
            self._set_status(f"已导入 {len(exhibits)} 件展品")
    
    def _import_jsonl(self):
        """导入JSONL"""
        file_path = filedialog.askopenfilename(
            title="选择装箱扫描JSONL",
            filetypes=[("JSONL文件", "*.jsonl"), ("JSON文件", "*.json"), ("所有文件", "*.*")]
        )
        if file_path:
            self.state.jsonl_path = file_path
            self.jsonl_path_var.set(Path(file_path).name)
            
            if not self.state.current_project_data:
                self.state.current_project_data = ProjectData(project_name="导入项目")
            
            # 解析JSONL
            from core.parser import JSONLParser
            scans, errors = JSONLParser.parse(file_path)
            
            if errors:
                messagebox.showwarning("解析警告", f"解析过程中发现 {len(errors)} 个错误")
            
            self.state.current_project_data.scan_records = scans
            self._update_stats()
            self._refresh_scans()
            self._refresh_timeline()
            self._update_box_filter()
            self._set_status(f"已导入 {len(scans)} 条扫描记录")
    
    def _import_photos(self):
        """导入照片目录"""
        dir_path = filedialog.askdirectory(title="选择照片目录")
        if dir_path:
            self.state.photo_dir = dir_path
            self.photo_path_var.set(Path(dir_path).name)
            
            if not self.state.current_project_data:
                self.state.current_project_data = ProjectData(project_name="导入项目")
            
            # 扫描照片
            from core.parser import PhotoScanner
            photos, errors = PhotoScanner.scan(dir_path)
            
            if errors:
                messagebox.showwarning("扫描警告", f"扫描过程中发现 {len(errors)} 个错误")
            
            self.state.current_project_data.photo_records = photos
            self._update_stats()
            self._refresh_photos()
            self._set_status(f"已导入 {len(photos)} 张照片")
    
    def _import_all(self):
        """全部导入"""
        messagebox.showinfo("提示", "请依次导入:\n1. 展品清单CSV\n2. 装箱扫描JSONL\n3. 照片目录")
    
    def _run_validation(self):
        """执行校验"""
        if not self.state.current_project_data:
            messagebox.showwarning("警告", "请先导入数据")
            return
        
        self._set_status("正在执行校验...")
        
        try:
            anomalies, stats = self.state.rule_engine.validate_all(self.state.current_project_data)
            self.state.current_project_data.anomalies = anomalies
            self.state.last_validation_stats = stats
            
            self._update_stats()
            self._refresh_anomalies()
            
            # 显示结果
            critical = stats['by_severity']['critical']
            high = stats['by_severity']['high']
            medium = stats['by_severity']['medium']
            low = stats['by_severity']['low']
            
            result_msg = f"校验完成!\n\n"
            result_msg += f"严重异常: {critical}\n"
            result_msg += f"高优先级异常: {high}\n"
            result_msg += f"中优先级异常: {medium}\n"
            result_msg += f"低优先级异常: {low}\n"
            result_msg += f"总计: {stats['total_anomalies']} 个异常"
            
            if critical > 0 or high > 0:
                messagebox.showwarning("校验结果", result_msg)
            else:
                messagebox.showinfo("校验结果", result_msg)
            
            self._set_status(f"校验完成，发现 {stats['total_anomalies']} 个异常")
            
        except Exception as e:
            messagebox.showerror("错误", f"校验失败: {str(e)}")
            self._set_status("就绪")
    
    def _reload_data(self):
        """重新加载数据"""
        if not self.state.current_project_data:
            messagebox.showwarning("警告", "没有数据可刷新")
            return
        
        # 重新导入所有已选择的文件
        importer = DataImporter()
        project_data, errors = importer.import_all(
            csv_path=self.state.csv_path,
            jsonl_path=self.state.jsonl_path,
            photo_dir=self.state.photo_dir,
            project_name=self.state.current_project_data.project_name
        )
        
        # 保留原有的异常和复核意见（如果有的话）
        if self.state.current_project_data:
            project_data.anomalies = self.state.current_project_data.anomalies
            project_data.review_comments = self.state.current_project_data.review_comments
        
        self.state.current_project_data = project_data
        self._update_stats()
        self._refresh_all_tables()
        self._set_status("数据已刷新")
    
    # ==================== 导出功能 ====================
    
    def _export_markdown(self):
        """导出Markdown"""
        if not self.state.current_project_data:
            messagebox.showwarning("警告", "没有数据可导出")
            return
        
        file_path = filedialog.asksaveasfilename(
            title="导出Markdown交接单",
            defaultextension=".md",
            initialfile=f"{self.state.current_project_data.project_name}_交接单.md"
        )
        if file_path:
            try:
                exporter = DataExporter(self.state.current_project_data)
                exporter.export_markdown(file_path)
                self._set_status(f"已导出: {file_path}")
                messagebox.showinfo("成功", f"Markdown交接单已导出到:\n{file_path}")
            except Exception as e:
                messagebox.showerror("错误", f"导出失败: {str(e)}")
    
    def _export_anomalies_csv(self):
        """导出异常表CSV"""
        if not self.state.current_project_data:
            messagebox.showwarning("警告", "没有数据可导出")
            return
        
        file_path = filedialog.asksaveasfilename(
            title="导出CSV异常表",
            defaultextension=".csv",
            initialfile=f"{self.state.current_project_data.project_name}_异常表.csv"
        )
        if file_path:
            try:
                exporter = DataExporter(self.state.current_project_data)
                count = exporter.export_anomalies_csv(file_path, include_resolved=True)
                self._set_status(f"已导出 {count} 条异常记录")
                messagebox.showinfo("成功", f"已导出 {count} 条异常记录")
            except Exception as e:
                messagebox.showerror("错误", f"导出失败: {str(e)}")
    
    def _export_manifest_csv(self):
        """导出装箱清单CSV"""
        if not self.state.current_project_data:
            messagebox.showwarning("警告", "没有数据可导出")
            return
        
        file_path = filedialog.asksaveasfilename(
            title="导出CSV装箱清单",
            defaultextension=".csv",
            initialfile=f"{self.state.current_project_data.project_name}_装箱清单.csv"
        )
        if file_path:
            try:
                exporter = DataExporter(self.state.current_project_data)
                count = exporter.export_box_manifest_csv(file_path)
                self._set_status(f"已导出 {count} 条装箱记录")
                messagebox.showinfo("成功", f"已导出 {count} 条装箱记录")
            except Exception as e:
                messagebox.showerror("错误", f"导出失败: {str(e)}")
    
    def _export_audit_json(self):
        """导出JSON审计包"""
        if not self.state.current_project_data:
            messagebox.showwarning("警告", "没有数据可导出")
            return
        
        file_path = filedialog.asksaveasfilename(
            title="导出JSON审计包",
            defaultextension=".json",
            initialfile=f"{self.state.current_project_data.project_name}_审计包.json"
        )
        if file_path:
            try:
                exporter = DataExporter(self.state.current_project_data)
                exporter.export_audit_json(file_path)
                self._set_status(f"已导出: {file_path}")
                messagebox.showinfo("成功", f"JSON审计包已导出到:\n{file_path}")
            except Exception as e:
                messagebox.showerror("错误", f"导出失败: {str(e)}")
    
    def _export_all(self):
        """全部导出"""
        if not self.state.current_project_data:
            messagebox.showwarning("警告", "没有数据可导出")
            return
        
        dir_path = filedialog.askdirectory(title="选择导出目录")
        if dir_path:
            try:
                exporter = DataExporter(self.state.current_project_data)
                paths = exporter.export_all(dir_path)
                
                result_msg = "已导出以下文件:\n\n"
                for name, path in paths.items():
                    result_msg += f"• {name}: {path}\n"
                
                self._set_status(f"已导出到: {dir_path}")
                messagebox.showinfo("成功", result_msg)
            except Exception as e:
                messagebox.showerror("错误", f"导出失败: {str(e)}")
    
    def _show_about(self):
        """显示关于"""
        messagebox.showinfo(
            "关于",
            "撤展装箱核验台 v1.0.0\n\n"
            "博物馆临展撤展装箱核验工具\n\n"
            "功能:\n"
            "• 导入展品清单CSV\n"
            "• 导入装箱扫描JSONL\n"
            "• 导入照片目录\n"
            "• 智能规则校验\n"
            "• 异常复核追踪\n"
            "• 多格式导出"
        )
    
    # ==================== 辅助方法 ====================
    
    def _update_stats(self):
        """更新统计信息"""
        if not self.state.current_project_data:
            self.exhibit_count_label.config(text="展品: 0")
            self.scan_count_label.config(text="扫描: 0")
            self.photo_count_label.config(text="照片: 0")
            self.anomaly_count_label.config(text="异常: 0")
            return
        
        data = self.state.current_project_data
        self.exhibit_count_label.config(text=f"展品: {len(data.exhibits)}")
        self.scan_count_label.config(text=f"扫描: {len(data.scan_records)}")
        self.photo_count_label.config(text=f"照片: {len(data.photo_records)}")
        
        unresolved = len(data.get_unresolved_anomalies())
        total = len(data.anomalies)
        self.anomaly_count_label.config(text=f"异常: {unresolved}/{total}")
        
        # 根据未解决异常数量设置颜色
        if unresolved > 0:
            self.anomaly_count_label.config(style='Critical.TLabel')
        else:
            self.anomaly_count_label.config(style='Success.TLabel')
    
    def _clear_all_tables(self):
        """清空所有表格"""
        for item in self.exhibits_tree.get_children():
            self.exhibits_tree.delete(item)
        for item in self.scans_tree.get_children():
            self.scans_tree.delete(item)
        for item in self.anomalies_tree.get_children():
            self.anomalies_tree.delete(item)
        for item in self.photos_tree.get_children():
            self.photos_tree.delete(item)
        
        self.timeline_text.config(state=tk.NORMAL)
        self.timeline_text.delete(1.0, tk.END)
        self.timeline_text.config(state=tk.DISABLED)
    
    def _refresh_all_tables(self):
        """刷新所有表格"""
        self._refresh_exhibits()
        self._refresh_scans()
        self._refresh_timeline()
        self._refresh_anomalies()
        self._refresh_photos()
        self._update_box_filter()
    
    def _refresh_exhibits(self):
        """刷新展品表格"""
        # 清空
        for item in self.exhibits_tree.get_children():
            self.exhibits_tree.delete(item)
        
        if not self.state.current_project_data:
            return
        
        # 填充
        for exhibit in self.state.current_project_data.exhibits:
            fragile = "是" if exhibit.is_fragile else "否"
            self.exhibits_tree.insert('', tk.END, values=(
                exhibit.exhibit_id,
                exhibit.name,
                exhibit.category or "-",
                exhibit.location or "-",
                fragile,
                exhibit.condition,
                exhibit.notes or "-"
            ))
    
    def _filter_exhibits(self, *args):
        """过滤展品"""
        search_text = self.exhibit_search_var.get().lower()
        
        # 清空
        for item in self.exhibits_tree.get_children():
            self.exhibits_tree.delete(item)
        
        if not self.state.current_project_data:
            return
        
        # 填充匹配的
        for exhibit in self.state.current_project_data.exhibits:
            if search_text in exhibit.exhibit_id.lower() or search_text in exhibit.name.lower():
                fragile = "是" if exhibit.is_fragile else "否"
                self.exhibits_tree.insert('', tk.END, values=(
                    exhibit.exhibit_id,
                    exhibit.name,
                    exhibit.category or "-",
                    exhibit.location or "-",
                    fragile,
                    exhibit.condition,
                    exhibit.notes or "-"
                ))
    
    def _refresh_scans(self):
        """刷新扫描表格"""
        for item in self.scans_tree.get_children():
            self.scans_tree.delete(item)
        
        if not self.state.current_project_data:
            return
        
        # 按箱号筛选
        box_filter = self.box_filter_var.get()
        
        for scan in self.state.current_project_data.scan_records:
            if box_filter != "全部" and scan.box_number != box_filter:
                continue
            
            temp = f"{scan.temperature}°C" if scan.temperature else "-"
            hum = f"{scan.humidity}%" if scan.humidity else "-"
            sig = "✓" if scan.has_signature else "✗"
            buf = "✓" if scan.buffer_verified else "✗"
            
            self.scans_tree.insert('', tk.END, values=(
                scan.scan_id,
                scan.exhibit_id,
                scan.box_number,
                scan.scan_time.strftime('%Y-%m-%d %H:%M:%S'),
                scan.operator,
                temp,
                hum,
                sig,
                buf
            ))
    
    def _update_box_filter(self):
        """更新箱号筛选下拉框"""
        if not self.state.current_project_data:
            self.box_filter_combo['values'] = ["全部"]
            return
        
        box_numbers = sorted(set(scan.box_number for scan in self.state.current_project_data.scan_records))
        self.box_filter_combo['values'] = ["全部"] + box_numbers
    
    def _filter_scans_by_box(self, event):
        """按箱号筛选扫描记录"""
        self._refresh_scans()
    
    def _refresh_timeline(self):
        """刷新时间线"""
        self.timeline_text.config(state=tk.NORMAL)
        self.timeline_text.delete(1.0, tk.END)
        
        if not self.state.current_project_data:
            self.timeline_text.config(state=tk.DISABLED)
            return
        
        # 按时间排序扫描记录
        sorted_scans = sorted(
            self.state.current_project_data.scan_records,
            key=lambda s: s.scan_time
        )
        
        if not sorted_scans:
            self.timeline_text.insert(tk.END, "暂无扫描记录\n")
            self.timeline_text.config(state=tk.DISABLED)
            return
        
        # 按日期分组
        from collections import defaultdict
        by_date = defaultdict(list)
        for scan in sorted_scans:
            date_key = scan.scan_time.strftime('%Y-%m-%d')
            by_date[date_key].append(scan)
        
        severity_names = {
            'critical': '严重',
            'high': '高',
            'medium': '中',
            'low': '低'
        }
        
        # 构建异常快速查找
        anomalies_by_exhibit = defaultdict(list)
        for anomaly in self.state.current_project_data.anomalies:
            if anomaly.exhibit_id:
                anomalies_by_exhibit[anomaly.exhibit_id].append(anomaly)
        
        for date in sorted(by_date.keys()):
            self.timeline_text.insert(tk.END, f"{'='*60}\n", 'time')
            self.timeline_text.insert(tk.END, f"【{date}】\n", 'time')
            self.timeline_text.insert(tk.END, f"{'='*60}\n\n")
            
            for scan in by_date[date]:
                time_str = scan.scan_time.strftime('%H:%M:%S')
                exhibit = self.state.current_project_data.get_exhibit_by_id(scan.exhibit_id)
                exhibit_name = exhibit.name if exhibit else "未知展品"
                
                # 检查是否有异常
                has_anomaly = scan.exhibit_id in anomalies_by_exhibit
                
                self.timeline_text.insert(tk.END, f"[{time_str}] ", 'time')
                self.timeline_text.insert(tk.END, f"箱号:{scan.box_number} ", 'box')
                self.timeline_text.insert(tk.END, f"展品:{scan.exhibit_id}({exhibit_name}) ", 'exhibit')
                self.timeline_text.insert(tk.END, f"操作人:{scan.operator}\n", 'operator')
                
                # 状态标记
                status_marks = []
                if scan.has_signature:
                    status_marks.append(("✓ 已签名", 'check'))
                else:
                    status_marks.append(("✗ 未签名", 'cross'))
                
                if scan.buffer_verified:
                    status_marks.append(("✓ 缓冲已确认", 'check'))
                else:
                    # 检查是否是易碎品
                    if exhibit and exhibit.is_fragile:
                        status_marks.append(("✗ 易碎品无缓冲确认", 'warning'))
                
                if status_marks:
                    self.timeline_text.insert(tk.END, f"  状态: ")
                    for mark, tag in status_marks:
                        self.timeline_text.insert(tk.END, f"{mark} ", tag)
                    self.timeline_text.insert(tk.END, "\n")
                
                # 异常标记
                if has_anomaly:
                    anomalies = anomalies_by_exhibit[scan.exhibit_id]
                    for anomaly in anomalies:
                        sev_name = severity_names.get(anomaly.severity, anomaly.severity)
                        self.timeline_text.insert(
                            tk.END, 
                            f"  ⚠ 异常 [{sev_name}]: {anomaly.anomaly_type}\n",
                            'warning'
                        )
                
                self.timeline_text.insert(tk.END, "\n")
        
        self.timeline_text.config(state=tk.DISABLED)
    
    def _refresh_anomalies(self):
        """刷新异常表格"""
        for item in self.anomalies_tree.get_children():
            self.anomalies_tree.delete(item)
        
        if not self.state.current_project_data:
            return
        
        severity_names = {
            'critical': '严重',
            'high': '高',
            'medium': '中',
            'low': '低'
        }
        
        # 应用筛选
        severity_filter = self.severity_filter_var.get()
        status_filter = self.status_filter_var.get()
        
        severity_map = {"严重": "critical", "高": "high", "中": "medium", "低": "low"}
        
        for anomaly in self.state.current_project_data.anomalies:
            # 严重程度筛选
            if severity_filter != "全部":
                target_severity = severity_map.get(severity_filter)
                if anomaly.severity != target_severity:
                    continue
            
            # 状态筛选
            if status_filter == "未解决" and anomaly.is_resolved:
                continue
            if status_filter == "已解决" and not anomaly.is_resolved:
                continue
            
            sev_name = severity_names.get(anomaly.severity, anomaly.severity)
            status = "已解决" if anomaly.is_resolved else "未解决"
            
            # 插入数据并保存anomaly_id作为iid
            item = self.anomalies_tree.insert('', tk.END, iid=anomaly.anomaly_id, values=(
                anomaly.anomaly_type,
                sev_name,
                anomaly.exhibit_id or "-",
                anomaly.box_number or "-",
                anomaly.description.replace('\n', ' ')[:80],
                status,
                anomaly.detected_time.strftime('%Y-%m-%d %H:%M:%S')
            ))
            
            # 设置标签颜色
            if anomaly.is_resolved:
                self.anomalies_tree.tag_configure('resolved', foreground='gray')
                self.anomalies_tree.item(item, tags=('resolved',))
            elif anomaly.severity == 'critical':
                self.anomalies_tree.tag_configure('critical', foreground='red', font=('Microsoft YaHei', 9, 'bold'))
                self.anomalies_tree.item(item, tags=('critical',))
            elif anomaly.severity == 'high':
                self.anomalies_tree.tag_configure('high', foreground='dark orange')
                self.anomalies_tree.item(item, tags=('high',))
    
    def _filter_anomalies(self, event=None):
        """过滤异常"""
        self._refresh_anomalies()
    
    def _on_anomaly_selected(self, event):
        """异常选择事件"""
        selection = self.anomalies_tree.selection()
        if not selection:
            return
        
        anomaly_id = selection[0]
        
        if not self.state.current_project_data:
            return
        
        # 找到对应的异常
        anomaly = next(
            (a for a in self.state.current_project_data.anomalies if a.anomaly_id == anomaly_id),
            None
        )
        
        if not anomaly:
            return
        
        # 显示详情
        self.anomaly_desc_text.config(state=tk.NORMAL)
        self.anomaly_desc_text.delete(1.0, tk.END)
        self.anomaly_desc_text.insert(tk.END, anomaly.description)
        self.anomaly_desc_text.config(state=tk.DISABLED)
        
        self.anomaly_suggest_text.config(state=tk.NORMAL)
        self.anomaly_suggest_text.delete(1.0, tk.END)
        self.anomaly_suggest_text.insert(tk.END, anomaly.suggestion or "无")
        self.anomaly_suggest_text.config(state=tk.DISABLED)
    
    def _submit_review(self):
        """提交复核意见"""
        selection = self.anomalies_tree.selection()
        if not selection:
            messagebox.showwarning("警告", "请先选择一个异常")
            return
        
        anomaly_id = selection[0]
        
        reviewer = self.reviewer_var.get().strip()
        comment = self.review_comment_text.get(1.0, tk.END).strip()
        
        if not reviewer:
            messagebox.showwarning("警告", "请输入复核人姓名")
            return
        
        if not comment:
            messagebox.showwarning("警告", "请输入复核意见")
            return
        
        # 创建复核意见
        review = ReviewComment(
            comment_id=str(__import__('uuid').uuid4()),
            anomaly_id=anomaly_id,
            reviewer=reviewer,
            comment=comment,
            review_time=datetime.now(),
            is_approved=self.is_approved_var.get(),
            follow_up_required=self.follow_up_var.get()
        )
        
        # 添加到项目数据
        if self.state.current_project_data:
            self.state.current_project_data.review_comments.append(review)
        
        # 如果保存了项目，也保存到数据库
        if self.state.current_project_id:
            self.state.db_manager.add_review_comment(self.state.current_project_id, review)
        
        # 清空输入
        self.review_comment_text.delete(1.0, tk.END)
        self.is_approved_var.set(False)
        self.follow_up_var.set(False)
        
        messagebox.showinfo("成功", "复核意见已提交")
        self._set_status("复核意见已提交")
    
    def _mark_resolved(self):
        """标记为已解决"""
        selection = self.anomalies_tree.selection()
        if not selection:
            messagebox.showwarning("警告", "请先选择一个异常")
            return
        
        anomaly_id = selection[0]
        reviewer = self.reviewer_var.get().strip() or "系统"
        
        # 更新内存中的数据
        if self.state.current_project_data:
            for anomaly in self.state.current_project_data.anomalies:
                if anomaly.anomaly_id == anomaly_id:
                    anomaly.is_resolved = True
                    anomaly.resolved_by = reviewer
                    anomaly.resolved_time = datetime.now()
                    anomaly.resolution_notes = self.review_comment_text.get(1.0, tk.END).strip()
                    break
        
        # 更新数据库
        if self.state.current_project_id:
            notes = self.review_comment_text.get(1.0, tk.END).strip()
            self.state.db_manager.update_anomaly_resolution(
                self.state.current_project_id,
                anomaly_id,
                True,
                reviewer,
                notes
            )
        
        # 刷新表格
        self._refresh_anomalies()
        self._update_stats()
        
        messagebox.showinfo("成功", "已标记为已解决")
        self._set_status("异常已标记为已解决")
    
    def _refresh_photos(self):
        """刷新照片表格"""
        for item in self.photos_tree.get_children():
            self.photos_tree.delete(item)
        
        if not self.state.current_project_data:
            return
        
        def format_size(size_bytes: int) -> str:
            for unit in ['B', 'KB', 'MB', 'GB']:
                if size_bytes < 1024:
                    return f"{size_bytes:.1f} {unit}"
                size_bytes /= 1024
            return f"{size_bytes:.1f} TB"
        
        for photo in self.state.current_project_data.photo_records:
            capture_time = photo.capture_time.strftime('%Y-%m-%d %H:%M:%S') if photo.capture_time else "-"
            exhibits = ', '.join(photo.exhibit_references) or "-"
            boxes = ', '.join(photo.box_references) or "-"
            
            self.photos_tree.insert('', tk.END, values=(
                photo.file_name,
                format_size(photo.file_size),
                capture_time,
                exhibits,
                boxes
            ))


def main():
    """主函数"""
    root = tk.Tk()
    app = MainWindow(root)
    root.mainloop()


if __name__ == "__main__":
    main()
