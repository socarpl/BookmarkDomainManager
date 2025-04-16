chrome.action.onClicked.addListener((tab) => {
  chrome.tabs.create({
    url: 'bookmarks.html'
  });
}); 