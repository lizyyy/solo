const pool = require('../config/database');

const getVersionById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const versionResult = await pool.query(`
      SELECT pv.*, u.name as created_by_name, p.name as project_name, c.name as customer_name
      FROM proposal_versions pv
      LEFT JOIN users u ON pv.created_by = u.id
      LEFT JOIN projects p ON pv.project_id = p.id
      LEFT JOIN customers c ON p.customer_id = c.id
      WHERE pv.id = $1
    `, [id]);
    
    if (versionResult.rows.length === 0) {
      return res.status(404).json({ error: '方案版本不存在' });
    }
    
    const version = versionResult.rows[0];
    
    const [quotationResult, changesResult, confirmationsResult, attachmentsResult] = await Promise.all([
      pool.query('SELECT * FROM quotation_items WHERE proposal_version_id = $1 ORDER BY item_order', [id]),
      pool.query(`
        SELECT sc.*, u.name as created_by_name 
        FROM scope_changes sc
        LEFT JOIN users u ON sc.created_by = u.id
        WHERE sc.proposal_version_id = $1
        ORDER BY sc.created_at DESC
      `, [id]),
      pool.query(`
        SELECT c.*, u.name as created_by_name 
        FROM confirmations c
        LEFT JOIN users u ON c.created_by = u.id
        WHERE c.proposal_version_id = $1
        ORDER BY c.created_at DESC
      `, [id]),
      pool.query(`
        SELECT a.*, u.name as uploaded_by_name 
        FROM attachments a
        LEFT JOIN users u ON a.uploaded_by = u.id
        WHERE a.proposal_version_id = $1
        ORDER BY a.upload_time DESC
      `, [id])
    ]);
    
    version.quotation_items = quotationResult.rows;
    version.scope_changes = changesResult.rows;
    version.confirmations = confirmationsResult.rows;
    version.attachments = attachmentsResult.rows;
    
    res.json(version);
  } catch (error) {
    console.error('获取方案版本详情失败:', error);
    res.status(500).json({ error: '服务器错误' });
  }
};

const createVersion = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const { project_id, version_number, version_name, scope_description, quotation_items, scope_changes, source_version_id } = req.body;
    
    const existingVersion = await client.query(
      'SELECT id FROM proposal_versions WHERE project_id = $1 AND version_number = $2',
      [project_id, version_number]
    );
    
    if (existingVersion.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: '该项目下已存在相同版本号' });
    }
    
    let total_amount = 0;
    if (quotation_items && quotation_items.length > 0) {
      total_amount = quotation_items.reduce((sum, item) => {
        const itemAmount = parseFloat(item.quantity) * parseFloat(item.unit_price);
        return sum + itemAmount;
      }, 0);
    }
    
    const versionResult = await client.query(
      `INSERT INTO proposal_versions 
       (project_id, version_number, version_name, scope_description, total_amount, final_amount, created_by)
       VALUES ($1, $2, $3, $4, $5, $5, $6)
       RETURNING *`,
      [project_id, version_number, version_name, scope_description, total_amount, req.user.id]
    );
    
    const version = versionResult.rows[0];
    
    if (quotation_items && quotation_items.length > 0) {
      for (let i = 0; i < quotation_items.length; i++) {
        const item = quotation_items[i];
        const amount = parseFloat(item.quantity) * parseFloat(item.unit_price);
        await client.query(
          `INSERT INTO quotation_items 
           (proposal_version_id, item_order, category, item_name, description, quantity, unit, unit_price, amount)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [version.id, i + 1, item.category, item.item_name, item.description, item.quantity, item.unit, item.unit_price, amount]
        );
      }
    }
    
    if (scope_changes && scope_changes.length > 0) {
      for (const change of scope_changes) {
        await client.query(
          `INSERT INTO scope_changes 
           (proposal_version_id, change_type, change_content, change_reason, created_by)
           VALUES ($1, $2, $3, $4, $5)`,
          [version.id, change.change_type, change.change_content, change.change_reason, req.user.id]
        );
      }
    }
    
    if (source_version_id) {
      const sourceVersion = await client.query(
        'SELECT is_voided FROM proposal_versions WHERE id = $1',
        [source_version_id]
      );
      
      if (sourceVersion.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: '引用的源版本不存在' });
      }
      
      if (sourceVersion.rows[0].is_voided) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: '不能引用已作废的版本' });
      }
      
      await client.query(
        'INSERT INTO version_reference (source_version_id, target_version_id, reference_type) VALUES ($1, $2, $3)',
        [source_version_id, version.id, 'derived']
      );
    }
    
    await client.query('COMMIT');
    res.status(201).json(version);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('创建方案版本失败:', error);
    res.status(500).json({ error: '服务器错误' });
  } finally {
    client.release();
  }
};

const updateVersion = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const { id } = req.params;
    const { version_name, scope_description, discount_amount, quotation_items, scope_changes } = req.body;
    
    const existingVersion = await client.query(
      'SELECT is_confirmed, is_voided FROM proposal_versions WHERE id = $1',
      [id]
    );
    
    if (existingVersion.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: '方案版本不存在' });
    }
    
    if (existingVersion.rows[0].is_confirmed) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: '已确认的方案版本不能直接修改' });
    }
    
    if (existingVersion.rows[0].is_voided) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: '已作废的方案版本不能修改' });
    }
    
    let total_amount = 0;
    if (quotation_items && quotation_items.length > 0) {
      total_amount = quotation_items.reduce((sum, item) => {
        const itemAmount = parseFloat(item.quantity) * parseFloat(item.unit_price);
        return sum + itemAmount;
      }, 0);
    }
    
    const final_amount = total_amount - (parseFloat(discount_amount) || 0);
    
    const updateResult = await client.query(
      `UPDATE proposal_versions 
       SET version_name = $1, scope_description = $2, total_amount = $3, 
           discount_amount = $4, final_amount = $5, updated_at = CURRENT_TIMESTAMP
       WHERE id = $6
       RETURNING *`,
      [version_name, scope_description, total_amount, discount_amount || 0, final_amount, id]
    );
    
    const version = updateResult.rows[0];
    
    if (quotation_items) {
      await client.query('DELETE FROM quotation_items WHERE proposal_version_id = $1', [id]);
      
      for (let i = 0; i < quotation_items.length; i++) {
        const item = quotation_items[i];
        const amount = parseFloat(item.quantity) * parseFloat(item.unit_price);
        await client.query(
          `INSERT INTO quotation_items 
           (proposal_version_id, item_order, category, item_name, description, quantity, unit, unit_price, amount)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [id, i + 1, item.category, item.item_name, item.description, item.quantity, item.unit, item.unit_price, amount]
        );
      }
    }
    
    if (scope_changes) {
      for (const change of scope_changes) {
        if (!change.id) {
          await client.query(
            `INSERT INTO scope_changes 
             (proposal_version_id, change_type, change_content, change_reason, created_by)
             VALUES ($1, $2, $3, $4, $5)`,
            [id, change.change_type, change.change_content, change.change_reason, req.user.id]
          );
        }
      }
    }
    
    await client.query('COMMIT');
    res.json(version);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('更新方案版本失败:', error);
    res.status(500).json({ error: '服务器错误' });
  } finally {
    client.release();
  }
};

const confirmVersion = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const { id } = req.params;
    const { confirmer_name, confirmer_company, confirmation_method, confirmation_date, notes } = req.body;
    
    const versionResult = await client.query(
      'SELECT pv.*, p.id as project_id FROM proposal_versions pv LEFT JOIN projects p ON pv.project_id = p.id WHERE pv.id = $1',
      [id]
    );
    
    if (versionResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: '方案版本不存在' });
    }
    
    const version = versionResult.rows[0];
    
    if (version.is_voided) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: '已作废的版本不能确认' });
    }
    
    const existingConfirmed = await client.query(
      'SELECT COUNT(*) as count FROM proposal_versions WHERE project_id = $1 AND is_confirmed = TRUE AND id != $2',
      [version.project_id, id]
    );
    
    if (parseInt(existingConfirmed.rows[0].count) > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: '同一项目下已有已确认的版本，不能重复确认' });
    }
    
    const quotationItems = await client.query(
      'SELECT SUM(amount) as total FROM quotation_items WHERE proposal_version_id = $1',
      [id]
    );
    
    const itemsTotal = parseFloat(quotationItems.rows[0].total) || 0;
    const versionTotal = parseFloat(version.total_amount) || 0;
    
    if (Math.abs(itemsTotal - versionTotal) > 0.01) {
      await client.query('ROLLBACK');
      return res.status(400).json({ 
        error: '报价总额与明细不一致',
        details: {
          version_total: versionTotal,
          items_total: itemsTotal
        }
      });
    }
    
    const finalAmount = versionTotal - (parseFloat(version.discount_amount) || 0);
    if (Math.abs(finalAmount - parseFloat(version.final_amount)) > 0.01) {
      await client.query('ROLLBACK');
      return res.status(400).json({ 
        error: '最终金额计算不正确',
        details: {
          calculated: finalAmount,
          stored: parseFloat(version.final_amount)
        }
      });
    }
    
    await client.query(
      'UPDATE proposal_versions SET is_confirmed = TRUE, status = $1, confirmed_at = CURRENT_TIMESTAMP WHERE id = $2',
      ['confirmed', id]
    );
    
    await client.query(
      `INSERT INTO confirmations 
       (proposal_version_id, confirmer_name, confirmer_company, confirmation_method, confirmation_date, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [id, confirmer_name, confirmer_company, confirmation_method, confirmation_date, notes, req.user.id]
    );
    
    await client.query('COMMIT');
    res.json({ message: '方案版本确认成功' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('确认方案版本失败:', error);
    res.status(500).json({ error: '服务器错误' });
  } finally {
    client.release();
  }
};

const voidVersion = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const { id } = req.params;
    const { reason } = req.body;
    
    const referenced = await client.query(
      'SELECT COUNT(*) as count FROM version_reference WHERE source_version_id = $1',
      [id]
    );
    
    if (parseInt(referenced.rows[0].count) > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: '该版本已被其他版本引用，不能作废' });
    }
    
    const result = await client.query(
      'UPDATE proposal_versions SET is_voided = TRUE, status = $1, voided_at = CURRENT_TIMESTAMP, voided_reason = $2 WHERE id = $3 RETURNING *',
      ['voided', reason, id]
    );
    
    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: '方案版本不存在' });
    }
    
    await client.query('COMMIT');
    res.json({ message: '方案版本作废成功' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('作废方案版本失败:', error);
    res.status(500).json({ error: '服务器错误' });
  } finally {
    client.release();
  }
};

const compareVersions = async (req, res) => {
  try {
    const { version1_id, version2_id } = req.query;
    
    const [v1Result, v2Result] = await Promise.all([
      pool.query(`
        SELECT pv.*, 
               (SELECT json_agg(q ORDER BY q.item_order) FROM quotation_items q WHERE q.proposal_version_id = pv.id) as quotation_items,
               (SELECT json_agg(sc ORDER BY sc.created_at) FROM scope_changes sc WHERE sc.proposal_version_id = pv.id) as scope_changes
        FROM proposal_versions pv
        WHERE pv.id = $1
      `, [version1_id]),
      pool.query(`
        SELECT pv.*, 
               (SELECT json_agg(q ORDER BY q.item_order) FROM quotation_items q WHERE q.proposal_version_id = pv.id) as quotation_items,
               (SELECT json_agg(sc ORDER BY sc.created_at) FROM scope_changes sc WHERE sc.proposal_version_id = pv.id) as scope_changes
        FROM proposal_versions pv
        WHERE pv.id = $1
      `, [version2_id])
    ]);
    
    if (v1Result.rows.length === 0 || v2Result.rows.length === 0) {
      return res.status(404).json({ error: '版本不存在' });
    }
    
    res.json({
      version1: v1Result.rows[0],
      version2: v2Result.rows[0]
    });
  } catch (error) {
    console.error('版本对比失败:', error);
    res.status(500).json({ error: '服务器错误' });
  }
};

const getPendingAttachments = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT a.*, pv.version_number, pv.version_name, p.name as project_name, c.name as customer_name
      FROM attachments a
      JOIN proposal_versions pv ON a.proposal_version_id = pv.id
      JOIN projects p ON pv.project_id = p.id
      JOIN customers c ON p.customer_id = c.id
      WHERE a.is_required = TRUE AND a.file_path IS NULL
      ORDER BY a.upload_time DESC
    `);
    
    res.json(result.rows);
  } catch (error) {
    console.error('获取待补附件失败:', error);
    res.status(500).json({ error: '服务器错误' });
  }
};

const getConfirmedProposals = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT pv.*, 
             p.name as project_name,
             c.name as customer_name,
             c.contact_person,
             c.contact_phone,
             u.name as created_by_name,
             (SELECT json_agg(q) FROM quotation_items q WHERE q.proposal_version_id = pv.id) as quotation_items,
             (SELECT json_agg(co ORDER BY co.created_at DESC) FROM confirmations co WHERE co.proposal_version_id = pv.id LIMIT 1) as latest_confirmation
      FROM proposal_versions pv
      JOIN projects p ON pv.project_id = p.id
      JOIN customers c ON p.customer_id = c.id
      LEFT JOIN users u ON pv.created_by = u.id
      WHERE pv.is_confirmed = TRUE AND pv.is_voided = FALSE
      ORDER BY pv.confirmed_at DESC
    `);
    
    res.json(result.rows);
  } catch (error) {
    console.error('获取有效方案清单失败:', error);
    res.status(500).json({ error: '服务器错误' });
  }
};

module.exports = {
  getVersionById,
  createVersion,
  updateVersion,
  confirmVersion,
  voidVersion,
  compareVersions,
  getPendingAttachments,
  getConfirmedProposals
};