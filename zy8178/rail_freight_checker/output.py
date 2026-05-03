"""输出模块 - 用于生成各种输出文件格式"""

import csv
import json
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Any

from .calculator import (
    CalculationResult, Vehicle, Cargo,
    Issue, IssueLevel
)
from .utils import format_weight, format_length


class OutputGenerator:
    """输出生成器类"""
    
    def __init__(self, output_dir: Path):
        """
        初始化输出生成器
        
        Args:
            output_dir: 输出目录路径
        """
        self.output_dir = output_dir
        self.timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    
    def generate_issues_csv(self, issues: List[Issue]) -> Path:
        """
        生成问题列表CSV文件
        
        Args:
            issues: 问题列表
            
        Returns:
            Path: 生成的文件路径
        """
        file_path = self.output_dir / "issues.csv"
        
        with open(file_path, 'w', encoding='utf-8', newline='') as f:
            writer = csv.writer(f)
            
            # 写入表头
            writer.writerow([
                '序号', '级别', '类别', '问题描述', '详细信息', '时间戳'
            ])
            
            # 写入数据
            for idx, issue in enumerate(issues, 1):
                level_str = issue.level.value.upper()
                details_str = json.dumps(issue.details, ensure_ascii=False) if issue.details else ''
                
                writer.writerow([
                    idx,
                    level_str,
                    issue.category,
                    issue.message,
                    details_str,
                    self.timestamp
                ])
        
        return file_path
    
    def generate_report_md(self, 
                            result: CalculationResult, 
                            vehicle: Vehicle, 
                            cargos: List[Cargo],
                            issues: List[Issue]) -> Path:
        """
        生成装载报告Markdown文件
        
        Args:
            result: 计算结果
            vehicle: 车辆信息
            cargos: 货物列表
            issues: 问题列表
            
        Returns:
            Path: 生成的文件路径
        """
        file_path = self.output_dir / "loading_report.md"
        
        # 统计问题
        error_count = sum(1 for issue in issues if issue.level == IssueLevel.ERROR)
        warning_count = sum(1 for issue in issues if issue.level == IssueLevel.WARNING)
        info_count = sum(1 for issue in issues if issue.level == IssueLevel.INFO)
        
        # 生成报告内容
        content = f"""# 铁路货运装载方案预检报告

> 生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

---

## 一、检查结果概览

| 项目 | 状态 | 数量 |
|------|------|------|
| 错误 | {'🔴 存在' if error_count > 0 else '🟢 无'} | {error_count} |
| 警告 | {'🟡 存在' if warning_count > 0 else '🟢 无'} | {warning_count} |
| 提示 | {'🔵 存在' if info_count > 0 else '🟢 无'} | {info_count} |

**总体评估: {'⚠️ 需要立即处理' if error_count > 0 else '⚠️ 需要关注' if warning_count > 0 else '✅ 检查通过'}**

---

## 二、车辆信息

| 参数 | 值 |
|------|-----|
| 车辆ID | {vehicle.id} |
| 车辆类型 | {vehicle.type} |
| 自重 | {format_weight(vehicle.tare_weight, 't')} |
| 最大载重 | {format_weight(vehicle.max_load_weight, 't')} |
| 车辆长度 | {format_length(vehicle.length, 'm')} |
| 车辆宽度 | {format_length(vehicle.width, 'm')} |
| 高度限制 | {format_length(vehicle.height_limit, 'm')} |
| 轴数 | {vehicle.axle_count} |
| 轴距 | {format_length(vehicle.wheelbase, 'm')} |

---

## 三、装载计算结果

### 3.1 重量计算

| 项目 | 值 | 备注 |
|------|-----|------|
| 货物总重量 | {format_weight(result.cargo_weight, 't')} | |
| 车辆自重 | {format_weight(vehicle.tare_weight, 't')} | |
| **总重量** | **{format_weight(result.total_weight, 't')}** | |
| 重量利用率 | {result.weight_utilization:.1f}% | 限重 {format_weight(vehicle.max_load_weight, 't')} |

### 3.2 重心偏移计算

| 项目 | 值 | 允许值 | 状态 |
|------|-----|--------|------|
| 纵向重心位置 | {format_length(result.longitudinal_center_of_gravity, 'm')} (从前端) | - | - |
| 纵向重心偏移 | {format_length(result.longitudinal_offset, 'mm')} | ±{format_length(result.longitudinal_offset, 'mm') if result.longitudinal_offset == 0 else '±100mm'} | {'✅ 正常' if abs(result.longitudinal_offset) <= 100 else '❌ 超标'} |
| 横向重心位置 | {format_length(result.lateral_center_of_gravity, 'mm')} (从中心线) | - | - |
| 横向重心偏移 | {format_length(result.lateral_offset, 'mm')} | ±50mm | {'✅ 正常' if abs(result.lateral_offset) <= 50 else '❌ 超标'} |

### 3.3 轴重估算

| 轴号 | 估算重量 |
|------|----------|
"""
        
        # 添加轴重估算表格
        for i, weight in enumerate(result.estimated_axle_weights, 1):
            content += f"| {i} | {format_weight(weight, 't')} |\n"
        
        content += f"""
### 3.4 限界检查

| 项目 | 实际值 | 限制值 | 状态 |
|------|--------|--------|------|
| 最大装载高度 | {format_length(result.max_height, 'm')} | {format_length(vehicle.height_limit, 'm')} | {'✅ 正常' if result.max_height <= vehicle.height_limit else '❌ 超标'} |
| 最大装载宽度 | {format_length(result.max_width * 2, 'm')} | {format_length(vehicle.width, 'm')} | {'✅ 正常' if result.max_width * 2 <= vehicle.width else '❌ 超标'} |

---

## 四、货物清单

| 序号 | 货物ID | 货物名称 | 重量 | 尺寸 (长×宽×高) | 位置 (X,Y,Z) | 危险品 |
|------|--------|----------|------|------------------|---------------|--------|
"""
        
        # 添加货物清单
        for i, cargo in enumerate(cargos, 1):
            weight_str = format_weight(cargo.weight, 'kg')
            dimensions = f"{format_length(cargo.length, 'mm')} × {format_length(cargo.width, 'mm')} × {format_length(cargo.height, 'mm')}"
            position = f"({format_length(cargo.x_position, 'mm')}, {format_length(cargo.y_position, 'mm')}, {format_length(cargo.z_position, 'mm')})"
            dangerous = "⚠️ 是" if cargo.is_dangerous else "否"
            
            content += f"| {i} | {cargo.id} | {cargo.name} | {weight_str} | {dimensions} | {position} | {dangerous} |\n"
        
        content += f"""
---

## 五、问题详情

"""
        
        # 按级别分组显示问题
        if issues:
            # 错误
            errors = [issue for issue in issues if issue.level == IssueLevel.ERROR]
            if errors:
                content += "### 5.1 错误 (需要立即处理)\n\n"
                for i, issue in enumerate(errors, 1):
                    content += f"**{i}. [{issue.category}] {issue.message}**\n\n"
                    if issue.details:
                        content += f"   详细信息: {json.dumps(issue.details, ensure_ascii=False, indent=2)}\n\n"
            
            # 警告
            warnings = [issue for issue in issues if issue.level == IssueLevel.WARNING]
            if warnings:
                content += "### 5.2 警告 (需要关注)\n\n"
                for i, issue in enumerate(warnings, 1):
                    content += f"**{i}. [{issue.category}] {issue.message}**\n\n"
                    if issue.details:
                        content += f"   详细信息: {json.dumps(issue.details, ensure_ascii=False, indent=2)}\n\n"
            
            # 提示
            infos = [issue for issue in issues if issue.level == IssueLevel.INFO]
            if infos:
                content += "### 5.3 提示信息\n\n"
                for i, issue in enumerate(infos, 1):
                    content += f"{i}. [{issue.category}] {issue.message}\n\n"
        else:
            content += "✅ 未发现任何问题。\n"
        
        content += f"""
---

## 六、建议

"""
        
        if error_count > 0:
            content += """⚠️ **存在严重问题，建议在封车前处理：**

1. 检查并修正所有标记为"错误"的问题
2. 重新进行预检确认问题已解决
3. 确认危险品隔离距离符合要求
4. 确认重量和尺寸在限制范围内

"""
        elif warning_count > 0:
            content += """⚠️ **存在警告问题，建议关注：**

1. 检查所有标记为"警告"的问题
2. 确认缺少尺寸信息的货物是否影响装载安全
3. 确认重量利用率是否在合理范围内

"""
        else:
            content += """✅ **预检通过，建议：**

1. 确认装载方案与实际装载一致
2. 按规定进行封车作业
3. 记录装载情况备查

"""
        
        content += f"""
---

*报告生成工具: 铁路货运预检系统 v0.1.0*
"""
        
        # 写入文件
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        
        return file_path
    
    def generate_preview_html(self, 
                               result: CalculationResult, 
                               vehicle: Vehicle, 
                               cargos: List[Cargo],
                               issues: List[Issue]) -> Path:
        """
        生成预览HTML文件
        
        Args:
            result: 计算结果
            vehicle: 车辆信息
            cargos: 货物列表
            issues: 问题列表
            
        Returns:
            Path: 生成的文件路径
        """
        file_path = self.output_dir / "preview.html"
        
        # 统计问题
        error_count = sum(1 for issue in issues if issue.level == IssueLevel.ERROR)
        warning_count = sum(1 for issue in issues if issue.level == IssueLevel.WARNING)
        
        # 确定状态颜色
        status_color = "#dc3545" if error_count > 0 else "#ffc107" if warning_count > 0 else "#28a745"
        status_text = "存在严重问题" if error_count > 0 else "存在警告问题" if warning_count > 0 else "检查通过"
        
        # 生成货物列表HTML
        cargo_rows = ""
        for i, cargo in enumerate(cargos, 1):
            dangerous_badge = '<span class="badge badge-danger">危险品</span>' if cargo.is_dangerous else ''
            cargo_rows += f"""
            <tr>
                <td>{i}</td>
                <td>{cargo.id}</td>
                <td>{cargo.name}</td>
                <td>{format_weight(cargo.weight, 'kg')}</td>
                <td>{format_length(cargo.length, 'mm')} × {format_length(cargo.width, 'mm')} × {format_length(cargo.height, 'mm')}</td>
                <td>({format_length(cargo.x_position, 'mm')}, {format_length(cargo.y_position, 'mm')}, {format_length(cargo.z_position, 'mm')})</td>
                <td>{dangerous_badge}</td>
            </tr>
"""
        
        # 生成问题列表HTML
        issues_html = ""
        if issues:
            for i, issue in enumerate(issues, 1):
                level_class = {
                    IssueLevel.ERROR: 'danger',
                    IssueLevel.WARNING: 'warning',
                    IssueLevel.INFO: 'info'
                }.get(issue.level, 'secondary')
                
                level_text = {
                    IssueLevel.ERROR: '错误',
                    IssueLevel.WARNING: '警告',
                    IssueLevel.INFO: '提示'
                }.get(issue.level, '未知')
                
                issues_html += f"""
                <div class="alert alert-{level_class}" role="alert">
                    <h5 class="alert-heading">[{level_text}] {issue.category}</h5>
                    <p>{issue.message}</p>
                    {f'<hr><small>详细信息: {json.dumps(issue.details, ensure_ascii=False)}</small>' if issue.details else ''}
                </div>
"""
        else:
            issues_html = '<div class="alert alert-success" role="alert">未发现任何问题</div>'
        
        # 完整HTML内容
        html_content = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>铁路货运装载方案预检报告</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css" rel="stylesheet">
    <style>
        body {{ padding-top: 20px; padding-bottom: 40px; }}
        .status-badge {{ font-size: 1.2rem; padding: 10px 20px; }}
        .card {{ margin-bottom: 20px; }}
        .card-header {{ font-weight: bold; }}
        .metric-value {{ font-size: 1.5rem; font-weight: bold; }}
        .metric-label {{ color: #6c757d; font-size: 0.9rem; }}
    </style>
</head>
<body>
    <div class="container">
        <!-- 头部 -->
        <div class="jumbotron">
            <h1 class="display-4">铁路货运装载方案预检报告</h1>
            <p class="lead">生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</p>
            <hr class="my-4">
            <div class="d-flex justify-content-between align-items-center">
                <div>
                    <span class="badge status-badge" style="background-color: {status_color}; color: white;">
                        {status_text}
                    </span>
                </div>
                <div class="d-flex gap-3">
                    <div class="text-center">
                        <div class="metric-value text-danger">{error_count}</div>
                        <div class="metric-label">错误</div>
                    </div>
                    <div class="text-center">
                        <div class="metric-value text-warning">{warning_count}</div>
                        <div class="metric-label">警告</div>
                    </div>
                </div>
            </div>
        </div>

        <!-- 关键指标 -->
        <div class="row">
            <div class="col-md-3">
                <div class="card">
                    <div class="card-body text-center">
                        <div class="metric-value">{result.weight_utilization:.1f}%</div>
                        <div class="metric-label">重量利用率</div>
                    </div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="card">
                    <div class="card-body text-center">
                        <div class="metric-value">{format_weight(result.cargo_weight, 't')}</div>
                        <div class="metric-label">货物总重</div>
                    </div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="card">
                    <div class="card-body text-center">
                        <div class="metric-value">{format_length(result.longitudinal_offset, 'mm')}</div>
                        <div class="metric-label">纵向偏移</div>
                    </div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="card">
                    <div class="card-body text-center">
                        <div class="metric-value">{format_length(result.lateral_offset, 'mm')}</div>
                        <div class="metric-label">横向偏移</div>
                    </div>
                </div>
            </div>
        </div>

        <!-- 问题详情 -->
        <div class="card">
            <div class="card-header bg-dark text-white">
                问题详情
            </div>
            <div class="card-body">
                {issues_html}
            </div>
        </div>

        <!-- 货物清单 -->
        <div class="card">
            <div class="card-header">
                货物清单
            </div>
            <div class="card-body">
                <div class="table-responsive">
                    <table class="table table-striped">
                        <thead>
                            <tr>
                                <th>序号</th>
                                <th>货物ID</th>
                                <th>名称</th>
                                <th>重量</th>
                                <th>尺寸</th>
                                <th>位置</th>
                                <th>状态</th>
                            </tr>
                        </thead>
                        <tbody>
                            {cargo_rows}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

        <!-- 页脚 -->
        <div class="text-center mt-4 text-muted">
            <p>铁路货运预检系统 v0.1.0</p>
        </div>
    </div>

    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/js/bootstrap.bundle.min.js"></script>
</body>
</html>
"""
        
        # 写入文件
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(html_content)
        
        return file_path
