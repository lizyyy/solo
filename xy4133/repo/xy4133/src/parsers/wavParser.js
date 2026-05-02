import fs from 'fs';

export function parseWAVHeader(filePath) {
  const buffer = fs.readFileSync(filePath);
  
  if (buffer.length < 44) {
    throw new Error('WAV文件太小，无法读取头部信息');
  }
  
  const chunkId = buffer.toString('ascii', 0, 4);
  if (chunkId !== 'RIFF') {
    throw new Error('不是有效的WAV文件');
  }
  
  const format = buffer.toString('ascii', 8, 12);
  if (format !== 'WAVE') {
    throw new Error('不是有效的WAV文件');
  }
  
  let subchunk1Size = buffer.readUInt32LE(16);
  let audioFormat = buffer.readUInt16LE(20);
  let numChannels = buffer.readUInt16LE(22);
  let sampleRate = buffer.readUInt32LE(24);
  let byteRate = buffer.readUInt32LE(28);
  let blockAlign = buffer.readUInt16LE(32);
  let bitsPerSample = buffer.readUInt16LE(34);
  
  let dataOffset = 36 + subchunk1Size;
  let dataSize = 0;
  
  while (dataOffset + 8 <= buffer.length) {
    const subchunkId = buffer.toString('ascii', dataOffset, dataOffset + 4);
    const subchunkSize = buffer.readUInt32LE(dataOffset + 4);
    
    if (subchunkId === 'data') {
      dataSize = subchunkSize;
      break;
    }
    
    dataOffset += 8 + subchunkSize;
    if (dataOffset > buffer.length) {
      throw new Error('无法找到data区块');
    }
  }
  
  const totalSamples = dataSize / (bitsPerSample / 8);
  const duration = totalSamples / sampleRate;
  
  return {
    filePath,
    format,
    audioFormat,
    numChannels,
    sampleRate,
    byteRate,
    blockAlign,
    bitsPerSample,
    dataSize,
    totalSamples,
    duration: duration * 1000,
    durationSeconds: duration
  };
}

export function analyzeWAVLoudness(filePath, options = {}) {
  const {
    windowSize = 100,
    peakThreshold = -3,
    silenceThreshold = -50
  } = options;
  
  const header = parseWAVHeader(filePath);
  const buffer = fs.readFileSync(filePath);
  
  let dataOffset = 36 + buffer.readUInt32LE(16);
  while (dataOffset + 8 <= buffer.length) {
    const subchunkId = buffer.toString('ascii', dataOffset, dataOffset + 4);
    const subchunkSize = buffer.readUInt32LE(dataOffset + 4);
    if (subchunkId === 'data') {
      dataOffset += 8;
      break;
    }
    dataOffset += 8 + subchunkSize;
  }
  
  const samplesPerWindow = Math.floor((windowSize * header.sampleRate) / 1000);
  const bytesPerSample = header.bitsPerSample / 8;
  const samplesPerChannel = Math.floor((buffer.length - dataOffset) / bytesPerSample / header.numChannels);
  
  const loudnessAnalysis = {
    header,
    peaks: [],
    silenceRegions: [],
    maxPeakDb: -Infinity,
    avgRmsDb: 0,
    loudnessMoments: []
  };
  
  let totalRmsDb = 0;
  let windowCount = 0;
  
  for (let i = 0; i < samplesPerChannel; i += samplesPerWindow) {
    const windowStart = i;
    const windowEnd = Math.min(i + samplesPerWindow, samplesPerChannel);
    const windowSamples = windowEnd - windowStart;
    
    if (windowSamples < samplesPerWindow / 2) break;
    
    let sumSquares = 0;
    let maxSample = 0;
    
    for (let j = windowStart; j < windowEnd; j++) {
      const byteOffset = dataOffset + j * bytesPerSample * header.numChannels;
      let sampleValue = 0;
      
      for (let ch = 0; ch < header.numChannels; ch++) {
        const chByteOffset = byteOffset + ch * bytesPerSample;
        
        if (header.bitsPerSample === 16) {
          const val = buffer.readInt16LE(chByteOffset);
          sampleValue += Math.abs(val);
          maxSample = Math.max(maxSample, Math.abs(val));
        } else if (header.bitsPerSample === 24) {
          const val = buffer.readIntLE(chByteOffset, 3);
          sampleValue += Math.abs(val);
          maxSample = Math.max(maxSample, Math.abs(val));
        } else if (header.bitsPerSample === 32) {
          const val = buffer.readInt32LE(chByteOffset);
          sampleValue += Math.abs(val);
          maxSample = Math.max(maxSample, Math.abs(val));
        }
      }
      
      sampleValue /= header.numChannels;
      sumSquares += sampleValue * sampleValue;
    }
    
    const rms = Math.sqrt(sumSquares / windowSamples);
    const maxSampleValue = header.bitsPerSample === 16 ? 32767 : 
                           header.bitsPerSample === 24 ? 8388607 : 2147483647;
    
    const rmsDb = 20 * Math.log10(rms / maxSampleValue);
    const peakDb = 20 * Math.log10(maxSample / maxSampleValue);
    
    const startTime = (windowStart / header.sampleRate) * 1000;
    const endTime = (windowEnd / header.sampleRate) * 1000;
    
    loudnessAnalysis.loudnessMoments.push({
      startTime,
      endTime,
      rmsDb,
      peakDb
    });
    
    if (peakDb > loudnessAnalysis.maxPeakDb) {
      loudnessAnalysis.maxPeakDb = peakDb;
    }
    
    if (peakDb > peakThreshold) {
      loudnessAnalysis.peaks.push({
        startTime,
        endTime,
        peakDb,
        rmsDb
      });
    }
    
    if (rmsDb < silenceThreshold) {
      loudnessAnalysis.silenceRegions.push({
        startTime,
        endTime,
        rmsDb,
        duration: endTime - startTime
      });
    }
    
    totalRmsDb += rmsDb;
    windowCount++;
  }
  
  loudnessAnalysis.avgRmsDb = totalRmsDb / windowCount;
  
  loudnessAnalysis.silenceRegions = mergeAdjacentRegions(loudnessAnalysis.silenceRegions);
  
  return loudnessAnalysis;
}

function mergeAdjacentRegions(regions) {
  if (regions.length === 0) return [];
  
  const sorted = [...regions].sort((a, b) => a.startTime - b.startTime);
  const merged = [sorted[0]];
  
  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    const last = merged[merged.length - 1];
    
    const gap = current.startTime - last.endTime;
    
    if (gap < 500) {
      last.endTime = current.endTime;
      last.duration = last.endTime - last.startTime;
      last.rmsDb = Math.min(last.rmsDb, current.rmsDb);
    } else {
      merged.push(current);
    }
  }
  
  return merged;
}
