"""字幕无障碍校准台 - 主 GUI 窗口"""
import tkinter as tk
from tkinter import ttk, filedialog, messagebox, scrolledtext
from datetime import timedelta
from typing import Optional, List, Dict, Any
import os
import sys

# 添加项目根目录到路径
project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from src.models.models import (
    CalibrationProject, Subtitle, Issue, IssueType, IssueSeverity,
    timedelta_to_srt_format
)
from src.persistence.project_manager import ProjectManager
from src.offset.offset_calculator import OffsetManager
from src.io.exporter import BatchExporter, SRTExporter, MarkdownReportExporter, CSVIssueExporter


class SubtitleCalibrationApp:
    """字幕无障碍校准台主应用"""
    
    def __init__(self, root: tk.Tk):
        self.root = root
        self.root.title("字幕无障碍校准台")
        self.root.geometry("1400x900")
        self.root.minsize(1200, 700)
        
        # 项目管理器
        self.project_manager = ProjectManager()
        self.offset_manager: Optional[OffsetManager] = None
        
        # 当前选中的字幕和问题
        self.selected_subtitle_index: Optional[int] = None
        self.selected_issue_index: Optional[int] = None
        
        # 创建界面
        self._create_menu()
        self._create_toolbar()
        self._create_main_layout()
        self._create_statusbar()
        
        # 初始化新项目
        self._new_project()
    
    def _create_menu(self):
        """创建菜单栏"""
        menubar = tk.Menu(self.root)
        self.root.config(menu=menubar)
        
        # 文件菜单
        file_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="文件", menu=file_menu)
        
        file_menu.add_command(label="新建项目", command=self._new_project, accelerator="Ctrl+N")
        file_menu.add_command(label="打开项目", command=self._open_project, accelerator="Ctrl+O")
        file_menu.add_command(label="保存项目", command=self._save_project, accelerator="Ctrl+S")
        file_menu.add_command(label="另存为...", command=self._save_project_as)
        file_menu.add_separator()
        file_menu.add_command(label="退出", command=self.root.quit)
        
        # 导入菜单
        import_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="导入", menu=import_menu)
        
        import_menu.add_command(label="导入 SRT 字幕", command=self._import_srt)
        import_menu.add_command(label="导入时间码 CSV", command=self._import_timecodes)
        import_menu.add_command(label="导入环境音标注 JSON", command=self._import_audio_annotations)
        import_menu.add_command(label="导入反馈记录 CSV", command=self._import_feedback)
        import_menu.add_separator()
        import_menu.add_command(label="导入示例数据", command=self._import_sample_data)
        
        # 导出菜单
        export_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="导出", menu=export_menu)
        
        export_menu.add_command(label="导出修订后的 SRT", command=self._export_srt)
        export_menu.add_command(label="导出 Markdown 报告", command=self._export_report)
        export_menu.add_command(label="导出问题清单 CSV", command=self._export_issues_csv)
        export_menu.add_separator()
        export_menu.add_command(label="批量导出全部", command=self._export_all)
        
        # 分析菜单
        analysis_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="分析", menu=analysis_menu)
        
        analysis_menu.add_command(label="运行完整分析", command=self._run_analysis, accelerator="F5")
        analysis_menu.add_separator()
        analysis_menu.add_command(label="检查字幕延迟", command=lambda: self._run_specific_analysis('delay'))
        analysis_menu.add_command(label="检查说话人漏标", command=lambda: self._run_specific_analysis('speaker'))
        analysis_menu.add_command(label="检查音效提示缺失", command=lambda: self._run_specific_analysis('sound'))
        analysis_menu.add_command(label="检查阅读速度", command=lambda: self._run_specific_analysis('speed'))
        analysis_menu.add_command(label="检查时间轴重叠", command=lambda: self._run_specific_analysis('overlap'))
        
        # 帮助菜单
        help_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="帮助", menu=help_menu)
        
        help_menu.add_command(label="使用说明", command=self._show_help)
        help_menu.add_command(label="关于", command=self._show_about)
        
        # 绑定快捷键
        self.root.bind("<Control-n>", lambda e: self._new_project())
        self.root.bind("<Control-o>", lambda e: self._open_project())
        self.root.bind("<Control-s>", lambda e: self._save_project())
        self.root.bind("<F5>", lambda e: self._run_analysis())
    
    def _create_toolbar(self):
        """创建工具栏"""
        toolbar = ttk.Frame(self.root)
        toolbar.pack(side=tk.TOP, fill=tk.X, padx=5, pady=5)
        
        # 项目操作
        ttk.Button(toolbar, text="新建", command=self._new_project, width=8).pack(side=tk.LEFT, padx=2)
        ttk.Button(toolbar, text="打开", command=self._open_project, width=8).pack(side=tk.LEFT, padx=2)
        ttk.Button(toolbar, text="保存", command=self._save_project, width=8).pack(side=tk.LEFT, padx=2)
        
        ttk.Separator(toolbar, orient=tk.VERTICAL).pack(side=tk.LEFT, fill=tk.Y, padx=10)
        
        # 导入操作
        ttk.Button(toolbar, text="导入SRT", command=self._import_srt, width=10).pack(side=tk.LEFT, padx=2)
        ttk.Button(toolbar, text="导入时间码", command=self._import_timecodes, width=10).pack(side=tk.LEFT, padx=2)
        
        ttk.Separator(toolbar, orient=tk.VERTICAL).pack(side=tk.LEFT, fill=tk.Y, padx=10)
        
        # 分析操作
        ttk.Button(toolbar, text="运行分析", command=self._run_analysis, width=10, style='Accent.TButton').pack(side=tk.LEFT, padx=2)
        
        ttk.Separator(toolbar, orient=tk.VERTICAL).pack(side=tk.LEFT, fill=tk.Y, padx=10)
        
        # 导出操作
        ttk.Button(toolbar, text="导出全部", command=self._export_all, width=10).pack(side=tk.LEFT, padx=2)
    
    def _create_main_layout(self):
        """创建主界面布局"""
        # 主容器
        main_container = ttk.PanedWindow(self.root, orient=tk.HORIZONTAL)
        main_container.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)
        
        # 左侧：字幕列表
        left_frame = ttk.LabelFrame(main_container, text="字幕列表", padding=5)
        main_container.add(left_frame, weight=2)
        
        self._create_subtitle_list(left_frame)
        
        # 中间：问题列表
        middle_frame = ttk.LabelFrame(main_container, text="检测问题", padding=5)
        main_container.add(middle_frame, weight=2)
        
        self._create_issue_list(middle_frame)
        
        # 右侧：详情和操作
        right_frame = ttk.LabelFrame(main_container, text="详情与操作", padding=5)
        main_container.add(right_frame, weight=1)
        
        self._create_detail_panel(right_frame)
    
    def _create_subtitle_list(self, parent):
        """创建字幕列表"""
        # 列定义
        columns = ('index', 'start', 'end', 'text', 'speaker', 'offset')
        self.subtitle_tree = ttk.Treeview(parent, columns=columns, show='headings', height=15)
        
        # 设置列
        self.subtitle_tree.heading('index', text='序号')
        self.subtitle_tree.heading('start', text='开始时间')
        self.subtitle_tree.heading('end', text='结束时间')
        self.subtitle_tree.heading('text', text='内容')
        self.subtitle_tree.heading('speaker', text='说话人')
        self.subtitle_tree.heading('offset', text='偏移')
        
        self.subtitle_tree.column('index', width=50)
        self.subtitle_tree.column('start', width=100)
        self.subtitle_tree.column('end', width=100)
        self.subtitle_tree.column('text', width=200)
        self.subtitle_tree.column('speaker', width=80)
        self.subtitle_tree.column('offset', width=80)
        
        # 滚动条
        scrollbar_y = ttk.Scrollbar(parent, orient=tk.VERTICAL, command=self.subtitle_tree.yview)
        scrollbar_x = ttk.Scrollbar(parent, orient=tk.HORIZONTAL, command=self.subtitle_tree.xview)
        self.subtitle_tree.configure(yscrollcommand=scrollbar_y.set, xscrollcommand=scrollbar_x.set)
        
        # 布局
        self.subtitle_tree.pack(side=tk.TOP, fill=tk.BOTH, expand=True)
        scrollbar_y.pack(side=tk.RIGHT, fill=tk.Y)
        scrollbar_x.pack(side=tk.BOTTOM, fill=tk.X)
        
        # 绑定选择事件
        self.subtitle_tree.bind('<<TreeviewSelect>>', self._on_subtitle_select)
    
    def _create_issue_list(self, parent):
        """创建问题列表"""
        # 列定义
        columns = ('type', 'severity', 'subtitle', 'time', 'status')
        self.issue_tree = ttk.Treeview(parent, columns=columns, show='headings', height=15)
        
        # 设置列
        self.issue_tree.heading('type', text='问题类型')
        self.issue_tree.heading('severity', text='严重程度')
        self.issue_tree.heading('subtitle', text='相关字幕')
        self.issue_tree.heading('time', text='时间')
        self.issue_tree.heading('status', text='状态')
        
        self.issue_tree.column('type', width=120)
        self.issue_tree.column('severity', width=80)
        self.issue_tree.column('subtitle', width=80)
        self.issue_tree.column('time', width=120)
        self.issue_tree.column('status', width=80)
        
        # 滚动条
        scrollbar_y = ttk.Scrollbar(parent, orient=tk.VERTICAL, command=self.issue_tree.yview)
        self.issue_tree.configure(yscrollcommand=scrollbar_y.set)
        
        # 布局
        self.issue_tree.pack(side=tk.TOP, fill=tk.BOTH, expand=True)
        scrollbar_y.pack(side=tk.RIGHT, fill=tk.Y)
        
        # 绑定选择事件
        self.issue_tree.bind('<<TreeviewSelect>>', self._on_issue_select)
        
        # 双击事件
        self.issue_tree.bind('<Double-1>', self._on_issue_double_click)
    
    def _create_detail_panel(self, parent):
        """创建详情面板"""
        # 使用 Notebook 组织多个标签页
        notebook = ttk.Notebook(parent)
        notebook.pack(fill=tk.BOTH, expand=True)
        
        # 详情标签页
        detail_frame = ttk.Frame(notebook, padding=5)
        notebook.add(detail_frame, text="详情")
        
        self._create_detail_content(detail_frame)
        
        # 偏移调整标签页
        offset_frame = ttk.Frame(notebook, padding=5)
        notebook.add(offset_frame, text="偏移调整")
        
        self._create_offset_panel(offset_frame)
        
        # 统计标签页
        stats_frame = ttk.Frame(notebook, padding=5)
        notebook.add(stats_frame, text="统计")
        
        self._create_stats_panel(stats_frame)
    
    def _create_detail_content(self, parent):
        """创建详情内容"""
        # 选中项信息
        ttk.Label(parent, text="选中项信息", font=('Arial', 10, 'bold')).pack(anchor=tk.W, pady=5)
        
        # 信息显示区域
        self.detail_text = scrolledtext.ScrolledText(parent, height=10, wrap=tk.WORD, font=('Arial', 10))
        self.detail_text.pack(fill=tk.BOTH, expand=True, pady=5)
        
        # 操作按钮
        btn_frame = ttk.Frame(parent)
        btn_frame.pack(fill=tk.X, pady=5)
        
        ttk.Button(btn_frame, text="标记问题已解决", command=self._mark_issue_resolved).pack(side=tk.LEFT, padx=2)
        ttk.Button(btn_frame, text="编辑字幕", command=self._edit_subtitle).pack(side=tk.LEFT, padx=2)
        ttk.Button(btn_frame, text="应用建议偏移", command=self._apply_suggested_offset).pack(side=tk.LEFT, padx=2)
    
    def _create_offset_panel(self, parent):
        """创建偏移调整面板"""
        # 全局偏移
        ttk.Label(parent, text="全局偏移调整", font=('Arial', 10, 'bold')).pack(anchor=tk.W, pady=5)
        
        global_frame = ttk.Frame(parent)
        global_frame.pack(fill=tk.X, pady=5)
        
        ttk.Label(global_frame, text="偏移量 (秒):").pack(side=tk.LEFT, padx=5)
        
        self.global_offset_var = tk.StringVar(value="0.000")
        ttk.Entry(global_frame, textvariable=self.global_offset_var, width=15).pack(side=tk.LEFT, padx=5)
        
        ttk.Button(global_frame, text="应用", command=self._apply_global_offset).pack(side=tk.LEFT, padx=5)
        ttk.Button(global_frame, text="重置", command=lambda: self.global_offset_var.set("0.000")).pack(side=tk.LEFT, padx=5)
        
        # 快速调整按钮
        quick_frame = ttk.LabelFrame(parent, text="快速调整", padding=5)
        quick_frame.pack(fill=tk.X, pady=10)
        
        ttk.Button(quick_frame, text="-1.0秒", command=lambda: self._quick_offset(-1.0)).pack(side=tk.LEFT, padx=2)
        ttk.Button(quick_frame, text="-0.5秒", command=lambda: self._quick_offset(-0.5)).pack(side=tk.LEFT, padx=2)
        ttk.Button(quick_frame, text="-0.1秒", command=lambda: self._quick_offset(-0.1)).pack(side=tk.LEFT, padx=2)
        ttk.Button(quick_frame, text="+0.1秒", command=lambda: self._quick_offset(0.1)).pack(side=tk.LEFT, padx=2)
        ttk.Button(quick_frame, text="+0.5秒", command=lambda: self._quick_offset(0.5)).pack(side=tk.LEFT, padx=2)
        ttk.Button(quick_frame, text="+1.0秒", command=lambda: self._quick_offset(1.0)).pack(side=tk.LEFT, padx=2)
        
        # 批量偏移
        ttk.Label(parent, text="批量偏移调整", font=('Arial', 10, 'bold')).pack(anchor=tk.W, pady=10)
        
        batch_frame = ttk.Frame(parent)
        batch_frame.pack(fill=tk.X, pady=5)
        
        ttk.Label(batch_frame, text="从:").pack(side=tk.LEFT, padx=5)
        self.batch_start_var = tk.StringVar(value="1")
        ttk.Entry(batch_frame, textvariable=self.batch_start_var, width=8).pack(side=tk.LEFT, padx=2)
        
        ttk.Label(batch_frame, text="到:").pack(side=tk.LEFT, padx=5)
        self.batch_end_var = tk.StringVar(value="1")
        ttk.Entry(batch_frame, textvariable=self.batch_end_var, width=8).pack(side=tk.LEFT, padx=2)
        
        ttk.Label(batch_frame, text="偏移:").pack(side=tk.LEFT, padx=5)
        self.batch_offset_var = tk.StringVar(value="0.000")
        ttk.Entry(batch_frame, textvariable=self.batch_offset_var, width=10).pack(side=tk.LEFT, padx=2)
        
        ttk.Button(batch_frame, text="应用", command=self._apply_batch_offset).pack(side=tk.LEFT, padx=5)
        
        # 智能建议
        ttk.Label(parent, text="智能偏移建议", font=('Arial', 10, 'bold')).pack(anchor=tk.W, pady=10)
        
        suggest_frame = ttk.Frame(parent)
        suggest_frame.pack(fill=tk.X, pady=5)
        
        ttk.Button(suggest_frame, text="获取智能建议", command=self._get_smart_suggestions).pack(side=tk.LEFT, padx=5)
        
        self.suggestions_text = scrolledtext.ScrolledText(parent, height=8, wrap=tk.WORD, font=('Arial', 9))
        self.suggestions_text.pack(fill=tk.X, pady=5)
    
    def _create_stats_panel(self, parent):
        """创建统计面板"""
        self.stats_text = scrolledtext.ScrolledText(parent, wrap=tk.WORD, font=('Arial', 10))
        self.stats_text.pack(fill=tk.BOTH, expand=True)
    
    def _create_statusbar(self):
        """创建状态栏"""
        self.statusbar = ttk.Frame(self.root)
        self.statusbar.pack(side=tk.BOTTOM, fill=tk.X)
        
        self.status_label = ttk.Label(self.statusbar, text="就绪", relief=tk.SUNKEN, anchor=tk.W)
        self.status_label.pack(side=tk.LEFT, fill=tk.X, expand=True)
        
        self.project_label = ttk.Label(self.statusbar, text="项目: 未命名", relief=tk.SUNKEN, anchor=tk.W)
        self.project_label.pack(side=tk.LEFT, padx=10)
        
        self.subtitle_count_label = ttk.Label(self.statusbar, text="字幕: 0", relief=tk.SUNKEN, anchor=tk.W)
        self.subtitle_count_label.pack(side=tk.LEFT, padx=10)
        
        self.issue_count_label = ttk.Label(self.statusbar, text="问题: 0", relief=tk.SUNKEN, anchor=tk.W)
        self.issue_count_label.pack(side=tk.LEFT, padx=10)
    
    def _update_status(self, message: str):
        """更新状态栏"""
        self.status_label.config(text=message)
        self.root.update_idletasks()
    
    def _update_counts(self):
        """更新计数显示"""
        project = self.project_manager.current_project
        
        if project:
            self.project_label.config(text=f"项目: {project.name}")
            self.subtitle_count_label.config(text=f"字幕: {len(project.subtitles)}")
            self.issue_count_label.config(text=f"问题: {len(project.issues)}")
        else:
            self.project_label.config(text="项目: 未命名")
            self.subtitle_count_label.config(text="字幕: 0")
            self.issue_count_label.config(text="问题: 0")
    
    def _new_project(self):
        """新建项目"""
        self.project_manager.new_project("未命名项目")
        self.offset_manager = None
        self._refresh_all()
        self._update_status("已创建新项目")
    
    def _open_project(self):
        """打开项目"""
        file_path = filedialog.askopenfilename(
            title="打开项目",
            filetypes=[("字幕校准项目", "*.scc"), ("所有文件", "*.*")]
        )
        
        if file_path:
            project = self.project_manager.load_project(file_path)
            if project:
                self.offset_manager = OffsetManager(project)
                self._refresh_all()
                self._update_status(f"已打开项目: {os.path.basename(file_path)}")
            else:
                messagebox.showerror("错误", "无法打开项目文件")
    
    def _save_project(self):
        """保存项目"""
        if self.project_manager.current_file_path:
            if self.project_manager.save_project():
                self._update_status("项目已保存")
            else:
                messagebox.showerror("错误", "保存失败")
        else:
            self._save_project_as()
    
    def _save_project_as(self):
        """另存为项目"""
        file_path = filedialog.asksaveasfilename(
            title="保存项目",
            defaultextension=".scc",
            filetypes=[("字幕校准项目", "*.scc"), ("所有文件", "*.*")]
        )
        
        if file_path:
            if self.project_manager.save_project(file_path):
                self._update_status(f"项目已保存到: {os.path.basename(file_path)}")
            else:
                messagebox.showerror("错误", "保存失败")
    
    def _import_srt(self):
        """导入 SRT 字幕"""
        file_path = filedialog.askopenfilename(
            title="导入 SRT 字幕",
            filetypes=[("SRT 字幕", "*.srt"), ("所有文件", "*.*")]
        )
        
        if file_path:
            if self.project_manager.current_project is None:
                self.project_manager.new_project()
            
            result = self.project_manager.import_from_files(srt_path=file_path)
            
            if result['success']:
                self.offset_manager = OffsetManager(self.project_manager.current_project)
                self._refresh_subtitle_list()
                self._update_counts()
                self._update_status(f"已导入 {len(self.project_manager.current_project.subtitles)} 条字幕")
            else:
                messagebox.showerror("导入失败", "\n".join(result['errors']))
    
    def _import_timecodes(self):
        """导入时间码 CSV"""
        file_path = filedialog.askopenfilename(
            title="导入时间码 CSV",
            filetypes=[("CSV 文件", "*.csv"), ("所有文件", "*.*")]
        )
        
        if file_path:
            if self.project_manager.current_project is None:
                self.project_manager.new_project()
            
            result = self.project_manager.import_from_files(timecode_csv_path=file_path)
            
            if result['success']:
                self._update_counts()
                self._update_status(f"已导入 {len(self.project_manager.current_project.timecodes)} 条时间码")
            else:
                messagebox.showerror("导入失败", "\n".join(result['errors']))
    
    def _import_audio_annotations(self):
        """导入环境音标注 JSON"""
        file_path = filedialog.askopenfilename(
            title="导入环境音标注 JSON",
            filetypes=[("JSON 文件", "*.json"), ("所有文件", "*.*")]
        )
        
        if file_path:
            if self.project_manager.current_project is None:
                self.project_manager.new_project()
            
            result = self.project_manager.import_from_files(audio_json_path=file_path)
            
            if result['success']:
                self._update_counts()
                self._update_status(f"已导入 {len(self.project_manager.current_project.audio_annotations)} 条音频标注")
            else:
                messagebox.showerror("导入失败", "\n".join(result['errors']))
    
    def _import_feedback(self):
        """导入反馈记录 CSV"""
        file_path = filedialog.askopenfilename(
            title="导入反馈记录 CSV",
            filetypes=[("CSV 文件", "*.csv"), ("所有文件", "*.*")]
        )
        
        if file_path:
            if self.project_manager.current_project is None:
                self.project_manager.new_project()
            
            result = self.project_manager.import_from_files(feedback_csv_path=file_path)
            
            if result['success']:
                self._update_counts()
                self._update_status(f"已导入 {len(self.project_manager.current_project.feedback_records)} 条反馈记录")
            else:
                messagebox.showerror("导入失败", "\n".join(result['errors']))
    
    def _import_sample_data(self):
        """导入示例数据"""
        data_dir = os.path.join(project_root, 'data')
        
        if not os.path.exists(data_dir):
            messagebox.showwarning("警告", "示例数据目录不存在")
            return
        
        self.project_manager.new_project("示例项目")
        
        # 尝试导入所有示例文件
        srt_path = os.path.join(data_dir, 'sample_subtitles.srt')
        timecode_path = os.path.join(data_dir, 'sample_timecodes.csv')
        audio_path = os.path.join(data_dir, 'sample_audio_annotations.json')
        feedback_path = os.path.join(data_dir, 'sample_feedback.csv')
        
        imported_count = 0
        
        if os.path.exists(srt_path):
            self.project_manager.import_from_files(srt_path=srt_path)
            imported_count += 1
        
        if os.path.exists(timecode_path):
            self.project_manager.import_from_files(timecode_csv_path=timecode_path)
            imported_count += 1
        
        if os.path.exists(audio_path):
            self.project_manager.import_from_files(audio_json_path=audio_path)
            imported_count += 1
        
        if os.path.exists(feedback_path):
            self.project_manager.import_from_files(feedback_csv_path=feedback_path)
            imported_count += 1
        
        self.offset_manager = OffsetManager(self.project_manager.current_project)
        self._refresh_all()
        
        messagebox.showinfo("完成", f"已导入 {imported_count} 个示例数据文件\n\n请点击「运行分析」查看检测结果")
        self._update_status("示例数据已导入")
    
    def _run_analysis(self):
        """运行完整分析"""
        project = self.project_manager.current_project
        
        if not project or not project.subtitles:
            messagebox.showwarning("警告", "请先导入字幕数据")
            return
        
        self._update_status("正在分析...")
        self.root.update_idletasks()
        
        result = self.project_manager.run_analysis()
        
        if result['success']:
            self._refresh_issue_list()
            self._refresh_stats()
            self._update_counts()
            self._update_status(f"分析完成: 检测到 {len(result['issues'])} 个问题")
        else:
            messagebox.showerror("错误", result['message'])
    
    def _run_specific_analysis(self, analysis_type: str):
        """运行特定类型的分析"""
        # 简化处理：先运行完整分析，然后过滤
        self._run_analysis()
    
    def _export_srt(self):
        """导出 SRT"""
        project = self.project_manager.current_project
        
        if not project or not project.subtitles:
            messagebox.showwarning("警告", "没有可导出的字幕")
            return
        
        file_path = filedialog.asksaveasfilename(
            title="导出 SRT",
            defaultextension=".srt",
            filetypes=[("SRT 字幕", "*.srt"), ("所有文件", "*.*")]
        )
        
        if file_path:
            result = SRTExporter.export(project.subtitles, file_path)
            if result['success']:
                self._update_status(f"已导出到: {os.path.basename(file_path)}")
            else:
                messagebox.showerror("导出失败", result['message'])
    
    def _export_report(self):
        """导出 Markdown 报告"""
        project = self.project_manager.current_project
        
        if not project:
            messagebox.showwarning("警告", "没有可导出的项目")
            return
        
        file_path = filedialog.asksaveasfilename(
            title="导出 Markdown 报告",
            defaultextension=".md",
            filetypes=[("Markdown 文件", "*.md"), ("所有文件", "*.*")]
        )
        
        if file_path:
            result = MarkdownReportExporter.export(project, file_path)
            if result['success']:
                self._update_status(f"已导出报告到: {os.path.basename(file_path)}")
            else:
                messagebox.showerror("导出失败", result['message'])
    
    def _export_issues_csv(self):
        """导出问题清单 CSV"""
        project = self.project_manager.current_project
        
        if not project:
            messagebox.showwarning("警告", "没有可导出的项目")
            return
        
        file_path = filedialog.asksaveasfilename(
            title="导出问题清单",
            defaultextension=".csv",
            filetypes=[("CSV 文件", "*.csv"), ("所有文件", "*.*")]
        )
        
        if file_path:
            result = CSVIssueExporter.export(project.issues, file_path)
            if result['success']:
                self._update_status(f"已导出问题清单到: {os.path.basename(file_path)}")
            else:
                messagebox.showerror("导出失败", result['message'])
    
    def _export_all(self):
        """批量导出全部"""
        project = self.project_manager.current_project
        
        if not project:
            messagebox.showwarning("警告", "没有可导出的项目")
            return
        
        output_dir = filedialog.askdirectory(title="选择导出目录")
        
        if output_dir:
            base_name = project.name.replace(" ", "_")
            result = BatchExporter.export_all(project, output_dir, base_name)
            
            if result['success']:
                messages = [f"已导出到: {output_dir}"]
                for exp in result['exports']:
                    messages.append(f"  - {os.path.basename(exp['file_path'])} ({exp.get('subtitle_count', exp.get('issue_count', 0))}项)")
                
                messagebox.showinfo("导出完成", "\n".join(messages))
                self._update_status("批量导出完成")
            else:
                messagebox.showerror("导出失败", "\n".join(result['errors']))
    
    def _refresh_all(self):
        """刷新所有界面"""
        self._refresh_subtitle_list()
        self._refresh_issue_list()
        self._refresh_stats()
        self._update_counts()
    
    def _refresh_subtitle_list(self):
        """刷新字幕列表"""
        # 清空现有项
        for item in self.subtitle_tree.get_children():
            self.subtitle_tree.delete(item)
        
        project = self.project_manager.current_project
        if not project:
            return
        
        for sub in project.subtitles:
            offset_str = f"{sub.offset_applied.total_seconds():+.3f}" if sub.offset_applied.total_seconds() != 0 else ""
            speaker_str = sub.speaker if sub.speaker else ""
            
            self.subtitle_tree.insert('', tk.END, values=(
                sub.index,
                timedelta_to_srt_format(sub.start_time),
                timedelta_to_srt_format(sub.end_time),
                sub.text.replace('\n', ' ')[:30],
                speaker_str,
                offset_str
            ))
    
    def _refresh_issue_list(self):
        """刷新问题列表"""
        # 清空现有项
        for item in self.issue_tree.get_children():
            self.issue_tree.delete(item)
        
        project = self.project_manager.current_project
        if not project:
            return
        
        for idx, issue in enumerate(project.issues):
            status = "已解决" if issue.resolved else "待处理"
            subtitle_str = f"#{issue.subtitle_index}" if issue.subtitle_index else ""
            time_str = str(issue.start_time) if issue.start_time else ""
            
            # 根据严重程度设置颜色标签
            tags = ()
            if issue.severity == IssueSeverity.CRITICAL:
                tags = ('critical',)
            elif issue.severity == IssueSeverity.HIGH:
                tags = ('high',)
            elif issue.resolved:
                tags = ('resolved',)
            
            self.issue_tree.insert('', tk.END, iid=str(idx), values=(
                issue.issue_type.value,
                issue.severity.value,
                subtitle_str,
                time_str,
                status
            ), tags=tags)
    
    def _refresh_stats(self):
        """刷新统计面板"""
        project = self.project_manager.current_project
        if not project:
            self.stats_text.delete(1.0, tk.END)
            return
        
        # 统计
        stats_text = []
        stats_text.append("=" * 50)
        stats_text.append("项目统计信息")
        stats_text.append("=" * 50)
        stats_text.append("")
        
        stats_text.append(f"项目名称: {project.name}")
        stats_text.append(f"创建时间: {project.created_at.strftime('%Y-%m-%d %H:%M:%S') if project.created_at else 'N/A'}")
        stats_text.append("")
        
        stats_text.append("-" * 50)
        stats_text.append("数据统计")
        stats_text.append("-" * 50)
        stats_text.append(f"  字幕总数: {len(project.subtitles)} 条")
        stats_text.append(f"  时间码: {len(project.timecodes)} 条")
        stats_text.append(f"  音频标注: {len(project.audio_annotations)} 条")
        stats_text.append(f"  反馈记录: {len(project.feedback_records)} 条")
        stats_text.append("")
        
        stats_text.append("-" * 50)
        stats_text.append("问题统计")
        stats_text.append("-" * 50)
        
        # 按类型统计
        type_stats = {}
        severity_stats = {}
        resolved_count = 0
        
        for issue in project.issues:
            type_key = issue.issue_type.value
            type_stats[type_key] = type_stats.get(type_key, 0) + 1
            
            sev_key = issue.severity.value
            severity_stats[sev_key] = severity_stats.get(sev_key, 0) + 1
            
            if issue.resolved:
                resolved_count += 1
        
        total_issues = len(project.issues)
        stats_text.append(f"  问题总数: {total_issues} 个")
        stats_text.append(f"  已解决: {resolved_count} 个")
        stats_text.append(f"  待处理: {total_issues - resolved_count} 个")
        stats_text.append("")
        
        stats_text.append("  按问题类型分布:")
        for issue_type, count in type_stats.items():
            percentage = (count / total_issues * 100) if total_issues > 0 else 0
            stats_text.append(f"    {issue_type}: {count} 个 ({percentage:.1f}%)")
        
        stats_text.append("")
        stats_text.append("  按严重程度分布:")
        for severity, count in severity_stats.items():
            percentage = (count / total_issues * 100) if total_issues > 0 else 0
            stats_text.append(f"    {severity}: {count} 个 ({percentage:.1f}%)")
        
        stats_text.append("")
        stats_text.append("-" * 50)
        stats_text.append("偏移信息")
        stats_text.append("-" * 50)
        stats_text.append(f"  全局偏移: {project.global_offset.total_seconds():+.3f} 秒")
        
        # 更新文本框
        self.stats_text.delete(1.0, tk.END)
        self.stats_text.insert(tk.END, "\n".join(stats_text))
    
    def _on_subtitle_select(self, event):
        """字幕选择事件"""
        selection = self.subtitle_tree.selection()
        if not selection:
            return
        
        item = selection[0]
        values = self.subtitle_tree.item(item, 'values')
        
        if values:
            index = int(values[0])
            self.selected_subtitle_index = index
            
            # 显示详情
            project = self.project_manager.current_project
            if project:
                sub = project.get_subtitle_by_index(index)
                if sub:
                    detail_lines = []
                    detail_lines.append(f"字幕 #{sub.index}")
                    detail_lines.append("-" * 40)
                    detail_lines.append(f"开始时间: {timedelta_to_srt_format(sub.start_time)}")
                    detail_lines.append(f"结束时间: {timedelta_to_srt_format(sub.end_time)}")
                    detail_lines.append(f"持续时间: {sub.duration.total_seconds():.3f} 秒")
                    detail_lines.append("")
                    detail_lines.append(f"原始开始: {timedelta_to_srt_format(sub.original_start_time) if sub.original_start_time else 'N/A'}")
                    detail_lines.append(f"原始结束: {timedelta_to_srt_format(sub.original_end_time) if sub.original_end_time else 'N/A'}")
                    detail_lines.append(f"已应用偏移: {sub.offset_applied.total_seconds():+.3f} 秒")
                    detail_lines.append("")
                    detail_lines.append(f"说话人: {sub.speaker if sub.speaker else '未标注'}")
                    detail_lines.append(f"音效字幕: {'是' if sub.sound_effect else '否'}")
                    detail_lines.append(f"字数: {sub.word_count} 字")
                    detail_lines.append(f"阅读速度: {sub.reading_speed:.1f} 字/秒")
                    detail_lines.append("")
                    detail_lines.append("字幕内容:")
                    detail_lines.append("-" * 40)
                    detail_lines.append(sub.text)
                    
                    self.detail_text.delete(1.0, tk.END)
                    self.detail_text.insert(tk.END, "\n".join(detail_lines))
    
    def _on_issue_select(self, event):
        """问题选择事件"""
        selection = self.issue_tree.selection()
        if not selection:
            return
        
        try:
            idx = int(selection[0])
            self.selected_issue_index = idx
            
            project = self.project_manager.current_project
            if project and 0 <= idx < len(project.issues):
                issue = project.issues[idx]
                
                detail_lines = []
                detail_lines.append(f"问题详情")
                detail_lines.append("-" * 40)
                detail_lines.append(f"问题类型: {issue.issue_type.value}")
                detail_lines.append(f"严重程度: {issue.severity.value}")
                detail_lines.append(f"状态: {'已解决' if issue.resolved else '待处理'}")
                detail_lines.append("")
                
                if issue.subtitle_index:
                    detail_lines.append(f"相关字幕: #{issue.subtitle_index}")
                
                if issue.start_time:
                    detail_lines.append(f"时间范围: {issue.start_time} - {issue.end_time or issue.start_time}")
                
                detail_lines.append("")
                detail_lines.append("问题描述:")
                detail_lines.append("-" * 40)
                detail_lines.append(issue.description)
                detail_lines.append("")
                
                if issue.suggested_fix:
                    detail_lines.append("建议修复:")
                    detail_lines.append("-" * 40)
                    detail_lines.append(issue.suggested_fix)
                
                if issue.resolution_note:
                    detail_lines.append("")
                    detail_lines.append("解决备注:")
                    detail_lines.append("-" * 40)
                    detail_lines.append(issue.resolution_note)
                
                self.detail_text.delete(1.0, tk.END)
                self.detail_text.insert(tk.END, "\n".join(detail_lines))
        except ValueError:
            pass
    
    def _on_issue_double_click(self, event):
        """问题双击事件 - 定位到相关字幕"""
        selection = self.issue_tree.selection()
        if not selection:
            return
        
        try:
            idx = int(selection[0])
            project = self.project_manager.current_project
            
            if project and 0 <= idx < len(project.issues):
                issue = project.issues[idx]
                
                if issue.subtitle_index:
                    # 在字幕列表中查找并选中
                    for item in self.subtitle_tree.get_children():
                        values = self.subtitle_tree.item(item, 'values')
                        if values and int(values[0]) == issue.subtitle_index:
                            self.subtitle_tree.selection_set(item)
                            self.subtitle_tree.see(item)
                            break
        except ValueError:
            pass
    
    def _mark_issue_resolved(self):
        """标记问题已解决"""
        if self.selected_issue_index is None:
            messagebox.showwarning("警告", "请先选择一个问题")
            return
        
        project = self.project_manager.current_project
        if project and 0 <= self.selected_issue_index < len(project.issues):
            issue = project.issues[self.selected_issue_index]
            issue.resolved = not issue.resolved
            
            if issue.resolved:
                issue.resolution_note = "手动标记为已解决"
                self._update_status("问题已标记为已解决")
            else:
                issue.resolution_note = ""
                self._update_status("问题已标记为待处理")
            
            self._refresh_issue_list()
            self._refresh_stats()
    
    def _edit_subtitle(self):
        """编辑字幕"""
        if self.selected_subtitle_index is None:
            messagebox.showwarning("警告", "请先选择一个字幕")
            return
        
        # 简单的编辑对话框
        project = self.project_manager.current_project
        if project:
            sub = project.get_subtitle_by_index(self.selected_subtitle_index)
            if sub:
                # 创建编辑窗口
                edit_window = tk.Toplevel(self.root)
                edit_window.title(f"编辑字幕 #{sub.index}")
                edit_window.geometry("500x400")
                edit_window.transient(self.root)
                edit_window.grab_set()
                
                # 时间编辑
                time_frame = ttk.LabelFrame(edit_window, text="时间设置", padding=10)
                time_frame.pack(fill=tk.X, padx=10, pady=5)
                
                ttk.Label(time_frame, text="开始时间:").grid(row=0, column=0, sticky=tk.W, padx=5)
                start_var = tk.StringVar(value=timedelta_to_srt_format(sub.start_time))
                ttk.Entry(time_frame, textvariable=start_var, width=15).grid(row=0, column=1, padx=5)
                
                ttk.Label(time_frame, text="结束时间:").grid(row=0, column=2, sticky=tk.W, padx=5)
                end_var = tk.StringVar(value=timedelta_to_srt_format(sub.end_time))
                ttk.Entry(time_frame, textvariable=end_var, width=15).grid(row=0, column=3, padx=5)
                
                # 文本编辑
                text_frame = ttk.LabelFrame(edit_window, text="字幕内容", padding=10)
                text_frame.pack(fill=tk.BOTH, expand=True, padx=10, pady=5)
                
                text_widget = scrolledtext.ScrolledText(text_frame, wrap=tk.WORD, height=10)
                text_widget.pack(fill=tk.BOTH, expand=True)
                text_widget.insert(tk.END, sub.text)
                
                # 按钮
                btn_frame = ttk.Frame(edit_window)
                btn_frame.pack(fill=tk.X, padx=10, pady=10)
                
                def save_changes():
                    try:
                        from src.models.models import parse_srt_time
                        sub.start_time = parse_srt_time(start_var.get())
                        sub.end_time = parse_srt_time(end_var.get())
                        sub.text = text_widget.get(1.0, tk.END).strip()
                        
                        self._refresh_subtitle_list()
                        edit_window.destroy()
                        self._update_status(f"字幕 #{sub.index} 已更新")
                    except Exception as e:
                        messagebox.showerror("错误", f"保存失败: {e}")
                
                ttk.Button(btn_frame, text="保存", command=save_changes).pack(side=tk.RIGHT, padx=5)
                ttk.Button(btn_frame, text="取消", command=edit_window.destroy).pack(side=tk.RIGHT, padx=5)
    
    def _apply_suggested_offset(self):
        """应用建议的偏移"""
        if self.selected_issue_index is None:
            messagebox.showwarning("警告", "请先选择一个问题")
            return
        
        if not self.offset_manager:
            messagebox.showwarning("警告", "偏移管理器未初始化")
            return
        
        project = self.project_manager.current_project
        if project and 0 <= self.selected_issue_index < len(project.issues):
            from src.offset.offset_calculator import OffsetCalculator
            
            issue = project.issues[self.selected_issue_index]
            suggested = OffsetCalculator.suggest_offset_by_issue(issue)
            
            if suggested and issue.subtitle_index:
                result = self.offset_manager.apply_single_offset(
                    issue.subtitle_index,
                    suggested
                )
                
                if result['success']:
                    self._refresh_subtitle_list()
                    self._update_status(result['message'])
                else:
                    messagebox.showerror("错误", result['message'])
            else:
                messagebox.showinfo("提示", "此问题没有建议的偏移量")
    
    def _apply_global_offset(self):
        """应用全局偏移"""
        try:
            offset_seconds = float(self.global_offset_var.get())
            offset = timedelta(seconds=offset_seconds)
            
            if self.offset_manager:
                result = self.offset_manager.apply_global_offset(offset)
                
                if result['success']:
                    self._refresh_subtitle_list()
                    self._update_status(result['message'])
                else:
                    if result.get('warnings'):
                        if messagebox.askyesno("警告", "\n".join(result['warnings']) + "\n\n是否继续？"):
                            result = self.offset_manager.apply_global_offset(offset, validate=False)
                            if result['success']:
                                self._refresh_subtitle_list()
                                self._update_status(result['message'])
                    else:
                        messagebox.showerror("错误", result['message'])
        except ValueError:
            messagebox.showerror("错误", "请输入有效的数字")
    
    def _quick_offset(self, seconds: float):
        """快速调整偏移"""
        self.global_offset_var.set(f"{seconds:.3f}")
        self._apply_global_offset()
    
    def _apply_batch_offset(self):
        """应用批量偏移"""
        try:
            start = int(self.batch_start_var.get())
            end = int(self.batch_end_var.get())
            offset_seconds = float(self.batch_offset_var.get())
            offset = timedelta(seconds=offset_seconds)
            
            if self.offset_manager:
                result = self.offset_manager.apply_batch_offset(start, end, offset)
                
                if result['success']:
                    self._refresh_subtitle_list()
                    self._update_status(result['message'])
                else:
                    messagebox.showerror("错误", result['message'])
        except ValueError:
            messagebox.showerror("错误", "请输入有效的数字")
    
    def _get_smart_suggestions(self):
        """获取智能偏移建议"""
        if not self.offset_manager:
            messagebox.showwarning("警告", "请先导入数据")
            return
        
        result = self.offset_manager.suggest_auto_offset()
        
        self.suggestions_text.delete(1.0, tk.END)
        
        if result['count'] == 0:
            self.suggestions_text.insert(tk.END, "没有找到智能建议。\n\n提示：\n1. 导入视频时间码可以获取时间对齐建议\n2. 导入观众反馈可以获取基于反馈的建议\n3. 运行分析后可以获取基于问题的建议")
        else:
            lines = [f"找到 {result['count']} 个建议:\n", "=" * 50, ""]
            
            for idx, suggestion in enumerate(result['suggestions'], 1):
                lines.append(f"建议 {idx}:")
                lines.append(f"  来源: {suggestion['source']}")
                lines.append(f"  描述: {suggestion['description']}")
                
                if 'offset' in suggestion:
                    offset_sec = suggestion['offset'].total_seconds()
                    lines.append(f"  建议偏移: {offset_sec:+.3f} 秒")
                
                lines.append("")
            
            self.suggestions_text.insert(tk.END, "\n".join(lines))
    
    def _show_help(self):
        """显示帮助"""
        help_text = """
字幕无障碍校准台 - 使用说明
================================

一、基本流程
------------
1. 新建项目或打开现有项目
2. 导入数据：
   - SRT 字幕文件
   - 视频时间码 CSV（可选）
   - 环境音标注 JSON（可选）
   - 观众反馈记录 CSV（可选）
3. 点击「运行分析」检测问题
4. 逐条复核问题，应用偏移调整
5. 导出修订后的 SRT、报告和问题清单

二、主要功能
------------
1. 自动检查：
   - 字幕延迟/过早
   - 说话人漏标
   - 音效提示缺失
   - 阅读速度过快
   - 时间轴重叠

2. 偏移调整：
   - 全局偏移：调整所有字幕
   - 批量偏移：调整指定范围
   - 单条偏移：调整单个字幕
   - 智能建议：基于数据自动建议

3. 导出功能：
   - 修订后的 SRT 字幕
   - Markdown 格式校准报告
   - CSV 格式问题清单

三、快捷键
----------
Ctrl+N  新建项目
Ctrl+O  打开项目
Ctrl+S  保存项目
F5      运行分析

四、数据格式说明
----------------
1. SRT 字幕：标准 SRT 格式
2. 时间码 CSV：包含 timecode, description, scene_type 列
3. 音频标注 JSON：包含 annotations 数组
4. 反馈记录 CSV：包含 timestamp, issue_type, description 等列
"""
        messagebox.showinfo("使用说明", help_text.strip())
    
    def _show_about(self):
        """显示关于"""
        about_text = """
字幕无障碍校准台
版本: 1.0.0

为社区无障碍影院设计的字幕校准工具。

功能特点：
- 自动检测字幕延迟、说话人漏标等问题
- 支持全局/批量/单条时间偏移调整
- 导出校准报告和问题清单
- 基于视频时间码和观众反馈的智能建议

致力于为听障观众提供更好的观影体验。
"""
        messagebox.showinfo("关于", about_text.strip())


def main():
    """主函数"""
    root = tk.Tk()
    
    # 设置主题
    try:
        style = ttk.Style()
        style.theme_use('clam')
    except:
        pass
    
    app = SubtitleCalibrationApp(root)
    root.mainloop()


if __name__ == '__main__':
    main()
