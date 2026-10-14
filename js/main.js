/* =========================================================================
   XANDBAP — interações
   Sem bibliotecas: IntersectionObserver + rAF + CSS transitions.
   ========================================================================= */
(function () {
  'use strict';

  var root = document.documentElement;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var saveData = !!(navigator.connection && navigator.connection.saveData);
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  /* ---------------------------------------------------------------------
     1. Fallback de mídia (imagens e vídeos indisponíveis)
     --------------------------------------------------------------------- */
  function markMedia(el, state) {
    var box = el.closest('.media');
    if (state === 'missing') {
      if (box) box.classList.add('is-missing'); else el.classList.add('is-missing');
    }
    if (box) box.classList.add('is-loaded');
  }
  $$('img[data-media], .media img').forEach(function (img) {
    if (img.complete) {
      markMedia(img, img.naturalWidth === 0 ? 'missing' : 'ok');
    } else {
      img.addEventListener('load', function () { markMedia(img, 'ok'); }, { once: true });
      img.addEventListener('error', function () { markMedia(img, 'missing'); }, { once: true });
    }
  });
  $$('.media video').forEach(function (v) {
    var box = v.closest('.media');
    var ok = function () { box.classList.add('is-loaded'); };
    if (v.readyState >= 2) ok();
    v.addEventListener('loadeddata', ok, { once: true });
    // com preload="none" o pôster já é suficiente para tirar o esqueleto
    if (v.poster) { var p = new Image(); p.onload = ok; p.src = v.poster; }
    v.addEventListener('error', function () { box.classList.add('is-missing'); }, true);
    var src = v.querySelector('source');
    if (src) src.addEventListener('error', function () { box.classList.add('is-missing'); });
  });

  /* ---------------------------------------------------------------------
     2. Abertura com progresso por etapas reais de inicialização
     --------------------------------------------------------------------- */
  var loader = $('#loader');
  var heroVideo = $('#heroVideo');

  var boot = (function () {
    var steps = {
      interface: { w: 15, done: 0, label: 'Preparando a interface' },
      fontes:    { w: 20, done: 0, label: 'Carregando a tipografia' },
      imagens:   { w: 40, done: 0, label: 'Carregando as imagens' },
      video:     { w: 25, done: 0, label: 'Conectando o vídeo do palco' }
    };
    var order = ['interface', 'fontes', 'imagens', 'video'];
    var shown = 0, finished = false, startTime = performance.now();
    var MIN_TIME = reduceMotion ? 300 : 1300;   // tempo mínimo pra abertura da marca ser lida
    var HARD_TIMEOUT = 8000;                    // nunca prende o usuário
    var pctEl = $('#loaderPct'), barEl = $('#loaderBar'), barWrap = $('#loaderBarWrap'), stepEl = $('#loaderStep');
    var stepLis = {};
    $$('#loaderSteps li').forEach(function (li) { stepLis[li.getAttribute('data-step')] = li; });

    function target() {
      var t = 0;
      order.forEach(function (k) { t += steps[k].w * steps[k].done; });
      return Math.min(100, t);
    }
    function progress(key, fraction) {
      var s = steps[key];
      if (!s) return;
      s.done = Math.max(s.done, Math.min(1, fraction));
      updateLabels();
    }
    function updateLabels() {
      var current = null;
      order.forEach(function (k) {
        var li = stepLis[k];
        var done = steps[k].done >= 1;
        if (li) { li.classList.toggle('is-done', done); li.classList.remove('is-active'); }
        if (!done && !current) current = k;
      });
      if (current) {
        if (stepLis[current]) stepLis[current].classList.add('is-active');
        stepEl.textContent = steps[current].label;
      } else {
        stepEl.textContent = 'Tudo pronto';
      }
    }

    function tick() {
      var t = target();
      // aproxima o número exibido do progresso real (nunca ultrapassa)
      var diff = t - shown;
      shown += diff > 0 ? Math.max(diff * 0.09, Math.min(diff, 0.35)) : 0;
      if (t >= 100 && shown > 99.6) shown = 100;
      var val = Math.floor(shown);
      pctEl.textContent = val < 10 ? '0' + val : String(val);
      barEl.style.transform = 'scaleX(' + (shown / 100) + ')';
      barWrap.setAttribute('aria-valuenow', String(val));

      if (shown >= 100 && performance.now() - startTime >= MIN_TIME) return finish();
      requestAnimationFrame(tick);
    }

    function finish() {
      if (finished) return;
      finished = true;
      // espera dois frames para garantir layout pintado antes de revelar
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          loader.classList.add('is-leaving');
          loader.setAttribute('aria-hidden', 'true');
          root.classList.remove('is-loading');
          setTimeout(function () { root.classList.add('site-ready'); document.dispatchEvent(new Event('site:ready')); }, reduceMotion ? 0 : 520);
          setTimeout(function () { loader.classList.add('is-gone'); }, reduceMotion ? 450 : 1600);
        });
      });
    }

    function forceAll() { order.forEach(function (k) { steps[k].done = 1; }); updateLabels(); }

    setTimeout(forceAll, HARD_TIMEOUT);
    updateLabels();
    requestAnimationFrame(tick);
    return { progress: progress, forceAll: forceAll };
  })();

  // 2.1 interface: o script roda no fim do <body>, DOM já está montado
  boot.progress('interface', 1);

  // 2.2 tipografia: espera o CSS do Google Fonts e os arquivos de fonte (timeout de 2,5 s)
  (function () {
    var finished = false;
    var done = function () { if (!finished) { finished = true; boot.progress('fontes', 1); } };
    setTimeout(done, 2500);
    if (!document.fonts || !document.fonts.load) return done();
    var link = document.getElementById('fontsCss');
    var loadFaces = function () {
      boot.progress('fontes', 0.3);
      var names = ['400 1em Anton', '600 1em "Barlow Condensed"', '500 1em "JetBrains Mono"'];
      var count = 0;
      var one = function () { count++; boot.progress('fontes', 0.3 + 0.7 * count / names.length); if (count === names.length) done(); };
      names.forEach(function (n) { document.fonts.load(n).then(one, one); });
    };
    if (!link || link.hasAttribute('data-loaded') || link.rel === 'stylesheet') loadFaces();
    else {
      link.addEventListener('load', function () { setTimeout(loadFaces, 0); }, { once: true });
      link.addEventListener('error', done, { once: true });
    }
  })();

  // 2.3 imagens essenciais da primeira dobra
  (function () {
    var critical = $$('#loader img, .header-logo img, .hero-backdrop img');
    var total = critical.length, settled = 0;
    if (!total) return boot.progress('imagens', 1);
    function one() { settled++; boot.progress('imagens', settled / total); }
    critical.forEach(function (img) {
      if (img.complete) return one();
      var fired = false;
      var cb = function () { if (!fired) { fired = true; one(); } };
      img.addEventListener('load', cb, { once: true });
      img.addEventListener('error', cb, { once: true });
      setTimeout(cb, 5000);
    });
  })();

  // 2.4 vídeo do hero: primeiro quadro pronto, falha ou timeout (não bloqueia a página)
  (function () {
    if (!heroVideo) return boot.progress('video', 1);
    var settled = false;
    function done() { if (!settled) { settled = true; boot.progress('video', 1); } }
    if (reduceMotion || saveData) return done();
    // começa a tocar (mudo) por trás da abertura: o 1º quadro chega rápido e o vídeo já está rodando na revelação
    var pp = heroVideo.play(); if (pp && pp.catch) pp.catch(done);
    heroVideo.addEventListener('loadedmetadata', function () { boot.progress('video', 0.4); }, { once: true });
    heroVideo.addEventListener('loadeddata', done, { once: true });
    heroVideo.addEventListener('error', done, { once: true });
    if (heroVideo.readyState >= 2) done();
    setTimeout(done, 3500);
  })();

  /* ---------------------------------------------------------------------
     3. Vídeos: autoplay só quando visíveis, controles, timecode
     --------------------------------------------------------------------- */
  var userPaused = new WeakMap();

  function setToggleState(video) {
    $$('[data-video-toggle="' + video.id + '"]').forEach(function (b) {
      var paused = video.paused;
      b.classList.toggle('is-paused', paused);
      b.setAttribute('aria-label', paused ? 'Reproduzir vídeo' : 'Pausar vídeo');
    });
  }
  function tryPlay(video) {
    var p = video.play();
    if (p && p.catch) p.catch(function () { setToggleState(video); });
  }

  var videos = $$('video[id]');
  videos.forEach(function (v) {
    v.addEventListener('play', function () { setToggleState(v); });
    v.addEventListener('pause', function () { setToggleState(v); });
    setToggleState(v);
  });

  // reproduz/pausa de acordo com a visibilidade (economiza dados e CPU)
  if ('IntersectionObserver' in window) {
    var vio = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        var v = e.target;
        if (e.isIntersecting) {
          if (v.id === 'heroVideo' && !root.classList.contains('site-ready')) return;
          if (!reduceMotion && !saveData && !userPaused.get(v)) tryPlay(v);
        } else if (!v.paused) {
          v.pause();
        }
      });
    }, { threshold: 0.25 });
    videos.forEach(function (v) { vio.observe(v); });
  }

  document.addEventListener('site:ready', function () {
    if (heroVideo && !reduceMotion && !saveData) tryPlay(heroVideo);
  });

  $$('[data-video-toggle]').forEach(function (btn) {
    var v = document.getElementById(btn.getAttribute('data-video-toggle'));
    if (!v) return;
    btn.addEventListener('click', function () {
      if (v.paused) { userPaused.set(v, false); tryPlay(v); }
      else { userPaused.set(v, true); v.pause(); }
    });
  });

  $$('[data-video-sound]').forEach(function (btn) {
    var v = document.getElementById(btn.getAttribute('data-video-sound'));
    if (!v) return;
    btn.addEventListener('click', function () {
      var turnOn = v.muted;
      // só um vídeo com som por vez
      if (turnOn) {
        $$('[data-video-sound]').forEach(function (other) {
          var ov = document.getElementById(other.getAttribute('data-video-sound'));
          if (ov && ov !== v) { ov.muted = true; other.setAttribute('aria-pressed', 'false'); other.setAttribute('aria-label', 'Ativar som'); }
        });
      }
      v.muted = !turnOn;
      btn.setAttribute('aria-pressed', turnOn ? 'true' : 'false');
      btn.setAttribute('aria-label', turnOn ? 'Desativar som' : 'Ativar som');
      if (turnOn && v.paused) { userPaused.set(v, false); tryPlay(v); }
    });
  });

  // timecode estilo câmera (atualiza no máximo 4x/s via timeupdate)
  $$('[data-timecode-for]').forEach(function (el) {
    var v = document.getElementById(el.getAttribute('data-timecode-for'));
    if (!v) return;
    var pad = function (n) { return n < 10 ? '0' + n : String(n); };
    v.addEventListener('timeupdate', function () {
      var t = v.currentTime || 0;
      var m = Math.floor(t / 60), s = Math.floor(t % 60);
      el.textContent = '00:' + pad(m) + ':' + pad(s);
    });
  });

  /* ---------------------------------------------------------------------
     4. Revelações ao rolar
     --------------------------------------------------------------------- */
  var revealEls = $$('[data-reveal]');
  if ('IntersectionObserver' in window && !reduceMotion) {
    // elementos com clip-path são medidos já recortados pelo IntersectionObserver,
    // então observamos o elemento pai e revelamos o filho
    var revealTargets = new Map();
    var rio = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        (revealTargets.get(e.target) || []).forEach(function (el) { el.classList.add('is-in'); });
        rio.unobserve(e.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    var startReveals = function () {
      revealEls.forEach(function (el) {
        var watch = el.getAttribute('data-reveal') === 'clip' ? el.parentElement : el;
        if (!revealTargets.has(watch)) revealTargets.set(watch, []);
        revealTargets.get(watch).push(el);
        rio.observe(watch);
      });
    };
    if (root.classList.contains('site-ready')) startReveals();
    else document.addEventListener('site:ready', startReveals, { once: true });
  } else {
    revealEls.forEach(function (el) { el.classList.add('is-in'); });
  }

  /* ---------------------------------------------------------------------
     5. Contadores
     --------------------------------------------------------------------- */
  $$('[data-count-to]').forEach(function (el) {
    var target = parseInt(el.getAttribute('data-count-to'), 10);
    var prefix = el.getAttribute('data-prefix') || '';
    if (reduceMotion || !('IntersectionObserver' in window)) { el.textContent = prefix + target; return; }
    el.textContent = prefix + '0';
    var o = new IntersectionObserver(function (entries) {
      if (!entries[0].isIntersecting) return;
      o.disconnect();
      var start = null, dur = 1400;
      (function step(ts) {
        if (!start) start = ts;
        var p = Math.min((ts - start) / dur, 1);
        el.textContent = prefix + Math.round((1 - Math.pow(1 - p, 4)) * target);
        if (p < 1) requestAnimationFrame(step);
      })(performance.now());
    }, { threshold: 0.6 });
    o.observe(el);
  });

  /* ---------------------------------------------------------------------
     6. Rolagem: cabeçalho, barra de progresso, parallax (um único rAF)
     --------------------------------------------------------------------- */
  var header = $('#header');
  var progressBar = $('#scrollProgress');
  var fixedCta = $('#fixedCta');
  var heroEl = $('.hero');
  var hireEl = $('#contratar');
  var parallaxEls = (!reduceMotion && window.matchMedia('(min-width: 768px)').matches) ? $$('[data-parallax]') : [];
  var lastY = window.scrollY, ticking = false, menuOpen = false;

  function onScroll() {
    var y = window.scrollY;
    var max = document.documentElement.scrollHeight - window.innerHeight;
    progressBar.style.transform = 'scaleX(' + (max > 0 ? y / max : 0) + ')';

    header.classList.toggle('is-scrolled', y > 20);
    if (!menuOpen) header.classList.toggle('is-hidden', y > lastY && y > window.innerHeight * 0.6);
    // no celular a bolha recolhe enquanto rola pra baixo (não cobre conteúdo) e volta ao rolar pra cima
    if (y !== lastY) fixedCta.classList.toggle('is-tucked', y > lastY && window.innerWidth < 768);
    lastY = y;

    var vh = window.innerHeight;
    for (var i = 0; i < parallaxEls.length; i++) {
      var el = parallaxEls[i];
      var r = (el.closest('.media, .hero-backdrop') || el.parentElement).getBoundingClientRect();
      if (r.bottom < -100 || r.top > vh + 100) continue;
      var speed = parseFloat(el.getAttribute('data-parallax')) || 0;
      var offset = (r.top + r.height / 2 - vh / 2) * speed;
      el.style.transform = 'translate3d(0,' + offset.toFixed(1) + 'px,0)';
    }
    ticking = false;
  }
  window.addEventListener('scroll', function () {
    if (!ticking) { ticking = true; requestAnimationFrame(onScroll); }
  }, { passive: true });
  window.addEventListener('resize', function () { requestAnimationFrame(onScroll); });
  onScroll();

  // bolha do WhatsApp: aparece depois do hero e some na seção de contratação (evita CTA duplicado)
  if ('IntersectionObserver' in window) {
    var heroVisible = true, hireVisible = false;
    var updateCta = function () { fixedCta.classList.toggle('is-visible', !heroVisible && !hireVisible && !menuOpen); };
    new IntersectionObserver(function (e) { heroVisible = e[0].isIntersecting; updateCta(); }, { threshold: 0.05 }).observe(heroEl);
    new IntersectionObserver(function (e) { hireVisible = e[0].isIntersecting; updateCta(); }, { threshold: 0.2 }).observe(hireEl);
  }

  // link ativo da navegação
  var navLinks = $$('[data-nav]');
  var sections = ['identidade', 'lancamentos', 'palco', 'contratar'].map(function (id) { return document.getElementById(id); });
  if ('IntersectionObserver' in window) {
    var nio = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        navLinks.forEach(function (l) {
          var on = !!e.target.id && l.getAttribute('href') === '#' + e.target.id;
          l.classList.toggle('is-active', on);
          if (on) l.setAttribute('aria-current', 'true'); else l.removeAttribute('aria-current');
        });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    sections.forEach(function (s) { if (s) nio.observe(s); });
    nio.observe(heroEl); // no hero nenhum item fica ativo
  }

  /* ---------------------------------------------------------------------
     7. Menu mobile
     --------------------------------------------------------------------- */
  var toggle = $('#menuToggle');
  var menu = $('#mobileMenu');
  function setMenu(open) {
    menuOpen = open;
    menu.classList.toggle('is-open', open);
    menu.setAttribute('aria-hidden', open ? 'false' : 'true');
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    toggle.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
    root.classList.toggle('menu-open', open);
    header.classList.remove('is-hidden');
    if ('inert' in HTMLElement.prototype) {
      $('main').inert = open; $('.footer').inert = open;
    }
    fixedCta.classList.toggle('is-visible', false);
    if (open) { var first = $('a', menu); if (first) setTimeout(function () { first.focus({ preventScroll: true }); }, 350); }
  }
  toggle.addEventListener('click', function () { setMenu(!menuOpen); });
  $$('a', menu).forEach(function (a) { a.addEventListener('click', function () { setMenu(false); }); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && menuOpen) { setMenu(false); toggle.focus(); }
  });
  var mqDesk = window.matchMedia('(min-width: 1024px)');
  var onDesk = function (m) { if (m.matches && menuOpen) setMenu(false); };
  if (mqDesk.addEventListener) mqDesk.addEventListener('change', onDesk); else if (mqDesk.addListener) mqDesk.addListener(onDesk);

  /* ---------------------------------------------------------------------
     8. Carrosséis: arrastar, setas, progresso
     --------------------------------------------------------------------- */
  function setupCarousel(el) {
    if (!el) return;
    var controls = $('[data-controls-for="' + el.id + '"]');
    var bar = controls ? $('.carousel-progress', controls) : null;
    var prev = controls ? $('[data-dir="-1"]', controls) : null;
    var next = controls ? $('[data-dir="1"]', controls) : null;

    function update() {
      var max = el.scrollWidth - el.clientWidth;
      var scrollable = max > 4 && getComputedStyle(el).overflowX !== 'visible';
      if (controls) controls.classList.toggle('is-static', !scrollable);
      if (bar) bar.style.setProperty('--p', scrollable ? (el.scrollLeft / max).toFixed(3) : 1);
      if (prev) prev.disabled = el.scrollLeft < 4;
      if (next) next.disabled = el.scrollLeft > max - 4;
    }
    function stepSize() {
      var card = el.firstElementChild;
      if (!card) return el.clientWidth;
      return card.getBoundingClientRect().width + parseFloat(getComputedStyle(el).columnGap || 0);
    }
    [prev, next].forEach(function (b) {
      if (!b) return;
      b.addEventListener('click', function () {
        el.scrollBy({ left: stepSize() * parseInt(b.getAttribute('data-dir'), 10), behavior: reduceMotion ? 'auto' : 'smooth' });
      });
    });
    el.addEventListener('scroll', function () { requestAnimationFrame(update); }, { passive: true });
    window.addEventListener('resize', update);
    update();

    // arrastar com mouse (toque usa rolagem nativa)
    if (finePointer) {
      var down = false, startX = 0, startLeft = 0, moved = false;
      el.addEventListener('pointerdown', function (e) {
        if (e.pointerType !== 'mouse' || e.button !== 0) return;
        if (e.target.closest('button')) return;
        down = true; moved = false; startX = e.clientX; startLeft = el.scrollLeft;
      });
      window.addEventListener('pointermove', function (e) {
        if (!down) return;
        var dx = e.clientX - startX;
        if (!moved && Math.abs(dx) > 6) { moved = true; el.classList.add('is-dragging'); }
        if (moved) el.scrollLeft = startLeft - dx;
      });
      window.addEventListener('pointerup', function () {
        if (!down) return;
        down = false;
        if (moved) {
          el.classList.remove('is-dragging');
          // devolve o snap suavemente
          var s = stepSize(); el.scrollTo({ left: Math.round(el.scrollLeft / s) * s, behavior: 'smooth' });
        }
      });
      el.addEventListener('click', function (e) { if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; } }, true);
      el.addEventListener('dragstart', function (e) { e.preventDefault(); });
    }

    // teclado: setas quando o carrossel tem foco
    el.addEventListener('keydown', function (e) {
      if (e.target !== el) return;
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        el.scrollBy({ left: stepSize() * (e.key === 'ArrowRight' ? 1 : -1), behavior: reduceMotion ? 'auto' : 'smooth' });
      }
    });
  }
  setupCarousel($('#releaseCarousel'));
  setupCarousel($('#videoCarousel'));

  /* ---------------------------------------------------------------------
     9. Desktop: botões magnéticos e etiqueta que segue o cursor
     --------------------------------------------------------------------- */
  if (finePointer && !reduceMotion) {
    $$('.magnetic').forEach(function (btn) {
      btn.addEventListener('pointermove', function (e) {
        var r = btn.getBoundingClientRect();
        var x = (e.clientX - r.left - r.width / 2) * 0.2;
        var y = (e.clientY - r.top - r.height / 2) * 0.3;
        btn.style.transform = 'translate(' + x + 'px,' + y + 'px)';
      });
      btn.addEventListener('pointerleave', function () { btn.style.transform = ''; });
    });

    var label = $('#hoverLabel');
    $$('[data-label]').forEach(function (card) {
      card.addEventListener('pointerenter', function () { label.textContent = card.getAttribute('data-label'); label.classList.add('show'); });
      card.addEventListener('pointermove', function (e) {
        label.style.setProperty('--x', e.clientX + 'px');
        label.style.setProperty('--y', e.clientY + 'px');
      });
      card.addEventListener('pointerleave', function () { label.classList.remove('show'); });
    });
  }

  /* ---------------------------------------------------------------------
     10. Rodapé
     --------------------------------------------------------------------- */
  var yearEl = $('#footer-year');
  if (yearEl) yearEl.textContent = '@XANDBAP • ' + new Date().getFullYear();
})();
