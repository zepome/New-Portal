/* ========================================
   Google API Configuration
   ======================================== */

// Google API設定オブジェクト
const CONFIG = {
    // Google API設定
    API_KEY: 'AIzaSyC5Y06zUZzRRXgHy1scrCH5Li4qldb0Izo',
    CLIENT_ID: '335218274143-hn0lfceok6fjtuv8udv0s8jodrs55vnn.apps.googleusercontent.com',
    
    // API Scopes
    SCOPES: 'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/tasks',
    
    // 気象庁API エンドポイント（完全なURL形式）
    WEATHER_API: {
        shiga: 'https://www.jma.go.jp/bosai/forecast/data/forecast/250000.json',
        osaka: 'https://www.jma.go.jp/bosai/forecast/data/forecast/270000.json',
        tokyo: 'https://www.jma.go.jp/bosai/forecast/data/forecast/130000.json'
    }
};

// LocalStorageキー
const STORAGE_KEYS = {
    SPREADSHEETS: 'portal_spreadsheets',
    TODO_GROUPS: 'portal_todo_groups'
};

// Google APIが設定されているかチェック
function isGoogleAPIConfigured() {
    return CONFIG.API_KEY !== 'YOUR_API_KEY_HERE' && 
           CONFIG.CLIENT_ID !== 'YOUR_CLIENT_ID_HERE.apps.googleusercontent.com';
}
