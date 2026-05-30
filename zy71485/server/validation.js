function validateISRC(isrc, db) {
  const issues = [];
  const warnings = [];
  
  if (!isrc || isrc.trim() === '') {
    issues.push('ISRC码为空');
    return { valid: false, issues, warnings, normalized: '' };
  }
  
  const cleanISRC = isrc.replace(/[^A-Z0-9]/g, '').toUpperCase();
  
  if (cleanISRC.length !== 12) {
    issues.push(`ISRC长度不正确，应为12位，实际${cleanISRC.length}位`);
  }
  
  const countryCode = cleanISRC.substring(0, 2);
  if (!/^[A-Z]{2}$/.test(countryCode)) {
    issues.push('国家代码格式错误，应为2位字母');
  }
  
  const registrantCode = cleanISRC.substring(2, 5);
  if (!/^[A-Z0-9]{3}$/.test(registrantCode)) {
    issues.push('注册者代码格式错误，应为3位字母数字');
  }
  
  const yearCode = cleanISRC.substring(5, 7);
  if (!/^[0-9]{2}$/.test(yearCode)) {
    issues.push('年份代码格式错误，应为2位数字');
  }
  
  const designationCode = cleanISRC.substring(7, 12);
  if (!/^[0-9]{5}$/.test(designationCode)) {
    issues.push('录制代码格式错误，应为5位数字');
  }
  
  if (db) {
    const existing = db.prepare('SELECT * FROM isrc_registry WHERE isrc = ?').get(cleanISRC);
    if (existing) {
      warnings.push(`ISRC已登记: ${existing.track_name} - ${existing.artist}`);
    }
  }
  
  return {
    valid: issues.length === 0,
    issues,
    warnings,
    normalized: cleanISRC
  };
}

function collectAuthors(lyricist, composer) {
  const issues = [];
  const warnings = [];
  
  if (!lyricist || lyricist.trim() === '') {
    issues.push('词作者为空');
  }
  
  if (!composer || composer.trim() === '') {
    issues.push('曲作者为空');
  }
  
  const separators = /[,;，；、/\\|]/;
  const lyricists = lyricist ? lyricist.split(separators).map(s => s.trim()).filter(s => s) : [];
  const composers = composer ? composer.split(separators).map(s => s.trim()).filter(s => s) : [];
  
  const allAuthors = [...new Set([...lyricists, ...composers])];
  
  const duplicateLyricists = lyricists.filter((a, i) => lyricists.indexOf(a) !== i);
  const duplicateComposers = composers.filter((a, i) => composers.indexOf(a) !== i);
  
  if (duplicateLyricists.length > 0) {
    warnings.push(`词作者重复: ${duplicateLyricists.join(', ')}`);
  }
  
  if (duplicateComposers.length > 0) {
    warnings.push(`曲作者重复: ${duplicateComposers.join(', ')}`);
  }
  
  if (allAuthors.length === 0) {
    issues.push('未识别到任何作者信息');
  }
  
  return {
    valid: issues.length === 0,
    issues,
    warnings,
    lyricists: [...new Set(lyricists)],
    composers: [...new Set(composers)],
    allAuthors,
    count: {
      lyricist: lyricists.length,
      composer: composers.length,
      total: allAuthors.length
    }
  };
}

function comparePlatformVersions(versions) {
  const issues = [];
  const warnings = [];
  
  if (!versions || versions.length === 0) {
    issues.push('平台版本信息为空');
    return { valid: false, issues, warnings, versions: [] };
  }
  
  const versionList = Array.isArray(versions) ? versions : [versions];
  const cleanVersions = versionList.map(v => {
    if (typeof v === 'string') {
      return v.split(/[,;，；|]/).map(s => s.trim()).filter(s => s);
    }
    return [v];
  }).flat();
  
  const uniqueVersions = [...new Set(cleanVersions)];
  
  const validVersions = ['正式版', '伴奏版', 'Instrumental', '纯音乐', 'Remix版', '电台版', 'Clean版', 'Explicit版', '现场版', 'Live版', '翻唱版', '合唱版', '独唱版'];
  
  const unknownVersions = uniqueVersions.filter(v => !validVersions.some(valid => 
    v.includes(valid) || valid.includes(v)
  ));
  
  if (unknownVersions.length > 0) {
    warnings.push(`未知版本类型: ${unknownVersions.join(', ')}`);
  }
  
  if (cleanVersions.length > uniqueVersions.length) {
    warnings.push('存在重复的平台版本');
  }
  
  if (uniqueVersions.length === 0) {
    issues.push('未识别到有效的平台版本');
  }
  
  return {
    valid: issues.length === 0,
    issues,
    warnings,
    versions: uniqueVersions,
    count: uniqueVersions.length
  };
}

function detectIssues(track, allTracks, db) {
  const issues = [];
  
  const isrcResult = validateISRC(track.isrc, db);
  if (isrcResult.issues.length > 0) {
    issues.push({ type: 'isrc', severity: 'error', message: isrcResult.issues.join('; ') });
  }
  if (isrcResult.warnings.length > 0) {
    issues.push({ type: 'isrc', severity: 'warning', message: isrcResult.warnings.join('; ') });
  }
  
  if (track.isrc && allTracks) {
    const sameISRC = allTracks.filter(t => t.isrc === track.isrc);
    if (sameISRC.length > 1) {
      const otherNames = sameISRC
        .filter(t => t !== track && t.track_name !== track.track_name)
        .map(t => t.track_name);
      if (otherNames.length > 0) {
        issues.push({ 
          type: 'isrc_duplicate', 
          severity: 'error', 
          message: `ISRC重复，其他曲目: ${otherNames.join(', ')}` 
        });
      } else if (sameISRC.length > 1) {
        issues.push({ 
          type: 'isrc_duplicate', 
          severity: 'warning', 
          message: `ISRC在列表中出现${sameISRC.length}次，请确认是否为同一曲目不同版本` 
        });
      }
    }
  }
  
  const authorResult = collectAuthors(track.lyricist, track.composer);
  if (authorResult.issues.length > 0) {
    issues.push({ type: 'author', severity: 'error', message: authorResult.issues.join('; ') });
  }
  if (authorResult.warnings.length > 0) {
    issues.push({ type: 'author', severity: 'warning', message: authorResult.warnings.join('; ') });
  }
  
  if (track.platform_version) {
    const platformResult = comparePlatformVersions([track.platform_version]);
    if (platformResult.warnings.length > 0) {
      issues.push({ type: 'platform', severity: 'warning', message: platformResult.warnings.join('; ') });
    }
    if (platformResult.issues.length > 0) {
      issues.push({ type: 'platform', severity: 'error', message: platformResult.issues.join('; ') });
    }
    
    if (track.platform_version.includes('|') || track.platform_version.includes(';')) {
      const versions = track.platform_version.split(/[|;]/).map(v => v.trim()).filter(v => v);
      issues.push({ 
        type: 'platform', 
        severity: 'info', 
        message: `包含${versions.length}个平台版本: ${versions.join(', ')}` 
      });
    }
  }
  
  if (!track.track_name || track.track_name.trim() === '') {
    issues.push({ type: 'track', severity: 'error', message: '曲目名称为空' });
  }
  
  if (!track.artist || track.artist.trim() === '') {
    issues.push({ type: 'artist', severity: 'warning', message: '演唱者为空' });
  }
  
  return issues;
}

module.exports = {
  validateISRC,
  collectAuthors,
  comparePlatformVersions,
  detectIssues
};
