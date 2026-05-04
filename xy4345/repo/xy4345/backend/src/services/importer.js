const Papa = require('papaparse');
const programModel = require('../models/programModel');
const materialModel = require('../models/materialModel');
const authorizationModel = require('../models/authorizationModel');

const importer = {
  parseCSV: (fileContent) => {
    return new Promise((resolve, reject) => {
      Papa.parse(fileContent, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          if (results.errors.length > 0) {
            reject(results.errors);
          } else {
            resolve(results.data);
          }
        },
        error: (error) => {
          reject(error);
        }
      });
    });
  },

  importMusicLicenses: async (fileContent, programId) => {
    const data = typeof fileContent === 'string' 
      ? await this.parseCSV(fileContent) 
      : fileContent;
    
    const results = { success: 0, errors: [], items: [] };
    
    for (const row of data) {
      try {
        const materialData = {
          program_id: programId,
          type: 'music',
          name: row.name || row.track_name || row.music_name || 'Unknown Track',
          source: row.source || row.artist || row.source_url || null,
          duration: row.duration ? parseInt(row.duration) : null,
          metadata: row
        };
        
        const material = materialModel.create(materialData);
        
        if (row.holder_name || row.license_holder || row.rights_holder) {
          const authData = {
            program_id: programId,
            material_id: material.id,
            type: 'music',
            holder_name: row.holder_name || row.license_holder || row.rights_holder || 'Unknown',
            permission_type: row.permission_type || row.license_type || 'commercial',
            valid_from: row.valid_from || row.start_date || null,
            valid_until: row.valid_until || row.end_date || null,
            status: row.status || 'active',
            notes: row.notes || row.license_notes || null
          };
          
          const authorization = authorizationModel.create(authData);
          results.items.push({ material, authorization });
        } else {
          results.items.push({ material, authorization: null });
        }
        
        results.success++;
      } catch (error) {
        results.errors.push({ row: row, error: error.message });
      }
    }
    
    return results;
  },

  importMaterialReferences: (data, programId) => {
    const results = { success: 0, errors: [], items: [] };
    
    const materials = data.materials || data.clips || data;
    
    if (!Array.isArray(materials)) {
      results.errors.push({ error: 'Invalid JSON format: expected array of materials' });
      return results;
    }
    
    for (const item of materials) {
      try {
        const materialData = {
          program_id: programId,
          type: item.type || 'clip',
          name: item.name || item.title || 'Unknown Clip',
          source: item.source || item.source_url || item.original_source || null,
          duration: item.duration ? parseInt(item.duration) : null,
          metadata: item
        };
        
        const material = materialModel.create(materialData);
        
        if (item.authorization || item.permission) {
          const auth = item.authorization || item.permission;
          const authData = {
            program_id: programId,
            material_id: material.id,
            type: materialData.type,
            holder_name: auth.holder_name || auth.rights_holder || auth.owner || 'Unknown',
            permission_type: auth.permission_type || auth.type || 'fair_use',
            valid_from: auth.valid_from || null,
            valid_until: auth.valid_until || null,
            status: auth.status || 'active',
            notes: auth.notes || null
          };
          
          const authorization = authorizationModel.create(authData);
          results.items.push({ material, authorization });
        } else {
          results.items.push({ material, authorization: null });
        }
        
        results.success++;
      } catch (error) {
        results.errors.push({ item: item, error: error.message });
      }
    }
    
    return results;
  },

  importAdSchedule: (data, programId) => {
    const results = { success: 0, errors: [], items: [] };
    
    const ads = Array.isArray(data) ? data : (data.ads || data.schedule || []);
    
    for (const item of ads) {
      try {
        const duration = item.duration || item.length || 0;
        const maxDuration = 30;
        
        const materialData = {
          program_id: programId,
          type: 'ad',
          name: item.name || item.ad_name || item.title || 'Unknown Ad',
          source: item.sponsor || item.advertiser || null,
          duration: parseInt(duration),
          metadata: {
            ...item,
            timestamp: item.timestamp || item.time || item.start_time,
            is_over_limit: duration > maxDuration
          }
        };
        
        const material = materialModel.create(materialData);
        results.items.push({ material });
        results.success++;
      } catch (error) {
        results.errors.push({ item: item, error: error.message });
      }
    }
    
    return results;
  },

  importGuestAuthorization: (data, programId) => {
    const results = { success: 0, errors: [], items: [] };
    
    const guests = Array.isArray(data) ? data : (data.guests || data.authorizations || []);
    
    for (const item of guests) {
      try {
        const authData = {
          program_id: programId,
          material_id: null,
          type: 'guest',
          holder_name: item.name || item.guest_name || item.holder_name || 'Unknown Guest',
          permission_type: item.permission_type || item.type || 'full_release',
          valid_from: item.valid_from || item.sign_date || item.date || null,
          valid_until: item.valid_until || null,
          status: item.status || 'active',
          notes: item.notes || item.terms || item.restrictions || null
        };
        
        const authorization = authorizationModel.create(authData);
        results.items.push({ authorization });
        results.success++;
      } catch (error) {
        results.errors.push({ item: item, error: error.message });
      }
    }
    
    return results;
  }
};

module.exports = importer;
