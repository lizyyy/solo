import csv
import json
import shutil
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, List, Optional
from copy import deepcopy

from sampler_merger.config import Sample
from sampler_merger.review import ReviewManager


class ExportManager:
    """导出管理器"""
    
    def __init__(self, config: Dict, project_dir: Path, output_dir: Path):
        """
        初始化导出管理器
        
        Args:
            config: 项目配置
            project_dir: 项目目录路径
            output_dir: 输出目录路径
        """
        self.config = config
        self.project_dir = project_dir
        self.output_dir = output_dir
        self.output_dir.mkdir(parents=True, exist_ok=True)
    
    def prepare_export_data(self, apply_reviews: bool = True) -> Dict[str, Any]:
        """
        准备导出数据
        
        Args:
            apply_reviews: 是否应用已记录的裁决
        
        Returns:
            导出数据字典
        """
        merged = self.config.get("merged_samples", {})
        samples_data = merged.get("samples", [])
        
        # 重建Sample对象
        samples = [Sample.from_dict(s) for s in samples_data]
        
        # 应用裁决
        if apply_reviews:
            review_manager = ReviewManager(self.config, self.project_dir)
            samples = review_manager.apply_decisions(samples)
        
        # 构建导出数据
        export_data = {
            "exported_at": datetime.now().isoformat(),
            "project_name": self.config.get("project_name", "unknown"),
            "apply_reviews": apply_reviews,
            "total_samples": len(samples),
            "samples": samples,
            "stats": {
                "by_source_type": self._count_by_source_type(samples),
                "with_coordinates": sum(1 for s in samples if s.has_valid_coordinates()),
                "with_timestamp": sum(1 for s in samples if s.timestamp),
                "with_attachments": sum(1 for s in samples if s.attachments),
            },
            "original_config": {
                "timezone": self.config.get("timezone", "UTC"),
                "coordinate_system": self.config.get("coordinate_system", "WGS84"),
            },
        }
        
        return export_data
    
    def _count_by_source_type(self, samples: List[Sample]) -> Dict[str, int]:
        """按来源类型统计"""
        counts = {}
        for s in samples:
            st = s.source_type or "unknown"
            counts[st] = counts.get(st, 0) + 1
        return counts
    
    def export_geojson(self, export_data: Dict) -> Path:
        """
        导出GeoJSON格式
        
        Args:
            export_data: 导出数据
        
        Returns:
            导出文件路径
        """
        samples = export_data.get("samples", [])
        
        # 构建GeoJSON FeatureCollection
        features = []
        
        for sample in samples:
            if not sample.has_valid_coordinates():
                continue
            
            # 构建属性
            properties = {
                "sample_id": sample.sample_id,
                "source_file": sample.source_file,
                "source_type": sample.source_type,
            }
            
            if sample.timestamp:
                properties["timestamp"] = sample.timestamp.isoformat()
            
            # 添加元数据
            for key, value in sample.metadata.items():
                if not key.startswith('_'):  # 跳过内部字段
                    properties[f"meta_{key}"] = value
            
            # 添加附件信息
            if sample.attachments:
                properties["attachments_count"] = len(sample.attachments)
                properties["attachments"] = [str(Path(a).name) for a in sample.attachments]
            
            feature = {
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": [sample.longitude, sample.latitude],
                },
                "properties": properties,
            }
            
            features.append(feature)
        
        geojson = {
            "type": "FeatureCollection",
            "name": "hydrology_survey_samples",
            "crs": {
                "type": "name",
                "properties": {
                    "name": "urn:ogc:def:crs:OGC:1.3:CRS84"
                }
            },
            "features": features,
            "export_metadata": {
                "exported_at": export_data.get("exported_at"),
                "project_name": export_data.get("project_name"),
                "total_samples": export_data.get("total_samples"),
                "features_count": len(features),
                "coordinate_system": export_data.get("original_config", {}).get("coordinate_system"),
            }
        }
        
        output_file = self.output_dir / "samples.geojson"
        
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(geojson, f, indent=2, ensure_ascii=False, default=str)
        
        return output_file
    
    def export_csv(self, export_data: Dict) -> Path:
        """
        导出CSV格式
        
        Args:
            export_data: 导出数据
        
        Returns:
            导出文件路径
        """
        samples = export_data.get("samples", [])
        
        if not samples:
            # 创建空文件
            output_file = self.output_dir / "samples.csv"
            with open(output_file, 'w', encoding='utf-8') as f:
                f.write("")
            return output_file
        
        # 收集所有可能的字段
        all_fields = set()
        for sample in samples:
            all_fields.add("sample_id")
            all_fields.add("latitude")
            all_fields.add("longitude")
            all_fields.add("timestamp")
            all_fields.add("source_file")
            all_fields.add("source_type")
            all_fields.add("attachments_count")
            
            for key in sample.metadata.keys():
                if not key.startswith('_'):
                    all_fields.add(f"meta_{key}")
        
        # 确定字段顺序
        base_fields = [
            "sample_id", "latitude", "longitude", "timestamp", 
            "source_file", "source_type", "attachments_count"
        ]
        
        # 排序剩余字段
        meta_fields = sorted([f for f in all_fields if f.startswith("meta_")])
        other_fields = sorted([f for f in all_fields if f not in base_fields and f not in meta_fields])
        
        fieldnames = base_fields + meta_fields + other_fields
        
        output_file = self.output_dir / "samples.csv"
        
        with open(output_file, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            
            for sample in samples:
                row = {
                    "sample_id": sample.sample_id,
                    "latitude": sample.latitude if sample.latitude else "",
                    "longitude": sample.longitude if sample.longitude else "",
                    "timestamp": sample.timestamp.isoformat() if sample.timestamp else "",
                    "source_file": sample.source_file,
                    "source_type": sample.source_type,
                    "attachments_count": len(sample.attachments),
                }
                
                for key, value in sample.metadata.items():
                    if not key.startswith('_'):
                        row[f"meta_{key}"] = str(value)
                
                writer.writerow(row)
        
        return output_file
    
    def export_markdown(self, export_data: Dict) -> Path:
        """
        导出Markdown格式的外业交接包
        
        Args:
            export_data: 导出数据
        
        Returns:
            导出文件路径
        """
        samples = export_data.get("samples", [])
        stats = export_data.get("stats", {})
        
        lines = []
        
        # 标题
        lines.append("# 野外水文调查报告")
        lines.append("")
        lines.append(f"**导出时间**: {export_data.get('exported_at')}")
        lines.append(f"**项目名称**: {export_data.get('project_name')}")
        lines.append("")
        
        # 统计信息
        lines.append("## 数据概览")
        lines.append("")
        lines.append(f"- **总样点数**: {export_data.get('total_samples')}")
        lines.append(f"- **有坐标**: {stats.get('with_coordinates', 0)}")
        lines.append(f"- **有时间戳**: {stats.get('with_timestamp', 0)}")
        lines.append(f"- **有附件**: {stats.get('with_attachments', 0)}")
        lines.append("")
        
        # 按来源类型统计
        by_type = stats.get('by_source_type', {})
        if by_type:
            lines.append("### 按来源类型分布")
            lines.append("")
            lines.append("| 来源类型 | 数量 |")
            lines.append("|----------|------|")
            for st, count in by_type.items():
                lines.append(f"| {st} | {count} |")
            lines.append("")
        
        # 配置信息
        lines.append("## 项目配置")
        lines.append("")
        orig_config = export_data.get("original_config", {})
        lines.append(f"- **时区**: {orig_config.get('timezone')}")
        lines.append(f"- **坐标系**: {orig_config.get('coordinate_system')}")
        lines.append("")
        
        # 样点列表
        lines.append("## 样点详情")
        lines.append("")
        
        # 按ID排序
        sorted_samples = sorted(samples, key=lambda s: s.sample_id)
        
        for idx, sample in enumerate(sorted_samples, 1):
            lines.append(f"### 样点 {idx}: `{sample.sample_id}`")
            lines.append("")
            
            # 基本信息
            lines.append("#### 基本信息")
            lines.append("")
            lines.append(f"- **来源文件**: {sample.source_file}")
            lines.append(f"- **来源类型**: {sample.source_type}")
            
            if sample.has_valid_coordinates():
                lines.append(f"- **坐标**: ({sample.latitude:.6f}, {sample.longitude:.6f})")
            
            if sample.timestamp:
                lines.append(f"- **时间**: {sample.timestamp.isoformat()}")
            
            lines.append("")
            
            # 元数据
            if sample.metadata:
                public_meta = {k: v for k, v in sample.metadata.items() if not k.startswith('_')}
                if public_meta:
                    lines.append("#### 元数据")
                    lines.append("")
                    for key, value in public_meta.items():
                        lines.append(f"- **{key}**: {value}")
                    lines.append("")
            
            # 附件
            if sample.attachments:
                lines.append("#### 附件")
                lines.append("")
                for att in sample.attachments:
                    att_path = Path(att)
                    lines.append(f"- [{att_path.name}]({att_path.name})")
                lines.append("")
            
            lines.append("---")
            lines.append("")
        
        # 附录
        lines.append("## 附录")
        lines.append("")
        lines.append("### 导出文件清单")
        lines.append("")
        lines.append("- `samples.geojson` - GeoJSON格式数据")
        lines.append("- `samples.csv` - CSV格式数据")
        lines.append("- `report.md` - 本报告")
        lines.append("- `attachments/` - 附件目录（如存在）")
        lines.append("")
        lines.append("---")
        lines.append("")
        lines.append("*本报告由离线采样包合并器自动生成*")
        
        output_file = self.output_dir / "report.md"
        
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write("\n".join(lines))
        
        return output_file
    
    def copy_attachments(self, export_data: Dict) -> Path:
        """
        复制附件到输出目录
        
        Args:
            export_data: 导出数据
        
        Returns:
            附件目录路径
        """
        samples = export_data.get("samples", [])
        
        attachments_dir = self.output_dir / "attachments"
        attachments_dir.mkdir(parents=True, exist_ok=True)
        
        copied = set()
        
        for sample in samples:
            for attachment in sample.attachments:
                att_path = Path(attachment)
                if att_path.exists() and str(att_path) not in copied:
                    try:
                        dest = attachments_dir / att_path.name
                        
                        # 处理重名文件
                        counter = 1
                        while dest.exists():
                            dest = attachments_dir / f"{att_path.stem}_{counter}{att_path.suffix}"
                            counter += 1
                        
                        shutil.copy2(att_path, dest)
                        copied.add(str(att_path))
                    except Exception as e:
                        # 忽略复制错误
                        continue
        
        return attachments_dir
