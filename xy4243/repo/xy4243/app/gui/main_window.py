import tkinter as tk
from tkinter import ttk, filedialog, messagebox, simpledialog
from pathlib import Path
from typing import List, Dict, Any, Optional, Type
from datetime import datetime

from app.storage import StoreManager, StoreStats
from app.io import ImportManager, ImportResult, MarkdownExporter, CSVViolationExporter
from app.rules import RulesEngine, RulesEngineConfig, RulesEngineResult
from app.models import (
    Prop, Scene, HandoverRecord, Violation,
    HandoverStatus, DangerLevel, CheckStatus
)
from .styles import AppStyles


class MainWindow:

    def __init__(self, root: tk.Tk, store_manager: Optional[StoreManager] = None):
        self.root = root
        self.store = store_manager or StoreManager()
        self.import_manager = ImportManager()
        self.rules_engine = RulesEngine()

        self._setup_window()
        self._create_menu()
        self._create_main_layout()
        self._refresh_data()

    def _setup_window(self):
        self.root.title("道具交接节拍器 - 剧场舞台监督工具")
        self.root.geometry("1200x800")
        self.root.minsize(900, 600)

        AppStyles.configure_ttk_styles()

        self.root.columnconfigure(0, weight=1)
        self.root.rowconfigure(0, weight=1)

    def _create_menu(self):
        menubar = tk.Menu(self.root)
        self.root.config(menu=menubar)

        file_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="文件", menu=file_menu)
        file_menu.add_command(label="导入道具表", command=self._import_props)
        file_menu.add_command(label="导入场次表", command=self._import_scenes)
        file_menu.add_command(label="导入演员上下场表", command=self._import_handovers)
        file_menu.add_separator()
        file_menu.add_command(label="导出 Markdown 场务提示单", command=self._export_markdown)
        file_menu.add_command(label="导出 CSV 问题清单", command=self._export_violations)
        file_menu.add_separator()
        file_menu.add_command(label="清空所有数据", command=self._clear_all_data)
        file_menu.add_separator()
        file_menu.add_command(label="退出", command=self.root.quit)

        tools_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="工具", menu=tools_menu)
        tools_menu.add_command(label="运行所有规则检查", command=self._run_all_checks)
        tools_menu.add_command(label="刷新数据", command=self._refresh_data)

        help_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="帮助", menu=help_menu)
        help_menu.add_command(label="关于", command=self._show_about)

    def _create_main_layout(self):
        main_frame = ttk.Frame(self.root, padding="10")
        main_frame.grid(row=0, column=0, sticky=(tk.W, tk.E, tk.N, tk.S))
        main_frame.columnconfigure(0, weight=1)
        main_frame.rowconfigure(1, weight=1)

        header_frame = ttk.Frame(main_frame)
        header_frame.grid(row=0, column=0, sticky=(tk.W, tk.E), pady=(0, 10))
        header_frame.columnconfigure(1, weight=1)

        title_label = ttk.Label(header_frame, text="道具交接节拍器", style="Title.TLabel")
        title_label.grid(row=0, column=0, sticky=tk.W)

        self.stats_label = ttk.Label(header_frame, text="", style="Subheader.TLabel")
        self.stats_label.grid(row=0, column=1, sticky=tk.E)

        self.notebook = ttk.Notebook(main_frame)
        self.notebook.grid(row=1, column=0, sticky=(tk.W, tk.E, tk.N, tk.S))

        self._create_overview_tab()
        self._create_props_tab()
        self._create_scenes_tab()
        self._create_handovers_tab()
        self._create_violations_tab()

    def _create_overview_tab(self):
        frame = ttk.Frame(self.notebook, padding="10")
        self.notebook.add(frame, text="概览")

        frame.columnconfigure(0, weight=1)
        frame.columnconfigure(1, weight=1)
        frame.columnconfigure(2, weight=1)
        frame.columnconfigure(3, weight=1)
        frame.rowconfigure(1, weight=1)

        stats_frame = ttk.LabelFrame(frame, text="数据统计", padding="10")
        stats_frame.grid(row=0, column=0, columnspan=4, sticky=(tk.W, tk.E), pady=(0, 10))

        self._create_stat_cards(stats_frame)

        quick_actions_frame = ttk.LabelFrame(frame, text="快捷操作", padding="10")
        quick_actions_frame.grid(row=1, column=0, columnspan=2, sticky=(tk.W, tk.E, tk.N, tk.S), padx=(0, 5))

        ttk.Button(quick_actions_frame, text="导入道具表", command=self._import_props, style="Accent.TButton").pack(fill=tk.X, pady=5)
        ttk.Button(quick_actions_frame, text="导入场次表", command=self._import_scenes).pack(fill=tk.X, pady=5)
        ttk.Button(quick_actions_frame, text="导入演员上下场表", command=self._import_handovers).pack(fill=tk.X, pady=5)
        ttk.Separator(quick_actions_frame, orient=tk.HORIZONTAL).pack(fill=tk.X, pady=10)
        ttk.Button(quick_actions_frame, text="运行规则检查", command=self._run_all_checks, style="Success.TButton").pack(fill=tk.X, pady=5)

        recent_issues_frame = ttk.LabelFrame(frame, text="最近问题", padding="10")
        recent_issues_frame.grid(row=1, column=2, columnspan=2, sticky=(tk.W, tk.E, tk.N, tk.S), padx=(5, 0))

        self.overview_violations_text = tk.Text(recent_issues_frame, wrap=tk.WORD, state=tk.DISABLED)
        self.overview_violations_text.pack(fill=tk.BOTH, expand=True)

    def _create_stat_cards(self, parent):
        stat_configs = [
            ("道具数", "props", "prop_count"),
            ("场次", "scenes", "scene_count"),
            ("交接记录", "handovers", "handover_count"),
            ("活动交接", "active", "active_handover_count"),
            ("问题数", "violations", "unresolved_violation_count"),
            ("危险品", "dangerous", "dangerous_prop_count"),
        ]

        for i, (label, key, attr) in enumerate(stat_configs):
            card = ttk.Frame(parent, relief=tk.GROOVE, padding="10")
            card.grid(row=0, column=i, padx=5, pady=5, sticky=(tk.W, tk.E))

            value_label = ttk.Label(card, text="0", style="Header.TLabel")
            value_label.pack()
            label_widget = ttk.Label(card, text=label, style="Subheader.TLabel")
            label_widget.pack()

            setattr(self, f"stat_{key}_label", value_label)

    def _create_props_tab(self):
        frame = ttk.Frame(self.notebook, padding="10")
        self.notebook.add(frame, text="道具")

        frame.columnconfigure(0, weight=1)
        frame.rowconfigure(1, weight=1)

        toolbar = ttk.Frame(frame)
        toolbar.grid(row=0, column=0, sticky=(tk.W, tk.E), pady=(0, 5))

        ttk.Button(toolbar, text="导入道具表", command=self._import_props).pack(side=tk.LEFT, padx=2)
        ttk.Button(toolbar, text="刷新", command=self._refresh_props_table).pack(side=tk.LEFT, padx=2)

        columns = ("name", "category", "danger_level", "is_dangerous", "location", "quantity")
        self.props_tree = ttk.Treeview(frame, columns=columns, show="headings", selectmode=tk.BROWSE)

        self.props_tree.heading("name", text="道具名称")
        self.props_tree.heading("category", text="类别")
        self.props_tree.heading("danger_level", text="危险等级")
        self.props_tree.heading("is_dangerous", text="是否危险")
        self.props_tree.heading("location", text="位置")
        self.props_tree.heading("quantity", text="数量")

        self.props_tree.column("name", width=150)
        self.props_tree.column("category", width=100)
        self.props_tree.column("danger_level", width=80)
        self.props_tree.column("is_dangerous", width=80)
        self.props_tree.column("location", width=120)
        self.props_tree.column("quantity", width=60)

        scrollbar = ttk.Scrollbar(frame, orient=tk.VERTICAL, command=self.props_tree.yview)
        self.props_tree.configure(yscrollcommand=scrollbar.set)

        self.props_tree.grid(row=1, column=0, sticky=(tk.W, tk.E, tk.N, tk.S))
        scrollbar.grid(row=1, column=1, sticky=(tk.N, tk.S))

    def _create_scenes_tab(self):
        frame = ttk.Frame(self.notebook, padding="10")
        self.notebook.add(frame, text="场次")

        frame.columnconfigure(0, weight=1)
        frame.rowconfigure(1, weight=1)

        toolbar = ttk.Frame(frame)
        toolbar.grid(row=0, column=0, sticky=(tk.W, tk.E), pady=(0, 5))

        ttk.Button(toolbar, text="导入场次表", command=self._import_scenes).pack(side=tk.LEFT, padx=2)
        ttk.Button(toolbar, text="刷新", command=self._refresh_scenes_table).pack(side=tk.LEFT, padx=2)

        columns = ("act", "scene", "title", "location", "start_time", "end_time", "duration")
        self.scenes_tree = ttk.Treeview(frame, columns=columns, show="headings", selectmode=tk.BROWSE)

        self.scenes_tree.heading("act", text="幕")
        self.scenes_tree.heading("scene", text="场")
        self.scenes_tree.heading("title", text="标题")
        self.scenes_tree.heading("location", text="位置")
        self.scenes_tree.heading("start_time", text="开始时间")
        self.scenes_tree.heading("end_time", text="结束时间")
        self.scenes_tree.heading("duration", text="时长(分)")

        self.scenes_tree.column("act", width=50)
        self.scenes_tree.column("scene", width=50)
        self.scenes_tree.column("title", width=150)
        self.scenes_tree.column("location", width=100)
        self.scenes_tree.column("start_time", width=120)
        self.scenes_tree.column("end_time", width=120)
        self.scenes_tree.column("duration", width=80)

        scrollbar = ttk.Scrollbar(frame, orient=tk.VERTICAL, command=self.scenes_tree.yview)
        self.scenes_tree.configure(yscrollcommand=scrollbar.set)

        self.scenes_tree.grid(row=1, column=0, sticky=(tk.W, tk.E, tk.N, tk.S))
        scrollbar.grid(row=1, column=1, sticky=(tk.N, tk.S))

    def _create_handovers_tab(self):
        frame = ttk.Frame(self.notebook, padding="10")
        self.notebook.add(frame, text="交接记录")

        frame.columnconfigure(0, weight=1)
        frame.rowconfigure(2, weight=1)

        toolbar = ttk.Frame(frame)
        toolbar.grid(row=0, column=0, sticky=(tk.W, tk.E), pady=(0, 5))

        ttk.Button(toolbar, text="导入演员表", command=self._import_handovers).pack(side=tk.LEFT, padx=2)
        ttk.Button(toolbar, text="刷新", command=self._refresh_handovers_table).pack(side=tk.LEFT, padx=2)
        ttk.Separator(toolbar, orient=tk.VERTICAL).pack(side=tk.LEFT, fill=tk.Y, padx=10)
        ttk.Button(toolbar, text="借出登记", command=self._sign_out_handover).pack(side=tk.LEFT, padx=2)
        ttk.Button(toolbar, text="归还登记", command=self._sign_in_handover).pack(side=tk.LEFT, padx=2)
        ttk.Button(toolbar, text="复核确认", command=self._verify_handover).pack(side=tk.LEFT, padx=2)
        ttk.Separator(toolbar, orient=tk.VERTICAL).pack(side=tk.LEFT, fill=tk.Y, padx=10)
        ttk.Button(toolbar, text="标记遗失", command=self._mark_lost, style="Danger.TButton").pack(side=tk.LEFT, padx=2)

        filter_frame = ttk.Frame(frame)
        filter_frame.grid(row=1, column=0, sticky=(tk.W, tk.E), pady=(0, 5))

        ttk.Label(filter_frame, text="状态过滤:").pack(side=tk.LEFT, padx=2)
        self.handover_status_var = tk.StringVar(value="ALL")
        status_values = ["ALL", "PENDING", "IN_USE", "RETURNED", "VERIFIED", "LOST", "MISSING"]
        status_display = ["全部", "待处理", "使用中", "已归还", "已复核", "遗失", "丢失"]
        self.handover_status_combo = ttk.Combobox(filter_frame, textvariable=self.handover_status_var, values=status_display, width=15, state="readonly")
        self.handover_status_combo.pack(side=tk.LEFT, padx=2)
        self.handover_status_combo.bind("<<ComboboxSelected>>", self._on_status_filter_change)

        columns = ("prop_name", "actor_name", "scene_title", "status", "signed_out", "signed_in", "verified", "scheduled_end")
        self.handovers_tree = ttk.Treeview(frame, columns=columns, show="headings", selectmode=tk.BROWSE)

        self.handovers_tree.heading("prop_name", text="道具名称")
        self.handovers_tree.heading("actor_name", text="演员")
        self.handovers_tree.heading("scene_title", text="场次")
        self.handovers_tree.heading("status", text="状态")
        self.handovers_tree.heading("signed_out", text="借出签名")
        self.handovers_tree.heading("signed_in", text="归还签名")
        self.handovers_tree.heading("verified", text="已复核")
        self.handovers_tree.heading("scheduled_end", text="计划归还时间")

        self.handovers_tree.column("prop_name", width=120)
        self.handovers_tree.column("actor_name", width=80)
        self.handovers_tree.column("scene_title", width=150)
        self.handovers_tree.column("status", width=80)
        self.handovers_tree.column("signed_out", width=80)
        self.handovers_tree.column("signed_in", width=80)
        self.handovers_tree.column("verified", width=60)
        self.handovers_tree.column("scheduled_end", width=130)

        scrollbar = ttk.Scrollbar(frame, orient=tk.VERTICAL, command=self.handovers_tree.yview)
        self.handovers_tree.configure(yscrollcommand=scrollbar.set)

        self.handovers_tree.grid(row=2, column=0, sticky=(tk.W, tk.E, tk.N, tk.S))
        scrollbar.grid(row=2, column=1, sticky=(tk.N, tk.S))

    def _create_violations_tab(self):
        frame = ttk.Frame(self.notebook, padding="10")
        self.notebook.add(frame, text="问题清单")

        frame.columnconfigure(0, weight=1)
        frame.rowconfigure(2, weight=1)

        toolbar = ttk.Frame(frame)
        toolbar.grid(row=0, column=0, sticky=(tk.W, tk.E), pady=(0, 5))

        ttk.Button(toolbar, text="运行所有检查", command=self._run_all_checks, style="Accent.TButton").pack(side=tk.LEFT, padx=2)
        ttk.Button(toolbar, text="刷新", command=self._refresh_violations_table).pack(side=tk.LEFT, padx=2)
        ttk.Separator(toolbar, orient=tk.VERTICAL).pack(side=tk.LEFT, fill=tk.Y, padx=10)
        ttk.Button(toolbar, text="标记已解决", command=self._resolve_violation).pack(side=tk.LEFT, padx=2)
        ttk.Separator(toolbar, orient=tk.VERTICAL).pack(side=tk.LEFT, fill=tk.Y, padx=10)
        ttk.Button(toolbar, text="导出CSV", command=self._export_violations).pack(side=tk.LEFT, padx=2)

        filter_frame = ttk.Frame(frame)
        filter_frame.grid(row=1, column=0, sticky=(tk.W, tk.E), pady=(0, 5))

        ttk.Label(filter_frame, text="显示:").pack(side=tk.LEFT, padx=2)
        self.violation_filter_var = tk.StringVar(value="unresolved")
        ttk.Radiobutton(filter_frame, text="未解决", variable=self.violation_filter_var, value="unresolved", command=self._refresh_violations_table).pack(side=tk.LEFT, padx=2)
        ttk.Radiobutton(filter_frame, text="全部", variable=self.violation_filter_var, value="all", command=self._refresh_violations_table).pack(side=tk.LEFT, padx=2)

        columns = ("severity", "type", "description", "prop_name", "scene_title", "actor_name", "resolved")
        self.violations_tree = ttk.Treeview(frame, columns=columns, show="headings", selectmode=tk.BROWSE)

        self.violations_tree.heading("severity", text="优先级")
        self.violations_tree.heading("type", text="问题类型")
        self.violations_tree.heading("description", text="描述")
        self.violations_tree.heading("prop_name", text="道具")
        self.violations_tree.heading("scene_title", text="场次")
        self.violations_tree.heading("actor_name", text="演员")
        self.violations_tree.heading("resolved", text="状态")

        self.violations_tree.column("severity", width=60)
        self.violations_tree.column("type", width=120)
        self.violations_tree.column("description", width=250)
        self.violations_tree.column("prop_name", width=100)
        self.violations_tree.column("scene_title", width=100)
        self.violations_tree.column("actor_name", width=80)
        self.violations_tree.column("resolved", width=60)

        scrollbar = ttk.Scrollbar(frame, orient=tk.VERTICAL, command=self.violations_tree.yview)
        self.violations_tree.configure(yscrollcommand=scrollbar.set)

        self.violations_tree.grid(row=2, column=0, sticky=(tk.W, tk.E, tk.N, tk.S))
        scrollbar.grid(row=2, column=1, sticky=(tk.N, tk.S))

    def _refresh_data(self):
        stats = self.store.get_stats()
        self._update_stats(stats)
        self._refresh_props_table()
        self._refresh_scenes_table()
        self._refresh_handovers_table()
        self._refresh_violations_table()
        self._refresh_overview_violations()

    def _update_stats(self, stats: StoreStats):
        if hasattr(self, "stat_props_label"):
            self.stat_props_label.config(text=str(stats.prop_count))
        if hasattr(self, "stat_scenes_label"):
            self.stat_scenes_label.config(text=str(stats.scene_count))
        if hasattr(self, "stat_handovers_label"):
            self.stat_handovers_label.config(text=str(stats.handover_count))
        if hasattr(self, "stat_active_label"):
            self.stat_active_label.config(text=str(stats.active_handover_count))
        if hasattr(self, "stat_violations_label"):
            self.stat_violations_label.config(text=str(stats.unresolved_violation_count))
        if hasattr(self, "stat_dangerous_label"):
            self.stat_dangerous_label.config(text=str(stats.dangerous_prop_count))

        stats_text = f"道具: {stats.prop_count} | 场次: {stats.scene_count} | 交接: {stats.handover_count} | 问题: {stats.unresolved_violation_count}"
        if hasattr(self, "stats_label"):
            self.stats_label.config(text=stats_text)

    def _refresh_props_table(self):
        for item in self.props_tree.get_children():
            self.props_tree.delete(item)

        props = self.store.props.get_all()
        for prop in props:
            danger_display = AppStyles.get_danger_level_display(prop.danger_level.name)
            is_dangerous_text = "是" if prop.is_dangerous else "否"
            quantity_text = f"{prop.available_quantity}/{prop.total_quantity}"

            self.props_tree.insert("", tk.END, iid=prop.id, values=(
                prop.name,
                prop.category,
                danger_display,
                is_dangerous_text,
                prop.location or "-",
                quantity_text,
            ))

            if prop.is_dangerous or prop.danger_level != DangerLevel.SAFE:
                self.props_tree.tag_configure("danger", foreground=AppStyles.COLORS["danger"])
                self.props_tree.item(prop.id, tags=("danger",))

    def _refresh_scenes_table(self):
        for item in self.scenes_tree.get_children():
            self.scenes_tree.delete(item)

        scenes = self.store.scenes.get_all()
        for scene in scenes:
            start_time = scene.start_time.strftime("%Y-%m-%d %H:%M") if scene.start_time else "-"
            end_time = scene.end_time.strftime("%Y-%m-%d %H:%M") if scene.end_time else "-"

            self.scenes_tree.insert("", tk.END, iid=scene.id, values=(
                scene.act_number,
                scene.scene_number,
                scene.title or "-",
                scene.location or "-",
                start_time,
                end_time,
                scene.duration_minutes,
            ))

    def _refresh_handovers_table(self, status_filter: str = "ALL"):
        for item in self.handovers_tree.get_children():
            self.handovers_tree.delete(item)

        if status_filter == "ALL":
            handovers = self.store.handovers.get_all()
        else:
            try:
                status_enum = HandoverStatus[status_filter]
                handovers = self.store.handovers.get_by_status(status_enum)
            except KeyError:
                handovers = self.store.handovers.get_all()

        for handover in handovers:
            status_name = handover.status.name
            status_display = AppStyles.get_status_display(status_name)
            signed_out_text = "✓" if handover.is_signed_out else "✗"
            signed_in_text = "✓" if handover.is_signed_in else "✗"
            verified_text = "✓" if handover.is_verified else "✗"
            scheduled_end = handover.scheduled_end_time.strftime("%Y-%m-%d %H:%M") if handover.scheduled_end_time else "-"

            item_id = self.handovers_tree.insert("", tk.END, values=(
                handover.prop_name,
                handover.actor_name,
                handover.scene_title,
                status_display,
                signed_out_text,
                signed_in_text,
                verified_text,
                scheduled_end,
            ))

            status_color = AppStyles.get_status_color(status_name)
            self.handovers_tree.tag_configure(status_name, foreground=status_color)
            self.handovers_tree.item(item_id, tags=(status_name,))

    def _refresh_violations_table(self):
        for item in self.violations_tree.get_children():
            self.violations_tree.delete(item)

        show_all = self.violation_filter_var.get() == "all"
        violations = self.store.violations.get_all(include_resolved=show_all)

        for violation in violations:
            severity_display = AppStyles.get_severity_display(violation.severity)
            resolved_text = "已解决" if violation.resolved else "未解决"

            item_id = self.violations_tree.insert("", tk.END, iid=violation.id, values=(
                severity_display,
                violation.violation_type,
                violation.description,
                violation.prop_name or "-",
                violation.scene_title or "-",
                violation.actor_name or "-",
                resolved_text,
            ))

            severity_color = AppStyles.get_severity_color(violation.severity)
            self.violations_tree.tag_configure(violation.severity, foreground=severity_color)
            if violation.resolved:
                self.violations_tree.tag_configure("resolved", foreground=AppStyles.COLORS["text_secondary"])
                self.violations_tree.item(item_id, tags=(violation.severity, "resolved"))
            else:
                self.violations_tree.item(item_id, tags=(violation.severity,))

    def _refresh_overview_violations(self):
        self.overview_violations_text.config(state=tk.NORMAL)
        self.overview_violations_text.delete(1.0, tk.END)

        unresolved = self.store.violations.get_unresolved()

        if not unresolved:
            self.overview_violations_text.insert(tk.END, "✓ 暂无未解决的问题\n", "success")
            self.overview_violations_text.tag_configure("success", foreground=AppStyles.COLORS["success"])
        else:
            for v in unresolved[:10]:
                severity_display = AppStyles.get_severity_display(v.severity).upper()
                line = f"[{severity_display}] {v.violation_type}: {v.description}\n"
                if v.prop_name:
                    line += f"   道具: {v.prop_name}"
                if v.scene_title:
                    line += f" | 场次: {v.scene_title}"
                line += "\n\n"

                tag = v.severity
                self.overview_violations_text.tag_configure(tag, foreground=AppStyles.get_severity_color(v.severity))
                self.overview_violations_text.insert(tk.END, line, tag)

            if len(unresolved) > 10:
                self.overview_violations_text.insert(tk.END, f"... 还有 {len(unresolved) - 10} 个问题\n")

        self.overview_violations_text.config(state=tk.DISABLED)

    def _on_status_filter_change(self, event=None):
        display_map = {
            "全部": "ALL",
            "待处理": "PENDING",
            "使用中": "IN_USE",
            "已归还": "RETURNED",
            "已复核": "VERIFIED",
            "遗失": "LOST",
            "丢失": "MISSING",
        }
        display_value = self.handover_status_combo.get()
        status_value = display_map.get(display_value, "ALL")
        self._refresh_handovers_table(status_value)

    def _import_props(self):
        file_path = filedialog.askopenfilename(
            title="选择道具表 CSV 文件",
            filetypes=[("CSV 文件", "*.csv"), ("所有文件", "*.*")],
        )
        if not file_path:
            return

        path = Path(file_path)
        props, errors, warnings = self.import_manager.import_props(path)

        if errors:
            error_msg = "\n".join(errors)
            messagebox.showerror("导入失败", f"道具表导入失败:\n{error_msg}")
            return

        count = self.store.import_props(props, clear_existing=False)

        msg = f"成功导入 {count} 个道具"
        if warnings:
            msg += f"\n警告: {len(warnings)} 个"

        messagebox.showinfo("导入成功", msg)
        self._refresh_data()

    def _import_scenes(self):
        file_path = filedialog.askopenfilename(
            title="选择场次表 CSV 文件",
            filetypes=[("CSV 文件", "*.csv"), ("所有文件", "*.*")],
        )
        if not file_path:
            return

        path = Path(file_path)
        scenes, errors, warnings = self.import_manager.import_scenes(path)

        if errors:
            error_msg = "\n".join(errors)
            messagebox.showerror("导入失败", f"场次表导入失败:\n{error_msg}")
            return

        count = self.store.import_scenes(scenes, clear_existing=False)

        msg = f"成功导入 {count} 个场次"
        if warnings:
            msg += f"\n警告: {len(warnings)} 个"

        messagebox.showinfo("导入成功", msg)
        self._refresh_data()

    def _import_handovers(self):
        file_path = filedialog.askopenfilename(
            title="选择演员上下场表 CSV 文件",
            filetypes=[("CSV 文件", "*.csv"), ("所有文件", "*.*")],
        )
        if not file_path:
            return

        path = Path(file_path)
        existing_props = self.store.props.get_all()
        existing_scenes = self.store.scenes.get_all()

        handovers, errors, warnings = self.import_manager.import_handovers(
            path, existing_props, existing_scenes
        )

        if errors:
            error_msg = "\n".join(errors)
            messagebox.showerror("导入失败", f"演员表导入失败:\n{error_msg}")
            return

        count = self.store.import_handovers(handovers, clear_existing=False)

        msg = f"成功导入 {count} 条交接记录"
        if warnings:
            msg += f"\n警告: {len(warnings)} 个"

        messagebox.showinfo("导入成功", msg)
        self._refresh_data()

    def _run_all_checks(self):
        props = self.store.props.get_all()
        scenes = self.store.scenes.get_all()
        handovers = self.store.handovers.get_all()

        if not handovers:
            messagebox.showwarning("检查失败", "没有交接记录可供检查")
            return

        result = self.rules_engine.run_all_checks(handovers, props, scenes)

        self.store.violations.save_all(result.all_violations)

        if result.all_passed:
            messagebox.showinfo("检查完成", "所有检查通过，未发现问题")
        else:
            message = f"发现 {len(result.unresolved_violations)} 个问题\n"
            message += f"- 错误: {result.error_count}\n"
            message += f"- 警告: {result.warning_count}"
            messagebox.showwarning("检查完成", message)

        self._refresh_data()

    def _sign_out_handover(self):
        selected = self.handovers_tree.selection()
        if not selected:
            messagebox.showwarning("提示", "请先选择一条交接记录")
            return

        item = selected[0]
        values = self.handovers_tree.item(item, "values")
        prop_name = values[0]

        person = simpledialog.askstring("借出登记", f"请输入借出登记人姓名:\n(道具: {prop_name})")
        if not person:
            return

        handovers = self.store.handovers.get_by_prop_id(prop_name)
        for handover in handovers:
            if handover.prop_name == prop_name and handover.status == HandoverStatus.PENDING:
                handover.sign_out(person)
                self.store.handovers.save(handover)
                messagebox.showinfo("成功", f"道具 '{prop_name}' 已借出登记")
                self._refresh_data()
                return

        messagebox.showwarning("提示", "未找到可借出登记的记录")

    def _sign_in_handover(self):
        selected = self.handovers_tree.selection()
        if not selected:
            messagebox.showwarning("提示", "请先选择一条交接记录")
            return

        item = selected[0]
        values = self.handovers_tree.item(item, "values")
        prop_name = values[0]

        person = simpledialog.askstring("归还登记", f"请输入归还登记人姓名:\n(道具: {prop_name})")
        if not person:
            return

        handovers = self.store.handovers.get_by_prop_id(prop_name)
        for handover in handovers:
            if handover.prop_name == prop_name and handover.status == HandoverStatus.IN_USE:
                handover.sign_in(person)
                self.store.handovers.save(handover)
                messagebox.showinfo("成功", f"道具 '{prop_name}' 已归还登记")
                self._refresh_data()
                return

        messagebox.showwarning("提示", "未找到可归还登记的记录")

    def _verify_handover(self):
        selected = self.handovers_tree.selection()
        if not selected:
            messagebox.showwarning("提示", "请先选择一条交接记录")
            return

        item = selected[0]
        values = self.handovers_tree.item(item, "values")
        prop_name = values[0]

        person = simpledialog.askstring("复核确认", f"请输入复核人姓名:\n(道具: {prop_name})")
        if not person:
            return

        notes = simpledialog.askstring("复核备注", "请输入复核备注(可选):")

        handovers = self.store.handovers.get_by_prop_id(prop_name)
        for handover in handovers:
            if handover.prop_name == prop_name and handover.status == HandoverStatus.RETURNED:
                handover.verify(person, notes or "")
                self.store.handovers.save(handover)
                messagebox.showinfo("成功", f"道具 '{prop_name}' 已复核确认")
                self._refresh_data()
                return

        messagebox.showwarning("提示", "未找到可复核的记录")

    def _mark_lost(self):
        selected = self.handovers_tree.selection()
        if not selected:
            messagebox.showwarning("提示", "请先选择一条交接记录")
            return

        item = selected[0]
        values = self.handovers_tree.item(item, "values")
        prop_name = values[0]

        result = messagebox.askyesno(
            "确认标记遗失",
            f"确定要将道具 '{prop_name}' 标记为遗失吗？\n此操作不可撤销。",
            icon=messagebox.WARNING
        )
        if not result:
            return

        handovers = self.store.handovers.get_by_prop_id(prop_name)
        for handover in handovers:
            if handover.prop_name == prop_name and handover.status in (HandoverStatus.IN_USE, HandoverStatus.PENDING):
                handover.mark_lost()
                self.store.handovers.save(handover)
                messagebox.showinfo("成功", f"道具 '{prop_name}' 已标记为遗失")
                self._refresh_data()
                return

        messagebox.showwarning("提示", "未找到可标记的记录")

    def _resolve_violation(self):
        selected = self.violations_tree.selection()
        if not selected:
            messagebox.showwarning("提示", "请先选择一个问题")
            return

        violation_id = selected[0]

        person = simpledialog.askstring("标记已解决", "请输入处理人姓名:")
        if not person:
            return

        notes = simpledialog.askstring("处理备注", "请输入处理备注(可选):")

        success = self.store.violations.resolve(violation_id, person, notes or "")
        if success:
            messagebox.showinfo("成功", "问题已标记为已解决")
            self._refresh_data()
        else:
            messagebox.showerror("错误", "无法找到该问题记录")

    def _export_markdown(self):
        file_path = filedialog.asksaveasfilename(
            title="保存 Markdown 场务提示单",
            defaultextension=".md",
            filetypes=[("Markdown 文件", "*.md"), ("所有文件", "*.*")],
            initialfile=f"场务提示单_{datetime.now().strftime('%Y%m%d_%H%M%S')}.md",
        )
        if not file_path:
            return

        path = Path(file_path)
        props = self.store.props.get_all()
        scenes = self.store.scenes.get_all()
        handovers = self.store.handovers.get_all()
        violations = self.store.violations.get_all(include_resolved=False)

        exporter = MarkdownExporter()
        exporter.export_to_file(path, props, scenes, handovers, violations)

        messagebox.showinfo("导出成功", f"场务提示单已导出到:\n{file_path}")

    def _export_violations(self):
        file_path = filedialog.asksaveasfilename(
            title="保存 CSV 问题清单",
            defaultextension=".csv",
            filetypes=[("CSV 文件", "*.csv"), ("所有文件", "*.*")],
            initialfile=f"问题清单_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv",
        )
        if not file_path:
            return

        path = Path(file_path)
        violations = self.store.violations.get_all(include_resolved=True)

        exporter = CSVViolationExporter()
        exporter.export_to_file(path, violations)

        messagebox.showinfo("导出成功", f"问题清单已导出到:\n{file_path}")

    def _clear_all_data(self):
        result = messagebox.askyesno(
            "确认清空",
            "确定要清空所有数据吗？\n此操作不可撤销！",
            icon=messagebox.WARNING
        )
        if not result:
            return

        counts = self.store.clear_all_data()
        messagebox.showinfo(
            "数据已清空",
            f"已删除:\n- 道具: {counts.get('props', 0)}\n- 场次: {counts.get('scenes', 0)}\n- 交接记录: {counts.get('handovers', 0)}\n- 问题记录: {counts.get('violations', 0)}"
        )
        self._refresh_data()

    def _show_about(self):
        messagebox.showinfo(
            "关于 - 道具交接节拍器",
            "道具交接节拍器 v1.0\n\n"
            "剧场舞台监督用离线桌面工具\n\n"
            "功能:\n"
            "- 导入道具表、场次表、演员上下场表\n"
            "- 维护道具、场次、演员和交接状态机\n"
            "- 自动检查时间冲突、缺签、危险品复核、遗失超时\n"
            "- 支持现场手动改状态并持久化\n"
            "- 导出 Markdown 场务提示单和 CSV 问题清单\n\n"
            "© 2024"
        )
