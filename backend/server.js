const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

// 加載環境變量
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// 判斷是否為生產環境
const isProduction = process.env.NODE_ENV === 'production';

// 💡 允許以逗號分隔多個前端網域，例如
// FRONTEND_URL="https://myapp.netlify.app,https://www.myapp.com"
const allowedOrigins = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(',').map(o => o.trim())
  : undefined;

// 中間件
app.use(cors({
  origin: isProduction ? (allowedOrigins || true) : 'http://localhost:3000',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 信任代理（Railway需要）
if (isProduction) {
  app.set('trust proxy', 1);
}

// 靜態文件服務（生產環境）
if (isProduction) {
  const buildPath = path.join(__dirname, '../frontend/build');
  app.use(express.static(buildPath));
  
  console.log(`📁 靜態文件目錄: ${buildPath}`);
  console.log(`📁 靜態文件存在: ${fs.existsSync(buildPath)}`);
}

// 簡單的健康檢查端點（Railway專用）
app.get('/health', (req, res) => {
  console.log('📋 收到健康檢查請求');
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: Math.round(process.uptime()),
    port: PORT
  });
});

// 詳細的健康檢查端點
app.get('/health-detailed', (req, res) => {
  try {
    console.log('📋 收到詳細健康檢查請求');
    
    // 檢查存儲系統
    let storageHealth = null;
    try {
      const storage = require('./data/storage');
      storageHealth = storage.healthCheck();
    } catch (err) {
      console.error('❌ 存儲健康檢查失敗:', err.message);
      storageHealth = { status: 'unhealthy', error: err.message };
    }
    
    const healthData = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      port: PORT,
      version: '1.0.0',
      storage: storageHealth,
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + ' MB',
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + ' MB'
      }
    };
    
    console.log('✅ 詳細健康檢查通過:', healthData.status);
    res.status(200).json(healthData);
  } catch (error) {
    console.error('❌ 詳細健康檢查失敗:', error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message,
      port: PORT
    });
  }
});

// API路由前綴
app.use('/api/v1', (req, res, next) => {
  res.header('X-API-Version', '1.0.0');
  next();
});

// 導入路由
const bookingRoutes = require('./routes/bookings');
const adminRoutes = require('./routes/admin');
const aiRoutes = require('./routes/ai');

// 使用路由
app.use('/api/bookings', bookingRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/ai', aiRoutes);

// API基本路由
app.get('/api', (req, res) => {
  res.json({ 
    message: 'AI場地預訂系統後端API',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/health',
      bookings: '/api/bookings',
      admin: '/api/admin',
      ai: '/api/ai'
    }
  });
});

// 確保數據目錄存在
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// 初始化數據文件
const bookingsFile = path.join(dataDir, 'bookings.json');
if (!fs.existsSync(bookingsFile)) {
  fs.writeFileSync(bookingsFile, JSON.stringify([], null, 2));
}

// React應用路由處理（生產環境）
if (isProduction) {
  app.get('*', (req, res) => {
    // 如果是API請求但沒找到，返回404
    if (req.path.startsWith('/api/')) {
      return res.status(404).json({ 
        error: 'API endpoint not found',
        path: req.path 
      });
    }
    
    // 否則返回React應用
    const indexPath = path.join(__dirname, '../frontend/build/index.html');
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(404).json({ 
        error: 'Frontend build not found',
        message: 'Please run npm run build first' 
      });
    }
  });
}

// 錯誤處理中間件
app.use((err, req, res, next) => {
  console.error('❌ 服務器錯誤:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: isProduction ? 'Something went wrong' : err.message,
    timestamp: new Date().toISOString()
  });
});

// 處理未捕獲的Promise拒絕
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ 未處理的Promise拒絕:', reason);
});

// 處理未捕獲的異常
process.on('uncaughtException', (error) => {
  console.error('❌ 未捕獲的異常:', error);
  process.exit(1);
});

// 優雅關閉
process.on('SIGTERM', () => {
  console.log('📴 收到SIGTERM信號，開始優雅關閉...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('📴 收到SIGINT信號，開始優雅關閉...');
  process.exit(0);
});

// 啟動前檢查
console.log('🔧 啟動前檢查...');
console.log(`📍 PORT環境變量: ${process.env.PORT}`);
console.log(`📍 實際監聽端口: ${PORT}`);
console.log(`🌐 NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
console.log(`📂 當前工作目錄: ${process.cwd()}`);
console.log(`📂 __dirname: ${__dirname}`);

// 確保在生產環境中設置NODE_ENV
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'production';
  console.log('🔧 設置NODE_ENV為production');
}

// 檢查路由文件是否存在
const routeFiles = ['./routes/bookings', './routes/admin', './routes/ai'];
routeFiles.forEach(file => {
  try {
    require.resolve(file);
    console.log(`✅ 路由文件存在: ${file}`);
  } catch (err) {
    console.error(`❌ 路由文件缺失: ${file}`, err.message);
  }
});

// 檢查數據存儲
try {
  const storage = require('./data/storage');
  const healthCheck = storage.healthCheck();
  console.log('📊 存儲健康檢查:', healthCheck);
} catch (err) {
  console.error('❌ 存儲模塊錯誤:', err.message);
}

// 啟動服務器
console.log(`🚀 嘗試啟動服務器在端口 ${PORT}...`);
console.log(`📍 綁定地址: 0.0.0.0:${PORT}`);

const server = app.listen(PORT, '0.0.0.0', (err) => {
  if (err) {
    console.error('❌ 服務器啟動失敗:', err);
    console.error('錯誤詳情:', err.stack);
    process.exit(1);
  }
  
  const address = server.address();
  console.log('🚀 AI場地預訂系統啟動成功！');
  console.log(`📍 服務器實際運行在: ${address.address}:${address.port}`);
  console.log(`🌐 環境: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔧 健康檢查: http://0.0.0.0:${PORT}/health`);
  console.log(`📊 API根路徑: http://0.0.0.0:${PORT}/api`);
  console.log(`🗂️ 進程ID: ${process.pid}`);
  console.log(`💾 內存使用: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);
  
  if (isProduction) {
    console.log(`🎨 前端應用: http://0.0.0.0:${PORT}`);
  } else {
    console.log(`🎨 前端開發服務器: http://localhost:3000`);
  }
  
  // 測試健康檢查端點
  setTimeout(() => {
    const http = require('http');
    const options = {
      hostname: '127.0.0.1',
      port: PORT,
      path: '/health',
      method: 'GET',
      timeout: 5000
    };
    
    console.log('🧪 執行健康檢查自測...');
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        console.log(`✅ 健康檢查自測成功: ${res.statusCode}`);
        console.log(`📋 響應內容: ${data}`);
      });
    });
    
    req.on('error', (err) => {
      console.error('❌ 健康檢查自測失敗:', err.message);
    });
    
    req.on('timeout', () => {
      console.error('❌ 健康檢查自測超時');
      req.destroy();
    });
    
    req.end();
  }, 3000);
});

// 監聽啟動錯誤
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ 端口 ${PORT} 已被佔用`);
  } else {
    console.error('❌ 服務器錯誤:', err);
  }
  process.exit(1);
});

// 設置服務器超時
server.timeout = 30000; // 30秒

module.exports = app; 