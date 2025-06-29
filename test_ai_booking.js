const axios = require('axios');

// 測試AI預訂邏輯
async function testAIBooking() {
  const baseURL = 'http://localhost:3001'; // 假設後端運行在3001端口
  
  console.log('🧪 開始測試AI預訂邏輯...\n');
  
  const testCases = [
    {
      name: '基本預訂測試',
      text: '我想明天下午2點到4點預訂音樂室，用途是練習，聯絡人張三',
      contactInfo: '張三 - 12345678'
    },
    {
      name: '具體日期預訂測試',
      text: '我想2025年1月15日下午3點到5點預訂101號室，用途是開會，聯絡人李四',
      contactInfo: '李四 - 87654321'
    },
    {
      name: '重複預訂測試',
      text: '我想每週一下午2點到4點預訂禮堂，用途是活動，聯絡人王五',
      contactInfo: '王五 - 11223344'
    }
  ];
  
  for (const testCase of testCases) {
    console.log(`📋 測試案例: ${testCase.name}`);
    console.log(`📝 輸入文本: ${testCase.text}`);
    console.log(`📞 聯絡信息: ${testCase.contactInfo}`);
    
    try {
      // 步驟1: AI解析
      console.log('\n🔍 步驟1: AI解析...');
      const parseResponse = await axios.post(`${baseURL}/api/ai`, {
        text: testCase.text
      });
      
      console.log('✅ AI解析成功:', {
        success: parseResponse.data.success,
        canProceed: parseResponse.data.canProceed,
        suggestions: parseResponse.data.suggestions?.length || 0,
        confidence: parseResponse.data.parsed?.confidence
      });
      
      if (parseResponse.data.canProceed && parseResponse.data.suggestions?.length > 0) {
        // 步驟2: 創建預訂
        console.log('\n📅 步驟2: 創建預訂...');
        const bookingResponse = await axios.post(`${baseURL}/api/ai/book`, {
          text: testCase.text,
          contactInfo: testCase.contactInfo
        });
        
        console.log('✅ 預訂創建成功:', {
          success: bookingResponse.data.success,
          message: bookingResponse.data.message,
          bookingId: bookingResponse.data.booking?.id
        });
        
        if (bookingResponse.data.recurringBookings) {
          console.log(`🔄 重複預訂數量: ${bookingResponse.data.recurringBookings.length}`);
        }
        
        if (bookingResponse.data.conflicts) {
          console.log(`⚠️ 衝突數量: ${bookingResponse.data.conflicts.length}`);
        }
      } else {
        console.log('❌ AI解析失敗或無法繼續:', parseResponse.data.error || '未知錯誤');
      }
      
    } catch (error) {
      console.error('❌ 測試失敗:', {
        status: error.response?.status,
        error: error.response?.data?.error || error.message
      });
    }
    
    console.log('\n' + '='.repeat(60) + '\n');
  }
  
  // 測試獲取所有預訂
  try {
    console.log('📋 獲取所有預訂...');
    const bookingsResponse = await axios.get(`${baseURL}/api/bookings`);
    console.log('✅ 預訂列表:', {
      success: bookingsResponse.data.success,
      count: bookingsResponse.data.count,
      storageInfo: bookingsResponse.data.storageInfo
    });
  } catch (error) {
    console.error('❌ 獲取預訂失敗:', error.response?.data?.error || error.message);
  }
}

// 運行測試
if (require.main === module) {
  testAIBooking().catch(console.error);
}

module.exports = { testAIBooking }; 