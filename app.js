/* Local section routing and nested disclosures; no server rewrites required. */
(() => {
  'use strict';
  const sectionNames = ['work', 'projects', 'skills', 'passions', 'contact'];
  const views = Array.from(document.querySelectorAll('[data-view]'));
  const navigation = Array.from(document.querySelectorAll('nav [data-section]'));
  const sectionSelect = document.getElementById('section-select');
  const toolbar = document.querySelector('.site-toolbar');
  const triggers = Array.from(document.querySelectorAll('[data-expand]'));
  let currentRoute;
  history.scrollRestoration = 'manual';

  function revealTarget(target) {
    const anchor = target.closest('.work-role-control, .entry-actions') || target;
    window.scrollTo({
      top: Math.max(0, window.scrollY + anchor.getBoundingClientRect().top - toolbar.offsetHeight - 18),
      behavior: 'instant'
    });
  }

  function setExpanded(id, expanded, returnFocus = false) {
    const button = triggers.find(item => item.dataset.expand === id);
    if (!button) return;
    const content = document.getElementById(button.getAttribute('aria-controls'));
    if (expanded) {
      // A direct nested link must also reveal every enclosing disclosure.
      let parent = content.parentElement.closest('[role="region"]');
      while (parent) {
        const parentButton = triggers.find(item => item.getAttribute('aria-controls') === parent.id);
        if (parentButton) setExpanded(parentButton.dataset.expand, true);
        parent = parent.parentElement.closest('[role="region"]');
      }
    }
    content.hidden = !expanded;
    button.setAttribute('aria-expanded', String(expanded));
    button.querySelector('[data-label]').textContent = expanded ? 'Collapse' : 'Expand';
    const wrapper = button.closest('.portfolio-entry');
    if (wrapper) wrapper.classList.toggle('is-open',
      Array.from(wrapper.querySelectorAll('[data-expand]')).some(item => item.getAttribute('aria-expanded') === 'true'));
    const title = button.dataset.disclosureLabel || document.getElementById('title-' + id).textContent;
    button.setAttribute('aria-label', `${expanded ? 'Collapse' : 'Expand'} ${title} details`);
    if (returnFocus) {
      button.focus({ preventScroll: true });
      const rect = (button.closest('.work-role-control, .entry-actions') || button).getBoundingClientRect();
      const headerBottom = toolbar.getBoundingClientRect().bottom;
      if (rect.top < headerBottom + 12 || rect.bottom > innerHeight - 12) {
        revealTarget(button);
      }
    }
  }

  function readRoute() {
    const [requested, ...entries] = location.hash.slice(1).toLowerCase().split('/');
    const section = sectionNames.includes(requested) ? requested : 'work';
    return { section, entries: entries.filter(id => triggers.some(button =>
      button.dataset.expand === id && button.closest('[data-view]').dataset.view === section)) };
  }

  function renderRoute({ initial = false } = {}) {
    const route = readRoute();
    const key = route.section + '/' + route.entries.join('/');
    if (!initial && key === currentRoute) return;
    currentRoute = key;
    views.forEach(view => { view.hidden = view.dataset.view !== route.section; });
    navigation.forEach(link => {
      if (link.dataset.section === route.section) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    sectionSelect.value = route.section;
    document.title = route.section[0].toUpperCase() + route.section.slice(1) + ' | ' + document.querySelector('.name').textContent;
    route.entries.forEach(id => setExpanded(id, true));
    const lastEntry = route.entries[route.entries.length - 1];
    const target = lastEntry ? triggers.find(button => button.dataset.expand === lastEntry)
      : document.getElementById('heading-' + route.section);
    if (!initial) {
      target.focus({ preventScroll: true });
      revealTarget(target);
    } else if (location.hash) {
      requestAnimationFrame(() => revealTarget(target));
    }
  }

  function navigate(section) {
    if (section === readRoute().section) {
      const heading = document.getElementById('heading-' + section);
      heading.focus({ preventScroll: true });
      revealTarget(heading);
      return;
    }
    history.pushState(null, '', location.href.split('#')[0] + '#' + section);
    renderRoute();
  }

  document.querySelectorAll('[data-section]').forEach(link => {
    link.addEventListener('click', event => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      navigate(link.dataset.section);
    });
  });
  sectionSelect.addEventListener('change', () => navigate(sectionSelect.value));
  triggers.forEach(button => button.addEventListener('click', () =>
    setExpanded(button.dataset.expand, button.getAttribute('aria-expanded') !== 'true')));
  document.querySelectorAll('[data-collapse]').forEach(button => button.addEventListener('click', () =>
    setExpanded(button.dataset.collapse, false, true)));
  document.querySelector('.skip').addEventListener('click', event => {
    event.preventDefault();
    document.getElementById('main').focus({ preventScroll: true });
    revealTarget(document.getElementById('main'));
  });
  window.addEventListener('popstate', () => renderRoute());
  window.addEventListener('hashchange', () => renderRoute());
  renderRoute({ initial: true });
})();

// The arcade is a separate page: no game code or audio loads on the portfolio.
(() => {
  if (window.top !== window.self) return;
  const sequence = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight'];
  let recent = [], lastKey = 0;
  const reset = () => { recent = []; lastKey = 0; };
  window.addEventListener('keydown', event => {
    if (event.repeat) return;
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey ||
        event.target.closest('input,textarea,select,button,[contenteditable]:not([contenteditable="false"]),[role="textbox"],[role="slider"],[role="menu"],dialog') || document.querySelector('dialog[open]')) { reset(); return; }
    const now = performance.now();
    if (now - lastKey > 2500) recent = [];
    lastKey = now;
    recent.push(event.code);
    recent = recent.slice(-sequence.length);
    if (recent.length === sequence.length && recent.every((key, i) => key === sequence[i])) {
      reset();
      location.assign(new URL('arcade/', document.baseURI).href);
    }
  });
  window.addEventListener('blur', reset);
  document.addEventListener('visibilitychange', () => { if (document.hidden) reset(); });
})();
