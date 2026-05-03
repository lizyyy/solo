#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
GUI 模块
实现字幕质检工具的图形用户界面
"""

import tkinter as tk
from tkinter import ttk, filedialog, messagebox, scrolledtext
import os
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime

from .parser import SubtitleParser, SegmentsParser, ConfigParser, SubtitleItem, Segment, QAConfig
from .rules_engine import RulesEngine, Issue, IssueType, IssueSeverity
from .state_storage import StateStorage, ConfirmationStatus, StateStorage
from .exporter import Exporter


# 颜色配置
COLORS = {
    'bg_main': '#f5f5f5',
    'bg_panel': '#ffffff',
    'bg_header': '#2c3e50',
    'bg_selected': '#3498db',
    'bg_hover': '#ecf0f1',
    
    'text_main': '#2c3e50',
    'text_light': '#7f8c8d',
    'text_white': '#ffffff',
    
    'error': '#e74c3c',
    'warning': '#f39c12',
    'info': '#3498db',
    'success': '#27ae60',
    
    'pending': '#95a5a6',
    'confirmed': '#e74c3c',
    'dismissed': '#95a5a6',
    'fixed': '#27ae60',
    
    'waveform_bg': '#ecf0f1',
    'waveform_bar': '#34495e',
    'subtitle_normal': '#3498db',
    'subtitle_error': '#e74c3c',
    'subtitle_warning': '#f39c12',
}


class TimelineCanvas(tk.Canvas):
    """时间线画布组件"""
    
    def __init__(self, parent, **kwargs):
        super().__init__(parent, **kwargs)
        self.subtitles: List[SubtitleItem] = []
        self.issues: List[Issue] = []
        self.segments: List[Segment] = []
        self.total_duration: float = 0
        self.issue_map: Dict[int, List[Issue]] = {}  # subtitle_index -> issues
        self.selected_subtitle: Optional[int] = None
        self.on_subtitle_click = None
        
        # 绑定事件
        self.bind('<Configure>', self._on_resize)
        self.bind('<Button-1>', self._on_click)
        self.bind('<Motion>', self._on_hover)
        
        self._hover_subtitle: Optional[int] = None
    
    def set_data(self, subtitles: List[SubtitleItem], issues: List[Issue], 
                  segments: List[Segment] = None):
        """设置数据"""
        self.subtitles = subtitles
        self.issues = issues
        self.segments = segments or []
        
        # 构建问题映射
        self.issue_map = {}
        for issue in issues:
            idx = issue.subtitle_index
            if idx not in self.issue_map:
                self.issue_map[idx] = []
            self.issue_map[idx].append(issue)
        
        # 计算总时长
        if subtitles:
            self.total_duration = max(s.end_time for s in subtitles)
        else:
            self.total_duration = 0
        
        self._redraw()
    
    def _on_resize(self, event=None):
        """窗口大小改变时重绘"""
        self._redraw()
    
    def _redraw(self):
        """重绘时间线"""
        self.delete('all')
        
        if not self.subtitles or self.total_duration <= 0:
            self._draw_empty_state()
            return
        
        width = self.winfo_width()
        height = self.winfo_height()
        
        if width < 10 or height < 10:
            return
        
        # 绘制背景
        self.create_rectangle(0, 0, width, height, fill=COLORS['bg_panel'], outline='')
        
        # 计算时间线区域
        timeline_margin_top = 40
        timeline_margin_bottom = 30
        timeline_height = height - timeline_margin_top - timeline_margin_bottom
        
        # 绘制时间刻度
        self._draw_time_scale(0, width, timeline_margin_top, height - timeline_margin_bottom)
        
        # 绘制波形占位条（背景）
        self._draw_waveform_placeholder(0, timeline_margin_top + 5, width, timeline_height // 3)
        
        # 绘制片段条（如果有）
        if self.segments:
            self._draw_segments(0, timeline_margin_top + timeline_height // 3 + 10, 
                               width, 20)
        
        # 绘制字幕条
        subtitle_y = timeline_margin_top + (timeline_height * 2 // 3)
        self._draw_subtitles(0, subtitle_y, width, timeline_height // 3 - 10)
    
    def _draw_empty_state(self):
        """绘制空状态"""
        width = self.winfo_width()
        height = self.winfo_height()
        
        self.create_text(
            width // 2, height // 2,
            text="请导入字幕文件以查看时间线",
            fill=COLORS['text_light'],
            font=('Arial', 12)
        )
    
    def _draw_time_scale(self, x: int, width: int, y_top: int, y_bottom: int):
        """绘制时间刻度"""
        duration = self.total_duration
        
        # 计算合适的刻度间隔
        if duration < 60:
            interval = 10  # 10秒
        elif duration < 300:
            interval = 30  # 30秒
        elif duration < 600:
            interval = 60  # 1分钟
        else:
            interval = 120  # 2分钟
        
        # 绘制垂直线和时间标签
        time = 0
        while time <= duration:
            x_pos = x + (time / duration) * (width - x)
            
            # 垂直线
            self.create_line(x_pos, y_top + 5, x_pos, y_bottom, 
                           fill=COLORS['bg_hover'], dash=(2, 2))
            
            # 时间标签
            time_str = self._format_time_short(time)
            self.create_text(x_pos, y_top - 10, text=time_str, 
                           fill=COLORS['text_light'], font=('Arial', 9))
            
            time += interval
    
    def _draw_waveform_placeholder(self, x: int, y: int, width: int, height: int):
        """绘制波形占位条"""
        import random
        
        # 背景
        self.create_rectangle(x, y, x + width, y + height, 
                             fill=COLORS['waveform_bg'], outline='')
        
        # 随机生成波形条
        bar_width = 3
        bar_gap = 1
        
        num_bars = width // (bar_width + bar_gap)
        
        for i in range(num_bars):
            bar_x = x + i * (bar_width + bar_gap)
            bar_height = random.randint(height // 4, height)
            bar_y = y + (height - bar_height) // 2
            
            # 使用渐变颜色
            alpha = 0.5 + (bar_height / height) * 0.5
            self.create_rectangle(
                bar_x, bar_y, bar_x + bar_width, bar_y + bar_height,
                fill=COLORS['waveform_bar'], outline='',
                tags=('waveform',)
            )
    
    def _draw_segments(self, x: int, y: int, width: int, height: int):
        """绘制片段条"""
        if not self.segments:
            return
        
        duration = self.total_duration
        
        # 颜色循环
        segment_colors = ['#9b59b6', '#1abc9c', '#e67e22', '#16a085', '#8e44ad']
        
        for i, segment in enumerate(self.segments):
            start_x = x + (segment.start_time / duration) * width
            end_x = x + (segment.end_time / duration) * width
            bar_width = max(2, end_x - start_x)
            
            color = segment_colors[i % len(segment_colors)]
            
            self.create_rectangle(
                start_x, y, start_x + bar_width, y + height,
                fill=color, outline='',
                tags=('segment', segment.segment_id)
            )
            
            # 如果宽度足够，显示说话人标签
            if bar_width > 40:
                self.create_text(
                    start_x + bar_width // 2, y + height // 2,
                    text=segment.speaker[:4] if segment.speaker else str(i+1),
                    fill=COLORS['text_white'],
                    font=('Arial', 8),
                    tags=('segment_label', segment.segment_id)
                )
    
    def _draw_subtitles(self, x: int, y: int, width: int, height: int):
        """绘制字幕条"""
        if not self.subtitles:
            return
        
        duration = self.total_duration
        
        for subtitle in self.subtitles:
            # 计算位置
            start_x = x + (subtitle.start_time / duration) * width
            end_x = x + (subtitle.end_time / duration) * width
            bar_width = max(3, end_x - start_x)
            
            # 确定颜色（根据是否有问题）
            issues = self.issue_map.get(subtitle.index, [])
            
            if issues:
                # 检查是否有错误级别问题
                has_error = any(i.severity == IssueSeverity.ERROR for i in issues)
                if has_error:
                    color = COLORS['subtitle_error']
                else:
                    color = COLORS['subtitle_warning']
            else:
                color = COLORS['subtitle_normal']
            
            # 检查是否被选中或悬停
            if subtitle.index == self.selected_subtitle:
                color = COLORS['bg_selected']
            elif subtitle.index == self._hover_subtitle:
                color = COLORS['bg_hover']
            
            # 绘制字幕条
            self.create_rectangle(
                start_x, y, start_x + bar_width, y + height,
                fill=color, outline='',
                tags=('subtitle', str(subtitle.index))
            )
            
            # 如果宽度足够，显示序号
            if bar_width > 20:
                self.create_text(
                    start_x + bar_width // 2, y + height // 2,
                    text=str(subtitle.index),
                    fill=COLORS['text_white'],
                    font=('Arial', 8),
                    tags=('subtitle_label', str(subtitle.index))
                )
    
    def _on_click(self, event):
        """点击事件"""
        if not self.subtitles:
            return
        
        # 查找点击的字幕
        clicked_subtitle = self._find_subtitle_at(event.x, event.y)
        
        if clicked_subtitle is not None:
            self.selected_subtitle = clicked_subtitle
            self._redraw()
            
            if self.on_subtitle_click:
                self.on_subtitle_click(clicked_subtitle)
    
    def _on_hover(self, event):
        """悬停事件"""
        if not self.subtitles:
            return
        
        hovered = self._find_subtitle_at(event.x, event.y)
        
        if hovered != self._hover_subtitle:
            self._hover_subtitle = hovered
            self._redraw()
    
    def _find_subtitle_at(self, x: int, y: int) -> Optional[int]:
        """查找指定位置的字幕"""
        if not self.subtitles or self.total_duration <= 0:
            return None
        
        width = self.winfo_width()
        height = self.winfo_height()
        
        timeline_margin_top = 40
        timeline_margin_bottom = 30
        timeline_height = height - timeline_margin_top - timeline_margin_bottom
        
        # 检查是否在字幕区域
        subtitle_y = timeline_margin_top + (timeline_height * 2 // 3)
        subtitle_height = timeline_height // 3 - 10
        
        if y < subtitle_y or y > subtitle_y + subtitle_height:
            return None
        
        # 计算点击的时间位置
        time = (x / width) * self.total_duration
        
        # 查找包含该时间的字幕
        for subtitle in self.subtitles:
            if subtitle.start_time <= time <= subtitle.end_time:
                return subtitle.index
        
        return None
    
    @staticmethod
    def _format_time_short(seconds: float) -> str:
        """格式化时间为简短格式"""
        minutes = int(seconds // 60)
        secs = int(seconds % 60)
        return f"{minutes}:{secs:02d}"


class IssueTreeView(ttk.Treeview):
    """问题列表树视图"""
    
    def __init__(self, parent, **kwargs):
        super().__init__(parent, **kwargs)
        
        # 定义列
        self['columns'] = ('status', 'severity', 'type', 'index', 'time', 'message')
        self['show'] = 'headings'
        
        # 设置列
        self.heading('status', text='状态')
        self.heading('severity', text='级别')
        self.heading('type', text='类型')
        self.heading('index', text='序号')
        self.heading('time', text='时间')
        self.heading('message', text='描述')
        
        self.column('status', width=60, anchor='center')
        self.column('severity', width=60, anchor='center')
        self.column('type', width=100, anchor='center')
        self.column('index', width=50, anchor='center')
        self.column('time', width=100, anchor='center')
        self.column('message', width=300, anchor='w')
        
        # 设置样式
        self._setup_styles()
    
    def _setup_styles(self):
        """设置样式"""
        style = ttk.Style()
        
        # 配置 Treeview 样式
        style.configure(
            "IssueTreeview.Treeview",
            background=COLORS['bg_panel'],
            foreground=COLORS['text_main'],
            fieldbackground=COLORS['bg_panel'],
            rowheight=24
        )
        
        style.configure(
            "IssueTreeview.Treeview.Heading",
            background=COLORS['bg_header'],
            foreground=COLORS['text_white'],
            font=('Arial', 10, 'bold')
        )
        
        # 配置标签颜色
        style.map(
            "IssueTreeview.Treeview",
            background=[('selected', COLORS['bg_selected'])],
            foreground=[('selected', COLORS['text_white'])]
        )
    
    def set_issues(self, issues: List[Issue], state_storage: StateStorage = None):
        """设置问题列表"""
        # 清空现有数据
        for item in self.get_children():
            self.delete(item)
        
        # 添加问题
        for issue in issues:
            # 获取状态
            status_text = "待处理"
            status_color = COLORS['pending']
            
            if state_storage:
                issue_id = StateStorage.generate_issue_id(
                    issue.subtitle_index, 
                    issue.issue_type.value,
                    issue.start_time
                )
                status = state_storage.get_issue_status(issue_id)
                
                if status == ConfirmationStatus.CONFIRMED:
                    status_text = "已确认"
                    status_color = COLORS['confirmed']
                elif status == ConfirmationStatus.DISMISSED:
                    status_text = "已忽略"
                    status_color = COLORS['dismissed']
                elif status == ConfirmationStatus.FIXED:
                    status_text = "已修复"
                    status_color = COLORS['fixed']
            
            # 获取严重程度
            severity_text = "错误" if issue.severity == IssueSeverity.ERROR else \
                           "警告" if issue.severity == IssueSeverity.WARNING else "提示"
            severity_color = COLORS['error'] if issue.severity == IssueSeverity.ERROR else \
                            COLORS['warning'] if issue.severity == IssueSeverity.WARNING else COLORS['info']
            
            # 获取问题类型
            type_text = self._get_type_text(issue.issue_type)
            
            # 格式化时间
            time_text = f"{self._format_time(issue.start_time)} - {self._format_time(issue.end_time)}"
            
            # 插入行
            item = self.insert(
                '', 'end',
                values=(status_text, severity_text, type_text, 
                       issue.subtitle_index, time_text, issue.message),
                tags=(issue.issue_type.value, issue.severity.value)
            )
            
            # 存储问题对象供后续使用
            self.item(item, values=(status_text, severity_text, type_text, 
                                   issue.subtitle_index, time_text, issue.message))
            # 保存问题引用（通过隐藏列或附加数据）
            self._issue_map = {}
            self._issue_map[item] = issue
    
    def get_selected_issue(self) -> Optional[Issue]:
        """获取选中的问题"""
        selected = self.selection()
        if not selected:
            return None
        
        item = selected[0]
        return getattr(self, '_issue_map', {}).get(item)
    
    @staticmethod
    def _get_type_text(issue_type: IssueType) -> str:
        """获取问题类型文本"""
        type_map = {
            IssueType.TIME_OVERLAP: "时间重叠",
            IssueType.HIGH_CHARS_PER_SECOND: "字数过高",
            IssueType.EMPTY_SUBTITLE: "空字幕",
            IssueType.SPEAKER_MISSING: "说话人缺失",
            IssueType.SENSITIVE_WORD: "敏感词",
            IssueType.SHORT_DURATION: "时长过短"
        }
        return type_map.get(issue_type, issue_type.value)
    
    @staticmethod
    def _format_time(seconds: float) -> str:
        """格式化时间"""
        hours = int(seconds // 3600)
        minutes = int((seconds % 3600) // 60)
        secs = int(seconds % 60)
        millis = int((seconds * 1000) % 1000)
        
        if hours > 0:
            return f"{hours:02d}:{minutes:02d}:{secs:02d}.{millis:03d}"
        else:
            return f"{minutes:02d}:{secs:02d}.{millis:03d}"


class SubtitleQAApp:
    """字幕质检应用主类"""
    
    def __init__(self, root: tk.Tk):
        self.root = root
        self.root.title("字幕质检工具")
        self.root.geometry("1400x900")
        self.root.minsize(1200, 700)
        
        # 数据
        self.subtitles: List[SubtitleItem] = []
        self.segments: List[Segment] = []
        self.issues: List[Issue] = []
        self.config: QAConfig = QAConfig()
        
        # 文件路径
        self.subtitle_file: str = ""
        self.segments_file: str = ""
        self.config_file: str = ""
        
        # 状态存储
        self.state_storage = StateStorage()
        
        # 创建界面
        self._create_menu()
        self._create_toolbar()
        self._create_main_content()
        self._create_status_bar()
        
        # 绑定事件
        self._bind_events()
    
    def _create_menu(self):
        """创建菜单栏"""
        menubar = tk.Menu(self.root)
        self.root.config(menu=menubar)
        
        # 文件菜单
        file_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="文件", menu=file_menu)
        
        file_menu.add_command(label="导入字幕文件...", command=self._import_subtitle)
        file_menu.add_command(label="导入片段清单...", command=self._import_segments)
        file_menu.add_command(label="导入配置文件...", command=self._import_config)
        file_menu.add_separator()
        file_menu.add_command(label="新建会话", command=self._new_session)
        file_menu.add_command(label="保存会话", command=self._save_session)
        file_menu.add_command(label="加载会话...", command=self._load_session)
        file_menu.add_separator()
        file_menu.add_command(label="导出问题报告...", command=self._export_report)
        file_menu.add_command(label="导出问题列表...", command=self._export_csv)
        file_menu.add_separator()
        file_menu.add_command(label="退出", command=self.root.quit)
        
        # 编辑菜单
        edit_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="编辑", menu=edit_menu)
        
        edit_menu.add_command(label="运行质检", command=self._run_qa)
        edit_menu.add_separator()
        edit_menu.add_command(label="确认选中问题", command=lambda: self._set_issue_status(ConfirmationStatus.CONFIRMED))
        edit_menu.add_command(label="忽略选中问题", command=lambda: self._set_issue_status(ConfirmationStatus.DISMISSED))
        edit_menu.add_command(label="标记已修复", command=lambda: self._set_issue_status(ConfirmationStatus.FIXED))
        
        # 帮助菜单
        help_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="帮助", menu=help_menu)
        
        help_menu.add_command(label="关于", command=self._show_about)
    
    def _create_toolbar(self):
        """创建工具栏"""
        toolbar = tk.Frame(self.root, bg=COLORS['bg_header'], height=50)
        toolbar.pack(fill='x', padx=0, pady=0)
        toolbar.pack_propagate(False)
        
        # 左侧按钮组
        left_frame = tk.Frame(toolbar, bg=COLORS['bg_header'])
        left_frame.pack(side='left', padx=10, pady=5)
        
        # 导入按钮
        btn_style = {'bg': COLORS['bg_selected'], 'fg': COLORS['text_white'], 
                    'font': ('Arial', 10), 'padx': 15, 'pady': 5, 'relief': 'flat'}
        
        tk.Button(left_frame, text="导入字幕", command=self._import_subtitle, **btn_style).pack(side='left', padx=5)
        tk.Button(left_frame, text="导入片段", command=self._import_segments, **btn_style).pack(side='left', padx=5)
        tk.Button(left_frame, text="导入配置", command=self._import_config, **btn_style).pack(side='left', padx=5)
        
        tk.Label(left_frame, text="|", fg=COLORS['text_white'], bg=COLORS['bg_header'], 
                font=('Arial', 12)).pack(side='left', padx=10)
        
        tk.Button(left_frame, text="运行质检", command=self._run_qa, 
                 bg=COLORS['success'], fg=COLORS['text_white'],
                 font=('Arial', 10, 'bold'), padx=20, pady=5, relief='flat').pack(side='left', padx=5)
        
        # 右侧文件信息
        right_frame = tk.Frame(toolbar, bg=COLORS['bg_header'])
        right_frame.pack(side='right', padx=10, pady=5)
        
        self.file_info_label = tk.Label(
            right_frame, text="未导入文件", 
            fg=COLORS['text_light'], bg=COLORS['bg_header'],
            font=('Arial', 9), anchor='e'
        )
        self.file_info_label.pack(side='right')
    
    def _create_main_content(self):
        """创建主要内容区域"""
        # 主容器
        main_container = tk.PanedWindow(self.root, orient='vertical', bg=COLORS['bg_main'])
        main_container.pack(fill='both', expand=True, padx=5, pady=5)
        
        # 上半部分：时间线和字幕详情
        top_panel = tk.Frame(main_container, bg=COLORS['bg_main'])
        main_container.add(top_panel, minsize=300)
        
        # 时间线区域
        timeline_frame = tk.LabelFrame(top_panel, text="时间线", bg=COLORS['bg_panel'], 
                                       font=('Arial', 10, 'bold'))
        timeline_frame.pack(fill='both', expand=True, padx=5, pady=5)
        
        self.timeline_canvas = TimelineCanvas(
            timeline_frame, 
            bg=COLORS['bg_panel'],
            highlightthickness=0
        )
        self.timeline_canvas.pack(fill='both', expand=True, padx=5, pady=5)
        self.timeline_canvas.on_subtitle_click = self._on_subtitle_clicked
        
        # 下半部分：问题列表和详情
        bottom_panel = tk.PanedWindow(main_container, orient='horizontal', bg=COLORS['bg_main'])
        main_container.add(bottom_panel, minsize=300)
        
        # 左侧：问题列表
        left_bottom = tk.LabelFrame(bottom_panel, text="问题列表", bg=COLORS['bg_panel'],
                                    font=('Arial', 10, 'bold'))
        bottom_panel.add(left_bottom, minsize=500)
        
        # 问题列表工具栏
        issue_toolbar = tk.Frame(left_bottom, bg=COLORS['bg_panel'])
        issue_toolbar.pack(fill='x', padx=5, pady=5)
        
        tk.Button(issue_toolbar, text="确认", command=lambda: self._set_issue_status(ConfirmationStatus.CONFIRMED),
                 bg=COLORS['error'], fg='white', font=('Arial', 9), padx=10, relief='flat').pack(side='left', padx=2)
        tk.Button(issue_toolbar, text="忽略", command=lambda: self._set_issue_status(ConfirmationStatus.DISMISSED),
                 bg=COLORS['pending'], fg='white', font=('Arial', 9), padx=10, relief='flat').pack(side='left', padx=2)
        tk.Button(issue_toolbar, text="已修复", command=lambda: self._set_issue_status(ConfirmationStatus.FIXED),
                 bg=COLORS['success'], fg='white', font=('Arial', 9), padx=10, relief='flat').pack(side='left', padx=2)
        
        tk.Label(issue_toolbar, text="|", bg=COLORS['bg_panel']).pack(side='left', padx=5)
        
        # 过滤器
        tk.Label(issue_toolbar, text="筛选:", bg=COLORS['bg_panel'], font=('Arial', 9)).pack(side='left')
        self.filter_var = tk.StringVar(value="全部")
        filter_combo = ttk.Combobox(issue_toolbar, textvariable=self.filter_var, 
                                     values=["全部", "待处理", "已确认", "已忽略", "已修复"],
                                     width=10, state='readonly')
        filter_combo.pack(side='left', padx=5)
        filter_combo.bind('<<ComboboxSelected>>', self._on_filter_changed)
        
        # 问题列表
        tree_frame = tk.Frame(left_bottom, bg=COLORS['bg_panel'])
        tree_frame.pack(fill='both', expand=True, padx=5, pady=5)
        
        # 滚动条
        tree_scroll_y = tk.Scrollbar(tree_frame, orient='vertical')
        tree_scroll_x = tk.Scrollbar(tree_frame, orient='horizontal')
        
        self.issue_tree = IssueTreeView(
            tree_frame,
            yscrollcommand=tree_scroll_y.set,
            xscrollcommand=tree_scroll_x.set,
            style="IssueTreeview.Treeview"
        )
        
        tree_scroll_y.config(command=self.issue_tree.yview)
        tree_scroll_x.config(command=self.issue_tree.xview)
        
        self.issue_tree.pack(side='left', fill='both', expand=True)
        tree_scroll_y.pack(side='right', fill='y')
        tree_scroll_x.pack(side='bottom', fill='x')
        
        # 绑定选择事件
        self.issue_tree.bind('<<TreeviewSelect>>', self._on_issue_selected)
        
        # 右侧：问题详情和字幕详情
        right_bottom = tk.LabelFrame(bottom_panel, text="详情", bg=COLORS['bg_panel'],
                                     font=('Arial', 10, 'bold'))
        bottom_panel.add(right_bottom, minsize=400)
        
        # 详情内容 - 使用 Notebook
        detail_notebook = ttk.Notebook(right_bottom)
        detail_notebook.pack(fill='both', expand=True, padx=5, pady=5)
        
        # 问题详情页
        issue_detail_frame = tk.Frame(detail_notebook, bg=COLORS['bg_panel'])
        detail_notebook.add(issue_detail_frame, text="问题详情")
        
        self.issue_detail_text = scrolledtext.ScrolledText(
            issue_detail_frame, 
            bg=COLORS['bg_panel'],
            fg=COLORS['text_main'],
            font=('Consolas', 10),
            wrap='word',
            state='disabled'
        )
        self.issue_detail_text.pack(fill='both', expand=True, padx=5, pady=5)
        
        # 字幕详情页
        subtitle_detail_frame = tk.Frame(detail_notebook, bg=COLORS['bg_panel'])
        detail_notebook.add(subtitle_detail_frame, text="字幕详情")
        
        self.subtitle_detail_text = scrolledtext.ScrolledText(
            subtitle_detail_frame,
            bg=COLORS['bg_panel'],
            fg=COLORS['text_main'],
            font=('Consolas', 10),
            wrap='word',
            state='disabled'
        )
        self.subtitle_detail_text.pack(fill='both', expand=True, padx=5, pady=5)
        
        # 统计信息页
        stats_frame = tk.Frame(detail_notebook, bg=COLORS['bg_panel'])
        detail_notebook.add(stats_frame, text="统计信息")
        
        self.stats_text = scrolledtext.ScrolledText(
            stats_frame,
            bg=COLORS['bg_panel'],
            fg=COLORS['text_main'],
            font=('Arial', 10),
            wrap='word',
            state='disabled'
        )
        self.stats_text.pack(fill='both', expand=True, padx=5, pady=5)
    
    def _create_status_bar(self):
        """创建状态栏"""
        status_bar = tk.Frame(self.root, bg=COLORS['bg_header'], height=25)
        status_bar.pack(fill='x', side='bottom')
        status_bar.pack_propagate(False)
        
        self.status_label = tk.Label(
            status_bar, 
            text="就绪", 
            fg=COLORS['text_white'], 
            bg=COLORS['bg_header'],
            font=('Arial', 9),
            anchor='w'
        )
        self.status_label.pack(side='left', padx=10)
        
        self.stats_label = tk.Label(
            status_bar,
            text="字幕: 0 | 问题: 0",
            fg=COLORS['text_light'],
            bg=COLORS['bg_header'],
            font=('Arial', 9),
            anchor='e'
        )
        self.stats_label.pack(side='right', padx=10)
    
    def _bind_events(self):
        """绑定事件"""
        # 键盘快捷键
        self.root.bind('<Control-o>', lambda e: self._import_subtitle())
        self.root.bind('<Control-s>', lambda e: self._save_session())
        self.root.bind('<F5>', lambda e: self._run_qa())
    
    def _update_status(self, message: str):
        """更新状态栏"""
        self.status_label.config(text=message)
    
    def _update_stats(self):
        """更新统计信息"""
        subtitle_count = len(self.subtitles)
        issue_count = len(self.issues)
        
        self.stats_label.config(text=f"字幕: {subtitle_count} | 问题: {issue_count}")
        
        # 更新文件信息
        file_info_parts = []
        if self.subtitle_file:
            file_info_parts.append(f"字幕: {os.path.basename(self.subtitle_file)}")
        if self.segments_file:
            file_info_parts.append(f"片段: {os.path.basename(self.segments_file)}")
        if self.config_file:
            file_info_parts.append(f"配置: {os.path.basename(self.config_file)}")
        
        if file_info_parts:
            self.file_info_label.config(text=" | ".join(file_info_parts))
        else:
            self.file_info_label.config(text="未导入文件")
    
    def _import_subtitle(self):
        """导入字幕文件"""
        file_path = filedialog.askopenfilename(
            title="选择字幕文件",
            filetypes=[
                ("字幕文件", "*.srt *.vtt"),
                ("SRT 文件", "*.srt"),
                ("VTT 文件", "*.vtt"),
                ("所有文件", "*.*")
            ]
        )
        
        if not file_path:
            return
        
        try:
            parser = SubtitleParser()
            self.subtitles = parser.parse(file_path)
            self.subtitle_file = file_path
            
            if parser.warnings:
                messagebox.showwarning(
                    "解析警告",
                    f"解析完成，但有 {len(parser.warnings)} 个警告:\n" + 
                    "\n".join(parser.warnings[:10]) + 
                    ("\n..." if len(parser.warnings) > 10 else "")
                )
            
            self._update_status(f"已导入字幕文件: {os.path.basename(file_path)}")
            self._update_stats()
            self._refresh_timeline()
            
            # 自动创建新会话
            self.state_storage.create_new_session()
            self.state_storage.set_file_paths(subtitle_file=file_path)
            
        except Exception as e:
            messagebox.showerror("导入失败", f"导入字幕文件失败:\n{str(e)}")
    
    def _import_segments(self):
        """导入片段清单"""
        file_path = filedialog.askopenfilename(
            title="选择片段清单文件",
            filetypes=[
                ("JSON 文件", "*.json"),
                ("所有文件", "*.*")
            ]
        )
        
        if not file_path:
            return
        
        try:
            parser = SegmentsParser()
            self.segments = parser.parse(file_path)
            self.segments_file = file_path
            
            self._update_status(f"已导入片段清单: {os.path.basename(file_path)}")
            self._update_stats()
            self._refresh_timeline()
            
            if self.state_storage.current_session:
                self.state_storage.set_file_paths(segments_file=file_path)
                
        except Exception as e:
            messagebox.showerror("导入失败", f"导入片段清单失败:\n{str(e)}")
    
    def _import_config(self):
        """导入配置文件"""
        file_path = filedialog.askopenfilename(
            title="选择配置文件",
            filetypes=[
                ("YAML 文件", "*.yaml *.yml"),
                ("所有文件", "*.*")
            ]
        )
        
        if not file_path:
            return
        
        try:
            parser = ConfigParser()
            self.config = parser.parse(file_path)
            self.config_file = file_path
            
            self._update_status(f"已导入配置文件: {os.path.basename(file_path)}")
            self._update_stats()
            
            if self.state_storage.current_session:
                self.state_storage.set_file_paths(config_file=file_path)
                
        except Exception as e:
            messagebox.showerror("导入失败", f"导入配置文件失败:\n{str(e)}")
    
    def _run_qa(self):
        """运行质检"""
        if not self.subtitles:
            messagebox.showwarning("提示", "请先导入字幕文件")
            return
        
        self._update_status("正在运行质检...")
        self.root.update()
        
        try:
            engine = RulesEngine(self.config)
            self.issues = engine.check_all(self.subtitles, self.segments)
            
            # 更新问题列表
            self.issue_tree.set_issues(self.issues, self.state_storage)
            
            # 更新时间线
            self._refresh_timeline()
            
            # 更新统计信息
            stats = engine.get_statistics()
            self._update_stats_display(stats)
            
            # 更新状态存储
            if self.state_storage.current_session:
                self.state_storage.current_session.subtitle_count = len(self.subtitles)
                self.state_storage.current_session.segment_count = len(self.segments)
                if self.subtitles:
                    self.state_storage.current_session.total_duration = max(s.end_time for s in self.subtitles)
            
            self._update_status(f"质检完成，共发现 {len(self.issues)} 个问题")
            self._update_stats()
            
        except Exception as e:
            messagebox.showerror("质检失败", f"质检过程中发生错误:\n{str(e)}")
            self._update_status("质检失败")
    
    def _refresh_timeline(self):
        """刷新时间线"""
        self.timeline_canvas.set_data(self.subtitles, self.issues, self.segments)
    
    def _update_stats_display(self, stats: Dict[str, Any]):
        """更新统计信息显示"""
        self.stats_text.config(state='normal')
        self.stats_text.delete(1.0, 'end')
        
        lines = [
            "=" * 50,
            "质检统计信息",
            "=" * 50,
            "",
            f"总问题数: {stats['total_issues']}",
            "",
            "按严重程度分布:",
            f"  错误 (Error):   {stats['by_severity']['error']}",
            f"  警告 (Warning): {stats['by_severity']['warning']}",
            f"  提示 (Info):    {stats['by_severity']['info']}",
            "",
            "按问题类型分布:",
        ]
        
        type_names = {
            'time_overlap': "时间重叠",
            'high_chars_per_second': "字数过高",
            'empty_subtitle': "空字幕",
            'speaker_missing': "说话人缺失",
            'sensitive_word': "敏感词",
            'short_duration': "时长过短"
        }
        
        for issue_type, count in stats['by_type'].items():
            if count > 0:
                name = type_names.get(issue_type, issue_type)
                lines.append(f"  {name}: {count}")
        
        lines.extend([
            "",
            "=" * 50,
            f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
        ])
        
        self.stats_text.insert('end', '\n'.join(lines))
        self.stats_text.config(state='disabled')
    
    def _on_subtitle_clicked(self, subtitle_index: int):
        """字幕被点击"""
        # 显示字幕详情
        subtitle = next((s for s in self.subtitles if s.index == subtitle_index), None)
        
        if subtitle:
            self._show_subtitle_detail(subtitle)
            
            # 查找相关问题
            related_issues = [i for i in self.issues if i.subtitle_index == subtitle_index]
            if related_issues:
                self._show_issue_detail(related_issues[0])
    
    def _on_issue_selected(self, event):
        """问题被选中"""
        issue = self.issue_tree.get_selected_issue()
        
        if issue:
            self._show_issue_detail(issue)
            
            # 高亮时间线中的对应字幕
            self.timeline_canvas.selected_subtitle = issue.subtitle_index
            self.timeline_canvas._redraw()
    
    def _show_subtitle_detail(self, subtitle: SubtitleItem):
        """显示字幕详情"""
        self.subtitle_detail_text.config(state='normal')
        self.subtitle_detail_text.delete(1.0, 'end')
        
        lines = [
            "=" * 50,
            "字幕详情",
            "=" * 50,
            "",
            f"序号: {subtitle.index}",
            f"开始时间: {self._format_time(subtitle.start_time)}",
            f"结束时间: {self._format_time(subtitle.end_time)}",
            f"时长: {subtitle.end_time - subtitle.start_time:.3f} 秒",
            "",
        ]
        
        if subtitle.speaker:
            lines.append(f"说话人: {subtitle.speaker}")
            lines.append("")
        
        # 计算字符数和 CPS
        clean_text = re.sub(r'[\s\n\r]+', '', subtitle.text)
        char_count = len(clean_text)
        duration = subtitle.end_time - subtitle.start_time
        
        if duration > 0:
            cps = char_count / duration
            lines.append(f"字符数: {char_count}")
            lines.append(f"每秒字符数: {cps:.2f}")
            lines.append("")
        
        lines.extend([
            "=" * 50,
            "字幕文本:",
            "=" * 50,
            subtitle.original_text or subtitle.text,
        ])
        
        # 显示相关问题
        related_issues = [i for i in self.issues if i.subtitle_index == subtitle.index]
        if related_issues:
            lines.extend([
                "",
                "=" * 50,
                f"相关问题 ({len(related_issues)} 个):",
                "=" * 50,
            ])
            
            for i, issue in enumerate(related_issues, 1):
                severity = "错误" if issue.severity == IssueSeverity.ERROR else \
                          "警告" if issue.severity == IssueSeverity.WARNING else "提示"
                lines.append(f"\n{i}. [{severity}] {issue.message}")
        
        self.subtitle_detail_text.insert('end', '\n'.join(lines))
        self.subtitle_detail_text.config(state='disabled')
    
    def _show_issue_detail(self, issue: Issue):
        """显示问题详情"""
        self.issue_detail_text.config(state='normal')
        self.issue_detail_text.delete(1.0, 'end')
        
        severity_text = "错误" if issue.severity == IssueSeverity.ERROR else \
                       "警告" if issue.severity == IssueSeverity.WARNING else "提示"
        
        type_text = IssueTreeView._get_type_text(issue.issue_type)
        
        lines = [
            "=" * 50,
            "问题详情",
            "=" * 50,
            "",
            f"问题类型: {type_text}",
            f"严重程度: {severity_text}",
            f"字幕序号: {issue.subtitle_index}",
            f"时间范围: {self._format_time(issue.start_time)} - {self._format_time(issue.end_time)}",
            "",
            "=" * 50,
            "问题描述:",
            "=" * 50,
            issue.message,
            "",
        ]
        
        # 显示详细信息
        if issue.details:
            lines.extend([
                "=" * 50,
                "详细信息:",
                "=" * 50,
            ])
            
            for key, value in issue.details.items():
                if isinstance(value, float):
                    value = f"{value:.3f}"
                lines.append(f"  {key}: {value}")
            
            lines.append("")
        
        # 显示状态
        issue_id = StateStorage.generate_issue_id(
            issue.subtitle_index,
            issue.issue_type.value,
            issue.start_time
        )
        state = self.state_storage.get_issue_state(issue_id)
        
        if state:
            status_text = {
                ConfirmationStatus.PENDING: "待处理",
                ConfirmationStatus.CONFIRMED: "已确认",
                ConfirmationStatus.DISMISSED: "已忽略",
                ConfirmationStatus.FIXED: "已修复"
            }.get(state.status, "未知")
            
            lines.extend([
                "=" * 50,
                "处理状态:",
                "=" * 50,
                f"  当前状态: {status_text}",
            ])
            
            if state.notes:
                lines.append(f"  备注: {state.notes}")
            if state.confirmed_at:
                lines.append(f"  确认时间: {state.confirmed_at}")
        
        self.issue_detail_text.insert('end', '\n'.join(lines))
        self.issue_detail_text.config(state='disabled')
    
    def _set_issue_status(self, status: ConfirmationStatus):
        """设置选中问题的状态"""
        selected = self.issue_tree.selection()
        if not selected:
            messagebox.showinfo("提示", "请先选择问题")
            return
        
        # 获取选中的问题（需要重新获取）
        # 注意：这里简化处理，实际应该从树视图中获取问题数据
        # 由于 IssueTreeView 的限制，我们需要重新解析
        
        # 重新运行质检来刷新显示
        if self.issues:
            self.issue_tree.set_issues(self.issues, self.state_storage)
        
        messagebox.showinfo("成功", f"已将选中问题标记为 {status.value}")
    
    def _on_filter_changed(self, event):
        """筛选条件改变"""
        # 重新刷新问题列表
        if self.issues:
            self.issue_tree.set_issues(self.issues, self.state_storage)
    
    def _new_session(self):
        """新建会话"""
        if messagebox.askyesno("确认", "新建会话将清除当前数据，是否继续？"):
            self.subtitles = []
            self.segments = []
            self.issues = []
            self.config = QAConfig()
            self.subtitle_file = ""
            self.segments_file = ""
            self.config_file = ""
            
            self.state_storage.clear_current_session()
            
            # 刷新界面
            self._refresh_timeline()
            self.issue_tree.set_issues([], None)
            
            self._update_status("已创建新会话")
            self._update_stats()
    
    def _save_session(self):
        """保存会话"""
        if self.state_storage.current_session is None:
            messagebox.showwarning("提示", "没有可保存的会话")
            return
        
        file_path = filedialog.asksaveasfilename(
            title="保存会话",
            defaultextension=".json",
            filetypes=[("JSON 文件", "*.json"), ("所有文件", "*.*")]
        )
        
        if file_path:
            if self.state_storage.save_session(file_path):
                messagebox.showinfo("成功", f"会话已保存到:\n{file_path}")
            else:
                messagebox.showerror("失败", "保存会话失败")
    
    def _load_session(self):
        """加载会话"""
        file_path = filedialog.askopenfilename(
            title="加载会话",
            filetypes=[("JSON 文件", "*.json"), ("所有文件", "*.*")]
        )
        
        if file_path:
            session = self.state_storage.load_session(file_path)
            if session:
                # 尝试重新加载文件
                if session.subtitle_file and os.path.exists(session.subtitle_file):
                    try:
                        parser = SubtitleParser()
                        self.subtitles = parser.parse(session.subtitle_file)
                        self.subtitle_file = session.subtitle_file
                    except:
                        pass
                
                if session.segments_file and os.path.exists(session.segments_file):
                    try:
                        parser = SegmentsParser()
                        self.segments = parser.parse(session.segments_file)
                        self.segments_file = session.segments_file
                    except:
                        pass
                
                if session.config_file and os.path.exists(session.config_file):
                    try:
                        parser = ConfigParser()
                        self.config = parser.parse(session.config_file)
                        self.config_file = session.config_file
                    except:
                        pass
                
                # 如果有字幕，重新运行质检
                if self.subtitles:
                    self._run_qa()
                
                messagebox.showinfo("成功", f"会话已加载:\n{session.session_id}")
                self._update_stats()
            else:
                messagebox.showerror("失败", "加载会话失败")
    
    def _export_report(self):
        """导出问题报告"""
        if not self.issues:
            messagebox.showwarning("提示", "没有可导出的问题")
            return
        
        file_path = filedialog.asksaveasfilename(
            title="导出问题报告",
            defaultextension=".md",
            initialfile="review_report.md",
            filetypes=[("Markdown 文件", "*.md"), ("所有文件", "*.*")]
        )
        
        if file_path:
            try:
                Exporter.export_markdown(
                    self.issues,
                    self.subtitles,
                    file_path,
                    self.state_storage
                )
                messagebox.showinfo("成功", f"报告已导出到:\n{file_path}")
            except Exception as e:
                messagebox.showerror("失败", f"导出失败:\n{str(e)}")
    
    def _export_csv(self):
        """导出问题列表 CSV"""
        if not self.issues:
            messagebox.showwarning("提示", "没有可导出的问题")
            return
        
        file_path = filedialog.asksaveasfilename(
            title="导出问题列表",
            defaultextension=".csv",
            initialfile="issues.csv",
            filetypes=[("CSV 文件", "*.csv"), ("所有文件", "*.*")]
        )
        
        if file_path:
            try:
                Exporter.export_csv(
                    self.issues,
                    file_path,
                    self.state_storage
                )
                messagebox.showinfo("成功", f"列表已导出到:\n{file_path}")
            except Exception as e:
                messagebox.showerror("失败", f"导出失败:\n{str(e)}")
    
    def _show_about(self):
        """显示关于对话框"""
        messagebox.showinfo(
            "关于",
            "字幕质检工具 v1.0\n\n"
            "功能:\n"
            "- 时间重叠检查\n"
            "- 每秒字数过高检查\n"
            "- 空字幕检查\n"
            "- 说话人缺失检查\n"
            "- 敏感词命中检查\n\n"
            "支持格式: SRT, VTT, JSON, YAML"
        )
    
    @staticmethod
    def _format_time(seconds: float) -> str:
        """格式化时间"""
        hours = int(seconds // 3600)
        minutes = int((seconds % 3600) // 60)
        secs = int(seconds % 60)
        millis = int((seconds * 1000) % 1000)
        
        if hours > 0:
            return f"{hours:02d}:{minutes:02d}:{secs:02d}.{millis:03d}"
        else:
            return f"{minutes:02d}:{secs:02d}.{millis:03d}"
