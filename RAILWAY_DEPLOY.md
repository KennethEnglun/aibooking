# Railway 部署指南

## 🚀 快速部署

### 1. 準備工作

確保你有以下內容：
- GitHub 帳戶
- Railway 帳戶 (https://railway.app)
- DeepSeek API Key (可選，用於AI功能)

### 2. 從GitHub部署

1. **登入Railway**
   - 訪問 https://railway.app
   - 使用GitHub帳戶登入

2. **創建新項目**
   - 點擊 "New Project"
   - 選擇 "Deploy from GitHub repo"
   - 選擇你的 `aibooking` 倉庫

3. **配置環境變量**
   ```
   NODE_ENV=production
   DEEPSEEK_API_KEY=你的DeepSeek_API密鑰
   ADMIN_PASSWORD=你的管理員密碼
   ```

4. **部署**
   - Railway會自動檢測並構建你的應用
   - 構建完成後會提供一個公開URL

### 3. 環境變量配置

在Railway項目設置中添加以下環境變量：

| 變量名 | 說明 | 必需 | 示例值 |
|--------|------|------|---------|
| `NODE_ENV` | 運行環境 | ✅ | `production` |
| `DEEPSEEK_API_KEY` | DeepSeek API密鑰 | ⚠️ | `sk-xxxxx` |
| `ADMIN_PASSWORD` | 管理員密碼 | ⚠️ | `your_secure_password` |
| `PORT` | 端口號 | ❌ | Railway自動設置 |

### 4. 部署配置文件

項目包含以下Railway專用配置：

- `railway.json` - Railway部署配置
- `nixpacks.toml` - 構建配置
- `.railway-ignore` - 忽略文件

### 5. 構建過程

1. **安裝依賴**
   ```bash
   npm run install-all
   ```

2. **構建前端**
   ```bash
   cd frontend && npm run build
   ```

3. **啟動服務**
   ```bash
   cd backend && npm start
   ```

### 6. 健康檢查

部署完成後，可以通過以下端點檢查應用狀態：

- **健康檢查**: `https://your-app.railway.app/health`
- **API狀態**: `https://your-app.railway.app/api`
- **存儲狀態**: `https://your-app.railway.app/api/bookings/storage/health`

### 7. 功能驗證

1. **前端界面**: 訪問主URL
2. **AI預訂**: 測試自然語言預訂功能
3. **管理後台**: 訪問 `/admin` 頁面
4. **API接口**: 檢查 `/api` 端點

### 8. 常見問題

#### Q: 部署失敗怎麼辦？
A: 檢查構建日誌，確保所有依賴正確安裝

#### Q: AI功能不工作？
A: 確認 `DEEPSEEK_API_KEY` 環境變量正確設置

#### Q: 數據會丟失嗎？
A: Railway的文件系統是臨時的，但我們實現了內存存儲作為後備

#### Q: 如何更新部署？
A: 推送代碼到GitHub，Railway會自動重新部署

### 9. 監控和日誌

- Railway提供實時日誌查看
- 使用 `/health` 端點監控應用狀態
- 檢查 `/api/bookings/storage/health` 了解存儲狀態

### 10. 自定義域名

1. 在Railway項目設置中
2. 點擊 "Settings" → "Domains"
3. 添加你的自定義域名
4. 配置DNS記錄

### 11. 安全建議

- 使用強密碼作為 `ADMIN_PASSWORD`
- 定期輪換 API 密鑰
- 監控應用日誌異常活動
- 考慮添加身份驗證中間件

### 12. 性能優化

- Railway自動處理負載均衡
- 應用包含健康檢查和錯誤處理
- 靜態文件由Express高效服務
- 內存和文件雙重存儲確保數據可靠性

## 🎉 部署成功！

你的AI場地預訂系統現在已經在Railway上運行！

訪問你的應用URL開始使用智能預訂功能。 