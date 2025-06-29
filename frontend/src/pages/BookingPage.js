import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Bot, User, Calendar, MapPin, Clock, CheckCircle, AlertCircle, Zap, Plus, Minus } from 'lucide-react';
import api from '../api';
import moment from 'moment';

const BookingPage = () => {
  const [messages, setMessages] = useState([
    {
      id: 1,
      type: 'ai',
      content: '您好！我是AI預訂助手，由DeepSeek提供支持。請填寫下方的表單來預訂場地。',
      timestamp: new Date()
    }
  ]);
  
  // 表單狀態
  const [venueInput, setVenueInput] = useState('');
  const [dateInput, setDateInput] = useState('');
  const [timeInput, setTimeInput] = useState('');
  const [purposeInput, setPurposeInput] = useState('');
  const [contactInfo, setContactInfo] = useState('');
  
  // 多個預訂功能
  const [multiBookingEnabled, setMultiBookingEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [pendingBooking, setPendingBooking] = useState(null);
  const [aiStatus, setAiStatus] = useState('unknown');
  const [aiStatusRetry, setAiStatusRetry] = useState(0);
  const messagesEndRef = useRef(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 取得用戶本地時間與時區
  function getUserTimeInfo() {
    const now = new Date();
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return {
      localTime: now.toISOString(),
      timezone,
    };
  }

  // 使用useCallback優化checkAiStatus函數
  const checkAiStatus = useCallback(async () => {
    try {
      await api.get('/ai/status', { timeout: 5000 });
      setAiStatus('ok');
      setAiStatusRetry(0);
    } catch (err) {
      if (aiStatusRetry < 2) {
        setAiStatus('unknown');
        setAiStatusRetry(aiStatusRetry + 1);
        setTimeout(checkAiStatus, 1000);
      } else {
        setAiStatus('offline');
      }
    }
  }, [aiStatusRetry]);

  useEffect(() => {
    checkAiStatus();
  }, [checkAiStatus]);

  const addMessage = (type, content, extra = {}) => {
    const newMessage = {
      id: Date.now(),
      type,
      content,
      timestamp: new Date(),
      ...extra
    };
    setMessages(prev => [...prev, newMessage]);
  };

  const handleSubmitBooking = async () => {
    // 驗證表單
    if (!venueInput.trim()) {
      addMessage('ai', '❌ 請填寫場地名稱', { showError: true });
      return;
    }
    if (!dateInput.trim()) {
      addMessage('ai', '❌ 請填寫日期', { showError: true });
      return;
    }
    if (!timeInput.trim()) {
      addMessage('ai', '❌ 請填寫時間', { showError: true });
      return;
    }
    if (!purposeInput.trim()) {
      addMessage('ai', '❌ 請填寫用途', { showError: true });
      return;
    }
    if (!contactInfo.trim()) {
      addMessage('ai', '❌ 請填寫聯絡信息', { showError: true });
      return;
    }

    setIsLoading(true);

    // 組合用戶輸入為自然語言
    let naturalLanguageText = '';
    if (multiBookingEnabled) {
      naturalLanguageText = `我想${dateInput}在${venueInput}${timeInput}，用途是${purposeInput}，聯絡人${contactInfo}`;
    } else {
      naturalLanguageText = `我想${dateInput}${timeInput}預訂${venueInput}，用途是${purposeInput}，聯絡人${contactInfo}`;
    }

    // 自動發送給AI助手
    addMessage('user', `預訂申請：\n📍 場地：${venueInput}\n📅 日期：${dateInput}\n🕒 時間：${timeInput}\n📝 用途：${purposeInput}\n📞 聯絡：${contactInfo}${multiBookingEnabled ? '\n🔄 多個預訂模式已啟用' : ''}`);
    addMessage('user', naturalLanguageText);

    try {
      const userTimeInfo = getUserTimeInfo();
      const payload = {
        venue: venueInput,
        date: dateInput,
        time: timeInput,
        purpose: purposeInput,
        contactInfo,
        multiBookingEnabled,
        ...userTimeInfo,
        naturalLanguageText // 新增：發送描述文本
      };
      // 調用AI解析API
      const response = await api.post('/api/ai', payload);
      const { success, canProceed, suggestions, error, help, parsed } = response.data;
      if (success && canProceed && suggestions.length > 0) {
        const aiProvider = parsed?.aiProvider || 'AI';
        const isRecurring = suggestions.some(s => s.recurring && s.recurring.isRecurring);
        if (isRecurring || multiBookingEnabled) {
          addMessage('ai', `✅ AI已分析您的多個預訂需求！（由${aiProvider}提供支持）\n檢測到 ${suggestions.length} 個預訂時段`, {
            suggestions: suggestions,
            showConfirm: true,
            aiProvider: aiProvider,
            isRecurring: true,
            originalText: naturalLanguageText
          });
        } else {
          const suggestion = suggestions[0];
          addMessage('ai', `✅ AI已理解您的預訂需求！（由${aiProvider}提供支持）`, {
            suggestion: suggestion,
            showConfirm: true,
            aiProvider: aiProvider,
            originalText: naturalLanguageText
          });
        }
      } else if (error) {
        const aiProvider = parsed?.aiProvider || 'AI';
        addMessage('ai', error, { 
          help: help, 
          aiProvider: aiProvider,
          showError: true
        });
      } else {
        const aiProvider = parsed?.aiProvider || 'AI';
        addMessage('ai', '抱歉，我無法完全理解您的需求。請檢查輸入信息。', { 
          aiProvider: aiProvider,
          showError: true
        });
      }
    } catch (error) {
      console.error('AI解析錯誤:', error);
      let errorMessage = '抱歉，處理您的請求時遇到問題。';
      if (error.response?.status === 503) {
        errorMessage = '🔧 AI服務暫時不可用，請稍後再試。';
      } else if (error.response?.status === 429) {
        errorMessage = '⏳ 請求過於頻繁，請稍後再試。';
      } else if (error.response?.status >= 500) {
        errorMessage = '🔧 服務器暫時出現問題，請稍後再試。';
      } else if (error.response?.data?.error) {
        errorMessage = `❌ ${error.response.data.error}`;
      }
      addMessage('ai', errorMessage, { showError: true });
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmBooking = (suggestion, isRecurring = false, suggestions = [], originalText) => {
    console.log('🎯 確認預訂:', { suggestion, isRecurring, suggestions });
    
    setPendingBooking({ 
      suggestion, 
      isRecurring, 
      suggestions: isRecurring ? suggestions : [suggestion],
      originalText: originalText
    });
    setShowConfirmDialog(true);
  };

  const handleFinalBooking = async () => {
    if (!pendingBooking) return;
    
    setIsLoading(true);
    
    try {
      console.log('📤 發送預訂請求:', {
        text: pendingBooking.originalText,
        contactInfo: contactInfo,
        isRecurring: pendingBooking.isRecurring
      });
       
      const response = await api.post('/api/ai/book', {
        text: pendingBooking.originalText,
        contactInfo: contactInfo
      });
      
      console.log('📥 預訂響應:', response.data);
      
      if (response.data.success) {
        const processedBooking = {
          ...response.data.booking,
          startTime: response.data.booking.startTime,
          endTime: response.data.booking.endTime
        };
        
        addMessage('ai', '', {
          booking: processedBooking,
          recurringBookings: response.data.recurringBookings,
          conflicts: response.data.conflicts,
          showSuccess: true
        });
        
        // 清空表單
        setVenueInput('');
        setDateInput('');
        setTimeInput('');
        setPurposeInput('');
        setContactInfo('');
        setMultiBookingEnabled(false);
        
      } else {
        addMessage('ai', '預訂失敗：' + response.data.error, { showError: true });
      }
      
    } catch (error) {
      console.error('❌ 預訂失敗:', error);
      
      if (error.response?.data?.conflict) {
        const conflictMessage = `預訂失敗：該時段已被預訂

💡 建議：
• 嘗試其他時間段
• 查看時間表了解可用時段
• 或選擇其他場地`;
        
        addMessage('ai', conflictMessage, { 
          showError: true,
          errorType: 'conflict',
          suggestion: '您可以修改時間或場地後重新提交'
        });
      } else {
        const errorMessage = error.response?.data?.error || '預訂時發生錯誤，請稍後再試';
        addMessage('ai', `預訂失敗

${errorMessage}`, { showError: true });
      }
    } finally {
      setIsLoading(false);
      setShowConfirmDialog(false);
      setPendingBooking(null);
    }
  };

  const MessageBubble = ({ message }) => {
    const isUser = message.type === 'user';
    
    return (
      <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
        <div className={`flex items-start space-x-2 max-w-3xl ${isUser ? 'flex-row-reverse space-x-reverse' : ''}`}>
          <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
            isUser ? 'bg-primary-600' : 'bg-gradient-to-r from-blue-600 to-purple-600'
          }`}>
            {isUser ? <User className="w-4 h-4 text-white" /> : <Bot className="w-4 h-4 text-white" />}
          </div>
          
          <div className={`rounded-2xl px-4 py-3 ${
            isUser 
              ? 'bg-primary-600 text-white' 
              : 'bg-white text-gray-800 shadow-md border'
          }`}>
            <p className="whitespace-pre-wrap">{message.content}</p>
            
            {message.aiProvider && !isUser && (
              <div className="flex items-center space-x-1 mt-2 text-xs text-gray-500">
                <Zap className="w-3 h-3" />
                <span>Powered by {message.aiProvider}</span>
              </div>
            )}
            
            {/* AI建議卡片 */}
            {message.suggestion && (
              <div className="mt-3 p-4 bg-gray-50 rounded-lg border">
                <div className="flex items-center space-x-2 mb-2">
                  <MapPin className="w-4 h-4 text-primary-600" />
                  <span className="font-medium">{message.suggestion.venue.name}</span>
                </div>
                <div className="flex items-center space-x-2 mb-2">
                  <Clock className="w-4 h-4 text-primary-600" />
                  <span>{message.suggestion.formattedTime}</span>
                </div>
                <div className="flex items-center space-x-2 mb-3">
                  <Calendar className="w-4 h-4 text-primary-600" />
                  <span>{message.suggestion.purpose}</span>
                </div>
                {message.showConfirm && (
                  <button
                    onClick={() => handleConfirmBooking(message.suggestion, false, [], message.originalText)}
                    className="bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700 transition-colors"
                  >
                    確認預訂
                  </button>
                )}
              </div>
            )}
            
            {/* 重複預訂建議卡片 */}
            {message.suggestions && message.isRecurring && (
              <div className="mt-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-center space-x-2 mb-2">
                  <Calendar className="w-4 h-4 text-blue-600" />
                  <span className="font-medium text-blue-800">多個預訂詳情</span>
                </div>
                <div className="space-y-2 mb-3">
                  <div className="text-sm">
                    <strong>場地:</strong> {message.suggestions[0].venue.name}
                  </div>
                  <div className="text-sm">
                    <strong>用途:</strong> {message.suggestions[0].purpose}
                  </div>
                  <div className="text-sm">
                    <strong>預訂時段:</strong>
                  </div>
                  <div className="max-h-32 overflow-y-auto text-xs bg-white rounded p-2">
                    {message.suggestions.slice(0, 5).map((suggestion, index) => (
                      <div key={index} className="py-1">
                        第{suggestion.occurrence || index + 1}次: {suggestion.formattedTime}
                      </div>
                    ))}
                    {message.suggestions.length > 5 && (
                      <div className="text-gray-500 mt-1">
                        ...還有 {message.suggestions.length - 5} 個預訂
                      </div>
                    )}
                  </div>
                </div>
                {message.showConfirm && (
                  <button
                    onClick={() => handleConfirmBooking(message.suggestions[0], true, message.suggestions, message.originalText)}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 transition-colors"
                  >
                    確認多個預訂
                  </button>
                )}
              </div>
            )}
            
            {/* 成功預訂卡片 */}
            {message.booking && message.showSuccess && (
              <div className="mt-3 p-4 bg-green-50 rounded-lg border border-green-200">
                <div className="flex items-center space-x-2 mb-2">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <span className="font-medium text-green-800">預訂確認</span>
                </div>
                <div className="text-sm text-green-700 space-y-1">
                  <p><strong>預訂編號:</strong> {message.booking.id}</p>
                  <p><strong>場地:</strong> {message.booking.venueName}</p>
                  <p><strong>時間:</strong> {
                    (() => {
                      let startMoment, endMoment;
                      
                      if (message.booking.startTime.includes('T')) {
                        startMoment = moment(message.booking.startTime);
                        endMoment = moment(message.booking.endTime);
                      } else {
                        startMoment = moment(message.booking.startTime, 'YYYY-MM-DD HH:mm:ss');
                        endMoment = moment(message.booking.endTime, 'YYYY-MM-DD HH:mm:ss');
                      }
                      
                      return `${startMoment.format('YYYY-MM-DD HH:mm')} - ${endMoment.format('HH:mm')}`;
                    })()
                  }</p>
                  <p><strong>用途:</strong> {message.booking.purpose}</p>
                </div>
                
                {/* 重複預訂信息 */}
                {message.recurringBookings && message.recurringBookings.length > 1 && (
                  <div className="mt-3 p-3 bg-blue-50 rounded border border-blue-200">
                    <div className="flex items-center space-x-2 mb-2">
                      <Calendar className="w-4 h-4 text-blue-600" />
                      <span className="font-medium text-blue-800">多個預訂已創建</span>
                    </div>
                    <p className="text-sm text-blue-700 mb-2">
                      成功創建 {message.recurringBookings.length} 個預訂
                    </p>
                  </div>
                )}
              </div>
            )}
            
            {/* 錯誤信息 */}
            {message.showError && (
              <div className="mt-3 p-4 bg-red-50 rounded-lg border border-red-200">
                <div className="flex items-center space-x-2 mb-2">
                  <AlertCircle className="w-5 h-5 text-red-600" />
                  <span className="font-medium text-red-800">
                    {message.errorType === 'conflict' ? '時間衝突' : '處理失敗'}
                  </span>
                </div>
                {message.suggestion && (
                  <div className="mt-2 p-3 bg-blue-50 rounded border border-blue-200">
                    <p className="text-sm text-blue-700 font-medium">💡 建議：</p>
                    <p className="text-sm text-blue-600 mt-1">{message.suggestion}</p>
                  </div>
                )}
              </div>
            )}
            
            <div className="text-xs text-gray-500 mt-2">
              {moment(message.timestamp).format('HH:mm')}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 左側：表單輸入區域 */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center space-x-3 mb-6">
              <Bot className="w-8 h-8 text-primary-600" />
              <div>
                <h2 className="text-xl font-bold text-gray-900">場地預訂表單</h2>
                <p className="text-sm text-gray-600">請填寫以下信息</p>
              </div>
            </div>

            <div className="space-y-4">
              {/* 場地輸入 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  📍 場地名稱
                </label>
                <input
                  type="text"
                  value={venueInput}
                  onChange={(e) => setVenueInput(e.target.value)}
                  placeholder="例如：音樂室、101號室、禮堂"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              {/* 日期輸入 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  📅 日期
                  {multiBookingEnabled && (
                    <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                      多個預訂模式
                    </span>
                  )}
                </label>
                <input
                  type="text"
                  value={dateInput}
                  onChange={(e) => setDateInput(e.target.value)}
                  placeholder={multiBookingEnabled ? 
                    "例如：逢星期一、每週二、隔天" : 
                    "例如：明天、2025年7月1日、下星期三"
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                
                {/* 多個預訂開關 */}
                <div className="flex items-center justify-between mt-2">
                  <button
                    type="button"
                    onClick={() => setMultiBookingEnabled(!multiBookingEnabled)}
                    className={`flex items-center space-x-2 px-3 py-1 rounded-lg text-sm transition-colors ${
                      multiBookingEnabled 
                        ? 'bg-blue-100 text-blue-800' 
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {multiBookingEnabled ? <Minus className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                    <span>多個預訂</span>
                  </button>
                  {multiBookingEnabled && (
                    <span className="text-xs text-blue-600">AI將分析重複模式</span>
                  )}
                </div>
              </div>

              {/* 時間輸入 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  🕐 時間
                </label>
                <input
                  type="text"
                  value={timeInput}
                  onChange={(e) => setTimeInput(e.target.value)}
                  placeholder="例如：下午2點到4點、上午10點、晚上7點至9點"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              {/* 用途輸入 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  📝 用途
                </label>
                <input
                  type="text"
                  value={purposeInput}
                  onChange={(e) => setPurposeInput(e.target.value)}
                  placeholder="例如：會議、上課、練習、活動"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              {/* 聯絡信息 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  📞 聯絡信息
                </label>
                <input
                  type="text"
                  value={contactInfo}
                  onChange={(e) => setContactInfo(e.target.value)}
                  placeholder="例如：張三 - 12345678"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              {/* 提交按鈕 */}
              <button
                onClick={handleSubmitBooking}
                disabled={isLoading}
                className="w-full bg-primary-600 text-white py-3 px-4 rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>處理中...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>提交預訂申請</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* 右側：對話區域 */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-primary-600 to-purple-600 text-white p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Bot className="w-8 h-8" />
                  <div>
                    <h1 className="text-2xl font-bold">AI場地預訂助手</h1>
                    <p className="text-primary-100">智能分析您的預訂需求</p>
                  </div>
                </div>
                
                {/* AI狀態指示器 */}
                {aiStatus === 'ok' && (
                  <div className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm bg-green-50 text-green-700 border border-green-200`}>
                    <div className={`w-2 h-2 rounded-full bg-green-500`}></div>
                    <span>AI服務正常</span>
                  </div>
                )}
                {aiStatus === 'unknown' && (
                  <div className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm bg-yellow-50 text-yellow-700 border border-yellow-200`}>
                    <div className={`w-2 h-2 rounded-full bg-yellow-500`}></div>
                    <span>AI服務未知</span>
                  </div>
                )}
                {aiStatus === 'offline' && (
                  <div className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm bg-red-50 text-red-700 border border-red-200`}>
                    <div className={`w-2 h-2 rounded-full bg-red-500`}></div>
                    <span>AI服務離線</span>
                  </div>
                )}
              </div>
            </div>

            {/* Messages */}
            <div className="h-96 overflow-y-auto p-6 custom-scrollbar">
              {messages.map((message) => (
                <MessageBubble key={message.id} message={message} />
              ))}
              
              {isLoading && (
                <div className="flex justify-start mb-4">
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full flex items-center justify-center">
                      <Bot className="w-4 h-4 text-white" />
                    </div>
                    <div className="bg-white rounded-2xl px-4 py-3 shadow-md border">
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>
          </div>
        </div>
      </div>

      {/* 確認預訂對話框 */}
      {showConfirmDialog && pendingBooking && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">確認預訂信息</h3>
            
            {/* 預訂詳情 */}
            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <div className="space-y-2 text-sm">
                <div><strong>場地:</strong> {pendingBooking.suggestion.venue.name}</div>
                <div><strong>時間:</strong> {pendingBooking.suggestion.formattedTime}</div>
                <div><strong>用途:</strong> {pendingBooking.suggestion.purpose}</div>
                {pendingBooking.isRecurring && (
                  <div><strong>預訂數量:</strong> {pendingBooking.suggestions.length} 個</div>
                )}
              </div>
            </div>
            
            <div className="flex space-x-3">
              <button
                onClick={() => setShowConfirmDialog(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={handleFinalBooking}
                disabled={isLoading}
                className="flex-1 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 disabled:opacity-50"
              >
                {isLoading ? '處理中...' : '確認預訂'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BookingPage; 