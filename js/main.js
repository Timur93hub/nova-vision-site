// Mobile nav toggle
const toggle = document.querySelector('.mast-toggle');
const nav = document.querySelector('.mast-nav');
if(toggle && nav){
  toggle.addEventListener('click', () => {
    nav.classList.toggle('open');
    toggle.setAttribute('aria-expanded', nav.classList.contains('open'));
  });
  nav.querySelectorAll('a').forEach(a => a.addEventListener('click', () => nav.classList.remove('open')));
}

// Scroll reveal
const revealEls = document.querySelectorAll('.reveal');
if('IntersectionObserver' in window && revealEls.length){
  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if(entry.isIntersecting){
        entry.target.classList.add('in');
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -60px 0px' });
  revealEls.forEach(el => io.observe(el));
} else {
  revealEls.forEach(el => el.classList.add('in'));
}

// Living details: cursor star-glow and gentle tilt on photos (desktop pointers only)
(function(){
  const fine = window.matchMedia('(pointer: fine)').matches;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(!fine || reduce) return;
  const glow = document.createElement('div');
  glow.className = 'cursor-glow';
  document.body.appendChild(glow);
  let x = innerWidth / 2, y = innerHeight / 2, gx = x, gy = y, raf = null;
  function tick(){
    gx += (x - gx) * 0.14; gy += (y - gy) * 0.14;
    glow.style.transform = `translate(${gx}px, ${gy}px)`;
    raf = (Math.abs(x - gx) + Math.abs(y - gy) > 0.5) ? requestAnimationFrame(tick) : null;
  }
  window.addEventListener('pointermove', e => {
    x = e.clientX; y = e.clientY;
    glow.classList.add('on');
    if(!raf) raf = requestAnimationFrame(tick);
  }, { passive: true });
  document.addEventListener('pointerleave', () => glow.classList.remove('on'));

  document.querySelectorAll('.look').forEach(el => {
    el.addEventListener('pointermove', e => {
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      el.style.transform = `perspective(1100px) rotateY(${px * 5}deg) rotateX(${-py * 5}deg)`;
    });
    el.addEventListener('pointerleave', () => { el.style.transform = ''; });
  });
})();

// Videos that play only while visible (before/after block)
(function(){
  const vids = document.querySelectorAll('video[data-inview]');
  if(!vids.length) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(!('IntersectionObserver' in window) || reduce) return;
  const io = new IntersectionObserver(entries => {
    entries.forEach(en => {
      const v = en.target;
      if(en.isIntersecting){ v.preload = 'auto'; const p = v.play(); if(p) p.catch(() => {}); }
      else v.pause();
    });
  }, { threshold: 0.35 });
  vids.forEach(v => io.observe(v));
})();
