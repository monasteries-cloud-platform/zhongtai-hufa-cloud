/**
 * ============================================================
 * 檔案：共用設定檔
 * 版本：v1.2（2026-09-19）
 * 版本歷程：
 *   - v1.1（2026-09-18）：`呼叫後端API()` 新增「連線失敗自動重試
 *     一次」機制，改善 Apps Script Web App 閒置後第一次呼叫偶爾
 *     連線失敗的現象（詳見該函式的變更說明）。
 *   - 2026-09-19：WEB_APP_網址 由待填佔位文字改填正式部署網址
 *     （不算邏輯變更，故不列入版本號，僅記錄異動時間點）。
 *   - v1.2（2026-09-19）：新增「總管理員登入資訊」的存取函式
 *     （儲存／取得／清除），供新增的 system-admin.html（系統管理
 *     後台）使用，比照既有精舍登入資訊的存取方式，統一集中管理
 *     sessionStorage 的 key 名稱，避免打錯字。
 * 說明：
 *   護法會雲端系統的前端共用設定，提報系統、報到系統、精舍後台
 *   管理、系統管理後台等所有頁面都引用這份設定檔，未來若 Web App
 *   網址變更（例如重新部署），只需要改這一個檔案，不用每個頁面
 *   都改一次。
 * ============================================================
 */

// 部署 Apps Script Web App 後拿到的網址（2026-09-19 填入正式部署網址）
const WEB_APP_網址 = "https://script.google.com/macros/s/AKfycby5gQrRgR4rXzW9BSnmJ7_-jOvqb1OunMSquHiq0xQTsxuBWY0Y6BftEQYRpTeAHi8g/exec";

// 精舍登入後，token 存在瀏覽器 sessionStorage 時使用的 key 名稱，統一集中管理避免打錯字
const SESSION_KEY_精舍TOKEN = "護法會雲端系統_精舍token";
const SESSION_KEY_精舍代碼 = "護法會雲端系統_精舍代碼";
const SESSION_KEY_精舍顯示名稱 = "護法會雲端系統_精舍顯示名稱";

// 總管理員登入後，token 存在瀏覽器 sessionStorage 時使用的 key 名稱
const SESSION_KEY_管理者TOKEN = "護法會雲端系統_管理者token";


/**
 * ------------------------------------------------------------
 * 函式：呼叫後端API
 * 版本：v1.1（2026-09-18，新增自動重試一次）
 * 用途：所有頁面呼叫 Apps Script Web App 的共用函式，統一在這裡
 *       處理連線失敗、JSON 格式錯誤等狀況，避免每個頁面都重寫
 *       一次錯誤處理邏輯。
 * 變更說明（v1.1）：
 *   法師實機測試發現，查詢時偶爾會出現「無法連線到系統」的錯誤
 *   訊息，但只要不改變輸入內容、重新按一次查詢，通常就會成功。
 *   推測原因是 Google Apps Script Web App 若一段時間沒人使用，
 *   第一次呼叫時服務需要重新啟動（類似「喚醒」的過程），偶爾會
 *   來不及回應或連線失敗，屬於 Apps Script 平台本身的特性，難以
 *   完全避免。修正方式：改成「連線失敗時，自動悄悄重試一次」，
 *   不需要操作人員自己手動重新查詢一次；只有連續兩次都失敗，才
 *   真正顯示「無法連線到系統」的錯誤訊息給使用者看。
 * 參數：
 *   obj請求內容 - 要送給後端的物件，例如
 *                 { system: "temple", action: "精舍登入", ... }
 * 回傳：
 *   Promise，resolve 時是後端回傳的物件（一定會有「成功」欄位）
 * ------------------------------------------------------------
 */
async function 呼叫後端API(obj請求內容) {
  var int最大嘗試次數 = 2; // 第一次失敗後，自動再重試一次，總共最多嘗試 2 次

  for (var int第幾次嘗試 = 1; int第幾次嘗試 <= int最大嘗試次數; int第幾次嘗試++) {
    try {
      const objResponse = await fetch(WEB_APP_網址, {
        method: "POST",
        // 用 text/plain 而不是 application/json，避免瀏覽器先送出 OPTIONS
        // 預檢請求（Apps Script Web App 對預檢請求的處理不理想，常導致 CORS 錯誤）
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify(obj請求內容)
      });

      if (!objResponse.ok) {
        return { 成功: false, 訊息: "伺服器回應異常（狀態碼 " + objResponse.status + "），請稍後再試或聯絡工程人員。" };
      }

      const objResult = await objResponse.json();
      return objResult;
    } catch (錯誤) {
      // 常見原因：網路中斷、WEB_APP_網址 填寫錯誤、後端網址尚未部署、
      // 或 Apps Script Web App 閒置一段時間後第一次呼叫的喚醒延遲
      console.error("呼叫後端 API 發生錯誤（第 " + int第幾次嘗試 + " 次嘗試）：", 錯誤);

      if (int第幾次嘗試 < int最大嘗試次數) {
        // 悄悄等待片刻後自動重試一次，不打擾操作人員
        await new Promise(function (resolve) { setTimeout(resolve, 800); });
        continue;
      }

      // 連續嘗試都失敗，才真正顯示錯誤訊息
      return { 成功: false, 訊息: "無法連線到系統，請檢查網路連線是否正常，或稍後再試一次。" };
    }
  }
}


/**
 * ------------------------------------------------------------
 * 函式：取得目前登入精舍資訊
 * 版本：v1.0（2026-09-16）
 * 用途：從 sessionStorage 讀出目前的登入狀態，統一由這個函式
 *       讀取，其他頁面不要直接呼叫 sessionStorage.getItem()，
 *       避免 key 名稱打錯字造成的錯誤難以排查。
 * 參數：無
 * 回傳：
 *   若已登入 → { token: str, 精舍代碼: str, 精舍顯示名稱: str }
 *   若尚未登入 → null
 * ------------------------------------------------------------
 */
function 取得目前登入精舍資訊() {
  const strToken = sessionStorage.getItem(SESSION_KEY_精舍TOKEN);
  const str精舍代碼 = sessionStorage.getItem(SESSION_KEY_精舍代碼);

  if (!strToken || !str精舍代碼) {
    return null;
  }

  return {
    token: strToken,
    精舍代碼: str精舍代碼,
    精舍顯示名稱: sessionStorage.getItem(SESSION_KEY_精舍顯示名稱) || str精舍代碼
  };
}


/**
 * ------------------------------------------------------------
 * 函式：儲存登入精舍資訊
 * 版本：v1.0（2026-09-16）
 * 用途：登入成功後，把 token 等資訊寫入 sessionStorage。
 *       使用 sessionStorage（而非 localStorage）是刻意的設計：
 *       關閉瀏覽器分頁後登入狀態就會消失，比較安全，符合
 *       Phase 3 架構規劃中「密碼與登入狀態盡量簡單、但不過度
 *       暴露風險」的原則。
 * 參數：
 *   strToken       - 登入成功後拿到的 token
 *   str精舍代碼     - 登入的精舍代碼
 *   str精舍顯示名稱 - 精舍的顯示名稱（用於畫面上顯示，不影響邏輯判斷）
 * 回傳：無
 * ------------------------------------------------------------
 */
function 儲存登入精舍資訊(strToken, str精舍代碼, str精舍顯示名稱) {
  sessionStorage.setItem(SESSION_KEY_精舍TOKEN, strToken);
  sessionStorage.setItem(SESSION_KEY_精舍代碼, str精舍代碼);
  sessionStorage.setItem(SESSION_KEY_精舍顯示名稱, str精舍顯示名稱 || str精舍代碼);
}


/**
 * ------------------------------------------------------------
 * 函式：清除登入精舍資訊
 * 版本：v1.0（2026-09-16）
 * 用途：登出時呼叫，清掉 sessionStorage 裡的登入資訊。
 * 參數：無
 * 回傳：無
 * ------------------------------------------------------------
 */
function 清除登入精舍資訊() {
  sessionStorage.removeItem(SESSION_KEY_精舍TOKEN);
  sessionStorage.removeItem(SESSION_KEY_精舍代碼);
  sessionStorage.removeItem(SESSION_KEY_精舍顯示名稱);
}


/**
 * ------------------------------------------------------------
 * 函式：取得目前登入管理者資訊
 * 版本：v1.0（2026-09-19）
 * 用途：從 sessionStorage 讀出總管理員的登入狀態，供
 *       system-admin.html 使用。設計方式比照
 *       取得目前登入精舍資訊()，只是總管理員不需要記住
 *       「代碼」或「顯示名稱」，只有一組 token。
 * 參數：無
 * 回傳：
 *   若已登入 → { token: str }
 *   若尚未登入 → null
 * ------------------------------------------------------------
 */
function 取得目前登入管理者資訊() {
  const strToken = sessionStorage.getItem(SESSION_KEY_管理者TOKEN);
  if (!strToken) {
    return null;
  }
  return { token: strToken };
}


/**
 * ------------------------------------------------------------
 * 函式：儲存登入管理者資訊
 * 版本：v1.0（2026-09-19）
 * 用途：總管理員登入成功後，把 token 寫入 sessionStorage。
 *       同樣使用 sessionStorage（而非 localStorage），關閉
 *       瀏覽器分頁後登入狀態就會消失，比較安全。
 * 參數：
 *   strToken - 登入成功後拿到的 token
 * 回傳：無
 * ------------------------------------------------------------
 */
function 儲存登入管理者資訊(strToken) {
  sessionStorage.setItem(SESSION_KEY_管理者TOKEN, strToken);
}


/**
 * ------------------------------------------------------------
 * 函式：清除登入管理者資訊
 * 版本：v1.0（2026-09-19）
 * 用途：登出時呼叫，清掉 sessionStorage 裡的總管理員登入資訊。
 * 參數：無
 * 回傳：無
 * ------------------------------------------------------------
 */
function 清除登入管理者資訊() {
  sessionStorage.removeItem(SESSION_KEY_管理者TOKEN);
}
