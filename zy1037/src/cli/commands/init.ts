import * as fs from 'fs-extra';
import * as path from 'path';
import chalk from 'chalk';
import { generateSampleManifest, writeManifestFile } from '../../manifest/parser';

export interface InitOptions {
  format: 'yaml' | 'json';
  name?: string;
  episode?: string;
  output?: string;
  createAudioDir?: boolean;
}

const README_CONTENT = `# 播客交付体检示例项目

这是一个播客交付体检工具的示例项目。

## 目录结构

\`\`\`
.
├── manifest.yaml     # 节目清单配置
├── audio/            # 音频文件目录
│   ├── intro.wav     # 片头
│   ├── main.wav      # 正片
│   ├── ad.wav        # 广告
│   └── outro.wav     # 片尾
├── output/           # 导出目录
└── README.md
\`\`\`

## 快速开始

### 1. 生成示例音频（如果没有真实音频文件）

\`\`\`bash
# 使用项目提供的脚本生成示例 WAV 文件
npm run generate-samples -- --output ./audio
\`\`\`

### 2. 检查音频文件

\`\`\`bash
# 查看音频文件详情
pdc inspect manifest.yaml

# 或使用 npx
npx pdc inspect manifest.yaml
\`\`\`

### 3. 验证交付标准

\`\`\`bash
# 执行完整验证
pdc validate manifest.yaml

# 详细输出
pdc validate manifest.yaml --verbose
\`\`\`

### 4. 导出报告

\`\`\`bash
# 导出所有格式的报告
pdc report manifest.yaml --output ./output

# 或指定格式
pdc report manifest.yaml --format html --output ./output/report.html
\`\`\`

## manifest.yaml 说明

\`\`\`yaml
version: "1.0.0"
project:
  name: "播客名称"
  episode: "节目期数"

settings:
  targetLoudness: -16    # 目标响度 (RMS dB，对应约 -16 LUFS)
  loudnessTolerance: 2   # 响度容差 (±2 dB)
  maxSilenceAtStart: 0.5 # 最大开头静音 (秒)
  maxSilenceAtEnd: 1.0   # 最大结尾静音 (秒)
  sampleRate: 44100      # 期望采样率 (Hz)
  channels: 1            # 期望声道数 (1=单声道, 2=立体声)

namingRules:
  pattern: "^ep\\d{3}-[a-z0-9-]+\\.wav$"
  description: "文件名格式: epXXX-描述性名称.wav"

export:
  directory: "./output"

audioFiles:
  - id: "intro-001"
    path: "./audio/intro.wav"
    role: "intro"    # 角色: intro/main/ad/outro
    name: "片头"

chapters:
  - id: "chap-001"
    title: "开场问候"
    startTime: "0:00"
    audioRef: "intro-001"
\`\`\`

## 角色说明

| 角色 | 说明 |
|------|------|
| intro | 片头/开场白 |
| main | 正片/主要内容 |
| ad | 广告口播 |
| outro | 片尾/结束语 |

## 检查项目

- ✅ 文件存在性检查
- ✅ 命名规则检查
- ✅ 音频格式一致性（采样率、声道数）
- ✅ 响度检查（RMS 近似）
- ✅ 静音检测（开头/结尾）
- ✅ 章节时间验证

## 注意事项

⚠️ **响度计算说明**

本工具使用 **RMS（均方根）** 近似计算响度，而非专业的 LUFS。对于典型语音内容：
- RMS -20 dB ≈ 感知响度 -16 LUFS
- 这是一个近似值，用于快速检查一致性

如需专业级响度分析，请使用：
- Audacity（内置响度分析）
- ffmpeg + ebur128 滤镜
- 专业 DAW（Logic、Pro Tools 等）
`;

export async function runInit(options: InitOptions): Promise<void> {
  const {
    format = 'yaml',
    name = '我的播客',
    episode = 'EP001 - 第一期节目',
    output = '.',
    createAudioDir = true,
  } = options;

  const targetDir = path.resolve(output);
  const manifestName = format === 'yaml' ? 'manifest.yaml' : 'manifest.json';
  const manifestPath = path.join(targetDir, manifestName);

  console.log(chalk.blue('🚀 初始化播客交付体检项目...'));
  console.log(chalk.gray(`目标目录: ${targetDir}`));
  console.log('');

  if (await fs.pathExists(manifestPath)) {
    console.log(chalk.yellow(`⚠️  ${manifestName} 已存在，跳过生成`));
  } else {
    const manifest = generateSampleManifest();
    manifest.project.name = name;
    manifest.project.episode = episode;

    await writeManifestFile(manifest, manifestPath, format);
    console.log(chalk.green(`✅ 已创建: ${manifestName}`));
  }

  if (createAudioDir) {
    const audioDir = path.join(targetDir, 'audio');
    await fs.ensureDir(audioDir);
    
    const placeholderPath = path.join(audioDir, '.gitkeep');
    if (!(await fs.pathExists(placeholderPath))) {
      await fs.writeFile(placeholderPath, '', 'utf-8');
    }
    console.log(chalk.green(`✅ 已创建: audio/ 目录`));
  }

  const outputDir = path.join(targetDir, 'output');
  await fs.ensureDir(outputDir);
  console.log(chalk.green(`✅ 已创建: output/ 目录`));

  const readmePath = path.join(targetDir, 'README.md');
  if (!(await fs.pathExists(readmePath))) {
    await fs.writeFile(readmePath, README_CONTENT, 'utf-8');
    console.log(chalk.green(`✅ 已创建: README.md`));
  } else {
    console.log(chalk.yellow(`⚠️  README.md 已存在，跳过生成`));
  }

  console.log('');
  console.log(chalk.green('🎉 初始化完成！'));
  console.log('');
  console.log(chalk.cyan('下一步:'));
  console.log(chalk.gray('  1. 将音频文件放入 audio/ 目录'));
  console.log(chalk.gray('  2. 或运行: npm run generate-samples 生成示例音频'));
  console.log(chalk.gray('  3. 运行: pdc inspect manifest.yaml 查看音频信息'));
  console.log(chalk.gray('  4. 运行: pdc validate manifest.yaml 执行验证'));
  console.log('');
}
