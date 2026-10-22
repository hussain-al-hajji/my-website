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
