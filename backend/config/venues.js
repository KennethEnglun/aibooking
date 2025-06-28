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

// 根據名稱搜索場地 - 增強版本
const findVenueByName = (name) => {
  if (!name) return null;
  
  const allVenues = getAllVenues();
  const searchName = name.toLowerCase().trim();
  
  // 場地別名映射
  const venueAliases = {
    '音樂室': ['音樂室', '音樂', '琴房', '鋼琴室', 'music', 'music room'],
    '電腦室': ['電腦室', '電腦', '機房', 'computer', 'computer room', 'pc room'],
    '活動室': ['活動室', '活動', '多功能室', 'activity', 'activity room'],
    '英語室': ['英語室', '英語', '外語室', 'english', 'english room'],
    '操場': ['操場', '運動場', '田徑場', 'playground', 'field'],
    '禮堂': ['禮堂', '大禮堂', '演講廳', 'auditorium', 'hall'],
    '壁球室': ['壁球室', '壁球', 'squash', 'squash court'],
    '電競室': ['電競室', '電競', '遊戲室', 'esports', 'gaming room'],
    '輔導室': ['輔導室', '輔導', '諮詢室', 'counseling', 'counseling room']
  };
  
  // 1. 精確匹配
  let venue = allVenues.find(v => v.name.toLowerCase() === searchName);
  if (venue) return venue;
  
  // 2. 包含匹配
  venue = allVenues.find(v => 
    v.name.toLowerCase().includes(searchName) || 
    searchName.includes(v.name.toLowerCase())
  );
  if (venue) return venue;
  
  // 3. 別名匹配
  for (const [venueName, aliases] of Object.entries(venueAliases)) {
    if (aliases.some(alias => 
      alias.toLowerCase().includes(searchName) || 
      searchName.includes(alias.toLowerCase())
    )) {
      venue = allVenues.find(v => v.name === venueName);
      if (venue) return venue;
    }
  }
  
  // 4. 房間號匹配 (101, 201, etc.)
  const roomNumberMatch = searchName.match(/(\d{3})/);
  if (roomNumberMatch) {
    const roomNumber = roomNumberMatch[1];
    venue = allVenues.find(v => v.name.includes(roomNumber));
    if (venue) return venue;
  }
  
  // 5. 模糊匹配 - 移除常見後綴再匹配
  const cleanedName = searchName.replace(/[室房間]/g, '');
  if (cleanedName.length > 0) {
    venue = allVenues.find(v => {
      const cleanedVenueName = v.name.toLowerCase().replace(/[室房間]/g, '');
      return cleanedVenueName.includes(cleanedName) || cleanedName.includes(cleanedVenueName);
    });
    if (venue) return venue;
  }
  
  console.log(`⚠️ 未找到匹配的場地: "${name}" (清理後: "${searchName}")`);
  return null;
};

module.exports = {
  VENUES,
  getAllVenues,
  getVenueById,
  findVenueByName
}; 