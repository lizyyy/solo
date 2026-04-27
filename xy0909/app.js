class App {
    constructor() {
        this.sessionManager = new SessionManager();
        this.chatSimulator = new ChatSimulator();
        this.matchingSimulator = new MatchingSimulator();
        this.feedbackGenerator = new EmotionFeedbackGenerator();
        
        this.currentPage = 'home';
        this.sessionData = {
            content: '',
            emotion: null,
            emotionId: null,
            intensity: 5,
            mode: null,
            partner: null,
            chatDuration: 0,
            messageCount: 0,
            rating: null
        };
        
        this.chatTimer = null;
        this.chatStartTime = null;
        this.isMatching = false;
        this.isBreathing = false;
        this.breathingInterval = null;
        
        this.init();
    }

    init() {
        this.renderEmotions();
        this.renderQuickReplies();
        this.bindEvents();
    }

    renderEmotions() {
        const grid = document.getElementById('emotions-grid');
        if (!grid) return;

        grid.innerHTML = AppData.emotions.map(emotion => `
            <div class="emotion-option" data-emotion-id="${emotion.id}">
                <span class="emotion-icon">${emotion.icon}</span>
                <span class="emotion-name">${emotion.name}</span>
            </div>
        `).join('');
    }

    renderQuickReplies() {
        const container = document.getElementById('quick-replies');
        if (!container) return;

        container.innerHTML = AppData.quickReplies.map(reply => `
            <button class="quick-reply-btn">${reply}</button>
        `).join('');
    }

    bindEvents() {
        document.getElementById('worries-textarea')?.addEventListener('input', (e) => {
            this.sessionData.content = e.target.value;
            this.updateCharCount(e.target.value.length);
            this.validateHomeForm();
        });

        document.querySelectorAll('.emotion-option').forEach(option => {
            option.addEventListener('click', () => {
                this.selectEmotion(option.dataset.emotionId);
            });
        });

        document.querySelectorAll('.mode-option').forEach(option => {
            option.addEventListener('click', () => {
                this.selectMode(option.dataset.mode);
            });
        });

        document.getElementById('btn-next')?.addEventListener('click', () => {
            this.goToPage('thermometer');
        });

        document.getElementById('btn-back-home')?.addEventListener('click', () => {
            this.goToPage('home');
        });

        const slider = document.getElementById('thermometer-slider');
        if (slider) {
            slider.addEventListener('input', (e) => {
                this.updateThermometer(parseInt(e.target.value));
            });
        }

        document.getElementById('btn-continue')?.addEventListener('click', () => {
            this.sessionData.intensity = parseInt(document.getElementById('thermometer-slider').value);
            this.goToPage('feedback');
            this.showFeedback();
        });

        document.getElementById('btn-to-shredder')?.addEventListener('click', () => {
            this.goToPage('shredder');
            this.prepareShredder();
        });

        document.getElementById('btn-to-treehole')?.addEventListener('click', () => {
            this.goToPage('treehole-match');
        });

        document.getElementById('btn-back-feedback')?.addEventListener('click', () => {
            this.goToPage('feedback');
        });

        document.getElementById('btn-start-shred')?.addEventListener('click', () => {
            this.startShredding();
        });

        document.getElementById('btn-finish-shred')?.addEventListener('click', () => {
            this.saveSession();
            this.goToPage('complete');
            this.showCompletePage();
        });

        document.getElementById('btn-start-match')?.addEventListener('click', () => {
            this.startMatching();
        });

        document.getElementById('btn-cancel-match')?.addEventListener('click', () => {
            this.cancelMatching();
        });

        document.getElementById('btn-back-feedback2')?.addEventListener('click', () => {
            this.goToPage('feedback');
        });

        document.getElementById('btn-leave-chat')?.addEventListener('click', () => {
            this.leaveChat();
        });

        document.getElementById('btn-send')?.addEventListener('click', () => {
            this.sendMessage();
        });

        document.getElementById('chat-input')?.addEventListener('input', (e) => {
            const btnSend = document.getElementById('btn-send');
            if (btnSend) {
                btnSend.disabled = e.target.value.trim() === '';
            }
        });

        document.getElementById('chat-input')?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        document.querySelectorAll('.quick-reply-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const input = document.getElementById('chat-input');
                if (input) {
                    input.value = btn.textContent;
                    document.getElementById('btn-send').disabled = false;
                    this.sendMessage();
                }
            });
        });

        document.querySelectorAll('#rating-stars .star').forEach(star => {
            star.addEventListener('click', () => {
                this.setRating(parseInt(star.dataset.rating));
            });
        });

        document.getElementById('btn-finish-chat')?.addEventListener('click', () => {
            this.saveSession();
            this.goToPage('complete');
            this.showCompletePage();
        });

        document.getElementById('btn-start-new')?.addEventListener('click', () => {
            this.reset();
            this.goToPage('home');
        });

        document.getElementById('breathing-circle')?.addEventListener('click', () => {
            if (!this.isBreathing) {
                this.startBreathingExercise();
            }
        });
    }

    updateCharCount(count) {
        const charCountEl = document.getElementById('char-count');
        if (charCountEl) {
            charCountEl.textContent = count;
            charCountEl.classList.toggle('warning', count > 450);
        }
    }

    selectEmotion(emotionId) {
        const emotion = AppData.emotions.find(e => e.id === emotionId);
        if (!emotion) return;

        this.sessionData.emotion = emotion.name;
        this.sessionData.emotionId = emotionId;

        document.querySelectorAll('.emotion-option').forEach(opt => {
            opt.classList.toggle('selected', opt.dataset.emotionId === emotionId);
        });

        this.validateHomeForm();
    }

    selectMode(mode) {
        this.sessionData.mode = mode;

        document.querySelectorAll('.mode-option').forEach(opt => {
            opt.classList.toggle('selected', opt.dataset.mode === mode);
        });

        this.validateHomeForm();
    }

    validateHomeForm() {
        const btnNext = document.getElementById('btn-next');
        if (!btnNext) return;

        const hasContent = this.sessionData.content.trim().length > 0;
        const hasEmotion = this.sessionData.emotionId !== null;
        const hasMode = this.sessionData.mode !== null;

        btnNext.disabled = !(hasContent && hasEmotion && hasMode);
    }

    updateThermometer(value) {
        this.sessionData.intensity = value;

        const fill = document.getElementById('thermometer-fill');
        const intensityValue = document.getElementById('intensity-value');
        const intensityLevel = document.getElementById('intensity-level');
        const intensityHint = document.getElementById('intensity-hint');

        if (fill) {
            const percentage = (value / 10) * 100;
            fill.style.height = `${percentage}%`;
            
            if (value >= 6) {
                fill.style.background = 'linear-gradient(to top, #FF3B30, #FF6B6B)';
            } else if (value >= 4) {
                fill.style.background = 'linear-gradient(to top, #FF9500, #FFCC00)';
            } else {
                fill.style.background = 'linear-gradient(to top, #34C759, #5AC8FA)';
            }
        }

        if (intensityValue) {
            intensityValue.textContent = value;
        }

        if (intensityLevel) {
            intensityLevel.textContent = value >= 6 ? '强烈' : (value >= 4 ? '中等' : '轻微');
            intensityLevel.className = `intensity-level ${value >= 6 ? 'high' : value >= 4 ? 'medium' : 'low'}`;
        }

        if (intensityHint) {
            const hint = this.feedbackGenerator.getIntensityHint(value);
            intensityHint.innerHTML = `<p>${hint}</p>`;
        }

        const emotion = AppData.emotions.find(e => e.id === this.sessionData.emotionId);
        if (emotion) {
            document.getElementById('preview-emotion-icon').textContent = emotion.icon;
            document.getElementById('preview-emotion-name').textContent = emotion.name;
        }
    }

    showFeedback() {
        const emotion = AppData.emotions.find(e => e.id === this.sessionData.emotionId);
        const intensity = this.sessionData.intensity;

        if (emotion) {
            document.getElementById('feedback-emotion-icon').textContent = emotion.icon;
            document.getElementById('feedback-emotion-name').textContent = emotion.name;
        }

        document.getElementById('feedback-intensity').textContent = intensity;

        const feedbackType = this.feedbackGenerator.getFeedbackType(intensity);
        const feedbackTitle = this.feedbackGenerator.getFeedbackTitle(intensity);
        const comfortMessage = this.feedbackGenerator.getComfortMessage(
            this.sessionData.emotionId,
            intensity
        );

        document.getElementById('feedback-type').textContent = feedbackTitle;
        document.getElementById('feedback-type').className = `feedback-type ${feedbackType}`;
        document.getElementById('feedback-content').innerHTML = `<p>${comfortMessage}</p>`;

        const breathingGuide = document.getElementById('breathing-guide');
        if (breathingGuide) {
            breathingGuide.style.display = intensity >= 6 ? 'block' : 'none';
        }

        const btnShredder = document.getElementById('btn-to-shredder');
        const btnTreehole = document.getElementById('btn-to-treehole');

        if (this.sessionData.mode === 'shredder') {
            btnShredder.style.display = 'block';
            btnTreehole.style.display = 'none';
        } else {
            btnShredder.style.display = 'none';
            btnTreehole.style.display = 'block';
        }
    }

    async startBreathingExercise() {
        if (this.isBreathing) return;
        this.isBreathing = true;

        const circle = document.getElementById('breathing-circle');
        const text = document.getElementById('breathing-text');
        const instruction = document.getElementById('breathing-instruction');

        const guide = AppData.breathingGuide;
        let currentCycle = 0;
        let currentPhase = 0;

        instruction.textContent = guide.introMessage;

        const runPhase = async () => {
            if (currentCycle >= guide.cycles) {
                this.isBreathing = false;
                text.textContent = '完成';
                instruction.textContent = guide.outroMessage;
                circle.classList.remove('inhaling', 'holding', 'exhaling');
                return;
            }

            const phase = guide.phases[currentPhase];
            text.textContent = phase.text;
            instruction.textContent = phase.instruction;

            circle.classList.remove('inhaling', 'holding', 'exhaling');
            if (phase.text === '吸气') {
                circle.classList.add('inhaling');
            } else if (phase.text === '屏气') {
                circle.classList.add('holding');
            } else {
                circle.classList.add('exhaling');
            }

            await this.delay(phase.duration);

            currentPhase++;
            if (currentPhase >= guide.phases.length) {
                currentPhase = 0;
                currentCycle++;
            }

            runPhase();
        };

        runPhase();
    }

    prepareShredder() {
        const paperContent = document.getElementById('paper-content');
        if (paperContent) {
            paperContent.textContent = this.sessionData.content.substring(0, 200);
        }

        document.getElementById('shred-complete').style.display = 'none';
        document.getElementById('btn-start-shred').style.display = 'block';
        document.getElementById('shredder-status').textContent = '准备就绪';
        document.getElementById('shredded-particles').innerHTML = '';
    }

    async startShredding() {
        const btnStart = document.getElementById('btn-start-shred');
        const status = document.getElementById('shredder-status');
        const paperSlip = document.getElementById('paper-slip');
        const particlesContainer = document.getElementById('shredded-particles');

        btnStart.style.display = 'none';
        status.textContent = '正在粉碎...';

        paperSlip.classList.add('shredding');

        await this.delay(500);

        this.createShreddedParticles(particlesContainer);

        await this.delay(2000);

        status.textContent = '粉碎完成';
        
        const completeSection = document.getElementById('shred-complete');
        completeSection.style.display = 'block';

        const hint = this.feedbackGenerator.getPsychologicalHint();
        document.getElementById('psychological-hint').innerHTML = `<p>💡 ${hint}</p>`;
    }

    createShreddedParticles(container) {
        const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7'];
        
        for (let i = 0; i < 30; i++) {
            const particle = document.createElement('div');
            particle.className = 'particle';
            particle.style.width = `${Math.random() * 15 + 5}px`;
            particle.style.height = `${Math.random() * 15 + 5}px`;
            particle.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
            particle.style.left = `${Math.random() * 100}%`;
            particle.style.animationDelay = `${Math.random() * 1}s`;
            particle.style.animationDuration = `${Math.random() * 1 + 1}s`;
            container.appendChild(particle);
        }
    }

    async startMatching() {
        if (this.isMatching) return;
        this.isMatching = true;

        const btnStart = document.getElementById('btn-start-match');
        const btnCancel = document.getElementById('btn-cancel-match');
        const matchText = document.getElementById('match-text');
        const matchSubtext = document.getElementById('match-subtext');
        const matchingAnimation = document.getElementById('matching-animation');

        btnStart.style.display = 'none';
        btnCancel.style.display = 'block';
        matchingAnimation.classList.add('active');
        matchText.textContent = '正在寻找匹配的倾听者...';
        matchSubtext.textContent = '平均等待时间: 15秒';

        try {
            const result = await this.matchingSimulator.startMatching((step, total) => {
                const progress = (step / total) * 100;
                matchSubtext.textContent = `正在匹配... ${Math.round(progress)}%`;
            });

            if (this.isMatching === false) return;

            if (result.success) {
                this.sessionData.partner = result.partner;
                matchText.textContent = '匹配成功！';
                matchSubtext.textContent = `已连接: ${result.partner.name}`;
                
                await this.delay(1500);
                this.goToPage('treehole-chat');
                this.startChat();
            } else {
                matchText.textContent = result.reason;
                matchSubtext.textContent = '请稍后再试';
                this.resetMatchingUI();
            }
        } catch (error) {
            matchText.textContent = '匹配失败，请重试';
            this.resetMatchingUI();
        }

        this.isMatching = false;
    }

    cancelMatching() {
        this.isMatching = false;
        this.resetMatchingUI();
    }

    resetMatchingUI() {
        const btnStart = document.getElementById('btn-start-match');
        const btnCancel = document.getElementById('btn-cancel-match');
        const matchText = document.getElementById('match-text');
        const matchSubtext = document.getElementById('match-subtext');
        const matchingAnimation = document.getElementById('matching-animation');

        btnStart.style.display = 'block';
        btnCancel.style.display = 'none';
        matchingAnimation.classList.remove('active');
        matchText.textContent = '正在寻找匹配的倾听者...';
        matchSubtext.textContent = '平均等待时间: 15秒';
    }

    startChat() {
        const partner = this.sessionData.partner;
        
        document.getElementById('partner-name').textContent = partner.name;
        document.getElementById('partner-initial').textContent = partner.initial;
        document.getElementById('partner-avatar').style.backgroundColor = partner.color;

        document.getElementById('chat-messages').innerHTML = '';
        this.sessionData.messageCount = 0;

        this.chatStartTime = Date.now();
        this.startChatTimer();

        this.chatSimulator.setEmotion(this.sessionData.emotionId);
        this.chatSimulator.setOriginalContent(this.sessionData.content);

        this.addSystemMessage(`已连接到 ${partner.name}`);
        
        setTimeout(() => {
            const opening = this.chatSimulator.getOpeningByEmotion();
            this.addPartnerMessage(opening);
        }, 1500);
    }

    startChatTimer() {
        const duration = 3 * 60 * 1000;
        const endTime = this.chatStartTime + duration;

        this.chatTimer = setInterval(() => {
            const remaining = endTime - Date.now();
            
            if (remaining <= 0) {
                this.endChat();
                return;
            }

            const minutes = Math.floor(remaining / 60000);
            const seconds = Math.floor((remaining % 60000) / 1000);
            const display = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            
            document.getElementById('timer-display').textContent = display;

            if (remaining < 60000) {
                document.getElementById('chat-timer').classList.add('warning');
            }
        }, 1000);
    }

    async sendMessage() {
        const input = document.getElementById('chat-input');
        const message = input.value.trim();
        
        if (!message) return;

        input.value = '';
        document.getElementById('btn-send').disabled = true;

        this.addUserMessage(message);
        this.sessionData.messageCount++;

        document.getElementById('typing-indicator').style.display = 'flex';

        try {
            const history = this.getChatHistory();
            const response = await this.chatSimulator.simulateResponse(message, history);
            
            document.getElementById('typing-indicator').style.display = 'none';
            this.addPartnerMessage(response);
            this.sessionData.messageCount++;
        } catch (error) {
            document.getElementById('typing-indicator').style.display = 'none';
        }
    }

    addUserMessage(text) {
        this.addMessage('user', text);
    }

    addPartnerMessage(text) {
        this.addMessage('partner', text);
    }

    addSystemMessage(text) {
        const messages = document.getElementById('chat-messages');
        const msgEl = document.createElement('div');
        msgEl.className = 'message system';
        msgEl.innerHTML = `<span>${text}</span>`;
        messages.appendChild(msgEl);
        this.scrollToBottom();
    }

    addMessage(sender, text) {
        const messages = document.getElementById('chat-messages');
        const msgEl = document.createElement('div');
        msgEl.className = `message ${sender}`;
        
        const time = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
        
        msgEl.innerHTML = `
            <div class="message-bubble">
                <p>${this.escapeHtml(text)}</p>
                <span class="message-time">${time}</span>
            </div>
        `;
        
        messages.appendChild(msgEl);
        this.scrollToBottom();
    }

    scrollToBottom() {
        const messages = document.getElementById('chat-messages');
        if (messages) {
            messages.scrollTop = messages.scrollHeight;
        }
    }

    getChatHistory() {
        const messages = document.getElementById('chat-messages');
        const history = [];
        
        messages.querySelectorAll('.message.user, .message.partner').forEach(msg => {
            const sender = msg.classList.contains('user') ? 'user' : 'partner';
            const text = msg.querySelector('p')?.textContent || '';
            history.push({ sender, text });
        });
        
        return history;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    leaveChat() {
        if (confirm('确定要离开聊天吗？对话将阅后即焚。')) {
            this.endChat();
        }
    }

    endChat() {
        if (this.chatTimer) {
            clearInterval(this.chatTimer);
            this.chatTimer = null;
        }

        const endTime = Date.now();
        this.sessionData.chatDuration = Math.floor((endTime - this.chatStartTime) / 1000);

        this.goToPage('chat-end');
        this.showChatEnd();
    }

    showChatEnd() {
        const minutes = Math.floor(this.sessionData.chatDuration / 60);
        const seconds = this.sessionData.chatDuration % 60;
        document.getElementById('summary-duration').textContent = 
            `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        document.getElementById('summary-messages').textContent = this.sessionData.messageCount;
    }

    setRating(rating) {
        this.sessionData.rating = rating;
        
        document.querySelectorAll('#rating-stars .star').forEach((star, index) => {
            star.classList.toggle('active', index < rating);
        });
    }

    saveSession() {
        const session = this.sessionManager.createSession({
            emotion: this.sessionData.emotion,
            emotionId: this.sessionData.emotionId,
            intensity: this.sessionData.intensity,
            mode: this.sessionData.mode,
            content: this.sessionData.content,
            duration: this.sessionData.chatDuration,
            messageCount: this.sessionData.messageCount,
            rating: this.sessionData.rating
        });
        return session;
    }

    showCompletePage() {
        const lastSession = this.sessionManager.getLastSession();
        if (!lastSession) return;

        const recordEl = document.getElementById('session-record');
        const emotion = AppData.emotions.find(e => e.id === lastSession.emotionId);
        
        const modeText = lastSession.mode === 'shredder' ? '粉碎模式' : '匿名树洞';
        const time = new Date(lastSession.createdAt).toLocaleTimeString('zh-CN', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });

        recordEl.innerHTML = `
            <div class="record-item">
                <span class="record-icon">${emotion?.icon || '😊'}</span>
                <div class="record-info">
                    <span class="record-emotion">${lastSession.emotion}</span>
                    <span class="record-detail">强度 ${lastSession.intensity}/10 · ${modeText}</span>
                </div>
                <span class="record-time">${time}</span>
            </div>
        `;
    }

    goToPage(pageId) {
        document.querySelectorAll('.page').forEach(page => {
            page.classList.remove('active');
        });

        const targetPage = document.getElementById(`page-${pageId}`);
        if (targetPage) {
            targetPage.classList.add('active');
            this.currentPage = pageId;
        }
    }

    reset() {
        this.sessionData = {
            content: '',
            emotion: null,
            emotionId: null,
            intensity: 5,
            mode: null,
            partner: null,
            chatDuration: 0,
            messageCount: 0,
            rating: null
        };

        document.getElementById('worries-textarea').value = '';
        document.getElementById('char-count').textContent = '0';
        
        document.querySelectorAll('.emotion-option').forEach(opt => {
            opt.classList.remove('selected');
        });
        
        document.querySelectorAll('.mode-option').forEach(opt => {
            opt.classList.remove('selected');
        });

        document.getElementById('btn-next').disabled = true;
        document.getElementById('thermometer-slider').value = 5;
        this.updateThermometer(5);

        document.querySelectorAll('#rating-stars .star').forEach(star => {
            star.classList.remove('active');
        });

        document.getElementById('chat-timer').classList.remove('warning');
        document.getElementById('timer-display').textContent = '03:00';
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
    window.app.updateThermometer(5);
});
