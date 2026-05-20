import { v4 as uuidv4 } from 'uuid';
import { allQuery, getQuery, runQuery } from '../database';
import { InvoiceImage, TripRecord, BudgetCategory, MatchResult } from '../types';
import dayjs from 'dayjs';

export class MatchingEngine {
  async receiveInvoiceOCR(invoiceData: Partial<InvoiceImage>): Promise<InvoiceImage> {
    const invoiceId = uuidv4();
    const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
    
    const sql = `
      INSERT INTO invoice_images (
        id, invoice_no, invoice_code, invoice_date, amount, tax_amount, 
        total_amount, seller_name, seller_tax_no, buyer_name, buyer_tax_no,
        category, image_url, ocr_result, status, employee_id, employee_name, 
        department, uploaded_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    await runQuery(sql, [
      invoiceId,
      invoiceData.invoice_no,
      invoiceData.invoice_code,
      invoiceData.invoice_date,
      invoiceData.amount,
      invoiceData.tax_amount,
      invoiceData.total_amount,
      invoiceData.seller_name,
      invoiceData.seller_tax_no,
      invoiceData.buyer_name,
      invoiceData.buyer_tax_no,
      invoiceData.category,
      invoiceData.image_url,
      invoiceData.ocr_result,
      'pending',
      invoiceData.employee_id,
      invoiceData.employee_name,
      invoiceData.department,
      now,
      now,
      now
    ]);

    await this.addTimeline('invoice', invoiceId, 'pending', null, 'system', '票据OCR识别完成，待匹配');

    return this.getInvoiceById(invoiceId) as Promise<InvoiceImage>;
  }

  async checkDuplicate(invoiceId: string): Promise<{ isDuplicate: boolean; duplicates: any[] }> {
    const invoice = await this.getInvoiceById(invoiceId);
    if (!invoice) return { isDuplicate: false, duplicates: [] };

    const duplicates: any[] = [];
    
    if (invoice.invoice_no && invoice.invoice_code) {
      const sql = `
        SELECT * FROM invoice_images 
        WHERE invoice_no = ? AND invoice_code = ? AND id != ?
      `;
      const existing = await allQuery(sql, [invoice.invoice_no, invoice.invoice_code, invoiceId]);
      
      for (const exist of existing) {
        const duplicateId = uuidv4();
        const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
        
        await runQuery(`
          INSERT INTO duplicate_invoices (
            id, original_invoice_id, duplicate_invoice_id, duplicate_type, 
            confidence, status, detected_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [duplicateId, exist.id, invoiceId, 'invoice_no_match', 1.0, 'pending', now]);
        
        duplicates.push({
          id: duplicateId,
          original_invoice: exist,
          duplicate_invoice: invoice,
          duplicate_type: 'invoice_no_match',
          confidence: 1.0
        });
      }
    }

    if (invoice.total_amount && invoice.invoice_date) {
      const sql2 = `
        SELECT * FROM invoice_images 
        WHERE total_amount = ? AND invoice_date = ? AND id != ?
      `;
      const sameAmount = await allQuery(sql2, [invoice.total_amount, invoice.invoice_date, invoiceId]);
      
      for (const same of sameAmount) {
        if (!duplicates.find(d => d.duplicate_invoice.id === same.id)) {
          const duplicateId = uuidv4();
          const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
          
          await runQuery(`
            INSERT INTO duplicate_invoices (
              id, original_invoice_id, duplicate_invoice_id, duplicate_type, 
              confidence, status, detected_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
          `, [duplicateId, same.id, invoiceId, 'amount_date_match', 0.8, 'pending', now]);
          
          duplicates.push({
            id: duplicateId,
            original_invoice: same,
            duplicate_invoice: invoice,
            duplicate_type: 'amount_date_match',
            confidence: 0.8
          });
        }
      }
    }

    if (duplicates.length > 0) {
      await this.updateInvoiceStatus(invoiceId, 'duplicate');
      await this.addTimeline('invoice', invoiceId, 'duplicate', 'pending', 'system', '检测到重复票据');
    }

    return { isDuplicate: duplicates.length > 0, duplicates };
  }

  async autoMatch(invoiceId: string): Promise<MatchResult | null> {
    const invoice = await this.getInvoiceById(invoiceId);
    if (!invoice || invoice.status === 'duplicate') return null;

    let bestMatch: any = null;
    let bestScore = 0;

    const trips = await allQuery<TripRecord>(`
      SELECT * FROM trip_records 
      WHERE employee_id = ? AND status = 'pending'
    `, [invoice.employee_id]);

    for (const trip of trips) {
      let score = 0;
      
      if (invoice.invoice_date && trip.start_date && trip.end_date) {
        const invoiceDate = dayjs(invoice.invoice_date);
        const tripStart = dayjs(trip.start_date);
        const tripEnd = dayjs(trip.end_date);
        
        if (invoiceDate.isAfter(tripStart.subtract(1, 'day')) && 
            invoiceDate.isBefore(tripEnd.add(1, 'day'))) {
          score += 40;
        }
      }

      if (invoice.total_amount && trip.estimated_amount) {
        const ratio = Math.min(invoice.total_amount, trip.estimated_amount) / 
                      Math.max(invoice.total_amount, trip.estimated_amount);
        if (ratio > 0.8) score += 30;
      }

      if (invoice.category && invoice.category.includes('交通') && trip.trip_type) {
        score += 20;
      }

      if (score > bestScore) {
        bestScore = score;
        bestMatch = { type: 'trip', data: trip, score };
      }
    }

    if (invoice.category) {
      const budgets = await allQuery<BudgetCategory>(`
        SELECT * FROM budget_categories WHERE status = 'active'
      `);
      
      for (const budget of budgets) {
        let score = 0;
        if (invoice.category.includes('交通') && budget.name.includes('交通')) score += 50;
        if (invoice.category.includes('住宿') && budget.name.includes('住宿')) score += 50;
        if (invoice.category.includes('餐饮') && budget.name.includes('餐饮')) score += 50;
        
        if (invoice.department && budget.department === invoice.department) score += 30;
        
        if (score > bestScore) {
          bestScore = score;
          bestMatch = { type: 'budget', data: budget, score };
        }
      }
    }

    if (bestMatch && bestScore >= 50) {
      const matchId = uuidv4();
      const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
      
      await runQuery(`
        INSERT INTO match_results (
          id, invoice_id, trip_id, budget_category_id, match_type, 
          match_score, status, matched_by, matched_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        matchId,
        invoiceId,
        bestMatch.type === 'trip' ? bestMatch.data.id : null,
        bestMatch.type === 'budget' ? bestMatch.data.id : null,
        bestMatch.type,
        bestScore,
        'auto_matched',
        'system',
        now,
        now,
        now
      ]);

      await this.updateInvoiceStatus(invoiceId, 'matched');
      await this.addTimeline('invoice', invoiceId, 'matched', 'pending', 'system', `自动匹配成功（${bestMatch.type}，得分${bestScore}）`);

      return getQuery(`SELECT * FROM match_results WHERE id = ?`, [matchId]) as Promise<MatchResult | null>;
    }

    return null;
  }

  async manualMatch(invoiceId: string, matchData: {
    trip_id?: string;
    budget_category_id?: string;
    reimbursement_id?: string;
    notes?: string;
    operator: string;
  }): Promise<MatchResult> {
    const matchId = uuidv4();
    const now = dayjs().format('YYYY-MM-DD HH:mm:ss');

    await runQuery(`
      INSERT INTO match_results (
        id, invoice_id, trip_id, budget_category_id, reimbursement_id,
        match_type, match_score, status, matched_by, matched_at, notes,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      matchId,
      invoiceId,
      matchData.trip_id || null,
      matchData.budget_category_id || null,
      matchData.reimbursement_id || null,
      'manual',
      100,
      'manual_matched',
      matchData.operator,
      now,
      matchData.notes,
      now,
      now
    ]);

    await this.updateInvoiceStatus(invoiceId, 'matched');
    await this.addTimeline('invoice', invoiceId, 'matched', undefined, matchData.operator, '人工匹配完成');

    return getQuery(`SELECT * FROM match_results WHERE id = ?`, [matchId]) as Promise<MatchResult>;
  }

  async confirmMatch(matchId: string, operator: string): Promise<void> {
    const match = await getQuery(`SELECT * FROM match_results WHERE id = ?`, [matchId]);
    if (!match) throw new Error('匹配记录不存在');

    await runQuery(`
      UPDATE match_results SET status = 'confirmed', updated_at = ? WHERE id = ?
    `, [dayjs().format('YYYY-MM-DD HH:mm:ss'), matchId]);

    await runQuery(`
      UPDATE invoice_images SET status = 'confirmed', updated_at = ? WHERE id = ?
    `, [dayjs().format('YYYY-MM-DD HH:mm:ss'), match.invoice_id]);

    await this.addTimeline('invoice', match.invoice_id, 'confirmed', 'matched', operator, '匹配结果已确认');
  }

  async resolveDuplicate(duplicateId: string, action: 'keep_original' | 'keep_duplicate' | 'keep_both', operator: string): Promise<void> {
    const duplicate = await getQuery(`SELECT * FROM duplicate_invoices WHERE id = ?`, [duplicateId]);
    if (!duplicate) throw new Error('重复记录不存在');

    const now = dayjs().format('YYYY-MM-DD HH:mm:ss');

    await runQuery(`
      UPDATE duplicate_invoices SET status = 'resolved', resolved_at = ? WHERE id = ?
    `, [now, duplicateId]);

    if (action === 'keep_original') {
      await runQuery(`UPDATE invoice_images SET status = 'rejected' WHERE id = ?`, [duplicate.duplicate_invoice_id]);
      await this.addTimeline('invoice', duplicate.duplicate_invoice_id, 'rejected', 'duplicate', operator, '重复票据已驳回');
    } else if (action === 'keep_duplicate') {
      await runQuery(`UPDATE invoice_images SET status = 'rejected' WHERE id = ?`, [duplicate.original_invoice_id]);
      await runQuery(`UPDATE invoice_images SET status = 'pending' WHERE id = ?`, [duplicate.duplicate_invoice_id]);
      await this.addTimeline('invoice', duplicate.original_invoice_id, 'rejected', undefined, operator, '原始票据已被新票据替换');
    } else {
      await runQuery(`UPDATE invoice_images SET status = 'pending' WHERE id = ?`, [duplicate.duplicate_invoice_id]);
    }
  }

  private async getInvoiceById(id: string): Promise<InvoiceImage | undefined> {
    return getQuery(`SELECT * FROM invoice_images WHERE id = ?`, [id]);
  }

  private async updateInvoiceStatus(id: string, status: string): Promise<void> {
    await runQuery(`
      UPDATE invoice_images SET status = ?, updated_at = ? WHERE id = ?
    `, [status, dayjs().format('YYYY-MM-DD HH:mm:ss'), id]);
  }

  private async addTimeline(entityType: string, entityId: string, status: string, previousStatus?: string | null, operator?: string, notes?: string): Promise<void> {
    const sql = `
      INSERT INTO status_timeline (id, entity_type, entity_id, status, previous_status, operator, notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    await runQuery(sql, [
      uuidv4(),
      entityType,
      entityId,
      status,
      previousStatus,
      operator,
      notes,
      dayjs().format('YYYY-MM-DD HH:mm:ss')
    ]);
  }
}

export default new MatchingEngine();
