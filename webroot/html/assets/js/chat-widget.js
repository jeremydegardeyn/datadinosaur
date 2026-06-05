/**
 * DataDinosaur RAG chat widget
 * Vanilla JS, no dependencies.
 */
(function () {
  'use strict';

  const API_URL = '/api/rag/ask';

  // ── Build DOM ───────────────────────────────────────────────────────────────

  const styles = `
    #dd-chat-btn {
      position: fixed; bottom: 24px; right: 24px; z-index: 9000;
      width: 52px; height: 52px; border-radius: 50%;
      background: #2563eb; color: #fff; border: none;
      box-shadow: 0 4px 14px rgba(0,0,0,.25);
      cursor: pointer; font-size: 22px; display: flex;
      align-items: center; justify-content: center;
      transition: transform .15s, background .15s;
    }
    #dd-chat-btn:hover { background: #1d4ed8; transform: scale(1.08); }

    #dd-chat-box {
      position: fixed; bottom: 88px; right: 24px; z-index: 9000;
      width: 340px; max-height: 520px;
      background: #fff; border: 1px solid #e2e8f0;
      border-radius: 12px; box-shadow: 0 8px 30px rgba(0,0,0,.15);
      display: none; flex-direction: column; overflow: hidden;
      font-family: inherit;
    }
    #dd-chat-box.open { display: flex; }

    #dd-chat-header {
      padding: 12px 16px; background: #2563eb; color: #fff;
      display: flex; align-items: center; justify-content: space-between;
      font-size: 14px; font-weight: 600;
    }
    #dd-chat-header span { opacity: .8; font-size: 11px; font-weight: 400; }
    #dd-chat-close {
      background: none; border: none; color: #fff;
      cursor: pointer; font-size: 18px; line-height: 1; padding: 0;
    }

    #dd-chat-messages {
      flex: 1; overflow-y: auto; padding: 12px 14px;
      display: flex; flex-direction: column; gap: 10px;
    }

    .dd-msg {
      max-width: 88%; padding: 9px 12px; border-radius: 10px;
      font-size: 13px; line-height: 1.5; word-break: break-word;
    }
    .dd-msg.bot  { background: #f1f5f9; align-self: flex-start; }
    .dd-msg.user { background: #2563eb; color: #fff; align-self: flex-end; }
    .dd-msg.error { background: #fee2e2; color: #991b1b; }

    .dd-sources {
      margin-top: 6px; font-size: 11px; color: #64748b;
    }
    .dd-sources a {
      display: block; color: #2563eb; text-decoration: underline;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }

    #dd-chat-footer {
      padding: 10px 12px; border-top: 1px solid #e2e8f0;
      display: flex; gap: 8px;
    }
    #dd-chat-input {
      flex: 1; padding: 8px 10px; border: 1px solid #cbd5e1;
      border-radius: 8px; font-size: 13px; outline: none;
      font-family: inherit;
    }
    #dd-chat-input:focus { border-color: #2563eb; }
    #dd-chat-send {
      padding: 8px 14px; background: #2563eb; color: #fff;
      border: none; border-radius: 8px; cursor: pointer;
      font-size: 13px; font-weight: 600;
      transition: background .15s;
    }
    #dd-chat-send:hover { background: #1d4ed8; }
    #dd-chat-send:disabled { background: #94a3b8; cursor: default; }

    .dd-typing span {
      display: inline-block; width: 6px; height: 6px; margin: 0 1px;
      background: #94a3b8; border-radius: 50%;
      animation: dd-bounce .9s infinite ease-in-out;
    }
    .dd-typing span:nth-child(2) { animation-delay: .15s; }
    .dd-typing span:nth-child(3) { animation-delay: .30s; }
    @keyframes dd-bounce {
      0%,80%,100% { transform: translateY(0); }
      40%          { transform: translateY(-5px); }
    }
  `;

  const styleEl = document.createElement('style');
  styleEl.textContent = styles;
  document.head.appendChild(styleEl);

  // Button
  const btn = document.createElement('button');
  btn.id = 'dd-chat-btn';
  btn.title = 'Ask my blog';
  btn.innerHTML = '💬';
  document.body.appendChild(btn);

  // Box
  const box = document.createElement('div');
  box.id = 'dd-chat-box';
  box.innerHTML = `
    <div id="dd-chat-header">
      Ask my blog <span>Powered by DataDinosaur RAG</span>
      <button id="dd-chat-close" aria-label="Close">✕</button>
    </div>
    <div id="dd-chat-messages">
      <div class="dd-msg bot">Hi! Ask me anything about my blog posts. 🦕</div>
    </div>
    <div id="dd-chat-footer">
      <input id="dd-chat-input" type="text" placeholder="Ask a question…" maxlength="300" autocomplete="off" />
      <button id="dd-chat-send">Send</button>
    </div>
  `;
  document.body.appendChild(box);

  // ── Logic ───────────────────────────────────────────────────────────────────

  const msgs  = box.querySelector('#dd-chat-messages');
  const input = box.querySelector('#dd-chat-input');
  const send  = box.querySelector('#dd-chat-send');

  btn.addEventListener('click', () => {
    box.classList.toggle('open');
    if (box.classList.contains('open')) input.focus();
  });
  box.querySelector('#dd-chat-close').addEventListener('click', () => {
    box.classList.remove('open');
  });

  send.addEventListener('click', submit);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });

  function simpleMarkdown(text) {
    return text
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`(.+?)`/g, '<code>$1</code>')
      .replace(/\n/g, '<br>');
  }

  function addMsg(text, cls, sources) {
    const el = document.createElement('div');
    el.className = 'dd-msg ' + cls;
    if (cls === 'bot') {
      el.innerHTML = simpleMarkdown(text);
    } else {
      el.textContent = text;
    }

    if (sources && sources.length) {
      const div = document.createElement('div');
      div.className = 'dd-sources';
      div.textContent = 'Sources: ';
      sources.forEach(s => {
        const a = document.createElement('a');
        a.href = s.url; a.textContent = s.title;
        a.target = '_blank'; a.rel = 'noopener noreferrer';
        div.appendChild(a);
      });
      el.appendChild(div);
    }

    msgs.appendChild(el);
    msgs.scrollTop = msgs.scrollHeight;
    return el;
  }

  function addTyping() {
    const el = document.createElement('div');
    el.className = 'dd-msg bot dd-typing';
    el.innerHTML = '<span></span><span></span><span></span>';
    msgs.appendChild(el);
    msgs.scrollTop = msgs.scrollHeight;
    return el;
  }

  async function submit() {
    const q = input.value.trim();
    if (!q) return;

    input.value = '';
    send.disabled = true;
    addMsg(q, 'user');
    const typing = addTyping();

    try {
      const res = await fetch(API_URL, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ question: q }),
      });
      const data = await res.json();
      typing.remove();

      if (!res.ok || data.error) {
        addMsg(data.error || 'Something went wrong. Please try again.', 'dd-msg bot error');
      } else {
        addMsg(data.answer, 'bot', data.sources);
      }
    } catch {
      typing.remove();
      addMsg('Could not reach the server. Please try again later.', 'bot error');
    } finally {
      send.disabled = false;
      input.focus();
    }
  }
})();
