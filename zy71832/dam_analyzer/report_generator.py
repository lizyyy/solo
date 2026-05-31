import os
from datetime import datetime
from typing import List, Dict, Any, Optional
import pandas as pd
from .config import Config
from .models import BattleRecord, RecordStatus, Anomaly, ImportSession
from .anomaly_detector import AnomalyDetector


class ReportGenerator:
    def __init__(self, config: Config):
        self.config = config

    def generate_review_report(
        self,
        records: List[BattleRecord],
        anomalies: Optional[List[Anomaly]] = None,
        import_sessions: Optional[List[ImportSession]] = None,
        report_name: Optional[str] = None,
    ) -> str:
        if report_name is None:
            timestamp = datetime.now().strftime(self.config.timestamp_format)
            report_name = f"复盘报告_{timestamp}.xlsx"

        filepath = os.path.join(self.config.output_dir, report_name)
        os.makedirs(os.path.dirname(filepath), exist_ok=True)

        confirmed_records = [r for r in records if r.status == RecordStatus.CONFIRMED]
        pending_records = [r for r in records if r.status == RecordStatus.PENDING]
        modified_records = [r for r in records if r.status == RecordStatus.MANUAL_MODIFIED]

        with pd.ExcelWriter(filepath, engine="openpyxl") as writer:
            self._write_sheet(
                writer,
                "全部记录",
                self._format_records_to_dataframe(records),
                include_index=False,
            )

            self._write_sheet(
                writer,
                "已确认",
                self._format_records_to_dataframe(confirmed_records),
                include_index=False,
            )

            self._write_sheet(
                writer,
                "待补",
                self._format_records_to_dataframe(pending_records),
                include_index=False,
            )

            self._write_sheet(
                writer,
                "人工修改",
                self._format_records_to_dataframe(modified_records),
                include_index=False,
            )

            if anomalies:
                self._write_sheet(
                    writer,
                    "异常记录",
                    pd.DataFrame([a.to_dict() for a in anomalies]),
                    include_index=False,
                )

            if import_sessions:
                self._write_sheet(
                    writer,
                    "导入历史",
                    pd.DataFrame([s.to_dict() for s in import_sessions]),
                    include_index=False,
                )

            processing_summary = self._generate_processing_summary(
                records, anomalies, import_sessions
            )
            self._write_sheet(
                writer,
                "处理口径说明",
                pd.DataFrame(list(processing_summary.items()), columns=["项目", "说明"]),
                include_index=False,
            )

            stats_summary = self._generate_stats_summary(records)
            self._write_sheet(
                writer,
                "数据统计",
                pd.DataFrame(list(stats_summary.items()), columns=["项目", "数值"]),
                include_index=False,
            )

        return filepath

    def _format_records_to_dataframe(self, records: List[BattleRecord]) -> pd.DataFrame:
        if not records:
            return pd.DataFrame()

        df_data = [r.to_dict() for r in records]
        df = pd.DataFrame(df_data)

        sort_columns = ["回合", "阵营", "玩家ID"]
        existing_columns = [col for col in sort_columns if col in df.columns]
        if existing_columns:
            df = df.sort_values(by=existing_columns, ascending=[True, True, True])

        return df

    def _write_sheet(
        self, writer: pd.ExcelWriter, sheet_name: str, df: pd.DataFrame, include_index: bool = False
    ) -> None:
        df.to_excel(writer, sheet_name=sheet_name, index=include_index)

        worksheet = writer.sheets.get(sheet_name)
        if worksheet:
            for column in df.columns:
                column_width = max(len(str(column)), df[column].astype(str).str.len().max())
                col_idx = df.columns.get_loc(column)
                worksheet.column_dimensions[chr(65 + col_idx)].width = min(column_width + 2, 50)

    def _generate_processing_summary(
        self,
        records: List[BattleRecord],
        anomalies: Optional[List[Anomaly]],
        import_sessions: Optional[List[ImportSession]],
    ) -> Dict[str, str]:
        summary = {
            "报告生成时间": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "数据处理标准": "1. 战报文本按回合+阵营结构解析；2. 回合顺序按'进攻方→防守方'默认规则判定；3. 字段缺失自动标记为'待补'状态；4. 人工修改记录保留修改痕迹和原因",
            "状态分类规则": "已确认：系统自动解析且通过校验的记录；待补：字段缺失或信息不完整需人工补充；人工修改：经过人工编辑修正的记录",
            "异常处理口径": "高严重度异常需人工复核后方可确认；中等异常建议检查；低异常仅作提示",
            "导出一致性规则": "所有导出按'回合→阵营→玩家ID'排序；统一字段顺序；记录ID全局唯一可追溯",
            "回合判定规则": "优先识别行首'第X回合'标记；行内回合标记次之；缺失则继承上下文；顺序错误参考原文行号",
            "重复导入处理": "重复导入时按'回合+阵营+玩家+行动'四要素匹配；冲突记录保留最新导入并标记来源",
        }

        if import_sessions:
            summary["导入会话数"] = str(len(import_sessions))
            summary["最新导入时间"] = import_sessions[-1].import_time.strftime("%Y-%m-%d %H:%M:%S") if import_sessions else "无"

        if anomalies:
            unresolved = len([a for a in anomalies if not a.resolved])
            summary["未解决异常数"] = str(unresolved)
            if unresolved > 0:
                summary["异常处理提示"] = f"仍有{unresolved}条异常未解决，建议复核后再提交"

        return summary

    def _generate_stats_summary(self, records: List[BattleRecord]) -> Dict[str, Any]:
        if not records:
            return {"提示": "无有效数据"}

        round_numbers = [r.round_num for r in records]
        min_round, max_round = min(round_numbers), max(round_numbers)

        teams = {r.team for r in records}
        players = {r.player_id for r in records}

        total_damage = sum(r.damage or 0 for r in records)
        total_healing = sum(r.healing or 0 for r in records)

        team_stats = {}
        for team in teams:
            team_records = [r for r in records if r.team == team]
            team_damage = sum(r.damage or 0 for r in team_records)
            team_healing = sum(r.healing or 0 for r in team_records)
            team_stats[team] = {
                "记录数": len(team_records),
                "总伤害": team_damage,
                "总治疗": team_healing,
            }

        stats = {
            "总记录数": len(records),
            "回合范围": f"{min_round} - {max_round}",
            "完整回合数": max_round - min_round + 1,
            "涉及阵营": ", ".join(teams),
            "涉及玩家数": len(players),
            "已确认记录数": len([r for r in records if r.status == RecordStatus.CONFIRMED]),
            "待补记录数": len([r for r in records if r.status == RecordStatus.PENDING]),
            "人工修改记录数": len([r for r in records if r.status == RecordStatus.MANUAL_MODIFIED]),
            "总伤害输出": total_damage,
            "总治疗输出": total_healing,
        }

        for team, team_data in team_stats.items():
            stats[f"{team}记录数"] = team_data["记录数"]
            stats[f"{team}总伤害"] = team_data["总伤害"]
            stats[f"{team}总治疗"] = team_data["总治疗"]

        return stats

    def generate_text_report(
        self,
        records: List[BattleRecord],
        anomalies: Optional[List[Anomaly]] = None,
    ) -> str:
        lines = []
        lines.append("=" * 60)
        lines.append("河谷水坝攻防 - 战报复盘摘要")
        lines.append("=" * 60)
        lines.append("")

        stats = self._generate_stats_summary(records)
        lines.append("【数据概览】")
        for key, value in stats.items():
            lines.append(f"  {key}: {value}")
        lines.append("")

        lines.append("【状态分布】")
        lines.append(f"  已确认: {len([r for r in records if r.status == RecordStatus.CONFIRMED])} 条")
        lines.append(f"  待补: {len([r for r in records if r.status == RecordStatus.PENDING])} 条")
        lines.append(f"  人工修改: {len([r for r in records if r.status == RecordStatus.MANUAL_MODIFIED])} 条")
        lines.append("")

        if anomalies:
            lines.append("【异常检测】")
            unresolved = [a for a in anomalies if not a.resolved]
            lines.append(f"  检测到异常: {len(anomalies)} 条")
            lines.append(f"  未解决: {len(unresolved)} 条")

            for i, anomaly in enumerate(unresolved[:5], 1):
                status = "✗" if not anomaly.resolved else "✓"
                lines.append(f"  {status} [{anomaly.severity}] {anomaly.anomaly_type.value}: {anomaly.description}")

            if len(unresolved) > 5:
                lines.append(f"  ... 还有 {len(unresolved) - 5} 条未显示")
            lines.append("")

        lines.append("【回合顺序检查】")
        round_errors = [a for a in (anomalies or []) if a.anomaly_type.value == "回合顺序错误"]
        if round_errors:
            lines.append("  ⚠ 检测到回合顺序可能错误")
            lines.append("  建议: 检查战报原文行号，确保'进攻方→防守方'顺序")
        else:
            lines.append("  ✓ 回合顺序正常")
        lines.append("")

        lines.append("【导出前复核清单】")
        lines.append("  □ 待补记录是否已补充完整")
        lines.append("  □ 异常记录是否已处理确认")
        lines.append("  □ 人工修改是否已注明原因")
        lines.append("  □ 回合范围是否完整")
        lines.append("  □ 导出筛选条件是否正确")
        lines.append("")

        lines.append("=" * 60)

        return "\n".join(lines)

    def print_text_report(
        self,
        records: List[BattleRecord],
        anomalies: Optional[List[Anomaly]] = None,
    ) -> None:
        print(self.generate_text_report(records, anomalies))
