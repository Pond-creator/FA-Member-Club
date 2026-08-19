/* FA Member Club — ตัวกลางคุยกับหลังบ้าน + ตัวช่วยหน้าเว็บ
   ห่อไว้ใน window.FA เพื่อไม่ให้ตัวแปรหลุดไปชนกับสคริปต์อื่น */
(function () {
  'use strict';

  var API_URL = 'https://script.google.com/macros/s/AKfycbyc87KUXxgP6fZlYp_L2AwKFtGq6a7bNm5orPkJw9ztDAKBFhIr4lyxPNKeTKzJqLBP/exec';

  var TOKEN_KEY = 'fa_token';
  var TIMEOUT   = 45000;   // ms
  var RETRY     = 2;       // ลองซ้ำอีก 2 ครั้งถ้าเน็ตสะดุด

  // ---------- token ----------
  function getToken()  { try { return localStorage.getItem(TOKEN_KEY) || ''; } catch (e) { return ''; } }
  function setToken(t) { try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } catch (e) {} }

  // ---------- เรียก API ----------
  // ส่งเป็น text/plain เพื่อไม่ให้เบราว์เซอร์ยิง preflight (GAS ไม่รับ OPTIONS)
  function call(action, payload) {
    var body = JSON.stringify(Object.assign({ action: action }, payload || {}));
    var tries = 0;

    function attempt() {
      tries++;
      var ctl = new AbortController();
      var timer = setTimeout(function () { ctl.abort(); }, TIMEOUT);

      return fetch(API_URL, {
        method: 'POST',
        body: body,
        redirect: 'follow',
        signal: ctl.signal
      }).then(function (res) {
        clearTimeout(timer);
        if (!res.ok) throw new Error('เชื่อมต่อไม่ได้ (' + res.status + ')');
        return res.text();
      }).then(function (txt) {
        var json;
        try { json = JSON.parse(txt); }
        catch (e) { throw new Error('ข้อมูลที่ได้กลับมาไม่ถูกต้อง — ลองรีเฟรชหน้าใหม่'); }
        if (!json.ok) throw new Error(json.error || 'เกิดข้อผิดพลาด');
        return json;
      }).catch(function (err) {
        clearTimeout(timer);
        var msg = String(err && err.message || err);
        var netProblem = err.name === 'AbortError' ||
                         msg.indexOf('Failed to fetch') >= 0 ||
                         msg.indexOf('เชื่อมต่อไม่ได้') >= 0 ||
                         msg.indexOf('NetworkError') >= 0;
        if (netProblem && tries <= RETRY) {
          return new Promise(function (r) { setTimeout(r, 800 * tries); }).then(attempt);
        }
        if (err.name === 'AbortError') throw new Error('เน็ตช้าหรือหลุด ลองอีกครั้งนะครับ');
        throw err;
      });
    }
    return attempt();
  }

  /** เรียกแบบแนบ token ให้อัตโนมัติ */
  function auth(action, payload) {
    return call(action, Object.assign({ token: getToken() }, payload || {}));
  }

  // ---------- ตัวช่วย DOM ----------
  function el(id) { return document.getElementById(id); }
  function show(node, on) { if (node) node.classList.toggle('hide', !on); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // ---------- ม่านโหลด (มีข้อความเปลี่ยนไปเรื่อยๆ ไม่ให้รู้สึกค้าง) ----------
  var veil = null, veilTimer = null;
  function busy(on, steps) {
    if (on) {
      if (!veil) {
        veil = document.createElement('div');
        veil.className = 'veil';
        veil.innerHTML = '<div class="spin"></div><div class="veil__txt"></div>';
        document.body.appendChild(veil);
      }
      veil.classList.remove('hide');
      var list = steps || ['กำลังทำงาน...'];
      var i = 0, txt = veil.querySelector('.veil__txt');
      txt.textContent = list[0];
      clearInterval(veilTimer);
      veilTimer = setInterval(function () {
        i = Math.min(i + 1, list.length - 1);
        txt.textContent = list[i];
      }, 2500);
    } else if (veil) {
      clearInterval(veilTimer);
      veil.classList.add('hide');
    }
  }

  /** แสดงข้อความสถานะในกล่อง */
  function say(node, kind, msg) {
    if (!node) return;
    if (!msg) { node.className = 'note hide'; node.textContent = ''; return; }
    node.className = 'note note--' + kind;
    node.textContent = msg;
  }

  // ---------- รูปภาพ ----------
  /** ย่อรูปก่อนอัป -> ประหยัดเน็ตของสมาชิก + ไม่กินโควต้าฝั่งเซิร์ฟเวอร์ */
  function shrink(file, maxSide) {
    maxSide = maxSide || 1400;
    return new Promise(function (resolve, reject) {
      if (!/^image\/(jpeg|jpg|png)$/i.test(file.type)) {
        reject(new Error('รับเฉพาะไฟล์ JPG หรือ PNG'));
        return;
      }
      var reader = new FileReader();
      reader.onerror = function () { reject(new Error('อ่านไฟล์ไม่สำเร็จ')); };
      reader.onload = function () {
        var img = new Image();
        img.onerror = function () { reject(new Error('ไฟล์รูปเสียหรือเปิดไม่ได้')); };
        img.onload = function () {
          var scale = Math.min(1, maxSide / Math.max(img.width, img.height));
          var w = Math.round(img.width * scale), h = Math.round(img.height * scale);
          var cv = document.createElement('canvas');
          cv.width = w; cv.height = h;
          var cx = cv.getContext('2d');
          cx.fillStyle = '#fff';
          cx.fillRect(0, 0, w, h);
          cx.drawImage(img, 0, 0, w, h);
          var url = cv.toDataURL('image/jpeg', 0.86);
          resolve({ data: url.split(',')[1], mimeType: 'image/jpeg' });
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  /** ลิงก์โหลดไฟล์ตรงจาก Drive (ไม่ผ่านหลังบ้าน) */
  function dlUrl(fileId, fallback) {
    return fileId ? 'https://drive.google.com/uc?export=download&id=' + fileId : (fallback || '#');
  }
  function viewUrl(fileId, fallback) {
    return fileId ? 'https://drive.google.com/file/d/' + fileId + '/view' : (fallback || '#');
  }

  function initials(name) {
    var s = String(name || '').trim();
    return s ? s.substring(0, 2) : '?';
  }

  window.FA = {
    API_URL: API_URL,
    call: call, auth: auth,
    getToken: getToken, setToken: setToken,
    el: el, show: show, esc: esc, busy: busy, say: say,
    shrink: shrink, dlUrl: dlUrl, viewUrl: viewUrl, initials: initials
  };
})();
