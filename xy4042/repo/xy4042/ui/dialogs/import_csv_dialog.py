from pathlib import Path
from PyQt6.QtWidgets import (
    QDialog, QVBoxLayout, QHBoxLayout, QLabel, QLineEdit,
    QPushButton, QDialogButtonBox, QFileDialog, QMessageBox,
    QGroupBox, QTextEdit, QScrollArea, QWidget
)
from PyQt6.QtCore import Qt, pyqtSignal

from core.import_export.csv_import import CSVImporter, ImportResult


class ImportCSVDialog(QDialog):
    import_completed = pyqtSignal(ImportResult)
    
    def __init__(self, parent=None):
        super().__init__(parent)
        
        self.importer = CSVImporter()
        self.result = None
        
        self.setWindowTitle("导入CSV数据")
        self.setMinimumWidth(600)
        self._create_ui()
    
    def _create_ui(self):
        layout = QVBoxLayout(self)
        
        file_group = QGroupBox("选择文件")
        file_layout = QHBoxLayout(file_group)
        
        self.file_edit = QLineEdit()
        self.file_edit.setPlaceholderText("请选择CSV文件...")
        self.file_edit.setReadOnly(True)
        file_layout.addWidget(self.file_edit)
        
        browse_btn = QPushButton("浏览...")
        browse_btn.clicked.connect(self._browse_file)
        file_layout.addWidget(browse_btn)
        
        layout.addWidget(file_group)
        
        preview_group = QGroupBox("预览/结果")
        preview_layout = QVBoxLayout(preview_group)
        
        self.preview_edit = QTextEdit()
        self.preview_edit.setReadOnly(True)
        self.preview_edit.setPlaceholderText("选择文件后点击\"预览\"查看数据，或点击\"导入\"直接导入...")
        preview_layout.addWidget(self.preview_edit)
        
        btn_layout = QHBoxLayout()
        preview_btn = QPushButton("预览")
        preview_btn.clicked.connect(self._preview)
        btn_layout.addWidget(preview_btn)
        
        btn_layout.addStretch()
        
        self.button_box = QDialogButtonBox(
            QDialogButtonBox.StandardButton.Ok | QDialogButtonBox.StandardButton.Cancel
        )
        self.button_box.button(QDialogButtonBox.StandardButton.Ok).setText("导入")
        self.button_box.accepted.connect(self._do_import)
        self.button_box.rejected.connect(self.reject)
        btn_layout.addWidget(self.button_box)
        
        preview_layout.addLayout(btn_layout)
        
        layout.addWidget(preview_group)
    
    def _browse_file(self):
        file_path, _ = QFileDialog.getOpenFileName(
            self,
            "选择CSV文件",
            "",
            "CSV文件 (*.csv)"
        )
        
        if file_path:
            self.file_edit.setText(file_path)
    
    def _preview(self):
        file_path = self.file_edit.text().strip()
        if not file_path:
            QMessageBox.warning(self, "提示", "请先选择CSV文件")
            return
        
        path = Path(file_path)
        if not path.exists():
            QMessageBox.warning(self, "错误", "文件不存在")
            return
        
        try:
            import csv
            with open(path, 'r', encoding='utf-8-sig') as f:
                reader = csv.reader(f)
                rows = []
                for i, row in enumerate(reader):
                    if i < 20:
                        rows.append(" | ".join(row))
                    else:
                        rows.append("...（更多内容请查看文件）")
                        break
                
                self.preview_edit.setText("\n".join(rows))
        except UnicodeDecodeError:
            try:
                import csv
                with open(path, 'r', encoding='gbk') as f:
                    reader = csv.reader(f)
                    rows = []
                    for i, row in enumerate(reader):
                        if i < 20:
                            rows.append(" | ".join(row))
                        else:
                            rows.append("...（更多内容请查看文件）")
                            break
                    
                    self.preview_edit.setText("\n".join(rows))
            except Exception as e:
                QMessageBox.critical(self, "错误", f"读取文件失败: {e}")
        except Exception as e:
            QMessageBox.critical(self, "错误", f"读取文件失败: {e}")
    
    def _do_import(self):
        file_path = self.file_edit.text().strip()
        if not file_path:
            QMessageBox.warning(self, "提示", "请先选择CSV文件")
            return
        
        path = Path(file_path)
        if not path.exists():
            QMessageBox.warning(self, "错误", "文件不存在")
            return
        
        try:
            result = self.importer.import_from_file(path)
            self.result = result
            
            lines = [
                f"导入结果: {'成功' if result.success else '部分成功'}",
                f"总行数: {result.total_rows}",
                f"导入成功: {result.imported_rows}",
                f"导入失败: {result.failed_rows}",
                "",
            ]
            
            if result.warnings:
                lines.append("警告:")
                for w in result.warnings:
                    row_info = f"第{w.row_number}行: " if w.row_number else ""
                    lines.append(f"  - {row_info}{w.message}")
                lines.append("")
            
            if result.errors:
                lines.append("错误:")
                for e in result.errors:
                    row_info = f"第{e.row_number}行: " if e.row_number else ""
                    lines.append(f"  - {row_info}{e.message}")
                lines.append("")
            
            if result.imported_orders:
                lines.append("导入的订单:")
                for order in result.imported_orders:
                    lines.append(f"  - {order.order_number}: {order.body_part} ({order.side})")
            
            self.preview_edit.setText("\n".join(lines))
            self.import_completed.emit(result)
            
            if result.success:
                QMessageBox.information(
                    self, "导入完成",
                    f"成功导入 {result.imported_rows} 行数据"
                )
                self.accept()
            else:
                QMessageBox.warning(
                    self, "导入完成",
                    f"导入 {result.imported_rows} 行，失败 {result.failed_rows} 行\n请查看预览区了解详情"
                )
                
        except Exception as e:
            QMessageBox.critical(self, "错误", f"导入失败: {e}")
