const { getAllAttachments, deleteAttachment, ATTACHMENT_STATUS } = require('../models/attachment');

function cleanupExpiredAttachments() {
  const now = new Date();
  const attachments = getAllAttachments();
  let deletedCount = 0;

  for (const attachment of attachments) {
    const expiresAt = new Date(attachment.expiresAt);
    
    if (expiresAt < now) {
      if (attachment.status === ATTACHMENT_STATUS.ISOLATED ||
          attachment.status === ATTACHMENT_STATUS.SCANNING ||
          attachment.status === ATTACHMENT_STATUS.QUARANTINED ||
          attachment.status === ATTACHMENT_STATUS.FAILED) {
        deleteAttachment(attachment.id);
        deletedCount++;
      }
    }
  }

  return deletedCount;
}

module.exports = {
  cleanupExpiredAttachments
};
