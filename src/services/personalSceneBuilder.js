// personalSceneBuilder.js — builds a personal "Introduce Yourself" scene from form data

const PERSONAL_SCENE_ID = 'personal-introduce-yourself';

/**
 * Count how many phrases will be generated from the form data.
 * Phrase count = number of filled non-name fields + 1 (for name).
 */
export function countPhrases(formData) {
  let count = 0;
  const flat = flattenFormData(formData);
  for (const val of Object.values(flat)) {
    if (val && String(val).trim()) count++;
  }
  return count;
}

/**
 * Build a prompt for the AI to generate natural self-introduction phrases.
 * Returns a structured prompt string for the Cloudflare Worker.
 */
export function buildGenerationPrompt(formData, language) {
  const flat = flattenFormData(formData);
  const filled = Object.entries(flat).filter(([, v]) => v && String(v).trim());

  const langLabel = language === 'mandarin' ? 'Mandarin (Simplified Chinese + Pīnyīn)' : 'Cantonese (Traditional Chinese + Jyutping)';

  const fieldLabels = getFieldLabels(language);
  const lines = filled.map(([key, value]) => `- ${fieldLabels[key] ?? key}: ${value}`).join('\n');

  return `You are generating self-introduction phrases for a ${langLabel} learner living in Hong Kong.

The person wants to introduce themselves naturally when meeting someone new — at a social gathering, a friend's party, meeting neighbours, or casual conversation. Generate one natural, conversational ${langLabel} phrase per piece of information below. Order the phrases as someone would actually say them out loud when introducing themselves to a new person.

Information about the person:
${lines}

For each phrase, return a JSON array of objects with:
- "english": the English version (natural sentence, not a label)
- "cjk": the ${language === 'mandarin' ? 'Simplified Chinese' : 'Traditional Chinese'} characters
- "romanization": the ${language === 'mandarin' ? 'Pīnyīn with tone marks' : 'Jyutping with tone numbers'}
- "audioFile": null (will be generated via TTS)

Rules:
- Phrases should sound like real speech, not a CV. "I live in Sai Wan Ho" not "Location: Sai Wan Ho"
- Use natural connecting phrases and filler words in ${language === 'mandarin' ? 'Mandarin' : 'Cantonese'}
- Keep each phrase short enough to practise in one breath
- Include typical conversational responses to questions people ask when meeting someone new in HK (where are you from, how long in HK, what do you do, etc.)
- Return ONLY the JSON array, no other text`;
}

/**
 * Save the generated phrases as a personal scene in IndexedDB library.
 * Validates the AI response shape and script/romanization before writing
 * anything — throws (matching the rest of the codebase's error convention,
 * e.g. api.js's ApiError) rather than saving malformed entries.
 */
export async function savePersonalScene(phrases, language) {
  validateGeneratedPhrases(phrases, language);

  const { saveLibraryEntry } = await import('./storage.js');
  const { GROWTH_STATE, SOURCE_TAGS } = await import('../utils/constants.js');

  const now = Date.now();
  const saved = [];
  for (const phrase of phrases) {
    const entry = {
      phraseId: `${PERSONAL_SCENE_ID}-${crypto.randomUUID()}`,
      cjk: phrase.cjk,
      romanization: phrase.romanization,
      english: phrase.english,
      language,
      scene_id: PERSONAL_SCENE_ID,
      source_tag: SOURCE_TAGS.MINE,
      growth_state: GROWTH_STATE.NEW,
      interval: 0,
      easeFactor: 2.5,
      practiceCount: 0,
      nextReviewAt: now,
      lastPracticedAt: null,
      lived_at: null,
      _createdAt: now,
      _updatedAt: now,
    };
    await saveLibraryEntry(entry);
    saved.push(entry);
  }
  return saved;
}

/**
 * Build a fake scene object from the personal phrases (for ShadowSession compatibility).
 */
export function buildPersonalSceneObject(phrases, name, language = 'cantonese') {
  return {
    id: PERSONAL_SCENE_ID,
    emoji: '👋',
    title: `Introducing ${name || 'yourself'}`,
    description: `Your personal self-introduction in ${language === 'mandarin' ? 'Mandarin' : 'Cantonese'}`,
    category: 'social',
    difficulty: 'personal',
    estimatedMinutes: Math.ceil(phrases.length * 0.75),
    lines: phrases.map((p, i) => ({
      id: `${PERSONAL_SCENE_ID}-${i}`,
      speaker: 'you',
      cjk: p.cjk,
      romanization: p.romanization,
      english: p.english,
      audioFile: null,
    })),
  };
}

export { PERSONAL_SCENE_ID };

// --- helpers ---

function flattenFormData(f) {
  const flat = {};

  // About you
  if (f.name) flat.name = f.name;
  if (f.age) flat.age = f.age;
  if (f.nationality) flat.nationality = f.nationality;
  if (f.hometown) flat.hometown = f.hometown;
  if (f.hkDistrict) flat.hkDistrict = f.hkDistrict;
  if (f.job) flat.job = f.job;
  if (f.company) flat.company = f.company;
  if (f.yearsInHK) flat.yearsInHK = f.yearsInHK;
  if (f.reasonCameToHK) flat.reasonCameToHK = f.reasonCameToHK;
  if (f.languages) flat.languages = f.languages;

  // Family
  if (f.partnerName) flat.partnerName = f.partnerName;
  if (f.partnerNationality) flat.partnerNationality = f.partnerNationality;
  if (f.numKids) flat.numKids = f.numKids;
  const kids = f.kids ?? [];
  kids.forEach((kid, i) => {
    if (kid.name) flat[`kid${i + 1}Name`] = kid.name;
    if (kid.age) flat[`kid${i + 1}Age`] = kid.age;
    if (kid.school) flat[`kid${i + 1}School`] = kid.school;
  });
  if (f.siblings) flat.siblings = f.siblings;
  if (f.pets) flat.pets = f.pets;
  if (f.parentsLocal !== undefined && f.parentsLocal !== '') flat.parentsLocal = f.parentsLocal;

  // Daily life
  if (f.howCommute) flat.howCommute = f.howCommute;
  if (f.mtrStation) flat.mtrStation = f.mtrStation;
  if (f.lunchSpot) flat.lunchSpot = f.lunchSpot;
  if (f.favHKFood) flat.favHKFood = f.favHKFood;
  if (f.hobby) flat.hobby = f.hobby;
  if (f.weekendActivity) flat.weekendActivity = f.weekendActivity;
  if (f.regularPlace) flat.regularPlace = f.regularPlace;
  if (f.hkLove) flat.hkLove = f.hkLove;
  if (f.missesMostFromHome) flat.missesMostFromHome = f.missesMostFromHome;

  // Personality
  if (f.funFact) flat.funFact = f.funFact;
  if (f.futurePlans) flat.futurePlans = f.futurePlans;

  // Learning
  if (f.learningReason) flat.learningReason = f.learningReason;
  if (f.learningDuration) flat.learningDuration = f.learningDuration;

  return flat;
}

// FIELD_LABELS.parentsLocal describes a Cantonese/HK-local family background;
// Mandarin scenes are framed around Mainland China (see public/scenes/mandarin-*.json
// "location" fields), so the label needs to match that context instead.
function getFieldLabels(language) {
  if (language === 'mandarin') {
    return { ...FIELD_LABELS, parentsLocal: 'Parents are Mainland China locals who speak Mandarin' };
  }
  return FIELD_LABELS;
}

const FIELD_LABELS = {
  name: 'Name',
  age: 'Age',
  nationality: 'Nationality',
  hometown: 'Where they grew up',
  hkDistrict: 'Where they live in HK',
  job: 'Job / role',
  company: 'Company or industry',
  yearsInHK: 'Years in Hong Kong',
  reasonCameToHK: 'Why they came to HK',
  languages: 'Other languages spoken',
  partnerName: "Partner's name",
  partnerNationality: "Partner's nationality",
  numKids: 'Number of children',
  kid1Name: 'Child 1 name',
  kid1Age: 'Child 1 age',
  kid1School: 'Child 1 school',
  kid2Name: 'Child 2 name',
  kid2Age: 'Child 2 age',
  kid2School: 'Child 2 school',
  kid3Name: 'Child 3 name',
  kid3Age: 'Child 3 age',
  kid3School: 'Child 3 school',
  siblings: 'Siblings',
  pets: 'Pets',
  parentsLocal: 'Parents are HK locals who speak Cantonese',
  howCommute: 'How they get around HK',
  mtrStation: 'Local MTR station',
  lunchSpot: 'Where they usually eat lunch',
  favHKFood: 'Favourite Hong Kong food',
  hobby: 'Hobby or sport',
  weekendActivity: 'Typical weekend activity',
  regularPlace: 'A place they go regularly',
  hkLove: 'Something they love about Hong Kong',
  missesMostFromHome: 'Something they miss from home',
  funFact: 'A fun fact about themselves',
  futurePlans: 'Plans or hopes for Hong Kong',
  learningReason: 'Why learning Cantonese/Mandarin',
  learningDuration: 'How long they have been learning',
};

// A handful of very common characters that differ between Simplified and
// Traditional forms — enough to catch the AI writing in the wrong script,
// not a full Simplified/Traditional classifier.
const SIMPLIFIED_TRADITIONAL_PAIRS = [
  ['国', '國'], ['说', '說'], ['对', '對'], ['们', '們'], ['时', '時'],
  ['么', '麼'], ['没', '沒'], ['这', '這'], ['学', '學'], ['见', '見'],
  ['语', '語'], ['开', '開'], ['关', '關'], ['个', '個'], ['现', '現'],
];

// Jyutping romanization always ends each syllable in a tone digit 1-6.
// Pinyin-with-tone-marks (what we ask for) uses diacritics, never digits.
const JYUTPING_TONE_RE = /[a-z]+[1-6]/i;
const PINYIN_DIACRITIC_RE = /[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/i;

/**
 * Cheap sanity check that one generated phrase has the required fields and
 * is in the expected script/romanization for the language — catches the AI
 * ignoring the Simplified/Pinyin vs Traditional/Jyutping instruction. This is
 * a heuristic, not a linguistic classifier.
 */
function isWellFormedPhrase(phrase, language) {
  if (!phrase || typeof phrase !== 'object') return false;
  if (!String(phrase.cjk ?? '').trim()) return false;
  if (!String(phrase.romanization ?? '').trim()) return false;
  if (!String(phrase.english ?? '').trim()) return false;

  const cjk = String(phrase.cjk);
  const romanization = String(phrase.romanization);

  if (language === 'mandarin') {
    if (SIMPLIFIED_TRADITIONAL_PAIRS.some(([, traditional]) => cjk.includes(traditional))) return false;
    if (!PINYIN_DIACRITIC_RE.test(romanization)) return false;
  } else {
    if (SIMPLIFIED_TRADITIONAL_PAIRS.some(([simplified]) => cjk.includes(simplified))) return false;
    if (!JYUTPING_TONE_RE.test(romanization)) return false;
  }
  return true;
}

/**
 * Validate the AI's phrase-generation response before it's written to the
 * library. Throws a plain Error with a user-facing message (the convention
 * used by api.js/ApiError and surfaced as-is by IntroduceYourselfForm's
 * catch block) if the response is malformed or ignored the language/script
 * instruction, instead of silently saving garbage.
 */
function validateGeneratedPhrases(phrases, language) {
  if (!Array.isArray(phrases) || phrases.length === 0) {
    throw new Error('No phrases generated. Try adding more details.');
  }
  if (!phrases.every(p => isWellFormedPhrase(p, language))) {
    throw new Error('The generated phrases came back in an unexpected format. Please try again.');
  }
}
