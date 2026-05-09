const request = require('supertest');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '../../data/test.db');

beforeEach(() => {
  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
});

describe('Evaluation Service', () => {
  let app;
  let db;
  
  beforeAll(() => {
    process.env.TEST_DB = dbPath;
    delete require.cache[require.resolve('../src/db/database')];
    delete require.cache[require.resolve('../src/server')];
    db = require('../src/db/database');
    app = require('../src/server');
  });
  
  it('should promote student with high win rate, good attendance and positive tags', async () => {
    const studentRes = await request(app).post('/api/students').send({
      name: '测试生A',
      current_level: '初级班',
      join_date: '2024-01-01'
    });
    expect(studentRes.status).toBe(201);
    const studentId = studentRes.body.id;
    
    const games = [
      { opponent: '对手1', opponent_level: '初级班', result: 'win', game_date: '2024-02-01' },
      { opponent: '对手2', opponent_level: '初级班', result: 'win', game_date: '2024-02-08' },
      { opponent: '对手3', opponent_level: '中级班', result: 'win', game_date: '2024-02-15' },
      { opponent: '对手4', opponent_level: '初级班', result: 'win', game_date: '2024-02-22' },
      { opponent: '对手5', opponent_level: '中级班', result: 'win', game_date: '2024-03-01' },
      { opponent: '对手6', opponent_level: '初级班', result: 'win', game_date: '2024-03-08' }
    ];
    await request(app).post(`/api/students/${studentId}/games`).send({ games });
    
    const attendances = [
      { attendance_date: '2024-02-01', status: 'present' },
      { attendance_date: '2024-02-08', status: 'present' },
      { attendance_date: '2024-02-15', status: 'present' },
      { attendance_date: '2024-02-22', status: 'present' },
      { attendance_date: '2024-03-01', status: 'present' },
      { attendance_date: '2024-03-08', status: 'present' }
    ];
    await request(app).post(`/api/students/${studentId}/attendances`).send({ attendances });
    
    const evalRes = await request(app).post(`/api/students/${studentId}/evaluate`).send({
      teacher_tags: ['战术出色', '进攻主动', '进步明显']
    });
    
    expect(evalRes.status).toBe(200);
    expect(evalRes.body.evaluation.recommendation).toBe('recommend_promotion');
    expect(evalRes.body.evaluation.overall_score).toBeGreaterThan(0.8);
    expect(evalRes.body.evaluation.reason).toContain('建议从「初级班」升班至「中级班」');
  });
  
  it('should NOT promote student with low win rate', async () => {
    const studentRes = await request(app).post('/api/students').send({
      name: '测试生B',
      current_level: '初级班',
      join_date: '2024-01-01'
    });
    const studentId = studentRes.body.id;
    
    const games = [
      { opponent: '对手1', opponent_level: '初级班', result: 'lose', game_date: '2024-02-01' },
      { opponent: '对手2', opponent_level: '初级班', result: 'lose', game_date: '2024-02-08' },
      { opponent: '对手3', opponent_level: '初级班', result: 'lose', game_date: '2024-02-15' },
      { opponent: '对手4', opponent_level: '初级班', result: 'win', game_date: '2024-02-22' },
      { opponent: '对手5', opponent_level: '初级班', result: 'lose', game_date: '2024-03-01' }
    ];
    await request(app).post(`/api/students/${studentId}/games`).send({ games });
    
    const attendances = [
      { attendance_date: '2024-02-01', status: 'present' },
      { attendance_date: '2024-02-08', status: 'present' },
      { attendance_date: '2024-02-15', status: 'present' }
    ];
    await request(app).post(`/api/students/${studentId}/attendances`).send({ attendances });
    
    const evalRes = await request(app).post(`/api/students/${studentId}/evaluate`).send({
      teacher_tags: ['防守稳健']
    });
    
    expect(evalRes.status).toBe(200);
    expect(evalRes.body.evaluation.recommendation).toBe('not_recommended');
    expect(evalRes.body.evaluation.overall_score).toBeLessThan(0.6);
    expect(evalRes.body.evaluation.reason).toContain('胜率过低');
  });
  
  it('should NOT promote student with low attendance', async () => {
    const studentRes = await request(app).post('/api/students').send({
      name: '测试生C',
      current_level: '初级班',
      join_date: '2024-01-01'
    });
    const studentId = studentRes.body.id;
    
    const games = [
      { opponent: '对手1', opponent_level: '初级班', result: 'win', game_date: '2024-02-01' },
      { opponent: '对手2', opponent_level: '初级班', result: 'win', game_date: '2024-02-08' },
      { opponent: '对手3', opponent_level: '初级班', result: 'win', game_date: '2024-02-15' },
      { opponent: '对手4', opponent_level: '初级班', result: 'win', game_date: '2024-02-22' },
      { opponent: '对手5', opponent_level: '初级班', result: 'win', game_date: '2024-03-01' }
    ];
    await request(app).post(`/api/students/${studentId}/games`).send({ games });
    
    const attendances = [
      { attendance_date: '2024-02-01', status: 'absent' },
      { attendance_date: '2024-02-08', status: 'absent' },
      { attendance_date: '2024-02-15', status: 'present' }
    ];
    await request(app).post(`/api/students/${studentId}/attendances`).send({ attendances });
    
    const evalRes = await request(app).post(`/api/students/${studentId}/evaluate`).send({
      teacher_tags: ['进攻主动']
    });
    
    expect(evalRes.status).toBe(200);
    expect(evalRes.body.evaluation.recommendation).toBe('not_recommended');
    expect(evalRes.body.evaluation.reason).toContain('出勤率过低');
  });
  
  it('should confirm promotion and update student level', async () => {
    const studentRes = await request(app).post('/api/students').send({
      name: '测试生D',
      current_level: '入门班',
      join_date: '2024-01-01'
    });
    const studentId = studentRes.body.id;
    
    const games = [
      { opponent: '对手1', opponent_level: '入门班', result: 'win', game_date: '2024-02-01' },
      { opponent: '对手2', opponent_level: '入门班', result: 'win', game_date: '2024-02-08' },
      { opponent: '对手3', opponent_level: '初级班', result: 'win', game_date: '2024-02-15' },
      { opponent: '对手4', opponent_level: '入门班', result: 'win', game_date: '2024-02-22' },
      { opponent: '对手5', opponent_level: '初级班', result: 'win', game_date: '2024-03-01' }
    ];
    await request(app).post(`/api/students/${studentId}/games`).send({ games });
    
    const attendances = [
      { attendance_date: '2024-02-01', status: 'present' },
      { attendance_date: '2024-02-08', status: 'present' },
      { attendance_date: '2024-02-15', status: 'present' },
      { attendance_date: '2024-02-22', status: 'present' },
      { attendance_date: '2024-03-01', status: 'present' }
    ];
    await request(app).post(`/api/students/${studentId}/attendances`).send({ attendances });
    
    const evalRes = await request(app).post(`/api/students/${studentId}/evaluate`).send({
      teacher_tags: ['思维敏捷', '进步明显']
    });
    const evaluationId = evalRes.body.evaluation.id;
    
    const confirmRes = await request(app).post(`/api/students/${studentId}/confirm`).send({
      evaluation_id: evaluationId,
      comment: '测试确认升班'
    });
    
    expect(confirmRes.status).toBe(200);
    expect(confirmRes.body.new_level).toBe('初级班');
    
    const updatedStudent = await request(app).get(`/api/students/${studentId}`);
    expect(updatedStudent.body.current_level).toBe('初级班');
    expect(updatedStudent.body.evaluation_status).toBe('confirmed');
  });
  
  it('should reject promotion when rejected', async () => {
    const studentRes = await request(app).post('/api/students').send({
      name: '测试生E',
      current_level: '入门班',
      join_date: '2024-01-01'
    });
    const studentId = studentRes.body.id;
    
    const games = [
      { opponent: '对手1', opponent_level: '入门班', result: 'win', game_date: '2024-02-01' },
      { opponent: '对手2', opponent_level: '入门班', result: 'win', game_date: '2024-02-08' },
      { opponent: '对手3', opponent_level: '初级班', result: 'win', game_date: '2024-02-15' },
      { opponent: '对手4', opponent_level: '入门班', result: 'win', game_date: '2024-02-22' },
      { opponent: '对手5', opponent_level: '初级班', result: 'win', game_date: '2024-03-01' }
    ];
    await request(app).post(`/api/students/${studentId}/games`).send({ games });
    
    const attendances = [
      { attendance_date: '2024-02-01', status: 'present' },
      { attendance_date: '2024-02-08', status: 'present' },
      { attendance_date: '2024-02-15', status: 'present' },
      { attendance_date: '2024-02-22', status: 'present' },
      { attendance_date: '2024-03-01', status: 'present' }
    ];
    await request(app).post(`/api/students/${studentId}/attendances`).send({ attendances });
    
    const evalRes = await request(app).post(`/api/students/${studentId}/evaluate`).send({
      teacher_tags: ['思维敏捷']
    });
    const evaluationId = evalRes.body.evaluation.id;
    
    const rejectRes = await request(app).post(`/api/students/${studentId}/reject`).send({
      evaluation_id: evaluationId,
      comment: '基本功还需巩固'
    });
    
    expect(rejectRes.status).toBe(200);
    
    const updatedStudent = await request(app).get(`/api/students/${studentId}`);
    expect(updatedStudent.body.current_level).toBe('入门班');
    expect(updatedStudent.body.evaluation_status).toBe('rejected');
  });
  
  it('should generate parent report with all data', async () => {
    const studentRes = await request(app).post('/api/students').send({
      name: '测试生F',
      current_level: '初级班',
      join_date: '2024-01-01'
    });
    const studentId = studentRes.body.id;
    
    const games = [
      { opponent: '对手1', opponent_level: '初级班', result: 'win', game_date: '2024-02-01' },
      { opponent: '对手2', opponent_level: '初级班', result: 'lose', game_date: '2024-02-08' },
      { opponent: '对手3', opponent_level: '初级班', result: 'win', game_date: '2024-02-15' }
    ];
    await request(app).post(`/api/students/${studentId}/games`).send({ games });
    
    const attendances = [
      { attendance_date: '2024-02-01', status: 'present' },
      { attendance_date: '2024-02-08', status: 'late' }
    ];
    await request(app).post(`/api/students/${studentId}/attendances`).send({ attendances });
    
    await request(app).post(`/api/students/${studentId}/evaluate`).send({
      teacher_tags: ['防守稳健', '心理波动大']
    });
    
    const reportRes = await request(app).get(`/api/students/${studentId}/report`);
    
    expect(reportRes.status).toBe(200);
    expect(reportRes.body.student.name).toBe('测试生F');
    expect(reportRes.body.win_rate.total).toBe(3);
    expect(reportRes.body.attendance.total).toBe(2);
    expect(reportRes.body.evaluation).not.toBeNull();
    expect(reportRes.body.evaluation.tags).toEqual(expect.arrayContaining(['防守稳健', '心理波动大']));
  });
  
  it('should fail to confirm when not recommended', async () => {
    const studentRes = await request(app).post('/api/students').send({
      name: '测试生G',
      current_level: '入门班',
      join_date: '2024-01-01'
    });
    const studentId = studentRes.body.id;
    
    const games = [
      { opponent: '对手1', opponent_level: '入门班', result: 'lose', game_date: '2024-02-01' },
      { opponent: '对手2', opponent_level: '入门班', result: 'lose', game_date: '2024-02-08' },
      { opponent: '对手3', opponent_level: '入门班', result: 'lose', game_date: '2024-02-15' }
    ];
    await request(app).post(`/api/students/${studentId}/games`).send({ games });
    
    const evalRes = await request(app).post(`/api/students/${studentId}/evaluate`).send({ teacher_tags: [] });
    const evaluationId = evalRes.body.evaluation.id;
    
    const confirmRes = await request(app).post(`/api/students/${studentId}/confirm`).send({
      evaluation_id: evaluationId
    });
    
    expect(confirmRes.status).toBe(400);
    expect(confirmRes.body.error).toBe('该评估未推荐升班');
  });
  
  it('should calculate win rate trend correctly', async () => {
    const studentRes = await request(app).post('/api/students').send({
      name: '测试生H',
      current_level: '初级班',
      join_date: '2024-01-01'
    });
    const studentId = studentRes.body.id;
    
    const games = [
      { opponent: 'A', opponent_level: '初级班', result: 'lose', game_date: '2024-01-01' },
      { opponent: 'B', opponent_level: '初级班', result: 'win', game_date: '2024-01-08' },
      { opponent: 'C', opponent_level: '初级班', result: 'win', game_date: '2024-01-15' },
      { opponent: 'D', opponent_level: '初级班', result: 'win', game_date: '2024-01-22' },
      { opponent: 'E', opponent_level: '初级班', result: 'win', game_date: '2024-01-29' }
    ];
    await request(app).post(`/api/students/${studentId}/games`).send({ games });
    
    const winRateRes = await request(app).get(`/api/students/${studentId}/winrate`);
    
    expect(winRateRes.status).toBe(200);
    expect(winRateRes.body.total_games).toBe(5);
    expect(winRateRes.body.current_win_rate).toBe(0.8);
    expect(winRateRes.body.trend_analysis).toBe('上升明显');
    expect(winRateRes.body.trend.length).toBe(5);
    expect(winRateRes.body.trend[0].cumulative_win_rate).toBe(0);
    expect(winRateRes.body.trend[4].cumulative_win_rate).toBe(0.8);
  });
});
