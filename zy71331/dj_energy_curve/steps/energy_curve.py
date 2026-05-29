from __future__ import annotations

import statistics

from ..models import Track, Transition, StepResult, KeyRelation, FlagStatus

from .key_compat import key_relation

ENERGY_DROP_THRESHOLD = 3.0
ENERGY_SPIKE_THRESHOLD = 3.0
ENERGY_JUMP_BPM_FACTOR = 0.3


def compute_energy_curve(
    tracks: list[Track],
) -> tuple[list[Track], list[Transition], StepResult]:
    result = StepResult(step_name="energy_curve")
    issues: list[str] = []

    energies = [t.energy for t in tracks if t.energy is not None]
    if not energies:
        issues.append("No energy data available for any track")
        result.issues = issues
        return tracks, [], result

    mean_energy = statistics.mean(energies)
    std_energy = statistics.stdev(energies) if len(energies) > 1 else 1.0

    for track in tracks:
        if track.energy is None:
            track.flags.append("energy_missing")
            if track.status == FlagStatus.OK:
                track.status = FlagStatus.REVIEW
                track.flags.append("auto_review:energy_missing")
            continue

        if track.energy <= 1.0:
            track.flags.append("energy_very_low")
        elif track.energy >= 9.0:
            track.flags.append("energy_very_high")

    transitions: list[Transition] = []
    for i in range(len(tracks) - 1):
        curr = tracks[i]
        nxt = tracks[i + 1]

        if curr.energy is None or nxt.energy is None:
            trans = Transition(
                from_position=curr.position,
                to_position=nxt.position,
                is_smooth=False,
                issues=["missing_energy_data"],
            )
            transitions.append(trans)
            continue

        bpm_delta = 0.0
        if curr.bpm_normalized and nxt.bpm_normalized:
            bpm_delta = round(abs(nxt.bpm_normalized - curr.bpm_normalized), 1)

        energy_delta = round(nxt.energy - curr.energy, 1)

        k_rel = KeyRelation.INCOMPATIBLE
        if curr.key_normalized and nxt.key_normalized:
            k_rel = key_relation(curr.key_normalized, nxt.key_normalized)

        trans_issues: list[str] = []
        is_smooth = True

        if energy_delta <= -ENERGY_DROP_THRESHOLD:
            trans_issues.append(
                f"energy_drop: {energy_delta:+.1f} (threshold: -{ENERGY_DROP_THRESHOLD})"
            )
            is_smooth = False
            issues.append(
                f"Position {curr.position}->{nxt.position}: "
                f"Energy drops {energy_delta:+.1f} "
                f"({curr.title} [{curr.energy}] -> {nxt.title} [{nxt.energy}])"
            )

        if energy_delta >= ENERGY_SPIKE_THRESHOLD:
            trans_issues.append(
                f"energy_spike: {energy_delta:+.1f} (threshold: +{ENERGY_SPIKE_THRESHOLD})"
            )
            is_smooth = False
            issues.append(
                f"Position {curr.position}->{nxt.position}: "
                f"Energy spikes {energy_delta:+.1f} "
                f"({curr.title} [{curr.energy}] -> {nxt.title} [{nxt.energy}])"
            )

        if bpm_delta > 30:
            trans_issues.append(f"bpm_jump: {bpm_delta:.0f}")
            is_smooth = False

        if k_rel == KeyRelation.INCOMPATIBLE:
            trans_issues.append("key_incompatible")
            is_smooth = False

        trans = Transition(
            from_position=curr.position,
            to_position=nxt.position,
            bpm_delta=bpm_delta,
            key_relation=k_rel,
            energy_delta=energy_delta,
            is_smooth=is_smooth,
            issues=trans_issues,
        )
        transitions.append(trans)

    rough_transitions = [t for t in transitions if not t.is_smooth]
    result.issues = issues
    result.meta["mean_energy"] = round(mean_energy, 2)
    result.meta["std_energy"] = round(std_energy, 2)
    result.meta["total_transitions"] = len(transitions)
    result.meta["rough_transitions"] = len(rough_transitions)
    result.meta["energy_range"] = [min(energies), max(energies)]

    return tracks, transitions, result
