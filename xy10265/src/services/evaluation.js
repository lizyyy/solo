const GameModel = require('../models/game');
const AttendanceModel = require('../models/attendance');
const EvaluationModel = require('../models/evaluation');
const StudentModel = require('../models/student');
const DecisionModel = require('../models/decision');

const LEVEL_ORDER = ['入门班', '初级班', '中级班', '高级班', '精英班'];

const POSITIVE_TAGS = ['战术出色', '防守稳健', '进攻主动', '思维敏捷', '计算能力强', '心态稳定', '进步明显'];
const NEGATIVE_TAGS = ['失误较多', '时间管理差', '战术单一', '防守薄弱', '心理波动大', '基本功不扎实'];

class EvaluationService {
  static getWinRateTrend(student_id) {
    const trend = GameModel.getWinRateTrend(student_id);
    const winRateInfo = GameModel.getWinRate(student_id);
    
    let trendAnalysis = '数据不足';
    if (trend.length >= 5) {
      const recent = trend.slice(-5);
      const earlier = trend.slice(0, -5);
      const recentRate = recent[recent.length - 1].cumulative_win_rate;
      const earlierRate = earlier[earlier.length - 1].cumulative_win_rate;
      
      if (recentRate - earlierRate > 0.15) trendAnalysis = '上升明显';
      else if (recentRate - earlierRate > 0.05) trendAnalysis = '稳步上升';
      else if (Math.abs(recentRate - earlierRate) <= 0.05) trendAnalysis = '保持稳定';
      else if (recentRate - earlierRate > -0.15) trendAnalysis = '小幅下滑';
      else trendAnalysis = '明显下滑';
    }
    
    return {
      trend,
      current_win_rate: winRateInfo.rate,
      total_games: winRateInfo.total,
      wins: winRateInfo.wins,
      losses: winRateInfo.losses,
      draws: winRateInfo.draws,
      trend_analysis: trendAnalysis
    };
  }

  static getAttendanceWithWeight(student_id) {
    const attendance = AttendanceModel.getAttendanceScore(student_id);
    
    let weight = 0.2;
    let reason = '出勤权重: 20% (默认)';
    
    if (attendance.total >= 20) {
      weight = 0.25;
      reason = '出勤权重: 25% (样本量充足)';
    } else if (attendance.total >= 10) {
      weight = 0.2;
      reason = '出勤权重: 20% (样本量适中)';
    } else if (attendance.total >= 5) {
      weight = 0.15;
      reason = '出勤权重: 15% (样本量较少)';
    } else {
      weight = 0.1;
      reason = '出勤权重: 10% (样本量不足)';
    }
    
    return {
      ...attendance,
      weight,
      weight_reason: reason
    };
  }

  static getTagScore(teacher_tags) {
    if (!teacher_tags || teacher_tags.length === 0) {
      return { score: 0.5, weight: 0, reason: '暂无老师评价' };
    }
    
    let positiveCount = 0;
    let negativeCount = 0;
    
    teacher_tags.forEach(tag => {
      if (POSITIVE_TAGS.includes(tag)) positiveCount++;
      if (NEGATIVE_TAGS.includes(tag)) negativeCount++;
    });
    
    const total = positiveCount + negativeCount;
    const score = total > 0 ? (positiveCount + 0.5 * (teacher_tags.length - total)) / teacher_tags.length : 0.5;
    const weight = Math.min(0.25, 0.1 + Math.min(teacher_tags.length, 5) * 0.03);
    
    let reason = '';
    if (positiveCount > negativeCount + 2) reason = '评价非常优秀';
    else if (positiveCount > negativeCount) reason = '整体评价正面';
    else if (positiveCount === negativeCount) reason = '评价有褒有贬';
    else reason = '需要重点关注';
    
    return {
      score,
      weight,
      tags_count: teacher_tags.length,
      positive_count: positiveCount,
      negative_count: negativeCount,
      reason
    };
  }

  static evaluate(student_id, teacher_tags = []) {
    const student = StudentModel.findById(student_id);
    if (!student) {
      throw new Error('学生不存在');
    }
    
    const winRateTrend = this.getWinRateTrend(student_id);
    const attendance = this.getAttendanceWithWeight(student_id);
    const tagScore = this.getTagScore(teacher_tags);
    
    const winRateWeight = Math.max(0.45, 1 - attendance.weight - tagScore.weight);
    
    const gameBonus = this.calculateGameBonus(student_id);
    
    const overallScore = (
      winRateTrend.current_win_rate * winRateWeight +
      attendance.score * attendance.weight +
      tagScore.score * tagScore.weight
    ) * (1 + gameBonus);
    
    const { recommendation, reason } = this.generateRecommendation(
      overallScore,
      winRateTrend,
      attendance,
      tagScore,
      student
    );
    
    const evaluation = EvaluationModel.create({
      student_id,
      win_rate: winRateTrend.current_win_rate,
      attendance_score: attendance.score,
      teacher_tags,
      overall_score: Math.min(1, Math.max(0, overallScore)),
      recommendation,
      reason
    });
    
    StudentModel.updateEvaluationStatus(
      student_id,
      recommendation === 'recommend_promotion' ? 'recommended' : 'not_recommended'
    );
    
    return {
      evaluation,
      breakdown: {
        win_rate: {
          score: winRateTrend.current_win_rate,
          weight: winRateWeight,
          contribution: winRateTrend.current_win_rate * winRateWeight,
          trend: winRateTrend.trend_analysis,
          total_games: winRateTrend.total_games
        },
        attendance: {
          score: attendance.score,
          weight: attendance.weight,
          contribution: attendance.score * attendance.weight,
          weight_reason: attendance.weight_reason,
          total_records: attendance.total
        },
        teacher_tags: {
          score: tagScore.score,
          weight: tagScore.weight,
          contribution: tagScore.score * tagScore.weight,
          reason: tagScore.reason,
          tags_count: tagScore.tags_count
        },
        game_bonus: gameBonus,
        overall_score: Math.min(1, Math.max(0, overallScore))
      }
    };
  }

  static calculateGameBonus(student_id) {
    const games = GameModel.findByStudentId(student_id);
    if (games.length < 5) return 0;
    
    let bonus = 0;
    let strongOpponentWins = 0;
    
    games.forEach(game => {
      if (game.result === 'win' && game.opponent_level !== '入门班' && game.opponent_level !== '初级班') {
        strongOpponentWins++;
      }
    });
    
    if (strongOpponentWins >= 5) bonus += 0.08;
    else if (strongOpponentWins >= 3) bonus += 0.05;
    else if (strongOpponentWins >= 2) bonus += 0.02;
    
    const winRateTrend = this.getWinRateTrend(student_id);
    if (winRateTrend.trend_analysis === '上升明显') bonus += 0.05;
    else if (winRateTrend.trend_analysis === '稳步上升') bonus += 0.02;
    
    return bonus;
  }

  static generateRecommendation(overallScore, winRateTrend, attendance, tagScore, student) {
    const reasons = [];
    let recommendation = 'not_recommended';
    
    if (overallScore >= 0.8) {
      recommendation = 'recommend_promotion';
      reasons.push(`综合评分 ${(overallScore * 100).toFixed(1)} 分，达到升班标准`);
    } else if (overallScore >= 0.7) {
      if (winRateTrend.trend_analysis === '上升明显' || winRateTrend.trend_analysis === '稳步上升') {
        recommendation = 'recommend_promotion';
        reasons.push(`综合评分 ${(overallScore * 100).toFixed(1)} 分，且胜率呈上升趋势，建议升班`);
      } else if (attendance.score >= 0.9 && tagScore.positive_count >= 3) {
        recommendation = 'recommend_promotion';
        reasons.push(`综合评分 ${(overallScore * 100).toFixed(1)} 分，出勤优秀且老师评价正面，建议升班`);
      } else {
        reasons.push(`综合评分 ${(overallScore * 100).toFixed(1)} 分，接近升班标准，建议继续观察`);
      }
    } else if (overallScore >= 0.6) {
      reasons.push(`综合评分 ${(overallScore * 100).toFixed(1)} 分，暂未达到升班标准`);
    } else {
      reasons.push(`综合评分 ${(overallScore * 100).toFixed(1)} 分，需要加强训练`);
    }
    
    if (winRateTrend.total_games < 5) {
      reasons.push('对局数量不足（<5局），建议积累更多对局记录');
    }
    
    if (winRateTrend.current_win_rate < 0.4 && recommendation === 'recommend_promotion') {
      recommendation = 'not_recommended';
      reasons.push(`胜率过低 (${(winRateTrend.current_win_rate * 100).toFixed(1)}%)，暂不建议升班`);
    }
    
    if (attendance.score < 0.6 && recommendation === 'recommend_promotion') {
      recommendation = 'not_recommended';
      reasons.push(`出勤率过低 (${(attendance.score * 100).toFixed(1)}%)，暂不建议升班`);
    }
    
    if (recommendation === 'recommend_promotion') {
      const nextLevel = this.getNextLevel(student.current_level);
      if (nextLevel) {
        reasons.unshift(`建议从「${student.current_level}」升班至「${nextLevel}」`);
      }
    } else {
      reasons.unshift(`建议继续在「${student.current_level}」学习`);
    }
    
    return { recommendation, reason: reasons.join('；') };
  }

  static getNextLevel(currentLevel) {
    const idx = LEVEL_ORDER.indexOf(currentLevel);
    if (idx >= 0 && idx < LEVEL_ORDER.length - 1) {
      return LEVEL_ORDER[idx + 1];
    }
    return null;
  }

  static confirmPromotion(student_id, evaluation_id, comment = '') {
    const evaluation = EvaluationModel.findById(evaluation_id);
    if (!evaluation || evaluation.student_id !== student_id) {
      throw new Error('评估记录不存在');
    }
    
    if (evaluation.recommendation !== 'recommend_promotion') {
      throw new Error('该评估未推荐升班');
    }
    
    const student = StudentModel.findById(student_id);
    const nextLevel = this.getNextLevel(student.current_level);
    
    if (!nextLevel) {
      throw new Error('已在最高级别，无法继续升班');
    }
    
    const decision = DecisionModel.create({
      student_id,
      evaluation_id,
      decision: 'promoted',
      comment
    });
    
    StudentModel.update(student_id, {
      current_level: nextLevel,
      evaluation_status: 'confirmed'
    });
    
    return { decision, new_level: nextLevel };
  }

  static rejectPromotion(student_id, evaluation_id, comment = '') {
    const evaluation = EvaluationModel.findById(evaluation_id);
    if (!evaluation || evaluation.student_id !== student_id) {
      throw new Error('评估记录不存在');
    }
    
    const decision = DecisionModel.create({
      student_id,
      evaluation_id,
      decision: 'rejected',
      comment
    });
    
    StudentModel.updateEvaluationStatus(student_id, 'rejected');
    
    return decision;
  }

  static generateParentReport(student_id) {
    const student = StudentModel.findById(student_id);
    if (!student) throw new Error('学生不存在');
    
    const evaluation = EvaluationModel.findLatestByStudentId(student_id);
    const winRateTrend = this.getWinRateTrend(student_id);
    const attendance = this.getAttendanceWithWeight(student_id);
    const decision = evaluation ? DecisionModel.findByEvaluationId(evaluation.id) : null;
    
    return {
      student: {
        name: student.name,
        current_level: student.current_level,
        join_date: student.join_date,
        evaluation_status: student.evaluation_status
      },
      win_rate: {
        rate: winRateTrend.current_win_rate,
        total: winRateTrend.total_games,
        wins: winRateTrend.wins,
        losses: winRateTrend.losses,
        draws: winRateTrend.draws,
        trend: winRateTrend.trend_analysis
      },
      attendance: {
        score: attendance.score,
        total: attendance.total,
        present: attendance.present,
        late: attendance.late,
        absent: attendance.absent
      },
      evaluation: evaluation ? {
        overall_score: evaluation.overall_score,
        recommendation: evaluation.recommendation,
        reason: evaluation.reason,
        tags: evaluation.teacher_tags,
        created_at: evaluation.created_at
      } : null,
      decision: decision ? {
        decision: decision.decision,
        comment: decision.comment,
        decided_at: decision.decided_at
      } : null,
      generated_at: new Date().toISOString()
    };
  }
}

module.exports = EvaluationService;
