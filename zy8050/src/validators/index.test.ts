import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import { checkDuplicateSkus, checkPriceFormat, checkTemplateMatch } from './index';
import { Product, DeviceProfiles } from '../types';

describe('validators', () => {
  describe('checkDuplicateSkus', () => {
    it('should detect duplicate SKUs', () => {
      const products: Product[] = [
        { sku: 'SKU001', name: 'Test', price: '¥10', tags: [], template_id: 't1', device_profile: 'd1' },
        { sku: 'SKU001', name: 'Test 2', price: '¥20', tags: [], template_id: 't1', device_profile: 'd1' },
        { sku: 'SKU002', name: 'Test 3', price: '¥30', tags: [], template_id: 't1', device_profile: 'd1' }
      ];
      
      const issues = checkDuplicateSkus(products);
      
      assert.strictEqual(issues.length, 1);
      assert.strictEqual(issues[0].sku, 'SKU001');
      assert.strictEqual(issues[0].category, 'duplicate_sku');
    });
  });

  describe('checkPriceFormat', () => {
    it('should detect invalid price formats', () => {
      const products: Product[] = [
        { sku: 'SKU001', name: 'Test', price: 'invalid', tags: [], template_id: 't1', device_profile: 'd1' },
        { sku: 'SKU002', name: 'Test', price: '¥19.9', tags: [], template_id: 't1', device_profile: 'd1' }
      ];
      
      const issues = checkPriceFormat(products);
      
      assert.strictEqual(issues.length, 1);
      assert.strictEqual(issues[0].category, 'invalid_price');
    });
  });

  describe('checkTemplateMatch', () => {
    it('should detect template mismatches', () => {
      const products: Product[] = [
        { sku: 'SKU001', name: 'Test', price: '¥10', tags: [], template_id: 'template_unknown', device_profile: 'device_2.13' }
      ];
      
      const deviceProfiles: DeviceProfiles = {
        'device_2.13': {
          width: 250,
          height: 122,
          color_mode: 'black_red',
          supported_templates: ['template_square'],
          max_pixel_width: 240,
          char_width: 12
        }
      };
      
      const issues = checkTemplateMatch(products, deviceProfiles);
      
      assert.strictEqual(issues.length, 1);
      assert.strictEqual(issues[0].category, 'template_mismatch');
    });
  });
});
