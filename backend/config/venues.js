// 場地配置
const VENUES = {
  // 教室
  classrooms: [
    { id: 'room-101', name: '101號室', type: 'classroom', capacity: 30 },
    { id: 'room-102', name: '102號室', type: 'classroom', capacity: 30 },
    { id: 'room-103', name: '103號室', type: 'classroom', capacity: 30 },
    { id: 'room-104', name: '104號室', type: 'classroom', capacity: 30 },
    { id: 'room-201', name: '201號室', type: 'classroom', capacity: 30 },
    { id: 'room-202', name: '202號室', type: 'classroom', capacity: 30 },
    { id: 'room-203', name: '203號室', type: 'classroom', capacity: 30 },
    { id: 'room-204', name: '204號室', type: 'classroom', capacity: 30 },
    { id: 'room-301', name: '301號室', type: 'classroom', capacity: 30 },
    { id: 'room-302', name: '302號室', type: 'classroom', capacity: 30 },
    { id: 'room-303', name: '303號室', type: 'classroom', capacity: 30 },
    { id: 'room-304', name: '304號室', type: 'classroom', capacity: 30 }
  ],
  
  // 專用室
  specialRooms: [
    { id: 'music-room', name: '音樂室', type: 'special', capacity: 20 },
    { id: 'computer-room', name: '電腦室', type: 'special', capacity: 40 },
    { id: 'activity-room', name: '活動室', type: 'special', capacity: 50 },
    { id: 'english-room', name: '英語室', type: 'special', capacity: 25 },
    { id: 'playground', name: '操場', type: 'outdoor', capacity: 200 },
    { id: 'auditorium', name: '禮堂', type: 'large', capacity: 300 },
    { id: 'squash-court', name: '壁球室', type: 'sport', capacity: 4 },
    { id: 'esports-room', name: '電競室', type: 'special', capacity: 20 },
    { id: 'counseling-room', name: '輔導室', type: 'special', capacity: 10 }
  ]
};

// 獲取所有場地
const getAllVenues = () => {
  return [...VENUES.classrooms, ...VENUES.specialRooms];
};

// 根據ID獲取場地
const getVenueById = (id) => {
  return getAllVenues().find(venue => venue.id === id);
};

// 根據名稱搜索場地
const findVenueByName = (name) => {
  const allVenues = getAllVenues();
  return allVenues.find(venue => 
    venue.name.includes(name) || 
    venue.name.toLowerCase().includes(name.toLowerCase())
  );
};

module.exports = {
  VENUES,
  getAllVenues,
  getVenueById,
  findVenueByName
}; 