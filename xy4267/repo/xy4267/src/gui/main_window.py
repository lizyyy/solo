import tkinter as tk
from tkinter import ttk, filedialog, messagebox, scrolledtext
from datetime import datetime
from typing import Dict, List, Any, Optional
from uuid import uuid4
import os

from src.models import Sample, Fridge, Rack, HandoverRecord, DutyNote, Alert, SampleType, HandoverStatus
from src.storage import DataStore
from src.rules import create_default_engine
from src.import_export import DataImporter, MarkdownExporter, CSVExporter


class MainWindow:
    
    def __init__(self, root: Optional[tk.Tk] = None):
        self.root = root or tk.Tk()
        self.root.title("冰箱样本温控交接台")
        self.root.geometry("1400x900")
        self.root.minsize(1200, 700)
        
        self.data_store = DataStore()
        self.rule_engine = create_default_engine()
        self.importer = DataImporter()
        self.md_exporter = MarkdownExporter()
        self.csv_exporter = CSVExporter()
        
        self.current_operator = tk.StringVar(value="")
        
        self._create_menu()
        self._create_main_layout()
        self._refresh_all_data()
        
        self.root.protocol("WM_DELETE_WINDOW", self._on_close)
    
    def _create_menu(self):
        menubar = tk.Menu(self.root)
        self.root.config(menu=menubar)
        
        file_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="文件", menu=file_menu)
        file_menu.add_command(label="导入扫码枪CSV", command=self._import_samples_csv)
        file_menu.add_command(label="导入温度记录JSON", command=self._import_temperature_json)
        file_menu.add_command(label="导入交接表CSV", command=self._import_handover_csv)
        file_menu.add_separator()
        file_menu.add_command(label="清空所有数据", command=self._clear_all_data)
        file_menu.add_separator()
        file_menu.add_command(label="退出", command=self._on_close)
        
        export_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="导出", menu=export_menu)
        export_menu.add_command(label="导出Markdown交接单", command=self._export_handover_md)
        export_menu.add_command(label="导出CSV风险清单", command=self._export_risk_csv)
        export_menu.add_command(label="导出告警记录CSV", command=self._export_alerts_csv)
        
        help_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="帮助", menu=help_menu)
        help_menu.add_command(label="关于", command=self._show_about)
    
    def _create_main_layout(self):
        main_frame = ttk.Frame(self.root, padding="5")
        main_frame.pack(fill=tk.BOTH, expand=True)
        
        top_frame = ttk.Frame(main_frame)
        top_frame.pack(fill=tk.X, pady=(0, 5))
        
        ttk.Label(top_frame, text="值班人员:").pack(side=tk.LEFT, padx=(0, 5))
        ttk.Entry(top_frame, textvariable=self.current_operator, width=20).pack(side=tk.LEFT, padx=(0, 10))
        ttk.Button(top_frame, text="运行规则检测", command=self._run_rules).pack(side=tk.LEFT, padx=5)
        ttk.Button(top_frame, text="保存数据", command=self._save_data).pack(side=tk.LEFT, padx=5)
        
        self.notebook = ttk.Notebook(main_frame)
        self.notebook.pack(fill=tk.BOTH, expand=True)
        
        self._create_overview_tab()
        self._create_samples_tab()
        self._create_fridges_tab()
        self._create_alerts_tab()
        self._create_handover_tab()
        self._create_notes_tab()
    
    def _create_overview_tab(self):
        tab = ttk.Frame(self.notebook, padding="5")
        self.notebook.add(tab, text="总览")
        
        left_frame = ttk.Frame(tab)
        left_frame.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, padx=(0, 5))
        
        stats_frame = ttk.LabelFrame(left_frame, text="统计信息", padding="10")
        stats_frame.pack(fill=tk.X, pady=(0, 10))
        
        self.stats_labels = {}
        stats_items = [
            ("samples_total", "总样本数", "0"),
            ("samples_in_fridge", "在柜样本", "0"),
            ("samples_out_fridge", "离柜样本", "0"),
            ("fridges_count", "冰箱数量", "0"),
            ("alerts_total", "总告警数", "0"),
            ("alerts_unresolved", "未解决告警", "0"),
        ]
        
        for i, (key, label, default) in enumerate(stats_items):
            row = i // 2
            col = i % 2
            
            frame = ttk.Frame(stats_frame)
            frame.grid(row=row, column=col, sticky=tk.W, padx=20, pady=5)
            
            ttk.Label(frame, text=f"{label}:", font=("Arial", 10)).pack(side=tk.LEFT)
            value_label = ttk.Label(frame, text=default, font=("Arial", 12, "bold"))
            value_label.pack(side=tk.LEFT, padx=(10, 0))
            self.stats_labels[key] = value_label
        
        quick_frame = ttk.LabelFrame(left_frame, text="快捷操作", padding="10")
        quick_frame.pack(fill=tk.BOTH, expand=True)
        
        btn_frame1 = ttk.Frame(quick_frame)
        btn_frame1.pack(fill=tk.X, pady=5)
        ttk.Button(btn_frame1, text="导入扫码枪数据", command=self._import_samples_csv, width=18).pack(side=tk.LEFT, padx=5)
        ttk.Button(btn_frame1, text="导入温度记录", command=self._import_temperature_json, width=18).pack(side=tk.LEFT, padx=5)
        ttk.Button(btn_frame1, text="导入交接表", command=self._import_handover_csv, width=18).pack(side=tk.LEFT, padx=5)
        
        btn_frame2 = ttk.Frame(quick_frame)
        btn_frame2.pack(fill=tk.X, pady=5)
        ttk.Button(btn_frame2, text="导出交接单", command=self._export_handover_md, width=18).pack(side=tk.LEFT, padx=5)
        ttk.Button(btn_frame2, text="导出风险清单", command=self._export_risk_csv, width=18).pack(side=tk.LEFT, padx=5)
        ttk.Button(btn_frame2, text="添加值班备注", command=self._open_add_note_dialog, width=18).pack(side=tk.LEFT, padx=5)
        
        right_frame = ttk.Frame(tab)
        right_frame.pack(side=tk.RIGHT, fill=tk.BOTH, expand=True)
        
        alert_frame = ttk.LabelFrame(right_frame, text="最新告警", padding="5")
        alert_frame.pack(fill=tk.BOTH, expand=True)
        
        columns = ("type", "message", "time", "status")
        self.overview_alert_tree = ttk.Treeview(alert_frame, columns=columns, show="headings", height=15)
        self.overview_alert_tree.heading("type", text="告警类型")
        self.overview_alert_tree.heading("message", text="描述")
        self.overview_alert_tree.heading("time", text="时间")
        self.overview_alert_tree.heading("status", text="状态")
        
        self.overview_alert_tree.column("type", width=100)
        self.overview_alert_tree.column("message", width=300)
        self.overview_alert_tree.column("time", width=120)
        self.overview_alert_tree.column("status", width=80)
        
        scrollbar = ttk.Scrollbar(alert_frame, orient=tk.VERTICAL, command=self.overview_alert_tree.yview)
        self.overview_alert_tree.configure(yscrollcommand=scrollbar.set)
        
        self.overview_alert_tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
    
    def _create_samples_tab(self):
        tab = ttk.Frame(self.notebook, padding="5")
        self.notebook.add(tab, text="样本管理")
        
        toolbar = ttk.Frame(tab)
        toolbar.pack(fill=tk.X, pady=(0, 5))
        
        ttk.Button(toolbar, text="刷新", command=self._refresh_samples).pack(side=tk.LEFT, padx=2)
        ttk.Button(toolbar, text="添加样本", command=self._open_add_sample_dialog).pack(side=tk.LEFT, padx=2)
        
        filter_frame = ttk.Frame(toolbar)
        filter_frame.pack(side=tk.RIGHT)
        
        ttk.Label(filter_frame, text="状态筛选:").pack(side=tk.LEFT, padx=2)
        self.sample_filter_var = tk.StringVar(value="全部")
        filter_combo = ttk.Combobox(filter_frame, textvariable=self.sample_filter_var, values=["全部", "在柜", "离柜"], width=10, state="readonly")
        filter_combo.pack(side=tk.LEFT, padx=2)
        filter_combo.bind("<<ComboboxSelected>>", lambda e: self._refresh_samples())
        
        columns = ("sample_id", "sample_type", "rack_id", "position", "status", "scan_time", "in_time", "out_time")
        self.sample_tree = ttk.Treeview(tab, columns=columns, show="headings")
        self.sample_tree.heading("sample_id", text="样本ID")
        self.sample_tree.heading("sample_type", text="类型")
        self.sample_tree.heading("rack_id", text="架位ID")
        self.sample_tree.heading("position", text="位置")
        self.sample_tree.heading("status", text="状态")
        self.sample_tree.heading("scan_time", text="扫描时间")
        self.sample_tree.heading("in_time", text="入柜时间")
        self.sample_tree.heading("out_time", text="离柜时间")
        
        self.sample_tree.column("sample_id", width=120)
        self.sample_tree.column("sample_type", width=80)
        self.sample_tree.column("rack_id", width=80)
        self.sample_tree.column("position", width=60)
        self.sample_tree.column("status", width=60)
        self.sample_tree.column("scan_time", width=140)
        self.sample_tree.column("in_time", width=140)
        self.sample_tree.column("out_time", width=140)
        
        scrollbar_y = ttk.Scrollbar(tab, orient=tk.VERTICAL, command=self.sample_tree.yview)
        scrollbar_x = ttk.Scrollbar(tab, orient=tk.HORIZONTAL, command=self.sample_tree.xview)
        self.sample_tree.configure(yscrollcommand=scrollbar_y.set, xscrollcommand=scrollbar_x.set)
        
        self.sample_tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scrollbar_y.pack(side=tk.RIGHT, fill=tk.Y)
        scrollbar_x.pack(side=tk.BOTTOM, fill=tk.X)
        
        self.sample_tree.bind("<Double-1>", lambda e: self._edit_sample())
    
    def _create_fridges_tab(self):
        tab = ttk.Frame(self.notebook, padding="5")
        self.notebook.add(tab, text="冰箱/架位")
        
        toolbar = ttk.Frame(tab)
        toolbar.pack(fill=tk.X, pady=(0, 5))
        
        ttk.Button(toolbar, text="刷新", command=self._refresh_fridges).pack(side=tk.LEFT, padx=2)
        ttk.Button(toolbar, text="添加冰箱", command=self._open_add_fridge_dialog).pack(side=tk.LEFT, padx=2)
        
        paned = ttk.PanedWindow(tab, orient=tk.HORIZONTAL)
        paned.pack(fill=tk.BOTH, expand=True)
        
        left_frame = ttk.LabelFrame(paned, text="冰箱列表", padding="5")
        paned.add(left_frame, weight=1)
        
        columns = ("fridge_id", "name", "temp_range", "current_temp", "racks_count")
        self.fridge_tree = ttk.Treeview(left_frame, columns=columns, show="headings")
        self.fridge_tree.heading("fridge_id", text="冰箱ID")
        self.fridge_tree.heading("name", text="名称")
        self.fridge_tree.heading("temp_range", text="温度范围")
        self.fridge_tree.heading("current_temp", text="当前温度")
        self.fridge_tree.heading("racks_count", text="架位数")
        
        self.fridge_tree.column("fridge_id", width=80)
        self.fridge_tree.column("name", width=100)
        self.fridge_tree.column("temp_range", width=100)
        self.fridge_tree.column("current_temp", width=90)
        self.fridge_tree.column("racks_count", width=60)
        
        fridge_scroll = ttk.Scrollbar(left_frame, orient=tk.VERTICAL, command=self.fridge_tree.yview)
        self.fridge_tree.configure(yscrollcommand=fridge_scroll.set)
        
        self.fridge_tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        fridge_scroll.pack(side=tk.RIGHT, fill=tk.Y)
        
        self.fridge_tree.bind("<<TreeviewSelect>>", self._on_fridge_select)
        
        right_frame = ttk.LabelFrame(paned, text="架位信息", padding="5")
        paned.add(right_frame, weight=2)
        
        rack_toolbar = ttk.Frame(right_frame)
        rack_toolbar.pack(fill=tk.X, pady=(0, 5))
        ttk.Button(rack_toolbar, text="添加架位", command=self._open_add_rack_dialog).pack(side=tk.LEFT, padx=2)
        
        columns = ("rack_id", "capacity", "occupied", "positions")
        self.rack_tree = ttk.Treeview(right_frame, columns=columns, show="headings")
        self.rack_tree.heading("rack_id", text="架位ID")
        self.rack_tree.heading("capacity", text="容量")
        self.rack_tree.heading("occupied", text="已占用")
        self.rack_tree.heading("positions", text="占用位置")
        
        self.rack_tree.column("rack_id", width=100)
        self.rack_tree.column("capacity", width=60)
        self.rack_tree.column("occupied", width=60)
        self.rack_tree.column("positions", width=300)
        
        rack_scroll = ttk.Scrollbar(right_frame, orient=tk.VERTICAL, command=self.rack_tree.yview)
        self.rack_tree.configure(yscrollcommand=rack_scroll.set)
        
        self.rack_tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        rack_scroll.pack(side=tk.RIGHT, fill=tk.Y)
    
    def _create_alerts_tab(self):
        tab = ttk.Frame(self.notebook, padding="5")
        self.notebook.add(tab, text="告警管理")
        
        toolbar = ttk.Frame(tab)
        toolbar.pack(fill=tk.X, pady=(0, 5))
        
        ttk.Button(toolbar, text="刷新", command=self._refresh_alerts).pack(side=tk.LEFT, padx=2)
        ttk.Button(toolbar, text="运行检测", command=self._run_rules).pack(side=tk.LEFT, padx=2)
        ttk.Button(toolbar, text="标记已解决", command=self._resolve_alert).pack(side=tk.LEFT, padx=2)
        
        filter_frame = ttk.Frame(toolbar)
        filter_frame.pack(side=tk.RIGHT)
        
        ttk.Label(filter_frame, text="状态筛选:").pack(side=tk.LEFT, padx=2)
        self.alert_filter_var = tk.StringVar(value="全部")
        alert_filter_combo = ttk.Combobox(filter_frame, textvariable=self.alert_filter_var, values=["全部", "未解决", "已解决"], width=10, state="readonly")
        alert_filter_combo.pack(side=tk.LEFT, padx=2)
        alert_filter_combo.bind("<<ComboboxSelected>>", lambda e: self._refresh_alerts())
        
        columns = ("alert_id", "alert_type", "related_id", "related_type", "message", "timestamp", "status")
        self.alert_tree = ttk.Treeview(tab, columns=columns, show="headings")
        self.alert_tree.heading("alert_id", text="告警ID")
        self.alert_tree.heading("alert_type", text="告警类型")
        self.alert_tree.heading("related_id", text="关联对象")
        self.alert_tree.heading("related_type", text="对象类型")
        self.alert_tree.heading("message", text="描述")
        self.alert_tree.heading("timestamp", text="时间")
        self.alert_tree.heading("status", text="状态")
        
        self.alert_tree.column("alert_id", width=100)
        self.alert_tree.column("alert_type", width=100)
        self.alert_tree.column("related_id", width=100)
        self.alert_tree.column("related_type", width=80)
        self.alert_tree.column("message", width=300)
        self.alert_tree.column("timestamp", width=140)
        self.alert_tree.column("status", width=80)
        
        scrollbar_y = ttk.Scrollbar(tab, orient=tk.VERTICAL, command=self.alert_tree.yview)
        scrollbar_x = ttk.Scrollbar(tab, orient=tk.HORIZONTAL, command=self.alert_tree.xview)
        self.alert_tree.configure(yscrollcommand=scrollbar_y.set, xscrollcommand=scrollbar_x.set)
        
        self.alert_tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scrollbar_y.pack(side=tk.RIGHT, fill=tk.Y)
        scrollbar_x.pack(side=tk.BOTTOM, fill=tk.X)
    
    def _create_handover_tab(self):
        tab = ttk.Frame(self.notebook, padding="5")
        self.notebook.add(tab, text="交接记录")
        
        toolbar = ttk.Frame(tab)
        toolbar.pack(fill=tk.X, pady=(0, 5))
        
        ttk.Button(toolbar, text="刷新", command=self._refresh_handovers).pack(side=tk.LEFT, padx=2)
        ttk.Button(toolbar, text="添加记录", command=self._open_add_handover_dialog).pack(side=tk.LEFT, padx=2)
        ttk.Button(toolbar, text="确认交接", command=self._confirm_handover).pack(side=tk.LEFT, padx=2)
        
        columns = ("record_id", "sample_id", "from_operator", "to_operator", "handover_time", "status", "notes")
        self.handover_tree = ttk.Treeview(tab, columns=columns, show="headings")
        self.handover_tree.heading("record_id", text="记录ID")
        self.handover_tree.heading("sample_id", text="样本ID")
        self.handover_tree.heading("from_operator", text="移交人")
        self.handover_tree.heading("to_operator", text="接收人")
        self.handover_tree.heading("handover_time", text="交接时间")
        self.handover_tree.heading("status", text="状态")
        self.handover_tree.heading("notes", text="备注")
        
        self.handover_tree.column("record_id", width=100)
        self.handover_tree.column("sample_id", width=100)
        self.handover_tree.column("from_operator", width=80)
        self.handover_tree.column("to_operator", width=80)
        self.handover_tree.column("handover_time", width=140)
        self.handover_tree.column("status", width=80)
        self.handover_tree.column("notes", width=200)
        
        scrollbar_y = ttk.Scrollbar(tab, orient=tk.VERTICAL, command=self.handover_tree.yview)
        scrollbar_x = ttk.Scrollbar(tab, orient=tk.HORIZONTAL, command=self.handover_tree.xview)
        self.handover_tree.configure(yscrollcommand=scrollbar_y.set, xscrollcommand=scrollbar_x.set)
        
        self.handover_tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scrollbar_y.pack(side=tk.RIGHT, fill=tk.Y)
        scrollbar_x.pack(side=tk.BOTTOM, fill=tk.X)
    
    def _create_notes_tab(self):
        tab = ttk.Frame(self.notebook, padding="5")
        self.notebook.add(tab, text="值班备注")
        
        toolbar = ttk.Frame(tab)
        toolbar.pack(fill=tk.X, pady=(0, 5))
        
        ttk.Button(toolbar, text="刷新", command=self._refresh_notes).pack(side=tk.LEFT, padx=2)
        ttk.Button(toolbar, text="添加备注", command=self._open_add_note_dialog).pack(side=tk.LEFT, padx=2)
        ttk.Button(toolbar, text="删除选中", command=self._delete_note).pack(side=tk.LEFT, padx=2)
        
        paned = ttk.PanedWindow(tab, orient=tk.HORIZONTAL)
        paned.pack(fill=tk.BOTH, expand=True)
        
        left_frame = ttk.LabelFrame(paned, text="备注列表", padding="5")
        paned.add(left_frame, weight=1)
        
        columns = ("note_id", "shift_date", "operator_name", "is_important", "created_time")
        self.note_tree = ttk.Treeview(left_frame, columns=columns, show="headings")
        self.note_tree.heading("note_id", text="备注ID")
        self.note_tree.heading("shift_date", text="值班日期")
        self.note_tree.heading("operator_name", text="值班人员")
        self.note_tree.heading("is_important", text="重要")
        self.note_tree.heading("created_time", text="创建时间")
        
        self.note_tree.column("note_id", width=80)
        self.note_tree.column("shift_date", width=100)
        self.note_tree.column("operator_name", width=80)
        self.note_tree.column("is_important", width=50)
        self.note_tree.column("created_time", width=140)
        
        note_scroll = ttk.Scrollbar(left_frame, orient=tk.VERTICAL, command=self.note_tree.yview)
        self.note_tree.configure(yscrollcommand=note_scroll.set)
        
        self.note_tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        note_scroll.pack(side=tk.RIGHT, fill=tk.Y)
        
        self.note_tree.bind("<<TreeviewSelect>>", self._on_note_select)
        
        right_frame = ttk.LabelFrame(paned, text="备注详情", padding="5")
        paned.add(right_frame, weight=2)
        
        self.note_detail_text = scrolledtext.ScrolledText(right_frame, wrap=tk.WORD, font=("Arial", 11))
        self.note_detail_text.pack(fill=tk.BOTH, expand=True)
    
    def _refresh_all_data(self):
        self._refresh_stats()
        self._refresh_samples()
        self._refresh_fridges()
        self._refresh_alerts()
        self._refresh_handovers()
        self._refresh_notes()
    
    def _refresh_stats(self):
        samples = self.data_store.samples
        in_fridge = len([s for s in samples if s.status == "在柜"])
        out_fridge = len(samples) - in_fridge
        
        alerts = self.data_store.alerts
        unresolved = len([a for a in alerts if not a.is_resolved])
        
        self.stats_labels["samples_total"].config(text=str(len(samples)))
        self.stats_labels["samples_in_fridge"].config(text=str(in_fridge))
        self.stats_labels["samples_out_fridge"].config(text=str(out_fridge))
        self.stats_labels["fridges_count"].config(text=str(len(self.data_store.fridges)))
        self.stats_labels["alerts_total"].config(text=str(len(alerts)))
        
        unresolved_label = self.stats_labels["alerts_unresolved"]
        unresolved_label.config(text=str(unresolved))
        if unresolved > 0:
            unresolved_label.config(foreground="red")
        else:
            unresolved_label.config(foreground="green")
        
        for item in self.overview_alert_tree.get_children():
            self.overview_alert_tree.delete(item)
        
        for alert in sorted(alerts, key=lambda a: a.timestamp, reverse=True)[:20]:
            status_text = "已解决" if alert.is_resolved else "未解决"
            self.overview_alert_tree.insert("", tk.END, values=(
                alert.alert_type.value,
                alert.message,
                alert.timestamp.strftime("%Y-%m-%d %H:%M"),
                status_text
            ))
    
    def _refresh_samples(self):
        for item in self.sample_tree.get_children():
            self.sample_tree.delete(item)
        
        filter_status = self.sample_filter_var.get()
        
        for sample in self.data_store.samples:
            if filter_status != "全部" and sample.status != filter_status:
                continue
            
            self.sample_tree.insert("", tk.END, values=(
                sample.sample_id,
                sample.sample_type.value,
                sample.rack_id,
                sample.position,
                sample.status,
                sample.scan_time.strftime("%Y-%m-%d %H:%M") if sample.scan_time else "",
                sample.in_fridge_time.strftime("%Y-%m-%d %H:%M") if sample.in_fridge_time else "",
                sample.out_fridge_time.strftime("%Y-%m-%d %H:%M") if sample.out_fridge_time else ""
            ))
    
    def _refresh_fridges(self):
        for item in self.fridge_tree.get_children():
            self.fridge_tree.delete(item)
        
        for fridge in self.data_store.fridges:
            temp_str = f"{fridge.current_temp}℃" if fridge.current_temp is not None else "N/A"
            if fridge.current_temp is not None and not fridge.is_temp_normal(fridge.current_temp):
                temp_str = f"{temp_str} ⚠️"
            
            self.fridge_tree.insert("", tk.END, iid=fridge.fridge_id, values=(
                fridge.fridge_id,
                fridge.name,
                f"{fridge.min_temp}-{fridge.max_temp}℃",
                temp_str,
                len(fridge.racks)
            ))
    
    def _refresh_racks(self, fridge_id: str = ""):
        for item in self.rack_tree.get_children():
            self.rack_tree.delete(item)
        
        racks = self.data_store.racks
        if fridge_id:
            racks = [r for r in racks if r.fridge_id == fridge_id]
        
        for rack in racks:
            positions = list(rack.occupied_positions.keys())
            positions_str = ", ".join(sorted(positions)) if positions else "无"
            
            self.rack_tree.insert("", tk.END, values=(
                rack.rack_id,
                rack.capacity,
                len(rack.occupied_positions),
                positions_str
            ))
    
    def _refresh_alerts(self):
        for item in self.alert_tree.get_children():
            self.alert_tree.delete(item)
        
        filter_status = self.alert_filter_var.get()
        
        for alert in sorted(self.data_store.alerts, key=lambda a: a.timestamp, reverse=True):
            if filter_status == "未解决" and alert.is_resolved:
                continue
            if filter_status == "已解决" and not alert.is_resolved:
                continue
            
            self.alert_tree.insert("", tk.END, iid=alert.alert_id, values=(
                alert.alert_id,
                alert.alert_type.value,
                alert.related_id,
                alert.related_type,
                alert.message,
                alert.timestamp.strftime("%Y-%m-%d %H:%M:%S"),
                "已解决" if alert.is_resolved else "未解决"
            ))
    
    def _refresh_handovers(self):
        for item in self.handover_tree.get_children():
            self.handover_tree.delete(item)
        
        for record in sorted(self.data_store.handovers, key=lambda r: r.handover_time, reverse=True):
            self.handover_tree.insert("", tk.END, iid=record.record_id, values=(
                record.record_id,
                record.sample_id,
                record.from_operator,
                record.to_operator,
                record.handover_time.strftime("%Y-%m-%d %H:%M:%S"),
                record.status.value,
                record.notes
            ))
    
    def _refresh_notes(self):
        for item in self.note_tree.get_children():
            self.note_tree.delete(item)
        
        for note in sorted(self.data_store.duty_notes, key=lambda n: n.created_time, reverse=True):
            self.note_tree.insert("", tk.END, iid=note.note_id, values=(
                note.note_id[:8] + "...",
                note.shift_date.strftime("%Y-%m-%d") if note.shift_date else "",
                note.operator_name,
                "是" if note.is_important else "否",
                note.created_time.strftime("%Y-%m-%d %H:%M")
            ))
    
    def _on_fridge_select(self, event):
        selection = self.fridge_tree.selection()
        if selection:
            fridge_id = selection[0]
            self._refresh_racks(fridge_id)
    
    def _on_note_select(self, event):
        selection = self.note_tree.selection()
        if selection:
            note_id_full = self.note_tree.item(selection[0], "values")[0]
            note_id_prefix = note_id_full.replace("...", "")
            
            note = next((n for n in self.data_store.duty_notes if n.note_id.startswith(note_id_prefix)), None)
            if note:
                self.note_detail_text.delete(1.0, tk.END)
                content = f"值班人员: {note.operator_name}\n"
                content += f"值班日期: {note.shift_date.strftime('%Y-%m-%d') if note.shift_date else ''}\n"
                content += f"重要程度: {'重要' if note.is_important else '普通'}\n"
                content += f"创建时间: {note.created_time.strftime('%Y-%m-%d %H:%M:%S')}\n"
                content += "-" * 50 + "\n\n"
                content += note.content
                self.note_detail_text.insert(1.0, content)
    
    def _run_rules(self):
        context = self.data_store.get_context()
        alerts = self.rule_engine.get_all_alerts(context)
        
        for alert in alerts:
            existing = next((a for a in self.data_store.alerts if 
                           a.alert_type == alert.alert_type and 
                           a.related_id == alert.related_id and 
                           not a.is_resolved), None)
            if not existing:
                self.data_store.add_alert(alert)
        
        self._refresh_all_data()
        messagebox.showinfo("规则检测", f"检测完成，共发现 {len(alerts)} 个告警")
    
    def _save_data(self):
        self.data_store.save_all()
        messagebox.showinfo("保存成功", "数据已保存")
    
    def _import_samples_csv(self):
        file_path = filedialog.askopenfilename(
            title="选择扫码枪CSV文件",
            filetypes=[("CSV文件", "*.csv"), ("所有文件", "*.*")]
        )
        if not file_path:
            return
        
        try:
            samples = self.importer.import_samples_from_csv(file_path)
            count = 0
            for sample in samples:
                if self.data_store.add_sample(sample):
                    count += 1
            
            self._refresh_all_data()
            messagebox.showinfo("导入成功", f"成功导入 {count} 个样本")
        except Exception as e:
            messagebox.showerror("导入失败", f"导入出错: {str(e)}")
    
    def _import_temperature_json(self):
        file_path = filedialog.askopenfilename(
            title="选择温度记录JSON文件",
            filetypes=[("JSON文件", "*.json"), ("所有文件", "*.*")]
        )
        if not file_path:
            return
        
        try:
            records = self.importer.import_temperature_from_json(file_path)
            for record in records:
                self.data_store.add_temperature_record(record)
                
                fridge_id = record.get("fridge_id")
                temp = record.get("temperature")
                fridge = next((f for f in self.data_store.fridges if f.fridge_id == fridge_id), None)
                if fridge and temp is not None:
                    fridge.current_temp = temp
                    fridge.last_temp_time = record.get("timestamp") or datetime.now()
            
            self._refresh_all_data()
            messagebox.showinfo("导入成功", f"成功导入 {len(records)} 条温度记录")
        except Exception as e:
            messagebox.showerror("导入失败", f"导入出错: {str(e)}")
    
    def _import_handover_csv(self):
        file_path = filedialog.askopenfilename(
            title="选择交接表CSV文件",
            filetypes=[("CSV文件", "*.csv"), ("所有文件", "*.*")]
        )
        if not file_path:
            return
        
        try:
            records = self.importer.import_handover_from_csv(file_path)
            count = 0
            for record in records:
                if self.data_store.add_handover(record):
                    count += 1
            
            self._refresh_all_data()
            messagebox.showinfo("导入成功", f"成功导入 {count} 条交接记录")
        except Exception as e:
            messagebox.showerror("导入失败", f"导入出错: {str(e)}")
    
    def _export_handover_md(self):
        file_path = filedialog.asksaveasfilename(
            title="保存交接单",
            defaultextension=".md",
            filetypes=[("Markdown文件", "*.md"), ("所有文件", "*.*")],
            initialfile=f"交接单_{datetime.now().strftime('%Y%m%d_%H%M%S')}.md"
        )
        if not file_path:
            return
        
        try:
            content = self.md_exporter.generate_handover_report(
                samples=self.data_store.samples,
                fridges=self.data_store.fridges,
                racks=self.data_store.racks,
                handovers=self.data_store.handovers,
                alerts=self.data_store.alerts,
                duty_notes=self.data_store.duty_notes,
                operator_name=self.current_operator.get()
            )
            self.md_exporter.export_to_file(file_path, content)
            messagebox.showinfo("导出成功", f"交接单已保存至: {file_path}")
        except Exception as e:
            messagebox.showerror("导出失败", f"导出出错: {str(e)}")
    
    def _export_risk_csv(self):
        file_path = filedialog.asksaveasfilename(
            title="保存风险清单",
            defaultextension=".csv",
            filetypes=[("CSV文件", "*.csv"), ("所有文件", "*.*")],
            initialfile=f"风险清单_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
        )
        if not file_path:
            return
        
        try:
            self.csv_exporter.export_risk_summary(
                alerts=self.data_store.alerts,
                samples=self.data_store.samples,
                file_path=file_path
            )
            messagebox.showinfo("导出成功", f"风险清单已保存至: {file_path}")
        except Exception as e:
            messagebox.showerror("导出失败", f"导出出错: {str(e)}")
    
    def _export_alerts_csv(self):
        file_path = filedialog.asksaveasfilename(
            title="保存告警记录",
            defaultextension=".csv",
            filetypes=[("CSV文件", "*.csv"), ("所有文件", "*.*")],
            initialfile=f"告警记录_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
        )
        if not file_path:
            return
        
        try:
            self.csv_exporter.export_alerts(
                alerts=self.data_store.alerts,
                file_path=file_path
            )
            messagebox.showinfo("导出成功", f"告警记录已保存至: {file_path}")
        except Exception as e:
            messagebox.showerror("导出失败", f"导出出错: {str(e)}")
    
    def _resolve_alert(self):
        selection = self.alert_tree.selection()
        if not selection:
            messagebox.showwarning("警告", "请先选择要标记的告警")
            return
        
        alert_id = selection[0]
        alert = next((a for a in self.data_store.alerts if a.alert_id == alert_id), None)
        
        if alert:
            alert.is_resolved = True
            alert.resolved_time = datetime.now()
            alert.resolver = self.current_operator.get() or "系统"
            self._refresh_all_data()
            messagebox.showinfo("成功", "告警已标记为已解决")
    
    def _confirm_handover(self):
        selection = self.handover_tree.selection()
        if not selection:
            messagebox.showwarning("警告", "请先选择要确认的交接记录")
            return
        
        record_id = selection[0]
        record = next((h for h in self.data_store.handovers if h.record_id == record_id), None)
        
        if record:
            record.status = HandoverStatus.COMPLETED
            self._refresh_all_data()
            messagebox.showinfo("成功", "交接已确认")
    
    def _delete_note(self):
        selection = self.note_tree.selection()
        if not selection:
            messagebox.showwarning("警告", "请先选择要删除的备注")
            return
        
        note_id_full = self.note_tree.item(selection[0], "values")[0]
        note_id_prefix = note_id_full.replace("...", "")
        
        note = next((n for n in self.data_store.duty_notes if n.note_id.startswith(note_id_prefix)), None)
        if note and messagebox.askyesno("确认", "确定要删除这条备注吗？"):
            self.data_store.duty_notes.remove(note)
            self._refresh_notes()
            self.note_detail_text.delete(1.0, tk.END)
    
    def _clear_all_data(self):
        if messagebox.askyesno("确认", "确定要清空所有数据吗？此操作不可恢复！"):
            self.data_store.clear_all()
            self._refresh_all_data()
            messagebox.showinfo("完成", "所有数据已清空")
    
    def _open_add_sample_dialog(self):
        dialog = tk.Toplevel(self.root)
        dialog.title("添加样本")
        dialog.geometry("400x350")
        dialog.transient(self.root)
        dialog.grab_set()
        
        ttk.Label(dialog, text="样本ID:").grid(row=0, column=0, sticky=tk.W, padx=10, pady=5)
        sample_id_entry = ttk.Entry(dialog, width=30)
        sample_id_entry.grid(row=0, column=1, padx=10, pady=5)
        
        ttk.Label(dialog, text="样本类型:").grid(row=1, column=0, sticky=tk.W, padx=10, pady=5)
        sample_type_var = tk.StringVar(value="血样")
        type_combo = ttk.Combobox(dialog, textvariable=sample_type_var, values=["血样", "试剂", "其他"], state="readonly")
        type_combo.grid(row=1, column=1, padx=10, pady=5, sticky=tk.W)
        
        ttk.Label(dialog, text="架位ID:").grid(row=2, column=0, sticky=tk.W, padx=10, pady=5)
        rack_id_entry = ttk.Entry(dialog, width=30)
        rack_id_entry.grid(row=2, column=1, padx=10, pady=5)
        
        ttk.Label(dialog, text="位置:").grid(row=3, column=0, sticky=tk.W, padx=10, pady=5)
        position_entry = ttk.Entry(dialog, width=30)
        position_entry.grid(row=3, column=1, padx=10, pady=5)
        
        ttk.Label(dialog, text="状态:").grid(row=4, column=0, sticky=tk.W, padx=10, pady=5)
        status_var = tk.StringVar(value="在柜")
        status_combo = ttk.Combobox(dialog, textvariable=status_var, values=["在柜", "离柜"], state="readonly")
        status_combo.grid(row=4, column=1, padx=10, pady=5, sticky=tk.W)
        
        def save_sample():
            sample_id = sample_id_entry.get().strip()
            if not sample_id:
                messagebox.showerror("错误", "请输入样本ID")
                return
            
            type_map = {"血样": SampleType.BLOOD, "试剂": SampleType.REAGENT, "其他": SampleType.OTHER}
            sample_type = type_map.get(sample_type_var.get(), SampleType.OTHER)
            
            sample = Sample(
                sample_id=sample_id,
                sample_type=sample_type,
                rack_id=rack_id_entry.get().strip(),
                position=position_entry.get().strip(),
                scan_time=datetime.now(),
                status=status_var.get()
            )
            
            if self.data_store.add_sample(sample):
                self._refresh_all_data()
                dialog.destroy()
                messagebox.showinfo("成功", "样本添加成功")
            else:
                messagebox.showerror("错误", "样本ID已存在")
        
        btn_frame = ttk.Frame(dialog)
        btn_frame.grid(row=5, column=0, columnspan=2, pady=20)
        ttk.Button(btn_frame, text="保存", command=save_sample).pack(side=tk.LEFT, padx=10)
        ttk.Button(btn_frame, text="取消", command=dialog.destroy).pack(side=tk.LEFT, padx=10)
    
    def _open_add_fridge_dialog(self):
        dialog = tk.Toplevel(self.root)
        dialog.title("添加冰箱")
        dialog.geometry("400x300")
        dialog.transient(self.root)
        dialog.grab_set()
        
        ttk.Label(dialog, text="冰箱ID:").grid(row=0, column=0, sticky=tk.W, padx=10, pady=5)
        fridge_id_entry = ttk.Entry(dialog, width=30)
        fridge_id_entry.grid(row=0, column=1, padx=10, pady=5)
        
        ttk.Label(dialog, text="名称:").grid(row=1, column=0, sticky=tk.W, padx=10, pady=5)
        name_entry = ttk.Entry(dialog, width=30)
        name_entry.grid(row=1, column=1, padx=10, pady=5)
        
        ttk.Label(dialog, text="最低温度(℃):").grid(row=2, column=0, sticky=tk.W, padx=10, pady=5)
        min_temp_entry = ttk.Entry(dialog, width=30)
        min_temp_entry.insert(0, "2")
        min_temp_entry.grid(row=2, column=1, padx=10, pady=5)
        
        ttk.Label(dialog, text="最高温度(℃):").grid(row=3, column=0, sticky=tk.W, padx=10, pady=5)
        max_temp_entry = ttk.Entry(dialog, width=30)
        max_temp_entry.insert(0, "8")
        max_temp_entry.grid(row=3, column=1, padx=10, pady=5)
        
        def save_fridge():
            fridge_id = fridge_id_entry.get().strip()
            if not fridge_id:
                messagebox.showerror("错误", "请输入冰箱ID")
                return
            
            try:
                min_temp = float(min_temp_entry.get())
                max_temp = float(max_temp_entry.get())
            except ValueError:
                messagebox.showerror("错误", "温度必须是数字")
                return
            
            fridge = Fridge(
                fridge_id=fridge_id,
                name=name_entry.get().strip() or fridge_id,
                min_temp=min_temp,
                max_temp=max_temp
            )
            
            if self.data_store.add_fridge(fridge):
                self._refresh_all_data()
                dialog.destroy()
                messagebox.showinfo("成功", "冰箱添加成功")
            else:
                messagebox.showerror("错误", "冰箱ID已存在")
        
        btn_frame = ttk.Frame(dialog)
        btn_frame.grid(row=4, column=0, columnspan=2, pady=20)
        ttk.Button(btn_frame, text="保存", command=save_fridge).pack(side=tk.LEFT, padx=10)
        ttk.Button(btn_frame, text="取消", command=dialog.destroy).pack(side=tk.LEFT, padx=10)
    
    def _open_add_rack_dialog(self):
        selection = self.fridge_tree.selection()
        if not selection:
            messagebox.showwarning("警告", "请先在左侧选择一个冰箱")
            return
        
        fridge_id = selection[0]
        
        dialog = tk.Toplevel(self.root)
        dialog.title("添加架位")
        dialog.geometry("350x200")
        dialog.transient(self.root)
        dialog.grab_set()
        
        ttk.Label(dialog, text=f"所属冰箱: {fridge_id}").grid(row=0, column=0, columnspan=2, padx=10, pady=10)
        
        ttk.Label(dialog, text="架位ID:").grid(row=1, column=0, sticky=tk.W, padx=10, pady=5)
        rack_id_entry = ttk.Entry(dialog, width=25)
        rack_id_entry.grid(row=1, column=1, padx=10, pady=5)
        
        ttk.Label(dialog, text="容量:").grid(row=2, column=0, sticky=tk.W, padx=10, pady=5)
        capacity_entry = ttk.Entry(dialog, width=25)
        capacity_entry.insert(0, "20")
        capacity_entry.grid(row=2, column=1, padx=10, pady=5)
        
        def save_rack():
            rack_id = rack_id_entry.get().strip()
            if not rack_id:
                messagebox.showerror("错误", "请输入架位ID")
                return
            
            try:
                capacity = int(capacity_entry.get())
            except ValueError:
                messagebox.showerror("错误", "容量必须是整数")
                return
            
            rack = Rack(
                rack_id=rack_id,
                fridge_id=fridge_id,
                capacity=capacity
            )
            
            if self.data_store.add_rack(rack):
                fridge = next((f for f in self.data_store.fridges if f.fridge_id == fridge_id), None)
                if fridge and rack_id not in fridge.racks:
                    fridge.racks.append(rack_id)
                
                self._refresh_all_data()
                dialog.destroy()
                messagebox.showinfo("成功", "架位添加成功")
            else:
                messagebox.showerror("错误", "架位ID已存在")
        
        btn_frame = ttk.Frame(dialog)
        btn_frame.grid(row=3, column=0, columnspan=2, pady=20)
        ttk.Button(btn_frame, text="保存", command=save_rack).pack(side=tk.LEFT, padx=10)
        ttk.Button(btn_frame, text="取消", command=dialog.destroy).pack(side=tk.LEFT, padx=10)
    
    def _open_add_handover_dialog(self):
        dialog = tk.Toplevel(self.root)
        dialog.title("添加交接记录")
        dialog.geometry("400x350")
        dialog.transient(self.root)
        dialog.grab_set()
        
        ttk.Label(dialog, text="样本ID:").grid(row=0, column=0, sticky=tk.W, padx=10, pady=5)
        sample_id_entry = ttk.Entry(dialog, width=30)
        sample_id_entry.grid(row=0, column=1, padx=10, pady=5)
        
        ttk.Label(dialog, text="移交人:").grid(row=1, column=0, sticky=tk.W, padx=10, pady=5)
        from_entry = ttk.Entry(dialog, width=30, textvariable=self.current_operator)
        from_entry.grid(row=1, column=1, padx=10, pady=5)
        
        ttk.Label(dialog, text="接收人:").grid(row=2, column=0, sticky=tk.W, padx=10, pady=5)
        to_entry = ttk.Entry(dialog, width=30)
        to_entry.grid(row=2, column=1, padx=10, pady=5)
        
        ttk.Label(dialog, text="状态:").grid(row=3, column=0, sticky=tk.W, padx=10, pady=5)
        status_var = tk.StringVar(value="待交接")
        status_combo = ttk.Combobox(dialog, textvariable=status_var, 
                                    values=["待交接", "交接中", "已交接"], state="readonly")
        status_combo.grid(row=3, column=1, padx=10, pady=5, sticky=tk.W)
        
        ttk.Label(dialog, text="备注:").grid(row=4, column=0, sticky=tk.NW, padx=10, pady=5)
        notes_text = tk.Text(dialog, width=30, height=3)
        notes_text.grid(row=4, column=1, padx=10, pady=5)
        
        def save_handover():
            sample_id = sample_id_entry.get().strip()
            if not sample_id:
                messagebox.showerror("错误", "请输入样本ID")
                return
            
            status_map = {
                "待交接": HandoverStatus.PENDING,
                "交接中": HandoverStatus.IN_PROGRESS,
                "已交接": HandoverStatus.COMPLETED
            }
            
            record = HandoverRecord(
                record_id=str(uuid4()),
                sample_id=sample_id,
                from_operator=from_entry.get().strip(),
                to_operator=to_entry.get().strip(),
                handover_time=datetime.now(),
                status=status_map.get(status_var.get(), HandoverStatus.PENDING),
                notes=notes_text.get(1.0, tk.END).strip()
            )
            
            if self.data_store.add_handover(record):
                self._refresh_all_data()
                dialog.destroy()
                messagebox.showinfo("成功", "交接记录添加成功")
            else:
                messagebox.showerror("错误", "记录已存在")
        
        btn_frame = ttk.Frame(dialog)
        btn_frame.grid(row=5, column=0, columnspan=2, pady=15)
        ttk.Button(btn_frame, text="保存", command=save_handover).pack(side=tk.LEFT, padx=10)
        ttk.Button(btn_frame, text="取消", command=dialog.destroy).pack(side=tk.LEFT, padx=10)
    
    def _open_add_note_dialog(self):
        dialog = tk.Toplevel(self.root)
        dialog.title("添加值班备注")
        dialog.geometry("450x400")
        dialog.transient(self.root)
        dialog.grab_set()
        
        ttk.Label(dialog, text="值班人员:").grid(row=0, column=0, sticky=tk.W, padx=10, pady=5)
        operator_entry = ttk.Entry(dialog, width=35, textvariable=self.current_operator)
        operator_entry.grid(row=0, column=1, padx=10, pady=5)
        
        ttk.Label(dialog, text="值班日期:").grid(row=1, column=0, sticky=tk.W, padx=10, pady=5)
        date_entry = ttk.Entry(dialog, width=35)
        date_entry.insert(0, datetime.now().strftime("%Y-%m-%d"))
        date_entry.grid(row=1, column=1, padx=10, pady=5)
        
        important_var = tk.BooleanVar(value=False)
        ttk.Checkbutton(dialog, text="标记为重要", variable=important_var).grid(row=2, column=0, columnspan=2, padx=10, pady=5)
        
        ttk.Label(dialog, text="备注内容:").grid(row=3, column=0, sticky=tk.NW, padx=10, pady=5)
        content_text = scrolledtext.ScrolledText(dialog, width=40, height=12)
        content_text.grid(row=3, column=1, padx=10, pady=5)
        
        def save_note():
            content = content_text.get(1.0, tk.END).strip()
            if not content:
                messagebox.showerror("错误", "请输入备注内容")
                return
            
            try:
                shift_date = datetime.strptime(date_entry.get().strip(), "%Y-%m-%d")
            except ValueError:
                shift_date = datetime.now()
            
            note = DutyNote(
                note_id=str(uuid4()),
                shift_date=shift_date,
                operator_name=operator_entry.get().strip(),
                content=content,
                created_time=datetime.now(),
                is_important=important_var.get()
            )
            
            if self.data_store.add_duty_note(note):
                self._refresh_all_data()
                dialog.destroy()
                messagebox.showinfo("成功", "备注添加成功")
            else:
                messagebox.showerror("错误", "添加失败")
        
        btn_frame = ttk.Frame(dialog)
        btn_frame.grid(row=4, column=0, columnspan=2, pady=15)
        ttk.Button(btn_frame, text="保存", command=save_note).pack(side=tk.LEFT, padx=10)
        ttk.Button(btn_frame, text="取消", command=dialog.destroy).pack(side=tk.LEFT, padx=10)
    
    def _edit_sample(self):
        selection = self.sample_tree.selection()
        if not selection:
            return
        
        values = self.sample_tree.item(selection[0], "values")
        sample_id = values[0]
        
        sample = next((s for s in self.data_store.samples if s.sample_id == sample_id), None)
        if not sample:
            return
        
        dialog = tk.Toplevel(self.root)
        dialog.title("编辑样本")
        dialog.geometry("400x350")
        dialog.transient(self.root)
        dialog.grab_set()
        
        ttk.Label(dialog, text=f"样本ID: {sample_id}").grid(row=0, column=0, columnspan=2, padx=10, pady=10)
        
        ttk.Label(dialog, text="样本类型:").grid(row=1, column=0, sticky=tk.W, padx=10, pady=5)
        sample_type_var = tk.StringVar(value=sample.sample_type.value)
        type_combo = ttk.Combobox(dialog, textvariable=sample_type_var, values=["血样", "试剂", "其他"], state="readonly")
        type_combo.grid(row=1, column=1, padx=10, pady=5, sticky=tk.W)
        
        ttk.Label(dialog, text="架位ID:").grid(row=2, column=0, sticky=tk.W, padx=10, pady=5)
        rack_id_entry = ttk.Entry(dialog, width=30)
        rack_id_entry.insert(0, sample.rack_id)
        rack_id_entry.grid(row=2, column=1, padx=10, pady=5)
        
        ttk.Label(dialog, text="位置:").grid(row=3, column=0, sticky=tk.W, padx=10, pady=5)
        position_entry = ttk.Entry(dialog, width=30)
        position_entry.insert(0, sample.position)
        position_entry.grid(row=3, column=1, padx=10, pady=5)
        
        ttk.Label(dialog, text="状态:").grid(row=4, column=0, sticky=tk.W, padx=10, pady=5)
        status_var = tk.StringVar(value=sample.status)
        status_combo = ttk.Combobox(dialog, textvariable=status_var, values=["在柜", "离柜"], state="readonly")
        status_combo.grid(row=4, column=1, padx=10, pady=5, sticky=tk.W)
        
        def save_sample():
            type_map = {"血样": SampleType.BLOOD, "试剂": SampleType.REAGENT, "其他": SampleType.OTHER}
            
            self.data_store.update_sample(
                sample_id,
                sample_type=type_map.get(sample_type_var.get(), SampleType.OTHER),
                rack_id=rack_id_entry.get().strip(),
                position=position_entry.get().strip(),
                status=status_var.get()
            )
            
            self._refresh_all_data()
            dialog.destroy()
            messagebox.showinfo("成功", "样本更新成功")
        
        btn_frame = ttk.Frame(dialog)
        btn_frame.grid(row=5, column=0, columnspan=2, pady=20)
        ttk.Button(btn_frame, text="保存", command=save_sample).pack(side=tk.LEFT, padx=10)
        ttk.Button(btn_frame, text="取消", command=dialog.destroy).pack(side=tk.LEFT, padx=10)
    
    def _show_about(self):
        messagebox.showinfo(
            "关于",
            "冰箱样本温控交接台 v1.0.0\n\n"
            "医院检验科夜班专用离线工具\n\n"
            "功能:\n"
            "- 导入扫码枪CSV、温度记录JSON、交接表CSV\n"
            "- 检测超时离柜、温度越界、架位冲突、缺签\n"
            "- 导出Markdown交接单、CSV风险清单\n"
            "- 值班备注持久化存储"
        )
    
    def _on_close(self):
        if messagebox.askyesno("确认退出", "是否保存数据后退出？"):
            self.data_store.save_all()
        self.root.destroy()
    
    def run(self):
        self.root.mainloop()


def run_gui():
    app = MainWindow()
    app.run()


if __name__ == "__main__":
    run_gui()
