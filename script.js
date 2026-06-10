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

const FOOD_DB = {
  // Proteins
  chickenBreast: { name: 'Chicken Breast', cal: 165, p: 31, c: 0, f: 3.6, unit: 'g' },
  eggs: { name: 'Whole Egg', cal: 72, p: 6.3, c: 0.4, f: 5, unit: 'pc' },
  eggWhites: { name: 'Egg Whites', cal: 52, p: 11, c: 0.7, f: 0.2, unit: 'g (3 whites)' },
  greekYogurt: { name: 'Greek Yogurt (0%)', cal: 59, p: 10.2, c: 3.6, f: 0.4, unit: 'g' },
  salmonFillet: { name: 'Salmon Fillet', cal: 208, p: 28, c: 0, f: 10, unit: 'g' },
  tunaCanned: { name: 'Tuna (canned)', cal: 116, p: 26, c: 0, f: 1, unit: 'g' },
  cottage: { name: 'Cottage Cheese', cal: 98, p: 11, c: 3.4, f: 4.3, unit: 'g' },
  lentils: { name: 'Cooked Lentils', cal: 116, p: 9, c: 20, f: 0.4, unit: 'g' },
  paneer: { name: 'Paneer', cal: 265, p: 18, c: 3, f: 20, unit: 'g' },

  // Carbs
  oats: { name: 'Rolled Oats', cal: 307, p: 11, c: 55, f: 5.3, unit: 'g' },
  brownRice: { name: 'Cooked Brown Rice', cal: 216, p: 5, c: 45, f: 1.8, unit: 'g' },
  sweetPotato: { name: 'Sweet Potato (cooked)', cal: 86, p: 1.6, c: 20, f: 0.1, unit: 'g' },
  wholeWheatBread: { name: 'Whole Wheat Bread', cal: 69, p: 3.6, c: 12, f: 1, unit: 'slice (30g)' },
  banana: { name: 'Banana', cal: 89, p: 1.1, c: 23, f: 0.3, unit: 'medium (100g)' },
  apple: { name: 'Apple', cal: 52, p: 0.3, c: 14, f: 0.2, unit: 'medium (150g)' },
  quinoa: { name: 'Cooked Quinoa', cal: 222, p: 8, c: 39, f: 3.5, unit: 'g' },

  // Fats
  almonds: { name: 'Almonds', cal: 164, p: 6, c: 6, f: 14, unit: 'g (30g)' },
  avocado: { name: 'Avocado', cal: 160, p: 2, c: 9, f: 15, unit: 'half (100g)' },
  oliveOil: { name: 'Olive Oil', cal: 119, p: 0, c: 0, f: 13.5, unit: 'tbsp (13.5g)' },
  peanutButter: { name: 'Peanut Butter', cal: 188, p: 8, c: 6, f: 16, unit: 'tbsp (32g)' },

  // Veggies
  spinach: { name: 'Spinach', cal: 23, p: 2.9, c: 3.6, f: 0.4, unit: 'g' },
  broccoli: { name: 'Broccoli', cal: 55, p: 3.7, c: 11, f: 0.6, unit: 'g' },
  mixedVeg: { name: 'Mixed Vegetables', cal: 65, p: 2, c: 13, f: 0.5, unit: 'g' },

  // Protein supplement
  wheyProtein: { name: 'Whey Protein Shake', cal: 120, p: 25, c: 3, f: 1.5, unit: 'scoop (30g)' },
};

function scaleFoodItem(food, grams, displayQty) {
  const scale = grams / 100;
  return {
    name: food.name,
    qty: displayQty || `${grams}g`,
    cal: Math.round(food.cal * scale),
    p: +(food.p * scale).toFixed(1),
    c: +(food.c * scale).toFixed(1),
    f: +(food.f * scale).toFixed(1),
  };
}

function generateDietPlan(targetCal, macros, goal, weight, bmi) {
  const isLoss = goal === 'loss';
  const isGain = goal === 'gain';

  // Meal calorie distribution
  const dist = isLoss
    ? [0.25, 0.30, 0.15, 0.30]
    : isGain
    ? [0.25, 0.30, 0.15, 0.30]
    : [0.25, 0.30, 0.15, 0.30];

  const mealCals = dist.map(d => Math.round(targetCal * d));

  const meals = [];

  // ── Meal 1: Breakfast ──
  const breakfast = { time: '7:00 – 8:00 AM', name: 'Breakfast', emoji: '🌅', target: mealCals[0], items: [] };
  if (isLoss) {
    breakfast.items.push(scaleFoodItem(FOOD_DB.eggWhites, 99, '3 egg whites'));
    breakfast.items.push(scaleFoodItem(FOOD_DB.eggs, 100, '1 whole egg'));
    breakfast.items.push(scaleFoodItem(FOOD_DB.oats, 60, '60g'));
    breakfast.items.push(scaleFoodItem(FOOD_DB.apple, 150, '1 medium'));
  } else if (isGain) {
    breakfast.items.push(scaleFoodItem(FOOD_DB.eggs, 200, '3 whole eggs'));
    breakfast.items.push(scaleFoodItem(FOOD_DB.oats, 80, '80g'));
    breakfast.items.push(scaleFoodItem(FOOD_DB.banana, 100, '1 medium'));
    breakfast.items.push(scaleFoodItem(FOOD_DB.peanutButter, 32, '1 tbsp'));
  } else {
    breakfast.items.push(scaleFoodItem(FOOD_DB.eggs, 150, '2 whole eggs'));
    breakfast.items.push(scaleFoodItem(FOOD_DB.wholeWheatBread, 60, '2 slices'));
    breakfast.items.push(scaleFoodItem(FOOD_DB.greekYogurt, 150, '150g'));
    breakfast.items.push(scaleFoodItem(FOOD_DB.apple, 150, '1 medium'));
  }
  meals.push(breakfast);

  // ── Meal 2: Lunch ──
  const lunch = { time: '12:30 – 1:30 PM', name: 'Lunch', emoji: '☀️', target: mealCals[1], items: [] };
  if (isLoss) {
    lunch.items.push(scaleFoodItem(FOOD_DB.chickenBreast, 200, '200g'));
    lunch.items.push(scaleFoodItem(FOOD_DB.brownRice, 150, '150g cooked'));
    lunch.items.push(scaleFoodItem(FOOD_DB.broccoli, 200, '200g'));
    lunch.items.push(scaleFoodItem(FOOD_DB.oliveOil, 13.5, '1 tbsp'));
  } else if (isGain) {
    lunch.items.push(scaleFoodItem(FOOD_DB.chickenBreast, 250, '250g'));
    lunch.items.push(scaleFoodItem(FOOD_DB.brownRice, 250, '250g cooked'));
    lunch.items.push(scaleFoodItem(FOOD_DB.mixedVeg, 150, '150g'));
    lunch.items.push(scaleFoodItem(FOOD_DB.avocado, 100, '½ avocado'));
  } else {
    lunch.items.push(scaleFoodItem(FOOD_DB.salmonFillet, 180, '180g'));
    lunch.items.push(scaleFoodItem(FOOD_DB.quinoa, 150, '150g cooked'));
    lunch.items.push(scaleFoodItem(FOOD_DB.spinach, 100, '100g'));
    lunch.items.push(scaleFoodItem(FOOD_DB.oliveOil, 13.5, '1 tbsp'));
  }
  meals.push(lunch);

  // ── Meal 3: Evening Snack ──
  const snack = { time: '4:00 – 5:00 PM', name: 'Evening Snack', emoji: '🌿', target: mealCals[2], items: [] };
  if (isLoss) {
    snack.items.push(scaleFoodItem(FOOD_DB.greekYogurt, 200, '200g'));
    snack.items.push(scaleFoodItem(FOOD_DB.almonds, 30, '30g (handful)'));
  } else if (isGain) {
    snack.items.push(scaleFoodItem(FOOD_DB.wheyProtein, 30, '1 scoop'));
    snack.items.push(scaleFoodItem(FOOD_DB.banana, 100, '1 medium'));
    snack.items.push(scaleFoodItem(FOOD_DB.peanutButter, 32, '1 tbsp'));
  } else {
    snack.items.push(scaleFoodItem(FOOD_DB.cottage, 150, '150g'));
    snack.items.push(scaleFoodItem(FOOD_DB.apple, 150, '1 medium'));
    snack.items.push(scaleFoodItem(FOOD_DB.almonds, 20, '20g'));
  }
  meals.push(snack);

  // ── Meal 4: Dinner ──
  const dinner = { time: '7:30 – 8:30 PM', name: 'Dinner', emoji: '🌙', target: mealCals[3], items: [] };
  if (isLoss) {
    dinner.items.push(scaleFoodItem(FOOD_DB.tunaCanned, 150, '150g'));
    dinner.items.push(scaleFoodItem(FOOD_DB.sweetPotato, 150, '150g'));
    dinner.items.push(scaleFoodItem(FOOD_DB.broccoli, 200, '200g'));
    dinner.items.push(scaleFoodItem(FOOD_DB.oliveOil, 13.5, '1 tbsp'));
  } else if (isGain) {
    dinner.items.push(scaleFoodItem(FOOD_DB.salmonFillet, 220, '220g'));
    dinner.items.push(scaleFoodItem(FOOD_DB.sweetPotato, 200, '200g'));
    dinner.items.push(scaleFoodItem(FOOD_DB.spinach, 150, '150g'));
    dinner.items.push(scaleFoodItem(FOOD_DB.almonds, 30, '30g'));
  } else {
    dinner.items.push(scaleFoodItem(FOOD_DB.chickenBreast, 180, '180g'));
    dinner.items.push(scaleFoodItem(FOOD_DB.lentils, 150, '150g cooked'));
    dinner.items.push(scaleFoodItem(FOOD_DB.mixedVeg, 150, '150g'));
    dinner.items.push(scaleFoodItem(FOOD_DB.oliveOil, 13.5, '1 tbsp'));
  }
  meals.push(dinner);

  return meals;
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
  const goalInsights = {
    loss: {
      why: `This high-protein, moderate-deficit diet is specifically designed for fat loss while protecting lean muscle mass. High protein (${macros.protein}g) keeps you full and boosts your metabolism through the thermic effect of food. The calorie deficit of ~500 kcal/day ensures steady, sustainable fat loss of ~0.5kg per week.`,
      timeline: [
        { week: 'Week 1-2', desc: 'Water weight drops, energy adjusts to deficit' },
        { week: 'Week 3-4', desc: 'Fat loss begins visibly, strength maintained' },
        { week: 'Week 5-8', desc: 'Noticeable physique changes, improved energy' },
        { week: 'Week 9-12', desc: 'Significant body composition shift achieved' },
      ],
      motivation: "Consistency beats perfection every time. You don't need to be extreme — you need to be consistent. Show up 80% of the time and the results will surprise you.",
    },
    gain: {
      why: `This calorie-surplus plan with high protein (${macros.protein}g) and ample carbohydrates (${macros.carbs}g) provides the anabolic fuel your muscles need to grow. The push/pull/legs split is the gold standard for hypertrophy, ensuring each muscle group gets optimal frequency and volume.`,
      timeline: [
        { week: 'Week 1-2', desc: 'Strength increases rapidly (neural adaptations)' },
        { week: 'Week 3-4', desc: 'Muscle fullness and pump noticeably better' },
        { week: 'Week 5-8', desc: 'Measurable size gains in major muscle groups' },
        { week: 'Week 9-12', desc: '3-5kg lean muscle gain is realistic and expected' },
      ],
      motivation: "Muscles grow outside the gym, but only when you've pushed hard inside it. Eat big, lift heavy, sleep well — repeat.",
    },
    maintenance: {
      why: `Maintenance is often underrated. At ${targetCal} kcal with balanced macros, your body enters a state of body recomposition — losing small amounts of fat while maintaining or slightly building muscle. This sustainable approach is the foundation of long-term health.`,
      timeline: [
        { week: 'Week 1-2', desc: 'Energy levels stabilize, performance improves' },
        { week: 'Week 3-4', desc: 'Body composition starts gradually improving' },
        { week: 'Week 5-8', desc: 'Strength benchmarks improve consistently' },
        { week: 'Week 9-12', desc: 'Leaner, stronger physique at same body weight' },
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

function renderDietTimeline(meals) {
  const container = document.getElementById('dietTimeline');
  if (!container) return;

  container.innerHTML = meals.map(meal => {
    const totalCal = meal.items.reduce((s, i) => s + i.cal, 0);
    const totalP = meal.items.reduce((s, i) => s + i.p, 0).toFixed(1);
    const totalC = meal.items.reduce((s, i) => s + i.c, 0).toFixed(1);
    const totalF = meal.items.reduce((s, i) => s + i.f, 0).toFixed(1);

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
        <div class="meal-items">
          ${meal.items.map(item => `
            <div class="meal-item">
              <div>
                <div class="mi-name">${item.name} <span style="font-weight:400;color:var(--text3)">(${item.qty})</span></div>
                <div class="mi-macros">
                  <span class="mi-p">P: ${item.p}g</span>
                  <span class="mi-c">C: ${item.c}g</span>
                  <span class="mi-f">F: ${item.f}g</span>
                  <span style="color:var(--text3);font-weight:400">${item.cal} kcal</span>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
        <div class="meal-totals">
          <div class="mt-item"><span class="mt-label">Total:</span></div>
          <div class="mt-item"><span class="mt-label">Protein</span> <span class="mt-value mi-p">${totalP}g</span></div>
          <div class="mt-item"><span class="mt-label">Carbs</span> <span class="mt-value mi-c">${totalC}g</span></div>
          <div class="mt-item"><span class="mt-label">Fat</span> <span class="mt-value mi-f">${totalF}g</span></div>
        </div>
      </div>
    </div>
    `;
  }).join('');
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
  const age = parseInt(document.getElementById('age').value);
  const weight = parseFloat(document.getElementById('weight').value);
  const heightCm = getHeightCm();
  const gender = document.querySelector('input[name="gender"]:checked')?.value || 'other';
  const activity = document.querySelector('input[name="activity"]:checked')?.value || 'moderate';
  const goal = document.querySelector('input[name="goal"]:checked')?.value || 'maintenance';

  // Validation
  if (!age || age < 10 || age > 100) { alert('Please enter a valid age (10–100)'); return; }
  if (!weight || weight < 30 || weight > 300) { alert('Please enter a valid weight (30–300 kg)'); return; }
  if (!heightCm || heightCm < 100 || heightCm > 250) { alert('Please enter a valid height'); return; }

  userData = { age, weight, heightCm, gender, activity, goal };

  // Show results page with loading
  pageForm.classList.remove('active');
  pageResults.classList.add('active');
  loadingOverlay.classList.remove('hidden');

  // Run loading animation
  await runLoadingSequence();

  // Do all calculations
  const bmi = calcBMI(weight, heightCm);
  const bmiStatus = getBMIStatus(bmi);
  const tdee = calcTDEE(weight, heightCm, age, gender, activity);
  const targetCal = getTargetCalories(tdee, goal, bmi);
  const macros = getMacros(targetCal, weight, goal);
  const water = getWaterIntake(weight, activity);
  const level = getLevel(age, activity, bmi);
  const meals = generateDietPlan(targetCal, macros, goal, weight, bmi);
  const workout = generateWorkout(goal, level, weight, age);
  const insights = generateInsights(goal, bmi, weight, macros, targetCal, level);
  const analysisText = generateAnalysisText(bmi, bmiStatus, goal, weight, targetCal, macros, activity);

  planData = { bmi, bmiStatus, tdee, targetCal, macros, water, level, meals, workout, insights };

  // Save to localStorage
  localStorage.setItem('nutriai-plan', JSON.stringify({ userData, planData: { bmi, bmiStatus, tdee, targetCal, macros, water } }));

  // Hide loading
  loadingOverlay.classList.add('hidden');

  // Render all sections
  document.getElementById('bmiNumber').textContent = bmi.toFixed(1);

  const bmiStatusEl = document.getElementById('bmiStatus');
  bmiStatusEl.textContent = bmiStatus.label;
  bmiStatusEl.style.background = bmiStatus.bg;
  bmiStatusEl.style.color = bmiStatus.color;

  document.getElementById('tdeeDisplay').textContent = tdee.toLocaleString();
  document.getElementById('targetCalDisplay').textContent = targetCal.toLocaleString();
  document.getElementById('proteinGoalDisplay').textContent = macros.protein;
  document.getElementById('waterDisplay').textContent = water;

  // BMI marker position
  const clampedBMI = Math.max(10, Math.min(45, bmi));
  const pct = ((clampedBMI - 10) / 35) * 100;
  document.getElementById('bmiMarker').style.left = `${pct}%`;

  // Animate sections in sequence
  setTimeout(() => renderBMIGauge(bmi, bmiStatus), 100);
  setTimeout(() => renderMacroDonut(macros, targetCal), 200);
  setTimeout(() => renderDietTimeline(meals), 300);
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
