const { v4: uuidv4 } = require('uuid');
const fs = require('fs-extra');
const path = require('path');
const { calculateHash, ensureDir, mergeChunks } = require('../utils/fileUtils');

const UPLOAD_DIR = path.join(process.cwd(), 'uploads');
const SESSION_DIR = path.join(UPLOAD_DIR, 'sessions');
const COMPLETED_DIR = path.join(UPLOAD_DIR, 'completed');
const SESSION_EXPIRY = 24 * 60 * 60 * 1000; // 24小时过期

let sessions = new Map();

async function init() {
  await ensureDir(UPLOAD_DIR);
  await ensureDir(SESSION_DIR);
  await ensureDir(COMPLETED_DIR);
  await loadSessions();
}

async function loadSessions() {
  const sessionFiles = await fs.readdir(SESSION_DIR);
  for (const fileName of sessionFiles) {
    if (fileName.endsWith('.json')) {
      const sessionId = fileName.replace('.json', '');
      try {
        const sessionData = await fs.readJson(path.join(SESSION_DIR, fileName));
        sessions.set(sessionId, sessionData);
      } catch (error) {
        console.error(`Failed to load session ${sessionId}:`, error);
      }
    }
  }
}

async function saveSession(sessionId) {
  const session = sessions.get(sessionId);
  if (session) {
    await fs.writeJson(
      path.join(SESSION_DIR, `${sessionId}.json`),
      session,
      { spaces: 2 }
    );
  }
}

function createSession({ fileName, fileSize, totalChunks, chunkSize, fileHash }) {
  const sessionId = uuidv4();
  const session = {
    sessionId,
    fileName,
    fileSize,
    totalChunks,
    chunkSize,
    fileHash,
    status: 'created',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    chunks: {},
    errors: [],
    lastError: null
  };
  
  sessions.set(sessionId, session);
  saveSession(sessionId);
  
  return {
    sessionId,
    status: session.status,
    createdAt: session.createdAt,
    expiresAt: session.createdAt + SESSION_EXPIRY
  };
}

async function uploadChunk(sessionId, chunkNumber, chunkBuffer, chunkHash) {
  const session = sessions.get(sessionId);
  
  if (!session) {
    return {
      success: false,
      error: 'SESSION_NOT_FOUND',
      message: '上传会话不存在，请重新创建会话'
    };
  }
  
  if (session.status === 'completed') {
    return {
      success: false,
      error: 'SESSION_ALREADY_COMPLETED',
      message: '上传已完成，无需再次上传'
    };
  }
  
  if (session.status === 'cancelled') {
    return {
      success: false,
      error: 'SESSION_CANCELLED',
      message: '会话已取消，请重新创建会话'
    };
  }
  
  if (Date.now() - session.createdAt > SESSION_EXPIRY) {
    session.status = 'expired';
    session.updatedAt = Date.now();
    await saveSession(sessionId);
    return {
      success: false,
      error: 'SESSION_EXPIRED',
      message: '会话已过期，请重新创建会话'
    };
  }
  
  if (chunkNumber < 1 || chunkNumber > session.totalChunks) {
    const error = {
      time: Date.now(),
      type: 'INVALID_CHUNK_NUMBER',
      message: `分片编号 ${chunkNumber} 无效，有效范围 1-${session.totalChunks}`
    };
    session.errors.push(error);
    session.lastError = error;
    session.updatedAt = Date.now();
    await saveSession(sessionId);
    return {
      success: false,
      error: 'INVALID_CHUNK_NUMBER',
      message: error.message
    };
  }
  
  const expectedChunkSize = chunkNumber === session.totalChunks 
    ? session.fileSize - (session.totalChunks - 1) * session.chunkSize
    : session.chunkSize;
  
  if (chunkBuffer.length !== expectedChunkSize) {
    const error = {
      time: Date.now(),
      type: 'INVALID_CHUNK_SIZE',
      message: `分片 ${chunkNumber} 大小无效，期望 ${expectedChunkSize} 字节，实际 ${chunkBuffer.length} 字节`
    };
    session.errors.push(error);
    session.lastError = error;
    session.updatedAt = Date.now();
    await saveSession(sessionId);
    return {
      success: false,
      error: 'INVALID_CHUNK_SIZE',
      message: error.message
    };
  }
  
  const actualHash = calculateHash(chunkBuffer);
  if (actualHash !== chunkHash) {
    const error = {
      time: Date.now(),
      type: 'CHUNK_HASH_MISMATCH',
      message: `分片 ${chunkNumber} 校验失败`
    };
    session.errors.push(error);
    session.lastError = error;
    session.updatedAt = Date.now();
    await saveSession(sessionId);
    return {
      success: false,
      error: 'CHUNK_HASH_MISMATCH',
      message: error.message
    };
  }
  
  if (session.chunks[chunkNumber]?.status === 'received') {
    return {
      success: true,
      message: `分片 ${chunkNumber} 已存在，跳过重复上传`
    };
  }
  
  const sessionDir = path.join(SESSION_DIR, sessionId);
  await ensureDir(sessionDir);
  
  const chunkPath = path.join(sessionDir, `chunk_${chunkNumber}`);
  await fs.writeFile(chunkPath, chunkBuffer);
  
  session.chunks[chunkNumber] = {
    chunkNumber,
    size: chunkBuffer.length,
    hash: actualHash,
    receivedAt: Date.now(),
    status: 'received'
  };
  
  session.updatedAt = Date.now();
  await saveSession(sessionId);
  
  return {
    success: true,
    message: `分片 ${chunkNumber} 上传成功`
  };
}

function getSessionStatus(sessionId) {
  const session = sessions.get(sessionId);
  
  if (!session) {
    return {
      success: false,
      error: 'SESSION_NOT_FOUND',
      message: '上传会话不存在'
    };
  }
  
  const receivedChunks = Object.keys(session.chunks)
    .filter(key => session.chunks[key].status === 'received')
    .map(Number)
    .sort((a, b) => a - b);
  
  const missingChunks = [];
  for (let i = 1; i <= session.totalChunks; i++) {
    if (!(session.chunks[i]?.status === 'received')) {
      missingChunks.push(i);
    }
  }
  
  const progress = (receivedChunks.length / session.totalChunks) * 100;
  
  return {
    success: true,
    sessionId,
    status: session.status,
    fileName: session.fileName,
    fileSize: session.fileSize,
    totalChunks: session.totalChunks,
    chunkSize: session.chunkSize,
    progress: progress.toFixed(2) + '%',
    receivedChunks,
    missingChunks,
    receivedCount: receivedChunks.length,
    missingCount: missingChunks.length,
    lastError: session.lastError,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    expiresAt: session.createdAt + SESSION_EXPIRY
  };
}

function listSessions() {
  const result = [];
  
  for (const [sessionId, session] of sessions.entries()) {
    const receivedChunks = Object.keys(session.chunks)
      .filter(key => session.chunks[key].status === 'received')
      .map(Number)
      .sort((a, b) => a - b);
    
    const missingChunks = [];
    for (let i = 1; i <= session.totalChunks; i++) {
      if (!session.chunks[i]?.status === 'received') {
        missingChunks.push(i);
      }
    }
    
    const progress = (receivedChunks.length / session.totalChunks) * 100;
    
    result.push({
      sessionId,
      status: session.status,
      fileName: session.fileName,
      fileSize: session.fileSize,
      totalChunks: session.totalChunks,
      progress: progress.toFixed(2) + '%',
      receivedCount: receivedChunks.length,
      missingCount: missingChunks.length,
      missingChunks,
      lastError: session.lastError,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      expiresAt: session.createdAt + SESSION_EXPIRY
    });
  }
  
  return result;
}

async function completeUpload(sessionId) {
  const session = sessions.get(sessionId);
  
  if (!session) {
    return {
      success: false,
      error: 'SESSION_NOT_FOUND',
      message: '上传会话不存在'
    };
  }
  
  if (session.status === 'completed') {
    return {
      success: false,
      error: 'SESSION_ALREADY_COMPLETED',
      message: '上传已完成，无需再次提交'
    };
  }
  
  if (session.status === 'cancelled') {
    return {
      success: false,
      error: 'SESSION_CANCELLED',
      message: '会话已取消，请重新创建会话'
    };
  }
  
  const missingChunks = [];
  for (let i = 1; i <= session.totalChunks; i++) {
    if (!(session.chunks[i]?.status === 'received')) {
      missingChunks.push(i);
    }
  }
  
  if (missingChunks.length > 0) {
    const error = {
      time: Date.now(),
      type: 'MISSING_CHUNKS',
      message: `缺少分片: ${missingChunks.join(', ')}`
    };
    session.errors.push(error);
    session.lastError = error;
    session.updatedAt = Date.now();
    await saveSession(sessionId);
    return {
      success: false,
      error: 'MISSING_CHUNKS',
      message: error.message,
      missingChunks
    };
  }
  
  const sessionDir = path.join(SESSION_DIR, sessionId);
  const chunkPaths = [];
  for (let i = 1; i <= session.totalChunks; i++) {
    chunkPaths.push(path.join(sessionDir, `chunk_${i}`));
  }
  
  const finalPath = path.join(COMPLETED_DIR, `${sessionId}_${session.fileName}`);
  await mergeChunks(chunkPaths, finalPath);
  
  const finalBuffer = await fs.readFile(finalPath);
  const finalHash = calculateHash(finalBuffer);
  
  if (finalHash !== session.fileHash) {
    const error = {
      time: Date.now(),
      type: 'FILE_HASH_MISMATCH',
      message: '最终文件校验失败，总校验和不匹配'
    };
    session.errors.push(error);
    session.lastError = error;
    session.updatedAt = Date.now();
    await saveSession(sessionId);
    return {
      success: false,
      error: 'FILE_HASH_MISMATCH',
      message: error.message,
      expectedHash: session.fileHash,
      actualHash: finalHash
    };
  }
  
  session.status = 'completed';
  session.finalFilePath = finalPath;
  session.finalFileHash = finalHash;
  session.completedAt = Date.now();
  session.updatedAt = Date.now();
  await saveSession(sessionId);
  
  return {
    success: true,
    message: '文件合并成功',
    sessionId,
    fileName: session.fileName,
    fileSize: session.fileSize,
    fileHash: finalHash,
    filePath: finalPath,
    completedAt: session.completedAt
  };
}

async function cancelUpload(sessionId) {
  const session = sessions.get(sessionId);
  
  if (!session) {
    return {
      success: false,
      error: 'SESSION_NOT_FOUND',
      message: '上传会话不存在'
    };
  }
  
  if (session.status === 'completed') {
    return {
      success: false,
      error: 'SESSION_ALREADY_COMPLETED',
      message: '上传已完成，无法取消'
    };
  }
  
  if (session.status === 'cancelled') {
    return {
      success: true,
      message: '会话已取消'
    };
  }
  
  session.status = 'cancelled';
  session.cancelledAt = Date.now();
  session.updatedAt = Date.now();
  await saveSession(sessionId);
  
  return {
    success: true,
    message: '会话已取消',
    sessionId
  };
}

async function cleanupExpiredSessions() {
  const now = Date.now();
  const expiredSessionIds = [];
  
  for (const [sessionId, session] of sessions.entries()) {
    if (session.status !== 'completed' && session.status !== 'cancelled') {
      if (now - session.createdAt > SESSION_EXPIRY) {
        expiredSessionIds.push(sessionId);
      }
    }
  }
  
  const cleanupResults = [];
  for (const sessionId of expiredSessionIds) {
    const session = sessions.get(sessionId);
    session.status = 'expired';
    session.updatedAt = now;
    await saveSession(sessionId);
    cleanupResults.push({
      sessionId,
      fileName: session.fileName,
      action: '标记为过期'
    });
  }
  
  return {
    success: true,
    cleaned: expiredSessionIds.length,
    results: cleanupResults
  };
}

async function getChunkRecords(sessionId) {
  const session = sessions.get(sessionId);
  
  if (!session) {
    return {
      success: false,
      error: 'SESSION_NOT_FOUND',
      message: '上传会话不存在'
    };
  }
  
  const records = Object.values(session.chunks)
    .sort((a, b) => a.chunkNumber - b.chunkNumber);
  
  return {
    success: true,
    sessionId,
    fileName: session.fileName,
    totalChunks: session.totalChunks,
    records
  };
}

module.exports = {
  init,
  createSession,
  uploadChunk,
  getSessionStatus,
  listSessions,
  completeUpload,
  cancelUpload,
  cleanupExpiredSessions,
  getChunkRecords
};
