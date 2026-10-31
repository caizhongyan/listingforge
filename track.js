// 轻量埋点（无 cookie）：Vercel Runtime Logs + Web Analytics 自定义事件
(function () {
  window.pp = {
    track: function (event, data) {
      try {
        // 1) 写 Vercel 日志（/api/track）
        fetch('/api/track', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event: event, data: data || {} }),
          keepalive: true
        }).catch(function () {});
        // 2) Vercel Web Analytics 自定义事件
        if (window.va && typeof window.va === 'function') {
          window.va('event', { name: event, data: data || {} });
        }
      } catch (e) {}
    }
  };
})();
