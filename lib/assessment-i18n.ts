import type { Lang } from "@/lib/dictionaries";

/**
 * Localized display text for the level-assessment survey.
 *
 * IMPORTANT: scoring stays driven by `levelAssessmentQuestions` (English array)
 * by option INDEX, so this file only provides display strings. The order and
 * count of options here must exactly match that array for each question id.
 */
type QuestionText = { title: string; options: string[] };

export const assessmentText: Record<Lang, Record<string, QuestionText>> = {
  ru: {
    self: {
      title: "Каким себя считаете?",
      options: [
        "D — новичок",
        "D+ — начинающий",
        "C — средний",
        "C+ — уверенный средний",
        "B — продвинутый любитель",
        "B+ — сильный игрок",
        "A — топ-любитель / соревновательный"
      ]
    },
    experience: {
      title: "Как давно вы играете в падел?",
      options: ["Никогда не играл(а)", "Меньше 3 месяцев", "3–12 месяцев", "1–2 года", "Больше 2 лет"]
    },
    frequency: {
      title: "Как часто вы играете?",
      options: ["Реже раза в месяц", "Примерно раз в месяц", "Примерно раз в неделю", "Дважды в неделю", "3 и более раз в неделю"]
    },
    volume: {
      title: "Сколько матчей вы сыграли всего?",
      options: ["Ещё ни одного", "1–20", "20–100", "100 и более"]
    },
    serve: {
      title: "Подача и приём",
      options: ["Часто ошибаюсь или не контролирую", "Стабильно ввожу мяч в игру", "Стабильно, с глубиной и точностью"]
    },
    rally: {
      title: "Контроль розыгрыша",
      options: ["Только короткие обмены", "Держу 10+ ударов в среднем темпе", "Контролирую глубину и темп, мало ошибок"]
    },
    walls: {
      title: "Игра от стен (защита)",
      options: ["Не использую стены", "Иногда отыгрываю от задней", "Уверенно от задней и боковой"]
    },
    attack: {
      title: "Атакующие удары (бандеха / вибора / смэш)",
      options: ["Почти не атакую", "Бандеха, чтобы удержать сетку", "Бандеха + вибора + смэш с контролем под давлением"]
    },
    tactics: {
      title: "Тактика и игра в паре",
      options: ["В основном думаю о своих ударах", "Двигаемся и закрываем корт вместе, использую свечу", "Предугадываем и выстраиваем розыгрыш как пара"]
    },
    tournaments: {
      title: "Турнирный опыт",
      options: ["Никогда", "Несколько раз", "Регулярно"]
    },
    competition: {
      title: "Максимальный уровень соревнований",
      options: ["Не выступаю", "Клуб / любительские лиги", "Региональные турниры", "Национальный и выше"]
    }
  },
  en: {
    self: {
      title: "How do you rate yourself?",
      options: [
        "D — beginner",
        "D+ — improver",
        "C — intermediate",
        "C+ — solid intermediate",
        "B — advanced amateur",
        "B+ — strong player",
        "A — top amateur / competitive"
      ]
    },
    experience: {
      title: "How long have you been playing padel?",
      options: ["I’ve never played padel", "Less than 3 months", "3–12 months", "1–2 years", "More than 2 years"]
    },
    frequency: {
      title: "How often do you play?",
      options: ["Less than once a month", "About once a month", "About once a week", "Twice a week", "3 or more times per week"]
    },
    volume: {
      title: "How many matches have you played in total?",
      options: ["None yet", "1–20", "20–100", "100 or more"]
    },
    serve: {
      title: "Serve and return",
      options: ["I often miss or can’t control them", "I reliably put the ball in play", "Consistent, with depth and placement"]
    },
    rally: {
      title: "Rally control",
      options: ["Only short exchanges", "I keep 10+ shots at a medium pace", "I control depth and tempo with few errors"]
    },
    walls: {
      title: "Playing off the walls (defense)",
      options: ["I don’t use the walls", "I take the back wall sometimes", "Confident off back and side glass"]
    },
    attack: {
      title: "Attacking shots (bandeja / víbora / smash)",
      options: ["I rarely attack", "Bandeja to hold the net", "Bandeja + víbora + smash with control under pressure"]
    },
    tactics: {
      title: "Tactics and playing as a pair",
      options: ["I mostly focus on my own shots", "We move and cover the court together, I use the lob", "We anticipate and build points as a pair"]
    },
    tournaments: {
      title: "Tournament experience",
      options: ["Never", "A few times", "Regularly"]
    },
    competition: {
      title: "Highest level you have competed at",
      options: ["I don’t compete", "Club / amateur leagues", "Regional tournaments", "National or higher"]
    }
  }
};

export function getAssessmentText(lang: Lang) {
  return assessmentText[lang] ?? assessmentText.ru;
}
