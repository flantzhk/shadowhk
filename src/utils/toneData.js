// src/utils/toneData.js — tone ladders shared by FirstRunFlow's quick intro
// and the full JyutpingGuide/PinyinGuide reference screen.

export const SIX_TONES = [
  { tone: 1, romanization: 'si1', char: '詩', desc: 'high flat',    meaning: 'poem' },
  { tone: 2, romanization: 'si2', char: '史', desc: 'high rising',  meaning: 'history' },
  { tone: 3, romanization: 'si3', char: '試', desc: 'mid level',    meaning: 'to try' },
  { tone: 4, romanization: 'si4', char: '時', desc: 'low falling',  meaning: 'time' },
  { tone: 5, romanization: 'si5', char: '市', desc: 'low rising',   meaning: 'market' },
  { tone: 6, romanization: 'si6', char: '事', desc: 'low level',    meaning: 'matter' },
];

// The classic "ma" set — the standard textbook example for Mandarin's 4 tones.
export const FOUR_TONES = [
  { tone: 1, romanization: 'mā', char: '妈', desc: 'high and level', meaning: 'mom' },
  { tone: 2, romanization: 'má', char: '麻', desc: 'rising',         meaning: 'hemp' },
  { tone: 3, romanization: 'mǎ', char: '马', desc: 'dipping',        meaning: 'horse' },
  { tone: 4, romanization: 'mà', char: '骂', desc: 'sharp falling',  meaning: 'scold' },
];
