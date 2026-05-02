const { createApp, ref, computed, onMounted, onUnmounted, watch, nextTick } = Vue;

createApp({
    setup() {
        const gameState = ref('menu');
        const currentLevelIndex = ref(-1);
        const currentLevel = ref(null);
        
        const score = ref(0);
        const gameTime = ref(0);
        const gameSpeed = ref(1);
        const selectedTool = ref('fence');
        
        const satisfaction = ref(100);
        const congestionLevel = ref(0);
        const remainingPassengers = ref(0);
        
        const toolCounts = ref({ fence: 0, staff: 0 });
        const goalProgress = ref({});
        
        const showLevelSelect = ref(false);
        const showLevelEditor = ref(false);
        const editorJson = ref('');
        const editorError = ref('');
        const editorSuccess = ref('');
        
        const isVictory = ref(false);
        const finalScore = ref(0);
        const finalStars = ref(0);
        const hasNextLevel = ref(false);
        
        const recentEvents = ref([]);
        const replayEvents = ref([]);
        
        const hoveredGridX = ref(-1);
        const hoveredGridY = ref(-1);
        
        const gameCanvasRef = ref(null);
        const editorCanvasRef = ref(null);
        
        let gameEngine = null;
        let gameRenderer = null;
        let editorRenderer = null;
        let editorGridMap = null;
        let animationFrameId = null;

        const allLevels = computed(() => LEVELS);

        const formatTime = (seconds) => {
            return Helpers.formatTime(seconds);
        };

        const getColorByType = (type) => {
            return Helpers.getColorByType(type);
        };

        const getColorName = (type) => {
            return Helpers.getColorName(type);
        };

        const getEventIcon = (type) => {
            return Helpers.getEventIcon(type);
        };

        const getGoalProgress = (idx) => {
            if (!currentLevel.value?.goals) return 0;
            const goal = currentLevel.value.goals[idx];
            if (!goal) return 0;
            return goalProgress.value[goal.color] || 0;
        };

        const isLevelUnlocked = (index) => {
            return Storage.isLevelUnlocked(index);
        };

        const isLevelCompleted = (index) => {
            return Storage.isLevelCompleted(index);
        };

        const startGame = () => {
            selectLevel(0);
        };

        const selectLevel = (index) => {
            if (!isLevelUnlocked(index)) return;
            
            showLevelSelect.value = false;
            currentLevelIndex.value = index;
            currentLevel.value = Helpers.deepClone(LEVELS[index]);
            
            initGame();
        };

        const initGame = () => {
            if (!gameEngine) {
                gameEngine = new GameEngine();
            }
            
            gameEngine.initLevel(currentLevel.value, currentLevelIndex.value);
            
            nextTick(() => {
                if (gameCanvasRef.value) {
                    if (!gameRenderer) {
                        gameRenderer = new CanvasRenderer(gameCanvasRef.value);
                    }
                    
                    const container = gameCanvasRef.value.parentElement;
                    gameRenderer.resize(
                        gameEngine.gridMap,
                        container.clientWidth,
                        container.clientHeight
                    );
                    
                    startGameLoop();
                }
            });
            
            gameState.value = 'playing';
            gameEngine.start();
            
            gameEngine.on('onUpdate', () => {
                updateGameUI();
            });
            
            gameEngine.on('onGameEnd', (victory, finalScoreVal, time) => {
                handleGameEnd(victory, finalScoreVal, time);
            });
            
            gameEngine.on('onEvent', (event) => {
                recentEvents.value.push(event);
                if (recentEvents.value.length > 20) {
                    recentEvents.value.shift();
                }
            });
            
            updateGameUI();
        };

        const startGameLoop = () => {
            const render = () => {
                if (gameEngine && gameRenderer) {
                    gameRenderer.render(gameEngine);
                    
                    if (hoveredGridX.value >= 0 && hoveredGridY.value >= 0) {
                        const valid = gameEngine.gridMap.canPlaceTool(
                            hoveredGridX.value,
                            hoveredGridY.value,
                            selectedTool.value
                        );
                        gameRenderer.renderHighlight(
                            hoveredGridX.value,
                            hoveredGridY.value,
                            gameEngine.gridMap,
                            valid
                        );
                    }
                }
                animationFrameId = requestAnimationFrame(render);
            };
            render();
        };

        const updateGameUI = () => {
            if (!gameEngine) return;
            
            score.value = gameEngine.score;
            gameTime.value = gameEngine.gameTime;
            satisfaction.value = gameEngine.getSatisfaction();
            congestionLevel.value = gameEngine.getCongestionLevel();
            remainingPassengers.value = gameEngine.getRemainingPassengers();
            toolCounts.value = { ...gameEngine.toolCounts };
            goalProgress.value = { ...gameEngine.goalProgress };
        };

        const handleGameEnd = (victory, finalScoreVal, time) => {
            isVictory.value = victory;
            finalScore.value = finalScoreVal;
            
            const maxScore = gameEngine.getMaxPossibleScore();
            finalStars.value = gameEngine.calculateStars(maxScore);
            
            hasNextLevel.value = currentLevelIndex.value < LEVELS.length - 1;
            
            replayEvents.value = gameEngine.eventRecorder.getKeyEvents();
            
            if (victory) {
                Storage.saveLevelProgress(
                    currentLevelIndex.value,
                    finalScoreVal,
                    finalStars.value,
                    time
                );
            }
            
            gameState.value = 'ended';
        };

        const togglePause = () => {
            if (!gameEngine) return;
            gameEngine.togglePause();
            gameState.value = gameEngine.state;
        };

        const restartLevel = () => {
            if (!gameEngine) return;
            
            recentEvents.value = [];
            replayEvents.value = [];
            
            gameEngine.restart();
            gameState.value = 'playing';
            updateGameUI();
        };

        const nextLevel = () => {
            if (currentLevelIndex.value < LEVELS.length - 1) {
                selectLevel(currentLevelIndex.value + 1);
            }
        };

        const backToMenu = () => {
            if (gameEngine) {
                gameEngine.pause();
            }
            if (animationFrameId) {
                cancelAnimationFrame(animationFrameId);
            }
            
            gameState.value = 'menu';
            recentEvents.value = [];
            replayEvents.value = [];
        };

        const setGameSpeed = (speed) => {
            gameSpeed.value = speed;
            if (gameEngine) {
                gameEngine.setGameSpeed(speed);
            }
        };

        const selectTool = (tool) => {
            selectedTool.value = tool;
        };

        const handleCanvasClick = (event) => {
            if (!gameEngine || !gameRenderer) return;
            if (gameState.value === 'paused' || gameState.value === 'ended') return;
            
            const rect = gameCanvasRef.value.getBoundingClientRect();
            const x = event.clientX - rect.left;
            const y = event.clientY - rect.top;
            
            const grid = gameRenderer.screenToGrid(x, y);
            
            if (grid.x >= 0 && grid.y >= 0) {
                gameEngine.useTool(selectedTool.value, grid.x, grid.y);
            }
        };

        const handleCanvasMouseMove = (event) => {
            if (!gameRenderer) return;
            
            const rect = gameCanvasRef.value.getBoundingClientRect();
            const x = event.clientX - rect.left;
            const y = event.clientY - rect.top;
            
            const grid = gameRenderer.screenToGrid(x, y);
            hoveredGridX.value = grid.x;
            hoveredGridY.value = grid.y;
        };

        const handleCanvasMouseLeave = () => {
            hoveredGridX.value = -1;
            hoveredGridY.value = -1;
        };

        const openLevelEditor = () => {
            showLevelEditor.value = true;
            editorJson.value = JSON.stringify(LEVELS[0], null, 2);
            editorError.value = '';
            editorSuccess.value = '';
            
            nextTick(() => {
                if (editorCanvasRef.value) {
                    editorRenderer = new CanvasRenderer(editorCanvasRef.value);
                    validateLevelJson();
                }
            });
        };

        const validateLevelJson = () => {
            editorError.value = '';
            editorSuccess.value = '';
            
            const result = Helpers.validateLevelJson(editorJson.value);
            
            if (!result.valid) {
                editorError.value = result.error;
                return;
            }
            
            editorSuccess.value = '关卡格式有效！';
            
            try {
                editorGridMap = new GridMap(result.level);
                
                if (editorRenderer) {
                    const container = editorCanvasRef.value.parentElement;
                    editorRenderer.resize(
                        editorGridMap,
                        editorCanvasRef.value.clientWidth,
                        editorCanvasRef.value.clientHeight
                    );
                    editorRenderer.renderPreview(editorGridMap);
                }
            } catch (e) {
                editorError.value = '渲染失败: ' + e.message;
            }
        };

        const importLevelJson = () => {
            const result = Helpers.validateLevelJson(editorJson.value);
            
            if (!result.valid) {
                editorError.value = result.error;
                return;
            }
            
            LEVELS.push(result.level);
            const newIndex = LEVELS.length - 1;
            
            showLevelEditor.value = false;
            selectLevel(newIndex);
        };

        const exportCurrentLevel = () => {
            if (currentLevel.value) {
                editorJson.value = JSON.stringify(currentLevel.value, null, 2);
                validateLevelJson();
            } else {
                editorJson.value = JSON.stringify(LEVELS[0], null, 2);
                validateLevelJson();
            }
        };

        const closeLevelEditor = () => {
            showLevelEditor.value = false;
        };

        const handleEditorCanvasClick = (event) => {
        };

        watch(showLevelEditor, (newVal) => {
            if (newVal) {
                openLevelEditor();
            }
        });

        onMounted(() => {
            window.addEventListener('resize', () => {
                if (gameRenderer && gameEngine) {
                    const container = gameCanvasRef.value?.parentElement;
                    if (container) {
                        gameRenderer.resize(
                            gameEngine.gridMap,
                            container.clientWidth,
                            container.clientHeight
                        );
                    }
                }
            });
        });

        onUnmounted(() => {
            if (animationFrameId) {
                cancelAnimationFrame(animationFrameId);
            }
            if (gameEngine) {
                gameEngine.pause();
            }
        });

        return {
            gameState,
            currentLevelIndex,
            currentLevel,
            score,
            gameTime,
            gameSpeed,
            selectedTool,
            satisfaction,
            congestionLevel,
            remainingPassengers,
            toolCounts,
            goalProgress,
            showLevelSelect,
            showLevelEditor,
            editorJson,
            editorError,
            editorSuccess,
            isVictory,
            finalScore,
            finalStars,
            hasNextLevel,
            recentEvents,
            replayEvents,
            allLevels,
            gameCanvasRef,
            editorCanvasRef,
            
            formatTime,
            getColorByType,
            getColorName,
            getEventIcon,
            getGoalProgress,
            isLevelUnlocked,
            isLevelCompleted,
            startGame,
            selectLevel,
            togglePause,
            restartLevel,
            nextLevel,
            backToMenu,
            setGameSpeed,
            selectTool,
            handleCanvasClick,
            handleCanvasMouseMove,
            handleCanvasMouseLeave,
            validateLevelJson,
            importLevelJson,
            exportCurrentLevel,
            closeLevelEditor,
            handleEditorCanvasClick
        };
    }
}).mount('#app');
