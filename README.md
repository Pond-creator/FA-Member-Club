# FA Member Club

ระบบสมาชิก FA — เว็บหน้าบ้าน (GitHub Pages)

**ใช้งานจริง:** https://pond-creator.github.io/FA-Member-Club/

## หน้าเว็บ

| ไฟล์ | ใครใช้ |
|---|---|
| `index.html` | สมาชิก — ผลงานของฉัน / โปรไฟล์ / เปลี่ยนรหัสผ่าน |
| `admin.html` | แอดมิน — กิจกรรม / อัปโหลดให้สมาชิก / สมาชิก / ภาพรวม |

## โครงสร้าง

```
index.html          หน้าสมาชิก
admin.html          หน้าแอดมิน
assets/style.css    ธีมขาว-ทอง (ออกแบบมือถือก่อน)
assets/api.js       ตัวกลางคุยกับหลังบ้าน (retry / timeout / ย่อรูป)
assets/app.js       ตรรกะหน้าสมาชิก
assets/admin.js     ตรรกะหน้าแอดมิน
```

## หลังบ้าน

Google Apps Script + Google Sheets — โค้ดหลังบ้าน **ไม่อยู่ใน repo นี้**
URL ของ Web App อยู่ในตัวแปร `API_URL` ที่ `assets/api.js`

การยืนยันตัวตนใช้ token แบบ stateless (HMAC-SHA256) หมดอายุ 12 ชั่วโมง
รหัสผ่านเก็บเป็น SHA-256 + salt ฝั่งชีต ไม่มีรหัสผ่านแบบข้อความเปล่า

## หมายเหตุสำหรับคนดูแลต่อ

- แก้ URL หลังบ้านเมื่อ deploy GAS ใหม่ → แก้ `API_URL` ที่ `assets/api.js` ที่เดียว
- รูปภาพโหลดตรงจาก Google Drive ไม่วิ่งผ่าน Apps Script (เพื่อไม่กินโควต้า)
- เอกสารการออกแบบและประวัติการตัดสินใจทั้งหมดอยู่ใน `PROJECT_NOTES.md` (ไม่ได้อยู่ใน repo นี้)
