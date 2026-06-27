/* ═══════════════════════════════════════
   NutriAI — Core Application Logic
═══════════════════════════════════════ */

'use strict';

// ── State ──
let userData = {};
let planData = {};

// ── DOM References ──
const pageForm = document.getElementById('page-form');
const pageResults = document.getElementById('page-results');
const loadingOverlay = document.getElementById('loadingOverlay');
const themeToggle = document.getElementById('themeToggle');

// ── Theme ──
const savedTheme = localStorage.getItem('nutriai-theme') || 'light';
document.body.className = `${savedTheme}-mode`;

themeToggle.addEventListener('click', () => {
  const isDark = document.body.classList.contains('dark-mode');
  document.body.className = isDark ? 'light-mode' : 'dark-mode';
  localStorage.setItem('nutriai-theme', isDark ? 'light' : 'dark');
});

// ── Unit Toggle ──
document.getElementById('unitCm').addEventListener('click', () => setUnit('cm'));
document.getElementById('unitFt').addEventListener('click', () => setUnit('ft'));

function setUnit(unit) {
  document.querySelectorAll('.unit-btn').forEach(b => b.classList.toggle('active', b.dataset.unit === unit));
  document.getElementById('heightCm').classList.toggle('hidden', unit !== 'cm');
  document.getElementById('heightFt').classList.toggle('hidden', unit !== 'ft');
}

// ── Hero Canvas Spinning Ring ──
(function animateHeroRing() {
  const canvas = document.getElementById('heroCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const cx = W / 2, cy = H / 2;
  let angle = -Math.PI / 2;

  const segments = [
    { ratio: 0.35, color: '#4ade80', label: 'Protein' },
    { ratio: 0.40, color: '#3b82f6', label: 'Carbs' },
    { ratio: 0.25, color: '#f97316', label: 'Fat' },
  ];

  let frame = 0;
  function draw() {
    ctx.clearRect(0, 0, W, H);
    const r = 120, inner = 75;
    let start = angle + frame * 0.003;

    // Outer glow
    const grad = ctx.createRadialGradient(cx, cy, inner, cx, cy, r + 20);
    grad.addColorStop(0, 'rgba(74,222,128,0)');
    grad.addColorStop(1, 'rgba(74,222,128,0.08)');
    ctx.beginPath();
    ctx.arc(cx, cy, r + 20, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();

    segments.forEach(seg => {
      const end = start + seg.ratio * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, start, end);
      ctx.closePath();
      ctx.fillStyle = seg.color + '33';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(cx, cy, r, start, end);
      ctx.arc(cx, cy, inner, end, start, true);
      ctx.closePath();
      ctx.fillStyle = seg.color + '88';
      ctx.fill();

      // Arc stroke
      ctx.beginPath();
      ctx.arc(cx, cy, r, start, end);
      ctx.strokeStyle = seg.color;
      ctx.lineWidth = 3;
      ctx.stroke();

      start = end;
    });

    // Inner circle
    ctx.beginPath();
    ctx.arc(cx, cy, inner, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(13,31,15,0.8)';
    ctx.fill();

    // Center text
    ctx.fillStyle = '#4ade80';
    ctx.font = '700 14px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('MACRO', cx, cy - 8);
    ctx.fillStyle = 'rgba(134,239,172,0.7)';
    ctx.font = '400 11px Inter, sans-serif';
    ctx.fillText('BALANCE', cx, cy + 10);

    frame++;
    requestAnimationFrame(draw);
  }
  draw();
})();

// ═══════════════════════════════════════
// CALCULATIONS
// ═══════════════════════════════════════

function getHeightCm() {
  const unit = document.querySelector('.unit-btn.active')?.dataset.unit;
  if (unit === 'ft') {
    const ft = parseFloat(document.getElementById('heightFtVal').value) || 0;
    const inch = parseFloat(document.getElementById('heightInVal').value) || 0;
    return (ft * 30.48) + (inch * 2.54);
  }
  return parseFloat(document.getElementById('heightCmVal').value) || 0;
}

function calcBMI(weight, heightCm) {
  const hm = heightCm / 100;
  return weight / (hm * hm);
}

function getBMIStatus(bmi) {
  if (bmi < 18.5) return { label: 'Underweight', color: '#3b82f6', bg: '#dbeafe' };
  if (bmi < 25) return { label: 'Normal', color: '#22c55e', bg: '#dcfce7' };
  if (bmi < 30) return { label: 'Overweight', color: '#f59e0b', bg: '#fef3c7' };
  return { label: 'Obese', color: '#ef4444', bg: '#fee2e2' };
}

function calcTDEE(weight, heightCm, age, gender, activity) {
  // Mifflin-St Jeor
  let bmr;
  if (gender === 'female') {
    bmr = 10 * weight + 6.25 * heightCm - 5 * age - 161;
  } else {
    bmr = 10 * weight + 6.25 * heightCm - 5 * age + 5;
  }
  const multipliers = { sedentary: 1.2, moderate: 1.55, active: 1.725 };
  return Math.round(bmr * (multipliers[activity] || 1.55));
}

function getTargetCalories(tdee, goal, bmi) {
  if (goal === 'loss') return Math.max(1200, tdee - 500);
  if (goal === 'gain') return tdee + 400;
  return tdee;
}

function getMacros(targetCal, weight, goal) {
  let protein, fat, carbs;
  if (goal === 'loss') {
    protein = Math.round(weight * 2.2); // 2.2g/kg
    fat = Math.round((targetCal * 0.25) / 9);
    carbs = Math.round((targetCal - protein * 4 - fat * 9) / 4);
  } else if (goal === 'gain') {
    protein = Math.round(weight * 2.0);
    fat = Math.round((targetCal * 0.25) / 9);
    carbs = Math.round((targetCal - protein * 4 - fat * 9) / 4);
  } else {
    protein = Math.round(weight * 1.6);
    fat = Math.round((targetCal * 0.30) / 9);
    carbs = Math.round((targetCal - protein * 4 - fat * 9) / 4);
  }
  carbs = Math.max(carbs, 50);
  return { protein, carbs, fat };
}

function getWaterIntake(weight, activity) {
  let base = weight * 0.033;
  if (activity === 'moderate') base += 0.3;
  if (activity === 'active') base += 0.6;
  return Math.round(base * 10) / 10;
}

// ═══════════════════════════════════════
// WORLD REGIONAL FOOD DATABASE
// Used to inject accurate local foods into the AI prompt.
// Each region has: proteins, carbs, fats, veggies, fruits, extras
// All values per 100g (USDA / standard nutritional references)
// ═══════════════════════════════════════

const REGIONAL_FOOD_DB = {

  // ── Gulf / Middle East (UAE, Saudi, Kuwait, Qatar, Bahrain, Oman, Jordan, Lebanon, Egypt, Iraq, Yemen) ──
  gulf_middleeast: {
    keywords: ['dubai','uae','abu dhabi','sharjah','saudi','riyadh','jeddah','kuwait','qatar','doha','bahrain','oman','muscat','jordan','amman','lebanon','beirut','egypt','cairo','iraq','baghdad','yemen','sanaa','mecca','medina','dammam'],
    label: 'Gulf / Middle East',
    proteins: [
      { name: 'Grilled Hammour (Grouper) Fillet', cal: 118, p: 24.8, c: 0.0, f: 1.8 },
      { name: 'Chicken Shawarma (no bread)', cal: 185, p: 27.0, c: 4.0, f: 7.5 },
      { name: 'Lamb Kofta (grilled)', cal: 220, p: 22.0, c: 3.5, f: 13.5 },
      { name: 'Grilled Chicken Breast (Shish Tawook)', cal: 165, p: 31.0, c: 2.0, f: 3.6 },
      { name: 'Boiled Eggs', cal: 155, p: 13.0, c: 1.1, f: 11.0 },
      { name: 'Labneh (strained yogurt)', cal: 99,  p: 7.0,  c: 4.5, f: 6.0 },
      { name: 'Canned Tuna in Water', cal: 116, p: 26.0, c: 0.0, f: 1.0 },
      { name: 'Grilled Seabass Fillet', cal: 124, p: 23.6, c: 0.0, f: 3.1 },
      { name: 'Hummus (chickpea dip)', cal: 177, p: 8.0,  c: 20.0, f: 8.6 },
      { name: 'Foul Medames (cooked fava beans)', cal: 110, p: 7.6, c: 18.0, f: 0.5 },
      { name: 'Grilled Lamb Chop (lean)', cal: 215, p: 25.0, c: 0.0, f: 12.0 },
      { name: 'Msabbah (chickpea breakfast)', cal: 164, p: 9.0, c: 27.0, f: 3.0 },
    ],
    carbs: [
      { name: 'Cooked Basmati Rice', cal: 130, p: 2.7, c: 28.0, f: 0.3 },
      { name: 'Whole Wheat Khubz (Arabic bread)', cal: 245, p: 9.0, c: 47.0, f: 3.0 },
      { name: 'Cooked Bulgur Wheat', cal: 83,  p: 3.1, c: 18.6, f: 0.2 },
      { name: 'Cooked Brown Lentils (Adas)', cal: 116, p: 9.0, c: 20.0, f: 0.4 },
      { name: 'Rolled Oats (Quaker, widely sold)', cal: 389, p: 17.0, c: 66.0, f: 7.0 },
      { name: 'Cooked Freekeh (roasted wheat)', cal: 112, p: 4.0, c: 22.0, f: 0.7 },
      { name: 'Sweet Potato (boiled)', cal: 86,  p: 1.6, c: 20.0, f: 0.1 },
      { name: 'Dates (Medjool)', cal: 277, p: 1.8, c: 75.0, f: 0.2 },
      { name: 'Cooked Chickpeas', cal: 164, p: 8.9, c: 27.0, f: 2.6 },
    ],
    fats: [
      { name: 'Extra Virgin Olive Oil', cal: 884, p: 0.0, c: 0.0, f: 100.0 },
      { name: 'Tahini (sesame paste)', cal: 595, p: 17.0, c: 21.0, f: 54.0 },
      { name: 'Raw Almonds', cal: 579, p: 21.0, c: 22.0, f: 50.0 },
      { name: 'Avocado', cal: 160, p: 2.0, c: 9.0, f: 15.0 },
      { name: 'Walnuts', cal: 654, p: 15.0, c: 14.0, f: 65.0 },
    ],
    veggies: [
      { name: 'Cucumber (sliced)', cal: 15, p: 0.7, c: 3.6, f: 0.1 },
      { name: 'Tomatoes', cal: 18, p: 0.9, c: 3.9, f: 0.2 },
      { name: 'Rocket (Arugula)', cal: 25, p: 2.6, c: 3.7, f: 0.7 },
      { name: 'Parsley (fresh)', cal: 36, p: 3.0, c: 6.3, f: 0.8 },
      { name: 'Grilled Zucchini', cal: 17, p: 1.2, c: 3.1, f: 0.3 },
      { name: 'Steamed Broccoli', cal: 55, p: 3.7, c: 11.0, f: 0.6 },
      { name: 'Roasted Bell Peppers', cal: 31, p: 1.0, c: 6.0, f: 0.3 },
      { name: 'Baby Spinach', cal: 23, p: 2.9, c: 3.6, f: 0.4 },
    ],
    fruits: [
      { name: 'Dates (Medjool, 2 pcs ~48g)', cal: 133, p: 0.9, c: 36.0, f: 0.1 },
      { name: 'Banana', cal: 89, p: 1.1, c: 23.0, f: 0.3 },
      { name: 'Watermelon', cal: 30, p: 0.6, c: 7.6, f: 0.2 },
      { name: 'Mango', cal: 60, p: 0.8, c: 15.0, f: 0.4 },
      { name: 'Apple', cal: 52, p: 0.3, c: 14.0, f: 0.2 },
      { name: 'Pomegranate seeds', cal: 83, p: 1.7, c: 18.7, f: 1.2 },
    ],
    mealCulture: 'Arabic breakfast (Foul, Labneh, eggs, Khubz), Shawarma-style protein with rice or bulgur for lunch, Grilled fish/lamb with vegetable sides for dinner. Dates are a culturally significant snack. Tahini and olive oil used widely.',
  },

  // ── South Asia (India, Pakistan, Bangladesh, Sri Lanka, Nepal) ──
  south_asia: {
    keywords: ['india','mumbai','delhi','bangalore','hyderabad','chennai','kolkata','pakistan','karachi','lahore','islamabad','bangladesh','dhaka','sri lanka','colombo','nepal','kathmandu'],
    label: 'South Asia',
    proteins: [
      { name: 'Chicken Tikka (grilled, no cream)', cal: 163, p: 28.0, c: 2.5, f: 4.5 },
      { name: 'Dal (cooked yellow lentils)', cal: 116, p: 9.0, c: 20.0, f: 0.5 },
      { name: 'Paneer (Indian cottage cheese)', cal: 265, p: 18.3, c: 3.4, f: 20.8 },
      { name: 'Boiled Eggs', cal: 155, p: 13.0, c: 1.1, f: 11.0 },
      { name: 'Rohu Fish (steamed/grilled)', cal: 97,  p: 16.6, c: 0.0, f: 3.3 },
      { name: 'Grilled Chicken Breast', cal: 165, p: 31.0, c: 0.0, f: 3.6 },
      { name: 'Rajma (cooked red kidney beans)', cal: 127, p: 8.7, c: 22.8, f: 0.5 },
      { name: 'Chole (cooked chickpeas)', cal: 164, p: 8.9, c: 27.0, f: 2.6 },
      { name: 'Low-fat Dahi (curd/yogurt)', cal: 63,  p: 5.0, c: 4.7, f: 1.5 },
      { name: 'Tofu (firm, grilled)', cal: 76,  p: 8.0, c: 1.9, f: 4.3 },
      { name: 'Moong Dal Sprouts', cal: 30,  p: 3.0, c: 5.9, f: 0.2 },
    ],
    carbs: [
      { name: 'Cooked Basmati Rice', cal: 130, p: 2.7, c: 28.0, f: 0.3 },
      { name: 'Whole Wheat Roti (1 roti ~40g)', cal: 104, p: 3.5, c: 20.0, f: 1.2 },
      { name: 'Cooked Brown Rice', cal: 112, p: 2.6, c: 23.5, f: 0.9 },
      { name: 'Rolled Oats (Quaker)', cal: 389, p: 17.0, c: 66.0, f: 7.0 },
      { name: 'Cooked Quinoa', cal: 120, p: 4.4, c: 21.3, f: 1.9 },
      { name: 'Sweet Potato (boiled)', cal: 86,  p: 1.6, c: 20.0, f: 0.1 },
      { name: 'Poha (cooked flattened rice)', cal: 110, p: 2.4, c: 23.0, f: 0.5 },
      { name: 'Upma (semolina, no excess oil)', cal: 160, p: 3.5, c: 28.0, f: 3.5 },
      { name: 'Idli (steamed rice cake, 1 pc ~30g)', cal: 39, p: 1.5, c: 8.0, f: 0.2 },
    ],
    fats: [
      { name: 'Ghee (clarified butter)', cal: 900, p: 0.0, c: 0.0, f: 100.0 },
      { name: 'Coconut oil', cal: 862, p: 0.0, c: 0.0, f: 100.0 },
      { name: 'Peanut Butter', cal: 588, p: 25.0, c: 20.0, f: 50.0 },
      { name: 'Almonds (badam)', cal: 579, p: 21.0, c: 22.0, f: 50.0 },
      { name: 'Walnuts (akhrot)', cal: 654, p: 15.0, c: 14.0, f: 65.0 },
      { name: 'Mustard oil (1 tsp)', cal: 45,  p: 0.0, c: 0.0, f: 5.0 },
    ],
    veggies: [
      { name: 'Spinach (palak, cooked)', cal: 23, p: 2.9, c: 3.6, f: 0.4 },
      { name: 'Bottle Gourd (lauki, cooked)', cal: 15, p: 0.6, c: 3.4, f: 0.1 },
      { name: 'Cauliflower (gobi, steamed)', cal: 25, p: 1.9, c: 5.0, f: 0.3 },
      { name: 'Bitter Gourd (karela)', cal: 17, p: 1.0, c: 3.7, f: 0.2 },
      { name: 'Green Beans (French beans)', cal: 31, p: 1.8, c: 7.0, f: 0.1 },
      { name: 'Brinjal/Eggplant (baingan, grilled)', cal: 25, p: 1.0, c: 5.9, f: 0.2 },
      { name: 'Ridge Gourd (turai)', cal: 14, p: 0.7, c: 3.3, f: 0.1 },
      { name: 'Tomato', cal: 18, p: 0.9, c: 3.9, f: 0.2 },
    ],
    fruits: [
      { name: 'Banana', cal: 89, p: 1.1, c: 23.0, f: 0.3 },
      { name: 'Mango (Alphonso)', cal: 60,  p: 0.8, c: 15.0, f: 0.4 },
      { name: 'Papaya (sliced)', cal: 43,  p: 0.5, c: 11.0, f: 0.3 },
      { name: 'Guava', cal: 68,  p: 2.6, c: 14.0, f: 1.0 },
      { name: 'Apple (Shimla)', cal: 52, p: 0.3, c: 14.0, f: 0.2 },
      { name: 'Pomegranate', cal: 83, p: 1.7, c: 18.7, f: 1.2 },
    ],
    mealCulture: 'Dal-rice or roti as staple base. Chicken tikka, fish curry or paneer as protein. Dahi (curd) as probiotic. Heavy use of spices (turmeric, cumin, coriander). Avoid excessive ghee/oil; use minimal cooking fat for fitness plans.',
  },

  // ── West Africa (Nigeria, Ghana, Cameroon, Senegal, Ivory Coast, Mali) ──
  west_africa: {
    keywords: ['nigeria','lagos','abuja','ghana','accra','cameroon','douala','yaoundé','senegal','dakar','ivory coast','abidjan','mali','bamako','benin','togo'],
    label: 'West Africa',
    proteins: [
      { name: 'Grilled Tilapia', cal: 96,  p: 20.1, c: 0.0, f: 1.7 },
      { name: 'Boiled Chicken (without skin)', cal: 165, p: 31.0, c: 0.0, f: 3.6 },
      { name: 'Grilled Catfish', cal: 95,  p: 16.4, c: 0.0, f: 2.8 },
      { name: 'Boiled Eggs', cal: 155, p: 13.0, c: 1.1, f: 11.0 },
      { name: 'Smoked Mackerel (Titus fish)', cal: 205, p: 18.5, c: 0.0, f: 13.9 },
      { name: 'Grilled Beef (suya, lean)', cal: 185, p: 26.0, c: 3.5, f: 7.5 },
      { name: 'Black-eyed Peas (cooked)', cal: 116, p: 8.0, c: 21.0, f: 0.5 },
      { name: 'Groundnut (peanut, boiled)', cal: 567, p: 25.8, c: 16.1, f: 49.2 },
    ],
    carbs: [
      { name: 'Boiled Yam', cal: 118, p: 1.5, c: 27.9, f: 0.2 },
      { name: 'Cooked White Rice', cal: 130, p: 2.7, c: 28.2, f: 0.3 },
      { name: 'Eba / Garri (cooked)', cal: 357, p: 1.5, c: 84.0, f: 0.5 },
      { name: 'Cooked Brown Rice', cal: 112, p: 2.6, c: 23.5, f: 0.9 },
      { name: 'Boiled Plantain (unripe)', cal: 122, p: 1.3, c: 31.0, f: 0.4 },
      { name: 'Sweet Potato (boiled)', cal: 86,  p: 1.6, c: 20.0, f: 0.1 },
      { name: 'Rolled Oats', cal: 389, p: 17.0, c: 66.0, f: 7.0 },
      { name: 'Cooked Beans (brown cowpeas)', cal: 127, p: 8.7, c: 23.0, f: 0.5 },
    ],
    fats: [
      { name: 'Palm oil (red, 1 tsp)', cal: 45, p: 0.0, c: 0.0, f: 5.0 },
      { name: 'Groundnut oil', cal: 884, p: 0.0, c: 0.0, f: 100.0 },
      { name: 'Peanut butter (groundnut paste)', cal: 588, p: 25.0, c: 20.0, f: 50.0 },
      { name: 'Coconut milk (light)', cal: 97,  p: 1.0, c: 2.8, f: 9.6 },
      { name: 'Walnuts', cal: 654, p: 15.0, c: 14.0, f: 65.0 },
    ],
    veggies: [
      { name: 'Ugwu (fluted pumpkin leaves)', cal: 25, p: 3.0, c: 4.0, f: 0.4 },
      { name: 'Okra (boiled)', cal: 33, p: 2.0, c: 7.5, f: 0.2 },
      { name: 'Bitter Leaf (cooked)', cal: 22, p: 2.5, c: 3.5, f: 0.3 },
      { name: 'Garden Egg (African eggplant)', cal: 25, p: 1.0, c: 5.9, f: 0.2 },
      { name: 'Tomatoes (stewed)', cal: 18, p: 0.9, c: 3.9, f: 0.2 },
      { name: 'Cabbage (cooked)', cal: 25, p: 1.3, c: 5.8, f: 0.1 },
      { name: 'Spinach (cooked)', cal: 23, p: 2.9, c: 3.6, f: 0.4 },
    ],
    fruits: [
      { name: 'Plantain (ripe, boiled)', cal: 122, p: 1.3, c: 31.0, f: 0.4 },
      { name: 'Pawpaw (papaya)', cal: 43, p: 0.5, c: 11.0, f: 0.3 },
      { name: 'Mango', cal: 60, p: 0.8, c: 15.0, f: 0.4 },
      { name: 'Pineapple', cal: 50, p: 0.5, c: 13.1, f: 0.1 },
      { name: 'Watermelon', cal: 30, p: 0.6, c: 7.6, f: 0.2 },
      { name: 'Banana', cal: 89, p: 1.1, c: 23.0, f: 0.3 },
    ],
    mealCulture: 'Protein from grilled fish (tilapia, catfish, mackerel), chicken, eggs. Carbs from yam, rice, plantain, garri. Soups/stews (egusi, okra, vegetable) cooked with minimal palm oil. Beans and groundnuts provide plant protein.',
  },

  // ── East Africa (Kenya, Ethiopia, Tanzania, Uganda) ──
  east_africa: {
    keywords: ['kenya','nairobi','mombasa','ethiopia','addis ababa','tanzania','dar es salaam','arusha','uganda','kampala'],
    label: 'East Africa',
    proteins: [
      { name: 'Nyama Choma (grilled beef, lean)', cal: 185, p: 26.0, c: 0.0, f: 8.0 },
      { name: 'Grilled Tilapia', cal: 96, p: 20.1, c: 0.0, f: 1.7 },
      { name: 'Boiled Eggs', cal: 155, p: 13.0, c: 1.1, f: 11.0 },
      { name: 'Grilled Chicken', cal: 165, p: 31.0, c: 0.0, f: 3.6 },
      { name: 'Lentils (Misir / cooked)', cal: 116, p: 9.0, c: 20.0, f: 0.4 },
      { name: 'Mung Beans (cooked)', cal: 105, p: 7.0, c: 19.0, f: 0.4 },
    ],
    carbs: [
      { name: 'Ugali (maize meal porridge)', cal: 360, p: 8.0, c: 77.0, f: 1.5 },
      { name: 'Cooked Brown Rice', cal: 112, p: 2.6, c: 23.5, f: 0.9 },
      { name: 'Injera (Ethiopian teff flatbread, 1 piece)', cal: 124, p: 3.5, c: 24.0, f: 0.8 },
      { name: 'Sweet Potato (boiled)', cal: 86, p: 1.6, c: 20.0, f: 0.1 },
      { name: 'Matoke (boiled green banana)', cal: 89, p: 1.0, c: 22.8, f: 0.3 },
      { name: 'Rolled Oats', cal: 389, p: 17.0, c: 66.0, f: 7.0 },
    ],
    fats: [
      { name: 'Avocado', cal: 160, p: 2.0, c: 9.0, f: 15.0 },
      { name: 'Groundnut oil', cal: 884, p: 0.0, c: 0.0, f: 100.0 },
      { name: 'Almonds', cal: 579, p: 21.0, c: 22.0, f: 50.0 },
    ],
    veggies: [
      { name: 'Sukuma Wiki (collard greens, cooked)', cal: 32, p: 2.5, c: 6.5, f: 0.5 },
      { name: 'Cabbage (cooked)', cal: 25, p: 1.3, c: 5.8, f: 0.1 },
      { name: 'Tomatoes', cal: 18, p: 0.9, c: 3.9, f: 0.2 },
      { name: 'Spinach (cooked)', cal: 23, p: 2.9, c: 3.6, f: 0.4 },
      { name: 'Kale (cooked)', cal: 28, p: 1.9, c: 5.6, f: 0.4 },
    ],
    fruits: [
      { name: 'Mango', cal: 60, p: 0.8, c: 15.0, f: 0.4 },
      { name: 'Banana', cal: 89, p: 1.1, c: 23.0, f: 0.3 },
      { name: 'Passion fruit', cal: 97, p: 2.2, c: 23.4, f: 0.7 },
      { name: 'Pineapple', cal: 50, p: 0.5, c: 13.1, f: 0.1 },
      { name: 'Avocado (half)', cal: 160, p: 2.0, c: 9.0, f: 15.0 },
    ],
    mealCulture: 'Ugali or injera as staple carb base. Protein from grilled/boiled fish, chicken, eggs and legumes. Sukuma Wiki (collard greens) is a daily vegetable staple. Avocado abundant. Minimal processed food culture.',
  },

  // ── Southeast Asia (Philippines, Indonesia, Malaysia, Thailand, Vietnam) ──
  southeast_asia: {
    keywords: ['philippines','manila','cebu','indonesia','jakarta','bali','surabaya','malaysia','kuala lumpur','penang','thailand','bangkok','chiang mai','vietnam','ho chi minh','hanoi','singapore','myanmar','yangon','cambodia','phnom penh'],
    label: 'Southeast Asia',
    proteins: [
      { name: 'Steamed Fish Fillet (local)', cal: 105, p: 22.0, c: 0.0, f: 1.8 },
      { name: 'Grilled Chicken (Ayam Bakar)', cal: 165, p: 31.0, c: 2.0, f: 3.6 },
      { name: 'Boiled Eggs (itlog/telur)', cal: 155, p: 13.0, c: 1.1, f: 11.0 },
      { name: 'Tofu (firm, steamed)', cal: 76, p: 8.0, c: 1.9, f: 4.3 },
      { name: 'Tempeh (fermented soy)', cal: 195, p: 20.7, c: 7.6, f: 10.8 },
      { name: 'Tinned Tuna in water', cal: 116, p: 26.0, c: 0.0, f: 1.0 },
      { name: 'Prawn/Shrimp (boiled)', cal: 99, p: 21.0, c: 0.0, f: 1.1 },
      { name: 'Pork tenderloin (grilled, lean)', cal: 143, p: 26.2, c: 0.0, f: 3.5 },
      { name: 'Black-eyed Peas', cal: 116, p: 8.0, c: 21.0, f: 0.5 },
    ],
    carbs: [
      { name: 'Cooked Jasmine Rice', cal: 130, p: 2.7, c: 28.0, f: 0.3 },
      { name: 'Cooked Brown Rice', cal: 112, p: 2.6, c: 23.5, f: 0.9 },
      { name: 'Rice noodles (cooked)', cal: 109, p: 1.8, c: 25.2, f: 0.2 },
      { name: 'Sweet potato (boiled)', cal: 86, p: 1.6, c: 20.0, f: 0.1 },
      { name: 'Rolled Oats', cal: 389, p: 17.0, c: 66.0, f: 7.0 },
      { name: 'Banana (saba variety)', cal: 89, p: 1.1, c: 23.0, f: 0.3 },
      { name: 'Cassava (boiled)', cal: 160, p: 1.4, c: 38.1, f: 0.3 },
    ],
    fats: [
      { name: 'Coconut oil', cal: 862, p: 0.0, c: 0.0, f: 100.0 },
      { name: 'Peanuts (roasted, unsalted)', cal: 567, p: 25.8, c: 16.1, f: 49.2 },
      { name: 'Coconut milk (light)', cal: 97, p: 1.0, c: 2.8, f: 9.6 },
      { name: 'Sesame oil (1 tsp)', cal: 40, p: 0.0, c: 0.0, f: 4.5 },
      { name: 'Avocado', cal: 160, p: 2.0, c: 9.0, f: 15.0 },
    ],
    veggies: [
      { name: 'Kangkong (water spinach, stir-fried)', cal: 19, p: 2.6, c: 3.1, f: 0.2 },
      { name: 'Bok Choy (stir-fried)', cal: 13, p: 1.5, c: 2.2, f: 0.2 },
      { name: 'Bean Sprouts (blanched)', cal: 30, p: 3.0, c: 5.9, f: 0.2 },
      { name: 'Long Beans (cooked)', cal: 47, p: 2.8, c: 10.5, f: 0.4 },
      { name: 'Bitter Melon (stir-fried)', cal: 17, p: 1.0, c: 3.7, f: 0.2 },
      { name: 'Cabbage (stir-fried)', cal: 25, p: 1.3, c: 5.8, f: 0.1 },
      { name: 'Eggplant (grilled)', cal: 25, p: 1.0, c: 5.9, f: 0.2 },
    ],
    fruits: [
      { name: 'Mango (green/ripe)', cal: 60, p: 0.8, c: 15.0, f: 0.4 },
      { name: 'Papaya', cal: 43, p: 0.5, c: 11.0, f: 0.3 },
      { name: 'Pineapple', cal: 50, p: 0.5, c: 13.1, f: 0.1 },
      { name: 'Dragon fruit', cal: 60, p: 1.2, c: 13.0, f: 0.6 },
      { name: 'Watermelon', cal: 30, p: 0.6, c: 7.6, f: 0.2 },
      { name: 'Banana', cal: 89, p: 1.1, c: 23.0, f: 0.3 },
    ],
    mealCulture: 'Rice as primary carb. Protein from grilled fish, chicken, tofu, tempeh, eggs. Stir-fried or steamed vegetables. Coconut milk in cooking. Minimal dairy. Noodle soups common for breakfast/lunch.',
  },

  // ── East Asia (China, Japan, South Korea) ──
  east_asia: {
    keywords: ['china','beijing','shanghai','guangzhou','shenzhen','chengdu','japan','tokyo','osaka','kyoto','south korea','seoul','busan','taiwan','taipei','hong kong'],
    label: 'East Asia',
    proteins: [
      { name: 'Steamed Tofu (silken/firm)', cal: 76, p: 8.0, c: 1.9, f: 4.3 },
      { name: 'Grilled Salmon', cal: 208, p: 28.0, c: 0.0, f: 10.0 },
      { name: 'Boiled Eggs', cal: 155, p: 13.0, c: 1.1, f: 11.0 },
      { name: 'Edamame (steamed soybeans)', cal: 122, p: 11.9, c: 8.9, f: 5.2 },
      { name: 'Grilled Chicken Breast', cal: 165, p: 31.0, c: 0.0, f: 3.6 },
      { name: 'Grilled Mackerel (saba)', cal: 205, p: 18.5, c: 0.0, f: 13.9 },
      { name: 'Tuna Sashimi', cal: 108, p: 23.0, c: 0.0, f: 0.9 },
      { name: 'Pork Tenderloin (lean, grilled)', cal: 143, p: 26.2, c: 0.0, f: 3.5 },
      { name: 'Prawn (steamed)', cal: 99, p: 21.0, c: 0.0, f: 1.1 },
    ],
    carbs: [
      { name: 'Cooked Japanese Rice (white)', cal: 130, p: 2.7, c: 28.0, f: 0.3 },
      { name: 'Soba Noodles (cooked)', cal: 99, p: 5.1, c: 21.4, f: 0.1 },
      { name: 'Cooked Brown Rice', cal: 112, p: 2.6, c: 23.5, f: 0.9 },
      { name: 'Rolled Oats', cal: 389, p: 17.0, c: 66.0, f: 7.0 },
      { name: 'Sweet Potato (Japanese, baked)', cal: 86, p: 1.6, c: 20.0, f: 0.1 },
      { name: 'Congee / Rice porridge', cal: 65, p: 1.5, c: 14.0, f: 0.2 },
      { name: 'Udon noodles (cooked)', cal: 117, p: 3.0, c: 24.0, f: 0.6 },
    ],
    fats: [
      { name: 'Sesame oil (1 tsp)', cal: 40, p: 0.0, c: 0.0, f: 4.5 },
      { name: 'Sesame seeds', cal: 573, p: 17.7, c: 23.5, f: 49.7 },
      { name: 'Walnuts', cal: 654, p: 15.0, c: 14.0, f: 65.0 },
      { name: 'Almonds', cal: 579, p: 21.0, c: 22.0, f: 50.0 },
      { name: 'Peanut butter', cal: 588, p: 25.0, c: 20.0, f: 50.0 },
    ],
    veggies: [
      { name: 'Broccoli (steamed)', cal: 55, p: 3.7, c: 11.0, f: 0.6 },
      { name: 'Bok Choy (stir-fried)', cal: 13, p: 1.5, c: 2.2, f: 0.2 },
      { name: 'Napa Cabbage (cooked)', cal: 17, p: 1.2, c: 3.2, f: 0.2 },
      { name: 'Shiitake Mushrooms (sautéed)', cal: 34, p: 2.2, c: 6.8, f: 0.5 },
      { name: 'Spinach (blanched)', cal: 23, p: 2.9, c: 3.6, f: 0.4 },
      { name: 'Bean Sprouts (blanched)', cal: 30, p: 3.0, c: 5.9, f: 0.2 },
      { name: 'Seaweed / Wakame (rehydrated)', cal: 45, p: 3.0, c: 9.1, f: 0.6 },
    ],
    fruits: [
      { name: 'Mandarin orange', cal: 53, p: 0.8, c: 13.3, f: 0.3 },
      { name: 'Apple', cal: 52, p: 0.3, c: 14.0, f: 0.2 },
      { name: 'Kiwi', cal: 61, p: 1.1, c: 14.7, f: 0.5 },
      { name: 'Blueberries', cal: 57, p: 0.7, c: 14.5, f: 0.3 },
      { name: 'Watermelon', cal: 30, p: 0.6, c: 7.6, f: 0.2 },
    ],
    mealCulture: 'Rice or noodles as carb base. Grilled fish, tofu, eggs as protein. Steamed or stir-fried vegetables. Miso soup common in Japanese diets. Soy-based fermented foods (tofu, miso, edamame). Minimal dairy.',
  },

  // ── Western Europe (UK, Germany, France, Italy, Spain, Netherlands) ──
  western_europe: {
    keywords: ['uk','london','manchester','birmingham','germany','berlin','munich','france','paris','italy','rome','milan','spain','madrid','barcelona','netherlands','amsterdam','belgium','brussels','sweden','stockholm','norway','oslo','denmark','copenhagen','switzerland','zurich','austria','vienna','portugal','lisbon'],
    label: 'Western Europe',
    proteins: [
      { name: 'Grilled Chicken Breast', cal: 165, p: 31.0, c: 0.0, f: 3.6 },
      { name: 'Salmon Fillet (baked)', cal: 208, p: 28.0, c: 0.0, f: 10.0 },
      { name: 'Tuna (canned in water)', cal: 116, p: 26.0, c: 0.0, f: 1.0 },
      { name: 'Greek Yogurt (0% fat)', cal: 59, p: 10.2, c: 3.6, f: 0.4 },
      { name: 'Whole Eggs (boiled)', cal: 155, p: 13.0, c: 1.1, f: 11.0 },
      { name: 'Lean Beef Mince (cooked)', cal: 215, p: 26.0, c: 0.0, f: 11.5 },
      { name: 'Cottage Cheese (low fat)', cal: 98, p: 11.0, c: 3.4, f: 4.3 },
      { name: 'Smoked Salmon', cal: 117, p: 18.3, c: 0.0, f: 4.3 },
      { name: 'Turkey Breast (sliced, cooked)', cal: 135, p: 30.0, c: 0.0, f: 1.0 },
      { name: 'Cooked Lentils', cal: 116, p: 9.0, c: 20.0, f: 0.4 },
    ],
    carbs: [
      { name: 'Rolled Oats', cal: 389, p: 17.0, c: 66.0, f: 7.0 },
      { name: 'Whole Grain Bread (1 slice ~40g)', cal: 97, p: 4.0, c: 18.3, f: 1.3 },
      { name: 'Cooked Brown Rice', cal: 112, p: 2.6, c: 23.5, f: 0.9 },
      { name: 'Cooked Quinoa', cal: 120, p: 4.4, c: 21.3, f: 1.9 },
      { name: 'Sweet Potato (baked)', cal: 86, p: 1.6, c: 20.0, f: 0.1 },
      { name: 'Pasta (whole wheat, cooked)', cal: 124, p: 5.3, c: 26.5, f: 1.0 },
      { name: 'New Potatoes (boiled)', cal: 75, p: 1.8, c: 17.4, f: 0.1 },
    ],
    fats: [
      { name: 'Extra Virgin Olive Oil', cal: 884, p: 0.0, c: 0.0, f: 100.0 },
      { name: 'Almonds', cal: 579, p: 21.0, c: 22.0, f: 50.0 },
      { name: 'Avocado', cal: 160, p: 2.0, c: 9.0, f: 15.0 },
      { name: 'Walnuts', cal: 654, p: 15.0, c: 14.0, f: 65.0 },
      { name: 'Peanut Butter (natural)', cal: 588, p: 25.0, c: 20.0, f: 50.0 },
    ],
    veggies: [
      { name: 'Broccoli (steamed)', cal: 55, p: 3.7, c: 11.0, f: 0.6 },
      { name: 'Baby Spinach (raw)', cal: 23, p: 2.9, c: 3.6, f: 0.4 },
      { name: 'Mixed Salad Leaves', cal: 16, p: 1.5, c: 2.8, f: 0.2 },
      { name: 'Cherry Tomatoes', cal: 18, p: 0.9, c: 3.9, f: 0.2 },
      { name: 'Roasted Asparagus', cal: 20, p: 2.2, c: 3.9, f: 0.1 },
      { name: 'Kale (steamed)', cal: 28, p: 1.9, c: 5.6, f: 0.4 },
      { name: 'Courgette / Zucchini (grilled)', cal: 17, p: 1.2, c: 3.1, f: 0.3 },
    ],
    fruits: [
      { name: 'Apple', cal: 52, p: 0.3, c: 14.0, f: 0.2 },
      { name: 'Blueberries', cal: 57, p: 0.7, c: 14.5, f: 0.3 },
      { name: 'Banana', cal: 89, p: 1.1, c: 23.0, f: 0.3 },
      { name: 'Strawberries', cal: 32, p: 0.7, c: 7.7, f: 0.3 },
      { name: 'Orange', cal: 47, p: 0.9, c: 11.8, f: 0.1 },
    ],
    mealCulture: 'Oats for breakfast. Whole grain bread, pasta, rice, quinoa as carbs. Chicken, fish, eggs, Greek yogurt as protein. Olive oil and avocado as fats. High vegetable intake: broccoli, kale, salads.',
  },

  // ── North America (USA, Canada, Mexico) ──
  north_america: {
    keywords: ['usa','united states','new york','los angeles','chicago','houston','phoenix','philadelphia','san antonio','san diego','dallas','canada','toronto','vancouver','montreal','calgary','mexico','mexico city','guadalajara','monterrey'],
    label: 'North America',
    proteins: [
      { name: 'Grilled Chicken Breast', cal: 165, p: 31.0, c: 0.0, f: 3.6 },
      { name: 'Tuna (canned in water)', cal: 116, p: 26.0, c: 0.0, f: 1.0 },
      { name: 'Salmon Fillet (baked)', cal: 208, p: 28.0, c: 0.0, f: 10.0 },
      { name: 'Greek Yogurt (non-fat)', cal: 59, p: 10.2, c: 3.6, f: 0.4 },
      { name: 'Whole Eggs (scrambled)', cal: 155, p: 13.0, c: 1.1, f: 11.0 },
      { name: 'Turkey Breast (grilled)', cal: 135, p: 30.0, c: 0.0, f: 1.0 },
      { name: 'Lean Ground Beef 93% (cooked)', cal: 215, p: 26.0, c: 0.0, f: 11.5 },
      { name: 'Cottage Cheese (1% fat)', cal: 72, p: 12.4, c: 2.7, f: 1.0 },
      { name: 'Black Beans (cooked)', cal: 132, p: 8.9, c: 23.7, f: 0.5 },
      { name: 'Whey Protein Shake (1 scoop 30g)', cal: 120, p: 25.0, c: 3.0, f: 1.5 },
    ],
    carbs: [
      { name: 'Rolled Oats', cal: 389, p: 17.0, c: 66.0, f: 7.0 },
      { name: 'Cooked Brown Rice', cal: 112, p: 2.6, c: 23.5, f: 0.9 },
      { name: 'Sweet Potato (baked)', cal: 86, p: 1.6, c: 20.0, f: 0.1 },
      { name: 'Whole Grain Bread (1 slice)', cal: 97, p: 4.0, c: 18.3, f: 1.3 },
      { name: 'Cooked Quinoa', cal: 120, p: 4.4, c: 21.3, f: 1.9 },
      { name: 'Corn Tortilla (1 pc ~26g)', cal: 52, p: 1.4, c: 11.0, f: 0.7 },
      { name: 'Banana', cal: 89, p: 1.1, c: 23.0, f: 0.3 },
    ],
    fats: [
      { name: 'Avocado', cal: 160, p: 2.0, c: 9.0, f: 15.0 },
      { name: 'Almonds', cal: 579, p: 21.0, c: 22.0, f: 50.0 },
      { name: 'Peanut Butter (natural)', cal: 588, p: 25.0, c: 20.0, f: 50.0 },
      { name: 'Olive Oil', cal: 884, p: 0.0, c: 0.0, f: 100.0 },
      { name: 'Walnuts', cal: 654, p: 15.0, c: 14.0, f: 65.0 },
    ],
    veggies: [
      { name: 'Broccoli (steamed)', cal: 55, p: 3.7, c: 11.0, f: 0.6 },
      { name: 'Baby Spinach', cal: 23, p: 2.9, c: 3.6, f: 0.4 },
      { name: 'Bell Peppers (roasted)', cal: 31, p: 1.0, c: 6.0, f: 0.3 },
      { name: 'Asparagus (steamed)', cal: 20, p: 2.2, c: 3.9, f: 0.1 },
      { name: 'Cherry Tomatoes', cal: 18, p: 0.9, c: 3.9, f: 0.2 },
      { name: 'Kale (steamed)', cal: 28, p: 1.9, c: 5.6, f: 0.4 },
    ],
    fruits: [
      { name: 'Blueberries', cal: 57, p: 0.7, c: 14.5, f: 0.3 },
      { name: 'Banana', cal: 89, p: 1.1, c: 23.0, f: 0.3 },
      { name: 'Apple', cal: 52, p: 0.3, c: 14.0, f: 0.2 },
      { name: 'Strawberries', cal: 32, p: 0.7, c: 7.7, f: 0.3 },
      { name: 'Orange', cal: 47, p: 0.9, c: 11.8, f: 0.1 },
    ],
    mealCulture: 'Oats or eggs for breakfast. Chicken, turkey, fish, cottage cheese as protein. Brown rice, quinoa, sweet potato as carbs. Avocado and nuts as fats. High protein culture — protein shakes common.',
  },

  // ── South America (Brazil, Argentina, Colombia, Chile, Peru) ──
  south_america: {
    keywords: ['brazil','são paulo','rio de janeiro','brasilia','argentina','buenos aires','colombia','bogota','medellin','chile','santiago','peru','lima','venezuela','caracas','ecuador','quito','bolivia','la paz'],
    label: 'South America',
    proteins: [
      { name: 'Grilled Chicken (Frango Grelhado)', cal: 165, p: 31.0, c: 0.0, f: 3.6 },
      { name: 'Grilled Beef (Churrasco, lean cut)', cal: 185, p: 26.0, c: 0.0, f: 8.0 },
      { name: 'Boiled Eggs', cal: 155, p: 13.0, c: 1.1, f: 11.0 },
      { name: 'Grilled Fish (Tilapia/Sea Bass)', cal: 105, p: 22.0, c: 0.0, f: 1.8 },
      { name: 'Cooked Black Beans (Feijão)', cal: 132, p: 8.9, c: 23.7, f: 0.5 },
      { name: 'Ceviche Shrimp (no cream)', cal: 99, p: 21.0, c: 2.0, f: 1.1 },
      { name: 'Low-fat Yogurt (natural)', cal: 63, p: 5.0, c: 7.0, f: 1.5 },
    ],
    carbs: [
      { name: 'Cooked White Rice', cal: 130, p: 2.7, c: 28.2, f: 0.3 },
      { name: 'Cooked Brown Rice', cal: 112, p: 2.6, c: 23.5, f: 0.9 },
      { name: 'Cassava (mandioca, boiled)', cal: 160, p: 1.4, c: 38.1, f: 0.3 },
      { name: 'Rolled Oats', cal: 389, p: 17.0, c: 66.0, f: 7.0 },
      { name: 'Sweet Potato (boiled)', cal: 86, p: 1.6, c: 20.0, f: 0.1 },
      { name: 'Corn (cooked, on cob)', cal: 86, p: 3.2, c: 19.0, f: 1.2 },
      { name: 'Quinoa (cooked)', cal: 120, p: 4.4, c: 21.3, f: 1.9 },
    ],
    fats: [
      { name: 'Avocado', cal: 160, p: 2.0, c: 9.0, f: 15.0 },
      { name: 'Olive Oil', cal: 884, p: 0.0, c: 0.0, f: 100.0 },
      { name: 'Peanut Butter', cal: 588, p: 25.0, c: 20.0, f: 50.0 },
      { name: 'Cashew nuts', cal: 553, p: 18.2, c: 30.2, f: 43.9 },
    ],
    veggies: [
      { name: 'Couve (collard greens, sautéed)', cal: 32, p: 2.5, c: 6.5, f: 0.5 },
      { name: 'Tomatoes', cal: 18, p: 0.9, c: 3.9, f: 0.2 },
      { name: 'Broccoli (steamed)', cal: 55, p: 3.7, c: 11.0, f: 0.6 },
      { name: 'Spinach (cooked)', cal: 23, p: 2.9, c: 3.6, f: 0.4 },
      { name: 'Zucchini (grilled)', cal: 17, p: 1.2, c: 3.1, f: 0.3 },
    ],
    fruits: [
      { name: 'Banana', cal: 89, p: 1.1, c: 23.0, f: 0.3 },
      { name: 'Papaya', cal: 43, p: 0.5, c: 11.0, f: 0.3 },
      { name: 'Mango', cal: 60, p: 0.8, c: 15.0, f: 0.4 },
      { name: 'Passion fruit', cal: 97, p: 2.2, c: 23.4, f: 0.7 },
      { name: 'Pineapple', cal: 50, p: 0.5, c: 13.1, f: 0.1 },
      { name: 'Avocado (half)', cal: 80, p: 1.0, c: 4.5, f: 7.5 },
    ],
    mealCulture: 'Rice and beans (staple combo). Grilled chicken and beef. Cassava and corn as local carbs. Avocado abundant. Tropical fruits daily. Minimal dairy except yogurt.',
  },

  // ── DEFAULT (International / Unknown) ──
  default: {
    keywords: [],
    label: 'International',
    proteins: [
      { name: 'Grilled Chicken Breast', cal: 165, p: 31.0, c: 0.0, f: 3.6 },
      { name: 'Salmon Fillet (baked)', cal: 208, p: 28.0, c: 0.0, f: 10.0 },
      { name: 'Tuna (canned in water)', cal: 116, p: 26.0, c: 0.0, f: 1.0 },
      { name: 'Boiled Eggs', cal: 155, p: 13.0, c: 1.1, f: 11.0 },
      { name: 'Greek Yogurt (0% fat)', cal: 59, p: 10.2, c: 3.6, f: 0.4 },
      { name: 'Cooked Lentils', cal: 116, p: 9.0, c: 20.0, f: 0.4 },
      { name: 'Cottage Cheese', cal: 98, p: 11.0, c: 3.4, f: 4.3 },
    ],
    carbs: [
      { name: 'Rolled Oats', cal: 389, p: 17.0, c: 66.0, f: 7.0 },
      { name: 'Cooked Brown Rice', cal: 112, p: 2.6, c: 23.5, f: 0.9 },
      { name: 'Sweet Potato (boiled)', cal: 86, p: 1.6, c: 20.0, f: 0.1 },
      { name: 'Banana', cal: 89, p: 1.1, c: 23.0, f: 0.3 },
      { name: 'Cooked Quinoa', cal: 120, p: 4.4, c: 21.3, f: 1.9 },
    ],
    fats: [
      { name: 'Olive Oil', cal: 884, p: 0.0, c: 0.0, f: 100.0 },
      { name: 'Almonds', cal: 579, p: 21.0, c: 22.0, f: 50.0 },
      { name: 'Avocado', cal: 160, p: 2.0, c: 9.0, f: 15.0 },
    ],
    veggies: [
      { name: 'Broccoli (steamed)', cal: 55, p: 3.7, c: 11.0, f: 0.6 },
      { name: 'Spinach', cal: 23, p: 2.9, c: 3.6, f: 0.4 },
      { name: 'Mixed Vegetables', cal: 65, p: 2.0, c: 13.0, f: 0.5 },
    ],
    fruits: [
      { name: 'Apple', cal: 52, p: 0.3, c: 14.0, f: 0.2 },
      { name: 'Banana', cal: 89, p: 1.1, c: 23.0, f: 0.3 },
      { name: 'Orange', cal: 47, p: 0.9, c: 11.8, f: 0.1 },
    ],
    mealCulture: 'Balanced international diet using globally available whole foods.',
  },
};

// ── Detect region from location string ──
function detectRegion(locationStr) {
  if (!locationStr) return REGIONAL_FOOD_DB.default;
  const loc = locationStr.toLowerCase();
  for (const [, region] of Object.entries(REGIONAL_FOOD_DB)) {
    if (region.keywords && region.keywords.some(k => loc.includes(k))) {
      return region;
    }
  }
  return REGIONAL_FOOD_DB.default;
}

// ── Format regional foods as a readable list for the prompt ──
function buildRegionalFoodList(region) {
  const fmt = (arr) => arr.map(f => `  • ${f.name} — ${f.cal} kcal | P: ${f.p}g | C: ${f.c}g | F: ${f.f}g (per 100g)`).join('\n');
  return `PROTEINS:\n${fmt(region.proteins)}\n\nCARBS:\n${fmt(region.carbs)}\n\nHEALTHY FATS:\n${fmt(region.fats)}\n\nVEGETABLES:\n${fmt(region.veggies)}\n\nFRUITS:\n${fmt(region.fruits)}`;
}

// ═══════════════════════════════════════
// AI DIET PLAN GENERATOR (Claude API)
// ═══════════════════════════════════════

async function generateDietPlan(targetCal, macros, goal, weight, bmi, age, heightCm, gender, activity, location) {
  const goalLabel  = { loss: 'Fat Loss / Weight Loss', gain: 'Muscle Gain / Bulking', maintenance: 'Body Maintenance / Recomposition' }[goal];
  const bmiLabel   = bmi < 18.5 ? 'Underweight' : bmi < 25 ? 'Normal' : bmi < 30 ? 'Overweight' : 'Obese';
  const actLabel   = { sedentary: 'Sedentary (desk job, little exercise)', moderate: 'Moderately Active (3-5 days/week)', active: 'Very Active (daily intense training)' }[activity];
  const locationStr = location && location.trim() ? location.trim() : 'Unknown';

  const region = detectRegion(locationStr);
  const foodList = buildRegionalFoodList(region);

  const prompt = `You are a registered dietitian and nutritional scientist. Generate a medically accurate, fully personalised 7-day weekly diet plan. This is for a real person — accuracy is critical and every food must be genuinely available in their region.

CLIENT PROFILE:
- Age: ${age} years | Height: ${heightCm.toFixed(0)} cm | Weight: ${weight} kg | Gender: ${gender}
- BMI: ${bmi.toFixed(1)} (${bmiLabel}) | Activity Level: ${actLabel}
- Goal: ${goalLabel}
- Location: ${locationStr} (Region detected: ${region.label})

DAILY MACRO TARGETS — hit within ±5% EVERY day:
- Calories: ${targetCal} kcal | Protein: ${macros.protein}g | Carbs: ${macros.carbs}g | Fat: ${macros.fat}g

═══════════════════════════════════
APPROVED REGIONAL FOOD LIST FOR ${locationStr.toUpperCase()}
Use ONLY foods from this list OR other foods genuinely common in ${locationStr}.
All macro values below are per 100g (USDA/standard references).
═══════════════════════════════════
${foodList}

REGIONAL FOOD CULTURE NOTE:
${region.mealCulture}

STRICT RULES — follow every single one:
1. Generate EXACTLY 7 days: Monday through Sunday.
2. Each day has EXACTLY 4 meals: Breakfast, Lunch, Evening Snack, Dinner.
3. ALL food names must be REAL foods commonly sold in ${locationStr}. Use local names (e.g. "Chicken Tikka" not just "grilled chicken" for India; "Shawarma chicken" not "diced chicken" for UAE).
4. EVERY DAY must use DIFFERENT foods — rotate proteins, carbs, vegetables and cooking methods across all 7 days. No two days should have the same meal.
5. Cooking methods must VARY: grilled, boiled, steamed, stir-fried, baked, raw — rotate every day.
6. Food quantities MUST add up mathematically to hit the daily macro targets within ±5%.
7. Each food item MUST include accurate macros per the quantity listed (scale from per-100g values).
8. Each meal: 3–5 food items minimum.
9. Sunday: slightly more enjoyable "clean cheat" day — still hitting targets but with more culturally festive local food.
10. Include a mealNote (1 sentence) explaining specifically WHY this meal suits this person's profile.

Respond ONLY with valid JSON — no markdown, no backticks, no text outside the JSON.

{
  "locationNote": "1-sentence note about why these specific ${locationStr} foods suit this client",
  "weeklyPlan": [
    {
      "day": "Monday",
      "dayNote": "Brief theme e.g. High-protein start to the week",
      "meals": [
        {
          "time": "7:00 – 8:00 AM",
          "name": "Breakfast",
          "emoji": "🌅",
          "mealNote": "Why this meal suits this specific client",
          "items": [
            { "name": "Exact local food name", "qty": "150g", "cal": 210, "p": 18.0, "c": 12.0, "f": 8.0 }
          ]
        },
        { "time": "12:30 – 1:30 PM", "name": "Lunch", "emoji": "☀️", "mealNote": "...", "items": [...] },
        { "time": "4:00 – 5:00 PM", "name": "Evening Snack", "emoji": "🌿", "mealNote": "...", "items": [...] },
        { "time": "7:30 – 8:30 PM", "name": "Dinner", "emoji": "🌙", "mealNote": "...", "items": [...] }
      ]
    }
  ]
}`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 8000,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) throw new Error(`API error ${response.status}`);
    const data = await response.json();
    const raw = data.content.map(b => b.text || '').join('').trim();
    const clean = raw.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/i, '').trim();
    const parsed = JSON.parse(clean);
    return parsed;
  } catch (err) {
    console.error('AI weekly diet generation failed, using fallback:', err);
    return generateFallbackDietPlan(targetCal, macros, goal, weight, bmi, locationStr);
  }
}

// ── Fallback: uses the regional food DB so even fallback is location-aware ──
function generateFallbackDietPlan(targetCal, macros, goal, weight, bmi, locationStr) {
  const isLoss = goal === 'loss';
  const isGain = goal === 'gain';
  const region = detectRegion(locationStr || '');

  const dist = isLoss  ? [0.25, 0.35, 0.10, 0.30]
             : isGain  ? [0.28, 0.32, 0.12, 0.28]
                       : [0.25, 0.30, 0.15, 0.30];

  const mealBudget = (i) => ({
    cal:     Math.round(targetCal       * dist[i]),
    protein: Math.round(macros.protein  * dist[i]),
  });

  // Pick foods cycling through regional lists
  const proteins = region.proteins;
  const carbs    = region.carbs;
  const fats     = region.fats;
  const veggies  = region.veggies;
  const fruits   = region.fruits;

  const pick = (arr, idx) => arr[idx % arr.length];

  const days = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
  const weeklyPlan = days.map((day, di) => {
    const pFood = pick(proteins, di);
    const cFood = pick(carbs, di);
    const fFood = pick(fats, di);
    const vFood = pick(veggies, di);
    const fruit = pick(fruits, di);
    const p2    = pick(proteins, di + 2);
    const c2    = pick(carbs, di + 1);

    function makeItem(food, grams) {
      const g = Math.max(10, Math.round(grams));
      return {
        name: food.name,
        qty: `${g}g`,
        cal: Math.round(food.cal * g / 100),
        p: +((food.p * g / 100).toFixed(1)),
        c: +((food.c * g / 100).toFixed(1)),
        f: +((food.f * g / 100).toFixed(1)),
      };
    }

    const budgetB = mealBudget(0);
    const budgetL = mealBudget(1);
    const budgetS = mealBudget(2);
    const budgetD = mealBudget(3);

    const breakfast = {
      time: '7:00 – 8:00 AM', name: 'Breakfast', emoji: '🌅', mealNote: 'High-protein breakfast to kickstart metabolism.',
      items: [
        makeItem(pFood, (budgetB.protein / (pFood.p / 100))),
        makeItem(cFood, 80),
        makeItem(fFood, 15),
        makeItem(fruit, 100),
      ]
    };
    const lunch = {
      time: '12:30 – 1:30 PM', name: 'Lunch', emoji: '☀️', mealNote: 'Balanced midday meal with lean protein and complex carbs.',
      items: [
        makeItem(p2, (budgetL.protein / (p2.p / 100))),
        makeItem(c2, 120),
        makeItem(vFood, 150),
        makeItem(fFood, 10),
      ]
    };
    const snack = {
      time: '4:00 – 5:00 PM', name: 'Evening Snack', emoji: '🌿', mealNote: 'Light protein-rich snack to maintain energy.',
      items: [
        makeItem(pick(proteins, di + 3), 80),
        makeItem(fruit, 120),
      ]
    };
    const dinner = {
      time: '7:30 – 8:30 PM', name: 'Dinner', emoji: '🌙', mealNote: 'Lean protein with vegetables for overnight recovery.',
      items: [
        makeItem(pick(proteins, di + 1), (budgetD.protein / (pick(proteins, di+1).p / 100))),
        makeItem(pick(carbs, di + 2), 100),
        makeItem(pick(veggies, di + 1), 150),
        makeItem(fFood, 10),
      ]
    };

    return { day, dayNote: '', meals: [breakfast, lunch, snack, dinner] };
  });

  return { locationNote: `Foods chosen from ${region.label} staples available in your area.`, weeklyPlan };
}


// ═══════════════════════════════════════
// WORKOUT PLAN GENERATOR
// ═══════════════════════════════════════

function getLevel(age, activity, bmi) {
  if (activity === 'active' && bmi < 30) return 'Intermediate';
  if (activity === 'sedentary' || age > 55) return 'Beginner';
  return 'Intermediate';
}

function generateWorkout(goal, level, weight, age) {
  const plans = {
    loss: {
      days: [
        {
          day: 'Monday', focus: 'Full Body + Cardio',
          exercises: [
            { name: 'Barbell Squats', sets: 4, reps: '12', rest: '60s' },
            { name: 'Dumbbell Chest Press', sets: 3, reps: '12', rest: '60s' },
            { name: 'Lat Pulldown', sets: 3, reps: '12', rest: '60s' },
            { name: 'Romanian Deadlift', sets: 3, reps: '12', rest: '60s' },
            { name: 'Plank Hold', sets: 3, reps: '45 sec', rest: '30s' },
          ],
        },
        {
          day: 'Wednesday', focus: 'HIIT + Core',
          exercises: [
            { name: 'Jump Squats', sets: 4, reps: '20', rest: '45s' },
            { name: 'Burpees', sets: 3, reps: '15', rest: '60s' },
            { name: 'Mountain Climbers', sets: 4, reps: '30', rest: '45s' },
            { name: 'Bicycle Crunches', sets: 3, reps: '20 each', rest: '30s' },
            { name: 'Russian Twists', sets: 3, reps: '20', rest: '30s' },
          ],
        },
        {
          day: 'Friday', focus: 'Upper Body Strength',
          exercises: [
            { name: 'Incline Dumbbell Press', sets: 4, reps: '10', rest: '90s' },
            { name: 'Cable Rows', sets: 4, reps: '12', rest: '75s' },
            { name: 'Overhead Press', sets: 3, reps: '12', rest: '75s' },
            { name: 'Dumbbell Curls', sets: 3, reps: '15', rest: '60s' },
            { name: 'Tricep Pushdowns', sets: 3, reps: '15', rest: '60s' },
          ],
        },
        {
          day: 'Saturday', focus: 'Lower Body + Cardio',
          exercises: [
            { name: 'Leg Press', sets: 4, reps: '15', rest: '75s' },
            { name: 'Lunges', sets: 3, reps: '12 each', rest: '60s' },
            { name: 'Leg Curls', sets: 3, reps: '15', rest: '60s' },
            { name: 'Calf Raises', sets: 4, reps: '20', rest: '45s' },
            { name: 'Stair Climber', sets: 1, reps: '20 min', rest: '—' },
          ],
        },
      ],
      cardio: [
        { title: '🚴 Steady-State', desc: 'Treadmill / bike at 60-70% max HR for 30–40 min on off days (Tue/Thu)' },
        { title: '⚡ HIIT Protocol', desc: '20 sec sprint, 40 sec walk × 10 rounds. 3× per week max.' },
        { title: '🚶 Daily Steps', desc: 'Aim for 10,000+ steps daily. Use a pedometer or phone.' },
      ],
    },

    gain: {
      days: [
        {
          day: 'Monday', focus: 'Push — Chest, Shoulders, Triceps',
          exercises: [
            { name: 'Barbell Bench Press', sets: 4, reps: '6-8', rest: '2 min' },
            { name: 'Incline Dumbbell Press', sets: 3, reps: '8-10', rest: '90s' },
            { name: 'Overhead Barbell Press', sets: 4, reps: '6-8', rest: '2 min' },
            { name: 'Lateral Raises', sets: 3, reps: '12-15', rest: '60s' },
            { name: 'Tricep Dips / Pushdowns', sets: 3, reps: '10-12', rest: '75s' },
          ],
        },
        {
          day: 'Tuesday', focus: 'Pull — Back, Biceps',
          exercises: [
            { name: 'Deadlift', sets: 4, reps: '5', rest: '3 min' },
            { name: 'Pull-ups / Lat Pulldown', sets: 4, reps: '6-8', rest: '2 min' },
            { name: 'Barbell Rows', sets: 4, reps: '8', rest: '2 min' },
            { name: 'Face Pulls', sets: 3, reps: '15', rest: '60s' },
            { name: 'Barbell Curls', sets: 3, reps: '10-12', rest: '75s' },
          ],
        },
        {
          day: 'Thursday', focus: 'Legs — Quads, Hamstrings, Glutes',
          exercises: [
            { name: 'Barbell Squat', sets: 5, reps: '5', rest: '3 min' },
            { name: 'Romanian Deadlift', sets: 4, reps: '8', rest: '2 min' },
            { name: 'Leg Press', sets: 3, reps: '10-12', rest: '90s' },
            { name: 'Leg Curls', sets: 3, reps: '12', rest: '75s' },
            { name: 'Calf Raises', sets: 4, reps: '20', rest: '60s' },
          ],
        },
        {
          day: 'Friday', focus: 'Push — Strength Focus',
          exercises: [
            { name: 'Close-Grip Bench Press', sets: 4, reps: '6-8', rest: '2 min' },
            { name: 'Cable Fly', sets: 3, reps: '12-15', rest: '75s' },
            { name: 'Dumbbell Shoulder Press', sets: 4, reps: '8-10', rest: '90s' },
            { name: 'Skull Crushers', sets: 3, reps: '10-12', rest: '75s' },
            { name: 'Cable Lateral Raises', sets: 3, reps: '15', rest: '60s' },
          ],
        },
        {
          day: 'Saturday', focus: 'Pull — Volume Day',
          exercises: [
            { name: 'Dumbbell Rows', sets: 4, reps: '10-12', rest: '90s' },
            { name: 'Cable Rows', sets: 4, reps: '12', rest: '75s' },
            { name: 'Hammer Curls', sets: 3, reps: '12', rest: '60s' },
            { name: 'Reverse Curls', sets: 3, reps: '15', rest: '60s' },
            { name: 'Rear Delt Fly', sets: 3, reps: '15', rest: '60s' },
          ],
        },
      ],
      cardio: [
        { title: '🚶 Light Cardio', desc: '15-20 min low-intensity walk after workouts (preserve muscle glycogen)' },
        { title: '🏊 Optional Swimming', desc: '30 min 1-2× per week for active recovery and cardiovascular health' },
      ],
    },

    maintenance: {
      days: [
        {
          day: 'Monday', focus: 'Upper Body Strength',
          exercises: [
            { name: 'Bench Press', sets: 3, reps: '8-10', rest: '90s' },
            { name: 'Barbell Rows', sets: 3, reps: '8-10', rest: '90s' },
            { name: 'Overhead Press', sets: 3, reps: '8-10', rest: '90s' },
            { name: 'Pull-ups', sets: 3, reps: 'Max reps', rest: '90s' },
            { name: 'Dips', sets: 3, reps: 'Max reps', rest: '75s' },
          ],
        },
        {
          day: 'Wednesday', focus: 'Lower Body Strength',
          exercises: [
            { name: 'Barbell Squat', sets: 4, reps: '8-10', rest: '2 min' },
            { name: 'Romanian Deadlift', sets: 3, reps: '10', rest: '90s' },
            { name: 'Bulgarian Split Squat', sets: 3, reps: '10 each', rest: '90s' },
            { name: 'Leg Curls', sets: 3, reps: '12', rest: '75s' },
            { name: 'Calf Raises', sets: 4, reps: '20', rest: '60s' },
          ],
        },
        {
          day: 'Friday', focus: 'Functional + Core',
          exercises: [
            { name: 'Deadlift', sets: 3, reps: '5', rest: '2 min' },
            { name: 'Kettlebell Swings', sets: 4, reps: '15', rest: '75s' },
            { name: 'Box Jumps', sets: 3, reps: '8', rest: '90s' },
            { name: 'Plank Variations', sets: 3, reps: '45 sec', rest: '30s' },
            { name: 'Hanging Leg Raises', sets: 3, reps: '12', rest: '60s' },
          ],
        },
      ],
      cardio: [
        { title: '🏃 Mixed Cardio', desc: '20-30 min of your preferred cardio 2-3× per week at moderate intensity' },
        { title: '🧘 Active Recovery', desc: 'Yoga or stretching 1-2× per week to maintain mobility and reduce injury risk' },
        { title: '🚲 Weekend Activity', desc: 'Any recreational sport, hiking, cycling — keep moving and enjoying movement' },
      ],
    },
  };

  return plans[goal] || plans['maintenance'];
}

// ═══════════════════════════════════════
// AI ANALYSIS TEXT GENERATOR
// ═══════════════════════════════════════

function generateAnalysisText(bmi, bmiStatus, goal, weight, targetCal, macros, activity) {
  const bmiVal = bmi.toFixed(1);
  const goalText = { loss: 'weight loss', gain: 'muscle gain', maintenance: 'body maintenance' }[goal];

  const intros = {
    Underweight: `Your BMI of ${bmiVal} indicates you are currently underweight. Your metabolism may be running fast, or you may not be consuming enough calories. A structured calorie surplus with emphasis on nutrient-dense foods is essential.`,
    Normal: `Your BMI of ${bmiVal} places you in the healthy range — this is a strong foundation. Your body composition is manageable, and with the right protocol, you can make significant progress toward ${goalText}.`,
    Overweight: `Your BMI of ${bmiVal} suggests you are in the overweight category. This is very common and highly manageable with the right nutrition and training stimulus. A moderate calorie deficit paired with high protein will be highly effective.`,
    Obese: `Your BMI of ${bmiVal} indicates obesity, which increases the risk of metabolic complications. However, even a 5-10% reduction in body weight produces significant health improvements. A structured, sustainable approach is key — not extreme restriction.`,
  };

  const goalAddons = {
    loss: `This plan targets a daily intake of ${targetCal} kcal — a controlled deficit that promotes fat loss while preserving your ${macros.protein}g daily protein target to protect muscle tissue. Expect visible changes in 4-8 weeks.`,
    gain: `To build lean muscle effectively, this plan provides ${targetCal} kcal daily with a high-protein target of ${macros.protein}g — sufficient to drive hypertrophy. Paired with progressive overload training, expect measurable strength and size gains.`,
    maintenance: `With a maintenance target of ${targetCal} kcal, the focus is on body recomposition — gradually improving muscle tone and health markers while keeping weight stable. Your macros are balanced for long-term sustainability.`,
  };

  return `${intros[bmiStatus.label]} ${goalAddons[goal]}`;
}

// ═══════════════════════════════════════
// INSIGHT GENERATOR
// ═══════════════════════════════════════

function generateInsights(goal, bmi, weight, macros, targetCal, level) {
  const proteinPerKg = (macros.protein / weight).toFixed(1);
  const carbPct      = Math.round((macros.carbs   * 4 / targetCal) * 100);
  const proteinPct   = Math.round((macros.protein * 4 / targetCal) * 100);
  const fatPct       = Math.round((macros.fat     * 9 / targetCal) * 100);
  const weeklyFatLoss = ((500 * 7) / 7700).toFixed(2);  // ~0.45 kg/week
  const proj3mo       = (parseFloat(weeklyFatLoss) * 12).toFixed(1);
  const leanGain3mo   = ((400 * 7 / 7700) * 12).toFixed(1);

  const goalInsights = {
    loss: {
      why: `Your plan is calculated for your exact ${weight}kg bodyweight. At ${proteinPerKg}g protein per kg body weight (${macros.protein}g/day total), your muscle is fully protected during the calorie deficit. Your macro split is ${proteinPct}% protein / ${carbPct}% carbs / ${fatPct}% fat — optimised to keep you full and burning fat. Your ${targetCal} kcal daily target is the precise deficit your metabolism needs.`,
      timeline: [
        { week: 'Week 1-2', desc: `Water weight drops, body adapts to your ${targetCal} kcal target` },
        { week: 'Week 3-4', desc: `True fat loss begins — ~${weeklyFatLoss}kg/week at your specific deficit` },
        { week: 'Week 5-8', desc: 'Visible physique changes, energy levels improve significantly' },
        { week: 'Week 9-12', desc: `Projected ${proj3mo}kg fat loss based on your calorie deficit` },
      ],
      motivation: "Consistency beats perfection every time. You don't need to be extreme — you need to be consistent. Show up 80% of the time and the results will surprise you.",
    },
    gain: {
      why: `Built for your ${weight}kg frame — ${proteinPerKg}g of protein per kg body weight (${macros.protein}g/day) exceeds the hypertrophy threshold. Your ${macros.carbs}g of carbs refuel muscle glycogen after every session. The ${targetCal} kcal daily surplus is sized to drive lean mass gains while keeping fat gain minimal.`,
      timeline: [
        { week: 'Week 1-2', desc: `Rapid strength gains (neural adaptation) — scale up ~0.5kg` },
        { week: 'Week 3-4', desc: 'Muscle fullness and training pump noticeably better' },
        { week: 'Week 5-8', desc: 'Measurable size increases in major muscle groups' },
        { week: 'Week 9-12', desc: `Projected ~${leanGain3mo}kg lean muscle gained at your surplus` },
      ],
      motivation: "Muscles grow outside the gym, but only when you've pushed hard inside it. Eat big, lift heavy, sleep well — repeat.",
    },
    maintenance: {
      why: `At ${weight}kg, your maintenance is ${targetCal} kcal/day. Your ${proteinPerKg}g/kg protein intake (${macros.protein}g) drives slow recomposition — dropping fat and building muscle at the same scale weight. The ${carbPct}/${proteinPct}/${fatPct} carb/protein/fat split is balanced for sustained energy and long-term health.`,
      timeline: [
        { week: 'Week 1-2', desc: `Energy stabilises at ${targetCal} kcal; training performance improves` },
        { week: 'Week 3-4', desc: 'Body composition slowly improves — less fat, more muscle tone' },
        { week: 'Week 5-8', desc: 'Strength benchmarks rising consistently across all lifts' },
        { week: 'Week 9-12', desc: 'Leaner, stronger physique at the same body weight' },
      ],
      motivation: "Health is a lifelong journey, not a 30-day challenge. You are building habits that will serve you for decades.",
    },
  };

  return goalInsights[goal] || goalInsights['maintenance'];
}

// ═══════════════════════════════════════
// RENDER FUNCTIONS
// ═══════════════════════════════════════

function renderBMIGauge(bmi, status) {
  const canvas = document.getElementById('bmiGauge');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const cx = W / 2, cy = H - 10;
  const r = 85;

  ctx.clearRect(0, 0, W, H);

  // Background arc
  const colors = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444'];
  const ranges = [0, 0.25, 0.5, 0.75, 1.0];

  for (let i = 0; i < colors.length; i++) {
    const startA = Math.PI + ranges[i] * Math.PI;
    const endA = Math.PI + ranges[i + 1] * Math.PI;
    ctx.beginPath();
    ctx.arc(cx, cy, r, startA, endA);
    ctx.lineWidth = 14;
    ctx.strokeStyle = colors[i];
    ctx.lineCap = 'butt';
    ctx.stroke();
  }

  // Needle
  const clampedBMI = Math.max(10, Math.min(45, bmi));
  const normalizedBMI = (clampedBMI - 10) / 35;
  const needleAngle = Math.PI + normalizedBMI * Math.PI;

  ctx.beginPath();
  ctx.moveTo(cx, cy);
  const nx = cx + (r - 20) * Math.cos(needleAngle);
  const ny = cy + (r - 20) * Math.sin(needleAngle);
  ctx.lineTo(nx, ny);
  ctx.lineWidth = 3;
  ctx.strokeStyle = getComputedStyle(document.body).getPropertyValue('--text').trim() || '#0d1f0f';
  ctx.lineCap = 'round';
  ctx.stroke();

  // Center dot
  ctx.beginPath();
  ctx.arc(cx, cy, 7, 0, Math.PI * 2);
  ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--text').trim() || '#0d1f0f';
  ctx.fill();
}

function renderMacroDonut(macros, targetCal) {
  const canvas = document.getElementById('macroDonut');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const cx = W / 2, cy = H / 2, r = 65, inner = 42;

  ctx.clearRect(0, 0, W, H);

  const totalCal = macros.protein * 4 + macros.carbs * 4 + macros.fat * 9;
  const segments = [
    { label: 'Protein', value: macros.protein * 4, color: '#22c55e', g: macros.protein },
    { label: 'Carbs', value: macros.carbs * 4, color: '#3b82f6', g: macros.carbs },
    { label: 'Fat', value: macros.fat * 9, color: '#f97316', g: macros.fat },
  ];

  let start = -Math.PI / 2;
  segments.forEach(seg => {
    const slice = (seg.value / totalCal) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(cx, cy, r, start, start + slice);
    ctx.arc(cx, cy, inner, start + slice, start, true);
    ctx.closePath();
    ctx.fillStyle = seg.color;
    ctx.fill();
    start += slice;
  });

  // Legend
  const legend = document.getElementById('macroLegend');
  if (legend) {
    legend.innerHTML = segments.map(s => `
      <div class="macro-legend-item">
        <div class="mli-dot" style="background:${s.color}"></div>
        <div class="mli-info">
          <span class="mli-name">${s.label}</span>
          <span class="mli-val">${s.g}g · ${Math.round(s.value / totalCal * 100)}%</span>
        </div>
      </div>
    `).join('');
  }
}

function renderDietTimeline(dietData, location) {
  const container = document.getElementById('dietTimeline');
  if (!container) return;

  const locationNote = dietData.locationNote || null;

  // Support both old { meals[] } single-day format and new { weeklyPlan[] } format
  let weeklyPlan = dietData.weeklyPlan || null;
  if (!weeklyPlan && (dietData.meals || Array.isArray(dietData))) {
    // Legacy single-day: wrap it into Monday only
    const meals = dietData.meals || dietData;
    weeklyPlan = [{ day: 'Monday', dayNote: '', meals }];
  }

  if (!weeklyPlan || !weeklyPlan.length) {
    container.innerHTML = '<p style="color:var(--text3);padding:20px;">Could not load diet plan.</p>';
    return;
  }

  // Build day totals for summary bar
  function dayTotals(meals) {
    let cal = 0, p = 0, c = 0, f = 0;
    meals.forEach(meal => meal.items.forEach(item => {
      cal += item.cal || 0;
      p   += item.p   || 0;
      c   += item.c   || 0;
      f   += item.f   || 0;
    }));
    return { cal: Math.round(cal), p: p.toFixed(1), c: c.toFixed(1), f: f.toFixed(1) };
  }

  function renderMealsHTML(meals) {
    return meals.map(meal => {
      const totalCal = meal.items.reduce((s, i) => s + (i.cal || 0), 0);
      const totalP   = meal.items.reduce((s, i) => s + (i.p   || 0), 0).toFixed(1);
      const totalC   = meal.items.reduce((s, i) => s + (i.c   || 0), 0).toFixed(1);
      const totalF   = meal.items.reduce((s, i) => s + (i.f   || 0), 0).toFixed(1);
      return `
      <div class="meal-card">
        <div class="meal-header">
          <span class="meal-emoji">${meal.emoji}</span>
          <div class="meal-title-wrap">
            <div class="meal-time">${meal.time}</div>
            <div class="meal-name">${meal.name}</div>
          </div>
          <div>
            <div class="meal-calories">${totalCal}</div>
            <span class="meal-cal-unit">kcal</span>
          </div>
        </div>
        <div class="meal-body">
          ${meal.mealNote ? `<div class="meal-note-tip">💡 ${meal.mealNote}</div>` : ''}
          <div class="meal-items">
            ${meal.items.map(item => `
              <div class="meal-item">
                <div>
                  <div class="mi-name">${item.name} <span style="font-weight:400;color:var(--text3)">(${item.qty})</span></div>
                  <div class="mi-macros">
                    <span class="mi-p">P: ${(+item.p).toFixed(1)}g</span>
                    <span class="mi-c">C: ${(+item.c).toFixed(1)}g</span>
                    <span class="mi-f">F: ${(+item.f).toFixed(1)}g</span>
                    <span style="color:var(--text3);font-weight:400">${item.cal} kcal</span>
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
          <div class="meal-totals">
            <div class="mt-item"><span class="mt-label">Total:</span></div>
            <div class="mt-item"><span class="mt-label">Protein</span> <span class="mt-value mi-p">${totalP}g</span></div>
            <div class="mt-item"><span class="mt-label">Carbs</span>   <span class="mt-value mi-c">${totalC}g</span></div>
            <div class="mt-item"><span class="mt-label">Fat</span>     <span class="mt-value mi-f">${totalF}g</span></div>
          </div>
        </div>
      </div>`;
    }).join('');
  }

  // Location banner
  let html = '';
  if (location && location.trim()) {
    html += `<div class="diet-location-note">📍 <span>Personalised for ${location.trim()}</span>${locationNote ? ' — ' + locationNote : ' — Foods chosen for local availability in your region.'}</div>`;
  }

  // Weekly macro summary strip
  const dayNames = weeklyPlan.map(d => d.day);
  html += `
  <div class="weekly-summary-strip">
    <div class="wss-label">7-Day Overview</div>
    <div class="wss-days">
      ${weeklyPlan.map((d, i) => {
        const tot = dayTotals(d.meals);
        return `<div class="wss-day" data-day-index="${i}">
          <span class="wss-day-name">${d.day.slice(0,3)}</span>
          <span class="wss-day-cal">${tot.cal}</span>
          <span class="wss-day-cal-unit">kcal</span>
        </div>`;
      }).join('')}
    </div>
  </div>`;

  // Day tabs
  html += `<div class="day-tabs" id="dayTabs">`;
  weeklyPlan.forEach((d, i) => {
    html += `<button class="day-tab${i === 0 ? ' active' : ''}" data-day="${i}">${d.day.slice(0,3)}</button>`;
  });
  html += `</div>`;

  // Day panels
  html += `<div class="day-panels" id="dayPanels">`;
  weeklyPlan.forEach((d, i) => {
    const tot = dayTotals(d.meals);
    html += `
    <div class="day-panel${i === 0 ? ' active' : ''}" data-panel="${i}">
      <div class="day-panel-header">
        <div class="dph-left">
          <div class="dph-day">${d.day}</div>
          ${d.dayNote ? `<div class="dph-note">${d.dayNote}</div>` : ''}
        </div>
        <div class="dph-macros">
          <span class="dph-macro"><span class="dph-m-label">Calories</span><span class="dph-m-val">${tot.cal}</span></span>
          <span class="dph-macro"><span class="dph-m-label mi-p">Protein</span><span class="dph-m-val mi-p">${tot.p}g</span></span>
          <span class="dph-macro"><span class="dph-m-label mi-c">Carbs</span><span class="dph-m-val mi-c">${tot.c}g</span></span>
          <span class="dph-macro"><span class="dph-m-label mi-f">Fat</span><span class="dph-m-val mi-f">${tot.f}g</span></span>
        </div>
      </div>
      ${renderMealsHTML(d.meals)}
    </div>`;
  });
  html += `</div>`;

  container.innerHTML = html;

  // Tab switching logic
  const tabs   = container.querySelectorAll('.day-tab');
  const panels = container.querySelectorAll('.day-panel');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const idx = +tab.dataset.day;
      tabs.forEach(t => t.classList.remove('active'));
      panels.forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      panels[idx].classList.add('active');
    });
  });
}

function renderWorkout(workout, level, goal) {
  const headerInfo = document.getElementById('workoutHeaderInfo');
  const grid = document.getElementById('workoutGrid');
  const cardioSection = document.getElementById('cardioSection');

  const goalLabels = { loss: 'Fat Loss', gain: 'Muscle Gain', maintenance: 'Maintenance' };

  headerInfo.innerHTML = `
    <div class="whi-item"><div class="whi-label">Training Level</div><div class="whi-value"><span class="whi-badge">${level}</span></div></div>
    <div class="whi-item"><div class="whi-label">Goal</div><div class="whi-value"><span class="whi-badge">${goalLabels[goal]}</span></div></div>
    <div class="whi-item"><div class="whi-label">Training Days</div><div class="whi-value">${workout.days.length} days/week</div></div>
    <div class="whi-item"><div class="whi-label">Rest Days</div><div class="whi-value">${7 - workout.days.length} days/week</div></div>
  `;

  grid.innerHTML = workout.days.map((day, i) => `
    <div class="workout-day-card" style="animation-delay:${i * 0.08}s">
      <div class="wdc-header">
        <span class="wdc-day">📅 ${day.day}</span>
        <span class="wdc-focus">${day.focus}</span>
      </div>
      <div class="wdc-body">
        ${day.exercises.map(ex => `
          <div class="exercise-item">
            <div class="ex-name">${ex.name}</div>
            <div class="ex-details">
              <span class="ex-tag">📦 ${ex.sets} sets</span>
              <span class="ex-tag">🔁 ${ex.reps} reps</span>
              <span class="ex-tag">⏱ ${ex.rest} rest</span>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `).join('');

  cardioSection.innerHTML = `
    <div class="cardio-title">🏃 Cardio Plan</div>
    <div class="cardio-items">
      ${workout.cardio.map(c => `
        <div class="cardio-item">
          <div class="ci-title">${c.title}</div>
          <div class="ci-desc">${c.desc}</div>
        </div>
      `).join('')}
    </div>
  `;
}

function renderInsights(insights, goal) {
  const grid = document.getElementById('insightGrid');
  if (!grid) return;

  grid.innerHTML = `
    <div class="insight-card" style="animation-delay:0s">
      <div class="ic-icon">🎯</div>
      <div class="ic-title">Why This Plan Works</div>
      <div class="ic-text">${insights.why}</div>
    </div>
    <div class="insight-card" style="animation-delay:0.1s">
      <div class="ic-icon">📅</div>
      <div class="ic-title">Expected Timeline</div>
      <div class="ic-timeline">
        ${insights.timeline.map(t => `
          <div class="ict-item">
            <div class="ict-dot"></div>
            <span class="ict-week">${t.week}</span>
            <span class="ict-desc">${t.desc}</span>
          </div>
        `).join('')}
      </div>
    </div>
    <div class="insight-card motivation-card" style="animation-delay:0.2s">
      <div class="ic-icon">🔥</div>
      <div class="ic-title">Your Coach's Message</div>
      <blockquote>${insights.motivation}</blockquote>
    </div>
  `;
}

function renderHabits(water, weight, activity) {
  const grid = document.getElementById('habitsGrid');
  if (!grid) return;

  const steps = activity === 'sedentary' ? 8000 : activity === 'moderate' ? 10000 : 12000;
  const sleepHours = 8;
  const cupsFilled = Math.round(water / 0.25);

  grid.innerHTML = `
    <div class="habit-card">
      <div class="hc-icon">💧</div>
      <div class="hc-title">Daily Water Intake</div>
      <div><span class="hc-value">${water}</span> <span class="hc-unit">liters/day</span></div>
      <div class="water-cups">
        ${Array.from({ length: 10 }, (_, i) => `<span class="cup ${i < Math.min(cupsFilled, 10) ? 'filled' : ''}">🥤</span>`).join('')}
      </div>
      <div class="hc-desc">Spread across the day. Start with 500ml upon waking. Drink 500ml 30 min before each workout.</div>
    </div>
    <div class="habit-card">
      <div class="hc-icon">👣</div>
      <div class="hc-title">Daily Step Goal</div>
      <div><span class="hc-value">${steps.toLocaleString()}</span> <span class="hc-unit">steps/day</span></div>
      <div class="hc-bar"><div class="hc-bar-fill" style="width:72%"></div></div>
      <div class="hc-desc">Non-exercise movement (NEAT) accounts for up to 30% of your daily calorie burn. Keep moving!</div>
    </div>
    <div class="habit-card">
      <div class="hc-icon">😴</div>
      <div class="hc-title">Sleep Target</div>
      <div><span class="hc-value">${sleepHours}</span> <span class="hc-unit">hours/night</span></div>
      <div class="hc-bar"><div class="hc-bar-fill" style="width:85%"></div></div>
      <div class="hc-desc">Sleep is when 70% of muscle repair happens. Poor sleep spikes cortisol, increases fat storage, and kills gains.</div>
    </div>
    <div class="habit-card">
      <div class="hc-icon">🧘</div>
      <div class="hc-title">Stress Management</div>
      <div><span class="hc-value">10</span> <span class="hc-unit">min/day</span></div>
      <div class="hc-bar"><div class="hc-bar-fill" style="width:60%"></div></div>
      <div class="hc-desc">Chronic stress elevates cortisol which promotes fat storage. Daily breathing exercises or meditation are highly recommended.</div>
    </div>
  `;
}

// Typing animation
function typeText(elementId, text, speed = 20) {
  return new Promise(resolve => {
    const el = document.getElementById(elementId);
    if (!el) { resolve(); return; }
    el.innerHTML = '';
    const cursor = document.createElement('span');
    cursor.className = 'cursor';
    el.appendChild(cursor);

    let i = 0;
    const interval = setInterval(() => {
      if (i < text.length) {
        el.insertBefore(document.createTextNode(text[i]), cursor);
        i++;
      } else {
        clearInterval(interval);
        cursor.remove();
        resolve();
      }
    }, speed);
  });
}

// ═══════════════════════════════════════
// MAIN FLOW
// ═══════════════════════════════════════

async function runLoadingSequence() {
  const steps = ['ls1', 'ls2', 'ls3', 'ls4', 'ls5'];
  const delays = [800, 700, 900, 800, 600];

  for (let i = 0; i < steps.length; i++) {
    await new Promise(r => setTimeout(r, delays[i]));
    const el = document.getElementById(steps[i]);
    if (el) {
      el.classList.add('active');
      if (i > 0) {
        const prev = document.getElementById(steps[i - 1]);
        if (prev) { prev.classList.remove('active'); prev.classList.add('done'); }
      }
    }
  }
  await new Promise(r => setTimeout(r, 500));
}

async function generateAndShow() {
  // Collect form data
  const age      = parseInt(document.getElementById('age').value);
  const weight   = parseFloat(document.getElementById('weight').value);
  const heightCm = getHeightCm();
  const gender   = document.querySelector('input[name="gender"]:checked')?.value || 'other';
  const activity = document.querySelector('input[name="activity"]:checked')?.value || 'moderate';
  const goal     = document.querySelector('input[name="goal"]:checked')?.value || 'maintenance';
  const location = (document.getElementById('location')?.value || '').trim();

  // Validation
  if (!age || age < 10 || age > 100)             { alert('Please enter a valid age (10–100)'); return; }
  if (!weight || weight < 30 || weight > 300)    { alert('Please enter a valid weight (30–300 kg)'); return; }
  if (!heightCm || heightCm < 100 || heightCm > 250) { alert('Please enter a valid height'); return; }

  userData = { age, weight, heightCm, gender, activity, goal, location };

  // Show results page with loading
  pageForm.classList.remove('active');
  pageResults.classList.add('active');
  loadingOverlay.classList.remove('hidden');

  // Run loading animation (runs in parallel with AI call)
  const loadingDone = runLoadingSequence();

  // Do all calculations (fast, synchronous)
  const bmi         = calcBMI(weight, heightCm);
  const bmiStatus   = getBMIStatus(bmi);
  const tdee        = calcTDEE(weight, heightCm, age, gender, activity);
  const targetCal   = getTargetCalories(tdee, goal, bmi);
  const macros      = getMacros(targetCal, weight, goal);
  const water       = getWaterIntake(weight, activity);
  const level       = getLevel(age, activity, bmi);
  const workout     = generateWorkout(goal, level, weight, age);
  const insights    = generateInsights(goal, bmi, weight, macros, targetCal, level);
  const analysisText = generateAnalysisText(bmi, bmiStatus, goal, weight, targetCal, macros, activity);

  // Show diet loading placeholder while AI generates
  const dietContainer = document.getElementById('dietTimeline');
  if (dietContainer) {
    dietContainer.innerHTML = `<div class="ai-loading-meal"><div class="loader-ring"></div><span>🤖 AI is crafting your 7-day personalised ${location ? location + ' ' : ''}diet plan…</span></div>`;
  }

  // Generate AI diet plan (async — may take a moment)
  const dietResult = generateDietPlan(targetCal, macros, goal, weight, bmi, age, heightCm, gender, activity, location);

  // Wait for both loading animation AND AI diet to finish
  const [dietData] = await Promise.all([dietResult, loadingDone]);

  planData = { bmi, bmiStatus, tdee, targetCal, macros, water, level, meals: dietData, workout, insights };

  // Save to localStorage
  localStorage.setItem('nutriai-plan', JSON.stringify({ userData, planData: { bmi, bmiStatus, tdee, targetCal, macros, water } }));

  // Hide loading overlay
  loadingOverlay.classList.add('hidden');

  // Render all sections
  document.getElementById('bmiNumber').textContent = bmi.toFixed(1);
  const bmiStatusEl = document.getElementById('bmiStatus');
  bmiStatusEl.textContent = bmiStatus.label;
  bmiStatusEl.style.background = bmiStatus.bg;
  bmiStatusEl.style.color = bmiStatus.color;

  document.getElementById('tdeeDisplay').textContent    = tdee.toLocaleString();
  document.getElementById('targetCalDisplay').textContent = targetCal.toLocaleString();
  document.getElementById('proteinGoalDisplay').textContent = macros.protein;
  document.getElementById('waterDisplay').textContent   = water;

  // BMI marker position
  const clampedBMI = Math.max(10, Math.min(45, bmi));
  const pct = ((clampedBMI - 10) / 35) * 100;
  document.getElementById('bmiMarker').style.left = `${pct}%`;

  // Animate sections in sequence
  setTimeout(() => renderBMIGauge(bmi, bmiStatus), 100);
  setTimeout(() => renderMacroDonut(macros, targetCal), 200);
  setTimeout(() => renderDietTimeline(dietData, location), 300);
  setTimeout(() => renderWorkout(workout, level, goal), 400);
  setTimeout(() => renderInsights(insights, goal), 500);
  setTimeout(() => renderHabits(water, weight, activity), 600);

  // Typing animation for AI analysis
  setTimeout(() => typeText('aiAnalysisText', analysisText, 18), 400);

  // Scroll to top of results
  document.getElementById('resultsMain').scrollTop = 0;
  window.scrollTo(0, 0);
}

// ── Sidebar Navigation Scroll Spy ──
function initScrollSpy() {
  const sections = document.querySelectorAll('.result-section');
  const navLinks = document.querySelectorAll('.nav-link');

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        navLinks.forEach(l => l.classList.remove('active'));
        const id = entry.target.id;
        const link = document.querySelector(`.nav-link[href="#${id}"]`);
        if (link) link.classList.add('active');
      }
    });
  }, { threshold: 0.3 });

  sections.forEach(s => observer.observe(s));
}

initScrollSpy();

// ── Button Events ──
document.getElementById('generateBtn').addEventListener('click', generateAndShow);

document.getElementById('backBtn').addEventListener('click', () => {
  pageResults.classList.remove('active');
  pageForm.classList.add('active');
  window.scrollTo(0, 0);
});

document.getElementById('regenerateBtn').addEventListener('click', () => {
  loadingOverlay.classList.remove('hidden');
  // Reset loader steps
  ['ls1', 'ls2', 'ls3', 'ls4', 'ls5'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.classList.remove('active', 'done'); }
  });
  document.getElementById('ls1').classList.add('active');
  // Slight variation for regeneration
  setTimeout(() => generateAndShow(), 100);
});

document.getElementById('downloadBtn').addEventListener('click', () => {
  window.print();
});

// ── Keyboard shortcut ──
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && pageForm.classList.contains('active')) {
    generateAndShow();
  }
});

// ── Input validation feedback ──
document.querySelectorAll('input[type="number"]').forEach(input => {
  input.addEventListener('input', function () {
    this.style.borderColor = this.value ? 'var(--accent)' : 'var(--border)';
  });
});
