export function checkFormat(shotList, metadata, rules) {
  const issues = [];
  const platformRules = rules.platforms || {};
  
  for (const shot of shotList) {
    const expectedName = shot.filename || shot.name;
    const platform = shot.platform || 'default';
    
    if (!expectedName) continue;
    
    const fileMetadata = findMetadata(metadata, expectedName);
    if (!fileMetadata) continue;
    
    const platformRule = platformRules[platform] || platformRules.default;
    if (!platformRule) continue;
    
    const width = parseInt(fileMetadata.width);
    const height = parseInt(fileMetadata.height);
    const bitRate = fileMetadata.bit_rate ? parseInt(fileMetadata.bit_rate) / 1000 : null;
    
    if (platformRule.resolution) {
      const [expectedWidth, expectedHeight] = platformRule.resolution.split('x').map(Number);
      
      if (width !== expectedWidth || height !== expectedHeight) {
        issues.push({
          type: 'format',
          severity: 'error',
          message: `画幅不达标: 期望 ${platformRule.resolution}, 实际 ${width}x${height}`,
          shotId: shot.id,
          filename: expectedName,
          platform,
          expectedResolution: platformRule.resolution,
          actualResolution: `${width}x${height}`
        });
      }
    }
    
    if (platformRule.minBitrate && bitRate) {
      const minBitrate = parseFloat(platformRule.minBitrate);
      if (bitRate < minBitrate) {
        issues.push({
          type: 'format',
          severity: 'error',
          message: `码率不达标: 期望 >= ${minBitrate}kbps, 实际 ${bitRate.toFixed(2)}kbps`,
          shotId: shot.id,
          filename: expectedName,
          platform,
          expectedMinBitrate: minBitrate,
          actualBitrate: bitRate
        });
      }
    }
    
    if (platformRule.maxBitrate && bitRate) {
      const maxBitrate = parseFloat(platformRule.maxBitrate);
      if (bitRate > maxBitrate) {
        issues.push({
          type: 'format',
          severity: 'warning',
          message: `码率偏高: 期望 <= ${maxBitrate}kbps, 实际 ${bitRate.toFixed(2)}kbps`,
          shotId: shot.id,
          filename: expectedName,
          platform,
          expectedMaxBitrate: maxBitrate,
          actualBitrate: bitRate
        });
      }
    }
  }
  
  return issues;
}

function findMetadata(metadata, filename) {
  if (!metadata) return null;
  
  const baseName = filename.toLowerCase().replace(/\.[^.]+$/, '');
  
  if (metadata.streams) {
    let firstVideoStream = null;
    for (const stream of metadata.streams) {
      if (stream.codec_type === 'video') {
        if (!firstVideoStream) firstVideoStream = stream;
        if (stream.tags?.filename) {
          const metaName = stream.tags.filename.toLowerCase().replace(/\.[^.]+$/, '');
          if (metaName === baseName) return stream;
        }
      }
    }
    return firstVideoStream;
  }
  
  return null;
}