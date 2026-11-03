/* FA Member Club — หน้าจัดการระบบ (แอดมิน) */
(function () {
  'use strict';
  var F = window.FA, el = F.el, esc = F.esc, show = F.show, say = F.say;

  var events = [];
  var picked = null;   // สมาชิกที่เลือกไว้เพื่ออัปโหลด
  var TIERS  = ['ทั่วไป', 'เงิน', 'ทอง', 'แพลทินัม'];   // ค่าสำรอง เดี๋ยวหลังบ้านส่งตัวจริงมาทับ

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
        say(el('msAdd'), 'ok', r.msg);
        doMemQuery();
      })
      .catch(function (err) { say(el('msAdd'), 'err', err.message); })
      .then(function () { F.busy(false); });
  }

  // ---------------- จัดการสมาชิก ----------------
  /** สรุปจำนวนบนหัวรายชื่อ — ไว้ดูความคืบหน้าว่าใส่เบอร์/ตั้งรหัสไปแล้วกี่คน */
  var MEM_CHIPS = [
    { key: 'admin',   cls: '',          text: 'แอดมิน' },
    { key: 'ready',   cls: ' is-ok',    text: 'พร้อมใช้' },
    { key: 'waiting', cls: ' is-wait',  text: 'รอตั้งรหัส' },
    { key: 'nophone', cls: ' is-none',  text: 'ยังไม่มีเบอร์' },
    { key: 'off',     cls: ' is-off',   text: 'ถูกระงับ' }
  ];

  function memSummary(r) {
    var c = r.count || {};
    var line = 'แสดง ' + (r.shown || r.members.length) + ' คน' +
      (r.matched && r.matched > (r.shown || 0) ? ' จากที่ค้นเจอ ' + r.matched + ' คน' : '') +
      ' · ทั้งหมด ' + r.total + ' คน';

    if (c.ready === undefined) return '<p class="field-note">' + line + '</p>';

    // ป้ายสรุปกดได้ = ตัวกรอง · ตัวเลขบนป้ายนับจากทั้งชีตเสมอ ไม่เปลี่ยนตามที่กรองอยู่
    var chips = MEM_CHIPS.map(function (ch) {
      if (ch.key === 'off' && !c.off && memOnly !== 'off') return '';   // ไม่มีใครโดนระงับก็ไม่ต้องโชว์
      return '<button class="memsum__i' + ch.cls + (memOnly === ch.key ? ' is-on' : '') +
             '" data-only="' + ch.key + '"><b>' + (c[ch.key] || 0) + '</b> ' + ch.text + '</button>';
    }).join('');

    return '<p class="field-note">' + line +
             (memOnly ? ' · <b>กรองเฉพาะ ' + esc(onlyText(memOnly)) + '</b>' : '') + '</p>' +
      '<div class="memsum">' + chips +
        (memOnly ? '<button class="memsum__i memsum__i--clear" data-only="">ล้างตัวกรอง ✕</button>' : '') +
      '</div>';
  }

  function onlyText(k) {
    for (var i = 0; i < MEM_CHIPS.length; i++) if (MEM_CHIPS[i].key === k) return MEM_CHIPS[i].text;
    return k;
  }

  // keepMsg = true -> ไม่ล้างข้อความผลด้านบน (ใช้ตอนโหลดรายชื่อใหม่หลังใส่เบอร์/เปิดสิทธิ์
  //                   ไม่งั้นข้อความ "บอกเจ้าตัวว่า..." จะหายทันทีก่อนแอดมินได้อ่าน)
  /**
   * กล่องถาม-ตอบกลางจอ — ใช้แทน window.confirm / window.prompt ของเบราว์เซอร์
   * คืน Promise : กดยกเลิก -> false · กดยืนยัน -> true (หรือข้อความที่พิมพ์ ถ้าใส่ opt.input)
   * body กับ note รับ HTML ได้ (ใช้ <br> ขึ้นบรรทัดใหม่)
   */
  function ask(opt) {
    return new Promise(function (resolve) {
      var box = el('mdAsk'), inp = el('askInput'), yes = el('askYes');
      var done = false;

      el('askTitle').textContent = opt.title || 'ยืนยัน';
      el('askBody').innerHTML    = opt.body || '';
      show(el('askBody'), !!opt.body);
      el('askNote').innerHTML    = opt.note || '';
      show(el('askNote'), !!opt.note);

      show(el('askField'), !!opt.input);
      if (opt.input) {
        el('askLabel').textContent = opt.input.label || '';
        inp.value       = opt.input.value || '';
        inp.placeholder = opt.input.placeholder || '';
        inp.inputMode   = opt.input.inputmode || 'text';
        inp.maxLength   = opt.input.maxlength || 200;
      }

      yes.textContent = opt.yes || 'ยืนยัน';
      yes.className   = 'btn btn--sm' + (opt.danger ? ' btn--danger' : '');

      show(box, true);
      setTimeout(function () { (opt.input ? inp : yes).focus(); }, 30);

      function close(val) {
        if (done) return;                        // กัน resolve ซ้ำ (กดยืนยันแล้วกด Esc ตาม)
        done = true;
        document.removeEventListener('keydown', onKey);
        show(box, false);
        resolve(val);
      }
      function okNow() { close(opt.input ? String(inp.value).trim() : true); }
      function onKey(e) {
        if (e.key === 'Escape') close(false);
        else if (e.key === 'Enter' && opt.input && document.activeElement === inp) okNow();
      }

      yes.onclick         = okNow;
      el('askNo').onclick = function () { close(false); };
      box.onclick         = function (e) { if (e.target === box) close(false); };
      document.addEventListener('keydown', onKey);
    });
  }

  var memOnly = '';          // ป้ายสถานะที่กดกรองอยู่ ('' = ดูทุกคน)

  // ================= ข่าวสาร =================
  var nwEditId = '';      // '' = กำลังลงข่าวใหม่ · มีค่า = กำลังแก้ข่าวนี้อยู่
  var nwCache  = [];      // ข่าวทั้งหมดที่โหลดมาล่าสุด ใช้ตอนกดแก้ไขโดยไม่ต้องยิงซ้ำ

  function nwImg(id, w) {
    return 'https://drive.google.com/thumbnail?id=' + encodeURIComponent(id) + '&sz=w' + w;
  }

  /** ล้างฟอร์มกลับไปโหมด "ลงข่าวใหม่" */
  function nwReset() {
    nwEditId = '';
    el('nwFormTitle').textContent = 'ลงข่าวใหม่';
    el('inNwTitle').value = '';
    el('inNwBody').value  = '';
    el('inNwDate').value  = '';
    el('ckNwPin').checked  = false;
    el('ckNwShow').checked = true;
    el('fileNw').value = '';
    el('nwPics').innerHTML = '';
    show(el('nwPicBox'), false);
    show(el('btNwNew'), false);
    say(el('msNwPic'), '', '');
  }

  /** เข้าโหมดแก้ไขข่าวที่เลือก */
  function nwEdit(n) {
    nwEditId = n.news_id;
    el('nwFormTitle').textContent = 'แก้ไขข่าว ' + n.news_id;
    el('inNwTitle').value = n.title;
    el('inNwBody').value  = n.body;
    el('inNwDate').value  = n.date || '';
    el('ckNwPin').checked  = !!n.pinned;
    el('ckNwShow').checked = n.show !== false;
    show(el('btNwNew'), true);
    nwPaintPics(n.pics || []);
    show(el('nwPicBox'), true);
    say(el('msNw'), '', '');
    el('nwFormTitle').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /** รูปของข่าวที่กำลังแก้อยู่ — แต่ละรูปมีปุ่มลบมุมบนขวา */
  function nwPaintPics(pics) {
    var box = el('nwPics');
    if (!pics.length) {
      box.innerHTML = '<div class="empty" style="grid-column:1/-1">ยังไม่มีรูป</div>';
      return;
    }
    box.innerHTML = pics.map(function (id) {
      return '<div class="npic nwpic">' +
        '<img src="' + esc(nwImg(id, 600)) + '" alt="" loading="lazy">' +
        '<button class="nwpic__x" data-pic="' + esc(id) + '" title="ลบรูปนี้">&times;</button>' +
      '</div>';
    }).join('');

    box.querySelectorAll('[data-pic]').forEach(function (b) {
      b.onclick = function () {
        ask({ title: 'ลบรูปนี้?', body: 'รูปจะถูกย้ายไปถังขยะใน Drive',
              yes: 'ลบรูป', danger: true }).then(function (yn) {
          if (!yn) return;
          F.busy(true, ['กำลังลบรูป...']);
          return F.auth('adminNewsDeletePic', { news_id: nwEditId, file_id: b.dataset.pic })
            .then(function (r) {
              nwPaintPics(r.pics || []);
              say(el('msNwPic'), 'ok', r.msg);
              loadNews(true);
            }).catch(function (err) {
              say(el('msNwPic'), 'err', err.message);
            }).then(function () { F.busy(false); });
        });
      };
    });
  }

  function doNwSave() {
    var title = el('inNwTitle').value.trim();
    say(el('msNw'), '', '');
    if (!title) { say(el('msNw'), 'err', 'ใส่หัวข้อข่าวก่อนนะครับ'); return; }

    F.busy(true, ['กำลังบันทึก...']);
    F.auth('adminNewsSave', {
      news_id: nwEditId,
      title:   title,
      body:    el('inNwBody').value,
      date:    el('inNwDate').value.trim(),
      pinned:  el('ckNwPin').checked  ? 'TRUE' : 'FALSE',
      show:    el('ckNwShow').checked ? 'TRUE' : 'FALSE'
    }).then(function (r) {
      say(el('msNw'), 'ok', r.msg);
      // ข่าวใหม่ -> เข้าโหมดแก้ไขต่อทันที จะได้แนบรูปได้เลยไม่ต้องกดหาใหม่
      if (!nwEditId) {
        nwEditId = r.news_id;
        el('nwFormTitle').textContent = 'แก้ไขข่าว ' + r.news_id;
        show(el('btNwNew'), true);
        nwPaintPics([]);
        show(el('nwPicBox'), true);
      }
      loadNews(true);
    }).catch(function (err) {
      say(el('msNw'), 'err', err.message);
    }).then(function () { F.busy(false); });
  }

  function doNwUpload() {
    var files = Array.prototype.slice.call(el('fileNw').files || []);
    say(el('msNwPic'), '', '');
    if (!nwEditId)     { say(el('msNwPic'), 'err', 'บันทึกข่าวก่อนแล้วค่อยแนบรูปนะครับ'); return; }
    if (!files.length) return;

    var done = 0, fail = [], last = [];
    F.busy(true, ['กำลังอัปโหลด 1/' + files.length + '...']);

    // ทีละไฟล์ ไม่ยิงพร้อมกัน เพราะต้องต่อ file id ท้ายช่องเดิม ชนกันไม่ได้
    var chain = Promise.resolve();
    files.forEach(function (file, idx) {
      chain = chain.then(function () {
        F.busy(true, ['กำลังอัปโหลด ' + (idx + 1) + '/' + files.length + '...']);
        // ย่อที่ 2000px — ใหญ่พอให้จอคอมเห็นคมชัด แต่ไม่หนักจนอัปไม่ขึ้น
        return F.shrink(file, 2000).then(function (img) {
          return F.auth('adminNewsUpload', {
            news_id:  nwEditId,
            data:     img.data,
            mimeType: img.mimeType
          });
        }).then(function (r) {
          done++;
          last = r.pics || [];
        }).catch(function (err) {
          fail.push(file.name + ' : ' + err.message);
        });
      });
    });

    chain.then(function () {
      el('fileNw').value = '';
      if (last.length) nwPaintPics(last);
      if (fail.length) say(el('msNwPic'), 'err', 'สำเร็จ ' + done + ' รูป · ไม่สำเร็จ ' + fail.length + ' รูป');
      else             say(el('msNwPic'), 'ok', 'แนบรูปเรียบร้อย ' + done + ' รูป');
      loadNews(true);
      F.busy(false);
    });
  }

  /** keepForm = true -> ไม่ล้างฟอร์ม (ใช้ตอนโหลดรายการใหม่หลังบันทึก) */
  function loadNews(keepForm) {
    if (!keepForm) nwReset();
    el('nwList').innerHTML = '<div class="empty">กำลังโหลด...</div>';

    F.auth('adminNewsList').then(function (r) {
      nwCache = r.news || [];
      if (!nwCache.length) { el('nwList').innerHTML = '<div class="empty">ยังไม่มีข่าว</div>'; return; }

      el('nwList').innerHTML = nwCache.map(function (n) {
        return '<div class="row">' +
          '<div class="row__main">' +
            '<div class="row__title">' + esc(n.title) +
              (n.pinned ? ' <span class="badge badge--ok">ปักหมุด</span>' : '') +
              (n.show === false ? ' <span class="badge badge--off">ซ่อนอยู่</span>' : '') +
            '</div>' +
            '<div class="row__sub">' + esc(n.news_id) +
              (n.date ? ' · ' + esc(n.date) : '') +
              ' · รูป ' + n.pics.length + ' รูป</div>' +
          '</div>' +
          '<button class="btn btn--ghost btn--sm" data-nwedit="' + esc(n.news_id) + '">แก้ไข</button>' +
          '<button class="linkx" data-nwdel="' + esc(n.news_id) +
            '" data-name="' + esc(n.title) + '">ลบ</button>' +
        '</div>';
      }).join('');

      el('nwList').querySelectorAll('[data-nwedit]').forEach(function (b) {
        b.onclick = function () {
          for (var i = 0; i < nwCache.length; i++) {
            if (nwCache[i].news_id === b.dataset.nwedit) { nwEdit(nwCache[i]); return; }
          }
        };
      });

      el('nwList').querySelectorAll('[data-nwdel]').forEach(function (b) {
        b.onclick = function () {
          ask({
            title:  'ลบข่าว "' + b.dataset.name + '"?',
            body:   'ลบแล้วเอาคืนไม่ได้ รูปของข่าวนี้จะถูกย้ายไปถังขยะใน Drive ด้วย',
            note:   'ถ้าแค่ไม่อยากให้สมาชิกเห็น ให้กดแก้ไขแล้วเอาติ๊ก "ให้สมาชิกเห็น" ออกแทน',
            yes:    'ลบข่าว',
            danger: true
          }).then(function (yn) {
            if (!yn) return;
            F.busy(true, ['กำลังลบข่าว...']);
            return F.auth('adminNewsDelete', { news_id: b.dataset.nwdel }).then(function (r) {
              say(el('msNw'), 'ok', r.msg);
              if (nwEditId === b.dataset.nwdel) nwReset();
              loadNews(true);
            }).catch(function (err) {
              say(el('msNw'), 'err', err.message);
            }).then(function () { F.busy(false); });
          });
        };
      });
    }).catch(function (err) {
      el('nwList').innerHTML = '<div class="note note--err">' + esc(err.message) + '</div>';
    });
  }

  function doMemQuery(keepMsg) {
    el('memList').innerHTML = '<div class="empty">กำลังโหลด...</div>';
    if (keepMsg !== true) say(el('msMem'), '', '');

    F.auth('adminMembers', { q: el('inMemQ').value.trim(), limit: 40, only: memOnly }).then(function (r) {
      // ถึงไม่เจอใครก็ยังต้องโชว์แถบสรุป ไม่งั้นกดล้างตัวกรองไม่ได้ ต้องรีโหลดหน้าอย่างเดียว
      el('memList').innerHTML = memSummary(r) +
        (!r.members.length ? '<div class="empty">ไม่พบสมาชิก</div>' : '') +
        r.members.map(function (m) {
          var badge, btn;
          if (m.active === false) {
            // โดนระงับ -> ไม่ต้องโชว์ปุ่มจัดการรหัส เหลือแค่ทางคืนสิทธิ์
            badge = '<span class="badge badge--off">ระงับอยู่</span>';
            btn   = '';
          } else if (!m.phone) {
            // สมาชิกเก่าที่ย้ายมาแล้วยังไม่มีเบอร์ -> เข้าระบบไม่ได้จนกว่าแอดมินจะใส่เบอร์ให้
            badge = '<span class="badge badge--wait">ยังไม่มีเบอร์</span>';
            btn   = '<button class="btn btn--sm" data-phone="' + esc(m.member_id) +
                    '" data-name="' + esc(m.name) + '">ใส่เบอร์</button>';
          } else if (m.must === 'FALSE') {
            badge = '<span class="badge badge--ok">พร้อมใช้</span>';
            btn   = '<button class="btn btn--danger btn--sm" data-reset="' + esc(m.member_id) +
                    '" data-name="' + esc(m.name) + '">เปิดให้ตั้งรหัสใหม่</button>';
          } else {
            badge = '<span class="badge badge--wait">รอเจ้าตัวตั้งรหัส</span>';
            btn   = '<button class="btn btn--ghost btn--sm" data-phone="' + esc(m.member_id) +
                    '" data-name="' + esc(m.name) + '">แก้เบอร์</button>';
          }
          // ปุ่มลบเป็นตัวหนังสือเล็กๆ ไม่ใช่ปุ่มเต็ม — กันกดพลาด เพราะลบแล้วเอาคืนไม่ได้
          var del = '<button class="linkx" data-del="' + esc(m.member_id) +
                    '" data-name="' + esc(m.name) + '" title="ลบออกจากระบบ">ลบ</button>';

          // ระงับ = ตัดทางเข้าแต่เก็บข้อมูลไว้ ใช้กับคนทำผิดกฎ · ลบ = เอาออกถาวร ใช้กับบัญชีที่ไม่ได้ใช้
          var off = '<button class="linkx' + (m.active === false ? ' linkx--on' : '') +
                    '" data-off="' + esc(m.member_id) + '" data-name="' + esc(m.name) +
                    '" data-to="' + (m.active === false ? 'TRUE' : 'FALSE') + '">' +
                    (m.active === false ? 'คืนสิทธิ์' : 'ระงับ') + '</button>';

          return '<div class="row">' +
            '<div class="row__main">' +
              '<div class="row__title">' + esc(m.name) + ' ' + badge + '</div>' +
              '<div class="row__sub">' + esc(m.member_id) +
                (m.phone ? ' · ' + esc(m.phone) : ' · ยังเข้าระบบไม่ได้') +
                (m.status === 'Admin' ? ' · แอดมิน' : '') + '</div>' +
            '</div>' + btn + off + del +
          '</div>';
        }).join('');

      // ---- กดป้ายสถานะเพื่อกรอง (กดป้ายเดิมซ้ำ = ล้างตัวกรอง) ----
      el('memList').querySelectorAll('[data-only]').forEach(function (b) {
        b.onclick = function () {
          var k = b.dataset.only;
          memOnly = (k && k === memOnly) ? '' : k;
          doMemQuery(true);
        };
      });

      // ---- ใส่ / แก้เบอร์ ----
      el('memList').querySelectorAll('[data-phone]').forEach(function (b) {
        b.onclick = function () {
          ask({
            title: 'ใส่เบอร์โทรให้ ' + b.dataset.name,
            body:  'ใส่แล้วเจ้าตัวจะไปตั้งรหัสเองได้ที่หน้าเข้าสู่ระบบ',
            yes:   'บันทึกเบอร์',
            input: { label: 'เบอร์โทร (10 หลัก)', placeholder: '0812345678',
                     inputmode: 'numeric', maxlength: 10 }
          }).then(function (v) {
            if (v === false) return;
            var ph = String(v).replace(/[^0-9]/g, '');
            if (!/^0[0-9]{9}$/.test(ph)) {
              say(el('msMem'), 'err', 'เบอร์ต้องเป็นเลข 10 หลัก เริ่มด้วย 0'); return;
            }

            F.busy(true, ['กำลังบันทึกเบอร์...']);
            F.auth('adminSetPhone', { member_id: b.dataset.phone, phone: ph }).then(function (r) {
              say(el('msMem'), 'ok', r.msg);
              el('msMem').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
              doMemQuery(true);
            }).catch(function (err) {
              say(el('msMem'), 'err', err.message);
            }).then(function () { F.busy(false); });
          });
        };
      });

      // ---- ระงับ / คืนสิทธิ์ ----
      el('memList').querySelectorAll('[data-off]').forEach(function (b) {
        b.onclick = function () {
          var ban = b.dataset.to === 'FALSE';
          ask({
            title:  (ban ? 'ระงับ ' : 'คืนสิทธิ์ให้ ') + b.dataset.name + '?',
            body:   ban ? 'เข้าระบบไม่ได้ทันที และเครื่องที่ค้างล็อกอินอยู่จะหลุดทั้งหมด'
                        : 'กลับมาเข้าใช้งานได้ตามปกติ ด้วยรหัสเดิมของเค้า',
            note:   ban ? 'ข้อมูลกับผลงานยังอยู่ครบ กดคืนสิทธิ์ทีหลังได้ตลอด' : '',
            yes:    ban ? 'ระงับการใช้งาน' : 'คืนสิทธิ์',
            danger: ban
          }).then(function (yn) {
            if (!yn) return;
            F.busy(true, [ban ? 'กำลังระงับ...' : 'กำลังคืนสิทธิ์...']);
            return F.auth('adminSetActive', { member_id: b.dataset.off, active: b.dataset.to })
              .then(function (r) {
                say(el('msMem'), 'ok', r.msg);
                el('msMem').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                doMemQuery(true);
              }).catch(function (err) {
                say(el('msMem'), 'err', err.message);
                el('msMem').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
              }).then(function () { F.busy(false); });
          });
        };
      });

      // ---- ลบสมาชิก (หลังบ้านกันไว้อีกชั้น: ลบตัวเอง / แอดมินคนสุดท้าย / คนที่มีผลงาน ลบไม่ได้) ----
      el('memList').querySelectorAll('[data-del]').forEach(function (b) {
        b.onclick = function () {
          ask({
            title:  'ลบ ' + b.dataset.name + ' ออกจากระบบ?',
            body:   'ลบแล้วเอาคืนไม่ได้ ถ้าจะใช้อีกต้องเพิ่มเข้าไปใหม่',
            note:   'ถ้าคนนี้มีผลงานอยู่ ระบบจะไม่ยอมให้ลบ',
            yes:    'ลบออกจากระบบ',
            danger: true
          }).then(function (yn) {
            if (!yn) return;
            F.busy(true, ['กำลังลบ...']);
            return F.auth('adminDeleteMember', { member_id: b.dataset.del }).then(function (r) {
              say(el('msMem'), 'ok', r.msg);
              el('msMem').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
              doMemQuery(true);
            }).catch(function (err) {
              say(el('msMem'), 'err', err.message);
              el('msMem').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }).then(function () { F.busy(false); });
          });
        };
      });

      // ---- เปิดสิทธิ์ให้ตั้งรหัสใหม่ (แอดมินไม่เห็นรหัสของสมาชิก) ----
      el('memList').querySelectorAll('[data-reset]').forEach(function (b) {
        b.onclick = function () {
          ask({
            title: 'เปิดให้ ' + b.dataset.name + ' ตั้งรหัสใหม่?',
            body:  'รหัสเดิมจะใช้ไม่ได้ทันที และเครื่องที่ค้างล็อกอินอยู่จะหลุดทั้งหมด',
            note:  'บอกเจ้าตัวให้เข้าหน้าเว็บ กด <b>"เข้าครั้งแรก / ตั้งรหัสใหม่"</b> ' +
                   'แล้วกรอกเบอร์ตัวเองเพื่อตั้งรหัสใหม่',
            yes:   'เปิดสิทธิ์'
          }).then(function (yn) {
            if (!yn) return;
            F.busy(true, ['กำลังเปิดสิทธิ์...']);
            return F.auth('adminResetPassword', { member_id: b.dataset.reset }).then(function (r) {
              say(el('msMem'), 'ok', r.msg);
              el('msMem').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
              doMemQuery(true);
            }).catch(function (err) {
              say(el('msMem'), 'err', err.message);
            }).then(function () { F.busy(false); });
          });
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

  // ---------------- ดูข้อมูลสมาชิกรายคน (แท็บภาพรวม) ----------------

  /** ค้นหา -> ขึ้นรายชื่อให้เลือก (ใช้ action เดิม adminMembers ไม่ต้องทำของใหม่) */
  function doFindOne() {
    var q = el('inFindOne').value.trim();
    say(el('msOne'), '', '');
    show(el('oneDetail'), false);

    if (!q) { say(el('msOne'), 'err', 'พิมพ์ชื่อ เบอร์ หรือรหัสสมาชิกก่อนนะครับ'); return; }
    el('oneList').innerHTML = '<div class="empty">กำลังค้นหา...</div>';

    F.auth('adminMembers', { q: q, limit: 40 }).then(function (r) {
      if (r.tiers && r.tiers.length) TIERS = r.tiers;
      if (!r.members.length) { el('oneList').innerHTML = '<div class="empty">ไม่พบสมาชิกที่ตรงกับคำค้นนี้</div>'; return; }

      // เจอคนเดียว -> เปิดรายละเอียดให้เลย ไม่ต้องกดซ้ำ
      if (r.members.length === 1) { el('oneList').innerHTML = ''; openOne(r.members[0].member_id); return; }

      el('oneList').innerHTML =
        '<p class="field-note">เจอ ' + r.members.length + ' คน — กดเลือกคนที่ต้องการดู</p>' +
        r.members.map(function (m) {
          return '<div class="row">' +
            '<div class="row__main">' +
              '<div class="row__title">' + esc(m.name) + '</div>' +
              '<div class="row__sub">' + esc(m.member_id) +
                (m.phone ? ' · ' + esc(m.phone) : ' · ยังไม่มีเบอร์') +
                (m.status === 'Admin' ? ' · แอดมิน' : '') + '</div>' +
            '</div>' +
            '<button class="btn btn--sm" data-one="' + esc(m.member_id) + '">ดูข้อมูล</button>' +
          '</div>';
        }).join('');

      el('oneList').querySelectorAll('[data-one]').forEach(function (b) {
        b.onclick = function () { openOne(b.dataset.one); };
      });
    }).catch(function (err) {
      el('oneList').innerHTML = '<div class="note note--err">' + esc(err.message) + '</div>';
    });
  }

  function statusText(m) {
    if (m.active === false) return ['off', 'ระงับอยู่'];
    if (!m.phone)            return ['wait', 'ยังไม่มีเบอร์ — เข้าระบบไม่ได้'];
    if (m.must === 'FALSE')  return ['ok',   'พร้อมใช้งาน'];
    return ['wait', 'รอเจ้าตัวตั้งรหัสเอง'];
  }

  /** คีย์เรียงกิจกรรม : แปลง dd/MM/yyyy เป็นตัวเลข yyyymmdd ไม่มีวันที่ = 0 */
  function evKey(ev) {
    var m = String(ev.event_date || '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    return m ? (Number(m[3]) * 10000 + Number(m[2]) * 100 + Number(m[1])) : 0;
  }

  function openOne(memberId) {
    say(el('msOne'), '', '');
    el('oneDetail').innerHTML = '<div class="empty">กำลังโหลด...</div>';
    show(el('oneDetail'), true);

    F.auth('adminMemberDetail', { member_id: memberId }).then(function (r) {
      var m = r.member, st = statusText(m);

      var head =
        '<div class="one__head">' +
          (m.pic ? '<img class="one__pic" src="' + esc(m.pic) + '" alt="">'
                 : '<div class="one__pic one__pic--empty">' + esc((m.name || '?').charAt(0)) + '</div>') +
          '<div>' +
            '<div class="one__name">' + esc(m.name) +
              ' <span class="badge badge--' + st[0] + '">' + esc(st[1]) + '</span></div>' +
            '<div class="row__sub">' + esc(m.member_id) +
              (m.status === 'Admin' ? ' · แอดมิน' : ' · สมาชิก') + '</div>' +
          '</div>' +
        '</div>';

      var info = [
        ['เบอร์โทร (ใช้เข้าระบบ)', m.phone || '— ยังไม่มี —'],
        ['ชื่อเดิมจากระบบเก่า',     m.old_user || '—'],
        ['เข้าระบบล่าสุด',          m.last_login || 'ยังไม่เคยเข้า'],
        ['เพิ่มเข้าระบบเมื่อ',       m.created_at || '—'],
        ['ระดับสมาชิก',             m.tier || 'ทั่วไป'],
        ['ผลงานทั้งหมด',            r.file_count + ' ไฟล์ จาก ' + r.event_count + ' กิจกรรม']
      ].map(function (it) {
        return '<div class="one__row"><span>' + it[0] + '</span><b>' + esc(String(it[1])) + '</b></div>';
      }).join('');

      // รวมทุกกิจกรรมเป็นแกลเลอรีเดียว เหมือนหน้าสมาชิก — กิจกรรมล่าสุดขึ้นก่อน แต่ละกิจกรรมมีสีประจำตัว
      var evs = r.events.slice().sort(function (a, b) {
        var d = evKey(b) - evKey(a);
        if (d) return d;
        return String(b.event_id).localeCompare(String(a.event_id), 'en', { numeric: true });
      });

      var cells = [];
      evs.forEach(function (e, iEv) {
        e.files.forEach(function (f) {
          cells.push(
            '<div class="shot" data-c="' + (iEv % 6) + '">' +
              '<div class="shot__pic">' +
                '<img src="' + esc(f.thumb) + '" alt="' + esc(f.name) + '" loading="lazy">' +
              '</div>' +
              '<div class="shot__ev" title="' + esc(e.event_name) + '">' + esc(e.event_name) +
                (e.event_date ? ' <span class="shot__date">' + esc(e.event_date) + '</span>' : '') +
              '</div>' +
              '<div class="shot__act"><a href="' + esc(F.viewUrl(f.file_id, f.url)) +
                '" target="_blank" rel="noopener">ดูไฟล์</a></div>' +
            '</div>');
        });
      });

      var works = !cells.length
        ? '<div class="empty">ยังไม่มีผลงานในระบบ</div>'
        : '<div class="grid" data-n="' + Math.min(cells.length, 3) + '">' + cells.join('') + '</div>';

      el('oneDetail').innerHTML =
        '<div class="card card--inner">' + head +
          '<div class="one__info">' + info + '</div>' +
          '<h3 class="one__h3">เปลี่ยนระดับสมาชิก</h3>' +
          '<div class="btn-row">' +
            '<select id="selTier" style="flex:1;min-width:140px">' +
              TIERS.map(function (t) {
                return '<option value="' + esc(t) + '"' +
                       (t === (m.tier || 'ทั่วไป') ? ' selected' : '') + '>' + esc(t) + '</option>';
              }).join('') +
            '</select>' +
            '<button class="btn btn--sm" id="btSetTier">บันทึกระดับ</button>' +
          '</div>' +
          '<div id="msTier" class="note hide"></div>' +
          '<h3 class="one__h3">ผลงาน' +
            (cells.length ? ' <span class="one__count">เรียงกิจกรรมล่าสุดก่อน</span>' : '') +
          '</h3>' + works +
          '<div class="btn-row" style="margin-top:14px">' +
            '<button class="btn btn--plain btn--sm" id="btOneClose">ปิด</button>' +
          '</div>' +
        '</div>';

      el('btSetTier').onclick = function () {
        var t = el('selTier').value;
        if (t === (m.tier || 'ทั่วไป')) { say(el('msTier'), 'ok', 'ระดับเดิมอยู่แล้ว ไม่ต้องบันทึก'); return; }
        F.busy(true, ['กำลังบันทึกระดับ...']);
        F.auth('adminSetTier', { member_id: m.member_id, tier: t }).then(function (res) {
          say(el('msTier'), 'ok', res.msg);
          m.tier = t;                       // อัปเดตในหน้าเลย จะได้ไม่ต้องโหลดใหม่
          openOne(m.member_id);             // วาดใหม่ให้ตัวเลขกับป้ายตรงกัน
        }).catch(function (err) {
          say(el('msTier'), 'err', /ไม่รู้จักคำสั่ง/.test(err.message)
            ? 'หลังบ้านยังไม่ได้อัปเดต — วาง Code.gs ใหม่แล้ว deploy ก่อนนะครับ' : err.message);
        }).then(function () { F.busy(false); });
      };

      el('btOneClose').onclick = function () {
        show(el('oneDetail'), false);
        el('oneDetail').innerHTML = '';
      };
      el('oneDetail').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }).catch(function (err) {
      el('oneDetail').innerHTML = '<div class="note note--err">' +
        esc(/ไม่รู้จักคำสั่ง/.test(err.message)
            ? 'หลังบ้านยังไม่ได้อัปเดต — วาง Code.gs ใหม่ใน Apps Script แล้ว deploy เวอร์ชันใหม่ก่อนนะครับ'
            : err.message) + '</div>';
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
    el('btMemQ').onclick    = function () { doMemQuery(); };
    el('btNwSave').onclick   = doNwSave;
    el('btNwNew').onclick    = function () { nwReset(); say(el('msNw'), '', ''); };
    el('fileNw').onchange    = doNwUpload;
    el('btFindOne').onclick  = doFindOne;
    el('inFindOne').onkeydown = function (e) { if (e.key === 'Enter') doFindOne(); };
    el('inMemQ').onkeydown  = function (e) { if (e.key === 'Enter') doMemQuery(); };

    el('btAddMem').onclick    = doAddMember;
    el('inNewPhone').oninput  = function () { this.value = this.value.replace(/[^0-9]/g, '').substring(0, 10); };
    el('inNewPhone').onkeydown = function (e) { if (e.key === 'Enter') doAddMember(); };

    document.querySelectorAll('.tab').forEach(function (t) {
      t.onclick = function () {
        document.querySelectorAll('.tab').forEach(function (x) { x.classList.remove('is-on'); });
        t.classList.add('is-on');
        ['paneEv', 'paneUp', 'paneMem', 'paneNews', 'paneStat'].forEach(function (p) {
          show(el(p), p === t.dataset.pane);
        });
        if (t.dataset.pane === 'paneStat') loadStats();
        if (t.dataset.pane === 'paneNews' && !el('nwList').innerHTML) loadNews();
        if (t.dataset.pane === 'paneMem' && !el('memList').innerHTML) doMemQuery();
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
