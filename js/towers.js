// 防御塔与子弹逻辑

// 等离子炮弹类
class PlasmaBullet {
  constructor(startX, startY, target, damage, speed, splashRadius, color) {
    this.x = startX;
    this.y = startY;
    this.target = target;
    this.damage = damage;
    this.speed = speed;
    this.splashRadius = splashRadius;
    this.color = color;
    this.isDead = false;
    
    // 记住目标最后坐标，防止目标中途死亡子弹失去航向
    this.targetLastX = target.x;
    this.targetLastY = target.y;
  }

  update(dt) {
    if (this.isDead) return;

    if (!this.target.isDead && !this.target.isFinished) {
      this.targetLastX = this.target.x;
      this.targetLastY = this.target.y;
    }

    const dx = this.targetLastX - this.x;
    const dy = this.targetLastY - this.y;
    const distance = Math.hypot(dx, dy);
    const moveDist = this.speed * dt;

    if (distance <= moveDist) {
      // 撞击爆炸
      this.explode();
    } else {
      this.x += (dx / distance) * moveDist;
      this.y += (dy / distance) * moveDist;
    }
  }

  explode() {
    this.isDead = true;
    
    // 获取全局敌人列表
    const enemies = window.gameEngine.enemies;
    
    // 施加区域溅射伤害
    for (const enemy of enemies) {
      if (enemy.isDead || enemy.isFinished) continue;
      const dist = Math.hypot(enemy.x - this.x, enemy.y - this.y);
      if (dist <= this.splashRadius) {
        // 伤害根据距离衰减，核心圈全额，边缘半额
        const falloff = 1 - (dist / this.splashRadius) * 0.4;
        enemy.takeDamage(this.damage * falloff, "plasma", this.x, this.y);
      }
    }

    // 产生剧烈爆炸特效与声音
    particleSystem.addExplosion(this.x, this.y, this.color, 12, 100);
    soundManager.playExplosion();
  }

  draw(ctx) {
    if (this.isDead) return;
    
    ctx.save();
    ctx.fillStyle = this.color;
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 10;
    
    // 画一个带小尾巴的发光球体
    ctx.beginPath();
    ctx.arc(this.x, this.y, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// 防御塔基类
class Tower {
  constructor(col, row, type, map) {
    this.col = col;
    this.row = row;
    this.type = type;
    this.map = map;
    
    // 网格像素中心坐标
    const center = map.getCellCenter(col, row);
    this.x = center.x;
    this.y = center.y;

    this.level = 1;
    this.maxLevel = 3;
    this.angle = 0; // 炮塔旋转角度
    this.target = null;
    this.cooldown = 0; // 开火冷却
    
    // 属性配置
    this.initStats();
  }

  initStats() {
    this.specialText = "NONE";

    switch (this.type) {
      case "laser":
        this.name = "激光炮塔";
        this.range = 140;
        this.damage = 6.0; // 激光持续输出，此处为每秒基础伤害，实际分摊到每帧
        this.fireRate = 12; // 极高频，类似于每一帧都在烧
        this.cost = 100;
        this.upgradeCost = 150;
        this.refund = 50;
        this.color = "#00f0ff";
        break;

      case "plasma":
        this.name = "等离子重炮";
        this.range = 210;
        this.damage = 65; // 瞬间爆发高伤害
        this.fireRate = 0.6; // 慢速
        this.cost = 220;
        this.upgradeCost = 280;
        this.refund = 110;
        this.color = "#ff007f";
        this.splashRadius = 75; // 溅射半径
        this.bulletSpeed = 240;
        this.specialText = `AOE: ${this.splashRadius}px`;
        break;

      case "tesla":
        this.name = "特斯拉电圈";
        this.range = 120;
        this.damage = 22;
        this.fireRate = 0.8;
        this.cost = 200;
        this.upgradeCost = 250;
        this.refund = 100;
        this.color = "#a124ff";
        this.chainCount = 2; // 基础弹射数
        this.slowAmount = 0.3; // 基础减速 30%
        this.slowDuration = 2.5; // 减速2.5秒
        this.specialText = `CHAIN: 2 / SLOW: 30%`;
        break;

      case "harvester":
        this.name = "数据采集器";
        this.range = 0; // 不攻击
        this.damage = 0;
        this.fireRate = 0.1; // 每 10 秒产生一次资源
        this.cost = 150;
        this.upgradeCost = 200;
        this.refund = 75;
        this.color = "#ffb800";
        this.harvestEnergy = 30; // 基础获得能量
        this.harvestProgress = 0; // 生成进度
        this.specialText = `HARVEST: +30e / 10s`;
        break;
    }
  }

  // 属性升级
  upgrade() {
    if (this.level >= this.maxLevel) return false;
    
    this.level++;
    
    // 每一级提升属性约 60%
    if (this.type === "laser") {
      this.damage *= 1.6;
      this.range += 15;
    } 
    else if (this.type === "plasma") {
      this.damage *= 1.7;
      this.range += 20;
      this.splashRadius += 10;
      this.specialText = `AOE: ${Math.round(this.splashRadius)}px`;
    } 
    else if (this.type === "tesla") {
      this.damage *= 1.5;
      this.range += 15;
      this.chainCount += 1;
      this.slowAmount = Math.min(0.7, this.slowAmount + 0.05);
      this.specialText = `CHAIN: ${this.chainCount} / SLOW: ${Math.round(this.slowAmount * 100)}%`;
    } 
    else if (this.type === "harvester") {
      this.harvestEnergy += 15;
      this.specialText = `HARVEST: +${this.harvestEnergy}e / 10s`;
    }

    this.refund += Math.round(this.upgradeCost * 0.5);
    this.upgradeCost = Math.round(this.upgradeCost * 1.5);

    // 播放升级音效
    soundManager.playUpgrade();
    // 升级粒子
    particleSystem.addExplosion(this.x, this.y, this.color, 10, 60);

    return true;
  }

  // 选择范围内最靠前的敌人
  findTarget(enemies) {
    if (this.range === 0) return null;

    let bestTarget = null;
    let maxDistanceTravelled = -1;

    for (const enemy of enemies) {
      if (enemy.isDead || enemy.isFinished) continue;
      
      const dist = Math.hypot(enemy.x - this.x, enemy.y - this.y);
      if (dist <= this.getActualRange()) {
        // 计算敌人当前走过的总像素值 (pathIndex 加上到拐点的距离)
        // 近似使用 progress = pathIndex * 200 + 已过拐点距离 简化判断
        const progress = enemy.pathIndex * 1000 + enemy.x; // 坐标越靠右/下代表跑得越远
        if (progress > maxDistanceTravelled) {
          maxDistanceTravelled = progress;
          bestTarget = enemy;
        }
      }
    }
    return bestTarget;
  }

  // 获得融合了科技树加成的实际攻击范围
  getActualRange() {
    let rangeBonus = 1;
    // 假设有科技树解锁了范围：此处也可以扩展
    return this.range * rangeBonus;
  }

  // 获得科技树加成后的实际伤害
  getActualDamage() {
    let damageBonus = 1.0;
    
    // 如果解锁了“等离子增幅”科技，等离子重炮伤害提升 20%
    if (this.type === "plasma" && window.gameEngine.techUpgrades['tech-laser-dmg']) {
      damageBonus += 0.20;
    }
    return this.damage * damageBonus;
  }

  // 获取量子采集器实际单次获得金币
  getActualHarvestEnergy() {
    let amt = this.harvestEnergy;
    // 如果解锁了“量子萃取优化”科技，采集器金币提升 50%
    if (window.gameEngine.techUpgrades['tech-harvester-boost']) {
      amt *= 1.5;
    }
    return Math.round(amt);
  }

  update(dt, enemies) {
    // 计时器减少
    if (this.cooldown > 0) {
      this.cooldown -= dt;
    }

    // 1. 量子采集器逻辑
    if (this.type === "harvester") {
      this.harvestProgress += dt;
      if (this.harvestProgress >= 10.0) { // 10秒一个周期
        this.harvestProgress = 0;
        const reward = this.getActualHarvestEnergy();
        window.gameEngine.energy += reward;
        // 漂字和音效
        particleSystem.addFloatingText(this.x, this.y - 20, `+${reward}e`, "#ffb800", 15);
        soundManager.playBuild(); // 采集音效用 build 代替，较清脆
      }
      return; // 采集器无其他战斗逻辑
    }

    // 2. 战力输出塔目标判定
    // 检查原有目标是否依然有效
    if (this.target) {
      const dist = Math.hypot(this.target.x - this.x, this.target.y - this.y);
      if (this.target.isDead || this.target.isFinished || dist > this.getActualRange()) {
        this.target = null;
      }
    }

    // 寻敌
    if (!this.target) {
      this.target = this.findTarget(enemies);
    }

    // 炮头朝向角度转向目标
    if (this.target) {
      const targetAngle = Math.atan2(this.target.y - this.y, this.target.x - this.x);
      // 平滑转向旋转
      const angleDiff = targetAngle - this.angle;
      this.angle += Math.sin(angleDiff) * 0.15; // 顺滑过渡
    }

    // 3. 开火逻辑
    if (this.target && this.cooldown <= 0) {
      this.fire();
    }
  }

  fire() {
    // 应用超频科技 (全局超频技能激活时，冷却减少一半，相当于射速翻倍)
    const isOverclocked = window.gameEngine.overclockTimer > 0;
    const cooldownMultiplier = isOverclocked ? 0.5 : 1.0;

    switch (this.type) {
      case "laser":
        // 激光是持续攻击，不需要专门子弹
        // 频率极高，每帧根据 dt 计算并施加伤害
        const dmgPerSec = this.getActualDamage();
        const tickDmg = dmgPerSec / this.fireRate;
        this.target.takeDamage(tickDmg, "laser", this.x, this.y);
        
        // 激光音效每0.2秒最多播放一次
        if (!this.lastLaserSoundTime || Date.now() - this.lastLaserSoundTime > 200) {
          soundManager.playShootLaser();
          this.lastLaserSoundTime = Date.now();
        }
        
        this.cooldown = (1.0 / this.fireRate) * cooldownMultiplier;
        break;

      case "plasma":
        // 抛出能量炮弹
        let plasmaColor = this.color;
        let splashR = this.splashRadius;
        
        // 科技树：等离子范围提升 30%
        if (window.gameEngine.techUpgrades['tech-laser-dmg']) {
          splashR *= 1.3;
        }

        const bullet = new PlasmaBullet(
          this.x, this.y, 
          this.target, 
          this.getActualDamage(), 
          this.bulletSpeed, 
          splashR, 
          plasmaColor
        );
        window.gameEngine.projectiles.push(bullet);
        
        soundManager.playShootPlasma();
        this.cooldown = (1.0 / this.fireRate) * cooldownMultiplier;
        break;

      case "tesla":
        // 链式闪电
        this.fireTeslaChain();
        soundManager.playShootTesla();
        this.cooldown = (1.0 / this.fireRate) * cooldownMultiplier;
        break;
    }
  }

  fireTeslaChain() {
    const enemies = window.gameEngine.enemies;
    let currentSrc = this;
    let currentDmg = this.getActualDamage();
    
    // 特斯拉科技树：弹射数 +1
    let maxChains = this.chainCount;
    let actualSlow = this.slowAmount;
    if (window.gameEngine.techUpgrades['tech-tesla-chain']) {
      maxChains += 1;
      actualSlow = 0.50; // 减速变50%
    }

    let hitEnemies = new Set();
    let chainPath = [];

    // 第一跳
    this.target.takeDamage(currentDmg, "tesla", this.x, this.y);
    this.target.applySlow(actualSlow, this.slowDuration);
    hitEnemies.add(this.target);
    chainPath.push({ fromX: this.x, fromY: this.y, toX: this.target.x, toY: this.target.y });

    // 弹射后续跳
    let lastHit = this.target;
    for (let c = 1; c < maxChains; c++) {
      let nextTarget = null;
      let minDistance = 100; // 弹射范围

      for (const enemy of enemies) {
        if (enemy.isDead || enemy.isFinished || hitEnemies.has(enemy)) continue;
        const d = Math.hypot(enemy.x - lastHit.x, enemy.y - lastHit.y);
        if (d < minDistance) {
          minDistance = d;
          nextTarget = enemy;
        }
      }

      if (nextTarget) {
        // 衰减伤害
        currentDmg *= 0.8;
        nextTarget.takeDamage(currentDmg, "tesla", lastHit.x, lastHit.y);
        nextTarget.applySlow(actualSlow, this.slowDuration);
        hitEnemies.add(nextTarget);
        chainPath.push({ fromX: lastHit.x, fromY: lastHit.y, toX: nextTarget.x, toY: nextTarget.y });
        lastHit = nextTarget;
      } else {
        break;
      }
    }

    // 记录电弧线条用于在一帧中绘制
    this.teslaChains = chainPath;
    this.teslaChainAlpha = 1.0; // 用于淡出动画
  }

  draw(ctx) {
    ctx.save();

    // 1. 绘制已选状态的射程环
    const isSelected = (window.gameEngine.selectedTower === this);
    if (isSelected && this.type !== "harvester") {
      ctx.strokeStyle = "rgba(0, 240, 255, 0.25)";
      ctx.lineWidth = 1;
      ctx.fillStyle = "rgba(0, 240, 255, 0.03)";
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.getActualRange(), 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // 虚线射程圈外边
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = "rgba(0, 240, 255, 0.4)";
      ctx.stroke();
    }

    // 2. 绘制防御塔底座
    ctx.shadowBlur = 4;
    ctx.shadowColor = this.color;
    
    // 画一个带斜边切角的灰色多边形作为地盘
    ctx.fillStyle = "#161d30";
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(this.x, this.y, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // 内环装饰
    ctx.strokeStyle = this.color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(this.x, this.y, 17, 0, Math.PI * 2);
    ctx.stroke();

    // 3. 绘制防御塔炮头 (带自转角度)
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);

    ctx.fillStyle = this.color;

    if (this.type === "laser") {
      // 激光炮台外观：一个细长的双管发射轨
      ctx.fillStyle = "#0c101d";
      ctx.strokeStyle = this.color;
      ctx.lineWidth = 2;
      ctx.strokeRect(-12, -7, 20, 14);
      ctx.fillRect(-12, -7, 20, 14);

      // 发射管
      ctx.fillStyle = this.color;
      ctx.fillRect(8, -5, 12, 3);
      ctx.fillRect(8, 2, 12, 3);
    } 
    else if (this.type === "plasma") {
      // 重炮外观：厚重的矩形炮管和后置圆筒
      ctx.fillStyle = "#0c101d";
      ctx.strokeStyle = this.color;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(-4, 0, 9, 0, Math.PI*2);
      ctx.fill();
      ctx.stroke();

      // 粗大炮管
      ctx.fillStyle = this.color;
      ctx.fillRect(4, -5, 16, 10);
      
      // 炮口内嵌白色核心
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(17, -3, 3, 6);
    } 
    else if (this.type === "tesla") {
      // 电磁塔外观：圆形法师球，带放射性针刺
      ctx.fillStyle = "#0c101d";
      ctx.strokeStyle = this.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // 四个电极向外发散
      ctx.strokeStyle = this.color;
      ctx.lineWidth = 2;
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 2) {
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * 8, Math.sin(a) * 8);
        ctx.lineTo(Math.cos(a) * 15, Math.sin(a) * 15);
        ctx.stroke();
      }

      // 中心白核
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(0, 0, 4, 0, Math.PI * 2);
      ctx.fill();
    } 
    else if (this.type === "harvester") {
      // 采集器外观：立方形太阳翼发光片
      ctx.rotate(-this.angle + Date.now() * 0.001); // 覆盖其自身旋转，变成常速旋转
      ctx.fillStyle = "#1c1f0d";
      ctx.strokeStyle = this.color;
      ctx.lineWidth = 2;
      ctx.strokeRect(-9, -9, 18, 18);
      ctx.fillRect(-9, -9, 18, 18);

      // 两侧发光的太阳翼
      ctx.fillStyle = this.color;
      ctx.fillRect(-18, -3, 9, 6);
      ctx.fillRect(9, -3, 9, 6);
      
      // 渲染能量收集环进度 (顺时针填充环)
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      const fillPercent = this.harvestProgress / 10.0;
      ctx.arc(0, 0, 14, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * fillPercent);
      ctx.stroke();
    }

    // 绘制等级标识 (几颗小星星或小方块)
    if (this.level > 1) {
      ctx.fillStyle = "#ffffff";
      ctx.shadowBlur = 0;
      for (let i = 0; i < this.level - 1; i++) {
        // 在炮塔下方点缀小圆点
        ctx.beginPath();
        ctx.arc(-12 + i * 6, 12, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();

    // 4. 绘制开火线 (若处于激光攻击)
    if (this.target && this.type === "laser") {
      ctx.save();
      // 激光内层白线加外层青光
      ctx.strokeStyle = "rgba(0, 240, 255, 0.4)";
      ctx.lineWidth = 5;
      ctx.shadowColor = "#00f0ff";
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.moveTo(this.x, this.y);
      ctx.lineTo(this.target.x, this.target.y);
      ctx.stroke();

      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.5;
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.moveTo(this.x, this.y);
      ctx.lineTo(this.target.x, this.target.y);
      ctx.stroke();
      ctx.restore();
    }

    // 5. 绘制特斯拉闪电弹射电弧 (带淡出)
    if (this.teslaChains && this.teslaChainAlpha > 0) {
      ctx.save();
      ctx.globalAlpha = this.teslaChainAlpha;
      ctx.strokeStyle = "#ffffff";
      ctx.shadowColor = this.color;
      ctx.shadowBlur = 15;
      ctx.lineWidth = 1.5;

      for (const line of this.teslaChains) {
        ctx.beginPath();
        ctx.moveTo(line.fromX, line.fromY);
        
        // 绘制折线模拟闪电
        const segments = 4;
        const dx = line.toX - line.fromX;
        const dy = line.toY - line.fromY;
        const len = Math.hypot(dx, dy);
        const perpX = -dy / len;
        const perpY = dx / len;

        for (let i = 1; i < segments; i++) {
          const ratio = i / segments;
          const px = line.fromX + dx * ratio;
          const py = line.fromY + dy * ratio;
          // 随机左右抖动
          const jitter = (Math.random() - 0.5) * 15;
          ctx.lineTo(px + perpX * jitter, py + perpY * jitter);
        }
        ctx.lineTo(line.toX, line.toY);
        ctx.stroke();
      }

      ctx.restore();
      // 每一帧衰减电弧不透明度
      this.teslaChainAlpha -= dt * 6.0; // 约0.17秒消失
    }
  }
}

// 导出全局构造类
window.Tower = Tower;
