const App = {
    currentPage: 'home',
    currentFilter: 'all',
    lostImages: [],
    foundImages: [],
    postImages: [],
    heatmap: null,
    editingItem: null,

    init() {
        this.initCitySelector();
        this.setupEventListeners();
        this.navigateTo('home');
        this.loadStats();
        this.loadLatestItems();
        this.initImageUploads();
    },

    initCitySelector() {
        const selector = document.getElementById('citySelector');
        if (!selector) return;

        const cities = DB.getAllCities();
        const currentCity = DB.getCurrentCity();
        
        let options = '';
        cities.forEach(city => {
            const selected = city.key === currentCity ? 'selected' : '';
            options += `<option value="${city.key}" ${selected}>${city.name}</option>`;
        });
        selector.innerHTML = options;
    },

    setupEventListeners() {
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', () => {
                const page = item.dataset.page;
                this.navigateTo(page);
            });
        });

        const citySelector = document.getElementById('citySelector');
        if (citySelector) {
            citySelector.addEventListener('change', (e) => {
                const newCity = e.target.value;
                DB.setCurrentCity(newCity);
                const cityInfo = DB.getCityInfo(newCity);
                Utils.showToast(`已切换到 ${cityInfo.name}`, 'info');
                
                if (this.currentPage === 'heatmap') {
                    this.initHeatmap();
                }
                
                this.loadStats();
                this.loadLatestItems();
                if (this.currentPage === 'list') {
                    this.loadItemList();
                }
            });
        }

        document.getElementById('globalSearch').addEventListener('input', 
            Utils.debounce((e) => this.handleGlobalSearch(e.target.value), 300)
        );

        document.querySelectorAll('.filter-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                this.currentFilter = tab.dataset.filter;
                this.updateFilterTabs();
                this.loadItemList();
            });
        });

        document.getElementById('lostItemForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.submitLostItem();
        });

        document.getElementById('foundItemForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.submitFoundItem();
        });

        document.getElementById('lost-images').addEventListener('change', (e) => {
            this.handleImageUpload(e, 'lost');
        });

        document.getElementById('found-images').addEventListener('change', (e) => {
            this.handleImageUpload(e, 'found');
        });

        document.getElementById('post-images').addEventListener('change', (e) => {
            this.handleImageUpload(e, 'post');
        });
    },

    navigateTo(page) {
        this.currentPage = page;
        
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        
        const targetPage = document.getElementById(`page-${page}`);
        if (targetPage) {
            targetPage.classList.add('active');
        }

        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
            if (item.dataset.page === page) {
                item.classList.add('active');
            }
        });

        this.onPageLoad(page);
    },

    onPageLoad(page) {
        switch (page) {
            case 'home':
                this.loadStats();
                this.loadLatestItems();
                break;
            case 'list':
                this.loadItemList();
                break;
            case 'match':
                populateMatchSelect();
                document.getElementById('match-results').innerHTML = '';
                break;
            case 'heatmap':
                this.initHeatmap();
                break;
            case 'social':
                this.loadPosts();
                this.populatePostRelatedItems();
                break;
        }
    },

    loadStats() {
        const stats = DB.getStats();
        document.getElementById('stat-lost').textContent = stats.lostCount;
        document.getElementById('stat-found').textContent = stats.foundCount;
        document.getElementById('stat-matched').textContent = stats.matchedCount;
        document.getElementById('stat-completed').textContent = stats.completedCount;
    },

    loadLatestItems() {
        const container = document.getElementById('latest-items');
        const lostItems = DB.getLostItemsByCity().slice(0, 3);
        const foundItems = DB.getFoundItemsByCity().slice(0, 2);
        
        const allItems = [
            ...lostItems.map(item => ({ ...item, type: 'lost' })),
            ...foundItems.map(item => ({ ...item, type: 'found' }))
        ].sort((a, b) => (b.createTime || b.time) - (a.createTime || a.time)).slice(0, 5);

        if (allItems.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"></path>
                    </svg>
                    <h3>暂无发布</h3>
                    <p>快来发布第一条失物/拾物信息吧</p>
                </div>
            `;
            return;
        }

        let html = '';
        allItems.forEach(item => {
            const typeLabel = item.type === 'lost' ? '失物' : '拾物';
            const tagClass = item.type === 'lost' ? 'tag-lost' : 'tag-found';
            const timeAgo = Utils.formatTime(item.time || item.createTime);
            const statusClass = Utils.getStatusClass(item.status);
            const statusName = Utils.getStatusName(item.status);

            html += `
                <div class="list-item" onclick="viewItemDetail('${item.type}', '${item.id}')">
                    <div style="display: flex; justify-content: space-between; align-items: start;">
                        <div style="flex: 1;">
                            <div style="margin-bottom: 8px;">
                                <span class="tag ${tagClass}">${typeLabel}</span>
                                <span class="status-badge ${statusClass}">${statusName}</span>
                            </div>
                            <h4 style="font-weight: 600; margin-bottom: 8px;">${item.title}</h4>
                            <p style="color: #64748b; font-size: 14px; margin-bottom: 4px;">
                                📍 ${item.location}
                            </p>
                            <p style="color: #94a3b8; font-size: 12px;">
                                ⏰ ${timeAgo} · ${item.userName}
                            </p>
                        </div>
                        <svg style="width: 20px; height: 20px; color: #cbd5e1;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
                        </svg>
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;
    },

    loadItemList() {
        const container = document.getElementById('item-list');
        let items = [];

        const lostItems = DB.getLostItemsByCity().map(item => ({ ...item, type: 'lost' }));
        const foundItems = DB.getFoundItemsByCity().map(item => ({ ...item, type: 'found' }));
        
        switch (this.currentFilter) {
            case 'lost':
                items = lostItems;
                break;
            case 'found':
                items = foundItems;
                break;
            case 'matched':
                items = [...lostItems, ...foundItems].filter(i => i.status === 'matched');
                break;
            case 'completed':
                items = [...lostItems, ...foundItems].filter(i => i.status === 'completed');
                break;
            default:
                items = [...lostItems, ...foundItems];
        }

        items.sort((a, b) => (b.createTime || b.time) - (a.createTime || a.time));

        if (items.length === 0) {
            container.innerHTML = `
                <div class="card">
                    <div class="card-body">
                        <div class="empty-state">
                            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                            </svg>
                            <h3>暂无数据</h3>
                            <p>该分类下暂无物品信息</p>
                        </div>
                    </div>
                </div>
            `;
            return;
        }

        let html = '';
        items.forEach(item => {
            const typeLabel = item.type === 'lost' ? '失物' : '拾物';
            const tagClass = item.type === 'lost' ? 'tag-lost' : 'tag-found';
            const categoryName = Utils.getCategoryName(item.category);
            const timeAgo = Utils.formatTime(item.time || item.createTime);
            const statusClass = Utils.getStatusClass(item.status);
            const statusName = Utils.getStatusName(item.status);

            html += `
                <div class="card" style="margin-bottom: 16px; cursor: pointer;" onclick="viewItemDetail('${item.type}', '${item.id}')">
                    <div class="card-body">
                        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px;">
                            <div>
                                <span class="tag ${tagClass}">${typeLabel}</span>
                                <span class="tag tag-category">${categoryName}</span>
                            </div>
                            <span class="status-badge ${statusClass}">${statusName}</span>
                        </div>
                        <h4 style="font-weight: 600; margin-bottom: 12px; font-size: 18px;">${item.title}</h4>
                        <p style="color: #64748b; margin-bottom: 8px; font-size: 14px;">
                            📍 ${item.location}
                        </p>
                        <p style="color: #64748b; margin-bottom: 12px; font-size: 14px; line-height: 1.5;">
                            ${Utils.truncate(item.description, 100)}
                        </p>
                        ${item.features && item.features.length > 0 ? `
                            <div style="margin-bottom: 12px;">
                                ${item.features.map(f => `<span class="tag" style="background: #f1f5f9; color: #475569;">${f}</span>`).join('')}
                            </div>
                        ` : ''}
                        <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 12px; border-top: 1px solid #f0f0f0;">
                            <span style="color: #94a3b8; font-size: 12px;">
                                ${item.userName} · ${timeAgo}
                            </span>
                            <span style="color: #667eea; font-size: 14px; font-weight: 500;">
                                查看详情 →
                            </span>
                        </div>
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;
    },

    updateFilterTabs() {
        document.querySelectorAll('.filter-tab').forEach(tab => {
            tab.classList.remove('active');
            if (tab.dataset.filter === this.currentFilter) {
                tab.classList.add('active');
            }
        });
    },

    handleGlobalSearch(query) {
        if (!query.trim()) {
            if (this.currentPage === 'list') {
                this.loadItemList();
            }
            return;
        }

        const lowerQuery = query.toLowerCase();
        const lostItems = DB.getLostItems().filter(item => 
            item.title.toLowerCase().includes(lowerQuery) ||
            item.description.toLowerCase().includes(lowerQuery) ||
            item.location.toLowerCase().includes(lowerQuery)
        ).map(item => ({ ...item, type: 'lost' }));

        const foundItems = DB.getFoundItems().filter(item => 
            item.title.toLowerCase().includes(lowerQuery) ||
            item.description.toLowerCase().includes(lowerQuery) ||
            item.location.toLowerCase().includes(lowerQuery)
        ).map(item => ({ ...item, type: 'found' }));

        const results = [...lostItems, ...foundItems].sort((a, b) => 
            (b.createTime || b.time) - (a.createTime || a.time)
        );

        if (this.currentPage === 'list') {
            this.renderSearchResults(results, query);
        }
    },

    renderSearchResults(items, query) {
        const container = document.getElementById('item-list');
        
        if (items.length === 0) {
            container.innerHTML = `
                <div class="card">
                    <div class="card-body">
                        <div class="empty-state">
                            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                            </svg>
                            <h3>未找到相关物品</h3>
                            <p>请尝试其他关键词搜索</p>
                        </div>
                    </div>
                </div>
            `;
            return;
        }

        let html = `<p style="margin-bottom: 16px; color: #64748b;">找到 ${items.length} 个相关结果</p>`;
        
        items.forEach(item => {
            const typeLabel = item.type === 'lost' ? '失物' : '拾物';
            const tagClass = item.type === 'lost' ? 'tag-lost' : 'tag-found';
            const categoryName = Utils.getCategoryName(item.category);
            const timeAgo = Utils.formatTime(item.time || item.createTime);

            html += `
                <div class="card" style="margin-bottom: 16px; cursor: pointer;" onclick="viewItemDetail('${item.type}', '${item.id}')">
                    <div class="card-body">
                        <div style="margin-bottom: 8px;">
                            <span class="tag ${tagClass}">${typeLabel}</span>
                            <span class="tag tag-category">${categoryName}</span>
                        </div>
                        <h4 style="font-weight: 600; margin-bottom: 8px;">${this.highlightText(item.title, query)}</h4>
                        <p style="color: #64748b; font-size: 14px; margin-bottom: 4px;">
                            📍 ${this.highlightText(item.location, query)}
                        </p>
                        <p style="color: #64748b; font-size: 14px;">
                            ${this.highlightText(Utils.truncate(item.description, 80), query)}
                        </p>
                        <p style="color: #94a3b8; font-size: 12px; margin-top: 8px;">
                            ${item.userName} · ${timeAgo}
                        </p>
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;
    },

    highlightText(text, query) {
        if (!query) return text;
        const regex = new RegExp(`(${query})`, 'gi');
        return text.replace(regex, '<span style="background: #fef3c7; color: #d97706;">$1</span>');
    },

    initImageUploads() {
        this.lostImages = [];
        this.foundImages = [];
        this.postImages = [];
    },

    async handleImageUpload(e, type) {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        try {
            const images = await Utils.processImageFiles(files);
            
            let targetArray;
            let previewId;
            
            switch (type) {
                case 'lost':
                    targetArray = this.lostImages;
                    previewId = 'lost-image-preview';
                    break;
                case 'found':
                    targetArray = this.foundImages;
                    previewId = 'found-image-preview';
                    break;
                case 'post':
                    targetArray = this.postImages;
                    previewId = 'post-image-preview';
                    break;
            }

            images.forEach(img => targetArray.push(img));
            this.renderImagePreview(previewId, targetArray, type);
            Utils.showToast(`已添加 ${images.length} 张图片`, 'success');
        } catch (error) {
            Utils.showToast('图片上传失败', 'error');
        }
    },

    renderImagePreview(containerId, images, type) {
        const container = document.getElementById(containerId);
        if (!container) return;

        let html = '';
        images.forEach((img, index) => {
            html += `
                <div class="image-preview-item">
                    <img src="${img.data}" alt="预览">
                    <button class="remove" onclick="App.removeImage('${type}', ${index})">×</button>
                </div>
            `;
        });
        container.innerHTML = html;
    },

    removeImage(type, index) {
        let targetArray;
        let previewId;
        
        switch (type) {
            case 'lost':
                targetArray = this.lostImages;
                previewId = 'lost-image-preview';
                break;
            case 'found':
                targetArray = this.foundImages;
                previewId = 'found-image-preview';
                break;
            case 'post':
                targetArray = this.postImages;
                previewId = 'post-image-preview';
                break;
        }

        targetArray.splice(index, 1);
        this.renderImagePreview(previewId, targetArray, type);
    },

    async submitLostItem() {
        const user = DB.getCurrentUser();
        if (!user) {
            Utils.showToast('请先登录', 'error');
            return;
        }

        const location = document.getElementById('lost-location').value;
        const mockCoords = Utils.getMockLocation(location);

        const item = {
            userId: user.id,
            userName: user.name,
            title: document.getElementById('lost-title').value,
            category: document.getElementById('lost-category').value,
            location: location,
            locationLat: mockCoords.lat,
            locationLng: mockCoords.lng,
            time: new Date(document.getElementById('lost-time').value).getTime(),
            description: document.getElementById('lost-description').value,
            features: this.extractFeatures(document.getElementById('lost-description').value),
            images: this.lostImages.map(img => img.data),
            question: document.getElementById('lost-question').value,
            answer: document.getElementById('lost-answer').value
        };

        if (!item.title || !item.category || !item.location || !item.time || !item.description) {
            Utils.showToast('请填写必填项', 'error');
            return;
        }

        if (this.editingItem) {
            const existingItem = DB.getLostItemById(this.editingItem.id);
            if (existingItem) {
                item.id = existingItem.id;
                item.createTime = existingItem.createTime;
                item.status = existingItem.status;
                item.matchedId = existingItem.matchedId;
                item.city = existingItem.city;
                if (item.images.length === 0) {
                    item.images = existingItem.images;
                }
            }
        }

        const savedItem = DB.saveLostItem(item);
        
        if (this.editingItem) {
            Utils.showToast('失物信息更新成功！', 'success');
        } else {
            Utils.showToast('失物信息发布成功！', 'success');
        }
        
        document.getElementById('lostItemForm').reset();
        this.lostImages = [];
        document.getElementById('lost-image-preview').innerHTML = '';
        this.editingItem = null;
        
        this.navigateTo('list');
    },

    async submitFoundItem() {
        const user = DB.getCurrentUser();
        if (!user) {
            Utils.showToast('请先登录', 'error');
            return;
        }

        const location = document.getElementById('found-location').value;
        const mockCoords = Utils.getMockLocation(location);
        const documentType = document.getElementById('found-document-type').value;
        const documentNumber = document.getElementById('found-document-number').value;

        const item = {
            userId: user.id,
            userName: user.name,
            title: document.getElementById('found-title').value,
            category: document.getElementById('found-category').value,
            location: location,
            locationLat: mockCoords.lat,
            locationLng: mockCoords.lng,
            time: new Date(document.getElementById('found-time').value).getTime(),
            description: document.getElementById('found-description').value,
            features: this.extractFeatures(document.getElementById('found-description').value),
            images: this.foundImages.map(img => img.data),
            question: document.getElementById('found-question').value,
            answer: document.getElementById('found-answer').value,
            documentType: documentType || null,
            documentNumber: documentNumber || null,
            maskedDescription: PrivacyManager.maskDescriptionForFound(document.getElementById('found-description').value),
            verifiedClaimants: []
        };

        if (documentNumber && documentType) {
            const typeInfo = PrivacyManager.getDocumentTypeInfo(documentType);
            if (typeInfo) {
                item.maskedDocumentNumber = PrivacyManager[typeInfo.maskMethod](documentNumber);
            }
        }

        if (!item.title || !item.category || !item.location || !item.time || !item.description) {
            Utils.showToast('请填写必填项', 'error');
            return;
        }

        if (this.editingItem) {
            const existingItem = DB.getFoundItemById(this.editingItem.id);
            if (existingItem) {
                item.id = existingItem.id;
                item.createTime = existingItem.createTime;
                item.status = existingItem.status;
                item.matchedId = existingItem.matchedId;
                item.city = existingItem.city;
                item.verifiedClaimants = existingItem.verifiedClaimants || [];
                item.maskedDocumentNumber = existingItem.maskedDocumentNumber;
                if (item.images.length === 0) {
                    item.images = existingItem.images;
                }
            }
        }

        const savedItem = DB.saveFoundItem(item);
        
        if (this.editingItem) {
            Utils.showToast('拾物信息更新成功！', 'success');
        } else {
            Utils.showToast('拾物信息发布成功！系统已自动保护隐私信息', 'success');
        }
        
        document.getElementById('foundItemForm').reset();
        this.foundImages = [];
        document.getElementById('found-image-preview').innerHTML = '';
        this.editingItem = null;
        
        this.navigateTo('list');
    },

    extractFeatures(text) {
        if (!text) return [];
        const keywords = Utils.extractKeywords(text);
        return keywords.slice(0, 5);
    },

    initHeatmap() {
        const container = document.getElementById('heatmap-container');
        if (!container) return;

        if (this.heatmap) {
            try {
                this.heatmap.remove();
            } catch (e) {
                console.log('Map remove error:', e);
            }
            this.heatmap = null;
        }

        const currentCity = DB.getCurrentCity();
        const cityInfo = DB.getCityInfo(currentCity);

        setTimeout(() => {
            if (!document.getElementById('heatmap-container')) return;
            
            this.heatmap = L.map('heatmap-container').setView([cityInfo.centerLat, cityInfo.centerLng], 11);

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors'
            }).addTo(this.heatmap);

            const heatmapData = DB.getHeatmapData(currentCity);
            
            if (heatmapData.length > 0) {
                L.heatLayer(heatmapData, {
                    radius: 35,
                    blur: 15,
                    maxZoom: 17,
                    gradient: {
                        0.4: 'blue',
                        0.6: 'cyan',
                        0.7: 'lime',
                        0.8: 'yellow',
                        1.0: 'red'
                    }
                }).addTo(this.heatmap);
            }

            const hotspotNames = Object.keys(cityInfo.hotspots);
            if (hotspotNames.length > 0) {
                const firstHotspot = hotspotNames[0];
                const coords = cityInfo.hotspots[firstHotspot];
                L.circleMarker([coords.lat, coords.lng], {
                    radius: 8,
                    fillColor: '#ff0000',
                    color: '#000',
                    weight: 1,
                    opacity: 1,
                    fillOpacity: 0.8
                }).addTo(this.heatmap).bindTooltip(`${firstHotspot} - 高风险区域`);
            }

            this.heatmap.invalidateSize();
        }, 100);
    },

    loadPosts() {
        const container = document.getElementById('posts-container');
        const posts = DB.getPosts();

        if (posts.length === 0) {
            container.innerHTML = `
                <div class="card">
                    <div class="card-body">
                        <div class="empty-state">
                            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z"></path>
                            </svg>
                            <h3>暂无帖子</h3>
                            <p>快来分享你的故事吧</p>
                        </div>
                    </div>
                </div>
            `;
            return;
        }

        let html = '';
        const currentUser = DB.getCurrentUser();

        posts.forEach(post => {
            const timeAgo = Utils.formatTime(post.createTime);
            const typeIcon = Utils.getPostTypeIcon(post.type);
            const hasLiked = currentUser ? DB.hasUserLiked(post.id, currentUser.id) : false;
            const comments = DB.getCommentsByPostId(post.id);
            const likes = DB.getLikesByPostId ? DB.getLikesByPostId(post.id) : post.likes;
            const likesCount = Array.isArray(likes) ? likes.length : likes;

            html += `
                <div class="post-card">
                    <div class="post-header">
                        <div class="post-avatar">${post.userAvatar || post.userName.charAt(0)}</div>
                        <div class="post-user-info">
                            <div class="post-username">${post.userName}</div>
                            <div class="post-time">${typeIcon} ${Utils.getPostTypeName(post.type)} · ${timeAgo}</div>
                        </div>
                        ${post.canGeneratePoster ? `
                            <button class="btn btn-secondary" style="padding: 6px 12px; font-size: 12px;" onclick="generatePoster('${post.id}')">📱 生成海报</button>
                        ` : ''}
                    </div>
                    <div class="post-content">
                        ${post.title ? `<h4 style="font-weight: 600; margin-bottom: 8px; font-size: 16px;">${post.title}</h4>` : ''}
                        <p class="post-text">${post.content.replace(/\n/g, '<br>')}</p>
                        ${post.images && post.images.length > 0 ? `
                            <div class="post-images">
                                ${post.images.map(img => `<img src="${img}" alt="帖子图片">`).join('')}
                            </div>
                        ` : ''}
                    </div>
                    <div class="post-actions">
                        <div class="post-action" onclick="togglePostLike('${post.id}')">
                            <svg fill="${hasLiked ? 'currentColor' : 'none'}" stroke="currentColor" viewBox="0 0 24 24" style="color: ${hasLiked ? '#ef4444' : 'inherit'};">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path>
                            </svg>
                            <span>${likesCount}</span>
                        </div>
                        <div class="post-action" onclick="toggleComments('${post.id}')">
                            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path>
                            </svg>
                            <span>${comments.length}</span>
                        </div>
                        <div class="post-action" onclick="sharePost('${post.id}')">
                            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"></path>
                            </svg>
                            <span>${post.shares}</span>
                        </div>
                    </div>
                    <div class="comments-section" id="comments-${post.id}" style="display: none;">
                        ${comments.length > 0 ? comments.map(comment => `
                            <div class="comment">
                                <span class="comment-user">${comment.userName}:</span>
                                <span class="comment-text">${comment.content}</span>
                            </div>
                        `).join('') : '<p style="color: #94a3b8; font-size: 14px; text-align: center;">暂无评论</p>'}
                        <div class="comment-input">
                            <input type="text" placeholder="写下你的评论..." id="comment-input-${post.id}">
                            <button onclick="submitComment('${post.id}')">发送</button>
                        </div>
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;
    },

    populatePostRelatedItems() {
        const select = document.getElementById('post-related-item');
        if (!select) return;

        const lostItems = DB.getLostItems();
        const foundItems = DB.getFoundItems();

        let options = '<option value="">不关联</option>';
        options += '<optgroup label="失物">';
        lostItems.forEach(item => {
            options += `<option value="lost|${item.id}">📌 ${item.title}</option>`;
        });
        options += '</optgroup>';
        options += '<optgroup label="拾物">';
        foundItems.forEach(item => {
            options += `<option value="found|${item.id}">📍 ${item.title}</option>`;
        });
        options += '</optgroup>';

        select.innerHTML = options;
    }
};

function navigateTo(page) {
    App.navigateTo(page);
}

function viewItemDetail(type, id) {
    let item;
    if (type === 'lost') {
        item = DB.getLostItemById(id);
    } else {
        item = DB.getFoundItemById(id);
        const user = DB.getCurrentUser();
        const isVerified = user && item.verifiedClaimants?.includes(user.id);
        item = PrivacyManager.processFoundItemForDisplay(item, isVerified);
    }

    if (!item) {
        Utils.showToast('物品不存在', 'error');
        return;
    }

    const container = document.getElementById('detail-content');
    const typeLabel = type === 'lost' ? '失物' : '拾物';
    const tagClass = type === 'lost' ? 'tag-lost' : 'tag-found';
    const categoryName = Utils.getCategoryName(item.category);
    const timeAgo = Utils.formatTime(item.time || item.createTime);
    const statusClass = Utils.getStatusClass(item.status);
    const statusName = Utils.getStatusName(item.status);
    const formattedTime = Utils.formatDate(item.time || item.createTime);

    const user = DB.getCurrentUser();
    const isOwner = user && item.userId === user.id;
    const canClaim = type === 'found' && !isOwner && item.status === 'matched';
    const canVerify = item.question && item.answer && type === 'found' && !isOwner;

    let html = `
        <div class="card">
            <div class="card-header">
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px;">
                    <div>
                        <span class="tag ${tagClass}">${typeLabel}</span>
                        <span class="tag tag-category">${categoryName}</span>
                    </div>
                    <span class="status-badge ${statusClass}">${statusName}</span>
                </div>
                <h2 style="font-weight: 700; font-size: 24px; margin-bottom: 8px;">${item.title}</h2>
                <p style="color: #64748b; font-size: 14px;">
                    发布者：${item.userName} · ${timeAgo}
                </p>
            </div>
            <div class="card-body">
                ${item.images && item.images.length > 0 ? `
                    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 12px; margin-bottom: 20px;">
                        ${item.images.map(img => `
                            <div style="border-radius: 12px; overflow: hidden; aspect-ratio: 1;">
                                <img src="${img}" alt="物品图片" style="width: 100%; height: 100%; object-fit: cover;">
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
                
                <div style="margin-bottom: 20px;">
                    <h4 style="font-weight: 600; margin-bottom: 12px; color: #1f2937;">📋 物品详情</h4>
                    <div style="background: #f8f9fa; border-radius: 12px; padding: 16px;">
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px;">
                            <div>
                                <span style="color: #64748b; font-size: 14px;">${type === 'lost' ? '丢失' : '捡到'}时间</span>
                                <p style="font-weight: 600; margin-top: 4px;">${formattedTime}</p>
                            </div>
                            <div>
                                <span style="color: #64748b; font-size: 14px;">${type === 'lost' ? '丢失' : '捡到'}地点</span>
                                <p style="font-weight: 600; margin-top: 4px;">📍 ${item.location}</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div style="margin-bottom: 20px;">
                    <h4 style="font-weight: 600; margin-bottom: 12px; color: #1f2937;">📝 详细描述</h4>
                    <p style="color: #374151; line-height: 1.8; white-space: pre-wrap;">${item.description}</p>
                </div>

                ${item.features && item.features.length > 0 ? `
                    <div style="margin-bottom: 20px;">
                        <h4 style="font-weight: 600; margin-bottom: 12px; color: #1f2937;">🏷️ 特征标签</h4>
                        <div>
                            ${item.features.map(f => `<span class="tag" style="background: #f1f5f9; color: #475569; padding: 8px 16px;">${f}</span>`).join('')}
                        </div>
                    </div>
                ` : ''}

                ${item.documentType ? `
                    <div style="margin-bottom: 20px; background: #fef3c7; border-radius: 12px; padding: 16px;">
                        <h4 style="font-weight: 600; margin-bottom: 8px; color: #d97706;">🆔 证件信息（已保护）</h4>
                        <p style="color: #92400e; margin-bottom: 4px;">证件类型：${PrivacyManager.getDocumentTypeInfo(item.documentType)?.name || item.documentType}</p>
                        <p style="color: #92400e; font-family: 'Courier New', monospace;">
                            证件号码：<span class="masked-text">${item.maskedDocumentNumber || item.documentNumber}</span>
                        </p>
                        <p style="color: #b45309; font-size: 12px; margin-top: 8px;">💡 敏感信息已打码保护，需通过验证才能查看完整信息</p>
                    </div>
                ` : ''}

                ${item.matchedId ? `
                    <div style="margin-bottom: 20px; background: #dbeafe; border-radius: 12px; padding: 16px;">
                        <h4 style="font-weight: 600; margin-bottom: 8px; color: #1d4ed8;">🔗 匹配信息</h4>
                        <p style="color: #1e40af; font-size: 14px;">该物品已与其他物品匹配，正在等待认领验证或交接</p>
                        <button class="btn btn-primary" style="margin-top: 12px;" onclick="viewMatchDetails('${item.matchedId}')">查看匹配详情</button>
                    </div>
                ` : ''}

                ${canVerify && !isOwner ? `
                    <div class="verification-question" style="margin-bottom: 20px;">
                        <h4>🔐 认领验证</h4>
                        <p style="color: #92400e; margin-bottom: 12px;">请回答以下问题以验证您是物品的失主：</p>
                        <p style="font-weight: 600; margin-bottom: 12px;">❓ ${item.question}</p>
                        <input type="text" id="verify-answer-${id}" placeholder="请输入您的答案" style="width: 100%; padding: 12px; border: 2px solid #fbbf24; border-radius: 12px; margin-bottom: 12px;">
                        <button class="btn btn-primary" style="width: 100%;" onclick="verifyClaim('${id}', '${item.answer}')">验证身份</button>
                    </div>
                ` : ''}

                <div style="display: flex; gap: 12px; margin-top: 24px;">
                    <button class="btn btn-secondary" style="flex: 1;" onclick="navigateTo('list')">返回列表</button>
                    ${isOwner && item.status === 'pending' ? `
                        <button class="btn btn-warning" style="flex: 1;" onclick="editItem('${type}', '${id}')">✏️ 编辑</button>
                    ` : ''}
                    ${!isOwner && type === 'found' ? `
                        <button class="btn btn-primary" style="flex: 1;" onclick="contactUser('${item.userId}', '${item.userName}', '${item.title}')">联系发布者</button>
                    ` : ''}
                    ${isOwner && item.status === 'matched' ? `
                        <button class="btn btn-success" style="flex: 1;" onclick="startHandover('${type}', '${id}')">安排交接</button>
                    ` : ''}
                </div>
            </div>
        </div>
    `;

    container.innerHTML = html;
    navigateTo('detail');
}

function editItem(type, id) {
    let item;
    if (type === 'lost') {
        item = DB.getLostItemById(id);
    } else {
        item = DB.getFoundItemById(id);
    }

    if (!item) {
        Utils.showToast('物品不存在', 'error');
        return;
    }

    App.editingItem = { type, id };

    if (type === 'lost') {
        document.getElementById('lost-title').value = item.title || '';
        document.getElementById('lost-category').value = item.category || '';
        document.getElementById('lost-location').value = item.location || '';
        document.getElementById('lost-location-lat').value = item.locationLat || '';
        document.getElementById('lost-location-lng').value = item.locationLng || '';
        document.getElementById('lost-time').value = Utils.formatDateForInput(item.time || item.createTime);
        document.getElementById('lost-description').value = item.description || '';
        document.getElementById('lost-question').value = item.question || '';
        document.getElementById('lost-answer').value = item.answer || '';
        App.lostImages = (item.images || []).map(data => ({ data }));
        App.renderImagePreview('lost-image-preview', App.lostImages, 'lost');
        navigateTo('lost');
    } else {
        document.getElementById('found-title').value = item.title || '';
        document.getElementById('found-category').value = item.category || '';
        document.getElementById('found-location').value = item.location || '';
        document.getElementById('found-location-lat').value = item.locationLat || '';
        document.getElementById('found-location-lng').value = item.locationLng || '';
        document.getElementById('found-time').value = Utils.formatDateForInput(item.time || item.createTime);
        document.getElementById('found-description').value = item.description || '';
        document.getElementById('found-question').value = item.question || '';
        document.getElementById('found-answer').value = item.answer || '';
        document.getElementById('found-document-type').value = item.documentType || '';
        document.getElementById('found-document-number').value = item.documentNumber || '';
        App.foundImages = (item.images || []).map(data => ({ data }));
        App.renderImagePreview('found-image-preview', App.foundImages, 'found');
        navigateTo('found');
    }

    Utils.showToast('请修改信息后提交', 'info');
}

function verifyClaim(itemId, correctAnswer) {
    const userAnswer = document.getElementById(`verify-answer-${itemId}`).value.trim();
    
    if (!userAnswer) {
        Utils.showToast('请输入答案', 'error');
        return;
    }

    if (userAnswer.toLowerCase() === correctAnswer.toLowerCase()) {
        const user = DB.getCurrentUser();
        const item = DB.getFoundItemById(itemId);
        
        if (item && user) {
            if (!item.verifiedClaimants) {
                item.verifiedClaimants = [];
            }
            if (!item.verifiedClaimants.includes(user.id)) {
                item.verifiedClaimants.push(user.id);
            }
            DB.saveFoundItem(item);
        }

        Utils.showToast('✅ 验证通过！您现在可以查看完整信息并联系拾主', 'success');
        
        setTimeout(() => {
            viewItemDetail('found', itemId);
        }, 1000);
    } else {
        Utils.showToast('❌ 答案不正确，请重试', 'error');
    }
}

function contactUser(userId, userName, itemTitle) {
    Utils.showToast(`💬 已向 ${userName} 发送关于「${itemTitle}」的联系请求，请等待对方回复`, 'info');
}

function togglePostLike(postId) {
    const currentUser = DB.getCurrentUser();
    if (!currentUser) {
        Utils.showToast('请先登录', 'error');
        return;
    }

    DB.toggleLike(postId, currentUser.id);
    App.loadPosts();
}

function toggleComments(postId) {
    const commentsSection = document.getElementById(`comments-${postId}`);
    if (commentsSection) {
        if (commentsSection.style.display === 'none') {
            commentsSection.style.display = 'block';
        } else {
            commentsSection.style.display = 'none';
        }
    }
}

function submitComment(postId) {
    const input = document.getElementById(`comment-input-${postId}`);
    const content = input.value.trim();
    
    if (!content) {
        Utils.showToast('请输入评论内容', 'error');
        return;
    }

    const currentUser = DB.getCurrentUser();
    if (!currentUser) {
        Utils.showToast('请先登录', 'error');
        return;
    }

    DB.saveComment({
        postId,
        userId: currentUser.id,
        userName: currentUser.name,
        content
    });

    input.value = '';
    Utils.showToast('评论发布成功', 'success');
    App.loadPosts();
    
    setTimeout(() => {
        const commentsSection = document.getElementById(`comments-${postId}`);
        if (commentsSection) {
            commentsSection.style.display = 'block';
        }
    }, 100);
}

function sharePost(postId) {
    const posts = DB.getPosts();
    const post = posts.find(p => p.id === postId);
    if (post) {
        post.shares += 1;
        DB.savePost(post);
        
        const shareText = `【${post.title}】\n${post.content.substring(0, 100)}${post.content.length > 100 ? '...' : ''}\n\n来自「失物招领与证件找回系统」`;
        
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(shareText).then(() => {
                Utils.showToast('📤 分享内容已复制到剪贴板', 'success');
            }).catch(() => {
                Utils.showToast('📤 分享链接已复制到剪贴板', 'success');
            });
        } else {
            const textArea = document.createElement('textarea');
            textArea.value = shareText;
            textArea.style.position = 'fixed';
            textArea.style.opacity = '0';
            document.body.appendChild(textArea);
            textArea.select();
            try {
                document.execCommand('copy');
                Utils.showToast('📤 分享内容已复制到剪贴板', 'success');
            } catch (e) {
                Utils.showToast('📤 分享链接已复制到剪贴板', 'success');
            }
            document.body.removeChild(textArea);
        }
        
        App.loadPosts();
    }
}

function openPostModal() {
    App.postImages = [];
    document.getElementById('post-image-preview').innerHTML = '';
    document.getElementById('postForm').reset();
    App.populatePostRelatedItems();
    Utils.openModal('post-modal');
}

function submitPost() {
    const currentUser = DB.getCurrentUser();
    if (!currentUser) {
        Utils.showToast('请先登录', 'error');
        return;
    }

    const type = document.getElementById('post-type').value;
    const title = document.getElementById('post-title').value;
    const content = document.getElementById('post-content').value;
    const relatedItem = document.getElementById('post-related-item').value;

    if (!content) {
        Utils.showToast('请填写帖子内容', 'error');
        return;
    }

    const post = {
        userId: currentUser.id,
        userName: currentUser.name,
        userAvatar: currentUser.avatar,
        type,
        title,
        content,
        images: App.postImages.map(img => img.data),
        relatedItemId: relatedItem || null,
        canGeneratePoster: type === 'found_story'
    };

    DB.savePost(post);
    Utils.showToast('帖子发布成功！', 'success');
    Utils.closeModal('post-modal');
    App.loadPosts();
}

function showPublishOptions() {
    Utils.openModal('publish-options-modal');
}

function startHandover(itemType, itemId) {
    let item, otherItem, match;
    
    if (itemType === 'lost') {
        item = DB.getLostItemById(itemId);
        if (item.matchedId) {
            match = DB.getMatchById(item.matchedId);
            if (match) {
                otherItem = DB.getFoundItemById(match.foundItemId);
            }
        }
    } else {
        item = DB.getFoundItemById(itemId);
        if (item.matchedId) {
            match = DB.getMatchById(item.matchedId);
            if (match) {
                otherItem = DB.getLostItemById(match.lostItemId);
            }
        }
    }

    if (!match || !otherItem) {
        Utils.showToast('该物品尚未匹配，无法安排交接', 'error');
        return;
    }

    const existingHandover = DB.getHandoverByMatchId(match.id);
    
    const content = document.getElementById('handover-content');
    const currentUser = DB.getCurrentUser();
    
    let html = `
        <div style="margin-bottom: 20px;">
            <h4 style="font-weight: 600; margin-bottom: 12px;">📋 交接信息</h4>
            <div style="background: #f8f9fa; border-radius: 12px; padding: 16px; margin-bottom: 16px;">
                <div style="margin-bottom: 12px;">
                    <span style="color: #64748b; font-size: 14px;">失物信息</span>
                    <p style="font-weight: 600; margin-top: 4px;">${otherItem.title}</p>
                    <p style="color: #64748b; font-size: 14px;">失主：${otherItem.userName}</p>
                </div>
                <div>
                    <span style="color: #64748b; font-size: 14px;">拾物信息</span>
                    <p style="font-weight: 600; margin-top: 4px;">${item.title}</p>
                    <p style="color: #64748b; font-size: 14px;">拾主：${item.userName}</p>
                </div>
            </div>
        </div>
    `;

    if (existingHandover) {
        html += `
            <div class="handover-info">
                <h4>📍 约定交接地点</h4>
                <p>${existingHandover.location}</p>
                <h4 style="margin-top: 12px;">⏰ 约定时间</h4>
                <p>${Utils.formatDate(existingHandover.scheduledTime)}</p>
                <h4 style="margin-top: 12px;">📊 交接状态</h4>
                <p>
                    ${existingHandover.confirmByLostUser ? '✅ 失主已确认' : '⏳ 等待失主确认'}
                    <br>
                    ${existingHandover.confirmByFoundUser ? '✅ 拾主已确认' : '⏳ 等待拾主确认'}
                </p>
            </div>
            <div class="handover-map" id="handover-map"></div>
            <p class="map-screenshot-hint">💡 提示：可以使用截图工具保存交接地图信息</p>
        `;

        if (existingHandover.status !== 'completed') {
            html += `
                <div style="margin-top: 20px; display: flex; gap: 12px;">
                    ${!existingHandover.confirmByLostUser && itemType === 'lost' ? `
                        <button class="btn btn-success" style="flex: 1;" onclick="confirmHandover('${existingHandover.id}', 'lost')">确认交接完成</button>
                    ` : ''}
                    ${!existingHandover.confirmByFoundUser && itemType === 'found' ? `
                        <button class="btn btn-success" style="flex: 1;" onclick="confirmHandover('${existingHandover.id}', 'found')">确认交接完成</button>
                    ` : ''}
                </div>
            `;
        } else {
            html += `
                <div style="margin-top: 20px; background: #dcfce7; border-radius: 12px; padding: 16px; text-align: center;">
                    <span style="color: #16a34a; font-weight: 600; font-size: 18px;">✅ 交接已完成</span>
                    <p style="color: #15803d; margin-top: 8px;">物品已成功归还失主</p>
                </div>
            `;
        }
    } else {
        html += `
            <div class="input-group">
                <label>交接地点 *</label>
                <input type="text" id="handover-location" placeholder="如：北京市朝阳区国贸地铁站服务中心" value="${item.location}">
            </div>
            <div class="input-group">
                <label>交接时间 *</label>
                <input type="datetime-local" id="handover-time">
            </div>
            <div style="background: #f0f9ff; border-radius: 12px; padding: 16px; margin-top: 16px;">
                <p style="color: #0369a1; font-size: 14px; line-height: 1.6;">
                    💡 交接建议：<br>
                    • 选择公共场所进行交接<br>
                    • 建议在地铁站、商场服务中心等有监控的地方<br>
                    • 交接时请核对物品信息<br>
                    • 建议双方都在场时确认交接
                </p>
            </div>
            <div style="margin-top: 20px; display: flex; gap: 12px;">
                <button class="btn btn-secondary" style="flex: 1;" onclick="closeModal('handover-modal')">取消</button>
                <button class="btn btn-primary" style="flex: 1;" onclick="scheduleHandover('${match.id}', '${itemType}', '${itemId}')">约定交接</button>
            </div>
        `;
    }

    content.innerHTML = html;
    Utils.openModal('handover-modal');

    if (existingHandover) {
        setTimeout(() => {
            const mapContainer = document.getElementById('handover-map');
            if (mapContainer) {
                const handoverMap = L.map('handover-map').setView([existingHandover.locationLat || 39.908765, existingHandover.locationLng || 116.400000], 14);
                
                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    attribution: '© OpenStreetMap'
                }).addTo(handoverMap);

                L.marker([existingHandover.locationLat || 39.908765, existingHandover.locationLng || 116.400000]).addTo(handoverMap)
                    .bindPopup(`📍 ${existingHandover.location}`).openPopup();
            }
        }, 100);
    }
}

function scheduleHandover(matchId, itemType, itemId) {
    const location = document.getElementById('handover-location').value;
    const time = document.getElementById('handover-time').value;

    if (!location || !time) {
        Utils.showToast('请填写交接地点和时间', 'error');
        return;
    }

    const mockCoords = Utils.getMockLocation(location);
    const match = DB.getMatchById(matchId);

    const handover = {
        matchId,
        lostItemId: match.lostItemId,
        foundItemId: match.foundItemId,
        lostUserId: DB.getLostItemById(match.lostItemId).userId,
        foundUserId: DB.getFoundItemById(match.foundItemId).userId,
        location,
        locationLat: mockCoords.lat,
        locationLng: mockCoords.lng,
        scheduledTime: new Date(time).getTime(),
        status: 'scheduled',
        confirmByLostUser: false,
        confirmByFoundUser: false
    };

    DB.saveHandover(handover);
    
    match.status = 'handover_scheduled';
    DB.saveMatch(match);

    Utils.showToast('✅ 交接已约定！请按时前往约定地点', 'success');
    Utils.closeModal('handover-modal');
    
    setTimeout(() => {
        startHandover(itemType, itemId);
    }, 500);
}

function confirmHandover(handoverId, userType) {
    const handover = DB.getHandoverById(handoverId);
    if (!handover) return;

    if (userType === 'lost') {
        handover.confirmByLostUser = true;
    } else {
        handover.confirmByFoundUser = true;
    }

    if (handover.confirmByLostUser && handover.confirmByFoundUser) {
        handover.status = 'completed';
        handover.actualTime = Date.now();

        const match = DB.getMatchById(handover.matchId);
        if (match) {
            match.status = 'completed';
            DB.saveMatch(match);
        }

        const lostItem = DB.getLostItemById(handover.lostItemId);
        const foundItem = DB.getFoundItemById(handover.foundItemId);
        
        if (lostItem) {
            lostItem.status = 'completed';
            DB.saveLostItem(lostItem);
        }
        if (foundItem) {
            foundItem.status = 'completed';
            DB.saveFoundItem(foundItem);
        }
    }

    DB.saveHandover(handover);

    if (handover.status === 'completed') {
        Utils.showToast('🎉 恭喜！交接已完成，物品已成功归还', 'success');
    } else {
        Utils.showToast('✅ 您已确认，请等待对方确认', 'success');
    }

    Utils.closeModal('handover-modal');
    
    setTimeout(() => {
        App.loadStats();
        App.loadLatestItems();
    }, 500);
}

function generatePoster(postId) {
    const posts = DB.getPosts();
    const post = posts.find(p => p.id === postId);
    if (!post) return;

    const modal = document.getElementById('poster-modal');
    modal.classList.add('active');

    setTimeout(() => {
        const canvas = document.getElementById('poster-canvas');
        const ctx = canvas.getContext('2d');
        
        canvas.width = 400;
        canvas.height = 600;

        const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        gradient.addColorStop(0, '#667eea');
        gradient.addColorStop(1, '#764ba2');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = 'white';
        ctx.fillRect(20, 20, canvas.width - 40, canvas.height - 40);

        ctx.fillStyle = '#667eea';
        ctx.font = 'bold 24px -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('🔍 失物招领', canvas.width / 2, 60);

        ctx.fillStyle = '#64748b';
        ctx.font = '14px -apple-system, sans-serif';
        ctx.fillText('让每一件失物都能回家', canvas.width / 2, 85);

        ctx.strokeStyle = '#e5e7eb';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(40, 100);
        ctx.lineTo(canvas.width - 40, 100);
        ctx.stroke();

        const typeIcon = Utils.getPostTypeIcon(post.type);
        ctx.fillStyle = '#1f2937';
        ctx.font = 'bold 18px -apple-system, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(`${typeIcon} ${Utils.getPostTypeName(post.type)}`, 40, 135);

        if (post.title) {
            ctx.fillStyle = '#1f2937';
            ctx.font = 'bold 20px -apple-system, sans-serif';
            const wrappedTitle = wrapText(ctx, post.title, canvas.width - 80, 2);
            wrappedTitle.forEach((line, i) => {
                ctx.fillText(line, 40, 170 + i * 28);
            });
        }

        ctx.fillStyle = '#374151';
        ctx.font = '15px -apple-system, sans-serif';
        const wrappedContent = wrapText(ctx, post.content, canvas.width - 80, 8);
        wrappedContent.forEach((line, i) => {
            ctx.fillText(line, 40, 220 + i * 24);
        });

        ctx.fillStyle = '#f8f9fa';
        ctx.fillRect(40, 440, canvas.width - 80, 100);

        const qrSize = 80;
        const qrX = 60;
        const qrY = 450;
        
        ctx.fillStyle = 'white';
        ctx.fillRect(qrX, qrY, qrSize, qrSize);
        
        ctx.fillStyle = '#1f2937';
        for (let i = 0; i < 20; i++) {
            for (let j = 0; j < 20; j++) {
                if (Math.random() > 0.5 || (i < 3 && j < 3) || (i < 3 && j > 16) || (i > 16 && j < 3)) {
                    ctx.fillRect(qrX + i * 4, qrY + j * 4, 4, 4);
                }
            }
        }

        ctx.fillStyle = '#64748b';
        ctx.font = '13px -apple-system, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('扫码查看详情', qrX + qrSize + 20, qrY + 30);
        ctx.fillText('或搜索小程序', qrX + qrSize + 20, qrY + 50);

        ctx.fillStyle = '#94a3b8';
        ctx.font = '12px -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`发布者: ${post.userName} | ${Utils.formatTime(post.createTime)}`, canvas.width / 2, 560);

        ctx.fillStyle = '#667eea';
        ctx.font = 'bold 14px -apple-system, sans-serif';
        ctx.fillText('❤️ 拾金不昧，传递温暖', canvas.width / 2, 580);

    }, 100);
}

function wrapText(ctx, text, maxWidth, maxLines) {
    const lines = [];
    const paragraphs = text.split('\n');
    
    for (const paragraph of paragraphs) {
        if (lines.length >= maxLines) break;
        
        const words = paragraph.split('');
        let currentLine = '';
        
        for (const word of words) {
            const testLine = currentLine + word;
            const metrics = ctx.measureText(testLine);
            
            if (metrics.width > maxWidth && currentLine !== '') {
                lines.push(currentLine);
                currentLine = word;
                if (lines.length >= maxLines) {
                    currentLine += '...';
                    break;
                }
            } else {
                currentLine = testLine;
            }
        }
        
        if (currentLine && lines.length < maxLines) {
            lines.push(currentLine);
        }
    }
    
    return lines;
}

function downloadPoster() {
    const canvas = document.getElementById('poster-canvas');
    const link = document.createElement('a');
    link.download = '失物招领海报.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
    Utils.showToast('✅ 海报已下载', 'success');
}

function refreshItemList() {
    if (App.currentPage === 'list') {
        App.loadItemList();
    }
    if (App.currentPage === 'home') {
        App.loadLatestItems();
        App.loadStats();
    }
}

function viewMatchDetails(matchId) {
    const details = MatchingEngine.getMatchDetails(matchId);
    if (!details) {
        Utils.showToast('匹配信息不存在', 'error');
        return;
    }

    if (details.lostItem) {
        viewItemDetail('lost', details.lostItem.id);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
