import os
from typing import List, Optional
from .physics import ShotParams, ShotResult, compute_trajectory


def export_trajectory_csv(result: ShotResult, filepath: str) -> str:
    dirpath = os.path.dirname(filepath)
    if dirpath:
        os.makedirs(dirpath, exist_ok=True)

    with open(filepath, "w", encoding="utf-8") as f:
        f.write("t(s),x(m),y(m),vx(m/s),vy(m/s)\n")
        for pt in result.trajectory:
            f.write(f"{pt.t:.6f},{pt.x:.6f},{pt.y:.6f},{pt.vx:.6f},{pt.vy:.6f}\n")

    return filepath


def export_trajectory_plot(
    result: ShotResult,
    filepath: str,
    title: Optional[str] = None,
    show_rim: bool = True,
    show_apex: bool = True,
    dpi: int = 150,
) -> str:
    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
    except ImportError:
        raise ImportError("需要安装 matplotlib: pip install matplotlib")

    dirpath = os.path.dirname(filepath)
    if dirpath:
        os.makedirs(dirpath, exist_ok=True)

    xs = [pt.x for pt in result.trajectory]
    ys = [pt.y for pt in result.trajectory]

    fig, ax = plt.subplots(figsize=(10, 6))

    color = "#2ecc71" if result.hit else "#e74c3c"
    ax.plot(xs, ys, color=color, linewidth=2, label="Trajectory")

    if show_rim:
        p = result.params
        rim_left = p.rim_distance - p.rim_tolerance
        rim_right = p.rim_distance + p.rim_tolerance
        ax.plot([rim_left, rim_right], [p.rim_height, p.rim_height],
                color="orange", linewidth=4, label="Rim")
        ax.plot([0, max(xs) * 1.05], [0, 0], "k--", linewidth=0.5, alpha=0.3)

    if show_apex and result.apex_height is not None:
        ax.plot(result.apex_x, result.apex_height, "b^", markersize=10, label=f"Apex ({result.apex_height:.2f}m)")

    ax.set_xlabel("Horizontal Distance (m)")
    ax.set_ylabel("Height (m)")
    title_text = title or f"Shot Trajectory {'HIT' if result.hit else 'MISS'}"
    if result.params:
        title_text += f" (Angle={result.params.angle_deg:.1f}deg V={result.params.velocity_ms:.1f}m/s)"
    ax.set_title(title_text)
    ax.legend()
    ax.set_ylim(bottom=-0.5)
    ax.grid(True, alpha=0.3)

    fig.savefig(filepath, dpi=dpi, bbox_inches="tight")
    plt.close(fig)

    return filepath


def export_comparison_plot(
    results: List[ShotResult],
    labels: List[str],
    filepath: str,
    dpi: int = 150,
) -> str:
    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
    except ImportError:
        raise ImportError("需要安装 matplotlib: pip install matplotlib")

    dirpath = os.path.dirname(filepath)
    if dirpath:
        os.makedirs(dirpath, exist_ok=True)

    fig, ax = plt.subplots(figsize=(12, 7))

    colors = ["#2ecc71", "#3498db", "#e74c3c", "#9b59b6", "#f39c12", "#1abc9c"]

    for i, (result, label) in enumerate(zip(results, labels)):
        xs = [pt.x for pt in result.trajectory]
        ys = [pt.y for pt in result.trajectory]
        style = "-" if result.hit else "--"
        c = colors[i % len(colors)]
        hit_mark = "✓" if result.hit else "✗"
        ax.plot(xs, ys, style, color=c, linewidth=2,
                label=f"{label} {hit_mark} ({result.params.angle_deg:.1f}°/{result.params.velocity_ms:.1f}m/s)")

    if results:
        p = results[0].params
        rim_left = p.rim_distance - p.rim_tolerance
        rim_right = p.rim_distance + p.rim_tolerance
        ax.plot([rim_left, rim_right], [p.rim_height, p.rim_height],
                color="orange", linewidth=4, label="Rim")

    ax.set_xlabel("Horizontal Distance (m)")
    ax.set_ylabel("Height (m)")
    ax.set_title("Shot Trajectory Comparison")
    ax.legend()
    ax.set_ylim(bottom=-0.5)
    ax.grid(True, alpha=0.3)

    fig.savefig(filepath, dpi=dpi, bbox_inches="tight")
    plt.close(fig)

    return filepath


def export_hit_window_plot(
    hw,
    filepath: str,
    highlight_params: Optional[ShotParams] = None,
    dpi: int = 150,
) -> str:
    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
        import numpy as np
    except ImportError:
        raise ImportError("需要安装 matplotlib 和 numpy: pip install matplotlib numpy")

    dirpath = os.path.dirname(filepath)
    if dirpath:
        os.makedirs(dirpath, exist_ok=True)

    fig, ax = plt.subplots(figsize=(10, 8))

    grid_np = np.array(hw.grid, dtype=float)
    extent = [hw.grid_angles[0], hw.grid_angles[-1], hw.grid_velocities[0], hw.grid_velocities[-1]]
    im = ax.imshow(grid_np, aspect="auto", origin="lower", extent=extent, cmap="RdYlGn", vmin=0, vmax=1)

    ax.set_xlabel("Release Angle (deg)")
    ax.set_ylabel("Release Velocity (m/s)")
    ax.set_title("Hit Window (Green=Hit Red=Miss)")

    if highlight_params:
        ax.plot(highlight_params.angle_deg, highlight_params.velocity_ms,
                "w*", markersize=15, markeredgecolor="black", label="Current")
        ax.legend()

    fig.colorbar(im, ax=ax, label="Hit(1)/Miss(0)")
    fig.savefig(filepath, dpi=dpi, bbox_inches="tight")
    plt.close(fig)

    return filepath
