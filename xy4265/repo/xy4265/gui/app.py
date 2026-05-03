#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
条款红线落点器 - GUI主应用
"""

import os
import sys
import tkinter as tk
from tkinter import ttk, messagebox, filedialog, scrolledtext
from pathlib import Path
from typing import List, Dict, Any, Optional

project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from models.data_models import (
    Project, Clause, RiskItem, RedlineRule, ApprovalComment,
    RiskLevel, RiskStatus, ReviewStatus
)
from parser.clause_parser import ClauseParser
from parser.comment_parser import CommentParser
from parser.redline_parser import RedlineParser
from parser.validator import DataValidator, ValidationError
from rules.rule_engine import RuleEngine
from storage.project_store import ProjectStore
from exporters.markdown_exporter import MarkdownExporter
from exporters.csv_exporter import CSVExporter
from exporters.json_audit_exporter import JSONAuditExporter


class ClauseRedlineApp:
    """条款红线落点器主应用"""
    
    def __init__(self, root: tk.Tk):
        self.root = root
        self.root.title("条款红线落点器 - 法务合同复核工具")
        self.root.geometry("1400x900")
        self.root.minsize(1200, 700)
        
        self.current_project: Optional[Project] = None
        self.project_store = ProjectStore()
        self.rule_engine = RuleEngine()
        self.selected_risk: Optional[RiskItem] = None
        self.selected_clause: Optional[Clause] = None
        
        self._create_menu()
        self._create_main_layout()
        self._initialize_status()
    
    def _create_menu(self):
        """创建菜单栏"""
        menubar = tk.Menu(self.root)
        self.root.config(menu=menubar)
        
        file_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="文件", menu=file_menu)
        file_menu.add_command(label="新建项目", command=self._new_project)
        file_menu.add_command(label="打开项目", command=self._open_project)
        file_menu.add_separator()
        file_menu.add_command(label="导入条款JSON", command=self._import_clauses)
        file_menu.add_command(label="导入审批意见CSV", command=self._import_comments)
        file_menu.add_command(label="导入客户红线YAML", command=self._import_redlines)
        file_menu.add_separator()
        file_menu.add_command(label="保存项目", command=self._save_project)
        file_menu.add_command(label="另存为...", command=self._save_project_as)
        file_menu.add_separator()
        file_menu.add_command(label="退出", command=self.root.quit)
        
        export_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="导出", menu=export_menu)
        export_menu.add_command(label="Markdown复核单", command=self._export_markdown)
        export_menu.add_command(label="CSV风险表", command=self._export_csv)
        export_menu.add_command(label="CSV统计汇总", command=self._export_csv_summary)
        export_menu.add_command(label="JSON审计包", command=self._export_audit)
        
        tools_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="工具", menu=tools_menu)
        tools_menu.add_command(label="重新分析风险", command=self._reanalyze_risks)
        tools_menu.add_command(label="检测重复风险", command=self._detect_duplicates)
        tools_menu.add_separator()
        tools_menu.add_command(label="清除所有决策", command=self._clear_decisions)
        
        help_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="帮助", menu=help_menu)
        help_menu.add_command(label="关于", command=self._show_about)
    
    def _create_main_layout(self):
        """创建主布局"""
        self.paned_window = ttk.PanedWindow(self.root, orient=tk.HORIZONTAL)
        self.paned_window.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)
        
        left_frame = ttk.Frame(self.paned_window, width=300)
        self.paned_window.add(left_frame, weight=1)
        
        notebook = ttk.Notebook(left_frame)
        notebook.pack(fill=tk.BOTH, expand=True)
        
        clauses_frame = ttk.Frame(notebook)
        notebook.add(clauses_frame, text="条款树")
        
        risks_frame = ttk.Frame(notebook)
        notebook.add(risks_frame, text="风险列表")
        
        self._create_clauses_tree(clauses_frame)
        self._create_risks_list(risks_frame)
        
        right_frame = ttk.Frame(self.paned_window)
        self.paned_window.add(right_frame, weight=3)
        
        self._create_detail_panel(right_frame)
        
        self.status_bar = ttk.Frame(self.root)
        self.status_bar.pack(fill=tk.X, padx=5, pady=5)
        
        self.status_label = ttk.Label(self.status_bar, text="就绪")
        self.status_label.pack(side=tk.LEFT)
        
        self.project_label = ttk.Label(self.status_bar, text="无项目")
        self.project_label.pack(side=tk.RIGHT)
    
    def _create_clauses_tree(self, parent):
        """创建条款树视图"""
        columns = ("title", "risk_count")
        self.clause_tree = ttk.Treeview(parent, columns=columns, show="tree headings")
        
        self.clause_tree.heading("title", text="条款标题")
        self.clause_tree.heading("risk_count", text="风险数")
        self.clause_tree.column("title", width=200)
        self.clause_tree.column("risk_count", width=60, anchor=tk.CENTER)
        
        scrollbar_y = ttk.Scrollbar(parent, orient=tk.VERTICAL, command=self.clause_tree.yview)
        scrollbar_x = ttk.Scrollbar(parent, orient=tk.HORIZONTAL, command=self.clause_tree.xview)
        self.clause_tree.configure(yscrollcommand=scrollbar_y.set, xscrollcommand=scrollbar_x.set)
        
        self.clause_tree.grid(row=0, column=0, sticky="nsew")
        scrollbar_y.grid(row=0, column=1, sticky="ns")
        scrollbar_x.grid(row=1, column=0, sticky="ew")
        
        parent.grid_rowconfigure(0, weight=1)
        parent.grid_columnconfigure(0, weight=1)
        
        self.clause_tree.bind("<<TreeviewSelect>>", self._on_clause_selected)
    
    def _create_risks_list(self, parent):
        """创建风险列表视图"""
        columns = ("level", "status", "clause", "keywords", "is_duplicate")
        self.risk_tree = ttk.Treeview(parent, columns=columns, show="headings")
        
        self.risk_tree.heading("level", text="级别")
        self.risk_tree.heading("status", text="状态")
        self.risk_tree.heading("clause", text="条款")
        self.risk_tree.heading("keywords", text="命中关键词")
        self.risk_tree.heading("is_duplicate", text="重复")
        
        self.risk_tree.column("level", width=50, anchor=tk.CENTER)
        self.risk_tree.column("status", width=60, anchor=tk.CENTER)
        self.risk_tree.column("clause", width=120)
        self.risk_tree.column("keywords", width=150)
        self.risk_tree.column("is_duplicate", width=40, anchor=tk.CENTER)
        
        scrollbar_y = ttk.Scrollbar(parent, orient=tk.VERTICAL, command=self.risk_tree.yview)
        scrollbar_x = ttk.Scrollbar(parent, orient=tk.HORIZONTAL, command=self.risk_tree.xview)
        self.risk_tree.configure(yscrollcommand=scrollbar_y.set, xscrollcommand=scrollbar_x.set)
        
        self.risk_tree.grid(row=0, column=0, sticky="nsew")
        scrollbar_y.grid(row=0, column=1, sticky="ns")
        scrollbar_x.grid(row=1, column=0, sticky="ew")
        
        parent.grid_rowconfigure(0, weight=1)
        parent.grid_columnconfigure(0, weight=1)
        
        self.risk_tree.bind("<<TreeviewSelect>>", self._on_risk_selected)
    
    def _create_detail_panel(self, parent):
        """创建详情面板"""
        detail_notebook = ttk.Notebook(parent)
        detail_notebook.pack(fill=tk.BOTH, expand=True)
        
        detail_frame = ttk.Frame(detail_notebook)
        detail_notebook.add(detail_frame, text="风险详情")
        
        action_frame = ttk.Frame(detail_notebook)
        detail_notebook.add(action_frame, text="复核操作")
        
        content_frame = ttk.Frame(detail_notebook)
        detail_notebook.add(content_frame, text="条款内容")
        
        self._create_detail_view(detail_frame)
        self._create_action_view(action_frame)
        self._create_content_view(content_frame)
    
    def _create_detail_view(self, parent):
        """创建详情视图"""
        canvas = tk.Canvas(parent)
        scrollbar = ttk.Scrollbar(parent, orient="vertical", command=canvas.yview)
        scrollable_frame = ttk.Frame(canvas)
        
        scrollable_frame.bind(
            "<Configure>",
            lambda e: canvas.configure(scrollregion=canvas.bbox("all"))
        )
        
        canvas.create_window((0, 0), window=scrollable_frame, anchor="nw")
        canvas.configure(yscrollcommand=scrollbar.set)
        
        canvas.pack(side="left", fill="both", expand=True)
        scrollbar.pack(side="right", fill="y")
        
        info_frame = ttk.LabelFrame(scrollable_frame, text="基本信息", padding=10)
        info_frame.pack(fill=tk.X, padx=5, pady=5)
        
        self.detail_labels = {}
        fields = [
            ("风险ID:", "risk_id"),
            ("条款ID:", "clause_id"),
            ("规则ID:", "rule_id"),
            ("风险级别:", "risk_level"),
            ("风险类型:", "risk_type"),
            ("处理状态:", "status"),
            ("是否重复:", "is_duplicate"),
        ]
        
        for i, (label_text, key) in enumerate(fields):
            ttk.Label(info_frame, text=label_text).grid(row=i, column=0, sticky=tk.W, padx=5, pady=2)
            value_label = ttk.Label(info_frame, text="-")
            value_label.grid(row=i, column=1, sticky=tk.W, padx=5, pady=2)
            self.detail_labels[key] = value_label
        
        keywords_frame = ttk.LabelFrame(scrollable_frame, text="命中关键词", padding=10)
        keywords_frame.pack(fill=tk.X, padx=5, pady=5)
        
        self.keywords_text = tk.Text(keywords_frame, height=3, wrap=tk.WORD)
        self.keywords_text.pack(fill=tk.X, padx=5, pady=5)
        
        note_frame = ttk.LabelFrame(scrollable_frame, text="复核备注", padding=10)
        note_frame.pack(fill=tk.X, padx=5, pady=5)
        
        self.note_text = tk.Text(note_frame, height=4, wrap=tk.WORD)
        self.note_text.pack(fill=tk.X, padx=5, pady=5)
    
    def _create_action_view(self, parent):
        """创建复核操作视图"""
        controls_frame = ttk.Frame(parent, padding=20)
        controls_frame.pack(fill=tk.BOTH, expand=True)
        
        ttk.Label(controls_frame, text="选择操作:", font=("", 12, "bold")).pack(anchor=tk.W, pady=(0, 10))
        
        actions = [
            ("确认风险 - 需要修改", RiskStatus.CONFIRMED),
            ("驳回 - 无需修改", RiskStatus.DISMISSED),
            ("标记为已解决", RiskStatus.RESOLVED),
            ("重置为待处理", RiskStatus.PENDING),
        ]
        
        for text, status in actions:
            btn = ttk.Button(
                controls_frame,
                text=text,
                command=lambda s=status: self._update_risk_status(s)
            )
            btn.pack(fill=tk.X, pady=5)
        
        ttk.Separator(controls_frame, orient=tk.HORIZONTAL).pack(fill=tk.X, pady=20)
        
        batch_frame = ttk.LabelFrame(controls_frame, text="批量操作", padding=10)
        batch_frame.pack(fill=tk.X, pady=10)
        
        ttk.Button(
            batch_frame,
            text="全选所有待处理风险",
            command=self._select_all_pending
        ).pack(fill=tk.X, pady=2)
        
        ttk.Button(
            batch_frame,
            text="导出当前筛选结果",
            command=self._export_filtered
        ).pack(fill=tk.X, pady=2)
        
        stats_frame = ttk.LabelFrame(controls_frame, text="统计信息", padding=10)
        stats_frame.pack(fill=tk.X, pady=10)
        
        self.stats_text = tk.Text(stats_frame, height=8, wrap=tk.WORD, state=tk.DISABLED)
        self.stats_text.pack(fill=tk.X, padx=5, pady=5)
    
    def _create_content_view(self, parent):
        """创建条款内容视图"""
        controls_frame = ttk.Frame(parent)
        controls_frame.pack(fill=tk.X, padx=5, pady=5)
        
        ttk.Label(controls_frame, text="条款标题:").pack(side=tk.LEFT)
        self.content_title_label = ttk.Label(controls_frame, text="-", font=("", 10, "bold"))
        self.content_title_label.pack(side=tk.LEFT, padx=10)
        
        content_frame = ttk.Frame(parent)
        content_frame.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)
        
        self.content_text = scrolledtext.ScrolledText(
            content_frame,
            wrap=tk.WORD,
            font=("Monaco", 11),
            state=tk.DISABLED
        )
        self.content_text.pack(fill=tk.BOTH, expand=True)
    
    def _initialize_status(self):
        """初始化状态"""
        self._update_status("就绪 - 请新建或打开项目")
        self._update_stats()
    
    def _new_project(self):
        """新建项目"""
        dialog = tk.Toplevel(self.root)
        dialog.title("新建项目")
        dialog.geometry("400x200")
        dialog.transient(self.root)
        dialog.grab_set()
        
        ttk.Label(dialog, text="项目名称:", font=("", 11)).pack(anchor=tk.W, padx=20, pady=(20, 5))
        name_entry = ttk.Entry(dialog, width=40)
        name_entry.pack(fill=tk.X, padx=20, pady=5)
        
        ttk.Label(dialog, text="描述:", font=("", 11)).pack(anchor=tk.W, padx=20, pady=5)
        desc_entry = ttk.Entry(dialog, width=40)
        desc_entry.pack(fill=tk.X, padx=20, pady=5)
        
        def create():
            name = name_entry.get().strip()
            if not name:
                messagebox.showwarning("警告", "请输入项目名称")
                return
            
            self.current_project = self.project_store.create_new_project(
                name=name,
                description=desc_entry.get().strip()
            )
            dialog.destroy()
            self._update_status(f"已创建新项目: {name}")
            self._update_project_label()
            self._refresh_all()
        
        btn_frame = ttk.Frame(dialog)
        btn_frame.pack(fill=tk.X, padx=20, pady=20)
        
        ttk.Button(btn_frame, text="创建", command=create).pack(side=tk.RIGHT, padx=5)
        ttk.Button(btn_frame, text="取消", command=dialog.destroy).pack(side=tk.RIGHT)
    
    def _open_project(self):
        """打开项目"""
        projects = self.project_store.list_projects()
        
        if not projects:
            messagebox.showinfo("提示", "没有已保存的项目")
            return
        
        dialog = tk.Toplevel(self.root)
        dialog.title("打开项目")
        dialog.geometry("500x400")
        dialog.transient(self.root)
        dialog.grab_set()
        
        columns = ("name", "version", "status", "updated")
        tree = ttk.Treeview(dialog, columns=columns, show="headings")
        
        tree.heading("name", text="项目名称")
        tree.heading("version", text="版本")
        tree.heading("status", text="状态")
        tree.heading("updated", text="更新时间")
        
        tree.column("name", width=200)
        tree.column("version", width=60)
        tree.column("status", width=80)
        tree.column("updated", width=150)
        
        for proj in projects:
            status_map = {
                "not_reviewed": "未复核",
                "in_review": "复核中",
                "approved": "已通过",
                "rejected": "已驳回"
            }
            status = status_map.get(proj.get("review_status", ""), proj.get("review_status", ""))
            updated = proj.get("updated_at", "")[:19] if proj.get("updated_at") else ""
            
            tree.insert("", tk.END, values=(
                proj.get("name", ""),
                proj.get("version", "v1"),
                status,
                updated
            ), iid=proj.get("project_id", ""))
        
        scrollbar = ttk.Scrollbar(dialog, orient=tk.VERTICAL, command=tree.yview)
        tree.configure(yscrollcommand=scrollbar.set)
        
        tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, padx=10, pady=10)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
        
        def open_selected():
            selection = tree.selection()
            if not selection:
                messagebox.showwarning("警告", "请选择一个项目")
                return
            
            project_id = selection[0]
            self.current_project = self.project_store.load_project(project_id)
            
            if self.current_project:
                dialog.destroy()
                self._update_status(f"已打开项目: {self.current_project.name}")
                self._update_project_label()
                self._refresh_all()
            else:
                messagebox.showerror("错误", "无法加载项目")
        
        btn_frame = ttk.Frame(dialog)
        btn_frame.pack(fill=tk.X, padx=10, pady=10)
        
        ttk.Button(btn_frame, text="打开", command=open_selected).pack(side=tk.RIGHT, padx=5)
        ttk.Button(btn_frame, text="取消", command=dialog.destroy).pack(side=tk.RIGHT)
    
    def _import_clauses(self):
        """导入条款JSON"""
        if not self.current_project:
            messagebox.showwarning("警告", "请先创建或打开项目")
            return
        
        file_path = filedialog.askopenfilename(
            title="选择条款JSON文件",
            filetypes=[("JSON文件", "*.json"), ("所有文件", "*.*")]
        )
        
        if file_path:
            try:
                clauses = ClauseParser.parse_file(file_path)
                
                errors = DataValidator.validate_clauses(clauses)
                if errors:
                    error_text = "\n".join(str(e) for e in errors[:10])
                    if len(errors) > 10:
                        error_text += f"\n... 还有 {len(errors) - 10} 个问题"
                    messagebox.showwarning("校验警告", f"发现以下问题:\n{error_text}")
                
                self.current_project.clauses = clauses
                self._update_status(f"已导入 {len(clauses)} 个根条款")
                self._reanalyze_risks()
                
            except Exception as e:
                messagebox.showerror("错误", f"导入失败: {str(e)}")
    
    def _import_comments(self):
        """导入审批意见CSV"""
        if not self.current_project:
            messagebox.showwarning("警告", "请先创建或打开项目")
            return
        
        file_path = filedialog.askopenfilename(
            title="选择审批意见CSV文件",
            filetypes=[("CSV文件", "*.csv"), ("所有文件", "*.*")]
        )
        
        if file_path:
            try:
                comments = CommentParser.parse_file(file_path)
                
                errors = DataValidator.validate_comments(comments)
                if errors:
                    error_text = "\n".join(str(e) for e in errors[:10])
                    if len(errors) > 10:
                        error_text += f"\n... 还有 {len(errors) - 10} 个问题"
                    messagebox.showwarning("校验警告", f"发现以下问题:\n{error_text}")
                
                self.current_project.comments = comments
                self._update_status(f"已导入 {len(comments)} 条审批意见")
                self._reanalyze_risks()
                
            except Exception as e:
                messagebox.showerror("错误", f"导入失败: {str(e)}")
    
    def _import_redlines(self):
        """导入客户红线YAML"""
        if not self.current_project:
            messagebox.showwarning("警告", "请先创建或打开项目")
            return
        
        file_path = filedialog.askopenfilename(
            title="选择客户红线YAML文件",
            filetypes=[("YAML文件", "*.yaml;*.yml"), ("所有文件", "*.*")]
        )
        
        if file_path:
            try:
                rules = RedlineParser.parse_file(file_path)
                
                errors = DataValidator.validate_rules(rules)
                if errors:
                    error_text = "\n".join(str(e) for e in errors[:10])
                    if len(errors) > 10:
                        error_text += f"\n... 还有 {len(errors) - 10} 个问题"
                    messagebox.showwarning("校验警告", f"发现以下问题:\n{error_text}")
                
                self.current_project.rules = rules
                self._update_status(f"已导入 {len(rules)} 条红线规则")
                self._reanalyze_risks()
                
            except Exception as e:
                messagebox.showerror("错误", f"导入失败: {str(e)}")
    
    def _save_project(self):
        """保存项目"""
        if not self.current_project:
            messagebox.showwarning("警告", "没有可保存的项目")
            return
        
        try:
            self.project_store.save_project(self.current_project)
            self._update_status("项目已保存")
        except Exception as e:
            messagebox.showerror("错误", f"保存失败: {str(e)}")
    
    def _save_project_as(self):
        """另存为..."""
        if not self.current_project:
            messagebox.showwarning("警告", "没有可保存的项目")
            return
        
        file_path = filedialog.asksaveasfilename(
            title="保存项目",
            defaultextension=".json",
            filetypes=[("JSON文件", "*.json"), ("所有文件", "*.*")]
        )
        
        if file_path:
            try:
                from storage.project_store import ProjectSerializer
                serializer = ProjectSerializer()
                data = serializer.to_dict(self.current_project)
                
                import json
                with open(file_path, 'w', encoding='utf-8') as f:
                    json.dump(data, f, ensure_ascii=False, indent=2)
                
                self._update_status(f"项目已导出到: {file_path}")
            except Exception as e:
                messagebox.showerror("错误", f"保存失败: {str(e)}")
    
    def _reanalyze_risks(self):
        """重新分析风险"""
        if not self.current_project:
            return
        
        clauses = self.current_project.clauses
        rules = self.current_project.rules
        comments = self.current_project.comments
        
        if not clauses and not rules and not comments:
            self._update_status("没有可分析的数据")
            return
        
        risks = self.rule_engine.analyze_project(clauses, rules, comments)
        
        old_risks = {r.risk_id: r for r in self.current_project.risks}
        for risk in risks:
            if risk.risk_id in old_risks:
                old_risk = old_risks[risk.risk_id]
                risk.status = old_risk.status
                risk.reviewer_note = old_risk.reviewer_note
        
        self.current_project.risks = risks
        self._update_status(f"分析完成: 发现 {len(risks)} 个风险项")
        self._refresh_all()
        self._save_project()
    
    def _detect_duplicates(self):
        """检测重复风险"""
        if not self.current_project or not self.current_project.risks:
            messagebox.showinfo("提示", "没有风险数据")
            return
        
        risks = self.current_project.risks
        duplicate_count = sum(1 for r in risks if r.is_duplicate)
        
        if duplicate_count > 0:
            messagebox.showinfo("重复检测", f"已标记 {duplicate_count} 个重复风险项")
        else:
            messagebox.showinfo("重复检测", "未发现重复风险项")
        
        self._refresh_risks_list()
    
    def _clear_decisions(self):
        """清除所有决策"""
        if not self.current_project or not self.current_project.risks:
            return
        
        if messagebox.askyesno("确认", "确定要清除所有复核决策吗？"):
            for risk in self.current_project.risks:
                risk.status = RiskStatus.PENDING
                risk.reviewer_note = ""
            
            self._update_status("已清除所有决策")
            self._refresh_all()
            self._save_project()
    
    def _refresh_all(self):
        """刷新所有视图"""
        self._refresh_clause_tree()
        self._refresh_risks_list()
        self._update_stats()
    
    def _refresh_clause_tree(self):
        """刷新条款树"""
        for item in self.clause_tree.get_children():
            self.clause_tree.delete(item)
        
        if not self.current_project:
            return
        
        clauses = self.current_project.clauses
        risks = self.current_project.risks
        
        clause_risk_count = {}
        for risk in risks:
            clause_risk_count[risk.clause_id] = clause_risk_count.get(risk.clause_id, 0) + 1
        
        def add_children(parent_clause, parent_item):
            for child in parent_clause.children:
                risk_count = clause_risk_count.get(child.clause_id, 0)
                item = self.clause_tree.insert(
                    parent_item,
                    tk.END,
                    text=child.clause_id,
                    values=(child.title, risk_count if risk_count > 0 else "")
                )
                add_children(child, item)
        
        for clause in clauses:
            risk_count = clause_risk_count.get(clause.clause_id, 0)
            item = self.clause_tree.insert(
                "",
                tk.END,
                text=clause.clause_id,
                values=(clause.title, risk_count if risk_count > 0 else "")
            )
            add_children(clause, item)
    
    def _refresh_risks_list(self):
        """刷新风险列表"""
        for item in self.risk_tree.get_children():
            self.risk_tree.delete(item)
        
        if not self.current_project:
            return
        
        risks = self.current_project.risks
        
        level_icons = {
            RiskLevel.CRITICAL: "🔴",
            RiskLevel.HIGH: "🟠",
            RiskLevel.MEDIUM: "🟡",
            RiskLevel.LOW: "🟢"
        }
        
        status_text = {
            RiskStatus.PENDING: "待处理",
            RiskStatus.CONFIRMED: "已确认",
            RiskStatus.RESOLVED: "已解决",
            RiskStatus.DISMISSED: "已驳回"
        }
        
        clause_map = self._build_clause_map()
        
        for risk in risks:
            level_icon = level_icons.get(risk.risk_level, "⚪")
            status = status_text.get(risk.status, str(risk.status))
            
            clause = clause_map.get(risk.clause_id)
            clause_title = clause.title if clause else risk.clause_id
            
            keywords = ", ".join(risk.matched_keywords) if risk.matched_keywords else "-"
            duplicate_mark = "是" if risk.is_duplicate else ""
            
            self.risk_tree.insert(
                "",
                tk.END,
                values=(level_icon, status, clause_title, keywords, duplicate_mark),
                iid=risk.risk_id
            )
    
    def _build_clause_map(self) -> Dict[str, Clause]:
        """构建条款ID映射"""
        if not self.current_project:
            return {}
        
        def _flatten(clauses: List[Clause]) -> Dict[str, Clause]:
            result = {}
            for clause in clauses:
                result[clause.clause_id] = clause
                result.update(_flatten(clause.children))
            return result
        
        return _flatten(self.current_project.clauses)
    
    def _update_stats(self):
        """更新统计信息"""
        self.stats_text.config(state=tk.NORMAL)
        self.stats_text.delete(1.0, tk.END)
        
        if not self.current_project or not self.current_project.risks:
            self.stats_text.insert(tk.END, "暂无数据\n")
            self.stats_text.config(state=tk.DISABLED)
            return
        
        risks = self.current_project.risks
        rules = self.current_project.rules
        
        critical_count = sum(1 for r in risks if r.risk_level == RiskLevel.CRITICAL)
        high_count = sum(1 for r in risks if r.risk_level == RiskLevel.HIGH)
        medium_count = sum(1 for r in risks if r.risk_level == RiskLevel.MEDIUM)
        low_count = sum(1 for r in risks if r.risk_level == RiskLevel.LOW)
        
        pending_count = sum(1 for r in risks if r.status == RiskStatus.PENDING)
        confirmed_count = sum(1 for r in risks if r.status == RiskStatus.CONFIRMED)
        resolved_count = sum(1 for r in risks if r.status == RiskStatus.RESOLVED)
        dismissed_count = sum(1 for r in risks if r.status == RiskStatus.DISMISSED)
        
        duplicate_count = sum(1 for r in risks if r.is_duplicate)
        mandatory_rules = [r for r in rules if r.is_mandatory]
        mandatory_risks = [
            r for r in risks
            if r.rule_id in [mr.rule_id for mr in mandatory_rules]
        ]
        unresolved_mandatory = [
            r for r in mandatory_risks
            if r.status in (RiskStatus.PENDING, RiskStatus.CONFIRMED)
        ]
        
        stats_text = f"""风险统计:
  🔴 严重: {critical_count}
  🟠 高:   {high_count}
  🟡 中:   {medium_count}
  🟢 低:   {low_count}

处理状态:
  ⏳ 待处理:  {pending_count}
  ✅ 已确认:  {confirmed_count}
  ✔️ 已解决:  {resolved_count}
  ❌ 已驳回:  {dismissed_count}

其他:
  🔄 重复风险: {duplicate_count}
  ⚠️ 必改规则: {len(mandatory_rules)} 条
  ⚠️ 未解决必改: {len(unresolved_mandatory)} 项"""
        
        self.stats_text.insert(tk.END, stats_text)
        self.stats_text.config(state=tk.DISABLED)
    
    def _on_clause_selected(self, event):
        """条款选择事件"""
        selection = self.clause_tree.selection()
        if not selection:
            return
        
        clause_id = selection[0]
        clause_map = self._build_clause_map()
        
        self.selected_clause = clause_map.get(clause_id)
        
        if self.selected_clause:
            self._show_clause_content(self.selected_clause)
    
    def _on_risk_selected(self, event):
        """风险选择事件"""
        selection = self.risk_tree.selection()
        if not selection:
            return
        
        risk_id = selection[0]
        
        if self.current_project:
            for risk in self.current_project.risks:
                if risk.risk_id == risk_id:
                    self.selected_risk = risk
                    self._show_risk_detail(risk)
                    
                    clause_map = self._build_clause_map()
                    clause = clause_map.get(risk.clause_id)
                    if clause:
                        self._show_clause_content(clause)
                    break
    
    def _show_risk_detail(self, risk: RiskItem):
        """显示风险详情"""
        level_text = {
            RiskLevel.CRITICAL: "严重",
            RiskLevel.HIGH: "高",
            RiskLevel.MEDIUM: "中",
            RiskLevel.LOW: "低"
        }
        
        status_text = {
            RiskStatus.PENDING: "待处理",
            RiskStatus.CONFIRMED: "已确认",
            RiskStatus.RESOLVED: "已解决",
            RiskStatus.DISMISSED: "已驳回"
        }
        
        self.detail_labels["risk_id"].config(text=risk.risk_id)
        self.detail_labels["clause_id"].config(text=risk.clause_id)
        self.detail_labels["rule_id"].config(text=risk.rule_id or "-")
        self.detail_labels["risk_level"].config(text=level_text.get(risk.risk_level, str(risk.risk_level)))
        self.detail_labels["risk_type"].config(text=risk.risk_type)
        self.detail_labels["status"].config(text=status_text.get(risk.status, str(risk.status)))
        self.detail_labels["is_duplicate"].config(text="是" if risk.is_duplicate else "否")
        
        self.keywords_text.delete(1.0, tk.END)
        if risk.matched_keywords:
            self.keywords_text.insert(tk.END, ", ".join(risk.matched_keywords))
        
        self.note_text.delete(1.0, tk.END)
        if risk.reviewer_note:
            self.note_text.insert(tk.END, risk.reviewer_note)
    
    def _show_clause_content(self, clause: Clause):
        """显示条款内容"""
        self.content_title_label.config(text=clause.title)
        
        self.content_text.config(state=tk.NORMAL)
        self.content_text.delete(1.0, tk.END)
        self.content_text.insert(tk.END, clause.content)
        self.content_text.config(state=tk.DISABLED)
    
    def _update_risk_status(self, new_status: RiskStatus):
        """更新风险状态"""
        if not self.selected_risk:
            messagebox.showwarning("警告", "请先选择一个风险项")
            return
        
        note = self.note_text.get(1.0, tk.END).strip()
        
        self.selected_risk.status = new_status
        self.selected_risk.reviewer_note = note
        
        from datetime import datetime
        self.selected_risk.updated_at = datetime.now()
        
        status_text = {
            RiskStatus.PENDING: "待处理",
            RiskStatus.CONFIRMED: "已确认",
            RiskStatus.RESOLVED: "已解决",
            RiskStatus.DISMISSED: "已驳回"
        }
        
        self._update_status(f"风险项已更新为: {status_text.get(new_status)}")
        self._refresh_risks_list()
        self._update_stats()
        self._save_project()
    
    def _select_all_pending(self):
        """全选待处理风险"""
        messagebox.showinfo("提示", "批量选择功能将在后续版本中支持")
    
    def _export_filtered(self):
        """导出筛选结果"""
        messagebox.showinfo("提示", "筛选导出功能将在后续版本中支持")
    
    def _export_markdown(self):
        """导出Markdown复核单"""
        if not self.current_project:
            messagebox.showwarning("警告", "没有可导出的项目")
            return
        
        file_path = filedialog.asksaveasfilename(
            title="导出Markdown复核单",
            defaultextension=".md",
            initialfile=f"{self.current_project.name}_复核单.md",
            filetypes=[("Markdown文件", "*.md"), ("所有文件", "*.*")]
        )
        
        if file_path:
            try:
                exporter = MarkdownExporter()
                exporter.export(self.current_project, file_path)
                self._update_status(f"已导出到: {file_path}")
                messagebox.showinfo("成功", "Markdown复核单已导出")
            except Exception as e:
                messagebox.showerror("错误", f"导出失败: {str(e)}")
    
    def _export_csv(self):
        """导出CSV风险表"""
        if not self.current_project:
            messagebox.showwarning("警告", "没有可导出的项目")
            return
        
        file_path = filedialog.asksaveasfilename(
            title="导出CSV风险表",
            defaultextension=".csv",
            initialfile=f"{self.current_project.name}_风险表.csv",
            filetypes=[("CSV文件", "*.csv"), ("所有文件", "*.*")]
        )
        
        if file_path:
            try:
                exporter = CSVExporter()
                exporter.export(self.current_project, file_path)
                self._update_status(f"已导出到: {file_path}")
                messagebox.showinfo("成功", "CSV风险表已导出")
            except Exception as e:
                messagebox.showerror("错误", f"导出失败: {str(e)}")
    
    def _export_csv_summary(self):
        """导出CSV统计汇总"""
        if not self.current_project:
            messagebox.showwarning("警告", "没有可导出的项目")
            return
        
        file_path = filedialog.asksaveasfilename(
            title="导出CSV统计汇总",
            defaultextension=".csv",
            initialfile=f"{self.current_project.name}_统计.csv",
            filetypes=[("CSV文件", "*.csv"), ("所有文件", "*.*")]
        )
        
        if file_path:
            try:
                exporter = CSVExporter()
                exporter.export_summary(self.current_project, file_path)
                self._update_status(f"已导出到: {file_path}")
                messagebox.showinfo("成功", "CSV统计汇总已导出")
            except Exception as e:
                messagebox.showerror("错误", f"导出失败: {str(e)}")
    
    def _export_audit(self):
        """导出JSON审计包"""
        if not self.current_project:
            messagebox.showwarning("警告", "没有可导出的项目")
            return
        
        file_path = filedialog.asksaveasfilename(
            title="导出JSON审计包",
            defaultextension=".zip",
            initialfile=f"{self.current_project.name}_审计包.zip",
            filetypes=[("ZIP文件", "*.zip"), ("JSON文件", "*.json"), ("所有文件", "*.*")]
        )
        
        if file_path:
            try:
                exporter = JSONAuditExporter()
                exporter.compress = file_path.endswith('.zip')
                exporter.export(self.current_project, file_path)
                self._update_status(f"已导出到: {file_path}")
                messagebox.showinfo("成功", "JSON审计包已导出")
            except Exception as e:
                messagebox.showerror("错误", f"导出失败: {str(e)}")
    
    def _update_status(self, text: str):
        """更新状态栏"""
        self.status_label.config(text=text)
        self.root.update_idletasks()
    
    def _update_project_label(self):
        """更新项目标签"""
        if self.current_project:
            self.project_label.config(text=f"项目: {self.current_project.name}")
        else:
            self.project_label.config(text="无项目")
    
    def _show_about(self):
        """显示关于"""
        about_text = """条款红线落点器 v1.0

法务合同盖章前复核工具

功能:
• 导入条款JSON、审批意见CSV、客户红线YAML
• 自动分析风险，支持关键词匹配
• 检测重复风险，避免重复修改
• 人工复核确认/驳回，本地保存
• 导出Markdown复核单、CSV风险表、JSON审计包

© 2025 条款红线落点器"""
        
        messagebox.showinfo("关于", about_text)
