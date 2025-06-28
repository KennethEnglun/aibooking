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

// 中間件
app.use(cors({
  origin: isProduction ? true : 'http://localhost:3000',
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

// 健康檢查端點
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    port: PORT,
    version: '1.0.0'
  });
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

// 啟動服務器
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log('🚀 AI場地預訂系統啟動成功！');
  console.log(`📍 服務器運行在: http://0.0.0.0:${PORT}`);
  console.log(`🌐 環境: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔧 健康檢查: http://0.0.0.0:${PORT}/health`);
  console.log(`📊 API根路徑: http://0.0.0.0:${PORT}/api`);
  
  if (isProduction) {
    console.log(`🎨 前端應用: http://0.0.0.0:${PORT}`);
  } else {
    console.log(`🎨 前端開發服務器: http://localhost:3000`);
  }
});

// 設置服務器超時
server.timeout = 30000; // 30秒

module.exports = app; 