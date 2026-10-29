// الإيداع عبر Git Data API: تعديل عدة ملفات في إيداع واحد.
const API = 'https://api.github.com';

function headers(env) {
  return {
    Authorization: 'Bearer ' + env.GITHUB_TOKEN,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'hussain-site-admin',
  };
}
async function gh(env, f, path, init = {}) {
  const r = await f(API + path, { ...init, headers: { ...headers(env), ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...(init.headers || {}) } });
  if (!r.ok) throw new Error(`github ${r.status} ${path}`);
  return r;
}

export async function commitFiles(env, files, message, f = fetch) {
  const repo = env.GITHUB_REPO, branch = env.GITHUB_BRANCH || 'main';
  const ref = await (await gh(env, f, `/repos/${repo}/git/ref/heads/${branch}`)).json();
  const head = ref.object.sha;
  const commit = await (await gh(env, f, `/repos/${repo}/git/commits/${head}`)).json();
  const tree = [];
  for (const file of files) {
    const blob = await (await gh(env, f, `/repos/${repo}/git/blobs`, { method: 'POST', body: JSON.stringify({ content: file.content, encoding: file.encoding }) })).json();
    tree.push({ path: file.path, mode: '100644', type: 'blob', sha: blob.sha });
  }
  const nt = await (await gh(env, f, `/repos/${repo}/git/trees`, { method: 'POST', body: JSON.stringify({ base_tree: commit.tree.sha, tree }) })).json();
  const nc = await (await gh(env, f, `/repos/${repo}/git/commits`, { method: 'POST', body: JSON.stringify({ message, tree: nt.sha, parents: [head] }) })).json();
  await gh(env, f, `/repos/${repo}/git/refs/heads/${branch}`, { method: 'PATCH', body: JSON.stringify({ sha: nc.sha }) });
  return { sha: nc.sha, url: nc.html_url };
}

export async function readFile(env, path, f = fetch) {
  const branch = env.GITHUB_BRANCH || 'main';
  const r = await gh(env, f, `/repos/${env.GITHUB_REPO}/contents/${path}?ref=${branch}`, { headers: { Accept: 'application/vnd.github.raw+json' } });
  return r.text();
}

// SHA-256 لنص (يُقارَن به أصل الملف الذي فتحته اللوحة بما في المستودع الآن لمنع محو تعديل أحدث)
export async function sha256(text) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
export const canonical = (jsonText) => JSON.stringify(JSON.parse(jsonText));

/** حالة بناء الموقع للإيداع المنشور: يُعدّ بناء أحدث ناجح يشمل الإيداع منشوراً أيضاً (الأقدم قد يُستبدل ببناء أحدث) */
export async function deployStatus(env, sha, f = fetch) {
  const branch = env.GITHUB_BRANCH || 'main';
  const r = await gh(env, f, `/repos/${env.GITHUB_REPO}/actions/workflows/deploy.yml/runs?branch=${branch}&event=push&per_page=15`);
  const runs = ((await r.json()).workflow_runs || []).map((x) => ({ sha: x.head_sha, status: x.status, conclusion: x.conclusion, at: Date.parse(x.created_at), url: x.html_url }));
  const target = runs.find((x) => x.sha === sha);
  if (!target) return { state: 'queued' };
  const later = runs.filter((x) => x.at >= target.at);
  const ok = later.find((x) => x.conclusion === 'success');
  if (ok) return { state: 'success', url: ok.url };
  const live = later.find((x) => x.status !== 'completed');
  if (live) return { state: 'running', url: live.url };
  const last = later.sort((a, b) => b.at - a.at)[0];
  return { state: last.conclusion === 'cancelled' ? 'cancelled' : 'failure', url: last.url };
}
