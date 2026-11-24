// Firebase 輔助函數 - 供 renderer.js 使用
// 此檔案提供簡化的 Firebase 操作介面

/**
 * 等待 Firebase 初始化完成
 */
async function waitForFirebase() {
    let attempts = 0;
    while (!window.firebaseDB && attempts < 50) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
    }

    if (!window.firebaseDB) {
        throw new Error('Firebase 初始化失敗');
    }

    return { db: window.firebaseDB, functions: guardedFunctions() };
}

// ---------- hang protection ----------
// Incident 2026-11-22..24: on one PC getDoc() stopped settling (never resolved, never
// rejected) for two days. Record writes are a serial queue that reads first, so every
// record queued behind the hung one; the daily log's "refreshing" flag stayed set, so the
// screen froze on 11-22. setDoc-only writes (rest sync) kept working. A forced restart
// flushed all queued records. So: every Firestore call gets a timeout, consecutive
// timeouts trigger a network reset, and the UI can ask how long since the last success.
const FB_TIMEOUT_MS = 15000;
const FB_RECONNECT_AFTER = 2;            // consecutive timeouts before resetting the network
const FB_RECONNECT_COOLDOWN_MS = 60000;
const fbHealth = { lastOkAt: 0, consecutiveTimeouts: 0, lastReconnectAt: 0, reconnecting: false };
let guardedCache = null;

function withTimeout(promise, label) {
    let timer;
    const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => {
            const err = new Error(`Firebase ${label} 逾時 (${FB_TIMEOUT_MS / 1000}s)`);
            err.isTimeout = true;
            reject(err);
        }, FB_TIMEOUT_MS);
    });
    return Promise.race([promise, timeout]).then(
        (value) => {
            clearTimeout(timer);
            fbHealth.lastOkAt = Date.now();
            fbHealth.consecutiveTimeouts = 0;
            return value;
        },
        (err) => {
            clearTimeout(timer);
            if (err && err.isTimeout) {
                fbHealth.consecutiveTimeouts++;
                maybeReconnect();
            }
            throw err;
        }
    );
}

// Drop and re-open Firestore's streams; a wedged listen stream is the likely cause of a
// getDoc that never settles. Fire-and-forget: callers already failed with a timeout.
async function maybeReconnect() {
    const f = window.firestoreFunctions;
    const db = window.firebaseDB;
    if (!f || !db || !f.disableNetwork || !f.enableNetwork) return;
    if (fbHealth.reconnecting || fbHealth.consecutiveTimeouts < FB_RECONNECT_AFTER) return;
    if (Date.now() - fbHealth.lastReconnectAt < FB_RECONNECT_COOLDOWN_MS) return;
    fbHealth.reconnecting = true;
    fbHealth.lastReconnectAt = Date.now();
    console.warn('⚠️ Firebase 連續逾時，重新建立連線');
    const step = (p) => Promise.race([p, new Promise(r => setTimeout(r, FB_TIMEOUT_MS))]);
    try {
        await step(f.disableNetwork(db));
        await step(f.enableNetwork(db));
    } catch (e) {
        console.error('❌ Firebase 重新連線失敗:', e);
    } finally {
        fbHealth.reconnecting = false;
    }
}

// Same Firestore namespace, with every call that talks to the server wrapped in a timeout.
function guardedFunctions() {
    if (guardedCache) return guardedCache;
    const raw = window.firestoreFunctions;
    if (!raw) return raw;
    const wrapped = Object.assign({}, raw);
    ['getDoc', 'getDocs', 'setDoc', 'updateDoc', 'addDoc', 'deleteDoc'].forEach(name => {
        if (typeof raw[name] === 'function') {
            wrapped[name] = (...args) => withTimeout(raw[name](...args), name);
        }
    });
    guardedCache = wrapped;
    return wrapped;
}

// Milliseconds since the last Firestore call that succeeded (Infinity before the first).
function firebaseStaleMs() {
    return fbHealth.lastOkAt ? Date.now() - fbHealth.lastOkAt : Infinity;
}

// A day's total from its records, not the totalTime counter: a write that timed out but
// still committed later can be retried, and the retry's increment() would double-count.
// arrayUnion already dedupes the identical record. Days with legacy records (no `kind`,
// written before beta.23) fall back to the stored counter.
function dayTotalSec(data) {
    const records = data.records || [];
    if (records.length === 0 || records.some(r => !r.kind)) return data.totalTime || 0;
    return records.filter(isCountedRecord).reduce((s, r) => s + (r.duration || 0), 0);
}

/**
 * 取得今天的日期字串 (格式: YYYY-MM-DD)
 */
function getTodayDateString() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * 取得現在的時間字串 (格式: HH:MM)
 */
function getCurrentTimeString() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
}

/**
 * 初始化使用者資料（如果不存在）
 */
async function initializeUser(userId) {
    try {
        const { db, functions } = await waitForFirebase();
        const { doc, getDoc, setDoc, serverTimestamp } = functions;

        const userRef = doc(db, 'users', userId);
        const userDoc = await getDoc(userRef);

        if (!userDoc.exists()) {
            await setDoc(userRef, {
                totalUsage: 0,
                todayUsage: 0,
                timerCount: 0,
                lastUpdate: serverTimestamp(),
                createdAt: serverTimestamp()
            });
            console.log(`✅ Firebase: 初始化使用者 ${userId}`);
        }

        return true;
    } catch (error) {
        console.error(`❌ Firebase: 初始化使用者失敗 (${userId}):`, error);
        return false;
    }
}

/**
 * 取得使用者的統計資料
 */
async function getUserStats(userId) {
    try {
        const { db, functions } = await waitForFirebase();
        const { doc, getDoc } = functions;

        const userRef = doc(db, 'users', userId);
        const userDoc = await getDoc(userRef);

        if (userDoc.exists()) {
            return userDoc.data();
        } else {
            // 使用者不存在，先初始化
            await initializeUser(userId);
            return {
                totalUsage: 0,
                todayUsage: 0,
                timerCount: 0
            };
        }
    } catch (error) {
        console.error(`❌ Firebase: 取得使用者統計失敗 (${userId}):`, error);
        return {
            totalUsage: 0,
            todayUsage: 0,
            timerCount: 0
        };
    }
}

/**
 * 記錄計時活動
 */
async function recordActivity(userId, duration, activityType) {
    try {
        const { db, functions } = await waitForFirebase();
        const { doc, getDoc, setDoc, updateDoc, serverTimestamp, increment } = functions;

        const dateString = getTodayDateString();
        const timeString = getCurrentTimeString();
        const userName = userId === 'pinyu' ? '品瑜' : '品榕';

        console.log(`📝 Firebase: 開始記錄活動 - ${userName}, ${activityType}, ${duration}分鐘`);

        // 1. 更新使用者統計
        const userRef = doc(db, 'users', userId);
        await updateDoc(userRef, {
            totalUsage: increment(duration),
            todayUsage: increment(duration),
            timerCount: increment(1),
            lastUpdate: serverTimestamp()
        });

        // 2. 記錄活動到今天的文檔
        const activityRef = doc(db, 'users', userId, 'activities', dateString);
        const activityDoc = await getDoc(activityRef);

        if (activityDoc.exists()) {
            // 今天的文檔已存在，追加記錄
            const data = activityDoc.data();
            const records = data.records || [];
            records.push({
                time: timeString,
                duration: duration,
                type: activityType,
                user: userName,
                timestamp: new Date().toISOString()
            });

            await updateDoc(activityRef, {
                records: records,
                totalTime: increment(duration),
                lastUpdate: serverTimestamp()
            });
        } else {
            // 今天的文檔不存在，建立新文檔
            await setDoc(activityRef, {
                date: dateString,
                totalTime: duration,
                records: [{
                    time: timeString,
                    duration: duration,
                    type: activityType,
                    user: userName,
                    timestamp: new Date().toISOString()
                }],
                createdAt: serverTimestamp(),
                lastUpdate: serverTimestamp()
            });
        }

        console.log(`✅ Firebase: 記錄活動成功`);
        return true;
    } catch (error) {
        console.error(`❌ Firebase: 記錄活動失敗 (${userId}):`, error);
        return false;
    }
}

/**
 * Write one record produced by the main-process usage guard.
 * Idempotent by record.id because the guard re-sends unacknowledged records.
 * Only `counted` records add to totals; class / event records are listed but not summed.
 */
async function writeGuardRecord(record) {
    const { db, functions } = await waitForFirebase();
    const { doc, getDoc, setDoc, updateDoc, serverTimestamp, increment, arrayUnion } = functions;

    const userId = record.userId;
    const counted = record.counted !== false;
    const amount = counted ? record.duration : 0;
    const activityRef = doc(db, 'users', userId, 'activities', record.dateKey);
    const activityDoc = await getDoc(activityRef);

    if (activityDoc.exists()) {
        const records = activityDoc.data().records || [];
        if (records.some(r => r.id === record.id)) return true; // already written
    }
    // merge + arrayUnion + increment: atomic append, also creates the day's doc if missing
    await setDoc(activityRef, {
        date: record.dateKey,
        records: arrayUnion(record),
        totalTime: increment(amount),
        lastUpdate: serverTimestamp()
    }, { merge: true });

    if (counted) {
        const userRef = doc(db, 'users', userId);
        const userDoc = await getDoc(userRef);
        if (!userDoc.exists()) await initializeUser(userId);
        await updateDoc(userRef, {
            totalUsage: increment(amount),
            todayUsage: increment(amount),
            timerCount: increment(record.kind === 'timed' ? 1 : 0),
            lastUpdate: serverTimestamp()
        });
    }
    return true;
}

/**
 * Rest end time mirrored to Firebase so deleting the local guard file does not end a rest.
 */
async function setRestEndAt(userId, restEndAt) {
    try {
        const { db, functions } = await waitForFirebase();
        const { doc, setDoc, serverTimestamp } = functions;
        await setDoc(doc(db, 'users', userId), { restEndAt, lastUpdate: serverTimestamp() }, { merge: true });
    } catch (error) {
        console.error(`❌ Firebase: 同步休息時間失敗 (${userId}):`, error);
    }
}

async function getRestEndAt(userId) {
    try {
        const { db, functions } = await waitForFirebase();
        const { doc, getDoc } = functions;
        const userDoc = await getDoc(doc(db, 'users', userId));
        return userDoc.exists() ? (userDoc.data().restEndAt || 0) : 0;
    } catch (error) {
        console.error(`❌ Firebase: 讀取休息時間失敗 (${userId}):`, error);
        return 0;
    }
}

/**
 * 取得今天的活動記錄
 */
async function getTodayActivities(userId) {
    try {
        const { db, functions } = await waitForFirebase();
        const { doc, getDoc } = functions;

        const dateString = getTodayDateString();
        const activityRef = doc(db, 'users', userId, 'activities', dateString);
        const activityDoc = await getDoc(activityRef);

        if (activityDoc.exists()) {
            const data = activityDoc.data();
            return data.records || [];
        } else {
            return [];
        }
    } catch (error) {
        // Rethrow: returning [] would blank the daily log ("no records yet") on a timeout.
        console.error(`❌ Firebase: 取得今天活動失敗 (${userId}):`, error);
        throw error;
    }
}

// Legacy records (before beta.23) have no `counted` field and always counted.
function isCountedRecord(record) {
    return record.counted !== false;
}

// A "session" for the 次數 display: timed sessions only (legacy records were all timed).
function isTimedRecord(record) {
    return !record.kind || record.kind === 'timed';
}

/**
 * 取得今天所有使用者的活動統計（用於圖表）
 */
async function getTodayStats() {
    try {
        const { db, functions } = await waitForFirebase();
        const { doc, getDoc } = functions;

        const dateString = getTodayDateString();
        const stats = {
            pinyu: { totalTime: 0, activities: {}, records: [] },
            pinrong: { totalTime: 0, activities: {}, records: [] }
        };

        // 取得品瑜的資料
        const pinyuRef = doc(db, 'users', 'pinyu', 'activities', dateString);
        const pinyuDoc = await getDoc(pinyuRef);
        if (pinyuDoc.exists()) {
            const data = pinyuDoc.data();
            stats.pinyu.totalTime = dayTotalSec(data);
            stats.pinyu.records = data.records || [];

            // 統計各活動類型的時間（線上課、事件記錄不算）
            (data.records || []).filter(isCountedRecord).forEach(record => {
                const type = record.type;
                stats.pinyu.activities[type] = (stats.pinyu.activities[type] || 0) + record.duration;
            });
        }

        // 取得品榕的資料
        const pinrongRef = doc(db, 'users', 'pinrong', 'activities', dateString);
        const pinrongDoc = await getDoc(pinrongRef);
        if (pinrongDoc.exists()) {
            const data = pinrongDoc.data();
            stats.pinrong.totalTime = dayTotalSec(data);
            stats.pinrong.records = data.records || [];

            // 統計各活動類型的時間（線上課、事件記錄不算）
            (data.records || []).filter(isCountedRecord).forEach(record => {
                const type = record.type;
                stats.pinrong.activities[type] = (stats.pinrong.activities[type] || 0) + record.duration;
            });
        }

        console.log('📊 Firebase: 今日統計', stats);
        return stats;
    } catch (error) {
        // Rethrow: zeros would overwrite the last good numbers on screen with a timeout.
        console.error('❌ Firebase: 取得今天統計失敗:', error);
        throw error;
    }
}

/**
 * 更新使用者的即時計時狀態到 Firebase
 * @param {string} userId - 使用者 ID ('pinyu' 或 'pinrong')
 * @param {Object} timerState - 計時狀態
 * @param {boolean} timerState.isRunning - 是否正在計時
 * @param {number} timerState.startTime - 開始時間 (timestamp)
 * @param {number} timerState.totalDuration - 總時長 (分鐘)
 * @param {string} timerState.category - 活動類別
 */
async function updateLiveTimerStatus(userId, timerState) {
    try {
        const { db, functions } = await waitForFirebase();
        const { doc, setDoc, serverTimestamp } = functions;

        const liveStatusRef = doc(db, 'live-timer-status', userId);

        if (timerState.isRunning) {
            await setDoc(liveStatusRef, {
                isRunning: true,
                startTime: timerState.startTime,
                totalDuration: timerState.totalDuration,
                category: timerState.category,
                lastUpdate: serverTimestamp()
            });
            console.log(`✅ Firebase: ${userId} 即時計時狀態已更新`);
        } else {
            await setDoc(liveStatusRef, {
                isRunning: false,
                lastUpdate: serverTimestamp()
            });
            console.log(`✅ Firebase: ${userId} 已停止計時`);
        }
    } catch (error) {
        console.error(`❌ Firebase: 更新 ${userId} 即時計時狀態失敗:`, error);
    }
}

/**
 * 取得所有使用者的即時計時狀態
 * @returns {Promise<Object>} 包含 pinyu 和 pinrong 的計時狀態
 */
async function getLiveTimerStatus() {
    try {
        const { db, functions } = await waitForFirebase();
        const { doc, getDoc } = functions;

        const [pinyuDoc, pinrongDoc] = await Promise.all([
            getDoc(doc(db, 'live-timer-status', 'pinyu')),
            getDoc(doc(db, 'live-timer-status', 'pinrong'))
        ]);

        const pinyuStatus = pinyuDoc.exists() ? pinyuDoc.data() : { isRunning: false };
        const pinrongStatus = pinrongDoc.exists() ? pinrongDoc.data() : { isRunning: false };

        return {
            pinyu: pinyuStatus,
            pinrong: pinrongStatus
        };
    } catch (error) {
        console.error('❌ Firebase: 取得即時計時狀態失敗:', error);
        return {
            pinyu: { isRunning: false },
            pinrong: { isRunning: false }
        };
    }
}

/**
 * 取得近 N 天的每日統計資料（用於歷史趨勢圖）
 * @param {number} days - 要查詢的天數（例如 7 或 30）
 * @returns {Array} 每天的統計資料 [{ date, pinyu: totalTime, pinrong: totalTime }]
 */
async function getHistoryStats(days) {
    try {
        const { db, functions } = await waitForFirebase();
        const { doc, getDoc } = functions;

        const results = [];
        const today = new Date();

        for (let i = days - 1; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(today.getDate() - i);
            const dateString = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

            let pinyuTime = 0;
            let pinrongTime = 0;

            try {
                const [pinyuDoc, pinrongDoc] = await Promise.all([
                    getDoc(doc(db, 'users', 'pinyu', 'activities', dateString)),
                    getDoc(doc(db, 'users', 'pinrong', 'activities', dateString))
                ]);
                if (pinyuDoc.exists()) pinyuTime = dayTotalSec(pinyuDoc.data());
                if (pinrongDoc.exists()) pinrongTime = dayTotalSec(pinrongDoc.data());
            } catch (e) {
                // 某天資料讀取失敗，跳過
            }

            results.push({
                date: dateString,
                label: `${date.getMonth() + 1}/${date.getDate()}`,
                pinyu: Math.round(pinyuTime / 60),
                pinrong: Math.round(pinrongTime / 60)
            });
        }

        console.log(`📊 Firebase: 近 ${days} 天歷史統計`, results);
        return results;
    } catch (error) {
        console.error('❌ Firebase: 取得歷史統計失敗:', error);
        return [];
    }
}

// 將函數掛載到 window 物件，供 renderer.js 使用
window.initializeUser = initializeUser;
window.getUserStats = getUserStats;
window.recordActivity = recordActivity;
window.getTodayActivities = getTodayActivities;
window.getTodayStats = getTodayStats;
window.getHistoryStats = getHistoryStats;
window.updateLiveTimerStatus = updateLiveTimerStatus;
window.getLiveTimerStatus = getLiveTimerStatus;
window.writeGuardRecord = writeGuardRecord;
window.setRestEndAt = setRestEndAt;
window.getRestEndAt = getRestEndAt;
window.isTimedRecord = isTimedRecord;
window.firebaseStaleMs = firebaseStaleMs;