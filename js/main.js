/* =================================================================
 CALCULATOR v2 Modules:
 1. Parser — recursive-descent, no eval()
 2. State — single source of truth
 3. Routes — stealth config-driven trigger system
 ================================================================= */

/* ── 1. PARSER ──────────────────────────────────────────────────── */
const Parser = (() => {
  let _toks = [], _pos = 0;

  function tokenise(src) {
    const s = src
      .replace(/[×x]/g, '*')
      .replace(/[÷]/g, '/')
      .replace(/[−–]/g, '-')
      .replace(/\s+/g, '');
    const out = [];
    let i = 0;
    while (i < s.length) {
      const c = s[i];
      if (/[\d.]/.test(c)) {
        let n = '';
        while (i < s.length && /[\d.]/.test(s[i])) n += s[i++];
        out.push({ t:'NUM', v: parseFloat(n) });
      } else if ('+-*/()'.includes(c)) {
        out.push({ t: c });
        i++;
      } else i++;
    }
    return out;
  }

  const peek = () => _toks[_pos] || null;
  const consume = () => _toks[_pos++];
  const expect = (t) => {
    const tok = peek();
    if (!tok || tok.t !== t) throw new Error('Expected ' + t);
    return consume();
  };

  function parseFactor() {
    const tok = peek();
    if (!tok) throw new Error('Unexpected end');
    if (tok.t === '-') {
      consume();
      return -parseFactor();
    }
    if (tok.t === '(') {
      consume();
      const v = parseExpr();
      expect(')');
      return v;
    }
    if (tok.t === 'NUM') {
      consume();
      return tok.v;
    }
    throw new Error('Unexpected token: ' + tok.t);
  }

  function parseTerm() {
    let l = parseFactor();
    while (true) {
      const tok = peek();
      if (!tok || (tok.t !== '*' && tok.t !== '/')) break;
      const op = consume().t;
      const r = parseFactor();
      if (op === '*') l *= r;
      else {
        if (r === 0) throw new Error('Division by zero');
        l /= r;
      }
    }
    return l;
  }

  function parseExpr() {
    let l = parseTerm();
    while (true) {
      const tok = peek();
      if (!tok || (tok.t !== '+' && tok.t !== '-')) break;
      const op = consume().t;
      l = op === '+' ? l + parseTerm() : l - parseTerm();
    }
    return l;
  }

  function evaluate(raw) {
    _toks = tokenise(raw);
    _pos = 0;
    if (_toks.length === 0) return 0;
    const r = parseExpr();
    if (_pos < _toks.length) throw new Error('Trailing token');
    return r;
  }

  return { evaluate, tokenise };
})();

/* ── 2. STATE ───────────────────────────────────────────────────── */
const state = {
  expr: '',
  result: '0',
  justEvaluated: false,
  activeOp: null,
  isError: false,
  historyOpen: false,
};

const calcHistory = [];

/* ── 3. ROUTES — stealth trigger system ─────────────────────────── */
let _activeBlob = null;

function launchSecureBlobRoute(targetUrl) {
  if (_activeBlob) {
    URL.revokeObjectURL(_activeBlob);
    _activeBlob = null;
  }

  // Technique 1: Base64 Obfuscation
  const encodedUrl = btoa(targetUrl);

  // Technique 2 & 3: JS Injection via Blob URL Wrapper Window
  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Loading…</title>
  <style>
    html, body { margin: 0; height: 100%; overflow: hidden; background: #0e0e10; }
  </style>
</head>
<body>
  <script>
    (function() {
      try {
        window.location.href = atob("${encodedUrl}");
      } catch (e) {
        console.error("Routing error");
      }
    })();
  <\/script>
</body>
</html>`;

  const blob = new Blob([htmlContent], { type: 'text/html' });
  _activeBlob = URL.createObjectURL(blob);

  const w = 1200, h = 800;
  const left = Math.max(0, (screen.width - w) / 2);
  const top = Math.max(0, (screen.height - h) / 2);

  const newWin = window.open(
    _activeBlob,
    '_blank',
    `width=${w},height=${h},top=${top},left=${left},resizable=yes,scrollbars=yes`
  );

  if (!newWin) {
    window.open(targetUrl, '_blank');
  }
}

const Dispatcher = (() => {
  const _reg = Object.create(null);
  let _seq = 0;

  function register(testFn, fireFn) {
    _reg[_seq++] = { test: testFn, fire: fireFn };
  }

  function dispatch(expr, numResult) {
    const keys = Object.keys(_reg);
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      if (_reg[k].test(expr, numResult)) {
        _reg[k].fire(expr, numResult);
        return true;
      }
    }
    return false;
  }
  return { register, dispatch };
})();

function _operands(expr) {
  try {
    return Parser.tokenise(expr).filter(t => t.t === 'NUM').map(t => t.v);
  } catch {
    return [];
  }
}

function registerProductRoute(a, b, fireFn) {
  const expected = a * b;
  Dispatcher.register(
    (expr, res) => {
      if (Math.abs(res - expected) > 1e-9) return false;
      const ops = _operands(expr);
      if (ops.length !== 2) return false;
      const norm = expr.replace(/[×x]/g,'*').replace(/[÷]/g,'/').replace(/[−–]/g,'-');
      if (/[+\-]/.test(norm.replace(/^\-/,''))) return false;
      return (Math.abs(ops[0]-a)<1e-9 && Math.abs(ops[1]-b)<1e-9) || (Math.abs(ops[0]-b)<1e-9 && Math.abs(ops[1]-a)<1e-9);
    },
    fireFn
  );
}

function registerResultRoute(targetValue, fireFn) {
  Dispatcher.register(
    (_expr, res) => Math.abs(res - targetValue) < 1e-9,
    fireFn
  );
}

/* ── Register Triggers ── */
registerProductRoute(61, 47, () => {
  launchSecureBlobRoute('/secure-route');
});

registerResultRoute(1337, (_e, _r) => {
  console.info('%c🎯 l33t mode', 'color:#c8fa64;font-size:14px;font-weight:bold;');
});
/* =================================================================
 CALCULATOR v2 Modules (Continued):
 4. History — persistent in-session log
 5. UI / Render — display + panel
 6. Animations — ripple, result pop, font-scaling
 7. Input — button clicks + full keyboard map
 ================================================================= */

/* ── 4. HISTORY ─────────────────────────────────────────────────── */
function historyAdd(expr, result) {
  calcHistory.unshift({ expr, result });
  if (calcHistory.length > 50) calcHistory.pop();
  renderHistory();
}

function historyClear() {
  calcHistory.length = 0;
  renderHistory();
}

function historyRecall(index) {
  const item = calcHistory[index];
  if (!item) return;
  state.expr = item.result;
  state.result = item.result;
  state.justEvaluated = true;
  state.activeOp = null;
  state.isError = false;
  render();
}

/* ── 5. UI / RENDER ─────────────────────────────────────────────── */
const elHistoryPanel = document.getElementById('historyPanel');
const elHistoryList = document.getElementById('historyList');
const elHistoryEmpty = document.getElementById('historyEmpty');
const elHistoryClear = document.getElementById('historyClearBtn');
const elHistoryToggle = document.getElementById('historyToggle');
const elHistoryLine = document.getElementById('displayHistoryLine');
const elExpression = document.getElementById('displayExpression');
const elResult = document.getElementById('displayResult');

function humanExpr(raw) {
  return raw.replace(/\*/g,'×').replace(/\//g,'÷').replace(/-/g,'−');
}

function formatNumber(n) {
  const r = parseFloat(n.toPrecision(12));
  return String(r);
}

function fitResultFont() {
  const len = elResult.textContent.length;
  if (len > 14) elResult.style.fontSize = '24px';
  else if (len > 10) elResult.style.fontSize = '32px';
  else if (len > 7) elResult.style.fontSize = '38px';
  else elResult.style.fontSize = '44px';
}

function render() {
  elHistoryLine.textContent = state.justEvaluated && calcHistory.length > 0 ? `${calcHistory[0].expr} =` : '';
  elExpression.textContent = humanExpr(state.expr);
  elResult.textContent = state.result;
  elResult.classList.toggle('error', state.isError);
  fitResultFont();
  document.querySelectorAll('.btn.op').forEach(b => b.classList.toggle('active-op', b.dataset.value === state.activeOp) );
}

function renderHistory() {
  if (!elHistoryEmpty || !elHistoryList) return;
  elHistoryEmpty.style.display = calcHistory.length ? 'none' : 'flex';
  elHistoryList.querySelectorAll('.history-item').forEach(n => n.remove());
  calcHistory.forEach((item, i) => {
    const div = document.createElement('div');
    div.className = 'history-item';
    div.setAttribute('role', 'listitem');
    div.setAttribute('tabindex', '0');
    div.setAttribute('aria-label', `${item.expr} equals ${item.result}`);
    div.innerHTML = `<div class="history-expr">${item.expr}</div><div class="history-res">${item.result}</div>`;
    div.addEventListener('click', () => historyRecall(i));
    div.addEventListener('keydown', e => { if (e.key==='Enter') historyRecall(i); });
    elHistoryList.appendChild(div);
  });
}

function toggleHistory() {
  state.historyOpen = !state.historyOpen;
  elHistoryPanel.classList.toggle('open', state.historyOpen);
  elHistoryToggle.classList.toggle('active', state.historyOpen);
  elHistoryToggle.setAttribute('aria-expanded', String(state.historyOpen));
}

if (elHistoryToggle) elHistoryToggle.addEventListener('click', toggleHistory);
if (elHistoryClear) elHistoryClear.addEventListener('click', () => { historyClear(); });

/* ── 6. ANIMATIONS ──────────────────────────────────────────────── */
function ripple(btn) {
  btn.classList.remove('ripple','ripple-out');
  void btn.offsetWidth;
  btn.classList.add('ripple');
  setTimeout(() => {
    btn.classList.remove('ripple');
    btn.classList.add('ripple-out');
    setTimeout(() => btn.classList.remove('ripple-out'), 460);
  }, 60);
}

function popResult() {
  elResult.classList.remove('flash','flash-pop');
  void elResult.offsetWidth;
  elResult.classList.add('flash');
  setTimeout(() => {
    elResult.classList.remove('flash');
    elResult.classList.add('flash-pop');
  }, 80);
  setTimeout(() => elResult.classList.remove('flash-pop'), 380);
}

/* ── 7. INPUT HANDLING ──────────────────────────────────────────── */
function handleAction(action, value, srcBtn) {
  state.isError = false;
  if (srcBtn) ripple(srcBtn);
  switch (action) {
    case 'digit': {
      if (state.justEvaluated) {
        state.expr = '';
        state.justEvaluated = false;
      }
      if (value === '0' && state.expr === '0') break;
      state.expr += value;
      state.result = value;
      state.activeOp = null;
      break;
    }
    case 'decimal': {
      if (state.justEvaluated) {
        state.expr = '0.';
        state.result = '0.';
        state.justEvaluated = false;
        break;
      }
      const last = state.expr.split(/[+\-*/]/).pop();
      if (last.includes('.')) break;
      if (state.expr === '' || /[+\-*/]$/.test(state.expr)) {
        state.expr += '0.';
        state.result = '0.';
      } else {
        state.expr += '.';
        state.result += '.';
      }
      break;
    }
    case 'op': {
      if (/[+\-*/]$/.test(state.expr)) {
        state.expr = state.expr.slice(0, -1) + value;
      } else if (state.expr === '') {
        state.expr = state.result + value;
      } else {
        state.expr += value;
      }
      state.activeOp = value;
      state.justEvaluated = false;
      break;
    }
    case 'equals': {
      if (!state.expr) break;
      try {
        const num = Parser.evaluate(state.expr);
        const fmt = formatNumber(num);
        historyAdd(humanExpr(state.expr), fmt);
        Dispatcher.dispatch(state.expr, num);
        state.result = fmt;
        state.expr = fmt;
        state.justEvaluated = true;
        state.activeOp = null;
        popResult();
      } catch (err) {
        state.result = err.message === 'Division by zero' ? 'Div / 0' : 'Error';
        state.expr = '';
        state.isError = true;
      }
      break;
    }
    case 'percent': {
      if (!state.expr) break;
      try {
        const pct = formatNumber(Parser.evaluate(state.expr) / 100);
        state.expr = pct;
        state.result = pct;
      } catch { /* ignore */ }
      break;
    }
    case 'back': {
      if (state.justEvaluated) {
        state.expr = '';
        state.result = '0';
        state.justEvaluated = false;
        break;
      }
      state.expr = state.expr.slice(0, -1);
      state.result = state.expr || '0';
      break;
    }
    case 'clear': {
      state.expr = '';
      state.result = '0';
      state.justEvaluated = false;
      state.activeOp = null;
      state.isError = false;
      break;
    }
  }
  render();
}

/* Button clicks */
document.querySelectorAll('.btn').forEach(btn => {
  btn.addEventListener('click', () => handleAction(btn.dataset.action, btn.dataset.value, btn) );
});

/* Keyboard map */
const KEY_MAP = {
  '0':{ a:'digit', v:'0'}, '1':{ a:'digit', v:'1'}, '2':{ a:'digit', v:'2'},
  '3':{ a:'digit', v:'3'}, '4':{ a:'digit', v:'4'}, '5':{ a:'digit', v:'5'},
  '6':{ a:'digit', v:'6'}, '7':{ a:'digit', v:'7'}, '8':{ a:'digit', v:'8'},
  '9':{ a:'digit', v:'9'}, '+':{ a:'op', v:'+'}, '-':{ a:'op', v:'-'},
  '*':{ a:'op', v:'*'}, '/':{ a:'op', v:'/'}, '.':{ a:'decimal'},
  ',':{ a:'decimal'}, 'Enter': { a:'equals'}, '=':{ a:'equals'},
  'Backspace':{ a:'back' }, 'Escape': { a:'clear' }, 'Delete':{ a:'clear'},
  '%': { a:'percent'}, 'h': { a:'_history' }, 'H':{ a:'_history' },
};

function flashKey(a, v) {
  const sel = v ? `.btn[data-action="${a}"][data-value="${v}"]` : `.btn[data-action="${a}"]`;
  const el = document.querySelector(sel);
  if (!el) return;
  el.classList.add('kb-active');
  setTimeout(() => el.classList.remove('kb-active'), 130);
}

document.addEventListener('keydown', e => {
  if (e.ctrlKey || e.altKey || e.metaKey) return;
  if (e.key === '/') e.preventDefault();
  const m = KEY_MAP[e.key];
  if (!m) return;
  if (m.a === '_history') {
    toggleHistory();
    return;
  }
  flashKey(m.a, m.v);
  const srcBtn = m.v ? document.querySelector(`.btn[data-action="${m.a}"][data-value="${m.v}"]`) : document.querySelector(`.btn[data-action="${m.a}"]`);
  handleAction(m.a, m.v, srcBtn);
});

/* ── Boot ── */
render();
renderHistory();
