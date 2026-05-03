import tkinter as tk
from tkinter import ttk, messagebox, filedialog, scrolledtext
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Callable
import threading
import os
from pathlib import Path

from core import (
    Storage, RulesEngine, Exporter,
    CSVParser, JSONLParser, YAMLParser,
    CaseData, RiskType, RiskSeverity, Species
)


class AnesthesiaReviewApp:
    
    def __init__(self, root: tk.Tk):
        self.root = root
        self.root.title("麻醉病例复盘工具")
        self.root.geometry("1400x900")
        self.root.minsize(1000, 700)
        
        self.storage = Storage()
        self.rules_engine = RulesEngine()
        
        self.current_case_data: Optional[CaseData] = None
        self.drug_rules = []
        
        self._create_menu()
        self._create_layout()
        self._load_drug_rules()
        self._refresh_case_list()
    
    def _create_menu(self):
        menubar = tk.Menu(self.root)
        self.root.config(menu=menubar)
        
        file_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="文件", menu=file_menu)
        file_menu.add_command(label="导入病例CSV", command=self._import_cases_csv)
        file_menu.add_command(label="导入监护数据JSONL", command=self._import_vitals_jsonl)
        file_menu.add_command(label="导入药物规则YAML", command=self._import_drug_rules)
        file_menu.add_separator()
        file_menu.add_command(label="导出问题CSV", command=self._export_issues_csv)
        file_menu.add_command(label="导出麻醉报告MD", command=self._export_report_md)
        file_menu.add_separator()
        file_menu.add_command(label="退出", command=self.root.quit)
        
        data_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="数据", menu=data_menu)
        data_menu.add_command(label="加载示例数据", command=self._load_sample_data)
        data_menu.add_command(label="刷新病例列表", command=self._refresh_case_list)
        
        help_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="帮助", menu=help_menu)
        help_menu.add_command(label="关于", command=self._show_about)
    
    def _create_layout(self):
        self.paned = ttk.PanedWindow(self.root, orient=tk.HORIZONTAL)
        self.paned.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)
        
        left_frame = ttk.Frame(self.paned, width=300)
        self.paned.add(left_frame, weight=1)
        
        self._create_case_list_panel(left_frame)
        
        right_frame = ttk.Frame(self.paned)
        self.paned.add(right_frame, weight=3)
        
        self._create_detail_notebook(right_frame)
    
    def _create_case_list_panel(self, parent):
        frame = ttk.LabelFrame(parent, text="病例列表", padding=5)
        frame.pack(fill=tk.BOTH, expand=True)
        
        columns = ('case_id', 'patient_name', 'species', 'surgery_type', 'start_time')
        self.case_tree = ttk.Treeview(frame, columns=columns, show='headings', height=15)
        
        self.case_tree.heading('case_id', text='病例ID')
        self.case_tree.heading('patient_name', text='动物姓名')
        self.case_tree.heading('species', text='物种')
        self.case_tree.heading('surgery_type', text='手术类型')
        self.case_tree.heading('start_time', text='开始时间')
        
        self.case_tree.column('case_id', width=80)
        self.case_tree.column('patient_name', width=80)
        self.case_tree.column('species', width=50)
        self.case_tree.column('surgery_type', width=100)
        self.case_tree.column('start_time', width=130)
        
        self.case_tree.pack(fill=tk.BOTH, expand=True)
        self.case_tree.bind('<<TreeviewSelect>>', self._on_case_select)
        
        btn_frame = ttk.Frame(frame)
        btn_frame.pack(fill=tk.X, pady=5)
        
        ttk.Button(btn_frame, text="刷新", command=self._refresh_case_list).pack(side=tk.LEFT, padx=2)
        ttk.Button(btn_frame, text="删除选中", command=self._delete_selected_case).pack(side=tk.LEFT, padx=2)
        ttk.Button(btn_frame, text="分析风险", command=self._analyze_current_case).pack(side=tk.LEFT, padx=2)
    
    def _create_detail_notebook(self, parent):
        self.notebook = ttk.Notebook(parent)
        self.notebook.pack(fill=tk.BOTH, expand=True)
        
        info_frame = ttk.Frame(self.notebook)
        self.notebook.add(info_frame, text="基本信息")
        self._create_info_panel(info_frame)
        
        timeline_frame = ttk.Frame(self.notebook)
        self.notebook.add(timeline_frame, text="时间线")
        self._create_timeline_panel(timeline_frame)
        
        risks_frame = ttk.Frame(self.notebook)
        self.notebook.add(risks_frame, text="风险事件")
        self._create_risks_panel(risks_frame)
        
        vitals_frame = ttk.Frame(self.notebook)
        self.notebook.add(vitals_frame, text="生命体征")
        self._create_vitals_panel(vitals_frame)
        
        drugs_frame = ttk.Frame(self.notebook)
        self.notebook.add(drugs_frame, text="用药记录")
        self._create_drugs_panel(drugs_frame)
        
        notes_frame = ttk.Frame(self.notebook)
        self.notebook.add(notes_frame, text="术后备注")
        self._create_notes_panel(notes_frame)
    
    def _create_info_panel(self, parent):
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
        
        self.info_frame = scrollable_frame
        
        info_inner = ttk.LabelFrame(self.info_frame, text="病例信息", padding=10)
        info_inner.pack(fill=tk.X, padx=10, pady=10)
        
        self.info_labels = {}
        row = 0
        
        fields = [
            ('case_id', '病例ID'),
            ('patient_name', '动物姓名'),
            ('species', '物种'),
            ('weight', '体重'),
            ('surgery_type', '手术类型'),
            ('anesthesiologist', '麻醉师'),
            ('start_time', '手术开始'),
            ('end_time', '手术结束'),
            ('notes', '备注'),
        ]
        
        for key, label in fields:
            ttk.Label(info_inner, text=f"{label}:").grid(row=row, column=0, sticky=tk.E, padx=5, pady=3)
            value_label = ttk.Label(info_inner, text="-")
            value_label.grid(row=row, column=1, sticky=tk.W, padx=5, pady=3)
            self.info_labels[key] = value_label
            row += 1
        
        stats_frame = ttk.LabelFrame(self.info_frame, text="统计信息", padding=10)
        stats_frame.pack(fill=tk.X, padx=10, pady=10)
        
        self.stats_labels = {}
        stats_fields = [
            ('vitals_count', '生命体征记录数'),
            ('drugs_count', '用药记录数'),
            ('risks_total', '风险事件总数'),
            ('risks_high', '高危事件数'),
            ('risks_medium', '中危事件数'),
            ('risks_low', '低危事件数'),
            ('risks_confirmed', '已确认风险数'),
        ]
        
        for i, (key, label) in enumerate(stats_fields):
            row_frame = ttk.Frame(stats_frame)
            row_frame.pack(fill=tk.X, pady=2)
            ttk.Label(row_frame, text=f"{label}:").pack(side=tk.LEFT, padx=5)
            value_label = ttk.Label(row_frame, text="0")
            value_label.pack(side=tk.LEFT, padx=5)
            self.stats_labels[key] = value_label
    
    def _create_timeline_panel(self, parent):
        columns = ('time', 'type', 'description', 'details')
        self.timeline_tree = ttk.Treeview(parent, columns=columns, show='headings', height=20)
        
        self.timeline_tree.heading('time', text='时间')
        self.timeline_tree.heading('type', text='类型')
        self.timeline_tree.heading('description', text='描述')
        self.timeline_tree.heading('details', text='详情')
        
        self.timeline_tree.column('time', width=120)
        self.timeline_tree.column('type', width=80)
        self.timeline_tree.column('description', width=300)
        self.timeline_tree.column('details', width=300)
        
        scrollbar = ttk.Scrollbar(parent, orient=tk.VERTICAL, command=self.timeline_tree.yview)
        self.timeline_tree.configure(yscrollcommand=scrollbar.set)
        
        self.timeline_tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
        
        type_tags = {
            'surgery_start': ('#1f77b4',),
            'surgery_end': ('#2ca02c',),
            'vitals': ('#7f7f7f',),
            'drug': ('#ff7f0e',),
            'risk': ('#d62728',),
        }
        
        for tag, colors in type_tags.items():
            self.timeline_tree.tag_configure(tag, foreground=colors[0])
    
    def _create_risks_panel(self, parent):
        toolbar = ttk.Frame(parent)
        toolbar.pack(fill=tk.X, padx=5, pady=5)
        
        ttk.Button(toolbar, text="确认选中风险", command=self._confirm_selected_risks).pack(side=tk.LEFT, padx=2)
        ttk.Button(toolbar, text="刷新风险分析", command=self._analyze_current_case).pack(side=tk.LEFT, padx=2)
        ttk.Button(toolbar, text="仅显示未确认", command=self._filter_unconfirmed_risks).pack(side=tk.LEFT, padx=2)
        ttk.Button(toolbar, text="显示全部", command=self._refresh_risks_view).pack(side=tk.LEFT, padx=2)
        
        columns = ('risk_id', 'type', 'severity', 'start_time', 'end_time', 'description', 'confirmed')
        self.risks_tree = ttk.Treeview(parent, columns=columns, show='headings', height=15)
        
        self.risks_tree.heading('risk_id', text='ID')
        self.risks_tree.heading('type', text='风险类型')
        self.risks_tree.heading('severity', text='严重程度')
        self.risks_tree.heading('start_time', text='开始时间')
        self.risks_tree.heading('end_time', text='结束时间')
        self.risks_tree.heading('description', text='描述')
        self.risks_tree.heading('confirmed', text='状态')
        
        self.risks_tree.column('risk_id', width=50)
        self.risks_tree.column('type', width=100)
        self.risks_tree.column('severity', width=80)
        self.risks_tree.column('start_time', width=120)
        self.risks_tree.column('end_time', width=120)
        self.risks_tree.column('description', width=350)
        self.risks_tree.column('confirmed', width=80)
        
        scrollbar = ttk.Scrollbar(parent, orient=tk.VERTICAL, command=self.risks_tree.yview)
        self.risks_tree.configure(yscrollcommand=scrollbar.set)
        
        self.risks_tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
        
        self.risks_tree.tag_configure('high', background='#ffcccc')
        self.risks_tree.tag_configure('medium', background='#ffffcc')
        self.risks_tree.tag_configure('low', background='#ccffcc')
        self.risks_tree.tag_configure('confirmed', foreground='#006600')
    
    def _create_vitals_panel(self, parent):
        columns = ('time', 'hr', 'rr', 'sbp', 'dbp', 'map', 'temp', 'spo2', 'etco2')
        self.vitals_tree = ttk.Treeview(parent, columns=columns, show='headings', height=20)
        
        self.vitals_tree.heading('time', text='时间')
        self.vitals_tree.heading('hr', text='心率')
        self.vitals_tree.heading('rr', text='呼吸')
        self.vitals_tree.heading('sbp', text='收缩压')
        self.vitals_tree.heading('dbp', text='舒张压')
        self.vitals_tree.heading('map', text='平均压')
        self.vitals_tree.heading('temp', text='体温')
        self.vitals_tree.heading('spo2', text='血氧')
        self.vitals_tree.heading('etco2', text='EtCO2')
        
        self.vitals_tree.column('time', width=120)
        self.vitals_tree.column('hr', width=60)
        self.vitals_tree.column('rr', width=60)
        self.vitals_tree.column('sbp', width=70)
        self.vitals_tree.column('dbp', width=70)
        self.vitals_tree.column('map', width=70)
        self.vitals_tree.column('temp', width=60)
        self.vitals_tree.column('spo2', width=60)
        self.vitals_tree.column('etco2', width=60)
        
        scrollbar = ttk.Scrollbar(parent, orient=tk.VERTICAL, command=self.vitals_tree.yview)
        self.vitals_tree.configure(yscrollcommand=scrollbar.set)
        
        self.vitals_tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
        
        self.vitals_tree.tag_configure('abnormal', background='#fff3cd')
    
    def _create_drugs_panel(self, parent):
        columns = ('time', 'drug_name', 'dose', 'unit', 'route', 'notes')
        self.drugs_tree = ttk.Treeview(parent, columns=columns, show='headings', height=20)
        
        self.drugs_tree.heading('time', text='时间')
        self.drugs_tree.heading('drug_name', text='药物名称')
        self.drugs_tree.heading('dose', text='剂量')
        self.drugs_tree.heading('unit', text='单位')
        self.drugs_tree.heading('route', text='途径')
        self.drugs_tree.heading('notes', text='备注')
        
        self.drugs_tree.column('time', width=120)
        self.drugs_tree.column('drug_name', width=150)
        self.drugs_tree.column('dose', width=80)
        self.drugs_tree.column('unit', width=60)
        self.drugs_tree.column('route', width=80)
        self.drugs_tree.column('notes', width=200)
        
        scrollbar = ttk.Scrollbar(parent, orient=tk.VERTICAL, command=self.drugs_tree.yview)
        self.drugs_tree.configure(yscrollcommand=scrollbar.set)
        
        self.drugs_tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
    
    def _create_notes_panel(self, parent):
        toolbar = ttk.Frame(parent)
        toolbar.pack(fill=tk.X, padx=5, pady=5)
        
        ttk.Button(toolbar, text="保存备注", command=self._save_post_op_notes).pack(side=tk.LEFT, padx=2)
        
        self.notes_text = scrolledtext.ScrolledText(parent, wrap=tk.WORD, font=('Arial', 11))
        self.notes_text.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)
    
    def _load_drug_rules(self):
        sample_rules_path = Path(__file__).parent.parent / "samples" / "drug_rules.yaml"
        if sample_rules_path.exists():
            try:
                self.drug_rules = YAMLParser.parse_drug_rules(str(sample_rules_path))
            except Exception:
                self.drug_rules = []
    
    def _refresh_case_list(self):
        for item in self.case_tree.get_children():
            self.case_tree.delete(item)
        
        cases = self.storage.list_cases()
        
        for case in cases:
            species_name = "犬" if case['species'] == 'dog' else "猫"
            start_time = case['start_time']
            if start_time:
                try:
                    dt = datetime.fromisoformat(start_time)
                    start_time = dt.strftime('%Y-%m-%d %H:%M')
                except Exception:
                    pass
            
            self.case_tree.insert('', tk.END, values=(
                case['case_id'],
                case['patient_name'],
                species_name,
                case['surgery_type'] or '-',
                start_time or '-'
            ), iid=case['case_id'])
    
    def _on_case_select(self, event):
        selection = self.case_tree.selection()
        if not selection:
            return
        
        case_id = selection[0]
        self._load_case(case_id)
    
    def _load_case(self, case_id: str):
        self.current_case_data = self.storage.load_case(case_id)
        
        if self.current_case_data:
            self._update_info_panel()
            self._update_timeline_view()
            self._refresh_risks_view()
            self._update_vitals_view()
            self._update_drugs_view()
            self._update_notes_view()
    
    def _update_info_panel(self):
        if not self.current_case_data:
            return
        
        case = self.current_case_data.case
        
        self.info_labels['case_id'].config(text=case.case_id)
        self.info_labels['patient_name'].config(text=case.patient_name)
        species_name = "犬" if case.species.value == 'dog' else "猫"
        self.info_labels['species'].config(text=species_name)
        weight_str = f"{case.weight} {case.weight_unit.value} ({case.weight_kg:.2f} kg)"
        self.info_labels['weight'].config(text=weight_str)
        self.info_labels['surgery_type'].config(text=case.surgery_type or '-')
        self.info_labels['anesthesiologist'].config(text=case.anesthesiologist or '-')
        self.info_labels['start_time'].config(text=case.start_time.strftime('%Y-%m-%d %H:%M:%S'))
        self.info_labels['end_time'].config(text=case.end_time.strftime('%Y-%m-%d %H:%M:%S') if case.end_time else '-')
        self.info_labels['notes'].config(text=case.notes or '-')
        
        risks = self.current_case_data.risks
        high_risks = [r for r in risks if r.severity == RiskSeverity.HIGH]
        medium_risks = [r for r in risks if r.severity == RiskSeverity.MEDIUM]
        low_risks = [r for r in risks if r.severity == RiskSeverity.LOW]
        confirmed = [r for r in risks if r.confirmed]
        
        self.stats_labels['vitals_count'].config(text=str(len(self.current_case_data.vital_signs)))
        self.stats_labels['drugs_count'].config(text=str(len(self.current_case_data.drug_administrations)))
        self.stats_labels['risks_total'].config(text=str(len(risks)))
        self.stats_labels['risks_high'].config(text=str(len(high_risks)))
        self.stats_labels['risks_medium'].config(text=str(len(medium_risks)))
        self.stats_labels['risks_low'].config(text=str(len(low_risks)))
        self.stats_labels['risks_confirmed'].config(text=str(len(confirmed)))
    
    def _update_timeline_view(self):
        if not self.current_case_data:
            return
        
        for item in self.timeline_tree.get_children():
            self.timeline_tree.delete(item)
        
        for event in self.current_case_data.timeline:
            time_str = event.timestamp.strftime('%H:%M:%S')
            
            type_display = {
                'surgery_start': '手术开始',
                'surgery_end': '手术结束',
                'vitals': '生命体征',
                'drug': '给药',
                'risk': '风险'
            }.get(event.event_type, event.event_type)
            
            details_str = ', '.join([f"{k}: {v}" for k, v in event.details.items()]) if event.details else '-'
            
            self.timeline_tree.insert('', tk.END, values=(
                time_str,
                type_display,
                event.description,
                details_str
            ), tags=(event.event_type,))
    
    def _refresh_risks_view(self, filter_unconfirmed: bool = False):
        if not self.current_case_data:
            return
        
        for item in self.risks_tree.get_children():
            self.risks_tree.delete(item)
        
        risks = self.current_case_data.risks
        if filter_unconfirmed:
            risks = [r for r in risks if not r.confirmed]
        
        for risk in risks:
            type_display = {
                RiskType.HYPOTENSION: '低血压',
                RiskType.HYPOTHERMIA: '低体温',
                RiskType.DOSAGE_VIOLATION: '剂量越界',
                RiskType.MONITORING_GAP: '监护断采',
                RiskType.OTHER: '其他'
            }.get(risk.risk_type, risk.risk_type.value)
            
            severity_display = {
                RiskSeverity.HIGH: '高危',
                RiskSeverity.MEDIUM: '中危',
                RiskSeverity.LOW: '低危'
            }.get(risk.severity, risk.severity.value)
            
            start_str = risk.start_time.strftime('%Y-%m-%d %H:%M')
            end_str = risk.end_time.strftime('%Y-%m-%d %H:%M') if risk.end_time else '-'
            
            status = '已确认' if risk.confirmed else '待确认'
            
            tags = []
            if risk.severity == RiskSeverity.HIGH:
                tags.append('high')
            elif risk.severity == RiskSeverity.MEDIUM:
                tags.append('medium')
            else:
                tags.append('low')
            
            if risk.confirmed:
                tags.append('confirmed')
            
            self.risks_tree.insert('', tk.END, values=(
                risk.risk_id[:8],
                type_display,
                severity_display,
                start_str,
                end_str,
                risk.description,
                status
            ), iid=risk.risk_id, tags=tuple(tags))
    
    def _filter_unconfirmed_risks(self):
        self._refresh_risks_view(filter_unconfirmed=True)
    
    def _update_vitals_view(self):
        if not self.current_case_data:
            return
        
        for item in self.vitals_tree.get_children():
            self.vitals_tree.delete(item)
        
        thresholds = self._get_thresholds_for_case()
        
        for vital in self.current_case_data.vital_signs:
            time_str = vital.timestamp.strftime('%H:%M:%S')
            
            is_abnormal = False
            if vital.systolic_bp and vital.systolic_bp < thresholds['sbp_low']:
                is_abnormal = True
            if vital.mean_bp and vital.mean_bp < thresholds['map_low']:
                is_abnormal = True
            if vital.temperature and vital.temperature < thresholds['temp_low']:
                is_abnormal = True
            if vital.spo2 and vital.spo2 < thresholds['spo2_low']:
                is_abnormal = True
            
            tags = ('abnormal',) if is_abnormal else ()
            
            self.vitals_tree.insert('', tk.END, values=(
                time_str,
                vital.heart_rate or '-',
                vital.respiratory_rate or '-',
                vital.systolic_bp or '-',
                vital.diastolic_bp or '-',
                vital.mean_bp or '-',
                vital.temperature or '-',
                vital.spo2 or '-',
                vital.etco2 or '-'
            ), tags=tags)
    
    def _get_thresholds_for_case(self) -> Dict:
        if not self.current_case_data:
            return {}
        
        species = self.current_case_data.case.species
        
        if species == Species.DOG:
            return {
                'sbp_low': 60,
                'map_low': 40,
                'temp_low': 35.0,
                'spo2_low': 95,
                'hr_low': 60,
                'hr_high': 180
            }
        else:
            return {
                'sbp_low': 60,
                'map_low': 40,
                'temp_low': 35.0,
                'spo2_low': 95,
                'hr_low': 100,
                'hr_high': 240
            }
    
    def _update_drugs_view(self):
        if not self.current_case_data:
            return
        
        for item in self.drugs_tree.get_children():
            self.drugs_tree.delete(item)
        
        for drug in self.current_case_data.drug_administrations:
            time_str = drug.timestamp.strftime('%H:%M:%S')
            
            self.drugs_tree.insert('', tk.END, values=(
                time_str,
                drug.drug_name,
                drug.dose,
                drug.dose_unit,
                drug.route or '-',
                drug.notes or '-'
            ))
    
    def _update_notes_view(self):
        if not self.current_case_data:
            return
        
        self.notes_text.delete('1.0', tk.END)
        if self.current_case_data.post_op_notes:
            self.notes_text.insert('1.0', self.current_case_data.post_op_notes)
    
    def _save_post_op_notes(self):
        if not self.current_case_data:
            messagebox.showwarning("警告", "请先选择一个病例")
            return
        
        notes = self.notes_text.get('1.0', tk.END).strip()
        self.current_case_data.post_op_notes = notes
        
        if self.storage.save_case(self.current_case_data):
            messagebox.showinfo("成功", "备注已保存")
        else:
            messagebox.showerror("错误", "保存失败")
    
    def _analyze_current_case(self):
        if not self.current_case_data:
            messagebox.showwarning("警告", "请先选择一个病例")
            return
        
        self.rules_engine.analyze_case(self.current_case_data, self.drug_rules)
        
        if self.storage.save_case(self.current_case_data):
            self._update_info_panel()
            self._update_timeline_view()
            self._refresh_risks_view()
            messagebox.showinfo("成功", f"分析完成，共发现 {len(self.current_case_data.risks)} 个风险事件")
        else:
            messagebox.showerror("错误", "保存分析结果失败")
    
    def _confirm_selected_risks(self):
        selection = self.risks_tree.selection()
        if not selection:
            messagebox.showwarning("警告", "请先选择要确认的风险")
            return
        
        confirmed_count = 0
        for risk_id in selection:
            if self.storage.confirm_risk(risk_id, "麻醉师"):
                if self.current_case_data:
                    for risk in self.current_case_data.risks:
                        if risk.risk_id == risk_id:
                            risk.confirmed = True
                            risk.confirmed_by = "麻醉师"
                            risk.confirmed_time = datetime.now()
                confirmed_count += 1
        
        self._update_info_panel()
        self._refresh_risks_view()
        messagebox.showinfo("成功", f"已确认 {confirmed_count} 个风险事件")
    
    def _delete_selected_case(self):
        selection = self.case_tree.selection()
        if not selection:
            messagebox.showwarning("警告", "请先选择要删除的病例")
            return
        
        if messagebox.askyesno("确认删除", "确定要删除选中的病例吗？此操作不可恢复。"):
            for case_id in selection:
                self.storage.delete_case(case_id)
            
            self.current_case_data = None
            self._refresh_case_list()
            self._clear_all_panels()
            messagebox.showinfo("成功", "病例已删除")
    
    def _clear_all_panels(self):
        for key in self.info_labels:
            self.info_labels[key].config(text='-')
        
        for key in self.stats_labels:
            self.stats_labels[key].config(text='0')
        
        for item in self.timeline_tree.get_children():
            self.timeline_tree.delete(item)
        
        for item in self.risks_tree.get_children():
            self.risks_tree.delete(item)
        
        for item in self.vitals_tree.get_children():
            self.vitals_tree.delete(item)
        
        for item in self.drugs_tree.get_children():
            self.drugs_tree.delete(item)
        
        self.notes_text.delete('1.0', tk.END)
    
    def _import_cases_csv(self):
        file_path = filedialog.askopenfilename(
            title="选择病例CSV文件",
            filetypes=[("CSV文件", "*.csv"), ("所有文件", "*.*")]
        )
        
        if not file_path:
            return
        
        try:
            cases = CSVParser.parse_cases(file_path)
            
            imported_count = 0
            for case in cases:
                case_data = CaseData(case=case)
                if self.storage.save_case(case_data):
                    self.storage.save_import_history(case.case_id, 'cases', file_path)
                    imported_count += 1
            
            self._refresh_case_list()
            messagebox.showinfo("成功", f"已导入 {imported_count} 个病例")
        except Exception as e:
            messagebox.showerror("错误", f"导入失败: {str(e)}")
    
    def _import_vitals_jsonl(self):
        if not self.current_case_data:
            messagebox.showwarning("警告", "请先选择一个病例")
            return
        
        file_path = filedialog.askopenfilename(
            title="选择生命体征JSONL文件",
            filetypes=[("JSONL文件", "*.jsonl"), ("所有文件", "*.*")]
        )
        
        if not file_path:
            return
        
        try:
            vitals = JSONLParser.parse_vitals(file_path, self.current_case_data.case.start_time)
            self.current_case_data.vital_signs.extend(vitals)
            self.current_case_data.sort_all()
            
            if self.storage.save_case(self.current_case_data):
                self.storage.save_import_history(
                    self.current_case_data.case.case_id, 
                    'vitals', 
                    file_path
                )
                self._update_timeline_view()
                self._update_vitals_view()
                self._update_info_panel()
                messagebox.showinfo("成功", f"已导入 {len(vitals)} 条生命体征记录")
            else:
                messagebox.showerror("错误", "保存失败")
        except Exception as e:
            messagebox.showerror("错误", f"导入失败: {str(e)}")
    
    def _import_drug_rules(self):
        file_path = filedialog.askopenfilename(
            title="选择药物规则YAML文件",
            filetypes=[("YAML文件", "*.yaml"), ("YAML文件", "*.yml"), ("所有文件", "*.*")]
        )
        
        if not file_path:
            return
        
        try:
            rules = YAMLParser.parse_drug_rules(file_path)
            self.drug_rules = rules
            messagebox.showinfo("成功", f"已加载 {len(rules)} 条药物规则")
        except Exception as e:
            messagebox.showerror("错误", f"加载失败: {str(e)}")
    
    def _export_issues_csv(self):
        if not self.current_case_data:
            messagebox.showwarning("警告", "请先选择一个病例")
            return
        
        file_path = filedialog.asksaveasfilename(
            title="保存问题CSV文件",
            defaultextension=".csv",
            initialfile=f"{self.current_case_data.case.case_id}_issues.csv",
            filetypes=[("CSV文件", "*.csv"), ("所有文件", "*.*")]
        )
        
        if not file_path:
            return
        
        if Exporter.export_issues_csv(self.current_case_data, file_path):
            messagebox.showinfo("成功", f"已导出到: {file_path}")
        else:
            messagebox.showerror("错误", "导出失败")
    
    def _export_report_md(self):
        if not self.current_case_data:
            messagebox.showwarning("警告", "请先选择一个病例")
            return
        
        file_path = filedialog.asksaveasfilename(
            title="保存麻醉报告MD文件",
            defaultextension=".md",
            initialfile=f"{self.current_case_data.case.case_id}_anesthesia_report.md",
            filetypes=[("Markdown文件", "*.md"), ("所有文件", "*.*")]
        )
        
        if not file_path:
            return
        
        if Exporter.export_anesthesia_report(self.current_case_data, file_path):
            messagebox.showinfo("成功", f"已导出到: {file_path}")
        else:
            messagebox.showerror("错误", "导出失败")
    
    def _load_sample_data(self):
        samples_dir = Path(__file__).parent.parent / "samples"
        
        if not samples_dir.exists():
            messagebox.showerror("错误", "示例数据目录不存在")
            return
        
        try:
            cases_file = samples_dir / "cases.csv"
            if cases_file.exists():
                cases = CSVParser.parse_cases(str(cases_file))
                for case in cases:
                    existing = self.storage.load_case(case.case_id)
                    if existing:
                        self.storage.delete_case(case.case_id)
                    
                    case_data = CaseData(case=case)
                    
                    vitals_file = samples_dir / f"{case.case_id}_vitals.jsonl"
                    if vitals_file.exists():
                        vitals = JSONLParser.parse_vitals(str(vitals_file), case.start_time)
                        case_data.vital_signs = vitals
                    
                    drugs_file = samples_dir / f"{case.case_id}_drugs.yaml"
                    if drugs_file.exists():
                        drugs = YAMLParser.parse_drug_administrations(str(drugs_file), case.start_time.date())
                        case_data.drug_administrations = drugs
                    
                    notes_file = samples_dir / f"{case.case_id}_notes.txt"
                    if notes_file.exists():
                        case_data.post_op_notes = notes_file.read_text(encoding='utf-8')
                    
                    self.rules_engine.analyze_case(case_data, self.drug_rules)
                    self.storage.save_case(case_data)
            
            self._refresh_case_list()
            messagebox.showinfo("成功", "示例数据已加载")
        except Exception as e:
            messagebox.showerror("错误", f"加载示例数据失败: {str(e)}")
    
    def _show_about(self):
        about_text = """
麻醉病例复盘工具 v1.0

功能：
- 导入病例CSV、监护仪生命体征JSONL
- 导入药物剂量规则YAML
- 自动检测低血压、低体温、剂量越界、监护断采等风险
- 按病例展示时间线
- 支持风险事件标记确认
- 导出问题CSV和麻醉报告MD

边界处理：
- 跨午夜手术时间自动调整
- 体重单位自动转换(kg/lb)
"""
        messagebox.showinfo("关于", about_text)


def run_app():
    root = tk.Tk()
    
    style = ttk.Style()
    try:
        style.theme_use('clam')
    except tk.TclError:
        pass
    
    app = AnesthesiaReviewApp(root)
    root.mainloop()


if __name__ == "__main__":
    run_app()
