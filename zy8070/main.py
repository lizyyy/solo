import sys
from PyQt5.QtWidgets import QApplication, QMainWindow, QFileDialog, QMessageBox, QTableWidgetItem, QHeaderView
from PyQt5.QtCore import Qt, QTimer
from PyQt5.QtGui import QColor
import pandas as pd
import json
import os
from datetime import datetime
from ui_mainwindow import Ui_MainWindow
from data_parser import DataParser
from validator import Validator
from exporter import Exporter
from notes_manager import NotesManager


class MainWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        self.ui = Ui_MainWindow()
        self.ui.setupUi(self)

        self.data_parser = DataParser()
        self.validator = Validator()
        self.exporter = Exporter()
        self.notes_manager = NotesManager()

        self.sessions_df = None
        self.products_data = None
        self.banned_words = []
        self.current_data = []

        self.setup_connections()
        self.apply_stylesheet()

    def setup_connections(self):
        self.ui.btn_import_session.clicked.connect(self.import_session)
        self.ui.btn_import_products.clicked.connect(self.import_products)
        self.ui.btn_import_banned.clicked.connect(self.import_banned_words)
        self.ui.btn_validate.clicked.connect(self.validate_all)
        self.ui.btn_export_md.clicked.connect(self.export_markdown)
        self.ui.btn_export_csv.clicked.connect(self.export_problems_csv)
        self.ui.table_segments.cellClicked.connect(self.on_segment_clicked)

    def apply_stylesheet(self):
        self.setStyleSheet("""
            QMainWindow { background-color: #1a1a2e; }
            QPushButton {
                background-color: #16213e;
                color: #eee;
                border: 1px solid #0f3460;
                padding: 8px 16px;
                border-radius: 4px;
            }
            QPushButton:hover { background-color: #0f3460; }
            QPushButton:pressed { background-color: #e94560; }
            QLabel { color: #eee; }
            QTableWidget {
                background-color: #16213e;
                color: #eee;
                gridline-color: #0f3460;
                border: 1px solid #0f3460;
            }
            QTableWidget::item:selected { background-color: #e94560; }
            QHeaderView::section {
                background-color: #0f3460;
                color: #eee;
                padding: 4px;
                border: 1px solid #16213e;
            }
            QTextEdit {
                background-color: #16213e;
                color: #eee;
                border: 1px solid #0f3460;
            }
            QGroupBox {
                border: 1px solid #0f3460;
                border-radius: 4px;
                margin-top: 8px;
                padding-top: 8px;
                color: #eee;
            }
            QGroupBox::title {
                subcontrol-origin: margin;
                left: 8px;
                padding: 0 4px;
            }
        """)

    def import_session(self):
        path, _ = QFileDialog.getOpenFileName(self, "导入直播场次 CSV", "", "CSV Files (*.csv)")
        if path:
            try:
                self.sessions_df = self.data_parser.parse_session_csv(path)
                self.ui.label_session.setText(f"已导入: {os.path.basename(path)}")
                QMessageBox.information(self, "成功", f"成功导入 {len(self.sessions_df)} 条场次数据")
            except Exception as e:
                QMessageBox.critical(self, "错误", f"导入场次失败: {str(e)}")

    def import_products(self):
        path, _ = QFileDialog.getOpenFileName(self, "导入商品素材 JSON", "", "JSON Files (*.json)")
        if path:
            try:
                self.products_data = self.data_parser.parse_products_json(path)
                self.ui.label_products.setText(f"已导入: {os.path.basename(path)}")
                QMessageBox.information(self, "成功", f"成功导入 {len(self.products_data)} 条商品数据")
            except Exception as e:
                QMessageBox.critical(self, "错误", f"导入商品失败: {str(e)}")

    def import_banned_words(self):
        path, _ = QFileDialog.getOpenFileName(self, "导入禁用词 txt", "", "Text Files (*.txt)")
        if path:
            try:
                self.banned_words = self.data_parser.parse_banned_words(path)
                self.ui.label_banned.setText(f"已导入: {os.path.basename(path)} ({len(self.banned_words)} 词)")
                QMessageBox.information(self, "成功", f"成功导入 {len(self.banned_words)} 个禁用词")
            except Exception as e:
                QMessageBox.critical(self, "错误", f"导入禁用词失败: {str(e)}")

    def validate_all(self):
        if self.sessions_df is None:
            QMessageBox.warning(self, "警告", "请先导入直播场次 CSV")
            return

        self.current_data = []
        self.ui.table_segments.setRowCount(0)

        for idx, row in self.sessions_df.iterrows():
            segment = {
                'id': idx,
                '环节名称': row.get('环节名称', ''),
                '开始时间': row.get('开始时间', ''),
                '结束时间': row.get('结束时间', ''),
                '提词卡': row.get('提词卡', ''),
                '备注': self.notes_manager.get_note(idx)
            }

            products = []
            if self.products_data:
                for p in self.products_data:
                    if str(p.get('环节ID', '')) == str(idx) or p.get('环节名称', '') == segment['环节名称']:
                        products.append(p)

            segment['商品列表'] = products
            segment['问题列表'] = []

            problems = self.validator.validate_segment(segment, self.products_data, self.banned_words)
            segment['问题列表'].extend(problems)

            self.current_data.append(segment)
            self.add_segment_to_table(segment)

        self.ui.label_status.setText(f"检测完成，发现 {sum(len(d['问题列表']) for d in self.current_data)} 个问题")

    def add_segment_to_table(self, segment):
        row = self.ui.table_segments.rowCount()
        self.ui.table_segments.insertRow(row)

        self.ui.table_segments.setItem(row, 0, QTableWidgetItem(str(segment['环节名称'])))
        self.ui.table_segments.setItem(row, 1, QTableWidgetItem(str(segment['开始时间'])))
        self.ui.table_segments.setItem(row, 2, QTableWidgetItem(str(segment['结束时间'])))
        self.ui.table_segments.setItem(row, 3, QTableWidgetItem(str(len(segment['商品列表']))))
        self.ui.table_segments.setItem(row, 4, QTableWidgetItem(str(len(segment['问题列表']))))

        if segment['问题列表']:
            self.ui.table_segments.item(row, 4).setBackground(QColor(255, 100, 100))
        else:
            self.ui.table_segments.item(row, 4).setBackground(QColor(100, 255, 100))

        for col in range(5):
            self.ui.table_segments.item(row, col).setFlags(
                self.ui.table_segments.item(row, col).flags() & ~Qt.ItemIsEditable
            )

    def on_segment_clicked(self, row, col):
        if row < len(self.current_data):
            segment = self.current_data[row]
            self.ui.text_detail.setPlainText(
                f"环节: {segment['环节名称']}\n"
                f"时间: {segment['开始时间']} - {segment['结束时间']}\n"
                f"提词卡: {segment['提词卡']}\n"
                f"备注: {segment['备注']}\n"
                f"问题: {', '.join(segment['问题列表']) if segment['问题列表'] else '无'}\n"
                f"商品数量: {len(segment['商品列表'])}"
            )

            for i, prod in enumerate(segment['商品列表']):
                self.ui.text_detail.append(
                    f"\n商品{i+1}: {prod.get('商品名称', '')} | "
                    f"优惠价: {prod.get('优惠价', '未设置')} | "
                    f"图片: {'有' if prod.get('图片路径') else '缺'}"
                )

    def save_notes(self):
        if self.current_data:
            for segment in self.current_data:
                self.notes_manager.save_note(segment['id'], self.ui.text_notes.toPlainText())
            QMessageBox.information(self, "保存", "备注已保存")

    def export_markdown(self):
        if not self.current_data:
            QMessageBox.warning(self, "警告", "没有可导出的数据")
            return

        path, _ = QFileDialog.getSaveFileName(self, "导出 Markdown", "", "Markdown Files (*.md)")
        if path:
            try:
                self.exporter.export_to_markdown(self.current_data, path)
                QMessageBox.information(self, "成功", f"已导出到 {path}")
            except Exception as e:
                QMessageBox.critical(self, "错误", f"导出失败: {str(e)}")

    def export_problems_csv(self):
        if not self.current_data:
            QMessageBox.warning(self, "警告", "没有可导出的数据")
            return

        path, _ = QFileDialog.getSaveFileName(self, "导出问题 CSV", "", "CSV Files (*.csv)")
        if path:
            try:
                self.exporter.export_problems_to_csv(self.current_data, path)
                QMessageBox.information(self, "成功", f"已导出到 {path}")
            except Exception as e:
                QMessageBox.critical(self, "错误", f"导出失败: {str(e)}")


if __name__ == '__main__':
    app = QApplication(sys.argv)
    window = MainWindow()
    window.show()
    sys.exit(app.exec_())