const { v4: uuidv4 } = require('uuid');
const { parseISO, isBefore, format, addDays, isSameDay } = require('date-fns');
const store = require('../storage/store');
const { GOLDEN_HOURS, PROBLEM_TYPES, PROBLEM_STATUS } = require('../models/types');

class Checker {
  constructor() {
    this.now = new Date();
  }

  generateProblemId(materialId, type, details = {}) {
    const detailStr = Object.entries(details)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([k, v]) => `${k}=${v}`)
      .join('|');
    return `${materialId}-${type}-${detailStr}`;
  }

  checkTitleDuplicates(materials) {
    const problems = [];
    const titleMap = new Map();

    materials.forEach(material => {
      const title = material.title.trim();
      if (!title) return;

      if (!titleMap.has(title)) {
        titleMap.set(title, []);
      }
      titleMap.get(title).push(material);
    });

    titleMap.forEach((mats, title) => {
      if (mats.length > 1) {
        mats.forEach(material => {
          const otherIds = mats.filter(m => m.id !== material.id).map(m => m.id);
          problems.push({
            id: this.generateProblemId(material.id, PROBLEM_TYPES.TITLE_DUPLICATE, { title }),
            materialId: material.id,
            type: PROBLEM_TYPES.TITLE_DUPLICATE,
            severity: 'high',
            title: '标题重复',
            message: `标题"${title}"与其他素材重复`,
            details: {
              title,
              duplicateWith: otherIds
            },
            status: PROBLEM_STATUS.OPEN,
            createdAt: new Date().toISOString()
          });
        });
      }
    });

    return problems;
  }

  checkCoverMissing(materials) {
    const problems = [];

    materials.forEach(material => {
      if (!material.cover || material.cover.trim() === '') {
        problems.push({
          id: this.generateProblemId(material.id, PROBLEM_TYPES.COVER_MISSING),
          materialId: material.id,
          type: PROBLEM_TYPES.COVER_MISSING,
          severity: 'medium',
          title: '封面缺失',
          message: '素材缺少封面图片',
          details: {},
          status: PROBLEM_STATUS.OPEN,
          createdAt: new Date().toISOString()
        });
      }
    });

    return problems;
  }

  isInGoldenHour(time) {
    if (!time) return false;
    return GOLDEN_HOURS.some(gh => {
      return time >= gh.start && time <= gh.end;
    });
  }

  checkScheduleConflicts(schedules, materials) {
    const problems = [];
    const materialMap = new Map(materials.map(m => [m.id, m]));

    const scheduleByDateTime = new Map();
    schedules.forEach(schedule => {
      const material = materialMap.get(schedule.materialId);
      if (!material || !schedule.publishDate) return;

      const key = `${schedule.publishDate}-${schedule.publishTime || 'default'}`;
      if (!scheduleByDateTime.has(key)) {
        scheduleByDateTime.set(key, []);
      }
      scheduleByDateTime.get(key).push({ schedule, material });
    });

    scheduleByDateTime.forEach((items, key) => {
      if (items.length > 1) {
        items.forEach(({ schedule, material }) => {
          const otherIds = items
            .filter(item => item.schedule.materialId !== schedule.materialId)
            .map(item => item.schedule.materialId);

          problems.push({
            id: this.generateProblemId(schedule.materialId, PROBLEM_TYPES.SCHEDULE_CONFLICT, {
              date: schedule.publishDate,
              time: schedule.publishTime
            }),
            materialId: schedule.materialId,
            type: PROBLEM_TYPES.SCHEDULE_CONFLICT,
            severity: 'high',
            title: '排期冲突',
            message: `${schedule.publishDate} ${schedule.publishTime || '(未指定时间)'} 与其他素材排期冲突`,
            details: {
              publishDate: schedule.publishDate,
              publishTime: schedule.publishTime,
              conflictWith: otherIds
            },
            status: PROBLEM_STATUS.OPEN,
            createdAt: new Date().toISOString()
          });
        });
      }
    });

    return problems;
  }

  checkSensitiveWords(materials, sensitiveWords) {
    const problems = [];
    const wordList = sensitiveWords.map(w => w.word);

    materials.forEach(material => {
      const textToCheck = `${material.title} ${material.content || ''}`;
      const matchedWords = wordList.filter(word =>
        word && textToCheck.includes(word)
      );

      if (matchedWords.length > 0) {
        const matchedInfo = matchedWords.map(word => {
          const sw = sensitiveWords.find(w => w.word === word);
          return {
            word,
            level: sw?.level || 'medium',
            category: sw?.category || ''
          };
        });

        problems.push({
          id: this.generateProblemId(material.id, PROBLEM_TYPES.SENSITIVE_WORD, {
            words: matchedWords.sort().join(',')
          }),
          materialId: material.id,
          type: PROBLEM_TYPES.SENSITIVE_WORD,
          severity: 'high',
          title: '敏感词命中',
          message: `命中敏感词: ${matchedWords.join(', ')}`,
          details: {
            matchedWords: matchedInfo
          },
          status: PROBLEM_STATUS.OPEN,
          createdAt: new Date().toISOString()
        });
      }
    });

    return problems;
  }

  checkGoldenHourConsecutive(schedules, materials) {
    const problems = [];
    const materialMap = new Map(materials.map(m => [m.id, m]));

    const sortedSchedules = schedules
      .filter(s => materialMap.has(s.materialId))
      .filter(s => this.isInGoldenHour(s.publishTime))
      .sort((a, b) => {
        if (a.publishDate !== b.publishDate) {
          return a.publishDate.localeCompare(b.publishDate);
        }
        return (a.publishTime || '').localeCompare(b.publishTime || '');
      });

    const authorSchedules = new Map();
    sortedSchedules.forEach(schedule => {
      const material = materialMap.get(schedule.materialId);
      const author = material.author || material.editor;
      if (!author) return;

      if (!authorSchedules.has(author)) {
        authorSchedules.set(author, []);
      }
      authorSchedules.get(author).push({ schedule, material });
    });

    authorSchedules.forEach((authorItems, author) => {
      for (let i = 1; i < authorItems.length; i++) {
        const current = authorItems[i];
        const prev = authorItems[i - 1];

        const currentDate = parseISO(current.schedule.publishDate);
        const prevDate = parseISO(prev.schedule.publishDate);
        const dayDiff = (currentDate - prevDate) / (1000 * 60 * 60 * 24);

        if (dayDiff <= 1) {
          [current, prev].forEach(item => {
            problems.push({
              id: this.generateProblemId(item.material.id, PROBLEM_TYPES.GOLDEN_HOUR_CONSECUTIVE, {
                author,
                date: item.schedule.publishDate
              }),
              materialId: item.material.id,
              type: PROBLEM_TYPES.GOLDEN_HOUR_CONSECUTIVE,
              severity: 'medium',
              title: '同一作者连续占用黄金时段',
              message: `作者"${author}"在${item.schedule.publishDate}的黄金时段排期，与相邻日期重复`,
              details: {
                author,
                consecutiveDates: [prev.schedule.publishDate, current.schedule.publishDate]
              },
              status: PROBLEM_STATUS.OPEN,
              createdAt: new Date().toISOString()
            });
          });
        }
      }
    });

    const uniqueProblems = [];
    const seen = new Set();
    problems.forEach(p => {
      const key = `${p.materialId}-${p.type}-${JSON.stringify(p.details)}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueProblems.push(p);
      }
    });

    return uniqueProblems;
  }

  checkWaiverExpired(problems, waivers) {
    const expiredProblems = [];

    problems.forEach(problem => {
      const relevantWaivers = waivers.filter(w => w.problemId === problem.id);
      if (relevantWaivers.length === 0) return;

      const latestWaiver = relevantWaivers.sort((a, b) =>
        new Date(b.expiresAt) - new Date(a.expiresAt)
      )[0];

      if (isBefore(parseISO(latestWaiver.expiresAt), this.now)) {
        expiredProblems.push({
          ...problem,
          id: this.generateProblemId(problem.materialId, PROBLEM_TYPES.WAIVER_EXPIRED, {
            originalProblemId: problem.id
          }),
          type: PROBLEM_TYPES.WAIVER_EXPIRED,
          title: '豁免已过期',
          message: `原问题"${problem.title}"的豁免已过期，需要重新处理`,
          severity: problem.severity,
          details: {
            originalProblemId: problem.id,
            originalType: problem.type,
            expiredWaiver: latestWaiver
          },
          status: PROBLEM_STATUS.OPEN
        });
      }
    });

    return expiredProblems;
  }

  applyWaivers(problems, waivers) {
    return problems.map(problem => {
      const relevantWaivers = waivers.filter(w => w.problemId === problem.id);
      if (relevantWaivers.length === 0) return problem;

      const latestWaiver = relevantWaivers.sort((a, b) =>
        new Date(b.expiresAt) - new Date(a.expiresAt)
      )[0];

      if (!isBefore(parseISO(latestWaiver.expiresAt), this.now)) {
        return {
          ...problem,
          status: PROBLEM_STATUS.WAIVED,
          waiver: latestWaiver
        };
      }

      return problem;
    });
  }

  run() {
    const materials = store.getAllMaterials();
    const schedules = store.getAllSchedules();
    const sensitiveWords = store.getAllSensitiveWords();
    const waivers = store.getAllWaivers();

    let allProblems = [];

    allProblems = allProblems.concat(this.checkTitleDuplicates(materials));
    allProblems = allProblems.concat(this.checkCoverMissing(materials));
    allProblems = allProblems.concat(this.checkScheduleConflicts(schedules, materials));
    allProblems = allProblems.concat(this.checkSensitiveWords(materials, sensitiveWords));
    allProblems = allProblems.concat(this.checkGoldenHourConsecutive(schedules, materials));

    allProblems = this.applyWaivers(allProblems, waivers);
    allProblems = allProblems.concat(this.checkWaiverExpired(allProblems, waivers));

    store.setProblems(allProblems);

    return {
      total: allProblems.length,
      open: allProblems.filter(p => p.status === PROBLEM_STATUS.OPEN).length,
      waived: allProblems.filter(p => p.status === PROBLEM_STATUS.WAIVED).length,
      problems: allProblems
    };
  }
}

module.exports = new Checker();