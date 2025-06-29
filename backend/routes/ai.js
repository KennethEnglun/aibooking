const express = require('express');
const axios = require('axios');
const moment = require('moment-timezone');
const { findVenueByName, getAllVenues } = require('../config/venues');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const storage = require('../data/storage');

// 確保環境變量被正確加載
require('dotenv').config();

const router = express.Router();

// 在模塊開始時檢查環境變量
console.log('🔧 AI模塊環境變量檢查:');
console.log('🔑 DEEPSEEK_API_KEY:', process.env.DEEPSEEK_API_KEY ? '已配置' : '❌ 缺失');
console.log('🌐 DEEPSEEK_API_URL:', process.env.DEEPSEEK_API_URL || '使用默認');
console.log('🎯 NODE_ENV:', process.env.NODE_ENV || 'development');

// 預設所有 moment() 使用香港時區
moment.tz.setDefault('Asia/Hong_Kong');

// 統一使用storage模塊的輔助函數
const readBookings = () => {
  return storage.loadBookings();
};

const writeBookings = (bookings) => {
  // 使用storage模塊重新保存所有預訂
  return storage.saveBookings(bookings);
};

const addSingleBooking = (booking) => {
  // 添加單個預訂
  return storage.addBooking(booking);
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
  
  // 若為每週重複，並提供 dayOfWeek，將 currentDate 調整到最近一次該星期
  if (recurringInfo.type === 'weekly' && recurringInfo.dayOfWeek !== null) {
    const targetDay = recurringInfo.dayOfWeek; // 0 (日)~6 (六)
    const currentDay = currentDate.day();
    let daysToAdd = (targetDay - currentDay + 7) % 7;
    if (daysToAdd === 0) daysToAdd = 7; // 總是排到下一週
    currentDate.add(daysToAdd, 'days');
  }
  
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

// 使用DeepSeek API處理自然語言 - 終極穩定版本
const processNaturalLanguageWithAI = async (text) => {
  console.log('🤖 開始處理用戶輸入:', text);
  
  // 檢查環境變量
  if (!process.env.DEEPSEEK_API_KEY) {
    console.error('❌ DEEPSEEK_API_KEY 環境變量未設置');
    console.log('🔄 使用後備處理邏輯');
    return await enhancedFallbackProcessing(text);
  }
  
  const venues = getAllVenues();
  const venueList = venues.map(v => `${v.name}(${v.type})`).join('、');
  
  const systemPrompt = `你是一個專業的中文場地預訂助手。你的任務是理解用戶的自然語言預訂需求並提取關鍵信息。

【可用場地列表】
${venueList}

【理解規則】
1. 場地：識別用戶提到的場地名稱，支持簡稱（如"音樂"指"音樂室"）
2. 時間：支持多種中文時間表達方式，使用香港時區(+08:00)
3. 用途：識別預訂目的
4. 時長：如果只說開始時間，默認2小時；如果說"至"某時間，計算實際時長
5. 日期格式：香港格式日/月，如"1/7"表示7月1日，"15/3"表示3月15日
6. 相對時間：準確理解"明天"、"後天"、"下星期一"等詞彙，基準時間為香港時區

【輸出格式】
請嚴格按照以下JSON格式返回，不要有任何其他文字：
{
  "venue": "精確的場地名稱",
  "startTime": "YYYY-MM-DDTHH:mm:ss.000Z",
  "endTime": "YYYY-MM-DDTHH:mm:ss.000Z", 
  "purpose": "預訂用途",
  "confidence": 0.9
}`;

  const maxRetries = 15; // 增加到15次重試
  let response = null;
  let lastError = null;
  
  // 創建專用的axios實例，優化網絡配置
  const apiClient = axios.create({
    timeout: 45000, // 降低到45秒避免長時間等待
    headers: {
      'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'User-Agent': 'AIBooking/2.0',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    },
    maxRedirects: 3,
    validateStatus: function (status) {
      return status >= 200 && status < 300;
    },
    // 優化網絡連接
    httpsAgent: new (require('https').Agent)({
      keepAlive: true,
      maxSockets: 50,
      maxFreeSockets: 10,
      timeout: 45000,
      freeSocketTimeout: 30000
    })
  });
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`📡 調用DeepSeek API... (嘗試 ${attempt}/${maxRetries})`);
      
      const apiUrl = process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com/v1/chat/completions';
      console.log(`🎯 請求URL: ${apiUrl} (${attempt === 1 ? '首次' : '重試'})`);
      
      // 創建可取消的請求
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.log(`⏰ 請求超時(45s)，取消第${attempt}次嘗試`);
        controller.abort();
      }, 45000);
      
      const requestPayload = {
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
        max_tokens: 600, // 稍微降低以加快響應
        top_p: 0.9,
        stream: false // 確保不使用流式響應
      };
      
      response = await apiClient.post(
        apiUrl,
        requestPayload,
        {
          signal: controller.signal,
          // 為這個特定請求設置更短超時
          timeout: 40000
        }
      );
      
      clearTimeout(timeoutId);
      console.log(`✅ DeepSeek API調用成功 (第${attempt}次嘗試)`);
      console.log(`📊 響應狀態: ${response.status}, 數據大小: ${JSON.stringify(response.data).length} 字符`);
      break; // 成功則跳出重試循環
      
    } catch (apiError) {
      lastError = apiError;
      
      // 更詳細的錯誤分類
      let errorCategory = 'unknown';
      let errorMsg = 'unknown error';
      let shouldRetry = true;
      
      if (apiError.name === 'AbortError' || apiError.code === 'ECONNABORTED') {
        errorCategory = 'timeout';
        errorMsg = '請求超時/被中止';
      } else if (apiError.code === 'ENOTFOUND' || apiError.code === 'ECONNREFUSED') {
        errorCategory = 'network';
        errorMsg = '網絡連接失敗';
      } else if (apiError.code === 'ETIMEDOUT') {
        errorCategory = 'timeout';
        errorMsg = 'TCP連接超時';
      } else if (apiError.response) {
        errorCategory = 'http';
        errorMsg = `HTTP ${apiError.response.status}`;
        // 某些HTTP錯誤不應該重試
        if (apiError.response.status === 401 || apiError.response.status === 403) {
          shouldRetry = false;
        }
      } else if (apiError.request) {
        errorCategory = 'network';
        errorMsg = '無服務器響應';
      } else {
        errorCategory = 'config';
        errorMsg = apiError.message;
        shouldRetry = false; // 配置錯誤通常不應重試
      }
      
      console.log(`❌ DeepSeek API調用失敗 (第${attempt}/${maxRetries}次) [${errorCategory}]: ${errorMsg}`);
      
      // 詳細錯誤信息
      if (apiError.response) {
        console.log(`📊 HTTP錯誤詳情: ${apiError.response.status} - ${JSON.stringify(apiError.response.data).substring(0, 200)}`);
      } else {
        console.log(`🔧 錯誤代碼: ${apiError.code}, 消息: ${apiError.message}`);
      }
      
      // 如果不應該重試，直接跳出
      if (!shouldRetry) {
        console.log(`🚫 錯誤類型不適合重試，直接使用後備邏輯`);
        break;
      }
      
      if (attempt < maxRetries) {
        // 根據錯誤類型調整延遲策略
        let baseDelay;
        if (errorCategory === 'timeout') {
          baseDelay = Math.min(2000 * Math.pow(1.5, attempt - 1), 8000); // 超時錯誤用較短延遲
        } else if (errorCategory === 'network') {
          baseDelay = Math.min(3000 * Math.pow(2, attempt - 1), 12000); // 網絡錯誤用較長延遲
        } else {
          baseDelay = Math.min(1000 * Math.pow(2, attempt - 1), 10000); // 默認延遲
        }
        
        const jitter = Math.random() * 1000; // 隨機抖動0-1秒
        const delay = baseDelay + jitter;
        
        console.log(`⏳ 等待 ${Math.round(delay)}ms 後重試... (${errorCategory}錯誤策略)`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        console.error(`💥 所有 ${maxRetries} 次重試都失敗，最終錯誤:`, {
          category: errorCategory,
          message: lastError?.message,
          code: lastError?.code,
          httpStatus: lastError?.response?.status,
          apiKey: process.env.DEEPSEEK_API_KEY ? '已配置' : '❌未配置',
          apiUrl: process.env.DEEPSEEK_API_URL || '使用默認URL'
        });
      }
    }
  }
  
  if (!response) {
    console.error('❌ DeepSeek API 徹底失敗，切換到後備模式');
    console.log('🔄 使用後備處理邏輯');
    return await enhancedFallbackProcessing(text);
  }
  
  try {
    // 驗證響應數據
    if (!response.data || !response.data.choices || !response.data.choices[0]) {
      console.error('❌ API響應格式異常:', response.data);
      console.log('🔄 使用後備處理邏輯');
      return await enhancedFallbackProcessing(text);
    }
    
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
      
      // 🔧 開始智能時間處理...
      console.log('🔧 開始智能時間處理...');
      let startTime = null;
      let endTime = null;

      const baseMoment = getHongKongNow();

      // 先嘗試 AI 回傳時間
      let aiStartMoment = null;
      let aiEndMoment = null;
      if (parsed.startTime && parsed.endTime) {
        aiStartMoment = moment(parsed.startTime).tz('Asia/Hong_Kong');
        aiEndMoment   = moment(parsed.endTime).tz('Asia/Hong_Kong');
        if (!(aiStartMoment.isValid() && aiEndMoment.isValid())) {
          aiStartMoment = null;
          aiEndMoment = null;
        }
      }

      // 再使用本地正則解析
      const localTimeResult = extractTimeFromText(text, baseMoment);
      let localStartMoment = null, localEndMoment = null;
      if (localTimeResult.startTime) {
        localStartMoment = moment(localTimeResult.startTime);
        localEndMoment = moment(localTimeResult.endTime);
      }

      // 選擇較合理時間：優先使用距現在最近且未過去的時間
      const nowMoment = baseMoment.clone();
      const chooseLocal = () => {
        startTime = localTimeResult.startTime;
        endTime = localTimeResult.endTime;
        console.log('✅ 使用本地時間解析結果');
      };

      if (aiStartMoment && aiStartMoment.isAfter(nowMoment)) {
        // AI 時間在未來
        if (localStartMoment && localStartMoment.isAfter(nowMoment)) {
          // 兩者皆在未來，選較接近現在者
          const diffAi = Math.abs(aiStartMoment.diff(nowMoment));
          const diffLocal = Math.abs(localStartMoment.diff(nowMoment));
          if (diffLocal < diffAi) {
            chooseLocal();
          } else {
            startTime = aiStartMoment.format('YYYY-MM-DDTHH:mm:ss');
            endTime = aiEndMoment.format('YYYY-MM-DDTHH:mm:ss');
            console.log('✅ 使用 AI 時間 (較接近現在)');
          }
        } else {
          // 本地無有效未來時間，使用 AI
          startTime = aiStartMoment.format('YYYY-MM-DDTHH:mm:ss');
          endTime = aiEndMoment.format('YYYY-MM-DDTHH:mm:ss');
          console.log('✅ 使用 AI 時間');
        }
      } else if (localStartMoment && localStartMoment.isAfter(nowMoment)) {
        // 只本地有效
        chooseLocal();
      }

      // 3. 若仍失敗，使用當前時間 +2 小時作為預設
      if (!startTime) {
        console.log('⚠️ 全部時間解析失敗，使用預設 2 小時');
        const now = moment().tz('Asia/Hong_Kong');
        startTime = now.format('YYYY-MM-DDTHH:mm:ss');
        endTime   = now.add(2, 'hours').format('YYYY-MM-DDTHH:mm:ss');
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
      return await enhancedFallbackProcessing(text);
    }
    
  } catch (responseError) {
    console.error('❌ 處理API響應失敗:', responseError.message);
    console.log('🔄 使用後備處理邏輯');
    return await enhancedFallbackProcessing(text);
  }
};

// 解析重複預訂信息
const extractRecurringInfo = (text) => {
  // 若句子含有 "下星期"、"下週" 等相對時間詞，視為單次預訂
  const relativeWeekKeywords = /(下星期|下週|本星期|這星期|這週|今星期|今週)/;
  if (relativeWeekKeywords.test(text)) {
    return { isRecurring: false };
  }

  const recurringPatterns = [
    { pattern: /逢(星期|週)([一二三四五六日天])/g, type: 'weekly' },
    { pattern: /每(星期|週)([一二三四五六日天])/g, type: 'weekly' },
    { pattern: /每(個)?月/g, type: 'monthly' },
    { pattern: /逢月/g, type: 'monthly' },
    { pattern: /每天/g, type: 'daily' },
    { pattern: /每日/g, type: 'daily' }
  ];
  
  for (const { pattern, type } of recurringPatterns) {
    const match = pattern.exec(text);
    if (match) {
      let dayOfWeek = null;
      if (type === 'weekly' && match[2]) {
        const dayMapping = {
          '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '日': 0, '天': 0
        };
        dayOfWeek = dayMapping[match[2]];
      }
      
      console.log('📅 檢測到重複預訂:', { type, dayOfWeek, originalText: match[0] });
      return { 
        type, 
        dayOfWeek, 
        isRecurring: true,
        pattern: match[0]
      };
    }
  }
  
  return { isRecurring: false };
};

// 生成重複預訂的時間列表
const generateRecurringDates = (startTime, endTime, recurringInfo, maxOccurrences = 12) => {
  const dates = [];
  const startMoment = moment(startTime);
  const endMoment = moment(endTime);
  const duration = endMoment.diff(startMoment);
  
  let currentDate = startMoment.clone();
  
  // 若為每週重複，並提供 dayOfWeek，將 currentDate 調整到最近一次該星期
  if (recurringInfo.type === 'weekly' && recurringInfo.dayOfWeek !== null) {
    const targetDay = recurringInfo.dayOfWeek; // 0 (日)~6 (六)
    const currentDay = currentDate.day();
    let daysToAdd = (targetDay - currentDay + 7) % 7;
    if (daysToAdd === 0) daysToAdd = 7; // 總是排到下一週
    currentDate.add(daysToAdd, 'days');
  }
  
  for (let i = 0; i < maxOccurrences; i++) {
    const eventStart = currentDate.clone();
    const eventEnd = eventStart.clone().add(duration);
    
    dates.push({
      startTime: eventStart.toISOString(),
      endTime: eventEnd.toISOString(),
      occurrence: i + 1
    });
    
    // 根據重複類型增加時間間隔
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
  
  return dates;
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
const extractTimeFromText = (text, baseMoment) => {
  console.log('⏰ 開始解析時間:', text);
  
  let startTime = null;
  let endTime = null;
  
  // 1. 解析具體日期 - 香港格式優先
  const datePatterns = [
    /(\d{4})年(\d{1,2})月(\d{1,2})(?:日|號)/,  // 2026年6月30日 或 2026年6月30號
    /(\d{1,2})月(\d{1,2})(?:日|號)/,           // 6月30日 / 6月30號
    /(\d{4})-(\d{1,2})-(\d{1,2})/,           // 2026-6-30
    /(\d{1,2})\/(\d{1,2})\/(\d{4})/,       // 1/7/2026 (日/月/年)
    /(\d{1,2})\/(\d{1,2})/,                  // 1/7 (日/月)
    /(\d{4})\/(\d{1,2})\/(\d{1,2})/,       // 2026/6/30
    /([一二三四五六七八九十]+)月([一二三四五六七八九十]+)(?:日|號)?/ // 七月三日/七月三號
  ];
  
  // 首先處理相對時間詞彙
  const relativeTimePatterns = {
    '今天': 0,
    '今日': 0,
    '明天': 1,
    '明日': 1,
    '後天': 2,
    '後日': 2,
    '大後天': 3,
    '下星期一': 'next_monday',
    '下週一': 'next_monday',
    '下星期二': 'next_tuesday', 
    '下週二': 'next_tuesday',
    '下星期三': 'next_wednesday',
    '下週三': 'next_wednesday',
    '下星期四': 'next_thursday',
    '下週四': 'next_thursday',
    '下星期五': 'next_friday',
    '下週五': 'next_friday',
    '下星期六': 'next_saturday',
    '下週六': 'next_saturday',
    '下星期日': 'next_sunday',
    '下週日': 'next_sunday'
  };
  
  // 檢查相對時間詞彙
  for (const [keyword, offset] of Object.entries(relativeTimePatterns)) {
    if (text.includes(keyword)) {
      if (typeof offset === 'number') {
        baseMoment = baseMoment.add(offset, 'days');
        console.log(`📅 相對時間解析: ${keyword} → ${baseMoment.format('YYYY-MM-DD')}`);
        break;
      } else if (offset.startsWith('next_')) {
        const dayName = offset.replace('next_', '');
        const dayMapping = {
          'monday': 1, 'tuesday': 2, 'wednesday': 3, 'thursday': 4,
          'friday': 5, 'saturday': 6, 'sunday': 0
        };
        const targetDay = dayMapping[dayName];
        const currentDay = baseMoment.day();
        let daysToAdd = (targetDay + 7 - currentDay) % 7;
        if (daysToAdd === 0) daysToAdd = 7; // 如果是同一天，則為下星期
        baseMoment = baseMoment.add(daysToAdd, 'days');
        console.log(`📅 相對時間解析: ${keyword} → ${baseMoment.format('YYYY-MM-DD')}`);
        break;
      }
    }
  }

  // 然後處理具體日期
  for (const pattern of datePatterns) {
    const match = text.match(pattern);
    if (match) {
      try {
        if (match[0].includes('年')) {
          const year = parseInt(match[1]);
          const month = parseInt(match[2]) - 1; // moment月份從0開始
          const day = parseInt(match[3]);
          baseMoment = baseMoment.year(year).month(month).date(day);
          console.log('📅 解析到完整日期:', baseMoment.format('YYYY-MM-DD'));
        } else if (match[0].includes('月')) {
          const month = parseInt(match[1]) - 1;
          const day = parseInt(match[2]);
          baseMoment = baseMoment.month(month).date(day);
          console.log('📅 解析到月日:', baseMoment.format('YYYY-MM-DD'));
        } else if (match[0].includes('-')) {
          const year = parseInt(match[1]);
          const month = parseInt(match[2]) - 1;
          const day = parseInt(match[3]);
          baseMoment = baseMoment.year(year).month(month).date(day);
          console.log('📅 解析到數字日期:', baseMoment.format('YYYY-MM-DD'));
        } else if (match[0].includes('/')) {
          let year, month, day;
          if (match[4]) { // 格式: D/M/YYYY (香港格式: 日/月/年)
            day = parseInt(match[1]);
            month = parseInt(match[2]) - 1;
            year = parseInt(match[3]);
            console.log('📅 香港格式 D/M/YYYY:', { day, month: month + 1, year });
          } else if (match[3]) { // 格式: YYYY/M/D
            year = parseInt(match[1]);
            month = parseInt(match[2]) - 1;
            day = parseInt(match[3]);
            console.log('📅 ISO格式 YYYY/M/D:', { year, month: month + 1, day });
          } else { // 格式: D/M (香港格式: 日/月，使用當前年份)
            day = parseInt(match[1]);
            month = parseInt(match[2]) - 1;
            year = baseMoment.year();
            console.log('📅 香港格式 D/M:', { day, month: month + 1, year });
          }
          baseMoment = baseMoment.year(year).month(month).date(day);
          console.log('📅 解析到日期:', baseMoment.format('YYYY-MM-DD'));
        } else if (match[0].includes('月') && /[一二三四五六七八九十]/.test(match[0])) {
          // 中文數字月份/日子
          const monthCn = match[1];
          const dayCn = match[2];
          const month = chineseNumberToInt(monthCn) - 1;
          const day = chineseNumberToInt(dayCn);
          const year = baseMoment.year();
          console.log('📅 中文日期解析:', { year, month: month + 1, day });
          baseMoment = baseMoment.year(year).month(month).date(day);
          console.log('📅 解析到中文日期:', baseMoment.format('YYYY-MM-DD'));
        }
        
        if (baseMoment.isValid()) {
          break;
        }
      } catch (e) {
        console.log('⚠️ 日期解析失敗:', e.message);
      }
    }
  }
  
  // 2. 解析時間範圍 - 修復版本
  const timeRangePatterns = [
    // 時間範圍：支持"三點至六點"、"下午三點至六點"等
    /([一二三四五六七八九十\d]+)[點時]([一二三四五六七八九十\d]+)?分?[至到]([一二三四五六七八九十\d]+)[點時]([一二三四五六七八九十\d]+)?分?/,
    /(下午|上午|中午|晚上|早上)([一二三四五六七八九十\d]+)[點時]([一二三四五六七八九十\d]+)?分?[至到]([一二三四五六七八九十\d]+)[點時]([一二三四五六七八九十\d]+)?分?/,
    /(下午|上午|中午|晚上|早上)([一二三四五六七八九十\d]+)[點時]([一二三四五六七八九十\d]+)?分?[至到](下午|上午|中午|晚上|早上)?([一二三四五六七八九十\d]+)[點時]([一二三四五六七八九十\d]+)?分?/,
    // 單一時間
    /(下午|上午|中午|晚上|早上)([一二三四五六七八九十\d]+)[點時]([一二三四五六七八九十\d]+)?分?/,
    /([一二三四五六七八九十\d]+)[點時]([一二三四五六七八九十\d]+)?分?/,
    /(\d{1,2}):(\d{2})\s?[\-至到]\s?(\d{1,2}):(\d{2})/,
  ];
  
  for (const pattern of timeRangePatterns) {
    const match = text.match(pattern);
    if (match) {
      try {
        console.log('🔍 時間匹配結果:', match);
        
        let startHour = 0;
        let startMinute = 0;
        let endHour = 0;
        let endMinute = 0;
        let startPeriod = '';
        let endPeriod = '';
        
        if (match[0].includes('至') || match[0].includes('到')) {
          // 時間範圍處理
          if (match[1] && (match[1].includes('午') || match[1].includes('晚') || match[1].includes('早'))) {
            // 有時段的格式：下午三點至六點
            startPeriod = match[1];
            startHour = chineseNumberToInt(match[2]);
            startMinute = match[3] ? chineseNumberToInt(match[3]) : 0;
            
            if (match[4] && (match[4].includes('午') || match[4].includes('晚') || match[4].includes('早'))) {
              // 明確指定結束時段：下午三點至晚上六點
              endPeriod = match[4];
              endHour = chineseNumberToInt(match[5]);
              endMinute = match[6] ? chineseNumberToInt(match[6]) : 0;
            } else {
              // 只有開始時段：下午三點至六點
              endPeriod = startPeriod;
              endHour = chineseNumberToInt(match[4]);
              endMinute = match[5] ? chineseNumberToInt(match[5]) : 0;
            }
          } else {
            // 沒有時段的格式：三點至六點
            startHour = chineseNumberToInt(match[1]);
            startMinute = match[2] ? chineseNumberToInt(match[2]) : 0;
            endHour = chineseNumberToInt(match[3]);
            endMinute = match[4] ? chineseNumberToInt(match[4]) : 0;
            
                         // 智能推斷時段 - 優先考慮下午時間
             if (startHour >= 1 && startHour <= 6 && endHour >= 3 && endHour <= 11) {
               // 1-6點且結束時間在3-11點之間，可能是下午時間
               startPeriod = '下午';
               endPeriod = '下午';
             } else if (startHour <= 6) {
               startPeriod = '早上';
               endPeriod = '早上';
             } else if (startHour <= 11) {
               startPeriod = '上午';
               endPeriod = '上午';
             } else if (startHour <= 13) {
               startPeriod = '中午';
               endPeriod = '下午';
             } else if (startHour <= 18) {
               startPeriod = '下午';
               endPeriod = '下午';
             } else {
               startPeriod = '晚上';
               endPeriod = '晚上';
             }
          }
          
          console.log('📋 時間範圍解析:', { 
            startPeriod, 
            startHour, 
            startMinute,
            endPeriod,
            endHour, 
            endMinute
          });
          
        } else {
          // 單一時間
          if (match[1] && (match[1].includes('午') || match[1].includes('晚') || match[1].includes('早'))) {
            startPeriod = match[1];
            startHour = chineseNumberToInt(match[2]);
            startMinute = match[3] ? chineseNumberToInt(match[3]) : 0;
          } else {
            startHour = chineseNumberToInt(match[1]);
            startMinute = match[2] ? chineseNumberToInt(match[2]) : 0;
            
                         // 智能推斷時段 - 優先考慮下午時間
             if (startHour >= 1 && startHour <= 6) {
               // 1-6點，優先考慮下午
               startPeriod = '下午';
             } else if (startHour <= 11) {
               startPeriod = '上午';
             } else if (startHour <= 13) {
               startPeriod = '中午';
             } else if (startHour <= 18) {
               startPeriod = '下午';
             } else {
               startPeriod = '晚上';
             }
          }
          
          // 默認2小時
          endHour = startHour + 2;
          endMinute = startMinute;
          endPeriod = startPeriod;
        }
        
        // 時段轉換為24小時制
        if (startPeriod && (startPeriod.includes('下午') || startPeriod.includes('晚上')) && startHour < 12) {
          startHour += 12;
        }
        if (endPeriod && (endPeriod.includes('下午') || endPeriod.includes('晚上')) && endHour < 12) {
          endHour += 12;
        }
        
        // 處理跨日情況
        if (endHour < startHour) {
          endHour += 24;  // 第二天
        }
        
        console.log('🕐 最終24小時制時間:', { startHour, startMinute, endHour, endMinute });
        
        // 創建時間對象 (香港時區)
        const startMoment = baseMoment.clone().hour(startHour).minute(startMinute).second(0);
        let endMoment = baseMoment.clone().hour(endHour % 24).minute(endMinute).second(0);
        
        // 如果結束時間跨日，則加一天
        if (endHour >= 24) {
          endMoment = endMoment.add(1, 'day');
        }
        
        // 使用簡單的本地時間格式
        startTime = startMoment.format('YYYY-MM-DDTHH:mm:ss');
        endTime = endMoment.format('YYYY-MM-DDTHH:mm:ss');
        
        console.log('⏰ 解析到時間範圍:', {
          start: startMoment.format('YYYY-MM-DD HH:mm'),
          end: endMoment.format('YYYY-MM-DD HH:mm'),
          startTime: startTime,
          endTime: endTime
        });
        
        // --------------- 數字時間格式 HH:MM - HH:MM ---------------
        if (pattern.source.includes('\\d{1,2}:')) {
          const sHour = parseInt(match[1]);
          const sMin  = parseInt(match[2]);
          const eHour = parseInt(match[3]);
          const eMin  = parseInt(match[4]);

          let adjustedEndHour = eHour;
          if (eHour < sHour || (eHour === sHour && eMin <= sMin)) {
            adjustedEndHour += 24; // 跨日
          }

          const startMoment = baseMoment.clone().hour(sHour).minute(sMin).second(0);
          let endMoment = baseMoment.clone().hour(adjustedEndHour % 24).minute(eMin).second(0);
          if (adjustedEndHour >= 24) endMoment = endMoment.add(1, 'day');

          startTime = startMoment.format('YYYY-MM-DDTHH:mm:ss');
          endTime   = endMoment.format('YYYY-MM-DDTHH:mm:ss');

          console.log('🕐 數字時間範圍解析:', { startTime, endTime });
          break;
        }
        
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

// 中文數字轉換 - 增強版
const chineseNumberToInt = (str) => {
  if (!str) return 0;
  
  const chineseToNumber = {
    '一': 1, '二': 2, '三': 3, '四': 4, '五': 5,
    '六': 6, '七': 7, '八': 8, '九': 9, '十': 10,
    '十一': 11, '十二': 12, '十三': 13, '十四': 14, '十五': 15,
    '十六': 16, '十七': 17, '十八': 18, '十九': 19, '二十': 20,
    '二十一': 21, '二十二': 22, '二十三': 23, '二十四': 24,
    '二十五': 25, '二十六': 26, '二十七': 27, '二十八': 28, '二十九': 29,
    '三十': 30, '三十一': 31
  };
  
  // 直接轉換
  if (chineseToNumber[str]) {
    console.log(`🔢 中文數字轉換: ${str} → ${chineseToNumber[str]}`);
    return chineseToNumber[str];
  }
  
  // 嘗試解析阿拉伯數字
  const num = parseInt(str);
  if (!isNaN(num)) {
    console.log(`🔢 阿拉伯數字: ${str} → ${num}`);
    return num;
  }
  
  console.log(`⚠️ 無法轉換數字: ${str}`);
  return 0;
};

// 增強的後備處理邏輯
const enhancedFallbackProcessing = async (text) => {
  console.log('🔧 使用增強後備處理邏輯');
  
  const venue = extractVenueFromText(text);
  const baseMoment = getHongKongNow();
  const timeResult = extractTimeFromText(text, baseMoment);
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
    
    // 檢查是否為重複預訂
    const recurringInfo = extractRecurringInfo(text);
    console.log('🔄 重複預訂檢查:', recurringInfo);
    
    // 使用增強的AI處理
    const parsed = await processNaturalLanguageWithAI(text);
    
    // 如果檢測到重複預訂，添加重複信息
    if (recurringInfo.isRecurring) {
      parsed.recurring = recurringInfo;
    }
    
    console.log('🎯 AI處理完成:', {
      venue: parsed.venue?.name || 'none',
      confidence: parsed.confidence,
      aiProvider: parsed.aiProvider || 'unknown',
      hasTime: !!parsed.startTime,
      isRecurring: recurringInfo.isRecurring
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
      
      // 格式化時間顯示 - 正確處理本地時間
      let startMoment, endMoment;
      
      // 檢查時間字符串是否包含時區信息
      if (parsed.startTime.includes('Z') || parsed.startTime.includes('+') || parsed.startTime.includes('T') && parsed.startTime.length > 19) {
        // 包含時區信息，需要轉換為香港時區
        startMoment = moment(parsed.startTime).tz('Asia/Hong_Kong');
        endMoment = moment(parsed.endTime).tz('Asia/Hong_Kong');
      } else {
        // 不包含時區信息，直接作為本地時間處理
        startMoment = moment(parsed.startTime, 'YYYY-MM-DDTHH:mm:ss');
        endMoment = moment(parsed.endTime, 'YYYY-MM-DDTHH:mm:ss');
      }
      
      // 如果是重複預訂，生成多個建議
      if (recurringInfo.isRecurring) {
        const recurringDates = generateRecurringDates(
          parsed.startTime, 
          parsed.endTime, 
          recurringInfo, 
          8 // 生成8週的重複預訂
        );
        
        recurringDates.forEach((dateInfo, index) => {
          const recStartMoment = moment(dateInfo.startTime).tz('Asia/Hong_Kong');
          const recEndMoment = moment(dateInfo.endTime).tz('Asia/Hong_Kong');
          
          const suggestion = {
            venue: parsed.venue,
            startTime: dateInfo.startTime,
            endTime: dateInfo.endTime,
            purpose: parsed.purpose,
            formattedTime: `${recStartMoment.format('YYYY年MM月DD日 HH:mm')} - ${recEndMoment.format('HH:mm')}`,
            formattedDate: recStartMoment.format('YYYY-MM-DD'),
            formattedStartTime: recStartMoment.format('HH:mm'),
            formattedEndTime: recEndMoment.format('HH:mm'),
            duration: recEndMoment.diff(recStartMoment, 'hours', true),
            recurring: recurringInfo,
            occurrence: dateInfo.occurrence
          };
          
          response.suggestions.push(suggestion);
        });
        
        console.log(`✅ 生成了 ${recurringDates.length} 個重複預訂建議`);
      } else {
        // 單次預訂
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
        console.log('✅ 預訂建議生成成功:', suggestion);
      }
      
      // 檢查時間衝突
      const existingBookings = readBookings();
      let hasConflict = false;
      
      // 檢查每個建議是否有衝突
      for (const suggestion of response.suggestions) {
        const conflict = hasTimeConflict({
          venueId: parsed.venue.id,
          startTime: suggestion.startTime,
          endTime: suggestion.endTime
        }, existingBookings);
        
        if (conflict) {
          hasConflict = true;
          break;
        }
      }
      
      if (hasConflict) {
        response.warning = '某些時段可能已被預訂，請確認是否繼續';
        response.hasConflict = true;
      }
      
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
    
    // 檢查是否為重複預訂
    const recurringInfo = extractRecurringInfo(text);
    
    const parsed = await processNaturalLanguageWithAI(text);
    
    if (!parsed.venue || !parsed.startTime || parsed.confidence <= 0.5) {
      return res.status(400).json({ 
        error: '無法理解您的預訂需求',
        parsed: parsed
      });
    }
    
    console.log('準備創建預訂:', {
      venueId: parsed.venue.id,
      venueName: parsed.venue.name,
      startTime: parsed.startTime,
      endTime: parsed.endTime,
      purpose: parsed.purpose,
      contactInfo: contactInfo,
      isRecurring: recurringInfo.isRecurring
    });
    
    // 如果是重複預訂，創建多個預訂
    if (recurringInfo.isRecurring) {
      const recurringDates = generateRecurringDates(
        parsed.startTime, 
        parsed.endTime, 
        recurringInfo, 
        8 // 生成8週的重複預訂
      );
      
      const bookings = [];
      const conflictDates = [];
      const existingBookings = readBookings();
      
      // 為每個日期創建預訂
      for (const dateInfo of recurringDates) {
        // 檢查時間衝突
        const hasConflict = hasTimeConflict({
          venueId: parsed.venue.id,
          startTime: dateInfo.startTime,
          endTime: dateInfo.endTime
        }, existingBookings);
        
        if (hasConflict) {
          conflictDates.push(moment(dateInfo.startTime).format('YYYY-MM-DD HH:mm'));
          continue;
        }
        
        const booking = {
          id: uuidv4(),
          venueId: parsed.venue.id,
          venueName: parsed.venue.name,
          startTime: dateInfo.startTime,
          endTime: dateInfo.endTime,
          purpose: parsed.purpose,
          contactInfo: contactInfo,
          status: 'confirmed',
          createdAt: new Date().toISOString(),
          recurring: true,
          recurringType: recurringInfo.type,
          recurringPattern: recurringInfo.pattern,
          occurrence: dateInfo.occurrence
        };
        
        bookings.push(booking);
      }
      
      // 保存所有預訂
      if (bookings.length > 0) {
        // 使用storage模塊逐個添加預訂
        for (const booking of bookings) {
          addSingleBooking(booking);
        }
        
        console.log(`✅ 成功創建 ${bookings.length} 個重複預訂`);
        
        let message = `成功創建 ${bookings.length} 個重複預訂`;
        if (conflictDates.length > 0) {
          message += `，${conflictDates.length} 個時段因衝突未創建`;
        }
        
        res.json({
          success: true,
          message: message,
          bookings: bookings.map(b => ({
            id: b.id,
            formattedTime: moment(b.startTime).format('YYYY年MM月DD日 HH:mm') + 
                          ' - ' + moment(b.endTime).format('HH:mm'),
            venue: b.venueName
          })),
          conflictDates: conflictDates.length > 0 ? conflictDates : undefined
        });
      } else {
        res.status(409).json({
          success: false,
          error: '所有時段都已被預訂',
          conflictDates: conflictDates
        });
      }
      
      return;
    }
    
    // 單次預訂邏輯
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
        // 使用storage模塊保存重複預訂
        for (const booking of successfulBookings) {
          addSingleBooking(booking);
        }
        
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
      
      addSingleBooking(newBooking);
      
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

// 取得香港目前時間（使用本地設備時間，設定為香港時區）
const getHongKongNow = () => {
  console.log('🕐 使用本地設備時間，設定為香港時區');
  return moment.tz('Asia/Hong_Kong');
};

module.exports = router; 