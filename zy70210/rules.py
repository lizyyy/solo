from typing import List, Tuple, Optional, Dict
from models import (
    Route,
    Hold,
    ClimbFeedback,
    DifficultyLevel,
    HoldType,
    RouteStatus,
)


class HoldDifficultyRules:
    @staticmethod
    def get_hold_base_difficulty(hold_type: HoldType) -> float:
        base_difficulty = {
            HoldType.JUG: 0.2,
            HoldType.POCKET: 0.5,
            HoldType.PINCH: 0.6,
            HoldType.CRIMP: 0.8,
            HoldType.SLOPER: 0.9,
            HoldType.FOOTHOLD: 0.1,
        }
        return base_difficulty.get(hold_type, 0.5)

    @staticmethod
    def calculate_hold_difficulty(hold: Hold) -> float:
        base = HoldDifficultyRules.get_hold_base_difficulty(hold.type)
        size_factor = max(0.3, 1.5 - hold.size)
        difficulty = base * size_factor * hold.difficulty_contribution
        return difficulty


class WallAngleRules:
    @staticmethod
    def get_angle_multiplier(angle: float) -> float:
        if angle <= 0:
            return 0.8 + (angle * -0.008)
        elif angle <= 15:
            return 1.0
        elif angle <= 30:
            return 1.0 + (angle - 15) * 0.02
        elif angle <= 45:
            return 1.3 + (angle - 30) * 0.03
        else:
            return 1.75 + (angle - 45) * 0.02


class DifficultyConversionRules:
    DIFFICULTY_MAP = [
        (0.0, 1.5, DifficultyLevel.V0),
        (1.5, 2.5, DifficultyLevel.V1),
        (2.5, 3.5, DifficultyLevel.V2),
        (3.5, 4.5, DifficultyLevel.V3),
        (4.5, 5.5, DifficultyLevel.V4),
        (5.5, 6.5, DifficultyLevel.V5),
        (6.5, 7.5, DifficultyLevel.V6),
        (7.5, 8.5, DifficultyLevel.V7),
        (8.5, 9.5, DifficultyLevel.V8),
        (9.5, 10.5, DifficultyLevel.V9),
        (10.5, 11.5, DifficultyLevel.V10),
        (11.5, 12.5, DifficultyLevel.V11),
        (12.5, float("inf"), DifficultyLevel.V12),
    ]

    @staticmethod
    def score_to_difficulty(score: float) -> DifficultyLevel:
        for min_score, max_score, level in DifficultyConversionRules.DIFFICULTY_MAP:
            if min_score <= score < max_score:
                return level
        return DifficultyLevel.V12

    @staticmethod
    def difficulty_to_score(difficulty: DifficultyLevel) -> float:
        for min_score, max_score, level in DifficultyConversionRules.DIFFICULTY_MAP:
            if level == difficulty:
                return (min_score + max_score) / 2
        return 13.0


class ClimbFeedbackRules:
    @staticmethod
    def get_climber_weight(experience_level: str) -> float:
        weights = {
            "beginner": 0.7,
            "intermediate": 1.0,
            "advanced": 1.3,
            "expert": 1.5,
        }
        return weights.get(experience_level.lower(), 1.0)

    @staticmethod
    def get_attempt_factor(attempts: int, completed: bool) -> float:
        if not completed:
            return 1.3
        if attempts == 1:
            return 0.9
        elif attempts <= 3:
            return 1.0
        elif attempts <= 5:
            return 1.1
        else:
            return 1.2


class DifficultyCalibrationEngine:
    def calculate_route_base_score(self, route: Route) -> float:
        if not route.holds:
            return 0.0

        hold_scores = []
        for hold in route.holds:
            if hold.type != HoldType.FOOTHOLD:
                score = HoldDifficultyRules.calculate_hold_difficulty(hold)
                hold_scores.append(score)

        if not hold_scores:
            return 0.0

        avg_hold_score = sum(hold_scores) / len(hold_scores)
        max_hold_score = max(hold_scores)
        hold_count_factor = min(1.0 + (len(hold_scores) - 5) * 0.05, 2.0)
        angle_multiplier = WallAngleRules.get_angle_multiplier(route.angle)
        base_score = (avg_hold_score * 0.6 + max_hold_score * 0.4) * hold_count_factor * angle_multiplier * 3.0

        return max(0.0, base_score)

    def calculate_feedback_adjustment(self, feedbacks: List[ClimbFeedback]) -> Optional[float]:
        if not feedbacks:
            return None

        adjusted_scores = []
        for fb in feedbacks:
            if fb.perceived_difficulty is None:
                continue

            weight = ClimbFeedbackRules.get_climber_weight(fb.climber_experience_level)
            attempt_factor = ClimbFeedbackRules.get_attempt_factor(
                fb.number_of_attempts, fb.completed
            )
            base_score = DifficultyConversionRules.difficulty_to_score(fb.perceived_difficulty)
            adjusted_score = base_score * attempt_factor * weight
            adjusted_scores.append(adjusted_score)

        if not adjusted_scores:
            return None

        return sum(adjusted_scores) / len(adjusted_scores)

    def calibrate_difficulty(
        self, route: Route, feedbacks: List[ClimbFeedback]
    ) -> Tuple[DifficultyLevel, Dict[str, float]]:
        base_score = self.calculate_route_base_score(route)
        feedback_score = self.calculate_feedback_adjustment(feedbacks)

        if feedback_score is not None and len(feedbacks) >= 2:
            base_weight = 0.4
            feedback_weight = 0.6
            final_score = base_score * base_weight + feedback_score * feedback_weight
        else:
            final_score = base_score

        difficulty = DifficultyConversionRules.score_to_difficulty(final_score)

        breakdown = {
            "base_score": base_score,
            "feedback_score": feedback_score if feedback_score is not None else 0.0,
            "final_score": final_score,
            "angle_multiplier": WallAngleRules.get_angle_multiplier(route.angle),
        }

        return difficulty, breakdown


class ValidationRules:
    @staticmethod
    def validate_route(route: Route) -> List[str]:
        errors = []

        if not route.name or not route.name.strip():
            errors.append("线路名称不能为空")

        if route.angle < -30 or route.angle > 60:
            errors.append("墙壁角度必须在 -30 到 60 度之间")

        if not route.wall_section or not route.wall_section.strip():
            errors.append("必须指定墙段位置")

        start_holds = [h for h in route.holds if h.is_start]
        end_holds = [h for h in route.holds if h.is_end]

        if len(start_holds) < 1:
            errors.append("线路必须至少有一个起点抓点")

        if len(end_holds) < 1:
            errors.append("线路必须至少有一个终点抓点")

        hold_types = [h.type for h in route.holds if h.type != HoldType.FOOTHOLD]
        if len(hold_types) < 3:
            errors.append("线路必须至少有 3 个手抓点")

        return errors

    @staticmethod
    def validate_hold(hold: Hold) -> List[str]:
        errors = []

        if not hold.id:
            errors.append("抓点ID不能为空")

        if hold.size <= 0 or hold.size > 2:
            errors.append("抓点大小必须在 0-2 之间")

        if hold.difficulty_contribution < 0.5 or hold.difficulty_contribution > 2.0:
            errors.append("抓点难度贡献必须在 0.5-2.0 之间")

        if "x" not in hold.position or "y" not in hold.position:
            errors.append("抓点位置必须包含 x 和 y 坐标")
        else:
            if hold.position["x"] < 0 or hold.position["x"] > 100:
                errors.append("抓点 x 坐标必须在 0-100 之间")
            if hold.position["y"] < 0 or hold.position["y"] > 100:
                errors.append("抓点 y 坐标必须在 0-100 之间")

        return errors

    @staticmethod
    def validate_feedback(feedback: ClimbFeedback) -> List[str]:
        errors = []

        if not feedback.climber_name or not feedback.climber_name.strip():
            errors.append("试爬者名称不能为空")

        if feedback.number_of_attempts < 1:
            errors.append("尝试次数至少为 1")

        valid_levels = ["beginner", "intermediate", "advanced", "expert"]
        if feedback.climber_experience_level.lower() not in valid_levels:
            errors.append(f"试爬者经验等级必须是: {', '.join(valid_levels)}")

        return errors
