const fs = require('fs');
const { parse } = require('csv-parse/sync');
const { v4: uuidv4 } = require('uuid');
const store = require('../storage/store');

class Importer {
  parseCSV(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    return parse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    });
  }

  importMaterials(filePath) {
    const rows = this.parseCSV(filePath);
    const results = { added: 0, updated: 0, skipped: 0, items: [] };

    rows.forEach(row => {
      const sourceId = row.source_id || row.id || row.sourceId;
      const existing = store.getMaterialBySourceId(sourceId);

      const material = {
        id: existing ? existing.id : uuidv4(),
        sourceId: sourceId,
        title: row.title || '',
        author: row.author || '',
        editor: row.editor || '',
        cover: row.cover || row.cover_url || '',
        content: row.content || '',
        category: row.category || '',
        tags: row.tags ? row.tags.split(/[,;]/).map(t => t.trim()).filter(Boolean) : [],
        createdAt: existing ? existing.createdAt : new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      if (existing) {
        store.updateMaterial(existing.id, material);
        results.updated++;
        results.items.push({ status: 'updated', material });
      } else {
        store.addMaterial(material);
        results.added++;
        results.items.push({ status: 'added', material });
      }
    });

    return results;
  }

  importSchedules(filePath) {
    const rows = this.parseCSV(filePath);
    const results = { added: 0, updated: 0, skipped: 0, items: [] };

    rows.forEach(row => {
      const sourceId = row.source_id || row.material_id || row.materialId;
      const material = store.getMaterialBySourceId(sourceId);

      if (!material) {
        results.skipped++;
        results.items.push({ status: 'skipped', reason: 'material_not_found', sourceId });
        return;
      }

      const existing = store.getScheduleByMaterialId(material.id);
      const schedule = {
        id: existing ? existing.id : uuidv4(),
        materialId: material.id,
        sourceId: sourceId,
        publishDate: row.publish_date || row.publishDate || '',
        publishTime: row.publish_time || row.publishTime || '',
        status: row.status || 'pending',
        createdAt: existing ? existing.createdAt : new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      if (existing) {
        store.updateSchedule(material.id, schedule);
        results.updated++;
        results.items.push({ status: 'updated', schedule });
      } else {
        store.addSchedule(schedule);
        results.added++;
        results.items.push({ status: 'added', schedule });
      }
    });

    return results;
  }

  importSensitiveWords(filePath) {
    const rows = this.parseCSV(filePath);
    const words = rows.map(row => ({
      id: uuidv4(),
      word: (row.word || row.keyword || '').trim(),
      level: row.level || 'medium',
      category: row.category || '',
      createdAt: new Date().toISOString()
    })).filter(w => w.word);

    const added = store.addSensitiveWords(words);
    return {
      added: added.length,
      total: words.length,
      words: added
    };
  }
}

module.exports = new Importer();