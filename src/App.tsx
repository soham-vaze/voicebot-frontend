import { useState, useRef, useEffect } from "react";

type Message = {
  sender: "user" | "bot";
  text: string;
  timestamp?: Date;
};

function App() {
  const [isCalling, setIsCalling] = useState(false);
  const [status, setStatus] = useState("Idle");
  const [messages, setMessages] = useState<Message[]>([]);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  // Auto scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const startCall = async () => {
    setIsCalling(true);
    setStatus("Listening");

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mediaRecorder = new MediaRecorder(stream);

    mediaRecorderRef.current = mediaRecorder;
    audioChunksRef.current = [];

    mediaRecorder.ondataavailable = (event) => {
      audioChunksRef.current.push(event.data);
    };

    mediaRecorder.onstop = handleSendAudio;
    mediaRecorder.start();
  };

  const endCall = () => {
    setIsCalling(false);
    setStatus("Processing");
    mediaRecorderRef.current?.stop();
  };

  const handleSendAudio = async () => {
    const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });

    const formData = new FormData();
    formData.append("file", audioBlob, "recording.webm");

    try {
      const response = await fetch("http://localhost:5292/api/voice/process", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      setStatus("Idle");

      setMessages((prev) => [
        ...prev,
        {
          sender: "user",
          text: "User spoke something...",
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

  const statusConfig = {
    Idle: { color: "bg-slate-500", label: "Ready", icon: "○" },
    Listening: { color: "bg-green-500", label: "Listening", icon: "🎙️" },
    Processing: { color: "bg-amber-500", label: "Processing", icon: "⏳" },
    Speaking: { color: "bg-blue-500", label: "Speaking", icon: "🔊" },
    Error: { color: "bg-red-500", label: "Error", icon: "❌" },
  }[status];

  return (
    <div className="h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white flex flex-col">
      {/* Header with Mic Button */}
      <div className="border-b border-slate-700 px-4 sm:px-6 py-6 flex flex-col items-center justify-center gap-4 bg-slate-900/50 sticky top-0 z-10">
        <h1 className="text-2xl font-bold">Voice Assistant</h1>
        
        {/* Microphone Button - Top */}
        <div className="flex flex-col items-center">
          {isCalling && (
            <div className="absolute w-32 h-32 rounded-full bg-green-400 opacity-5 animate-pulse" />
          )}
          <button
            onClick={isCalling ? endCall : startCall}
            className={`relative w-20 h-20 rounded-full flex items-center justify-center text-4xl font-bold transition-all duration-200 shadow-2xl hover:scale-110 active:scale-95 ${
              isCalling
                ? "bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700"
                : "bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700"
            }`}
          >
            {isCalling ? "⏹️" : "🎤"}
          </button>
          <p className="mt-3 text-sm font-medium text-slate-300">
            {isCalling ? "Tap to stop" : "Tap to speak"}
          </p>
        </div>

        {/* Status Badge */}
        <div className="flex items-center gap-2">
          <div className={`h-2.5 w-2.5 rounded-full ${statusConfig?.color}`} />
          <span className="text-xs font-medium text-slate-300">{statusConfig?.label}</span>
        </div>
      </div>

      {/* Chat Container */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-8 space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <div className="text-6xl mb-6 opacity-80">🎙️</div>
            <h2 className="text-3xl font-bold text-white mb-3">
              Start a Conversation
            </h2>
            <p className="text-slate-400 max-w-sm text-lg">
              Press the microphone button above and start speaking to chat with the voice assistant.
            </p>
          </div>
        ) : (
          messages.map((msg, index) => (
            <div
              key={index}
              className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"} animate-in fade-in slide-in-from-bottom-2`}
            >
              <div
                className={`max-w-xs sm:max-w-md lg:max-w-lg px-4 py-3 rounded-2xl ${
                  msg.sender === "user"
                    ? "bg-blue-600 text-white rounded-br-none shadow-lg"
                    : "bg-slate-700 text-slate-50 rounded-bl-none shadow-lg"
                }`}
              >
                <p className="text-sm sm:text-base leading-relaxed break-words">
                  {msg.text}
                </p>
              </div>
            </div>
          ))
        )}

        {/* Status Messages */}
        <div className="flex justify-center pt-4">
          {isCalling && (
            <div className="text-center">
              <p className="text-sm text-green-400 font-medium animate-pulse">
                🎧 Listening... Speak now
              </p>
            </div>
          )}

          {status === "Processing" && (
            <div className="text-center">
              <p className="text-sm text-amber-400 font-medium">
                ⏳ Processing your request...
              </p>
            </div>
          )}

          {status === "Speaking" && (
            <div className="text-center">
              <p className="text-sm text-cyan-400 font-medium">
                🔊 Playing response...
              </p>
            </div>
          )}

          {status === "Error" && (
            <div className="text-center">
              <p className="text-sm text-red-400 font-medium">
                ❌ Something went wrong. Try again.
              </p>
            </div>
          )}
        </div>

        <div ref={chatEndRef} />
      </div>
    </div>
  );
}

export default App;
