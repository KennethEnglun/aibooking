import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Bot, User, Calendar, MapPin, Clock, CheckCircle, AlertCircle, Zap } from 'lucide-react';
import api from '../api';
import moment from 'moment';

const BookingPage = () => {
  const [messages, setMessages] = useState([
    {
      id: 1,
      type: 'ai',
      content: '您好！我是AI預訂助手，由DeepSeek提供支持。請告訴我您想預訂哪個場地，什麼時候使用？',
      timestamp: new Date()
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [contactInfo, setContactInfo] = useState('');
  // const [showContactModal, setShowContactModal] = useState(false); // 暫時未使用
  const [pendingBooking, setPendingBooking] = useState(null);
  const [aiStatus, setAiStatus] = useState({ status: 'checking', message: '檢查中...' });
  const messagesEndRef = useRef(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 使用useCallback優化checkAiStatus函數
  const checkAiStatus = useCallback(async () => {
    console.log('🔍 開始檢查AI狀態...');
    try {
      console.log('📡 發送API請求到:', '/ai/status');
      const response = await api.get('/ai/status');
      console.log('📥 收到API響應:', response.data);
      const data = response.data;
      
      if (data.status === 'connected') {
        console.log('✅ AI狀態：已連接');
        setAiStatus({
          status: 'connected',
          message: `✅ AI服務正常 (${data.provider || 'Unknown'})`,
          provider: data.provider,
          responseTime: data.responseTime
        });
      } else {
        console.log('⚠️ AI狀態：異常', data);
        setAiStatus({
          status: 'error',
          message: `❌ ${data.message || 'AI服務異常'}`,
          error: data.error
        });
      }
    } catch (error) {
      console.error('❌ AI狀態檢查失敗:', error);
      console.error('錯誤詳情:', {
        message: error.message,
        code: error.code,
        response: error.response?.data,
        status: error.response?.status
      });
      const errorMessage = error.response?.data?.message || error.message || '未知錯誤';
      setAiStatus({
        status: 'error',
        message: `❌ 連接失敗: ${errorMessage}`,
        error: errorMessage
      });
    }
  }, []);

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

  const handleSendMessage = async () => {
    if (!inputText.trim() || isLoading) return;

    const userMessage = inputText.trim();
    setInputText('');
    addMessage('user', userMessage);
    setIsLoading(true);

    try {
      // 調用增強的AI解析API
      const response = await api.post('/api/ai', {
        text: userMessage
      });

      const { success, canProceed, suggestions, error, help, parsed } = response.data;

      if (success && canProceed && suggestions.length > 0) {
        const aiProvider = parsed?.aiProvider || 'AI';
        
        // 檢查是否為重複預訂
        const isRecurring = suggestions.some(s => s.recurring && s.recurring.isRecurring);
        
        if (isRecurring) {
          const pattern = suggestions[0].recurring.pattern;
          addMessage('ai', `我理解了您的重複預訂需求！(由${aiProvider}提供支持)\n檢測到：${pattern}，將創建 ${suggestions.length} 個預訂`, {
            suggestions: suggestions,
            showConfirm: true,
            aiProvider: aiProvider,
            isRecurring: true
          });
        } else {
          const suggestion = suggestions[0];
          addMessage('ai', `我理解了您的預訂需求！(由${aiProvider}提供支持)`, {
            suggestion: suggestion,
            showConfirm: true,
            aiProvider: aiProvider
          });
        }
      } else if (error) {
        const aiProvider = parsed?.aiProvider || 'AI';
        addMessage('ai', error, { 
          help: help, 
          aiProvider: aiProvider 
        });
      } else {
        const aiProvider = parsed?.aiProvider || 'AI';
        addMessage('ai', '抱歉，我無法完全理解您的需求。請提供更詳細的信息。', { 
          aiProvider: aiProvider 
        });
      }
    } catch (error) {
      console.error('AI解析錯誤:', error);
      
      let errorMessage = '抱歉，處理您的請求時遇到了問題。';
      let errorType = 'error';
      
      if (error.response?.status === 503) {
        errorMessage = '🔧 AI服務暫時不可用，請稍後再試。';
        errorType = 'service_unavailable';
      } else if (error.response?.status === 429) {
        errorMessage = '⏳ 請求過於頻繁，請稍後再試。';
        errorType = 'rate_limit';
      } else if (error.response?.status >= 500) {
        errorMessage = '🔧 服務器暫時出現問題，請稍後再試。';
        errorType = 'server_error';
      } else if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
        errorMessage = '⏰ 請求超時，請檢查網絡連接後重試。';
        errorType = 'timeout';
      } else if (error.code === 'ERR_NETWORK') {
        errorMessage = '🌐 網絡連接失敗，請檢查網絡設置。';
        errorType = 'network';
      } else if (error.response?.data?.error) {
        errorMessage = `❌ ${error.response.data.error}`;
        errorType = 'api_error';
      }
      
      addMessage('ai', errorMessage, { 
        type: errorType,
        retryable: ['timeout', 'network', 'service_unavailable', 'server_error'].includes(errorType)
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmBooking = (suggestion, isRecurring = false, suggestions = []) => {
    console.log('🎯 確認預訂:', { suggestion, isRecurring, suggestions });
    
    setPendingBooking({ 
      suggestion, 
      isRecurring, 
      suggestions: isRecurring ? suggestions : [suggestion]
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
        // 確保時間格式一致 - 使用標準格式處理
        const processedBooking = {
          ...response.data.booking,
          // 統一時間格式處理，避免時區問題
          startTime: response.data.booking.startTime,
          endTime: response.data.booking.endTime
        };
        
        addMessage('ai', '', {
          booking: processedBooking,
          recurringBookings: response.data.recurringBookings,
          conflicts: response.data.conflicts,
          showSuccess: true
        });
        
                 // 清空輸入
         setInputText('');
         setContactInfo('');
        
      } else {
        addMessage('ai', '預訂失敗：' + response.data.error, { showError: true });
      }
      
    } catch (error) {
      console.error('❌ 預訂失敗:', error);
      
      // 檢查是否為時間衝突錯誤
      if (error.response?.status === 409 && error.response?.data?.conflict) {
        const conflictMessage = `預訂失敗：該時段已被預訂

💡 建議：
• 嘗試其他時間段
• 查看時間表了解可用時段
• 或選擇其他場地`;
        
        addMessage('ai', conflictMessage, { 
          showError: true,
          errorType: 'conflict',
          suggestion: '您可以說「查看明天的預訂情況」或「我想預訂其他時間」'
        });
      } else {
        const errorMessage = error.response?.data?.error || '預訂時發生錯誤，請稍後再試';
        addMessage('ai', errorMessage, { showError: true });
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
          {/* Avatar */}
          <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
            isUser ? 'bg-primary-600' : 'bg-gradient-to-r from-blue-600 to-purple-600'
          }`}>
            {isUser ? <User className="w-4 h-4 text-white" /> : <Bot className="w-4 h-4 text-white" />}
          </div>
          
          {/* Message Content */}
          <div className={`rounded-2xl px-4 py-3 ${
            isUser 
              ? 'bg-primary-600 text-white' 
              : 'bg-white text-gray-800 shadow-md border'
          }`}>
            <p className="whitespace-pre-wrap">{message.content}</p>
            
            {/* AI提供商標識 */}
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
                    onClick={() => handleConfirmBooking(message.suggestion)}
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
                  <span className="font-medium text-blue-800">重複預訂詳情</span>
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
                        第{suggestion.occurrence}次: {suggestion.formattedTime}
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
                    onClick={() => handleConfirmBooking(message.suggestions[0], true, message.suggestions)}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 transition-colors"
                  >
                    確認重複預訂
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
                      // 統一時間格式處理，確保顯示一致性
                      let startMoment, endMoment;
                      
                      // 檢查時間格式並適當處理
                      if (message.booking.startTime.includes('T')) {
                        // ISO格式，直接使用moment解析
                        startMoment = moment(message.booking.startTime);
                        endMoment = moment(message.booking.endTime);
                      } else {
                        // 其他格式，指定解析格式
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
                      <span className="font-medium text-blue-800">重複預訂已創建</span>
                    </div>
                    <p className="text-sm text-blue-700 mb-2">
                      成功創建 {message.recurringBookings.length} 個預訂
                    </p>
                    <div className="text-xs text-blue-600 max-h-20 overflow-y-auto">
                      {message.recurringBookings.slice(0, 5).map((booking, index) => {
                        // 統一處理重複預訂的時間顯示
                        const startMoment = booking.startTime.includes('T') 
                          ? moment(booking.startTime) 
                          : moment(booking.startTime, 'YYYY-MM-DD HH:mm:ss');
                        
                        return (
                          <div key={index}>
                            {startMoment.format('YYYY-MM-DD HH:mm')}
                          </div>
                        );
                      })}
                      {message.recurringBookings.length > 5 && (
                        <div className="text-blue-500">
                          ...還有 {message.recurringBookings.length - 5} 個預訂
                        </div>
                      )}
                    </div>
                  </div>
                )}
                
                {/* 衝突信息 */}
                {message.conflicts && message.conflicts.length > 0 && (
                  <div className="mt-3 p-3 bg-yellow-50 rounded border border-yellow-200">
                    <div className="flex items-center space-x-2 mb-2">
                      <AlertCircle className="w-4 h-4 text-yellow-600" />
                      <span className="font-medium text-yellow-800">部分時段衝突</span>
                    </div>
                    <p className="text-sm text-yellow-700 mb-2">
                      以下 {message.conflicts.length} 個時段已被佔用，未能預訂：
                    </p>
                    <div className="text-xs text-yellow-600 max-h-20 overflow-y-auto">
                      {message.conflicts.map((conflict, index) => (
                        <div key={index}>
                          {conflict.date} {conflict.time}
                        </div>
                      ))}
                    </div>
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
                    {message.errorType === 'conflict' ? '時間衝突' : '預訂失敗'}
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
            
            {/* 幫助信息 */}
            {message.help && (
              <div className="mt-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-blue-800 mb-2">{message.help.message}</p>
                <div className="text-sm text-blue-700">
                  <p className="font-medium mb-1">需要包含:</p>
                  <ul className="list-disc list-inside mb-2">
                    {message.help.required.map((item, index) => (
                      <li key={index}>{item}</li>
                    ))}
                  </ul>
                  <p className="font-medium mb-1">示例:</p>
                  <ul className="list-disc list-inside">
                    {message.help.examples.map((example, index) => (
                      <li key={index} className="italic">"{example}"</li>
                    ))}
                  </ul>
                </div>
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
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-primary-600 to-purple-600 text-white p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Bot className="w-8 h-8" />
              <div>
                <h1 className="text-2xl font-bold">AI場地預訂助手</h1>
                <p className="text-primary-100">用自然語言描述您的預訂需求</p>
              </div>
            </div>
            
            {/* AI狀態指示器 */}
            {aiStatus && (
              <div className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm ${
                aiStatus.status === 'connected' 
                  ? 'bg-green-50 text-green-700 border border-green-200' 
                  : aiStatus.status === 'error'
                  ? 'bg-red-50 text-red-700 border border-red-200'
                  : 'bg-yellow-50 text-yellow-700 border border-yellow-200'
              }`}>
                <div className={`w-2 h-2 rounded-full ${
                  aiStatus.status === 'connected' ? 'bg-green-500' :
                  aiStatus.status === 'error' ? 'bg-red-500' : 'bg-yellow-500'
                }`}></div>
                <span>
                  {aiStatus.status === 'connected' 
                    ? aiStatus.message 
                    : aiStatus.status === 'error'
                    ? aiStatus.error
                    : 'AI服務異常'
                  }
                </span>
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

        {/* Input */}
        <div className="border-t p-4">
          <div className="flex space-x-2">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder="請描述您的預訂需求，例如：我想在明天下午2點借101號室開會"
              className="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
              disabled={isLoading}
            />
            <button
              onClick={handleSendMessage}
              disabled={!inputText.trim() || isLoading}
              className="bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
            >
              <Send className="w-4 h-4" />
              <span>發送</span>
            </button>
          </div>
        </div>
      </div>

      {/* 確認預訂對話框 */}
      {showConfirmDialog && pendingBooking && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">確認預訂信息</h3>
            
            {/* 聯絡信息輸入 */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                聯絡信息 (姓名 - 電話)
              </label>
              <input
                type="text"
                value={contactInfo}
                onChange={(e) => setContactInfo(e.target.value)}
                placeholder="例如：張三 - 12345678"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            
            {/* 預訂詳情 */}
            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <div className="space-y-2 text-sm">
                <div><strong>場地:</strong> {pendingBooking.suggestion.venue.name}</div>
                <div><strong>時間:</strong> {pendingBooking.suggestion.formattedTime}</div>
                <div><strong>用途:</strong> {pendingBooking.suggestion.purpose}</div>
                
                {pendingBooking.isRecurring && (
                  <div className="mt-3 p-2 bg-blue-50 rounded border border-blue-200">
                    <div className="text-blue-800 font-medium mb-1">重複預訂</div>
                    <div className="text-blue-600 text-xs">
                      將創建 {pendingBooking.suggestions.length} 個預訂
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex space-x-3">
              <button
                onClick={() => {
                  setShowConfirmDialog(false);
                  setPendingBooking(null);
                }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={handleFinalBooking}
                disabled={!contactInfo.trim() || isLoading}
                className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
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