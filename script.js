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
// DIET PLAN GENERATOR
// ═══════════════════════════════════════

// ALL values are per 100g — consistent so math always works
const FOOD_DB = {
  // Proteins
  chickenBreast: { name: 'Chicken Breast',        cal: 165, p: 31.0, c:  0.0, f:  3.6 },
  eggs:          { name: 'Whole Eggs',             cal: 155, p: 13.0, c:  1.1, f: 11.0 },
  eggWhites:     { name: 'Egg Whites',             cal:  52, p: 11.0, c:  0.7, f:  0.2 },
  greekYogurt:   { name: 'Greek Yogurt (0%)',      cal:  59, p: 10.2, c:  3.6, f:  0.4 },
  salmonFillet:  { name: 'Salmon Fillet',          cal: 208, p: 28.0, c:  0.0, f: 10.0 },
  tunaCanned:    { name: 'Tuna (canned)',           cal: 116, p: 26.0, c:  0.0, f:  1.0 },
  cottage:       { name: 'Cottage Cheese',         cal:  98, p: 11.0, c:  3.4, f:  4.3 },
  lentils:       { name: 'Cooked Lentils',         cal: 116, p:  9.0, c: 20.0, f:  0.4 },
  // Carbs
  oats:          { name: 'Rolled Oats (dry)',       cal: 389, p: 17.0, c: 66.0, f:  7.0 },
  brownRice:     { name: 'Cooked Brown Rice',      cal: 112, p:  2.6, c: 23.5, f:  0.9 },
  sweetPotato:   { name: 'Sweet Potato (cooked)',  cal:  86, p:  1.6, c: 20.0, f:  0.1 },
  wholeWheatBread:{ name: 'Whole Wheat Bread',     cal: 247, p: 13.0, c: 41.0, f:  3.4 },
  banana:        { name: 'Banana',                 cal:  89, p:  1.1, c: 23.0, f:  0.3 },
  apple:         { name: 'Apple',                  cal:  52, p:  0.3, c: 14.0, f:  0.2 },
  quinoa:        { name: 'Cooked Quinoa',          cal: 120, p:  4.4, c: 21.3, f:  1.9 },
  // Fats
  almonds:       { name: 'Almonds',                cal: 579, p: 21.0, c: 22.0, f: 50.0 },
  avocado:       { name: 'Avocado',                cal: 160, p:  2.0, c:  9.0, f: 15.0 },
  oliveOil:      { name: 'Olive Oil',              cal: 884, p:  0.0, c:  0.0, f:100.0 },
  peanutButter:  { name: 'Peanut Butter',          cal: 588, p: 25.0, c: 20.0, f: 50.0 },
  // Veggies (used as fixed 150g add-ons)
  spinach:       { name: 'Spinach',                cal:  23, p:  2.9, c:  3.6, f:  0.4 },
  broccoli:      { name: 'Broccoli',               cal:  55, p:  3.7, c: 11.0, f:  0.6 },
  mixedVeg:      { name: 'Mixed Vegetables',       cal:  65, p:  2.0, c: 13.0, f:  0.5 },
  // Supplement (per 100g — 1 scoop ~30g = ~120 cal, 25g protein)
  wheyProtein:   { name: 'Whey Protein Shake',     cal: 400, p: 83.0, c: 10.0, f:  5.0 },
};
// ═══════════════════════════════════════
// AI DIET PLAN GENERATOR (Claude API)
// ═══════════════════════════════════════

/**
 * Generate a 7-day weekly diet plan via Claude API.
 * Each day has 4 meals with different foods but same macro targets.
 * Returns: { locationNote, weeklyPlan: [ { day, meals[] }, ... ] }
 */
async function generateDietPlan(targetCal, macros, goal, weight, bmi, age, heightCm, gender, activity, location) {
  const goalLabel  = { loss: 'Fat Loss / Weight Loss', gain: 'Muscle Gain / Bulking', maintenance: 'Body Maintenance / Recomposition' }[goal];
  const bmiLabel   = bmi < 18.5 ? 'Underweight' : bmi < 25 ? 'Normal' : bmi < 30 ? 'Overweight' : 'Obese';
  const actLabel   = { sedentary: 'Sedentary (desk job, little exercise)', moderate: 'Moderately Active (3-5 days/week)', active: 'Very Active (daily intense training)' }[activity];
  const locationStr = location && location.trim() ? location.trim() : 'Unknown';

  const prompt = `You are a registered dietitian generating a medically accurate, personalised 7-day weekly diet plan. This is for a real person with real health goals — accuracy is critical.

CLIENT PROFILE:
- Age: ${age} years | Height: ${heightCm.toFixed(0)} cm | Weight: ${weight} kg | Gender: ${gender}
- BMI: ${bmi.toFixed(1)} (${bmiLabel}) | Activity: ${actLabel}
- Goal: ${goalLabel} | Location: ${locationStr}

DAILY MACRO TARGETS (must be hit within ±5% each day):
- Calories: ${targetCal} kcal | Protein: ${macros.protein}g | Carbs: ${macros.carbs}g | Fat: ${macros.fat}g

STRICT RULES — follow every one:
1. Generate exactly 7 days (Monday through Sunday).
2. Each day must have exactly 4 meals: Breakfast, Lunch, Evening Snack, Dinner.
3. Every day must use DIFFERENT foods — no two days should share the same meal combination. Rotate proteins, carbs, and vegetables across days for nutritional variety.
4. ALL foods must be locally available and commonly eaten in ${locationStr}. Use regional staples. No obscure Western supplements unless the region is Western.
5. Macros per item must be nutritionally accurate (use USDA/standard values). Quantities must add up mathematically to hit the daily targets.
6. Each food item must list: name, qty (e.g. "150g"), cal, p (protein g), c (carbs g), f (fat g).
7. Each meal must have 3–5 food items.
8. Vary cooking methods: grilled, boiled, stir-fried, raw, baked etc — do not repeat the same preparation every day.
9. Include a brief mealNote (1 sentence) explaining why this meal suits this specific client.
10. Sunday can be a slightly more flexible "cheat-clean" day — still hitting targets but with slightly more enjoyable food choices.

Respond ONLY with valid JSON. No markdown, no backticks, no explanation outside the JSON. Structure:
{
  "locationNote": "1-sentence note on why these foods suit ${locationStr}",
  "weeklyPlan": [
    {
      "day": "Monday",
      "dayNote": "optional 1-sentence theme for this day e.g. High-carb refeed",
      "meals": [
        {
          "time": "7:00 – 8:00 AM",
          "name": "Breakfast",
          "emoji": "🌅",
          "mealNote": "why this meal suits the client",
          "items": [
            { "name": "Food Name", "qty": "150g", "cal": 210, "p": 18.0, "c": 12.0, "f": 8.0 }
          ]
        },
        { "time": "12:30 – 1:30 PM", "name": "Lunch", "emoji": "☀️", "mealNote": "...", "items": [...] },
        { "time": "4:00 – 5:00 PM", "name": "Evening Snack", "emoji": "🌿", "mealNote": "...", "items": [...] },
        { "time": "7:30 – 8:30 PM", "name": "Dinner", "emoji": "🌙", "mealNote": "...", "items": [...] }
      ]
    }
    // ... repeat for Tuesday through Sunday
  ]
}`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 8000,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) throw new Error(`API error ${response.status}`);
    const data = await response.json();
    const raw = data.content.map(b => b.text || '').join('').trim();
    const clean = raw.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/i, '').trim();
    const parsed = JSON.parse(clean);
    return parsed; // { locationNote, weeklyPlan[] }
  } catch (err) {
    console.error('AI weekly diet generation failed, using fallback:', err);
    return generateFallbackDietPlan(targetCal, macros, goal, weight, bmi);
  }
}

// ── Fallback (original logic) if API fails ──
function generateFallbackDietPlan(targetCal, macros, goal, weight, bmi) {
  const isLoss = goal === 'loss';
  const isGain = goal === 'gain';
  const dist = isLoss  ? [0.25, 0.35, 0.10, 0.30]
             : isGain  ? [0.28, 0.32, 0.12, 0.28]
                       : [0.25, 0.30, 0.15, 0.30];

  const meal = (i) => ({
    cal:     Math.round(targetCal    * dist[i]),
    protein: Math.round(macros.protein * dist[i]),
    fat:     Math.round(macros.fat   * dist[i]),
  });

  const buildFallback = (time, name, emoji, mealCal, mealPro, pFood, cFood, fFood, vFood) => {
    const items = [];
    const pGrams = Math.max(50, Math.round((mealPro / pFood.p) * 100));
    const pItem  = { name: pFood.name, qty: pGrams+'g', cal: Math.round(pFood.cal*pGrams/100), p: +(pFood.p*pGrams/100).toFixed(1), c: +(pFood.c*pGrams/100).toFixed(1), f: +(pFood.f*pGrams/100).toFixed(1) };
    items.push(pItem);
    const fatRem = Math.max(0, meal(0).fat - pItem.f);
    const fGrams = fFood.f > 0 ? Math.min(50, Math.max(5, Math.round((fatRem / fFood.f) * 100))) : 10;
    if (fFood !== pFood) items.push({ name: fFood.name, qty: fGrams+'g', cal: Math.round(fFood.cal*fGrams/100), p: +(fFood.p*fGrams/100).toFixed(1), c: +(fFood.c*fGrams/100).toFixed(1), f: +(fFood.f*fGrams/100).toFixed(1) });
    if (vFood) items.push({ name: vFood.name, qty: '150g', cal: Math.round(vFood.cal*1.5), p: +(vFood.p*1.5).toFixed(1), c: +(vFood.c*1.5).toFixed(1), f: +(vFood.f*1.5).toFixed(1) });
    const calUsed = items.reduce((s,i) => s+i.cal, 0);
    const calLeft = Math.max(0, mealCal - calUsed);
    const cGrams  = cFood.cal > 0 ? Math.min(500, Math.max(30, Math.round((calLeft/cFood.cal)*100))) : 100;
    items.push({ name: cFood.name, qty: cGrams+'g', cal: Math.round(cFood.cal*cGrams/100), p: +(cFood.p*cGrams/100).toFixed(1), c: +(cFood.c*cGrams/100).toFixed(1), f: +(cFood.f*cGrams/100).toFixed(1) });
    return { time, name, emoji, mealNote: '', items };
  };

  const meals = [];
  if (isLoss) {
    meals.push(buildFallback('7:00 – 8:00 AM','Breakfast','🌅', meal(0).cal, meal(0).protein, FOOD_DB.eggWhites, FOOD_DB.oats, FOOD_DB.almonds, null));
    meals.push(buildFallback('12:30 – 1:30 PM','Lunch','☀️', meal(1).cal, meal(1).protein, FOOD_DB.chickenBreast, FOOD_DB.brownRice, FOOD_DB.oliveOil, FOOD_DB.broccoli));
    meals.push(buildFallback('4:00 – 5:00 PM','Evening Snack','🌿', meal(2).cal, meal(2).protein, FOOD_DB.greekYogurt, FOOD_DB.apple, FOOD_DB.almonds, null));
    meals.push(buildFallback('7:30 – 8:30 PM','Dinner','🌙', meal(3).cal, meal(3).protein, FOOD_DB.tunaCanned, FOOD_DB.sweetPotato, FOOD_DB.oliveOil, FOOD_DB.broccoli));
  } else if (isGain) {
    meals.push(buildFallback('7:00 – 8:00 AM','Breakfast','🌅', meal(0).cal, meal(0).protein, FOOD_DB.eggs, FOOD_DB.oats, FOOD_DB.peanutButter, null));
    meals.push(buildFallback('12:30 – 1:30 PM','Lunch','☀️', meal(1).cal, meal(1).protein, FOOD_DB.chickenBreast, FOOD_DB.brownRice, FOOD_DB.avocado, FOOD_DB.mixedVeg));
    meals.push(buildFallback('4:00 – 5:00 PM','Evening Snack','🌿', meal(2).cal, meal(2).protein, FOOD_DB.wheyProtein, FOOD_DB.banana, FOOD_DB.peanutButter, null));
    meals.push(buildFallback('7:30 – 8:30 PM','Dinner','🌙', meal(3).cal, meal(3).protein, FOOD_DB.salmonFillet, FOOD_DB.sweetPotato, FOOD_DB.almonds, FOOD_DB.spinach));
  } else {
    meals.push(buildFallback('7:00 – 8:00 AM','Breakfast','🌅', meal(0).cal, meal(0).protein, FOOD_DB.greekYogurt, FOOD_DB.wholeWheatBread, FOOD_DB.almonds, null));
    meals.push(buildFallback('12:30 – 1:30 PM','Lunch','☀️', meal(1).cal, meal(1).protein, FOOD_DB.salmonFillet, FOOD_DB.quinoa, FOOD_DB.oliveOil, FOOD_DB.spinach));
    meals.push(buildFallback('4:00 – 5:00 PM','Evening Snack','🌿', meal(2).cal, meal(2).protein, FOOD_DB.cottage, FOOD_DB.apple, FOOD_DB.almonds, null));
    meals.push(buildFallback('7:30 – 8:30 PM','Dinner','🌙', meal(3).cal, meal(3).protein, FOOD_DB.chickenBreast, FOOD_DB.lentils, FOOD_DB.oliveOil, FOOD_DB.mixedVeg));
  }
  // Wrap single day into a full week (fallback repeats with minor variation)
  const days = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
  const weeklyPlan = days.map((day, i) => {
    const proteinCycle = isLoss
      ? [FOOD_DB.eggWhites, FOOD_DB.chickenBreast, FOOD_DB.tunaCanned, FOOD_DB.salmonFillet, FOOD_DB.greekYogurt, FOOD_DB.eggs, FOOD_DB.cottage]
      : isGain
      ? [FOOD_DB.eggs, FOOD_DB.chickenBreast, FOOD_DB.salmonFillet, FOOD_DB.cottage, FOOD_DB.tunaCanned, FOOD_DB.greekYogurt, FOOD_DB.eggWhites]
      : [FOOD_DB.greekYogurt, FOOD_DB.salmonFillet, FOOD_DB.chickenBreast, FOOD_DB.eggs, FOOD_DB.tunaCanned, FOOD_DB.cottage, FOOD_DB.lentils];
    const carbCycle = [FOOD_DB.oats, FOOD_DB.brownRice, FOOD_DB.sweetPotato, FOOD_DB.quinoa, FOOD_DB.wholeWheatBread, FOOD_DB.banana, FOOD_DB.oats];
    const vegCycle  = [null, FOOD_DB.broccoli, FOOD_DB.spinach, FOOD_DB.mixedVeg, FOOD_DB.broccoli, FOOD_DB.spinach, null];
    const pSrc = proteinCycle[i], cSrc = carbCycle[i], vSrc = vegCycle[i];
    const dayMeals = [];
    dayMeals.push(buildFallback('7:00 – 8:00 AM','Breakfast','🌅', meal(0).cal, meal(0).protein, pSrc, cSrc, FOOD_DB.almonds, null));
    dayMeals.push(buildFallback('12:30 – 1:30 PM','Lunch','☀️', meal(1).cal, meal(1).protein, FOOD_DB.chickenBreast, cSrc, FOOD_DB.oliveOil, vSrc));
    dayMeals.push(buildFallback('4:00 – 5:00 PM','Evening Snack','🌿', meal(2).cal, meal(2).protein, FOOD_DB.greekYogurt, FOOD_DB.apple, FOOD_DB.almonds, null));
    dayMeals.push(buildFallback('7:30 – 8:30 PM','Dinner','🌙', meal(3).cal, meal(3).protein, pSrc, FOOD_DB.sweetPotato, FOOD_DB.oliveOil, vSrc || FOOD_DB.broccoli));
    return { day, dayNote: '', meals: dayMeals };
  });
  return { locationNote: null, weeklyPlan };
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
