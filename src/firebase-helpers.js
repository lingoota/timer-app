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

    return { db: window.firebaseDB, functions: window.firestoreFunctions };
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
        console.error(`❌ Firebase: 取得今天活動失敗 (${userId}):`, error);
        return [];
    }
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
            stats.pinyu.totalTime = data.totalTime || 0;
            stats.pinyu.records = data.records || [];

            // 統計各活動類型的時間
            (data.records || []).forEach(record => {
                const type = record.type;
                stats.pinyu.activities[type] = (stats.pinyu.activities[type] || 0) + record.duration;
            });
        }

        // 取得品榕的資料
        const pinrongRef = doc(db, 'users', 'pinrong', 'activities', dateString);
        const pinrongDoc = await getDoc(pinrongRef);
        if (pinrongDoc.exists()) {
            const data = pinrongDoc.data();
            stats.pinrong.totalTime = data.totalTime || 0;
            stats.pinrong.records = data.records || [];

            // 統計各活動類型的時間
            (data.records || []).forEach(record => {
                const type = record.type;
                stats.pinrong.activities[type] = (stats.pinrong.activities[type] || 0) + record.duration;
            });
        }

        console.log('📊 Firebase: 今日統計', stats);
        return stats;
    } catch (error) {
        console.error('❌ Firebase: 取得今天統計失敗:', error);
        return {
            pinyu: { totalTime: 0, activities: {}, records: [] },
            pinrong: { totalTime: 0, activities: {}, records: [] }
        };
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
        const liveStatusRef = firebase.firestore()
            .collection('live-timer-status')
            .doc(userId);

        if (timerState.isRunning) {
            await liveStatusRef.set({
                isRunning: true,
                startTime: timerState.startTime,
                totalDuration: timerState.totalDuration,
                category: timerState.category,
                lastUpdate: firebase.firestore.FieldValue.serverTimestamp()
            });
            console.log(`✅ Firebase: ${userId} 即時計時狀態已更新`);
        } else {
            // 不在計時時，清除狀態
            await liveStatusRef.set({
                isRunning: false,
                lastUpdate: firebase.firestore.FieldValue.serverTimestamp()
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
        const liveStatusCollection = firebase.firestore().collection('live-timer-status');

        const [pinyuDoc, pinrongDoc] = await Promise.all([
            liveStatusCollection.doc('pinyu').get(),
            liveStatusCollection.doc('pinrong').get()
        ]);

        const pinyuStatus = pinyuDoc.exists ? pinyuDoc.data() : { isRunning: false };
        const pinrongStatus = pinrongDoc.exists ? pinrongDoc.data() : { isRunning: false };

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

// 將函數掛載到 window 物件，供 renderer.js 使用
window.initializeUser = initializeUser;
window.getUserStats = getUserStats;
window.recordActivity = recordActivity;
window.getTodayActivities = getTodayActivities;
window.getTodayStats = getTodayStats;
window.updateLiveTimerStatus = updateLiveTimerStatus;
window.getLiveTimerStatus = getLiveTimerStatus;