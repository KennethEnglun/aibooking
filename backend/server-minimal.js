const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 8080;

// 判斷是否為生產環境
const isProduction = process.env.NODE_ENV === 'production';

console.log('🚀 啟動增強型最小化服務器...');
console.log(`📍 PORT: ${PORT}`);
console.log(`🌐 NODE_ENV: ${process.env.NODE_ENV}`);
console.log(`📂 當前目錄: ${process.cwd()}`);
console.log(`🎯 生產環境: ${isProduction}`);

// 基本中間件
app.use(cors({
  origin: isProduction ? true : 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 信任代理（Railway需要）
if (isProduction) {
  app.set('trust proxy', 1);
}

// 靜態文件服務（生產環境）
if (isProduction) {
  const buildPath = path.join(__dirname, '../frontend/build');
  console.log(`📁 靜態文件目錄: ${buildPath}`);
  console.log(`📁 靜態文件存在: ${fs.existsSync(buildPath)}`);
  
  if (fs.existsSync(buildPath)) {
    app.use(express.static(buildPath));
    console.log('✅ 靜態文件服務已配置');
  } else {
    console.log('⚠️ 前端構建文件不存在');
  }
}

// 導入並使用API路由
try {
  const bookingRoutes = require('./routes/bookings');
  const adminRoutes = require('./routes/admin'); 
  const aiRoutes = require('./routes/ai');
  
  app.use('/api/bookings', bookingRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/ai', aiRoutes);
  console.log('✅ API路由已加載');
} catch (error) {
  console.error('⚠️ API路由加載失敗:', error.message);
}

// 健康檢查 - 最簡版本
app.get('/health', (req, res) => {
  console.log('📋 健康檢查請求');
  res.json({ 
    status: 'ok', 
    time: new Date().toISOString(),
    port: PORT,
    env: process.env.NODE_ENV
  });
});

// API基本路由
app.get('/api', (req, res) => {
  res.json({ 
    message: 'AI場地預訂系統API - 最小化版本',
    version: '2.0.0',
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
      console.log(`📄 服務React應用: ${req.path}`);
      res.sendFile(indexPath);
    } else {
      console.error('❌ 前端構建文件不存在:', indexPath);
      res.status(404).json({ 
        error: 'Frontend build not found',
        message: 'Please run npm run build first',
        path: indexPath
      });
    }
  });
} else {
  // 開發環境的根路由
  app.get('/', (req, res) => {
    res.json({ 
      message: 'AI預訂系統 - 開發模式',
      status: 'running',
      port: PORT,
      time: new Date().toISOString(),
      note: '前端開發服務器運行在 http://localhost:3000'
    });
  });
}

// 錯誤處理
app.use((err, req, res, next) => {
  console.error('❌ 錯誤:', err);
  res.status(500).json({ 
    error: 'Internal Server Error',
    message: isProduction ? 'Something went wrong' : err.message
  });
});

// 啟動服務器
console.log(`🚀 綁定到 0.0.0.0:${PORT}...`);
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ 增強型最小化服務器成功啟動在端口 ${PORT}`);
  console.log(`🔗 健康檢查: http://0.0.0.0:${PORT}/health`);
  console.log(`📊 API根路徑: http://0.0.0.0:${PORT}/api`);
  if (isProduction) {
    console.log(`🎨 前端應用: http://0.0.0.0:${PORT}`);
  }
});

server.on('error', (err) => {
  console.error('❌ 服務器錯誤:', err);
  process.exit(1);
});

// 優雅關閉
process.on('SIGTERM', () => {
  console.log('📴 收到SIGTERM，關閉服務器...');
  server.close(() => process.exit(0));
});

process.on('SIGINT', () => {
  console.log('📴 收到SIGINT，關閉服務器...');
  server.close(() => process.exit(0));
}); 