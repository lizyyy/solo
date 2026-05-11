const pool = require('../config/database');

async function initDatabase() {
  const client = await pool.connect();
  try {
    console.log('开始初始化数据库...');
    
    await client.query('BEGIN');
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        username VARCHAR(50) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE,
        role VARCHAR(20) NOT NULL DEFAULT 'sales',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE IF NOT EXISTS customers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(200) NOT NULL,
        contact_person VARCHAR(100),
        contact_phone VARCHAR(50),
        contact_email VARCHAR(100),
        address TEXT,
        industry VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_by UUID REFERENCES users(id),
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE IF NOT EXISTS projects (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        customer_id UUID REFERENCES customers(id) NOT NULL,
        name VARCHAR(200) NOT NULL,
        description TEXT,
        status VARCHAR(20) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_by UUID REFERENCES users(id),
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE IF NOT EXISTS proposal_versions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id UUID REFERENCES projects(id) NOT NULL,
        version_number VARCHAR(20) NOT NULL,
        version_name VARCHAR(200),
        scope_description TEXT,
        total_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
        discount_amount DECIMAL(15,2) DEFAULT 0,
        final_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
        status VARCHAR(20) DEFAULT 'draft',
        is_confirmed BOOLEAN DEFAULT FALSE,
        is_voided BOOLEAN DEFAULT FALSE,
        confirmed_at TIMESTAMP,
        voided_at TIMESTAMP,
        voided_reason TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_by UUID REFERENCES users(id),
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(project_id, version_number)
      );
      
      CREATE TABLE IF NOT EXISTS quotation_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        proposal_version_id UUID REFERENCES proposal_versions(id) ON DELETE CASCADE NOT NULL,
        item_order INT NOT NULL,
        category VARCHAR(100) NOT NULL,
        item_name VARCHAR(200) NOT NULL,
        description TEXT,
        quantity DECIMAL(10,2) NOT NULL DEFAULT 1,
        unit VARCHAR(50),
        unit_price DECIMAL(15,2) NOT NULL,
        amount DECIMAL(15,2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE IF NOT EXISTS scope_changes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        proposal_version_id UUID REFERENCES proposal_versions(id) NOT NULL,
        change_type VARCHAR(50) NOT NULL,
        change_content TEXT NOT NULL,
        change_reason TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_by UUID REFERENCES users(id)
      );
      
      CREATE TABLE IF NOT EXISTS confirmations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        proposal_version_id UUID REFERENCES proposal_versions(id) NOT NULL,
        confirmer_name VARCHAR(100) NOT NULL,
        confirmer_company VARCHAR(200),
        confirmation_method VARCHAR(50) NOT NULL,
        confirmation_date DATE NOT NULL,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_by UUID REFERENCES users(id)
      );
      
      CREATE TABLE IF NOT EXISTS attachments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        proposal_version_id UUID REFERENCES proposal_versions(id) NOT NULL,
        file_name VARCHAR(255) NOT NULL,
        original_name VARCHAR(255),
        file_path VARCHAR(500),
        file_size INT,
        file_type VARCHAR(100),
        is_required BOOLEAN DEFAULT FALSE,
        upload_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        uploaded_by UUID REFERENCES users(id)
      );
      
      CREATE TABLE IF NOT EXISTS version_reference (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        source_version_id UUID REFERENCES proposal_versions(id),
        target_version_id UUID REFERENCES proposal_versions(id),
        reference_type VARCHAR(50) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_proposal_project ON proposal_versions(project_id);
      CREATE INDEX IF NOT EXISTS idx_proposal_status ON proposal_versions(status);
      CREATE INDEX IF NOT EXISTS idx_proposal_confirmed ON proposal_versions(is_confirmed);
      CREATE INDEX IF NOT EXISTS idx_quotation_proposal ON quotation_items(proposal_version_id);
    `);
    
    await client.query('COMMIT');
    console.log('数据库初始化完成！');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('数据库初始化失败:', error);
  } finally {
    client.release();
    process.exit();
  }
}

initDatabase();
