/**
 * Google Sheets 操作服務
 * 處理時間追蹤數據與Google Sheets的同步
 */

const GoogleAuthService = require('./google-auth');

class GoogleSheetsService {
    constructor() {
        this.authService = new GoogleAuthService();
        this.sheetsClient = null;
        this.driveClient = null;
        this.currentSheetId = null;
        this.currentSheetName = '時間追蹤記錄';
    }
    
    /**
     * 初始化Google Sheets服務
     */
    async initialize() {
        try {
            if (!this.authService.isAuthenticated()) {
                throw new Error('請先完成Google認證');
            }
            
            this.sheetsClient = this.authService.getSheetsClient();
            this.driveClient = this.authService.getDriveClient();
            
            return { success: true };
        } catch (error) {
            console.error('❌ Google Sheets服務初始化失敗:', error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * 創建新的Google Sheets
     */
    async createNewSheet(title = '時間追蹤記錄') {
        try {
            await this.initialize();
            
            // 創建新的試算表
            const response = await this.sheetsClient.spreadsheets.create({
                resource: {
                    properties: {
                        title: title
                    },
                    sheets: [{
                        properties: {
                            title: '使用記錄',
                            gridProperties: {
                                rowCount: 1000,
                                columnCount: 10
                            }
                        }
                    }]
                }
            });
            
            const spreadsheetId = response.data.spreadsheetId;
            const spreadsheetUrl = response.data.spreadsheetUrl;
            
            // 設置表頭
            await this.setupSheetHeaders(spreadsheetId);
            
            // 保存Sheet資訊
            this.currentSheetId = spreadsheetId;
            this.currentSheetName = title;
            
            console.log('✅ 新Google Sheets創建成功:', title);
            
            return {
                success: true,
                sheetId: spreadsheetId,
                sheetUrl: spreadsheetUrl,
                sheetName: title
            };
            
        } catch (error) {
            console.error('❌ 創建Google Sheets失敗:', error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * 設置Google Sheets表頭
     */
    async setupSheetHeaders(spreadsheetId) {
        const headers = [
            '日期時間',
            '用戶名稱',
            '活動類別', 
            '時間長度(分鐘)',
            '開始時間',
            '結束時間',
            '裝置名稱',
            '版本',
            '會話ID',
            '備註'
        ];
        
        await this.sheetsClient.spreadsheets.values.update({
            spreadsheetId: spreadsheetId,
            range: '使用記錄!A1:J1',
            valueInputOption: 'RAW',
            resource: {
                values: [headers]
            }
        });
        
        // 設置表頭樣式
        await this.sheetsClient.spreadsheets.batchUpdate({
            spreadsheetId: spreadsheetId,
            resource: {
                requests: [{
                    repeatCell: {
                        range: {
                            sheetId: 0,
                            startRowIndex: 0,
                            endRowIndex: 1,
                            startColumnIndex: 0,
                            endColumnIndex: 10
                        },
                        cell: {
                            userEnteredFormat: {
                                backgroundColor: {
                                    red: 0.2,
                                    green: 0.6,
                                    blue: 1.0
                                },
                                textFormat: {
                                    foregroundColor: {
                                        red: 1.0,
                                        green: 1.0,
                                        blue: 1.0
                                    },
                                    bold: true
                                }
                            }
                        },
                        fields: 'userEnteredFormat(backgroundColor,textFormat)'
                    }
                }]
            }
        });
        
        console.log('✅ Google Sheets表頭設置完成');
    }
    
    /**
     * 連接到現有的Google Sheets
     */
    async connectToExistingSheet(sheetUrl) {
        try {
            await this.initialize();
            
            // 從URL提取Sheet ID
            const sheetId = this.extractSheetId(sheetUrl);
            if (!sheetId) {
                throw new Error('無效的Google Sheets URL');
            }
            
            // 檢查Sheet是否存在且可訪問
            const response = await this.sheetsClient.spreadsheets.get({
                spreadsheetId: sheetId
            });
            
            const sheetName = response.data.properties.title;
            
            // 檢查是否有適當的工作表
            const sheets = response.data.sheets;
            let targetSheet = sheets.find(sheet => 
                sheet.properties.title === '使用記錄' || 
                sheet.properties.title === 'Sheet1'
            );
            
            if (!targetSheet) {
                // 創建使用記錄工作表
                await this.sheetsClient.spreadsheets.batchUpdate({
                    spreadsheetId: sheetId,
                    resource: {
                        requests: [{
                            addSheet: {
                                properties: {
                                    title: '使用記錄',
                                    gridProperties: {
                                        rowCount: 1000,
                                        columnCount: 10
                                    }
                                }
                            }
                        }]
                    }
                });
                
                // 設置表頭
                await this.setupSheetHeaders(sheetId);
            }
            
            this.currentSheetId = sheetId;
            this.currentSheetName = sheetName;
            
            console.log('✅ 成功連接到Google Sheets:', sheetName);
            
            return {
                success: true,
                sheetId: sheetId,
                sheetName: sheetName,
                sheetUrl: `https://docs.google.com/spreadsheets/d/${sheetId}/edit`
            };
            
        } catch (error) {
            console.error('❌ 連接Google Sheets失敗:', error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * 從URL提取Sheet ID
     */
    extractSheetId(url) {
        const regex = /\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/;
        const match = url.match(regex);
        return match ? match[1] : null;
    }
    
    /**
     * 同步時間記錄到Google Sheets
     */
    async syncTimeRecord(recordData) {
        try {
            if (!this.currentSheetId) {
                throw new Error('尚未連接到Google Sheets');
            }
            
            await this.initialize();
            
            // 準備要插入的數據
            const rowData = [
                new Date().toISOString(),
                recordData.userName || '未知用戶',
                recordData.category || '未分類',
                recordData.duration || 0,
                recordData.startTime || '',
                recordData.endTime || '',
                recordData.deviceName || require('os').hostname(),
                '2.0.0',
                recordData.sessionId || this.generateSessionId(),
                recordData.notes || ''
            ];
            
            // 添加到Google Sheets
            await this.sheetsClient.spreadsheets.values.append({
                spreadsheetId: this.currentSheetId,
                range: '使用記錄!A:J',
                valueInputOption: 'RAW',
                insertDataOption: 'INSERT_ROWS',
                resource: {
                    values: [rowData]
                }
            });
            
            console.log('✅ 時間記錄已同步到Google Sheets');
            
            return { success: true };
            
        } catch (error) {
            console.error('❌ 同步Google Sheets失敗:', error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * 批量同步本地數據到Google Sheets
     */
    async batchSyncLocalData(localData) {
        try {
            if (!this.currentSheetId || !localData || localData.length === 0) {
                return { success: false, error: '無數據可同步' };
            }
            
            await this.initialize();
            
            // 準備批量數據
            const batchData = localData.map(record => [
                record.timestamp || new Date().toISOString(),
                record.userName || '未知用戶',
                record.category || '未分類', 
                record.duration || 0,
                record.startTime || '',
                record.endTime || '',
                record.deviceName || require('os').hostname(),
                '2.0.0',
                record.sessionId || this.generateSessionId(),
                record.notes || ''
            ]);
            
            // 批量插入到Google Sheets
            await this.sheetsClient.spreadsheets.values.append({
                spreadsheetId: this.currentSheetId,
                range: '使用記錄!A:J',
                valueInputOption: 'RAW',
                insertDataOption: 'INSERT_ROWS',
                resource: {
                    values: batchData
                }
            });
            
            console.log(`✅ 已同步 ${batchData.length} 筆本地記錄到Google Sheets`);
            
            return { 
                success: true, 
                syncedCount: batchData.length 
            };
            
        } catch (error) {
            console.error('❌ 批量同步失敗:', error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * 測試Google Sheets連接
     */
    async testConnection() {
        try {
            if (!this.currentSheetId) {
                throw new Error('尚未設定Google Sheets');
            }
            
            await this.initialize();
            
            // 嘗試讀取Sheet資訊
            const response = await this.sheetsClient.spreadsheets.get({
                spreadsheetId: this.currentSheetId
            });
            
            const sheetName = response.data.properties.title;
            
            console.log('✅ Google Sheets連接測試成功');
            
            return {
                success: true,
                sheetName: sheetName,
                sheetId: this.currentSheetId
            };
            
        } catch (error) {
            console.error('❌ Google Sheets連接測試失敗:', error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * 生成會話ID
     */
    generateSessionId() {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substr(2, 9);
        return `session_${timestamp}_${random}`;
    }
    
    /**
     * 獲取當前Sheet資訊
     */
    getCurrentSheetInfo() {
        return {
            sheetId: this.currentSheetId,
            sheetName: this.currentSheetName,
            isConnected: !!this.currentSheetId
        };
    }
}

module.exports = GoogleSheetsService;