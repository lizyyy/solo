const db = require('./db');

function createScreenshot(screenshot, callback) {
  const sql = `
    INSERT INTO ex_right_screenshots (
      record_id, screenshot_path, upload_operator,
      upload_time, remark
    ) VALUES (?, ?, ?, ?, ?)
  `;
  const params = [
    screenshot.record_id,
    screenshot.screenshot_path,
    screenshot.upload_operator,
    screenshot.upload_time,
    screenshot.remark || null
  ];
  db.run(sql, params, function(err) {
    callback(err, err ? null : this.lastID);
  });
}

function getScreenshotsByRecordId(recordId, callback) {
  const sql = `SELECT * FROM ex_right_screenshots WHERE record_id = ? ORDER BY upload_time DESC`;
  db.all(sql, [recordId], callback);
}

function getAllScreenshots(callback) {
  const sql = `SELECT * FROM ex_right_screenshots ORDER BY upload_time DESC`;
  db.all(sql, [], callback);
}

module.exports = {
  createScreenshot,
  getScreenshotsByRecordId,
  getAllScreenshots
};
