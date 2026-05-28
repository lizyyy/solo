export function computeGenreDistribution(enrichedItems) {
  const dist = {};
  enrichedItems.forEach(item => {
    if (!item.song) return;
    item.song.tags.forEach(tag => {
      dist[tag] = (dist[tag] || 0) + 1;
    });
  });
  return dist;
}

export function computeShannonEntropy(dist) {
  const total = Object.values(dist).reduce((a, b) => a + b, 0);
  if (total === 0) return 0;
  let entropy = 0;
  Object.values(dist).forEach(count => {
    if (count === 0) return;
    const p = count / total;
    entropy -= p * Math.log2(p);
  });
  return Math.round(entropy * 1000) / 1000;
}

export function computeMaxEntropy(n) {
  if (n <= 1) return 0;
  return Math.round(Math.log2(n) * 1000) / 1000;
}

export function computeNormalizedEntropy(dist) {
  const entropy = computeShannonEntropy(dist);
  const maxEnt = computeMaxEntropy(Object.keys(dist).length);
  if (maxEnt === 0) return 0;
  return Math.round((entropy / maxEnt) * 1000) / 1000;
}

export function computeCoverage(enrichedItems, allSongs) {
  const recGenres = new Set();
  const allGenres = new Set();
  enrichedItems.forEach(item => {
    if (item.song) item.song.tags.forEach(t => recGenres.add(t));
  });
  allSongs.forEach(s => s.tags.forEach(t => allGenres.add(t)));
  if (allGenres.size === 0) return 0;
  return Math.round((recGenres.size / allGenres.size) * 1000) / 1000;
}

export function computeFreshness(enrichedItems, windowStart) {
  if (enrichedItems.length === 0) return { score: 0, newCount: 0, total: 0, newSongs: [] };
  const ws = new Date(windowStart);
  const thirtyDays = 30 * 24 * 60 * 60 * 1000;
  const newSongs = enrichedItems.filter(item => {
    if (!item.song) return false;
    const rd = new Date(item.song.release_date);
    return (ws - rd) < thirtyDays && rd <= ws;
  });
  return {
    score: enrichedItems.length > 0 ? Math.round((newSongs.length / enrichedItems.length) * 1000) / 1000 : 0,
    newCount: newSongs.length,
    total: enrichedItems.length,
    newSongs: newSongs.map(item => ({
      song_id: item.song_id,
      title: item.song?.title,
      artist: item.song?.artist,
      release_date: item.song?.release_date,
      rank: item.rank
    }))
  };
}

export function computeDiversityMetrics(enrichedItems, allSongs, windowStart) {
  const genreDist = computeGenreDistribution(enrichedItems);
  const entropy = computeShannonEntropy(genreDist);
  const maxEntropy = computeMaxEntropy(Object.keys(genreDist).length);
  const normalizedEntropy = computeNormalizedEntropy(genreDist);
  const coverage = computeCoverage(enrichedItems, allSongs);
  const freshness = computeFreshness(enrichedItems, windowStart);
  const dominantGenre = Object.entries(genreDist).sort((a, b) => b[1] - a[1])[0];
  return {
    genre_distribution: genreDist,
    entropy,
    max_entropy: maxEntropy,
    normalized_entropy: normalizedEntropy,
    coverage,
    freshness,
    dominant_genre: dominantGenre ? { genre: dominantGenre[0], count: dominantGenre[1], ratio: Math.round((dominantGenre[1] / enrichedItems.length) * 1000) / 1000 } : null,
    total_items: enrichedItems.length
  };
}

export function buildDiversityTrace(metrics, enrichedItems) {
  return {
    step: 'diversity_metrics',
    computed_at: new Date().toISOString(),
    input_refs: enrichedItems.map(i => i.song_id),
    output: {
      entropy: metrics.entropy,
      normalized_entropy: metrics.normalized_entropy,
      coverage: metrics.coverage,
      freshness_score: metrics.freshness.score
    },
    detail_rows: enrichedItems.map(item => ({
      rank: item.rank,
      song_id: item.song_id,
      title: item.song?.title,
      artist: item.song?.artist,
      genre_primary: item.song?.genre_primary,
      tags: item.song?.tags,
      popularity: item.song?.popularity,
      is_new: item.song?.is_new,
      relevance_score: item.relevance_score,
      reason_code: item.reason_code
    }))
  };
}
