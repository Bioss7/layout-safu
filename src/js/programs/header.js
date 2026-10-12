(() => {
 'use strict';
 const storage = {
  read(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } },
  write(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Storage can be unavailable in private mode. */ } }
 };
 const disclosures = [...document.querySelectorAll('[data-disclosure], [data-filter-toggle]')];
 const setDisclosure = (button, open) => {
  const panel = document.getElementById(button.getAttribute('aria-controls'));
  if (!panel) return;
  button.setAttribute('aria-expanded', String(open));
  panel.hidden = !open;
 };
 disclosures.forEach(button => button.addEventListener('click', () => {
  const open = button.getAttribute('aria-expanded') !== 'true';
  if (button.hasAttribute('data-disclosure')) disclosures.filter(other => other !== button && other.hasAttribute('data-disclosure')).forEach(other => setDisclosure(other, false));
  setDisclosure(button, open);
  if (open && button.getAttribute('aria-controls') === 'header-search') document.getElementById('site-search').focus();
 }));
 document.addEventListener('click', event => {
  disclosures.filter(button => button.hasAttribute('data-disclosure')).forEach(button => {
   const panel = document.getElementById(button.getAttribute('aria-controls'));
   if (!button.contains(event.target) && !panel?.contains(event.target)) setDisclosure(button, false);
  });
 });
 document.addEventListener('keydown', event => {
  if (event.key !== 'Escape') return;
  const active = disclosures.find(button => button.getAttribute('aria-expanded') === 'true' && (button === document.activeElement || document.getElementById(button.getAttribute('aria-controls'))?.contains(document.activeElement)));
  if (active) { setDisclosure(active, false); active.focus(); }
  else disclosures.filter(button => button.hasAttribute('data-disclosure')).forEach(button => setDisclosure(button, false));
 });
 const contrast = document.querySelector('[data-contrast]');
 function setContrast(on) { document.body.classList.toggle('is-contrast', on); contrast?.setAttribute('aria-pressed', String(on)); }
 setContrast(storage.read('safu-contrast', false));
 contrast?.addEventListener('click', () => { const on = !document.body.classList.contains('is-contrast'); setContrast(on); storage.write('safu-contrast', on); });
})();
