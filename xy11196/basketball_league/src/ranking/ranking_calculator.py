from typing import List, Dict, Any, Tuple
from collections import defaultdict
from src.parser.data_parser import GameData, AppealDecision


class TeamStats:
    def __init__(self, team_name: str):
        self.team_name = team_name
        self.played = 0
        self.won = 0
        self.lost = 0
        self.drawn = 0
        self.points = 0
        self.scored = 0
        self.conceded = 0
        self.point_diff = 0

    def update_stats(self, scored: int, conceded: int):
        self.played += 1
        self.scored += scored
        self.conceded += conceded
        self.point_diff = self.scored - self.conceded

        if scored > conceded:
            self.won += 1
            self.points += 2
        elif scored < conceded:
            self.lost += 1
            self.points += 1

    def to_dict(self) -> Dict[str, Any]:
        return {
            "team_name": self.team_name,
            "played": self.played,
            "won": self.won,
            "lost": self.lost,
            "drawn": self.drawn,
            "points": self.points,
            "scored": self.scored,
            "conceded": self.conceded,
            "point_diff": self.point_diff
        }


class RankingCalculator:
    def __init__(self):
        self.team_stats: Dict[str, TeamStats] = {}
        self.head_to_head: Dict[str, Dict[str, Dict[str, int]]] = defaultdict(lambda: defaultdict(dict))
        self.division_rankings: Dict[str, List[Dict[str, Any]]] = {}
        self.tie_breaker_details: List[Dict[str, Any]] = []

    def calculate_rankings(self, games: List[GameData], appeals: List[AppealDecision] = None) -> Dict[str, Any]:
        self.team_stats = {}
        self.head_to_head = defaultdict(lambda: defaultdict(dict))
        self.division_rankings = {}
        self.tie_breaker_details = []

        games_by_division = self._group_games_by_division(games)

        for division, division_games in games_by_division.items():
            division_stats = self._calculate_division_stats(division_games)
            ranked_teams = self._apply_tie_breakers(division_stats, division_games)
            self.division_rankings[division] = ranked_teams

        return {
            "divisions": self.division_rankings,
            "tie_breakers": self.tie_breaker_details,
            "total_teams": len(self.team_stats)
        }

    def calculate_rankings_with_appeals(self, games: List[GameData], appeals: List[AppealDecision]) -> Dict[str, Any]:
        if not appeals:
            return self.calculate_rankings(games)

        adjusted_games = self._apply_appeals_to_games(games, appeals)
        original_result = self.calculate_rankings(games)
        adjusted_result = self.calculate_rankings(adjusted_games)

        changes = self._compare_rankings_changes(original_result, adjusted_result)

        return {
            "original_rankings": original_result["divisions"],
            "adjusted_rankings": adjusted_result["divisions"],
            "appeals_applied": [a.to_dict() for a in appeals],
            "changes": changes,
            "tie_breakers": adjusted_result["tie_breakers"]
        }

    def _group_games_by_division(self, games: List[GameData]) -> Dict[str, List[GameData]]:
        games_by_division = defaultdict(list)
        for game in games:
            if game.division:
                games_by_division[game.division].append(game)
        return games_by_division

    def _calculate_division_stats(self, games: List[GameData]) -> Dict[str, TeamStats]:
        division_stats = {}

        for game in games:
            if game.home_team not in division_stats:
                division_stats[game.home_team] = TeamStats(game.home_team)
            if game.away_team not in division_stats:
                division_stats[game.away_team] = TeamStats(game.away_team)

            division_stats[game.home_team].update_stats(game.home_score, game.away_score)
            division_stats[game.away_team].update_stats(game.away_score, game.home_score)

            self._record_head_to_head(game)

        self.team_stats.update(division_stats)
        return division_stats

    def _record_head_to_head(self, game: GameData):
        self.head_to_head[game.home_team][game.away_team] = {
            "scored": game.home_score,
            "conceded": game.away_score
        }
        self.head_to_head[game.away_team][game.home_team] = {
            "scored": game.away_score,
            "conceded": game.home_score
        }

    def _apply_tie_breakers(self, team_stats: Dict[str, TeamStats], games: List[GameData]) -> List[Dict[str, Any]]:
        teams = list(team_stats.values())

        teams.sort(key=lambda x: (
            -x.points,
            -x.point_diff,
            -x.scored,
            -x.won
        ))

        teams_with_rank = []
        current_rank = 1

        i = 0
        while i < len(teams):
            tie_group = [teams[i]]
            j = i + 1

            while j < len(teams):
                if self._is_tied(teams[i], teams[j]):
                    tie_group.append(teams[j])
                    j += 1
                else:
                    break

            if len(tie_group) > 1:
                self._record_tie_breaker(tie_group)
                tie_group = self._resolve_tie_group(tie_group)

            for team in tie_group:
                team_dict = team.to_dict()
                team_dict["rank"] = current_rank
                teams_with_rank.append(team_dict)

            current_rank += len(tie_group)
            i = j

        return teams_with_rank

    def _is_tied(self, team1: TeamStats, team2: TeamStats) -> bool:
        return (team1.points == team2.points and
                team1.point_diff == team2.point_diff and
                team1.scored == team2.scored)

    def _resolve_tie_group(self, tie_group: List[TeamStats]) -> List[TeamStats]:
        def h2h_key(team: TeamStats) -> Tuple[int, int, int]:
            h2h_wins = 0
            h2h_diff = 0
            h2h_scored = 0

            for other in tie_group:
                if other.team_name == team.team_name:
                    continue
                result = self.head_to_head[team.team_name].get(other.team_name, {})
                if result:
                    scored = result.get("scored", 0)
                    conceded = result.get("conceded", 0)
                    h2h_diff += scored - conceded
                    h2h_scored += scored
                    if scored > conceded:
                        h2h_wins += 1

            return (-h2h_wins, -h2h_diff, -h2h_scored)

        return sorted(tie_group, key=h2h_key)

    def _record_tie_breaker(self, tie_group: List[TeamStats]):
        team_names = [t.team_name for t in tie_group]
        self.tie_breaker_details.append({
            "teams": team_names,
            "points": tie_group[0].points,
            "reason": "积分、净胜分、总得分均相同，启动同分规则"
        })

    def _apply_appeals_to_games(self, games: List[GameData], appeals: List[AppealDecision]) -> List[GameData]:
        game_map = {g.game_id: g for g in games}
        adjusted_games = []

        appeal_map = {}
        for appeal in appeals:
            appeal_map[appeal.game_id] = appeal

        for game in games:
            appeal = appeal_map.get(game.game_id)
            if appeal and appeal.decision_type in ["比分改判", "弃权判定"]:
                adjusted_game = GameData(
                    game_id=game.game_id,
                    home_team=game.home_team,
                    away_team=game.away_team,
                    home_score=appeal.new_home_score if appeal.new_home_score is not None else game.home_score,
                    away_score=appeal.new_away_score if appeal.new_away_score is not None else game.away_score,
                    game_date=game.game_date,
                    round_num=game.round_num,
                    division=game.division
                )
                adjusted_games.append(adjusted_game)
            else:
                adjusted_games.append(game)

        return adjusted_games

    def _compare_rankings_changes(self, original: Dict[str, Any], adjusted: Dict[str, Any]) -> Dict[str, Any]:
        changes = {}

        for division in original["divisions"]:
            if division not in adjusted["divisions"]:
                continue

            original_ranks = {t["team_name"]: t["rank"] for t in original["divisions"][division]}
            adjusted_ranks = {t["team_name"]: t["rank"] for t in adjusted["divisions"][division]}

            division_changes = []
            all_teams = set(original_ranks.keys()) | set(adjusted_ranks.keys())

            for team in all_teams:
                old_rank = original_ranks.get(team)
                new_rank = adjusted_ranks.get(team)
                if old_rank != new_rank:
                    division_changes.append({
                        "team": team,
                        "old_rank": old_rank,
                        "new_rank": new_rank,
                        "change": old_rank - new_rank if old_rank and new_rank else None
                    })

            if division_changes:
                changes[division] = division_changes

        return changes
