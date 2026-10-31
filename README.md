# LoopBreaker

**An adaptive exam-prep tutor that notices when a student is stuck in a loop, finds the real gap, and fixes it.**

Built for the AI Hackathon by Product Space x Wispr Flow.
Problem statement: *Adaptive exam-prep tutor with a learner model*.
Focus: **The Death Loop (Algorithmic Fatigue)**.

---

## The problem

Most tutors keep serving similar questions on the same weak topic. They see that an answer was wrong, but not *why*. The student gets frustrated, starts guessing, and quits. Teachers never see it happening.

## Our solution

When a student fails the same concept twice, Unstuck stops repeating questions. It asks one quick "why did you choose this?", finds the weakest prerequisite in a concept graph, and runs a short deep dive on the real gap. Teachers see who is stuck and the reason the student gave.

---

## Features

- **Concept graph** for Class 10 Physics, Electricity chapter: 27 concepts with prerequisite links, checked for cycles on load.
- **Learner model** that updates a mastery score per concept after every answer (BKT-style).
- **Adaptive difficulty** (easy / medium / hard), set automatically per answer.
- **Confidence tap** on every answer (Sure / Not sure, no default), which changes how the answer is scored.
- **Loop Breaker**: after 2 wrong answers on one concept, it asks "why?", logs a struggle point, and runs extra questions on the weakest prerequisite. These extra questions do not count toward the chosen quiz length.
- **Misconception detection** from the student's stated reasoning and from confident wrong answers, not just the final answer.
- **Student report**: understood / shaky / weak, with exact retakes such as "Retake: Ohm's law (prerequisite: voltage vs current)". Quizzes under 10 questions are labelled "early estimate".
- **Teacher dashboard**: class average, class-wide gaps ranked by severity, aggregated "why" reasons, and a student roster showing who is stuck and why.

---

## How scoring works

| Answer | Treated as |
|---|---|
| Right + Sure | Full credit |
| Right + Not sure | Small credit (shaky) |
| Wrong + Not sure | Knowledge gap |
| Wrong + Sure | Likely misconception (highest priority) |

- **Understood** = 3 correct in a row at medium or hard, all marked Sure, and mastery of at least 0.8.
- **Shaky** = mastery between 0.4 and 0.8, or 0.8 or more without the streak.
- **Weak** = mastery below 0.4.
- **Loop trigger** = 2 wrong in a row on the same concept, or repeated confident wrong answers.
- **Root gap** = the prerequisite with the lowest mastery (unseen concepts count as the starting value).
- All numbers live in `config.ts` and are tunable starting values.

---

## Quick start

Requirements: Node.js 18 or newer.

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually http://localhost:5173).

Run the engine tests:

```bash
npx vitest run
```

---

## Demo walkthrough

1. Pick a quiz length and start.
2. Answer a question wrong and tap **Sure**. Do it again on the same concept.
3. The "why?" screen appears. Choose a reason.
4. A few extra questions appear on the prerequisite gap.
5. Finish the quiz to see the report with exact retake suggestions.
6. Open the **Teacher dashboard** tab. You appear at the top of the roster, with your struggle points.

---

## Project structure

```
index.html              entry page
main.tsx                app entry
App.tsx                 student / teacher tabs and routing between views
QuizScreen.tsx          setup, quiz, and "why?" screens
ReportDashboard.tsx     student report and retake suggestions
TeacherDashboard.tsx    class gaps, roster, student detail
quizStore.ts            Zustand store: quiz flow, loop breaker, deep dive
engine.ts               mastery engine (pure functions)
engine.test.ts          unit tests for the engine
config.ts               tunable parameters
types.ts                shared types
concept.json            concept graph (id, name, prerequisites)
questions.json          question bank tagged by concept and difficulty
```

### Question format

```json
{
  "id": "q1",
  "concept_id": "ohm_law",
  "difficulty": "medium",
  "question_text": "...",
  "options": { "A": "...", "B": "...", "C": "...", "D": "..." },
  "correct_option": "B",
  "misconceptions": { "A": "Confused V=IR with P=VI" }
}
```

---

## Tech stack

React, TypeScript, Zustand, Tailwind CSS, Vite, Vitest.

---

## Limitations (honest notes)

- The teacher dashboard shows **18 simulated students** plus the live student, so a class view can be demonstrated. It is not connected to real classroom data.
- Mastery parameters are starting values, not validated on real students.
- **Spaced-repetition scheduling is not fully built**: the engine stores when each concept was last seen, but there is no scheduler yet.
- Only one chapter (Electricity) is covered.
- The question bank is small and pre-written. There is no live question generation.
- Student progress is kept in memory and is lost on refresh.

## Roadmap

- Spaced-repetition scheduler built on the stored last-seen data
- LLM-assisted question generation with a review step
- Persistent storage and real student accounts
- More chapters, since the concept graph is data and not code
- Validate and tune the mastery parameters with real classroom data

---

## AI-assisted development disclosure

This project was built with AI coding assistance ("vibe coding"). I used Trae, Claude and Google AI to generate and debug much of the code (the mastery engine, quiz flow, dashboards and tests) though the logic parts where completely planed by me to align with the solution to the current problem faced by students (death loop), and to help draft this documentation.

My role: I chose the problem and the Death Loop focus, defined the product flow and scoring rules, reviewed and ran the code, and fixed the integration issues.

## Acknowledgements

Built during the AI Hackathon by Product Space in collaboration with Wispr Flow. Wispr Flow was used for dictation with the prompts.

Author: Ashutosh Aloka Kumar Chauhan 