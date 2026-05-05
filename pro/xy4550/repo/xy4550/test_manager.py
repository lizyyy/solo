"""
试验管理器模块
整合计算、人工改判、保存和导出功能
"""
import os
import json
from datetime import datetime
from typing import Dict, List, Any, Optional
from config import EXPORTED_DIR, OUTPUT_CONFIG
from core.calculator import TriaxialTestCalculator
from data_loader import DataLoader


class TestManager:
    """试验管理器"""
    
    def __init__(self):
        self.calculator = TriaxialTestCalculator()
        self.data_loader = DataLoader()
        self.processed_tests = {}
    
    def initialize_data(self):
        """初始化数据，加载所有基础数据"""
        self.data_loader.load_sample_registry()
        self.data_loader.load_instrument_calibration()
    
    def process_test(self, test_id: str, 
                     override_peak_stress: float = None,
                     override_residual_stress: float = None,
                     override_failure_strain: float = None,
                     manual_judgment: str = None,
                     manual_remarks: str = None) -> Dict[str, Any]:
        """
        处理单个试验
        
        参数:
            test_id: 试验编号
            override_peak_stress: 人工改判的峰值强度 (kPa)
            override_residual_stress: 人工改判的残余强度 (kPa)
            override_failure_strain: 人工改判的破坏应变 (%)
            manual_judgment: 人工判定结果（合格/不合格/需复核）
            manual_remarks: 人工备注
            
        返回:
            包含完整处理结果的字典
        """
        # 加载试验数据
        test_data = self.data_loader.load_all_test_data(test_id)
        
        # 初始化结果字典
        result = {
            "test_id": test_id,
            "sample_info": test_data.get("sample_info"),
            "processing_time": datetime.now().isoformat(),
            "status": "处理完成",
            "errors": [],
            "calculations": {},
            "manual_overrides": {},
            "final_judgment": {}
        }
        
        # 1. 计算应力应变相关参数
        curve_data = test_data.get("stress_strain_curve")
        if curve_data:
            strain_data = curve_data.get("strain_data", [])
            stress_data = curve_data.get("stress_data", [])
            pore_pressure_data = curve_data.get("pore_pressure_data", [])
            time_data = curve_data.get("time_data", [])
            confining_pressure = curve_data.get("confining_pressure", 0.0)
            
            # 计算峰值强度
            peak_result = self.calculator.calculate_peak_strength(strain_data, stress_data)
            if "error" in peak_result:
                result["errors"].append(f"峰值强度计算错误: {peak_result['error']}")
            else:
                result["calculations"]["peak_strength"] = peak_result
            
            # 计算残余强度
            if "peak_strength" in result["calculations"]:
                peak_index = result["calculations"]["peak_strength"]["peak_index"]
                residual_result = self.calculator.calculate_residual_strength(
                    strain_data, stress_data, peak_index
                )
                if "error" in residual_result:
                    result["errors"].append(f"残余强度计算错误: {residual_result['error']}")
                else:
                    result["calculations"]["residual_strength"] = residual_result
            
            # 检测孔压异常
            pp_anomaly_result = self.calculator.detect_pore_pressure_anomaly(
                time_data, pore_pressure_data, confining_pressure
            )
            if "error" in pp_anomaly_result:
                result["errors"].append(f"孔压异常检测错误: {pp_anomaly_result['error']}")
            else:
                result["calculations"]["pore_pressure_anomaly"] = pp_anomaly_result
            
            # 识别破坏时刻
            failure_result = self.calculator.identify_failure_point(
                strain_data, stress_data, pore_pressure_data
            )
            if "error" in failure_result:
                result["errors"].append(f"破坏时刻识别错误: {failure_result['error']}")
            else:
                result["calculations"]["failure_point"] = failure_result
        
        # 2. 处理饱和度记录
        saturation_data = test_data.get("saturation_record")
        if saturation_data:
            saturation_check = saturation_data.get("saturation_check", {})
            b_value = saturation_check.get("final_b_value")
            if b_value is not None:
                saturation_result = self.calculator.check_saturation(b_value)
                result["calculations"]["saturation"] = {
                    **saturation_result,
                    "saturation_process": saturation_data.get("saturation_process"),
                    "original_check": saturation_check
                }
        
        # 3. 检查仪器校准风险
        instrument_info = test_data.get("instrument_info")
        if instrument_info:
            calibration_date = instrument_info.get("calibration_date")
            test_date = None
            if test_data.get("sample_info"):
                test_date = test_data["sample_info"].get("test_date")
            
            if calibration_date:
                calibration_result = self.calculator.check_calibration_risk(
                    calibration_date, test_date=test_date
                )
                result["calculations"]["instrument_calibration"] = {
                    **calibration_result,
                    "instrument_info": instrument_info
                }
        
        # 4. 应用人工改判
        manual_overrides = {}
        
        if override_peak_stress is not None:
            manual_overrides["peak_stress"] = {
                "original": result["calculations"].get("peak_strength", {}).get("peak_stress_kPa"),
                "override": override_peak_stress,
                "override_time": datetime.now().isoformat()
            }
        
        if override_residual_stress is not None:
            manual_overrides["residual_stress"] = {
                "original": result["calculations"].get("residual_strength", {}).get("residual_stress_kPa"),
                "override": override_residual_stress,
                "override_time": datetime.now().isoformat()
            }
        
        if override_failure_strain is not None:
            manual_overrides["failure_strain"] = {
                "original": result["calculations"].get("failure_point", {}).get("recommended_failure", {}).get("strain_percent"),
                "override": override_failure_strain,
                "override_time": datetime.now().isoformat()
            }
        
        if manual_judgment:
            manual_overrides["judgment"] = {
                "value": manual_judgment,
                "override_time": datetime.now().isoformat()
            }
        
        if manual_remarks:
            manual_overrides["remarks"] = {
                "value": manual_remarks,
                "override_time": datetime.now().isoformat()
            }
        
        result["manual_overrides"] = manual_overrides
        
        # 5. 生成最终判定
        result["final_judgment"] = self._generate_final_judgment(result)
        
        # 保存到内存
        self.processed_tests[test_id] = result
        
        # 保存到文件
        self.data_loader.save_processed_data(test_id, result)
        
        return result
    
    def _generate_final_judgment(self, result: Dict[str, Any]) -> Dict[str, Any]:
        """
        生成最终判定
        """
        judgment = {
            "overall_status": "待复核",
            "risk_level": "低",
            "issues": [],
            "warnings": [],
            "recommendations": [],
            "auto_judgment": "合格",
            "final_judgment": None
        }
        
        calculations = result.get("calculations", {})
        manual_overrides = result.get("manual_overrides", {})
        
        # 检查孔压异常
        pp_anomaly = calculations.get("pore_pressure_anomaly", {})
        if pp_anomaly.get("has_anomalies"):
            judgment["issues"].append(f"检测到 {pp_anomaly.get('anomaly_count', 0)} 处孔压异常")
            judgment["auto_judgment"] = "需复核"
            if pp_anomaly.get("high_severity_count", 0) > 0:
                judgment["risk_level"] = "中"
        
        # 检查饱和度
        saturation = calculations.get("saturation", {})
        if not saturation.get("is_saturated", True):
            judgment["issues"].append("试样饱和度不合格")
            judgment["auto_judgment"] = "不合格"
            judgment["risk_level"] = "高"
        
        # 检查仪器校准
        calibration = calculations.get("instrument_calibration", {})
        if calibration.get("is_expired"):
            judgment["warnings"].append("试验所用仪器校准已过期")
            judgment["auto_judgment"] = "需复核"
        elif calibration.get("is_soon_expired"):
            judgment["warnings"].append(f"试验所用仪器将在 {calibration.get('days_until_expiry')} 天后过期")
        
        # 应用人工改判
        if manual_overrides.get("judgment"):
            judgment["final_judgment"] = manual_overrides["judgment"]["value"]
        else:
            judgment["final_judgment"] = judgment["auto_judgment"]
        
        # 生成建议
        if judgment["issues"]:
            judgment["recommendations"].append("建议检查试验数据的有效性")
        if judgment["warnings"]:
            judgment["recommendations"].append("建议关注仪器校准状态")
        
        # 确定整体状态
        if judgment["final_judgment"] == "不合格":
            judgment["overall_status"] = "不合格"
        elif judgment["final_judgment"] == "需复核":
            judgment["overall_status"] = "需人工复核"
        else:
            judgment["overall_status"] = "合格"
        
        return judgment
    
    def get_processed_test(self, test_id: str) -> Optional[Dict[str, Any]]:
        """
        获取已处理的试验数据
        """
        # 先从内存获取
        if test_id in self.processed_tests:
            return self.processed_tests[test_id]
        
        # 再从文件加载
        data = self.data_loader.load_processed_data(test_id)
        if data:
            self.processed_tests[test_id] = data
            return data
        
        return None
    
    def update_manual_judgment(self, test_id: str,
                                override_peak_stress: float = None,
                                override_residual_stress: float = None,
                                override_failure_strain: float = None,
                                manual_judgment: str = None,
                                manual_remarks: str = None) -> Optional[Dict[str, Any]]:
        """
        更新人工改判
        """
        # 获取现有数据
        existing_data = self.get_processed_test(test_id)
        if not existing_data:
            # 如果没有处理过，先处理
            return self.process_test(
                test_id,
                override_peak_stress=override_peak_stress,
                override_residual_stress=override_residual_stress,
                override_failure_strain=override_failure_strain,
                manual_judgment=manual_judgment,
                manual_remarks=manual_remarks
            )
        
        # 更新人工改判
        manual_overrides = existing_data.get("manual_overrides", {})
        
        if override_peak_stress is not None:
            original = existing_data.get("calculations", {}).get("peak_strength", {}).get("peak_stress_kPa")
            manual_overrides["peak_stress"] = {
                "original": original,
                "override": override_peak_stress,
                "override_time": datetime.now().isoformat()
            }
        
        if override_residual_stress is not None:
            original = existing_data.get("calculations", {}).get("residual_strength", {}).get("residual_stress_kPa")
            manual_overrides["residual_stress"] = {
                "original": original,
                "override": override_residual_stress,
                "override_time": datetime.now().isoformat()
            }
        
        if override_failure_strain is not None:
            original = existing_data.get("calculations", {}).get("failure_point", {}).get("recommended_failure", {}).get("strain_percent")
            manual_overrides["failure_strain"] = {
                "original": original,
                "override": override_failure_strain,
                "override_time": datetime.now().isoformat()
            }
        
        if manual_judgment:
            manual_overrides["judgment"] = {
                "value": manual_judgment,
                "override_time": datetime.now().isoformat()
            }
        
        if manual_remarks:
            manual_overrides["remarks"] = {
                "value": manual_remarks,
                "override_time": datetime.now().isoformat()
            }
        
        existing_data["manual_overrides"] = manual_overrides
        existing_data["final_judgment"] = self._generate_final_judgment(existing_data)
        existing_data["last_updated"] = datetime.now().isoformat()
        
        # 保存
        self.processed_tests[test_id] = existing_data
        self.data_loader.save_processed_data(test_id, existing_data)
        
        return existing_data
    
    def export_to_markdown(self, test_id: str, output_path: str = None) -> str:
        """
        导出 Markdown 复核单
        """
        test_data = self.get_processed_test(test_id)
        if not test_data:
            raise ValueError(f"未找到试验 {test_id} 的处理数据")
        
        if output_path is None:
            if not os.path.exists(EXPORTED_DIR):
                os.makedirs(EXPORTED_DIR)
            output_path = os.path.join(EXPORTED_DIR, f"{test_id}_review.md")
        
        # 生成 Markdown 内容
        md_content = self._generate_markdown_report(test_data)
        
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(md_content)
        
        return output_path
    
    def _generate_markdown_report(self, test_data: Dict[str, Any]) -> str:
        """
        生成 Markdown 报告内容
        """
        test_id = test_data.get("test_id", "未知")
        sample_info = test_data.get("sample_info", {})
        calculations = test_data.get("calculations", {})
        manual_overrides = test_data.get("manual_overrides", {})
        final_judgment = test_data.get("final_judgment", {})
        
        decimal_places = OUTPUT_CONFIG["decimal_places"]
        
        # 生成报告
        lines = [
            f"# 三轴试验复核单 - {test_id}",
            "",
            f"**生成时间**: {test_data.get('processing_time', '未知')}",
            f"**复核状态**: {final_judgment.get('overall_status', '未知')}",
            f"**风险等级**: {final_judgment.get('risk_level', '未知')}",
            "",
            "---",
            "",
            "## 1. 试样基本信息",
            "",
        ]
        
        # 试样信息表格
        if sample_info:
            lines.extend([
                "| 项目 | 值 |",
                "|------|-----|",
                f"| 试样编号 | {sample_info.get('sample_id', '-')} |",
                f"| 试验编号 | {sample_info.get('test_id', '-')} |",
                f"| 试样名称 | {sample_info.get('sample_name', '-')} |",
                f"| 土类 | {sample_info.get('soil_type', '-')} |",
                f"| 埋深 (m) | {sample_info.get('depth', '-')} |",
                f"| 含水率 (%) | {sample_info.get('water_content', '-')} |",
                f"| 密度 (g/cm³) | {sample_info.get('density', '-')} |",
                f"| 试验日期 | {sample_info.get('test_date', '-')} |",
                f"| 操作人员 | {sample_info.get('operator', '-')} |",
                f"| 备注 | {sample_info.get('remarks', '-')} |",
                "",
            ])
        
        # 2. 强度参数计算结果
        lines.extend([
            "## 2. 强度参数计算结果",
            "",
        ])
        
        peak_strength = calculations.get("peak_strength", {})
        residual_strength = calculations.get("residual_strength", {})
        
        lines.extend([
            "| 参数 | 自动计算值 | 人工改判值 | 单位 |",
            "|------|-----------|-----------|------|",
        ])
        
        # 峰值强度
        peak_auto = peak_strength.get('peak_stress_kPa')
        peak_override = manual_overrides.get('peak_stress', {}).get('override')
        peak_display = round(peak_auto, decimal_places) if peak_auto is not None else '-'
        peak_override_display = round(peak_override, decimal_places) if peak_override is not None else '-'
        
        lines.append(f"| 峰值强度 | {peak_display} | {peak_override_display} | kPa |")
        
        # 峰值应变
        peak_strain_auto = peak_strength.get('peak_strain_percent')
        peak_strain_display = round(peak_strain_auto, decimal_places) if peak_strain_auto is not None else '-'
        lines.append(f"| 峰值应变 | {peak_strain_display} | - | % |")
        
        # 残余强度
        residual_auto = residual_strength.get('residual_stress_kPa')
        residual_override = manual_overrides.get('residual_stress', {}).get('override')
        residual_display = round(residual_auto, decimal_places) if residual_auto is not None else '-'
        residual_override_display = round(residual_override, decimal_places) if residual_override is not None else '-'
        
        lines.append(f"| 残余强度 | {residual_display} | {residual_override_display} | kPa |")
        
        lines.append("")
        
        # 3. 破坏时刻识别
        lines.extend([
            "## 3. 破坏时刻识别",
            "",
        ])
        
        failure_point = calculations.get("failure_point", {})
        recommended = failure_point.get("recommended_failure", {})
        
        if recommended:
            lines.extend([
                f"- **推荐破坏准则**: {recommended.get('criterion', '-')}",
                f"- **破坏应变**: {round(recommended.get('strain_percent', 0), decimal_places)} %",
                f"- **破坏应力**: {round(recommended.get('stress_kPa', 0), decimal_places)} kPa",
                "",
                "### 破坏准则对比",
                "",
            ])
            
            # 破坏准则表格
            criteria = failure_point.get("failure_criteria", [])
            if criteria:
                lines.extend([
                    "| 准则 | 应变 (%) | 应力 (kPa) | 说明 |",
                    "|------|----------|-----------|------|",
                ])
                for c in criteria:
                    if "status" in c:
                        lines.append(f"| {c.get('criterion', '-')} | - | - | {c.get('description', '-')} |")
                    else:
                        lines.append(f"| {c.get('criterion', '-')} | {round(c.get('strain_percent', 0), decimal_places)} | {round(c.get('stress_kPa', 0), decimal_places)} | {c.get('description', '-')} |")
                lines.append("")
        
        # 4. 孔压异常检测
        lines.extend([
            "## 4. 孔压异常检测",
            "",
        ])
        
        pp_anomaly = calculations.get("pore_pressure_anomaly", {})
        has_anomalies = pp_anomaly.get("has_anomalies", False)
        
        if has_anomalies:
            lines.extend([
                f"- **异常状态**: ⚠️ 检测到异常",
                f"- **异常数量**: {pp_anomaly.get('anomaly_count', 0)} 处",
                f"- **高严重度异常**: {pp_anomaly.get('high_severity_count', 0)} 处",
                "",
                "### 异常详情",
                "",
            ])
            
            anomalies = pp_anomaly.get("anomalies", [])
            if anomalies:
                lines.extend([
                    "| 类型 | 时间 (s) | 孔压 (kPa) | 变化量 (kPa) | 严重度 |",
                    "|------|----------|-----------|-------------|--------|",
                ])
                for a in anomalies:
                    lines.append(f"| {a.get('type', '-')} | {a.get('time_s', '-')} | {round(a.get('pore_pressure_kPa', 0), decimal_places)} | {round(a.get('change_kPa', 0), decimal_places) if a.get('change_kPa') else '-'} | {a.get('severity', '-')} |")
                lines.append("")
        else:
            lines.extend([
                "- **异常状态**: ✅ 未检测到异常",
                "",
            ])
        
        # 5. 饱和度检查
        saturation = calculations.get("saturation", {})
        if saturation:
            lines.extend([
                "## 5. 饱和度检查",
                "",
                f"- **B值**: {round(saturation.get('b_value', 0), decimal_places)}",
                f"- **阈值**: {round(saturation.get('threshold', 0), decimal_places)}",
                f"- **状态**: {saturation.get('status', '-')}",
                f"- **判定**: {saturation.get('description', '-')}",
                "",
            ])
        
        # 6. 仪器校准检查
        calibration = calculations.get("instrument_calibration", {})
        if calibration:
            lines.extend([
                "## 6. 仪器校准检查",
                "",
            ])
            
            inst_info = calibration.get("instrument_info", {})
            lines.extend([
                f"- **仪器编号**: {inst_info.get('instrument_id', '-')}",
                f"- **仪器名称**: {inst_info.get('instrument_name', '-')}",
                f"- **型号**: {inst_info.get('model', '-')}",
                f"- **校准日期**: {calibration.get('calibration_date', '-')}",
                f"- **有效期至**: {calibration.get('expiry_date', '-')}",
                f"- **距过期天数**: {calibration.get('days_until_expiry', '-')} 天",
                f"- **状态**: {calibration.get('status', '-')}",
                f"- **风险等级**: {calibration.get('risk_level', '-')}",
                "",
            ])
        
        # 7. 人工改判记录
        if manual_overrides:
            lines.extend([
                "## 7. 人工改判记录",
                "",
            ])
            
            for key, value in manual_overrides.items():
                if key == "judgment":
                    lines.append(f"- **人工判定**: {value.get('value', '-')}")
                elif key == "remarks":
                    lines.append(f"- **人工备注**: {value.get('value', '-')}")
                elif key == "peak_stress":
                    lines.append(f"- **峰值强度改判**: {value.get('original', '-')} → {value.get('override', '-')} kPa")
                elif key == "residual_stress":
                    lines.append(f"- **残余强度改判**: {value.get('original', '-')} → {value.get('override', '-')} kPa")
                elif key == "failure_strain":
                    lines.append(f"- **破坏应变改判**: {value.get('original', '-')} → {value.get('override', '-')} %")
                lines.append(f"  - 改判时间: {value.get('override_time', '-')}")
            
            lines.append("")
        
        # 8. 最终判定
        lines.extend([
            "## 8. 最终判定",
            "",
            f"- **整体状态**: {final_judgment.get('overall_status', '-')}",
            f"- **风险等级**: {final_judgment.get('risk_level', '-')}",
            f"- **自动判定**: {final_judgment.get('auto_judgment', '-')}",
            f"- **最终判定**: {final_judgment.get('final_judgment', '-')}",
            "",
        ])
        
        # 问题和警告
        issues = final_judgment.get("issues", [])
        warnings = final_judgment.get("warnings", [])
        recommendations = final_judgment.get("recommendations", [])
        
        if issues:
            lines.extend([
                "### 问题",
                "",
            ])
            for i, issue in enumerate(issues, 1):
                lines.append(f"{i}. {issue}")
            lines.append("")
        
        if warnings:
            lines.extend([
                "### 警告",
                "",
            ])
            for i, warning in enumerate(warnings, 1):
                lines.append(f"{i}. {warning}")
            lines.append("")
        
        if recommendations:
            lines.extend([
                "### 建议",
                "",
            ])
            for i, rec in enumerate(recommendations, 1):
                lines.append(f"{i}. {rec}")
            lines.append("")
        
        # 页脚
        lines.extend([
            "---",
            "",
            "*本复核单由三轴试验复核工具自动生成*",
        ])
        
        return "\n".join(lines)
    
    def export_to_json(self, test_id: str, output_path: str = None) -> str:
        """
        导出 JSON 明细
        """
        test_data = self.get_processed_test(test_id)
        if not test_data:
            raise ValueError(f"未找到试验 {test_id} 的处理数据")
        
        if output_path is None:
            if not os.path.exists(EXPORTED_DIR):
                os.makedirs(EXPORTED_DIR)
            output_path = os.path.join(EXPORTED_DIR, f"{test_id}_details.json")
        
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(test_data, f, ensure_ascii=False, indent=2, default=str)
        
        return output_path
    
    def list_all_processed_tests(self) -> List[str]:
        """
        列出所有已处理的试验
        """
        # 从文件系统扫描
        import glob
        
        pattern = os.path.join(self.data_loader.data_dir if hasattr(self.data_loader, 'data_dir') else 'data/processed', "*_processed.json")
        files = glob.glob(pattern)
        
        tests = set(self.processed_tests.keys())
        
        for f in files:
            filename = os.path.basename(f)
            test_id = filename.replace("_processed.json", "")
            tests.add(test_id)
        
        return sorted(list(tests))
