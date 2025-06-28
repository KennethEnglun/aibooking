import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { Home, Calendar, Settings, Bot } from 'lucide-react';

// 導入頁面組件
import HomePage from './pages/HomePage';
import BookingPage from './pages/BookingPage';
import AdminPage from './pages/AdminPage';
import SchedulePage from './pages/SchedulePage';

// 導航組件
const Navigation = () => {
  const location = useLocation();
  
  const navItems = [
    { path: '/', label: '首頁', icon: Home },
    { path: '/booking', label: 'AI預訂', icon: Bot },
    { path: '/schedule', label: '時間表', icon: Calendar },
    { path: '/admin', label: '管理員', icon: Settings }
  ];

  return (
    <nav className="bg-white shadow-lg border-b">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex justify-between h-16">
          {/* Logo */}
          <div className="flex items-center">
            <Link to="/" className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <span className="font-bold text-xl text-gray-900">AI場地預訂</span>
            </Link>
          </div>

          {/* 導航菜單 */}
          <div className="flex items-center space-x-1">
            {navItems.map(({ path, label, icon: Icon }) => (
              <Link
                key={path}
                to={path}
                className={`px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors ${
                  location.pathname === path
                    ? 'bg-primary-100 text-primary-700 font-medium'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{label}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </nav>
  );
};

// 主App組件
function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <Navigation />
        
        <main className="max-w-7xl mx-auto px-4 py-8">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/booking" element={<BookingPage />} />
            <Route path="/schedule" element={<SchedulePage />} />
            <Route path="/admin" element={<AdminPage />} />
          </Routes>
        </main>

        {/* Footer */}
        <footer className="bg-white border-t mt-12">
          <div className="max-w-7xl mx-auto px-4 py-6">
            <div className="text-center text-gray-600">
              <p>© 2024 AI場地預訂系統. 由人工智能驅動的智能預訂解決方案.</p>
            </div>
          </div>
        </footer>
      </div>
    </Router>
  );
}

export default App; 