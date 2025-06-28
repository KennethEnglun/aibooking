import React from 'react';
import { Link } from 'react-router-dom';
import { Bot, Calendar, Users, Settings, ArrowRight, Sparkles } from 'lucide-react';

const HomePage = () => {
  const features = [
    {
      icon: Bot,
      title: 'AI智能預訂',
      description: '使用自然語言即可輕鬆預訂場地，無需複雜的表單填寫',
      color: 'bg-blue-500'
    },
    {
      icon: Calendar,
      title: '即時時間表',
      description: '查看所有場地的即時可用性，避免預訂衝突',
      color: 'bg-green-500'
    },
    {
      icon: Users,
      title: '多場地支持',
      description: '支持教室、專用室、戶外場地等多種類型場地',
      color: 'bg-purple-500'
    },
    {
      icon: Settings,
      title: '管理員後台',
      description: '完整的管理功能，包括預訂管理和使用統計',
      color: 'bg-orange-500'
    }
  ];

  const venues = [
    { category: '教室', items: ['101-104號室', '201-204號室', '301-304號室'] },
    { category: '專用室', items: ['音樂室', '電腦室', '活動室', '英語室'] },
    { category: '大型場地', items: ['操場', '禮堂', '壁球室', '電競室', '輔導室'] }
  ];

  const examples = [
    "我想在明天下午2點借101號室開會",
    "下週三上午10點使用音樂室練習",
    "這週五晚上7點在禮堂舉辦活動"
  ];

  return (
    <div className="space-y-12">
      {/* Hero Section */}
      <div className="text-center">
        <div className="relative">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-64 h-64 bg-primary-200 rounded-full opacity-20 animate-pulse"></div>
          </div>
          <div className="relative">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-primary-600 rounded-2xl mb-6">
              <Sparkles className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-5xl font-bold text-gray-900 mb-4">
              AI場地預訂系統
            </h1>
            <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
              使用人工智能技術，讓場地預訂變得簡單直觀。只需用自然語言描述您的需求，系統會自動理解並處理您的預訂。
            </p>
            <div className="flex justify-center space-x-4">
              <Link
                to="/booking"
                className="bg-primary-600 text-white px-8 py-3 rounded-lg font-medium hover:bg-primary-700 transition-colors flex items-center space-x-2"
              >
                <Bot className="w-5 h-5" />
                <span>開始AI預訂</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/schedule"
                className="border border-gray-300 text-gray-700 px-8 py-3 rounded-lg font-medium hover:bg-gray-50 transition-colors flex items-center space-x-2"
              >
                <Calendar className="w-5 h-5" />
                <span>查看時間表</span>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
        {features.map((feature, index) => (
          <div key={index} className="bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-shadow">
            <div className={`inline-flex items-center justify-center w-12 h-12 ${feature.color} rounded-lg mb-4`}>
              <feature.icon className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">{feature.title}</h3>
            <p className="text-gray-600">{feature.description}</p>
          </div>
        ))}
      </div>

      {/* 可預訂場地 */}
      <div className="bg-white rounded-xl p-8 shadow-lg">
        <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">可預訂場地</h2>
        <div className="grid md:grid-cols-3 gap-6">
          {venues.map((venue, index) => (
            <div key={index} className="text-center">
              <h3 className="text-lg font-semibold text-primary-600 mb-3">{venue.category}</h3>
              <ul className="space-y-2">
                {venue.items.map((item, itemIndex) => (
                  <li key={itemIndex} className="text-gray-600 bg-gray-50 rounded-lg py-2 px-3">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* AI預訂示例 */}
      <div className="bg-gradient-to-r from-primary-600 to-purple-600 rounded-xl p-8 text-white">
        <h2 className="text-2xl font-bold mb-6 text-center">AI預訂示例</h2>
        <p className="text-center mb-6 text-primary-100">
          您可以用這些自然語言來預訂場地：
        </p>
        <div className="grid md:grid-cols-3 gap-4">
          {examples.map((example, index) => (
            <div key={index} className="bg-white/10 rounded-lg p-4 backdrop-blur-sm">
              <p className="text-sm">{example}</p>
            </div>
          ))}
        </div>
        <div className="text-center mt-6">
          <Link
            to="/booking"
            className="bg-white text-primary-600 px-6 py-2 rounded-lg font-medium hover:bg-gray-100 transition-colors inline-flex items-center space-x-2"
          >
            <Bot className="w-4 h-4" />
            <span>立即嘗試</span>
          </Link>
        </div>
      </div>

      {/* 統計數據 */}
      <div className="grid md:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl p-6 text-center shadow-lg">
          <div className="text-3xl font-bold text-primary-600 mb-2">21</div>
          <div className="text-gray-600">可用場地</div>
        </div>
        <div className="bg-white rounded-xl p-6 text-center shadow-lg">
          <div className="text-3xl font-bold text-green-600 mb-2">24/7</div>
          <div className="text-gray-600">服務時間</div>
        </div>
        <div className="bg-white rounded-xl p-6 text-center shadow-lg">
          <div className="text-3xl font-bold text-purple-600 mb-2">AI</div>
          <div className="text-gray-600">智能預訂</div>
        </div>
        <div className="bg-white rounded-xl p-6 text-center shadow-lg">
          <div className="text-3xl font-bold text-orange-600 mb-2">即時</div>
          <div className="text-gray-600">衝突檢測</div>
        </div>
      </div>
    </div>
  );
};

export default HomePage; 