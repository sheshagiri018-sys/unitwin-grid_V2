/**
 * navigation.js â€” UNITWIN GRID V2
 * Single-page application navigation: page switching, nav-active state, page title.
 */

let _currentPage = 'dashboard';

const PAGE_TITLES = {
  dashboard: 'Command Center â€” Dashboard',
  twin: '3D Digital Twin View',
  monitoring: 'Live Sensor Monitoring',
  energyflow: 'Energy Flow Diagram',
  energyFlow: 'Energy Flow Diagram',
  devicehealth: 'Device Health â€” ESP32',
  analytics: 'Historical Analytics',
  intelligence: 'Twin Intelligence',
  scenarios: 'Scenario Simulator',
  whatif: 'What-If Analysis',
  alerts: 'Alert Center',
  architecture: 'System Architecture',
  hardware: 'Hardware Reference',
  reports: 'Engineering Report',
  settings: 'Settings'
};

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

  // 4. Update page title (case-insensitive or exact match)
  const titleEl = document.getElementById('currentPageTitle');
  if (titleEl) {
    titleEl.textContent = PAGE_TITLES[pageId] ?? PAGE_TITLES[pageId.toLowerCase()] ?? pageId;
  }

  _currentPage = pageId;

  // 5. Notify other modules via a custom DOM event
  window.dispatchEvent(
    new CustomEvent('unitwin:navigate', { detail: { pageId } })
  );
}

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

export function getCurrentPage() {
  return _currentPage;
}
