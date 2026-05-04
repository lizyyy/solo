import fs from 'fs';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';
import csvParser from 'csv-parser';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 数据目录
const dataDir = path.join(__dirname, '../../data');

// 确保数据目录存在
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// 数据库路径
const dbPath = path.join(dataDir, 'music-theory.db');

// 导入 JSON 格式的题库数据
const importFromJSON = async (filePath) => {
  try {
    console.log(`正在从 ${filePath} 导入数据...`);
    
    const rawData = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(rawData);
    
    const db = new Database(dbPath);
    
    // 开始事务
    db.exec('BEGIN TRANSACTION');
    
    try {
      // 导入知识点
      if (data.knowledgePoints && data.knowledgePoints.length > 0) {
        console.log(`  导入 ${data.knowledgePoints.length} 个知识点...`);
        
        const insertKP = db.prepare(`
          INSERT OR REPLACE INTO knowledge_points (id, name, category, description)
          VALUES (?, ?, ?, ?)
        `);
        
        data.knowledgePoints.forEach(kp => {
          insertKP.run(kp.id, kp.name, kp.category, kp.description || null);
        });
      }
      
      // 导入题目
      if (data.questions && data.questions.length > 0) {
        console.log(`  导入 ${data.questions.length} 道题目...`);
        
        const insertQ = db.prepare(`
          INSERT OR REPLACE INTO questions 
          (id, knowledge_point_id, type, difficulty, content, options, correct_answer, explanation, tags)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        data.questions.forEach((q, index) => {
          const id = q.id || (index + 1);
          insertQ.run(
            id,
            q.knowledge_point_id || null,
            q.type,
            q.difficulty || 1,
            JSON.stringify(q.content),
            q.options ? JSON.stringify(q.options) : null,
            JSON.stringify(q.correct_answer),
            q.explanation || null,
            q.tags ? JSON.stringify(q.tags) : null
          );
        });
      }
      
      db.exec('COMMIT');
      console.log('  导入完成！');
      
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
    
    db.close();
    return true;
    
  } catch (error) {
    console.error('导入 JSON 数据失败:', error.message);
    return false;
  }
};

// 导入 CSV 格式的题库数据
const importFromCSV = async (filePath) => {
  return new Promise((resolve, reject) => {
    console.log(`正在从 ${filePath} 导入数据...`);
    
    const questions = [];
    
    fs.createReadStream(filePath)
      .pipe(csvParser())
      .on('data', (row) => {
        questions.push(row);
      })
      .on('end', async () => {
        try {
          const db = new Database(dbPath);
          db.exec('BEGIN TRANSACTION');
          
          console.log(`  导入 ${questions.length} 道题目...`);
          
          const insertQ = db.prepare(`
            INSERT OR REPLACE INTO questions 
            (id, knowledge_point_id, type, difficulty, content, options, correct_answer, explanation, tags)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);
          
          questions.forEach((q, index) => {
            const id = q.id ? parseInt(q.id) : (index + 1);
            insertQ.run(
              id,
              q.knowledge_point_id ? parseInt(q.knowledge_point_id) : null,
              q.type,
              q.difficulty ? parseInt(q.difficulty) : 1,
              q.content,
              q.options || null,
              q.correct_answer,
              q.explanation || null,
              q.tags || null
            );
          });
          
          db.exec('COMMIT');
          db.close();
          
          console.log('  导入完成！');
          resolve(true);
          
        } catch (error) {
          console.error('导入 CSV 数据失败:', error.message);
          reject(error);
        }
      })
      .on('error', (error) => {
        console.error('读取 CSV 文件失败:', error.message);
        reject(error);
      });
  });
};

// 主函数
const main = async () => {
  console.log('========================================');
  console.log('  乐理练习台数据导入工具');
  console.log('========================================\n');
  
  // 检查数据库文件是否存在
  const dbExists = fs.existsSync(dbPath);
  if (!dbExists) {
    console.log('数据库不存在，将创建新数据库...\n');
  }
  
  // 查找可用的数据文件
  const dataFiles = [
    { path: path.join(dataDir, 'theory-pack.json'), type: 'json' },
    { path: path.join(dataDir, 'questions.csv'), type: 'csv' },
  ];
  
  const availableFiles = dataFiles.filter(f => fs.existsSync(f.path));
  
  if (availableFiles.length === 0) {
    console.log('未找到数据文件。请确保以下文件存在于 data 目录中：');
    console.log('  - theory-pack.json (推荐，包含完整的知识点和题目)');
    console.log('  - questions.csv (仅题目数据)');
    console.log('  - progress.csv (进度数据)\n');
    process.exit(1);
  }
  
  console.log('找到以下数据文件：');
  availableFiles.forEach(f => console.log(`  - ${path.basename(f.path)}`));
  console.log();
  
  // 导入数据
  for (const file of availableFiles) {
    if (file.type === 'json') {
      await importFromJSON(file.path);
    } else if (file.type === 'csv') {
      await importFromCSV(file.path);
    }
    console.log();
  }
  
  console.log('========================================');
  console.log('  数据导入完成！');
  console.log('========================================');
};

// 运行主函数
main().catch(error => {
  console.error('导入过程中发生错误:', error);
  process.exit(1);
});
