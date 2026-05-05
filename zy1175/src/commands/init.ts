import { Command } from 'commander';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import { AppContext } from '../types';

export function initCommand(program: Command, context: AppContext) {
  program
    .command('init')
    .description('Initialize a new tracking analyzer project with sample data')
    .option('-d, --directory <path>', 'Directory to initialize', process.cwd())
    .option('--force', 'Force initialization even if directory is not empty')
    .action((options) => {
      const targetDir = options.directory;
      
      console.log(chalk.blue(`Initializing tracking analyzer project in: ${targetDir}`));
      
      // Check if directory exists
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
        console.log(chalk.green(`Created directory: ${targetDir}`));
      } else {
        const files = fs.readdirSync(targetDir);
        if (files.length > 0 && !options.force) {
          console.error(chalk.red(`Directory is not empty: ${targetDir}`));
          console.log(chalk.yellow('Use --force to overwrite existing files.'));
          process.exit(1);
        }
      }
      
      // Create sample data files
      createSampleTrackingSchema(targetDir);
      createSampleEvents(targetDir);
      createSampleRoutes(targetDir);
      createSampleReleaseChanges(targetDir);
      createSampleWarehouseData(targetDir);
      
      // Create bad examples for testing
      createBadExamples(targetDir);
      
      console.log(chalk.green('\nInitialization complete!'));
      console.log(chalk.yellow('\nNext steps:'));
      console.log(chalk.yellow('  1. Review the sample data files'));
      console.log(chalk.yellow('  2. Run "tracking-analyzer import" to load the data'));
      console.log(chalk.yellow('  3. Run "tracking-analyzer check" to validate the data'));
      console.log(chalk.yellow('  4. Run "tracking-analyzer funnel" to analyze funnel conversion'));
      console.log(chalk.yellow('  5. Run "tracking-analyzer diff" to compare with warehouse data'));
      console.log(chalk.yellow('  6. Run "tracking-analyzer export" to generate reports'));
    });
}

function createSampleTrackingSchema(dir: string) {
  const schemaPath = path.join(dir, 'tracking-schema.yaml');
  const schema = `version: "1.0.0"
commonFields:
  - name: event_id
    type: string
    required: true
    description: "Unique identifier for each event"
  - name: event_name
    type: string
    required: true
    description: "Name of the event"
  - name: timestamp
    type: string
    required: true
    description: "ISO 8601 timestamp of the event"
  - name: user_id
    type: string
    required: true
    description: "Unique identifier for the user"
  - name: session_id
    type: string
    required: true
    description: "Unique identifier for the session"
  - name: app_version
    type: string
    required: true
    description: "Version of the application"

events:
  - name: page_view
    description: "User viewed a page"
    version: "1.0.0"
    required:
      - page_name
      - page_path
    fields:
      - name: page_name
        type: string
        description: "Name of the page"
      - name: page_path
        type: string
        description: "Path of the page"
      - name: referrer
        type: string
        description: "Referrer URL"

  - name: product_view
    description: "User viewed a product"
    version: "1.0.0"
    required:
      - product_id
      - product_name
    fields:
      - name: product_id
        type: string
        description: "Unique identifier for the product"
      - name: product_name
        type: string
        description: "Name of the product"
      - name: product_category
        type: string
        description: "Category of the product"
      - name: price
        type: number
        description: "Price of the product"

  - name: add_to_cart
    description: "User added an item to cart"
    version: "1.0.0"
    required:
      - product_id
      - quantity
    fields:
      - name: product_id
        type: string
        description: "Unique identifier for the product"
      - name: quantity
        type: number
        description: "Quantity added to cart"
      - name: price
        type: number
        description: "Price per unit"

  - name: checkout_start
    description: "User started the checkout process"
    version: "1.0.0"
    required:
      - cart_total
    fields:
      - name: cart_total
        type: number
        description: "Total amount in the cart"
      - name: item_count
        type: number
        description: "Number of items in cart"
      - name: payment_method
        type: string
        description: "Selected payment method"
        enum:
          - credit_card
          - paypal
          - apple_pay
          - google_pay

  - name: purchase_complete
    description: "User completed a purchase"
    version: "1.0.0"
    required:
      - order_id
      - total_amount
    fields:
      - name: order_id
        type: string
        description: "Unique identifier for the order"
      - name: total_amount
        type: number
        description: "Total amount of the order"
      - name: currency
        type: string
        description: "Currency code"
        enum:
          - USD
          - EUR
          - GBP
          - CNY
      - name: payment_method
        type: string
        description: "Payment method used"
        enum:
          - credit_card
          - paypal
          - apple_pay
          - google_pay
`;

  fs.writeFileSync(schemaPath, schema);
  console.log(chalk.green(`Created: ${schemaPath}`));
}

function createSampleEvents(dir: string) {
  const eventsPath = path.join(dir, 'events.jsonl');
  const events = [
    {
      event_id: 'evt_001',
      event_name: 'page_view',
      timestamp: '2026-05-01T10:00:00Z',
      user_id: 'user_123',
      session_id: 'sess_001',
      app_version: '2.1.0',
      properties: {
        page_name: 'home',
        page_path: '/',
        referrer: 'https://google.com'
      }
    },
    {
      event_id: 'evt_002',
      event_name: 'product_view',
      timestamp: '2026-05-01T10:05:00Z',
      user_id: 'user_123',
      session_id: 'sess_001',
      app_version: '2.1.0',
      properties: {
        product_id: 'prod_456',
        product_name: 'Wireless Headphones',
        product_category: 'Electronics',
        price: 99.99
      }
    },
    {
      event_id: 'evt_003',
      event_name: 'add_to_cart',
      timestamp: '2026-05-01T10:10:00Z',
      user_id: 'user_123',
      session_id: 'sess_001',
      app_version: '2.1.0',
      properties: {
        product_id: 'prod_456',
        quantity: 1,
        price: 99.99
      }
    },
    {
      event_id: 'evt_004',
      event_name: 'checkout_start',
      timestamp: '2026-05-01T10:15:00Z',
      user_id: 'user_123',
      session_id: 'sess_001',
      app_version: '2.1.0',
      properties: {
        cart_total: 99.99,
        item_count: 1,
        payment_method: 'credit_card'
      }
    },
    {
      event_id: 'evt_005',
      event_name: 'purchase_complete',
      timestamp: '2026-05-01T10:20:00Z',
      user_id: 'user_123',
      session_id: 'sess_001',
      app_version: '2.1.0',
      properties: {
        order_id: 'ord_789',
        total_amount: 99.99,
        currency: 'USD',
        payment_method: 'credit_card'
      }
    },
    {
      event_id: 'evt_006',
      event_name: 'page_view',
      timestamp: '2026-05-01T11:00:00Z',
      user_id: 'user_456',
      session_id: 'sess_002',
      app_version: '2.1.0',
      properties: {
        page_name: 'home',
        page_path: '/',
        referrer: 'https://facebook.com'
      }
    },
    {
      event_id: 'evt_007',
      event_name: 'product_view',
      timestamp: '2026-05-01T11:05:00Z',
      user_id: 'user_456',
      session_id: 'sess_002',
      app_version: '2.1.0',
      properties: {
        product_id: 'prod_789',
        product_name: 'Smart Watch',
        product_category: 'Electronics',
        price: 299.99
      }
    },
    {
      event_id: 'evt_008',
      event_name: 'add_to_cart',
      timestamp: '2026-05-01T11:10:00Z',
      user_id: 'user_456',
      session_id: 'sess_002',
      app_version: '2.1.0',
      properties: {
        product_id: 'prod_789',
        quantity: 1,
        price: 299.99
      }
    },
    {
      event_id: 'evt_009',
      event_name: 'checkout_start',
      timestamp: '2026-05-01T11:15:00Z',
      user_id: 'user_456',
      session_id: 'sess_002',
      app_version: '2.1.0',
      properties: {
        cart_total: 299.99,
        item_count: 1,
        payment_method: 'paypal'
      }
    }
  ];

  const jsonlContent = events.map(e => JSON.stringify(e)).join('\n');
  fs.writeFileSync(eventsPath, jsonlContent);
  console.log(chalk.green(`Created: ${eventsPath}`));
}

function createSampleRoutes(dir: string) {
  const routesPath = path.join(dir, 'routes.csv');
  const routes = `path,page_name,expected_events
/,home,"page_view,product_view,add_to_cart"
/products,products,"page_view,product_view"
/cart,cart,"page_view,checkout_start"
/checkout,checkout,"page_view,checkout_start,purchase_complete"
/order-confirmation,order_confirmation,"page_view,purchase_complete"
`;

  fs.writeFileSync(routesPath, routes);
  console.log(chalk.green(`Created: ${routesPath}`));
}

function createSampleReleaseChanges(dir: string) {
  const releasePath = path.join(dir, 'release-changes.md');
  const releaseContent = `# Release Changes

## Version 2.1.0 (2026-04-01)

### Changes
- **Modified**: \`checkout_start\` event - Added \`payment_method\` field with enum values
- **Added**: \`purchase_complete\` event - New event for completed purchases
- **Removed**: \`checkout_complete\` event - Renamed to \`purchase_complete\`

## Version 2.0.0 (2026-01-01)

### Changes
- **Added**: \`product_view\` event - New event for product page views
- **Modified**: \`add_to_cart\` event - Added \`price\` field
- **Renamed**: \`page_load\` → \`page_view\`
`;

  fs.writeFileSync(releasePath, releaseContent);
  console.log(chalk.green(`Created: ${releasePath}`));
}

function createSampleWarehouseData(dir: string) {
  const warehousePath = path.join(dir, 'warehouse-sample.csv');
  const warehouse = `event_id,event_name,timestamp,user_id,session_id,app_version
evt_001,page_view,2026-05-01T10:00:00Z,user_123,sess_001,2.1.0
evt_002,product_view,2026-05-01T10:05:00Z,user_123,sess_001,2.1.0
evt_003,add_to_cart,2026-05-01T10:10:00Z,user_123,sess_001,2.1.0
evt_004,checkout_start,2026-05-01T10:15:00Z,user_123,sess_001,2.1.0
evt_005,purchase_complete,2026-05-01T10:20:00Z,user_123,sess_001,2.1.0
evt_006,page_view,2026-05-01T11:00:00Z,user_456,sess_002,2.1.0
evt_007,product_view,2026-05-01T11:05:00Z,user_456,sess_002,2.1.0
evt_008,add_to_cart,2026-05-01T11:10:00Z,user_456,sess_002,2.1.0
evt_010,extra_event,2026-05-01T12:00:00Z,user_789,sess_003,2.1.0
`;

  fs.writeFileSync(warehousePath, warehouse);
  console.log(chalk.green(`Created: ${warehousePath}`));
}

function createBadExamples(dir: string) {
  const badDir = path.join(dir, 'bad-examples');
  if (!fs.existsSync(badDir)) {
    fs.mkdirSync(badDir, { recursive: true });
  }

  // Bad events with various issues
  const badEventsPath = path.join(badDir, 'bad-events.jsonl');
  const badEvents = [
    {
      event_id: 'evt_duplicate',
      event_name: 'page_view',
      timestamp: '2026-05-01T10:00:00Z',
      user_id: 'user_123',
      session_id: 'sess_001',
      app_version: '2.1.0',
      properties: {
        page_name: 'home',
        page_path: '/'
      }
    },
    {
      event_id: 'evt_duplicate',
      event_name: 'page_view',
      timestamp: '2026-05-01T10:00:00Z',
      user_id: 'user_123',
      session_id: 'sess_001',
      app_version: '2.1.0',
      properties: {
        page_name: 'home',
        page_path: '/'
      }
    },
    {
      event_name: 'missing_event_id',
      timestamp: '2026-05-01T10:00:00Z',
      user_id: 'user_123',
      session_id: 'sess_001',
      app_version: '2.1.0',
      properties: {
        page_name: 'home',
        page_path: '/'
      }
    },
    {
      event_id: 'evt_missing_required',
      event_name: 'product_view',
      timestamp: '2026-05-01T10:00:00Z',
      user_id: 'user_123',
      session_id: 'sess_001',
      app_version: '2.1.0',
      properties: {
        product_id: 'prod_456'
      }
    },
    {
      event_id: 'evt_wrong_type',
      event_name: 'add_to_cart',
      timestamp: '2026-05-01T10:00:00Z',
      user_id: 'user_123',
      session_id: 'sess_001',
      app_version: '2.1.0',
      properties: {
        product_id: 'prod_456',
        quantity: '1'
      }
    },
    {
      event_id: 'evt_wrong_enum',
      event_name: 'checkout_start',
      timestamp: '2026-05-01T10:00:00Z',
      user_id: 'user_123',
      session_id: 'sess_001',
      app_version: '2.1.0',
      properties: {
        cart_total: 99.99,
        payment_method: 'bitcoin'
      }
    },
    {
      event_id: 'evt_old_event',
      event_name: 'page_load',
      timestamp: '2026-05-01T10:00:00Z',
      user_id: 'user_123',
      session_id: 'sess_001',
      app_version: '2.1.0',
      properties: {
        page_name: 'home',
        page_path: '/'
      }
    },
    {
      event_id: 'evt_unknown_event',
      event_name: 'custom_event_not_defined',
      timestamp: '2026-05-01T10:00:00Z',
      user_id: 'user_123',
      session_id: 'sess_001',
      app_version: '2.1.0',
      properties: {
        custom_field: 'value'
      }
    }
  ];

  const badJsonl = badEvents.map(e => JSON.stringify(e)).join('\n');
  fs.writeFileSync(badEventsPath, badJsonl);
  console.log(chalk.yellow(`Created bad examples: ${badEventsPath}`));
}
