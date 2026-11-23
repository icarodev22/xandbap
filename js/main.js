/* =====================================================================
   XANDBAP — interações (sem bibliotecas)
   ===================================================================== */
(function () {
  'use strict';

  var root = document.documentElement;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var desktop = window.matchMedia('(min-width: 1024px)');
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };

  /* -------------------------------------------------------------------
     1. Signature Reveal — o nome/logo se monta a partir de faixas
        horizontais deslocadas, como os traços cortados da logo oficial.
     ------------------------------------------------------------------- */
  function prepSig(el) {
    if (el._sig) return el._sig;
    var src = document.createElement('span');
    src.className = 'sig-src';
    while (el.firstChild) src.appendChild(el.firstChild);
    el.appendChild(src);
    el._sig = { src: src, busy: false };
    return el._sig;
  }

  function signature(el, mode) {
    var s = prepSig(el);
    if (reduce || s.busy || !el.animate) return Promise.resolve();
    s.busy = true;
    var isText = el.classList.contains('sig-text');
    var n = isText ? 5 : 6;
    var layers = [], anims = [];
    var amp = mode === 'hover' ? 0.05 : (isText ? 0.16 : 0.22); // fração da largura

    for (var i = 0; i < n; i++) {
      var layer = document.createElement('span');
      layer.className = 'sig-layer';
      layer.setAttribute('aria-hidden', 'true');
      layer.innerHTML = s.src.innerHTML;
      var top = (i / n) * 100, bottom = 100 - ((i + 1) / n) * 100;
      // sobreposição de 0,5% evita fio entre faixas
      layer.style.clipPath = 'inset(' + Math.max(0, top - 0.5) + '% -2% ' + Math.max(0, bottom - 0.5) + '% -2%)';
      el.appendChild(layer);
      layers.push(layer);

      var dir = i % 2 === 0 ? -1 : 1;
      var dx = dir * amp * (1 + (i % 3) * 0.35) * 100;
      var frames, opts;
      if (mode === 'hover') {
        frames = [{ transform: 'translateX(0)' }, { transform: 'translateX(' + dx + '%)' }, { transform: 'translateX(0)' }];
        opts = { duration: 460, delay: i * 22, easing: 'cubic-bezier(.65,0,.35,1)', fill: 'both' };
      } else {
        frames = [{ transform: 'translateX(' + dx + '%)', opacity: 0 }, { opacity: 1, offset: 0.35 }, { transform: 'translateX(0)', opacity: 1 }];
        opts = { duration: 900, delay: i * 55, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'both' };
      }
      anims.push(layer.animate(frames, opts).finished);
      // uma das faixas do nome entra vermelha e esfria para o branco: o traço da marca
      if (isText && mode !== 'hover' && i === 2) {
        layer.animate([{ color: '#E4231F' }, { color: '#E4231F', offset: 0.55 }, { color: '#F4F3F0' }],
          { duration: 1300, delay: i * 55, easing: 'ease-out', fill: 'both' });
      }
    }
    el.classList.add('is-animating');
    return Promise.all(anims).catch(function () {}).then(function () {
      layers.forEach(function (l) { l.remove(); });
      el.classList.remove('is-animating');
      s.busy = false;
    });
  }

  $$('.sig').forEach(prepSig);

  /* -------------------------------------------------------------------
     2. Hero: sequência de entrada (~1,3 s) após a fonte do nome
     ------------------------------------------------------------------- */
  var hero = $('.hero');
  var heroPhoto = $('.hero-photo');
  var heroName = $('.hero-name .sig');

  function startHero() {
    if (hero.classList.contains('is-in')) return;
    hero.classList.add('is-in');
    if (heroName) signature(heroName, 'intro');
  }
  var fontWait = (document.fonts && document.fonts.load)
    ? document.fonts.load('700 1em "Bricolage Grotesque"', 'XandBap')
    : Promise.resolve();
  // com a abertura, o hero começa quando as faixas pretas se abrem (~1 s após o início)
  var opening = root.classList.contains('has-opening') && $('#opening');
  var heroAt = opening ? 1000 : 0;
  function startWhenReady() {
    var wait = Math.max(0, heroAt - performance.now());
    setTimeout(startHero, wait);
  }
  Promise.race([fontWait, new Promise(function (r) { setTimeout(r, 700); })]).then(startWhenReady, startWhenReady);
  setTimeout(startHero, heroAt + 1500); // garantia
  if (opening) setTimeout(function () { opening.remove(); }, 2000);

  // profundidade discreta da foto (desktop, ponteiro fino)
  if (fine && !reduce && heroPhoto) {
    var img = $('img', heroPhoto);
    hero.addEventListener('pointermove', function (e) {
      if (!desktop.matches) return;
      var r = hero.getBoundingClientRect();
      var x = (e.clientX - r.left) / r.width - 0.5;
      var y = (e.clientY - r.top) / r.height - 0.5;
      img.style.setProperty('--mx', (x * -12).toFixed(1) + 'px');
      img.style.setProperty('--my', (y * -10).toFixed(1) + 'px');
    });
    hero.addEventListener('pointerleave', function () {
      img.style.setProperty('--mx', '0px');
      img.style.setProperty('--my', '0px');
    });
  }

  /* -------------------------------------------------------------------
     3. Rolagem: header, transição do hero (um único rAF)
     ------------------------------------------------------------------- */
  var header = $('#header');
  var ticking = false;
  function onScroll() {
    ticking = false;
    var y = window.scrollY;
    header.classList.toggle('is-solid', y > 8);
    if (!reduce && hero) {
      var h = hero.offsetHeight;
      if (y < h + 200) hero.style.setProperty('--p', clamp(y / h, 0, 1).toFixed(3));
    }
  }
  window.addEventListener('scroll', function () {
    if (!ticking) { ticking = true; requestAnimationFrame(onScroll); }
  }, { passive: true });
  onScroll();

  // link ativo da navegação
  var navLinks = $$('.nav a');
  if ('IntersectionObserver' in window) {
    var navIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        navLinks.forEach(function (a) { a.classList.toggle('is-current', a.getAttribute('href') === '#' + e.target.id); });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    ['musica', 'em-cena', 'contratacao'].forEach(function (id) { var s = document.getElementById(id); if (s) navIO.observe(s); });
    navIO.observe(hero); // no hero nenhum link fica ativo (hero não tem id → nenhum match)
  }

  /* -------------------------------------------------------------------
     4. Revelação ao rolar — só para o que ainda está abaixo da dobra
     ------------------------------------------------------------------- */
  if ('IntersectionObserver' in window && !reduce) {
    var rio = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.remove('pre'); rio.unobserve(e.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    $$('.reveal').forEach(function (el) {
      if (el.getBoundingClientRect().top > window.innerHeight) { el.classList.add('pre'); rio.observe(el); }
    });
  }

  // assinatura da logo: no hover do header e uma vez ao ver a contratação
  $$('[data-sig="hover"]').forEach(function (el) {
    var target = el.closest('a') || el;
    target.addEventListener('pointerenter', function () { if (fine) signature(el, 'hover'); });
  });
  $$('[data-sig="view"]').forEach(function (el) {
    if (!('IntersectionObserver' in window) || reduce) return;
    var o = new IntersectionObserver(function (entries) {
      if (entries[0].isIntersecting) { o.disconnect(); signature(el, 'intro'); }
    }, { threshold: 0.6 });
    o.observe(el);
  });

  /* -------------------------------------------------------------------
     4b. Luz vermelha localizada e profundidade nas capas (ponteiro fino)
     ------------------------------------------------------------------- */
  if (fine && !reduce) {
    $$('[data-glow]').forEach(function (el) {
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        var x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
        el.style.setProperty('--gx', (x * 100).toFixed(1) + '%');
        el.style.setProperty('--gy', (y * 100).toFixed(1) + '%');
        if (el.hasAttribute('data-tilt') && el.closest('.is-current')) {
          el.classList.add('is-tilting');
          el.style.setProperty('--rx', ((0.5 - y) * 7).toFixed(2) + 'deg');
          el.style.setProperty('--ry', ((x - 0.5) * 9).toFixed(2) + 'deg');
        }
      });
      el.addEventListener('pointerleave', function () {
        el.classList.remove('is-tilting');
        el.style.setProperty('--rx', '0deg');
        el.style.setProperty('--ry', '0deg');
      });
    });
  }

  /* -------------------------------------------------------------------
     5. Vitrine musical (rolagem horizontal com foco no centro)
     ------------------------------------------------------------------- */
  (function shelfInit() {
    var shelf = $('#shelf');
    if (!shelf) return;
    // ordem automática: mais recente primeiro (itens sem data mantêm a ordem, depois dos datados)
    var all = $$('[data-release]', shelf);
    var stamp = function (el) { var d = Date.parse(el.getAttribute('data-date') || ''); return isNaN(d) ? -Infinity : d; };
    all.map(function (el, i) { return { el: el, t: stamp(el), i: i }; })
      .sort(function (a, b) { return b.t - a.t || a.i - b.i; })
      .forEach(function (o) { shelf.appendChild(o.el); });

    // destaque temporário: só o mais recente, por até 60 dias após o lançamento
    var HIGHLIGHT_DAYS = 60;
    all.forEach(function (el, i) {
      var t = stamp(el);
      var fresh = el === shelf.firstElementChild && t !== -Infinity && (Date.now() - t) / 864e5 <= HIGHLIGHT_DAYS;
      if (fresh || !el.classList.contains('is-featured')) return;
      el.classList.remove('is-featured');
      var tag = $('.release-tag', el); if (tag) tag.remove();
      var cta = $('.release-cta', el); if (cta) cta.className = 'release-link';
    });
    if (!$('.release.is-featured', shelf) || shelf.firstElementChild !== $('.release.is-featured', shelf)) shelf.classList.remove('has-featured');

    var items = $$('[data-release]', shelf);
    var section = shelf.closest('section');
    var ui = $('[data-shelf-ui]');
    var prev = $('[data-shelf-prev]'), next = $('[data-shelf-next]');
    var current = -1;
    if (items.length < 2) ui.classList.add('is-hidden');

    // tom ambiente a partir da capa (só se a imagem for legível no canvas)
    function tintOf(item) {
      if (item._tint !== undefined) return item._tint;
      var im = $('img', item);
      item._tint = null;
      try {
        if (!im.complete || !im.naturalWidth) return null;
        var c = document.createElement('canvas'); c.width = c.height = 8;
        var x = c.getContext('2d'); x.drawImage(im, 0, 0, 8, 8);
        var d = x.getImageData(0, 0, 8, 8).data, r = 0, g = 0, b = 0;
        for (var i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; }
        var n = d.length / 4;
        item._tint = Math.round(r / n) + ' ' + Math.round(g / n) + ' ' + Math.round(b / n);
      } catch (e) { item._tint = null; }
      return item._tint;
    }

    function centerOf(i) {
      var it = items[i];
      return it.offsetLeft - (shelf.clientWidth - it.offsetWidth) / 2;
    }
    function go(i) {
      i = clamp(i, 0, items.length - 1);
      shelf.scrollTo({ left: centerOf(i), behavior: reduce ? 'auto' : 'smooth' });
    }
    function update() {
      var mid = shelf.scrollLeft + shelf.clientWidth / 2, best = 0, bestD = Infinity;
      items.forEach(function (it, i) {
        var d = Math.abs(it.offsetLeft + it.offsetWidth / 2 - mid);
        if (d < bestD) { bestD = d; best = i; }
      });
      if (best !== current) {
        current = best;
        items.forEach(function (it, i) {
          var on = i === best;
          it.classList.toggle('is-current', on);
          $$('a, button', it).forEach(function (a) { a.tabIndex = on ? 0 : -1; });
        });
        var t = tintOf(items[best]);
        if (t) section.style.setProperty('--tint', t);
      }
      prev.disabled = shelf.scrollLeft < 4;
      next.disabled = shelf.scrollLeft > shelf.scrollWidth - shelf.clientWidth - 4;
    }
    var raf = 0;
    shelf.addEventListener('scroll', function () { cancelAnimationFrame(raf); raf = requestAnimationFrame(update); }, { passive: true });
    window.addEventListener('resize', function () { current = -1; update(); });
    items.forEach(function (it) {
      var im = $('img', it);
      im.addEventListener('load', function () { it._tint = undefined; if (items[current] === it) { current = -1; update(); } });
    });
    prev.addEventListener('click', function () { go(current - 1); });
    next.addEventListener('click', function () { go(current + 1); });
    shelf.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') { e.preventDefault(); go(current + 1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(current - 1); }
    });
    // clicar em um item fora de foco traz ele para o centro em vez de abrir o link
    items.forEach(function (it, i) {
      it.addEventListener('click', function (e) {
        if (i !== current) { e.preventDefault(); go(i); }
      });
    });

    // arrastar com mouse
    if (fine) {
      var down = false, moved = false, sx = 0, sl = 0;
      shelf.addEventListener('pointerdown', function (e) {
        if (e.pointerType !== 'mouse' || e.button !== 0) return;
        down = true; moved = false; sx = e.clientX; sl = shelf.scrollLeft;
      });
      window.addEventListener('pointermove', function (e) {
        if (!down) return;
        var dx = e.clientX - sx;
        if (!moved && Math.abs(dx) > 6) { moved = true; shelf.classList.add('is-drag'); }
        if (moved) shelf.scrollLeft = sl - dx;
      });
      window.addEventListener('pointerup', function () {
        if (!down) return;
        down = false;
        if (moved) { shelf.classList.remove('is-drag'); update(); go(current); }
      });
      shelf.addEventListener('click', function (e) { if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; } }, true);
      shelf.addEventListener('dragstart', function (e) { e.preventDefault(); });
    }
    update();
  })();

  /* -------------------------------------------------------------------
     6. Showreel: expansão, reprodução controlada, áudio reativo real
     ------------------------------------------------------------------- */
  (function reelInit() {
    var reel = $('#reel');
    if (!reel) return;
    var tiles = $$('[data-tile]', reel);
    var videos = $$('video', reel);

    function activate(tile) {
      tiles.forEach(function (t) { t.classList.toggle('is-active', t === tile); });
    }
    function pauseOthers(v) { videos.forEach(function (o) { if (o !== v && !o.paused) o.pause(); }); }
    function play(v, withSound) {
      var tile = v.closest('[data-tile]');
      activate(tile);
      pauseOthers(v);
      if (withSound !== undefined) setMuted(v, !withSound);
      var p = v.play();
      if (p && p.catch) p.catch(function () { setMuted(v, true); v.play().catch(function () {}); });
    }
    function setMuted(v, m) {
      v.muted = m;
      var b = $('[data-sound="' + v.id + '"]');
      if (b) {
        b.setAttribute('aria-pressed', m ? 'false' : 'true');
        b.setAttribute('aria-label', m ? 'Ativar som' : 'Desativar som');
      }
      syncMeter();
    }
    function fmt(t) { t = Math.floor(t || 0); return Math.floor(t / 60) + ':' + (t % 60 < 10 ? '0' : '') + (t % 60); }

    videos.forEach(function (v) {
      var tile = v.closest('[data-tile]');
      var toggle = $('[data-toggle="' + v.id + '"]');
      var time = $('[data-time="' + v.id + '"]');
      v.addEventListener('play', function () {
        tile.classList.add('is-started');
        toggle.classList.remove('is-paused'); toggle.setAttribute('aria-label', 'Pausar');
      });
      v.addEventListener('pause', function () {
        toggle.classList.add('is-paused'); toggle.setAttribute('aria-label', 'Reproduzir');
        syncMeter();
      });
      v.addEventListener('playing', syncMeter);
      v.addEventListener('timeupdate', function () { time.textContent = fmt(v.currentTime); });
      v.addEventListener('error', function () { tile.classList.add('is-error'); });
    });

    $$('[data-play]', reel).forEach(function (b) {
      b.addEventListener('click', function (e) { e.stopPropagation(); play(document.getElementById(b.getAttribute('data-play')), true); });
    });
    $$('[data-toggle]', reel).forEach(function (b) {
      b.addEventListener('click', function (e) {
        e.stopPropagation();
        var v = document.getElementById(b.getAttribute('data-toggle'));
        if (v.paused) play(v); else v.pause();
      });
    });
    $$('[data-sound]', reel).forEach(function (b) {
      b.addEventListener('click', function (e) {
        e.stopPropagation();
        var v = document.getElementById(b.getAttribute('data-sound'));
        setMuted(v, !v.muted);
        if (!v.muted && v.paused) play(v);
      });
    });
    $$('[data-full]', reel).forEach(function (b) {
      b.addEventListener('click', function (e) {
        e.stopPropagation();
        var v = document.getElementById(b.getAttribute('data-full'));
        try {
          if (v.requestFullscreen) v.requestFullscreen().catch(function () {});
          else if (v.webkitEnterFullscreen) v.webkitEnterFullscreen();
        } catch (err) {}
      });
    });

    // clique no tile: no desktop expande; no toque, reproduz/pausa
    tiles.forEach(function (tile) {
      tile.addEventListener('click', function () {
        var v = $('video', tile);
        if (desktop.matches && !tile.classList.contains('is-active')) {
          tiles.forEach(function (t) { var o = $('video', t); if (o && t !== tile && !o.paused) o.pause(); });
          activate(tile);
          return;
        }
        if (v && tile.classList.contains('is-started')) { if (v.paused) play(v); else v.pause(); }
        else if (v) play(v, true);
      });
      tile.tabIndex = 0;
      tile.addEventListener('keydown', function (e) {
        if (e.target !== tile) return;
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tile.click(); }
      });
    });
    $$('img, video', reel).forEach(function (m) { m.setAttribute('draggable', 'false'); });
    $$('.tile-bar', reel).forEach(function (bar) { bar.addEventListener('click', function (e) { e.stopPropagation(); }); });

    // revelação suave dos itens (só se o reel ainda estiver abaixo da dobra)
    tiles.forEach(function (t, i) { t.style.setProperty('--i', i); });
    if ('IntersectionObserver' in window && !reduce && reel.getBoundingClientRect().top > window.innerHeight) {
      reel.classList.add('pre-tiles');
      var tio = new IntersectionObserver(function (en) {
        if (en[0].isIntersecting) { reel.classList.remove('pre-tiles'); tio.disconnect(); }
      }, { threshold: 0.15 });
      tio.observe(reel);
    }

    // estado de rolagem (desktop: o reel rola na lateral quando passa da coluna)
    function edges() {
      var max = reel.scrollWidth - reel.clientWidth;
      var scrollable = max > 4 && getComputedStyle(reel).overflowX !== 'visible';
      reel.classList.toggle('is-scrollable', scrollable);
      reel.classList.toggle('at-start', reel.scrollLeft < 4);
      reel.classList.toggle('at-end', reel.scrollLeft > max - 4);
    }
    reel.addEventListener('scroll', function () { requestAnimationFrame(edges); }, { passive: true });
    window.addEventListener('resize', edges);
    reel.addEventListener('transitionend', function (e) {
      if (e.propertyName !== 'width' || !e.target.classList.contains('is-active')) return;
      edges();
      if (!desktop.matches) return;
      var t = e.target, l = t.offsetLeft - reel.offsetLeft, r = l + t.offsetWidth;
      if (l < reel.scrollLeft) reel.scrollTo({ left: l - 4, behavior: 'smooth' });
      else if (r > reel.scrollLeft + reel.clientWidth) reel.scrollTo({ left: r - reel.clientWidth + 4, behavior: 'smooth' });
    });
    edges();

    if (fine) {
      var rd = false, rm = false, rsx = 0, rsl = 0;
      reel.addEventListener('pointerdown', function (e) {
        if (e.pointerType !== 'mouse' || e.button !== 0 || e.target.closest('button')) return;
        rd = true; rm = false; rsx = e.clientX; rsl = reel.scrollLeft;
      });
      window.addEventListener('pointermove', function (e) {
        if (!rd) return;
        var dx = e.clientX - rsx;
        if (!rm && Math.abs(dx) > 6 && reel.classList.contains('is-scrollable')) { rm = true; reel.classList.add('is-drag'); }
        if (rm) reel.scrollLeft = rsl - dx;
      });
      window.addEventListener('pointerup', function () {
        if (!rd) return;
        rd = false;
        if (rm) { reel.classList.remove('is-drag'); setTimeout(function () { rm = false; }, 0); }
      });
      reel.addEventListener('click', function (e) { if (rm) { e.preventDefault(); e.stopPropagation(); } }, true);
    }

    // pausa o que sai da tela
    if ('IntersectionObserver' in window) {
      var vio = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) { if (!e.isIntersecting && !e.target.paused) e.target.pause(); });
      }, { threshold: 0.15 });
      videos.forEach(function (v) { vio.observe(v); });
    }

    /* Reação ao áudio: lê o sinal real do vídeo via captureStream + AnalyserNode.
       Não reencaminha a saída de som (o vídeo continua tocando pelo caminho
       nativo). Onde o navegador não oferece isso (ex.: Safari), nada reage. */
    var AC = window.AudioContext || window.webkitAudioContext;
    var actx = null, meters = new Map(), loop = 0, level = 0;

    function meterFor(v) {
      if (meters.has(v)) return meters.get(v);
      if (!AC || typeof v.captureStream !== 'function') return null;
      try {
        var stream = v.captureStream();
        if (!stream.getAudioTracks().length) return null; // ainda sem trilha: tenta de novo no próximo "playing"
        actx = actx || new AC();
        var src = actx.createMediaStreamSource(stream);
        var an = actx.createAnalyser(); an.fftSize = 512; an.smoothingTimeConstant = 0.6;
        var mute = actx.createGain(); mute.gain.value = 0; // mantém o grafo ativo sem tocar nada
        src.connect(an); an.connect(mute); mute.connect(actx.destination);
        var m = { an: an, buf: new Uint8Array(an.fftSize) };
        meters.set(v, m);
        return m;
      } catch (e) { meters.set(v, null); return null; }
    }

    function syncMeter() {
      var live = null;
      videos.forEach(function (v) { if (!v.paused && !v.muted && !live) live = v; });
      $$('.ctl-sound', reel).forEach(function (b) { b.classList.remove('is-live'); b.style.removeProperty('--lvl'); });
      cancelAnimationFrame(loop);
      if (!live || reduce) return;
      var m = meterFor(live);
      if (!m) return;
      if (actx && actx.state === 'suspended') actx.resume().catch(function () {});
      var btn = $('[data-sound="' + live.id + '"]');
      btn.classList.add('is-live');
      (function frame() {
        m.an.getByteTimeDomainData(m.buf);
        var sum = 0;
        for (var i = 0; i < m.buf.length; i++) { var s = (m.buf[i] - 128) / 128; sum += s * s; }
        var rms = Math.sqrt(sum / m.buf.length);
        var target = clamp(rms * 3.2, 0, 1);
        level += (target - level) * (target > level ? 0.5 : 0.15);
        btn.style.setProperty('--lvl', level.toFixed(3));
        loop = requestAnimationFrame(frame);
      })();
    }
  })();

  /* -------------------------------------------------------------------
     7. Rodapé
     ------------------------------------------------------------------- */
  var y = $('[data-year]');
  if (y) y.textContent = new Date().getFullYear();
})();
