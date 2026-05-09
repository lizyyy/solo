const db = require('../db/database');

class GameModel {
  static create({ student_id, opponent, opponent_level, result, game_date, notes }) {
    const stmt = db.prepare(`
      INSERT INTO games (student_id, opponent, opponent_level, result, game_date, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const resultDb = stmt.run(student_id, opponent, opponent_level, result, game_date, notes || null);
    return this.findById(resultDb.lastInsertRowid);
  }

  static findById(id) {
    return db.prepare('SELECT * FROM games WHERE id = ?').get(id);
  }

  static findByStudentId(student_id) {
    return db.prepare('SELECT * FROM games WHERE student_id = ? ORDER BY game_date DESC').all(student_id);
  }

  static getWinRate(student_id) {
    const games = this.findByStudentId(student_id);
    if (games.length === 0) return { rate: 0, total: 0, wins: 0, losses: 0, draws: 0 };
    const wins = games.filter(g => g.result === 'win').length;
    const losses = games.filter(g => g.result === 'lose').length;
    const draws = games.filter(g => g.result === 'draw').length;
    return {
      rate: (wins + draws * 0.5) / games.length,
      total: games.length,
      wins,
      losses,
      draws
    };
  }

  static getWinRateTrend(student_id) {
    const games = this.findByStudentId(student_id).reverse();
    if (games.length === 0) return [];
    
    const trend = [];
    let rollingWins = 0;
    let rollingGames = 0;
    
    games.forEach((game, index) => {
      rollingGames++;
      if (game.result === 'win') rollingWins++;
      else if (game.result === 'draw') rollingWins += 0.5;
      
      trend.push({
        game_index: index + 1,
        game_date: game.game_date,
        opponent: game.opponent,
        opponent_level: game.opponent_level,
        result: game.result,
        cumulative_win_rate: rollingWins / rollingGames
      });
    });
    
    return trend;
  }

  static batchCreate(student_id, games) {
    return games.map(game => this.create({ student_id, ...game }));
  }

  static delete(id) {
    return db.prepare('DELETE FROM games WHERE id = ?').run(id);
  }
}

module.exports = GameModel;
