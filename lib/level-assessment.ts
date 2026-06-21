export type AssessmentOption = {
  label: string;
  points: number;
};

export type AssessmentQuestion = {
  id: string;
  title: string;
  type: "single" | "multiple";
  options: AssessmentOption[];
};

/**
 * Weighted, behaviour-based survey (the original detailed set) plus two added
 * signals: a self-rating anchor (D…A, "how do you rate yourself") and match
 * volume (how many matches you've actually played). Each option's points reflect
 * how much that signal matters; technique + competitive experience + self-rating
 * dominate, raw frequency counts least. Total max = 99 points (see MAX_SCORE).
 *
 * English `options[].label` is the fallback; localized display lives in
 * `assessment-i18n.ts` and must keep the same option count/order per question id.
 */
export const levelAssessmentQuestions: AssessmentQuestion[] = [
  {
    id: "self",
    title: "How do you rate yourself?",
    type: "single",
    options: [
      { label: "D — beginner", points: 0 },
      { label: "D+ — improver", points: 3 },
      { label: "C — intermediate", points: 6 },
      { label: "C+ — solid intermediate", points: 9 },
      { label: "B — advanced amateur", points: 12 },
      { label: "B+ — strong player", points: 15 },
      { label: "A — top amateur / competitive", points: 18 }
    ]
  },
  {
    id: "experience",
    title: "How long have you been playing padel?",
    type: "single",
    options: [
      { label: "I’ve never played padel", points: 0 },
      { label: "Less than 3 months", points: 2 },
      { label: "3–12 months", points: 5 },
      { label: "1–2 years", points: 8 },
      { label: "More than 2 years", points: 10 }
    ]
  },
  {
    id: "frequency",
    title: "How often do you play?",
    type: "single",
    options: [
      { label: "Less than once a month", points: 0 },
      { label: "About once a month", points: 2 },
      { label: "About once a week", points: 4 },
      { label: "Twice a week", points: 5 },
      { label: "3 or more times per week", points: 6 }
    ]
  },
  {
    id: "volume",
    title: "How many matches have you played in total?",
    type: "single",
    options: [
      { label: "None yet", points: 0 },
      { label: "1–20", points: 2 },
      { label: "20–100", points: 4 },
      { label: "100 or more", points: 6 }
    ]
  },
  {
    id: "serve",
    title: "Serve and return",
    type: "single",
    options: [
      { label: "I often miss or can’t control them", points: 0 },
      { label: "I reliably put the ball in play", points: 3 },
      { label: "Consistent, with depth and placement", points: 6 }
    ]
  },
  {
    id: "rally",
    title: "Rally control",
    type: "single",
    options: [
      { label: "Only short exchanges", points: 0 },
      { label: "I keep 10+ shots at a medium pace", points: 4 },
      { label: "I control depth and tempo with few errors", points: 7 }
    ]
  },
  {
    id: "walls",
    title: "Playing off the walls (defense)",
    type: "single",
    options: [
      { label: "I don’t use the walls", points: 0 },
      { label: "I take the back wall sometimes", points: 3 },
      { label: "Confident off back and side glass", points: 6 }
    ]
  },
  {
    id: "attack",
    title: "Attacking shots (bandeja / víbora / smash)",
    type: "single",
    options: [
      { label: "I rarely attack", points: 0 },
      { label: "Bandeja to hold the net", points: 4 },
      { label: "Bandeja + víbora + smash with control under pressure", points: 8 }
    ]
  },
  {
    id: "tactics",
    title: "Tactics and playing as a pair",
    type: "single",
    options: [
      { label: "I mostly focus on my own shots", points: 0 },
      { label: "We move and cover the court together, I use the lob", points: 4 },
      { label: "We anticipate and build points as a pair", points: 8 }
    ]
  },
  {
    id: "tournaments",
    title: "Tournament experience",
    type: "single",
    options: [
      { label: "Never", points: 0 },
      { label: "A few times", points: 4 },
      { label: "Regularly", points: 8 }
    ]
  },
  {
    id: "competition",
    title: "Highest level you have competed at",
    type: "single",
    options: [
      { label: "I don’t compete", points: 0 },
      { label: "Club / amateur leagues", points: 6 },
      { label: "Regional tournaments", points: 11 },
      { label: "National or higher", points: 16 }
    ]
  }
];

export const MAX_SCORE = 99;

// Map the weighted score (0–MAX_SCORE) to a continuous padel level 1.00–7.00,
// rounded to two decimals. Piecewise-linear over anchor points calibrated to
// realistic player profiles; the top is intentionally hard.
const LEVEL_ANCHORS: [number, number][] = [
  [0, 1.0],
  [12, 2.0],
  [33, 2.8],
  [53, 3.5],
  [78, 4.5],
  [91, 5.5],
  [MAX_SCORE, 7.0]
];

export function levelFromScore(score: number) {
  const s = Math.max(0, Math.min(MAX_SCORE, score));
  let level = 7.0;
  for (let i = 1; i < LEVEL_ANCHORS.length; i += 1) {
    const [x0, y0] = LEVEL_ANCHORS[i - 1];
    const [x1, y1] = LEVEL_ANCHORS[i];
    if (s <= x1) {
      level = y0 + ((y1 - y0) * (s - x0)) / (x1 - x0);
      break;
    }
  }
  return Math.round(Math.min(7, Math.max(1, level)) * 100) / 100;
}

const levelDescriptions: Record<"ru" | "en", Record<string, string>> = {
  en: {
    "1.0": "You are just beginning your padel journey. Focus on learning the basic rules, serving, and building confidence on court.",
    "1.5": "Beginner player. You are starting to rally and gradually reducing the number of unforced errors.",
    "2.0": "Beginner+. You understand the basic strokes and can enjoy relaxed matches with players of a similar level.",
    "2.5": "Strong beginner / improver. Your consistency is improving, you read the ball better, and you are starting to apply simple tactics.",
    "3.0": "Confident recreational player. You understand the fundamentals of tactics, can sustain rallies, and are ready to play with most intermediate-level players.",
    "3.5": "Intermediate. You play consistently, use the glass and lobs effectively, and make better decisions about positioning and pace.",
    "4.0": "Strong intermediate. You control rallies confidently, use advanced shots, and approach the game with a tactical mindset.",
    "4.5": "Advanced amateur. You compete at a high amateur level, can vary the pace of play, and consistently create pressure on your opponents.",
    "5.0": "Advanced competitive player. You are ready for strong competitive matches, regular tournaments, and challenging opponents.",
    "5.5": "Advanced player. You sustain high-paced rallies, attack consistently, and read the game well across full matches.",
    "6.0": "Highly advanced. Strong, varied attacking game, smart court positioning, and reliable execution under pressure.",
    "6.5": "Competitive player. Tournament-level consistency, tactical depth, and control of match tempo.",
    "7.0": "Top competitive / semi-pro. A complete game with high physical and mental level, ready for the strongest opposition."
  },
  ru: {
    "1.0": "Вы только начинаете путь в паделе. Сосредоточьтесь на базовых правилах, подаче и уверенности на корте.",
    "1.5": "Начинающий игрок. Начинаете держать розыгрыши и постепенно уменьшаете число невынужденных ошибок.",
    "2.0": "Начинающий+. Понимаете базовые удары и можете спокойно играть с игроками похожего уровня.",
    "2.5": "Уверенный новичок. Стабильность растёт, вы лучше читаете мяч и начинаете применять простую тактику.",
    "3.0": "Уверенный любитель. Понимаете основы тактики, держите розыгрыши и готовы играть с большинством игроков среднего уровня.",
    "3.5": "Средний уровень. Играете стабильно, эффективно используете стекло и свечи, лучше выбираете позицию и темп.",
    "4.0": "Уверенный средний уровень. Контролируете розыгрыши, используете продвинутые удары и играете тактически.",
    "4.5": "Продвинутый любитель. Играете на высоком любительском уровне, варьируете темп и постоянно создаёте давление на соперников.",
    "5.0": "Продвинутый соревновательный игрок. Готовы к сильным матчам, регулярным турнирам и серьёзным соперникам.",
    "5.5": "Продвинутый игрок. Держите быстрый темп, стабильно атакуете и хорошо читаете игру на дистанции матча.",
    "6.0": "Очень продвинутый. Сильная и разнообразная атака, грамотный выбор позиции, надёжность под давлением.",
    "6.5": "Соревновательный уровень. Турнирная стабильность, тактическая глубина, контроль темпа матча.",
    "7.0": "Топ-уровень / полупро. Полный арсенал, высокая физика и психология, готовность к самым сильным соперникам."
  }
};

export function levelDescription(level: number, lang: "ru" | "en" = "en") {
  const set = levelDescriptions[lang] ?? levelDescriptions.en;
  const band = (Math.round(level * 2) / 2).toFixed(1);
  return set[band] ?? set["3.0"];
}

export function canRetakeAssessment(_lastDate: Date | null | undefined, _now = new Date()) {
  return true;
}
