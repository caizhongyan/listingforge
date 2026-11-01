// ListingForge 前端逻辑
// 漏斗：免费生成看预览 → 付费（Creem）解锁完整结果 + 一键复制 + 无限生成
(function () {
  var info = document.getElementById('info');
  var platform = document.getElementById('platform');
  var lang = document.getElementById('lang');
  var btn = document.getElementById('genBtn');
  var status = document.getElementById('status');
  var result = document.getElementById('result');

  var TOKEN_KEY = 'lf_token';
  var PENDING_KEY = 'lf_pending';
  var lastResult = null; // 缓存最近一次生成结果，支付成功后重新渲染为已解锁态

  // 跳转收银台前持久化当前输入与结果：支付回跳后页面重载，内存变量会丢失
  function savePending() {
    try {
      sessionStorage.setItem(PENDING_KEY, JSON.stringify({
        info: info.value, platform: platform.value, lang: lang.value, result: lastResult
      }));
    } catch (e) {}
  }

  function restorePending() {
    var d = null;
    try { d = JSON.parse(sessionStorage.getItem(PENDING_KEY) || 'null'); } catch (e) {}
    if (!d || !d.result) return false;
    info.value = d.info || '';
    platform.value = d.platform || platform.value;
    lang.value = d.lang || lang.value;
    lastResult = d.result;
    render(lastResult);
    return true;
  }

  function getToken() { try { return localStorage.getItem(TOKEN_KEY) || ''; } catch (e) { return ''; } }
  function isUnlocked() { return !!getToken() || document.body.classList.contains('unlocked'); }
  function t(n, p) { try { window.pp && window.pp.track && window.pp.track(n, p); } catch (e) {} }

  function setStatus(msg, isErr) {
    status.hidden = !msg;
    status.textContent = msg || '';
    status.className = 'status' + (isErr ? ' err' : '');
  }

  /* ---------- 付费墙 ---------- */
  var paywall = document.getElementById('paywall');
  function openPaywall() { if (paywall) paywall.classList.add('show'); t('paywall_view', {}); }
  function closePaywall() { if (paywall) paywall.classList.remove('show'); }
  if (paywall) {
    document.getElementById('pwClose').addEventListener('click', closePaywall);
    paywall.addEventListener('click', function (e) { if (e.target === paywall) closePaywall(); });
    document.getElementById('pwPay').addEventListener('click', async function () {
      var pwStatus = document.getElementById('pwStatus');
      pwStatus.textContent = '正在打开收银台…';
      t('buy_click', {});
      try {
        var r = await fetch('/api/checkout');
        var j = await r.json();
        if (j.checkout_url) { savePending(); window.location.href = j.checkout_url; }
        else { pwStatus.textContent = '收银台暂不可用：' + (j.error || 'unknown'); t('checkout_error', { error: String(j.error || 'unknown').slice(0, 60) }); }
      } catch (e) {
        pwStatus.textContent = '网络错误，请重试'; t('checkout_error', { error: 'network' });
      }
    });
  }

  async function refreshUnlock() {
    var tk = getToken();
    if (!tk) { document.body.classList.remove('unlocked'); return; }
    document.body.classList.add('unlocked'); // 乐观解锁：本地有 token 先视为已解锁，防网络抖动误锁
    try {
      var r = await fetch('/api/unlock', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: tk }) });
      var j = await r.json();
      if (!j.valid) { localStorage.removeItem(TOKEN_KEY); document.body.classList.remove('unlocked'); }
      else if (lastResult) { render(lastResult); } // 支付回来后把预览刷新为已解锁态
      t(j.valid ? 'unlock_ok' : 'unlock_fail', {});
    } catch (e) { /* 网络抖动保留乐观解锁 */ }
  }

  /* ---------- 生成 ---------- */
  btn.addEventListener('click', async function () {
    var text = info.value.trim();
    if (text.length < 5) { setStatus('请先填写产品信息', true); return; }
    btn.disabled = true; setStatus('生成中…', false);
    // 生成耗时约 10-25 秒，用计时器给出进度反馈，避免用户以为卡死
    var t0 = Date.now();
    var timer = setInterval(function () {
      var s = Math.round((Date.now() - t0) / 1000);
      setStatus('AI 正在撰写 ' + platform.value + ' ' + lang.value + ' 文案… 已用 ' + s + ' 秒（通常需 20-40 秒，请不要关闭页面）', false);
    }, 1000);
    t('generate_click', { platform: platform.value, lang: lang.value });
    try {
      var r = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ info: text, platform: platform.value, lang: lang.value })
      });
      var j = await r.json();
      if (!r.ok) throw new Error(j.error || '生成失败');
      lastResult = j;
      render(j);
      setStatus(isUnlocked() ? '生成完成。' : '已生成预览（标题 + 前 2 条卖点）。支付后解锁完整结果与一键复制。', false);
      t('generate_ok', {});
    } catch (e) {
      setStatus(e.message || '生成失败，请重试', true);
      t('error', { where: 'generate', msg: e.message });
    } finally {
      clearInterval(timer);
      btn.disabled = false;
    }
  });

  // 中文对照：仅供卖家核对阅读，不进入复制内容
  function zhNode(text) {
    var d = document.createElement('div');
    d.className = 'zh';
    d.textContent = text;
    return d;
  }

  var zhLoading = false;
  async function loadZh(j) {
    if (!j || j.zh || !isUnlocked() || zhLoading) return;
    zhLoading = true;
    try {
      var texts = [j.title].concat(j.bullets || [], [j.description || '']);
      var r = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texts: texts, token: getToken() })
      });
      if (!r.ok) return;
      var d = await r.json();
      if (!d.zh || !d.zh.length || lastResult !== j) return;
      var n = (j.bullets || []).length;
      j.zh = { title: d.zh[0] || '', bullets: d.zh.slice(1, 1 + n), description: d.zh[1 + n] || '' };
      render(j);
      t('zh_loaded', {});
    } catch (e) {
      /* 中文对照失败不影响主结果 */
    } finally {
      zhLoading = false;
    }
  }

  function render(j) {
    result.hidden = false;
    var unlocked = isUnlocked();

    document.getElementById('title').textContent = j.title || '';

    var ul = document.getElementById('bullets'); ul.innerHTML = '';
    var bullets = (j.bullets || []);
    var showN = unlocked ? bullets.length : Math.min(2, bullets.length);
    for (var i = 0; i < showN; i++) {
      var li = document.createElement('li');
      li.textContent = bullets[i];
      if (unlocked && j.zh && j.zh.bullets && j.zh.bullets[i]) li.appendChild(zhNode(j.zh.bullets[i]));
      ul.appendChild(li);
    }
    if (!unlocked && bullets.length > 2) {
      var more = document.createElement('li');
      more.className = 'muted';
      more.textContent = '（还有 ' + (bullets.length - 2) + ' 条卖点，支付后解锁）';
      ul.appendChild(more);
    }

    var desc = j.description || '';
    var descEl = document.getElementById('desc');
    descEl.textContent = unlocked ? desc : (desc.length > 80 ? desc.slice(0, 80) + '…' : desc);
    if (unlocked && j.zh && j.zh.description) descEl.appendChild(zhNode(j.zh.description));
    document.getElementById('keywords').textContent = unlocked ? (j.keywords || []).join(', ') : '（支付后解锁）';

    var titleEl = document.getElementById('title');
    if (unlocked && j.zh && j.zh.title) titleEl.appendChild(zhNode(j.zh.title));

    var lock = document.getElementById('lockNote');
    if (lock) lock.hidden = unlocked;

    document.querySelectorAll('.copy').forEach(function (b) {
      b.textContent = unlocked ? '复制' : '🔒解锁复制';
    });

    if (unlocked) loadZh(j); // 已解锁：后台补中文对照，不阻塞英文结果展示
  }

  /* ---------- 复制（含 iOS 兼容） ---------- */
  document.querySelectorAll('.copy').forEach(function (b) {
    b.addEventListener('click', function () {
      if (!isUnlocked()) { openPaywall(); return; }
      var el = document.getElementById(b.getAttribute('data-target'));
      // 复制时剔除中文对照，只带走纯目标语言内容
      var clone = el.cloneNode(true);
      Array.prototype.forEach.call(clone.querySelectorAll('.zh'), function (n) { n.parentNode.removeChild(n); });
      var text = clone.innerText || '';
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () { b.textContent = '已复制'; setTimeout(function () { b.textContent = '复制'; }, 1500); });
      } else {
        var ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta);
        ta.select(); try { document.execCommand('copy'); b.textContent = '已复制'; } catch (e) {}
        document.body.removeChild(ta); setTimeout(function () { b.textContent = '复制'; }, 1500);
      }
    });
  });

  var unlockBtn = document.getElementById('unlockBtn');
  if (unlockBtn) unlockBtn.addEventListener('click', openPaywall);

  /* ---------- 解锁码 / 换设备恢复 ---------- */
  var rcModal = document.getElementById('recoverModal');
  function openRecover() {
    var tk = getToken();
    document.getElementById('rcMine').hidden = !tk;
    document.getElementById('rcCode').value = tk;
    document.getElementById('rcInput').value = '';
    document.getElementById('rcStatus').textContent = '';
    rcModal.classList.add('show');
    t('recover_view', {});
  }
  if (rcModal) {
    document.getElementById('recoverLink').addEventListener('click', function (e) { e.preventDefault(); openRecover(); });
    document.getElementById('rcClose').addEventListener('click', function () { rcModal.classList.remove('show'); });
    rcModal.addEventListener('click', function (e) { if (e.target === rcModal) rcModal.classList.remove('show'); });

    document.getElementById('rcCopy').addEventListener('click', function () {
      var self = this;
      var v = getToken();
      if (!v) return;
      function done() { self.textContent = '已复制'; setTimeout(function () { self.textContent = '复制'; }, 1500); }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(v).then(done, function () {
          var ta = document.getElementById('rcCode'); ta.select();
          try { document.execCommand('copy'); done(); } catch (err) {}
        });
      } else {
        var ta = document.getElementById('rcCode'); ta.select();
        try { document.execCommand('copy'); done(); } catch (err) {}
      }
    });

    // 邮箱自助找回已下线：同一 Creem 账号下有多个产品，仅凭「是本账号客户」无法证明买的是本产品，
    // 会被买其他产品的用户白拿。恢复方式保留为「解锁码粘贴」+ 人工客服。
    // 正确解法见 HANDOVER.md 第九节：Creem Webhook 落库后按订单核验。

    document.getElementById('rcBtn').addEventListener('click', async function () {
      var st = document.getElementById('rcStatus');
      var v = document.getElementById('rcInput').value.trim();
      if (!v || v.indexOf('.') < 0) { st.textContent = '请粘贴完整的解锁码'; return; }
      st.textContent = '正在校验…';
      try {
        var r = await fetch('/api/unlock', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: v }) });
        var j = await r.json();
        if (!j.valid) { st.textContent = '解锁码无效或已过期，请联系 support@skuwrite.com'; t('recover_fail', {}); return; }
        localStorage.setItem(TOKEN_KEY, v);
        document.body.classList.add('unlocked');
        document.getElementById('rcMine').hidden = false;
        document.getElementById('rcCode').value = v;
        st.textContent = '已恢复解锁，正在刷新…';
        t('recover_ok', {});
        setTimeout(function () { location.reload(); }, 800);
      } catch (e) {
        st.textContent = '网络错误，请重试';
      }
    });
  }

  /* ---------- 初始化 ---------- */
  if (getToken()) document.body.classList.add('unlocked');
  refreshUnlock();
  if (new URLSearchParams(location.search).get('paid') === '1') {
    if (restorePending()) {
      setStatus('支付成功，已解锁全部内容！你的结果已恢复，可直接复制使用。解锁码已保存在本浏览器，建议在页面底部「解锁码 / 恢复购买」中复制备份。', false);
    } else {
      setStatus('支付成功，已解锁全部功能！解锁码已保存在本浏览器，建议在页面底部「解锁码 / 恢复购买」中复制备份（长期有效，不限次数）。', false);
    }
    try { sessionStorage.removeItem(PENDING_KEY); } catch (e) {}
    t('purchase_return', {});
    try { history.replaceState({}, '', location.pathname); } catch (e) {}
  } else if (isUnlocked() && restorePending()) {
    // 已解锁用户中途返回（如从收银台直接退出），同样恢复上次结果
    setStatus('已恢复上次生成的内容。', false);
  }
})();
