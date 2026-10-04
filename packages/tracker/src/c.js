// Copper Analytics tracker. No cookies, no storage writes, one beacon per pageview.
;(() => {
  var w = window
  var d = document
  var l = w.location
  var s = d.currentScript
  if (!s) return
  var site = s.getAttribute('data-site')
  var api = s.getAttribute('data-api') || w.__COPPER_ENDPOINT__ || `${new URL(s.src).origin}/api/e`
  var last

  function send() {
    try {
      if (w.localStorage.getItem('copper_ignore')) return
    } catch (_) {}
    if (d.querySelector('[data-copper-ignore]')) return
    if (
      !s.hasAttribute('data-dev') &&
      (/^(localhost|127\.|\[::1])/.test(l.hostname) || l.protocol === 'file:')
    )
      return
    if (last === l.href) return
    var body = JSON.stringify({ s: site, u: l.href, r: last || d.referrer, w: w.innerWidth })
    last = l.href
    if (navigator.sendBeacon) navigator.sendBeacon(api, body)
    else fetch(api, { method: 'POST', body: body, keepalive: true })
  }

  var push = history.pushState
  if (push) {
    history.pushState = function (...args) {
      push.apply(this, args)
      send()
    }
    w.addEventListener('popstate', send)
  }
  send()
})()
