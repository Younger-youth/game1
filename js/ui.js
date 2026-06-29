// UI 控制与交互绑定

class UIController {
  constructor(engine) {
    this.engine = engine;
    this.activeBuildType = "laser"; // 默认选中激光塔
    
    this.initDOMs();
    this.bindEvents();
    this.updateHUD();
  }

  initDOMs() {
    this.canvas = document.getElementById("game-canvas");
    this.hudHp = document.getElementById("hud-hp");
    this.hudHpFill = document.getElementById("hud-hp-fill");
    this.hudEnergy = document.getElementById("hud-energy");
    this.hudData = document.getElementById("hud-data");
    this.hudWave = document.getElementById("hud-wave");
    this.hudScore = document.getElementById("hud-score");

    this.btnNextWave = document.getElementById("btn-next-wave");
    this.btnToggleSound = document.getElementById("btn-toggle-sound");
    this.btnOpenTech = document.getElementById("btn-open-tech");
    this.btnCloseTech = document.getElementById("btn-close-tech");
    this.techDrawer = document.getElementById("tech-drawer");

    this.shopItems = document.querySelectorAll(".shop-item");
    this.inspectorPanel = document.getElementById("inspector-panel");
    this.inspectIcon = document.getElementById("inspect-icon");
    this.inspectName = document.getElementById("inspect-name");
    this.inspectLevel = document.getElementById("inspect-level");
    this.inspectDamage = document.getElementById("inspect-damage");
    this.inspectFireRate = document.getElementById("inspect-firerate");
    this.inspectRange = document.getElementById("inspect-range");
    this.inspectSpecialLabel = document.getElementById("inspect-special-label");
    this.inspectSpecialVal = document.getElementById("inspect-special-val");
    this.btnUpgradeTower = document.getElementById("btn-upgrade-tower");
    this.inspectUpgradeCost = document.getElementById("inspect-upgrade-cost");
    this.btnSellTower = document.getElementById("btn-sell-tower");
    this.inspectSellRefund = document.getElementById("inspect-sell-refund");

    this.logsContainer = document.getElementById("system-logs");

    // 技能按钮
    this.skillEmp = document.getElementById("skill-emp");
    this.skillOverclock = document.getElementById("skill-overclock");
  }

  bindEvents() {
    const self = this;

    // 1. 建造选单点击
    this.shopItems.forEach(item => {
      item.addEventListener("click", () => {
        this.shopItems.forEach(i => i.classList.remove("active"));
        item.classList.add("active");
        this.activeBuildType = item.getAttribute("data-tower-type");
        
        // 选中建造时，清除当前选中的已建塔
        this.engine.selectedTower = null;
        this.updateInspector();
      });
    });

    // 2. 鼠标在画布上移动与点击
    this.canvas.addEventListener("mousemove", (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      this.engine.hoverGrid = this.engine.map.getGridCoords(mx, my);
    });

    this.canvas.addEventListener("mouseleave", () => {
      this.engine.hoverGrid = null;
    });

    this.canvas.addEventListener("click", (e) => {
      if (this.engine.gameState !== "playing") return;

      const rect = this.canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const coords = this.engine.map.getGridCoords(mx, my);

      if (!coords) return;

      // 检查该格子是否有塔
      const existingTower = this.engine.getTowerAt(coords.col, coords.row);

      if (existingTower) {
        // 选中已有防御塔
        this.engine.selectedTower = existingTower;
        this.updateInspector();
        soundManager.playBuild(); // 简易UI点击反馈音
      } else {
        // 尝试建造防御塔
        if (this.engine.map.isBuildable(coords.col, coords.row)) {
          const cost = this.getTowerCost(this.activeBuildType);
          if (this.engine.energy >= cost) {
            this.engine.buildTower(coords.col, coords.row, this.activeBuildType);
            this.updateHUD();
          } else {
            this.addLog("> 警告: 能量碎片不足，无法部署防御程序", "error");
          }
        } else {
          // 清除选中
          this.engine.selectedTower = null;
          this.updateInspector();
        }
      }
    });

    // 3. 右键取消操作
    this.canvas.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      this.engine.selectedTower = null;
      this.updateInspector();
    });

    // 4. 开始下一波
    this.btnNextWave.addEventListener("click", () => {
      if (this.engine.gameState === "playing") {
        this.engine.startNextWave();
      }
    });

    // 5. 升级选定防御塔
    this.btnUpgradeTower.addEventListener("click", () => {
      const t = this.engine.selectedTower;
      if (t) {
        if (this.engine.energy >= t.upgradeCost) {
          this.engine.energy -= t.upgradeCost;
          t.upgrade();
          this.updateInspector();
          this.updateHUD();
          this.addLog(`> 系统升级: 部署的 ${t.name} 已提升至等级 ${t.level}`, "upgrade");
        } else {
          this.addLog("> 警告: 能量碎片不足，无法升级此防御程序", "error");
        }
      }
    });

    // 6. 回收选定防御塔
    this.btnSellTower.addEventListener("click", () => {
      const t = this.engine.selectedTower;
      if (t) {
        this.engine.sellTower(t);
        this.engine.selectedTower = null;
        this.updateInspector();
        this.updateHUD();
      }
    });

    // 7. 音效开关
    this.btnToggleSound.addEventListener("click", () => {
      const on = soundManager.toggle();
      this.btnToggleSound.textContent = `SOUND: ${on ? "ON" : "OFF"}`;
    });

    // 8. 科技树面板打开与关闭
    this.btnOpenTech.addEventListener("click", () => {
      this.techDrawer.classList.add("active");
      this.renderTechTree();
    });

    this.btnCloseTech.addEventListener("click", () => {
      this.techDrawer.classList.remove("active");
    });

    this.techDrawer.addEventListener("click", (e) => {
      if (e.target === this.techDrawer) {
        this.techDrawer.classList.remove("active");
      }
    });

    // 9. 科技点解锁事件
    this.techDrawer.querySelectorAll(".tech-card .cyber-btn").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const card = e.target.closest(".tech-card");
        const techId = card.id;
        const cost = parseInt(card.getAttribute("data-cost"));

        if (this.engine.dataPoints >= cost && !this.engine.techUpgrades[techId]) {
          this.engine.dataPoints -= cost;
          this.engine.techUpgrades[techId] = true;
          
          this.addLog(`> 科技矩阵解锁: 已成功同步 [${card.querySelector(".tech-node-name").textContent}] 算法`, "info");
          soundManager.playUpgrade();
          
          // 如果解锁了基地回血科技，立即给核心血上限增加，同时自愈 10%
          if (techId === "tech-base-regen") {
            this.engine.maxHp = 150;
            this.engine.hp = Math.min(this.engine.maxHp, this.engine.hp + 15);
          }

          // 更新状态
          this.updateHUD();
          this.renderTechTree();
          this.updateSkillsUI();
        }
      });
    });

    // 10. 倍速控制
    for (let speed of [1, 2, 4]) {
      document.getElementById(`btn-speed-${speed}`).addEventListener("click", (e) => {
        document.querySelectorAll(".speed-btn").forEach(b => b.classList.remove("active"));
        e.target.classList.add("active");
        this.engine.speedMultiplier = speed;
        this.addLog(`> 系统主频设置为: ${speed}X 运行时钟`, "system");
      });
    }

    // 11. 超频技能释放
    this.skillOverclock.addEventListener("click", () => {
      if (this.skillOverclock.classList.contains("locked")) return;
      if (this.engine.energy >= 150) {
        this.engine.energy -= 150;
        this.engine.overclockTimer = 6.0; // 持续6秒
        this.updateHUD();
        soundManager.playUpgrade();
        this.addLog("> 全局超频协议激活: 防御塔射击效率提升 100% 持续 6 秒！", "info");
      } else {
        this.addLog("> 警告: 能量碎片不足以唤醒全局超频", "error");
      }
    });

    // 12. EMP大招释放
    this.skillEmp.addEventListener("click", () => {
      if (this.skillEmp.classList.contains("locked")) return;
      if (this.engine.energy >= 100) {
        this.engine.energy -= 100;
        this.updateHUD();
        
        // EMP 全屏静止 4.0 秒
        for (const enemy of this.engine.enemies) {
          enemy.applyStun(4.0);
        }
        
        // 特效与全屏振动
        this.engine.triggerScreenShake(15, 0.4);
        soundManager.playShootTesla();
        
        // 产生密集的粒子爆裂
        for (let i = 0; i < 6; i++) {
          const rx = 100 + Math.random() * 760;
          const ry = 100 + Math.random() * 400;
          particleSystem.addExplosion(rx, ry, "#a124ff", 8, 120);
        }

        this.addLog("> EMP 闪击脉冲释放: 局域网内所有病毒瘫痪 4 秒！", "info");
      } else {
        this.addLog("> 警告: 能量碎片不足以生成 EMP 冲击波", "error");
      }
    });
  }

  // 渲染科技卡片状态
  renderTechTree() {
    const cards = this.techDrawer.querySelectorAll(".tech-card");
    cards.forEach(card => {
      const techId = card.id;
      const cost = parseInt(card.getAttribute("data-cost"));
      const btn = card.querySelector(".cyber-btn");

      // 移除原有的状态类
      card.classList.remove("locked", "available", "unlocked");

      if (this.engine.techUpgrades[techId]) {
        // 已解锁
        card.classList.add("unlocked");
      } else if (this.engine.dataPoints >= cost) {
        // 可购买
        card.classList.add("available");
      } else {
        // 钱不够，锁住
        card.classList.add("locked");
      }
    });
  }

  // 解锁后同步更新左侧技能面板的锁止状态
  updateSkillsUI() {
    if (this.engine.techUpgrades["tech-skill-overclock"]) {
      this.skillOverclock.classList.remove("locked");
    } else {
      this.skillOverclock.classList.add("locked");
    }

    if (this.engine.techUpgrades["tech-skill-emp"]) {
      this.skillEmp.classList.remove("locked");
    } else {
      this.skillEmp.classList.add("locked");
    }
  }

  getTowerCost(type) {
    switch (type) {
      case "laser": return 100;
      case "plasma": return 220;
      case "tesla": return 200;
      case "harvester": return 150;
      default: return 999;
    }
  }

  // 更新 HUD 头部数值显示
  updateHUD() {
    this.hudHp.textContent = Math.max(0, Math.round(this.engine.hp));
    const hpPct = Math.max(0, (this.engine.hp / this.engine.maxHp) * 100);
    this.hudHpFill.style.width = `${hpPct}%`;
    
    // 如果血少于 30%，血条变红
    if (hpPct < 30) {
      this.hudHpFill.style.backgroundColor = "var(--color-red)";
      this.hudHpFill.style.boxShadow = "0 0 5px var(--color-red)";
    } else {
      this.hudHpFill.style.backgroundColor = "var(--color-green)";
      this.hudHpFill.style.boxShadow = "0 0 5px var(--color-green)";
    }

    this.hudEnergy.textContent = Math.round(this.engine.energy);
    this.hudData.textContent = Math.round(this.engine.dataPoints);
    this.hudWave.textContent = this.engine.currentWave;
    this.hudScore.textContent = String(this.engine.score).padStart(6, "0");
  }

  // 更新已选防御塔详情面板
  updateInspector() {
    const t = this.engine.selectedTower;
    if (!t) {
      this.inspectorPanel.classList.add("empty");
      return;
    }

    this.inspectorPanel.classList.remove("empty");
    this.inspectIcon.textContent = this.getTowerIcon(t.type);
    this.inspectName.textContent = t.name;
    this.inspectLevel.textContent = `LEVEL ${t.level}`;
    
    // 渲染带有加成的战斗属性
    const dmg = t.getActualDamage();
    this.inspectDamage.textContent = t.type === "harvester" ? "0" : Math.round(dmg * 10) / 10;
    this.inspectFireRate.textContent = t.type === "harvester" ? "0" : `${t.fireRate}/s`;
    this.inspectRange.textContent = t.type === "harvester" ? "0" : `${Math.round(t.getActualRange())}px`;

    // 特殊技能描述
    if (t.type === "harvester") {
      this.inspectSpecialLabel.textContent = "HARVEST";
      // 显示采集器受科技树加成后的金币
      this.inspectSpecialVal.textContent = `+${t.getActualHarvestEnergy()}e / 10s`;
    } else {
      this.inspectSpecialLabel.textContent = "SPECIAL";
      this.inspectSpecialVal.textContent = t.specialText;
    }

    // 升级与退役按钮状态更新
    if (t.level >= t.maxLevel) {
      this.btnUpgradeTower.style.display = "none";
    } else {
      this.btnUpgradeTower.style.display = "block";
      this.inspectUpgradeCost.textContent = `Cost: ${t.upgradeCost}e`;
    }

    this.inspectSellRefund.textContent = `Refund: ${t.refund}e`;
  }

  getTowerIcon(type) {
    switch (type) {
      case "laser": return "📡";
      case "plasma": return "☄️";
      case "tesla": return "⚡";
      case "harvester": return "🔋";
      default: return "❓";
    }
  }

  // 在左下角控制台打印日志
  addLog(text, className = "info") {
    const entry = document.createElement("div");
    entry.className = `log-entry ${className}`;
    entry.textContent = text;
    this.logsContainer.appendChild(entry);
    
    // 滚动到底部
    this.logsContainer.scrollTop = this.logsContainer.scrollHeight;
    
    // 限制最多 40 条记录
    while (this.logsContainer.childElementCount > 40) {
      this.logsContainer.removeChild(this.logsContainer.firstChild);
    }
  }
}

window.UIController = UIController;
