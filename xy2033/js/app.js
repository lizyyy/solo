
// 八卦大王应用主逻辑

const App = {
    currentPage: 'home',
    currentTopicId: null,
    currentStackId: null,
    pageHistory: [],

    // 初始化应用
    init: function() {
        // 初始化数据
        Storage.initAppData();
        
        // 应用主题
        this.applyTheme();
        
        // 渲染初始数据
        this.renderTopics();
        this.renderUserInfo();
        this.renderFriends();
        this.renderRanking();
        this.renderComplaintStacks();
        this.renderProfile();
        
        // 绑定事件
        this.bindEvents();
    },

    // 绑定所有事件
    bindEvents: function() {
        // 底部导航
        document.querySelectorAll('.nav-item').forEach(btn => {
            btn.addEventListener('click', () => {
                this.navigateTo(btn.dataset.page);
            });
        });

        // 排序按钮
        document.querySelectorAll('.sort-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.sortTopics(btn.dataset.sort);
            });
        });

        // 主题切换按钮
        document.getElementById('themeToggle').addEventListener('click', () => {
            this.toggleTheme();
        });

        document.getElementById('theme-switch-light').addEventListener('click', () => {
            this.setTheme('light');
        });

        document.getElementById('theme-switch-dark').addEventListener('click', () => {
            this.setTheme('dark');
        });

        // 提交评论
        if (document.getElementById('submit-comment-btn')) {
            document.getElementById('submit-comment-btn').addEventListener('click', () => {
                this.submitComment();
            });
        }

        // 创建吐槽栈
        document.getElementById('create-stack-btn').addEventListener('click', () => {
            this.createComplaintStack();
        });

        // 添加吐槽层
        document.getElementById('add-layer-btn').addEventListener('click', () => {
            this.addComplaintLayer();
        });

        // 关闭吐槽大王模态框
        document.getElementById('close-king-modal').addEventListener('click', () => {
            this.closeComplaintKingModal();
        });

        // 大转盘
        document.getElementById('start-lottery-btn').addEventListener('click', () => {
            this.openLotteryModal();
        });

        document.getElementById('spin-wheel-btn').addEventListener('click', () => {
            this.spinWheel();
        });

        // 清除缓存
        document.getElementById('clear-cache-btn').addEventListener('click', () => {
            if (confirm('确定要清除所有数据吗？')) {
                this.clearCache();
            }
        });

        // 好友页面标签页切换
        document.querySelectorAll('.friends-tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.switchFriendsTab(btn.dataset.tab);
            });
        });
    },

    // 页面导航
    navigateTo: function(page, addToHistory = true) {
        if (addToHistory && this.currentPage !== 'topic-detail') {
            this.pageHistory.push(this.currentPage);
        }

        // 隐藏所有页面
        document.querySelectorAll('.page').forEach(p => {
            p.classList.remove('active');
        });

        // 显示目标页面
        const targetPage = document.getElementById(`${page}-page`);
        if (targetPage) {
            targetPage.classList.add('active');
        }

        // 更新底部导航状态
        document.querySelectorAll('.nav-item').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.page === page);
        });

        this.currentPage = page;

        // 页面切换时的额外渲染
        if (page === 'home') {
            this.renderTopics();
        } else if (page === 'ranking') {
            this.renderRanking();
        } else if (page === 'profile') {
            this.renderProfile();
        } else if (page === 'friends') {
            // 切换到消息标签
            this.switchFriendsTab('messages');
        } else if (page === 'complaint') {
            this.renderComplaintStacks();
        }
    },

    // 返回上一页
    goBack: function() {
        if (this.pageHistory.length > 0) {
            const previousPage = this.pageHistory.pop();
            this.navigateTo(previousPage, false);
        } else {
            this.navigateTo('home', false);
        }
    },

    // 渲染话题列表
    renderTopics: function() {
        const container = document.getElementById('topics-container');
        const topics = Storage.getTopicsByHeat();

        container.innerHTML = topics.map((topic, index) => `
            <div class="topic-card" data-id="${topic.id}" onclick="App.openTopicDetail(${topic.id})">
                <div class="topic-header">
                    <h3 class="topic-title">
                        ${index < 3 ? `<span class="topic-heat">🔥 热门</span>` : ''}
                        ${topic.title}
                    </h3>
                    <span class="topic-category">${topic.category}</span>
                </div>
                <div class="topic-stats">
                    <span class="topic-stat">👁️ ${this.formatNumber(topic.viewCount)}</span>
                    <span class="topic-stat">❤️ ${this.formatNumber(topic.likeCount)}</span>
                    <span class="topic-stat">💬 ${this.formatNumber(topic.commentCount)}</span>
                </div>
            </div>
        `).join('');
    },

    // 排序话题
    sortTopics: function(sortType) {
        // 更新排序按钮状态
        document.querySelectorAll('.sort-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.sort === sortType);
        });

        const container = document.getElementById('topics-container');
        let topics = Storage.get('topics') || [];

        switch(sortType) {
            case 'heat':
                topics.sort((a, b) => b.heatScore - a.heatScore);
                break;
            case 'new':
                // 按ID倒序（模拟最新）
                topics.sort((a, b) => b.id - a.id);
                break;
            case 'comment':
                topics.sort((a, b) => b.commentCount - a.commentCount);
                break;
        }

        container.innerHTML = topics.map((topic, index) => `
            <div class="topic-card" data-id="${topic.id}" onclick="App.openTopicDetail(${topic.id})">
                <div class="topic-header">
                    <h3 class="topic-title">
                        ${sortType === 'heat' && index < 3 ? `<span class="topic-heat">🔥 热门</span>` : ''}
                        ${topic.title}
                    </h3>
                    <span class="topic-category">${topic.category}</span>
                </div>
                <div class="topic-stats">
                    <span class="topic-stat">👁️ ${this.formatNumber(topic.viewCount)}</span>
                    <span class="topic-stat">❤️ ${this.formatNumber(topic.likeCount)}</span>
                    <span class="topic-stat">💬 ${this.formatNumber(topic.commentCount)}</span>
                </div>
            </div>
        `).join('');
    },

    // 打开话题详情
    openTopicDetail: function(topicId) {
        const topic = Storage.getTopicById(topicId);
        const comments = Storage.getTopicComments(topicId);
        const currentUser = Storage.get('currentUser');

        // 记录参与，获得5积分
        const updatedUser = Storage.joinTopic(topicId);
        this.renderUserInfo();

        this.currentTopicId = topicId;
        this.navigateTo('topic-detail');

        const container = document.getElementById('topic-detail-content');
        const isLiked = currentUser.likedTopics.includes(topicId);
        const isCollected = currentUser.collectedTopics.includes(topicId);

        container.innerHTML = `
            <div class="detail-header">
                <h2 class="detail-title">${topic.title}</h2>
                <div class="detail-meta">
                    <span class="topic-category">${topic.category}</span>
                    <span>👁️ ${this.formatNumber(topic.viewCount)} 浏览</span>
                    <span>❤️ ${this.formatNumber(topic.likeCount)} 点赞</span>
                    <span>💬 ${this.formatNumber(topic.commentCount)} 评论</span>
                </div>
            </div>
            
            <div class="detail-actions">
                <button class="action-btn ${isLiked ? 'liked' : ''}" onclick="App.toggleTopicLike(${topicId})">
                    ${isLiked ? '❤️' : '🤍'} ${isLiked ? '已点赞' : '点赞'}
                </button>
                <button class="action-btn ${isCollected ? 'collected' : ''}" onclick="App.toggleTopicCollect(${topicId})">
                    ${isCollected ? '⭐' : '☆'} ${isCollected ? '已收藏' : '收藏'}
                </button>
                <button class="action-btn" onclick="App.shareTopic(${topicId})">
                    📤 分享
                </button>
            </div>
            
            <div class="comments-section">
                <h3 class="comments-header">💬 评论区 (${comments.length})</h3>
                
                <div class="comment-input-area">
                    <textarea id="comment-input" placeholder="说出你的想法..."></textarea>
                    <button class="btn-primary" onclick="App.submitComment()">发表评论</button>
                </div>
                
                <div class="comments-list">
                    ${comments.map(comment => `
                        <div class="comment-card" data-id="${comment.id}">
                            <div class="comment-header">
                                <span class="comment-avatar">${comment.avatar}</span>
                                <div class="comment-user-info">
                                    <div class="comment-user-name">${comment.userName}</div>
                                    <div class="comment-time">${comment.time}</div>
                                </div>
                            </div>
                            <div class="comment-content">${comment.content}</div>
                            <div class="comment-actions">
                                <button class="comment-action" onclick="App.toggleCommentLike(${topicId}, '${comment.id}', true)">
                                    👍 ${comment.likeCount}
                                </button>
                                <button class="comment-action" onclick="App.toggleCommentLike(${topicId}, '${comment.id}', false)">
                                    👎 ${comment.dislikeCount}
                                </button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    },

    // 点赞话题
    toggleTopicLike: function(topicId) {
        const currentUser = Storage.toggleTopicLike(topicId);
        this.renderUserInfo();
        
        // 重新渲染话题详情
        this.openTopicDetail(topicId);
        
        this.showToast('操作成功！');
    },

    // 收藏话题
    toggleTopicCollect: function(topicId) {
        const currentUser = Storage.toggleTopicCollect(topicId);
        this.renderUserInfo();
        
        // 重新渲染话题详情
        this.openTopicDetail(topicId);
        
        this.showToast('操作成功！');
    },

    // 分享话题
    shareTopic: function(topicId) {
        const topic = Storage.getTopicById(topicId);
        
        // 模拟分享功能
        if (navigator.share) {
            navigator.share({
                title: '八卦大王',
                text: topic.title,
                url: window.location.href
            });
        } else {
            // 复制链接
            this.copyToClipboard(window.location.href + '?topic=' + topicId);
            this.showToast('链接已复制到剪贴板！');
        }
    },

    // 提交评论
    submitComment: function() {
        const input = document.getElementById('comment-input');
        if (!input) return;
        
        const content = input.value.trim();
        
        if (!content) {
            this.showToast('请输入评论内容！');
            return;
        }
        
        const currentUser = Storage.get('currentUser');
        const comment = {
            id: `c_${this.currentTopicId}_${Date.now()}`,
            userId: currentUser.id,
            userName: currentUser.name,
            avatar: currentUser.avatar,
            content: content,
            likeCount: 0,
            dislikeCount: 0,
            time: '刚刚'
        };
        
        Storage.addComment(this.currentTopicId, comment);
        input.value = '';
        
        // 发表评论获得积分奖励（每次加5分）
        Storage.addScore(5);
        
        // 重新渲染
        this.openTopicDetail(this.currentTopicId);
        this.renderUserInfo();
        this.showToast('评论发布成功！获得 5 积分');
    },

    // 点赞/不喜欢评论
    toggleCommentLike: function(topicId, commentId, isLike) {
        Storage.toggleCommentLike(topicId, commentId, isLike);
        this.openTopicDetail(topicId);
    },

    // 渲染用户信息（顶部积分等）
    renderUserInfo: function() {
        const currentUser = Storage.get('currentUser');
        const scoreElement = document.querySelector('.score-value');
        if (scoreElement) {
            scoreElement.textContent = this.formatNumber(currentUser.score);
        }
    },

    // 渲染吐槽叠叠乐
    renderComplaintStacks: function() {
        const stacksData = Storage.get('complaintStacks');
        const container = document.getElementById('stacks-container');
        const currentLayersElement = document.getElementById('current-layers');
        const layersRemainingElement = document.getElementById('layers-remaining');

        if (currentLayersElement) {
            currentLayersElement.textContent = stacksData.totalLayers;
        }
        
        const remaining = Math.max(0, 15 - stacksData.totalLayers);
        if (layersRemainingElement) {
            layersRemainingElement.textContent = remaining;
        }

        if (stacksData.stacks.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>还没有吐槽栈，快来创建第一个吧！</p>
                </div>
            `;
            return;
        }

        container.innerHTML = stacksData.stacks.map(stack => `
            <div class="stack-card" onclick="App.openStackDetail('${stack.id}')">
                <div class="stack-card-header">
                    <h3 class="stack-card-title">${stack.title}</h3>
                    <span class="stack-card-layers">${stack.layerCount} 层</span>
                </div>
            </div>
        `).join('');
    },

    // 创建吐槽栈
    createComplaintStack: function() {
        const input = document.getElementById('new-stack-title');
        const title = input.value.trim();
        
        if (!title) {
            this.showToast('请输入吐槽主题！');
            return;
        }
        
        const newStack = Storage.createComplaintStack(title);
        input.value = '';
        
        this.renderComplaintStacks();
        this.openStackDetail(newStack.id);
        this.showToast('吐槽栈创建成功！');
    },

    // 打开吐槽栈详情
    openStackDetail: function(stackId) {
        this.currentStackId = stackId;
        const stacksData = Storage.get('complaintStacks');
        const stack = stacksData.stacks.find(s => s.id === stackId);
        
        if (!stack) return;

        // 显示详情区域
        const detailContainer = document.getElementById('stack-detail');
        const stacksContainer = document.getElementById('stacks-container');
        const newComplaintForm = document.querySelector('.new-complaint-form');
        
        detailContainer.classList.remove('hidden');
        stacksContainer.classList.add('hidden');
        newComplaintForm.classList.add('hidden');

        // 渲染标题
        document.getElementById('stack-title').textContent = stack.title;

        // 渲染吐槽层
        this.renderTower(stack);
    },

    // 关闭吐槽栈详情
    closeStackDetail: function() {
        const detailContainer = document.getElementById('stack-detail');
        const stacksContainer = document.getElementById('stacks-container');
        const newComplaintForm = document.querySelector('.new-complaint-form');
        
        detailContainer.classList.add('hidden');
        stacksContainer.classList.remove('hidden');
        newComplaintForm.classList.remove('hidden');
        
        this.currentStackId = null;
    },

    // 渲染吐槽塔
    renderTower: function(stack) {
        const tower = document.getElementById('tower');
        
        if (stack.layers.length === 0) {
            tower.innerHTML = `
                <div class="empty-tower">
                    <p>还没有吐槽层，快来添加第一层吧！</p>
                </div>
            `;
            return;
        }

        tower.innerHTML = stack.layers.map((layer, index) => `
            <div class="tower-layer" style="animation-delay: ${index * 0.1}s">
                <div class="layer-number">#${index + 1}</div>
                <div class="layer-content">${layer.content}</div>
                <div class="layer-user">${layer.avatar} ${layer.userName}</div>
            </div>
        `).join('');

        // 滚动到底部
        const towerContainer = tower.parentElement;
        towerContainer.scrollTop = towerContainer.scrollHeight;
    },

    // 添加吐槽层
    addComplaintLayer: function() {
        const input = document.getElementById('layer-content');
        const content = input.value.trim();
        
        if (!content) {
            this.showToast('请输入吐槽内容！');
            return;
        }
        
        const stacksData = Storage.addComplaintLayer(this.currentStackId, content);
        const stack = stacksData.stacks.find(s => s.id === this.currentStackId);
        
        input.value = '';
        
        // 更新显示
        this.renderTower(stack);
        this.renderComplaintStacks();
        
        // 检查是否达到15层
        if (stacksData.totalLayers >= 15 && !Storage.get('complaintKingShown')) {
            Storage.set('complaintKingShown', true);
            this.showComplaintKingModal();
        } else {
            const remaining = Math.max(0, 15 - stacksData.totalLayers);
            if (remaining > 0) {
                this.showToast(`吐槽成功！还差 ${remaining} 层成为吐槽大王！`);
            }
        }
    },

    // 显示吐槽大王动画
    showComplaintKingModal: function() {
        document.getElementById('complaint-king-modal').classList.remove('hidden');
    },

    // 关闭吐槽大王模态框
    closeComplaintKingModal: function() {
        document.getElementById('complaint-king-modal').classList.add('hidden');
    },

    // 渲染好友列表
    renderFriends: function() {
        const friends = Storage.get('friends');
        const currentUser = Storage.get('currentUser');
        const container = document.getElementById('friends-container');

        container.innerHTML = friends.map(friend => {
            const isMyFriend = currentUser.friends.includes(friend.id);
            return `
                <div class="friend-card" onclick="App.openFriendDetail('${friend.id}')">
                    <span class="friend-avatar">${friend.avatar}</span>
                    <div class="friend-info">
                        <div class="friend-name">${friend.name}</div>
                        <div class="friend-tags">
                            ${friend.tags.map(tag => `<span class="friend-tag">${tag}</span>`).join('')}
                        </div>
                    </div>
                    <span class="friend-status ${friend.status}">${friend.status === 'online' ? '在线' : '离线'}</span>
                </div>
            `;
        }).join('');
    },

    // 打开好友详情
    openFriendDetail: function(friendId) {
        const friend = Storage.getFriendInfo(friendId);
        const currentUser = Storage.get('currentUser');
        
        if (!friend) return;

        const modal = document.getElementById('friend-detail-modal');
        const nameElement = document.getElementById('friend-detail-name');
        const contentElement = document.getElementById('friend-detail-content');
        
        const isMyFriend = currentUser.friends.includes(friendId);
        
        nameElement.textContent = friend.name;
        contentElement.innerHTML = `
            <div class="friend-detail-avatar">${friend.avatar}</div>
            <div class="friend-detail-tags">
                ${friend.tags.map(tag => `<span class="profile-tag">${tag}</span>`).join('')}
            </div>
            <div class="friend-detail-bio">${friend.bio}</div>
            <div class="friend-detail-status">
                <span class="friend-status ${friend.status}">${friend.status === 'online' ? '🟢 在线' : '⚫ 离线'}</span>
            </div>
            <div class="friend-actions">
                ${isMyFriend ? 
                    `<button class="btn-secondary" disabled>✓ 已添加好友</button>` :
                    `<button class="btn-primary" onclick="App.addFriend('${friendId}')">➕ 添加好友</button>`
                }
                <button class="btn-primary" onclick="App.startChatWithFriend('${friendId}')">💬 发消息</button>
            </div>
        `;
        
        modal.classList.remove('hidden');
    },

    // 关闭好友详情
    closeFriendModal: function() {
        document.getElementById('friend-detail-modal').classList.add('hidden');
    },

    // 添加好友
    addFriend: function(friendId) {
        Storage.addFriend(friendId);
        this.showToast('添加好友成功！');
        this.closeFriendModal();
        this.renderFriends();
        this.renderProfile();
    },

    // 渲染排行榜
    renderRanking: function() {
        const rankings = Storage.get('rankings');
        const currentUser = Storage.get('currentUser');
        
        // 更新前三名
        if (rankings.length >= 1) {
            document.getElementById('top1-name').textContent = rankings[0].name;
            document.getElementById('top1-score').textContent = `${this.formatNumber(rankings[0].score)} 分`;
        }
        
        if (rankings.length >= 2) {
            document.getElementById('top2-name').textContent = rankings[1].name;
            document.getElementById('top2-score').textContent = `${this.formatNumber(rankings[1].score)} 分`;
        }
        
        if (rankings.length >= 3) {
            document.getElementById('top3-name').textContent = rankings[2].name;
            document.getElementById('top3-score').textContent = `${this.formatNumber(rankings[2].score)} 分`;
        }

        // 渲染完整列表（从第4名开始）
        const listContainer = document.getElementById('ranking-list');
        listContainer.innerHTML = rankings.slice(3).map((user, index) => `
            <div class="ranking-item">
                <span class="ranking-item-number">${index + 4}</span>
                <span class="ranking-item-avatar">${user.avatar}</span>
                <div class="ranking-item-info">
                    <div class="ranking-item-name">${user.name}</div>
                </div>
                <span class="ranking-item-score">${this.formatNumber(user.score)} 分</span>
            </div>
        `).join('');

        // 计算当前用户排名
        const userScore = currentUser.score;
        let userRank = -1;
        
        // 模拟：把用户插入排行榜计算
        const allRankings = [...rankings];
        const userInRanking = {
            rank: 0,
            userId: currentUser.id,
            name: currentUser.name,
            avatar: currentUser.avatar,
            score: userScore,
            tags: currentUser.tags
        };
        allRankings.push(userInRanking);
        allRankings.sort((a, b) => b.score - a.score);
        
        userRank = allRankings.findIndex(u => u.userId === currentUser.id) + 1;
        
        document.getElementById('my-rank').textContent = userRank > 0 ? `第 ${userRank} 名` : '未上榜';
        document.getElementById('my-score').textContent = `${this.formatNumber(userScore)} 分`;

        // 更新抽奖按钮状态
        const lotteryBtn = document.getElementById('start-lottery-btn');
        if (userRank > 0 && userRank <= 3) {
            lotteryBtn.disabled = false;
            lotteryBtn.textContent = '🎰 大转盘抽奖（点击开始）';
        } else {
            lotteryBtn.disabled = true;
            lotteryBtn.textContent = '🎰 大转盘抽奖（需进入前三名）';
        }
    },

    // 打开大转盘
    openLotteryModal: function() {
        document.getElementById('lottery-modal').classList.remove('hidden');
    },

    // 关闭大转盘
    closeLotteryModal: function() {
        document.getElementById('lottery-modal').classList.add('hidden');
        document.getElementById('lottery-result').classList.add('hidden');
    },

    // 转动转盘
    spinWheel: function() {
        const wheel = document.getElementById('wheel');
        const spinBtn = document.getElementById('spin-wheel-btn');
        const resultDiv = document.getElementById('lottery-result');
        const prizeText = document.getElementById('prize-text');

        // 禁用按钮
        spinBtn.disabled = true;
        resultDiv.classList.add('hidden');

        // 奖品列表
        const prizes = [
            '💰 100积分',
            '🎁 神秘礼品',
            '⭐ 50积分',
            '🎉 谢谢参与',
            '💎 200积分',
            '🏅 专属勋章',
            '📝 会员体验',
            '🎯 再来一次'
        ];

        // 随机选择一个奖品
        const randomIndex = Math.floor(Math.random() * prizes.length);
        const prize = prizes[randomIndex];

        // 计算旋转角度（360度为一圈，每45度一个奖品）
        const segmentAngle = 360 / 8;
        const targetAngle = randomIndex * segmentAngle;
        const totalRotation = 360 * 5 + (360 - targetAngle - segmentAngle / 2);

        // 应用旋转
        wheel.style.transform = `rotate(${totalRotation}deg)`;

        // 等待动画完成
        setTimeout(() => {
            // 显示结果
            prizeText.textContent = prize;
            resultDiv.classList.remove('hidden');
            spinBtn.disabled = false;

            // 如果是积分奖品，添加积分
            if (prize.includes('100积分')) {
                Storage.addScore(100);
            } else if (prize.includes('50积分')) {
                Storage.addScore(50);
            } else if (prize.includes('200积分')) {
                Storage.addScore(200);
            }
            
            this.renderUserInfo();
            this.renderProfile();
            this.showToast(`恭喜获得：${prize}`);
        }, 4500);
    },

    // 渲染个人中心
    renderProfile: function() {
        const currentUser = Storage.get('currentUser');

        // 基本信息
        document.getElementById('profile-avatar').textContent = currentUser.avatar;
        document.getElementById('profile-name').textContent = currentUser.name;
        document.getElementById('profile-bio').textContent = currentUser.bio;

        // 标签
        document.getElementById('profile-tags').innerHTML = currentUser.tags.map(tag => 
            `<span class="profile-tag">${tag}</span>`
        ).join('');

        // 统计数据
        document.getElementById('stat-score').textContent = this.formatNumber(currentUser.score);
        document.getElementById('stat-likes').textContent = currentUser.likedTopics.length;
        document.getElementById('stat-collections').textContent = currentUser.collectedTopics.length;
        document.getElementById('stat-friends').textContent = currentUser.friends.length;

        // 更新主题按钮状态
        const theme = Storage.get('theme') || 'light';
        document.getElementById('theme-switch-light').classList.toggle('active', theme === 'light');
        document.getElementById('theme-switch-dark').classList.toggle('active', theme === 'dark');
    },

    // 显示个人中心的标签页（点赞/收藏）
    showProfileTab: function(tabName) {
        // 隐藏所有列表
        document.getElementById('profile-likes').classList.add('hidden');
        document.getElementById('profile-collections').classList.add('hidden');

        // 显示目标列表
        const targetList = document.getElementById(`profile-${tabName}`);
        if (targetList) {
            // 切换显示/隐藏
            if (targetList.classList.contains('hidden')) {
                targetList.classList.remove('hidden');
                // 渲染列表
                if (tabName === 'likes') {
                    this.renderLikedTopics();
                } else if (tabName === 'collections') {
                    this.renderCollectedTopics();
                }
            } else {
                targetList.classList.add('hidden');
            }
        }
    },

    // 渲染点赞的话题列表
    renderLikedTopics: function() {
        const currentUser = Storage.get('currentUser');
        const allTopics = Storage.get('topics') || [];
        const container = document.getElementById('likes-container');

        const likedTopics = allTopics.filter(t => currentUser.likedTopics.includes(t.id));

        if (likedTopics.length === 0) {
            container.innerHTML = `
                <div class="profile-empty">
                    <div class="profile-empty-icon">❤️</div>
                    <div class="profile-empty-text">暂无点赞的话题，去首页浏览吧！</div>
                </div>
            `;
            return;
        }

        container.innerHTML = likedTopics.map(topic => `
            <div class="profile-topic-card" onclick="App.openTopicFromProfile(${topic.id})">
                <div class="profile-topic-title">${topic.title}</div>
                <div class="profile-topic-meta">
                    <span>👁️ ${this.formatNumber(topic.viewCount)}</span>
                    <span>❤️ ${this.formatNumber(topic.likeCount)}</span>
                    <span>💬 ${this.formatNumber(topic.commentCount)}</span>
                </div>
            </div>
        `).join('');
    },

    // 渲染收藏的话题列表
    renderCollectedTopics: function() {
        const currentUser = Storage.get('currentUser');
        const allTopics = Storage.get('topics') || [];
        const container = document.getElementById('collections-container');

        const collectedTopics = allTopics.filter(t => currentUser.collectedTopics.includes(t.id));

        if (collectedTopics.length === 0) {
            container.innerHTML = `
                <div class="profile-empty">
                    <div class="profile-empty-icon">📁</div>
                    <div class="profile-empty-text">暂无收藏的话题，去首页浏览吧！</div>
                </div>
            `;
            return;
        }

        container.innerHTML = collectedTopics.map(topic => `
            <div class="profile-topic-card" onclick="App.openTopicFromProfile(${topic.id})">
                <div class="profile-topic-title">${topic.title}</div>
                <div class="profile-topic-meta">
                    <span>👁️ ${this.formatNumber(topic.viewCount)}</span>
                    <span>❤️ ${this.formatNumber(topic.likeCount)}</span>
                    <span>💬 ${this.formatNumber(topic.commentCount)}</span>
                </div>
            </div>
        `).join('');
    },

    // 从个人中心打开话题详情
    openTopicFromProfile: function(topicId) {
        this.openTopicDetail(topicId);
    },

    // 主题切换
    toggleTheme: function() {
        const currentTheme = Storage.get('theme') || 'light';
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        this.setTheme(newTheme);
    },

    setTheme: function(theme) {
        Storage.set('theme', theme);
        this.applyTheme();
        this.renderProfile();
    },

    applyTheme: function() {
        const theme = Storage.get('theme') || 'light';
        document.body.classList.toggle('dark-theme', theme === 'dark');
        
        // 更新主题按钮图标
        const themeBtn = document.getElementById('themeToggle');
        themeBtn.textContent = theme === 'light' ? '🌙' : '☀️';
    },

    // 清除缓存
    clearCache: function() {
        const keys = Object.keys(localStorage).filter(key => key.startsWith(Storage.PREFIX));
        keys.forEach(key => localStorage.removeItem(key));
        
        // 重新初始化
        Storage.initAppData();
        this.init();
        this.showToast('数据已清除！');
    },

    // 工具函数：格式化数字
    formatNumber: function(num) {
        if (num >= 10000) {
            return (num / 10000).toFixed(1) + 'w';
        }
        if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'k';
        }
        return num.toString();
    },

    // 复制到剪贴板
    copyToClipboard: function(text) {
        if (navigator.clipboard) {
            navigator.clipboard.writeText(text);
        } else {
            const textarea = document.createElement('textarea');
            textarea.value = text;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
        }
    },

    // 显示Toast提示
    showToast: function(message) {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.classList.remove('hidden');

        setTimeout(() => {
            toast.classList.add('hidden');
        }, 3000);
    },

    // 切换好友页面标签页
    switchFriendsTab: function(tabName) {
        const tabs = document.querySelectorAll('.friends-tab-btn');
        tabs.forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tab === tabName);
        });

        document.getElementById('messages-tab').classList.toggle('hidden', tabName !== 'messages');
        document.getElementById('friends-tab').classList.toggle('hidden', tabName !== 'friends');

        if (tabName === 'messages') {
            this.renderConversations();
        } else {
            this.renderFriends();
        }
    },

    // 渲染会话列表
    renderConversations: function() {
        const conversations = Storage.getConversations();
        const container = document.getElementById('conversations-container');
        
        const convArray = Object.values(conversations);
        
        if (convArray.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">💬</div>
                    <div class="empty-state-text">暂无消息，去好友列表发起聊天吧！</div>
                </div>
            `;
            return;
        }

        container.innerHTML = convArray.map(conv => {
            const friend = Storage.getFriendInfo(conv.targetUserId);
            if (!friend) return '';
            
            return `
                <div class="conversation-item" onclick="App.openChat('${conv.id}')">
                    <div class="conversation-avatar">
                        ${friend.avatar}
                        <span class="conversation-status-dot ${friend.status}"></span>
                    </div>
                    <div class="conversation-info">
                        <div class="conversation-name">${friend.name}</div>
                        <div class="conversation-last-msg">${conv.lastMessage || '暂无消息'}</div>
                    </div>
                    <div class="conversation-right">
                        <div class="conversation-time">${conv.lastTime || ''}</div>
                        ${conv.unreadCount > 0 ? `<div class="conversation-unread">${conv.unreadCount}</div>` : ''}
                    </div>
                </div>
            `;
        }).join('');
    },

    // 当前聊天会话ID
    currentChatConvId: null,

    // 打开聊天页面
    openChat: function(convId) {
        const conv = Storage.getConversation(convId);
        if (!conv) {
            this.showToast('会话不存在');
            return;
        }

        const friend = Storage.getFriendInfo(conv.targetUserId);
        if (!friend) {
            this.showToast('好友不存在');
            return;
        }

        // 清除未读
        Storage.clearUnread(convId);

        // 保存当前会话ID
        this.currentChatConvId = convId;
        this.previousPage = this.currentPage;

        // 切换页面
        this.navigateTo('chat');

        // 渲染聊天页面
        document.getElementById('chat-friend-name').textContent = friend.name;
        
        const statusEl = document.getElementById('chat-status');
        statusEl.textContent = friend.status === 'online' ? '🟢 在线' : '⚫ 离线';
        statusEl.className = 'chat-status ' + (friend.status === 'online' ? '' : 'offline');

        // 渲染消息
        this.renderChatMessages();
    },

    // 从好友详情发起聊天
    startChatWithFriend: function(friendId) {
        this.closeFriendModal();
        
        // 创建或获取会话
        const conv = Storage.createConversation(friendId);
        this.openChat(conv.id);
    },

    // 渲染聊天消息
    renderChatMessages: function() {
        const conv = Storage.getConversation(this.currentChatConvId);
        if (!conv) return;

        const friend = Storage.getFriendInfo(conv.targetUserId);
        const currentUser = Storage.get('currentUser');
        const container = document.getElementById('chat-messages');

        container.innerHTML = conv.messages.map(msg => {
            const isOwn = msg.from === currentUser.id;
            const avatar = isOwn ? currentUser.avatar : friend.avatar;
            
            return `
                <div class="chat-message ${isOwn ? 'own' : ''}">
                    <div class="chat-msg-avatar">${avatar}</div>
                    <div class="chat-msg-content">
                        <div class="chat-msg-bubble">${msg.content}</div>
                        <div class="chat-msg-time">${msg.time}</div>
                    </div>
                </div>
            `;
        }).join('');

        // 滚动到底部
        container.scrollTop = container.scrollHeight;
    },

    // 发送消息
    sendMessage: function() {
        const input = document.getElementById('chat-input');
        const content = input.value.trim();
        
        if (!content) {
            this.showToast('请输入消息');
            return;
        }

        if (!this.currentChatConvId) {
            this.showToast('会话错误');
            return;
        }

        // 发送消息
        Storage.sendMessage(this.currentChatConvId, content);
        
        // 清空输入
        input.value = '';

        // 重新渲染消息
        this.renderChatMessages();

        // 模拟好友回复
        Storage.simulateFriendReply(this.currentChatConvId);

        // 1-3秒后刷新显示回复
        setTimeout(() => {
            this.renderChatMessages();
        }, 1500 + Math.random() * 1500);
    },

    // 处理回车发送
    handleChatKeypress: function(event) {
        if (event.key === 'Enter') {
            this.sendMessage();
        }
    }
};

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    App.init();
});
