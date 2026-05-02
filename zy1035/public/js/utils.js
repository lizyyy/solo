const Utils = {
  CHUNK_SIZE: 16 * 1024,

  formatSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  },

  formatSpeed(bytesPerSecond) {
    if (bytesPerSecond === 0) return '0 B/s';
    const k = 1024;
    const sizes = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
    const i = Math.floor(Math.log(bytesPerSecond) / Math.log(k));
    return parseFloat((bytesPerSecond / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  },

  formatTime(seconds) {
    if (seconds === Infinity || seconds < 0) return '--:--';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  },

  formatTimeMs(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  },

  generateId() {
    return 'id_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now().toString(36);
  },

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  },

  arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  },

  base64ToArrayBuffer(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  },

  arrayBufferToString(buffer) {
    return new TextDecoder().decode(buffer);
  },

  stringToArrayBuffer(str) {
    return new TextEncoder().encode(str).buffer;
  },

  concatArrayBuffers(...buffers) {
    const totalLength = buffers.reduce((acc, buf) => acc + buf.byteLength, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const buf of buffers) {
      result.set(new Uint8Array(buf), offset);
      offset += buf.byteLength;
    }
    return result.buffer;
  },

  async calculateSHA256(fileOrArrayBuffer) {
    let arrayBuffer;
    
    if (fileOrArrayBuffer instanceof File) {
      arrayBuffer = await fileOrArrayBuffer.arrayBuffer();
    } else if (fileOrArrayBuffer instanceof ArrayBuffer) {
      arrayBuffer = fileOrArrayBuffer;
    } else if (fileOrArrayBuffer instanceof Uint8Array) {
      arrayBuffer = fileOrArrayBuffer.buffer;
    } else {
      throw new Error('Unsupported input type');
    }

    const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
  },

  async verifySHA256(data, expectedHash) {
    const actualHash = await this.calculateSHA256(data);
    return {
      match: actualHash === expectedHash,
      actual: actualHash,
      expected: expectedHash
    };
  },

  triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  getFileExtension(filename) {
    const parts = filename.split('.');
    if (parts.length === 1) return '';
    return parts[parts.length - 1].toLowerCase();
  },

  getFileNameWithoutExtension(filename) {
    const lastDot = filename.lastIndexOf('.');
    if (lastDot === -1) return filename;
    return filename.substring(0, lastDot);
  }
};

window.Utils = Utils;
