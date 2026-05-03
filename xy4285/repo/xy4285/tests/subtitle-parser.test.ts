import { SubtitleParser } from '../src/subtitle-parser';
import * as fs from 'fs';
import * as path from 'path';

describe('SubtitleParser', () => {
  let parser: SubtitleParser;

  beforeEach(() => {
    parser = new SubtitleParser();
  });

  describe('SRT Parsing', () => {
    it('should parse simple SRT content', () => {
      const srtContent = `1
00:00:01,000 --> 00:00:03,500
Hello world

2
00:00:04,000 --> 00:00:06,000
Second subtitle`;

      const cues = parser.parseSRT(srtContent);

      expect(cues.length).toBe(2);
      expect(cues[0].id).toBe('1');
      expect(cues[0].startTime).toBe(1000);
      expect(cues[0].endTime).toBe(3500);
      expect(cues[0].text).toBe('Hello world');
      expect(cues[1].id).toBe('2');
      expect(cues[1].startTime).toBe(4000);
      expect(cues[1].endTime).toBe(6000);
    });

    it('should handle multi-line text', () => {
      const srtContent = `1
00:00:01,000 --> 00:00:03,000
First line
Second line
Third line`;

      const cues = parser.parseSRT(srtContent);

      expect(cues.length).toBe(1);
      expect(cues[0].text).toBe('First line\nSecond line\nThird line');
    });

    it('should handle dot as milliseconds separator', () => {
      const srtContent = `1
00:00:01.500 --> 00:00:03.250
Test subtitle`;

      const cues = parser.parseSRT(srtContent);

      expect(cues[0].startTime).toBe(1500);
      expect(cues[0].endTime).toBe(3250);
    });
  });

  describe('VTT Parsing', () => {
    it('should parse simple VTT content', () => {
      const vttContent = `WEBVTT

1
00:00:01.000 --> 00:00:03.500
Hello world

2
00:00:04.000 --> 00:00:06.000
Second subtitle`;

      const cues = parser.parseVTT(vttContent);

      expect(cues.length).toBe(2);
      expect(cues[0].startTime).toBe(1000);
      expect(cues[0].endTime).toBe(3500);
      expect(cues[0].text).toBe('Hello world');
    });

    it('should parse VTT without WEBVTT header cues', () => {
      const vttContent = `WEBVTT

00:00:01.000 --> 00:00:03.500
Hello world

00:00:04.000 --> 00:00:06.000
Second subtitle`;

      const cues = parser.parseVTT(vttContent);

      expect(cues.length).toBe(2);
    });

    it('should handle short time format (mm:ss.mmm)', () => {
      const vttContent = `WEBVTT

00:01.500 --> 00:03.250
Short format test`;

      const cues = parser.parseVTT(vttContent);

      expect(cues[0].startTime).toBe(1500);
      expect(cues[0].endTime).toBe(3250);
    });
  });

  describe('Metadata Extraction', () => {
    it('should extract metadata from standard filename', () => {
      const testSrt = `1
00:00:01,000 --> 00:00:02,000
Test`;

      const tempDir = path.join(__dirname, 'temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      const filePath = path.join(tempDir, 'tiktok_ep001_zh.srt');
      fs.writeFileSync(filePath, testSrt);

      const parsed = parser.parseFile(filePath);

      expect(parsed.platform).toBe('tiktok');
      expect(parsed.episode).toBe('0001');
      expect(parsed.language).toBe('zh');
      expect(parsed.format).toBe('srt');

      fs.unlinkSync(filePath);
      fs.rmdirSync(tempDir);
    });

    it('should handle different separators', () => {
      const testSrt = `1
00:00:01,000 --> 00:00:02,000
Test`;

      const tempDir = path.join(__dirname, 'temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      const filePath = path.join(tempDir, 'youtube-ep002-en.vtt');
      fs.writeFileSync(filePath, testSrt);

      const parsed = parser.parseFile(filePath);

      expect(parsed.platform).toBe('youtube');
      expect(parsed.episode).toBe('0002');
      expect(parsed.language).toBe('en');
      expect(parsed.format).toBe('vtt');

      fs.unlinkSync(filePath);
      fs.rmdirSync(tempDir);
    });
  });

  describe('Time Conversion', () => {
    it('should convert milliseconds to time string', () => {
      expect(parser.msToTime(1000)).toBe('00:00:01,000');
      expect(parser.msToTime(3500)).toBe('00:00:03,500');
      expect(parser.msToTime(61000)).toBe('00:01:01,000');
      expect(parser.msToTime(3661000)).toBe('01:01:01,000');
    });
  });
});
