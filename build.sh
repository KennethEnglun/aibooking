#!/bin/bash

echo "🏗️ 開始構建 AI 場地預訂系統..."

# 安裝根目錄依賴
echo "📦 安裝根目錄依賴..."
npm install

# 安裝後端依賴
echo "📦 安裝後端依賴..."
cd backend
npm install
cd ..

# 安裝前端依賴
echo "📦 安裝前端依賴..."
cd frontend
npm install

# 構建前端
echo "🎨 構建前端應用..."
npm run build
cd ..

echo "✅ 構建完成！" 