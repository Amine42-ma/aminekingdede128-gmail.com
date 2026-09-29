/* ============================================================
   NEXUS CHALLENGES · the scheduled nudge (optional).
   Every 15 minutes Netlify runs this function; it asks the site's own
   /api/challenges/tick (netlify/edge-functions/challenges.js) to move what
   is due: close an ended challenge, judge an entry whose judging is
   pending, rank, pay the prizes. Nothing is decided here.
   It does nothing until CHALLENGES_CRON_SECRET is set in Netlify's
   environment variables (the same value lets /tick run without an
   account). Without it NEXUS still moves everything along: each visitor's
   page does (at most every CHALLENGE_TICK_SECONDS for the whole site), and
   each player's own entry is judged the moment it is submitted.
   A scheduled function may run ~30 s: the tick is given 24 s; what it
   could not finish (a judge still answering) is taken up on the next run
   — an entry being judged is locked, never judged twice.
   ============================================================ */
export default async () => {
  const secret = process.env.CHALLENGES_CRON_SECRET, site = process.env.URL || process.env.DEPLOY_PRIME_URL;
  if (!secret || !site) return new Response('off: set CHALLENGES_CRON_SECRET');
  const stop = new AbortController(), t = setTimeout(() => stop.abort(), 28000);
  let out;
  try {
    const r = await fetch(site.replace(/\/$/, '') + '/api/challenges/tick', { method: 'POST', signal: stop.signal,
      headers: { 'content-type': 'application/json', 'x-nexus-cron': secret }, body: JSON.stringify({ budgetSeconds: 24 }) });
    const text = await r.text();                                     // the stream, to its end
    out = r.status + ' ' + ((/event: tick\ndata: (.*)/.exec(text) || [])[1] || (/event: error\ndata: (.*)/.exec(text) || [])[1] || text.slice(0, 200));
  } catch (e) { out = 'stopped: ' + ((e && e.name) || e) + ' — the rest on the next run'; }
  finally { clearTimeout(t); }
  console.log('[challenges-tick]', out);
  return new Response('ok');
};

export const config = { schedule: '*/15 * * * *' };
