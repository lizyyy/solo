#!/usr/bin/env node
import * as fs from 'fs-extra';
import * as path from 'path';
import { Command } from 'commander';
import chalk from 'chalk';

function writeWavFile(
  filePath: string,
  samples: Int16Array[],
  sampleRate: number = 44100
): void {
  const numChannels = samples.length;
  const numSamples = samples[0]?.length || 0;
  const bitsPerSample = 16;
  const blockAlign = numChannels * (bitsPerSample / 8);
  const byteRate = sampleRate * blockAlign;
  const dataSize = numSamples * blockAlign;
  const fileSize = 36 + dataSize;

  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(fileSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  let dataOffset = 44;
  for (let i = 0; i < numSamples; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = samples[ch][i];
      buffer.writeInt16LE(sample, dataOffset);
      dataOffset += 2;
    }
  }

  fs.outputFileSync(filePath, buffer);
}

function generateSineWave(
  frequency: number,
  duration: number,
  sampleRate: number,
  amplitude: number = 0.5
): Int16Array {
  const numSamples = Math.floor(duration * sampleRate);
  const samples = new Int16Array(numSamples);
  const maxValue = 32767;

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const value = Math.sin(2 * Math.PI * frequency * t) * amplitude;
    samples[i] = Math.round(value * maxValue);
  }

  return samples;
}

function generateSilence(duration: number, sampleRate: number): Int16Array {
  const numSamples = Math.floor(duration * sampleRate);
  return new Int16Array(numSamples);
}

function generateWhiteNoise(
  duration: number,
  sampleRate: number,
  amplitude: number = 0.3
): Int16Array {
  const numSamples = Math.floor(duration * sampleRate);
  const samples = new Int16Array(numSamples);
  const maxValue = 32767;

  for (let i = 0; i < numSamples; i++) {
    const value = (Math.random() * 2 - 1) * amplitude;
    samples[i] = Math.round(value * maxValue);
  }

  return samples;
}

function applyFadeInOut(
  samples: Int16Array,
  fadeDuration: number,
  sampleRate: number
): Int16Array {
  const fadeSamples = Math.floor(fadeDuration * sampleRate);
  const result = new Int16Array(samples);

  for (let i = 0; i < fadeSamples && i < result.length; i++) {
    const factor = i / fadeSamples;
    result[i] = Math.round(result[i] * factor);
  }

  for (let i = 0; i < fadeSamples && i < result.length; i++) {
    const idx = result.length - 1 - i;
    const factor = i / fadeSamples;
    result[idx] = Math.round(result[idx] * factor);
  }

  return result;
}

function concatSamples(...sampleArrays: Int16Array[]): Int16Array {
  const totalLength = sampleArrays.reduce((sum, arr) => sum + arr.length, 0);
  const result = new Int16Array(totalLength);
  let offset = 0;

  for (const arr of sampleArrays) {
    result.set(arr, offset);
    offset += arr.length;
  }

  return result;
}

interface SampleConfig {
  name: string;
  role: 'intro' | 'main' | 'ad' | 'outro';
  duration: number;
  startSilence: number;
  endSilence: number;
  amplitude: number;
  hasIssue?: 'loudness' | 'silence' | 'both';
}

const DEFAULT_SAMPLE_CONFIGS: SampleConfig[] = [
  {
    name: 'intro',
    role: 'intro',
    duration: 5,
    startSilence: 0.1,
    endSilence: 0.3,
    amplitude: 0.6,
  },
  {
    name: 'main',
    role: 'main',
    duration: 30,
    startSilence: 0.2,
    endSilence: 0.5,
    amplitude: 0.55,
  },
  {
    name: 'ad',
    role: 'ad',
    duration: 10,
    startSilence: 0.1,
    endSilence: 0.2,
    amplitude: 0.7,
  },
  {
    name: 'outro',
    role: 'outro',
    duration: 3,
    startSilence: 0.1,
    endSilence: 0.3,
    amplitude: 0.55,
  },
];

const ISSUE_SAMPLE_CONFIGS: SampleConfig[] = [
  {
    name: 'intro-loud',
    role: 'intro',
    duration: 5,
    startSilence: 0.1,
    endSilence: 0.3,
    amplitude: 0.9,
    hasIssue: 'loudness',
  },
  {
    name: 'main-silent',
    role: 'main',
    duration: 20,
    startSilence: 2.0,
    endSilence: 3.0,
    amplitude: 0.5,
    hasIssue: 'silence',
  },
  {
    name: 'ad-quiet',
    role: 'ad',
    duration: 8,
    startSilence: 0.1,
    endSilence: 0.2,
    amplitude: 0.25,
    hasIssue: 'loudness',
  },
  {
    name: 'outro-both',
    role: 'outro',
    duration: 4,
    startSilence: 1.5,
    endSilence: 2.0,
    amplitude: 0.85,
    hasIssue: 'both',
  },
];

function generateSampleFile(
  config: SampleConfig,
  outputDir: string,
  sampleRate: number = 44100
): string {
  const frequencies = {
    intro: [440, 550, 660],
    main: [330, 392, 440],
    ad: [523, 587, 659],
    outro: [392, 330, 294],
  };

  const freqs = frequencies[config.role] || frequencies.main;

  const startSilence = generateSilence(config.startSilence, sampleRate);
  const endSilence = generateSilence(config.endSilence, sampleRate);

  const contentDuration = config.duration - config.startSilence - config.endSilence;
  const contentSamples: Int16Array[] = [];

  const segmentDuration = contentDuration / 3;
  
  for (let i = 0; i < 3; i++) {
    const freq = freqs[i % freqs.length];
    
    const sine1 = generateSineWave(freq, segmentDuration, sampleRate, config.amplitude);
    const sine2 = generateSineWave(freq * 1.5, segmentDuration, sampleRate, config.amplitude * 0.3);
    const noise = generateWhiteNoise(segmentDuration, sampleRate, config.amplitude * 0.1);

    const segment = new Int16Array(sine1.length);
    for (let j = 0; j < segment.length; j++) {
      const value = (sine1[j] + sine2[j] + noise[j]) / 3;
      segment[j] = Math.round(value);
    }

    contentSamples.push(segment);
  }

  const content = concatSamples(...contentSamples);
  const fadedContent = applyFadeInOut(content, 0.1, sampleRate);

  const allSamples = concatSamples(startSilence, fadedContent, endSilence);

  const fileName = `${config.name}.wav`;
  const filePath = path.join(outputDir, fileName);

  writeWavFile(filePath, [allSamples], sampleRate);

  return filePath;
}

interface GenerateOptions {
  output: string;
  sampleRate: number;
  withIssues: boolean;
}

async function runGenerate(options: GenerateOptions): Promise<void> {
  const { output, sampleRate, withIssues } = options;

  const outputDir = path.resolve(output);
  await fs.ensureDir(outputDir);

  const configs = withIssues ? ISSUE_SAMPLE_CONFIGS : DEFAULT_SAMPLE_CONFIGS;

  console.log(chalk.blue('🎵 生成示例音频文件...'));
  console.log(chalk.gray(`输出目录: ${outputDir}`));
  console.log(chalk.gray(`采样率: ${sampleRate} Hz`));
  console.log('');

  const generatedFiles: string[] = [];

  for (const config of configs) {
    const filePath = generateSampleFile(config, outputDir, sampleRate);
    generatedFiles.push(filePath);

    const issueLabel = config.hasIssue
      ? chalk.yellow(` [有问题: ${config.hasIssue}]`)
      : '';
    
    console.log(chalk.green(`✅ 已生成: ${path.basename(filePath)}${issueLabel}`));
    console.log(chalk.gray(`   时长: ${config.duration}s`));
    console.log(chalk.gray(`   开头静音: ${config.startSilence}s`));
    console.log(chalk.gray(`   结尾静音: ${config.endSilence}s`));
    console.log(chalk.gray(`   振幅: ${Math.round(config.amplitude * 100)}%`));
    console.log('');
  }

  console.log(chalk.green('🎉 示例音频生成完成！'));
  console.log('');
  console.log(chalk.cyan('下一步:'));
  if (withIssues) {
    console.log(chalk.gray('   这些示例包含故意设置的问题，用于测试验证功能:'));
    console.log(chalk.gray('   - intro-loud.wav: 音量过高'));
    console.log(chalk.gray('   - main-silent.wav: 开头/结尾静音过长'));
    console.log(chalk.gray('   - ad-quiet.wav: 音量过低'));
    console.log(chalk.gray('   - outro-both.wav: 音量过高 + 静音过长'));
  }
  console.log('');
  console.log(chalk.gray('   运行以下命令检查:'));
  console.log(chalk.gray('   pdc inspect manifest.yaml'));
  console.log(chalk.gray('   pdc validate manifest.yaml'));
  console.log('');
}

const program = new Command();

program
  .name('generate-samples')
  .description('生成示例 WAV 音频文件用于测试')
  .option('-o, --output <directory>', '输出目录', './audio')
  .option('-r, --sample-rate <rate>', '采样率 (Hz)', '44100')
  .option('--with-issues', '生成包含问题的示例音频（用于测试验证）')
  .action(async (options) => {
    try {
      await runGenerate({
        output: options.output,
        sampleRate: parseInt(options.sampleRate, 10),
        withIssues: options.withIssues,
      });
    } catch (error) {
      console.error('生成失败:', error);
      process.exit(1);
    }
  });

if (require.main === module) {
  program.parseAsync(process.argv).catch((error) => {
    console.error('错误:', error.message);
    process.exit(1);
  });
}

export { generateSampleFile, runGenerate };
