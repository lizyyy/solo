const { getDb } = require('../database/init');
const { addHistoryLog } = require('./historyService');

const STOPWORDS = new Set([
  '的', '了', '是', '在', '我', '有', '和', '就', '不', '人', '都', '一', '一个',
  '上', '也', '很', '到', '说', '要', '去', '你', '会', '着', '没有', '看', '好',
  '自己', '这', '那', '吗', '吧', '啊', '呢', '呀', '被', '给', '让', '又', '还',
  '他', '她', '它', '们', '但', '而', '如果', '或者', '与', '及', '等', '问题'
]);

function extractKeywords(text) {
  const cleanedText = text.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, ' ');
  
  const keywords = [];
  const chars = cleanedText.replace(/\s+/g, '');
  
  for (let len = 2; len <= 4; len++) {
    for (let i = 0; i <= chars.length - len; i++) {
      const word = chars.substring(i, i + len);
      if (!STOPWORDS.has(word) && word.length >= 2) {
        keywords.push(word);
      }
    }
  }

  const wordCount = {};
  keywords.forEach(word => {
    wordCount[word] = (wordCount[word] || 0) + 1;
  });

  return Object.entries(wordCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word]) => word);
}

function calculateSimilarity(text1, text2) {
  const keywords1 = extractKeywords(text1);
  const keywords2 = extractKeywords(text2);
  
  const set1 = new Set(keywords1);
  const set2 = new Set(keywords2);
  
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  
  if (union.size === 0) return 0;
  
  const jaccardSimilarity = intersection.size / union.size;
  
  const commonChars1 = [...text1].filter(c => text2.includes(c)).length;
  const charSimilarity = commonChars1 / Math.max(text1.length, text2.length);
  
  return jaccardSimilarity * 0.6 + charSimilarity * 0.4;
}

function generateClusterKey(complaints, timeWindowHours = 24) {
  if (complaints.length === 0) return null;
  
  const sortedComplaints = [...complaints].sort((a, b) => 
    new Date(a.created_at) - new Date(b.created_at)
  );
  
  const firstComplaint = sortedComplaints[0];
  const lastComplaint = sortedComplaints[sortedComplaints.length - 1];
  
  const primaryKeyword = findPrimaryKeyword(complaints);
  
  const startTime = new Date(firstComplaint.created_at);
  const endTime = new Date(lastComplaint.created_at);
  
  startTime.setMinutes(0, 0, 0);
  const timeBucket = Math.floor(startTime.getHours() / timeWindowHours);
  startTime.setHours(timeBucket * timeWindowHours);
  
  const dateStr = startTime.toISOString().split('T')[0];
  
  return `${dateStr}_${primaryKeyword || 'general'}`;
}

function findPrimaryKeyword(complaints) {
  const allText = complaints.map(c => c.content).join(' ');
  const keywords = extractKeywords(allText);
  return keywords[0] || null;
}

function generateClusterTitle(complaints, primaryKeyword) {
  if (primaryKeyword) {
    return `关于${primaryKeyword}问题的投诉`;
  }
  
  const firstComplaint = complaints[0];
  const sampleText = firstComplaint.content.substring(0, 30);
  return `${sampleText}...`;
}

function runClustering(options = {}) {
  const db = getDb();
  const { timeWindowHours = 24, similarityThreshold = 0.3, forceRerun = false } = options;
  
  console.log(`开始聚类分析... 时间窗口: ${timeWindowHours}小时, 相似度阈值: ${similarityThreshold}`);
  
  const pendingComplaints = db.prepare(`
    SELECT c.* FROM complaints c
    WHERE NOT EXISTS (
      SELECT 1 FROM cluster_members cm WHERE cm.complaint_id = c.id
    )
    ORDER BY c.created_at ASC
  `).all();
  
  console.log(`发现 ${pendingComplaints.length} 条待聚类投诉`);
  
  if (pendingComplaints.length === 0 && !forceRerun) {
    return { newClusters: 0, updatedClusters: 0, totalComplaints: 0 };
  }
  
  const allComplaints = forceRerun 
    ? db.prepare('SELECT * FROM complaints ORDER BY created_at ASC').all()
    : pendingComplaints;
  
  if (forceRerun) {
    db.prepare('DELETE FROM replies').run();
    db.prepare('DELETE FROM supervision_records').run();
    db.prepare('DELETE FROM ticket_merges').run();
    db.prepare('UPDATE tickets SET cluster_id = NULL').run();
    db.prepare('DELETE FROM tickets').run();
    db.prepare('DELETE FROM cluster_members').run();
    db.prepare('DELETE FROM clusters').run();
  }
  
  const clusters = [];
  const unassigned = [...allComplaints];
  
  while (unassigned.length > 0) {
    const current = unassigned.shift();
    const group = [current];
    
    let i = 0;
    while (i < unassigned.length) {
      const other = unassigned[i];
      
      const timeDiff = Math.abs(
        new Date(current.created_at) - new Date(other.created_at)
      ) / (1000 * 60 * 60);
      
      if (timeDiff <= timeWindowHours) {
        const similarity = calculateSimilarity(current.content, other.content);
        
        if (similarity >= similarityThreshold) {
          group.push(other);
          unassigned.splice(i, 1);
          continue;
        }
      }
      i++;
    }
    
    if (group.length >= 1) {
      clusters.push(group);
    }
  }
  
  let newClusterCount = 0;
  let updatedClusterCount = 0;
  let totalComplaintsProcessed = 0;
  
  const insertCluster = db.prepare(`
    INSERT INTO clusters (cluster_key, title, description, primary_keyword, 
                          time_window_start, time_window_end, complaint_count)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  
  const insertMember = db.prepare(`
    INSERT OR IGNORE INTO cluster_members (cluster_id, complaint_id, similarity_score)
    VALUES (?, ?, ?)
  `);
  
  const updateCluster = db.prepare(`
    UPDATE clusters 
    SET complaint_count = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);
  
  for (const group of clusters) {
    if (group.length === 0) continue;
    
    const primaryKeyword = findPrimaryKeyword(group);
    const clusterKey = generateClusterKey(group, timeWindowHours);
    
    let existingCluster = db.prepare(
      'SELECT * FROM clusters WHERE cluster_key = ?'
    ).get(clusterKey);
    
    let clusterId;
    
    if (!existingCluster) {
      const title = generateClusterTitle(group, primaryKeyword);
      const sortedDates = group.map(c => new Date(c.created_at))
        .sort((a, b) => a - b);
      
      const result = insertCluster.run(
        clusterKey,
        title,
        `共${group.length}条投诉`,
        primaryKeyword,
        sortedDates[0].toISOString(),
        sortedDates[sortedDates.length - 1].toISOString(),
        group.length
      );
      
      clusterId = result.lastInsertRowid;
      newClusterCount++;
      
      addHistoryLog(
        db,
        'cluster',
        clusterId,
        'create',
        null,
        JSON.stringify({ title, primaryKeyword, complaintCount: group.length })
      );
    } else {
      clusterId = existingCluster.id;
      updatedClusterCount++;
    }
    
    for (const complaint of group) {
      const mainComplaint = group[0];
      const similarity = complaint.id === mainComplaint.id 
        ? 1.0 
        : calculateSimilarity(mainComplaint.content, complaint.content);
      
      const result = insertMember.run(clusterId, complaint.id, similarity);
      
      if (result.changes > 0) {
        totalComplaintsProcessed++;
        
        addHistoryLog(
          db,
          'complaint',
          complaint.id,
          'assign_cluster',
          null,
          JSON.stringify({ clusterId, similarity })
        );
      }
    }
    
    const memberCount = db.prepare(
      'SELECT COUNT(*) as cnt FROM cluster_members WHERE cluster_id = ?'
    ).get(clusterId).cnt;
    
    updateCluster.run(memberCount, clusterId);
  }
  
  console.log(`聚类完成: 新建 ${newClusterCount} 个聚类, 更新 ${updatedClusterCount} 个聚类, 处理 ${totalComplaintsProcessed} 条投诉`);
  
  return {
    newClusters: newClusterCount,
    updatedClusters: updatedClusterCount,
    totalComplaints: totalComplaintsProcessed
  };
}

function getClustersWithDetails(options = {}) {
  const db = getDb();
  const { minComplaints = 1, includeMembers = true } = options;
  
  const clusters = db.prepare(`
    SELECT c.*, 
           (SELECT COUNT(*) FROM cluster_members cm WHERE cm.cluster_id = c.id) as member_count
    FROM clusters c
    ORDER BY c.updated_at DESC
  `).all();
  
  const filteredClusters = clusters.filter(c => c.member_count >= minComplaints);
  
  if (includeMembers) {
    for (const cluster of filteredClusters) {
      cluster.members = db.prepare(`
        SELECT cm.*, 
               c.complaint_no, c.citizen_name, c.content, c.created_at
        FROM cluster_members cm
        JOIN complaints c ON c.id = cm.complaint_id
        WHERE cm.cluster_id = ?
        ORDER BY cm.joined_at ASC
      `).all(cluster.id);
    }
  }
  
  return filteredClusters;
}

function getClusterById(clusterId) {
  const db = getDb();
  
  const cluster = db.prepare('SELECT * FROM clusters WHERE id = ?').get(clusterId);
  if (!cluster) return null;
  
  cluster.members = db.prepare(`
    SELECT cm.*, 
           c.complaint_no, c.citizen_name, c.citizen_phone,
           c.content, c.area, c.location, c.category, c.created_at
    FROM cluster_members cm
    JOIN complaints c ON c.id = cm.complaint_id
    WHERE cm.cluster_id = ?
    ORDER BY cm.joined_at ASC
  `).all(clusterId);
  
  return cluster;
}

module.exports = {
  extractKeywords,
  calculateSimilarity,
  runClustering,
  getClustersWithDetails,
  getClusterById,
  generateClusterKey,
  findPrimaryKeyword
};
