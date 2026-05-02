"""
播前音频质检台 - 主 GUI 模块
校园广播站导播用的本地桌面工具
"""

import tkinter as tk
from tkinter import ttk, filedialog, messagebox, scrolledtext
from typing import List, Dict, Any, Optional
import os
import threading
from datetime import datetime

# 导入模块
from audio_metadata import (
    AudioAnalyzer,
    AudioMetadata,
    ProgramScheduleItem,
    parse_program_schedule
)
from rules_engine import (
    RulesEngine,
    QualityCheckResult,
    QualityIssue,
    IssueSeverity,
    IssueType,
    QualityCheckConfig
)
from state_store import (
    StateStore,
    SessionState,
    save_project_state
)
from report_exporter import (
    ReportExporter,
    export_report
)
from sample_data import (
    generate_sample_schedule,
    generate_mock_audio_metadata,
    generate_mock_quality_issues,
    create_demo_project
)


class QualityCheckApp:
    """播前音频质检台主应用"""
    
    APP_NAME = "播前音频质检台"
    APP_VERSION = "1.0.0"
    
    def __init__(self, root: tk.Tk):
        self.root = root
        self.root.title(f"{self.APP_NAME} v{self.APP_VERSION}")
        self.root.geometry("1400x900")
        self.root.minsize(1200, 700)
        
        # 数据状态
        self.schedule_items: List[ProgramScheduleItem] = []
        self.audio_metadata: Dict[str, AudioMetadata] = {}
        self.quality_result: Optional[QualityCheckResult] = None
        self.current_session: Optional[SessionState] = None
        
        # 配置
        self.config = QualityCheckConfig()
        self.state_store = StateStore()
        
        # 文件路径
        self.schedule_csv_path: str = ""
        self.audio_directory: str = ""
        
        # 选中的问题索引
        self.selected_issue_index: int = -1
        
        # 创建界面
        self._create_menu()
        self._create_main_layout()
        
        # 状态栏
        self._create_status_bar()
        
        # 绑定事件
        self._bind_events()
        
        # 初始化提示
        self._log_message("欢迎使用播前音频质检台！请导入节目单和音频素材目录开始质检。")
    
    def _create_menu(self):
        """创建菜单栏"""
        menubar = tk.Menu(self.root)
        self.root.config(menu=menubar)
        
        # 文件菜单
        file_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="文件", menu=file_menu)
        
        file_menu.add_command(label="导入节目单 CSV", command=self._import_schedule)
        file_menu.add_command(label="导入音频目录", command=self._import_audio_directory)
        file_menu.add_separator()
        file_menu.add_command(label="保存会话状态", command=self._save_session)
        file_menu.add_command(label="加载最近会话", command=self._load_recent_session)
        file_menu.add_separator()
        file_menu.add_command(label="创建演示项目", command=self._create_demo)
        file_menu.add_separator()
        file_menu.add_command(label="退出", command=self.root.quit)
        
        # 操作菜单
        action_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="操作", menu=action_menu)
        
        action_menu.add_command(label="执行质检", command=self._run_quality_check)
        action_menu.add_command(label="重新分析音频", command=self._reanalyze_audio)
        action_menu.add_separator()
        action_menu.add_command(label="清空所有数据", command=self._clear_all_data)
        
        # 导出菜单
        export_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="导出", menu=export_menu)
        
        export_menu.add_command(label="Markdown 质检报告", command=lambda: self._export_report("markdown"))
        export_menu.add_command(label="CSV 问题清单", command=lambda: self._export_report("csv"))
        export_menu.add_command(label="JSON 审计记录", command=lambda: self._export_report("json"))
        export_menu.add_separator()
        export_menu.add_command(label="全部导出", command=self._export_all_reports)
        
        # 设置菜单
        settings_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="设置", menu=settings_menu)
        
        settings_menu.add_command(label="质检参数配置", command=self._show_settings_dialog)
        
        # 帮助菜单
        help_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="帮助", menu=help_menu)
        
        help_menu.add_command(label="关于", command=self._show_about)
    
    def _create_main_layout(self):
        """创建主界面布局"""
        # 主框架
        main_frame = ttk.Frame(self.root)
        main_frame.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)
        
        # 顶部信息栏
        top_frame = ttk.LabelFrame(main_frame, text="项目信息", padding=5)
        top_frame.pack(fill=tk.X, pady=(0, 5))
        
        # 节目单路径
        ttk.Label(top_frame, text="节目单:").grid(row=0, column=0, sticky=tk.W, padx=5)
        self.schedule_path_var = tk.StringVar(value="未选择")
        ttk.Entry(top_frame, textvariable=self.schedule_path_var, width=60, state='readonly').grid(
            row=0, column=1, padx=5, sticky=tk.W
        )
        ttk.Button(top_frame, text="选择...", command=self._import_schedule).grid(row=0, column=2, padx=5)
        
        # 音频目录路径
        ttk.Label(top_frame, text="音频目录:").grid(row=1, column=0, sticky=tk.W, padx=5, pady=(5, 0))
        self.audio_dir_var = tk.StringVar(value="未选择")
        ttk.Entry(top_frame, textvariable=self.audio_dir_var, width=60, state='readonly').grid(
            row=1, column=1, padx=5, pady=(5, 0), sticky=tk.W
        )
        ttk.Button(top_frame, text="选择...", command=self._import_audio_directory).grid(
            row=1, column=2, padx=5, pady=(5, 0)
        )
        
        # 操作按钮
        button_frame = ttk.Frame(top_frame)
        button_frame.grid(row=0, column=3, rowspan=2, padx=20)
        
        self.check_button = ttk.Button(
            button_frame, text="▶ 执行质检", command=self._run_quality_check, width=15
        )
        self.check_button.pack(pady=2)
        
        ttk.Button(
            button_frame, text="📊 统计概览", command=self._show_statistics, width=15
        ).pack(pady=2)
        
        # 中间区域 - PanedWindow
        paned = ttk.PanedWindow(main_frame, orient=tk.HORIZONTAL)
        paned.pack(fill=tk.BOTH, expand=True)
        
        # 左侧：时间线 + 音频列表
        left_notebook = ttk.Notebook(paned)
        paned.add(left_notebook, weight=1)
        
        # 时间线标签页
        timeline_frame = ttk.Frame(left_notebook)
        left_notebook.add(timeline_frame, text="📅 排播时间线")
        
        # 时间线 Treeview
        timeline_columns = ("id", "type", "title", "start", "end", "duration", "audio", "status")
        self.timeline_tree = ttk.Treeview(
            timeline_frame, columns=timeline_columns, show="headings", height=15
        )
        
        # 设置列
        self.timeline_tree.heading("id", text="编号")
        self.timeline_tree.heading("type", text="类型")
        self.timeline_tree.heading("title", text="标题")
        self.timeline_tree.heading("start", text="开始时间")
        self.timeline_tree.heading("end", text="结束时间")
        self.timeline_tree.heading("duration", text="时长")
        self.timeline_tree.heading("audio", text="音频文件")
        self.timeline_tree.heading("status", text="状态")
        
        self.timeline_tree.column("id", width=60)
        self.timeline_tree.column("type", width=60)
        self.timeline_tree.column("title", width=150)
        self.timeline_tree.column("start", width=90)
        self.timeline_tree.column("end", width=90)
        self.timeline_tree.column("duration", width=70)
        self.timeline_tree.column("audio", width=150)
        self.timeline_tree.column("status", width=80)
        
        # 滚动条
        timeline_scroll = ttk.Scrollbar(timeline_frame, orient=tk.VERTICAL, command=self.timeline_tree.yview)
        self.timeline_tree.configure(yscrollcommand=timeline_scroll.set)
        
        self.timeline_tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        timeline_scroll.pack(side=tk.RIGHT, fill=tk.Y)
        
        # 音频文件列表标签页
        audio_frame = ttk.Frame(left_notebook)
        left_notebook.add(audio_frame, text="🎵 音频文件")
        
        audio_columns = ("filename", "format", "sample_rate", "channels", "duration", "peak", "rms")
        self.audio_tree = ttk.Treeview(
            audio_frame, columns=audio_columns, show="headings", height=15
        )
        
        self.audio_tree.heading("filename", text="文件名")
        self.audio_tree.heading("format", text="格式")
        self.audio_tree.heading("sample_rate", text="采样率")
        self.audio_tree.heading("channels", text="声道")
        self.audio_tree.heading("duration", text="时长")
        self.audio_tree.heading("peak", text="峰值")
        self.audio_tree.heading("rms", text="平均音量")
        
        self.audio_tree.column("filename", width=180)
        self.audio_tree.column("format", width=60)
        self.audio_tree.column("sample_rate", width=80)
        self.audio_tree.column("channels", width=60)
        self.audio_tree.column("duration", width=80)
        self.audio_tree.column("peak", width=80)
        self.audio_tree.column("rms", width=100)
        
        audio_scroll = ttk.Scrollbar(audio_frame, orient=tk.VERTICAL, command=self.audio_tree.yview)
        self.audio_tree.configure(yscrollcommand=audio_scroll.set)
        
        self.audio_tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        audio_scroll.pack(side=tk.RIGHT, fill=tk.Y)
        
        # 右侧：问题列表 + 详情
        right_notebook = ttk.Notebook(paned)
        paned.add(right_notebook, weight=1)
        
        # 问题列表标签页
        issues_frame = ttk.Frame(right_notebook)
        right_notebook.add(issues_frame, text="🐛 质检问题")
        
        # 问题过滤器
        filter_frame = ttk.Frame(issues_frame)
        filter_frame.pack(fill=tk.X, pady=5)
        
        ttk.Label(filter_frame, text="筛选:").pack(side=tk.LEFT, padx=5)
        
        self.filter_severity = ttk.Combobox(
            filter_frame, values=["全部", "严重", "警告", "信息", "未解决", "已解决"], width=12
        )
        self.filter_severity.set("全部")
        self.filter_severity.pack(side=tk.LEFT, padx=5)
        self.filter_severity.bind("<<ComboboxSelected>>", lambda e: self._filter_issues())
        
        # 问题列表 Treeview
        issues_columns = ("severity", "type", "item_id", "title", "audio", "status")
        self.issues_tree = ttk.Treeview(
            issues_frame, columns=issues_columns, show="headings", height=12
        )
        
        self.issues_tree.heading("severity", text="严重程度")
        self.issues_tree.heading("type", text="问题类型")
        self.issues_tree.heading("item_id", text="条目编号")
        self.issues_tree.heading("title", text="标题")
        self.issues_tree.heading("audio", text="音频文件")
        self.issues_tree.heading("status", text="处理状态")
        
        self.issues_tree.column("severity", width=70)
        self.issues_tree.column("type", width=90)
        self.issues_tree.column("item_id", width=70)
        self.issues_tree.column("title", width=120)
        self.issues_tree.column("audio", width=130)
        self.issues_tree.column("status", width=80)
        
        issues_scroll = ttk.Scrollbar(issues_frame, orient=tk.VERTICAL, command=self.issues_tree.yview)
        self.issues_tree.configure(yscrollcommand=issues_scroll.set)
        
        self.issues_tree.pack(side=tk.TOP, fill=tk.BOTH, expand=True, pady=(0, 5))
        issues_scroll.pack(side=tk.RIGHT, fill=tk.Y, pady=(0, 5))
        
        # 问题详情面板
        detail_frame = ttk.LabelFrame(issues_frame, text="问题详情", padding=5)
        detail_frame.pack(fill=tk.X, side=tk.BOTTOM)
        
        # 问题描述
        ttk.Label(detail_frame, text="问题描述:").grid(row=0, column=0, sticky=tk.NW, padx=5, pady=2)
        self.issue_description = scrolledtext.ScrolledText(
            detail_frame, width=70, height=3, wrap=tk.WORD
        )
        self.issue_description.grid(row=0, column=1, columnspan=3, padx=5, pady=2, sticky=tk.W)
        
        # 期望值/实际值
        ttk.Label(detail_frame, text="期望值:").grid(row=1, column=0, sticky=tk.W, padx=5, pady=2)
        self.expected_value_var = tk.StringVar()
        ttk.Entry(detail_frame, textvariable=self.expected_value_var, width=25, state='readonly').grid(
            row=1, column=1, padx=5, pady=2, sticky=tk.W
        )
        
        ttk.Label(detail_frame, text="实际值:").grid(row=1, column=2, sticky=tk.W, padx=5, pady=2)
        self.actual_value_var = tk.StringVar()
        ttk.Entry(detail_frame, textvariable=self.actual_value_var, width=25, state='readonly').grid(
            row=1, column=3, padx=5, pady=2, sticky=tk.W
        )
        
        # 处理动作
        ttk.Label(detail_frame, text="处理动作:").grid(row=2, column=0, sticky=tk.W, padx=5, pady=2)
        
        action_frame = ttk.Frame(detail_frame)
        action_frame.grid(row=2, column=1, columnspan=3, sticky=tk.W, padx=5, pady=2)
        
        ttk.Button(action_frame, text="✅ 接受", command=lambda: self._set_issue_resolution("accept")).pack(side=tk.LEFT, padx=2)
        ttk.Button(action_frame, text="🔧 需修复", command=lambda: self._set_issue_resolution("needs_fix")).pack(side=tk.LEFT, padx=2)
        ttk.Button(action_frame, text="⏳ 延后", command=lambda: self._set_issue_resolution("deferred")).pack(side=tk.LEFT, padx=2)
        ttk.Button(action_frame, text="❌ 驳回", command=lambda: self._set_issue_resolution("reject")).pack(side=tk.LEFT, padx=2)
        ttk.Button(action_frame, text="🔄 重置", command=self._reset_issue_resolution).pack(side=tk.LEFT, padx=2)
        
        # 处理备注
        ttk.Label(detail_frame, text="处理备注:").grid(row=3, column=0, sticky=tk.NW, padx=5, pady=2)
        self.resolution_note = scrolledtext.ScrolledText(
            detail_frame, width=70, height=2, wrap=tk.WORD
        )
        self.resolution_note.grid(row=3, column=1, columnspan=3, padx=5, pady=2, sticky=tk.W)
        
        # 底部日志区域
        log_frame = ttk.LabelFrame(main_frame, text="操作日志", padding=5)
        log_frame.pack(fill=tk.X, pady=(5, 0))
        
        self.log_text = scrolledtext.ScrolledText(
            log_frame, height=4, wrap=tk.WORD, state=tk.DISABLED
        )
        self.log_text.pack(fill=tk.X)
    
    def _create_status_bar(self):
        """创建状态栏"""
        self.status_bar = ttk.Frame(self.root)
        self.status_bar.pack(side=tk.BOTTOM, fill=tk.X)
        
        self.status_items = {}
        
        # 节目单数量
        self.status_items["schedule"] = ttk.Label(
            self.status_bar, text="节目单: 0 条", relief=tk.SUNKEN, anchor=tk.W
        )
        self.status_items["schedule"].pack(side=tk.LEFT, fill=tk.X, expand=True, padx=2, pady=1)
        
        # 音频文件数量
        self.status_items["audio"] = ttk.Label(
            self.status_bar, text="音频: 0 个", relief=tk.SUNKEN, anchor=tk.W
        )
        self.status_items["audio"].pack(side=tk.LEFT, fill=tk.X, expand=True, padx=2, pady=1)
        
        # 问题统计
        self.status_items["issues"] = ttk.Label(
            self.status_bar, text="问题: 0", relief=tk.SUNKEN, anchor=tk.W
        )
        self.status_items["issues"].pack(side=tk.LEFT, fill=tk.X, expand=True, padx=2, pady=1)
        
        # 状态指示
        self.status_items["ready"] = ttk.Label(
            self.status_bar, text="就绪", relief=tk.SUNKEN, anchor=tk.W
        )
        self.status_items["ready"].pack(side=tk.LEFT, fill=tk.X, expand=True, padx=2, pady=1)
    
    def _bind_events(self):
        """绑定事件"""
        self.issues_tree.bind("<<TreeviewSelect>>", self._on_issue_select)
        self.timeline_tree.bind("<<TreeviewSelect>>", self._on_timeline_select)
        self.audio_tree.bind("<<TreeviewSelect>>", self._on_audio_select)
    
    def _log_message(self, message: str, level: str = "INFO"):
        """记录日志消息"""
        timestamp = datetime.now().strftime("%H:%M:%S")
        log_entry = f"[{timestamp}] [{level}] {message}\n"
        
        self.log_text.configure(state=tk.NORMAL)
        self.log_text.insert(tk.END, log_entry)
        self.log_text.see(tk.END)
        self.log_text.configure(state=tk.DISABLED)
    
    def _update_status(self):
        """更新状态栏"""
        schedule_count = len(self.schedule_items)
        audio_count = len(self.audio_metadata)
        
        self.status_items["schedule"].config(text=f"节目单: {schedule_count} 条")
        self.status_items["audio"].config(text=f"音频: {audio_count} 个")
        
        if self.quality_result:
            issue_count = len(self.quality_result.issues)
            critical = self.quality_result.critical_count
            warning = self.quality_result.warning_count
            unresolved = len(self.quality_result.unresolved_issues)
            
            status_text = f"问题: {issue_count} (严重:{critical}, 警告:{warning}, 未解决:{unresolved})"
            self.status_items["issues"].config(text=status_text)
            
            if self.quality_result.has_critical_issues:
                self.status_items["ready"].config(text="⚠️ 有严重问题")
            elif self.quality_result.has_warnings:
                self.status_items["ready"].config(text="ℹ️ 有警告")
            else:
                self.status_items["ready"].config(text="✅ 全部通过")
        else:
            self.status_items["issues"].config(text="问题: 0")
            self.status_items["ready"].config(text="就绪")
    
    def _import_schedule(self):
        """导入节目单 CSV"""
        file_path = filedialog.askopenfilename(
            title="选择节目单 CSV 文件",
            filetypes=[("CSV 文件", "*.csv"), ("所有文件", "*.*")]
        )
        
        if not file_path:
            return
        
        try:
            self.schedule_items = parse_program_schedule(file_path)
            self.schedule_csv_path = file_path
            self.schedule_path_var.set(file_path)
            
            self._log_message(f"已导入节目单: {os.path.basename(file_path)}, 共 {len(self.schedule_items)} 条")
            self._refresh_timeline_view()
            self._update_status()
            
            # 尝试加载之前的会话状态
            if self.audio_directory:
                self._try_load_existing_session()
                
        except Exception as e:
            messagebox.showerror("导入失败", f"解析节目单时出错: {str(e)}")
            self._log_message(f"导入节目单失败: {str(e)}", "ERROR")
    
    def _import_audio_directory(self):
        """导入音频目录"""
        directory = filedialog.askdirectory(title="选择音频素材目录")
        
        if not directory:
            return
        
        self.audio_directory = directory
        self.audio_dir_var.set(directory)
        
        # 在后台线程分析音频
        self._analyze_audio_in_background(directory)
        
        # 尝试加载之前的会话状态
        if self.schedule_csv_path:
            self._try_load_existing_session()
    
    def _analyze_audio_in_background(self, directory: str):
        """在后台线程分析音频文件"""
        
        def analyze():
            try:
                self.root.after(0, lambda: self._log_message(f"正在分析音频文件: {directory}"))
                self.root.after(0, lambda: self.status_items["ready"].config(text="⏳ 分析中..."))
                
                analyzer = AudioAnalyzer(
                    silence_threshold_db=self.config.silence_threshold_db,
                    silence_min_duration_ms=self.config.silence_min_duration_ms
                )
                
                self.audio_metadata = analyzer.analyze_directory(directory)
                
                self.root.after(0, self._on_audio_analysis_complete)
                
            except Exception as e:
                self.root.after(0, lambda: self._log_message(f"音频分析失败: {str(e)}", "ERROR"))
                self.root.after(0, lambda: self.status_items["ready"].config(text="就绪"))
        
        thread = threading.Thread(target=analyze, daemon=True)
        thread.start()
    
    def _on_audio_analysis_complete(self):
        """音频分析完成回调"""
        count = len(self.audio_metadata)
        self._log_message(f"音频分析完成: 共 {count} 个文件")
        self._refresh_audio_view()
        self._update_status()
    
    def _try_load_existing_session(self):
        """尝试加载现有会话"""
        if not self.schedule_csv_path or not self.audio_directory:
            return
        
        existing_session = self.state_store.load_session_by_paths(
            self.schedule_csv_path, self.audio_directory
        )
        
        if existing_session:
            self.current_session = existing_session
            self._log_message(f"已加载之前的会话状态 (创建于 {existing_session.created_at[:19]})")
            
            # 如果已经有质检结果，应用处理记录
            if self.quality_result and existing_session.issue_resolutions:
                self.quality_result.issues = self.state_store.apply_resolutions_to_issues(
                    existing_session, self.quality_result.issues
                )
                self._refresh_issues_view()
    
    def _run_quality_check(self):
        """执行质检"""
        if not self.schedule_items:
            messagebox.showwarning("提示", "请先导入节目单 CSV 文件")
            return
        
        if not self.audio_metadata and not self.audio_directory:
            messagebox.showwarning("提示", "请先导入音频素材目录")
            return
        
        # 如果还没有分析音频但已选择目录
        if not self.audio_metadata and self.audio_directory:
            self._log_message("音频文件尚未分析，正在分析...")
            analyzer = AudioAnalyzer()
            self.audio_metadata = analyzer.analyze_directory(self.audio_directory)
        
        self._log_message("开始执行质检...")
        self.status_items["ready"].config(text="⏳ 质检中...")
        
        def run_check():
            try:
                engine = RulesEngine(self.config)
                result = engine.run_all_checks(
                    schedule_items=self.schedule_items,
                    audio_metadata=self.audio_metadata,
                    audio_directory=self.audio_directory
                )
                
                # 应用之前的处理记录
                if self.current_session and self.current_session.issue_resolutions:
                    result.issues = self.state_store.apply_resolutions_to_issues(
                        self.current_session, result.issues
                    )
                
                self.root.after(0, lambda: self._on_quality_check_complete(result))
                
            except Exception as e:
                self.root.after(0, lambda: self._log_message(f"质检失败: {str(e)}", "ERROR"))
                self.root.after(0, lambda: self.status_items["ready"].config(text="就绪"))
        
        thread = threading.Thread(target=run_check, daemon=True)
        thread.start()
    
    def _on_quality_check_complete(self, result: QualityCheckResult):
        """质检完成回调"""
        self.quality_result = result
        
        critical = result.critical_count
        warning = result.warning_count
        total = len(result.issues)
        unresolved = len(result.unresolved_issues)
        
        self._log_message(f"质检完成: 共 {total} 个问题 (严重:{critical}, 警告:{warning}, 未解决:{unresolved})")
        
        self._refresh_issues_view()
        self._refresh_timeline_view()  # 更新时间线状态
        self._update_status()
        
        if result.has_critical_issues:
            messagebox.showwarning("质检结果", f"发现 {critical} 个严重问题，请优先处理！")
    
    def _reanalyze_audio(self):
        """重新分析音频"""
        if not self.audio_directory:
            messagebox.showwarning("提示", "请先选择音频目录")
            return
        
        self._analyze_audio_in_background(self.audio_directory)
    
    def _refresh_timeline_view(self):
        """刷新时间线视图"""
        # 清空现有数据
        for item in self.timeline_tree.get_children():
            self.timeline_tree.delete(item)
        
        # 按开始时间排序
        sorted_items = sorted(
            self.schedule_items,
            key=lambda x: x._time_to_seconds(x.start_time)
        )
        
        for item in sorted_items:
            # 确定状态
            status = "正常"
            status_color = ""
            
            if self.quality_result:
                # 检查是否有与此条目相关的问题
                for issue in self.quality_result.issues:
                    if issue.item_id == item.item_id and not issue.resolved:
                        if issue.severity == IssueSeverity.CRITICAL:
                            status = "严重"
                            status_color = "red"
                            break
                        elif issue.severity == IssueSeverity.WARNING and status != "严重":
                            status = "警告"
                            status_color = "orange"
            
            # 检查音频文件是否存在
            if item.audio_file and item.audio_file not in self.audio_metadata:
                if status != "严重":
                    status = "缺文件"
                    status_color = "red"
            
            values = (
                item.item_id,
                item.type_display,
                item.title,
                item.start_time,
                item.end_time_formatted[:8],
                item.duration_formatted,
                item.audio_file or "-",
                status
            )
            
            tree_item = self.timeline_tree.insert("", tk.END, values=values)
            
            # 设置颜色标签
            if status_color == "red":
                self.timeline_tree.item(tree_item, tags=("critical",))
            elif status_color == "orange":
                self.timeline_tree.item(tree_item, tags=("warning",))
        
        # 设置样式
        self.timeline_tree.tag_configure("critical", foreground="red")
        self.timeline_tree.tag_configure("warning", foreground="orange")
    
    def _refresh_audio_view(self):
        """刷新音频文件视图"""
        for item in self.audio_tree.get_children():
            self.audio_tree.delete(item)
        
        for filename, metadata in self.audio_metadata.items():
            peak_str = f"{metadata.peak_dbfs:.1f} dBFS" if metadata.peak_dbfs > -float('inf') else "N/A"
            rms_str = f"{metadata.rms_dbfs:.1f} dBFS" if metadata.rms_dbfs > -float('inf') else "N/A"
            
            channels_str = "立体声" if metadata.channels == 2 else f"{metadata.channels}声道"
            
            values = (
                filename,
                metadata.format_str,
                f"{metadata.sample_rate} Hz" if metadata.sample_rate else "N/A",
                channels_str,
                metadata.duration_formatted,
                peak_str,
                rms_str
            )
            
            tree_item = self.audio_tree.insert("", tk.END, values=values)
            
            # 标记有问题的音频
            if self.quality_result:
                for issue in self.quality_result.issues:
                    if issue.audio_file == filename and not issue.resolved:
                        if issue.severity == IssueSeverity.CRITICAL:
                            self.audio_tree.item(tree_item, tags=("critical",))
                            break
                        elif issue.severity == IssueSeverity.WARNING:
                            self.audio_tree.item(tree_item, tags=("warning",))
        
        self.audio_tree.tag_configure("critical", foreground="red")
        self.audio_tree.tag_configure("warning", foreground="orange")
    
    def _refresh_issues_view(self):
        """刷新问题列表视图"""
        for item in self.issues_tree.get_children():
            self.issues_tree.delete(item)
        
        if not self.quality_result:
            return
        
        issues = self._get_filtered_issues()
        
        for idx, issue in enumerate(issues):
            # 严重程度图标
            severity_icon = "🔴" if issue.severity == IssueSeverity.CRITICAL else \
                           "🟡" if issue.severity == IssueSeverity.WARNING else "🔵"
            
            values = (
                f"{severity_icon} {issue.severity_display}",
                issue.issue_type_display,
                issue.item_id or "-",
                issue.title or "-",
                issue.audio_file or "-",
                issue.resolution_display
            )
            
            tree_item = self.issues_tree.insert("", tk.END, values=values, iid=str(idx))
            
            # 设置标签
            if issue.severity == IssueSeverity.CRITICAL:
                tag = "critical" if not issue.resolved else "resolved_critical"
            elif issue.severity == IssueSeverity.WARNING:
                tag = "warning" if not issue.resolved else "resolved_warning"
            else:
                tag = "info" if not issue.resolved else "resolved_info"
            
            self.issues_tree.item(tree_item, tags=(tag,))
        
        # 配置样式
        self.issues_tree.tag_configure("critical", foreground="red")
        self.issues_tree.tag_configure("warning", foreground="orange")
        self.issues_tree.tag_configure("info", foreground="blue")
        self.issues_tree.tag_configure("resolved_critical", foreground="gray")
        self.issues_tree.tag_configure("resolved_warning", foreground="gray")
        self.issues_tree.tag_configure("resolved_info", foreground="gray")
    
    def _get_filtered_issues(self) -> List[QualityIssue]:
        """获取筛选后的问题列表"""
        if not self.quality_result:
            return []
        
        filter_value = self.filter_severity.get()
        
        if filter_value == "全部":
            return self.quality_result.issues
        elif filter_value == "未解决":
            return self.quality_result.unresolved_issues
        elif filter_value == "已解决":
            return self.quality_result.resolved_issues
        elif filter_value == "严重":
            return [i for i in self.quality_result.issues if i.severity == IssueSeverity.CRITICAL]
        elif filter_value == "警告":
            return [i for i in self.quality_result.issues if i.severity == IssueSeverity.WARNING]
        elif filter_value == "信息":
            return [i for i in self.quality_result.issues if i.severity == IssueSeverity.INFO]
        
        return self.quality_result.issues
    
    def _filter_issues(self):
        """筛选问题"""
        self._refresh_issues_view()
    
    def _on_issue_select(self, event):
        """问题选择事件"""
        selection = self.issues_tree.selection()
        if not selection:
            return
        
        try:
            issue_idx = int(selection[0])
            filtered_issues = self._get_filtered_issues()
            
            if issue_idx < len(filtered_issues):
                issue = filtered_issues[issue_idx]
                self.selected_issue_index = issue_idx
                
                # 填充详情
                self.issue_description.delete(1.0, tk.END)
                self.issue_description.insert(tk.END, issue.message)
                
                self.expected_value_var.set(str(issue.expected_value) if issue.expected_value else "")
                self.actual_value_var.set(str(issue.actual_value) if issue.actual_value else "")
                
                # 填充处理备注
                self.resolution_note.delete(1.0, tk.END)
                if issue.resolution_note:
                    self.resolution_note.insert(tk.END, issue.resolution_note)
                    
        except (ValueError, IndexError):
            pass
    
    def _on_timeline_select(self, event):
        """时间线选择事件"""
        pass
    
    def _on_audio_select(self, event):
        """音频文件选择事件"""
        pass
    
    def _set_issue_resolution(self, action: str):
        """设置问题处理动作"""
        if self.selected_issue_index < 0 or not self.quality_result:
            return
        
        filtered_issues = self._get_filtered_issues()
        if self.selected_issue_index >= len(filtered_issues):
            return
        
        issue = filtered_issues[self.selected_issue_index]
        
        # 获取备注
        note = self.resolution_note.get(1.0, tk.END).strip()
        
        # 更新问题状态
        issue.resolution_action = action
        issue.resolution_note = note
        issue.resolved = True
        
        # 保存到会话
        self._save_issue_to_session(issue, self.selected_issue_index)
        
        self._log_message(f"已标记问题: {issue.issue_type_display} -> {action} ({note if note else '无备注'})")
        
        # 刷新视图
        self._refresh_issues_view()
        self._refresh_timeline_view()
        self._refresh_audio_view()
        self._update_status()
    
    def _reset_issue_resolution(self):
        """重置问题处理状态"""
        if self.selected_issue_index < 0 or not self.quality_result:
            return
        
        filtered_issues = self._get_filtered_issues()
        if self.selected_issue_index >= len(filtered_issues):
            return
        
        issue = filtered_issues[self.selected_issue_index]
        
        issue.resolution_action = ""
        issue.resolution_note = ""
        issue.resolved = False
        
        self.resolution_note.delete(1.0, tk.END)
        
        self._log_message(f"已重置问题状态: {issue.issue_type_display}")
        
        self._refresh_issues_view()
        self._refresh_timeline_view()
        self._refresh_audio_view()
        self._update_status()
    
    def _save_issue_to_session(self, issue: QualityIssue, index: int):
        """保存问题到会话状态"""
        if not self.current_session:
            if self.schedule_csv_path and self.audio_directory:
                self.current_session = self.state_store.create_new_session(
                    project_name=os.path.basename(self.schedule_csv_path),
                    schedule_csv_path=self.schedule_csv_path,
                    audio_directory=self.audio_directory
                )
        
        if self.current_session:
            self.state_store.update_issue_resolution(
                state=self.current_session,
                issue=issue,
                issue_index=index,
                resolution_action=issue.resolution_action,
                resolution_note=issue.resolution_note
            )
    
    def _save_session(self):
        """保存会话状态"""
        if not self.schedule_csv_path or not self.audio_directory:
            messagebox.showwarning("提示", "请先导入节目单和音频目录")
            return
        
        if self.quality_result:
            # 保存所有问题状态
            for idx, issue in enumerate(self.quality_result.issues):
                if issue.resolved or issue.resolution_action:
                    self._save_issue_to_session(issue, idx)
        
        if self.current_session:
            saved_path = self.state_store.save_session(self.current_session)
            self._log_message(f"会话状态已保存: {saved_path}")
            messagebox.showinfo("保存成功", f"会话状态已保存到:\n{saved_path}")
        else:
            # 使用便捷函数保存
            if self.quality_result:
                saved_path = save_project_state(
                    schedule_path=self.schedule_csv_path,
                    audio_dir=self.audio_directory,
                    issues=self.quality_result.issues,
                    project_name=os.path.basename(self.schedule_csv_path)
                )
                self._log_message(f"会话状态已保存: {saved_path}")
                messagebox.showinfo("保存成功", f"会话状态已保存到:\n{saved_path}")
    
    def _load_recent_session(self):
        """加载最近会话"""
        sessions = self.state_store.list_saved_sessions()
        
        if not sessions:
            messagebox.showinfo("提示", "没有找到已保存的会话")
            return
        
        # 显示会话选择对话框
        self._show_session_dialog(sessions)
    
    def _show_session_dialog(self, sessions: List[Dict[str, Any]]):
        """显示会话选择对话框"""
        dialog = tk.Toplevel(self.root)
        dialog.title("选择会话")
        dialog.geometry("600x400")
        dialog.transient(self.root)
        dialog.grab_set()
        
        # 会话列表
        columns = ("project", "created", "updated", "issues")
        tree = ttk.Treeview(dialog, columns=columns, show="headings", height=15)
        
        tree.heading("project", text="项目名称")
        tree.heading("created", text="创建时间")
        tree.heading("updated", text="更新时间")
        tree.heading("issues", text="已处理问题")
        
        tree.column("project", width=200)
        tree.column("created", width=150)
        tree.column("updated", width=150)
        tree.column("issues", width=80)
        
        scroll = ttk.Scrollbar(dialog, orient=tk.VERTICAL, command=tree.yview)
        tree.configure(yscrollcommand=scroll.set)
        
        tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, padx=10, pady=10)
        scroll.pack(side=tk.RIGHT, fill=tk.Y, pady=10)
        
        # 填充数据
        for session in sessions:
            created = session["created_at"][:19] if session["created_at"] else "-"
            updated = session["updated_at"][:19] if session["updated_at"] else "-"
            
            tree.insert("", tk.END, values=(
                session["project_name"],
                created,
                updated,
                session["resolution_count"]
            ), iid=session["session_id"])
        
        # 按钮区域
        button_frame = ttk.Frame(dialog)
        button_frame.pack(fill=tk.X, padx=10, pady=10)
        
        def on_load():
            selection = tree.selection()
            if not selection:
                messagebox.showwarning("提示", "请选择一个会话")
                return
            
            session_id = selection[0]
            session = self.state_store.load_session(session_id)
            
            if session:
                # 尝试加载路径
                if os.path.exists(session.schedule_csv_path):
                    self.schedule_csv_path = session.schedule_csv_path
                    self.schedule_path_var.set(session.schedule_csv_path)
                    self.schedule_items = parse_program_schedule(session.schedule_csv_path)
                
                if os.path.exists(session.audio_directory):
                    self.audio_directory = session.audio_directory
                    self.audio_dir_var.set(session.audio_directory)
                    self._analyze_audio_in_background(session.audio_directory)
                
                self.current_session = session
                self._log_message(f"已加载会话: {session.project_name}")
                
                dialog.destroy()
        
        ttk.Button(button_frame, text="加载选中", command=on_load).pack(side=tk.RIGHT, padx=5)
        ttk.Button(button_frame, text="取消", command=dialog.destroy).pack(side=tk.RIGHT, padx=5)
    
    def _create_demo(self):
        """创建演示项目"""
        demo_dir = filedialog.askdirectory(title="选择演示项目保存目录")
        
        if not demo_dir:
            return
        
        try:
            files = create_demo_project(demo_dir)
            
            # 同时设置为当前项目
            self.schedule_csv_path = files["schedule"]
            self.schedule_path_var.set(files["schedule"])
            self.schedule_items = parse_program_schedule(files["schedule"])
            
            self.audio_directory = os.path.dirname(files["audio_readme"])
            self.audio_dir_var.set(self.audio_directory)
            
            # 使用模拟数据
            self.audio_metadata = generate_mock_audio_metadata()
            
            # 执行质检（使用模拟数据）
            self.quality_result = QualityCheckResult()
            self.quality_result.issues = generate_mock_quality_issues()
            self.quality_result.total_checks = len(self.quality_result.issues)
            self.quality_result.critical_count = sum(
                1 for i in self.quality_result.issues if i.severity == IssueSeverity.CRITICAL
            )
            self.quality_result.warning_count = sum(
                1 for i in self.quality_result.issues if i.severity == IssueSeverity.WARNING
            )
            
            # 刷新界面
            self._refresh_timeline_view()
            self._refresh_audio_view()
            self._refresh_issues_view()
            self._update_status()
            
            self._log_message(f"演示项目已创建在: {demo_dir}")
            self._log_message(f"已生成 {len(self.quality_result.issues)} 个演示问题")
            
            messagebox.showinfo("演示项目", f"演示项目已创建在:\n{demo_dir}\n\n包含 {len(self.quality_result.issues)} 个演示问题。")
            
        except Exception as e:
            messagebox.showerror("创建失败", f"创建演示项目时出错: {str(e)}")
            self._log_message(f"创建演示项目失败: {str(e)}", "ERROR")
    
    def _clear_all_data(self):
        """清空所有数据"""
        if messagebox.askyesno("确认", "确定要清空所有数据吗？"):
            self.schedule_items = []
            self.audio_metadata = {}
            self.quality_result = None
            self.current_session = None
            self.schedule_csv_path = ""
            self.audio_directory = ""
            
            self.schedule_path_var.set("未选择")
            self.audio_dir_var.set("未选择")
            
            # 清空视图
            for tree in [self.timeline_tree, self.audio_tree, self.issues_tree]:
                for item in tree.get_children():
                    tree.delete(item)
            
            # 清空详情
            self.issue_description.delete(1.0, tk.END)
            self.expected_value_var.set("")
            self.actual_value_var.set("")
            self.resolution_note.delete(1.0, tk.END)
            
            self._update_status()
            self._log_message("所有数据已清空")
    
    def _export_report(self, format_type: str):
        """导出报告"""
        if not self.quality_result:
            messagebox.showwarning("提示", "请先执行质检")
            return
        
        # 建议文件名
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        if format_type == "markdown":
            default_name = f"quality_report_{timestamp}.md"
            filetypes = [("Markdown 文件", "*.md")]
        elif format_type == "csv":
            default_name = f"issues_{timestamp}.csv"
            filetypes = [("CSV 文件", "*.csv")]
        else:  # json
            default_name = f"audit_log_{timestamp}.json"
            filetypes = [("JSON 文件", "*.json")]
        
        file_path = filedialog.asksaveasfilename(
            title="保存报告",
            initialfile=default_name,
            filetypes=filetypes
        )
        
        if not file_path:
            return
        
        try:
            exporter = ReportExporter()
            
            if format_type == "markdown":
                saved_path = exporter.export_markdown_report(
                    result=self.quality_result,
                    schedule_items=self.schedule_items,
                    audio_metadata=self.audio_metadata,
                    config=self.config,
                    output_path=file_path
                )
            elif format_type == "csv":
                saved_path = exporter.export_csv_issue_list(
                    result=self.quality_result,
                    output_path=file_path
                )
            else:
                saved_path = exporter.export_json_audit_log(
                    result=self.quality_result,
                    schedule_items=self.schedule_items,
                    audio_metadata=self.audio_metadata,
                    config=self.config,
                    output_path=file_path
                )
            
            self._log_message(f"报告已导出: {saved_path}")
            messagebox.showinfo("导出成功", f"报告已保存到:\n{saved_path}")
            
        except Exception as e:
            messagebox.showerror("导出失败", f"导出报告时出错: {str(e)}")
            self._log_message(f"导出报告失败: {str(e)}", "ERROR")
    
    def _export_all_reports(self):
        """导出所有格式的报告"""
        if not self.quality_result:
            messagebox.showwarning("提示", "请先执行质检")
            return
        
        directory = filedialog.askdirectory(title="选择报告导出目录")
        
        if not directory:
            return
        
        try:
            exporter = ReportExporter()
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            
            outputs = exporter.export_all(
                result=self.quality_result,
                output_directory=directory,
                base_filename=f"quality_check_{timestamp}",
                schedule_items=self.schedule_items,
                audio_metadata=self.audio_metadata,
                config=self.config
            )
            
            self._log_message(f"所有报告已导出到: {directory}")
            
            report_list = "\n".join([f"- {os.path.basename(p)}" for p in outputs.values()])
            messagebox.showinfo("导出成功", f"已导出以下文件:\n{report_list}\n\n位置: {directory}")
            
        except Exception as e:
            messagebox.showerror("导出失败", f"导出报告时出错: {str(e)}")
            self._log_message(f"导出报告失败: {str(e)}", "ERROR")
    
    def _show_statistics(self):
        """显示统计概览"""
        if not self.quality_result:
            messagebox.showwarning("提示", "请先执行质检")
            return
        
        dialog = tk.Toplevel(self.root)
        dialog.title("质检统计概览")
        dialog.geometry("500x400")
        dialog.transient(self.root)
        
        # 统计信息
        stats_frame = ttk.LabelFrame(dialog, text="统计摘要", padding=10)
        stats_frame.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)
        
        # 基本统计
        ttk.Label(stats_frame, text="📊 基本统计", font=("", 11, "bold")).pack(anchor=tk.W)
        
        basic_stats = [
            f"总检查项: {self.quality_result.total_checks}",
            f"严重问题: {self.quality_result.critical_count}",
            f"警告: {self.quality_result.warning_count}",
            f"信息: {len(self.quality_result.get_issues_by_severity(IssueSeverity.INFO))}",
            "",
            f"未解决问题: {len(self.quality_result.unresolved_issues)}",
            f"已解决问题: {len(self.quality_result.resolved_issues)}",
        ]
        
        for stat in basic_stats:
            ttk.Label(stats_frame, text=stat).pack(anchor=tk.W)
        
        ttk.Separator(stats_frame, orient=tk.HORIZONTAL).pack(fill=tk.X, pady=10)
        
        # 问题类型统计
        ttk.Label(stats_frame, text="📋 问题类型分布", font=("", 11, "bold")).pack(anchor=tk.W)
        
        type_counts = {}
        for issue in self.quality_result.issues:
            type_name = issue.issue_type_display
            type_counts[type_name] = type_counts.get(type_name, 0) + 1
        
        for issue_type, count in sorted(type_counts.items(), key=lambda x: x[1], reverse=True):
            ttk.Label(stats_frame, text=f"  - {issue_type}: {count} 个").pack(anchor=tk.W)
        
        # 按钮
        ttk.Button(dialog, text="关闭", command=dialog.destroy).pack(pady=10)
    
    def _show_settings_dialog(self):
        """显示设置对话框"""
        dialog = tk.Toplevel(self.root)
        dialog.title("质检参数配置")
        dialog.geometry("450x500")
        dialog.transient(self.root)
        dialog.grab_set()
        
        # 格式设置
        format_frame = ttk.LabelFrame(dialog, text="格式要求", padding=10)
        format_frame.pack(fill=tk.X, padx=10, pady=5)
        
        ttk.Label(format_frame, text="要求采样率 (Hz):").grid(row=0, column=0, sticky=tk.W)
        sample_rate_var = tk.StringVar(value=str(self.config.required_sample_rate))
        ttk.Entry(format_frame, textvariable=sample_rate_var, width=10).grid(row=0, column=1, padx=5)
        
        ttk.Label(format_frame, text="要求声道数:").grid(row=1, column=0, sticky=tk.W, pady=5)
        channels_var = tk.StringVar(value=str(self.config.required_channels))
        ttk.Entry(format_frame, textvariable=channels_var, width=10).grid(row=1, column=1, padx=5, pady=5)
        
        ttk.Label(format_frame, text="最小位深度 (bit):").grid(row=2, column=0, sticky=tk.W)
        bit_depth_var = tk.StringVar(value=str(self.config.min_bit_depth))
        ttk.Entry(format_frame, textvariable=bit_depth_var, width=10).grid(row=2, column=1, padx=5)
        
        # 时长设置
        duration_frame = ttk.LabelFrame(dialog, text="时长容差", padding=10)
        duration_frame.pack(fill=tk.X, padx=10, pady=5)
        
        ttk.Label(duration_frame, text="最大允许超出 (秒):").grid(row=0, column=0, sticky=tk.W)
        over_var = tk.StringVar(value=str(self.config.max_duration_over_seconds))
        ttk.Entry(duration_frame, textvariable=over_var, width=10).grid(row=0, column=1, padx=5)
        
        ttk.Label(duration_frame, text="最大允许缩短 (秒):").grid(row=1, column=0, sticky=tk.W, pady=5)
        under_var = tk.StringVar(value=str(self.config.max_duration_under_seconds))
        ttk.Entry(duration_frame, textvariable=under_var, width=10).grid(row=1, column=1, padx=5, pady=5)
        
        # 音频质量设置
        quality_frame = ttk.LabelFrame(dialog, text="音频质量", padding=10)
        quality_frame.pack(fill=tk.X, padx=10, pady=5)
        
        ttk.Label(quality_frame, text="峰值警告阈值 (dBFS):").grid(row=0, column=0, sticky=tk.W)
        peak_warn_var = tk.StringVar(value=str(self.config.max_peak_dbfs))
        ttk.Entry(quality_frame, textvariable=peak_warn_var, width=10).grid(row=0, column=1, padx=5)
        
        ttk.Label(quality_frame, text="峰值危险阈值 (dBFS):").grid(row=1, column=0, sticky=tk.W, pady=5)
        peak_crit_var = tk.StringVar(value=str(self.config.critical_peak_dbfs))
        ttk.Entry(quality_frame, textvariable=peak_crit_var, width=10).grid(row=1, column=1, padx=5, pady=5)
        
        ttk.Label(quality_frame, text="最大片头静音 (秒):").grid(row=2, column=0, sticky=tk.W)
        lead_silence_var = tk.StringVar(value=str(self.config.max_leading_silence_seconds))
        ttk.Entry(quality_frame, textvariable=lead_silence_var, width=10).grid(row=2, column=1, padx=5)
        
        ttk.Label(quality_frame, text="最大片尾静音 (秒):").grid(row=3, column=0, sticky=tk.W, pady=5)
        trail_silence_var = tk.StringVar(value=str(self.config.max_trailing_silence_seconds))
        ttk.Entry(quality_frame, textvariable=trail_silence_var, width=10).grid(row=3, column=1, padx=5, pady=5)
        
        # 广告设置
        ad_frame = ttk.LabelFrame(dialog, text="广告规则", padding=10)
        ad_frame.pack(fill=tk.X, padx=10, pady=5)
        
        ttk.Label(ad_frame, text="最小广告间隔 (分钟):").grid(row=0, column=0, sticky=tk.W)
        ad_interval_var = tk.StringVar(value=str(self.config.min_ad_interval_minutes))
        ttk.Entry(ad_frame, textvariable=ad_interval_var, width=10).grid(row=0, column=1, padx=5)
        
        # 按钮
        button_frame = ttk.Frame(dialog)
        button_frame.pack(fill=tk.X, padx=10, pady=10)
        
        def save_settings():
            try:
                self.config.required_sample_rate = int(sample_rate_var.get())
                self.config.required_channels = int(channels_var.get())
                self.config.min_bit_depth = int(bit_depth_var.get())
                self.config.max_duration_over_seconds = float(over_var.get())
                self.config.max_duration_under_seconds = float(under_var.get())
                self.config.max_peak_dbfs = float(peak_warn_var.get())
                self.config.critical_peak_dbfs = float(peak_crit_var.get())
                self.config.max_leading_silence_seconds = float(lead_silence_var.get())
                self.config.max_trailing_silence_seconds = float(trail_silence_var.get())
                self.config.min_ad_interval_minutes = float(ad_interval_var.get())
                
                self._log_message("质检参数已更新")
                dialog.destroy()
                
            except ValueError as e:
                messagebox.showerror("错误", f"请输入有效的数值: {str(e)}")
        
        ttk.Button(button_frame, text="保存", command=save_settings).pack(side=tk.RIGHT, padx=5)
        ttk.Button(button_frame, text="取消", command=dialog.destroy).pack(side=tk.RIGHT, padx=5)
        ttk.Button(button_frame, text="恢复默认", command=lambda: self._reset_settings(
            sample_rate_var, channels_var, bit_depth_var,
            over_var, under_var, peak_warn_var, peak_crit_var,
            lead_silence_var, trail_silence_var, ad_interval_var
        )).pack(side=tk.LEFT, padx=5)
    
    def _reset_settings(self, *vars):
        """恢复默认设置"""
        default_config = QualityCheckConfig()
        
        vars[0].set(str(default_config.required_sample_rate))
        vars[1].set(str(default_config.required_channels))
        vars[2].set(str(default_config.min_bit_depth))
        vars[3].set(str(default_config.max_duration_over_seconds))
        vars[4].set(str(default_config.max_duration_under_seconds))
        vars[5].set(str(default_config.max_peak_dbfs))
        vars[6].set(str(default_config.critical_peak_dbfs))
        vars[7].set(str(default_config.max_leading_silence_seconds))
        vars[8].set(str(default_config.max_trailing_silence_seconds))
        vars[9].set(str(default_config.min_ad_interval_minutes))
        
        self._log_message("已恢复默认设置")
    
    def _show_about(self):
        """显示关于对话框"""
        messagebox.showinfo(
            "关于",
            f"{self.APP_NAME}\n"
            f"版本: {self.APP_VERSION}\n\n"
            "校园广播站导播用本地桌面工具\n"
            "功能:\n"
            "• 导入节目单 CSV 和音频目录\n"
            "• 生成排播时间线\n"
            "• 检查缺素材、重复素材、时长/格式/采样率\n"
            "• 检测静音段和峰值异常\n"
            "• 支持人工标记处理意见\n"
            "• 导出 Markdown/CSV/JSON 报告"
        )


def main():
    """主函数"""
    root = tk.Tk()
    
    # 设置主题
    try:
        style = ttk.Style()
        style.theme_use('clam')  # 尝试使用更现代的主题
    except tk.TclError:
        pass  # 忽略主题错误
    
    app = QualityCheckApp(root)
    
    # 居中显示
    root.update_idletasks()
    width = root.winfo_width()
    height = root.winfo_height()
    x = (root.winfo_screenwidth() // 2) - (width // 2)
    y = (root.winfo_screenheight() // 2) - (height // 2)
    root.geometry(f'{width}x{height}+{x}+{y}')
    
    root.mainloop()


if __name__ == "__main__":
    main()
