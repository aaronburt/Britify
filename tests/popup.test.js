import { describe, it, expect, vi, beforeEach } from 'vitest';

const MOCK_SITES = [
  { id: 1, name: 'eBay', domain: 'ebay.com', targetDomain: 'ebay.co.uk' },
  { id: 2, name: 'Amazon', domain: 'amazon.com', targetDomain: 'amazon.co.uk' },
];

function createChromeMock(storageState = {}) {
  const { enabledSites = {}, globalEnabled = true } = storageState;

  return {
    runtime: {
      getURL: vi.fn(path => `chrome-extension://test-id/${path}`),
    },
    storage: {
      local: {
        get: vi.fn().mockResolvedValue({ enabledSites, globalEnabled }),
        set: vi.fn().mockResolvedValue(undefined),
      },
    },
  };
}

function setupDOM() {
  document.body.innerHTML = `
    <div class="container">
      <div class="header">
        <h1>Britify</h1>
        <p>Auto-redirect to .co.uk</p>
      </div>
      <div class="global-row">
        <div class="site-info">
          <span class="site-name">Global</span>
        </div>
        <label class="switch">
          <input type="checkbox" id="global-toggle">
          <span class="slider round"></span>
        </label>
      </div>
      <div class="toggles-wrapper" id="site-toggles"></div>
    </div>
  `;
}

function mockFetch() {
  return vi.fn().mockResolvedValue({
    json: () => Promise.resolve(structuredClone(MOCK_SITES)),
  });
}

async function triggerDOMContentLoaded() {
  document.dispatchEvent(new Event('DOMContentLoaded'));
  await vi.waitFor(() => {
    if (document.querySelectorAll('.site-row').length === 0) {
      throw new Error('DOM not ready');
    }
  });
}

describe('popup.js', () => {
  const listeners = [];
  const origAddEventListener = document.addEventListener.bind(document);

  beforeEach(() => {
    vi.resetModules();
    listeners.forEach(fn => document.removeEventListener('DOMContentLoaded', fn));
    listeners.length = 0;

    document.addEventListener = (type, fn, ...args) => {
      if (type === 'DOMContentLoaded') listeners.push(fn);
      return origAddEventListener(type, fn, ...args);
    };

    setupDOM();
  });

  async function loadPopup(storageState = {}) {
    globalThis.chrome = createChromeMock(storageState);
    globalThis.fetch = mockFetch();
    await import('../popup.js');
    await triggerDOMContentLoaded();
    return globalThis.chrome;
  }

  describe('site row rendering', () => {
    it('renders a row for each site', async () => {
      await loadPopup();
      const rows = document.querySelectorAll('.site-row');
      expect(rows).toHaveLength(2);
    });

    it('displays the site name in each row', async () => {
      await loadPopup();
      const names = document.querySelectorAll('.site-name');
      const siteNames = Array.from(names).slice(1);
      expect(siteNames[0].textContent).toBe('eBay');
      expect(siteNames[1].textContent).toBe('Amazon');
    });

    it('displays the domain in each row', async () => {
      await loadPopup();
      const domains = document.querySelectorAll('.site-domain');
      expect(domains[0].textContent).toBe('ebay.com');
      expect(domains[1].textContent).toBe('amazon.com');
    });

    it('sets site toggles to checked by default', async () => {
      await loadPopup();
      const toggles = document.querySelectorAll('.site-row input[type="checkbox"]');
      toggles.forEach(toggle => {
        expect(toggle.checked).toBe(true);
      });
    });

    it('sets individually disabled sites to unchecked', async () => {
      await loadPopup({ enabledSites: { 1: false } });
      const toggles = document.querySelectorAll('.site-row input[type="checkbox"]');
      expect(toggles[0].checked).toBe(false);
      expect(toggles[1].checked).toBe(true);
    });
  });

  describe('global toggle', () => {
    it('is checked when globalEnabled is true', async () => {
      await loadPopup({ globalEnabled: true });
      const globalToggle = document.getElementById('global-toggle');
      expect(globalToggle.checked).toBe(true);
    });

    it('is unchecked when globalEnabled is false', async () => {
      await loadPopup({ globalEnabled: false });
      const globalToggle = document.getElementById('global-toggle');
      expect(globalToggle.checked).toBe(false);
    });

    it('disables site toggles visually when unchecked', async () => {
      await loadPopup({ globalEnabled: false });
      const wrapper = document.getElementById('site-toggles');
      expect(wrapper.style.opacity).toBe('0.5');
      expect(wrapper.style.pointerEvents).toBe('none');
    });

    it('enables site toggles visually when checked', async () => {
      await loadPopup({ globalEnabled: true });
      const wrapper = document.getElementById('site-toggles');
      expect(wrapper.style.opacity).toBe('1');
      expect(wrapper.style.pointerEvents).toBe('auto');
    });

    it('persists state to storage when toggled', async () => {
      const chrome = await loadPopup({ globalEnabled: true });
      const globalToggle = document.getElementById('global-toggle');

      globalToggle.checked = false;
      globalToggle.dispatchEvent(new Event('change'));

      expect(chrome.storage.local.set).toHaveBeenCalledWith({ globalEnabled: false });
    });

    it('updates visual state when toggled off', async () => {
      await loadPopup({ globalEnabled: true });
      const globalToggle = document.getElementById('global-toggle');
      const wrapper = document.getElementById('site-toggles');

      globalToggle.checked = false;
      globalToggle.dispatchEvent(new Event('change'));

      expect(wrapper.style.opacity).toBe('0.5');
      expect(wrapper.style.pointerEvents).toBe('none');
    });
  });

  describe('site toggle interaction', () => {
    it('persists state to storage when a site is toggled off', async () => {
      const chrome = await loadPopup();
      const toggle = document.querySelectorAll('.site-row input[type="checkbox"]')[0];

      toggle.checked = false;
      toggle.dispatchEvent(new Event('change'));

      expect(chrome.storage.local.set).toHaveBeenCalledWith({
        enabledSites: expect.objectContaining({ 1: false }),
      });
    });

    it('persists state to storage when a site is toggled on', async () => {
      const chrome = await loadPopup({ enabledSites: { 1: false } });
      const toggle = document.querySelectorAll('.site-row input[type="checkbox"]')[0];

      toggle.checked = true;
      toggle.dispatchEvent(new Event('change'));

      expect(chrome.storage.local.set).toHaveBeenCalledWith({
        enabledSites: expect.objectContaining({ 1: true }),
      });
    });
  });

  describe('DOM structure', () => {
    it('appends rows inside the toggles-wrapper', async () => {
      await loadPopup();
      const wrapper = document.getElementById('site-toggles');
      const rows = wrapper.querySelectorAll(':scope > .site-row');
      expect(rows).toHaveLength(2);
      expect(rows[0].className).toBe('site-row');
    });

    it('each row has a switch label with slider', async () => {
      await loadPopup();
      const wrapper = document.getElementById('site-toggles');
      const switches = wrapper.querySelectorAll(':scope > .site-row .switch');
      expect(switches).toHaveLength(2);
      Array.from(switches).forEach(sw => {
        expect(sw.querySelector('.slider.round')).not.toBeNull();
        expect(sw.querySelector('input[type="checkbox"]')).not.toBeNull();
      });
    });
  });
});
