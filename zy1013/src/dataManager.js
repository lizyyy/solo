const fs = require('fs-extra');
const path = require('path');

class DataManager {
  static async loadProject(filePath) {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content);
  }

  static async saveProject(filePath, data) {
    await fs.ensureDir(path.dirname(filePath));
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
  }

  static createEmptyProject() {
    return {
      version: '1.0',
      created: Date.now(),
      updated: Date.now(),
      folderPath: null,
      photos: [],
      products: [],
      duplicates: [],
      issues: []
    };
  }

  static createProduct(id) {
    return {
      id: id,
      title: '',
      price: null,
      condition: '',
      defectDescription: '',
      status: 'draft',
      photoIds: [],
      mainPhotoId: null,
      notes: '',
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
  }

  static generateProductId() {
    return 'prod_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
  }

  static validateProject(data) {
    const issues = [];

    const ungroupedPhotos = data.photos.filter(p => !p.groupId);
    if (ungroupedPhotos.length > 0) {
      issues.push({
        type: 'ungrouped',
        count: ungroupedPhotos.length,
        items: ungroupedPhotos.map(p => ({ id: p.id, fileName: p.fileName })),
        message: `${ungroupedPhotos.length} 张照片未分组`
      });
    }

    for (const product of data.products) {
      const productPhotos = data.photos.filter(p => p.groupId === product.id);
      
      if (!product.mainPhotoId && productPhotos.length > 0) {
        issues.push({
          type: 'missing_main',
          productId: product.id,
          productTitle: product.title || '未命名商品',
          message: `商品 "${product.title || '未命名商品'}" 缺少主图`
        });
      }
      
      if (!product.price || product.price <= 0) {
        issues.push({
          type: 'missing_price',
          productId: product.id,
          productTitle: product.title || '未命名商品',
          message: `商品 "${product.title || '未命名商品'}" 缺少价格`
        });
      }
      
      const defectPhotos = productPhotos.filter(p => p.isDefect);
      for (const photo of defectPhotos) {
        if (!photo.defectDescription || photo.defectDescription.trim() === '') {
          issues.push({
            type: 'missing_defect_note',
            productId: product.id,
            productTitle: product.title || '未命名商品',
            photoId: photo.id,
            fileName: photo.fileName,
            message: `瑕疵照片 "${photo.fileName}" 缺少瑕疵说明`
          });
        }
      }
      
      if (productPhotos.length === 0) {
        issues.push({
          type: 'empty_product',
          productId: product.id,
          productTitle: product.title || '未命名商品',
          message: `商品 "${product.title || '未命名商品'}" 没有照片`
        });
      }
    }

    return issues;
  }

  static getStatistics(data) {
    const totalPhotos = data.photos.length;
    const groupedPhotos = data.photos.filter(p => p.groupId).length;
    const ungroupedPhotos = totalPhotos - groupedPhotos;
    const totalProducts = data.products.length;
    const withMainPhoto = data.products.filter(p => p.mainPhotoId).length;
    const withPrice = data.products.filter(p => p.price > 0).length;
    const duplicates = data.duplicates.length;
    const issues = data.issues.length;

    return {
      totalPhotos,
      groupedPhotos,
      ungroupedPhotos,
      totalProducts,
      withMainPhoto,
      withPrice,
      duplicates,
      issues
    };
  }
}

module.exports = DataManager;
