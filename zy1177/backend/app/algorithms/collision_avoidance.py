from typing import List, Dict, Tuple, Optional
from dataclasses import dataclass
import math
from enum import Enum


class RiskLevel(Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


@dataclass
class RobotState:
    id: str
    x: float
    y: float
    vx: float
    vy: float
    orientation: float
    radius: float
    status: str
    path: List[Tuple[float, float]]
    current_path_index: int = 0


@dataclass
class CollisionRisk:
    risk_id: str
    robot1_id: str
    robot2_id: str
    risk_level: RiskLevel
    distance: float
    time_to_collision: Optional[float]
    position1: Tuple[float, float]
    position2: Tuple[float, float]
    description: str
    suggested_action: str


class CollisionDetectionSystem:
    def __init__(
        self,
        safety_distance: float = 2.0,
        warning_distance: float = 4.0,
        robot_radius: float = 0.5
    ):
        self.safety_distance = safety_distance
        self.warning_distance = warning_distance
        self.robot_radius = robot_radius
    
    def calculate_distance(
        self,
        pos1: Tuple[float, float],
        pos2: Tuple[float, float]
    ) -> float:
        dx = pos1[0] - pos2[0]
        dy = pos1[1] - pos2[1]
        return math.sqrt(dx * dx + dy * dy)
    
    def predict_position(
        self,
        robot: RobotState,
        time_delta: float
    ) -> Tuple[float, float]:
        if not robot.path or robot.current_path_index >= len(robot.path):
            return (robot.x, robot.y)
        
        target = robot.path[robot.current_path_index]
        dx = target[0] - robot.x
        dy = target[1] - robot.y
        distance = math.sqrt(dx * dx + dy * dy)
        
        if distance < 0.1:
            return (robot.x, robot.y)
        
        speed = math.sqrt(robot.vx * robot.vx + robot.vy * robot.vy) or 1.0
        move_distance = speed * time_delta
        
        if move_distance >= distance:
            return target
        else:
            ratio = move_distance / distance
            return (
                robot.x + dx * ratio,
                robot.y + dy * ratio
            )
    
    def check_pair_collision(
        self,
        robot1: RobotState,
        robot2: RobotState,
        time_delta: float = 0.1,
        max_lookahead: float = 5.0
    ) -> Optional[CollisionRisk]:
        current_distance = self.calculate_distance(
            (robot1.x, robot1.y),
            (robot2.x, robot2.y)
        )
        
        min_distance = current_distance
        ttc = None
        
        for t in range(0, int(max_lookahead / time_delta) + 1):
            time = t * time_delta
            pos1 = self.predict_position(robot1, time)
            pos2 = self.predict_position(robot2, time)
            dist = self.calculate_distance(pos1, pos2)
            
            if dist < min_distance:
                min_distance = dist
                if dist < self.safety_distance + self.robot_radius * 2:
                    ttc = time
        
        collision_distance = self.robot_radius * 2
        
        if min_distance <= collision_distance:
            risk_level = RiskLevel.CRITICAL
            action = "立即停车等待"
        elif min_distance <= self.safety_distance:
            risk_level = RiskLevel.HIGH
            action = "减速并准备停车"
        elif min_distance <= self.warning_distance:
            risk_level = RiskLevel.MEDIUM
            action = "保持警惕，监控距离"
        else:
            return None
        
        return CollisionRisk(
            risk_id=f"risk_{robot1.id}_{robot2.id}",
            robot1_id=robot1.id,
            robot2_id=robot2.id,
            risk_level=risk_level,
            distance=current_distance,
            time_to_collision=ttc,
            position1=(robot1.x, robot1.y),
            position2=(robot2.x, robot2.y),
            description=f"机器人 {robot1.id} 和 {robot2.id} 存在碰撞风险，当前距离: {current_distance:.2f}m",
            suggested_action=action
        )
    
    def detect_all_collisions(
        self,
        robots: List[RobotState]
    ) -> List[CollisionRisk]:
        risks = []
        n = len(robots)
        
        for i in range(n):
            for j in range(i + 1, n):
                risk = self.check_pair_collision(robots[i], robots[j])
                if risk:
                    risks.append(risk)
        
        risks.sort(key=lambda r: {
            RiskLevel.CRITICAL: 0,
            RiskLevel.HIGH: 1,
            RiskLevel.MEDIUM: 2,
            RiskLevel.LOW: 3
        }[r.risk_level])
        
        return risks


class CollisionAvoidanceSystem:
    def __init__(
        self,
        safety_distance: float = 2.0,
        robot_radius: float = 0.5
    ):
        self.safety_distance = safety_distance
        self.robot_radius = robot_radius
    
    def resolve_collision(
        self,
        risk: CollisionRisk,
        robots: Dict[str, RobotState]
    ) -> Dict[str, Dict]:
        actions = {}
        
        if risk.risk_level == RiskLevel.CRITICAL:
            actions[risk.robot1_id] = {
                "action": "STOP",
                "reason": "紧急避撞",
                "speed_multiplier": 0.0
            }
            actions[risk.robot2_id] = {
                "action": "STOP",
                "reason": "紧急避撞",
                "speed_multiplier": 0.0
            }
        
        elif risk.risk_level == RiskLevel.HIGH:
            priority_robot = self._determine_priority(
                robots[risk.robot1_id],
                robots[risk.robot2_id]
            )
            
            if priority_robot == risk.robot1_id:
                actions[risk.robot1_id] = {
                    "action": "CONTINUE",
                    "reason": "优先级较高",
                    "speed_multiplier": 1.0
                }
                actions[risk.robot2_id] = {
                    "action": "WAIT",
                    "reason": "让行优先级较高的机器人",
                    "speed_multiplier": 0.0
                }
            else:
                actions[risk.robot1_id] = {
                    "action": "WAIT",
                    "reason": "让行优先级较高的机器人",
                    "speed_multiplier": 0.0
                }
                actions[risk.robot2_id] = {
                    "action": "CONTINUE",
                    "reason": "优先级较高",
                    "speed_multiplier": 1.0
                }
        
        elif risk.risk_level == RiskLevel.MEDIUM:
            actions[risk.robot1_id] = {
                "action": "SLOW_DOWN",
                "reason": "接近其他机器人",
                "speed_multiplier": 0.5
            }
            actions[risk.robot2_id] = {
                "action": "SLOW_DOWN",
                "reason": "接近其他机器人",
                "speed_multiplier": 0.5
            }
        
        return actions
    
    def _determine_priority(
        self,
        robot1: RobotState,
        robot2: RobotState
    ) -> str:
        status_priority = {
            "charging": 1,
            "fault": 1,
            "unloading": 2,
            "loading": 2,
            "moving": 3,
            "waiting": 4,
            "idle": 5
        }
        
        r1_prio = status_priority.get(robot1.status, 5)
        r2_prio = status_priority.get(robot2.status, 5)
        
        if r1_prio < r2_prio:
            return robot1.id
        elif r2_prio < r1_prio:
            return robot2.id
        else:
            return min(robot1.id, robot2.id)


class NarrowPassageManager:
    def __init__(
        self,
        passage_width_threshold: float = 2.0,
        safety_margin: float = 0.5
    ):
        self.passage_width_threshold = passage_width_threshold
        self.safety_margin = safety_margin
        self.passage_registry: Dict[str, Dict] = {}
    
    def register_narrow_passage(
        self,
        passage_id: str,
        start_pos: Tuple[float, float],
        end_pos: Tuple[float, float],
        width: float
    ):
        self.passage_registry[passage_id] = {
            "start": start_pos,
            "end": end_pos,
            "width": width,
            "is_occupied": False,
            "current_robot": None,
            "queue": []
        }
    
    def check_narrow_passage(
        self,
        robot: RobotState,
        next_position: Tuple[float, float]
    ) -> Optional[Dict]:
        for passage_id, passage in self.passage_registry.items():
            if self._is_near_passage(
                (robot.x, robot.y),
                next_position,
                passage
            ):
                return {
                    "passage_id": passage_id,
                    "passage": passage,
                    "needs_authorization": True
                }
        return None
    
    def _is_near_passage(
        self,
        current_pos: Tuple[float, float],
        next_pos: Tuple[float, float],
        passage: Dict
    ) -> bool:
        passage_start = passage["start"]
        passage_end = passage["end"]
        
        def point_to_line_distance(px, py, x1, y1, x2, y2):
            line_len = math.sqrt((x2 - x1)**2 + (y2 - y1)**2)
            if line_len == 0:
                return math.sqrt((px - x1)**2 + (py - y1)**2)
            
            t = max(0, min(1, ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / (line_len**2)))
            proj_x = x1 + t * (x2 - x1)
            proj_y = y1 + t * (y2 - y1)
            
            return math.sqrt((px - proj_x)**2 + (py - proj_y)**2)
        
        dist_current = point_to_line_distance(
            current_pos[0], current_pos[1],
            passage_start[0], passage_start[1],
            passage_end[0], passage_end[1]
        )
        
        dist_next = point_to_line_distance(
            next_pos[0], next_pos[1],
            passage_start[0], passage_start[1],
            passage_end[0], passage_end[1]
        )
        
        return dist_current < self.passage_width_threshold or \
               dist_next < self.passage_width_threshold
    
    def request_passage(
        self,
        passage_id: str,
        robot_id: str
    ) -> Dict:
        if passage_id not in self.passage_registry:
            return {"allowed": True, "reason": "通道未注册"}
        
        passage = self.passage_registry[passage_id]
        
        if not passage["is_occupied"]:
            passage["is_occupied"] = True
            passage["current_robot"] = robot_id
            return {"allowed": True, "reason": "通道空闲，已授权"}
        else:
            if robot_id not in passage["queue"]:
                passage["queue"].append(robot_id)
            queue_position = passage["queue"].index(robot_id) + 1
            return {
                "allowed": False,
                "reason": f"通道被 {passage['current_robot']} 占用，您在队列第 {queue_position} 位",
                "queue_position": queue_position,
                "current_occupant": passage["current_robot"]
            }
    
    def release_passage(
        self,
        passage_id: str,
        robot_id: str
    ) -> Dict:
        if passage_id not in self.passage_registry:
            return {"success": False, "reason": "通道未注册"}
        
        passage = self.passage_registry[passage_id]
        
        if passage["current_robot"] != robot_id:
            return {"success": False, "reason": "您不是当前通道占用者"}
        
        passage["is_occupied"] = False
        passage["current_robot"] = None
        
        if passage["queue"]:
            next_robot = passage["queue"].pop(0)
            passage["is_occupied"] = True
            passage["current_robot"] = next_robot
            return {
                "success": True,
                "released": True,
                "next_robot": next_robot,
                "message": f"通道已释放，机器人 {next_robot} 可通过"
            }
        
        return {
            "success": True,
            "released": True,
            "message": "通道已释放，队列为空"
        }
