#!/usr/bin/env node

/**
 * 配置測試程式
 * 檢查Google API設定和基本環境配置
 */

console.log('🔧 時間追蹤器 Universal - 配置檢查工具');
console.log('=' .repeat(50));

function checkGoogleAPIConfig() {
    console.log('\n📊 Google API 配置檢查:');
    
    // 檢查環境變數
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    
    console.log('🔍 檢查環境變數:');
    
    if (!clientId) {
        console.log('❌ GOOGLE_CLIENT_ID 未設定');
    } else if (clientId === 'YOUR_CLIENT_ID') {
        console.log('⚠️  GOOGLE_CLIENT_ID 使用預設值，需要替換為實際值');
    } else {
        console.log('✅ GOOGLE_CLIENT_ID 已設定:', clientId.substring(0, 20) + '...');
    }
    
    if (!clientSecret) {
        console.log('❌ GOOGLE_CLIENT_SECRET 未設定');
    } else if (clientSecret === 'YOUR_CLIENT_SECRET') {
        console.log('⚠️  GOOGLE_CLIENT_SECRET 使用預設值，需要替換為實際值');
    } else {
        console.log('✅ GOOGLE_CLIENT_SECRET 已設定 (隱藏內容)');
    }
    
    return clientId && clientSecret && 
           clientId !== 'YOUR_CLIENT_ID' && 
           clientSecret !== 'YOUR_CLIENT_SECRET';
}

function checkDependencies() {
    console.log('\n📦 依賴套件檢查:');
    
    const requiredPackages = [
        'googleapis',
        'electron-store',
        'axios'
    ];
    
    let allInstalled = true;
    
    for (const pkg of requiredPackages) {
        try {
            require(pkg);
            console.log(`✅ ${pkg} - 已安裝`);
        } catch (error) {
            console.log(`❌ ${pkg} - 未安裝`);
            allInstalled = false;
        }
    }
    
    return allInstalled;
}

function checkProjectStructure() {
    console.log('\n📁 專案結構檢查:');
    
    const fs = require('fs');
    const path = require('path');
    
    const requiredFiles = [
        'main.js',
        'src/index.html',
        'src/renderer.js',
        'src/preload.js',
        'src/google-auth.js',
        'src/google-sheets.js',
        'GOOGLE_SETUP.md',
        'package.json'
    ];
    
    let allExists = true;
    
    for (const file of requiredFiles) {
        const filePath = path.join(__dirname, file);
        if (fs.existsSync(filePath)) {
            console.log(`✅ ${file} - 存在`);
        } else {
            console.log(`❌ ${file} - 缺失`);
            allExists = false;
        }
    }
    
    return allExists;
}

function checkPackageJson() {
    console.log('\n📋 Package.json 檢查:');
    
    try {
        const packageJson = require('./package.json');
        
        console.log(`✅ 專案名稱: ${packageJson.name}`);
        console.log(`✅ 版本: ${packageJson.version}`);
        
        // 檢查必要的依賴
        const requiredDeps = ['googleapis', 'electron-store', 'axios'];
        const deps = packageJson.dependencies || {};
        
        for (const dep of requiredDeps) {
            if (deps[dep]) {
                console.log(`✅ 依賴 ${dep}: ${deps[dep]}`);
            } else {
                console.log(`❌ 缺少依賴: ${dep}`);
            }
        }
        
        // 檢查腳本
        const scripts = packageJson.scripts || {};
        if (scripts.start) {
            console.log(`✅ 啟動腳本: ${scripts.start}`);
        } else {
            console.log('❌ 缺少啟動腳本');
        }
        
        return true;
    } catch (error) {
        console.log('❌ 無法讀取 package.json:', error.message);
        return false;
    }
}

function generateSetupInstructions() {
    console.log('\n📝 下一步設定指南:');
    console.log('');
    
    if (!checkGoogleAPIConfig()) {
        console.log('🔧 Google API 設定:');
        console.log('1. 閱讀 GOOGLE_SETUP.md 文檔');
        console.log('2. 在 Google Cloud Console 建立專案');
        console.log('3. 啟用 Google Sheets API 和 Drive API');
        console.log('4. 建立 OAuth 2.0 憑證');
        console.log('5. 設定環境變數或更新 src/google-auth.js');
        console.log('');
    }
    
    console.log('🚀 測試應用程式:');
    console.log('1. 運行: npm install (如果依賴未安裝)');
    console.log('2. 運行: npm start');
    console.log('3. 完成 Google OAuth 認證');
    console.log('4. 測試 Google Sheets 設定');
    console.log('');
    
    console.log('🧪 高級測試:');
    console.log('1. 運行: node test-google-sheets.js');
    console.log('2. 檢查 Google Sheets 中的數據');
    console.log('');
}

function main() {
    console.log('開始配置檢查...\n');
    
    let allGood = true;
    
    allGood &= checkProjectStructure();
    allGood &= checkPackageJson();
    allGood &= checkDependencies();
    allGood &= checkGoogleAPIConfig();
    
    console.log('\n' + '='.repeat(50));
    
    if (allGood) {
        console.log('🎉 所有配置檢查通過！');
        console.log('您可以開始使用 Google Sheets 整合功能了');
    } else {
        console.log('⚠️  發現一些配置問題');
        console.log('請按照下方指南完成設定');
    }
    
    generateSetupInstructions();
}

// 執行檢查
if (require.main === module) {
    main();
}

module.exports = {
    checkGoogleAPIConfig,
    checkDependencies,
    checkProjectStructure,
    checkPackageJson
};