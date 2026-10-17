// Nova Vision — 3D ring gallery (one per direction on the homepage)
(function(){
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const rings = document.querySelectorAll('[data-ring]');
  const lb = document.querySelector('.lightbox');
  const lbMedia = lb ? lb.querySelector('.lightbox-media') : null;
  const lbCap = lb ? lb.querySelector('.lightbox-cap') : null;

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

  rings.forEach(root => {
    const stage = root.querySelector('.ring-stage');
    const cards = Array.from(root.querySelectorAll('.ring-card'));
    const dots = root.querySelector('.ring-dots');
    const counter = root.querySelector('.ring-count');
    const n = cards.length;
    if(!n) return;

    const STEP = 30;                         // degrees between cards
    const visMax = Math.min(2.4, n / 2 - 0.5);
    let pos = 0, target = 0, radius = 0;
    let inView = false, hovering = false, dragging = false;
    let raf = null, timer = null, current = -1;

    // dots
    const dotEls = cards.map((_, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('aria-label', 'Работа ' + (i + 1));
      b.addEventListener('click', () => goTo(i));
      dots.appendChild(b);
      return b;
    });

    function measure(){
      const w = cards[0].offsetWidth;
      radius = (w / 2) / Math.tan((STEP / 2) * Math.PI / 180) * 1.04;
      stage.style.setProperty('--r', radius + 'px');
    }

    function wrap(d){
      d = ((d % n) + n) % n;
      return d > n / 2 ? d - n : d;
    }

    function render(){
      cards.forEach((c, i) => {
        const d = wrap(i - pos);
        const ad = Math.abs(d);
        const op = ad <= visMax ? 1 : Math.max(0, 1 - (ad - visMax) / 0.6);
        c.style.transform = `translate(-50%,-50%) rotateY(${d * STEP}deg) translateZ(${radius}px)`;
        c.style.opacity = op;
        c.style.zIndex = String(100 - Math.round(ad * 10));
        c.style.pointerEvents = op < 0.3 ? 'none' : '';
        c.style.setProperty('--dim', Math.min(0.62, ad * 0.36).toFixed(3));
      });
      const idx = ((Math.round(pos) % n) + n) % n;
      if(idx !== current) setActive(idx);
    }

    function setActive(idx){
      current = idx;
      cards.forEach((c, i) => {
        const on = i === idx;
        c.classList.toggle('is-active', on);
        c.setAttribute('aria-hidden', on ? 'false' : 'true');
        const v = c.querySelector('video');
        if(v){
          if(on && inView && !reduce){
            if(!v.src && v.dataset.src) v.src = v.dataset.src;
            v.currentTime = 0;
            const p = v.play(); if(p) p.catch(() => {});
          } else { v.pause(); }
        }
      });
      dotEls.forEach((d, i) => d.classList.toggle('on', i === idx));
      if(counter) counter.textContent = String(idx + 1).padStart(2, '0') + ' / ' + String(n).padStart(2, '0');
      schedule();
    }

    function tick(){
      const diff = target - pos;
      if(Math.abs(diff) < 0.0008 && !dragging){ pos = target; render(); raf = null; return; }
      pos += dragging ? diff : diff * (reduce ? 1 : 0.11);
      render();
      raf = requestAnimationFrame(tick);
    }
    function kick(){ if(!raf) raf = requestAnimationFrame(tick); }

    function goTo(i){
      // shortest path to card i
      const cur = ((Math.round(target) % n) + n) % n;
      let delta = i - cur;
      if(delta > n / 2) delta -= n;
      if(delta < -n / 2) delta += n;
      target = Math.round(target) + delta;
      kick();
    }
    function step(dir){ target = Math.round(target) + dir; kick(); }

    // autoplay: images every 4.2s, videos when they end
    function schedule(){
      clearTimeout(timer);
      if(reduce || !inView || hovering || dragging || (lb && !lb.hidden)) return;
      const v = cards[current] && cards[current].querySelector('video');
      if(v) return; // handled by 'ended'
      timer = setTimeout(() => step(1), 4200);
    }
    cards.forEach(c => {
      const v = c.querySelector('video');
      if(v) v.addEventListener('ended', () => {
        if(inView && !hovering && !dragging && (!lb || lb.hidden)) step(1);
        else { v.currentTime = 0; v.play().catch(() => {}); }
      });
    });

    root.querySelector('.ring-prev').addEventListener('click', () => step(-1));
    root.querySelector('.ring-next').addEventListener('click', () => step(1));
    root.addEventListener('keydown', e => {
      if(e.key === 'ArrowLeft'){ e.preventDefault(); step(-1); }
      if(e.key === 'ArrowRight'){ e.preventDefault(); step(1); }
    });
    root.addEventListener('mouseenter', () => { hovering = true; clearTimeout(timer); });
    root.addEventListener('mouseleave', () => { hovering = false; schedule(); });

    // horizontal wheel / trackpad swipe (vertical page scroll is left alone)
    let wheelAcc = 0, wheelLock = 0;
    stage.addEventListener('wheel', e => {
      if(Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
      e.preventDefault();
      const now = Date.now();
      wheelAcc += e.deltaX;
      if(now > wheelLock && Math.abs(wheelAcc) > 40){
        step(wheelAcc > 0 ? 1 : -1);
        wheelAcc = 0; wheelLock = now + 380;
      }
    }, { passive:false });

    // drag / swipe
    let startX = 0, startY = 0, startPos = 0, moved = false, axis = null, pid = null;
    stage.addEventListener('pointerdown', e => {
      if(e.button !== 0) return;
      pid = e.pointerId; startX = e.clientX; startY = e.clientY;
      startPos = target; moved = false; axis = null;
    });
    stage.addEventListener('pointermove', e => {
      if(pid !== e.pointerId) return;
      const dx = e.clientX - startX, dy = e.clientY - startY;
      if(!axis){
        if(Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
        axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
        if(axis === 'x'){ dragging = true; moved = true; stage.setPointerCapture(pid); stage.classList.add('grabbing'); clearTimeout(timer); }
      }
      if(axis !== 'x') return;
      const w = cards[0].offsetWidth;
      target = startPos - dx / (w * 0.9);
      kick();
    });
    function endDrag(e){
      if(pid !== e.pointerId) return;
      pid = null;
      if(dragging){
        dragging = false;
        stage.classList.remove('grabbing');
        target = Math.round(target);
        kick(); schedule();
      }
    }
    stage.addEventListener('pointerup', endDrag);
    stage.addEventListener('pointercancel', endDrag);
    stage.style.touchAction = 'pan-y';

    cards.forEach((c, i) => {
      c.addEventListener('click', e => {
        if(moved){ e.preventDefault(); moved = false; return; }
        if(i !== current){ goTo(i); return; }
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
          schedule();
        });
      }, { threshold: 0.35 }).observe(root);
    } else { inView = true; }

    window.addEventListener('resize', () => { measure(); render(); });
    measure();
    render();
    root.classList.add('ready');
  });
})();
