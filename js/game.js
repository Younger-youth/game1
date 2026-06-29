// 游戏核心引擎

class GameEngine {
  constructor() {
    this.canvas = document.getElementById("game-canvas");
    this.ctx = this.canvas.getContext("2d");
    
    // 初始化系统
    this.map = new GameMap(this.canvas);
    this.ui = null; // 稍后在 initUI 中挂载，形成互引

    this.towers = [];
    this.enemies = [];
    this.projectiles = [];
    
    // 游戏全局数据
    this.hp = 100;
    this.maxHp = 100;
    this.energy = 400;      // 基础能量 shards
    this.dataPoints = 0;    // 核心数据 kb
    this.score = 0;
    this.currentWave = 0;
    this.maxWave = 30;

    // 波次控制
    this.waveInProgress = false;
    this.spawnTimer = 0;
    this.spawnIndex = 0;
    this.waveConfig = null;
    this.waveInterval = 1.0;

    // 状态与设置
    this.gameState = "start"; // start, playing, gameover, victory
    this.hoverGrid = null;     // 当前鼠标悬浮网格
    this.selectedTower = null; // 选中的防御塔
    this.speedMultiplier = 1;  // 时钟倍速 (1X, 2X, 4X)
    
    // 科技树解锁缓存
    this.techUpgrades = {
      "tech-laser-dmg": false,       // 等离子范围与威力
      "tech-tesla-chain": false,     // 特斯拉链+减速
      "tech-harvester-boost": false,  // 采集器收益
      "tech-skill-overclock": false,  // 超频技能
      "tech-base-regen": false,       // 基地护盾与回血
      "tech-skill-emp": false         // EMP大招
    };

    // 超频技能剩余计时
    this.overclockTimer = 0;

    // 屏幕抖动特效
    this.shakeTimer = 0;
    this.shakeIntensity = 0;

    this.lastTime = 0;
  }

  init() {
    this.ui = new UIController(this);
    window.gameEngine = this; // 绑定至 window 方便全局引用
    
    this.bindOverlayEvents();
    
    // 开启循环渲染
    requestAnimationFrame((time) => this.loop(time));
  }

  // 绑定主菜单、胜利、失败界面的按钮
  bindOverlayEvents() {
    const overlay = document.getElementById("overlay-screen");
    const startScreen = document.getElementById("start-screen");
    const gameoverScreen = document.getElementById("gameover-screen");
    const victoryScreen = document.getElementById("victory-screen");

    // 开始游戏
    document.getElementById("btn-start-game").addEventListener("click", () => {
      soundManager.playBuild();
      overlay.style.opacity = 0;
      setTimeout(() => {
        overlay.style.display = "none";
        startScreen.classList.remove("active");
        this.gameState = "playing";
        this.ui.addLog("> 防火墙防御矩阵初始化完毕，正处于待命状态...", "system");
      }, 500);
    });

    // 失败重启
    document.getElementById("btn-restart-lose").addEventListener("click", () => {
      this.reset();
      overlay.style.opacity = 0;
      setTimeout(() => {
        overlay.style.display = "none";
        gameoverScreen.classList.remove("active");
        this.gameState = "playing";
      }, 500);
    });

    // 胜利重启
    document.getElementById("btn-restart-win").addEventListener("click", () => {
      this.reset();
      overlay.style.opacity = 0;
      setTimeout(() => {
        overlay.style.display = "none";
        victoryScreen.classList.remove("active");
        this.gameState = "playing";
      }, 500);
    });

    // 空格键触发下一波
    window.addEventListener("keydown", (e) => {
      if (e.code === "Space" && this.gameState === "playing" && !this.waveInProgress) {
        e.preventDefault();
        this.startNextWave();
      }
    });
  }

  // 重置游戏状态 (用于重新开始)
  reset() {
    this.towers = [];
    this.enemies = [];
    this.projectiles = [];
    particleSystem.clear();

    this.map.initGrid();
    
    this.hp = 100;
    this.maxHp = 100;
    this.energy = 400;
    this.dataPoints = 0;
    this.score = 0;
    this.currentWave = 0;

    this.waveInProgress = false;
    this.spawnTimer = 0;
    this.spawnIndex = 0;
    this.selectedTower = null;
    this.overclockTimer = 0;

    // 重置科技树
    for (let key in this.techUpgrades) {
      this.techUpgrades[key] = false;
    }

    // 重置UI
    this.ui.updateHUD();
    this.ui.updateInspector();
    this.ui.updateSkillsUI();
    this.ui.logsContainer.innerHTML = `<div class="log-entry system">> Firewall initialized. Ready for malware...</div>`;

    document.getElementById("btn-next-wave").disabled = false;
    document.getElementById("btn-next-wave").querySelector(".btn-text").textContent = "INITIALIZE WAVE";
  }

  // 部署防御塔
  buildTower(col, row, type) {
    const cost = this.ui.getTowerCost(type);
    this.energy -= cost;

    const tower = new Tower(col, row, type, this.map);
    this.towers.push(tower);
    this.map.setGridState(col, row, 2); // 占用网格

    // 播放音效与粒子
    soundManager.playBuild();
    particleSystem.addExplosion(tower.x, tower.y, tower.color, 8, 45);

    this.ui.addLog(`> 系统部署: ${tower.name} 已成功连接到网格 (${col}, ${row})`, "system");
    this.ui.updateHUD();
  }

  // 回收防御塔
  sellTower(tower) {
    this.energy += tower.refund;
    this.map.setGridState(tower.col, tower.row, 0); // 释放网格
    
    // 从列表中移出
    const index = this.towers.indexOf(tower);
    if (index > -1) {
      this.towers.splice(index, 1);
    }

    soundManager.playBuild();
    particleSystem.addExplosion(tower.x, tower.y, "#718096", 6, 30);
    this.ui.addLog(`> 系统回收: 已退役 ${tower.name}，回收 ${tower.refund}e 能量`, "system");
  }

  // 触发下一波威胁
  startNextWave() {
    if (this.waveInProgress) return;

    this.currentWave++;
    this.waveInProgress = true;
    this.spawnIndex = 0;
    this.spawnTimer = 0;
    
    this.waveConfig = WaveManager.getWaveConfig(this.currentWave);
    this.waveInterval = this.waveConfig.spawnInterval;

    // 禁用开始波次按钮
    document.getElementById("btn-next-wave").disabled = true;
    document.getElementById("btn-next-wave").querySelector(".btn-text").textContent = "WAVE IN PROGRESS";

    this.ui.addLog(`> 严重警报: 检测到第 ${this.currentWave} 波外部攻击流量，类型: ${this.currentWave === 30 ? "核心母舰 [FATAL]" : "恶意数据包"}`, "enemy");
    this.ui.updateHUD();
  }

  // 触发振动特效
  triggerScreenShake(intensity, duration) {
    this.shakeIntensity = intensity;
    this.shakeTimer = duration;
  }

  getTowerAt(col, row) {
    return this.towers.find(t => t.col === col && t.row === row);
  }

  // 游戏主循环
  loop(time) {
    const rawDt = (time - this.lastTime) / 1000;
    this.lastTime = time;

    // 限制单帧最大时间间隔，防止卡顿导致大范围瞬移
    const dtLimit = Math.min(0.1, rawDt);

    this.update(dtLimit);
    this.draw();

    requestAnimationFrame((t) => this.loop(t));
  }

  // 更新游戏内部逻辑
  update(dt) {
    if (this.gameState !== "playing") return;

    // 时钟倍率加速
    const scaledDt = dt * this.speedMultiplier;

    // 1. 超频计时更新
    if (this.overclockTimer > 0) {
      this.overclockTimer -= scaledDt;
      if (this.overclockTimer <= 0) {
        this.ui.addLog("> 全局超频结束，主板芯片恢复额定功率", "system");
      }
    }

    // 2. 屏幕震动计时更新
    if (this.shakeTimer > 0) {
      this.shakeTimer -= dt; // 震动属于全局视觉，使用物理真实时间
    }

    // 3. 产生波次敌人
    if (this.waveInProgress && this.spawnIndex < this.waveConfig.spawnList.length) {
      this.spawnTimer += scaledDt;
      if (this.spawnTimer >= this.waveInterval) {
        this.spawnTimer = 0;
        
        // 生成
        const node = this.waveConfig.spawnList[this.spawnIndex];
        const newEnemy = new Enemy(this.map.path, this.currentWave, node.type);
        this.enemies.push(newEnemy);
        
        this.spawnIndex++;
      }
    }

    // 4. 更新敌人
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];
      enemy.update(scaledDt);

      if (enemy.isFinished) {
        // 到达终点，核心完整度受损
        const dmg = enemy.type === "boss" ? 40 : 10;
        this.hp -= dmg;
        this.triggerScreenShake(enemy.type === "boss" ? 15 : 6, 0.25);
        soundManager.playBaseHit();
        this.ui.addLog(`> 系统崩溃: 外部包成功渗透！核心完整度下降 ${dmg}%`, "error");
        
        this.ui.updateHUD();

        // 移出
        this.enemies.splice(i, 1);

        // 检查生命值清零失败判定
        if (this.hp <= 0) {
          this.triggerGameOver();
        }
      } 
      else if (enemy.isDead) {
        // 击杀得分和收益
        this.energy += enemy.reward;
        this.score += enemy.type === "boss" ? 1500 : enemy.type === "cruiser" ? 250 : 80;
        
        if (enemy.dataPoints > 0) {
          this.dataPoints += enemy.dataPoints;
          particleSystem.addFloatingText(enemy.x, enemy.y - 30, `+${enemy.dataPoints}kb DATA`, "#a124ff", 15);
        }

        if (enemy.type === "boss") {
          this.ui.addLog(`> 系统告警: 核心母舰 Boss 被摧毁！获得能量 ${enemy.reward}e`, "info");
        }

        this.ui.updateHUD();
        // 移出
        this.enemies.splice(i, 1);
      }
    }

    // 5. 更新防御塔
    for (const tower of this.towers) {
      tower.update(scaledDt, this.enemies);
    }

    // 6. 更新飞行投射物
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const proj = this.projectiles[i];
      proj.update(scaledDt);
      if (proj.isDead) {
        this.projectiles.splice(i, 1);
      }
    }

    // 7. 更新粒子系统
    particleSystem.update(scaledDt);

    // 8. 检查波次清空完毕
    if (this.waveInProgress && 
        this.spawnIndex >= this.waveConfig.spawnList.length && 
        this.enemies.length === 0) {
      this.handleWaveClear();
    }
  }

  // 一波怪物防御成功
  handleWaveClear() {
    this.waveInProgress = false;
    
    // 奖励“核心数据 (kb)”
    const earnedData = 1 + Math.floor(this.currentWave / 5);
    this.dataPoints += earnedData;

    // 奖励能量碎片
    const waveReward = 50 + this.currentWave * 10;
    this.energy += waveReward;

    // 科技树：核心装甲每波结束恢复 10% 血量上限
    if (this.techUpgrades["tech-base-regen"]) {
      const regenAmt = Math.round(this.maxHp * 0.1);
      this.hp = Math.min(this.maxHp, this.hp + regenAmt);
      this.ui.addLog(`> 防护加固: 核心装甲在静止期自愈 ${regenAmt}%`, "info");
    }

    this.ui.addLog(`> 波次防御成功! 解密获得 +${earnedData}kb 数据 / +${waveReward}e 能量`, "info");
    soundManager.playWin();

    this.ui.updateHUD();

    // 检查是否打通 30 波
    if (this.currentWave >= this.maxWave) {
      this.triggerVictory();
    } else {
      // 开启波次按钮
      const btn = document.getElementById("btn-next-wave");
      btn.disabled = false;
      btn.querySelector(".btn-text").textContent = "INITIALIZE WAVE";
      btn.querySelector(".btn-sub").textContent = `START WAVE ${this.currentWave + 1}`;
    }
  }

  // 触发游戏失败
  triggerGameOver() {
    this.gameState = "gameover";
    soundManager.playLose();
    
    // 展示失败面板
    const overlay = document.getElementById("overlay-screen");
    const gameoverScreen = document.getElementById("gameover-screen");
    
    document.getElementById("report-wave").textContent = this.currentWave;
    document.getElementById("report-score").textContent = this.score;

    overlay.style.display = "flex";
    setTimeout(() => overlay.style.opacity = 1, 50);
    gameoverScreen.classList.add("active");
  }

  // 触发游戏胜利
  triggerVictory() {
    this.gameState = "victory";
    soundManager.playWin();
    
    const overlay = document.getElementById("overlay-screen");
    const victoryScreen = document.getElementById("victory-screen");

    document.getElementById("report-hp").textContent = `${Math.round(this.hp)}%`;
    // 剩余生命百分比加分
    const hpBonus = Math.round(this.hp * 100);
    const finalScore = this.score + hpBonus;
    document.getElementById("report-victory-score").textContent = finalScore;

    overlay.style.display = "flex";
    setTimeout(() => overlay.style.opacity = 1, 50);
    victoryScreen.classList.add("active");
  }

  // 画布重绘渲染
  draw() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    this.ctx.save();
    
    // 应用屏幕震动偏移
    if (this.shakeTimer > 0) {
      const shakeX = (Math.random() - 0.5) * this.shakeIntensity;
      const shakeY = (Math.random() - 0.5) * this.shakeIntensity;
      this.ctx.translate(shakeX, shakeY);
    }

    // 1. 绘制网格背景线
    this.map.drawGrid(this.ctx);

    // 2. 绘制防御线发光管
    this.map.drawPath(this.ctx);

    // 3. 绘制防御塔底座及射击范围、开火线
    for (const tower of this.towers) {
      tower.draw(this.ctx);
    }

    // 4. 绘制恶意软件敌人
    for (const enemy of this.enemies) {
      enemy.draw(this.ctx);
    }

    // 5. 绘制浮空等离子能量弹
    for (const proj of this.projectiles) {
      proj.draw(this.ctx);
    }

    // 6. 绘制所有粒子、浮动文本与冲击波
    particleSystem.draw(this.ctx);

    // 7. 绘制建造选中预览格子
    if (this.gameState === "playing" && this.hoverGrid) {
      const hg = this.hoverGrid;
      // 必须是空地，且没有在此位置建塔
      const canBuild = this.map.isBuildable(hg.col, hg.row) && !this.getTowerAt(hg.col, hg.row);
      this.map.drawHoverCell(this.ctx, hg.col, hg.row, canBuild);

      // 若处于选中建造状态，在格子悬浮时显示微弱的防御塔射程预览
      if (canBuild && this.ui) {
        const type = this.ui.activeBuildType;
        if (type !== "harvester") {
          let range = 140; // 激光默认
          if (type === "plasma") range = 210;
          if (type === "tesla") range = 120;
          
          const center = this.map.getCellCenter(hg.col, hg.row);
          this.ctx.save();
          this.ctx.strokeStyle = "rgba(0, 240, 255, 0.15)";
          this.ctx.lineWidth = 1;
          this.ctx.beginPath();
          this.ctx.arc(center.x, center.y, range, 0, Math.PI * 2);
          this.ctx.stroke();
          this.ctx.restore();
        }
      }
    }

    this.ctx.restore();
  }
}

// 页面加载完成后自动启动初始化
window.addEventListener("DOMContentLoaded", () => {
  const engine = new GameEngine();
  engine.init();
});
