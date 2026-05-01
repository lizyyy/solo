from typing import Optional, List, Dict
import math

from PyQt5.QtWidgets import QWidget
from PyQt5.QtCore import Qt, pyqtSignal, QPoint, QPointF, QRectF
from PyQt5.QtGui import (
    QPainter, QColor, QPen, QBrush, QFont, 
    QPolygonF, QTransform, QCursor, QMouseEvent
)

from models.piece import Piece, PiecePlacement
from models.fabric import FabricSettings
from models.project import Project
from geometry.point import Point
from geometry.rectangle import Rectangle
from geometry.transform import Transform


class NestingCanvas(QWidget):
    piece_selected = pyqtSignal(str)
    piece_moved = pyqtSignal(str, float, float)
    piece_rotated = pyqtSignal(str, float)
    piece_placed = pyqtSignal(str, bool)

    def __init__(self, parent=None):
        super().__init__(parent)
        
        self._project: Optional[Project] = None
        self._fabric_settings: Optional[FabricSettings] = None
        self._placements: List[PiecePlacement] = []
        
        self._selected_piece_id: Optional[str] = None
        self._hover_piece_id: Optional[str] = None
        
        self._zoom: float = 1.0
        self._pan_x: float = 0.0
        self._pan_y: float = 0.0
        
        self._show_grid: bool = True
        self._grid_size: float = 10.0
        
        self._is_dragging: bool = False
        self._is_rotating: bool = False
        self._drag_start_pos: QPoint = QPoint()
        self._drag_piece_id: Optional[str] = None
        self._drag_start_rotation: float = 0.0
        
        self._fabric_length: float = 300.0
        
        self.setMouseTracking(True)
        self.setMinimumSize(800, 600)
        self.setFocusPolicy(Qt.StrongFocus)

    def set_project(self, project: Project):
        self._project = project
        self.update()

    def set_fabric_settings(self, settings: FabricSettings):
        self._fabric_settings = settings
        self.update()

    def set_placements(self, placements: List[PiecePlacement]):
        self._placements = placements
        self._update_fabric_length()
        self.update()

    def set_selected_piece(self, piece_id: str):
        self._selected_piece_id = piece_id
        self.update()

    def set_show_grid(self, show: bool):
        self._show_grid = show
        self.update()

    def zoom_in(self):
        self._zoom *= 1.2
        self.update()

    def zoom_out(self):
        self._zoom /= 1.2
        self.update()

    def reset_zoom(self):
        self._zoom = 1.0
        self._pan_x = 0.0
        self._pan_y = 0.0
        self.update()

    def _update_fabric_length(self):
        max_y = 0.0
        for placement in self._placements:
            if placement.is_placed:
                bounds = Transform.get_bounds_after_transform(
                    placement.piece.points,
                    placement.position,
                    placement.rotation,
                    placement.mirror
                )
                max_y = max(max_y, bounds.bottom + 20)
        
        self._fabric_length = max(200.0, max_y)

    def paintEvent(self, event):
        painter = QPainter(self)
        painter.setRenderHint(QPainter.Antialiasing)
        
        painter.fillRect(self.rect(), QColor(245, 245, 245))
        
        painter.save()
        painter.translate(self._pan_x, self._pan_y)
        painter.scale(self._zoom, self._zoom)
        
        margin = 20
        origin_x = margin
        origin_y = margin
        
        fabric_width = 150.0
        if self._fabric_settings:
            fabric_width = self._fabric_settings.width
        
        fabric_rect = QRectF(origin_x, origin_y, fabric_width, self._fabric_length)
        
        fabric_brush = QBrush(QColor(255, 255, 240))
        painter.fillRect(fabric_rect, fabric_brush)
        
        fabric_pen = QPen(QColor(100, 100, 100), 1.0 / self._zoom)
        painter.setPen(fabric_pen)
        painter.drawRect(fabric_rect)
        
        if self._show_grid:
            self._draw_grid(painter, origin_x, origin_y, fabric_width, self._fabric_length)
        
        if self._fabric_settings and self._fabric_settings.no_place_zones:
            for zone in self._fabric_settings.no_place_zones:
                zone_rect = QRectF(
                    origin_x + zone.zone.x,
                    origin_y + zone.zone.y,
                    zone.zone.width,
                    zone.zone.height
                )
                no_place_brush = QBrush(QColor(255, 200, 200, 128))
                painter.fillRect(zone_rect, no_place_brush)
                painter.drawRect(zone_rect)
                
                painter.save()
                painter.setFont(QFont("Arial", 10 / self._zoom))
                painter.drawText(zone_rect, Qt.AlignCenter, zone.name)
                painter.restore()
        
        for placement in self._placements:
            if placement.is_placed:
                self._draw_piece(painter, placement, origin_x, origin_y)
        
        for placement in self._placements:
            if not placement.is_placed:
                self._draw_piece(painter, placement, origin_x, origin_y)
        
        painter.restore()

    def _draw_grid(self, painter: QPainter, x: float, y: float, width: float, height: float):
        grid_pen = QPen(QColor(230, 230, 230), 0.5 / self._zoom)
        painter.setPen(grid_pen)
        
        grid_size = self._grid_size
        
        grid_x = x
        while grid_x <= x + width:
            painter.drawLine(QPointF(grid_x, y), QPointF(grid_x, y + height))
            grid_x += grid_size
        
        grid_y = y
        while grid_y <= y + height:
            painter.drawLine(QPointF(x, grid_y), QPointF(x + width, grid_y))
            grid_y += grid_size

    def _draw_piece(self, painter: QPainter, placement: PiecePlacement, origin_x: float, origin_y: float):
        piece = placement.piece
        
        transformed_points = Transform.get_transformed_polygon(
            piece.points,
            placement.position,
            placement.rotation,
            placement.mirror
        ).points
        
        q_points = []
        for p in transformed_points[:-1]:
            q_points.append(QPointF(origin_x + p.x, origin_y + p.y))
        
        polygon = QPolygonF(q_points)
        
        is_selected = (piece.id == self._selected_piece_id)
        is_hover = (piece.id == self._hover_piece_id)
        
        color = QColor(piece.color) if piece.color else QColor(74, 144, 217)
        
        if not placement.is_placed:
            color = color.lighter(150)
            color.setAlpha(180)
        else:
            color.setAlpha(200 if is_selected or is_hover else 150)
        
        brush = QBrush(color)
        painter.setBrush(brush)
        
        if is_selected:
            pen = QPen(QColor(255, 100, 0), 2.0 / self._zoom)
        elif is_hover:
            pen = QPen(QColor(0, 150, 255), 1.5 / self._zoom)
        else:
            pen = QPen(QColor(50, 50, 50), 1.0 / self._zoom)
        
        painter.setPen(pen)
        painter.drawPolygon(polygon)
        
        bounds = Transform.get_bounds_after_transform(
            piece.points,
            placement.position,
            placement.rotation,
            placement.mirror
        )
        
        center_x = origin_x + bounds.center.x
        center_y = origin_y + bounds.center.y
        
        painter.save()
        painter.setFont(QFont("Arial", 8 / self._zoom))
        painter.setPen(QColor(0, 0, 0))
        
        name = piece.name or "裁片"
        painter.drawText(QPointF(center_x, center_y - 4 / self._zoom), name)
        
        if is_selected and placement.is_placed:
            painter.setFont(QFont("Arial", 6 / self._zoom))
            info = f"({placement.position.x:.1f}, {placement.position.y:.1f}) | {placement.rotation}°"
            painter.drawText(QPointF(center_x, center_y + 8 / self._zoom), info)
        
        painter.restore()
        
        if is_selected and placement.is_placed:
            handle_size = 6 / self._zoom
            handle_pos = QPointF(
                center_x,
                origin_y + bounds.top - 20 / self._zoom
            )
            
            painter.setBrush(QBrush(QColor(255, 200, 100)))
            painter.setPen(QPen(QColor(200, 150, 50), 1.0 / self._zoom))
            painter.drawEllipse(handle_pos, handle_size, handle_size)
            
            painter.setPen(QPen(QColor(150, 100, 0), 1.0 / self._zoom))
            painter.drawLine(QPointF(center_x, origin_y + bounds.top), handle_pos)

    def mousePressEvent(self, event: QMouseEvent):
        scene_pos = self._widget_to_scene(event.pos())
        
        piece_id = self._get_piece_at_position(scene_pos)
        
        if piece_id:
            self._selected_piece_id = piece_id
            self.piece_selected.emit(piece_id)
            
            placement = self._get_placement_by_id(piece_id)
            if placement:
                if self._is_on_rotation_handle(scene_pos, placement):
                    self._is_rotating = True
                    self._drag_start_pos = event.pos()
                    self._drag_start_rotation = placement.rotation
                else:
                    self._is_dragging = True
                    self._drag_piece_id = piece_id
                    self._drag_start_pos = event.pos()
                
                self.setCursor(QCursor(Qt.ClosedHandCursor))
        
        self.update()

    def mouseMoveEvent(self, event: QMouseEvent):
        scene_pos = self._widget_to_scene(event.pos())
        
        if self._is_dragging and self._drag_piece_id:
            delta = event.pos() - self._drag_start_pos
            delta_x = delta.x() / self._zoom
            delta_y = delta.y() / self._zoom
            
            placement = self._get_placement_by_id(self._drag_piece_id)
            if placement:
                new_x = placement.position.x + delta_x
                new_y = placement.position.y + delta_y
                
                placement.position = Point(new_x, new_y)
                placement.is_placed = True
                
                self.piece_moved.emit(self._drag_piece_id, new_x, new_y)
                
                self._drag_start_pos = event.pos()
                self.update()
        
        elif self._is_rotating and self._drag_piece_id:
            delta = event.pos() - self._drag_start_pos
            delta_angle = delta.x() * 0.5
            
            placement = self._get_placement_by_id(self._drag_piece_id)
            if placement:
                new_angle = self._drag_start_rotation + delta_angle
                new_angle = new_angle % 360
                
                placement.rotation = new_angle
                self.piece_rotated.emit(self._drag_piece_id, new_angle)
                self.update()
        
        else:
            piece_id = self._get_piece_at_position(scene_pos)
            if piece_id != self._hover_piece_id:
                self._hover_piece_id = piece_id
                self.update()
            
            if piece_id:
                self.setCursor(QCursor(Qt.OpenHandCursor))
            else:
                self.setCursor(QCursor(Qt.ArrowCursor))

    def mouseReleaseEvent(self, event: QMouseEvent):
        if self._is_dragging:
            self._is_dragging = False
            self._drag_piece_id = None
        
        if self._is_rotating:
            self._is_rotating = False
        
        self.setCursor(QCursor(Qt.ArrowCursor))

    def wheelEvent(self, event):
        delta = event.angleDelta().y() / 120.0
        
        old_zoom = self._zoom
        if delta > 0:
            self._zoom *= 1.1 ** delta
        else:
            self._zoom /= 1.1 ** (-delta)
        
        self._zoom = max(0.1, min(5.0, self._zoom))
        
        pos = event.pos()
        scene_pos = self._widget_to_scene(pos)
        
        new_widget_x = scene_pos.x * self._zoom + self._pan_x
        new_widget_y = scene_pos.y * self._zoom + self._pan_y
        
        self._pan_x += pos.x() - new_widget_x
        self._pan_y += pos.y() - new_widget_y
        
        self.update()
        event.accept()

    def keyPressEvent(self, event):
        if event.key() == Qt.Key_Delete:
            if self._selected_piece_id:
                pass
        
        elif event.key() == Qt.Key_R:
            if self._selected_piece_id:
                placement = self._get_placement_by_id(self._selected_piece_id)
                if placement:
                    placement.rotation = (placement.rotation + 90) % 360
                    self.piece_rotated.emit(self._selected_piece_id, placement.rotation)
                    self.update()
        
        elif event.key() == Qt.Key_M:
            if self._selected_piece_id:
                placement = self._get_placement_by_id(self._selected_piece_id)
                if placement:
                    placement.mirror = not placement.mirror
                    self.update()
        
        event.accept()

    def _widget_to_scene(self, widget_pos: QPoint) -> Point:
        x = (widget_pos.x() - self._pan_x) / self._zoom
        y = (widget_pos.y() - self._pan_y) / self._zoom
        return Point(x, y)

    def _scene_to_widget(self, scene_pos: Point) -> QPoint:
        x = int(scene_pos.x * self._zoom + self._pan_x)
        y = int(scene_pos.y * self._zoom + self._pan_y)
        return QPoint(x, y)

    def _get_piece_at_position(self, scene_pos: Point) -> Optional[str]:
        margin = 20
        
        for placement in reversed(self._placements):
            if not placement.is_placed:
                continue
            
            transformed_points = Transform.get_transformed_polygon(
                placement.piece.points,
                placement.position,
                placement.rotation,
                placement.mirror
            )
            
            test_point = Point(scene_pos.x - margin, scene_pos.y - margin)
            
            if transformed_points.contains_point(test_point):
                return placement.piece.id
        
        for placement in reversed(self._placements):
            if placement.is_placed:
                continue
            
            transformed_points = Transform.get_transformed_polygon(
                placement.piece.points,
                placement.position,
                placement.rotation,
                placement.mirror
            )
            
            test_point = Point(scene_pos.x - margin, scene_pos.y - margin)
            
            if transformed_points.contains_point(test_point):
                return placement.piece.id
        
        return None

    def _get_placement_by_id(self, piece_id: str) -> Optional[PiecePlacement]:
        for placement in self._placements:
            if placement.piece.id == piece_id:
                return placement
        return None

    def _is_on_rotation_handle(self, scene_pos: Point, placement: PiecePlacement) -> bool:
        if not placement.is_placed:
            return False
        
        margin = 20
        bounds = Transform.get_bounds_after_transform(
            placement.piece.points,
            placement.position,
            placement.rotation,
            placement.mirror
        )
        
        handle_x = margin + bounds.center.x
        handle_y = margin + bounds.top - 20 / self._zoom
        
        dist = math.sqrt(
            (scene_pos.x - handle_x) ** 2 +
            (scene_pos.y - handle_y) ** 2
        )
        
        return dist < 10 / self._zoom
