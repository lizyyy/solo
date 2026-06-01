import sys
import os
import json
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from wind_tunnel.models.models import ThresholdConfig
from wind_tunnel.session import SessionCoordinator
from wind_tunnel.report.report_generator import ReportGenerator

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.font_manager as fm

OUTPUT_DIR = Path(__file__).parent.parent / "output"
DATA_DIR = Path(__file__).parent / "data"


def setup_chinese_font():
    candidates = [
        "/System/Library/Fonts/STHeiti Medium.ttc",
        "/System/Library/Fonts/PingFang.ttc",
        "/Library/Fonts/Arial Unicode.ttf",
        "/System/Library/Fonts/Hiragino Sans GB.ttc",
    ]
    for fp in candidates:
        if os.path.exists(fp):
            fm.fontManager.addfont(fp)
            prop = fm.FontProperties(fname=fp)
            plt.rcParams["font.family"] = prop.get_name()
            return
    plt.rcParams["font.sans-serif"] = ["Arial Unicode MS", "SimHei", "DejaVu Sans"]
    plt.rcParams["axes.unicode_minus"] = False


def plot_charts(results, output_dir: Path, threshold_config=None):
    setup_chinese_font()
    sorted_results = sorted(results, key=lambda r: r.angle_of_attack)

    aoa = [r.angle_of_attack for r in sorted_results]
    cl = [r.cl for r in sorted_results]
    cd = [r.cd for r in sorted_results]
    ld = [r.ld_ratio for r in sorted_results]
    is_violation = [r.exceeds_threshold for r in sorted_results]

    fig, axes = plt.subplots(2, 2, figsize=(14, 10))
    fig.suptitle("Wind Tunnel Airfoil Lift-Drag Trial Calculation Report", fontsize=14, fontweight="bold")

    ax1 = axes[0, 0]
    ax1.plot(aoa, cl, "b-o", markersize=4, label="Cl")
    ax1.scatter(
        [aoa[i] for i in range(len(aoa)) if is_violation[i]],
        [cl[i] for i in range(len(cl)) if is_violation[i]],
        c="red", s=80, zorder=5, marker="x", label="Threshold Exceeded"
    )
    if threshold_config:
        ax1.axhline(y=threshold_config.cl_max, color="r", linestyle="--", alpha=0.5, label=f"Cl max={threshold_config.cl_max}")
        ax1.axhline(y=threshold_config.cl_min, color="r", linestyle=":", alpha=0.5, label=f"Cl min={threshold_config.cl_min}")
    ax1.set_xlabel("Angle of Attack (deg)")
    ax1.set_ylabel("Cl")
    ax1.set_title("Cl vs Angle of Attack")
    ax1.legend(fontsize=8)
    ax1.grid(True, alpha=0.3)

    ax2 = axes[0, 1]
    ax2.plot(aoa, cd, "g-o", markersize=4, label="Cd")
    ax2.scatter(
        [aoa[i] for i in range(len(aoa)) if is_violation[i]],
        [cd[i] for i in range(len(cd)) if is_violation[i]],
        c="red", s=80, zorder=5, marker="x", label="Threshold Exceeded"
    )
    if threshold_config:
        ax2.axhline(y=threshold_config.cd_max, color="r", linestyle="--", alpha=0.5, label=f"Cd max={threshold_config.cd_max}")
    ax2.set_xlabel("Angle of Attack (deg)")
    ax2.set_ylabel("Cd")
    ax2.set_title("Cd vs Angle of Attack")
    ax2.legend(fontsize=8)
    ax2.grid(True, alpha=0.3)

    ax3 = axes[1, 0]
    ax3.plot(aoa, ld, "m-o", markersize=4, label="L/D")
    ax3.scatter(
        [aoa[i] for i in range(len(aoa)) if is_violation[i]],
        [ld[i] for i in range(len(ld)) if is_violation[i]],
        c="red", s=80, zorder=5, marker="x", label="Threshold Exceeded"
    )
    ax3.set_xlabel("Angle of Attack (deg)")
    ax3.set_ylabel("L/D Ratio")
    ax3.set_title("Lift-Drag Ratio vs Angle of Attack")
    ax3.legend(fontsize=8)
    ax3.grid(True, alpha=0.3)

    ax4 = axes[1, 1]
    ax4.plot(cl, cd, "b-o", markersize=4, label="Cl-Cd Curve")
    ax4.scatter(
        [cl[i] for i in range(len(cl)) if is_violation[i]],
        [cd[i] for i in range(len(cd)) if is_violation[i]],
        c="red", s=80, zorder=5, marker="x", label="Threshold Exceeded"
    )
    for i, r in enumerate(sorted_results):
        if r.exceeds_threshold or i % 3 == 0:
            ax4.annotate(f"{r.angle_of_attack:.0f}°", (r.cl, r.cd), fontsize=7, textcoords="offset points", xytext=(5, 5))
    ax4.set_xlabel("Cl")
    ax4.set_ylabel("Cd")
    ax4.set_title("Cl-Cd Polar Curve")
    ax4.legend(fontsize=8)
    ax4.grid(True, alpha=0.3)

    plt.tight_layout()
    chart_path = output_dir / f"charts_{datetime.now().strftime('%Y%m%d_%H%M%S')}.png"
    fig.savefig(str(chart_path), dpi=150, bbox_inches="tight")
    plt.close(fig)
    return str(chart_path)


def main():
    print("=" * 60)
    print("  Wind Tunnel Airfoil Lift-Drag Trial Calculation System")
    print("  风洞翼型升阻试算系统")
    print("=" * 60)

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    coord = SessionCoordinator(output_dir=str(OUTPUT_DIR))

    threshold = ThresholdConfig(
        created_by="engineer_zhang",
        reason="initial_setup",
        cl_max=1.8,
        cl_min=-1.0,
        cd_max=0.08,
        ld_ratio_max=80.0,
        pressure_max_kpa=150.0,
        wind_speed_max_mps=100.0,
    )
    coord.init_threshold(threshold)
    print(f"\n[1] Threshold initialized: {threshold.config_id[:6]}")
    print(f"    Cl=[{threshold.cl_min}, {threshold.cl_max}]  Cd=[{threshold.cd_min}, {threshold.cd_max}]  L/D max={threshold.ld_ratio_max}")

    data_files = [
        str(DATA_DIR / "sensor_log_01.csv"),
        str(DATA_DIR / "sensor_log_02.csv"),
    ]
    print(f"\n[2] Running batch with {len(data_files)} sensor log files...")
    summary = coord.run_batch(data_files, batch_label="trial_run_20260601")
    print(f"    Records loaded: {summary['total_records']}")
    print(f"    Calculation results: {summary['total_results']}")
    print(f"    Sampling gaps detected: {summary['data_gaps']}")
    print(f"    Unit issues found: {summary['unit_issues']}")
    print(f"    Threshold violations: {summary['threshold_violations']}")
    for v in summary["violation_details"]:
        print(f"      -> Record {v['record_id']}: AoA={v['aoa']}° Cl={v['cl']} Cd={v['cd']} L/D={v['ld_ratio']}")
        print(f"         Detail: {v['detail']}")
        print(f"         Threshold version: {v['threshold_version']}")

    print(f"\n[3] Overriding threshold cd_max: {threshold.cd_max} -> 0.15 (reason: post-stall region allowed)")
    coord.override_threshold("cd_max", 0.15, "post-stall region allowed", actor="engineer_zhang")

    results_after = coord.get_results()
    new_violations = [r for r in results_after if r.exceeds_threshold]
    print(f"    After override: {len(new_violations)} violations remain")
    for v in new_violations:
        print(f"      -> Record {v.record_id}: {v.threshold_violation_detail}")

    print(f"\n[4] Adding note supplement to a specific record...")
    first_result = results_after[0] if results_after else None
    if first_result:
        supplement = coord.add_note_supplement(
            note_text="该数据点经现场工程师确认有效，传感器校准偏差已记录",
            affected_record_ids=[first_result.record_id],
            new_values={"cl": first_result.cl, "cd": first_result.cd},
            author="assistant_song",
        )
        print(f"    Supplement added: {supplement.supplement_id}")
        print(f"    Diff: {supplement.diff_description}")

    report_gen = ReportGenerator(output_dir=str(OUTPUT_DIR))

    session_data = {
        "session_id": coord.session.session_id,
        "started_at": coord.session.started_at.isoformat(),
        "finished_at": coord.session.finished_at.isoformat() if coord.session.finished_at else None,
        "batch_label": coord.session.batch_label,
        "source_files": coord.session.source_files,
        "active_threshold_id": coord.session.active_threshold_id,
    }

    print(f"\n[5] Generating text report...")
    report_path = report_gen.generate_full_report(
        results=coord.get_results(),
        session_data=session_data,
        gaps=coord.session.data_gaps,
        unit_issues=coord.session.unit_issues,
        threshold_chain=coord.threshold_mgr.get_version_chain(),
        supplements=coord.session.note_supplements,
        audit_log=coord.threshold_mgr.audit_summary(),
    )
    print(f"    Report saved: {report_path}")

    print(f"\n[6] Generating charts...")
    active_threshold = coord.threshold_mgr.get_active()
    chart_path = plot_charts(coord.get_results(), OUTPUT_DIR, active_threshold)
    print(f"    Charts saved: {chart_path}")

    charts_data_path = report_gen.save_charts_data(coord.get_results())
    print(f"    Charts data saved: {charts_data_path}")

    print(f"\n[7] Saving session...")
    session_path = coord.save_session()
    print(f"    Session saved: {session_path}")

    print(f"\n[8] Threshold version chain:")
    for i, vc in enumerate(coord.threshold_mgr.get_version_chain()):
        print(f"    [{i+1}] {vc['config_id'][:6]} by={vc['created_by']} reason={vc['reason']}")

    print(f"\n[9] Audit trail:")
    for a in coord.threshold_mgr.audit_summary():
        print(f"    [{a['timestamp'][:19]}] {a['action']} by={a['actor']} | {a['details']}")

    print("\n" + "=" * 60)
    print("  Trial calculation complete. All outputs saved to:")
    print(f"  {OUTPUT_DIR}")
    print("=" * 60)


if __name__ == "__main__":
    main()
