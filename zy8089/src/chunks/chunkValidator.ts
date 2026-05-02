import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';
import { FirmwareManifest, ChunkValidationResult, ValidationError } from '../types';

function calculateSha256(filePath: string): string {
  const content = fs.readFileSync(filePath);
  return createHash('sha256').update(content).digest('hex');
}

export function validateChunks(manifest: FirmwareManifest, chunksDir: string): ChunkValidationResult {
  const errors: ValidationError[] = [];
  const duplicateChunks: number[] = [];
  const missingChunks: number[] = [];
  const hashMismatches: { index: number; expected: string; actual: string }[] = [];
  const outOfOrderChunks: number[] = [];

  if (!fs.existsSync(chunksDir)) {
    errors.push({
      code: 'CHUNKS_DIR_NOT_FOUND',
      message: `Chunks directory not found: ${chunksDir}`,
      severity: 'error'
    });
    return {
      isValid: false,
      errors,
      duplicateChunks,
      missingChunks,
      hashMismatches,
      outOfOrderChunks
    };
  }

  const files = fs.readdirSync(chunksDir);
  const chunkHashes = new Map<string, number[]>();

  manifest.chunks.forEach((chunk, index) => {
    const expectedIndex = index;
    if (chunk.index !== expectedIndex) {
      outOfOrderChunks.push(chunk.index);
      errors.push({
        code: 'CHUNK_OUT_OF_ORDER',
        message: `Chunk index ${chunk.index} should be ${expectedIndex}`,
        severity: 'error',
        affectedChunks: [chunk.index]
      });
    }

    const chunkPath = path.join(chunksDir, chunk.filename);
    
    if (!fs.existsSync(chunkPath)) {
      missingChunks.push(chunk.index);
      errors.push({
        code: 'CHUNK_FILE_MISSING',
        message: `Chunk file missing: ${chunk.filename}`,
        severity: 'error',
        affectedChunks: [chunk.index]
      });
      return;
    }

    const actualHash = calculateSha256(chunkPath);
    
    if (chunk.hash !== actualHash) {
      hashMismatches.push({ index: chunk.index, expected: chunk.hash, actual: actualHash });
      errors.push({
        code: 'CHUNK_HASH_MISMATCH',
        message: `Chunk ${chunk.index} hash mismatch: expected ${chunk.hash}, got ${actualHash}`,
        severity: 'error',
        affectedChunks: [chunk.index]
      });
    }

    if (!chunkHashes.has(chunk.hash)) {
      chunkHashes.set(chunk.hash, []);
    }
    chunkHashes.get(chunk.hash)!.push(chunk.index);
  });

  chunkHashes.forEach((indices, hash) => {
    if (indices.length > 1) {
      duplicateChunks.push(...indices);
      errors.push({
        code: 'DUPLICATE_CHUNKS',
        message: `Duplicate chunks detected: indices ${indices.join(', ')} have identical hash ${hash}`,
        severity: 'warning',
        affectedChunks: indices
      });
    }
  });

  const actualFiles = new Set(files.filter(f => f.endsWith('.bin') || f.match(/chunk_\d+/)));
  const expectedFiles = new Set(manifest.chunks.map(c => c.filename));
  
  actualFiles.forEach(file => {
    if (!expectedFiles.has(file)) {
      errors.push({
        code: 'EXTRA_CHUNK_FILE',
        message: `Extra chunk file found: ${file}`,
        severity: 'info'
      });
    }
  });

  const totalExpectedSize = manifest.chunks.reduce((sum, c) => sum + c.size, 0);
  if (totalExpectedSize !== manifest.totalSize) {
    errors.push({
      code: 'TOTAL_SIZE_MISMATCH',
      message: `Total chunks size (${totalExpectedSize}) does not match manifest totalSize (${manifest.totalSize})`,
      severity: 'error'
    });
  }

  return {
    isValid: errors.filter(e => e.severity === 'error').length === 0,
    errors,
    duplicateChunks,
    missingChunks,
    hashMismatches,
    outOfOrderChunks
  };
}
