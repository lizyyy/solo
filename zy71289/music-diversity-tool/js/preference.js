export function buildUserProfile(userListening, songs) {
  const tagCounts = {};
  const genreCounts = {};
  let totalListenMs = 0;
  userListening.listens.forEach(listen => {
    const song = songs.find(s => s.song_id === listen.song_id);
    if (!song) return;
    totalListenMs += listen.played_ms;
    song.tags.forEach(tag => {
      tagCounts[tag] = (tagCounts[tag] || 0) + listen.played_ms;
    });
    genreCounts[song.genre_primary] = (genreCounts[song.genre_primary] || 0) + listen.played_ms;
  });
  const totalMs = Object.values(tagCounts).reduce((a, b) => a + b, 0) || 1;
  const tagProfile = {};
  Object.entries(tagCounts).forEach(([tag, ms]) => {
    tagProfile[tag] = Math.round((ms / totalMs) * 1000) / 1000;
  });
  const genreProfile = {};
  Object.entries(genreCounts).forEach(([genre, ms]) => {
    genreProfile[genre] = Math.round((ms / totalMs) * 1000) / 1000;
  });
  return {
    user_id: userListening.user_id,
    total_listens: userListening.listens.length,
    total_listen_hours: Math.round((totalListenMs / 3600000) * 100) / 100,
    tag_profile: tagProfile,
    genre_profile: genreProfile,
    top_genres: Object.entries(genreProfile).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([g, r]) => ({ genre: g, ratio: r }))
  };
}

export function buildRecProfile(enrichedItems) {
  const tagCounts = {};
  const genreCounts = {};
  enrichedItems.forEach(item => {
    if (!item.song) return;
    item.song.tags.forEach(tag => {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    });
    genreCounts[item.song.genre_primary] = (genreCounts[item.song.genre_primary] || 0) + 1;
  });
  const total = enrichedItems.length || 1;
  const tagProfile = {};
  Object.entries(tagCounts).forEach(([tag, count]) => {
    tagProfile[tag] = Math.round((count / total) * 1000) / 1000;
  });
  const genreProfile = {};
  Object.entries(genreCounts).forEach(([genre, count]) => {
    genreProfile[genre] = Math.round((count / total) * 1000) / 1000;
  });
  return {
    tag_profile: tagProfile,
    genre_profile: genreProfile,
    top_genres: Object.entries(genreProfile).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([g, r]) => ({ genre: g, ratio: r }))
  };
}

export function computePreferenceMatch(userProfile, recProfile) {
  const allTags = new Set([...Object.keys(userProfile.tag_profile), ...Object.keys(recProfile.tag_profile)]);
  let dotProduct = 0;
  let userNorm = 0;
  let recNorm = 0;
  allTags.forEach(tag => {
    const u = userProfile.tag_profile[tag] || 0;
    const r = recProfile.tag_profile[tag] || 0;
    dotProduct += u * r;
    userNorm += u * u;
    recNorm += r * r;
  });
  const cosineSimilarity = (userNorm > 0 && recNorm > 0)
    ? Math.round((dotProduct / (Math.sqrt(userNorm) * Math.sqrt(recNorm))) * 1000) / 1000
    : 0;
  const allGenres = new Set([...Object.keys(userProfile.genre_profile), ...Object.keys(recProfile.genre_profile)]);
  const overrepresented = [];
  const underrepresented = [];
  allGenres.forEach(genre => {
    const uRatio = userProfile.genre_profile[genre] || 0;
    const rRatio = recProfile.genre_profile[genre] || 0;
    const diff = rRatio - uRatio;
    if (diff > 0.1) {
      overrepresented.push({ genre, user_ratio: uRatio, rec_ratio: rRatio, diff: Math.round(diff * 1000) / 1000 });
    } else if (diff < -0.1) {
      underrepresented.push({ genre, user_ratio: uRatio, rec_ratio: rRatio, diff: Math.round(diff * 1000) / 1000 });
    }
  });
  return {
    cosine_similarity: cosineSimilarity,
    overrepresented_genres: overrepresented.sort((a, b) => b.diff - a.diff),
    underrepresented_genres: underrepresented.sort((a, b) => a.diff - b.diff),
    user_top_genres: userProfile.top_genres,
    rec_top_genres: recProfile.top_genres
  };
}

export function computePreferenceMetrics(userListening, enrichedItems, songs) {
  const userProfile = buildUserProfile(userListening, songs);
  const recProfile = buildRecProfile(enrichedItems);
  const match = computePreferenceMatch(userProfile, recProfile);
  return {
    user_profile: userProfile,
    rec_profile: recProfile,
    match
  };
}

export function buildPreferenceTrace(metrics) {
  return {
    step: 'preference_matching',
    computed_at: new Date().toISOString(),
    input_refs: {
      user_listening: metrics.user_profile.user_id,
      rec_list: 'current_rec_list'
    },
    output: {
      cosine_similarity: metrics.match.cosine_similarity,
      overrepresented_count: metrics.match.overrepresented_genres.length,
      underrepresented_count: metrics.match.underrepresented_genres.length
    },
    detail_rows: [
      ...metrics.match.overrepresented_genres.map(g => ({
        type: 'overrepresented',
        genre: g.genre,
        user_ratio: g.user_ratio,
        rec_ratio: g.rec_ratio,
        diff: g.diff
      })),
      ...metrics.match.underrepresented_genres.map(g => ({
        type: 'underrepresented',
        genre: g.genre,
        user_ratio: g.user_ratio,
        rec_ratio: g.rec_ratio,
        diff: g.diff
      }))
    ]
  };
}
