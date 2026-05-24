const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);

const VIDEO_EXTENSIONS = new Set([
  '.mp4', '.mkv', '.avi', '.mov', '.wmv', '.flv', '.webm',
  '.m4v', '.mpg', '.mpeg', '.ts', '.m2ts', '.ogv', '.3gp'
]);

async function checkFFprobe() {
  try {
    await execFileAsync('ffprobe', ['-version']);
    return true;
  } catch (err) {
    return false;
  }
}

async function probeFile(filePath, ffprobePath = 'ffprobe') {
  const args = [
    '-v', 'quiet',
    '-print_format', 'json',
    '-show_format',
    '-show_streams',
    '-show_frames',
    '-read_intervals', '%+#10',
    filePath
  ];

  try {
    const { stdout } = await execFileAsync(ffprobePath, args);
    const data = JSON.parse(stdout);
    return parseProbeData(data, filePath);
  } catch (err) {
    return {
      file: path.basename(filePath),
      path: filePath,
      error: err.message,
      success: false
    };
  }
}

function parseProbeData(data, filePath) {
  const format = data.format || {};
  const streams = data.streams || [];
  const frames = data.frames || [];

  const videoStreams = streams.filter(s => s.codec_type === 'video');
  const audioStreams = streams.filter(s => s.codec_type === 'audio');
  const subtitleStreams = streams.filter(s => s.codec_type === 'subtitle');

  const mainVideo = videoStreams[0] || {};
  const mainAudio = audioStreams[0] || null;

  const frameRates = extractFrameRates(frames, mainVideo);
  const isVFR = detectVFR(frameRates, mainVideo);

  return {
    file: path.basename(filePath),
    path: filePath,
    success: true,
    format: {
      name: format.format_name,
      duration: parseFloat(format.duration) || 0,
      size: parseInt(format.size) || 0,
      bitRate: parseInt(format.bit_rate) || 0
    },
    video: videoStreams.map(stream => ({
      index: stream.index,
      codec: stream.codec_name,
      codecLong: stream.codec_long_name,
      width: parseInt(stream.width) || 0,
      height: parseInt(stream.height) || 0,
      resolution: `${stream.width}x${stream.height}`,
      aspectRatio: stream.display_aspect_ratio || '0:0',
      frameRate: parseFrameRate(stream.r_frame_rate),
      avgFrameRate: parseFrameRate(stream.avg_frame_rate),
      bitRate: parseInt(stream.bit_rate) || 0,
      pixFmt: stream.pix_fmt,
      colorSpace: stream.color_space,
      colorTransfer: stream.color_transfer,
      colorPrimaries: stream.color_primaries
    })),
    audio: audioStreams.map(stream => ({
      index: stream.index,
      codec: stream.codec_name,
      codecLong: stream.codec_long_name,
      channels: parseInt(stream.channels) || 0,
      channelLayout: stream.channel_layout,
      sampleRate: parseInt(stream.sample_rate) || 0,
      bitRate: parseInt(stream.bit_rate) || 0,
      language: stream.tags?.language || 'und'
    })),
    subtitles: subtitleStreams.map(stream => ({
      index: stream.index,
      codec: stream.codec_name,
      language: stream.tags?.language || 'und',
      title: stream.tags?.title || '',
      isDefault: stream.disposition?.default === 1,
      isForced: stream.disposition?.forced === 1
    })),
    frameRateAnalysis: {
      isVFR,
      minFrameRate: frameRates.length > 0 ? Math.min(...frameRates) : 0,
      maxFrameRate: frameRates.length > 0 ? Math.max(...frameRates) : 0,
      avgFrameRate: frameRates.length > 0 
        ? frameRates.reduce((a, b) => a + b, 0) / frameRates.length 
        : 0,
      frameRateVariance: calculateVariance(frameRates),
      sampleCount: frameRates.length
    },
    hasAudio: audioStreams.length > 0,
    audioTrackCount: audioStreams.length,
    subtitleTrackCount: subtitleStreams.length,
    mainVideoIndex: mainVideo.index || 0,
    mainAudioIndex: mainAudio?.index ?? -1
  };
}

function parseFrameRate(rateStr) {
  if (!rateStr || rateStr === '0/0') return 0;
  const [num, den] = rateStr.split('/').map(Number);
  return den ? num / den : num;
}

function extractFrameRates(frames, videoStream) {
  const videoIndex = videoStream.index ?? 0;
  const rates = [];
  let lastPts = null;
  let lastPktDuration = null;

  for (const frame of frames) {
    if (frame.stream_index !== videoIndex) continue;
    
    if (frame.pkt_duration_time) {
      const duration = parseFloat(frame.pkt_duration_time);
      if (duration > 0) {
        rates.push(1 / duration);
      }
    }
    
    if (frame.pts_time !== undefined && lastPts !== null) {
      const delta = parseFloat(frame.pts_time) - lastPts;
      if (delta > 0) {
        rates.push(1 / delta);
      }
    }
    lastPts = parseFloat(frame.pts_time);
    lastPktDuration = parseFloat(frame.pkt_duration_time);
  }

  return rates.filter(r => r > 0 && r < 240);
}

function detectVFR(frameRates, videoStream) {
  if (frameRates.length < 5) {
    const rFrameRate = parseFrameRate(videoStream.r_frame_rate);
    const avgFrameRate = parseFrameRate(videoStream.avg_frame_rate);
    return Math.abs(rFrameRate - avgFrameRate) > 0.5;
  }

  const variance = calculateVariance(frameRates);
  const avg = frameRates.reduce((a, b) => a + b, 0) / frameRates.length;
  const cv = avg > 0 ? Math.sqrt(variance) / avg : 0;

  return cv > 0.05;
}

function calculateVariance(values) {
  if (values.length < 2) return 0;
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const squareDiffs = values.map(v => Math.pow(v - avg, 2));
  return squareDiffs.reduce((a, b) => a + b, 0) / values.length;
}

async function scanDirectory(dirPath) {
  const files = [];
  
  async function scan(currentPath) {
    const entries = await fs.promises.readdir(currentPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);
      
      if (entry.isDirectory()) {
        await scan(fullPath);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (VIDEO_EXTENSIONS.has(ext)) {
          files.push(fullPath);
        }
      }
    }
  }
  
  await scan(dirPath);
  return files;
}

async function probeDirectory(dirPath, options = {}) {
  const { 
    ffprobePath = 'ffprobe', 
    concurrency = 2,
    onProgress = null
  } = options;

  const files = await scanDirectory(dirPath);
  const results = [];
  let processed = 0;

  for (let i = 0; i < files.length; i += concurrency) {
    const batch = files.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map(file => probeFile(file, ffprobePath))
    );
    results.push(...batchResults);
    processed += batchResults.length;
    if (onProgress) onProgress(processed, files.length);
  }

  return results;
}

function loadProbeData(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const data = JSON.parse(content);
  
  if (Array.isArray(data)) {
    return data.map(item => {
      if (item.path) return parseProbeData(item, item.path);
      return item;
    });
  }
  
  if (data.path) return [parseProbeData(data, data.path)];
  return [data];
}

module.exports = {
  checkFFprobe,
  probeFile,
  probeDirectory,
  loadProbeData,
  scanDirectory,
  parseProbeData,
  VIDEO_EXTENSIONS
};
