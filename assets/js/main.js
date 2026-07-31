/* K2 PATTAYA — 共通スクリプト
   1) モバイルの全画面メニュー
   2) 到達フェードイン（[data-rv] に .in を付ける）
   3) フッターの年
   4) お問い合わせフォーム（FORM_ENDPOINT が空のあいだは送信をブロックする）
*/
(function () {
  'use strict';

  // 送信先。旧サイト（k2pattaya.co.th/contact/）で使っていた Formspree のフォームをそのまま使う。
  // 受信先メールアドレスは Formspree 側の設定（ダッシュボード）で決まる。amano@k2pattaya.co.th に
  // 届くかは公開前に実送信で確認すること。空にすると送信をブロックする挙動に戻る。
  var FORM_ENDPOINT = 'https://formspree.io/f/mreezwen';

  var root = document.getElementById('k2root');

  /* 1) メニュー */
  var burger = document.querySelector('.burger');
  var menu = document.getElementById('fullmenu');
  if (burger && menu) {
    var setMenu = function (open) {
      menu.classList.toggle('open', open);
      menu.setAttribute('aria-hidden', open ? 'false' : 'true');
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
      burger.setAttribute('aria-label', open ? 'メニューを閉じる' : 'メニューを開く');
    };
    burger.addEventListener('click', function () {
      setMenu(burger.getAttribute('aria-expanded') !== 'true');
    });
    menu.querySelectorAll('a[href]').forEach(function (a) {
      a.addEventListener('click', function () { setMenu(false); });
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && burger.getAttribute('aria-expanded') === 'true') {
        setMenu(false);
        burger.focus();
      }
    });
  }

  /* 1.5) 稜線の描画演出
     ダッシュ長は**画面座標**で測る。SVGは preserveAspectRatio="none" で横に伸びるうえ
     vector-effect="non-scaling-stroke" のため、ユーザー座標の長さ（getTotalLength）や
     pathLength="1" を使うとダッシュが線の全長に届かず、**右端が途中で切れて見える**
     （2026-07-30にヒーロー・見出し帯の両方で発生）。 */
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var screenLength = function (path) {
    var ctm = path.getScreenCTM();
    var total = path.getTotalLength();
    if (!ctm || !total) return 0;
    var steps = 120, len = 0, prev = null;
    for (var i = 0; i <= steps; i++) {
      var p = path.getPointAtLength(total * i / steps);
      var x = ctm.a * p.x + ctm.c * p.y + ctm.e;
      var y = ctm.b * p.x + ctm.d * p.y + ctm.f;
      if (prev) len += Math.sqrt(Math.pow(x - prev[0], 2) + Math.pow(y - prev[1], 2));
      prev = [x, y];
    }
    return len;
  };

  if (!reduceMotion) {
    document.querySelectorAll('.ridge-a, .ridge-b, .bridge-a').forEach(function (path) {
      var len = screenLength(path);
      if (!len) return;
      var cs = getComputedStyle(path);
      var dur = cs.getPropertyValue('--draw-dur').trim() || '1.4s';
      var delay = cs.getPropertyValue('--draw-delay').trim() || '0s';
      var ease = cs.getPropertyValue('--ease').trim() || 'ease-in-out';
      path.style.strokeDasharray = len + 'px';
      path.style.strokeDashoffset = len + 'px';
      path.getBoundingClientRect(); // reflow
      path.style.transition = 'stroke-dashoffset ' + dur + ' ' + ease + ' ' + delay;
      path.style.strokeDashoffset = '0px';
      // 描き終わったらダッシュ指定を外す（以後のリサイズで線が欠けないように）
      var finish = function () {
        path.style.transition = '';
        path.style.strokeDasharray = '';
        path.style.strokeDashoffset = '';
      };
      path.addEventListener('transitionend', finish, { once: true });
      // トランジションが走らなかった場合（タブが裏で止まっていた等）でも線を必ず出す
      var ms = function (v) { return (parseFloat(v) || 0) * (v.indexOf('ms') > -1 ? 1 : 1000); };
      setTimeout(finish, ms(dur) + ms(delay) + 500);
    });
  }

  /* 2) 到達フェードイン
     位置の判定は getBoundingClientRect で行う。IntersectionObserver は環境によって
     コールバックが発火しないことがあり、その場合 .rv が opacity:0 のまま残って
     本文が見えなくなるため使わない（2026-07-30に実際に発生）。 */
  var targets = [].slice.call(document.querySelectorAll('[data-rv]'));
  var revealAll = function () {
    targets.forEach(function (el) { el.classList.add('in'); });
    targets = [];
  };

  if (reduceMotion) {
    revealAll();
  } else {
    if (root) root.setAttribute('data-anim', '1');
    var check = function () {
      if (!targets.length) return;
      var vh = window.innerHeight || document.documentElement.clientHeight;
      // 高さが取れない環境では隠したままにしない（本文が読めなくなるため）
      if (!vh) { revealAll(); return; }
      targets = targets.filter(function (el) {
        // 「画面に入った」だけでなく「すでに通り過ぎた」要素も表示する。
        // 上端の判定だけにしないと、リロードで途中位置が復元された時や
        // アンカーで飛んだ時に、上にある要素が隠れたまま残る。
        if (el.getBoundingClientRect().top < vh * 0.95) {
          el.classList.add('in');
          return false;
        }
        return true;
      });
    };
    var ticking = false;
    var onScroll = function () {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(function () { ticking = false; check(); });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    window.addEventListener('load', check);
    check();
    // フォント読み込み等で高さが変わる分を数秒だけ追う
    var t = 0;
    var timer = setInterval(function () {
      check();
      if (++t > 20 || !targets.length) clearInterval(timer);
    }, 300);
  }

  /* 3) 年 */
  var y = document.getElementById('year');
  if (y) y.textContent = String(new Date().getFullYear());

  /* 4) フォーム */
  var form = document.querySelector('.frm');
  if (form) {
    var stat = form.querySelector('.fstat');
    var show = function (msg) {
      if (!stat) return;
      stat.textContent = msg;
      stat.hidden = false;
    };
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!form.reportValidity()) return;
      if (!FORM_ENDPOINT) {
        show('送信できませんでした：送信先が未設定のため、フォームからの送信を停止しています。お手数ですが amano@k2pattaya.co.th へメールでご連絡ください。');
        return;
      }
      var btn = form.querySelector('.f-btn');
      if (btn) { btn.disabled = true; btn.textContent = '送信中...'; }
      fetch(FORM_ENDPOINT, {
        method: 'POST',
        body: new FormData(form),
        headers: { Accept: 'application/json' }
      }).then(function (res) {
        if (res.ok) {
          form.reset();
          show('お問い合わせを受け付けました。担当者よりご返信いたします。');
        } else {
          show('送信に失敗しました。お手数ですが amano@k2pattaya.co.th へメールでご連絡ください。');
        }
      }).catch(function () {
        show('送信に失敗しました。お手数ですが amano@k2pattaya.co.th へメールでご連絡ください。');
      }).then(function () {
        if (btn) { btn.disabled = false; btn.textContent = '送信する'; }
      });
    });
  }
})();
