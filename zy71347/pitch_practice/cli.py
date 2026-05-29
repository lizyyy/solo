#!/usr/bin/env python3

import argparse
import json
import os
import sys
from datetime import datetime
from typing import Dict, List, Optional

from .models import (
    Provenance, TargetPitch, Recording, RhythmSegment,
    PitchFrame, PracticeSession, PracticeReport,
    save_json, _gen_id, _now_iso,
)
from .masking import mask_dict
from .pitch_detector import detect_pitch, midi_to_freq, freq_to_midi
from .error_curve import (
    compute_segment_scores, compute_overall_score, plot_error_curve,
)
from .edge_cases import (
    check_environmental_noise, check_octave_misjudgment, check_recording_too_short,
)
from .profile_manager import ProfileManager
from .comment_manager import CommentManager
from .report_exporter import ReportExporter


def _parse_exercise(exercise_path: str) -> Dict:
    with open(exercise_path, "r", encoding="utf-8") as f:
        return json.load(f)


def _find_audio(input_dir: str) -> Optional[str]:
    for ext in (".wav", ".WAV", ".flac", ".FLAC", ".ogg", ".OGG"):
        for fname in os.listdir(input_dir):
            if fname.endswith(ext):
                return os.path.join(input_dir, fname)
    return None


def _find_exercise(input_dir: str) -> Optional[str]:
    for fname in os.listdir(input_dir):
        if fname in ("exercise.json", "exercise.JSON"):
            return os.path.join(input_dir, fname)
    return None


def _find_student_info(input_dir: str) -> Optional[Dict]:
    for fname in os.listdir(input_dir):
        if fname in ("student.json", "student.JSON"):
            path = os.path.join(input_dir, fname)
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
    return None


def cmd_analyze(args: argparse.Namespace) -> int:
    input_dir = os.path.abspath(args.input_dir)
    output_dir = os.path.abspath(args.output_dir)

    if not os.path.isdir(input_dir):
        print(f"错误: 输入目录不存在: {input_dir}", file=sys.stderr)
        return 1

    exercise_path = _find_exercise(input_dir)
    if not exercise_path:
        print("错误: 输入目录中未找到 exercise.json", file=sys.stderr)
        return 1

    audio_path = _find_audio(input_dir)
    if not audio_path:
        print("错误: 输入目录中未找到音频文件 (.wav/.flac/.ogg)", file=sys.stderr)
        return 1

    exercise = _parse_exercise(exercise_path)
    bpm = exercise.get("bpm", 80)
    beat_duration = 60.0 / bpm

    provenance = Provenance(source="cli_analyze")
    run_id = provenance.run_id

    session_dir = os.path.join(output_dir, "sessions", run_id)
    os.makedirs(session_dir, exist_ok=True)

    targets = []
    segments = []
    for seg_data in exercise.get("segments", []):
        midi = seg_data.get("midi_note", 60)
        freq = midi_to_freq(midi)
        target = TargetPitch(
            label=seg_data.get("label", "?"),
            midi_note=midi,
            frequency=freq,
            start_beat=seg_data.get("start_beat", 0),
            end_beat=seg_data.get("end_beat", 1),
            provenance=Provenance(source=f"exercise:{exercise_path}"),
        )
        targets.append(target)
        segment = RhythmSegment(
            label=seg_data.get("label", "?"),
            start_time=seg_data.get("start_beat", 0) * beat_duration,
            end_time=seg_data.get("end_beat", 1) * beat_duration,
            beat_start=seg_data.get("start_beat", 0),
            beat_end=seg_data.get("end_beat", 1),
            provenance=Provenance(source=f"exercise:{exercise_path}"),
        )
        segments.append(segment)

    print(f"正在分析音频: {os.path.basename(audio_path)}")
    pitch_frames, sample_rate, duration = detect_pitch(audio_path)

    student_info = _find_student_info(input_dir)
    student_id = ""
    student_name = ""
    student_age = None
    student_level = None
    if student_info:
        student_id = student_info.get("student_id", "")
        student_name = student_info.get("student_name", "")
        student_age = student_info.get("age")
        student_level = student_info.get("level")

    recording = Recording(
        file_path=audio_path,
        duration=duration,
        sample_rate=sample_rate,
        student_id=student_id,
        provenance=Provenance(source=f"audio:{audio_path}"),
    )

    edge_warnings = []

    short_check = check_recording_too_short(
        duration,
        expected_duration=segments[-1].end_time if segments else None,
    )
    if short_check:
        edge_warnings.append(short_check.to_dict())
        print(f"[{short_check.severity}] {short_check.message}")
        print(f"  建议: {short_check.suggestion}")

    valid_frames = sum(1 for f in pitch_frames if f.frequency > 0)
    total_frames = len(pitch_frames)
    noise_check = check_environmental_noise(
        rms=0.0,
        pitch_frames_count=valid_frames,
        total_frames=total_frames,
    )
    if noise_check:
        edge_warnings.append(noise_check.to_dict())
        print(f"[{noise_check.severity}] {noise_check.message}")
        print(f"  建议: {noise_check.suggestion}")

    segment_scores, error_stats = compute_segment_scores(
        pitch_frames, targets, segments, bpm,
    )

    seg_error_list = [
        (s["label"], s["avg_cents_error"], s["max_cents_error"])
        for s in segment_scores
        if s["detected_count"] > 0
    ]
    octave_check = check_octave_misjudgment(seg_error_list)
    if octave_check:
        edge_warnings.append(octave_check.to_dict())
        print(f"[{octave_check.severity}] {octave_check.message}")
        print(f"  建议: {octave_check.suggestion}")

    overall_score = compute_overall_score(error_stats)

    session = PracticeSession(
        session_id=run_id,
        student_id=student_id,
        recording=recording,
        targets=targets,
        segments=segments,
        pitch_frames=pitch_frames,
        provenance=provenance,
    )

    metadata = {
        "session_id": run_id,
        "created_at": _now_iso(),
        "student_id": student_id,
        "audio_file": os.path.basename(audio_path),
        "exercise_file": os.path.basename(exercise_path),
        "duration": round(duration, 2),
        "bpm": bpm,
        "provenance": provenance.to_dict(),
    }
    save_json(metadata, os.path.join(session_dir, "metadata.json"))
    save_json(session.to_dict(masked=True), os.path.join(session_dir, "session.json"))

    curve_path = os.path.join(session_dir, "error_curve.png")
    try:
        plot_error_curve(pitch_frames, targets, segments, bpm, curve_path)
        print(f"误差曲线已保存: {curve_path}")
    except Exception as e:
        print(f"警告: 无法生成误差曲线图: {e}", file=sys.stderr)
        curve_path = ""

    report = PracticeReport(
        report_id=_gen_id(),
        session_id=run_id,
        student_id=student_id,
        overall_score=overall_score,
        segment_scores=segment_scores,
        error_stats=error_stats,
        edge_case_warnings=edge_warnings,
        comment_ids=[],
        provenance=Provenance(source="cli_analyze"),
    )

    exporter = ReportExporter(output_dir)
    fmt = getattr(args, "format", "json")
    report_path = exporter.save_report(report, fmt=fmt)

    if student_id:
        pm = ProfileManager(output_dir)
        pm.create_or_update(
            student_id=student_id,
            student_name=student_name,
            age=student_age,
            level=student_level,
            session_id=run_id,
        )

    print()
    print("=" * 50)
    print("  练习分析结果")
    print("=" * 50)
    display_data = mask_dict(report.to_dict(masked=True))
    print(f"综合评分: {display_data['overall_score']:.1f} / 100")
    print()
    for seg in display_data.get("segment_scores", []):
        direction = seg.get("direction", "")
        direction_text = f" ({direction})" if direction and direction != "准确" else ""
        print(
            f"  {seg.get('label', '?'):>4s} | "
            f"偏差: {seg.get('avg_cents_error', 0):+.1f}音分{direction_text} | "
            f"准确度: {seg.get('accuracy', '?')}"
        )
    if edge_warnings:
        print()
        print("注意事项:")
        for w in edge_warnings:
            print(f"  [{w.get('severity', '?')}] {w.get('message', '')}")

    print()
    print(f"会话ID: {run_id}")
    print(f"会话目录: {session_dir}")
    print(f"报告路径: {report_path}")
    if curve_path:
        print(f"曲线图片: {curve_path}")

    return 0 if not any(w.get("severity") == "critical" for w in edge_warnings) else 2


def cmd_profile(args: argparse.Namespace) -> int:
    output_dir = os.path.abspath(args.output_dir)
    pm = ProfileManager(output_dir)

    if args.action == "list":
        profiles = pm.list_profiles()
        if not profiles:
            print("暂无学生档案")
            return 0
        for p in profiles:
            masked = mask_dict(p)
            print(f"  {masked['student_id']} | {masked.get('student_name', '?')} | "
                  f"等级: {masked.get('level', '?')} | 练习次数: {len(p.get('session_ids', []))}")
        return 0

    if args.action == "show":
        profile = pm.get(args.student_id)
        if not profile:
            print(f"未找到学生档案: {args.student_id}", file=sys.stderr)
            return 1
        masked = mask_dict(profile.to_dict(masked=True))
        print(f"学生ID: {masked['student_id']}")
        print(f"姓名: {masked.get('student_name', '?')}")
        print(f"年龄: {masked.get('age', '?')}")
        print(f"等级: {masked.get('level', '?')}")
        print(f"创建时间: {masked.get('created_at', '?')}")
        print(f"练习次数: {len(profile.session_ids)}")

        sessions_dir = os.path.join(output_dir, "sessions")
        history = pm.get_history(args.student_id, sessions_dir)
        if history:
            print("\n练习历史:")
            for h in history:
                print(f"  {h.get('session_id', '?')} | {h.get('created_at', '?')} | "
                      f"时长: {h.get('duration', '?')}s")
        return 0

    if args.action == "create":
        profile = pm.create_or_update(
            student_id=args.student_id,
            student_name=args.name,
            age=args.age,
            level=args.level,
        )
        print(f"学生档案已创建: {profile.student_id}")
        return 0

    print(f"未知操作: {args.action}", file=sys.stderr)
    return 1


def cmd_comment(args: argparse.Namespace) -> int:
    output_dir = os.path.abspath(args.output_dir)
    cm = CommentManager(output_dir)

    if args.action == "add":
        comment = cm.add(
            student_id=args.student_id,
            session_id=args.session_id,
            teacher_name=args.teacher,
            content=args.text,
        )
        print(f"点评已保存: {comment.comment_id}")
        return 0

    if args.action == "list":
        if args.session_id:
            comments = cm.list_by_session(args.session_id)
        elif args.student_id:
            comments = cm.list_by_student(args.student_id)
        else:
            print("请指定 --session-id 或 --student-id", file=sys.stderr)
            return 1

        if not comments:
            print("暂无点评")
            return 0

        for c in comments:
            masked = mask_dict(c)
            print(f"  {masked['comment_id']} | "
                  f"{masked.get('teacher_name', '?')} | "
                  f"{masked.get('created_at', '?')}")
            print(f"    {masked.get('content', '')}")
        return 0

    print(f"未知操作: {args.action}", file=sys.stderr)
    return 1


def cmd_report(args: argparse.Namespace) -> int:
    output_dir = os.path.abspath(args.output_dir)
    exporter = ReportExporter(output_dir)

    if args.action == "list":
        reports = exporter.list_reports()
        if not reports:
            print("暂无报告")
            return 0
        for r in reports:
            masked = mask_dict(r)
            print(f"  {masked['report_id']} | 会话: {masked.get('session_id', '?')} | "
                  f"评分: {masked.get('overall_score', '?')}")
        return 0

    if args.action == "export":
        report_data = exporter.load_report(args.report_id)
        if not report_data:
            print(f"未找到报告: {args.report_id}", file=sys.stderr)
            return 1

        report = PracticeReport(
            report_id=report_data["report_id"],
            session_id=report_data["session_id"],
            student_id=report_data["student_id"],
            overall_score=report_data["overall_score"],
            segment_scores=report_data.get("segment_scores", []),
            error_stats=report_data.get("error_stats", {}),
            edge_case_warnings=report_data.get("edge_case_warnings", []),
            comment_ids=report_data.get("comment_ids", []),
            provenance=Provenance.from_dict(report_data.get("provenance", {})),
        )

        fmt = args.format
        path = exporter.save_report(report, fmt=fmt)
        print(f"报告已导出: {path} (格式: {fmt})")
        return 0

    if args.action == "show":
        report_data = exporter.load_report(args.report_id)
        if not report_data:
            print(f"未找到报告: {args.report_id}", file=sys.stderr)
            return 1
        masked = mask_dict(report_data)
        print(json.dumps(masked, ensure_ascii=False, indent=2))
        return 0

    print(f"未知操作: {args.action}", file=sys.stderr)
    return 1


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="pitch-practice",
        description="儿童音准练习器 CLI - 音高检测、误差曲线、档案历史、点评保存、报告导出",
    )
    subparsers = parser.add_subparsers(dest="command", help="可用命令")

    analyze_parser = subparsers.add_parser("analyze", help="分析录音音准")
    analyze_parser.add_argument("--input-dir", required=True, help="输入目录（含 exercise.json 和音频文件）")
    analyze_parser.add_argument("--output-dir", required=True, help="输出目录")
    analyze_parser.add_argument("--format", choices=["json", "csv", "txt"], default="json", help="报告格式 (默认 json)")

    profile_parser = subparsers.add_parser("profile", help="管理学生档案")
    profile_parser.add_argument("action", choices=["list", "show", "create"], help="操作")
    profile_parser.add_argument("--output-dir", required=True, help="输出目录")
    profile_parser.add_argument("--student-id", default="", help="学生ID")
    profile_parser.add_argument("--name", default="", help="学生姓名")
    profile_parser.add_argument("--age", type=int, default=None, help="年龄")
    profile_parser.add_argument("--level", default="", help="等级")

    comment_parser = subparsers.add_parser("comment", help="管理老师点评")
    comment_parser.add_argument("action", choices=["add", "list"], help="操作")
    comment_parser.add_argument("--output-dir", required=True, help="输出目录")
    comment_parser.add_argument("--student-id", default="", help="学生ID")
    comment_parser.add_argument("--session-id", default="", help="会话ID")
    comment_parser.add_argument("--teacher", default="", help="老师姓名")
    comment_parser.add_argument("--text", default="", help="点评内容")

    report_parser = subparsers.add_parser("report", help="管理练习报告")
    report_parser.add_argument("action", choices=["list", "show", "export"], help="操作")
    report_parser.add_argument("--output-dir", required=True, help="输出目录")
    report_parser.add_argument("--report-id", default="", help="报告ID")
    report_parser.add_argument("--format", choices=["json", "csv", "txt"], default="json", help="导出格式")

    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        return 0

    if args.command == "analyze":
        return cmd_analyze(args)
    elif args.command == "profile":
        return cmd_profile(args)
    elif args.command == "comment":
        return cmd_comment(args)
    elif args.command == "report":
        return cmd_report(args)
    else:
        parser.print_help()
        return 1


if __name__ == "__main__":
    sys.exit(main())
