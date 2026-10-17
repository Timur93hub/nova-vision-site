// Nova Vision — circular 3D gallery, scroll-driven (one per direction on the homepage)
(function(){
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const rings = document.querySelectorAll('[data-ring]');
  const lb = document.querySelector('.lightbox');
  const lbMedia = lb ? lb.querySelector('.lightbox-media') : null;
  const lbCap = lb ? lb.querySelector('.lightbox-cap') : null;
  const MIN_CARDS = 6;      // short lists are repeated so the ring stays full
  const AUTO_SPEED = 3.2;   // degrees per second of idle drift

  function openLightbox(card){
    if(!lb) return;
    const v = card.querySelector('video');
    const img = card.querySelector('img');
    lbMedia.innerHTML = '';
    let el;
    if(v){
      el = document.createElement('video');
      el.src = v.dataset.src || v.currentSrc || v.src;
      el.controls = true; el.autoplay = true; el.playsInline = true; el.loop = true;
      el.poster = v.poster;
    } else {
      el = document.createElement('img');
      el.src = img.src; el.alt = img.alt;
    }
    lbMedia.appendChild(el);
    const t = card.querySelector('.ring-cap-title');
    const s = card.querySelector('.ring-cap-sub');
    lbCap.textContent = [t && t.textContent, s && s.textContent].filter(Boolean).join(' — ');
    lb.hidden = false;
    document.body.style.overflow = 'hidden';
    lb.querySelector('.lightbox-close').focus();
  }
  function closeLightbox(){
    if(!lb || lb.hidden) return;
    lb.hidden = true;
    lbMedia.innerHTML = '';
    document.body.style.overflow = '';
  }
  if(lb){
    lb.addEventListener('click', e => { if(e.target === lb || e.target.closest('.lightbox-close')) closeLightbox(); });
    document.addEventListener('keydown', e => { if(e.key === 'Escape') closeLightbox(); });
  }

  const norm = a => { a = ((a + 180) % 360 + 360) % 360 - 180; return a; };

  rings.forEach(root => {
    const block = root.closest('.work-block');
    const track = root.querySelector('.ring-track');
    const stage = root.querySelector('.ring-stage');
    const counter = root.querySelector('.ring-count');

    // fill the ring
    const originals = Array.from(root.querySelectorAll('.ring-card'));
    const realN = originals.length;
    if(!realN) return;
    let k = 0;
    while(track.children.length < MIN_CARDS){
      const c = originals[k % realN].cloneNode(true);
      c.dataset.clone = '1';
      c.setAttribute('aria-hidden', 'true');
      track.appendChild(c);
      k++;
    }
    const cards = Array.from(track.querySelectorAll('.ring-card'));
    cards.forEach((c, i) => { c.dataset.real = String(i % realN); });
    const n = cards.length;
    const STEP = 360 / n;

    let radius = 0;
    let rot = 0;            // rendered rotation (deg)
    let offset = 0;         // user offset: arrows / drag
    let offsetTarget = 0;
    let auto = 0;           // idle drift
    let scrollRot = 0;
    let inView = false, hovering = false, dragging = false;
    let current = -1, last = performance.now();

    function measure(){
      const w = cards[0].offsetWidth;
      // keep neighbours from overlapping on the circle
      radius = Math.max(w * 1.25, (w * 1.12) / (2 * Math.tan(Math.PI / n)));
      track.style.setProperty('--r', radius + 'px');
    }

    function scrollProgress(){
      const r = block.getBoundingClientRect();
      const total = r.height - window.innerHeight;
      if(total <= 0) return 0;
      return Math.min(1, Math.max(0, -r.top / total));
    }

    function render(){
      cards.forEach((c, i) => {
        const a = norm(i * STEP - rot);
        const aa = Math.abs(a);
        const front = Math.cos(a * Math.PI / 180);         // 1 front, -1 back
        const op = front > 0 ? 0.45 + 0.55 * front : Math.max(0.12, 0.45 + 0.33 * front);
        c.style.transform = `translate(-50%,-50%) rotateY(${a}deg) translateZ(${radius}px)`;
        c.style.opacity = op.toFixed(3);
        c.style.zIndex = String(Math.round(100 + front * 100));
        c.style.pointerEvents = aa > 100 ? 'none' : '';
        c.style.setProperty('--dim', Math.min(0.7, (1 - front) * 0.45).toFixed(3));
      });
      let best = 0, bestA = 999;
      cards.forEach((c, i) => { const a = Math.abs(norm(i * STEP - rot)); if(a < bestA){ bestA = a; best = i; } });
      if(best !== current) setActive(best);
    }

    function setActive(idx){
      current = idx;
      cards.forEach((c, i) => {
        const on = i === idx;
        c.classList.toggle('is-active', on);
        const v = c.querySelector('video');
        if(v){
          if(on && inView && !reduce){
            if(!v.src && v.dataset.src) v.src = v.dataset.src;
            const p = v.play(); if(p) p.catch(() => {});
          } else { v.pause(); }
        }
      });
      if(counter){
        const r = Number(cards[idx].dataset.real) + 1;
        counter.textContent = String(r).padStart(2, '0') + ' / ' + String(realN).padStart(2, '0');
      }
    }

    function frame(now){
      const dt = Math.min(64, now - last) / 1000; last = now;
      if(inView){
        if(!reduce && !hovering && !dragging && (!lb || lb.hidden)) auto += AUTO_SPEED * dt;
        scrollRot = scrollProgress() * 360;
        offset += (offsetTarget - offset) * (dragging ? 1 : Math.min(1, dt * 7));
        const goal = scrollRot + offset + auto;
        rot += (goal - rot) * (reduce ? 1 : Math.min(1, dt * 9));
        render();
      }
      requestAnimationFrame(frame);
    }

    // snap so card idx sits in front
    function bringToFront(i){
      const a = norm(i * STEP - rot);
      offsetTarget += a;
    }
    function step(dir){
      const a = norm(current * STEP - rot);           // residual of current card
      offsetTarget += a + dir * STEP;
    }

    root.querySelector('.ring-prev').addEventListener('click', () => step(-1));
    root.querySelector('.ring-next').addEventListener('click', () => step(1));
    root.addEventListener('keydown', e => {
      if(e.key === 'ArrowLeft'){ e.preventDefault(); step(-1); }
      if(e.key === 'ArrowRight'){ e.preventDefault(); step(1); }
    });
    stage.addEventListener('mouseenter', () => { hovering = true; });
    stage.addEventListener('mouseleave', () => { hovering = false; });

    // horizontal trackpad swipe
    stage.addEventListener('wheel', e => {
      if(Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
      e.preventDefault();
      offsetTarget += e.deltaX * 0.12;
    }, { passive:false });

    // drag / swipe
    let startX = 0, startY = 0, startOff = 0, moved = false, axis = null, pid = null;
    stage.addEventListener('pointerdown', e => {
      if(e.button !== 0) return;
      pid = e.pointerId; startX = e.clientX; startY = e.clientY;
      startOff = offsetTarget; moved = false; axis = null;
    });
    stage.addEventListener('pointermove', e => {
      if(pid !== e.pointerId) return;
      const dx = e.clientX - startX, dy = e.clientY - startY;
      if(!axis){
        if(Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
        axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
        if(axis === 'x'){ dragging = true; moved = true; stage.setPointerCapture(pid); stage.classList.add('grabbing'); }
      }
      if(axis !== 'x') return;
      const w = cards[0].offsetWidth;
      offsetTarget = startOff - (dx / w) * STEP;
    });
    function endDrag(e){
      if(pid !== e.pointerId) return;
      pid = null;
      if(dragging){
        dragging = false;
        stage.classList.remove('grabbing');
        // settle on the nearest card
        const goalRot = scrollRot + offsetTarget + auto;
        let best = 0, bestA = 999;
        cards.forEach((c, i) => { const a = norm(i * STEP - goalRot); if(Math.abs(a) < Math.abs(bestA)){ bestA = a; best = i; } });
        offsetTarget += bestA;
      }
    }
    stage.addEventListener('pointerup', endDrag);
    stage.addEventListener('pointercancel', endDrag);
    stage.style.touchAction = 'pan-y';

    cards.forEach((c, i) => {
      c.addEventListener('click', e => {
        if(moved){ e.preventDefault(); moved = false; return; }
        if(i !== current){ bringToFront(i); return; }
        openLightbox(c);
      });
    });

    if('IntersectionObserver' in window){
      new IntersectionObserver(entries => {
        entries.forEach(en => {
          inView = en.isIntersecting;
          const v = cards[current] && cards[current].querySelector('video');
          if(v){
            if(inView && !reduce){ if(!v.src && v.dataset.src) v.src = v.dataset.src; v.play().catch(() => {}); }
            else v.pause();
          }
        });
      }, { threshold: 0.2 }).observe(root);
    } else { inView = true; }

    window.addEventListener('resize', () => { measure(); render(); });
    measure();
    scrollRot = scrollProgress() * 360; rot = scrollRot;
    render();
    root.classList.add('ready');
    requestAnimationFrame(t => { last = t; frame(t); });
  });
})();

// Hero showreel: open full-screen in the lightbox
(function(){
  const btn = document.querySelector('[data-reel]');
  const lb = document.querySelector('.lightbox');
  if(!btn || !lb) return;
  btn.addEventListener('click', () => {
    const media = lb.querySelector('.lightbox-media');
    media.innerHTML = '';
    const v = document.createElement('video');
    v.src = btn.querySelector('video').currentSrc || btn.querySelector('video').src; v.controls = true; v.autoplay = true; v.loop = true; v.playsInline = true; v.muted = true;
    media.appendChild(v);
    lb.querySelector('.lightbox-cap').textContent = 'Nova Vision — Showreel 2026';
    lb.hidden = false; document.body.style.overflow = 'hidden';
    lb.querySelector('.lightbox-close').focus();
  });
})();
