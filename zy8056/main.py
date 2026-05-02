
import sys
import os
from PyQt5.QtWidgets import (
    QApplication, QMainWindow, QWidget, QVBoxLayout, QHBoxLayout,
    QLabel, QComboBox, QPushButton, QCheckBox, QListWidget,
    QListWidgetItem, QScrollArea, QFileDialog, QMessageBox,
    QSplitter, QGroupBox, QFormLayout, QTextEdit, QButtonGroup
)
from PyQt5.QtCore import Qt, QRectF
from PyQt5.QtGui import QPixmap, QPainter, QPen, QColor, QFont, QImage
from data_loader import DataLoader, SampleImage, Colony
from rule_validator import RuleValidator
from database import Database, ReviewState
from reporter import Reporter


class ImageCanvas(QLabel):
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setMinimumSize(600, 400)
        self.setStyleSheet("background-color: #2d2d2d;")
        self.image_pixmap = None
        self.colonies = []
        self.reviews = {}
        self.scale = 1.0
    
    def set_image(self, image_path: str):
        if os.path.exists(image_path):
            self.image_pixmap = QPixmap(image_path)
            self.update()
        else:
            self.image_pixmap = None
            self.setText("图片不存在")
            self.setAlignment(Qt.AlignCenter)
    
    def set_colonies(self, colonies: list, reviews: dict):
        self.colonies = colonies
        self.reviews = reviews
        self.update()
    
    def paintEvent(self, event):
        super().paintEvent(event)
        painter = QPainter(self)
        
        if self.image_pixmap:
            widget_size = self.size()
            image_size = self.image_pixmap.size()
            
            scale_x = widget_size.width() / image_size.width()
            scale_y = widget_size.height() / image_size.height()
            self.scale = min(scale_x, scale_y, 1.0)
            
            scaled_width = int(image_size.width() * self.scale)
            scaled_height = int(image_size.height() * self.scale)
            
            x = (widget_size.width() - scaled_width) // 2
            y = (widget_size.height() - scaled_height) // 2
            
            painter.drawPixmap(x, y, self.image_pixmap.scaled(scaled_width, scaled_height, Qt.KeepAspectRatio, Qt.SmoothTransformation))
            
            for colony in self.colonies:
                review = self.reviews.get(colony.colony_id)
                color = QColor(0, 255, 0)
                
                if review:
                    if not review.accepted:
                        color = QColor(255, 0, 0)
                    elif review.marked_contamination:
                        color = QColor(255, 165, 0)
                    elif review.marked_missing:
                        color = QColor(255, 255, 0)
                    elif review.marked_overlap:
                        color = QColor(128, 0, 128)
                
                pen = QPen(color, 2)
                painter.setPen(pen)
                
                rect_x = x + int(colony.x * self.scale)
                rect_y = y + int(colony.y * self.scale)
                rect_w = int(colony.width * self.scale)
                rect_h = int(colony.height * self.scale)
                
                painter.drawRect(rect_x, rect_y, rect_w, rect_h)
                
                painter.setPen(QColor(255, 255, 255))
                painter.setFont(QFont("Arial", 8))
                painter.drawText(rect_x, rect_y - 5, colony.colony_id)


class ColonyReviewApp(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("菌落计数复核工具")
        self.setGeometry(100, 100, 1400, 900)
        
        self.data_dir = "sample_data"
        self.images = {}
        self.batches = {}
        self.rules = {}
        self.current_batch = None
        self.current_image_index = 0
        self.current_image = None
        self.current_colony = None
        
        self.db = Database()
        self.validator = None
        
        self.init_ui()
        self.load_data()
    
    def init_ui(self):
        central_widget = QWidget()
        self.setCentralWidget(central_widget)
        main_layout = QHBoxLayout(central_widget)
        
        splitter = QSplitter(Qt.Horizontal)
        
        left_panel = self.create_left_panel()
        right_panel = self.create_right_panel()
        
        splitter.addWidget(left_panel)
        splitter.addWidget(right_panel)
        splitter.setSizes([400, 1000])
        
        main_layout.addWidget(splitter)
    
    def create_left_panel(self):
        panel = QWidget()
        layout = QVBoxLayout(panel)
        
        batch_group = QGroupBox("批次选择")
        batch_layout = QVBoxLayout()
        self.batch_combo = QComboBox()
        self.batch_combo.currentTextChanged.connect(self.on_batch_changed)
        batch_layout.addWidget(self.batch_combo)
        batch_group.setLayout(batch_layout)
        layout.addWidget(batch_group)
        
        image_group = QGroupBox("图片列表")
        image_layout = QVBoxLayout()
        self.image_list = QListWidget()
        self.image_list.currentRowChanged.connect(self.on_image_changed)
        image_layout.addWidget(self.image_list)
        image_group.setLayout(image_layout)
        layout.addWidget(image_group)
        
        nav_group = QGroupBox("导航")
        nav_layout = QHBoxLayout()
        self.prev_btn = QPushButton("上一张")
        self.prev_btn.clicked.connect(self.prev_image)
        self.next_btn = QPushButton("下一张")
        self.next_btn.clicked.connect(self.next_image)
        nav_layout.addWidget(self.prev_btn)
        nav_layout.addWidget(self.next_btn)
        nav_group.setLayout(nav_layout)
        layout.addWidget(nav_group)
        
        export_group = QGroupBox("导出")
        export_layout = QHBoxLayout()
        self.export_md_btn = QPushButton("导出 Markdown")
        self.export_md_btn.clicked.connect(self.export_md)
        self.export_csv_btn = QPushButton("导出 CSV")
        self.export_csv_btn.clicked.connect(self.export_csv)
        export_layout.addWidget(self.export_md_btn)
        export_layout.addWidget(self.export_csv_btn)
        export_group.setLayout(export_layout)
        layout.addWidget(export_group)
        
        return panel
    
    def create_right_panel(self):
        panel = QWidget()
        layout = QVBoxLayout(panel)
        
        info_layout = QHBoxLayout()
        self.image_info_label = QLabel("当前图片: -")
        info_layout.addWidget(self.image_info_label)
        layout.addLayout(info_layout)
        
        self.canvas = ImageCanvas()
        scroll = QScrollArea()
        scroll.setWidget(self.canvas)
        scroll.setWidgetResizable(True)
        layout.addWidget(scroll, 1)
        
        lower_panel = QWidget()
        lower_layout = QHBoxLayout(lower_panel)
        
        colony_group = QGroupBox("菌落列表")
        colony_layout = QVBoxLayout()
        self.colony_list = QListWidget()
        self.colony_list.itemClicked.connect(self.on_colony_clicked)
        colony_layout.addWidget(self.colony_list)
        colony_group.setLayout(colony_layout)
        lower_layout.addWidget(colony_group, 1)
        
        details_group = QGroupBox("菌落详情")
        details_layout = QVBoxLayout()
        
        self.accepted_check = QCheckBox("接受")
        self.accepted_check.stateChanged.connect(self.save_current_review)
        details_layout.addWidget(self.accepted_check)
        
        self.contamination_check = QCheckBox("标记为污染")
        self.contamination_check.stateChanged.connect(self.save_current_review)
        details_layout.addWidget(self.contamination_check)
        
        self.missing_check = QCheckBox("标记为漏检")
        self.missing_check.stateChanged.connect(self.save_current_review)
        details_layout.addWidget(self.missing_check)
        
        self.overlap_check = QCheckBox("标记为重叠")
        self.overlap_check.stateChanged.connect(self.save_current_review)
        details_layout.addWidget(self.overlap_check)
        
        details_layout.addWidget(QLabel("备注:"))
        self.notes_edit = QTextEdit()
        self.notes_edit.setMaximumHeight(100)
        self.notes_edit.textChanged.connect(self.save_current_review)
        details_layout.addWidget(self.notes_edit)
        
        details_group.setLayout(details_layout)
        lower_layout.addWidget(details_group, 1)
        
        layout.addWidget(lower_panel, 1)
        
        return panel
    
    def load_data(self):
        loader = DataLoader(self.data_dir)
        self.images, self.batches, self.rules = loader.load_all()
        self.validator = RuleValidator(self.rules)
        
        self.batch_combo.clear()
        for batch_id in sorted(self.batches.keys()):
            self.batch_combo.addItem(batch_id)
        
        if self.batches:
            first_batch = sorted(self.batches.keys())[0]
            self.batch_combo.setCurrentText(first_batch)
    
    def on_batch_changed(self, batch_id):
        if not batch_id:
            return
        self.current_batch = batch_id
        self.image_list.clear()
        image_ids = self.batches.get(batch_id, [])
        for image_id in image_ids:
            item = QListWidgetItem(image_id)
            self.image_list.addItem(item)
        if image_ids:
            self.image_list.setCurrentRow(0)
    
    def on_image_changed(self, index):
        if index &lt; 0:
            return
        self.current_image_index = index
        image_id = self.image_list.item(index).text()
        self.current_image = self.images.get(image_id)
        self.current_colony = None
        
        if self.current_image:
            self.image_info_label.setText(
                f"当前图片: {image_id} | 批次: {self.current_image.batch_id} | 菌落数: {len(self.current_image.colonies)}"
            )
            
            if self.current_image.image_exists:
                self.canvas.set_image(self.current_image.image_path)
            else:
                self.canvas.set_image("")
            
            self.load_colony_list()
            self.clear_details()
    
    def load_colony_list(self):
        self.colony_list.clear()
        
        if not self.current_image:
            return
        
        reviews = self.db.get_image_reviews(self.current_image.image_id)
        self.canvas.set_colonies(self.current_image.colonies, reviews)
        
        for colony in self.current_image.colonies:
            review = reviews.get(colony.colony_id, ReviewState(
                image_id=self.current_image.image_id,
                colony_id=colony.colony_id,
                accepted=True,
                marked_contamination=False,
                marked_missing=False,
                marked_overlap=False,
                notes=""
            ))
            
            item = QListWidgetItem()
            item.setText(f"{colony.colony_id} (置信度: {colony.confidence:.2f})")
            item.setData(Qt.UserRole, colony)
            item.setData(Qt.UserRole + 1, review)
            
            self.colony_list.addItem(item)
    
    def on_colony_clicked(self, item):
        colony = item.data(Qt.UserRole)
        review = item.data(Qt.UserRole + 1)
        
        if not colony or not review:
            return
        
        self.current_colony = (colony, review)
        self.load_details()
    
    def load_details(self):
        if not self.current_colony:
            return
        
        colony, review = self.current_colony
        
        self.accepted_check.blockSignals(True)
        self.contamination_check.blockSignals(True)
        self.missing_check.blockSignals(True)
        self.overlap_check.blockSignals(True)
        self.notes_edit.blockSignals(True)
        
        self.accepted_check.setChecked(review.accepted)
        self.contamination_check.setChecked(review.marked_contamination)
        self.missing_check.setChecked(review.marked_missing)
        self.overlap_check.setChecked(review.marked_overlap)
        self.notes_edit.setText(review.notes)
        
        self.accepted_check.blockSignals(False)
        self.contamination_check.blockSignals(False)
        self.missing_check.blockSignals(False)
        self.overlap_check.blockSignals(False)
        self.notes_edit.blockSignals(False)
    
    def clear_details(self):
        self.accepted_check.blockSignals(True)
        self.contamination_check.blockSignals(True)
        self.missing_check.blockSignals(True)
        self.overlap_check.blockSignals(True)
        self.notes_edit.blockSignals(True)
        
        self.accepted_check.setChecked(False)
        self.contamination_check.setChecked(False)
        self.missing_check.setChecked(False)
        self.overlap_check.setChecked(False)
        self.notes_edit.setText("")
        
        self.accepted_check.blockSignals(False)
        self.contamination_check.blockSignals(False)
        self.missing_check.blockSignals(False)
        self.overlap_check.blockSignals(False)
        self.notes_edit.blockSignals(False)
    
    def save_current_review(self):
        if not self.current_colony:
            return
        
        colony, review = self.current_colony
        
        review.accepted = self.accepted_check.isChecked()
        review.marked_contamination = self.contamination_check.isChecked()
        review.marked_missing = self.missing_check.isChecked()
        review.marked_overlap = self.overlap_check.isChecked()
        review.notes = self.notes_edit.toPlainText()
        
        self.db.save_review(review)
        
        reviews = self.db.get_image_reviews(self.current_image.image_id)
        self.canvas.set_colonies(self.current_image.colonies, reviews)
    
    def prev_image(self):
        if self.current_image_index &gt; 0:
            self.image_list.setCurrentRow(self.current_image_index - 1)
    
    def next_image(self):
        if self.current_image_index &lt; self.image_list.count() - 1:
            self.image_list.setCurrentRow(self.current_image_index + 1)
    
    def export_md(self):
        path, _ = QFileDialog.getSaveFileName(self, "导出 Markdown 报告", "review_summary.md", "Markdown Files (*.md)")
        if path:
            Reporter.generate_summary_md(path, self.db, self.images, self.batches)
            QMessageBox.information(self, "成功", f"报告已导出到 {path}")
    
    def export_csv(self):
        path, _ = QFileDialog.getSaveFileName(self, "导出 CSV 报告", "issues.csv", "CSV Files (*.csv)")
        if path:
            Reporter.generate_issues_csv(path, self.db)
            QMessageBox.information(self, "成功", f"报告已导出到 {path}")


def main():
    app = QApplication(sys.argv)
    window = ColonyReviewApp()
    window.show()
    sys.exit(app.exec_())


if __name__ == "__main__":
    main()

