/* FA Member Club — หน้าจัดการระบบ (แอดมิน) */
(function () {
  'use strict';
  var F = window.FA, el = F.el, esc = F.esc, show = F.show, say = F.say;

  var events = [];
  var picked = null;   // สมาชิกที่เลือกไว้เพื่ออัปโหลด
  var tempList = [];   // รหัสชั่วคราวที่เพิ่งออก — อยู่ในหน้าเว็บเท่านั้น ปิดหน้าแล้วหาย

  // ---------------- เข้าสู่ระบบ ----------------
  function doLogin() {
    var u = el('inUser').value.trim(), p = el('inPass').value;
    say(el('msGate'), '', '');
    if (!u || !p) { say(el('msGate'), 'err', 'กรอกให้ครบทั้ง 2 ช่อง'); return; }

    F.busy(true, ['กำลังตรวจสอบ...']);
    F.call('login', { user: u, pass: p }).then(function (r) {
      if (r.member.status !== 'Admin') throw new Error('บัญชีนี้ไม่ใช่แอดมิน');
      if (r.needSetup || r.needNewPass) {
        throw new Error('บัญชีนี้ยังต้องตั้งค่าครั้งแรก กรุณาทำที่หน้าสมาชิกก่อน');
      }
      F.setToken(r.token);
      el('inPass').value = '';
      enter();
    }).catch(function (err) {
      say(el('msGate'), 'err', err.message);
    }).then(function () { F.busy(false); });
  }

  function enter() {
    show(el('scGate'), false);
    show(el('scAdmin'), true);
    loadEvents();
  }

  // ---------------- กิจกรรม ----------------
  function loadEvents() {
    el('evList').innerHTML = '<div class="empty">กำลังโหลด...</div>';
    return F.auth('adminEvents').then(function (r) {
      events = r.events;
      paintEvents();
      paintEventOptions();
    }).catch(function (err) {
      el('evList').innerHTML = '<div class="note note--err">' + esc(err.message) + '</div>';
    });
  }

  function paintEvents() {
    if (!events.length) { el('evList').innerHTML = '<div class="empty">ยังไม่มีกิจกรรม</div>'; return; }
    el('evList').innerHTML = events.map(function (e) {
      return '<div class="row">' +
        '<div class="row__main">' +
          '<div class="row__title">' + esc(e.event_name) +
            (e.is_open ? '' : ' <span class="badge badge--wait">ปิด</span>') + '</div>' +
          '<div class="row__sub">' + esc(e.event_id) +
            (e.event_date ? ' · ' + esc(e.event_date) : '') +
            ' · ' + e.files + ' ไฟล์</div>' +
        '</div>' +
        '<button class="btn btn--plain btn--sm" data-rename="' + esc(e.event_id) + '">แก้ชื่อ</button>' +
        '<button class="btn btn--plain btn--sm" data-toggle="' + esc(e.event_id) + '">' +
          (e.is_open ? 'ปิด' : 'เปิด') + '</button>' +
      '</div>';
    }).join('');

    el('evList').querySelectorAll('[data-toggle]').forEach(function (b) {
      b.onclick = function () {
        var e = findEvent(b.dataset.toggle);
        updateEvent({ event_id: e.event_id, is_open: !e.is_open });
      };
    });
    el('evList').querySelectorAll('[data-rename]').forEach(function (b) {
      b.onclick = function () {
        var e = findEvent(b.dataset.rename);
        var name = prompt('ชื่อกิจกรรมใหม่', e.event_name);
        if (name && name.trim() && name.trim() !== e.event_name) {
          updateEvent({ event_id: e.event_id, event_name: name.trim() });
        }
      };
    });
  }

  function findEvent(id) {
    for (var i = 0; i < events.length; i++) if (events[i].event_id === id) return events[i];
    return null;
  }

  function updateEvent(patch) {
    F.busy(true, ['กำลังบันทึก...']);
    F.auth('adminUpdateEvent', patch)
      .then(loadEvents)
      .catch(function (err) { say(el('msEv'), 'err', err.message); })
      .then(function () { F.busy(false); });
  }

  function paintEventOptions() {
    var open = events.filter(function (e) { return e.is_open; });
    el('selEv').innerHTML = open.length
      ? open.map(function (e) {
          return '<option value="' + esc(e.event_id) + '">' +
                 esc(e.event_name) + ' (' + esc(e.event_id) + ')</option>';
        }).join('')
      : '<option value="">— ยังไม่มีกิจกรรมที่เปิด —</option>';
  }

  function doNewEvent() {
    var name = el('inEvName').value.trim();
    say(el('msEv'), '', '');
    if (!name) { say(el('msEv'), 'err', 'ใส่ชื่อกิจกรรมก่อนนะครับ'); return; }

    F.busy(true, ['กำลังสร้างกิจกรรม...', 'กำลังสร้างโฟลเดอร์ใน Drive...']);
    F.auth('adminCreateEvent', {
      event_name:  name,
      event_date:  el('inEvDate').value.trim(),
      description: el('inEvDesc').value.trim()
    }).then(function (r) {
      el('inEvName').value = ''; el('inEvDate').value = ''; el('inEvDesc').value = '';
      say(el('msEv'), 'ok', r.msg);
      return loadEvents();
    }).catch(function (err) {
      say(el('msEv'), 'err', err.message);
    }).then(function () { F.busy(false); });
  }

  // ---------------- ค้นหาสมาชิกเพื่ออัปโหลด ----------------

  /** ล้างคนที่เลือกไว้ให้หมด — ใช้ทั้งตอนค้นหาใหม่ และตอนกดปุ่ม "เลือกคนใหม่"
   *  สำคัญ: ถ้าไม่ล้าง คนที่เลือกไว้เดิมจะค้างอยู่ตอนค้นหาคนใหม่ -> อัปรูปผิดคนได้ */
  function clearPick() {
    picked = null;
    show(el('upBox'), false);
    el('upWho').textContent = '';
    el('fileUp').value = '';
    el('upDone').innerHTML = '';
    say(el('msUp'), '', '');
  }

  function doFind() {
    var q = el('inFind').value.trim();
    clearPick();                       // ค้นหาใหม่ = เริ่มเลือกคนใหม่เสมอ
    el('findList').innerHTML = '<div class="empty">กำลังค้นหา...</div>';

    F.auth('adminMembers', { q: q, limit: 40 }).then(function (r) {
      if (!r.members.length) { el('findList').innerHTML = '<div class="empty">ไม่พบสมาชิกที่ตรงกับคำค้นนี้</div>'; return; }
      el('findList').innerHTML = r.members.map(function (m) {
        return '<div class="row">' +
          '<div class="row__main">' +
            '<div class="row__title">' + esc(m.name) + '</div>' +
            '<div class="row__sub">' + esc(m.member_id) +
              (m.phone ? ' · ' + esc(m.phone) : ' · ยังไม่ตั้งเบอร์') + '</div>' +
          '</div>' +
          '<button class="btn btn--sm" data-pick="' + esc(m.member_id) +
            '" data-name="' + esc(m.name) + '">เลือก</button>' +
        '</div>';
      }).join('');

      el('findList').querySelectorAll('[data-pick]').forEach(function (b) {
        b.onclick = function () {
          picked = { member_id: b.dataset.pick, name: b.dataset.name };
          el('upWho').textContent = 'กำลังอัปโหลดให้ : ' + picked.name + ' (' + picked.member_id + ')';
          show(el('upBox'), true);
          el('upDone').innerHTML = '';
          say(el('msUp'), '', '');
          el('upBox').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        };
      });
    }).catch(function (err) {
      el('findList').innerHTML = '<div class="note note--err">' + esc(err.message) + '</div>';
    });
  }

  // ---------------- รหัสชั่วคราวให้สมาชิกเก่า ----------------

  /** ถ้าหลังบ้านยังไม่ได้ deploy รุ่นใหม่ จะตอบว่าไม่รู้จักคำสั่ง — บอกให้ชัดว่าต้องทำอะไร */
  function notDeployed(err) {
    return /ไม่รู้จักคำสั่ง|Unknown action|adminIssueTemp/i.test(err.message || '');
  }
  var NEED_DEPLOY = 'หลังบ้านยังไม่ได้อัปเดต — วาง Code.gs ใหม่ใน Apps Script แล้ว deploy เวอร์ชันใหม่ก่อนนะครับ';

  function loadTempStatus() {
    var box = el('tempStat');
    box.className = 'note note--info';
    box.textContent = 'กำลังตรวจ...';

    F.auth('adminIssueTemp', { preview: true }).then(function (r) {
      if (!r.pending) {
        box.className = 'note note--ok';
        box.textContent = '✅ เรียบร้อย — สมาชิกทุกคนตั้งรหัสของตัวเองแล้ว ไม่มีใครใช้นามสกุลเป็นรหัส';
        el('btTempIssue').disabled = true;
      } else {
        box.className = 'note note--err';
        box.textContent = '⚠️ มีสมาชิก ' + r.pending + ' คน (จากทั้งหมด ' + r.total + ' คน) ' +
                          'ที่ยังใช้นามสกุลตัวเองเป็นรหัสผ่าน — ยังไม่ควรแจกลิงก์จนกว่าจะออกรหัสชั่วคราวให้';
        el('btTempIssue').disabled = false;
      }
    }).catch(function (err) {
      box.className = 'note note--err';
      box.textContent = notDeployed(err) ? NEED_DEPLOY : err.message;
      el('btTempIssue').disabled = true;
    });
  }

  function doTempIssue() {
    if (!window.confirm(
      'ระบบจะสุ่มรหัสใหม่ให้สมาชิกที่ยังไม่เคยเข้าใช้ทุกคน\n\n' +
      '• รหัสเดิม (นามสกุล) จะใช้ไม่ได้ทันที\n' +
      '• รหัสชุดใหม่แสดงครั้งเดียว ต้องบันทึกไฟล์เก็บไว้\n' +
      '• ถ้าเคยออกรหัสไปแล้วและแจกไปบ้างแล้ว กดซ้ำจะทำให้รหัสที่แจกไปใช้ไม่ได้\n\n' +
      'ยืนยันหรือไม่?')) return;

    say(el('msTemp'), '', '');
    F.busy(true, ['กำลังออกรหัสให้สมาชิก...']);

    F.auth('adminIssueTemp', {}).then(function (r) {
      tempList = r.list || [];
      if (!tempList.length) { say(el('msTemp'), 'ok', r.msg); show(el('tempResult'), false); return; }

      el('tempList').innerHTML =
        '<div class="row row--head"><div class="row__main"><strong>ชื่อ</strong></div>' +
        '<strong>รหัสชั่วคราว</strong></div>' +
        tempList.map(function (m) {
          return '<div class="row">' +
            '<div class="row__main">' +
              '<div class="row__title">' + esc(m.name) + '</div>' +
              '<div class="row__sub">' + esc(m.member_id) + ' · เข้าด้วย ' + esc(m.login_with) + '</div>' +
            '</div>' +
            '<code class="pw">' + esc(m.temp_password) + '</code>' +
          '</div>';
        }).join('');

      show(el('tempResult'), true);
      say(el('msTemp'), 'ok', r.msg);
      loadTempStatus();
    }).catch(function (err) {
      say(el('msTemp'), 'err', notDeployed(err) ? NEED_DEPLOY : err.message);
    }).then(function () { F.busy(false); });
  }

  function tempAsText() {
    return 'ชื่อ\tรหัสสมาชิก\tเข้าระบบด้วย\tรหัสชั่วคราว\n' +
      tempList.map(function (m) {
        return m.name + '\t' + m.member_id + '\t' + m.login_with + '\t' + m.temp_password;
      }).join('\n');
  }

  function doTempSave() {
    if (!tempList.length) return;
    var d = new Date();
    var stamp = d.getFullYear() + ('0' + (d.getMonth() + 1)).slice(-2) + ('0' + d.getDate()).slice(-2);
    // ﻿ = BOM ให้ Excel อ่านภาษาไทยไม่เป็นตัวต่างดาว
    var blob = new Blob(['﻿' + tempAsText()], { type: 'text/plain;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'รหัสชั่วคราว-' + stamp + '.txt';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    say(el('msTemp'), 'ok', 'บันทึกไฟล์แล้ว — แจกเสร็จอย่าลืมลบไฟล์ทิ้งนะครับ');
  }

  function doTempCopy() {
    if (!tempList.length) return;
    var txt = tempAsText();
    var done = function () { say(el('msTemp'), 'ok', 'คัดลอกแล้ว ' + tempList.length + ' รายการ'); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(txt).then(done, fallback);
    } else { fallback(); }

    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = txt; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); done(); }
      catch (e) { say(el('msTemp'), 'err', 'คัดลอกอัตโนมัติไม่ได้ ใช้ปุ่มบันทึกเป็นไฟล์แทนนะครับ'); }
      document.body.removeChild(ta);
    }
  }

  // ---------------- อัปโหลดทีละไฟล์ ----------------
  function doUpload() {
    var files = Array.prototype.slice.call(el('fileUp').files || []);
    var eventId = el('selEv').value;
    say(el('msUp'), '', '');

    if (!eventId)      { say(el('msUp'), 'err', 'เลือกกิจกรรมก่อนนะครับ'); return; }
    if (!picked)       { say(el('msUp'), 'err', 'เลือกสมาชิกก่อนนะครับ'); return; }
    if (!files.length) { say(el('msUp'), 'err', 'ยังไม่ได้เลือกไฟล์'); return; }

    var done = 0, fail = [];
    F.busy(true, ['กำลังอัปโหลด 1/' + files.length + '...']);

    // ทำทีละไฟล์ ไม่ยิงพร้อมกัน เพื่อไม่ให้ชนกันตอนออกเลขลำดับ
    var chain = Promise.resolve();
    files.forEach(function (file, idx) {
      chain = chain.then(function () {
        F.busy(true, ['กำลังอัปโหลด ' + (idx + 1) + '/' + files.length + '...']);
        return F.shrink(file, 1600).then(function (img) {
          return F.auth('adminUploadFile', {
            event_id:  eventId,
            member_id: picked.member_id,
            data:      img.data,
            mimeType:  img.mimeType
          });
        }).then(function (r) {
          done++;
          el('upDone').insertAdjacentHTML('beforeend',
            '<div class="shot"><img src="' + esc(r.thumb) + '" alt="">' +
            '<div class="shot__act"><a href="' + esc(F.viewUrl(r.file_id, r.url)) +
            '" target="_blank" rel="noopener">ดูไฟล์</a></div></div>');
        }).catch(function (err) {
          fail.push(file.name + ' : ' + err.message);
        });
      });
    });

    chain.then(function () {
      F.busy(false);
      el('fileUp').value = '';
      if (fail.length) say(el('msUp'), 'err', 'สำเร็จ ' + done + ' ไฟล์ / ไม่สำเร็จ ' + fail.length + '\n' + fail.join('\n'));
      else             say(el('msUp'), 'ok', 'อัปโหลดสำเร็จ ' + done + ' ไฟล์ ให้ ' + picked.name);
      loadEvents();
    });
  }

  // ---------------- เพิ่มสมาชิกใหม่ ----------------
  function doAddMember() {
    var name  = el('inNewName').value.trim();
    var phone = el('inNewPhone').value.replace(/[^0-9]/g, '');
    say(el('msAdd'), '', '');

    if (!name)                       { say(el('msAdd'), 'err', 'ใส่ชื่อ-นามสกุลก่อนนะครับ'); return; }
    if (!/^0[0-9]{9}$/.test(phone))  { say(el('msAdd'), 'err', 'เบอร์โทรต้องเป็นเลข 10 หลัก เริ่มด้วย 0'); return; }

    F.busy(true, ['กำลังเพิ่มสมาชิก...']);
    F.auth('adminAddMember', { name: name, phone: phone, status: el('selNewRole').value })
      .then(function (r) {
        el('inNewName').value = ''; el('inNewPhone').value = '';
        el('selNewRole').value = 'User';
        say(el('msAdd'), 'ok',
          'เพิ่ม ' + r.name + ' เรียบร้อย (' + r.member_id + ')\n' +
          'แจ้งเจ้าตัวว่า —\n' +
          'เข้าระบบด้วยเบอร์ : ' + r.phone + '\n' +
          'รหัสชั่วคราว : ' + r.temp_password + '\n' +
          '(ระบบจะบังคับให้ตั้งรหัสใหม่เองตอนเข้าครั้งแรก)');
        doMemQuery();
      })
      .catch(function (err) { say(el('msAdd'), 'err', err.message); })
      .then(function () { F.busy(false); });
  }

  // ---------------- จัดการสมาชิก ----------------
  function doMemQuery() {
    el('memList').innerHTML = '<div class="empty">กำลังโหลด...</div>';
    say(el('msMem'), '', '');

    F.auth('adminMembers', { q: el('inMemQ').value.trim(), limit: 40 }).then(function (r) {
      if (!r.members.length) { el('memList').innerHTML = '<div class="empty">ไม่พบสมาชิก</div>'; return; }
      el('memList').innerHTML =
        '<p class="field-note">แสดง ' + r.members.length + ' คน จากทั้งหมด ' + r.total + ' คน</p>' +
        r.members.map(function (m) {
          var badge = m.must === 'FALSE'
            ? '<span class="badge badge--ok">พร้อมใช้</span>'
            : (m.must === 'RESET'
                ? '<span class="badge badge--wait">รอตั้งรหัสใหม่</span>'
                : '<span class="badge badge--wait">ยังไม่เคยเข้าระบบใหม่</span>');
          return '<div class="row">' +
            '<div class="row__main">' +
              '<div class="row__title">' + esc(m.name) + ' ' + badge + '</div>' +
              '<div class="row__sub">' + esc(m.member_id) +
                (m.phone ? ' · ' + esc(m.phone) : ' · ยังไม่ตั้งเบอร์') +
                (m.status === 'Admin' ? ' · แอดมิน' : '') + '</div>' +
            '</div>' +
            '<button class="btn btn--danger btn--sm" data-reset="' + esc(m.member_id) +
              '" data-name="' + esc(m.name) + '">รีเซ็ตรหัส</button>' +
          '</div>';
        }).join('');

      el('memList').querySelectorAll('[data-reset]').forEach(function (b) {
        b.onclick = function () {
          if (!confirm('รีเซ็ตรหัสของ ' + b.dataset.name + ' ?\n\nรหัสเดิมจะใช้ไม่ได้ทันที และคุณต้องแจ้งรหัสชั่วคราวให้เจ้าตัว')) return;
          F.busy(true, ['กำลังรีเซ็ต...']);
          F.auth('adminResetPassword', { member_id: b.dataset.reset }).then(function (r) {
            say(el('msMem'), 'ok',
              'รีเซ็ตรหัสของ ' + b.dataset.name + ' แล้ว\n' +
              'ให้เข้าระบบด้วย : ' + r.login_with + '\n' +
              'รหัสชั่วคราว : ' + r.temp_password + '\n' +
              '(เจ้าตัวต้องตั้งรหัสใหม่ทันทีที่เข้าระบบ)');
            el('msMem').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            doMemQuery();
          }).catch(function (err) {
            say(el('msMem'), 'err', err.message);
          }).then(function () { F.busy(false); });
        };
      });
    }).catch(function (err) {
      el('memList').innerHTML = '<div class="note note--err">' + esc(err.message) + '</div>';
    });
  }

  // ---------------- ภาพรวม ----------------
  function loadStats() {
    el('statBox').innerHTML = '<div class="empty">กำลังโหลด...</div>';
    F.auth('adminStats').then(function (s) {
      var items = [
        ['สมาชิกทั้งหมด', s.members],
        ['ตั้งรหัสใหม่แล้ว', s.migrated],
        ['ยังไม่เคยเข้า', s.pending],
        ['มีรูปโปรไฟล์', s.with_picture],
        ['กิจกรรม', s.events],
        ['ไฟล์ผลงาน', s.files]
      ];
      el('statBox').innerHTML = items.map(function (it) {
        return '<div class="stat"><div class="stat__num">' + it[1] +
               '</div><div class="stat__lab">' + it[0] + '</div></div>';
      }).join('');
    }).catch(function (err) {
      el('statBox').innerHTML = '<div class="note note--err">' + esc(err.message) + '</div>';
    });
  }

  // ---------------- ผูกปุ่ม ----------------
  function bind() {
    el('btLogin').onclick = doLogin;
    el('inPass').onkeydown = function (e) { if (e.key === 'Enter') doLogin(); };

    el('btNewEv').onclick   = doNewEvent;
    el('btFind').onclick    = doFind;
    el('inFind').onkeydown  = function (e) { if (e.key === 'Enter') doFind(); };
    el('btUp').onclick      = doUpload;
    el('btUpClear').onclick = clearPick;
    el('btMemQ').onclick    = doMemQuery;
    el('btTempCheck').onclick = loadTempStatus;
    el('btTempIssue').onclick = doTempIssue;
    el('btTempSave').onclick  = doTempSave;
    el('btTempCopy').onclick  = doTempCopy;
    el('inMemQ').onkeydown  = function (e) { if (e.key === 'Enter') doMemQuery(); };

    el('btAddMem').onclick    = doAddMember;
    el('inNewPhone').oninput  = function () { this.value = this.value.replace(/[^0-9]/g, '').substring(0, 10); };
    el('inNewPhone').onkeydown = function (e) { if (e.key === 'Enter') doAddMember(); };

    document.querySelectorAll('.tab').forEach(function (t) {
      t.onclick = function () {
        document.querySelectorAll('.tab').forEach(function (x) { x.classList.remove('is-on'); });
        t.classList.add('is-on');
        ['paneEv', 'paneUp', 'paneMem', 'paneStat'].forEach(function (p) {
          show(el(p), p === t.dataset.pane);
        });
        if (t.dataset.pane === 'paneStat') loadStats();
        if (t.dataset.pane === 'paneMem' && !el('memList').innerHTML) { doMemQuery(); loadTempStatus(); }
        window.scrollTo(0, 0);
      };
    });
  }

  function start() {
    bind();
    if (!F.getToken()) { show(el('scGate'), true); return; }

    F.busy(true, ['กำลังตรวจสิทธิ์...']);
    F.auth('me').then(function (r) {
      if (r.member.status !== 'Admin') throw new Error('ไม่ใช่แอดมิน');
      enter();
    }).catch(function () {
      show(el('scGate'), true);
    }).then(function () { F.busy(false); });
  }

  document.addEventListener('DOMContentLoaded', start);
})();
