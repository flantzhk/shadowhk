// src/services/aiChat.js — AI conversation partner service

import { pinyin } from 'pinyin-pro';
import { textToSpeech, textToJyutping, fetchWithAuth } from './api';
import { isAuthenticated } from './auth';
import { API_BASE_URL, API_ENDPOINTS } from '../utils/constants';
import { jyutpingToDisplay } from '../utils/jyutping';
import { logger } from '../utils/logger';

const SCENARIOS = [
  {
    id: 'cha_chaan_teng',
    title: 'Cha Chaan Teng',
    chineseTitle: '茶餐廳',
    persona: 'Busy waiter',
    emoji: '☕',
    language: 'cantonese',
    backgroundUrl: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=800&q=80',
    fallbackGradient: 'linear-gradient(135deg, #8B5A2B 0%, #3A2416 100%)',
    systemContext: 'You are 阿明, a busy, slightly impatient waiter (伙記) at a packed Hong Kong cha chaan teng during lunchtime rush. You are warm but hurried — you tap your notepad and remind customers you are busy. You ask what they want to eat and drink, suggest the daily special, and nudge them to order quickly. You speak in casual, authentic Hong Kong Cantonese.',
  },
  {
    id: 'red_taxi',
    title: 'Red Taxi',
    chineseTitle: '的士',
    persona: 'Chatty driver',
    emoji: '🚕',
    language: 'cantonese',
    backgroundUrl: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=800&q=80',
    fallbackGradient: 'linear-gradient(135deg, #A02020 0%, #4A0F0F 100%)',
    systemContext: 'You are Uncle Wai (韋叔), a chatty, opinionated Hong Kong taxi driver (的士大佬) who has driven a cab for 25 years. You have strong opinions about traffic, the MTR, weather, and local politics. You ask the passenger where they are going and make friendly small talk about anything on your mind. You speak in lively, colloquial Cantonese with the warmth of someone who loves a good chat.',
  },
  {
    id: 'building_lobby',
    title: 'Building Lobby',
    chineseTitle: '大廈大堂',
    persona: 'Security guard',
    emoji: '🏢',
    language: 'cantonese',
    backgroundUrl: 'https://images.unsplash.com/photo-1486325212027-8081e485255e?auto=format&fit=crop&w=800&q=80',
    fallbackGradient: 'linear-gradient(135deg, #4A5568 0%, #1A202C 100%)',
    systemContext: 'You are 保安叔叔 (Uncle Security), a familiar, gossipy security guard who has worked in this residential building lobby for 12 years. You know all the residents by name, always have something to say about the weather or building gossip, and love helping people. You ask how they are doing, comment on their groceries, and mention anything interesting that happened today. You speak in friendly, warm Cantonese.',
  },
  {
    id: 'seven_eleven',
    title: '7-Eleven',
    chineseTitle: '便利店',
    persona: 'Tired cashier',
    emoji: '🏪',
    language: 'cantonese',
    backgroundUrl: 'https://images.unsplash.com/photo-1604719312566-8912e9c8a213?auto=format&fit=crop&w=800&q=80',
    fallbackGradient: 'linear-gradient(135deg, #2D7A3E 0%, #0F3D1E 100%)',
    systemContext: 'You are a tired but polite young 7-Eleven cashier (便利店店員) near the end of a long shift. You are professional and helpful — you help customers find items, top up Octopus cards (八達通), heat up food in the microwave, and handle plastic bag requests. You speak in efficient, polite Cantonese, occasionally yawning but always courteous.',
  },
  {
    id: 'mandarin_restaurant',
    title: 'Restaurant',
    chineseTitle: '餐厅',
    persona: 'Friendly waiter',
    emoji: '🍜',
    language: 'mandarin',
    backgroundUrl: 'https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&w=800&q=80',
    fallbackGradient: 'linear-gradient(135deg, #C0392B 0%, #4A1410 100%)',
    systemContext: 'You are 小李, a friendly waiter at a busy local restaurant in mainland China during the lunch rush. You are warm and efficient — you greet guests, suggest today\'s dishes, and check if they need anything else. You speak in simple, clear Mandarin (Putonghua) appropriate for a beginner learner.',
  },
  {
    id: 'mandarin_taxi',
    title: 'Taxi',
    chineseTitle: '出租车',
    persona: 'Chatty driver',
    emoji: '🚖',
    language: 'mandarin',
    backgroundUrl: 'https://images.unsplash.com/photo-1512988403255-8b3563fdd58d?auto=format&fit=crop&w=800&q=80',
    fallbackGradient: 'linear-gradient(135deg, #D4AC0D 0%, #4A3C0F 100%)',
    systemContext: 'You are 王师傅, a chatty, friendly taxi driver in a Chinese city who has been driving for many years. You ask the passenger where they are going, make small talk about traffic and the weather, and are patient with beginners. You speak in simple, clear Mandarin.',
  },
  {
    id: 'mandarin_hotel',
    title: 'Hotel Front Desk',
    chineseTitle: '酒店前台',
    persona: 'Front desk clerk',
    emoji: '🏨',
    language: 'mandarin',
    backgroundUrl: 'https://images.unsplash.com/photo-1445019980597-93fa8acb246c?auto=format&fit=crop&w=800&q=80',
    fallbackGradient: 'linear-gradient(135deg, #34495E 0%, #12181F 100%)',
    systemContext: 'You are 小张, a professional and helpful hotel front-desk clerk in China. You help guests check in, answer questions about breakfast times and checkout, and are patient and clear with non-native speakers. You speak in simple, polite Mandarin.',
  },
  {
    id: 'mandarin_shop',
    title: 'Convenience Store',
    chineseTitle: '小卖部',
    persona: 'Shop clerk',
    emoji: '🏪',
    language: 'mandarin',
    backgroundUrl: 'https://images.unsplash.com/photo-1604719312566-8912e9c8a213?auto=format&fit=crop&w=800&q=80',
    fallbackGradient: 'linear-gradient(135deg, #2D7A3E 0%, #0F3D1E 100%)',
    systemContext: 'You are a friendly convenience store clerk in China. You help customers find items, ring up purchases, and mention if they need a bag. You speak in simple, everyday Mandarin, patient with beginners.',
  },
];

/**
 * Get all available conversation scenarios for a language.
 * @param {string} [language='cantonese']
 * @returns {Object[]}
 */
function getScenarios(language = 'cantonese') {
  return SCENARIOS.filter(s => s.language === language);
}

/**
 * Build the system prompt for the AI.
 * @param {Object} scenario
 * @returns {string}
 */
function buildSystemPrompt(scenario) {
  const languageRule = scenario.language === 'mandarin'
    ? '- Respond ONLY in colloquial Mandarin (simplified Chinese, not Cantonese).'
    : '- Respond ONLY in colloquial Cantonese (written Cantonese, not Mandarin).';
  return [
    scenario.systemContext,
    'RULES:',
    languageRule,
    '- Keep each response to 1-2 short sentences maximum.',
    '- Use common everyday vocabulary appropriate for a beginner learner.',
    '- Be natural, warm, and encouraging.',
    '- If the user makes a mistake, gently continue the conversation.',
    '- Start with a natural greeting appropriate for the scenario.',
  ].join('\n');
}

/**
 * Send a message to the AI and get a response.
 * This uses a simple fetch to an AI endpoint.
 * @param {Object[]} messages - Conversation history
 * @param {Object} scenario
 * @returns {Promise<{chinese: string, jyutping: string, romanization: string, english: string}>}
 */
async function sendMessage(messages, scenario) {
  let response;

  try {
    const res = await fetchWithAuth(
      `${API_BASE_URL}${API_ENDPOINTS.AI_CHAT}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages, scenario }),
      }
    );
    response = await res.json();
    if (!response.chinese) throw new Error('Empty response from AI');
  } catch (err) {
    logger.warn('AI chat API failed, using local fallback', err);
    response = generateLocalResponse(messages, scenario);
  }

  // Generate romanization for the response — Mandarin pinyin is a local,
  // deterministic conversion (no API call needed); Cantonese jyutping
  // requires cantonese.ai's endpoint.
  if (response.chinese) {
    if (scenario.language === 'mandarin') {
      try {
        response.romanization = pinyin(response.chinese, { toneType: 'symbol', type: 'string' });
      } catch (err) {
        logger.warn('Failed to get pinyin for AI response', err);
      }
    } else {
      try {
        const jpResult = await textToJyutping(response.chinese);
        if (jpResult.success && jpResult.result) {
          const jp = jpResult.result.map(r => r.jyutping).join(' ');
          response.jyutping = jp;
          response.romanization = jyutpingToDisplay(jp);
        }
      } catch (err) {
        logger.warn('Failed to get jyutping for AI response', err);
      }
    }
  }

  return response;
}

/**
 * Generate TTS audio for an AI response.
 * @param {string} chinese
 * @param {Object} scenario
 * @returns {Promise<Blob|null>}
 */
async function generateResponseAudio(chinese, scenario) {
  if (!isAuthenticated()) return null;
  const language = scenario?.language ?? 'cantonese';
  try {
    return await textToSpeech(chinese, {
      language, speed: 0.9, outputExtension: 'mp3',
      ...(language === 'cantonese' && { voiceId: '99fb84cf-d081-4df6-8b8a-7165015a2f5d' }),
    });
  } catch (err) {
    logger.warn('Failed to generate AI response audio', err);
    return null;
  }
}

/**
 * Local response generator (fallback when no AI API).
 * @param {Object[]} messages
 * @param {Object} scenario
 * @returns {Object}
 */
function generateLocalResponse(messages, scenario) {
  const turnCount = messages.filter(m => m.role === 'assistant').length;
  const fallbackKey = scenario.language === 'mandarin' ? 'mandarin_restaurant' : 'restaurant';
  const responses = SCENARIO_RESPONSES[scenario.id] || SCENARIO_RESPONSES[fallbackKey];
  const idx = Math.min(turnCount, responses.length - 1);
  return { ...responses[idx] };
}

const SCENARIO_RESPONSES = {
  cha_chaan_teng: [
    { chinese: '喂！幾多位？快啲入嚟坐！', jyutping: '', romanization: '', english: 'Hey! How many people? Come in and sit down quickly!' },
    { chinese: '飲咩呀？今日有凍奶茶同熱咖啡。', jyutping: '', romanization: '', english: 'What to drink? Today we have iced milk tea and hot coffee.' },
    { chinese: '食咩嘢？今日例牌有炒蛋火腿麵。', jyutping: '', romanization: '', english: 'What to eat? Today\'s special is scrambled eggs and ham noodles.' },
    { chinese: '好，等一陣，好快㗎！', jyutping: '', romanization: '', english: 'Okay, wait a moment, won\'t be long!' },
    { chinese: '食得開心！有咩要叫我。', jyutping: '', romanization: '', english: 'Enjoy your meal! Call me if you need anything.' },
  ],
  red_taxi: [
    { chinese: '你好！去邊度呀？', jyutping: '', romanization: '', english: 'Hello! Where are you going?' },
    { chinese: '好，知道喇。今日塞車好犀利㗎。', jyutping: '', romanization: '', english: 'Got it. The traffic is terrible today.' },
    { chinese: '你睇今日天氣幾靚！', jyutping: '', romanization: '', english: 'Look how nice the weather is today!' },
    { chinese: '到喇！一共一百蚊。多謝！', jyutping: '', romanization: '', english: 'We\'re here! That\'s 100 dollars. Thanks!' },
    { chinese: '下次見！拜拜！', jyutping: '', romanization: '', english: 'See you next time! Bye!' },
  ],
  building_lobby: [
    { chinese: '早晨呀！你好嗎？', jyutping: '', romanization: '', english: 'Good morning! How are you?' },
    { chinese: '今日天氣好好，你去邊度呀？', jyutping: '', romanization: '', english: 'The weather is great today, where are you going?' },
    { chinese: '有快遞俾你㗎，喺我度攞喇。', jyutping: '', romanization: '', english: 'There\'s a package for you, pick it up from me.' },
    { chinese: '噢，你買咗好多嘢！好重㗎喎。', jyutping: '', romanization: '', english: 'Oh, you bought a lot! That must be heavy.' },
    { chinese: '好，拜拜！出入平安！', jyutping: '', romanization: '', english: 'Okay, goodbye! Take care!' },
  ],
  seven_eleven: [
    { chinese: '你好，有咩幫到你？', jyutping: '', romanization: '', english: 'Hi, how can I help you?' },
    { chinese: '要唔要袋？五毫子一個。', jyutping: '', romanization: '', english: 'Do you need a bag? 50 cents each.' },
    { chinese: '八達通想增值？增幾多呀？', jyutping: '', romanization: '', english: 'Want to top up your Octopus card? How much?' },
    { chinese: '好，一共二十三蚊。', jyutping: '', romanization: '', english: 'Okay, that\'s 23 dollars in total.' },
    { chinese: '多謝！拜拜！', jyutping: '', romanization: '', english: 'Thanks! Bye!' },
  ],
  restaurant: [
    { chinese: '你好！歡迎嚟！幾多位？', jyutping: '', romanization: '', english: 'Hello! Welcome! How many people?' },
    { chinese: '好，呢邊坐。想飲咩？', jyutping: '', romanization: '', english: 'Okay, sit here. What would you like to drink?' },
    { chinese: '好嘅！要唔要食嘢？', jyutping: '', romanization: '', english: 'Great! Would you like something to eat?' },
    { chinese: '好，等一陣。', jyutping: '', romanization: '', english: 'Okay, wait a moment.' },
    { chinese: '食得開心！有咩需要叫我。', jyutping: '', romanization: '', english: 'Enjoy your meal! Call me if you need anything.' },
  ],
  taxi: [
    { chinese: '你好！去邊度？', jyutping: '', romanization: '', english: 'Hello! Where to?' },
    { chinese: '好，知道喇。大概十五分鐘。', jyutping: '', romanization: '', english: 'Okay, got it. About 15 minutes.' },
    { chinese: '今日天氣唔錯。', jyutping: '', romanization: '', english: "The weather's nice today." },
    { chinese: '到喇！一共八十五蚊。', jyutping: '', romanization: '', english: "We're here! That's 85 dollars." },
    { chinese: '多謝！拜拜！', jyutping: '', romanization: '', english: 'Thanks! Bye!' },
  ],
  market: [
    { chinese: '靚女！買咩呀？', jyutping: '', romanization: '', english: 'Hey there! What are you buying?' },
    { chinese: '呢啲好新鮮。三十蚊一斤。', jyutping: '', romanization: '', english: 'These are very fresh. 30 dollars per catty.' },
    { chinese: '平啲啦！廿五蚊得唔得？', jyutping: '', romanization: '', english: 'Cheaper! How about 25 dollars?' },
    { chinese: '好啦好啦。仲要啲咩？', jyutping: '', romanization: '', english: 'Okay okay. Anything else?' },
    { chinese: '多謝幫襯！', jyutping: '', romanization: '', english: 'Thanks for your business!' },
  ],
  school: [
    { chinese: '你好呀！你個仔幾年級？', jyutping: '', romanization: '', english: 'Hello! What year is your child in?' },
    { chinese: '噢，同我個女同班呀！', jyutping: '', romanization: '', english: 'Oh, same class as my daughter!' },
    { chinese: '你哋住邊度？', jyutping: '', romanization: '', english: 'Where do you live?' },
    { chinese: '好近呀！得閒一齊飲茶。', jyutping: '', romanization: '', english: "That's close! Let's have tea sometime." },
    { chinese: '好呀！改日再傾。拜拜！', jyutping: '', romanization: '', english: "Sure! Chat later. Bye!" },
  ],
  neighbor: [
    { chinese: '早晨！你好嗎？', jyutping: '', romanization: '', english: 'Good morning! How are you?' },
    { chinese: '幾好呀。今日天氣好好。', jyutping: '', romanization: '', english: "Pretty good. The weather is nice today." },
    { chinese: '係呀！你出去邊度？', jyutping: '', romanization: '', english: "Yes! Where are you heading?" },
    { chinese: '噢，行街呀。開心啲！', jyutping: '', romanization: '', english: "Oh, going shopping. Have fun!" },
    { chinese: '拜拜！下次見！', jyutping: '', romanization: '', english: 'Bye! See you next time!' },
  ],
  doctor: [
    { chinese: '你好！有冇預約？', jyutping: '', romanization: '', english: 'Hello! Do you have an appointment?' },
    { chinese: '好，請坐。等一陣醫生見你。', jyutping: '', romanization: '', english: 'Okay, please sit. The doctor will see you shortly.' },
    { chinese: '邊度唔舒服？', jyutping: '', romanization: '', english: 'Where does it feel uncomfortable?' },
    { chinese: '知道喇。開啲藥俾你。', jyutping: '', romanization: '', english: 'I see. I will prescribe some medicine for you.' },
    { chinese: '飲多啲水，休息下。祝你早日康復！', jyutping: '', romanization: '', english: 'Drink more water and rest. Get well soon!' },
  ],
  shop: [
    { chinese: '歡迎！想搵咩？', jyutping: '', romanization: '', english: 'Welcome! What are you looking for?' },
    { chinese: '呢件幾好睇。你想試吓？', jyutping: '', romanization: '', english: 'This one looks nice. Want to try it on?' },
    { chinese: '有大碼同細碼。你著咩碼？', jyutping: '', romanization: '', english: 'We have large and small. What size do you wear?' },
    { chinese: '好啱你！今日打八折。', jyutping: '', romanization: '', english: 'Looks great on you! 20% off today.' },
    { chinese: '好，幫你包起佢。多謝！', jyutping: '', romanization: '', english: "Okay, I'll wrap it up for you. Thanks!" },
  ],
  mandarin_restaurant: [
    { chinese: '你好！几位？', jyutping: '', romanization: '', english: 'Hello! How many people?' },
    { chinese: '想喝点什么？我们有绿茶和可乐。', jyutping: '', romanization: '', english: 'What would you like to drink? We have green tea and cola.' },
    { chinese: '想吃点什么？今天的招牌菜是红烧肉。', jyutping: '', romanization: '', english: "What would you like to eat? Today's special is braised pork." },
    { chinese: '好的，请稍等，很快就好。', jyutping: '', romanization: '', english: "OK, please wait a moment, it'll be ready soon." },
    { chinese: '慢慢吃！有需要叫我。', jyutping: '', romanization: '', english: 'Enjoy your meal! Call me if you need anything.' },
  ],
  mandarin_taxi: [
    { chinese: '你好！去哪儿？', jyutping: '', romanization: '', english: 'Hello! Where to?' },
    { chinese: '好的，知道了。今天路上有点堵。', jyutping: '', romanization: '', english: "Got it. Traffic's a bit heavy today." },
    { chinese: '你看今天天气真不错！', jyutping: '', romanization: '', english: "Look, the weather's really nice today!" },
    { chinese: '到了！一共三十五块。', jyutping: '', romanization: '', english: "We're here! That's 35 yuan total." },
    { chinese: '谢谢，慢走！', jyutping: '', romanization: '', english: 'Thanks, take care!' },
  ],
  mandarin_hotel: [
    { chinese: '您好！欢迎光临，请问有预订吗？', jyutping: '', romanization: '', english: 'Hello! Welcome, do you have a reservation?' },
    { chinese: '好的，请给我您的护照。', jyutping: '', romanization: '', english: 'OK, please give me your passport.' },
    { chinese: '您的房间在三楼，早餐是早上七点到十点。', jyutping: '', romanization: '', english: "Your room is on the 3rd floor, breakfast is 7-10am." },
    { chinese: '这是您的房卡，祝您入住愉快。', jyutping: '', romanization: '', english: 'Here is your room key, enjoy your stay.' },
    { chinese: '好的，有其他需要请随时联系我们。', jyutping: '', romanization: '', english: 'OK, let us know if you need anything else.' },
  ],
  mandarin_shop: [
    { chinese: '你好，需要点什么？', jyutping: '', romanization: '', english: 'Hi, what do you need?' },
    { chinese: '要不要袋子？一个袋子一块钱。', jyutping: '', romanization: '', english: 'Need a bag? One yuan per bag.' },
    { chinese: '一共十五块，可以扫码支付。', jyutping: '', romanization: '', english: "That's 15 yuan total, you can pay by scanning the code." },
    { chinese: '好的，谢谢惠顾！', jyutping: '', romanization: '', english: 'OK, thanks for shopping with us!' },
    { chinese: '欢迎再来！', jyutping: '', romanization: '', english: 'Come again!' },
  ],
};

export { getScenarios, buildSystemPrompt, sendMessage, generateResponseAudio };
// Exported for tests — not part of the runtime public API
export { SCENARIOS, SCENARIO_RESPONSES, generateLocalResponse };
