async function loadAndApplyRules() {
  const response = await fetch(chrome.runtime.getURL('sites.json'));
  const sites = await response.json();

  const { enabledSites = {}, globalEnabled = true } = await chrome.storage.local.get(['enabledSites', 'globalEnabled']);

  const rulesToAdd = [];
  const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
  const existingRuleIds = existingRules.map(r => r.id);

  if (globalEnabled) {
    sites.forEach(site => {
      const isEnabled = enabledSites[site.id] !== false;
      if (isEnabled) {
        rulesToAdd.push({
          id: site.id,
          priority: 1,
          action: {
            type: "redirect",
            redirect: {
              regexSubstitution: `https://www.${site.targetDomain}\\1`
            }
          },
          condition: {
            regexFilter: `^https?://(?:www\\.?)?${site.domain.replace(/\./g, '\\.')}(.*)`,
            resourceTypes: ["main_frame"]
          }
        });
      }
    });
  }

  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: existingRuleIds,
    addRules: rulesToAdd
  });
}

chrome.runtime.onInstalled.addListener(() => {
  loadAndApplyRules();
});

chrome.runtime.onStartup.addListener(() => {
  loadAndApplyRules();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && (changes.enabledSites || changes.globalEnabled)) {
    loadAndApplyRules();
  }
});
