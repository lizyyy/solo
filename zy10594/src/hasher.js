const fs = require('fs');
const crypto = require('crypto');

class Hasher {
  constructor(options = {}) {
    this.options = {
      algorithm: options.algorithm || 'sha256',
      quickHashSize: options.quickHashSize || 8192,
      useQuickHash: options.useQuickHash !== false,
      concurrency: options.concurrency || 4,
    };
  }

  async hashFiles(files, progressCallback = null) {
    const results = {
      hashed: [],
      errors: [],
    };

    const queue = [...files];
    const workers = Math.min(this.options.concurrency, files.length);
    let processed = 0;

    const worker = async () => {
      while (queue.length > 0) {
        const file = queue.shift();
        try {
          const hashResult = await this._hashFile(file.path);
          results.hashed.push({
            ...file,
            hash: hashResult.full,
            quickHash: hashResult.quick,
            hashAlgorithm: this.options.algorithm,
            hashTimestamp: new Date().toISOString(),
          });
        } catch (error) {
          results.errors.push({
            type: 'hash_error',
            path: file.path,
            name: file.name,
            message: error.message,
            timestamp: new Date().toISOString(),
          });
        }
        processed++;
        if (progressCallback) {
          progressCallback(processed, files.length);
        }
      }
    };

    await Promise.all(Array(workers).fill(null).map(() => worker()));

    return results;
  }

  async _hashFile(filePath) {
    return new Promise((resolve, reject) => {
      const fullHasher = crypto.createHash(this.options.algorithm);
      const quickHasher = crypto.createHash(this.options.algorithm);
      
      let quickBytesRead = 0;
      let quickHashComputed = false;

      const stream = fs.createReadStream(filePath, { highWaterMark: 65536 });

      stream.on('data', (chunk) => {
        fullHasher.update(chunk);
        
        if (!quickHashComputed && this.options.useQuickHash) {
          const remaining = this.options.quickHashSize - quickBytesRead;
          if (chunk.length <= remaining) {
            quickHasher.update(chunk);
            quickBytesRead += chunk.length;
          } else {
              quickHasher.update(chunk.slice(0, remaining));
              quickBytesRead += remaining;
            }
            
            if (quickBytesRead >= this.options.quickHashSize) {
              quickHashComputed = true;
            }
        }
      });

      stream.on('end', () => {
        const fullHash = fullHasher.digest('hex');
        resolve({
          full: fullHash,
          quick: quickHashComputed ? quickHasher.digest('hex') : fullHash,
        });
      });

      stream.on('error', (error) => {
        reject(error);
      });
    });
  }

  async verifyHash(filePath, expectedHash) {
    try {
      const result = await this._hashFile(filePath);
      return {
        matches: result.full === expectedHash,
        actualHash: result.full,
        expectedHash,
      };
    } catch (error) {
      return {
        matches: false,
        error: error.message,
      };
    }
  }
}

module.exports = { Hasher };
