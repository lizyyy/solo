from pathlib import Path
from PyQt6.QtWidgets import (
    QDialog, QVBoxLayout, QHBoxLayout, QLabel, QLineEdit,
    QPushButton, QDialogButtonBox, QFileDialog, QMessageBox,
    QGroupBox, QComboBox, QCheckBox
)
from PyQt6.QtCore import Qt

from models.order import Order
from core.import_export.csv_export import CSVExporter
from core.import_export.markdown_report import MarkdownReporter
from core.import_export.json_audit import AuditExporter
from core.order_repository import OrderRepository
from core.patient_repository import PatientRepository


class ExportDialog(QDialog):
    def __init__(self, parent=None, order_id: int = None):
        super().__init__(parent)
        
        self.order_id = order_id
        self.order_repo = OrderRepository()
        self.patient_repo = PatientRepository()
        
        self.setWindowTitle("导出数据")
        self.setMinimumWidth(500)
        self._create_ui()
    
    def _create_ui(self):
        layout = QVBoxLayout(self)
        
        if self.order_id:
            order = self.order_repo.get_by_id(self.order_id)
            if order:
                patient = self.patient_repo.get_by_id(order.patient_id)
                info_label = QLabel(f"订单: {order.order_number} - {patient.name if patient else '未知'}")
                layout.addWidget(info_label)
        
        type_group = QGroupBox("导出类型")
        type_layout = QVBoxLayout(type_group)
        
        self.csv_radio = QCheckBox("CSV订单列表")
        self.csv_radio.setChecked(True)
        type_layout.addWidget(self.csv_radio)
        
        self.markdown_radio = QCheckBox("Markdown交付单")
        if self.order_id:
            self.markdown_radio.setChecked(True)
        type_layout.addWidget(self.markdown_radio)
        
        self.audit_radio = QCheckBox("JSON审计包(含附件哈希)")
        if self.order_id:
            self.audit_radio.setChecked(True)
        type_layout.addWidget(self.audit_radio)
        
        layout.addWidget(type_group)
        
        path_group = QGroupBox("输出路径")
        path_layout = QHBoxLayout(path_group)
        
        self.path_edit = QLineEdit()
        self.path_edit.setPlaceholderText("请选择输出目录...")
        path_layout.addWidget(self.path_edit)
        
        browse_btn = QPushButton("浏览...")
        browse_btn.clicked.connect(self._browse_path)
        path_layout.addWidget(browse_btn)
        
        layout.addWidget(path_group)
        
        button_box = QDialogButtonBox(
            QDialogButtonBox.StandardButton.Ok | QDialogButtonBox.StandardButton.Cancel
        )
        button_box.accepted.connect(self._do_export)
        button_box.rejected.connect(self.reject)
        layout.addWidget(button_box)
    
    def _browse_path(self):
        dir_path = QFileDialog.getExistingDirectory(
            self,
            "选择输出目录",
            ""
        )
        
        if dir_path:
            self.path_edit.setText(dir_path)
    
    def _do_export(self):
        output_dir = self.path_edit.text().strip()
        if not output_dir:
            QMessageBox.warning(self, "提示", "请选择输出目录")
            return
        
        output_path = Path(output_dir)
        if not output_path.exists():
            QMessageBox.warning(self, "错误", "输出目录不存在")
            return
        
        exported_files = []
        
        try:
            if self.csv_radio.isChecked():
                csv_path = output_path / "订单列表.csv"
                exporter = CSVExporter()
                if self.order_id:
                    order = self.order_repo.get_by_id(self.order_id)
                    if order:
                        exporter.export_orders(csv_path, [order])
                else:
                    exporter.export_all(csv_path)
                exported_files.append(str(csv_path))
            
            if self.markdown_radio.isChecked() and self.order_id:
                order = self.order_repo.get_by_id(self.order_id)
                if order:
                    patient = self.patient_repo.get_by_id(order.patient_id)
                    md_path = output_path / f"{order.order_number}_交付单.md"
                    reporter = MarkdownReporter()
                    reporter.generate_delivery_note(order, patient, md_path)
                    exported_files.append(str(md_path))
            
            if self.audit_radio.isChecked() and self.order_id:
                order = self.order_repo.get_by_id(self.order_id)
                if order:
                    audit_path = output_path / f"{order.order_number}_审计包.json"
                    exporter = AuditExporter()
                    exporter.export_order_audit(order, audit_path)
                    exported_files.append(str(audit_path))
            
            if exported_files:
                QMessageBox.information(
                    self, "导出成功",
                    f"已导出 {len(exported_files)} 个文件:\n" + "\n".join(exported_files)
                )
                self.accept()
            else:
                QMessageBox.warning(self, "提示", "未选择任何导出类型")
                
        except Exception as e:
            QMessageBox.critical(self, "错误", f"导出失败: {e}")
