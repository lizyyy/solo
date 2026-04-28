import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { useQuestions, useReview } from '../../context/AppContext';
import { Familiarity, Blank } from '../../types';
import { subjectColors } from '../../data/mockData';
import { isReviewDue } from '../../utils/reviewAlgorithm';
import './QuestionDetail.css';

interface BlankState {
  value: string;
  status: 'idle' | 'correct' | 'incorrect';
  showHint: boolean;
}

export const QuestionDetail: React.FC = () => {
  const { questionId } = useParams<{ questionId: string }>();
  const navigate = useNavigate();
  const { getQuestionById } = useQuestions();
  const { getReviewRecordByQuestionId, addReviewRecord } = useReview();

  const question = questionId ? getQuestionById(questionId) : undefined;
  const record = questionId ? getReviewRecordByQuestionId(questionId) : undefined;

  const [showAnswer, setShowAnswer] = useState(false);
  const [blankStates, setBlankStates] = useState<BlankState[]>([]);
  const [submitted, setSubmitted] = useState(false);

  const reviewStatus = useMemo(() => {
    if (!record) {
      return { reviewed: false, due: true };
    }
    return {
      reviewed: true,
      due: isReviewDue(record.nextReviewDate)
    };
  }, [record]);

  const initBlankStates = (blanks: Blank[]) => {
    return blanks.map(() => ({
      value: '',
      status: 'idle' as const,
      showHint: false
    }));
  };

  React.useEffect(() => {
    if (question) {
      setBlankStates(initBlankStates(question.blanks));
      setShowAnswer(false);
      setSubmitted(false);
    }
  }, [question]);

  if (!question) {
    return (
      <div className="question-detail">
        <div className="not-found">
          <div className="not-found-icon">❓</div>
          <div className="not-found-title">题目不存在</div>
          <div className="not-found-text">该题目可能已被删除或不存在</div>
          <button className="btn btn-primary" onClick={() => navigate('/')}>
            返回题库
          </button>
        </div>
      </div>
    );
  }

  const handleBlankChange = (index: number, value: string) => {
    const newStates = [...blankStates];
    newStates[index] = { ...newStates[index], value };
    setBlankStates(newStates);
  };

  const handleToggleHint = (index: number) => {
    const newStates = [...blankStates];
    newStates[index] = { ...newStates[index], showHint: !newStates[index].showHint };
    setBlankStates(newStates);
  };

  const handleCheckAnswers = () => {
    const newStates = question.blanks.map((blank, index) => {
      const isCorrect = blankStates[index]?.value.trim().toLowerCase() === blank.answer.toLowerCase();
      return {
        ...blankStates[index],
        status: isCorrect ? 'correct' : 'incorrect'
      };
    });
    setBlankStates(newStates);
    setSubmitted(true);
  };

  const handleFamiliarity = (familiarity: Familiarity) => {
    if (questionId) {
      addReviewRecord(questionId, familiarity);
      navigate('/review');
    }
  };

  const renderQuestionContent = () => {
    const parts = question.content.split(/(____)/);
    let blankIndex = 0;

    return parts.map((part, partIndex) => {
      if (part === '____') {
        const blank = question.blanks[blankIndex];
        const state = blankStates[blankIndex];
        const currentIndex = blankIndex;
        blankIndex++;

        if (!blank) return null;

        return (
          <span key={partIndex} className="blank-container">
            <input
              type="text"
              className={`blank-input ${state?.status}`}
              value={state?.value || ''}
              onChange={(e) => handleBlankChange(currentIndex, e.target.value)}
              placeholder="..."
              disabled={showAnswer}
            />
            {blank.hint && (
              <span
                className="hint-btn"
                onClick={() => handleToggleHint(currentIndex)}
                title="显示提示"
              >
                ?
              </span>
            )}
            {state?.showHint && blank.hint && (
              <span className="hint-tooltip">{blank.hint}</span>
            )}
          </span>
        );
      }
      return <span key={partIndex}>{part}</span>;
    });
  };

  return (
    <div className="question-detail">
      <button className="back-btn" onClick={() => navigate('/')}>
        <span>←</span>
        <span>返回题库</span>
      </button>

      <div className="question-container">
        <div className="question-header">
          <div className="question-info">
            <div className="question-title">题目详情</div>
            <div className="question-meta">
              <span
                className="subject-badge"
                style={{ background: subjectColors[question.subject] }}
              >
                {question.subject}
              </span>
              <div className="review-status">
                <span
                  className={`status-dot ${reviewStatus.reviewed ? 'reviewed' : 'not-reviewed'}`}
                />
                <span>
                  {reviewStatus.reviewed 
                    ? (reviewStatus.due ? '需要复习' : '已掌握') 
                    : '未复习'}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="question-content-section">
          <div className="section-title">题目内容</div>
          <div className="question-content">
            {renderQuestionContent()}
          </div>
        </div>

        <div className="actions">
          {!showAnswer ? (
            <>
              <button className="btn btn-primary" onClick={handleCheckAnswers}>
                检查答案
              </button>
              <button className="btn btn-secondary" onClick={() => setShowAnswer(true)}>
                显示答案
              </button>
            </>
          ) : (
            <button className="btn btn-secondary" onClick={() => {
              setShowAnswer(false);
              setSubmitted(false);
              setBlankStates(initBlankStates(question.blanks));
            }}>
              重新练习
            </button>
          )}
        </div>

        {showAnswer && (
          <div className="answer-section">
            <div className="section-title">正确答案</div>
            <div className="answer-content">{question.answer}</div>
          </div>
        )}

        {question.explanation && showAnswer && (
          <div className="explanation-section">
            <div className="section-title">解析</div>
            <div className="explanation-content">{question.explanation}</div>
          </div>
        )}

        <div className="tags-section">
          <span className="tags-label">标签：</span>
          <div className="tags">
            {question.tags.map((tag) => (
              <span key={tag} className="tag">#{tag}</span>
            ))}
          </div>
        </div>
      </div>

      {showAnswer && (
        <div className="familiarity-section">
          <div className="familiarity-header">
            <div className="familiarity-title">你对这道题的熟悉程度如何？</div>
            <div className="familiarity-subtitle">选择一个选项来更新你的复习计划</div>
          </div>
          <div className="familiarity-buttons">
            <button
              className="familiarity-btn remember"
              onClick={() => handleFamiliarity('认识')}
            >
              <span className="familiarity-icon">😊</span>
              <span className="familiarity-label">认识</span>
              <span className="familiarity-desc">完全掌握</span>
            </button>
            <button
              className="familiarity-btn vague"
              onClick={() => handleFamiliarity('模糊')}
            >
              <span className="familiarity-icon">🤔</span>
              <span className="familiarity-label">模糊</span>
              <span className="familiarity-desc">有些印象</span>
            </button>
            <button
              className="familiarity-btn forget"
              onClick={() => handleFamiliarity('忘记')}
            >
              <span className="familiarity-icon">😵</span>
              <span className="familiarity-label">忘记</span>
              <span className="familiarity-desc">需要重学</span>
            </button>
          </div>
        </div>
      )}

      {record && (
        <div className="review-history">
          <div className="history-title">复习记录</div>
          <div className="history-list">
            <div className="history-item">
              <div className="history-info">
                <span className={`history-badge ${record.familiarity}`}>
                  {record.familiarity}
                </span>
                <span>复习 {record.reviewCount} 次</span>
              </div>
              <span className="history-date">
                上次复习：{format(new Date(record.reviewedAt), 'yyyy-MM-dd HH:mm')}
              </span>
            </div>
          </div>
          <div className="next-review">
            <span className="next-review-icon">📅</span>
            <span className="next-review-text">下次复习时间：</span>
            <span className="next-review-date">
              {format(new Date(record.nextReviewDate), 'yyyy-MM-dd')}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
