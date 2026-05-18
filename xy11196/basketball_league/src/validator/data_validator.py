from typing import List, Dict, Any, Tuple
from datetime import datetime
from src.parser.data_parser import GameData, AppealDecision


class ValidationResult:
    def __init__(self):
        self.errors: List[Dict[str, Any]] = []
        self.warnings: List[Dict[str, Any]] = []
        self.is_valid = True

    def add_error(self, error_type: str, message: str, game_id: str = None, **kwargs):
        error = {"type": error_type, "message": message, "game_id": game_id}
        error.update(kwargs)
        self.errors.append(error)
        self.is_valid = False

    def add_warning(self, warning_type: str, message: str, game_id: str = None, **kwargs):
        warning = {"type": warning_type, "message": message, "game_id": game_id}
        warning.update(kwargs)
        self.warnings.append(warning)


class DataValidator:
    def __init__(self):
        self.result = ValidationResult()
        self.valid_teams = set()

    def validate_games(self, games: List[GameData]) -> ValidationResult:
        self.result = ValidationResult()
        self.valid_teams = set()

        game_ids = set()
        team_games_count = {}

        for game in games:
            self._validate_game_id(game, game_ids)
            self._validate_team_names(game)
            self._validate_scores(game)
            self._validate_game_date(game)
            self._validate_division(game)
            self._validate_round(game)

            self._count_team_games(game, team_games_count)

        self._validate_uneven_games(team_games_count)
        self._validate_same_team_match(games)

        return self.result

    def validate_appeals(self, appeals: List[AppealDecision], games: List[GameData]) -> ValidationResult:
        result = ValidationResult()
        game_ids = {g.game_id for g in games}

        for appeal in appeals:
            if not appeal.game_id:
                result.add_error("empty_game_id", "申诉改判的比赛ID不能为空")
                continue

            if appeal.game_id not in game_ids:
                result.add_error(
                    "invalid_game_id",
                    f"申诉改判的比赛ID不存在: {appeal.game_id}",
                    game_id=appeal.game_id
                )

            if not appeal.decision_type:
                result.add_error(
                    "empty_decision_type",
                    "申诉改判类型不能为空",
                    game_id=appeal.game_id
                )

            valid_types = ["比分改判", "判罚改判", "技术统计修正", "弃权判定"]
            if appeal.decision_type and appeal.decision_type not in valid_types:
                result.add_warning(
                    "unknown_decision_type",
                    f"未知的改判类型: {appeal.decision_type}",
                    game_id=appeal.game_id
                )

            if appeal.decision_type in ["比分改判", "弃权判定"]:
                if appeal.new_home_score is None or appeal.new_away_score is None:
                    result.add_error(
                        "missing_scores",
                        "比分改判必须提供新的得分",
                        game_id=appeal.game_id
                    )

        return result

    def _validate_game_id(self, game: GameData, game_ids: set):
        if not game.game_id:
            self.result.add_error("empty_game_id", "比赛ID不能为空")
            return

        if game.game_id in game_ids:
            self.result.add_error(
                "duplicate_game_id",
                f"重复的比赛ID: {game.game_id}",
                game_id=game.game_id
            )
        else:
            game_ids.add(game.game_id)

    def _validate_team_names(self, game: GameData):
        if not game.home_team:
            self.result.add_error(
                "empty_home_team",
                "主队名称不能为空",
                game_id=game.game_id
            )

        if not game.away_team:
            self.result.add_error(
                "empty_away_team",
                "客队名称不能为空",
                game_id=game.game_id
            )

        if game.home_team and game.away_team and game.home_team == game.away_team:
            self.result.add_error(
                "same_team",
                f"主队和客队不能为同一球队: {game.home_team}",
                game_id=game.game_id
            )

        if game.home_team:
            self.valid_teams.add(game.home_team)
        if game.away_team:
            self.valid_teams.add(game.away_team)

    def _validate_scores(self, game: GameData):
        if game.home_score == 0 and game.away_score == 0:
            self.result.add_warning(
                "zero_scores",
                f"比赛双方得分均为0，可能是弃权比赛: {game.home_team} vs {game.away_team}",
                game_id=game.game_id
            )

        if game.home_score > 200:
            self.result.add_warning(
                "abnormal_high_score",
                f"主队得分异常偏高: {game.home_score}",
                game_id=game.game_id,
                score=game.home_score
            )

        if game.away_score > 200:
            self.result.add_warning(
                "abnormal_high_score",
                f"客队得分异常偏高: {game.away_score}",
                game_id=game.game_id,
                score=game.away_score
            )

    def _validate_game_date(self, game: GameData):
        if not game.game_date:
            self.result.add_error(
                "empty_game_date",
                "比赛日期不能为空",
                game_id=game.game_id
            )
            return

        try:
            datetime.strptime(game.game_date, "%Y-%m-%d")
        except ValueError:
            try:
                datetime.strptime(game.game_date, "%Y/%m/%d")
            except ValueError:
                self.result.add_warning(
                    "invalid_date_format",
                    f"日期格式不规范，建议使用 YYYY-MM-DD: {game.game_date}",
                    game_id=game.game_id
                )

    def _validate_division(self, game: GameData):
        if not game.division:
            self.result.add_error(
                "empty_division",
                "组别不能为空",
                game_id=game.game_id
            )

        valid_divisions = ["社区甲组", "社区乙组", "社区丙组", "公开组", "中年组", "青年组"]
        if game.division and game.division not in valid_divisions:
            self.result.add_warning(
                "unknown_division",
                f"未知的组别: {game.division}",
                game_id=game.game_id
            )

    def _validate_round(self, game: GameData):
        if game.round_num <= 0:
            self.result.add_error(
                "invalid_round",
                f"轮次必须为正整数: {game.round_num}",
                game_id=game.game_id
            )

        if game.round_num > 30:
            self.result.add_warning(
                "high_round_number",
                f"轮次数值较大: {game.round_num}",
                game_id=game.game_id
            )

    def _count_team_games(self, game: GameData, team_games_count: Dict[str, int]):
        if game.home_team:
            team_games_count[game.home_team] = team_games_count.get(game.home_team, 0) + 1
        if game.away_team:
            team_games_count[game.away_team] = team_games_count.get(game.away_team, 0) + 1

    def _validate_uneven_games(self, team_games_count: Dict[str, int]):
        if not team_games_count:
            return

        game_counts = list(team_games_count.values())
        if len(set(game_counts)) > 1:
            teams_by_count = {}
            for team, count in team_games_count.items():
                teams_by_count.setdefault(count, []).append(team)

            self.result.add_warning(
                "uneven_game_count",
                "各球队参赛场次不一致",
                details=teams_by_count
            )

    def _validate_same_team_match(self, games: List[GameData]):
        match_counts = {}
        for game in games:
            if game.home_team and game.away_team:
                teams = tuple(sorted([game.home_team, game.away_team]))
                match_counts[teams] = match_counts.get(teams, 0) + 1

        for teams, count in match_counts.items():
            if count > 2:
                self.result.add_warning(
                    "excessive_matches",
                    f"{teams[0]} 和 {teams[1]} 对阵次数过多: {count}次",
                    teams=list(teams)
                )

    def get_dirty_data_report(self, games: List[GameData]) -> Dict[str, Any]:
        dirty_rows = []

        for game in games:
            issues = []
            if not game.game_id:
                issues.append("缺少比赛ID")
            if not game.home_team:
                issues.append("缺少主队")
            if not game.away_team:
                issues.append("缺少客队")
            if game.home_score < 0 or game.away_score < 0:
                issues.append("得分为负")
            if not game.division:
                issues.append("缺少组别")
            if game.round_num <= 0:
                issues.append("无效轮次")

            if issues:
                dirty_rows.append({
                    "game_id": game.game_id,
                    "home_team": game.home_team,
                    "away_team": game.away_team,
                    "issues": issues
                })

        return {
            "total_games": len(games),
            "dirty_count": len(dirty_rows),
            "dirty_rows": dirty_rows
        }
