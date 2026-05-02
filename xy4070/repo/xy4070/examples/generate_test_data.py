import csv
import math
from pathlib import Path
from typing import Dict, Tuple


def generate_impulse_response(
    distance_m: float,
    sample_rate: float = 48000.0,
    speed_of_sound: float = 345.0,
    amplitude: float = 1.0,
    reflection_coeff: float = 0.6,
    noise_level: float = 0.02,
    delay_offset_ms: float = 0.0,
    duration_ms: float = 200.0,
) -> Tuple[list, list]:
    dt = 1.0 / sample_rate
    n_samples = int(duration_ms / 1000.0 / dt)

    direct_time = distance_m / speed_of_sound + delay_offset_ms / 1000.0
    direct_sample = int(direct_time / dt)

    times = [i * dt for i in range(n_samples)]
    amp = [0.0] * n_samples

    import random
    random.seed(int(distance_m * 1000 + delay_offset_ms * 100))

    for i in range(n_samples):
        t_rel = (i - direct_sample) * dt
        if t_rel >= -0.001:
            decay = math.exp(-t_rel * 50) if t_rel >= 0 else 0
            direct_amp = amplitude * decay

            if t_rel >= 0:
                freq = 2000.0 + random.random() * 1000
                phase = random.random() * math.pi * 2
                direct_amp *= math.sin(freq * t_rel + phase) * 0.5 + 0.5

            amp[i] = direct_amp

    reflections = [
        (distance_m * 1.5, reflection_coeff * 0.8),
        (distance_m * 2.0, reflection_coeff * 0.5),
        (distance_m * 2.8, reflection_coeff * 0.3),
    ]

    for ref_dist, ref_amp in reflections:
        ref_time = ref_dist / speed_of_sound + delay_offset_ms / 1000.0
        ref_sample = int(ref_time / dt)

        for i in range(max(0, ref_sample - 5), min(n_samples, ref_sample + 20)):
            t_rel = (i - ref_sample) * dt
            if t_rel >= -0.0005:
                decay = math.exp(-t_rel * 80) if t_rel >= 0 else 0
                freq = 1500.0 + random.random() * 800
                phase = random.random() * math.pi * 2
                ref_signal = ref_amp * amplitude * decay * math.sin(freq * t_rel + phase)
                amp[i] += ref_signal

    for i in range(n_samples):
        amp[i] += (random.random() - 0.5) * 2 * noise_level

    return times, amp


def write_ir_csv(
    path: Path,
    times: list,
    amplitudes: list,
    sample_rate: float = 48000.0,
):
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["; Sample Rate: {} Hz".format(sample_rate)])
        writer.writerow(["time_s", "amplitude"])
        for t, a in zip(times, amplitudes):
            writer.writerow([f"{t:.8f}", f"{a:.6f}"])


def main():
    import sys
    output_dir = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("examples/measurements")

    speed_of_sound = 345.0
    sample_rate = 48000.0

    speaker_positions = {
        "L": (-4.5, 0, 2.5),
        "R": (4.5, 0, 2.5),
        "C": (0, 0, 2.5),
        "LS": (-6, 3, 2.2),
        "RS": (6, 3, 2.2),
        "SUB1": (-3, -2, 0.5),
        "SUB2": (3, -2, 0.5),
    }

    point_positions = {
        "FHC": (0, 5, 1.5),
        "A1": (-3, 6, 1.2),
        "A2": (0, 6, 1.2),
        "A3": (3, 6, 1.2),
        "B1": (-3, 9, 1.2),
        "B2": (0, 9, 1.2),
        "B3": (3, 9, 1.2),
    }

    delay_offsets_ms = {
        "L": 0.0,
        "R": 0.0,
        "C": 2.5,
        "LS": 8.0,
        "RS": 8.0,
        "SUB1": 15.0,
        "SUB2": 15.0,
    }

    for spk_id, spk_pos in speaker_positions.items():
        for pt_id, pt_pos in point_positions.items():
            dx = spk_pos[0] - pt_pos[0]
            dy = spk_pos[1] - pt_pos[1]
            dz = spk_pos[2] - pt_pos[2]
            distance = math.sqrt(dx * dx + dy * dy + dz * dz)

            import random
            random.seed(hash(f"{spk_id}_{pt_id}") % 10000)

            times, amplitudes = generate_impulse_response(
                distance_m=distance,
                sample_rate=sample_rate,
                speed_of_sound=speed_of_sound,
                amplitude=0.8 + random.random() * 0.4,
                reflection_coeff=0.5 + random.random() * 0.2,
                noise_level=0.015 + random.random() * 0.01,
                delay_offset_ms=delay_offsets_ms.get(spk_id, 0.0) + random.uniform(-0.5, 0.5),
            )

            filename = f"IR_{spk_id}_{pt_id}.csv"
            filepath = output_dir / filename
            write_ir_csv(filepath, times, amplitudes, sample_rate)
            print(f"Generated: {filepath}")


if __name__ == "__main__":
    main()
