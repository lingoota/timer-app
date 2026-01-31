// Firebase 資料操作模組
// 此檔案負責所有與 Firestore 的資料讀寫操作

import { db } from './firebase-config.js';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  addDoc,
  query,
  where,
  getDocs,
  serverTimestamp,
  increment
} from 'firebase/firestore';

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
 * @param {string} userId - 使用者 ID ('pinyu' 或 'pinrong')
 */
export async function initializeUser(userId) {
  try {
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
      // 使用者不存在，建立初始資料
      await setDoc(userRef, {
        totalUsage: 0,
        todayUsage: 0,
        timerCount: 0,
        lastUpdate: serverTimestamp(),
        createdAt: serverTimestamp()
      });
      console.log(`✅ 初始化使用者: ${userId}`);
    }

    return true;
  } catch (error) {
    console.error(`❌ 初始化使用者失敗 (${userId}):`, error);
    return false;
  }
}

/**
 * 取得使用者的統計資料
 * @param {string} userId - 使用者 ID ('pinyu' 或 'pinrong')
 * @returns {Object} 使用者統計資料
 */
export async function getUserStats(userId) {
  try {
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
    console.error(`❌ 取得使用者統計失敗 (${userId}):`, error);
    return {
      totalUsage: 0,
      todayUsage: 0,
      timerCount: 0
    };
  }
}

/**
 * 記錄計時活動
 * @param {string} userId - 使用者 ID ('pinyu' 或 'pinrong')
 * @param {number} duration - 計時時長（分鐘）
 * @param {string} activityType - 活動類型（遊戲、YouTube 等）
 */
export async function recordActivity(userId, duration, activityType) {
  try {
    const dateString = getTodayDateString();
    const timeString = getCurrentTimeString();

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
        user: userId === 'pinyu' ? '品瑜' : '品榕',
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
          user: userId === 'pinyu' ? '品瑜' : '品榕',
          timestamp: new Date().toISOString()
        }],
        createdAt: serverTimestamp(),
        lastUpdate: serverTimestamp()
      });
    }

    console.log(`✅ 記錄活動成功: ${userId} - ${activityType} (${duration}分鐘)`);
    return true;
  } catch (error) {
    console.error(`❌ 記錄活動失敗 (${userId}):`, error);
    return false;
  }
}

/**
 * 取得今天的活動記錄
 * @param {string} userId - 使用者 ID ('pinyu' 或 'pinrong')
 * @returns {Array} 今天的活動記錄陣列
 */
export async function getTodayActivities(userId) {
  try {
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
    console.error(`❌ 取得今天活動失敗 (${userId}):`, error);
    return [];
  }
}

/**
 * 取得今天所有使用者的活動統計（用於圖表）
 * @returns {Object} 包含所有使用者今日統計的物件
 */
export async function getTodayStats() {
  try {
    const dateString = getTodayDateString();
    const stats = {
      pinyu: { totalTime: 0, activities: {} },
      pinrong: { totalTime: 0, activities: {} }
    };

    // 取得品瑜的資料
    const pinyuRef = doc(db, 'users', 'pinyu', 'activities', dateString);
    const pinyuDoc = await getDoc(pinyuRef);
    if (pinyuDoc.exists()) {
      const data = pinyuDoc.data();
      stats.pinyu.totalTime = data.totalTime || 0;

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

      // 統計各活動類型的時間
      (data.records || []).forEach(record => {
        const type = record.type;
        stats.pinrong.activities[type] = (stats.pinrong.activities[type] || 0) + record.duration;
      });
    }

    return stats;
  } catch (error) {
    console.error('❌ 取得今天統計失敗:', error);
    return {
      pinyu: { totalTime: 0, activities: {} },
      pinrong: { totalTime: 0, activities: {} }
    };
  }
}

/**
 * 重置今日使用時間（每天重置）
 * @param {string} userId - 使用者 ID
 */
export async function resetTodayUsage(userId) {
  try {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      todayUsage: 0,
      lastUpdate: serverTimestamp()
    });
    console.log(`✅ 重置今日使用時間: ${userId}`);
    return true;
  } catch (error) {
    console.error(`❌ 重置今日使用時間失敗 (${userId}):`, error);
    return false;
  }
}