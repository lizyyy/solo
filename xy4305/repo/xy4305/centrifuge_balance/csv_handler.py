"""CSV文件处理模块"""

import csv
import os
from typing import List, Dict, Optional, Tuple
from io import StringIO

from .models import Sample, TubeType, Rotor, BalanceResult, HoleResult, AdjustmentSuggestion


class CSVHandler:
    """CSV文件处理器"""
    
    REQUIRED_COLUMNS = ["hole_position", "tube_type_id", "sample_volume_ml"]
    OPTIONAL_COLUMNS = ["sample_density_gml", "label"]
    
    def import_samples(self, file_path: str) -> Tuple[List[Sample], List[str]]:
        """
        导入配样CSV文件
        
        Returns:
            Tuple[List[Sample], List[str]]: (样品列表, 错误信息列表)
        """
        samples = []
        errors = []
        
        if not os.path.exists(file_path):
            errors.append(f"文件不存在: {file_path}")
            return samples, errors
        
        try:
            with open(file_path, 'r', encoding='utf-8-sig') as f:
                reader = csv.DictReader(f)
                
                headers = [h.strip() for h in reader.fieldnames] if reader.fieldnames else []
                
                missing_columns = []
                for col in self.REQUIRED_COLUMNS:
                    if col not in headers:
                        missing_columns.append(col)
                
                if missing_columns:
                    errors.append(f"缺少必要列: {', '.join(missing_columns)}")
                    return samples, errors
                
                for row_num, row in enumerate(reader, start=2):
                    try:
                        sample = self._parse_sample_row(row, row_num)
                        if sample:
                            samples.append(sample)
                    except ValueError as e:
                        errors.append(f"第{row_num}行: {str(e)}")
        
        except csv.Error as e:
            errors.append(f"CSV解析错误: {str(e)}")
        except UnicodeDecodeError:
            errors.append("文件编码错误，请确保使用UTF-8编码")
        except Exception as e:
            errors.append(f"读取文件时出错: {str(e)}")
        
        return samples, errors
    
    def _parse_sample_row(self, row: Dict[str, str], row_num: int) -> Optional[Sample]:
        """解析单行CSV数据"""
        try:
            hole_position = int(row.get("hole_position", "").strip())
        except (ValueError, TypeError):
            raise ValueError(f"孔位必须是整数")
        
        tube_type_id = row.get("tube_type_id", "").strip()
        if not tube_type_id:
            raise ValueError(f"管型ID不能为空")
        
        try:
            sample_volume_ml = float(row.get("sample_volume_ml", "").strip())
        except (ValueError, TypeError):
            raise ValueError(f"样品体积必须是数字")
        
        sample_density_str = row.get("sample_density_gml", "").strip()
        if sample_density_str:
            try:
                sample_density_gml = float(sample_density_str)
            except (ValueError, TypeError):
                raise ValueError(f"样品密度必须是数字")
        else:
            sample_density_gml = 1.0
        
        label = row.get("label", "").strip()
        
        return Sample(
            hole_position=hole_position,
            tube_type_id=tube_type_id,
            sample_volume_ml=sample_volume_ml,
            sample_density_gml=sample_density_gml,
            label=label
        )
    
    def export_balance_solution(
        self,
        result: BalanceResult,
        rotor: Rotor,
        tube_types: Dict[str, TubeType],
        file_path: str
    ) -> List[str]:
        """
        导出配平方案为CSV文件"""
        errors = []
        
        try:
            with open(file_path, 'w', encoding='utf-8', newline='') as f:
                writer = csv.writer(f)
                
                writer.writerow(["配平方案报告"])
                writer.writerow(["生成时间", result.timestamp.strftime("%Y-%m-%d %H:%M:%S")])
                writer.writerow(["转子ID", result.rotor_id])
                writer.writerow(["转子名称", rotor.name])
                writer.writerow(["孔位数", rotor.hole_count])
                writer.writerow(["半径(cm)", rotor.radius_cm])
                writer.writerow(["最大转速(RPM)", rotor.max_rpm])
                writer.writerow(["本次转速(RPM)", result.run_rpm])
                writer.writerow([])
                
                writer.writerow(["配平状态", "已配平" if result.is_balanced else "未配平"])
                writer.writerow(["最大质量不平衡(g)", f"{result.max_mass_imbalance_g:.4f}"])
                writer.writerow(["最大力矩不平衡(g·cm)", f"{result.max_moment_imbalance_gcm:.4f}"])
                writer.writerow([])
                
                writer.writerow(["孔位详细信息"])
                writer.writerow([
                    "孔位", "管型ID", "管型名称", "样品体积(ml)",
                    "样品密度(g/ml)", "总质量(g)", "质量矩(g·cm)", "标签"
                ])
                
                for hr in result.hole_results:
                    tube_type = tube_types.get(hr.tube_type_id)
                    tube_name = tube_type.name if tube_type else hr.tube_type_id
                    writer.writerow([
                        hr.hole_position,
                        hr.tube_type_id,
                        tube_name,
                        f"{hr.sample_volume_ml:.2f}",
                        f"{hr.sample_density_gml:.3f}",
                        f"{hr.total_mass_g:.4f}",
                        f"{hr.mass_moment_gcm:.4f}",
                        hr.label
                    ])
                
                writer.writerow([])
                
                if result.imbalance_infos:
                    writer.writerow(["对称孔位不平衡信息"])
                    writer.writerow([
                        "孔位对", "孔位1质量(g)", "孔位2质量(g)",
                        "质量差(g)", "较重孔位", "孔位1力矩(g·cm)",
                        "孔位2力矩(g·cm)", "力矩差(g·cm)"
                    ])
                    
                    for ii in result.imbalance_infos:
                        writer.writerow([
                            f"({ii.hole1_position}, {ii.hole2_position})",
                            f"{ii.hole1_mass_g:.4f}",
                            f"{ii.hole2_mass_g:.4f}",
                            f"{ii.mass_difference_g:.4f}",
                            ii.mass_direction,
                            f"{ii.hole1_moment_gcm:.4f}",
                            f"{ii.hole2_moment_gcm:.4f}",
                            f"{ii.moment_difference_gcm:.4f}"
                        ])
                    
                    writer.writerow([])
                
                if result.adjustment_suggestions:
                    writer.writerow(["调整建议"])
                    writer.writerow(["优先级", "类型", "建议内容", "涉及孔位"])
                    
                    for suggestion in result.adjustment_suggestions:
                        holes = []
                        if suggestion.hole_position:
                            holes.append(str(suggestion.hole_position))
                        if suggestion.target_hole:
                            holes.append(str(suggestion.target_hole))
                        
                        writer.writerow([
                            suggestion.priority,
                            suggestion.suggestion_type,
                            suggestion.description,
                            ", ".join(holes) if holes else ""
                        ])
                
                if result.validation_errors:
                    writer.writerow([])
                    writer.writerow(["校验错误"])
                    writer.writerow(["错误类型", "错误信息"])
                    
                    for error in result.validation_errors:
                        writer.writerow([
                            error.error_type,
                            error.message
                        ])
                
                if result.notes:
                    writer.writerow([])
                    writer.writerow(["备注"])
                    writer.writerow([result.notes])
        
        except Exception as e:
            errors.append(f"导出文件时出错: {str(e)}")
        
        return errors
    
    def export_samples_template(self, samples: List[Sample], file_path: str) -> List[str]:
        """导出样品列表为CSV模板"""
        errors = []
        
        try:
            with open(file_path, 'w', encoding='utf-8', newline='') as f:
                writer = csv.writer(f)
                
                writer.writerow([
                    "hole_position", "tube_type_id", "sample_volume_ml",
                    "sample_density_gml", "label"
                ])
                writer.writerow([
                    "# 孔位编号(整数)",
                    "# 管型ID",
                    "# 样品体积(ml)",
                    "# 样品密度(g/ml，可选，默认1.0)",
                    "# 标签(可选)"
                ])
                
                for sample in samples:
                    writer.writerow([
                        sample.hole_position,
                        sample.tube_type_id,
                        sample.sample_volume_ml,
                        sample.sample_density_gml if sample.sample_density_gml != 1.0 else "",
                        sample.label
                    ])
        
        except Exception as e:
            errors.append(f"导出模板时出错: {str(e)}")
        
        return errors
    
    def validate_samples(
        self,
        samples: List[Sample],
        rotor: Rotor,
        tube_types: Dict[str, TubeType]
    ) -> List[str]:
        """验证样品数据的有效性"""
        errors = []
        
        if not samples:
            errors.append("没有样品数据")
            return errors
        
        positions = [s.hole_position for s in samples]
        duplicates = set([p for p in positions if positions.count(p) > 1])
        if duplicates:
            errors.append(f"存在重复的孔位: {sorted(duplicates)}")
        
        for sample in samples:
            if sample.hole_position < 1 or sample.hole_position > rotor.hole_count:
                errors.append(f"孔位 {sample.hole_position} 超出有效范围 [1, {rotor.hole_count}]")
            
            if sample.tube_type_id not in tube_types:
                errors.append(f"孔位 {sample.hole_position} 使用的管型 '{sample.tube_type_id}' 未定义")
            else:
                tube_type = tube_types[sample.tube_type_id]
                if sample.sample_volume_ml < 0:
                    errors.append(f"孔位 {sample.hole_position} 的样品体积不能为负数")
                elif sample.sample_volume_ml > tube_type.max_volume_ml:
                    errors.append(
                        f"孔位 {sample.hole_position} 的样品体积 ({sample.sample_volume_ml}ml) "
                        f"超过管型最大容量 ({tube_type.max_volume_ml}ml)"
                    )
            
            if sample.sample_density_gml <= 0:
                errors.append(f"孔位 {sample.hole_position} 的样品密度必须大于0")
        
        return errors
