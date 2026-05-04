import os
import re
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime
from config import PodcastProgram, config
import logging

logger = logging.getLogger(__name__)

# 尝试导入可选依赖
try:
    from PIL import Image
    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False
    logger.warning("Pillow 库未安装，封面尺寸检查将不可用")

try:
    from mutagen import File as MutagenFile
    MUTAGEN_AVAILABLE = True
except ImportError:
    MUTAGEN_AVAILABLE = False
    logger.warning("mutagen 库未安装，音频时长检查将不可用")

try:
    import srt
    SRT_AVAILABLE = True
except ImportError:
    SRT_AVAILABLE = False
    logger.warning("srt 库未安装，字幕同步检查将不可用")


class Checker:
    """检查器，用于执行各种播客节目文件检查规则"""
    
    def __init__(self):
        pass
    
    def check_program(self, program_info: Dict[str, Any]) -> Dict[str, Any]:
        """
        检查单个节目文件夹
        
        Args:
            program_info: 节目信息字典（来自 FileScanner.scan_directory）
            
        Returns:
            包含检查结果的字典
        """
        program_id = program_info["program_id"]
        program_name = program_info["program_name"]
        folder_name = program_info["folder_name"]
        folder_path = program_info["folder_path"]
        files = program_info["files"]
        config_dict = program_info["config"]
        
        # 构建节目配置对象
        program_config = PodcastProgram(
            name=config_dict["name"],
            folder_pattern=config_dict["folder_pattern"],
            required_files=config_dict["required_files"],
            audio_extensions=config_dict["audio_extensions"],
            subtitle_extensions=config_dict["subtitle_extensions"],
            cover_extensions=config_dict["cover_extensions"],
            notes_extensions=config_dict["notes_extensions"],
            edit_list_extensions=config_dict["edit_list_extensions"],
            check_audio_duration=config_dict["check_audio_duration"],
            check_subtitle_sync=config_dict["check_subtitle_sync"],
            check_cover_dimensions=config_dict["check_cover_dimensions"],
            check_notes_confirmed=config_dict["check_notes_confirmed"],
            expected_cover_width=config_dict["expected_cover_width"],
            expected_cover_height=config_dict["expected_cover_height"],
            min_audio_duration=config_dict["min_audio_duration"],
            max_audio_duration=config_dict["max_audio_duration"],
            subtitle_sync_tolerance=config_dict["subtitle_sync_tolerance"],
            confirmation_keywords=config_dict["confirmation_keywords"]
        )
        
        # 执行各项检查
        checks = []
        
        # 1. 检查必需文件是否存在
        file_checks = self._check_required_files(files, program_config)
        checks.extend(file_checks)
        
        # 2. 检查音频文件
        audio_checks = self._check_audio_files(files["audio"], program_config)
        checks.extend(audio_checks)
        
        # 3. 检查字幕文件
        subtitle_checks = self._check_subtitle_files(files["subtitles"], program_config)
        checks.extend(subtitle_checks)
        
        # 4. 检查封面文件
        cover_checks = self._check_cover_files(files["covers"], program_config)
        checks.extend(cover_checks)
        
        # 5. 检查备注文件
        notes_checks = self._check_notes_files(files["notes"], program_config)
        checks.extend(notes_checks)
        
        # 6. 检查剪辑单
        edit_list_checks = self._check_edit_lists(files["edit_lists"], program_config)
        checks.extend(edit_list_checks)
        
        # 统计检查结果
        total_checks = len(checks)
        passed_checks = sum(1 for c in checks if c["status"] == "passed")
        failed_checks = sum(1 for c in checks if c["status"] == "failed")
        warning_checks = sum(1 for c in checks if c["status"] == "warning")
        
        # 确定整体状态
        if failed_checks > 0:
            overall_status = "failed"
        elif warning_checks > 0:
            overall_status = "warning"
        elif passed_checks == total_checks:
            overall_status = "passed"
        else:
            overall_status = "unknown"
        
        return {
            "program_id": program_id,
            "program_name": program_name,
            "folder_name": folder_name,
            "folder_path": folder_path,
            "check_time": datetime.now().isoformat(),
            "scan_time": program_info["scan_time"],
            "overall_status": overall_status,
            "stats": {
                "total": total_checks,
                "passed": passed_checks,
                "failed": failed_checks,
                "warning": warning_checks
            },
            "checks": checks,
            "files": files
        }
    
    def _check_required_files(self, files: Dict[str, Any], config: PodcastProgram) -> List[Dict[str, Any]]:
        """检查必需文件是否存在"""
        results = []
        
        # 检查是否有音频文件
        if not files["audio"]:
            results.append({
                "type": "file_existence",
                "file_type": "audio",
                "status": "failed",
                "message": "缺少音频文件",
                "severity": "high"
            })
        else:
            results.append({
                "type": "file_existence",
                "file_type": "audio",
                "status": "passed",
                "message": f"找到 {len(files['audio'])} 个音频文件",
                "severity": "info"
            })
        
        # 检查是否有字幕文件（如果配置要求检查）
        if config.check_subtitle_sync:
            if not files["subtitles"]:
                results.append({
                    "type": "file_existence",
                    "file_type": "subtitle",
                    "status": "failed",
                    "message": "缺少字幕文件",
                    "severity": "high"
                })
            else:
                results.append({
                    "type": "file_existence",
                    "file_type": "subtitle",
                    "status": "passed",
                    "message": f"找到 {len(files['subtitles'])} 个字幕文件",
                    "severity": "info"
                })
        
        # 检查是否有封面文件
        if not files["covers"]:
            results.append({
                "type": "file_existence",
                "file_type": "cover",
                "status": "failed",
                "message": "缺少封面文件",
                "severity": "high"
            })
        else:
            results.append({
                "type": "file_existence",
                "file_type": "cover",
                "status": "passed",
                "message": f"找到 {len(files['covers'])} 个封面文件",
                "severity": "info"
            })
        
        # 检查是否有备注文件
        if not files["notes"]:
            results.append({
                "type": "file_existence",
                "file_type": "notes",
                "status": "warning",
                "message": "缺少备注文件",
                "severity": "medium"
            })
        else:
            results.append({
                "type": "file_existence",
                "file_type": "notes",
                "status": "passed",
                "message": f"找到 {len(files['notes'])} 个备注文件",
                "severity": "info"
            })
        
        return results
    
    def _check_audio_files(self, audio_files: List[Dict[str, Any]], config: PodcastProgram) -> List[Dict[str, Any]]:
        """检查音频文件"""
        results = []
        
        if not audio_files:
            return results
        
        # 检查每个音频文件
        for audio_file in audio_files:
            file_path = audio_file["path"]
            file_name = audio_file["name"]
            
            # 检查音频时长
            if config.check_audio_duration and MUTAGEN_AVAILABLE:
                try:
                    audio = MutagenFile(file_path)
                    if audio and hasattr(audio, 'info') and hasattr(audio.info, 'length'):
                        duration = audio.info.length
                        
                        if duration < config.min_audio_duration:
                            results.append({
                                "type": "audio_duration",
                                "file": file_name,
                                "status": "failed",
                                "message": f"音频时长过短: {duration:.2f} 秒，最短要求: {config.min_audio_duration} 秒",
                                "actual": duration,
                                "min": config.min_audio_duration,
                                "severity": "high"
                            })
                        elif duration > config.max_audio_duration:
                            results.append({
                                "type": "audio_duration",
                                "file": file_name,
                                "status": "warning",
                                "message": f"音频时长过长: {duration:.2f} 秒，最长建议: {config.max_audio_duration} 秒",
                                "actual": duration,
                                "max": config.max_audio_duration,
                                "severity": "medium"
                            })
                        else:
                            results.append({
                                "type": "audio_duration",
                                "file": file_name,
                                "status": "passed",
                                "message": f"音频时长正常: {duration:.2f} 秒",
                                "actual": duration,
                                "severity": "info"
                            })
                    else:
                        results.append({
                            "type": "audio_duration",
                            "file": file_name,
                            "status": "warning",
                            "message": "无法获取音频时长信息",
                            "severity": "low"
                        })
                except Exception as e:
                    results.append({
                        "type": "audio_duration",
                        "file": file_name,
                        "status": "warning",
                        "message": f"检查音频时长时出错: {str(e)}",
                        "severity": "low"
                    })
            elif config.check_audio_duration and not MUTAGEN_AVAILABLE:
                results.append({
                    "type": "audio_duration",
                    "file": file_name,
                    "status": "warning",
                    "message": "mutagen 库未安装，无法检查音频时长",
                    "severity": "low"
                })
        
        return results
    
    def _check_subtitle_files(self, subtitle_files: List[Dict[str, Any]], config: PodcastProgram) -> List[Dict[str, Any]]:
        """检查字幕文件"""
        results = []
        
        if not subtitle_files:
            return results
        
        # 检查每个字幕文件
        for subtitle_file in subtitle_files:
            file_path = subtitle_file["path"]
            file_name = subtitle_file["name"]
            file_ext = os.path.splitext(file_name)[1].lower()
            
            # 检查 SRT 格式字幕
            if file_ext == ".srt" and SRT_AVAILABLE:
                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        content = f.read()
                    
                    # 解析字幕
                    subs = list(srt.parse(content))
                    
                    if not subs:
                        results.append({
                            "type": "subtitle_content",
                            "file": file_name,
                            "status": "warning",
                            "message": "字幕文件为空或格式不正确",
                            "severity": "medium"
                        })
                    else:
                        # 检查字幕时间范围
                        first_sub = subs[0]
                        last_sub = subs[-1]
                        
                        results.append({
                            "type": "subtitle_content",
                            "file": file_name,
                            "status": "passed",
                            "message": f"字幕文件正常，共 {len(subs)} 条字幕，时间范围: {first_sub.start} -> {last_sub.end}",
                            "subtitle_count": len(subs),
                            "start_time": str(first_sub.start),
                            "end_time": str(last_sub.end),
                            "severity": "info"
                        })
                        
                        # 检查字幕同步（如果有音频文件）
                        # 这里简化处理，实际应用中需要与音频时长对比
                        # 可以在状态管理中关联音频和字幕检查结果
                        
                except Exception as e:
                    results.append({
                        "type": "subtitle_content",
                        "file": file_name,
                        "status": "warning",
                        "message": f"解析字幕文件时出错: {str(e)}",
                        "severity": "medium"
                    })
            elif file_ext == ".srt" and not SRT_AVAILABLE:
                results.append({
                    "type": "subtitle_content",
                    "file": file_name,
                    "status": "warning",
                    "message": "srt 库未安装，无法详细检查 SRT 字幕",
                    "severity": "low"
                })
            else:
                # 对于其他字幕格式，只检查文件是否非空
                try:
                    file_size = os.path.getsize(file_path)
                    if file_size == 0:
                        results.append({
                            "type": "subtitle_content",
                            "file": file_name,
                            "status": "warning",
                            "message": "字幕文件为空",
                            "severity": "medium"
                        })
                    else:
                        results.append({
                            "type": "subtitle_content",
                            "file": file_name,
                            "status": "passed",
                            "message": f"字幕文件存在，大小: {file_size} 字节",
                            "severity": "info"
                        })
                except Exception as e:
                    results.append({
                        "type": "subtitle_content",
                        "file": file_name,
                        "status": "warning",
                        "message": f"检查字幕文件时出错: {str(e)}",
                        "severity": "low"
                    })
        
        return results
    
    def _check_cover_files(self, cover_files: List[Dict[str, Any]], config: PodcastProgram) -> List[Dict[str, Any]]:
        """检查封面文件"""
        results = []
        
        if not cover_files:
            return results
        
        # 检查每个封面文件
        for cover_file in cover_files:
            file_path = cover_file["path"]
            file_name = cover_file["name"]
            
            # 检查封面尺寸
            if config.check_cover_dimensions and PIL_AVAILABLE:
                try:
                    with Image.open(file_path) as img:
                        width, height = img.size
                        expected_width = config.expected_cover_width
                        expected_height = config.expected_cover_height
                        
                        # 检查是否为正方形
                        is_square = width == height
                        # 检查尺寸是否符合要求
                        size_ok = width == expected_width and height == expected_height
                        # 检查分辨率是否足够（至少达到要求的70%）
                        resolution_ok = width >= expected_width * 0.7 and height >= expected_height * 0.7
                        
                        if size_ok:
                            results.append({
                                "type": "cover_dimensions",
                                "file": file_name,
                                "status": "passed",
                                "message": f"封面尺寸正确: {width}x{height}",
                                "actual": {"width": width, "height": height},
                                "expected": {"width": expected_width, "height": expected_height},
                                "severity": "info"
                            })
                        elif is_square and resolution_ok:
                            results.append({
                                "type": "cover_dimensions",
                                "file": file_name,
                                "status": "warning",
                                "message": f"封面尺寸为 {width}x{height}（正方形），建议使用 {expected_width}x{expected_height}",
                                "actual": {"width": width, "height": height},
                                "expected": {"width": expected_width, "height": expected_height},
                                "severity": "low"
                            })
                        else:
                            results.append({
                                "type": "cover_dimensions",
                                "file": file_name,
                                "status": "failed",
                                "message": f"封面尺寸不符合要求: {width}x{height}，应为 {expected_width}x{expected_height}",
                                "actual": {"width": width, "height": height},
                                "expected": {"width": expected_width, "height": expected_height},
                                "severity": "high"
                            })
                except Exception as e:
                    results.append({
                        "type": "cover_dimensions",
                        "file": file_name,
                        "status": "warning",
                        "message": f"检查封面尺寸时出错: {str(e)}",
                        "severity": "low"
                    })
            elif config.check_cover_dimensions and not PIL_AVAILABLE:
                results.append({
                    "type": "cover_dimensions",
                    "file": file_name,
                    "status": "warning",
                    "message": "Pillow 库未安装，无法检查封面尺寸",
                    "severity": "low"
                })
        
        return results
    
    def _check_notes_files(self, notes_files: List[Dict[str, Any]], config: PodcastProgram) -> List[Dict[str, Any]]:
        """检查备注文件"""
        results = []
        
        if not notes_files:
            return results
        
        # 检查每个备注文件
        for notes_file in notes_files:
            file_path = notes_file["path"]
            file_name = notes_file["name"]
            file_ext = os.path.splitext(file_name)[1].lower()
            
            # 检查是否包含确认关键词
            if config.check_notes_confirmed:
                # 只检查文本文件
                if file_ext in [".txt", ".md"]:
                    try:
                        with open(file_path, 'r', encoding='utf-8') as f:
                            content = f.read().lower()
                        
                        # 检查是否包含确认关键词
                        has_confirmation = any(
                            keyword.lower() in content 
                            for keyword in config.confirmation_keywords
                        )
                        
                        if has_confirmation:
                            results.append({
                                "type": "notes_confirmation",
                                "file": file_name,
                                "status": "passed",
                                "message": "备注文件包含确认信息",
                                "severity": "info"
                            })
                        else:
                            results.append({
                                "type": "notes_confirmation",
                                "file": file_name,
                                "status": "warning",
                                "message": f"备注文件未包含确认关键词（{', '.join(config.confirmation_keywords)}）",
                                "severity": "medium"
                            })
                    except Exception as e:
                        results.append({
                            "type": "notes_confirmation",
                            "file": file_name,
                            "status": "warning",
                            "message": f"检查备注文件时出错: {str(e)}",
                            "severity": "low"
                        })
                else:
                    results.append({
                        "type": "notes_confirmation",
                        "file": file_name,
                        "status": "warning",
                        "message": f"无法检查 {file_ext} 格式的备注文件确认状态",
                        "severity": "low"
                    })
        
        return results
    
    def _check_edit_lists(self, edit_lists: List[Dict[str, Any]], config: PodcastProgram) -> List[Dict[str, Any]]:
        """检查剪辑单"""
        results = []
        
        if not edit_lists:
            # 剪辑单不是必需的，但可以提示
            results.append({
                "type": "edit_list",
                "file": None,
                "status": "info",
                "message": "未找到剪辑单文件",
                "severity": "info"
            })
            return results
        
        # 检查每个剪辑单文件
        for edit_list in edit_lists:
            file_path = edit_list["path"]
            file_name = edit_list["name"]
            
            # 检查文件是否非空
            try:
                file_size = os.path.getsize(file_path)
                if file_size == 0:
                    results.append({
                        "type": "edit_list",
                        "file": file_name,
                        "status": "warning",
                        "message": "剪辑单文件为空",
                        "severity": "medium"
                    })
                else:
                    results.append({
                        "type": "edit_list",
                        "file": file_name,
                        "status": "passed",
                        "message": f"剪辑单文件存在，大小: {file_size} 字节",
                        "severity": "info"
                    })
            except Exception as e:
                results.append({
                    "type": "edit_list",
                    "file": file_name,
                    "status": "warning",
                    "message": f"检查剪辑单文件时出错: {str(e)}",
                    "severity": "low"
                })
        
        return results
