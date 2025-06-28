import axios from 'axios';

// 建立一個共享的 axios 實例，根據環境動態切換 API 基礎網址
const getBaseURL = () => {
  // 若在 Netlify 等前端託管平台上，建議於環境變數中設定 REACT_APP_API_BASE_URL
  if (process.env.REACT_APP_API_BASE_URL) {
    return process.env.REACT_APP_API_BASE_URL;
  }

  // 生產環境預設與前端同網域（例如 Railway 反向代理）
  if (process.env.NODE_ENV === 'production') {
    return '';
  }

  // 開發環境預設指向本機後端
  return 'http://localhost:5000';
};

const api = axios.create({
  baseURL: getBaseURL(),
  timeout: 10000
});

export default api; 