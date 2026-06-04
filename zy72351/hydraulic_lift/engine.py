import math


class HydraulicLiftEngine:
    DEFAULT_PARAMS = {
        "rated_load": {"display_name": "额定载荷", "value": 50.0, "unit": "kN", "category": "input"},
        "platform_weight": {"display_name": "平台自重", "value": 12.0, "unit": "kN", "category": "input"},
        "cylinder_bore": {"display_name": "液压缸内径", "value": 80.0, "unit": "mm", "category": "input"},
        "cylinder_count": {"display_name": "液压缸数量", "value": 2, "unit": "个", "category": "input"},
        "system_pressure": {"display_name": "系统压力", "value": 16.0, "unit": "MPa", "category": "input"},
        "safety_factor": {"display_name": "安全系数", "value": 2.0, "unit": "", "category": "input"},
        "lifting_stroke": {"display_name": "升降行程", "value": 3000.0, "unit": "mm", "category": "input"},
        "sampling_interval": {"display_name": "采样间隔", "value": 200, "unit": "ms", "category": "input"},
    }

    @staticmethod
    def calculate(params_dict):
        rated_load = params_dict.get("rated_load", 50.0)
        platform_weight = params_dict.get("platform_weight", 12.0)
        cylinder_bore = params_dict.get("cylinder_bore", 80.0)
        cylinder_count = params_dict.get("cylinder_count", 2)
        system_pressure = params_dict.get("system_pressure", 16.0)
        safety_factor = params_dict.get("safety_factor", 2.0)

        bore_m = cylinder_bore / 1000.0
        area = math.pi * (bore_m / 2.0) ** 2
        single_thrust = system_pressure * area * 1000.0
        total_thrust = single_thrust * cylinder_count
        total_load = rated_load + platform_weight
        load_ratio = total_load / total_thrust if total_thrust > 0 else float("inf")
        safety_margin = safety_factor / load_ratio if load_ratio > 0 else float("inf")

        results = {
            "single_cylinder_thrust": {
                "display_name": "单缸推力",
                "value": round(single_thrust, 2),
                "unit": "kN",
                "category": "output",
            },
            "total_thrust": {
                "display_name": "总推力",
                "value": round(total_thrust, 2),
                "unit": "kN",
                "category": "output",
            },
            "total_load": {
                "display_name": "总载荷",
                "value": round(total_load, 2),
                "unit": "kN",
                "category": "output",
            },
            "load_ratio": {
                "display_name": "载荷比",
                "value": round(load_ratio, 4),
                "unit": "",
                "category": "output",
            },
            "safety_margin": {
                "display_name": "安全裕度",
                "value": round(safety_margin, 4),
                "unit": "",
                "category": "output",
            },
        }

        passed = safety_margin >= 1.0
        conclusion = "载荷试算合格：安全裕度 {:.2f} ≥ 1.0".format(safety_margin) if passed else "载荷试算不合格：安全裕度 {:.2f} < 1.0".format(safety_margin)

        return results, conclusion, passed
