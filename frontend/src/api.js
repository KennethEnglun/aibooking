import axios from 'axios';

// 根據環境設置API基礎URL
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3001';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 請求攔截器
api.interceptors.request.use(
  (config) => {
    console.log(`API請求: ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    console.error('API請求錯誤:', error);
    return Promise.reject(error);
  }
);

// 響應攔截器
api.interceptors.response.use(
  (response) => {
    console.log(`API響應: ${response.status} ${response.config.url}`);
    return response;
  },
  (error) => {
    console.error('API響應錯誤:', error.response?.status, error.response?.data || error.message);
    return Promise.reject(error);
  }
);

export default api; 