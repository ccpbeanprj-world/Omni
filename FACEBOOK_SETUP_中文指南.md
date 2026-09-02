# Facebook 商業帳號設定指南（中文版）

> **注意（2026）：** 本指南只談 Facebook 帳號申請。Omni **正式上線**的是 LINE + WhatsApp（Twilio），Facebook Messenger **尚未**接到 `src/server.js` 的收發路徑。產品說明见 [README.md](README.md)。

## 📋 目錄
1. [準備工作](#準備工作)
2. [註冊流程](#註冊流程)
3. [SMS 驗證問題解決方案](#sms-驗證問題解決方案)
4. [替代驗證方法](#替代驗證方法)
5. [Meta Business Suite 設定](#meta-business-suite-設定)
6. [Facebook Messenger API 設定](#facebook-messenger-api-設定)
7. [Webhook 設定](#webhook-設定)
8. [常見問題](#常見問題)

---

## 🚨 快速故障排除

### ❓ 找不到「新增 Messenger 產品」？所有 URL 都被重定向？

**⚠️ 如果訪問 URL 都被重定向到 Dashboard，請按照以下順序檢查：**

### 🔥 **最新解決方法（2024 新介面）**：

**如果您的 Dashboard 顯示「應用程式自訂和要求」列表（而不是傳統產品列表）：**

1. **直接點擊頁面右上角的「新增使用案例」按鈕**
   - 尋找 Messenger 或「傳送和接收訊息」選項
   - 這是 Facebook 新介面的添加方式

2. **❌ 如果「使用案例」列表中沒有 Messenger 選項**（這是常見情況）：

   **⚠️ 重要：如果列表中只有「廣告」、「Audience Network」、「目錄 API」等與 Messenger 無關的選項：**
   - **❌ 不要選擇這些選項**（它們不會幫助您添加 Messenger）
   - **點擊「X」關閉彈窗**
   - **使用下面的替代方法**

   **重要發現：Messenger 可能不在「新增使用案例」列表中，需要通過其他方式添加。**

   **請按照以下順序嘗試**：
   
   **方法 A：檢查已添加的使用案例** ✅ 已完成檢查
   - ✅ 您已在「使用案例」頁面
   - ❌ 確認列表中沒有 Messenger 選項
   - 這證明 Messenger **不在使用案例列表中**
   
   **方法 B：直接訪問 Messenger URL** ✅ 已嘗試，但被重定向
   ```
   https://developers.facebook.com/apps/2181619782322784/messenger/
   ```
   - ❌ 結果：被重定向到 Dashboard
   - **這證明 Messenger 尚未添加到應用程式**
   - **必須先添加 Messenger 產品，才能訪問設定頁面**
   
   **方法 C：通過「商家專用 Facebook 登入」添加**
   1. 點擊左側選單的「**商家專用 Facebook 登入**」（Facebook Login for Business）
   2. 查看子選單中是否有「**Messenger**」或相關選項
   3. 某些情況下，Messenger 可能與 Facebook Login 整合
   
   **方法 D：檢查是否需要先發布應用程式**
   1. 查看左側選單是否有「**發佈**」（Publish）選項
   2. 某些功能可能需要先發布應用程式才能使用
   
   **方法 E：檢查應用程式類型** ✅ 已完成檢查
   - ✅ 您的應用程式類型是「商業與粉絲專頁」（正確）
   
   **方法 F：檢查是否需要先建立粉絲專頁** ✅ 已完成
   
   **Messenger API 需要連結到 Facebook 粉絲專頁才能使用。**
   
   ✅ **您已建立粉絲專頁**：
   - 粉絲專頁名稱：Omni Platform Message
   - 粉絲專頁 ID：819334927935513
   - ✅ 已在 Business Suite 中可訪問
   
   **下一步：將粉絲專頁連結到開發者應用程式**
   
   現在請嘗試以下方法：
   1. **返回 Facebook Developers**：
      - 訪問：https://developers.facebook.com/apps/2181619782322784/dashboard/
   
   2. **再次嘗試訪問 Messenger URL**：
      ```
      https://developers.facebook.com/apps/2181619782322784/messenger/
      ```
      - 現在可能可以訪問了（因為已有粉絲專頁）
   
   3. **或嘗試通過「發佈」選項** ✅ 已檢查
      - ✅ 已訪問「發佈」頁面
      - ❌ 確認「使用案例」列表中沒有 Messenger
      - **這證明 Messenger 無法通過使用案例添加**
   
   4. **或通過 Business Suite 設定 Messenger**：
      - 在 Business Suite 中尋找 Messenger API 設定
   
   **方法 G：通過 Business Suite 設定 Messenger**
   
   1. **訪問 Meta Business Suite**：
      ```
      https://business.facebook.com
      ```
   
   2. **在 Business Suite 中**：
      - 進入「設定」→「帳號中心」
      - 或進入「收件匣」設定
      - 查看是否有「Messenger API」或「連接 Messenger」選項
   
   3. **連結粉絲專頁到 Business Suite**（如果還沒連結）
   
   **方法 H：嘗試訪問產品頁面**
   
   1. **訪問產品列表 URL**：
      ```
      https://developers.facebook.com/apps/2181619782322784/products/
      ```
   
   2. **或嘗試添加平台 URL**：
      ```
      https://developers.facebook.com/apps/2181619782322784/dashboard/add-platform/
      ```
   
   3. **或嘗試舊版 URL**：
      ```
      https://developers.facebook.com/apps/2181619782322784/dashboard/?no_redirect=1
      ```

**🔴 重要發現：Messenger 無法通過常規方式添加**

**根據您的實際測試結果：**
- ✅ 已完成必要動作（應用程式圖示、用戶資料刪除）
- ✅ 應用程式類型正確（商業與粉絲專頁）
- ✅ 已建立粉絲專頁（Omni Platform Message, ID: 819334927935513）
- ❌ 「使用案例」列表中沒有 Messenger 選項
- ❌ 「新增使用案例」彈窗中也沒有 Messenger
- ❌ 直接訪問 Messenger URL 被重定向到 Dashboard
- ❌ 「發布」頁面的使用案例列表中也沒有 Messenger

**結論：** Messenger 產品在新版 Facebook Developers 介面中**無法通過「使用案例」方式添加**。這可能是 Facebook 的界面變更或政策調整。

**最終解決方案：**

### 方案 A：檢查「管理粉絲專頁的所有內容」是否包含 Messenger ✅ 正在檢查

在「發布」頁面，您有一個使用案例：「**管理粉絲專頁的所有內容**」。

**您已進入「管理粉絲專頁」的設定頁面！**

**請按照以下步驟操作：**

1. **在左側面板，展開「管理粉絲專頁」**：
   - 點擊「管理粉絲專頁」旁邊的下拉箭頭
   - 查看子選單中是否有「Messenger」或「訊息」相關選項

2. **檢查「權限和功能」部分**：
   - 查看是否有與 Messenger 相關的權限
   - 例如：`pages_messaging`, `pages_read_engagement` 等

3. **在右側「擴充功能」面板中查找 Messenger**：
   - 查看是否有「Messenger API」或「Messenger 訊息」相關的擴充功能
   - 如果找到，點擊「+ 新增」按鈕

4. **如果看到「透過 Webhooks 取得即時通知」**：
   - 這是 Webhook 功能，Messenger 需要使用 Webhook
   - 可以點擊「+ 新增」添加此功能
   - 但這可能不是 Messenger 的全部設定

5. **如果沒有直接找到 Messenger，嘗試以下操作**：
   - 在頁面頂部的 URL 中，查看是否可以訪問 Messenger 設定
   - 或嘗試直接訪問：
     ```
     https://developers.facebook.com/apps/2181619782322784/messenger/settings/
     ```

**重要提示：** 如果在此頁面找不到 Messenger 直接設定，Messenger 可能需要作為**單獨的產品**添加，而不是作為「管理粉絲專頁」的擴充功能。

---

### ✅ **已確認結果**：

**在「管理粉絲專頁」的權限列表中，確實沒有 Messenger 相關選項**。

您看到的權限包括：
- `pages_manage_posts` - 管理貼文
- `pages_read_engagement` - 讀取互動
- `pages_manage_metadata` - 管理元數據和 Webhooks
- 等等...

但**沒有**：
- ❌ `pages_messaging` - Messenger 傳送訊息權限（這是 Messenger 的核心權限）
- ❌ Messenger API 相關設定
- ❌ Messenger Webhook 設定

**結論：** Messenger 在 Facebook Developers 新介面中**無法通過現有的任何方式添加**，這可能是：
1. Facebook 的政策變更，Messenger 需要特殊的申請流程
2. 新介面的 Bug 或暫時性的功能缺失
3. Messenger 產品已被整合到其他產品中（如 WhatsApp Business API）

### 方案 B：嘗試通過 Graph API 添加（進階）

如果方案 A 不行，可能需要通過 API 添加 Messenger 產品。

### 方案 C：聯繫 Facebook 支援 ⭐⭐ 強烈建議

由於所有常規方法都已嘗試且失敗，**強烈建議聯繫 Facebook 官方支援**：

1. **訪問支援中心**：
   ```
   https://developers.facebook.com/support/
   ```

2. **選擇問題類別**：
   - 在支援頁面上，選擇「**Engineering**」（工程類別）✅ 您已在這裡

3. **在 Engineering 頁面選擇問題類型**：
   您會看到幾個選項，請選擇：
   
   **「Troubleshoot a bug or unexpected error」（排查 Bug 或意外錯誤）** ✅ 您已選擇

4. **選擇產品**：
   您現在會看到產品選擇頁面，標題是「Which product are you troubleshooting today?」
   
   **請選擇「Messenger Platform」** ✅ 您已選擇
   - 這個選項帶有藍色 Messenger 圖標（閃電在氣泡中）
   - 這正是您需要報告的問題類別

5. **在 Messenger Platform Troubleshooting 頁面**：
   您現在應該在「Messenger Platform Troubleshooting」頁面。
   
   **如果頁面顯示「謝謝你的意見回饋!」**：
   - 這表示您可能已經提交了反饋
   - 請檢查是否有確認郵件或提交編號
   
   **如果需要提交問題報告，請尋找：**
   - 「提交問題」或「Report an Issue」按鈕
   - 「聯絡支援」或「Contact Support」連結
   - 或頁面上的表單區域
   
   **如果找不到直接的問題提交表單，可以嘗試：**
   - 點擊「Ask the community」（詢問社群）選項
   - 或在頁面下方的搜尋框中輸入「add Messenger product」搜尋相關資源
   - 或向下滾動查看是否有更多選項

6. **提交問題報告** ✅ 已完成
   - 您已成功提交問題報告給 Facebook 支援
   - 請保存您的問題報告編號（如果有提供）
   - Facebook 通常會在 1-3 個工作天內回覆

**下一步：等待 Facebook 支援回覆**

在等待期間，您可以：
1. 檢查您的電子郵件（確認 Facebook 是否發送確認郵件）
2. 準備 Messenger 整合所需的代碼和基礎設施
3. 繼續使用其他已整合的平台（LINE、WhatsApp）

---

### ✅ **整個問題報告流程總結：**

1. ✅ 完成必要動作（應用程式圖示、用戶資料刪除）
2. ✅ 確認應用程式類型正確（商業與粉絲專頁）
3. ✅ 建立粉絲專頁（Omni Platform Message）
4. ✅ 嘗試所有常規方法添加 Messenger（都失敗）
5. ✅ 通過 Facebook 支援系統提交問題報告
   - Engineering → Troubleshoot a bug or unexpected error → Messenger Platform
   - 描述問題：無法在新版介面中找到 Messenger 產品添加方式
   
   或者也可以選擇：
   
   **「General implementation help」（一般實現幫助）**
   - 如果您想詢問如何實現 Messenger 整合
   - 但這個可能不會直接解決「找不到 Messenger 選項」的問題
   
   **「Product feedback」（產品反饋）**
   - 如果這是新界面的設計問題，可以提交反饋
   - 但這不會立即解決您的問題

4. **提交問題報告**：
   - **問題描述**（建議複製以下內容）：
     ```
     應用程式 ID: 2181619782322784
     應用程式名稱: Omni Platform Messenge
     粉絲專頁 ID: 819334927935513
     粉絲專頁名稱: Omni Platform Message
     
     問題描述：
     我已完成所有必要動作（應用程式圖示、用戶資料刪除），
     應用程式類型為「商業與粉絲專頁」，並已建立粉絲專頁。
     但在新版 Facebook Developers 介面中，我無法找到添加 Messenger 產品的方法：
     
     - 「使用案例」列表中沒有 Messenger 選項
     - 「新增使用案例」彈窗中只有廣告相關選項
     - 直接訪問 /messenger/ URL 會被重定向到 Dashboard
     - 「發布」頁面也沒有 Messenger 使用案例
     
     請問在新版介面中如何添加 Messenger 產品？
     是否需要通過其他方式或特殊的設定流程？
     ```
   
   - 附上截圖（如果可以）

3. **等待回覆**（通常在 1-3 個工作天）

### 方案 D：暫時使用其他平台（替代方案）

如果 Messenger 整合遇到持續困難，可以考慮：
- **WhatsApp Business API**（您可能已整合）
- **LINE**（您已整合）
- **WeChat**（如果目標市場是中國）
- 稍後再回來處理 Facebook Messenger

---

3. **如果沒有看到「新增使用案例」按鈕，請繼續下面的步驟**

### ✅ 解決步驟（按順序嘗試）

#### 步驟 1：檢查必要動作 ⭐ 最重要

**如果所有 URL 都被重定向，通常是有待完成的必要動作**：

1. **點擊左側選單的「必要動作」**（「Required Actions」）
2. **完成所有紅色警告項目**：
   - ✅ **應用程式圖示（1024 x 1024）** ⭐ **必須完成**
     - 上傳一個 1024x1024 的 PNG/JPG 圖片
     - 可使用線上工具快速製作（見下方詳細步驟）
   
   - ✅ **用戶資料刪除** ⭐ **必須完成**
     - 填入數據刪除回呼 URL
     - 格式：`https://your-domain.com/webhooks/facebook/data-deletion`
     - 臨時測試可用：https://webhook.site/（生成臨時 URL）

3. **詳細填寫步驟**：
   - 見下方「[完成必要動作的詳細步驟](#-完成必要動作的詳細步驟)」章節
   - 包含程式碼範例和線上工具連結

4. **完成後再嘗試添加產品**

#### 步驟 2：檢查應用程式設定

1. **訪問設定頁面**：
   ```
   https://developers.facebook.com/apps/2181619782322784/settings/
   ```

2. **檢查基本設定**：
   - 應用程式名稱
   - 聯絡電子郵件
   - 應用程式類型（應為「商業」或「其他」）

#### 步驟 3：從左側選單尋找

1. **向下滾動左側選單**
2. **尋找「產品」或「Products」選項**
3. **或點擊「應用程式設定」展開子選單**

#### 步驟 4：通過「使用案例」添加（新介面）⭐ 重要

**如果您的介面顯示「應用程式自訂和要求」列表，請嘗試此方法：**

1. **查看頁面右上角**：
   - 尋找「**新增使用案例**」或「**Add Use Case**」按鈕
   - （通常在「主控板」標題旁邊）

2. **點擊「新增使用案例」**：
   - 在彈出的列表中尋找「**Messenger**」或「**Messenger API**」
   - 或尋找「**傳送和接收訊息**」相關選項

3. **❌ 如果列表中沒有 Messenger**：
   - **直接訪問**：`https://developers.facebook.com/apps/2181619782322784/messenger/`
   - **或檢查左側選單**是否已有「Messenger」選項
   - **或檢查應用程式類型**（見步驟 2）

4. **如果找到 Messenger，完成使用案例設定**

#### 步驟 5：在主控板頁面上尋找（傳統方法）

1. **查看頁面頂部**：「+ 新增產品」按鈕
2. **查看頁面中間**：「產品」區塊 → 「瀏覽所有產品」
3. **查看所有可見的按鈕和連結**

如果以上都不行，可能需要：

#### ⚠️ 如果完成必要動作後還是被重定向：

1. **等待 10 分鐘 系統可能需要時間更新狀態**：Facebook

2. **清除瀏覽器快取**：
   - 按 `Ctrl+Shift+Delete` 清除快取和 Cookies
   - 重新登入後重試

3. **檢查應用程式狀態**：
   - 訪問：`https://developers.facebook.com/apps/2181619782322784/settings/basic/`
   - 確認應用程式狀態為「有效」

4. **在主控板頁面仔細尋找**：
   - **⭐ 首先嘗試**：查看頁面右上角是否有「**新增使用案例**」或「**Add Use Case**」按鈕
     - 點擊後在列表中尋找 Messenger 相關選項
   - 查看頁面頂部是否有「+ 新增產品」按鈕
   - 查看左側選單是否有「產品」選項
   - 查看頁面中間是否有「產品」區塊

5. **嘗試不同瀏覽器**：Chrome → Firefox → Edge

6. **最後手段**：
   - 聯繫 Facebook 支援：https://developers.facebook.com/support/
   - 或在社群論壇詢問：https://www.facebook.com/groups/fbdevelopers/

**詳細的深度檢查步驟**請見下方「[步驟 2：新增 Messenger 產品](#步驟-2新增-messenger-產品)」→「[步驟 3：完成後確認](#步驟-3完成後確認)」章節。

---

## 準備工作

### 必需資料

✅ 姓名（真實姓名）
- **個人或企業資料**：
- 電子郵件地址（建議使用企業郵箱）
- 電話號碼（可能會遇到 SMS 驗證問題）
- 公司名稱（如果是企業帳號）
- 商業註冊證書（企業帳號需要）

✅ **瀏覽器要求**：
- Chrome、Firefox、Edge 或 Safari（最新版本）
- 清除快取和 Cookies
- 建議使用無痕模式

✅ **帳號類型選擇**：
- **個人帳號**：適合小規模使用，驗證較簡單
- **商業帳號**：適合企業，功能更完整，但驗證更嚴格

---

## 註冊流程

### 步驟 1：創建 Facebook 個人帳號（如未擁有）

1. **訪問 Facebook 網站**：
   ```
   https://www.facebook.com
   ```

2. **點擊「註冊」**：
   - 輸入姓名
   - 輸入手機號碼或電子郵件
   - 設定密碼
   - 選擇出生日期
   - 選擇性別

3. **初次驗證**：
   - 如使用郵箱註冊，檢查郵箱確認信
   - 如使用手機註冊，會收到 SMS 驗證碼

### 步驟 2：創建 Meta Business Suite 帳號

1. **訪問 Business Suite**：
   ```
   https://business.facebook.com
   ```

2. **使用 Facebook 帳號登入**：
   - 點擊「建立商業帳號」
   - 或使用現有 Facebook 帳號登入

3. **填寫商業資訊**：
   - 商業名稱：您的公司名稱
   - 商業類型：選擇最適合的類別
   - 您的姓名：真實姓名
   - 商業電子郵件：企業郵箱（重要！）

4. **完成帳號創建**：
   - 點擊「提交」
   - 等待驗證郵件

---

## SMS 驗證問題解決方案

### 問題：無法接收 SMS 驗證碼

這是常見問題，以下是多種解決方案：

### 解決方案 1：使用電子郵件驗證（推薦）

**如果註冊時看到「使用電子郵件」選項**：

1. **在註冊頁面**：
   - 尋找「使用電子郵件註冊」連結
   - 點擊切換到郵箱驗證

2. **填寫郵箱**：
   ```
   使用企業郵箱：yourname@yourcompany.com
   或個人 Gmail：yourname@gmail.com
   ```

3. **檢查郵箱**：
   - 收件匣（可能在「社交」或「促銷」分類）
   - **垃圾郵件夾**（經常在這裡！）
   - 等待 5-10 分鐘

4. **如果收不到郵件**：
   - 檢查郵箱地址是否正確
   - 嘗試不同的郵箱（Gmail、Outlook、企業郵箱）
   - 檢查垃圾郵件設定

### 解決方案 2：更換驗證方式

**如果已經進入 SMS 驗證步驟**：

1. **回到上一步**：
   - 點擊「返回」或「上一步」
   - 尋找「使用其他方式驗證」

2. **選擇電子郵件**：
   - 輸入電子郵件地址
   - 使用未綁定其他 Facebook 帳號的郵箱

3. **完成驗證**：
   - 點擊郵箱中的驗證連結
   - 或輸入郵件中的驗證碼

### 解決方案 3：使用不同瀏覽器/裝置

**有時瀏覽器快取會造成問題**：

1. **更換瀏覽器**：
   ```
   原本用 Chrome → 試試 Firefox
   原本用 Firefox → 試試 Edge
   原本用 Edge → 試試 Safari
   ```

2. **清除快取**：
   ```
   Chrome: Ctrl+Shift+Delete → 清除快取和 Cookies
   Firefox: Ctrl+Shift+Delete → 清除最近內容
   ```

3. **無痕模式**：
   ```
   Chrome: Ctrl+Shift+N
   Firefox: Ctrl+Shift+P
   Edge: Ctrl+Shift+N
   ```

4. **使用手機**：
   - 在手機瀏覽器上註冊
   - 有時手機驗證更順利
   - 或使用 Facebook App

### 解決方案 4：VPN/地區切換

**某些地區可能無法接收 SMS**：

1. **使用 VPN**：
   - 連接到美國、英國或加拿大
   - 某些 VPN 服務可免費試用

2. **重新嘗試驗證**：
   - 在 VPN 連線狀態下
   - 重新輸入電話號碼
   - 或切換到郵箱驗證

⚠️ **注意**：使用 VPN 可能違反 Facebook 條款，請謹慎使用

### 解決方案 5：聯繫 Meta 支援

**如果以上方法都不行**：

1. **訪問 Meta Business 支援**：
   ```
   https://business.facebook.com/help
   ```

2. **報告問題**：
   - 點擊「聯絡我們」
   - 選擇「帳號問題」
   - 描述 SMS 無法接收的問題
   - 請求替代驗證方式

3. **提供資訊**：
   - 您的電子郵件地址
   - 電話號碼
   - 註冊時使用的姓名
   - 問題描述（英文）

4. **等待回覆**：
   - 通常在 24-48 小時內回覆
   - 可能需要提供身份證明

---

## 替代驗證方法

### 方法 1：雙重驗證替代

**完成初始驗證後，設定額外驗證**：

1. **登入 Facebook 帳號**
2. **前往「設定」**：
   ```
   設定 → 安全性和登入 → 雙重驗證
   ```

3. **選擇驗證方法**：
   - ✅ **身份驗證應用程式**（推薦，不需 SMS）
   - ✅ **備用驗證碼**
   - ❌ SMS（如果您無法接收）

4. **使用身份驗證器**：
   - 安裝 Google Authenticator 或 Microsoft Authenticator
   - 掃描 QR Code
   - 輸入驗證碼完成設定

### 方法 2：使用商業電話號碼

**如果是企業**：

1. **使用公司固定電話**：
   - 某些商業電話號碼可以接收 SMS
   - 聯絡電信供應商確認

2. **申請商業行動號碼**：
   - 某些電信商的商業方案可正常接收 Facebook SMS
   - 查詢當地電信商

3. **使用 VoIP 服務**：
   - Google Voice（美國）
   - Twilio（可接收 SMS）
   - 注意：某些 VoIP 可能不被 Facebook 接受

### 方法 3：請他人協助驗證

**最後手段**（不推薦）：

1. **請信任的朋友/同事協助**：
   - 他們使用自己的電話號碼接收驗證碼
   - 將驗證碼分享給您
   - ⚠️ **風險**：帳號所有權可能產生問題

2. **只適用於**：
   - 緊急情況
   - 短期測試
   - 不建議長期使用

---

## Meta Business Suite 設定

### 步驟 1：建立或連結粉絲專頁

1. **在 Business Suite 中**：
   - 點擊「粉絲專頁」
   - 選擇「建立粉絲專頁」或「新增粉絲專頁」

2. **填寫專頁資訊**：
   - 專頁名稱：您的品牌名稱
   - 類別：選擇最適合的類別
   - 說明：簡短描述您的業務

3. **上傳圖片**：
   - 大頭貼照（建議 170x170px）
   - 封面照片（建議 820x312px）

### 步驟 2：建立或連結 Instagram 帳號（可選）

1. **連結 Instagram**：
   - 在 Business Suite 中點擊「Instagram」
   - 選擇「新增帳號」
   - 輸入 Instagram 帳號和密碼

2. **完成連結**：
   - Instagram 會出現在 Business Suite 中
   - 可統一管理 Facebook 和 Instagram 訊息

### 步驟 3：驗證商業帳號

1. **前往「設定」**：
   ```
   Business Suite → 設定 → 商業資訊
   ```

2. **商業驗證**：
   - 點擊「開始驗證」
   - 選擇驗證方式：
     - 電話號碼（如可用）
     - 商業文件（營業執照等）
     - 網站域名驗證

3. **上傳文件**：
   - 商業註冊證書
   - 銀行對帳單
   - 稅務文件
   - 其他官方文件

4. **等待審核**：
   - 通常需要 3-5 個工作天
   - 審核期間可繼續使用基本功能

---

## Facebook Messenger API 設定

### 步驟 1：建立 Facebook 應用程式

1. **訪問 Facebook Developers**：
   ```
   https://developers.facebook.com
   ```

2. **登入並建立應用程式**：
   - 點擊「我的應用程式」→「建立應用程式」
   - 選擇應用程式類型：「商業」或「其他」

3. **填寫應用程式資訊**：
   - 應用程式名稱：例如「Omni Chat Platform」
   - 聯絡電子郵件：您的企業郵箱
   - 應用程式用途：選擇「聊天」或「訊息傳遞」

4. **完成建立**：
   - 點擊「建立應用程式」
   - 記下「應用程式編號」（App ID）

### 步驟 2：新增 Messenger 產品

**⚠️ 找不到「新增 Messenger 產品」？請按照以下步驟操作：**

#### 方法 1：從左側選單尋找「產品」選項

1. **查看左側選單**：
   - 在左側邊欄中尋找「**產品**」或「**Products**」選項
   - 如果看不到，請滾動選單或點擊「**更多**」（「More」）展開
   - **產品選單通常在「應用程式設定」下方或上方**

2. **點擊「產品」**：
   - 進入產品頁面
   - 您會看到所有可用的產品列表

3. **新增 Messenger**：
   - 尋找「**Messenger**」卡片
   - 點擊「**設定**」或「**新增**」按鈕
   - 或點擊 Messenger 卡片本身

#### 方法 2：從主控板頂部尋找

1. **在主控板頁面頂部**：
   - 查看頁面右上角或頂部橫條
   - 尋找「**新增產品**」或「**Add Product**」按鈕
   - 點擊後會顯示產品選擇畫面

2. **選擇 Messenger**：
   - 在產品列表中選擇「**Messenger**」
   - 點擊「**設定**」

#### 方法 3：通過「使用案例」添加 Messenger ⭐⭐ 最新方法（2024）

**⚠️ 重要：如果您的介面顯示「應用程式自訂和要求」列表（而不是傳統的產品列表），請使用此方法：**

1. **在主控板頁面右上角**：
   - 尋找並點擊「**新增使用案例**」或「**Add Use Case**」按鈕
   - （通常在「主控板」標題的右上角）

2. **在彈出的使用案例列表中**：
   - 尋找「**Messenger**」或「**Messenger API**」相關選項
   - 或尋找「**傳送和接收訊息**」、「**Send and receive messages**」
   - 點擊 Messenger 相關的使用案例

3. **完成使用案例設定**：
   - 按照引導完成 Messenger 設定
   - 這會自動添加 Messenger 產品到您的應用程式

**❌ 如果「使用案例」列表中沒有 Messenger 選項**：

這是較複雜的情況。Messenger 可能因為以下原因未顯示：
- **應用程式類型限制**：某些應用程式類型可能不支持 Messenger
- **需要先完成其他步驟**：可能需要先完成某些必要動作或設定
- **Messenger 已存在但未顯示**：可能已經添加但通過其他方式顯示

**解決方案**：
1. **檢查左側選單是否已有 Messenger**：
   - 向下滾動左側選單
   - 查看是否有「**Messenger**」選項（可能在「使用案例」下方或其他位置）
   - 如果已存在，點擊進入設定

2. **檢查應用程式類型**（見下方方法 3E）

3. **直接訪問 Messenger 設定 URL**：
   ```
   https://developers.facebook.com/apps/2181619782322784/messenger/
   ```
   如果此 URL 可以訪問，說明 Messenger 可能已經添加或可以通過此 URL 添加

4. **使用傳統產品添加方法**（見下方方法 3B 和 3F）

#### 方法 3B：從主控板（Dashboard）新增產品（傳統方法）

**如果您在 Dashboard 頁面且被重定向，這是正常現象。請按照以下步驟：**

1. **確認您在主控板頁面**：
   - 網址類似：`https://developers.facebook.com/apps/24897182936590736/dashboard/`
   - ✅ 這是正確的起始位置

2. **在主控板頁面尋找「新增產品」按鈕**：
   - **方法 A**：查看頁面**頂部**，在「主控板」標題旁邊
     - 尋找「**+ 新增產品**」或「**+ Add Product**」按鈕
     - 通常在「新增使用案例」按鈕附近
   
   - **方法 B**：查看頁面**中間區域**
     - 尋找「**產品**」或「**Products**」區塊
     - 點擊「**瀏覽所有產品**」或「**Browse All Products**」
   
   - **方法 C**：如果看到「**應用程式自訂和要求**」區塊
     - 向下滾動
     - 尋找「**新增產品**」連結或按鈕

3. **點擊後會顯示產品列表**：
   - 在產品列表中尋找「**Messenger**」
   - 點擊 Messenger 卡片上的「**設定**」或「**Set up**」按鈕
   - 完成 Messenger 設定

#### 方法 3C：檢查必要動作（重要！）

**如果 `/add-platform/` 也被重定向，可能是因為有待完成的必要動作：**

1. **檢查左側選單的「必要動作」**：
   - 點擊左側選單中的「**必要動作**」或「**Required Actions**」
   - 查看是否有任何紅色警告或待完成項目
   - 常見項目：
     - ✅ **應用程式圖示（1024 x 1024）** ⭐ 必須完成
     - ✅ **用戶資料刪除** ⭐ 必須完成
     - 隱私政策 URL
     - 服務條款 URL

### 📋 完成必要動作的詳細步驟

#### 步驟 1：上傳應用程式圖示（1024 x 1024）

**要求**：
- 尺寸：**1024 x 1024 像素**（正方形）
- 格式：PNG 或 JPG
- 檔案大小：建議小於 1MB

**快速製作圖示的方法**：

**方法 A：使用線上工具**（最快速）
1. 訪問線上圖片編輯器：
   - https://www.canva.com/（免費，需要註冊）
   - https://www.remove.bg/（去背景）
   - https://www.pixlr.com/（線上 Photoshop）

2. 創建 1024x1024 的設計：
   - 選擇「自訂尺寸」→ 1024 x 1024
   - 設計您的應用程式圖示（可使用公司 Logo）
   - 下載為 PNG 格式

**方法 B：使用現有 Logo**
1. 如果有現有的 Logo：
   - 使用圖片編輯軟體（如 Paint、Photoshop、GIMP）
   - 調整大小為 1024 x 1024
   - 確保圖片清晰（建議使用向量圖或高解析度圖片）

**方法 C：臨時簡單圖示**（快速測試用）
1. 創建一個簡單的 1024x1024 彩色方塊
2. 或使用線上生成器：
   - https://placeholder.com/（生成測試圖片）
   - 訪問：`https://via.placeholder.com/1024` 即可下載

**上傳步驟**：
1. 在「必要動作」頁面點擊「**應用程式圖示**」
2. 點擊「**上傳**」或「**Upload**」
3. 選擇您的 1024x1024 圖片
4. 確認上傳成功
5. 點擊「**儲存**」或「**Save**」

#### 步驟 2：設定用戶資料刪除

**這是 Facebook 要求的數據刪除回呼 URL**，用於處理用戶請求刪除數據。

**快速設定方法**：

**方法 A：使用測試端點**（開發階段）
1. 在「必要動作」頁面點擊「**用戶資料刪除**」
2. 填入回呼 URL：
   ```
   https://your-domain.com/webhooks/facebook/data-deletion
   ```
   ⚠️ **注意**：必須是 HTTPS，本地測試可用 ngrok

**方法 B：臨時使用公開測試端點**（不推薦生產環境）
```
https://webhook.site/（可生成臨時測試 URL）
```

**實作範例（在您的伺服器中）**：

```javascript
// 在 src/routes/webhooks.js 或類似檔案中

// 用戶資料刪除回呼端點
app.post('/webhooks/facebook/data-deletion', async (req, res) => {
  try {
    const { signed_request } = req.body;
    
    // 解析 signed_request（如果有的話）
    // Facebook 會發送用戶的 user_id
    
    // 刪除用戶數據的邏輯
    const userId = req.body.user_id || req.query.user_id;
    
    if (userId) {
      // 在這裡實作刪除邏輯
      // 例如：從資料庫刪除用戶訊息、對話等
      await deleteUserData(userId, 'facebook');
      
      // 回傳確認
      res.json({
        url: `https://your-domain.com/deletion-status/${userId}`,
        confirmation_code: `${userId}_${Date.now()}`
      });
    } else {
      // 如果沒有 user_id，回傳空回應
      res.json({});
    }
  } catch (error) {
    console.error('數據刪除錯誤:', error);
    res.status(500).json({ error: '刪除失敗' });
  }
});

// 刪除狀態頁面（可選，用於顯示刪除進度）
app.get('/deletion-status/:userId', (req, res) => {
  res.send(`
    <html>
      <head><title>數據刪除確認</title></head>
      <body>
        <h1>您的數據已成功刪除</h1>
        <p>用戶 ID: ${req.params.userId}</p>
        <p>刪除時間: ${new Date().toLocaleString()}</p>
      </body>
    </html>
  `);
});
```

**如果暫時無法實作，可以使用臨時 URL**：

1. **使用 Webhook.site**（僅供測試）：
   - 訪問：https://webhook.site/
   - 複製唯一的 URL（例如：`https://webhook.site/abc123-def456`）
   - 在 Facebook 中填入這個 URL
   - ⚠️ **注意**：這只是臨時方案，正式環境需要實作真實端點

2. **使用 ngrok**（本地測試）：
   ```bash
   # 啟動您的伺服器
   npm start
   
   # 在另一個終端運行
   ngrok http 3000
   
   # 複製 HTTPS URL，例如：
   # https://abc123.ngrok.io
   
   # 在 Facebook 中填入：
   # https://abc123.ngrok.io/webhooks/facebook/data-deletion
   ```

**填入步驟**：
1. 在「必要動作」頁面點擊「**用戶資料刪除**」
2. 在「**回呼 URL**」欄位填入：
   ```
   https://your-domain.com/webhooks/facebook/data-deletion
   ```
   （或您的測試 URL）
3. 點擊「**儲存**」或「**Save**」

#### 步驟 3：完成後確認

1. **檢查必要動作頁面**：
   - 確認「應用程式圖示」和「用戶資料刪除」不再顯示警告
   - 兩個項目都應該顯示「✅ 已完成」或綠色勾選標記

2. **嘗試再次添加產品**：
   - 訪問：`https://developers.facebook.com/apps/[您的應用程式ID]/add-platform/`
   - 或在 Dashboard 尋找「+ 新增產品」按鈕
   - 現在應該可以成功添加 Messenger 了！

**如果還是被重定向（即使已完成必要動作）**：

這是較複雜的情況，請按照以下步驟逐一檢查：

#### 🔍 深度檢查步驟

**步驟 1：確認必要動作真正完成**
1. 再次檢查「必要動作」頁面
2. 確認兩個項目都顯示「✅ 已完成」
3. 如果還顯示警告，點擊每個項目確認已保存

**步驟 2：等待系統更新**
- Facebook 系統可能需要 5-10 分鐘來更新狀態
- 完成必要動作後，等待 10 分鐘再重試
- 關閉瀏覽器，重新開啟後再訪問

**步驟 3：檢查應用程式狀態和類型**
1. 訪問設定頁面：
   ```
   https://developers.facebook.com/apps/2181619782322784/settings/basic/
   ```
2. 檢查以下項目：
   - **應用程式狀態**：應該是「有效」或「Active」
   - **應用程式類型**：應為「商業」、「其他」或「消費者」
   - **應用程式模式**：開發模式應該可以添加產品

**步驟 4：清除瀏覽器快取和 Cookies**
1. **Chrome/Edge**：
   - 按 `Ctrl+Shift+Delete`
   - 選擇「快取圖片和檔案」和「Cookies 和其他網站資料」
   - 時間範圍選擇「全部時間」
   - 清除後重新登入 Facebook Developers

2. **Firefox**：
   - 按 `Ctrl+Shift+Delete`
   - 選擇「快取」和「Cookies」
   - 清除後重新登入

**步驟 5：使用不同的瀏覽器或無痕模式**
- 嘗試使用不同的瀏覽器（Chrome → Firefox → Edge）
- 或使用無痕模式：
  - Chrome: `Ctrl+Shift+N`
  - Firefox: `Ctrl+Shift+P`

**步驟 6：直接在主控板頁面尋找按鈕**
1. 訪問 Dashboard：
   ```
   https://developers.facebook.com/apps/2181619782322784/dashboard/
   ```
2. **仔細查看頁面上的每個按鈕**：
   - 頁面頂部（標題欄右側）
   - 頁面中間（可能有「產品」區塊）
   - 所有可見的按鈕和連結

**步驟 7：檢查是否有「產品」選單在左側**
1. 向下滾動左側選單
2. 尋找「**產品**」、「**Products**」或「**整合**」
3. 點擊後應該會顯示產品列表

**步驟 8：特殊情況 - Messenger 可能已隱藏或需要特殊操作**

**如果您已經：**
- ✅ 完成了必要動作（應用程式圖示、用戶資料刪除）
- ✅ 應用程式類型正確（商業與粉絲專頁）
- ✅ 在「新增使用案例」中找不到 Messenger

**可能的原因和解決方案：**

1. **Messenger 可能需要先建立粉絲專頁**：
   - 訪問：https://www.facebook.com/pages/create
   - 建立一個粉絲專頁
   - 然後再嘗試添加 Messenger

2. **Messenger 可能需要 Business Suite 設定**：
   - 訪問：https://business.facebook.com
   - 確保您的應用程式已連結到 Business Suite
   - 在 Business Suite 中設定 Messenger

3. **嘗試舊版介面**：
   - 在 URL 中添加 `?no_redirect=1`：
   ```
   https://developers.facebook.com/apps/2181619782322784/dashboard/?no_redirect=1
   ```
   - 或嘗試訪問：
   ```
   https://developers.facebook.com/apps/2181619782322784/products/
   ```

4. **檢查是否有「發佈」選項需要完成**：
   - 點擊左側選單的「**發佈**」（如果有）
   - 某些功能可能需要先發布才能使用

**步驟 9：使用 Graph API Explorer（進階方法）**
如果以上都不行，可以嘗試通過 API 檢查或添加產品：

1. **訪問 Graph API Explorer**：
   ```
   https://developers.facebook.com/tools/explorer/
   ```

2. **選擇您的應用程式**（右上角下拉選單）

3. **查詢已添加的產品**：
   - 在查詢框中輸入：`/me/products`
   - 或：`/{app-id}/products`
   - 查看是否有 Messenger 在列表中

4. **獲取 Access Token**：
   - 點擊「Generate Access Token」
   - 選擇權限：`manage_pages`, `pages_messaging`, `pages_show_list`

5. **這是一個複雜的方法，通常不推薦**，但如果其他方法都不行，可以嘗試

**步驟 10：檢查應用程式是否被限制**
1. 訪問應用程式設定：
   ```
   https://developers.facebook.com/apps/2181619782322784/settings/advanced/
   ```
2. 查看是否有任何限制或警告
3. 檢查「應用程式審查」狀態

**步驟 11：聯繫 Facebook 支援（最後手段）**
如果所有方法都失敗：

1. **訪問支援中心**：
   ```
   https://developers.facebook.com/support/
   ```

2. **提交問題報告**：
   - 選擇「應用程式設定和基本資訊」
   - 描述問題：「無法添加 Messenger 產品，所有 URL 都被重定向回 Dashboard」
   - 提供應用程式 ID：`2181619782322784`

3. **或在社群論壇詢問**：
   ```
   https://www.facebook.com/groups/fbdevelopers/
   ```

#### 方法 3F：從左側選單直接尋找產品選項

**即使被重定向，左側選單應該有產品選項：**

1. **查看左側選單的所有選項**：
   - 向下滾動左側選單
   - 尋找「**產品**」、「**Products**」或「**新增產品**」
   - 可能在「應用程式設定」下方

2. **或查看「應用程式設定」下的子選單**：
   - 點擊「**應用程式設定**」
   - 展開後查看是否有「**產品**」或「**整合**」選項

#### 方法 3D：使用應用程式設定頁面

**直接訪問設定頁面，然後尋找產品選項：**

```
https://developers.facebook.com/apps/2181619782322784/settings/
```

在設定頁面中：
- 查看「**基本**」（Basic）標籤
- 查看「**高級**」（Advanced）標籤
- 尋找「**產品**」或「**整合**」區塊
- 或在頁面頂部尋找「**新增產品**」按鈕

#### 方法 3E：檢查應用程式類型限制

**某些應用程式類型可能無法直接添加 Messenger**：

1. **檢查應用程式類型**：
   - 前往「應用程式設定」→「基本」
   - 查看「**應用程式類型**」或「**App Type**」
   - 確保類型為「**商業**」、「**其他**」或「**消費者**」

2. **如果需要，更改應用程式類型**：
   - 編輯應用程式設定
   - 更改為支援 Messenger 的類型
   - 保存後重試

⚠️ **注意**：如果所有 URL 都被重定向，這可能是 Facebook 的權限或狀態限制。請先完成所有「必要動作」，然後再嘗試。

#### 方法 4：從應用程式設定中尋找

1. **點擊左側選單的「應用程式設定」**：
   - 展開「應用程式設定」選單
   - 查看是否有「產品」子選項
   - 或查看設定頁面中的「產品」區塊

#### 方法 5：使用搜尋功能

1. **使用頂部搜尋列**：
   - 在右上角搜尋框輸入「Messenger」
   - 點擊搜尋結果中的「Messenger 設定」

---

### 完成新增 Messenger 後的操作

一旦找到並點擊 Messenger 的「設定」，您會進入 Messenger 設定頁面：

1. **生成存取權杖**：
   - 在 Messenger 設定頁面中
   - 找到「**存取權杖**」或「**Access Token**」區塊
   - 選擇您的粉絲專頁（如果還沒建立，需要先建立粉絲專頁）
   - 點擊「**生成權杖**」或「**Generate Token**」
   - **⚠️ 重要：立即複製並保存權杖**（這是敏感資訊，只會顯示一次！）

2. **設定 Webhook**：
   - 向下滾動找到「**Webhooks**」區塊
   - 點擊「**設定 Webhooks**」或「**Set up Webhooks**」
   - 填入 Webhook URL（稍後設定，見下方 Webhook 設定章節）

3. **確認 Messenger 已新增**：
   - 返回主控板
   - 您應該在左側選單看到「**Messenger**」選項
   - 或在產品列表中看到 Messenger 已啟用

### 步驟 3：設定應用程式權限

1. **前往「應用程式審查」**：
   ```
   應用程式設定 → 權限和功能
   ```

2. **申請必要權限**：
   - `pages_messaging`（Messenger 傳送訊息）
   - `pages_read_engagement`（讀取互動）
   - `pages_manage_metadata`（管理中繼資料）

3. **提交審查**（如需要）：
   - 填寫使用案例說明
   - 上傳螢幕截圖或影片
   - 等待審核（可能需要數週）

---

## Webhook 設定

### 步驟 1：準備 Webhook 端點

**在您的伺服器上設定接收端點**：

1. **Webhook URL 格式**：
   ```
   https://your-domain.com/webhooks/facebook
   ```

2. **使用 HTTPS**（必需）：
   - Facebook 要求 HTTPS
   - 使用有效的 SSL 憑證
   - 本地測試可使用 ngrok

3. **本地測試（ngrok）**：
   ```bash
   # 安裝 ngrok
   npm install -g ngrok
   
   # 啟動本地伺服器（例如在 3000 埠）
   npm start
   
   # 在另一個終端運行
   ngrok http 3000
   
   # 複製 HTTPS URL，例如：
   # https://abc123.ngrok.io
   ```

### 步驟 2：驗證 Webhook

1. **在 Facebook Developers 中**：
   - 前往 Messenger → Webhooks
   - 點擊「新增回呼網址」

2. **填入資訊**：
   ```
   回呼網址：https://your-domain.com/webhooks/facebook
   驗證權杖：your_verify_token（自訂，例如：omni_chat_verify_2024）
   ```

3. **訂閱事件**：
   ✅ `messages`（接收訊息）
   ✅ `messaging_postbacks`（按鈕點擊）
   ✅ `messaging_optins`（選擇加入）
   ✅ `messaging_deliveries`（已送達）
   ✅ `messaging_reads`（已讀）

4. **在您的伺服器上實作驗證**：

```javascript
// 範例：Express.js Webhook 驗證端點
app.get('/webhooks/facebook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  // 驗證權杖
  if (mode === 'subscribe' && token === 'your_verify_token') {
    console.log('✅ Webhook 驗證成功');
    res.status(200).send(challenge);
  } else {
    console.log('❌ Webhook 驗證失敗');
    res.sendStatus(403);
  }
});
```

### 步驟 3：接收訊息

**處理 Facebook 傳送的訊息**：

```javascript
// 範例：接收訊息端點
app.post('/webhooks/facebook', (req, res) => {
  const body = req.body;

  // 確認這是一個頁面訂閱
  if (body.object === 'page') {
    // 處理每個事件
    body.entry.forEach((entry) => {
      const webhookEvent = entry.messaging[0];
      
      // 取得發送者 ID 和訊息
      const senderId = webhookEvent.sender.id;
      const message = webhookEvent.message?.text;

      if (message) {
        // 處理訊息邏輯
        handleFacebookMessage(senderId, message);
      }
    });

    // 回傳 200 OK 給 Facebook
    res.status(200).send('EVENT_RECEIVED');
  } else {
    res.sendStatus(404);
  }
});
```

---

## 常見問題

### Q1: 無法接收 SMS 驗證碼

**A**: 請參閱上方「[SMS 驗證問題解決方案](#sms-驗證問題解決方案)」章節

### Q2: 找不到「新增 Messenger 產品」選項，或所有 URL 都被重定向到 Dashboard

**A**: 
- **原因**：通常是有待完成的「必要動作」，Facebook 會阻止添加產品直到完成
- **解決方法（按順序）**：
  1. **⭐ 最重要：檢查「必要動作」**（左側選單）
     - 點擊「必要動作」或「Required Actions」
     - 完成所有紅色警告項目（隱私政策、服務條款、應用程式設定等）
  
  2. **訪問應用程式設定頁面**：
     ```
     https://developers.facebook.com/apps/[您的應用程式ID]/settings/
     ```
     - 檢查並完成基本設定
     - 確認應用程式類型正確
  
  3. **從左側選單尋找「產品」選項**：
     - 向下滾動左側選單
     - 尋找「產品」或「Products」
  
  4. **在主控板頁面尋找「+ 新增產品」按鈕**（頁面頂部）
  
  5. **如果都不行**：
     - 確認您是應用程式的管理員
     - 檢查應用程式狀態是否正常
     - 聯繫 Facebook 支援
  
- **詳細步驟**：請參閱上方「[步驟 2：新增 Messenger 產品](#步驟-2新增-messenger-產品)」和「[快速故障排除](#-快速故障排除)」章節

### Q3: 註冊時找不到「使用電子郵件」選項

**A**: 
- 嘗試不同的瀏覽器
- 使用無痕模式
- 清除 Cookies 後重試
- 某些地區可能只提供 SMS 驗證

### Q4: Facebook 應用程式審查需要多久？

**A**:
- **基本審查**：1-3 個工作天
- **完整審查**（需要額外權限）：1-2 週
- **複雜應用程式**：可能需要更長

### Q5: Webhook 驗證失敗

**A**: 檢查：
- ✅ URL 必須是 HTTPS
- ✅ 驗證權杖必須完全匹配
- ✅ 伺服器必須回應 200 狀態碼
- ✅ 回應內容必須是 `hub.challenge` 值

### Q6: 如何測試 Webhook 而不公開伺服器？

**A**:
- 使用 **ngrok**（本地開發）
- 使用 **Cloudflare Tunnel**（免費）
- 使用 **localtunnel**（簡單）

### Q7: 可以跳過應用程式審查嗎？

**A**:
- ✅ **開發模式**：可以測試，但只能與管理員/測試使用者通訊
- ❌ **生產模式**：需要審查，才能與所有使用者通訊
- 💡 **建議**：先用開發模式測試，再提交審查

### Q8: Messenger API 費用

**A**:
- ✅ **基本使用**：免費
- 💰 **大量訊息**：超過限額後收費
- 📊 **詳細資訊**：https://developers.facebook.com/docs/messenger-platform/pricing

---

## 下一步：整合到 Omni 平台

完成 Facebook 設定後，您需要：

1. **建立 FacebookAdapter**：
   - 參考現有的 `WhatsAppAdapter.js` 和 `LineAdapter.js`
   - 實作 Facebook Messenger API 呼叫

2. **設定 Webhook 路由**：
   - 在 `src/routes/webhooks.js` 中新增 Facebook 路由
   - 處理驗證和訊息接收

3. **更新平台管理器**：
   - 在 `src/services/platformManager.js` 中註冊 Facebook
   - 配置 Facebook API 憑證

4. **前端整合**：
   - 在 React 應用中新增 Facebook 平台選項
   - 更新 `platformUtils.ts` 和 `platforms.ts`

---

## 快速檢查清單

### 註冊階段
- [ ] 建立 Facebook 個人帳號（如未擁有）
- [ ] 建立 Meta Business Suite 帳號
- [ ] 完成帳號驗證（郵箱或 SMS）
- [ ] 建立或連結粉絲專頁
- [ ] （可選）連結 Instagram 帳號

### 開發者設定
- [ ] 建立 Facebook 應用程式
- [ ] 新增 Messenger 產品
- [ ] 生成頁面存取權杖
- [ ] 設定 Webhook URL
- [ ] 驗證 Webhook（通過驗證測試）
- [ ] 訂閱必要的事件

### 程式碼整合
- [ ] 實作 FacebookAdapter
- [ ] 新增 Webhook 路由
- [ ] 更新平台管理器
- [ ] 更新前端平台選項
- [ ] 測試訊息收發
- [ ] 提交應用程式審查（生產環境）

---

## 聯絡支援

如遇到無法解決的問題：

1. **Meta Business 支援**：
   ```
   https://business.facebook.com/help
   ```

2. **Facebook Developers 社群**：
   ```
   https://www.facebook.com/groups/fbdevelopers/
   ```

3. **Messenger API 文件**：
   ```
   https://developers.facebook.com/docs/messenger-platform
   ```

---

## 總結

**即使遇到 SMS 驗證問題，仍有以下選項**：

✅ **使用電子郵件驗證**（最推薦）  
✅ **更換瀏覽器/裝置**  
✅ **使用 VPN 切換地區**  
✅ **聯繫 Meta 支援**  
✅ **或先整合 WeChat**（無 SMS 問題，更適合亞洲市場）

**建議優先順序**：
1. 嘗試電子郵件驗證
2. 如仍失敗，考慮 WeChat 整合
3. 同時繼續嘗試解決 Facebook SMS 問題

---

**最後更新**：2024-10-24  
**版本**：1.0

