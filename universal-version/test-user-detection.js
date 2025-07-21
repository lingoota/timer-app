#!/usr/bin/env node

// 模擬測試Windows用戶自動登錄邏輯
const os = require('os');

console.log('🚀 時間追蹤器 Universal v2.0.0 用戶檢測測試');
console.log('=' .repeat(50));

// 模擬main.js的用戶檢測
function getWindowsUserInfo() {
  try {
    const userInfo = os.userInfo();
    
    const windowsUser = {
      username: userInfo.username,
      displayName: userInfo.fullname || userInfo.username,
      homedir: userInfo.homedir,
      uid: userInfo.uid,
      gid: userInfo.gid,
      shell: userInfo.shell
    };
    
    console.log('🔍 檢測到Windows用戶資訊:');
    console.log('  用戶名:', windowsUser.username);
    console.log('  顯示名稱:', windowsUser.displayName);
    console.log('  家目錄:', windowsUser.homedir);
    
    return windowsUser;
  } catch (error) {
    console.error('❌ 無法獲取Windows用戶資訊:', error);
    return null;
  }
}

// 模擬renderer.js的用戶初始化邏輯
function mockInitializeWindowsUser() {
  console.log('\n=== Windows 用戶自動初始化 ===');
  
  const windowsUser = getWindowsUserInfo();
  
  if (windowsUser) {
    console.log('📋 獲取到Windows用戶:', windowsUser.displayName);
    
    // 模擬檢查localStorage (這裡用檔案模擬)
    const userData = null; // 模擬第一次使用
    
    if (!userData) {
      // 首次使用，顯示歡迎畫面
      console.log('🎉 首次使用，顯示歡迎畫面');
      showWelcomeScreen(windowsUser);
    } else {
      // 現有用戶，直接自動登錄
      console.log('🔄 現有用戶，自動登錄');
      autoLoginUser(userData);
    }
  } else {
    console.log('⚠️ 用戶檢測失敗，使用後備方案');
  }
}

// 模擬歡迎畫面
function showWelcomeScreen(windowsUser) {
  console.log('\n🎉 顯示新用戶歡迎畫面');
  console.log('   歡迎訊息: 歡迎使用時間追蹤器 Universal！');
  console.log('   用戶顯示: ' + windowsUser.displayName);
  console.log('   系統名稱: @' + windowsUser.username);
  console.log('   特色說明:');
  console.log('     💾 數據完全保存在您的電腦中');
  console.log('     🔒 隱私完全受到保護');
  console.log('     ⚡ 立即開始使用，無需註冊');
  
  // 模擬使用者點擊開始按鈕
  setTimeout(() => {
    handleFirstSessionStart(windowsUser);
  }, 1000);
}

// 模擬首次會話開始
function handleFirstSessionStart(windowsUser) {
  console.log('\n🚀 開始首次會話');
  
  // 創建新用戶資料
  const newUser = {
    id: generateUserId(),
    displayName: windowsUser.displayName,
    systemUsername: windowsUser.username,
    homedir: windowsUser.homedir,
    createdAt: new Date().toISOString(),
    totalTime: 0,
    sessionCount: 0,
    categoryTime: {}
  };
  
  console.log('✅ 新用戶資料已建立:');
  console.log('   ID:', newUser.id);
  console.log('   顯示名稱:', newUser.displayName);
  console.log('   系統用戶名:', newUser.systemUsername);
  console.log('   建立時間:', newUser.createdAt);
  
  console.log('\n✨ 歡迎畫面關閉，用戶可開始使用計時功能');
}

// 生成唯一用戶ID
function generateUserId() {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substr(2, 9);
  return `user_${timestamp}_${random}`;
}

// 執行測試
mockInitializeWindowsUser();

console.log('\n' + '='.repeat(50));
console.log('✅ Windows自動登錄功能測試完成！');
console.log('💡 在實際的Electron應用程式中，這個流程會:');
console.log('   1. 自動檢測當前Windows用戶');
console.log('   2. 顯示個人化的歡迎界面');
console.log('   3. 建立本地用戶資料');
console.log('   4. 立即可用，無需任何設定');