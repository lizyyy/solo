import csv
import json
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Any, Optional


class GameData:
    def __init__(self, game_id: str, home_team: str, away_team: str,
                 home_score: int, away_score: int, game_date: str,
                 round_num: int, division: str):
        self.game_id = game_id
        self.home_team = home_team
        self.away_team = away_team
        self.home_score = home_score
        self.away_score = away_score
        self.game_date = game_date
        self.round_num = round_num
        self.division = division

    def to_dict(self) -> Dict[str, Any]:
        return {
            "game_id": self.game_id,
            "home_team": self.home_team,
            "away_team": self.away_team,
            "home_score": self.home_score,
            "away_score": self.away_score,
            "game_date": self.game_date,
            "round_num": self.round_num,
            "division": self.division
        }


class AppealDecision:
    def __init__(self, game_id: str, decision_type: str,
                 original_home_score: Optional[int], original_away_score: Optional[int],
                 new_home_score: Optional[int], new_away_score: Optional[int],
                 reason: str, decision_date: str):
        self.game_id = game_id
        self.decision_type = decision_type
        self.original_home_score = original_home_score
        self.original_away_score = original_away_score
        self.new_home_score = new_home_score
        self.new_away_score = new_away_score
        self.reason = reason
        self.decision_date = decision_date

    def to_dict(self) -> Dict[str, Any]:
        return {
            "game_id": self.game_id,
            "decision_type": self.decision_type,
            "original_home_score": self.original_home_score,
            "original_away_score": self.original_away_score,
            "new_home_score": self.new_home_score,
            "new_away_score": self.new_away_score,
            "reason": self.reason,
            "decision_date": self.decision_date
        }


class DataParser:
    def __init__(self):
        self.games: List[GameData] = []
        self.appeals: List[AppealDecision] = []
        self.parse_errors: List[Dict[str, Any]] = []

    def parse_games_csv(self, file_path: str) -> List[GameData]:
        self.games = []
        self.parse_errors = []
        path = Path(file_path)

        if not path.exists():
            raise FileNotFoundError(f"比赛数据文件不存在: {file_path}")

        with open(path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            for row_num, row in enumerate(reader, start=2):
                try:
                    game = GameData(
                        game_id=row.get('比赛ID', '').strip(),
                        home_team=row.get('主队', '').strip(),
                        away_team=row.get('客队', '').strip(),
                        home_score=self._parse_score(row.get('主队得分', ''), row_num, '主队得分'),
                        away_score=self._parse_score(row.get('客队得分', ''), row_num, '客队得分'),
                        game_date=row.get('比赛日期', '').strip(),
                        round_num=self._parse_int(row.get('轮次', ''), row_num, '轮次'),
                        division=row.get('组别', '').strip()
                    )
                    self.games.append(game)
                except Exception as e:
                    self.parse_errors.append({
                        "row": row_num,
                        "error": str(e),
                        "data": row
                    })

        return self.games

    def parse_appeals_csv(self, file_path: str) -> List[AppealDecision]:
        self.appeals = []
        path = Path(file_path)

        if not path.exists():
            return []

        with open(path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            for row_num, row in enumerate(reader, start=2):
                try:
                    appeal = AppealDecision(
                        game_id=row.get('比赛ID', '').strip(),
                        decision_type=row.get('改判类型', '').strip(),
                        original_home_score=self._parse_score_optional(row.get('原主队得分'), row_num, '原主队得分'),
                        original_away_score=self._parse_score_optional(row.get('原客队得分'), row_num, '原客队得分'),
                        new_home_score=self._parse_score_optional(row.get('新主队得分'), row_num, '新主队得分'),
                        new_away_score=self._parse_score_optional(row.get('新客队得分'), row_num, '新客队得分'),
                        reason=row.get('改判原因', '').strip(),
                        decision_date=row.get('改判日期', '').strip()
                    )
                    self.appeals.append(appeal)
                except Exception as e:
                    self.parse_errors.append({
                        "row": row_num,
                        "error": str(e),
                        "data": row
                    })

        return self.appeals

    def _parse_score(self, value: str, row_num: int, field_name: str) -> int:
        if value is None or value.strip() == '':
            raise ValueError(f"第{row_num}行: {field_name}不能为空")
        try:
            score = int(value.strip())
            if score < 0:
                raise ValueError(f"第{row_num}行: {field_name}不能为负数")
            return score
        except ValueError as e:
            if "不能为空" in str(e):
                raise
            raise ValueError(f"第{row_num}行: {field_name}格式错误: {value}")

    def _parse_score_optional(self, value: Optional[str], row_num: int, field_name: str) -> Optional[int]:
        if value is None or value.strip() == '':
            return None
        try:
            score = int(value.strip())
            if score < 0:
                raise ValueError(f"第{row_num}行: {field_name}不能为负数")
            return score
        except ValueError:
            raise ValueError(f"第{row_num}行: {field_name}格式错误: {value}")

    def _parse_int(self, value: str, row_num: int, field_name: str) -> int:
        if value is None or value.strip() == '':
            raise ValueError(f"第{row_num}行: {field_name}不能为空")
        try:
            return int(value.strip())
        except ValueError:
            raise ValueError(f"第{row_num}行: {field_name}格式错误: {value}")

    def get_parse_errors(self) -> List[Dict[str, Any]]:
        return self.parse_errors

    def get_games_by_division(self, division: str) -> List[GameData]:
        return [g for g in self.games if g.division == division]

    def get_all_divisions(self) -> List[str]:
        return list({g.division for g in self.games})
