document.addEventListener('DOMContentLoaded', async () => {
  const togglesWrapper = document.getElementById('site-toggles');
  const globalToggle = document.getElementById('global-toggle');

  const response = await fetch(chrome.runtime.getURL('sites.json'));
  const sites = await response.json();

  let { enabledSites = {}, globalEnabled = true } = await chrome.storage.local.get(['enabledSites', 'globalEnabled']);

  function setGlobalState(enabled) {
    togglesWrapper.style.opacity = enabled ? '1' : '0.5';
    togglesWrapper.style.pointerEvents = enabled ? 'auto' : 'none';
  }

  globalToggle.checked = globalEnabled;
  setGlobalState(globalEnabled);

  globalToggle.addEventListener('change', async (e) => {
    globalEnabled = e.target.checked;
    await chrome.storage.local.set({ globalEnabled });
    setGlobalState(globalEnabled);
  });

  sites.forEach(site => {
    const isEnabled = enabledSites[site.id] !== false;

    const row = document.createElement('div');
    row.className = 'site-row';

    const info = document.createElement('div');
    info.className = 'site-info';
    info.innerHTML = `<span class="site-name">${site.name}</span><span class="site-domain">${site.domain}</span>`;

    const label = document.createElement('label');
    label.className = 'switch';

    const toggle = document.createElement('input');
    toggle.type = 'checkbox';
    toggle.checked = isEnabled;

    const slider = document.createElement('span');
    slider.className = 'slider round';

    label.appendChild(toggle);
    label.appendChild(slider);

    row.appendChild(info);
    row.appendChild(label);

    togglesWrapper.appendChild(row);

    toggle.addEventListener('change', async (e) => {
      enabledSites[site.id] = e.target.checked;
      await chrome.storage.local.set({ enabledSites });
    });
  });
});
