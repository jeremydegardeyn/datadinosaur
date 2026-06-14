/* DataDinosaur — main.js */
'use strict';

/* ---- Mobile nav toggle ---- */
const navToggle = document.getElementById('navToggle');
const siteNav   = document.getElementById('siteNav');
if (navToggle && siteNav) {
  navToggle.addEventListener('click', () => siteNav.classList.toggle('open'));
}

/* ---- Blog search (sidebar) ---- */
const searchForm    = document.getElementById('sidebarSearch');
const searchInput   = document.getElementById('searchInput');
const searchResults = document.getElementById('searchResults');

if (searchForm && searchInput && searchResults) {
  let debounceTimer;

  async function doSearch(q) {
    q = q.trim();
    if (q.length < 3) { searchResults.innerHTML = ''; return; }

    try {
      const res  = await fetch('/api/blog?q=' + encodeURIComponent(q));
      const data = await res.json();

      if (!data.results || data.results.length === 0) {
        searchResults.innerHTML = '<p style="font-size:.82rem;color:var(--text-muted);padding:.5rem 0">No results.</p>';
        return;
      }

      searchResults.innerHTML = data.results.map(r =>
        `<div class="search-result-item">
          <a href="/blog/${r.slug}">${escHtml(r.title)}</a>
          <div style="font-size:.75rem;color:var(--text-muted);margin-top:.2rem">${escHtml(r.excerpt || '')}</div>
        </div>`
      ).join('');
    } catch(e) {
      searchResults.innerHTML = '';
    }
  }

  searchInput.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => doSearch(searchInput.value), 300);
  });

  searchForm.addEventListener('submit', e => {
    e.preventDefault();
    doSearch(searchInput.value);
  });
}

/* ---- Markdown preview in post editor ---- */
const editorTabs    = document.querySelectorAll('.editor-tab');
const postContent   = document.getElementById('postContent');
const mdPreview     = document.getElementById('mdPreview');

if (editorTabs.length && postContent && mdPreview) {
  editorTabs.forEach(tab => {
    tab.addEventListener('click', async () => {
      editorTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      if (tab.dataset.tab === 'preview') {
        postContent.style.display = 'none';
        mdPreview.style.display   = 'block';
        try {
          const res  = await fetch('/api/preview', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: postContent.value })
          });
          const data = await res.json();
          mdPreview.innerHTML = data.html || '';
        } catch(e) {
          mdPreview.innerHTML = '<em style="color:var(--text-muted)">Preview unavailable.</em>';
        }
      } else {
        postContent.style.display = '';
        mdPreview.style.display   = 'none';
      }
    });
  });
}

/* ---- Image upload in post editor (button / drag-drop / paste) ---- */
const imgBtn    = document.getElementById('insertImageBtn');
const imgInput  = document.getElementById('imageUpload');
const imgStatus = document.getElementById('imgUploadStatus');

if (postContent && imgInput) {
  const csrf = () => {
    const f = document.getElementById('editForm');
    const i = f && f.querySelector('[name=csrf_token]');
    return i ? i.value : '';
  };

  function insertAtCursor(text) {
    const start = postContent.selectionStart;
    const end   = postContent.selectionEnd;
    const v     = postContent.value;
    postContent.value = v.slice(0, start) + text + v.slice(end);
    const pos = start + text.length;
    postContent.selectionStart = postContent.selectionEnd = pos;
    postContent.focus();
  }

  async function uploadImage(file) {
    if (!file || !file.type.startsWith('image/')) return;
    if (imgStatus) imgStatus.textContent = 'Uploading…';
    const fd = new FormData();
    fd.append('file', file);
    fd.append('csrf_token', csrf());
    try {
      const res  = await fetch('/api/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (data.ok && data.url) {
        const alt = (file.name || 'image').replace(/\.[^.]+$/, '');
        insertAtCursor(`\n![${alt}](${data.url})\n`);
        if (imgStatus) imgStatus.textContent = 'Inserted ✓';
      } else {
        if (imgStatus) imgStatus.textContent = data.error || 'Upload failed';
      }
    } catch (e) {
      if (imgStatus) imgStatus.textContent = 'Upload failed';
    }
    setTimeout(() => { if (imgStatus) imgStatus.textContent = 'or drag & drop / paste an image'; }, 4000);
  }

  if (imgBtn) imgBtn.addEventListener('click', () => imgInput.click());
  imgInput.addEventListener('change', () => { if (imgInput.files[0]) uploadImage(imgInput.files[0]); imgInput.value = ''; });

  postContent.addEventListener('dragover', e => { e.preventDefault(); postContent.classList.add('drag-over'); });
  postContent.addEventListener('dragleave', () => postContent.classList.remove('drag-over'));
  postContent.addEventListener('drop', e => {
    e.preventDefault();
    postContent.classList.remove('drag-over');
    const file = e.dataTransfer.files && e.dataTransfer.files[0];
    if (file) uploadImage(file);
  });

  postContent.addEventListener('paste', e => {
    const items = e.clipboardData && e.clipboardData.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        uploadImage(item.getAsFile());
        break;
      }
    }
  });
}

/* ---- Auto-generate slug from title ---- */
const postTitle = document.getElementById('postTitle');
const postSlug  = document.getElementById('postSlug');
if (postTitle && postSlug) {
  postTitle.addEventListener('input', () => {
    if (!postSlug._userEdited) {
      postSlug.value = slugify(postTitle.value);
    }
  });
  postSlug.addEventListener('input', () => { postSlug._userEdited = true; });
}

/* ---- Delete post ---- */
function deletePost(id, csrf) {
  if (!confirm('Delete this post permanently?')) return;
  const fd = new FormData();
  fd.append('action', 'delete');
  fd.append('post_id', id);
  fd.append('csrf_token', csrf);
  fetch('/api/blog', { method: 'POST', body: fd })
    .then(r => r.json())
    .then(d => { if (d.ok) window.location = '/admin'; })
    .catch(console.error);
}

/* ---- Toggle post visibility ---- */
function togglePostVisibility(id, visible, csrf) {
  const fd = new FormData();
  fd.append('action',     'toggle_visibility');
  fd.append('post_id',    id);
  fd.append('visible',    visible ? '1' : '0');
  fd.append('csrf_token', csrf);
  fetch('/api/blog', { method: 'POST', body: fd })
    .then(r => r.json())
    .then(d => {
      if (d.ok) {
        const row = document.querySelector(`tr[data-post-id="${id}"]`);
        if (row) {
          row.classList.toggle('post-hidden', !visible);
          const lbl = row.querySelector('.visibility-toggle');
          if (lbl) lbl.title = visible ? 'Visible — click to hide' : 'Hidden — click to show';
        }
      }
    })
    .catch(console.error);
}

/* ---- Toggle post pin ---- */
function togglePostPin(id, pinned, csrf) {
  const fd = new FormData();
  fd.append('action',     'toggle_pin');
  fd.append('post_id',    id);
  fd.append('pinned',     pinned ? '1' : '0');
  fd.append('csrf_token', csrf);
  fetch('/api/blog', { method: 'POST', body: fd })
    .then(r => r.json())
    .then(d => {
      if (d.ok) {
        const row = document.querySelector(`tr[data-post-id="${id}"]`);
        if (row) {
          const lbl = row.querySelector('.pin-toggle');
          if (lbl) lbl.title = pinned ? 'Pinned — click to unpin' : 'Not pinned — click to pin';
        }
      }
    })
    .catch(console.error);
}

/* ---- Moderate comment ---- */
function moderateComment(id, action, csrf) {
  const fd = new FormData();
  fd.append('action', 'moderate_comment');
  fd.append('comment_id', id);
  fd.append('moderation', action);
  fd.append('csrf_token', csrf);
  fetch('/api/blog', { method: 'POST', body: fd })
    .then(r => r.json())
    .then(d => {
      if (d.ok) {
        const el = document.querySelector(`[data-comment-id="${id}"]`);
        if (el) el.remove();
      }
    })
    .catch(console.error);
}

/* ---- Delete inquiry ---- */
function deleteInquiry(id, csrf) {
  if (!confirm('Delete this inquiry permanently?')) return;
  const fd = new FormData();
  fd.append('action', 'delete_inquiry');
  fd.append('inquiry_id', id);
  fd.append('csrf_token', csrf);
  fetch('/api/contact', { method: 'POST', body: fd })
    .then(r => r.json())
    .then(d => {
      if (d.ok) {
        const el = document.querySelector(`[data-inquiry-id="${id}"]`);
        if (el) el.remove();
      }
    })
    .catch(console.error);
}

/* ---- Helpers ---- */
function slugify(str) {
  return str.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function escHtml(str) {
  const d = document.createElement('div');
  d.appendChild(document.createTextNode(str));
  return d.innerHTML;
}
