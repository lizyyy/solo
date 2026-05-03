import tkinter as tk
from tkinter import ttk, filedialog, messagebox
from datetime import datetime, time
from typing import Dict, List, Optional, Callable
import os

from .data_models import (
    AppState, Layout, Schedule, Heatmap, CheckinLog, Rules,
    AnalysisResult, ZoneCoverage, Issue, RiskLevel, ZoneType,
    TimeSlotHelper
)
from .parsers import (
    LayoutParser, ScheduleParser, HeatmapParser,
    CheckinParser, RulesParser
)
from .algorithms import AnalysisEngine
from .exporters import IssuesExporter, DutyReviewExporter


class LifeguardMonitorApp:
    def __init__(self, root: tk.Tk):
        self.root = root
        self.root.title("救生员盲区排查系统")
        self.root.geometry("1400x900")
        self.root.minsize(1200, 800)
        
        self.state = AppState()
        
        self.dragging_shift = None
        self.drag_source_zone = None
        self.selected_time_slot = None
        
        self._create_menu()
        self._create_main_layout()
        
        self._update_status("就绪，请导入数据")
    
    def _create_menu(self):
        menubar = tk.Menu(self.root)
        self.root.config(menu=menubar)
        
        file_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="文件", menu=file_menu)
        
        file_menu.add_command(label="导入泳道布局 (JSON)", command=self._import_layout)
        file_menu.add_command(label="导入排班 (CSV)", command=self._import_schedule)
        file_menu.add_command(label="导入客流热力 (JSONL)", command=self._import_heatmap)
        file_menu.add_command(label="导入巡检打卡 (CSV)", command=self._import_checkin)
        file_menu.add_command(label="导入规则配置 (YAML)", command=self._import_rules)
        file_menu.add_separator()
        file_menu.add_command(label="批量导入示例数据", command=self._import_sample_data)
        file_menu.add_separator()
        file_menu.add_command(label="导出问题列表 (CSV)", command=self._export_issues, state=tk.DISABLED)
        file_menu.add_command(label="导出值勤报告 (MD)", command=self._export_duty_review, state=tk.DISABLED)
        file_menu.add_separator()
        file_menu.add_command(label="退出", command=self.root.quit)
        
        analysis_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="分析", menu=analysis_menu)
        analysis_menu.add_command(label="运行分析", command=self._run_analysis, state=tk.DISABLED)
        analysis_menu.add_separator()
        analysis_menu.add_command(label="重新计算", command=self._reanalyze, state=tk.DISABLED)
        
        help_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="帮助", menu=help_menu)
        help_menu.add_command(label="关于", command=self._show_about)
    
    def _create_main_layout(self):
        self.paned_window = ttk.PanedWindow(self.root, orient=tk.HORIZONTAL)
        self.paned_window.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)
        
        left_frame = ttk.Frame(self.paned_window, width=300)
        self.paned_window.add(left_frame, weight=1)
        
        right_frame = ttk.Frame(self.paned_window)
        self.paned_window.add(right_frame, weight=3)
        
        self._create_left_panel(left_frame)
        self._create_right_panel(right_frame)
        
        status_frame = ttk.Frame(self.root)
        status_frame.pack(fill=tk.X, side=tk.BOTTOM, padx=5, pady=2)
        
        self.status_label = ttk.Label(status_frame, text="状态: 就绪", anchor=tk.W)
        self.status_label.pack(side=tk.LEFT, fill=tk.X, expand=True)
        
        self.data_status_label = ttk.Label(status_frame, text="数据: 未加载", anchor=tk.E)
        self.data_status_label.pack(side=tk.RIGHT)
    
    def _create_left_panel(self, parent):
        notebook = ttk.Notebook(parent)
        notebook.pack(fill=tk.BOTH, expand=True)
        
        data_frame = ttk.Frame(notebook, padding=5)
        notebook.add(data_frame, text="数据导入")
        self._create_data_import_panel(data_frame)
        
        zones_frame = ttk.Frame(notebook, padding=5)
        notebook.add(zones_frame, text="区域列表")
        self._create_zones_panel(zones_frame)
        
        shifts_frame = ttk.Frame(notebook, padding=5)
        notebook.add(shifts_frame, text="班次管理")
        self._create_shifts_panel(shifts_frame)
        
        issues_frame = ttk.Frame(notebook, padding=5)
        notebook.add(issues_frame, text="问题列表")
        self._create_issues_panel(issues_frame)
    
    def _create_data_import_panel(self, parent):
        ttk.Label(parent, text="数据导入", font=('Arial', 12, 'bold')).pack(anchor=tk.W, pady=5)
        
        import_buttons = [
            ("泳道布局 (JSON)", self._import_layout, "layout_status"),
            ("排班表 (CSV)", self._import_schedule, "schedule_status"),
            ("客流热力 (JSONL)", self._import_heatmap, "heatmap_status"),
            ("巡检打卡 (CSV)", self._import_checkin, "checkin_status"),
            ("规则配置 (YAML)", self._import_rules, "rules_status"),
        ]
        
        self.import_status_labels = {}
        
        for label_text, command, status_key in import_buttons:
            frame = ttk.Frame(parent)
            frame.pack(fill=tk.X, pady=3)
            
            btn = ttk.Button(frame, text=label_text, command=command)
            btn.pack(side=tk.LEFT)
            
            status_label = ttk.Label(frame, text="未导入", foreground="gray")
            status_label.pack(side=tk.LEFT, padx=10)
            self.import_status_labels[status_key] = status_label
        
        ttk.Separator(parent, orient=tk.HORIZONTAL).pack(fill=tk.X, pady=10)
        
        batch_frame = ttk.LabelFrame(parent, text="批量操作", padding=5)
        batch_frame.pack(fill=tk.X, pady=5)
        
        ttk.Button(batch_frame, text="导入示例数据", command=self._import_sample_data).pack(side=tk.LEFT, padx=5)
        ttk.Button(batch_frame, text="运行分析", command=self._run_analysis).pack(side=tk.LEFT, padx=5)
        
        ttk.Separator(parent, orient=tk.HORIZONTAL).pack(fill=tk.X, pady=10)
        
        export_frame = ttk.LabelFrame(parent, text="导出", padding=5)
        export_frame.pack(fill=tk.X, pady=5)
        
        self.export_issues_btn = ttk.Button(
            export_frame, text="导出 issues.csv", 
            command=self._export_issues, state=tk.DISABLED
        )
        self.export_issues_btn.pack(side=tk.LEFT, padx=5)
        
        self.export_review_btn = ttk.Button(
            export_frame, text="导出 duty_review.md", 
            command=self._export_duty_review, state=tk.DISABLED
        )
        self.export_review_btn.pack(side=tk.LEFT, padx=5)
    
    def _create_zones_panel(self, parent):
        ttk.Label(parent, text="区域列表", font=('Arial', 12, 'bold')).pack(anchor=tk.W, pady=5)
        
        columns = ('id', 'name', 'type', 'risk')
        self.zones_tree = ttk.Treeview(parent, columns=columns, show='headings', height=15)
        
        self.zones_tree.heading('id', text='ID')
        self.zones_tree.heading('name', text='名称')
        self.zones_tree.heading('type', text='类型')
        self.zones_tree.heading('risk', text='风险')
        
        self.zones_tree.column('id', width=60)
        self.zones_tree.column('name', width=100)
        self.zones_tree.column('type', width=80)
        self.zones_tree.column('risk', width=60)
        
        scrollbar = ttk.Scrollbar(parent, orient=tk.VERTICAL, command=self.zones_tree.yview)
        self.zones_tree.configure(yscrollcommand=scrollbar.set)
        
        self.zones_tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
    
    def _create_shifts_panel(self, parent):
        ttk.Label(parent, text="班次列表", font=('Arial', 12, 'bold')).pack(anchor=tk.W, pady=5)
        
        columns = ('id', 'lifeguard', 'start', 'end', 'zone', 'cross_midnight')
        self.shifts_tree = ttk.Treeview(parent, columns=columns, show='headings', height=15)
        
        self.shifts_tree.heading('id', text='班次ID')
        self.shifts_tree.heading('lifeguard', text='救生员')
        self.shifts_tree.heading('start', text='开始')
        self.shifts_tree.heading('end', text='结束')
        self.shifts_tree.heading('zone', text='区域')
        self.shifts_tree.heading('cross_midnight', text='跨午夜')
        
        self.shifts_tree.column('id', width=60)
        self.shifts_tree.column('lifeguard', width=80)
        self.shifts_tree.column('start', width=50)
        self.shifts_tree.column('end', width=50)
        self.shifts_tree.column('zone', width=60)
        self.shifts_tree.column('cross_midnight', width=60)
        
        scrollbar = ttk.Scrollbar(parent, orient=tk.VERTICAL, command=self.shifts_tree.yview)
        self.shifts_tree.configure(yscrollcommand=scrollbar.set)
        
        self.shifts_tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
    
    def _create_issues_panel(self, parent):
        ttk.Label(parent, text="问题列表", font=('Arial', 12, 'bold')).pack(anchor=tk.W, pady=5)
        
        columns = ('type', 'severity', 'zone', 'lifeguard', 'description')
        self.issues_tree = ttk.Treeview(parent, columns=columns, show='headings', height=15)
        
        self.issues_tree.heading('type', text='类型')
        self.issues_tree.heading('severity', text='严重程度')
        self.issues_tree.heading('zone', text='区域')
        self.issues_tree.heading('lifeguard', text='救生员')
        self.issues_tree.heading('description', text='描述')
        
        self.issues_tree.column('type', width=80)
        self.issues_tree.column('severity', width=80)
        self.issues_tree.column('zone', width=60)
        self.issues_tree.column('lifeguard', width=80)
        self.issues_tree.column('description', width=200)
        
        scrollbar = ttk.Scrollbar(parent, orient=tk.VERTICAL, command=self.issues_tree.yview)
        self.issues_tree.configure(yscrollcommand=scrollbar.set)
        
        self.issues_tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
    
    def _create_right_panel(self, parent):
        top_frame = ttk.Frame(parent)
        top_frame.pack(fill=tk.X, pady=5)
        
        ttk.Label(top_frame, text="时段选择:").pack(side=tk.LEFT, padx=5)
        
        self.time_slot_var = tk.StringVar(value="全部")
        self.time_slot_combo = ttk.Combobox(
            top_frame, textvariable=self.time_slot_var, 
            values=["全部"], state='readonly', width=20
        )
        self.time_slot_combo.pack(side=tk.LEFT, padx=5)
        self.time_slot_combo.bind('<<ComboboxSelected>>', self._on_time_slot_selected)
        
        ttk.Button(top_frame, text="重新计算", command=self._reanalyze).pack(side=tk.RIGHT, padx=5)
        
        self.summary_frame = ttk.LabelFrame(parent, text="分析概览", padding=10)
        self.summary_frame.pack(fill=tk.X, pady=5)
        
        self._create_summary_view()
        
        center_frame = ttk.Frame(parent)
        center_frame.pack(fill=tk.BOTH, expand=True, pady=5)
        
        self.coverage_frame = ttk.LabelFrame(center_frame, text="区域覆盖 - 拖动班次到区域可调整", padding=10)
        self.coverage_frame.pack(fill=tk.BOTH, expand=True)
        
        self._create_coverage_view()
    
    def _create_summary_view(self):
        for widget in self.summary_frame.winfo_children():
            widget.destroy()
        
        self.summary_labels = {}
        
        summary_items = [
            ("总区域", "zones", "0"),
            ("总班次", "shifts", "0"),
            ("总问题", "issues", "0"),
            ("严重问题", "critical", "0"),
            ("高风险问题", "high", "0"),
            ("中风险问题", "medium", "0"),
        ]
        
        for idx, (label_text, key, default) in enumerate(summary_items):
            frame = ttk.Frame(self.summary_frame)
            frame.grid(row=0, column=idx, padx=20, pady=5)
            
            ttk.Label(frame, text=label_text, font=('Arial', 9)).pack()
            value_label = ttk.Label(frame, text=default, font=('Arial', 14, 'bold'))
            value_label.pack()
            self.summary_labels[key] = value_label
    
    def _create_coverage_view(self):
        for widget in self.coverage_frame.winfo_children():
            widget.destroy()
        
        canvas_frame = ttk.Frame(self.coverage_frame)
        canvas_frame.pack(fill=tk.BOTH, expand=True)
        
        self.coverage_canvas = tk.Canvas(canvas_frame, bg='white')
        scrollbar_y = ttk.Scrollbar(canvas_frame, orient=tk.VERTICAL, command=self.coverage_canvas.yview)
        scrollbar_x = ttk.Scrollbar(canvas_frame, orient=tk.HORIZONTAL, command=self.coverage_canvas.xview)
        
        self.coverage_canvas.configure(yscrollcommand=scrollbar_y.set, xscrollcommand=scrollbar_x.set)
        
        scrollbar_y.pack(side=tk.RIGHT, fill=tk.Y)
        scrollbar_x.pack(side=tk.BOTTOM, fill=tk.X)
        self.coverage_canvas.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        
        self.coverage_inner_frame = ttk.Frame(self.coverage_canvas)
        self.coverage_canvas.create_window((0, 0), window=self.coverage_inner_frame, anchor=tk.NW)
        
        self.coverage_inner_frame.bind('<Configure>', 
            lambda e: self.coverage_canvas.configure(scrollregion=self.coverage_canvas.bbox('all')))
    
    def _update_status(self, message: str):
        self.status_label.config(text=f"状态: {message}")
    
    def _update_data_status(self):
        status_parts = []
        if self.state.layout:
            status_parts.append("布局✓")
        if self.state.schedule:
            status_parts.append("排班✓")
        if self.state.heatmap:
            status_parts.append("热力✓")
        if self.state.checkin_log:
            status_parts.append("打卡✓")
        if self.state.rules:
            status_parts.append("规则✓")
        
        if not status_parts:
            self.data_status_label.config(text="数据: 未加载")
        else:
            self.data_status_label.config(text=f"数据: {' '.join(status_parts)}")
        
        self._check_data_ready()
    
    def _check_data_ready(self):
        all_ready = (self.state.layout is not None and 
                      self.state.schedule is not None and 
                      self.state.heatmap is not None and 
                      self.state.checkin_log is not None and 
                      self.state.rules is not None)
        
        self.state.is_data_loaded = all_ready
        return all_ready
    
    def _import_layout(self):
        file_path = filedialog.askopenfilename(
            title="选择泳道布局文件",
            filetypes=[("JSON files", "*.json"), ("All files", "*.*")]
        )
        if file_path:
            try:
                self.state.layout = LayoutParser.parse(file_path)
                self.import_status_labels["layout_status"].config(text="已导入", foreground="green")
                self._update_status(f"已导入布局: {os.path.basename(file_path)}")
                self._update_zones_list()
                self._update_data_status()
            except Exception as e:
                messagebox.showerror("错误", f"导入布局失败: {e}")
    
    def _import_schedule(self):
        file_path = filedialog.askopenfilename(
            title="选择排班表文件",
            filetypes=[("CSV files", "*.csv"), ("All files", "*.*")]
        )
        if file_path:
            try:
                self.state.schedule = ScheduleParser.parse(file_path)
                self.import_status_labels["schedule_status"].config(text="已导入", foreground="green")
                self._update_status(f"已导入排班: {os.path.basename(file_path)}")
                self._update_shifts_list()
                self._update_data_status()
            except Exception as e:
                messagebox.showerror("错误", f"导入排班失败: {e}")
    
    def _import_heatmap(self):
        file_path = filedialog.askopenfilename(
            title="选择客流热力文件",
            filetypes=[("JSONL files", "*.jsonl"), ("All files", "*.*")]
        )
        if file_path:
            try:
                self.state.heatmap = HeatmapParser.parse(file_path)
                self.import_status_labels["heatmap_status"].config(text="已导入", foreground="green")
                self._update_status(f"已导入热力数据: {os.path.basename(file_path)}")
                self._update_data_status()
            except Exception as e:
                messagebox.showerror("错误", f"导入热力数据失败: {e}")
    
    def _import_checkin(self):
        file_path = filedialog.askopenfilename(
            title="选择巡检打卡文件",
            filetypes=[("CSV files", "*.csv"), ("All files", "*.*")]
        )
        if file_path:
            try:
                self.state.checkin_log = CheckinParser.parse(file_path)
                self.import_status_labels["checkin_status"].config(text="已导入", foreground="green")
                self._update_status(f"已导入打卡数据: {os.path.basename(file_path)}")
                self._update_data_status()
            except Exception as e:
                messagebox.showerror("错误", f"导入打卡数据失败: {e}")
    
    def _import_rules(self):
        file_path = filedialog.askopenfilename(
            title="选择规则配置文件",
            filetypes=[("YAML files", "*.yaml"), ("YML files", "*.yml"), ("All files", "*.*")]
        )
        if file_path:
            try:
                self.state.rules = RulesParser.parse(file_path)
                self.import_status_labels["rules_status"].config(text="已导入", foreground="green")
                self._update_status(f"已导入规则: {os.path.basename(file_path)}")
                self._update_data_status()
            except Exception as e:
                messagebox.showerror("错误", f"导入规则失败: {e}")
    
    def _import_sample_data(self):
        sample_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'sample_data')
        
        try:
            imported = []
            
            layout_path = os.path.join(sample_dir, 'layout.json')
            if os.path.exists(layout_path):
                self.state.layout = LayoutParser.parse(layout_path)
                imported.append('layout.json')
            
            schedule_path = os.path.join(sample_dir, 'schedule.csv')
            if os.path.exists(schedule_path):
                self.state.schedule = ScheduleParser.parse(schedule_path)
                imported.append('schedule.csv')
            
            heatmap_path = os.path.join(sample_dir, 'heatmap.jsonl')
            if os.path.exists(heatmap_path):
                self.state.heatmap = HeatmapParser.parse(heatmap_path)
                imported.append('heatmap.jsonl')
            
            checkin_path = os.path.join(sample_dir, 'checkin.csv')
            if os.path.exists(checkin_path):
                self.state.checkin_log = CheckinParser.parse(checkin_path)
                imported.append('checkin.csv')
            
            rules_path = os.path.join(sample_dir, 'rules.yaml')
            if os.path.exists(rules_path):
                self.state.rules = RulesParser.parse(rules_path)
                imported.append('rules.yaml')
            
            for status_key in ['layout_status', 'schedule_status', 'heatmap_status', 'checkin_status', 'rules_status']:
                self.import_status_labels[status_key].config(text="已导入", foreground="green")
            
            self._update_zones_list()
            self._update_shifts_list()
            self._update_status(f"已导入示例数据: {', '.join(imported)}")
            self._update_data_status()
            
            messagebox.showinfo("成功", f"已导入 {len(imported)} 个示例数据文件")
        except Exception as e:
            messagebox.showerror("错误", f"导入示例数据失败: {e}")
    
    def _update_zones_list(self):
        for item in self.zones_tree.get_children():
            self.zones_tree.delete(item)
        
        if not self.state.layout:
            return
        
        for zone_id, zone in self.state.layout.zones.items():
            risk_text = "高风险" if zone.is_high_risk else "正常"
            self.zones_tree.insert('', tk.END, values=(
                zone.id,
                zone.name,
                zone.zone_type.value,
                risk_text
            ))
    
    def _update_shifts_list(self):
        for item in self.shifts_tree.get_children():
            self.shifts_tree.delete(item)
        
        if not self.state.schedule:
            return
        
        for shift in self.state.schedule.shifts:
            cross_text = "是" if shift.is_cross_midnight else "否"
            self.shifts_tree.insert('', tk.END, values=(
                shift.id,
                shift.lifeguard_name,
                shift.start_time.strftime("%H:%M"),
                shift.end_time.strftime("%H:%M"),
                shift.assigned_zone_id,
                cross_text
            ))
    
    def _update_issues_list(self):
        for item in self.issues_tree.get_children():
            self.issues_tree.delete(item)
        
        if not self.state.analysis_result:
            return
        
        for issue in self.state.analysis_result.all_issues:
            self.issues_tree.insert('', tk.END, values=(
                issue.issue_type.value,
                issue.severity.value,
                issue.zone_id or '-',
                issue.lifeguard_name or '-',
                issue.description
            ))
    
    def _update_time_slots(self):
        if not self.state.analysis_result:
            self.time_slot_combo.config(values=["全部"])
            return
        
        slots = ["全部"] + self.state.analysis_result.time_slots
        self.time_slot_combo.config(values=slots)
        self.time_slot_var.set("全部")
    
    def _update_summary(self):
        if not self.state.analysis_result:
            return
        
        summary = self.state.analysis_result.summary
        
        self.summary_labels["zones"].config(text=str(summary.get('total_zones', 0)))
        self.summary_labels["shifts"].config(text=str(summary.get('total_shifts', 0)))
        self.summary_labels["issues"].config(text=str(summary.get('total_issues', 0)))
        
        severity_stats = summary.get('issue_by_severity', {})
        self.summary_labels["critical"].config(
            text=str(severity_stats.get('critical', 0)),
            foreground='red'
        )
        self.summary_labels["high"].config(
            text=str(severity_stats.get('high', 0)),
            foreground='orange'
        )
        self.summary_labels["medium"].config(
            text=str(severity_stats.get('medium', 0)),
            foreground='gold'
        )
    
    def _update_coverage_view(self):
        for widget in self.coverage_inner_frame.winfo_children():
            widget.destroy()
        
        if not self.state.analysis_result or not self.state.layout:
            ttk.Label(self.coverage_inner_frame, text="请先运行分析", 
                      font=('Arial', 12), foreground='gray').pack(pady=50)
            return
        
        selected_slot = self.time_slot_var.get()
        time_slots = self.state.analysis_result.time_slots
        
        if selected_slot == "全部":
            display_slots = time_slots
        else:
            display_slots = [selected_slot]
        
        zone_colors = {
            ZoneType.SWIMMING_LANE: '#E3F2FD',
            ZoneType.CHILDREN_AREA: '#FFF3E0',
            ZoneType.DEEP_ZONE: '#FFEBEE',
            ZoneType.SHALLOW_ZONE: '#E8F5E9',
            ZoneType.DIVING_AREA: '#F3E5F5',
            ZoneType.REST_AREA: '#F5F5F5',
        }
        
        risk_colors = {
            RiskLevel.LOW: '#4CAF50',
            RiskLevel.MEDIUM: '#FFC107',
            RiskLevel.HIGH: '#FF9800',
            RiskLevel.CRITICAL: '#F44336',
        }
        
        for slot_idx, time_slot in enumerate(display_slots):
            slot_frame = ttk.LabelFrame(self.coverage_inner_frame, text=f"时段: {time_slot}", padding=10)
            slot_frame.pack(fill=tk.X, pady=10, padx=10)
            
            zones_container = ttk.Frame(slot_frame)
            zones_container.pack(fill=tk.X)
            
            zone_items = list(self.state.layout.zones.items())
            zones_per_row = 3
            
            for i in range(0, len(zone_items), zones_per_row):
                row_frame = ttk.Frame(zones_container)
                row_frame.pack(fill=tk.X, pady=5)
                
                for j in range(zones_per_row):
                    if i + j >= len(zone_items):
                        empty_frame = ttk.Frame(row_frame, width=200)
                        empty_frame.pack(side=tk.LEFT, padx=10)
                        continue
                    
                    zone_id, zone = zone_items[i + j]
                    
                    zone_coverage = None
                    for cov in self.state.analysis_result.zone_coverages.get(zone_id, []):
                        if cov.time_slot == time_slot:
                            zone_coverage = cov
                            break
                    
                    zone_color = zone_colors.get(zone.zone_type, '#FFFFFF')
                    risk_color = '#9E9E9E'
                    if zone_coverage:
                        risk_color = risk_colors.get(zone_coverage.risk_level, '#9E9E9E')
                    
                    zone_card = tk.Frame(row_frame, bg=zone_color, 
                                        highlightbackground=risk_color, highlightthickness=2,
                                        padx=10, pady=10)
                    zone_card.pack(side=tk.LEFT, padx=10, fill=tk.BOTH, expand=True)
                    
                    zone_card.drop_target = zone_id
                    
                    title_frame = tk.Frame(zone_card, bg=zone_color)
                    title_frame.pack(fill=tk.X)
                    
                    tk.Label(title_frame, text=zone.name, bg=zone_color,
                             font=('Arial', 11, 'bold')).pack(side=tk.LEFT)
                    
                    risk_indicator = tk.Frame(title_frame, bg=risk_color, width=16, height=16)
                    risk_indicator.pack(side=tk.RIGHT)
                    
                    tk.Label(zone_card, text=f"类型: {zone.zone_type.value}", bg=zone_color,
                             font=('Arial', 9)).pack(anchor=tk.W)
                    
                    if zone.is_high_risk:
                        tk.Label(zone_card, text="⚠ 高风险区域", bg=zone_color,
                                 font=('Arial', 9), foreground='red').pack(anchor=tk.W)
                    
                    if zone_coverage:
                        visitor_text = f"访客数: {zone_coverage.visitor_count}"
                        tk.Label(zone_card, text=visitor_text, bg=zone_color,
                                 font=('Arial', 9)).pack(anchor=tk.W)
                        
                        status_text = "✓ 已覆盖" if zone_coverage.is_covered else "✗ 未覆盖"
                        status_color = 'green' if zone_coverage.is_covered else 'red'
                        tk.Label(zone_card, text=status_text, bg=zone_color,
                                 font=('Arial', 9, 'bold'), foreground=status_color).pack(anchor=tk.W)
                        
                        if zone_coverage.assigned_lifeguards:
                            tk.Label(zone_card, text="值班救生员:", bg=zone_color,
                                     font=('Arial', 9, 'bold')).pack(anchor=tk.W, pady=(5, 0))
                            
                            for lg in zone_coverage.assigned_lifeguards:
                                lg_frame = tk.Frame(zone_card, bg='#FFFFFF', padx=5, pady=2)
                                lg_frame.pack(anchor=tk.W, pady=2)
                                
                                tk.Label(lg_frame, text=lg, bg='#FFFFFF',
                                         font=('Arial', 9)).pack(side=tk.LEFT)
                                
                                lg_frame.lifeguard_name = lg
                                lg_frame.zone_id = zone_id
                                lg_frame.time_slot = time_slot
                                
                                lg_frame.bind('<Button-1>', self._on_lifeguard_click)
                                lg_frame.config(cursor='hand2')
                        else:
                            tk.Label(zone_card, text="无值班救生员", bg=zone_color,
                                     font=('Arial', 9), foreground='gray').pack(anchor=tk.W)
                        
                        if zone_coverage.issues:
                            tk.Label(zone_card, text=f"问题: {len(zone_coverage.issues)} 个", 
                                     bg=zone_color, font=('Arial', 9), foreground='red').pack(anchor=tk.W)
                    
                    zone_card.bind('<ButtonRelease-1>', self._on_zone_drop)
                    zone_card.bind('<Enter>', lambda e, zc=zone_card: zc.config(relief=tk.RAISED))
                    zone_card.bind('<Leave>', lambda e, zc=zone_card: zc.config(relief=tk.FLAT))
    
    def _on_lifeguard_click(self, event):
        widget = event.widget
        if hasattr(widget, 'lifeguard_name'):
            self.dragging_shift = widget.lifeguard_name
            self.drag_source_zone = widget.zone_id
            self._update_status(f"已选中: {self.dragging_shift}，点击目标区域移动")
    
    def _on_zone_drop(self, event):
        widget = event.widget
        if hasattr(widget, 'drop_target') and self.dragging_shift:
            target_zone = widget.drop_target
            
            if target_zone == self.drag_source_zone:
                self._update_status("目标区域与源区域相同，无需移动")
                return
            
            if self.state.schedule:
                for shift in self.state.schedule.shifts:
                    if (shift.lifeguard_name == self.dragging_shift and 
                        shift.assigned_zone_id == self.drag_source_zone):
                        shift.assigned_zone_id = target_zone
                        self._update_status(f"已将 {self.dragging_shift} 从 {self.drag_source_zone} 移动到 {target_zone}")
                        self._update_shifts_list()
                        
                        if self.state.is_data_loaded:
                            self._reanalyze()
                        break
            
            self.dragging_shift = None
            self.drag_source_zone = None
    
    def _on_time_slot_selected(self, event):
        self.selected_time_slot = self.time_slot_var.get()
        self._update_coverage_view()
    
    def _run_analysis(self):
        if not self._check_data_ready():
            messagebox.showwarning("警告", "请先导入所有必需的数据文件")
            return
        
        try:
            engine = AnalysisEngine(
                layout=self.state.layout,
                schedule=self.state.schedule,
                heatmap=self.state.heatmap,
                checkin_log=self.state.checkin_log,
                rules=self.state.rules
            )
            
            self.state.analysis_result = engine.run_analysis()
            
            self._update_issues_list()
            self._update_time_slots()
            self._update_summary()
            self._update_coverage_view()
            
            self.export_issues_btn.config(state=tk.NORMAL)
            self.export_review_btn.config(state=tk.NORMAL)
            
            self._update_status("分析完成")
            messagebox.showinfo("成功", "分析完成！发现 {} 个问题".format(
                len(self.state.analysis_result.all_issues)
            ))
        except Exception as e:
            messagebox.showerror("错误", f"分析失败: {e}")
            import traceback
            traceback.print_exc()
    
    def _reanalyze(self):
        if self.state.is_data_loaded:
            self._run_analysis()
        else:
            messagebox.showwarning("警告", "数据未完全加载")
    
    def _export_issues(self):
        if not self.state.analysis_result:
            messagebox.showwarning("警告", "请先运行分析")
            return
        
        file_path = filedialog.asksaveasfilename(
            title="保存问题列表",
            defaultextension=".csv",
            initialfile="issues.csv",
            filetypes=[("CSV files", "*.csv"), ("All files", "*.*")]
        )
        
        if file_path:
            if IssuesExporter.export_to_csv(self.state.analysis_result, file_path):
                self._update_status(f"已导出到: {os.path.basename(file_path)}")
                messagebox.showinfo("成功", f"问题列表已导出到:\n{file_path}")
            else:
                messagebox.showerror("错误", "导出失败")
    
    def _export_duty_review(self):
        if not self.state.analysis_result:
            messagebox.showwarning("警告", "请先运行分析")
            return
        
        file_path = filedialog.asksaveasfilename(
            title="保存值勤报告",
            defaultextension=".md",
            initialfile="duty_review.md",
            filetypes=[("Markdown files", "*.md"), ("All files", "*.*")]
        )
        
        if file_path:
            if DutyReviewExporter.export_to_markdown(
                self.state.analysis_result,
                self.state.layout,
                self.state.schedule,
                file_path
            ):
                self._update_status(f"已导出到: {os.path.basename(file_path)}")
                messagebox.showinfo("成功", f"值勤报告已导出到:\n{file_path}")
            else:
                messagebox.showerror("错误", "导出失败")
    
    def _show_about(self):
        about_text = """
救生员盲区排查系统 v1.0

功能:
• 导入泳道布局、排班表、客流热力、巡检打卡、规则配置
• 分析盯防盲区、疲劳超时、儿童区缺岗等问题
• 支持拖动调整班次并即时重算
• 导出问题列表和值勤报告

支持的数据格式:
• 泳道布局: JSON
• 排班表: CSV
• 客流热力: JSONL
• 巡检打卡: CSV
• 规则配置: YAML
        """
        messagebox.showinfo("关于", about_text)


def run_app():
    root = tk.Tk()
    
    style = ttk.Style()
    style.theme_use('clam')
    
    app = LifeguardMonitorApp(root)
    root.mainloop()
