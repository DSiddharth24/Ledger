# Ledger

A typing speed test that feels like typing into a real ledger book — ink stamps, a paper feed that scrolls past a fixed strike point, and a rubber-stamped results panel. Built as Day 1 of a **100 Days, 100 Repos** challenge: one new project, in a new language, framework, or domain, every day for 100 days.

## Live demo

**[ledger-typing-test.vercel.app](https://your-live-link-here)** — start typing, no button required, the test begins on your first keystroke.

## What it is

Most typing tests recolor characters in a static block of text. Ledger works differently — text enters at one fixed point (the "strike point") and the page scrolls upward and away as you type, the way paper actually moves through a typewriter. Correct keystrokes stamp in with a quick ink-flash; mistakes leave a red smudge. Finish a round and the stats get stamped onto the page like a ledger entry.

## Features

- **15s / 30s / 60s timed modes**, selected via ledger-tab style controls
- **Live WPM, accuracy, and error tracking**, rendered as the round plays out
- **Physical paper-feed animation** — fixed strike point, line-feed pull with spring/overshoot physics, a curl effect where the paper meets the platen
- **Ink-stamp keystroke feedback** — correct keys stamp in sage green, mistakes smudge in ribbon red
- **Idle ghost-typing demo** on first load, so the mechanic is obvious before you type a single key — cancels instantly the moment you start typing for real
- **Reduced-motion support** — all animation gracefully degrades to instant state changes

## Design system

Ledger deliberately avoids the two most common "typing test" looks (dark-mode-with-neon, or flat SaaS card). Instead it leans into a **ledger book / typewriter ribbon** aesthetic:

| Token | Value | Use |
|---|---|---|
| Ledger Navy | `#1B2430` | Page background |
| Aged Brass | `#C08A3E` | Borders, rules, accents |
| Ivory Paper | `#F2ECE1` | Card surface, primary text |
| Ribbon Red | `#B33A3A` | Errors, incorrect keystrokes |
| Sage Ink | `#7C8B6F` | Correct keystrokes, success states |

**Type**: `Special Elite` for the wordmark and results stamp only, `IBM Plex Sans` for body/UI copy, `IBM Plex Mono` for the typing prompt and all stats.

## Tech stack

- [Vite](https://vitejs.dev/) + React + TypeScript
- Tailwind CSS
- Framer Motion (spring-based paper-feed and stamp animations)
- Oxlint
  
```
ledger-typing-test/
├── src/
│   ├── components/
│   │   ├── LedgerCard.tsx       # main paper card + strike-point logic
│   │   ├── ModeTabs.tsx         # 15s / 30s / 60s selectors
│   │   ├── ResultsStamp.tsx     # "ENTRY LOGGED" results panel
│   │   └── GhostTyping.tsx      # idle hero demo loop
│   ├── hooks/
│   │   └── useTypingTest.ts     # keystroke handling, WPM/accuracy calc
│   ├── words.ts                 # word list for prompt generation
│   └── App.tsx
├── public/
└── tailwind.config.ts
```

## Roadmap

- [ ] Personal best tracking (local storage)
- [ ] Custom word-list mode (code snippets, quotes)
- [ ] Optional typewriter sound effects (opt-in, default off)

## About this challenge

This is Day 1 of **100 Days, 100 Repos** — a personal challenge to ship one new, non-overlapping project every day across 100 days, spanning different languages, frameworks, and domains. Follow along on [GitHub](https://github.com/DSiddharth24).

## License

MIT
