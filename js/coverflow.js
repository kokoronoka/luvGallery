/* LuvGallery — vanilla-JS coverflow carousel.
   Ported from a React/Tailwind reference component: the position tracking,
   RAF easing, drag physics, and loop-folding math are framework-agnostic —
   only the render (imperative DOM here instead of JSX) and refs (plain
   closure variables instead of useRef) actually needed translating. */
window.LuvCoverflow = (() => {
  function create(container, slides, opts = {}) {
    const {
      rotate = 40,
      depth = 0.55,
      falloff = 0.56,
      fade = 0.28,
      gap = 0.08,
      loop = false,
      initialIndex = 0,
      onSelect = () => {},
      onActivate = () => {},
    } = opts;
    const count = slides.length;

    container.innerHTML = count ? `
      <div class="coverflow-frame" tabindex="0">
        <div class="coverflow-track"></div>
      </div>` : '';
    if (!count) return { destroy() {}, goTo() {}, getSelected: () => -1 };

    const frame = container.querySelector('.coverflow-frame');
    const track = container.querySelector('.coverflow-track');

    const cardEls = slides.map((slide, i) => {
      const el = document.createElement('div');
      el.className = 'coverflow-card';
      el.dataset.index = String(i);
      el.innerHTML = slide.photoUrl
        ? `<img src="${slide.photoUrl}" alt="" draggable="false" />`
        : `<div class="coverflow-placeholder">${slide.placeholderIcon || ''}</div>`;
      track.appendChild(el);
      return el;
    });

    let pos = initialIndex;
    let target = initialIndex;
    let width = 0;
    let raf = null;
    let selected = initialIndex;
    let drag = null;

    const indexAt = (p) => ((Math.round(p) % count) + count) % count;
    const clamp = (p) => (loop ? p : Math.max(0, Math.min(count - 1, p)));

    function paint() {
      if (!width) return;
      const pitch = width * (1 + gap);
      cardEls.forEach((card, i) => {
        let offset = i - pos;
        if (loop) {
          offset = ((offset % count) + count) % count;
          if (offset > count / 2) offset -= count;
        }
        const distance = Math.abs(offset);
        const ramp = Math.pow(distance, falloff);
        const tilt = Math.min(rotate * ramp, 82) * Math.sign(offset);
        card.style.transform =
          `translateX(calc(-50% + ${offset * pitch}px)) translateZ(${-depth * width * ramp}px) rotateY(${-tilt}deg)`;
        const edge = loop ? Math.min(1, Math.max(0, count / 2 - distance)) : 1;
        card.style.opacity = String(Math.max(0, 1 - fade * distance) * edge);
        card.style.zIndex = String(100 - Math.round(distance));
      });
    }

    function settle(t) {
      if (raf !== null) cancelAnimationFrame(raf);
      target = t;
      const next = indexAt(t);
      if (next !== selected) { selected = next; onSelect(selected); }
      const step = () => {
        const remaining = target - pos;
        if (Math.abs(remaining) < 0.0004) { pos = target; paint(); raf = null; return; }
        pos += remaining * 0.18;
        paint();
        raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    }

    function goTo(index) {
      const t = loop ? index + Math.round((target - index) / count) * count : index;
      settle(clamp(t));
    }
    function nudge(by) { settle(clamp(Math.round(target) + by)); }

    // Tap-vs-drag is decided here, inside the pointer sequence itself, rather
    // than via a separate "click" listener on each card: setPointerCapture()
    // on the frame (needed for the drag) retargets pointerup, which in some
    // browsers suppresses the synthetic click the card would otherwise get.
    frame.addEventListener('pointerdown', (e) => {
      if (raf !== null) { cancelAnimationFrame(raf); raf = null; }
      frame.setPointerCapture(e.pointerId);
      target = pos;
      const hitCard = e.target.closest('.coverflow-card');
      const hitIndex = hitCard ? Number(hitCard.dataset.index) : null;
      drag = { id: e.pointerId, x: e.clientX, pos, v: 0, t: performance.now(), hitIndex, moved: false };
    });
    frame.addEventListener('pointermove', (e) => {
      if (!drag || drag.id !== e.pointerId) return;
      const pitch = width * (1 + gap);
      if (!pitch) return;
      if (Math.abs(e.clientX - drag.x) > 4) drag.moved = true;
      const now = performance.now();
      const prev = pos;
      pos = clamp(drag.pos - (e.clientX - drag.x) / pitch);
      drag.v = ((pos - prev) / Math.max(now - drag.t, 1)) * 1000;
      drag.t = now;
      const idx = indexAt(pos);
      if (idx !== selected) { selected = idx; onSelect(selected); }
      paint();
    });
    function endDrag(e) {
      if (!drag || drag.id !== e.pointerId) return;
      const d = drag; drag = null;
      if (!d.moved && d.hitIndex !== null) {
        if (d.hitIndex === selected) onActivate(d.hitIndex);
        else goTo(d.hitIndex);
        return;
      }
      const carried = Math.max(-2, Math.min(2, d.v * 0.18));
      settle(clamp(Math.round(pos + carried)));
    }
    frame.addEventListener('pointerup', endDrag);
    frame.addEventListener('pointercancel', endDrag);
    frame.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') { e.preventDefault(); nudge(-1); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); nudge(1); }
    });

    const ro = new ResizeObserver(() => {
      const card = cardEls[0];
      if (!card) return;
      width = card.offsetWidth;
      paint();
    });
    ro.observe(frame);
    requestAnimationFrame(() => {
      const card = cardEls[0];
      if (card) { width = card.offsetWidth; paint(); }
    });

    onSelect(selected);

    return {
      goTo,
      getSelected: () => selected,
      destroy() {
        ro.disconnect();
        if (raf !== null) cancelAnimationFrame(raf);
      },
    };
  }

  return { create };
})();
