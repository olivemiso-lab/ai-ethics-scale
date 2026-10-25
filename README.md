# AI 윤리 저울

초등 4학년 도덕 '디지털 세상에서 현명하게 판단하기' 수업 도구입니다.
선생님 화면의 'AI로 비슷한 질문 묶어 보기'는 Gemini API를 서버 함수로 불러옵니다.

## 파일 구성

| 파일 | 하는 일 |
|---|---|
| `index.html` | 앱 화면 (학생 화면 + 선생님 화면) |
| `_gemini.js` | Gemini API를 부르는 공통 코드 |
| `api/cluster.js` | Vercel용 서버 함수 (`/api/cluster`) |
| `netlify/functions/cluster.js` | Netlify용 서버 함수 |
| `netlify.toml` | Netlify에서 `/api/cluster` 주소를 함수에 연결 |

## 환경 변수 (Vercel, Netlify 둘 다)

| 이름 | 값 |
|---|---|
| `GEMINI_API_KEY` | aistudio.google.com 에서 받은 키 |
| `TEACHER_PIN` | 선생님 화면 비밀번호와 같은 숫자 (기본 1234) |

API 키는 서버 함수 안에서만 쓰이고 `index.html`에는 들어가지 않습니다. 키를 코드나 GitHub에 직접 적지 마세요.

## 알아 둘 점

- 학생 기록은 각 기기(브라우저)에만 저장됩니다. 한 기기에서 '다음 친구 차례'로 여러 명이 하면 선생님 화면에 모입니다.
- 딜레마 1~9는 김은경·이영준(2023), 「인공지능 윤리 역량 신장을 위한 인공지능 윤리 딜레마 개발」의 딜레마를 초등 4학년 눈높이로 다시 쓴 것입니다.
