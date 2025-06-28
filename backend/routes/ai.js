const express = require('express');
const axios = require('axios');
const moment = require('moment');
const { findVenueByName, getAllVenues } = require('../config/venues');

const router = express.Router();

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
      process.env.DEEPSEEK_API_URL,
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
  console.log('使用後備處理邏輯');
  
  const result = {
    venue: null,
    startTime: null,
    endTime: null,
    purpose: null,
    confidence: 0
  };
  
  // 提取場地信息
  const venues = getAllVenues();
  for (const venue of venues) {
    if (text.includes(venue.name) || text.includes(venue.name.replace('號室', ''))) {
      result.venue = venue;
      result.confidence += 0.3;
      break;
    }
  }
  
  // 提取時間信息
  let dateBase = moment();
  
  // 簡單的時間解析
  if (text.includes('明天')) {
    dateBase = moment().add(1, 'day');
    result.confidence += 0.2;
  } else if (text.includes('後天')) {
    dateBase = moment().add(2, 'days');
    result.confidence += 0.2;
  } else if (text.includes('下週') || text.includes('下周')) {
    dateBase = moment().add(1, 'week');
    result.confidence += 0.2;
  }
  
  // 提取小時
  const hourMatch = text.match(/(\d{1,2})[點時]/);
  if (hourMatch) {
    let hour = parseInt(hourMatch[1]);
    if (text.includes('下午') && hour < 12) hour += 12;
    if (text.includes('晚上') && hour < 12) hour += 12;
    
    result.startTime = dateBase.hour(hour).minute(0).second(0).toISOString();
    result.confidence += 0.3;
    
    // 默認2小時時長
    result.endTime = moment(result.startTime).add(2, 'hours').toISOString();
  }
  
  // 提取用途
  const purposeKeywords = ['會議', '上課', '活動', '練習', '培訓', '討論'];
  for (const keyword of purposeKeywords) {
    if (text.includes(keyword)) {
      result.purpose = keyword;
      result.confidence += 0.2;
      break;
    }
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
    
    // 轉發到預訂API
    const bookingData = {
      venueId: parsed.venue.id,
      startTime: parsed.startTime,
      endTime: parsed.endTime,
      purpose: parsed.purpose,
      contactInfo: contactInfo
    };
    
    // 調用預訂API
    const bookingResponse = await axios.post(
      `http://localhost:${process.env.PORT || 5000}/api/bookings`,
      bookingData
    );
    
    res.json({
      success: true,
      message: '預訂成功創建',
      booking: bookingResponse.data,
      aiAnalysis: parsed,
      aiProvider: 'DeepSeek'
    });
    
  } catch (error) {
    if (error.response && error.response.status === 409) {
      res.status(409).json({
        error: '該時段已被預訂',
        conflict: true
      });
    } else {
      console.error('AI預訂處理失敗:', error);
      res.status(500).json({ error: 'AI預訂處理失敗' });
    }
  }
});

// GET /api/ai/status - 檢查AI服務狀態
router.get('/status', async (req, res) => {
  try {
    // 測試DeepSeek API連接
    const testResponse = await axios.post(
      process.env.DEEPSEEK_API_URL,
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
    res.json({
      status: 'degraded',
      provider: 'DeepSeek (Fallback)',
      apiConnected: false,
      error: error.message,
      fallbackAvailable: true
    });
  }
});

module.exports = router; 