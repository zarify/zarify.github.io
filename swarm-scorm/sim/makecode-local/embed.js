(() => {
  if (window.ksRunnerInit) {
    return;
  }

  const currentScript = document.currentScript;
  const currentScriptUrl =
    currentScript instanceof HTMLScriptElement && typeof currentScript.src === 'string'
      ? currentScript.src
      : new URL('makecode-local/embed.js', window.location.href).toString();
  const localBaseUrl = new URL('./', currentScriptUrl);
  const hostBaseUrl = new URL('../', currentScriptUrl);
  const commitId = 'a6c81800617988b108f669e6f690fe9fe83a083d';

  const pxtConfig = {
    relprefix: localBaseUrl.toString(),
    verprefix: '',
    workerjs: new URL('worker.js', localBaseUrl).toString(),
    tdworkerjs: new URL('tdworker.js', localBaseUrl).toString(),
    monacoworkerjs: new URL('monacoworker.js', localBaseUrl).toString(),
    gifworkerjs: new URL('gifworker.js', localBaseUrl).toString(),
    serviceworkerjs: new URL('serviceworker.js', localBaseUrl).toString(),
    typeScriptWorkerJs: new URL('tsworker.js', localBaseUrl).toString(),
    pxtVersion: '?',
    pxtRelId: commitId,
    pxtCdnUrl: new URL(`cdn.makecode.com/commit/${commitId}/`, hostBaseUrl).toString(),
    commitCdnUrl: new URL(`cdn.makecode.com/commit/${commitId}/`, hostBaseUrl).toString(),
    blobCdnUrl: new URL(`cdn.makecode.com/`, hostBaseUrl).toString(),
    targetUrl: hostBaseUrl.toString().replace(/\/$/, ''),
    targetVersion: '?',
    targetRelId: commitId,
    targetCdnUrl: new URL(`cdn.makecode.com/commit/${commitId}/`, hostBaseUrl).toString(),
    targetId: 'microbit',
    runUrl: new URL('---run', hostBaseUrl).toString(),
    docsUrl: new URL('---docs', hostBaseUrl).toString(),
    multiUrl: new URL('---multi', hostBaseUrl).toString(),
    asseteditorUrl: new URL('---asseteditor', hostBaseUrl).toString(),
    skillmapUrl: new URL('---skillmap', hostBaseUrl).toString(),
    authcodeUrl: new URL('---authcode', hostBaseUrl).toString(),
    multiplayerUrl: new URL('---multiplayer', hostBaseUrl).toString(),
    kioskUrl: new URL('---kiosk', hostBaseUrl).toString(),
    teacherToolUrl: new URL('---eval', hostBaseUrl).toString(),
    partsUrl: new URL('---siminstructions', hostBaseUrl).toString(),
    simUrl: new URL('---simulator', hostBaseUrl).toString(),
    simserviceworkerUrl: new URL('---simserviceworker', hostBaseUrl).toString(),
    simworkerconfigUrl: new URL('---simworkerconfig', hostBaseUrl).toString(),
    cdnUrl: new URL('cdn.makecode.com', hostBaseUrl).toString().replace(/\/$/, ''),
  };

  // The shared runner scripts are served once from the content-addressed CDN
  // mirror at the simulator root; only simulator-local workers and sim.js stay
  // under makecode-local/.
  const scripts = [
    'cdn.makecode.com/blob/1cbbd44d2be928820a5f00da52d73269abf22aab/highlight.js/highlight.pack.js',
    'cdn.makecode.com/blob/555c1dc1d9da18154cb48388d5e494f3f16119f8/marked/marked.min.js',
    'cdn.makecode.com/blob/a8ee7d572f64e4ec20124271f375e728df752c8d/jquery.js',
    'cdn.makecode.com/blob/2093a8cde03812942c35ce4bdd2f8fba8c03d7e6/semantic.js',
    'cdn.makecode.com/blob/a4e25124563d9c6ab82088e3e110537b2c271cc7/target.js',
    'cdn.makecode.com/blob/864d4def356c534601397eec901a8dbc7f48af66/pxtembed.js',
  ].map((filename) => new URL(filename, hostBaseUrl).toString());

  let pxtCallbacks = [];

  window.ksRunnerReady = (callback) => {
    if (pxtCallbacks == null) {
      callback();
      return;
    }
    pxtCallbacks.push(callback);
  };

  window.ksRunnerWhenLoaded = () => {
    window.pxt.docs.requireHighlightJs = () => window.hljs;
    window.pxt.setupWebConfig(pxtConfig || window.pxtWebConfig);
    window.pxt.runner.setInitCallbacks(pxtCallbacks);
    pxtCallbacks.push(() => {
      pxtCallbacks = null;
    });
    window.pxt.runner.init();
  };

  for (const src of scripts) {
    const script = document.createElement('script');
    script.src = src;
    script.async = false;
    document.head.appendChild(script);
  }
})();
