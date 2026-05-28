const SEVERITY = { CRITICAL: 'critical', WARNING: 'warning', INFO: 'info' };

export function checkTagNarrowness(diversityMetrics, enrichedItems) {
  const warnings = [];
  const dominant = diversityMetrics.dominant_genre;
  if (dominant && dominant.ratio > 0.5) {
    const affectedSongs = enrichedItems.filter(item => item.song && item.song.tags.includes(dominant.genre));
    warnings.push({
      id: `tag_narrow_${dominant.genre}`,
      severity: dominant.ratio > 0.7 ? SEVERITY.CRITICAL : SEVERITY.WARNING,
      code: 'TAG_DOMINANCE',
      title: '标签过窄',
      description: `推荐列表中「${dominant.genre}」标签占比 ${Math.round(dominant.ratio * 100)}%，远超合理阈值(50%)`,
      metric: { genre: dominant.genre, ratio: dominant.ratio, threshold: 0.5 },
      affected_items: affectedSongs.map(s => ({
        song_id: s.song_id,
        title: s.song?.title,
        rank: s.rank
      })),
      remediation: `建议降低「${dominant.genre}」标签的推荐权重，增加其他风格歌曲的曝光比例，目标将单一标签占比控制在40%以内`
    });
  }
  if (diversityMetrics.normalized_entropy < 0.6) {
    warnings.push({
      id: 'low_entropy',
      severity: SEVERITY.WARNING,
      code: 'LOW_ENTROPY',
      title: '多样性熵值偏低',
      description: `归一化熵为 ${diversityMetrics.normalized_entropy}，低于0.6阈值，表明推荐风格集中度过高`,
      metric: { normalized_entropy: diversityMetrics.normalized_entropy, threshold: 0.6 },
      affected_items: [],
      remediation: '建议引入探索性推荐策略(e-greedy)，在保底相关性前提下增加随机风格曝光'
    });
  }
  return warnings;
}

export function checkPopularCrowding(enrichedItems) {
  const warnings = [];
  if (enrichedItems.length === 0) return warnings;
  const highPopThreshold = 70;
  const highPopItems = enrichedItems.filter(item => item.song && item.song.popularity >= highPopThreshold);
  const highPopRatio = highPopItems.length / enrichedItems.length;
  if (highPopRatio > 0.5) {
    warnings.push({
      id: 'popular_crowding',
      severity: highPopRatio > 0.7 ? SEVERITY.CRITICAL : SEVERITY.WARNING,
      code: 'POPULAR_CROWDING',
      title: '热门歌挤占',
      description: `推荐列表中热度≥${highPopThreshold}的歌曲占比 ${Math.round(highPopRatio * 100)}%，超出阈值(50%)`,
      metric: { high_pop_ratio: Math.round(highPopRatio * 1000) / 1000, threshold: 0.5, popularity_threshold: highPopThreshold },
      affected_items: highPopItems.map(item => ({
        song_id: item.song_id,
        title: item.song?.title,
        rank: item.rank,
        popularity: item.song?.popularity
      })),
      remediation: '建议对热度分数施加折扣因子(popularity_decay)，降低热门歌曲的推荐优先级，为中低热度歌曲腾出曝光位'
    });
  }
  return warnings;
}

export function checkNewSongExposure(freshness, enrichedItems) {
  const warnings = [];
  const newThreshold = 0.15;
  if (freshness.score < newThreshold) {
    warnings.push({
      id: 'new_song_deficit',
      severity: freshness.score < 0.05 ? SEVERITY.CRITICAL : SEVERITY.WARNING,
      code: 'NEW_SONG_DEFICIT',
      title: '新歌曝光不足',
      description: `推荐列表中新歌占比仅 ${Math.round(freshness.score * 100)}%，低于阈值(${Math.round(newThreshold * 100)}%)`,
      metric: { new_ratio: freshness.score, threshold: newThreshold, new_count: freshness.newCount, total: freshness.total },
      affected_items: freshness.newSongs.map(s => ({
        song_id: s.song_id,
        title: s.title,
        rank: s.rank,
        release_date: s.release_date
      })),
      remediation: '建议在推荐pipeline中增加新歌曝光slot(至少15%)，可使用bandit算法平衡探索与利用，确保新歌获得足够试听机会'
    });
  }
  return warnings;
}

export function computeExposureConstraints(diversityMetrics, enrichedItems) {
  const tagWarnings = checkTagNarrowness(diversityMetrics, enrichedItems);
  const popWarnings = checkPopularCrowding(enrichedItems);
  const newWarnings = checkNewSongExposure(diversityMetrics.freshness, enrichedItems);
  const allWarnings = [...tagWarnings, ...popWarnings, ...newWarnings];
  const criticalCount = allWarnings.filter(w => w.severity === SEVERITY.CRITICAL).length;
  const warningCount = allWarnings.filter(w => w.severity === SEVERITY.WARNING).length;
  const overallScore = Math.max(0, 1 - criticalCount * 0.3 - warningCount * 0.1);
  return {
    warnings: allWarnings,
    summary: {
      total: allWarnings.length,
      critical: criticalCount,
      warning: warningCount,
      overall_score: Math.round(overallScore * 1000) / 1000
    }
  };
}

export function buildExposureTrace(exposureResult) {
  return {
    step: 'exposure_constraints',
    computed_at: new Date().toISOString(),
    input_refs: {
      diversity_metrics: 'diversity_output',
      rec_items: 'current_rec_list'
    },
    output: {
      overall_score: exposureResult.summary.overall_score,
      total_warnings: exposureResult.summary.total,
      critical: exposureResult.summary.critical,
      warning: exposureResult.summary.warning
    },
    detail_rows: exposureResult.warnings.map(w => ({
      id: w.id,
      severity: w.severity,
      code: w.code,
      title: w.title,
      affected_count: w.affected_items.length,
      remediation: w.remediation
    }))
  };
}
