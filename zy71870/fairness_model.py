#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import pandas as pd
import numpy as np
from typing import Dict, List, Tuple, Any, Optional
from datetime import datetime, timedelta
from config import FAIRNESS_WEIGHTS
from fairness_errors import ParameterValidationError


class FairnessModel:
    DEFAULT_PARAMETERS = {
        "rest_time_weight": 0.25,
        "back_to_back_weight": 0.30,
        "venue_balance_weight": 0.20,
        "opponent_strength_weight": 0.25,
        "min_rest_hours": 24,
        "max_consecutive_games": 2,
        "fairness_threshold": 0.7
    }

    def __init__(self, parameters: Optional[Dict[str, Any]] = None):
        self.parameters = self.DEFAULT_PARAMETERS.copy()
        if parameters:
            self.set_parameters(parameters)
        self.validation_results: Dict[str, Any] = {}

    def set_parameters(self, parameters: Dict[str, Any]) -> None:
        for key, value in parameters.items():
            self._validate_parameter(key, value)
        
        for key, value in parameters.items():
            self.parameters[key] = value

    def _validate_parameter(self, param_name: str, value: Any) -> None:
        validators = {
            "rest_time_weight": (lambda v: 0 <= v <= 1, "取值范围必须在 0 到 1 之间"),
            "back_to_back_weight": (lambda v: 0 <= v <= 1, "取值范围必须在 0 到 1 之间"),
            "venue_balance_weight": (lambda v: 0 <= v <= 1, "取值范围必须在 0 到 1 之间"),
            "opponent_strength_weight": (lambda v: 0 <= v <= 1, "取值范围必须在 0 到 1 之间"),
            "min_rest_hours": (lambda v: v > 0, "必须大于 0 小时"),
            "max_consecutive_games": (lambda v: isinstance(v, int) and v >= 1, "必须是大于等于 1 的整数"),
            "fairness_threshold": (lambda v: 0 <= v <= 1, "取值范围必须在 0 到 1 之间")
        }

        if param_name not in validators:
            return

        validator_func, constraint_desc = validators[param_name]
        if not validator_func(value):
            raise ParameterValidationError(
                param_name=param_name,
                param_value=value,
                constraint_desc=constraint_desc
            )

    def evaluate(self, schedule_df: pd.DataFrame) -> Dict[str, Any]:
        rest_time_scores = self._calculate_rest_time_fairness(schedule_df)
        back_to_back_scores = self._calculate_back_to_back_fairness(schedule_df)
        venue_scores = self._calculate_venue_balance(schedule_df)
        opponent_scores = self._calculate_opponent_strength_fairness(schedule_df)

        overall_score = (
            rest_time_scores["overall"] * self.parameters["rest_time_weight"] +
            back_to_back_scores["overall"] * self.parameters["back_to_back_weight"] +
            venue_scores["overall"] * self.parameters["venue_balance_weight"] +
            opponent_scores["overall"] * self.parameters["opponent_strength_weight"]
        )

        team_scores = self._calculate_team_scores(
            rest_time_scores, back_to_back_scores, venue_scores, opponent_scores
        )

        unfair_teams = [
            team for team, score in team_scores.items() 
            if score < self.parameters["fairness_threshold"]
        ]

        self.validation_results = {
            "overall_score": round(overall_score, 3),
            "rest_time_fairness": rest_time_scores,
            "back_to_back_fairness": back_to_back_scores,
            "venue_balance": venue_scores,
            "opponent_strength_fairness": opponent_scores,
            "team_scores": team_scores,
            "unfair_teams": unfair_teams,
            "fairness_level": self._get_fairness_level(overall_score),
            "evaluation_time": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }

        return self.validation_results

    def _calculate_rest_time_fairness(self, df: pd.DataFrame) -> Dict[str, Any]:
        all_teams = set(df["主队"].unique()) | set(df["客队"].unique())
        team_rest_times = {team: [] for team in all_teams}

        df_sorted = df.sort_values("比赛日期")

        for team in all_teams:
            team_games = []
            for _, row in df_sorted.iterrows():
                if row["主队"] == team or row["客队"] == team:
                    game_datetime = datetime.combine(
                        row["比赛日期"], 
                        row["比赛时间"] if isinstance(row["比赛时间"], datetime) else datetime.min.time()
                    )
                    team_games.append(game_datetime)

            for i in range(1, len(team_games)):
                rest_hours = (team_games[i] - team_games[i-1]).total_seconds() / 3600
                team_rest_times[team].append(rest_hours)

        team_scores = {}
        for team, rest_times in team_rest_times.items():
            if not rest_times:
                team_scores[team] = 1.0
            else:
                min_rest = min(rest_times)
                if min_rest >= self.parameters["min_rest_hours"]:
                    team_scores[team] = 1.0
                else:
                    team_scores[team] = max(0, min_rest / self.parameters["min_rest_hours"])

        rest_scores_list = list(team_scores.values())
        overall = np.mean(rest_scores_list) if rest_scores_list else 1.0

        return {
            "overall": round(overall, 3),
            "team_scores": team_scores,
            "min_rest_required": self.parameters["min_rest_hours"],
            "worst_rest_team": min(team_scores, key=team_scores.get) if team_scores else None
        }

    def _calculate_back_to_back_fairness(self, df: pd.DataFrame) -> Dict[str, Any]:
        all_teams = set(df["主队"].unique()) | set(df["客队"].unique())
        team_back_to_back = {team: 0 for team in all_teams}

        df_sorted = df.sort_values("比赛日期")

        for team in all_teams:
            game_dates = []
            for _, row in df_sorted.iterrows():
                if row["主队"] == team or row["客队"] == team:
                    game_dates.append(row["比赛日期"])

            for i in range(1, len(game_dates)):
                if (game_dates[i] - game_dates[i-1]).days <= 1:
                    team_back_to_back[team] += 1

        max_allowed = self.parameters["max_consecutive_games"]
        team_scores = {}
        for team, count in team_back_to_back.items():
            if count <= max_allowed:
                team_scores[team] = 1.0
            else:
                team_scores[team] = max(0, 1 - (count - max_allowed) * 0.2)

        scores_list = list(team_scores.values())
        overall = np.mean(scores_list) if scores_list else 1.0

        return {
            "overall": round(overall, 3),
            "team_scores": team_scores,
            "max_allowed": max_allowed,
            "most_back_to_back": max(team_back_to_back.items(), key=lambda x: x[1])
        }

    def _calculate_venue_balance(self, df: pd.DataFrame) -> Dict[str, Any]:
        all_teams = set(df["主队"].unique()) | set(df["客队"].unique())
        home_count = {team: 0 for team in all_teams}
        away_count = {team: 0 for team in all_teams}

        for _, row in df.iterrows():
            home_count[row["主队"]] += 1
            away_count[row["客队"]] += 1

        team_scores = {}
        for team in all_teams:
            total = home_count[team] + away_count[team]
            if total == 0:
                team_scores[team] = 1.0
            else:
                home_ratio = home_count[team] / total
                ideal_ratio = 0.5
                diff = abs(home_ratio - ideal_ratio)
                team_scores[team] = max(0, 1 - diff * 2)

        scores_list = list(team_scores.values())
        overall = np.mean(scores_list) if scores_list else 1.0

        return {
            "overall": round(overall, 3),
            "team_scores": team_scores,
            "home_games": home_count,
            "away_games": away_count
        }

    def _calculate_opponent_strength_fairness(self, df: pd.DataFrame) -> Dict[str, Any]:
        all_teams = set(df["主队"].unique()) | set(df["客队"].unique())
        team_opponent_ranks = {team: [] for team in all_teams}

        for _, row in df.iterrows():
            team_opponent_ranks[row["主队"]].append(row["客队排名"])
            team_opponent_ranks[row["客队"]].append(row["主队排名"])

        avg_opponent_rank = {}
        for team, ranks in team_opponent_ranks.items():
            if ranks:
                avg_opponent_rank[team] = np.mean(ranks)
            else:
                avg_opponent_rank[team] = 0

        if avg_opponent_rank:
            ranks = list(avg_opponent_rank.values())
            min_rank = min(ranks)
            max_rank = max(ranks)
            rank_range = max_rank - min_rank if max_rank != min_rank else 1

            team_scores = {}
            for team, avg_rank in avg_opponent_rank.items():
                normalized = (avg_rank - min_rank) / rank_range
                team_scores[team] = 1 - abs(normalized - 0.5) * 2
        else:
            team_scores = {team: 1.0 for team in all_teams}

        scores_list = list(team_scores.values())
        overall = np.mean(scores_list) if scores_list else 1.0

        return {
            "overall": round(overall, 3),
            "team_scores": team_scores,
            "avg_opponent_rank": avg_opponent_rank
        }

    def _calculate_team_scores(self, rest_scores, back_to_back_scores, 
                                venue_scores, opponent_scores) -> Dict[str, float]:
        all_teams = set(rest_scores["team_scores"].keys())
        team_scores = {}

        for team in all_teams:
            score = (
                rest_scores["team_scores"].get(team, 0) * self.parameters["rest_time_weight"] +
                back_to_back_scores["team_scores"].get(team, 0) * self.parameters["back_to_back_weight"] +
                venue_scores["team_scores"].get(team, 0) * self.parameters["venue_balance_weight"] +
                opponent_scores["team_scores"].get(team, 0) * self.parameters["opponent_strength_weight"]
            )
            team_scores[team] = round(score, 3)

        return team_scores

    def _get_fairness_level(self, score: float) -> str:
        if score >= 0.9:
            return "优秀"
        elif score >= 0.8:
            return "良好"
        elif score >= 0.7:
            return "合格"
        elif score >= 0.6:
            return "需改进"
        else:
            return "不合格"

    def get_model_description(self) -> str:
        weights_sum = (
            self.parameters["rest_time_weight"] +
            self.parameters["back_to_back_weight"] +
            self.parameters["venue_balance_weight"] +
            self.parameters["opponent_strength_weight"]
        )
        
        return (
            f"赛程公平性模型 v1.0\n"
            f"休息时间权重: {self.parameters['rest_time_weight']}\n"
            f"背靠背权重: {self.parameters['back_to_back_weight']}\n"
            f"场地均衡权重: {self.parameters['venue_balance_weight']}\n"
            f"对手强度权重: {self.parameters['opponent_strength_weight']}\n"
            f"权重合计: {weights_sum:.2f}\n"
            f"最小休息时间: {self.parameters['min_rest_hours']}小时\n"
            f"最大背靠背: {self.parameters['max_consecutive_games']}场"
        )

    def get_suggestions(self) -> List[str]:
        suggestions = []
        results = self.validation_results

        if not results:
            return ["请先运行模型评估后再查看建议"]

        if results["rest_time_fairness"]["overall"] < 0.8:
            worst_team = results["rest_time_fairness"]["worst_rest_team"]
            suggestions.append(f"休息时间安排需优化，队伍 '{worst_team}' 的休息间隔最短")

        if results["back_to_back_fairness"]["overall"] < 0.8:
            team, count = results["back_to_back_fairness"]["most_back_to_back"]
            suggestions.append(f"背靠背比赛过多，队伍 '{team}' 有 {count} 次背靠背")

        if results["venue_balance"]["overall"] < 0.8:
            suggestions.append("主客场分配不够均衡，建议调整各队主客场数量")

        if len(results["unfair_teams"]) > 0:
            teams_str = "、".join(results["unfair_teams"])
            suggestions.append(f"以下队伍公平性得分偏低: {teams_str}")

        if not suggestions:
            suggestions.append("当前赛程公平性良好，各项指标均达标")

        return suggestions

    def export_results_to_dataframe(self) -> pd.DataFrame:
        if not self.validation_results:
            return pd.DataFrame()

        team_scores = self.validation_results["team_scores"]
        data = []
        for team, score in team_scores.items():
            data.append({
                "队伍名称": team,
                "公平性得分": score,
                "休息时间得分": self.validation_results["rest_time_fairness"]["team_scores"].get(team, 0),
                "背靠背得分": self.validation_results["back_to_back_fairness"]["team_scores"].get(team, 0),
                "场地均衡得分": self.validation_results["venue_balance"]["team_scores"].get(team, 0),
                "对手强度得分": self.validation_results["opponent_strength_fairness"]["team_scores"].get(team, 0)
            })

        return pd.DataFrame(data)
