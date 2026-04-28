const CommunityPage = {
    currentSort: 'latest',

    init() {
        this.bindEvents();
    },

    bindEvents() {
        document.getElementById('addCommunityPostBtn').addEventListener('click', () => {
            this.showAddPostModal();
        });

        document.querySelectorAll('.community-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                this.switchSort(e.target.dataset.sort);
            });
        });
    },

    switchSort(sort) {
        this.currentSort = sort;
        
        document.querySelectorAll('.community-tab').forEach(tab => {
            tab.classList.remove('active');
            if (tab.dataset.sort === sort) {
                tab.classList.add('active');
            }
        });

        this.render();
    },

    render() {
        let posts = Storage.getCommunityPosts();
        const likes = Storage.getCommunityLikes();

        if (this.currentSort === 'hot') {
            posts = [...posts].sort((a, b) => (b.likes || 0) - (a.likes || 0));
        }

        const container = document.getElementById('communityPosts');

        if (posts.length === 0) {
            container.innerHTML = '<p class="empty-state">暂无帖子，点击上方按钮发布</p>';
            return;
        }

        let html = '';
        posts.forEach(post => {
            const isLiked = likes.includes(post.id);
            html += this.renderPostCard(post, isLiked);
        });

        container.innerHTML = html;
        this.bindPostEvents();
    },

    renderPostCard(post, isLiked = false) {
        const commentsHtml = post.comments && post.comments.length > 0 
            ? `
                <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--border-color);">
                    <h4 style="font-size: 13px; color: var(--text-secondary); margin-bottom: 8px;">评论 (${post.comments.length})</h4>
                    ${post.comments.map(comment => `
                        <div style="font-size: 13px; color: var(--text-secondary); padding: 8px 0; border-bottom: 1px solid var(--bg-tertiary);">
                            <span style="color: var(--text-primary);">匿名用户：</span>
                            ${comment.content}
                            <span style="font-size: 11px; color: var(--text-light); margin-left: 8px;">${Utils.formatRelativeTime(comment.createdAt)}</span>
                        </div>
                    `).join('')}
                </div>
            ` : '';

        return `
            <div class="community-post-card" data-id="${post.id}">
                <div class="community-post-header">
                    <div class="post-avatar">${post.avatar || '😶'}</div>
                    <div class="post-author-info">
                        <div class="post-author">${post.author || '匿名用户'}</div>
                        <div class="post-time">${Utils.formatRelativeTime(post.createdAt)}</div>
                    </div>
                </div>
                <div class="post-content">${post.content}</div>
                <div class="post-actions">
                    <div class="post-action ${isLiked ? 'liked' : ''}" data-action="like" data-id="${post.id}">
                        <span>${isLiked ? '❤️' : '🤍'}</span>
                        <span>${post.likes || 0}</span>
                    </div>
                    <div class="post-action" data-action="comment" data-id="${post.id}">
                        <span>💬</span>
                        <span>${(post.comments || []).length}</span>
                    </div>
                    <div class="post-action" data-action="share" data-id="${post.id}">
                        <span>🔗</span>
                        <span>分享</span>
                    </div>
                </div>
                ${commentsHtml}
            </div>
        `;
    },

    bindPostEvents() {
        document.querySelectorAll('.post-action').forEach(action => {
            action.addEventListener('click', (e) => {
                const actionType = e.currentTarget.dataset.action;
                const postId = e.currentTarget.dataset.id;

                switch (actionType) {
                    case 'like':
                        this.likePost(postId);
                        break;
                    case 'comment':
                        this.showCommentModal(postId);
                        break;
                    case 'share':
                        this.sharePost(postId);
                        break;
                }
            });
        });
    },

    showAddPostModal() {
        const content = `
            <div class="form-group">
                <label>昵称（可选）</label>
                <input type="text" class="text-input" id="postAuthor" placeholder="匿名用户">
            </div>
            <div class="form-group">
                <label>内容 *</label>
                <textarea class="textarea-input" id="postContent" placeholder="分享你的社交烦恼..."></textarea>
            </div>
        `;

        Modal.show({
            title: '发布帖子',
            content,
            confirmText: '发布',
            onConfirm: () => {
                const author = document.getElementById('postAuthor').value.trim() || '匿名用户';
                const postContent = document.getElementById('postContent').value.trim();

                if (!postContent) {
                    Toast.error('请输入内容');
                    return false;
                }

                const avatars = ['😊', '😌', '🤔', '😢', '😤', '🥺', '😎', '🤗', '😶', '🙂'];
                const avatar = avatars[Math.floor(Math.random() * avatars.length)];

                Storage.addCommunityPost({
                    author,
                    avatar,
                    content: postContent
                });

                Toast.success('发布成功');
                this.render();
                return true;
            }
        });
    },

    likePost(postId) {
        const result = Storage.likeCommunityPost(postId);
        if (result.liked) {
            Toast.success('点赞成功');
        } else {
            Toast.info('已点赞');
        }
        this.render();
    },

    showCommentModal(postId) {
        const content = `
            <div class="form-group">
                <label>评论内容</label>
                <textarea class="textarea-input" id="commentContent" placeholder="写下你的想法..."></textarea>
            </div>
        `;

        Modal.show({
            title: '发表评论',
            content,
            confirmText: '发布',
            onConfirm: () => {
                const commentContent = document.getElementById('commentContent').value.trim();

                if (!commentContent) {
                    Toast.error('请输入内容');
                    return false;
                }

                Storage.addCommunityComment(postId, commentContent);
                Toast.success('评论成功');
                this.render();
                return true;
            }
        });
    },

    sharePost(postId) {
        const posts = Storage.getCommunityPosts();
        const post = posts.find(p => p.id === postId);
        
        if (post) {
            const shareText = `来自陌生人的社交烦恼：\n${post.content}`;
            
            this.showCopyDialog(shareText);
        }
    },

    showCopyDialog(text) {
        Modal.show({
            title: '分享帖子',
            content: `
                <p style="margin-bottom: 12px; font-size: 13px; color: var(--text-secondary);">点击下方按钮复制分享内容：</p>
                <textarea id="copyDialogText" style="width: 100%; height: 120px; padding: 12px; border: 1px solid var(--border-color); border-radius: var(--radius-sm); font-size: 14px; resize: none; margin-bottom: 12px;">${text}</textarea>
                <button id="copyDialogBtn" class="btn-primary" style="width: 100%; padding: 12px; font-size: 14px;">
                    📋 复制内容
                </button>
            `,
            confirmText: '关闭',
            showCancel: false,
            onConfirm: () => {
            }
        });
        
        setTimeout(() => {
            const copyBtn = document.getElementById('copyDialogBtn');
            const textarea = document.getElementById('copyDialogText');
            
            if (copyBtn && textarea) {
                copyBtn.addEventListener('click', () => {
                    textarea.select();
                    textarea.setSelectionRange(0, textarea.value.length);
                    
                    try {
                        const successful = document.execCommand('copy');
                        if (successful) {
                            Toast.success('已复制分享内容');
                        } else {
                            Toast.warning('请手动按 Ctrl+C 复制');
                        }
                    } catch (err) {
                        Toast.warning('请手动按 Ctrl+C 复制');
                    }
                });
            }
        }, 100);
    }
};

document.addEventListener('DOMContentLoaded', () => {
    CommunityPage.init();
});
