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

  const lines = filled.map(([key, value]) => `- ${FIELD_LABELS[key] ?? key}: ${value}`).join('\n');

  return `You are generating self-introduction phrases for a ${langLabel} learner.

The person wants to introduce themselves naturally at a family dinner or casual social setting. Generate one natural, conversational ${langLabel} phrase per piece of information below. Order the phrases as someone would actually say them out loud when introducing themselves.

Information about the person:
${lines}

For each phrase, return a JSON array of objects with:
- "english": the English version (natural sentence, not a label)
- "cjk": the ${language === 'mandarin' ? 'Simplified Chinese' : 'Traditional Chinese'} characters
- "romanization": the ${language === 'mandarin' ? 'Pīnyīn with tone marks' : 'Jyutping with tone numbers'}
- "audioFile": null (will be generated via TTS)

Rules:
- Phrases should sound like real speech, not a CV. "I live in Sai Wan Ho" not "Location: Sai Wan Ho"
- Use natural connecting phrases in ${language === 'mandarin' ? 'Mandarin' : 'Cantonese'}
- Keep each phrase short enough to practise in one breath
- Return ONLY the JSON array, no other text`;
}

/**
 * Save the generated phrases as a personal scene in IndexedDB library.
 */
export async function savePersonalScene(phrases, language) {
  const { saveLibraryEntry } = await import('./storage.js');
  const { GROWTH_STATE, SOURCE_TAGS } = await import('../utils/constants.js');

  const now = Date.now();
  for (const phrase of phrases) {
    await saveLibraryEntry({
      id: `${PERSONAL_SCENE_ID}-${crypto.randomUUID()}`,
      cjk: phrase.cjk,
      romanization: phrase.romanization,
      english: phrase.english,
      language,
      scene_id: PERSONAL_SCENE_ID,
      source_tag: SOURCE_TAGS.MINE,
      growth_state: GROWTH_STATE.NEW,
      interval: 0,
      easeFactor: 2.5,
      nextReviewDate: new Date().toISOString().slice(0, 10),
      lastPracticed: null,
      lived_at: null,
      _createdAt: now,
      _updatedAt: now,
    });
  }
}

/**
 * Build a fake scene object from the personal phrases (for ShadowSession compatibility).
 */
export function buildPersonalSceneObject(phrases, name) {
  return {
    id: PERSONAL_SCENE_ID,
    emoji: '👋',
    title: `Introducing ${name || 'yourself'}`,
    description: 'Your personal self-introduction in Cantonese',
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
  if (f.hometown) flat.hometown = f.hometown;
  if (f.hkDistrict) flat.hkDistrict = f.hkDistrict;
  if (f.job) flat.job = f.job;
  if (f.company) flat.company = f.company;
  if (f.yearsInHK) flat.yearsInHK = f.yearsInHK;

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
  if (f.parentsLocal !== undefined && f.parentsLocal !== '') flat.parentsLocal = f.parentsLocal;
  if (f.siblings) flat.siblings = f.siblings;

  // Daily life
  if (f.lunchSpot) flat.lunchSpot = f.lunchSpot;
  if (f.mtrStation) flat.mtrStation = f.mtrStation;
  if (f.hobby) flat.hobby = f.hobby;
  if (f.hkLove) flat.hkLove = f.hkLove;
  if (f.regularPlace) flat.regularPlace = f.regularPlace;

  // Learning
  if (f.learningReason) flat.learningReason = f.learningReason;
  if (f.learningDuration) flat.learningDuration = f.learningDuration;

  return flat;
}

const FIELD_LABELS = {
  name: 'Name',
  age: 'Age',
  hometown: 'Originally from',
  hkDistrict: 'Lives in (HK district)',
  job: 'Job / role',
  company: 'Company or industry',
  yearsInHK: 'Years in Hong Kong',
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
  parentsLocal: 'Are parents HK locals who speak Cantonese?',
  siblings: 'Siblings',
  lunchSpot: 'Where you usually eat lunch',
  mtrStation: 'Local MTR station',
  hobby: 'Hobby or sport',
  hkLove: 'Something you love about Hong Kong',
  regularPlace: 'A place you go regularly',
  learningReason: 'Why learning Cantonese/Mandarin',
  learningDuration: 'How long learning',
};
