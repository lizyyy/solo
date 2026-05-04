import tkinter as tk
from tkinter import ttk, messagebox, filedialog, scrolledtext
from pathlib import Path
from datetime import datetime
from typing import Dict, Any, List, Optional

from app.database.connection import SessionLocal
from app.services.call_service import CallService
from app.services.export_service import ExportService
from app.config import RISK_LEVELS, RISK_FLAGS, EXPORTS_DIR


class RiskReviewerApp:
    def __init__(self, root: tk.Tk):
        self.root = root
        self.root.title("风险来电复盘器 - 社区心理热线督导工具")
        self.root.geometry("1400x900")
        self.root.minsize(1200, 700)
        
        self.db = SessionLocal()
        self.call_service = CallService(self.db)
        self.export_service = ExportService(EXPORTS_DIR)
        
        self.current_call_id: Optional[str] = None
        self.current_risk_filter: List[str] = ["red", "orange", "yellow", "green"]
        
        self._setup_styles()
        self._create_menu()
        self._create_main_layout()
        self._refresh_risk_queue()
        self._refresh_statistics()

    def _setup_styles(self):
        style = ttk.Style()
        style.theme_use('clam')
        
        style.configure('Red.TLabel', foreground=RISK_LEVELS["red"]["color"])
        style.configure('Orange.TLabel', foreground=RISK_LEVELS["orange"]["color"])
        style.configure('Yellow.TLabel', foreground=RISK_LEVELS["yellow"]["color"])
        style.configure('Green.TLabel', foreground=RISK_LEVELS["green"]["color"])
        
        style.configure('Red.TFrame', background=RISK_LEVELS["red"]["color"])
        style.configure('Orange.TFrame', background=RISK_LEVELS["orange"]["color"])
        style.configure('Yellow.TFrame', background=RISK_LEVELS["yellow"]["color"])
        style.configure('Green.TFrame', background=RISK_LEVELS["green"]["color"])

    def _create_menu(self):
        menubar = tk.Menu(self.root)
        self.root.config(menu=menubar)
        
        file_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="文件", menu=file_menu)
        file_menu.add_command(label="导入通话摘要 (JSON)", command=self._import_calls)
        file_menu.add_command(label="导入班表 (CSV)", command=self._import_schedules)
        file_menu.add_command(label="导入回访记录 (CSV)", command=self._import_follow_ups)
        file_menu.add_separator()
        file_menu.add_command(label="导出当前来电复盘 (Markdown)", command=self._export_current_review)
        file_menu.add_command(label="导出待办清单 (CSV)", command=self._export_todo_list)
        file_menu.add_separator()
        file_menu.add_command(label="重新评估所有来电", command=self._reprocess_all)
        file_menu.add_separator()
        file_menu.add_command(label="退出", command=self.root.quit)
        
        help_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="帮助", menu=help_menu)
        help_menu.add_command(label="关于", command=self._show_about)

    def _create_main_layout(self):
        self.paned = ttk.PanedWindow(self.root, orient=tk.HORIZONTAL)
        self.paned.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)
        
        left_frame = ttk.Frame(self.paned)
        self.paned.add(left_frame, weight=1)
        
        self._create_left_panel(left_frame)
        
        right_frame = ttk.Frame(self.paned)
        self.paned.add(right_frame, weight=2)
        
        self._create_right_panel(right_frame)

    def _create_left_panel(self, parent):
        toolbar = ttk.Frame(parent)
        toolbar.pack(fill=tk.X, pady=(0, 5))
        
        ttk.Label(toolbar, text="风险等级筛选:").pack(side=tk.LEFT, padx=(0, 5))
        
        self.filter_vars = {}
        for level, info in RISK_LEVELS.items():
            var = tk.BooleanVar(value=True)
            self.filter_vars[level] = var
            cb = ttk.Checkbutton(
                toolbar, 
                text=info["name"],
                variable=var,
                command=self._on_filter_change
            )
            cb.pack(side=tk.LEFT, padx=2)
        
        ttk.Button(
            toolbar, 
            text="刷新", 
            command=self._refresh_risk_queue
        ).pack(side=tk.RIGHT, padx=2)
        
        list_frame = ttk.LabelFrame(parent, text="风险队列 (按优先级排序)")
        list_frame.pack(fill=tk.BOTH, expand=True)
        
        columns = ("risk_level", "call_id", "call_time", "caller_id", "score", "flags")
        self.risk_tree = ttk.Treeview(
            list_frame, 
            columns=columns,
            show="headings",
            selectmode="browse"
        )
        
        self.risk_tree.heading("risk_level", text="风险")
        self.risk_tree.heading("call_id", text="来电ID")
        self.risk_tree.heading("call_time", text="来电时间")
        self.risk_tree.heading("caller_id", text="来电者ID")
        self.risk_tree.heading("score", text="评分")
        self.risk_tree.heading("flags", text="风险标志")
        
        self.risk_tree.column("risk_level", width=60, anchor=tk.CENTER)
        self.risk_tree.column("call_id", width=100)
        self.risk_tree.column("call_time", width=140)
        self.risk_tree.column("caller_id", width=100)
        self.risk_tree.column("score", width=60, anchor=tk.CENTER)
        self.risk_tree.column("flags", width=200)
        
        scrollbar = ttk.Scrollbar(list_frame, orient=tk.VERTICAL, command=self.risk_tree.yview)
        self.risk_tree.configure(yscrollcommand=scrollbar.set)
        
        self.risk_tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
        
        self.risk_tree.bind("<<TreeviewSelect>>", self._on_call_selected)
        
        self._setup_tree_tags()

    def _setup_tree_tags(self):
        for level in RISK_LEVELS.keys():
            self.risk_tree.tag_configure(
                level,
                background=self._get_light_color(RISK_LEVELS[level]["color"])
            )

    def _get_light_color(self, color: str) -> str:
        colors = {
            "#dc3545": "#fff5f5",
            "#fd7e14": "#fff3e0",
            "#ffc107": "#fffde7",
            "#28a745": "#e8f5e9",
        }
        return colors.get(color, "#ffffff")

    def _create_right_panel(self, parent):
        self.notebook = ttk.Notebook(parent)
        self.notebook.pack(fill=tk.BOTH, expand=True)
        
        detail_frame = ttk.Frame(self.notebook)
        self.notebook.add(detail_frame, text="来电详情")
        self._create_detail_tab(detail_frame)
        
        assessment_frame = ttk.Frame(self.notebook)
        self.notebook.add(assessment_frame, text="风险评估")
        self._create_assessment_tab(assessment_frame)
        
        notes_frame = ttk.Frame(self.notebook)
        self.notebook.add(notes_frame, text="督导意见")
        self._create_notes_tab(notes_frame)
        
        stats_frame = ttk.Frame(self.notebook)
        self.notebook.add(stats_frame, text="统计概览")
        self._create_stats_tab(stats_frame)

    def _create_detail_tab(self, parent):
        main_container = ttk.Frame(parent)
        main_container.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)
        
        info_frame = ttk.LabelFrame(main_container, text="基本信息")
        info_frame.pack(fill=tk.X, pady=(0, 10))
        
        info_inner = ttk.Frame(info_frame)
        info_inner.pack(fill=tk.X, padx=10, pady=10)
        
        self.detail_labels = {}
        
        fields = [
            ("call_id", "来电ID"),
            ("caller_id", "来电者ID"),
            ("call_time", "来电时间"),
            ("duration_minutes", "通话时长(分钟)"),
            ("operator_name", "接线员"),
            ("initial_risk_level", "初判风险等级"),
        ]
        
        for i, (key, label) in enumerate(fields):
            row = i // 2
            col = (i % 2) * 2
            
            ttk.Label(info_inner, text=f"{label}:", font=("Arial", 10, "bold")).grid(
                row=row, column=col, sticky=tk.W, padx=5, pady=3
            )
            
            value_label = ttk.Label(info_inner, text="-", font=("Arial", 10))
            value_label.grid(row=row, column=col+1, sticky=tk.W, padx=5, pady=3)
            self.detail_labels[key] = value_label
        
        risk_frame = ttk.Frame(info_inner)
        risk_frame.grid(row=3, column=0, columnspan=4, sticky=tk.W, padx=5, pady=5)
        
        ttk.Label(risk_frame, text="当前风险等级:", font=("Arial", 10, "bold")).pack(side=tk.LEFT)
        self.current_risk_label = ttk.Label(risk_frame, text="-", font=("Arial", 12, "bold"))
        self.current_risk_label.pack(side=tk.LEFT, padx=10)
        
        ttk.Label(risk_frame, text="风险评分:", font=("Arial", 10, "bold")).pack(side=tk.LEFT)
        self.risk_score_label = ttk.Label(risk_frame, text="-", font=("Arial", 12, "bold"))
        self.risk_score_label.pack(side=tk.LEFT, padx=10)
        
        summary_frame = ttk.LabelFrame(main_container, text="通话摘要")
        summary_frame.pack(fill=tk.BOTH, expand=True, pady=(0, 10))
        
        self.summary_text = scrolledtext.ScrolledText(
            summary_frame, 
            wrap=tk.WORD, 
            height=8,
            font=("Arial", 11)
        )
        self.summary_text.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)
        
        followup_frame = ttk.LabelFrame(main_container, text="回访记录")
        followup_frame.pack(fill=tk.BOTH, expand=True)
        
        fu_columns = ("scheduled", "actual", "status", "operator", "result")
        self.followup_tree = ttk.Treeview(
            followup_frame,
            columns=fu_columns,
            show="headings",
            height=4
        )
        
        self.followup_tree.heading("scheduled", text="计划时间")
        self.followup_tree.heading("actual", text="实际时间")
        self.followup_tree.heading("status", text="状态")
        self.followup_tree.heading("operator", text="接线员")
        self.followup_tree.heading("result", text="结果")
        
        self.followup_tree.column("scheduled", width=150)
        self.followup_tree.column("actual", width=150)
        self.followup_tree.column("status", width=80)
        self.followup_tree.column("operator", width=100)
        self.followup_tree.column("result", width=200)
        
        fu_scroll = ttk.Scrollbar(followup_frame, orient=tk.VERTICAL, command=self.followup_tree.yview)
        self.followup_tree.configure(yscrollcommand=fu_scroll.set)
        
        self.followup_tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, padx=10, pady=10)
        fu_scroll.pack(side=tk.RIGHT, fill=tk.Y)

    def _create_assessment_tab(self, parent):
        main_container = ttk.Frame(parent)
        main_container.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)
        
        flags_frame = ttk.LabelFrame(main_container, text="风险标志")
        flags_frame.pack(fill=tk.X, pady=(0, 10))
        
        self.flags_container = ttk.Frame(flags_frame)
        self.flags_container.pack(fill=tk.X, padx=10, pady=10)
        
        self.flag_labels = {}
        for flag_key, flag_info in RISK_FLAGS.items():
            frame = ttk.Frame(self.flags_container)
            frame.pack(side=tk.LEFT, padx=10, pady=5)
            
            lbl = ttk.Label(frame, text=f"○ {flag_info['name']}", foreground="gray")
            lbl.pack()
            self.flag_labels[flag_key] = lbl
        
        reassess_frame = ttk.LabelFrame(main_container, text="手动改判风险等级")
        reassess_frame.pack(fill=tk.X, pady=(0, 10))
        
        reassess_inner = ttk.Frame(reassess_frame)
        reassess_inner.pack(fill=tk.X, padx=10, pady=10)
        
        ttk.Label(reassess_inner, text="新风险等级:").pack(side=tk.LEFT, padx=(0, 10))
        
        self.new_risk_var = tk.StringVar(value="green")
        risk_combo = ttk.Combobox(
            reassess_inner,
            textvariable=self.new_risk_var,
            values=[info["name"] for info in RISK_LEVELS.values()],
            state="readonly",
            width=15
        )
        risk_combo.pack(side=tk.LEFT, padx=(0, 10))
        
        ttk.Label(reassess_inner, text="督导姓名:").pack(side=tk.LEFT, padx=(20, 10))
        self.supervisor_name_var = tk.StringVar()
        supervisor_entry = ttk.Entry(
            reassess_inner, 
            textvariable=self.supervisor_name_var,
            width=15
        )
        supervisor_entry.pack(side=tk.LEFT, padx=(0, 10))
        
        ttk.Button(
            reassess_inner,
            text="确认改判",
            command=self._reassess_risk
        ).pack(side=tk.LEFT, padx=10)
        
        reasons_frame = ttk.LabelFrame(main_container, text="改判原因")
        reasons_frame.pack(fill=tk.BOTH, expand=True)
        
        self.reasons_text = scrolledtext.ScrolledText(
            reasons_frame,
            wrap=tk.WORD,
            height=5,
            font=("Arial", 11)
        )
        self.reasons_text.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)
        
        history_frame = ttk.LabelFrame(main_container, text="评估历史")
        history_frame.pack(fill=tk.BOTH, expand=True, pady=(10, 0))
        
        hist_columns = ("time", "level", "score", "assessor", "reasons")
        self.assessment_history_tree = ttk.Treeview(
            history_frame,
            columns=hist_columns,
            show="headings",
            height=5
        )
        
        self.assessment_history_tree.heading("time", text="评估时间")
        self.assessment_history_tree.heading("level", text="风险等级")
        self.assessment_history_tree.heading("score", text="评分")
        self.assessment_history_tree.heading("assessor", text="评估人")
        self.assessment_history_tree.heading("reasons", text="原因")
        
        self.assessment_history_tree.column("time", width=150)
        self.assessment_history_tree.column("level", width=80)
        self.assessment_history_tree.column("score", width=60)
        self.assessment_history_tree.column("assessor", width=100)
        self.assessment_history_tree.column("reasons", width=300)
        
        hist_scroll = ttk.Scrollbar(history_frame, orient=tk.VERTICAL, command=self.assessment_history_tree.yview)
        self.assessment_history_tree.configure(yscrollcommand=hist_scroll.set)
        
        self.assessment_history_tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, padx=10, pady=10)
        hist_scroll.pack(side=tk.RIGHT, fill=tk.Y)

    def _create_notes_tab(self, parent):
        main_container = ttk.Frame(parent)
        main_container.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)
        
        add_frame = ttk.LabelFrame(main_container, text="添加督导意见")
        add_frame.pack(fill=tk.X, pady=(0, 10))
        
        add_inner = ttk.Frame(add_frame)
        add_inner.pack(fill=tk.BOTH, padx=10, pady=10)
        
        self.note_text = scrolledtext.ScrolledText(
            add_inner,
            wrap=tk.WORD,
            height=4,
            font=("Arial", 11)
        )
        self.note_text.pack(fill=tk.BOTH, expand=True, pady=(0, 10))
        
        btn_frame = ttk.Frame(add_inner)
        btn_frame.pack(fill=tk.X)
        
        ttk.Label(btn_frame, text="督导姓名:").pack(side=tk.LEFT, padx=(0, 5))
        self.note_supervisor_var = tk.StringVar()
        ttk.Entry(
            btn_frame,
            textvariable=self.note_supervisor_var,
            width=15
        ).pack(side=tk.LEFT, padx=(0, 20))
        
        ttk.Button(
            btn_frame,
            text="添加意见",
            command=self._add_supervisor_note
        ).pack(side=tk.LEFT)
        
        history_frame = ttk.LabelFrame(main_container, text="督导意见历史")
        history_frame.pack(fill=tk.BOTH, expand=True)
        
        notes_columns = ("time", "supervisor", "note")
        self.notes_tree = ttk.Treeview(
            history_frame,
            columns=notes_columns,
            show="headings"
        )
        
        self.notes_tree.heading("time", text="时间")
        self.notes_tree.heading("supervisor", text="督导")
        self.notes_tree.heading("note", text="意见内容")
        
        self.notes_tree.column("time", width=150)
        self.notes_tree.column("supervisor", width=100)
        self.notes_tree.column("note", width=400)
        
        notes_scroll = ttk.Scrollbar(history_frame, orient=tk.VERTICAL, command=self.notes_tree.yview)
        self.notes_tree.configure(yscrollcommand=notes_scroll.set)
        
        self.notes_tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, padx=10, pady=10)
        notes_scroll.pack(side=tk.RIGHT, fill=tk.Y)

    def _create_stats_tab(self, parent):
        main_container = ttk.Frame(parent)
        main_container.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)
        
        summary_frame = ttk.LabelFrame(main_container, text="统计摘要")
        summary_frame.pack(fill=tk.X, pady=(0, 10))
        
        self.stats_labels = {}
        fields = [
            ("total_calls", "总来电数"),
            ("pending_follow_ups", "待回访数"),
        ]
        
        for i, (key, label) in enumerate(fields):
            frame = ttk.Frame(summary_frame)
            frame.pack(side=tk.LEFT, padx=30, pady=20)
            
            ttk.Label(frame, text=label, font=("Arial", 12)).pack()
            val_label = ttk.Label(frame, text="0", font=("Arial", 20, "bold"))
            val_label.pack()
            self.stats_labels[key] = val_label
        
        risk_frame = ttk.LabelFrame(main_container, text="风险等级分布")
        risk_frame.pack(fill=tk.BOTH, expand=True, pady=(0, 10))
        
        risk_inner = ttk.Frame(risk_frame)
        risk_inner.pack(fill=tk.BOTH, expand=True, padx=20, pady=20)
        
        self.risk_dist_labels = {}
        for level, info in RISK_LEVELS.items():
            frame = ttk.Frame(risk_inner)
            frame.pack(side=tk.LEFT, padx=40)
            
            color_frame = tk.Frame(frame, width=60, height=60, bg=info["color"])
            color_frame.pack(pady=5)
            
            ttk.Label(frame, text=info["name"], font=("Arial", 11, "bold")).pack()
            count_label = ttk.Label(frame, text="0", font=("Arial", 16, "bold"))
            count_label.pack()
            self.risk_dist_labels[level] = count_label
        
        flags_frame = ttk.LabelFrame(main_container, text="风险标志分布")
        flags_frame.pack(fill=tk.BOTH, expand=True)
        
        self.flags_dist_container = ttk.Frame(flags_frame)
        self.flags_dist_container.pack(fill=tk.BOTH, expand=True, padx=20, pady=20)

    def _refresh_risk_queue(self):
        for item in self.risk_tree.get_children():
            self.risk_tree.delete(item)
        
        filter_levels = [k for k, v in self.filter_vars.items() if v.get()]
        if not filter_levels:
            filter_levels = list(RISK_LEVELS.keys())
        
        queue = self.call_service.get_risk_queue(filter_levels)
        
        for call in queue:
            flags = call.get("assessment_flags", [])
            flag_names = [RISK_FLAGS.get(f, {"name": f})["name"] for f in flags]
            flag_str = ", ".join(flag_names) if flag_names else "-"
            
            level = call.get("current_risk_level", "green")
            level_name = RISK_LEVELS.get(level, {"name": "未知"})["name"]
            
            values = (
                level_name,
                call.get("call_id", ""),
                call.get("call_time", "").strftime("%Y-%m-%d %H:%M") if call.get("call_time") else "",
                call.get("caller_id", ""),
                str(call.get("risk_score", 0)),
                flag_str,
            )
            
            self.risk_tree.insert("", tk.END, values=values, tags=(level,), iid=call["call_id"])

    def _refresh_statistics(self):
        stats = self.call_service.get_statistics()
        
        total = stats.get("total_calls", 0)
        pending = stats.get("pending_follow_ups", 0)
        
        self.stats_labels["total_calls"].config(text=str(total))
        self.stats_labels["pending_follow_ups"].config(text=str(pending))
        
        risk_dist = stats.get("risk_distribution", {})
        for level, label in self.risk_dist_labels.items():
            label.config(text=str(risk_dist.get(level, 0)))
        
        for widget in self.flags_dist_container.winfo_children():
            widget.destroy()
        
        flag_dist = stats.get("flag_distribution", {})
        for flag_key, flag_info in RISK_FLAGS.items():
            count = flag_dist.get(flag_key, 0)
            if count > 0:
                frame = ttk.Frame(self.flags_dist_container)
                frame.pack(side=tk.LEFT, padx=20)
                
                ttk.Label(frame, text=flag_info["name"], font=("Arial", 11)).pack()
                ttk.Label(frame, text=str(count), font=("Arial", 14, "bold")).pack()

    def _on_call_selected(self, event):
        selection = self.risk_tree.selection()
        if not selection:
            return
        
        call_id = selection[0]
        self.current_call_id = call_id
        
        call_data = self.call_service.get_call_by_id(call_id)
        if not call_data:
            return
        
        self._populate_detail_tab(call_data)
        self._populate_assessment_tab(call_data)
        self._populate_notes_tab(call_data)

    def _populate_detail_tab(self, call_data: Dict[str, Any]):
        mappings = {
            "call_id": call_data.get("call_id", "-"),
            "caller_id": call_data.get("caller_id", "-"),
            "call_time": call_data.get("call_time", "").strftime("%Y-%m-%d %H:%M") if call_data.get("call_time") else "-",
            "duration_minutes": str(call_data.get("duration_minutes", 0)),
            "operator_name": f"{call_data.get('operator_name', '-')} ({call_data.get('operator_id', '-')})",
            "initial_risk_level": RISK_LEVELS.get(call_data.get("initial_risk_level", "green"), {"name": "未知"})["name"],
        }
        
        for key, value in mappings.items():
            if key in self.detail_labels:
                self.detail_labels[key].config(text=value)
        
        current_level = call_data.get("current_risk_level", "green")
        current_level_name = RISK_LEVELS.get(current_level, {"name": "未知"})["name"]
        self.current_risk_label.config(text=current_level_name)
        
        score = call_data.get("risk_score", 0)
        self.risk_score_label.config(text=f"{score} 分")
        
        summary = call_data.get("summary_text", "")
        self.summary_text.delete(1.0, tk.END)
        if summary:
            self.summary_text.insert(tk.END, summary)
        
        for item in self.followup_tree.get_children():
            self.followup_tree.delete(item)
        
        for fu in call_data.get("follow_ups", []):
            scheduled = fu.get("scheduled_time", "")
            if scheduled:
                scheduled = scheduled.strftime("%Y-%m-%d %H:%M")
            
            actual = fu.get("actual_time", "")
            if actual:
                actual = actual.strftime("%Y-%m-%d %H:%M")
            
            status = "已完成" if fu.get("is_completed") else "待执行"
            
            values = (
                scheduled or "-",
                actual or "-",
                status,
                fu.get("operator_name", "-"),
                fu.get("result", "-")[:30] if fu.get("result") else "-",
            )
            self.followup_tree.insert("", tk.END, values=values)

    def _populate_assessment_tab(self, call_data: Dict[str, Any]):
        flags = call_data.get("assessment_flags", [])
        
        for flag_key, label in self.flag_labels.items():
            if flag_key in flags:
                label.config(text=f"● {RISK_FLAGS[flag_key]['name']}", foreground="#dc3545")
            else:
                label.config(text=f"○ {RISK_FLAGS[flag_key]['name']}", foreground="gray")
        
        current_level = call_data.get("current_risk_level", "green")
        level_names = {info["name"]: key for key, info in RISK_LEVELS.items()}
        current_level_name = RISK_LEVELS[current_level]["name"]
        self.new_risk_var.set(current_level_name)
        
        self.reasons_text.delete(1.0, tk.END)
        
        for item in self.assessment_history_tree.get_children():
            self.assessment_history_tree.delete(item)
        
        call = self.call_service.db.query(
            self.call_service.db.query.__self__.__class__.__bases__[0]
        ).filter_by(call_id=call_data["call_id"]).first() if hasattr(self.call_service, 'db') else None
        
        from app.database.models import RiskAssessment
        assessments = self.call_service.db.query(RiskAssessment).filter(
            RiskAssessment.call_record_id == call_data["id"]
        ).order_by(RiskAssessment.assessment_time.desc()).all()
        
        for assessment in assessments:
            level_name = RISK_LEVELS.get(assessment.risk_level, {"name": "未知"})["name"]
            assessor = assessment.assessed_by or ("系统" if assessment.is_system_generated else "未知")
            
            values = (
                assessment.assessment_time.strftime("%Y-%m-%d %H:%M") if assessment.assessment_time else "-",
                level_name,
                str(assessment.risk_score),
                assessor,
                (assessment.reasons or "")[:50],
            )
            self.assessment_history_tree.insert("", tk.END, values=values)

    def _populate_notes_tab(self, call_data: Dict[str, Any]):
        self.note_text.delete(1.0, tk.END)
        
        for item in self.notes_tree.get_children():
            self.notes_tree.delete(item)
        
        for note in call_data.get("supervisor_notes", []):
            values = (
                note.get("created_at", "").strftime("%Y-%m-%d %H:%M") if note.get("created_at") else "-",
                note.get("supervisor_name", "未知"),
                (note.get("note_text", "")[:80]),
            )
            self.notes_tree.insert("", tk.END, values=values)

    def _on_filter_change(self):
        self._refresh_risk_queue()

    def _import_calls(self):
        file_path = filedialog.askopenfilename(
            title="选择通话摘要文件",
            filetypes=[("JSON 文件", "*.json"), ("所有文件", "*.*")]
        )
        if not file_path:
            return
        
        try:
            count, errors = self.call_service.import_call_summaries(Path(file_path))
            
            if errors:
                error_msg = "\n".join(errors[:10])
                if len(errors) > 10:
                    error_msg += f"\n... 还有 {len(errors) - 10} 个错误"
                messagebox.showwarning("导入完成（部分错误）", f"成功导入 {count} 条记录\n\n错误:\n{error_msg}")
            else:
                messagebox.showinfo("导入成功", f"成功导入 {count} 条来电记录")
            
            self._refresh_risk_queue()
            self._refresh_statistics()
            
        except Exception as e:
            messagebox.showerror("导入失败", str(e))

    def _import_schedules(self):
        file_path = filedialog.askopenfilename(
            title="选择班表文件",
            filetypes=[("CSV 文件", "*.csv"), ("所有文件", "*.*")]
        )
        if not file_path:
            return
        
        try:
            count, errors = self.call_service.import_schedules(Path(file_path))
            
            if errors:
                error_msg = "\n".join(errors[:10])
                messagebox.showwarning("导入完成（部分错误）", f"成功导入 {count} 条排班记录\n\n错误:\n{error_msg}")
            else:
                messagebox.showinfo("导入成功", f"成功导入 {count} 条排班记录")
            
            self._refresh_statistics()
            
        except Exception as e:
            messagebox.showerror("导入失败", str(e))

    def _import_follow_ups(self):
        file_path = filedialog.askopenfilename(
            title="选择回访记录文件",
            filetypes=[("CSV 文件", "*.csv"), ("所有文件", "*.*")]
        )
        if not file_path:
            return
        
        try:
            count, errors = self.call_service.import_follow_ups(Path(file_path))
            
            if errors:
                error_msg = "\n".join(errors[:10])
                messagebox.showwarning("导入完成（部分错误）", f"成功导入 {count} 条回访记录\n\n错误:\n{error_msg}")
            else:
                messagebox.showinfo("导入成功", f"成功导入 {count} 条回访记录")
            
            self._refresh_risk_queue()
            self._refresh_statistics()
            
        except Exception as e:
            messagebox.showerror("导入失败", str(e))

    def _reassess_risk(self):
        if not self.current_call_id:
            messagebox.showwarning("提示", "请先选择一个来电记录")
            return
        
        level_name = self.new_risk_var.get()
        level_names = {info["name"]: key for key, info in RISK_LEVELS.items()}
        new_level = level_names.get(level_name, "green")
        
        reasons = self.reasons_text.get(1.0, tk.END).strip()
        if not reasons:
            messagebox.showwarning("提示", "请填写改判原因")
            return
        
        supervisor_name = self.supervisor_name_var.get().strip()
        
        try:
            self.call_service.update_risk_assessment(
                call_id=self.current_call_id,
                new_risk_level=new_level,
                reasons=reasons,
                supervisor_name=supervisor_name or None
            )
            
            messagebox.showinfo("成功", "风险等级已更新")
            
            self._refresh_risk_queue()
            self._refresh_statistics()
            
            if self.current_call_id:
                call_data = self.call_service.get_call_by_id(self.current_call_id)
                if call_data:
                    self._populate_assessment_tab(call_data)
                    self._populate_detail_tab(call_data)
            
        except Exception as e:
            messagebox.showerror("更新失败", str(e))

    def _add_supervisor_note(self):
        if not self.current_call_id:
            messagebox.showwarning("提示", "请先选择一个来电记录")
            return
        
        note_text = self.note_text.get(1.0, tk.END).strip()
        if not note_text:
            messagebox.showwarning("提示", "请输入督导意见内容")
            return
        
        supervisor_name = self.note_supervisor_var.get().strip()
        
        try:
            self.call_service.add_supervisor_note(
                call_id=self.current_call_id,
                note_text=note_text,
                supervisor_name=supervisor_name or None
            )
            
            messagebox.showinfo("成功", "督导意见已添加")
            
            self.note_text.delete(1.0, tk.END)
            
            if self.current_call_id:
                call_data = self.call_service.get_call_by_id(self.current_call_id)
                if call_data:
                    self._populate_notes_tab(call_data)
            
        except Exception as e:
            messagebox.showerror("添加失败", str(e))

    def _export_current_review(self):
        if not self.current_call_id:
            messagebox.showwarning("提示", "请先选择一个来电记录")
            return
        
        call_data = self.call_service.get_call_by_id(self.current_call_id)
        if not call_data:
            messagebox.showerror("错误", "无法获取来电数据")
            return
        
        try:
            file_path = self.export_service.export_risk_review_markdown(call_data)
            messagebox.showinfo("导出成功", f"文件已保存至:\n{file_path}")
        except Exception as e:
            messagebox.showerror("导出失败", str(e))

    def _export_todo_list(self):
        queue = self.call_service.get_risk_queue()
        todo_items = self.export_service.generate_todo_list_from_queue(queue)
        
        if not todo_items:
            messagebox.showinfo("提示", "当前没有待办事项")
            return
        
        try:
            file_path = self.export_service.export_todo_csv(todo_items)
            messagebox.showinfo("导出成功", f"文件已保存至:\n{file_path}\n\n共 {len(todo_items)} 条待办事项")
        except Exception as e:
            messagebox.showerror("导出失败", str(e))

    def _reprocess_all(self):
        if not messagebox.askyesno("确认", "这将重新评估所有来电的风险等级，确定要继续吗？"):
            return
        
        try:
            count = self.call_service.reprocess_all_assessments()
            messagebox.showinfo("完成", f"已重新评估 {count} 条来电记录")
            self._refresh_risk_queue()
            self._refresh_statistics()
        except Exception as e:
            messagebox.showerror("处理失败", str(e))

    def _show_about(self):
        messagebox.showinfo(
            "关于",
            "风险来电复盘器 v1.0\n\n"
            "社区心理热线督导工具\n\n"
            "功能:\n"
            "- 导入通话摘要、班表、回访记录\n"
            "- 自动识别自伤风险、重复来电、漏回访、转介超时\n"
            "- 查看风险队列和来电详情\n"
            "- 补充督导意见和改判风险等级\n"
            "- 导出 Markdown 复盘报告和 CSV 待办清单"
        )

    def __del__(self):
        if hasattr(self, 'db'):
            self.db.close()
