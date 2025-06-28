import React, { useState, useEffect, useCallback } from 'react';
import { Calendar, MapPin, Clock, Users, Filter, RefreshCw } from 'lucide-react';
import axios from 'axios';
import moment from 'moment';

const SchedulePage = () => {
  const [bookings, setBookings] = useState([]);
  const [venues, setVenues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(moment().format('YYYY-MM-DD'));
  const [selectedVenue, setSelectedVenue] = useState('');
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'grid'

  const fetchData = async () => {
    try {
      const [bookingsRes, venuesRes] = await Promise.all([
        axios.get('/api/bookings'),
        axios.get('/api/bookings/venues')
      ]);
      setBookings(bookingsRes.data);
      setVenues(venuesRes.data);
    } catch (error) {
      console.error('獲取數據失敗:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchBookings = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (selectedDate) params.append('date', selectedDate);
      if (selectedVenue) params.append('venue', selectedVenue);
      
      const response = await axios.get(`/api/admin/schedule?${params}`);
      setBookings(response.data);
    } catch (error) {
      console.error('獲取預訂數據失敗:', error);
    }
  }, [selectedDate, selectedVenue]);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    fetchBookings();
  }, [selectedDate, selectedVenue, fetchBookings]);

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

  const getVenueType = (venueId) => {
    const venue = venues.find(v => v.id === venueId);
    return venue?.type || 'unknown';
  };

  const getVenuesByType = () => {
    const grouped = venues.reduce((acc, venue) => {
      const type = venue.type;
      if (!acc[type]) acc[type] = [];
      acc[type].push(venue);
      return acc;
    }, {});
    return grouped;
  };

  const getBookingsForTimeSlot = (venueId, hour) => {
    return bookings.filter(booking => {
      if (booking.venueId !== venueId) return false;
      const startHour = moment(booking.startTime).hour();
      const endHour = moment(booking.endTime).hour();
      return hour >= startHour && hour < endHour;
    });
  };

  const timeSlots = Array.from({ length: 24 }, (_, i) => i);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
        <div className="flex items-center space-x-3 mb-4 md:mb-0">
          <Calendar className="w-8 h-8 text-primary-600" />
          <div>
            <h1 className="text-3xl font-bold text-gray-900">場地時間表</h1>
            <p className="text-gray-600">查看所有場地的預訂狀況</p>
          </div>
        </div>
        
        <button
          onClick={fetchData}
          className="flex items-center space-x-2 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          <span>刷新</span>
        </button>
      </div>

      {/* 過濾器 */}
      <div className="bg-white rounded-xl p-6 shadow-lg">
        <div className="flex items-center space-x-2 mb-4">
          <Filter className="w-5 h-5 text-gray-600" />
          <h3 className="text-lg font-semibold">過濾選項</h3>
        </div>
        
        <div className="grid md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">日期</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">場地</label>
            <select
              value={selectedVenue}
              onChange={(e) => setSelectedVenue(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">所有場地</option>
              {venues.map(venue => (
                <option key={venue.id} value={venue.id}>{venue.name}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">顯示方式</label>
            <select
              value={viewMode}
              onChange={(e) => setViewMode(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="list">列表視圖</option>
              <option value="grid">網格視圖</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">統計</label>
            <div className="text-sm text-gray-600 pt-2">
              今日預訂: {bookings.length} 個
            </div>
          </div>
        </div>
      </div>

      {/* 預訂列表/網格 */}
      {viewMode === 'list' ? (
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">場地</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">時間</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">用途</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">聯絡信息</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">狀態</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {bookings.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-6 py-8 text-center text-gray-500">
                      <Calendar className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                      <p>選定條件下沒有預訂記錄</p>
                    </td>
                  </tr>
                ) : (
                  bookings.map((booking) => (
                    <tr key={booking.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <MapPin className="w-4 h-4 text-gray-400 mr-2" />
                          <div>
                            <div className="text-sm font-medium text-gray-900">{booking.venueName}</div>
                            <div className="text-sm text-gray-500 capitalize">{getVenueType(booking.venueId)}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <Clock className="w-4 h-4 text-gray-400 mr-2" />
                          <div className="text-sm text-gray-900">
                            <div>{moment(booking.startTime).format('MM-DD HH:mm')}</div>
                            <div className="text-gray-500">至 {moment(booking.endTime).format('HH:mm')}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {booking.purpose}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {booking.contactInfo}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(booking.status)}`}>
                          {booking.status === 'confirmed' ? '已確認' : '已取消'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl p-6 shadow-lg">
          <h3 className="text-lg font-semibold mb-4">網格視圖 - {moment(selectedDate).format('YYYY年MM月DD日')}</h3>
          
          {Object.entries(getVenuesByType()).map(([type, typeVenues]) => (
            <div key={type} className="mb-8">
              <h4 className="text-md font-medium text-gray-700 mb-3 capitalize">{type} 場地</h4>
              
              <div className="overflow-x-auto">
                <table className="min-w-full border border-gray-200">
                  <thead>
                    <tr>
                      <th className="border border-gray-200 px-3 py-2 bg-gray-50 text-sm font-medium text-gray-700">時間/場地</th>
                      {typeVenues.map(venue => (
                        <th key={venue.id} className="border border-gray-200 px-3 py-2 bg-gray-50 text-sm font-medium text-gray-700 min-w-32">
                          {venue.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {timeSlots.map(hour => (
                      <tr key={hour}>
                        <td className="border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-50">
                          {hour.toString().padStart(2, '0')}:00
                        </td>
                        {typeVenues.map(venue => {
                          const slotBookings = getBookingsForTimeSlot(venue.id, hour);
                          return (
                            <td key={venue.id} className="border border-gray-200 px-1 py-1">
                              {slotBookings.length > 0 ? (
                                <div className="bg-primary-100 text-primary-800 rounded p-1 text-xs">
                                  {slotBookings[0].purpose}
                                </div>
                              ) : (
                                <div className="h-6"></div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 統計卡片 */}
      <div className="grid md:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-lg">
          <div className="flex items-center">
            <Calendar className="w-8 h-8 text-blue-600 mr-3" />
            <div>
              <div className="text-2xl font-bold text-gray-900">{bookings.length}</div>
              <div className="text-sm text-gray-600">今日預訂</div>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl p-6 shadow-lg">
          <div className="flex items-center">
            <MapPin className="w-8 h-8 text-green-600 mr-3" />
            <div>
              <div className="text-2xl font-bold text-gray-900">{venues.length}</div>
              <div className="text-sm text-gray-600">可用場地</div>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl p-6 shadow-lg">
          <div className="flex items-center">
            <Users className="w-8 h-8 text-purple-600 mr-3" />
            <div>
              <div className="text-2xl font-bold text-gray-900">{bookings.filter(b => b.status === 'confirmed').length}</div>
              <div className="text-sm text-gray-600">已確認</div>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl p-6 shadow-lg">
          <div className="flex items-center">
            <Clock className="w-8 h-8 text-orange-600 mr-3" />
            <div>
              <div className="text-2xl font-bold text-gray-900">
                {bookings.reduce((sum, b) => sum + moment(b.endTime).diff(moment(b.startTime), 'hours'), 0)}
              </div>
              <div className="text-sm text-gray-600">總時數</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SchedulePage; 