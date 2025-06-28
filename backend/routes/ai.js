const express = require('express');
const axios = require('axios');
const moment = require('moment');
const { findVenueByName, getAllVenues } = require('../config/venues');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();
const bookingsFile = path.join(__dirname, '../data/bookings.json');

// 直接讀取/寫入預訂數據的輔助函數
const readBookings = () => {
  try {
    const data = fs.readFileSync(bookingsFile, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return [];
  }
};

const writeBookings = (bookings) => {
  fs.writeFileSync(bookingsFile, JSON.stringify(bookings, null, 2));
};

// 檢查時間衝突的函數
const hasTimeConflict = (newBooking, existingBookings) => {
  const newStart = moment(newBooking.startTime);
  const newEnd = moment(newBooking.endTime);
  
  return existingBookings.some(booking => {
    if (booking.venueId !== newBooking.venueId || booking.status === 'cancelled') {
      return false;
    }
    
    const existingStart = moment(booking.startTime);
    const existingEnd = moment(booking.endTime);
    
    // 檢查時間重疊
    return (newStart.isBefore(existingEnd) && newEnd.isAfter(existingStart));
  });
};

// 創建重複預訂的函數
const createRecurringBookings = async (bookingData, recurringInfo) => {
  const bookings = [];
  const startDate = moment(bookingData.startTime);
  const endDate = moment(bookingData.endTime);
  let currentDate = startDate.clone();
  
  // 生成未來12週的重複預訂（可根據需要調整）
  const maxOccurrences = 12;
  
  for (let i = 0; i < maxOccurrences; i++) {
    const booking = {
      id: uuidv4(),
      venueId: bookingData.venueId,
      venueName: bookingData.venueName,
      startTime: currentDate.clone().toISOString(),
      endTime: currentDate.clone().add(endDate.diff(startDate)).toISOString(),
      purpose: bookingData.purpose,
      contactInfo: bookingData.contactInfo,
      status: 'confirmed',
      createdAt: new Date().toISOString(),
      recurring: true,
      recurringType: recurringInfo.type,
      recurringPattern: recurringInfo.pattern
    };
    
    bookings.push(booking);
    
    // 根據重複類型增加時間
    switch (recurringInfo.type) {
      case 'weekly':
        currentDate.add(1, 'week');
        break;
      case 'daily':
        currentDate.add(1, 'day');
        break;
      case 'monthly':
        currentDate.add(1, 'month');
        break;
    }
  }
  
  return bookings;
};

// 使用DeepSeek API處理自然語言
const processNaturalLanguageWithAI = async (text) => {
  const venues = getAllVenues();
  const venueNames = venues.map(v => v.name).join('、');
  
  const systemPrompt = `你是一個專業的場地預訂助手。用戶會用中文自然語言描述他們的預訂需求，你需要從中提取以下信息：

可用場地：${venueNames}

請從用戶輸入中提取：
1. 場地名稱（必須是上述場地之一）
2. 開始時間（轉換為ISO格式）
3. 結束時間（如果沒有明確說明，默認2小時）
4. 用途/目的

請只返回JSON格式的結果，不要任何其他文字：
{
  "venue": "場地名稱",
  "startTime": "ISO時間格式",
  "endTime": "ISO時間格式", 
  "purpose": "用途",
  "confidence": 0.0-1.0的信心分數
}

如果無法提取完整信息，請返回confidence為0。`;

  try {
    const response = await axios.post(
      process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com/v1/chat/completions',
      {
        model: "deepseek-chat",
        messages: [
          {
            role: "system",
            content: systemPrompt
          },
          {
            role: "user", 
            content: text
          }
        ],
        temperature: 0.1,
        max_tokens: 500
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const aiResponse = response.data.choices[0].message.content;
    console.log('DeepSeek AI 回應:', aiResponse);
    
    // 嘗試解析AI回應
    try {
      const parsed = JSON.parse(aiResponse);
      
      // 驗證場地是否存在
      const venue = findVenueByName(parsed.venue);
      if (venue) {
        return {
          venue: venue,
          startTime: parsed.startTime,
          endTime: parsed.endTime,
          purpose: parsed.purpose || '場地使用',
          confidence: parsed.confidence || 0.8
        };
      }
    } catch (parseError) {
      console.error('解析AI回應失敗:', parseError);
    }
    
    // 如果AI解析失敗，使用後備邏輯
    return await fallbackProcessing(text);
    
  } catch (error) {
    console.error('DeepSeek API 調用失敗:', error.message);
    // 使用後備邏輯
    return await fallbackProcessing(text);
  }
};

// 後備處理邏輯（原來的模擬AI）
const fallbackProcessing = async (text) => {
  const result = {
    venue: null,
    startTime: null,
    endTime: null,
    purpose: null,
    confidence: 0,
    recurring: null // 新增：重複預訂信息
  };
  
  // 時間解析 - 支持多種格式
  let dateBase = moment();
  let timeMatched = false;
  
  // 1. 具體日期格式匹配
  const dateFormats = [
    /(\d{4})[年\-\/](\d{1,2})[月\-\/](\d{1,2})[日]?/,  // 2024年1月15日 or 2024-1-15
    /(\d{1,2})[月\-\/](\d{1,2})[日]?/,                // 1月15日 or 1-15
    /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/,         // 1/15/2024 or 1-15-2024
    /(\d{1,2})[\/\-](\d{1,2})/                       // 1/15 or 1-15
  ];
  
  for (const format of dateFormats) {
    const match = text.match(format);
    if (match) {
      try {
        if (match[0].includes('年') || match[0].includes('-') && match[3]) {
          // 完整年月日
          const year = match[1].length === 4 ? match[1] : match[3];
          const month = match[2];
          const day = match[1].length === 4 ? match[3] : match[1];
          dateBase = moment(`${year}-${month}-${day}`, 'YYYY-M-D');
        } else if (match[0].includes('月')) {
          // 月日格式
          dateBase = moment().month(parseInt(match[1]) - 1).date(parseInt(match[2]));
          if (dateBase.isBefore(moment())) {
            dateBase.add(1, 'year'); // 如果日期已過，設為明年
          }
        } else {
          // 數字格式 MM/DD
          dateBase = moment().month(parseInt(match[1]) - 1).date(parseInt(match[2]));
          if (dateBase.isBefore(moment())) {
            dateBase.add(1, 'year');
          }
        }
        
        if (dateBase.isValid()) {
          result.confidence += 0.3;
          timeMatched = true;
          break;
        }
      } catch (e) {
        console.log('日期解析錯誤:', e);
      }
    }
  }
  
  // 2. 相對時間詞匹配
  if (!timeMatched) {
    if (text.includes('今天') || text.includes('今日')) {
      dateBase = moment();
      result.confidence += 0.2;
      timeMatched = true;
    } else if (text.includes('明天') || text.includes('明日')) {
      dateBase = moment().add(1, 'day');
      result.confidence += 0.2;
      timeMatched = true;
    } else if (text.includes('後天')) {
      dateBase = moment().add(2, 'days');
      result.confidence += 0.2;
      timeMatched = true;
    } else if (text.includes('下週') || text.includes('下周')) {
      dateBase = moment().add(1, 'week');
      result.confidence += 0.2;
      timeMatched = true;
    }
  }
  
  // 3. 星期匹配
  const weekdays = {
    '星期一': 1, '週一': 1, '周一': 1, '禮拜一': 1,
    '星期二': 2, '週二': 2, '周二': 2, '禮拜二': 2,
    '星期三': 3, '週三': 3, '周三': 3, '禮拜三': 3,
    '星期四': 4, '週四': 4, '周四': 4, '禮拜四': 4,
    '星期五': 5, '週五': 5, '周五': 5, '禮拜五': 5,
    '星期六': 6, '週六': 6, '周六': 6, '禮拜六': 6,
    '星期日': 0, '週日': 0, '周日': 0, '禮拜日': 0, '星期天': 0
  };
  
  for (const [weekday, dayNum] of Object.entries(weekdays)) {
    if (text.includes(weekday)) {
      if (!timeMatched) {
        // 找到下一個該星期幾
        const today = moment();
        const targetDay = today.clone().day(dayNum);
        if (targetDay.isSameOrBefore(today)) {
          targetDay.add(1, 'week');
        }
        dateBase = targetDay;
        timeMatched = true;
      }
      result.confidence += 0.2;
      break;
    }
  }
  
  // 4. 重複預訂檢測
  const recurringPatterns = [
    { pattern: /每週?[一二三四五六日天]/, type: 'weekly' },
    { pattern: /每個?(星期|週|周)[一二三四五六日天]/, type: 'weekly' },
    { pattern: /逢(星期|週|周)[一二三四五六日天]/, type: 'weekly' },
    { pattern: /每天/, type: 'daily' },
    { pattern: /每日/, type: 'daily' },
    { pattern: /每月/, type: 'monthly' }
  ];
  
  for (const {pattern, type} of recurringPatterns) {
    if (pattern.test(text)) {
      result.recurring = { type, pattern: text.match(pattern)[0] };
      result.confidence += 0.2;
      break;
    }
  }
  
  // 場地匹配邏輯保持不變
  const venues = [
    { id: '101', name: '101號室', aliases: ['101', '101室', '101號'] },
    { id: '102', name: '102號室', aliases: ['102', '102室', '102號'] },
    { id: '103', name: '103號室', aliases: ['103', '103室', '103號'] },
    { id: '201', name: '201號室', aliases: ['201', '201室', '201號'] },
    { id: '202', name: '202號室', aliases: ['202', '202室', '202號'] },
    { id: '203', name: '203號室', aliases: ['203', '203室', '203號'] },
    { id: '301', name: '301號室', aliases: ['301', '301室', '301號'] },
    { id: '302', name: '302號室', aliases: ['302', '302室', '302號'] },
    { id: '303', name: '303號室', aliases: ['303', '303室', '303號'] },
    { id: 'music', name: '音樂室', aliases: ['音樂室', '音樂', '琴房'] },
    { id: 'art', name: '美術室', aliases: ['美術室', '美術', '畫室'] },
    { id: 'computer', name: '電腦室', aliases: ['電腦室', '電腦', '機房'] },
    { id: 'language', name: '語言實驗室', aliases: ['語言室', '語言實驗室', '語音室'] },
    { id: 'science', name: '科學實驗室', aliases: ['實驗室', '科學室', '化學室', '物理室'] },
    { id: 'library', name: '圖書館', aliases: ['圖書館', '圖書室', '閱覽室'] },
    { id: 'gym', name: '體育館', aliases: ['體育館', '運動場', '籃球場'] },
    { id: 'auditorium', name: '禮堂', aliases: ['禮堂', '大禮堂', '演講廳'] },
    { id: 'meeting', name: '會議室', aliases: ['會議室', '會議廳', '討論室'] },
    { id: 'cafeteria', name: '多功能室', aliases: ['多功能室', '活動室', '餐廳'] },
    { id: 'roof', name: '天台', aliases: ['天台', '屋頂', '頂樓'] },
    { id: 'playground', name: '操場', aliases: ['操場', '運動場', '田徑場'] }
  ];
  
  for (const venue of venues) {
    for (const alias of venue.aliases) {
      if (text.includes(alias)) {
        result.venue = venue;
        result.confidence += 0.3;
        break;
      }
    }
    if (result.venue) break;
  }
  
  // 時間提取 - 支持多種格式
  const timePatterns = [
    /(\d{1,2})[點時:](\d{1,2})/,                    // 14:30, 2點30
    /(\d{1,2})[點時]/,                              // 14點, 2時
    /(上午|早上|AM|am)\s*(\d{1,2})[點時:]?(\d{1,2})?/, // 上午10點
    /(下午|PM|pm)\s*(\d{1,2})[點時:]?(\d{1,2})?/,   // 下午2點
    /(晚上|傍晚|夜晚)\s*(\d{1,2})[點時:]?(\d{1,2})?/, // 晚上7點
    /(中午|noon)\s*(\d{1,2})?[點時:]?(\d{1,2})?/    // 中午12點
  ];
  
  for (const pattern of timePatterns) {
    const match = text.match(pattern);
    if (match) {
      let hour, minute = 0;
      
      if (match[0].includes('上午') || match[0].includes('早上') || match[0].includes('AM') || match[0].includes('am')) {
        hour = parseInt(match[2]);
        minute = match[3] ? parseInt(match[3]) : 0;
      } else if (match[0].includes('下午') || match[0].includes('PM') || match[0].includes('pm')) {
        hour = parseInt(match[2]);
        if (hour !== 12) hour += 12;
        minute = match[3] ? parseInt(match[3]) : 0;
      } else if (match[0].includes('晚上') || match[0].includes('傍晚') || match[0].includes('夜晚')) {
        hour = parseInt(match[2]);
        if (hour < 12) hour += 12;
        minute = match[3] ? parseInt(match[3]) : 0;
      } else if (match[0].includes('中午') || match[0].includes('noon')) {
        hour = match[2] ? parseInt(match[2]) : 12;
        minute = match[3] ? parseInt(match[3]) : 0;
      } else {
        // 直接時間格式
        hour = parseInt(match[1]);
        minute = match[2] ? parseInt(match[2]) : 0;
        
        // 智能判斷上下午
        if (hour < 8) hour += 12; // 7點以前視為下午/晚上
      }
      
      if (dateBase && dateBase.isValid()) {
        result.startTime = dateBase.clone().hour(hour).minute(minute).second(0).toISOString();
        result.confidence += 0.3;
        
        // 智能時長判斷
        let duration = 2; // 默認2小時
        const durationMatch = text.match(/(\d+)\s*[個]?小時/);
        if (durationMatch) {
          duration = parseInt(durationMatch[1]);
          result.confidence += 0.1;
        } else if (text.includes('整天') || text.includes('全天')) {
          duration = 8;
        } else if (text.includes('半天')) {
          duration = 4;
        }
        
        result.endTime = moment(result.startTime).add(duration, 'hours').toISOString();
        break;
      }
    }
  }
  
  // 如果沒有匹配到具體時間，但有時間基準，設置默認時間
  if (!result.startTime && timeMatched && dateBase.isValid()) {
    result.startTime = dateBase.clone().hour(14).minute(0).second(0).toISOString(); // 默認下午2點
    result.endTime = dateBase.clone().hour(16).minute(0).second(0).toISOString();   // 默認到4點
    result.confidence += 0.1;
  }
  
  // 用途提取
  const purposeKeywords = {
    '會議': ['會議', '開會', '討論', '商議'],
    '上課': ['上課', '教學', '培訓', '講座', '課程'],
    '活動': ['活動', '聚會', '慶祝', '派對', '表演'],
    '練習': ['練習', '排練', '訓練', '演練'],
    '考試': ['考試', '測驗', '評估'],
    '研習': ['研習', '研討', '學習', '進修'],
    '運動': ['運動', '比賽', '競賽', '體育'],
    '表演': ['表演', '演出', '音樂會', '話劇']
  };
  
  for (const [purpose, keywords] of Object.entries(purposeKeywords)) {
    for (const keyword of keywords) {
      if (text.includes(keyword)) {
        result.purpose = purpose;
        result.confidence += 0.2;
        break;
      }
    }
    if (result.purpose) break;
  }
  
  if (!result.purpose) {
    result.purpose = '場地使用';
  }
  
  return result;
};

// POST /api/ai/parse - 解析自然語言預訂請求
router.post('/parse', async (req, res) => {
  try {
    const { text } = req.body;
    
    if (!text) {
      return res.status(400).json({ error: '請提供要解析的文本' });
    }
    
    console.log('處理用戶輸入:', text);
    
    // 使用DeepSeek AI處理
    const parsed = await processNaturalLanguageWithAI(text);
    
    // 構建回應
    const response = {
      originalText: text,
      parsed: parsed,
      suggestions: [],
      canProceed: parsed.venue && parsed.startTime && parsed.confidence > 0.5,
      aiProvider: 'DeepSeek'
    };
    
    // 如果解析成功，提供建議
    if (response.canProceed) {
      response.suggestions.push({
        venue: parsed.venue,
        startTime: parsed.startTime,
        endTime: parsed.endTime,
        purpose: parsed.purpose,
        formattedTime: `${moment(parsed.startTime).format('YYYY-MM-DD HH:mm')} - ${moment(parsed.endTime).format('HH:mm')}`
      });
    } else {
      // 如果解析失敗，提供幫助信息
      response.error = '無法完全理解您的預訂需求';
      response.help = {
        message: '請確保包含以下信息：',
        required: ['場地名稱', '時間', '用途'],
        examples: [
          '我想在明天下午2點借101號室開會',
          '下週三上午10點使用音樂室練習',
          '這週五晚上7點在禮堂舉辦活動'
        ]
      };
    }
    
    console.log('解析結果:', response);
    res.json(response);
  } catch (error) {
    console.error('AI解析錯誤:', error);
    res.status(500).json({ error: 'AI解析失敗' });
  }
});

// POST /api/ai/book - 基於AI解析結果創建預訂
router.post('/book', async (req, res) => {
  try {
    const { text, contactInfo } = req.body;
    
    if (!text || !contactInfo) {
      return res.status(400).json({ error: '請提供預訂文本和聯絡信息' });
    }
    
    const parsed = await processNaturalLanguageWithAI(text);
    
    if (!parsed.venue || !parsed.startTime || parsed.confidence <= 0.5) {
      return res.status(400).json({ 
        error: '無法理解您的預訂需求',
        parsed: parsed
      });
    }
    
    // 準備預訂數據
    const bookingData = {
      venueId: parsed.venue.id,
      venueName: parsed.venue.name,
      startTime: parsed.startTime,
      endTime: parsed.endTime,
      purpose: parsed.purpose,
      contactInfo: contactInfo
    };
    
    console.log('準備創建預訂:', bookingData);
    
    // 直接處理預訂（支持重複預訂）
    const existingBookings = readBookings();
    
    if (parsed.recurring) {
      // 創建重複預訂
      const recurringBookings = await createRecurringBookings(bookingData, parsed.recurring);
      const conflictingBookings = [];
      const successfulBookings = [];
      
      // 檢查每個重複預訂的時間衝突
      for (const booking of recurringBookings) {
        if (hasTimeConflict(booking, existingBookings)) {
          conflictingBookings.push({
            date: moment(booking.startTime).format('YYYY-MM-DD'),
            time: moment(booking.startTime).format('HH:mm')
          });
        } else {
          successfulBookings.push(booking);
          existingBookings.push(booking);
        }
      }
      
      if (successfulBookings.length > 0) {
        writeBookings(existingBookings);
        
        res.json({
          success: true,
          message: `成功創建 ${successfulBookings.length} 個重複預訂`,
          booking: successfulBookings[0], // 返回第一個預訂作為主要預訂
          recurringBookings: successfulBookings,
          conflicts: conflictingBookings,
          aiAnalysis: parsed,
          aiProvider: 'DeepSeek'
        });
      } else {
        res.status(409).json({
          error: '所有重複預訂時段都已被佔用',
          conflicts: conflictingBookings,
          conflict: true
        });
      }
    } else {
      // 創建單次預訂
      if (hasTimeConflict(bookingData, existingBookings)) {
        return res.status(409).json({
          error: '該時段已被預訂',
          conflict: true
        });
      }
      
      const newBooking = {
        id: uuidv4(),
        ...bookingData,
        status: 'confirmed',
        createdAt: new Date().toISOString(),
        recurring: false
      };
      
      existingBookings.push(newBooking);
      writeBookings(existingBookings);
      
      res.json({
        success: true,
        message: '預訂成功創建',
        booking: newBooking,
        aiAnalysis: parsed,
        aiProvider: 'DeepSeek'
      });
    }
    
  } catch (error) {
    console.error('AI預訂處理失敗:', error);
    res.status(500).json({ 
      error: 'AI預訂處理失敗',
      details: error.message 
    });
  }
});

// GET /api/ai/status - 檢查AI服務狀態
router.get('/status', async (req, res) => {
  try {
    // 測試DeepSeek API連接
    const testResponse = await axios.post(
      process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com/v1/chat/completions',
      {
        model: "deepseek-chat",
        messages: [
          {
            role: "user",
            content: "Hello"
          }
        ],
        max_tokens: 10
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    res.json({
      status: 'operational',
      provider: 'DeepSeek',
      apiConnected: true,
      model: 'deepseek-chat'
    });
  } catch (error) {
    console.error('DeepSeek API測試失敗:', error.message);
    res.json({
      status: 'degraded',
      provider: 'DeepSeek (Fallback)',
      apiConnected: false,
      error: error.message,
      fallbackAvailable: true,
      endpoint: process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com/v1/chat/completions',
      hasApiKey: !!process.env.DEEPSEEK_API_KEY
    });
  }
});

module.exports = router; 