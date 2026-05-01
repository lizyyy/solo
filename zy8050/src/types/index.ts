export interface Product {
  sku: string;
  name: string;
  price: string;
  original_price?: string;
  tags: string[];
  template_id: string;
  device_profile: string;
}

export interface Locale {
  name: string;
  translations: Record<string, string>;
}

export interface Locales {
  [locale: string]: Locale;
}

export interface FontCoverage {
  default_font: {
    name: string;
    supported_chars: string;
  };
}

export interface DeviceProfile {
  width: number;
  height: number;
  color_mode: string;
  supported_templates: string[];
  max_pixel_width: number;
  char_width: number;
}

export interface DeviceProfiles {
  [profile: string]: DeviceProfile;
}

export interface Issue {
  sku: string;
  severity: 'error' | 'warning';
  category: 'duplicate_sku' | 'missing_locale' | 'missing_chars' | 'invalid_price' | 'pixel_overflow' | 'template_mismatch' | 'color_mode_unsupported';
  message: string;
  locale?: string;
  details?: string;
}

export interface SubsetFontManifest {
  sku: string;
  required_chars: string;
  locales: string[];
}

export interface ValidationResult {
  products: Product[];
  issues: Issue[];
  subsetManifest: SubsetFontManifest[];
}

export interface MergedProduct {
  product: Product;
  locales: {
    [locale: string]: {
      name: string;
      tags: string[];
    };
  };
}
