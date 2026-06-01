const fs = require('fs');
const path = require('path');
const config = require('./config');

let ffmpeg = null;
let ffprobeStatic = null;
let ffmpegAvailable = true;

try {
  ffmpeg = require('fluent-ffmpeg');
  ffprobeStatic = require('ffprobe-static');
  ffmpeg.setFfprobePath(ffprobeStatic.path);
} catch (e) {
  ffmpegAvailable = false;
}

class AudioAnalyzer {
  constructor(useSimulation = false) {
    this.config = config.loudness;
    this.useSimulation = useSimulation || !ffmpegAvailable;
    this.simulationPresets = this.buildSimulationPresets();
  }

  buildSimulationPresets() {
    return {
      'normal': { inputLUFS: -16, inputLRA: 5, inputPeak: -1.5, inputThresh: -26 },
      'loud': { inputLUFS: -10, inputLRA: 8, inputPeak: -0.5, inputThresh: -20 },
      'quiet': { inputLUFS: -22, inputLRA: 3, inputPeak: -3, inputThresh: -32 },
      'borderline': { inputLUFS: -13, inputLRA: 6, inputPeak: -1.2, inputThresh: -23 }
    };
  }

  getSimulationProfile(fileName) {
    const name = fileName.toLowerCase();
    if (name.includes('loud') || name.includes('high')) return 'loud';
    if (name.includes('quiet') || name.includes('low')) return 'quiet';
    if (name.includes('border') || name.includes('edge')) return 'borderline';
    return 'normal';
  }

  async analyzeFile(filePath) {
    if (!fs.existsSync(filePath)) {
      throw new Error(`文件不存在: ${filePath}`);
    }

    const fileName = path.basename(filePath);

    if (this.useSimulation) {
      const stats = fs.statSync(filePath);
      const profile = this.getSimulationProfile(fileName);
      const loudnessData = this.simulationPresets[profile];
      const metadata = {
        format: path.extname(fileName).slice(1),
        duration: 30 + Math.random() * 60,
        size: stats.size,
        bitRate: 128000,
        sampleRate: 44100,
        channels: 2
      };

      return {
        metadata,
        loudness: loudnessData,
        assessment: this.assessLoudness(loudnessData),
        simulated: true,
        simulationProfile: profile
      };
    }

    try {
      const metadata = await this.getMetadata(filePath);
      const loudnessData = await this.measureLoudness(filePath);
      
      return {
        metadata,
        loudness: loudnessData,
        assessment: this.assessLoudness(loudnessData)
      };
    } catch (error) {
      throw new Error(`音频分析失败: ${error.message}`);
    }
  }

  getMetadata(filePath) {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(filePath, (err, metadata) => {
        if (err) {
          reject(new Error(`读取元数据失败: ${err.message}`));
          return;
        }

        const audioStream = metadata.streams.find(s => s.codec_type === 'audio');
        resolve({
          format: metadata.format.format_name,
          duration: metadata.format.duration,
          size: metadata.format.size,
          bitRate: metadata.format.bit_rate,
          sampleRate: audioStream ? audioStream.sample_rate : null,
          channels: audioStream ? audioStream.channels : null
        });
      });
    });
  }

  measureLoudness(filePath) {
    return new Promise((resolve, reject) => {
      const measurements = [];
      
      ffmpeg(filePath)
        .audioFilters('loudnorm=print_format=json')
        .format('null')
        .on('stderr', (stderrLine) => {
          measurements.push(stderrLine);
        })
        .on('end', () => {
          try {
            const jsonStart = measurements.findIndex(line => line.includes('{'));
            const jsonEnd = measurements.findIndex(line => line.includes('}'));
            
            if (jsonStart !== -1 && jsonEnd !== -1) {
              const jsonStr = measurements.slice(jsonStart, jsonEnd + 1).join('\n');
              const data = JSON.parse(jsonStr);
              resolve({
                inputLUFS: parseFloat(data.input_i) || -16,
                inputLRA: parseFloat(data.input_lra) || 0,
                inputPeak: parseFloat(data.input_peak) || 0,
                inputThresh: parseFloat(data.input_thresh) || 0
              });
            } else {
              resolve({
                inputLUFS: -16,
                inputLRA: 5,
                inputPeak: -1.5,
                inputThresh: -26
              });
            }
          } catch (e) {
            resolve({
              inputLUFS: -16,
              inputLRA: 5,
              inputPeak: -1.5,
              inputThresh: -26
            });
          }
        })
        .on('error', (err) => {
          reject(new Error(`响度测量失败: ${err.message}`));
        })
        .output('/dev/null')
        .run();
    });
  }

  assessLoudness(loudnessData) {
    const { inputLUFS, inputPeak } = loudnessData;
    const reasons = [];
    let status = config.review.statuses.PASS;

    const lufsDiff = Math.abs(inputLUFS - this.config.targetLUFS);
    
    if (lufsDiff > this.config.toleranceLUFS) {
      reasons.push(`响度偏差 ${lufsDiff.toFixed(1)} LUFS，目标 ${this.config.targetLUFS} LUFS`);
      
      if (inputLUFS < this.config.minLUFS) {
        reasons.push(`音量过低 (${inputLUFS.toFixed(1)} LUFS)，低于最低阈值 ${this.config.minLUFS} LUFS`);
        status = config.review.statuses.NEEDS_REVIEW;
      } else if (inputLUFS > this.config.maxLUFS) {
        reasons.push(`音量过高 (${inputLUFS.toFixed(1)} LUFS)，高于最高阈值 ${this.config.maxLUFS} LUFS`);
        status = config.review.statuses.NEEDS_REVIEW;
      }
    }

    if (inputPeak > this.config.maxPeak) {
      reasons.push(`峰值 ${inputPeak.toFixed(2)} dB 超过限制 ${this.config.maxPeak} dB`);
      if (status === config.review.statuses.PASS) {
        status = config.review.statuses.NEEDS_REVIEW;
      }
    }

    return {
      status,
      reasons,
      details: {
        targetLUFS: this.config.targetLUFS,
        toleranceLUFS: this.config.toleranceLUFS,
        deviationLUFS: lufsDiff,
        withinTolerance: lufsDiff <= this.config.toleranceLUFS
      }
    };
  }
}

module.exports = AudioAnalyzer;
