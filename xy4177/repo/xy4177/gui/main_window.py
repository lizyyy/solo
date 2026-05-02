# -*- coding: utf-8 -*-
"""
主窗口
"""

import io
from pathlib import Path
from typing import List, Optional, Dict, Any
from datetime import datetime

from PyQt6.QtWidgets import (
    QMainWindow, QWidget, QVBoxLayout, QHBoxLayout,
    QSplitter, QTabWidget, QTableWidget, QTableWidgetItem,
    QLabel, QPushButton, QFileDialog, QMessageBox,
    QGroupBox, QFormLayout, QLineEdit, QSpinBox,
    QComboBox, QTextEdit, QStatusBar, QToolBar,
    QMenu, QMenuBar, QHeaderView, QAbstractItemView,
    QDialog, QDialogButtonBox, QScrollArea, QFrame
)
from PyQt6.QtGui import QAction, QIcon, QPixmap, QImage, QFont
from PyQt6.QtCore import Qt, QSize, pyqtSignal

from core.models import (
    Project, SKUData, LabelTemplate, ValidationResult,
    ValidationError, LabelPreview
)
from core.constants import ErrorLevel, DPI, DEFAULT_DPI
from core.validator import DataValidator
from core.layout import LayoutValidator
from core.renderer import LabelRenderer
from io.csv_reader import CSVReader
from io.template_parser import TemplateParserFactory
from io.pdf_exporter import PDFExporter
from io.png_exporter import PNGExporter
from io.json_auditor import JSONAuditor
from persistence.storage import ProjectStorage
from samples.sample_data import (
    get_sample_sku_list, get_sample_template_zpl, get_sample_template_json,
    create_sample_csv, create_sample_zpl, create_sample_json_template
)


class MainWindow(QMainWindow):
    """主窗口"""
    
    def __init__(self):
        super().__init__()
        
        self.project = Project()
        self.validator = DataValidator()
        self.layout_validator = LayoutValidator()
        self.renderer = LabelRenderer()
        self.storage = ProjectStorage()
        
        self.validation_results: List[ValidationResult] = []
        self.current_preview: Optional[LabelPreview] = None
        self.selected_row: int = -1
        
        self._init_ui()
        self._create_menu_bar()
        self._create_tool_bar()
        self._create_status_bar()
        
        self.resize(1400, 900)
        self.setWindowTitle("热敏标签排版预检台 v1.0.0")
    
    def _init_ui(self):
        """初始化UI"""
        central_widget = QWidget()
        self.setCentralWidget(central_widget)
        
        main_layout = QVBoxLayout(central_widget)
        main_layout.setContentsMargins(5, 5, 5, 5)
        
        top_panel = self._create_top_panel()
        main_layout.addWidget(top_panel)
        
        splitter = QSplitter(Qt.Orientation.Horizontal)
        
        left_widget = self._create_data_panel()
        splitter.addWidget(left_widget)
        
        right_widget = self._create_preview_panel()
        splitter.addWidget(right_widget)
        
        splitter.setSizes([700, 700])
        
        main_layout.addWidget(splitter, 1)
    
    def _create_top_panel(self) -> QWidget:
        """创建顶部面板"""
        panel = QGroupBox("项目信息")
        layout = QHBoxLayout(panel)
        
        form_layout = QFormLayout()
        
        self.project_name_edit = QLineEdit("未命名项目")
        self.project_name_edit.setMaximumWidth(200)
        form_layout.addRow("项目名称:", self.project_name_edit)
        
        self.template_name_label = QLabel("未加载")
        form_layout.addRow("当前模板:", self.template_name_label)
        
        self.record_count_label = QLabel("0 条")
        form_layout.addRow("数据记录:", self.record_count_label)
        
        layout.addLayout(form_layout)
        layout.addStretch()
        
        self.status_label = QLabel("就绪")
        self.status_label.setStyleSheet("color: green; font-weight: bold;")
        layout.addWidget(self.status_label)
        
        return panel
    
    def _create_data_panel(self) -> QWidget:
        """创建数据面板"""
        panel = QWidget()
        layout = QVBoxLayout(panel)
        layout.setContentsMargins(0, 0, 0, 0)
        
        tabs = QTabWidget()
        
        data_tab = self._create_data_table_tab()
        tabs.addTab(data_tab, "数据表格")
        
        error_tab = self._create_error_tab()
        tabs.addTab(error_tab, "错误列表")
        
        template_tab = self._create_template_tab()
        tabs.addTab(template_tab, "模板信息")
        
        layout.addWidget(tabs)
        
        return panel
    
    def _create_data_table_tab(self) -> QWidget:
        """创建数据表格标签页"""
        widget = QWidget()
        layout = QVBoxLayout(widget)
        
        toolbar = QHBoxLayout()
        
        btn_load_csv = QPushButton("导入CSV")
        btn_load_csv.clicked.connect(self._on_load_csv)
        toolbar.addWidget(btn_load_csv)
        
        btn_load_sample = QPushButton("加载示例数据")
        btn_load_sample.clicked.connect(self._on_load_sample_data)
        toolbar.addWidget(btn_load_sample)
        
        btn_validate = QPushButton("执行校验")
        btn_validate.clicked.connect(self._on_validate)
        toolbar.addWidget(btn_validate)
        
        btn_preview = QPushButton("预览选中")
        btn_preview.clicked.connect(self._on_preview_selected)
        toolbar.addWidget(btn_preview)
        
        toolbar.addStretch()
        
        layout.addLayout(toolbar)
        
        self.data_table = QTableWidget()
        self.data_table.setSelectionBehavior(QAbstractItemView.SelectionBehavior.SelectRows)
        self.data_table.setSelectionMode(QAbstractItemView.SelectionMode.SingleSelection)
        self.data_table.itemSelectionChanged.connect(self._on_table_selection_changed)
        self.data_table.itemChanged.connect(self._on_table_item_changed)
        layout.addWidget(self.data_table)
        
        return widget
    
    def _create_error_tab(self) -> QWidget:
        """创建错误列表标签页"""
        widget = QWidget()
        layout = QVBoxLayout(widget)
        
        toolbar = QHBoxLayout()
        
        btn_export_errors = QPushButton("导出错误清单")
        btn_export_errors.clicked.connect(self._on_export_errors_csv)
        toolbar.addWidget(btn_export_errors)
        
        btn_clear = QPushButton("清空")
        btn_clear.clicked.connect(self._on_clear_errors)
        toolbar.addWidget(btn_clear)
        
        toolbar.addStretch()
        
        layout.addLayout(toolbar)
        
        self.error_table = QTableWidget()
        self.error_table.setColumnCount(6)
        self.error_table.setHorizontalHeaderLabels([
            "行号", "箱号", "级别", "错误代码", "字段", "消息"
        ])
        self.error_table.horizontalHeader().setSectionResizeMode(QHeaderView.ResizeMode.Stretch)
        layout.addWidget(self.error_table)
        
        return widget
    
    def _create_template_tab(self) -> QWidget:
        """创建模板信息标签页"""
        widget = QWidget()
        layout = QVBoxLayout(widget)
        
        toolbar = QHBoxLayout()
        
        btn_load_template = QPushButton("加载模板")
        btn_load_template.clicked.connect(self._on_load_template)
        toolbar.addWidget(btn_load_template)
        
        btn_load_sample_zpl = QPushButton("加载示例ZPL")
        btn_load_sample_zpl.clicked.connect(self._on_load_sample_zpl)
        toolbar.addWidget(btn_load_sample_zpl)
        
        btn_load_sample_json = QPushButton("加载示例JSON")
        btn_load_sample_json.clicked.connect(self._on_load_sample_json)
        toolbar.addWidget(btn_load_sample_json)
        
        toolbar.addStretch()
        
        layout.addLayout(toolbar)
        
        info_group = QGroupBox("模板属性")
        info_layout = QFormLayout(info_group)
        
        self.template_name_display = QLabel("-")
        info_layout.addRow("模板名称:", self.template_name_display)
        
        self.template_size_display = QLabel("-")
        info_layout.addRow("标签尺寸:", self.template_size_display)
        
        self.template_dpi_display = QLabel("-")
        info_layout.addRow("打印机DPI:", self.template_dpi_display)
        
        self.template_fields_display = QLabel("-")
        info_layout.addRow("字段数量:", self.template_fields_display)
        
        layout.addWidget(info_group)
        
        fields_group = QGroupBox("模板字段")
        fields_layout = QVBoxLayout(fields_group)
        
        self.template_fields_table = QTableWidget()
        self.template_fields_table.setColumnCount(5)
        self.template_fields_table.setHorizontalHeaderLabels([
            "字段名", "类型", "X位置", "Y位置", "必填"
        ])
        self.template_fields_table.horizontalHeader().setSectionResizeMode(QHeaderView.ResizeMode.Stretch)
        fields_layout.addWidget(self.template_fields_table)
        
        layout.addWidget(fields_group)
        
        raw_group = QGroupBox("原始内容")
        raw_layout = QVBoxLayout(raw_group)
        
        self.template_raw_text = QTextEdit()
        self.template_raw_text.setReadOnly(True)
        self.template_raw_text.setFont(QFont("Monospace", 10))
        raw_layout.addWidget(self.template_raw_text)
        
        layout.addWidget(raw_group, 1)
        
        return widget
    
    def _create_preview_panel(self) -> QWidget:
        """创建预览面板"""
        panel = QWidget()
        layout = QVBoxLayout(panel)
        layout.setContentsMargins(0, 0, 0, 0)
        
        tabs = QTabWidget()
        
        preview_tab = self._create_image_preview_tab()
        tabs.addTab(preview_tab, "标签预览")
        
        export_tab = self._create_export_tab()
        tabs.addTab(export_tab, "导出")
        
        layout.addWidget(tabs)
        
        return panel
    
    def _create_image_preview_tab(self) -> QWidget:
        """创建图像预览标签页"""
        widget = QWidget()
        layout = QVBoxLayout(widget)
        
        toolbar = QHBoxLayout()
        
        btn_refresh = QPushButton("刷新预览")
        btn_refresh.clicked.connect(self._on_refresh_preview)
        toolbar.addWidget(btn_refresh)
        
        btn_save_png = QPushButton("保存PNG")
        btn_save_png.clicked.connect(self._on_save_preview_png)
        toolbar.addWidget(btn_save_png)
        
        toolbar.addStretch()
        
        layout.addLayout(toolbar)
        
        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        scroll.setAlignment(Qt.AlignmentFlag.AlignCenter)
        
        self.preview_label = QLabel()
        self.preview_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.preview_label.setText("请选择数据行并点击预览")
        self.preview_label.setStyleSheet("border: 1px solid gray; background-color: #f0f0f0;")
        self.preview_label.setMinimumSize(400, 300)
        
        scroll.setWidget(self.preview_label)
        
        layout.addWidget(scroll, 1)
        
        info_group = QGroupBox("当前数据信息")
        info_layout = QFormLayout(info_group)
        
        self.current_sku_label = QLabel("-")
        info_layout.addRow("SKU:", self.current_sku_label)
        
        self.current_box_label = QLabel("-")
        info_layout.addRow("箱号:", self.current_box_label)
        
        self.current_batch_label = QLabel("-")
        info_layout.addRow("批次:", self.current_batch_label)
        
        self.current_expiry_label = QLabel("-")
        info_layout.addRow("效期:", self.current_expiry_label)
        
        self.validation_status_label = QLabel("-")
        info_layout.addRow("校验状态:", self.validation_status_label)
        
        layout.addWidget(info_group)
        
        return widget
    
    def _create_export_tab(self) -> QWidget:
        """创建导出标签页"""
        widget = QWidget()
        layout = QVBoxLayout(widget)
        
        export_group = QGroupBox("导出选项")
        export_layout = QFormLayout(export_group)
        
        self.export_dpi_combo = QComboBox()
        self.export_dpi_combo.addItems(["203 DPI", "300 DPI", "600 DPI"])
        self.export_dpi_combo.setCurrentIndex(0)
        export_layout.addRow("导出DPI:", self.export_dpi_combo)
        
        self.export_scale_spin = QSpinBox()
        self.export_scale_spin.setRange(1, 5)
        self.export_scale_spin.setValue(2)
        export_layout.addRow("缩放倍数:", self.export_scale_spin)
        
        layout.addWidget(export_group)
        
        actions_group = QGroupBox("导出操作")
        actions_layout = QVBoxLayout(actions_group)
        
        btn_export_pdf = QPushButton("导出PDF预览 (所有标签)")
        btn_export_pdf.clicked.connect(self._on_export_pdf)
        btn_export_pdf.setMinimumHeight(40)
        actions_layout.addWidget(btn_export_pdf)
        
        btn_export_png_batch = QPushButton("导出PNG图片 (批量)")
        btn_export_png_batch.clicked.connect(self._on_export_png_batch)
        btn_export_png_batch.setMinimumHeight(40)
        actions_layout.addWidget(btn_export_png_batch)
        
        btn_export_audit = QPushButton("导出JSON审计包")
        btn_export_audit.clicked.connect(self._on_export_audit)
        btn_export_audit.setMinimumHeight(40)
        actions_layout.addWidget(btn_export_audit)
        
        btn_export_all = QPushButton("全部导出 (PDF+PNG+审计包)")
        btn_export_all.clicked.connect(self._on_export_all)
        btn_export_all.setMinimumHeight(50)
        btn_export_all.setStyleSheet("font-weight: bold; font-size: 14px;")
        actions_layout.addWidget(btn_export_all)
        
        actions_layout.addStretch()
        
        layout.addWidget(actions_group)
        
        sample_group = QGroupBox("示例文件生成")
        sample_layout = QVBoxLayout(sample_group)
        
        btn_gen_samples = QPushButton("生成示例文件到桌面")
        btn_gen_samples.clicked.connect(self._on_generate_samples)
        sample_layout.addWidget(btn_gen_samples)
        
        layout.addWidget(sample_group)
        
        layout.addStretch()
        
        return widget
    
    def _create_menu_bar(self):
        """创建菜单栏"""
        menubar = self.menuBar()
        
        file_menu = menubar.addMenu("文件(&F)")
        
        new_action = QAction("新建项目(&N)", self)
        new_action.setShortcut("Ctrl+N")
        new_action.triggered.connect(self._on_new_project)
        file_menu.addAction(new_action)
        
        open_action = QAction("打开项目(&O)", self)
        open_action.setShortcut("Ctrl+O")
        open_action.triggered.connect(self._on_open_project)
        file_menu.addAction(open_action)
        
        save_action = QAction("保存项目(&S)", self)
        save_action.setShortcut("Ctrl+S")
        save_action.triggered.connect(self._on_save_project)
        file_menu.addAction(save_action)
        
        file_menu.addSeparator()
        
        import_menu = file_menu.addMenu("导入(&I)")
        
        import_csv_action = QAction("导入CSV数据(&C)", self)
        import_csv_action.triggered.connect(self._on_load_csv)
        import_menu.addAction(import_csv_action)
        
        import_template_action = QAction("导入标签模板(&T)", self)
        import_template_action.triggered.connect(self._on_load_template)
        import_menu.addAction(import_template_action)
        
        file_menu.addSeparator()
        
        export_menu = file_menu.addMenu("导出(&E)")
        
        export_pdf_action = QAction("导出PDF预览(&P)", self)
        export_pdf_action.triggered.connect(self._on_export_pdf)
        export_menu.addAction(export_pdf_action)
        
        export_png_action = QAction("导出PNG图片(&G)", self)
        export_png_action.triggered.connect(self._on_export_png_batch)
        export_menu.addAction(export_png_action)
        
        export_audit_action = QAction("导出审计包(&A)", self)
        export_audit_action.triggered.connect(self._on_export_audit)
        export_menu.addAction(export_audit_action)
        
        export_errors_action = QAction("导出错误清单(&L)", self)
        export_errors_action.triggered.connect(self._on_export_errors_csv)
        export_menu.addAction(export_errors_action)
        
        file_menu.addSeparator()
        
        exit_action = QAction("退出(&X)", self)
        exit_action.setShortcut("Ctrl+Q")
        exit_action.triggered.connect(self.close)
        file_menu.addAction(exit_action)
        
        edit_menu = menubar.addMenu("编辑(&E)")
        
        validate_action = QAction("执行校验(&V)", self)
        validate_action.setShortcut("F5")
        validate_action.triggered.connect(self._on_validate)
        edit_menu.addAction(validate_action)
        
        preview_action = QAction("预览选中(&P)", self)
        preview_action.setShortcut("F6")
        preview_action.triggered.connect(self._on_preview_selected)
        edit_menu.addAction(preview_action)
        
        sample_menu = menubar.addMenu("示例(&S)")
        
        sample_data_action = QAction("加载示例数据(&D)", self)
        sample_data_action.triggered.connect(self._on_load_sample_data)
        sample_menu.addAction(sample_data_action)
        
        sample_zpl_action = QAction("加载示例ZPL模板(&Z)", self)
        sample_zpl_action.triggered.connect(self._on_load_sample_zpl)
        sample_menu.addAction(sample_zpl_action)
        
        sample_json_action = QAction("加载示例JSON模板(&J)", self)
        sample_json_action.triggered.connect(self._on_load_sample_json)
        sample_menu.addAction(sample_json_action)
        
        help_menu = menubar.addMenu("帮助(&H)")
        
        about_action = QAction("关于(&A)", self)
        about_action.triggered.connect(self._on_about)
        help_menu.addAction(about_action)
    
    def _create_tool_bar(self):
        """创建工具栏"""
        toolbar = self.addToolBar("主工具栏")
        toolbar.setMovable(False)
        
        new_action = QAction("新建", self)
        new_action.triggered.connect(self._on_new_project)
        toolbar.addAction(new_action)
        
        open_action = QAction("打开", self)
        open_action.triggered.connect(self._on_open_project)
        toolbar.addAction(open_action)
        
        save_action = QAction("保存", self)
        save_action.triggered.connect(self._on_save_project)
        toolbar.addAction(save_action)
        
        toolbar.addSeparator()
        
        import_csv_action = QAction("导入CSV", self)
        import_csv_action.triggered.connect(self._on_load_csv)
        toolbar.addAction(import_csv_action)
        
        import_template_action = QAction("加载模板", self)
        import_template_action.triggered.connect(self._on_load_template)
        toolbar.addAction(import_template_action)
        
        toolbar.addSeparator()
        
        validate_action = QAction("校验", self)
        validate_action.triggered.connect(self._on_validate)
        toolbar.addAction(validate_action)
        
        preview_action = QAction("预览", self)
        preview_action.triggered.connect(self._on_preview_selected)
        toolbar.addAction(preview_action)
        
        toolbar.addSeparator()
        
        export_action = QAction("导出", self)
        export_action.triggered.connect(self._on_export_all)
        toolbar.addAction(export_action)
    
    def _create_status_bar(self):
        """创建状态栏"""
        self.statusbar = QStatusBar()
        self.setStatusBar(self.statusbar)
        self.statusbar.showMessage("就绪")
    
    def _update_status(self, message: str, is_error: bool = False):
        """更新状态栏"""
        if is_error:
            self.statusbar.setStyleSheet("color: red;")
        else:
            self.statusbar.setStyleSheet("color: black;")
        self.statusbar.showMessage(message)
    
    def _on_new_project(self):
        """新建项目"""
        reply = QMessageBox.question(
            self, "确认",
            "当前项目未保存的更改将丢失，是否继续？",
            QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No
        )
        
        if reply == QMessageBox.StandardButton.Yes:
            self.project = Project()
            self.validation_results = []
            self._refresh_all_ui()
            self._update_status("已创建新项目")
    
    def _on_open_project(self):
        """打开项目"""
        file_path, _ = QFileDialog.getOpenFileName(
            self, "打开项目", "",
            "标签预检项目 (*.lblproj);;所有文件 (*)"
        )
        
        if file_path:
            try:
                self.project = self.storage.load_project(file_path)
                self._refresh_all_ui()
                self._update_status(f"已打开项目: {self.project.name}")
            except Exception as e:
                QMessageBox.critical(self, "错误", f"打开项目失败: {str(e)}")
    
    def _on_save_project(self):
        """保存项目"""
        if not self.project.sku_data_list and not self.project.template:
            QMessageBox.warning(self, "警告", "项目为空，无需保存")
            return
        
        file_path, _ = QFileDialog.getSaveFileName(
            self, "保存项目", self.project.name,
            "标签预检项目 (*.lblproj);;所有文件 (*)"
        )
        
        if file_path:
            try:
                self.project.name = Path(file_path).stem
                self.project_name_edit.setText(self.project.name)
                saved_path = self.storage.save_project(self.project, file_path)
                self._update_status(f"已保存到: {saved_path}")
            except Exception as e:
                QMessageBox.critical(self, "错误", f"保存项目失败: {str(e)}")
    
    def _on_load_csv(self):
        """加载CSV文件"""
        file_path, _ = QFileDialog.getOpenFileName(
            self, "选择CSV文件", "",
            "CSV文件 (*.csv);;所有文件 (*)"
        )
        
        if file_path:
            try:
                reader = CSVReader()
                self.project.sku_data_list = reader.read_file(file_path)
                self._refresh_data_table()
                self.record_count_label.setText(f"{len(self.project.sku_data_list)} 条")
                self._update_status(f"已加载 {len(self.project.sku_data_list)} 条数据")
            except Exception as e:
                QMessageBox.critical(self, "错误", f"加载CSV失败: {str(e)}")
    
    def _on_load_template(self):
        """加载模板文件"""
        file_path, _ = QFileDialog.getOpenFileName(
            self, "选择模板文件", "",
            "ZPL模板 (*.zpl *.lbl);;JSON模板 (*.json);;所有文件 (*)"
        )
        
        if file_path:
            try:
                self.project.template = TemplateParserFactory.parse_file(file_path)
                self.validator.set_template(self.project.template)
                self._refresh_template_info()
                self.template_name_label.setText(self.project.template.name)
                self._update_status(f"已加载模板: {self.project.template.name}")
            except Exception as e:
                QMessageBox.critical(self, "错误", f"加载模板失败: {str(e)}")
    
    def _on_load_sample_data(self):
        """加载示例数据"""
        self.project.sku_data_list = get_sample_sku_list()
        self._refresh_data_table()
        self.record_count_label.setText(f"{len(self.project.sku_data_list)} 条")
        self._update_status("已加载示例数据 (5条记录，包含各种问题场景)")
    
    def _on_load_sample_zpl(self):
        """加载示例ZPL模板"""
        from io.template_parser import ZPLParser
        zpl_content = get_sample_template_zpl()
        parser = ZPLParser()
        self.project.template = parser.parse_string(zpl_content, "示例ZPL模板")
        self.validator.set_template(self.project.template)
        self._refresh_template_info()
        self.template_name_label.setText(self.project.template.name)
        self._update_status("已加载示例ZPL模板")
    
    def _on_load_sample_json(self):
        """加载示例JSON模板"""
        from io.template_parser import JSONTemplateParser
        json_content = get_sample_template_json()
        parser = JSONTemplateParser()
        self.project.template = parser.parse_string(json_content, "示例JSON模板")
        self.validator.set_template(self.project.template)
        self._refresh_template_info()
        self.template_name_label.setText(self.project.template.name)
        self._update_status("已加载示例JSON模板")
    
    def _on_validate(self):
        """执行校验"""
        if not self.project.sku_data_list:
            QMessageBox.warning(self, "警告", "请先加载数据")
            return
        
        if not self.project.template:
            QMessageBox.warning(self, "警告", "请先加载模板")
            return
        
        try:
            self.validation_results = self.validator.validate_all(
                self.project.sku_data_list, self.project.template
            )
            
            for result in self.validation_results:
                if self.project.template:
                    layout_errors = self.layout_validator.validate_layout(
                        result.sku_data, self.project.template
                    )
                    for error in layout_errors:
                        result.add_error(error)
            
            self.project.validation_results = self.validation_results
            self._refresh_error_table()
            self._refresh_data_table()
            
            total_errors = sum(len(r.errors) for r in self.validation_results)
            total_warnings = sum(len(r.warnings) for r in self.validation_results)
            valid_count = sum(1 for r in self.validation_results if r.is_valid)
            
            self._update_status(
                f"校验完成: {valid_count}/{len(self.validation_results)} 条通过, "
                f"{total_errors} 个错误, {total_warnings} 个警告"
            )
            
            if total_errors > 0:
                self.status_label.setText(f"校验失败 ({total_errors}错误)")
                self.status_label.setStyleSheet("color: red; font-weight: bold;")
            elif total_warnings > 0:
                self.status_label.setText(f"有警告 ({total_warnings}警告)")
                self.status_label.setStyleSheet("color: orange; font-weight: bold;")
            else:
                self.status_label.setText("全部通过")
                self.status_label.setStyleSheet("color: green; font-weight: bold;")
            
        except Exception as e:
            QMessageBox.critical(self, "错误", f"校验失败: {str(e)}")
    
    def _on_preview_selected(self):
        """预览选中行"""
        if self.selected_row < 0 or self.selected_row >= len(self.project.sku_data_list):
            QMessageBox.warning(self, "警告", "请先选择一行数据")
            return
        
        if not self.project.template:
            QMessageBox.warning(self, "警告", "请先加载模板")
            return
        
        try:
            sku_data = self.project.sku_data_list[self.selected_row]
            corrected_sku = self.project.get_corrected_sku(sku_data)
            
            self.current_preview = self.renderer.render_label(corrected_sku, self.project.template)
            
            validation_result = None
            for vr in self.validation_results:
                if vr.sku_data.row_index == sku_data.row_index:
                    validation_result = vr
                    self.current_preview.validation_result = validation_result
                    break
            
            self._refresh_preview_image()
            self._refresh_current_info(sku_data, validation_result)
            self._update_status("已生成预览")
            
        except Exception as e:
            QMessageBox.critical(self, "错误", f"生成预览失败: {str(e)}")
    
    def _on_refresh_preview(self):
        """刷新预览"""
        self._on_preview_selected()
    
    def _on_save_preview_png(self):
        """保存预览为PNG"""
        if not self.current_preview:
            QMessageBox.warning(self, "警告", "请先生成预览")
            return
        
        file_path, _ = QFileDialog.getSaveFileName(
            self, "保存PNG", "",
            "PNG图片 (*.png);;所有文件 (*)"
        )
        
        if file_path:
            try:
                exporter = PNGExporter()
                exporter.export_single(self.current_preview, file_path)
                self._update_status(f"已保存到: {file_path}")
            except Exception as e:
                QMessageBox.critical(self, "错误", f"保存失败: {str(e)}")
    
    def _on_table_selection_changed(self):
        """表格选择变化"""
        selected = self.data_table.selectedItems()
        if selected:
            self.selected_row = selected[0].row()
        else:
            self.selected_row = -1
    
    def _on_table_item_changed(self, item: QTableWidgetItem):
        """表格项修改"""
        if self.selected_row >= 0 and self.selected_row < len(self.project.sku_data_list):
            row = item.row()
            if row < len(self.project.sku_data_list):
                col_name = self.data_table.horizontalHeaderItem(item.column()).text()
                
                sku = self.project.sku_data_list[row]
                self.project.save_correction(sku.row_index, col_name, item.text())
    
    def _on_clear_errors(self):
        """清空错误列表"""
        self.error_table.setRowCount(0)
    
    def _on_export_pdf(self):
        """导出PDF"""
        if not self.project.sku_data_list:
            QMessageBox.warning(self, "警告", "请先加载数据")
            return
        
        if not self.project.template:
            QMessageBox.warning(self, "警告", "请先加载模板")
            return
        
        file_path, _ = QFileDialog.getSaveFileName(
            self, "导出PDF", "标签预览.pdf",
            "PDF文件 (*.pdf);;所有文件 (*)"
        )
        
        if file_path:
            try:
                previews = []
                for sku in self.project.sku_data_list:
                    corrected_sku = self.project.get_corrected_sku(sku)
                    preview = self.renderer.render_label(corrected_sku, self.project.template)
                    
                    for vr in self.validation_results:
                        if vr.sku_data.row_index == sku.row_index:
                            preview.validation_result = vr
                            break
                    
                    previews.append(preview)
                
                exporter = PDFExporter()
                exporter.export_previews(previews, file_path)
                self._update_status(f"PDF已导出: {file_path}")
                
            except Exception as e:
                QMessageBox.critical(self, "错误", f"导出PDF失败: {str(e)}")
    
    def _on_export_png_batch(self):
        """批量导出PNG"""
        if not self.project.sku_data_list:
            QMessageBox.warning(self, "警告", "请先加载数据")
            return
        
        if not self.project.template:
            QMessageBox.warning(self, "警告", "请先加载模板")
            return
        
        dir_path = QFileDialog.getExistingDirectory(self, "选择输出目录")
        
        if dir_path:
            try:
                previews = []
                for sku in self.project.sku_data_list:
                    corrected_sku = self.project.get_corrected_sku(sku)
                    preview = self.renderer.render_label(corrected_sku, self.project.template)
                    previews.append(preview)
                
                exporter = PNGExporter()
                exported = exporter.export_batch(previews, dir_path)
                self._update_status(f"已导出 {len(exported)} 个PNG文件到: {dir_path}")
                
            except Exception as e:
                QMessageBox.critical(self, "错误", f"导出PNG失败: {str(e)}")
    
    def _on_export_audit(self):
        """导出审计包"""
        if not self.project.sku_data_list:
            QMessageBox.warning(self, "警告", "请先加载数据")
            return
        
        file_path, _ = QFileDialog.getSaveFileName(
            self, "导出审计包", "审计报告.json",
            "JSON文件 (*.json);;所有文件 (*)"
        )
        
        if file_path:
            try:
                auditor = JSONAuditor()
                audit = auditor.create_audit_package(
                    self.project.template,
                    self.project.sku_data_list,
                    self.validation_results,
                    self.project.name
                )
                auditor.export_audit_package(audit, file_path)
                self._update_status(f"审计包已导出: {file_path}")
                
            except Exception as e:
                QMessageBox.critical(self, "错误", f"导出审计包失败: {str(e)}")
    
    def _on_export_errors_csv(self):
        """导出错误清单CSV"""
        if not self.validation_results:
            QMessageBox.warning(self, "警告", "请先执行校验")
            return
        
        file_path, _ = QFileDialog.getSaveFileName(
            self, "导出错误清单", "错误清单.csv",
            "CSV文件 (*.csv);;所有文件 (*)"
        )
        
        if file_path:
            try:
                auditor = JSONAuditor()
                auditor.export_errors_csv(self.validation_results, file_path)
                self._update_status(f"错误清单已导出: {file_path}")
                
            except Exception as e:
                QMessageBox.critical(self, "错误", f"导出失败: {str(e)}")
    
    def _on_export_all(self):
        """全部导出"""
        if not self.project.sku_data_list:
            QMessageBox.warning(self, "警告", "请先加载数据")
            return
        
        if not self.project.template:
            QMessageBox.warning(self, "警告", "请先加载模板")
            return
        
        dir_path = QFileDialog.getExistingDirectory(self, "选择输出目录")
        
        if dir_path:
            try:
                path = Path(dir_path)
                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                
                previews = []
                for sku in self.project.sku_data_list:
                    corrected_sku = self.project.get_corrected_sku(sku)
                    preview = self.renderer.render_label(corrected_sku, self.project.template)
                    
                    for vr in self.validation_results:
                        if vr.sku_data.row_index == sku.row_index:
                            preview.validation_result = vr
                            break
                    
                    previews.append(preview)
                
                pdf_path = str(path / f"标签预览_{timestamp}.pdf")
                pdf_exporter = PDFExporter()
                pdf_exporter.export_previews(previews, pdf_path)
                
                png_dir = path / f"PNG图片_{timestamp}"
                png_exporter = PNGExporter()
                png_exporter.export_batch(previews, str(png_dir))
                
                auditor = JSONAuditor()
                audit = auditor.create_audit_package(
                    self.project.template,
                    self.project.sku_data_list,
                    self.validation_results,
                    self.project.name
                )
                audit_path = str(path / f"审计报告_{timestamp}.json")
                auditor.export_audit_package(audit, audit_path)
                
                if self.validation_results:
                    errors_path = str(path / f"错误清单_{timestamp}.csv")
                    auditor.export_errors_csv(self.validation_results, errors_path)
                
                self._update_status(f"全部已导出到: {dir_path}")
                QMessageBox.information(
                    self, "完成",
                    f"导出完成！\n\n"
                    f"PDF: {pdf_path}\n"
                    f"PNG目录: {png_dir}\n"
                    f"审计报告: {audit_path}"
                )
                
            except Exception as e:
                QMessageBox.critical(self, "错误", f"导出失败: {str(e)}")
    
    def _on_generate_samples(self):
        """生成示例文件到桌面"""
        desktop = Path.home() / "Desktop" / "标签预检示例"
        desktop.mkdir(parents=True, exist_ok=True)
        
        try:
            create_sample_csv(str(desktop / "示例数据.csv"))
            create_sample_zpl(str(desktop / "示例模板.zpl"))
            create_sample_json_template(str(desktop / "示例模板.json"))
            
            self._update_status(f"示例文件已生成到: {desktop}")
            QMessageBox.information(self, "完成", f"示例文件已生成到:\n{desktop}")
            
        except Exception as e:
            QMessageBox.critical(self, "错误", f"生成失败: {str(e)}")
    
    def _on_about(self):
        """关于"""
        QMessageBox.about(
            self, "关于",
            "热敏标签排版预检台 v1.0.0\n\n"
            "用于仓库打包台的标签预览和校验工具\n\n"
            "功能:\n"
            "- 导入WMS导出的SKU CSV\n"
            "- 加载ZPL/JSON标签模板\n"
            "- 校验条码、必填字段、效期、重复箱号\n"
            "- 预览标签排版\n"
            "- 导出PDF/PNG/CSV/JSON审计包"
        )
    
    def _refresh_all_ui(self):
        """刷新所有UI"""
        self.project_name_edit.setText(self.project.name)
        self.record_count_label.setText(f"{len(self.project.sku_data_list)} 条")
        
        if self.project.template:
            self.template_name_label.setText(self.project.template.name)
        else:
            self.template_name_label.setText("未加载")
        
        self._refresh_data_table()
        self._refresh_template_info()
        self._refresh_error_table()
        
        self.status_label.setText("就绪")
        self.status_label.setStyleSheet("color: green; font-weight: bold;")
    
    def _refresh_data_table(self):
        """刷新数据表格"""
        self.data_table.blockSignals(True)
        
        if not self.project.sku_data_list:
            self.data_table.setRowCount(0)
            self.data_table.setColumnCount(0)
            self.data_table.blockSignals(False)
            return
        
        sample_data = self.project.sku_data_list[0].to_dict()
        headers = list(sample_data.keys())
        
        self.data_table.setColumnCount(len(headers))
        self.data_table.setHorizontalHeaderLabels(headers)
        
        self.data_table.setRowCount(len(self.project.sku_data_list))
        
        for row_idx, sku in enumerate(self.project.sku_data_list):
            data_dict = sku.to_dict()
            
            has_error = False
            has_warning = False
            for vr in self.validation_results:
                if vr.sku_data.row_index == sku.row_index:
                    has_error = vr.has_errors
                    has_warning = vr.has_warnings
                    break
            
            for col_idx, header in enumerate(headers):
                value = str(data_dict.get(header, ''))
                item = QTableWidgetItem(value)
                item.setFlags(item.flags() | Qt.ItemFlag.ItemIsEditable)
                
                if has_error:
                    item.setBackground(Qt.GlobalColor.red)
                    item.setForeground(Qt.GlobalColor.white)
                elif has_warning:
                    item.setBackground(Qt.GlobalColor.yellow)
                
                self.data_table.setItem(row_idx, col_idx, item)
        
        self.data_table.horizontalHeader().setSectionResizeMode(QHeaderView.ResizeMode.Stretch)
        self.data_table.blockSignals(False)
    
    def _refresh_template_info(self):
        """刷新模板信息"""
        if not self.project.template:
            self.template_name_display.setText("-")
            self.template_size_display.setText("-")
            self.template_dpi_display.setText("-")
            self.template_fields_display.setText("-")
            self.template_fields_table.setRowCount(0)
            self.template_raw_text.clear()
            return
        
        t = self.project.template
        self.template_name_display.setText(t.name)
        self.template_size_display.setText(f"{t.width_mm} x {t.height_mm} mm")
        self.template_dpi_display.setText(f"{t.dpi.value} DPI")
        self.template_fields_display.setText(f"{len(t.fields)} 个字段")
        
        self.template_fields_table.setRowCount(len(t.fields))
        for row_idx, field in enumerate(t.fields):
            self.template_fields_table.setItem(row_idx, 0, QTableWidgetItem(field.name))
            self.template_fields_table.setItem(row_idx, 1, QTableWidgetItem(field.field_type))
            self.template_fields_table.setItem(row_idx, 2, QTableWidgetItem(f"{field.x} mm"))
            self.template_fields_table.setItem(row_idx, 3, QTableWidgetItem(f"{field.y} mm"))
            self.template_fields_table.setItem(row_idx, 4, QTableWidgetItem("是" if field.is_required else "否"))
        
        self.template_raw_text.setText(t.raw_content)
    
    def _refresh_error_table(self):
        """刷新错误表格"""
        self.error_table.setRowCount(0)
        
        if not self.validation_results:
            return
        
        all_issues = []
        for vr in self.validation_results:
            for error in vr.errors:
                all_issues.append(('错误', vr.sku_data, error))
            for warning in vr.warnings:
                all_issues.append(('警告', vr.sku_data, warning))
        
        self.error_table.setRowCount(len(all_issues))
        
        for row_idx, (level, sku, issue) in enumerate(all_issues):
            self.error_table.setItem(row_idx, 0, QTableWidgetItem(str(sku.row_index)))
            self.error_table.setItem(row_idx, 1, QTableWidgetItem(sku.box_number or '-'))
            level_item = QTableWidgetItem(level)
            if level == '错误':
                level_item.setForeground(Qt.GlobalColor.red)
            else:
                level_item.setForeground(Qt.GlobalColor.darkYellow)
            self.error_table.setItem(row_idx, 2, level_item)
            self.error_table.setItem(row_idx, 3, QTableWidgetItem(issue.error_code))
            self.error_table.setItem(row_idx, 4, QTableWidgetItem(issue.field or '-'))
            self.error_table.setItem(row_idx, 5, QTableWidgetItem(issue.message))
    
    def _refresh_preview_image(self):
        """刷新预览图像"""
        if not self.current_preview or not self.current_preview.image_data:
            self.preview_label.setText("无法生成预览")
            return
        
        image = QImage.fromData(self.current_preview.image_data)
        pixmap = QPixmap.fromImage(image)
        
        scaled = pixmap.scaled(
            self.preview_label.size(),
            Qt.AspectRatioMode.KeepAspectRatio,
            Qt.TransformationMode.SmoothTransformation
        )
        
        self.preview_label.setPixmap(scaled)
    
    def _refresh_current_info(self, sku: SKUData, vr: Optional[ValidationResult]):
        """刷新当前选中信息"""
        self.current_sku_label.setText(sku.sku or '-')
        self.current_box_label.setText(sku.box_number or '-')
        self.current_batch_label.setText(sku.batch_number or '-')
        self.current_expiry_label.setText(sku.expiry_date or '-')
        
        if vr:
            if vr.has_errors:
                self.validation_status_label.setText(f"失败 ({len(vr.errors)}错误)")
                self.validation_status_label.setStyleSheet("color: red; font-weight: bold;")
            elif vr.has_warnings:
                self.validation_status_label.setText(f"警告 ({len(vr.warnings)}警告)")
                self.validation_status_label.setStyleSheet("color: orange; font-weight: bold;")
            else:
                self.validation_status_label.setText("通过")
                self.validation_status_label.setStyleSheet("color: green; font-weight: bold;")
        else:
            self.validation_status_label.setText("未校验")
            self.validation_status_label.setStyleSheet("color: gray;")
