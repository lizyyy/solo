const fs = require('fs');
const path = require('path');
const { stringify } = require('csv-stringify/sync');
const store = require('../storage/store');
const { PROBLEM_STATUS } = require('../models/types');

function ensureDir(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

class Exporter {
  exportPublishList(outputPath, options = {}) {
    ensureDir(outputPath);
    const materials = store.getAllMaterials();
    const schedules = store.getAllSchedules();
    const problems = store.getAllProblems();
    const waivers = store.getAllWaivers();

    const scheduleMap = new Map(schedules.map(s => [s.materialId, s]));

    const publishList = materials.map(material => {
      const schedule = scheduleMap.get(material.id);
      const materialProblems = problems.filter(p => p.materialId === material.id);
      const openProblems = materialProblems.filter(p => p.status === PROBLEM_STATUS.OPEN);
      const waivedProblems = materialProblems.filter(p => p.status === PROBLEM_STATUS.WAIVED);

      const canPublish = openProblems.length === 0;
      const publishStatus = canPublish ? 'ready' : 'needs_review';

      return {
        material_id: material.id,
        source_id: material.sourceId,
        title: material.title,
        author: material.author,
        editor: material.editor,
        cover: material.cover,
        category: material.category,
        tags: material.tags.join(';'),
        publish_date: schedule?.publishDate || '',
        publish_time: schedule?.publishTime || '',
        schedule_status: schedule?.status || 'pending',
        publish_ready: canPublish ? 'Yes' : 'No',
        publish_status: publishStatus,
        open_problems_count: openProblems.length,
        waived_problems_count: waivedProblems.length,
        open_problems: openProblems.map(p => p.title).join('; '),
        waived_problems: waivedProblems.map(p => p.title).join('; ')
      };
    });

    let filteredList = publishList;
    if (options.editor) {
      filteredList = filteredList.filter(item =>
        item.editor && item.editor.includes(options.editor)
      );
    }
    if (options.date) {
      filteredList = filteredList.filter(item =>
        item.publish_date === options.date
      );
    }
    if (options.readyOnly) {
      filteredList = filteredList.filter(item => item.publish_ready === 'Yes');
    }
    if (options.needsReviewOnly) {
      filteredList = filteredList.filter(item => item.publish_ready === 'No');
    }

    if (options.sortByDate) {
      filteredList.sort((a, b) => {
        if (!a.publish_date) return 1;
        if (!b.publish_date) return -1;
        return a.publish_date.localeCompare(b.publish_date);
      });
    }

    const csv = stringify(filteredList, {
      header: true,
      columns: [
        'material_id',
        'source_id',
        'title',
        'author',
        'editor',
        'cover',
        'category',
        'tags',
        'publish_date',
        'publish_time',
        'schedule_status',
        'publish_ready',
        'publish_status',
        'open_problems_count',
        'waived_problems_count',
        'open_problems',
        'waived_problems'
      ]
    });

    fs.writeFileSync(outputPath, csv);
    return {
      total: filteredList.length,
      ready: filteredList.filter(i => i.publish_ready === 'Yes').length,
      needsReview: filteredList.filter(i => i.publish_ready === 'No').length,
      outputPath
    };
  }

  exportProblems(outputPath, options = {}) {
    ensureDir(outputPath);
    const materials = store.getAllMaterials();
    const problems = store.getAllProblems();

    const materialMap = new Map(materials.map(m => [m.id, m]));

    const problemsList = problems.map(problem => {
      const material = materialMap.get(problem.materialId);
      return {
        problem_id: problem.id,
        material_id: problem.materialId,
        material_title: material?.title || '',
        material_author: material?.author || '',
        material_editor: material?.editor || '',
        problem_type: problem.type,
        severity: problem.severity,
        title: problem.title,
        message: problem.message,
        status: problem.status,
        details: JSON.stringify(problem.details),
        created_at: problem.createdAt
      };
    });

    let filteredList = problemsList;
    if (options.editor) {
      filteredList = filteredList.filter(item =>
        item.material_editor && item.material_editor.includes(options.editor)
      );
    }
    if (options.status) {
      filteredList = filteredList.filter(item => item.status === options.status);
    }
    if (options.severity) {
      filteredList = filteredList.filter(item => item.severity === options.severity);
    }

    const csv = stringify(filteredList, {
      header: true,
      columns: [
        'problem_id',
        'material_id',
        'material_title',
        'material_author',
        'material_editor',
        'problem_type',
        'severity',
        'title',
        'message',
        'status',
        'details',
        'created_at'
      ]
    });

    fs.writeFileSync(outputPath, csv);
    return {
      total: filteredList.length,
      outputPath
    };
  }

  exportAll(outputDir) {
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const publishResult = this.exportPublishList(`${outputDir}/publish-list.csv`);
    const problemsResult = this.exportProblems(`${outputDir}/problems.csv`);

    return {
      publishList: publishResult,
      problems: problemsResult,
      outputDir
    };
  }
}

module.exports = new Exporter();