from PyQt6.QtWidgets import (
    QMainWindow, QWidget, QVBoxLayout, QHBoxLayout,
    QSplitter, QMenuBar, QMenu, QStatusBar, QToolBar,
    QMessageBox, QFileDialog
)
from PyQt6.QtCore import Qt, QSize
from PyQt6.QtGui import QAction, QIcon

from config.settings import get_settings
from models.database import init_db
from ui.widgets import OrderListWidget, KanbanWidget, DetailWidget
from ui.dialogs import PatientDialog, OrderDialog, ImportCSVDialog, ExportDialog
from core.patient_repository import PatientRepository
from core.order_repository import OrderRepository
from core.import_export.csv_import import CSVImporter
from core.import_export.csv_export import CSVExporter


class MainWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        
        self.settings = get_settings()
        init_db()
        
        self.patient_repo = PatientRepository()
        self.order_repo = OrderRepository()
        
        self.current_order_id = None
        
        self.setWindowTitle(f"{self.settings.app_name} v{self.settings.app_version}")
        self.setMinimumSize(1400, 800)
        
        self._create_menu_bar()
        self._create_tool_bar()
        self._create_status_bar()
        self._create_central_widget()
        
        self._connect_signals()
        
        self._load_data()
    
    def _create_menu_bar(self):
        menu_bar = self.menuBar()
        
        file_menu = menu_bar.addMenu("文件(&F)")
        
        new_patient_action = QAction("新建患者", self)
        new_patient_action.setShortcut("Ctrl+N")
        new_patient_action.triggered.connect(self._new_patient)
        file_menu.addAction(new_patient_action)
        
        new_order_action = QAction("新建订单", self)
        new_order_action.setShortcut("Ctrl+Shift+N")
        new_order_action.triggered.connect(self._new_order)
        file_menu.addAction(new_order_action)
        
        file_menu.addSeparator()
        
        import_action = QAction("导入CSV...", self)
        import_action.setShortcut("Ctrl+I")
        import_action.triggered.connect(self._import_csv)
        file_menu.addAction(import_action)
        
        export_action = QAction("导出订单列表...", self)
        export_action.setShortcut("Ctrl+E")
        export_action.triggered.connect(self._export_csv)
        file_menu.addAction(export_action)
        
        file_menu.addSeparator()
        
        exit_action = QAction("退出", self)
        exit_action.setShortcut("Ctrl+Q")
        exit_action.triggered.connect(self.close)
        file_menu.addAction(exit_action)
        
        help_menu = menu_bar.addMenu("帮助(&H)")
        about_action = QAction("关于", self)
        about_action.triggered.connect(self._show_about)
        help_menu.addAction(about_action)
    
    def _create_tool_bar(self):
        toolbar = QToolBar("主工具栏")
        toolbar.setMovable(False)
        toolbar.setIconSize(QSize(24, 24))
        
        new_patient_btn = QAction("新建患者", self)
        new_patient_btn.triggered.connect(self._new_patient)
        toolbar.addAction(new_patient_btn)
        
        new_order_btn = QAction("新建订单", self)
        new_order_btn.triggered.connect(self._new_order)
        toolbar.addAction(new_order_btn)
        
        toolbar.addSeparator()
        
        import_btn = QAction("导入CSV", self)
        import_btn.triggered.connect(self._import_csv)
        toolbar.addAction(import_btn)
        
        export_btn = QAction("导出", self)
        export_btn.triggered.connect(self._export_csv)
        toolbar.addAction(export_btn)
        
        toolbar.addSeparator()
        
        refresh_btn = QAction("刷新", self)
        refresh_btn.triggered.connect(self._load_data)
        toolbar.addAction(refresh_btn)
        
        self.addToolBar(toolbar)
    
    def _create_status_bar(self):
        self.status_bar = QStatusBar()
        self.setStatusBar(self.status_bar)
        self.status_bar.showMessage("就绪")
    
    def _create_central_widget(self):
        central_widget = QWidget()
        self.setCentralWidget(central_widget)
        
        main_layout = QHBoxLayout(central_widget)
        main_layout.setContentsMargins(0, 0, 0, 0)
        main_layout.setSpacing(0)
        
        splitter = QSplitter(Qt.Orientation.Horizontal)
        
        self.order_list = OrderListWidget()
        self.order_list.setMinimumWidth(250)
        splitter.addWidget(self.order_list)
        
        self.kanban = KanbanWidget()
        self.kanban.setMinimumWidth(600)
        splitter.addWidget(self.kanban)
        
        self.detail_widget = DetailWidget()
        self.detail_widget.setMinimumWidth(400)
        splitter.addWidget(self.detail_widget)
        
        splitter.setSizes([250, 600, 400])
        
        main_layout.addWidget(splitter)
    
    def _connect_signals(self):
        self.order_list.order_selected.connect(self._on_order_selected)
        self.kanban.order_selected.connect(self._on_order_selected)
        self.kanban.order_status_changed.connect(self._on_order_status_changed)
        
        self.detail_widget.data_changed.connect(self._load_data)
    
    def _load_data(self):
        orders = self.order_repo.get_all()
        self.order_list.set_orders(orders)
        self.kanban.set_orders(orders)
        
        status_counts = self.order_repo.get_status_counts()
        total = sum(status_counts.values())
        self.status_bar.showMessage(f"共 {total} 个订单 | "
            f"待取模: {status_counts['待取模']} | "
            f"待设计: {status_counts['待设计']} | "
            f"制作中: {status_counts['制作中']} | "
            f"待试穿: {status_counts['待试穿']} | "
            f"需返修: {status_counts['需返修']} | "
            f"已交付: {status_counts['已交付']}")
    
    def _on_order_selected(self, order_id: int):
        self.current_order_id = order_id
        self.detail_widget.set_order(order_id)
    
    def _on_order_status_changed(self, order_id: int, new_status: str):
        order = self.order_repo.get_by_id(order_id)
        if order:
            self.order_repo.update_status(order_id, new_status, "看板状态变更")
            self._load_data()
            self._on_order_selected(order_id)
    
    def _new_patient(self):
        dialog = PatientDialog(self)
        if dialog.exec() == PatientDialog.DialogCode.Accepted:
            patient = dialog.get_patient()
            patient = self.patient_repo.create(patient)
            self._load_data()
            QMessageBox.information(self, "成功", f"患者 \"{patient.name}\" 创建成功")
    
    def _new_order(self):
        dialog = OrderDialog(self)
        if dialog.exec() == OrderDialog.DialogCode.Accepted:
            order = dialog.get_order()
            order = self.order_repo.create(order)
            self._load_data()
            QMessageBox.information(self, "成功", f"订单 \"{order.order_number}\" 创建成功")
    
    def _import_csv(self):
        dialog = ImportCSVDialog(self)
        if dialog.exec() == ImportCSVDialog.DialogCode.Accepted:
            self._load_data()
    
    def _export_csv(self):
        file_path, _ = QFileDialog.getSaveFileName(
            self,
            "导出订单列表",
            "",
            "CSV文件 (*.csv)"
        )
        
        if file_path:
            from pathlib import Path
            exporter = CSVExporter()
            if exporter.export_all(Path(file_path)):
                QMessageBox.information(self, "成功", f"订单列表已导出到:\n{file_path}")
            else:
                QMessageBox.warning(self, "失败", "导出失败，请检查文件权限")
    
    def _show_about(self):
        QMessageBox.about(
            self,
            "关于",
            f"<h3>{self.settings.app_name}</h3>"
            f"<p>版本: {self.settings.app_version}</p>"
            f"<p>假肢矫形门诊与制作间管理系统</p>"
            f"<p>数据目录: {self.settings.data_dir}</p>"
        )
