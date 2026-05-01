from typing import List
import uuid

from models.piece import Piece
from models.project import Project
from models.fabric import FabricSettings
from geometry.point import Point


def create_sample_pieces() -> List[Piece]:
    pieces = []
    
    front_body = Piece()
    front_body.id = str(uuid.uuid4())[:8]
    front_body.name = "前衣片"
    front_body.color = "#4A90D9"
    front_body.quantity = 1
    front_body.can_rotate = False
    front_body.grain_direction = 0.0
    front_body.points = [
        Point(0, 0),
        Point(25, 0),
        Point(25, 8),
        Point(22, 12),
        Point(25, 18),
        Point(25, 50),
        Point(12.5, 65),
        Point(0, 50),
        Point(0, 18),
        Point(3, 12),
        Point(0, 8),
    ]
    pieces.append(front_body)
    
    back_body = Piece()
    back_body.id = str(uuid.uuid4())[:8]
    back_body.name = "后衣片"
    back_body.color = "#D94A4A"
    back_body.quantity = 1
    back_body.can_rotate = False
    back_body.grain_direction = 0.0
    back_body.points = [
        Point(0, 0),
        Point(25, 0),
        Point(25, 6),
        Point(21, 10),
        Point(25, 16),
        Point(25, 48),
        Point(12.5, 62),
        Point(0, 48),
        Point(0, 16),
        Point(4, 10),
        Point(0, 6),
    ]
    pieces.append(back_body)
    
    left_sleeve = Piece()
    left_sleeve.id = str(uuid.uuid4())[:8]
    left_sleeve.name = "左袖片"
    left_sleeve.color = "#4AD94A"
    left_sleeve.quantity = 1
    left_sleeve.can_rotate = True
    left_sleeve.allow_rotate_180 = True
    left_sleeve.points = [
        Point(0, 0),
        Point(18, 0),
        Point(22, 8),
        Point(20, 35),
        Point(18, 42),
        Point(10, 42),
        Point(8, 35),
        Point(-2, 8),
    ]
    pieces.append(left_sleeve)
    
    right_sleeve = Piece()
    right_sleeve.id = str(uuid.uuid4())[:8]
    right_sleeve.name = "右袖片"
    right_sleeve.color = "#D9D94A"
    right_sleeve.quantity = 1
    right_sleeve.can_rotate = True
    right_sleeve.allow_rotate_180 = True
    right_sleeve.mirror = True
    right_sleeve.points = [
        Point(0, 0),
        Point(18, 0),
        Point(22, 8),
        Point(20, 35),
        Point(18, 42),
        Point(10, 42),
        Point(8, 35),
        Point(-2, 8),
    ]
    pieces.append(right_sleeve)
    
    collar = Piece()
    collar.id = str(uuid.uuid4())[:8]
    collar.name = "领子"
    collar.color = "#D94AD9"
    collar.quantity = 1
    collar.can_rotate = True
    collar.points = [
        Point(0, 0),
        Point(30, 0),
        Point(30, 8),
        Point(25, 12),
        Point(5, 12),
        Point(0, 8),
    ]
    pieces.append(collar)
    
    left_cuff = Piece()
    left_cuff.id = str(uuid.uuid4())[:8]
    left_cuff.name = "左袖口"
    left_cuff.color = "#4AD9D9"
    left_cuff.quantity = 1
    left_cuff.can_rotate = True
    left_cuff.points = [
        Point(0, 0),
        Point(20, 0),
        Point(20, 5),
        Point(0, 5),
    ]
    pieces.append(left_cuff)
    
    right_cuff = Piece()
    right_cuff.id = str(uuid.uuid4())[:8]
    right_cuff.name = "右袖口"
    right_cuff.color = "#9AD94A"
    right_cuff.quantity = 1
    right_cuff.can_rotate = True
    right_cuff.points = [
        Point(0, 0),
        Point(20, 0),
        Point(20, 5),
        Point(0, 5),
    ]
    pieces.append(right_cuff)
    
    pocket = Piece()
    pocket.id = str(uuid.uuid4())[:8]
    pocket.name = "口袋"
    pocket.color = "#D99A4A"
    pocket.quantity = 2
    pocket.can_rotate = False
    pocket.has_plaid_match = True
    pocket.points = [
        Point(0, 0),
        Point(12, 0),
        Point(12, 10),
        Point(0, 10),
    ]
    pieces.append(pocket)
    
    return pieces


def create_tshirt_pieces() -> List[Piece]:
    pieces = []
    
    front = Piece()
    front.id = str(uuid.uuid4())[:8]
    front.name = "前片"
    front.color = "#3498DB"
    front.quantity = 1
    front.can_rotate = False
    front.grain_direction = 0.0
    front.points = [
        Point(0, 0),
        Point(35, 0),
        Point(35, 10),
        Point(30, 15),
        Point(35, 25),
        Point(35, 60),
        Point(17.5, 70),
        Point(0, 60),
        Point(0, 25),
        Point(5, 15),
        Point(0, 10),
    ]
    pieces.append(front)
    
    back = Piece()
    back.id = str(uuid.uuid4())[:8]
    back.name = "后片"
    back.color = "#E74C3C"
    back.quantity = 1
    back.can_rotate = False
    back.grain_direction = 0.0
    back.points = [
        Point(0, 0),
        Point(35, 0),
        Point(35, 8),
        Point(29, 13),
        Point(35, 22),
        Point(35, 58),
        Point(17.5, 68),
        Point(0, 58),
        Point(0, 22),
        Point(6, 13),
        Point(0, 8),
    ]
    pieces.append(back)
    
    sleeve_left = Piece()
    sleeve_left.id = str(uuid.uuid4())[:8]
    sleeve_left.name = "左袖"
    sleeve_left.color = "#2ECC71"
    sleeve_left.quantity = 1
    sleeve_left.can_rotate = True
    sleeve_left.points = [
        Point(0, 0),
        Point(20, 0),
        Point(24, 10),
        Point(22, 30),
        Point(20, 35),
        Point(10, 35),
        Point(8, 30),
        Point(-4, 10),
    ]
    pieces.append(sleeve_left)
    
    sleeve_right = Piece()
    sleeve_right.id = str(uuid.uuid4())[:8]
    sleeve_right.name = "右袖"
    sleeve_right.color = "#F39C12"
    sleeve_right.quantity = 1
    sleeve_right.can_rotate = True
    sleeve_right.mirror = True
    sleeve_right.points = [
        Point(0, 0),
        Point(20, 0),
        Point(24, 10),
        Point(22, 30),
        Point(20, 35),
        Point(10, 35),
        Point(8, 30),
        Point(-4, 10),
    ]
    pieces.append(sleeve_right)
    
    return pieces


def create_sample_project() -> Project:
    project = Project(name="T恤样板项目")
    project.notes = "这是一个示例T恤项目，用于演示纸样排料功能。"
    
    fabric = FabricSettings()
    fabric.name = "纯棉平纹布"
    fabric.width = 150.0
    fabric.shrinkage_x = 3.0
    fabric.shrinkage_y = 5.0
    fabric.grain_direction = 0.0
    fabric.safety_margin = 0.5
    fabric.has_plaid = False
    
    project.fabric_settings = fabric
    
    for piece in create_tshirt_pieces():
        project.add_piece(piece)
    
    return project
