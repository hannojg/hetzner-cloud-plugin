export function setupPage(nonce: string): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Connect Hetzner Cloud</title>
  <style nonce="${nonce}">
    * { box-sizing: border-box; }
    body { margin: 0; background: #f7f7f8; color: #202124; font: 16px/1.55 system-ui, sans-serif; }
    main { width: min(100% - 40px, 520px); margin: 10vh auto; }
    .brand { color: #b80b29; font-size: 13px; font-weight: 750; letter-spacing: .12em; text-transform: uppercase; }
    h1 { font-size: 32px; line-height: 1.2; letter-spacing: -.03em; margin: 18px 0 12px; }
    p { color: #666970; margin: 0 0 24px; }
    .card { background: white; padding: 30px; border: 1px solid #e4e4e8; border-radius: 18px; box-shadow: 0 6px 28px #00000005; }
    .status { display: inline-flex; align-items: center; gap: 8px; margin-bottom: 24px; font-size: 14px; color: #6e7077; }
    .dot { width: 8px; height: 8px; background: #aaadb5; border-radius: 50%; }
    .connected .dot { background: #21824b; }
    .connected { color: #21824b; }
    label { display: block; font-size: 14px; font-weight: 650; margin: 20px 0 9px; }
    input { width: 100%; padding: 13px 14px; border: 1px solid #c7c9d1; border-radius: 9px; font: inherit; }
    input:focus { outline: 3px solid #d50c2d20; border-color: #b80b29; }
    button { width: 100%; margin-top: 16px; padding: 13px 18px; border: 0; border-radius: 9px; font: inherit; font-weight: 650; background: #bf0b2a; color: white; cursor: pointer; }
    button:hover { background: #a60823; }
    button:disabled { opacity: .55; cursor: wait; }
    .secondary { margin-top: 10px; background: #f2f2f5; color: #5b5d65; }
    .secondary:hover { background: #e8e8ed; }
    .hint { margin: 16px 0 0; font-size: 13px; }
    a { color: #a70824; text-underline-offset: 3px; }
    #message { margin: 18px 0 0; font-size: 14px; }
    #message.error { color: #ad1833; }
    #message.success { color: #21824b; }
    footer { color: #797c84; font-size: 12px; margin: 20px 5px; }
    [hidden] { display: none !important; }
  </style>
</head>
<body>
  <main>
    <div class="brand">Hetzner Cloud Plugin</div>
    <h1>Connect your project</h1>
    <p>Manage your Cloud resources and Storage Boxes from Codex.</p>
    <section class="card">
      <div id="status" class="status"><span class="dot"></span><span id="status-label">Checking connection…</span></div>
      <form id="connect-form">
        <label for="project">Project name</label>
        <input id="project" name="project" type="text" list="projects" value="Default" autocomplete="off" spellcheck="false" maxlength="30" required disabled>
        <datalist id="projects"><option value="Default"></option></datalist>
        <p class="hint">Choose a saved project or enter a new name. Each project has its own token. This is a local label; it does not create a project at Hetzner.</p>
        <label for="token">Project API token</label>
        <input id="token" name="token" type="password" placeholder="Paste your Hetzner API token" autocomplete="off" spellcheck="false" maxlength="512" required disabled>
        <button id="save" type="submit" disabled>Connect project</button>
      </form>
      <button id="disconnect" class="secondary" type="button" hidden>Remove this connection</button>
      <p class="hint">Create a token in <a href="https://console.hetzner.com/" target="_blank" rel="noreferrer">Hetzner Console</a> under your project's Security → API Tokens.</p>
      <p class="hint">Your token is stored in your system credential store. It is sent directly to Hetzner to verify access and make API requests.</p>
      <p id="message" role="status" aria-live="polite" hidden></p>
    </section>
    <footer>This private setup page runs on your computer and expires after 10 minutes. Your token stays outside the Codex conversation.</footer>
  </main>
  <script nonce="${nonce}">
    const form = document.getElementById('connect-form');
    const input = document.getElementById('token');
    const projectInput = document.getElementById('project');
    const projectOptions = document.getElementById('projects');
    const save = document.getElementById('save');
    const disconnect = document.getElementById('disconnect');
    const status = document.getElementById('status');
    const label = document.getElementById('status-label');
    const message = document.getElementById('message');
    const basePath = location.pathname;
    let projects = [];

    function projectName() {
      const trimmed = projectInput.value.trim();
      const normalized = trimmed.normalize('NFC');
      const lower = normalized.toLowerCase();
      return lower === 'default' ? 'Default' : normalized;
    }

    function showMessage(text, error) {
      message.textContent = text;
      message.className = error ? 'error' : 'success';
      message.hidden = false;
    }

    function updateConnection() {
      const project = projectName();
      const connected = projects.includes(project);
      label.textContent = connected ? 'Selected project connected' : 'New project connection';
      status.classList.toggle('connected', connected);
      save.textContent = connected ? 'Replace token' : 'Connect project';
      disconnect.hidden = connected === false;
    }

    function setBusy(busy) {
      save.disabled = busy;
      disconnect.disabled = busy;
      input.disabled = busy;
      projectInput.disabled = busy;
    }

    async function request(action, data) {
      const options = { method: 'GET', cache: 'no-store' };
      if (data !== undefined) {
        options.method = 'POST';
        options.headers = { 'Content-Type': 'application/json' };
        options.body = JSON.stringify(data);
      }
      let response;
      try {
        response = await fetch(basePath + '/' + action, options);
      } catch {
        throw new Error('This setup page is unavailable or has expired. Run plugin setup again.');
      }
      const result = await response.json();
      if (response.ok === false) {
        const text = result.error.message;
        throw new Error(text);
      }
      return result;
    }

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const token = input.value.trim();
      if (token.length === 0) return;
      const project = projectName();
      setBusy(true);
      message.hidden = true;
      try {
        const result = await request('connect', { project, token });
        input.value = '';
        projectInput.value = result.project;
        await loadStatus(false);
        showMessage('Connected. You can return to Codex; the connection is ready immediately.', false);
      } catch (error) {
        showMessage(error.message, true);
      } finally {
        setBusy(false);
      }
    });

    disconnect.addEventListener('click', async () => {
      setBusy(true);
      try {
        const project = projectName();
        await request('disconnect', { project });
        input.value = '';
        await loadStatus(false);
        showMessage('The saved token has been removed from this computer. To revoke the token itself, delete it in Hetzner Console.', false);
      } catch (error) {
        showMessage(error.message, true);
      } finally {
        setBusy(false);
      }
    });

    projectInput.addEventListener('input', () => {
      input.value = '';
      message.hidden = true;
      updateConnection();
    });

    async function loadStatus(initial) {
      try {
        const result = await request('status');
        projects = result.projects;
        projectOptions.replaceChildren();
        for (const project of projects) {
          const option = document.createElement('option');
          option.value = project;
          projectOptions.append(option);
        }
        if (initial && projects.length > 0) {
          const hasDefault = projects.includes('Default');
          projectInput.value = hasDefault ? 'Default' : projects[0];
          input.value = '';
        }
        updateConnection();
      } catch (error) {
        label.textContent = 'Connection unavailable';
        showMessage(error.message, true);
      } finally {
        if (initial) setBusy(false);
      }
    }
    loadStatus(true);
  </script>
</body>
</html>`;
}
