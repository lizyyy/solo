'use strict';

const fs = require('fs-extra');
const exifParser = require('exif-parser');
const moment = require('moment');

function readExif(filePath) {
  try {
    const buffer = fs.readFileSync(filePath);
    const parser = exifParser.create(buffer);
    const result = parser.parse();
    
    return {
      hasExif: true,
      dateTime: extractDateTime(result),
      make: result.tags.Make,
      model: result.tags.Model,
      latitude: result.tags.GPSLatitude,
      longitude: result.tags.GPSLongitude,
      width: result.tags.ImageWidth,
      height: result.tags.ImageLength,
      raw: result.tags
    };
  } catch (error) {
    return {
      hasExif: false,
      dateTime: null,
      error: error.message
    };
  }
}

function extractDateTime(exifResult) {
  const tags = exifResult.tags;
  
  const candidates = [
    tags.DateTimeOriginal,
    tags.DateTimeDigitized,
    tags.DateTime
  ];
  
  for (const ts of candidates) {
    if (ts) {
      const date = moment.unix(ts);
      if (date.isValid()) {
        return date.format('YYYYMMDD_HHmmss');
      }
    }
  }
  
  return null;
}

function getFileTimestamp(filePath) {
  try {
    const stats = fs.statSync(filePath);
    const birthTime = stats.birthtime || stats.ctime;
    return moment(birthTime).format('YYYYMMDD_HHmmss');
  } catch {
    return moment().format('YYYYMMDD_HHmmss');
  }
}

function getFileHash(filePath) {
  try {
    const crypto = require('crypto');
    const hash = crypto.createHash('md5');
    const data = fs.readFileSync(filePath);
    hash.update(data);
    return hash.digest('hex');
  } catch {
    return null;
  }
}

module.exports = { readExif, getFileTimestamp, getFileHash };
