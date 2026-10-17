// Nova Vision — deep-space backdrop: layered starfield with twinkle, scroll parallax and rare meteors
(function(){
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const glow = document.createElement('div');
  glow.className = 'space-glow';
  const cv = document.createElement('canvas');
  cv.className = 'starfield';
  cv.setAttribute('aria-hidden', 'true');
  document.body.prepend(cv);
  document.body.prepend(glow);
  const ctx = cv.getContext('2d');

  let W = 0, H = 0, dpr = 1, stars = [], meteor = null, nextMeteor = 0;
  const LAYERS = [
    { depth: 0.015, size: [0.4, 0.9], alpha: [0.25, 0.6] },
    { depth: 0.04,  size: [0.6, 1.3], alpha: [0.35, 0.8] },
    { depth: 0.09,  size: [1.0, 1.9], alpha: [0.5, 1.0] },
  ];
  const TINTS = ['230,236,255', '230,236,255', '230,236,255', '255,214,170', '170,190,255'];
  const rnd = (a, b) => a + Math.random() * (b - a);

  function build(){
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = window.innerWidth; H = window.innerHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const count = Math.round(Math.min(420, (W * H) / 4200));
    stars = [];
    for(let i = 0; i < count; i++){
      const L = LAYERS[i % 3];
      stars.push({
        x: Math.random() * W,
        y: Math.random() * H * 1.6,
        r: rnd(L.size[0], L.size[1]),
        a: rnd(L.alpha[0], L.alpha[1]),
        d: L.depth,
        tw: rnd(0.4, 1.6),
        ph: Math.random() * Math.PI * 2,
        c: TINTS[(Math.random() * TINTS.length) | 0],
      });
    }
  }

  function draw(t){
    ctx.clearRect(0, 0, W, H);
    const sy = window.scrollY || 0;
    const span = H * 1.6;
    for(const s of stars){
      let y = (s.y - sy * s.d) % span;
      if(y < 0) y += span;
      if(y > H + 4) continue;
      const tw = reduce ? 1 : 0.65 + 0.35 * Math.sin(t * 0.001 * s.tw + s.ph);
      ctx.globalAlpha = s.a * tw;
      ctx.fillStyle = `rgb(${s.c})`;
      ctx.beginPath();
      ctx.arc(s.x, y, s.r, 0, Math.PI * 2);
      ctx.fill();
      if(s.r > 1.5){
        ctx.globalAlpha = s.a * tw * 0.18;
        ctx.beginPath();
        ctx.arc(s.x, y, s.r * 3.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;

    // rare meteor
    if(!reduce){
      if(!meteor && t > nextMeteor){
        meteor = { x: rnd(W * 0.2, W * 1.0), y: rnd(-20, H * 0.35), vx: -rnd(7, 11), vy: rnd(2.5, 4), life: 0 };
        nextMeteor = t + rnd(7000, 14000);
      }
      if(meteor){
        meteor.life++;
        meteor.x += meteor.vx; meteor.y += meteor.vy;
        const len = 18;
        const g = ctx.createLinearGradient(meteor.x, meteor.y, meteor.x - meteor.vx * len, meteor.y - meteor.vy * len);
        const fade = Math.max(0, 1 - meteor.life / 70);
        g.addColorStop(0, `rgba(255,214,170,${0.9 * fade})`);
        g.addColorStop(1, 'rgba(255,214,170,0)');
        ctx.strokeStyle = g; ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(meteor.x, meteor.y);
        ctx.lineTo(meteor.x - meteor.vx * len, meteor.y - meteor.vy * len);
        ctx.stroke();
        if(meteor.life > 70 || meteor.x < -200 || meteor.y > H + 200) meteor = null;
      }
    }
  }

  let raf = null;
  function loop(t){ draw(t); raf = requestAnimationFrame(loop); }
  function start(){ if(!raf) raf = requestAnimationFrame(loop); }
  function stop(){ if(raf){ cancelAnimationFrame(raf); raf = null; } }

  build();
  nextMeteor = performance.now() + 3500;
  if(reduce){ draw(0); window.addEventListener('scroll', () => draw(0), { passive: true }); }
  else start();
  window.addEventListener('resize', () => { build(); if(reduce) draw(0); });
  document.addEventListener('visibilitychange', () => { if(reduce) return; document.hidden ? stop() : start(); });
})();
