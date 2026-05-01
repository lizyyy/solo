import os
import sys
from datetime import datetime
from typing import Optional, List, Dict, Any
from PyQt5.QtWidgets import (
    QMainWindow, QWidget, QVBoxLayout, QHBoxLayout,
    QSplitter, QListWidget, QListWidgetItem, QLabel,
    QPushButton, QToolBar, QAction, QMenu, QMenuBar,
    QMessageBox, QFileDialog, QTabWidget, QTableWidget,
    QTableWidgetItem, QHeaderView, QTextEdit, QGroupBox,
    QComboBox, QLineEdit, QFormLayout, QCheckBox, QSpinBox,
    QDoubleSpinBox, QProgressBar, QStatusBar, QFrame,
    QScrollArea, QDialog, QDialogButtonBox, QSplitter
)
from PyQt5.QtCore import Qt, QSize, pyqtSignal, QThread
from PyQt5.QtGui import QIcon, QPixmap, QImage, QFont, QColor

from models import MainDatabase, ProjectDatabase
from core import scan_directory, parse_index_csv, check_rules, run_dry_run
from config import Config


class ProjectLoadWorker(QThread):
    progress = pyqtSignal(str)
    finished = pyqtSignal(dict)
    error = pyqtSignal(str)
    
    def __init__(self, project_data: Dict):
        super().__init__()
        self.project_data = project_data
    
    def run(self):
        try:
            scan_dir = self.project_data.get('scan_directory', '')
            csv_path = self.project_data.get('index_csv_path', '')
            config = self.project_data.get('config', {})
            
            self.progress.emit("正在扫描文件...")
            files = scan_directory(scan_dir, config)
            self.progress.emit(f"已扫描 {len(files)} 个文件")
            
            index_records = []
            if csv_path and os.path.exists(csv_path):
                self.progress.emit("正在解析索引CSV...")
                index_records = parse_index_csv(csv_path, config)
                self.progress.emit(f"已解析 {len(index_records)} 条索引记录")
            
            self.progress.emit("正在执行规则校验...")
            issues = check_rules(files, index_records, config)
            self.progress.emit(f"检测到 {len(issues)} 个问题")
            
            self.finished.emit({
                'files': files,
                'index_records': index_records,
                'issues': issues
            })
            
        except Exception as e:
            self.error.emit(str(e))


class MainWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        
        self.main_db = MainDatabase()
        self.current_project_id: Optional[int] = None
        self.project_db: Optional[ProjectDatabase] = None
        self.current_files: List[Dict] = []
        self.current_index_records: List[Dict] = []
        self.current_issues: List[Dict] = []
        self.load_worker: Optional[ProjectLoadWorker] = None
        
        self.init_ui()
        self.load_projects_list()
    
    def init_ui(self):
        self.setWindowTitle(f"{Config.APP_NAME} v{Config.APP_VERSION}")
        self.setMinimumSize(1400, 900)
        
        self._create_menu_bar()
        self._create_tool_bar()
        self._create_status_bar()
        
        main_widget = QWidget()
        self.setCentralWidget(main_widget)
        
        main_layout = QHBoxLayout(main_widget)
        main_layout.setContentsMargins(5, 5, 5, 5)
        
        splitter = QSplitter(Qt.Horizontal)
        
        left_panel = self._create_left_panel()
        splitter.addWidget(left_panel)
        
        middle_panel = self._create_middle_panel()
        splitter.addWidget(middle_panel)
        
        right_panel = self._create_right_panel()
        splitter.addWidget(right_panel)
        
        splitter.setSizes([250, 600, 350])
        
        main_layout.addWidget(splitter)
    
    def _create_menu_bar(self):
        menubar = self.menuBar()
        
        file_menu = menubar.addMenu('文件(&F)')
        
        new_project_action = QAction('新建项目(&N)', self)
        new_project_action.setShortcut('Ctrl+N')
        new_project_action.triggered.connect(self.show_new_project_dialog)
        file_menu.addAction(new_project_action)
        
        open_project_action = QAction('打开项目(&O)', self)
        open_project_action.setShortcut('Ctrl+O')
        open_project_action.triggered.connect(self.open_selected_project)
        file_menu.addAction(open_project_action)
        
        file_menu.addSeparator()
        
        export_action = QAction('导出交付包(&E)', self)
        export_action.setShortcut('Ctrl+E')
        export_action.triggered.connect(self.show_export_dialog)
        file_menu.addAction(export_action)
        
        file_menu.addSeparator()
        
        exit_action = QAction('退出(&X)', self)
        exit_action.setShortcut('Ctrl+Q')
        exit_action.triggered.connect(self.close)
        file_menu.addAction(exit_action)
        
        view_menu = menubar.addMenu('视图(&V)')
        
        refresh_action = QAction('刷新(&R)', self)
        refresh_action.setShortcut('F5')
        refresh_action.triggered.connect(self.refresh_current_project)
        view_menu.addAction(refresh_action)
        
        help_menu = menubar.addMenu('帮助(&H)')
        
        about_action = QAction('关于(&A)', self)
        about_action.triggered.connect(self.show_about_dialog)
        help_menu.addAction(about_action)
    
    def _create_tool_bar(self):
        toolbar = self.addToolBar('主工具栏')
        toolbar.setIconSize(QSize(24, 24))
        
        new_action = QAction('新建项目', self)
        new_action.triggered.connect(self.show_new_project_dialog)
        toolbar.addAction(new_action)
        
        open_action = QAction('打开', self)
        open_action.triggered.connect(self.open_selected_project)
        toolbar.addAction(open_action)
        
        toolbar.addSeparator()
        
        scan_action = QAction('重新扫描', self)
        scan_action.triggered.connect(self.refresh_current_project)
        toolbar.addAction(scan_action)
        
        toolbar.addSeparator()
        
        export_action = QAction('导出', self)
        export_action.triggered.connect(self.show_export_dialog)
        toolbar.addAction(export_action)
    
    def _create_status_bar(self):
        self.status_bar = QStatusBar()
        self.setStatusBar(self.status_bar)
        
        self.status_label = QLabel("就绪")
        self.status_bar.addWidget(self.status_label)
        
        self.progress_bar = QProgressBar()
        self.progress_bar.setVisible(False)
        self.status_bar.addPermanentWidget(self.progress_bar)
    
    def _create_left_panel(self) -> QWidget:
        panel = QWidget()
        layout = QVBoxLayout(panel)
        layout.setContentsMargins(0, 0, 0, 0)
        
        header = QLabel("项目列表")
        header.setStyleSheet("font-weight: bold; font-size: 14px; padding: 5px;")
        layout.addWidget(header)
        
        toolbar = QHBoxLayout()
        
        self.new_project_btn = QPushButton("新建")
        self.new_project_btn.clicked.connect(self.show_new_project_dialog)
        toolbar.addWidget(self.new_project_btn)
        
        self.delete_project_btn = QPushButton("删除")
        self.delete_project_btn.clicked.connect(self.delete_selected_project)
        toolbar.addWidget(self.delete_project_btn)
        
        layout.addLayout(toolbar)
        
        self.projects_list = QListWidget()
        self.projects_list.itemDoubleClicked.connect(self.on_project_double_clicked)
        self.projects_list.currentRowChanged.connect(self.on_project_selected)
        layout.addWidget(self.projects_list)
        
        stats_group = QGroupBox("当前项目统计")
        stats_layout = QFormLayout(stats_group)
        
        self.stats_files_label = QLabel("0")
        stats_layout.addRow("文件数:", self.stats_files_label)
        
        self.stats_index_label = QLabel("0")
        stats_layout.addRow("索引记录:", self.stats_index_label)
        
        self.stats_issues_label = QLabel("0")
        stats_layout.addRow("问题数:", self.stats_issues_label)
        
        self.stats_pending_label = QLabel("0")
        stats_layout.addRow("待审核:", self.stats_pending_label)
        
        layout.addWidget(stats_group)
        
        return panel
    
    def _create_middle_panel(self) -> QWidget:
        panel = QWidget()
        layout = QVBoxLayout(panel)
        layout.setContentsMargins(0, 0, 0, 0)
        
        tabs = QTabWidget()
        
        files_tab = self._create_files_tab()
        tabs.addTab(files_tab, "文件列表")
        
        issues_tab = self._create_issues_tab()
        tabs.addTab(issues_tab, "问题列表")
        
        preview_tab = self._create_preview_tab()
        tabs.addTab(preview_tab, "预览")
        
        layout.addWidget(tabs)
        
        return panel
    
    def _create_files_tab(self) -> QWidget:
        tab = QWidget()
        layout = QVBoxLayout(tab)
        
        filter_layout = QHBoxLayout()
        
        filter_layout.addWidget(QLabel("筛选:"))
        
        self.file_case_filter = QComboBox()
        self.file_case_filter.addItem("全部案卷")
        self.file_case_filter.currentTextChanged.connect(self.filter_files)
        filter_layout.addWidget(self.file_case_filter)
        
        self.file_type_filter = QComboBox()
        self.file_type_filter.addItem("全部类型")
        self.file_type_filter.addItems(['jpg', 'jpeg', 'png', 'tiff', 'tif', 'pdf'])
        self.file_type_filter.currentTextChanged.connect(self.filter_files)
        filter_layout.addWidget(self.file_type_filter)
        
        filter_layout.addStretch()
        
        layout.addLayout(filter_layout)
        
        self.files_table = QTableWidget()
        self.files_table.setColumnCount(8)
        self.files_table.setHorizontalHeaderLabels([
            "文件名", "案卷号", "页码", "盒号", "分辨率", "方向", "空白页", "大小"
        ])
        self.files_table.horizontalHeader().setSectionResizeMode(0, QHeaderView.Stretch)
        self.files_table.setSelectionBehavior(QTableWidget.SelectRows)
        self.files_table.setEditTriggers(QTableWidget.NoEditTriggers)
        self.files_table.itemSelectionChanged.connect(self.on_file_selected)
        
        layout.addWidget(self.files_table)
        
        return tab
    
    def _create_issues_tab(self) -> QWidget:
        tab = QWidget()
        layout = QVBoxLayout(tab)
        
        filter_layout = QHBoxLayout()
        
        filter_layout.addWidget(QLabel("筛选:"))
        
        self.issue_status_filter = QComboBox()
        self.issue_status_filter.addItem("全部状态")
        for key, value in Config.REVIEW_STATUSES.items():
            self.issue_status_filter.addItem(value, key)
        self.issue_status_filter.currentTextChanged.connect(self.filter_issues)
        filter_layout.addWidget(self.issue_status_filter)
        
        self.issue_type_filter = QComboBox()
        self.issue_type_filter.addItem("全部类型")
        for key, value in Config.ISSUE_TYPES.items():
            self.issue_type_filter.addItem(value, key)
        self.issue_type_filter.currentTextChanged.connect(self.filter_issues)
        filter_layout.addWidget(self.issue_type_filter)
        
        filter_layout.addStretch()
        
        layout.addLayout(filter_layout)
        
        self.issues_table = QTableWidget()
        self.issues_table.setColumnCount(6)
        self.issues_table.setHorizontalHeaderLabels([
            "问题类型", "严重程度", "描述", "关联文件", "状态", "审核时间"
        ])
        self.issues_table.horizontalHeader().setSectionResizeMode(2, QHeaderView.Stretch)
        self.issues_table.setSelectionBehavior(QTableWidget.SelectRows)
        self.issues_table.setEditTriggers(QTableWidget.NoEditTriggers)
        self.issues_table.itemSelectionChanged.connect(self.on_issue_selected)
        
        layout.addWidget(self.issues_table)
        
        return tab
    
    def _create_preview_tab(self) -> QWidget:
        tab = QWidget()
        layout = QVBoxLayout(tab)
        
        self.preview_label = QLabel("选择文件以预览")
        self.preview_label.setAlignment(Qt.AlignCenter)
        self.preview_label.setStyleSheet("border: 1px solid #ccc; background-color: #f5f5f5;")
        self.preview_label.setMinimumSize(400, 300)
        
        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        scroll.setWidget(self.preview_label)
        
        layout.addWidget(scroll)
        
        info_group = QGroupBox("文件信息")
        info_layout = QFormLayout(info_group)
        
        self.preview_filename = QLabel("-")
        info_layout.addRow("文件名:", self.preview_filename)
        
        self.preview_path = QLabel("-")
        self.preview_path.setWordWrap(True)
        info_layout.addRow("路径:", self.preview_path)
        
        self.preview_size = QLabel("-")
        info_layout.addRow("大小:", self.preview_size)
        
        self.preview_resolution = QLabel("-")
        info_layout.addRow("分辨率:", self.preview_resolution)
        
        self.preview_orientation = QLabel("-")
        info_layout.addRow("方向:", self.preview_orientation)
        
        self.preview_blank = QLabel("-")
        info_layout.addRow("空白页:", self.preview_blank)
        
        layout.addWidget(info_group)
        
        return tab
    
    def _create_right_panel(self) -> QWidget:
        panel = QWidget()
        layout = QVBoxLayout(panel)
        layout.setContentsMargins(0, 0, 0, 0)
        
        header = QLabel("人工复核面板")
        header.setStyleSheet("font-weight: bold; font-size: 14px; padding: 5px;")
        layout.addWidget(header)
        
        issue_group = QGroupBox("当前问题")
        issue_layout = QVBoxLayout(issue_group)
        
        self.issue_type_label = QLabel("-")
        self.issue_type_label.setStyleSheet("font-weight: bold;")
        issue_layout.addWidget(self.issue_type_label)
        
        self.issue_desc_edit = QTextEdit()
        self.issue_desc_edit.setReadOnly(True)
        self.issue_desc_edit.setMaximumHeight(100)
        issue_layout.addWidget(self.issue_desc_edit)
        
        info_form = QFormLayout()
        self.issue_severity_label = QLabel("-")
        info_form.addRow("严重程度:", self.issue_severity_label)
        
        self.issue_affected_label = QLabel("-")
        self.issue_affected_label.setWordWrap(True)
        info_form.addRow("影响:", self.issue_affected_label)
        
        issue_layout.addLayout(info_form)
        
        layout.addWidget(issue_group)
        
        review_group = QGroupBox("审核操作")
        review_layout = QVBoxLayout(review_group)
        
        review_layout.addWidget(QLabel("审核状态:"))
        
        self.review_status_combo = QComboBox()
        for key, value in Config.REVIEW_STATUSES.items():
            self.review_status_combo.addItem(value, key)
        review_layout.addWidget(self.review_status_combo)
        
        review_layout.addWidget(QLabel("备注:"))
        
        self.review_note_edit = QTextEdit()
        self.review_note_edit.setPlaceholderText("输入审核备注...")
        self.review_note_edit.setMaximumHeight(80)
        review_layout.addWidget(self.review_note_edit)
        
        btn_layout = QHBoxLayout()
        
        self.apply_review_btn = QPushButton("应用审核")
        self.apply_review_btn.clicked.connect(self.apply_review)
        btn_layout.addWidget(self.apply_review_btn)
        
        self.next_issue_btn = QPushButton("下一个问题")
        self.next_issue_btn.clicked.connect(self.go_to_next_issue)
        btn_layout.addWidget(self.next_issue_btn)
        
        review_layout.addLayout(btn_layout)
        
        layout.addWidget(review_group)
        
        batch_group = QGroupBox("批量操作")
        batch_layout = QVBoxLayout(batch_group)
        
        self.batch_status_combo = QComboBox()
        for key, value in Config.REVIEW_STATUSES.items():
            self.batch_status_combo.addItem(value, key)
        batch_layout.addWidget(self.batch_status_combo)
        
        self.batch_apply_btn = QPushButton("批量应用到筛选结果")
        self.batch_apply_btn.clicked.connect(self.apply_batch_review)
        batch_layout.addWidget(self.batch_apply_btn)
        
        layout.addWidget(batch_group)
        
        layout.addStretch()
        
        return panel
    
    def load_projects_list(self):
        self.projects_list.clear()
        
        projects = self.main_db.list_projects()
        
        for project in projects:
            item = QListWidgetItem(project['name'])
            item.setData(Qt.UserRole, project)
            self.projects_list.addItem(item)
        
        self.update_status(f"已加载 {len(projects)} 个项目")
    
    def show_new_project_dialog(self):
        dialog = NewProjectDialog(self)
        if dialog.exec_() == QDialog.Accepted:
            project_data = dialog.get_project_data()
            self.create_project(project_data)
    
    def create_project(self, project_data: Dict):
        try:
            project_id = self.main_db.create_project(
                name=project_data['name'],
                scan_directory=project_data['scan_directory'],
                index_csv_path=project_data.get('index_csv_path'),
                config=project_data.get('config', {})
            )
            
            self.current_project_id = project_id
            self.project_db = ProjectDatabase(project_id)
            
            self.load_project_data(project_data)
            
            self.load_projects_list()
            
            for i in range(self.projects_list.count()):
                item = self.projects_list.item(i)
                data = item.data(Qt.UserRole)
                if data and data.get('id') == project_id:
                    self.projects_list.setCurrentRow(i)
                    break
            
        except Exception as e:
            QMessageBox.critical(self, "错误", f"创建项目失败: {str(e)}")
    
    def load_project_data(self, project_data: Dict):
        self.progress_bar.setVisible(True)
        self.progress_bar.setRange(0, 0)
        
        self.load_worker = ProjectLoadWorker(project_data)
        self.load_worker.progress.connect(self.on_load_progress)
        self.load_worker.finished.connect(self.on_load_finished)
        self.load_worker.error.connect(self.on_load_error)
        self.load_worker.start()
    
    def on_load_progress(self, message: str):
        self.update_status(message)
    
    def on_load_finished(self, data: Dict):
        self.progress_bar.setVisible(False)
        
        self.current_files = data.get('files', [])
        self.current_index_records = data.get('index_records', [])
        self.current_issues = data.get('issues', [])
        
        if self.project_db:
            self.project_db.clear_files()
            self.project_db.clear_index_records()
            self.project_db.clear_issues()
            
            if self.current_files:
                self.project_db.batch_add_files(self.current_files)
            
            if self.current_index_records:
                self.project_db.batch_add_index_records(self.current_index_records)
            
            if self.current_issues:
                self.project_db.batch_add_issues(self.current_issues)
        
        self.refresh_display()
        
        self.update_status(f"项目加载完成: {len(self.current_files)} 个文件, {len(self.current_issues)} 个问题")
    
    def on_load_error(self, error: str):
        self.progress_bar.setVisible(False)
        QMessageBox.critical(self, "加载失败", f"加载项目数据时出错: {error}")
        self.update_status("加载失败")
    
    def on_project_double_clicked(self, item: QListWidgetItem):
        self.open_selected_project()
    
    def on_project_selected(self, row: int):
        pass
    
    def open_selected_project(self):
        current_item = self.projects_list.currentItem()
        if not current_item:
            QMessageBox.information(self, "提示", "请先选择一个项目")
            return
        
        project = current_item.data(Qt.UserRole)
        if not project:
            return
        
        self.current_project_id = project['id']
        self.project_db = ProjectDatabase(self.current_project_id)
        
        self.current_files = self.project_db.get_all_files()
        self.current_index_records = self.project_db.get_all_index_records()
        self.current_issues = self.project_db.get_issues()
        
        self.refresh_display()
        
        self.update_status(f"已打开项目: {project['name']}")
    
    def refresh_current_project(self):
        if not self.current_project_id:
            QMessageBox.information(self, "提示", "请先打开一个项目")
            return
        
        project = self.main_db.get_project(self.current_project_id)
        if not project:
            return
        
        self.load_project_data(project)
    
    def refresh_display(self):
        self.update_stats()
        self.refresh_files_table()
        self.refresh_issues_table()
        self.refresh_filters()
    
    def update_stats(self):
        self.stats_files_label.setText(str(len(self.current_files)))
        self.stats_index_label.setText(str(len(self.current_index_records)))
        self.stats_issues_label.setText(str(len(self.current_issues)))
        
        pending_count = sum(1 for i in self.current_issues if i.get('review_status') == 'pending')
        self.stats_pending_label.setText(str(pending_count))
    
    def refresh_files_table(self):
        self.files_table.setRowCount(0)
        
        self.files_table.setRowCount(len(self.current_files))
        
        for row, f in enumerate(self.current_files):
            self.files_table.setItem(row, 0, QTableWidgetItem(f['filename']))
            self.files_table.setItem(row, 1, QTableWidgetItem(f.get('extracted_case_number') or '-'))
            self.files_table.setItem(row, 2, QTableWidgetItem(str(f.get('extracted_page_number') or '-')))
            self.files_table.setItem(row, 3, QTableWidgetItem(f.get('extracted_box_number') or '-'))
            self.files_table.setItem(row, 4, QTableWidgetItem(str(f.get('resolution') or '-')))
            
            orient = f.get('orientation')
            orient_text = '横版' if orient == 'landscape' else '竖版' if orient == 'portrait' else '-'
            self.files_table.setItem(row, 5, QTableWidgetItem(orient_text))
            
            blank_text = '是' if f.get('is_blank') else '否'
            self.files_table.setItem(row, 6, QTableWidgetItem(blank_text))
            
            size_kb = (f.get('size') or 0) / 1024
            self.files_table.setItem(row, 7, QTableWidgetItem(f"{size_kb:.1f} KB"))
        
        self.files_table.resizeColumnsToContents()
    
    def refresh_issues_table(self):
        self.issues_table.setRowCount(0)
        
        self.issues_table.setRowCount(len(self.current_issues))
        
        for row, issue in enumerate(self.current_issues):
            issue_type = issue.get('issue_type', '')
            type_text = Config.ISSUE_TYPES.get(issue_type, issue_type)
            self.issues_table.setItem(row, 0, QTableWidgetItem(type_text))
            
            severity = issue.get('severity', 'warning')
            severity_item = QTableWidgetItem(severity)
            if severity == 'error':
                severity_item.setForeground(QColor('red'))
            self.issues_table.setItem(row, 1, severity_item)
            
            self.issues_table.setItem(row, 2, QTableWidgetItem(issue.get('description', '-')))
            
            affected = issue.get('affected_files', [])
            affected_text = ', '.join(affected) if affected else '-'
            self.issues_table.setItem(row, 3, QTableWidgetItem(affected_text))
            
            status = issue.get('review_status', 'pending')
            status_text = Config.REVIEW_STATUSES.get(status, status)
            self.issues_table.setItem(row, 4, QTableWidgetItem(status_text))
            
            reviewed_at = issue.get('reviewed_at', '-')
            self.issues_table.setItem(row, 5, QTableWidgetItem(str(reviewed_at)))
        
        self.issues_table.resizeColumnsToContents()
    
    def refresh_filters(self):
        current_case = self.file_case_filter.currentText()
        
        self.file_case_filter.blockSignals(True)
        self.file_case_filter.clear()
        self.file_case_filter.addItem("全部案卷")
        
        case_numbers = set()
        for f in self.current_files:
            case = f.get('extracted_case_number')
            if case:
                case_numbers.add(case)
        
        for case in sorted(case_numbers):
            self.file_case_filter.addItem(case)
        
        self.file_case_filter.blockSignals(False)
    
    def filter_files(self):
        case_filter = self.file_case_filter.currentText()
        type_filter = self.file_type_filter.currentText().lower()
        
        for row in range(self.files_table.rowCount()):
            show = True
            
            if case_filter != "全部案卷":
                item = self.files_table.item(row, 1)
                if item and item.text() != case_filter:
                    show = False
            
            if type_filter != "全部类型":
                filename_item = self.files_table.item(row, 0)
                if filename_item:
                    filename = filename_item.text().lower()
                    if not filename.endswith(f'.{type_filter}'):
                        show = False
            
            self.files_table.setRowHidden(row, not show)
    
    def filter_issues(self):
        status_filter = self.issue_status_filter.currentData()
        type_filter = self.issue_type_filter.currentData()
        
        for row in range(self.issues_table.rowCount()):
            show = True
            
            if status_filter and row < len(self.current_issues):
                issue = self.current_issues[row]
                if issue.get('review_status') != status_filter:
                    show = False
            
            if type_filter and row < len(self.current_issues):
                issue = self.current_issues[row]
                if issue.get('issue_type') != type_filter:
                    show = False
            
            self.issues_table.setRowHidden(row, not show)
    
    def on_file_selected(self):
        selected_rows = self.files_table.selectedIndexes()
        if not selected_rows:
            return
        
        row = selected_rows[0].row()
        if row >= len(self.current_files):
            return
        
        f = self.current_files[row]
        self.show_file_preview(f)
    
    def on_issue_selected(self):
        selected_rows = self.issues_table.selectedIndexes()
        if not selected_rows:
            return
        
        row = selected_rows[0].row()
        if row >= len(self.current_issues):
            return
        
        issue = self.current_issues[row]
        self.show_issue_details(issue)
    
    def show_file_preview(self, f: Dict):
        filepath = f.get('filepath', '')
        
        self.preview_filename.setText(f.get('filename', '-'))
        self.preview_path.setText(filepath)
        
        size_kb = (f.get('size') or 0) / 1024
        self.preview_size.setText(f"{size_kb:.1f} KB")
        
        self.preview_resolution.setText(str(f.get('resolution') or '-'))
        
        orient = f.get('orientation')
        orient_text = '横版' if orient == 'landscape' else '竖版' if orient == 'portrait' else '-'
        self.preview_orientation.setText(orient_text)
        
        blank_text = f"是 ({f.get('blank_confidence', 0):.2%})" if f.get('is_blank') else '否'
        self.preview_blank.setText(blank_text)
        
        if os.path.exists(filepath):
            try:
                ext = os.path.splitext(filepath)[1].lower()
                
                if ext in {'.jpg', '.jpeg', '.png', '.tiff', '.tif'}:
                    pixmap = QPixmap(filepath)
                    scaled = pixmap.scaled(
                        self.preview_label.size() - QSize(20, 20),
                        Qt.KeepAspectRatio,
                        Qt.SmoothTransformation
                    )
                    self.preview_label.setPixmap(scaled)
                
                elif ext == '.pdf':
                    import fitz
                    doc = fitz.open(filepath)
                    if len(doc) > 0:
                        page = doc[0]
                        zoom = 2
                        mat = fitz.Matrix(zoom, zoom)
                        pix = page.get_pixmap(matrix=mat)
                        
                        img = QImage(pix.samples, pix.width, pix.height, pix.stride, QImage.Format_RGB888)
                        pixmap = QPixmap.fromImage(img)
                        
                        scaled = pixmap.scaled(
                            self.preview_label.size() - QSize(20, 20),
                            Qt.KeepAspectRatio,
                            Qt.SmoothTransformation
                        )
                        self.preview_label.setPixmap(scaled)
                    
                    doc.close()
                
            except Exception as e:
                self.preview_label.setText(f"无法预览: {str(e)}")
        else:
            self.preview_label.setText("文件不存在")
    
    def show_issue_details(self, issue: Dict):
        issue_type = issue.get('issue_type', '')
        type_text = Config.ISSUE_TYPES.get(issue_type, issue_type)
        self.issue_type_label.setText(type_text)
        
        self.issue_desc_edit.setPlainText(issue.get('description', ''))
        
        severity = issue.get('severity', 'warning')
        self.issue_severity_label.setText(severity)
        
        affected = issue.get('affected_files', [])
        affected_text = ', '.join(affected) if affected else '-'
        self.issue_affected_label.setText(affected_text)
        
        status = issue.get('review_status', 'pending')
        index = self.review_status_combo.findData(status)
        if index >= 0:
            self.review_status_combo.setCurrentIndex(index)
        
        self.review_note_edit.setPlainText(issue.get('review_note') or '')
    
    def apply_review(self):
        selected_rows = self.issues_table.selectedIndexes()
        if not selected_rows:
            QMessageBox.information(self, "提示", "请先选择一个问题")
            return
        
        row = selected_rows[0].row()
        if row >= len(self.current_issues):
            return
        
        issue = self.current_issues[row]
        issue_id = issue.get('id')
        
        if not issue_id or not self.project_db:
            return
        
        status = self.review_status_combo.currentData()
        note = self.review_note_edit.toPlainText()
        
        self.project_db.update_issue_review(issue_id, status, note)
        
        issue['review_status'] = status
        issue['review_note'] = note
        issue['reviewed_at'] = datetime.now().isoformat()
        
        self.refresh_issues_table()
        self.update_stats()
        
        self.update_status(f"已更新审核状态: {Config.REVIEW_STATUSES.get(status, status)}")
    
    def go_to_next_issue(self):
        current_row = self.issues_table.currentRow()
        next_row = current_row + 1
        
        while next_row < self.issues_table.rowCount():
            if not self.issues_table.isRowHidden(next_row):
                self.issues_table.selectRow(next_row)
                return
            next_row += 1
        
        QMessageBox.information(self, "提示", "已经是最后一个问题")
    
    def apply_batch_review(self):
        status = self.batch_status_combo.currentData()
        
        count = 0
        for row in range(self.issues_table.rowCount()):
            if not self.issues_table.isRowHidden(row):
                if row < len(self.current_issues):
                    issue = self.current_issues[row]
                    issue_id = issue.get('id')
                    
                    if issue_id and self.project_db:
                        self.project_db.update_issue_review(issue_id, status, None)
                        issue['review_status'] = status
                        count += 1
        
        self.refresh_issues_table()
        self.update_stats()
        
        self.update_status(f"已批量更新 {count} 个问题的审核状态")
    
    def delete_selected_project(self):
        current_item = self.projects_list.currentItem()
        if not current_item:
            QMessageBox.information(self, "提示", "请先选择一个项目")
            return
        
        project = current_item.data(Qt.UserRole)
        if not project:
            return
        
        reply = QMessageBox.question(
            self, "确认删除",
            f"确定要删除项目 \"{project['name']}\" 吗？\n此操作不可撤销。",
            QMessageBox.Yes | QMessageBox.No
        )
        
        if reply == QMessageBox.Yes:
            project_id = project['id']
            
            self.main_db.delete_project(project_id)
            
            db_path = Config.get_db_path(project_id)
            if os.path.exists(db_path):
                try:
                    os.remove(db_path)
                except:
                    pass
            
            if self.current_project_id == project_id:
                self.current_project_id = None
                self.project_db = None
                self.current_files = []
                self.current_index_records = []
                self.current_issues = []
                self.refresh_display()
            
            self.load_projects_list()
            self.update_status(f"已删除项目: {project['name']}")
    
    def show_export_dialog(self):
        if not self.current_project_id:
            QMessageBox.information(self, "提示", "请先打开一个项目")
            return
        
        dialog = ExportDialog(self, self.current_files, self.current_issues)
        dialog.exec_()
    
    def show_about_dialog(self):
        QMessageBox.about(
            self, "关于",
            f"{Config.APP_NAME} v{Config.APP_VERSION}\n\n"
            f"档案数字化外包质量检查工具\n\n"
            f"功能:\n"
            f"- 扫描目录中的图片和PDF文件\n"
            f"- 解析索引CSV文件\n"
            f"- 自动检测缺页、重复、分辨率问题等\n"
            f"- 人工复核问题并记录状态\n"
            f"- 导出合格文件到交付包"
        )
    
    def update_status(self, message: str):
        self.status_label.setText(message)


class NewProjectDialog(QDialog):
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setWindowTitle("新建项目")
        self.setMinimumWidth(500)
        self.init_ui()
    
    def init_ui(self):
        layout = QVBoxLayout(self)
        
        form = QFormLayout()
        
        self.name_edit = QLineEdit()
        self.name_edit.setPlaceholderText("例如: 2024年第一批次合同扫描")
        form.addRow("项目名称:", self.name_edit)
        
        dir_layout = QHBoxLayout()
        self.scan_dir_edit = QLineEdit()
        self.scan_dir_edit.setPlaceholderText("选择扫描文件所在的目录")
        self.browse_dir_btn = QPushButton("浏览...")
        self.browse_dir_btn.clicked.connect(self.browse_scan_directory)
        dir_layout.addWidget(self.scan_dir_edit)
        dir_layout.addWidget(self.browse_dir_btn)
        form.addRow("扫描目录:", dir_layout)
        
        csv_layout = QHBoxLayout()
        self.csv_edit = QLineEdit()
        self.csv_edit.setPlaceholderText("(可选) 选择索引CSV文件")
        self.browse_csv_btn = QPushButton("浏览...")
        self.browse_csv_btn.clicked.connect(self.browse_csv_file)
        csv_layout.addWidget(self.csv_edit)
        csv_layout.addWidget(self.browse_csv_btn)
        form.addRow("索引CSV:", csv_layout)
        
        layout.addLayout(form)
        
        config_group = QGroupBox("高级配置")
        config_layout = QFormLayout(config_group)
        
        self.resolution_spin = QSpinBox()
        self.resolution_spin.setRange(72, 1200)
        self.resolution_spin.setValue(300)
        self.resolution_spin.setSuffix(" DPI")
        config_layout.addRow("最低分辨率:", self.resolution_spin)
        
        self.blank_threshold_spin = QDoubleSpinBox()
        self.blank_threshold_spin.setRange(0.5, 1.0)
        self.blank_threshold_spin.setSingleStep(0.01)
        self.blank_threshold_spin.setValue(0.95)
        config_layout.addRow("空白页阈值:", self.blank_threshold_spin)
        
        layout.addWidget(config_group)
        
        buttons = QDialogButtonBox(
            QDialogButtonBox.Ok | QDialogButtonBox.Cancel
        )
        buttons.accepted.connect(self.accept)
        buttons.rejected.connect(self.reject)
        layout.addWidget(buttons)
    
    def browse_scan_directory(self):
        dir_path = QFileDialog.getExistingDirectory(self, "选择扫描目录")
        if dir_path:
            self.scan_dir_edit.setText(dir_path)
            
            if not self.name_edit.text().strip():
                dir_name = os.path.basename(dir_path)
                self.name_edit.setText(dir_name)
    
    def browse_csv_file(self):
        file_path, _ = QFileDialog.getOpenFileName(
            self, "选择索引CSV文件", "", "CSV文件 (*.csv);;所有文件 (*)"
        )
        if file_path:
            self.csv_edit.setText(file_path)
    
    def get_project_data(self) -> Dict:
        return {
            'name': self.name_edit.text().strip(),
            'scan_directory': self.scan_dir_edit.text().strip(),
            'index_csv_path': self.csv_edit.text().strip() or None,
            'config': {
                'min_resolution': self.resolution_spin.value(),
                'blank_page_threshold': self.blank_threshold_spin.value()
            }
        }


class ExportDialog(QDialog):
    def __init__(self, parent=None, files: List[Dict] = None, issues: List[Dict] = None):
        super().__init__(parent)
        self.setWindowTitle("导出交付包")
        self.setMinimumWidth(600)
        self.setMinimumHeight(500)
        
        self.files = files or []
        self.issues = issues or []
        self.dry_run_result: Optional[Dict] = None
        
        self.init_ui()
    
    def init_ui(self):
        layout = QVBoxLayout(self)
        
        target_layout = QHBoxLayout()
        
        target_layout.addWidget(QLabel("导出目录:"))
        
        self.target_dir_edit = QLineEdit()
        self.target_dir_edit.setPlaceholderText("选择导出目标目录")
        target_layout.addWidget(self.target_dir_edit)
        
        self.browse_target_btn = QPushButton("浏览...")
        self.browse_target_btn.clicked.connect(self.browse_target_directory)
        target_layout.addWidget(self.browse_target_btn)
        
        layout.addLayout(target_layout)
        
        options_group = QGroupBox("导出选项")
        options_layout = QFormLayout(options_group)
        
        self.approved_only_check = QCheckBox("仅导出已审核通过的文件")
        self.approved_only_check.setChecked(True)
        options_layout.addRow(self.approved_only_check)
        
        self.overwrite_check = QCheckBox("覆盖已存在的文件")
        self.overwrite_check.setChecked(False)
        options_layout.addRow(self.overwrite_check)
        
        layout.addWidget(options_group)
        
        preview_group = QGroupBox("导出预览 (Dry Run)")
        preview_layout = QVBoxLayout(preview_group)
        
        self.dry_run_btn = QPushButton("运行模拟导出 (Dry Run)")
        self.dry_run_btn.clicked.connect(self.run_dry_run)
        preview_layout.addWidget(self.dry_run_btn)
        
        self.preview_text = QTextEdit()
        self.preview_text.setReadOnly(True)
        self.preview_text.setPlaceholderText("点击\"运行模拟导出\"查看导出计划...")
        preview_layout.addWidget(self.preview_text)
        
        layout.addWidget(preview_group)
        
        buttons = QHBoxLayout()
        
        self.export_btn = QPushButton("开始导出")
        self.export_btn.setEnabled(False)
        self.export_btn.clicked.connect(self.do_export)
        buttons.addWidget(self.export_btn)
        
        buttons.addStretch()
        
        cancel_btn = QPushButton("取消")
        cancel_btn.clicked.connect(self.reject)
        buttons.addWidget(cancel_btn)
        
        layout.addLayout(buttons)
    
    def browse_target_directory(self):
        dir_path = QFileDialog.getExistingDirectory(self, "选择导出目录")
        if dir_path:
            self.target_dir_edit.setText(dir_path)
    
    def run_dry_run(self):
        target_dir = self.target_dir_edit.text().strip()
        if not target_dir:
            QMessageBox.warning(self, "提示", "请先选择导出目录")
            return
        
        self.preview_text.setPlainText("正在运行模拟导出...")
        
        try:
            self.dry_run_result = run_dry_run(
                self.files, self.issues, target_dir
            )
            
            self.export_btn.setEnabled(True)
            
            preview_text = self._format_dry_run_result(self.dry_run_result)
            self.preview_text.setPlainText(preview_text)
            
        except Exception as e:
            self.preview_text.setPlainText(f"模拟导出失败: {str(e)}")
    
    def _format_dry_run_result(self, result: Dict) -> str:
        lines = []
        
        lines.append(f"导出目录: {result['target_directory']}")
        lines.append(f"预计导出文件数: {result['total_files']}")
        lines.append("")
        
        if result['warnings']:
            lines.append("=" * 50)
            lines.append("警告:")
            for warning in result['warnings']:
                lines.append(f"  ⚠️ {warning}")
            lines.append("")
        
        if result['will_override']:
            lines.append("=" * 50)
            lines.append("以下文件将被覆盖:")
            for filepath in result['existing_files'][:10]:
                lines.append(f"  - {filepath}")
            if len(result['existing_files']) > 10:
                lines.append(f"  ... 还有 {len(result['existing_files']) - 10} 个文件")
            lines.append("")
        
        if result['plans']:
            lines.append("=" * 50)
            lines.append("导出计划:")
            
            by_case = {}
            for plan in result['plans']:
                case = plan.get('case_number') or '未分类'
                if case not in by_case:
                    by_case[case] = []
                by_case[case].append(plan)
            
            for case, plans in by_case.items():
                lines.append(f"  [{case}]: {len(plans)} 个文件")
                for plan in plans[:3]:
                    lines.append(f"    - {plan['filename']}")
                if len(plans) > 3:
                    lines.append(f"    ... 还有 {len(plans) - 3} 个文件")
        
        return "\n".join(lines)
    
    def do_export(self):
        if not self.dry_run_result:
            QMessageBox.warning(self, "提示", "请先运行模拟导出")
            return
        
        target_dir = self.target_dir_edit.text().strip()
        if not target_dir:
            return
        
        if self.dry_run_result['will_override'] and not self.overwrite_check.isChecked():
            reply = QMessageBox.question(
                self, "确认覆盖",
                f"导出目录中已存在 {len(self.dry_run_result['existing_files'])} 个文件。\n"
                f"是否继续？这些文件将被覆盖。",
                QMessageBox.Yes | QMessageBox.No
            )
            if reply != QMessageBox.Yes:
                return
        
        try:
            from core import ExportManager
            
            manager = ExportManager(self.files, self.issues)
            plans = manager.create_export_plan(
                target_dir,
                include_only_approved=self.approved_only_check.isChecked()
            )
            
            manifest_path, copied_files = manager.execute_export(plans)
            
            QMessageBox.information(
                self, "导出成功",
                f"成功导出 {len(copied_files)} 个文件\n"
                f"导出目录: {target_dir}\n"
                f"Manifest: {manifest_path}"
            )
            
            self.accept()
            
        except Exception as e:
            QMessageBox.critical(self, "导出失败", f"导出时发生错误: {str(e)}")
