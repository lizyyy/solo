import * as fs from 'fs-extra';
import { AudioInfo } from '../types';

export interface WavHeader {
  chunkId: string;
  chunkSize: number;
  format: string;
  subChunk1Id: string;
  subChunk1Size: number;
  audioFormat: number;
  numChannels: number;
  sampleRate: number;
  byteRate: number;
  blockAlign: number;
  bitsPerSample: number;
  dataChunkId: string;
  dataChunkSize: number;
  dataOffset: number;
}

export async function readWavHeader(filePath: string): Promise<WavHeader> {
  const fd = await fs.open(filePath, 'r');
  
  try {
    const buffer = Buffer.alloc(44);
    const { bytesRead } = await fs.read(fd, buffer, 0, 44, 0);
    
    if (bytesRead < 44) {
      throw new Error('文件太小，不是有效的 WAV 文件');
    }

    const chunkId = buffer.toString('ascii', 0, 4);
    if (chunkId !== 'RIFF') {
      throw new Error(`不是有效的 WAV 文件，期望 'RIFF'，得到 '${chunkId}'`);
    }

    const format = buffer.toString('ascii', 8, 12);
    if (format !== 'WAVE') {
      throw new Error(`不是有效的 WAVE 格式，期望 'WAVE'，得到 '${format}'`);
    }

    const subChunk1Id = buffer.toString('ascii', 12, 16);
    if (subChunk1Id !== 'fmt ') {
      throw new Error(`不是有效的 fmt 子块，期望 'fmt '，得到 '${subChunk1Id}'`);
    }

    const subChunk1Size = buffer.readUInt32LE(16);
    const audioFormat = buffer.readUInt16LE(20);
    const numChannels = buffer.readUInt16LE(22);
    const sampleRate = buffer.readUInt32LE(24);
    const byteRate = buffer.readUInt32LE(28);
    const blockAlign = buffer.readUInt16LE(32);
    const bitsPerSample = buffer.readUInt16LE(34);

    if (audioFormat !== 1) {
      throw new Error(`不支持的音频格式: ${audioFormat}，仅支持 PCM (1)`);
    }

    let dataOffset = 0;
    let dataChunkId = '';
    let dataChunkSize = 0;

    let scanOffset = 20 + subChunk1Size;
    let foundData = false;
    
    while (!foundData) {
      const scanBuffer = Buffer.alloc(8);
      const scanResult = await fs.read(fd, scanBuffer, 0, 8, scanOffset);
      
      if (scanResult.bytesRead < 8) {
        throw new Error('无法找到 data 子块');
      }

      const chunkIdCandidate = scanBuffer.toString('ascii', 0, 4);
      const chunkSizeCandidate = scanBuffer.readUInt32LE(4);

      if (chunkIdCandidate === 'data') {
        dataChunkId = chunkIdCandidate;
        dataChunkSize = chunkSizeCandidate;
        dataOffset = scanOffset + 8;
        foundData = true;
      } else {
        scanOffset += 8 + chunkSizeCandidate;
      }
    }

    return {
      chunkId,
      chunkSize: buffer.readUInt32LE(4),
      format,
      subChunk1Id,
      subChunk1Size,
      audioFormat,
      numChannels,
      sampleRate,
      byteRate,
      blockAlign,
      bitsPerSample,
      dataChunkId,
      dataChunkSize,
      dataOffset,
    };
  } finally {
    await fs.close(fd);
  }
}

export function calculateDuration(header: WavHeader): number {
  const bytesPerSample = header.bitsPerSample / 8;
  const totalSamples = header.dataChunkSize / (header.numChannels * bytesPerSample);
  return totalSamples / header.sampleRate;
}

export async function getAudioInfo(filePath: string): Promise<AudioInfo> {
  const exists = await fs.pathExists(filePath);
  
  if (!exists) {
    return {
      path: filePath,
      exists: false,
      duration: 0,
      sampleRate: 0,
      channels: 0,
      bitsPerSample: 0,
      fileSize: 0,
      format: 'unknown',
    };
  }

  const stat = await fs.stat(filePath);
  
  try {
    const header = await readWavHeader(filePath);
    const duration = calculateDuration(header);

    return {
      path: filePath,
      exists: true,
      duration,
      sampleRate: header.sampleRate,
      channels: header.numChannels,
      bitsPerSample: header.bitsPerSample,
      fileSize: stat.size,
      format: 'WAV',
    };
  } catch (error) {
    return {
      path: filePath,
      exists: true,
      duration: 0,
      sampleRate: 0,
      channels: 0,
      bitsPerSample: 0,
      fileSize: stat.size,
      format: 'unsupported',
    };
  }
}

export async function readAudioSamples(
  filePath: string,
  header: WavHeader,
  options: {
    startSample?: number;
    numSamples?: number;
  } = {}
): Promise<Float64Array[]> {
  const { startSample = 0, numSamples } = options;
  
  const bytesPerSample = header.bitsPerSample / 8;
  const bytesPerFrame = header.numChannels * bytesPerSample;
  
  const maxSamples = header.dataChunkSize / bytesPerFrame;
  const actualNumSamples = numSamples 
    ? Math.min(numSamples, maxSamples - startSample)
    : maxSamples - startSample;

  if (actualNumSamples <= 0) {
    return Array.from({ length: header.numChannels }, () => new Float64Array(0));
  }

  const startByte = header.dataOffset + startSample * bytesPerFrame;
  const bytesToRead = actualNumSamples * bytesPerFrame;

  const fd = await fs.open(filePath, 'r');
  
  try {
    const buffer = Buffer.alloc(bytesToRead);
    const { bytesRead } = await fs.read(fd, buffer, 0, bytesToRead, startByte);
    
    const actualSamplesRead = Math.floor(bytesRead / bytesPerFrame);
    
    const channels: Float64Array[] = Array.from(
      { length: header.numChannels },
      () => new Float64Array(actualSamplesRead)
    );

    const maxValue = Math.pow(2, header.bitsPerSample - 1);

    for (let i = 0; i < actualSamplesRead; i++) {
      for (let ch = 0; ch < header.numChannels; ch++) {
        const sampleOffset = i * bytesPerFrame + ch * bytesPerSample;
        
        let sampleValue: number;
        
        if (header.bitsPerSample === 16) {
          sampleValue = buffer.readInt16LE(sampleOffset);
        } else if (header.bitsPerSample === 24) {
          const int24 = buffer.readIntLE(sampleOffset, 3);
          sampleValue = int24 & 0x800000 ? int24 | 0xff000000 : int24;
        } else if (header.bitsPerSample === 32) {
          sampleValue = buffer.readInt32LE(sampleOffset);
        } else if (header.bitsPerSample === 8) {
          sampleValue = buffer.readUInt8(sampleOffset) - 128;
        } else {
          sampleValue = 0;
        }

        channels[ch][i] = sampleValue / maxValue;
      }
    }

    return channels;
  } finally {
    await fs.close(fd);
  }
}
