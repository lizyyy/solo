const fs = require('fs-extra');
const path = require('path');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

class Exporter {
  static async export(outputPath, data) {
    const timestamp = new Date().toISOString().slice(0, 10);
    const exportDir = path.join(outputPath, `export_${timestamp}`);
    
    await fs.ensureDir(exportDir);
    
    const imagesDir = path.join(exportDir, 'images');
    await fs.ensureDir(imagesDir);
    
    const productsWithPhotos = [];
    const photoRenames = [];
    
    for (let i = 0; i < data.products.length; i++) {
      const product = data.products[i];
      const productNum = String(i + 1).padStart(3, '0');
      const productPhotos = data.photos.filter(p => p.groupId === product.id);
      
      const exportedPhotos = [];
      
      for (let j = 0; j < productPhotos.length; j++) {
        const photo = productPhotos[j];
        const ext = path.extname(photo.fileName);
        const photoType = photo.isMain ? 'main' : (photo.isDefect ? 'defect' : 'detail');
        const photoNum = String(j + 1).padStart(2, '0');
        
        const newName = `p${productNum}_${photoType}_${photoNum}${ext}`;
        const destPath = path.join(imagesDir, newName);
        
        await fs.copyFile(photo.filePath, destPath);
        
        exportedPhotos.push({
          originalName: photo.fileName,
          newName: newName,
          isMain: photo.isMain,
          isDefect: photo.isDefect,
          defectDescription: photo.defectDescription
        });
        
        photoRenames.push({
          original: photo.filePath,
          new: destPath,
          newName: newName
        });
      }
      
      productsWithPhotos.push({
        number: productNum,
        ...product,
        photos: exportedPhotos,
        mainPhoto: exportedPhotos.find(p => p.isMain) || exportedPhotos[0]
      });
    }
    
    const csvPath = path.join(exportDir, 'products.csv');
    await this.generateCSV(csvPath, productsWithPhotos);
    
    const htmlPath = path.join(exportDir, 'preview.html');
    await this.generateHTML(htmlPath, productsWithPhotos, exportDir);
    
    const summary = {
      exportDir: exportDir,
      imagesDir: imagesDir,
      csvPath: csvPath,
      htmlPath: htmlPath,
      totalProducts: productsWithPhotos.length,
      totalPhotos: photoRenames.length,
      timestamp: timestamp
    };
    
    const summaryPath = path.join(exportDir, 'export-summary.json');
    await fs.writeJson(summaryPath, summary, { spaces: 2 });
    
    return summary;
  }

  static async generateCSV(filePath, products) {
    const csvWriter = createCsvWriter({
      path: filePath,
      header: [
        { id: 'number', title: '编号' },
        { id: 'title', title: '标题' },
        { id: 'price', title: '价格' },
        { id: 'condition', title: '成色' },
        { id: 'defectDescription', title: '瑕疵说明' },
        { id: 'status', title: '状态' },
        { id: 'photoCount', title: '照片数量' },
        { id: 'mainPhoto', title: '主图文件名' },
        { id: 'notes', title: '备注' }
      ]
    });
    
    const records = products.map(p => ({
      number: p.number,
      title: p.title,
      price: p.price,
      condition: p.condition,
      defectDescription: p.defectDescription,
      status: p.status,
      photoCount: p.photos.length,
      mainPhoto: p.mainPhoto ? p.mainPhoto.newName : '',
      notes: p.notes
    }));
    
    await csvWriter.writeRecords(records);
  }

  static async generateHTML(filePath, products, exportDir) {
    const htmlContent = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>商品上架预览 - ${new Date().toLocaleDateString()}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: #f5f5f5;
      color: #333;
      line-height: 1.6;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
    }
    header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 40px 20px;
      margin-bottom: 30px;
      border-radius: 12px;
    }
    header h1 {
      font-size: 2rem;
      margin-bottom: 10px;
    }
    header .stats {
      display: flex;
      gap: 30px;
      opacity: 0.9;
    }
    .product-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
      gap: 20px;
    }
    .product-card {
      background: white;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 2px 12px rgba(0,0,0,0.08);
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .product-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 20px rgba(0,0,0,0.12);
    }
    .product-number {
      background: #667eea;
      color: white;
      padding: 5px 15px;
      font-size: 0.9rem;
      font-weight: 600;
    }
    .product-main-image {
      width: 100%;
      height: 250px;
      object-fit: cover;
      background: #eee;
    }
    .product-info {
      padding: 20px;
    }
    .product-title {
      font-size: 1.2rem;
      font-weight: 600;
      margin-bottom: 10px;
      color: #333;
    }
    .product-price {
      font-size: 1.5rem;
      color: #e74c3c;
      font-weight: 700;
      margin-bottom: 15px;
    }
    .product-price::before {
      content: '¥';
      font-size: 1rem;
    }
    .product-meta {
      display: flex;
      gap: 15px;
      margin-bottom: 15px;
      flex-wrap: wrap;
    }
    .meta-item {
      background: #f8f9fa;
      padding: 5px 12px;
      border-radius: 20px;
      font-size: 0.85rem;
      color: #666;
    }
    .meta-item.condition-excellent { background: #d4edda; color: #155724; }
    .meta-item.condition-good { background: #fff3cd; color: #856404; }
    .meta-item.condition-fair { background: #f8d7da; color: #721c24; }
    .meta-item.status-published { background: #d4edda; color: #155724; }
    .meta-item.status-draft { background: #e2e8f0; color: #4a5568; }
    .product-section {
      margin-bottom: 15px;
    }
    .section-title {
      font-size: 0.9rem;
      font-weight: 600;
      color: #666;
      margin-bottom: 5px;
    }
    .section-content {
      color: #444;
      font-size: 0.95rem;
    }
    .product-photos {
      border-top: 1px solid #eee;
      padding: 15px 20px;
    }
    .photos-title {
      font-size: 0.9rem;
      font-weight: 600;
      color: #666;
      margin-bottom: 10px;
    }
    .photos-grid {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
    }
    .photo-thumb {
      position: relative;
      width: 60px;
      height: 60px;
      border-radius: 6px;
      overflow: hidden;
      cursor: pointer;
      border: 2px solid transparent;
    }
    .photo-thumb:hover {
      border-color: #667eea;
    }
    .photo-thumb img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .photo-thumb.is-main::after {
      content: '主';
      position: absolute;
      top: 2px;
      left: 2px;
      background: #e74c3c;
      color: white;
      font-size: 0.7rem;
      padding: 1px 4px;
      border-radius: 3px;
    }
    .photo-thumb.is-defect::after {
      content: '瑕';
      position: absolute;
      top: 2px;
      right: 2px;
      background: #f39c12;
      color: white;
      font-size: 0.7rem;
      padding: 1px 4px;
      border-radius: 3px;
    }
    .photo-thumb.is-main.is-defect::after {
      content: '主/瑕';
    }
    .defect-notes {
      background: #fff3cd;
      border-left: 3px solid #f39c12;
      padding: 10px 15px;
      margin-top: 10px;
      border-radius: 4px;
      font-size: 0.9rem;
    }
    footer {
      text-align: center;
      padding: 30px;
      color: #999;
      font-size: 0.9rem;
      margin-top: 40px;
    }
    @media (max-width: 768px) {
      .product-grid {
        grid-template-columns: 1fr;
      }
      header {
        padding: 25px 15px;
      }
      header h1 {
        font-size: 1.5rem;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>📦 商品上架预览</h1>
      <p>生成时间: ${new Date().toLocaleString('zh-CN')}</p>
      <div class="stats">
        <span>商品总数: ${products.length} 件</span>
        <span>照片总数: ${products.reduce((sum, p) => sum + p.photos.length, 0)} 张</span>
      </div>
    </header>
    
    <div class="product-grid">
${products.map(product => `
      <div class="product-card">
        <div class="product-number">商品 #${product.number}</div>
        ${product.mainPhoto ? `<img class="product-main-image" src="images/${product.mainPhoto.newName}" alt="${product.title}">` : ''}
        <div class="product-info">
          <h3 class="product-title">${product.title || '未命名商品'}</h3>
          <div class="product-price">${product.price || '待定'}</div>
          <div class="product-meta">
            <span class="meta-item condition-${product.condition === 'excellent' ? 'excellent' : product.condition === 'good' ? 'good' : 'fair'}">
              成色: ${product.condition === 'excellent' ? '全新' : product.condition === 'good' ? '良好' : product.condition === 'fair' ? '一般' : '未设置'}
            </span>
            <span class="meta-item status-${product.status}">
              状态: ${product.status === 'published' ? '已上架' : product.status === 'draft' ? '草稿' : product.status}
            </span>
            <span class="meta-item">${product.photos.length} 张照片</span>
          </div>
          ${product.defectDescription ? `
          <div class="product-section">
            <div class="section-title">瑕疵说明</div>
            <div class="section-content">${product.defectDescription}</div>
          </div>
          ` : ''}
          ${product.notes ? `
          <div class="product-section">
            <div class="section-title">备注</div>
            <div class="section-content">${product.notes}</div>
          </div>
          ` : ''}
        </div>
        <div class="product-photos">
          <div class="photos-title">照片列表 (${product.photos.length} 张)</div>
          <div class="photos-grid">
${product.photos.map(photo => `
            <div class="photo-thumb ${photo.isMain ? 'is-main' : ''} ${photo.isDefect ? 'is-defect' : ''}">
              <img src="images/${photo.newName}" alt="${photo.originalName}">
            </div>
`).join('')}
          </div>
          ${product.photos.some(p => p.isDefect && p.defectDescription) ? `
          <div class="defect-notes">
            <strong>瑕疵照片备注：</strong><br>
${product.photos.filter(p => p.isDefect && p.defectDescription).map(p => 
  `• ${p.newName}: ${p.defectDescription}`
).join('<br>')}
          </div>
          ` : ''}
        </div>
      </div>
`).join('')}
    </div>
    
    <footer>
      <p>由 Photo Listing Desk 生成 | ${new Date().toLocaleDateString()}</p>
    </footer>
  </div>
</body>
</html>`;
    
    await fs.writeFile(filePath, htmlContent, 'utf-8');
  }
}

module.exports = Exporter;
