/* ========================================
   Zepome's Portal - V7 Script (Final Fixes)
   ======================================== */

// グローバル変数
let gapiInited = false;
let gisInited = false;
let tokenClient;
let accessToken = null;

// 現在の状態
let currentWeatherLocation = 'shiga';
let currentMonth = new Date();
let currentTimerMode = 'timer';
let timerInterval = null;
let timerSeconds = 0;
let stopwatchSeconds = 0;
let isTimerRunning = false;
let isStopwatchRunning = false;
let editingTodoId = null; // 編集中のTodo ID
let currentSortFilter = 'all'; // 現在のソートフィルター

// データストレージ
let spreadsheets = JSON.parse(localStorage.getItem(STORAGE_KEYS.SPREADSHEETS) || '[]');
let todoGroups = JSON.parse(localStorage.getItem(STORAGE_KEYS.TODO_GROUPS) || '["仕事", "個人", "買い物"]');
let calendarEvents = [];
let todos = JSON.parse(localStorage.getItem('portal_todos') || '[]');
let garbageDays = JSON.parse(localStorage.getItem('portal_garbage_days') || '[]');


/* ========================================
   初期化
   ======================================== */

document.addEventListener('DOMContentLoaded', () => {
    initializeUI();
    updateCurrentTime();
    setInterval(updateCurrentTime, 1000);
    
    loadWeatherMini(currentWeatherLocation);
    renderCalendar();
    renderSpreadsheetTabs();
    setupEventListeners();
    
    setInterval(updateGmailCount, 300000);
    
    
    if (isGoogleAPIConfigured()) {
        const gmailCountEl = document.getElementById('gmailCount');
        if (gmailCountEl) {
            // ★修正：Gmailアイコンのクリック動作
            gmailCountEl.addEventListener('click', (e) => {
                if (!accessToken) { // ★もし認証トークンがまだ無いなら
                    e.preventDefault(); // リンクを無効化
                    console.log('Starting authentication...');
                    handleAuthClick(); // 認証を開始
                }
                // ★認証トークンが既にある場合は、preventDefault() を呼ばないので、
                // HTMLの <a href="..." target="_blank"> のデフォルト動作（Gmailを開く）が実行される
            });
        }
    }
});

function initializeUI() {
    console.log('Zepome\'s Portal initialized');
}

function saveTodos() {
    localStorage.setItem('portal_todos', JSON.stringify(todos));
}

function saveGarbageDays() {
    localStorage.setItem('portal_garbage_days', JSON.stringify(garbageDays));
}

/* ========================================
   時計更新
   ======================================== */

function updateCurrentTime() {
    const now = new Date();
    const timeString = now.toLocaleTimeString('ja-JP', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    
    // ★修正：曜日の（）の前に半角スペースを追加
    const dateStringWithWeekday = now.toLocaleDateString('ja-JP', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        weekday: 'short'
    });
    // "2025/11/15(土)" を "2025/11/15 (土)" に置換
    const dateString = dateStringWithWeekday.replace('(', ' (').replace(/\//g, '/');
    
    const timeDisplay = document.getElementById('timeDisplay');
    const dateDisplay = document.getElementById('currentDate');
    
    if (timeDisplay) {
        timeDisplay.textContent = timeString;
    }
    if (dateDisplay) {
        dateDisplay.textContent = dateString;
    }
}

/* ========================================
   イベントリスナー設定
   ======================================== */

function setupEventListeners() {
    // 天気タブ（ミニ）
    document.querySelectorAll('.tab-btn-mini').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn-mini').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentWeatherLocation = btn.dataset.location;
            loadWeatherMini(currentWeatherLocation);
        });
    });
    
    // タイマー/ストップウォッチ切り替え（ミニ）
    document.getElementById('timerBtnMini').addEventListener('click', () => switchTimerMode('timer'));
    document.getElementById('stopwatchBtnMini').addEventListener('click', () => switchTimerMode('stopwatch'));
    
    // タイマーコントロール（ミニ）
    document.getElementById('timerStartMini').addEventListener('click', toggleTimer);
    document.getElementById('timerResetMini').addEventListener('click', resetTimer);
    
    // タイマー表示クリックで設定モーダル
    document.getElementById('timerDisplayMini').addEventListener('click', openTimerSettings);
    document.getElementById('closeTimerSettings')?.addEventListener('click', closeTimerSettings);
    document.getElementById('setTimer')?.addEventListener('click', setTimerFromModal);
    
    // カレンダーナビゲーション
    document.getElementById('prevMonth').addEventListener('click', () => changeMonth(-1));
    document.getElementById('nextMonth').addEventListener('click', () => changeMonth(1));
    
    // Todoソート
    document.getElementById('sortBtn').addEventListener('click', toggleSortMenu);
    document.querySelectorAll('.sort-option').forEach(btn => {
        btn.addEventListener('click', () => {
            currentSortFilter = btn.dataset.sort;
            document.querySelectorAll('.sort-option').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderTodoList();
            document.getElementById('sortMenu').style.display = 'none';
        });
    });
    
    // Todoモーダル
    document.getElementById('addTodoBtn').addEventListener('click', () => openTodoModal());
    document.getElementById('closeTodoModal').addEventListener('click', closeTodoModal);
    document.getElementById('cancelTodo').addEventListener('click', closeTodoModal);
    document.getElementById('saveTodo').addEventListener('click', saveTodo);
    document.getElementById('updateTodo')?.addEventListener('click', updateTodo);
    
    // カレンダーアイコンクリック
    document.getElementById('calendarIconBtn')?.addEventListener('click', toggleInlineCalendar);
    
    // Todoグループ選択
    document.getElementById('todoGroup').addEventListener('change', function() {
        if (this.value === '__new__') {
            const newGroup = prompt('新しいグループ名を入力してください:');
            if (newGroup && newGroup.trim()) {
                todoGroups.push(newGroup.trim());
                localStorage.setItem(STORAGE_KEYS.TODO_GROUPS, JSON.stringify(todoGroups));
                updateTodoGroupOptions();
                this.value = newGroup.trim();
            } else {
                this.value = '';
            }
        }
    });

    // Todoグループ管理モーダル
    document.getElementById('manageGroupsBtn').addEventListener('click', openGroupModal);
    document.getElementById('closeGroupModal').addEventListener('click', closeGroupModal);
    document.getElementById('doneGroupModal').addEventListener('click', closeGroupModal);
    document.getElementById('groupModal').addEventListener('click', (e) => {
        if (e.target.id === 'groupModal') closeGroupModal();
    });

    // ゴミの日モーダル
    document.getElementById('openGarbageModalBtn').addEventListener('click', openGarbageModal);
    document.getElementById('closeGarbageModal').addEventListener('click', closeGarbageModal);
    document.getElementById('saveGarbage').addEventListener('click', saveGarbageEvent);
    document.getElementById('garbageModal').addEventListener('click', (e) => {
        if (e.target.id === 'garbageModal') closeGarbageModal();
    });
    
    // スプレッドシートモーダル
    document.getElementById('addSheetBtn').addEventListener('click', openSheetModal);
    document.getElementById('closeSheetModal').addEventListener('click', closeSheetModal);
    document.getElementById('cancelSheet').addEventListener('click', closeSheetModal);
    document.getElementById('saveSheet').addEventListener('click', saveSpreadsheet);
    
    // モーダル外クリックで閉じる
    document.getElementById('todoModal').addEventListener('click', (e) => {
        if (e.target.id === 'todoModal') closeTodoModal();
    });
    document.getElementById('sheetModal').addEventListener('click', (e) => {
        if (e.target.id === 'sheetModal') closeSheetModal();
    });
    document.getElementById('timerSettingsModal')?.addEventListener('click', (e) => {
        if (e.target.id === 'timerSettingsModal') closeTimerSettings();
    });
}

/* ========================================
   天気情報（ミニ版）
   ======================================== */

async function loadWeatherMini(location) {
    const weatherContent = document.getElementById('weatherContentMini');
    weatherContent.innerHTML = '<i class="fas fa-cloud weather-icon"></i><span class="weather-mini-text">Loading...</span>';
    
    try {
        const response = await fetch(CONFIG.WEATHER_API[location]);
        const data = await response.json();
        
        const todayForecast = data[0].timeSeries[0];
        const area = todayForecast.areas[0];
        
        const weatherText = area.weathers[0].split('{TRUNCATED}
