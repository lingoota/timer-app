// Firebase 設定和初始化模組
// 此檔案負責初始化 Firebase 並提供 Firestore 實例

import { initializeApp } from 'firebase/app';
import { getFirestore, enableIndexedDbPersistence } from 'firebase/firestore';

// Firebase 專案設定
const firebaseConfig = {
  apiKey: "AIzaSyDATiNoPRZ68f65YdKoJcbpIIqbRxWw7oo",
  authDomain: "timer-app-9271b.firebaseapp.com",
  projectId: "timer-app-9271b",
  storageBucket: "timer-app-9271b.firebasestorage.app",
  messagingSenderId: "445700137847",
  appId: "1:445700137847:web:c6af3effc718aefb587772"
};

// 初始化 Firebase
const app = initializeApp(firebaseConfig);

// 初始化 Firestore
const db = getFirestore(app);

// 啟用離線持久化（讓應用在離線時仍可運作）
// 這會在本地快取資料，網路恢復時自動同步
try {
  enableIndexedDbPersistence(db).catch((err) => {
    if (err.code === 'failed-precondition') {
      // 多個分頁同時開啟時會失敗
      console.warn('Firebase 持久化失敗：多個分頁開啟');
    } else if (err.code === 'unimplemented') {
      // 瀏覽器不支援
      console.warn('Firebase 持久化失敗：瀏覽器不支援');
    }
  });
} catch (err) {
  console.error('Firebase 持久化設定錯誤:', err);
}

console.log('✅ Firebase 初始化成功');

// 匯出 Firestore 實例供其他模組使用
export { db };