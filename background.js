let cachedSites = null;

function escapeDomain(domain) {
  return domain.replace(/\./g, '\\.');
}

async function getSites() {
  if (!cachedSites) {
    const response = await fetch(chrome.runtime.getURL('sites.json'));
    cachedSites = await response.json();
  }
  return cachedSites;
}

async function loadAndApplyRules() {
  const [sites, { enabledSites = {}, globalEnabled = true }] = await Promise.all([
    getSites(),
    chrome.storage.local.get(['enabledSites', 'globalEnabled'])
  ]);

  const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
  const removeRuleIds = existingRules.map(r => r.id);

  const addRules = globalEnabled
    ? sites
        .filter(site => enabledSites[site.id] !== false)
        .map(site => ({
          id: site.id,
          priority: 1,
          action: {
            type: "redirect",
            redirect: {
              regexSubstitution: `https://www.${site.targetDomain}\\1`
            }
          },
          condition: {
            regexFilter: `^https?://(?:www\\.?)?${escapeDomain(site.domain)}(.*)`,
            resourceTypes: ["main_frame"]
          }
        }))
    : [];

  await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds, addRules });
}

chrome.runtime.onInstalled.addListener(loadAndApplyRules);
chrome.runtime.onStartup.addListener(loadAndApplyRules);

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && (changes.enabledSites || changes.globalEnabled)) {
    loadAndApplyRules();
  }
});
