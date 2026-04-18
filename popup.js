document.addEventListener('DOMContentLoaded', async () => {
  const togglesWrapper = document.getElementById('site-toggles');
  const globalToggle = document.getElementById('global-toggle');

  const [sites, { enabledSites = {}, globalEnabled = true }] = await Promise.all([
    fetch(chrome.runtime.getURL('sites.json')).then(r => r.json()),
    chrome.storage.local.get(['enabledSites', 'globalEnabled'])
  ]);

  function setGlobalState(enabled) {
    togglesWrapper.style.opacity = enabled ? '1' : '0.5';
    togglesWrapper.style.pointerEvents = enabled ? 'auto' : 'none';
  }

  function createSiteRow(site) {
    const row = document.createElement('div');
    row.className = 'site-row';

    const info = document.createElement('div');
    info.className = 'site-info';
    info.innerHTML = `<span class="site-name">${site.name}</span><span class="site-domain">${site.domain}</span>`;

    const label = document.createElement('label');
    label.className = 'switch';

    const toggle = document.createElement('input');
    toggle.type = 'checkbox';
    toggle.checked = enabledSites[site.id] !== false;

    const slider = document.createElement('span');
    slider.className = 'slider round';

    label.append(toggle, slider);
    row.append(info, label);

    toggle.addEventListener('change', () => {
      enabledSites[site.id] = toggle.checked;
      chrome.storage.local.set({ enabledSites });
    });

    return row;
  }

  globalToggle.checked = globalEnabled;
  setGlobalState(globalEnabled);

  globalToggle.addEventListener('change', () => {
    const enabled = globalToggle.checked;
    chrome.storage.local.set({ globalEnabled: enabled });
    setGlobalState(enabled);
  });

  const fragment = document.createDocumentFragment();
  sites.forEach(site => fragment.appendChild(createSiteRow(site)));
  togglesWrapper.appendChild(fragment);
});
