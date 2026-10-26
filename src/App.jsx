import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft, ArrowRight, Camera, Check, Download, LoaderCircle,
  LockKeyhole, RefreshCw, Sparkles, Upload, UserRound, WandSparkles
} from 'lucide-react';

const API = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080' || 'https://three60womenafrica-service.onrender.com';
const steps = ['Your details', 'Your photo', 'Your future self'];
const MAX_PHOTO_SIZE = 10 * 1024 * 1024;

function App() {
  const [page, setPage] = useState('welcome');
  const [person, setPerson] = useState({ name: '', age: '', occupation: '' });
  const [consent, setConsent] = useState(false);
  const [photo, setPhoto] = useState(null);
  const [preview, setPreview] = useState('');
  const [job, setJob] = useState(null);
  const [resultUrl, setResultUrl] = useState('');
  const [error, setError] = useState('');
  const [cameraError, setCameraError] = useState('');
  const [cameraOn, setCameraOn] = useState(false);
  const [busy, setBusy] = useState(false);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const fileRef = useRef(null);

  const pageIndex = page === 'details' ? 0 : page === 'camera' ? 1 : 2;

  const canContinue = Boolean(
    person.name.trim() &&
    Number(person.age) >= 18 &&
    Number(person.age) <= 110 &&
    person.occupation.trim()
  );

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  useEffect(() => {
    if (page !== 'camera') stopCamera();
  }, [page]);

  useEffect(() => {
    if (cameraOn && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [cameraOn]);

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraOn(false);
  }

  function updatePerson(key, value) {
    setPerson((current) => ({ ...current, [key]: value }));
  }

  function chooseAnotherPhoto() {
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

    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file such as JPG or PNG.');
      return;
    }
    if (file.size > MAX_PHOTO_SIZE) {
      setError('Please choose an image smaller than 10 MB.');
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
      setCameraError('Camera access is not supported in this browser. Please upload a photo instead.');
      return;
    }

    try {
      stopCamera();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 960 },
        },
        audio: false,
      });
      streamRef.current = stream;
      setCameraOn(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch {
      setCameraError('Camera permission was not granted or the camera is unavailable. You can upload a photo instead.');
      setCameraOn(false);
    }
  }

  async function capturePhoto() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) {
      setCameraError('The camera is still starting. Please wait a moment and try again.');
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setCameraError('Could not capture the photo. Please upload an image instead.');
      return;
    }

    // Mirror the captured image to match the mirrored selfie-camera preview.
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0);

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
    if (blob) {
      acceptPhoto(new File([blob], 'participant-photo.jpg', { type: 'image/jpeg' }));
    } else {
      setCameraError('Could not capture the photo. Please try again or upload an image.');
    }
  }

  async function generate() {
    if (!photo || !consent || busy) {
      if (!consent) setError('Please agree to the photo-processing consent before continuing.');
      if (!photo) setError('Please capture or upload a photo first.');
      return;
    }

    setBusy(true);
    setError('');
    setPage('generating');
    setResultUrl('');

    try {
      const body = new FormData();
      body.append('image', photo, photo.name || 'participant-photo.jpg');
      body.append('name', person.name.trim());
      body.append('age', person.age);
      body.append('occupation', person.occupation.trim());
      body.append('consent', 'true');

      const response = await fetch(`${API}/api/v1/generations`, {
        method: 'POST',
        body,
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || 'We could not start image generation. Please try again.');
      }

      const created = await response.json();
      setJob(created);
      let current = created;

      for (let i = 0; i < 90; i += 1) {
        if (current.status === 'COMPLETED' || current.status === 'FAILED') break;

        await new Promise((resolve) => setTimeout(resolve, 2000));
        const statusResponse = await fetch(`${API}/api/v1/generations/${created.id}`);

        if (!statusResponse.ok) {
          throw new Error('Could not check generation status. Please try again.');
        }

        current = await statusResponse.json();
        setJob(current);
      }

      if (current.status === 'FAILED') {
        throw new Error(current.message || 'Image generation failed. Please try again.');
      }
      if (current.status !== 'COMPLETED') {
        throw new Error('This is taking longer than expected. Please try again.');
      }

      setResultUrl(`${API}/api/v1/generations/${created.id}/image?t=${Date.now()}`);
      setPage('result');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
      setPage('camera');
    } finally {
      setBusy(false);
    }
  }

  async function downloadImage() {
    if (!resultUrl) return;

    try {
      const response = await fetch(resultUrl);
      if (!response.ok) throw new Error('Download failed.');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'my-future-self.png';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      window.open(resultUrl, '_blank', 'noopener,noreferrer');
    }
  }

  async function reset() {
    stopCamera();

    if (job?.id) {
      fetch(`${API}/api/v1/generations/${job.id}`, { method: 'DELETE' }).catch(() => {});
    }
    if (preview) URL.revokeObjectURL(preview);

    setPerson({ name: '', age: '', occupation: '' });
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

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="brand-lockup" onClick={reset} aria-label="360 Woman Africa home" type="button">
          <img
            src="/assets/360-banner.jpeg"
            alt="360 Woman Africa — Leadership, Entrepreneurship, Mentorship, Advocacy"
          />
        </button>
        <div className="event-tag"><span className="live-dot" /> CONFERENCE 2026</div>
      </header>

      {page !== 'welcome' && page !== 'generating' && (
        <div className="progress-wrap">
          <div className="progress-label">
            <span>YOUR JOURNEY</span><span>STEP {pageIndex + 1} OF 3</span>
          </div>
          <div className="progress-track">
            <div className="progress-value" style={{ width: `${((pageIndex + 1) / 3) * 100}%` }} />
          </div>
          <div className="progress-steps">
            {steps.map((step, index) => (
              <span key={step} className={index <= pageIndex ? 'active' : ''}>{step}</span>
            ))}
          </div>
        </div>
      )}

      <main>
        <AnimatePresence mode="wait">
          {page === 'welcome' && (
            <motion.section
              key="welcome"
              className="welcome-page"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <div className="hero-copy">
                <div className="eyebrow"><Sparkles size={15} /> YOUR FUTURE. YOUR POSSIBILITIES.</div>
                <h1>Meet the woman<br />you're <em>becoming.</em></h1>
                <p className="hero-description">
                  Your story is still unfolding. Step into a vision of your future self — confident,
                  accomplished, and ready to shape what comes next.
                </p>
                <button className="primary-btn" onClick={() => setPage('details')} type="button">
                  Begin your journey <ArrowRight size={19} />
                </button>
                <div className="trust-note"><LockKeyhole size={15} /> Your photo is processed to create your portrait.</div>
              </div>
              <div className="hero-art" aria-label="Illustration representing future possibilities">
                <div className="art-circle circle-one" /><div className="art-circle circle-two" />
                <div className="art-number">360<span>°</span></div>
                <div className="art-copy">A future<br /><b>without limits.</b></div>
                <div className="art-stamp">THE SHIFT<br /><span>2026</span></div>
                <div className="art-star star-a">✳</div><div className="art-star star-b">✦</div>
              </div>
              <div className="welcome-bottom">
                <span>360 WOMAN AFRICA</span>
                <span>LEADERSHIP · ENTREPRENEURSHIP · MENTORSHIP · ADVOCACY</span>
                <span>#360WomanAfricaconference2026</span>
              </div>
            </motion.section>
          )}

          {page === 'details' && (
            <motion.section
              key="details"
              className="content-page"
              initial={{ opacity: 0, x: 18 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
            >
              <button className="back-btn" onClick={() => setPage('welcome')} type="button">
                <ArrowLeft size={16} /> Back
              </button>
              <div className="section-heading">
                <span className="section-kicker">01 / A LITTLE ABOUT YOU</span>
                <h2>Every great future<br />starts with <em>you.</em></h2>
                <p>Tell us a little about yourself so we can imagine a future portrait that reflects your journey.</p>
              </div>
              <form
                className="details-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (canContinue) setPage('camera');
                }}
              >
                <label>
                  Full name <span>YOUR NAME</span>
                  <input
                    required
                    maxLength={100}
                    autoComplete="name"
                    placeholder="e.g. Amara Okafor"
                    value={person.name}
                    onChange={(event) => updatePerson('name', event.target.value)}
                  />
                </label>
                <label>
                  Age <span>YEARS</span>
                  <input
                    required
                    type="number"
                    min={18}
                    max={110}
                    placeholder="Enter your age (18+)"
                    value={person.age}
                    onChange={(event) => updatePerson('age', event.target.value)}
                  />
                </label>
                <label>
                  Occupation <span>WHAT YOU DO</span>
                  <input
                    required
                    maxLength={120}
                    placeholder="e.g. Entrepreneur, Teacher, Software Engineer"
                    value={person.occupation}
                    onChange={(event) => updatePerson('occupation', event.target.value)}
                  />
                </label>
                <div className="privacy-mini">
                  <LockKeyhole size={18} />
                  <p>Your name and details are sent to your backend to create the experience. Confirm your backend privacy practices before launch.</p>
                </div>
                <button className="primary-btn full-btn" type="submit" disabled={!canContinue}>
                  Continue to your photo <ArrowRight size={19} />
                </button>
              </form>
            </motion.section>
          )}

          {page === 'camera' && (
            <motion.section
              key="camera"
              className="content-page camera-page"
              initial={{ opacity: 0, x: 18 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
            >
              <button className="back-btn" onClick={() => { stopCamera(); setPage('details'); }} type="button">
                <ArrowLeft size={16} /> Back
              </button>
              <div className="section-heading">
                <span className="section-kicker">02 / YOUR PORTRAIT</span>
                <h2>Let's meet <em>you.</em></h2>
                <p>Choose a clear, front-facing photo with good lighting. Your face should be visible without filters or sunglasses.</p>
              </div>

              <div className="camera-layout">
                <div className="camera-frame">
                  {preview ? (
                    <img className="photo-preview" src={preview} alt="Your selected portrait" />
                  ) : cameraOn ? (
                    <video ref={videoRef} className="camera-video" autoPlay muted playsInline />
                  ) : (
                    <div className="camera-placeholder">
                      <div className="camera-icon"><Camera size={34} /></div>
                      <strong>Your portrait starts here</strong>
                      <span>Use your camera or upload a photo</span>
                    </div>
                  )}
                  {cameraOn && !preview && <div className="camera-guide" />}
                </div>

                <div className="camera-controls">
                  {preview ? (
                    <>
                      <div className="selected-badge"><Check size={16} /> PHOTO SELECTED</div>
                      <p>Happy with this photo? Continue to create your future-self portrait.</p>
                      <button
                        className="primary-btn full-btn"
                        type="button"
                        disabled={!consent || busy}
                        onClick={generate}
                      >
                        <WandSparkles size={18} />
                        {busy ? 'Generating your future self…' : 'Generate your future self'}
                      </button>
                      <button
                        className="secondary-btn full-btn"
                        type="button"
                        onClick={chooseAnotherPhoto}
                        disabled={busy}
                      >
                        Retake / choose another
                      </button>
                    </>
                  ) : (
                    <>
                      <button className="primary-btn full-btn" type="button" onClick={startCamera}>
                        <Camera size={18} /> Open camera
                      </button>
                      <button className="secondary-btn full-btn" type="button" onClick={() => fileRef.current?.click()}>
                        <Upload size={18} /> Upload a photo
                      </button>
                      <input
                        ref={fileRef}
                        type="file"
                        accept="image/*"
                        hidden
                        onChange={(event) => {
                          acceptPhoto(event.target.files?.[0]);
                          event.target.value = '';
                        }}
                      />
                    </>
                  )}

                  {cameraOn && !preview && (
                    <button className="capture-btn" type="button" onClick={capturePhoto}>
                      <span /> Capture photo
                    </button>
                  )}

                  {cameraError && <p className="inline-error" role="alert">{cameraError}</p>}
                  {error && <p className="inline-error" role="alert">{error}</p>}

                  <label className="consent-row">
                    <input
                      type="checkbox"
                      checked={consent}
                      onChange={(event) => {
                        setConsent(event.target.checked);
                        if (event.target.checked) setError('');
                      }}
                    />
                    <span>
                      I agree to have this photo processed by the AI service to create my future-self portrait.
                      I understand this is an AI-generated visualisation, not a prediction.
                    </span>
                  </label>
                  <div className="privacy-mini">
                    <LockKeyhole size={17} />
                    <p>Only continue if you agree. Review the event's privacy notice before public launch.</p>
                  </div>
                </div>
              </div>
            </motion.section>
          )}

          {page === 'generating' && (
            <motion.section
              key="generating"
              className="generating-page"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="loader-art">
                <div className="loader-ring ring-a" />
                <div className="loader-ring ring-b" />
                <Sparkles className="loader-spark" size={42} />
                <div className="loader-core">360</div>
              </div>
              <span className="section-kicker">YOUR NEXT CHAPTER</span>
              <h2>Imagining what's <em>possible.</em></h2>
              <p>We're creating a career-inspired vision of your future self. This can take a little while — please keep this page open.</p>
              <div className="loading-bar"><span /></div>
              <div className="loading-caption">
                <LoaderCircle size={16} className="spin" />
                {job?.status === 'PROCESSING' ? 'Creating your portrait…' : 'Preparing your portrait…'}
              </div>
              {error && (
                <div className="error-panel" role="alert">
                  <p>{error}</p>
                  <button className="secondary-btn" type="button" onClick={() => setPage('camera')}>Back to photo</button>
                </div>
              )}
            </motion.section>
          )}

          {page === 'result' && (
            <motion.section
              key="result"
              className="result-page"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="result-copy">
                <span className="section-kicker">YOUR NEXT CHAPTER STARTS HERE</span>
                <h2>Look at the woman<br />you're <em>becoming.</em></h2>
                <p>This is one inspiring possibility. Your future is yours to shape.</p>
                <div className="result-name">
                  <UserRound size={18} />
                  <div><strong>{person.name}</strong><span>{person.occupation}</span></div>
                </div>
                <button className="primary-btn full-btn" type="button" onClick={downloadImage}>
                  <Download size={18} /> Download your portrait
                </button>
                <button className="secondary-btn full-btn" type="button" onClick={() => { chooseAnotherPhoto(); setPage('camera'); }}>
                  Try another photo
                </button>
                <button className="text-btn" type="button" onClick={reset}>
                  <RefreshCw size={16} /> Start a new experience
                </button>
                <p className="disclaimer">AI-generated visualisation · Not a prediction of your actual future</p>
              </div>
              <div className="result-image-wrap">
                <div className="result-image-label"><Sparkles size={15} /> YOUR FUTURE SELF</div>
                <img src={resultUrl} alt={`AI-generated future-self portrait for ${person.name}`} />
                <div className="image-watermark">360 WOMAN AFRICA · 2026</div>
              </div>
            </motion.section>
          )}
        </AnimatePresence>
      </main>

      <footer className="footer">
        <span>© 2026 360 Woman Africa</span>
        <span>THE SHIFT: Designing Women’s Relevance in an AI-Intelligent World</span>
        <span>Made for possibility <span className="footer-star">✦</span></span>
      </footer>
    </div>
  );
}

export default App;
