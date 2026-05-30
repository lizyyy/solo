#!/usr/bin/env python3
import numpy as np
import soundfile as sf
import os


def generate_sawtooth(freq: float, duration: float = 2.0, 
                      sample_rate: int = 44100, harmonics: int = 10) -> np.ndarray:
    t = np.linspace(0, duration, int(sample_rate * duration), endpoint=False)
    signal = np.zeros_like(t)
    
    for n in range(1, harmonics + 1):
        signal += (1.0 / n) * np.sin(2 * np.pi * n * freq * t)
    
    signal = signal / np.max(np.abs(signal)) * 0.9
    return signal


def generate_square(freq: float, duration: float = 2.0,
                    sample_rate: int = 44100, harmonics: int = 10) -> np.ndarray:
    t = np.linspace(0, duration, int(sample_rate * duration), endpoint=False)
    signal = np.zeros_like(t)
    
    for n in range(1, harmonics + 1, 2):
        signal += (1.0 / n) * np.sin(2 * np.pi * n * freq * t)
    
    signal = signal / np.max(np.abs(signal)) * 0.9
    return signal


def generate_complex_tone(fundamental: float = 440.0, 
                          harmonic_amps: list = None,
                          duration: float = 2.0,
                          sample_rate: int = 44100) -> np.ndarray:
    if harmonic_amps is None:
        harmonic_amps = [1.0, 0.5, 0.3, 0.2, 0.15, 0.1, 0.08, 0.05]
    
    t = np.linspace(0, duration, int(sample_rate * duration), endpoint=False)
    signal = np.zeros_like(t)
    
    for n, amp in enumerate(harmonic_amps, 1):
        signal += amp * np.sin(2 * np.pi * n * fundamental * t)
    
    signal = signal / np.max(np.abs(signal)) * 0.9
    return signal


def generate_two_tones(freq1: float = 440.0, freq2: float = 660.0,
                       amp1: float = 1.0, amp2: float = 0.7,
                       duration: float = 2.0,
                       sample_rate: int = 44100) -> np.ndarray:
    t = np.linspace(0, duration, int(sample_rate * duration), endpoint=False)
    signal = amp1 * np.sin(2 * np.pi * freq1 * t) + amp2 * np.sin(2 * np.pi * freq2 * t)
    signal = signal / np.max(np.abs(signal)) * 0.9
    return signal


def main():
    output_dir = 'test_audio'
    os.makedirs(output_dir, exist_ok=True)
    
    sample_rate = 44100
    duration = 2.0
    
    print("生成测试音频文件...")
    
    a4_saw = generate_sawtooth(440.0, duration, sample_rate, harmonics=15)
    sf.write(os.path.join(output_dir, 'sawtooth_A4.wav'), a4_saw, sample_rate)
    print(f"  生成: sawtooth_A4.wav (440Hz 锯齿波)")
    
    c4_square = generate_square(261.63, duration, sample_rate, harmonics=15)
    sf.write(os.path.join(output_dir, 'square_C4.wav'), c4_square, sample_rate)
    print(f"  生成: square_C4.wav (261.63Hz 方波)")
    
    harmonic_amps = [1.0, 0.8, 0.6, 0.4, 0.3, 0.2, 0.15, 0.1, 0.08, 0.05]
    synth = generate_complex_tone(329.63, harmonic_amps, duration, sample_rate)
    sf.write(os.path.join(output_dir, 'synthesizer_E4.wav'), synth, sample_rate)
    print(f"  生成: synthesizer_E4.wav (329.63Hz 合成音色)")
    
    two_tones = generate_two_tones(440.0, 554.37, 1.0, 0.6, duration, sample_rate)
    sf.write(os.path.join(output_dir, 'two_tones_A4_Csharp5.wav'), two_tones, sample_rate)
    print(f"  生成: two_tones_A4_Csharp5.wav (A4 + C#5 双音)")
    
    t = np.linspace(0, duration, int(sample_rate * duration), endpoint=False)
    freq_mod = 220.0 + 100.0 * np.sin(2 * np.pi * 5 * t)
    chirp = np.sin(2 * np.pi * freq_mod * t)
    chirp = chirp / np.max(np.abs(chirp)) * 0.9
    sf.write(os.path.join(output_dir, 'chirp.wav'), chirp, sample_rate)
    print(f"  生成: chirp.wav (频率扫描信号)")
    
    print(f"\n所有测试音频已生成至 {output_dir}/ 目录")
    print(f"\n使用示例:")
    print(f"  python fourier_analyzer.py -i test_audio/sawtooth_A4.wav")
    print(f"  python fourier_analyzer.py -i test_audio/synthesizer_E4.wav -w 4096")


if __name__ == '__main__':
    main()
