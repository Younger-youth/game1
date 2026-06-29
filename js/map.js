class GameMap {
  constructor(canvas) {
    this.canvas = canvas;
    this.gridSize = 60;
    this.cols = 16; // 960 / 60
    this.rows = 10; // 600 / 60
    
    // 路线连接点 (像素坐标)
    this.path = [
      { x: -30, y: 150 },  // 起点 (画布左侧外)
      { x: 150, y: 150 },
      { x: 150, y: 450 },
      { x: 450, y: 450 },
      { x: 450, y: 150 },
      { x: 750, y: 150 },
      { x: 750, y: 450 },
      { x: 990, y: 450 }   // 终点 (画布右侧外)
    ];

    // 网格状态：0 = 空地可建, 1 = 路径占满不可建, 2 = 已建防御塔
    this.grid = [];
    this.initGrid();
  }

  initGrid() {
    this.grid = [];
    for (let c = 0; c < this.cols; c++) {
      this.grid[c] = [];
      for (let r = 0; r < this.rows; r++) {
        this.grid[c][r] = 0; // 初始全是空地
      }
    }
    
    // 根据路径自动计算哪些格子是路径格子并标记为 1
    this.markPathGrids();
  }

  // 标出路径覆盖的网格
  markPathGrids() {
    const checkRadius = 25; // 稍小于网格半径，避免对角斜贴擦边误判
    
    for (let c = 0; c < this.cols; c++) {
      for (let r = 0; r < this.rows; r++) {
        // 格子中心点
        const gx = c * this.gridSize + this.gridSize / 2;
        const gy = r * this.gridSize + this.gridSize / 2;
        
        // 遍历路径线段，检查点到线段的距离是否小于阈值
        for (let i = 0; i < this.path.length - 1; i++) {
          const p1 = this.path[i];
          const p2 = this.path[i + 1];
          if (this.pointToSegmentDistance(gx, gy, p1.x, p1.y, p2.x, p2.y) < checkRadius) {
            this.grid[c][r] = 1; // 标记为路径
            break;
          }
        }
      }
    }
  }

  // 点到线段的最短距离公式
  pointToSegmentDistance(x, y, x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    if (dx === 0 && dy === 0) {
      return Math.hypot(x - x1, y - y1);
    }
    
    // 计算投影长度比例 t
    let t = ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy);
    t = Math.max(0, Math.min(1, t)); // 约束在线段上
    
    const closestX = x1 + t * dx;
    const closestY = y1 + t * dy;
    
    return Math.hypot(x - closestX, y - closestY);
  }

  // 将屏幕像素坐标转换为网格索引
  getGridCoords(px, py) {
    const col = Math.floor(px / this.gridSize);
    const row = Math.floor(py / this.gridSize);
    if (col >= 0 && col < this.cols && row >= 0 && row < this.rows) {
      return { col, row };
    }
    return null;
  }

  // 获取网格中心像素坐标
  getCellCenter(col, row) {
    return {
      x: col * this.gridSize + this.gridSize / 2,
      y: row * this.gridSize + this.gridSize / 2
    };
  }

  // 检查某个网格是否可建塔
  isBuildable(col, row) {
    if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) return false;
    return this.grid[col][row] === 0;
  }

  // 占用或释放网格
  setGridState(col, row, state) {
    if (col >= 0 && col < this.cols && row >= 0 && row < this.rows) {
      this.grid[col][row] = state;
    }
  }

  // 绘制网格背景
  drawGrid(ctx) {
    ctx.save();
    ctx.strokeStyle = "rgba(0, 240, 255, 0.05)";
    ctx.lineWidth = 1;
    
    // 画纵线
    for (let c = 0; c <= this.cols; c++) {
      ctx.beginPath();
      ctx.moveTo(c * this.gridSize, 0);
      ctx.lineTo(c * this.gridSize, this.canvas.height);
      ctx.stroke();
    }
    
    // 画横线
    for (let r = 0; r <= this.rows; r++) {
      ctx.beginPath();
      ctx.moveTo(0, r * this.gridSize);
      ctx.lineTo(this.canvas.width, r * this.gridSize);
      ctx.stroke();
    }
    
    ctx.restore();
  }

  // 绘制霓虹防线路径
  drawPath(ctx) {
    ctx.save();
    
    // 1. 底层粗发光管线
    ctx.strokeStyle = "rgba(0, 110, 255, 0.15)";
    ctx.lineWidth = 26;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.shadowColor = "rgba(0, 150, 255, 0.5)";
    ctx.shadowBlur = 10;
    
    ctx.beginPath();
    ctx.moveTo(this.path[0].x, this.path[0].y);
    for (let i = 1; i < this.path.length; i++) {
      ctx.lineTo(this.path[i].x, this.path[i].y);
    }
    ctx.stroke();
    
    // 2. 中层偏亮导线
    ctx.strokeStyle = "rgba(0, 240, 255, 0.5)";
    ctx.lineWidth = 8;
    ctx.shadowBlur = 0; // 提升性能
    ctx.beginPath();
    ctx.moveTo(this.path[0].x, this.path[0].y);
    for (let i = 1; i < this.path.length; i++) {
      ctx.lineTo(this.path[i].x, this.path[i].y);
    }
    ctx.stroke();

    // 3. 核心内芯极亮线
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(this.path[0].x, this.path[0].y);
    for (let i = 1; i < this.path.length; i++) {
      ctx.lineTo(this.path[i].x, this.path[i].y);
    }
    ctx.stroke();

    // 4. 起点传送门特效 (入口)
    const startNode = this.path[0];
    const spawnerX = startNode.x + 30 + 10; // 让它露出来一点
    const pulse = 1 + Math.sin(Date.now() * 0.005) * 0.1;
    
    ctx.shadowColor = "rgba(255, 0, 127, 0.8)";
    ctx.shadowBlur = 15;
    ctx.fillStyle = "rgba(255, 0, 127, 0.2)";
    ctx.strokeStyle = "rgba(255, 0, 127, 0.8)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(spawnerX + 20, startNode.y, 25 * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // 绘制入口标识
    ctx.fillStyle = "#ff007f";
    ctx.font = "9px 'Orbitron'";
    ctx.textAlign = "center";
    ctx.fillText("INBOUND", spawnerX + 20, startNode.y - 30);

    // 5. 终点核心门特效 (出口)
    const endNode = this.path[this.path.length - 1];
    const coreX = endNode.x - 30 - 10;
    
    ctx.shadowColor = "rgba(0, 255, 102, 0.8)";
    ctx.shadowBlur = 15;
    ctx.fillStyle = "rgba(0, 255, 102, 0.2)";
    ctx.strokeStyle = "rgba(0, 255, 102, 0.8)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(coreX - 20, endNode.y, 25 * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // 绘制出口标识
    ctx.fillStyle = "#00ff66";
    ctx.fillText("CORE LINK", coreX - 20, endNode.y - 30);
    
    ctx.restore();
  }

  // 绘制被选中格子或鼠标悬停预览格子
  drawHoverCell(ctx, col, row, canBuild) {
    if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) return;
    
    ctx.save();
    ctx.fillStyle = canBuild ? "rgba(0, 240, 255, 0.15)" : "rgba(255, 51, 68, 0.15)";
    ctx.strokeStyle = canBuild ? "rgba(0, 240, 255, 0.7)" : "rgba(255, 51, 68, 0.7)";
    ctx.lineWidth = 2;
    
    const x = col * this.gridSize;
    const y = row * this.gridSize;
    
    ctx.fillRect(x + 2, y + 2, this.gridSize - 4, this.gridSize - 4);
    ctx.strokeRect(x + 2, y + 2, this.gridSize - 4, this.gridSize - 4);
    
    // 角部霓虹线修饰，看起来更有科幻感
    ctx.strokeStyle = canBuild ? "#00f0ff" : "#ff3344";
    ctx.lineWidth = 3;
    const len = 8;
    
    // 左上
    ctx.beginPath();
    ctx.moveTo(x + 2, y + 2 + len);
    ctx.lineTo(x + 2, y + 2);
    ctx.lineTo(x + 2 + len, y + 2);
    ctx.stroke();
    // 右上
    ctx.beginPath();
    ctx.moveTo(x + this.gridSize - 2 - len, y + 2);
    ctx.lineTo(x + this.gridSize - 2, y + 2);
    ctx.lineTo(x + this.gridSize - 2, y + 2 + len);
    ctx.stroke();
    // 左下
    ctx.beginPath();
    ctx.moveTo(x + 2, y + this.gridSize - 2 - len);
    ctx.lineTo(x + 2, y + this.gridSize - 2);
    ctx.lineTo(x + 2 + len, y + this.gridSize - 2);
    ctx.stroke();
    // 右下
    ctx.beginPath();
    ctx.moveTo(x + this.gridSize - 2 - len, y + this.gridSize - 2);
    ctx.lineTo(x + this.gridSize - 2, y + this.gridSize - 2);
    ctx.lineTo(x + this.gridSize - 2, y + this.gridSize - 2 - len);
    ctx.stroke();
    
    ctx.restore();
  }
}

// 导出全局构造类
window.GameMap = GameMap;
