import tkinter as tk
from tkinter import ttk, filedialog, messagebox, scrolledtext
from pathlib import Path
from typing import List, Optional
import threading

from modules.file_scanner import FileScanner, ScanResult, MediaPair
from modules.srt_parser import SRTParser
from modules.rules_checker import RulesChecker, CheckIssue
from modules.review_store import ReviewStore
from modules.exporter import Exporter


class SubtitleQualityCheckerApp:
    def __init__(self, root: tk.Tk):
        self.root = root
        self.root.title("字幕交付质检台")
        self.root.geometry("1400x900")
        self.root.minsize(1200, 700)
        
        self.project_dir: Optional[Path] = None
        self.scan_result: Optional[ScanResult] = None
        self.current_issues: List[CheckIssue] = []
        self.filtered_issues: List[CheckIssue] = []
        self.review_store: Optional[ReviewStore] = None
        self.selected_issue_index: int = -1
        
        self._create_menu()
        self._create_layout()
        self._bind_events()

    def _create_menu(self):
        menubar = tk.Menu(self.root)
        self.root.config(menu=menubar)
        
        file_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="文件", menu=file_menu)
        file_menu.add_command(label="打开项目目录...", command=self._open_project, accelerator="Ctrl+O")
        file_menu.add_separator()
        file_menu.add_command(label="导出Markdown报告...", command=self._export_markdown, accelerator="Ctrl+M")
        file_menu.add_command(label="导出CSV问题清单...", command=self._export_csv, accelerator="Ctrl+S")
        file_menu.add_separator()
        file_menu.add_command(label="清除复核记录", command=self._clear_review_store)
        file_menu.add_separator()
        file_menu.add_command(label="退出", command=self.root.quit)
        
        help_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="帮助", menu=help_menu)
        help_menu.add_command(label="关于", command=self._show_about)

    def _create_layout(self):
        main_frame = ttk.Frame(self.root, padding="5")
        main_frame.pack(fill=tk.BOTH, expand=True)
        
        top_frame = ttk.Frame(main_frame)
        top_frame.pack(fill=tk.X, pady=(0, 5))
        
        ttk.Label(top_frame, text="项目目录:").pack(side=tk.LEFT, padx=(0, 5))
        self.path_var = tk.StringVar()
        self.path_entry = ttk.Entry(top_frame, textvariable=self.path_var, state='readonly')
        self.path_entry.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(0, 5))
        self.browse_btn = ttk.Button(top_frame, text="浏览...", command=self._open_project)
        self.browse_btn.pack(side=tk.LEFT, padx=(0, 5))
        self.scan_btn = ttk.Button(top_frame, text="开始质检", command=self._start_scan)
        self.scan_btn.pack(side=tk.LEFT)
        
        stats_frame = ttk.LabelFrame(main_frame, text="统计信息", padding="5")
        stats_frame.pack(fill=tk.X, pady=(0, 5))
        
        self.stats_labels = {}
        stats_items = [
            ("total", "总计"),
            ("pending", "待复核"),
            ("fixed", "已修"),
            ("ignored", "忽略"),
            ("rework", "需返工"),
            ("errors", "错误"),
            ("warnings", "警告")
        ]
        for key, label in stats_items:
            frame = ttk.Frame(stats_frame)
            frame.pack(side=tk.LEFT, padx=20)
            ttk.Label(frame, text=f"{label}:", font=("Arial", 10, "bold")).pack(side=tk.LEFT)
            self.stats_labels[key] = ttk.Label(frame, text="0", font=("Arial", 11))
            self.stats_labels[key].pack(side=tk.LEFT, padx=(5, 0))
        
        filter_frame = ttk.LabelFrame(main_frame, text="筛选条件", padding="5")
        filter_frame.pack(fill=tk.X, pady=(0, 5))
        
        ttk.Label(filter_frame, text="复核状态:").pack(side=tk.LEFT, padx=(0, 5))
        self.status_filter_var = tk.StringVar(value="全部")
        status_combo = ttk.Combobox(filter_frame, textvariable=self.status_filter_var, 
                                      values=["全部", "待复核", "已修", "忽略", "需返工"],
                                      state='readonly', width=10)
        status_combo.pack(side=tk.LEFT, padx=(0, 20))
        status_combo.bind("<<ComboboxSelected>>", self._apply_filters)
        
        ttk.Label(filter_frame, text="严重程度:").pack(side=tk.LEFT, padx=(0, 5))
        self.severity_filter_var = tk.StringVar(value="全部")
        severity_combo = ttk.Combobox(filter_frame, textvariable=self.severity_filter_var,
                                       values=["全部", "error", "warning"],
                                       state='readonly', width=10)
        severity_combo.pack(side=tk.LEFT, padx=(0, 20))
        severity_combo.bind("<<ComboboxSelected>>", self._apply_filters)
        
        ttk.Label(filter_frame, text="规则类型:").pack(side=tk.LEFT, padx=(0, 5))
        self.rule_filter_var = tk.StringVar(value="全部")
        self.rule_combo = ttk.Combobox(filter_frame, textvariable=self.rule_filter_var,
                                        values=["全部"], state='readonly', width=15)
        self.rule_combo.pack(side=tk.LEFT, padx=(0, 10))
        self.rule_combo.bind("<<ComboboxSelected>>", self._apply_filters)
        
        main_paned = ttk.PanedWindow(main_frame, orient=tk.HORIZONTAL)
        main_paned.pack(fill=tk.BOTH, expand=True)
        
        left_frame = ttk.LabelFrame(main_paned, text="文件列表", padding="5")
        main_paned.add(left_frame, weight=1)
        
        columns = ("文件名", "视频", "字幕", "状态")
        self.file_tree = ttk.Treeview(left_frame, columns=columns, show="headings", height=10)
        for col in columns:
            self.file_tree.heading(col, text=col)
            self.file_tree.column(col, width=100)
        self.file_tree.column("文件名", width=200)
        
        file_scrollbar = ttk.Scrollbar(left_frame, orient=tk.VERTICAL, command=self.file_tree.yview)
        self.file_tree.configure(yscrollcommand=file_scrollbar.set)
        
        self.file_tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        file_scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
        
        right_frame = ttk.Frame(main_paned)
        main_paned.add(right_frame, weight=3)
        
        issues_frame = ttk.LabelFrame(right_frame, text="问题列表", padding="5")
        issues_frame.pack(fill=tk.BOTH, expand=True)
        
        columns = ("#", "类型", "严重", "文件", "字幕", "时间码", "状态")
        self.issue_tree = ttk.Treeview(issues_frame, columns=columns, show="headings", height=12)
        for col in columns:
            self.issue_tree.heading(col, text=col)
            self.issue_tree.column(col, width=80)
        self.issue_tree.column("#", width=40)
        self.issue_tree.column("类型", width=100)
        self.issue_tree.column("严重", width=60)
        self.issue_tree.column("文件", width=150)
        self.issue_tree.column("字幕", width=60)
        self.issue_tree.column("时间码", width=180)
        self.issue_tree.column("状态", width=80)
        
        self.issue_tree.tag_configure("error", foreground="red")
        self.issue_tree.tag_configure("warning", foreground="orange")
        self.issue_tree.tag_configure("fixed", foreground="green")
        self.issue_tree.tag_configure("ignored", foreground="gray")
        self.issue_tree.tag_configure("rework", foreground="blue")
        
        issue_scrollbar = ttk.Scrollbar(issues_frame, orient=tk.VERTICAL, command=self.issue_tree.yview)
        self.issue_tree.configure(yscrollcommand=issue_scrollbar.set)
        
        self.issue_tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        issue_scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
        
        detail_frame = ttk.LabelFrame(right_frame, text="问题详情", padding="5")
        detail_frame.pack(fill=tk.X, pady=(5, 0))
        
        detail_paned = ttk.PanedWindow(detail_frame, orient=tk.HORIZONTAL)
        detail_paned.pack(fill=tk.BOTH, expand=True)
        
        msg_frame = ttk.Frame(detail_paned)
        detail_paned.add(msg_frame, weight=2)
        
        ttk.Label(msg_frame, text="问题描述:").pack(anchor=tk.W)
        self.message_text = scrolledtext.ScrolledText(msg_frame, height=4, wrap=tk.WORD, state='disabled')
        self.message_text.pack(fill=tk.BOTH, expand=True)
        
        ctx_frame = ttk.Frame(detail_paned)
        detail_paned.add(ctx_frame, weight=2)
        
        ttk.Label(ctx_frame, text="上下文:").pack(anchor=tk.W)
        self.context_text = scrolledtext.ScrolledText(ctx_frame, height=4, wrap=tk.WORD, state='disabled')
        self.context_text.pack(fill=tk.BOTH, expand=True)
        
        review_frame = ttk.LabelFrame(right_frame, text="复核操作", padding="5")
        review_frame.pack(fill=tk.X, pady=(5, 0))
        
        btn_frame = ttk.Frame(review_frame)
        btn_frame.pack(fill=tk.X)
        
        ttk.Button(btn_frame, text="✅ 已修", command=lambda: self._set_review_status("fixed")).pack(side=tk.LEFT, padx=5)
        ttk.Button(btn_frame, text="⏭️ 忽略", command=lambda: self._set_review_status("ignored")).pack(side=tk.LEFT, padx=5)
        ttk.Button(btn_frame, text="🔄 需返工", command=lambda: self._set_review_status("rework")).pack(side=tk.LEFT, padx=5)
        ttk.Button(btn_frame, text="⏳ 待复核", command=lambda: self._set_review_status("pending")).pack(side=tk.LEFT, padx=5)
        
        ttk.Separator(review_frame, orient=tk.VERTICAL).pack(side=tk.LEFT, fill=tk.Y, padx=10)
        
        ttk.Label(btn_frame, text="备注:").pack(side=tk.LEFT, padx=(20, 5))
        self.note_var = tk.StringVar()
        self.note_entry = ttk.Entry(btn_frame, textvariable=self.note_var, width=40)
        self.note_entry.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=5)
        
        ttk.Button(btn_frame, text="保存备注", command=self._save_note).pack(side=tk.LEFT, padx=5)
        
        self.progress_var = tk.DoubleVar()
        self.progress_bar = ttk.Progressbar(self.root, variable=self.progress_var, maximum=100)
        self.progress_bar.pack(side=tk.BOTTOM, fill=tk.X, padx=5, pady=5)
        
        self.status_var = tk.StringVar(value="就绪 - 请选择项目目录开始质检")
        self.status_label = ttk.Label(self.root, textvariable=self.status_var, relief=tk.SUNKEN, anchor=tk.W)
        self.status_label.pack(side=tk.BOTTOM, fill=tk.X)

    def _bind_events(self):
        self.issue_tree.bind("<<TreeviewSelect>>", self._on_issue_select)
        self.root.bind("<Control-o>", lambda e: self._open_project())
        self.root.bind("<Control-m>", lambda e: self._export_markdown())
        self.root.bind("<Control-s>", lambda e: self._export_csv())

    def _open_project(self):
        dir_path = filedialog.askdirectory(title="选择项目目录")
        if dir_path:
            self.project_dir = Path(dir_path)
            self.path_var.set(str(self.project_dir))
            self._reset_ui()
            self.status_var.set(f"已选择目录: {self.project_dir}")

    def _reset_ui(self):
        for item in self.file_tree.get_children():
            self.file_tree.delete(item)
        for item in self.issue_tree.get_children():
            self.issue_tree.delete(item)
        self._clear_detail()
        self.current_issues = []
        self.filtered_issues = []
        self._update_stats({})

    def _clear_detail(self):
        self.message_text.configure(state='normal')
        self.message_text.delete(1.0, tk.END)
        self.message_text.configure(state='disabled')
        self.context_text.configure(state='normal')
        self.context_text.delete(1.0, tk.END)
        self.context_text.configure(state='disabled')
        self.note_var.set("")

    def _start_scan(self):
        if not self.project_dir:
            messagebox.showwarning("警告", "请先选择项目目录")
            return
        
        self._reset_ui()
        self.progress_var.set(0)
        self.scan_btn.configure(state='disabled')
        self.browse_btn.configure(state='disabled')
        
        thread = threading.Thread(target=self._scan_worker, daemon=True)
        thread.start()

    def _scan_worker(self):
        try:
            self.status_var.set("正在扫描文件...")
            self.root.after(0, lambda: self.progress_var.set(10))
            
            scanner = FileScanner(str(self.project_dir))
            self.scan_result = scanner.scan()
            
            self.root.after(0, self._update_file_list)
            
            self.progress_var.set(30)
            self.status_var.set("正在解析字幕并加载术语表...")
            
            self.review_store = ReviewStore(self.project_dir)
            
            checker = RulesChecker()
            if self.scan_result.glossary_path:
                result = checker.load_glossary(self.scan_result.glossary_path)
                if result['loaded']:
                    self.root.after(0, lambda: self.status_var.set(
                        f"已加载术语表，共 {result['forbidden_count']} 个违禁词"
                    ))
            
            all_issues: List[CheckIssue] = []
            total_pairs = len(self.scan_result.media_pairs)
            
            for idx, pair in enumerate(self.scan_result.media_pairs):
                if pair.srt_path:
                    self.root.after(0, lambda p=pair: self.status_var.set(f"正在检查: {p.name_base}"))
                    
                    parser = SRTParser()
                    parse_result = parser.parse(pair.srt_path)
                    
                    for err in parse_result.errors:
                        all_issues.append(CheckIssue(
                            issue_id=f"{pair.srt_path}_parse_{err.get('line', 0)}",
                            rule_type="解析错误",
                            severity="error",
                            file=str(pair.srt_path),
                            subtitle_index=err.get('line', 0),
                            timecode="",
                            message=err.get('message', '解析错误'),
                            context=""
                        ))
                    
                    if parse_result.entries:
                        issues = checker.check_all(
                            parse_result.entries,
                            pair.srt_path,
                            pair.video_duration
                        )
                        all_issues.extend(issues)
                
                progress = 30 + (idx + 1) / max(total_pairs, 1) * 60
                self.root.after(0, lambda p=progress: self.progress_var.set(p))
            
            for err in self.scan_result.errors:
                all_issues.append(CheckIssue(
                    issue_id=f"naming_{err.get('file', '')}_{hash(err.get('message', ''))}",
                    rule_type="命名问题",
                    severity="error",
                    file=err.get('file', ''),
                    subtitle_index=0,
                    timecode="",
                    message=err.get('message', '命名不一致'),
                    context=""
                ))
            
            self.review_store.apply_to_issues(all_issues)
            
            self.current_issues = all_issues
            self.filtered_issues = all_issues
            
            self.root.after(0, self._update_issue_list)
            self.root.after(0, self._update_rule_combo)
            
            self.progress_var.set(100)
            self.status_var.set(f"质检完成，共发现 {len(all_issues)} 个问题")
            
        except Exception as e:
            self.root.after(0, lambda: messagebox.showerror("错误", f"质检过程中发生错误: {e}"))
            self.root.after(0, lambda: self.status_var.set("质检失败"))
        finally:
            self.root.after(0, lambda: self.scan_btn.configure(state='normal'))
            self.root.after(0, lambda: self.browse_btn.configure(state='normal'))

    def _update_file_list(self):
        if not self.scan_result:
            return
        
        for pair in self.scan_result.media_pairs:
            status = "正常"
            if pair.video_path and pair.srt_path:
                status = "匹配"
            elif pair.video_path:
                status = "缺字幕"
            elif pair.srt_path:
                status = "缺视频"
            
            self.file_tree.insert("", tk.END, values=(
                pair.name_base,
                "有" if pair.video_path else "无",
                "有" if pair.srt_path else "无",
                status
            ))

    def _update_issue_list(self):
        for item in self.issue_tree.get_children():
            self.issue_tree.delete(item)
        
        for idx, issue in enumerate(self.filtered_issues, 1):
            file_name = Path(issue.file).name if issue.file else ""
            tags = [issue.severity]
            if issue.review_status == "fixed":
                tags.append("fixed")
            elif issue.review_status == "ignored":
                tags.append("ignored")
            elif issue.review_status == "rework":
                tags.append("rework")
            
            self.issue_tree.insert("", tk.END, values=(
                idx,
                issue.rule_type,
                issue.severity,
                file_name,
                issue.subtitle_index if issue.subtitle_index > 0 else "-",
                issue.timecode,
                ReviewStore.STATUS_LABELS.get(issue.review_status, issue.review_status)
            ), tags=tuple(tags))
        
        self._update_stats(self._calculate_current_stats())

    def _update_rule_combo(self):
        rule_types = set()
        for issue in self.current_issues:
            rule_types.add(issue.rule_type)
        
        values = ["全部"] + sorted(list(rule_types))
        self.rule_combo['values'] = values
        self.rule_filter_var.set("全部")

    def _apply_filters(self, event=None):
        status_filter = self.status_filter_var.get()
        severity_filter = self.severity_filter_var.get()
        rule_filter = self.rule_filter_var.get()
        
        status_map = {
            "全部": None,
            "待复核": "pending",
            "已修": "fixed",
            "忽略": "ignored",
            "需返工": "rework"
        }
        
        filtered = []
        for issue in self.current_issues:
            if status_map.get(status_filter) and issue.review_status != status_map.get(status_filter):
                continue
            if severity_filter != "全部" and issue.severity != severity_filter:
                continue
            if rule_filter != "全部" and issue.rule_type != rule_filter:
                continue
            filtered.append(issue)
        
        self.filtered_issues = filtered
        self._update_issue_list()
        self._clear_detail()

    def _on_issue_select(self, event=None):
        selection = self.issue_tree.selection()
        if not selection:
            return
        
        item = selection[0]
        idx = self.issue_tree.index(item)
        
        if 0 <= idx < len(self.filtered_issues):
            self.selected_issue_index = idx
            issue = self.filtered_issues[idx]
            
            self.message_text.configure(state='normal')
            self.message_text.delete(1.0, tk.END)
            self.message_text.insert(tk.END, issue.message)
            self.message_text.configure(state='disabled')
            
            self.context_text.configure(state='normal')
            self.context_text.delete(1.0, tk.END)
            self.context_text.insert(tk.END, issue.context)
            self.context_text.configure(state='disabled')
            
            self.note_var.set(issue.review_note or "")

    def _set_review_status(self, status: str):
        if self.selected_issue_index < 0 or self.selected_issue_index >= len(self.filtered_issues):
            return
        
        if not self.review_store:
            return
        
        issue = self.filtered_issues[self.selected_issue_index]
        note = self.note_var.get()
        
        self.review_store.update_issue(issue.issue_id, status, note)
        issue.review_status = status
        issue.review_note = note
        
        self.review_store.save()
        
        self._update_issue_list()
        
        selection = self.issue_tree.selection()
        if selection:
            self.issue_tree.see(selection[0])
        
        self.status_var.set(f"已设置问题状态: {ReviewStore.STATUS_LABELS.get(status, status)}")

    def _save_note(self):
        if self.selected_issue_index < 0 or self.selected_issue_index >= len(self.filtered_issues):
            return
        
        if not self.review_store:
            return
        
        issue = self.filtered_issues[self.selected_issue_index]
        note = self.note_var.get()
        
        self.review_store.update_issue(issue.issue_id, issue.review_status, note)
        issue.review_note = note
        self.review_store.save()
        
        self.status_var.set("备注已保存")

    def _calculate_current_stats(self) -> dict:
        stats = {
            "total": len(self.current_issues),
            "pending": 0,
            "fixed": 0,
            "ignored": 0,
            "rework": 0,
            "errors": 0,
            "warnings": 0
        }
        
        for issue in self.current_issues:
            if issue.review_status in stats:
                stats[issue.review_status] += 1
            if issue.severity == "error":
                stats["errors"] += 1
            elif issue.severity == "warning":
                stats["warnings"] += 1
        
        return stats

    def _update_stats(self, stats: dict):
        for key in self.stats_labels:
            self.stats_labels[key].configure(text=str(stats.get(key, 0)))

    def _export_markdown(self):
        if not self.current_issues or not self.project_dir:
            messagebox.showwarning("警告", "没有可导出的数据，请先运行质检")
            return
        
        default_name = f"质检报告_{Path(self.project_dir).name}.md"
        file_path = filedialog.asksaveasfilename(
            title="导出Markdown报告",
            defaultextension=".md",
            initialfile=default_name,
            filetypes=[("Markdown文件", "*.md"), ("所有文件", "*.*")]
        )
        
        if file_path:
            exporter = Exporter(self.project_dir, self.current_issues, self.review_store)
            if exporter.export_markdown(Path(file_path)):
                messagebox.showinfo("成功", f"报告已导出到: {file_path}")
                self.status_var.set(f"Markdown报告已导出: {file_path}")
            else:
                messagebox.showerror("错误", "导出失败")

    def _export_csv(self):
        if not self.current_issues or not self.project_dir:
            messagebox.showwarning("警告", "没有可导出的数据，请先运行质检")
            return
        
        default_name = f"问题清单_{Path(self.project_dir).name}.csv"
        file_path = filedialog.asksaveasfilename(
            title="导出CSV问题清单",
            defaultextension=".csv",
            initialfile=default_name,
            filetypes=[("CSV文件", "*.csv"), ("所有文件", "*.*")]
        )
        
        if file_path:
            exporter = Exporter(self.project_dir, self.current_issues, self.review_store)
            if exporter.export_csv(Path(file_path)):
                messagebox.showinfo("成功", f"CSV文件已导出到: {file_path}")
                self.status_var.set(f"CSV问题清单已导出: {file_path}")
            else:
                messagebox.showerror("错误", "导出失败")

    def _clear_review_store(self):
        if not self.review_store:
            return
        
        if messagebox.askyesno("确认", "确定要清除所有复核记录吗？此操作不可撤销。"):
            self.review_store.clear()
            for issue in self.current_issues:
                issue.review_status = "pending"
                issue.review_note = ""
            self._update_issue_list()
            self._clear_detail()
            self.status_var.set("复核记录已清除")

    def _show_about(self):
        messagebox.showinfo(
            "关于",
            "字幕交付质检台 v1.0\n\n"
            "功能:\n"
            "- 自动匹配视频和字幕文件\n"
            "- 检查字幕重叠、空行、超长行\n"
            "- 检查时间轴越界、无效\n"
            "- 检查违禁词和术语规范\n"
            "- 问题复核与状态管理\n"
            "- 导出Markdown报告和CSV清单\n\n"
            "快捷键:\n"
            "Ctrl+O - 打开项目目录\n"
            "Ctrl+M - 导出Markdown报告\n"
            "Ctrl+S - 导出CSV清单"
        )


def run_app():
    root = tk.Tk()
    app = SubtitleQualityCheckerApp(root)
    root.mainloop()
