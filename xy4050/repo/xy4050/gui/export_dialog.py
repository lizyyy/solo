import sys
from pathlib import Path
from typing import Optional

from PyQt6.QtWidgets import (
    QDialog, QVBoxLayout, QHBoxLayout, QFormLayout,
    QLabel, QLineEdit, QTextEdit, QComboBox,
    QPushButton, QGroupBox, QDialogButtonBox,
    QCheckBox, QFileDialog, QMessageBox
)
from PyQt6.QtCore import Qt

sys.path.insert(0, str(Path(__file__).parent.parent))


class ExportDialog(QDialog):
    def __init__(self, parent=None, default_name: str = ""):
        super().__init__(parent)
        self._default_name = default_name
        self._export_path: Optional[str] = None
        self._export_format: str = "markdown"
        
        self.setWindowTitle("导出报告")
        self.setMinimumWidth(500)
        
        self._init_ui()
    
    def _init_ui(self):
        layout = QVBoxLayout(self)
        
        format_group = QGroupBox("导出格式")
        format_layout = QVBoxLayout(format_group)
        
        self._combo_format = QComboBox()
        self._combo_format.addItems([
            "Markdown 复盘报告 (*.md)",
            "CSV 事件明细 (*.csv)",
            "JSON 完整档案 (*.json)",
        ])
        format_layout.addWidget(self._combo_format)
        
        layout.addWidget(format_group)
        
        path_group = QGroupBox("保存路径")
        path_layout = QHBoxLayout(path_group)
        
        self._edit_path = QLineEdit()
        self._edit_path.setReadOnly(True)
        path_layout.addWidget(self._edit_path, 1)
        
        self._btn_browse = QPushButton("浏览...")
        self._btn_browse.clicked.connect(self._on_browse)
        path_layout.addWidget(self._btn_browse)
        
        layout.addWidget(path_group)
        
        options_group = QGroupBox("导出选项")
        options_layout = QVBoxLayout(options_group)
        
        self._chk_include_issues = QCheckBox("包含问题检测报告")
        self._chk_include_issues.setChecked(True)
        
        self._chk_include_invalid = QCheckBox("包含无效记录")
        self._chk_include_invalid.setChecked(False)
        
        options_layout.addWidget(self._chk_include_issues)
        options_layout.addWidget(self._chk_include_invalid)
        
        layout.addWidget(options_group)
        
        buttons = QDialogButtonBox(
            QDialogButtonBox.StandardButton.Ok | 
            QDialogButtonBox.StandardButton.Cancel
        )
        self._btn_ok = buttons.button(QDialogButtonBox.StandardButton.Ok)
        self._btn_ok.setEnabled(False)
        buttons.accepted.connect(self._on_accept)
        buttons.rejected.connect(self.reject)
        
        layout.addWidget(buttons)
    
    def _on_browse(self):
        format_idx = self._combo_format.currentIndex()
        
        if format_idx == 0:
            filter_str = "Markdown文件 (*.md)"
            default_ext = ".md"
        elif format_idx == 1:
            filter_str = "CSV文件 (*.csv)"
            default_ext = ".csv"
        else:
            filter_str = "JSON文件 (*.json)"
            default_ext = ".json"
        
        default_name = self._default_name.replace(" ", "_") if self._default_name else "export"
        default_file = f"{default_name}{default_ext}"
        
        file_path, _ = QFileDialog.getSaveFileName(
            self, "选择保存位置",
            default_file,
            filter_str
        )
        
        if file_path:
            self._export_path = file_path
            self._edit_path.setText(file_path)
            self._btn_ok.setEnabled(True)
    
    def _on_accept(self):
        if not self._export_path:
            QMessageBox.warning(self, "提示", "请选择保存路径")
            return
        
        format_idx = self._combo_format.currentIndex()
        if format_idx == 0:
            self._export_format = "markdown"
        elif format_idx == 1:
            self._export_format = "csv"
        else:
            self._export_format = "json"
        
        self.accept()
    
    def get_export_info(self) -> dict:
        return {
            "format": self._export_format,
            "path": self._export_path,
            "include_issues": self._chk_include_issues.isChecked(),
            "include_invalid": self._chk_include_invalid.isChecked(),
        }
