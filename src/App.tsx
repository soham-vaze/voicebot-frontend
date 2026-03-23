import { useState, useRef, useEffect } from "react";

type Message = {
  sender: "user" | "bot";
  text: string;
  timestamp?: Date;
};

type Status = "Idle" | "Listening" | "Processing" | "Speaking" | "Error";

function App() {
  const [isCalling, setIsCalling] = useState(false);
  const [status, setStatus] = useState<Status>("Idle");
  const [messages, setMessages] = useState<Message[]>([]);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const silenceTimerRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const isCallingRef = useRef(false);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // 🚀 START CALL
  const startCall = async () => {
    isCallingRef.current = true;
    setIsCalling(true);
    setStatus("Listening");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      startStreaming(stream);
    } catch (err) {
      console.error(err);
      setStatus("Error");
    }
  };

  // 🚀 STREAMING MODE (continuous recording)
  const startStreaming = (stream: MediaStream) => {
    const mediaRecorder = new MediaRecorder(stream);
    mediaRecorderRef.current = mediaRecorder;

    // 🔥 KEY: continuous chunks every 1 sec
    mediaRecorder.start(30000);

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        sendAudioChunk(event.data); // 🔥 send continuously
      }
    };

    // 🎧 VAD setup
    const audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();

    analyser.fftSize = 1024;
    source.connect(analyser);

    audioContextRef.current = audioContext;
    analyserRef.current = analyser;

    detectSilence();
  };

  // 🚀 VAD (only triggers chunk request, DOES NOT STOP RECORDING)
  const detectSilence = () => {
    const analyser = analyserRef.current;
    if (!analyser) return;

    const dataArray = new Uint8Array(analyser.fftSize);

    // 🔥 NEW STATE VARIABLES
    let smoothedVolume = 0;
    let isSpeaking = false;
    let speechStartTime: number | null = null;

    const checkVolume = () => {
      analyser.getByteTimeDomainData(dataArray);

      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        const value = (dataArray[i] - 128) / 128;
        sum += value * value;
      }

      const volume = Math.sqrt(sum / dataArray.length);

      // 🔥 SMOOTHING (reduces noise spikes)
      smoothedVolume = 0.8 * smoothedVolume + 0.2 * volume;

      console.log("Raw:", volume, "Smoothed:", smoothedVolume);

      // 🔥 HYSTERESIS THRESHOLDS
      const SPEECH_THRESHOLD = 0.03;
      const SILENCE_THRESHOLD = 0.015;

      // 🔥 TIMING
      const SILENCE_DURATION = 2000;
      const MIN_SPEECH_TIME = 300;

      const now = Date.now();

      // 🎤 Detect speech start
      if (!isSpeaking && smoothedVolume > SPEECH_THRESHOLD) {
        isSpeaking = true;
        speechStartTime = now;
        console.log("Speech started");
      }

      // 🤫 Detect silence AFTER speech
      if (isSpeaking && smoothedVolume < SILENCE_THRESHOLD) {
        const speechDuration = speechStartTime ? now - speechStartTime : 0;

        if (speechDuration > MIN_SPEECH_TIME) {
          if (!silenceTimerRef.current) {
            silenceTimerRef.current = window.setTimeout(() => {
              console.log("Silence detected → forcing chunk");

              mediaRecorderRef.current?.requestData();

              isSpeaking = false;
              speechStartTime = null;
            }, SILENCE_DURATION);
          }
        }
      } else {
        // Reset silence timer if speech resumes
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = null;
        }
      }

      if (isCallingRef.current) {
        requestAnimationFrame(checkVolume);
      }
    };

    checkVolume();
  };
  // 🚀 SEND AUDIO CHUNK (parallel processing)
  const sendAudioChunk = async (audioBlob: Blob) => {
    const formData = new FormData();
    formData.append("file", audioBlob, "chunk.webm");

    try {
      setStatus("Processing");

      const response = await fetch(
        "http://localhost:5292/api/voice/process",
        {
          method: "POST",
          body: formData,
        }
      );

      const data = await response.json();

      // 🔊 PLAY RESPONSE (non-blocking)
      if (data.audioBase64 && data.audioBase64.length > 0) {
        const audio = new Audio(
          `data:audio/wav;base64,${data.audioBase64}`
        );

        setStatus("Speaking");
        audio.play();

        audio.onended = () => {
          setStatus("Listening"); // 🔥 continue listening
        };
      } else {
        setStatus("Listening");
      }

      // 💬 Update chat
      setMessages((prev) => [
        ...prev,
        {
          sender: "user",
          text: "User spoke...",
          timestamp: new Date(),
        },
        {
          sender: "bot",
          text: data.text,
          timestamp: new Date(),
        },
      ]);
    } catch (err) {
      console.error(err);
      setStatus("Error");
    }
  };

  // 🚀 STOP CALL
  const endCall = () => {
    console.log("Ending session");

    isCallingRef.current = false;
    setIsCalling(false);
    setStatus("Idle");

    mediaRecorderRef.current?.stop();

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  const statusConfig: Record<Status, { color: string; label: string }> = {
    Idle: { color: "bg-slate-500", label: "Ready" },
    Listening: { color: "bg-green-500", label: "Listening" },
    Processing: { color: "bg-amber-500", label: "Processing" },
    Speaking: { color: "bg-blue-500", label: "Speaking" },
    Error: { color: "bg-red-500", label: "Error" },
  };

  return (
    <div className="h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white flex flex-col">
      <div className="border-b border-slate-700 px-6 py-6 flex flex-col items-center gap-4">
        <h1 className="text-2xl font-bold">Voice Assistant</h1>

        <button
          onClick={() => {
            if (!isCalling) startCall();
            else endCall();
          }}
          className={`w-20 h-20 rounded-full text-4xl ${
            isCalling ? "bg-red-500" : "bg-blue-500"
          }`}
        >
          {isCalling ? "⏹️" : "🎤"}
        </button>

        <div className="flex items-center gap-2">
          <div className={`h-2 w-2 rounded-full ${statusConfig[status].color}`} />
          <span>{statusConfig[status].label}</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.map((msg, i) => (
          <div key={i} className="flex">
            <div className="bg-slate-700 p-3 rounded-xl">
              {msg.sender}: {msg.text}
            </div>
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>
    </div>
  );
}

export default App;