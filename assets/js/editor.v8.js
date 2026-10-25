/* =========================================================
   editor.js — in-browser editing + media upload
   Toggle with the "Edit" button or press E.
   Changes persist in localStorage; media blobs in IndexedDB.
   Export/Import JSON lets you move edits between machines.
   ========================================================= */

(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const C = () => Store.live;

  let active = false;
  let editing = false;      // true while a text field has focus (avoid re-render)
  let pendingUpload = null; // {path, kind}

  /* ---------- toast ---------- */
  let toastTimer;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('is-visible'), 3200);
  }

  /* ---------- path helpers ---------- */
  function getPath(obj, path) {
    return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
  }
  function setPath(obj, path, value) {
    const keys = path.split('.');
    let cur = obj;
    for (let i = 0; i < keys.length - 1; i++) {
      if (cur[keys[i]] === undefined || cur[keys[i]] === null) cur[keys[i]] = {};
      cur = cur[keys[i]];
    }
    cur[keys[keys.length - 1]] = value;
  }

  /* ---------- inline editable fields ---------- */
  // Every editable region carries an explicit `data-edit="path.to.value"` attribute.
  // Array elements use numeric segments, e.g. f1.gallery.items.0.caption
  // A trailing ".raw" segment means the value contains HTML and should be written as innerHTML.

  function applyEditables() {
    if (!active) {
      $$('[contenteditable]').forEach(n => n.removeAttribute('contenteditable'));
      $$('[data-edit]').forEach(n => n.removeAttribute('data-edit-active'));
      return;
    }
    $$('[data-edit]').forEach(node => {
      const raw = node.dataset.editRaw === 'true';
      node.setAttribute('contenteditable', 'true');
      node.dataset.editable = '1';
      node.dataset.editPath = node.dataset.edit;
      node.dataset.editIsRaw = raw ? '1' : '';
      if (raw) {
        node.innerHTML = getPath(C(), node.dataset.edit) ?? '';
      }
    });
  }

  function commitEditable(node) {
    const path = node.dataset.editPath;
    if (!path) return;
    const value = node.dataset.editIsRaw === '1'
      ? node.innerHTML.trim()
      : node.textContent.trim();
    setPath(C(), path, value);
    Store.save();
  }

  /* ---------- media upload ---------- */
  function pickFile(accept, cb) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.addEventListener('change', () => {
      if (input.files && input.files[0]) cb(input.files[0]);
    });
    input.click();
  }

  async function handleImageUpload(path, file) {
    const key = 'img:' + path + ':' + Date.now();
    const ok = await Store.idbPut(key, file);
    if (!ok) { toast('Could not store that file.'); return; }
    setPath(C(), path, 'db:' + key);
    Store.save();
    toast('Image updated');
    App.renderAll();
  }

  async function handlePdfUpload(index, file) {
    const key = 'pdf:' + index + ':' + Date.now();
    const ok = await Store.idbPut(key, file);
    if (!ok) { toast('Could not store that file.'); return; }
    const items = C().f1.portfolios.items;
    if (items[index]) {
      items[index].file = 'db:' + key;
      items[index]._localName = file.name;
      Store.save();
      toast('PDF replaced: ' + file.name);
      App.renderAll();
    }
  }

  /* ---------- add / remove items ---------- */
  function addItem(kind) {
    const c = C();
    if (kind === 'gallery') {
      c.f1.gallery.items.push({
        src: '', caption: 'New gallery item — click the photo area to add an image',
        meta: 'New', tall: false
      });
    } else if (kind === 'portfolio') {
      c.f1.portfolios.items.push({
        id: 'custom-' + Date.now(), title: 'New portfolio document',
        tag: 'Document', file: '', cover: '', pages: 0,
        author: '', owner: true, desc: 'Describe this document.'
      });
    } else if (kind === 'timeline') {
      c.f1.timeline.items.push({
        year: String(new Date().getFullYear()), label: 'Milestone',
        title: 'New entry', text: 'Describe what happened and what you learned.',
        tags: []
      });
    } else if (kind === 'design') {
      c.design.items.push({
        title: 'New design project', eyebrow: 'Category',
        desc: 'Describe the project, your role and the outcome.',
        media: '', caption: '', points: ['First point']
      });
    } else if (kind === 'speaking') {
      c.speaking.cards.push({
        eyebrow: 'Event', title: 'New speaking item',
        text: 'Describe the event and your performance.',
        image: '', foot: '', result: ''
      });
    } else if (kind === 'sports') {
      c.sports.cards.push({
        id: 'sport-' + Date.now(),
        eyebrow: 'Sport', title: 'New sport',
        text: 'Describe your involvement and what it taught you.',
        foot: '', result: '',
        images: [
          { src: '', caption: 'Add a caption for this photo', meta: '' }
        ]
      });
    } else if (kind === 'hobbies') {
      c.hobbies.cards.push({
        id: 'hobby-' + Date.now(),
        eyebrow: 'Hobby', title: 'New hobby',
        text: 'Describe what it gives you and when you do it.',
        foot: '', result: '',
        images: [
          { src: '', caption: 'Add a caption for this photo', meta: '' }
        ]
      });
    } else if (kind === 'ngo') {
      c.ngo.projects.push({
        id: 'ngo-' + Date.now(),
        name: 'New project',
        organisation: 'Organisation',
        logo: '',
        logoAlt: 'Project logo',
        role: 'My role',
        text: 'Describe what you did, who you did it for, and what changed as a result.',
        focus: 'Who it serves',
        focusText: 'Add one line about the group of people this project exists for.',
        images: [
          { src: '', caption: 'Add a project photo', meta: '' }
        ]
      });
    }
    Store.save();
    App.renderAll();
    toast('Item added — edit the text in place');
  }

  function removeItem(btn) {
    const info = btn.dataset.remove; // e.g. "f1.gallery.items:3"
    const [path, idx] = info.split(':');
    const arr = getPath(C(), path);
    if (!Array.isArray(arr)) return;

    // Removing a contents entry would break the two-layer navigation
    // (the section it points to would no longer be reachable), so the
    // section itself is removed together with it.
    if (path === 'contents.items') {
      const item = arr[Number(idx)];
      if (!item) return;
      const id = item.id;
      const sec = document.getElementById(id);
      if (sec && !sec.classList.contains('section--body')) {
        toast('This entry points to a section — remove the section itself instead.');
        return;
      }
      if (sec) sec.remove();
      arr.splice(Number(idx), 1);
      Store.save();
      App.renderAll();
      toast('Section removed');
      return;
    }

    arr.splice(Number(idx), 1);
    Store.save();
    App.renderAll();
    toast('Item removed');
  }

  /** Remove a single photo from a list of images (e.g. sports.cards.0.images). */
  function removePhoto(btn) {
    const info = btn.dataset.removePhoto; // "sports.cards:0.images:2"
    const m = info.match(/^(.+?):(\d+)\.(images):(\d+)$/);
    if (!m) return;
    const [, listPath, cardIdx, , photoIdx] = m;
    const arr = getPath(C(), listPath);
    if (!Array.isArray(arr) || !arr[cardIdx]) return;
    const images = arr[cardIdx].images;
    if (!Array.isArray(images)) return;
    images.splice(Number(photoIdx), 1);
    Store.save();
    App.renderAll();
    toast('Photo removed');
  }

  /* ---------- editor mode ---------- */
  function exitEdit() {
    active = false;
    document.body.classList.remove('edit-mode');
    $('#editorBar').classList.remove('is-visible');
    $('#editToggle').textContent = 'Edit';
    $$('[contenteditable]').forEach(n => n.removeAttribute('contenteditable'));
    $$('.remove-btn').forEach(b => b.remove());
    document.removeEventListener('input', onInput);
    document.removeEventListener('focusin', onFocusIn);
    document.removeEventListener('focusout', onFocusOut);
    document.removeEventListener('click', onClick);
    App.renderAll();
  }

  function enterEdit() {
    active = true;
    document.body.classList.add('edit-mode');
    $('#editorBar').classList.add('is-visible');
    $('#editToggle').textContent = 'Editing';
    applyEditables();
    injectRemoveButtons();
    document.addEventListener('input', onInput);
    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('focusout', onFocusOut);
    document.addEventListener('click', onClick);
    toast('Edit mode on — click any text to rewrite it');
  }

  function onInput(e) {
    if (!active) return;
    const t = e.target;
    if (t.matches && t.matches('[contenteditable="true"]')) {
      editing = true;
      commitEditable(t);
    }
  }

  function onFocusIn(e) {
    if (!active) return;
    const t = e.target;
    if (t.matches && t.matches('[contenteditable="true"]')) editing = true;
  }

  function onFocusOut(e) {
    if (!active) return;
    const t = e.target;
    if (t.matches && t.matches('[contenteditable="true"]')) {
      commitEditable(t);
      editing = false;
    }
  }

  function onClick(e) {
    if (!active) return;

    // remove buttons
    const rm = e.target.closest('.remove-btn');
    if (rm) {
      if (rm.dataset.removePhoto) removePhoto(rm);
      else removeItem(rm);
      return;
    }

    // add buttons
    const add = e.target.closest('[data-add]');
    if (add) { addItem(add.dataset.add); return; }

    // add a photo to the last card of a list
    const addPhoto = e.target.closest('[data-add-photo]');
    if (addPhoto) {
      const map = {
        speaking: 'speaking.cards',
        sports: 'sports.cards',
        hobbies: 'hobbies.cards',
        ngo: 'ngo.projects'
      };
      const listPath = map[addPhoto.dataset.addPhoto];
      const arr = listPath ? getPath(C(), listPath) : null;
      if (Array.isArray(arr) && arr.length) {
        const last = arr[arr.length - 1];
        last.images = last.images || [];
        last.images.push({ src: '', caption: 'Add a caption for this photo', meta: '' });
        Store.save();
        App.renderAll();
        toast('Photo slot added');
      }
      return;
    }
  }

  /* ---------- uploads: EDIT MODE ONLY ----------
     On the published (browse) page nothing is replaceable — clicking a
     photo just opens the lightbox. Uploads wake up once edit mode is on. */
  function onUploadClick(e) {
    if (!active) return;

    // image replacement
    const img = e.target.closest('[data-edit-img]');
    if (img) {
      e.preventDefault();
      e.stopPropagation();
      pickFile('image/*', (file) => handleImageUpload(img.dataset.editImg, file));
      return;
    }

    // pdf replacement
    const up = e.target.closest('[data-upload-pdf]');
    if (up) {
      e.preventDefault();
      pickFile('application/pdf', (file) => handlePdfUpload(Number(up.dataset.uploadPdf), file));
      return;
    }

    // video slot
    const vslot = e.target.closest('[data-video-slot]');
    if (vslot) {
      e.preventDefault();
      pickFile('video/*', async (file) => {
        const key = 'video:' + Date.now();
        const ok = await Store.idbPut(key, file);
        if (!ok) { toast('Could not store that video.'); return; }
        C().speaking.video.src = 'db:' + key;
        Store.save();
        toast('Video added');
        App.renderAll();
      });
      return;
    }
  }

  function injectRemoveButtons() {
    const targets = [
      { sel: '#tocGrid .toc', path: 'contents.items' },
      { sel: '#galleryGrid .gfig', path: 'f1.gallery.items' },
      { sel: '#portfolioGrid .pcard', path: 'f1.portfolios.items' },
      { sel: '#timelineList .tl__item', path: 'f1.timeline.items' },
      { sel: '#designList .dsplit', path: 'design.items' },
      { sel: '#speakingCards .card', path: 'speaking.cards' },
      { sel: '#sportsCards .sport', path: 'sports.cards' },
      { sel: '#hobbiesCards .sport', path: 'hobbies.cards' },
      { sel: '#ngoList .ngo', path: 'ngo.projects' }
    ];
    targets.forEach(t => {
      $$(t.sel).forEach((node, i) => {
        if (node.querySelector(':scope > .remove-btn')) return;
        const b = document.createElement('button');
        b.className = 'remove-btn';
        b.dataset.remove = `${t.path}:${i}`;
        b.textContent = '✕ Remove';
        b.style.cssText = 'position:absolute;top:8px;right:8px;z-index:5;background:rgba(200,69,45,.92);color:#fff;border:0;border-radius:2px;font-size:10px;letter-spacing:.08em;text-transform:uppercase;padding:5px 9px;cursor:pointer;display:none;font-family:var(--mono)';
        node.addEventListener('mouseenter', () => b.style.display = 'block');
        node.addEventListener('mouseleave', () => { if (!b.matches(':focus')) b.style.display = 'none'; });
        if (getComputedStyle(node).position === 'static') node.style.position = 'relative';
        node.appendChild(b);
      });
    });

    // individual photos inside a sport / speaking / hobby / ngo card can be removed too
    $$('#sportsCards .sport, #speakingCards .card, #hobbiesCards .sport, #ngoList .ngo').forEach(card => {
      const cardIdx = Number(card.dataset.sportIdx ?? card.dataset.speakIdx ?? card.dataset.hobbyIdx ?? card.dataset.ngoIdx);
      $$('.sfig', card).forEach((fig, j) => {
        if (fig.querySelector(':scope > .remove-btn')) return;
        const b = document.createElement('button');
        b.className = 'remove-btn';
        b.dataset.removePhoto = `${card.dataset.listPath}:${cardIdx}.images:${j}`;
        b.textContent = '✕';
        b.style.cssText = 'position:absolute;top:6px;right:6px;z-index:5;background:rgba(200,69,45,.92);color:#fff;border:0;border-radius:2px;font-size:11px;width:22px;height:22px;cursor:pointer;display:none;font-family:var(--mono);line-height:1';
        fig.addEventListener('mouseenter', () => b.style.display = 'block');
        fig.addEventListener('mouseleave', () => { if (!b.matches(':focus')) b.style.display = 'none'; });
        if (getComputedStyle(fig).position === 'static') fig.style.position = 'relative';
        fig.appendChild(b);
      });
    });
  }

  /* ---------- export / import ---------- */
  function downloadBlob(blob, filename) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 3000);
  }

  /**
   * Export the current content as JSON. Any media uploaded in this browser
   * (images / PDFs / video) is included as a separate file, and the JSON
   * references it with a real relative path so it can be dropped straight
   * into the site folder.
   */
  async function exportJSON(includeMedia) {
    const data = JSON.parse(JSON.stringify(C()));
    const uploaded = [];

    // find every db: reference in the content tree
    (function walk(node) {
      if (typeof node === 'string') {
        if (node.startsWith('db:')) uploaded.push(node.slice(3));
      } else if (Array.isArray(node)) {
        node.forEach(walk);
      } else if (node && typeof node === 'object') {
        Object.values(node).forEach(walk);
      }
    })(data);

    const unique = [...new Set(uploaded)];
    const mapping = {};

    for (const key of unique) {
      const blob = await Store.idbGet(key);
      if (!blob) continue;
      const ext = (blob.type.split('/')[1] || 'bin').split('+')[0];
      const safe = key.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '');
      const fname = `${safe}.${ext}`;
      mapping[key] = `assets/uploads/${fname}`;
      if (includeMedia) downloadBlob(blob, fname);
    }

    // replace db: references with real relative paths
    (function replace(node) {
      if (typeof node === 'string') {
        if (node.startsWith('db:')) return mapping[node.slice(3)] || node;
        return node;
      }
      if (Array.isArray(node)) return node.map(replace);
      if (node && typeof node === 'object') {
        for (const k of Object.keys(node)) node[k] = replace(node[k]);
        return node;
      }
      return node;
    })(data);

    data._meta = data._meta || {};
    data._meta.exportedAt = new Date().toISOString();
    if (unique.length) {
      data._meta.uploadedMedia = Object.entries(mapping).map(([key, path]) => ({
        id: key, path, note: 'Copy the matching file from assets/uploads/ into the site folder.'
      }));
    }

    downloadBlob(
      new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
      'carey-portfolio-content.json'
    );

    toast(unique.length
      ? `Exported JSON + ${unique.length} media file(s)`
      : 'Downloaded carey-portfolio-content.json');
  }

  function importJSON() {
    const input = $('#jsonPicker');
    input.value = '';
    input.addEventListener('change', async () => {
      const f = input.files && input.files[0];
      if (!f) return;
      try {
        const obj = JSON.parse(await f.text());
        Store.replaceAll(obj);
        toast('Content imported');
        App.renderAll();
        if (active) { applyEditables(); injectRemoveButtons(); }
      } catch (err) {
        toast('That file could not be parsed as JSON.');
      }
    });
    input.click();
  }

  function resetAll() {
    if (!confirm('Reset all content back to the original content.json?\n\nAny edits made in this browser will be discarded.')) return;
    Store.reset();
    toast('Content reset');
    App.renderAll();
    if (active) { applyEditables(); injectRemoveButtons(); }
  }

  /* ---------- rebind after re-render ---------- */
  function rebind() {
    if (!active) return;
    applyEditables();
    injectRemoveButtons();
  }

  /* ---------- init ---------- */
  document.addEventListener('DOMContentLoaded', () => {
    $('#editToggle').addEventListener('click', () => active ? exitEdit() : enterEdit());
    $('#btnExit').addEventListener('click', exitEdit);
    $('#btnSave').addEventListener('click', () => {
      Store.save();
      toast('Saved to this browser');
    });
    $('#btnExport').addEventListener('click', () => exportJSON(false));
    $('#btnExportAll').addEventListener('click', () => exportJSON(true));
    $('#btnImport').addEventListener('click', importJSON);
    $('#btnReset').addEventListener('click', resetAll);

    // Uploads stay available in browse mode too — replacing a photo or a
    // portfolio PDF should never require entering edit mode first.
    document.addEventListener('click', onUploadClick);

    document.addEventListener('keydown', (e) => {
      const tag = (e.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea') return;
      if (e.key === 'e' || e.key === 'E') {
        e.preventDefault();
        active ? exitEdit() : enterEdit();
      }
    });
  });

  window.Editor = { enterEdit, exitEdit, rebind, exportJSON, importJSON, resetAll };
})();
