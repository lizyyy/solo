# GUI 视图模块
# 使用 tkinter 实现桌面应用界面

import tkinter as tk
from tkinter import ttk, messagebox, filedialog, scrolledtext
from pathlib import Path
from datetime import datetime
from typing import Optional, List, Dict, Any, Callable
from functools import partial

from .models import (
    ProjectState,
    SubtitleEntry,
    Speaker,
    SensitiveWord,
    RiskMarker,
    RiskFragment,
    RiskLevel,
    RiskType,
    SpeakerPermission,
    ReviewStatus
)
from .parser import Parser, SRTParseError, CSVParseError
from .rules import RuleEngine, RiskReviewer
from .storage import ProjectStorage
from .import_export import ImportExport


class GUIConstants:
    """GUI 常量"""
    
    # 颜色配置
    COLORS = {
        'bg_main': '#f5f5f5',
        'bg_panel': '#ffffff',
        'bg_header': '#2c3e50',
        'bg_highlight': '#e3f2fd',
        'bg_selected': '#2196f3',
        'text_primary': '#212121',
        'text_secondary': '#757575',
        'text_light': '#ffffff',
        'border': '#e0e0e0',
        'risk_critical': '#d32f2f',
        'risk_high': '#f57c00',
        'risk_medium': '#fbc02d',
        'risk_low': '#388e3c',
        'status_approved': '#4caf50',
        'status_rejected': '#f44336',
        'status_modified': '#2196f3',
        'status_pending': '#9e9e9e',
    }
    
    # 风险等级颜色映射
    RISK_LEVEL_COLORS = {
        RiskLevel.CRITICAL: COLORS['risk_critical'],
        RiskLevel.HIGH: COLORS['risk_high'],
        RiskLevel.MEDIUM: COLORS['risk_medium'],
        RiskLevel.LOW: COLORS['risk_low'],
    }
    
    # 复核状态颜色映射
    STATUS_COLORS = {
        ReviewStatus.APPROVED: COLORS['status_approved'],
        ReviewStatus.REJECTED: COLORS['status_rejected'],
        ReviewStatus.MODIFIED: COLORS['status_modified'],
        ReviewStatus.PENDING: COLORS['status_pending'],
    }
    
    # 字体配置
    FONTS = {
        'title': ('Microsoft YaHei UI', 16, 'bold'),
        'header': ('Microsoft YaHei UI', 12, 'bold'),
        'normal': ('Microsoft YaHei UI', 10),
        'small': ('Microsoft YaHei UI', 9),
        'mono': ('Consolas', 10),
    }


class CallbackManager:
    """回调管理器"""
    
    def __init__(self):
        self._callbacks: Dict[str, List[Callable]] = {}
    
    def register(self, event: str, callback: Callable):
        """注册回调"""
        if event not in self._callbacks:
            self._callbacks[event] = []
        self._callbacks[event].append(callback)
    
    def unregister(self, event: str, callback: Callable):
        """注销回调"""
        if event in self._callbacks and callback in self._callbacks[event]:
            self._callbacks[event].remove(callback)
    
    def trigger(self, event: str, *args, **kwargs):
        """触发事件"""
        if event in self._callbacks:
            for callback in self._callbacks[event]:
                try:
                    callback(*args, **kwargs)
                except Exception as e:
                    print(f"Callback error for {event}: {e}")


class ApplicationState:
    """应用程序状态"""
    
    def __init__(self):
        self.project_state: Optional[ProjectState] = None
        self.project_storage: Optional[ProjectStorage] = None
        self.current_marker: Optional[RiskMarker] = None
        self.current_fragment: Optional[RiskFragment] = None
        self.selected_subtitle_ids: List[int] = []
        self.unsaved_changes: bool = False
        self.callbacks = CallbackManager()


class MainWindow:
    """主窗口"""
    
    def __init__(self, root: tk.Tk):
        self.root = root
        self.app_state = ApplicationState()
        
        self._setup_window()
        self._create_menu_bar()
        self._create_toolbar()
        self._create_main_layout()
        self._bind_events()
    
    def _setup_window(self):
        """设置窗口"""
        self.root.title("采访素材脱敏剪辑台")
        self.root.geometry("1400x900")
        self.root.minsize(1000, 700)
        self.root.configure(bg=GUIConstants.COLORS['bg_main'])
        
        # 设置图标（如果有）
        try:
            # 可以在这里设置自定义图标
            pass
        except:
            pass
    
    def _create_menu_bar(self):
        """创建菜单栏"""
        menubar = tk.Menu(self.root)
        self.root.config(menu=menubar)
        
        # 文件菜单
        file_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="文件", menu=file_menu)
        
        file_menu.add_command(label="新建项目", command=self._new_project)
        file_menu.add_command(label="打开项目", command=self._open_project)
        file_menu.add_separator()
        file_menu.add_command(label="保存项目", command=self._save_project, accelerator="Ctrl+S")
        file_menu.add_command(label="另存为...", command=self._save_project_as)
        file_menu.add_separator()
        file_menu.add_command(label="导入 SRT 字幕", command=self._import_srt)
        file_menu.add_command(label="导入说话人名单", command=self._import_speakers)
        file_menu.add_command(label="导入敏感词表", command=self._import_sensitive_words)
        file_menu.add_command(label="导入片段备注", command=self._import_notes)
        file_menu.add_separator()
        file_menu.add_command(label="导出全部", command=self._export_all)
        file_menu.add_command(label="导出脱敏 SRT", command=self._export_srt)
        file_menu.add_command(label="导出决策清单", command=self._export_decisions)
        file_menu.add_command(label="导出审核报告", command=self._export_report)
        file_menu.add_separator()
        file_menu.add_command(label="退出", command=self.root.quit)
        
        # 编辑菜单
        edit_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="编辑", menu=edit_menu)
        
        edit_menu.add_command(label="撤销", command=self._undo)
        edit_menu.add_command(label="重做", command=self._redo)
        edit_menu.add_separator()
        edit_menu.add_command(label="重新分析", command=self._reanalyze)
        edit_menu.add_command(label="合并选中片段", command=self._merge_selected)
        
        # 视图菜单
        view_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="视图", menu=view_menu)
        
        view_menu.add_command(label="显示统计面板", command=self._toggle_stats)
        view_menu.add_command(label="显示字幕列表", command=self._toggle_subtitles)
        
        # 帮助菜单
        help_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="帮助", menu=help_menu)
        
        help_menu.add_command(label="关于", command=self._show_about)
    
    def _create_toolbar(self):
        """创建工具栏"""
        toolbar = tk.Frame(self.root, bg=GUIConstants.COLORS['bg_header'], height=50)
        toolbar.pack(side=tk.TOP, fill=tk.X)
        toolbar.pack_propagate(False)
        
        # 工具按钮
        buttons = [
            ("新建", self._new_project),
            ("打开", self._open_project),
            ("保存", self._save_project),
            ("-", None),
            ("导入字幕", self._import_srt),
            ("导入数据", self._import_all),
            ("分析", self._reanalyze),
            ("-", None),
            ("合并片段", self._merge_selected),
            ("导出", self._export_all),
        ]
        
        for text, command in buttons:
            if text == "-":
                sep = tk.Frame(toolbar, width=2, bg='#1a252f')
                sep.pack(side=tk.LEFT, padx=10, fill=tk.Y)
            else:
                btn = tk.Button(
                    toolbar,
                    text=text,
                    command=command,
                    font=GUIConstants.FONTS['small'],
                    bg=GUIConstants.COLORS['bg_header'],
                    fg=GUIConstants.COLORS['text_light'],
                    activebackground='#34495e',
                    activeforeground=GUIConstants.COLORS['text_light'],
                    relief=tk.FLAT,
                    padx=10,
                    pady=5
                )
                btn.pack(side=tk.LEFT, padx=2)
        
        # 状态标签
        self.status_label = tk.Label(
            toolbar,
            text="未打开项目",
            font=GUIConstants.FONTS['small'],
            bg=GUIConstants.COLORS['bg_header'],
            fg=GUIConstants.COLORS['text_light'],
            anchor=tk.E
        )
        self.status_label.pack(side=tk.RIGHT, padx=20, fill=tk.Y)
    
    def _create_main_layout(self):
        """创建主布局"""
        # 主内容区
        main_frame = tk.Frame(self.root, bg=GUIConstants.COLORS['bg_main'])
        main_frame.pack(side=tk.TOP, fill=tk.BOTH, expand=True, padx=5, pady=5)
        
        # 左侧面板：字幕列表
        left_panel = tk.Frame(main_frame, bg=GUIConstants.COLORS['bg_panel'], width=300)
        left_panel.pack(side=tk.LEFT, fill=tk.BOTH, expand=False)
        left_panel.pack_propagate(False)
        
        # 左侧面板标题
        left_header = tk.Frame(left_panel, bg=GUIConstants.COLORS['bg_header'], height=35)
        left_header.pack(side=tk.TOP, fill=tk.X)
        left_header.pack_propagate(False)
        
        tk.Label(
            left_header,
            text="字幕列表",
            font=GUIConstants.FONTS['small'],
            bg=GUIConstants.COLORS['bg_header'],
            fg=GUIConstants.COLORS['text_light']
        ).pack(side=tk.LEFT, padx=10)
        
        # 搜索框
        search_frame = tk.Frame(left_panel, bg=GUIConstants.COLORS['bg_panel'])
        search_frame.pack(side=tk.TOP, fill=tk.X, padx=5, pady=5)
        
        tk.Label(search_frame, text="搜索:", font=GUIConstants.FONTS['small']).pack(side=tk.LEFT)
        self.search_var = tk.StringVar()
        self.search_var.trace('w', self._on_search)
        search_entry = tk.Entry(search_frame, textvariable=self.search_var, font=GUIConstants.FONTS['small'])
        search_entry.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=5)
        
        # 字幕列表
        list_frame = tk.Frame(left_panel, bg=GUIConstants.COLORS['bg_panel'])
        list_frame.pack(side=tk.TOP, fill=tk.BOTH, expand=True)
        
        # 创建 Treeview
        columns = ('id', 'time', 'speaker', 'risk')
        self.subtitle_tree = ttk.Treeview(
            list_frame,
            columns=columns,
            show='headings',
            selectmode=tk.EXTENDED
        )
        
        # 配置列
        self.subtitle_tree.heading('id', text='序号')
        self.subtitle_tree.heading('time', text='时间')
        self.subtitle_tree.heading('speaker', text='说话人')
        self.subtitle_tree.heading('risk', text='风险')
        
        self.subtitle_tree.column('id', width=50, anchor=tk.CENTER)
        self.subtitle_tree.column('time', width=120, anchor=tk.CENTER)
        self.subtitle_tree.column('speaker', width=80, anchor=tk.W)
        self.subtitle_tree.column('risk', width=40, anchor=tk.CENTER)
        
        # 滚动条
        scrollbar_y = ttk.Scrollbar(list_frame, orient=tk.VERTICAL, command=self.subtitle_tree.yview)
        scrollbar_x = ttk.Scrollbar(list_frame, orient=tk.HORIZONTAL, command=self.subtitle_tree.xview)
        
        self.subtitle_tree.configure(yscrollcommand=scrollbar_y.set, xscrollcommand=scrollbar_x.set)
        
        self.subtitle_tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scrollbar_y.pack(side=tk.RIGHT, fill=tk.Y)
        
        # 中间面板：风险片段
        middle_panel = tk.Frame(main_frame, bg=GUIConstants.COLORS['bg_panel'], width=350)
        middle_panel.pack(side=tk.LEFT, fill=tk.BOTH, expand=False, padx=5)
        middle_panel.pack_propagate(False)
        
        # 中间面板标题
        middle_header = tk.Frame(middle_panel, bg=GUIConstants.COLORS['bg_header'], height=35)
        middle_header.pack(side=tk.TOP, fill=tk.X)
        middle_header.pack_propagate(False)
        
        tk.Label(
            middle_header,
            text="风险片段",
            font=GUIConstants.FONTS['small'],
            bg=GUIConstants.COLORS['bg_header'],
            fg=GUIConstants.COLORS['text_light']
        ).pack(side=tk.LEFT, padx=10)
        
        # 统计标签
        self.risk_stats_label = tk.Label(
            middle_header,
            text="",
            font=GUIConstants.FONTS['small'],
            bg=GUIConstants.COLORS['bg_header'],
            fg=GUIConstants.COLORS['text_light']
        )
        self.risk_stats_label.pack(side=tk.RIGHT, padx=10)
        
        # 风险片段列表
        fragment_frame = tk.Frame(middle_panel, bg=GUIConstants.COLORS['bg_panel'])
        fragment_frame.pack(side=tk.TOP, fill=tk.BOTH, expand=True)
        
        # 创建 Treeview
        frag_columns = ('id', 'time', 'level', 'status', 'markers')
        self.fragment_tree = ttk.Treeview(
            fragment_frame,
            columns=frag_columns,
            show='headings',
            selectmode=tk.EXTENDED
        )
        
        self.fragment_tree.heading('id', text='片段')
        self.fragment_tree.heading('time', text='时间范围')
        self.fragment_tree.heading('level', text='等级')
        self.fragment_tree.heading('status', text='状态')
        self.fragment_tree.heading('markers', text='标记数')
        
        self.fragment_tree.column('id', width=50, anchor=tk.CENTER)
        self.fragment_tree.column('time', width=140, anchor=tk.W)
        self.fragment_tree.column('level', width=60, anchor=tk.CENTER)
        self.fragment_tree.column('status', width=60, anchor=tk.CENTER)
        self.fragment_tree.column('markers', width=50, anchor=tk.CENTER)
        
        frag_scrollbar = ttk.Scrollbar(fragment_frame, orient=tk.VERTICAL, command=self.fragment_tree.yview)
        self.fragment_tree.configure(yscrollcommand=frag_scrollbar.set)
        
        self.fragment_tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        frag_scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
        
        # 右侧面板：详情和操作
        right_panel = tk.Frame(main_frame, bg=GUIConstants.COLORS['bg_panel'])
        right_panel.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        
        # 右侧面板标题
        right_header = tk.Frame(right_panel, bg=GUIConstants.COLORS['bg_header'], height=35)
        right_header.pack(side=tk.TOP, fill=tk.X)
        right_header.pack_propagate(False)
        
        self.detail_title = tk.Label(
            right_header,
            text="详情面板",
            font=GUIConstants.FONTS['small'],
            bg=GUIConstants.COLORS['bg_header'],
            fg=GUIConstants.COLORS['text_light']
        )
        self.detail_title.pack(side=tk.LEFT, padx=10)
        
        # 详情内容区
        detail_frame = tk.Frame(right_panel, bg=GUIConstants.COLORS['bg_panel'])
        detail_frame.pack(side=tk.TOP, fill=tk.BOTH, expand=True)
        
        # 上半部分：原始内容预览
        preview_frame = tk.LabelFrame(detail_frame, text="原始内容", font=GUIConstants.FONTS['small'])
        preview_frame.pack(side=tk.TOP, fill=tk.BOTH, expand=True, padx=10, pady=5)
        
        self.preview_text = scrolledtext.ScrolledText(
            preview_frame,
            font=GUIConstants.FONTS['mono'],
            wrap=tk.WORD,
            height=10
        )
        self.preview_text.pack(side=tk.TOP, fill=tk.BOTH, expand=True, padx=5, pady=5)
        self.preview_text.config(state=tk.DISABLED)
        
        # 中间部分：风险标记列表
        markers_frame = tk.LabelFrame(detail_frame, text="风险标记", font=GUIConstants.FONTS['small'])
        markers_frame.pack(side=tk.TOP, fill=tk.BOTH, expand=True, padx=10, pady=5)
        
        # 风险标记表格
        marker_columns = ('text', 'type', 'level', 'suggested', 'status')
        self.marker_tree = ttk.Treeview(
            markers_frame,
            columns=marker_columns,
            show='headings',
            selectmode=tk.SINGLE,
            height=5
        )
        
        self.marker_tree.heading('text', text='风险文本')
        self.marker_tree.heading('type', text='类型')
        self.marker_tree.heading('level', text='等级')
        self.marker_tree.heading('suggested', text='建议替换')
        self.marker_tree.heading('status', text='状态')
        
        self.marker_tree.column('text', width=150, anchor=tk.W)
        self.marker_tree.column('type', width=80, anchor=tk.CENTER)
        self.marker_tree.column('level', width=60, anchor=tk.CENTER)
        self.marker_tree.column('suggested', width=100, anchor=tk.W)
        self.marker_tree.column('status', width=60, anchor=tk.CENTER)
        
        marker_scrollbar = ttk.Scrollbar(markers_frame, orient=tk.VERTICAL, command=self.marker_tree.yview)
        self.marker_tree.configure(yscrollcommand=marker_scrollbar.set)
        
        self.marker_tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        marker_scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
        
        # 下半部分：操作面板
        action_frame = tk.LabelFrame(detail_frame, text="操作", font=GUIConstants.FONTS['small'])
        action_frame.pack(side=tk.TOP, fill=tk.X, padx=10, pady=5)
        
        # 替换文本输入
        replace_frame = tk.Frame(action_frame, bg=GUIConstants.COLORS['bg_panel'])
        replace_frame.pack(side=tk.TOP, fill=tk.X, padx=5, pady=5)
        
        tk.Label(replace_frame, text="替换文本:", font=GUIConstants.FONTS['small']).pack(side=tk.LEFT)
        self.replace_var = tk.StringVar()
        self.replace_entry = tk.Entry(replace_frame, textvariable=self.replace_var, font=GUIConstants.FONTS['normal'])
        self.replace_entry.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=5)
        
        # 备注输入
        note_frame = tk.Frame(action_frame, bg=GUIConstants.COLORS['bg_panel'])
        note_frame.pack(side=tk.TOP, fill=tk.X, padx=5, pady=5)
        
        tk.Label(note_frame, text="备注:", font=GUIConstants.FONTS['small']).pack(side=tk.LEFT)
        self.note_var = tk.StringVar()
        self.note_entry = tk.Entry(note_frame, textvariable=self.note_var, font=GUIConstants.FONTS['normal'])
        self.note_entry.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=5)
        
        # 操作按钮
        btn_frame = tk.Frame(action_frame, bg=GUIConstants.COLORS['bg_panel'])
        btn_frame.pack(side=tk.TOP, fill=tk.X, padx=5, pady=10)
        
        btn_style = {
            'font': GUIConstants.FONTS['small'],
            'padx': 15,
            'pady': 5,
        }
        
        tk.Button(
            btn_frame,
            text="✅ 批准",
            command=self._approve_current,
            bg=GUIConstants.COLORS['status_approved'],
            fg='white',
            **btn_style
        ).pack(side=tk.LEFT, padx=5)
        
        tk.Button(
            btn_frame,
            text="🔄 自定义替换",
            command=self._modify_current,
            bg=GUIConstants.COLORS['status_modified'],
            fg='white',
            **btn_style
        ).pack(side=tk.LEFT, padx=5)
        
        tk.Button(
            btn_frame,
            text="❌ 驳回",
            command=self._reject_current,
            bg=GUIConstants.COLORS['status_rejected'],
            fg='white',
            **btn_style
        ).pack(side=tk.LEFT, padx=5)
        
        tk.Button(
            btn_frame,
            text="⏭️ 下一个",
            command=self._next_marker,
            bg='#607d8b',
            fg='white',
            **btn_style
        ).pack(side=tk.LEFT, padx=5)
        
        # 底部状态栏
        self.bottom_status = tk.Label(
            self.root,
            text="就绪",
            font=GUIConstants.FONTS['small'],
            bg=GUIConstants.COLORS['bg_header'],
            fg=GUIConstants.COLORS['text_light'],
            anchor=tk.W,
            padx=10
        )
        self.bottom_status.pack(side=tk.BOTTOM, fill=tk.X)
    
    def _bind_events(self):
        """绑定事件"""
        self.subtitle_tree.bind('<<TreeviewSelect>>', self._on_subtitle_select)
        self.fragment_tree.bind('<<TreeviewSelect>>', self._on_fragment_select)
        self.marker_tree.bind('<<TreeviewSelect>>', self._on_marker_select)
        
        # 键盘快捷键
        self.root.bind('<Control-s>', lambda e: self._save_project())
        self.root.bind('<Control-o>', lambda e: self._open_project())
        self.root.bind('<Control-n>', lambda e: self._new_project())
        self.root.bind('<F5>', lambda e: self._reanalyze())
    
    def _update_status(self, text: str):
        """更新状态栏"""
        self.bottom_status.config(text=text)
        self.root.update_idletasks()
    
    # ========== 文件操作 ==========
    
    def _new_project(self):
        """新建项目"""
        # 询问项目名称
        name_window = tk.Toplevel(self.root)
        name_window.title("新建项目")
        name_window.geometry("400x150")
        name_window.transient(self.root)
        name_window.grab_set()
        
        tk.Label(name_window, text="项目名称:", font=GUIConstants.FONTS['normal']).pack(pady=10)
        name_var = tk.StringVar(value="未命名项目")
        name_entry = tk.Entry(name_window, textvariable=name_var, font=GUIConstants.FONTS['normal'], width=40)
        name_entry.pack(pady=5)
        name_entry.select_range(0, tk.END)
        name_entry.focus_set()
        
        def do_create():
            project_name = name_var.get().strip()
            if not project_name:
                messagebox.showwarning("警告", "请输入项目名称")
                return
            
            # 选择保存目录
            project_dir = filedialog.askdirectory(title="选择项目保存位置")
            if not project_dir:
                return
            
            try:
                self._update_status("正在创建项目...")
                storage = ProjectStorage()
                self.app_state.project_state = storage.create_new_project(project_name, project_dir)
                self.app_state.project_storage = storage
                self.app_state.unsaved_changes = False
                
                self._refresh_all()
                self._update_status(f"项目已创建: {project_name}")
                
                name_window.destroy()
            except Exception as e:
                messagebox.showerror("错误", f"创建项目失败: {str(e)}")
        
        btn_frame = tk.Frame(name_window)
        btn_frame.pack(pady=20)
        tk.Button(btn_frame, text="创建", command=do_create, width=10).pack(side=tk.LEFT, padx=10)
        tk.Button(btn_frame, text="取消", command=name_window.destroy, width=10).pack(side=tk.LEFT, padx=10)
    
    def _open_project(self):
        """打开项目"""
        project_dir = filedialog.askdirectory(title="选择项目目录")
        if not project_dir:
            return
        
        try:
            self._update_status("正在打开项目...")
            storage = ProjectStorage(project_dir)
            self.app_state.project_state = storage.load_project()
            self.app_state.project_storage = storage
            self.app_state.unsaved_changes = False
            
            self._refresh_all()
            self._update_status(f"项目已打开: {self.app_state.project_state.project_name}")
        except FileNotFoundError:
            messagebox.showerror("错误", "不是有效的项目目录")
        except Exception as e:
            messagebox.showerror("错误", f"打开项目失败: {str(e)}")
    
    def _save_project(self):
        """保存项目"""
        if not self.app_state.project_storage or not self.app_state.project_state:
            self._save_project_as()
            return
        
        try:
            self._update_status("正在保存项目...")
            self.app_state.project_storage.save_project(
                self.app_state.project_state,
                create_version=True,
                description="手动保存"
            )
            self.app_state.unsaved_changes = False
            self._update_status("项目已保存")
        except Exception as e:
            messagebox.showerror("错误", f"保存失败: {str(e)}")
    
    def _save_project_as(self):
        """另存为"""
        if not self.app_state.project_state:
            messagebox.showwarning("警告", "没有可保存的项目")
            return
        
        project_dir = filedialog.askdirectory(title="选择保存位置")
        if not project_dir:
            return
        
        try:
            self._update_status("正在保存项目...")
            storage = ProjectStorage()
            storage.set_project_path(str(Path(project_dir) / self.app_state.project_state.project_name))
            storage.save_project(
                self.app_state.project_state,
                create_version=True,
                description="另存为"
            )
            self.app_state.project_storage = storage
            self.app_state.unsaved_changes = False
            self._update_status("项目已保存")
        except Exception as e:
            messagebox.showerror("错误", f"保存失败: {str(e)}")
    
    # ========== 导入操作 ==========
    
    def _import_srt(self):
        """导入 SRT 字幕"""
        if not self.app_state.project_state:
            messagebox.showwarning("警告", "请先创建或打开项目")
            return
        
        file_path = filedialog.askopenfilename(
            title="选择 SRT 文件",
            filetypes=[("SRT 文件", "*.srt"), ("所有文件", "*.*")]
        )
        if not file_path:
            return
        
        try:
            self._update_status("正在解析字幕...")
            subtitles = Parser.parse_srt(file_path)
            
            self.app_state.project_state.subtitles = subtitles
            self.app_state.unsaved_changes = True
            
            # 自动分析（如果已有敏感词和说话人数据）
            if self.app_state.project_state.sensitive_words:
                self._do_analysis()
            
            self._refresh_all()
            self._update_status(f"已导入 {len(subtitles)} 条字幕")
        except SRTParseError as e:
            messagebox.showerror("解析错误", str(e))
        except Exception as e:
            messagebox.showerror("错误", f"导入失败: {str(e)}")
    
    def _import_speakers(self):
        """导入说话人名单"""
        if not self.app_state.project_state:
            messagebox.showwarning("警告", "请先创建或打开项目")
            return
        
        file_path = filedialog.askopenfilename(
            title="选择说话人名单 CSV",
            filetypes=[("CSV 文件", "*.csv"), ("所有文件", "*.*")]
        )
        if not file_path:
            return
        
        try:
            self._update_status("正在解析说话人名单...")
            speakers = Parser.parse_speakers(file_path)
            
            self.app_state.project_state.speakers = speakers
            self.app_state.unsaved_changes = True
            
            # 重新分析
            if self.app_state.project_state.subtitles:
                self._do_analysis()
            
            self._refresh_all()
            self._update_status(f"已导入 {len(speakers)} 位说话人")
        except CSVParseError as e:
            messagebox.showerror("解析错误", str(e))
        except Exception as e:
            messagebox.showerror("错误", f"导入失败: {str(e)}")
    
    def _import_sensitive_words(self):
        """导入敏感词表"""
        if not self.app_state.project_state:
            messagebox.showwarning("警告", "请先创建或打开项目")
            return
        
        file_path = filedialog.askopenfilename(
            title="选择敏感词表 CSV",
            filetypes=[("CSV 文件", "*.csv"), ("所有文件", "*.*")]
        )
        if not file_path:
            return
        
        try:
            self._update_status("正在解析敏感词表...")
            words = Parser.parse_sensitive_words(file_path)
            
            self.app_state.project_state.sensitive_words = words
            self.app_state.unsaved_changes = True
            
            # 重新分析
            if self.app_state.project_state.subtitles:
                self._do_analysis()
            
            self._refresh_all()
            self._update_status(f"已导入 {len(words)} 个敏感词规则")
        except CSVParseError as e:
            messagebox.showerror("解析错误", str(e))
        except Exception as e:
            messagebox.showerror("错误", f"导入失败: {str(e)}")
    
    def _import_notes(self):
        """导入片段备注"""
        if not self.app_state.project_state:
            messagebox.showwarning("警告", "请先创建或打开项目")
            return
        
        file_path = filedialog.askopenfilename(
            title="选择片段备注 CSV",
            filetypes=[("CSV 文件", "*.csv"), ("所有文件", "*.*")]
        )
        if not file_path:
            return
        
        try:
            self._update_status("正在解析片段备注...")
            notes = Parser.parse_notes(file_path)
            
            self.app_state.project_state.notes = notes
            self.app_state.unsaved_changes = True
            
            self._refresh_all()
            self._update_status(f"已导入 {len(notes)} 条备注")
        except CSVParseError as e:
            messagebox.showerror("解析错误", str(e))
        except Exception as e:
            messagebox.showerror("错误", f"导入失败: {str(e)}")
    
    def _import_all(self):
        """导入所有数据"""
        # 这个方法可以作为批量导入的快捷方式
        # 目前实现为依次导入
        self._import_srt()
    
    # ========== 分析操作 ==========
    
    def _reanalyze(self):
        """重新分析"""
        if not self.app_state.project_state:
            messagebox.showwarning("警告", "请先创建或打开项目")
            return
        
        if not self.app_state.project_state.subtitles:
            messagebox.showwarning("警告", "没有可分析的字幕")
            return
        
        self._do_analysis()
        self._refresh_all()
        self._update_status("分析完成")
    
    def _do_analysis(self):
        """执行分析"""
        state = self.app_state.project_state
        
        engine = RuleEngine(
            sensitive_words=state.sensitive_words,
            speakers=state.speakers
        )
        
        markers, fragments = engine.analyze(state.subtitles)
        
        state.risk_markers = markers
        state.risk_fragments = fragments
        self.app_state.unsaved_changes = True
    
    # ========== 导出操作 ==========
    
    def _export_all(self):
        """导出全部"""
        if not self.app_state.project_state:
            messagebox.showwarning("警告", "没有可导出的项目")
            return
        
        output_dir = filedialog.askdirectory(title="选择输出目录")
        if not output_dir:
            return
        
        try:
            self._update_status("正在导出...")
            
            base_name = self.app_state.project_state.project_name.replace(' ', '_')
            results = ImportExport.export_all(
                self.app_state.project_state,
                output_dir,
                base_name
            )
            
            result_text = "\n".join([f"- {k}: {v}" for k, v in results.items()])
            messagebox.showinfo("导出成功", f"已导出到:\n{output_dir}\n\n文件:\n{result_text}")
            self._update_status("导出完成")
        except Exception as e:
            messagebox.showerror("错误", f"导出失败: {str(e)}")
    
    def _export_srt(self):
        """导出脱敏 SRT"""
        if not self.app_state.project_state:
            messagebox.showwarning("警告", "没有可导出的项目")
            return
        
        file_path = filedialog.asksaveasfilename(
            title="保存脱敏 SRT",
            defaultextension=".srt",
            filetypes=[("SRT 文件", "*.srt")]
        )
        if not file_path:
            return
        
        try:
            self._update_status("正在导出 SRT...")
            ImportExport.srt_exporter.export_redacted(
                self.app_state.project_state.subtitles,
                self.app_state.project_state.risk_markers,
                file_path
            )
            messagebox.showinfo("导出成功", f"已保存到: {file_path}")
            self._update_status("SRT 导出完成")
        except Exception as e:
            messagebox.showerror("错误", f"导出失败: {str(e)}")
    
    def _export_decisions(self):
        """导出决策清单"""
        if not self.app_state.project_state:
            messagebox.showwarning("警告", "没有可导出的项目")
            return
        
        file_path = filedialog.asksaveasfilename(
            title="保存决策清单",
            defaultextension=".csv",
            filetypes=[("CSV 文件", "*.csv")]
        )
        if not file_path:
            return
        
        try:
            self._update_status("正在导出决策清单...")
            ImportExport.csv_exporter.export_decision_list(
                self.app_state.project_state.risk_markers,
                self.app_state.project_state.subtitles,
                file_path,
                include_all=True
            )
            messagebox.showinfo("导出成功", f"已保存到: {file_path}")
            self._update_status("决策清单导出完成")
        except Exception as e:
            messagebox.showerror("错误", f"导出失败: {str(e)}")
    
    def _export_report(self):
        """导出审核报告"""
        if not self.app_state.project_state:
            messagebox.showwarning("警告", "没有可导出的项目")
            return
        
        file_path = filedialog.asksaveasfilename(
            title="保存审核报告",
            defaultextension=".md",
            filetypes=[("Markdown 文件", "*.md"), ("所有文件", "*.*")]
        )
        if not file_path:
            return
        
        try:
            self._update_status("正在导出审核报告...")
            ImportExport.markdown_exporter.export_report(
                self.app_state.project_state,
                file_path
            )
            messagebox.showinfo("导出成功", f"已保存到: {file_path}")
            self._update_status("审核报告导出完成")
        except Exception as e:
            messagebox.showerror("错误", f"导出失败: {str(e)}")
    
    # ========== 版本操作 ==========
    
    def _undo(self):
        """撤销（恢复到上一版本）"""
        if not self.app_state.project_storage:
            return
        
        versions = self.app_state.project_storage.get_versions()
        if len(versions) < 2:
            messagebox.showinfo("提示", "没有可恢复的历史版本")
            return
        
        # 显示版本选择窗口
        version_window = tk.Toplevel(self.root)
        version_window.title("选择历史版本")
        version_window.geometry("500x400")
        version_window.transient(self.root)
        version_window.grab_set()
        
        # 版本列表
        frame = tk.Frame(version_window)
        frame.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)
        
        columns = ('time', 'desc')
        tree = ttk.Treeview(frame, columns=columns, show='headings', selectmode=tk.BROWSE)
        tree.heading('time', text='时间')
        tree.heading('desc', text='描述')
        tree.column('time', width=150)
        tree.column('desc', width=300)
        
        scrollbar = ttk.Scrollbar(frame, orient=tk.VERTICAL, command=tree.yview)
        tree.configure(yscrollcommand=scrollbar.set)
        
        tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
        
        # 填充版本列表（跳过当前版本）
        for i, version in enumerate(versions[1:], 1):  # 从第二个开始（第一个是当前版本）
            created_at = version['created_at']
            if isinstance(created_at, datetime):
                time_str = created_at.strftime('%Y-%m-%d %H:%M:%S')
            else:
                time_str = str(created_at)
            tree.insert('', tk.END, iid=str(i), values=(time_str, version['description']))
        
        def do_restore():
            selected = tree.selection()
            if not selected:
                messagebox.showwarning("警告", "请选择要恢复的版本")
                return
            
            idx = int(selected[0])
            version_id = versions[idx]['version_id']  # 因为跳过了第一个，所以 idx 直接对应
            
            if messagebox.askyesno("确认", "恢复到历史版本？当前未保存的更改将丢失。"):
                try:
                    self._update_status("正在恢复版本...")
                    restored = self.app_state.project_storage.restore_version(version_id)
                    if restored:
                        self.app_state.project_state = restored
                        self.app_state.unsaved_changes = False
                        self._refresh_all()
                        self._update_status(f"已恢复到版本: {version_id}")
                        version_window.destroy()
                except Exception as e:
                    messagebox.showerror("错误", f"恢复失败: {str(e)}")
        
        btn_frame = tk.Frame(version_window)
        btn_frame.pack(pady=10)
        tk.Button(btn_frame, text="恢复", command=do_restore, width=10).pack(side=tk.LEFT, padx=10)
        tk.Button(btn_frame, text="取消", command=version_window.destroy, width=10).pack(side=tk.LEFT, padx=10)
    
    def _redo(self):
        """重做（目前仅提示）"""
        messagebox.showinfo("提示", "重做功能通过版本历史实现，请使用\"文件 -> 撤销\"查看历史版本")
    
    # ========== 片段合并 ==========
    
    def _merge_selected(self):
        """合并选中的片段"""
        if not self.app_state.project_state:
            return
        
        selected = self.fragment_tree.selection()
        if len(selected) < 2:
            messagebox.showwarning("警告", "请选择至少两个片段进行合并")
            return
        
        # 获取选中的片段
        fragment_map = {f.id: f for f in self.app_state.project_state.risk_fragments}
        selected_fragments = []
        
        for item_id in selected:
            frag_id = self.fragment_tree.item(item_id, 'values')[0]
            if frag_id in fragment_map:
                selected_fragments.append(fragment_map[frag_id])
        
        if len(selected_fragments) < 2:
            messagebox.showwarning("警告", "无法获取选中的片段")
            return
        
        # 按时间排序
        selected_fragments.sort(key=lambda f: f.start_time)
        
        # 创建合并后的片段
        import uuid
        
        # 合并所有风险标记
        all_markers = []
        for frag in selected_fragments:
            all_markers.extend(frag.risk_markers)
        
        # 确定时间范围
        min_start = min(f.start_time for f in selected_fragments)
        max_end = max(f.end_time for f in selected_fragments)
        
        # 收集所有关联的字幕ID
        all_subtitle_ids = []
        for frag in selected_fragments:
            all_subtitle_ids.extend(frag.subtitle_ids)
        all_subtitle_ids = sorted(list(set(all_subtitle_ids)))
        
        # 创建新片段
        new_fragment = RiskFragment(
            id=f"rf_{str(uuid.uuid4())[:8]}",
            subtitle_ids=all_subtitle_ids,
            start_time=min_start,
            end_time=max_end,
            risk_markers=all_markers,
            review_status=ReviewStatus.PENDING,
            merged=True,
            merged_from=[f.id for f in selected_fragments]
        )
        
        # 从列表中移除旧片段，添加新片段
        state = self.app_state.project_state
        for frag in selected_fragments:
            if frag in state.risk_fragments:
                state.risk_fragments.remove(frag)
        state.risk_fragments.append(new_fragment)
        
        # 重新排序
        state.risk_fragments.sort(key=lambda f: f.start_time)
        
        self.app_state.unsaved_changes = True
        self._refresh_fragments()
        self._update_status(f"已合并 {len(selected_fragments)} 个片段")
    
    # ========== 复核操作 ==========
    
    def _approve_current(self):
        """批准当前选中的标记"""
        if not self.app_state.current_marker:
            # 尝试批准当前片段
            if self.app_state.current_fragment:
                RiskReviewer.approve_fragment(self.app_state.current_fragment, "用户")
                self.app_state.unsaved_changes = True
                self._refresh_all()
                self._update_status("已批准片段")
            return
        
        RiskReviewer.approve(
            self.app_state.current_marker,
            "用户",
            self.note_var.get()
        )
        self.app_state.unsaved_changes = True
        self._refresh_all()
        self._update_status("已批准")
    
    def _modify_current(self):
        """自定义替换当前标记"""
        if not self.app_state.current_marker:
            messagebox.showwarning("警告", "请先选择一个风险标记")
            return
        
        replacement = self.replace_var.get().strip()
        if not replacement:
            messagebox.showwarning("警告", "请输入替换文本")
            return
        
        RiskReviewer.modify(
            self.app_state.current_marker,
            replacement,
            "用户",
            self.note_var.get()
        )
        self.app_state.unsaved_changes = True
        self._refresh_all()
        self._update_status("已应用自定义替换")
    
    def _reject_current(self):
        """驳回当前标记"""
        if not self.app_state.current_marker:
            # 尝试驳回当前片段
            if self.app_state.current_fragment:
                RiskReviewer.reject_fragment(self.app_state.current_fragment, "用户", self.note_var.get())
                self.app_state.unsaved_changes = True
                self._refresh_all()
                self._update_status("已驳回片段")
            return
        
        RiskReviewer.reject(
            self.app_state.current_marker,
            "用户",
            self.note_var.get()
        )
        self.app_state.unsaved_changes = True
        self._refresh_all()
        self._update_status("已驳回")
    
    def _next_marker(self):
        """跳到下一个待复核标记"""
        if not self.app_state.project_state:
            return
        
        # 找到所有待复核的标记
        pending_markers = [
            m for m in self.app_state.project_state.risk_markers
            if m.review_status == ReviewStatus.PENDING
        ]
        
        if not pending_markers:
            messagebox.showinfo("提示", "所有标记均已复核完成")
            return
        
        # 选择第一个待复核标记
        self.app_state.current_marker = pending_markers[0]
        self._refresh_markers()
        self._update_preview()
        
        # 设置替换建议
        self.replace_var.set(self.app_state.current_marker.suggested_replacement)
        
        self._update_status(f"下一个待复核标记 (剩余 {len(pending_markers)} 个)")
    
    # ========== 事件处理 ==========
    
    def _on_search(self, *args):
        """搜索事件"""
        search_text = self.search_var.get().lower()
        self._refresh_subtitles(search_text)
    
    def _on_subtitle_select(self, event):
        """字幕选择事件"""
        if not self.app_state.project_state:
            return
        
        selected = self.subtitle_tree.selection()
        if not selected:
            return
        
        # 获取选中的字幕ID
        subtitle_ids = []
        for item_id in selected:
            values = self.subtitle_tree.item(item_id, 'values')
            if values:
                try:
                    subtitle_ids.append(int(values[0]))
                except ValueError:
                    pass
        
        self.app_state.selected_subtitle_ids = subtitle_ids
        
        # 显示第一个选中字幕的内容
        if subtitle_ids:
            subtitle_map = {s.id: s for s in self.app_state.project_state.subtitles}
            first_id = subtitle_ids[0]
            if first_id in subtitle_map:
                subtitle = subtitle_map[first_id]
                self._show_subtitle_preview(subtitle)
    
    def _on_fragment_select(self, event):
        """片段选择事件"""
        if not self.app_state.project_state:
            return
        
        selected = self.fragment_tree.selection()
        if not selected:
            self.app_state.current_fragment = None
            return
        
        # 获取选中的片段
        fragment_map = {f.id: f for f in self.app_state.project_state.risk_fragments}
        
        for item_id in selected:
            values = self.fragment_tree.item(item_id, 'values')
            if values:
                frag_id = values[0]
                if frag_id in fragment_map:
                    self.app_state.current_fragment = fragment_map[frag_id]
                    break
        
        if self.app_state.current_fragment:
            self._show_fragment_preview(self.app_state.current_fragment)
            self._refresh_markers()
    
    def _on_marker_select(self, event):
        """标记选择事件"""
        if not self.app_state.project_state:
            return
        
        selected = self.marker_tree.selection()
        if not selected:
            self.app_state.current_marker = None
            return
        
        # 从当前片段中找到对应的标记
        if self.app_state.current_fragment:
            marker_map = {m.id: m for m in self.app_state.current_fragment.risk_markers}
            
            for item_id in selected:
                values = self.marker_tree.item(item_id, 'values')
                if values:
                    # 查找标记（通过风险文本匹配）
                    risk_text = values[0]
                    for m in self.app_state.current_fragment.risk_markers:
                        if m.risk_text == risk_text:
                            self.app_state.current_marker = m
                            self.replace_var.set(m.suggested_replacement)
                            break
                    break
    
    # ========== UI 更新 ==========
    
    def _refresh_all(self):
        """刷新所有视图"""
        self._refresh_subtitles()
        self._refresh_fragments()
        self._update_title_status()
    
    def _refresh_subtitles(self, filter_text: str = ""):
        """刷新字幕列表"""
        # 清空
        for item in self.subtitle_tree.get_children():
            self.subtitle_tree.delete(item)
        
        if not self.app_state.project_state:
            return
        
        # 获取风险标记所在的字幕
        risky_subtitle_ids = set()
        for marker in self.app_state.project_state.risk_markers:
            risky_subtitle_ids.add(marker.subtitle_id)
        
        # 填充列表
        for subtitle in self.app_state.project_state.subtitles:
            # 过滤
            if filter_text:
                text_lower = subtitle.text.lower()
                if filter_text not in text_lower:
                    continue
            
            time_str = ImportExport.format_time(subtitle.start_time)
            
            # 检查是否有风险
            has_risk = subtitle.id in risky_subtitle_ids
            
            values = (
                subtitle.id,
                time_str,
                subtitle.speaker or "-",
                "⚠️" if has_risk else ""
            )
            
            item_id = self.subtitle_tree.insert('', tk.END, values=values)
            
            # 设置标签颜色
            if has_risk:
                self.subtitle_tree.tag_configure('has_risk', foreground=GUIConstants.COLORS['risk_high'])
                self.subtitle_tree.item(item_id, tags=('has_risk',))
    
    def _refresh_fragments(self):
        """刷新风险片段列表"""
        # 清空
        for item in self.fragment_tree.get_children():
            self.fragment_tree.delete(item)
        
        if not self.app_state.project_state:
            self.risk_stats_label.config(text="")
            return
        
        fragments = self.app_state.project_state.risk_fragments
        markers = self.app_state.project_state.risk_markers
        
        # 更新统计
        pending = sum(1 for m in markers if m.review_status == ReviewStatus.PENDING)
        self.risk_stats_label.config(text=f"共 {len(fragments)} 片段, 待复核 {pending}")
        
        # 填充列表
        for i, fragment in enumerate(fragments, 1):
            start_str = ImportExport.format_time(fragment.start_time)
            end_str = ImportExport.format_time(fragment.end_time)
            
            values = (
                fragment.id,
                f"{start_str[:-4]} - {end_str[:-4]}",
                fragment.highest_risk_level.value,
                fragment.review_status.value,
                len(fragment.risk_markers)
            )
            
            item_id = self.fragment_tree.insert('', tk.END, values=values)
            
            # 设置颜色标签
            level_color = GUIConstants.RISK_LEVEL_COLORS.get(fragment.highest_risk_level, '#000000')
            status_color = GUIConstants.STATUS_COLORS.get(fragment.review_status, '#000000')
            
            self.fragment_tree.tag_configure(f'level_{fragment.highest_risk_level.name}', foreground=level_color)
            self.fragment_tree.tag_configure(f'status_{fragment.review_status.name}', foreground=status_color)
            self.fragment_tree.item(item_id, tags=(f'level_{fragment.highest_risk_level.name}',))
    
    def _refresh_markers(self):
        """刷新风险标记列表"""
        # 清空
        for item in self.marker_tree.get_children():
            self.marker_tree.delete(item)
        
        if not self.app_state.current_fragment:
            return
        
        for marker in self.app_state.current_fragment.risk_markers:
            values = (
                marker.risk_text,
                marker.risk_type.value,
                marker.risk_level.value,
                marker.suggested_replacement,
                marker.review_status.value
            )
            
            item_id = self.marker_tree.insert('', tk.END, values=values)
            
            # 设置颜色
            level_color = GUIConstants.RISK_LEVEL_COLORS.get(marker.risk_level, '#000000')
            self.marker_tree.tag_configure(f'marker_{marker.id}', foreground=level_color)
            self.marker_tree.item(item_id, tags=(f'marker_{marker.id}',))
    
    def _show_subtitle_preview(self, subtitle: SubtitleEntry):
        """显示字幕预览"""
        self.preview_text.config(state=tk.NORMAL)
        self.preview_text.delete(1.0, tk.END)
        
        content = f"序号: {subtitle.id}\n"
        content += f"时间: {ImportExport.format_time(subtitle.start_time)} --> {ImportExport.format_time(subtitle.end_time)}\n"
        if subtitle.speaker:
            content += f"说话人: {subtitle.speaker}\n"
        content += f"\n原文:\n{subtitle.text}\n"
        
        self.preview_text.insert(tk.END, content)
        self.preview_text.config(state=tk.DISABLED)
        
        self.detail_title.config(text=f"字幕 #{subtitle.id} 详情")
    
    def _show_fragment_preview(self, fragment: RiskFragment):
        """显示片段预览"""
        if not self.app_state.project_state:
            return
        
        self.preview_text.config(state=tk.NORMAL)
        self.preview_text.delete(1.0, tk.END)
        
        subtitle_map = {s.id: s for s in self.app_state.project_state.subtitles}
        
        content = f"片段 ID: {fragment.id}\n"
        content += f"时间范围: {ImportExport.format_time(fragment.start_time)} --> {ImportExport.format_time(fragment.end_time)}\n"
        content += f"关联字幕: {fragment.subtitle_ids}\n"
        if fragment.merged:
            content += f"合并来源: {fragment.merged_from}\n"
        content += f"复核状态: {fragment.review_status.value}\n"
        content += f"\n相关字幕原文:\n"
        content += "-" * 50 + "\n"
        
        for sub_id in sorted(fragment.subtitle_ids):
            subtitle = subtitle_map.get(sub_id)
            if subtitle:
                content += f"[{sub_id}] {subtitle.text}"
                if subtitle.speaker:
                    content += f" ({subtitle.speaker})"
                content += "\n"
        
        self.preview_text.insert(tk.END, content)
        self.preview_text.config(state=tk.DISABLED)
        
        self.detail_title.config(text=f"风险片段详情")
    
    def _update_preview(self):
        """更新预览"""
        if self.app_state.current_marker and self.app_state.current_fragment:
            self._show_fragment_preview(self.app_state.current_fragment)
        elif self.app_state.current_fragment:
            self._show_fragment_preview(self.app_state.current_fragment)
    
    def _update_title_status(self):
        """更新标题栏状态"""
        if self.app_state.project_state:
            name = self.app_state.project_state.project_name
            modified = " *" if self.app_state.unsaved_changes else ""
            self.status_label.config(text=f"项目: {name}{modified}")
        else:
            self.status_label.config(text="未打开项目")
    
    # ========== 视图切换 ==========
    
    def _toggle_stats(self):
        """切换统计面板"""
        messagebox.showinfo("提示", "统计信息已显示在风险片段列表顶部")
    
    def _toggle_subtitles(self):
        """切换字幕列表"""
        messagebox.showinfo("提示", "字幕列表已在左侧面板显示")
    
    # ========== 帮助 ==========
    
    def _show_about(self):
        """显示关于"""
        about_text = """采访素材脱敏剪辑台 v1.0

功能:
- 导入 SRT 字幕、说话人名单、敏感词表
- 自动检测敏感内容和未授权信息
- 逐条复核风险标记
- 合并相邻风险片段
- 导出脱敏 SRT、决策清单、审核报告
- 版本历史和回退功能

技术:
- Python + tkinter
- 本地 JSON 存储
"""
        messagebox.showinfo("关于", about_text)


class GUI:
    """GUI 入口"""
    
    @staticmethod
    def run():
        """启动应用"""
        root = tk.Tk()
        
        # 设置 ttk 样式
        style = ttk.Style()
        try:
            style.theme_use('clam')
        except:
            pass
        
        app = MainWindow(root)
        root.mainloop()
    
    @staticmethod
    def create_window():
        """创建窗口（供主程序调用）"""
        root = tk.Tk()
        
        # 设置 ttk 样式
        style = ttk.Style()
        try:
            style.theme_use('clam')
        except:
            pass
        
        app = MainWindow(root)
        return root, app
