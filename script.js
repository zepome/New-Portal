/* ========================================
   Zepome's Portal - V13 Script (Edit Bug Fix)
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
let currentDetailTodoId = null; // 詳細モーダルで表示中のID

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
            // Gmailアイコンのクリック動作
            gmailCountEl.addEventListener('click', (e) => {
                if (!accessToken) { 
                    e.preventDefault(); 
                    console.log('Starting authentication...');
                    handleAuthClick(); 
                }
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
    
    const dateStringWithWeekday = now.toLocaleDateString('ja-JP', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        weekday: 'short'
    });
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
    
    // イベント詳細モーダル
    document.getElementById('closeEventDetailModal').addEventListener('click', closeEventDetailModal);
    document.getElementById('eventDetailModal').addEventListener('click', (e) => {
        if (e.target.id === 'eventDetailModal') closeEventDetailModal();
    });
    
    // ★バグ修正：編集ボタンクリック時、IDを確保してから詳細モーダルを閉じる
    document.getElementById('editEventBtn').addEventListener('click', () => {
        if (currentDetailTodoId) {
            const idToEdit = currentDetailTodoId; // IDを変数に退避
            closeEventDetailModal(); // ここで currentDetailTodoId は null になる
            openTodoModal(idToEdit); // 退避したIDを使って編集モーダルを開く
        }
    });

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
        
        const weatherText = area.weathers[0].split('　')[0];
        const weatherIcon = getWeatherIcon(weatherText);
        
        weatherContent.innerHTML = `<i class="fas ${weatherIcon} weather-icon"></i><span class="weather-mini-text">${weatherText}</span>`;
    } catch (error) {
        console.error('Weather fetch error:', error);
        weatherContent.innerHTML = '<i class="fas fa-cloud weather-icon"></i><span class="weather-mini-text">エラー</span>';
    }
}

function getWeatherIcon(weatherText) {
    if (weatherText.includes('晴')) return 'fa-sun';
    if (weatherText.includes('雨')) return 'fa-cloud-rain';
    if (weatherText.includes('曇')) return 'fa-cloud';
    if (weatherText.includes('雪')) return 'fa-snowflake';
    return 'fa-cloud';
}

/* ========================================
   タイマー/ストップウォッチ（ミニ版）
   ======================================== */

function switchTimerMode(mode) {
    currentTimerMode = mode;
    
    document.getElementById('timerBtnMini').classList.toggle('active', mode === 'timer');
    document.getElementById('stopwatchBtnMini').classList.toggle('active', mode === 'stopwatch');
    
    if (mode === 'timer') {
        updateTimerDisplay();
    } else {
        updateStopwatchDisplay();
    }
}

function openTimerSettings() {
    if (currentTimerMode === 'timer' && !isTimerRunning) {
        document.getElementById('timerSettingsModal').classList.add('active');
    }
}

function closeTimerSettings() {
    document.getElementById('timerSettingsModal').classList.remove('active');
}

function setTimerFromModal() {
    const hours = parseInt(document.getElementById('timerHours').value) || 0;
    const minutes = parseInt(document.getElementById('timerMinutes').value) || 0;
    const seconds = parseInt(document.getElementById('timerSeconds').value) || 0;
    
    timerSeconds = hours * 3600 + minutes * 60 + seconds;
    updateTimerDisplay();
    closeTimerSettings();
}

function toggleTimer() {
    if (currentTimerMode === 'stopwatch') {
        toggleStopwatch();
        return;
    }
    
    if (!isTimerRunning) {
        if (timerSeconds <= 0) {
            openTimerSettings();
            return;
        }
        
        isTimerRunning = true;
        document.getElementById('timerStartMini').textContent = '⏸';
        
        timerInterval = setInterval(() => {
            timerSeconds -= 0.1;
            if (timerSeconds <= 0) {
                timerSeconds = 0;
                clearInterval(timerInterval);
                isTimerRunning = false;
                document.getElementById('timerStartMini').textContent = '▶';
                alert('タイマー終了！');
            }
            updateTimerDisplay();
        }, 100);
    } else {
        clearInterval(timerInterval);
        isTimerRunning = false;
        document.getElementById('timerStartMini').textContent = '▶';
    }
}

function resetTimer() {
    if (currentTimerMode === 'stopwatch') {
        resetStopwatch();
        return;
    }
    
    clearInterval(timerInterval);
    isTimerRunning = false;
    timerSeconds = 0;
    document.getElementById('timerStartMini').textContent = '▶';
    updateTimerDisplay();
}

function updateTimerDisplay() {
    const hours = Math.floor(timerSeconds / 3600);
    const minutes = Math.floor((timerSeconds % 3600) / 60);
    const secs = Math.floor(timerSeconds % 60);
    const decisecs = Math.floor((timerSeconds % 1) * 10);
    
    document.getElementById('timerDisplayMini').textContent = 
        `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${decisecs}`;
}

function toggleStopwatch() {
    if (!isStopwatchRunning) {
        isStopwatchRunning = true;
        document.getElementById('timerStartMini').textContent = '⏸';
        
        timerInterval = setInterval(() => {
            stopwatchSeconds += 0.1;
            updateStopwatchDisplay();
        }, 100);
    } else {
        clearInterval(timerInterval);
        isStopwatchRunning = false;
        document.getElementById('timerStartMini').textContent = '▶';
    }
}

function resetStopwatch() {
    clearInterval(timerInterval);
    isStopwatchRunning = false;
    stopwatchSeconds = 0;
    document.getElementById('timerStartMini').textContent = '▶';
    updateStopwatchDisplay();
}

function updateStopwatchDisplay() {
    const hours = Math.floor(stopwatchSeconds / 3600);
    const minutes = Math.floor((stopwatchSeconds % 3600) / 60);
    const secs = Math.floor(stopwatchSeconds % 60);
    const decisecs = Math.floor((stopwatchSeconds % 1) * 10);
    
    document.getElementById('timerDisplayMini').textContent = 
        `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${decisecs}`;
}

/* ========================================
   インラインカレンダーピッカー
   ======================================== */

let inlineCalendarDate = new Date();

function toggleInlineCalendar() {
    const calendar = document.getElementById('inlineCalendar');
    const isVisible = calendar.style.display === 'block';
    calendar.style.display = isVisible ? 'none' : 'block';
    
    if (!isVisible) {
        renderInlineCalendar();
    }
}

function renderInlineCalendar() {
    const calendar = document.getElementById('inlineCalendar');
    const year = inlineCalendarDate.getFullYear();
    const month = inlineCalendarDate.getMonth();
    
    let html = `
        <div class="inline-calendar-header">
            <button onclick="changeInlineMonth(-1)">◀</button>
            <span>${year}年 ${month + 1}月</span>
            <button onclick="changeInlineMonth(1)">▶</button>
        </div>
        <div class="inline-calendar-grid">
    `;
    
    // 曜日ヘッダー
    const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
    weekdays.forEach(day => {
        html += `<div class="inline-calendar-day" style="font-weight: bold; cursor: default;">${day}</div>`;
    });
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const firstDayOfWeek = firstDay.getDay();
    const daysInMonth = lastDay.getDate();
    const today = new Date();
    
    // 前月の日付
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
        html += `<div class="inline-calendar-day other-month">${prevMonthLastDay - i
