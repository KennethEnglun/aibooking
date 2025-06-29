# 時間表系統重新設計說明

## 問題描述

原本的時間表系統存在邏輯錯誤：
- 用戶選擇某個日期時，系統顯示的是該日期**創建**的預訂，而不是該日期**發生**的預訂
- 例如：用戶在6月29日預訂了6月30日的音樂室，當用戶選擇6月29日時會看到這個預訂，但選擇6月30日時卻看不到

## 解決方案

### 1. 邏輯重新設計

**新邏輯**：時間表系統根據預訂的**發生日期**（startTime）過濾，而非**創建日期**（createdAt）

```javascript
// 修正前（錯誤邏輯）
// 顯示在選定日期創建的預訂
const bookings = allBookings.filter(b => 
  moment(b.createdAt).isSame(selectedDate, 'day')
);

// 修正後（正確邏輯）  
// 顯示在選定日期發生的預訂
const bookings = allBookings.filter(b => 
  moment(b.startTime).isSame(selectedDate, 'day')
);
```

### 2. 後端修改

#### 文件路徑統一
- 修正 `backend/routes/admin.js` 中的預訂文件路徑
- 從 `../data/bookings.json` 改為 `../data/storage/bookings.json`
- 確保所有模塊使用相同的數據源

#### 時區處理改進
```javascript
// 使用 moment-timezone 確保時區一致性
const targetDay = moment.tz(date, ['YYYY-MM-DD','DD/MM/YYYY'], 'Asia/Hong_Kong');
const bookingStartDay = moment.tz(booking.startTime, 'Asia/Hong_Kong');
const isSameDay = bookingStartDay.isSame(targetDay, 'day');
```

#### 調試信息添加
```javascript
console.log(`過濾日期: ${targetDay.format('YYYY-MM-DD')}`);
if (isSameDay) {
  console.log(`匹配預訂: ${booking.id}, 開始時間: ${bookingStartDay.format('YYYY-MM-DD HH:mm')}`);
}
```

### 3. 前端改進

#### 用戶界面優化
- 添加使用說明提示框，清楚解釋系統邏輯
- 改進標題和描述文字，強調"該日期當天發生的預訂"
- 優化空狀態顯示，明確說明沒有找到預訂的原因

#### 數據獲取邏輯
```javascript
// 分離場地數據和預訂數據的獲取
const fetchVenues = async () => { /* 獲取場地列表 */ };
const fetchBookings = useCallback(async () => { /* 根據日期獲取預訂 */ }, [selectedDate, selectedVenue]);
```

#### API配置更新
```javascript
// 統一API基礎URL配置
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3001';
```

### 4. 測試驗證

創建了完整的測試用例驗證系統邏輯：

| 測試日期 | 預期結果 | 實際結果 | 狀態 |
|---------|---------|---------|------|
| 2024-06-29 | 1個預訂（音樂室1音樂練習） | ✅ 1個預訂 | 通過 |
| 2024-06-30 | 2個預訂（音樂室2樂團練習 + 舞蹈室1舞蹈課程） | ✅ 2個預訂 | 通過 |
| 2024-07-01 | 1個預訂（音樂室1鋼琴獨奏） | ✅ 1個預訂 | 通過 |
| 2024-06-28 | 0個預訂 | ✅ 0個預訂 | 通過 |

## 使用說明

### 用戶操作流程
1. 打開時間表頁面
2. 在左上角的日期選擇器中選擇要查看的日期
3. 系統將顯示該日期當天**發生**的所有預訂活動
4. 可以通過場地篩選進一步縮小結果範圍

### 示例場景
- **場景**：用戶在6月29日預訂了6月30日下午2-4點的音樂室
- **正確行為**：
  - 選擇6月29日：不顯示此預訂（因為活動不在29日發生）
  - 選擇6月30日：顯示此預訂（因為活動在30日發生）

## 技術細節

### 依賴更新
- 後端添加 `moment-timezone` 依賴
- 前端升級到 `moment-timezone` 並設定預設時區

### 環境配置
```bash
# 後端啟動（開發環境）
cd backend && PORT=3001 node server.js

# 前端啟動
cd frontend && npm start

# 前端環境變數（可選）
REACT_APP_API_BASE_URL=http://localhost:3001
```

### API端點
- `GET /api/admin/schedule?date=YYYY-MM-DD` - 獲取指定日期的預訂
- `GET /api/admin/schedule?date=YYYY-MM-DD&venue=VENUE_ID` - 按日期和場地過濾

## 總結

重新設計的時間表系統現在能夠：
1. ✅ 正確顯示選定日期當天發生的預訂活動
2. ✅ 提供清晰的用戶界面和說明
3. ✅ 支援時區一致性處理
4. ✅ 通過完整的測試驗證

這個修改解決了用戶反饋的核心問題，確保時間表系統的邏輯符合用戶的直觀期望。 