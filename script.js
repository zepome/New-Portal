/* ========================================
   Zepome's Portal - V11 Script (Event Detail Modal)
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
let currentDetailTodoId = null; // ★新機能：詳細モーダルで表示中のID

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
    
    // ★新機能：イベント詳細モーダル
    document.getElementById('closeEventDetailModal').addEventListener('click', closeEventDetailModal);
    document.getElementById('eventDetailModal').addEventListener('click', (e) => {
        if (e.target.id === 'eventDetailModal') closeEventDetailModal();
    });
    document.getElementById('editEventBtn').addEventListener('click', () => {
        if (currentDetailTodoId) {
            closeEventDetailModal();
            openTodoModal(currentDetailTodoId); // 編集モーダルを開く
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
        html += `<div class="inline-calendar-day other-month">${prevMonthLastDay - i}</div>`;
    }
    
    // 当月の日付
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
        const classes = ['inline-calendar-day'];
        if (isToday) classes.push('today');
        
        html += `<div class="${classes.join(' ')}" onclick="selectInlineDate('${dateStr}')">${day}</div>`;
    }
    
    html += '</div>';
    calendar.innerHTML = html;
}

function changeInlineMonth(delta) {
    inlineCalendarDate.setMonth(inlineCalendarDate.getMonth() + delta);
    renderInlineCalendar();
}

function selectInlineDate(dateStr) {
    document.getElementById('todoDueDate').value = dateStr;
    document.getElementById('inlineCalendar').style.display = 'none';
}

/* ========================================
   カレンダー
   ======================================== */

function renderCalendar() {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth(); // 0-11
    
    document.getElementById('currentMonth').textContent = 
        `${year}年 ${month + 1}月`;
    
    const calendarGrid = document.getElementById('calendarGrid');
    calendarGrid.innerHTML = '';
    
    // 月曜日始まりに変更
    const weekdays = ['月', '火', '水', '木', '金', '土', '日'];
    weekdays.forEach(day => {
        const header = document.createElement('div');
        header.className = 'calendar-day-header';
        header.textContent = day;
        calendarGrid.appendChild(header);
    });
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    let firstDayOfWeek = firstDay.getDay();
    // 日曜日(0)を最後(6)に、月曜日(1)を0に
    firstDayOfWeek = (firstDayOfWeek === 0) ? 6 : firstDayOfWeek - 1;
    const daysInMonth = lastDay.getDate();
    
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
        const dayEl = createCalendarDay(prevMonthLastDay - i, true, year, month - 1);
        calendarGrid.appendChild(dayEl);
    }
    
    for (let day = 1; day <= daysInMonth; day++) {
        const dayEl = createCalendarDay(day, false, year, month);
        calendarGrid.appendChild(dayEl);
    }
    
    const remainingDays = 42 - (firstDayOfWeek + daysInMonth);
    for (let day = 1; day <= remainingDays; day++) {
        const dayEl = createCalendarDay(day, true, year, month + 1);
        calendarGrid.appendChild(dayEl);
    }
}

function createCalendarDay(day, isOtherMonth, year, month) {
    const dayEl = document.createElement('div');
    dayEl.className = 'calendar-day';
    
    if (isOtherMonth) {
        dayEl.classList.add('other-month');
    }
    
    const today = new Date();
    if (!isOtherMonth && 
        day === today.getDate() && 
        month === today.getMonth() && 
        year === today.getFullYear()) {
        dayEl.classList.add('today');
    }
    
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dateObj = new Date(year, month, day);

    const dayHeaderFlex = document.createElement('div');
    dayHeaderFlex.className = 'day-header-flex';
    
    const dayNumber = document.createElement('div');
    dayNumber.className = 'day-number';
    dayNumber.textContent = day;
    dayHeaderFlex.appendChild(dayNumber); 

    const garbageIconsContainer = document.createElement('div');
    garbageIconsContainer.className = 'garbage-icons';
    
    const dayGarbageEvents = getGarbageEventsForDate(dateStr, dateObj);
    
    dayGarbageEvents.forEach(event => {
        const garbageItem = document.createElement('div');
        garbageItem.className = 'garbage-item';
        garbageItem.title = event.title; 
        garbageItem.dataset.type = event.title; 

        const icon = document.createElement('i');
        icon.className = 'fas fa-trash garbage-icon';
        icon.dataset.type = event.title;
        garbageItem.appendChild(icon);

        const text = document.createElement('span');
        text.className = 'garbage-text';
        text.textContent = event.title; 
        garbageItem.appendChild(text);

        garbageIconsContainer.appendChild(garbageItem);
    });
    dayHeaderFlex.appendChild(garbageIconsContainer); 
    
    dayEl.appendChild(dayHeaderFlex); 

    
    // イベント追加ボタン
    if (!isOtherMonth) {
        const addBtn = document.createElement('button');
        addBtn.className = 'add-event-btn';
        addBtn.innerHTML = '<i class="fas fa-plus"></i>';
        addBtn.onclick = (e) => {
            e.stopPropagation();
            openTodoModalWithDate(dateStr);
        };
        dayEl.appendChild(addBtn);
    }
    
    // ★修正：Todoイベントを取得（IDも）
    const dayTodos = getTodosForDate(dateStr);
    
    if (dayTodos.length > 0) {
        const eventsContainer = document.createElement('div');
        eventsContainer.className = 'day-events';
        // ★修正：クリックで詳細モーダルを開く
        dayTodos.forEach(todo => {
            const eventDot = document.createElement('div');
            eventDot.className = 'event-dot';
            eventDot.textContent = todo.time ? `${todo.time} ${todo.title}` : todo.title;
            eventDot.title = todo.title;
            // ★新機能：クリックイベントを追加
            eventDot.onclick = (e) => {
                e.stopPropagation(); // カレンダーセルのクリックイベントを防ぐ
                openEventDetailModal(todo.id);
            };
            eventsContainer.appendChild(eventDot);
        });
        dayEl.appendChild(eventsContainer);
    }
    
    return dayEl;
}

// ★修正：mapに todo.id を追加
function getTodosForDate(dateStr) {
    return todos.filter(todo => {
        if (!todo.dueDate) return false;
        return todo.dueDate === dateStr;
    }).map(todo => ({
        id: todo.id, // ★IDを追加
        title: todo.title,
        time: todo.time || null,
        isGarbage: false
    })).sort((a, b) => { 
        if (!a.time) return 1;
        if (!b.time) return -1;
        return a.time.localeCompare(b.time);
    });
}

function changeMonth(delta) {
    currentMonth.setMonth(currentMonth.getMonth() + delta);
    renderCalendar();
}

function openTodoModalWithDate(dateStr) {
    openTodoModal();
    document.getElementById('todoDueDate').value = dateStr;
}

/* ========================================
   Todo管理
   ======================================== */

function openTodoModal(todoId = null) {
    editingTodoId = todoId;
    
    if (todoId) {
        // 編集モード
        const todo = todos.find(t => t.id === todoId);
        if (todo) {
            document.getElementById('todoTitle').value = todo.title;
            document.getElementById('todoGroup').value = todo.group || '';
            document.getElementById('todoDueDate').value = todo.dueDate || '';
            document.getElementById('todoTime').value = todo.time || '';
            document.getElementById('todoNotes').value = todo.notes || '';
            
            document.getElementById('saveTodo').style.display = 'none';
            document.getElementById('updateTodo').style.display = 'inline-block';
        }
    } else {
        // 新規作成モード
        clearTodoForm();
        document.getElementById('saveTodo').style.display = 'inline-block';
        document.getElementById('updateTodo').style.display = 'none';
    }
    
    document.getElementById('todoModal').classList.add('active');
    updateTodoGroupOptions();
}

function closeTodoModal() {
    document.getElementById('todoModal').classList.remove('active');
    document.getElementById('inlineCalendar').style.display = 'none';
    clearTodoForm();
    editingTodoId = null;
}

function updateTodoGroupOptions() {
    const select = document.getElementById('todoGroup');
    const currentValue = select.value; 
    
    select.innerHTML = '<option value="">グループを選択</option>';
    
    todoGroups.forEach(group => {
        const option = document.createElement('option');
        option.value = group;
        option.textContent = group;
        select.appendChild(option);
    });
    
    const newOption = document.createElement('option');
    newOption.value = '__new__';
    newOption.textContent = '+ 新しいグループを作成';
    select.appendChild(newOption);

    if (todoGroups.includes(currentValue)) {
        select.value = currentValue;
    } else {
        select.value = '';
    }
}

function saveTodo() {
    const title = document.getElementById('todoTitle').value.trim();
    const group = document.getElementById('todoGroup').value;
    const dueDate = document.getElementById('todoDueDate').value;
    const time = document.getElementById('todoTime').value;
    const notes = document.getElementById('todoNotes').value.trim();
    
    if (!title) {
        alert('タスク名を入力してください');
        return;
    }
    
    const newTodo = {
        id: Date.now(),
        title,
        group,
        dueDate,
        time,
        notes,
        completed: false
    };
    
    todos.push(newTodo);
    saveTodos();
    renderTodoList();
    renderCalendar();
    closeTodoModal();
    
    if (accessToken) {
        addToGoogleTasks(newTodo).catch(error => {
            console.error('Google Tasksへの同期に失敗:', error);
        });
    }
    
    if (newTodo.dueDate && isGoogleAPIConfigured()) {
        addToGoogleCalendar(newTodo).then(success => {
            if (success) {
                console.log('✅ Googleカレンダーに追加されました');
            } else {
                console.log('⚠️ Googleカレンダーへの追加に失敗しました。');
            }
        });
    }
}

function updateTodo() {
    if (!editingTodoId) return;
    
    const todo = todos.find(t => t.id === editingTodoId);
    if (!todo) return;
    
    const title = document.getElementById('todoTitle').value.trim();
    if (!title) {
        alert('タスク名を入力してください');
        return;
    }
    
    todo.title = title;
    todo.group = document.getElementById('todoGroup').value;
    todo.dueDate = document.getElementById('todoDueDate').value;
    todo.time = document.getElementById('todoTime').value;
    todo.notes = document.getElementById('todoNotes').value.trim();
    
    saveTodos();
    renderTodoList();
    renderCalendar();
    closeTodoModal();
    
    if (accessToken) {
        addToGoogleTasks(todo).catch(error => {
            console.error('Google Tasksへの同期に失敗:', error);
        });
    }
    
    if (todo.dueDate && isGoogleAPIConfigured()) {
        addToGoogleCalendar(todo).then(success => {
            if (success) {
                console.log('✅ Googleカレンダーに更新されました');
            } else {
                console.log('⚠️ Googleカレンダーへの更新に失敗しました。');
            }
        });
    }
}

function renderTodoList() {
    const todoList = document.getElementById('todoList');
    
    if (todos.length === 0) {
        todoList.innerHTML = `
            <div class="empty-schedule">
                <i class="fas fa-tasks"></i>
                <p>Todoを追加してください</p>
            </div>
        `;
        return;
    }
    
    let filteredTodos = filterAndSortTodos(todos, currentSortFilter);
    
    if (filteredTodos.length === 0) {
        todoList.innerHTML = `
            <div class="empty-schedule">
                <i class="fas fa-filter"></i>
                <p>条件に一致するTodoがありません</p>
            </div>
        `;
        return;
    }
    
    todoList.innerHTML = filteredTodos.map(todo => `
        <div class="todo-item ${todo.completed ? 'completed' : ''}">
            <input type="checkbox" class="todo-checkbox" 
                   ${todo.completed ? 'checked' : ''} 
                   onchange="toggleTodoComplete(${todo.id})">
            <div class="todo-content">
                <div class="todo-title">${todo.title}</div>
                <div class="todo-meta">
                    ${todo.group ? `<span class="todo-group"><i class="fas fa-tag"></i> ${todo.group}</span>` : ''}
                    ${todo.dueDate ? `<span class="todo-due"><i class="fas fa-calendar"></i> ${todo.dueDate}</span>` : ''}
                    ${todo.time ? `<span class="todo-time"><i class="fas fa-clock"></i> ${todo.time}</span>` : ''}
                </div>
            </div>
            <div class="todo-actions">
                <button class="todo-edit" onclick="openTodoModal(${todo.id})" title="編集">
                    <i class="fas fa-pencil"></i>
                </button>
                <button class="todo-delete" onclick="deleteTodo(${todo.id})" title="削除">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `).join('');
}

function toggleTodoComplete(id) {
    const todo = todos.find(t => t.id === id);
    if (todo) {
        todo.completed = !todo.completed;
        saveTodos();
        renderTodoList();
    }
}

function deleteTodo(id) {
    if (confirm('このTodoを削除しますか?')) {
        todos = todos.filter(t => t.id !== id);
        saveTodos();
        renderTodoList();
        renderCalendar();
    }
}

function clearTodoForm() {
    document.getElementById('todoTitle').value = '';
    document.getElementById('todoGroup').value = '';
    document.getElementById('todoDueDate').value = '';
    document.getElementById('todoTime').value = '';
    document.getElementById('todoNotes').value = '';
}

function toggleSortMenu() {
    const menu = document.getElementById('sortMenu');
    menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
}

// クリック外でメニューを閉じる
document.addEventListener('click', (e) => {
    const sortBtn = document.getElementById('sortBtn');
    const sortMenu = document.getElementById('sortMenu');
    if (sortBtn && sortMenu && !sortBtn.contains(e.target) && !sortMenu.contains(e.target)) {
        sortMenu.style.display = 'none';
    }
});

function filterAndSortTodos(todoList, filter) {
    let filtered = [...todoList];
    
    switch(filter) {
        case 'all':
            break;
        case 'time':
            filtered = filtered.filter(todo => todo.dueDate && todo.time);
            filtered.sort((a, b) => {
                const dateA = new Date(`${a.dueDate}T${a.time}`);
                const dateB = new Date(`${b.dueDate}T${b.time}`);
                return dateA - dateB;
            });
            break;
        case 'group':
            filtered = filtered.filter(todo => todo.group);
            filtered.sort((a, b) => (a.group || '').localeCompare(b.group || ''));
            break;
        case 'day':
            filtered = filtered.filter(todo => todo.dueDate);
            filtered.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
            break;
        case 'month':
            filtered = filtered.filter(todo => todo.dueDate);
            filtered.sort((a, b) => {
                const monthA = a.dueDate.substring(0, 7); // YYYY-MM
                const monthB = b.dueDate.substring(0, 7);
                return monthA.localeCompare(monthB);
            });
            break;
        case 'morning':
            filtered = filtered.filter(todo => {
                if (!todo.time) return false;
                const hour = parseInt(todo.time.split(':')[0]);
                return hour >= 6 && hour <= 11;
            });
            filtered.sort((a, b) => a.time.localeCompare(b.time));
            break;
        case 'afternoon':
            filtered = filtered.filter(todo => {
                if (!todo.time) return false;
                const hour = parseInt(todo.time.split(':')[0]);
                return hour >= 12 && hour <= 17;
            });
            filtered.sort((a, b) => a.time.localeCompare(b.time));
            break;
        case 'evening':
            filtered = filtered.filter(todo => {
                if (!todo.time) return false;
                const hour = parseInt(todo.time.split(':')[0]);
                return hour >= 18 && hour <= 23;
            });
            filtered.sort((a, b) => a.time.localeCompare(b.time));
            break;
    }
    
    return filtered;
}

/* ========================================
   Todoグループ削除
   ======================================== */

function openGroupModal() {
    const groupList = document.getElementById('groupList');
    groupList.innerHTML = ''; 
    
    if (todoGroups.length === 0) {
        groupList.innerHTML = '<li>グループはありません</li>';
    } else {
        todoGroups.forEach(group => {
            const li = document.createElement('li');
            li.textContent = group;
            
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'delete-group-btn';
            deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
            deleteBtn.onclick = () => deleteGroup(group);
            
            li.appendChild(deleteBtn);
            groupList.appendChild(li);
        });
    }
    
    document.getElementById('groupModal').classList.add('active');
}

function closeGroupModal() {
    document.getElementById('groupModal').classList.remove('active');
    updateTodoGroupOptions();
}

function deleteGroup(groupName) {
    if (confirm(`「${groupName}」グループを削除しますか？\nこのグループに設定されているTodoは「グループなし」になります。`)) {
        todoGroups = todoGroups.filter(g => g !== groupName);
        localStorage.setItem(STORAGE_KEYS.TODO_GROUPS, JSON.stringify(todoGroups));
        
        todos.forEach(todo => {
            if (todo.group === groupName) {
                todo.group = '';
            }
        });
        saveTodos();
        
        renderTodoList();
        openGroupModal(); 
    }
}


/* ========================================
   ゴミの日カレンダー
   ======================================== */

// モーダルを開くときに、ルール一覧も描画
function openGarbageModal() {
    document.getElementById('garbageDate').value = new Date().toISOString().split('T')[0];
    renderGarbageRuleList(); // ルール一覧を描画
    document.getElementById('garbageModal').classList.add('active');
}

function closeGarbageModal() {
    document.getElementById('garbageModal').classList.remove('active');
}

// ルールを分かりやすい日本語にフォーマットする
function formatGarbageRule(rule) {
    const dateObj = new Date(rule.startDate + 'T00:00:00');
    const dayName = dateObj.toLocaleDateString('ja-JP', { weekday: 'narrow' }); 
    const day = dateObj.getDate();
    const week = Math.floor((day - 1) / 7) + 1;

    let repeatText = '';
    
    switch (rule.repeat) {
        case 'none':
            repeatText = `[${rule.startDate}]`;
            break;
        case 'weekly':
            repeatText = `[毎週 ${dayName}曜]`;
            break;
        case 'monthly-date':
            repeatText = `[毎月 ${day}日]`;
            break;
        case 'monthly-day':
            repeatText = `[毎月 第${week} ${dayName}曜]`;
            break;
        // 追加ルール
        case 'weekly-tue-fri':
            repeatText = '[毎週 火・金曜]';
            break;
        case 'monthly-1-wed':
            repeatText = '[毎月 第1 水曜]';
            break;
        case 'monthly-1-3-mon':
            repeatText = '[毎月 第1・3 月曜]';
            break;
        case 'monthly-2-thu':
            repeatText = '[毎月 第2 木曜]';
            break;
        case 'monthly-2-4-5-mon':
            repeatText = '[毎月 第2・4・5 月曜]';
            break;
        case 'monthly-3-wed':
            repeatText = '[毎月 第3 水曜]';
            break;
        case 'monthly-3-thu':
            repeatText = '[毎月 第3 木曜]';
            break;
        case 'monthly-4-thu':
            repeatText = '[毎月 第4 木曜]';
            break;
        default:
            repeatText = '[不明なルール]';
    }
    return `${repeatText} ${rule.type}`;
}


// 保存ロジック（重複チェック＆閉じる）
function saveGarbageEvent() {
    const type = document.getElementById('garbageType').value;
    const repeatType = document.getElementById('garbageRepeatType').value;
    const dateStr = document.getElementById('garbageDate').value;

    if (!dateStr) {
        alert('日付を選択してください。');
        return;
    }

    const newGarbageEvent = {
        id: Date.now(),
        type: type,
        repeat: repeatType,
        startDate: dateStr
    };

    // 重複チェック
    const ruleString = formatGarbageRule(newGarbageEvent);
    const isDuplicate = garbageDays.some(rule => formatGarbageRule(rule) === ruleString);

    if (isDuplicate) {
        alert('同じ設定のルールが既に存在します：\n' + ruleString);
        return; // 追加しない
    }

    garbageDays.push(newGarbageEvent);
    saveGarbageDays();
    renderCalendar();
    closeGarbageModal(); // 保存したら閉じる
}

// 新しい繰り返しルールを判定
function getGarbageEventsForDate(dateStr, dateObj) {
    const events = [];
    
    const year = dateObj.getFullYear();
    const month = dateObj.getMonth(); // 0-11
    const date = dateObj.getDate(); // 1-31
    const dayOfWeek = dateObj.getDay(); // 0=日, 1=月, 2=火, 3=水, 4=木, 5=金, 6=土
    const weekOfMonth = Math.floor((date - 1) / 7) + 1; // 1-5

    garbageDays.forEach(event => {
        const startDate = new Date(event.startDate + 'T00:00:00'); 
        if (dateObj < startDate) {
            return; 
        }

        const startDay = startDate.getDate();
        const startDayOfWeek = startDate.getDay();
        const startWeekOfMonth = Math.floor((startDay - 1) / 7) + 1;

        let match = false;

        switch (event.repeat) {
            case 'none':
                if (event.startDate === dateStr) match = true;
                break;
            case 'weekly':
                if (dayOfWeek === startDayOfWeek) match = true;
                break;
            case 'monthly-date':
                if (date === startDay) match = true;
                break;
            case 'monthly-day':
                if (dayOfWeek === startDayOfWeek && weekOfMonth === startWeekOfMonth) match = true;
                break;
            
            // 追加ルール
            case 'weekly-tue-fri': // 毎週 火・金曜日
                if (dayOfWeek === 2 || dayOfWeek === 5) match = true;
                break;
            case 'monthly-1-wed': // 毎月 第1 水曜日
                if (dayOfWeek === 3 && weekOfMonth === 1) match = true;
                break;
            case 'monthly-1-3-mon': // 毎月 第1・第3 月曜日
                if (dayOfWeek === 1 && (weekOfMonth === 1 || weekOfMonth === 3)) match = true;
                break;
            case 'monthly-2-thu': // 毎月 第2 木曜日
                if (dayOfWeek === 4 && weekOfMonth === 2) match = true;
                break;
            case 'monthly-2-4-5-mon': // 毎月 第2・第4・第5 月曜日
                if (dayOfWeek === 1 && (weekOfMonth === 2 || weekOfMonth === 4 || weekOfMonth === 5)) match = true;
                break;
            case 'monthly-3-wed': // 毎月 第3 水曜日
                if (dayOfWeek === 3 && weekOfMonth === 3) match = true;
                break;
            case 'monthly-3-thu': // 毎月 第3 木曜日
                if (dayOfWeek === 4 && weekOfMonth === 3) match = true;
                break;
            case 'monthly-4-thu': // 毎月 第4 木曜日
                if (dayOfWeek === 4 && weekOfMonth === 4) match = true;
                break;
        }

        if (match) {
            events.push({
                title: event.type,
                time: null,
                isGarbage: true
            });
        }
    });

    return events;
}

// ゴミの日ルール一覧をモーダル内に描画する
function renderGarbageRuleList() {
    const container = document.getElementById('garbageRuleListContainer');
    container.innerHTML = ''; // 初期化

    if (garbageDays.length === 0) {
        container.innerHTML = '<h3>現在のルール</h3><p>設定済みのルールはありません</p>';
        return;
    }

    let html = '<h3>現在のルール</h3><ul class="garbage-rule-list">';
    garbageDays.forEach(rule => {
        html += `
            <li>
                <span>${formatGarbageRule(rule)}</span>
                <button class="delete-rule-btn" onclick="deleteGarbageRule(${rule.id})" title="削除">
                    <i class="fas fa-trash"></i>
                </button>
            </li>
        `;
    });
    html += '</ul>';
    container.innerHTML = html;
}

// ゴミの日ルールを削除する
function deleteGarbageRule(ruleId) {
    const rule = garbageDays.find(r => r.id === ruleId);
    if (!rule) return;
    
    if (confirm(`このルールを削除しますか？\n「${formatGarbageRule(rule)}」`)) {
        garbageDays = garbageDays.filter(r => r.id !== ruleId);
        saveGarbageDays();
        renderCalendar(); // カレンダーを再描画
        renderGarbageRuleList(); // モーダル内のリストも再描画
    }
}


/* ========================================
   ★新機能：イベント詳細モーダル
   ======================================== */
function openEventDetailModal(todoId) {
    const todo = todos.find(t => t.id === todoId);
    if (!todo) return;

    currentDetailTodoId = todo.id; // 編集ボタン用にIDを保存

    document.getElementById('detailTitle').textContent = todo.title || '（タイトルなし）';
    
    let dateTime = todo.dueDate || '';
    if (todo.time) {
        dateTime += ` ${todo.time}`;
    }
    document.getElementById('detailDateTime').textContent = dateTime || '（日時未設定）';
    
    document.getElementById('detailGroup').textContent = todo.group || '（グループなし）';
    
    // メモ欄（URLを自動でリンクに変換）
    const notesText = todo.notes || '（メモなし）';
    document.getElementById('detailNotes').innerHTML = convertURLsToLinks(notesText);

    document.getElementById('eventDetailModal').classList.add('active');
}

function closeEventDetailModal() {
    document.getElementById('eventDetailModal').classList.remove('active');
    currentDetailTodoId = null;
}

// メモ欄のURLをリンクに変換するヘルパー関数
function convertURLsToLinks(text) {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.replace(urlRegex, '<a href="$1" target="_blank">$1</a>');
}


/* ========================================
   スプレッドシート管理
   ======================================== */

function openSheetModal() {
    document.getElementById('sheetModal').classList.add('active');
}

function closeSheetModal() {
    document.getElementById('sheetModal').classList.remove('active');
    clearSheetForm();
}

function saveSpreadsheet() {
    const name = document.getElementById('sheetName').value.trim();
    const url = document.getElementById('sheetUrl').value.trim();
    
    if (!name || !url) {
        alert('シート名とURLを入力してください');
        return;
    }
    
    const sheetId = extractSpreadsheetId(url);
    
    if (!sheetId) {
        alert('有効なGoogleスプレッドシートのURLを入力してください');
        return;
    }
    
    spreadsheets.push({ name, id: sheetId });
    localStorage.setItem(STORAGE_KEYS.SPREADSHEETS, JSON.stringify(spreadsheets));
    
    renderSpreadsheetTabs();
    closeSheetModal();
}

function extractSpreadsheetId(url) {
    const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    return match ? match[1] : url;
}

function renderSpreadsheetTabs() {
    const tabsContainer = document.getElementById('sheetTabs');
    const contentContainer = document.getElementById('sheetContent');
    
    if (spreadsheets.length === 0) {
        tabsContainer.innerHTML = '';
        contentContainer.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-table"></i>
                <p>スプレッドシートを追加してください</p>
            </div>
        `;
        return;
    }
    
    tabsContainer.innerHTML = spreadsheets.map((sheet, index) => `
        <div class="sheet-tab ${index === 0 ? 'active' : ''}" onclick="showSpreadsheet(${index})">
            ${sheet.name}
            <button class="delete-sheet" onclick="event.stopPropagation(); deleteSpreadsheet(${index})">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `).join('');
    
    if (spreadsheets.length > 0) {
        showSpreadsheet(0);
    }
}

function showSpreadsheet(index) {
    document.querySelectorAll('.sheet-tab').forEach((tab, i) => {
        tab.classList.toggle('active', i === index);
    });
    
    const sheet = spreadsheets[index];
    const contentContainer = document.getElementById('sheetContent');
    
    contentContainer.innerHTML = `
        <iframe src="https://docs.google.com/spreadsheets/d/${sheet.id}/edit?embedded=true"></iframe>
    `;
}

function deleteSpreadsheet(index) {
    if (confirm('このスプレッドシートを削除しますか?')) {
        spreadsheets.splice(index, 1);
        localStorage.setItem(STORAGE_KEYS.SPREADSHEETS, JSON.stringify(spreadsheets));
        renderSpreadsheetTabs();
    }
}

function clearSheetForm() {
    document.getElementById('sheetName').value = '';
    document.getElementById('sheetUrl').value = '';
}

/* ========================================
   Google API関連
   ======================================== */

function gapiLoaded() {
    console.log('GAPI loaded');
    gapi.load('client', initializeGapiClient);
}

async function initializeGapiClient() {
    if (!isGoogleAPIConfigured()) {
        console.log('Google API not configured');
        return;
    }
    
    try {
        await gapi.client.init({
            apiKey: CONFIG.API_KEY,
            discoveryDocs: [
                'https://www.googleapis.com/discovery/v1/apis/gmail/v1/rest',
                'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest',
                'https://www.googleapis.com/discovery/v1/apis/tasks/v1/rest'
            ]
        });
        gapiInited = true;
        console.log('GAPI client initialized');
        maybeEnableButtons();
    } catch (error) {
        console.error('Error initializing GAPI client:', error);
    }
}

function gisLoaded() {
    if (!isGoogleAPIConfigured()) {
        console.log('Google API not configured');
        return;
    }
    
    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CONFIG.CLIENT_ID,
        scope: CONFIG.SCOPES,
        callback: (response) => {
            if (response.error) {
                console.error('Token error:', response);
                return;
            }
            accessToken = response.access_token;
            console.log('Access token received');
            updateGmailCount(); 
        }
    });
    gisInited = true;
    console.log('GIS loaded');
    maybeEnableButtons();
}

function maybeEnableButtons() {
    if (gapiInited && gisInited && isGoogleAPIConfigured()) {
        console.log('Ready for Google API calls');
    }
}

function handleAuthClick() {
    if (!tokenClient) {
        console.error('Token client not initialized');
        return;
    }
    
    if (accessToken === null) {
        tokenClient.requestAccessToken({ prompt: 'consent' });
    } else {
        tokenClient.requestAccessToken({ prompt: 'consent' }); 
    }
}

async function updateGmailCount() {
    if (!isGoogleAPIConfigured() || !gapiInited || !accessToken) {
        console.log('Cannot update Gmail count: Not configured or not authenticated.');
        document.getElementById('unreadCount').textContent = '0';
        return;
    }
    
    try {
        const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages?labelIds=INBOX&labelIds=UNREAD&labelIds=CATEGORY_PERSONAL&maxResults=1', {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            const unreadCount = data.resultSizeEstimate || 0;
            document.getElementById('unreadCount').textContent = unreadCount;
            console.log('Gmail unread count updated:', unreadCount);
        } else {
            if (response.status === 401) {
                accessToken = null;
                console.log('Access token expired or invalid. Ready for re-authentication.');
            }
            document.getElementById('unreadCount').textContent = '0';
        }
    } catch (error) {
        console.error('Gmail fetch error:', error);
        document.getElementById('unreadCount').textContent = '0';
    }
}

// Googleカレンダーにイベントを追加
async function addToGoogleCalendar(todo) {
    if (!isGoogleAPIConfigured() || !gapiInited || !accessToken) {
        console.log('Google Calendar API not configured');
        return false;
    }
    
    if (!todo.dueDate) {
        return false;
    }
    
    try {
        const event = {
            summary: todo.title,
            description: todo.notes || '',
            start: {},
            end: {}
        };
        
        if (todo.time) {
            // 時間指定あり
            const startDateTime = `${todo.dueDate}T${todo.time}:00`;
            const endTime = addHour(todo.time);
            const endDateTime = `${todo.dueDate}T${endTime}:00`;
            
            event.start.dateTime = startDateTime;
            event.start.timeZone = 'Asia/Tokyo';
            event.end.dateTime = endDateTime;
            event.end.timeZone = 'Asia/Tokyo';
        } else {
            // 終日イベント
            event.start.date = todo.dueDate;
            event.end.date = todo.dueDate;
        }
        
        const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(event)
        });
        
        if (response.ok) {
            console.log('Event added to Google Calendar');
            return true;
        } else {
            console.error('Failed to add event to calendar');
            return false;
        }
    } catch (error) {
        console.error('Calendar add error:', error);
        return false;
    }
}

// Google Tasksに追加
async function addToGoogleTasks(todo) {
    if (!accessToken) {
        console.log('Not authenticated');
        return false;
    }
    
    try {
        const task = {
            title: todo.title,
            notes: `グループ: ${todo.group}\n${todo.notes || ''}`,
            due: todo.dueDate ? `${todo.dueDate}T00:00:00Z` : undefined
        };
        
        const response = await fetch('https://tasks.googleapis.com/tasks/v1/lists/@default/tasks', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(task)
        });
        
        if (response.ok) {
            console.log('✅ Google Tasksに追加されました');
            return true;
        } else {
            console.error('Google Tasksへの追加に失敗:', await response.text());
            return false;
        }
    } catch (error) {
        console.error('Google Tasks追加エラー:', error);
        return false;
    }
}

// 時間に1時間追加（終了時刻用）
function addHour(timeString) {
    const [hours, minutes] = timeString.split(':').map(Number);
    const newHours = (hours + 1) % 24;
    return `${String(newHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/* ========================================
   初期データ読み込み
   ======================================== */

window.addEventListener('load', () => {
    renderTodoList();
});
