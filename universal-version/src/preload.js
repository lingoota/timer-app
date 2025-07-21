const { contextBridge, ipcRenderer } = require('electron');

// 將一組安全的 API 暴露給渲染進程（前端網頁）
contextBridge.exposeInMainWorld('api', {
  /**
   * 雙向通訊：從渲染進程發起，並從主進程獲得回應
   * @param {string} channel - 通訊頻道名稱
   * @param  {...any} args - 傳遞給主進程的參數
   * @returns {Promise<any>} - 主進程返回的數據
   */
  invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),

  /**
   * 單向通訊：從主進程發送到渲染進程
   * @param {string} channel - 通訊頻道名稱
   * @param {Function} func - 監聽到事件時要執行的回調函數
   */
  on: (channel, func) => {
    // 為了安全，我們只傳遞必要的參數，而不是整個 event 對象
    const subscription = (event, ...args) => func(...args);
    ipcRenderer.on(channel, subscription);
    
    // 返回一個取消訂閱的函數，方便組件卸載時清理監聽器
    return () => {
      ipcRenderer.removeListener(channel, subscription);
    };
  },

  /**
   * 單向通訊：從渲染進程發送到主進程
   * @param {string} channel - 通訊頻道名稱
   * @param  {...any} args - 傳遞給主進程的參數
   */
  send: (channel, ...args) => {
    ipcRenderer.send(channel, ...args);
  }
});
