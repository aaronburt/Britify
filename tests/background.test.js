import { describe, it, expect, vi, beforeEach } from 'vitest';

const MOCK_SITES = [
  { id: 1, name: 'eBay', domain: 'ebay.com', targetDomain: 'ebay.co.uk' },
  { id: 2, name: 'Amazon', domain: 'amazon.com', targetDomain: 'amazon.co.uk' },
  { id: 3, name: 'Google', domain: 'google.com', targetDomain: 'google.co.uk' },
];

function createChromeMock(storageState = {}) {
  const { enabledSites = {}, globalEnabled = true } = storageState;

  return {
    runtime: {
      getURL: vi.fn(path => `chrome-extension://test-id/${path}`),
      onInstalled: { addListener: vi.fn() },
      onStartup: { addListener: vi.fn() },
    },
    storage: {
      local: {
        get: vi.fn().mockResolvedValue({ enabledSites, globalEnabled }),
        set: vi.fn().mockResolvedValue(undefined),
      },
      onChanged: { addListener: vi.fn() },
    },
    declarativeNetRequest: {
      getDynamicRules: vi.fn().mockResolvedValue([]),
      updateDynamicRules: vi.fn().mockResolvedValue(undefined),
    },
  };
}

function mockFetch() {
  return vi.fn().mockResolvedValue({
    json: () => Promise.resolve(structuredClone(MOCK_SITES)),
  });
}

describe('background.js', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  async function loadBackground(storageState = {}) {
    globalThis.chrome = createChromeMock(storageState);
    globalThis.fetch = mockFetch();
    await import('../background.js');
    return globalThis.chrome;
  }

  function getLoadAndApplyRules(chrome) {
    return chrome.runtime.onInstalled.addListener.mock.calls[0][0];
  }

  describe('listener registration', () => {
    it('registers onInstalled listener', async () => {
      const chrome = await loadBackground();
      expect(chrome.runtime.onInstalled.addListener).toHaveBeenCalledOnce();
    });

    it('registers onStartup listener', async () => {
      const chrome = await loadBackground();
      expect(chrome.runtime.onStartup.addListener).toHaveBeenCalledOnce();
    });

    it('registers storage.onChanged listener', async () => {
      const chrome = await loadBackground();
      expect(chrome.storage.onChanged.addListener).toHaveBeenCalledOnce();
    });

    it('passes loadAndApplyRules directly to onInstalled and onStartup', async () => {
      const chrome = await loadBackground();
      const installedCb = chrome.runtime.onInstalled.addListener.mock.calls[0][0];
      const startupCb = chrome.runtime.onStartup.addListener.mock.calls[0][0];
      expect(installedCb).toBe(startupCb);
    });
  });

  describe('loadAndApplyRules', () => {
    it('creates redirect rules for all sites when global is enabled', async () => {
      const chrome = await loadBackground({ globalEnabled: true });
      const loadAndApplyRules = getLoadAndApplyRules(chrome);
      await loadAndApplyRules();

      const call = chrome.declarativeNetRequest.updateDynamicRules.mock.calls[0][0];
      expect(call.addRules).toHaveLength(3);
      expect(call.addRules[0].id).toBe(1);
      expect(call.addRules[1].id).toBe(2);
      expect(call.addRules[2].id).toBe(3);
    });

    it('creates no rules when global is disabled', async () => {
      const chrome = await loadBackground({ globalEnabled: false });
      const loadAndApplyRules = getLoadAndApplyRules(chrome);
      await loadAndApplyRules();

      const call = chrome.declarativeNetRequest.updateDynamicRules.mock.calls[0][0];
      expect(call.addRules).toHaveLength(0);
    });

    it('excludes individually disabled sites', async () => {
      const chrome = await loadBackground({
        globalEnabled: true,
        enabledSites: { 2: false },
      });
      const loadAndApplyRules = getLoadAndApplyRules(chrome);
      await loadAndApplyRules();

      const call = chrome.declarativeNetRequest.updateDynamicRules.mock.calls[0][0];
      expect(call.addRules).toHaveLength(2);
      expect(call.addRules.map(r => r.id)).toEqual([1, 3]);
    });

    it('removes all existing dynamic rules before adding new ones', async () => {
      const chrome = await loadBackground();
      chrome.declarativeNetRequest.getDynamicRules.mockResolvedValue([
        { id: 99 }, { id: 100 },
      ]);
      const loadAndApplyRules = getLoadAndApplyRules(chrome);
      await loadAndApplyRules();

      const call = chrome.declarativeNetRequest.updateDynamicRules.mock.calls[0][0];
      expect(call.removeRuleIds).toEqual([99, 100]);
    });

    it('builds correct redirect rule structure', async () => {
      const chrome = await loadBackground({ globalEnabled: true });
      const loadAndApplyRules = getLoadAndApplyRules(chrome);
      await loadAndApplyRules();

      const rule = chrome.declarativeNetRequest.updateDynamicRules.mock.calls[0][0].addRules[0];

      expect(rule).toEqual({
        id: 1,
        priority: 1,
        action: {
          type: 'redirect',
          redirect: {
            regexSubstitution: 'https://www.ebay.co.uk\\1',
          },
        },
        condition: {
          regexFilter: '^https?://(?:www\\.?)?ebay\\.com(.*)',
          resourceTypes: ['main_frame'],
        },
      });
    });

    it('escapes dots in domain for regexFilter', async () => {
      const chrome = await loadBackground({ globalEnabled: true });
      const loadAndApplyRules = getLoadAndApplyRules(chrome);
      await loadAndApplyRules();

      const rules = chrome.declarativeNetRequest.updateDynamicRules.mock.calls[0][0].addRules;
      rules.forEach(rule => {
        expect(rule.condition.regexFilter).not.toMatch(/(?<!\\)\.[a-z]/);
      });
    });
  });

  describe('sites.json caching', () => {
    it('fetches sites.json only once across multiple calls', async () => {
      const chrome = await loadBackground();
      const loadAndApplyRules = getLoadAndApplyRules(chrome);

      await loadAndApplyRules();
      await loadAndApplyRules();
      await loadAndApplyRules();

      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('storage.onChanged listener', () => {
    it('reloads rules when enabledSites changes', async () => {
      const chrome = await loadBackground();
      const storageCb = chrome.storage.onChanged.addListener.mock.calls[0][0];

      chrome.declarativeNetRequest.updateDynamicRules.mockClear();
      storageCb({ enabledSites: {} }, 'local');
      await vi.waitFor(() => {
        expect(chrome.declarativeNetRequest.updateDynamicRules).toHaveBeenCalledOnce();
      });
    });

    it('reloads rules when globalEnabled changes', async () => {
      const chrome = await loadBackground();
      const storageCb = chrome.storage.onChanged.addListener.mock.calls[0][0];

      chrome.declarativeNetRequest.updateDynamicRules.mockClear();
      storageCb({ globalEnabled: {} }, 'local');
      await vi.waitFor(() => {
        expect(chrome.declarativeNetRequest.updateDynamicRules).toHaveBeenCalledOnce();
      });
    });

    it('ignores changes from non-local storage areas', async () => {
      const chrome = await loadBackground();
      const storageCb = chrome.storage.onChanged.addListener.mock.calls[0][0];

      chrome.declarativeNetRequest.updateDynamicRules.mockClear();
      await storageCb({ enabledSites: {} }, 'sync');

      expect(chrome.declarativeNetRequest.updateDynamicRules).not.toHaveBeenCalled();
    });

    it('ignores changes to unrelated storage keys', async () => {
      const chrome = await loadBackground();
      const storageCb = chrome.storage.onChanged.addListener.mock.calls[0][0];

      chrome.declarativeNetRequest.updateDynamicRules.mockClear();
      await storageCb({ someOtherKey: {} }, 'local');

      expect(chrome.declarativeNetRequest.updateDynamicRules).not.toHaveBeenCalled();
    });
  });
});
