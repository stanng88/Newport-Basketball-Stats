window.__st = 'running';
(async () => {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const until = async (fn, ms = 10000) => { for (let t = 0; t < ms; t += 250) { if (fn()) return true; await wait(250); } return false; };
  const tab = t => [...document.querySelectorAll('a,button')].find(e => e.innerText.trim() === t && !e.closest('footer'));
  const eventId = location.pathname.split('/schedule/')[1].split('/')[0];
  const game = { event_id: eventId, url: location.href.replace(/\/(recap|insights|plays|info|videos)$/, ''), captured_at: new Date().toISOString() };

  // Header
  const hdr = document.querySelector('.EventHeaderCommon__eventHeaderGameContainer');
  game.header_text = hdr ? hdr.innerText.trim() : null;

  // Recap
  tab('Recap').click();
  await until(() => /\S/.test((document.querySelector('main') || {}).innerText || '') && document.querySelector('.GameRecap__pageContainer h1'));
  await wait(1200);
  const rc = document.querySelector('.GameRecap__pageContainer');
  game.recap = { text: rc ? rc.innerText.trim() : null, paragraphs: rc ? [...rc.querySelectorAll('p')].map(p => p.innerText.trim()).filter(Boolean) : [] };

  // Insights
  tab('Insights').click();
  await until(() => document.querySelector('.InsightsPage__tabChooser'));
  await wait(1200);
  const pill = () => document.querySelector('.InsightsPage__tabChooser .DropdownButton__container > button');
  const grab = () => [...document.querySelectorAll('.Insights__insightContainer')].map(c => ({
    text: c.innerText.trim(),
    bullets: [...c.querySelectorAll('li')].map(l => l.innerText.trim()),
    sections: [...c.querySelectorAll('.Insights__basketballSubheadingContainer')].map(s => ({
      heading: (s.querySelector('.Insights__basketballSubheading') || {}).innerText || null,
      points: [...s.querySelectorAll('li')].map(l => l.innerText.trim()),
    })),
  }));
  const ensureOpen = async () => { if (!document.querySelector('.Insights__dropdownButton')) { pill().click(); await until(() => document.querySelector('.Insights__dropdownButton'), 3000); } };
  game.insights = [];
  if (pill()) {
    await ensureOpen();
    const dd = document.querySelector('.Dropdown__optionsContainer');
    const opts = []; let group = '';
    dd.querySelectorAll('*').forEach(e => {
      if (e.classList.contains('Insights__dropdownButton')) opts.push({ group, label: e.innerText.replace(/\n+/g, ' | ').trim() });
      else if (e.childElementCount === 0 && !e.closest('.Insights__dropdownButton') && e.textContent.trim()) group = e.textContent.trim();
    });
    for (let i = 0; i < opts.length; i++) {
      await ensureOpen();
      document.querySelectorAll('.Insights__dropdownButton')[i].click();
      await wait(1500);
      game.insights.push({ ...opts[i], insights: grab() });
    }
  }

  // Plays
  tab('Plays').click();
  await until(() => document.querySelectorAll('.MultiSportPlays__play').length > 0, 15000);
  await wait(1500);
  const nodes = [...document.querySelectorAll('.MultiSportPlays__play, .MultiSportPlays__period, .MultiSportPlays__finalScore')];
  const raw = nodes.map(n => {
    if (n.classList.contains('MultiSportPlays__play')) {
      const sc = n.querySelector('.MultiSportPlays__score');
      const txt = (n.querySelector('.MultiSportPlays__playText') || n).innerText.split('\n').map(s => s.trim()).filter(Boolean);
      return {
        kind: 'play',
        side: n.classList.contains('MultiSportPlays__homeSide') ? 'home' : n.classList.contains('MultiSportPlays__awaySide') ? 'away' : null,
        avatar: (n.querySelector('.MultiSportPlays__avatar') || {}).innerText?.trim() || null,
        lines: txt,
        score: sc ? sc.innerText.trim() : null,
      };
    }
    return { kind: n.classList.contains('MultiSportPlays__period') ? 'period_marker' : 'final', text: n.innerText.trim() };
  });
  game.plays_raw_reverse_chronological = raw;

  // Info
  const info = tab('Info');
  if (info) { info.click(); await wait(2500); const m = document.querySelector('main'); game.info_text = m ? m.innerText.trim() : null; }

  const r = await fetch('http://127.0.0.1:8765/save?name=games/' + eventId + '.json', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(game) });
  window.__st = 'done ' + r.status + ' recap=' + (game.recap.text || '').length + ' insights=' + game.insights.length + ' plays=' + raw.filter(x => x.kind === 'play').length + ' periods=' + raw.filter(x => x.kind === 'period_marker').length;
})().catch(e => window.__st = 'ERR ' + e.message);
'started';
