import { useState } from 'react';
import styles from './IntroduceYourselfForm.module.css';
import { useAppContext } from '../../contexts/AppContext.jsx';
import { countPhrases, buildGenerationPrompt, savePersonalScene, buildPersonalSceneObject, PERSONAL_SCENE_ID } from '../../services/personalSceneBuilder.js';
import { fetchWithAuth } from '../../services/api.js';
import { API_BASE_URL } from '../../utils/constants.js';

const EMPTY_FORM = {
  name: '',
  age: '',
  hometown: '',
  hkDistrict: '',
  job: '',
  company: '',
  yearsInHK: '',
  partnerName: '',
  partnerNationality: '',
  numKids: '',
  kids: [],
  parentsLocal: '',
  siblings: '',
  lunchSpot: '',
  mtrStation: '',
  hobby: '',
  hkLove: '',
  regularPlace: '',
  learningReason: '',
  learningDuration: '',
};

export default function IntroduceYourselfForm({ onComplete, onBack }) {
  const { settings } = useAppContext();
  const language = settings?.currentLanguage ?? 'cantonese';

  const [form, setForm] = useState({ ...EMPTY_FORM, kids: [] });
  const [openSections, setOpenSections] = useState({ about: true, family: false, daily: false, learning: false });
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);

  const phraseCount = countPhrases(form);

  function setField(key, value) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  function setKidField(i, key, value) {
    setForm(prev => {
      const kids = [...(prev.kids ?? [])];
      kids[i] = { ...kids[i], [key]: value };
      return { ...prev, kids };
    });
  }

  function ensureKids(count) {
    setForm(prev => {
      const kids = [...(prev.kids ?? [])];
      while (kids.length < count) kids.push({ name: '', age: '', school: '' });
      return { ...prev, kids: kids.slice(0, count) };
    });
  }

  function toggleSection(key) {
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));
  }

  async function handleGenerate() {
    if (!form.name.trim()) return;
    setGenerating(true);
    setError(null);

    try {
      const prompt = buildGenerationPrompt(form, language);
      const response = await fetchWithAuth(`${API_BASE_URL}/ai-chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: prompt }],
          language,
          mode: 'generate-phrases',
        }),
      });

      const data = await response.json();

      let phrases;
      if (Array.isArray(data)) {
        phrases = data;
      } else {
        const raw = data.content ?? data.message ?? '';
        try {
          const jsonMatch = raw.match(/\[[\s\S]*\]/);
          phrases = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
        } catch (_) {
          throw new Error('Could not parse generated phrases. Try again.');
        }
      }

      if (!phrases.length) throw new Error('No phrases generated. Try adding more details.');

      await savePersonalScene(phrases, language);
      const scene = buildPersonalSceneObject(phrases, form.name);

      onComplete?.({ scene, phraseCount: phrases.length });
    } catch (err) {
      setError(err.message ?? 'Something went wrong. Check your connection.');
    } finally {
      setGenerating(false);
    }
  }

  const numKids = parseInt(form.numKids) || 0;

  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={onBack} aria-label="Back">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M12 4l-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <div className={styles.headerText}>
          <h1 className={styles.title}>Introduce yourself</h1>
          {phraseCount > 0 && (
            <span className={styles.phraseCounter}>{phraseCount} phrase{phraseCount !== 1 ? 's' : ''} ready</span>
          )}
        </div>
      </div>

      <div className={styles.content}>
        <p className={styles.description}>
          Fill in what applies to you. We'll build you a personal Cantonese scene from your real life.
          Everything is optional except your name.
        </p>

        {/* About you */}
        <Section
          title="About you"
          open={openSections.about}
          onToggle={() => toggleSection('about')}
        >
          <Field label="Your name *" required>
            <input className={styles.input} placeholder="e.g. Sarah" value={form.name} onChange={e => setField('name', e.target.value)} />
          </Field>
          <Row>
            <Field label="Age">
              <input className={styles.input} placeholder="e.g. 34" type="number" min="1" max="120" value={form.age} onChange={e => setField('age', e.target.value)} />
            </Field>
            <Field label="Years in HK">
              <input className={styles.input} placeholder="e.g. 3" type="number" min="0" value={form.yearsInHK} onChange={e => setField('yearsInHK', e.target.value)} />
            </Field>
          </Row>
          <Field label="Originally from">
            <input className={styles.input} placeholder="e.g. London, UK" value={form.hometown} onChange={e => setField('hometown', e.target.value)} />
          </Field>
          <Field label="HK district">
            <input className={styles.input} placeholder="e.g. Sai Wan Ho" value={form.hkDistrict} onChange={e => setField('hkDistrict', e.target.value)} />
          </Field>
          <Field label="Job">
            <input className={styles.input} placeholder="e.g. teacher, nurse, software engineer" value={form.job} onChange={e => setField('job', e.target.value)} />
          </Field>
          <Field label="Company or industry">
            <input className={styles.input} placeholder="e.g. finance, education, healthcare" value={form.company} onChange={e => setField('company', e.target.value)} />
          </Field>
        </Section>

        {/* Family */}
        <Section
          title="Family"
          open={openSections.family}
          onToggle={() => toggleSection('family')}
        >
          <Row>
            <Field label="Partner's name">
              <input className={styles.input} placeholder="e.g. David" value={form.partnerName} onChange={e => setField('partnerName', e.target.value)} />
            </Field>
            <Field label="Partner's nationality">
              <input className={styles.input} placeholder="e.g. Australian" value={form.partnerNationality} onChange={e => setField('partnerNationality', e.target.value)} />
            </Field>
          </Row>
          <Field label="Number of kids">
            <select
              className={styles.select}
              value={form.numKids}
              onChange={e => { setField('numKids', e.target.value); ensureKids(parseInt(e.target.value) || 0); }}
            >
              <option value="">None</option>
              {[1, 2, 3, 4].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </Field>
          {Array.from({ length: numKids }).map((_, i) => (
            <div key={i} className={styles.kidBlock}>
              <p className={styles.kidLabel}>Child {i + 1}</p>
              <Row>
                <Field label="Name">
                  <input className={styles.input} placeholder="e.g. Emma" value={form.kids[i]?.name ?? ''} onChange={e => setKidField(i, 'name', e.target.value)} />
                </Field>
                <Field label="Age">
                  <input className={styles.input} type="number" min="0" max="25" value={form.kids[i]?.age ?? ''} onChange={e => setKidField(i, 'age', e.target.value)} />
                </Field>
              </Row>
              <Field label="School and district">
                <input className={styles.input} placeholder="e.g. ESF Sha Tin, Sha Tin" value={form.kids[i]?.school ?? ''} onChange={e => setKidField(i, 'school', e.target.value)} />
              </Field>
            </div>
          ))}
          <Field label="Are your parents HK locals who speak Cantonese?">
            <select className={styles.select} value={form.parentsLocal} onChange={e => setField('parentsLocal', e.target.value)}>
              <option value="">Skip</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </Field>
        </Section>

        {/* Daily life */}
        <Section
          title="Daily life"
          open={openSections.daily}
          onToggle={() => toggleSection('daily')}
        >
          <Field label="Where you eat lunch">
            <input className={styles.input} placeholder="e.g. cha chaan teng in Sham Shui Po" value={form.lunchSpot} onChange={e => setField('lunchSpot', e.target.value)} />
          </Field>
          <Field label="Your local MTR station">
            <input className={styles.input} placeholder="e.g. Sai Wan Ho" value={form.mtrStation} onChange={e => setField('mtrStation', e.target.value)} />
          </Field>
          <Field label="Hobby or sport">
            <input className={styles.input} placeholder="e.g. hiking, swimming" value={form.hobby} onChange={e => setField('hobby', e.target.value)} />
          </Field>
          <Field label="Something you love about Hong Kong">
            <input className={styles.input} placeholder="e.g. the dim sum, the efficiency" value={form.hkLove} onChange={e => setField('hkLove', e.target.value)} />
          </Field>
          <Field label="A place you go regularly">
            <input className={styles.input} placeholder="e.g. Southorn Playground, Times Square" value={form.regularPlace} onChange={e => setField('regularPlace', e.target.value)} />
          </Field>
        </Section>

        {/* Learning */}
        <Section
          title="Learning"
          open={openSections.learning}
          onToggle={() => toggleSection('learning')}
        >
          <Field label="Why are you learning?">
            <input className={styles.input} placeholder="e.g. to talk to my kids' teachers" value={form.learningReason} onChange={e => setField('learningReason', e.target.value)} />
          </Field>
          <Field label="How long have you been learning?">
            <input className={styles.input} placeholder="e.g. 6 months" value={form.learningDuration} onChange={e => setField('learningDuration', e.target.value)} />
          </Field>
        </Section>

        {error && <p className={styles.error}>{error}</p>}

        <button
          className={styles.generateBtn}
          onClick={handleGenerate}
          disabled={!form.name.trim() || generating}
        >
          {generating
            ? 'Building your scene...'
            : phraseCount > 0
              ? `Build ${phraseCount} phrase${phraseCount !== 1 ? 's' : ''}`
              : 'Add your name to start'}
        </button>
      </div>
    </div>
  );
}

function Section({ title, open, onToggle, children }) {
  return (
    <div className={styles.section}>
      <button className={styles.sectionHeader} onClick={onToggle} type="button">
        <span className={styles.sectionTitle}>{title}</span>
        <span className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </span>
      </button>
      {open && <div className={styles.sectionBody}>{children}</div>}
    </div>
  );
}

function Field({ label, required, children }) {
  return (
    <div className={styles.field}>
      <label className={styles.label}>{label}{required && <span className={styles.req}> *</span>}</label>
      {children}
    </div>
  );
}

function Row({ children }) {
  return <div className={styles.row}>{children}</div>;
}
