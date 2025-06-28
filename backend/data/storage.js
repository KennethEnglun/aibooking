const fs = require('fs');
const path = require('path');

class DataStorage {
  constructor() {
    this.dataDir = path.join(__dirname, 'storage');
    this.bookingsFile = path.join(this.dataDir, 'bookings.json');
    this.memoryStorage = {
      bookings: []
    };
    this.isMemoryMode = false;
    
    this.initializeStorage();
  }

  initializeStorage() {
    try {
      // 嘗試創建數據目錄
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
      }

      // 嘗試創建或讀取預訂文件
      if (!fs.existsSync(this.bookingsFile)) {
        this.saveBookings([]);
      } else {
        // 讀取現有數據
        const data = this.loadBookings();
        this.memoryStorage.bookings = data;
      }

      console.log('✅ 數據存儲初始化成功 (文件模式)');
    } catch (error) {
      console.warn('⚠️ 文件存儲不可用，切換到內存模式:', error.message);
      this.isMemoryMode = true;
      this.memoryStorage.bookings = [];
    }
  }

  loadBookings() {
    try {
      if (this.isMemoryMode) {
        return this.memoryStorage.bookings;
      }

      if (fs.existsSync(this.bookingsFile)) {
        const data = fs.readFileSync(this.bookingsFile, 'utf8');
        const bookings = JSON.parse(data);
        // 同步到內存存儲
        this.memoryStorage.bookings = bookings;
        return bookings;
      }
      return [];
    } catch (error) {
      console.error('❌ 讀取預訂數據失敗:', error);
      // 如果文件讀取失敗，切換到內存模式
      if (!this.isMemoryMode) {
        console.log('🔄 切換到內存存儲模式');
        this.isMemoryMode = true;
      }
      return this.memoryStorage.bookings;
    }
  }

  saveBookings(bookings) {
    try {
      // 始終保存到內存
      this.memoryStorage.bookings = bookings;

      // 如果不是內存模式，嘗試保存到文件
      if (!this.isMemoryMode) {
        fs.writeFileSync(this.bookingsFile, JSON.stringify(bookings, null, 2));
      }
      
      return true;
    } catch (error) {
      console.error('❌ 保存預訂數據失敗:', error);
      
      // 如果文件保存失敗，切換到內存模式但數據不丟失
      if (!this.isMemoryMode) {
        console.log('🔄 文件保存失敗，切換到內存存儲模式');
        this.isMemoryMode = true;
      }
      
      return false;
    }
  }

  addBooking(booking) {
    const bookings = this.loadBookings();
    bookings.push(booking);
    return this.saveBookings(bookings);
  }

  updateBooking(id, updatedBooking) {
    const bookings = this.loadBookings();
    const index = bookings.findIndex(booking => booking.id === id);
    
    if (index !== -1) {
      bookings[index] = { ...bookings[index], ...updatedBooking };
      return this.saveBookings(bookings);
    }
    
    return false;
  }

  deleteBooking(id) {
    const bookings = this.loadBookings();
    const filteredBookings = bookings.filter(booking => booking.id !== id);
    
    if (filteredBookings.length !== bookings.length) {
      return this.saveBookings(filteredBookings);
    }
    
    return false;
  }

  getStorageInfo() {
    return {
      mode: this.isMemoryMode ? 'memory' : 'file',
      dataDir: this.dataDir,
      bookingsFile: this.bookingsFile,
      bookingsCount: this.memoryStorage.bookings.length,
      fileExists: !this.isMemoryMode && fs.existsSync(this.bookingsFile)
    };
  }

  // 健康檢查
  healthCheck() {
    try {
      const bookings = this.loadBookings();
      return {
        status: 'healthy',
        mode: this.isMemoryMode ? 'memory' : 'file',
        bookingsCount: bookings.length,
        canRead: true,
        canWrite: this.saveBookings(bookings)
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        mode: this.isMemoryMode ? 'memory' : 'file'
      };
    }
  }
}

// 創建單例實例
const storage = new DataStorage();

module.exports = storage; 