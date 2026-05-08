import React, { useState, useEffect, useRef } from "react";
import { Message, UserProfile } from "../types";
import { db } from "../firebase";
import { collection, query, where, onSnapshot, addDoc, orderBy, serverTimestamp } from "firebase/firestore";
import { Send, X, User } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn, formatDate } from "../lib/utils";

interface ChatProps {
  currentUser: UserProfile;
  otherUser: { uid: string; name: string; role: string };
  onClose: () => void;
}

export default function ChatWindow({ currentUser, otherUser, onClose }: ChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Query for messages where both users are participants
    const q = query(
      collection(db, "messages"),
      where("participants", "array-contains", currentUser.uid),
      orderBy("createdAt", "asc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Message))
        .filter(msg => msg.participants.includes(otherUser.uid)); // Filter specifically for this conversation
      setMessages(msgs);
    });

    return () => unsubscribe();
  }, [currentUser.uid, otherUser.uid]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const text = inputText.trim();
    setInputText("");

    try {
      await addDoc(collection(db, "messages"), {
        senderId: currentUser.uid,
        receiverId: otherUser.uid,
        text,
        participants: [currentUser.uid, otherUser.uid],
        createdAt: serverTimestamp()
      });

      // Create notification for receiver
      await addDoc(collection(db, "notifications"), {
        userId: otherUser.uid,
        message: `New message from ${currentUser.name}: ${text.slice(0, 50)}${text.length > 50 ? '...' : ''}`,
        read: false,
        createdAt: new Date().toISOString(),
        type: 'message',
        senderId: currentUser.uid
      });
    } catch (err) {
      console.error("Failed to send message", err);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.95 }}
      className="fixed bottom-6 right-6 w-80 h-[450px] bg-white rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-gray-100 z-50"
    >
      {/* Header */}
      <div className="p-4 bg-indigo-600 text-white flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center font-bold text-xs">
            {otherUser.name.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <p className="font-bold text-sm leading-none">{otherUser.name}</p>
            <p className="text-[10px] text-indigo-200 mt-1 uppercase tracking-wider">{otherUser.role}</p>
          </div>
        </div>
        <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-lg transition-colors">
          <X size={20} />
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50 scroll-smooth">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-4">
             <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center mb-2">
                <User className="text-gray-400" size={24} />
             </div>
             <p className="text-xs text-gray-400">Start a conversation with {otherUser.name}</p>
          </div>
        ) : (
          messages.map((msg, idx) => {
            const isMe = msg.senderId === currentUser.uid;
            return (
              <div key={msg.id || idx} className={cn("flex flex-col", isMe ? "items-end" : "items-start")}>
                <div className={cn(
                  "max-w-[80%] p-3 rounded-2xl text-sm shadow-sm",
                  isMe ? "bg-indigo-600 text-white rounded-br-none" : "bg-white text-gray-800 rounded-bl-none border border-gray-100"
                )}>
                  {msg.text}
                </div>
                <span className="text-[10px] text-gray-400 mt-1 px-1">
                   {msg.createdAt ? formatDate(new Date((msg.createdAt as any).seconds * 1000).toISOString()) : 'Sending...'}
                </span>
              </div>
            );
          })
        )}
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="p-4 bg-white border-t border-gray-100 flex gap-2">
        <input 
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 bg-gray-100 rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium"
        />
        <button 
          type="submit"
          className="p-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-50"
          disabled={!inputText.trim()}
        >
          <Send size={18} />
        </button>
      </form>
    </motion.div>
  );
}
