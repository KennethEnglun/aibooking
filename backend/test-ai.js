const { findVenueByName, getAllVenues } = require('./config/venues');

// 測試增強的場地匹配功能
console.log('🔧 測試增強的AI理解功能\n');

// 測試1: 場地匹配
console.log('📍 測試場地匹配:');
const testVenues = ['音樂室', '音樂', '電腦室', '101', '禮堂', '操場'];
for (const venue of testVenues) {
  const result = findVenueByName(venue);
  console.log(`  "${venue}" → ${result ? result.name : '未找到'}`);
}

// 測試2: 從文本中提取場地
console.log('\n🎯 測試文本場地提取:');

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

const testTexts = [
  '我想預訂音樂室，2025年6月30日下午四點至六點，用作練習',
  '明天下午借101號室開會',
  '需要使用電腦進行培訓',
  '想在禮堂舉辦活動'
];

for (const text of testTexts) {
  console.log(`\n  測試: "${text}"`);
  const venue = extractVenueFromText(text);
  console.log(`  結果: ${venue ? venue.name : '未找到場地'}`);
}

// 測試3: 時間解析
console.log('\n⏰ 測試時間解析:');

const moment = require('moment');

const chineseNumberToInt = (str) => {
  const chineseToNumber = {
    '一': 1, '二': 2, '三': 3, '四': 4, '五': 5,
    '六': 6, '七': 7, '八': 8, '九': 9, '十': 10,
    '十一': 11, '十二': 12
  };
  
  return chineseToNumber[str] || parseInt(str) || 0;
};

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
        
        startTime = dateBase.clone().hour(startHour).minute(startMinute).second(0).toISOString();
        endTime = dateBase.clone().hour(endHour).minute(endMinute).second(0).toISOString();
        
        console.log('⏰ 解析到時間範圍:', {
          start: moment(startTime).format('YYYY-MM-DD HH:mm'),
          end: moment(endTime).format('YYYY-MM-DD HH:mm')
        });
        break;
        
      } catch (e) {
        console.log('⚠️ 時間解析失敗:', e.message);
      }
    }
  }
  
  return { startTime, endTime };
};

const timeTestTexts = [
  '2025年6月30日下午四點至六點',
  '明天上午10點到12點',
  '下週三晚上7點',
  '今天下午2點30分到4點30分'
];

for (const text of timeTestTexts) {
  console.log(`\n  測試: "${text}"`);
  const result = extractTimeFromText(text);
  if (result.startTime) {
    console.log(`  開始: ${moment(result.startTime).format('YYYY-MM-DD HH:mm')}`);
    console.log(`  結束: ${moment(result.endTime).format('YYYY-MM-DD HH:mm')}`);
  } else {
    console.log('  無法解析時間');
  }
}

console.log('\n✅ AI功能測試完成！'); 