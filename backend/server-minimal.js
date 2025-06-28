const express = require('express');
const app = express();
const PORT = process.env.PORT || 8080;

console.log('🚀 啟動最小化服務器...');
console.log(`📍 PORT: ${PORT}`);
console.log(`🌐 NODE_ENV: ${process.env.NODE_ENV}`);
console.log(`📂 當前目錄: ${process.cwd()}`);

// 基本中間件
app.use(express.json());

// 健康檢查 - 最簡版本
app.get('/health', (req, res) => {
  console.log('📋 健康檢查請求');
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// 根路由
app.get('/', (req, res) => {
  res.json({ 
    message: 'AI預訂系統 - 最小化版本',
    status: 'running',
    port: PORT,
    time: new Date().toISOString()
  });
});

// 錯誤處理
app.use((err, req, res, next) => {
  console.error('❌ 錯誤:', err);
  res.status(500).json({ error: 'Internal Server Error' });
});

// 啟動服務器
console.log(`🚀 綁定到 0.0.0.0:${PORT}...`);
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ 服務器成功啟動在端口 ${PORT}`);
  console.log(`🔗 健康檢查: http://0.0.0.0:${PORT}/health`);
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