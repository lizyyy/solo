from datetime import datetime

def export_markdown(project, project_data, results, reviews):
    md = []
    
    md.append(f"# {project['name']} - 沙盘铁路排查单")
    md.append(f"**生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    md.append(f"**项目创建时间**: {project['created_at']}")
    md.append(f"**项目更新时间**: {project['updated_at']}")
    md.append("")
    
    md.append("## 项目概览")
    md.append(f"- **区段总数**: {results['summary']['total_sections']}")
    md.append(f"- **馈电点总数**: {results['summary']['total_feed_points']}")
    md.append(f"- **列车编组数**: {results['summary']['total_consists']}")
    md.append(f"- **电源数量**: {results['summary']['total_power_supplies']}")
    md.append("")
    
    md.append("## 风险汇总")
    md.append(f"- **电压衰减问题**: {results['summary']['voltage_issues']} 个区段")
    md.append(f"- **电源过载问题**: {results['summary']['overload_issues']} 台电源")
    md.append(f"- **调度冲突问题**: {results['summary']['conflict_issues']} 个冲突")
    md.append("")
    
    if results['summary']['voltage_issues'] > 0:
        md.append("## 电压衰减问题")
        md.append("| 区段ID | 区段名称 | 列车编组 | 距离(m) | 电压比 | 状态 |")
        md.append("|--------|----------|----------|---------|--------|------|")
        
        for section in results['voltage_drops']:
            if section['is_over_threshold']:
                for calc in section['calculations']:
                    if calc['is_over_threshold']:
                        status = "⚠️ 超出阈值"
                        md.append(f"| {section['section_id']} | {section['section_name']} | {calc['consist_name']} | {calc['distance']} | {calc['voltage_ratio']:.1%} | {status} |")
        md.append("")
    
    if results['summary']['overload_issues'] > 0:
        md.append("## 电源过载问题")
        md.append("| 电源ID | 电源名称 | 额定功率(W) | 需求功率(W) | 功率比 | 状态 |")
        md.append("|--------|----------|-------------|-------------|--------|------|")
        
        for ps in results['power_overloads']:
            if ps['is_overloaded']:
                status = "⚠️ 过载"
                md.append(f"| {ps['power_supply_id']} | {ps['power_supply_name']} | {ps['rated_power']} | {ps['total_power_needed']} | {ps['power_ratio']:.1%} | {status} |")
        md.append("")
    
    if results['summary']['conflict_issues'] > 0:
        md.append("## 调度冲突问题")
        md.append("| 路线1 | 路线2 | 公共区段 | 冲突开始 | 冲突结束 | 冲突类型 |")
        md.append("|-------|-------|----------|----------|----------|----------|")
        
        for conflict in results['schedule_conflicts']:
            common_sections = ', '.join(conflict['common_sections'])
            md.append(f"| {conflict['route1_name']} | {conflict['route2_name']} | {common_sections} | {conflict['time_overlap_start']} | {conflict['time_overlap_end']} | {conflict['conflict_type']} |")
        md.append("")
    
    md.append("## 详细数据")
    
    md.append("### 钢轨分段")
    md.append("| ID | 名称 | 长度(m) | 馈电点ID | 描述 |")
    md.append("|----|------|---------|----------|------|")
    for section in project_data.get('sections', []):
        md.append(f"| {section.get('id', '')} | {section.get('name', '')} | {section.get('length', 0)} | {section.get('feed_point_id', '')} | {section.get('description', '')} |")
    md.append("")
    
    md.append("### 馈电点")
    md.append("| ID | 名称 | 电源ID | 位置 | 描述 |")
    md.append("|----|------|--------|------|------|")
    for fp in project_data.get('feed_points', []):
        md.append(f"| {fp.get('id', '')} | {fp.get('name', '')} | {fp.get('power_supply_id', '')} | {fp.get('location', '')} | {fp.get('description', '')} |")
    md.append("")
    
    md.append("### 列车编组")
    md.append("| ID | 名称 | 功率(W) | 描述 |")
    md.append("|----|------|---------|------|")
    for consist in project_data.get('consists', []):
        md.append(f"| {consist.get('id', '')} | {consist.get('name', '')} | {consist.get('power', 0)} | {consist.get('description', '')} |")
    md.append("")
    
    md.append("### 电源")
    md.append("| ID | 名称 | 额定功率(W) | 电压(V) | 描述 |")
    md.append("|----|------|-------------|---------|------|")
    for ps in project_data.get('power_supplies', []):
        md.append(f"| {ps.get('id', '')} | {ps.get('name', '')} | {ps.get('max_power', 0)} | {ps.get('voltage', 12)} | {ps.get('description', '')} |")
    md.append("")
    
    if project_data.get('routes', []):
        md.append("### 运行路线")
        md.append("| ID | 名称 | 区段 | 开始时间 | 结束时间 | 描述 |")
        md.append("|----|------|------|----------|----------|------|")
        for route in project_data.get('routes', []):
            sections = ', '.join(route.get('sections', []))
            md.append(f"| {route.get('id', '')} | {route.get('name', '')} | {sections} | {route.get('start_time', 0)} | {route.get('end_time', 0)} | {route.get('description', '')} |")
        md.append("")
    
    if reviews:
        md.append("## 复核记录")
        for i, review in enumerate(reviews, 1):
            md.append(f"### 复核记录 #{i}")
            md.append(f"- **时间**: {review['created_at']}")
            md.append(f"- **备注**: {review.get('notes', '无')}")
            if review.get('adjusted_sections'):
                md.append(f"- **已调整区段**: {', '.join(review['adjusted_sections'])}")
            md.append("")
    
    return '\n'.join(md)

def export_json_audit(project, project_data, results, reviews):
    return {
        'project_info': {
            'id': project['id'],
            'name': project['name'],
            'created_at': project['created_at'],
            'updated_at': project['updated_at']
        },
        'export_time': datetime.now().isoformat(),
        'project_data': project_data,
        'calculation_results': results,
        'review_records': reviews
    }
