(() => {
  // Each language has its own pre-rendered page (/, /ko/, /ja/), so search engines and link previews
  // read the page in its own language without running this script. The script only adds behaviour.
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch {} },
  };
  const root = document.documentElement;
  const here = root.lang;
  // The language links are the list of pages: each link's href is its language's page, and the
  // English one is the site root.
  const pages = {};
  document.querySelectorAll('[data-lang-link]').forEach(a => { pages[a.dataset.langLink] = a.href; });
  const known = l => Object.hasOwn(pages, l);

  // Language: ?lang= (links to the old single page) goes to that page. Otherwise only / picks a page
  // for the visitor, by saved choice and then browser language. A language page opened directly stays
  // as it is, and so does / reached from another page of this site, since that is someone choosing
  // English, also when the link was opened in a new tab and its click handler below did not run.
  const fromSite = () => {
    try { return new URL(document.referrer).href.startsWith(pages.en); } catch { return false; }
  };
  const wanted = () => {
    const q = new URLSearchParams(location.search).get('lang');
    if (q && known(q)) return q;
    if (here !== 'en' || fromSite()) return null;
    const saved = store.get('lang');
    if (saved && known(saved)) return saved;
    const nav = (navigator.languages || [navigator.language || 'en']).map(l => l.slice(0, 2));
    return nav.find(known) || null;
  };
  const want = wanted();
  if (want && want !== here) {
    location.replace(pages[want] + location.hash);
    return;
  }
  document.querySelectorAll('[data-lang-link]').forEach(a => a.addEventListener('click', () => {
    store.set('lang', a.dataset.langLink);
  }));

  // Theme: system unless chosen.
  const themeBtn = document.getElementById('theme');
  const isDark = () => root.dataset.theme ? root.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  const drawTheme = () => { themeBtn.textContent = isDark() ? '☾' : '☀'; };
  const savedTheme = store.get('theme');
  if (savedTheme === 'light' || savedTheme === 'dark') root.dataset.theme = savedTheme;
  themeBtn.addEventListener('click', () => {
    root.dataset.theme = isDark() ? 'light' : 'dark';
    store.set('theme', root.dataset.theme);
    drawTheme();
  });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', drawTheme);

  // Copy: each button copies the command beside it.
  document.querySelectorAll('.copy').forEach(btn => {
    const label = btn.textContent;
    btn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(btn.parentElement.querySelector('code').textContent);
        btn.textContent = document.body.dataset.copied;
        setTimeout(() => { btn.textContent = label; }, 1600);
      } catch {}
    });
  });

  // The hero: the question goes up, the Bash tool's command types out, then its output types out much faster.
  // Same timings as the sister site's turn-duration line.
  const COMMAND = 'grep -rn TODO src --include=*.ts';
  const OUTPUT = 'src/app.ts:12:  // TODO retry on timeout';
  const BUBBLE_AT = 100, ANSWER_AT = 450, ANSWER_MS = 22.5 / 0.7, LINE_GAP = 150, LINE_MS = 0.9375 * 4;
  const chat = document.getElementById('chat');
  const answer = document.getElementById('answer');
  const line = document.getElementById('line');
  let timers = [];

  const fill = (p, text, shown) => {
    p.querySelector('.sr').textContent = text;
    p.querySelector('.ghost').textContent = text;
    p.querySelector('.typed').textContent = shown;
  };
  const typeOut = (p, text, at, ms) => {
    const chars = Array.from(text);
    chars.forEach((_, i) => timers.push(setTimeout(() => {
      p.querySelector('.typed').textContent = chars.slice(0, i + 1).join('');
    }, at + i * ms)));
    return at + chars.length * ms;
  };
  const heroFinal = () => {
    chat.classList.remove('pre');
    fill(answer, COMMAND, COMMAND);
    fill(line, OUTPUT, OUTPUT);
  };
  const heroPlay = () => {
    // Hide the bubble at once (no fall), so it only shows rising.
    chat.classList.add('instant', 'pre');
    void chat.offsetWidth;
    chat.classList.remove('instant');
    fill(answer, COMMAND, '');
    fill(line, OUTPUT, '');
    timers.push(setTimeout(() => chat.classList.remove('pre'), BUBBLE_AT));
    const answered = typeOut(answer, COMMAND, ANSWER_AT, ANSWER_MS);
    typeOut(line, OUTPUT, answered + LINE_GAP, LINE_MS);
  };

  drawTheme();
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) heroFinal(); else heroPlay();
})();
