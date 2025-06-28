const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const moment = require('moment');
const storage = require('../data/storage');
const { getAllVenues } = require('../config/venues');

// 獲取所有預訂
router.get('/', (req, res) => {
  try {
    const bookings = storage.loadBookings();
    res.json({
      success: true,
      data: bookings,
      count: bookings.length,
      storageInfo: storage.getStorageInfo()
    });
  } catch (error) {
    console.error('❌ 獲取預訂失敗:', error);
    res.status(500).json({
      success: false,
      error: '獲取預訂失敗',
      message: error.message
    });
  }
});

// 根據日期獲取預訂
router.get('/date/:date', (req, res) => {
  try {
    const { date } = req.params;
    const bookings = storage.loadBookings();
    
    const filteredBookings = bookings.filter(booking => 
      moment(booking.date).format('YYYY-MM-DD') === date
    );
    
    res.json({
      success: true,
      data: filteredBookings,
      date: date,
      count: filteredBookings.length
    });
  } catch (error) {
    console.error('❌ 根據日期獲取預訂失敗:', error);
    res.status(500).json({
      success: false,
      error: '獲取預訂失敗',
      message: error.message
    });
  }
});

// 檢查時間衝突
function checkTimeConflict(newBooking, existingBookings) {
  const newStart = moment(`${newBooking.date} ${newBooking.startTime}`);
  const newEnd = moment(`${newBooking.date} ${newBooking.endTime}`);
  
  return existingBookings.some(booking => {
    if (booking.venue !== newBooking.venue || 
        moment(booking.date).format('YYYY-MM-DD') !== newBooking.date) {
      return false;
    }
    
    const existingStart = moment(`${booking.date} ${booking.startTime}`);
    const existingEnd = moment(`${booking.date} ${booking.endTime}`);
    
    return newStart.isBefore(existingEnd) && newEnd.isAfter(existingStart);
  });
}

// 創建新預訂
router.post('/', (req, res) => {
  try {
    const { venue, date, startTime, endTime, purpose, bookerName, bookerContact } = req.body;
    
    // 驗證必填字段
    if (!venue || !date || !startTime || !endTime || !purpose || !bookerName) {
      return res.status(400).json({
        success: false,
        error: '缺少必填字段',
        required: ['venue', 'date', 'startTime', 'endTime', 'purpose', 'bookerName']
      });
    }
    
    // 驗證場地是否存在
    const allVenues = getAllVenues();
    const venueExists = allVenues.some(v => v.id === venue);
    if (!venueExists) {
      return res.status(400).json({
        success: false,
        error: '場地不存在',
        venue: venue
      });
    }
    
    // 驗證時間格式
    if (!moment(date, 'YYYY-MM-DD').isValid()) {
      return res.status(400).json({
        success: false,
        error: '日期格式錯誤，應為 YYYY-MM-DD'
      });
    }
    
    // 驗證時間邏輯
    const start = moment(`${date} ${startTime}`);
    const end = moment(`${date} ${endTime}`);
    
    if (end.isSameOrBefore(start)) {
      return res.status(400).json({
        success: false,
        error: '結束時間必須晚於開始時間'
      });
    }
    
    const existingBookings = storage.loadBookings();
    
    // 檢查時間衝突
    if (checkTimeConflict({ venue, date, startTime, endTime }, existingBookings)) {
      return res.status(409).json({
        success: false,
        error: '該時間段已被預訂',
        conflictDetails: {
          venue,
          date,
          timeRange: `${startTime} - ${endTime}`
        }
      });
    }
    
    // 創建新預訂
    const newBooking = {
      id: uuidv4(),
      venue,
      date,
      startTime,
      endTime,
      purpose,
      bookerName,
      bookerContact: bookerContact || '',
      status: 'confirmed',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    const success = storage.addBooking(newBooking);
    
    if (success) {
      res.status(201).json({
        success: true,
        data: newBooking,
        message: '預訂成功'
      });
    } else {
      res.status(500).json({
        success: false,
        error: '保存預訂失敗'
      });
    }
    
  } catch (error) {
    console.error('❌ 創建預訂失敗:', error);
    res.status(500).json({
      success: false,
      error: '創建預訂失敗',
      message: error.message
    });
  }
});

// 更新預訂
router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    // 添加更新時間
    updateData.updatedAt = new Date().toISOString();
    
    const success = storage.updateBooking(id, updateData);
    
    if (success) {
      const bookings = storage.loadBookings();
      const updatedBooking = bookings.find(booking => booking.id === id);
      
      res.json({
        success: true,
        data: updatedBooking,
        message: '預訂更新成功'
      });
    } else {
      res.status(404).json({
        success: false,
        error: '預訂不存在'
      });
    }
  } catch (error) {
    console.error('❌ 更新預訂失敗:', error);
    res.status(500).json({
      success: false,
      error: '更新預訂失敗',
      message: error.message
    });
  }
});

// 刪除預訂
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    
    const success = storage.deleteBooking(id);
    
    if (success) {
      res.json({
        success: true,
        message: '預訂刪除成功'
      });
    } else {
      res.status(404).json({
        success: false,
        error: '預訂不存在'
      });
    }
  } catch (error) {
    console.error('❌ 刪除預訂失敗:', error);
    res.status(500).json({
      success: false,
      error: '刪除預訂失敗',
      message: error.message
    });
  }
});

// 獲取場地列表
router.get('/venues', (req, res) => {
  try {
    const allVenues = getAllVenues();
    res.json({
      success: true,
      data: allVenues,
      count: allVenues.length
    });
  } catch (error) {
    console.error('❌ 獲取場地列表失敗:', error);
    res.status(500).json({
      success: false,
      error: '獲取場地列表失敗',
      message: error.message
    });
  }
});

// 存儲健康檢查
router.get('/storage/health', (req, res) => {
  try {
    const healthInfo = storage.healthCheck();
    res.json({
      success: true,
      storage: healthInfo
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: '存儲健康檢查失敗',
      message: error.message
    });
  }
});

module.exports = router; 