# AI場地預訂系統

一個基於AI LLM模型的智能場地預訂系統，支持自然語言預訂和管理員後台管理。

## 🚀 AI技術支持

本系統集成了 **DeepSeek AI**，提供真正的自然語言理解能力：
- 🧠 **智能語言解析**：準確理解中文自然語言表達
- 🎯 **精準信息提取**：自動識別場地、時間、用途等關鍵信息
- 💬 **自然對話體驗**：支持多輪對話和上下文理解
- 🔄 **後備機制**：API不可用時自動切換到本地處理

## 功能特色

### 用戶功能
- 🤖 **AI自然語言預訂**：用戶可以用自然語言描述預訂需求
- 📅 **智能時間解析**：系統自動理解並解析時間和場地信息
- ⚠️ **衝突檢測**：自動檢查時間衝突並提示用戶
- 📱 **響應式設計**：支持電腦和手機使用

### 管理員功能
- 📊 **完整時間表查看**：查看所有場地的預訂狀況
- ✏️ **預訂管理**：修改、刪除現有預訂
- 📈 **使用統計**：查看場地使用率統計

## 可預訂場地

### 教室
- 101-104號室
- 201-204號室  
- 301-304號室

### 專用室
- 音樂室、電腦室、活動室、英語室
- 操場、禮堂、壁球室、電競室、輔導室

## 快速開始

### 安裝依賴
```bash
npm run install-all
```

### 環境配置
1. 複製環境變量文件：
```bash
cd backend
cp .env.example .env
```

2. 編輯 `.env` 文件，設置您的 DeepSeek API Key：
```
PORT=5000
DEEPSEEK_API_KEY=your_deepseek_api_key_here
DEEPSEEK_API_URL=https://api.deepseek.com/v1/chat/completions
NODE_ENV=development
ADMIN_PASSWORD=admin123
```

### 啟動開發服務器
```bash
npm run dev
```

### 訪問應用
- 前端界面：http://localhost:3000
- 後端API：http://localhost:5000

## AI預訂示例

用戶可以這樣預訂：
- "我想在明天下午2點借101號室開會"
- "下週三上午使用音樂室練習" 
- "這個星期五晚上7點在禮堂舉辦活動"
- "後天上午10點到12點需要電腦室培訓"

系統會自動理解並處理這些請求，提取：
- 📍 **場地信息**：101號室、音樂室、禮堂等
- ⏰ **時間信息**：明天下午2點、下週三上午等
- 🎯 **用途目的**：開會、練習、活動、培訓等

## API端點

### AI相關
- `POST /api/ai/parse` - AI解析自然語言
- `POST /api/ai/book` - AI智能預訂
- `GET /api/ai/status` - 檢查AI服務狀態

### 預訂管理
- `GET /api/bookings` - 獲取所有預訂
- `POST /api/bookings` - 創建新預訂
- `GET /api/bookings/venues` - 獲取所有場地

### 管理員功能
- `POST /api/admin/login` - 管理員登入
- `GET /api/admin/dashboard` - 儀表板數據
- `PUT /api/admin/bookings/:id` - 修改預訂
- `DELETE /api/admin/bookings/:id` - 刪除預訂

## 技術架構

- **前端**：React + TypeScript + Tailwind CSS
- **後端**：Node.js + Express
- **AI服務**：DeepSeek API + 本地後備處理
- **數據存儲**：JSON文件（可升級為數據庫）

## 🔧 AI配置說明

### DeepSeek API設置
1. 註冊 [DeepSeek](https://platform.deepseek.com/) 帳號
2. 獲取API Key
3. 在 `backend/.env` 中設置：
   ```
   DEEPSEEK_API_KEY=sk-your-api-key-here
   ```

### 功能特性
- **自動降級**：API不可用時使用本地處理
- **狀態監控**：實時顯示AI服務連接狀態
- **錯誤處理**：完善的錯誤處理和重試機制

## 故障排除

### AI相關問題
1. **API Key無效**：檢查DeepSeek API Key是否正確
2. **網絡連接問題**：系統會自動切換到後備模式
3. **解析失敗**：系統會提供幫助信息和示例

### 一般問題
1. **端口被佔用**：修改 `.env` 中的 `PORT` 設置
2. **依賴安裝失敗**：運行 `npm cache clean --force`
3. **前端無法連接後端**：確認後端服務正常啟動

## 更新日誌

### v2.0.0 - AI增強版
- ✅ 集成DeepSeek AI服務
- ✅ 真實自然語言理解
- ✅ AI狀態監控
- ✅ 智能後備機制
- ✅ 改進的用戶界面

### v1.0.0 - 基礎版
- ✅ 基本預訂功能
- ✅ 管理員後台
- ✅ 時間表查看
- ✅ 響應式設計

## 開發團隊

由AI助手開發，使用現代化的React和Node.js技術棧，集成先進的AI語言模型。 