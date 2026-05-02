from typing import List, Optional

from PyQt5.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QListWidget,
    QListWidgetItem, QPushButton, QLabel, QMessageBox,
    QMenu, QAction
)
from PyQt5.QtCore import Qt, pyqtSignal
from PyQt5.QtGui import QColor, QBrush, QFont

from models.piece import Piece, PiecePlacement


class PieceListWidget(QWidget):
    piece_selected = pyqtSignal(str)
    piece_deleted = pyqtSignal(str)

    def __init__(self, parent=None):
        super().__init__(parent)
        
        self._pieces: List[Piece] = []
        self._placements: List[PiecePlacement] = []
        self._selected_piece_id: Optional[str] = None
        
        self._init_ui()

    def _init_ui(self):
        layout = QVBoxLayout(self)
        layout.setContentsMargins(5, 5, 5, 5)
        
        header_layout = QHBoxLayout()
        
        title_label = QLabel("裁片列表")
        title_label.setFont(QFont("Arial", 11, QFont.Bold))
        header_layout.addWidget(title_label)
        
        header_layout.addStretch()
        
        self._count_label = QLabel("0 个裁片")
        header_layout.addWidget(self._count_label)
        
        layout.addLayout(header_layout)
        
        self._list_widget = QListWidget()
        self._list_widget.setSelectionMode(QListWidget.SingleSelection)
        self._list_widget.itemClicked.connect(self._on_item_clicked)
        self._list_widget.setContextMenuPolicy(Qt.CustomContextMenu)
        self._list_widget.customContextMenuRequested.connect(self._show_context_menu)
        layout.addWidget(self._list_widget)

    def set_pieces(self, pieces: List[Piece], placements: List[PiecePlacement] = None):
        self._pieces = pieces
        self._placements = placements or []
        self._refresh_list()

    def select_piece(self, piece_id: str):
        self._selected_piece_id = piece_id
        
        for i in range(self._list_widget.count()):
            item = self._list_widget.item(i)
            if item.data(Qt.UserRole) == piece_id:
                self._list_widget.setCurrentItem(item)
                break

    def _refresh_list(self):
        self._list_widget.clear()
        
        piece_counts: dict = {}
        for piece in self._pieces:
            piece_counts[piece.id] = {
                "piece": piece,
                "quantity": piece.quantity,
                "placed": 0
            }
        
        for placement in self._placements:
            if placement.is_placed and placement.piece.id in piece_counts:
                piece_counts[placement.piece.id]["placed"] += 1
        
        total_pieces = len(self._pieces)
        total_quantity = sum(p.quantity for p in self._pieces)
        total_placed = sum(1 for p in self._placements if p.is_placed)
        
        self._count_label.setText(f"{total_pieces} 种 ({total_quantity} 片, 已放置 {total_placed})")
        
        for piece_id, info in piece_counts.items():
            piece = info["piece"]
            quantity = info["quantity"]
            placed = info["placed"]
            
            item = QListWidgetItem()
            item.setData(Qt.UserRole, piece_id)
            
            display_text = f"{piece.name}"
            if placed > 0:
                if placed == quantity:
                    status_text = " ✓"
                else:
                    status_text = f" ({placed}/{quantity})"
            else:
                status_text = f" (×{quantity})"
            
            item.setText(display_text + status_text)
            
            if piece.color:
                try:
                    color = QColor(piece.color)
                    item.setForeground(QBrush(color))
                except:
                    pass
            
            if placed == quantity and placed > 0:
                font = item.font()
                font.setBold(True)
                item.setFont(font)
            
            self._list_widget.addItem(item)

    def _on_item_clicked(self, item: QListWidgetItem):
        piece_id = item.data(Qt.UserRole)
        if piece_id:
            self._selected_piece_id = piece_id
            self.piece_selected.emit(piece_id)

    def _show_context_menu(self, position):
        item = self._list_widget.itemAt(position)
        if not item:
            return
        
        piece_id = item.data(Qt.UserRole)
        if not piece_id:
            return
        
        menu = QMenu(self)
        
        delete_action = QAction("删除裁片", self)
        delete_action.triggered.connect(lambda: self._delete_piece(piece_id))
        menu.addAction(delete_action)
        
        menu.exec(self._list_widget.mapToGlobal(position))

    def _delete_piece(self, piece_id: str):
        piece = None
        for p in self._pieces:
            if p.id == piece_id:
                piece = p
                break
        
        if not piece:
            return
        
        reply = QMessageBox.question(
            self,
            "确认删除",
            f"确定要删除裁片 '{piece.name}' 吗？",
            QMessageBox.Yes | QMessageBox.No
        )
        
        if reply == QMessageBox.Yes:
            self.piece_deleted.emit(piece_id)
