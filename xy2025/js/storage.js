const Storage = {
    KEYS: {
        RELATIONSHIPS: 'sun_relationships',
        TEMPLATES: 'sun_templates',
        AVOID_LIST: 'sun_avoid_list',
        FAVORS: 'sun_favors',
        REMINDERS: 'sun_reminders',
        BATTERY: 'sun_battery',
        BATTERY_LOGS: 'sun_battery_logs',
        BLACKHOLE_PASSWORD: 'sun_blackhole_password',
        BLACKHOLE_POSTS: 'sun_blackhole_posts',
        COMMUNITY_POSTS: 'sun_community_posts',
        COMMUNITY_LIKES: 'sun_community_likes'
    },

    get(key) {
        try {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : null;
        } catch (err) {
            console.error('Storage get error:', err);
            return null;
        }
    },

    set(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (err) {
            console.error('Storage set error:', err);
            return false;
        }
    },

    remove(key) {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (err) {
            console.error('Storage remove error:', err);
            return false;
        }
    },

    getRelationships() {
        return this.get(this.KEYS.RELATIONSHIPS) || [];
    },

    saveRelationships(relationships) {
        return this.set(this.KEYS.RELATIONSHIPS, relationships);
    },

    addRelationship(relationship) {
        const relationships = this.getRelationships();
        relationship.id = Utils.generateId();
        relationship.createdAt = new Date().toISOString();
        relationships.push(relationship);
        this.saveRelationships(relationships);
        return relationship;
    },

    updateRelationship(id, updates) {
        const relationships = this.getRelationships();
        const index = relationships.findIndex(r => r.id === id);
        if (index !== -1) {
            relationships[index] = { ...relationships[index], ...updates, updatedAt: new Date().toISOString() };
            this.saveRelationships(relationships);
            return relationships[index];
        }
        return null;
    },

    deleteRelationship(id) {
        const relationships = this.getRelationships().filter(r => r.id !== id);
        this.saveRelationships(relationships);
    },

    getTemplates() {
        return this.get(this.KEYS.TEMPLATES) || [];
    },

    saveTemplates(templates) {
        return this.set(this.KEYS.TEMPLATES, templates);
    },

    getAvoidList() {
        return this.get(this.KEYS.AVOID_LIST) || [];
    },

    saveAvoidList(avoidList) {
        return this.set(this.KEYS.AVOID_LIST, avoidList);
    },

    addAvoidItem(item) {
        const avoidList = this.getAvoidList();
        item.id = Utils.generateId();
        item.createdAt = new Date().toISOString();
        avoidList.push(item);
        this.saveAvoidList(avoidList);
        return item;
    },

    updateAvoidItem(id, updates) {
        const avoidList = this.getAvoidList();
        const index = avoidList.findIndex(item => item.id === id);
        if (index !== -1) {
            avoidList[index] = { ...avoidList[index], ...updates, updatedAt: new Date().toISOString() };
            this.saveAvoidList(avoidList);
            return avoidList[index];
        }
        return null;
    },

    deleteAvoidItem(id) {
        const avoidList = this.getAvoidList().filter(item => item.id !== id);
        this.saveAvoidList(avoidList);
    },

    getFavors() {
        return this.get(this.KEYS.FAVORS) || [];
    },

    saveFavors(favors) {
        return this.set(this.KEYS.FAVORS, favors);
    },

    addFavor(favor) {
        const favors = this.getFavors();
        favor.id = Utils.generateId();
        favor.createdAt = new Date().toISOString();
        favors.push(favor);
        this.saveFavors(favors);
        return favor;
    },

    updateFavor(id, updates) {
        const favors = this.getFavors();
        const index = favors.findIndex(f => f.id === id);
        if (index !== -1) {
            favors[index] = { ...favors[index], ...updates, updatedAt: new Date().toISOString() };
            this.saveFavors(favors);
            return favors[index];
        }
        return null;
    },

    deleteFavor(id) {
        const favors = this.getFavors().filter(f => f.id !== id);
        this.saveFavors(favors);
    },

    getFavorsStats() {
        const favors = this.getFavors();
        let totalGiven = 0;
        let totalReceived = 0;
        
        favors.forEach(favor => {
            if (favor.type === 'given') {
                totalGiven += parseFloat(favor.amount) || 0;
            } else {
                totalReceived += parseFloat(favor.amount) || 0;
            }
        });
        
        return {
            totalGiven,
            totalReceived,
            netBalance: totalReceived - totalGiven
        };
    },

    getReminders() {
        return this.get(this.KEYS.REMINDERS) || [];
    },

    saveReminders(reminders) {
        return this.set(this.KEYS.REMINDERS, reminders);
    },

    addReminder(reminder) {
        const reminders = this.getReminders();
        reminder.id = Utils.generateId();
        reminder.createdAt = new Date().toISOString();
        reminders.push(reminder);
        this.saveReminders(reminders);
        return reminder;
    },

    updateReminder(id, updates) {
        const reminders = this.getReminders();
        const index = reminders.findIndex(r => r.id === id);
        if (index !== -1) {
            reminders[index] = { ...reminders[index], ...updates, updatedAt: new Date().toISOString() };
            this.saveReminders(reminders);
            return reminders[index];
        }
        return null;
    },

    deleteReminder(id) {
        const reminders = this.getReminders().filter(r => r.id !== id);
        this.saveReminders(reminders);
    },

    getUpcomingReminders(daysAhead = 7) {
        const reminders = this.getReminders();
        const now = new Date();
        
        return reminders
            .filter(reminder => {
                const reminderDate = new Date(reminder.date);
                const diffDays = Utils.getDaysUntil(reminder.date);
                return diffDays >= 0 && diffDays <= daysAhead;
            })
            .sort((a, b) => new Date(a.date) - new Date(b.date));
    },

    getTodayReminders() {
        const reminders = this.getReminders();
        const today = Utils.formatDate(new Date());
        
        return reminders.filter(reminder => {
            const reminderDate = Utils.formatDate(new Date(reminder.date));
            return reminderDate === today;
        });
    },

    getBattery() {
        return this.get(this.KEYS.BATTERY) || 100;
    },

    saveBattery(value) {
        const clampedValue = Math.max(0, Math.min(100, value));
        return this.set(this.KEYS.BATTERY, clampedValue);
    },

    updateBattery(action, amount) {
        let current = this.getBattery();
        if (action === 'consume') {
            current -= amount;
        } else {
            current += amount;
        }
        const newValue = Math.max(0, Math.min(100, current));
        this.saveBattery(newValue);
        
        const log = {
            id: Utils.generateId(),
            action,
            amount,
            newValue,
            timestamp: new Date().toISOString()
        };
        
        this.addBatteryLog(log);
        return newValue;
    },

    getBatteryLogs() {
        return this.get(this.KEYS.BATTERY_LOGS) || [];
    },

    saveBatteryLogs(logs) {
        return this.set(this.KEYS.BATTERY_LOGS, logs);
    },

    addBatteryLog(log) {
        const logs = this.getBatteryLogs();
        logs.unshift(log);
        if (logs.length > 50) {
            logs.splice(50);
        }
        this.saveBatteryLogs(logs);
    },

    getBlackholePassword() {
        return this.get(this.KEYS.BLACKHOLE_PASSWORD);
    },

    setBlackholePassword(password) {
        return this.set(this.KEYS.BLACKHOLE_PASSWORD, password);
    },

    hasBlackholePassword() {
        return this.getBlackholePassword() !== null;
    },

    verifyBlackholePassword(password) {
        const savedPassword = this.getBlackholePassword();
        return savedPassword === password;
    },

    getBlackholePosts() {
        return this.get(this.KEYS.BLACKHOLE_POSTS) || [];
    },

    saveBlackholePosts(posts) {
        return this.set(this.KEYS.BLACKHOLE_POSTS, posts);
    },

    addBlackholePost(post) {
        const posts = this.getBlackholePosts();
        post.id = Utils.generateId();
        post.createdAt = new Date().toISOString();
        posts.unshift(post);
        this.saveBlackholePosts(posts);
        return post;
    },

    updateBlackholePost(id, updates) {
        const posts = this.getBlackholePosts();
        const index = posts.findIndex(p => p.id === id);
        if (index !== -1) {
            posts[index] = { ...posts[index], ...updates, updatedAt: new Date().toISOString() };
            this.saveBlackholePosts(posts);
            return posts[index];
        }
        return null;
    },

    deleteBlackholePost(id) {
        const posts = this.getBlackholePosts().filter(p => p.id !== id);
        this.saveBlackholePosts(posts);
    },

    getCommunityPosts() {
        return this.get(this.KEYS.COMMUNITY_POSTS) || [];
    },

    saveCommunityPosts(posts) {
        return this.set(this.KEYS.COMMUNITY_POSTS, posts);
    },

    addCommunityPost(post) {
        const posts = this.getCommunityPosts();
        post.id = Utils.generateId();
        post.createdAt = new Date().toISOString();
        post.likes = 0;
        post.comments = [];
        posts.unshift(post);
        this.saveCommunityPosts(posts);
        return post;
    },

    likeCommunityPost(postId) {
        const posts = this.getCommunityPosts();
        const likes = this.getCommunityLikes();
        
        const index = posts.findIndex(p => p.id === postId);
        if (index !== -1) {
            if (!likes.includes(postId)) {
                posts[index].likes = (posts[index].likes || 0) + 1;
                likes.push(postId);
                this.saveCommunityPosts(posts);
                this.saveCommunityLikes(likes);
                return { liked: true, likes: posts[index].likes };
            }
        }
        return { liked: false, likes: posts[index]?.likes || 0 };
    },

    getCommunityLikes() {
        return this.get(this.KEYS.COMMUNITY_LIKES) || [];
    },

    saveCommunityLikes(likes) {
        return this.set(this.KEYS.COMMUNITY_LIKES, likes);
    },

    addCommunityComment(postId, comment) {
        const posts = this.getCommunityPosts();
        const index = posts.findIndex(p => p.id === postId);
        if (index !== -1) {
            const newComment = {
                id: Utils.generateId(),
                content: comment,
                createdAt: new Date().toISOString()
            };
            posts[index].comments = posts[index].comments || [];
            posts[index].comments.push(newComment);
            this.saveCommunityPosts(posts);
            return newComment;
        }
        return null;
    }
};
