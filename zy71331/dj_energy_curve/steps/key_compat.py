from __future__ import annotations

from ..models import Track, StepResult, KeyRelation, FlagStatus

CAMELOT_WHEEL: dict[str, list[str]] = {}
_KEYS_MAJOR = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
_KEYS_MINOR = [k + "m" for k in _KEYS_MAJOR]

for _i in range(12):
    _num = _i + 1
    _maj = f"{_num}B"
    _min = f"{_num}A"
    _adj_up = f"{(_i + 1) % 12 + 1}B"
    _adj_down = f"{(_i - 1) % 12 + 1}B"
    _adj_up_min = f"{(_i + 1) % 12 + 1}A"
    _adj_down_min = f"{(_i - 1) % 12 + 1}A"
    _rel_min = f"{_num}A"
    _rel_maj = f"{_num}B"
    _diag_up_min = f"{(_i + 1) % 12 + 1}A"
    _diag_down_min = f"{(_i - 1) % 12 + 1}A"
    _diag_up_maj = f"{(_i + 1) % 12 + 1}B"
    _diag_down_maj = f"{(_i - 1) % 12 + 1}B"

    CAMELOT_WHEEL[_maj] = [_adj_up, _adj_down, _rel_min, _diag_up_min, _diag_down_min]
    CAMELOT_WHEEL[_min] = [_adj_up_min, _adj_down_min, _rel_maj, _diag_up_maj, _diag_down_maj]

_TRADITIONAL_TO_CAMELOT: dict[str, str] = {}
for _i, _k in enumerate(_KEYS_MAJOR):
    _TRADITIONAL_TO_CAMELOT[_k] = f"{_i + 1}B"
    _TRADITIONAL_TO_CAMELOT[_k.lower()] = f"{_i + 1}B"
    _TRADITIONAL_TO_CAMELOT[_k + "m"] = f"{_i + 1}A"
    _TRADITIONAL_TO_CAMELOT[_k.lower() + "m"] = f"{_i + 1}A"
    _TRADITIONAL_TO_CAMELOT[_k + " min"] = f"{_i + 1}A"
    _TRADITIONAL_TO_CAMELOT[_k + " minor"] = f"{_i + 1}A"
    _TRADITIONAL_TO_CAMELOT[_k + " maj"] = f"{_i + 1}B"
    _TRADITIONAL_TO_CAMELOT[_k + " major"] = f"{_i + 1}B"

_SHARP_ALIASES = {"Db": "C#", "Eb": "D#", "Fb": "E", "Gb": "F#", "Ab": "G#", "Bb": "A#", "Cb": "B"}
for _alias, _canonical in dict(_SHARP_ALIASES).items():
    _TRADITIONAL_TO_CAMELOT[_alias] = _TRADITIONAL_TO_CAMELOT[_canonical]
    _TRADITIONAL_TO_CAMELOT[_alias + "m"] = _TRADITIONAL_TO_CAMELOT[_canonical + "m"]
    _TRADITIONAL_TO_CAMELOT[_alias.lower()] = _TRADITIONAL_TO_CAMELOT[_canonical]
    _TRADITIONAL_TO_CAMELOT[_alias.lower() + "m"] = _TRADITIONAL_TO_CAMELOT[_canonical + "m"]


def to_camelot(key_str: str) -> str | None:
    if not key_str:
        return None
    key_str = key_str.strip()
    if len(key_str) >= 2 and key_str[0].isdigit():
        code = key_str[:2] if len(key_str) >= 2 and key_str[1] in "AB" else key_str[0] + "A"
        if code in CAMELOT_WHEEL:
            return code
    lookup = key_str.replace("♯", "#").replace("♭", "b")
    return _TRADITIONAL_TO_CAMELOT.get(lookup)


def key_relation(key_from: str | None, key_to: str | None) -> KeyRelation:
    if not key_from or not key_to:
        return KeyRelation.INCOMPATIBLE
    if key_from == key_to:
        return KeyRelation.SAME
    compat = CAMELOT_WHEEL.get(key_from, [])
    if key_to in compat:
        if key_to == _get_relative(key_from):
            return KeyRelation.RELATIVE
        num_from = int(key_from[:-1])
        num_to = int(key_to[:-1])
        if abs(num_from - num_to) <= 1 or abs(num_from - num_to) >= 11:
            return KeyRelation.ADJACENT
        return KeyRelation.DIAG
    return KeyRelation.INCOMPATIBLE


def _get_relative(camelot: str) -> str | None:
    if not camelot or len(camelot) < 2:
        return None
    num = camelot[:-1]
    letter = camelot[-1]
    return num + ("A" if letter == "B" else "B")


def check_key_compat(tracks: list[Track]) -> tuple[list[Track], StepResult]:
    result = StepResult(step_name="key_compat")
    modified = 0
    issues: list[str] = []

    for track in tracks:
        if not track.key_normalized and track.key_raw:
            camelot = to_camelot(track.key_raw)
            if camelot:
                track.key_normalized = camelot
                modified += 1
            else:
                track.flags.append("key_unrecognized")
                if track.status == FlagStatus.OK:
                    track.status = FlagStatus.REVIEW
                    track.flags.append("auto_review:key_unrecognized")
                issues.append(
                    f"Track {track.track_id} ({track.title}): "
                    f"Key '{track.key_raw}' could not be mapped to Camelot"
                )

        elif not track.key_raw:
            track.flags.append("key_missing")
            if track.status == FlagStatus.OK:
                track.status = FlagStatus.REVIEW
                track.flags.append("auto_review:key_missing")
            issues.append(
                f"Track {track.track_id} ({track.title}): No key information"
            )

    key_conflict_pairs: list[tuple[int, int, KeyRelation]] = []
    for i in range(len(tracks) - 1):
        curr = tracks[i]
        nxt = tracks[i + 1]
        if curr.key_normalized and nxt.key_normalized:
            rel = key_relation(curr.key_normalized, nxt.key_normalized)
            if rel == KeyRelation.INCOMPATIBLE:
                key_conflict_pairs.append((curr.position, nxt.position, rel))
                issues.append(
                    f"Position {curr.position}->{nxt.position}: "
                    f"Key conflict {curr.key_normalized} -> {nxt.key_normalized} "
                    f"({curr.title} -> {nxt.title})"
                )
                nxt.flags.append("key_conflict_transition")

    result.tracks_modified = modified
    result.issues = issues
    result.meta["conflict_count"] = len(key_conflict_pairs)
    result.meta["conflict_pairs"] = [
        {"from": p[0], "to": p[1], "relation": p[2].value} for p in key_conflict_pairs
    ]
    result.meta["tracks_with_key"] = sum(1 for t in tracks if t.key_normalized)
    result.meta["total_tracks"] = len(tracks)
    return tracks, result
