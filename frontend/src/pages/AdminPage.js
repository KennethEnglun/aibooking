import React, { useState, useEffect } from 'react';
import { Lock, Settings, BarChart3, Users, Calendar, MapPin, Edit, Trash2 } from 'lucide-react';
import axios from 'axios';
import moment from 'moment';

// 配置axios基礎URL
const api = axios.create({
  baseURL: process.env.NODE_ENV === 'production' ? '' : 'http://localhost:5000',
  timeout: 10000
});

const AdminPage = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [dashboardData, setDashboardData] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [editingBooking, setEditingBooking] = useState(null);

  useEffect(() => {
    if (isAuthenticated) {
      fetchDashboardData();
      fetchBookings();
    }
  }, [isAuthenticated]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setAuthError('');
    
    try {
      await api.post('/admin/login', { password });
      setIsAuthenticated(true);
      setPassword('');
    } catch (error) {
      setAuthError('密碼錯誤');
    } finally {
      setLoading(false);
    }
  };

  const fetchDashboardData = async () => {
    try {
      const response = await api.get('/admin/dashboard');
      setDashboardData(response.data);
    } catch (error) {
      console.error('獲取儀表板數據失敗:', error);
    }
  };

  const fetchBookings = async () => {
    try {
      const response = await api.get('/bookings');
      setBookings(response.data.sort((a, b) => moment(b.createdAt).diff(moment(a.createdAt))));
    } catch (error) {
      console.error('獲取預訂數據失敗:', error);
    }
  };

  const handleDeleteBooking = async (bookingId) => {
    if (!window.confirm('確定要刪除這個預訂嗎？')) return;
    
    try {
      await api.delete(`/admin/bookings/${bookingId}`, { 
        data: { password } 
      });
      fetchBookings();
      fetchDashboardData();
    } catch (error) {
      console.error('刪除預訂失敗:', error);
      alert('刪除失敗');
    }
  };

  const handleEditBooking = (booking) => {
    setEditingBooking({
      ...booking,
      startTime: moment(booking.startTime).format('YYYY-MM-DDTHH:mm'),
      endTime: moment(booking.endTime).format('YYYY-MM-DDTHH:mm')
    });
  };

  const handleUpdateBooking = async (e) => {
    e.preventDefault();
    
    try {
      await api.put(`/admin/bookings/${editingBooking.id}`, {
        ...editingBooking,
        password
      });
      setEditingBooking(null);
      fetchBookings();
      fetchDashboardData();
      alert('更新成功');
    } catch (error) {
      console.error('更新預訂失敗:', error);
      alert('更新失敗');
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'confirmed':
        return 'bg-green-100 text-green-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="max-w-md mx-auto mt-12">
        <div className="bg-white rounded-xl shadow-lg p-8">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-600 rounded-full mb-4">
              <Lock className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">管理員登入</h1>
            <p className="text-gray-600">請輸入管理員密碼</p>
          </div>
          
          <form onSubmit={handleLogin}>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">密碼</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="輸入管理員密碼"
                required
              />
              {authError && (
                <p className="text-red-600 text-sm mt-1">{authError}</p>
              )}
            </div>
            
            <button
              type="submit"
              disabled={loading || !password}
              className="w-full bg-primary-600 text-white py-2 rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
            >
              {loading ? '登入中...' : '登入'}
            </button>
          </form>
          
          <div className="mt-4 text-center text-sm text-gray-500">
            <p>提示：默認密碼為 admin123</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Settings className="w-8 h-8 text-primary-600" />
          <div>
            <h1 className="text-3xl font-bold text-gray-900">管理員後台</h1>
            <p className="text-gray-600">系統管理和數據監控</p>
          </div>
        </div>
        
        <button
          onClick={() => setIsAuthenticated(false)}
          className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors"
        >
          登出
        </button>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-lg">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            {[
              { id: 'dashboard', label: '儀表板', icon: BarChart3 },
              { id: 'bookings', label: '預訂管理', icon: Calendar },
              { id: 'reports', label: '報告', icon: Users }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 py-4 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {/* Dashboard Tab */}
          {activeTab === 'dashboard' && dashboardData && (
            <div className="space-y-6">
              {/* Statistics Cards */}
              <div className="grid md:grid-cols-4 gap-6">
                <div className="bg-blue-50 rounded-xl p-6">
                  <div className="flex items-center">
                    <Calendar className="w-8 h-8 text-blue-600 mr-3" />
                    <div>
                      <div className="text-2xl font-bold text-gray-900">{dashboardData.stats.totalBookings}</div>
                      <div className="text-sm text-gray-600">總預訂數</div>
                    </div>
                  </div>
                </div>
                
                <div className="bg-green-50 rounded-xl p-6">
                  <div className="flex items-center">
                    <Users className="w-8 h-8 text-green-600 mr-3" />
                    <div>
                      <div className="text-2xl font-bold text-gray-900">{dashboardData.stats.confirmedBookings}</div>
                      <div className="text-sm text-gray-600">已確認</div>
                    </div>
                  </div>
                </div>
                
                <div className="bg-yellow-50 rounded-xl p-6">
                  <div className="flex items-center">
                    <Calendar className="w-8 h-8 text-yellow-600 mr-3" />
                    <div>
                      <div className="text-2xl font-bold text-gray-900">{dashboardData.stats.todayBookings}</div>
                      <div className="text-sm text-gray-600">今日預訂</div>
                    </div>
                  </div>
                </div>
                
                <div className="bg-purple-50 rounded-xl p-6">
                  <div className="flex items-center">
                    <BarChart3 className="w-8 h-8 text-purple-600 mr-3" />
                    <div>
                      <div className="text-2xl font-bold text-gray-900">{dashboardData.stats.upcomingBookings}</div>
                      <div className="text-sm text-gray-600">即將到來</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Recent Bookings */}
              <div className="bg-gray-50 rounded-xl p-6">
                <h3 className="text-lg font-semibold mb-4">最近預訂</h3>
                <div className="space-y-3">
                  {dashboardData.recentBookings.slice(0, 5).map(booking => (
                    <div key={booking.id} className="bg-white rounded-lg p-4 flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <MapPin className="w-4 h-4 text-gray-400" />
                        <div>
                          <div className="font-medium">{booking.venueName}</div>
                          <div className="text-sm text-gray-500">
                            {moment(booking.startTime).format('MM-DD HH:mm')} - {booking.purpose}
                          </div>
                        </div>
                      </div>
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(booking.status)}`}>
                        {booking.status === 'confirmed' ? '已確認' : '已取消'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Venue Usage */}
              <div className="bg-gray-50 rounded-xl p-6">
                <h3 className="text-lg font-semibold mb-4">場地使用率</h3>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {dashboardData.venueUsage.slice(0, 9).map(venue => (
                    <div key={venue.venue} className="bg-white rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="font-medium">{venue.venue}</div>
                        <div className="text-sm text-gray-500">{venue.bookings} 次</div>
                      </div>
                      <div className="text-xs text-gray-400">最後使用: {venue.lastUsed}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Bookings Management Tab */}
          {activeTab === 'bookings' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">預訂管理</h3>
                <button
                  onClick={fetchBookings}
                  className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors"
                >
                  刷新
                </button>
              </div>
              
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">場地</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">時間</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">用途</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">聯絡</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">狀態</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {bookings.map(booking => (
                      <tr key={booking.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {booking.venueName}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {moment(booking.startTime).format('MM-DD HH:mm')} - {moment(booking.endTime).format('HH:mm')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {booking.purpose}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {booking.contactInfo}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(booking.status)}`}>
                            {booking.status === 'confirmed' ? '已確認' : '已取消'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2">
                          <button
                            onClick={() => handleEditBooking(booking)}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteBooking(booking.id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Reports Tab */}
          {activeTab === 'reports' && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold">報告</h3>
              <div className="text-center py-12 text-gray-500">
                <BarChart3 className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <p>報告功能開發中...</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Edit Booking Modal */}
      {editingBooking && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">編輯預訂</h3>
            <form onSubmit={handleUpdateBooking} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">開始時間</label>
                <input
                  type="datetime-local"
                  value={editingBooking.startTime}
                  onChange={(e) => setEditingBooking({...editingBooking, startTime: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">結束時間</label>
                <input
                  type="datetime-local"
                  value={editingBooking.endTime}
                  onChange={(e) => setEditingBooking({...editingBooking, endTime: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">用途</label>
                <input
                  type="text"
                  value={editingBooking.purpose}
                  onChange={(e) => setEditingBooking({...editingBooking, purpose: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">狀態</label>
                <select
                  value={editingBooking.status}
                  onChange={(e) => setEditingBooking({...editingBooking, status: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="confirmed">已確認</option>
                  <option value="cancelled">已取消</option>
                </select>
              </div>
              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={() => setEditingBooking(null)}
                  className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-primary-600 text-white py-2 rounded-lg hover:bg-primary-700 transition-colors"
                >
                  更新
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPage; 