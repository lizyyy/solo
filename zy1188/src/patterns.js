'use strict';

const SQL_KEYWORDS = [
  'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'DROP', 'ALTER',
  'UNION', 'JOIN', 'WHERE', 'FROM', 'TABLE', 'DATABASE', 'AND', 'OR',
  'NOT', 'IN', 'LIKE', 'ORDER', 'GROUP', 'HAVING', 'LIMIT', 'OFFSET',
  'VALUES', 'SET', 'INTO', 'TRUNCATE', 'REPLACE', 'MERGE', 'COMMIT',
  'ROLLBACK', 'SAVEPOINT', 'GRANT', 'REVOKE', 'EXEC', 'EXECUTE',
  'SP_EXECUTESQL', 'OPENQUERY', 'OPENROWSET', 'DECLARE', 'FETCH',
  'WHILE', 'WAITFOR', 'DELAY', 'SLEEP', 'BENCHMARK', 'SUBSTRING',
  'ASCII', 'CHAR', 'ORD', 'MID', 'LEFT', 'RIGHT', 'LEN', 'LENGTH',
  'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'EXISTS', 'ALL', 'ANY', 'SOME'
];

const RISK_LEVELS = {
  CRITICAL: 'critical',
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low'
};

const RISK_WEIGHTS = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1
};

const DETECTION_PATTERNS = [
  {
    id: 'STRING_CONCAT_SQL',
    name: '字符串拼接SQL',
    description: '使用字符串拼接操作符(+)构建SQL语句，极易受到SQL注入攻击',
    severity: RISK_LEVELS.CRITICAL,
    patterns: [
      /("|')\s*[+.]\s*["']?\s*\w+\s*["']?\s*[+.]\s*("|')/g,
      /(\$\{[^}]+\}|\{[^}]+\})\s*[+.]\s*["']/g,
      /["']\s*[+.]\s*(\$\{[^}]+\}|\{[^}]+\})/g
    ],
    contextPattern: /(SELECT|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER)\s+/i,
    fixSuggestion: '使用参数化查询(Prepared Statements)替代字符串拼接。示例：\n' +
      '// 错误的写法:\n' +
      'const sql = "SELECT * FROM users WHERE id = " + userId;\n' +
      '\n' +
      '// 正确的写法:\n' +
      'const sql = "SELECT * FROM users WHERE id = ?";\n' +
      'db.query(sql, [userId]);',
    examples: [
      'const sql = "SELECT * FROM users WHERE id = " + userId;',
      'query = "INSERT INTO table VALUES(" + value1 + ", " + value2 + ")"'
    ]
  },
  {
    id: 'TEMPLATE_LITERAL_SQL',
    name: '模板字面量拼接SQL',
    description: '使用ES6模板字面量(``)中的${}插值构建SQL语句',
    severity: RISK_LEVELS.CRITICAL,
    patterns: [
      /`[^`]*\$\{[^}]+\}[^`]*`/g
    ],
    contextPattern: /(SELECT|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER)\s+/i,
    fixSuggestion: '模板字面量同样存在注入风险，应使用参数绑定。示例：\n' +
      '// 错误的写法:\n' +
      'const sql = `SELECT * FROM users WHERE name = "${userName}"`;\n' +
      '\n' +
      '// 正确的写法:\n' +
      'const sql = "SELECT * FROM users WHERE name = ?";\n' +
      'db.get(sql, [userName]);',
    examples: [
      'const sql = `SELECT * FROM users WHERE id = ${userId}`;',
      'db.run(`INSERT INTO logs VALUES("${message}")`)'
    ]
  },
  {
    id: 'DYNAMIC_TABLE_NO_WHITELIST',
    name: '动态表名无白名单验证',
    description: '直接使用用户输入作为表名或列名，且未进行白名单验证',
    severity: RISK_LEVELS.HIGH,
    patterns: [
      /(?:table|TABLE|from|FROM|join|JOIN)\s+["']?\s*[+.]\s*["']?\s*\w+/g,
      /(?:table|TABLE|from|FROM|join|JOIN)\s+["']?\s*\$\{[^}]+\}/g,
      /(?:column|COLUMN|order\s+by|ORDER\s+BY|group\s+by|GROUP\s+BY)\s+["']?\s*[+.]\s*["']?\s*\w+/g
    ],
    contextPattern: /(SELECT|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER)\s+/i,
    fixSuggestion: '表名和列名不能使用参数绑定，必须使用白名单验证。示例：\n' +
      '// 错误的写法:\n' +
      'const sql = `SELECT * FROM ${tableName}`;\n' +
      '\n' +
      '// 正确的写法:\n' +
      'const ALLOWED_TABLES = ["users", "products", "orders"];\n' +
      'if (!ALLOWED_TABLES.includes(tableName)) {\n' +
      '  throw new Error("Invalid table name");\n' +
      '}\n' +
      'const sql = `SELECT * FROM ${tableName}`;',
    examples: [
      'const sql = "SELECT * FROM " + tableName;',
      'query = `SELECT ${column} FROM users`'
    ]
  },
  {
    id: 'USER_INPUT_IN_SQL',
    name: '用户输入直接嵌入SQL',
    description: '检测到req.body/req.query/req.params等用户输入直接用于SQL构建',
    severity: RISK_LEVELS.CRITICAL,
    patterns: [
      /req\.(body|query|params|cookies|headers)\.\w+/g,
      /\b(request|input|userInput|getParam|getQuery)\s*\(\s*["']?\w+["']?\s*\)/g
    ],
    contextPattern: /(SELECT|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER)\s+/i,
    fixSuggestion: '永远不要直接将用户输入嵌入SQL语句，必须使用参数绑定。示例：\n' +
      '// 错误的写法:\n' +
      'const sql = "SELECT * FROM users WHERE id = " + req.query.id;\n' +
      '\n' +
      '// 正确的写法:\n' +
      'const sql = "SELECT * FROM users WHERE id = ?";\n' +
      'db.query(sql, [req.query.id]);',
    examples: [
      '"SELECT * FROM users WHERE name = " + req.body.username',
      '`SELECT * FROM products WHERE id = ${req.params.id}`'
    ]
  },
  {
    id: 'STRING_FORMAT_SQL',
    name: '字符串格式化函数构建SQL',
    description: '使用sprintf、format、util.format等字符串格式化函数构建SQL',
    severity: RISK_LEVELS.HIGH,
    patterns: [
      /(sprintf|printf|format|util\.format|String\.format)\s*\(\s*["'].*%[sd]/g,
      /\.format\s*\(\s*\w+.*\)/g
    ],
    contextPattern: /(SELECT|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER)\s+/i,
    fixSuggestion: '字符串格式化函数同样会导致注入。使用参数绑定替代。示例：\n' +
      '// 错误的写法:\n' +
      'const sql = util.format("SELECT * FROM users WHERE id = %s", userId);\n' +
      '\n' +
      '// 正确的写法:\n' +
      'const sql = "SELECT * FROM users WHERE id = ?";\n' +
      'db.query(sql, [userId]);',
    examples: [
      'sprintf("SELECT * FROM users WHERE name = \'%s\'", userName)',
      '"SELECT * FROM table WHERE id = {0}".format(userId)'
    ]
  },
  {
    id: 'COMMENT_IN_SQL',
    name: 'SQL注释符检测',
    description: 'SQL语句中包含注释符(--, /* */)，可能用于注入测试',
    severity: RISK_LEVELS.MEDIUM,
    patterns: [
      /--\s*["']?$/gm,
      /;.*--/g,
      /\/\*.*\*\//g
    ],
    contextPattern: /(SELECT|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER)\s+/i,
    fixSuggestion: '检查SQL语句构建逻辑，移除不必要的注释符。如果是动态构建的SQL，确保使用参数绑定。',
    examples: [
      '"SELECT * FROM users WHERE id = " + input + " --"',
      'query = query + " OR 1=1 --"'
    ]
  },
  {
    id: 'UNION_SQL_INJECTION',
    name: 'UNION注入检测',
    description: '动态构建的SQL中包含UNION关键字，可能存在UNION注入风险',
    severity: RISK_LEVELS.MEDIUM,
    patterns: [
      /UNION\s+(ALL\s+)?SELECT/gi,
      /union\s+(all\s+)?select/gi
    ],
    contextPattern: /[+.]\s*["']?\s*\w+|(\$\{[^}]+\})/g,
    fixSuggestion: '如果需要动态拼接查询，确保所有输入都经过严格验证和转义，或使用ORM框架。',
    examples: [
      'const sql = "SELECT * FROM products WHERE id = " + id + " UNION SELECT * FROM users";'
    ]
  },
  {
    id: 'EXECUTE_DYNAMIC_SQL',
    name: '执行动态SQL',
    description: '使用eval、Function构造器或exec执行动态构建的SQL',
    severity: RISK_LEVELS.CRITICAL,
    patterns: [
      /eval\s*\(/g,
      /new\s+Function\s*\(/g,
      /exec\s*\(/g,
      /execute\s*\(/g,
      /sp_executesql/gi
    ],
    contextPattern: /(SELECT|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER)\s+/i,
    fixSuggestion: '避免使用eval或类似函数执行动态代码。使用参数化查询和预编译语句。示例：\n' +
      '// 危险的写法:\n' +
      'eval("db.query(\'" + sql + "\')");\n' +
      '\n' +
      '// 安全的写法:\n' +
      'db.query(sql, params);',
    examples: [
      'eval("db.run(\'" + sql + "\')")',
      'const func = new Function("return db.query(\'" + sql + "\')")'
    ]
  },
  {
    id: 'CONCAT_FUNCTION_SQL',
    name: '使用字符串函数构建SQL',
    description: '使用CONCAT、||等字符串连接函数构建SQL语句',
    severity: RISK_LEVELS.HIGH,
    patterns: [
      /CONCAT\s*\(/gi,
      /\|\|/g,
      /concat\s*\(/g
    ],
    contextPattern: /(SELECT|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER)\s+/i,
    fixSuggestion: '字符串连接函数构建的SQL同样存在注入风险。使用参数绑定替代。',
    examples: [
      'CONCAT("SELECT * FROM users WHERE id = ", userId)',
      '"SELECT * FROM table " || condition'
    ]
  },
  {
    id: 'NO_PARAMETER_BINDING',
    name: '疑似缺少参数绑定',
    description: '检测到硬编码的SQL字面量值，建议使用参数绑定',
    severity: RISK_LEVELS.LOW,
    patterns: [
      /=\\s*['"][^'"]*['"]/g,
      /IN\\s*\\(\\s*['"][^)]+['"]\\s*\\)/g
    ],
    contextPattern: /(SELECT|INSERT|UPDATE|DELETE)\s+/i,
    fixSuggestion: '即使是硬编码的值，也建议使用参数绑定以养成好习惯，并为未来可能的动态化做好准备。示例：\n' +
      '// 可以但不推荐:\n' +
      'const sql = "SELECT * FROM users WHERE status = \'active\'";\n' +
      '\n' +
      '// 更好的做法:\n' +
      'const sql = "SELECT * FROM users WHERE status = ?";\n' +
      'db.query(sql, ["active"]);',
    examples: [
      '"SELECT * FROM users WHERE status = \'active\'"',
      '"SELECT * FROM products WHERE category IN (\'A\', \'B\')"'
    ]
  }
];

const FILE_EXTENSIONS_TO_SCAN = [
  '.js', '.jsx', '.ts', '.tsx',
  '.py',
  '.php',
  '.java',
  '.rb',
  '.go',
  '.cs',
  '.c', '.cpp',
  '.sql'
];

const FILES_TO_IGNORE = [
  'node_modules/',
  'dist/',
  'build/',
  '.git/',
  'test/',
  'tests/',
  'spec/',
  '__tests__/',
  'coverage/',
  '.env',
  '.env.*',
  '*.min.js',
  '*.bundle.js',
  'package-lock.json',
  'yarn.lock'
];

const DATABASE_FILE_PATTERNS = [
  '*.db',
  '*.sqlite',
  '*.sqlite3',
  '*.db3',
  '*.s3db',
  '*.sl3'
];

const DATABASE_RELATED_FILES = [
  '*.db-wal',
  '*.db-shm',
  '*.sqlite-wal',
  '*.sqlite-shm',
  '*backup*.db',
  '*backup*.sqlite',
  '*.bak',
  '*.backup'
];

const PERMISSION_RISKS = {
  WORLD_READABLE: {
    severity: RISK_LEVELS.HIGH,
    description: '数据库文件对所有用户可读，可能导致敏感数据泄露',
    fixSuggestion: '修改文件权限为仅所有者可读: chmod 600 <filename>'
  },
  WORLD_WRITABLE: {
    severity: RISK_LEVELS.CRITICAL,
    description: '数据库文件对所有用户可写，可能被恶意篡改',
    fixSuggestion: '修改文件权限: chmod 600 <filename>'
  },
  WORLD_EXECUTABLE: {
    severity: RISK_LEVELS.MEDIUM,
    description: '数据库文件有可执行权限，这是不必要的',
    fixSuggestion: '移除可执行权限: chmod -x <filename>'
  },
  IN_DIRECTORY_WITH_WORLD_WRITE: {
    severity: RISK_LEVELS.HIGH,
    description: '数据库文件所在目录对所有用户可写，文件可能被替换',
    fixSuggestion: '修改父目录权限: chmod 755 <directory>'
  }
};

module.exports = {
  SQL_KEYWORDS,
  RISK_LEVELS,
  RISK_WEIGHTS,
  DETECTION_PATTERNS,
  FILE_EXTENSIONS_TO_SCAN,
  FILES_TO_IGNORE,
  DATABASE_FILE_PATTERNS,
  DATABASE_RELATED_FILES,
  PERMISSION_RISKS
};
