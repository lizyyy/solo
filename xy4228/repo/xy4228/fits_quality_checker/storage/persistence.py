"""数据持久化存储。

负责保存和加载元数据、质量结果等数据到本地文件系统。
"""

import os
import json
import shutil
from datetime import datetime
from typing import Optional, Dict, Any, List
from pathlib import Path
from dataclasses import asdict

import pandas as pd

from fits_quality_checker.models.models import (
    FITSMetadata,
    ImageQualityMetrics,
    QualityResult,
    AnalysisResult,
    FileStatus,
    FileType,
    ObservationConfig,
    RuleResult,
)


class DataStore:
    """数据存储。

    功能：
    1. 保存和加载元数据列表
    2. 保存和加载质量结果
    3. 保存和加载分析结果
    4. 导出数据为多种格式
    """

    DATA_DIR_NAME = ".fitsqc"
    METADATA_DIR = "metadata"
    RESULTS_DIR = "results"
    ANALYSIS_DIR = "analysis"
    EXPORTS_DIR = "exports"

    def __init__(self, workspace: Optional[str] = None):
        """初始化数据存储。

        Args:
            workspace: 工作目录路径，如果为None则使用当前目录
        """
        if workspace is None:
            workspace = os.getcwd()

        self.workspace = Path(workspace)
        self.base_dir = self.workspace / self.DATA_DIR_NAME
        self.metadata_dir = self.base_dir / self.METADATA_DIR
        self.results_dir = self.base_dir / self.RESULTS_DIR
        self.analysis_dir = self.base_dir / self.ANALYSIS_DIR
        self.exports_dir = self.base_dir / self.EXPORTS_DIR

    def init_workspace(self) -> bool:
        """初始化工作空间。

        创建必要的目录结构。

        Returns:
            是否成功初始化
        """
        try:
            self.metadata_dir.mkdir(parents=True, exist_ok=True)
            self.results_dir.mkdir(parents=True, exist_ok=True)
            self.analysis_dir.mkdir(parents=True, exist_ok=True)
            self.exports_dir.mkdir(parents=True, exist_ok=True)
            return True
        except Exception:
            return False

    def save_metadata(
        self,
        metadatas: List[FITSMetadata],
        name: str = "current",
    ) -> Path:
        """保存元数据列表。

        Args:
            metadatas: FITSMetadata对象列表
            name: 保存名称

        Returns:
            保存的文件路径
        """
        self.init_workspace()

        file_path = self.metadata_dir / f"{name}.json"

        # 转换为可序列化的字典
        data = {
            "name": name,
            "saved_at": datetime.now().isoformat(),
            "count": len(metadatas),
            "metadatas": [self._metadata_to_dict(m) for m in metadatas],
        }

        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

        return file_path

    def load_metadata(self, name: str = "current") -> List[FITSMetadata]:
        """加载元数据列表。

        Args:
            name: 保存名称

        Returns:
            FITSMetadata对象列表
        """
        file_path = self.metadata_dir / f"{name}.json"

        if not file_path.exists():
            raise FileNotFoundError(f"元数据不存在: {file_path}")

        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        metadatas = []
        for item in data.get("metadatas", []):
            metadata = self._dict_to_metadata(item)
            metadatas.append(metadata)

        return metadatas

    def list_metadata_sets(self) -> List[Dict[str, Any]]:
        """列出所有保存的元数据集。

        Returns:
            元数据集信息列表
        """
        if not self.metadata_dir.exists():
            return []

        sets = []
        for file_path in self.metadata_dir.glob("*.json"):
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    data = json.load(f)

                sets.append({
                    "name": data.get("name", file_path.stem),
                    "file_path": str(file_path),
                    "count": data.get("count", 0),
                    "saved_at": data.get("saved_at"),
                })
            except Exception:
                continue

        return sets

    def save_results(
        self,
        results: List[QualityResult],
        name: str = "current",
    ) -> Path:
        """保存质量结果列表。

        Args:
            results: QualityResult对象列表
            name: 保存名称

        Returns:
            保存的文件路径
        """
        self.init_workspace()

        file_path = self.results_dir / f"{name}.json"

        data = {
            "name": name,
            "saved_at": datetime.now().isoformat(),
            "count": len(results),
            "results": [self._quality_result_to_dict(r) for r in results],
        }

        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

        return file_path

    def load_results(self, name: str = "current") -> List[QualityResult]:
        """加载质量结果列表。

        Args:
            name: 保存名称

        Returns:
            QualityResult对象列表
        """
        file_path = self.results_dir / f"{name}.json"

        if not file_path.exists():
            raise FileNotFoundError(f"结果不存在: {file_path}")

        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        results = []
        for item in data.get("results", []):
            result = self._dict_to_quality_result(item)
            results.append(result)

        return results

    def save_analysis(self, analysis: AnalysisResult, name: str = "current") -> Path:
        """保存分析结果。

        Args:
            analysis: AnalysisResult对象
            name: 保存名称

        Returns:
            保存的文件路径
        """
        self.init_workspace()

        file_path = self.analysis_dir / f"{name}.json"

        data = self._analysis_result_to_dict(analysis)

        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

        return file_path

    def load_analysis(self, name: str = "current") -> AnalysisResult:
        """加载分析结果。

        Args:
            name: 保存名称

        Returns:
            AnalysisResult对象
        """
        file_path = self.analysis_dir / f"{name}.json"

        if not file_path.exists():
            raise FileNotFoundError(f"分析结果不存在: {file_path}")

        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        return self._dict_to_analysis_result(data)

    def export_to_csv(
        self,
        results: List[QualityResult],
        output_path: str,
    ) -> Path:
        """导出质量结果到CSV文件。

        Args:
            results: QualityResult对象列表
            output_path: 输出路径

        Returns:
            输出文件路径
        """
        rows = []
        for result in results:
            row = {
                "file_name": result.file_name,
                "file_path": result.file_path,
                "file_type": result.file_type.value if hasattr(result.file_type, "value") else str(result.file_type),
                "status": result.status.value if hasattr(result.status, "value") else str(result.status),
                "overall_score": result.overall_score,
            }

            # 添加指标
            if result.metrics:
                row["fwhm"] = result.metrics.fwhm
                row["fwhm_arcsec"] = result.metrics.fwhm_arcsec
                row["roundness"] = result.metrics.roundness
                row["background_noise"] = result.metrics.background_noise
                row["star_count"] = result.metrics.star_count
                row["temperature_deviation"] = result.metrics.temperature_deviation

            # 添加问题和建议
            row["issues"] = "; ".join(result.issues) if result.issues else ""
            row["recommendations"] = "; ".join(result.recommendations) if result.recommendations else ""

            # 添加元数据
            if result.metadata:
                row["exposure_time"] = result.metadata.exposure_time
                row["filter"] = result.metadata.filter_name
                row["temperature"] = result.metadata.temperature
                row["gain"] = result.metadata.gain
                row["observation_time"] = (
                    result.metadata.observation_time.isoformat()
                    if result.metadata.observation_time
                    else None
                )

            rows.append(row)

        df = pd.DataFrame(rows)
        output_file = Path(output_path)
        output_file.parent.mkdir(parents=True, exist_ok=True)
        df.to_csv(output_file, index=False, encoding="utf-8-sig")

        return output_file

    def get_results_by_status(
        self,
        results: List[QualityResult],
        status: FileStatus,
    ) -> List[QualityResult]:
        """按状态过滤结果。

        Args:
            results: 质量结果列表
            status: 目标状态

        Returns:
            过滤后的结果列表
        """
        return [r for r in results if r.status == status]

    def get_results_by_type(
        self,
        results: List[QualityResult],
        file_type: FileType,
    ) -> List[QualityResult]:
        """按文件类型过滤结果。

        Args:
            results: 质量结果列表
            file_type: 目标文件类型

        Returns:
            过滤后的结果列表
        """
        return [r for r in results if r.file_type == file_type]

    def _metadata_to_dict(self, metadata: FITSMetadata) -> Dict[str, Any]:
        """将FITSMetadata转换为可序列化的字典。

        Args:
            metadata: FITSMetadata对象

        Returns:
            可序列化的字典
        """
        d = metadata.model_dump()

        # 处理枚举
        d["file_type"] = d["file_type"].value if hasattr(d["file_type"], "value") else d["file_type"]

        # 处理datetime
        if d.get("observation_time"):
            d["observation_time"] = d["observation_time"].isoformat()
        if d.get("import_time"):
            d["import_time"] = d["import_time"].isoformat()

        return d

    def _dict_to_metadata(self, d: Dict[str, Any]) -> FITSMetadata:
        """将字典转换为FITSMetadata对象。

        Args:
            d: 字典

        Returns:
            FITSMetadata对象
        """
        # 处理枚举
        if d.get("file_type"):
            d["file_type"] = FileType(d["file_type"])

        # 处理datetime
        if d.get("observation_time") and isinstance(d["observation_time"], str):
            d["observation_time"] = datetime.fromisoformat(d["observation_time"])
        if d.get("import_time") and isinstance(d["import_time"], str):
            d["import_time"] = datetime.fromisoformat(d["import_time"])

        return FITSMetadata(**d)

    def _quality_result_to_dict(self, result: QualityResult) -> Dict[str, Any]:
        """将QualityResult转换为可序列化的字典。

        Args:
            result: QualityResult对象

        Returns:
            可序列化的字典
        """
        d = result.model_dump()

        # 处理枚举
        d["file_type"] = d["file_type"].value if hasattr(d["file_type"], "value") else d["file_type"]
        d["status"] = d["status"].value if hasattr(d["status"], "value") else d["status"]

        # 处理datetime
        if d.get("evaluated_at"):
            d["evaluated_at"] = d["evaluated_at"].isoformat()

        # 处理嵌套的metrics
        if d.get("metrics"):
            if d["metrics"].get("calculated_at"):
                d["metrics"]["calculated_at"] = d["metrics"]["calculated_at"].isoformat()

        # 处理嵌套的metadata
        if d.get("metadata"):
            if d["metadata"].get("observation_time"):
                d["metadata"]["observation_time"] = d["metadata"]["observation_time"].isoformat()
            if d["metadata"].get("import_time"):
                d["metadata"]["import_time"] = d["metadata"]["import_time"].isoformat()
            if d["metadata"].get("file_type"):
                d["metadata"]["file_type"] = (
                    d["metadata"]["file_type"].value
                    if hasattr(d["metadata"]["file_type"], "value")
                    else d["metadata"]["file_type"]
                )

        # 处理rule_results
        if d.get("rule_results"):
            for rr in d["rule_results"]:
                # RuleResult是pydantic模型，会自动序列化
                pass

        return d

    def _dict_to_quality_result(self, d: Dict[str, Any]) -> QualityResult:
        """将字典转换为QualityResult对象。

        Args:
            d: 字典

        Returns:
            QualityResult对象
        """
        # 处理枚举
        if d.get("file_type"):
            d["file_type"] = FileType(d["file_type"])
        if d.get("status"):
            d["status"] = FileStatus(d["status"])

        # 处理datetime
        if d.get("evaluated_at") and isinstance(d["evaluated_at"], str):
            d["evaluated_at"] = datetime.fromisoformat(d["evaluated_at"])

        # 处理metrics
        if d.get("metrics"):
            if d["metrics"].get("calculated_at") and isinstance(d["metrics"]["calculated_at"], str):
                d["metrics"]["calculated_at"] = datetime.fromisoformat(d["metrics"]["calculated_at"])
            d["metrics"] = ImageQualityMetrics(**d["metrics"])

        # 处理metadata
        if d.get("metadata"):
            if d["metadata"].get("observation_time") and isinstance(d["metadata"]["observation_time"], str):
                d["metadata"]["observation_time"] = datetime.fromisoformat(d["metadata"]["observation_time"])
            if d["metadata"].get("import_time") and isinstance(d["metadata"]["import_time"], str):
                d["metadata"]["import_time"] = datetime.fromisoformat(d["metadata"]["import_time"])
            if d["metadata"].get("file_type"):
                d["metadata"]["file_type"] = FileType(d["metadata"]["file_type"])
            d["metadata"] = FITSMetadata(**d["metadata"])

        # 处理rule_results
        if d.get("rule_results"):
            rule_results = []
            for rr_dict in d["rule_results"]:
                rule_results.append(RuleResult(**rr_dict))
            d["rule_results"] = rule_results

        return QualityResult(**d)

    def _analysis_result_to_dict(self, analysis: AnalysisResult) -> Dict[str, Any]:
        """将AnalysisResult转换为可序列化的字典。

        Args:
            analysis: AnalysisResult对象

        Returns:
            可序列化的字典
        """
        d = analysis.model_dump()

        # 处理datetime
        if d.get("generated_at"):
            d["generated_at"] = d["generated_at"].isoformat()

        # 处理results列表
        if d.get("results"):
            d["results"] = [self._quality_result_to_dict(r) for r in analysis.results]

        return d

    def _dict_to_analysis_result(self, d: Dict[str, Any]) -> AnalysisResult:
        """将字典转换为AnalysisResult对象。

        Args:
            d: 字典

        Returns:
            AnalysisResult对象
        """
        # 处理datetime
        if d.get("generated_at") and isinstance(d["generated_at"], str):
            d["generated_at"] = datetime.fromisoformat(d["generated_at"])

        # 处理results列表
        if d.get("results"):
            results = []
            for r_dict in d["results"]:
                results.append(self._dict_to_quality_result(r_dict))
            d["results"] = results

        return AnalysisResult(**d)

    def clear_all(self) -> bool:
        """清除所有存储的数据。

        Returns:
            是否成功清除
        """
        try:
            if self.base_dir.exists():
                shutil.rmtree(self.base_dir)
            return True
        except Exception:
            return False
