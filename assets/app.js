/* FA Member Club — หน้าสมาชิก */
(function () {
  'use strict';
  var F = window.FA, el = F.el, esc = F.esc, show = F.show, say = F.say;

  var me = null;

  // ---------------- สลับหน้าจอ ----------------
  var SCREENS = ['scLogin', 'scSelf', 'scApp'];
  function screen(id) {
    SCREENS.forEach(function (s) { show(el(s), s === id); });
    show(el('waWho'), id === 'scApp');
    window.scrollTo(0, 0);
  }

  // ---------------- กฎรหัสผ่าน ----------------
  function passProblem(p) {
    if (/\s/.test(p))              return 'รหัสผ่านห้ามมีเว้นวรรค';
    if (p.length < 8)              return 'รหัสผ่านต้องยาว 8 ตัวขึ้นไป';
    if (!/^[A-Za-z0-9]+$/.test(p)) return 'รหัสผ่านใช้ได้แค่ตัวอักษรอังกฤษและตัวเลข';
    // ไม่บังคับตัวอักษรอังกฤษ -> ใส่ตัวเลขล้วนได้ (ต้องตรงกับ checkPassRule_ ใน Code.gs)
    if (!/[0-9]/.test(p))          return 'ต้องมีตัวเลขอย่างน้อย 1 ตัว';
    return '';
  }

  function paintRules() {
    var p = el('inNew1').value;
    var pass = {
      len: p.length >= 8,
      num: /[0-9]/.test(p),
      sp:  p.length > 0 && /^[A-Za-z0-9]+$/.test(p)
    };
    el('ruleList').querySelectorAll('li').forEach(function (li) {
      li.classList.toggle('is-ok', !!pass[li.dataset.rule]);
    });
  }

  // ---------------- วาดโปรไฟล์ ----------------
  function paintAvatar(img, member, big) {
    if (member.pic) {
      img.src = member.pic;
      img.classList.remove('avatar--empty');
      img.alt = member.name;
      img.onerror = function () { img.onerror = null; fallbackAvatar(img, member, big); };
    } else {
      fallbackAvatar(img, member, big);
    }
  }
  function fallbackAvatar(img, member, big) {
    // ไม่มีรูป -> วาดตัวอักษรย่อเป็นรูปแทน (ไม่ต้องโหลดอะไรเพิ่ม)
    var size = big ? 208 : 88;
    var cv = document.createElement('canvas');
    cv.width = cv.height = size;
    var cx = cv.getContext('2d');
    cx.fillStyle = '#fdf8ec';
    cx.fillRect(0, 0, size, size);
    cx.fillStyle = '#b08d3f';
    cx.font = '600 ' + Math.round(size * 0.34) + 'px Sarabun, sans-serif';
    cx.textAlign = 'center';
    cx.textBaseline = 'middle';
    cx.fillText(F.initials(member.name), size / 2, size / 2 + size * 0.02);
    img.src = cv.toDataURL('image/png');
  }

  function paintMe() {
    el('waName').textContent = me.name;
    el('waMeta').textContent = me.phone || me.old_user;
    paintAvatar(el('waPic'), me, false);

    el('meName').textContent = me.name;
    el('mePhone').textContent = me.phone ? 'เบอร์ ' + me.phone : 'ชื่อเดิม ' + me.old_user;
    paintAvatar(el('mePic'), me, true);

    var role = el('meRole');
    role.textContent = me.status === 'Admin' ? 'แอดมิน' : 'สมาชิก';
    role.className = 'badge' + (me.status === 'Admin' ? '' : ' badge--ok');
    show(el('lnAdmin'), me.status === 'Admin');
  }

  // ---------------- ผลงานของฉัน ----------------
  var FLAT = [];   // รูปทุกใบเรียงต่อกัน ใช้เลื่อนดูซ้าย-ขวาตอนเปิดเต็มจอ

  function paintWork(events) {
    var box = el('workList');
    FLAT = [];

    if (!events || !events.length) {
      box.innerHTML = '<div class="card"><div class="empty">' +
        'ยังไม่มีผลงานในระบบครับ<br><span class="field-note">' +
        'เมื่อแอดมินอัปโหลดรูปกิจกรรมให้คุณ จะขึ้นที่หน้านี้</span></div></div>';
      return;
    }

    box.innerHTML = events.map(function (ev) {
      var cells = ev.files.map(function (f) {
        var idx = FLAT.length;
        FLAT.push({ f: f, event: ev.event_name });
        return shotHtml(f, idx);
      }).join('');

      return '<div class="card event">' +
        '<div class="event__head">' +
          '<span class="event__name">' + esc(ev.event_name) + '</span>' +
          (ev.event_date ? '<span class="event__meta">' + esc(ev.event_date) + '</span>' : '') +
          '<span class="event__meta">' + ev.files.length + ' ไฟล์</span>' +
        '</div>' +
        '<div class="grid">' + cells + '</div>' +
      '</div>';
    }).join('');
  }

  function loadWork() {
    var box = el('workList');
    box.innerHTML = '<div class="empty">กำลังโหลดผลงาน...</div>';
    return F.auth('myFiles').then(function (r) {
      paintWork(r.events);
    }).catch(function (err) {
      box.innerHTML = '<div class="card"><div class="note note--err">' + esc(err.message) + '</div></div>';
    });
  }

  function shotHtml(f, idx) {
    // รูปโหลดตรงจาก Drive ไม่ผ่านหลังบ้าน -> เร็วและไม่กินโควต้า
    var thumb = f.thumb || '';
    return '<div class="shot">' +
      (thumb
        ? '<img loading="lazy" src="' + esc(thumb) + '" alt="" data-open="' + idx +
          '" data-big="' + esc(F.thumbUrl(f.file_id, 900)) + '" style="cursor:zoom-in">'
        : '<img alt="" src="data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACwAAAAAAQABAAACAkQBADs=">') +
      '<div class="shot__act">' +
        '<button type="button" data-open="' + idx + '">ดูเต็มจอ</button>' +
        '<a href="' + esc(F.dlUrl(f.file_id, f.url)) + '" target="_blank" rel="noopener">บันทึก</a>' +
      '</div>' +
    '</div>';
  }

  // ---------------- ดูรูปเต็มจอ ----------------
  var lbAt = -1;

  /**
   * Drive ไม่ยอมส่งรูปย่อทุกขนาดเสมอไป (ขนาดใหญ่บางขนาดถูกปฏิเสธ)
   * จึงไล่ลองจากใหญ่ไปเล็ก ถ้าอันไหนโหลดไม่ได้ก็ขยับไปอันถัดไปเอง
   */
  // เริ่มที่ w1000 — พอมองออกชัดเจน ไม่ต้องใหญ่กว่านี้ โหลดเร็วและ Drive ยอมส่งง่ายกว่า
  function bigCandidates(f) {
    var id = f.file_id;
    if (!id) return [f.url];
    return [
      F.thumbUrl(id, 1000),
      F.thumbUrl(id, 800),
      'https://lh3.googleusercontent.com/d/' + id + '=w1000',
      F.thumbUrl(id, 400),
      'https://drive.google.com/uc?export=view&id=' + id
    ];
  }

  function lbLoad(list, n) {
    var img = el('lbImg');
    if (n >= list.length) {                       // ลองครบแล้วยังไม่ได้
      img.removeAttribute('src');
      el('lbNote').textContent = 'แสดงรูปตัวอย่างไม่ได้ แต่กดปุ่มบันทึกด้านล่างเพื่อโหลดไฟล์ได้ปกติ';
      show(el('lbNote'), true);
      return;
    }
    el('lbNote').textContent = 'กำลังโหลดรูป...';
    show(el('lbNote'), true);
    img.onload  = function () { show(el('lbNote'), false); };
    img.onerror = function () { lbLoad(list, n + 1); };
    img.src = list[n];
  }

  function lbOpen(i) {
    if (i < 0 || i >= FLAT.length) return;
    lbAt = i;
    var it = FLAT[i];
    el('lbInfo').textContent = it.event + '  ·  รูปที่ ' + (i + 1) + ' จาก ' + FLAT.length;
    el('lbDl').href = F.dlUrl(it.f.file_id, it.f.url);
    el('lbPrev').disabled = (i === 0);
    el('lbNext').disabled = (i === FLAT.length - 1);
    show(el('lb'), true);
    hideZoom();
    document.body.style.overflow = 'hidden';
    lbLoad(bigCandidates(it.f), 0);
  }

  function lbClose() {
    show(el('lb'), false);
    var img = el('lbImg');
    img.onload = img.onerror = null;
    img.removeAttribute('src');
    document.body.style.overflow = '';
  }

  // ---------------- เมาส์ชี้ดูรูปโต (คอมเท่านั้น) ----------------
  var canHover = window.matchMedia && window.matchMedia('(hover: hover)').matches;

  function showZoom(src) {
    var z = el('zoom');
    z.querySelector('img').src = src;
    show(z, true);
  }
  function hideZoom() { show(el('zoom'), false); }

  function moveZoom(e) {
    var z = el('zoom');
    if (z.classList.contains('hide')) return;
    var w = z.offsetWidth || 316, h = z.offsetHeight || 316;
    var x = e.clientX + 18, y = e.clientY - h / 2;
    // ถ้าล้นขวา ให้ไปอยู่ซ้ายของเมาส์ แล้วบีบให้อยู่ในจอเสมอ (หน้าต่างแคบก็ไม่หลุด)
    if (x + w > window.innerWidth - 8) x = e.clientX - w - 18;
    x = Math.max(8, Math.min(x, window.innerWidth - w - 8));
    y = Math.max(8, Math.min(y, window.innerHeight - h - 8));
    z.style.left = x + 'px';
    z.style.top  = y + 'px';
  }

  // ---------------- เข้าสู่ระบบ ----------------
  function doLogin() {
    var user = el('inUser').value.replace(/[^0-9]/g, '');
    var pass = el('inPass').value;
    say(el('msLogin'), '', '');
    if (!user || !pass) { say(el('msLogin'), 'err', 'กรอกให้ครบทั้ง 2 ช่องก่อนนะครับ'); return; }

    F.busy(true, ['กำลังตรวจสอบ...', 'เกือบเสร็จแล้ว...']);
    F.call('login', { user: user, pass: pass }).then(function (r) {
      F.setToken(r.token);
      me = r.member;
      el('inPass').value = '';
      paintMe(); screen('scApp'); loadWork();
    }).catch(function (err) {
      say(el('msLogin'), 'err', err.message);
    }).then(function () { F.busy(false); });
  }

  // ---------------- ตั้งรหัสผ่านเอง (ไม่ต้อง login ก่อน) ----------------
  // ใช้ได้เฉพาะบัญชีที่แอดมินเปิดสิทธิ์ไว้ ตั้งเสร็จระบบปิดสิทธิ์ทันที
  function goSelf(on) {
    screen(on ? 'scSelf' : 'scLogin');
    if (on) {
      ['inSelfPhone', 'inNew1', 'inNew2'].forEach(function (i) { el(i).value = ''; });
      say(el('msSelf'), '', '');
      paintRules();
      el('inSelfPhone').focus();
    } else {
      say(el('msLogin'), '', '');
    }
  }

  function doSelfSetup() {
    var phone = el('inSelfPhone').value.replace(/[^0-9]/g, '');
    var p1 = el('inNew1').value, p2 = el('inNew2').value;
    say(el('msSelf'), '', '');

    if (!/^0[0-9]{9}$/.test(phone)) { say(el('msSelf'), 'err', 'เบอร์โทรต้องเป็นเลข 10 หลัก เริ่มด้วย 0'); return; }
    var bad = passProblem(p1);
    if (bad)       { say(el('msSelf'), 'err', bad); return; }
    if (p1 !== p2) { say(el('msSelf'), 'err', 'รหัสผ่าน 2 ช่องไม่เหมือนกัน'); return; }

    F.busy(true, ['กำลังบันทึก...']);
    F.call('selfSetup', { phone: phone, password: p1 }).then(function (r) {
      F.setToken(r.token);
      me = r.member;
      ['inSelfPhone', 'inNew1', 'inNew2'].forEach(function (i) { el(i).value = ''; });
      paintMe(); screen('scApp'); loadWork();
    }).catch(function (err) {
      say(el('msSelf'), 'err', err.message);
    }).then(function () { F.busy(false); });
  }

  // ---------------- ป็อบอัพเปลี่ยนรหัส ----------------
  function openPass(on) {
    show(el('mdPass'), on);
    if (on) {
      ['inOld', 'inCh1', 'inCh2'].forEach(function (i) { el(i).value = ''; });
      say(el('msPass'), '', '');
      say(el('msChange'), '', '');
      el('inOld').focus();
    }
  }

  function doChange() {
    var old = el('inOld').value, p1 = el('inCh1').value, p2 = el('inCh2').value;
    say(el('msPass'), '', '');
    if (!old)      { say(el('msPass'), 'err', 'กรอกรหัสผ่านเดิมก่อนนะครับ'); return; }
    var bad = passProblem(p1);
    if (bad)       { say(el('msPass'), 'err', bad); return; }
    if (p1 !== p2) { say(el('msPass'), 'err', 'รหัสผ่านใหม่ 2 ช่องไม่เหมือนกัน'); return; }

    F.busy(true, ['กำลังบันทึก...']);
    F.auth('changePassword', { oldPassword: old, newPassword: p1 }).then(function (r) {
      openPass(false);
      say(el('msChange'), 'ok', r.msg);
    }).catch(function (err) {
      say(el('msPass'), 'err', err.message);
    }).then(function () { F.busy(false); });
  }

  // ---------------- เปลี่ยนรูปโปรไฟล์ ----------------
  function doPic(file) {
    say(el('msPic'), '', '');
    F.busy(true, ['กำลังย่อรูป...', 'กำลังอัปโหลด...', 'ใกล้เสร็จแล้ว...']);
    F.shrink(file, 800).then(function (img) {
      return F.auth('uploadProfile', img);
    }).then(function (r) {
      me.pic = r.pic; me.pic_id = r.pic_id;
      paintMe();
      say(el('msPic'), 'ok', r.msg);
    }).catch(function (err) {
      say(el('msPic'), 'err', err.message);
    }).then(function () {
      F.busy(false);
      el('filePic').value = '';
    });
  }

  // ---------------- ผูกปุ่ม ----------------
  function bind() {
    el('btLogin').onclick     = doLogin;
    el('btSelf').onclick      = doSelfSetup;
    el('btGoSelf').onclick    = function () { goSelf(true); };
    el('btBackLogin').onclick = function () { goSelf(false); };
    el('btChange').onclick    = doChange;

    el('inPass').onkeydown = function (e) { if (e.key === 'Enter') doLogin(); };
    el('inUser').onkeydown = function (e) { if (e.key === 'Enter') el('inPass').focus(); };
    el('inNew1').oninput   = paintRules;
    el('inNew2').onkeydown = function (e) { if (e.key === 'Enter') doSelfSetup(); };

    ['inUser', 'inSelfPhone'].forEach(function (id) {
      el(id).oninput = function () {
        this.value = this.value.replace(/[^0-9]/g, '').substring(0, 10);
      };
    });

    el('btPickPic').onclick = function () { el('filePic').click(); };
    el('filePic').onchange  = function () { if (this.files[0]) doPic(this.files[0]); };

    // ---- รูปผลงาน: กดดูเต็มจอ / เมาส์ชี้พรีวิว ----
    var list = el('workList');
    list.addEventListener('click', function (e) {
      var t = e.target.closest('[data-open]');
      if (t) lbOpen(Number(t.dataset.open));
    });
    if (canHover) {
      list.addEventListener('mouseover', function (e) {
        var img = e.target.closest('img[data-big]');
        if (img) { showZoom(img.dataset.big); moveZoom(e); }
      });
      list.addEventListener('mousemove', moveZoom);
      list.addEventListener('mouseout', function (e) {
        if (e.target.closest('img[data-big]')) hideZoom();
      });
      window.addEventListener('scroll', hideZoom, { passive: true });
    }

    el('lbX').onclick    = lbClose;
    el('lbPrev').onclick = function () { lbOpen(lbAt - 1); };
    el('lbNext').onclick = function () { lbOpen(lbAt + 1); };
    el('lb').onclick     = function (e) {
      if (e.target === el('lb') || e.target.classList.contains('lb__stage')) lbClose();
    };
    document.addEventListener('keydown', function (e) {
      if (el('lb').classList.contains('hide')) return;
      if (e.key === 'Escape')     lbClose();
      if (e.key === 'ArrowLeft')  lbOpen(lbAt - 1);
      if (e.key === 'ArrowRight') lbOpen(lbAt + 1);
    });

    el('btOpenPass').onclick  = function () { openPass(true); };
    el('btClosePass').onclick = function () { openPass(false); };
    el('inCh2').onkeydown     = function (e) { if (e.key === 'Enter') doChange(); };
    el('mdPass').onclick      = function (e) { if (e.target === el('mdPass')) openPass(false); };
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !el('mdPass').classList.contains('hide')) openPass(false);
    });

    el('btOut').onclick = function () {
      F.setToken('');
      me = null;
      el('inUser').value = ''; el('inPass').value = '';
      screen('scLogin');
    };

    document.querySelectorAll('.tab').forEach(function (t) {
      t.onclick = function () {
        document.querySelectorAll('.tab').forEach(function (x) { x.classList.remove('is-on'); });
        t.classList.add('is-on');
        show(el('paneWork'), t.dataset.pane === 'paneWork');
        show(el('paneMe'),   t.dataset.pane === 'paneMe');
        window.scrollTo(0, 0);
      };
    });
  }

  // ---------------- ติดตั้งเป็นแอป (PWA) ----------------
  var deferredPrompt = null;

  function isStandalone() {
    return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
           window.navigator.standalone === true;
  }
  function isIos() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
           (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }
  function isSafari() {
    var ua = navigator.userAgent;
    return /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|Line|FBAN|FBAV/.test(ua);
  }
  function dismissed() {
    try { return localStorage.getItem('fa_ins_off') === '1'; } catch (e) { return false; }
  }

  function setupInstall() {
    // ลงทะเบียน service worker (ต้องมีเพื่อให้ติดตั้งได้ และเปิดครั้งต่อไปไวขึ้น)
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(function () { /* ไม่ได้ก็ไม่เป็นไร */ });
    }

    // ติดตั้งอยู่แล้ว หรือกดปิดไปแล้ว -> ไม่ต้องกวน
    if (isStandalone() || dismissed()) return;

    // Android / Chrome : เบราว์เซอร์จะบอกเองว่าติดตั้งได้
    window.addEventListener('beforeinstallprompt', function (e) {
      e.preventDefault();
      deferredPrompt = e;
      show(el('insBar'), true);
    });

    // iOS : Apple ไม่ยอมให้เว็บเด้งปุ่มติดตั้ง -> แนะนำขั้นตอนให้แทน
    if (isIos() && isSafari()) {
      setTimeout(function () { show(el('insBar'), true); }, 1200);
    }

    window.addEventListener('appinstalled', function () {
      show(el('insBar'), false);
      deferredPrompt = null;
    });
  }

  function doInstall() {
    if (deferredPrompt) {                 // Android / Chrome
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(function () {
        deferredPrompt = null;
        show(el('insBar'), false);
      });
    } else {                              // iOS หรือเบราว์เซอร์ที่ไม่รองรับปุ่ม
      show(el('mdIos'), true);
    }
  }

  function bindInstall() {
    el('btInstall').onclick = doInstall;
    el('insClose').onclick  = function () {
      show(el('insBar'), false);
      try { localStorage.setItem('fa_ins_off', '1'); } catch (e) {}
    };
    el('iosClose').onclick = function () { show(el('mdIos'), false); };
    el('mdIos').onclick    = function (e) { if (e.target === el('mdIos')) show(el('mdIos'), false); };
  }

  // ---------------- เริ่มทำงาน ----------------
  function start() {
    bind();
    bindInstall();
    setupInstall();
    if (!F.getToken()) { screen('scLogin'); return; }

    // มี token อยู่แล้ว -> เข้าใช้งานต่อได้เลยไม่ต้อง login ซ้ำ
    // ใช้ bootstrap เพื่อขอข้อมูลตัวเอง + รายการผลงาน ในรอบเดียว
    F.busy(true, ['กำลังเข้าสู่ระบบ...', 'กำลังโหลดผลงาน...']);
    F.auth('bootstrap').catch(function (err) {
      // ถ้าหลังบ้านยังไม่ได้ deploy รุ่นใหม่ ให้ถอยไปใช้วิธีเดิม 2 รอบ ไม่ให้เว็บพัง
      if (String(err.message).indexOf('ไม่รู้จักคำสั่ง') < 0) throw err;
      return F.auth('me').then(function (m) {
        if (m.member.must !== 'FALSE') return m;
        return F.auth('myFiles').then(function (w) {
          return { member: m.member, events: w.events };
        });
      });
    }).then(function (r) {
      me = r.member;
      // must = TRUE/RESET แปลว่าแอดมินเปิดสิทธิ์ให้ตั้งรหัสใหม่ -> token เดิมใช้ต่อไม่ได้
      if (me.must === 'TRUE' || me.must === 'RESET') { F.setToken(''); goSelf(true); }
      else { paintMe(); screen('scApp'); paintWork(r.events || []); }
    }).catch(function () {
      F.setToken('');
      screen('scLogin');
    }).then(function () { F.busy(false); });
  }

  document.addEventListener('DOMContentLoaded', start);
})();
