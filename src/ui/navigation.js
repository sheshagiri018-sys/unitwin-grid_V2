/**
 * navigation.js â€” UNITWIN GRID V2
 * Single-page application navigation: page switching, nav-active state, page title.
 */

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let _currentPage = 'dashboard';

/** Human-readable title shown in the top bar for each page. */
const PAGE_TITLES = {
  dashboard:    'Dashboard',
  monitoring:   'Live Monitoring',
  energyFlow:   'Energy Flow',
  analytics:    'Analytics',
  intelligence: 'Intelligence Engine',
  deviceHealth: 'Device Health',
  alerts:       'Alerts',
  settings:     'Settings',
  scenarios:    'Scenarios & Demo',
};

// ---------------------------------------------------------------------------
// Core navigation
// ---------------------------------------------------------------------------

/**
 * Switch to the specified page.
 * Hides all .page sections, reveals #page-{pageId},
 * refreshes .nav-active class on sidebar items, and updates #currentPageTitle.
 * @param {string} pageId
 */
export function navigateTo(pageId) {
  // 1. Hide all pages
  document.querySelectorAll('.page').forEach((el) => {
    el.classList.remove('page--active');
    el.style.display = 'none';
  });

  // 2. Show target page
  const target = document.getElementById(`page-${pageId}`);
  if (target) {
    target.classList.add('page--active');
    target.style.display = '';
  } else {
    console.warn(`[navigation] #page-${pageId} not found in DOM.`);
  }

  // 3. Update nav-active on all [data-page] elements
  document.querySelectorAll('[data-page]').forEach((el) => {
    el.classList.toggle('nav-active', el.dataset.page === pageId);
  });

  // 4. Update page title
  const titleEl = document.getElementById('currentPageTitle');
  if (titleEl) titleEl.textContent = PAGE_TITLES[pageId] ?? pageId;

  _currentPage = pageId;

  // 5. Notify other modules via a custom DOM event
  window.dispatchEvent(
    new CustomEvent('unitwin:navigate', { detail: { pageId } })
  );
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Initialise navigation.
 * Attaches a delegated click handler on document for all [data-page] elements
 * and navigates to the default page ('dashboard') on startup.
 */
export function initNavigation() {
  document.addEventListener('click', (e) => {
    const trigger = e.target.closest('[data-page]');
    if (!trigger) return;
    e.preventDefault();
    navigateTo(trigger.dataset.page);
  });

  // Show initial page
  navigateTo(_currentPage);
}

/**
 * Return the ID of the currently active page.
 * @returns {string}
 */
export function getCurrentPage() {
  return _currentPage;
}
