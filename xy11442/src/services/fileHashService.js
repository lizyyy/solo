const crypto = require('crypto');
const fs = require('fs');

class FileHashService {
  static calculateFileHash(filePath) {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(filePath);
      
      stream.on('data', (data) => hash.update(data));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }

  static calculateBufferHash(buffer) {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }
}

module.exports = FileHashService;
