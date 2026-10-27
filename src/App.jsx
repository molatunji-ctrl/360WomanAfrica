import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, animate, motion, useMotionValue, useTransform } from 'framer-motion';
import {
  Camera, Check, ChevronLeft, Download, Minus, Plus, RefreshCw, Share2, Upload,
} from 'lucide-react';

const API = import.meta.env.VITE_API_BASE_URL || 'https://three60womenafrica-service.onrender.com';
const MAX_PHOTO_SIZE = 10 * 1024 * 1024;

const CAREERS = [
  'Company CEO', 'Surgeon', 'Founder', 'Senator', 'Architect',
  'Film director', 'Judge', 'Engineer', 'Fashion designer', 'Professor',
];
const QUICK_PICKS = ['Company CEO', 'Founder', 'Doctor', 'Lawyer', 'Engineer', 'Politician', 'Creative director', 'Educator'];
const STAGES = [
  'Reading your photo',
  'Imagining your next chapter',
  'Building your office',
  'Dressing the part',
  'Setting the light',
  'Framing your portrait',
];
const JOURNEY = [
  { id: 'details', label: 'About you' },
  { id: 'photo', label: 'Your photo' },
  { id: 'result', label: 'Your future' },
];

/* ---------- The stage: the real frame, tilting, with live content in its window ---------- */

function Stage({ children, over, onDropFile, dragging, setDragging, tiltOff }) {
  const ref = useRef(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0, gx: 50, gy: 30 });
  const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  function move(e) {
    if (reduce || tiltOff) return;
    const r = ref.current.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    setTilt({ x: (0.5 - py) * 9, y: (px - 0.5) * 11, gx: px * 100, gy: py * 100 });
  }
  function leave() { setTilt({ x: 0, y: 0, gx: 50, gy: 30 }); }

  return (
    <div className="stage-wrap">
      <div
        ref={ref}
        className={`card ${dragging ? 'is-dragging' : ''}`}
        style={{
          transform: `perspective(1100px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
          '--gx': `${tilt.gx}%`, '--gy': `${tilt.gy}%`,
        }}
        onPointerMove={move}
        onPointerLeave={leave}
        onDragOver={(e) => { if (onDropFile) { e.preventDefault(); setDragging?.(true); } }}
        onDragLeave={() => setDragging?.(false)}
        onDrop={(e) => {
          if (!onDropFile) return;
          e.preventDefault();
          setDragging?.(false);
          onDropFile(e.dataTransfer.files?.[0]);
        }}
      >
        <div className="window">{children}</div>
        <img className="frame" src="/assets/360-future-frame.png" alt="" draggable="false" />
        {over}
        <div className="glare" aria-hidden="true" />
      </div>
    </div>
  );
}

/* ---------- Rotating possibilities shown inside the empty window ---------- */

function Possibilities({ greeting, future }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((n) => (n + 1) % CAREERS.length), 2300);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="poss">
      <div className="poss-pattern" aria-hidden="true" />
      <div className="poss-body">
        {greeting ? <p className="poss-hello">{greeting}</p> : <p className="poss-hello">In ten years, you could be</p>}
        {future ? (
          <p className="poss-future">{future}</p>
        ) : (
          <AnimatePresence mode="wait">
            <motion.p
              key={CAREERS[i]}
              className="poss-future"
              initial={{ opacity: 0, y: 18, filter: 'blur(6px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -18, filter: 'blur(6px)' }}
              transition={{ duration: 0.35 }}
            >
              a {CAREERS[i]}
            </motion.p>
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}

/* ---------- App ---------- */

function App() {
  const [page, setPage] = useState('welcome');
  const [person, setPerson] = useState({ name: '', age: 30, occupation: '' });
  const [consent, setConsent] = useState(false);
  const [photo, setPhoto] = useState(null);
  const [preview, setPreview] = useState('');
  const [job, setJob] = useState(null);
  const [resultUrl, setResultUrl] = useState('');
  const [error, setError] = useState('');
  const [cameraError, setCameraError] = useState('');
  const [cameraOn, setCameraOn] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [sliding, setSliding] = useState(false);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const cameraRequestRef = useRef(0);
  const fileRef = useRef(null);
  const compareRef = useRef(null);

  const reveal = useMotionValue(100);
  const clip = useTransform(reveal, (v) => `inset(0 0 0 ${v}%)`);
  const handleLeft = useTransform(reveal, (v) => `${v}%`);

  const firstName = person.name.trim().split(' ')[0];
  const detailsOk = Boolean(person.name.trim() && person.age >= 18 && person.age <= 110 && person.occupation.trim());
  const journeyIndex = page === 'details' ? 0 : page === 'photo' || page === 'generating' ? 1 : 2;

  useEffect(() => () => {
    cameraRequestRef.current += 1;
    streamRef.current?.getTracks().forEach((t) => t.stop());
  }, []);

  useEffect(() => { if (page !== 'photo') stopCamera(); }, [page]);

  useEffect(() => {
    if (cameraOn && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [cameraOn]);

  useEffect(() => {
    if (page !== 'generating') return undefined;
    setElapsed(0);
    const t = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [page]);

  useEffect(() => {
    if (page !== 'result') return undefined;
    reveal.set(100);
    const controls = animate(reveal, 46, { delay: 0.5, duration: 1.8, ease: [0.22, 1, 0.36, 1] });
    return () => controls.stop();
  }, [page, resultUrl, reveal]);

  function stopCamera() {
    cameraRequestRef.current += 1;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraOn(false);
    setCountdown(0);
  }

  function setField(key, value) { setPerson((p) => ({ ...p, [key]: value })); }
  function bumpAge(d) { setField('age', Math.min(70, Math.max(18, Number(person.age) + d))); }

  function clearPhoto() {
    if (busy) return;
    stopCamera();
    setPhoto(null);
    if (preview) URL.revokeObjectURL(preview);
    setPreview('');
    setError('');
    setCameraError('');
    if (fileRef.current) fileRef.current.value = '';
  }

  function acceptPhoto(file) {
    if (!file) return;
    setError('');
    setCameraError('');
    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      setError('Choose a JPG or PNG image.');
      return;
    }
    if (file.size > MAX_PHOTO_SIZE) {
      setError('Choose an image under 10 MB.');
      return;
    }
    if (preview) URL.revokeObjectURL(preview);
    setPhoto(file);
    setPreview(URL.createObjectURL(file));
    stopCamera();
  }

  async function startCamera() {
    setCameraError('');
    setError('');
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('This browser can’t open the camera. Upload a photo instead.');
      return;
    }
    stopCamera();
    const requestId = cameraRequestRef.current;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 1280 } },
        audio: false,
      });
      if (requestId !== cameraRequestRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      setCameraOn(true);
    } catch {
      if (requestId !== cameraRequestRef.current) return;
      setCameraError('Camera access was blocked. Allow it in your browser, or upload a photo instead.');
      setCameraOn(false);
    }
  }

  async function snap() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) {
      setCameraError('The camera is still starting. Try again in a moment.');
      return;
    }
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setCameraError('Couldn’t capture the photo. Try again or upload one.');
      return;
    }
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
    if (blob) acceptPhoto(new File([blob], 'participant-photo.jpg', { type: 'image/jpeg' }));
    else setCameraError('Couldn’t capture the photo. Try again or upload one.');
  }

  function captureWithCountdown() {
    if (countdown) return;
    let n = 3;
    setCountdown(n);
    const t = setInterval(() => {
      n -= 1;
      if (n <= 0) {
        clearInterval(t);
        setCountdown(0);
        snap();
      } else {
        setCountdown(n);
      }
    }, 800);
  }

  async function generate() {
    if (busy) return;
    if (!photo) { setError('Add a photo first.'); return; }
    if (!consent) { setError('Tick the box to let us use your photo for this portrait.'); return; }

    setBusy(true);
    setError('');
    setPage('generating');
    setResultUrl('');

    try {
      const body = new FormData();
      body.append('image', photo, photo.name || 'participant-photo.jpg');
      body.append('name', person.name.trim());
      body.append('age', String(person.age));
      body.append('occupation', person.occupation.trim());
      body.append('consent', 'true');

      const response = await fetch(`${API}/api/v1/generations`, { method: 'POST', body });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || 'We couldn’t start your portrait. Try again.');
      }

      const created = await response.json();
      setJob(created);
      let current = created;

      for (let i = 0; i < 90; i += 1) {
        if (current.status === 'COMPLETED' || current.status === 'FAILED') break;
        await new Promise((r) => setTimeout(r, 2000));
        const s = await fetch(`${API}/api/v1/generations/${created.id}`);
        if (!s.ok) throw new Error('We lost the connection while making your portrait. Try again.');
        current = await s.json();
        setJob(current);
      }

      if (current.status === 'FAILED') throw new Error(current.message || 'Your portrait didn’t finish. Try again.');
      if (current.status !== 'COMPLETED') throw new Error('This is taking longer than expected. Try again.');

      const url = `${API}/api/v1/generations/${created.id}/image?t=${Date.now()}`;
      // Preload so the reveal never starts on an empty frame.
      await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = resolve;
        img.onerror = () => reject(new Error('We couldn’t load your portrait. Try again.'));
        img.src = url;
      });
      setResultUrl(url);
      setPage('result');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
      setPage('photo');
    } finally {
      setBusy(false);
    }
  }

  async function fetchBlob() {
    const r = await fetch(resultUrl);
    if (!r.ok) throw new Error('fetch failed');
    return r.blob();
  }

  async function download() {
    try {
      const blob = await fetchBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${firstName || 'my'}-future-self.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      window.open(resultUrl, '_blank', 'noopener,noreferrer');
    }
  }

  async function share() {
    try {
      const blob = await fetchBlob();
      const file = new File([blob], 'my-future-self.png', { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'My future self', text: 'Meet the woman I’m becoming. #360WomanAfrica' });
      } else {
        await download();
      }
    } catch { /* cancelled */ }
  }

  function again() {
    // New photo, same details.
    if (job?.id) fetch(`${API}/api/v1/generations/${job.id}`, { method: 'DELETE' }).catch(() => {});
    setJob(null);
    setResultUrl('');
    clearPhoto();
    setConsent(false);
    setPage('photo');
  }

  function startOver() {
    stopCamera();
    if (job?.id) fetch(`${API}/api/v1/generations/${job.id}`, { method: 'DELETE' }).catch(() => {});
    if (preview) URL.revokeObjectURL(preview);
    setPerson({ name: '', age: 30, occupation: '' });
    setConsent(false);
    setPhoto(null);
    setPreview('');
    setJob(null);
    setResultUrl('');
    setError('');
    setCameraError('');
    setBusy(false);
    setPage('welcome');
  }

  /* ----- before/after slider ----- */
  function setFromPointer(clientX) {
    const r = compareRef.current?.getBoundingClientRect();
    if (!r) return;
    reveal.set(Math.min(97, Math.max(3, ((clientX - r.left) / r.width) * 100)));
  }
  function onSliderKey(e) {
    const step = e.shiftKey ? 10 : 3;
    if (e.key === 'ArrowLeft') { e.preventDefault(); reveal.set(Math.max(3, reveal.get() - step)); }
    if (e.key === 'ArrowRight') { e.preventDefault(); reveal.set(Math.min(97, reveal.get() + step)); }
  }

  /* ----- window content per page ----- */
  const futureLine = person.occupation.trim()
    ? `${Number(person.age) + 10}, ${person.occupation.trim().replace(/^(a|an) /i, '')}`
    : '';

  let windowContent;
  let stageOver = null;

  if (page === 'welcome') {
    windowContent = <Possibilities />;
  } else if (page === 'details') {
    windowContent = <Possibilities greeting={firstName ? `Hello, ${firstName}.` : ''} future={futureLine ? `Ten years on, you’re ${futureLine}.` : ''} />;
  } else if (page === 'photo') {
    if (preview) {
      windowContent = <img className="fill" src={preview} alt="Your photo" />;
    } else if (cameraOn) {
      windowContent = (
        <>
          <video ref={videoRef} className="fill mirror" playsInline muted />
          <div className="guide" aria-hidden="true" />
          <AnimatePresence>
            {countdown > 0 && (
              <motion.div
                key={countdown}
                className="count"
                initial={{ scale: 1.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                {countdown}
              </motion.div>
            )}
          </AnimatePresence>
        </>
      );
    } else {
      windowContent = (
        <div className="drop">
          <div className="poss-pattern" aria-hidden="true" />
          <div className="drop-body">
            <Camera size={34} />
            <p>Drop a photo here, or use the buttons.</p>
          </div>
        </div>
      );
    }
  } else if (page === 'generating') {
    windowContent = (
      <>
        <img className="fill gen-photo" src={preview} alt="" />
        <div className="scan" aria-hidden="true" />
      </>
    );
  } else {
    windowContent = <img className="fill" src={preview} alt="Your photo today" />;
  }

  const resultStage = page === 'result' && resultUrl;

  return (
    <div className="app">
      <header className="top">
        <button className="brand" onClick={startOver} aria-label="360 Woman Africa — start again">
          <img src="/assets/360-banner.jpeg" alt="360 Woman Africa" />
        </button>
      </header>

      <main className="main">
        <section className="panel" aria-live="polite">
          {page !== 'welcome' && (
            <ol className="journey" aria-label="Progress">
              {JOURNEY.map((s, i) => (
                <li key={s.id} className={i === journeyIndex ? 'on' : i < journeyIndex ? 'done' : ''}>
                  <span className="dot">{i < journeyIndex ? <Check size={12} strokeWidth={3} /> : i + 1}</span>
                  {s.label}
                </li>
              ))}
            </ol>
          )}

          <AnimatePresence mode="wait">
            <motion.div
              key={page}
              className="step"
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.28 }}
            >
              {page === 'welcome' && (
                <>
                  <h1>Meet the woman you’re becoming.</h1>
                  <p className="lede">Tell us where you’re headed, add a photo, and see yourself ten years from now.</p>
                  <button className="btn gold big" onClick={() => setPage('details')}>Start</button>
                  <p className="fine">Takes about a minute.</p>
                </>
              )}

              {page === 'details' && (
                <>
                  <h2>First, a few things about you.</h2>

                  <label className="field">
                    <span>What should we call you?</span>
                    <input
                      value={person.name}
                      onChange={(e) => setField('name', e.target.value)}
                      placeholder="Your name"
                      maxLength={100}
                      autoComplete="given-name"
                      autoFocus
                    />
                  </label>

                  <div className="field">
                    <span id="age-l">How old are you today?</span>
                    <div className="age">
                      <button type="button" className="round" onClick={() => bumpAge(-1)} aria-label="One year younger"><Minus size={18} /></button>
                      <output className="age-n" aria-labelledby="age-l">{person.age}</output>
                      <button type="button" className="round" onClick={() => bumpAge(1)} aria-label="One year older"><Plus size={18} /></button>
                    </div>
                    <input
                      type="range" min="18" max="70" value={person.age}
                      onChange={(e) => setField('age', Number(e.target.value))}
                      aria-labelledby="age-l" className="range"
                    />
                  </div>

                  <div className="field">
                    <span id="occ-l">What will you be doing in ten years?</span>
                    <div className="chips" role="group" aria-labelledby="occ-l">
                      {QUICK_PICKS.map((c) => (
                        <button
                          key={c} type="button"
                          className={`chip ${person.occupation === c ? 'sel' : ''}`}
                          aria-pressed={person.occupation === c}
                          onClick={() => setField('occupation', c)}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                    <input
                      value={person.occupation}
                      onChange={(e) => setField('occupation', e.target.value)}
                      placeholder="Or type your own"
                      maxLength={120}
                      aria-labelledby="occ-l"
                    />
                  </div>

                  <button className="btn gold big" disabled={!detailsOk} onClick={() => setPage('photo')}>
                    Next: your photo
                  </button>
                </>
              )}

              {page === 'photo' && (
                <>
                  <button className="back" onClick={() => { clearPhoto(); setPage('details'); }}>
                    <ChevronLeft size={16} /> Edit details
                  </button>
                  <h2>{preview ? `Looking good, ${firstName}.` : 'Now, a clear photo of your face.'}</h2>
                  <p className="lede small">
                    {preview
                      ? 'Happy with it? Agree below and we’ll build your portrait.'
                      : 'Face the light, no sunglasses. Your photo appears in the frame as you add it.'}
                  </p>

                  {!preview && (
                    <div className="row">
                      {!cameraOn ? (
                        <button className="btn gold" onClick={startCamera}><Camera size={18} /> Use camera</button>
                      ) : (
                        <button className="btn gold" onClick={captureWithCountdown} disabled={countdown > 0}>
                          <Camera size={18} /> {countdown ? `Hold still… ${countdown}` : 'Take photo'}
                        </button>
                      )}
                      <button className="btn ghost" onClick={() => fileRef.current?.click()}><Upload size={18} /> Upload</button>
                      <input ref={fileRef} type="file" accept="image/jpeg,image/png" hidden onChange={(e) => acceptPhoto(e.target.files?.[0])} />
                    </div>
                  )}

                  {preview && (
                    <>
                      <label className="consent">
                        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
                        <span>I agree to my photo being used to create my portrait at this event.</span>
                      </label>
                      <div className="row">
                        <button className="btn gold big" onClick={generate} disabled={!consent || busy}>Show my future self</button>
                        <button className="btn ghost" onClick={clearPhoto}><RefreshCw size={16} /> Retake</button>
                      </div>
                    </>
                  )}

                  {(error || cameraError) && <p className="err" role="alert">{error || cameraError}</p>}
                </>
              )}

              {page === 'generating' && (
                <>
                  <h2>Hold on, {firstName}. We’re finding her.</h2>
                  <AnimatePresence mode="wait">
                    <motion.p
                      key={Math.floor(elapsed / 4) % STAGES.length}
                      className="stage-msg"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.25 }}
                    >
                      {STAGES[Math.floor(elapsed / 4) % STAGES.length]}…
                    </motion.p>
                  </AnimatePresence>
                  <div className="bar" role="progressbar" aria-label="Creating your portrait"><span /></div>
                  <p className="fine">
                    {elapsed < 45
                      ? 'Usually under 30 seconds.'
                      : 'Busy moment. Still working, please keep this page open.'}
                  </p>
                </>
              )}

              {page === 'result' && (
                <>
                  <h2>{firstName}, meet her.</h2>
                  <p className="lede small">
                    Drag across your portrait to move between today and ten years from now.
                  </p>
                  <div className="row">
                    <button className="btn gold big" onClick={download}><Download size={18} /> Download</button>
                    {typeof navigator !== 'undefined' && navigator.share && (
                      <button className="btn ghost" onClick={share}><Share2 size={18} /> Share</button>
                    )}
                  </div>
                  <div className="row tight">
                    <button className="btn link" onClick={again}><RefreshCw size={15} /> Try another photo</button>
                    <button className="btn link" onClick={startOver}>Start over</button>
                  </div>
                  <p className="fine">AI-generated visualisation. Not a prediction of your actual future.</p>
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </section>

        <section className="stage" aria-label="Your portrait">
          {resultStage ? (
            <div className="stage-wrap">
              <div
                ref={compareRef}
                className={`card compare ${sliding ? 'is-sliding' : ''}`}
                onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); setSliding(true); setFromPointer(e.clientX); }}
                onPointerMove={(e) => { if (sliding) setFromPointer(e.clientX); }}
                onPointerUp={() => setSliding(false)}
                onPointerCancel={() => setSliding(false)}
              >
                <div className="window"><img className="fill" src={preview} alt="" /></div>
                <img className="frame" src="/assets/360-future-frame.png" alt="" draggable="false" />
                <motion.img
                  className="after"
                  src={resultUrl}
                  alt={`Your future self, ten years from now`}
                  style={{ clipPath: clip }}
                  draggable="false"
                />
                <span className="tag left">Today</span>
                <span className="tag right">In 10 years</span>
                <motion.div
                  className="handle"
                  style={{ left: handleLeft }}
                  role="slider"
                  tabIndex={0}
                  aria-label="Compare today with ten years from now"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(100 - reveal.get())}
                  onKeyDown={onSliderKey}
                >
                  <span className="grip"><ChevronLeft size={16} /><ChevronLeft size={16} style={{ transform: 'rotate(180deg)' }} /></span>
                </motion.div>
              </div>
            </div>
          ) : (
            <Stage
              over={stageOver}
              onDropFile={page === 'photo' && !preview ? acceptPhoto : null}
              dragging={dragging}
              setDragging={setDragging}
              tiltOff={page === 'generating'}
            >
              {windowContent}
            </Stage>
          )}
        </section>
      </main>

      <footer className="foot">360 Woman Africa Conference 2026 · Ten years of leadership</footer>
    </div>
  );
}

export default App;
