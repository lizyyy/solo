"""可视化截图导出模块 - 带问题标注和处理建议"""
import os
from typing import Optional, List, Dict, Any
from datetime import datetime

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from matplotlib.patches import Circle, FancyArrowPatch
import numpy as np
import platform

if platform.system() == 'Darwin':
    plt.rcParams['font.sans-serif'] = ['Arial Unicode MS', 'PingFang SC', 'Heiti TC']
elif platform.system() == 'Windows':
    plt.rcParams['font.sans-serif'] = ['Microsoft YaHei', 'SimHei']
else:
    plt.rcParams['font.sans-serif'] = ['WenQuanYi Micro Hei', 'Noto Sans CJK SC']

plt.rcParams['axes.unicode_minus'] = False
import warnings
warnings.filterwarnings('ignore', category=UserWarning, message='Glyph.*missing')

from .models import LayoutProject, IssueRecord, RouteRecord, IssueStatus, Handler
from .workflow import get_issue_timeline


def _get_status_color(status: IssueStatus) -> str:
    """获取状态对应的颜色"""
    colors = {
        IssueStatus.DETECTED: '#ff6b6b',
        IssueStatus.PENDING_REVIEW: '#ffa94d',
        IssueStatus.MANUAL_FIXED: '#74c0fc',
        IssueStatus.RERUN: '#69db7c',
        IssueStatus.RESOLVED: '#51cf66'
    }
    return colors.get(status, '#868e96')


def _get_handler_color(handler: Handler) -> str:
    """获取处理人对应的颜色"""
    colors = {
        Handler.PARK_OPS_XT: '#339af0',
        Handler.EXHIBITION_CLIENT: '#f08c00',
        Handler.SYSTEM: '#868e96'
    }
    return colors.get(handler, '#868e96')


def export_layout_screenshot(
    project: LayoutProject,
    output_path: str,
    highlight_issues: bool = True,
    show_origin: bool = True
) -> str:
    """
    导出布局截图，标注问题和处理建议
    不是冷冰冰的系统日志，而是有人情味的说明
    """
    fig = plt.figure(figsize=(16, 10))
    gs = fig.add_gridspec(2, 2, height_ratios=[3, 2], width_ratios=[2, 1],
                          hspace=0.3, wspace=0.25)

    ax_map = fig.add_subplot(gs[0, 0])
    ax_legend = fig.add_subplot(gs[0, 1])
    ax_issues = fig.add_subplot(gs[1, :])

    ax_legend.axis('off')
    ax_issues.axis('off')

    _plot_layout_map(ax_map, project, highlight_issues, show_origin)
    _plot_legend_panel(ax_legend, project)
    _plot_issues_panel(ax_issues, project)

    fig.suptitle(
        f'实验室危化品柜布局分析报告 - {project.project_name}',
        fontsize=18, fontweight='bold', y=0.98
    )

    footer_text = f'导出时间: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")} | 项目版本: v{project.version}'
    fig.text(0.5, 0.02, footer_text, ha='center', fontsize=9, color='#666')

    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
    plt.savefig(output_path, dpi=150, bbox_inches='tight', facecolor='#f8f9fa')
    plt.close()

    return output_path


def _plot_layout_map(ax, project: LayoutProject, highlight_issues: bool, show_origin: bool):
    """绘制布局地图"""
    ax.set_facecolor('#ffffff')
    ax.grid(True, linestyle='--', alpha=0.3, color='#adb5bd')
    ax.set_xlabel('X 坐标 (米)', fontsize=11)
    ax.set_ylabel('Y 坐标 (米)', fontsize=11)
    ax.set_title('危化品柜与应急疏散路线布局图', fontsize=13, fontweight='bold', pad=10)

    all_x = []
    all_y = []

    for cabinet in project.safety_radii:
        x, y = cabinet.position
        all_x.append(x)
        all_y.append(y)

        color = '#fa5252' if cabinet.hazard_level == '高' else '#ff922b'
        alpha = 0.25 if cabinet.hazard_level == '高' else 0.15

        circle = Circle((x, y), cabinet.safety_radius, facecolor=color,
                        alpha=alpha, edgecolor=color, linewidth=1.5, linestyle='--')
        ax.add_patch(circle)

        ax.plot(x, y, 's', color='#c92a2a', markersize=10, zorder=5)
        ax.annotate(f'{cabinet.cabinet_id}\n{cabinet.chemical_type[:6]}',
                    (x, y), textcoords='offset points', xytext=(10, 10),
                    fontsize=8, fontweight='bold', color='#495057')

    for route in project.routes:
        points = [route.start_point] + route.via_points + [route.end_point]
        xs = [p[0] for p in points]
        ys = [p[1] for p in points]
        all_x.extend(xs)
        all_y.extend(ys)

        has_issue = any(issue.route_id == route.route_id for issue in project.issues
                        if issue.status != IssueStatus.RESOLVED)

        if has_issue and highlight_issues:
            line_color = '#fa5252'
            line_width = 3
            line_style = '-'
            marker = 'o'
        else:
            line_color = '#2b8a3e'
            line_width = 2
            line_style = '-'
            marker = '^'

        ax.plot(xs, ys, color=line_color, linewidth=line_width, linestyle=line_style,
                marker=marker, markersize=6, label=route.route_name, zorder=3)

        mid_idx = len(points) // 2
        mid_x, mid_y = points[mid_idx]
        status_text = f"{route.route_name}"
        if route.manual_input_length:
            status_text += f"\n录入: {route.manual_input_length}m"
        if route.calculated_length:
            status_text += f" | 计算: {route.calculated_length}m"
        if route.is_supplementary:
            status_text += " [补录]"

        bbox_color = '#fff3bf' if has_issue else '#d3f9d8'
        ax.annotate(status_text, (mid_x, mid_y),
                    textcoords='offset points', xytext=(-40, 15),
                    fontsize=8, bbox=dict(boxstyle='round,pad=0.3',
                                          facecolor=bbox_color, alpha=0.9))

        for i in range(len(points) - 1):
            arrow = FancyArrowPatch(points[i], points[i + 1],
                                    arrowstyle='->', color=line_color,
                                    linewidth=line_width, alpha=0.7, zorder=4)
            ax.add_patch(arrow)

    if show_origin and project.coordinate_origin:
        ox, oy = project.coordinate_origin.origin_point
        ax.plot(ox, oy, '*', color='#1864ab', markersize=15,
                markeredgecolor='white', markeredgewidth=2, zorder=10, label='坐标原点')
        ax.annotate(f'坐标原点 v{project.coordinate_origin.version}\n({ox}, {oy})',
                    (ox, oy), textcoords='offset points', xytext=(15, -20),
                    fontsize=9, fontweight='bold', color='#1864ab',
                    bbox=dict(boxstyle='round,pad=0.3', facecolor='#dbe4ff', alpha=0.9))
        all_x.append(ox)
        all_y.append(oy)

    if highlight_issues:
        for issue in project.issues:
            if issue.status == IssueStatus.RESOLVED:
                continue
            route = next((r for r in project.routes if r.route_id == issue.route_id), None)
            if route:
                mid_x = (route.start_point[0] + route.end_point[0]) / 2
                mid_y = (route.start_point[1] + route.end_point[1]) / 2

                bbox_props = dict(boxstyle='round,pad=0.5',
                                  facecolor=_get_status_color(issue.status),
                                  alpha=0.9, edgecolor='white', linewidth=1)

                ax.annotate(f'⚠ {issue.issue_id}\n{issue.issue_type}',
                            (mid_x, mid_y),
                            textcoords='offset points', xytext=(-30, 35),
                            fontsize=9, fontweight='bold', color='white',
                            bbox=bbox_props, zorder=6)

    if all_x and all_y:
        margin = 3
        ax.set_xlim(min(all_x) - margin, max(all_x) + margin)
        ax.set_ylim(min(all_y) - margin, max(all_y) + margin)
    else:
        ax.set_xlim(0, 30)
        ax.set_ylim(0, 20)


def _plot_legend_panel(ax, project: LayoutProject):
    """绘制图例和状态说明面板"""
    ax.set_facecolor('#f8f9fa')
    y_pos = 0.95
    line_height = 0.08

    ax.text(0.05, y_pos, '📊 项目概览', fontsize=12, fontweight='bold',
            transform=ax.transAxes, color='#343a40')
    y_pos -= line_height

    overview_items = [
        f'• 危化品柜: {len(project.safety_radii)} 个',
        f'• 路线: {len(project.routes)} 条',
        f'• 问题: {len(project.issues)} 个',
        f'• 未解决: {sum(1 for i in project.issues if i.status != IssueStatus.RESOLVED)} 个'
    ]

    for item in overview_items:
        ax.text(0.08, y_pos, item, fontsize=10, transform=ax.transAxes, color='#495057')
        y_pos -= line_height * 0.8

    y_pos -= line_height * 0.5
    ax.text(0.05, y_pos, '🎯 问题状态说明', fontsize=11, fontweight='bold',
            transform=ax.transAxes, color='#343a40')
    y_pos -= line_height

    status_legends = [
        (IssueStatus.DETECTED, '已检测'),
        (IssueStatus.PENDING_REVIEW, '待客户复核'),
        (IssueStatus.MANUAL_FIXED, '已人工修正'),
        (IssueStatus.RERUN, '已重跑'),
        (IssueStatus.RESOLVED, '已解决')
    ]

    for status, label in status_legends:
        color = _get_status_color(status)
        rect = mpatches.Rectangle((0.05, y_pos - 0.015), 0.06, 0.04,
                                  facecolor=color, edgecolor='white',
                                  transform=ax.transAxes)
        ax.add_patch(rect)
        ax.text(0.13, y_pos, f'{label}', fontsize=9,
                transform=ax.transAxes, color='#495057')
        y_pos -= line_height * 0.8

    y_pos -= line_height * 0.5
    ax.text(0.05, y_pos, '👤 处理角色', fontsize=11, fontweight='bold',
            transform=ax.transAxes, color='#343a40')
    y_pos -= line_height

    handlers = [
        (Handler.PARK_OPS_XT, '园区运维小陶'),
        (Handler.EXHIBITION_CLIENT, '展陈客户'),
        (Handler.SYSTEM, '系统')
    ]

    for handler, label in handlers:
        color = _get_handler_color(handler)
        rect = mpatches.Rectangle((0.05, y_pos - 0.015), 0.06, 0.04,
                                  facecolor=color, edgecolor='white',
                                  transform=ax.transAxes)
        ax.add_patch(rect)
        ax.text(0.13, y_pos, label, fontsize=9,
                transform=ax.transAxes, color='#495057')
        y_pos -= line_height * 0.8


def _plot_issues_panel(ax, project: LayoutProject):
    """绘制问题详情面板 - 说明为什么被留下、缺什么、下一步找谁、已补齐什么"""
    ax.set_facecolor('#fff9db')

    if not project.issues:
        ax.text(0.5, 0.5, '✅ 当前无问题，所有数据正常',
                ha='center', va='center', fontsize=14, fontweight='bold',
                transform=ax.transAxes, color='#2b8a3e')
        return

    unresolved = [i for i in project.issues if i.status != IssueStatus.RESOLVED]
    resolved = [i for i in project.issues if i.status == IssueStatus.RESOLVED]

    title = f'🔍 问题分析 ({len(unresolved)} 待处理 / {len(resolved)} 已解决)'
    ax.text(0.02, 0.95, title, fontsize=13, fontweight='bold',
            transform=ax.transAxes, color='#343a40')

    all_issues = unresolved + resolved
    num_issues = min(len(all_issues), 3)

    if num_issues == 0:
        return

    col_width = 1.0 / num_issues

    for idx, issue in enumerate(all_issues[:3]):
        x_left = idx * col_width + 0.02
        col_bg = '#fff5f5' if issue.status != IssueStatus.RESOLVED else '#f3fff3'

        rect = mpatches.Rectangle(
            (idx * col_width, 0.02), col_width - 0.01, 0.88,
            facecolor=col_bg, edgecolor=_get_status_color(issue.status),
            linewidth=2, transform=ax.transAxes
        )
        ax.add_patch(rect)

        y = 0.85

        status_badge = mpatches.Rectangle(
            (x_left, y - 0.02), 0.15, 0.05,
            facecolor=_get_status_color(issue.status), edgecolor='white',
            transform=ax.transAxes
        )
        ax.add_patch(status_badge)
        ax.text(x_left + 0.02, y + 0.005, issue.status.value,
                fontsize=8, fontweight='bold', color='white',
                transform=ax.transAxes)

        y -= 0.08
        ax.text(x_left, y, f'[{issue.issue_id}] {issue.issue_type.value}',
                fontsize=10, fontweight='bold', color='#c92a2a',
                transform=ax.transAxes)

        y -= 0.05
        ax.text(x_left, y, f'路线: {issue.route_id}',
                fontsize=9, color='#495057', transform=ax.transAxes)

        y -= 0.06
        ax.text(x_left, y, '📝 为什么被留下:',
                fontsize=9, fontweight='bold', color='#e67700',
                transform=ax.transAxes)
        y -= 0.05
        ax.text(x_left, y, f'   {issue.why_kept()}',
                fontsize=8, color='#495057', transform=ax.transAxes,
                wrap=True)

        y -= 0.07
        ax.text(x_left, y, '📋 还缺什么材料:',
                fontsize=9, fontweight='bold', color='#d9480f',
                transform=ax.transAxes)
        y -= 0.05
        ax.text(x_left, y, f'   {issue.missing_info()}',
                fontsize=8, color='#495057', transform=ax.transAxes,
                wrap=True)

        y -= 0.07
        ax.text(x_left, y, '📦 已补齐:',
                fontsize=9, fontweight='bold', color='#2f9e44',
                transform=ax.transAxes)
        y -= 0.05
        filled_txt = issue.filled_info()
        if len(filled_txt) > 50:
            filled_txt = filled_txt[:48] + '…'
        ax.text(x_left, y, f'   {filled_txt}',
                fontsize=8, color='#495057', transform=ax.transAxes,
                wrap=True)

        y -= 0.07
        ax.text(x_left, y, '👉 下一步:',
                fontsize=9, fontweight='bold', color='#1864ab',
                transform=ax.transAxes)
        y -= 0.05
        ax.text(x_left, y, f'   {issue.next_step()}',
                fontsize=8, color='#495057', transform=ax.transAxes,
                wrap=True)

        y -= 0.07
        handler_color = _get_handler_color(issue.current_handler)
        handler_badge = mpatches.Rectangle(
            (x_left, y - 0.015), 0.2, 0.045,
            facecolor=handler_color, edgecolor='white',
            transform=ax.transAxes
        )
        ax.add_patch(handler_badge)
        ax.text(x_left + 0.01, y + 0.002, f'当前处理: {issue.current_handler.value}',
                fontsize=8, fontweight='bold', color='white',
                transform=ax.transAxes)


def export_issue_detail_screenshot(
    project: LayoutProject,
    issue_id: str,
    output_path: str
) -> Optional[str]:
    """导出单个问题的详细截图"""
    issue = next((i for i in project.issues if i.issue_id == issue_id), None)
    if not issue:
        return None

    route = next((r for r in project.routes if r.route_id == issue.route_id), None)

    fig = plt.figure(figsize=(14, 8))
    gs = fig.add_gridspec(1, 2, width_ratios=[1, 1], wspace=0.2)

    ax_route = fig.add_subplot(gs[0, 0])
    ax_detail = fig.add_subplot(gs[0, 1])
    ax_detail.axis('off')

    _plot_single_route(ax_route, project, route, issue)
    _plot_issue_detail(ax_detail, project, issue, route)

    fig.suptitle(
        f'问题详情 - {issue.issue_type.value}',
        fontsize=16, fontweight='bold', y=0.98
    )

    footer_text = f'导出时间: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}'
    fig.text(0.5, 0.03, footer_text, ha='center', fontsize=9, color='#666')

    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
    plt.savefig(output_path, dpi=150, bbox_inches='tight', facecolor='#f8f9fa')
    plt.close()

    return output_path


def _plot_single_route(ax, project: LayoutProject, route: Optional[RouteRecord], issue: IssueRecord):
    """绘制单条路线"""
    ax.set_facecolor('#ffffff')
    ax.grid(True, linestyle='--', alpha=0.3, color='#adb5bd')
    ax.set_title(f'路线 {route.route_name if route else "未知"} 位置示意',
                 fontsize=12, fontweight='bold')
    ax.set_xlabel('X 坐标 (米)')
    ax.set_ylabel('Y 坐标 (米)')

    if project.coordinate_origin:
        ox, oy = project.coordinate_origin.origin_point
        ax.plot(ox, oy, '*', color='#1864ab', markersize=15,
                markeredgecolor='white', markeredgewidth=2, zorder=10)

    for cabinet in project.safety_radii:
        x, y = cabinet.position
        circle = Circle((x, y), cabinet.safety_radius,
                        facecolor='#ff922b', alpha=0.15, edgecolor='#ff922b', linestyle='--')
        ax.add_patch(circle)
        ax.plot(x, y, 's', color='#c92a2a', markersize=8)

    if route:
        points = [route.start_point] + route.via_points + [route.end_point]
        xs = [p[0] for p in points]
        ys = [p[1] for p in points]

        ax.plot(xs, ys, color='#fa5252', linewidth=4, marker='o', markersize=8, zorder=5)

        for i, (x, y) in enumerate(points):
            label = f'起点' if i == 0 else (f'终点' if i == len(points) - 1 else f'途经{i}')
            ax.annotate(f'{label}\n({x}, {y})', (x, y),
                        textcoords='offset points', xytext=(10, 10), fontsize=8)

        all_x = xs + [ox] if project.coordinate_origin else xs
        all_y = ys + [oy] if project.coordinate_origin else ys
        margin = 3
        ax.set_xlim(min(all_x) - margin, max(all_x) + margin)
        ax.set_ylim(min(all_y) - margin, max(all_y) + margin)


def _plot_issue_detail(ax, project: LayoutProject, issue: IssueRecord, route: Optional[RouteRecord]):
    """绘制问题详细信息"""
    ax.set_facecolor('#fff9db')

    y_pos = 0.95
    line_h = 0.06

    status_color = _get_status_color(issue.status)
    rect = mpatches.Rectangle((0.05, y_pos - 0.03), 0.3, 0.07,
                              facecolor=status_color, edgecolor='white')
    ax.add_patch(rect)
    ax.text(0.07, y_pos - 0.015, f'{issue.issue_id} | {issue.status.value}',
            fontsize=11, fontweight='bold', color='white', transform=ax.transAxes)

    y_pos -= 0.1
    ax.text(0.05, y_pos, issue.issue_type.value, fontsize=13,
            fontweight='bold', color='#c92a2a', transform=ax.transAxes)

    y_pos -= 0.07
    ax.text(0.05, y_pos, issue.description, fontsize=10,
            color='#495057', transform=ax.transAxes, wrap=True)

    if route:
        y_pos -= 0.1
        ax.text(0.05, y_pos, '📐 路线数据:', fontsize=11,
                fontweight='bold', color='#1864ab', transform=ax.transAxes)
        y_pos -= 0.06

        data_rows = [
            f'• 是否补录: {"是" if route.is_supplementary else "否"}',
            f'• 人工录入长度: {route.manual_input_length}米' if route.manual_input_length else '• 人工录入长度: 无',
            f'• 系统计算长度: {route.calculated_length}米' if route.calculated_length else '• 系统计算长度: 未计算',
        ]
        if route.manual_input_length and route.calculated_length:
            diff = abs(route.calculated_length - route.manual_input_length)
            data_rows.append(f'• 差值: {round(diff, 2)}米 {"(超过容差)" if diff > 0.5 else "(在容差内)"}')

        for row in data_rows:
            ax.text(0.08, y_pos, row, fontsize=9, color='#495057', transform=ax.transAxes)
            y_pos -= 0.05

    y_pos -= 0.05
    ax.text(0.05, y_pos, '❓ 为什么被留下:', fontsize=11,
            fontweight='bold', color='#e67700', transform=ax.transAxes)
    y_pos -= 0.05
    ax.text(0.08, y_pos, issue.why_kept(), fontsize=9,
            color='#495057', transform=ax.transAxes, wrap=True)

    y_pos -= 0.05
    ax.text(0.05, y_pos, '📋 还缺什么材料:', fontsize=11,
            fontweight='bold', color='#d9480f', transform=ax.transAxes)
    y_pos -= 0.05
    ax.text(0.08, y_pos, issue.missing_info(), fontsize=9,
            color='#495057', transform=ax.transAxes, wrap=True)

    y_pos -= 0.08
    ax.text(0.05, y_pos, '📦 已补齐材料:', fontsize=11,
            fontweight='bold', color='#2f9e44', transform=ax.transAxes)
    y_pos -= 0.05
    filled_display = issue.filled_info()
    if len(filled_display) > 70:
        filled_display = filled_display[:68] + '…'
    ax.text(0.08, y_pos, filled_display, fontsize=9,
            color='#495057', transform=ax.transAxes, wrap=True)

    y_pos -= 0.08
    ax.text(0.05, y_pos, '👉 下一步找谁:', fontsize=11,
            fontweight='bold', color='#1864ab', transform=ax.transAxes)
    y_pos -= 0.05
    ax.text(0.08, y_pos, issue.next_step(), fontsize=9,
            color='#495057', transform=ax.transAxes, wrap=True)

    handler_color = _get_handler_color(issue.current_handler)
    y_pos -= 0.08
    rect = mpatches.Rectangle((0.05, y_pos - 0.01), 0.4, 0.05,
                              facecolor=handler_color, edgecolor='white')
    ax.add_patch(rect)
    ax.text(0.07, y_pos + 0.005, f'当前处理人: {issue.current_handler.value}',
            fontsize=10, fontweight='bold', color='white', transform=ax.transAxes)

    timeline = get_issue_timeline(issue)
    if len(timeline) > 1:
        y_pos -= 0.1
        ax.text(0.05, y_pos, '⏱️ 处理时间线:', fontsize=11,
                fontweight='bold', color='#343a40', transform=ax.transAxes)
        y_pos -= 0.06
        for event in timeline:
            ax.text(0.08, y_pos, f'• {event["time"]} - {event["actor"]} - {event["action"]}',
                    fontsize=8, color='#666', transform=ax.transAxes)
            y_pos -= 0.045
