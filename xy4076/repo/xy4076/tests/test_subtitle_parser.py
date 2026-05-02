import unittest
from datetime import timedelta

from podcast_sanitizer.subtitle_parser import (
    parse_srt, parse_vtt, parse_srt_time, parse_vtt_time,
    export_srt, export_vtt, format_srt_time, format_vtt_time,
    parse_chapters_csv, parse_rules_csv
)
from podcast_sanitizer.models import Subtitle


class TestTimeParsing(unittest.TestCase):
    def test_parse_srt_time(self):
        td = parse_srt_time("00:00:05,500")
        self.assertEqual(td, timedelta(seconds=5, milliseconds=500))

        td = parse_srt_time("01:30:45,123")
        self.assertEqual(td, timedelta(hours=1, minutes=30, seconds=45, milliseconds=123))

    def test_parse_vtt_time(self):
        td = parse_vtt_time("00:00:05.500")
        self.assertEqual(td, timedelta(seconds=5, milliseconds=500))

        td = parse_vtt_time("01:30:45.123")
        self.assertEqual(td, timedelta(hours=1, minutes=30, seconds=45, milliseconds=123))

    def test_format_srt_time(self):
        td = timedelta(seconds=5, milliseconds=500)
        self.assertEqual(format_srt_time(td), "00:00:05,500")

        td = timedelta(hours=1, minutes=30, seconds=45, milliseconds=123)
        self.assertEqual(format_srt_time(td), "01:30:45,123")

    def test_format_vtt_time(self):
        td = timedelta(seconds=5, milliseconds=500)
        self.assertEqual(format_vtt_time(td), "00:00:05.500")


class TestSrtParsing(unittest.TestCase):
    def test_parse_srt_basic(self):
        srt_content = """1
00:00:02,500 --> 00:00:06,000
大家好，欢迎收听本期播客节目

2
00:00:06,500 --> 00:00:10,000
今天我们很高兴邀请到张总来分享
"""
        subtitles = parse_srt(srt_content)
        self.assertEqual(len(subtitles), 2)

        self.assertEqual(subtitles[0].id, 1)
        self.assertEqual(subtitles[0].original_id, 1)
        self.assertEqual(subtitles[0].start_time, timedelta(seconds=2, milliseconds=500))
        self.assertEqual(subtitles[0].end_time, timedelta(seconds=6))
        self.assertEqual(subtitles[0].text, "大家好，欢迎收听本期播客节目")

        self.assertEqual(subtitles[1].text, "今天我们很高兴邀请到张总来分享")

    def test_export_srt(self):
        subtitles = [
            Subtitle(
                id=1,
                start_time=timedelta(seconds=2, milliseconds=500),
                end_time=timedelta(seconds=6),
                text="大家好",
                original_id=1
            ),
            Subtitle(
                id=2,
                start_time=timedelta(seconds=6, milliseconds=500),
                end_time=timedelta(seconds=10),
                text="欢迎收听",
                original_id=2
            )
        ]

        srt_content = export_srt(subtitles)
        self.assertIn("00:00:02,500 --> 00:00:06,000", srt_content)
        self.assertIn("大家好", srt_content)
        self.assertIn("欢迎收听", srt_content)


class TestVttParsing(unittest.TestCase):
    def test_parse_vtt_basic(self):
        vtt_content = """WEBVTT

00:00:02.500 --> 00:00:06.000
大家好，欢迎收听本期播客节目

00:00:06.500 --> 00:00:10.000
今天我们很高兴邀请到张总来分享
"""
        subtitles = parse_vtt(vtt_content)
        self.assertEqual(len(subtitles), 2)

        self.assertEqual(subtitles[0].id, 1)
        self.assertEqual(subtitles[0].start_time, timedelta(seconds=2, milliseconds=500))
        self.assertEqual(subtitles[0].text, "大家好，欢迎收听本期播客节目")

    def test_export_vtt(self):
        subtitles = [
            Subtitle(
                id=1,
                start_time=timedelta(seconds=2, milliseconds=500),
                end_time=timedelta(seconds=6),
                text="大家好"
            )
        ]

        vtt_content = export_vtt(subtitles)
        self.assertIn("WEBVTT", vtt_content)
        self.assertIn("00:00:02.500 --> 00:00:06.000", vtt_content)


class TestCsvParsing(unittest.TestCase):
    def test_parse_chapters_csv(self):
        csv_content = """开始时间,标题,结束时间
00:00:00.000,开场介绍,00:00:15.000
00:00:15.000,嘉宾访谈,00:00:35.000
"""
        chapters = parse_chapters_csv(csv_content)
        self.assertEqual(len(chapters), 2)
        self.assertEqual(chapters[0].title, "开场介绍")
        self.assertEqual(chapters[0].start_time, timedelta(seconds=0))
        self.assertEqual(chapters[0].end_time, timedelta(seconds=15))

        self.assertEqual(chapters[1].title, "嘉宾访谈")

    def test_parse_rules_csv(self):
        csv_content = """pattern,category,description,mask_template
1[3-9]\\d{9},phone,手机号码,[PHONE_{index}]
[\\w.-]+@[\\w.-]+\\.\\w+,email,电子邮箱,[EMAIL_{index}]
"""
        rules = parse_rules_csv(csv_content)
        self.assertEqual(len(rules), 2)
        self.assertEqual(rules[0].category, "phone")
        self.assertEqual(rules[1].category, "email")


if __name__ == "__main__":
    unittest.main()
