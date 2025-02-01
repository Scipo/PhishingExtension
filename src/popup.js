import { clearExpiredCache } from "./cache/cache";
// Clear expired cache entries when the popup is opened
clearExpiredCache();

// Rest of the popup logic
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const url = tabs[0].url;
    chrome.runtime.sendMessage({ action: "analyzeUrl", url }, (response) => {
      const resultDiv = document.getElementById("result");
      if (response.isPhishing) {
        resultDiv.innerHTML = `
          <p style="color: red;">⚠️ Warning: This website may be a phishing site!</p>
          <p>Reason: ${response.reason}</p>
        `;
      } else {
        resultDiv.innerHTML = `
          <p style="color: green;">✅ This website appears to be safe.</p>
        `;
      }
    });
  });