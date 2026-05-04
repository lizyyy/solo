const Project = require('../models/project');
const Migration = require('../models/migration');
const path = require('path');
const fs = require('fs');

const sampleMigrations = [
  {
    version: '0001',
    name: 'create_users_table',
    description: 'Create users table with basic fields',
    up_sql: `
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
    `,
    down_sql: `
DROP INDEX IF EXISTS idx_users_username;
DROP INDEX IF EXISTS idx_users_email;
DROP TABLE IF EXISTS users;
    `,
    dependencies: []
  },
  {
    version: '0002',
    name: 'create_posts_table',
    description: 'Create posts table with user foreign key',
    up_sql: `
CREATE TABLE posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  author_id INTEGER NOT NULL,
  status TEXT DEFAULT 'draft',
  published_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX idx_posts_author ON posts(author_id);
CREATE INDEX idx_posts_status ON posts(status);
CREATE INDEX idx_posts_created ON posts(created_at);
    `,
    down_sql: `
DROP INDEX IF EXISTS idx_posts_created;
DROP INDEX IF EXISTS idx_posts_status;
DROP INDEX IF EXISTS idx_posts_author;
DROP TABLE IF EXISTS posts;
    `,
    dependencies: ['0001']
  },
  {
    version: '0003',
    name: 'create_comments_table',
    description: 'Create comments table with foreign keys to users and posts',
    up_sql: `
CREATE TABLE comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content TEXT NOT NULL,
  author_id INTEGER NOT NULL,
  post_id INTEGER NOT NULL,
  parent_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_id) REFERENCES comments(id) ON DELETE CASCADE
);
CREATE INDEX idx_comments_author ON comments(author_id);
CREATE INDEX idx_comments_post ON comments(post_id);
CREATE INDEX idx_comments_parent ON comments(parent_id);
CREATE INDEX idx_comments_created ON comments(created_at);
    `,
    down_sql: `
DROP INDEX IF EXISTS idx_comments_created;
DROP INDEX IF EXISTS idx_comments_parent;
DROP INDEX IF EXISTS idx_comments_post;
DROP INDEX IF EXISTS idx_comments_author;
DROP TABLE IF EXISTS comments;
    `,
    dependencies: ['0002']
  },
  {
    version: '0004',
    name: 'add_user_profile_fields',
    description: 'Add profile fields to users table (risky: NOT NULL without default)',
    up_sql: `
ALTER TABLE users ADD COLUMN first_name TEXT;
ALTER TABLE users ADD COLUMN last_name TEXT;
ALTER TABLE users ADD COLUMN bio TEXT;
ALTER TABLE users ADD COLUMN avatar_url TEXT;
    `,
    down_sql: `
ALTER TABLE users DROP COLUMN avatar_url;
ALTER TABLE users DROP COLUMN bio;
ALTER TABLE users DROP COLUMN last_name;
ALTER TABLE users DROP COLUMN first_name;
    `,
    dependencies: ['0001']
  },
  {
    version: '0005',
    name: 'create_categories_and_tags',
    description: 'Create categories and tags with junction tables',
    up_sql: `
CREATE TABLE categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  parent_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE SET NULL
);

CREATE TABLE tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE post_categories (
  post_id INTEGER NOT NULL,
  category_id INTEGER NOT NULL,
  PRIMARY KEY (post_id, category_id),
  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
);

CREATE TABLE post_tags (
  post_id INTEGER NOT NULL,
  tag_id INTEGER NOT NULL,
  PRIMARY KEY (post_id, tag_id),
  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

CREATE INDEX idx_categories_slug ON categories(slug);
CREATE INDEX idx_tags_slug ON tags(slug);
CREATE INDEX idx_post_categories_category ON post_categories(category_id);
CREATE INDEX idx_post_tags_tag ON post_tags(tag_id);
    `,
    down_sql: `
DROP INDEX IF EXISTS idx_post_tags_tag;
DROP INDEX IF EXISTS idx_post_categories_category;
DROP INDEX IF EXISTS idx_tags_slug;
DROP INDEX IF EXISTS idx_categories_slug;

DROP TABLE IF EXISTS post_tags;
DROP TABLE IF EXISTS post_categories;
DROP TABLE IF EXISTS tags;
DROP TABLE IF EXISTS categories;
    `,
    dependencies: ['0002']
  },
  {
    version: '0006',
    name: 'seed_sample_data',
    description: 'Insert sample data for testing',
    up_sql: `
INSERT INTO users (username, email, password_hash, first_name, last_name, bio) VALUES
  ('admin', 'admin@example.com', 'hashed_password_1', 'Admin', 'User', 'System administrator'),
  ('johndoe', 'john@example.com', 'hashed_password_2', 'John', 'Doe', 'Blog author'),
  ('janedoe', 'jane@example.com', 'hashed_password_3', 'Jane', 'Doe', 'Content creator');

INSERT INTO posts (title, content, author_id, status, published_at) VALUES
  ('Getting Started with SQLite', 'SQLite is a lightweight database...', 1, 'published', datetime('now')),
  ('Advanced Migration Techniques', 'When writing migrations, consider...', 2, 'published', datetime('now', '-1 day')),
  ('Draft Post', 'This is a draft post...', 3, 'draft', NULL);

INSERT INTO categories (name, slug, description) VALUES
  ('Technology', 'technology', 'Tech-related posts'),
  ('Programming', 'programming', 'Programming tutorials'),
  ('Database', 'database', 'Database management');

INSERT INTO tags (name, slug) VALUES
  ('SQLite', 'sqlite'),
  ('Migrations', 'migrations'),
  ('JavaScript', 'javascript'),
  ('Node.js', 'nodejs');

INSERT INTO post_categories (post_id, category_id) VALUES
  (1, 3), (2, 2), (2, 3);

INSERT INTO post_tags (post_id, tag_id) VALUES
  (1, 1), (1, 2), (2, 1), (2, 2), (2, 4);

INSERT INTO comments (content, author_id, post_id) VALUES
  ('Great article! Very helpful.', 3, 1),
  ('I have a question about foreign keys...', 2, 1),
  ('Thanks for the tips!', 1, 2);
    `,
    down_sql: `
DELETE FROM comments;
DELETE FROM post_tags;
DELETE FROM post_categories;
DELETE FROM tags;
DELETE FROM categories;
DELETE FROM posts;
DELETE FROM users;
    `,
    dependencies: ['0005']
  }
];

async function seedDatabase() {
  const dataDir = path.join(__dirname, '../../data');
  const sampleDbPath = path.join(dataDir, 'sample-app.db');
  
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  
  let sampleProject;
  try {
    sampleProject = await Project.findByName('sample-blog-app');
    if (!sampleProject) {
      sampleProject = await Project.create(
        'sample-blog-app',
        sampleDbPath,
        'A sample blog application with user, post, and comment tables. Good for testing migration workflows.'
      );
      console.log('✓ Created sample project: sample-blog-app');
    } else {
      console.log('✓ Sample project already exists: sample-blog-app');
    }
  } catch (err) {
    console.error('Error creating sample project:', err.message);
    throw err;
  }
  
  const importResults = await Migration.batchImport(sampleProject.id, sampleMigrations);
  
  const imported = importResults.filter(r => r.status === 'imported');
  const skipped = importResults.filter(r => r.status === 'skipped');
  
  console.log(`  ✓ Imported ${imported.length} new migrations`);
  if (skipped.length > 0) {
    console.log(`  ⏭ Skipped ${skipped.length} existing migrations`);
  }
  
  console.log('');
  console.log('Sample migrations available:');
  for (const m of sampleMigrations) {
    console.log(`  - ${m.version}: ${m.name}`);
    console.log(`    ${m.description}`);
  }
  
  return {
    project: sampleProject,
    migrations: sampleMigrations,
    import_results: importResults
  };
}

module.exports = {
  sampleMigrations,
  seedDatabase
};

if (require.main === module) {
  require('../config/database');
  
  seedDatabase()
    .then(() => {
      console.log('');
      console.log('✅ Seed completed successfully!');
      process.exit(0);
    })
    .catch(err => {
      console.error('❌ Seed failed:', err.message);
      console.error(err.stack);
      process.exit(1);
    });
}
