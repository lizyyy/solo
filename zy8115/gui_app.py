import tkinter as tk
from tkinter import ttk, filedialog, messagebox, scrolledtext
from typing import Optional, List, Set, Dict, Any
from pathlib import Path
import sys

from models import (
    ReviewProject,
    Risk,
    RiskType,
    RiskLevel,
    LightingCue,
    TrackMarker,
    DeviceChannel
)
from parsers import ProjectLoader
from risk_detector import run_risk_detection
from utils import ProjectPersistence, RiskConfirmationManager, ReportExporter


class LightingReviewApp:
    """舞台监督灯光时间线复核工具"""
    
    def __init__(self, root: tk.Tk):
        self.root = root
        self.root.title("舞台灯光时间线复核工具")
        self.root.geometry("1400x900")
        self.root.minsize(1200, 700)
        
        # 当前项目
        self.project: Optional[ReviewProject] = None
        self.risk_manager: Optional[RiskConfirmationManager] = None
        
        # 筛选条件
        self.filter_scene: Optional[str] = None
        self.filter_device: Optional[str] = None
        self.filter_risk_type: Optional[RiskType] = None
        self.filter_risk_level: Optional[RiskLevel] = None
        self.show_confirmed: bool = True
        
        # 创建UI
        self._create_menu()
        self._create_main_layout()
        
        # 状态栏
        self._create_status_bar()
        
        # 尝试加载示例数据
        self._try_load_example_data()
    
    def _create_menu(self):
        """创建菜单栏"""
        menubar = tk.Menu(self.root)
        self.root.config(menu=menubar)
        
        # 文件菜单
        file_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="文件", menu=file_menu)
        
        file_menu.add_command(label="新建项目", command=self._new_project)
        file_menu.add_separator()
        file_menu.add_command(label="加载灯光CUE (CSV)", command=self._load_cues_file)
        file_menu.add_command(label="加载曲目时间轴 (JSON)", command=self._load_timeline_file)
        file_menu.add_command(label="加载设备通道 (YAML)", command=self._load_channels_file)
        file_menu.add_separator()
        file_menu.add_command(label="从目录自动加载", command=self._load_from_directory)
        file_menu.add_separator()
        file_menu.add_command(label="保存项目", command=self._save_project)
        file_menu.add_command(label="加载项目", command=self._load_project)
        file_menu.add_separator()
        file_menu.add_command(label="退出", command=self.root.quit)
        
        # 操作菜单
        action_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="操作", menu=action_menu)
        
        action_menu.add_command(label="运行风险检测", command=self._run_risk_detection)
        action_menu.add_separator()
        action_menu.add_command(label="导出Markdown报告", command=self._export_markdown)
        action_menu.add_command(label="导出CSV报告", command=self._export_csv)
        action_menu.add_command(label="导出CUE列表", command=self._export_cue_list)
        
        # 帮助菜单
        help_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="帮助", menu=help_menu)
        
        help_menu.add_command(label="关于", command=self._show_about)
    
    def _create_main_layout(self):
        """创建主布局"""
        # 主框架
        main_frame = ttk.Frame(self.root, padding="5")
        main_frame.pack(fill=tk.BOTH, expand=True)
        
        # 顶部筛选区域
        filter_frame = ttk.LabelFrame(main_frame, text="筛选条件", padding="5")
        filter_frame.pack(fill=tk.X, pady=(0, 5))
        
        self._create_filter_area(filter_frame)
        
        # 中间内容区域（左右分栏）
        content_frame = ttk.Frame(main_frame)
        content_frame.pack(fill=tk.BOTH, expand=True)
        
        # 左侧：CUE列表和通道占用
        left_frame = ttk.Frame(content_frame)
        left_frame.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, padx=(0, 5))
        
        # CUE列表
        cue_frame = ttk.LabelFrame(left_frame, text="灯光CUE列表", padding="5")
        cue_frame.pack(fill=tk.BOTH, expand=True, pady=(0, 5))
        
        self._create_cue_list(cue_frame)
        
        # 通道占用
        channel_frame = ttk.LabelFrame(left_frame, text="通道占用情况", padding="5")
        channel_frame.pack(fill=tk.BOTH, expand=True)
        
        self._create_channel_usage(channel_frame)
        
        # 右侧：风险列表
        right_frame = ttk.Frame(content_frame)
        right_frame.pack(side=tk.RIGHT, fill=tk.BOTH, expand=True)
        
        # 风险列表
        risk_frame = ttk.LabelFrame(right_frame, text="风险列表", padding="5")
        risk_frame.pack(fill=tk.BOTH, expand=True, pady=(0, 5))
        
        self._create_risk_list(risk_frame)
        
        # 风险详情和操作
        risk_detail_frame = ttk.LabelFrame(right_frame, text="风险详情", padding="5")
        risk_detail_frame.pack(fill=tk.BOTH, expand=True)
        
        self._create_risk_detail(risk_detail_frame)
    
    def _create_filter_area(self, parent: ttk.Frame):
        """创建筛选区域"""
        # 场景筛选
        ttk.Label(parent, text="场景:").grid(row=0, column=0, sticky=tk.W, padx=5)
        
        self.scene_var = tk.StringVar(value="全部")
        self.scene_combo = ttk.Combobox(parent, textvariable=self.scene_var, width=15, state="readonly")
        self.scene_combo.grid(row=0, column=1, padx=5)
        self.scene_combo.bind("<<ComboboxSelected>>", self._on_filter_change)
        
        # 设备筛选
        ttk.Label(parent, text="设备:").grid(row=0, column=2, sticky=tk.W, padx=5)
        
        self.device_var = tk.StringVar(value="全部")
        self.device_combo = ttk.Combobox(parent, textvariable=self.device_var, width=15, state="readonly")
        self.device_combo.grid(row=0, column=3, padx=5)
        self.device_combo.bind("<<ComboboxSelected>>", self._on_filter_change)
        
        # 风险类型筛选
        ttk.Label(parent, text="风险类型:").grid(row=0, column=4, sticky=tk.W, padx=5)
        
        self.risk_type_var = tk.StringVar(value="全部")
        risk_types = ["全部"] + [rt.value for rt in RiskType]
        self.risk_type_combo = ttk.Combobox(parent, textvariable=self.risk_type_var, values=risk_types, width=15, state="readonly")
        self.risk_type_combo.grid(row=0, column=5, padx=5)
        self.risk_type_combo.bind("<<ComboboxSelected>>", self._on_filter_change)
        
        # 风险级别筛选
        ttk.Label(parent, text="风险级别:").grid(row=0, column=6, sticky=tk.W, padx=5)
        
        self.risk_level_var = tk.StringVar(value="全部")
        risk_levels = ["全部"] + [rl.value for rl in RiskLevel]
        self.risk_level_combo = ttk.Combobox(parent, textvariable=self.risk_level_var, values=risk_levels, width=10, state="readonly")
        self.risk_level_combo.grid(row=0, column=7, padx=5)
        self.risk_level_combo.bind("<<ComboboxSelected>>", self._on_filter_change)
        
        # 显示已确认
        self.show_confirmed_var = tk.BooleanVar(value=True)
        self.show_confirmed_check = ttk.Checkbutton(
            parent, text="显示已确认风险", variable=self.show_confirmed_var,
            command=self._on_filter_change
        )
        self.show_confirmed_check.grid(row=0, column=8, padx=10)
        
        # 重置筛选按钮
        ttk.Button(parent, text="重置筛选", command=self._reset_filters).grid(row=0, column=9, padx=5)
    
    def _create_cue_list(self, parent: ttk.Frame):
        """创建CUE列表"""
        # 创建Treeview
        columns = ("cue_number", "scene", "description", "time", "track_name", "channel_count")
        self.cue_tree = ttk.Treeview(parent, columns=columns, show="headings", height=10)
        
        # 设置列
        self.cue_tree.heading("cue_number", text="CUE编号")
        self.cue_tree.heading("scene", text="场景")
        self.cue_tree.heading("description", text="描述")
        self.cue_tree.heading("time", text="触发时间")
        self.cue_tree.heading("track_name", text="关联曲目")
        self.cue_tree.heading("channel_count", text="通道数")
        
        # 设置列宽
        self.cue_tree.column("cue_number", width=80)
        self.cue_tree.column("scene", width=100)
        self.cue_tree.column("description", width=200)
        self.cue_tree.column("time", width=80)
        self.cue_tree.column("track_name", width=120)
        self.cue_tree.column("channel_count", width=60)
        
        # 滚动条
        cue_scroll = ttk.Scrollbar(parent, orient=tk.VERTICAL, command=self.cue_tree.yview)
        self.cue_tree.configure(yscrollcommand=cue_scroll.set)
        
        # 布局
        self.cue_tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        cue_scroll.pack(side=tk.RIGHT, fill=tk.Y)
        
        # 绑定事件
        self.cue_tree.bind("<<TreeviewSelect>>", self._on_cue_select)
    
    def _create_channel_usage(self, parent: ttk.Frame):
        """创建通道占用显示"""
        # 创建Treeview
        columns = ("channel", "device", "scene", "cues", "has_conflict")
        self.channel_tree = ttk.Treeview(parent, columns=columns, show="headings", height=8)
        
        # 设置列
        self.channel_tree.heading("channel", text="通道号")
        self.channel_tree.heading("device", text="设备名称")
        self.channel_tree.heading("scene", text="场景")
        self.channel_tree.heading("cues", text="使用CUE")
        self.channel_tree.heading("has_conflict", text="冲突")
        
        # 设置列宽
        self.channel_tree.column("channel", width=70)
        self.channel_tree.column("device", width=150)
        self.channel_tree.column("scene", width=100)
        self.channel_tree.column("cues", width=200)
        self.channel_tree.column("has_conflict", width=60)
        
        # 滚动条
        channel_scroll = ttk.Scrollbar(parent, orient=tk.VERTICAL, command=self.channel_tree.yview)
        self.channel_tree.configure(yscrollcommand=channel_scroll.set)
        
        # 布局
        self.channel_tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        channel_scroll.pack(side=tk.RIGHT, fill=tk.Y)
    
    def _create_risk_list(self, parent: ttk.Frame):
        """创建风险列表"""
        # 创建Treeview
        columns = ("risk_id", "level", "type", "title", "time", "is_confirmed")
        self.risk_tree = ttk.Treeview(parent, columns=columns, show="headings", height=10)
        
        # 设置列
        self.risk_tree.heading("risk_id", text="风险ID")
        self.risk_tree.heading("level", text="级别")
        self.risk_tree.heading("type", text="类型")
        self.risk_tree.heading("title", text="标题")
        self.risk_tree.heading("time", text="参考时间")
        self.risk_tree.heading("is_confirmed", text="状态")
        
        # 设置列宽
        self.risk_tree.column("risk_id", width=120)
        self.risk_tree.column("level", width=60)
        self.risk_tree.column("type", width=100)
        self.risk_tree.column("title", width=250)
        self.risk_tree.column("time", width=80)
        self.risk_tree.column("is_confirmed", width=80)
        
        # 滚动条
        risk_scroll = ttk.Scrollbar(parent, orient=tk.VERTICAL, command=self.risk_tree.yview)
        self.risk_tree.configure(yscrollcommand=risk_scroll.set)
        
        # 布局
        self.risk_tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        risk_scroll.pack(side=tk.RIGHT, fill=tk.Y)
        
        # 绑定事件
        self.risk_tree.bind("<<TreeviewSelect>>", self._on_risk_select)
    
    def _create_risk_detail(self, parent: ttk.Frame):
        """创建风险详情区域"""
        # 操作按钮区
        button_frame = ttk.Frame(parent)
        button_frame.pack(fill=tk.X, pady=(0, 5))
        
        ttk.Button(button_frame, text="确认风险", command=self._confirm_selected_risk).pack(side=tk.LEFT, padx=5)
        ttk.Button(button_frame, text="取消确认", command=self._unconfirm_selected_risk).pack(side=tk.LEFT, padx=5)
        ttk.Button(button_frame, text="确认所有风险", command=self._confirm_all_risks).pack(side=tk.LEFT, padx=5)
        ttk.Button(button_frame, text="重新检测风险", command=self._run_risk_detection).pack(side=tk.LEFT, padx=5)
        
        # 确认人输入
        ttk.Label(button_frame, text="确认人:").pack(side=tk.LEFT, padx=(20, 5))
        self.confirmer_var = tk.StringVar(value="舞台监督")
        ttk.Entry(button_frame, textvariable=self.confirmer_var, width=15).pack(side=tk.LEFT, padx=5)
        
        # 详情文本
        self.risk_detail_text = scrolledtext.ScrolledText(
            parent, wrap=tk.WORD, height=12, font=("Consolas", 10)
        )
        self.risk_detail_text.pack(fill=tk.BOTH, expand=True)
    
    def _create_status_bar(self):
        """创建状态栏"""
        self.status_var = tk.StringVar(value="就绪")
        status_bar = ttk.Label(self.root, textvariable=self.status_var, relief=tk.SUNKEN, anchor=tk.W)
        status_bar.pack(side=tk.BOTTOM, fill=tk.X)
    
    def _update_status(self, message: str):
        """更新状态栏"""
        self.status_var.set(message)
        self.root.update_idletasks()
    
    # ========== 数据加载相关 ==========
    
    def _try_load_example_data(self):
        """尝试加载示例数据"""
        example_dir = Path(__file__).parent / "examples"
        
        if example_dir.exists():
            try:
                self.project = ProjectLoader.from_directory(str(example_dir), "示例项目")
                if self.project.lighting_cues:
                    # 运行风险检测
                    self._update_status("正在运行风险检测...")
                    run_risk_detection(self.project)
                    self.risk_manager = RiskConfirmationManager(self.project)
                    
                    # 更新UI
                    self._update_filter_options()
                    self._refresh_all_views()
                    self._update_status(f"已加载示例项目: {len(self.project.lighting_cues)} 个CUE, {len(self.project.risks)} 个风险")
                else:
                    self._update_status("示例目录存在但未找到数据文件")
            except Exception as e:
                self._update_status(f"加载示例数据失败: {e}")
        else:
            self._update_status("就绪 - 请加载数据文件")
    
    def _new_project(self):
        """新建项目"""
        if self.project and self.project.risks:
            if not messagebox.askyesno("确认", "当前项目有未保存的更改，确定要新建项目吗？"):
                return
        
        self.project = ReviewProject(name="新项目")
        self.risk_manager = None
        
        self._update_filter_options()
        self._refresh_all_views()
        self._update_status("已创建新项目")
    
    def _load_cues_file(self):
        """加载灯光CUE文件"""
        file_path = filedialog.askopenfilename(
            title="选择灯光CUE文件",
            filetypes=[("CSV文件", "*.csv"), ("所有文件", "*.*")]
        )
        
        if file_path:
            self._update_status(f"正在加载: {file_path}")
            try:
                from parsers import LightingCuesParser
                if not self.project:
                    self.project = ReviewProject(name=Path(file_path).stem)
                
                self.project.lighting_cues = LightingCuesParser.parse(file_path)
                self._update_filter_options()
                self._refresh_all_views()
                self._update_status(f"已加载 {len(self.project.lighting_cues)} 个灯光CUE")
            except Exception as e:
                messagebox.showerror("错误", f"加载文件失败: {e}")
                self._update_status("加载失败")
    
    def _load_timeline_file(self):
        """加载曲目时间轴文件"""
        file_path = filedialog.askopenfilename(
            title="选择曲目时间轴文件",
            filetypes=[("JSON文件", "*.json"), ("所有文件", "*.*")]
        )
        
        if file_path:
            self._update_status(f"正在加载: {file_path}")
            try:
                from parsers import TrackTimelineParser
                if not self.project:
                    self.project = ReviewProject(name=Path(file_path).stem)
                
                self.project.track_markers = TrackTimelineParser.parse(file_path)
                self._update_filter_options()
                self._refresh_all_views()
                self._update_status(f"已加载 {len(self.project.track_markers)} 个曲目标记")
            except Exception as e:
                messagebox.showerror("错误", f"加载文件失败: {e}")
                self._update_status("加载失败")
    
    def _load_channels_file(self):
        """加载设备通道文件"""
        file_path = filedialog.askopenfilename(
            title="选择设备通道文件",
            filetypes=[("YAML文件", "*.yaml;*.yml"), ("所有文件", "*.*")]
        )
        
        if file_path:
            self._update_status(f"正在加载: {file_path}")
            try:
                from parsers import DeviceChannelsParser
                if not self.project:
                    self.project = ReviewProject(name=Path(file_path).stem)
                
                self.project.device_channels = DeviceChannelsParser.parse(file_path)
                self._update_filter_options()
                self._refresh_all_views()
                self._update_status(f"已加载 {len(self.project.device_channels)} 个设备通道配置")
            except Exception as e:
                messagebox.showerror("错误", f"加载文件失败: {e}")
                self._update_status("加载失败")
    
    def _load_from_directory(self):
        """从目录自动加载"""
        directory = filedialog.askdirectory(title="选择项目目录")
        
        if directory:
            self._update_status(f"正在从目录加载: {directory}")
            try:
                self.project = ProjectLoader.from_directory(directory)
                self.risk_manager = None
                
                # 自动运行风险检测
                if self.project.lighting_cues:
                    self._update_status("正在运行风险检测...")
                    run_risk_detection(self.project)
                    self.risk_manager = RiskConfirmationManager(self.project)
                
                self._update_filter_options()
                self._refresh_all_views()
                self._update_status(
                    f"已加载项目: {len(self.project.lighting_cues)} CUE, "
                    f"{len(self.project.track_markers)} 曲目, {len(self.project.device_channels)} 通道"
                )
            except Exception as e:
                messagebox.showerror("错误", f"加载目录失败: {e}")
                self._update_status("加载失败")
    
    def _save_project(self):
        """保存项目"""
        if not self.project:
            messagebox.showwarning("警告", "没有可保存的项目")
            return
        
        file_path = filedialog.asksaveasfilename(
            title="保存项目",
            defaultextension=".json",
            filetypes=[("JSON文件", "*.json"), ("所有文件", "*.*")]
        )
        
        if file_path:
            if ProjectPersistence.save_project(self.project, file_path):
                self._update_status(f"项目已保存到: {file_path}")
            else:
                messagebox.showerror("错误", "保存项目失败")
    
    def _load_project(self):
        """加载项目"""
        file_path = filedialog.askopenfilename(
            title="加载项目",
            filetypes=[("JSON文件", "*.json"), ("所有文件", "*.*")]
        )
        
        if file_path:
            project = ProjectPersistence.load_project(file_path)
            if project:
                self.project = project
                self.risk_manager = RiskConfirmationManager(self.project)
                self._update_filter_options()
                self._refresh_all_views()
                self._update_status(f"项目已加载: {project.name}")
            else:
                messagebox.showerror("错误", "加载项目失败")
    
    # ========== 风险检测和操作 ==========
    
    def _run_risk_detection(self):
        """运行风险检测"""
        if not self.project or not self.project.lighting_cues:
            messagebox.showwarning("警告", "请先加载灯光CUE数据")
            return
        
        self._update_status("正在运行风险检测...")
        
        try:
            risks = run_risk_detection(self.project)
            self.risk_manager = RiskConfirmationManager(self.project)
            
            self._refresh_risk_list()
            self._update_status(f"检测完成: 发现 {len(risks)} 个风险")
        except Exception as e:
            messagebox.showerror("错误", f"风险检测失败: {e}")
            self._update_status("检测失败")
    
    def _confirm_selected_risk(self):
        """确认选中的风险"""
        selected = self.risk_tree.selection()
        if not selected:
            messagebox.showwarning("警告", "请先选择一个风险")
            return
        
        if not self.risk_manager:
            return
        
        item = selected[0]
        risk_id = self.risk_tree.item(item, "values")[0]
        
        confirmer = self.confirmer_var.get() or "舞台监督"
        
        if self.risk_manager.confirm_risk(risk_id, confirmer):
            self._refresh_risk_list()
            self._update_status(f"风险 {risk_id} 已确认")
    
    def _unconfirm_selected_risk(self):
        """取消确认选中的风险"""
        selected = self.risk_tree.selection()
        if not selected:
            messagebox.showwarning("警告", "请先选择一个风险")
            return
        
        if not self.risk_manager:
            return
        
        item = selected[0]
        risk_id = self.risk_tree.item(item, "values")[0]
        
        if self.risk_manager.unconfirm_risk(risk_id):
            self._refresh_risk_list()
            self._update_status(f"风险 {risk_id} 已取消确认")
    
    def _confirm_all_risks(self):
        """确认所有风险"""
        if not self.risk_manager:
            messagebox.showwarning("警告", "没有可确认的风险")
            return
        
        if messagebox.askyesno("确认", "确定要确认所有风险吗？"):
            confirmer = self.confirmer_var.get() or "舞台监督"
            count = self.risk_manager.confirm_all_risks(confirmer)
            self._refresh_risk_list()
            self._update_status(f"已确认 {count} 个风险")
    
    # ========== 报告导出 ==========
    
    def _export_markdown(self):
        """导出Markdown报告"""
        if not self.project:
            messagebox.showwarning("警告", "没有可导出的项目")
            return
        
        file_path = filedialog.asksaveasfilename(
            title="导出Markdown报告",
            defaultextension=".md",
            filetypes=[("Markdown文件", "*.md"), ("所有文件", "*.*")]
        )
        
        if file_path:
            if ReportExporter.export_markdown(self.project, file_path):
                self._update_status(f"Markdown报告已导出到: {file_path}")
            else:
                messagebox.showerror("错误", "导出报告失败")
    
    def _export_csv(self):
        """导出CSV报告"""
        if not self.project:
            messagebox.showwarning("警告", "没有可导出的项目")
            return
        
        file_path = filedialog.asksaveasfilename(
            title="导出CSV报告",
            defaultextension=".csv",
            filetypes=[("CSV文件", "*.csv"), ("所有文件", "*.*")]
        )
        
        if file_path:
            if ReportExporter.export_csv(self.project, file_path):
                self._update_status(f"CSV报告已导出到: {file_path}")
            else:
                messagebox.showerror("错误", "导出报告失败")
    
    def _export_cue_list(self):
        """导出CUE列表"""
        if not self.project or not self.project.lighting_cues:
            messagebox.showwarning("警告", "没有可导出的CUE数据")
            return
        
        file_path = filedialog.asksaveasfilename(
            title="导出CUE列表",
            defaultextension=".csv",
            filetypes=[("CSV文件", "*.csv"), ("所有文件", "*.*")]
        )
        
        if file_path:
            if ReportExporter.export_cue_list_csv(self.project, file_path):
                self._update_status(f"CUE列表已导出到: {file_path}")
            else:
                messagebox.showerror("错误", "导出失败")
    
    # ========== UI更新相关 ==========
    
    def _update_filter_options(self):
        """更新筛选选项"""
        if not self.project:
            self.scene_combo['values'] = ["全部"]
            self.device_combo['values'] = ["全部"]
            return
        
        # 更新场景选项
        scenes = ["全部"] + sorted(self.project.get_scenes())
        self.scene_combo['values'] = scenes
        
        # 更新设备选项
        devices = ["全部"] + sorted(self.project.get_devices())
        self.device_combo['values'] = devices
    
    def _reset_filters(self):
        """重置筛选条件"""
        self.scene_var.set("全部")
        self.device_var.set("全部")
        self.risk_type_var.set("全部")
        self.risk_level_var.set("全部")
        self.show_confirmed_var.set(True)
        
        self.filter_scene = None
        self.filter_device = None
        self.filter_risk_type = None
        self.filter_risk_level = None
        self.show_confirmed = True
        
        self._refresh_all_views()
    
    def _on_filter_change(self, event=None):
        """筛选条件改变时的处理"""
        # 获取筛选值
        scene = self.scene_var.get()
        self.filter_scene = None if scene == "全部" else scene
        
        device = self.device_var.get()
        self.filter_device = None if device == "全部" else device
        
        risk_type_str = self.risk_type_var.get()
        self.filter_risk_type = None
        if risk_type_str != "全部":
            for rt in RiskType:
                if rt.value == risk_type_str:
                    self.filter_risk_type = rt
                    break
        
        risk_level_str = self.risk_level_var.get()
        self.filter_risk_level = None
        if risk_level_str != "全部":
            for rl in RiskLevel:
                if rl.value == risk_level_str:
                    self.filter_risk_level = rl
                    break
        
        self.show_confirmed = self.show_confirmed_var.get()
        
        self._refresh_all_views()
    
    def _refresh_all_views(self):
        """刷新所有视图"""
        self._refresh_cue_list()
        self._refresh_channel_usage()
        self._refresh_risk_list()
    
    def _refresh_cue_list(self):
        """刷新CUE列表"""
        # 清空现有数据
        for item in self.cue_tree.get_children():
            self.cue_tree.delete(item)
        
        if not self.project or not self.project.lighting_cues:
            return
        
        # 筛选并显示CUE
        for cue in sorted(self.project.lighting_cues, key=lambda x: x.time):
            # 应用场景筛选
            if self.filter_scene and cue.scene != self.filter_scene:
                continue
            
            # 应用设备筛选（检查通道是否关联该设备）
            if self.filter_device:
                device_channels = [
                    c.channel_number for c in self.project.device_channels 
                    if c.device_name == self.filter_device
                ]
                if not any(ch in device_channels for ch in cue.channels.keys()):
                    continue
            
            track_name = cue.track_name or "-"
            channel_count = len(cue.channels)
            
            self.cue_tree.insert("", tk.END, values=(
                cue.cue_number,
                cue.scene,
                cue.description,
                f"{cue.time:.2f}s",
                track_name,
                channel_count
            ))
    
    def _refresh_channel_usage(self):
        """刷新通道占用显示"""
        # 清空现有数据
        for item in self.channel_tree.get_children():
            self.channel_tree.delete(item)
        
        if not self.project:
            return
        
        # 获取通道使用情况
        channel_usage = self.project.get_channel_usage()
        
        # 获取所有已定义的通道
        all_channels = set()
        for channel in self.project.device_channels:
            all_channels.add(channel.channel_number)
        for channel_num in channel_usage.keys():
            all_channels.add(channel_num)
        
        # 应用设备筛选
        if self.filter_device:
            device_channels = [
                c.channel_number for c in self.project.device_channels 
                if c.device_name == self.filter_device
            ]
            all_channels = {ch for ch in all_channels if ch in device_channels}
        
        for channel_num in sorted(all_channels):
            # 查找设备信息
            device_name = "-"
            scene = "-"
            for channel in self.project.device_channels:
                if channel.channel_number == channel_num:
                    device_name = channel.device_name
                    scene = channel.scene
                    break
            
            # 获取使用的CUE
            usage = channel_usage.get(channel_num)
            if usage:
                cues_str = ", ".join(usage.cues)
                has_conflict = "是" if usage.has_conflict() else "否"
            else:
                cues_str = "-"
                has_conflict = "否"
            
            self.channel_tree.insert("", tk.END, values=(
                channel_num,
                device_name,
                scene,
                cues_str,
                has_conflict
            ))
    
    def _refresh_risk_list(self):
        """刷新风险列表"""
        # 清空现有数据
        for item in self.risk_tree.get_children():
            self.risk_tree.delete(item)
        
        if not self.project or not self.project.risks:
            return
        
        # 筛选并显示风险
        for risk in sorted(self.project.risks, key=lambda x: (
            0 if x.level == RiskLevel.CRITICAL else
            1 if x.level == RiskLevel.HIGH else
            2 if x.level == RiskLevel.MEDIUM else 3,
            x.time_reference or 0
        )):
            # 应用已确认筛选
            if not self.show_confirmed and risk.is_confirmed:
                continue
            
            # 应用风险类型筛选
            if self.filter_risk_type and risk.risk_type != self.filter_risk_type:
                continue
            
            # 应用风险级别筛选
            if self.filter_risk_level and risk.level != self.filter_risk_level:
                continue
            
            # 应用场景筛选（检查受影响的CUE是否属于该场景）
            if self.filter_scene and risk.affected_cues:
                cue_scenes = set()
                for cue in self.project.lighting_cues:
                    if cue.cue_number in risk.affected_cues:
                        cue_scenes.add(cue.scene)
                if self.filter_scene not in cue_scenes:
                    continue
            
            time_str = f"{risk.time_reference:.2f}s" if risk.time_reference is not None else "-"
            status = "已确认" if risk.is_confirmed else "未确认"
            
            # 根据级别设置颜色
            tags = ()
            if risk.level == RiskLevel.CRITICAL:
                tags = ("critical",)
            elif risk.level == RiskLevel.HIGH:
                tags = ("high",)
            elif risk.level == RiskLevel.MEDIUM:
                tags = ("medium",)
            
            self.risk_tree.insert("", tk.END, values=(
                risk.id,
                risk.level.value,
                risk.risk_type.value,
                risk.title,
                time_str,
                status
            ), tags=tags)
    
    def _on_cue_select(self, event):
        """CUE选中时的处理"""
        selected = self.cue_tree.selection()
        if not selected or not self.project:
            return
        
        item = selected[0]
        cue_number = self.cue_tree.item(item, "values")[0]
        
        # 查找对应的CUE
        for cue in self.project.lighting_cues:
            if cue.cue_number == cue_number:
                # 显示CUE详情
                detail = f"=== CUE {cue.cue_number} 详情 ===\n\n"
                detail += f"场景: {cue.scene}\n"
                detail += f"描述: {cue.description}\n"
                detail += f"触发时间: {cue.time:.2f}s\n"
                if cue.track_name:
                    detail += f"关联曲目: {cue.track_name}\n"
                if cue.track_time is not None:
                    detail += f"曲目相对时间: {cue.track_time:.2f}s\n"
                if cue.fade_in:
                    detail += f"淡入时间: {cue.fade_in}s\n"
                if cue.fade_out:
                    detail += f"淡出时间: {cue.fade_out}s\n"
                detail += f"\n通道配置:\n"
                for ch, val in sorted(cue.channels.items()):
                    # 查找设备信息
                    device_info = ""
                    for channel in self.project.device_channels:
                        if channel.channel_number == ch:
                            device_info = f" ({channel.device_name})"
                            break
                    detail += f"  通道 {ch}{device_info}: {val}\n"
                if cue.notes:
                    detail += f"\n备注: {cue.notes}\n"
                
                self.risk_detail_text.delete(1.0, tk.END)
                self.risk_detail_text.insert(tk.END, detail)
                break
    
    def _on_risk_select(self, event):
        """风险选中时的处理"""
        selected = self.risk_tree.selection()
        if not selected or not self.project:
            return
        
        item = selected[0]
        risk_id = self.risk_tree.item(item, "values")[0]
        
        # 查找对应的风险
        for risk in self.project.risks:
            if risk.id == risk_id:
                # 显示风险详情
                detail = f"=== 风险 {risk.id} 详情 ===\n\n"
                detail += f"风险类型: {risk.risk_type.value}\n"
                detail += f"风险级别: {risk.level.value}\n"
                detail += f"标题: {risk.title}\n"
                if risk.time_reference is not None:
                    detail += f"参考时间: {risk.time_reference:.2f}s\n"
                if risk.affected_cues:
                    detail += f"影响CUE: {', '.join(risk.affected_cues)}\n"
                if risk.affected_channels:
                    detail += f"影响通道: {', '.join(map(str, risk.affected_channels))}\n"
                if risk.affected_tracks:
                    detail += f"影响曲目: {', '.join(risk.affected_tracks)}\n"
                detail += f"\n状态: {'已确认' if risk.is_confirmed else '未确认'}\n"
                if risk.is_confirmed:
                    if risk.confirmed_by:
                        detail += f"确认人: {risk.confirmed_by}\n"
                    if risk.confirmed_at:
                        detail += f"确认时间: {risk.confirmed_at.strftime('%Y-%m-%d %H:%M:%S')}\n"
                    if risk.notes:
                        detail += f"确认备注: {risk.notes}\n"
                detail += f"\n--- 详细描述 ---\n\n"
                detail += risk.description
                
                self.risk_detail_text.delete(1.0, tk.END)
                self.risk_detail_text.insert(tk.END, detail)
                break
    
    def _show_about(self):
        """显示关于对话框"""
        messagebox.showinfo(
            "关于",
            "舞台灯光时间线复核工具 v1.0\n\n"
            "用于舞台监督在彩排前复核灯光时间线。\n\n"
            "功能:\n"
            "- 加载灯光CUE (CSV)\n"
            "- 加载曲目时间轴 (JSON)\n"
            "- 加载设备通道配置 (YAML)\n"
            "- 自动检测风险\n"
            "- 导出Markdown/CSV报告"
        )


def main():
    """主函数"""
    root = tk.Tk()
    
    # 设置样式
    style = ttk.Style()
    style.theme_use('clam')  # 使用clam主题，更好的外观
    
    # 创建应用
    app = LightingReviewApp(root)
    
    # 运行主循环
    root.mainloop()


if __name__ == "__main__":
    main()