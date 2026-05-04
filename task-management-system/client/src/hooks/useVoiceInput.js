  import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * useVoiceInput — thin wrapper around the browser's Web Speech API.
 *
 * Browser support: Chrome, Edge, Brave, Safari (with webkit prefix). Firefox
 * desktop ships it but disabled by default. Mobile: works on Android Chrome
 * and iOS Safari 14.5+.
 */
export default function useVoiceInput({ lang = 'en-IN', continuous = true } = {}) {
  const SpeechRecognition =
    typeof window !== 'undefined' &&
    (window.SpeechRecognition || window.webkitSpeechRecognition);

  const supported = !!SpeechRecognition;

  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [finalTranscript, setFinalTranscript] = useState('');
  const [error, setError] = useState(null);

  const recogRef = useRef(null);

  useEffect(() => {
    if (!supported) return;
    const r = new SpeechRecognition();
    r.lang = lang;
    r.continuous = continuous;
    r.interimResults = true;
    r.maxAlternatives = 1;

    r.onresult = (event) => {
      let interim = '';
      let final = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const text = event.results[i][0].transcript;
        if (event.results[i].isFinal) final += text;
        else interim += text;
      }
      if (final) setFinalTranscript((prev) => (prev + ' ' + final).trim());
      setTranscript((prev) => {
        const finalised = (prev.split('|INTERIM|')[0] + ' ' + final).trim();
        return interim ? `${finalised}|INTERIM|${interim}` : finalised;
      });
    };

    r.onerror = (e) => {
      setError(e.error || 'speech recognition error');
      setListening(false);
    };
    r.onend = () => setListening(false);

    recogRef.current = r;
    return () => {
      try { r.stop(); } catch { /* already stopped */ }
      recogRef.current = null;
    };
  }, [SpeechRecognition, supported, lang, continuous]);

  const start = useCallback(() => {
    if (!recogRef.current || listening) return;
    setError(null);
    setTranscript('');
    setFinalTranscript('');
    try {
      recogRef.current.start();
      setListening(true);
    } catch (e) {
      setError(e.message);
    }
  }, [listening]);

  const stop = useCallback(() => {
    if (!recogRef.current) return;
    try { recogRef.current.stop(); } catch { /* */ }
    setListening(false);
  }, []);

  const reset = useCallback(() => {
    setTranscript('');
    setFinalTranscript('');
    setError(null);
  }, []);

  const displayTranscript = transcript.replace('|INTERIM|', ' ');

  return {
    supported,
    listening,
    transcript: displayTranscript,
    finalTranscript,
    error,
    start,
    stop,
    reset,
  };
}
