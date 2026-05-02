import tkinter as tk
from tkinter import ttk, messagebox, filedialog
from datetime import datetime
from typing import List, Optional
import os

from database import Database
from importer import DataImporter
from state_machine import SlideStateMachine, RuleEngine
from reporter import ReportGenerator
from models import Slide, BorrowRecord, SlideStatus


class PathologySlideGUI:
    def __init__(self, root):
        self.root = root
        self.root.title("病理科切片管理系统")
        self.root.geometry("1200x800")

        self.db = Database("pathology_slides.db")
        self.importer = DataImporter(self.db)
        self.state_machine = SlideStateMachine(self.db)
        self.rule_engine = RuleEngine(self.db)
        self.reporter = ReportGenerator(self.db)

        self.current_slides = []
        self.current_records = []
        self.selected_records = []

        self._setup_styles()
        self._create_menu_bar()
        self._create_main_layout()
        self._create_status_bar()
        self._bind_shortcuts()

    def _setup_styles(self):
        style = ttk.Style()
        style.theme_use('clam')
        style.configure("Treeview", rowheight=28, font=('Arial', 10))
        style.configure("Treeview.Heading", font=('Arial', 10, 'bold'))
        style.configure("TButton", padding=6)
        style.configure("TLabel", font=('Arial', 10))

    def _create_menu_bar(self):
        menubar = tk.Menu(self.root)
        self.root.config(menu=menubar)

        file_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="文件", menu=file_menu)
        file_menu.add_command(label="导入切片台账 CSV", command=self._import_slides)
        file_menu.add_command(label="导入借阅申请 JSON", command=self._import_borrows)
        file_menu.add_command(label="导入科室规则 JSON", command=self._import_rules)
        file_menu.add_separator()
        file_menu.add_command(label="导出交接报告 (Markdown)", command=lambda: self._export_report("md"))
        file_menu.add_command(label="导出交接报告 (CSV)", command=lambda: self._export_report("csv"))
        file_menu.add_separator()
        file_menu.add_command(label="退出", command=self.root.quit)

        data_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="数据", menu=data_menu)
        data_menu.add_command(label="刷新数据", command=self._refresh_data)
        data_menu.add_command(label="清除所有数据", command=self._clear_data)
        data_menu.add_command(label="逾期检查", command=self._check_overdue)

        report_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="报告", menu=report_menu)
        report_menu.add_command(label="生成库存报告", command=self._generate_inventory_report)
        report_menu.add_command(label="生成逾期报告", command=self._generate_overdue_report)

        help_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="帮助", menu=help_menu)
        help_menu.add_command(label="使用说明", command=self._show_help)

    def _create_main_layout(self):
        top_frame = ttk.Frame(self.root, padding="10")
        top_frame.pack(side=tk.TOP, fill=tk.X)

        left_panel = ttk.Frame(top_frame)
        left_panel.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)

        self._create_import_frame(left_panel)
        self._create_search_frame(left_panel)
        self._create_slides_table(left_panel)

        right_panel = ttk.Frame(top_frame)
        right_panel.pack(side=tk.RIGHT, fill=tk.BOTH, expand=True, padx=(10, 0))

        self._create_borrow_frame(right_panel)
        self._create_records_table(right_panel)

        bottom_frame = ttk.Frame(self.root, padding="5")
        bottom_frame.pack(side=tk.BOTTOM, fill=tk.X)

        self._create_action_buttons(bottom_frame)

    def _create_import_frame(self, parent):
        import_frame = ttk.LabelFrame(parent, text="数据导入", padding="10")
        import_frame.pack(side=tk.TOP, fill=tk.X, pady=(0, 10))

        btn_import_slides = ttk.Button(import_frame, text="导入切片台账 CSV",
                                      command=self._import_slides)
        btn_import_slides.pack(side=tk.LEFT, padx=5)

        btn_import_borrows = ttk.Button(import_frame, text="导入借阅申请 JSON",
                                       command=self._import_borrows)
        btn_import_borrows.pack(side=tk.LEFT, padx=5)

        btn_import_rules = ttk.Button(import_frame, text="导入科室规则 JSON",
                                     command=self._import_rules)
        btn_import_rules.pack(side=tk.LEFT, padx=5)

    def _create_search_frame(self, parent):
        search_frame = ttk.LabelFrame(parent, text="查询筛选", padding="10")
        search_frame.pack(side=tk.TOP, fill=tk.X, pady=(0, 10))

        ttk.Label(search_frame, text="关键词:").pack(side=tk.LEFT)
        self.search_entry = ttk.Entry(search_frame, width=15)
        self.search_entry.pack(side=tk.LEFT, padx=5)
        self.search_entry.bind('<Return>', lambda e: self._search_slides())

        ttk.Label(search_frame, text="状态:").pack(side=tk.LEFT, padx=(10, 0))
        self.status_combo = ttk.Combobox(search_frame, width=10,
                                        values=["全部", "在库", "已借出", "已归还", "逾期"])
        self.status_combo.current(0)
        self.status_combo.pack(side=tk.LEFT, padx=5)
        self.status_combo.bind('<<ComboboxSelected>>', lambda e: self._search_slides())

        ttk.Button(search_frame, text="查询", command=self._search_slides).pack(side=tk.LEFT, padx=5)
        ttk.Button(search_frame, text="重置", command=self._refresh_data).pack(side=tk.LEFT)

        self.stats_label = ttk.Label(search_frame, text="", foreground="blue")
        self.stats_label.pack(side=tk.RIGHT)

    def _create_slides_table(self, parent):
        table_frame = ttk.LabelFrame(parent, text="切片列表", padding="5")
        table_frame.pack(side=tk.TOP, fill=tk.BOTH, expand=True)

        columns = ("slide_id", "patient_id", "specimen_type", "department",
                  "storage_location", "status", "notes")
        self.slides_tree = ttk.Treeview(table_frame, columns=columns, show='headings', selectmode='extended')

        self.slides_tree.heading("slide_id", text="切片ID")
        self.slides_tree.heading("patient_id", text="患者ID")
        self.slides_tree.heading("specimen_type", text="标本类型")
        self.slides_tree.heading("department", text="科室")
        self.slides_tree.heading("storage_location", text="存放位置")
        self.slides_tree.heading("status", text="状态")
        self.slides_tree.heading("notes", text="备注")

        self.slides_tree.column("slide_id", width=100)
        self.slides_tree.column("patient_id", width=100)
        self.slides_tree.column("specimen_type", width=80)
        self.slides_tree.column("department", width=80)
        self.slides_tree.column("storage_location", width=100)
        self.slides_tree.column("status", width=70)
        self.slides_tree.column("notes", width=150)

        scrollbar = ttk.Scrollbar(table_frame, orient=tk.VERTICAL, command=self.slides_tree.yview)
        self.slides_tree.configure(yscrollcommand=scrollbar.set)

        self.slides_tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)

        self.slides_tree.bind('<<TreeviewSelect>>', self._on_slide_select)

    def _create_borrow_frame(self, parent):
        borrow_frame = ttk.LabelFrame(parent, text="借阅操作", padding="10")
        borrow_frame.pack(side=tk.TOP, fill=tk.X, pady=(0, 10))

        row1 = ttk.Frame(borrow_frame)
        row1.pack(fill=tk.X, pady=2)
        ttk.Label(row1, text="切片ID:").pack(side=tk.LEFT)
        self.borrow_slide_id = ttk.Entry(row1, width=15)
        self.borrow_slide_id.pack(side=tk.LEFT, padx=5)

        ttk.Label(row1, text="借阅人:").pack(side=tk.LEFT, padx=(10, 0))
        self.borrow_name = ttk.Entry(row1, width=10)
        self.borrow_name.pack(side=tk.LEFT, padx=5)

        ttk.Label(row1, text="部门:").pack(side=tk.LEFT, padx=(10, 0))
        self.borrow_dept = ttk.Combobox(row1, width=10,
                                       values=["病理科", "肿瘤科", "外科", "研究所", "其他"])
        self.borrow_dept.current(0)
        self.borrow_dept.pack(side=tk.LEFT, padx=5)

        row2 = ttk.Frame(borrow_frame)
        row2.pack(fill=tk.X, pady=2)
        ttk.Label(row2, text="借阅日期:").pack(side=tk.LEFT)
        self.borrow_date = ttk.Entry(row2, width=12)
        self.borrow_date.insert(0, datetime.now().strftime("%Y-%m-%d"))
        self.borrow_date.pack(side=tk.LEFT, padx=5)

        ttk.Label(row2, text="预计归还:").pack(side=tk.LEFT, padx=(10, 0))
        self.expected_return = ttk.Entry(row2, width=12)
        self.expected_return.pack(side=tk.LEFT, padx=5)

        ttk.Label(row2, text="备注:").pack(side=tk.LEFT, padx=(10, 0))
        self.borrow_notes = ttk.Entry(row2, width=15)
        self.borrow_notes.pack(side=tk.LEFT, padx=5)

        row3 = ttk.Frame(borrow_frame)
        row3.pack(fill=tk.X, pady=5)
        ttk.Button(row3, text="借阅", command=self._execute_borrow).pack(side=tk.LEFT, padx=5)
        ttk.Button(row3, text="归还", command=self._execute_return).pack(side=tk.LEFT, padx=5)
        ttk.Button(row3, text="批量归还", command=self._batch_return).pack(side=tk.LEFT, padx=5)

    def _create_records_table(self, parent):
        table_frame = ttk.LabelFrame(parent, text="借阅记录", padding="5")
        table_frame.pack(side=tk.TOP, fill=tk.BOTH, expand=True)

        columns = ("record_id", "slide_id", "borrower_name", "borrower_dept",
                  "borrow_date", "expected_return", "actual_return", "status")
        self.records_tree = ttk.Treeview(table_frame, columns=columns, show='headings', selectmode='extended')

        self.records_tree.heading("record_id", text="记录ID")
        self.records_tree.heading("slide_id", text="切片ID")
        self.records_tree.heading("borrower_name", text="借阅人")
        self.records_tree.heading("borrower_dept", text="部门")
        self.records_tree.heading("borrow_date", text="借阅日期")
        self.records_tree.heading("expected_return", text="应还日期")
        self.records_tree.heading("actual_return", text="实还日期")
        self.records_tree.heading("status", text="状态")

        self.records_tree.column("record_id", width=120)
        self.records_tree.column("slide_id", width=100)
        self.records_tree.column("borrower_name", width=80)
        self.records_tree.column("borrower_dept", width=70)
        self.records_tree.column("borrow_date", width=95)
        self.records_tree.column("expected_return", width=95)
        self.records_tree.column("actual_return", width=95)
        self.records_tree.column("status", width=70)

        scrollbar = ttk.Scrollbar(table_frame, orient=tk.VERTICAL, command=self.records_tree.yview)
        self.records_tree.configure(yscrollcommand=scrollbar.set)

        self.records_tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)

        self.records_tree.bind('<Double-1>', self._on_record_double_click)

    def _create_action_buttons(self, parent):
        ttk.Button(parent, text="刷新", command=self._refresh_data).pack(side=tk.LEFT, padx=5)
        ttk.Button(parent, text="查看历史", command=self._show_history).pack(side=tk.LEFT, padx=5)
        ttk.Button(parent, text="添加备注", command=self._add_note).pack(side=tk.LEFT, padx=5)
        ttk.Button(parent, text="导出报告", command=lambda: self._export_report("md")).pack(side=tk.LEFT, padx=5)

    def _create_status_bar(self):
        self.status_bar = ttk.Label(self.root, text="就绪", relief=tk.SUNKEN, anchor=tk.W)
        self.status_bar.pack(side=tk.BOTTOM, fill=tk.X)

    def _bind_shortcuts(self):
        self.root.bind('<F5>', lambda e: self._refresh_data())
        self.root.bind('<Control-f>', lambda e: self.search_entry.focus())

    def _import_slides(self):
        file_path = filedialog.askopenfilename(
            title="选择切片台账 CSV 文件",
            filetypes=[("CSV 文件", "*.csv"), ("所有文件", "*.*")]
        )
        if not file_path:
            return

        result = self.importer.validate_slide_csv(file_path)
        if result.errors:
            error_msg = "\n".join([str(e) for e in result.errors])
            messagebox.showwarning("验证警告", f"发现错误:\n{error_msg}\n\n是否继续导入?",
                                 type=messagebox.OKCANCEL)
            if messagebox.askyesno("确认", "忽略错误并继续导入?"):
                slides, _ = self.importer.import_slide_csv(file_path)
            else:
                return
        else:
            slides, result = self.importer.import_slide_csv(file_path)

        slides, result = self.importer.import_slide_csv(file_path)
        if result.is_valid or not result.errors:
            inserted, updated = self.db.insert_slides(slides)
            msg = f"成功导入: 新增 {inserted} 条, 更新 {updated} 条"
            if result.warnings:
                msg += f"\n警告: {', '.join(result.warnings[:3])}"
            messagebox.showinfo("导入成功", msg)
            self._refresh_data()
            self._update_status(msg)
        else:
            error_msg = "\n".join([str(e) for e in result.errors])
            messagebox.showerror("导入失败", f"验证失败:\n{error_msg}")

    def _import_borrows(self):
        file_path = filedialog.askopenfilename(
            title="选择借阅申请 JSON 文件",
            filetypes=[("JSON 文件", "*.json"), ("所有文件", "*.*")]
        )
        if not file_path:
            return

        records, result = self.importer.import_borrow_json(file_path)
        if result.is_valid or not result.errors:
            success = 0
            failed = 0
            for record in records:
                ok, msg = self.state_machine.execute_borrow(
                    slide_id=record.slide_id,
                    borrower_name=record.borrower_name,
                    borrower_dept=record.borrower_dept,
                    borrow_date=record.borrow_date,
                    expected_return_date=record.expected_return_date,
                    notes=record.notes,
                    record_id=record.record_id
                )
                if ok:
                    success += 1
                else:
                    failed += 1

            msg = f"借阅申请处理完成: 成功 {success} 条, 失败 {failed} 条"
            if result.warnings:
                msg += f"\n警告: {', '.join(result.warnings[:3])}"
            messagebox.showinfo("导入完成", msg)
            self._refresh_data()
            self._update_status(msg)
        else:
            error_msg = "\n".join([str(e) for e in result.errors])
            messagebox.showwarning("验证警告", f"发现错误:\n{error_msg}")

    def _import_rules(self):
        file_path = filedialog.askopenfilename(
            title="选择科室规则 JSON 文件",
            filetypes=[("JSON 文件", "*.json"), ("所有文件", "*.*")]
        )
        if not file_path:
            return

        rules, result = self.importer.import_rules_json(file_path)
        if result.is_valid or not result.errors:
            inserted, updated = self.db.insert_department_rules(rules)
            msg = f"规则导入成功: 新增 {inserted} 条, 更新 {updated} 条"
            messagebox.showinfo("导入成功", msg)
            self._update_status(msg)
        else:
            error_msg = "\n".join([str(e) for e in result.errors])
            messagebox.showerror("导入失败", f"验证失败:\n{error_msg}")

    def _search_slides(self):
        keyword = self.search_entry.get().strip()
        status_text = self.status_combo.get()

        status_map = {
            "在库": SlideStatus.AVAILABLE,
            "已借出": SlideStatus.BORROWED,
            "已归还": SlideStatus.RETURNED,
            "逾期": SlideStatus.OVERDUE
        }
        status = status_map.get(status_text)

        self.current_slides = self.db.search_slides(keyword=keyword, status=status)
        self._update_slides_tree()

        total = len(self.db.get_all_slides())
        shown = len(self.current_slides)
        self.stats_label.config(text=f"显示: {shown}/{total}")

    def _refresh_data(self):
        self.current_slides = self.db.get_all_slides()
        self._update_slides_tree()

        all_records = self.db.get_borrow_records()
        all_records.extend(self.db.get_overdue_records())
        self.current_records = all_records
        self._update_records_tree()

        stats = self.db.get_statistics()
        self.stats_label.config(
            text=f"总数: {stats['total_slides']} | 在库: {stats['available']} | "
                 f"借出: {stats['borrowed']} | 逾期: {stats['overdue_count']}"
        )
        self._update_status("数据已刷新")

    def _update_slides_tree(self):
        for item in self.slides_tree.get_children():
            self.slides_tree.delete(item)

        for slide in self.current_slides:
            status_color = ""
            if slide.status == SlideStatus.AVAILABLE:
                status_color = "green"
            elif slide.status == SlideStatus.BORROWED:
                status_color = "orange"
            elif slide.status == SlideStatus.OVERDUE:
                status_color = "red"

            values = (slide.slide_id, slide.patient_id, slide.specimen_type,
                     slide.department, slide.storage_location, slide.status.value, slide.notes)

            item = self.slides_tree.insert("", tk.END, values=values)
            if status_color:
                self.slides_tree.item(item, tags=(status_color,))

        self.slides_tree.tag_configure("green", foreground="green")
        self.slides_tree.tag_configure("orange", foreground="orange")
        self.slides_tree.tag_configure("red", foreground="red")

    def _update_records_tree(self):
        for item in self.records_tree.get_children():
            self.records_tree.delete(item)

        for record in self.current_records:
            values = (record.record_id, record.slide_id, record.borrower_name,
                     record.borrower_dept, record.borrow_date, record.expected_return_date,
                     record.actual_return_date or "-", record.status.value)

            item = self.records_tree.insert("", tk.END, values=values)
            if record.status == SlideStatus.OVERDUE:
                self.records_tree.item(item, tags=("overdue",))
            elif record.status == SlideStatus.BORROWED:
                self.records_tree.item(item, tags=("borrowed",))

        self.records_tree.tag_configure("overdue", foreground="red")
        self.records_tree.tag_configure("borrowed", foreground="orange")

    def _on_slide_select(self, event):
        selected = self.slides_tree.selection()
        if selected:
            item = self.slides_tree.item(selected[0])
            values = item['values']
            if values:
                self.borrow_slide_id.delete(0, tk.END)
                self.borrow_slide_id.insert(0, values[0])

    def _on_record_double_click(self, event):
        selected = self.records_tree.selection()
        if selected:
            item = self.records_tree.item(selected[0])
            values = item['values']
            if values:
                record_id = values[0]
                self._show_record_detail(record_id)

    def _execute_borrow(self):
        slide_id = self.borrow_slide_id.get().strip()
        borrower_name = self.borrow_name.get().strip()
        borrower_dept = self.borrow_dept.get().strip()
        borrow_date = self.borrow_date.get().strip()
        expected_return = self.expected_return.get().strip()
        notes = self.borrow_notes.get().strip()

        if not slide_id:
            messagebox.showerror("错误", "请输入切片ID")
            return
        if not borrower_name:
            messagebox.showerror("错误", "请输入借阅人姓名")
            return

        ok, msg, record = self.state_machine.execute_borrow(
            slide_id=slide_id,
            borrower_name=borrower_name,
            borrower_dept=borrower_dept,
            borrow_date=borrow_date if borrow_date else None,
            expected_return_date=expected_return if expected_return else None,
            notes=notes
        )

        if ok:
            messagebox.showinfo("成功", msg)
            self._clear_borrow_form()
            self._refresh_data()
        else:
            messagebox.showerror("借阅失败", msg)

    def _execute_return(self):
        selected = self.records_tree.selection()
        if not selected:
            messagebox.showwarning("提示", "请选择要归还的记录")
            return

        confirmed_by = "系统操作员"
        success, failed, errors = self.state_machine.batch_return(
            record_ids=[self.records_tree.item(s)['values'][0] for s in selected],
            actual_return_date=datetime.now().strftime("%Y-%m-%d"),
            confirmed_by=confirmed_by
        )

        msg = f"批量归还完成: 成功 {success} 条"
        if failed > 0:
            msg += f", 失败 {failed} 条\n{chr(10).join(errors[:5])}"
        messagebox.showinfo("归还结果", msg)
        self._refresh_data()

    def _batch_return(self):
        selected = self.records_tree.selection()
        if not selected:
            messagebox.showwarning("提示", "请选择要归还的记录")
            return

        count = len(selected)
        if not messagebox.askyesno("确认", f"确认归还 {count} 条借阅记录?"):
            return

        self._execute_return()

    def _add_note(self):
        selected = self.records_tree.selection()
        if not selected:
            messagebox.showwarning("提示", "请选择借阅记录")
            return

        dialog = tk.Toplevel(self.root)
        dialog.title("添加备注")
        dialog.geometry("400x150")
        dialog.transient(self.root)

        ttk.Label(dialog, text="记录ID:").pack(pady=5)
        record_id = self.records_tree.item(selected[0])['values'][0]
        ttk.Label(dialog, text=record_id, font=('Arial', 10, 'bold')).pack()

        ttk.Label(dialog, text="备注内容:").pack(pady=5)
        note_entry = ttk.Entry(dialog, width=40)
        note_entry.pack(pady=5)

        def save_note():
            note = note_entry.get().strip()
            if note:
                self.db.update_borrow_record(record_id, notes=note)
                self._refresh_data()
                dialog.destroy()

        ttk.Button(dialog, text="保存", command=save_note).pack(pady=10)

    def _show_history(self):
        selected = self.slides_tree.selection()
        if not selected:
            messagebox.showinfo("提示", "请选择切片")
            return

        slide_id = self.slides_tree.item(selected[0])['values'][0]
        content = self.reporter.generate_borrow_history_markdown(slide_id=slide_id)

        dialog = tk.Toplevel(self.root)
        dialog.title(f"切片 {slide_id} 借阅历史")
        dialog.geometry("800x500")

        text = tk.Text(dialog, wrap=tk.WORD)
        text.pack(fill=tk.BOTH, expand=True, pady=10, padx=10)
        text.insert("1.0", content)

        ttk.Button(dialog, text="关闭", command=dialog.destroy).pack(pady=10)

    def _show_record_detail(self, record_id: str):
        records = self.db.get_borrow_records()
        record = None
        for r in records:
            if r.record_id == record_id:
                record = r
                break

        if not record:
            messagebox.showinfo("提示", f"未找到记录: {record_id}")
            return

        slide = self.db.get_slide(record.slide_id)

        dialog = tk.Toplevel(self.root)
        dialog.title(f"记录详情 - {record_id}")
        dialog.geometry("500x400")

        info = f"""
记录ID: {record.record_id}
切片ID: {record.slide_id}
患者ID: {slide.patient_id if slide else '未知'}
借阅人: {record.borrower_name}
部门: {record.borrower_dept}
借阅日期: {record.borrow_date}
应还日期: {record.expected_return_date}
实还日期: {record.actual_return_date or '未归还'}
状态: {record.status.value}
确认人: {record.confirmed_by or '-'}
确认时间: {record.confirmed_at or '-'}
备注: {record.notes or '-'}
"""
        text = tk.Text(dialog, wrap=tk.WORD)
        text.pack(fill=tk.BOTH, expand=True, pady=10, padx=10)
        text.insert("1.0", info)
        text.config(state="disabled")

        ttk.Button(dialog, text="关闭", command=dialog.destroy).pack(pady=10)

    def _export_report(self, format_type: str):
        records = self.db.get_borrow_records(status=SlideStatus.RETURNED)
        if not records:
            messagebox.showwarning("提示", "没有已归还的记录可导出")
            return

        file_path = filedialog.asksaveasfilename(
            title="导出报告",
            defaultextension=f".{format_type}",
            filetypes=[(f"{format_type.upper()} 文件", f"*.{format_type}"),
                      ("所有文件", "*.*")]
        )
        if not file_path:
            return

        if format_type == "md":
            self.reporter.generate_handover_markdown(records, output_path=file_path)
        else:
            self.reporter.generate_handover_csv(records, output_path=file_path)

        messagebox.showinfo("导出成功", f"报告已保存到:\n{file_path}")
        self._update_status(f"报告已导出: {file_path}")

    def _generate_inventory_report(self):
        file_path = filedialog.asksaveasfilename(
            title="导出库存报告",
            defaultextension=".md",
            filetypes=[("Markdown 文件", "*.md"), ("所有文件", "*.*")]
        )
        if file_path:
            self.reporter.generate_inventory_report_markdown(output_path=file_path)
            messagebox.showinfo("导出成功", f"库存报告已保存到:\n{file_path}")

    def _generate_overdue_report(self):
        file_path = filedialog.asksaveasfilename(
            title="导出逾期报告",
            defaultextension=".md",
            filetypes=[("Markdown 文件", "*.md"), ("所有文件", "*.*")]
        )
        if file_path:
            self.reporter.generate_overdue_report_markdown(output_path=file_path)
            messagebox.showinfo("导出成功", f"逾期报告已保存到:\n{file_path}")

    def _check_overdue(self):
        updated = self.rule_engine.update_overdue_status()
        if updated > 0:
            messagebox.showinfo("逾期检查", f"发现 {updated} 条记录状态已更新为逾期")
            self._refresh_data()
        else:
            messagebox.showinfo("逾期检查", "没有发现新的逾期记录")

    def _clear_data(self):
        if messagebox.askyesno("确认", "确定要清除所有数据吗? 此操作不可恢复!"):
            self.db.delete_all_data()
            self._refresh_data()
            messagebox.showinfo("完成", "所有数据已清除")

    def _clear_borrow_form(self):
        self.borrow_slide_id.delete(0, tk.END)
        self.borrow_name.delete(0, tk.END)
        self.borrow_dept.current(0)
        self.borrow_date.delete(0, tk.END)
        self.borrow_date.insert(0, datetime.now().strftime("%Y-%m-%d"))
        self.expected_return.delete(0, tk.END)
        self.borrow_notes.delete(0, tk.END)

    def _update_status(self, message: str):
        self.status_bar.config(text=f" {message} - {datetime.now().strftime('%H:%M:%S')}")

    def _show_help(self):
        help_text = """
病理科切片管理系统使用说明

【数据导入】
1. 导入切片台账 CSV - 包含切片基本信息
2. 导入借阅申请 JSON - 包含借阅记录
3. 导入科室规则 JSON - 不同科室的借阅规则

【主要功能】
- 借阅: 选择切片，填写借阅人信息
- 归还: 选择记录，点击归还或批量归还
- 查询: 支持关键词搜索和状态筛选
- 导出: 生成 Markdown 或 CSV 格式报告

【快捷键】
F5 - 刷新数据
Ctrl+F - 聚焦搜索框
        """
        messagebox.showinfo("使用说明", help_text)

    def run(self):
        self._refresh_data()
        self.root.mainloop()


def main():
    root = tk.Tk()
    app = PathologySlideGUI(root)
    app.run()


if __name__ == "__main__":
    main()
