"""
主窗口界面
"""

import tkinter as tk
from tkinter import ttk, messagebox, filedialog
from datetime import date, datetime, time, timedelta
from pathlib import Path
from typing import Dict, List, Optional, Any
from collections import defaultdict

from cinema_review.logic import DataLoader, TimelineBuilder, IssueDetector
from cinema_review.utils import StateManager, Exporter
from cinema_review.models import (
    Screening,
    Issue,
    IssueType,
    ScreeningTimeline,
    HallRules,
    ReviewState
)


class CinemaReviewApp:
    """影院排片核对工具主应用"""
    
    def __init__(
        self,
        root: tk.Tk,
        project_root: Path,
        state_manager: StateManager
    ):
        """
        初始化主应用
        
        Args:
            root: Tk根窗口
            project_root: 项目根目录
            state_manager: 状态管理器
        """
        self.root = root
        self.project_root = project_root
        self.data_dir = project_root / "data"
        self.output_dir = project_root / "output"
        self.state_manager = state_manager
        
        # 数据缓存
        self.screenings: List[Screening] = []
        self.issues: List[Issue] = []
        self.timelines: Dict[str, ScreeningTimeline] = {}
        self.hall_rules: Dict[str, HallRules] = {}
        self.hall_names: Dict[str, str] = {}
        
        # 筛选状态
        self.selected_hall_id: Optional[str] = None
        self.time_range_start: Optional[time] = None
        self.time_range_end: Optional[time] = None
        self.review_date: date = date.today()
        
        # 选中的问题
        self.selected_issue: Optional[Issue] = None
        
        # 创建界面
        self._create_menu_bar()
        self._create_main_layout()
        
        # 加载数据
        self._load_data()
        
        # 加载保存的状态
        self._load_saved_state()
    
    def _create_menu_bar(self) -> None:
        """创建菜单栏"""
        menubar = tk.Menu(self.root)
        self.root.config(menu=menubar)
        
        # 文件菜单
        file_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="文件", menu=file_menu)
        
        file_menu.add_command(label="重新加载数据", command=self._reload_data)
        file_menu.add_separator()
        file_menu.add_command(label="导出审核报告 (MD)", command=self._export_md_report)
        file_menu.add_command(label="导出问题列表 (CSV)", command=self._export_issues_csv)
        file_menu.add_separator()
        file_menu.add_command(label="退出", command=self.root.quit)
        
        # 帮助菜单
        help_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="帮助", menu=help_menu)
        help_menu.add_command(label="关于", command=self._show_about)
    
    def _create_main_layout(self) -> None:
        """创建主布局"""
        # 主框架
        main_frame = ttk.Frame(self.root, padding="5")
        main_frame.grid(row=0, column=0, sticky=(tk.W, tk.E, tk.N, tk.S))
        
        # 配置权重
        self.root.columnconfigure(0, weight=1)
        self.root.rowconfigure(0, weight=1)
        main_frame.columnconfigure(0, weight=1)
        main_frame.rowconfigure(1, weight=1)
        
        # 顶部：筛选面板
        filter_frame = ttk.LabelFrame(main_frame, text="筛选条件", padding="5")
        filter_frame.grid(row=0, column=0, columnspan=2, sticky=(tk.W, tk.E), pady=(0, 5))
        
        self._create_filter_panel(filter_frame)
        
        # 左侧：时间线显示
        timeline_frame = ttk.LabelFrame(main_frame, text="排片时间线", padding="5")
        timeline_frame.grid(row=1, column=0, sticky=(tk.W, tk.E, tk.N, tk.S), padx=(0, 5))
        timeline_frame.columnconfigure(0, weight=1)
        timeline_frame.rowconfigure(0, weight=1)
        
        self._create_timeline_panel(timeline_frame)
        
        # 右侧：问题列表和详情
        right_frame = ttk.Frame(main_frame)
        right_frame.grid(row=1, column=1, sticky=(tk.W, tk.E, tk.N, tk.S))
        right_frame.columnconfigure(0, weight=1)
        right_frame.rowconfigure(0, weight=3)
        right_frame.rowconfigure(1, weight=2)
        
        # 问题列表
        issues_frame = ttk.LabelFrame(right_frame, text="检测到的问题", padding="5")
        issues_frame.grid(row=0, column=0, sticky=(tk.W, tk.E, tk.N, tk.S), pady=(0, 5))
        issues_frame.columnconfigure(0, weight=1)
        issues_frame.rowconfigure(0, weight=1)
        
        self._create_issues_panel(issues_frame)
        
        # 问题详情
        detail_frame = ttk.LabelFrame(right_frame, text="问题详情", padding="5")
        detail_frame.grid(row=1, column=0, sticky=(tk.W, tk.E, tk.N, tk.S))
        detail_frame.columnconfigure(0, weight=1)
        detail_frame.rowconfigure(0, weight=1)
        
        self._create_detail_panel(detail_frame)
        
        # 底部：状态栏
        status_frame = ttk.Frame(main_frame)
        status_frame.grid(row=2, column=0, columnspan=2, sticky=(tk.W, tk.E), pady=(5, 0))
        
        self._create_status_bar(status_frame)
    
    def _create_filter_panel(self, parent: ttk.LabelFrame) -> None:
        """创建筛选面板"""
        parent.columnconfigure(0, weight=0)
        parent.columnconfigure(1, weight=0)
        parent.columnconfigure(2, weight=0)
        parent.columnconfigure(3, weight=1)
        
        # 日期选择
        ttk.Label(parent, text="审核日期:").grid(row=0, column=0, padx=5, pady=2, sticky=tk.W)
        
        date_frame = ttk.Frame(parent)
        date_frame.grid(row=0, column=1, padx=5, pady=2, sticky=tk.W)
        
        self.date_var = tk.StringVar(value=self.review_date.isoformat())
        self.date_entry = ttk.Entry(date_frame, textvariable=self.date_var, width=12)
        self.date_entry.pack(side=tk.LEFT, padx=2)
        
        ttk.Button(date_frame, text="选择", command=self._select_date, width=6).pack(side=tk.LEFT, padx=2)
        
        # 影厅选择
        ttk.Label(parent, text="影厅:").grid(row=0, column=2, padx=5, pady=2, sticky=tk.W)
        
        self.hall_var = tk.StringVar(value="全部")
        self.hall_combo = ttk.Combobox(
            parent, textvariable=self.hall_var, 
            values=["全部"], state="readonly", width=12
        )
        self.hall_combo.grid(row=0, column=3, padx=5, pady=2, sticky=tk.W)
        self.hall_combo.bind("<<ComboboxSelected>>", self._on_hall_selected)
        
        # 时间段选择
        ttk.Label(parent, text="时间段:").grid(row=0, column=4, padx=5, pady=2, sticky=tk.W)
        
        time_frame = ttk.Frame(parent)
        time_frame.grid(row=0, column=5, padx=5, pady=2, sticky=tk.W)
        
        self.time_start_var = tk.StringVar(value="00:00")
        self.time_start_combo = ttk.Combobox(
            time_frame, textvariable=self.time_start_var,
            values=[f"{h:02d}:00" for h in range(24)],
            state="readonly", width=6
        )
        self.time_start_combo.pack(side=tk.LEFT)
        
        ttk.Label(time_frame, text=" - ").pack(side=tk.LEFT)
        
        self.time_end_var = tk.StringVar(value="24:00")
        self.time_end_combo = ttk.Combobox(
            time_frame, textvariable=self.time_end_var,
            values=[f"{h:02d}:00" for h in range(25)],
            state="readonly", width=6
        )
        self.time_end_combo.pack(side=tk.LEFT)
        
        # 应用筛选按钮
        ttk.Button(
            parent, text="应用筛选", command=self._apply_filters
        ).grid(row=0, column=6, padx=10, pady=2)
        
        # 保存状态按钮
        ttk.Button(
            parent, text="保存状态", command=self._save_current_state
        ).grid(row=0, column=7, padx=5, pady=2)
    
    def _create_timeline_panel(self, parent: ttk.LabelFrame) -> None:
        """创建时间线面板"""
        # 创建带滚动条的画布
        canvas_frame = ttk.Frame(parent)
        canvas_frame.grid(row=0, column=0, sticky=(tk.W, tk.E, tk.N, tk.S))
        canvas_frame.columnconfigure(0, weight=1)
        canvas_frame.rowconfigure(0, weight=1)
        
        # 滚动条
        self.timeline_scrollbar = ttk.Scrollbar(canvas_frame, orient=tk.VERTICAL)
        self.timeline_scrollbar.grid(row=0, column=1, sticky=(tk.N, tk.S))
        
        # 画布
        self.timeline_canvas = tk.Canvas(
            canvas_frame, 
            bg="white",
            yscrollcommand=self.timeline_scrollbar.set
        )
        self.timeline_canvas.grid(row=0, column=0, sticky=(tk.W, tk.E, tk.N, tk.S))
        
        self.timeline_scrollbar.config(command=self.timeline_canvas.yview)
        
        # 内部框架
        self.timeline_inner = ttk.Frame(self.timeline_canvas)
        self.timeline_inner_id = self.timeline_canvas.create_window(
            (0, 0), window=self.timeline_inner, anchor=tk.NW
        )
        
        self.timeline_inner.bind("<Configure>", self._on_timeline_configure)
        self.timeline_canvas.bind("<Configure>", self._on_canvas_configure)
    
    def _create_issues_panel(self, parent: ttk.LabelFrame) -> None:
        """创建问题列表面板"""
        # 创建Treeview
        columns = ("severity", "type", "hall", "film", "status")
        self.issues_tree = ttk.Treeview(
            parent, columns=columns, show="headings",
            selectmode="browse"
        )
        
        # 配置列
        self.issues_tree.heading("severity", text="严重程度")
        self.issues_tree.heading("type", text="问题类型")
        self.issues_tree.heading("hall", text="影厅")
        self.issues_tree.heading("film", text="影片")
        self.issues_tree.heading("status", text="状态")
        
        self.issues_tree.column("severity", width=70, anchor=tk.CENTER)
        self.issues_tree.column("type", width=100)
        self.issues_tree.column("hall", width=60, anchor=tk.CENTER)
        self.issues_tree.column("film", width=120)
        self.issues_tree.column("status", width=70, anchor=tk.CENTER)
        
        # 滚动条
        scrollbar = ttk.Scrollbar(parent, orient=tk.VERTICAL, command=self.issues_tree.yview)
        self.issues_tree.configure(yscrollcommand=scrollbar.set)
        
        # 布局
        self.issues_tree.grid(row=0, column=0, sticky=(tk.W, tk.E, tk.N, tk.S))
        scrollbar.grid(row=0, column=1, sticky=(tk.N, tk.S))
        
        # 绑定选择事件
        self.issues_tree.bind("<<TreeviewSelect>>", self._on_issue_selected)
        
        # 标签样式
        style = ttk.Style()
        style.map(
            "Treeview",
            foreground=[("selected", "white")],
            background=[("selected", "#0078d7")]
        )
    
    def _create_detail_panel(self, parent: ttk.LabelFrame) -> None:
        """创建问题详情面板"""
        # 使用Grid布局
        parent.columnconfigure(0, weight=1)
        parent.columnconfigure(1, weight=1)
        parent.rowconfigure(0, weight=0)
        parent.rowconfigure(1, weight=0)
        parent.rowconfigure(2, weight=1)
        parent.rowconfigure(3, weight=0)
        
        # 问题描述
        ttk.Label(parent, text="描述:").grid(row=0, column=0, columnspan=2, padx=5, pady=2, sticky=tk.W)
        
        self.desc_text = tk.Text(parent, wrap=tk.WORD, height=3, state=tk.DISABLED)
        self.desc_text.grid(row=1, column=0, columnspan=2, padx=5, pady=2, sticky=(tk.W, tk.E, tk.N, tk.S))
        
        # 备注输入
        ttk.Label(parent, text="备注:").grid(row=2, column=0, columnspan=2, padx=5, pady=2, sticky=tk.W)
        
        self.notes_text = tk.Text(parent, wrap=tk.WORD, height=3)
        self.notes_text.grid(row=2, column=0, columnspan=2, padx=5, pady=2, sticky=(tk.W, tk.E, tk.N, tk.S))
        
        # 操作按钮
        button_frame = ttk.Frame(parent)
        button_frame.grid(row=3, column=0, columnspan=2, padx=5, pady=5, sticky=(tk.W, tk.E))
        
        ttk.Button(
            button_frame, text="标记已解决", command=self._resolve_issue
        ).pack(side=tk.LEFT, padx=5)
        
        ttk.Button(
            button_frame, text="标记已忽略", command=self._dismiss_issue
        ).pack(side=tk.LEFT, padx=5)
        
        ttk.Button(
            button_frame, text="重置状态", command=self._reset_issue
        ).pack(side=tk.LEFT, padx=5)
    
    def _create_status_bar(self, parent: ttk.Frame) -> None:
        """创建状态栏"""
        self.status_label = ttk.Label(
            parent, text="就绪", anchor=tk.W
        )
        self.status_label.pack(side=tk.LEFT, fill=tk.X, expand=True)
        
        # 统计信息
        self.stats_label = ttk.Label(
            parent, text="排片: 0 | 问题: 0", anchor=tk.E
        )
        self.stats_label.pack(side=tk.RIGHT, padx=10)
    
    def _load_data(self) -> None:
        """加载数据"""
        self._update_status("正在加载数据...")
        
        try:
            # 创建数据加载器
            loader = DataLoader(self.data_dir)
            
            # 加载所有数据
            data = loader.load_all(self.review_date)
            
            self.screenings = data["screenings"]
            projector_logs = data["projector_logs"]
            lamp_hours = data["lamp_hours"]
            self.hall_rules = data["hall_rules"]
            
            # 构建影厅名称映射
            self.hall_names = {}
            for scr in self.screenings:
                if scr.hall_id not in self.hall_names:
                    self.hall_names[scr.hall_id] = scr.hall_name
            
            for hall_id, rule in self.hall_rules.items():
                if hall_id not in self.hall_names:
                    self.hall_names[hall_id] = rule.hall_name
            
            # 构建时间线
            if self.screenings:
                timeline_builder = TimelineBuilder(
                    screenings=self.screenings,
                    projector_logs=projector_logs,
                    lamp_hours=lamp_hours,
                    hall_rules=self.hall_rules
                )
                self.timelines = timeline_builder.build_all_timelines()
                
                # 检测问题
                issue_detector = IssueDetector(
                    screenings=self.screenings,
                    timelines=self.timelines,
                    lamp_hours=lamp_hours,
                    hall_rules=self.hall_rules,
                    projector_logs=projector_logs
                )
                self.issues = issue_detector.detect_all_issues()
                
                # 应用保存的状态
                self.state_manager.apply_issue_states(self.issues)
            
            # 更新影厅选择下拉框
            self._update_hall_combo()
            
            # 更新显示
            self._update_display()
            
            self._update_status(f"数据加载完成: {len(self.screenings)} 场排片, {len(self.issues)} 个问题")
            
        except Exception as e:
            self._update_status(f"加载数据失败: {e}")
            messagebox.showerror("错误", f"加载数据时发生错误:\n{e}")
    
    def _update_hall_combo(self) -> None:
        """更新影厅选择下拉框"""
        hall_list = ["全部"]
        for hall_id in sorted(self.hall_names.keys()):
            hall_list.append(f"{self.hall_names[hall_id]} ({hall_id})")
        
        self.hall_combo["values"] = hall_list
    
    def _update_display(self) -> None:
        """更新显示"""
        # 获取筛选后的数据
        filtered_screenings = self._get_filtered_screenings()
        filtered_issues = self._get_filtered_issues()
        
        # 更新时间线
        self._update_timeline(filtered_screenings, filtered_issues)
        
        # 更新问题列表
        self._update_issues_list(filtered_issues)
        
        # 更新统计
        self.stats_label.config(
            text=f"排片: {len(filtered_screenings)} | 问题: {len(filtered_issues)}"
        )
    
    def _get_filtered_screenings(self) -> List[Screening]:
        """获取筛选后的排片"""
        result = []
        
        for scr in self.screenings:
            # 影厅筛选
            if self.selected_hall_id and scr.hall_id != self.selected_hall_id:
                continue
            
            # 时间段筛选
            if self.time_range_start and self.time_range_end:
                # 检查排片是否在时间范围内或有重叠
                scr_start_time = scr.start_time.time()
                scr_end_time = scr.end_time.time()
                
                # 简化判断：排片开始时间在范围内，或者结束时间在范围内
                in_range = False
                
                if self.time_range_start <= scr_start_time <= self.time_range_end:
                    in_range = True
                elif self.time_range_start <= scr_end_time <= self.time_range_end:
                    in_range = True
                elif scr_start_time <= self.time_range_start and scr_end_time >= self.time_range_end:
                    in_range = True
                
                if not in_range:
                    continue
            
            result.append(scr)
        
        return result
    
    def _get_filtered_issues(self) -> List[Issue]:
        """获取筛选后的问题"""
        result = []
        
        for issue in self.issues:
            # 影厅筛选
            if self.selected_hall_id and issue.hall_id != self.selected_hall_id:
                continue
            
            result.append(issue)
        
        return result
    
    def _update_timeline(self, screenings: List[Screening], issues: List[Issue]) -> None:
        """更新时间线显示"""
        # 清空现有内容
        for widget in self.timeline_inner.winfo_children():
            widget.destroy()
        
        if not screenings:
            ttk.Label(self.timeline_inner, text="没有排片数据").pack(padx=10, pady=20)
            return
        
        # 按影厅分组
        from collections import defaultdict
        by_hall: Dict[str, List[Screening]] = defaultdict(list)
        for scr in screenings:
            by_hall[scr.hall_id].append(scr)
        
        # 找到时间范围
        all_times = []
        for scr in screenings:
            all_times.append(scr.start_time)
            all_times.append(scr.end_time)
        
        if all_times:
            min_time = min(all_times)
            max_time = max(all_times)
        else:
            min_time = datetime.combine(self.review_date, time(0, 0))
            max_time = datetime.combine(self.review_date, time(23, 59))
        
        # 扩展边界
        display_start = min_time.replace(minute=0, second=0)
        display_end = max_time.replace(minute=0, second=0) + timedelta(hours=1)
        
        total_seconds = (display_end - display_start).total_seconds()
        
        # 为每个影厅创建一行
        row = 0
        for hall_id in sorted(by_hall.keys()):
            hall_screenings = by_hall[hall_id]
            hall_name = self.hall_names.get(hall_id, hall_id)
            
            # 影厅标签
            hall_label = ttk.Label(
                self.timeline_inner, text=hall_name,
                font=("TkDefaultFont", 10, "bold")
            )
            hall_label.grid(row=row, column=0, padx=5, pady=5, sticky=tk.W)
            
            # 时间线画布
            canvas_width = 800
            canvas_height = 50
            
            canvas = tk.Canvas(
                self.timeline_inner, width=canvas_width, height=canvas_height,
                bg="white", highlightthickness=1, highlightbackground="#ccc"
            )
            canvas.grid(row=row, column=1, padx=5, pady=5, sticky=(tk.W, tk.E))
            
            # 绘制时间刻度
            hours = int(total_seconds / 3600) + 1
            for h in range(hours):
                x = (h * 3600 / total_seconds) * canvas_width
                canvas.create_line(x, 0, x, canvas_height, fill="#eee", dash=(2, 2))
                
                # 时间标签
                tick_time = display_start + timedelta(hours=h)
                canvas.create_text(
                    x + 5, 5, text=tick_time.strftime("%H:%M"),
                    anchor=tk.NW, fill="#999", font=("TkDefaultFont", 8)
                )
            
            # 绘制排片块
            for scr in hall_screenings:
                # 检查是否有问题
                has_issue = any(
                    i.screening_id == scr.id or scr.id in (i.related_screening_ids or [])
                    for i in issues
                )
                
                # 计算位置
                start_offset = (scr.start_time - display_start).total_seconds()
                end_offset = (scr.end_time - display_start).total_seconds()
                
                x1 = (start_offset / total_seconds) * canvas_width
                x2 = (end_offset / total_seconds) * canvas_width
                y1 = 15
                y2 = canvas_height - 5
                
                # 颜色
                if has_issue:
                    fill_color = "#ffcccc"  # 浅红
                    outline_color = "#cc0000"
                else:
                    fill_color = "#ccffcc"  # 浅绿
                    outline_color = "#009900"
                
                # 绘制矩形
                canvas.create_rectangle(
                    x1, y1, x2, y2,
                    fill=fill_color, outline=outline_color, width=1
                )
                
                # 影片名称（如果空间够）
                text_x = (x1 + x2) / 2
                text_y = (y1 + y2) / 2
                
                # 计算可用宽度
                available_width = x2 - x1 - 10
                
                # 截断文本
                display_name = scr.film_name
                if len(display_name) > 15 and available_width < 100:
                    display_name = display_name[:12] + "..."
                
                canvas.create_text(
                    text_x, text_y, text=display_name,
                    anchor=tk.CENTER, font=("TkDefaultFont", 9)
                )
                
                # 时间标签（底部）
                time_label = f"{scr.start_time.strftime('%H:%M')}-{scr.end_time.strftime('%H:%M')}"
                canvas.create_text(
                    text_x, y2 - 2, text=time_label,
                    anchor=tk.S, font=("TkDefaultFont", 8), fill="#666"
                )
            
            row += 1
        
        # 更新滚动区域
        self.timeline_inner.update_idletasks()
        self.timeline_canvas.config(scrollregion=self.timeline_canvas.bbox("all"))
    
    def _update_issues_list(self, issues: List[Issue]) -> None:
        """更新问题列表"""
        # 清空现有项
        for item in self.issues_tree.get_children():
            self.issues_tree.delete(item)
        
        # 按严重程度排序
        severity_order = {"high": 0, "medium": 1, "low": 2}
        sorted_issues = sorted(issues, key=lambda i: severity_order.get(i.severity, 2))
        
        # 添加新项
        for issue in sorted_issues:
            # 严重程度显示
            severity_text = {
                "high": "🔴 严重",
                "medium": "🟡 中等",
                "low": "🟢 轻微"
            }.get(issue.severity, issue.severity)
            
            # 状态显示
            status_display = self.state_manager.get_issue_display_status(issue)
            status_text = {
                "新问题": "🆕 新",
                "已解决": "✅ 已解决",
                "已忽略": "⚪ 已忽略"
            }.get(status_display, status_display)
            
            # 添加到树
            self.issues_tree.insert(
                "", tk.END, iid=issue.id,
                values=(
                    severity_text,
                    issue.issue_type.value,
                    issue.hall_name,
                    issue.film_name[:15] + "..." if len(issue.film_name) > 15 else issue.film_name,
                    status_text
                )
            )
            
            # 设置标签颜色
            if issue.status == "resolved":
                self.issues_tree.item(issue.id, tags=("resolved",))
            elif issue.status == "dismissed":
                self.issues_tree.item(issue.id, tags=("dismissed",))
        
        # 配置标签样式
        self.issues_tree.tag_configure("resolved", foreground="#999999")
        self.issues_tree.tag_configure("dismissed", foreground="#999999")
    
    def _on_issue_selected(self, event: tk.Event) -> None:
        """问题被选中"""
        selection = self.issues_tree.selection()
        if not selection:
            return
        
        issue_id = selection[0]
        
        # 找到对应的问题
        for issue in self.issues:
            if issue.id == issue_id:
                self.selected_issue = issue
                
                # 更新详情面板
                self._update_detail_panel(issue)
                break
    
    def _update_detail_panel(self, issue: Issue) -> None:
        """更新详情面板"""
        # 更新描述
        self.desc_text.config(state=tk.NORMAL)
        self.desc_text.delete(1.0, tk.END)
        self.desc_text.insert(tk.END, issue.description)
        self.desc_text.config(state=tk.DISABLED)
        
        # 更新备注
        self.notes_text.delete(1.0, tk.END)
        saved_notes = self.state_manager.get_issue_notes(issue)
        if saved_notes:
            self.notes_text.insert(tk.END, saved_notes)
        elif issue.notes:
            self.notes_text.insert(tk.END, issue.notes)
    
    def _on_hall_selected(self, event: tk.Event = None) -> None:
        """影厅被选择"""
        selected = self.hall_var.get()
        
        if selected == "全部":
            self.selected_hall_id = None
        else:
            # 从显示文本中提取hall_id
            import re
            match = re.search(r'\(([^)]+)\)$', selected)
            if match:
                self.selected_hall_id = match.group(1)
            else:
                self.selected_hall_id = None
    
    def _apply_filters(self) -> None:
        """应用筛选"""
        # 解析日期
        try:
            new_date = date.fromisoformat(self.date_var.get())
            if new_date != self.review_date:
                self.review_date = new_date
                self._load_data()  # 重新加载数据
                return
        except ValueError:
            messagebox.showwarning("警告", "日期格式无效，请使用 YYYY-MM-DD 格式")
            return
        
        # 更新影厅选择
        self._on_hall_selected()
        
        # 解析时间段
        try:
            start_str = self.time_start_var.get()
            end_str = self.time_end_var.get()
            
            if start_str == "24:00":
                start_time = time(23, 59, 59)
            else:
                h, m = map(int, start_str.split(":"))
                start_time = time(h, m)
            
            if end_str == "24:00":
                end_time = time(23, 59, 59)
            else:
                h, m = map(int, end_str.split(":"))
                end_time = time(h, m)
            
            self.time_range_start = start_time
            self.time_range_end = end_time
            
        except (ValueError, AttributeError):
            self.time_range_start = None
            self.time_range_end = None
        
        # 更新显示
        self._update_display()
        self._update_status("筛选已应用")
    
    def _resolve_issue(self) -> None:
        """标记问题为已解决"""
        if not self.selected_issue:
            messagebox.showinfo("提示", "请先选择一个问题")
            return
        
        # 获取备注
        notes = self.notes_text.get(1.0, tk.END).strip()
        
        # 更新状态
        self.state_manager.update_issue_status(
            self.selected_issue, "resolved", notes
        )
        
        # 保存
        self.state_manager.save()
        
        # 更新显示
        self._update_display()
        self._update_status(f"问题已标记为已解决: {self.selected_issue.issue_type.value}")
    
    def _dismiss_issue(self) -> None:
        """标记问题为已忽略"""
        if not self.selected_issue:
            messagebox.showinfo("提示", "请先选择一个问题")
            return
        
        # 获取备注
        notes = self.notes_text.get(1.0, tk.END).strip()
        
        # 更新状态
        self.state_manager.update_issue_status(
            self.selected_issue, "dismissed", notes
        )
        
        # 保存
        self.state_manager.save()
        
        # 更新显示
        self._update_display()
        self._update_status(f"问题已标记为已忽略: {self.selected_issue.issue_type.value}")
    
    def _reset_issue(self) -> None:
        """重置问题状态"""
        if not self.selected_issue:
            messagebox.showinfo("提示", "请先选择一个问题")
            return
        
        # 获取备注
        notes = self.notes_text.get(1.0, tk.END).strip()
        
        # 更新状态
        self.state_manager.update_issue_status(
            self.selected_issue, "new", notes
        )
        
        # 保存
        self.state_manager.save()
        
        # 更新显示
        self._update_display()
        self._update_status(f"问题状态已重置: {self.selected_issue.issue_type.value}")
    
    def _save_current_state(self) -> None:
        """保存当前状态"""
        # 更新筛选器状态
        self.state_manager.update_filter_state(
            hall_id=self.selected_hall_id,
            time_range_start=self.time_range_start,
            time_range_end=self.time_range_end
        )
        
        # 保存
        if self.state_manager.save():
            self._update_status("状态已保存")
            messagebox.showinfo("成功", "处理状态已保存到本地")
        else:
            messagebox.showwarning("警告", "保存状态失败")
    
    def _load_saved_state(self) -> None:
        """加载保存的状态"""
        state = self.state_manager.load(self.review_date)
        
        if state.hall_id:
            # 尝试恢复影厅选择
            hall_name = self.hall_names.get(state.hall_id, "")
            if hall_name:
                self.hall_var.set(f"{hall_name} ({state.hall_id})")
                self.selected_hall_id = state.hall_id
        
        if state.time_range_start:
            self.time_start_var.set(state.time_range_start.strftime("%H:%M"))
            self.time_range_start = state.time_range_start
        
        if state.time_range_end:
            self.time_end_var.set(state.time_range_end.strftime("%H:%M"))
            self.time_range_end = state.time_range_end
    
    def _reload_data(self) -> None:
        """重新加载数据"""
        self._load_data()
    
    def _export_md_report(self) -> None:
        """导出Markdown报告"""
        if not self.screenings:
            messagebox.showwarning("警告", "没有数据可导出")
            return
        
        try:
            exporter = Exporter(self.output_dir, self.review_date)
            filepath = exporter.export_projection_review(
                screenings=self.screenings,
                issues=self.issues,
                timelines=self.timelines,
                hall_names=self.hall_names,
                include_resolved=True
            )
            
            self._update_status(f"报告已导出: {filepath}")
            messagebox.showinfo("成功", f"审核报告已导出到:\n{filepath}")
            
        except Exception as e:
            messagebox.showerror("错误", f"导出报告失败:\n{e}")
    
    def _export_issues_csv(self) -> None:
        """导出问题CSV"""
        if not self.issues:
            messagebox.showwarning("警告", "没有问题数据可导出")
            return
        
        try:
            exporter = Exporter(self.output_dir, self.review_date)
            filepath = exporter.export_issues_csv(
                issues=self.issues,
                include_resolved=True
            )
            
            self._update_status(f"问题列表已导出: {filepath}")
            messagebox.showinfo("成功", f"问题列表已导出到:\n{filepath}")
            
        except Exception as e:
            messagebox.showerror("错误", f"导出问题列表失败:\n{e}")
    
    def _select_date(self) -> None:
        """选择日期"""
        # 简单的日期输入对话框
        from tkinter import simpledialog
        
        result = simpledialog.askstring(
            "选择日期",
            "请输入日期 (YYYY-MM-DD):",
            initialvalue=self.review_date.isoformat()
        )
        
        if result:
            try:
                new_date = date.fromisoformat(result.strip())
                self.date_var.set(new_date.isoformat())
                self.review_date = new_date
                self._load_data()
            except ValueError:
                messagebox.showwarning("警告", "日期格式无效，请使用 YYYY-MM-DD 格式")
    
    def _show_about(self) -> None:
        """显示关于对话框"""
        messagebox.showinfo(
            "关于",
            "影院排片核对工具\n"
            "版本: 1.0.0\n\n"
            "用于影院值班经理在开场前核对\n"
            "当天排片和放映设备状态。\n\n"
            "支持检测:\n"
            "- 排片重叠/间隔不足\n"
            "- 放映机预热不足\n"
            "- 灯泡小时数超限\n"
            "- 跨午夜场次归属错误"
        )
    
    def _update_status(self, message: str) -> None:
        """更新状态栏"""
        self.status_label.config(text=message)
    
    def _on_timeline_configure(self, event: tk.Event = None) -> None:
        """时间线内部框架配置变化"""
        self.timeline_canvas.configure(
            scrollregion=self.timeline_canvas.bbox("all")
        )
    
    def _on_canvas_configure(self, event: tk.Event = None) -> None:
        """画布配置变化"""
        self.timeline_canvas.itemconfig(
            self.timeline_inner_id,
            width=event.width
        )
