# AI場地預訂系統 - 安裝指南

## 系統要求

- Node.js (版本 16.0 或更高)
- npm (版本 8.0 或更高)

## 快速開始

### 1. 克隆項目
```bash
git clone <repository-url>
cd AIbooking
```

### 2. 安裝依賴
```bash
# 安裝所有依賴（根目錄、後端、前端）
npm run install-all
```

或者分別安裝：
```bash
# 根目錄依賴
npm install

# 後端依賴
cd backend
npm install

# 前端依賴
cd ../frontend
npm install
```

### 3. 環境配置

複製後端環境變量範本：
```bash
cd backend
cp .env.example .env
```

編輯 `.env` 文件，設置您的配置：
```
PORT=5000
OPENAI_API_KEY=your_openai_api_key_here  # 可選：用於真實AI功能
NODE_ENV=development
ADMIN_PASSWORD=admin123  # 修改為您的管理員密碼
```

### 4. 啟動應用

從根目錄啟動整個應用：
```bash
npm run dev
```

這將同時啟動：
- 後端服務器 (http://localhost:5000)
- 前端應用 (http://localhost:3000)

### 5. 訪問應用

- **前端界面**: http://localhost:3000
- **後端API**: http://localhost:5000

## 分別啟動

如果您需要分別啟動前端和後端：

### 啟動後端
```bash
cd backend
npm run dev
```

### 啟動前端
```bash
cd frontend
npm start
```

## 生產環境部署

### 1. 構建前端
```bash
cd frontend
npm run build
```

### 2. 啟動後端
```bash
cd backend
npm start
```

## 功能測試

### 1. 測試AI預訂功能
1. 訪問 http://localhost:3000/booking
2. 嘗試輸入自然語言，例如：
   - "我想在明天下午2點借101號室開會"
   - "下週三上午10點使用音樂室練習"

### 2. 測試管理員功能
1. 訪問 http://localhost:3000/admin
2. 使用密碼 `admin123` 登入（或您在 .env 中設置的密碼）

### 3. 查看時間表
1. 訪問 http://localhost:3000/schedule
2. 查看所有場地的預訂情況

## API端點

### 公開API
- `GET /api/bookings` - 獲取所有預訂
- `POST /api/bookings` - 創建新預訂
- `GET /api/bookings/venues` - 獲取所有場地
- `POST /api/ai/parse` - AI解析自然語言
- `POST /api/ai/book` - AI預訂

### 管理員API
- `POST /api/admin/login` - 管理員登入
- `GET /api/admin/dashboard` - 儀表板數據
- `GET /api/admin/schedule` - 完整時間表
- `PUT /api/admin/bookings/:id` - 修改預訂
- `DELETE /api/admin/bookings/:id` - 刪除預訂

## 故障排除

### 常見問題

1. **端口被佔用**
   ```bash
   # 修改 backend/.env 文件中的 PORT 設置
   PORT=5001
   ```

2. **依賴安裝失敗**
   ```bash
   # 清除緩存後重新安裝
   npm cache clean --force
   npm run install-all
   ```

3. **前端無法連接後端**
   - 檢查後端是否已啟動
   - 確認 frontend/package.json 中的 proxy 設置正確

4. **AI功能不工作**
   - 當前使用模擬AI，如需真實AI功能，請設置有效的 OPENAI_API_KEY

### 日誌查看

後端日誌會顯示在終端中，包括：
- 服務器啟動信息
- API請求日誌
- 錯誤信息

## 自定義場地

要修改可用場地列表，編輯 `backend/config/venues.js` 文件。

## 支持

如有問題，請檢查：
1. Node.js 和 npm 版本是否符合要求
2. 所有依賴是否正確安裝
3. 環境變量是否正確設置
4. 端口是否可用 