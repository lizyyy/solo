import sys
import os
from pathlib import Path
from typing import List, Dict, Any, Optional
from datetime import datetime

from PyQt6.QtWidgets import (
    QMainWindow, QWidget, QVBoxLayout, QHBoxLayout,
    QMenuBar, QMenu, QToolBar, QStatusBar, QSplitter,
    QMessageBox, QFileDialog, QDialog, QTabWidget,
    QLabel, QPushButton, QLineEdit, QComboBox,
    QTableWidget, QTableWidgetItem, QHeaderView,
    QGroupBox, QFormLayout, QSpinBox, QCheckBox,
    QTextEdit, QProgressBar, QSplitter, QListWidget,
    QListWidgetItem, QFrame, QSizePolicy, QDialogButtonBox
)
from PyQt6.QtCore import Qt, QThread, pyqtSignal, QTimer
from PyQt6.QtGui import QAction, QIcon, QFont, QColor

from config.settings import settings_manager
from db.database import db_manager
from db.models import Project, AudioFile, ValidationIssue, Episode, TaskHistory
from core.audio_scanner import audio_scanner, ScanStatus
from core.validator import validation_engine, ValidationResult
from core.task_queue import task_manager, TaskType
from core.exporter import exporter
from utils.audio_utils import format_duration, format_file_size


class ScanWorker(QThread):
    progress_signal = pyqtSignal(int, int, str)
    finished_signal = pyqtSignal(bool, str, int)
    
    def __init__(self, folder_path: str, project_id: int):
        super().__init__()
        self.folder_path = folder_path
        self.project_id = project_id
    
    def run(self):
        try:
            def progress_callback(current: int, total: int, message: str):
                self.progress_signal.emit(current, total, message)
            
            files = audio_scanner.scan_folder(
                self.folder_path,
                self.project_id,
                progress_callback=progress_callback,
                recursive=True,
                compute_hash=True
            )
            
            self.finished_signal.emit(True, f"扫描完成，共发现 {len(files)} 个音频文件", len(files))
            
        except Exception as e:
            self.finished_signal.emit(False, str(e), 0)


class ValidateWorker(QThread):
    progress_signal = pyqtSignal(str)
    finished_signal = pyqtSignal(bool, str, dict)
    
    def __init__(self, project_id: int):
        super().__init__()
        self.project_id = project_id
    
    def run(self):
        try:
            self.progress_signal.emit("正在校验采样率...")
            result = validation_engine.validate_project(
                self.project_id,
                check_sample_rate=True,
                check_roles=True,
                check_duplicates=True,
                check_silence=True,
                check_channels=True
            )
            
            summary = {
                "total_issues": len(result.issues),
                "errors": sum(1 for i in result.issues if i["severity"] == "error"),
                "warnings": sum(1 for i in result.issues if i["severity"] == "warning"),
                "infos": sum(1 for i in result.issues if i["severity"] == "info"),
            }
            
            self.finished_signal.emit(
                True, 
                f"校验完成，共发现 {len(result.issues)} 个问题",
                summary
            )
            
        except Exception as e:
            self.finished_signal.emit(False, str(e), {})


class MainWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        
        self.current_project_id: Optional[int] = None
        self.current_project: Optional[Project] = None
        self.scan_worker: Optional[ScanWorker] = None
        self.validate_worker: Optional[ValidateWorker] = None
        self.audio_files: List[AudioFile] = []
        self.issues: List[ValidationIssue] = []
        
        self._init_ui()
        self._init_menu_bar()
        self._init_tool_bar()
        self._init_status_bar()
        
        self._load_recent_projects()
        self._start_task_monitor()
    
    def _init_ui(self):
        self.setWindowTitle("多轨素材交付台")
        self.setMinimumSize(1200, 800)
        
        central_widget = QWidget()
        self.setCentralWidget(central_widget)
        
        main_layout = QHBoxLayout(central_widget)
        main_layout.setContentsMargins(0, 0, 0, 0)
        main_layout.setSpacing(0)
        
        splitter = QSplitter(Qt.Orientation.Horizontal)
        
        left_panel = self._create_left_panel()
        left_panel.setMinimumWidth(250)
        splitter.addWidget(left_panel)
        
        right_panel = self._create_right_panel()
        splitter.addWidget(right_panel)
        
        splitter.setSizes([300, 900])
        
        main_layout.addWidget(splitter)
    
    def _create_left_panel(self) -> QWidget:
        panel = QWidget()
        layout = QVBoxLayout(panel)
        
        project_group = QGroupBox("项目信息")
        project_layout = QVBoxLayout(project_group)
        
        self.project_name_label = QLabel("当前项目: 无")
        self.project_name_label.setWordWrap(True)
        project_layout.addWidget(self.project_name_label)
        
        self.project_path_label = QLabel("")
        self.project_path_label.setWordWrap(True)
        self.project_path_label.setStyleSheet("color: gray; font-size: 11px;")
        project_layout.addWidget(self.project_path_label)
        
        btn_layout = QHBoxLayout()
        
        self.open_project_btn = QPushButton("打开项目")
        self.open_project_btn.clicked.connect(self._open_project)
        btn_layout.addWidget(self.open_project_btn)
        
        self.scan_btn = QPushButton("扫描素材")
        self.scan_btn.clicked.connect(self._scan_audio_files)
        self.scan_btn.setEnabled(False)
        btn_layout.addWidget(self.scan_btn)
        
        project_layout.addLayout(btn_layout)
        
        layout.addWidget(project_group)
        
        recent_group = QGroupBox("最近项目")
        recent_layout = QVBoxLayout(recent_group)
        
        self.recent_list = QListWidget()
        self.recent_list.itemDoubleClicked.connect(self._open_recent_project)
        recent_layout.addWidget(self.recent_list)
        
        layout.addWidget(recent_group)
        
        stats_group = QGroupBox("统计信息")
        stats_layout = QFormLayout(stats_group)
        
        self.total_files_label = QLabel("0")
        stats_layout.addRow("总文件数:", self.total_files_label)
        
        self.total_duration_label = QLabel("00:00")
        stats_layout.addRow("总时长:", self.total_duration_label)
        
        self.total_size_label = QLabel("0 B")
        stats_layout.addRow("总大小:", self.total_size_label)
        
        self.issues_count_label = QLabel("0")
        stats_layout.addRow("问题数:", self.issues_count_label)
        
        layout.addWidget(stats_group)
        
        layout.addStretch()
        
        return panel
    
    def _create_right_panel(self) -> QWidget:
        panel = QWidget()
        layout = QVBoxLayout(panel)
        
        self.tab_widget = QTabWidget()
        
        self.material_tab = self._create_material_tab()
        self.tab_widget.addTab(self.material_tab, "素材清单")
        
        self.issues_tab = self._create_issues_tab()
        self.tab_widget.addTab(self.issues_tab, "问题清单")
        
        self.tasks_tab = self._create_tasks_tab()
        self.tab_widget.addTab(self.tasks_tab, "任务队列")
        
        self.history_tab = self._create_history_tab()
        self.tab_widget.addTab(self.history_tab, "操作历史")
        
        layout.addWidget(self.tab_widget)
        
        bottom_bar = QHBoxLayout()
        
        self.validate_btn = QPushButton("校验素材")
        self.validate_btn.clicked.connect(self._validate_files)
        self.validate_btn.setEnabled(False)
        bottom_bar.addWidget(self.validate_btn)
        
        self.export_md_btn = QPushButton("导出交付单")
        self.export_md_btn.clicked.connect(self._export_delivery_note)
        self.export_md_btn.setEnabled(False)
        bottom_bar.addWidget(self.export_md_btn)
        
        self.export_csv_btn = QPushButton("导出问题清单")
        self.export_csv_btn.clicked.connect(self._export_issues_csv)
        self.export_csv_btn.setEnabled(False)
        bottom_bar.addWidget(self.export_csv_btn)
        
        bottom_bar.addStretch()
        
        self.progress_bar = QProgressBar()
        self.progress_bar.setVisible(False)
        bottom_bar.addWidget(self.progress_bar)
        
        self.status_label = QLabel("就绪")
        bottom_bar.addWidget(self.status_label)
        
        layout.addLayout(bottom_bar)
        
        return panel
    
    def _create_material_tab(self) -> QWidget:
        widget = QWidget()
        layout = QVBoxLayout(widget)
        
        filter_layout = QHBoxLayout()
        
        filter_layout.addWidget(QLabel("角色:"))
        self.role_filter_combo = QComboBox()
        self.role_filter_combo.addItem("全部", "")
        self.role_filter_combo.currentIndexChanged.connect(self._filter_materials)
        filter_layout.addWidget(self.role_filter_combo)
        
        filter_layout.addWidget(QLabel("状态:"))
        self.status_filter_combo = QComboBox()
        self.status_filter_combo.addItem("全部", "")
        self.status_filter_combo.currentIndexChanged.connect(self._filter_materials)
        filter_layout.addWidget(self.status_filter_combo)
        
        filter_layout.addStretch()
        
        layout.addLayout(filter_layout)
        
        self.material_table = QTableWidget()
        self.material_table.setColumnCount(10)
        self.material_table.setHorizontalHeaderLabels([
            "文件名", "角色", "格式", "采样率", "声道", 
            "时长", "大小", "剪辑状态", "交付版本", "问题"
        ])
        self.material_table.horizontalHeader().setSectionResizeMode(QHeaderView.ResizeMode.Interactive)
        self.material_table.horizontalHeader().setSectionResizeMode(0, QHeaderView.ResizeMode.Stretch)
        self.material_table.setSelectionBehavior(QTableWidget.SelectionBehavior.SelectRows)
        self.material_table.setSelectionMode(QTableWidget.SelectionMode.SingleSelection)
        self.material_table.itemSelectionChanged.connect(self._on_material_selected)
        
        layout.addWidget(self.material_table)
        
        detail_group = QGroupBox("素材详情")
        detail_layout = QFormLayout(detail_group)
        
        self.detail_file_label = QLabel("-")
        detail_layout.addRow("文件:", self.detail_file_label)
        
        self.detail_path_label = QLabel("-")
        self.detail_path_label.setWordWrap(True)
        detail_layout.addRow("路径:", self.detail_path_label)
        
        role_layout = QHBoxLayout()
        self.detail_role_combo = QComboBox()
        self.detail_role_combo.addItems([
            "", "主持人", "嘉宾", "片头", "片尾", "广告", "远程录音", "其他"
        ])
        role_layout.addWidget(self.detail_role_combo)
        
        self.apply_role_btn = QPushButton("应用")
        self.apply_role_btn.clicked.connect(self._apply_role_change)
        role_layout.addWidget(self.apply_role_btn)
        
        detail_layout.addRow("角色:", role_layout)
        
        edit_layout = QHBoxLayout()
        self.detail_status_combo = QComboBox()
        self.detail_status_combo.addItems([
            "未剪辑", "剪辑中", "已完成", "已交付"
        ])
        edit_layout.addWidget(self.detail_status_combo)
        
        self.apply_status_btn = QPushButton("应用")
        self.apply_status_btn.clicked.connect(self._apply_status_change)
        edit_layout.addWidget(self.apply_status_btn)
        
        detail_layout.addRow("剪辑状态:", edit_layout)
        
        layout.addWidget(detail_group)
        
        return widget
    
    def _create_issues_tab(self) -> QWidget:
        widget = QWidget()
        layout = QVBoxLayout(widget)
        
        self.issues_table = QTableWidget()
        self.issues_table.setColumnCount(6)
        self.issues_table.setHorizontalHeaderLabels([
            "严重程度", "问题类型", "文件名", "描述", "检测时间", "状态"
        ])
        self.issues_table.horizontalHeader().setSectionResizeMode(QHeaderView.ResizeMode.Interactive)
        self.issues_table.horizontalHeader().setSectionResizeMode(3, QHeaderView.ResizeMode.Stretch)
        self.issues_table.setSelectionBehavior(QTableWidget.SelectionBehavior.SelectRows)
        
        layout.addWidget(self.issues_table)
        
        return widget
    
    def _create_tasks_tab(self) -> QWidget:
        widget = QWidget()
        layout = QVBoxLayout(widget)
        
        action_layout = QHBoxLayout()
        
        action_layout.addWidget(QLabel("选中项操作:"))
        
        self.add_transcode_btn = QPushButton("加入转码队列")
        self.add_transcode_btn.clicked.connect(self._add_to_transcode_queue)
        action_layout.addWidget(self.add_transcode_btn)
        
        self.add_archive_btn = QPushButton("加入归档队列")
        self.add_archive_btn.clicked.connect(self._add_to_archive_queue)
        action_layout.addWidget(self.add_archive_btn)
        
        action_layout.addStretch()
        
        layout.addLayout(action_layout)
        
        self.queue_table = QTableWidget()
        self.queue_table.setColumnCount(5)
        self.queue_table.setHorizontalHeaderLabels([
            "任务类型", "文件名", "状态", "创建时间", "完成时间"
        ])
        self.queue_table.horizontalHeader().setSectionResizeMode(QHeaderView.ResizeMode.Stretch)
        
        layout.addWidget(self.queue_table)
        
        return widget
    
    def _create_history_tab(self) -> QWidget:
        widget = QWidget()
        layout = QVBoxLayout(widget)
        
        self.history_table = QTableWidget()
        self.history_table.setColumnCount(6)
        self.history_table.setHorizontalHeaderLabels([
            "时间", "任务类型", "源文件", "目标文件", "状态", "耗时"
        ])
        self.history_table.horizontalHeader().setSectionResizeMode(QHeaderView.ResizeMode.Interactive)
        self.history_table.horizontalHeader().setSectionResizeMode(2, QHeaderView.ResizeMode.Stretch)
        
        layout.addWidget(self.history_table)
        
        return widget
    
    def _init_menu_bar(self):
        menubar = self.menuBar()
        
        file_menu = menubar.addMenu("文件(&F)")
        
        open_action = QAction("打开项目(&O)", self)
        open_action.setShortcut("Ctrl+O")
        open_action.triggered.connect(self._open_project)
        file_menu.addAction(open_action)
        
        self.recent_menu = file_menu.addMenu("最近项目")
        
        file_menu.addSeparator()
        
        exit_action = QAction("退出(&X)", self)
        exit_action.setShortcut("Ctrl+Q")
        exit_action.triggered.connect(self.close)
        file_menu.addAction(exit_action)
        
        edit_menu = menubar.addMenu("编辑(&E)")
        
        scan_action = QAction("扫描素材(&S)", self)
        scan_action.setShortcut("F5")
        scan_action.triggered.connect(self._scan_audio_files)
        edit_menu.addAction(scan_action)
        
        validate_action = QAction("校验素材(&V)", self)
        validate_action.setShortcut("F6")
        validate_action.triggered.connect(self._validate_files)
        edit_menu.addAction(validate_action)
        
        export_menu = menubar.addMenu("导出(&E)")
        
        export_md_action = QAction("导出 Markdown 交付单", self)
        export_md_action.triggered.connect(self._export_delivery_note)
        export_menu.addAction(export_md_action)
        
        export_csv_action = QAction("导出问题清单 CSV", self)
        export_csv_action.triggered.connect(self._export_issues_csv)
        export_menu.addAction(export_csv_action)
        
        export_material_action = QAction("导出素材清单 CSV", self)
        export_material_action.triggered.connect(self._export_material_csv)
        export_menu.addAction(export_material_action)
        
        help_menu = menubar.addMenu("帮助(&H)")
        
        about_action = QAction("关于(&A)", self)
        about_action.triggered.connect(self._show_about)
        help_menu.addAction(about_action)
    
    def _init_tool_bar(self):
        toolbar = self.addToolBar("主工具栏")
        toolbar.setMovable(False)
        
        open_action = QAction("打开项目", self)
        open_action.triggered.connect(self._open_project)
        toolbar.addAction(open_action)
        
        toolbar.addSeparator()
        
        scan_action = QAction("扫描", self)
        scan_action.triggered.connect(self._scan_audio_files)
        toolbar.addAction(scan_action)
        
        validate_action = QAction("校验", self)
        validate_action.triggered.connect(self._validate_files)
        toolbar.addAction(validate_action)
        
        toolbar.addSeparator()
        
        export_action = QAction("导出交付单", self)
        export_action.triggered.connect(self._export_delivery_note)
        toolbar.addAction(export_action)
    
    def _init_status_bar(self):
        self.statusBar().showMessage("就绪")
    
    def _start_task_monitor(self):
        self.task_timer = QTimer()
        self.task_timer.timeout.connect(self._refresh_tasks)
        self.task_timer.start(2000)
    
    def _load_recent_projects(self):
        recent = settings_manager.get_recent_projects()
        self.recent_list.clear()
        
        for path in recent:
            name = Path(path).name
            item = QListWidgetItem(f"{name}")
            item.setData(Qt.ItemDataRole.UserRole, path)
            self.recent_list.addItem(item)
        
        self.recent_menu.clear()
        for path in recent:
            name = Path(path).name
            action = QAction(name, self)
            action.setData(path)
            action.triggered.connect(lambda checked, p=path: self._open_project_by_path(p))
            self.recent_menu.addAction(action)
    
    def _open_project(self):
        folder_path = QFileDialog.getExistingDirectory(
            self,
            "选择项目文件夹",
            "",
            QFileDialog.Option.ShowDirsOnly
        )
        
        if folder_path:
            self._open_project_by_path(folder_path)
    
    def _open_recent_project(self, item: QListWidgetItem):
        path = item.data(Qt.ItemDataRole.UserRole)
        if path and Path(path).exists():
            self._open_project_by_path(path)
        else:
            QMessageBox.warning(self, "警告", f"项目路径不存在: {path}")
            self._load_recent_projects()
    
    def _open_project_by_path(self, folder_path: str):
        folder_path = str(Path(folder_path).resolve())
        
        db_path = settings_manager.get_db_path(folder_path)
        if not db_manager.init_database(db_path):
            QMessageBox.critical(self, "错误", "无法初始化数据库")
            return
        
        project_name = Path(folder_path).name
        project = db_manager.create_project(project_name, folder_path)
        
        if not project:
            QMessageBox.critical(self, "错误", "无法创建项目记录")
            return
        
        self.current_project_id = project.id
        self.current_project = project
        
        settings_manager.add_recent_project(folder_path)
        
        self.project_name_label.setText(f"当前项目: {project_name}")
        self.project_path_label.setText(folder_path)
        
        self.scan_btn.setEnabled(True)
        self.validate_btn.setEnabled(True)
        self.export_md_btn.setEnabled(True)
        self.export_csv_btn.setEnabled(True)
        
        self._load_audio_files()
        self._load_issues()
        self._load_task_history()
        self._load_recent_projects()
        
        self.statusBar().showMessage(f"已打开项目: {project_name}")
    
    def _scan_audio_files(self):
        if not self.current_project:
            QMessageBox.warning(self, "警告", "请先打开项目")
            return
        
        if self.scan_worker and self.scan_worker.isRunning():
            QMessageBox.warning(self, "警告", "扫描正在进行中")
            return
        
        self.progress_bar.setVisible(True)
        self.progress_bar.setRange(0, 0)
        self.status_label.setText("正在扫描...")
        self.scan_btn.setEnabled(False)
        
        self.scan_worker = ScanWorker(self.current_project.folder_path, self.current_project_id)
        self.scan_worker.progress_signal.connect(self._on_scan_progress)
        self.scan_worker.finished_signal.connect(self._on_scan_finished)
        self.scan_worker.start()
    
    def _on_scan_progress(self, current: int, total: int, message: str):
        if total > 0:
            self.progress_bar.setRange(0, total)
            self.progress_bar.setValue(current)
        self.status_label.setText(message)
    
    def _on_scan_finished(self, success: bool, message: str, count: int):
        self.progress_bar.setVisible(False)
        self.scan_btn.setEnabled(True)
        
        if success:
            self.status_label.setText(message)
            self._load_audio_files()
            
            if settings_manager.get_settings().auto_validate_on_scan and count > 0:
                self._validate_files()
        else:
            self.status_label.setText(f"扫描失败: {message}")
            QMessageBox.critical(self, "错误", f"扫描失败: {message}")
    
    def _validate_files(self):
        if not self.current_project:
            QMessageBox.warning(self, "警告", "请先打开项目")
            return
        
        if self.validate_worker and self.validate_worker.isRunning():
            QMessageBox.warning(self, "警告", "校验正在进行中")
            return
        
        self.progress_bar.setVisible(True)
        self.progress_bar.setRange(0, 0)
        self.status_label.setText("正在校验...")
        self.validate_btn.setEnabled(False)
        
        self.validate_worker = ValidateWorker(self.current_project_id)
        self.validate_worker.progress_signal.connect(self._on_validate_progress)
        self.validate_worker.finished_signal.connect(self._on_validate_finished)
        self.validate_worker.start()
    
    def _on_validate_progress(self, message: str):
        self.status_label.setText(message)
    
    def _on_validate_finished(self, success: bool, message: str, summary: dict):
        self.progress_bar.setVisible(False)
        self.validate_btn.setEnabled(True)
        
        if success:
            self.status_label.setText(message)
            self._load_issues()
            
            errors = summary.get("errors", 0)
            warnings = summary.get("warnings", 0)
            
            if errors > 0 or warnings > 0:
                self.tab_widget.setCurrentIndex(1)
                QMessageBox.information(
                    self, "校验完成", 
                    f"发现 {errors} 个错误，{warnings} 个警告"
                )
        else:
            self.status_label.setText(f"校验失败: {message}")
            QMessageBox.critical(self, "错误", f"校验失败: {message}")
    
    def _load_audio_files(self):
        if not self.current_project_id:
            return
        
        self.audio_files = db_manager.get_audio_files_by_project(self.current_project_id)
        
        self.material_table.setRowCount(len(self.audio_files))
        
        roles = set()
        statuses = set()
        
        for row, af in enumerate(self.audio_files):
            if af.role:
                roles.add(af.role)
            if af.editing_status:
                statuses.add(af.editing_status)
            
            self.material_table.setItem(row, 0, QTableWidgetItem(af.file_name))
            self.material_table.setItem(row, 1, QTableWidgetItem(af.role or ""))
            
            format_item = QTableWidgetItem(af.format.upper() if af.format else "")
            self.material_table.setItem(row, 2, format_item)
            
            sample_rate_item = QTableWidgetItem(f"{af.sample_rate} Hz" if af.sample_rate else "")
            self.material_table.setItem(row, 3, sample_rate_item)
            
            channels_item = QTableWidgetItem(f"{af.channels}ch" if af.channels else "")
            self.material_table.setItem(row, 4, channels_item)
            
            duration_item = QTableWidgetItem(format_duration(af.duration_seconds))
            self.material_table.setItem(row, 5, duration_item)
            
            size_item = QTableWidgetItem(format_file_size(af.file_size))
            self.material_table.setItem(row, 6, size_item)
            
            status_item = QTableWidgetItem(af.editing_status or "未剪辑")
            self.material_table.setItem(row, 7, status_item)
            
            version_item = QTableWidgetItem(af.delivery_version or "")
            self.material_table.setItem(row, 8, version_item)
            
            issues = [i for i in self.issues if i.audio_file_id == af.id and not i.resolved]
            issue_count = len(issues)
            
            if issue_count > 0:
                has_error = any(i.severity == "error" for i in issues)
                issue_item = QTableWidgetItem(f"⚠️ {issue_count}")
                if has_error:
                    issue_item.setForeground(QColor("red"))
                else:
                    issue_item.setForeground(QColor("orange"))
            else:
                issue_item = QTableWidgetItem("✅")
            
            self.material_table.setItem(row, 9, issue_item)
        
        current_role = self.role_filter_combo.currentData()
        current_status = self.status_filter_combo.currentData()
        
        self.role_filter_combo.blockSignals(True)
        self.role_filter_combo.clear()
        self.role_filter_combo.addItem("全部", "")
        for role in sorted(roles):
            self.role_filter_combo.addItem(role, role)
        
        if current_role:
            index = self.role_filter_combo.findData(current_role)
            if index >= 0:
                self.role_filter_combo.setCurrentIndex(index)
        self.role_filter_combo.blockSignals(False)
        
        self.status_filter_combo.blockSignals(True)
        self.status_filter_combo.clear()
        self.status_filter_combo.addItem("全部", "")
        for status in sorted(statuses):
            self.status_filter_combo.addItem(status, status)
        
        if current_status:
            index = self.status_filter_combo.findData(current_status)
            if index >= 0:
                self.status_filter_combo.setCurrentIndex(index)
        self.status_filter_combo.blockSignals(False)
        
        self._update_statistics()
    
    def _update_statistics(self):
        total_files = len(self.audio_files)
        total_duration = sum(af.duration_seconds or 0 for af in self.audio_files)
        total_size = sum(af.file_size or 0 for af in self.audio_files)
        issue_count = len([i for i in self.issues if not i.resolved])
        
        self.total_files_label.setText(str(total_files))
        self.total_duration_label.setText(format_duration(total_duration))
        self.total_size_label.setText(format_file_size(total_size))
        self.issues_count_label.setText(str(issue_count))
    
    def _load_issues(self):
        if not self.current_project_id:
            return
        
        self.issues = db_manager.get_issues_by_project(self.current_project_id)
        
        self.issues_table.setRowCount(len(self.issues))
        
        for row, issue in enumerate(self.issues):
            severity_item = QTableWidgetItem(issue.severity)
            if issue.severity == "error":
                severity_item.setForeground(QColor("red"))
            elif issue.severity == "warning":
                severity_item.setForeground(QColor("orange"))
            self.issues_table.setItem(row, 0, severity_item)
            
            type_name = validation_engine._get_issue_type_name(issue.issue_type)
            self.issues_table.setItem(row, 1, QTableWidgetItem(type_name))
            
            af = next((af for af in self.audio_files if af.id == issue.audio_file_id), None)
            file_name = af.file_name if af else "未知文件"
            self.issues_table.setItem(row, 2, QTableWidgetItem(file_name))
            
            self.issues_table.setItem(row, 3, QTableWidgetItem(issue.description))
            
            time_str = issue.detected_at.strftime("%Y-%m-%d %H:%M") if issue.detected_at else ""
            self.issues_table.setItem(row, 4, QTableWidgetItem(time_str))
            
            status_str = "已解决" if issue.resolved else "未解决"
            self.issues_table.setItem(row, 5, QTableWidgetItem(status_str))
        
        self._update_statistics()
    
    def _load_task_history(self):
        if not self.current_project_id:
            return
        
        history = db_manager.get_task_history(self.current_project_id, 50)
        
        self.history_table.setRowCount(len(history))
        
        for row, item in enumerate(history):
            time_str = item.created_at.strftime("%Y-%m-%d %H:%M:%S") if item.created_at else ""
            self.history_table.setItem(row, 0, QTableWidgetItem(time_str))
            
            self.history_table.setItem(row, 1, QTableWidgetItem(item.task_type))
            
            source_name = Path(item.source_file).name if item.source_file else ""
            self.history_table.setItem(row, 2, QTableWidgetItem(source_name))
            
            target_name = Path(item.target_file).name if item.target_file else ""
            self.history_table.setItem(row, 3, QTableWidgetItem(target_name))
            
            self.history_table.setItem(row, 4, QTableWidgetItem(item.status))
            
            duration_str = f"{item.duration_seconds:.1f} 秒" if item.duration_seconds else ""
            self.history_table.setItem(row, 5, QTableWidgetItem(duration_str))
    
    def _filter_materials(self):
        role_filter = self.role_filter_combo.currentData()
        status_filter = self.status_filter_combo.currentData()
        
        for row in range(self.material_table.rowCount()):
            role_item = self.material_table.item(row, 1)
            status_item = self.material_table.item(row, 7)
            
            role_match = not role_filter or (role_item and role_item.text() == role_filter)
            status_match = not status_filter or (status_item and status_item.text() == status_filter)
            
            self.material_table.setRowHidden(row, not (role_match and status_match))
    
    def _on_material_selected(self):
        selected = self.material_table.selectedItems()
        if not selected:
            return
        
        row = selected[0].row()
        if row < 0 or row >= len(self.audio_files):
            return
        
        af = self.audio_files[row]
        
        self.detail_file_label.setText(af.file_name)
        self.detail_path_label.setText(af.file_path)
        
        index = self.detail_role_combo.findText(af.role or "")
        if index >= 0:
            self.detail_role_combo.setCurrentIndex(index)
        
        index = self.detail_status_combo.findText(af.editing_status or "未剪辑")
        if index >= 0:
            self.detail_status_combo.setCurrentIndex(index)
    
    def _apply_role_change(self):
        selected = self.material_table.selectedItems()
        if not selected:
            return
        
        row = selected[0].row()
        if row < 0 or row >= len(self.audio_files):
            return
        
        af = self.audio_files[row]
        new_role = self.detail_role_combo.currentText()
        
        if db_manager.update_audio_file(af.id, {"role": new_role}):
            af.role = new_role
            self._load_audio_files()
            self.statusBar().showMessage(f"已更新角色: {new_role}")
        else:
            QMessageBox.warning(self, "警告", "更新失败")
    
    def _apply_status_change(self):
        selected = self.material_table.selectedItems()
        if not selected:
            return
        
        row = selected[0].row()
        if row < 0 or row >= len(self.audio_files):
            return
        
        af = self.audio_files[row]
        new_status = self.detail_status_combo.currentText()
        
        if db_manager.update_audio_file(af.id, {"editing_status": new_status}):
            af.editing_status = new_status
            self._load_audio_files()
            self.statusBar().showMessage(f"已更新状态: {new_status}")
        else:
            QMessageBox.warning(self, "警告", "更新失败")
    
    def _refresh_tasks(self):
        if not self.current_project_id:
            return
        
        pending = db_manager.get_pending_tasks(self.current_project_id)
        
        self.queue_table.setRowCount(len(pending))
        
        for row, task in enumerate(pending):
            self.queue_table.setItem(row, 0, QTableWidgetItem(task.task_type))
            
            af = next((af for af in self.audio_files if af.id == task.audio_file_id), None)
            file_name = af.file_name if af else ""
            self.queue_table.setItem(row, 1, QTableWidgetItem(file_name))
            
            self.queue_table.setItem(row, 2, QTableWidgetItem(task.status))
            
            created_str = task.created_at.strftime("%H:%M:%S") if task.created_at else ""
            self.queue_table.setItem(row, 3, QTableWidgetItem(created_str))
            
            completed_str = task.completed_at.strftime("%H:%M:%S") if task.completed_at else ""
            self.queue_table.setItem(row, 4, QTableWidgetItem(completed_str))
    
    def _add_to_transcode_queue(self):
        selected = self.material_table.selectedItems()
        if not selected:
            QMessageBox.warning(self, "警告", "请先选择素材")
            return
        
        if not task_manager.is_ffmpeg_available():
            QMessageBox.warning(self, "警告", "ffmpeg 未安装，无法进行转码")
            return
        
        row = selected[0].row()
        if row < 0 or row >= len(self.audio_files):
            return
        
        af = self.audio_files[row]
        
        dialog = TranscodeDialog(self)
        if dialog.exec() == QDialog.DialogCode.Accepted:
            task_id = task_manager.add_transcode_task(
                project_id=self.current_project_id,
                audio_file_id=af.id,
                target_format=dialog.target_format,
                target_sample_rate=dialog.target_sample_rate,
                target_channels=dialog.target_channels,
                output_folder=dialog.output_folder
            )
            
            if task_id:
                self.statusBar().showMessage(f"已添加转码任务: {af.file_name}")
                self._refresh_tasks()
            else:
                QMessageBox.warning(self, "警告", "添加任务失败")
    
    def _add_to_archive_queue(self):
        selected = self.material_table.selectedItems()
        if not selected:
            QMessageBox.warning(self, "警告", "请先选择素材")
            return
        
        row = selected[0].row()
        if row < 0 or row >= len(self.audio_files):
            return
        
        af = self.audio_files[row]
        
        dialog = ArchiveDialog(self)
        if dialog.exec() == QDialog.DialogCode.Accepted:
            task_id = task_manager.add_archive_task(
                project_id=self.current_project_id,
                audio_file_id=af.id,
                output_folder=dialog.output_folder,
                keep_original=dialog.keep_original
            )
            
            if task_id:
                self.statusBar().showMessage(f"已添加归档任务: {af.file_name}")
                self._refresh_tasks()
            else:
                QMessageBox.warning(self, "警告", "添加任务失败")
    
    def _export_delivery_note(self):
        if not self.current_project:
            QMessageBox.warning(self, "警告", "请先打开项目")
            return
        
        default_path = exporter.generate_default_output_path(
            self.current_project.folder_path,
            "delivery_note"
        )
        
        file_path, _ = QFileDialog.getSaveFileName(
            self,
            "导出交付单",
            default_path,
            "Markdown 文件 (*.md)"
        )
        
        if file_path:
            success = exporter.export_markdown_delivery_note(
                self.current_project_id,
                file_path,
                include_issues=True,
                include_statistics=True
            )
            
            if success:
                self.statusBar().showMessage(f"已导出: {file_path}")
                QMessageBox.information(self, "成功", f"交付单已导出到:\n{file_path}")
            else:
                QMessageBox.critical(self, "错误", "导出失败")
    
    def _export_issues_csv(self):
        if not self.current_project:
            QMessageBox.warning(self, "警告", "请先打开项目")
            return
        
        default_path = exporter.generate_default_output_path(
            self.current_project.folder_path,
            "issues"
        )
        
        file_path, _ = QFileDialog.getSaveFileName(
            self,
            "导出问题清单",
            default_path,
            "CSV 文件 (*.csv)"
        )
        
        if file_path:
            success = exporter.export_csv_issues(
                self.current_project_id,
                file_path,
                include_resolved=False
            )
            
            if success:
                self.statusBar().showMessage(f"已导出: {file_path}")
                QMessageBox.information(self, "成功", f"问题清单已导出到:\n{file_path}")
            else:
                QMessageBox.critical(self, "错误", "导出失败")
    
    def _export_material_csv(self):
        if not self.current_project:
            QMessageBox.warning(self, "警告", "请先打开项目")
            return
        
        default_path = exporter.generate_default_output_path(
            self.current_project.folder_path,
            "materials"
        )
        
        file_path, _ = QFileDialog.getSaveFileName(
            self,
            "导出素材清单",
            default_path,
            "CSV 文件 (*.csv)"
        )
        
        if file_path:
            success = exporter.export_csv_material_list(
                self.current_project_id,
                file_path
            )
            
            if success:
                self.statusBar().showMessage(f"已导出: {file_path}")
                QMessageBox.information(self, "成功", f"素材清单已导出到:\n{file_path}")
            else:
                QMessageBox.critical(self, "错误", "导出失败")
    
    def _show_about(self):
        QMessageBox.about(
            self,
            "关于 多轨素材交付台",
            "多轨素材交付台 v1.0.0\n\n"
            "一个为播客剪辑师设计的音频素材管理工具\n\n"
            "功能:\n"
            "- 扫描项目文件夹中的音频文件\n"
            "- 解析 wav/mp3/m4a 元数据\n"
            "- 校验采样率、角色轨、静音等问题\n"
            "- 管理转码/归档任务队列\n"
            "- 导出 Markdown 交付单和 CSV 清单"
        )
    
    def closeEvent(self, event):
        if self.scan_worker and self.scan_worker.isRunning():
            self.scan_worker.wait()
        
        if self.validate_worker and self.validate_worker.isRunning():
            self.validate_worker.wait()
        
        task_manager.stop_worker()
        
        if hasattr(self, 'task_timer'):
            self.task_timer.stop()
        
        db_manager.close()
        
        event.accept()


class TranscodeDialog(QDialog):
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setWindowTitle("转码设置")
        self.setMinimumWidth(400)
        
        layout = QVBoxLayout(self)
        
        form = QFormLayout()
        
        self.format_combo = QComboBox()
        self.format_combo.addItems(["wav", "mp3", "m4a", "flac"])
        form.addRow("目标格式:", self.format_combo)
        
        self.sample_rate_combo = QComboBox()
        self.sample_rate_combo.addItems(["保持不变", "44100 Hz", "48000 Hz", "96000 Hz"])
        form.addRow("采样率:", self.sample_rate_combo)
        
        self.channels_combo = QComboBox()
        self.channels_combo.addItems(["保持不变", "单声道 (1ch)", "立体声 (2ch)"])
        form.addRow("声道:", self.channels_combo)
        
        layout.addLayout(form)
        
        output_group = QGroupBox("输出设置")
        output_layout = QVBoxLayout(output_group)
        
        output_folder_layout = QHBoxLayout()
        self.output_folder_edit = QLineEdit()
        output_folder_layout.addWidget(self.output_folder_edit)
        
        browse_btn = QPushButton("浏览...")
        browse_btn.clicked.connect(self._browse_output_folder)
        output_folder_layout.addWidget(browse_btn)
        
        output_layout.addLayout(output_folder_layout)
        
        layout.addWidget(output_group)
        
        buttons = QDialogButtonBox(
            QDialogButtonBox.StandardButton.Ok | QDialogButtonBox.StandardButton.Cancel
        )
        buttons.accepted.connect(self.accept)
        buttons.rejected.connect(self.reject)
        layout.addWidget(buttons)
    
    def _browse_output_folder(self):
        folder = QFileDialog.getExistingDirectory(self, "选择输出文件夹")
        if folder:
            self.output_folder_edit.setText(folder)
    
    @property
    def target_format(self) -> str:
        return self.format_combo.currentText()
    
    @property
    def target_sample_rate(self) -> Optional[int]:
        text = self.sample_rate_combo.currentText()
        if text == "保持不变":
            return None
        return int(text.split()[0])
    
    @property
    def target_channels(self) -> Optional[int]:
        text = self.channels_combo.currentText()
        if text == "保持不变":
            return None
        return 1 if "单声道" in text else 2
    
    @property
    def output_folder(self) -> Optional[str]:
        text = self.output_folder_edit.text().strip()
        return text if text else None


class ArchiveDialog(QDialog):
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setWindowTitle("归档设置")
        self.setMinimumWidth(400)
        
        layout = QVBoxLayout(self)
        
        output_group = QGroupBox("输出设置")
        output_layout = QVBoxLayout(output_group)
        
        output_folder_layout = QHBoxLayout()
        output_folder_layout.addWidget(QLabel("输出文件夹:"))
        self.output_folder_edit = QLineEdit()
        output_folder_layout.addWidget(self.output_folder_edit)
        
        browse_btn = QPushButton("浏览...")
        browse_btn.clicked.connect(self._browse_output_folder)
        output_folder_layout.addWidget(browse_btn)
        
        output_layout.addLayout(output_folder_layout)
        
        self.keep_original_check = QCheckBox("保留原始文件")
        self.keep_original_check.setChecked(True)
        output_layout.addWidget(self.keep_original_check)
        
        layout.addWidget(output_group)
        
        buttons = QDialogButtonBox(
            QDialogButtonBox.StandardButton.Ok | QDialogButtonBox.StandardButton.Cancel
        )
        buttons.accepted.connect(self.accept)
        buttons.rejected.connect(self.reject)
        layout.addWidget(buttons)
    
    def _browse_output_folder(self):
        folder = QFileDialog.getExistingDirectory(self, "选择归档文件夹")
        if folder:
            self.output_folder_edit.setText(folder)
    
    @property
    def output_folder(self) -> Optional[str]:
        text = self.output_folder_edit.text().strip()
        return text if text else None
    
    @property
    def keep_original(self) -> bool:
        return self.keep_original_check.isChecked()
