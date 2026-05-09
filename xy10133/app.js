document.addEventListener('DOMContentLoaded', function() {
    const elements = {
        startScreen: document.getElementById('start-screen'),
        gameScreen: document.getElementById('game-screen'),
        pauseScreen: document.getElementById('pause-screen'),
        gameoverScreen: document.getElementById('gameover-screen'),
        replayScreen: document.getElementById('replay-screen'),
        level: document.getElementById('level'),
        score: document.getElementById('score'),
        time: document.getElementById('time'),
        lives: document.getElementById('lives'),
        prescription: document.getElementById('prescription'),
        cabinet: document.getElementById('cabinet'),
        finalScore: document.getElementById('final-score'),
        finalLevel: document.getElementById('final-level'),
        scoreDetails: document.getElementById('score-details'),
        replayContent: document.getElementById('replay-content'),
        startBtn: document.getElementById('start-btn'),
        pauseBtn: document.getElementById('pause-btn'),
        resumeBtn: document.getElementById('resume-btn'),
        restartBtn: document.getElementById('restart-btn'),
        pauseRestartBtn: document.getElementById('pause-restart-btn'),
        gameoverRestartBtn: document.getElementById('gameover-restart-btn'),
        replayBtn: document.getElementById('replay-btn'),
        replayBackBtn: document.getElementById('replay-back-btn')
    };

    let game = null;

    function showScreen(screen) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        if (screen === 'game') {
            elements.gameScreen.classList.add('active');
        } else if (screen === 'pause') {
            elements.gameScreen.classList.add('active');
            elements.pauseScreen.classList.add('active');
        } else if (screen === 'gameover') {
            elements.gameScreen.classList.add('active');
            elements.gameoverScreen.classList.add('active');
        } else if (screen === 'replay') {
            elements.replayScreen.classList.add('active');
        } else {
            elements.startScreen.classList.add('active');
        }
    }

    function updateUI() {
        const state = game.getState();
        elements.level.textContent = state.level;
        elements.score.textContent = state.score;
        elements.time.textContent = state.timeRemaining;
        elements.lives.textContent = state.lives;
        
        if (state.timeRemaining <= 10) {
            elements.time.style.color = '#f44336';
        } else {
            elements.time.style.color = '';
        }
    }

    function renderPrescription(prescription) {
        if (!prescription) return;
        
        let warningsHtml = '';
        if (prescription.warnings && prescription.warnings.length > 0) {
            warningsHtml = `
                <div class="warnings">
                    <h4>⚠️ 注意事项</h4>
                    <ul>
                        ${prescription.warnings.map(w => `<li>${w.message}</li>`).join('')}
                    </ul>
                </div>
            `;
        }

        elements.prescription.innerHTML = `
            <div class="patient">患者: ${prescription.patient}</div>
            <div class="medicine-name">${prescription.medicine.name}</div>
            <div class="dosage">剂量: ${prescription.medicine.dosage}</div>
            ${warningsHtml}
        `;
    }

    function renderCabinet(medicines, clickedMedicines) {
        elements.cabinet.innerHTML = '';
        
        medicines.forEach(medicine => {
            const card = document.createElement('div');
            card.className = 'medicine-card';
            card.dataset.id = medicine.id;
            
            if (clickedMedicines && clickedMedicines.has(medicine.id)) {
                card.classList.add('disabled');
            }

            let tagHtml = '';
            if (medicine.type === 'similar') {
                tagHtml = '<span class="tag similar">相似药名</span>';
            } else if (medicine.type === 'forbidden') {
                tagHtml = '<span class="tag forbidden">禁忌药品</span>';
            }

            card.innerHTML = `
                <div class="name">${medicine.name}</div>
                <div class="dosage">${medicine.dosage}</div>
                <div class="category">${medicine.category}</div>
                ${tagHtml}
            `;

            card.addEventListener('click', () => handleMedicineClick(medicine.id, card));
            elements.cabinet.appendChild(card);
        });
    }

    function handleMedicineClick(medicineId, cardElement) {
        if (!game || game.getGameState() !== GameState.PLAYING) return;
        
        const result = game.selectMedicine(medicineId);
        
        if (result.duplicate) {
            return;
        }

        if (result.success) {
            cardElement.classList.add('correct');
        } else {
            cardElement.classList.add('wrong');
        }
    }

    function renderScoreDetails() {
        const details = game.getScoreDetails();
        let html = '<h3>计分明细</h3>';
        
        if (details.length === 0) {
            html += '<p style="text-align: center; color: #888;">暂无记录</p>';
        } else {
            details.forEach((detail, index) => {
                const className = detail.type === 'correct' ? 'correct' : 'wrong';
                const pointsText = detail.points > 0 ? `+${detail.points}` : '0';
                html += `
                    <div class="detail-item ${className}">
                        <span>${index + 1}. ${detail.description}</span>
                        <span class="points">${pointsText}</span>
                    </div>
                `;
            });
        }

        elements.scoreDetails.innerHTML = html;
    }

    function renderReplay() {
        const history = game.getGameHistory();
        let html = '';
        
        let stepNumber = 1;
        history.forEach((entry, index) => {
            if (entry.type === 'new_round') {
                html += `
                    <div class="replay-step">
                        <div class="step-number">第 ${stepNumber} 轮 (关卡 ${entry.level})</div>
                        <div class="step-info">
                            <p>处方药品: <strong>${entry.prescription.medicine.name}</strong></p>
                            <p>剂量: ${entry.prescription.medicine.dosage}</p>
                        </div>
                    </div>
                `;
                stepNumber++;
            } else if (entry.type === 'select') {
                const className = entry.success ? '' : 'wrong';
                const successText = entry.success ? '✅ 选择正确' : `❌ ${entry.message}`;
                html += `
                    <div class="replay-step ${className}">
                        <div class="step-number">选择操作</div>
                        <div class="step-info">
                            <p>选择了: <strong>${entry.medicine.name}</strong></p>
                            <p>结果: ${successText}</p>
                            ${entry.success ? `<p>获得 ${entry.points} 分 (连击 x${entry.combo})</p>` : ''}
                        </div>
                    </div>
                `;
            } else if (entry.type === 'timeout') {
                html += `
                    <div class="replay-step wrong">
                        <div class="step-number">超时</div>
                        <div class="step-info">
                            <p>${entry.message}</p>
                        </div>
                    </div>
                `;
            } else if (entry.type === 'gameover') {
                html += `
                    <div class="replay-step">
                        <div class="step-number">游戏结束</div>
                        <div class="step-info">
                            <p>最终得分: <strong>${entry.finalScore}</strong></p>
                            <p>到达关卡: ${entry.finalLevel}</p>
                            <p>最高连击: ${entry.maxCombo}</p>
                        </div>
                    </div>
                `;
            }
        });

        elements.replayContent.innerHTML = html || '<p style="text-align: center; color: #888;">暂无回放记录</p>';
    }

    function initGame() {
        game = new PharmacyGame({
            onStateChange: function(state) {
                if (state === GameState.GAME_OVER) {
                    const gameState = game.getState();
                    elements.finalScore.textContent = gameState.score;
                    elements.finalLevel.textContent = gameState.level;
                    renderScoreDetails();
                    showScreen('gameover');
                } else if (state === GameState.PAUSED) {
                    showScreen('pause');
                } else if (state === GameState.PLAYING) {
                    showScreen('game');
                }
            },
            onPrescriptionChange: renderPrescription,
            onCabinetChange: renderCabinet,
            onScoreChange: updateUI,
            onTimeChange: updateUI,
            onLivesChange: updateUI,
            onComboChange: updateUI
        });
    }

    elements.startBtn.addEventListener('click', function() {
        initGame();
        game.start();
    });

    elements.pauseBtn.addEventListener('click', function() {
        if (game) {
            game.pause();
        }
    });

    elements.resumeBtn.addEventListener('click', function() {
        if (game) {
            game.resume();
        }
    });

    function handleRestart() {
        if (game) {
            game.destroy();
        }
        initGame();
        game.start();
    }

    elements.restartBtn.addEventListener('click', handleRestart);
    elements.pauseRestartBtn.addEventListener('click', handleRestart);
    elements.gameoverRestartBtn.addEventListener('click', handleRestart);

    elements.replayBtn.addEventListener('click', function() {
        if (game) {
            renderReplay();
            showScreen('replay');
        }
    });

    elements.replayBackBtn.addEventListener('click', function() {
        showScreen('gameover');
    });

    window.PharmacyGame = PharmacyGame;
    window.GameState = GameState;
});
