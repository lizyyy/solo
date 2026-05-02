import os
import tempfile
import math
import struct
import wave
from typing import Optional, List, Tuple, Callable, Dict, Any
from dataclasses import dataclass
from enum import Enum

from pydub import AudioSegment
from pydub.exceptions import CouldntDecodeError


class AudioPlaybackState(Enum):
    STOPPED = "stopped"
    PLAYING = "playing"
    PAUSED = "paused"


@dataclass
class AudioInfo:
    path: str
    duration: float
    channels: int
    sample_width: int
    frame_rate: int
    format: str


@dataclass
class AudioSegmentAction:
    start_time: float
    end_time: float
    action: str
    matched_text: str


class AudioHandlerError(Exception):
    pass


class AudioHandler:
    
    BEEP_FREQUENCY = 800
    BEEP_AMPLITUDE = 0.5
    
    def __init__(self):
        self._current_audio: Optional[AudioSegment] = None
        self._current_path: Optional[str] = None
        self._audio_info: Optional[AudioInfo] = None
        self._playback_state = AudioPlaybackState.STOPPED
        self._play_position: float = 0.0
        self._on_playback_update: Optional[Callable] = None
        self._on_playback_end: Optional[Callable] = None
    
    def load_audio(self, file_path: str) -> AudioInfo:
        if not os.path.exists(file_path):
            raise AudioHandlerError(f"音频文件不存在: {file_path}")
        
        try:
            ext = os.path.splitext(file_path)[1].lower()
            if ext == ".mp3":
                audio = AudioSegment.from_mp3(file_path)
                audio_format = "mp3"
            elif ext in [".wav", ".wave"]:
                audio = AudioSegment.from_wav(file_path)
                audio_format = "wav"
            else:
                try:
                    audio = AudioSegment.from_file(file_path)
                    audio_format = ext.lstrip(".")
                except Exception:
                    raise AudioHandlerError(f"不支持的音频格式: {ext}")
        except CouldntDecodeError as e:
            raise AudioHandlerError(f"无法解码音频文件: {str(e)}")
        except Exception as e:
            raise AudioHandlerError(f"加载音频文件失败: {str(e)}")
        
        self._current_audio = audio
        self._current_path = file_path
        
        self._audio_info = AudioInfo(
            path=file_path,
            duration=len(audio) / 1000.0,
            channels=audio.channels,
            sample_width=audio.sample_width,
            frame_rate=audio.frame_rate,
            format=audio_format
        )
        
        self._play_position = 0.0
        self._playback_state = AudioPlaybackState.STOPPED
        
        return self._audio_info
    
    def get_audio_info(self) -> Optional[AudioInfo]:
        return self._audio_info
    
    def is_loaded(self) -> bool:
        return self._current_audio is not None
    
    def export_desensitized_audio(
        self,
        output_path: str,
        actions: List[AudioSegmentAction],
        overwrite: bool = False
    ) -> Tuple[str, List[str]]:
        if self._current_audio is None:
            raise AudioHandlerError("没有加载的音频文件")
        
        warnings: List[str] = []
        
        if os.path.exists(output_path):
            if not overwrite:
                raise AudioHandlerError(
                    f"输出文件已存在: {output_path}\n"
                    f"请选择其他位置或启用覆盖选项。"
                )
            else:
                warnings.append(f"覆盖已存在的文件: {output_path}")
        
        audio = self._current_audio
        
        processed_segments: List[Dict[str, Any]] = []
        prev_end = 0.0
        
        sorted_actions = sorted(actions, key=lambda x: x.start_time)
        
        for action in sorted_actions:
            start = int(action.start_time * 1000)
            end = int(action.end_time * 1000)
            
            max_duration = len(audio)
            if start >= max_duration:
                warnings.append(
                    f"忽略超出音频长度的片段: {action.start_time:.2f}s - {action.end_time:.2f}s"
                )
                continue
            
            if end > max_duration:
                warnings.append(
                    f"截断超出音频长度的片段终点: {end/1000:.2f}s -> {max_duration/1000:.2f}s"
                )
                end = max_duration
            
            if start < prev_end:
                overlap = min(end, prev_end) - start
                if overlap > 0:
                    warnings.append(
                        f"检测到片段重叠: {start/1000:.2f}s - {end/1000:.2f}s 与前一片段重叠"
                    )
                start = prev_end
            
            if start >= end:
                continue
            
            if start > prev_end:
                processed_segments.append({
                    "start": prev_end,
                    "end": start,
                    "audio": audio[prev_end:start],
                    "action": "keep"
                })
            
            if action.action == "mute":
                silence_duration = end - start
                processed_audio = AudioSegment.silent(
                    duration=silence_duration,
                    frame_rate=audio.frame_rate
                )
            elif action.action == "beep":
                processed_audio = self._generate_beep(
                    duration_ms=end - start,
                    frame_rate=audio.frame_rate,
                    channels=audio.channels,
                    sample_width=audio.sample_width
                )
            else:
                processed_audio = audio[start:end]
            
            processed_segments.append({
                "start": start,
                "end": end,
                "audio": processed_audio,
                "action": action.action
            })
            
            prev_end = end
        
        if prev_end < len(audio):
            processed_segments.append({
                "start": prev_end,
                "end": len(audio),
                "audio": audio[prev_end:],
                "action": "keep"
            })
        
        if processed_segments:
            result = processed_segments[0]["audio"]
            for seg in processed_segments[1:]:
                result = result.append(seg["audio"], crossfade=0)
        else:
            result = audio
        
        output_dir = os.path.dirname(output_path)
        if output_dir and not os.path.exists(output_dir):
            os.makedirs(output_dir)
        
        ext = os.path.splitext(output_path)[1].lower()
        if ext == ".mp3":
            result.export(output_path, format="mp3", bitrate="192k")
        elif ext in [".wav", ".wave"]:
            result.export(output_path, format="wav")
        else:
            result.export(output_path, format=ext.lstrip("."))
        
        return output_path, warnings
    
    def _generate_beep(
        self,
        duration_ms: int,
        frame_rate: int = 44100,
        channels: int = 2,
        sample_width: int = 2
    ) -> AudioSegment:
        num_samples = int(duration_ms / 1000.0 * frame_rate)
        amplitude = int((2 ** (sample_width * 8 - 1) - 1) * self.BEEP_AMPLITUDE)
        
        samples = []
        for i in range(num_samples):
            t = i / frame_rate
            value = int(amplitude * math.sin(2 * math.pi * self.BEEP_FREQUENCY * t))
            samples.append(value)
        
        if sample_width == 1:
            fmt = '<b'
            max_val = 127
            min_val = -128
            samples = [max(min(int(s / (2 ** 8)), max_val), min_val) for s in samples]
        elif sample_width == 2:
            fmt = '<h'
        elif sample_width == 4:
            fmt = '<i'
        else:
            fmt = '<h'
            sample_width = 2
        
        if channels == 2:
            stereo_samples = []
            for s in samples:
                stereo_samples.append(s)
                stereo_samples.append(s)
            samples = stereo_samples
        
        raw_data = b''.join(struct.pack(fmt, s) for s in samples)
        
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.wav')
        temp_path = temp_file.name
        temp_file.close()
        
        with wave.open(temp_path, 'w') as wav_file:
            wav_file.setnchannels(channels)
            wav_file.setsampwidth(sample_width)
            wav_file.setframerate(frame_rate)
            wav_file.writeframes(raw_data)
        
        beep_audio = AudioSegment.from_wav(temp_path)
        
        os.unlink(temp_path)
        
        return beep_audio
    
    def extract_segment(self, start_time: float, end_time: float, 
                        output_path: Optional[str] = None) -> str:
        if self._current_audio is None:
            raise AudioHandlerError("没有加载的音频文件")
        
        start_ms = int(start_time * 1000)
        end_ms = int(end_time * 1000)
        
        if start_ms >= end_ms:
            raise AudioHandlerError("无效的时间段: 开始时间必须小于结束时间")
        
        max_duration = len(self._current_audio)
        if start_ms > max_duration:
            raise AudioHandlerError(f"开始时间超出音频长度 ({max_duration/1000:.2f}s)")
        
        if end_ms > max_duration:
            end_ms = max_duration
        
        segment = self._current_audio[start_ms:end_ms]
        
        if output_path is None:
            temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.wav')
            output_path = temp_file.name
            temp_file.close()
        
        ext = os.path.splitext(output_path)[1].lower()
        if ext == ".mp3":
            segment.export(output_path, format="mp3")
        else:
            segment.export(output_path, format="wav")
        
        return output_path
    
    def set_playback_callbacks(
        self,
        on_update: Optional[Callable[[float], None]] = None,
        on_end: Optional[Callable[[], None]] = None
    ):
        self._on_playback_update = on_update
        self._on_playback_end = on_end
    
    def play_from(self, position: float) -> bool:
        if self._current_audio is None:
            return False
        
        self._play_position = max(0.0, min(position, self._audio_info.duration))
        self._playback_state = AudioPlaybackState.PLAYING
        
        return True
    
    def pause(self) -> bool:
        if self._playback_state == AudioPlaybackState.PLAYING:
            self._playback_state = AudioPlaybackState.PAUSED
            return True
        return False
    
    def resume(self) -> bool:
        if self._playback_state == AudioPlaybackState.PAUSED:
            self._playback_state = AudioPlaybackState.PLAYING
            return True
        return False
    
    def stop(self) -> bool:
        self._playback_state = AudioPlaybackState.STOPPED
        self._play_position = 0.0
        return True
    
    def get_playback_state(self) -> AudioPlaybackState:
        return self._playback_state
    
    def get_playback_position(self) -> float:
        return self._play_position
    
    def set_playback_position(self, position: float):
        if self._audio_info:
            self._play_position = max(0.0, min(position, self._audio_info.duration))
