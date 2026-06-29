class SoundManager {
  constructor() {
    this.ctx = null;
    this.enabled = true;
  }

  init() {
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      console.warn("Web Audio API not supported", e);
    }
  }

  toggle() {
    this.enabled = !this.enabled;
    return this.enabled;
  }

  // 播放激光音效
  playShootLaser() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx || this.ctx.state === 'suspended') return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(800, this.ctx.currentTime);
    // 快速降频形成激光感
    osc.frequency.exponentialRampToValueAtTime(150, this.ctx.currentTime + 0.15);

    gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.15);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.16);
  }

  // 播放等离子炮弹音效
  playShootPlasma() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx || this.ctx.state === 'suspended') return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(40, this.ctx.currentTime + 0.4);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(200, this.ctx.currentTime);

    gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.4);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.41);
  }

  // 播放特斯拉电弧音效
  playShootTesla() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx || this.ctx.state === 'suspended') return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(60, this.ctx.currentTime);
    // 高频抖动模拟电弧
    for (let i = 0; i < 5; i++) {
      const time = this.ctx.currentTime + i * 0.04;
      osc.frequency.setValueAtTime(100 + Math.random() * 800, time);
    }

    gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.2);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.21);
  }

  // 播放爆炸音效 (带带噪声)
  playExplosion() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx || this.ctx.state === 'suspended') return;

    const bufferSize = this.ctx.sampleRate * 0.5; // 0.5秒
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    // 生成白噪声
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noiseNode = this.ctx.createBufferSource();
    noiseNode.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    // 快速衰减截止频率
    filter.frequency.setValueAtTime(600, this.ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(30, this.ctx.currentTime + 0.4);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.25, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.5);

    noiseNode.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    noiseNode.start();
    noiseNode.stop(this.ctx.currentTime + 0.51);
  }

  // 播放建造音效
  playBuild() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx || this.ctx.state === 'suspended') return;

    const now = this.ctx.currentTime;
    const notes = [261.63, 329.63, 392.00, 523.25]; // C大和弦
    notes.forEach((freq, index) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + index * 0.05);

      gain.gain.setValueAtTime(0.08, now + index * 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + index * 0.05 + 0.2);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now + index * 0.05);
      osc.stop(now + index * 0.05 + 0.21);
    });
  }

  // 播放升级音效
  playUpgrade() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx || this.ctx.state === 'suspended') return;

    const now = this.ctx.currentTime;
    const notes = [392.00, 523.25, 659.25, 783.99, 1046.50]; // 快速琶音
    notes.forEach((freq, index) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + index * 0.04);

      gain.gain.setValueAtTime(0.06, now + index * 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, now + index * 0.04 + 0.15);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now + index * 0.04);
      osc.stop(now + index * 0.04 + 0.16);
    });
  }

  // 播放核心受击音效
  playBaseHit() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx || this.ctx.state === 'suspended') return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(80, this.ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(40, this.ctx.currentTime + 0.25);

    gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.25);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.26);
  }

  // 播放胜利音效
  playWin() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx || this.ctx.state === 'suspended') return;

    const now = this.ctx.currentTime;
    const melody = [
      { f: 523.25, d: 0.15 }, // C5
      { f: 587.33, d: 0.15 }, // D5
      { f: 659.25, d: 0.15 }, // E5
      { f: 783.99, d: 0.25 }, // G5
      { f: 659.25, d: 0.15 }, // E5
      { f: 783.99, d: 0.50 }  // G5
    ];

    let currentOffset = 0;
    melody.forEach((note) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(note.f, now + currentOffset);

      gain.gain.setValueAtTime(0.1, now + currentOffset);
      gain.gain.exponentialRampToValueAtTime(0.001, now + currentOffset + note.d);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now + currentOffset);
      osc.stop(now + currentOffset + note.d + 0.05);

      currentOffset += note.d * 0.8;
    });
  }

  // 播放失败音效
  playLose() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx || this.ctx.state === 'suspended') return;

    const now = this.ctx.currentTime;
    const melody = [
      { f: 220.00, d: 0.25 }, // A3
      { f: 207.65, d: 0.25 }, // G#3
      { f: 196.00, d: 0.25 }, // G3
      { f: 174.61, d: 0.60 }  // F3
    ];

    let currentOffset = 0;
    melody.forEach((note) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(note.f, now + currentOffset);

      gain.gain.setValueAtTime(0.12, now + currentOffset);
      gain.gain.exponentialRampToValueAtTime(0.001, now + currentOffset + note.d);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now + currentOffset);
      osc.stop(now + currentOffset + note.d + 0.05);

      currentOffset += note.d * 0.9;
    });
  }
}

// 导出全局单例
const soundManager = new SoundManager();
window.soundManager = soundManager;
