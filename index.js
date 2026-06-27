// ====== Backend manzili ======
const API_URL = "https://intern-1-iy1k.onrender.com/api/order"; // PROD: "/api/order"

// ====== Hudud/tuman datasi (regions.json dan yuklanadi) ======
let UZ_DATA = [];

const allDropdowns = () => document.querySelectorAll('[data-dropdown]');

function closeAllDropdowns() {
  allDropdowns().forEach((dd) => {
    dd.classList.remove('is-open');
    const t = dd.querySelector('[data-dropdown-toggle]');
    if (t) t.setAttribute('aria-expanded', 'false');
  });
}

// Bitta dropdownni berilgan ro'yxat bilan to'ldirish
function fillDropdown(dd, items, onPick) {
  const menu = dd.querySelector('.dropdown');
  menu.innerHTML = '';
  items.forEach((name) => {
    const li = document.createElement('li');
    li.className = 'dropdown__option';
    li.setAttribute('role', 'option');
    li.textContent = name;
    li.addEventListener('click', () => {
      const valueEl = dd.querySelector('.field__value');
      const hidden = dd.querySelector('input[type="hidden"]');
      valueEl.textContent = name;
      valueEl.classList.remove('field__value--empty');
      if (hidden) hidden.value = name;
      closeAllDropdowns();
      if (onPick) onPick(name);
    });
    menu.appendChild(li);
  });
}

// Tuman dropdownini yoqish va reset qilish
function enableDistrict(districtDd, districts) {
  const toggle = districtDd.querySelector('[data-dropdown-toggle]');
  const valueEl = districtDd.querySelector('.field__value');
  const hidden = districtDd.querySelector('input[type="hidden"]');
  districtDd.classList.remove('is-disabled');
  toggle.disabled = false;
  valueEl.textContent = valueEl.dataset.placeholder || 'Tuman';
  valueEl.classList.add('field__value--empty');
  if (hidden) hidden.value = '';
  fillDropdown(districtDd, districts);
}

// Ochish/yopish hodisasini ulash
function wireToggle(dd) {
  const toggle = dd.querySelector('[data-dropdown-toggle]');
  toggle.addEventListener('click', (e) => {
    e.stopPropagation();
    if (toggle.disabled) return;
    const isOpen = dd.classList.contains('is-open');
    closeAllDropdowns();
    if (!isOpen) {
      dd.classList.add('is-open');
      toggle.setAttribute('aria-expanded', 'true');
    }
  });
}

// Placeholderlarni reset uchun eslab qolamiz
document.querySelectorAll('[data-dropdown] .field__value').forEach((el) => {
  el.dataset.placeholder = el.textContent.trim();
});

// ====== regions.json ni yuklash va dropdownlarni ulash ======
fetch('./regions.json')
  .then((r) => r.json())
  .then((data) => {
    UZ_DATA = data;
    const regionNames = data.map((x) => x.region);

    allDropdowns().forEach(wireToggle);

    // Viloyat dropdownlari: tanlanganda yonidagi tuman dropdownini to'ldiradi
    document.querySelectorAll('[data-role="region"]').forEach((regionDd) => {
      const districtDd = document.getElementById(regionDd.dataset.target);
      fillDropdown(regionDd, regionNames, (regionName) => {
        const found = UZ_DATA.find((x) => x.region === regionName);
        enableDistrict(districtDd, found ? found.districts : []);
      });
    });
  })
  .catch(() => console.error('regions.json yuklanmadi'));

// ====== Submit elementlari ======
const submitBtn = document.getElementById("orderSubmit");
const statusEl  = document.getElementById("orderStatus");
const phoneInput = document.querySelector('input[type="tel"]');

const fromRegionInput   = document.querySelector('input[name="fromRegion"]');
const fromDistrictInput = document.querySelector('input[name="fromDistrict"]');
const toRegionInput     = document.querySelector('input[name="toRegion"]');
const toDistrictInput   = document.querySelector('input[name="toDistrict"]');

// ====== Telefon maskasi: +998 (__) ___-__-__ ======
phoneInput?.addEventListener("input", () => {
  let d = phoneInput.value.replace(/\D/g, "");
  if (d.startsWith("998")) d = d.slice(3);
  d = d.slice(0, 9);
  let out = "+998";
  if (d.length > 0) out += " (" + d.slice(0, 2);
  if (d.length >= 2) out += ")";
  if (d.length > 2) out += " " + d.slice(2, 5);
  if (d.length > 5) out += "-" + d.slice(5, 7);
  if (d.length > 7) out += "-" + d.slice(7, 9);
  phoneInput.value = out;
});

function setStatus(msg, type) {
  if (!statusEl) return;
  statusEl.textContent = msg;
  statusEl.className = "hero__status" + (type ? " hero__status--" + type : "");
}

function resetForm() {
  phoneInput.value = "";
  document.querySelectorAll('[data-dropdown]').forEach((dd) => {
    const v = dd.querySelector(".field__value");
    const h = dd.querySelector('input[type="hidden"]');
    v.textContent = v.dataset.placeholder;
    v.classList.add("field__value--empty");
    if (h) h.value = "";
    // tuman dropdownlarini yana o'chirilgan holatga qaytaramiz
    if (dd.dataset.role === "district") {
      dd.classList.add("is-disabled");
      const t = dd.querySelector('[data-dropdown-toggle]');
      if (t) t.disabled = true;
    }
  });
}

// ====== Submit ======
submitBtn?.addEventListener("click", async () => {
  const fromRegion   = fromRegionInput?.value.trim();
  const fromDistrict = fromDistrictInput?.value.trim();
  const toRegion     = toRegionInput?.value.trim();
  const toDistrict   = toDistrictInput?.value.trim();
  const phone        = phoneInput?.value.trim();

  if (!fromRegion)   return setStatus("Iltimos, qayerdan ketishni — viloyatni tanlang.", "error");
  if (!fromDistrict) return setStatus("Iltimos, qayerdan ketishni — tumanni tanlang.", "error");
  if (!toRegion)     return setStatus("Iltimos, manzil viloyatini tanlang.", "error");
  if (!toDistrict)   return setStatus("Iltimos, manzil tumanini tanlang.", "error");
  if (!phone || phone.replace(/\D/g, "").length < 12)
    return setStatus("Telefon raqamini to'liq kiriting.", "error");

  submitBtn.disabled = true;
  setStatus("Yuborilmoqda...", "loading");

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fromRegion, fromDistrict, toRegion, toDistrict, phone }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.error || "server_error");

    setStatus("✅ Buyurtma yuborildi! Tez orada bog'lanamiz.", "success");
    resetForm();
  } catch (err) {
    setStatus("❌ Xatolik yuz berdi. Qayta urinib ko'ring.", "error");
  } finally {
    submitBtn.disabled = false;
  }
});

// Tashqariga bosilsa yoki Escape — yopiladi
document.addEventListener('click', closeAllDropdowns);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeAllDropdowns(); });