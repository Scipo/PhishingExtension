// Extract the blocked URL from the query parameter
const params = new URLSearchParams(window.location.search);
const blockedUrl = params.get('url');
document.getElementById('blocked-url').textContent = blockedUrl;

// Go back to the previous page
document.getElementById('back-button').addEventListener('click', () => {
  window.history.back();
});

// Handle false positive reporting
document.getElementById('report-button').addEventListener('click', () => {
  const reportStatus = document.getElementById('report-status');
  reportStatus.textContent = "Reporting false positive...";

  // Send the blocked URL to the background script for reporting
  chrome.runtime.sendMessage(
    { action: "reportFalsePositive", url: blockedUrl },
    (response) => {
      if (response?.success) {
        reportStatus.textContent = "Thank you for reporting!";
      } else {
        reportStatus.textContent = "Failed to report. Please try again.";
      }
    }
  );
});