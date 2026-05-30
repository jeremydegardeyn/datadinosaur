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
