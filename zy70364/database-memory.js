class MemoryDatabase {
  constructor() {
    this.addressStatus = new Map();
    this.emailSends = new Map();
    this.bounceEvents = new Map();
    this.bounceEventIds = new Set();

    this.initTables();
  }

  initTables() {
    this.ensureIndex('emailSends', 'email');
    this.ensureIndex('emailSends', 'domain');
    this.ensureIndex('emailSends', 'business_type');
    this.ensureIndex('bounceEvents', 'email');
  }

  ensureIndex(table, field) {
  }

  prepare(sql) {
    const self = this;

    if (sql.startsWith('INSERT')) {
      return {
        run: (...args) => {
          if (sql.includes('address_status')) {
            const [email, domain, status, softCount, canSendMarketing, canSendBilling, updatedAt, createdAt] = args;
            const record = {
              email,
              domain,
              status,
              soft_bounce_count: softCount,
              last_bounce_type: null,
              last_bounce_reason: null,
              last_bounce_at: null,
              can_send_marketing: canSendMarketing,
              can_send_billing: canSendBilling,
              updated_at: updatedAt,
              created_at: createdAt
            };
            self.addressStatus.set(email, record);
          } else if (sql.includes('email_sends')) {
            const [id, email, domain, businessType, subject, status, sentAt, messageId] = args;
            const record = {
              id,
              email,
              domain,
              business_type: businessType,
              subject,
              status,
              sent_at: sentAt,
              message_id: messageId
            };
            self.emailSends.set(id, record);
          } else if (sql.includes('bounce_events')) {
            const [id, email, bounceType, bounceReason, businessType, messageId, receivedAt, processedAt] = args;
            const record = {
              id,
              email,
              bounce_type: bounceType,
              bounce_reason: bounceReason,
              business_type: businessType,
              message_id: messageId,
              received_at: receivedAt,
              processed_at: processedAt
            };
            self.bounceEvents.set(id, record);
            self.bounceEventIds.add(id);
          }
        }
      };
    }

    if (sql.startsWith('SELECT * FROM address_status WHERE email = ?')) {
      return {
        get: (email) => self.addressStatus.get(email) || null
      };
    }

    if (sql.startsWith('SELECT * FROM bounce_events WHERE id = ?')) {
      return {
        get: (id) => self.bounceEvents.get(id) || null
      };
    }

    if (sql.startsWith('SELECT * FROM email_sends WHERE id = ?')) {
      return {
        get: (id) => self.emailSends.get(id) || null
      };
    }

    if (sql.startsWith('UPDATE address_status')) {
      return {
        run: (status, softCount, lastType, lastReason, lastAt, canMarketing, canBilling, updatedAt, email) => {
          const existing = self.addressStatus.get(email);
          if (existing) {
            existing.status = status;
            existing.soft_bounce_count = softCount;
            existing.last_bounce_type = lastType;
            existing.last_bounce_reason = lastReason;
            existing.last_bounce_at = lastAt;
            existing.can_send_marketing = canMarketing;
            existing.can_send_billing = canBilling;
            existing.updated_at = updatedAt;
          }
        }
      };
    }

    return {
      all: (...args) => self.queryAggregate(sql, args),
      get: (...args) => self.queryAggregateSingle(sql, args)
    };
  }

  queryAggregate(sql, args) {
    if (sql.includes('GROUP BY domain')) {
      const result = [];
      const byDomain = new Map();
      
      for (const send of this.emailSends.values()) {
        const domain = send.domain;
        if (!byDomain.has(domain)) {
          byDomain.set(domain, { total: 0, bounces: 0 });
        }
        const stats = byDomain.get(domain);
        stats.total++;
        
        for (const bounce of this.bounceEvents.values()) {
          if (bounce.message_id === send.message_id) {
            stats.bounces++;
            break;
          }
        }
      }
      
      for (const [domain, stats] of byDomain) {
        result.push({
          domain,
          total_sends: stats.total,
          bounce_count: stats.bounces
        });
      }
      
      return result.sort((a, b) => b.total_sends - a.total_sends);
    }

    if (sql.includes('GROUP BY business_type')) {
      const result = [];
      const byType = new Map();
      
      for (const send of this.emailSends.values()) {
        const bt = send.business_type;
        if (!byType.has(bt)) {
          byType.set(bt, { total: 0, bounces: 0 });
        }
        const stats = byType.get(bt);
        stats.total++;
        
        for (const bounce of this.bounceEvents.values()) {
          if (bounce.message_id === send.message_id) {
            stats.bounces++;
            break;
          }
        }
      }
      
      for (const [businessType, stats] of byType) {
        result.push({
          business_type: businessType,
          total_sends: stats.total,
          bounce_count: stats.bounces
        });
      }
      
      return result.sort((a, b) => b.total_sends - a.total_sends);
    }

    if (sql.includes('GROUP BY be.bounce_type')) {
      const result = [];
      const byBounceType = new Map();
      
      for (const bounce of this.bounceEvents.values()) {
        const bt = bounce.bounce_type;
        if (!byBounceType.has(bt)) {
          byBounceType.set(bt, { count: 0 });
        }
        byBounceType.get(bt).count++;
      }
      
      for (const [bounceType, stats] of byBounceType) {
        result.push({
          bounce_type: bounceType,
          count: stats.count
        });
      }
      
      return result.sort((a, b) => b.count - a.count);
    }

    return [];
  }

  queryAggregateSingle(sql, args) {
    let totalSends = 0;
    let totalBounces = 0;

    for (const send of this.emailSends.values()) {
      totalSends++;
      for (const bounce of this.bounceEvents.values()) {
        if (bounce.message_id === send.message_id) {
          totalBounces++;
          break;
        }
      }
    }

    return {
      total_sends: totalSends,
      bounce_count: totalBounces
    };
  }

  pragma() {}
  exec() {}
}

const db = new MemoryDatabase();

module.exports = db;
