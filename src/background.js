import { getCachedReputation, cacheReputation } from "./cache.js";

let whitelist = [];
async function loadWhitelistFromList() {
  const response = await fetch(chrome.runtime.getURL("whitelist.json"));
  whitelist = await response.json();
}
loadWhitelistFromList();

// Load the whitelist from storage
chrome.storage.sync.get("whitelist", (data) => {
  whitelist = data.whitelist || [];
});

// Listen for changes to the whitelist
chrome.storage.onChanged.addListener((changes) => {
  if (changes.whitelist) {
    whitelist = changes.whitelist.newValue;
  }
});


function isSuspiciousUrl(url) {
  const domain = new URL(url).hostname;

  // Check if the domain is in the whitelist
  if (whitelist.some((whitelistedDomain) => domain.endsWith(whitelistedDomain))) {
    return false; 
  }

  // List of suspicious patterns
  const suspiciousPatterns = [
    /g00gle/, /facebok/, /paypa1/, /amaz0n/, /ebayy/, /yaho0/, /micr0soft/,
    /netfl1x/, /bankofamericaa/, /wellsfargoo/, /linked1n/, /tw1tter/,
    /login-/, /secure-/, /verify-/, /account-/, /update-/, /confirm-/,
    /\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/,
    /[^a-zA-Z0-9.-]/,
    /^.{30,}$/,
    /login/, /verify/, /account/, /security/, /update/, /confirm/, /password/,
    /banking/, /paypal/, /amazon/, /ebay/, /google/, /facebook/, /apple/,
  ];

  
  return suspiciousPatterns.some((pattern) => pattern.test(domain));
}

// Function to check domain reputation using Google Safe Browsing API
async function checkDomainReputation(url, apiKey) {
  const domain = new URL(url).hostname;

  // Check cache first
  const cachedResult = await getCachedReputation(domain);
  if (cachedResult) {
    console.log("Using cached result for:", domain);
    return cachedResult;
  }

  
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


chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "analyzeUrl") {
    const url = request.url;
    const apiKey = "Replace with your API key";

   
    if (isSuspiciousUrl(url)) {
      sendResponse({ isPhishing: true, reason: "Suspicious URL pattern detected." });
    } else {
     
      checkDomainReputation(url, apiKey).then((data) => {
        const isPhishing = data.matches ? true : false;
        const reason = isPhishing ? "Domain is known for phishing or malware." : "";
        sendResponse({ isPhishing, reason });
      });
    }

    return true;
  }
});