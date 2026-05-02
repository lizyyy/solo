import tkinter as tk
from tkinter import ttk, filedialog
from datetime import datetime
from pathlib import Path
from typing import Optional, Callable, Dict, Any, List

import customtkinter as ctk

try:
    import matplotlib.pyplot as plt
    from matplotlib.backends.backend_tkagg import FigureCanvasTkAgg
    from matplotlib.figure import Figure
    MATPLOTLIB_AVAILABLE = True
except ImportError:
    MATPLOTLIB_AVAILABLE = False

from config import CONFIG, TaskStatus
from database import (
    DatabaseManager, DeliveryTask, CoolerBox, DeliveryPoint, PackingItem,
    TemperatureReading, Attachment, AuditLog, ExceptionRecord, AuditPackage,
    DrugBatch, AttachmentType, ExceptionType
)
from core import StateMachine, StateTransitionError, can_transition, get_valid_transitions
from utils import AttachmentManager, ImportExportManager, ReportGenerator
from .dialogs import MessageDialog, ImportDialog


class RightPanel(ctk.CTkFrame):
    def __init__(
        self,
        parent,
        db: DatabaseManager,
        on_data_changed: Optional[Callable] = None,
        **kwargs
    ):
        super().__init__(parent, **kwargs)
        self.db = db
        self.on_data_changed = on_data_changed
        self.current_task_id: Optional[int] = None
        self.current_task: Optional[DeliveryTask] = None
        
        self.state_machine = StateMachine(db)
        self.attachment_manager = AttachmentManager(db)
        self.import_export = ImportExportManager(db)
        self.report_generator = ReportGenerator(db)
        
        self._create_widgets()
    
    def _create_widgets(self):
        header_frame = ctk.CTkFrame(self, fg_color="transparent")
        header_frame.pack(fill=tk.X, padx=5, pady=5)
        
        self.task_info_label = ctk.CTkLabel(
            header_frame,
            text="请选择任务查看详情",
            font=("Arial", 14, "bold")
        )
        self.task_info_label.pack(side=tk.LEFT)
        
        action_frame = ctk.CTkFrame(header_frame, fg_color="transparent")
        action_frame.pack(side=tk.RIGHT)
        
        self.status_btn_frame = ctk.CTkFrame(action_frame, fg_color="transparent")
        self.status_btn_frame.pack(side=tk.LEFT, padx=5)
        
        self.status_buttons: Dict[str, ctk.CTkButton] = {}
        
        export_btn = ctk.CTkButton(action_frame, text="导出", command=self._export_menu, width=80)
        export_btn.pack(side=tk.LEFT, padx=2)
        
        import_temp_btn = ctk.CTkButton(action_frame, text="导入温度", command=self._import_temperature, width=100)
        import_temp_btn.pack(side=tk.LEFT, padx=2)
        
        attach_btn = ctk.CTkButton(action_frame, text="添加附件", command=self._add_attachment, width=100)
        attach_btn.pack(side=tk.LEFT, padx=2)
        
        audit_btn = ctk.CTkButton(action_frame, text="生成审计包", command=self._create_audit_package, width=100)
        audit_btn.pack(side=tk.LEFT, padx=2)
        
        self.tabview = ctk.CTkTabview(self)
        self.tabview.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)
        
        self.tab_temp = self.tabview.add("温度曲线")
        self.tab_packing = self.tabview.add("装箱清单")
        self.tab_attachments = self.tabview.add("签收附件")
        self.tab_exceptions = self.tabview.add("异常记录")
        self.tab_audit = self.tabview.add("审计日志")
        
        self._create_temp_tab()
        self._create_packing_tab()
        self._create_attachments_tab()
        self._create_exceptions_tab()
        self._create_audit_tab()
    
    def _create_temp_tab(self):
        if MATPLOTLIB_AVAILABLE:
            self.fig = Figure(figsize=(8, 4), dpi=100)
            self.ax = self.fig.add_subplot(111)
            self.canvas = FigureCanvasTkAgg(self.fig, master=self.tab_temp)
            self.canvas.get_tk_widget().pack(fill=tk.BOTH, expand=True, padx=10, pady=10)
        else:
            self.temp_tree = ttk.Treeview(
                self.tab_temp,
                columns=("time", "temperature", "battery", "is_overtemp"),
                show="headings",
                height=20
            )
            
            self.temp_tree.heading("time", text="时间")
            self.temp_tree.heading("temperature", text="温度(°C)")
            self.temp_tree.heading("battery", text="电量(%)")
            self.temp_tree.heading("is_overtemp", text="超温")
            
            self.temp_tree.column("time", width=180)
            self.temp_tree.column("temperature", width=100)
            self.temp_tree.column("battery", width=100)
            self.temp_tree.column("is_overtemp", width=80)
            
            scrollbar = ttk.Scrollbar(self.tab_temp, orient=tk.VERTICAL, command=self.temp_tree.yview)
            self.temp_tree.configure(yscrollcommand=scrollbar.set)
            
            self.temp_tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, padx=5, pady=5)
            scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
        
        info_frame = ctk.CTkFrame(self.tab_temp, fg_color="transparent")
        info_frame.pack(fill=tk.X, padx=10, pady=5)
        
        self.temp_stats_label = ctk.CTkLabel(info_frame, text="", wraplength=500)
        self.temp_stats_label.pack(anchor=tk.W)
    
    def _create_packing_tab(self):
        columns = ("drug_name", "batch_number", "specification", "quantity", "unit", "notes")
        self.packing_tree = ttk.Treeview(
            self.tab_packing,
            columns=columns,
            show="headings",
            height=20
        )
        
        self.packing_tree.heading("drug_name", text="药品名称")
        self.packing_tree.heading("batch_number", text="批号")
        self.packing_tree.heading("specification", text="规格")
        self.packing_tree.heading("quantity", text="数量")
        self.packing_tree.heading("unit", text="单位")
        self.packing_tree.heading("notes", text="备注")
        
        self.packing_tree.column("drug_name", width=120)
        self.packing_tree.column("batch_number", width=120)
        self.packing_tree.column("specification", width=100)
        self.packing_tree.column("quantity", width=80)
        self.packing_tree.column("unit", width=60)
        self.packing_tree.column("notes", width=150)
        
        scrollbar = ttk.Scrollbar(self.tab_packing, orient=tk.VERTICAL, command=self.packing_tree.yview)
        self.packing_tree.configure(yscrollcommand=scrollbar.set)
        
        self.packing_tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, padx=5, pady=5)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
    
    def _create_attachments_tab(self):
        columns = ("filename", "type", "size", "hash", "created_time")
        self.attachments_tree = ttk.Treeview(
            self.tab_attachments,
            columns=columns,
            show="headings",
            height=20
        )
        
        self.attachments_tree.heading("filename", text="文件名")
        self.attachments_tree.heading("type", text="类型")
        self.attachments_tree.heading("size", text="大小")
        self.attachments_tree.heading("hash", text="SHA256")
        self.attachments_tree.heading("created_time", text="创建时间")
        
        self.attachments_tree.column("filename", width=180)
        self.attachments_tree.column("type", width=100)
        self.attachments_tree.column("size", width=80)
        self.attachments_tree.column("hash", width=150)
        self.attachments_tree.column("created_time", width=150)
        
        scrollbar = ttk.Scrollbar(self.tab_attachments, orient=tk.VERTICAL, command=self.attachments_tree.yview)
        self.attachments_tree.configure(yscrollcommand=scrollbar.set)
        
        self.attachments_tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, padx=5, pady=5)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
    
    def _create_exceptions_tab(self):
        columns = ("type", "details", "status", "resolved_at", "created_time")
        self.exceptions_tree = ttk.Treeview(
            self.tab_exceptions,
            columns=columns,
            show="headings",
            height=20
        )
        
        self.exceptions_tree.heading("type", text="异常类型")
        self.exceptions_tree.heading("details", text="详情")
        self.exceptions_tree.heading("status", text="状态")
        self.exceptions_tree.heading("resolved_at", text="解决时间")
        self.exceptions_tree.heading("created_time", text="创建时间")
        
        self.exceptions_tree.column("type", width=120)
        self.exceptions_tree.column("details", width=250)
        self.exceptions_tree.column("status", width=80)
        self.exceptions_tree.column("resolved_at", width=150)
        self.exceptions_tree.column("created_time", width=150)
        
        scrollbar = ttk.Scrollbar(self.tab_exceptions, orient=tk.VERTICAL, command=self.exceptions_tree.yview)
        self.exceptions_tree.configure(yscrollcommand=scrollbar.set)
        
        self.exceptions_tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, padx=5, pady=5)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
    
    def _create_audit_tab(self):
        columns = ("action", "operator", "details", "created_time")
        self.audit_tree = ttk.Treeview(
            self.tab_audit,
            columns=columns,
            show="headings",
            height=20
        )
        
        self.audit_tree.heading("action", text="操作")
        self.audit_tree.heading("operator", text="操作员")
        self.audit_tree.heading("details", text="详情")
        self.audit_tree.heading("created_time", text="时间")
        
        self.audit_tree.column("action", width=150)
        self.audit_tree.column("operator", width=100)
        self.audit_tree.column("details", width=300)
        self.audit_tree.column("created_time", width=150)
        
        scrollbar = ttk.Scrollbar(self.tab_audit, orient=tk.VERTICAL, command=self.audit_tree.yview)
        self.audit_tree.configure(yscrollcommand=scrollbar.set)
        
        self.audit_tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, padx=5, pady=5)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
    
    def load_task(self, task_id: int):
        self.current_task_id = task_id
        self.current_task = self.db.get_by_id(DeliveryTask, task_id)
        
        if not self.current_task:
            return
        
        task = self.current_task
        self.task_info_label.configure(
            text=f"任务: {task.task_number} | 状态: {task.status.value} | 药师: {task.pharmacist or '-'} | 配送员: {task.courier or '-'}"
        )
        
        self._update_status_buttons()
        self._refresh_temp_tab()
        self._refresh_packing_tab()
        self._refresh_attachments_tab()
        self._refresh_exceptions_tab()
        self._refresh_audit_tab()
    
    def _update_status_buttons(self):
        for btn in self.status_buttons.values():
            btn.destroy()
        self.status_buttons.clear()
        
        if not self.current_task:
            return
        
        valid_transitions = get_valid_transitions(self.current_task.status)
        
        transition_labels = {
            TaskStatus.IN_TRANSIT: "开始运输",
            TaskStatus.TO_SIGN: "完成配送",
            TaskStatus.NEED_REVIEW: "标记复核",
            TaskStatus.ARCHIVED: "归档",
        }
        
        for target_status in valid_transitions:
            label = transition_labels.get(target_status, target_status.value)
            
            def make_callback(ts=target_status):
                return lambda: self._change_status(ts)
            
            btn = ctk.CTkButton(
                self.status_btn_frame,
                text=label,
                command=make_callback,
                width=100
            )
            btn.pack(side=tk.LEFT, padx=2)
            self.status_buttons[target_status.value] = btn
    
    def _change_status(self, target_status: TaskStatus):
        if not self.current_task:
            return
        
        try:
            if target_status == TaskStatus.IN_TRANSIT:
                self.state_machine.start_transit(self.current_task)
            elif target_status == TaskStatus.TO_SIGN:
                self.state_machine.complete_delivery(self.current_task)
            elif target_status == TaskStatus.ARCHIVED:
                self.state_machine.archive_task(self.current_task)
            else:
                self.state_machine.transition(self.current_task, target_status)
            
            self.current_task = self.db.get_by_id(DeliveryTask, self.current_task_id)
            self.task_info_label.configure(
                text=f"任务: {self.current_task.task_number} | 状态: {self.current_task.status.value}"
            )
            self._update_status_buttons()
            
            if self.on_data_changed:
                self.on_data_changed()
            
            MessageDialog(self, "成功", f"状态已变更为: {target_status.value}", "success")
            
        except StateTransitionError as e:
            MessageDialog(self, "错误", str(e), "error")
        except Exception as e:
            MessageDialog(self, "错误", f"状态变更失败: {str(e)}", "error")
    
    def _refresh_temp_tab(self):
        if not self.current_task_id:
            return
        
        readings = self.db.get_all(
            TemperatureReading,
            "task_id = ?",
            (self.current_task_id,)
        )
        
        readings = sorted(readings, key=lambda r: r.reading_time)
        
        if MATPLOTLIB_AVAILABLE and readings:
            self.ax.clear()
            
            times = [r.reading_time for r in readings]
            temps = [r.temperature for r in readings]
            overtemp_mask = [r.is_overtemp for r in readings]
            
            self.ax.plot(times, temps, 'b-', linewidth=1, alpha=0.7)
            
            overtemp_times = [t for t, o in zip(times, overtemp_mask) if o]
            overtemp_temps = [t for t, o in zip(temps, overtemp_mask) if o]
            if overtemp_times:
                self.ax.scatter(overtemp_times, overtemp_temps, c='red', s=20, zorder=5)
            
            self.ax.axhline(y=CONFIG.temperature_min, color='green', linestyle='--', alpha=0.5, label='下限')
            self.ax.axhline(y=CONFIG.temperature_max, color='green', linestyle='--', alpha=0.5, label='上限')
            
            self.ax.fill_between(times, CONFIG.temperature_min, CONFIG.temperature_max, 
                                color='green', alpha=0.1, label='正常范围')
            
            self.ax.set_xlabel('时间')
            self.ax.set_ylabel('温度 (°C)')
            self.ax.set_title(f'温度曲线 - 共{len(readings)}条记录')
            self.ax.legend(loc='upper right')
            
            plt.setp(self.ax.xaxis.get_majorticklabels(), rotation=45, ha='right')
            self.fig.tight_layout()
            self.canvas.draw()
        
        elif not MATPLOTLIB_AVAILABLE:
            for item in self.temp_tree.get_children():
                self.temp_tree.delete(item)
            
            for r in readings:
                time_str = r.reading_time.strftime('%Y-%m-%d %H:%M:%S') if r.reading_time else ""
                battery_str = f"{r.battery:.1f}%" if r.battery is not None else "-"
                overtemp_str = "是" if r.is_overtemp else "否"
                
                tag = "overtemp" if r.is_overtemp else "normal"
                self.temp_tree.insert("", tk.END, values=(
                    time_str,
                    f"{r.temperature:.2f}",
                    battery_str,
                    overtemp_str
                ), tags=(tag,))
        
        if readings:
            temps = [r.temperature for r in readings]
            overtemp_count = sum(1 for r in readings if r.is_overtemp)
            
            stats_text = (
                f"总记录: {len(readings)} | "
                f"超温: {overtemp_count} | "
                f"最高: {max(temps):.2f}°C | "
                f"最低: {min(temps):.2f}°C | "
                f"平均: {sum(temps)/len(temps):.2f}°C"
            )
            self.temp_stats_label.configure(text=stats_text)
        else:
            self.temp_stats_label.configure(text="暂无温度数据")
    
    def _refresh_packing_tab(self):
        if not self.current_task_id:
            return
        
        for item in self.packing_tree.get_children():
            self.packing_tree.delete(item)
        
        items = self.db.get_all(
            PackingItem,
            "task_id = ?",
            (self.current_task_id,)
        )
        
        drug_batches = {}
        for batch in self.db.get_all(DrugBatch):
            drug_batches[batch.id] = batch
        
        for item in items:
            batch = drug_batches.get(item.drug_batch_id)
            if batch:
                self.packing_tree.insert("", tk.END, values=(
                    batch.drug_name,
                    batch.batch_number,
                    batch.specification or "-",
                    item.quantity,
                    item.unit,
                    item.notes or "-"
                ))
    
    def _refresh_attachments_tab(self):
        if not self.current_task_id:
            return
        
        for item in self.attachments_tree.get_children():
            self.attachments_tree.delete(item)
        
        attachments = self.db.get_all(
            Attachment,
            "task_id = ?",
            (self.current_task_id,)
        )
        
        for att in attachments:
            size_str = f"{att.file_size / 1024:.1f} KB" if att.file_size > 1024 else f"{att.file_size} B"
            hash_short = att.sha256_hash[:16] + "..." if len(att.sha256_hash) > 16 else att.sha256_hash
            created_str = att.created_at.strftime('%Y-%m-%d %H:%M:%S') if att.created_at else "-"
            
            att_type = att.attachment_type
            if hasattr(att_type, 'value'):
                att_type = att_type.value
            
            self.attachments_tree.insert("", tk.END, values=(
                att.original_filename,
                att_type,
                size_str,
                hash_short,
                created_str
            ))
    
    def _refresh_exceptions_tab(self):
        if not self.current_task_id:
            return
        
        for item in self.exceptions_tree.get_children():
            self.exceptions_tree.delete(item)
        
        exceptions = self.db.get_all(
            ExceptionRecord,
            "task_id = ?",
            (self.current_task_id,)
        )
        
        for exc in exceptions:
            exc_type = exc.exception_type
            if hasattr(exc_type, 'value'):
                exc_type = exc_type.value
            
            status = "已解决" if exc.is_resolved else "待解决"
            resolved_str = exc.resolved_at.strftime('%Y-%m-%d %H:%M:%S') if exc.resolved_at else "-"
            created_str = exc.created_at.strftime('%Y-%m-%d %H:%M:%S') if exc.created_at else "-"
            
            tag = "resolved" if exc.is_resolved else "unresolved"
            self.exceptions_tree.insert("", tk.END, values=(
                exc_type,
                exc.details or "-",
                status,
                resolved_str,
                created_str
            ), tags=(tag,))
    
    def _refresh_audit_tab(self):
        if not self.current_task_id:
            return
        
        for item in self.audit_tree.get_children():
            self.audit_tree.delete(item)
        
        logs = self.db.get_all(
            AuditLog,
            "task_id = ?",
            (self.current_task_id,)
        )
        
        for log in logs:
            created_str = log.created_at.strftime('%Y-%m-%d %H:%M:%S') if log.created_at else "-"
            
            self.audit_tree.insert("", tk.END, values=(
                log.action,
                log.operator or "-",
                log.details or "-",
                created_str
            ))
    
    def _import_temperature(self):
        if not self.current_task_id:
            MessageDialog(self, "提示", "请先选择任务", "warning")
            return
        
        dialog = ImportDialog(self, self.db, "temperature")
        dialog.wait_window()
        
        if dialog.result and hasattr(dialog, 'import_result'):
            try:
                result = self.import_export.import_temperature_csv(
                    dialog.import_result['file_path']
                )
                
                if result.success:
                    msg = f"成功导入 {result.imported_count} 条记录"
                    if result.warnings:
                        msg += f"\n警告: {len(result.warnings)} 条"
                    if result.errors:
                        msg += f"\n错误: {len(result.errors)} 条 (已放入隔离区)"
                    
                    MessageDialog(self, "导入完成", msg, "success" if not result.errors else "warning")
                    
                    self._refresh_temp_tab()
                    self._refresh_exceptions_tab()
                    
                    self.current_task = self.db.get_by_id(DeliveryTask, self.current_task_id)
                    if self.current_task:
                        self.task_info_label.configure(
                            text=f"任务: {self.current_task.task_number} | 状态: {self.current_task.status.value}"
                        )
                        self._update_status_buttons()
                    
                    if self.on_data_changed:
                        self.on_data_changed()
                else:
                    MessageDialog(self, "导入失败", f"错误: {result.errors}", "error")
                    
            except Exception as e:
                MessageDialog(self, "导入错误", str(e), "error")
    
    def _add_attachment(self):
        if not self.current_task_id:
            MessageDialog(self, "提示", "请先选择任务", "warning")
            return
        
        filetypes = [
            ("图片文件", "*.jpg *.jpeg *.png *.gif *.bmp"),
            ("PDF文件", "*.pdf"),
            ("文档文件", "*.doc *.docx *.xls *.xlsx"),
            ("所有文件", "*.*")
        ]
        
        filename = filedialog.askopenfilename(
            title="选择附件文件",
            filetypes=filetypes
        )
        
        if not filename:
            return
        
        file_path = Path(filename)
        
        att_type_dialog = AttachmentTypeDialog(self)
        att_type_dialog.wait_window()
        
        if not att_type_dialog.result:
            return
        
        try:
            result = self.attachment_manager.import_attachment(
                file_path,
                self.current_task_id,
                att_type_dialog.selected_type
            )
            
            if result.success:
                if result.is_duplicate:
                    MessageDialog(self, "提示", result.duplicate_info.get('message', '文件已存在'), "info")
                else:
                    MessageDialog(self, "成功", "附件已添加", "success")
                
                self._refresh_attachments_tab()
                
                if self.on_data_changed:
                    self.on_data_changed()
            else:
                MessageDialog(self, "错误", result.error_message, "error")
                
        except Exception as e:
            MessageDialog(self, "错误", str(e), "error")
    
    def _create_audit_package(self):
        if not self.current_task_id:
            MessageDialog(self, "提示", "请先选择任务", "warning")
            return
        
        try:
            audit_package = self.report_generator.create_audit_package(self.current_task_id)
            
            if audit_package:
                MessageDialog(
                    self,
                    "成功",
                    f"审计包已生成\n编号: {audit_package.package_number}\n风险评估: {audit_package.temperature_risk}",
                    "success"
                )
                
                self._refresh_audit_tab()
                
                if self.on_data_changed:
                    self.on_data_changed()
            else:
                MessageDialog(self, "错误", "审计包生成失败", "error")
                
        except Exception as e:
            MessageDialog(self, "错误", str(e), "error")
    
    def _export_menu(self):
        if not self.current_task_id:
            MessageDialog(self, "提示", "请先选择任务", "warning")
            return
        
        menu = tk.Menu(self, tearoff=0)
        menu.add_command(label="导出Markdown复盘报告", command=self._export_markdown)
        menu.add_command(label="导出JSON审计包", command=self._export_audit_json)
        menu.add_command(label="导出超温风险CSV", command=self._export_overtemp_csv)
        
        menu.post(self.winfo_pointerx(), self.winfo_pointery())
    
    def _export_markdown(self):
        if not self.current_task_id:
            return
        
        try:
            success, output_path, content = self.report_generator.generate_markdown_report(self.current_task_id)
            
            if success and output_path:
                MessageDialog(
                    self,
                    "导出成功",
                    f"Markdown报告已导出到:\n{output_path}",
                    "success"
                )
            else:
                MessageDialog(self, "导出失败", "无法生成报告", "error")
                
        except Exception as e:
            MessageDialog(self, "导出错误", str(e), "error")
    
    def _export_audit_json(self):
        if not self.current_task_id:
            return
        
        try:
            success, output_path, data = self.import_export.export_audit_package_json(self.current_task_id)
            
            if success and output_path:
                MessageDialog(
                    self,
                    "导出成功",
                    f"JSON审计包已导出到:\n{output_path}",
                    "success"
                )
            else:
                MessageDialog(self, "导出失败", "无法导出", "error")
                
        except Exception as e:
            MessageDialog(self, "导出错误", str(e), "error")
    
    def _export_overtemp_csv(self):
        try:
            output_path = CONFIG.exports_dir / f"overtemp_risk_{datetime.now().strftime('%Y%m%d%H%M%S')}.csv"
            count = self.import_export.export_overtemperature_risk_csv(output_path, [self.current_task_id])
            
            if count > 0:
                MessageDialog(
                    self,
                    "导出成功",
                    f"导出 {count} 条超温记录到:\n{output_path}",
                    "success"
                )
            else:
                MessageDialog(self, "提示", "该任务没有超温记录", "info")
                
        except Exception as e:
            MessageDialog(self, "导出错误", str(e), "error")
    
    def refresh(self):
        if self.current_task_id:
            self.load_task(self.current_task_id)


class AttachmentTypeDialog(ctk.CTkToplevel):
    def __init__(self, parent):
        super().__init__(parent)
        self.title("选择附件类型")
        self.geometry("300x200")
        self.result = False
        self.selected_type = AttachmentType.OTHER
        
        self.transient(parent)
        self.grab_set()
        
        self._create_widgets()
    
    def _create_widgets(self):
        frame = ctk.CTkFrame(self)
        frame.pack(fill=tk.BOTH, expand=True, padx=20, pady=20)
        
        ctk.CTkLabel(frame, text="请选择附件类型:").pack(anchor=tk.W)
        
        self.type_var = ctk.StringVar(value=AttachmentType.OTHER.value)
        
        for att_type in AttachmentType:
            rb = ctk.CTkRadioButton(
                frame,
                text=att_type.value,
                variable=self.type_var,
                value=att_type.value
            )
            rb.pack(anchor=tk.W, pady=5)
        
        btn_frame = ctk.CTkFrame(frame, fg_color="transparent")
        btn_frame.pack(fill=tk.X, pady=20)
        
        ctk.CTkButton(btn_frame, text="确定", command=self._on_ok, width=100).pack(side=tk.LEFT, padx=5)
        ctk.CTkButton(btn_frame, text="取消", command=self._on_cancel, width=100).pack(side=tk.LEFT, padx=5)
    
    def _on_ok(self):
        type_value = self.type_var.get()
        for att_type in AttachmentType:
            if att_type.value == type_value:
                self.selected_type = att_type
                break
        
        self.result = True
        self.destroy()
    
    def _on_cancel(self):
        self.result = False
        self.destroy()
