import { useEffect, useCallback, useRef } from 'react';
import { useGameStore } from '@/store/gameStore';
import { TOWER_CONFIG, ENEMY_CONFIG, generateAnalysisReport, formatTime } from '@/utils/gameUtils';
import { TowerType, EnemyType } from '@/types/game';

const GRID_SIZE = 10;
const CELL_SIZE = 50;
const WAVE_INTERVAL = 5000;
const ENEMY_SPAWN_INTERVAL = 1000;

export const useGameEngine = () => {
  const {
    status,
    currentWave,
    health,
    coins,
    towers,
    enemies,
    config,
    actions,
    totalPlayTime,
    addTower,
    addEnemy,
    removeEnemy,
    updateEnemy,
    takeDamage,
    addCoins,
    nextWave,
    endGame,
    recordAction,
    setReport,
    updatePlayTime,
  } = useGameStore();

  const gameLoopRef = useRef<number | null>(null);
  const waveTimerRef = useRef<number | null>(null);
  const enemySpawnRef = useRef<number | null>(null);
  const lastUpdateRef = useRef<number>(0);
  const enemiesSpawnedRef = useRef<number>(0);

  const currentLevel = config?.levels[0];

  const spawnEnemy = useCallback(() => {
    if (!currentLevel) return;

    const enemyTypes: EnemyType[] = ['phishing', 'malware', 'ransomware', 'hack'];
    const maxTypeIndex = Math.min(
      Math.floor(currentLevel.difficulty / 2),
      enemyTypes.length - 1
    );
    const typeIndex = Math.floor(Math.random() * (maxTypeIndex + 1));
    const enemyType = enemyTypes[typeIndex];
    const config = ENEMY_CONFIG[enemyType];

    const difficultyMultiplier = 1 + currentLevel.difficulty * 0.1;

    addEnemy({
      type: enemyType,
      position: { x: 0, y: Math.floor(Math.random() * GRID_SIZE) },
      health: Math.floor(config.health * difficultyMultiplier),
      maxHealth: Math.floor(config.health * difficultyMultiplier),
      speed: config.speed,
      damage: Math.floor(config.damage * difficultyMultiplier),
      reward: config.reward,
    });

    enemiesSpawnedRef.current++;
  }, [currentLevel, addEnemy]);

  const updateGame = useCallback(() => {
    const now = Date.now();
    const deltaTime = (now - lastUpdateRef.current) / 1000;
    lastUpdateRef.current = now;

    const updatedEnemies = [...enemies];

    updatedEnemies.forEach((enemy) => {
      const newX = enemy.position.x + enemy.speed * deltaTime * 2;

      if (newX >= GRID_SIZE) {
        takeDamage(enemy.damage);
        removeEnemy(enemy.id);
        return;
      }

      let totalDamage = 0;
      towers.forEach((tower) => {
        const dx = enemy.position.x - tower.position.x;
        const dy = enemy.position.y - tower.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance <= tower.range) {
          totalDamage += tower.damage * deltaTime;
        }
      });

      if (totalDamage > 0) {
        const newHealth = enemy.health - totalDamage;
        if (newHealth <= 0) {
          addCoins(enemy.reward);
          removeEnemy(enemy.id);
        } else {
          updateEnemy(enemy.id, {
            position: { x: newX, y: enemy.position.y },
            health: newHealth,
          });
        }
      } else {
        updateEnemy(enemy.id, {
          position: { x: newX, y: enemy.position.y },
        });
      }
    });
  }, [enemies, towers, takeDamage, removeEnemy, addCoins, updateEnemy]);

  const startWave = useCallback(() => {
    if (!currentLevel) return;

    enemiesSpawnedRef.current = 0;
    const enemiesPerWave = 3 + currentLevel.difficulty;

    enemySpawnRef.current = window.setInterval(() => {
      if (enemiesSpawnedRef.current < enemiesPerWave) {
        spawnEnemy();
      } else {
        if (enemySpawnRef.current) {
          clearInterval(enemySpawnRef.current);
          enemySpawnRef.current = null;
        }
      }
    }, ENEMY_SPAWN_INTERVAL);
  }, [currentLevel, spawnEnemy]);

  useEffect(() => {
    if (status === 'playing') {
      lastUpdateRef.current = Date.now();

      gameLoopRef.current = window.setInterval(() => {
        updateGame();
        updatePlayTime();
      }, 50);

      startWave();

      waveTimerRef.current = window.setInterval(() => {
        if (enemies.length === 0 && !enemySpawnRef.current) {
          if (currentWave >= (currentLevel?.waveCount || 0)) {
            endGame();
          } else {
            nextWave();
            startWave();
          }
        }
      }, WAVE_INTERVAL);
    }

    return () => {
      if (gameLoopRef.current) {
        clearInterval(gameLoopRef.current);
        gameLoopRef.current = null;
      }
      if (waveTimerRef.current) {
        clearInterval(waveTimerRef.current);
        waveTimerRef.current = null;
      }
      if (enemySpawnRef.current) {
        clearInterval(enemySpawnRef.current);
        enemySpawnRef.current = null;
      }
    };
  }, [status, currentWave, enemies.length, currentLevel, updateGame, updatePlayTime, startWave, endGame, nextWave]);

  useEffect(() => {
    if (health <= 0 && status === 'playing') {
      endGame();
    }
  }, [health, status, endGame]);

  useEffect(() => {
    if (status === 'ended') {
      const isSuccess = health > 0 && currentWave >= (currentLevel?.waveCount || 0);
      const report = generateAnalysisReport(
        isSuccess,
        actions,
        totalPlayTime,
        currentLevel?.waveCount || 0,
        currentWave,
        health
      );
      setReport(report);
    }
  }, [status, health, currentWave, currentLevel, actions, totalPlayTime, setReport]);

  const buildTower = useCallback(
    (type: TowerType, x: number, y: number) => {
      const towerConfig = TOWER_CONFIG[type];

      if (coins < towerConfig.cost) {
        recordAction({
          type: 'build',
          towerType: type,
          position: { x, y },
          isValid: false,
          remarks: '金币不足，无法建造',
        });
        return false;
      }

      const existingTower = towers.find(
        (t) => t.position.x === x && t.position.y === y
      );
      if (existingTower) {
        recordAction({
          type: 'build',
          towerType: type,
          position: { x, y },
          isValid: false,
          remarks: '该位置已有防守塔',
        });
        return false;
      }

      addTower({
        type,
        position: { x, y },
        level: 1,
        damage: towerConfig.damage,
        range: towerConfig.range,
        cost: towerConfig.cost,
      });

      recordAction({
        type: 'build',
        towerType: type,
        position: { x, y },
        isValid: true,
      });

      return true;
    },
    [coins, towers, addTower, recordAction]
  );

  return {
    buildTower,
    formatTime,
    GRID_SIZE,
    CELL_SIZE,
  };
};
