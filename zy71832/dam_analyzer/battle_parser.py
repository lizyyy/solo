import os
import re
import shutil
from datetime import datetime
from typing import List, Tuple, Dict, Optional
from .config import Config
from .models import BattleRecord, RecordStatus, ImportSession


class BattleParser:
    def __init__(self, config: Config):
        self.config = config
        self.import_sessions: List[ImportSession] = []
        self._session_counter = 0

    def parse_file(self, file_path: str, encoding: Optional[str] = None) -> Tuple[List[BattleRecord], List[str]]:
        if encoding is None:
            encoding = self.config.battle_report_encoding

        with open(file_path, "r", encoding=encoding) as f:
            content = f.read()

        return self.parse_text(content, source_file=os.path.basename(file_path))

    def parse_text(self, text: str, source_file: str = "manual_input") -> Tuple[List[BattleRecord], List[str]]:
        records: List[BattleRecord] = []
        warnings: List[str] = []

        current_round = None
        current_team = None
        import_time = datetime.now()

        lines = text.strip().split("\n")
        for line_num, line in enumerate(lines, 1):
            line = line.strip()
            if not line or line.startswith("#"):
                continue

            round_match = re.match(r"^[第\s]*(\d+)[回\s]*合.*$", line)
            if round_match:
                current_round = int(round_match.group(1))
                continue

            team_match = re.match(r"^(进攻方|防守方).*[:：]?\s*$", line)
            if team_match:
                current_team = team_match.group(1)
                continue

            if line.startswith("---") or line.startswith("==="):
                continue

            record, parse_warnings = self._parse_action_line(
                line, line_num, current_round, current_team, source_file, import_time
            )

            if record:
                records.append(record)

            if parse_warnings:
                warnings.extend(parse_warnings)

        if not current_round:
            warnings.append("警告: 未检测到回合标记，请检查格式")

        return records, warnings

    def _parse_action_line(
        self,
        line: str,
        line_num: int,
        current_round: Optional[int],
        current_team: Optional[str],
        source_file: str,
        import_time: datetime,
    ) -> Tuple[Optional[BattleRecord], List[str]]:
        warnings: List[str] = []

        round_num = current_round
        team = current_team

        inline_round = re.search(r"[第\s]*(\d+)[回\s]*合", line)
        if inline_round:
            round_num = int(inline_round.group(1))

        inline_team = re.search(r"(进攻方|防守方)", line)
        if inline_team:
            team = inline_team.group(1)

        if round_num is None:
            warnings.append(f"第{line_num}行: 无法确定回合，跳过: {line}")
            return None, warnings

        if team is None:
            warnings.append(f"第{line_num}行: 无法确定阵营，标记为待补: {line}")
            team = "待确认"

        player_match = re.search(r"([\w\u4e00-\u9fa5]+)\s*(?:使用|释放|发动|对|攻击|治疗)", line)
        player_id = player_match.group(1) if player_match else "未知玩家"

        action_match = re.search(r"(使用|释放|发动|攻击|治疗|防御|移动|占领|破坏)\s*([^\s，。]+)?", line)
        if action_match:
            action_type = action_match.group(1) + (action_match.group(2) or "")
        else:
            action_type = "未知行动"

        damage_match = re.search(r"造成\s*(\d+)\s*点?伤害", line)
        healing_match = re.search(r"恢复\s*(\d+)\s*点?生命", line)
        score_match = re.search(r"(?:获得|增加|减少)\s*(\d+)\s*点?分", line)
        target_match = re.search(r"对\s*([\w\u4e00-\u9fa5]+)", line)

        result_match = re.search(r"(成功|失败|击杀|阵亡|占领成功|占领失败|破坏成功|破坏失败)", line)
        result = result_match.group(1) if result_match else "进行中"

        damage = int(damage_match.group(1)) if damage_match else None
        healing = int(healing_match.group(1)) if healing_match else None
        score_change = int(score_match.group(1)) if score_match else None
        target = target_match.group(1) if target_match else None

        status = RecordStatus.CONFIRMED
        if team == "待确认" or player_id == "未知玩家":
            status = RecordStatus.PENDING

        record = BattleRecord(
            round_num=round_num,
            team=team,
            player_id=player_id,
            action_type=action_type,
            result=result,
            damage=damage,
            healing=healing,
            score_change=score_change,
            target=target,
            notes=f"来源行号: {line_num}",
            status=status,
            import_source=source_file,
            import_time=import_time,
        )

        return record, warnings

    def create_import_session(self, source_file: str, records: List[BattleRecord]) -> ImportSession:
        self._session_counter += 1
        session_id = f"import_{self._session_counter}_{datetime.now().strftime('%Y%m%d%H%M%S')}"

        session = ImportSession(
            session_id=session_id,
            source_file=source_file,
            import_time=datetime.now(),
            record_count=len(records),
            records=[r.record_id for r in records],
        )

        self.import_sessions.append(session)
        return session

    def rollback_session(self, session_id: str, note: str = "") -> Tuple[bool, List[str]]:
        for session in self.import_sessions:
            if session.session_id == session_id:
                if not session.can_rollback:
                    return False, [f"会话 {session_id} 无法撤回"]

                session.can_rollback = False
                session.rollback_note = note
                return True, session.records

        return False, [f"未找到会话 {session_id}"]

    def archive_source_file(self, file_path: str) -> str:
        filename = os.path.basename(file_path)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        archived_name = f"{timestamp}_{filename}"
        archived_path = os.path.join(self.config.battle_report_archive_dir, archived_name)

        shutil.copy2(file_path, archived_path)
        return archived_path

    def get_available_reports(self) -> List[str]:
        input_dir = self.config.battle_report_input_dir
        if not os.path.exists(input_dir):
            return []

        reports = []
        for filename in os.listdir(input_dir):
            if filename.endswith(".txt") or filename.endswith(".md"):
                reports.append(filename)

        return sorted(reports)

    def detect_duplicates(
        self, new_records: List[BattleRecord], existing_records: List[BattleRecord]
    ) -> List[Tuple[BattleRecord, BattleRecord]]:
        duplicates = []
        for new_r in new_records:
            for existing_r in existing_records:
                if (
                    new_r.round_num == existing_r.round_num
                    and new_r.team == existing_r.team
                    and new_r.player_id == existing_r.player_id
                    and new_r.action_type == existing_r.action_type
                ):
                    duplicates.append((new_r, existing_r))
        return duplicates
