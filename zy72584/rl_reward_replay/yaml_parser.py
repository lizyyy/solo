import yaml
from pathlib import Path
from datetime import datetime
from typing import Optional
from .models import YamlParams


class YamlParser:
    def __init__(self):
        pass

    def parse(self, yaml_path: str) -> YamlParams:
        path = Path(yaml_path)
        if not path.exists():
            raise FileNotFoundError(f"YAML参数文件不存在: {yaml_path}")

        with open(path, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f)

        param_id = data.get("param_id", f"param_{datetime.now().strftime('%Y%m%d_%H%M%S')}")
        model_name = data.get("model_name", "unknown_model")

        feature_list = data.get("feature_list", [])
        if not feature_list:
            feature_list = list(data.get("features", {}).keys())

        reward_weights = data.get("reward_weights", {})
        default_values = data.get("default_values", {})
        feature_descriptions = data.get("feature_descriptions", {})
        threshold_config = data.get("threshold_config", {})

        features_config = data.get("features", {})
        for feat_name, feat_config in features_config.items():
            if isinstance(feat_config, dict):
                if feat_name not in feature_descriptions and "description" in feat_config:
                    feature_descriptions[feat_name] = feat_config["description"]
                if feat_name not in default_values and "default" in feat_config:
                    default_values[feat_name] = feat_config["default"]

        version = data.get("version", "1.0")
        created_at = datetime.now()

        return YamlParams(
            param_id=param_id,
            model_name=model_name,
            feature_list=feature_list,
            reward_weights=reward_weights,
            default_values=default_values,
            feature_descriptions=feature_descriptions,
            threshold_config=threshold_config,
            version=version,
            created_at=created_at,
        )

    def validate(self, params: YamlParams) -> list[str]:
        errors = []
        if not params.feature_list:
            errors.append("特征列表为空")
        if not params.reward_weights:
            errors.append("奖励权重配置为空")
        for feat in params.feature_list:
            if feat not in params.reward_weights:
                errors.append(f"特征 {feat} 缺少奖励权重配置")
        return errors

    def save_template(self, output_path: str):
        template = {
            "param_id": "example_param_001",
            "model_name": "rl_recommender_v2",
            "version": "1.0",
            "feature_list": [
                "user_click_rate_7d",
                "user_order_rate_30d",
                "item_cvr",
                "item_price_level",
                "context_time_slot",
            ],
            "reward_weights": {
                "user_click_rate_7d": 0.3,
                "user_order_rate_30d": 0.4,
                "item_cvr": 0.2,
                "item_price_level": 0.1,
            },
            "default_values": {
                "user_click_rate_7d": 0.05,
                "user_order_rate_30d": 0.01,
                "item_cvr": 0.02,
                "item_price_level": 2,
                "context_time_slot": "unknown",
            },
            "feature_descriptions": {
                "user_click_rate_7d": "用户近7天点击率",
                "user_order_rate_30d": "用户近30天下单率",
                "item_cvr": "商品转化率",
                "item_price_level": "商品价格档位",
                "context_time_slot": "上下文时间段",
            },
            "threshold_config": {
                "user_click_rate_7d": {"min": 0.0, "max": 1.0, "outlier_threshold": 3.0},
                "user_order_rate_30d": {"min": 0.0, "max": 1.0, "outlier_threshold": 3.0},
            },
        }
        with open(output_path, "w", encoding="utf-8") as f:
            yaml.dump(template, f, allow_unicode=True, default_flow_style=False)
