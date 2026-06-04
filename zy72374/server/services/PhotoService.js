const WorkPhoto = require('../models/WorkPhoto');
const store = require('../store/DataStore');
const { v4: uuidv4 } = require('uuid');

class PhotoService {
  static importPhotos(photoDataList, uploadedBy, importBatchId = null) {
    const batchId = importBatchId || uuidv4();
    const results = {
      batchId,
      imported: [],
      duplicates: [],
      errors: []
    };

    const existingKeys = new Set(
      store.findAll('photos').map(p => `${p.hash}_${p.timestamp || p.uploadTime}`)
    );

    photoDataList.forEach(photoData => {
      try {
        const photo = new WorkPhoto({
          ...photoData,
          uploadedBy,
          importBatchId: batchId
        });

        const dedupKey = photo.getDeduplicationKey();
        
        if (existingKeys.has(dedupKey)) {
          results.duplicates.push({
            fileName: photo.fileName,
            hash: photo.hash,
            reason: '图片已存在（相同内容和时间戳）'
          });
        } else {
          const saved = store.create('photos', photo.toJSON());
          existingKeys.add(dedupKey);
          results.imported.push(saved);
        }
      } catch (error) {
        results.errors.push({
          fileName: photoData.fileName,
          error: error.message
        });
      }
    });

    return results;
  }

  static getPhotoById(id) {
    return store.findById('photos', id);
  }

  static getPhotosByBatch(batchId) {
    return store.find('photos', p => p.importBatchId === batchId);
  }

  static getPhotosBySensorNumber(sensorNumber) {
    return store.find('photos', p => p.sensorNumbers.includes(sensorNumber));
  }

  static getPhotosByDateRange(startDate, endDate) {
    return store.find('photos', p => {
      const photoDate = p.timestamp || p.uploadTime;
      return photoDate >= startDate && photoDate <= endDate;
    });
  }

  static getAllPhotos() {
    return store.findAll('photos');
  }

  static getPendingPhotos() {
    return store.find('photos', p => p.status === 'pending_review');
  }

  static approvePhoto(id, reviewer) {
    const photoData = this.getPhotoById(id);
    if (!photoData) return null;
    
    const photo = new WorkPhoto(photoData);
    photo.approve(reviewer);
    return store.update('photos', id, photo.toJSON());
  }

  static rejectPhoto(id, reviewer, reason) {
    const photoData = this.getPhotoById(id);
    if (!photoData) return null;
    
    const photo = new WorkPhoto(photoData);
    photo.reject(reviewer, reason);
    return store.update('photos', id, photo.toJSON());
  }

  static updatePhotoSensorNumbers(id, sensorNumbers) {
    return store.update('photos', id, { sensorNumbers });
  }

  static addPhotoNote(id, note) {
    const photo = this.getPhotoById(id);
    if (!photo) return null;
    
    const updatedNotes = photo.notes 
      ? `${photo.notes}\n${note}` 
      : note;
    
    return store.update('photos', id, { notes: updatedNotes });
  }

  static checkForDuplicates(photoDataList) {
    const existingKeys = new Set(
      store.findAll('photos').map(p => `${p.hash}_${p.timestamp || p.uploadTime}`)
    );

    return photoDataList.map(photoData => {
      const photo = new WorkPhoto(photoData);
      const dedupKey = photo.getDeduplicationKey();
      
      return {
        fileName: photo.fileName,
        hash: photo.hash,
        isDuplicate: existingKeys.has(dedupKey)
      };
    });
  }

  static getDuplicatePhotos() {
    const photos = store.findAll('photos');
    const hashMap = new Map();
    
    photos.forEach(photo => {
      const key = photo.hash;
      if (!hashMap.has(key)) {
        hashMap.set(key, []);
      }
      hashMap.get(key).push(photo);
    });

    const duplicates = [];
    hashMap.forEach((group, hash) => {
      if (group.length > 1) {
        duplicates.push({
          hash,
          count: group.length,
          photos: group
        });
      }
    });

    return duplicates;
  }

  static deletePhoto(id) {
    return store.delete('photos', id);
  }

  static getPhotoTraceInfo(photoId) {
    const photo = this.getPhotoById(photoId);
    if (!photo) return null;

    const notes = store.find('notes', n => n.photoId === photoId);
    const heatLoads = store.find('heatLoads', h => h.photoIds.includes(photoId));

    return {
      photo,
      notes,
      referencedInHeatLoads: heatLoads
    };
  }
}

module.exports = PhotoService;
