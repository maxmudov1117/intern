// ====== Oʻzbekiston hududlari (14 ta) ======
const UZ_REGIONS = [
  "Andijon", "Buxoro", "Farg'ona", "Jizzax", "Namangan",
  "Navoiy", "Qashqadaryo", "Qoraqalpog'iston Respublikasi",
  "Samarqand", "Sirdaryo", "Surxondaryo",
  "Toshkent shahri", "Toshkent viloyati", "Xorazm"
];

// ====== Hudud tanlash dropdownlari ======
const dropdowns = document.querySelectorAll('[data-dropdown]');

function closeAllDropdowns() {
  dropdowns.forEach((dd) => {
    dd.classList.remove('is-open');
    const t = dd.querySelector('[data-dropdown-toggle]');
    if (t) t.setAttribute('aria-expanded', 'false');
  });
}

dropdowns.forEach((dd) => {
  const toggle = dd.querySelector('[data-dropdown-toggle]');
  const valueEl = dd.querySelector('.field__value');
  const menu = dd.querySelector('.dropdown');
  const hidden = dd.querySelector('input[type="hidden"]');

  // Roʻyxatni toʻldirish
  UZ_REGIONS.forEach((name) => {
    const li = document.createElement('li');
    li.className = 'dropdown__option';
    li.setAttribute('role', 'option');
    li.textContent = name;
    li.addEventListener('click', () => {
      valueEl.textContent = name;
      valueEl.classList.remove('field__value--empty');
      if (hidden) hidden.value = name;
      closeAllDropdowns();
    });
    menu.appendChild(li);
  });

  // Ochish / yopish
  toggle.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = dd.classList.contains('is-open');
    closeAllDropdowns();
    if (!isOpen) {
      dd.classList.add('is-open');
      toggle.setAttribute('aria-expanded', 'true');
    }
  });
});

// ====== Backend manzili ======
const API_URL = "http://localhost:8080/api/order"; // PROD: "/api/order"

const submitBtn = document.getElementById("orderSubmit");
const statusEl  = document.getElementById("orderStatus");
const fromInput = document.querySelector('input[name="from"]');
const toInput   = document.querySelector('input[name="to"]');
const phoneInput = document.querySelector('input[type="tel"]');

// Placeholderlarni reset uchun eslab qolamiz
document.querySelectorAll('[data-dropdown] .field__value').forEach((el) => {
  el.dataset.placeholder = el.textContent.trim();
});

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
  });
}

// ====== Submit ======
submitBtn?.addEventListener("click", async () => {
  const from  = fromInput?.value.trim();
  const to    = toInput?.value.trim();
  const phone = phoneInput?.value.trim();

  if (!from)  return setStatus("Iltimos, qayerdan ketishni tanlang.", "error");
  if (!to)    return setStatus("Iltimos, manzilni tanlang.", "error");
  if (!phone || phone.replace(/\D/g, "").length < 12)
    return setStatus("Telefon raqamini to'liq kiriting.", "error");

  submitBtn.disabled = true;
  setStatus("Yuborilmoqda...", "loading");

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, phone }),
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

