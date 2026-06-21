from __future__ import annotations

import csv
import io
import json
import sys
from dataclasses import dataclass
from typing import Optional

from .models import (
    AnomalyItem,
    AnomalyStatus,
    QuestionItem,
    ReplayRow,
    ReplaySummary,
    RowStatus,
)


class ParseError(Exception):
    pass


@dataclass
class ReplayConfig:
    param_version: str = "v1.0.0"
    skip_patterns: Optional[list[str]] = None
    strict_mode: bool = False


class PathReplayer:
    def __init__(self, config: Optional[ReplayConfig] = None):
        self.config = config or ReplayConfig()
        self.summary = ReplaySummary(param_version=self.config.param_version)

    def _is_skip_line(self, row: dict) -> tuple[bool, str]:
        if self.config.skip_patterns:
            for key in ["title", "remark", "tags"]:
                val = str(row.get(key, ""))
                for pat in self.config.skip_patterns:
                    if pat.lower() in val.lower():
                        return True, f"匹配跳过规则: '{pat}' 出现在字段 '{key}'"
        if row.get("status", "").lower() in ("draft", "archived", "deprecated"):
            return True, "题目状态为草稿/归档/弃用"
        return False, ""

    def _parse_path_params(self, raw: str) -> dict:
        if not raw:
            raise ParseError("path_params 为空")
        try:
            if raw.strip().startswith("{"):
                return json.loads(raw)
            params = {}
            for pair in raw.split(";"):
                if not pair.strip():
                    continue
                if "=" not in pair:
                    raise ParseError(f"路径参数格式错误，缺少'=': {pair!r}")
                k, v = pair.split("=", 1)
                k = k.strip()
                v = v.strip()
                if not k:
                    raise ParseError(f"路径参数键为空: {pair!r}")
                try:
                    if "." in v:
                        params[k] = float(v)
                    else:
                        params[k] = int(v)
                except ValueError:
                    params[k] = v
            return params
        except json.JSONDecodeError as e:
            raise ParseError(f"JSON路径参数解析失败: {e}") from e

    def _parse_single_row(self, line_number: int, row: dict, raw_line: str) -> ReplayRow:
        qid = str(row.get("question_id", "")).strip()
        title = str(row.get("title", "")).strip()

        if not qid or not title:
            missing = []
            if not qid:
                missing.append("question_id")
            if not title:
                missing.append("title")
            return ReplayRow(
                line_number=line_number,
                raw_line=raw_line,
                status=RowStatus.BAD,
                question_id=qid,
                title=title,
                error_message=f"缺少必填字段: {', '.join(missing)} 为空",
            )

        skip, reason = self._is_skip_line(row)
        if skip:
            return ReplayRow(
                line_number=line_number,
                raw_line=raw_line,
                status=RowStatus.SKIPPED,
                question_id=qid,
                title=title,
                skip_reason=reason,
            )

        raw_params = str(row.get("path_params", "")).strip()
        if raw_params:
            try:
                path_params = self._parse_path_params(raw_params)
            except ParseError as e:
                return ReplayRow(
                    line_number=line_number,
                    raw_line=raw_line,
                    status=RowStatus.BAD,
                    question_id=qid,
                    title=title,
                    error_message=f"路径参数解析失败: {e}",
                )
        else:
            path_params = {}

        question = QuestionItem(
            question_id=qid,
            title=title,
            path_params=path_params,
            tags=[t.strip() for t in str(row.get("tags", "")).split(",") if t.strip()],
            sort_key=row.get("sort_key"),
        )

        remark_raw = str(row.get("remark", "")).strip()
        if remark_raw:
            remark_author = str(row.get("remark_author", "xiaomeng")).strip() or "xiaomeng"
            remark_note = str(row.get("remark_note", "")).strip() or "题目清单备注导入"
            question.remark.append(remark_raw, author=remark_author, note=remark_note)

        screenshot_raw = str(row.get("screenshots", "")).strip()
        if screenshot_raw:
            shots = [s.strip() for s in screenshot_raw.split("|") if s.strip()]
            for idx, shot in enumerate(shots):
                question.screenshots.append(
                    shot,
                    author=str(row.get("screenshot_author", "qa")).strip() or "qa",
                    note=f"旧版本截图 #{idx + 1}",
                )

        return ReplayRow(
            line_number=line_number,
            raw_line=raw_line,
            status=RowStatus.PROCESSED,
            question_id=qid,
            title=title,
            question=question,
        )

    def _detect_anomalies(self, row: ReplayRow) -> list[AnomalyItem]:
        found: list[AnomalyItem] = []
        q = row.question
        if not q:
            return found

        if not q.path_params:
            found.append(AnomalyItem(
                anomaly_id=f"A{len(self.summary.anomalies) + len(found) + 1:03d}",
                question_id=q.question_id,
                title=q.title,
                anomaly_type="空路径参数",
                description="该题未解析出任何路径参数，可能格式异常或需要人工补充",
                params_snapshot={},
            ))

        for key, val in q.path_params.items():
            if isinstance(val, (int, float)):
                if val < 0 or val > 10000:
                    found.append(AnomalyItem(
                        anomaly_id=f"A{len(self.summary.anomalies) + len(found) + 1:03d}",
                        question_id=q.question_id,
                        title=q.title,
                        anomaly_type="路径参数越界",
                        description=f"参数 {key}={val} 超出合理范围 [0, 10000]",
                        params_snapshot={key: val},
                    ))
            elif isinstance(val, str) and len(val) > 200:
                found.append(AnomalyItem(
                    anomaly_id=f"A{len(self.summary.anomalies) + len(found) + 1:03d}",
                    question_id=q.question_id,
                    title=q.title,
                    anomaly_type="路径参数过长",
                    description=f"参数 {key} 长度异常 ({len(val)}字符)",
                    params_snapshot={key: val[:80] + "..."},
                ))

        if "hard" in q.tags and len(q.path_params) < 3:
            found.append(AnomalyItem(
                anomaly_id=f"A{len(self.summary.anomalies) + len(found) + 1:03d}",
                question_id=q.question_id,
                title=q.title,
                anomaly_type="难题参数不足",
                description="标记为 hard 但路径参数少于 3 个，建议核对",
                params_snapshot=q.path_params,
            ))

        return found

    def replay_csv(self, csv_content: str) -> ReplaySummary:
        self.summary = ReplaySummary(param_version=self.config.param_version)
        reader = csv.DictReader(io.StringIO(csv_content))
        line_no = 1

        for row_dict in reader:
            line_no += 1
            raw_line = ",".join(f'"{v}"' if "," in str(v) else str(v) for v in row_dict.values())
            row = self._parse_single_row(line_no, row_dict, raw_line)
            self.summary.break_down.append(row)

            if row.status == RowStatus.PROCESSED:
                self.summary.processed_rows += 1
                for anomaly in self._detect_anomalies(row):
                    self.summary.anomalies.append(anomaly)
            elif row.status == RowStatus.SKIPPED:
                self.summary.skipped_rows += 1
            elif row.status == RowStatus.BAD:
                self.summary.bad_rows += 1

        self.summary.total_rows = len(self.summary.break_down)
        self.summary.mark_finished()
        return self.summary

    def replay_file(self, filepath: str) -> ReplaySummary:
        with open(filepath, "r", encoding="utf-8") as f:
            return self.replay_csv(f.read())

    def print_cli_report(self, stream=None) -> None:
        s = self.summary
        out = stream or sys.stdout
        sep = "=" * 60
        print(sep, file=out)
        print("   图论路径参数回放 - CLI 统计报告", file=out)
        print(sep, file=out)
        print(f"  参数版本       : {s.param_version}", file=out)
        print(f"  开始时间       : {s.started_at}", file=out)
        print(f"  结束时间       : {s.finished_at}", file=out)
        print(f"  总行数         : {s.total_rows}", file=out)
        print("-" * 60, file=out)
        pct = lambda x: f"{(x / s.total_rows * 100):5.1f}%" if s.total_rows else "  0.0%"
        print(f"  [✅] 已处理行  : {s.processed_rows:4d} 行  ({pct(s.processed_rows)})", file=out)
        print(f"  [⏭️] 跳过行    : {s.skipped_rows:4d} 行  ({pct(s.skipped_rows)})", file=out)
        print(f"  [❌] 坏行      : {s.bad_rows:4d} 行  ({pct(s.bad_rows)})", file=out)
        print(f"  [⚠️] 异常项    : {len(s.anomalies):4d} 条", file=out)
        if s.sort_detection:
            print(f"  [🔀] 排序稳定  : {s.sort_detection.stable.value}", file=out)
        print("-" * 60, file=out)

        if s.processed_rows > 0:
            print("\n📋 已处理行清单（点击 question_id 可调取题目历史）:", file=out)
            for r in s.break_down:
                if r.status == RowStatus.PROCESSED and r.question:
                    q = r.question
                    param_str = ";".join(f"{k}={v}" for k, v in q.path_params.items()) or "(空)"
                    hist_remark = f"{len(q.remark.history)}条备注" if q.remark.history else "无备注"
                    hist_shot = f"{len(q.screenshots.history)}张截图" if q.screenshots.history else "无截图"
                    print(
                        f"  L{r.line_number:>3d} | {q.question_id:8s} | {q.title[:16]:16s} | "
                        f"参数[{param_str[:40]}] | 历史: {hist_remark}, {hist_shot}",
                        file=out,
                    )

        if s.skipped_rows > 0:
            print("\n⏭️  跳过行清单:", file=out)
            for r in s.break_down:
                if r.status == RowStatus.SKIPPED:
                    qid_disp = r.question_id or "(无id)"
                    print(f"  L{r.line_number:>3d} | {qid_disp:8s} | {r.skip_reason}", file=out)

        if s.bad_rows > 0:
            print("\n❌ 坏行清单（含题目编号 + 失败原因，可追到具体记录）:", file=out)
            for r in s.break_down:
                if r.status == RowStatus.BAD:
                    raw = r.raw_line if len(r.raw_line) < 60 else r.raw_line[:57] + "..."
                    qid_disp = r.question_id or "(无id)"
                    title_disp = r.title[:16] if r.title else "(无标题)"
                    print(f"  L{r.line_number:>3d} | {qid_disp:12s} | {title_disp:16s} | {r.error_message}", file=out)
                    print(f"         原始: {raw}", file=out)

        print("\n" + sep, file=out)
