import os
import math
from typing import Dict, List, Optional, Tuple, Any
from models import (
    StudentRecord,
    WavelengthResult,
    ExperimentReport,
    Anomaly,
    SourceType,
)


def setup_matplotlib():
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from matplotlib import rcParams

    rcParams["font.sans-serif"] = ["Arial Unicode MS", "SimHei", "DejaVu Sans"]
    rcParams["axes.unicode_minus"] = False
    rcParams["figure.dpi"] = 150
    rcParams["savefig.dpi"] = 300
    rcParams["savefig.bbox"] = "tight"
    return plt


def plot_fringe_positions(
    student_record: StudentRecord,
    output_path: str,
    anomalies: Optional[List[Anomaly]] = None,
) -> Tuple[str, Dict[str, Any]]:
    plt = setup_matplotlib()

    fig, ax = plt.subplots(figsize=(10, 6))

    if not student_record.fringes:
        return "", {"error": "没有条纹数据"}

    max_pos = max(abs(f.position) for f in student_record.fringes) if student_record.fringes else 0.1
    margin = max_pos * 0.15

    ax.axvline(x=0, color="gray", linestyle="--", alpha=0.5, label="零级位置")

    colors = {
        -3: "#e74c3c", -2: "#e67e22", -1: "#f1c40f",
        0: "#3498db",
        1: "#2ecc71", 2: "#1abc9c", 3: "#9b59b6",
    }

    anomaly_ids = set()
    if anomalies:
        for anomaly in anomalies:
            anomaly_ids.update(anomaly.affected_ids)

    for fringe in student_record.fringes:
        color = colors.get(fringe.order, "#95a5a6")
        marker = "o" if fringe.source_id not in anomaly_ids else "X"
        markersize = 12 if fringe.source_id not in anomaly_ids else 16

        ax.plot(
            fringe.position,
            abs(fringe.order),
            marker,
            color=color,
            markersize=markersize,
            markeredgecolor="white",
            markeredgewidth=1.5,
            label=f"k={fringe.order} ({fringe.side})",
        )

        ax.annotate(
            f"k={fringe.order}\n{fringe.position*1000:.2f} mm",
            xy=(fringe.position, abs(fringe.order)),
            xytext=(0, 20),
            textcoords="offset points",
            ha="center",
            fontsize=9,
            bbox=dict(boxstyle="round,pad=0.3", fc="white", ec=color, alpha=0.8),
        )

    ax.set_xlabel("条纹位置 (m)", fontsize=12)
    ax.set_ylabel("级次 |k|", fontsize=12)
    ax.set_title("光栅衍射条纹位置分布", fontsize=14, fontweight="bold", pad=20)
    ax.set_xlim(-max_pos - margin, max_pos + margin)
    ax.set_ylim(-0.5, max(abs(f.order) for f in student_record.fringes) + 1)

    ax.grid(True, alpha=0.3, linestyle="--")

    handles, labels = ax.get_legend_handles_labels()
    by_label = dict(zip(labels, handles))
    ax.legend(
        by_label.values(),
        by_label.keys(),
        loc="upper center",
        bbox_to_anchor=(0.5, -0.1),
        ncol=4,
        fontsize=9,
    )

    if anomalies:
        error_count = sum(1 for a in anomalies if a.severity == "error")
        warning_count = sum(1 for a in anomalies if a.severity == "warning")
        if error_count > 0 or warning_count > 0:
            ax.text(
                0.02,
                0.98,
                f"检测到 {error_count} 个错误, {warning_count} 个警告\n(X标记表示异常数据)",
                transform=ax.transAxes,
                va="top",
                fontsize=10,
                bbox=dict(boxstyle="round,pad=0.5", fc="red", ec="darkred", alpha=0.1),
                color="darkred",
            )

    student_name = student_record.student_name or "未知学生"
    student_id = student_record.student_id or "未知学号"
    ax.text(
        0.98,
        0.02,
        f"学生: {student_name} ({student_id})\n记录ID: {student_record.source_id[:8]}...",
        transform=ax.transAxes,
        ha="right",
        va="bottom",
        fontsize=8,
        style="italic",
        color="gray",
    )

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    plt.savefig(output_path)
    plt.close()

    trace = {
        "chart_type": "fringe_positions",
        "output_path": output_path,
        "fringe_count": len(student_record.fringes),
        "anomaly_highlighted": len(anomaly_ids),
        "student_record_id": student_record.source_id,
    }

    return output_path, trace


def plot_wavelength_comparison(
    wavelength_results: List[WavelengthResult],
    output_path: str,
    reference_wavelength: Optional[float] = None,
    final_wavelength: Optional[float] = None,
    final_uncertainty: Optional[float] = None,
    anomalies: Optional[List[Anomaly]] = None,
) -> Tuple[str, Dict[str, Any]]:
    plt = setup_matplotlib()

    fig, ax = plt.subplots(figsize=(10, 6))

    if not wavelength_results:
        return "", {"error": "没有波长结果数据"}

    anomaly_ids = set()
    if anomalies:
        for anomaly in anomalies:
            anomaly_ids.update(anomaly.affected_ids)

    orders = [abs(r.order) for r in wavelength_results]
    wavelengths_nm = [r.value * 1e9 for r in wavelength_results]
    uncertainties_nm = [r.uncertainty * 1e9 for r in wavelength_results]

    colors = []
    for r in wavelength_results:
        if r.source_id in anomaly_ids:
            colors.append("#e74c3c")
        else:
            colors.append("#3498db")

    x_pos = range(len(wavelength_results))

    bars = ax.bar(
        x_pos,
        wavelengths_nm,
        yerr=uncertainties_nm,
        capsize=8,
        color=colors,
        alpha=0.8,
        edgecolor="white",
        linewidth=1.5,
        error_kw=dict(ecolor="#2c3e50", lw=2),
    )

    for i, (bar, wl, unc) in enumerate(zip(bars, wavelengths_nm, uncertainties_nm)):
        height = bar.get_height()
        ax.text(
            bar.get_x() + bar.get_width() / 2.0,
            height + unc + 2,
            f"{wl:.2f}\n±{unc:.2f} nm",
            ha="center",
            va="bottom",
            fontsize=9,
            fontweight="bold",
        )

    if reference_wavelength:
        ref_nm = reference_wavelength * 1e9
        ax.axhline(
            y=ref_nm,
            color="#e74c3c",
            linestyle="--",
            linewidth=2,
            label=f"参考波长: {ref_nm:.2f} nm",
        )
        ax.fill_between(
            [-1, len(wavelength_results)],
            ref_nm * 0.95,
            ref_nm * 1.05,
            color="#e74c3c",
            alpha=0.1,
            label="±5% 容差范围",
        )

    if final_wavelength and final_uncertainty:
        final_nm = final_wavelength * 1e9
        final_unc_nm = final_uncertainty * 1e9
        ax.axhline(
            y=final_nm,
            color="#2ecc71",
            linestyle="-.",
            linewidth=2,
            label=f"最终结果: {final_nm:.2f} ± {final_unc_nm:.2f} nm",
        )

    ax.set_xticks(x_pos)
    ax.set_xticklabels([f"k={r.order}" for r in wavelength_results], fontsize=10)
    ax.set_xlabel("衍射级次", fontsize=12)
    ax.set_ylabel("波长 (nm)", fontsize=12)
    ax.set_title("各级次波长计算结果对比", fontsize=14, fontweight="bold", pad=20)
    ax.set_xlim(-0.6, len(wavelength_results) - 0.4)

    y_min = min(wavelengths_nm) - max(uncertainties_nm) * 2 - 10
    y_max = max(wavelengths_nm) + max(uncertainties_nm) * 2 + 10
    if reference_wavelength:
        y_min = min(y_min, ref_nm * 0.9)
        y_max = max(y_max, ref_nm * 1.1)
    ax.set_ylim(y_min, y_max)

    ax.grid(True, alpha=0.3, axis="y", linestyle="--")

    from matplotlib.patches import Patch
    legend_elements = [
        Patch(facecolor="#3498db", label="正常数据"),
        Patch(facecolor="#e74c3c", label="异常数据"),
    ]
    handles, labels = ax.get_legend_handles_labels()
    legend_elements.extend(handles)
    ax.legend(
        handles=legend_elements,
        loc="upper center",
        bbox_to_anchor=(0.5, -0.15),
        ncol=3,
        fontsize=9,
    )

    if final_wavelength and reference_wavelength:
        error_percent = abs(final_wavelength - reference_wavelength) / reference_wavelength * 100
        ax.text(
            0.02,
            0.98,
            f"相对误差: {error_percent:.2f}%",
            transform=ax.transAxes,
            va="top",
            fontsize=11,
            fontweight="bold",
            color="#27ae60" if error_percent < 5 else "#e74c3c",
            bbox=dict(boxstyle="round,pad=0.5", fc="white", ec="gray", alpha=0.8),
        )

    result_ids = [r.source_id[:8] for r in wavelength_results]
    ax.text(
        0.98,
        0.02,
        f"结果ID: {', '.join(result_ids)}",
        transform=ax.transAxes,
        ha="right",
        va="bottom",
        fontsize=7,
        style="italic",
        color="gray",
    )

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    plt.savefig(output_path)
    plt.close()

    trace = {
        "chart_type": "wavelength_comparison",
        "output_path": output_path,
        "result_count": len(wavelength_results),
        "reference_wavelength_nm": reference_wavelength * 1e9 if reference_wavelength else None,
        "final_wavelength_nm": final_wavelength * 1e9 if final_wavelength else None,
        "result_ids": [r.source_id for r in wavelength_results],
    }

    return output_path, trace


def plot_error_contribution(
    student_record: StudentRecord,
    wavelength_results: List[WavelengthResult],
    output_path: str,
) -> Tuple[str, Dict[str, Any]]:
    plt = setup_matplotlib()

    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(12, 5))

    if not wavelength_results or not student_record.grating_constant:
        return "", {"error": "数据不足"}

    contributions = []
    labels = []

    d = student_record.grating_constant.value
    delta_d = student_record.grating_constant.uncertainty
    rel_d = (delta_d / d * 100) ** 2 if d != 0 else 0

    for result in wavelength_results:
        fringe = next(
            (f for f in student_record.fringes if f.source_id == result.fringe_id),
            None,
        )
        if not fringe or student_record.screen_distance is None:
            continue

        import diffraction as diff
        import error_propagation as ep

        theta_rad, _ = diff.calculate_angle(fringe, student_record.screen_distance)
        delta_theta_rad, _ = ep.calculate_angle_uncertainty(
            fringe, student_record.screen_distance
        )

        sin_theta = math.sin(theta_rad)
        cos_theta = math.cos(theta_rad)

        rel_theta = 0
        if sin_theta != 0:
            rel_theta = (abs(cos_theta / sin_theta) * delta_theta_rad * 100) ** 2

        total = rel_d + rel_theta
        pct_d = rel_d / total * 100 if total > 0 else 0
        pct_theta = rel_theta / total * 100 if total > 0 else 0

        contributions.append([pct_d, pct_theta])
        labels.append(f"k={result.order}")

    if contributions:
        import numpy as np
        contributions_arr = np.array(contributions)

        x = np.arange(len(labels))
        width = 0.6

        ax1.bar(
            x,
            contributions_arr[:, 0],
            width,
            label="光栅常数 d",
            color="#3498db",
            edgecolor="white",
        )
        ax1.bar(
            x,
            contributions_arr[:, 1],
            width,
            bottom=contributions_arr[:, 0],
            label="衍射角 θ",
            color="#e74c3c",
            edgecolor="white",
        )

        ax1.set_xticks(x)
        ax1.set_xticklabels(labels)
        ax1.set_ylabel("误差贡献 (%)", fontsize=11)
        ax1.set_xlabel("衍射级次", fontsize=11)
        ax1.set_title("各测量量误差贡献分布", fontsize=13, fontweight="bold")
        ax1.legend(fontsize=9)
        ax1.grid(True, alpha=0.3, axis="y", linestyle="--")

        for i in range(len(contributions)):
            if contributions[i][0] > 5:
                ax1.text(
                    x[i],
                    contributions[i][0] / 2,
                    f"{contributions[i][0]:.0f}%",
                    ha="center",
                    va="center",
                    fontsize=9,
                    color="white",
                    fontweight="bold",
                )
            if contributions[i][1] > 5:
                ax1.text(
                    x[i],
                    contributions[i][0] + contributions[i][1] / 2,
                    f"{contributions[i][1]:.0f}%",
                    ha="center",
                    va="center",
                    fontsize=9,
                    color="white",
                    fontweight="bold",
                )

        avg_d = sum(c[0] for c in contributions) / len(contributions)
        avg_theta = sum(c[1] for c in contributions) / len(contributions)

        sizes = [avg_d, avg_theta]
        colors_pie = ["#3498db", "#e74c3c"]
        labels_pie = [f"光栅常数 d\n{avg_d:.1f}%", f"衍射角 θ\n{avg_theta:.1f}%"]

        wedges, texts, autotexts = ax2.pie(
            sizes,
            labels=labels_pie,
            colors=colors_pie,
            autopct="%1.1f%%",
            startangle=90,
            wedgeprops=dict(edgecolor="white", linewidth=2),
            textprops=dict(fontsize=11),
        )
        for autotext in autotexts:
            autotext.set_color("white")
            autotext.set_fontweight("bold")

        ax2.set_title("平均误差贡献", fontsize=13, fontweight="bold")

    plt.tight_layout()

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    plt.savefig(output_path)
    plt.close()

    trace = {
        "chart_type": "error_contribution",
        "output_path": output_path,
        "result_count": len(wavelength_results),
        "average_d_contribution": sum(c[0] for c in contributions) / len(contributions) if contributions else 0,
        "average_theta_contribution": sum(c[1] for c in contributions) / len(contributions) if contributions else 0,
    }

    return output_path, trace


def plot_grating_equation_diagram(
    output_path: str,
    grating_constant: float,
    wavelength: float,
    max_order: int = 3,
) -> Tuple[str, Dict[str, Any]]:
    plt = setup_matplotlib()

    fig, ax = plt.subplots(figsize=(10, 6))

    ax.axhline(y=0, color="gray", linewidth=1)
    ax.axvline(x=0, color="gray", linewidth=1)

    ax.axhline(y=0, xmin=0.4, xmax=0.6, color="#2c3e50", linewidth=4, label="光栅")

    theta_vals = []
    sin_theta_vals = []
    order_vals = []

    for k in range(1, max_order + 1):
        sin_theta = k * wavelength / grating_constant
        if abs(sin_theta) <= 1:
            theta = math.asin(sin_theta)
            theta_vals.append(theta)
            sin_theta_vals.append(sin_theta)
            order_vals.append(k)

            x_end = math.tan(theta)
            ax.plot(
                [0, x_end],
                [0, 1],
                color=f"C{k}",
                linewidth=2,
                label=f"k={k}, θ={math.degrees(theta):.1f}°",
            )
            ax.annotate(
                "",
                xy=(x_end, 1),
                xytext=(0, 0),
                arrowprops=dict(arrowstyle="->", color=f"C{k}", lw=1.5),
            )

    angles = [math.degrees(t) for t in theta_vals]
    for angle in angles:
        annotation = ax.annotate(
            f"{angle:.1f}°",
            xy=(0.15 * math.tan(math.radians(angle) / 2), 0.15),
            fontsize=9,
            ha="center",
        )

    x_curve = [i * 0.02 for i in range(50)]
    y_curve = [math.sin(math.radians(x)) for x in x_curve]
    ax2 = ax.twinx()
    ax2.plot(x_curve, y_curve, "k--", alpha=0.3, label="sin(θ) 曲线")
    ax2.set_ylabel("sin(θ)", fontsize=11)

    for k, st in zip(order_vals, sin_theta_vals):
        ax2.scatter(
            [math.degrees(math.asin(st))],
            [st],
            color=f"C{k}",
            s=80,
            zorder=5,
            edgecolor="white",
            linewidth=1.5,
        )

    ax.set_xlabel("衍射角 θ (°)", fontsize=12)
    ax.set_ylabel("传播方向", fontsize=12)
    ax.set_title(
        f"光栅方程 d·sin(θ) = k·λ\n(d={grating_constant*1e6:.2f} μm, λ={wavelength*1e9:.2f} nm)",
        fontsize=14,
        fontweight="bold",
        pad=20,
    )
    ax.set_xlim(-5, max(math.degrees(max(theta_vals)) * 1.2, 10) if theta_vals else 40)
    ax.set_ylim(-0.2, 1.2)

    lines1, labels1 = ax.get_legend_handles_labels()
    lines2, labels2 = ax2.get_legend_handles_labels()
    ax.legend(lines1 + lines2, labels1 + labels2, loc="upper right", fontsize=9)

    ax.grid(True, alpha=0.3, linestyle="--")

    ax.text(
        0.02,
        0.02,
        "衍射原理图: 平行光经光栅衍射后按波长分散\n各级极大满足 d·sin(θ) = k·λ",
        transform=ax.transAxes,
        fontsize=9,
        va="bottom",
        bbox=dict(boxstyle="round,pad=0.5", fc="yellow", alpha=0.1),
    )

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    plt.savefig(output_path)
    plt.close()

    trace = {
        "chart_type": "grating_equation_diagram",
        "output_path": output_path,
        "grating_constant": grating_constant,
        "wavelength": wavelength,
        "max_order": max_order,
        "visible_orders": order_vals,
    }

    return output_path, trace


def generate_all_charts(
    student_record: StudentRecord,
    wavelength_results: List[WavelengthResult],
    report: ExperimentReport,
    output_dir: str = "output/charts",
) -> Tuple[Dict[str, str], Dict[str, Any]]:
    chart_paths = {}
    traces = {}

    fringe_chart, trace = plot_fringe_positions(
        student_record,
        os.path.join(output_dir, "fringe_positions.png"),
        report.anomalies,
    )
    chart_paths["fringe_positions"] = fringe_chart
    traces["fringe_positions"] = trace

    wl_chart, trace = plot_wavelength_comparison(
        wavelength_results,
        os.path.join(output_dir, "wavelength_comparison.png"),
        student_record.reference_wavelength,
        report.final_wavelength,
        report.final_uncertainty,
        report.anomalies,
    )
    chart_paths["wavelength_comparison"] = wl_chart
    traces["wavelength_comparison"] = trace

    error_chart, trace = plot_error_contribution(
        student_record,
        wavelength_results,
        os.path.join(output_dir, "error_contribution.png"),
    )
    chart_paths["error_contribution"] = error_chart
    traces["error_contribution"] = trace

    if student_record.grating_constant and report.final_wavelength:
        diagram_chart, trace = plot_grating_equation_diagram(
            os.path.join(output_dir, "grating_diagram.png"),
            student_record.grating_constant.value,
            report.final_wavelength,
            max_order=3,
        )
        chart_paths["grating_diagram"] = diagram_chart
        traces["grating_diagram"] = trace

    return chart_paths, traces
