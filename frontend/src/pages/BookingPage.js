import React, { useState, useRef, useEffect } from 'react';
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
  const [showContactModal, setShowContactModal] = useState(false);
  const [pendingBooking, setPendingBooking] = useState(null);
  const [aiStatus, setAiStatus] = useState(null);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    checkAiStatus();
  }, []);

  const checkAiStatus = async () => {
    try {
      const response = await api.get('/api/ai/status');
      setAiStatus(response.data);
    } catch (error) {
      console.error('檢查AI狀態失敗:', error);
    }
  };

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
      if (error.response?.data?.error) {
        addMessage('ai', `❌ ${error.response.data.error}`);
      } else {
        addMessage('ai', '抱歉，處理您的請求時遇到了問題。請稍後再試。');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmBooking = (suggestion, isRecurring = false, suggestions = []) => {
    if (isRecurring) {
      setPendingBooking({ 
        ...suggestion, 
        isRecurring: true, 
        allSuggestions: suggestions 
      });
    } else {
      setPendingBooking(suggestion);
    }
    setShowContactModal(true);
  };

  const handleFinalBooking = async () => {
    if (!contactInfo.trim() || !pendingBooking) return;

    setIsLoading(true);
    try {
      let bookingText;
      if (pendingBooking.isRecurring) {
        // 構建重複預訂的文本
        const pattern = pendingBooking.allSuggestions[0].recurring.pattern;
        bookingText = `${pattern}預訂${pendingBooking.venue.name}在${pendingBooking.formattedStartTime}用於${pendingBooking.purpose}`;
      } else {
        bookingText = `預訂${pendingBooking.venue.name}在${pendingBooking.formattedTime}用於${pendingBooking.purpose}`;
      }
      
      const response = await api.post('/api/ai/book', {
        text: bookingText,
        contactInfo: contactInfo
      });

      if (response.data.success) {
        let successMessage = '🎉 預訂成功！';
        
        // 如果是重複預訂，調整消息
        if (response.data.bookings && response.data.bookings.length > 1) {
          successMessage = `🎉 重複預訂成功！已創建 ${response.data.bookings.length} 個預訂。`;
          
          if (response.data.conflictDates && response.data.conflictDates.length > 0) {
            successMessage += ` 其中 ${response.data.conflictDates.length} 個時段因衝突未能預訂。`;
          }
        }
        
        addMessage('ai', successMessage, {
          booking: response.data.booking || response.data.bookings[0],
          recurringBookings: response.data.bookings,
          conflicts: response.data.conflictDates,
          showSuccess: true,
          aiProvider: response.data.aiProvider
        });
        setShowContactModal(false);
        setContactInfo('');
        setPendingBooking(null);
      }
    } catch (error) {
      if (error.response?.status === 409) {
        // 處理衝突錯誤
        const conflictData = error.response.data;
        if (conflictData.conflicts) {
          addMessage('ai', `❌ 重複預訂失敗：所有 ${conflictData.conflicts.length} 個時段都已被佔用。`, {
            conflicts: conflictData.conflicts,
            showError: true
          });
        } else {
          addMessage('ai', '❌ 抱歉，該時段已被預訂。請選擇其他時間。', {
            showError: true
          });
        }
      } else {
        console.error('預訂失敗:', error);
        addMessage('ai', '❌ 預訂失敗，請稍後再試。');
      }
      setShowContactModal(false);
    } finally {
      setIsLoading(false);
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
                  <p><strong>時間:</strong> {moment(message.booking.startTime, 'YYYY-MM-DDTHH:mm:ss').format('YYYY-MM-DD HH:mm')} - {moment(message.booking.endTime, 'YYYY-MM-DDTHH:mm:ss').format('HH:mm')}</p>
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
                      {message.recurringBookings.slice(0, 5).map((booking, index) => (
                        <div key={index}>
                          {moment(booking.startTime, 'YYYY-MM-DDTHH:mm:ss').format('YYYY-MM-DD HH:mm')}
                        </div>
                      ))}
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
                <div className="flex items-center space-x-2">
                  <AlertCircle className="w-5 h-5 text-red-600" />
                  <span className="font-medium text-red-800">預訂失敗</span>
                </div>
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
              <div className="flex items-center space-x-2 text-sm">
                <div className={`w-2 h-2 rounded-full ${
                  aiStatus.apiConnected ? 'bg-green-400' : 'bg-yellow-400'
                }`}></div>
                <span className="text-primary-100">
                  {aiStatus.provider} {aiStatus.apiConnected ? '已連接' : '備用模式'}
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

      {/* 聯絡信息模態框 */}
      {showContactModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">確認預訂信息</h3>
            
            {pendingBooking && (
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <div className="space-y-2 text-sm">
                  <div><strong>場地:</strong> {pendingBooking.venue.name}</div>
                  <div><strong>時間:</strong> {pendingBooking.formattedTime}</div>
                  <div><strong>用途:</strong> {pendingBooking.purpose}</div>
                </div>
              </div>
            )}
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                聯絡信息 (姓名、電話或email)
              </label>
              <input
                type="text"
                value={contactInfo}
                onChange={(e) => setContactInfo(e.target.value)}
                placeholder="請輸入您的聯絡信息"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            
            <div className="flex space-x-3">
              <button
                onClick={() => setShowContactModal(false)}
                className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg hover:bg-gray-50 transition-colors"
                disabled={isLoading}
              >
                取消
              </button>
              <button
                onClick={handleFinalBooking}
                disabled={!contactInfo.trim() || isLoading}
                className="flex-1 bg-primary-600 text-white py-2 rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
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