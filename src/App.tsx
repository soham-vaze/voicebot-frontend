// import { useState, useRef, useEffect } from "react";

// type Message = {
//   sender: "user" | "bot";
//   text: string;
//   timestamp?: Date;
// };

// type Status = "Idle" | "Listening" | "Processing" | "Speaking" | "Error";

// function App() {
//   const [isCalling, setIsCalling] = useState(false);
//   const [status, setStatus] = useState<Status>("Idle");
//   const [messages, setMessages] = useState<Message[]>([]);

//   const mediaRecorderRef = useRef<MediaRecorder | null>(null);
//   const chatEndRef = useRef<HTMLDivElement | null>(null);

//   const audioContextRef = useRef<AudioContext | null>(null);
//   const analyserRef = useRef<AnalyserNode | null>(null);
//   const streamRef = useRef<MediaStream | null>(null);
//   const isCallingRef = useRef(false);

//   const notificationAudioRef = useRef<HTMLAudioElement | null>(null);
//   const isFinalizingRef = useRef(false);

//   // 🔥 Chunk state
//   const chunkStartTimeRef = useRef<number | null>(null);
//   const lastSpeechTimeRef = useRef<number | null>(null);
//   const speechDetectedRef = useRef(false);
//   const chunkBufferRef = useRef<Blob[]>([]);

//   useEffect(() => {
//     notificationAudioRef.current = new Audio("/sample.mp3");
//   }, []);

//   useEffect(() => {
//     chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
//   }, [messages]);

//   // 🚀 START CALL
//   const startCall = async () => {
//     isCallingRef.current = true;
//     setIsCalling(true);
//     setStatus("Listening");

//     try {
//       const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
//       streamRef.current = stream;
//       startStreaming(stream);
//     } catch (err) {
//       console.error(err);
//       setStatus("Error");
//     }
//   };

//   // 🚀 STREAMING MODE
//   const startStreaming = (stream: MediaStream) => {
//     const mediaRecorder = new MediaRecorder(stream);
//     mediaRecorderRef.current = mediaRecorder;

//     mediaRecorder.start(); // 1 sec small chunks

//     resetChunk();

//     // mediaRecorder.ondataavailable = (event) => {
//     //   if (event.data.size > 0) {
//     //     chunkBufferRef.current.push(event.data);
//     //   }
//     // };
//     mediaRecorder.ondataavailable = (event) => {
//       if (event.data.size > 0) {
//         console.log("📦 Clean chunk received:", event.data.size);
//         sendAudioChunk(event.data); // ✅ DIRECT send
//       }
//     };

//     // 🎧 VAD setup
//     const audioContext = new AudioContext();
//     const source = audioContext.createMediaStreamSource(stream);
//     const analyser = audioContext.createAnalyser();

//     analyser.fftSize = 1024;
//     source.connect(analyser);

//     audioContextRef.current = audioContext;
//     analyserRef.current = analyser;

//     detectSilence();
//   };

//   const resetChunk = () => {
//     console.log("🔄 New chunk started");

//     chunkStartTimeRef.current = Date.now();
//     lastSpeechTimeRef.current = null;
//     speechDetectedRef.current = false;
//     chunkBufferRef.current = [];
//   };

//   // 🎧 WAV ENCODER (16kHz MONO)
//   const encodeWAV = (audioBuffer: AudioBuffer) => {
//     const sampleRate = 16000;
//     const numChannels = 1;

//     const input = audioBuffer.getChannelData(0);

//     const length = input.length * 2;
//     const buffer = new ArrayBuffer(44 + length);
//     const view = new DataView(buffer);

//     let offset = 0;

//     const writeString = (s: string) => {
//       for (let i = 0; i < s.length; i++) {
//         view.setUint8(offset++, s.charCodeAt(i));
//       }
//     };

//     writeString("RIFF");
//     view.setUint32(offset, 36 + length, true); offset += 4;
//     writeString("WAVE");
//     writeString("fmt ");
//     view.setUint32(offset, 16, true); offset += 4;
//     view.setUint16(offset, 1, true); offset += 2;
//     view.setUint16(offset, numChannels, true); offset += 2;
//     view.setUint32(offset, sampleRate, true); offset += 4;
//     view.setUint32(offset, sampleRate * 2, true); offset += 4;
//     view.setUint16(offset, 2, true); offset += 2;
//     view.setUint16(offset, 16, true); offset += 2;
//     writeString("data");
//     view.setUint32(offset, length, true); offset += 4;

//     for (let i = 0; i < input.length; i++) {
//       let sample = Math.max(-1, Math.min(1, input[i]));
//       view.setInt16(offset, sample * 0x7fff, true);
//       offset += 2;
//     }

//     return buffer;
//   };

//   const convertToWav = async (blob: Blob): Promise<Blob> => {
//     const arrayBuffer = await blob.arrayBuffer();
//     const audioContext = new AudioContext();
//     const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

//     const wavBuffer = encodeWAV(audioBuffer);
//     return new Blob([wavBuffer], { type: "audio/wav" });
//   };

//   // const finalizeChunk = async () => {
//   //   if (isFinalizingRef.current) return;
//   //   isFinalizingRef.current = true;

//   //   if (chunkBufferRef.current.length === 0) {
//   //     isFinalizingRef.current = false;
//   //     return;
//   //   }

//   //   if (!speechDetectedRef.current) {
//   //     console.log("🚫 No speech → skip");
//   //     resetChunk();
//   //     isFinalizingRef.current = false;
//   //     return;
//   //   }

//   //   const webmBlob = new Blob(chunkBufferRef.current, {
//   //     type: "audio/webm",
//   //   });

//   //   console.log("📦 Raw size:", webmBlob.size);

//   //   try {
//   //     const wavBlob = await convertToWav(webmBlob);

//   //     console.log("🎧 WAV size:", wavBlob.size);

//   //     if (wavBlob.size < 2000) {
//   //       console.log("🚫 Dropping tiny chunk:", wavBlob.size);
//   //       resetChunk();
//   //       isFinalizingRef.current = false;
//   //       return;
//   //     }

//   //     await sendAudioChunk(wavBlob);
//   //   } catch (err) {
//   //     console.error("❌ WAV conversion failed:", err);
//   //   }

//   //   resetChunk();
//   //   isFinalizingRef.current = false;
//   // };
  
//   const finalizeChunk = () => {
//     console.log("✂️ Requesting chunk flush");
//     mediaRecorderRef.current?.requestData();
//   };

//   // 🎤 VAD LOOP
//   const detectSilence = () => {
//     const analyser = analyserRef.current;
//     if (!analyser) return;

//     const dataArray = new Uint8Array(analyser.fftSize);
//     let smoothedVolume = 0;

//     const checkVolume = () => {
//       analyser.getByteTimeDomainData(dataArray);

//       let sum = 0;
//       for (let i = 0; i < dataArray.length; i++) {
//         const value = (dataArray[i] - 128) / 128;
//         sum += value * value;
//       }

//       const volume = Math.sqrt(sum / dataArray.length);
//       smoothedVolume = 0.8 * smoothedVolume + 0.2 * volume;

//       const SPEECH_THRESHOLD = 0.03;
//       const now = Date.now();

//       const chunkStart = chunkStartTimeRef.current!;
//       const lastSpeech = lastSpeechTimeRef.current;

//       if (smoothedVolume > SPEECH_THRESHOLD) {
//         speechDetectedRef.current = true;
//         lastSpeechTimeRef.current = now;
//       }

//       // ✅ 30 sec max
//       if (now - chunkStart >= 30000) {
//         console.log("⏱ 30s reached");
//         finalizeChunk();
//       }

//       // ✅ 5 sec silence
//       if (
//         speechDetectedRef.current &&
//         lastSpeech &&
//         now - lastSpeech > 5000
//       ) {
//         console.log("🤫 Silence → finalize");
//         finalizeChunk();
//       }

//       // ✅ no speech in 5 sec
//       if (!speechDetectedRef.current && now - chunkStart > 5000) {
//         console.log("🚫 No speech → reset");
//         resetChunk();
//       }

//       if (isCallingRef.current) {
//         requestAnimationFrame(checkVolume);
//       }
//     };

//     checkVolume();
//   };

//   // 🚀 SEND CHUNK
//   const sendAudioChunk = async (audioBlob: Blob) => {
//     const formData = new FormData();
//     formData.append("file", audioBlob, "chunk.wav");

//     try {
//       setStatus("Processing");

//       console.log("🚀 Sending:", audioBlob.size);

//       const response = await fetch(
//         "http://localhost:5292/api/voice/process",
//         {
//           method: "POST",
//           body: formData,
//         }
//       );

//       if (!response.ok) {
//         const errText = await response.text();
//         console.error("❌ Backend error:", errText);
//         setStatus("Listening");
//         return;
//       }

//       const data = await response.json();

//       notificationAudioRef.current?.play().catch(() => {});

//       if (data.audioBase64) {
//         const audio = new Audio(
//           `data:audio/wav;base64,${data.audioBase64}`
//         );

//         setStatus("Speaking");
//         audio.play();

//         audio.onended = () => setStatus("Listening");
//       } else {
//         setStatus("Listening");
//       }

//       setMessages((prev) => [
//         ...prev,
//         { sender: "user", text: "User spoke...", timestamp: new Date() },
//         { sender: "bot", text: data.text, timestamp: new Date() },
//       ]);
//     } catch (err) {
//       console.error("❌ API error:", err);
//       setStatus("Listening"); // 🔥 NEVER STUCK IN ERROR
//     }
//   };

//   // 🚀 STOP CALL
//   const endCall = () => {
//     isCallingRef.current = false;
//     setIsCalling(false);
//     setStatus("Idle");

//     mediaRecorderRef.current?.stop();
//     audioContextRef.current?.close();

//     streamRef.current?.getTracks().forEach((t) => t.stop());
//   };

//   return (
//     <div className="h-screen flex flex-col text-white bg-slate-900">
//       <div className="p-6 text-center">
//         <h1 className="text-2xl font-bold">Voice Assistant</h1>

//         <button
//           onClick={() => (isCalling ? endCall() : startCall())}
//           className={`w-20 h-20 text-3xl rounded-full ${
//             isCalling ? "bg-red-500" : "bg-blue-500"
//           }`}
//         >
//           {isCalling ? "⏹️" : "🎤"}
//         </button>

//         <p className="mt-2">{status}</p>
//       </div>

//       <div className="flex-1 overflow-y-auto p-4">
//         {messages.map((m, i) => (
//           <div key={i} className="bg-slate-700 p-2 mb-2 rounded">
//             {m.sender}: {m.text}
//           </div>
//         ))}
//         <div ref={chatEndRef} />
//       </div>
//     </div>
//   );
// }

// export default App;



//new code

import { useState, useRef, useEffect } from "react";

type Message = {
  sender: "user" | "bot";
  text: string;
};

type Status = "Idle" | "Listening" | "Processing" | "Speaking";

function App() {
  const [isCalling, setIsCalling] = useState(false);
  const [status, setStatus] = useState<Status>("Idle");
  const [messages, setMessages] = useState<Message[]>([]);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const isCallingRef = useRef(false);
  const isProcessingRef = useRef(false);

  const chatEndRef = useRef<HTMLDivElement | null>(null);

  // Inside your App component
  const [sessionId, setSessionId] = useState<string | null>(null);
  const sessionIdRef = useRef<string | null>(null); // For immediate access in async loops

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // 🚀 START CALL
  const startCall = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const newSessionId = crypto.randomUUID();
      setSessionId(newSessionId);
      sessionIdRef.current = newSessionId;

      streamRef.current = stream;
      isCallingRef.current = true;

      setIsCalling(true);
      setStatus("Listening");

      startRecording(stream);
    } catch (err) {
      console.error(err);
      setStatus("Idle");
    }
  };

  // 🚀 RECORD USER SPEECH (VAD based)
  const startRecording = (stream: MediaStream) => {
    if (isProcessingRef.current) return;

    const mediaRecorder = new MediaRecorder(stream, {
      mimeType: "audio/webm",
    });

    mediaRecorderRef.current = mediaRecorder;

    const chunks: Blob[] = [];

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    mediaRecorder.onstop = async () => {
      if (chunks.length === 0) {
        restartListening();
        return;
      }

      const webmBlob = new Blob(chunks, { type: "audio/webm" });

      try {
        const wavBlob = await convertToWav(webmBlob);

        if (wavBlob.size < 2000) {
          console.log("🚫 Dropping small chunk");
          restartListening();
          return;
        }

        await sendAudioChunk(wavBlob);
      } catch (err) {
        console.error("❌ Conversion failed:", err);
        restartListening();
      }
    };

    mediaRecorder.start();

    // 🎧 VAD (Silence detection)
    const audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();

    analyser.fftSize = 1024;
    source.connect(analyser);

    const dataArray = new Uint8Array(analyser.fftSize);

    let lastSpeechTime = Date.now();
    let smoothedVolume = 0;

    const checkSilence = () => {
      if (!isCallingRef.current || isProcessingRef.current) return;

      analyser.getByteTimeDomainData(dataArray);

      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        const val = (dataArray[i] - 128) / 128;
        sum += val * val;
      }

      const volume = Math.sqrt(sum / dataArray.length);
      smoothedVolume = 0.8 * smoothedVolume + 0.2 * volume;

      const now = Date.now();

      const SPEECH_THRESHOLD = 0.3;
      const SILENCE_TIME = 5000; // 🔥 silence duration

      if (smoothedVolume > SPEECH_THRESHOLD) {
        lastSpeechTime = now;
      }

      // 🤫 Stop on silence
      if (now - lastSpeechTime > SILENCE_TIME) {
        if (mediaRecorder.state === "recording") {
          console.log("🤫 Silence detected → stop recording");
          mediaRecorder.stop();
          return;
        }
      }

      requestAnimationFrame(checkSilence);
    };

    checkSilence();
  };

  // 🔁 Restart listening
  const restartListening = () => {
    if (!isCallingRef.current || !streamRef.current) return;

    isProcessingRef.current = false;
    setStatus("Listening");

    startRecording(streamRef.current);
  };

  // 🎧 Convert WebM → WAV
  const convertToWav = async (blob: Blob): Promise<Blob> => {
    const arrayBuffer = await blob.arrayBuffer();

    const audioContext = new AudioContext();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    const sampleRate = 16000;
    const offlineCtx = new OfflineAudioContext(
      1,
      audioBuffer.duration * sampleRate,
      sampleRate
    );

    const source = offlineCtx.createBufferSource();
    source.buffer = audioBuffer;

    const splitter = offlineCtx.createChannelSplitter(audioBuffer.numberOfChannels);
    const merger = offlineCtx.createChannelMerger(1);

    source.connect(splitter);
    splitter.connect(merger, 0, 0);
    merger.connect(offlineCtx.destination);

    source.start(0);

    const rendered = await offlineCtx.startRendering();

    return encodeWAV(rendered);
  };

  // 🎧 Encode WAV
  const encodeWAV = (buffer: AudioBuffer): Blob => {
    const channelData = buffer.getChannelData(0);
    const sampleRate = buffer.sampleRate;

    const length = channelData.length * 2;
    const arrayBuffer = new ArrayBuffer(44 + length);
    const view = new DataView(arrayBuffer);

    let offset = 0;

    const writeString = (str: string) => {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(offset++, str.charCodeAt(i));
      }
    };

    writeString("RIFF");
    view.setUint32(offset, 36 + length, true); offset += 4;
    writeString("WAVE");
    writeString("fmt ");
    view.setUint32(offset, 16, true); offset += 4;
    view.setUint16(offset, 1, true); offset += 2;
    view.setUint16(offset, 1, true); offset += 2;
    view.setUint32(offset, sampleRate, true); offset += 4;
    view.setUint32(offset, sampleRate * 2, true); offset += 4;
    view.setUint16(offset, 2, true); offset += 2;
    view.setUint16(offset, 16, true); offset += 2;
    writeString("data");
    view.setUint32(offset, length, true); offset += 4;

    for (let i = 0; i < channelData.length; i++) {
      let sample = Math.max(-1, Math.min(1, channelData[i]));
      view.setInt16(offset, sample * 0x7fff, true);
      offset += 2;
    }

    return new Blob([arrayBuffer], { type: "audio/wav" });
  };

  // 🚀 SEND AUDIO
  const sendAudioChunk = async (audioBlob: Blob) => {
    isProcessingRef.current = true;
    setStatus("Processing");

    const formData = new FormData();
    formData.append("file", audioBlob, "chunk.wav");

    if (sessionIdRef.current) {
      formData.append("sessionId", sessionIdRef.current);
    }

    try {
      const response = await fetch(
        "https://assure-detect-rapidly-jumping.trycloudflare.com/api/voice/process",
        {
          method: "POST",
          body: formData,
        }
      );

      if (!response.ok) {
        console.error(await response.text());
        restartListening();
        return;
      }

      const data = await response.json();
      console.log("data received",data)
      if (data.audioBase64) {
        const audio = new Audio(`data:audio/wav;base64,${data.audioBase64}`);

        setStatus("Speaking");  
        audio.play();

        audio.onended = () => restartListening();
      } else {
        restartListening();
      }

      setMessages((prev) => [
        ...prev,
        { sender: "user", text: data.query },
        { sender: "bot", text: data.text },
      ]);
    } catch (err) {
      console.error(err);
      restartListening();
    }
  };

  // 🚀 STOP CALL
  const endCall = () => {
    isCallingRef.current = false;
    setIsCalling(false);
    setStatus("Idle");

    setSessionId(null);
    sessionIdRef.current = null;

    mediaRecorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
  };

  return (
    <div className="h-screen flex flex-col text-white bg-slate-900">
      <div className="p-6 text-center">
        <h1 className="text-2xl font-bold">Voice Assistant</h1>

        <button
          onClick={() => (isCalling ? endCall() : startCall())}
          className={`w-20 h-20 text-3xl rounded-full ${
            isCalling ? "bg-red-500" : "bg-blue-500"
          }`}
        >
          {isCalling ? "⏹️" : "🎤"}
        </button>

        <p className="mt-2">{status}</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {messages.map((m, i) => (
          <div key={i} className="bg-slate-700 p-2 mb-2 rounded">
            {m.sender}: {m.text}
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>
    </div>
  );
}

export default App;
