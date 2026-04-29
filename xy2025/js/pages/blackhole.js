const BlackholePage = {
    STORAGE_KEY: 'sun_blackhole_unlocked',

    init() {
        this.bindEvents();
        this.ensureLocked();
    },

    bindEvents() {
        document.getElementById('unlockBlackholeBtn').addEventListener('click', () => {
            this.tryUnlock();
        });

        document.getElementById('setPasswordBtn').addEventListener('click', () => {
            this.showSetPasswordModal();
        });

        document.getElementById('lockBlackholeBtn').addEventListener('click', () => {
            this.lock();
        });

        document.getElementById('addBlackholePostBtn').addEventListener('click', () => {
            if (this.isUnlocked()) {
                this.showAddPostModal();
            } else {
                Toast.warning('请先解锁');
            }
        });

        document.getElementById('blackholePassword').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.tryUnlock();
            }
        });
    },

    isUnlocked() {
        return sessionStorage.getItem(this.STORAGE_KEY) === 'true';
    },

    setUnlocked(value) {
        if (value) {
            sessionStorage.setItem(this.STORAGE_KEY, 'true');
        } else {
            sessionStorage.removeItem(this.STORAGE_KEY);
        }
    },

    ensureLocked() {
        const lockForm = document.getElementById('blackholeLock');
        const content = document.getElementById('blackholeContent');
        
        if (this.isUnlocked()) {
            lockForm.classList.add('hidden');
            content.classList.remove('hidden');
            this.renderPosts();
        } else {
            lockForm.classList.remove('hidden');
            content.classList.add('hidden');
        }
    },

    tryUnlock() {
        const password = document.getElementById('blackholePassword').value;
        
        if (!Storage.hasBlackholePassword()) {
            Toast.warning('请先设置密码');
            return;
        }

        if (Storage.verifyBlackholePassword(password)) {
            this.unlock();
            Toast.success('解锁成功');
        } else {
            Toast.error('密码错误');
        }

        document.getElementById('blackholePassword').value = '';
    },

    showSetPasswordModal() {
        const hasPassword = Storage.hasBlackholePassword();
        
        const content = `
            <div class="form-group">
                <label>${hasPassword ? '原密码' : '设置新密码'}</label>
                <input type="password" class="text-input" id="pwd1" placeholder="${hasPassword ? '请输入原密码' : '请输入新密码'}">
            </div>
            <div class="form-group">
                <label>${hasPassword ? '新密码' : '确认密码'}</label>
                <input type="password" class="text-input" id="pwd2" placeholder="${hasPassword ? '请输入新密码' : '请再次输入密码'}">
            </div>
            ${hasPassword ? `
            <div class="form-group">
                <label>确认新密码</label>
                <input type="password" class="text-input" id="pwd3" placeholder="请再次输入新密码">
            </div>
            ` : ''}
        `;

        Modal.show({
            title: hasPassword ? '修改密码' : '设置密码',
            content,
            confirmText: '确认',
            onConfirm: () => {
                return this.handleSetPassword(hasPassword);
            }
        });
    },

    handleSetPassword(hasPassword) {
        const pwd1 = document.getElementById('pwd1').value;
        const pwd2 = document.getElementById('pwd2').value;
        const pwd3 = hasPassword ? document.getElementById('pwd3')?.value : null;

        if (!pwd1 || !pwd2) {
            Toast.error('请填写完整');
            return false;
        }

        if (hasPassword) {
            if (!Storage.verifyBlackholePassword(pwd1)) {
                Toast.error('原密码错误');
                return false;
            }
            if (pwd2 !== pwd3) {
                Toast.error('两次输入的新密码不一致');
                return false;
            }
        } else {
            if (pwd1 !== pwd2) {
                Toast.error('两次输入的密码不一致');
                return false;
            }
        }

        if (pwd2.length < 4) {
            Toast.error('密码至少4位');
            return false;
        }

        Storage.setBlackholePassword(pwd2);
        Toast.success('密码设置成功');
        return true;
    },

    unlock() {
        this.setUnlocked(true);
        const lockForm = document.getElementById('blackholeLock');
        const content = document.getElementById('blackholeContent');
        
        lockForm.classList.add('hidden');
        content.classList.remove('hidden');
        this.renderPosts();
    },

    lock() {
        this.setUnlocked(false);
        const lockForm = document.getElementById('blackholeLock');
        const content = document.getElementById('blackholeContent');
        
        lockForm.classList.remove('hidden');
        content.classList.add('hidden');
    },

    showAddPostModal() {
        const content = `
            <div class="form-group">
                <label>吐槽内容</label>
                <textarea class="textarea-input" id="blackholePostContent" placeholder="在这里写下你想说的，只有你能看到..."></textarea>
            </div>
        `;

        Modal.show({
            title: '写吐槽',
            content,
            confirmText: '发布',
            onConfirm: () => {
                const postContent = document.getElementById('blackholePostContent').value.trim();
                if (!postContent) {
                    Toast.error('请输入内容');
                    return false;
                }

                Storage.addBlackholePost({
                    content: postContent
                });

                Toast.success('发布成功');
                this.renderPosts();
                return true;
            }
        });
    },

    renderPosts() {
        if (!this.isUnlocked()) {
            return;
        }

        const posts = Storage.getBlackholePosts();
        const container = document.getElementById('blackholePosts');

        if (posts.length === 0) {
            container.innerHTML = '<p class="empty-state">暂无吐槽，点击上方按钮添加</p>';
            return;
        }

        let html = '';
        posts.forEach(post => {
            html += this.renderPostCard(post);
        });

        container.innerHTML = html;
        this.bindPostEvents();
    },

    renderPostCard(post) {
        return `
            <div class="blackhole-post-card" data-id="${post.id}">
                <div class="blackhole-post-header">
                    <span class="blackhole-post-time">${Utils.formatRelativeTime(post.createdAt)}</span>
                </div>
                <div class="blackhole-post-content">${post.content}</div>
                <div class="blackhole-post-actions">
                    <button class="btn-secondary btn-small" data-action="edit" data-id="${post.id}">编辑</button>
                    <button class="btn-delete btn-small" data-action="delete" data-id="${post.id}">删除</button>
                </div>
            </div>
        `;
    },

    bindPostEvents() {
        document.querySelectorAll('.blackhole-post-card button').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const action = e.target.dataset.action;
                const id = e.target.dataset.id;

                switch (action) {
                    case 'edit':
                        this.showEditPostModal(id);
                        break;
                    case 'delete':
                        this.deletePost(id);
                        break;
                }
            });
        });
    },

    showEditPostModal(id) {
        const posts = Storage.getBlackholePosts();
        const post = posts.find(p => p.id === id);
        
        if (!post) return;

        const content = `
            <div class="form-group">
                <label>吐槽内容</label>
                <textarea class="textarea-input" id="editBlackholePostContent">${post.content}</textarea>
            </div>
        `;

        Modal.show({
            title: '编辑吐槽',
            content,
            confirmText: '保存',
            onConfirm: () => {
                const postContent = document.getElementById('editBlackholePostContent').value.trim();
                if (!postContent) {
                    Toast.error('请输入内容');
                    return false;
                }

                Storage.updateBlackholePost(id, {
                    content: postContent
                });

                Toast.success('保存成功');
                this.renderPosts();
                return true;
            }
        });
    },

    deletePost(id) {
        Modal.confirm('确定要删除这条吐槽吗？', () => {
            Storage.deleteBlackholePost(id);
            Toast.success('删除成功');
            this.renderPosts();
        });
    }
};

document.addEventListener('DOMContentLoaded', () => {
    BlackholePage.init();
});
