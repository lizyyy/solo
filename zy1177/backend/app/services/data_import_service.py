import json
import csv
import yaml
import os
from typing import Dict, List, Any, Optional, Tuple
from pathlib import Path
from datetime import datetime
from sqlalchemy.orm import Session

from ..models.warehouse_map import WarehouseMap
from ..models.robot import Robot, RobotStatus
from ..models.order import Order, OrderStatus
from ..config import settings


class DataImportService:
    def __init__(self, db: Session):
        self.db = db
    
    def import_warehouse_map(self, file_path: str) -> Tuple[WarehouseMap, Dict]:
        with open(file_path, 'r', encoding='utf-8') as f:
            map_data = json.load(f)
        
        name = map_data.get('name', 'Unnamed Warehouse')
        description = map_data.get('description', '')
        width = map_data.get('width', 100)
        height = map_data.get('height', 100)
        grid_size = map_data.get('grid_size', 1)
        
        existing = self.db.query(WarehouseMap).filter(
            WarehouseMap.name == name
        ).first()
        
        if existing:
            existing.map_data = json.dumps(map_data, ensure_ascii=False)
            existing.width = width
            existing.height = height
            existing.grid_size = grid_size
            existing.description = description
            warehouse_map = existing
        else:
            warehouse_map = WarehouseMap(
                name=name,
                description=description,
                width=width,
                height=height,
                grid_size=grid_size,
                map_data=json.dumps(map_data, ensure_ascii=False)
            )
            self.db.add(warehouse_map)
        
        self.db.commit()
        self.db.refresh(warehouse_map)
        
        stats = self._analyze_map_data(map_data)
        
        return warehouse_map, stats
    
    def _analyze_map_data(self, map_data: Dict) -> Dict:
        shelves = map_data.get('shelves', [])
        aisles = map_data.get('aisles', [])
        stations = map_data.get('stations', [])
        obstacles = map_data.get('obstacles', [])
        charging_stations = map_data.get('charging_stations', [])
        narrow_passages = map_data.get('narrow_passages', [])
        
        return {
            "total_shelves": len(shelves),
            "total_aisles": len(aisles),
            "total_stations": len(stations),
            "total_obstacles": len(obstacles),
            "total_charging_stations": len(charging_stations),
            "total_narrow_passages": len(narrow_passages),
            "map_dimensions": {
                "width": map_data.get('width', 0),
                "height": map_data.get('height', 0),
                "grid_size": map_data.get('grid_size', 1)
            }
        }
    
    def import_robots(self, file_path: str, warehouse_map_id: Optional[int] = None) -> Tuple[List[Robot], Dict]:
        with open(file_path, 'r', encoding='utf-8') as f:
            robots_data = yaml.safe_load(f)
        
        robots_list = robots_data.get('robots', []) if isinstance(robots_data, dict) else robots_data
        
        imported_robots = []
        stats = {
            "total": len(robots_list),
            "created": 0,
            "updated": 0,
            "errors": []
        }
        
        for robot_data in robots_list:
            try:
                robot_id = robot_data.get('id') or robot_data.get('robot_id')
                if not robot_id:
                    stats["errors"].append("Robot missing id")
                    continue
                
                existing = self.db.query(Robot).filter(
                    Robot.robot_id == str(robot_id)
                ).first()
                
                status = robot_data.get('status', 'idle')
                if isinstance(status, str):
                    try:
                        status_enum = RobotStatus[status.upper()]
                    except KeyError:
                        status_enum = RobotStatus.IDLE
                else:
                    status_enum = RobotStatus.IDLE
                
                if existing:
                    existing.name = robot_data.get('name', existing.name)
                    existing.current_x = robot_data.get('x', robot_data.get('current_x', existing.current_x))
                    existing.current_y = robot_data.get('y', robot_data.get('current_y', existing.current_y))
                    existing.current_z = robot_data.get('z', robot_data.get('current_z', existing.current_z))
                    existing.orientation = robot_data.get('orientation', existing.orientation)
                    existing.status = status_enum
                    existing.battery_level = robot_data.get('battery', robot_data.get('battery_level', existing.battery_level))
                    existing.max_speed = robot_data.get('max_speed', existing.max_speed)
                    existing.payload_capacity = robot_data.get('payload_capacity', existing.payload_capacity)
                    if warehouse_map_id:
                        existing.warehouse_map_id = warehouse_map_id
                    stats["updated"] += 1
                    robot = existing
                else:
                    robot = Robot(
                        robot_id=str(robot_id),
                        name=robot_data.get('name', f'Robot {robot_id}'),
                        current_x=robot_data.get('x', robot_data.get('current_x', 0.0)),
                        current_y=robot_data.get('y', robot_data.get('current_y', 0.0)),
                        current_z=robot_data.get('z', robot_data.get('current_z', 0.0)),
                        orientation=robot_data.get('orientation', 0.0),
                        status=status_enum,
                        battery_level=robot_data.get('battery', robot_data.get('battery_level', 100.0)),
                        max_speed=robot_data.get('max_speed', 1.0),
                        payload_capacity=robot_data.get('payload_capacity', 50.0),
                        warehouse_map_id=warehouse_map_id
                    )
                    self.db.add(robot)
                    stats["created"] += 1
                
                imported_robots.append(robot)
                
            except Exception as e:
                stats["errors"].append(f"Error importing robot: {str(e)}")
        
        self.db.commit()
        
        return imported_robots, stats
    
    def import_orders(self, file_path: str, warehouse_map_id: Optional[int] = None) -> Tuple[List[Order], Dict]:
        orders_list = []
        
        with open(file_path, 'r', encoding='utf-8') as f:
            if file_path.endswith('.csv'):
                reader = csv.DictReader(f)
                for row in reader:
                    orders_list.append(row)
            elif file_path.endswith('.json'):
                data = json.load(f)
                orders_list = data.get('orders', []) if isinstance(data, dict) else data
        
        imported_orders = []
        stats = {
            "total": len(orders_list),
            "created": 0,
            "updated": 0,
            "errors": []
        }
        
        for order_data in orders_list:
            try:
                order_id = order_data.get('id') or order_data.get('order_id')
                if not order_id:
                    stats["errors"].append("Order missing id")
                    continue
                
                existing = self.db.query(Order).filter(
                    Order.order_id == str(order_id)
                ).first()
                
                def get_float(key, default=0.0):
                    val = order_data.get(key, default)
                    if val is None or val == '':
                        return default
                    try:
                        return float(val)
                    except (ValueError, TypeError):
                        return default
                
                def get_int(key, default=1):
                    val = order_data.get(key, default)
                    if val is None or val == '':
                        return default
                    try:
                        return int(val)
                    except (ValueError, TypeError):
                        return default
                
                if existing:
                    existing.priority = get_int('priority', existing.priority)
                    existing.pickup_location_x = get_float('pickup_x', get_float('pickup_location_x', existing.pickup_location_x))
                    existing.pickup_location_y = get_float('pickup_y', get_float('pickup_location_y', existing.pickup_location_y))
                    existing.pickup_location_name = order_data.get('pickup_name', order_data.get('pickup_location_name', existing.pickup_location_name))
                    existing.dropoff_location_x = get_float('dropoff_x', get_float('dropoff_location_x', existing.dropoff_location_x))
                    existing.dropoff_location_y = get_float('dropoff_y', get_float('dropoff_location_y', existing.dropoff_location_y))
                    existing.dropoff_location_name = order_data.get('dropoff_name', order_data.get('dropoff_location_name', existing.dropoff_location_name))
                    existing.cargo_type = order_data.get('cargo_type', existing.cargo_type)
                    existing.cargo_weight = get_float('cargo_weight', existing.cargo_weight)
                    existing.cargo_volume = get_float('cargo_volume', existing.cargo_volume)
                    if warehouse_map_id:
                        existing.warehouse_map_id = warehouse_map_id
                    stats["updated"] += 1
                    order = existing
                else:
                    order = Order(
                        order_id=str(order_id),
                        priority=get_int('priority', 1),
                        pickup_location_x=get_float('pickup_x', get_float('pickup_location_x', 0.0)),
                        pickup_location_y=get_float('pickup_y', get_float('pickup_location_y', 0.0)),
                        pickup_location_name=order_data.get('pickup_name', order_data.get('pickup_location_name')),
                        dropoff_location_x=get_float('dropoff_x', get_float('dropoff_location_x', 0.0)),
                        dropoff_location_y=get_float('dropoff_y', get_float('dropoff_location_y', 0.0)),
                        dropoff_location_name=order_data.get('dropoff_name', order_data.get('dropoff_location_name')),
                        cargo_type=order_data.get('cargo_type'),
                        cargo_weight=get_float('cargo_weight', 0.0),
                        cargo_volume=get_float('cargo_volume', 0.0),
                        status=OrderStatus.PENDING,
                        warehouse_map_id=warehouse_map_id
                    )
                    self.db.add(order)
                    stats["created"] += 1
                
                imported_orders.append(order)
                
            except Exception as e:
                stats["errors"].append(f"Error importing order: {str(e)}")
        
        self.db.commit()
        
        return imported_orders, stats
    
    def validate_map_file(self, map_data: Dict) -> Tuple[bool, List[str]]:
        errors = []
        warnings = []
        
        required_fields = ['width', 'height', 'grid_size']
        for field in required_fields:
            if field not in map_data:
                errors.append(f"Missing required field: {field}")
        
        if 'grid' in map_data:
            grid = map_data['grid']
            height = map_data.get('height', 0)
            width = map_data.get('width', 0)
            
            if len(grid) != height:
                warnings.append(f"Grid height ({len(grid)}) does not match map height ({height})")
            
            for i, row in enumerate(grid):
                if len(row) != width:
                    warnings.append(f"Row {i} width ({len(row)}) does not match map width ({width})")
        
        if 'shelves' in map_data:
            for i, shelf in enumerate(map_data['shelves']):
                required_shelf = ['x', 'y']
                for field in required_shelf:
                    if field not in shelf:
                        warnings.append(f"Shelf {i} missing field: {field}")
        
        if 'stations' in map_data:
            for i, station in enumerate(map_data['stations']):
                required_station = ['x', 'y', 'type']
                for field in required_station:
                    if field not in station:
                        warnings.append(f"Station {i} missing field: {field}")
        
        return len(errors) == 0, errors + warnings
    
    def validate_robots_file(self, robots_data: List[Dict]) -> Tuple[bool, List[str]]:
        errors = []
        warnings = []
        
        for i, robot in enumerate(robots_data):
            robot_id = robot.get('id') or robot.get('robot_id')
            if not robot_id:
                errors.append(f"Robot {i} missing id")
            
            x = robot.get('x', robot.get('current_x'))
            y = robot.get('y', robot.get('current_y'))
            if x is None or y is None:
                warnings.append(f"Robot {robot_id} missing position coordinates")
            
            battery = robot.get('battery', robot.get('battery_level', 100))
            if battery < 0 or battery > 100:
                warnings.append(f"Robot {robot_id} has invalid battery level: {battery}")
        
        return len(errors) == 0, errors + warnings
    
    def validate_orders_file(self, orders_data: List[Dict]) -> Tuple[bool, List[str]]:
        errors = []
        warnings = []
        
        for i, order in enumerate(orders_data):
            order_id = order.get('id') or order.get('order_id')
            if not order_id:
                errors.append(f"Order {i} missing id")
            
            pickup_x = order.get('pickup_x', order.get('pickup_location_x'))
            pickup_y = order.get('pickup_y', order.get('pickup_location_y'))
            if pickup_x is None or pickup_y is None:
                warnings.append(f"Order {order_id} missing pickup location")
            
            dropoff_x = order.get('dropoff_x', order.get('dropoff_location_x'))
            dropoff_y = order.get('dropoff_y', order.get('dropoff_location_y'))
            if dropoff_x is None or dropoff_y is None:
                warnings.append(f"Order {order_id} missing dropoff location")
            
            cargo_weight = order.get('cargo_weight', 0)
            if cargo_weight and float(cargo_weight) < 0:
                warnings.append(f"Order {order_id} has negative cargo weight")
        
        return len(errors) == 0, errors + warnings
