import { useState, useRef, useEffect } from "react";
import { Assignment, Test, Submission, UserProfile } from "../types";
import { Send, User as UserIcon, Bot } from "lucide-react";
import { format, isThisWeek, isAfter, startOfToday } from "date-fns";

interface ChatbotProps {
  assignments: Assignment[];
  tests: Test[];
  submissions: Submission[];
  profile: UserProfile;
}

interface Message {
  id: string;
  text: string;
  sender: "user" | "bot";
}

export default function Chatbot({ assignments, tests, submissions, profile }: ChatbotProps) {
  const [messages, setMessages] = useState<Message[]>([
    { id: "1", text: `Hi ${profile.name}! I'm EduBot. How can I help you today?`, sender: "bot" }
  ]);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = () => {
    if (!input.trim()) return;

    const userMessage: Message = { id: Date.now().toString(), text: input, sender: "user" };
    setMessages(prev => [...prev, userMessage]);
    
    // Simple logic
    const botResponse = getBotResponse(input.toLowerCase());
    setTimeout(() => {
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), text: botResponse, sender: "bot" }]);
    }, 500);

    setInput("");
  };

  const getBotResponse = (query: string) => {
    if (query.includes("assignment") || query.includes("due")) {
      const activeAssignments = assignments.filter(a => {
        const isCompleted = submissions.some(s => s.assignmentId === a.id && s.status === 'completed');
        return !isCompleted && isAfter(new Date(a.dueDate), startOfToday());
      });

      if (activeAssignments.length === 0) return "You're all caught up! No active assignments due.";
      
      const list = activeAssignments
        .map(a => `- ${a.title} (${a.subject}) due ${format(new Date(a.dueDate), 'MMM d')}`)
        .join("\n");
      return `You have ${activeAssignments.length} assignments due:\n${list}`;
    }

    if (query.includes("test") || query.includes("exam")) {
      const upcomingTests = tests.filter(t => isAfter(new Date(t.date), startOfToday()));
      if (upcomingTests.length === 0) return "No upcoming tests found.";
      
      const nextTest = upcomingTests.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0];
      return `Your next test is "${nextTest.title}" for ${nextTest.subject} on ${format(new Date(nextTest.date), 'MMMM do')}. Good luck!`;
    }

    if (query.includes("point") || query.includes("score")) {
      return `You currently have ${profile.points || 0} points. Keep up the good work!`;
    }

    if (query.includes("hello") || query.includes("hi")) {
        return "Hello! I can tell you about your assignments, tests, or points. Just ask!";
    }

    return "I'm not sure I understand. I can help with assignments, tests, and your points! Try asking 'What is due this week?'";
  };

  return (
    <>
      <div ref={scrollRef} className="flex-1 p-4 overflow-y-auto space-y-4 bg-gray-50/50">
        {messages.map(m => (
          <div key={m.id} className={`flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] flex gap-2 ${m.sender === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${m.sender === 'user' ? 'bg-indigo-100 text-indigo-600' : 'bg-white text-gray-400 border border-gray-100 shadow-xs'}`}>
                {m.sender === 'user' ? <UserIcon size={14} /> : <Bot size={14} />}
              </div>
              <div className={`p-3 rounded-2xl text-sm whitespace-pre-wrap ${m.sender === 'user' ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-white border border-gray-100 shadow-xs text-gray-800 rounded-tl-none'}`}>
                {m.text}
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="p-3 bg-white border-t border-gray-100 flex gap-2">
        <input 
          type="text" 
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Ask EduBot..."
          className="flex-1 bg-gray-100 rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <button 
          onClick={handleSend}
          className="bg-indigo-600 text-white p-2 rounded-xl hover:bg-indigo-700"
        >
          <Send size={18} />
        </button>
      </div>
    </>
  );
}
