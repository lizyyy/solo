const GENRES = ['pop', 'rock', 'hiphop', 'electronic', 'jazz', 'classical', 'rnb', 'folk', 'metal', 'country', 'blues', 'reggae', 'latin', 'indie', 'punk'];
const REASON_CODES = ['collab_filter', 'content_based', 'popularity_boost', 'new_release_push', 'editorial_pick', 'session_context'];
const REASON_TEXT = {
  collab_filter: '相似用户偏好',
  content_based: '内容特征匹配',
  popularity_boost: '热度加权推荐',
  new_release_push: '新歌曝光推送',
  editorial_pick: '编辑精选',
  session_context: '场景上下文推荐'
};

const ARTIST_NAMES = ['Luna Wave', 'The Echoes', 'Neon Pulse', 'Jade Rivers', 'Solar Flare', 'Crimson Tide', 'Velvet Storm', 'Crystal Fox', 'Shadow Grove', 'Amber Sky', 'Midnight Sun', 'Iron Leaf', 'Silver Creek', 'Golden Haze', 'Frost Bite', 'Ocean Drive', 'Desert Rose', 'Thunder Road', 'Willow Song', 'Copper Moon'];
const SONG_TITLES = ['午夜幻梦', '星辰大海', '逆光飞行', '无声告别', '雨后晴天', '追风少年', '深海回响', '城市光影', '时光碎片', '破晓之歌', '流浪星火', '春风十里', '沉默频率', '银河漫步', '孤独旅程', '烈焰玫瑰', '云端漫步', '午夜列车', '海风呢喃', '自由之声'];

function uid(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function randomPick(arr, n) {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

function randomDate(start, end) {
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  return new Date(s + Math.random() * (e - s)).toISOString();
}

function generateSongs(count, windowStart, windowEnd) {
  const songs = [];
  for (let i = 0; i < count; i++) {
    const releaseDate = randomDate('2022-01-01', windowEnd);
    const rd = new Date(releaseDate);
    const ws = new Date(windowStart);
    const isNew = (ws - rd) < 30 * 24 * 60 * 60 * 1000 && rd <= ws;
    const tagCount = 1 + Math.floor(Math.random() * 3);
    const tags = randomPick(GENRES, tagCount);
    songs.push({
      song_id: `s${String(i + 1).padStart(3, '0')}`,
      title: SONG_TITLES[i % SONG_TITLES.length],
      artist: ARTIST_NAMES[i % ARTIST_NAMES.length],
      tags,
      genre_primary: tags[0],
      release_date: releaseDate.split('T')[0],
      popularity: Math.floor(Math.random() * 100),
      is_new: isNew
    });
  }
  return songs;
}

function generateUserListening(userId, songs, windowStart, windowEnd, count) {
  const listens = [];
  for (let i = 0; i < count; i++) {
    const song = songs[Math.floor(Math.random() * songs.length)];
    const duration = 180000 + Math.floor(Math.random() * 120000);
    const playRatio = 0.3 + Math.random() * 0.7;
    listens.push({
      song_id: song.song_id,
      timestamp: randomDate(windowStart, windowEnd),
      duration_ms: duration,
      played_ms: Math.floor(duration * playRatio),
      play_ratio: Math.round(playRatio * 100) / 100,
      source: randomPick(['recommendation', 'search', 'playlist', 'album'], 1)[0]
    });
  }
  return {
    user_id: userId,
    username: `user_${userId}`,
    listens: listens.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
  };
}

function generateRecommendationList(userId, songs, windowStart, windowEnd, listSize) {
  const biased = Math.random() < 0.5;
  let recSongs;
  if (biased) {
    const dominantGenre = randomPick(GENRES, 1)[0];
    const sameGenre = songs.filter(s => s.tags.includes(dominantGenre));
    const otherGenre = songs.filter(s => !s.tags.includes(dominantGenre));
    const dominantCount = Math.floor(listSize * (0.5 + Math.random() * 0.3));
    recSongs = [
      ...randomPick(sameGenre, Math.min(dominantCount, sameGenre.length)),
      ...randomPick(otherGenre, Math.min(listSize - dominantCount, otherGenre.length))
    ].slice(0, listSize);
  } else {
    recSongs = randomPick(songs, listSize);
  }
  const items = recSongs.map((song, idx) => {
    const reasonCode = randomPick(REASON_CODES, 1)[0];
    return {
      rank: idx + 1,
      song_id: song.song_id,
      relevance_score: Math.round((0.5 + Math.random() * 0.5) * 100) / 100,
      reason_code: reasonCode,
      reason_text: REASON_TEXT[reasonCode]
    };
  });
  return {
    list_id: uid('rec'),
    user_id: userId,
    generated_at: randomDate(windowStart, windowEnd),
    algorithm_version: 'v2.3',
    items
  };
}

function generateSkipRecords(userId, recList, songs, windowStart, windowEnd, count) {
  const skips = [];
  for (let i = 0; i < count; i++) {
    const item = recList.items[Math.floor(Math.random() * recList.items.length)];
    skips.push({
      song_id: item.song_id,
      timestamp: randomDate(windowStart, windowEnd),
      played_ms: Math.floor(Math.random() * 15000),
      list_id: recList.list_id,
      skip_reason: randomPick(['not_interested', 'wrong_mood', 'already_know', 'other'], 1)[0]
    });
  }
  return {
    user_id: userId,
    skips: skips.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
  };
}

export function generateSampleData() {
  const windowStart = '2024-01-01';
  const windowEnd = '2024-01-31';
  const songs = generateSongs(50, windowStart, windowEnd);
  const userId = 'u001';
  const userListening = generateUserListening(userId, songs, windowStart, windowEnd, 120);
  const recList = generateRecommendationList(userId, songs, windowStart, windowEnd, 20);
  const skipRecords = generateSkipRecords(userId, recList, songs, windowStart, windowEnd, 30);
  const timeWindow = {
    window_id: uid('win'),
    start_date: windowStart,
    end_date: windowEnd,
    label: '2024年1月'
  };
  return {
    songs,
    userListening,
    recList,
    skipRecords,
    timeWindow,
    _meta: {
      imported_at: new Date().toISOString(),
      source: 'sample_generator',
      ref_ids: {
        songs: 'sample_songs_v1',
        user_listening: 'sample_listening_v1',
        rec_list: recList.list_id,
        skip_records: 'sample_skips_v1',
        time_window: timeWindow.window_id
      }
    }
  };
}

export function importFromJSON(text) {
  try {
    const data = JSON.parse(text);
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

export function getSongById(songs, songId) {
  return songs.find(s => s.song_id === songId);
}

export function enrichRecItems(recList, songs) {
  return recList.items.map(item => {
    const song = getSongById(songs, item.song_id);
    return { ...item, song: song || null };
  });
}

export { GENRES, REASON_CODES, REASON_TEXT };
