const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

// 加載環境變量
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// 中間件
app.use(cors());
app.use(express.json());

// 導入路由
const bookingRoutes = require('./routes/bookings');
const adminRoutes = require('./routes/admin');
const aiRoutes = require('./routes/ai');

// 使用路由
app.use('/api/bookings', bookingRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/ai', aiRoutes);

// 基本路由
app.get('/', (req, res) => {
  res.json({ 
    message: 'AI場地預訂系統後端API',
    version: '1.0.0',
    endpoints: {
      bookings: '/api/bookings',
      admin: '/api/admin',
      ai: '/api/ai'
    }
  });
});

// 確保數據目錄存在
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir);
}

// 初始化數據文件
const bookingsFile = path.join(dataDir, 'bookings.json');
if (!fs.existsSync(bookingsFile)) {
  fs.writeFileSync(bookingsFile, JSON.stringify([], null, 2));
}

// 啟動服務器
app.listen(PORT, () => {
  console.log(`🚀 服務器運行在 http://localhost:${PORT}`);
  console.log(`📊 API文檔: http://localhost:${PORT}`);
}); 