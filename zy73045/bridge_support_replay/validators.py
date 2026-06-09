"""照片时间错位检测 + 处理建议。

核心不是"报个警就完了"，而是告诉接手的人具体怎么处理。
建议分档：
  - < 30min   → 现场相机时钟误差，可 ACCEPT_WITH_NOTE
  - 30min~2h  → 先 CHECK_CAMERA_CLOCK，再考虑 PROVIDE_WITNESS_RECORD
  - 2h~1d     → 强烈建议 RE_EXIF 重读 + 检查是否时区错误
  - > 1d      → 考虑 RE_SHOOT_WITH_TIMESTAMP 或 ESCALATE
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Any, Optional

from .models import (
    PhotoRecord,
    PhotoMismatchAction,
    FailureCode,
)


@dataclass
class PhotoMismatchInfo:
    """单张照片的错位信息 + 建议。"""

    photo_id: str
    file_path: str
    checks: list[dict[str, Any]] = field(default_factory=list)
    severity: str = "none"         # none / low / medium / high / critical
    max_delta_minutes: float = 0.0
    suggested_actions: list[str] = field(default_factory=list)
    human_readable_summary: str = ""

    def to_dict(self) -> dict:
        return {
            "photo_id": self.photo_id,
            "file_path": self.file_path,
            "checks": [dict(c) for c in self.checks],
            "severity": self.severity,
            "max_delta_minutes": round(self.max_delta_minutes, 1),
            "suggested_actions": list(self.suggested_actions),
            "human_readable_summary": self.human_readable_summary,
        }


def _parse_time(s: Optional[str]) -> Optional[datetime]:
    if not s:
        return None
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00"))
    except ValueError:
        return None


def _compare(label_a: str, t_a: Optional[datetime],
             label_b: str, t_b: Optional[datetime]) -> Optional[dict]:
    if t_a is None or t_b is None:
        return None
    delta = t_a - t_b
    mins = abs(delta.total_seconds()) / 60.0
    return {
        "pair": f"{label_a} vs {label_b}",
        "delta_minutes": round(mins, 1),
        "delta_sign": "+" if delta.total_seconds() >= 0 else "-",
        f"{label_a}": t_a.isoformat(),
        f"{label_b}": t_b.isoformat(),
    }


def _classify_severity(max_mins: float) -> tuple[str, list[str]]:
    """根据最大时间差给严重程度和建议动作。"""
    if max_mins < 1:
        return "none", [f"时间差 {max_mins:.1f}min，无需处理"]
    if max_mins < 30:
        return "low", [
            f"时间差 {max_mins:.1f}min，属于常见的现场相机时钟误差",
            f"建议 {PhotoMismatchAction.ACCEPT_WITH_NOTE.value}：在备注里写明"
            f"“现场相机时间偏差约 {max_mins:.0f} 分钟，已核对 EXIF 原始信息，以打卡时间为准”。",
        ]
    if max_mins < 120:
        return "medium", [
            f"时间差 {max_mins:.1f}min，超过了可忽略范围",
            f"步骤1 → {PhotoMismatchAction.CHECK_CAMERA_CLOCK.value}：找到拍照人，"
            f"核对手机/相机当时的系统时间是否正确、时区是否为 Asia/Shanghai。",
            f"步骤2 → {PhotoMismatchAction.PROVIDE_WITNESS_RECORD.value}：如时钟没问题，"
            f"让当时在场的同事补一条“确认 XX 时间在作业现场”的文字记录，签上姓名日期。",
            f"如果以上能闭环 → {PhotoMismatchAction.ACCEPT_WITH_NOTE.value}。",
        ]
    if max_mins < 1440:
        return "high", [
            f"⚠️ 时间差 {max_mins:.1f}min（约 {max_mins/60:.1f} 小时），可能存在时区或 EXIF 覆盖问题",
            f"步骤1 → {PhotoMismatchAction.RE_EXIF.value}：用 exiftool/预览工具重新读取原始 JPG 的 "
            f"DateTimeOriginal / CreateDate / GPSDateTime，不要用微信/网盘转发后的二次文件。",
            f"步骤2 → 检查相机时区（{PhotoMismatchAction.CHECK_CAMERA_CLOCK.value}）：是否误设为 UTC。",
            f"步骤3 → 如 EXIF 的确错误，让拍照人 {PhotoMismatchAction.PROVIDE_WITNESS_RECORD.value} "
            f"或找到当时的打卡记录/聊天记录作为佐证。",
        ]
    return "critical", [
        f"🚨 时间差超过 1 天（{max_mins:.1f}min），材料存疑",
        f"步骤1 → {PhotoMismatchAction.RE_EXIF.value}：确认是否拿错了照片文件。",
        f"步骤2 → 如文件没拿错 → {PhotoMismatchAction.RE_SHOOT_WITH_TIMESTAMP.value}：到现场重新拍摄，"
        f"在画面里拍入当天手机的北京时间屏幕（含年月日时分），并把新旧照片一起归档。",
        f"步骤3 → 情况特殊或有争议 → {PhotoMismatchAction.ESCALATE.value}："
        f"交给安全员老唐牵头做三方确认（作业人 + 安全员 + 现场监理）。",
    ]


def validate_photo_timeline(photo: PhotoRecord) -> PhotoMismatchInfo:
    """对单张照片做多组时间对比，给出严重程度和处理建议。

    关键规则：
    - 上传时间 (upload) 和拍照时间本来就允许差几天（晚上传是正常的），
      只有在 "上传比拍照还早" 这种违背因果的情况才单独报警。
    - 只对 exif / claimed / site 三者之间的偏差做严重度分级，
      因为这三个都在说"什么时候拍的"，是老唐关心的时间错位核心。
    """
    exif = _parse_time(photo.exif_time)
    claimed = _parse_time(photo.claimed_time)
    site = _parse_time(photo.site_time)
    upload = _parse_time(photo.upload_time)

    checks: list[dict] = []
    # 只比较"拍照时刻"的三种表述 — 三者之间任何偏差都是真错位
    for label_a, t_a, label_b, t_b in [
        ("exif", exif, "claimed", claimed),
        ("exif", exif, "site", site),
        ("claimed", claimed, "site", site),
    ]:
        r = _compare(label_a, t_a, label_b, t_b)
        if r:
            checks.append(r)

    # 上传比拍照还早？单独记一条（不会影响严重度分级，但会进 checks）
    if exif is not None and upload is not None and upload < exif:
        delta = exif - upload
        mins = abs(delta.total_seconds()) / 60.0
        checks.append({
            "pair": "upload vs exif",
            "delta_minutes": round(mins, 1),
            "delta_sign": "-",
            "note": f"上传时间比 EXIF 早 {mins:.0f} 分钟，违反因果（可能上传时间被改或时区错）",
            "upload": upload.isoformat(),
            "exif": exif.isoformat(),
        })

    max_mins = max((c["delta_minutes"] for c in checks), default=0.0)
    severity, actions = _classify_severity(max_mins)

    # 写一条给人一眼能看懂的话
    if severity == "none":
        summary = "照片各时间字段一致"
    else:
        worst = max(checks, key=lambda c: c["delta_minutes"])
        summary = (
            f"检测到 {worst['pair']} 相差 {worst['delta_minutes']:.1f} 分钟"
            f"（{worst['delta_sign']}），严重程度：{severity}"
        )

    info = PhotoMismatchInfo(
        photo_id=photo.photo_id,
        file_path=photo.file_path,
        checks=checks,
        severity=severity,
        max_delta_minutes=max_mins,
        suggested_actions=actions,
        human_readable_summary=summary,
    )
    return info


def validate_all_photos(photos: list[PhotoRecord]) -> tuple[list[PhotoMismatchInfo], bool]:
    """批量检测。返回 (所有检测结果, 是否存在 high/critical 级别问题)。"""
    results = [validate_photo_timeline(p) for p in photos]
    has_blocker = any(r.severity in ("high", "critical") for r in results)
    return results, has_blocker
