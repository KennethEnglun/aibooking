const express = require('express');
const fs = require('fs');
const path = require('path');
const moment = require('moment');
const { getAllVenues } = require('../config/venues');

// 確保環境變量被正確加載
require('dotenv').config();

const router = express.Router();
const bookingsFile = path.join(__dirname, '../data/bookings.json');

// 環境變量診斷端點（僅開發環境或特殊查詢參數）
router.get('/env-check', (req, res) => {
  // 僅在特定條件下暴露診斷信息
  if (req.query.debug === 'true' || process.env.NODE_ENV === 'development') {
    res.json({
      hasAdminPassword: !!process.env.ADMIN_PASSWORD,
      hasDeepSeekKey: !!process.env.DEEPSEEK_API_KEY,
      nodeEnv: process.env.NODE_ENV,
      port: process.env.PORT,
      adminPasswordLength: process.env.ADMIN_PASSWORD ? process.env.ADMIN_PASSWORD.length : 0,
      timestamp: new Date().toISOString()
    });
  } else {
    res.status(403).json({ error: 'Unauthorized' });
  }
});

// 簡單的管理員認證中間件
const authMiddleware = (req, res, next) => {
  const { password } = req.body || req.query;
  console.log('🔐 管理員認證嘗試:', {
    providedPassword: password ? `***${password.slice(-2)}` : '(無)',
    expectedPassword: process.env.ADMIN_PASSWORD ? `***${process.env.ADMIN_PASSWORD.slice(-2)}` : '(未配置)',
    hasAdminPassword: !!process.env.ADMIN_PASSWORD
  });
  
  if (!process.env.ADMIN_PASSWORD) {
    console.error('❌ ADMIN_PASSWORD 環境變量未配置');
    return res.status(500).json({ error: '服務器配置錯誤：管理員密碼未設置' });
  }
  
  if (password !== process.env.ADMIN_PASSWORD) {
    console.log('❌ 管理員密碼錯誤');
    return res.status(401).json({ error: '管理員密碼錯誤' });
  }
  
  console.log('✅ 管理員認證成功');
  next();
};

// 讀取預訂數據
const readBookings = () => {
  try {
    const data = fs.readFileSync(bookingsFile, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return [];
  }
};

// POST /api/admin/login - 管理員登入
router.post('/login', authMiddleware, (req, res) => {
  res.json({ 
    success: true, 
    message: '管理員登入成功',
    token: 'admin-session-token' // 實際應用中應使用JWT
  });
});

// GET /api/admin/dashboard - 管理員儀表板
router.get('/dashboard', (req, res) => {
  try {
    const bookings = readBookings();
    const venues = getAllVenues();
    
    // 統計數據
    const stats = {
      totalBookings: bookings.length,
      confirmedBookings: bookings.filter(b => b.status === 'confirmed').length,
      cancelledBookings: bookings.filter(b => b.status === 'cancelled').length,
      todayBookings: bookings.filter(b => 
        moment(b.startTime).isSame(moment(), 'day')
      ).length,
      upcomingBookings: bookings.filter(b => 
        moment(b.startTime).isAfter(moment()) && b.status === 'confirmed'
      ).length
    };
    
    // 場地使用率
    const venueUsage = venues.map(venue => {
      const venueBookings = bookings.filter(b => 
        b.venueId === venue.id && b.status === 'confirmed'
      );
      return {
        venue: venue.name,
        bookings: venueBookings.length,
        lastUsed: venueBookings.length > 0 ? 
          moment(Math.max(...venueBookings.map(b => new Date(b.startTime)))).format('YYYY-MM-DD') : 
          '從未使用'
      };
    });
    
    // 今日預訂
    const todayBookings = bookings.filter(b => 
      moment(b.startTime).isSame(moment(), 'day')
    ).sort((a, b) => moment(a.startTime).diff(moment(b.startTime)));
    
    res.json({
      stats,
      venueUsage,
      todayBookings,
      recentBookings: bookings.slice(-10).reverse()
    });
  } catch (error) {
    res.status(500).json({ error: '無法獲取儀表板數據' });
  }
});

// GET /api/admin/schedule - 獲取完整時間表（公開訪問）
router.get('/schedule', (req, res) => {
  try {
    const { date, venue } = req.query;
    const bookings = readBookings();
    
    let filteredBookings = bookings.filter(b => b.status === 'confirmed'); // 只顯示已確認的預訂
    
    // 按日期過濾
    if (date) {
      filteredBookings = filteredBookings.filter(b => 
        moment(b.startTime).isSame(moment(date), 'day')
      );
    }
    
    // 按場地過濾
    if (venue) {
      filteredBookings = filteredBookings.filter(b => b.venueId === venue);
    }
    
    // 按時間排序
    filteredBookings.sort((a, b) => moment(a.startTime).diff(moment(b.startTime)));
    
    // 為每個預訂添加場地名稱（如果缺失）
    const venues = getAllVenues();
    filteredBookings = filteredBookings.map(booking => {
      if (!booking.venueName) {
        const venue = venues.find(v => v.id === booking.venueId);
        booking.venueName = venue ? venue.name : `場地 ${booking.venueId}`;
      }
      return booking;
    });
    
    res.json(filteredBookings);
  } catch (error) {
    console.error('獲取時間表失敗:', error);
    res.status(500).json({ error: '無法獲取時間表' });
  }
});

// GET /api/admin/bookings/:id - 獲取預訂詳情
router.get('/bookings/:id', (req, res) => {
  try {
    const bookings = readBookings();
    const booking = bookings.find(b => b.id === req.params.id);
    
    if (!booking) {
      return res.status(404).json({ error: '預訂不存在' });
    }
    
    res.json(booking);
  } catch (error) {
    res.status(500).json({ error: '無法獲取預訂詳情' });
  }
});

// PUT /api/admin/bookings/:id - 管理員修改預訂
router.put('/bookings/:id', authMiddleware, (req, res) => {
  try {
    const bookings = readBookings();
    const bookingIndex = bookings.findIndex(b => b.id === req.params.id);
    
    if (bookingIndex === -1) {
      return res.status(404).json({ error: '預訂不存在' });
    }
    
    const updatedBooking = {
      ...bookings[bookingIndex],
      ...req.body,
      updatedAt: new Date().toISOString(),
      updatedBy: 'admin'
    };
    
    bookings[bookingIndex] = updatedBooking;
    fs.writeFileSync(bookingsFile, JSON.stringify(bookings, null, 2));
    
    res.json(updatedBooking);
  } catch (error) {
    res.status(500).json({ error: '修改預訂失敗' });
  }
});

// DELETE /api/admin/bookings/:id - 管理員刪除預訂
router.delete('/bookings/:id', authMiddleware, (req, res) => {
  try {
    const bookings = readBookings();
    const bookingIndex = bookings.findIndex(b => b.id === req.params.id);
    
    if (bookingIndex === -1) {
      return res.status(404).json({ error: '預訂不存在' });
    }
    
    bookings.splice(bookingIndex, 1);
    fs.writeFileSync(bookingsFile, JSON.stringify(bookings, null, 2));
    
    res.json({ message: '預訂已刪除' });
  } catch (error) {
    res.status(500).json({ error: '刪除預訂失敗' });
  }
});

// GET /api/admin/reports - 生成報告
router.get('/reports', (req, res) => {
  try {
    const bookings = readBookings();
    const venues = getAllVenues();
    const { startDate, endDate } = req.query;
    
    let filteredBookings = bookings;
    
    // 時間範圍過濾
    if (startDate && endDate) {
      filteredBookings = bookings.filter(b => {
        const bookingDate = moment(b.startTime);
        return bookingDate.isBetween(moment(startDate), moment(endDate), 'day', '[]');
      });
    }
    
    // 生成報告數據
    const report = {
      period: {
        start: startDate || '所有時間',
        end: endDate || '所有時間'
      },
      summary: {
        totalBookings: filteredBookings.length,
        confirmedBookings: filteredBookings.filter(b => b.status === 'confirmed').length,
        cancelledBookings: filteredBookings.filter(b => b.status === 'cancelled').length
      },
      venueStats: venues.map(venue => {
        const venueBookings = filteredBookings.filter(b => b.venueId === venue.id);
        return {
          venueName: venue.name,
          totalBookings: venueBookings.length,
          confirmedBookings: venueBookings.filter(b => b.status === 'confirmed').length,
          totalHours: venueBookings.reduce((sum, b) => {
            return sum + moment(b.endTime).diff(moment(b.startTime), 'hours');
          }, 0)
        };
      }),
      monthlyTrends: generateMonthlyTrends(filteredBookings)
    };
    
    res.json(report);
  } catch (error) {
    res.status(500).json({ error: '生成報告失敗' });
  }
});

// 生成月度趨勢數據
function generateMonthlyTrends(bookings) {
  const trends = {};
  
  bookings.forEach(booking => {
    const month = moment(booking.startTime).format('YYYY-MM');
    if (!trends[month]) {
      trends[month] = 0;
    }
    trends[month]++;
  });
  
  return Object.entries(trends)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, count]) => ({ month, bookings: count }));
}

module.exports = router; 