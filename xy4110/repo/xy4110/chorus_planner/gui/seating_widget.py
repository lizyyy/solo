"""可拖拽座位图控件"""
from enum import Enum
from typing import Dict, Optional, List, Tuple, Set, Any
from PyQt6.QtWidgets import (
    QWidget, QGraphicsView, QGraphicsScene, QGraphicsItem,
    QGraphicsRectItem, QGraphicsTextItem, QMenu, QGraphicsSimpleTextItem,
    QMessageBox, QInputDialog, QVBoxLayout, QHBoxLayout, QLabel, QFrame,
    QSplitter, QPushButton, QComboBox, QSpinBox, QGroupBox, QScrollArea
)
from PyQt6.QtCore import Qt, QPointF, QRectF, pyqtSignal, QSize
from PyQt6.QtGui import QColor, QPen, QBrush, QFont, QPainter, QCursor

from ..models.member import Member, VoicePart, MemberStatus
from ..models.seating import Seat, SeatingLayout, SeatingAssignment
from ..core.constraint_validator import ConstraintValidator, ValidationIssue, IssueType


class DragMode(Enum):
    """拖拽模式"""
    MEMBER = "MEMBER"
    SEAT = "SEAT"
    SELECT = "SELECT"


class SeatItem(QGraphicsRectItem):
    """单个座位图形项"""
    
    COLORS = {
        VoicePart.SOPRANO_1: (255, 107, 157),
        VoicePart.SOPRANO_2: (255, 143, 177),
        VoicePart.ALTO_1: (123, 104, 238),
        VoicePart.ALTO_2: (147, 112, 219),
        VoicePart.TENOR_1: (78, 205, 196),
        VoicePart.TENOR_2: (69, 183, 170),
        VoicePart.BASS_1: (44, 62, 80),
        VoicePart.BASS_2: (52, 73, 94),
        VoicePart.UNASSIGNED: (149, 165, 166),
    }
    
    STATUS_COLORS = {
        MemberStatus.PRESENT: (46, 204, 113),
        MemberStatus.ABSENT: (231, 76, 60),
        MemberStatus.LEAVE: (243, 156, 18),
        MemberStatus.UNKNOWN: (149, 165, 166),
    }
    
    seat_clicked = pyqtSignal(str)
    seat_double_clicked = pyqtSignal(str)
    member_dragged = pyqtSignal(str, str)
    
    def __init__(
        self,
        seat: Seat,
        member: Optional[Member] = None,
        assignment: Optional[SeatingAssignment] = None,
        issues: Optional[List[ValidationIssue]] = None,
        parent=None
    ):
        super().__init__(parent)
        
        self.seat = seat
        self.member = member
        self.assignment = assignment
        self.issues = issues or []
        
        self._is_dragging = False
        self._drag_start_pos = QPointF()
        self._is_hovered = False
        self._is_selected = False
        
        self.setFlags(
            QGraphicsItem.GraphicsItemFlag.ItemIsSelectable |
            QGraphicsItem.GraphicsItemFlag.ItemIsMovable |
            QGraphicsItem.GraphicsItemFlag.ItemSendsGeometryChanges |
            QGraphicsItem.GraphicsItemFlag.ItemAcceptsHoverEvents
        )
        
        self.setAcceptHoverEvents(True)
        
        self._width = 75
        self._height = 55
        self.setRect(QRectF(0, 0, self._width, self._height))
        
        self._name_text = QGraphicsSimpleTextItem(self)
        self._name_text.setPos(5, 5)
        font = QFont("Microsoft YaHei", 10, QFont.Weight.Bold)
        self._name_text.setFont(font)
        
        self._info_text = QGraphicsSimpleTextItem(self)
        self._info_text.setPos(5, 28)
        info_font = QFont("Microsoft YaHei", 8)
        self._info_text.setFont(info_font)
        
        self._update_display()
    
    def _get_base_color(self) -> Tuple[int, int, int]:
        """获取基础颜色"""
        if self.member:
            return self.COLORS.get(self.member.voice_part, (149, 165, 166))
        return (240, 240, 240)
    
    def _has_critical_issue(self) -> bool:
        """是否有严重问题"""
        from ..core.constraint_validator import IssueSeverity
        return any(issue.severity == IssueSeverity.CRITICAL for issue in self.issues)
    
    def _has_warning_issue(self) -> bool:
        """是否有警告问题"""
        from ..core.constraint_validator import IssueSeverity
        return any(issue.severity == IssueSeverity.WARNING for issue in self.issues)
    
    def _update_display(self):
        """更新显示"""
        if self.member:
            name = self.member.name[:4] if len(self.member.name) > 4 else self.member.name
            self._name_text.setText(name)
            
            voice_short = VoicePart.display_name(self.member.voice_part)[:2]
            
            status_mark = ""
            if self.member.status == MemberStatus.LEAVE:
                status_mark = "假"
            elif self.member.status == MemberStatus.ABSENT:
                status_mark = "缺"
            
            info_text = voice_short
            if status_mark:
                info_text += f" [{status_mark}]"
            if self.member.is_new():
                info_text += " ★"
            
            self._info_text.setText(info_text)
            
            name_color = QColor(255, 255, 255)
            if self.member.voice_part in [VoicePart.BASS_1, VoicePart.BASS_2]:
                name_color = QColor(255, 255, 255)
            self._name_text.setBrush(QBrush(name_color))
            self._info_text.setBrush(QBrush(name_color))
        else:
            self._name_text.setText("(空)")
            self._info_text.setText(self.seat.label)
            self._name_text.setBrush(QBrush(QColor(128, 128, 128)))
            self._info_text.setBrush(QBrush(QColor(128, 128, 128)))
        
        self.update()
    
    def set_member(self, member: Optional[Member], assignment: Optional[SeatingAssignment] = None):
        """设置成员"""
        self.member = member
        self.assignment = assignment
        self._update_display()
    
    def set_issues(self, issues: List[ValidationIssue]):
        """设置问题列表"""
        self.issues = issues
        self.update()
    
    def set_selected(self, selected: bool):
        """设置选中状态"""
        self._is_selected = selected
        self.update()
    
    def paint(self, painter: QPainter, option, widget=None):
        """绘制"""
        rect = self.rect()
        
        base_color = self._get_base_color()
        r, g, b = base_color
        
        if self._is_hovered:
            r = min(255, r + 30)
            g = min(255, g + 30)
            b = min(255, b + 30)
        
        fill_color = QColor(r, g, b)
        if self.member and self.member.status in [MemberStatus.ABSENT, MemberStatus.LEAVE]:
            fill_color = QColor(200, 200, 200)
        
        if self.assignment and self.assignment.is_locked:
            painter.fillRect(rect, QBrush(QColor(255, 215, 0, 100)))
        
        painter.fillRect(rect, QBrush(fill_color))
        
        border_width = 2
        border_color = QColor(100, 100, 100)
        
        if self._is_selected:
            border_width = 3
            border_color = QColor(0, 120, 215)
        elif self._has_critical_issue():
            border_width = 3
            border_color = QColor(231, 76, 60)
        elif self._has_warning_issue():
            border_width = 2
            border_color = QColor(243, 156, 18)
        
        painter.setPen(QPen(border_color, border_width))
        painter.drawRect(rect)
        
        if self.assignment and self.assignment.is_locked:
            painter.setPen(QPen(QColor(255, 215, 0), 1))
            lock_text = "🔒"
            painter.drawText(rect.right() - 20, rect.top() + 15, lock_text)
    
    def hoverEnterEvent(self, event):
        """鼠标进入"""
        self._is_hovered = True
        self.update()
        super().hoverEnterEvent(event)
    
    def hoverLeaveEvent(self, event):
        """鼠标离开"""
        self._is_hovered = False
        self.update()
        super().hoverLeaveEvent(event)
    
    def mousePressEvent(self, event):
        """鼠标按下"""
        if event.button() == Qt.MouseButton.LeftButton:
            self._is_dragging = True
            self._drag_start_pos = event.pos()
            self.set_selected(True)
            self.seat_clicked.emit(self.seat.id)
        
        super().mousePressEvent(event)
    
    def mouseReleaseEvent(self, event):
        """鼠标释放"""
        if self._is_dragging:
            self._is_dragging = False
        
        super().mouseReleaseEvent(event)
    
    def mouseDoubleClickEvent(self, event):
        """双击"""
        if event.button() == Qt.MouseButton.LeftButton:
            self.seat_double_clicked.emit(self.seat.id)
        
        super().mouseDoubleClickEvent(event)
    
    def itemChange(self, change, value):
        """项变化（用于限制移动）"""
        if change == QGraphicsItem.GraphicsItemChange.ItemPositionChange:
            if self.assignment and self.assignment.is_locked:
                return self.pos()
        
        return super().itemChange(change, value)


class SeatingWidget(QWidget):
    """座位图主控件"""
    
    seat_clicked = pyqtSignal(str)
    seat_double_clicked = pyqtSignal(str)
    member_moved = pyqtSignal(str, str)
    assignment_changed = pyqtSignal()
    
    def __init__(self, parent=None):
        super().__init__(parent)
        
        self._layout: Optional[SeatingLayout] = None
        self._members: Dict[str, Member] = {}
        self._issues: Dict[str, List[ValidationIssue]] = {}
        
        self._seat_items: Dict[str, SeatItem] = {}
        self._selected_seat_id: Optional[str] = None
        
        self._zoom_factor = 1.0
        
        self._init_ui()
    
    def _init_ui(self):
        """初始化 UI"""
        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)
        
        toolbar = QHBoxLayout()
        
        lbl = QLabel("座位图:")
        toolbar.addWidget(lbl)
        
        self._zoom_in_btn = QPushButton("+")
        self._zoom_in_btn.setFixedSize(30, 30)
        self._zoom_in_btn.clicked.connect(self._zoom_in)
        toolbar.addWidget(self._zoom_in_btn)
        
        self._zoom_out_btn = QPushButton("-")
        self._zoom_out_btn.setFixedSize(30, 30)
        self._zoom_out_btn.clicked.connect(self._zoom_out)
        toolbar.addWidget(self._zoom_out_btn)
        
        toolbar.addStretch()
        
        layout.addLayout(toolbar)
        
        self._view = QGraphicsView(self)
        self._view.setRenderHint(QPainter.RenderHint.Antialiasing)
        self._view.setViewportUpdateMode(QGraphicsView.ViewportUpdateMode.FullViewportUpdate)
        self._view.setHorizontalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAsNeeded)
        self._view.setVerticalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAsNeeded)
        self._view.setDragMode(QGraphicsView.DragMode.NoDrag)
        
        self._scene = QGraphicsScene(self)
        self._view.setScene(self._scene)
        
        layout.addWidget(self._view)
    
    def set_layout(self, layout: SeatingLayout):
        """设置座位布局"""
        self._layout = layout
        self._refresh_display()
    
    def set_members(self, members: Dict[str, Member]):
        """设置成员数据"""
        self._members = members
        self._refresh_display()
    
    def set_validation_issues(self, issues: List[ValidationIssue]):
        """设置校验问题"""
        self._issues = {}
        for issue in issues:
            for seat_id in issue.affected_seat_ids:
                if seat_id not in self._issues:
                    self._issues[seat_id] = []
                self._issues[seat_id].append(issue)
        
        for seat_id, seat_item in self._seat_items.items():
            seat_item.set_issues(self._issues.get(seat_id, []))
    
    def _refresh_display(self):
        """刷新显示"""
        if not self._layout:
            return
        
        self._scene.clear()
        self._seat_items = {}
        
        conductor_label = QGraphicsSimpleTextItem("▲ 指挥台 ▲")
        conductor_font = QFont("Microsoft YaHei", 14, QFont.Weight.Bold)
        conductor_label.setFont(conductor_font)
        conductor_label.setBrush(QBrush(QColor(52, 152, 219)))
        
        total_width = self._layout.cols * 85
        conductor_label.setPos(
            total_width / 2 - conductor_label.boundingRect().width() / 2,
            -50
        )
        self._scene.addItem(conductor_label)
        
        spacing_x = 85
        spacing_y = 70
        margin_left = 30
        margin_top = 30
        
        for row_idx in range(self._layout.rows):
            for col_idx in range(self._layout.cols):
                seat = self._layout.get_seat_at(row_idx, col_idx)
                if not seat or not seat.is_enabled:
                    continue
                
                x = margin_left + col_idx * spacing_x
                y = margin_top + row_idx * spacing_y
                
                assignment = self._layout.get_assignment_by_seat(seat.id)
                member = None
                if assignment and assignment.member_id:
                    member = self._members.get(assignment.member_id)
                
                seat_item = SeatItem(
                    seat=seat,
                    member=member,
                    assignment=assignment,
                    issues=self._issues.get(seat.id, [])
                )
                seat_item.setPos(x, y)
                
                seat_item.seat_clicked.connect(self._on_seat_clicked)
                seat_item.seat_double_clicked.connect(self._on_seat_double_clicked)
                
                self._scene.addItem(seat_item)
                self._seat_items[seat.id] = seat_item
        
        self._scene.setSceneRect(self._scene.itemsBoundingRect())
    
    def _on_seat_clicked(self, seat_id: str):
        """座位点击"""
        if self._selected_seat_id and self._selected_seat_id in self._seat_items:
            self._seat_items[self._selected_seat_id].set_selected(False)
        
        self._selected_seat_id = seat_id
        if seat_id in self._seat_items:
            self._seat_items[seat_id].set_selected(True)
        
        self.seat_clicked.emit(seat_id)
    
    def _on_seat_double_clicked(self, seat_id: str):
        """座位双击"""
        self.seat_double_clicked.emit(seat_id)
    
    def _zoom_in(self):
        """放大"""
        self._zoom_factor *= 1.2
        self._view.scale(1.2, 1.2)
    
    def _zoom_out(self):
        """缩小"""
        self._zoom_factor /= 1.2
        self._view.scale(1/1.2, 1/1.2)
    
    def reset_zoom(self):
        """重置缩放"""
        self._view.resetTransform()
        self._zoom_factor = 1.0
    
    def get_selected_seat(self) -> Optional[str]:
        """获取选中的座位 ID"""
        return self._selected_seat_id
    
    def refresh(self):
        """刷新"""
        self._refresh_display()
    
    def clear_assignments(self, keep_locked: bool = True):
        """清空分配"""
        if self._layout:
            self._layout.clear_assignments(keep_locked=keep_locked)
            self._refresh_display()
            self.assignment_changed.emit()
    
    def assign_member(self, seat_id: str, member_id: str, is_locked: bool = False) -> bool:
        """分配成员到座位"""
        if not self._layout:
            return False
        
        try:
            self._layout.assign_member(seat_id, member_id, is_locked=is_locked)
            self._refresh_display()
            self.assignment_changed.emit()
            return True
        except Exception:
            return False
    
    def unassign_seat(self, seat_id: str) -> bool:
        """取消座位分配"""
        if not self._layout:
            return False
        
        try:
            result = self._layout.unassign_seat(seat_id)
            if result:
                self._refresh_display()
                self.assignment_changed.emit()
            return result
        except Exception:
            return False
