# 🤖 AI場地預訂系統

一個基於人工智能的智能場地預訂系統，支持自然語言預訂、時間衝突檢測和管理員後台功能。

## 🚀 AI技術支持

本系統集成了 **DeepSeek AI**，提供真正的自然語言理解能力：
- 🧠 **智能語言解析**：準確理解中文自然語言表達
- 🎯 **精準信息提取**：自動識別場地、時間、用途等關鍵信息
- 💬 **自然對話體驗**：支持多輪對話和上下文理解
- 🔄 **後備機制**：API不可用時自動切換到本地處理

## ✨ 功能特色

### 🎯 核心功能
- **🤖 AI智能預訂**: 使用DeepSeek API支持中文自然語言預訂
- **📅 時間表管理**: 完整的場地時間表查看和管理
- **⚠️ 衝突檢測**: 自动檢測和防止時間衝突
- **👨‍💼 管理後台**: 完整的管理員功能面板
- **📱 響應式設計**: 支持桌面和移動設備

### 🏢 支持場地
- **教室**: 101-104號室、201-204號室、301-304號室
- **專用室**: 音樂室、電腦室、活動室、英語室、輔導室
- **大型場地**: 操場、禮堂、壁球室、電競室

### 🛠 技術棧
- **前端**: React 18 + Tailwind CSS + Lucide React
- **後端**: Node.js + Express
- **AI服務**: DeepSeek API + 本地後備處理
- **部署**: Railway + GitHub Actions
- **存儲**: 文件存儲 + 內存後備

## 🚀 快速開始

### 本地開發

1. **克隆項目**
   ```bash
   git clone https://github.com/KennethEnglun/aibooking.git
   cd aibooking
   ```

2. **安裝依賴**
   ```bash
   npm run install-all
   ```

3. **配置環境**
   ```bash
   cp backend/.env.example backend/.env
   # 編輯 .env 文件，添加你的 DeepSeek API Key
   ```

4. **啟動開發服務器**
   ```bash
   npm run dev
   ```

5. **訪問應用**
   - 前端: http://localhost:3000
   - 後端API: http://localhost:5000
   - 管理後台: http://localhost:3000/admin

### 🌐 Railway部署

1. **一鍵部署**
   [![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template/your-template-id)

2. **手動部署**
   詳細步驟請參考 [Railway部署指南](./RAILWAY_DEPLOY.md)

3. **環境變量配置**
   ```
   NODE_ENV=production
   DEEPSEEK_API_KEY=your_deepseek_api_key
   ADMIN_PASSWORD=your_admin_password
   ```

## 📚 使用指南

### AI預訂功能
系統支持以下自然語言預訂方式：

```
我想預訂明天下午2點到4點的音樂室，用於社團練習
幫我預訂12月25日上午10點到12點的禮堂，聖誕節活動
需要電腦室，下週三全天，程式設計課程
```

### 管理員功能
- **登入**: 使用設置的管理員密碼
- **預訂管理**: 查看、編輯、刪除預訂
- **統計報告**: 場地使用統計和趨勢分析
- **系統監控**: 實時查看系統狀態和AI服務狀態

### API文档

#### 預訂相關
- `GET /api/bookings` - 獲取所有預訂
- `POST /api/bookings` - 創建新預訂
- `PUT /api/bookings/:id` - 更新預訂
- `DELETE /api/bookings/:id` - 刪除預訂

#### AI服務
- `POST /api/ai/parse` - AI預訂解析
- `GET /api/ai/status` - AI服務狀態

#### 系統監控
- `GET /health` - 健康檢查
- `GET /api/bookings/storage/health` - 存儲狀態

## 🔧 配置說明

### 環境變量

| 變數名 | 說明 | 預設值 | 必需 |
|--------|------|---------|------|
| `NODE_ENV` | 運行環境 | `development` | ❌ |
| `PORT` | 服務器端口 | `5000` | ❌ |
| `DEEPSEEK_API_KEY` | DeepSeek API密鑰 | - | ⚠️ |
| `ADMIN_PASSWORD` | 管理員密碼 | `admin123` | ⚠️ |

### AI配置
- **模型**: DeepSeek Chat
- **後備機制**: 本地規則處理
- **支持語言**: 中文（繁體/簡體）

### 存儲配置
- **主要存儲**: JSON文件
- **後備存儲**: 內存存儲（適合Railway）
- **數據持久化**: 支持環境變量配置

## 📊 項目結構

```
aibooking/
├── frontend/                 # React前端應用
│   ├── src/
│   │   ├── pages/           # 頁面組件
│   │   ├── App.js           # 主應用
│   │   └── index.js         # 入口文件
│   └── package.json
├── backend/                  # Node.js後端
│   ├── routes/              # API路由
│   ├── config/              # 配置文件
│   ├── data/                # 數據存儲
│   └── server.js            # 服務器入口
├── railway.json             # Railway配置
├── nixpacks.toml           # 構建配置
└── package.json            # 根配置
```

## 🛡 安全考慮

- **身份驗證**: 管理員密碼保護
- **API限制**: 請求頻率限制
- **數據驗證**: 輸入數據嚴格驗證
- **錯誤處理**: 完整的錯誤處理機制

## 📈 性能優化

- **靜態文件**: 優化的靜態文件服務
- **緩存策略**: 適當的HTTP緩存頭
- **錯誤恢復**: 自動重試和降級機制
- **健康監控**: 實時健康檢查

## 🤝 貢獻指南

1. Fork 這個項目
2. 創建你的功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交你的更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打開一個 Pull Request

## 📝 更新日誌

### v1.0.0 (2024-12-20)
- 🎉 初始版本發布
- ✨ AI智能預訂功能
- 📅 完整預訂管理系統
- 👨‍💼 管理員後台
- 🚀 Railway部署支持

## 📄 許可證

本項目基於 MIT 許可證開源 - 查看 [LICENSE](LICENSE) 文件了解詳情

## 🙏 致謝

- [DeepSeek](https://www.deepseek.com/) - 提供強大的AI語言模型
- [Railway](https://railway.app/) - 現代化的部署平台
- [React](https://reactjs.org/) - 用戶界面庫
- [Tailwind CSS](https://tailwindcss.com/) - 實用優先的CSS框架

## 📞 支持與反饋

- 🐛 [報告問題](https://github.com/KennethEnglun/aibooking/issues)
- 💡 [功能建議](https://github.com/KennethEnglun/aibooking/discussions)
- 📧 聯繫我們: [GitHub](https://github.com/KennethEnglun)

---

⭐ 如果這個項目對你有幫助，請給它一個星星！ 