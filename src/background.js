import { getCachedReputation, cacheReputation, clearExpiredCache} from "./cache/cache";

function isSuspiciousURL(url){
    const domain = new URL(url).hostname;
    const suspiciousPatterns = [
        /g00gle/, /facebok/, /paypa1/, /amaz0n/, /ebayy/
      ];
     return suspiciousPatterns.some(pattern => pattern.test(domain));
}

chrome.runtime.onInstalled.addListener(() =>{
  chrome.alarms.create("clearExpiredCache", { periodInMinutes: 24 * 60 });
});

// Listen for the alarm and clear expired cache entries
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "clearExpiredCache") {
    clearExpiredCache();
  }
});

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install" || details.reason === "update") {
    clearExpiredCache();
  }
});

function hasValidSSL(url){
    return new Promise((resolve) => {
        fetch.url, {mode : "no-cors"}
    }).then(() => resolve(true))
    .catch(() => resolve(false));
}

async function checkDomainReputation(url, apiKey) {
    const domain = new URL(url).hostname;
    //check cache
    const cachedResults = await getCachedReputation(domain);
    if(cachedResults){
      console.log("Using cached result for:", domain);
      return cachedResults;
    }

    const apiUrl = `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${apiKey}`;
    const requestBody = {
      client: { clientId: "phishing-detector", clientVersion: "1.0" },
      threatInfo: {
        threatTypes: ["MALWARE", "SOCIAL_ENGINEERING", "UNWANTED_SOFTWARE"],
        platformTypes: ["ANY_PLATFORM"],
        threatEntryTypes: ["URL"],
        threatEntries: [{ url }],
      },
    };
      
    const response = await fetch(apiUrl, {
      method: "POST",
      body: JSON.stringify(requestBody),
    });
    const data = await response.json();
  
    // Cache the result
    await cacheReputation(domain, data);
  
    return data;
  }
  
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "analyzeUrl") {
      const url = request.url;
      const apiKey = "YOUR_GOOGLE_SAFE_BROWSING_API_KEY"; // Replace with your API key
      let isPhishing = false;
      let reason = "";
  
     
      if (isSuspiciousURL(url)) {
        isPhishing = true;
        reason = "Suspicious URL pattern detected.";
      }
  
      hasValidSSL(url).then((isValid) => {
        if (!isValid) {
          isPhishing = true;
          reason = "Invalid or missing SSL certificate.";
        }
  
        checkDomainReputation(url, apiKey).then((data) => {
            isPhishing = data.matches ? true : false;
            reason = isPhishing ? "Domain is known for phishing or malware." : "";
            sendResponse({ isPhishing, reason });
        });
      });
      return true; 
    }
  });