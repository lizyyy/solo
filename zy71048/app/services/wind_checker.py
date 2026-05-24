from typing import Tuple, List, Optional
from app.config import settings
from app.exceptions import WindCheckFailedException


class WindChecker:
    def __init__(self):
        self.allowed_directions = settings.allowed_wind_list
        self.max_wind_speed = settings.MAX_WIND_SPEED

    def validate_wind(
        self,
        wind_direction: Optional[str],
        wind_speed: Optional[float],
    ) -> Tuple[bool, List[str]]:
        errors = []

        if wind_direction is None:
            errors.append("缺少风向数据")
        elif wind_direction not in self.allowed_directions:
            errors.append(
                f"风向 [{wind_direction}] 不在允许范围内，允许的风向: {self.allowed_directions}"
            )

        if wind_speed is None:
            errors.append("缺少风速数据")
        elif wind_speed > self.max_wind_speed:
            errors.append(
                f"风速 [{wind_speed} m/s] 超过最大允许值 [{self.max_wind_speed} m/s]"
            )

        is_valid = len(errors) == 0
        return is_valid, errors

    def check_and_raise(
        self,
        wind_direction: Optional[str],
        wind_speed: Optional[float],
    ) -> None:
        is_valid, errors = self.validate_wind(wind_direction, wind_speed)
        if not is_valid:
            raise WindCheckFailedException(
                message="风向校验不通过",
                error_details=errors
            )

    def update_allowed_directions(self, directions: List[str]) -> None:
        self.allowed_directions = directions

    def update_max_wind_speed(self, speed: float) -> None:
        self.max_wind_speed = speed


wind_checker = WindChecker()
