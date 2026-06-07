import yaml
from typing import List, Dict, Any, Tuple
from pathlib import Path

from ..models import (
    YamlSourceLine,
    FeatureComparisonRecord,
    EmbeddingCompatSession,
)


class YamlWithLineNumbersLoader(yaml.SafeLoader):
    """自定义YAML加载器，给每个节点加上行号信息"""

    def construct_mapping(self, node, deep=True):
        mapping = super().construct_mapping(node, deep=deep)
        mapping["__line__"] = node.start_mark.line + 1
        for key_node, value_node in node.value:
            key = self.construct_object(key_node, deep=deep)
            if isinstance(key, str):
                if isinstance(mapping.get(key), dict):
                    mapping[key]["__key_line__"] = key_node.start_mark.line + 1
                    mapping[key]["__value_line__"] = value_node.start_mark.line + 1
        return mapping


def load_yaml_with_lines(file_path: str) -> Tuple[Dict[str, Any], List[YamlSourceLine]]:
    """加载YAML文件，同时保留每一行的原始内容和行号

    返回：
    - parsed_data: 解析后的字典（带__line__等元信息）
    - source_lines: 每一行的原始记录，方便后续追踪和修改
    """
    path = Path(file_path)
    raw_lines = []
    with open(path, "r", encoding="utf-8") as f:
        for idx, line in enumerate(f, start=1):
            raw_lines.append(YamlSourceLine(line_number=idx, raw_content=line.rstrip("\n")))

    with open(path, "r", encoding="utf-8") as f:
        parsed_data = yaml.load(f, Loader=YamlWithLineNumbersLoader)

    return parsed_data, raw_lines


def _extract_feature_configs(
    parsed_data: Dict[str, Any],
    all_source_lines: List[YamlSourceLine],
) -> List[Tuple[str, Dict[str, Any], List[YamlSourceLine]]]:
    """从YAML中提取每个特征的配置，以及对应的原始行"""
    features = []
    feature_list = parsed_data.get("features", [])

    for idx, feat_config in enumerate(feature_list):
        feature_name = feat_config.get("name", f"feature_{idx}")
        line_num = feat_config.get("__line__", None)

        related_lines = []
        if line_num is not None:
            start_line = line_num
            end_line = line_num
            for i in range(line_num, len(all_source_lines)):
                content = all_source_lines[i].raw_content.strip()
                if content.startswith("- name:") and i > line_num - 1:
                    break
                end_line = i + 1

            for ln in range(start_line - 1, min(end_line, len(all_source_lines))):
                related_lines.append(all_source_lines[ln])

        features.append((feature_name, feat_config, related_lines))

    return features


def import_session_from_yaml(
    file_path: str,
    created_by: str = "system",
    session_name: str = "",
) -> EmbeddingCompatSession:
    """从参数YAML导入一个完整的兼容检查会话

    第一步：参数YAML第一次导入
    每一条记录都会绑定它在YAML中的原始行
    """
    parsed_data, all_source_lines = load_yaml_with_lines(file_path)

    version_a = parsed_data.get("embedding_version_a", "")
    version_b = parsed_data.get("embedding_version_b", "")

    session = EmbeddingCompatSession(
        session_name=session_name or Path(file_path).stem,
        version_a=version_a,
        version_b=version_b,
        created_by=created_by,
    )

    feature_configs = _extract_feature_configs(parsed_data, all_source_lines)

    for feature_name, feat_config, yaml_lines in feature_configs:
        record = FeatureComparisonRecord(
            feature_name=feature_name,
            embedding_version_a=version_a,
            embedding_version_b=version_b,
        )

        record.score_a = feat_config.get("score_a")
        record.score_b = feat_config.get("score_b")
        if record.score_a is not None and record.score_b is not None:
            record.score_diff = round(record.score_b - record.score_a, 6)

        record.feature_present_online = feat_config.get("feature_present_online", True)
        record.used_default_score = feat_config.get("used_default_score", False)
        record.default_score_value = feat_config.get("default_score_value")

        for line in yaml_lines:
            if ":" in line.raw_content:
                key_part = line.raw_content.split(":", 1)[0].strip().lstrip("- ").strip()
                line.parsed_key = key_part
                if key_part in feat_config:
                    line.parsed_value = feat_config[key_part]
            record.yaml_source_lines.append(line)

        record.detect_default_score_missing_feature()

        session.add_record(record)

    return session
