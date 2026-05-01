import tempfile
from pathlib import Path
from unittest import TestCase

from glossary_guardian.parsers.transcript_parser import (
    TranscriptParser,
    TranscriptSegment,
)


class TestTranscriptSegment(TestCase):
    def test_creation(self):
        segment = TranscriptSegment(
            id="1",
            text="这是一个测试",
            speaker="张三",
        )
        self.assertEqual(segment.id, "1")
        self.assertEqual(segment.text, "这是一个测试")
        self.assertEqual(segment.speaker, "张三")

    def test_to_dict(self):
        segment = TranscriptSegment(
            id="1",
            text="测试文本",
            speaker="测试者",
        )
        data = segment.to_dict()
        self.assertEqual(data["id"], "1")
        self.assertEqual(data["text"], "测试文本")
        self.assertEqual(data["speaker"], "测试者")


class TestTranscriptParser(TestCase):
    def setUp(self):
        self.temp_dir = tempfile.mkdtemp()

    def test_parse_srt(self):
        srt_content = """1
00:00:01,000 --> 00:00:05,000
张三: 各位来宾，大家好！

2
00:00:05,000 --> 00:00:10,000
李四: 欢迎参加今天的发布会。

3
00:00:10,000 --> 00:00:15,000
这是没有说话人的一行。
"""
        srt_path = Path(self.temp_dir) / "transcript.srt"
        srt_path.write_text(srt_content, encoding="utf-8")

        parser = TranscriptParser()
        segments = parser.parse_srt(srt_path)

        self.assertEqual(len(segments), 3)
        self.assertEqual(segments[0].id, "1")
        self.assertEqual(segments[0].speaker, "张三")
        self.assertEqual(segments[1].speaker, "李四")
        self.assertIsNone(segments[2].speaker)

    def test_parse_txt(self):
        txt_content = """[00:00:01]
张三: 各位来宾，大家好！

[00:00:05]
李四: 欢迎参加今天的发布会。

[00:00:10]
这是没有说话人的一行。

[00:00:15]
王五: 这是最后一段。
"""
        txt_path = Path(self.temp_dir) / "transcript.txt"
        txt_path.write_text(txt_content, encoding="utf-8")

        parser = TranscriptParser()
        segments = parser.parse_txt(txt_path)

        self.assertEqual(len(segments), 4)
        self.assertEqual(segments[0].speaker, "张三")
        self.assertEqual(segments[1].speaker, "李四")
        self.assertIsNone(segments[2].speaker)
        self.assertEqual(segments[3].speaker, "王五")

    def test_get_speakers(self):
        parser = TranscriptParser()
        parser.segments = [
            TranscriptSegment(id="1", text="test1", speaker="张三"),
            TranscriptSegment(id="2", text="test2", speaker="李四"),
            TranscriptSegment(id="3", text="test3", speaker="张三"),
            TranscriptSegment(id="4", text="test4"),
        ]

        speakers = parser.get_speakers()
        self.assertEqual(len(speakers), 2)
        self.assertIn("张三", speakers)
        self.assertIn("李四", speakers)

    def test_search_text(self):
        parser = TranscriptParser()
        parser.segments = [
            TranscriptSegment(id="1", text="人工智能是未来的趋势", speaker="张三"),
            TranscriptSegment(id="2", text="机器学习是人工智能的子领域", speaker="李四"),
            TranscriptSegment(id="3", text="深度学习是机器学习的子领域", speaker="王五"),
        ]

        results = parser.search_text("人工智能")
        self.assertEqual(len(results), 2)

        results = parser.search_text("深度学习")
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0].speaker, "王五")

    def test_import_transcript_srt(self):
        srt_content = """1
00:00:01,000 --> 00:00:05,000
测试文本
"""
        srt_path = Path(self.temp_dir) / "test.srt"
        srt_path.write_text(srt_content, encoding="utf-8")

        parser = TranscriptParser()
        segments = parser.import_transcript(srt_path)

        self.assertEqual(len(segments), 1)

    def test_import_transcript_txt(self):
        txt_content = """[00:00:01]
测试文本
"""
        txt_path = Path(self.temp_dir) / "test.txt"
        txt_path.write_text(txt_content, encoding="utf-8")

        parser = TranscriptParser()
        segments = parser.import_transcript(txt_path)

        self.assertEqual(len(segments), 1)

    def test_import_transcript_invalid_format(self):
        invalid_path = Path(self.temp_dir) / "test.xyz"
        invalid_path.write_text("test", encoding="utf-8")

        parser = TranscriptParser()
        with self.assertRaises(ValueError):
            parser.import_transcript(invalid_path)

    def test_full_text_update(self):
        parser = TranscriptParser()
        parser.segments = [
            TranscriptSegment(id="1", text="你好"),
            TranscriptSegment(id="2", text="世界"),
        ]
        parser._update_full_text()

        self.assertIn("你好", parser.full_text)
        self.assertIn("世界", parser.full_text)
