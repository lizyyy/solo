const crypto = require('crypto');
const fs = require('fs-extra');

class HashService {
  async calculateFileHash(filePath, algorithm = 'sha256') {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash(algorithm);
      const stream = fs.createReadStream(filePath);

      stream.on('data', (data) => {
        hash.update(data);
      });

      stream.on('end', () => {
        resolve(hash.digest('hex'));
      });

      stream.on('error', (err) => {
        reject(err);
      });
    });
  }

  async verifyFileHash(filePath, expectedHash, algorithm = 'sha256') {
    const actualHash = await this.calculateFileHash(filePath, algorithm);
    return actualHash === expectedHash;
  }

  calculateStringHash(str, algorithm = 'sha256') {
    return crypto.createHash(algorithm).update(str).digest('hex');
  }
}

module.exports = new HashService();
