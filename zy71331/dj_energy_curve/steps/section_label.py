from __future__ import annotations

import statistics

from ..models import Track, Section, Transition, StepResult, SectionType, FlagStatus

PEAK_ENERGY_THRESHOLD = 8.0
WARMUP_MAX_ENERGY = 4.0
MIN_SECTION_LENGTH = 2


def _classify_energy_level(energy: float | None) -> str:
    if energy is None:
        return "unknown"
    if energy >= 8.0:
        return "high"
    if energy >= 5.0:
        return "medium"
    return "low"


def label_sections(
    tracks: list[Track],
    transitions: list[Transition],
) -> tuple[list[Track], list[Section], StepResult]:
    result = StepResult(step_name="section_label")
    issues: list[str] = []

    if not tracks:
        result.issues = ["No tracks to label sections"]
        return tracks, [], result

    valid_energies = [t.energy for t in tracks if t.energy is not None]
    if not valid_energies:
        for t in tracks:
            t.flags.append("section_unknown")
        result.issues = ["No energy data - cannot label sections"]
        return tracks, [], result

    if len(valid_energies) > 1:
        peak_threshold = min(PEAK_ENERGY_THRESHOLD, statistics.mean(valid_energies) + statistics.stdev(valid_energies))
    else:
        peak_threshold = PEAK_ENERGY_THRESHOLD

    for track in tracks:
        level = _classify_energy_level(track.energy)
        track.meta["energy_level"] = level

    raw_sections: list[dict] = []
    current_type = SectionType.UNKNOWN
    current_start = 0

    for i, track in enumerate(tracks):
        energy = track.energy
        proposed = SectionType.UNKNOWN

        if energy is None:
            proposed = SectionType.TRANSITION
        elif i == 0:
            if energy <= WARMUP_MAX_ENERGY:
                proposed = SectionType.WARMUP
            elif energy >= peak_threshold:
                proposed = SectionType.PEAK
                issues.append(
                    f"Position {track.position}: Peak energy too early "
                    f"(energy={energy}, track={track.title})"
                )
            else:
                proposed = SectionType.BUILD
        elif i == len(tracks) - 1:
            if energy >= peak_threshold:
                proposed = SectionType.PEAK
            elif energy <= WARMUP_MAX_ENERGY:
                proposed = SectionType.COOLDOWN
            else:
                proposed = SectionType.COOLDOWN
        else:
            if energy >= peak_threshold:
                proposed = SectionType.PEAK
            elif energy <= WARMUP_MAX_ENERGY:
                if current_type in (SectionType.PEAK, SectionType.BUILD):
                    proposed = SectionType.COOLDOWN
                else:
                    proposed = SectionType.WARMUP
            else:
                if current_type in (SectionType.WARMUP, SectionType.BUILD):
                    proposed = SectionType.BUILD
                elif current_type == SectionType.PEAK:
                    proposed = SectionType.BUILD
                else:
                    proposed = SectionType.TRANSITION

        if proposed != current_type:
            if i > current_start:
                raw_sections.append({
                    "type": current_type,
                    "start": current_start,
                    "end": i - 1,
                })
            current_type = proposed
            current_start = i

    raw_sections.append({
        "type": current_type,
        "start": current_start,
        "end": len(tracks) - 1,
    })

    sections: list[Section] = []
    for idx, raw in enumerate(raw_sections):
        sec_type = raw["type"]
        start_i = raw["start"]
        end_i = raw["end"]
        sec_tracks = tracks[start_i:end_i + 1]

        sec_energies = [t.energy for t in sec_tracks if t.energy is not None]
        sec_bpms = [t.bpm_normalized for t in sec_tracks if t.bpm_normalized is not None]
        sec_keys = [t.key_normalized for t in sec_tracks if t.key_normalized]

        dominant_key = max(set(sec_keys), key=sec_keys.count) if sec_keys else ""

        notes: list[str] = []
        if len(sec_tracks) < MIN_SECTION_LENGTH and sec_type not in (SectionType.TRANSITION,):
            notes.append(f"Short section ({len(sec_tracks)} tracks)")

        section = Section(
            name=f"section_{idx + 1}_{sec_type.value}",
            section_type=sec_type,
            start_position=sec_tracks[0].position if sec_tracks else 0,
            end_position=sec_tracks[-1].position if sec_tracks else 0,
            avg_energy=round(statistics.mean(sec_energies), 2) if sec_energies else 0.0,
            avg_bpm=round(statistics.mean(sec_bpms), 1) if sec_bpms else 0.0,
            dominant_key=dominant_key,
            notes=notes,
        )
        sections.append(section)

    for track in tracks:
        for section in sections:
            if section.start_position <= track.position <= section.end_position:
                track.meta["section"] = section.name
                track.meta["section_type"] = section.section_type.value
                break

    peak_sections = [s for s in sections if s.section_type == SectionType.PEAK]
    non_peak = [s for s in sections if s.section_type not in (SectionType.PEAK, SectionType.TRANSITION)]
    if peak_sections and non_peak:
        first_peak_pos = min(s.start_position for s in peak_sections)
        total_tracks = len(tracks)
        if first_peak_pos <= total_tracks * 0.3:
            issues.append(
                f"Peak starts at position {first_peak_pos} ({first_peak_pos/total_tracks*100:.0f}% "
                f"into set) - peak may come too early"
            )

    result.issues = issues
    result.meta["section_count"] = len(sections)
    type_counts: dict[str, int] = {}
    for s in sections:
        key = s.section_type.value
        type_counts[key] = type_counts.get(key, 0) + 1
    result.meta["section_types"] = type_counts
    result.meta["peak_positions"] = [s.start_position for s in peak_sections]

    return tracks, sections, result
