/* =====================================================================
   Playground: turns every <div class="pg"><textarea>…</textarea></div>
   into a live p5.js editor + output frame + console.

   Options (data-attributes on .pg):
     data-id="03-a"        unique id, used to remember your edits
     data-title="…"        label shown in the header
     data-height="420"     output height in px (auto-adjusts to canvas)
     data-autorun="false"  don't run automatically when scrolled into view
   ===================================================================== */
(function () {
  'use strict';

  const ROOT = (document.body.dataset.root || '.').replace(/\/$/, '');
  const abs = (p) => new URL(ROOT + '/' + p, location.href).href;
  const P5_LOCAL = abs('vendor/p5.min.js');
  const SOUND_LOCAL = abs('vendor/p5.sound.min.js');
  const P5_CDN = 'https://cdn.jsdelivr.net/npm/p5@1.11.13/lib/p5.min.js';
  const SOUND_CDN = 'https://cdn.jsdelivr.net/npm/p5@1.11.13/lib/addons/p5.sound.min.js';

  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } },
  };

  /* ---------------- Audio source (shared by all playgrounds) ---------------- */
  const audio = { url: null, name: 'Demo beat (120 BPM)' };
  function demoUrl() {
    if (!window.DEMO_AUDIO_B64) return null;
    if (!demoUrl.cache) {
      const bin = atob(window.DEMO_AUDIO_B64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      demoUrl.cache = URL.createObjectURL(new Blob([bytes], { type: 'audio/wav' }));
    }
    return demoUrl.cache;
  }
  audio.url = demoUrl();

  function buildAudioBar() {
    const needsAudio = document.querySelector('.pg[data-audio]') || document.body.hasAttribute('data-audio');
    if (!needsAudio) return;
    const bar = document.createElement('div');
    bar.className = 'audio-bar';
    bar.innerHTML =
      '<span class="audio-bar__label">♫ Track for sketches:</span>' +
      '<strong class="audio-bar__name"></strong>' +
      '<label class="btn btn--small">Choose your own track…<input type="file" accept="audio/*" hidden></label>' +
      '<button class="btn btn--small btn--ghost" data-demo>Use demo beat</button>' +
      (document.body.hasAttribute('data-live') ? '<button class="btn btn--small btn--ghost" data-mic>🎤 Mic / line-in</button>' : '');
    const nameEl = bar.querySelector('.audio-bar__name');
    const input = bar.querySelector('input');
    const refresh = () => { nameEl.textContent = audio.name; };
    input.addEventListener('change', () => {
      const f = input.files && input.files[0];
      if (!f) return;
      if (audio.userUrl) URL.revokeObjectURL(audio.userUrl);
      audio.userUrl = URL.createObjectURL(f);
      audio.url = audio.userUrl;
      audio.name = f.name;
      refresh();
      rerunAudioPlaygrounds();
    });
    bar.querySelector('[data-demo]').addEventListener('click', () => {
      audio.url = demoUrl();
      audio.name = 'Demo beat (120 BPM)';
      refresh();
      rerunAudioPlaygrounds();
    });
    const micBtn = bar.querySelector('[data-mic]');
    if (micBtn) micBtn.addEventListener('click', () => {
      audio.url = null;
      audio.name = 'Mic / line-in (live input)';
      refresh();
      rerunAudioPlaygrounds();
    });
    refresh();
    const host = document.getElementById('audio-bar-slot') || document.querySelector('main');
    host.insertBefore(bar, host.firstChild);
  }

  /* ---------------- Friendly error hints ---------------- */
  function hintFor(msg) {
    let m;
    if ((m = /(\w+) is not defined/.exec(msg))) {
      return '"' + m[1] + '" doesn\'t exist. Check spelling and capitals (JavaScript is case-sensitive: fill ≠ Fill). If it is your own variable, declare it with  let ' + m[1] + ';  near the top.';
    }
    if (/Unexpected end of input/.test(msg)) return 'A bracket was opened but never closed. Count your { } and ( ) — every opener needs a closer.';
    if (/Unexpected token|Unexpected identifier|missing \) after|Invalid or unexpected token/.test(msg)) {
      return 'Syntax problem: usually a missing/extra bracket, a missing comma between arguments, or a typo. Check the reported line AND the line above it.';
    }
    if (/is not a function/.test(msg)) return 'You called something that isn\'t a function. Check the name\'s spelling, or that the object has that method.';
    if (/Cannot read propert/.test(msg)) return 'Something is undefined. Common causes: reading past the end of an array, or using a variable before you gave it a value.';
    if (/Assignment to constant/.test(msg)) return 'You tried to change a const. Use let for values that change.';
    if (/has already been declared/.test(msg)) return 'You declared the same name twice with let/const. Remove the second "let".';
    if (/decod|EncodingError|Unable to decode/i.test(msg)) return 'The browser couldn\'t decode that audio. Try an MP3 or WAV file.';
    return '';
  }

  /* p5.sound loads its AudioWorklets from blob: URLs, which Chrome refuses on
     pages opened from disk (file://). This shim re-routes them through data:
     URLs. It runs inside every sketch frame and is copied into exports. */
  function soundFileFix() {
    window.TONE_SILENCE_VERSION_LOGGING = true;
    if (!window.AudioWorklet || !window.URL || !URL.createObjectURL) return;
    var blobs = {};
    var create = URL.createObjectURL;
    URL.createObjectURL = function (obj) {
      var url = create.apply(URL, arguments);
      if (obj && obj.type === 'application/javascript') blobs[url] = obj;
      return url;
    };
    var addModule = AudioWorklet.prototype.addModule;
    AudioWorklet.prototype.addModule = function (url, options) {
      var self = this, blob = blobs[url];
      if (!blob) return addModule.call(this, url, options);
      return blob.text().then(function (src) {
        return addModule.call(self, 'data:text/javascript;base64,' + btoa(unescape(encodeURIComponent(src))), options);
      });
    };
  }
  const FIX_SCRIPT = '<script>(' + soundFileFix.toString() + ')();<\/script>';

  /* ---------------- Document that runs inside the frame ---------------- */
  // Everything before the user's code. Its line count is used to translate
  // error line numbers back to editor line numbers.
  function prelude(id, opts) {
    return [
      '<!doctype html><html><head><meta charset="utf-8">',
      '<style>html,body{margin:0;height:100%;background:#0b0b10;overflow:hidden}body{display:flex;align-items:center;justify-content:center}canvas{display:block}main{display:contents}</style>',
      '<script>',
      '(function(){',
      '  var ID=' + JSON.stringify(id) + ';',
      '  var send=function(type,msg,line){try{parent.postMessage({__pg:ID,type:type,msg:msg,line:line},"*")}catch(e){}};',
      '  var fmt=function(v){if(typeof v==="string")return v;try{var s=JSON.stringify(v);return s===undefined?String(v):s}catch(e){return String(v)}};',
      '  ["log","info","warn","error"].forEach(function(k){var o=console[k];console[k]=function(){var a=[].slice.call(arguments);send(k==="info"?"log":k,a.map(fmt).join(" "));o.apply(console,a)}});',
      '  window.onerror=function(m,src,line){send("error",String(m),line);};',
      '  window.addEventListener("unhandledrejection",function(e){send("error",String(e.reason&&e.reason.message||e.reason));});',
      '  window.__fs=false;',
      '  window.addEventListener("message",function(e){if(e.data&&e.data.__fs!==undefined){window.__fs=e.data.__fs;}});',
      '})();',
      'window.AUDIO_URL=' + JSON.stringify(opts.audioUrl) + ';',
      'window.AUDIO_NAME=' + JSON.stringify(opts.audioName) + ';',
      '<\/script>',
      '<script src="' + P5_LOCAL + '"><\/script>',
      (opts.sound ? FIX_SCRIPT + '<script src="' + SOUND_LOCAL + '"><\/script>' : ''),
      '<script>',
      '(function(){',
      '  if(!window.p5){parent.postMessage({__pg:' + JSON.stringify(id) + ',type:"error",msg:"p5.js failed to load (vendor/p5.min.js missing?)"},"*");return;}',
      '  var sent="";',
      '  function fit(){var c=this.canvas;if(!c||!this.width)return;',
      '    var s=Math.min(innerWidth/this.width,innerHeight/this.height);if(!window.__fs)s=Math.min(1,s);',
      '    var W=Math.floor(this.width*s)+"px",H=Math.floor(this.height*s)+"px";',
      '    if(c.style.width!==W||c.style.height!==H){c.style.width=W;c.style.height=H;}',
      '    var key=this.width+"x"+this.height;if(key!==sent){sent=key;parent.postMessage({__pg:' + JSON.stringify(id) + ',type:"size",w:this.width,h:this.height},"*");}',
      '  }',
      '  p5.prototype.registerMethod("post",fit);',
      '  var refit=function(){if(p5.instance)fit.call(p5.instance);};',
      '  window.addEventListener("resize",refit);',
      '  window.addEventListener("load",function(){setTimeout(refit,60);setTimeout(refit,400);});',
      '})();',
      '<\/script>',
      '</head><body>',
      '<script>',
    ].join('\n') + '\n';
  }
  // p5.sound is only loaded when a sketch actually uses sound.
  const SOUND_RE = /AUDIO_URL|loadSound|userStartAudio|getAudioContext|outputVolume|p5\.(Amplitude|FFT|AudioIn|PeakDetect|Oscillator|SinOsc|SqrOsc|TriOsc|SawOsc|Envelope|Noise|SoundFile|SoundRecorder)/;
  // After the user's code: warn if they declared a function that p5 already
  // owns (e.g. "function norm()") — p5 silently replaces it, a nasty beginner trap.
  const P5_EVENTS = ['setup', 'draw', 'preload', 'mousePressed', 'mouseReleased', 'mouseMoved', 'mouseDragged', 'mouseClicked',
    'doubleClicked', 'mouseWheel', 'keyPressed', 'keyReleased', 'keyTyped', 'windowResized', 'touchStarted', 'touchMoved',
    'touchEnded', 'deviceMoved', 'deviceTurned', 'deviceShaken'];
  function postlude(code) {
    const names = [];
    code.replace(/function\s+([A-Za-z_$][\w$]*)\s*\(/g, (m, n) => { if (P5_EVENTS.indexOf(n) < 0) names.push(n); });
    return '\n<\/script><script>(function(n){if(!window.p5)return;n.forEach(function(k){if(k in p5.prototype)' +
      'console.warn(\'⚠ "\'+k+\'" is already the name of a built-in p5 function, so p5 will replace yours. Rename it (e.g. "my\'+k.charAt(0).toUpperCase()+k.slice(1)+\'").\');});})(' +
      JSON.stringify(names) + ');<\/script></body></html>';
  }

  /* ---------------- Playground instances ---------------- */
  const all = [];

  function create(el, index) {
    const ta = el.querySelector('textarea');
    const original = ta.value.replace(/^\n/, '').replace(/\s+$/, '') + '\n';
    const id = el.dataset.id || (document.body.dataset.lesson || 'pg') + '-' + index;
    const key = 'ccl-code-' + id;
    const saved = store.get(key);
    const title = el.dataset.title || 'Sketch';
    const baseHeight = parseInt(el.dataset.height || '400', 10);
    const usesAudio = el.hasAttribute('data-audio');

    el.innerHTML = '';
    el.classList.add('pg--ready');
    el.innerHTML =
      '<div class="pg__head">' +
      '  <span class="pg__title"></span><span class="pg__badge" hidden>edited</span>' +
      '  <span class="pg__spacer"></span>' +
      '  <button class="btn btn--small btn--run" title="Run (Ctrl/Cmd + Enter)">▶ Run</button>' +
      '  <button class="btn btn--small btn--ghost" data-act="stop" title="Stop">■ Stop</button>' +
      '  <button class="btn btn--small btn--ghost" data-act="reset" title="Restore the original code">↺ Reset</button>' +
      '  <button class="btn btn--small btn--ghost" data-act="fs" title="Fullscreen output">⛶</button>' +
      '  <button class="btn btn--small btn--ghost" data-act="export" title="Download as a standalone HTML file">⤓ Export</button>' +
      '</div>' +
      '<div class="pg__body">' +
      '  <div class="pg__code"></div>' +
      '  <div class="pg__out">' +
      '    <div class="pg__frame"><div class="pg__idle">▶ Run to see the output</div></div>' +
      '    <div class="pg__console" aria-live="polite"></div>' +
      '  </div>' +
      '</div>';
    el.querySelector('.pg__title').textContent = title;
    const badge = el.querySelector('.pg__badge');
    const frameBox = el.querySelector('.pg__frame');
    const consoleEl = el.querySelector('.pg__console');
    frameBox.style.height = baseHeight + 'px';

    const cm = window.CodeMirror(el.querySelector('.pg__code'), {
      value: saved || original,
      mode: 'javascript',
      theme: 'ccl',
      lineNumbers: true,
      matchBrackets: true,
      autoCloseBrackets: true,
      indentUnit: 2,
      tabSize: 2,
      lineWrapping: false,
      viewportMargin: Infinity,
      extraKeys: {
        'Ctrl-Enter': () => inst.run(),
        'Cmd-Enter': () => inst.run(),
        Tab: (c) => (c.somethingSelected() ? c.indentSelection('add') : c.replaceSelection('  ')),
      },
    });
    badge.hidden = !saved || saved === original;

    let saveTimer;
    cm.on('change', () => {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        const v = cm.getValue();
        if (v === original) { store.del(key); badge.hidden = true; } else { store.set(key, v); badge.hidden = false; }
      }, 300);
    });

    let iframe = null;
    let lastErr = '';
    let lineOffset = 0;

    function log(type, msg) {
      if (type === 'error') {
        if (msg === lastErr) return;
        lastErr = msg;
      }
      const row = document.createElement('div');
      row.className = 'pg__log pg__log--' + type;
      row.textContent = msg;
      const hint = type === 'error' ? hintFor(msg) : '';
      if (hint) {
        const h = document.createElement('div');
        h.className = 'pg__hint';
        h.textContent = '💡 ' + hint;
        row.appendChild(h);
      }
      consoleEl.appendChild(row);
      while (consoleEl.childNodes.length > 60) consoleEl.removeChild(consoleEl.firstChild);
      consoleEl.scrollTop = consoleEl.scrollHeight;
      consoleEl.classList.add('pg__console--open');
    }

    const inst = {
      el, id, usesAudio, cm,
      running: false,
      run() {
        inst.stop();
        consoleEl.innerHTML = '';
        consoleEl.classList.remove('pg__console--open');
        cm.getAllMarks().forEach((m) => m.clear());
        cm.eachLine((l) => cm.removeLineClass(l, 'background', 'cm-error-line'));
        lastErr = '';
        const code = cm.getValue();
        const pre = prelude(id, { audioUrl: audio.url, audioName: audio.name, sound: usesAudio || SOUND_RE.test(code) });
        lineOffset = pre.split('\n').length - 1;
        iframe = document.createElement('iframe');
        iframe.setAttribute('allow', 'autoplay; microphone; fullscreen');
        iframe.title = title + ' output';
        iframe.srcdoc = pre + code + postlude(code);
        frameBox.innerHTML = '';
        frameBox.appendChild(iframe);
        inst.running = true;
        el.classList.add('pg--running');
      },
      stop() {
        if (iframe) { iframe.remove(); iframe = null; }
        if (inst.running) frameBox.innerHTML = '<div class="pg__idle">Stopped — ▶ Run to start again</div>';
        inst.running = false;
        el.classList.remove('pg--running');
      },
      onMessage(d) {
        if (d.type === 'size') {
          const w = frameBox.clientWidth || d.w;
          const h = Math.round(d.h * Math.min(1, w / d.w));
          frameBox.style.height = Math.max(120, Math.min(h, 720)) + 'px';
          return;
        }
        let msg = d.msg;
        if (d.type === 'error' && d.line) {
          const userLine = d.line - lineOffset;
          if (userLine >= 1 && userLine <= cm.lineCount()) {
            msg += '  (line ' + userLine + ')';
            cm.addLineClass(userLine - 1, 'background', 'cm-error-line');
          }
        }
        log(d.type, msg);
      },
    };

    el.querySelector('.btn--run').addEventListener('click', () => inst.run());
    el.querySelector('[data-act="stop"]').addEventListener('click', () => inst.stop());
    el.querySelector('[data-act="reset"]').addEventListener('click', () => {
      if (cm.getValue() !== original && !confirm('Restore the original code? Your edits to this sketch will be lost.')) return;
      cm.setValue(original);
      store.del(key);
      badge.hidden = true;
      inst.run();
    });
    el.querySelector('[data-act="fs"]').addEventListener('click', () => {
      if (!iframe) inst.run();
      const f = iframe;
      const req = f.requestFullscreen || f.webkitRequestFullscreen;
      if (req) req.call(f);
    });
    el.querySelector('[data-act="export"]').addEventListener('click', () => exportSketch(cm.getValue(), title));

    if (el.dataset.autorun !== 'false') observer.observe(el);
    return inst;
  }

  function rerunAudioPlaygrounds() {
    all.forEach((p) => { if (p.usesAudio && p.running) p.run(); });
  }

  // Run sketches when they scroll into view, stop them when far away (saves CPU & stops overlapping audio).
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      const p = all.find((x) => x.el === e.target);
      if (!p) return;
      if (e.isIntersecting && !p.running && !p.autoStarted) { p.autoStarted = true; p.run(); }
      if (!e.isIntersecting && p.running) { p.stop(); p.autoStarted = false; }
    });
  }, { rootMargin: '150px 0px' });

  window.addEventListener('message', (e) => {
    const d = e.data;
    if (!d || !d.__pg) return;
    const p = all.find((x) => x.id === d.__pg);
    if (p) p.onMessage(d);
  });

  document.addEventListener('fullscreenchange', () => {
    const f = document.fullscreenElement;
    document.querySelectorAll('.pg__frame iframe').forEach((fr) => {
      try { fr.contentWindow.postMessage({ __fs: fr === f }, '*'); } catch (e) { /* ignore */ }
    });
  });

  /* ---------------- Export as standalone HTML ---------------- */
  // Produces ONE self-contained .html file (p5 + p5.sound inlined when possible)
  // that runs offline, even when double-clicked — ideal for gigs.
  async function exportSketch(code, title) {
    const usesAudio = /AUDIO_URL|AudioIn/.test(code);
    const usesSound = usesAudio || SOUND_RE.test(code);
    const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
    const safeTitle = esc(title);
    const inline = (src) => '<script>\n' + src.replace(/<\/script/gi, '<\\/script') + '\n<\/script>';
    let libs;
    try {
      const get = async (u) => { const r = await fetch(u); if (!r.ok) throw new Error(u); return r.text(); };
      libs = [inline(await get(P5_LOCAL))];
      if (usesSound) libs.push(FIX_SCRIPT, inline(await get(SOUND_LOCAL)));
    } catch (e) {
      // Opened from disk: fall back to the CDN (needs internet when the export runs).
      libs = ['<script src="' + P5_CDN + '"><\/script>'];
      if (usesSound) libs.push(FIX_SCRIPT, '<script src="' + SOUND_CDN + '"><\/script>');
    }
    const startScreen = usesAudio ? [
      '<div id="start">',
      '  <h1>' + safeTitle + '</h1>',
      '  <p>Choose a track (then click the screen to play), or use the microphone / line-in.</p>',
      '  <label class="b">Choose audio file…<input id="file" type="file" accept="audio/*" hidden></label>',
      '  <button class="b" id="live">Use mic / line-in</button>',
      '  <p class="s">Press F11 (Windows) or Ctrl+Cmd+F (Mac) for fullscreen.</p>',
      '</div>',
    ].join('\n') : '';
    const boot = usesAudio ? [
      '<script>',
      '// The sketch starts after you pick a source (browsers only allow audio after a click).',
      'window.AUDIO_URL = null;',
      'function boot(url) {',
      '  window.AUDIO_URL = url;',
      '  document.getElementById("start").remove();',
      '  var s = document.createElement("script");',
      '  s.textContent = document.getElementById("sketch").textContent;',
      '  document.body.appendChild(s);',
      '  new p5();',
      '}',
      'document.getElementById("file").onchange = function (e) { var f = e.target.files[0]; if (f) boot(URL.createObjectURL(f)); };',
      'document.getElementById("live").onclick = function () { boot(null); };',
      '<\/script>',
    ].join('\n') : '';
    const html = [
      '<!doctype html>',
      '<html lang="en">',
      '<head>',
      '<meta charset="utf-8">',
      '<meta name="viewport" content="width=device-width, initial-scale=1">',
      '<title>' + safeTitle + '</title>',
      '<style>',
      'html,body{margin:0;height:100%;background:#000;overflow:hidden;color:#eee;font-family:system-ui,sans-serif}',
      'body{display:flex;align-items:center;justify-content:center}',
      'canvas{display:block}',
      '#start{position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;background:#0b0b10;text-align:center;padding:16px}',
      '#start h1{margin:0 0 4px;font-weight:600}',
      '.b{background:#7cf6c8;color:#0b0b10;border:0;border-radius:999px;padding:12px 22px;font-size:16px;font-weight:600;cursor:pointer}',
      '.s{opacity:.6;font-size:14px}',
      '</style>',
      '<!-- Libraries: p5.js (LGPL-2.1) and p5.sound (MIT) -->',
      libs.join('\n'),
      '</head>',
      '<body>',
      startScreen,
      '<!-- ====== YOUR SKETCH ====== -->',
      '<script id="sketch"' + (usesAudio ? ' type="text/plain"' : '') + '>',
      code.replace(/<\/script/gi, '<\\/script'),
      '<\/script>',
      boot,
      '</body>',
      '</html>',
      '',
    ].join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
    a.download = (title || 'sketch').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '.html';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  /* ---------------- Boot ---------------- */
  function init() {
    if (!window.CodeMirror) { console.error('CodeMirror missing'); return; }
    buildAudioBar();
    document.querySelectorAll('.pg').forEach((el, i) => all.push(create(el, i)));
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.CCL_PLAYGROUNDS = all;
})();
