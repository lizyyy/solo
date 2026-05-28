export function explainRecommendation(item, skipRecords, userListening) {
  const songSkips = skipRecords.skips.filter(s => s.song_id === item.song_id);
  const songListens = userListening.listens.filter(l => l.song_id === item.song_id);
  const wasSkipped = songSkips.length > 0;
  const wasListened = songListens.some(l => l.play_ratio > 0.5);
  let userAction = '未交互';
  let actionDetail = null;
  if (wasSkipped && !wasListened) {
    userAction = '跳过';
    const avgPlayed = songSkips.reduce((a, s) => a + s.played_ms, 0) / songSkips.length;
    actionDetail = { skip_count: songSkips.length, avg_played_ms: Math.round(avgPlayed), reasons: [...new Set(songSkips.map(s => s.skip_reason))] };
  } else if (wasListened) {
    userAction = '收听';
    const avgRatio = songListens.reduce((a, l) => a + l.play_ratio, 0) / songListens.length;
    actionDetail = { listen_count: songListens.length, avg_play_ratio: Math.round(avgRatio * 100) / 100 };
  } else if (songListens.length > 0) {
    userAction = '部分收听';
    const avgRatio = songListens.reduce((a, l) => a + l.play_ratio, 0) / songListens.length;
    actionDetail = { listen_count: songListens.length, avg_play_ratio: Math.round(avgRatio * 100) / 100 };
  }
  return {
    rank: item.rank,
    song_id: item.song_id,
    title: item.song?.title,
    artist: item.song?.artist,
    genre_primary: item.song?.genre_primary,
    tags: item.song?.tags,
    popularity: item.song?.popularity,
    is_new: item.song?.is_new,
    release_date: item.song?.release_date,
    relevance_score: item.relevance_score,
    reason_code: item.reason_code,
    reason_text: item.reason_text,
    user_action: userAction,
    action_detail: actionDetail,
    trace: {
      rec_source: item.reason_code,
      song_ref: item.song_id,
      list_ref: 'current_rec_list'
    }
  };
}

export function explainAllRecommendations(enrichedItems, skipRecords, userListening) {
  return enrichedItems.map(item => explainRecommendation(item, skipRecords, userListening));
}

export function computeExplanationSummary(explanations) {
  const actionCounts = { '收听': 0, '跳过': 0, '部分收听': 0, '未交互': 0 };
  explanations.forEach(e => { actionCounts[e.user_action] = (actionCounts[e.user_action] || 0) + 1; });
  const reasonCounts = {};
  explanations.forEach(e => {
    reasonCounts[e.reason_code] = (reasonCounts[e.reason_code] || 0) + 1;
  });
  return {
    total: explanations.length,
    action_distribution: actionCounts,
    reason_distribution: reasonCounts,
    skip_rate: explanations.length > 0 ? Math.round((actionCounts['跳过'] / explanations.length) * 1000) / 1000 : 0,
    listen_rate: explanations.length > 0 ? Math.round((actionCounts['收听'] / explanations.length) * 1000) / 1000 : 0
  };
}

export function buildExplainTrace(explanations, summary) {
  return {
    step: 'list_explanation',
    computed_at: new Date().toISOString(),
    input_refs: {
      rec_items: 'current_rec_list',
      skip_records: 'current_skips',
      user_listening: 'current_listening'
    },
    output: {
      total: summary.total,
      skip_rate: summary.skip_rate,
      listen_rate: summary.listen_rate
    },
    detail_rows: explanations.map(e => ({
      rank: e.rank,
      song_id: e.song_id,
      title: e.title,
      reason_code: e.reason_code,
      reason_text: e.reason_text,
      user_action: e.user_action,
      relevance_score: e.relevance_score,
      trace: e.trace
    }))
  };
}
