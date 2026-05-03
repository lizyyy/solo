import pandas as pd
from typing import Dict, List, Optional, Any
from datetime import datetime
import os


class Exporter:
    def __init__(self):
        self.export_dir = 'output'

    def export_risk_items_csv(self, risk_df: pd.DataFrame, 
                               file_path: Optional[str] = None,
                               include_details: bool = True) -> str:
        """
        导出风险项 CSV
        包含优先处置清单信息
        """
        if risk_df.empty:
            raise ValueError("没有数据可导出")

        if file_path is None:
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            os.makedirs(self.export_dir, exist_ok=True)
            file_path = os.path.join(self.export_dir, f'risk_items_{timestamp}.csv')

        export_df = risk_df.copy()

        if 'risk_tags' in export_df.columns:
            export_df['risk_tags'] = export_df['risk_tags'].apply(
                lambda x: ','.join(x) if isinstance(x, list) else x
            )

        output_columns = [
            'priority',
            'tree_id',
            'road_name',
            'tree_species',
            'overall_risk_score',
            'overall_risk_level_cn',
            'disposal_status_cn',
            'damage_type_cn',
            'risk_tags',
            'tree_age',
            'tree_age_category',
            'root_depth_category',
            'has_coordinates',
            'latitude',
            'longitude',
            'wind_risk_score',
            'max_wind_speed',
            'exposure_hours',
            'root_risk_score',
            'age_risk_score',
            'water_risk_score',
            'total_rainfall',
            'has_water_pool',
            'inspection_count',
            'latest_inspection_time',
            'typhoon_period'
        ]

        available_columns = [col for col in output_columns if col in export_df.columns]
        export_df = export_df[available_columns]

        export_df = export_df.sort_values(
            by=['priority', 'overall_risk_score'],
            ascending=[True, False]
        ).reset_index(drop=True)

        export_df.to_csv(file_path, index=False, encoding='utf-8-sig')

        return file_path

    def generate_markdown_report(self, risk_df: pd.DataFrame, 
                                  statistics: Dict,
                                  typhoon_info: Optional[Dict] = None,
                                  file_path: Optional[str] = None) -> str:
        """
        生成树木风险复盘 Markdown 报告
        """
        if file_path is None:
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            os.makedirs(self.export_dir, exist_ok=True)
            file_path = os.path.join(self.export_dir, f'tree_risk_review_{timestamp}.md')

        report = self._build_markdown_content(risk_df, statistics, typhoon_info)

        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(report)

        return file_path

    def _build_markdown_content(self, risk_df: pd.DataFrame, 
                                 statistics: Dict,
                                 typhoon_info: Optional[Dict] = None) -> str:
        """
        构建 Markdown 报告内容
        """
        lines = []

        lines.append('# 行道树台风倒伏风险复盘报告')
        lines.append('')
        lines.append(f'**生成时间**: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}')
        lines.append('')

        if typhoon_info:
            lines.append('## 台风过程信息')
            lines.append('')
            lines.append(f'- **台风时段**: {typhoon_info.get("label", "未知")}')
            lines.append(f'- **最大风速**: {typhoon_info.get("max_wind", "N/A")} m/s')
            lines.append(f'- **累计降雨**: {typhoon_info.get("total_rain", "N/A")} mm')
            lines.append(f'- **持续时长**: {typhoon_info.get("duration_hours", 0):.1f} 小时')
            if typhoon_info.get('cross_midnight'):
                lines.append('- **特殊情况**: 跨午夜台风过程')
            lines.append('')

        lines.append('## 总体统计')
        lines.append('')

        stats = statistics
        lines.append(f'**评估树木总数**: {stats.get("total_trees", 0)} 棵')
        lines.append('')
        lines.append(f'**风险分布**:')
        
        risk_dist = stats.get('risk_distribution_cn', {})
        for level, count in risk_dist.items():
            lines.append(f'- {level}: {count} 棵')
        lines.append('')

        lines.append(f'**处置状态分布**:')
        status_dist = stats.get('status_distribution_cn', {})
        for status, count in status_dist.items():
            lines.append(f'- {status}: {count} 棵')
        lines.append('')

        lines.append(f'**关键指标**:')
        lines.append(f'- 平均风险评分: {stats.get("avg_risk_score", 0)}')
        lines.append(f'- 最高风险评分: {stats.get("max_risk_score", 0)}')
        lines.append(f'- 高风险树木: {stats.get("high_risk_count", 0)} 棵')
        lines.append(f'- 待处置树木: {stats.get("pending_count", 0)} 棵')
        lines.append(f'- 受损树木: {stats.get("damaged_count", 0)} 棵')
        lines.append(f'  - 倒伏: {stats.get("fall_over_count", 0)} 棵')
        lines.append(f'  - 断枝: {stats.get("branch_break_count", 0)} 棵')
        lines.append('')

        if stats.get('without_coordinates', 0) > 0:
            lines.append(f'⚠️ **注意**: 有 {stats.get("without_coordinates", 0)} 棵树缺失经纬度信息')
        if stats.get('multiple_inspections', 0) > 0:
            lines.append(f'⚠️ **注意**: 有 {stats.get("multiple_inspections", 0)} 棵树被多次巡查')
        lines.append('')

        lines.append('## 优先处置清单')
        lines.append('')

        if not risk_df.empty:
            priority_df = risk_df.sort_values(
                by=['priority', 'overall_risk_score'],
                ascending=[True, False]
            )

            lines.append('### 高风险优先 (优先级 1)')
            lines.append('')
            
            high_priority = priority_df[priority_df['priority'] == 1]
            if not high_priority.empty:
                lines.append('| 优先级 | 树木ID | 路段 | 树种 | 风险评分 | 风险等级 | 处置状态 | 损坏类型 | 风险标签 |')
                lines.append('|--------|--------|------|------|----------|----------|----------|----------|----------|')
                for _, row in high_priority.head(20).iterrows():
                    tags = ','.join(row.get('risk_tags', [])) if isinstance(row.get('risk_tags'), list) else ''
                    lines.append(
                        f"| {row.get('priority', '-')} | "
                        f"{row.get('tree_id', '-')} | "
                        f"{row.get('road_name', '-')} | "
                        f"{row.get('tree_species', '-')} | "
                        f"{row.get('overall_risk_score', '-')} | "
                        f"{row.get('overall_risk_level_cn', '-')} | "
                        f"{row.get('disposal_status_cn', '-')} | "
                        f"{row.get('damage_type_cn', '-')} | "
                        f"{tags} |"
                    )
                if len(high_priority) > 20:
                    lines.append(f'... 还有 {len(high_priority) - 20} 棵高风险树未列出')
            else:
                lines.append('暂无高风险树木')
            lines.append('')

            lines.append('### 中风险 (优先级 2)')
            lines.append('')
            medium_priority = priority_df[priority_df['priority'] == 2]
            if not medium_priority.empty:
                lines.append(f'共 {len(medium_priority)} 棵中风险树木，建议跟进处理')
            else:
                lines.append('暂无中风险树木')
            lines.append('')

            lines.append('## 按路段统计')
            lines.append('')
            road_dist = stats.get('road_distribution', {})
            if road_dist:
                for road, count in road_dist.items():
                    road_trees = risk_df[risk_df['road_name'] == road]
                    if not road_trees.empty:
                        avg_score = road_trees['overall_risk_score'].mean()
                        high_risk = len(road_trees[road_trees['overall_risk_level'] == 'high'])
                        lines.append(f'**{road}**: {count} 棵树，平均评分 {avg_score:.1f}，高风险 {high_risk} 棵')
            lines.append('')

            lines.append('## 按树种统计')
            lines.append('')
            species_dist = stats.get('species_distribution', {})
            if species_dist:
                for species, count in species_dist.items():
                    species_trees = risk_df[risk_df['tree_species'] == species]
                    if not species_trees.empty:
                        avg_score = species_trees['overall_risk_score'].mean()
                        lines.append(f'**{species}**: {count} 棵树，平均评分 {avg_score:.1f}')
            lines.append('')

            lines.append('## 风险因子分析')
            lines.append('')
            lines.append('### 浅根树木风险')
            shallow_root = risk_df[risk_df.get('is_shallow_root', pd.Series([False]*len(risk_df)))]
            if not shallow_root.empty:
                lines.append(f'共 {len(shallow_root)} 棵浅根树木，这些树木在强风中更容易倒伏')
                for _, row in shallow_root.head(10).iterrows():
                    lines.append(f"- {row.get('tree_id', '-')} ({row.get('road_name', '-')}) - 风险评分: {row.get('overall_risk_score', '-')}")
                if len(shallow_root) > 10:
                    lines.append(f'... 还有 {len(shallow_root) - 10} 棵浅根树未列出')
            else:
                lines.append('未发现浅根树木')
            lines.append('')

            lines.append('### 高龄树木风险')
            old_trees = risk_df[risk_df.get('is_old_tree', pd.Series([False]*len(risk_df)))]
            if not old_trees.empty:
                lines.append(f'共 {len(old_trees)} 棵高龄树木 (树龄 > 30年)，这些树木抗风能力较弱')
                for _, row in old_trees.head(10).iterrows():
                    lines.append(f"- {row.get('tree_id', '-')} ({row.get('road_name', '-')}) - 树龄: {row.get('tree_age', '-')}年")
                if len(old_trees) > 10:
                    lines.append(f'... 还有 {len(old_trees) - 10} 棵高龄树未列出')
            else:
                lines.append('未发现高龄树木')
            lines.append('')

            lines.append('### 易积水区域树木')
            water_pool_trees = risk_df[risk_df.get('has_water_pool', pd.Series([False]*len(risk_df)))]
            if not water_pool_trees.empty:
                lines.append(f'共 {len(water_pool_trees)} 棵树木位于易积水区域，暴雨后根系易受影响')
                for _, row in water_pool_trees.head(10).iterrows():
                    lines.append(f"- {row.get('tree_id', '-')} ({row.get('road_name', '-')})")
                if len(water_pool_trees) > 10:
                    lines.append(f'... 还有 {len(water_pool_trees) - 10} 棵位于易积水区域的树木未列出')
            else:
                lines.append('未发现易积水区域树木')
            lines.append('')

            lines.append('## 处置建议')
            lines.append('')
            lines.append('1. **紧急处置**: 高风险且已倒伏/断枝的树木，需在24小时内处理')
            lines.append('2. **优先处理**: 高风险待处置树木，建议在3天内完成处置')
            lines.append('3. **持续监控**: 中风险树木，需密切关注天气变化')
            lines.append('4. **长期措施**:')
            lines.append('   - 对浅根树木进行加固或移植')
            lines.append('   - 对高龄树木进行健康检查和修剪')
            lines.append('   - 改善易积水区域的排水系统')
            lines.append('')

        else:
            lines.append('暂无风险数据')
            lines.append('')

        lines.append('---')
        lines.append('')
        lines.append('*此报告由行道树台风风险复盘系统自动生成*')

        return '\n'.join(lines)

    def export_all(self, risk_df: pd.DataFrame, 
                   statistics: Dict,
                   typhoon_info: Optional[Dict] = None,
                   base_name: Optional[str] = None) -> Dict:
        """
        导出所有格式 (CSV + Markdown)
        """
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        if base_name:
            csv_path = os.path.join(self.export_dir, f'{base_name}_{timestamp}.csv')
            md_path = os.path.join(self.export_dir, f'{base_name}_review_{timestamp}.md')
        else:
            csv_path = os.path.join(self.export_dir, f'risk_items_{timestamp}.csv')
            md_path = os.path.join(self.export_dir, f'tree_risk_review_{timestamp}.md')

        csv_file = self.export_risk_items_csv(risk_df, csv_path)
        md_file = self.generate_markdown_report(risk_df, statistics, typhoon_info, md_path)

        return {
            'csv_file': csv_file,
            'markdown_file': md_file,
            'export_time': timestamp,
            'record_count': len(risk_df)
        }
