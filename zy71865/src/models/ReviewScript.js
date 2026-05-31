const { v4: uuidv4 } = require('uuid');

class ReviewSection {
  constructor(data) {
    this.id = data.id || uuidv4();
    this.knowledgePoint = data.knowledgePoint;
    this.title = data.title || '';
    this.summary = data.summary || '';
    this.questionNos = data.questionNos || [];
    this.commonMistakes = data.commonMistakes || [];
    this.teachingPoints = data.teachingPoints || [];
    this.supplementaryExamples = data.supplementaryExamples || [];
    this.screenshotNote = data.screenshotNote || '';
    this.teacherNotes = data.teacherNotes || '';
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
  }

  toJSON() {
    return {
      id: this.id,
      knowledgePoint: this.knowledgePoint,
      title: this.title,
      summary: this.summary,
      questionNos: this.questionNos,
      commonMistakes: this.commonMistakes,
      teachingPoints: this.teachingPoints,
      supplementaryExamples: this.supplementaryExamples,
      screenshotNote: this.screenshotNote,
      teacherNotes: this.teacherNotes,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

class ReviewScript {
  constructor() {
    this.id = uuidv4();
    this.sections = [];
    this.metadata = {
      title: '',
      examName: '',
      className: '',
      reviewer: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastReviewedAt: null,
      lastExportedAt: null,
      version: '1.0'
    };
    this.overallAnalysis = '';
    this.suggestions = '';
  }

  load(data) {
    this.id = data.id || this.id;
    if (data.metadata) {
      this.metadata = { ...this.metadata, ...data.metadata };
    }
    this.sections = (data.sections || []).map(s => new ReviewSection(s));
    this.overallAnalysis = data.overallAnalysis || '';
    this.suggestions = data.suggestions || '';
    return this;
  }

  addSection(sectionData) {
    const section = new ReviewSection(sectionData);
    this.sections.push(section);
    this.metadata.updatedAt = new Date().toISOString();
    return section;
  }

  updateSection(sectionId, updates) {
    const section = this.sections.find(s => s.id === sectionId);
    if (section) {
      Object.assign(section, updates, { updatedAt: new Date().toISOString() });
      this.metadata.updatedAt = new Date().toISOString();
    }
    return section;
  }

  findSectionByKnowledgePoint(kp) {
    return this.sections.find(s => s.knowledgePoint === kp);
  }

  markAsReviewed() {
    this.metadata.lastReviewedAt = new Date().toISOString();
    this.metadata.updatedAt = new Date().toISOString();
  }

  markAsExported() {
    this.metadata.lastExportedAt = new Date().toISOString();
    this.metadata.version = String(parseFloat(this.metadata.version) + 0.1);
    this.metadata.updatedAt = new Date().toISOString();
  }

  toJSON() {
    return {
      id: this.id,
      metadata: this.metadata,
      overallAnalysis: this.overallAnalysis,
      suggestions: this.suggestions,
      sections: this.sections.map(s => s.toJSON())
    };
  }

  toMarkdown(questionBank, mistakeCollection) {
    let md = `# ${this.metadata.title || '线性规划讲评稿'}\n\n`;
    md += `> 考试：${this.metadata.examName || '未命名考试\n`;
    md += `> 班级：${this.metadata.className || '未命名班级'}\n`;
    md += `> 讲评人：${this.metadata.reviewer || ''}\n`;
    md += `> 生成时间：${new Date().toLocaleString()}\n`;
    md += `> 版本：${this.metadata.version}\n\n`;

    if (this.overallAnalysis) {
      md += `## 整体分析\n\n${this.overallAnalysis}\n\n`;
    }

    for (const section of this.sections) {
      md += `## ${section.title || section.knowledgePoint}\n\n`;
      
      if (section.summary) {
        md += `### 考点分析\n\n${section.summary}\n\n`;
      }

      if (section.questionNos.length > 0) {
        md += `### 涉及题目\n\n`;
        for (const qNo of section.questionNos) {
          const question = questionBank.findByNo(qNo);
          md += `- **第${qNo}题**`;
          if (question) {
            const mistakes = mistakeCollection.findByQuestionNo(qNo);
            const wrongCount = mistakes.filter(m => m.finalJudgment === 'wrong').length;
            const correctCount = mistakes.filter(m => m.finalJudgment === 'correct').length;
            md += ` - 得分率: ${question.score}分 - 错误人数: ${wrongCount}人`;
          }
          md += '\n';
        }
        md += '\n';
      }

      if (section.commonMistakes.length > 0) {
        md += `### 常见错误\n\n`;
        for (const mistake of section.commonMistakes) {
          md += `- ${mistake}\n`;
        }
        md += '\n';
      }

      if (section.teachingPoints.length > 0) {
        md += `### 教学要点\n\n`;
        for (const point of section.teachingPoints) {
          md += `- ${point}\n`;
        }
        md += '\n';
      }

      if (section.screenshotNote) {
        md += `### 讲义截图备注\n\n${section.screenshotNote}\n\n`;
      }

      if (section.teacherNotes) {
        md += `### 教师备注\n\n${section.teacherNotes}\n\n`;
      }
    }

    if (this.suggestions) {
      md += `## 后续建议\n\n${this.suggestions}\n\n`;
    }

    return md;
  }
}

module.exports = { ReviewSection, ReviewScript };
