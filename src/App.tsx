/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, ChangeEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Volume2,
  VolumeX,
  RotateCcw,
  Keyboard,
  Clock,
  History,
  TrendingUp,
  Award,
  AlertTriangle,
  RotateCcw as ResetIcon,
  HelpCircle
} from 'lucide-react';
import { generateTestPassage } from './data';
import { ScoreEntry, TestDuration, TestStatus } from './types';
import { typewriterSound } from './sound';

interface WrappedLine {
  text: string;
  startIndex: number;
  endIndex: number; // exclusive
}

function getWrappedLines(text: string, limit: number): WrappedLine[] {
  const words = text.split(' ');
  const lines: WrappedLine[] = [];
  let currentLineWords: string[] = [];
  let currentLineLength = 0;
  let currentStartIndex = 0;

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const wordLen = word.length;
    const addedLength = currentLineWords.length > 0 ? (1 + wordLen) : wordLen;

    if (currentLineLength + addedLength <= limit) {
      currentLineWords.push(word);
      currentLineLength += addedLength;
    } else {
      const lineText = currentLineWords.join(' ');
      lines.push({
        text: lineText,
        startIndex: currentStartIndex,
        endIndex: currentStartIndex + lineText.length
      });
      currentStartIndex = currentStartIndex + lineText.length + 1; // plus space
      currentLineWords = [word];
      currentLineLength = wordLen;
    }
  }

  if (currentLineWords.length > 0) {
    const lineText = currentLineWords.join(' ');
    lines.push({
      text: lineText,
      startIndex: currentStartIndex,
      endIndex: currentStartIndex + lineText.length
    });
  }

  return lines;
}

const ScrollTriggeredSection = ({ title, content }: { title: string; content: React.ReactNode }) => {
  return (
    <div className="w-full max-w-2xl mt-10 mb-2 px-4">
      {/* Ledger-rule wipe line */}
      <motion.div
        initial={{ scaleX: 0, originX: 0 }}
        whileInView={{ scaleX: 1 }}
        viewport={{ once: true, margin: "-65px" }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="h-[1.5px] bg-[#C08A3E] w-full"
      />
      
      {/* Content container with delay fade and rise */}
      <motion.div
        initial={{ y: 12, opacity: 0 }}
        whileInView={{ y: 0, opacity: 1 }}
        viewport={{ once: true, margin: "-65px" }}
        transition={{ delay: 0.12, duration: 0.4, ease: "easeOut" }}
        className="mt-4 pl-4 border-l-2 border-stone-300/40 text-left"
      >
        <h3 className="font-display text-[10px] font-black tracking-widest text-[#C08A3E] uppercase mb-1.5">
          {title}
        </h3>
        <p className="font-sans text-[11px] text-stone-600 leading-relaxed font-medium">
          {content}
        </p>
      </motion.div>
    </div>
  );
};

export default function App() {
  // Navigation & overlay tabs
  const [activeTab, setActiveTab] = useState<'typewriter' | 'archive'>('typewriter');
  const [showManualOverlay, setShowManualOverlay] = useState<boolean>(false);
  const [isChoreographyFinished, setIsChoreographyFinished] = useState<boolean>(false);
  const [showStartPage, setShowStartPage] = useState<boolean>(true);

  // Test parameters
  const [duration, setDuration] = useState<TestDuration>(30);
  const [status, setStatus] = useState<TestStatus>('idle');
  const [passage, setPassage] = useState<string>('');
  const [typedText, setTypedText] = useState<string>('');
  
  // Ghost-typing states
  const [isGhostActive, setIsGhostActive] = useState<boolean>(true);
  const [ghostText, setGhostText] = useState<string>('');
  const [ghostPhraseIdx, setGhostPhraseIdx] = useState<number>(0);
  const [ghostCharIdx, setGhostCharIdx] = useState<number>(0);

  const GHOST_PHRASES = [
    "the quick ledger keeps its own time",
    "ink and steel carve the moments",
    "precision is the only truth",
    "shadows fade but the record remains"
  ];

  // Scoring / metrics
  const [startTime, setStartTime] = useState<number | null>(null);
  const startTimeRef = useRef<number | null>(null); // mirrors startTime but always fresh in closures
  const [timeLeft, setTimeLeft] = useState<number>(30);
  const [errorsCount, setErrorsCount] = useState<number>(0);
  const errorsCountRef = useRef<number>(0); // mirrors errorsCount but always fresh in closures
  const [history, setHistory] = useState<ScoreEntry[]>([]);

  // Sound and physical vibrations (Default OFF / Muted as per specs)
  const [isMuted, setIsMuted] = useState<boolean>(true);
  const [jitter, setJitter] = useState<boolean>(false);
  const [thud, setThud] = useState<boolean>(false);
  const [prefersReduced, setPrefersReduced] = useState<boolean>(false);

  // Mechanical virtual states
  const [pressedKeys, setPressedKeys] = useState<Set<string>>(new Set());
  const [strikeActive, setStrikeActive] = useState<boolean>(false);
  const [lastTypedChar, setLastTypedChar] = useState<string>('');
  const [keystrokeJitter, setKeystrokeJitter] = useState<boolean>(false);
  const [isLineFeeding, setIsLineFeeding] = useState<boolean>(false);
  const [isResetting, setIsResetting] = useState<boolean>(false);

  // Page-feeding & multi-page ledger logic state
  const [pages, setPages] = useState<string[]>([]);
  const [currentPageIndex, setCurrentPageIndex] = useState<number>(0);
  const [completedPagesTypedText, setCompletedPagesTypedText] = useState<string[]>([]);

  // Floating cartoon animations state
  interface ActionFloat {
    id: string;
    text: string;
    colorClass: string;
    rotation: number;
    offsetX: number;
    offsetY: number;
  }
  const [floats, setFloats] = useState<ActionFloat[]>([]);

  // References
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const ledgerScrollRef = useRef<HTMLDivElement>(null);

  // Helper to split a long passage into distinct pages of 20 words each
  const splitPassageIntoPages = (rawPassage: string): string[] => {
    const words = rawPassage.split(' ');
    const WORDS_PER_PAGE = 20;
    const pageList: string[] = [];
    for (let i = 0; i < words.length; i += WORDS_PER_PAGE) {
      pageList.push(words.slice(i, i + WORDS_PER_PAGE).join(' '));
    }
    return pageList;
  };

  // Reset/Restart the test
  const resetTest = (customDuration?: TestDuration) => {
    setIsResetting(true);
    setTimeout(() => {
      setIsResetting(false);
    }, 150);

    const targetDuration = customDuration ?? duration;
    setStatus('idle');
    setTypedText('');
    setErrorsCount(0);
    errorsCountRef.current = 0;
    setStartTime(null);
    startTimeRef.current = null;
    setTimeLeft(targetDuration);

    // Reset ghost typing loop on manually clicking reset
    setIsGhostActive(true);
    setGhostText('');
    setGhostCharIdx(0);
    
    const rawPassage = generateTestPassage(100);
    setPassage(rawPassage);
    setPages(splitPassageIntoPages(rawPassage));
    setCurrentPageIndex(0);
    setCompletedPagesTypedText([]);

    setJitter(false);
    setThud(false);
    setStrikeActive(false);
    setLastTypedChar('');
    setFloats([]);
    
    // Auto-focus typewriter
    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
  };

  const cancelGhost = () => {
    if (!isGhostActive) return;
    setIsGhostActive(false);
    setGhostText('');
    setGhostCharIdx(0);
    setTypedText('');
    setIsResetting(true);
    setTimeout(() => {
      setIsResetting(false);
    }, 150);
  };

  const handleFirstKeystroke = (keyVal: string) => {
    if (!isGhostActive) return;

    // Turn off screensaver ghost typing cleanly
    setIsGhostActive(false);
    setGhostText('');
    setGhostCharIdx(0);
    setTypedText('');
    setIsResetting(true);
    setTimeout(() => {
      setIsResetting(false);
    }, 150);

    // Filter out modifier/helper keys from initiating characters on the page
    const isModifierOrSystem = keyVal.length > 1 && keyVal !== 'Backspace' && keyVal !== 'backspace' && keyVal !== 'Back';
    if (isModifierOrSystem) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
      return;
    }

    // Set test start parameters
    const currentStartTime = Date.now();
    setStartTime(currentStartTime);
    startTimeRef.current = currentStartTime;
    setStatus('running');

    let nextText = '';
    const targetPageText = pages[currentPageIndex] || '';
    const targetChar = targetPageText[0] || '';

    if (keyVal === 'Backspace' || keyVal === 'backspace' || keyVal === 'Back') {
      nextText = '';
    } else {
      const charToType = keyVal === 'Space' || keyVal === ' ' ? ' ' : keyVal;
      const isCorrect = charToType.toLowerCase() === targetChar.toLowerCase();

      if (isCorrect) {
        nextText = targetChar;
        setLastTypedChar(targetChar);
        typewriterSound.playKeyClick(charToType === ' ');
        addFloat(charToType === ' ' ? '*whoosh!*' : `*clack!*`);
      } else {
        nextText = charToType;
        setLastTypedChar(charToType);
        typewriterSound.playErrorStrike();
        setErrorsCount(1);
        errorsCountRef.current = 1;
        addFloat('*smudge!*', true);
        if (!prefersReduced) {
          setJitter(true);
          setTimeout(() => setJitter(false), 80);
        }
      }
    }

    setTypedText(nextText);

    // Auto-focus typewriter textarea
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        inputRef.current.value = nextText;
      }
    }, 100);
  };



  // Initialize passage and history on mount
  useEffect(() => {
    const rawPassage = generateTestPassage(100);
    setPassage(rawPassage);
    setPages(splitPassageIntoPages(rawPassage));
    setTimeLeft(duration);

    // Read history from localStorage
    try {
      const saved = localStorage.getItem('ledger_scores_history');
      if (saved) {
        setHistory(JSON.parse(saved));
      }
    } catch (e) {
      console.warn('Failed to load typing history from localStorage:', e);
    }

    // Page-load choreography timer (1.8s)
    const introTimer = setTimeout(() => {
      setIsChoreographyFinished(true);
    }, 1800);

    // Check motion preferences
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReduced(motionQuery.matches);
    const handleMotionChange = (e: MediaQueryListEvent) => setPrefersReduced(e.matches);
    motionQuery.addEventListener('change', handleMotionChange);

    return () => {
      clearTimeout(introTimer);
      motionQuery.removeEventListener('change', handleMotionChange);
    };
  }, []);

  // Idle ghost-typing loop
  useEffect(() => {
    if (!isGhostActive || status !== 'idle' || activeTab !== 'typewriter' || !isChoreographyFinished) {
      return;
    }

    const currentPhrase = GHOST_PHRASES[ghostPhraseIdx];
    if (ghostCharIdx >= currentPhrase.length) {
      // Phrase completed! Pause 1.2s then wipe paper and loop to next phrase
      const completeTimer = setTimeout(() => {
        setIsResetting(true);
        const resetTimer = setTimeout(() => {
          setIsResetting(false);
          setGhostText('');
          setGhostCharIdx(0);
          setGhostPhraseIdx((prev) => (prev + 1) % GHOST_PHRASES.length);
        }, 150);
        return () => clearTimeout(resetTimer);
      }, 1200);
      return () => clearTimeout(completeTimer);
    }

    // Natural slightly irregular delay (varying inter-character delay ±30ms)
    const delay = 120 + (Math.random() * 60 - 30);

    const typeTimer = setTimeout(() => {
      const char = currentPhrase[ghostCharIdx];
      setGhostText(prev => prev + char);
      setGhostCharIdx(prev => prev + 1);

      // Sound (only if unmuted)
      if (!isMuted) {
        typewriterSound.playKeyClick(char === ' ');
      }

      // Live mechanics: strike points, line feeds, ink stamp
      setLastTypedChar(char);
      setStrikeActive(true);
      setTimeout(() => setStrikeActive(false), 85);

      if (!prefersReduced) {
        setKeystrokeJitter(true);
        setTimeout(() => setKeystrokeJitter(false), 40);
      }

      // Strobe virtual key cap
      const normKey = char === ' ' ? 'space' : char.toLowerCase();
      setPressedKeys(prev => {
        const next = new Set(prev);
        next.add(normKey);
        return next;
      });
      setTimeout(() => {
        setPressedKeys(prev => {
          const next = new Set(prev);
          next.delete(normKey);
          return next;
        });
      }, 85);

    }, delay);

    return () => clearTimeout(typeTimer);
  }, [isGhostActive, status, ghostPhraseIdx, ghostCharIdx, isMuted, prefersReduced, activeTab]);

  // Add a floating cartoon word action bubble helper
  const addFloat = (text: string, isError: boolean = false, isReset: boolean = false) => {
    if (prefersReduced) return;
    const id = Math.random().toString(36).substring(2, 9);
    const rotation = Math.random() * 24 - 12; // -12 to 12 degrees
    const offsetX = Math.random() * 80 - 40;  // -40px to 40px
    const offsetY = Math.random() * 30 - 15;  // -15px to 15px
    
    const colorClass = isError 
      ? "text-[#D3625F] border-[#B33A3A] shadow-red-950/40" 
      : isReset 
        ? "text-amber-400 border-amber-500 shadow-amber-950/40" 
        : "text-[#C08A3E] border-[#C08A3E]/30 shadow-black/40";

    const newFloat = { id, text, colorClass, rotation, offsetX, offsetY };
    setFloats(prev => [...prev, newFloat].slice(-6)); // keep last 6 elements
    
    setTimeout(() => {
      setFloats(prev => prev.filter(f => f.id !== id));
    }, 650);
  };

  // Update timer duration setting
  const handleDurationChange = (newDuration: TestDuration) => {
    if (status !== 'idle') return;
    setDuration(newDuration);
    setTimeLeft(newDuration);
    resetTest(newDuration);
  };

  // Centralized Keystroke State Engine
  const processKeystroke = (nextText: string) => {
    if (status === 'completed') return;

    if (isGhostActive) {
      cancelGhost();
      return;
    }

    const targetPageText = pages[currentPageIndex] || '';

    // Reject additions past the current page length
    if (nextText.length > targetPageText.length) return;

    // Start timer on first keystroke of the first page
    let currentStatus = status;
    let currentStartTime = startTime;
    if (status === 'idle') {
      currentStatus = 'running';
      setStatus('running');
      currentStartTime = Date.now();
      setStartTime(currentStartTime);
      startTimeRef.current = currentStartTime;
    }

    // Analyze what happened on the current page
    if (nextText.length > typedText.length) {
      // Character added
      const addedChar = nextText[nextText.length - 1];
      const targetChar = targetPageText[typedText.length];
      const isCorrect = addedChar === targetChar;

      setLastTypedChar(addedChar);
      
      // Trigger Typebar mechanical strike
      setStrikeActive(true);
      setTimeout(() => setStrikeActive(false), 90);

      if (!prefersReduced) {
        setKeystrokeJitter(true);
        setTimeout(() => setKeystrokeJitter(false), 40);
      }

      if (isCorrect) {
        const isSpace = addedChar === ' ';
        typewriterSound.playKeyClick(isSpace);
        addFloat(isSpace ? '*whoosh!*' : `*clack!*`);
      } else {
        typewriterSound.playErrorStrike();
        setErrorsCount(prev => { errorsCountRef.current = prev + 1; return prev + 1; });
        addFloat('*smudge!*', true);

        // Shake typewriter carriage on mistake
        if (!prefersReduced) {
          setJitter(true);
          setTimeout(() => setJitter(false), 80);
        }
      }
    } else if (nextText.length < typedText.length) {
      // Backspace pressed
      typewriterSound.playKeyClick(false);
      setLastTypedChar('');
      addFloat('*wipe!*', false, true);
    }

    setTypedText(nextText);

    // Auto-scroll typing ledger paper to keep active line visible
    if (ledgerScrollRef.current) {
      const activeCaret = ledgerScrollRef.current.querySelector('.active-caret-marker');
      if (activeCaret) {
        activeCaret.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }

    // Check if the current page is completed
    if (nextText.length === targetPageText.length) {
      // Is this the final page of the test?
      if (currentPageIndex === pages.length - 1) {
        // Complete the entire test session!
        const allCompleted = [...completedPagesTypedText, nextText];
        handleTestComplete(allCompleted, currentStartTime, currentStatus);
      } else {
        // Feed the next page of the ledger!
        typewriterSound.playBell();
        if (!prefersReduced) {
          setThud(true);
          setTimeout(() => setThud(false), 200);
        }
        
        // Save current page typed text
        setCompletedPagesTypedText(prev => [...prev, nextText]);
        
        // Advance page index and clear typedText for the new page
        setCurrentPageIndex(prev => prev + 1);
        setTypedText('');
        addFloat('*page feed!*', false, false);
      }
    }
  };

  // Hidden textarea text change handler
  const handleTextChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    processKeystroke(e.target.value);
  };

  // Handle clicking virtual keys
  const handleVirtualKeyClick = (keyVal: string) => {
    if (status === 'completed') return;

    if (isGhostActive) {
      handleFirstKeystroke(keyVal);
      return;
    }

    const normalizedKey = keyVal === ' ' ? 'space' : keyVal.toLowerCase();
    
    // Highlight keycap visually on screen
    setPressedKeys(prev => {
      const next = new Set(prev);
      next.add(normalizedKey);
      return next;
    });
    setTimeout(() => {
      setPressedKeys(prev => {
        const next = new Set(prev);
        next.delete(normalizedKey);
        return next;
      });
    }, 120);

    let nextText = typedText;

    if (keyVal === 'Back' || keyVal === 'backspace') {
      nextText = typedText.slice(0, -1);
      processKeystroke(nextText);
    } else if (keyVal === 'Tab') {
      typewriterSound.playKeyClick(false);
      resetTest();
    } else if (keyVal === 'Shift' || keyVal === 'Shift Lock') {
      typewriterSound.playKeyClick(false);
      addFloat('*lever!*', false, false);
    } else {
      // Determine what character to append
      const targetPageText = pages[currentPageIndex] || '';
      const targetChar = targetPageText[typedText.length];
      if (targetChar && keyVal.toLowerCase() === targetChar.toLowerCase()) {
        nextText = typedText + targetChar;
      } else {
        nextText = typedText + (keyVal === ' ' ? ' ' : keyVal);
      }
      processKeystroke(nextText);
    }

    inputRef.current?.focus();
  };

  // Keyboard shortcut and focus listeners
  useEffect(() => {
    const handleKeyDownGlobal = (e: KeyboardEvent) => {
      if (showStartPage) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      
      if (isGhostActive) {
        e.preventDefault();
        handleFirstKeystroke(e.key);
        return;
      }
      
      const key = e.key.toLowerCase();
      
      // Sync pressed keys state for virtual key depress animations
      setPressedKeys(prev => {
        const next = new Set(prev);
        next.add(key === ' ' ? 'space' : key);
        return next;
      });

      // Redirect focus to hidden input automatically when starting to type
      if (status !== 'completed' && document.activeElement !== inputRef.current) {
        inputRef.current?.focus();
      }

      // Quick reset on Tab key
      if (e.key === 'Tab') {
        e.preventDefault();
        resetTest();
      }
    };

    const handleKeyUpGlobal = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      setPressedKeys(prev => {
        const next = new Set(prev);
        next.delete(key === ' ' ? 'space' : key);
        return next;
      });
    };

    window.addEventListener('keydown', handleKeyDownGlobal);
    window.addEventListener('keyup', handleKeyUpGlobal);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDownGlobal);
      window.removeEventListener('keyup', handleKeyUpGlobal);
    };
  }, [status, typedText, passage, currentPageIndex, pages]);

  // Keep focus on hidden input when user clicks anywhere inside the ledger or typewriter
  const handleContainerClick = () => {
    if (showStartPage) return;
    if (status !== 'completed') {
      inputRef.current?.focus();
    }
  };

  // Monitor timer countdown
  useEffect(() => {
    if (status !== 'running') return;

    // Use a flag to prevent handleTestComplete from being called multiple times
    // if the 100ms interval fires twice before clearInterval takes effect.
    let completed = false;

    const timer = setInterval(() => {
      const now = Date.now();
      const elapsed = (now - (startTimeRef.current ?? now)) / 1000;
      const remaining = Math.max(0, duration - elapsed);

      setTimeLeft(Math.ceil(remaining));

      // Warning bell chime 5 seconds before session expiration
      if (remaining <= 5 && remaining > 4.9) {
        typewriterSound.playBell();
      }

      if (remaining <= 0 && !completed) {
        completed = true;
        clearInterval(timer);
        // Read latest state via functional updater pattern to avoid stale closure
        setCompletedPagesTypedText(latestCompleted => {
          setTypedText(latestTyped => {
            const allPages = [...latestCompleted, latestTyped];
            handleTestComplete(allPages, startTimeRef.current, 'running');
            return latestTyped;
          });
          return latestCompleted;
        });
      }
    }, 100);

    return () => clearInterval(timer);
  }, [status, duration]);

  // Complete the test session cumulatively across all pages
  const handleTestComplete = (allPagesTypedText: string[], currentStartTime: number | null, currentStatus: string) => {
    if (currentStatus !== 'running') return;
    
    setStatus('completed');
    typewriterSound.playBell();
    
    if (!prefersReduced) {
      setThud(true);
      setTimeout(() => setThud(false), 200);
    }

    // Calculations across all pages
    let totalCorrect = 0;
    let totalTypedLength = 0;

    allPagesTypedText.forEach((typed, pageIdx) => {
      const target = pages[pageIdx] || '';
      totalTypedLength += typed.length;
      for (let i = 0; i < typed.length; i++) {
        if (typed[i] === target[i]) {
          totalCorrect++;
        }
      }
    });

    const elapsedSeconds = currentStartTime ? (Date.now() - currentStartTime) / 1000 : duration;
    // Use actual elapsed time (minimum 1 second to avoid divide-by-zero on instant completions).
    // Do NOT clamp to 60s — that was causing WPM to be massively under-reported for short tests.
    const elapsedMinutes = Math.max(elapsedSeconds, 1) / 60;

    // Net WPM: only counts correctly-typed characters, normalised to 5-char "words"
    const finalWpm = Math.round((totalCorrect / 5) / elapsedMinutes);
    // Raw WPM: total characters typed (correct + incorrect), same normalisation
    const rawWpm = Math.round((totalTypedLength / 5) / elapsedMinutes);
    const finalAccuracy = totalTypedLength > 0 ? Math.round((totalCorrect / totalTypedLength) * 100) : 0;

    const newEntry: ScoreEntry = {
      id: Math.random().toString(36).substring(2, 9),
      date: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) + ' - ' + new Date().toLocaleDateString([], { month: 'short', day: 'numeric' }),
      wpm: finalWpm,
      accuracy: finalAccuracy,
      errors: errorsCountRef.current,
      duration: duration,
      rawWpm: rawWpm,
    };

    setHistory(prev => {
      const updated = [newEntry, ...prev].slice(0, 15);
      localStorage.setItem('ledger_scores_history', JSON.stringify(updated));
      return updated;
    });
  };

  // Toggle audio engine
  const handleToggleMute = () => {
    const nextMuted = typewriterSound.toggleMute();
    setIsMuted(nextMuted);
  };

  // Split passage for elegant styled rendering of the current page
  const renderPassage = () => {
    const currentPageText = pages[currentPageIndex] || '';
    const wrappedLines = getWrappedLines(currentPageText, lineLimit);

    const charWidth = typeof window !== 'undefined' && window.innerWidth < 768 ? 8.4 : 9.6;

    return (
      <div className="flex flex-col gap-0 select-none">
        {wrappedLines.map((line, lineIdx) => {
          const chars = line.text.split('');
          const isActiveLine = lineIdx === activeLineIdx;

          return (
            <div 
              key={`line-${lineIdx}`} 
              className={`flex items-center font-mono relative transition-opacity duration-150 ${
                isActiveLine ? "opacity-100 font-bold" : "opacity-40"
              }`}
              style={{ height: '28px', lineHeight: '28px' }}
            >
              {chars.map((char, charIdx) => {
                const globalIdx = line.startIndex + charIdx;

                let isCurrent = false;
                let isTyped = false;
                let isLastTyped = false;
                let isCorrect = true;
                let charColor = "text-[#5C5246]/60"; // Warm typewriter graphite brown
                let decorationClass = "";

                if (isGhostActive) {
                  isCurrent = globalIdx === ghostText.length;
                  isTyped = globalIdx < ghostText.length;
                  isLastTyped = globalIdx === ghostText.length - 1;
                  if (isTyped) {
                    // All ghost characters render in a muted version of the sage ink color (~60% opacity)
                    charColor = "text-[#1C3F24]/50 font-bold stamp-glow-sage";
                  }
                } else {
                  isCurrent = globalIdx === typedText.length;
                  isTyped = globalIdx < typedText.length;
                  isLastTyped = globalIdx === typedText.length - 1;
                  if (isTyped) {
                    const typedChar = typedText[globalIdx];
                    isCorrect = typedChar === char;
                    if (isCorrect) {
                      charColor = "text-[#1C3F24] font-bold stamp-glow-sage"; // Rich dark emerald ink
                    } else {
                      charColor = "text-[#B33A3A] font-extrabold stamp-glow-red bg-rose-100/60 rounded-xs"; // Ribbon red ink
                      decorationClass = "underline decoration-wavy decoration-[#B33A3A]";
                    }
                  }
                }

                const isSpace = char === ' ';
                const displayChar = isSpace ? '·' : char;

                // Frame animation for stamp-in
                const animateProps = isLastTyped && !prefersReduced
                  ? {
                      initial: { scale: 1.25, filter: isCorrect ? "none" : "blur(2.5px)" },
                      animate: { scale: 1, filter: isCorrect ? "none" : "blur(0.5px)" },
                      transition: { duration: 0.1, ease: "easeOut" }
                    }
                  : {
                      animate: { scale: 1, filter: isTyped && !isCorrect ? "blur(0.5px)" : "none" }
                    };

                return (
                  <motion.span
                    key={`char-${charIdx}`}
                    className={`relative inline-block select-none ${charColor} ${decorationClass}`}
                    style={{
                      width: `${charWidth}px`,
                      textAlign: 'center',
                      textShadow: isTyped ? (isCorrect ? '0 0 1px rgba(28, 63, 36, 0.3)' : '0 0 2px rgba(179, 58, 58, 0.6)') : 'none',
                    }}
                    {...animateProps}
                  >
                    {isCurrent && (
                      <span className="absolute -left-[1px] top-[10%] bottom-[10%] w-[2px] bg-[--aged-brass] caret-blink active-caret-marker" />
                    )}
                    {displayChar}
                  </motion.span>
                );
              })}
            </div>
          );
        })}
      </div>
    );
  };

  // Render performance history graph
  const renderHistoryGraph = () => {
    if (history.length < 2) return null;

    const graphData = [...history].reverse().slice(-10);
    const maxWpm = Math.max(...graphData.map(d => d.wpm), 80);
    const minWpm = Math.min(...graphData.map(d => d.wpm), 20);
    const wpmRange = maxWpm - minWpm === 0 ? 10 : maxWpm - minWpm;

    const width = 600;
    const height = 120;
    const paddingLeft = 35;
    const paddingRight = 15;
    const paddingTop = 15;
    const paddingBottom = 20;

    const graphWidth = width - paddingLeft - paddingRight;
    const graphHeight = height - paddingTop - paddingBottom;

    const points = graphData.map((d, index) => {
      const x = paddingLeft + (index / (graphData.length - 1)) * graphWidth;
      const y = paddingTop + graphHeight - ((d.wpm - minWpm) / wpmRange) * graphHeight;
      return { x, y, wpm: d.wpm, date: d.date.split(' - ')[0] };
    });

    let pathD = '';
    points.forEach((pt, index) => {
      if (index === 0) {
        pathD = `M ${pt.x} ${pt.y}`;
      } else {
        pathD += ` L ${pt.x} ${pt.y}`;
      }
    });

    return (
      <div className="mt-6 pt-4 border-t border-dashed border-stone-300 w-full">
        <h4 className="font-sans text-[10px] font-bold tracking-wider text-amber-800/80 mb-2 uppercase flex items-center gap-1.5 justify-center">
          <TrendingUp size={12} />
          WPM Chronological Curve
        </h4>
        <div className="w-full overflow-x-auto scrollbar-none">
          <svg viewBox={`0 0 ${width} ${height}`} className="w-full min-w-[450px] h-28 select-none">
            <line x1={paddingLeft} y1={paddingTop} x2={width - paddingRight} y2={paddingTop} stroke="#C08A3E" strokeOpacity="0.15" strokeDasharray="2" />
            <line x1={paddingLeft} y1={paddingTop + graphHeight / 2} x2={width - paddingRight} y2={paddingTop + graphHeight / 2} stroke="#C08A3E" strokeOpacity="0.15" strokeDasharray="2" />
            <line x1={paddingLeft} y1={paddingTop + graphHeight} x2={width - paddingRight} y2={paddingTop + graphHeight} stroke="#C08A3E" strokeOpacity="0.25" />

            <text x={paddingLeft - 6} y={paddingTop + 3} textAnchor="end" className="fill-amber-800/60 font-mono text-[8px]">{maxWpm}</text>
            <text x={paddingLeft - 6} y={paddingTop + graphHeight / 2 + 3} textAnchor="end" className="fill-amber-800/60 font-mono text-[8px]">{Math.round((maxWpm + minWpm) / 2)}</text>
            <text x={paddingLeft - 6} y={paddingTop + graphHeight + 3} textAnchor="end" className="fill-amber-800/60 font-mono text-[8px]">{minWpm}</text>

            <path d={pathD} fill="none" stroke="#C08A3E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />

            {points.map((pt, index) => (
              <g key={`pt-${index}`}>
                <circle cx={pt.x} cy={pt.y} r="3" className="fill-stone-100 stroke-amber-700 stroke-1.5" />
                <text x={pt.x} y={pt.y - 6} textAnchor="middle" className="fill-stone-900 font-mono text-[8px] font-bold">{pt.wpm}</text>
              </g>
            ))}
          </svg>
        </div>
      </div>
    );
  };

  // QWERTY keyboard rendering configurations
  const KEYBOARD_ROWS = [
    ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "-", "Back"],
    ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
    ["Shift Lock", "A", "S", "D", "F", "G", "H", "J", "K", "L", "*", "Tab"],
    ["Shift", "Z", "X", "C", "V", "B", "N", "M", ",", ".", "Shift"]
  ];

  // Dynamic calculations for ink ribbon, carriage sliding, and spool rotation
  const lineLimit = 42;
  const currentPageTextForCalcs = pages[currentPageIndex] || '';
  const wrappedLinesForCalcs = getWrappedLines(currentPageTextForCalcs, lineLimit);

  let activeLineIdx = 0;
  let activeColIdx = 0;

  const currentTypedTextForCalcs = isGhostActive ? ghostText : typedText;

  for (let i = 0; i < wrappedLinesForCalcs.length; i++) {
    const line = wrappedLinesForCalcs[i];
    if (currentTypedTextForCalcs.length >= line.startIndex && currentTypedTextForCalcs.length <= line.endIndex) {
      activeLineIdx = i;
      activeColIdx = currentTypedTextForCalcs.length - line.startIndex;
      break;
    }
  }

  if (wrappedLinesForCalcs.length > 0 && activeLineIdx >= wrappedLinesForCalcs.length) {
    activeLineIdx = wrappedLinesForCalcs.length - 1;
    activeColIdx = 0;
  }

  // Monitor line index changes to trigger line feed animations
  const lastLineIdxRef = useRef<number>(0);

  useEffect(() => {
    if (status !== 'running' && !isGhostActive) {
      lastLineIdxRef.current = activeLineIdx;
      return;
    }

    if (activeLineIdx > lastLineIdxRef.current) {
      setIsLineFeeding(true);
      const timer = setTimeout(() => {
        setIsLineFeeding(false);
      }, 220);
      lastLineIdxRef.current = activeLineIdx;
      return () => clearTimeout(timer);
    } else {
      lastLineIdxRef.current = activeLineIdx;
    }
  }, [activeLineIdx, status, isGhostActive]);

  const charWidth = typeof window !== 'undefined' && window.innerWidth < 768 ? 8.4 : 9.6;
  const carriageShiftX = status === 'completed' ? 0 : -activeColIdx * charWidth;
  const spoolRotationLeft = currentTypedTextForCalcs.length * 15;
  const spoolRotationRight = -currentTypedTextForCalcs.length * 15;

  const sheetScrollY = isResetting 
    ? 200 
    : status === 'completed'
      ? 120 - (wrappedLinesForCalcs.length - 1) * 28 
      : 120 - activeLineIdx * 28;

  return (
    <div 
      onClick={handleContainerClick}
      className="min-h-screen bg-[#F5F2EB] text-[#3E3832] flex flex-col items-center justify-start py-6 px-4 font-sans selection:bg-[#7C8B6F]/20 select-none overflow-x-hidden relative"
    >
      <AnimatePresence mode="wait">
        {showStartPage ? (
          <motion.div
            key="start-page"
            initial={{ opacity: 0, y: prefersReduced ? 0 : 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: prefersReduced ? 0 : -20 }}
            transition={{ duration: 0.4, ease: "easeInOut" }}
            className="w-full max-w-2xl flex flex-col items-center justify-center min-h-[85vh] py-10 px-4 relative z-10 select-none text-center"
          >
            {/* Logo / Branded Text Logo */}
            <motion.div
              initial={{ scale: prefersReduced ? 1 : 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.15, duration: 0.5, ease: "easeOut" }}
              className="flex flex-col items-center mb-8"
            >
              <h1 className="font-display text-5xl sm:text-6xl font-normal tracking-[0.3em] text-[#3E3832] uppercase select-none leading-none pl-[0.3em]">
                LEDGER
              </h1>
              <div className="flex items-center gap-2 mt-3.5">
                <span className="h-[1.5px] w-8 bg-[#C08A3E]/45" />
                <span className="font-mono text-[#C08A3E] text-[10px] font-extrabold tracking-[0.25em] uppercase">
                  MK II
                </span>
                <span className="h-[1.5px] w-8 bg-[#C08A3E]/45" />
              </div>
            </motion.div>

            {/* Slogan */}
            <motion.h2
              initial={{ y: prefersReduced ? 0 : 15, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.28, duration: 0.4 }}
              className="font-display text-xl sm:text-2xl font-extrabold tracking-[0.25em] text-[#3E3832] uppercase mb-4"
            >
              TACTILE CHRONO-TYPIST
            </motion.h2>

            {/* Literary Quote Card with Red Margins and Parchment Fill */}
            <motion.div
              initial={{ y: prefersReduced ? 0 : 15, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.38, duration: 0.4 }}
              className="w-full bg-[#FAF7F2] border-2 border-[#C08A3E]/45 rounded-xl p-5 sm:p-6 shadow-lg relative overflow-hidden select-none mb-8 text-left max-w-lg"
            >
              {/* Red double rules margins */}
              <div className="absolute left-6 top-0 bottom-0 w-[2px] border-l-2 border-rose-400/30" />
              
              <div className="pl-6 font-serif italic text-stone-700 text-xs sm:text-sm leading-relaxed tracking-wide select-none">
                “Every keystroke is an indelible stamp on the scroll of time. Type with precision and conviction, for the carbon ledger of history brooks no erasure.”
                <div className="mt-3.5 not-italic font-mono text-[8px] sm:text-[9px] uppercase tracking-widest text-[#C08A3E] font-bold text-right">
                  — Ledger Mechanical Works, Mk. II Operating Instructions
                </div>
              </div>
            </motion.div>

            {/* Duration Selector Title */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.48 }}
              className="font-mono text-[9px] sm:text-[10px] text-[#C08A3E] font-extrabold tracking-widest uppercase mb-3.5"
            >
              SELECT SESSION TIMEOUT
            </motion.p>

            {/* Vintage Option Buttons for Seconds */}
            <motion.div
              initial={{ y: prefersReduced ? 0 : 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.54, duration: 0.4 }}
              className="flex gap-4 mb-8 select-none justify-center"
            >
              {([15, 30, 60] as TestDuration[]).map((t) => {
                const isSelected = duration === t;
                return (
                  <button
                    key={`start-dur-${t}`}
                    onClick={() => {
                      typewriterSound.playKeyClick(false);
                      setDuration(t);
                      setTimeLeft(t);
                    }}
                    className={`
                      w-16 h-16 sm:w-18 sm:h-18 rounded-full flex flex-col items-center justify-center font-mono text-xs cursor-pointer select-none transition-all duration-100 relative
                      ${isSelected 
                        ? "bg-gradient-to-b from-[#2E3B4E] to-[#10161D] border-[2.5px] border-[#E4B876] text-white shadow-lg scale-105" 
                        : "bg-[#FAF7F2] border-2 border-stone-300 text-stone-600 hover:border-[#C08A3E] shadow-sm hover:scale-[1.02]"
                      }
                    `}
                  >
                    <Clock size={14} className={isSelected ? "text-[#E4B876] mb-1" : "text-stone-400 mb-1"} />
                    <span className="font-extrabold tracking-wider">{t}s</span>
                    {isSelected && (
                      <span className="absolute -bottom-1.5 w-2 h-2 rounded-full bg-[#E4B876]" />
                    )}
                  </button>
                );
              })}
            </motion.div>

            {/* Feed Paper Start Button */}
            <motion.button
              initial={{ y: prefersReduced ? 0 : 15, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.62, duration: 0.4 }}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                typewriterSound.playKeyClick(false);
                setTimeout(() => {
                  typewriterSound.playBell();
                }, 120);
                setShowStartPage(false);
                resetTest(duration);
                setTimeout(() => {
                  inputRef.current?.focus();
                }, 150);
              }}
              className="px-6 py-2.5 sm:px-8 sm:py-3 bg-[#C08A3E] hover:bg-[#b07d34] text-white font-mono text-xs uppercase tracking-[0.15em] font-extrabold rounded-lg shadow-xl cursor-pointer border border-[#8C6425]/30 transition-all flex items-center gap-2"
            >
              <Keyboard size={14} />
              FEED BLANK PAGE & START
            </motion.button>
            
            {/* Soft footer watermark on start page */}
            <div className="absolute bottom-4 left-0 right-0 text-center font-mono text-[8px] text-stone-400/80 uppercase tracking-widest">
              Licensed to Mechanical Typists • Antigravity System Mk. II
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="main-app"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="w-full flex flex-col items-center justify-start relative"
          >
            {/* HEADER SECTION */}
            <header className="w-full max-w-2xl flex flex-col sm:flex-row sm:items-center justify-between mb-6 border-b border-stone-300 pb-3 relative z-10 gap-3">
        <div className="flex flex-col">
          <motion.h1
            initial={{ y: prefersReduced ? 0 : 8, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 1.1, duration: 0.4 }}
            className="font-display text-2xl md:text-3xl text-[#3E3832] tracking-widest flex items-center gap-1.5"
          >
            LEDGER
            <span className="text-[#C08A3E] text-[10px] font-mono tracking-widest px-1.5 py-0.5 border border-[#C08A3E] rounded">MKII</span>
          </motion.h1>
          <motion.p
            initial={{ y: prefersReduced ? 0 : 8, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 1.18, duration: 0.4 }}
            className="font-sans text-[10px] text-stone-600 mt-0.5 uppercase tracking-widest"
          >
            Type the entry. Mind the ribbon.
          </motion.p>
        </div>

        {/* Tab Switcher & Acoustics Controls */}
        <motion.div
          initial={{ y: prefersReduced ? 0 : 8, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 1.26, duration: 0.4 }}
          className="flex items-center justify-between sm:justify-end gap-3 flex-wrap"
        >
          {/* Tab Switcher */}
          <nav className="flex items-center gap-1 sm:border-r border-stone-300 sm:pr-3">
            <button
              onClick={() => { setActiveTab('typewriter'); cancelGhost(); }}
              className={`text-[9px] font-mono font-bold uppercase tracking-widest px-2 py-1 rounded transition-all cursor-pointer border ${
                activeTab === 'typewriter'
                  ? "bg-[#C08A3E]/15 text-[#3E3832] border-[#C08A3E]/40 font-black"
                  : "text-stone-600 hover:text-[#3E3832] border-transparent"
              }`}
            >
              Typewriter
            </button>
            <button
              onClick={() => { setActiveTab('archive'); cancelGhost(); }}
              className={`text-[9px] font-mono font-bold uppercase tracking-widest px-2 py-1 rounded transition-all cursor-pointer flex items-center gap-1.5 border relative ${
                activeTab === 'archive'
                  ? "bg-[#C08A3E]/15 text-[#3E3832] border-[#C08A3E]/40 font-black"
                  : "text-stone-600 hover:text-[#3E3832] border-transparent"
              }`}
            >
              Archives
              {history.length > 0 && (
                <span className="px-1 bg-[#B33A3A] text-white text-[7.5px] rounded-sm font-sans font-bold leading-none py-0.5">
                  {history.length}
                </span>
              )}
            </button>
          </nav>

          {/* Audio acoustic control toggle */}
          <button
            onClick={(e) => { e.stopPropagation(); handleToggleMute(); }}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-[#C08A3E]/50 hover:border-[#C08A3E] hover:bg-[#C08A3E]/10 text-stone-700 hover:text-[#3E3832] transition-all text-[10px] font-mono tracking-wider focus:outline-none focus:ring-1 focus:ring-[#C08A3E]"
            title={isMuted ? "Unmute typewriter clicks" : "Mute typewriter clicks"}
          >
            {isMuted ? (
              <>
                <VolumeX size={12} className="text-rose-600" />
                <span>SILENT</span>
              </>
            ) : (
              <>
                <Volume2 size={12} className="text-emerald-600 animate-pulse" />
                <span className="text-[#C08A3E]">ACOUSTIC</span>
              </>
            )}
          </button>

          {/* Ledger page durations selection tabs */}
          <div className="flex gap-1 bg-stone-200/80 p-1 rounded-lg border border-stone-300">
            {([15, 30, 60] as TestDuration[]).map((t) => {
              const isActive = duration === t;
              return (
                <motion.button
                  key={`dur-${t}`}
                  disabled={status !== 'idle'}
                  whileHover={status === 'idle' ? { y: 1 } : {}}
                  transition={{ duration: 0.08 }}
                  onClick={(e) => { e.stopPropagation(); handleDurationChange(t); }}
                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold tracking-wider uppercase transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer ${
                    isActive 
                      ? "bg-[#C08A3E] text-[#2B2520] font-extrabold" 
                      : "text-stone-600 hover:text-stone-900"
                  }`}
                >
                  {t}s
                </motion.button>
              );
            })}
          </div>
        </motion.div>
      </header>

      {/* CENTRALIZED INTERACTIVE FRAME */}
      {activeTab === 'archive' ? (
        <main className="w-full max-w-2xl flex flex-col items-center relative gap-6 z-10 animate-fade-in">
          {/* Stunning Archival Ledger Sheet */}
          <motion.section
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="w-full bg-[#FAF7F2] border-2 border-[#C08A3E]/40 rounded-xl p-6 shadow-lg relative overflow-hidden select-none"
          >
            <div className="absolute left-0 top-0 bottom-0 w-2.5 bg-[#C08A3E] border-r border-amber-950/20" />

            <div className="pl-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-stone-300 pb-4 mb-4 gap-4">
                <div>
                  <h2 className="font-display text-lg text-[#3E3832] tracking-widest uppercase flex items-center gap-2">
                    <History size={16} className="text-[#C08A3E]" />
                    ARCHIVED JOURNALS
                  </h2>
                  <p className="font-mono text-[9px] text-[#C08A3E] uppercase tracking-wider font-bold mt-1">
                    Historical Logged Entries & Typing Metrics
                  </p>
                </div>
                
                <button
                  onClick={() => setActiveTab('typewriter')}
                  className="flex items-center gap-1.5 px-4 py-1.5 bg-[#C08A3E]/10 hover:bg-[#C08A3E]/20 text-[#3E3832] border border-[#C08A3E]/40 rounded font-mono text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer"
                >
                  Return to Typewriter
                </button>
              </div>

              {history.length > 0 ? (
                <>
                  {/* WPM GRAPH */}
                  {renderHistoryGraph()}

                  {/* DATA TABLE */}
                  <div className="w-full overflow-x-auto mt-6">
                    <table className="w-full text-left border-collapse select-none">
                      <thead>
                        <tr className="border-b border-stone-200 font-mono text-[9px] text-stone-500 tracking-widest uppercase">
                          <th className="pb-2.5 font-bold">Record</th>
                          <th className="pb-2.5 font-bold">Timestamp</th>
                          <th className="pb-2.5 font-bold">Time</th>
                          <th className="pb-2.5 font-bold text-right">Net WPM</th>
                          <th className="pb-2.5 font-bold text-right">Accuracy</th>
                          <th className="pb-2.5 font-bold text-right">Smudges</th>
                        </tr>
                      </thead>
                      <tbody className="font-mono text-[11px] text-[#3E3832] divide-y divide-stone-200/50">
                        {history.map((entry) => (
                          <tr key={entry.id} className="hover:bg-[#C08A3E]/5 border-b border-stone-200/20 transition-all">
                            <td className="py-2.5 text-[#C08A3E] font-bold">#{entry.id}</td>
                            <td className="py-2.5 text-stone-600">{entry.date}</td>
                            <td className="py-2.5 text-stone-500">{entry.duration}s</td>
                            <td className="py-2.5 text-right text-emerald-700 font-extrabold text-xs">{entry.wpm}</td>
                            <td className="py-2.5 text-right text-stone-700">{entry.accuracy}%</td>
                            <td className={`py-2.5 text-right ${entry.errors > 0 ? "text-[#B33A3A] font-bold" : "text-stone-400"}`}>
                              {entry.errors}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-6 flex justify-end">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm("Are you sure you want to scrub all historic journal logs?")) {
                          localStorage.removeItem('ledger_scores_history');
                          setHistory([]);
                        }
                      }}
                      className="text-[9px] font-mono text-stone-400 hover:text-[#B33A3A] border-b border-transparent hover:border-[#B33A3A] pb-0.5 cursor-pointer transition-all focus:outline-none uppercase tracking-widest font-bold"
                    >
                      Purge Archived Journals
                    </button>
                  </div>
                </>
              ) : (
                <div className="py-12 text-center flex flex-col items-center justify-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-stone-100 flex items-center justify-center border border-dashed border-stone-300 text-stone-400">
                    <History size={20} />
                  </div>
                  <p className="font-mono text-xs text-stone-500 uppercase tracking-widest font-bold">
                    No entries logged in this ledger yet
                  </p>
                  <p className="font-sans text-[10px] text-stone-400 max-w-sm leading-relaxed">
                    Once you complete a typewriter timed test session, your words, typing speeds, and metrics will be archived here.
                  </p>
                  <button
                    onClick={() => setActiveTab('typewriter')}
                    className="mt-2 px-4 py-2 bg-[#C08A3E] text-white font-mono text-[10px] uppercase font-bold tracking-wider rounded shadow-md hover:bg-[#b07d34] cursor-pointer"
                  >
                    Type your first entry
                  </button>
                </div>
              )}
            </div>
          </motion.section>
        </main>
      ) : (
        <main className="w-full max-w-2xl flex flex-col items-center relative gap-0 [perspective:1400px]">
        
        {/* 3D PERSPECTIVE WRAPPER */}
        <div 
          className="w-full flex flex-col items-center relative [transform-style:preserve-3d]"
          style={{
            transform: "rotateX(14deg) translateY(-8px)",
            transformStyle: "preserve-3d"
          }}
        >
          {/* VERTICAL PAPER FEED SHEET (COUNTER-ROTATED TO STAND PERFECTLY UPRIGHT!) */}
          <motion.div
            className={`
              w-[84%] paper-grain border border-[#E2E8F0] rounded-t-2xl relative p-5 md:p-6 shadow-[0_-8px_24px_rgba(0,0,0,0.15)] select-none overflow-hidden -mb-3
              ${jitter ? "animate-jitter" : ""}
              ${thud ? "animate-thud" : ""}
            `}
            id="ledger-top-card"
            style={{
              background: "linear-gradient(to bottom, #FFFFFF 0%, #FAFAFA 80%, #F1F1F1 100%)",
              minHeight: "200px",
              maxHeight: "230px",
              transformOrigin: "bottom center",
              transformStyle: "preserve-3d"
            }}
            initial={{
              rotateX: -14,
              translateZ: 15,
              opacity: prefersReduced ? 1 : 0,
              y: prefersReduced ? 12 : -30
            }}
            animate={{
              rotateX: -14,
              translateZ: 15,
              opacity: 1,
              y: 12 + (keystrokeJitter ? 1.5 : 0), // physical strike thud
              x: carriageShiftX // carriage horizontal translation
            }}
            transition={{
              x: { type: "tween", ease: "easeOut", duration: 0.06 },
              y: prefersReduced 
                ? { duration: 0 } 
                : isGhostActive && ghostCharIdx === 0 
                  ? { type: "spring", stiffness: 120, damping: 14, delay: 0.4 } 
                  : { type: "spring", stiffness: 1000, damping: 12 },
              opacity: prefersReduced ? { duration: 0 } : { duration: 0.4, delay: 0.4 }
            }}
          >
            {/* LEDGER Stamp Wordmark (0.8s stamp on page-load) */}
            {status !== 'completed' && (
              <motion.div
                initial={{ scale: 1.2, rotate: -2, opacity: 0 }}
                animate={{ scale: 1, rotate: 0, opacity: 1 }}
                transition={{
                  delay: 0.8,
                  duration: 0.3,
                  ease: [0.175, 0.885, 0.32, 1.15]
                }}
                className="absolute top-2.5 left-1/2 -translate-x-1/2 text-center pointer-events-none z-10 select-none"
              >
                <span className="font-display text-[16px] md:text-[18px] tracking-[0.3em] uppercase text-stone-800/80 border-2 border-double border-stone-800/60 px-3 py-0.5 rounded-sm bg-white/5 shadow-xs whitespace-nowrap">
                  LEDGER
                </span>
              </motion.div>
            )}

            {/* Paper shadow gradient on edges */}
            <div className="absolute inset-y-0 left-0 w-3 bg-gradient-to-r from-black/5 to-transparent pointer-events-none" />
            <div className="absolute inset-y-0 right-0 w-3 bg-gradient-to-l from-black/5 to-transparent pointer-events-none" />

            {/* Elegant Hand-written Pencil Page Number Decal */}
            {status !== 'completed' && pages.length > 0 && (
              <div className="absolute right-6 top-4 font-display text-[10px] text-amber-900/50 uppercase tracking-widest select-none pointer-events-none rotate-3 border border-amber-900/25 px-1.5 py-0.5 rounded-sm z-30">
                Page {currentPageIndex + 1} of {pages.length}
              </div>
            )}

            {/* Platen Curl Paper Overlay */}
            <div 
              className="absolute bottom-0 left-0 right-0 h-10 pointer-events-none z-30 transition-all duration-300"
              style={{
                background: `linear-gradient(to bottom, rgba(242, 236, 225, 0) 0%, rgba(242, 236, 225, 0.4) 30%, rgba(46, 59, 78, ${isLineFeeding ? 0.22 : 0.18}) 100%)`,
                transform: "scaleY(1.05)",
                borderBottom: "1px solid rgba(255,255,255,0.4)"
              }}
            />

            {/* 3D Platen Curl back effect */}
            <div 
              className="absolute bottom-0 left-0 right-0 h-12 origin-bottom pointer-events-none z-20 overflow-hidden"
              style={{
                transform: "rotateX(-25deg)",
                background: `linear-gradient(to bottom, rgba(242, 236, 225, 0) 0%, rgba(46, 59, 78, ${isLineFeeding ? 0.15 : 0.12}) 100%)`,
                boxShadow: "inset 0 -8px 12px rgba(27, 36, 48, 0.15)"
              }}
            />

            {/* Typing or Results Frame */}
            <div className="w-full h-[170px] overflow-hidden relative" ref={ledgerScrollRef}>
              
              {/* Native event listener core */}
              <textarea
                ref={inputRef}
                value={typedText}
                onChange={handleTextChange}
                disabled={status === 'completed'}
                className="absolute inset-0 w-full h-full opacity-0 cursor-text resize-none focus:outline-none focus:ring-0 z-50"
                autoFocus
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck="false"
                id="ledger-hidden-type-area"
              />

              <AnimatePresence mode="wait">
                {status === 'completed' ? (
                  // RESULTS PANEL (Rubber Stamped Style)
                  <motion.div
                    key="results-panel"
                    initial={{ opacity: 0, scale: 1.15 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-col items-center justify-center text-center py-1 animate-stamp relative z-10"
                  >
                    <div className="border-3 border-dashed border-[#B33A3A]/80 text-[#B33A3A] font-display uppercase tracking-widest px-4 py-1 inline-block rounded text-sm font-bold rotate-[-2deg] mb-3 shadow-xs">
                      ENTRY LOGGED
                    </div>

                    <div className="grid grid-cols-4 gap-2 w-full max-w-md py-1.5 px-3 bg-[#B33A3A]/5 rounded border border-[#B33A3A]/15">
                      <div className="flex flex-col">
                        <span className="font-mono text-xl font-bold text-stone-900">{history[0]?.wpm ?? 0}</span>
                        <span className="font-sans text-[8px] font-bold uppercase text-stone-600">NET WPM</span>
                      </div>
                      <div className="flex flex-col border-l border-stone-200">
                        <span className="font-mono text-xl font-bold text-stone-900">{history[0]?.accuracy ?? 0}%</span>
                        <span className="font-sans text-[8px] font-bold uppercase text-stone-600">ACCURACY</span>
                      </div>
                      <div className="flex flex-col border-l border-stone-200">
                        <span className="font-mono text-xl font-bold text-stone-900">{history[0]?.rawWpm ?? 0}</span>
                        <span className="font-sans text-[8px] font-bold uppercase text-stone-600">RAW WPM</span>
                      </div>
                      <div className="flex flex-col border-l border-stone-200">
                        <span className={`font-mono text-xl font-bold ${history[0]?.errors > 0 ? "text-rose-600" : "text-stone-800"}`}>
                          {history[0]?.errors ?? 0}
                        </span>
                        <span className="font-sans text-[8px] font-bold uppercase text-stone-600">SMUDGES</span>
                      </div>
                    </div>

                    {renderHistoryGraph()}

                    <button
                      onClick={(e) => { e.stopPropagation(); resetTest(); }}
                      className="mt-3 flex items-center gap-1.5 text-stone-800 hover:text-[#B33A3A] font-sans font-bold text-xs border-b border-stone-800 hover:border-[#B33A3A] pb-0.5 focus:outline-none transition-all cursor-pointer"
                    >
                      <RotateCcw size={12} />
                      Feed New Blank Page (Restart)
                    </button>
                  </motion.div>
                ) : (
                  // TYPING INTERFACE (Scrolling Paper Content Sheet!)
                  <motion.div
                    key="typing-panel"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="relative z-10 w-full h-full"
                  >
                    <motion.div
                      className="w-full absolute top-0 left-0"
                      style={{
                        backgroundImage: "linear-gradient(rgba(27, 36, 48, 0.08) 1px, transparent 1px)",
                        backgroundSize: "100% 28px",
                        minHeight: "400px",
                        transformOrigin: "center center"
                      }}
                      animate={{
                        y: sheetScrollY,
                        rotate: isLineFeeding && !prefersReduced ? -0.4 : 0,
                        filter: isLineFeeding && !prefersReduced ? "blur(1.2px)" : "none"
                      }}
                      transition={{
                        y: prefersReduced 
                          ? { type: "tween", duration: 0 } 
                          : { type: "spring", stiffness: 350, damping: 22, mass: 0.9 },
                        rotate: { type: "spring", stiffness: 200, damping: 15 },
                        filter: { duration: 0.15 }
                      }}
                    >
                      {/* Red double rules margins */}
                      <div 
                        className="absolute top-0 bottom-0 w-[2px] border-l-2 border-rose-400/50" 
                        style={{ left: `${typeof window !== 'undefined' && window.innerWidth < 768 ? 32 : 48}px` }} 
                      />

                      {/* Text wrapper containing rows with left alignment padding */}
                      <div 
                        className="relative pt-0.5"
                        style={{ 
                          paddingLeft: `${(typeof window !== 'undefined' && window.innerWidth < 768 ? 32 : 48) + 10}px` 
                        }}
                      >
                        {renderPassage()}
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

            </div>
          </motion.div>

        {/* PAPER THROAT SLIT ENTRY ZONE */}
        <div className="w-[82%] h-3 bg-[#131922] rounded-full mx-auto -mb-1 shadow-[inset_0_2px_5px_rgba(0,0,0,0.8)] border-b border-white/5 relative z-10" />

        {/* CARRIAGE / PLATEN CYLINDER BAR (SITS AT TOP OF TYPEWRITER, ROTATES AND SHIFTS SIDEWAYS!) */}
        <div className="w-[90%] h-8 relative z-20 border-b border-stone-900/40 flex items-center justify-center">
          
          {/* The sliding mechanical cylinder bar */}
          <div 
            className="h-5 bg-gradient-to-b from-[#2D3748] via-[#1A202C] to-[#0A0E17] w-[94%] rounded-md border border-stone-700 flex items-center justify-between px-6 relative shadow-md"
            style={{
              transform: `translateX(${carriageShiftX}px)`,
              transition: strikeActive ? 'none' : 'transform 0.06s ease-out'
            }}
          >
            {/* Subtle highlight line right at the visible top edge of the roller itself, suggesting light catching the curve */}
            <div className="absolute top-0 left-0 right-0 h-[1px] bg-white/25 blur-[0.2px] pointer-events-none" />
            {/* Highly detailed Curved chrome mechanical return lever on Left */}
            <div 
              className="absolute -left-9 -top-4 w-12 h-12 origin-bottom-right transition-transform"
              style={{
                transform: strikeActive ? 'rotate(-16deg) scale(0.97)' : 'rotate(0deg)',
                transition: 'transform 0.1s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
              }}
            >
              {/* Silver curved metal arm */}
              <div className="w-2.5 h-8 bg-gradient-to-b from-stone-100 via-stone-300 to-stone-400 rounded-full border border-stone-500 shadow-lg transform -rotate-[22deg]" />
              <div className="w-1.5 h-5 bg-gradient-to-b from-stone-200 to-stone-400 border border-stone-500 rounded-full absolute top-5 -left-1 shadow-md transform rotate-[45deg]" />
              {/* Chrome paddle head */}
              <div className="w-5 h-5 bg-gradient-to-br from-stone-100 via-stone-300 to-stone-500 border border-stone-500 rounded-full absolute -top-1 -left-2.5 shadow-md flex items-center justify-center">
                <div className="w-2.5 h-2.5 bg-gradient-to-r from-stone-400 to-stone-200 rounded-full" />
              </div>
            </div>

            {/* Dark blue/grey knobs at the carriage ends */}
            <div className="absolute -left-4 w-4 h-6 bg-gradient-to-r from-[#2E3D52] to-[#1E2530] border border-stone-900 rounded-sm shadow-[0_3px_5px_rgba(0,0,0,0.5)] flex flex-col justify-between py-1">
              <div className="h-[1px] bg-stone-950" />
              <div className="h-[1px] bg-stone-950" />
              <div className="h-[1px] bg-stone-950" />
              <div className="h-[1px] bg-stone-950" />
            </div>
            
            <div className="absolute -right-4 w-4 h-6 bg-gradient-to-r from-[#1E2530] to-[#2E3D52] border border-stone-900 rounded-sm shadow-[0_3px_5px_rgba(0,0,0,0.5)] flex flex-col justify-between py-1">
              <div className="h-[1px] bg-stone-950" />
              <div className="h-[1px] bg-stone-950" />
              <div className="h-[1px] bg-stone-950" />
              <div className="h-[1px] bg-stone-950" />
            </div>

            {/* Platen roller alignment scale increments */}
            <div className="w-full flex justify-around opacity-30">
              <div className="w-[1px] h-3 bg-stone-400" />
              <div className="w-[1px] h-2 bg-stone-500" />
              <div className="w-[1px] h-2 bg-stone-500" />
              <div className="w-[1px] h-3 bg-stone-400" />
              <div className="w-[1px] h-2 bg-stone-500" />
              <div className="w-[1px] h-2 bg-stone-500" />
              <div className="w-[1px] h-3 bg-stone-400" />
            </div>

            {/* Subtle center marker scale label */}
            <div className="absolute bottom-[-1px] left-1/2 -translate-x-1/2 w-4 h-1.5 bg-[#B33A3A] rounded-t-xs border-x border-[#7A2323]" />
          </div>
        </div>

        {/* HIGH-FIDELITY RETRO METALLIC 3D TYPEWRITER BODY CHASSIS */}
        <motion.div 
          initial={{ y: prefersReduced ? 0 : 40, opacity: prefersReduced ? 1 : 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.5, ease: "easeOut" }}
          className="w-full bg-gradient-to-b from-[#2E3B4E] via-[#1B2430] to-[#10161D] rounded-b-[36px] rounded-t-[18px] border-t-4 border-[#2E3B4E]/60 px-4 pb-5 pt-3 relative select-none flex flex-col gap-4 overflow-hidden z-20"
          style={{
            boxShadow: "0 14px 0 #0F131B, 0 25px 40px rgba(0, 0, 0, 0.55), inset 0 2.5px 5px rgba(255, 255, 255, 0.25)",
            transformStyle: "preserve-3d"
          }}
        >
          {/* Subtle grazing sheen highlights overlay for matte enamel body */}
          <div className="absolute inset-0 bg-gradient-to-b from-white/10 via-transparent to-black/25 pointer-events-none" />
          <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent pointer-events-none skew-x-[-30deg] scale-150 origin-top opacity-40" />

          {/* TWO FRONT METALLIC CHASSIS DECALS/BUTTONS IN CORNERS (AS IN IMAGES) */}
          <div className="absolute top-3 left-6 w-3 h-3 rounded-full bg-gradient-to-r from-[#C08A3E] via-[#E4B876] to-[#8C6425] border border-[#8C6425]/40 shadow-sm" />
          <div className="absolute top-3 right-6 w-3 h-3 rounded-full bg-gradient-to-r from-[#C08A3E] via-[#E4B876] to-[#8C6425] border border-[#8C6425]/40 shadow-sm" />

          {/* LARGE GLISTENING METALLIC SPOOLS & THE CONVERGING TYPEBAR MECHANISM */}
          <div className="w-full flex items-center justify-between px-2 sm:px-4 py-1 relative z-10 min-h-[85px] gap-1 sm:gap-2">
            
            {/* Left spool - Brushed Brass rim with inner hub */}
            <div className="flex flex-col items-center relative">
              <div 
                className="w-13 h-13 sm:w-16 sm:h-16 rounded-full flex items-center justify-center transition-transform relative"
                style={{ 
                  transform: `rotate(${spoolRotationLeft}deg)`,
                  background: "linear-gradient(135deg, #8C6425 0%, #C08A3E 30%, #E4B876 45%, #C08A3E 60%, #E4B876 75%, #8C6425 100%)",
                  padding: "3px",
                  boxShadow: "inset 0 1.5px 0.5px rgba(228, 184, 118, 0.75), 0 6px 10px rgba(0, 0, 0, 0.4), inset 0 -1.5px 2px rgba(0,0,0,0.4)"
                }}
              >
                {/* Inner hub */}
                <div className="w-full h-full rounded-full border border-stone-900 bg-gradient-to-br from-[#1B2430] via-stone-900 to-[#10161D] flex items-center justify-center relative shadow-inner">
                  {/* Ribbon spool visible */}
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full border border-red-950 bg-[#881C2E] flex items-center justify-center relative">
                    {/* Spokes */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-1 h-7 sm:w-1 sm:h-9 bg-stone-300/60 rounded-full" />
                      <div className="w-1 h-7 sm:w-1 sm:h-9 bg-stone-300/60 rounded-full rotate-45" />
                      <div className="w-1 h-7 sm:w-1 sm:h-9 bg-stone-300/60 rounded-full rotate-90" />
                      <div className="w-1 h-7 sm:w-1 sm:h-9 bg-stone-300/60 rounded-full rotate-135" />
                    </div>
                    {/* Brushed Brass rivet */}
                    <div className="w-3.5 h-3.5 bg-gradient-to-r from-[#C08A3E] via-[#E4B876] to-[#8C6425] rounded-full border border-[#8C6425]/40 shadow-md z-10 flex items-center justify-center" />
                  </div>
                </div>
              </div>
              <span className="text-[6px] sm:text-[7px] font-mono text-[#F2ECE1]/65 mt-1 uppercase tracking-widest font-extrabold">Feed L</span>
            </div>

            {/* Left Dial Gauge - WPM Speedometer (Brushed Brass & Navy/Ivory Face) */}
            <div className="hidden xs:flex flex-col items-center relative z-20">
              <div 
                className="w-11 h-11 sm:w-13 sm:h-13 rounded-full flex items-center justify-center relative select-none"
                style={{
                  background: "linear-gradient(135deg, #8C6425 0%, #C08A3E 30%, #E4B876 45%, #C08A3E 60%, #E4B876 75%, #8C6425 100%)",
                  padding: "2px",
                  boxShadow: "inset 0 1px 0 rgba(228, 184, 118, 0.75), 0 4px 6px rgba(0, 0, 0, 0.35), inset 0 -1.5px 2px rgba(0,0,0,0.4)"
                }}
              >
                {/* Dial Face */}
                <div 
                  className="w-full h-full rounded-full bg-[#10161D] flex flex-col items-center justify-between p-1 relative overflow-hidden shadow-[inset_0_1.5px_3px_rgba(0,0,0,0.85)]"
                >
                  {/* Tick Marks (faint ivory F2ECE1 at 40% opacity) */}
                  <div className="absolute inset-0 pointer-events-none opacity-40">
                    <svg className="w-full h-full" viewBox="0 0 100 100">
                      <path d="M 20,80 A 35,35 0 1,1 80,80" fill="none" stroke="#F2ECE1" strokeWidth="2.5" strokeDasharray="3,5" />
                    </svg>
                  </div>

                  {/* Gauge Label */}
                  <span className="text-[5px] sm:text-[6px] font-mono font-bold text-[#F2ECE1]/40 uppercase tracking-widest mt-1 z-10">WPM</span>

                  {/* Value */}
                  <span className="text-[6px] sm:text-[8px] font-mono font-extrabold text-[#F2ECE1]/75 mb-0.5 z-10">
                    {status === 'running' 
                      ? Math.round((typedText.length / 5) / (Math.max(1, (duration - timeLeft)) / 60)) 
                      : history[0]?.wpm ?? 0}
                  </span>

                  {/* Needle (aged brass C08A3E, rotating dynamically) */}
                  <div 
                    className="absolute inset-0 flex items-center justify-center pointer-events-none z-10"
                    style={{
                      transform: `rotate(${-120 + Math.min(1, (status === 'running' ? Math.round((typedText.length / 5) / (Math.max(1, (duration - timeLeft)) / 60)) : history[0]?.wpm ?? 0) / 100) * 240}deg)`,
                      transition: "transform 0.25s cubic-bezier(0.1, 0.8, 0.2, 1)"
                    }}
                  >
                    <div className="w-[1.2px] h-[40%] bg-[#C08A3E] -translate-y-1/2 rounded-full shadow-xs" />
                  </div>

                  {/* Center hub (brushed brass rivet) */}
                  <div className="absolute w-2 h-2 rounded-full bg-gradient-to-r from-[#C08A3E] via-[#E4B876] to-[#8C6425] border border-[#8C6425]/40 shadow-md z-20" />

                  {/* Glass Reflection */}
                  <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-white/5 to-transparent pointer-events-none rounded-full z-30" />
                </div>
              </div>
              <span className="text-[5px] sm:text-[6px] font-mono text-[#F2ECE1]/50 mt-0.5 uppercase tracking-widest font-bold">Tempo</span>
            </div>

            {/* CENTRAL TYPEBAR BASKET (CONVERGING FAN-SHAPED METAL BARS) */}
            <div className="flex-1 max-w-[130px] sm:max-w-[170px] h-[75px] sm:h-[85px] bg-[#10161D] border-2 border-stone-950 rounded-xl relative overflow-hidden flex flex-col items-center justify-end p-1 shadow-[inset_0_4px_10px_rgba(0,0,0,0.85)]">
              
              {/* Converging steel bars fan-shaped background basket texture */}
              <div className="absolute inset-x-2 top-1 bottom-4 opacity-40 flex justify-around items-end">
                <div className="w-[1.5px] h-9 bg-gradient-to-b from-stone-400 to-stone-600 origin-bottom rotate-[-55deg]" />
                <div className="w-[1.5px] h-10 bg-gradient-to-b from-stone-400 to-stone-600 origin-bottom rotate-[-40deg]" />
                <div className="w-[1.5px] h-11 bg-gradient-to-b from-stone-400 to-stone-600 origin-bottom rotate-[-25deg]" />
                <div className="w-[1.5px] h-12 bg-gradient-to-b from-stone-400 to-stone-600 origin-bottom rotate-[-10deg]" />
                <div className="w-[1.5px] h-12 bg-gradient-to-b from-stone-400 to-stone-600 origin-bottom rotate-[10deg]" />
                <div className="w-[1.5px] h-11 bg-gradient-to-b from-stone-400 to-stone-600 origin-bottom rotate-[25deg]" />
                <div className="w-[1.5px] h-10 bg-gradient-to-b from-stone-400 to-stone-600 origin-bottom rotate-[40deg]" />
                <div className="w-[1.5px] h-9 bg-gradient-to-b from-stone-400 to-stone-600 origin-bottom rotate-[55deg]" />
              </div>

              {/* TWO COLOR BI-RIBBON (RED/BLACK) STRETCHING ACROSS CENTER */}
              <div className="absolute inset-x-0 bottom-5 h-3 flex flex-col justify-between pointer-events-none opacity-95 z-10">
                <div className="h-1.5 bg-stone-950 w-full border-b border-stone-900" />
                <div className="h-1.5 bg-[#B33A3A] w-full" />
              </div>

              {/* Hammer Strike flash glow! */}
              {strikeActive && (
                <div className="absolute bottom-6 w-12 h-6 bg-yellow-400/20 rounded-full blur-xs animate-ping pointer-events-none z-10" />
              )}

              {/* THE ACTIVE STEEL TYPEBAR HAMMER (SWINGS UP ON STRIKE!) */}
              <div className="absolute bottom-1.5 w-4 h-14 flex justify-center pointer-events-none z-20">
                <div 
                  className={`
                    w-1.5 bg-gradient-to-t from-stone-400 via-stone-300 to-stone-100 border-x border-stone-600 origin-bottom rounded-t-sm shadow-md
                    ${strikeActive ? "animate-typebar" : "translate-y-[32px] scale-y-[0.1] opacity-25"}
                  `}
                  style={{
                    height: '46px',
                    transformOrigin: 'bottom center',
                    transition: strikeActive ? 'none' : 'transform 0.15s cubic-bezier(0.25, 0.46, 0.45, 0.94), opacity 0.1s'
                  }}
                >
                  {/* Steel stamp typehead block */}
                  <div className="w-4 h-4 bg-gradient-to-br from-stone-100 via-stone-300 to-stone-500 border border-stone-600 rounded-xs absolute -top-1.5 -left-[5px] text-[8px] text-stone-950 font-bold flex items-center justify-center font-mono shadow-md">
                    {lastTypedChar ? lastTypedChar.toUpperCase() : "X"}
                  </div>
                </div>
              </div>

              {/* Heavy center guide bracket slot */}
              <div className="w-9 h-5 border-x-2 border-t-2 border-stone-700 bg-stone-800 z-30 rounded-t-xs flex items-center justify-center shadow-md">
                <div className="w-2.5 h-3.5 bg-stone-950 rounded-b-xs" />
              </div>
            </div>

            {/* Right Dial Gauge - Seconds Countdown (Brushed Brass & Navy/Ivory Face) */}
            <div className="hidden xs:flex flex-col items-center relative z-20">
              <div 
                className="w-11 h-11 sm:w-13 sm:h-13 rounded-full flex items-center justify-center relative select-none"
                style={{
                  background: "linear-gradient(135deg, #8C6425 0%, #C08A3E 30%, #E4B876 45%, #C08A3E 60%, #E4B876 75%, #8C6425 100%)",
                  padding: "2px",
                  boxShadow: "inset 0 1px 0 rgba(228, 184, 118, 0.75), 0 4px 6px rgba(0, 0, 0, 0.35), inset 0 -1.5px 2px rgba(0,0,0,0.4)"
                }}
              >
                {/* Dial Face */}
                <div 
                  className="w-full h-full rounded-full bg-[#10161D] flex flex-col items-center justify-between p-1 relative overflow-hidden shadow-[inset_0_1.5px_3px_rgba(0,0,0,0.85)]"
                >
                  {/* Tick Marks (faint ivory F2ECE1 at 40% opacity) */}
                  <div className="absolute inset-0 pointer-events-none opacity-40">
                    <svg className="w-full h-full" viewBox="0 0 100 100">
                      <path d="M 20,80 A 35,35 0 1,1 80,80" fill="none" stroke="#F2ECE1" strokeWidth="2.5" strokeDasharray="3,5" />
                    </svg>
                  </div>

                  {/* Gauge Label */}
                  <span className="text-[5px] sm:text-[6px] font-mono font-bold text-[#F2ECE1]/40 uppercase tracking-widest mt-1 z-10">SEC</span>

                  {/* Value */}
                  <span className="text-[6px] sm:text-[8px] font-mono font-extrabold text-[#F2ECE1]/75 mb-0.5 z-10">
                    {timeLeft}s
                  </span>

                  {/* Needle (aged brass C08A3E, rotating dynamically) */}
                  <div 
                    className="absolute inset-0 flex items-center justify-center pointer-events-none z-10"
                    style={{
                      transform: `rotate(${-120 + (timeLeft / duration) * 240}deg)`,
                      transition: "transform 0.15s linear"
                    }}
                  >
                    <div className="w-[1.2px] h-[40%] bg-[#C08A3E] -translate-y-1/2 rounded-full shadow-xs" />
                  </div>

                  {/* Center hub (brushed brass rivet) */}
                  <div className="absolute w-2 h-2 rounded-full bg-gradient-to-r from-[#C08A3E] via-[#E4B876] to-[#8C6425] border border-[#8C6425]/40 shadow-md z-20" />

                  {/* Glass Reflection */}
                  <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-white/5 to-transparent pointer-events-none rounded-full z-30" />
                </div>
              </div>
              <span className="text-[5px] sm:text-[6px] font-mono text-[#F2ECE1]/50 mt-0.5 uppercase tracking-widest font-bold">Margin</span>
            </div>

            {/* Right spool - Brushed Brass rim with inner hub */}
            <div className="flex flex-col items-center relative">
              <div 
                className="w-13 h-13 sm:w-16 sm:h-16 rounded-full flex items-center justify-center transition-transform relative"
                style={{ 
                  transform: `rotate(${spoolRotationRight}deg)`,
                  background: "linear-gradient(135deg, #8C6425 0%, #C08A3E 30%, #E4B876 45%, #C08A3E 60%, #E4B876 75%, #8C6425 100%)",
                  padding: "3px",
                  boxShadow: "inset 0 1.5px 0.5px rgba(228, 184, 118, 0.75), 0 6px 10px rgba(0, 0, 0, 0.4), inset 0 -1.5px 2px rgba(0,0,0,0.4)"
                }}
              >
                {/* Inner hub */}
                <div className="w-full h-full rounded-full border border-stone-900 bg-gradient-to-br from-[#1B2430] via-stone-900 to-[#10161D] flex items-center justify-center relative shadow-inner">
                  {/* Ribbon spool visible */}
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full border border-red-950 bg-[#881C2E] flex items-center justify-center relative">
                    {/* Spokes */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-1 h-7 sm:w-1 sm:h-9 bg-stone-300/60 rounded-full" />
                      <div className="w-1 h-7 sm:w-1 sm:h-9 bg-stone-300/60 rounded-full rotate-45" />
                      <div className="w-1 h-7 sm:w-1 sm:h-9 bg-stone-300/60 rounded-full rotate-90" />
                      <div className="w-1 h-7 sm:w-1 sm:h-9 bg-stone-300/60 rounded-full rotate-135" />
                    </div>
                    {/* Brushed Brass rivet */}
                    <div className="w-3.5 h-3.5 bg-gradient-to-r from-[#C08A3E] via-[#E4B876] to-[#8C6425] rounded-full border border-[#8C6425]/40 shadow-md z-10 flex items-center justify-center" />
                  </div>
                </div>
              </div>
              <span className="text-[6px] sm:text-[7px] font-mono text-[#F2ECE1]/65 mt-1 uppercase tracking-widest font-extrabold">Feed R</span>
            </div>

          </div>

          {/* Floating cartoon indicators overlay */}
          <div className="absolute top-[50px] left-1/2 -translate-x-1/2 pointer-events-none z-30 w-full flex justify-center">
            <AnimatePresence>
              {floats.map(f => (
                <motion.div
                  key={f.id}
                  initial={{ opacity: 0, y: 20, scale: 0.5, rotate: f.rotation }}
                  animate={{ opacity: 1, y: -45, scale: 1.15 }}
                  exit={{ opacity: 0, y: -80, scale: 0.7 }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                  className={`absolute font-display px-2.5 py-1 rounded-md border-2 bg-[#2D1F17] shadow-xl text-[10px] tracking-wider select-none text-center ${f.colorClass}`}
                  style={{ 
                    left: `calc(50% + ${f.offsetX}px)`,
                    top: `calc(50% + ${f.offsetY}px)`
                  }}
                >
                  {f.text}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* PHYSICAL ROUND TYPEWRITER KEYBOARD PANEL (REAL GLASS-LOOK GOLDEN RIM BEZEL!) */}
          <div className="w-full bg-gradient-to-b from-[#1B2330] to-[#0F141E] rounded-2xl border-2 border-[#CBD5E1]/30 p-3 shadow-[inset_0_4px_12px_rgba(0,0,0,0.8)] relative z-10 flex flex-col gap-1.5 md:gap-2.5">
            
            {/* Render QWERTY keys layout */}
            {KEYBOARD_ROWS.map((row, rowIdx) => (
              <div 
                key={`row-${rowIdx}`} 
                className="flex justify-center gap-1 sm:gap-2"
                style={{
                  paddingLeft: rowIdx === 1 ? '16px' : rowIdx === 2 ? '4px' : '0px',
                  paddingRight: rowIdx === 1 ? '0px' : rowIdx === 2 ? '4px' : '0px',
                }}
              >
                {row.map((char, charIdx) => {
                  const norm = char.toLowerCase();
                  let isPressed = pressedKeys.has(norm);
                  if (norm === 'shift lock') {
                    isPressed = pressedKeys.has('capslock') || pressedKeys.has('shift lock');
                  } else if (norm === 'back') {
                    isPressed = pressedKeys.has('backspace') || pressedKeys.has('back');
                  }
                  
                  const isSpecial = char === 'Shift Lock' || char === 'Shift' || char === 'Tab' || char === 'Back';
                  
                  // Width and shape
                  let keyWidthClass = "w-7.5 h-7.5 sm:w-10 sm:h-10";
                  if (char === 'Shift Lock' || char === 'Shift') {
                    keyWidthClass = "w-11 h-7.5 sm:w-16 sm:h-10 px-0.5 rounded-3xl";
                  } else if (char === 'Tab' || char === 'Back') {
                    keyWidthClass = "w-9 h-7.5 sm:w-12 sm:h-10 px-0.5 rounded-3xl";
                  } else {
                    keyWidthClass = "w-7.5 h-7.5 sm:w-10 sm:h-10 rounded-full";
                  }

                  return (
                    <div key={`key-container-${char}-${charIdx}`} className="relative flex flex-col items-center">
                      {/* Brushed Brass metal stems beneath keycaps */}
                      <div 
                        className={`w-1 h-3.5 bg-gradient-to-r from-[#8C6425] via-[#E4B876] to-[#C08A3E] mx-auto -mb-[3px] transition-all duration-75 ${
                          isPressed ? 'scale-y-[0.3] translate-y-1 opacity-60' : 'opacity-100'
                        }`} 
                      />
                      
                      <button
                        onClick={(e) => { e.stopPropagation(); handleVirtualKeyClick(char); }}
                        className={`
                          ${keyWidthClass}
                          flex items-center justify-center font-serif font-extrabold select-none cursor-pointer focus:outline-none transition-all duration-75 relative z-10
                          ${isSpecial 
                            ? isPressed
                              ? "bg-gradient-to-b from-[#B33A3A] to-[#7A2323] text-[#F2ECE1] border-[#7A2323] translate-y-[3px] shadow-[inset_0_1.5px_3px_rgba(0,0,0,0.6)]"
                              : "bg-gradient-to-b from-[#D3625F] via-[#B33A3A] to-[#7A2323] text-[#F2ECE1] border-[2.5px] border-[#8C6425] shadow-[0_4px_0_#581414] hover:-translate-y-[1px] hover:shadow-[0_5px_0_#581414]"
                            : isPressed
                              ? "bg-[#C9C0AD] border-[#8C6425] text-[#1B2430] translate-y-[3px] shadow-[inset_0_1.5px_3px_rgba(0,0,0,0.4)]"
                              : "bg-gradient-to-b from-[#FFFDF8] via-[#F2ECE1] to-[#C9C0AD] border-[2.5px] border-[#C08A3E] text-[#1B2430] shadow-[0_4px_0_#8C6425] hover:-translate-y-[1px] hover:shadow-[0_5px_0_#8C6425]"
                          }
                        `}
                        style={{
                          borderRadius: isSpecial ? '12px' : '9999px',
                          ...(isSpecial ? {
                            backgroundImage: 'radial-gradient(rgba(0,0,0,0.18) 15%, transparent 16%)',
                            backgroundSize: '3px 3px'
                          } : {})
                        }}
                      >
                        {/* Brushed Brass rim highlight bezel */}
                        <span className={`absolute inset-0 rounded-full border-[1.5px] pointer-events-none opacity-40 ${isSpecial ? 'border-[#E4B876]/45' : 'border-[#E4B876]/65'}`} />
                        {/* Piano satin sheen reflection */}
                        <span className="absolute inset-[2px] rounded-full bg-gradient-to-b from-white/10 via-transparent to-transparent pointer-events-none" />
                        
                        <span className={`text-[9px] sm:text-[11px] tracking-tight font-serif uppercase ${isSpecial ? 'text-[#E4B876] font-bold' : 'text-[#1B2430] font-black'}`}>
                          {char === 'Shift Lock' ? 'Lock' : char}
                        </span>
                      </button>
                    </div>
                  );
                })}
              </div>
            ))}

            {/* Bottom Spacebar Row */}
            <div className="flex justify-center mt-1 relative z-10">
              <div className="relative flex flex-col items-center">
                {/* Double Brushed Brass Spacebar Stem */}
                <div 
                  className={`w-3 h-3 bg-gradient-to-r from-[#8C6425] via-[#E4B876] to-[#C08A3E] mx-auto -mb-[2px] transition-all duration-75 ${
                    pressedKeys.has('space') ? 'scale-y-[0.3] translate-y-1 opacity-60' : 'opacity-100'
                  }`} 
                />
                
                <button
                  onClick={(e) => { e.stopPropagation(); handleVirtualKeyClick(' '); }}
                  className={`
                    w-[210px] sm:w-[310px] h-7 sm:h-8.5 rounded-full flex items-center justify-center border-[3.5px] font-serif font-black select-none cursor-pointer focus:outline-none transition-all duration-75 relative z-10
                    ${pressedKeys.has('space')
                      ? "bg-[#C9C0AD] border-[#8C6425] translate-y-[2px] shadow-[inset_0_1px_3px_rgba(0,0,0,0.4)]"
                      : "bg-gradient-to-b from-[#FFFDF8] via-[#F2ECE1] to-[#C9C0AD] border-[#C08A3E] shadow-[0_4px_0_#8C6425] hover:-translate-y-[1px] hover:shadow-[0_5px_0_#8C6425]"
                    }
                  `}
                  title="Spacebar"
                >
                  <span className="absolute inset-[1px] rounded-full border border-[#FFFDF8]/30 pointer-events-none opacity-45" />
                  <span className="text-[8px] sm:text-[9px] tracking-widest font-mono text-[#1B2430]/75 font-bold">SPACEBAR</span>
                </button>
              </div>
            </div>

          </div>

        </motion.div>

        </div> {/* Close 3D PERSPECTIVE WRAPPER */}

        {/* LEDGER LIVE STATUS BAR PANEL */}
        <div className="w-full bg-[#EFECE6] border-2 border-[#C08A3E]/45 rounded-xl p-4 relative z-10 flex items-center justify-between px-5 text-sm font-sans text-stone-800 mt-4 shadow-md">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <Clock size={14} className="text-[#C08A3E]" />
              <span className="font-bold uppercase text-[10px] tracking-widest text-[#3E3832]/80">REMAINING:</span>
              <span className="font-mono text-[#2B2520] font-extrabold text-base">{timeLeft}s</span>
            </div>

            {status === 'running' && (
              <>
                <div className="h-4 w-[1px] bg-stone-300" />
                <div className="flex items-center gap-1.5">
                  <TrendingUp size={14} className="text-emerald-700" />
                  <span className="font-bold uppercase text-[10px] tracking-widest text-[#3E3832]/80">LIVE WPM:</span>
                  <span className="font-mono text-emerald-700 font-extrabold text-base animate-pulse">
                    {Math.round((typedText.length / 5) / (Math.max(1, (duration - timeLeft)) / 60))}
                  </span>
                </div>
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={(e) => { e.stopPropagation(); setShowManualOverlay(true); }}
              className="flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase text-[#C08A3E] hover:text-[#3E3832] transition-colors focus:outline-none border border-[#C08A3E]/30 hover:border-[#C08A3E] hover:bg-[#C08A3E]/10 px-2.5 py-1 rounded cursor-pointer"
            >
              <HelpCircle size={11} />
              Manual & Info
            </button>

            <button
              onClick={(e) => { e.stopPropagation(); resetTest(); }}
              className="flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase text-[#C08A3E] hover:text-[#3E3832] transition-colors focus:outline-none border border-[#C08A3E]/30 hover:border-[#C08A3E] hover:bg-[#C08A3E]/10 px-2.5 py-1 rounded cursor-pointer"
            >
              <ResetIcon size={11} />
              Reset Carriage (Tab)
            </button>
          </div>
        </div>

        {/* Content Below the Fold (Scroll-Triggered reveals with ledger-rule line sweeps) */}
        <ScrollTriggeredSection 
          title="Operating Principles"
          content={
            <span>
              The Ledger MkII typing mechanics system is engineered to emulate the physical operation of traditional line-cast typewriters. 
              Our key mechanism employs a fixed horizontal typing point, forcing the typewriter carriage to slide laterally with every 
              stroke. This keeps the active typeface hammer aligned to the center and guarantees pristine letter printing on the heavy parchment page.
            </span>
          }
        />

        <ScrollTriggeredSection 
          title="Carbon Ink Ribbon"
          content={
            <span>
              This instrument features a dual-spool emerald and graphite carbon ink ribbon. Correct keystrokes clack deeply saturated 
              pigment directly into the fiber. Striking an incorrect key disengages the primary guide, causing a bold crimson smudge 
              that mimics traditional corrector tape strikes. Keep your eyes on the margin, and mind the spools.
            </span>
          }
        />

      </main>
      )}

      {/* AESTHETIC FOOTER NOTES */}
      <footer className="w-full max-w-2xl text-center text-[9px] font-mono text-stone-600 mt-12 border-t border-stone-300 pt-3 flex flex-col sm:flex-row items-center justify-between gap-1 select-none">
        <div>
          <span>LEDGER TYPING MECHANICS SYSTEM MKII</span>
        </div>
        <div>
          <span>RESONATOR SYNTHESIZER READY</span>
        </div>
      </footer>

      {/* GORGEOUS PARCHMENT MANUAL OVERLAY */}
      <AnimatePresence>
        {showManualOverlay && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 select-none">
            {/* Click outside to close */}
            <div className="absolute inset-0" onClick={() => setShowManualOverlay(false)} />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ type: "spring", duration: 0.4 }}
              className="w-full max-w-lg paper-grain border-2 border-[#E2E8F0] rounded-2xl p-6 shadow-2xl relative select-none overflow-hidden"
              style={{
                background: "linear-gradient(to bottom, #FFFFFF 0%, #FAFAFA 85%, #EFECE6 100%)",
              }}
            >
              {/* Red double rules margins */}
              <div className="absolute left-6 md:left-8 top-0 bottom-0 w-[2px] border-l-2 border-rose-400/30" />

              {/* Brass Corner Rivets */}
              <div className="absolute top-3 left-3 w-3 h-3 rounded-full bg-gradient-to-r from-[#C08A3E] via-[#E4B876] to-[#8C6425] border border-[#8C6425]/40 shadow-sm" />
              <div className="absolute top-3 right-3 w-3 h-3 rounded-full bg-gradient-to-r from-[#C08A3E] via-[#E4B876] to-[#8C6425] border border-[#8C6425]/40 shadow-sm" />
              <div className="absolute bottom-3 left-3 w-3 h-3 rounded-full bg-gradient-to-r from-[#C08A3E] via-[#E4B876] to-[#8C6425] border border-[#8C6425]/40 shadow-sm" />
              <div className="absolute bottom-3 right-3 w-3 h-3 rounded-full bg-gradient-to-r from-[#C08A3E] via-[#E4B876] to-[#8C6425] border border-[#8C6425]/40 shadow-sm" />

              <div className="pl-6 md:pl-8 relative z-10 flex flex-col gap-4">
                <div className="text-center border-b border-stone-200 pb-3 relative">
                  <h2 className="font-display text-lg text-stone-800 tracking-widest uppercase font-bold">
                    OPERATOR MANUAL
                  </h2>
                  <p className="font-mono text-[8px] text-[#C08A3E] tracking-widest uppercase font-bold mt-0.5">
                    LEDGER TYPING MECHANICS SYSTEM
                  </p>
                  
                  {/* Close button in top right */}
                  <button 
                    onClick={() => setShowManualOverlay(false)}
                    className="absolute right-0 top-0 text-stone-400 hover:text-[#B33A3A] transition-colors focus:outline-none p-1 cursor-pointer"
                  >
                    ✕
                  </button>
                </div>

                <div className="flex flex-col gap-3.5 text-left">
                  <div className="flex gap-2.5">
                    <span className="font-display text-xs text-[#B33A3A] font-bold">I.</span>
                    <div>
                      <h3 className="font-sans text-xs font-bold text-stone-900 uppercase tracking-wide">
                        Tactile Resonator Acoustics
                      </h3>
                      <p className="font-sans text-[11px] text-stone-600 leading-relaxed mt-0.5">
                        Toggle the <span className="text-[#C08A3E] font-bold">ACOUSTIC</span> button in the header. Experience authentic typewriter clacks, spacebar thuds, carriage return bell chimes, and slide sweeps.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2.5">
                    <span className="font-display text-xs text-[#B33A3A] font-bold">II.</span>
                    <div>
                      <h3 className="font-sans text-xs font-bold text-stone-900 uppercase tracking-wide">
                        Carbon Ink Ribbon Engine
                      </h3>
                      <p className="font-sans text-[11px] text-stone-600 leading-relaxed mt-0.5">
                        Letters clack deep graphite-emerald ink onto the page. Writing typos instantly leave carbon smudge strikes in ribbon red.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2.5">
                    <span className="font-display text-xs text-[#B33A3A] font-bold">III.</span>
                    <div>
                      <h3 className="font-sans text-xs font-bold text-stone-900 uppercase tracking-wide">
                        Kinetic Carriage Feed
                      </h3>
                      <p className="font-sans text-[11px] text-stone-600 leading-relaxed mt-0.5">
                        The platen cylinder shifts horizontally as you write. Automatically rolls the paper sheet upward on carriage line feeds.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="border-t border-stone-200 pt-3 flex justify-center">
                  <button
                    onClick={() => setShowManualOverlay(false)}
                    className="px-6 py-1.5 bg-[#C08A3E] hover:bg-[#b07d34] text-white font-mono text-[9px] uppercase tracking-widest font-bold rounded shadow-md transition-all cursor-pointer border border-[#8C6425]/20"
                  >
                    Acknowledge & Close
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
