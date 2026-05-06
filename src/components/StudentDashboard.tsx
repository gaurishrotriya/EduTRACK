import React, { useState, useEffect } from "react";
import { UserProfile, Assignment, Submission, Category, Test, RevisionItem, Class } from "../types";
import { db } from "../firebase";
import { collection, onSnapshot, query, where, doc, setDoc, updateDoc, getDoc, arrayUnion } from "firebase/firestore";
import { Calendar as CalendarIcon, CheckCircle2, Circle, Clock, MessageSquare, Trophy, Filter, Star, School, LayoutDashboard, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn, formatDate } from "../lib/utils";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import Chatbot from "./Chatbot";
import ChatWindow from "./ChatWindow";

interface StudentDashboardProps {
  profile: UserProfile;
}

export default function StudentDashboard({ profile }: StudentDashboardProps) {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'messages'>('dashboard');
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tests, setTests] = useState<Test[]>([]);
  const [leaderboard, setLeaderboard] = useState<UserProfile[]>([]);
  const [classStandings, setClassStandings] = useState<{name: string, points: number}[]>([]);
  const [teachers, setTeachers] = useState<UserProfile[]>([]);
  
  const [filter, setFilter] = useState<string>("all");
  const [date, setDate] = useState(new Date());
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [messagingTeacher, setMessagingTeacher] = useState<UserProfile | null>(null);
  const [revisionItems, setRevisionItems] = useState<RevisionItem[]>([]);

  useEffect(() => {
    // Real-time listeners
    const unsubA = onSnapshot(query(collection(db, "assignments"), where("classId", "==", profile.classId)), (snap) => {
      setAssignments(snap.docs.map(d => ({ id: d.id, ...d.data() } as Assignment)));
    });
    const unsubR = onSnapshot(collection(db, "revisionItems"), (snap) => {
      setRevisionItems(snap.docs.map(d => ({ id: d.id, ...d.data() } as RevisionItem)));
    });
    const unsubS = onSnapshot(query(collection(db, "submissions"), where("studentId", "==", profile.uid)), (snap) => {
      setSubmissions(snap.docs.map(d => ({ id: d.id, ...d.data() } as Submission)));
    });
    const unsubC = onSnapshot(collection(db, "categories"), (snap) => {
      setCategories(snap.docs.map(d => ({ id: d.id, ...d.data() } as Category)));
    });
    const unsubL = onSnapshot(collection(db, "users"), (snap) => {
      const users = snap.docs.map(d => d.data() as UserProfile);
      setLeaderboard(users.sort((a, b) => (b.points || 0) - (a.points || 0)).slice(0, 5));

      // Aggregate class standings
      onSnapshot(collection(db, "classes"), (cSnap) => {
          const classesData = cSnap.docs.map(d => ({id: d.id, ...d.data()} as Class));
          const standings = classesData.map(c => {
             const classUsers = users.filter(u => u.classId === c.id);
             const userPoints = classUsers.reduce((sum, u) => sum + (u.points || 0), 0);
             return { name: c.name, points: userPoints };
          }).sort((a,b) => b.points - a.points);
          setClassStandings(standings);
      });

      // Find teachers
      setTeachers(users.filter(u => u.role === 'teacher'));
    });
    const unsubT = onSnapshot(collection(db, "tests"), (snap) => {
      setTests(snap.docs.map(d => ({ id: d.id, ...d.data() } as Test)));
    });

    return () => { unsubA(); unsubS(); unsubC(); unsubL(); unsubT(); unsubR(); };
  }, [profile.uid, profile.classId]);

  const toggleRevisionItem = async (assignmentId: string, itemId: string) => {
    const subId = `${profile.uid}_${assignmentId}`;
    const subRef = doc(db, "submissions", subId);
    const subSnap = await getDoc(subRef);
    
    if (subSnap.exists()) {
      const current = (subSnap.data() as Submission).revisionCompleted || [];
      const updated = current.includes(itemId) 
        ? current.filter(id => id !== itemId)
        : [...current, itemId];
      await updateDoc(subRef, { revisionCompleted: updated });
    } else {
      await setDoc(subRef, {
        assignmentId,
        studentId: profile.uid,
        status: "pending",
        revisionCompleted: [itemId]
      });
    }
  };

  const getSubmissionStatus = (assignmentId: string) => {
    return submissions.find(s => s.assignmentId === assignmentId);
  };

  const handleCompleteAssignment = async (assignment: Assignment) => {
    const submissionId = `${profile.uid}_${assignment.id}`;
    const subRef = doc(db, "submissions", submissionId);
    const subSnap = await getDoc(subRef);

    const onTime = new Date() <= new Date(assignment.dueDate);
    const basePoints = onTime ? (assignment.pointsValue || 10) : 5;

    if (!subSnap.exists()) {
      await setDoc(subRef, {
        assignmentId: assignment.id,
        studentId: profile.uid,
        status: "submitted",
        submittedAt: new Date().toISOString(),
        pointsAwarded: basePoints, // Base points for submitting
      } as Submission);
      
      // Update user points with base points
      const userRef = doc(db, "users", profile.uid);
      await updateDoc(userRef, {
        points: (profile.points || 0) + basePoints
      });
    }
  };

  const filteredAssignments = assignments.filter(a => {
    if (filter === "all") return true;
    return a.categoryId === filter;
  });

  const getEventsForDate = (d: Date) => {
    const dateStr = d.toISOString().split('T')[0];
    const dayAssignments = assignments.filter(a => a.dueDate.split('T')[0] === dateStr);
    const dayTests = tests.filter(t => t.date.split('T')[0] === dateStr);
    return [...dayAssignments, ...dayTests];
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Navigation Tabs */}
      <div className="lg:col-span-3 flex items-center gap-6 border-b border-gray-100 pb-4">
        <button 
          onClick={() => setActiveTab('dashboard')}
          className={cn(
             "flex items-center gap-2 text-sm font-bold transition-colors",
             activeTab === 'dashboard' ? "text-indigo-600" : "text-gray-400 hover:text-gray-600"
          )}
        >
          <LayoutDashboard size={18} />
          Learning Dashboard
        </button>
        <button 
          onClick={() => setActiveTab('messages')}
          className={cn(
             "flex items-center gap-2 text-sm font-bold transition-colors",
             activeTab === 'messages' ? "text-indigo-600" : "text-gray-400 hover:text-gray-600"
          )}
        >
          <MessageSquare size={18} />
          Teacher Inbox
        </button>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'dashboard' ? (
          <motion.div 
            key="dashboard"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="lg:col-span-2 space-y-8"
          >
            {/* Weekly Overview */}
            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
               <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold text-gray-900">Your Assignments</h3>
                  <div className="flex items-center gap-2">
                    <Filter size={18} className="text-gray-400" />
                    <select 
                      value={filter} 
                      onChange={(e) => setFilter(e.target.value)}
                      className="text-sm bg-transparent border-none outline-none text-gray-600 font-medium"
                    >
                      <option value="all">All Categories</option>
                      {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
               </div>
               
               <div className="space-y-4">
                  {filteredAssignments.length === 0 ? (
                    <p className="text-center py-10 text-gray-400 italic">No assignments found. Enjoy your free time!</p>
                  ) : (
                    filteredAssignments.map(assignment => {
                      const submission = getSubmissionStatus(assignment.id);
                      const isSubmitted = submission?.status === 'submitted' || submission?.status === 'completed';
                      const isCompleted = submission?.status === 'completed';
                      
                      return (
                        <motion.div 
                          key={assignment.id} 
                          layout
                          onClick={() => setSelectedAssignment(assignment)}
                          className={cn(
                            "flex items-center gap-4 p-4 rounded-2xl border transition-all cursor-pointer",
                            isSubmitted ? "bg-gray-50 border-gray-100 opacity-60" : "bg-white border-gray-100 hover:border-indigo-200"
                          )}
                        >
                          <button 
                            onClick={(e) => { e.stopPropagation(); !isSubmitted && handleCompleteAssignment(assignment); }}
                            className={cn(
                              "w-6 h-6 rounded-full flex items-center justify-center transition-colors",
                              isSubmitted ? (isCompleted ? "bg-green-100 text-green-600" : "bg-indigo-100 text-indigo-600") : "border-2 border-gray-200 text-transparent hover:border-indigo-400 hover:text-indigo-400"
                            )}
                          >
                            {isCompleted ? <CheckCircle2 size={16} /> : <div className="w-2 h-2 bg-current rounded-full" />}
                          </button>
                          <div className="flex-1">
                            <h4 className={cn("font-bold text-gray-900", isSubmitted && "text-gray-500")}>{assignment.title}</h4>
                            <div className="flex items-center gap-3 mt-1">
                              <span className="text-xs px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-md font-bold uppercase">{assignment.subject}</span>
                              <div className="flex items-center gap-1 text-xs text-gray-400">
                                 <Clock size={12} />
                                 <span>Due: {formatDate(assignment.dueDate)}</span>
                              </div>
                            </div>
                          </div>
                          <div className="text-right flex flex-col items-end">
                             <span className={cn(
                               "text-xs font-bold px-2 py-1 rounded-lg",
                               isCompleted ? "bg-green-100 text-green-700" : isSubmitted ? "bg-indigo-100 text-indigo-700" : "bg-amber-100 text-amber-700"
                             )}>
                               {isCompleted ? `Approved: +${submission?.pointsAwarded || 0} pts` : isSubmitted ? "Review pending" : `${assignment.pointsValue || 10} pts`}
                             </span>
                          </div>
                        </motion.div>
                      );
                    })
                  )}
               </div>
            </div>

            {/* Calendar View */}
            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
              <h3 className="text-xl font-bold text-gray-900 mb-6">Study Calendar</h3>
              <div className="flex flex-col md:flex-row gap-8">
                <div className="calendar-container">
                  <Calendar 
                    onChange={setDate as any} 
                    value={date} 
                    className="border-none shadow-none font-sans"
                    tileContent={({ date }) => {
                      const events = getEventsForDate(date);
                      if (events.length > 0) {
                        return <div className="mt-1 flex justify-center gap-0.5"><div className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></div></div>
                      }
                      return null;
                    }}
                  />
                </div>
                <div className="flex-1 space-y-4">
                  <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">{formatDate(date.toISOString())}</p>
                  {getEventsForDate(date).length === 0 ? (
                    <p className="text-gray-400 text-sm italic">Nothing planned for this day.</p>
                  ) : (
                    getEventsForDate(date).map((event: any) => (
                      <div key={event.id} className="p-3 bg-gray-50 rounded-xl border border-gray-100 flex items-center gap-3">
                        <div className={cn("w-2 h-8 rounded-full", 'subject' in event ? "bg-indigo-500" : "bg-green-500")}></div>
                        <div>
                          <p className="font-bold text-sm text-gray-900">{event.title}</p>
                          <p className="text-xs text-gray-500">{event.subject}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div 
            key="messages"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="lg:col-span-2 space-y-6"
          >
            <h3 className="text-xl font-bold text-gray-900">Conversations</h3>
            <div className="grid grid-cols-1 gap-4">
              {teachers.length === 0 ? (
                 <p className="text-gray-400 text-sm italic">No teachers available to message yet.</p>
              ) : (
                teachers.map(teacher => (
                  <div 
                    key={teacher.uid}
                    className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm flex items-center justify-between group hover:border-indigo-100 transition-all"
                  >
                     <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center font-bold text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                           {teacher.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                           <p className="font-bold text-gray-900">{teacher.name}</p>
                           <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Faculty • Assigned Teacher</p>
                        </div>
                     </div>
                     <button 
                       onClick={() => setMessagingTeacher(teacher)}
                       className="flex items-center gap-2 bg-gray-50 text-indigo-600 px-4 py-2 rounded-xl text-xs font-bold hover:bg-indigo-600 hover:text-white transition-all"
                     >
                        <MessageSquare size={14} />
                        Message
                        <ChevronRight size={14} />
                     </button>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sidebar Section */}
      <div className="space-y-8 lg:col-span-1">
        {/* Leaderboard */}
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
           <div className="flex items-center gap-2 mb-6">
              <Trophy className="text-amber-500" size={24} />
              <h3 className="text-xl font-bold text-gray-900">Leaderboard</h3>
           </div>
           <div className="space-y-4">
              {leaderboard.map((user, idx) => (
                <div key={user.uid} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className={cn(
                      "w-6 text-sm font-bold",
                      idx === 0 ? "text-amber-500" : idx === 1 ? "text-gray-400" : "text-gray-300"
                    )}>{idx + 1}</span>
                    <div>
                      <p className="font-bold text-sm text-gray-900">{user.name}</p>
                      <p className="text-xs text-gray-500">{user.points || 0} pts</p>
                    </div>
                  </div>
                  {idx === 0 && <Star className="text-amber-400 fill-amber-400" size={16} />}
                </div>
              ))}
           </div>
        </div>

        {/* Class Leaderboard */}
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
           <div className="flex items-center gap-2 mb-6">
              <School className="text-indigo-500" size={24} />
              <h3 className="text-xl font-bold text-gray-900">Class Standings</h3>
           </div>
           <div className="space-y-4">
              {classStandings.map((cls, idx) => (
                <div key={cls.name} className={cn(
                   "flex items-center justify-between p-3 rounded-2xl",
                   cls.name === leaderboard.find(u => u.uid === profile.uid)?.classId ? "bg-indigo-50" : ""
                )}>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-mono text-gray-400">{idx + 1}.</span>
                    <div>
                      <p className="font-bold text-sm text-gray-900">Class {cls.name}</p>
                      <p className="text-xs text-gray-500">Group Score: {cls.points}</p>
                    </div>
                  </div>
                  {idx === 0 && <Trophy className="text-amber-500" size={14} />}
                </div>
              ))}
           </div>
        </div>

        {/* Chatbot Mini */}
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden flex flex-col h-[400px]">
           <div className="p-4 bg-indigo-600 flex items-center gap-3">
              <MessageSquare className="text-white" size={20} />
              <span className="text-white font-bold">EduBot Assistant</span>
           </div>
           <Chatbot 
             assignments={assignments} 
             tests={tests}
             submissions={submissions}
             profile={profile}
           />
        </div>
      </div>

      {/* Assignment Detail Modal */}
      {selectedAssignment && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white max-w-2xl w-full rounded-3xl shadow-2xl overflow-hidden"
          >
            <div className="p-8">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <span className="text-xs font-bold text-indigo-600 uppercase tracking-widest">{selectedAssignment.subject}</span>
                  <h3 className="text-2xl font-bold text-gray-900 mt-1">{selectedAssignment.title}</h3>
                </div>
                <button onClick={() => setSelectedAssignment(null)} className="text-gray-400 hover:text-gray-600 p-2">
                   <Filter className="rotate-45" size={24} />
                </button>
              </div>
              
              <div className="space-y-6">
                <div>
                  <p className="text-sm font-bold text-gray-400 uppercase mb-2">Description</p>
                  <p className="text-gray-600 leading-relaxed">{selectedAssignment.description}</p>
                </div>

                <div>
                   <p className="text-sm font-bold text-gray-400 uppercase mb-3">Revision Checklist</p>
                   <div className="space-y-2">
                      {revisionItems.filter(i => i.parentId === selectedAssignment.id).length === 0 ? (
                        <p className="text-sm text-gray-400 italic">No specific revision items for this assignment.</p>
                      ) : (
                        revisionItems.filter(i => i.parentId === selectedAssignment.id).map(item => {
                          const sub = submissions.find(s => s.assignmentId === selectedAssignment.id);
                          const done = sub?.revisionCompleted?.includes(item.id);
                          return (
                            <div 
                              key={item.id} 
                              onClick={() => toggleRevisionItem(selectedAssignment.id, item.id)}
                              className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors"
                            >
                               {done ? <CheckCircle2 className="text-green-500" size={20} /> : <Circle className="text-gray-300" size={20} />}
                               <span className={cn("text-sm", done && "line-through text-gray-400")}>{item.content}</span>
                            </div>
                          );
                        })
                      )}
                   </div>
                </div>

                <div className="pt-6 border-t border-gray-100 flex items-center justify-between">
                   <div className="flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-1 text-gray-500">
                        <CalendarIcon size={16} />
                        <span>{formatDate(selectedAssignment.dueDate)}</span>
                      </div>
                      <div className="text-indigo-600 font-bold">
                        {selectedAssignment.pointsValue} Points
                      </div>
                   </div>
                   {!getSubmissionStatus(selectedAssignment.id)?.status?.includes('completed') && (
                     <button 
                        onClick={() => {
                          handleCompleteAssignment(selectedAssignment);
                          setSelectedAssignment(null);
                        }}
                        className="bg-indigo-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200"
                     >
                       Mark as Complete
                     </button>
                   )}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      <AnimatePresence>
        {messagingTeacher && (
          <ChatWindow 
            currentUser={profile} 
            otherUser={{ uid: messagingTeacher.uid, name: messagingTeacher.name, role: messagingTeacher.role }} 
            onClose={() => setMessagingTeacher(null)} 
          />
        )}
      </AnimatePresence>
    </div>
  );
}
