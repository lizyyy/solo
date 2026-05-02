import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { useQuestions, useReview } from '../../context/AppContext';
import { Subject, Blank, Question } from '../../types';
import { subjects, subjectColors } from '../../data/mockData';
import { isReviewDue } from '../../utils/reviewAlgorithm';
import './QuestionBank.css';

interface NewQuestionForm {
  subject: Subject;
  content: string;
  blanks: { answer: string; hint: string }[];
  answer: string;
  explanation: string;
  tags: string;
}

type FilterType = 'all' | 'reviewed' | 'due' | 'mastered';

const initialForm: NewQuestionForm = {
  subject: '语文',
  content: '',
  blanks: [],
  answer: '',
  explanation: '',
  tags: ''
};

export const QuestionBank: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { questions, addQuestion, searchQuestions, getQuestionsBySubject } = useQuestions();
  const { getReviewRecordByQuestionId } = useReview();

  const [selectedSubject, setSelectedSubject] = useState<Subject | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<NewQuestionForm>(initialForm);
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');

  useEffect(() => {
    const filterParam = searchParams.get('filter') as FilterType;
    if (filterParam && ['all', 'reviewed', 'due', 'mastered'].includes(filterParam)) {
      setActiveFilter(filterParam);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const filterByReviewStatus = (questionList: Question[]): Question[] => {
    return questionList.filter(question => {
      const record = getReviewRecordByQuestionId(question.id);
      
      switch (activeFilter) {
        case 'all':
          return true;
        case 'reviewed':
          return !!record;
        case 'due':
          return !record || isReviewDue(record.nextReviewDate);
        case 'mastered':
          return !!record && record.familiarity === '认识' && record.reviewCount >= 3 && !isReviewDue(record.nextReviewDate);
        default:
          return true;
      }
    });
  };

  const filteredQuestions = useMemo(() => {
    let result = questions;

    if (selectedSubject !== 'all') {
      result = getQuestionsBySubject(selectedSubject);
    }

    if (searchQuery.trim()) {
      result = searchQuestions(searchQuery);
    }

    result = filterByReviewStatus(result);

    return result;
  }, [questions, selectedSubject, searchQuery, activeFilter, getQuestionsBySubject, searchQuestions, getReviewRecordByQuestionId]);

  const handleContentChange = (value: string) => {
    const blankPattern = /____/g;
    const matches = [...value.matchAll(blankPattern)];
    
    const newBlanks = matches.map((_, index) => {
      return {
        answer: form.blanks[index]?.answer || '',
        hint: form.blanks[index]?.hint || ''
      };
    });

    setForm(prev => ({ ...prev, content: value, blanks: newBlanks }));
  };

  const handleBlankChange = (index: number, field: 'answer' | 'hint', value: string) => {
    const newBlanks = [...form.blanks];
    newBlanks[index] = { ...newBlanks[index], [field]: value };
    setForm(prev => ({ ...prev, blanks: newBlanks }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const blanks: Blank[] = form.blanks.map((blank, index) => ({
      id: uuidv4(),
      position: index,
      length: blank.answer.length || 4,
      answer: blank.answer,
      hint: blank.hint || undefined
    }));

    addQuestion({
      subject: form.subject,
      content: form.content,
      blanks,
      answer: form.answer || form.content.replace(/____/g, (_, idx) => form.blanks[idx]?.answer || ''),
      explanation: form.explanation || undefined,
      tags: form.tags.split(',').map(t => t.trim()).filter(Boolean)
    });

    setShowModal(false);
    setForm(initialForm);
  };

  const handleQuestionClick = (questionId: string) => {
    navigate(`/question/${questionId}`);
  };

  const getReviewStatus = (questionId: string) => {
    const record = getReviewRecordByQuestionId(questionId);
    if (!record) {
      return { reviewed: false, due: true };
    }
    return {
      reviewed: true,
      due: isReviewDue(record.nextReviewDate)
    };
  };

  const renderQuestionContent = (content: string) => {
    const parts = content.split(/(____)/);
    return parts.map((part, index) => {
      if (part === '____') {
        return <span key={index} className="blank">____</span>;
      }
      return part;
    });
  };

  return (
    <div className="question-bank">
      <div className="page-header">
        <h1 className="page-title">题库</h1>
        <p className="page-subtitle">管理和复习你的知识题目</p>
      </div>

      <div className="toolbar">
        <div className="search-box">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            className="search-input"
            placeholder="搜索题目内容或标签..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <button className="add-btn" onClick={() => setShowModal(true)}>
          <span>➕</span>
          <span>添加题目</span>
        </button>
      </div>

      <div className="subject-filter">
        <button
          className={`subject-chip ${selectedSubject === 'all' ? 'active' : ''}`}
          onClick={() => setSelectedSubject('all')}
        >
          全部
        </button>
        {subjects.map((subject) => (
          <button
            key={subject}
            className={`subject-chip ${selectedSubject === subject ? 'active' : ''}`}
            onClick={() => setSelectedSubject(subject)}
            style={selectedSubject === subject ? {
              borderColor: subjectColors[subject],
              background: `linear-gradient(135deg, ${subjectColors[subject]}15 0%, ${subjectColors[subject]}15 100%)`,
              color: subjectColors[subject]
            } : {}}
          >
            {subject}
          </button>
        ))}
      </div>

      {activeFilter !== 'all' && (
        <div className="filter-bar">
          <span className="filter-label">当前筛选：</span>
          <span className="filter-tag">
            {activeFilter === 'reviewed' ? '已复习' : activeFilter === 'due' ? '待复习' : '已掌握'}
          </span>
          <button className="filter-clear" onClick={() => setActiveFilter('all')}>
            ✕
          </button>
        </div>
      )}

      <div className="question-list">
        {filteredQuestions.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📚</div>
            <div className="empty-title">暂无题目</div>
            <div className="empty-text">
              {searchQuery ? '没有找到匹配的题目' : '点击"添加题目"开始创建你的知识题库'}
            </div>
          </div>
        ) : (
          filteredQuestions.map((question) => {
            const status = getReviewStatus(question.id);
            const record = getReviewRecordByQuestionId(question.id);
            
            return (
              <div
                key={question.id}
                className="question-card"
                onClick={() => handleQuestionClick(question.id)}
              >
                <div className="question-header">
                  <div className="question-meta">
                    <span
                      className="subject-badge"
                      style={{ background: subjectColors[question.subject] }}
                    >
                      {question.subject}
                    </span>
                    <div className="review-status">
                      <span
                        className={`status-dot ${status.reviewed ? 'reviewed' : 'not-reviewed'}`}
                      />
                      <span>
                        {status.reviewed 
                          ? (status.due ? '需复习' : '已掌握') 
                          : '未复习'}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="question-content">
                  {renderQuestionContent(question.content)}
                </div>
                <div className="question-footer">
                  <div className="tags">
                    {question.tags.map((tag) => (
                      <span key={tag} className="tag">#{tag}</span>
                    ))}
                  </div>
                  {record && (
                    <div className="review-info">
                      复习 {record.reviewCount} 次
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">添加新题目</h2>
              <button className="close-btn" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">科目 <span>*</span></label>
                <select
                  className="form-select"
                  value={form.subject}
                  onChange={(e) => setForm(prev => ({ ...prev, subject: e.target.value as Subject }))}
                  required
                >
                  {subjects.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">题目内容 <span>*</span></label>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                  使用 ____ 作为挖空占位符
                </p>
                <textarea
                  className="form-textarea"
                  value={form.content}
                  onChange={(e) => handleContentChange(e.target.value)}
                  placeholder="例如：《离骚》的作者是____，他是战国时期____国人。"
                  required
                />
              </div>

              {form.blanks.length > 0 && (
                <div className="form-group">
                  <label className="form-label">挖空答案</label>
                  <div className="blank-editor">
                    <div className="blank-editor-header">
                      <span className="blank-editor-title">共 {form.blanks.length} 个挖空</span>
                    </div>
                    <div className="blank-list">
                      {form.blanks.map((blank, index) => (
                        <div key={index} className="blank-item">
                          <span className="blank-index">{index + 1}</span>
                          <input
                            type="text"
                            className="blank-item-input"
                            placeholder="答案"
                            value={blank.answer}
                            onChange={(e) => handleBlankChange(index, 'answer', e.target.value)}
                            required
                          />
                          <input
                            type="text"
                            className="blank-item-input"
                            placeholder="提示（可选）"
                            value={blank.hint}
                            onChange={(e) => handleBlankChange(index, 'hint', e.target.value)}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div className="form-group">
                <label className="form-label">完整答案</label>
                <textarea
                  className="form-textarea"
                  value={form.answer}
                  onChange={(e) => setForm(prev => ({ ...prev, answer: e.target.value }))}
                  placeholder="输入完整的答案（可选，将自动从挖空生成）"
                />
              </div>

              <div className="form-group">
                <label className="form-label">解析</label>
                <textarea
                  className="form-textarea"
                  value={form.explanation}
                  onChange={(e) => setForm(prev => ({ ...prev, explanation: e.target.value }))}
                  placeholder="添加题目解析（可选）"
                />
              </div>

              <div className="form-group">
                <label className="form-label">标签</label>
                <input
                  type="text"
                  className="form-input"
                  value={form.tags}
                  onChange={(e) => setForm(prev => ({ ...prev, tags: e.target.value }))}
                  placeholder="用逗号分隔，例如：古代文学,楚辞"
                />
              </div>

              <div className="form-footer">
                <button type="button" className="cancel-btn" onClick={() => setShowModal(false)}>
                  取消
                </button>
                <button type="submit" className="submit-btn">
                  添加题目
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
