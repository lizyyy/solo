"""主窗口 - 快捷键冲突搬家员GUI"""

import tkinter as tk
from tkinter import ttk, filedialog, messagebox, scrolledtext
from typing import Dict, Any, List, Optional
from pathlib import Path
from datetime import datetime
import json
import sys
import os

# 添加项目根目录到路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))))

from src.models import (
    Application, Context, Shortcut, ShortcutKey,
    Conflict, ConflictType, ConflictSeverity,
    PlatformDifference, UnreachableShortcut, DuplicateMacro,
)
from src.parsers.parser_factory import ParserFactory
from src.rules.rule_engine import RuleEngine, AnalysisResult, RuleResult
from src.suggestions.key_suggester import KeySuggester
from src.storage.session_storage import SessionStorage, Session, MigrationPlan
from src.exporters import MarkdownExporter, CSVExporter, JSONExporter


class ShortcutMigratorApp:
    """快捷键冲突搬家员主应用"""
    
    def __init__(self, root: tk.Tk):
        self.root = root
        self.root.title("快捷键冲突搬家员")
        self.root.geometry("1400x900")
        self.root.minsize(1000, 700)
        
        # 初始化组件
        self.storage = SessionStorage()
        self.parser_factory = ParserFactory()
        self.rule_engine = RuleEngine()
        self.key_suggester = KeySuggester()
        
        # 当前状态
        self.current_session: Optional[Session] = None
        self.analysis_result: Optional[Dict[str, Any]] = None
        self.current_plan: Optional[MigrationPlan] = None
        
        # 导入的文件列表
        self.imported_files: List[Dict[str, Any]] = []
        
        # 创建UI
        self._create_menu()
        self._create_main_layout()
        
        # 尝试加载自动保存的会话
        self._try_load_autosave()
    
    def _create_menu(self):
        """创建菜单"""
        menubar = tk.Menu(self.root)
        self.root.config(menu=menubar)
        
        # 文件菜单
        file_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="文件", menu=file_menu)
        file_menu.add_command(label="新建会话", command=self._new_session)
        file_menu.add_command(label="打开会话...", command=self._open_session)
        file_menu.add_separator()
        file_menu.add_command(label="保存会话", command=self._save_session)
        file_menu.add_command(label="会话另存为...", command=self._save_session_as)
        file_menu.add_separator()
        file_menu.add_command(label="导入快捷键配置...", command=self._import_files)
        file_menu.add_separator()
        file_menu.add_command(label="导出 Markdown 迁移单", command=self._export_markdown)
        file_menu.add_command(label="导出 CSV 冲突表", command=self._export_csv)
        file_menu.add_command(label="导出 JSON 审计包", command=self._export_json)
        file_menu.add_separator()
        file_menu.add_command(label="退出", command=self.root.quit)
        
        # 会话菜单
        session_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="会话", menu=session_menu)
        session_menu.add_command(label="分析所有快捷键", command=self._run_analysis)
        session_menu.add_command(label="创建迁移方案", command=self._create_migration_plan)
        session_menu.add_separator()
        session_menu.add_command(label="会话列表", command=self._show_sessions)
        
        # 帮助菜单
        help_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="帮助", menu=help_menu)
        help_menu.add_command(label="关于", command=self._show_about)
    
    def _create_main_layout(self):
        """创建主布局"""
        # 主框架
        main_frame = ttk.Frame(self.root)
        main_frame.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)
        
        # 顶部工具栏
        toolbar = ttk.Frame(main_frame)
        toolbar.pack(fill=tk.X, pady=(0, 5))
        
        ttk.Button(toolbar, text="导入配置", command=self._import_files).pack(side=tk.LEFT, padx=2)
        ttk.Button(toolbar, text="分析冲突", command=self._run_analysis).pack(side=tk.LEFT, padx=2)
        ttk.Button(toolbar, text="生成方案", command=self._create_migration_plan).pack(side=tk.LEFT, padx=2)
        ttk.Separator(toolbar, orient=tk.VERTICAL).pack(side=tk.LEFT, fill=tk.Y, padx=10)
        
        self.session_label = ttk.Label(toolbar, text="会话: 未命名")
        self.session_label.pack(side=tk.LEFT, padx=10)
        
        # 状态标签
        self.status_label = ttk.Label(toolbar, text="就绪")
        self.status_label.pack(side=tk.RIGHT, padx=10)
        
        # 主内容区域 - PanedWindow
        main_paned = ttk.PanedWindow(main_frame, orient=tk.HORIZONTAL)
        main_paned.pack(fill=tk.BOTH, expand=True)
        
        # 左侧面板 - 应用和快捷键列表
        left_frame = ttk.Frame(main_paned)
        main_paned.add(left_frame, weight=1)
        
        # 左侧标签页
        left_notebook = ttk.Notebook(left_frame)
        left_notebook.pack(fill=tk.BOTH, expand=True)
        
        # 应用列表标签页
        apps_frame = ttk.Frame(left_notebook)
        left_notebook.add(apps_frame, text="应用列表")
        self._create_apps_list(apps_frame)
        
        # 快捷键列表标签页
        shortcuts_frame = ttk.Frame(left_notebook)
        left_notebook.add(shortcuts_frame, text="所有快捷键")
        self._create_shortcuts_list(shortcuts_frame)
        
        # 右侧面板 - 详细信息
        right_frame = ttk.Frame(main_paned)
        main_paned.add(right_frame, weight=2)
        
        # 右侧标签页
        self.right_notebook = ttk.Notebook(right_frame)
        self.right_notebook.pack(fill=tk.BOTH, expand=True)
        
        # 冲突列表标签页
        conflicts_frame = ttk.Frame(self.right_notebook)
        self.right_notebook.add(conflicts_frame, text="冲突检测")
        self._create_conflicts_tab(conflicts_frame)
        
        # 平台差异标签页
        platform_frame = ttk.Frame(self.right_notebook)
        self.right_notebook.add(platform_frame, text="平台差异")
        self._create_platform_tab(platform_frame)
        
        # 不可达组合标签页
        unreachable_frame = ttk.Frame(self.right_notebook)
        self.right_notebook.add(unreachable_frame, text="不可达组合")
        self._create_unreachable_tab(unreachable_frame)
        
        # 重复宏标签页
        duplicate_frame = ttk.Frame(self.right_notebook)
        self.right_notebook.add(duplicate_frame, text="重复宏")
        self._create_duplicate_tab(duplicate_frame)
        
        # 迁移方案标签页
        plan_frame = ttk.Frame(self.right_notebook)
        self.right_notebook.add(plan_frame, text="迁移方案")
        self._create_plan_tab(plan_frame)
        
        # 底部状态栏
        statusbar = ttk.Frame(self.root)
        statusbar.pack(fill=tk.X, side=tk.BOTTOM, padx=5, pady=2)
        
        self.shortcuts_count_label = ttk.Label(statusbar, text="快捷键: 0")
        self.shortcuts_count_label.pack(side=tk.LEFT, padx=10)
        
        self.conflicts_count_label = ttk.Label(statusbar, text="冲突: 0")
        self.conflicts_count_label.pack(side=tk.LEFT, padx=10)
        
        self.apps_count_label = ttk.Label(statusbar, text="应用: 0")
        self.apps_count_label.pack(side=tk.LEFT, padx=10)
    
    def _create_apps_list(self, parent: ttk.Frame):
        """创建应用列表"""
        # 树状视图
        columns = ("name", "type", "shortcuts")
        self.apps_tree = ttk.Treeview(parent, columns=columns, show="headings")
        self.apps_tree.heading("name", text="应用名称")
        self.apps_tree.heading("type", text="类型")
        self.apps_tree.heading("shortcuts", text="快捷键数")
        self.apps_tree.column("name", width=150)
        self.apps_tree.column("type", width=100)
        self.apps_tree.column("shortcuts", width=80)
        
        # 滚动条
        scrollbar = ttk.Scrollbar(parent, orient=tk.VERTICAL, command=self.apps_tree.yview)
        self.apps_tree.configure(yscrollcommand=scrollbar.set)
        
        self.apps_tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
        
        # 绑定选择事件
        self.apps_tree.bind("<<TreeviewSelect>>", self._on_app_selected)
    
    def _create_shortcuts_list(self, parent: ttk.Frame):
        """创建快捷键列表"""
        # 搜索框
        search_frame = ttk.Frame(parent)
        search_frame.pack(fill=tk.X, pady=2)
        
        ttk.Label(search_frame, text="搜索:").pack(side=tk.LEFT, padx=2)
        self.shortcut_search_var = tk.StringVar()
        self.shortcut_search_var.trace("w", self._filter_shortcuts)
        ttk.Entry(search_frame, textvariable=self.shortcut_search_var).pack(side=tk.LEFT, fill=tk.X, expand=True, padx=2)
        
        # 树状视图
        columns = ("key", "command", "app", "platform")
        self.shortcuts_tree = ttk.Treeview(parent, columns=columns, show="headings")
        self.shortcuts_tree.heading("key", text="快捷键")
        self.shortcuts_tree.heading("command", text="命令")
        self.shortcuts_tree.heading("app", text="应用")
        self.shortcuts_tree.heading("platform", text="平台")
        self.shortcuts_tree.column("key", width=120)
        self.shortcuts_tree.column("command", width=200)
        self.shortcuts_tree.column("app", width=100)
        self.shortcuts_tree.column("platform", width=60)
        
        # 滚动条
        scrollbar = ttk.Scrollbar(parent, orient=tk.VERTICAL, command=self.shortcuts_tree.yview)
        self.shortcuts_tree.configure(yscrollcommand=scrollbar.set)
        
        self.shortcuts_tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
    
    def _create_conflicts_tab(self, parent: ttk.Frame):
        """创建冲突检测标签页"""
        # 工具栏
        toolbar = ttk.Frame(parent)
        toolbar.pack(fill=tk.X, pady=2)
        
        ttk.Button(toolbar, text="刷新", command=self._refresh_conflicts).pack(side=tk.LEFT, padx=2)
        ttk.Button(toolbar, text="查看详情", command=self._show_conflict_detail).pack(side=tk.LEFT, padx=2)
        
        # 树状视图
        columns = ("key", "type", "severity", "apps", "commands")
        self.conflicts_tree = ttk.Treeview(parent, columns=columns, show="headings")
        self.conflicts_tree.heading("key", text="快捷键")
        self.conflicts_tree.heading("type", text="冲突类型")
        self.conflicts_tree.heading("severity", text="严重程度")
        self.conflicts_tree.heading("apps", text="涉及应用")
        self.conflicts_tree.heading("commands", text="命令")
        self.conflicts_tree.column("key", width=120)
        self.conflicts_tree.column("type", width=120)
        self.conflicts_tree.column("severity", width=80)
        self.conflicts_tree.column("apps", width=150)
        self.conflicts_tree.column("commands", width=250)
        
        # 滚动条
        scrollbar = ttk.Scrollbar(parent, orient=tk.VERTICAL, command=self.conflicts_tree.yview)
        self.conflicts_tree.configure(yscrollcommand=scrollbar.set)
        
        self.conflicts_tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
    
    def _create_platform_tab(self, parent: ttk.Frame):
        """创建平台差异标签页"""
        columns = ("key", "command", "issue", "mac_key", "win_key")
        self.platform_tree = ttk.Treeview(parent, columns=columns, show="headings")
        self.platform_tree.heading("key", text="快捷键")
        self.platform_tree.heading("command", text="命令")
        self.platform_tree.heading("issue", text="问题类型")
        self.platform_tree.heading("mac_key", text="Mac绑定")
        self.platform_tree.heading("win_key", text="Windows绑定")
        self.platform_tree.column("key", width=120)
        self.platform_tree.column("command", width=200)
        self.platform_tree.column("issue", width=120)
        self.platform_tree.column("mac_key", width=120)
        self.platform_tree.column("win_key", width=120)
        
        scrollbar = ttk.Scrollbar(parent, orient=tk.VERTICAL, command=self.platform_tree.yview)
        self.platform_tree.configure(yscrollcommand=scrollbar.set)
        
        self.platform_tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
    
    def _create_unreachable_tab(self, parent: ttk.Frame):
        """创建不可达组合标签页"""
        columns = ("key", "command", "app", "reason")
        self.unreachable_tree = ttk.Treeview(parent, columns=columns, show="headings")
        self.unreachable_tree.heading("key", text="快捷键")
        self.unreachable_tree.heading("command", text="命令")
        self.unreachable_tree.heading("app", text="应用")
        self.unreachable_tree.heading("reason", text="原因")
        self.unreachable_tree.column("key", width=120)
        self.unreachable_tree.column("command", width=200)
        self.unreachable_tree.column("app", width=100)
        self.unreachable_tree.column("reason", width=300)
        
        scrollbar = ttk.Scrollbar(parent, orient=tk.VERTICAL, command=self.unreachable_tree.yview)
        self.unreachable_tree.configure(yscrollcommand=scrollbar.set)
        
        self.unreachable_tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
    
    def _create_duplicate_tab(self, parent: ttk.Frame):
        """创建重复宏标签页"""
        columns = ("macro_id", "type", "shortcuts", "similarity")
        self.duplicate_tree = ttk.Treeview(parent, columns=columns, show="headings")
        self.duplicate_tree.heading("macro_id", text="宏ID")
        self.duplicate_tree.heading("type", text="类型")
        self.duplicate_tree.heading("shortcuts", text="涉及快捷键")
        self.duplicate_tree.heading("similarity", text="相似度")
        self.duplicate_tree.column("macro_id", width=100)
        self.duplicate_tree.column("type", width=100)
        self.duplicate_tree.column("shortcuts", width=300)
        self.duplicate_tree.column("similarity", width=80)
        
        scrollbar = ttk.Scrollbar(parent, orient=tk.VERTICAL, command=self.duplicate_tree.yview)
        self.duplicate_tree.configure(yscrollcommand=scrollbar.set)
        
        self.duplicate_tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
    
    def _create_plan_tab(self, parent: ttk.Frame):
        """创建迁移方案标签页"""
        # 工具栏
        toolbar = ttk.Frame(parent)
        toolbar.pack(fill=tk.X, pady=2)
        
        ttk.Button(toolbar, text="创建新方案", command=self._create_migration_plan).pack(side=tk.LEFT, padx=2)
        ttk.Button(toolbar, text="生成建议", command=self._generate_suggestions).pack(side=tk.LEFT, padx=2)
        ttk.Separator(toolbar, orient=tk.VERTICAL).pack(side=tk.LEFT, fill=tk.Y, padx=10)
        
        # 目标平台选择
        ttk.Label(toolbar, text="目标平台:").pack(side=tk.LEFT, padx=2)
        self.target_platform_var = tk.StringVar(value="all")
        platform_combo = ttk.Combobox(toolbar, textvariable=self.target_platform_var, width=10, state="readonly")
        platform_combo['values'] = ("all", "mac", "windows")
        platform_combo.pack(side=tk.LEFT, padx=2)
        
        # 改键映射表格
        columns = ("original", "new", "command", "app", "reason")
        self.plan_tree = ttk.Treeview(parent, columns=columns, show="headings")
        self.plan_tree.heading("original", text="原快捷键")
        self.plan_tree.heading("new", text="新快捷键")
        self.plan_tree.heading("command", text="命令")
        self.plan_tree.heading("app", text="应用")
        self.plan_tree.heading("reason", text="原因")
        self.plan_tree.column("original", width=120)
        self.plan_tree.column("new", width=120)
        self.plan_tree.column("command", width=200)
        self.plan_tree.column("app", width=100)
        self.plan_tree.column("reason", width=200)
        
        scrollbar = ttk.Scrollbar(parent, orient=tk.VERTICAL, command=self.plan_tree.yview)
        self.plan_tree.configure(yscrollcommand=scrollbar.set)
        
        self.plan_tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
    
    def _new_session(self):
        """新建会话"""
        if self.current_session:
            # 询问是否保存当前会话
            if messagebox.askyesno("保存会话", "是否保存当前会话？"):
                self._save_session()
        
        # 创建新会话
        self.current_session = Session()
        self.current_session.session_name = "未命名会话"
        self.analysis_result = None
        self.current_plan = None
        
        # 清空列表
        self._clear_all_lists()
        self._update_status("新建会话已创建")
    
    def _open_session(self):
        """打开会话"""
        sessions = self.storage.list_sessions()
        
        if not sessions:
            messagebox.showinfo("提示", "没有保存的会话")
            return
        
        # 选择文件
        file_path = filedialog.askopenfilename(
            title="选择会话文件",
            filetypes=[("JSON文件", "*.json"), ("所有文件", "*.*")]
        )
        
        if not file_path:
            return
        
        # 尝试导入会话
        session_id = self.storage.import_session(file_path)
        if session_id:
            session = self.storage.load_session(session_id)
            if session:
                self.current_session = session
                self._refresh_from_session()
                self._update_status(f"已加载会话: {session.session_name}")
                return
        
        messagebox.showerror("错误", "无法加载会话文件")
    
    def _save_session(self):
        """保存会话"""
        if not self.current_session:
            self.current_session = Session()
            self.current_session.session_name = "未命名会话"
        
        # 同步数据到会话
        self._sync_to_session()
        
        # 保存
        self.storage.save_session(self.current_session)
        self._update_status("会话已保存")
    
    def _save_session_as(self):
        """会话另存为"""
        if not self.current_session:
            messagebox.showwarning("警告", "没有可保存的会话")
            return
        
        # 选择保存路径
        file_path = filedialog.asksaveasfilename(
            title="保存会话",
            defaultextension=".json",
            filetypes=[("JSON文件", "*.json")]
        )
        
        if not file_path:
            return
        
        # 同步数据
        self._sync_to_session()
        
        # 导出会话
        self.storage.export_session(self.current_session.session_id, file_path)
        self._update_status(f"会话已保存到: {file_path}")
    
    def _import_files(self):
        """导入快捷键配置文件"""
        file_paths = filedialog.askopenfilenames(
            title="选择快捷键配置文件",
            filetypes=[
                ("所有支持的格式", "*.json *.csv *.kys *.txt"),
                ("JSON文件", "*.json"),
                ("CSV文件", "*.csv"),
                ("所有文件", "*.*")
            ]
        )
        
        if not file_paths:
            return
        
        # 确保有会话
        if not self.current_session:
            self.current_session = Session()
            self.current_session.session_name = "未命名会话"
        
        # 导入每个文件
        imported_count = 0
        for file_path in file_paths:
            try:
                self._import_single_file(file_path)
                imported_count += 1
            except Exception as e:
                messagebox.showerror("导入错误", f"导入 {file_path} 失败: {e}")
        
        if imported_count > 0:
            self._refresh_from_session()
            self._update_status(f"成功导入 {imported_count} 个文件")
            
            # 自动分析
            if messagebox.askyesno("分析", "是否立即分析冲突？"):
                self._run_analysis()
    
    def _import_single_file(self, file_path: str):
        """导入单个文件"""
        # 确定文件类型和应用
        path = Path(file_path)
        suffix = path.suffix.lower()
        
        # 尝试解析
        result = self.parser_factory.parse_file(file_path)
        
        if not result.success:
            raise ValueError(result.error_message or "解析失败")
        
        # 添加到会话
        app_id = f"app_{len(self.current_session.applications) + 1}"
        app = Application(
            id=app_id,
            name=result.application_name or path.stem,
            app_type=result.application_type,
        )
        
        self.current_session.applications.append(app.to_dict())
        
        # 添加上下文和快捷键
        for shortcut in result.shortcuts:
            shortcut_id = f"sc_{len(self.current_session.shortcuts) + 1}"
            shortcut_dict = shortcut.to_dict()
            shortcut_dict["id"] = shortcut_id
            shortcut_dict["application_id"] = app_id
            self.current_session.shortcuts.append(shortcut_dict)
        
        # 记录导入的文件
        self.current_session.imported_files.append(str(file_path))
    
    def _run_analysis(self):
        """运行分析"""
        if not self.current_session or not self.current_session.shortcuts:
            messagebox.showwarning("警告", "没有可分析的快捷键")
            return
        
        self._update_status("正在分析...")
        self.root.update()
        
        try:
            # 转换为模型对象
            shortcuts = []
            for shortcut_dict in self.current_session.shortcuts:
                shortcut = Shortcut(
                    key=ShortcutKey(shortcut_dict.get("key", "")),
                    command=shortcut_dict.get("command", ""),
                    application_id=shortcut_dict.get("application_id", ""),
                    context_id=shortcut_dict.get("context_id", ""),
                    platform=shortcut_dict.get("platform", "all"),
                )
                shortcuts.append(shortcut)
            
            # 运行分析
            analysis = self.rule_engine.analyze(shortcuts)
            
            # 转换为字典存储
            self.analysis_result = {
                "conflicts": [c.to_dict() for c in analysis.conflicts],
                "platform_differences": [p.to_dict() for p in analysis.platform_differences],
                "unreachable_shortcuts": [u.to_dict() for u in analysis.unreachable_shortcuts],
                "duplicate_macros": [d.to_dict() for d in analysis.duplicate_macros],
                "summary": analysis.summary,
            }
            
            # 保存到会话
            self.current_session.analysis_result = self.analysis_result
            
            # 刷新显示
            self._refresh_analysis_results()
            self._update_counts()
            
            # 显示结果
            total_issues = (
                len(self.analysis_result["conflicts"]) +
                len(self.analysis_result["platform_differences"]) +
                len(self.analysis_result["unreachable_shortcuts"]) +
                len(self.analysis_result["duplicate_macros"])
            )
            
            if total_issues > 0:
                messagebox.showinfo("分析完成", f"发现 {total_issues} 个问题")
            else:
                messagebox.showinfo("分析完成", "未发现问题")
            
            self._update_status("分析完成")
            
        except Exception as e:
            messagebox.showerror("分析错误", f"分析失败: {e}")
            self._update_status("分析失败")
    
    def _create_migration_plan(self):
        """创建迁移方案"""
        if not self.analysis_result:
            messagebox.showwarning("警告", "请先运行分析")
            return
        
        if not self.current_session:
            return
        
        # 创建迁移方案
        self.current_plan = MigrationPlan()
        self.current_plan.plan_id = f"plan_{int(datetime.now().timestamp())}"
        self.current_plan.plan_name = "迁移方案"
        self.current_plan.target_platform = self.target_platform_var.get()
        self.current_plan.total_shortcuts = len(self.current_session.shortcuts)
        
        # 添加到会话
        self.current_session.migration_plans.append(self.current_plan.to_dict())
        self.current_session.active_plan_id = self.current_plan.plan_id
        
        # 刷新显示
        self._refresh_plan()
        self._update_status("迁移方案已创建")
    
    def _generate_suggestions(self):
        """生成改键建议"""
        if not self.analysis_result or not self.current_session:
            messagebox.showwarning("警告", "需要先分析并创建迁移方案")
            return
        
        if not self.current_plan:
            self._create_migration_plan()
        
        self._update_status("正在生成建议...")
        self.root.update()
        
        # 收集已使用的键
        used_keys = set()
        for shortcut_dict in self.current_session.shortcuts:
            key = shortcut_dict.get("key", "")
            if key:
                used_keys.add(key)
        
        # 为每个冲突生成建议
        suggestions_count = 0
        for conflict in self.analysis_result.get("conflicts", []):
            key = conflict.get("key", "")
            if not key:
                continue
            
            # 获取涉及的快捷键ID
            affected = conflict.get("affected_shortcuts", [])
            if not affected:
                continue
            
            shortcut_id = affected[0]
            
            # 生成建议
            shortcut_key = ShortcutKey(key)
            suggestions = self.key_suggester.suggest(
                shortcut_key,
                used_keys=used_keys,
                target_platform=self.target_platform_var.get(),
            )
            
            if suggestions:
                # 选择第一个建议
                best = suggestions[0]
                self.current_plan.add_mapping(
                    original_key=key,
                    new_key=str(best.new_key),
                    shortcut_id=shortcut_id,
                    reason=f"冲突改键: {best.reason}",
                )
                suggestions_count += 1
        
        # 为不可达组合生成建议
        for item in self.analysis_result.get("unreachable_shortcuts", []):
            shortcut_id = item.get("shortcut_id", "")
            
            # 查找快捷键
            shortcut = None
            for s in self.current_session.shortcuts:
                if s.get("id") == shortcut_id:
                    shortcut = s
                    break
            
            if not shortcut:
                continue
            
            key = shortcut.get("key", "")
            if not key:
                continue
            
            # 生成建议
            shortcut_key = ShortcutKey(key)
            suggestions = self.key_suggester.suggest(
                shortcut_key,
                used_keys=used_keys,
                target_platform=self.target_platform_var.get(),
            )
            
            if suggestions:
                best = suggestions[0]
                self.current_plan.add_mapping(
                    original_key=key,
                    new_key=str(best.new_key),
                    shortcut_id=shortcut_id,
                    reason=f"不可达改键: {best.reason}",
                )
                suggestions_count += 1
        
        # 刷新
        self.current_plan.calculate_stats()
        self._refresh_plan()
        self._update_status(f"已生成 {suggestions_count} 个改键建议")
    
    def _export_markdown(self):
        """导出Markdown"""
        if not self.current_session:
            messagebox.showwarning("警告", "没有可导出的数据")
            return
        
        file_path = filedialog.asksaveasfilename(
            title="导出 Markdown",
            defaultextension=".md",
            filetypes=[("Markdown文件", "*.md")]
        )
        
        if not file_path:
            return
        
        try:
            exporter = MarkdownExporter()
            exporter.export(
                session=self.current_session,
                analysis_result=self.analysis_result,
                migration_plan=self.current_plan,
                export_path=file_path,
            )
            messagebox.showinfo("成功", f"已导出到: {file_path}")
            self._update_status(f"Markdown已导出: {file_path}")
        except Exception as e:
            messagebox.showerror("错误", f"导出失败: {e}")
    
    def _export_csv(self):
        """导出CSV"""
        if not self.current_session:
            messagebox.showwarning("警告", "没有可导出的数据")
            return
        
        # 选择导出类型
        options = ["冲突表", "快捷键列表", "迁移方案"]
        choice = self._ask_choice("选择导出类型", "请选择要导出的内容:", options)
        
        if choice is None:
            return
        
        file_path = filedialog.asksaveasfilename(
            title="导出 CSV",
            defaultextension=".csv",
            filetypes=[("CSV文件", "*.csv")]
        )
        
        if not file_path:
            return
        
        try:
            exporter = CSVExporter()
            
            if choice == "冲突表":
                exporter.export_conflicts(
                    session=self.current_session,
                    analysis_result=self.analysis_result,
                    export_path=file_path,
                )
            elif choice == "快捷键列表":
                exporter.export_shortcuts(
                    session=self.current_session,
                    export_path=file_path,
                )
            elif choice == "迁移方案" and self.current_plan:
                exporter.export_migration_plan(
                    session=self.current_session,
                    migration_plan=self.current_plan,
                    export_path=file_path,
                )
            
            messagebox.showinfo("成功", f"已导出到: {file_path}")
            self._update_status(f"CSV已导出: {file_path}")
        except Exception as e:
            messagebox.showerror("错误", f"导出失败: {e}")
    
    def _export_json(self):
        """导出JSON审计包"""
        if not self.current_session:
            messagebox.showwarning("警告", "没有可导出的数据")
            return
        
        file_path = filedialog.asksaveasfilename(
            title="导出 JSON 审计包",
            defaultextension=".json",
            filetypes=[("JSON文件", "*.json")]
        )
        
        if not file_path:
            return
        
        try:
            exporter = JSONExporter()
            exporter.export_audit(
                session=self.current_session,
                analysis_result=self.analysis_result,
                migration_plan=self.current_plan,
                export_path=file_path,
            )
            messagebox.showinfo("成功", f"已导出到: {file_path}")
            self._update_status(f"JSON审计包已导出: {file_path}")
        except Exception as e:
            messagebox.showerror("错误", f"导出失败: {e}")
    
    def _ask_choice(self, title: str, message: str, options: List[str]) -> Optional[str]:
        """询问选择"""
        dialog = tk.Toplevel(self.root)
        dialog.title(title)
        dialog.transient(self.root)
        dialog.grab_set()
        
        result = [None]
        
        ttk.Label(dialog, text=message).pack(padx=20, pady=10)
        
        listbox = tk.Listbox(dialog, selectmode=tk.SINGLE, height=len(options))
        for option in options:
            listbox.insert(tk.END, option)
        listbox.pack(padx=20, pady=5, fill=tk.X)
        listbox.selection_set(0)
        
        def on_ok():
            selection = listbox.curselection()
            if selection:
                result[0] = options[selection[0]]
            dialog.destroy()
        
        def on_cancel():
            dialog.destroy()
        
        btn_frame = ttk.Frame(dialog)
        btn_frame.pack(pady=10)
        
        ttk.Button(btn_frame, text="确定", command=on_ok).pack(side=tk.LEFT, padx=5)
        ttk.Button(btn_frame, text="取消", command=on_cancel).pack(side=tk.LEFT, padx=5)
        
        dialog.wait_window()
        return result[0]
    
    def _show_sessions(self):
        """显示会话列表"""
        sessions = self.storage.list_sessions()
        
        if not sessions:
            messagebox.showinfo("提示", "没有保存的会话")
            return
        
        # 创建选择对话框
        dialog = tk.Toplevel(self.root)
        dialog.title("会话列表")
        dialog.transient(self.root)
        dialog.grab_set()
        
        columns = ("name", "created", "shortcuts", "apps")
        tree = ttk.Treeview(dialog, columns=columns, show="headings")
        tree.heading("name", text="会话名称")
        tree.heading("created", text="创建时间")
        tree.heading("shortcuts", text="快捷键数")
        tree.heading("apps", text="应用数")
        tree.column("name", width=200)
        tree.column("created", width=150)
        tree.column("shortcuts", width=80)
        tree.column("apps", width=80)
        
        for sess in sessions:
            created = datetime.fromtimestamp(sess.get("created_time", 0)).strftime("%Y-%m-%d %H:%M")
            tree.insert("", tk.END, values=(
                sess.get("session_name", "未命名"),
                created,
                sess.get("total_shortcuts", 0),
                sess.get("total_applications", 0),
            ), iid=sess.get("session_id", ""))
        
        tree.pack(padx=10, pady=10, fill=tk.BOTH, expand=True)
        
        def on_load():
            selection = tree.selection()
            if not selection:
                return
            
            session_id = selection[0]
            session = self.storage.load_session(session_id)
            
            if session:
                self.current_session = session
                self._refresh_from_session()
                dialog.destroy()
                self._update_status(f"已加载: {session.session_name}")
        
        def on_delete():
            selection = tree.selection()
            if not selection:
                return
            
            session_id = selection[0]
            if messagebox.askyesno("确认", "确定要删除这个会话吗？"):
                self.storage.delete_session(session_id)
                tree.delete(session_id)
        
        btn_frame = ttk.Frame(dialog)
        btn_frame.pack(pady=10)
        
        ttk.Button(btn_frame, text="加载", command=on_load).pack(side=tk.LEFT, padx=5)
        ttk.Button(btn_frame, text="删除", command=on_delete).pack(side=tk.LEFT, padx=5)
        ttk.Button(btn_frame, text="关闭", command=dialog.destroy).pack(side=tk.LEFT, padx=5)
    
    def _show_about(self):
        """显示关于"""
        messagebox.showinfo(
            "关于快捷键冲突搬家员",
            "快捷键冲突搬家员 v1.0\n\n"
            "帮助设计团队迁移快捷键配置的工具\n\n"
            "支持: VS Code, Figma, Photoshop, 浏览器插件"
        )
    
    def _show_conflict_detail(self):
        """显示冲突详情"""
        selection = self.conflicts_tree.selection()
        if not selection:
            messagebox.showinfo("提示", "请先选择一个冲突")
            return
        
        item_id = selection[0]
        values = self.conflicts_tree.item(item_id, "values")
        
        if not values:
            return
        
        key = values[0]
        
        # 查找冲突详情
        conflict = None
        for c in self.analysis_result.get("conflicts", []):
            if c.get("key") == key:
                conflict = c
                break
        
        if not conflict:
            return
        
        # 显示详情
        dialog = tk.Toplevel(self.root)
        dialog.title(f"冲突详情: {key}")
        dialog.transient(self.root)
        dialog.geometry("500x400")
        
        text = scrolledtext.ScrolledText(dialog, wrap=tk.WORD)
        text.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)
        
        text.insert(tk.END, f"快捷键: {key}\n\n")
        text.insert(tk.END, f"冲突类型: {conflict.get('conflict_type', '未知')}\n")
        text.insert(tk.END, f"严重程度: {conflict.get('severity', '未知')}\n\n")
        text.insert(tk.END, f"描述: {conflict.get('description', '无')}\n\n")
        
        text.insert(tk.END, "涉及的快捷键:\n")
        text.insert(tk.END, "-" * 50 + "\n")
        
        for shortcut_id in conflict.get("affected_shortcuts", []):
            for s in self.current_session.shortcuts:
                if s.get("id") == shortcut_id:
                    app = "未知应用"
                    for a in self.current_session.applications:
                        if a.get("id") == s.get("application_id"):
                            app = a.get("name", "未知")
                            break
                    
                    text.insert(tk.END, f"  应用: {app}\n")
                    text.insert(tk.END, f"  快捷键: {s.get('key', '未知')}\n")
                    text.insert(tk.END, f"  命令: {s.get('command', '未知')}\n")
                    text.insert(tk.END, "\n")
        
        text.config(state=tk.DISABLED)
    
    def _try_load_autosave(self):
        """尝试加载自动保存的会话"""
        session = self.storage.load_auto_save()
        if session and session.shortcuts:
            self.current_session = session
            self.analysis_result = session.analysis_result
            self._refresh_from_session()
            self._update_status("已恢复上次会话")
    
    def _refresh_from_session(self):
        """从会话刷新显示"""
        self._clear_all_lists()
        
        if not self.current_session:
            return
        
        # 更新会话名称
        self.session_label.config(text=f"会话: {self.current_session.session_name}")
        
        # 刷新应用列表
        for app_dict in self.current_session.applications:
            shortcut_count = sum(
                1 for s in self.current_session.shortcuts
                if s.get("application_id") == app_dict.get("id")
            )
            
            self.apps_tree.insert("", tk.END, values=(
                app_dict.get("name", "未知"),
                self._format_app_type(app_dict.get("app_type", "unknown")),
                shortcut_count,
            ), iid=app_dict.get("id", ""))
        
        # 刷新快捷键列表
        self._refresh_shortcuts_list()
        
        # 刷新分析结果
        if self.analysis_result:
            self._refresh_analysis_results()
        
        # 刷新迁移方案
        if self.current_session.migration_plans:
            # 加载第一个方案
            plan_dict = self.current_session.migration_plans[0]
            self.current_plan = MigrationPlan.from_dict(plan_dict)
            self._refresh_plan()
        
        # 更新计数
        self._update_counts()
    
    def _refresh_shortcuts_list(self):
        """刷新快捷键列表"""
        # 清空
        for item in self.shortcuts_tree.get_children():
            self.shortcuts_tree.delete(item)
        
        if not self.current_session:
            return
        
        # 构建应用ID到名称的映射
        app_names = {a.get("id"): a.get("name", "未知") for a in self.current_session.applications}
        
        # 添加所有快捷键
        for shortcut_dict in self.current_session.shortcuts:
            app_id = shortcut_dict.get("application_id", "")
            app_name = app_names.get(app_id, "未知")
            
            self.shortcuts_tree.insert("", tk.END, values=(
                shortcut_dict.get("key", ""),
                shortcut_dict.get("command", ""),
                app_name,
                shortcut_dict.get("platform", "all"),
            ))
    
    def _refresh_analysis_results(self):
        """刷新分析结果"""
        if not self.analysis_result:
            return
        
        # 刷新冲突列表
        for item in self.conflicts_tree.get_children():
            self.conflicts_tree.delete(item)
        
        for conflict in self.analysis_result.get("conflicts", []):
            # 收集涉及的应用和命令
            apps = set()
            commands = []
            
            for shortcut_id in conflict.get("affected_shortcuts", []):
                for s in self.current_session.shortcuts:
                    if s.get("id") == shortcut_id:
                        app_id = s.get("application_id", "")
                        for a in self.current_session.applications:
                            if a.get("id") == app_id:
                                apps.add(a.get("name", "未知"))
                                break
                        commands.append(s.get("command", "未知"))
            
            self.conflicts_tree.insert("", tk.END, values=(
                conflict.get("key", ""),
                self._format_conflict_type(conflict.get("conflict_type", "unknown")),
                self._format_severity(conflict.get("severity", "medium")),
                ", ".join(apps),
                "; ".join(commands[:3]) + ("..." if len(commands) > 3 else ""),
            ))
        
        # 刷新平台差异
        for item in self.platform_tree.get_children():
            self.platform_tree.delete(item)
        
        app_names = {a.get("id"): a.get("name", "未知") for a in self.current_session.applications}
        
        for diff in self.analysis_result.get("platform_differences", []):
            shortcut_id = diff.get("shortcut_id", "")
            shortcut = None
            for s in self.current_session.shortcuts:
                if s.get("id") == shortcut_id:
                    shortcut = s
                    break
            
            if shortcut:
                self.platform_tree.insert("", tk.END, values=(
                    shortcut.get("key", ""),
                    shortcut.get("command", ""),
                    self._format_platform_issue(diff.get("issue_type", "unknown")),
                    diff.get("mac_key", ""),
                    diff.get("win_key", ""),
                ))
        
        # 刷新不可达组合
        for item in self.unreachable_tree.get_children():
            self.unreachable_tree.delete(item)
        
        for item in self.analysis_result.get("unreachable_shortcuts", []):
            shortcut_id = item.get("shortcut_id", "")
            shortcut = None
            for s in self.current_session.shortcuts:
                if s.get("id") == shortcut_id:
                    shortcut = s
                    break
            
            if shortcut:
                app_name = "未知"
                app_id = shortcut.get("application_id", "")
                for a in self.current_session.applications:
                    if a.get("id") == app_id:
                        app_name = a.get("name", "未知")
                        break
                
                self.unreachable_tree.insert("", tk.END, values=(
                    shortcut.get("key", ""),
                    shortcut.get("command", ""),
                    app_name,
                    item.get("reason", ""),
                ))
        
        # 刷新重复宏
        for item in self.duplicate_tree.get_children():
            self.duplicate_tree.delete(item)
        
        for item in self.analysis_result.get("duplicate_macros", []):
            keys = []
            for shortcut_id in item.get("shortcuts", []):
                for s in self.current_session.shortcuts:
                    if s.get("id") == shortcut_id:
                        keys.append(s.get("key", ""))
                        break
            
            is_exact = item.get("is_exact", False)
            similarity = item.get("similarity", 0)
            
            self.duplicate_tree.insert("", tk.END, values=(
                item.get("macro_id", ""),
                "完全相同" if is_exact else "相似",
                ", ".join(keys),
                f"{similarity*100:.0f}%" if not is_exact else "100%",
            ))
    
    def _refresh_plan(self):
        """刷新迁移方案"""
        for item in self.plan_tree.get_children():
            self.plan_tree.delete(item)
        
        if not self.current_plan:
            return
        
        # 构建应用ID到名称的映射
        app_names = {a.get("id"): a.get("name", "未知") for a in self.current_session.applications}
        
        # 添加改键映射
        for original_key, mapping in self.current_plan.key_mappings.items():
            new_key = mapping.get("new_key", "")
            shortcut_id = mapping.get("shortcut_id", "")
            reason = mapping.get("reason", "")
            
            # 查找快捷键
            command = "未知"
            app_name = "未知"
            
            for s in self.current_session.shortcuts:
                if s.get("id") == shortcut_id:
                    command = s.get("command", "未知")
                    app_id = s.get("application_id", "")
                    app_name = app_names.get(app_id, "未知")
                    break
            
            self.plan_tree.insert("", tk.END, values=(
                original_key,
                new_key,
                command,
                app_name,
                reason,
            ))
    
    def _clear_all_lists(self):
        """清空所有列表"""
        for item in self.apps_tree.get_children():
            self.apps_tree.delete(item)
        
        for item in self.shortcuts_tree.get_children():
            self.shortcuts_tree.delete(item)
        
        for item in self.conflicts_tree.get_children():
            self.conflicts_tree.delete(item)
        
        for item in self.platform_tree.get_children():
            self.platform_tree.delete(item)
        
        for item in self.unreachable_tree.get_children():
            self.unreachable_tree.delete(item)
        
        for item in self.duplicate_tree.get_children():
            self.duplicate_tree.delete(item)
        
        for item in self.plan_tree.get_children():
            self.plan_tree.delete(item)
    
    def _update_counts(self):
        """更新计数标签"""
        if self.current_session:
            self.shortcuts_count_label.config(
                text=f"快捷键: {len(self.current_session.shortcuts)}"
            )
            self.apps_count_label.config(
                text=f"应用: {len(self.current_session.applications)}"
            )
        
        if self.analysis_result:
            total = (
                len(self.analysis_result.get("conflicts", [])) +
                len(self.analysis_result.get("platform_differences", [])) +
                len(self.analysis_result.get("unreachable_shortcuts", [])) +
                len(self.analysis_result.get("duplicate_macros", []))
            )
            self.conflicts_count_label.config(text=f"问题: {total}")
        else:
            self.conflicts_count_label.config(text="问题: 0")
    
    def _sync_to_session(self):
        """同步数据到会话"""
        if not self.current_session:
            return
        
        # 保存分析结果
        if self.analysis_result:
            self.current_session.analysis_result = self.analysis_result
        
        # 保存迁移方案
        if self.current_plan:
            # 查找并更新
            found = False
            for i, plan_dict in enumerate(self.current_session.migration_plans):
                if plan_dict.get("plan_id") == self.current_plan.plan_id:
                    self.current_session.migration_plans[i] = self.current_plan.to_dict()
                    found = True
                    break
            
            if not found:
                self.current_session.migration_plans.append(self.current_plan.to_dict())
    
    def _update_status(self, message: str):
        """更新状态"""
        self.status_label.config(text=message)
        
        # 自动保存
        if self.current_session:
            self.storage.auto_save(self.current_session)
    
    def _filter_shortcuts(self, *args):
        """过滤快捷键"""
        search_text = self.shortcut_search_var.get().lower()
        
        # 清空
        for item in self.shortcuts_tree.get_children():
            self.shortcuts_tree.delete(item)
        
        if not self.current_session:
            return
        
        app_names = {a.get("id"): a.get("name", "未知") for a in self.current_session.applications}
        
        for shortcut_dict in self.current_session.shortcuts:
            key = shortcut_dict.get("key", "").lower()
            command = shortcut_dict.get("command", "").lower()
            
            if search_text in key or search_text in command:
                app_id = shortcut_dict.get("application_id", "")
                app_name = app_names.get(app_id, "未知")
                
                self.shortcuts_tree.insert("", tk.END, values=(
                    shortcut_dict.get("key", ""),
                    shortcut_dict.get("command", ""),
                    app_name,
                    shortcut_dict.get("platform", "all"),
                ))
    
    def _refresh_conflicts(self):
        """刷新冲突"""
        if self.analysis_result:
            self._refresh_analysis_results()
    
    def _on_app_selected(self, event):
        """应用被选中"""
        selection = self.apps_tree.selection()
        if not selection:
            return
        
        app_id = selection[0]
        
        # 过滤快捷键列表
        self.shortcut_search_var.set("")
        
        for item in self.shortcuts_tree.get_children():
            self.shortcuts_tree.delete(item)
        
        app_names = {a.get("id"): a.get("name", "未知") for a in self.current_session.applications}
        
        for shortcut_dict in self.current_session.shortcuts:
            if shortcut_dict.get("application_id") == app_id:
                app_name = app_names.get(app_id, "未知")
                
                self.shortcuts_tree.insert("", tk.END, values=(
                    shortcut_dict.get("key", ""),
                    shortcut_dict.get("command", ""),
                    app_name,
                    shortcut_dict.get("platform", "all"),
                ))
    
    def _format_app_type(self, app_type: str) -> str:
        """格式化应用类型"""
        names = {
            "vscode": "VS Code",
            "figma": "Figma",
            "photoshop": "Photoshop",
            "browser_plugin": "浏览器插件",
            "unknown": "未知",
        }
        return names.get(app_type, app_type)
    
    def _format_severity(self, severity: str) -> str:
        """格式化严重程度"""
        names = {
            "critical": "致命",
            "high": "高",
            "medium": "中",
            "low": "低",
            "info": "信息",
        }
        return names.get(severity, severity)
    
    def _format_conflict_type(self, conflict_type: str) -> str:
        """格式化冲突类型"""
        names = {
            "same_key": "同一组合键",
            "system_reserved": "系统保留",
            "user_reserved": "用户保留",
            "partial_match": "部分匹配",
        }
        return names.get(conflict_type, conflict_type)
    
    def _format_platform_issue(self, issue_type: str) -> str:
        """格式化平台问题"""
        names = {
            "platform_specific": "平台特定",
            "modifier_mapping_issue": "修饰键映射",
            "platform_exclusive_key": "平台独有",
            "cross_platform_binding": "跨平台差异",
        }
        return names.get(issue_type, issue_type)


def main():
    """主函数"""
    root = tk.Tk()
    
    # 设置样式
    style = ttk.Style()
    try:
        style.theme_use('clam')
    except Exception:
        pass
    
    app = ShortcutMigratorApp(root)
    root.mainloop()


if __name__ == "__main__":
    main()
