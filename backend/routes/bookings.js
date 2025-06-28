const express = require('express');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const moment = require('moment');
const { getAllVenues, getVenueById } = require('../config/venues');

const router = express.Router();
const bookingsFile = path.join(__dirname, '../data/bookings.json');

// 讀取預訂數據
const readBookings = () => {
  try {
    const data = fs.readFileSync(bookingsFile, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return [];
  }
};

// 寫入預訂數據
const writeBookings = (bookings) => {
  fs.writeFileSync(bookingsFile, JSON.stringify(bookings, null, 2));
};

// 檢查時間衝突
const checkConflict = (venueId, startTime, endTime, excludeId = null) => {
  const bookings = readBookings();
  return bookings.some(booking => {
    if (booking.id === excludeId) return false;
    if (booking.venueId !== venueId) return false;
    if (booking.status === 'cancelled') return false;
    
    const bookingStart = moment(booking.startTime);
    const bookingEnd = moment(booking.endTime);
    const newStart = moment(startTime);
    const newEnd = moment(endTime);
    
    // 檢查時間重疊
    return newStart.isBefore(bookingEnd) && newEnd.isAfter(bookingStart);
  });
};

// GET /api/bookings - 獲取所有預訂
router.get('/', (req, res) => {
  try {
    const bookings = readBookings();
    res.json(bookings);
  } catch (error) {
    res.status(500).json({ error: '無法讀取預訂數據' });
  }
});

// GET /api/bookings/venues - 獲取所有場地
router.get('/venues', (req, res) => {
  try {
    const venues = getAllVenues();
    res.json(venues);
  } catch (error) {
    res.status(500).json({ error: '無法讀取場地數據' });
  }
});

// GET /api/bookings/:id - 獲取特定預訂
router.get('/:id', (req, res) => {
  try {
    const bookings = readBookings();
    const booking = bookings.find(b => b.id === req.params.id);
    if (!booking) {
      return res.status(404).json({ error: '預訂不存在' });
    }
    res.json(booking);
  } catch (error) {
    res.status(500).json({ error: '無法讀取預訂數據' });
  }
});

// POST /api/bookings - 創建新預訂
router.post('/', (req, res) => {
  try {
    const { venueId, startTime, endTime, purpose, contactInfo } = req.body;
    
    // 驗證必要字段
    if (!venueId || !startTime || !endTime || !purpose || !contactInfo) {
      return res.status(400).json({ error: '缺少必要字段' });
    }
    
    // 驗證場地存在
    const venue = getVenueById(venueId);
    if (!venue) {
      return res.status(400).json({ error: '場地不存在' });
    }
    
    // 驗證時間
    const start = moment(startTime);
    const end = moment(endTime);
    if (!start.isValid() || !end.isValid()) {
      return res.status(400).json({ error: '時間格式無效' });
    }
    if (start.isSameOrAfter(end)) {
      return res.status(400).json({ error: '結束時間必須晚於開始時間' });
    }
    
    // 檢查衝突
    if (checkConflict(venueId, startTime, endTime)) {
      return res.status(409).json({ 
        error: '該時段已被預訂',
        conflict: true 
      });
    }
    
    // 創建預訂
    const booking = {
      id: uuidv4(),
      venueId,
      venueName: venue.name,
      startTime,
      endTime,
      purpose,
      contactInfo,
      status: 'confirmed',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    const bookings = readBookings();
    bookings.push(booking);
    writeBookings(bookings);
    
    res.status(201).json(booking);
  } catch (error) {
    res.status(500).json({ error: '創建預訂失敗' });
  }
});

// PUT /api/bookings/:id - 更新預訂
router.put('/:id', (req, res) => {
  try {
    const { venueId, startTime, endTime, purpose, contactInfo, status } = req.body;
    const bookings = readBookings();
    const bookingIndex = bookings.findIndex(b => b.id === req.params.id);
    
    if (bookingIndex === -1) {
      return res.status(404).json({ error: '預訂不存在' });
    }
    
    // 如果更新時間或場地，檢查衝突
    if (venueId && (startTime || endTime)) {
      const newVenueId = venueId || bookings[bookingIndex].venueId;
      const newStartTime = startTime || bookings[bookingIndex].startTime;
      const newEndTime = endTime || bookings[bookingIndex].endTime;
      
      if (checkConflict(newVenueId, newStartTime, newEndTime, req.params.id)) {
        return res.status(409).json({ 
          error: '該時段已被預訂',
          conflict: true 
        });
      }
    }
    
    // 更新預訂
    const updatedBooking = {
      ...bookings[bookingIndex],
      ...(venueId && { venueId, venueName: getVenueById(venueId)?.name }),
      ...(startTime && { startTime }),
      ...(endTime && { endTime }),
      ...(purpose && { purpose }),
      ...(contactInfo && { contactInfo }),
      ...(status && { status }),
      updatedAt: new Date().toISOString()
    };
    
    bookings[bookingIndex] = updatedBooking;
    writeBookings(bookings);
    
    res.json(updatedBooking);
  } catch (error) {
    res.status(500).json({ error: '更新預訂失敗' });
  }
});

// DELETE /api/bookings/:id - 刪除預訂
router.delete('/:id', (req, res) => {
  try {
    const bookings = readBookings();
    const bookingIndex = bookings.findIndex(b => b.id === req.params.id);
    
    if (bookingIndex === -1) {
      return res.status(404).json({ error: '預訂不存在' });
    }
    
    bookings.splice(bookingIndex, 1);
    writeBookings(bookings);
    
    res.json({ message: '預訂已刪除' });
  } catch (error) {
    res.status(500).json({ error: '刪除預訂失敗' });
  }
});

module.exports = router; 