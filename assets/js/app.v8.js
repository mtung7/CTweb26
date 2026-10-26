/* =========================================================
   app.js — renders content.json into the page
   Two-layer structure:
     Layer 1 — Homepage (intro + table of contents)   #home
     Layer 2 — the four sections                       #f1 / #design / #speaking / #sports
   ========================================================= */

(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const C = () => Store.live;

  const esc = (s) => String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  const el = (html) => {
    const t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  };

  let mediaCache = {};

  /* ---------- empty photo / logo slot ----------
     The same box does two jobs depending on the mode:
       edit mode  → "＋ Add a photo / Click anywhere in this box" (upload prompt)
       browse mode→ "Photo coming soon" (neutral, nothing is clickable)
     CSS decides which of the two texts is visible. */
  function photoSlot(editAttr, editLabel, soonLabel) {
    return `<div class="sfig__slot"${editAttr}>
              <span class="sfig__slot-mark">＋</span>
              <span class="sfig__slot-text">${editLabel}</span>
              <span class="sfig__slot-hint">Click anywhere in this box</span>
              <span class="sfig__slot-soon">${soonLabel}</span>
            </div>`;
  }

  /* ---------- media resolution (handles db: tokens) ---------- */
  async function media(src) {
    if (!src) return '';
    if (mediaCache[src]) return mediaCache[src];
    const r = await Store.resolveMedia(src);
    mediaCache[src] = r;
    return r;
  }

  /* ---------- portrait video detection ----------
     Phone-shot clips are vertical. Dropping one into a 16:9 frame crops
     it to an unreadable strip, so the player switches to a portrait
     frame instead. Two signals are used:
       1. the file name says "portrait" / "vertical"
       2. the browser reports the intrinsic size once the metadata loads
     The name check is synchronous, so the frame never flashes 16:9 first. */
  const portraitVideos = new Set();
  function isPortraitVideo(src) {
    if (!src) return false;
    const s = String(src).toLowerCase();
    if (/portrait|vertical|\bvert\b/.test(s)) return true;
    return portraitVideos.has(src);
  }
  // Ask the browser for the real dimensions once the file's metadata is in.
  function watchIntrinsicSize(videoEl, src) {
    const mark = () => {
      const w = videoEl.videoWidth, h = videoEl.videoHeight;
      if (!w || !h) return;
      if (h > w) {
        portraitVideos.add(src);
        videoEl.closest('.video')?.classList.add('video--portrait');
      }
    };
    videoEl.addEventListener('loadedmetadata', mark, { once: true });
    if (videoEl.readyState >= 1) mark();
  }

  /** True when the file actually exists on disk (so we can show a slot
   *  instead of a broken image). */
  const missing = new Set();
  async function mediaExists(src) {
    if (!src) return false;
    // a file uploaded in this browser lives in IndexedDB, not on disk
    if (src.startsWith('db:')) return true;
    // inline data URIs are always present
    if (src.startsWith('data:')) return true;
    if (missing.has(src)) return false;
    try {
      // Some static servers do not implement HEAD, so ask for a single byte
      // with GET + Range instead — it is cheap and works everywhere.
      const res = await fetch(src, { headers: { Range: 'bytes=0-0' } });
      const ok = res.ok || res.status === 206;
      if (!ok) missing.add(src);
      return ok;
    } catch (e) {
      missing.add(src);
      return false;
    }
  }
  async function mediaAll(list) {
    const out = [];
    for (const item of list) {
      out.push(Object.assign({}, item, { _src: await media(item.src) }));
    }
    return out;
  }

  /* ---------- generic text binding ---------- */
  function bindText() {
    $$('[data-bind]').forEach(node => {
      const path = node.getAttribute('data-bind');
      const val = path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), C());
      if (val === undefined || val === null) return;
      const raw = node.dataset.editRaw === 'true' || node.dataset.bindRaw === 'true';
      if (raw) node.innerHTML = val;
      else node.textContent = val;
    });
  }

  /* ---------- nav ---------- */
  function renderNav() {
    const ul = $('#navLinks');
    ul.innerHTML = '';
    (C().nav?.items || []).forEach(item => {
      const li = el(`<li><a href="#${item.id}" data-nav="${item.id}">${esc(item.label)}</a></li>`);
      ul.appendChild(li);
    });
  }

  /* ---------- layer 2 section switcher ---------- */
  function renderSecbar() {
    const ul = $('#secbarList');
    ul.innerHTML = '';
    (C().contents?.items || []).forEach(item => {
      ul.appendChild(el(`<li><a href="#${item.id}" data-nav="${item.id}">${esc(item.label)}</a></li>`));
    });
  }

  /* ---------- table of contents (layer 1) ---------- */
  async function renderToc() {
    const grid = $('#tocGrid');
    grid.innerHTML = '';
    const items = C().contents?.items || [];
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const thumb = await media(it.thumb);
      const meta = (it.meta || []).map(m => `<span>${esc(m)}</span>`).join('');
      grid.appendChild(el(`
        <a class="toc" href="#${esc(it.id)}" data-toc="${esc(it.id)}">
          <span class="toc__thumb">
            <img src="${esc(thumb)}" alt="" loading="lazy" data-edit-img="contents.items.${i}.thumb" data-edit-type="image">
          </span>
          <span class="toc__body">
            <span class="toc__top">
              <span class="toc__index" data-edit="contents.items.${i}.index">${esc(it.index)}</span>
              <span class="toc__arrow" aria-hidden="true">→</span>
            </span>
            <span class="toc__label" data-edit="contents.items.${i}.label">${esc(it.label)}</span>
            <span class="toc__title" data-edit="contents.items.${i}.title">${esc(it.title)}</span>
            <span class="toc__blurb" data-edit="contents.items.${i}.blurb">${esc(it.blurb)}</span>
            <span class="toc__meta">${meta}</span>
          </span>
        </a>`));
    }
  }

  /* ---------- hero ---------- */
  function renderHero() {
    const c = C();
    if (!c.hero) return;
    const primary = c.hero.ctaPrimary || { label: 'Browse', target: '#contents' };
    const secondary = c.hero.ctaSecondary || { label: 'Résumé', target: '#' };
    $('#ctaPrimary').textContent = primary.label;
    $('#ctaPrimary').href = primary.target;
    const sec = $('#ctaSecondary');
    sec.textContent = secondary.label;
    sec.href = secondary.target;
    sec.setAttribute('download', '');
    // The résumé PDF may not have been published yet. Probing for it on
    // every page load would fire a 404 request each time, so the check
    // happens on click instead: if the file is missing the visitor gets a
    // short note rather than a broken download.
    sec.addEventListener('click', (e) => {
      const href = String(secondary.target || '');
      if (!href || href.charAt(0) === '#') return;
      e.preventDefault();
      fetch(href, { method: 'HEAD' })
        .then(res => {
          if (!res.ok) throw new Error('missing');
          // the file exists — let the browser download it
          const a = document.createElement('a');
          a.href = href;
          a.download = '';
          document.body.appendChild(a);
          a.click();
          a.remove();
        })
        .catch(() => {
          const msg = 'Résumé is not published yet — drop resume.pdf into assets/data/ and reload.';
          if (window.Editor && typeof window.Editor.toast === 'function') window.Editor.toast(msg);
          else window.alert(msg);
        });
    });

    const facts = $('#heroFacts');
    facts.innerHTML = '';
    (c.hero.facts || []).forEach((f, i) => {
      facts.appendChild(el(`
        <div class="hero__fact">
          <dt data-edit="hero.facts.${i}.label">${esc(f.label)}</dt>
          <dd data-edit="hero.facts.${i}.value">${esc(f.value)}${f.suffix ? `<span>${esc(f.suffix)}</span>` : ''}</dd>
        </div>`));
    });

    const portrait = $('#portrait');
    portrait.alt = c.profile.imageAlt || '';
    portrait.dataset.editImg = 'profile.image';
    portrait.dataset.editType = 'image';
    // resolve db: references to a real object URL before assigning
    media(c.profile.image).then(url => { portrait.src = url; });
  }

  /* ---------- F1 intro + stats ---------- */
  function renderF1() {
    const c = C().f1;
    const body = $('#f1Intro');
    body.innerHTML = '';
    (c.intro || []).forEach((p, i) => body.appendChild(el(`<p data-edit="f1.intro.${i}" data-edit-raw="true">${p}</p>`)));

    const stats = $('#f1Stats');
    stats.innerHTML = '';
    (c.stats || []).forEach((s, i) => {
      stats.appendChild(el(`
        <div class="stat">
          <p class="stat__num" data-edit="f1.stats.${i}.num">${esc(s.num)}</p>
          <p class="stat__label" data-edit="f1.stats.${i}.label">${esc(s.label)}</p>
          <p class="stat__desc" data-edit="f1.stats.${i}.desc">${esc(s.desc)}</p>
        </div>`));
    });
  }

  /* ---------- documents panel (download / preview list) ---------- */
  async function renderDocBox() {
    const box = $('#docBox');
    box.innerHTML = '';
    const items = C().f1?.portfolios?.items || [];
    if (!items.length) { box.style.display = 'none'; return; }

    box.appendChild(el(`
      <div class="docbox__head">
        <div>
          <p class="docbox__title">Documents — read online or download</p>
          <p class="docbox__note">Official F1 in Schools World Finalist portfolios · PDF</p>
        </div>
        <nav class="docjump" aria-label="Jump to a document">
          ${items.map((it, i) => {
            const short = (it.title || '').replace(/\s+Portfolio$/, '').trim();
            return `<button class="docjump__chip" data-doc-jump="${i}">${String(i + 1).padStart(2, '0')} ${esc(short)}</button>`;
          }).join('')}
        </nav>
      </div>`));

    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const file = it.file || '';
      const isBlob = file.startsWith('db:');
      const href = isBlob ? '' : file;
      const pages = it.pageImages || [];

      // The preview sits under the title and needs no click:
      //   · pageImages[]  → the document rendered as a stack of page pictures
      //                     (works in every browser, generated by pdf-pages.js)
      //   · otherwise      → the PDF itself inline (covers files uploaded in
      //                     the browser, which have no rendered pages yet)
      const preview = pages.length
        ? `<div class="pdfpages">
             ${pages.map((src, pi) => `
               <figure class="pdfpage">
                 <img src="${esc(src)}" alt="${esc(it.title)} — page ${pi + 1} of ${pages.length}" loading="lazy" decoding="async">
                 <span class="pdfpage__badge">${String(pi + 1).padStart(2, '0')} / ${String(pages.length).padStart(2, '0')}</span>
               </figure>`).join('')}
           </div>`
        : file
          ? `<iframe class="docrow__frame" title="${esc(it.title)} — preview" loading="lazy"${isBlob ? '' : ` src="${esc(href)}"`}></iframe>`
          : `<div class="docrow__nofile">This document has not been added yet — drop the PDF into <strong>assets/pdf/</strong> or use <strong>Replace file</strong> below.</div>`;

      const row = el(`
        <div class="docrow" data-doc-idx="${i}">
          <span class="docrow__idx">${String(i + 1).padStart(2, '0')}</span>
          <div class="docrow__main">
            <p class="docrow__name" data-edit="f1.portfolios.items.${i}.title">${esc(it.title)}</p>
            <p class="docrow__meta">
              <span>${esc(it.pages || '—')} pages</span>
              <span>${esc(it.size || '')}</span>
              <span>${esc(it.author || '')}</span>
              ${it.owner ? '<span style="color:var(--signal)">My section</span>' : ''}
            </p>
            <div class="docrow__preview">${preview}</div>
          </div>
          <div class="docrow__actions">
            <button class="btn btn--sm" data-pdf-preview="${i}">Preview</button>
            <a class="btn btn--sm btn--solid" data-pdf-download="${i}" href="${esc(href)}" download="${esc(it.download || 'document.pdf')}">Download</a>
          </div>
        </div>`);
      box.appendChild(row);

      // A file uploaded in this browser has no real path — resolve it to an
      // object URL so the Download button and the inline preview still work.
      if (isBlob) {
        const url = await Store.resolveMedia(file);
        const link = row.querySelector('[data-pdf-download]');
        if (link && url) link.href = url;
        const frame = row.querySelector('.docrow__frame');
        if (frame && url) frame.src = url;
      }
    }
  }

  /* ---------- gallery ---------- */
  let galleryItems = [];
  async function renderGallery() {
    const grid = $('#galleryGrid');
    grid.innerHTML = '';
    galleryItems = await mediaAll(C().f1?.gallery?.items || []);
    galleryItems.forEach((it, i) => {
      const fig = el(`
        <figure class="gfig ${it.tall ? 'gfig--tall' : ''}" data-gi="${i}">
          <button class="gfig__frame" type="button" aria-label="View larger">
            <img src="${esc(it._src)}" alt="${esc(it.caption)}" loading="lazy" data-edit-img="f1.gallery.items.${i}.src" data-edit-type="image">
            <span class="gfig__idx">${String(i + 1).padStart(2, '0')}</span>
            <span class="gfig__zoom" aria-hidden="true">⤢</span>
          </button>
          <figcaption class="gfig__cap">
            <span class="gfig__text" data-edit="f1.gallery.items.${i}.caption">${esc(it.caption)}</span>
            <span class="gfig__meta" data-edit="f1.gallery.items.${i}.meta">${esc(it.meta || '')}</span>
          </figcaption>
        </figure>`);
      grid.appendChild(fig);
    });
  }

  /* ---------- portfolios ---------- */
  async function renderPortfolios() {
    const grid = $('#portfolioGrid');
    grid.innerHTML = '';
    const items = C().f1?.portfolios?.items || [];
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const cover = await media(it.cover);
      const file = it.file || '';
      const isBlob = file.startsWith('db:');
      const href = isBlob ? '' : file;
      const card = el(`
        <article class="pcard">
          <div class="pcard__cover">
            <img src="${esc(cover)}" alt="${esc(it.title)}" loading="lazy" data-edit-img="f1.portfolios.items.${i}.cover" data-edit-type="image">
            <span class="pcard__tag" data-edit="f1.portfolios.items.${i}.tag">${esc(it.tag || '')}</span>
          </div>
          <div class="pcard__body">
            <h3 class="pcard__title" data-edit="f1.portfolios.items.${i}.title">${esc(it.title)}</h3>
            <p class="pcard__desc" data-edit="f1.portfolios.items.${i}.desc">${esc(it.desc)}</p>
            <div class="pcard__meta">
              <span>${esc(it.pages || '—')} pages</span>
              <span>${esc(it.size || '')}</span>
              <span>${esc(it.author || '')}</span>
              ${it.owner ? '<span style="color:var(--signal)">My work</span>' : ''}
            </div>
            <div class="pcard__actions">
              <button class="btn btn--sm" data-pdf-preview="${i}">Preview</button>
              <a class="btn btn--sm btn--solid" data-pdf-download="${i}" href="${esc(href)}" download="${esc(it.download || 'document.pdf')}">Download</a>
              <button class="btn btn--sm" data-upload-pdf="${i}">Replace file</button>
            </div>
          </div>
        </article>`);
      grid.appendChild(card);

      // resolve blob-backed files so Download still works
      if (isBlob) {
        const url = await Store.resolveMedia(file);
        const link = card.querySelector('[data-pdf-download]');
        if (link && url) link.href = url;
      }
    }
  }

  /* ---------- timeline ---------- */
  function renderTimeline() {
    const list = $('#timelineList');
    list.innerHTML = '';
    (C().f1?.timeline?.items || []).forEach((it, i) => {
      const tags = (it.tags || []).map((t, ti) =>
        `<span class="tag ${ti === 0 ? 'tag--accent' : ''}">${esc(t)}</span>`).join('');
      list.appendChild(el(`
        <div class="tl__item reveal">
          <div class="tl__year" data-edit="f1.timeline.items.${i}.year">${esc(it.year)}</div>
          <span class="tl__dot"></span>
          <div class="tl__body">
            <p class="tl__label" data-edit="f1.timeline.items.${i}.label">${esc(it.label || '')}</p>
            <h3 class="tl__title" data-edit="f1.timeline.items.${i}.title">${esc(it.title)}</h3>
            <p class="tl__text" data-edit="f1.timeline.items.${i}.text">${esc(it.text)}</p>
            <div class="tl__tags">${tags}</div>
          </div>
        </div>`));
    });
  }

  /* ---------- design ---------- */
  async function renderDesign() {
    const box = $('#designList');
    box.innerHTML = '';
    const items = C().design?.items || [];
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const src = await media(it.media);
      const rev = i % 2 === 1;
      const points = (it.points || []).map((p, pi) =>
        `<li><span class="dlist__mark">→</span><span data-edit="design.items.${i}.points.${pi}">${esc(p)}</span></li>`).join('');
      const block = el(`
        <div class="dsplit ${rev ? 'dsplit--rev' : ''}" style="margin-bottom:clamp(40px,5vw,76px)">
          <figure class="dsplit__media" style="margin:0">
            <img src="${esc(src)}" alt="${esc(it.title)}" loading="lazy" data-edit-img="design.items.${i}.media" data-edit-type="image">
            <figcaption data-edit="design.items.${i}.caption">${esc(it.caption || '')}</figcaption>
          </figure>
          <div>
            <p class="card__eyebrow" data-edit="design.items.${i}.eyebrow">${esc(it.eyebrow || '')}</p>
            <h3 style="font-family:var(--serif);font-size:clamp(22px,2.6vw,30px);font-weight:500;line-height:1.22;margin:0 0 14px;letter-spacing:-.015em" data-edit="design.items.${i}.title">${esc(it.title)}</h3>
            <p style="font-size:14.5px;line-height:1.72;color:var(--ink-3);margin:0 0 22px" data-edit="design.items.${i}.desc">${esc(it.desc)}</p>
            <ul class="dlist">${points}</ul>
          </div>
        </div>`);
      box.appendChild(block);
    }
  }

  /* ---------- speaking ---------- */
  async function renderSpeaking() {
    const c = C().speaking;
    const v = c.video || {};
    const box = $('#videoBox');
    box.innerHTML = '';

    const ext = (v.externalUrl || '').trim();
    const local = (v.src || '').trim();

    if (ext) {
      const yt = /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{11})/.exec(ext);
      const vm = /vimeo\.com\/(\d+)/.exec(ext);
      if (yt) {
        box.appendChild(el(`<iframe src="https://www.youtube.com/embed/${yt[1]}" title="${esc(v.title || '')}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`));
      } else if (vm) {
        box.appendChild(el(`<iframe src="https://player.vimeo.com/video/${vm[1]}" title="${esc(v.title || '')}" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>`));
      } else {
        box.appendChild(el(`<iframe src="${esc(ext)}" title="${esc(v.title || '')}" allow="autoplay; fullscreen" allowfullscreen></iframe>`));
      }
    } else if (local) {
      const src = await media(local);
      // Portrait clips (phone-shot) need a portrait frame — forcing them
      // into a 16:9 box crops them into an unreadable strip.
      const portrait = isPortraitVideo(local);
      box.classList.toggle('video--portrait', portrait);
      const video = el(`<video controls playsinline preload="metadata" ${v.poster ? `poster="${esc(await media(v.poster))}"` : ''}><source src="${esc(src)}" type="video/mp4">Your browser does not support the video tag.</video>`);
      watchIntrinsicSize(video, local);
      box.appendChild(video);
      // Title + note strip underneath the player.
      const oldCap = box.parentElement.querySelector('.video-caption');
      if (oldCap) oldCap.remove();
      if (v.title || v.hint) {
        const cap = el(`
          <div class="video-caption">
            ${v.title ? `<h3 class="video-caption__title" data-edit="speaking.video.title">${esc(v.title)}</h3>` : ''}
            ${v.hint ? `<p class="video-caption__hint" data-edit="speaking.video.hint">${esc(v.hint)}</p>` : ''}
          </div>`);
        box.parentElement.insertBefore(cap, box.nextSibling);
      }
    } else {
      box.classList.remove('video--portrait');
      const oldCap0 = box.parentElement.querySelector('.video-caption');
      if (oldCap0) oldCap0.remove();
      const poster = v.poster ? await media(v.poster) : '';
      box.appendChild(el(`
        <div class="video__placeholder">
          ${poster ? `<img src="${esc(poster)}" alt="" data-edit-img="speaking.video.poster" data-edit-type="image">` : ''}
          <div class="video__inner">
            <div class="video__play" data-video-slot>▶</div>
            <p class="video__label">Video slot</p>
            <h3 class="video__title" data-edit="speaking.video.title">${esc(v.title || '')}</h3>
            <p class="video__hint" data-edit="speaking.video.hint">${esc(v.hint || '')}</p>
          </div>
        </div>`));
    }

    const meta = $('#videoMeta');
    meta.innerHTML = '';
    (v.meta || []).forEach(m => {
      meta.appendChild(el(`
        <div>
          <dt>${esc(m.label)}</dt>
          <dd>${esc(m.value)}</dd>
        </div>`));
    });

    const grid = $('#speakingCards');
    grid.innerHTML = '';
    const cards = c.cards || [];
    for (let i = 0; i < cards.length; i++) {
      const it = cards[i];
      const images = it.images || (it.image ? [{ src: it.image, caption: it.title, meta: '' }] : []);

      const figs = [];
      for (let j = 0; j < images.length; j++) {
        const im = images[j];
        const has = im.src && await mediaExists(im.src);
        const src = has ? await media(im.src) : '';
        const editAttr = ` data-edit-img="speaking.cards.${i}.images.${j}.src" data-edit-type="image"`;
        figs.push(`
          <figure class="sfig">
            <div class="sfig__frame">
              ${src
                ? `<img src="${esc(src)}" alt="${esc(im.caption || '')}" loading="lazy"${editAttr}>`
                : photoSlot(editAttr, 'Add a photo', 'Photo coming soon')}
            </div>
            <figcaption class="sfig__cap">
              <span class="sfig__text" data-edit="speaking.cards.${i}.images.${j}.caption">${esc(im.caption || '')}</span>
              <span class="sfig__meta" data-edit="speaking.cards.${i}.images.${j}.meta">${esc(im.meta || '')}</span>
            </figcaption>
          </figure>`);
      }

      grid.appendChild(el(`
        <article class="card card--stack" data-speak-idx="${i}" data-list-path="speaking.cards">
          <div class="card__photos">${figs.join('')}</div>
          <div class="card__body">
            <p class="card__eyebrow" data-edit="speaking.cards.${i}.eyebrow">${esc(it.eyebrow || '')}</p>
            <h3 class="card__title" data-edit="speaking.cards.${i}.title">${esc(it.title)}</h3>
            <p class="card__text" data-edit="speaking.cards.${i}.text">${esc(it.text)}</p>
            <div class="card__foot">
              <span data-edit="speaking.cards.${i}.foot">${esc(it.foot || '')}</span>
              ${it.result ? `<span class="result" data-edit="speaking.cards.${i}.result">★ ${esc(it.result)}</span>` : ''}
            </div>
          </div>
        </article>`));
    }
  }

  /* ---------- sports ---------- */
  async function renderSports() {
    const c = C().sports;
    const grid = $('#sportsCards');
    grid.innerHTML = '';
    const cards = c.cards || [];

    for (let i = 0; i < cards.length; i++) {
      const it = cards[i];
      const images = it.images || (it.image ? [{ src: it.image, caption: it.title, meta: '' }] : []);
      const rev = i % 2 === 1;

      // build the photo strip
      const figs = [];
      for (let j = 0; j < images.length; j++) {
        const im = images[j];
        const has = im.src && await mediaExists(im.src);
        const src = has ? await media(im.src) : '';
        // the slot is clickable even when empty, so a photo can be added
        const editAttr = ` data-edit-img="sports.cards.${i}.images.${j}.src" data-edit-type="image"`;
        figs.push(`
          <figure class="sfig">
            <div class="sfig__frame">
              ${src
                ? `<img src="${esc(src)}" alt="${esc(im.caption || '')}" loading="lazy"${editAttr}>`
                : photoSlot(editAttr, 'Add a photo', 'Photo coming soon')}
            </div>
            <figcaption class="sfig__cap">
              <span class="sfig__text" data-edit="sports.cards.${i}.images.${j}.caption">${esc(im.caption || '')}</span>
              <span class="sfig__meta" data-edit="sports.cards.${i}.images.${j}.meta">${esc(im.meta || '')}</span>
            </figcaption>
          </figure>`);
      }

      const block = el(`
        <article class="sport ${rev ? 'sport--rev' : ''}" data-sport-idx="${i}" data-list-path="sports.cards">
          <div class="sport__body">
            <p class="card__eyebrow" data-edit="sports.cards.${i}.eyebrow">${esc(it.eyebrow || '')}</p>
            <h3 class="sport__title" data-edit="sports.cards.${i}.title">${esc(it.title)}</h3>
            <p class="sport__text" data-edit="sports.cards.${i}.text">${esc(it.text)}</p>
            <div class="sport__foot">
              <span data-edit="sports.cards.${i}.foot">${esc(it.foot || '')}</span>
              ${it.result ? `<span class="result" data-edit="sports.cards.${i}.result">★ ${esc(it.result)}</span>` : ''}
            </div>
          </div>
          <div class="sport__photos">${figs.join('')}</div>
        </article>`);
      grid.appendChild(block);
    }

    const pts = $('#sportsPoints');
    pts.innerHTML = '';
    (c.philosophy?.points || []).forEach((p, i) => {
      pts.appendChild(el(`<li><span class="dlist__mark">→</span><span data-edit="sports.philosophy.points.${i}">${esc(p)}</span></li>`));
    });
  }

  /* ---------- hobbies ---------- */
  async function renderHobbies() {
    const c = C().hobbies;
    const grid = $('#hobbiesCards');
    if (!grid) return;
    grid.innerHTML = '';
    const cards = c.cards || [];

    for (let i = 0; i < cards.length; i++) {
      const it = cards[i];
      const images = it.images || (it.image ? [{ src: it.image, caption: it.title, meta: '' }] : []);
      const rev = i % 2 === 1;

      const figs = [];
      for (let j = 0; j < images.length; j++) {
        const im = images[j];
        const has = im.src && await mediaExists(im.src);
        const src = has ? await media(im.src) : '';
        const editAttr = ` data-edit-img="hobbies.cards.${i}.images.${j}.src" data-edit-type="image"`;
        figs.push(`
          <figure class="sfig">
            <div class="sfig__frame">
              ${src
                ? `<img src="${esc(src)}" alt="${esc(im.caption || '')}" loading="lazy"${editAttr}>`
                : photoSlot(editAttr, 'Add a photo', 'Photo coming soon')}
            </div>
            <figcaption class="sfig__cap">
              <span class="sfig__text" data-edit="hobbies.cards.${i}.images.${j}.caption">${esc(im.caption || '')}</span>
              <span class="sfig__meta" data-edit="hobbies.cards.${i}.images.${j}.meta">${esc(im.meta || '')}</span>
            </figcaption>
          </figure>`);
      }

      grid.appendChild(el(`
        <article class="sport ${rev ? 'sport--rev' : ''}" data-hobby-idx="${i}" data-list-path="hobbies.cards">
          <div class="sport__body">
            <p class="card__eyebrow" data-edit="hobbies.cards.${i}.eyebrow">${esc(it.eyebrow || '')}</p>
            <h3 class="sport__title" data-edit="hobbies.cards.${i}.title">${esc(it.title)}</h3>
            <p class="sport__text" data-edit="hobbies.cards.${i}.text">${esc(it.text || '')}</p>
            <div class="sport__foot">
              <span data-edit="hobbies.cards.${i}.foot">${esc(it.foot || '')}</span>
              ${it.result ? `<span class="result" data-edit="hobbies.cards.${i}.result">★ ${esc(it.result)}</span>` : ''}
            </div>
          </div>
          <div class="sport__photos">${figs.join('')}</div>
        </article>`));
    }
  }

  /* ---------- ngo ---------- */
  async function renderNgo() {
    const c = C().ngo;
    const list = $('#ngoList');
    if (!list) return;
    list.innerHTML = '';
    const projects = c.projects || [];

    for (let i = 0; i < projects.length; i++) {
      const it = projects[i];
      const images = it.images || [];

      // logo column
      const hasLogo = it.logo && await mediaExists(it.logo);
      const logoSrc = hasLogo ? await media(it.logo) : '';
      const logoEdit = ` data-edit-img="ngo.projects.${i}.logo" data-edit-type="image"`;
      const logoBlock = `
        <figure class="ngo__logo">
          <div class="ngo__logo-frame">
            ${logoSrc
              ? `<img src="${esc(logoSrc)}" alt="${esc(it.logoAlt || 'Project logo')}"${logoEdit}>`
              : photoSlot(logoEdit, 'Project logo', 'Logo coming soon')}
          </div>
          <figcaption class="ngo__org" data-edit="ngo.projects.${i}.organisation">${esc(it.organisation || '')}</figcaption>
        </figure>`;

      // me column
      const meBlock = `
        <div class="ngo__me">
          <p class="card__eyebrow" data-edit="ngo.projects.${i}.role">${esc(it.role || '')}</p>
          <h3 class="ngo__name" data-edit="ngo.projects.${i}.name">${esc(it.name)}</h3>
          <p class="ngo__text" data-edit="ngo.projects.${i}.text">${esc(it.text || '')}</p>
          <div class="ngo__focus">
            <span class="ngo__focus-label" data-edit="ngo.projects.${i}.focus">${esc(it.focus || '')}</span>
            <span class="ngo__focus-text" data-edit="ngo.projects.${i}.focusText">${esc(it.focusText || '')}</span>
          </div>
        </div>`;

      // photos column
      const figs = [];
      for (let j = 0; j < images.length; j++) {
        const im = images[j];
        const has = im.src && await mediaExists(im.src);
        const src = has ? await media(im.src) : '';
        const editAttr = ` data-edit-img="ngo.projects.${i}.images.${j}.src" data-edit-type="image"`;
        figs.push(`
          <figure class="sfig">
            <div class="sfig__frame">
              ${src
                ? `<img src="${esc(src)}" alt="${esc(im.caption || '')}" loading="lazy"${editAttr}>`
                : photoSlot(editAttr, 'Add a photo', 'Photo coming soon')}
            </div>
            <figcaption class="sfig__cap">
              <span class="sfig__text" data-edit="ngo.projects.${i}.images.${j}.caption">${esc(im.caption || '')}</span>
              <span class="sfig__meta" data-edit="ngo.projects.${i}.images.${j}.meta">${esc(im.meta || '')}</span>
            </figcaption>
          </figure>`);
      }
      const photosBlock = `<div class="ngo__photos">${figs.join('')}</div>`;

      list.appendChild(el(`
        <article class="ngo" data-ngo-idx="${i}" data-list-path="ngo.projects">
          <div class="ngo__col ngo__col--logo">${logoBlock}</div>
          <div class="ngo__col ngo__col--me">${meBlock}</div>
          <div class="ngo__col ngo__col--photos">${photosBlock}</div>
        </article>`));
    }
  }

  /* ---------- closing + footer ---------- */
  function renderFooter() {
    const c = C();
    $('#closingCta').textContent = c.closing.ctaPrimary.label;
    $('#closingCta').href = c.closing.ctaPrimary.target;

    const fl = $('#footerLinks');
    fl.innerHTML = '';
    (c.footer.links || []).forEach(l => {
      fl.appendChild(el(`<li><a href="${esc(l.href)}">${esc(l.label)}</a></li>`));
    });

    const fc = $('#footerContact');
    fc.innerHTML = '';
    (c.footer.contact || []).forEach(l => {
      fc.appendChild(el(`<li><a href="${esc(l.href)}">${esc(l.value || l.label)}</a></li>`));
    });
  }

  /* =========================================================
     PDF preview
     ========================================================= */
  function openPdf(index) {
    const items = C().f1?.portfolios?.items || [];
    const it = items[index];
    if (!it || !it.file) return;
    const src = it.file;
    const isBlob = src.startsWith('db:');
    $('#pdfViewTitle').textContent = it.title || 'Document';
    $('#pdfViewDownload').href = isBlob ? '' : src;
    $('#pdfViewDownload').setAttribute('download', it.download || 'document.pdf');
    $('#pdfViewOpen').href = isBlob ? '' : src;

    const body = $('#pdfViewBody');
    body.innerHTML = '';

    const frame = el(`<iframe src="${isBlob ? '' : esc(src)}#view=FitH" title="${esc(it.title || '')}"></iframe>`);
    body.appendChild(frame);

    if (isBlob) {
      Store.resolveMedia(src).then(url => {
        frame.src = url + '#view=FitH';
        $('#pdfViewDownload').href = url;
        $('#pdfViewOpen').href = url;
      });
    }

    // If the browser cannot display the PDF inline, fall back to a clear
    // message with direct download / open links.
    let loaded = false;
    frame.addEventListener('load', () => { loaded = true; });
    setTimeout(() => {
      if (!loaded) showPdfFallback(body, it);
    }, 2500);

    $('#pdfView').classList.add('is-open');
    document.body.style.overflow = 'hidden';
  }

  function showPdfFallback(body, it) {
    const note = el(`
      <div class="pdfview__fallback">
        <div>
          <p style="font-family:var(--serif);font-size:22px;color:#fff;margin:0 0 10px">${esc(it.title || 'Document')}</p>
          <p style="margin:0 0 22px">This browser will not display the PDF inline.<br>Open it in a new tab or download it instead.</p>
          <div style="display:flex;gap:10px;justify-content:center">
            <a class="btn btn--sm" href="${esc(it.file)}" target="_blank" rel="noopener">Open in new tab</a>
            <a class="btn btn--sm btn--solid" href="${esc(it.file)}" download="${esc(it.download || 'document.pdf')}">Download</a>
          </div>
        </div>
      </div>`);
    body.appendChild(note);
  }

  function closePdf() {
    $('#pdfView').classList.remove('is-open');
    $('#pdfViewBody').innerHTML = '';
    document.body.style.overflow = '';
  }

  /* ---------- lightbox ---------- */
  let lbIndex = 0;
  function openLightbox(i) {
    lbIndex = i;
    paintLightbox();
    $('#lightbox').classList.add('is-open');
    document.body.style.overflow = 'hidden';
  }
  function paintLightbox() {
    const it = galleryItems[lbIndex];
    if (!it) return;
    $('#lbImg').src = it._src;
    $('#lbCap').textContent = it.caption || '';
    $('#lbMeta').textContent = `${it.meta || ''} · ${lbIndex + 1} / ${galleryItems.length}`;
  }
  function closeLightbox() {
    $('#lightbox').classList.remove('is-open');
    document.body.style.overflow = '';
  }
  function stepLightbox(d) {
    if (!galleryItems.length) return;
    lbIndex = (lbIndex + d + galleryItems.length) % galleryItems.length;
    paintLightbox();
  }

  /* ---------- reveal ---------- */
  function observeReveals() {
    const els = $$('.reveal');
    if (!('IntersectionObserver' in window)) {
      els.forEach(e => e.classList.add('is-in'));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach(en => {
        if (en.isIntersecting) {
          en.target.classList.add('is-in');
          io.unobserve(en.target);
        }
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });
    els.forEach(e => io.observe(e));
  }

  /* =========================================================
     TWO-LAYER ROUTER
     Layer 1: #home / #contents  (homepage)
     Layer 2: #f1 / #design / #speaking / #sports  (sections)
     ========================================================= */
  const SECTION_IDS = ['f1', 'design', 'speaking', 'sports', 'hobbies', 'ngo'];

  function currentRoute() {
    const raw = (location.hash || '').replace(/^#/, '');
    if (!raw) return { layer: 'home', id: 'home' };
    if (raw.startsWith('f1-')) return { layer: 'section', id: 'f1', sub: raw.split('-')[1] };
    if (SECTION_IDS.includes(raw)) return { layer: 'section', id: raw };
    if (raw === 'contents') return { layer: 'home', id: 'contents' };
    if (raw === 'contact') return { layer: 'section', id: 'contact' };
    return { layer: 'home', id: 'home' };
  }

  function applyRoute() {
    const r = currentRoute();
    const body = document.body;

    if (r.layer === 'section') {
      body.classList.add('layer-body-on');
      body.classList.remove('layer-home');
      // scroll the target section into view
      requestAnimationFrame(() => {
        const target = document.getElementById(r.id);
        if (target) {
          const y = target.getBoundingClientRect().top + window.scrollY - 128;
          window.scrollTo({ top: Math.max(0, y), behavior: 'instant' });
        }
      });
    } else {
      body.classList.remove('layer-body-on');
      body.classList.add('layer-home');
      if (r.id === 'contents') {
        requestAnimationFrame(() => {
          const target = document.getElementById('contents');
          if (target) {
            const y = target.getBoundingClientRect().top + window.scrollY - 90;
            window.scrollTo({ top: Math.max(0, y), behavior: 'instant' });
          }
        });
      } else {
        window.scrollTo({ top: 0, behavior: 'instant' });
      }
    }

    // active state in switcher
    $$('#secbarList a').forEach(a => {
      a.classList.toggle('is-active', a.dataset.nav === r.id);
    });

    // F1 sub-panel
    if (r.id === 'f1' && r.sub) {
      const btn = $$('.subnav__btn').find(b => b.dataset.panel === r.sub);
      if (btn) btn.click();
    }
  }

  /* ---------- subnav ---------- */
  function initSubnav() {
    const btns = $$('.subnav__btn');
    btns.forEach(btn => {
      btn.addEventListener('click', () => {
        btns.forEach(b => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        $$('.subpanel').forEach(p => p.classList.remove('is-active'));
        const panel = document.getElementById('panel-' + btn.dataset.panel);
        if (panel) panel.classList.add('is-active');
        history.replaceState(null, '', '#f1-' + btn.dataset.panel);
        observeReveals();
      });
    });
  }

  /* ---------- scroll spy ---------- */
  function initScrollSpy() {
    const links = $$('#navLinks a, #secbarList a');
    const onScroll = () => {
      $('#nav').classList.toggle('is-stuck', window.scrollY > 10);
      if (!document.body.classList.contains('layer-body-on')) return;
      let current = '';
      const y = window.scrollY + 200;
      for (const id of SECTION_IDS) {
        const s = document.getElementById(id);
        if (s && s.offsetTop <= y) current = id;
      }
      links.forEach(a => a.classList.toggle('is-active', a.dataset.nav === current));
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ---------- full render ---------- */
  async function renderAll() {
    mediaCache = {};
    bindText();
    renderNav();
    renderSecbar();
    await renderToc();
    renderHero();
    renderF1();
    await renderDocBox();
    await renderGallery();
    await renderPortfolios();
    renderTimeline();
    await renderDesign();
    await renderSpeaking();
    await renderSports();
    await renderHobbies();
    await renderNgo();
    renderFooter();
    observeReveals();
    applyRoute();
    if (window.Editor) window.Editor.rebind();
  }

  /* ---------- global events ---------- */
  function initEvents() {
    $('#lbClose').addEventListener('click', closeLightbox);
    $('#lbPrev').addEventListener('click', () => stepLightbox(-1));
    $('#lbNext').addEventListener('click', () => stepLightbox(1));
    $('#lightbox').addEventListener('click', (e) => {
      if (e.target.id === 'lightbox') closeLightbox();
    });
    $('#pdfViewClose').addEventListener('click', closePdf);
    $('#pdfView').addEventListener('click', (e) => {
      if (e.target.id === 'pdfView') closePdf();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { closeLightbox(); closePdf(); }
      if ($('#lightbox').classList.contains('is-open')) {
        if (e.key === 'ArrowLeft') stepLightbox(-1);
        if (e.key === 'ArrowRight') stepLightbox(1);
      }
    });

    $('#galleryGrid').addEventListener('click', (e) => {
      const fig = e.target.closest('.gfig');
      if (!fig) return;
      if (e.target.closest('[contenteditable="true"]')) return;
      openLightbox(Number(fig.dataset.gi));
    });

    // PDF preview buttons (both in docbox and portfolio cards)
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-pdf-preview]');
      if (!btn) return;
      e.preventDefault();
      openPdf(Number(btn.dataset.pdfPreview));
    });

    // jump chips inside the documents panel
    document.addEventListener('click', (e) => {
      const chip = e.target.closest('[data-doc-jump]');
      if (!chip) return;
      const row = document.querySelector(`.docrow[data-doc-idx="${chip.dataset.docJump}"]`);
      if (!row) return;
      const y = row.getBoundingClientRect().top + window.scrollY - 150;
      window.scrollTo({ top: Math.max(0, y), behavior: 'instant' });
    });

    // hash routing
    window.addEventListener('hashchange', applyRoute);
  }

  document.addEventListener('DOMContentLoaded', async () => {
    // Switch the visible layer straight away. The full render below resolves
    // 64 PDF pages and probes every image, which takes several seconds — a
    // deep link such as #f1 must not sit on the home layer until then.
    // renderAll() calls applyRoute() again once the content is in place,
    // which is what finally lands the scroll on the right section.
    applyRoute();
    await Store.load();
    renderAll();
    initEvents();
    initSubnav();
    initScrollSpy();
  });

  window.App = { renderAll, openLightbox, closeLightbox, openPdf, closePdf, media, esc, el, applyRoute };
})();
