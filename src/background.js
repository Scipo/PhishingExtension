import { getCachedReputation, cacheReputation } from "./cache.js";

const MAX_DYNAMIC_RULES = 4900;
const MAX_LOG_ENTRIES = 100;
const RULE_STORAGE_KEY = "dynamicRuleIds"; 
const WHITELIST_STORAGE_KEY = "whitelist";
const LOG_STORAGE_KEY = "blockedUrlsLog";
const apiKey = "YOUR KEY IN HERE"; 

let whitelist = [];

// Initialize whitelist
chrome.storage.sync.get(WHITELIST_STORAGE_KEY, (data) => {
  whitelist = data[WHITELIST_STORAGE_KEY] || [];
});

// Track whitelist changes
chrome.storage.onChanged.addListener((changes) => {
  if (changes[WHITELIST_STORAGE_KEY]) {
    whitelist = changes[WHITELIST_STORAGE_KEY].newValue;
  }
});

// Check if URL is suspicious
function isSuspiciousUrl(url) {
  const domain = new URL(url).hostname;

  if (whitelist.some((whitelisted) => domain.endsWith(whitelisted))) {
    console.log(`URL ${url} is whitelisted. Skipping block.`);
    return false;
  }

  const suspiciousPatterns = [
    /g00gle/, /facebok/, /paypa1/, /amaz0n/, /ebayy/, /yaho0/, /micr0soft/,
    /login-/, /secure-/, /verify-/, /account-/, /update-/, /confirm-/,
    /[^a-zA-Z0-9.-]/, /^.{30,}$/
  ];
  return suspiciousPatterns.some(pattern => pattern.test(domain));
}

async function logBlockedUrl(url, reason) {
   const logEntry = {
    url,
    reason,
    timestamp : new Date().toISOString(),
   };
  
   // Add new log entry and limit to MAX_LOG_ENTRIES
   const {[LOG_STORAGE_KEY] : logs = []} = await chrome.storage.local.get(LOG_STORAGE_KEY);
   const updatedLog = [...logs, logEntry].slice(-MAX_LOG_ENTRIES);

   //Save Log
   await chrome.storage.local.set({[LOG_STORAGE_KEY] : updatedLog});
   console.log("Log blockerd URL:", logEntry);

}

// Function to add a dynamic rule and manage FIFO
async function blockUrl(url) {
  const domain = new URL(url).hostname;
  const ruleId = Math.abs(Date.now() | 0); 
  console.log(ruleId);
  // Fetch stored rule IDs
  const { [RULE_STORAGE_KEY]: storedRuleIds = [] } = await chrome.storage.sync.get(RULE_STORAGE_KEY);

  // Define the new rule
  const newRule = {
    id: ruleId,
    priority: 1,
    action: { type: "block" },
    condition: {
      urlFilter: domain,
      resourceTypes: ["main_frame"]
    }
  };

  // Add the rule
  await chrome.declarativeNetRequest.updateDynamicRules({
    addRules: [newRule],
    removeRuleIds: []
  });

  // Update stored rule IDs
  const updatedRuleIds = [...storedRuleIds, ruleId];

  // Remove oldest rules if exceeding the limit
  if (updatedRuleIds.length > MAX_DYNAMIC_RULES) {
    const excess = updatedRuleIds.length - MAX_DYNAMIC_RULES;
    const rulesToRemove = updatedRuleIds.slice(0, excess);

    await chrome.declarativeNetRequest.updateDynamicRules({
      addRules: [],
      removeRuleIds: rulesToRemove
    });

    updatedRuleIds.splice(0, excess);
  }

  // Save updated rule IDs
  await chrome.storage.sync.set({ [RULE_STORAGE_KEY]: updatedRuleIds });
  console.log(`Blocked domain: ${domain}`);
}

// Function to validate stored rule IDs against active rules
async function validateRules() {
  const { [RULE_STORAGE_KEY]: storedRuleIds = [] } = await chrome.storage.sync.get(RULE_STORAGE_KEY);
  const activeRules = await chrome.declarativeNetRequest.getDynamicRules();
  const activeRuleIds = activeRules.map(rule => rule.id);

  // Find orphaned rules (stored but not active)
  const orphanedRuleIds = storedRuleIds.filter(id => !activeRuleIds.includes(id));

  if (orphanedRuleIds.length > 0) {
    // Remove orphaned IDs from storage
    const updatedRuleIds = storedRuleIds.filter(id => !orphanedRuleIds.includes(id));
    await chrome.storage.sync.set({ [RULE_STORAGE_KEY]: updatedRuleIds });
    console.log("Cleaned up orphaned rule IDs:", orphanedRuleIds);
  }
}

chrome.webNavigation.onBeforeNavigate.addListener((details) => {
  const url = details.url;
  if (isSuspiciousUrl(url)) {
    logBlockedUrl(details.url, "suspicious_pattern");
    chrome.tabs.update(details.tabId, {
      url: chrome.runtime.getURL("blocked/blocked.html") + `?url=${encodeURIComponent(url)}`
    });
  }else{
    checkDomainReputation(url, apiKey).then((data) => {
      const isPhishing = data.matches ? true : false;
      const reason = isPhishing ? "Domain is known for phishing or malware." : "";
      if(isPhishing){
        blockUrl(url).then(() => {
          sendResponse({ isPhishing: true, reason: "Suspicious URL pattern detected." });
        });
      }
    });
  }
}, { url: [{ schemes: ["http", "https"] }] });


// Periodically validate rules (e.g., every hour)
chrome.alarms.create("validateRules", { periodInMinutes: 60 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "validateRules") validateRules();
});

function reportFalsePositive(url){
  console.log('report false positive : ${url}');
  return {success : true};
}
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if(request.data === "reportFalsePositive"){
    const response = reportFalsePositive(request.url);
    sendResponse(response);
  }
  return true;
});



// Function to check domain reputation using Google Safe Browsing API
async function checkDomainReputation(url, apiKey) {
  const domain = new URL(url).hostname;

  // Check cache first
  const cachedResult = await getCachedReputation(domain);
  if (cachedResult) {
    console.log("Using cached result for:", domain);
    return cachedResult;
  }

  // If not cached, make an API call
  const apiUrl = `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${apiKey}`;
  const requestBody = {
    client: { clientId: "phishing-detector", clientVersion: "1.0" },
    threatInfo: {
      threatTypes: ["MALWARE", "SOCIAL_ENGINEERING"],
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


// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "analyzeUrl") {
    const url = request.url;
    // Check if the URL is suspicious
    if (isSuspiciousUrl(url)) {
      blockUrl(url).then(() => {
        sendResponse({ isPhishing: true, reason: "Suspicious URL pattern detected." });
      })
    } else {
      // Check domain reputation
      checkDomainReputation(url, apiKey).then((data) => {
        const isPhishing = data.matches ? true : false;
        const reason = isPhishing ? "Domain is known for phishing or malware." : "";
        if(isPhishing){
          blockUrl(url).then(() => {
            sendResponse({ isPhishing: true, reason: "Suspicious URL pattern detected." });
          });
        }
      });
    }

    return true; // Required for async response
  }
});

