import csv
import json
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Any


class ReportGenerator:
    def __init__(self, output_dir: str):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def generate_all_reports(self, rankings_data: Dict[str, Any],
                             validation_result: Any,
                             parse_errors: List[Dict[str, Any]],
                             run_timestamp: str = None) -> Dict[str, str]:
        if run_timestamp is None:
            run_timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

        reports = {}

        if rankings_data is not None and rankings_data.get("divisions"):
            reports["normal_ranking"] = self._generate_normal_ranking_report(
                rankings_data, run_timestamp
            )

        if rankings_data is not None and "tie_breakers" in rankings_data and rankings_data["tie_breakers"]:
            reports["tie_breaker"] = self._generate_tie_breaker_report(
                rankings_data["tie_breakers"], run_timestamp
            )

        if validation_result and (validation_result.errors or validation_result.warnings):
            reports["validation"] = self._generate_validation_report(
                validation_result, run_timestamp
            )

        if parse_errors:
            reports["parse_errors"] = self._generate_parse_errors_report(
                parse_errors, run_timestamp
            )

        return reports

    def generate_appeal_rerun_report(self, appeal_result: Dict[str, Any],
                                     run_timestamp: str = None) -> Dict[str, str]:
        if run_timestamp is None:
            run_timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

        reports = {}

        reports["adjusted_ranking"] = self._generate_adjusted_ranking_report(
            appeal_result, run_timestamp
        )

        if "appeals_applied" in appeal_result:
            reports["appeal_decisions"] = self._generate_appeal_decisions_report(
                appeal_result["appeals_applied"], run_timestamp
            )

        if "changes" in appeal_result and appeal_result["changes"]:
            reports["ranking_changes"] = self._generate_ranking_changes_report(
                appeal_result["changes"], run_timestamp
            )

        reports["rerun_comparison"] = self._generate_rerun_comparison_report(
            appeal_result, run_timestamp
        )

        return reports

    def _generate_normal_ranking_report(self, rankings_data: Dict[str, Any],
                                        timestamp: str) -> str:
        divisions = rankings_data.get("divisions", {})

        csv_path = self.output_dir / f"积分排行_正常_{timestamp}.csv"
        md_path = self.output_dir / f"积分排行_正常_{timestamp}.md"

        self._write_ranking_csv(divisions, csv_path)
        self._write_ranking_markdown(divisions, "社区篮球联赛积分排行", md_path)

        return str(csv_path)

    def _generate_adjusted_ranking_report(self, appeal_result: Dict[str, Any],
                                          timestamp: str) -> str:
        adjusted_rankings = appeal_result.get("adjusted_rankings", {})

        csv_path = self.output_dir / f"积分排行_申诉改判后_{timestamp}.csv"
        md_path = self.output_dir / f"积分排行_申诉改判后_{timestamp}.md"

        self._write_ranking_csv(adjusted_rankings, csv_path)
        self._write_ranking_markdown(adjusted_rankings, "社区篮球联赛积分排行（申诉改判后）", md_path)

        return str(csv_path)

    def _write_ranking_csv(self, divisions: Dict[str, Any], file_path: Path):
        with open(file_path, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.writer(f)
            writer.writerow([
                "组别", "排名", "球队名称", "场次", "胜", "负", "积分",
                "得分", "失分", "净胜分"
            ])

            for division, teams in divisions.items():
                for team in teams:
                    writer.writerow([
                        division,
                        team["rank"],
                        team["team_name"],
                        team["played"],
                        team["won"],
                        team["lost"],
                        team["points"],
                        team["scored"],
                        team["conceded"],
                        team["point_diff"]
                    ])

    def _write_ranking_markdown(self, divisions: Dict[str, Any], title: str, file_path: Path):
        lines = [f"# {title}", ""]
        lines.append(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("")

        for division, teams in divisions.items():
            lines.append(f"## {division}")
            lines.append("")
            lines.append("| 排名 | 球队名称 | 场次 | 胜 | 负 | 积分 | 得分 | 失分 | 净胜分 |")
            lines.append("|------|----------|------|----|----|------|------|------|--------|")

            for team in teams:
                lines.append(
                    f"| {team['rank']:2d} | {team['team_name']:8s} | {team['played']:4d} | "
                    f"{team['won']:2d} | {team['lost']:2d} | {team['points']:4d} | "
                    f"{team['scored']:4d} | {team['conceded']:4d} | {team['point_diff']:5d} |"
                )
            lines.append("")

        with open(file_path, 'w', encoding='utf-8') as f:
            f.write('\n'.join(lines))

    def _generate_tie_breaker_report(self, tie_breakers: List[Dict[str, Any]],
                                     timestamp: str) -> str:
        csv_path = self.output_dir / f"同分规则详情_{timestamp}.csv"
        json_path = self.output_dir / f"同分规则详情_{timestamp}.json"

        with open(csv_path, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.writer(f)
            writer.writerow(["涉及球队", "积分", "原因说明"])
            for tb in tie_breakers:
                writer.writerow([
                    "、".join(tb["teams"]),
                    tb["points"],
                    tb["reason"]
                ])

        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump({"tie_breakers": tie_breakers}, f, ensure_ascii=False, indent=2)

        return str(csv_path)

    def _generate_validation_report(self, validation_result: Any,
                                    timestamp: str) -> str:
        csv_path = self.output_dir / f"数据校验结果_{timestamp}.csv"

        with open(csv_path, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.writer(f)
            writer.writerow(["类型", "错误类型", "消息", "比赛ID", "详细信息"])

            for error in validation_result.errors:
                writer.writerow([
                    "错误",
                    error.get("type", ""),
                    error.get("message", ""),
                    error.get("game_id", ""),
                    json.dumps(error, ensure_ascii=False)
                ])

            for warning in validation_result.warnings:
                writer.writerow([
                    "警告",
                    warning.get("type", ""),
                    warning.get("message", ""),
                    warning.get("game_id", ""),
                    json.dumps(warning, ensure_ascii=False)
                ])

        return str(csv_path)

    def _generate_parse_errors_report(self, parse_errors: List[Dict[str, Any]],
                                      timestamp: str) -> str:
        csv_path = self.output_dir / f"数据解析错误_{timestamp}.csv"

        with open(csv_path, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.writer(f)
            writer.writerow(["行号", "错误信息", "原始数据"])

            for error in parse_errors:
                writer.writerow([
                    error.get("row", ""),
                    error.get("error", ""),
                    json.dumps(error.get("data", {}), ensure_ascii=False)
                ])

        return str(csv_path)

    def _generate_appeal_decisions_report(self, appeals: List[Dict[str, Any]],
                                          timestamp: str) -> str:
        csv_path = self.output_dir / f"申诉改判记录_{timestamp}.csv"

        with open(csv_path, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.writer(f)
            writer.writerow([
                "比赛ID", "改判类型", "原主队得分", "原客队得分",
                "新主队得分", "新客队得分", "改判原因", "改判日期"
            ])

            for appeal in appeals:
                writer.writerow([
                    appeal.get("game_id", ""),
                    appeal.get("decision_type", ""),
                    appeal.get("original_home_score", ""),
                    appeal.get("original_away_score", ""),
                    appeal.get("new_home_score", ""),
                    appeal.get("new_away_score", ""),
                    appeal.get("reason", ""),
                    appeal.get("decision_date", "")
                ])

        return str(csv_path)

    def _generate_ranking_changes_report(self, changes: Dict[str, Any],
                                         timestamp: str) -> str:
        csv_path = self.output_dir / f"排名变动详情_{timestamp}.csv"

        with open(csv_path, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.writer(f)
            writer.writerow(["组别", "球队", "原排名", "新排名", "排名变化"])

            for division, team_changes in changes.items():
                for change in team_changes:
                    change_val = change.get("change", "")
                    if change_val:
                        change_str = f"+{change_val}" if change_val > 0 else str(change_val)
                    else:
                        change_str = ""

                    writer.writerow([
                        division,
                        change.get("team", ""),
                        change.get("old_rank", ""),
                        change.get("new_rank", ""),
                        change_str
                    ])

        return str(csv_path)

    def _generate_rerun_comparison_report(self, appeal_result: Dict[str, Any],
                                          timestamp: str) -> str:
        original = appeal_result.get("original_rankings", {})
        adjusted = appeal_result.get("adjusted_rankings", {})

        md_path = self.output_dir / f"重跑对照报告_{timestamp}.md"

        lines = [
            "# 申诉改判重跑对照报告",
            "",
            f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
            ""
        ]

        for division in original.keys():
            if division not in adjusted:
                continue

            lines.append(f"## {division} 排名对照")
            lines.append("")
            lines.append("| 排名 | 改判前 | 改判后 | 变动 |")
            lines.append("|------|--------|--------|------|")

            orig_teams = {t["rank"]: t["team_name"] for t in original[division]}
            adj_teams = {t["rank"]: t["team_name"] for t in adjusted[division]}

            max_rank = max(max(orig_teams.keys()), max(adj_teams.keys()))

            for rank in range(1, max_rank + 1):
                orig_team = orig_teams.get(rank, "-")
                adj_team = adj_teams.get(rank, "-")
                change = ""

                if orig_team != adj_team:
                    change = "⚠️ 变动"

                lines.append(f"| {rank:2d} | {orig_team:8s} | {adj_team:8s} | {change:6s} |")

            lines.append("")

        with open(md_path, 'w', encoding='utf-8') as f:
            f.write('\n'.join(lines))

        return str(md_path)
