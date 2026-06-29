// 粒子系统，管理所有的粒子特效与漂字效果
class Particle {
  constructor(x, y, vx, vy, color, size, decay, gravity = 0) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.color = color;
    this.size = size;
    this.alpha = 1;
    this.decay = decay; // 每帧透明度减少值
    this.gravity = gravity;
  }

  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.vy += this.gravity * dt;
    this.alpha -= this.decay * dt;
  }

  draw(ctx) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, this.alpha);
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

class FloatingText {
  constructor(x, y, text, color, fontSize = 16, weight = "bold") {
    this.x = x;
    this.y = y;
    this.text = text;
    this.color = color;
    this.fontSize = fontSize;
    this.weight = weight;
    this.alpha = 1;
    // 随机向上且轻微左右漂移
    this.vx = (Math.random() - 0.5) * 20;
    this.vy = -60 - Math.random() * 40;
    this.decay = 1.2; // 约0.8秒内消失
  }

  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.alpha -= this.decay * dt;
  }

  draw(ctx) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, this.alpha);
    ctx.fillStyle = this.color;
    ctx.font = `${this.weight} ${this.fontSize}px 'Share Tech Mono', monospace`;
    ctx.textAlign = 'center';
    
    // 给数字加个深色背景投影，方便看清
    ctx.shadowColor = 'black';
    ctx.shadowBlur = 4;
    ctx.fillText(this.text, this.x, this.y);
    ctx.restore();
  }
}

// 冲击波圈效果
class ShockwaveRing {
  constructor(x, y, maxRadius, color, speed = 150) {
    this.x = x;
    this.y = y;
    this.radius = 2;
    this.maxRadius = maxRadius;
    this.color = color;
    this.speed = speed;
    this.alpha = 1;
  }

  update(dt) {
    this.radius += this.speed * dt;
    this.alpha = 1 - (this.radius / this.maxRadius);
  }

  draw(ctx) {
    if (this.alpha <= 0) return;
    ctx.save();
    ctx.globalAlpha = this.alpha;
    ctx.strokeStyle = this.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

class ParticleSystem {
  constructor() {
    this.particles = [];
    this.texts = [];
    this.rings = [];
  }

  clear() {
    this.particles = [];
    this.texts = [];
    this.rings = [];
  }

  // 释放环形爆炸粒子
  addExplosion(x, y, color, count = 15, baseSpeed = 80) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = (0.3 + Math.random() * 0.7) * baseSpeed;
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;
      const size = 1.5 + Math.random() * 3;
      const decay = 1.0 + Math.random() * 1.5; // 0.6到1秒消失
      this.particles.push(new Particle(x, y, vx, vy, color, size, decay));
    }
    // 添加一个发散光环
    this.rings.push(new ShockwaveRing(x, y, 40 + Math.random() * 20, color));
  }

  // 释放受击溅射花火
  addSparks(x, y, sourceX, sourceY, color, count = 5) {
    // 计算受击方向的反方向，使火花朝攻击来向溅射
    const angle = Math.atan2(y - sourceY, x - sourceX) + Math.PI;
    for (let i = 0; i < count; i++) {
      const spreadAngle = angle + (Math.random() - 0.5) * 1.2;
      const speed = 40 + Math.random() * 80;
      const vx = Math.cos(spreadAngle) * speed;
      const vy = Math.sin(spreadAngle) * speed;
      const size = 1 + Math.random() * 2;
      const decay = 1.8 + Math.random() * 1.5; // 0.3到0.6秒消失
      this.particles.push(new Particle(x, y, vx, vy, color, size, decay));
    }
  }

  // 释放浮动文字
  addFloatingText(x, y, text, color, fontSize = 16, weight = "bold") {
    this.texts.push(new FloatingText(x, y, text, color, fontSize, weight));
  }

  update(dt) {
    // 更新粒子
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.update(dt);
      if (p.alpha <= 0) {
        this.particles.splice(i, 1);
      }
    }

    // 更新文本
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i];
      t.update(dt);
      if (t.alpha <= 0) {
        this.texts.splice(i, 1);
      }
    }

    // 更新光波圈
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.update(dt);
      if (r.alpha <= 0 || r.radius >= r.maxRadius) {
        this.rings.splice(i, 1);
      }
    }
  }

  draw(ctx) {
    // 绘制粒子
    for (const p of this.particles) {
      p.draw(ctx);
    }
    
    // 绘制光圈
    for (const r of this.rings) {
      r.draw(ctx);
    }

    // 绘制漂字
    for (const t of this.texts) {
      t.draw(ctx);
    }
  }
}

// 导出全局单例
const particleSystem = new ParticleSystem();
window.particleSystem = particleSystem;
