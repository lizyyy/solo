class App {
  constructor() {
    this.projectData = {
      version: '1.0',
      created: Date.now(),
      updated: Date.now(),
      folderPath: null,
      photos: [],
      products: [],
      duplicates: [],
      issues: []
    };
    
    this.currentProjectPath = null;
    this.currentPhotoId = null;
    this.currentProductId = null;
    this.selectedPhotos = new Set();
    
    this.init();
  }

  init() {
    this.bindEvents();
    this.loadSampleData();
  }

  bindEvents() {
    document.getElementById('btn-select-folder').addEventListener('click', () => this.selectFolder());
    document.getElementById('btn-load-sample').addEventListener('click', () => this.loadSampleData());
    document.getElementById('btn-new-project').addEventListener('click', () => this.newProject());
    document.getElementById('btn-open-project').addEventListener('click', () => this.openProject());
    document.getElementById('btn-save-project').addEventListener('click', () => this.saveProject());
    document.getElementById('btn-export').addEventListener('click', () => this.exportProject());
    
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => this.switchTab(e.target.closest('.tab-btn').dataset.tab));
    });
    
    document.getElementById('btn-create-product').addEventListener('click', () => this.createProduct());
    document.getElementById('btn-create-product-2').addEventListener('click', () => this.createProduct());
    
    document.getElementById('search-ungrouped').addEventListener('input', (e) => this.filterPhotos(e.target.value));
    document.getElementById('sort-ungrouped').addEventListener('change', (e) => this.sortPhotos(e.target.value));
    document.getElementById('filter-status').addEventListener('change', (e) => this.filterProducts(e.target.value));
    
    document.getElementById('modal-photo-close').addEventListener('click', () => this.closePhotoModal());
    document.getElementById('modal-photo-cancel').addEventListener('click', () => this.closePhotoModal());
    document.getElementById('modal-photo-save').addEventListener('click', () => this.savePhotoModal());
    
    document.getElementById('modal-photo-defect').addEventListener('change', (e) => {
      document.getElementById('defect-description-group').style.display = e.target.checked ? 'block' : 'none';
    });
    
    document.getElementById('btn-new-product-from-photo').addEventListener('click', () => {
      this.createProduct();
      this.closePhotoModal();
    });
    
    document.getElementById('modal-product-close').addEventListener('click', () => this.closeProductModal());
    document.getElementById('modal-product-cancel').addEventListener('click', () => this.closeProductModal());
    document.getElementById('modal-product-save').addEventListener('click', () => this.saveProductModal());
    document.getElementById('modal-product-delete').addEventListener('click', () => this.deleteCurrentProduct());
    
    document.getElementById('btn-add-photos').addEventListener('click', () => this.openPhotoSelector());
    
    document.getElementById('modal-overlay').addEventListener('click', (e) => {
      if (e.target === document.getElementById('modal-overlay')) {
        this.closeAllModals();
      }
    });
  }

  async selectFolder() {
    const folderPath = await window.electronAPI.selectFolder();
    if (!folderPath) return;
    
    this.showToast('正在扫描照片...', 'info');
    
    const result = await window.electronAPI.scanPhotos(folderPath);
    
    if (!result.success) {
      this.showToast('扫描失败: ' + result.error, 'error');
      return;
    }
    
    this.projectData.folderPath = folderPath;
    this.projectData.photos = result.data;
    
    for (const photo of this.projectData.photos) {
      if (!photo.thumbnail) {
        const thumbResult = await window.electronAPI.generateThumbnail(photo.filePath, 200, 200);
        if (thumbResult.success) {
          photo.thumbnail = thumbResult.data;
        }
      }
    }
    
    await this.checkDuplicates();
    this.validateProject();
    
    document.getElementById('welcome-screen').style.display = 'none';
    document.getElementById('main-content').style.display = 'flex';
    
    this.updateUI();
    this.showToast(`扫描完成，共 ${this.projectData.photos.length} 张照片`, 'success');
  }

  async checkDuplicates() {
    const result = await window.electronAPI.checkDuplicates(this.projectData.photos);
    if (result.success) {
      this.projectData.duplicates = result.data;
    }
  }

  validateProject() {
    const issues = [];
    
    const ungroupedPhotos = this.projectData.photos.filter(p => !p.groupId);
    if (ungroupedPhotos.length > 0) {
      issues.push({
        type: 'ungrouped',
        count: ungroupedPhotos.length,
        message: `${ungroupedPhotos.length} 张照片未分组`
      });
    }
    
    for (const product of this.projectData.products) {
      const productPhotos = this.projectData.photos.filter(p => p.groupId === product.id);
      
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
    
    this.projectData.issues = issues;
  }

  async loadSampleData() {
    const samplePhotos = [
      {
        id: 'photo_sample_1',
        filePath: '/sample/iphone_front.jpg',
        fileName: 'iphone_front.jpg',
        fileSize: 2456789,
        fileSizeFormatted: '2.34 MB',
        hash: 'sample_hash_1',
        width: 4032,
        height: 3024,
        format: 'jpg',
        thumbnail: this.generatePlaceholderThumbnail('📱'),
        groupId: 'prod_sample_1',
        isDefect: false,
        isMain: true,
        defectDescription: ''
      },
      {
        id: 'photo_sample_2',
        filePath: '/sample/iphone_back.jpg',
        fileName: 'iphone_back.jpg',
        fileSize: 2123456,
        fileSizeFormatted: '2.03 MB',
        hash: 'sample_hash_2',
        width: 4032,
        height: 3024,
        format: 'jpg',
        thumbnail: this.generatePlaceholderThumbnail('📱'),
        groupId: 'prod_sample_1',
        isDefect: false,
        isMain: false,
        defectDescription: ''
      },
      {
        id: 'photo_sample_3',
        filePath: '/sample/iphone_scratch.jpg',
        fileName: 'iphone_scratch.jpg',
        fileSize: 1876543,
        fileSizeFormatted: '1.79 MB',
        hash: 'sample_hash_3',
        width: 4032,
        height: 3024,
        format: 'jpg',
        thumbnail: this.generatePlaceholderThumbnail('⚡'),
        groupId: 'prod_sample_1',
        isDefect: true,
        isMain: false,
        defectDescription: '右下角有轻微划痕'
      },
      {
        id: 'photo_sample_4',
        filePath: '/sample/macbook_front.jpg',
        fileName: 'macbook_front.jpg',
        fileSize: 3456789,
        fileSizeFormatted: '3.30 MB',
        hash: 'sample_hash_4',
        width: 5184,
        height: 3456,
        format: 'jpg',
        thumbnail: this.generatePlaceholderThumbnail('💻'),
        groupId: 'prod_sample_2',
        isDefect: false,
        isMain: true,
        defectDescription: ''
      },
      {
        id: 'photo_sample_5',
        filePath: '/sample/macbook_side.jpg',
        fileName: 'macbook_side.jpg',
        fileSize: 2987654,
        fileSizeFormatted: '2.85 MB',
        hash: 'sample_hash_5',
        width: 5184,
        height: 3456,
        format: 'jpg',
        thumbnail: this.generatePlaceholderThumbnail('💻'),
        groupId: 'prod_sample_2',
        isDefect: false,
        isMain: false,
        defectDescription: ''
      },
      {
        id: 'photo_sample_6',
        filePath: '/sample/headphones.jpg',
        fileName: 'headphones.jpg',
        fileSize: 1567890,
        fileSizeFormatted: '1.49 MB',
        hash: 'sample_hash_6',
        width: 4032,
        height: 3024,
        format: 'jpg',
        thumbnail: this.generatePlaceholderThumbnail('🎧'),
        groupId: null,
        isDefect: false,
        isMain: false,
        defectDescription: ''
      }
    ];
    
    const sampleProducts = [
      {
        id: 'prod_sample_1',
        title: 'iPhone 13 Pro 256G 远峰蓝',
        price: 5999,
        condition: 'good',
        defectDescription: '整体成色良好，屏幕有一处微小划痕',
        status: 'draft',
        photoIds: ['photo_sample_1', 'photo_sample_2', 'photo_sample_3'],
        mainPhotoId: 'photo_sample_1',
        notes: '自用手机，保护良好',
        createdAt: Date.now() - 86400000,
        updatedAt: Date.now()
      },
      {
        id: 'prod_sample_2',
        title: 'MacBook Pro 14寸 M1 Pro',
        price: 12999,
        condition: 'excellent',
        defectDescription: '',
        status: 'published',
        photoIds: ['photo_sample_4', 'photo_sample_5'],
        mainPhotoId: 'photo_sample_4',
        notes: '几乎全新，购买不到半年',
        createdAt: Date.now() - 172800000,
        updatedAt: Date.now()
      }
    ];
    
    this.projectData = {
      version: '1.0',
      created: Date.now(),
      updated: Date.now(),
      folderPath: '/sample/photos',
      photos: samplePhotos,
      products: sampleProducts,
      duplicates: [],
      issues: []
    };
    
    this.validateProject();
    
    document.getElementById('welcome-screen').style.display = 'none';
    document.getElementById('main-content').style.display = 'flex';
    
    this.updateUI();
    this.showToast('已加载示例数据', 'success');
  }

  generatePlaceholderThumbnail(emoji) {
    const canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 200;
    const ctx = canvas.getContext('2d');
    
    const colors = ['#667eea', '#764ba2', '#f093fb', '#4facfe', '#43e97b'];
    const color = colors[Math.floor(Math.random() * colors.length)];
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 200, 200);
    
    ctx.font = '60px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(emoji, 100, 100);
    
    return canvas.toDataURL();
  }

  newProject() {
    this.projectData = {
      version: '1.0',
      created: Date.now(),
      updated: Date.now(),
      folderPath: null,
      photos: [],
      products: [],
      duplicates: [],
      issues: []
    };
    this.currentProjectPath = null;
    
    document.getElementById('welcome-screen').style.display = 'flex';
    document.getElementById('main-content').style.display = 'none';
    
    this.showToast('已创建新项目', 'success');
  }

  async openProject() {
    const filePath = await window.electronAPI.selectFile({
      filters: [{ name: 'JSON Files', extensions: ['json'] }]
    });
    
    if (!filePath) return;
    
    const result = await window.electronAPI.loadProject(filePath);
    
    if (!result.success) {
      this.showToast('打开项目失败: ' + result.error, 'error');
      return;
    }
    
    this.projectData = result.data;
    this.currentProjectPath = filePath;
    
    document.getElementById('welcome-screen').style.display = 'none';
    document.getElementById('main-content').style.display = 'flex';
    
    this.updateUI();
    this.showToast('项目已打开', 'success');
  }

  async saveProject() {
    let filePath = this.currentProjectPath;
    
    if (!filePath) {
      filePath = await window.electronAPI.saveFile({
        defaultPath: 'photo-listing-project.json',
        filters: [{ name: 'JSON Files', extensions: ['json'] }]
      });
      
      if (!filePath) return;
      this.currentProjectPath = filePath;
    }
    
    this.projectData.updated = Date.now();
    
    const result = await window.electronAPI.saveProject(filePath, this.projectData);
    
    if (!result.success) {
      this.showToast('保存失败: ' + result.error, 'error');
      return;
    }
    
    this.showToast('项目已保存', 'success');
  }

  async exportProject() {
    const outputPath = await window.electronAPI.selectFolder();
    if (!outputPath) return;
    
    this.showToast('正在导出...', 'info');
    
    const result = await window.electronAPI.exportProject(outputPath, this.projectData);
    
    if (!result.success) {
      this.showToast('导出失败: ' + result.error, 'error');
      return;
    }
    
    this.showToast(`导出完成！共 ${result.data.totalProducts} 件商品，${result.data.totalPhotos} 张照片`, 'success');
  }

  createProduct() {
    const productId = 'prod_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
    
    const product = {
      id: productId,
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
    
    this.projectData.products.push(product);
    this.currentProductId = productId;
    
    this.openProductModal(productId);
  }

  switchTab(tabName) {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });
    
    document.querySelectorAll('.tab-panel').forEach(panel => {
      panel.classList.toggle('active', panel.id === 'panel-' + tabName);
    });
  }

  updateUI() {
    this.updateStats();
    this.updateIssues();
    this.updateDuplicates();
    this.updateUngroupedPhotos();
    this.updateProducts();
  }

  updateStats() {
    const stats = {
      totalPhotos: this.projectData.photos.length,
      groupedPhotos: this.projectData.photos.filter(p => p.groupId).length,
      ungroupedPhotos: this.projectData.photos.filter(p => !p.groupId).length,
      totalProducts: this.projectData.products.length
    };
    
    document.getElementById('stat-total-photos').textContent = stats.totalPhotos;
    document.getElementById('stat-grouped-photos').textContent = stats.groupedPhotos;
    document.getElementById('stat-ungrouped-photos').textContent = stats.ungroupedPhotos;
    document.getElementById('stat-total-products').textContent = stats.totalProducts;
    
    document.getElementById('tab-count-ungrouped').textContent = stats.ungroupedPhotos;
    document.getElementById('tab-count-products').textContent = stats.totalProducts;
  }

  updateIssues() {
    const container = document.getElementById('issues-list');
    const countBadge = document.getElementById('issues-count');
    
    if (this.projectData.issues.length === 0) {
      container.innerHTML = '<div class="empty-message">暂无问题</div>';
      countBadge.textContent = '';
      return;
    }
    
    countBadge.textContent = this.projectData.issues.length;
    
    container.innerHTML = this.projectData.issues.map(issue => `
      <div class="issue-item type-${issue.type}">
        ${issue.message}
      </div>
    `).join('');
  }

  updateDuplicates() {
    const container = document.getElementById('duplicates-list');
    const countBadge = document.getElementById('duplicates-count');
    
    if (this.projectData.duplicates.length === 0) {
      container.innerHTML = '<div class="empty-message">暂无检测到的重复图片</div>';
      countBadge.textContent = '';
      return;
    }
    
    countBadge.textContent = this.projectData.duplicates.length;
    
    container.innerHTML = this.projectData.duplicates.map(dup => `
      <div class="duplicate-item type-${dup.type}">
        <strong>${dup.type === 'exact' ? '完全重复' : '疑似重复'} (${dup.confidence}%)</strong><br>
        ${dup.photos.map(p => p.fileName).join(' vs ')}<br>
        <small>${dup.reason}</small>
      </div>
    `).join('');
  }

  updateUngroupedPhotos() {
    const container = document.getElementById('ungrouped-photos');
    const ungrouped = this.projectData.photos.filter(p => !p.groupId);
    
    if (ungrouped.length === 0) {
      container.innerHTML = '<div class="empty-message">暂无未分组照片</div>';
      return;
    }
    
    container.innerHTML = ungrouped.map(photo => `
      <div class="photo-card" data-photo-id="${photo.id}">
        <div class="photo-thumbnail">
          <img src="${photo.thumbnail || this.generatePlaceholderThumbnail('🖼️')}" alt="${photo.fileName}">
        </div>
        <div class="photo-info">
          <div class="photo-name">${photo.fileName}</div>
          <div class="photo-meta">
            <span>${photo.fileSizeFormatted}</span>
            <span>${photo.width}×${photo.height}</span>
          </div>
        </div>
      </div>
    `).join('');
    
    container.querySelectorAll('.photo-card').forEach(card => {
      card.addEventListener('click', () => {
        const photoId = card.dataset.photoId;
        this.openPhotoModal(photoId);
      });
    });
  }

  updateProducts() {
    const container = document.getElementById('products-grid');
    
    if (this.projectData.products.length === 0) {
      container.innerHTML = '<div class="empty-message">暂无商品，点击"创建新商品"开始</div>';
      return;
    }
    
    container.innerHTML = this.projectData.products.map(product => {
      const productPhotos = this.projectData.photos.filter(p => p.groupId === product.id);
      const mainPhoto = productPhotos.find(p => p.isMain) || productPhotos[0];
      
      const conditionLabel = {
        'excellent': '全新',
        'good': '良好',
        'fair': '一般',
        'poor': '较差'
      }[product.condition] || '未设置';
      
      const statusLabel = {
        'draft': '草稿',
        'published': '已上架',
        'sold': '已售出'
      }[product.status] || product.status;
      
      return `
        <div class="product-card" data-product-id="${product.id}">
          <div class="product-main-image">
            ${mainPhoto ? 
              `<img src="${mainPhoto.thumbnail || this.generatePlaceholderThumbnail('📦')}" alt="${product.title}">` :
              `<span class="placeholder">📦</span>`
            }
          </div>
          <div class="product-details">
            <div class="product-title">${product.title || '未命名商品'}</div>
            <div class="product-price">${product.price || '待定'}</div>
            <div class="product-meta">
              <span class="product-tag condition-${product.condition}">成色: ${conditionLabel}</span>
              <span class="product-tag status-${product.status}">${statusLabel}</span>
              <span class="product-photos-count">${productPhotos.length} 张照片</span>
            </div>
          </div>
        </div>
      `;
    }).join('');
    
    container.querySelectorAll('.product-card').forEach(card => {
      card.addEventListener('click', () => {
        const productId = card.dataset.productId;
        this.openProductModal(productId);
      });
    });
  }

  openPhotoModal(photoId) {
    const photo = this.projectData.photos.find(p => p.id === photoId);
    if (!photo) return;
    
    this.currentPhotoId = photoId;
    
    document.getElementById('modal-photo-image').src = photo.thumbnail || this.generatePlaceholderThumbnail('🖼️');
    document.getElementById('modal-photo-filename').textContent = photo.fileName;
    document.getElementById('modal-photo-size').textContent = photo.fileSizeFormatted;
    document.getElementById('modal-photo-dimensions').textContent = `${photo.width} × ${photo.height}`;
    document.getElementById('modal-photo-format').textContent = photo.format.toUpperCase();
    
    const product = this.projectData.products.find(p => p.id === photo.groupId);
    document.getElementById('modal-photo-product').textContent = product ? product.title : '未分组';
    
    document.getElementById('modal-photo-main').checked = photo.isMain;
    document.getElementById('modal-photo-defect').checked = photo.isDefect;
    document.getElementById('modal-defect-description').value = photo.defectDescription || '';
    
    document.getElementById('defect-description-group').style.display = photo.isDefect ? 'block' : 'none';
    
    const select = document.getElementById('modal-assign-product');
    select.innerHTML = `
      <option value="">-- 选择商品 --</option>
      ${this.projectData.products.map(p => 
        `<option value="${p.id}" ${p.id === photo.groupId ? 'selected' : ''}>${p.title || '未命名商品'}</option>`
      ).join('')}
    `;
    
    document.getElementById('modal-overlay').classList.add('active');
    document.getElementById('photo-modal').classList.add('active');
  }

  closePhotoModal() {
    document.getElementById('modal-overlay').classList.remove('active');
    document.getElementById('photo-modal').classList.remove('active');
    this.currentPhotoId = null;
  }

  savePhotoModal() {
    const photo = this.projectData.photos.find(p => p.id === this.currentPhotoId);
    if (!photo) return;
    
    photo.isMain = document.getElementById('modal-photo-main').checked;
    photo.isDefect = document.getElementById('modal-photo-defect').checked;
    photo.defectDescription = document.getElementById('modal-defect-description').value;
    
    const newGroupId = document.getElementById('modal-assign-product').value;
    
    if (photo.groupId !== newGroupId) {
      if (photo.groupId) {
        const oldProduct = this.projectData.products.find(p => p.id === photo.groupId);
        if (oldProduct) {
          oldProduct.photoIds = oldProduct.photoIds.filter(id => id !== photo.id);
          if (oldProduct.mainPhotoId === photo.id) {
            oldProduct.mainPhotoId = null;
          }
        }
      }
      
      photo.groupId = newGroupId || null;
      
      if (newGroupId) {
        const newProduct = this.projectData.products.find(p => p.id === newGroupId);
        if (newProduct) {
          if (!newProduct.photoIds.includes(photo.id)) {
            newProduct.photoIds.push(photo.id);
          }
        }
      }
    }
    
    if (photo.isMain && photo.groupId) {
      const product = this.projectData.products.find(p => p.id === photo.groupId);
      if (product) {
        this.projectData.photos
          .filter(p => p.groupId === photo.groupId && p.id !== photo.id)
          .forEach(p => p.isMain = false);
        product.mainPhotoId = photo.id;
      }
    }
    
    this.validateProject();
    this.updateUI();
    this.closePhotoModal();
    this.showToast('照片信息已更新', 'success');
  }

  openProductModal(productId) {
    const product = this.projectData.products.find(p => p.id === productId);
    if (!product) return;
    
    this.currentProductId = productId;
    
    document.getElementById('modal-product-title').textContent = product.title ? '编辑商品' : '新建商品';
    document.getElementById('product-title').value = product.title || '';
    document.getElementById('product-price').value = product.price || '';
    document.getElementById('product-condition').value = product.condition || '';
    document.getElementById('product-status').value = product.status || 'draft';
    document.getElementById('product-defects').value = product.defectDescription || '';
    document.getElementById('product-notes').value = product.notes || '';
    
    this.updateProductPhotosGrid();
    
    document.getElementById('modal-overlay').classList.add('active');
    document.getElementById('product-modal').classList.add('active');
  }

  updateProductPhotosGrid() {
    const container = document.getElementById('product-photos-grid');
    const product = this.projectData.products.find(p => p.id === this.currentProductId);
    
    if (!product || product.photoIds.length === 0) {
      container.innerHTML = '<div class="empty-message">暂无照片</div>';
      return;
    }
    
    const productPhotos = this.projectData.photos.filter(p => product.photoIds.includes(p.id));
    
    container.innerHTML = productPhotos.map(photo => `
      <div class="product-photo-item ${photo.isMain ? 'selected' : ''}" data-photo-id="${photo.id}">
        <img src="${photo.thumbnail || this.generatePlaceholderThumbnail('🖼️')}" alt="${photo.fileName}">
        <div class="product-photo-badges">
          ${photo.isMain ? '<span class="product-photo-badge main">主</span>' : ''}
          ${photo.isDefect ? '<span class="product-photo-badge defect">瑕</span>' : ''}
        </div>
        <button class="product-photo-remove" data-photo-id="${photo.id}">&times;</button>
      </div>
    `).join('');
    
    container.querySelectorAll('.product-photo-item').forEach(item => {
      item.addEventListener('click', (e) => {
        if (e.target.classList.contains('product-photo-remove')) {
          const photoId = e.target.dataset.photoId;
          this.removePhotoFromProduct(photoId);
        } else {
          const photoId = item.dataset.photoId;
          this.setProductMainPhoto(photoId);
        }
      });
    });
  }

  removePhotoFromProduct(photoId) {
    const product = this.projectData.products.find(p => p.id === this.currentProductId);
    if (!product) return;
    
    const photo = this.projectData.photos.find(p => p.id === photoId);
    if (photo) {
      photo.groupId = null;
      photo.isMain = false;
    }
    
    product.photoIds = product.photoIds.filter(id => id !== photoId);
    if (product.mainPhotoId === photoId) {
      product.mainPhotoId = null;
    }
    
    this.updateProductPhotosGrid();
  }

  setProductMainPhoto(photoId) {
    const product = this.projectData.products.find(p => p.id === this.currentProductId);
    if (!product) return;
    
    this.projectData.photos
      .filter(p => p.groupId === this.currentProductId)
      .forEach(p => p.isMain = false);
    
    const photo = this.projectData.photos.find(p => p.id === photoId);
    if (photo) {
      photo.isMain = true;
      product.mainPhotoId = photoId;
    }
    
    this.updateProductPhotosGrid();
  }

  openPhotoSelector() {
    const ungroupedPhotos = this.projectData.photos.filter(p => !p.groupId);
    
    if (ungroupedPhotos.length === 0) {
      this.showToast('没有可添加的照片', 'warning');
      return;
    }
    
    const photoToAdd = ungroupedPhotos[0];
    photoToAdd.groupId = this.currentProductId;
    
    const product = this.projectData.products.find(p => p.id === this.currentProductId);
    if (product) {
      product.photoIds.push(photoToAdd.id);
    }
    
    this.updateProductPhotosGrid();
    this.showToast(`已添加 ${photoToAdd.fileName}`, 'success');
  }

  closeProductModal() {
    document.getElementById('modal-overlay').classList.remove('active');
    document.getElementById('product-modal').classList.remove('active');
    this.currentProductId = null;
  }

  saveProductModal() {
    const product = this.projectData.products.find(p => p.id === this.currentProductId);
    if (!product) return;
    
    product.title = document.getElementById('product-title').value.trim();
    product.price = parseFloat(document.getElementById('product-price').value) || 0;
    product.condition = document.getElementById('product-condition').value;
    product.status = document.getElementById('product-status').value;
    product.defectDescription = document.getElementById('product-defects').value.trim();
    product.notes = document.getElementById('product-notes').value.trim();
    product.updatedAt = Date.now();
    
    this.validateProject();
    this.updateUI();
    this.closeProductModal();
    this.showToast('商品已保存', 'success');
  }

  deleteCurrentProduct() {
    if (!confirm('确定要删除这个商品吗？相关照片将变为未分组状态。')) return;
    
    const productIndex = this.projectData.products.findIndex(p => p.id === this.currentProductId);
    if (productIndex === -1) return;
    
    this.projectData.photos
      .filter(p => p.groupId === this.currentProductId)
      .forEach(p => {
        p.groupId = null;
        p.isMain = false;
      });
    
    this.projectData.products.splice(productIndex, 1);
    
    this.validateProject();
    this.updateUI();
    this.closeProductModal();
    this.showToast('商品已删除', 'success');
  }

  closeAllModals() {
    this.closePhotoModal();
    this.closeProductModal();
  }

  filterPhotos(query) {
    const cards = document.querySelectorAll('#ungrouped-photos .photo-card');
    query = query.toLowerCase();
    
    cards.forEach(card => {
      const name = card.querySelector('.photo-name').textContent.toLowerCase();
      card.style.display = name.includes(query) ? '' : 'none';
    });
  }

  sortPhotos(sortBy) {
    const container = document.getElementById('ungrouped-photos');
    const ungrouped = [...this.projectData.photos.filter(p => !p.groupId)];
    
    switch (sortBy) {
      case 'name':
        ungrouped.sort((a, b) => a.fileName.localeCompare(b.fileName));
        break;
      case 'size':
        ungrouped.sort((a, b) => b.fileSize - a.fileSize);
        break;
      case 'date':
        ungrouped.sort((a, b) => b.createdAt - a.createdAt);
        break;
    }
    
    this.projectData.photos = [
      ...this.projectData.photos.filter(p => p.groupId),
      ...ungrouped
    ];
    
    this.updateUngroupedPhotos();
  }

  filterProducts(status) {
    const cards = document.querySelectorAll('#products-grid .product-card');
    
    cards.forEach(card => {
      const productId = card.dataset.productId;
      const product = this.projectData.products.find(p => p.id === productId);
      
      if (status === 'all' || !product || product.status === status) {
        card.style.display = '';
      } else {
        card.style.display = 'none';
      }
    });
  }

  showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type} show`;
    
    setTimeout(() => {
      toast.classList.remove('show');
    }, 3000);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new App();
});
