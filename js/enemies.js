class Enemy {
  constructor(path, level, type = "striker") {
    this.path = path;
    this.level = level;
    this.type = type;
    
    this.pathIndex = 0;
    this.x = path[0].x;
    this.y = path[0].y;
    this.isDead = false;
    this.isFinished = false; // 是否到达终点
    
    // 状态效果
    this.slowTimer = 0;
    this.slowAmount = 0;
    this.stunTimer = 0;
    
    // 受击红色闪烁计时
    this.flashTimer = 0;
    
    // 基础配置 (按类型覆盖)
    this.initStats();
  }

  initStats() {
    // 随着波数增加进行小幅度数值膨胀
    const healthMultiplier = 1 + (this.level - 1) * 0.18;
    const rewardMultiplier = 1 + (this.level - 1) * 0.05;

    switch (this.type) {
      case "scout":
        this.maxHealth = Math.round(50 * healthMultiplier);
        this.maxShield = 0;
        this.speed = 120; // 快速
        this.size = 12;
        this.reward = Math.round(12 * rewardMultiplier);
        this.dataPoints = 0;
        this.color = "#00f0ff"; // 青色
        break;

      case "striker":
        this.maxHealth = Math.round(120 * healthMultiplier);
        this.maxShield = 0;
        this.speed = 70; // 中速
        this.size = 16;
        this.reward = Math.round(20 * rewardMultiplier);
        this.dataPoints = Math.random() < 0.15 ? 1 : 0; // 概率掉落数据
        this.color = "#ff007f"; // 玫红
        break;

      case "cruiser":
        this.maxHealth = Math.round(250 * healthMultiplier);
        this.maxShield = Math.round(150 * healthMultiplier);
        this.speed = 45; // 慢速
        this.size = 20;
        this.reward = Math.round(45 * rewardMultiplier);
        this.dataPoints = 1; // 必掉1个数据点
        this.color = "#a124ff"; // 紫色
        break;

      case "boss":
        this.maxHealth = Math.round(2000 * (1 + (this.level - 1) * 0.4)); // Boss血量巨多
        this.maxShield = Math.round(1000 * (1 + (this.level - 1) * 0.3));
        this.speed = 28; // 极慢
        this.size = 32;
        this.reward = Math.round(300 * rewardMultiplier);
        this.dataPoints = 8 + Math.round(this.level / 2); // 奖励大量数据
        this.color = "#ff3344"; // 红色红色
        break;
    }

    this.health = this.maxHealth;
    this.shield = this.maxShield;
    this.shieldRegenTimer = 0;
  }

  // 施加减速
  applySlow(amount, duration) {
    // 保留最大强度的减速
    if (this.slowTimer <= 0 || amount >= this.slowAmount) {
      this.slowAmount = amount;
      this.slowTimer = duration;
    }
  }

  // 施加瘫痪 (Stun)
  applyStun(duration) {
    this.stunTimer = Math.max(this.stunTimer, duration);
  }

  // 承受伤害
  takeDamage(amount, type, bulletSourceX = null, bulletSourceY = null) {
    if (this.isDead) return;
    
    this.flashTimer = 0.1; // 闪烁 0.1 秒红光
    this.shieldRegenTimer = 0; // 受击打断护盾自动恢复

    let isShieldHit = false;
    let actualDamage = amount;

    // 护盾机制：如果拥有护盾，优先扣除护盾
    if (this.shield > 0) {
      isShieldHit = true;
      // 激光对护盾的伤害减半，等离子对护盾有双倍破盾伤害
      let dmgToShield = amount;
      if (type === "laser") dmgToShield = amount * 0.6;
      if (type === "plasma") dmgToShield = amount * 1.8;

      if (this.shield >= dmgToShield) {
        this.shield -= dmgToShield;
        actualDamage = 0;
      } else {
        const leftDmg = amount * (1 - this.shield / dmgToShield);
        this.shield = 0;
        actualDamage = leftDmg;
      }
    }

    this.health -= actualDamage;

    // 绘制伤害浮动文字
    const showDmg = isShieldHit && actualDamage === 0 ? "ABSORBED" : Math.round(amount);
    const fontColor = isShieldHit ? "#00f0ff" : (type === "plasma" ? "#ff007f" : "#ffffff");
    particleSystem.addFloatingText(
      this.x + (Math.random() - 0.5) * 10,
      this.y - 10,
      showDmg,
      fontColor,
      isShieldHit ? 11 : 14
    );

    // 触发火花溅射
    if (bulletSourceX !== null && bulletSourceY !== null) {
      particleSystem.addSparks(this.x, this.y, bulletSourceX, bulletSourceY, this.color, 4);
    }

    if (this.health <= 0) {
      this.die();
    }
  }

  die() {
    this.isDead = true;
    // 爆炸粒子
    particleSystem.addExplosion(this.x, this.y, this.color, this.type === "boss" ? 40 : 15);
    
    // 播放爆炸声
    if (this.type === "boss") {
      soundManager.playExplosion();
      setTimeout(() => soundManager.playExplosion(), 150);
      setTimeout(() => soundManager.playExplosion(), 300);
    } else {
      soundManager.playExplosion();
    }
  }

  update(dt) {
    if (this.isDead || this.isFinished) return;

    // 1. 计时器衰减
    if (this.stunTimer > 0) {
      this.stunTimer -= dt;
      return; // 瘫痪状态下无法移动和自我修复
    }

    if (this.slowTimer > 0) {
      this.slowTimer -= dt;
    }

    if (this.flashTimer > 0) {
      this.flashTimer -= dt;
    }

    // 2. 护盾自动恢复 (非Boss 4秒未受击开始恢复，Boss 2.5秒未受击开始恢复)
    if (this.maxShield > 0 && this.shield < this.maxShield) {
      this.shieldRegenTimer += dt;
      const delay = this.type === "boss" ? 2.5 : 4.0;
      if (this.shieldRegenTimer >= delay) {
        // 每秒恢复 5% 护盾
        const regenSpeed = this.maxShield * 0.08;
        this.shield = Math.min(this.maxShield, this.shield + regenSpeed * dt);
      }
    }

    // 3. 沿路径移动
    if (this.pathIndex < this.path.length) {
      const target = this.path[this.pathIndex];
      const dx = target.x - this.x;
      const dy = target.y - this.y;
      const distance = Math.hypot(dx, dy);

      // 计算当前实际速度 (受减速影响)
      let currentSpeed = this.speed;
      if (this.slowTimer > 0) {
        currentSpeed *= (1 - this.slowAmount);
      }

      const moveDist = currentSpeed * dt;

      if (distance <= moveDist) {
        // 到达拐点，前往下一个
        this.x = target.x;
        this.y = target.y;
        this.pathIndex++;
      } else {
        // 向量移动
        this.x += (dx / distance) * moveDist;
        this.y += (dy / distance) * moveDist;
      }
    } else {
      // 触碰核心终点
      this.isFinished = true;
    }
  }

  draw(ctx) {
    if (this.isDead || this.isFinished) return;

    ctx.save();
    
    // 如果处于冰冻/减速状态，画个幽蓝色底光
    if (this.slowTimer > 0) {
      ctx.shadowColor = "#00f0ff";
      ctx.shadowBlur = 10;
      ctx.strokeStyle = "rgba(0, 240, 255, 0.4)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size + 4, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 设置本体颜色或受击闪烁白色
    let drawColor = this.color;
    if (this.flashTimer > 0) {
      drawColor = "#ffffff";
    }

    ctx.fillStyle = drawColor;
    ctx.shadowColor = drawColor;
    ctx.shadowBlur = 8;

    // 绘制不同外观的恶意软件
    ctx.beginPath();
    if (this.type === "scout") {
      // 三角形箭头形状，朝向移动方向
      let angle = 0;
      if (this.pathIndex < this.path.length) {
        const target = this.path[this.pathIndex];
        angle = Math.atan2(target.y - this.y, target.x - this.x);
      }
      ctx.translate(this.x, this.y);
      ctx.rotate(angle);
      ctx.moveTo(this.size, 0);
      ctx.lineTo(-this.size, -this.size * 0.7);
      ctx.lineTo(-this.size * 0.5, 0);
      ctx.lineTo(-this.size, this.size * 0.7);
      ctx.closePath();
      ctx.fill();
    } 
    else if (this.type === "striker") {
      // 双重菱形
      ctx.translate(this.x, this.y);
      ctx.rotate(Date.now() * 0.003); // 自转自转
      // 外层
      ctx.moveTo(0, -this.size);
      ctx.lineTo(this.size, 0);
      ctx.lineTo(0, this.size);
      ctx.lineTo(-this.size, 0);
      ctx.closePath();
      ctx.fill();
      
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(0, 0, 3, 0, Math.PI*2);
      ctx.fill();
    } 
    else if (this.type === "cruiser") {
      // 六边形
      ctx.translate(this.x, this.y);
      ctx.rotate(Date.now() * 0.001);
      for (let i = 0; i < 6; i++) {
        const angle = (i * Math.PI) / 3;
        const tx = Math.cos(angle) * this.size;
        const ty = Math.sin(angle) * this.size;
        if (i === 0) ctx.moveTo(tx, ty);
        else ctx.lineTo(tx, ty);
      }
      ctx.closePath();
      ctx.fill();

      // 内芯
      ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
      ctx.beginPath();
      ctx.arc(0, 0, this.size * 0.5, 0, Math.PI * 2);
      ctx.fill();
    } 
    else if (this.type === "boss") {
      // 巨大正方形，内嵌旋转十字
      ctx.translate(this.x, this.y);
      
      // 外框
      ctx.strokeRect(-this.size, -this.size, this.size*2, this.size*2);
      ctx.fillStyle = "rgba(255, 51, 68, 0.15)";
      ctx.fillRect(-this.size, -this.size, this.size*2, this.size*2);

      // 内层旋转核心
      ctx.rotate(Date.now() * 0.002);
      ctx.fillStyle = "#ff3344";
      ctx.fillRect(-this.size * 0.6, -this.size * 0.6, this.size * 1.2, this.size * 1.2);
      
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(-this.size * 0.25, -this.size * 0.25, this.size * 0.5, this.size * 0.5);
    }
    
    ctx.restore();

    // 6. 绘制血条 (在原画布坐标下)
    this.drawHealthBar(ctx);
  }

  drawHealthBar(ctx) {
    const barWidth = this.size * 1.6;
    const barHeight = 3;
    const bx = this.x - barWidth / 2;
    const by = this.y - this.size - 8;

    ctx.save();
    ctx.shadowBlur = 0; // 关闭血条发光，提高可读性和性能

    // 1. 底色灰色
    ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
    ctx.fillRect(bx, by, barWidth, barHeight);

    // 2. 绘制血条部分
    const hpPercent = Math.max(0, this.health / this.maxHealth);
    ctx.fillStyle = hpPercent > 0.4 ? "#00ff66" : hpPercent > 0.2 ? "#ffb800" : "#ff3344";
    ctx.fillRect(bx, by, barWidth * hpPercent, barHeight);

    // 3. 绘制护盾条部分
    if (this.maxShield > 0) {
      const shieldPercent = Math.max(0, this.shield / this.maxShield);
      const shieldHeight = 2;
      const sby = by - 3;
      
      // 护盾槽底色
      ctx.fillStyle = "rgba(0, 240, 255, 0.1)";
      ctx.fillRect(bx, sby, barWidth, shieldHeight);
      
      // 护盾填充
      ctx.fillStyle = "#00f0ff";
      ctx.fillRect(bx, sby, barWidth * shieldPercent, shieldHeight);

      // 4. 绘制额外护盾力场罩 (蓝圈)
      if (this.shield > 0) {
        ctx.save();
        ctx.strokeStyle = "rgba(0, 240, 255, 0.35)";
        ctx.lineWidth = 1.5;
        ctx.shadowColor = "#00f0ff";
        ctx.shadowBlur = 6;
        ctx.beginPath();
        // 护盾透明度受剩余血量影响
        ctx.globalAlpha = 0.3 + (this.shield / this.maxShield) * 0.7;
        ctx.arc(this.x, this.y, this.size + 3, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }

    ctx.restore();
  }
}

// 波次管理器，负责生成 30 个波次的敌人配置
class WaveManager {
  static getWaveConfig(wave) {
    // 自动按波次难度生成数量和类型
    let config = {
      waveIndex: wave,
      spawnList: [],
      spawnInterval: 1.0 // 生成间隔秒
    };

    if (wave === 15) {
      // 15波首个小 Boss
      config.spawnList = [
        { type: "boss", count: 1 },
        { type: "scout", count: 10 }
      ];
      config.spawnInterval = 0.8;
      return config;
    }

    if (wave === 30) {
      // 30波终极 Boss
      config.spawnList = [
        { type: "boss", count: 1 },
        { type: "cruiser", count: 8 },
        { type: "striker", count: 15 }
      ];
      config.spawnInterval = 0.5;
      return config;
    }

    // 默认生成波次
    // 随着波数增加，侦察者、入侵者、重装舰数量递增
    let scouts = 0;
    let strikers = 0;
    let cruisers = 0;

    if (wave <= 5) {
      scouts = 4 + wave * 2;
      strikers = Math.max(0, (wave - 1) * 2);
      config.spawnInterval = 1.5 - wave * 0.1;
    } else if (wave <= 14) {
      scouts = 6 + Math.round(wave * 0.5);
      strikers = 5 + wave;
      cruisers = Math.max(0, (wave - 5) * 1);
      config.spawnInterval = 1.0 - wave * 0.03;
    } else if (wave <= 29) {
      scouts = 10 + Math.round(wave * 0.3);
      strikers = 10 + Math.round(wave * 0.8);
      cruisers = 4 + Math.round((wave - 14) * 0.7);
      config.spawnInterval = 0.7;
    }

    // 混合打散生成队列
    let list = [];
    for (let i = 0; i < scouts; i++) list.push("scout");
    for (let i = 0; i < strikers; i++) list.push("striker");
    for (let i = 0; i < cruisers; i++) list.push("cruiser");

    // 洗牌算法打乱出怪顺序
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }

    config.spawnList = list.map(type => ({ type, count: 1 }));
    return config;
  }
}

// 导出全局类
window.Enemy = Enemy;
window.WaveManager = WaveManager;
