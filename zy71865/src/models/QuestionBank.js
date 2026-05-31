const { v4: uuidv4 } = require('uuid');

class Question {
  constructor(data) {
    this.id = data.id || uuidv4();
    this.questionNo = data.questionNo;
    this.content = data.content;
    this.standardAnswer = data.standardAnswer;
    this.equivalentAnswers = data.equivalentAnswers || [];
    this.knowledgePoint = data.knowledgePoint;
    this.difficulty = data.difficulty || 'medium';
    this.score = data.score || 0;
    this.notes = data.notes || '';
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
  }

  checkAnswer(studentAnswer) {
    const normalized = this.normalize(studentAnswer);
    const standard = this.normalize(this.standardAnswer);
    
    if (normalized === standard) {
      return { correct: true, matchType: 'exact' };
    }
    
    for (const eq of this.equivalentAnswers) {
      if (normalized === this.normalize(eq)) {
        return { correct: true, matchType: 'equivalent', matchedAnswer: eq };
      }
    }
    
    return { correct: false, matchType: 'none' };
  }

  normalize(answer) {
    if (typeof answer !== 'string') return String(answer);
    return answer
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/，/g, ',')
      .replace(/。/g, '.')
      .replace(/；/g, ';')
      .replace(/：/g, ':');
  }

  toJSON() {
    return {
      id: this.id,
      questionNo: this.questionNo,
      content: this.content,
      standardAnswer: this.standardAnswer,
      equivalentAnswers: this.equivalentAnswers,
      knowledgePoint: this.knowledgePoint,
      difficulty: this.difficulty,
      score: this.score,
      notes: this.notes,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

class QuestionBank {
  constructor() {
    this.questions = [];
    this.metadata = {
      name: '',
      subject: '数学',
      chapter: '线性规划',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  load(data) {
    if (data.metadata) {
      this.metadata = { ...this.metadata, ...data.metadata };
    }
    this.questions = (data.questions || []).map(q => new Question(q));
    return this;
  }

  addQuestion(questionData) {
    const question = new Question(questionData);
    this.questions.push(question);
    this.metadata.updatedAt = new Date().toISOString();
    return question;
  }

  findByNo(questionNo) {
    return this.questions.find(q => q.questionNo === questionNo);
  }

  findById(id) {
    return this.questions.find(q => q.id === id);
  }

  findByKnowledgePoint(kp) {
    return this.questions.filter(q => q.knowledgePoint === kp);
  }

  getAllKnowledgePoints() {
    const kps = new Set(this.questions.map(q => q.knowledgePoint).filter(Boolean));
    return Array.from(kps);
  }

  toJSON() {
    return {
      metadata: this.metadata,
      questions: this.questions.map(q => q.toJSON())
    };
  }
}

module.exports = { Question, QuestionBank };
