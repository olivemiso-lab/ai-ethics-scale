/**
 * AI 윤리 저울 · 구글 앱스 스크립트 서버
 * 1) 아래 TEACHER_PIN을 선생님만 아는 숫자로 바꾸세요. 1234 그대로면 선생님 기능이 열리지 않아요.
 * 2) 기록은 이 스프레드시트의 '기록' 시트에 쌓여요. 학생 실명은 저장하지 않아요(무작위 이름만).
 * 3) 설치 안내: https://olivemiso-lab.github.io/ai-ethics-scale/setup.html
 */
const TEACHER_PIN = '1234';
const SHEET_NAME = '기록';
const HEADERS = ['시간', '기록ID', '딜레마', '이름(무작위)', '처음 마음', '처음 선택', '저울(처음)', '저울(다시)', '입장 바꾸기 마음', '입장 바꾸기 이유', '다시 선택', '다시 고른 이유', '멈춤 질문', '처음 까닭', '마음에 걸린 문장'];
const CARD_IDS = ['d0', 'a1', 'a2', 'a3', 'b1', 'b2', 'b3', 'b4', 'b5', 'b6'];

function doGet() {
  try {
    return HtmlService.createHtmlOutputFromFile('index')
      .setTitle('AI 윤리 저울')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  } catch (e) {
    // index 파일 없이 Code.gs만 붙여 넣은 경우: 이 주소는 앱의 '구글 시트 연결' 칸에 넣는 주소예요.
    return ContentService.createTextOutput('AI 윤리 저울 시트 연결 주소예요. 이 주소를 앱 선생님 화면의 "구글 시트 연결" 칸에 붙여 넣어 주세요.');
  }
}

// 웹에 올린 화면(GitHub Pages 등)이 이 시트로 기록을 보낼 때 쓰는 문이에요.
const API_ = { getState: getState, setGate: setGate, saveProgress: saveProgress, submitRecord: submitRecord, saveWise: saveWise, getPeek: getPeek, getOpen: getOpen, getProgress: getProgress, verifyPin: verifyPin, setCard: setCard, getResults: getResults, resetCard: resetCard, clusterWise: clusterWise };
function doPost(e) {
  let out;
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (!API_[body.name]) throw new Error('없는 기능이에요.');
    const fn = API_[body.name];
    out = { result: fn.apply(null, Array.isArray(body.args) ? body.args : []) };
  } catch (err) {
    out = { error: (err && err.message) || String(err) };
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

function sheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME);
  // 예전 형식의 '기록' 탭이 있으면 이름을 바꿔 보관하고 새로 만들어요.
  if (sh && sh.getLastColumn() > 0 && String(sh.getRange(1, 5).getValue()) !== HEADERS[4]) {
    sh.setName(SHEET_NAME + '(이전 형식) ' + Utilities.formatDate(new Date(), 'Asia/Seoul', 'MMdd HHmm'));
    sh = null;
  }
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.appendRow(HEADERS);
    sh.setFrozenRows(1);
  } else if (sh.getLastColumn() < HEADERS.length || String(sh.getRange(1, 4).getValue()) !== HEADERS[3]) {
    // 새로 늘어난 칸(처음 까닭, 마음에 걸린 문장)의 제목을 채워요.
    sh.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  }
  return sh;
}

function checkPin_(pin) {
  if (String(TEACHER_PIN) === '1234') throw new Error('먼저 Code.gs의 TEACHER_PIN을 선생님만 아는 숫자로 바꾸고, 배포 관리에서 새 버전으로 배포해 주세요.');
  if (String(pin) !== String(TEACHER_PIN)) throw new Error('비밀번호가 맞지 않아요.');
}

// 셀에 수식이 들어가지 않게 막고, 길이를 제한해요.
function clean_(v, max) {
  let s = String(v == null ? '' : v).slice(0, max || 200);
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return s;
}
function int_(v, lo, hi) {
  const n = parseInt(v, 10);
  return (isNaN(n) || n < lo || n > hi) ? '' : n;
}

function rows_() {
  const sh = sheet_();
  const last = sh.getLastRow();
  if (last < 2) return [];
  const num = function (v) { return v === '' ? null : Number(v); };
  const txt = function (v) { return String(v).replace(/^'/, ''); };
  return sh.getRange(2, 1, last - 1, HEADERS.length).getValues().map(function (r) {
    return {
      t: r[0] ? new Date(r[0]).getTime() : 0, id: String(r[1]), card: String(r[2]), name: txt(r[3]), feelings: String(r[4]),
      first: num(r[5]), s1: num(r[6]), s2: num(r[7]), words: String(r[8]), feel: txt(r[9]),
      second: num(r[10]), reason: txt(r[11]), wise: txt(r[12]), why1: txt(r[13]), hook: txt(r[14])
    };
  });
}

/* ---------- 학생과 선생님이 함께 쓰는 함수 ---------- */
function getState() {
  return {
    card: PropertiesService.getScriptProperties().getProperty('card') || 'd0',
    gate: Number(PropertiesService.getScriptProperties().getProperty('gate') || 1),
    url: ScriptApp.getService().getUrl()
  };
}

// 단계를 마칠 때마다 같은 기록ID의 행을 채워 나가요(없으면 새로 만들어요).
function saveProgress(rec) {
  if (!rec || CARD_IDS.indexOf(rec.card) < 0) throw new Error('잘못된 기록이에요.');
  const list_ = function (v, re) { return String(v || '').split(',').filter(function (x) { return re.test(x); }).join(','); };
  const has = function (k) { return rec[k] !== undefined && rec[k] !== null && rec[k] !== ''; };
  const vals = {
    4: has('name') ? clean_(rec.name, 30) : null,
    5: has('feelings') ? list_(rec.feelings, /^[LR][0-9]$/) : null,
    6: has('first') ? int_(rec.first, 0, 3) : null,
    7: has('s1') ? int_(rec.s1, 1, 5) : null,
    8: has('s2') ? int_(rec.s2, 1, 5) : null,
    9: has('words') ? list_(rec.words, /^[0-9]$/) : null,
    10: has('feel') ? clean_(rec.feel, 200) : null,
    11: has('second') ? int_(rec.second, 0, 3) : null,
    12: has('reason') ? clean_(rec.reason, 120) : null,
    13: has('wise') ? clean_(rec.wise, 120) : null,
    14: has('why1') ? clean_(rec.why1, 120) : null,
    15: has('hook') ? clean_(rec.hook, 200) : null
  };
  const id = clean_(rec.id, 40);
  const lock = LockService.getScriptLock();
  // 반 전체가 한꺼번에 보내도 차례를 기다릴 수 있게 넉넉히 기다려요.
  lock.waitLock(30000);
  try {
    const sh = sheet_();
    const found = sh.getLastRow() > 1 ? sh.getRange(2, 2, sh.getLastRow() - 1, 1).createTextFinder(id).matchEntireCell(true).findNext() : null;
    if (found) {
      // 한 줄을 읽어 고친 뒤 한 번에 써요(칸마다 따로 쓰면 느려서 뒤 친구들이 오래 기다려요).
      const range = sh.getRange(found.getRow(), 1, 1, HEADERS.length);
      const cur = range.getValues()[0].map(function (v) { return (typeof v === 'string' && /^[=+\-@]/.test(v)) ? "'" + v : v; });
      cur[0] = new Date();
      Object.keys(vals).forEach(function (c) { if (vals[c] !== null) cur[Number(c) - 1] = vals[c]; });
      range.setValues([cur]);
    } else {
      const r = [new Date(), id, rec.card, vals[4] === null ? '' : vals[4]];
      for (let c = 5; c <= HEADERS.length; c++) r.push(vals[c] === null ? '' : vals[c]);
      sh.appendRow(r);
    }
  } finally {
    lock.releaseLock();
  }
  return true;
}

function submitRecord(rec) {
  if (!rec || CARD_IDS.indexOf(rec.card) < 0) throw new Error('잘못된 기록이에요.');
  const list_ = function (v, re) { return String(v || '').split(',').filter(function (x) { return re.test(x); }).join(','); };
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    sheet_().appendRow([
      new Date(), clean_(rec.id, 40), rec.card, clean_(rec.name, 30),
      list_(rec.feelings, /^[LR][0-9]$/), int_(rec.first, 0, 3), int_(rec.s1, 1, 5), int_(rec.s2, 1, 5),
      list_(rec.words, /^[0-9]$/), clean_(rec.feel, 200),
      int_(rec.second, 0, 3), clean_(rec.reason, 120), clean_(rec.wise, 120), clean_(rec.why1, 120), clean_(rec.hook, 200)
    ]);
  } finally {
    lock.releaseLock();
  }
  return true;
}

function saveWise(id, text) {
  const sh = sheet_();
  const found = sh.getRange('B:B').createTextFinder(String(id)).matchEntireCell(true).findNext();
  if (found) sh.getRange(found.getRow(), 13).setValue(clean_(text, 120));
  return true;
}

// 튕긴 학생이 이름으로 자기 기록을 이어서 할 때
function getProgress(card, name) {
  const n = clean_(name, 30);
  if (!n) return null;
  const rows = rows_().filter(function (r) { return r.card === card && r.name === n; });
  return rows.length ? rows[rows.length - 1] : null;
}

// 튕긴 학생이 고를 수 있게, 아직 끝내지 않은 친구들의 무작위 이름(최근 순)
function getOpen(card) {
  const seen = {};
  return rows_().filter(function (r) { return r.card === card && r.name && r.second === null; })
    .reverse().map(function (r) { return r.name; })
    .filter(function (n) { return !seen[n] && (seen[n] = true); }).slice(0, 40);
}

function getPeek(card) {
  const rows = rows_().filter(function (r) { return r.card === card && r.first !== null; });
  const feels = rows.filter(function (r) { return r.feel; }).map(function (r) { return r.feel; });
  for (let i = feels.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = feels[i]; feels[i] = feels[j]; feels[j] = t; }
  return { firsts: rows.map(function (r) { return r.first; }), feels: feels.slice(0, 3) };
}

/* ---------- 선생님만 쓰는 함수 ---------- */
function verifyPin(pin) { checkPin_(pin); return true; }

function setCard(pin, card) {
  checkPin_(pin);
  if (CARD_IDS.indexOf(card) < 0) throw new Error('없는 딜레마예요.');
  PropertiesService.getScriptProperties().setProperty('card', card);
  PropertiesService.getScriptProperties().setProperty('gate', '1');
  return true;
}

function setGate(pin, g) {
  checkPin_(pin);
  const n = Math.max(1, Math.min(3, Number(g) || 1));
  PropertiesService.getScriptProperties().setProperty('gate', String(n));
  return true;
}

function getResults(pin, card) {
  checkPin_(pin);
  return rows_().filter(function (r) { return r.card === card; });
}

function resetCard(pin, card) {
  checkPin_(pin);
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sh = sheet_();
    const last = sh.getLastRow();
    if (last < 2) return true;
    const vals = sh.getRange(2, 3, last - 1, 1).getValues();
    for (let i = vals.length - 1; i >= 0; i--) {
      if (String(vals[i][0]) === card) sh.deleteRow(i + 2);
    }
  } finally {
    lock.releaseLock();
  }
  return true;
}

/* ---------- Gemini API: 학생 문장 묶어 보기 (선생님만) ----------
 * 1) aistudio.google.com 에서 API 키를 만드세요.
 * 2) Apps Script 왼쪽 톱니바퀴(프로젝트 설정) → 스크립트 속성 → 속성 추가
 *    이름: GEMINI_API_KEY   값: 만든 키
 * 3) 편집기에서 testGemini 함수를 한 번 실행해 권한을 허용하세요.
 * API 키는 이 서버 안에만 있고, 학생 화면이나 HTML에는 나가지 않아요.
 */
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/';
const GEMINI_MODELS = ['gemini-flash-latest', 'gemini-2.5-flash'];

function geminiKey_() {
  const k = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!k) throw new Error('GEMINI_API_KEY가 아직 없어요. 프로젝트 설정 → 스크립트 속성에 넣어 주세요.');
  return k;
}

// 쓸 수 있는 Flash 모델을 찾아 기억해 둬요.
function pickModels_(key) {
  const props = PropertiesService.getScriptProperties();
  const saved = props.getProperty('GEMINI_MODEL');
  const list = saved ? [saved].concat(GEMINI_MODELS) : GEMINI_MODELS.slice();
  try {
    const res = UrlFetchApp.fetch(GEMINI_BASE + 'models?pageSize=100&key=' + key, { muteHttpExceptions: true });
    if (res.getResponseCode() === 200) {
      (JSON.parse(res.getContentText()).models || []).forEach(function (m) {
        const id = String(m.name || '').replace('models/', '');
        const ok = (m.supportedGenerationMethods || []).indexOf('generateContent') >= 0;
        if (ok && /flash/.test(id) && !/image|tts|live|audio|embed|thinking/.test(id) && list.indexOf(id) < 0) list.push(id);
      });
    }
  } catch (e) {}
  return list;
}

function callGemini_(prompt) {
  const key = geminiKey_();
  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.2, responseMimeType: 'application/json' }
  };
  const models = pickModels_(key);
  let last = '';
  for (let i = 0; i < models.length; i++) {
    const res = UrlFetchApp.fetch(GEMINI_BASE + 'models/' + models[i] + ':generateContent', {
      method: 'post', contentType: 'application/json', muteHttpExceptions: true,
      headers: { 'x-goog-api-key': key }, payload: JSON.stringify(body)
    });
    const code = res.getResponseCode();
    if (code === 200) {
      PropertiesService.getScriptProperties().setProperty('GEMINI_MODEL', models[i]);
      const j = JSON.parse(res.getContentText());
      return ((((j.candidates || [])[0] || {}).content || {}).parts || []).map(function (p) { return p.text || ''; }).join('');
    }
    if (code === 429) throw new Error('잠시 요청이 많아요. 1분쯤 뒤에 다시 눌러 주세요.');
    if (code === 400 || code === 403) throw new Error('API 키를 확인해 주세요. (' + code + ')');
    last = code;
  }
  throw new Error('Gemini에 연결하지 못했어요. (' + last + ')');
}

function clusterWise(pin, card) {
  checkPin_(pin);
  const sentences = rows_().filter(function (r) { return r.card === card && r.wise; }).map(function (r) { return r.wise; });
  if (sentences.length < 3) throw new Error('질문이 3개 이상 모이면 묶을 수 있어요.');
  const numbered = sentences.map(function (s, i) { return i + ': ' + s; }).join('\n');
  const prompt = [
    '초등학교 4학년 학생들이 "보내거나 결정하기 전에, 나에게 어떤 질문을 해 볼까?"에 답한 멈춤 질문들이에요.',
    '뜻이 비슷한 질문끼리 2~4개 묶음으로 나눠 주세요. 예를 들어 진짜인지 묻는 질문, 결과를 묻는 질문, 다른 사람의 마음을 묻는 질문처럼 나뉠 수 있지만, 실제 질문에 맞게 나눠요.',
    '규칙:',
    '- 묶음 이름은 학생 질문에 실제로 나온 말을 살려, 초등학생이 이해할 수 있는 짧은 말(10자 이내)로 지어요.',
    '- 질문을 고치거나 새 질문을 만들지 말고, 번호로만 나눠요. 모든 번호를 한 번씩만 넣어요.',
    '- 어떤 묶음이 더 좋다거나 옳다는 평가는 하지 않아요.',
    '- 출력은 JSON 배열만: [{"label":"묶음 이름","items":[번호,...]}]',
    '',
    numbered
  ].join('\n');
  let groups;
  try { groups = JSON.parse(callGemini_(prompt)); } catch (e) {
    if (String(e.message).indexOf('{') < 0 && !(e instanceof SyntaxError)) throw e;
    throw new Error('결과를 읽지 못했어요. 다시 눌러 주세요.');
  }
  const used = {};
  const out = (Array.isArray(groups) ? groups : []).map(function (g) {
    const items = (g.items || []).map(Number).filter(function (n) { return n >= 0 && n < sentences.length && !used[n] && (used[n] = true); });
    return { label: String(g.label || '묶음').slice(0, 20), items: items.map(function (n) { return sentences[n]; }) };
  }).filter(function (g) { return g.items.length; });
  const rest = sentences.filter(function (s, i) { return !used[i]; });
  if (rest.length) out.push({ label: '그 밖의 생각', items: rest });
  return out;
}

function testGemini() {
  Logger.log(callGemini_('JSON으로만 답해요: {"ok":true}'));
}
