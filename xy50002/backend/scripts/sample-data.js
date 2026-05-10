function generateId() {
  return 'id_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

function nowISO() {
  return new Date().toISOString();
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result.toISOString();
}

function insertSampleData(db) {
  const products = [
    {
      id: generateId(),
      sku: 'SOFA-001',
      name: 'Modern L-Shaped Sectional Sofa',
      category: 'Sofa',
      price: 1299.99,
      weight: 180,
      dimensions: '220x180x85 cm',
      warranty_months: 24,
      description: 'Premium leather sectional sofa with reclining seats'
    },
    {
      id: generateId(),
      sku: 'DINE-002',
      name: 'Wooden Dining Table Set',
      category: 'Dining',
      price: 899.99,
      weight: 95,
      dimensions: '180x90x75 cm',
      warranty_months: 12,
      description: 'Solid oak dining table with 6 chairs'
    },
    {
      id: generateId(),
      sku: 'BED-003',
      name: 'King Size Storage Bed Frame',
      category: 'Bedroom',
      price: 1599.99,
      weight: 120,
      dimensions: '200x180x35 cm',
      warranty_months: 18,
      description: 'Modern bed frame with hydraulic storage'
    },
    {
      id: generateId(),
      sku: 'OFFICE-004',
      name: 'Ergonomic Office Chair',
      category: 'Office',
      price: 599.99,
      weight: 25,
      dimensions: '65x65x120 cm',
      warranty_months: 12,
      description: 'Mesh back office chair with lumbar support'
    },
    {
      id: generateId(),
      sku: 'CAB-005',
      name: 'Nordic Style Bookshelf',
      category: 'Storage',
      price: 449.99,
      weight: 45,
      dimensions: '180x80x30 cm',
      warranty_months: 12,
      description: '5-tier wooden bookshelf with adjustable shelves'
    }
  ];

  const spareParts = [
    {
      id: generateId(),
      sku: 'HW-SCREW-001',
      name: 'M6 Hex Screws (Pack of 20)',
      product_sku: 'SOFA-001',
      stock: 500,
      reserved: 15,
      price: 12.99,
      notes: 'Standard sofa assembly screws'
    },
    {
      id: generateId(),
      sku: 'HW-BOLT-002',
      name: 'M8 Hex Bolts (Pack of 10)',
      product_sku: 'BED-003',
      stock: 300,
      reserved: 0,
      price: 15.99,
      notes: 'Bed frame bolts'
    },
    {
      id: generateId(),
      sku: 'HW-LEG-003',
      name: 'Sofa Leg Replacement',
      product_sku: 'SOFA-001',
      stock: 50,
      reserved: 5,
      price: 39.99,
      notes: 'Wooden sofa leg, 15cm height'
    },
    {
      id: generateId(),
      sku: 'HW-WHEEL-004',
      name: 'Office Chair Casters (Set of 5)',
      product_sku: 'OFFICE-004',
      stock: 200,
      reserved: 0,
      price: 24.99,
      notes: 'Heavy duty casters'
    },
    {
      id: generateId(),
      sku: 'HW-KEY-005',
      name: 'Allen Key Set',
      product_sku: null,
      stock: 1000,
      reserved: 0,
      price: 8.99,
      notes: 'Universal allen wrench set'
    }
  ];

  const orders = [
    {
      id: 'ORD-2024-0001',
      customer_name: 'John Smith',
      customer_email: 'john.smith@example.com',
      customer_phone: '+1-555-123-4567',
      order_date: addDays(nowISO(), -30),
      total_amount: 1299.99,
      shipping_address: '123 Main Street, New York, NY 10001, USA',
      status: 'delivered',
      notes: 'Customer mentioned front door delivery only',
      created_at: addDays(nowISO(), -30),
      updated_at: addDays(nowISO(), -5)
    },
    {
      id: 'ORD-2024-0002',
      customer_name: 'Emma Johnson',
      customer_email: 'emma.j@example.com',
      customer_phone: '+44-20-7123-4567',
      order_date: addDays(nowISO(), -15),
      total_amount: 899.99,
      shipping_address: '45 King Street, London SW1Y 6QT, UK',
      status: 'delivered',
      notes: 'International shipping - UK',
      created_at: addDays(nowISO(), -15),
      updated_at: addDays(nowISO(), -3)
    },
    {
      id: 'ORD-2024-0003',
      customer_name: 'Michael Brown',
      customer_email: 'm.brown@example.de',
      customer_phone: '+49-30-12345678',
      order_date: addDays(nowISO(), -7),
      total_amount: 1599.99,
      shipping_address: 'Friedrichstraße 100, 10117 Berlin, Germany',
      status: 'delivered',
      notes: 'EU shipping - required customs documentation',
      created_at: addDays(nowISO(), -7),
      updated_at: addDays(nowISO(), -1)
    },
    {
      id: 'ORD-2024-0004',
      customer_name: 'Sarah Davis',
      customer_email: 'sarah.d@example.com',
      customer_phone: '+1-555-987-6543',
      order_date: addDays(nowISO(), -45),
      total_amount: 599.99,
      shipping_address: '789 Oak Avenue, Los Angeles, CA 90001, USA',
      status: 'delivered',
      notes: '',
      created_at: addDays(nowISO(), -45),
      updated_at: addDays(nowISO(), -10)
    }
  ];

  const orderItems = [
    { id: generateId(), order_id: 'ORD-2024-0001', product_id: products[0].id, quantity: 1, price: 1299.99 },
    { id: generateId(), order_id: 'ORD-2024-0002', product_id: products[1].id, quantity: 1, price: 899.99 },
    { id: generateId(), order_id: 'ORD-2024-0003', product_id: products[2].id, quantity: 1, price: 1599.99 },
    { id: generateId(), order_id: 'ORD-2024-0004', product_id: products[3].id, quantity: 1, price: 599.99 }
  ];

  const packages = [
    {
      id: 'PKG-001',
      order_id: 'ORD-2024-0001',
      tracking_number: 'UPS1Z999AA10123456784',
      carrier: 'UPS',
      package_status: 'delivered',
      shipped_date: addDays(nowISO(), -28),
      delivered_date: addDays(nowISO(), -25),
      weight: 180,
      dimensions: '220x180x85 cm',
      notes: '2 packages total'
    },
    {
      id: 'PKG-002',
      order_id: 'ORD-2024-0002',
      tracking_number: 'DHL8456789012',
      carrier: 'DHL',
      package_status: 'delivered',
      shipped_date: addDays(nowISO(), -13),
      delivered_date: addDays(nowISO(), -10),
      weight: 95,
      dimensions: '180x90x75 cm',
      notes: 'International express'
    },
    {
      id: 'PKG-003',
      order_id: 'ORD-2024-0003',
      tracking_number: 'FEDEX987654321',
      carrier: 'FedEx',
      package_status: 'delivered',
      shipped_date: addDays(nowISO(), -5),
      delivered_date: addDays(nowISO(), -2),
      weight: 120,
      dimensions: '200x180x35 cm',
      notes: 'Heavy freight'
    },
    {
      id: 'PKG-004',
      order_id: 'ORD-2024-0004',
      tracking_number: 'USPS1234567890',
      carrier: 'USPS',
      package_status: 'delivered',
      shipped_date: addDays(nowISO(), -40),
      delivered_date: addDays(nowISO(), -35),
      weight: 25,
      dimensions: '65x65x120 cm',
      notes: ''
    }
  ];

  const logistics = [
    { id: generateId(), package_id: 'PKG-001', status: 'shipped', location: 'Chicago, IL', description: 'Package picked up', timestamp: addDays(nowISO(), -28) },
    { id: generateId(), package_id: 'PKG-001', status: 'in_transit', location: 'Detroit, MI', description: 'In transit to destination', timestamp: addDays(nowISO(), -27) },
    { id: generateId(), package_id: 'PKG-001', status: 'out_for_delivery', location: 'New York, NY', description: 'Out for delivery', timestamp: addDays(nowISO(), -25) },
    { id: generateId(), package_id: 'PKG-001', status: 'delivered', location: 'New York, NY', description: 'Delivered - left at front door', timestamp: addDays(nowISO(), -25) },
    
    { id: generateId(), package_id: 'PKG-002', status: 'shipped', location: 'Los Angeles, CA', description: 'Package picked up', timestamp: addDays(nowISO(), -13) },
    { id: generateId(), package_id: 'PKG-002', status: 'export', location: 'Los Angeles, CA', description: 'Export scanned', timestamp: addDays(nowISO(), -12) },
    { id: generateId(), package_id: 'PKG-002', status: 'in_transit', location: 'London Heathrow', description: 'Arrived in destination country', timestamp: addDays(nowISO(), -11) },
    { id: generateId(), package_id: 'PKG-002', status: 'customs', location: 'London', description: 'Customs clearance completed', timestamp: addDays(nowISO(), -10) },
    { id: generateId(), package_id: 'PKG-002', status: 'delivered', location: 'London', description: 'Delivered', timestamp: addDays(nowISO(), -10) },
    
    { id: generateId(), package_id: 'PKG-003', status: 'shipped', location: 'Dallas, TX', description: 'Package picked up', timestamp: addDays(nowISO(), -5) },
    { id: generateId(), package_id: 'PKG-003', status: 'export', location: 'Memphis, TN', description: 'International shipment', timestamp: addDays(nowISO(), -4) },
    { id: generateId(), package_id: 'PKG-003', status: 'in_transit', location: 'Frankfurt', description: 'Arrived in Germany', timestamp: addDays(nowISO(), -3) },
    { id: generateId(), package_id: 'PKG-003', status: 'delivered', location: 'Berlin', description: 'Delivered and signed for', timestamp: addDays(nowISO(), -2) },
    
    { id: generateId(), package_id: 'PKG-004', status: 'shipped', location: 'New York, NY', description: 'Package picked up', timestamp: addDays(nowISO(), -40) },
    { id: generateId(), package_id: 'PKG-004', status: 'in_transit', location: 'Philadelphia, PA', description: 'In transit', timestamp: addDays(nowISO(), -38) },
    { id: generateId(), package_id: 'PKG-004', status: 'delivered', location: 'Los Angeles, CA', description: 'Delivered to mailbox', timestamp: addDays(nowISO(), -35) }
  ];

  const customerMessages = [
    {
      id: generateId(),
      order_id: 'ORD-2024-0001',
      message_type: 'customer',
      content: 'Hi, I received my sofa today but it seems like there is a 5cm gap between the seat cushions. Also, the left armrest has some scratches on it. Can you please help?',
      author: 'John Smith',
      attachment_url: '/sample-evidence/sofa-scratch.jpg',
      is_evidence: 1,
      created_at: addDays(nowISO(), -5)
    },
    {
      id: generateId(),
      order_id: 'ORD-2024-0001',
      message_type: 'agent',
      content: 'Hi John, thank you for reaching out and for providing the photos. I apologize for the inconvenience. Let me review this and get back to you within 24 hours.',
      author: 'Agent Sarah',
      attachment_url: null,
      is_evidence: 0,
      created_at: addDays(nowISO(), -5)
    },
    {
      id: generateId(),
      order_id: 'ORD-2024-001',
      message_type: 'customer',
      content: 'Additional photo showing the gap more clearly:',
      author: 'John Smith',
      attachment_url: '/sample-evidence/sofa-gap.jpg',
      is_evidence: 1,
      created_at: addDays(nowISO(), -4)
    },
    {
      id: generateId(),
      order_id: 'ORD-2024-0002',
      message_type: 'customer',
      content: 'Hello! I received my dining table but unfortunately 3 legs were broken during shipping. The box had clear signs of rough handling. The return shipping to China from the UK would be very expensive. What are my options?',
      author: 'Emma Johnson',
      attachment_url: '/sample-evidence/broken-legs.jpg',
      is_evidence: 1,
      created_at: addDays(nowISO(), -3)
    },
    {
      id: generateId(),
      order_id: 'ORD-2024-0002',
      message_type: 'agent',
      content: 'Dear Emma, I am very sorry to hear about the broken legs. International returns can be costly. I would like to offer you a 40% refund or we can send replacement legs. Which would you prefer?',
      author: 'Agent Mike',
      attachment_url: null,
      is_evidence: 0,
      created_at: addDays(nowISO(), -2)
    },
    {
      id: generateId(),
      order_id: 'ORD-2024-0003',
      message_type: 'customer',
      content: 'Hallo, I received my bed frame but there are no screws in the package. The box was sealed but the hardware bag is missing. I cannot assemble the bed without it.',
      author: 'Michael Brown',
      attachment_url: '/sample-evidence/empty-box.jpg',
      is_evidence: 1,
      created_at: addDays(nowISO(), -1)
    },
    {
      id: generateId(),
      order_id: 'ORD-2024-0004',
      message_type: 'customer',
      content: 'The office chair I ordered has a broken wheel. It arrived 10 days ago. The warranty should cover this, right? Can I get replacement wheels?',
      author: 'Sarah Davis',
      attachment_url: '/sample-evidence/broken-wheel.jpg',
      is_evidence: 1,
      created_at: addDays(nowISO(), -8)
    }
  ];

  const supportTickets = [
    {
      id: 'TKT-001',
      order_id: 'ORD-2024-0001',
      ticket_type: 'damage',
      priority: 'high',
      title: 'Sofa scratches and cushion gap',
      description: 'Customer reports minor scratches on left armrest and 5cm gap between seat cushions',
      status: 'in_progress',
      assigned_to: 'Agent Sarah',
      sla_deadline: addDays(nowISO(), 1),
      risk_level: 'medium',
      risk_reason: 'Multiple issues reported, high value order',
      resolution: null,
      created_at: addDays(nowISO(), -5),
      updated_at: addDays(nowISO(), -4)
    },
    {
      id: 'TKT-002',
      order_id: 'ORD-2024-0002',
      ticket_type: 'damage',
      priority: 'critical',
      title: 'Broken table legs - international shipping',
      description: '3 legs broken during transit, UK customer concerned about return shipping costs',
      status: 'waiting_customer',
      assigned_to: 'Agent Mike',
      sla_deadline: addDays(nowISO(), 0),
      risk_level: 'high',
      risk_reason: 'Multiple broken parts, international shipping dispute, potential chargeback',
      resolution: null,
      created_at: addDays(nowISO(), -3),
      updated_at: addDays(nowISO(), -2)
    },
    {
      id: 'TKT-003',
      order_id: 'ORD-2024-0003',
      ticket_type: 'missing_parts',
      priority: 'high',
      title: 'Missing hardware - no screws included',
      description: 'Customer received bed frame but hardware bag is completely missing',
      status: 'open',
      assigned_to: null,
      sla_deadline: addDays(nowISO(), 2),
      risk_level: 'medium',
      risk_reason: 'Missing essential parts for assembly',
      resolution: null,
      created_at: addDays(nowISO(), -1),
      updated_at: addDays(nowISO(), -1)
    },
    {
      id: 'TKT-004',
      order_id: 'ORD-2024-0004',
      ticket_type: 'warranty',
      priority: 'medium',
      title: 'Broken chair wheel under warranty',
      description: 'One wheel broken on office chair, within 12 month warranty period',
      status: 'resolved',
      assigned_to: 'Agent Lisa',
      sla_deadline: addDays(nowISO(), -5),
      risk_level: 'low',
      risk_reason: null,
      resolution: 'Replacement wheels sent via express shipping on 2024-01-15. Tracking: DHL87654321',
      created_at: addDays(nowISO(), -8),
      updated_at: addDays(nowISO(), -6)
    }
  ];

  const ticketActions = [
    { id: generateId(), ticket_id: 'TKT-001', action_type: 'review', description: 'Reviewed customer photos, confirmed cosmetic damage', author: 'Agent Sarah', attachment_url: null, created_at: addDays(nowISO(), -5) },
    { id: generateId(), ticket_id: 'TKT-001', action_type: 'email', description: 'Sent email requesting additional photos of the gap issue', author: 'Agent Sarah', attachment_url: null, created_at: addDays(nowISO(), -5) },
    { id: generateId(), ticket_id: 'TKT-002', action_type: 'review', description: 'Verified damage from photos, 3 legs broken', author: 'Agent Mike', attachment_url: null, created_at: addDays(nowISO(), -3) },
    { id: generateId(), ticket_id: 'TKT-002', action_type: 'proposal', description: 'Offered customer 40% refund or replacement legs', author: 'Agent Mike', attachment_url: null, created_at: addDays(nowISO(), -2) },
    { id: generateId(), ticket_id: 'TKT-003', action_type: 'stock_check', description: 'Confirmed spare parts available: HW-BOLT-002 and HW-KEY-005', author: 'Agent Lisa', attachment_url: null, created_at: addDays(nowISO(), -1) },
    { id: generateId(), ticket_id: 'TKT-004', action_type: 'resolution', description: 'Processed replacement wheels shipment', author: 'Agent Lisa', attachment_url: null, created_at: addDays(nowISO(), -6) }
  ];

  const ticketNotes = [
    { id: generateId(), ticket_id: 'TKT-001', content: 'Sofa value: $1299.99. Warranty: 24 months. Gap is a manufacturing tolerance issue. Scratches are shipping damage. Consider partial refund of $150 or repair service.', author: 'Agent Sarah', is_internal: 1, created_at: addDays(nowISO(), -5) },
    { id: generateId(), ticket_id: 'TKT-002', content: 'UK customer. Return shipping to China estimated: $250. Product value: $899.99. Better to offer partial refund. Check if spare legs available in EU warehouse.', author: 'Agent Mike', is_internal: 1, created_at: addDays(nowISO(), -3) },
    { id: generateId(), ticket_id: 'TKT-004', content: 'Customer happy with resolution. No further action needed. Closing ticket.', author: 'Agent Lisa', is_internal: 1, created_at: addDays(nowISO(), -6) }
  ];

  const returns = [
    {
      id: generateId(),
      ticket_id: 'TKT-002',
      return_type: 'partial_refund',
      reason: 'Broken parts during shipping',
      status: 'pending',
      shipping_cost: 0,
      shipping_cost_responsibility: null,
      refund_amount: 359.99,
      notes: '40% partial refund offered',
      created_at: addDays(nowISO(), -2)
    }
  ];

  const replacements = [
    {
      id: generateId(),
      ticket_id: 'TKT-004',
      replacement_type: 'spare_part',
      item_sku: 'HW-WHEEL-004',
      item_name: 'Office Chair Casters (Set of 5)',
      quantity: 1,
      status: 'shipped',
      tracking_number: 'DHL87654321',
      notes: 'Express shipping to US',
      created_at: addDays(nowISO(), -6)
    }
  ];

  const insertProduct = db.prepare(`
    INSERT INTO products (id, sku, name, category, price, weight, dimensions, warranty_months, description)
    VALUES (@id, @sku, @name, @category, @price, @weight, @dimensions, @warranty_months, @description)
  `);
  products.forEach(p => insertProduct.run(p));

  const insertSparePart = db.prepare(`
    INSERT INTO spare_parts (id, sku, name, product_sku, stock, reserved, price, notes)
    VALUES (@id, @sku, @name, @product_sku, @stock, @reserved, @price, @notes)
  `);
  spareParts.forEach(p => insertSparePart.run(p));

  const insertOrder = db.prepare(`
    INSERT INTO orders (id, customer_name, customer_email, customer_phone, order_date, total_amount, shipping_address, status, notes, created_at, updated_at)
    VALUES (@id, @customer_name, @customer_email, @customer_phone, @order_date, @total_amount, @shipping_address, @status, @notes, @created_at, @updated_at)
  `);
  orders.forEach(o => insertOrder.run(o));

  const insertOrderItem = db.prepare(`
    INSERT INTO order_items (id, order_id, product_id, quantity, price)
    VALUES (@id, @order_id, @product_id, @quantity, @price)
  `);
  orderItems.forEach(i => insertOrderItem.run(i));

  const insertPackage = db.prepare(`
    INSERT INTO packages (id, order_id, tracking_number, carrier, package_status, shipped_date, delivered_date, weight, dimensions, notes)
    VALUES (@id, @order_id, @tracking_number, @carrier, @package_status, @shipped_date, @delivered_date, @weight, @dimensions, @notes)
  `);
  packages.forEach(p => insertPackage.run(p));

  const insertLogistics = db.prepare(`
    INSERT INTO logistics (id, package_id, status, location, description, timestamp)
    VALUES (@id, @package_id, @status, @location, @description, @timestamp)
  `);
  logistics.forEach(l => insertLogistics.run(l));

  const insertMessage = db.prepare(`
    INSERT INTO customer_messages (id, order_id, message_type, content, author, attachment_url, is_evidence, created_at)
    VALUES (@id, @order_id, @message_type, @content, @author, @attachment_url, @is_evidence, @created_at)
  `);
  customerMessages.forEach(m => insertMessage.run(m));

  const insertTicket = db.prepare(`
    INSERT INTO support_tickets (id, order_id, ticket_type, priority, title, description, status, assigned_to, sla_deadline, risk_level, risk_reason, resolution, created_at, updated_at)
    VALUES (@id, @order_id, @ticket_type, @priority, @title, @description, @status, @assigned_to, @sla_deadline, @risk_level, @risk_reason, @resolution, @created_at, @updated_at)
  `);
  supportTickets.forEach(t => insertTicket.run(t));

  const insertAction = db.prepare(`
    INSERT INTO ticket_actions (id, ticket_id, action_type, description, author, attachment_url, created_at)
    VALUES (@id, @ticket_id, @action_type, @description, @author, @attachment_url, @created_at)
  `);
  ticketActions.forEach(a => insertAction.run(a));

  const insertNote = db.prepare(`
    INSERT INTO ticket_notes (id, ticket_id, content, author, is_internal, created_at)
    VALUES (@id, @ticket_id, @content, @author, @is_internal, @created_at)
  `);
  ticketNotes.forEach(n => insertNote.run(n));

  const insertReturn = db.prepare(`
    INSERT INTO returns (id, ticket_id, return_type, reason, status, shipping_cost, shipping_cost_responsibility, refund_amount, notes, created_at)
    VALUES (@id, @ticket_id, @return_type, @reason, @status, @shipping_cost, @shipping_cost_responsibility, @refund_amount, @notes, @created_at)
  `);
  returns.forEach(r => insertReturn.run(r));

  const insertReplacement = db.prepare(`
    INSERT INTO replacements (id, ticket_id, replacement_type, item_sku, item_name, quantity, status, tracking_number, notes, created_at)
    VALUES (@id, @ticket_id, @replacement_type, @item_sku, @item_name, @quantity, @status, @tracking_number, @notes, @created_at)
  `);
  replacements.forEach(r => insertReplacement.run(r));
}

module.exports = { insertSampleData };
