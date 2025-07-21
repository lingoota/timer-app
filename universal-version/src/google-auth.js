/**
 * Google OAuth 認證服務
 * 處理Google Sheets API的OAuth 2.0認證流程
 */

const { google } = require('googleapis');
const { shell } = require('electron');
const http = require('http');
const url = require('url');
const Store = require('electron-store');

class GoogleAuthService {
    constructor() {
        this.store = new Store();
        this.oauth2Client = null;
        this.credentials = null;
        
        // OAuth 2.0 設定 (需要用戶在Google Cloud Console創建)
        this.CLIENT_ID = process.env.GOOGLE_CLIENT_ID || 'YOUR_CLIENT_ID';
        this.CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || 'YOUR_CLIENT_SECRET';
        this.REDIRECT_URI = 'http://localhost:3000/auth/google/callback';
        
        this.SCOPES = [
            'https://www.googleapis.com/auth/spreadsheets',
            'https://www.googleapis.com/auth/drive.file'
        ];
        
        this.initializeOAuth();
    }
    
    initializeOAuth() {
        this.oauth2Client = new google.auth.OAuth2(
            this.CLIENT_ID,
            this.CLIENT_SECRET,
            this.REDIRECT_URI
        );
        
        // 檢查是否有已保存的認證
        const savedTokens = this.store.get('google_tokens');
        if (savedTokens) {
            this.oauth2Client.setCredentials(savedTokens);
            this.credentials = savedTokens;
        }
    }
    
    /**
     * 開始OAuth認證流程
     */
    async startAuthFlow() {
        try {
            // 生成認證URL
            const authUrl = this.oauth2Client.generateAuthUrl({
                access_type: 'offline',
                scope: this.SCOPES,
                prompt: 'consent' // 強制顯示同意畫面以獲取refresh token
            });
            
            console.log('🔗 打開認證頁面:', authUrl);
            
            // 在預設瀏覽器中打開認證頁面
            shell.openExternal(authUrl);
            
            // 啟動本地服務器接收回調
            const authCode = await this.waitForAuthCode();
            
            // 用授權碼換取token
            const tokens = await this.exchangeCodeForTokens(authCode);
            
            // 保存tokens
            this.store.set('google_tokens', tokens);
            this.credentials = tokens;
            this.oauth2Client.setCredentials(tokens);
            
            console.log('✅ Google認證成功');
            return {
                success: true,
                message: 'Google認證成功'
            };
            
        } catch (error) {
            console.error('❌ Google認證失敗:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    /**
     * 等待用戶完成認證並獲取授權碼
     */
    waitForAuthCode() {
        return new Promise((resolve, reject) => {
            const server = http.createServer((req, res) => {
                const urlParts = url.parse(req.url, true);
                
                if (urlParts.pathname === '/auth/google/callback') {
                    const { code, error } = urlParts.query;
                    
                    // 回應用戶
                    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                    
                    if (code) {
                        res.end(`
                            <html>
                                <body style="font-family: Arial; text-align: center; padding: 50px;">
                                    <h2>✅ 認證成功！</h2>
                                    <p>您可以關閉這個頁面了</p>
                                    <script>window.close();</script>
                                </body>
                            </html>
                        `);
                        server.close();
                        resolve(code);
                    } else {
                        res.end(`
                            <html>
                                <body style="font-family: Arial; text-align: center; padding: 50px;">
                                    <h2>❌ 認證失敗</h2>
                                    <p>錯誤: ${error || '未知錯誤'}</p>
                                </body>
                            </html>
                        `);
                        server.close();
                        reject(new Error(error || '認證被拒絕'));
                    }
                }
            });
            
            server.listen(3000, () => {
                console.log('🔗 認證服務器已啟動，監聽端口 3000');
            });
            
            // 30秒超時
            setTimeout(() => {
                server.close();
                reject(new Error('認證超時'));
            }, 30000);
        });
    }
    
    /**
     * 用授權碼換取access token
     */
    async exchangeCodeForTokens(code) {
        try {
            const { tokens } = await this.oauth2Client.getToken(code);
            return tokens;
        } catch (error) {
            throw new Error(`無法換取tokens: ${error.message}`);
        }
    }
    
    /**
     * 檢查是否已經認證
     */
    isAuthenticated() {
        return !!(this.credentials && this.credentials.access_token);
    }
    
    /**
     * 獲取已認證的Google Sheets API客戶端
     */
    getSheetsClient() {
        if (!this.isAuthenticated()) {
            throw new Error('尚未完成Google認證');
        }
        
        return google.sheets({ 
            version: 'v4', 
            auth: this.oauth2Client 
        });
    }
    
    /**
     * 獲取已認證的Google Drive API客戶端
     */
    getDriveClient() {
        if (!this.isAuthenticated()) {
            throw new Error('尚未完成Google認證');
        }
        
        return google.drive({ 
            version: 'v3', 
            auth: this.oauth2Client 
        });
    }
    
    /**
     * 登出並清除認證
     */
    async logout() {
        try {
            if (this.credentials && this.credentials.access_token) {
                // 撤銷token
                await this.oauth2Client.revokeCredentials();
            }
            
            // 清除保存的認證
            this.store.delete('google_tokens');
            this.credentials = null;
            this.oauth2Client.setCredentials({});
            
            console.log('✅ Google登出成功');
            return { success: true };
            
        } catch (error) {
            console.error('❌ Google登出失敗:', error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * 刷新access token
     */
    async refreshToken() {
        try {
            if (!this.credentials || !this.credentials.refresh_token) {
                throw new Error('沒有refresh token可用');
            }
            
            const { credentials } = await this.oauth2Client.refreshAccessToken();
            
            // 更新保存的credentials
            this.credentials = { ...this.credentials, ...credentials };
            this.store.set('google_tokens', this.credentials);
            this.oauth2Client.setCredentials(this.credentials);
            
            console.log('✅ Token刷新成功');
            return { success: true };
            
        } catch (error) {
            console.error('❌ Token刷新失敗:', error);
            return { success: false, error: error.message };
        }
    }
}

module.exports = GoogleAuthService;