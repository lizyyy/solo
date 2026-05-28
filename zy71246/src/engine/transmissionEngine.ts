import type { DataPacket, VisibilityWindow, ErrorDetail, GroundStation } from '../types/mission';

export interface ActiveDownload {
  packetId: string;
  windowId: string;
  stationId: string;
  startTime: number;
  totalBytes: number;
  downloadedBytes: number;
  bandwidth: number;
  status: 'downloading' | 'paused' | 'complete' | 'failed';
}

export interface TransmissionStats {
  totalPackets: number;
  downloadedPackets: number;
  failedPackets: number;
  totalData: number;
  downloadedData: number;
  downloadRate: number;
}

export function calculateDownloadTime(
  packetSize: number,
  bandwidth: number,
  efficiency: number = 0.85
): number {
  return (packetSize * 8) / (bandwidth * efficiency) * 1000;
}

export function calculateDownloadProgress(
  download: ActiveDownload,
  currentTime: number
): number {
  if (download.status === 'complete') return 100;
  if (download.status === 'failed') return 0;
  
  const elapsed = currentTime - download.startTime;
  const totalTime = calculateDownloadTime(download.totalBytes, download.bandwidth);
  const progress = Math.min(100, (elapsed / totalTime) * 100);
  
  return progress;
}

export function calculateTransmissionProgress(
  transmission: { startTime: number; totalDuration: number; progress: number },
  currentTime: number
): number {
  const elapsed = currentTime - transmission.startTime;
  const progress = Math.min(100, (elapsed / transmission.totalDuration) * 100);
  return Math.max(transmission.progress, progress);
}

export function updateDownloadProgress(
  download: ActiveDownload,
  currentTime: number
): ActiveDownload {
  const progress = calculateDownloadProgress(download, currentTime);
  const downloadedBytes = (progress / 100) * download.totalBytes;
  
  let status = download.status;
  if (progress >= 100) {
    status = 'complete';
  }
  
  return {
    ...download,
    downloadedBytes,
    status,
  };
}

export function detectPacketLoss(
  packet: DataPacket,
  window: VisibilityWindow,
  currentTime: number,
  downloadedPercent: number,
  station: GroundStation
): ErrorDetail | null {
  if (packet.isDownloaded) return null;
  if (currentTime < window.endTime) return null;
  
  if (downloadedPercent < 100) {
    return {
      errorType: 'data_packet_lost',
      dataPacketLost: {
        packetId: packet.id,
        windowId: window.id,
        reason: determineLossReason(packet, window, downloadedPercent, station),
        recoveredPercent: Math.floor(downloadedPercent),
      },
    };
  }
  
  return null;
}

function determineLossReason(
  packet: DataPacket,
  window: VisibilityWindow,
  downloadedPercent: number,
  station: GroundStation
): 'bandwidth_exceeded' | 'rain_fade' | 'storage_overflow' | 'ground_storage_failure' {
  const windowDuration = window.endTime - window.startTime;
  const requiredTime = calculateDownloadTime(packet.size, station.bandwidth);
  
  if (requiredTime > windowDuration * 0.9 && downloadedPercent < 80) {
    return 'bandwidth_exceeded';
  }
  
  if (downloadedPercent > 30 && downloadedPercent < 70) {
    return 'rain_fade';
  }
  
  if (downloadedPercent === 0) {
    return 'storage_overflow';
  }
  
  return 'ground_storage_failure';
}

export function getTransmissionStats(
  packets: DataPacket[],
  activeDownloads: ActiveDownload[]
): TransmissionStats {
  const downloadedPackets = packets.filter(p => p.isDownloaded);
  const failedPackets = activeDownloads.filter(d => d.status === 'failed');
  const totalData = packets.reduce((sum, p) => sum + p.size, 0);
  const downloadedData = downloadedPackets.reduce((sum, p) => sum + p.size, 0);
  const downloadRate = totalData > 0 ? (downloadedData / totalData) * 100 : 0;
  
  return {
    totalPackets: packets.length,
    downloadedPackets: downloadedPackets.length,
    failedPackets: failedPackets.length,
    totalData,
    downloadedData,
    downloadRate,
  };
}

export function canDownloadPacket(
  packet: DataPacket,
  window: VisibilityWindow,
  station: GroundStation,
  currentTime: number
): boolean {
  if (packet.isDownloaded) return false;
  
  const requiredTime = calculateDownloadTime(packet.size, station.bandwidth);
  const remainingTime = window.endTime - currentTime;
  
  return requiredTime <= remainingTime;
}

export function getPacketPriorityWeight(priority: DataPacket['priority']): number {
  const weights: Record<DataPacket['priority'], number> = {
    critical: 4,
    high: 3,
    medium: 2,
    low: 1,
  };
  return weights[priority];
}

export function sortPacketsByPriority(packets: DataPacket[]): DataPacket[] {
  return [...packets].sort((a, b) => {
    const weightA = getPacketPriorityWeight(a.priority);
    const weightB = getPacketPriorityWeight(b.priority);
    
    if (weightA !== weightB) return weightB - weightA;
    return a.deadline - b.deadline;
  });
}

export function getDownloadablePackets(
  packets: DataPacket[],
  window: VisibilityWindow,
  station: GroundStation,
  currentTime: number
): DataPacket[] {
  return sortPacketsByPriority(
    packets.filter(p => canDownloadPacket(p, window, station, currentTime) && !p.isDownloaded)
  );
}

export function simulateLinkDegradation(
  baseBandwidth: number,
  time: number,
  seed: number = 0
): number {
  const noise = Math.sin(time / 10000 + seed) * 0.2 + 0.8;
  const randomFactor = 0.9 + Math.random() * 0.2;
  return baseBandwidth * noise * randomFactor;
}

export function startDownload(
  packet: DataPacket,
  window: VisibilityWindow,
  station: GroundStation,
  currentTime: number
): ActiveDownload {
  return {
    packetId: packet.id,
    windowId: window.id,
    stationId: station.id,
    startTime: currentTime,
    totalBytes: packet.size,
    downloadedBytes: 0,
    bandwidth: station.bandwidth,
    status: 'downloading',
  };
}
