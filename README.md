# The Secret Garden: My Empathy Journey

**Interactive 3D Empathy Adventure Based on *The Secret Garden***

Frances Hodgson Burnett-тің *The Secret Garden* (1911) шығармасына негізделген 3D интерактивті веб-ойын + зерттеу платформасы + жеке нәтиже жүйесі.

Пайдаланушы құпия баққа кіреді, Mary, Colin және Dickon кейіпкерлерімен 5 миссиядан өтеді, әдеби және цифрлық өмірдегі жағдайларда шешім қабылдайды, бақты қалпына келтіреді және соңында өз таңдауынан құрылған **5 қабатты 3D Empathy Values Pyramid** көреді.

> Нәтиже тек осы платформадағы таңдауларды сипаттайды. Бұл психологиялық диагноз емес.

---

## 1. Қалай іске қосу керек

Жоба серверсіз жұмыс істейді, бірақ браузер JSON файлдарын оқуы үшін оны **жергілікті веб-сервер** арқылы ашу керек (`index.html`-ді жай екі рет басу жеткіліксіз).

| Компьютер | Не істеу керек |
|---|---|
| **macOS** | `start.command` файлын екі рет басыңыз (алғашқы рет: тышқанның оң жағы → *Open*). Браузер өзі ашылады. |
| **Windows** | `start.bat` файлын екі рет басыңыз (Python орнатылған болуы керек). |
| **VS Code** | *Live Server* кеңейтімімен `index.html`-ді ашыңыз. |
| **Терминал** | Жоба папкасында: `python3 -m http.server 8080`, содан кейін `http://localhost:8080` |

Интернет бірінші жүктеу үшін керек (Three.js, GSAP, Chart.js және қаріптер CDN-нен жүктеледі). Жүктелгеннен кейін ойын интернетсіз де жалғасады.

**Интернетке жариялау:** папканы толығымен GitHub Pages, Netlify немесе Vercel-ге жүктеңіз — басқа ештеңе керек емес.

---

## 2. Ойын құрылымы

```
Landing → Avatar → Before (Quick Choices) → Garden Gate → 3D Map
→ 5 Missions (+ Digital Garden) → Garden Restoration → After (One Last Challenge)
→ 3D Empathy Pyramid → Final Garden + Badge
```

| # | Миссия | Кейіпкер | Картадағы орны | Мини-ойын | Құндылық |
|---|---|---|---|---|---|
| 1 | The Locked Garden | Mary | Old Tree | Find the Key (3D іздеу) | Curiosity + Understanding |
| 2 | Mary's Choice | Mary, Martha | Rose Garden | What Should Mary Do? (тармақталған сюжет) | Respect + Kindness |
| 3 | Help Colin | Colin | Colin's Window | Emotion Match | Understanding + Caring |
| 4 | Dickon's Garden | Dickon | Hidden Bench | Restore the Path (drag-and-drop) | Cooperation + Compassion |
| 5 | The Digital Garden | — | Digital Portal | 5 чат-жағдай | Digital Empathy |

Әр миссия бірдей схема бойынша жүреді: **Explore → Story → Decision → Consequence → Reflection → Reward**.

Қосымша: **Fountain** жанында тұқым отырғызу (Rose → Compassion, Sunflower → Kindness, Lavender → Caring, Fern → Understanding, Ivy → Respect), бақта жасырылған 6 collectible, 7 achievement, **Garden Journal** (Story / Values / Seeds / Achievements / My Journey).

**Garden Restoration:** 0 — солғын бақ · 1 — шөп · 2 — гүлдер · 3 — ағаштар жапырақтанады · 4 — құстар · 5 — бақ толық қалпына келеді.

---

## 3. Режимдер

- **Full Journey** (15–25 мин) — оқушылар ойнайтын толық нұсқа. Деректер зерттеуге сақталады.
- **Demo Mode** (3–5 мин) — басты беттегі *Demo Mode*: Colin миссиясы → бір цифрлық жағдай → бақтың қалпына келуі → 3D пирамида → Research result. Демо деректері `demo` деп белгіленеді, зерттеуге саналмайды және оқушының сақталған прогресін өшірмейді.
- **Research Mode** — басты беттегі *For teachers*: зерттеу логикасы (Before → Activities → After → Result), Demo Mode және дашбордқа сілтеме.
- **Research Dashboard** — `/research` (қарапайым навигацияда көрінбейді).

---

## 4. Ұпай есептеу (ғылыми логика)

Әр жауап бір немесе бірнеше құндылыққа ұпай береді: **Respect, Understanding, Kindness, Caring, Compassion**.

- Әр құндылық үшін: `score % = алынған ұпай / мүмкін максимум ұпай × 100` (максимум = әр сұрақтағы ең жоғары ұпайлар қосындысы)
- Өзгеріс: `After % − Before %` (пайыздық пункт)
- **Пирамида** = миссиялар мен цифрлық жағдайлардағы таңдаулар.
- **Before/After** = 8 + 8 ситуация. Олар бір құндылықтарды өлшейді, бірақ ситуациялар әртүрлі (B1 ↔ A1, B2 ↔ A2 …).
- Жауаптардың реті әр оқушыға кездейсоқ ауыстырылады (answer order randomization), көрсетілген рет те сақталады.
- Ойын кезінде пайыз көрсетілмейді — тек тұқымдар, гүлдер, жарық. Пайыздар тек финалда.
- Жалғыз «Empathy = 85%» көрсеткіші қолданылмайды — нәтиже 5 компонент бойынша бөлек.

Формулалар `js/scoring.js` файлында.

---

## 5. Сұрақтарды өзгерту

Сұрақтар кодқа емес, JSON файлдарына жазылған:

- `data/questions.json` — Before және After ситуациялары
- `data/missions.json` — миссиялар, диалогтар, таңдаулар, ұпайлар, feedback, цифрлық чат-жағдайлар
- `data/characters.json` — кейіпкерлер туралы мәлімет
- `data/garden.json` — құндылықтар (түс, сипаттама, кеңес), achievements, collectibles, өсімдіктер

Мысал (бір жауап нұсқасы):

```json
{ "id": "b", "text": "Invite the student to join us.", "scores": { "kindness": 2, "caring": 1 } }
```

---

## 6. Деректер және құпиялылық

Толық аты-жөні, телефон, email, мекенжай **жиналмайды**. Сақталатыны: анонимді ID, nickname, сынып, avatar, жауаптар, ұпайлар, уақыт.

Әр қатысушының жазбасы (`js/storage.js → buildRecord`):

```
participantId, nickname, grade, avatar, beforeAnswers, missionAnswers, digitalAnswers,
afterAnswers, respectScore, understandingScore, kindnessScore, caringScore,
compassionScore, startedAt, completedAt  (+ beforeScores, afterScores, completedMissions)
```

**Деректер қайда сақталады:**
- Әдепкі: браузердің `localStorage`-і (прогресс қайта ашқанда жалғасады).
- Бір сыныпта бірнеше компьютер болса: әр компьютердегі `/research` → **⬇ JSON**, содан кейін бір компьютерде **⬆ Import JSON** арқылы біріктіріңіз. **⬇ CSV** — Excel үшін.
- Немесе **Supabase** (төменде) — барлық құрылғылардың деректері бір жерге жиналады.

### Supabase қосу (міндетті емес)

1. supabase.com-да жоба ашыңыз → *SQL Editor* → мына кодты орындаңыз:

```sql
create table participants (
  participant_id text primary key,
  mode text,
  data jsonb not null,
  updated_at timestamptz default now()
);
alter table participants enable row level security;
create policy "insert" on participants for insert to anon with check (true);
create policy "update" on participants for update to anon using (true) with check (true);
create policy "read"   on participants for select to anon using (true);
```

2. *Project Settings → API* бөлімінен `Project URL` және `anon public` кілтін `js/config.js` ішіне жазыңыз.
3. Дашборд енді «Supabase + this device» деп көрсетеді.

> Ескерту: «read» саясаты anon кілті бар кез келген адамға анонимді деректерді оқуға мүмкіндік береді. Зерттеу аяқталған соң бұл саясатты өшіруге болады.

---

## 7. Файлдар құрылымы

```
index.html              — ойынның негізгі беті
research/index.html     — зерттеуші дашборды (/research)
start.command, start.bat— бір басумен іске қосу

css/main.css            — түстер, батырмалар, loader, басты бет, модальдар
css/game.css            — HUD, карта белгілері, миссиялар, мини-ойындар, пирамида, журнал
css/responsive.css      — планшет және телефон
css/research.css        — дашборд

js/app.js               — іске қосу: loader, JSON жүктеу, 3D немесе 2D fallback
js/game.js              — ойынның барлық кезеңдері, карта, Before/After, пирамида, финал, журнал, баптаулар
js/missions.js          — миссия қадамдары (Explore → … → Reward), чат-жағдайлар
js/minigames.js         — Find the Key, Emotion Match, Restore the Path, Seed Planting
js/scoring.js           — 5 құндылық, формулалар, кездейсоқ рет
js/storage.js           — localStorage, зерттеу жазбасы, Supabase
js/three-scene.js       — 3D бақ (Three.js): қақпа, сарай, ағаштар, фонтан, портал, кейіпкерлер, қалпына келу
js/pyramid.js           — 3D Empathy Pyramid (айналдыру, zoom, қабатты басу)
js/animations.js        — GSAP tween, бет ауысу эффектілері (fade, leaf, pixel, light)
js/audio.js             — тыныш бақ дыбыстары (Web Audio API, файлсыз)
js/portraits.js         — кейіпкерлердің SVG портреттері (эмоциялармен), avatar, өсімдіктер, badge
js/ui.js                — HUD, хабарламалар, модальдар, achievement popup
js/research.js          — дашборд статистикасы мен графиктері (Chart.js)
js/config.js            — Supabase баптаулары

data/*.json             — сұрақтар, миссиялар, кейіпкерлер, бақ деректері
assets/                 — иконка; 3D модельдер кодпен жасалған (assets/models/README.md)
```

---

## 8. Технологиялар

HTML5 · CSS3 · JavaScript (React жоқ) · **Three.js** (3D) · **GSAP** (анимация) · **Chart.js** (графиктер) · Web Audio API (дыбыс) · localStorage / Supabase.

3D модельдер кодпен (қарапайым пішіндерден) жасалған, сондықтан ауыр GLB файлдарын жүктеудің қажеті жоқ; пирамида модулі тек финалда жүктеледі (lazy loading). Телефонда полигондар, көлеңкелер мен бөлшектер азаяды.

---

## 9. Қолжетімділік

- Барлық әрекет пернетақтамен: **Tab**, **Enter**, жауаптар үшін **1–4** (немесе **A–D**), **Esc** — терезені жабу.
- 🔊 / 🔇 дыбыс батырмасы; ойын дыбыссыз да толық жұмыс істейді.
- Settings: Reduce animations, Larger text, Sound captions (дыбыс субтитрлері), 3D quality, Restart Journey.
- «Skip animation» батырмасы (қақпа мен пирамида анимациясы).
- 3D жұмыс істемесе — автоматты түрде 2D карта.
- Интернет жоғалса: *Your progress is safe. You can continue offline.*

Браузерлер: Chrome, Edge, Safari, Firefox (соңғы нұсқалар).

---

## 10. Қорғауда көрсету (3–5 мин)

1. Басты бет → **Demo Mode** — қақпа ашылады, 3D бақ көрінеді.
2. **Colin's Window** → Colin миссиясы (Emotion Match + шешім) → Empathy Seeds.
3. **Digital Portal** → цифрлық бақ → чат-жағдай.
4. Бақ қалпына келеді → **Final Garden** → 3D пирамида құрылады.
5. **Research result** → дашбордтағы Before/After графиктері.
   (Дашбордта нақты деректер болмаса — *+ Add 24 sample participants*; үлгі деректер «sample» деп белгіленеді.)
