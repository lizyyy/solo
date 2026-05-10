const { getDb } = require('../db');

function getShowSalesReport(showId) {
  const db = getDb();

  const show = db.prepare(`SELECT * FROM shows WHERE id = ?`).get(showId);
  if (!show) return null;

  const tiers = db.prepare(`
    SELECT 
      t.*,
      (t.total_quantity - t.sold_quantity - t.reserved_quantity) as available_quantity
    FROM ticket_tiers t
    WHERE t.show_id = ?
    ORDER BY t.price ASC
  `).all(showId);

  const orderStats = db.prepare(`
    SELECT
      status,
      COUNT(*) as order_count,
      SUM(quantity) as ticket_count,
      SUM(total_amount) as total_amount
    FROM orders
    WHERE show_id = ?
    GROUP BY status
  `).all(showId);

  const byAccount = db.prepare(`
    SELECT
      account_id,
      COUNT(*) as order_count,
      SUM(quantity) as ticket_count
    FROM orders
    WHERE show_id = ? AND status IN ('pending', 'paid')
    GROUP BY account_id
    HAVING ticket_count > 2
    ORDER BY ticket_count DESC
    LIMIT 20
  `).all(showId);

  const byIdCard = db.prepare(`
    SELECT
      id_card_no,
      COUNT(*) as order_count,
      SUM(quantity) as ticket_count
    FROM orders
    WHERE show_id = ? AND status IN ('pending', 'paid')
    GROUP BY id_card_no
    HAVING ticket_count > 2
    ORDER BY ticket_count DESC
    LIMIT 20
  `).all(showId);

  const totalSold = tiers.reduce((sum, t) => sum + t.sold_quantity, 0);
  const totalTickets = tiers.reduce((sum, t) => sum + t.total_quantity, 0);
  const totalRevenue = orderStats
    .filter(o => o.status === 'paid')
    .reduce((sum, o) => sum + o.total_amount, 0);

  return {
    show: {
      id: show.id,
      name: show.name,
      venue: show.venue,
      startTime: show.start_time
    },
    summary: {
      totalTickets,
      soldTickets: totalSold,
      availableTickets: totalTickets - totalSold,
      sellRate: totalTickets > 0 ? `${((totalSold / totalTickets) * 100).toFixed(1)}%` : '0%',
      totalRevenue: `¥${(totalRevenue / 100).toFixed(2)}`,
      pendingAmount: `¥${(
        orderStats.filter(o => o.status === 'pending').reduce((s, o) => s + o.total_amount, 0) / 100
      ).toFixed(2)}`
    },
    tiers: tiers.map(t => ({
      id: t.id,
      name: t.name,
      price: `¥${(t.price / 100).toFixed(2)}`,
      priceCents: t.price,
      total: t.total_quantity,
      sold: t.sold_quantity,
      available: t.available_quantity,
      sellRate: t.total_quantity > 0 ? `${((t.sold_quantity / t.total_quantity) * 100).toFixed(1)}%` : '0%'
    })),
    orderStatus: orderStats.map(o => ({
      status: o.status,
      count: o.order_count,
      tickets: o.ticket_count,
      amount: `¥${(o.total_amount / 100).toFixed(2)}`
    })),
    highVolumeBuyers: {
      byAccount: byAccount.map(a => ({
        accountId: a.account_id,
        orderCount: a.order_count,
        ticketCount: a.ticket_count
      })),
      byIdCard: byIdCard.map(i => ({
        idCard: i.id_card_no,
        orderCount: i.order_count,
        ticketCount: i.ticket_count
      }))
    }
  };
}

function getSystemReport() {
  const db = getDb();

  const shows = db.prepare(`SELECT COUNT(*) as count FROM shows WHERE status = 'active'`).get().count;
  
  const tickets = db.prepare(`
    SELECT
      SUM(total_quantity) as total,
      SUM(sold_quantity) as sold,
      SUM(reserved_quantity) as reserved
    FROM ticket_tiers
  `).get();

  const orders = db.prepare(`
    SELECT
      status,
      COUNT(*) as count,
      SUM(total_amount) as amount
    FROM orders
    GROUP BY status
  `).all();

  const queue = db.prepare(`
    SELECT
      status,
      COUNT(*) as count
    FROM queue_items
    GROUP BY status
  `).all();

  const compensation = db.prepare(`
    SELECT
      status,
      COUNT(*) as count
    FROM compensation_tasks
    GROUP BY status
  `).all();

  const risks = db.prepare(`
    SELECT
      type,
      COUNT(*) as count
    FROM risk_records
    WHERE created_at >= datetime('now', '-24 hours')
    GROUP BY type
  `).all();

  const orderByHour = db.prepare(`
    SELECT
      strftime('%Y-%m-%d %H:00', created_at) as hour,
      COUNT(*) as count,
      SUM(quantity) as tickets
    FROM orders
    WHERE created_at >= datetime('now', '-24 hours')
    GROUP BY strftime('%Y-%m-%d %H:00', created_at)
    ORDER BY hour DESC
    LIMIT 24
  `).all();

  return {
    summary: {
      activeShows: shows,
      totalTickets: tickets.total || 0,
      soldTickets: tickets.sold || 0,
      sellRate: tickets.total > 0 ? `${((tickets.sold / tickets.total) * 100).toFixed(1)}%` : '0%'
    },
    orders: {
      byStatus: orders.map(o => ({
        status: o.status,
        count: o.count,
        amount: `¥${(o.amount / 100).toFixed(2)}`
      })),
      last24Hours: orderByHour.map(h => ({
        hour: h.hour,
        orderCount: h.count,
        ticketCount: h.tickets
      }))
    },
    queue: {
      byStatus: queue.map(q => ({
        status: q.status,
        count: q.count
      }))
    },
    compensation: {
      byStatus: compensation.map(c => ({
        status: c.status,
        count: c.count
      }))
    },
    risk: {
      last24Hours: risks.map(r => ({
        type: r.type,
        count: r.count
      }))
    }
  };
}

function listShows() {
  const db = getDb();
  return db.prepare(`
    SELECT 
      s.*,
      COUNT(t.id) as tier_count
    FROM shows s
    LEFT JOIN ticket_tiers t ON s.id = t.show_id
    GROUP BY s.id
    ORDER BY s.start_time DESC
  `).all();
}

module.exports = {
  getShowSalesReport,
  getSystemReport,
  listShows
};
