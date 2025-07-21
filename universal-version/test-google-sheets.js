#!/usr/bin/env node

/**
 * Google Sheets 功能測試程式
 * 用於在WSL環境下測試Google Sheets API連接和基本功能
 */

const GoogleAuthService = require('./src/google-auth');
const GoogleSheetsService = require('./src/google-sheets');

console.log('🚀 時間追蹤器 Universal - Google Sheets 功能測試');
console.log('=' .repeat(60));

async function testGoogleSheetsIntegration() {
    try {
        console.log('\n📋 測試步驟:');
        console.log('1. 初始化 Google 服務');
        console.log('2. 檢查認證狀態');
        console.log('3. 創建測試 Google Sheets');
        console.log('4. 測試數據同步');
        console.log('5. 驗證連接狀態');
        
        // 檢查環境變數
        console.log('\n🔧 檢查環境設定:');
        const clientId = process.env.GOOGLE_CLIENT_ID;
        const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
        
        if (!clientId || clientId === 'YOUR_CLIENT_ID') {
            console.log('❌ 未設定 GOOGLE_CLIENT_ID 環境變數');
            console.log('💡 請參考 GOOGLE_SETUP.md 設定 Google API 憑證');
            return;
        }
        
        if (!clientSecret || clientSecret === 'YOUR_CLIENT_SECRET') {
            console.log('❌ 未設定 GOOGLE_CLIENT_SECRET 環境變數');
            console.log('💡 請參考 GOOGLE_SETUP.md 設定 Google API 憑證');
            return;
        }
        
        console.log('✅ Google API 憑證已設定');
        
        // 步驟 1: 初始化服務
        console.log('\n🔧 步驟 1: 初始化 Google 服務');
        const authService = new GoogleAuthService();
        const sheetsService = new GoogleSheetsService();
        
        // 步驟 2: 檢查認證狀態
        console.log('\n🔍 步驟 2: 檢查認證狀態');
        const isAuthenticated = authService.isAuthenticated();
        console.log('認證狀態:', isAuthenticated ? '✅ 已認證' : '❌ 未認證');
        
        if (!isAuthenticated) {
            console.log('\n🔐 需要進行 Google 認證');
            console.log('📝 請注意: 此測試程式無法在WSL中打開瀏覽器進行OAuth認證');
            console.log('💡 建議: 先運行完整的Electron應用程式完成認證，然後再運行此測試');
            return;
        }
        
        // 步驟 3: 創建測試 Google Sheets
        console.log('\n📊 步驟 3: 創建測試 Google Sheets');
        const sheetResult = await sheetsService.createNewSheet('測試時間追蹤記錄 - ' + new Date().toLocaleDateString());
        
        if (sheetResult.success) {
            console.log('✅ 成功創建 Google Sheets:');
            console.log('   名稱:', sheetResult.sheetName);
            console.log('   ID:', sheetResult.sheetId);
            console.log('   URL:', sheetResult.sheetUrl);
        } else {
            console.log('❌ 創建 Google Sheets 失敗:', sheetResult.error);
            return;
        }
        
        // 步驟 4: 測試數據同步
        console.log('\n⏰ 步驟 4: 測試數據同步');
        const testData = {
            userName: '測試用戶',
            category: '測試類別',
            duration: 25, // 25分鐘
            startTime: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
            endTime: new Date().toISOString(),
            sessionId: 'test_' + Date.now(),
            notes: '自動化測試記錄',
            deviceName: 'Test Device'
        };
        
        const syncResult = await sheetsService.syncTimeRecord(testData);
        
        if (syncResult.success) {
            console.log('✅ 成功同步測試數據到 Google Sheets');
        } else {
            console.log('❌ 數據同步失敗:', syncResult.error);
            return;
        }
        
        // 步驟 5: 驗證連接狀態
        console.log('\n🧪 步驟 5: 驗證連接狀態');
        const connectionResult = await sheetsService.testConnection();
        
        if (connectionResult.success) {
            console.log('✅ Google Sheets 連接測試成功');
            console.log('   連接的 Sheets:', connectionResult.sheetName);
        } else {
            console.log('❌ 連接測試失敗:', connectionResult.error);
            return;
        }
        
        // 測試批量同步功能
        console.log('\n📦 額外測試: 批量數據同步');
        const batchData = [
            {
                userName: '測試用戶A',
                category: '學習',
                duration: 30,
                startTime: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
                endTime: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
                sessionId: 'batch_test_1_' + Date.now(),
                notes: '批量測試記錄 1',
                deviceName: 'Test Device'
            },
            {
                userName: '測試用戶B',
                category: '工作',
                duration: 45,
                startTime: new Date(Date.now() - 90 * 60 * 1000).toISOString(),
                endTime: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
                sessionId: 'batch_test_2_' + Date.now(),
                notes: '批量測試記錄 2',
                deviceName: 'Test Device'
            }
        ];
        
        const batchResult = await sheetsService.batchSyncLocalData(batchData);
        
        if (batchResult.success) {
            console.log(`✅ 成功批量同步 ${batchResult.syncedCount} 筆記錄`);
        } else {
            console.log('❌ 批量同步失敗:', batchResult.error);
        }
        
        console.log('\n🎉 所有測試完成！');
        console.log('📊 您可以檢查您的 Google Sheets 確認數據是否正確同步');
        console.log('🔗 Google Sheets URL:', sheetResult.sheetUrl);
        
    } catch (error) {
        console.error('\n❌ 測試過程中發生錯誤:', error);
        console.error('詳細錯誤信息:', error.stack);
    }
}

// 檢查是否安裝了必要的依賴
function checkDependencies() {
    try {
        require('googleapis');
        require('electron-store');
        console.log('✅ 所有必要依賴已安裝');
        return true;
    } catch (error) {
        console.log('❌ 缺少必要依賴:');
        console.log('請運行: npm install googleapis electron-store');
        return false;
    }
}

// 主程式
async function main() {
    console.log('🔍 檢查依賴...');
    
    if (!checkDependencies()) {
        return;
    }
    
    console.log('\n⚠️  重要提醒:');
    console.log('1. 確保已按照 GOOGLE_SETUP.md 完成 Google API 設定');
    console.log('2. 確保已設定正確的環境變數 (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET)');
    console.log('3. 此測試需要先在 Electron 應用程式中完成 Google OAuth 認證');
    console.log('');
    
    await testGoogleSheetsIntegration();
}

// 執行測試
if (require.main === module) {
    main().catch(console.error);
}

module.exports = {
    testGoogleSheetsIntegration,
    checkDependencies
};