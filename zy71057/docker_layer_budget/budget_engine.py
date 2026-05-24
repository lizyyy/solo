import fnmatch
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from .config import BudgetRules, DEFAULT_BUDGET_RULES
from .layer_parser import FileEntry, ImageLayer, ImageMetadata
from .utils import format_size, is_in_cached_dir


@dataclass
class Violation:
    type: str
    severity: str
    layer_index: Optional[int] = None
    message: str = ""
    size: int = 0
    budget: int = 0
    details: Dict[str, Any] = field(default_factory=dict)

    @property
    def excess(self) -> int:
        return self.size - self.budget if self.budget > 0 else self.size

    def to_dict(self) -> dict:
        return {
            "type": self.type,
            "severity": self.severity,
            "layer_index": self.layer_index,
            "message": self.message,
            "size": self.size,
            "size_formatted": format_size(self.size),
            "budget": self.budget,
            "budget_formatted": format_size(self.budget),
            "excess": self.excess,
            "excess_formatted": format_size(self.excess),
            "details": self.details,
        }


@dataclass
class BudgetResult:
    passed: bool = True
    total_size: int = 0
    total_budget: int = 0
    violations: List[Violation] = field(default_factory=list)
    warnings: List[Violation] = field(default_factory=list)
    layer_analysis: List[Dict[str, Any]] = field(default_factory=list)

    @property
    def errors_count(self) -> int:
        return len(self.violations)

    @property
    def warnings_count(self) -> int:
        return len(self.warnings)

    def to_dict(self) -> dict:
        return {
            "passed": self.passed,
            "total_size": self.total_size,
            "total_size_formatted": format_size(self.total_size),
            "total_budget": self.total_budget,
            "total_budget_formatted": format_size(self.total_budget),
            "errors_count": self.errors_count,
            "warnings_count": self.warnings_count,
            "violations": [v.to_dict() for v in self.violations],
            "warnings": [w.to_dict() for w in self.warnings],
            "layer_analysis": self.layer_analysis,
        }


class BudgetEngine:
    def __init__(self, rules: Optional[BudgetRules] = None):
        self.rules = rules or DEFAULT_BUDGET_RULES

    def check_budget(self, metadata: ImageMetadata) -> BudgetResult:
        result = BudgetResult(
            total_size=metadata.total_size,
            total_budget=self.rules.total_max_size,
        )

        self._check_total_size(metadata, result)
        self._check_layers(metadata, result)
        self._check_cached_dirs(metadata, result)
        self._check_file_patterns(metadata, result)
        self._check_base_image(metadata, result)

        result.passed = len(result.violations) == 0

        return result

    def _check_total_size(self, metadata: ImageMetadata, result: BudgetResult):
        if self.rules.total_max_size <= 0:
            return

        if metadata.total_size > self.rules.total_max_size:
            result.violations.append(
                Violation(
                    type="total_size_exceeded",
                    severity="error",
                    message=f"镜像总大小 {format_size(metadata.total_size)} 超过预算 {format_size(self.rules.total_max_size)}",
                    size=metadata.total_size,
                    budget=self.rules.total_max_size,
                )
            )
        elif metadata.total_size > self.rules.total_max_size * 0.8:
            result.warnings.append(
                Violation(
                    type="total_size_warning",
                    severity="warning",
                    message=f"镜像总大小 {format_size(metadata.total_size)} 接近预算上限（已使用 {metadata.total_size / self.rules.total_max_size * 100:.1f}%）",
                    size=metadata.total_size,
                    budget=self.rules.total_max_size,
                )
            )

    def _check_layers(self, metadata: ImageMetadata, result: BudgetResult):
        layer_budget = self.rules.layer_budget.max_size
        warning_threshold = self.rules.layer_budget.warning_threshold

        for layer in metadata.layers:
            if layer.is_base_image or layer.is_cached:
                continue

            layer_info = {
                "index": layer.index,
                "size": layer.size,
                "size_formatted": format_size(layer.size),
                "budget": layer_budget,
                "budget_formatted": format_size(layer_budget),
                "status": "ok",
                "command": layer.command_summary,
            }

            if layer_budget > 0 and layer.size > layer_budget:
                result.violations.append(
                    Violation(
                        type="layer_size_exceeded",
                        severity="error",
                        layer_index=layer.index,
                        message=f"第 {layer.index} 层大小 {format_size(layer.size)} 超过单层预算 {format_size(layer_budget)}",
                        size=layer.size,
                        budget=layer_budget,
                        details={
                            "command": layer.created_by,
                            "digest": layer.digest,
                        },
                    )
                )
                layer_info["status"] = "error"
            elif layer_budget > 0 and layer.size > layer_budget * warning_threshold:
                result.warnings.append(
                    Violation(
                        type="layer_size_warning",
                        severity="warning",
                        layer_index=layer.index,
                        message=f"第 {layer.index} 层大小 {format_size(layer.size)} 接近预算上限（已使用 {layer.size / layer_budget * 100:.1f}%）",
                        size=layer.size,
                        budget=layer_budget,
                        details={
                            "command": layer.created_by,
                        },
                    )
                )
                layer_info["status"] = "warning"

            result.layer_analysis.append(layer_info)

    def _check_cached_dirs(self, metadata: ImageMetadata, result: BudgetResult):
        cached_dirs = self.rules.cached_dirs
        if not cached_dirs:
            return

        for layer in metadata.layers:
            if layer.is_base_image:
                continue

            cached_files = []
            for file_entry in layer.files:
                if is_in_cached_dir(file_entry.path, cached_dirs):
                    cached_files.append(file_entry)

            if cached_files:
                total_cached_size = sum(f.size for f in cached_files)
                result.violations.append(
                    Violation(
                        type="cached_dir_found",
                        severity="error",
                        layer_index=layer.index,
                        message=f"第 {layer.index} 层发现缓存目录文件，总计 {format_size(total_cached_size)}",
                        size=total_cached_size,
                        budget=0,
                        details={
                            "cached_dirs": cached_dirs,
                            "files_count": len(cached_files),
                            "sample_files": [f.path for f in cached_files[:5]],
                        },
                    )
                )

    def _check_file_patterns(self, metadata: ImageMetadata, result: BudgetResult):
        patterns = self.rules.path_patterns
        if not patterns:
            return

        for layer in metadata.layers:
            if layer.is_base_image:
                continue

            for pattern, max_size in patterns.items():
                matching_files = []
                for file_entry in layer.files:
                    if fnmatch.fnmatch(file_entry.path, pattern):
                        matching_files.append(file_entry)

                if matching_files:
                    total_size = sum(f.size for f in matching_files)
                    if total_size > max_size:
                        result.violations.append(
                            Violation(
                                type="pattern_exceeded",
                                severity="error",
                                layer_index=layer.index,
                                message=f"第 {layer.index} 层匹配 '{pattern}' 的文件大小 {format_size(total_size)} 超过限制 {format_size(max_size)}",
                                size=total_size,
                                budget=max_size,
                                details={
                                    "pattern": pattern,
                                    "files_count": len(matching_files),
                                    "sample_files": [f.path for f in matching_files[:5]],
                                },
                            )
                        )

    def _check_base_image(self, metadata: ImageMetadata, result: BudgetResult):
        allowlist = self.rules.base_image_allowlist
        if not allowlist or not metadata.base_image:
            return

        is_allowed = False
        for allowed in allowlist:
            if metadata.base_image.startswith(allowed):
                is_allowed = True
                break

        if not is_allowed:
            result.warnings.append(
                Violation(
                    type="base_image_not_allowed",
                    severity="warning",
                    message=f"基础镜像 '{metadata.base_image}' 不在允许列表中",
                    size=0,
                    budget=0,
                    details={
                        "base_image": metadata.base_image,
                        "allowlist": allowlist,
                    },
                )
            )

    def get_explanation(self, violation: Violation) -> str:
        explanations = {
            "total_size_exceeded": """
## 问题说明
镜像总大小超过了预算限制。这会导致：
- 镜像拉取时间变长
- 部署速度变慢
- 存储空间占用增加

## 建议解决方案
1. 检查是否有不必要的大文件被打包进镜像
2. 考虑使用多阶段构建（multi-stage build）
3. 清理构建缓存和临时文件
4. 评估是否可以使用更小的基础镜像
""",
            "layer_size_exceeded": """
## 问题说明
单个镜像层大小超过了预算限制。Docker 镜像层是增量叠加的，过大的单层会：
- 增加镜像重建时的重新下载量
- 使得层缓存的效果降低

## 建议解决方案
1. 将大文件的操作拆分到多个 RUN 命令中
2. 在同一个 RUN 命令中下载和清理文件
3. 检查是否有模型文件或数据集被误打包
""",
            "cached_dir_found": """
## 问题说明
在镜像层中发现了缓存目录文件。这些文件：
- 不属于运行时必需的内容
- 会无意义地增加镜像大小
- 通常是构建过程中产生的临时文件

## 建议解决方案
1. 在 Dockerfile 中清理缓存目录：
   ```dockerfile
   RUN apt-get clean && \
       rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*
   ```
2. 使用 .dockerignore 排除不必要的文件
3. 在构建命令后立即清理下载的包
""",
            "pattern_exceeded": """
## 问题说明
匹配特定模式的文件总大小超过了限制。

## 建议解决方案
1. 检查这些文件是否是运行时必需的
2. 考虑将依赖文件放在单独的层中以便缓存
3. 使用 .dockerignore 排除开发依赖文件
""",
            "base_image_not_allowed": """
## 问题说明
使用的基础镜像不在允许列表中。

## 建议解决方案
1. 检查团队推荐的基础镜像列表
2. 评估切换到允许的基础镜像的影响
3. 如需使用此镜像，请联系平台组更新允许列表
""",
        }
        return explanations.get(violation.type, "暂无详细说明")
