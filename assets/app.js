/* FA Member Club — หน้าสมาชิก */
(function () {
  'use strict';
  var F = window.FA, el = F.el, esc = F.esc, show = F.show, say = F.say;

  var me = null;

  // ---------------- สลับหน้าจอ ----------------
  var SCREENS = ['scLogin', 'scSetup', 'scNewPass', 'scApp'];
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
    if (!/[A-Za-z]/.test(p))       return 'ต้องมีตัวอักษรอังกฤษอย่างน้อย 1 ตัว';
    if (!/[0-9]/.test(p))          return 'ต้องมีตัวเลขอย่างน้อย 1 ตัว';
    return '';
  }

  function paintRules() {
    var p = el('inNew1').value;
    var pass = {
      len: p.length >= 8,
      abc: /[A-Za-z]/.test(p),
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
  function loadWork() {
    var box = el('workList');
    box.innerHTML = '<div class="empty">กำลังโหลดผลงาน...</div>';

    F.auth('myFiles').then(function (r) {
      if (!r.events.length) {
        box.innerHTML = '<div class="card"><div class="empty">' +
          'ยังไม่มีผลงานในระบบครับ<br><span class="field-note">' +
          'เมื่อแอดมินอัปโหลดรูปกิจกรรมให้คุณ จะขึ้นที่หน้านี้</span></div></div>';
        return;
      }
      box.innerHTML = r.events.map(function (ev) {
        return '<div class="card event">' +
          '<div class="event__head">' +
            '<span class="event__name">' + esc(ev.event_name) + '</span>' +
            (ev.event_date ? '<span class="event__meta">' + esc(ev.event_date) + '</span>' : '') +
            '<span class="event__meta">' + ev.files.length + ' ไฟล์</span>' +
          '</div>' +
          '<div class="grid">' + ev.files.map(shotHtml).join('') + '</div>' +
        '</div>';
      }).join('');
    }).catch(function (err) {
      box.innerHTML = '<div class="card"><div class="note note--err">' + esc(err.message) + '</div></div>';
    });
  }

  function shotHtml(f) {
    // รูปโหลดตรงจาก Drive ไม่ผ่านหลังบ้าน -> เร็วและไม่กินโควต้า
    var thumb = f.thumb || '';
    return '<div class="shot">' +
      (thumb
        ? '<img loading="lazy" src="' + esc(thumb) + '" alt="">'
        : '<img alt="" src="data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACwAAAAAAQABAAACAkQBADs=">') +
      '<div class="shot__act">' +
        '<a href="' + esc(F.viewUrl(f.file_id, f.url)) + '" target="_blank" rel="noopener">ดู</a>' +
        '<a href="' + esc(F.dlUrl(f.file_id, f.url)) + '" target="_blank" rel="noopener">บันทึก</a>' +
      '</div>' +
    '</div>';
  }

  // ---------------- เข้าสู่ระบบ ----------------
  function doLogin() {
    var user = el('inUser').value.trim();
    var pass = el('inPass').value;
    say(el('msLogin'), '', '');
    if (!user || !pass) { say(el('msLogin'), 'err', 'กรอกให้ครบทั้ง 2 ช่องก่อนนะครับ'); return; }

    F.busy(true, ['กำลังตรวจสอบ...', 'เกือบเสร็จแล้ว...']);
    F.call('login', { user: user, pass: pass }).then(function (r) {
      F.setToken(r.token);
      me = r.member;
      el('inPass').value = '';
      if (r.needSetup)        { screen('scSetup'); }
      else if (r.needNewPass) { screen('scNewPass'); }
      else                    { paintMe(); screen('scApp'); loadWork(); }
    }).catch(function (err) {
      say(el('msLogin'), 'err', err.message);
    }).then(function () { F.busy(false); });
  }

  // ---------------- ตั้งค่าครั้งแรก ----------------
  function doSetup() {
    var phone = el('inPhone').value.replace(/[^0-9]/g, '');
    var p1 = el('inNew1').value, p2 = el('inNew2').value;
    say(el('msSetup'), '', '');

    if (!/^0[0-9]{9}$/.test(phone)) { say(el('msSetup'), 'err', 'เบอร์โทรต้องเป็นเลข 10 หลัก เริ่มด้วย 0'); return; }
    var bad = passProblem(p1);
    if (bad)        { say(el('msSetup'), 'err', bad); return; }
    if (p1 !== p2)  { say(el('msSetup'), 'err', 'รหัสผ่าน 2 ช่องไม่เหมือนกัน'); return; }

    F.busy(true, ['กำลังบันทึก...']);
    F.auth('firstSetup', { phone: phone, password: p1 }).then(function (r) {
      me = r.member;
      paintMe(); screen('scApp'); loadWork();
    }).catch(function (err) {
      say(el('msSetup'), 'err', err.message);
    }).then(function () { F.busy(false); });
  }

  // ---------------- ตั้งรหัสใหม่หลังถูกรีเซ็ต ----------------
  function doNewPass() {
    var p1 = el('inRs1').value, p2 = el('inRs2').value;
    say(el('msNewPass'), '', '');
    var bad = passProblem(p1);
    if (bad)       { say(el('msNewPass'), 'err', bad); return; }
    if (p1 !== p2) { say(el('msNewPass'), 'err', 'รหัสผ่าน 2 ช่องไม่เหมือนกัน'); return; }

    F.busy(true, ['กำลังบันทึก...']);
    F.auth('changePassword', { newPassword: p1 }).then(function () {
      return F.auth('me');
    }).then(function (r) {
      me = r.member;
      paintMe(); screen('scApp'); loadWork();
    }).catch(function (err) {
      say(el('msNewPass'), 'err', err.message);
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
    el('btLogin').onclick   = doLogin;
    el('btSetup').onclick   = doSetup;
    el('btNewPass').onclick = doNewPass;
    el('btChange').onclick  = doChange;

    el('inPass').onkeydown = function (e) { if (e.key === 'Enter') doLogin(); };
    el('inUser').onkeydown = function (e) { if (e.key === 'Enter') el('inPass').focus(); };
    el('inNew1').oninput   = paintRules;

    el('inPhone').oninput = function () {
      this.value = this.value.replace(/[^0-9]/g, '').substring(0, 10);
    };

    el('btPickPic').onclick = function () { el('filePic').click(); };
    el('filePic').onchange  = function () { if (this.files[0]) doPic(this.files[0]); };

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

  // ---------------- เริ่มทำงาน ----------------
  function start() {
    bind();
    if (!F.getToken()) { screen('scLogin'); return; }

    // มี token อยู่แล้ว -> เข้าใช้งานต่อได้เลยไม่ต้อง login ซ้ำ
    F.busy(true, ['กำลังเข้าสู่ระบบ...']);
    F.auth('me').then(function (r) {
      me = r.member;
      if (me.must === 'TRUE')       { screen('scSetup'); }
      else if (me.must === 'RESET') { screen('scNewPass'); }
      else                          { paintMe(); screen('scApp'); loadWork(); }
    }).catch(function () {
      F.setToken('');
      screen('scLogin');
    }).then(function () { F.busy(false); });
  }

  document.addEventListener('DOMContentLoaded', start);
})();
