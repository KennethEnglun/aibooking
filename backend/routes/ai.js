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

// 使用DeepSeek API處理自然語言 - 增強版本
const processNaturalLanguageWithAI = async (text) => {
  console.log('🤖 開始處理用戶輸入:', text);
  
  const venues = getAllVenues();
  const venueList = venues.map(v => `${v.name}(${v.type})`).join('、');
  
  const systemPrompt = `你是一個專業的中文場地預訂助手。你的任務是理解用戶的自然語言預訂需求並提取關鍵信息。

【可用場地列表】
${venueList}

【理解規則】
1. 場地：識別用戶提到的場地名稱，支持簡稱（如"音樂"指"音樂室"）
2. 時間：支持多種中文時間表達方式，使用中國時區(+08:00)
3. 用途：識別預訂目的
4. 時長：如果只說開始時間，默認2小時；如果說"至"某時間，計算實際時長

【輸出格式】
請嚴格按照以下JSON格式返回，不要有任何其他文字：
{
  "venue": "精確的場地名稱",
  "startTime": "YYYY-MM-DDTHH:mm:ss.SSS+08:00格式",
  "endTime": "YYYY-MM-DDTHH:mm:ss.SSS+08:00格式",
  "purpose": "預訂用途",
  "confidence": 0.9
}

【時間解析示例】
- "2025年6月30日下午四點" → "2025-06-30T16:00:00.000+08:00"
- "明天上午10點" → "2025-06-29T10:00:00.000+08:00"（如果今天是28日）
- "下午三點至六點" → 開始"15:00"，結束"18:00"

重要：時間必須使用中國時區格式(+08:00)，不要使用UTC時間！

請分析用戶輸入並返回JSON結果：`;

  try {
    console.log('📡 調用DeepSeek API...');
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
        max_tokens: 800,
        top_p: 0.9
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 15000
      }
    );

    const aiResponse = response.data.choices[0].message.content.trim();
    console.log('🤖 DeepSeek 原始回應:', aiResponse);
    
    // 清理回應，移除可能的markdown格式
    let cleanedResponse = aiResponse;
    if (aiResponse.includes('```')) {
      const jsonMatch = aiResponse.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
      if (jsonMatch) {
        cleanedResponse = jsonMatch[1];
      }
    }
    
    console.log('🧹 清理後的回應:', cleanedResponse);
    
    // 嘗試解析AI回應
    try {
      const parsed = JSON.parse(cleanedResponse);
      console.log('📋 解析後的數據:', parsed);
      
      // 智能場地匹配
      let venue = null;
      if (parsed.venue) {
        venue = findVenueByName(parsed.venue);
        console.log('🏢 場地匹配結果:', venue ? venue.name : '未找到');
        
        // 如果精確匹配失敗，嘗試從原文本中提取
        if (!venue) {
          console.log('🔍 嘗試從原文本提取場地...');
          venue = extractVenueFromText(text);
        }
      }
      
      // 智能時間解析和驗證
      let startTime = parsed.startTime;
      let endTime = parsed.endTime;
      
      if (startTime && !moment(startTime).isValid()) {
        console.log('⚠️ AI返回的開始時間無效，嘗試重新解析');
        const timeResult = extractTimeFromText(text);
        startTime = timeResult.startTime;
        endTime = timeResult.endTime;
      } else if (startTime && moment(startTime).isValid()) {
        // 🔧 修復時區問題：如果AI返回的是UTC時間，轉換為本地時區格式
        const startMoment = moment(startTime);
        const endMoment = moment(endTime);
        
        // 檢查是否為UTC格式（包含Z或+00:00）
        if (startTime.includes('Z') || startTime.includes('+00:00')) {
          console.log('🔧 檢測到UTC時間，轉換為本地時區格式');
          // 將UTC時間轉換為本地時間字符串
          const localStart = moment.utc(startTime).utcOffset('+08:00');
          const localEnd = moment.utc(endTime).utcOffset('+08:00');
          startTime = localStart.format('YYYY-MM-DDTHH:mm:ss');
          endTime = localEnd.format('YYYY-MM-DDTHH:mm:ss');
          console.log('✅ 時間轉換完成:', { startTime, endTime });
        }
      }
      
      const result = {
        venue: venue,
        startTime: startTime,
        endTime: endTime,
        purpose: parsed.purpose || extractPurposeFromText(text),
        confidence: venue && startTime ? Math.max(parsed.confidence || 0.8, 0.7) : 0.3,
        aiProvider: 'DeepSeek',
        debug: {
          originalAiResponse: aiResponse,
          parsedData: parsed,
          venueFound: !!venue,
          timeValid: !!startTime
        }
      };
      
      console.log('✅ AI處理結果:', result);
      return result;
      
    } catch (parseError) {
      console.error('❌ 解析AI回應失敗:', parseError.message);
      console.log('🔄 使用後備解析邏輯');
    }
    
  } catch (error) {
    console.error('❌ DeepSeek API 調用失敗:', error.message);
    console.log('🔄 使用後備處理邏輯');
  }
  
  // 使用增強的後備邏輯
  return await enhancedFallbackProcessing(text);
};

// 從文本中提取場地
const extractVenueFromText = (text) => {
  const venues = getAllVenues();
  
  // 直接匹配
  for (const venue of venues) {
    if (text.includes(venue.name)) {
      console.log('🎯 直接匹配到場地:', venue.name);
      return venue;
    }
  }
  
  // 使用增強的查找功能
  const keywords = ['音樂', '電腦', '活動', '英語', '操場', '禮堂', '壁球', '電競', '輔導'];
  for (const keyword of keywords) {
    if (text.includes(keyword)) {
      const venue = findVenueByName(keyword);
      if (venue) {
        console.log('🎯 關鍵詞匹配到場地:', venue.name);
        return venue;
      }
    }
  }
  
  // 房間號匹配
  const roomMatch = text.match(/(\d{3})[號]?[室房間]?/);
  if (roomMatch) {
    const venue = findVenueByName(roomMatch[1]);
    if (venue) {
      console.log('🎯 房間號匹配到場地:', venue.name);
      return venue;
    }
  }
  
  return null;
};

// 從文本中提取時間
const extractTimeFromText = (text) => {
  console.log('⏰ 開始解析時間:', text);
  
  let startTime = null;
  let endTime = null;
  let dateBase = moment();
  
  // 1. 解析具體日期
  const datePatterns = [
    /(\d{4})年(\d{1,2})月(\d{1,2})日/,  // 2025年6月30日
    /(\d{1,2})月(\d{1,2})日/,           // 6月30日
    /(\d{4})-(\d{1,2})-(\d{1,2})/,     // 2025-6-30
    /(\d{1,2})\/(\d{1,2})\/(\d{4})/    // 6/30/2025
  ];
  
  for (const pattern of datePatterns) {
    const match = text.match(pattern);
    if (match) {
      try {
        if (match[0].includes('年')) {
          dateBase = moment(`${match[1]}-${match[2]}-${match[3]}`, 'YYYY-M-D');
        } else if (match[0].includes('月')) {
          dateBase = moment().year(new Date().getFullYear()).month(parseInt(match[1]) - 1).date(parseInt(match[2]));
        } else if (match[0].includes('-')) {
          dateBase = moment(`${match[1]}-${match[2]}-${match[3]}`, 'YYYY-M-D');
        }
        
        if (dateBase.isValid()) {
          console.log('📅 解析到日期:', dateBase.format('YYYY-MM-DD'));
          break;
        }
      } catch (e) {
        console.log('⚠️ 日期解析失敗:', e.message);
      }
    }
  }
  
  // 2. 解析時間範圍
  const timeRangePatterns = [
    /(下午|上午|中午|晚上|早上)([一二三四五六七八九十\d]+)點([一二三四五六七八九十\d]+)?分?[至到]([一二三四五六七八九十\d]+)點([一二三四五六七八九十\d]+)?分?/,
    /([一二三四五六七八九十\d]+)點([一二三四五六七八九十\d]+)?分?[至到]([一二三四五六七八九十\d]+)點([一二三四五六七八九十\d]+)?分?/,
    /(下午|上午|中午|晚上|早上)([一二三四五六七八九十\d]+)[點時]/
  ];
  
  for (const pattern of timeRangePatterns) {
    const match = text.match(pattern);
    if (match) {
      try {
        let startHour = 0;
        let startMinute = 0;
        let endHour = 0;
        let endMinute = 0;
        
        if (match[0].includes('至') || match[0].includes('到')) {
          // 時間範圍
          const period = match[1];
          startHour = chineseNumberToInt(match[2]);
          startMinute = match[3] ? chineseNumberToInt(match[3]) : 0;
          endHour = chineseNumberToInt(match[4]);
          endMinute = match[5] ? chineseNumberToInt(match[5]) : 0;
          
          if (period && (period.includes('下午') || period.includes('晚上')) && startHour < 12) {
            startHour += 12;
          }
          if (period && (period.includes('下午') || period.includes('晚上')) && endHour < 12) {
            endHour += 12;
          }
        } else {
          // 單一時間
          const period = match[1];
          startHour = chineseNumberToInt(match[2]);
          startMinute = match[3] ? chineseNumberToInt(match[3]) : 0;
          
          if (period && (period.includes('下午') || period.includes('晚上')) && startHour < 12) {
            startHour += 12;
          }
          
          // 默認2小時
          endHour = startHour + 2;
          endMinute = startMinute;
        }
        
        // 🔧 修復時區問題：使用本地時間格式而不是UTC
        const startMoment = dateBase.clone().hour(startHour).minute(startMinute).second(0);
        const endMoment = dateBase.clone().hour(endHour).minute(endMinute).second(0);
        
        // 使用本地時間格式，避免時區轉換問題
        startTime = startMoment.format('YYYY-MM-DDTHH:mm:ss');
        endTime = endMoment.format('YYYY-MM-DDTHH:mm:ss');
        
        console.log('⏰ 解析到時間範圍:', {
          start: startMoment.format('YYYY-MM-DD HH:mm'),
          end: endMoment.format('YYYY-MM-DD HH:mm'),
          startTime: startTime,
          endTime: endTime
        });
        break;
        
      } catch (e) {
        console.log('⚠️ 時間解析失敗:', e.message);
      }
    }
  }
  
  return { startTime, endTime };
};

// 從文本中提取用途
const extractPurposeFromText = (text) => {
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
        console.log('🎯 匹配到用途:', purpose);
        return purpose;
      }
    }
  }
  
  return '場地使用';
};

// 中文數字轉換
const chineseNumberToInt = (str) => {
  const chineseToNumber = {
    '一': 1, '二': 2, '三': 3, '四': 4, '五': 5,
    '六': 6, '七': 7, '八': 8, '九': 9, '十': 10,
    '十一': 11, '十二': 12
  };
  
  return chineseToNumber[str] || parseInt(str) || 0;
};

// 增強的後備處理邏輯
const enhancedFallbackProcessing = async (text) => {
  console.log('🔧 使用增強後備處理邏輯');
  
  const venue = extractVenueFromText(text);
  const timeResult = extractTimeFromText(text);
  const purpose = extractPurposeFromText(text);
  
  const result = {
    venue: venue,
    startTime: timeResult.startTime,
    endTime: timeResult.endTime,
    purpose: purpose,
    confidence: venue && timeResult.startTime ? 0.7 : 0.3,
    aiProvider: 'Fallback',
    debug: {
      venueFound: !!venue,
      timeFound: !!timeResult.startTime,
      originalText: text
    }
  };
  
  console.log('🔧 後備處理結果:', result);
  return result;
};

// POST /api/ai - 處理自然語言預訂請求 - 增強版本
router.post('/', async (req, res) => {
  try {
    const { text } = req.body;
    
    if (!text || text.trim().length === 0) {
      return res.status(400).json({ 
        error: '請提供預訂描述文本',
        success: false
      });
    }
    
    console.log('🚀 收到AI處理請求:', { text, timestamp: new Date().toISOString() });
    
    // 使用增強的AI處理
    const parsed = await processNaturalLanguageWithAI(text);
    
    console.log('🎯 AI處理完成:', {
      venue: parsed.venue?.name || 'none',
      confidence: parsed.confidence,
      aiProvider: parsed.aiProvider || 'unknown',
      hasTime: !!parsed.startTime
    });
    
    // 構建詳細回應
    const response = {
      success: true,
      originalText: text,
      parsed: {
        venue: parsed.venue,
        startTime: parsed.startTime,
        endTime: parsed.endTime,
        purpose: parsed.purpose,
        confidence: parsed.confidence,
        recurring: parsed.recurring,
        aiProvider: parsed.aiProvider
      },
      suggestions: [],
      canProceed: false,
      debug: parsed.debug || {}
    };
    
    // 判斷是否可以繼續預訂
    if (parsed.venue && parsed.startTime && parsed.confidence > 0.3) {
      response.canProceed = true;
      
      // 格式化時間顯示
      const startMoment = moment(parsed.startTime);
      const endMoment = moment(parsed.endTime);
      
      const suggestion = {
        venue: parsed.venue,
        startTime: parsed.startTime,
        endTime: parsed.endTime,
        purpose: parsed.purpose,
        formattedTime: `${startMoment.format('YYYY年MM月DD日 HH:mm')} - ${endMoment.format('HH:mm')}`,
        formattedDate: startMoment.format('YYYY-MM-DD'),
        formattedStartTime: startMoment.format('HH:mm'),
        formattedEndTime: endMoment.format('HH:mm'),
        duration: endMoment.diff(startMoment, 'hours', true),
        recurring: parsed.recurring
      };
      
      response.suggestions.push(suggestion);
      
      // 檢查時間衝突
      const existingBookings = readBookings();
      const hasConflict = hasTimeConflict({
        venueId: parsed.venue.id,
        startTime: parsed.startTime,
        endTime: parsed.endTime
      }, existingBookings);
      
      if (hasConflict) {
        response.warning = '該時段可能已被預訂，請確認是否繼續';
        response.hasConflict = true;
      }
      
      console.log('✅ 預訂建議生成成功:', suggestion);
      
    } else {
      // 處理解析失敗的情況
      response.canProceed = false;
      response.error = '無法完全理解您的預訂需求';
      
      // 提供智能幫助信息
      const helpInfo = {
        message: '請確保包含以下信息：',
        required: [],
        examples: [
          '我想預訂音樂室，明天下午2點到4點，用於練習',
          '2025年6月30日上午10點借101號室開會',
          '下週三晚上7點在禮堂舉辦活動，需要2小時'
        ]
      };
      
      // 分析缺少的信息
      if (!parsed.venue) {
        helpInfo.required.push('場地名稱（如：音樂室、101號室、禮堂等）');
      }
      
      if (!parsed.startTime) {
        helpInfo.required.push('時間（如：明天下午2點、2025年6月30日上午10點）');
      }
      
      if (parsed.confidence < 0.3) {
        helpInfo.required.push('更清楚的表達方式');
      }
      
      response.help = helpInfo;
      
      console.log('⚠️ 預訂解析不完整:', {
        hasVenue: !!parsed.venue,
        hasTime: !!parsed.startTime,
        confidence: parsed.confidence
      });
    }
    
    // 添加處理統計
    response.processingStats = {
      timestamp: new Date().toISOString(),
      processingTime: Date.now() - new Date(response.debug.timestamp || Date.now()).getTime(),
      aiProvider: parsed.aiProvider || 'Unknown',
      confidence: parsed.confidence,
      fallbackUsed: parsed.aiProvider === 'Fallback'
    };
    
    console.log('📤 返回AI處理結果:', {
      canProceed: response.canProceed,
      hasConflict: response.hasConflict,
      suggestions: response.suggestions.length
    });
    
    res.json(response);
    
  } catch (error) {
    console.error('❌ AI處理發生錯誤:', {
      error: error.message,
      stack: error.stack,
      input: req.body
    });
    
    res.status(500).json({ 
      success: false,
      error: '處理您的請求時遇到了問題，請稍後再試',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      timestamp: new Date().toISOString()
    });
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