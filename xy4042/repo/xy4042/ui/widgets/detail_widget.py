from pathlib import Path
from typing import Optional, List
from PyQt6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QLabel, QPushButton,
    QTabWidget, QTableWidget, QTableWidgetItem, QHeaderView,
    QGroupBox, QFormLayout, QTextEdit, QMessageBox, QFileDialog,
    QMenu, QSplitter, QFrame, QScrollArea
)
from PyQt6.QtCore import Qt, pyqtSignal
from PyQt6.QtGui import QAction

from models.order import Order
from models.patient import Patient
from models.measurement import Measurement
from models.attachment import Attachment
from models.fitting_record import FittingRecord
from models.rework_record import ReworkRecord
from core.order_repository import OrderRepository
from core.patient_repository import PatientRepository
from core.measurement_repository import MeasurementRepository
from core.attachment_repository import AttachmentRepository
from core.fitting_repository import FittingRecordRepository
from core.rework_repository import ReworkRecordRepository
from core.workflow.state_machine import StateMachine
from core.attachment.archiver import AttachmentArchiver
from ui.dialogs import (
    MeasurementDialog, FittingDialog, ReworkDialog, ExportDialog
)


class DetailWidget(QWidget):
    data_changed = pyqtSignal()
    
    def __init__(self, parent=None):
        super().__init__(parent)
        
        self.current_order_id: Optional[int] = None
        self.order: Optional[Order] = None
        self.patient: Optional[Patient] = None
        
        self.order_repo = OrderRepository()
        self.patient_repo = PatientRepository()
        self.measurement_repo = MeasurementRepository()
        self.attachment_repo = AttachmentRepository()
        self.fitting_repo = FittingRecordRepository()
        self.rework_repo = ReworkRecordRepository()
        
        self.state_machine = StateMachine()
        self.archiver = AttachmentArchiver()
        
        self._setup_ui()
    
    def _setup_ui(self):
        layout = QVBoxLayout(self)
        layout.setContentsMargins(8, 8, 8, 8)
        
        header = QGroupBox("订单详情")
        header_layout = QFormLayout(header)
        
        self.order_number_label = QLabel("-")
        self.order_number_label.setStyleSheet("font-weight: bold; font-size: 14px;")
        header_layout.addRow("订单号:", self.order_number_label)
        
        self.patient_label = QLabel("-")
        header_layout.addRow("患者:", self.patient_label)
        
        self.body_part_label = QLabel("-")
        header_layout.addRow("部位:", self.body_part_label)
        
        self.side_label = QLabel("-")
        header_layout.addRow("侧别:", self.side_label)
        
        self.status_label = QLabel("-")
        self.status_label.setStyleSheet("font-weight: bold;")
        header_layout.addRow("状态:", self.status_label)
        
        self.technician_label = QLabel("-")
        header_layout.addRow("技师:", self.technician_label)
        
        layout.addWidget(header)
        
        action_layout = QHBoxLayout()
        
        self.status_combo = None
        self.change_status_btn = QPushButton("变更状态")
        self.change_status_btn.clicked.connect(self._change_status)
        action_layout.addWidget(self.change_status_btn)
        
        action_layout.addStretch()
        
        self.export_btn = QPushButton("导出")
        self.export_btn.clicked.connect(self._export)
        action_layout.addWidget(self.export_btn)
        
        layout.addLayout(action_layout)
        
        self.tabs = QTabWidget()
        
        self._create_measurements_tab()
        self._create_attachments_tab()
        self._create_fittings_tab()
        self._create_reworks_tab()
        self._create_notes_tab()
        
        layout.addWidget(self.tabs)
    
    def _create_measurements_tab(self):
        tab = QWidget()
        layout = QVBoxLayout(tab)
        
        toolbar = QHBoxLayout()
        add_measurement_btn = QPushButton("+ 新建尺寸记录")
        add_measurement_btn.clicked.connect(self._add_measurement)
        toolbar.addWidget(add_measurement_btn)
        toolbar.addStretch()
        layout.addLayout(toolbar)
        
        self.measurements_table = QTableWidget()
        self.measurements_table.setColumnCount(4)
        self.measurements_table.setHorizontalHeaderLabels(["版本", "尺寸项数", "技师", "创建时间"])
        self.measurements_table.horizontalHeader().setSectionResizeMode(QHeaderView.ResizeMode.Stretch)
        self.measurements_table.setSelectionBehavior(QTableWidget.SelectionBehavior.SelectRows)
        self.measurements_table.setEditTriggers(QTableWidget.EditTrigger.NoEditTriggers)
        self.measurements_table.setContextMenuPolicy(Qt.ContextMenuPolicy.CustomContextMenu)
        self.measurements_table.customContextMenuRequested.connect(self._show_measurement_menu)
        layout.addWidget(self.measurements_table)
        
        self.measurement_detail = QTextEdit()
        self.measurement_detail.setReadOnly(True)
        self.measurement_detail.setPlaceholderText("选择一个尺寸版本查看详情...")
        layout.addWidget(self.measurement_detail)
        
        self.tabs.addTab(tab, "尺寸版本")
    
    def _create_attachments_tab(self):
        tab = QWidget()
        layout = QVBoxLayout(tab)
        
        toolbar = QHBoxLayout()
        import_attachment_btn = QPushButton("+ 导入附件")
        import_attachment_btn.clicked.connect(self._import_attachment)
        toolbar.addWidget(import_attachment_btn)
        toolbar.addStretch()
        layout.addLayout(toolbar)
        
        self.attachments_table = QTableWidget()
        self.attachments_table.setColumnCount(5)
        self.attachments_table.setHorizontalHeaderLabels(["文件名", "类型", "大小", "哈希", "缺失"])
        self.attachments_table.horizontalHeader().setSectionResizeMode(0, QHeaderView.ResizeMode.Stretch)
        self.attachments_table.horizontalHeader().setSectionResizeMode(3, QHeaderView.ResizeMode.ResizeToContents)
        self.attachments_table.horizontalHeader().setSectionResizeMode(4, QHeaderView.ResizeMode.ResizeToContents)
        self.attachments_table.setSelectionBehavior(QTableWidget.SelectionBehavior.SelectRows)
        self.attachments_table.setEditTriggers(QTableWidget.EditTrigger.NoEditTriggers)
        self.attachments_table.setContextMenuPolicy(Qt.ContextMenuPolicy.CustomContextMenu)
        self.attachments_table.customContextMenuRequested.connect(self._show_attachment_menu)
        layout.addWidget(self.attachments_table)
        
        self.tabs.addTab(tab, "附件清单")
    
    def _create_fittings_tab(self):
        tab = QWidget()
        layout = QVBoxLayout(tab)
        
        toolbar = QHBoxLayout()
        add_fitting_btn = QPushButton("+ 记录试穿")
        add_fitting_btn.clicked.connect(self._add_fitting)
        toolbar.addWidget(add_fitting_btn)
        toolbar.addStretch()
        layout.addLayout(toolbar)
        
        self.fittings_table = QTableWidget()
        self.fittings_table.setColumnCount(4)
        self.fittings_table.setHorizontalHeaderLabels(["试穿日期", "技师", "反馈", "下次复诊"])
        self.fittings_table.horizontalHeader().setSectionResizeMode(QHeaderView.ResizeMode.Stretch)
        self.fittings_table.setSelectionBehavior(QTableWidget.SelectionBehavior.SelectRows)
        self.fittings_table.setEditTriggers(QTableWidget.EditTrigger.NoEditTriggers)
        layout.addWidget(self.fittings_table)
        
        self.tabs.addTab(tab, "试穿记录")
    
    def _create_reworks_tab(self):
        tab = QWidget()
        layout = QVBoxLayout(tab)
        
        toolbar = QHBoxLayout()
        add_rework_btn = QPushButton("+ 创建返修")
        add_rework_btn.clicked.connect(self._add_rework)
        toolbar.addWidget(add_rework_btn)
        toolbar.addStretch()
        layout.addLayout(toolbar)
        
        self.reworks_table = QTableWidget()
        self.reworks_table.setColumnCount(5)
        self.reworks_table.setHorizontalHeaderLabels(["返修日期", "原因", "技师", "关联试穿", "状态"])
        self.reworks_table.horizontalHeader().setSectionResizeMode(QHeaderView.ResizeMode.Stretch)
        self.reworks_table.setSelectionBehavior(QTableWidget.SelectionBehavior.SelectRows)
        self.reworks_table.setEditTriggers(QTableWidget.EditTrigger.NoEditTriggers)
        layout.addWidget(self.reworks_table)
        
        self.tabs.addTab(tab, "返修记录")
    
    def _create_notes_tab(self):
        tab = QWidget()
        layout = QVBoxLayout(tab)
        
        self.notes_edit = QTextEdit()
        self.notes_edit.setPlaceholderText("订单备注...")
        layout.addWidget(self.notes_edit)
        
        save_notes_btn = QPushButton("保存备注")
        save_notes_btn.clicked.connect(self._save_notes)
        layout.addWidget(save_notes_btn)
        
        self.tabs.addTab(tab, "备注")
    
    def set_order(self, order_id: int):
        self.current_order_id = order_id
        self.order = self.order_repo.get_by_id(order_id)
        
        if self.order:
            self.patient = self.patient_repo.get_by_id(self.order.patient_id)
            self._update_display()
            self._load_measurements()
            self._load_attachments()
            self._load_fittings()
            self._load_reworks()
    
    def _update_display(self):
        if not self.order:
            return
        
        self.order_number_label.setText(self.order.order_number)
        self.patient_label.setText(self.patient.name if self.patient else "未知")
        self.body_part_label.setText(self.order.body_part)
        self.side_label.setText(self.order.side)
        self.status_label.setText(self.order.status)
        self.technician_label.setText(self.order.technician or "未分配")
        
        self.notes_edit.setPlainText(self.order.notes or "")
    
    def _load_measurements(self):
        if not self.current_order_id:
            return
        
        measurements = self.measurement_repo.get_by_order(self.current_order_id)
        self.measurements_table.setRowCount(len(measurements))
        
        for row, m in enumerate(measurements):
            self.measurements_table.setItem(row, 0, QTableWidgetItem(f"v{m.version}"))
            
            dims = m.get_dimensions_dict()
            self.measurements_table.setItem(row, 1, QTableWidgetItem(str(len(dims))))
            self.measurements_table.setItem(row, 2, QTableWidgetItem(m.technician or "-"))
            self.measurements_table.setItem(row, 3, QTableWidgetItem(str(m.created_at or "")))
            
            self.measurements_table.item(row, 0).setData(Qt.ItemDataRole.UserRole, m)
        
        self.measurements_table.itemSelectionChanged.connect(self._show_measurement_detail)
    
    def _show_measurement_detail(self):
        selected = self.measurements_table.selectedItems()
        if selected:
            row = selected[0].row()
            m = self.measurements_table.item(row, 0).data(Qt.ItemDataRole.UserRole)
            if m:
                dims = m.get_dimensions_dict()
                lines = [f"版本 {m.version} 尺寸详情:"]
                lines.append("-" * 30)
                for key, value in dims.items():
                    lines.append(f"{key}: {value}")
                if m.notes:
                    lines.append(f"\n备注: {m.notes}")
                self.measurement_detail.setPlainText("\n".join(lines))
    
    def _load_attachments(self):
        if not self.current_order_id:
            return
        
        attachments = self.attachment_repo.get_by_order(self.current_order_id)
        self.attachments_table.setRowCount(len(attachments))
        
        for row, a in enumerate(attachments):
            self.attachments_table.setItem(row, 0, QTableWidgetItem(a.original_name))
            self.attachments_table.setItem(row, 1, QTableWidgetItem(a.file_type))
            
            size_str = self._format_size(a.file_size)
            self.attachments_table.setItem(row, 2, QTableWidgetItem(size_str))
            
            short_hash = a.sha256_hash[:16] + "..."
            self.attachments_table.setItem(row, 3, QTableWidgetItem(short_hash))
            
            missing_item = QTableWidgetItem("是" if a.is_missing else "否")
            if a.is_missing:
                missing_item.setForeground(Qt.GlobalColor.red)
            self.attachments_table.setItem(row, 4, missing_item)
            
            self.attachments_table.item(row, 0).setData(Qt.ItemDataRole.UserRole, a)
    
    def _format_size(self, size: int) -> str:
        for unit in ['B', 'KB', 'MB']:
            if size < 1024:
                return f"{size:.1f} {unit}"
            size /= 1024
        return f"{size:.1f} GB"
    
    def _load_fittings(self):
        if not self.current_order_id:
            return
        
        fittings = self.fitting_repo.get_by_order(self.current_order_id)
        self.fittings_table.setRowCount(len(fittings))
        
        for row, f in enumerate(fittings):
            self.fittings_table.setItem(row, 0, QTableWidgetItem(str(f.fitting_date or "")))
            self.fittings_table.setItem(row, 1, QTableWidgetItem(f.technician or "-"))
            self.fittings_table.setItem(row, 2, QTableWidgetItem(f.feedback or "-"))
            self.fittings_table.setItem(row, 3, QTableWidgetItem(str(f.next_follow_up or "未安排")))
    
    def _load_reworks(self):
        if not self.current_order_id:
            return
        
        reworks = self.rework_repo.get_by_order(self.current_order_id)
        self.reworks_table.setRowCount(len(reworks))
        
        for row, r in enumerate(reworks):
            self.reworks_table.setItem(row, 0, QTableWidgetItem(str(r.rework_date or "")))
            self.reworks_table.setItem(row, 1, QTableWidgetItem(r.rework_reason or ""))
            self.reworks_table.setItem(row, 2, QTableWidgetItem(r.technician or "-"))
            self.reworks_table.setItem(row, 3, QTableWidgetItem(f"#{r.fitting_record_id}"))
            
            status = "已完成" if r.completed_at else "进行中"
            status_item = QTableWidgetItem(status)
            if not r.completed_at:
                status_item.setForeground(Qt.GlobalColor.red)
            self.reworks_table.setItem(row, 4, status_item)
    
    def _add_measurement(self):
        if not self.current_order_id:
            return
        
        dialog = MeasurementDialog(self, self.current_order_id)
        if dialog.exec() == MeasurementDialog.DialogCode.Accepted:
            measurement = dialog.get_measurement()
            self.measurement_repo.create(measurement)
            self._load_measurements()
            self.data_changed.emit()
            QMessageBox.information(self, "成功", "尺寸记录已创建")
    
    def _show_measurement_menu(self, pos):
        item = self.measurements_table.itemAt(pos)
        if not item:
            return
        
        row = self.measurements_table.row(item)
        m = self.measurements_table.item(row, 0).data(Qt.ItemDataRole.UserRole)
        
        menu = QMenu(self)
        
        view_action = QAction("查看详情", self)
        view_action.triggered.connect(lambda: self._show_measurement_detail())
        menu.addAction(view_action)
        
        menu.exec(self.measurements_table.mapToGlobal(pos))
    
    def _import_attachment(self):
        if not self.current_order_id:
            return
        
        file_paths, _ = QFileDialog.getOpenFileNames(
            self,
            "选择附件文件",
            "",
            "所有支持的文件 (*.jpg *.jpeg *.png *.bmp *.gif *.stl *.obj *.ply *.pdf *.csv *.txt);;图片文件 (*.jpg *.jpeg *.png *.bmp *.gif);;扫描文件 (*.stl *.obj *.ply);;PDF文件 (*.pdf);;其他文件 (*.csv *.txt)"
        )
        
        if not file_paths:
            return
        
        imported_count = 0
        errors = []
        
        for file_path in file_paths:
            try:
                path = Path(file_path)
                attachment = self.archiver.archive_file(path, self.current_order_id)
                self.attachment_repo.create(attachment)
                imported_count += 1
            except Exception as e:
                errors.append(f"{Path(file_path).name}: {e}")
        
        self._load_attachments()
        self.data_changed.emit()
        
        if errors:
            QMessageBox.warning(
                self, "导入完成",
                f"成功导入 {imported_count} 个文件，失败 {len(errors)} 个:\n" + "\n".join(errors[:5])
            )
        else:
            QMessageBox.information(self, "成功", f"成功导入 {imported_count} 个附件")
    
    def _show_attachment_menu(self, pos):
        item = self.attachments_table.itemAt(pos)
        if not item:
            return
        
        row = self.attachments_table.row(item)
        a = self.attachments_table.item(row, 0).data(Qt.ItemDataRole.UserRole)
        
        menu = QMenu(self)
        
        open_action = QAction("打开文件", self)
        open_action.triggered.connect(lambda: self._open_attachment(a))
        menu.addAction(open_action)
        
        copy_hash_action = QAction("复制哈希值", self)
        copy_hash_action.triggered.connect(lambda: self._copy_hash(a))
        menu.addAction(copy_hash_action)
        
        menu.addSeparator()
        
        delete_action = QAction("删除", self)
        delete_action.triggered.connect(lambda: self._delete_attachment(a))
        menu.addAction(delete_action)
        
        menu.exec(self.attachments_table.mapToGlobal(pos))
    
    def _open_attachment(self, attachment: Attachment):
        import subprocess
        import os
        
        file_path = Path(attachment.file_path)
        if file_path.exists():
            if os.name == 'nt':
                os.startfile(file_path)
            elif os.name == 'posix':
                subprocess.run(['open' if os.uname().sysname == 'Darwin' else 'xdg-open', str(file_path)])
        else:
            QMessageBox.warning(self, "错误", "文件不存在")
    
    def _copy_hash(self, attachment: Attachment):
        from PyQt6.QtWidgets import QApplication
        clipboard = QApplication.clipboard()
        clipboard.setText(attachment.sha256_hash)
    
    def _delete_attachment(self, attachment: Attachment):
        reply = QMessageBox.question(
            self, "确认删除",
            f"确定要删除附件 '{attachment.original_name}' 吗？",
            QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No
        )
        
        if reply == QMessageBox.StandardButton.Yes:
            self.archiver.delete_attachment(attachment)
            self.attachment_repo.delete(attachment.id)
            self._load_attachments()
            self.data_changed.emit()
    
    def _add_fitting(self):
        if not self.current_order_id:
            return
        
        dialog = FittingDialog(self, self.current_order_id)
        if dialog.exec() == FittingDialog.DialogCode.Accepted:
            fitting = dialog.get_fitting_record()
            self.fitting_repo.create(fitting)
            self._load_fittings()
            self.data_changed.emit()
            QMessageBox.information(self, "成功", "试穿记录已创建")
    
    def _add_rework(self):
        if not self.current_order_id:
            return
        
        fittings = self.fitting_repo.get_by_order(self.current_order_id)
        if not fittings:
            QMessageBox.warning(self, "提示", "返修必须关联试穿记录，请先创建试穿记录")
            return
        
        dialog = ReworkDialog(self, self.current_order_id)
        if dialog.exec() == ReworkDialog.DialogCode.Accepted:
            rework = dialog.get_rework_record()
            self.rework_repo.create(rework)
            self._load_reworks()
            self.data_changed.emit()
            QMessageBox.information(self, "成功", "返修记录已创建")
    
    def _save_notes(self):
        if not self.order:
            return
        
        self.order.notes = self.notes_edit.toPlainText() or None
        self.order_repo.update(self.order)
        self.data_changed.emit()
        QMessageBox.information(self, "成功", "备注已保存")
    
    def _change_status(self):
        if not self.order:
            return
        
        from PyQt6.QtWidgets import QInputDialog
        
        available = self.state_machine.get_available_transitions(self.order.status)
        if not available:
            QMessageBox.information(self, "提示", "当前状态没有可用的转换")
            return
        
        new_status, ok = QInputDialog.getItem(
            self, "变更状态",
            f"当前状态: {self.order.status}\n选择新状态:",
            available, 0, False
        )
        
        if ok and new_status:
            measurements = self.measurement_repo.get_by_order(self.current_order_id)
            attachments = self.attachment_repo.get_by_order(self.current_order_id)
            fittings = self.fitting_repo.get_by_order(self.current_order_id)
            
            context = {
                "has_measurements": len(measurements) > 0,
                "has_images": any(a.is_image() for a in attachments),
                "has_scans": any(a.is_scan() for a in attachments),
                "has_fitting_record": len(fittings) > 0,
                "has_final_list": False
            }
            
            result = self.state_machine.validate_transition(self.order, new_status, context)
            
            if result.success:
                self.order_repo.update_status(self.current_order_id, new_status, "手动状态变更")
                self.order = self.order_repo.get_by_id(self.current_order_id)
                self._update_display()
                self.data_changed.emit()
                
                if result.warnings:
                    QMessageBox.information(
                        self, "状态已变更",
                        f"状态已变更为: {new_status}\n\n提示:\n" + "\n".join(result.warnings)
                    )
                else:
                    QMessageBox.information(self, "成功", f"状态已变更为: {new_status}")
            else:
                QMessageBox.warning(self, "状态变更失败", "\n".join(result.errors))
    
    def _export(self):
        if not self.current_order_id:
            return
        
        dialog = ExportDialog(self, self.current_order_id)
        dialog.exec()
