import React, { useState, useEffect } from "react";
import { UserProfile, Assignment, Submission, Category, Test, RevisionItem, Class } from "../types";
import { db } from "../firebase";
import { collection, onSnapshot, query, where, doc, setDoc, updateDoc, getDoc, arrayUnion, increment, serverTimestamp, writeBatch } from "firebase/firestore";
import { Calendar as CalendarIcon, CheckCircle2, Circle, Clock, MessageSquare, Trophy, Filter, Star, School, LayoutDashboard, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn, formatDate } from "../lib/utils";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import Chatbot from "./Chatbot";
import ChatWindow from "./ChatWindow";
import { User as UserIcon, Save } from "lucide-react";
import { auth } from "../firebase";

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

const AVATARS = ["🎓", "🔬", "🎨", "⚽", "🎸", "💻", "📚", "🧬", "🚀", "🍕"];

function StudentProfileEditor({ profile }: { profile: UserProfile }) {
  const [name, setName] = useState(profile.name);
  const [age, setAge] = useState(profile.age || 15);
  const [avatar, setAvatar] = useState(profile.avatar || AVATARS[0]);
  const [saving, setSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateDoc(doc(db, "users", profile.uid), {
        name,
        age,
        avatar
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
      <h3 className="text-2xl font-bold text-gray-900 mb-8">Profile Settings</h3>
      <form onSubmit={handleSave} className="space-y-6">
        <div className="flex flex-col items-center gap-4 mb-8">
           <div className="text-6xl bg-indigo-50 w-24 h-24 rounded-3xl flex items-center justify-center border-4 border-indigo-100">
              {avatar}
           </div>
           <div className="flex flex-wrap justify-center gap-2 max-w-sm">
              {AVATARS.map(a => (
                <button 
                  key={a}
                  type="button"
                  onClick={() => setAvatar(a)}
                  className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center transition-all",
                    avatar === a ? "bg-indigo-600 text-white scale-110 shadow-lg shadow-indigo-200" : "bg-gray-50 text-gray-400 hover:bg-gray-100"
                  )}
                >
                  {a}
                </button>
              ))}
           </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-1">
            <label className="text-sm font-bold text-gray-400 uppercase tracking-widest">Full Name</label>
            <input 
              type="text" value={name} 
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-gray-50 border border-transparent focus:border-indigo-300 px-4 py-3 rounded-2xl outline-none font-bold text-gray-900"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-bold text-gray-400 uppercase tracking-widest">Age</label>
            <input 
              type="number" value={age} 
              onChange={(e) => setAge(parseInt(e.target.value))}
              className="w-full bg-gray-50 border border-transparent focus:border-indigo-300 px-4 py-3 rounded-2xl outline-none font-bold text-gray-900"
            />
          </div>
        </div>

        <div className="pt-6 border-t border-gray-50 flex justify-end">
           <button 
             type="submit" 
             disabled={saving}
             className="bg-indigo-600 text-white px-8 py-3 rounded-2xl font-bold hover:bg-indigo-700 transition-all flex items-center gap-2 disabled:opacity-50"
           >
             <Save size={20} />
             {saving ? 'Saving...' : 'Save Profile'}
           </button>
        </div>
      </form>
    </div>
  );
}

interface StudentDashboardProps {
  profile: UserProfile;
}

export default function StudentDashboard({ profile }: StudentDashboardProps) {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'messages' | 'profile'>('dashboard');
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tests, setTests] = useState<Test[]>([]);
  const [leaderboard, setLeaderboard] = useState<UserProfile[]>([]);
  const [classStandings, setClassStandings] = useState<{id: string, name: string, points: number}[]>([]);
  const [teachers, setTeachers] = useState<UserProfile[]>([]);
  
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showToast, setShowToast] = useState<{message: string, points: number} | null>(null);

  useEffect(() => {
    // Real-time listeners
    const unsubN = onSnapshot(query(collection(db, "notifications"), where("userId", "==", profile.uid)), (snap) => {
      setNotifications(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    });
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
      
      // Filter leaderboard to only show classmates AND teachers (so they can see their rank if they award themselves points)
      const visibleUsers = users.filter(u => 
        (u.role === 'student' && u.classId === profile.classId) || 
        u.role === 'teacher'
      );
      setLeaderboard(visibleUsers.sort((a, b) => (b.points || 0) - (a.points || 0)).slice(0, 10));

      const studentUsers = users.filter(u => u.role === 'student');
      // Aggregate class standings
      onSnapshot(collection(db, "classes"), (cSnap) => {
          const classesData = cSnap.docs.map(d => ({id: d.id, ...d.data()} as Class));
          const standings = classesData.map(c => {
             const classUsers = studentUsers.filter(u => u.classId === c.id);
             const userPoints = classUsers.reduce((sum, u) => sum + (u.points || 0), 0);
             return { id: c.id, name: c.name, points: userPoints };
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
    try {
      const subSnap = await getDoc(subRef);
      
      if (subSnap.exists()) {
        const data = subSnap.data() as Submission;
        const current = data.revisionCompleted || [];
        const updated = current.includes(itemId) 
          ? current.filter(id => id !== itemId)
          : [...current, itemId];
        
        const updates: any = { revisionCompleted: updated };
        // If no status or explicitly unstarted, mark as pending
        if (!data.status || data.status === 'not_started' as any) updates.status = "pending";
        
        await updateDoc(subRef, updates);
      } else {
        await setDoc(subRef, {
          assignmentId,
          studentId: profile.uid,
          status: "pending",
          revisionCompleted: [itemId]
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `submissions/${subId}`);
    }
  };

  const getSubmissionStatus = (assignmentId: string) => {
    return submissions.find(s => s.assignmentId === assignmentId);
  };

  const handleCompleteAssignment = async (assignment: Assignment) => {
    const submissionId = `${profile.uid}_${assignment.id}`;
    const subRef = doc(db, "submissions", submissionId);
    try {
      const subSnap = await getDoc(subRef);
      const onTime = new Date() <= new Date(assignment.dueDate);
      const basePoints = onTime ? (assignment.pointsValue || 10) : 5;

      const batch = writeBatch(db);

      // We'll create or update the submission and the user points in one batch
      if (!subSnap.exists()) {
        batch.set(subRef, {
          assignmentId: assignment.id,
          studentId: profile.uid,
          status: "submitted",
          submittedAt: serverTimestamp(),
          pointsAwarded: basePoints,
          revisionCompleted: []
        });
        
        batch.update(doc(db, "users", profile.uid), {
          points: increment(basePoints)
        });

        // Add a notification for the student
        const notifRef = doc(collection(db, "notifications"));
        batch.set(notifRef, {
          userId: profile.uid,
          message: `😊 Good job ${profile.name}! You earned ${basePoints} points for completing "${assignment.title}".`,
          read: false,
          createdAt: new Date().toISOString(),
          type: 'achievement'
        });
        
        await batch.commit();
      } else {
        const existingData = subSnap.data() as Submission;
        // Only reward points if transitioning from non-submitted/completed state
        if (existingData.status !== 'submitted' && existingData.status !== 'completed') {
          batch.update(subRef, {
            status: "submitted",
            submittedAt: serverTimestamp(),
            pointsAwarded: basePoints
          });

          batch.update(doc(db, "users", profile.uid), {
            points: increment(basePoints)
          });
          
          // Add a notification for the student
          const notifRef = doc(collection(db, "notifications"));
          batch.set(notifRef, {
            userId: profile.uid,
            message: `😊 Good job ${profile.name}! You earned ${basePoints} points for completing "${assignment.title}".`,
            read: false,
            createdAt: new Date().toISOString(),
            type: 'achievement'
          });
          
          await batch.commit();
        } else {
          // If already submitted, just close modal
           setSelectedAssignment(null);
           return;
        }
      }
      
      // Success feedback
      setShowToast({ message: `Good job ${profile.name}!`, points: basePoints });
      setTimeout(() => setShowToast(null), 5000);
      setSelectedAssignment(null);
    } catch (error: any) {
      console.error("Completion error details:", error);
      // Try to parse firestore error if it matches our expected JSON format
      try {
        const parsed = JSON.parse(error.message);
        alert(`Failed to save progress: ${parsed.error}`);
      } catch {
        alert("Failed to mark as completed. Please check your connection.");
      }
      handleFirestoreError(error, OperationType.WRITE, `submissions/${submissionId}`);
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
      <div className="lg:col-span-3 flex items-center justify-between border-b border-gray-100 pb-4">
        <div className="flex items-center gap-6">
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
            <button 
                onClick={() => setActiveTab('profile')}
                className={cn(
                    "flex items-center gap-2 text-sm font-bold transition-colors",
                    activeTab === 'profile' ? "text-indigo-600" : "text-gray-400 hover:text-gray-600"
                )}
            >
                <UserIcon size={18} />
                My Profile
            </button>
        </div>

        <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-4 py-2 bg-indigo-50 rounded-2xl border border-indigo-100">
                <Trophy size={16} className="text-amber-500" />
                <span className="text-sm font-black text-indigo-700">{profile.points || 0} <span className="text-[10px] text-indigo-400 font-bold">BP</span></span>
            </div>
            <div className="relative">
                <button 
                    onClick={() => setShowNotifications(!showNotifications)}
                    className="p-2 hover:bg-gray-100 rounded-xl transition-colors relative"
                >
                    <Star size={20} className="text-gray-400" />
                    {notifications.filter(n => !n.read).length > 0 && (
                        <div className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white" />
                    )}
                </button>
                <AnimatePresence>
                    {showNotifications && (
                        <motion.div 
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                            className="absolute right-0 mt-2 w-72 bg-white rounded-3xl shadow-xl border border-gray-100 z-50 p-4 max-h-[400px] overflow-y-auto"
                        >
                            <h4 className="font-bold text-gray-900 mb-4 px-2">Notifications</h4>
                            <div className="space-y-2">
                                {notifications.length === 0 ? (
                                    <p className="text-xs text-gray-400 text-center py-8">All caught up!</p>
                                ) : (
                                    notifications.map(n => (
                                        <div key={n.id} className={cn("p-3 rounded-2xl text-xs", n.read ? "bg-white" : "bg-indigo-50")}>
                                            <p className="font-bold text-gray-900">{n.message}</p>
                                            <p className="text-[10px] text-gray-400 mt-1">{formatDate(n.createdAt)}</p>
                                        </div>
                                    ))
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
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
               
               <div className="space-y-8">
                  {/* In Progress Section */}
                  <div>
                    <h4 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">In Progress</h4>
                    <div className="space-y-4">
                      {filteredAssignments.filter(a => {
                        const sub = getSubmissionStatus(a.id);
                        return !sub || (sub.status !== 'submitted' && sub.status !== 'completed');
                      }).length === 0 ? (
                        <p className="text-sm text-gray-400 italic">No pending assignments.</p>
                      ) : (
                        filteredAssignments.filter(a => {
                          const sub = getSubmissionStatus(a.id);
                          return !sub || (sub.status !== 'submitted' && sub.status !== 'completed');
                        }).map(assignment => {
                          const submission = getSubmissionStatus(assignment.id);
                          const isSubmitted = submission?.status === 'submitted' || submission?.status === 'completed';
                          
                          return (
                            <motion.div 
                              key={assignment.id} 
                              layout
                              onClick={() => setSelectedAssignment(assignment)}
                              className="flex items-center gap-4 p-4 rounded-2xl border bg-white border-gray-100 hover:border-indigo-200 transition-all cursor-pointer shadow-sm"
                            >
                              <button 
                                onClick={(e) => { e.stopPropagation(); !isSubmitted && handleCompleteAssignment(assignment); }}
                                className="w-6 h-6 rounded-full border-2 border-gray-200 text-transparent hover:border-indigo-400 hover:text-indigo-400 flex items-center justify-center transition-colors"
                              >
                                <div className="w-2 h-2 bg-current rounded-full" />
                              </button>
                              <div className="flex-1">
                                <h4 className="font-bold text-gray-900">{assignment.title}</h4>
                                <div className="flex items-center gap-3 mt-1">
                                  <span className="text-xs px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-md font-bold uppercase">{assignment.subject}</span>
                                  <div className="flex items-center gap-1 text-xs text-gray-400">
                                     <Clock size={12} />
                                     <span>Due: {formatDate(assignment.dueDate)}</span>
                                  </div>
                                </div>
                              </div>
                              <div className="text-right">
                                 <span className="text-xs font-bold px-2 py-1 rounded-lg bg-amber-100 text-amber-700">
                                   {assignment.pointsValue || 10} pts
                                 </span>
                              </div>
                            </motion.div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* Completed Section */}
                  <div>
                    <h4 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">Completed</h4>
                    <div className="space-y-4">
                      {filteredAssignments.filter(a => {
                        const sub = getSubmissionStatus(a.id);
                        return sub?.status === 'submitted' || sub?.status === 'completed';
                      }).length === 0 ? (
                        <p className="text-sm text-gray-400 italic">No completed assignments yet.</p>
                      ) : (
                        filteredAssignments.filter(a => {
                          const sub = getSubmissionStatus(a.id);
                          return sub?.status === 'submitted' || sub?.status === 'completed';
                        }).map(assignment => {
                          const submission = getSubmissionStatus(assignment.id);
                          const isCompleted = submission?.status === 'completed';
                          
                          return (
                            <motion.div 
                              key={assignment.id} 
                              layout
                              onClick={() => setSelectedAssignment(assignment)}
                              className="flex items-center gap-4 p-4 rounded-2xl border bg-gray-50 border-gray-100 opacity-80 cursor-pointer shadow-sm"
                            >
                              <div className={cn(
                                "w-6 h-6 rounded-full flex items-center justify-center",
                                isCompleted ? "bg-green-100 text-green-600" : "bg-indigo-100 text-indigo-600"
                              )}>
                                {isCompleted ? <CheckCircle2 size={16} /> : <div className="w-2 h-2 bg-current rounded-full" />}
                              </div>
                              <div className="flex-1">
                                <h4 className="font-bold text-gray-500">{assignment.title}</h4>
                                <div className="flex items-center gap-3 mt-1">
                                  <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-500 rounded-md font-bold">{assignment.subject}</span>
                                </div>
                              </div>
                              <div className="text-right">
                                 <span className={cn(
                                   "text-xs font-bold px-2 py-1 rounded-lg",
                                   isCompleted ? "bg-green-100 text-green-700" : "bg-indigo-100 text-indigo-700"
                                 )}>
                                   {isCompleted ? `Earned: +${submission?.pointsAwarded || 0} pts` : "Submitted"}
                                 </span>
                              </div>
                            </motion.div>
                          );
                        })
                      )}
                    </div>
                  </div>
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
        ) : activeTab === 'profile' ? (
          <motion.div
            key="profile"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="lg:col-span-2 space-y-8"
          >
            <StudentProfileEditor profile={profile} />
            
            <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold text-gray-900">Completed Assignments</h3>
                    <div className="flex items-center gap-2 text-indigo-600 font-bold bg-indigo-50 px-3 py-1 rounded-lg text-sm">
                        <CheckCircle2 size={16} />
                        {submissions.filter(s => s.status === 'completed' || s.status === 'submitted').length} Done
                    </div>
                </div>
                
                <div className="space-y-4">
                    {assignments.filter(a => {
                        const sub = getSubmissionStatus(a.id);
                        return sub?.status === 'submitted' || sub?.status === 'completed';
                    }).length === 0 ? (
                        <p className="text-sm text-gray-400 italic text-center py-8">No completed assignments yet. Start learning!</p>
                    ) : (
                        assignments.filter(a => {
                            const sub = getSubmissionStatus(a.id);
                            return sub?.status === 'submitted' || sub?.status === 'completed';
                        }).map(assignment => {
                            const sub = getSubmissionStatus(assignment.id);
                            return (
                                <div key={assignment.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-transparent hover:border-indigo-100 transition-all">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
                                            <BookOpen size={20} />
                                        </div>
                                        <div>
                                            <p className="font-bold text-gray-900">{assignment.title}</p>
                                            <p className="text-xs text-gray-400 uppercase font-bold tracking-widest">{assignment.subject}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-black text-indigo-600">+{sub?.pointsAwarded || 0} BP</p>
                                        <p className="text-[10px] text-gray-400 font-bold uppercase">{sub?.status === 'completed' ? 'Graded' : 'Submitted'}</p>
                                    </div>
                                </div>
                            );
                        })
                    )}
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
                        <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center font-bold text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-all text-2xl border border-indigo-100">
                           {teacher.avatar || teacher.name.slice(0, 1).toUpperCase()}
                        </div>
                        <div>
                           <p className="font-bold text-gray-900">{teacher.name}</p>
                           <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest truncate max-w-[150px]">
                              {teacher.subjects?.join(", ") || "Faculty"} • Assigned Teacher
                           </p>
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
              <h3 className="text-xl font-bold text-gray-900">Hall of Fame</h3>
           </div>
           <div className="space-y-4">
              {leaderboard.map((user, idx) => (
                <div key={user.uid} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className={cn(
                      "w-6 text-sm font-bold",
                      idx === 0 ? "text-amber-500" : idx === 1 ? "text-gray-400" : "text-gray-300"
                    )}>{idx + 1}</span>
                    <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center text-sm border border-gray-100 relative">
                       {user.avatar || user.name.slice(0, 1).toUpperCase()}
                       {user.role === 'teacher' && (
                         <div className="absolute -top-1 -right-1 w-3 h-3 bg-indigo-600 rounded-full border-2 border-white" title="Teacher" />
                       )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 text-sm">
                        <p className="font-bold text-gray-900">{user.name}</p>
                        {user.role === 'teacher' && <span className="text-[8px] bg-indigo-50 text-indigo-600 px-1 rounded font-black uppercase">Staff</span>}
                      </div>
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
                <div key={cls.id} className={cn(
                   "flex items-center justify-between p-3 rounded-2xl",
                   cls.id === profile.classId ? "bg-indigo-50" : ""
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
                <div className="flex items-center gap-3">
                   {selectedAssignment.difficulty && (
                     <span className={cn(
                       "text-[10px] font-black px-2 py-1 rounded-lg uppercase tracking-widest",
                       selectedAssignment.difficulty === 'Easy' ? "bg-green-100 text-green-700" :
                       selectedAssignment.difficulty === 'Medium' ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"
                     )}>
                       {selectedAssignment.difficulty}
                     </span>
                   )}
                   <button onClick={() => setSelectedAssignment(null)} className="text-gray-400 hover:text-gray-600 p-2">
                      <Filter className="rotate-45" size={24} />
                   </button>
                </div>
              </div>
              
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-bold text-gray-400 uppercase mb-2">Description</p>
                    <p className="text-gray-600 leading-relaxed text-sm">{selectedAssignment.description}</p>
                  </div>
                  <div className="space-y-4">
                    {selectedAssignment.estimatedTime && (
                      <div>
                        <p className="text-sm font-bold text-gray-400 uppercase mb-1">Estimated Time</p>
                        <div className="flex items-center gap-2 text-indigo-600 font-bold">
                          <Clock size={16} />
                          <span>{selectedAssignment.estimatedTime}</span>
                        </div>
                      </div>
                    )}
                    {selectedAssignment.attachments && selectedAssignment.attachments.length > 0 && (
                      <div>
                        <p className="text-sm font-bold text-gray-400 uppercase mb-2">Reference Materials</p>
                        <div className="space-y-2">
                           {selectedAssignment.attachments.map((file, i) => (
                             <a 
                               key={i} 
                               href={file.url} 
                               target="_blank" 
                               rel="noreferrer"
                               className="flex items-center gap-2 p-2 bg-indigo-50 text-indigo-600 rounded-xl text-xs font-bold hover:bg-indigo-600 hover:text-white transition-all"
                             >
                               <School size={14} />
                               <span className="truncate">{file.name}</span>
                             </a>
                           ))}
                        </div>
                      </div>
                    )}
                  </div>
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
                    {!getSubmissionStatus(selectedAssignment.id)?.status || getSubmissionStatus(selectedAssignment.id)?.status === 'pending' ? (
                      <button 
                        disabled={isCompleting}
                        onClick={async () => {
                          setIsCompleting(true);
                          try {
                            await handleCompleteAssignment(selectedAssignment);
                            setSelectedAssignment(null);
                          } catch (error: any) {
                            console.error("Completion error:", error);
                            alert("Failed to mark as completed. " + (error.message || ""));
                          } finally {
                            setIsCompleting(false);
                          }
                        }}
                        className="bg-indigo-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200 disabled:opacity-50"
                      >
                        {isCompleting ? 'Marking...' : 'Mark as Completed'}
                      </button>
                    ) : (
                      <div className="flex items-center gap-2 text-indigo-600 font-bold bg-indigo-50 px-4 py-2 rounded-xl">
                        <CheckCircle2 size={18} />
                        {getSubmissionStatus(selectedAssignment.id)?.status === 'completed' ? 'Graded & Completed' : 'Submitted for Review'}
                      </div>
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

      {/* Achievement Toast */}
      <AnimatePresence>
        {showToast && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-indigo-600 text-white px-8 py-4 rounded-3xl shadow-2xl z-[100] flex items-center gap-4"
          >
             <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center text-2xl">
                😊
             </div>
             <div>
                <p className="font-bold text-lg">{showToast.message}</p>
                <p className="text-white/80 text-sm font-medium">You earned +{showToast.points} BP!</p>
             </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
