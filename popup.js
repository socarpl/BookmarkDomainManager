document.addEventListener('DOMContentLoaded', () => {
  // Handle Bookmarks by Domain button click
  document.getElementById('bookmarksByDomain').addEventListener('click', () => {
    chrome.tabs.create({
      url: 'bookmarks.html'
    });
  });

  // Handle Find Duplicates button click
  document.getElementById('findDuplicates').addEventListener('click', () => {
    chrome.tabs.create({
      url: 'duplicates.html'
    });
  });
}); 