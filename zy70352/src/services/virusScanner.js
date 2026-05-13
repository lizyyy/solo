const { SCAN_RESULT } = require('../models/attachment');

function simulateVirusScan(attachment, forceResult = null) {
  if (forceResult) {
    return {
      result: forceResult,
      details: {
        scannedEngine: 'simulated',
        signatureVersion: 'v2026.05.13',
        ...(forceResult === SCAN_RESULT.CLEAN ? {
          message: 'Attachment is clean'
        } : {
          threatName: forceResult === SCAN_RESULT.INFECTED ? 'EICAR-Test-File' : 'Unknown-Threat',
          confidence: 95
        })
      }
    };
  }

  const filename = attachment.filename.toLowerCase();
  
  if (filename.includes('infected') || filename.includes('virus') || filename.includes('eicar')) {
    return {
      result: SCAN_RESULT.INFECTED,
      details: {
        scannedEngine: 'simulated',
        signatureVersion: 'v2026.05.13',
        threatName: 'EICAR-Test-File',
        confidence: 98
      }
    };
  }

  if (filename.includes('suspicious')) {
    return {
      result: SCAN_RESULT.SUSPICIOUS,
      details: {
        scannedEngine: 'simulated',
        signatureVersion: 'v2026.05.13',
        threatName: 'Unknown-Threat',
        confidence: 65
      }
    };
  }

  return {
    result: SCAN_RESULT.CLEAN,
    details: {
      scannedEngine: 'simulated',
      signatureVersion: 'v2026.05.13',
      message: 'Attachment is clean'
    }
  };
}

module.exports = {
  simulateVirusScan
};
