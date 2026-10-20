const REPO = "Cavalier0410/imaging-innovation-hot";
const WORKFLOW = "digest.yml";

async function dispatch(env, ref = "main") {
  if (!env.GITHUB_TOKEN) {
    return { ok: false, status: 0, body: "GITHUB_TOKEN secret is missing" };
  }

  const response = await fetch(
    `https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW}/dispatches`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${env.GITHUB_TOKEN}`,
        accept: "application/vnd.github+json",
        "content-type": "application/json",
        "user-agent": "imaging-digest-cron"
      },
      body: JSON.stringify({ ref })
    }
  );

  return { ok: response.ok, status: response.status, body: await response.text() };
}

export default {
  async scheduled(_event, env, _ctx) {
    const result = await dispatch(env);
    console.log("digest dispatch", result.status, result.body);
    if (!result.ok) {
      throw new Error(`workflow_dispatch failed: ${result.status} ${result.body}`);
    }
  },

  async fetch(request, env) {
    const url = new URL(request.url);
    if (!env.TRIGGER_KEY || url.searchParams.get("key") !== env.TRIGGER_KEY) {
      return new Response("forbidden", { status: 403 });
    }

    const result = await dispatch(env);
    return new Response(JSON.stringify(result), {
      status: result.ok ? 200 : 502,
      headers: { "content-type": "application/json" }
    });
  }
};
