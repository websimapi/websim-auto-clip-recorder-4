/* ...existing code... */
export async function composeClips(blobs, opts){
  const { outroSeconds=3, logoUrl, outroAudio, width=1280, height=720, fps=30 } = opts;

  const canvas = document.createElement("canvas");
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle="#000"; ctx.fillRect(0,0,width,height);

  const stream = canvas.captureStream(fps);

  // WebAudio mix: per-clip audio + outro music
  const ac = new (window.AudioContext || window.webkitAudioContext)();
  const mixDest = ac.createMediaStreamDestination();
  const masterGain = ac.createGain();
  masterGain.gain.value = 1.0;
  masterGain.connect(mixDest);

  // Attach audio to output stream
  stream.addTrack(mixDest.stream.getAudioTracks()[0]);

  const recorder = new MediaRecorder(stream, { mimeType: "video/webm;codecs=vp9,opus" });
  const outChunks = [];
  recorder.ondataavailable = e=>{ if (e.data.size) outChunks.push(e.data); };

  const drawLetterbox = ()=>{ ctx.fillStyle="#000"; ctx.fillRect(0,0,width,height); };

  async function playVideoBlob(blob){
    return new Promise((resolve)=>{
      const v = document.createElement("video");
      v.src = URL.createObjectURL(blob);
      v.playsInline = true;
      v.crossOrigin = "anonymous";
      v.muted = false;
      const srcNode = ac.createMediaElementSource(v);
      srcNode.connect(masterGain);
      v.addEventListener("loadedmetadata", ()=>{
        v.play();
        const start = performance.now();
        const render = ()=>{
          drawLetterbox();
          // Fit contain
          const vw=v.videoWidth||16, vh=v.videoHeight||9;
          const scale = Math.min(width/vw, height/vh);
          const dw = vw*scale, dh = vh*scale;
          const dx = (width-dw)/2, dy=(height-dh)/2;
          ctx.drawImage(v, dx, dy, dw, dh);
          if (!v.paused && !v.ended) {
            requestAnimationFrame(render);
          }
        };
        render();
      }, {once:true});
      v.addEventListener("ended", ()=>{
        srcNode.disconnect();
        URL.revokeObjectURL(v.src);
        resolve();
      }, {once:true});
    });
  }

  async function playOutro(){
    // Draw logo centered for outroSeconds, and play outroAudio
    const img = await loadImage(logoUrl);
    const audio = new Audio(outroAudio);
    audio.crossOrigin = "anonymous";
    const aNode = ac.createMediaElementSource(audio);
    aNode.connect(masterGain);
    audio.play().catch(()=>{});
    const start = performance.now();
    const dur = outroSeconds*1000;
    return new Promise((resolve)=>{
      const render = ()=>{
        const now = performance.now();
        drawLetterbox();
        const iw = Math.min(width*0.5, img.width), ih = iw*(img.height/img.width);
        ctx.drawImage(img, (width-iw)/2, (height-ih)/2, iw, ih);
        if (now - start < dur) {
          requestAnimationFrame(render);
        } else {
          audio.pause();
          aNode.disconnect();
          resolve();
        }
      };
      render();
    });
  }

  function loadImage(url){
    return new Promise((res,rej)=>{
      const i = new Image();
      i.onload = ()=>res(i);
      i.onerror = rej;
      i.src = url;
    });
  }

  recorder.start(200);

  for (const b of blobs){
    await playVideoBlob(b);
    if (outroAudio && logoUrl) {
      await playOutro();
    }
  }

  recorder.stop();

  const done = await new Promise((res)=>{
    recorder.onstop = ()=>res(new Blob(outChunks, { type: "video/webm" }));
  });
  try { ac.close(); } catch {}
  return done;
}

export async function concatenateClips(blobs, opts) {
    const { width = 1280, height = 720, fps = 30 } = opts;

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, width, height);

    const stream = canvas.captureStream(fps);
    const ac = new (window.AudioContext || window.webkitAudioContext)();
    const mixDest = ac.createMediaStreamDestination();
    stream.addTrack(mixDest.stream.getAudioTracks()[0]);

    const recorder = new MediaRecorder(stream, { mimeType: "video/webm;codecs=vp9,opus" });
    const outChunks = [];
    recorder.ondataavailable = e => { if (e.data.size) outChunks.push(e.data); };

    const drawLetterbox = () => { ctx.fillStyle = "#000"; ctx.fillRect(0, 0, width, height); };

    async function playVideoBlob(blob) {
        return new Promise((resolve) => {
            const v = document.createElement("video");
            v.src = URL.createObjectURL(blob);
            v.playsInline = true;
            v.crossOrigin = "anonymous";
            v.muted = false; // important for concatenation
            const srcNode = ac.createMediaElementSource(v);
            srcNode.connect(mixDest);
            v.addEventListener("loadedmetadata", () => {
                v.play();
                const render = () => {
                    drawLetterbox();
                    const vw = v.videoWidth || 16, vh = v.videoHeight || 9;
                    const scale = Math.min(width / vw, height / vh);
                    const dw = vw * scale, dh = vh * scale;
                    const dx = (width - dw) / 2, dy = (height - dh) / 2;
                    ctx.drawImage(v, dx, dy, dw, dh);
                    if (!v.paused && !v.ended) {
                        requestAnimationFrame(render);
                    }
                };
                render();
            }, { once: true });
            v.addEventListener("ended", () => {
                srcNode.disconnect();
                URL.revokeObjectURL(v.src);
                resolve();
            }, { once: true });
        });
    }

    recorder.start(200);

    for (const b of blobs) {
        await playVideoBlob(b);
    }

    recorder.stop();

    const done = await new Promise((res) => {
        recorder.onstop = () => res(new Blob(outChunks, { type: "video/webm" }));
    });
    try { ac.close(); } catch { }
    return done;
}
/* ...existing code... */