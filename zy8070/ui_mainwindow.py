from PyQt5.QtWidgets import (QMainWindow, QWidget, QVBoxLayout, QHBoxLayout,
                             QPushButton, QLabel, QTableWidget, QTableWidgetItem,
                             QTextEdit, QGroupBox, QFileDialog, QMessageBox)
from PyQt5.QtCore import Qt


class Ui_MainWindow:
    def setupUi(self, MainWindow):
        MainWindow.setWindowTitle("直播导播单整理工具 v1.0")
        MainWindow.resize(1200, 800)

        central_widget = QWidget()
        self.setCentralWidget(central_widget)
        main_layout = QVBoxLayout(central_widget)

        title = QLabel("🎬 直播导播单整理工具")
        title.setStyleSheet("font-size: 24px; font-weight: bold; padding: 10px;")
        main_layout.addWidget(title)

        import_group = QGroupBox("📥 数据导入")
        import_layout = QHBoxLayout()

        self.btn_import_session = QPushButton("导入直播场次 CSV")
        self.btn_import_products = QPushButton("导入商品素材 JSON")
        self.btn_import_banned = QPushButton("导入禁用词 txt")

        self.label_session = QLabel("未导入")
        self.label_products = QLabel("未导入")
        self.label_banned = QLabel("未导入")

        import_layout.addWidget(self.btn_import_session)
        import_layout.addWidget(self.label_session)
        import_layout.addWidget(self.btn_import_products)
        import_layout.addWidget(self.label_products)
        import_layout.addWidget(self.btn_import_banned)
        import_layout.addWidget(self.label_banned)
        import_layout.addStretch()

        import_group.setLayout(import_layout)
        main_layout.addWidget(import_group)

        action_group = QGroupBox("⚡ 操作")
        action_layout = QHBoxLayout()

        self.btn_validate = QPushButton("🔍 检测问题")
        self.btn_export_md = QPushButton("📄 导出 Markdown")
        self.btn_export_csv = QPushButton("📊 导出问题 CSV")
        self.btn_save_notes = QPushButton("💾 保存备注")

        action_layout.addWidget(self.btn_validate)
        action_layout.addWidget(self.btn_save_notes)
        action_layout.addWidget(self.btn_export_md)
        action_layout.addWidget(self.btn_export_csv)
        action_layout.addStretch()

        action_group.setLayout(action_layout)
        main_layout.addWidget(action_group)

        content_layout = QHBoxLayout()

        left_widget = QWidget()
        left_layout = QVBoxLayout(left_widget)

        self.table_segments = QTableWidget()
        self.table_segments.setColumnCount(5)
        self.table_segments.setHorizontalHeaderLabels(["环节名称", "开始时间", "结束时间", "商品数", "问题数"])
        self.table_segments.horizontalHeader().setSectionResizeMode(0, QHeaderView.Stretch)
        self.table_segments.horizontalHeader().setSectionResizeMode(1, QHeaderView.ResizeToContents)
        self.table_segments.horizontalHeader().setSectionResizeMode(2, QHeaderView.ResizeToContents)
        self.table_segments.horizontalHeader().setSectionResizeMode(3, QHeaderView.ResizeToContents)
        self.table_segments.horizontalHeader().setSectionResizeMode(4, QHeaderView.ResizeToContents)

        left_layout.addWidget(QLabel("📋 时间轴预览"))
        left_layout.addWidget(self.table_segments)

        right_widget = QWidget()
        right_layout = QVBoxLayout(right_widget)

        self.text_detail = QTextEdit()
        self.text_detail.setPlaceholderText("点击左侧表格查看详情...")
        self.text_detail.setReadOnly(True)

        self.text_notes = QTextEdit()
        self.text_notes.setPlaceholderText("输入备注内容...")
        self.text_notes.setMaximumHeight(150)

        right_layout.addWidget(QLabel("📝 环节详情"))
        right_layout.addWidget(self.text_detail)
        right_layout.addWidget(QLabel("📝 彩排备注 (自动持久化)"))
        right_layout.addWidget(self.text_notes)

        content_layout.addWidget(left_widget, 2)
        content_layout.addWidget(right_widget, 1)

        main_layout.addLayout(content_layout)

        self.label_status = QLabel("就绪")
        self.label_status.setStyleSheet("padding: 5px; background-color: #0f3460; color: #eee;")
        main_layout.addWidget(self.label_status)

        self.btn_save_notes.clicked.connect(self.save_notes)

    def save_notes(self):
        pass