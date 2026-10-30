/**
 * FA Member Club — Service Worker
 * ทำให้ติดตั้งเป็นแอปบนมือถือได้ และเปิดครั้งต่อไปไวขึ้น
 *
 * หลักที่ยึด (สำคัญมาก อ่านก่อนแก้)
 *   1) ไฟล์ของเราเอง = "เอาจากเน็ตก่อน" (network-first)
 *      -> push โค้ดใหม่แล้ว user เห็นของใหม่ทันที ไม่ค้างรุ่นเก่า
 *      -> ถ้าเน็ตล่ม ค่อยหยิบจากแคชมาแสดง
 *   2) **ห้ามแคช API ของ Apps Script เด็ดขาด** ข้อมูลสมาชิกต้องสดใหม่เสมอ
 *   3) ไม่แคชรูปจาก Drive ปล่อยให้เบราว์เซอร์จัดการเอง (รูปเยอะ จะกินพื้นที่เครื่อง)
 *   4) ฟอนต์ = เอาจากแคชก่อน (ไม่เคยเปลี่ยน)
 *
 * เวลาแก้ไฟล์ในโฟลเดอร์ web/ ให้ขยับเลข VERSION ขึ้น 1 ด้วย
 */

var VERSION = 'fa-v3';
var SHELL   = VERSION + '-shell';
var FONTS   = VERSION + '-fonts';

// ไฟล์ที่ต้องมีเพื่อให้เปิดแอปได้แม้เน็ตไม่มี
var SHELL_FILES = [
  './',
  './index.html',
  './admin.html',
  './assets/style.css',
  './assets/api.js',
  './assets/app.js',
  './assets/admin.js',
  './icons/icon-192.png',
  './icons/apple-touch-icon.png',
  './manifest.webmanifest'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(SHELL).then(function (c) {
      // ไฟล์ไหนโหลดไม่ได้ก็ไม่ให้ล้มทั้งชุด
      return Promise.all(SHELL_FILES.map(function (u) {
        return c.add(new Request(u, { cache: 'reload' })).catch(function () {});
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        if (k.indexOf(VERSION) !== 0) return caches.delete(k);   // ล้างแคชรุ่นเก่า
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

// ให้หน้าเว็บสั่งข้ามคิวรออัปเดตได้
self.addEventListener('message', function (e) {
  if (e.data === 'skipWaiting') self.skipWaiting();
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;

  var url = new URL(req.url);

  // 1) API ของ Apps Script — ห้ามแตะ ห้ามแคช
  if (url.hostname === 'script.google.com' || url.hostname === 'script.googleusercontent.com') return;

  // 2) รูปจาก Drive — ปล่อยให้เบราว์เซอร์จัดการ
  if (url.hostname === 'drive.google.com' || url.hostname === 'lh3.googleusercontent.com') return;

  // 3) ฟอนต์ — แคชก่อน (ไม่เคยเปลี่ยน)
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(
      caches.match(req).then(function (hit) {
        if (hit) return hit;
        return fetch(req).then(function (res) {
          var copy = res.clone();
          caches.open(FONTS).then(function (c) { c.put(req, copy); });
          return res;
        });
      })
    );
    return;
  }

  // 4) ไฟล์ของเราเอง — เอาจากเน็ตก่อน แล้วอัปเดตแคชไว้ใช้ตอนเน็ตล่ม
  if (url.origin === self.location.origin) {
    e.respondWith(
      fetch(req).then(function (res) {
        if (res && res.status === 200 && res.type === 'basic') {
          var copy = res.clone();
          caches.open(SHELL).then(function (c) { c.put(req, copy); });
        }
        return res;
      }).catch(function () {
        return caches.match(req).then(function (hit) {
          if (hit) return hit;
          // เปิดหน้าใหม่ตอนออฟไลน์แล้วไม่มีในแคช -> ให้หน้าหลักไป
          if (req.mode === 'navigate') return caches.match('./index.html');
        });
      })
    );
  }
});
