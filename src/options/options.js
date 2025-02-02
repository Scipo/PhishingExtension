const domainInput = document.getElementById("domainInput");
const addButton = document.getElementById("addButton");
const whitelistElement = document.getElementById("whitelist");

// Load the whitelist from storage and display it
function loadWhitelist() {
  chrome.storage.sync.get("whitelist", (data) => {
    const whitelist = data.whitelist || [];
    updateWhitelistUI(whitelist);
  });
}

// Add a domain to the whitelist
addButton.addEventListener("click", () => {
  const domain = domainInput.value.trim();
  if (domain) {
    chrome.storage.sync.get("whitelist", (data) => {
      const whitelist = data.whitelist || [];
      if (!whitelist.includes(domain)) {
        whitelist.push(domain);
        chrome.storage.sync.set({ whitelist }, () => {
          updateWhitelistUI(whitelist);
          domainInput.value = "";
        });
      }
    });
  }
});


function removeDomain(domain) {
  chrome.storage.sync.get("whitelist", (data) => {
    const whitelist = data.whitelist || [];
    const updatedWhitelist = whitelist.filter((item) => item !== domain);
    chrome.storage.sync.set({ whitelist: updatedWhitelist }, () => {
      updateWhitelistUI(updatedWhitelist);
    });
  });
}


function updateWhitelistUI(whitelist) {
  whitelistElement.innerHTML = whitelist
    .map(
      (domain) => `
    <li>
      ${domain}
      <button class="remove-button" data-domain="${domain}">Remove</button>
    </li>
  `
    )
    .join("");

  
  document.querySelectorAll(".remove-button").forEach((button) => {
    button.addEventListener("click", () => {
      const domain = button.getAttribute("data-domain");
      removeDomain(domain);
    });
  });
}


loadWhitelist();