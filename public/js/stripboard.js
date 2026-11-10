// Glisser-déposer des bandes et des fins de journée (souris et tactile)
export function bindStripboard(root, scroller, onOrder) {
  let drag = null;
  const items = () => [...root.querySelectorAll('.sb-item')];
  const tokens = () => items().map(el => el.dataset.break ? '|' : el.dataset.k);

  function onDown(e) {
    const h = e.target.closest('.dh'); if (!h || !root.contains(h)) return;
    const item = h.closest('.sb-item'); if (!item) return;
    e.preventDefault();
    const r = item.getBoundingClientRect();
    const ghost = item.cloneNode(true);
    ghost.classList.add('sb-ghost');
    Object.assign(ghost.style, { position: 'fixed', left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', zIndex: 80, pointerEvents: 'none' });
    document.body.appendChild(ghost);
    item.classList.add('sb-hold');
    drag = { item, ghost, dy: e.clientY - r.top, y: e.clientY, before: tokens().join(','), raf: 0 };
    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    autoScroll();
  }
  function place(y) {
    const list = items().filter(el => el !== drag.item);
    const after = list.find(el => { const b = el.getBoundingClientRect(); return y < b.top + b.height / 2; });
    if (after) { if (drag.item.nextElementSibling !== after) after.before(drag.item); }
    else { const last = list[list.length - 1]; if (last && last.nextElementSibling !== drag.item) last.after(drag.item); }
  }
  function onMove(e) {
    if (!drag) return; e.preventDefault();
    drag.y = e.clientY;
    drag.ghost.style.top = (e.clientY - drag.dy) + 'px';
    place(e.clientY);
  }
  function autoScroll() {
    if (!drag) return;
    const r = scroller.getBoundingClientRect(), edge = 70;
    if (drag.y < r.top + edge) scroller.scrollTop -= Math.ceil((r.top + edge - drag.y) / 6);
    else if (drag.y > r.bottom - edge) scroller.scrollTop += Math.ceil((drag.y - (r.bottom - edge)) / 6);
    place(drag.y);
    drag.raf = requestAnimationFrame(autoScroll);
  }
  function onUp() {
    if (!drag) return;
    cancelAnimationFrame(drag.raf);
    drag.ghost.remove(); drag.item.classList.remove('sb-hold');
    window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); window.removeEventListener('pointercancel', onUp);
    const now = tokens(), changed = now.join(',') !== drag.before; drag = null;
    if (changed) onOrder(now);
  }
  root.addEventListener('pointerdown', onDown);
}
