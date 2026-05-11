import React, { useState, useEffect } from "react";
import { UserProfile, Assignment, Submission, Category, Test, RevisionItem, Class } from "../types";
import { db } from "../firebase";
import { collection, onSnapshot, query, where, doc, setDoc, updateDoc, getDoc, arrayUnion, increment, serverTimestamp, writeBatch } from "firebase/firestore";
import { Calendar as CalendarIcon, CheckCircle2, Circle, Clock, MessageSquare, Trophy, Filter, Star, School, LayoutDashboard, ChevronRight, BookOpen, Bell } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn, formatDate } from "../lib/utils";
import CalendarGrid from "./CalendarGrid";
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
  notificationRedirect?: AppNotification | null;
  clearNotificationRedirect?: () => void;
}

export default function StudentDashboard({ profile, notificationRedirect, clearNotificationRedirect }: StudentDashboardProps) {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'messages' | 'profile' | 'school'>('dashboard');
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tests, setTests] = useState<Test[]>([]);
  const [leaderboard, setLeaderboard] = useState<UserProfile[]>([]);
  const [classStandings, setClassStandings] = useState<{id: string, name: string, points: number}[]>([]);
  const [teachers, setTeachers] = useState<UserProfile[]>([]);
  
  const [filter, setFilter] = useState<string>("all");
  const [date, setDate] = useState(new Date());
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [isCompleting, setIsCompleting] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [lastPoints, setLastPoints] = useState(0);
  const [messagingTeacher, setMessagingTeacher] = useState<UserProfile | null>(null);
  const [revisionItems, setRevisionItems] = useState<RevisionItem[]>([]);
  
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showToast, setShowToast] = useState<{message: string, points: number} | null>(null);

  useEffect(() => {
    if (!profile.uid || !profile.classId) return;

    // Real-time listeners
    const unsubN = onSnapshot(query(collection(db, "notifications"), where("userId", "==", profile.uid)), (snap) => {
      const data = snap.docs.map(d => {
        const dData = d.data() as any;
        let createdAt = dData.createdAt;
        // Handle firestore timestamp if present
        if (createdAt && typeof createdAt === 'object' && 'toDate' in createdAt) {
          createdAt = createdAt.toDate().toISOString();
        }
        return { id: d.id, ...dData, createdAt };
      });
      setNotifications(data.sort((a: any, b: any) => {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return timeB - timeA;
      }));
    }, (error) => {
      console.error("Notifications listener error:", error);
    });
    const unsubA = onSnapshot(query(collection(db, "assignments"), where("classId", "==", profile.classId)), (snap) => {
      setAssignments(snap.docs.map(d => ({ id: d.id, ...d.data() } as Assignment)));
    }, (error) => {
      console.error("Assignments listener error:", error);
    });
    const unsubR = onSnapshot(collection(db, "revisionItems"), (snap) => {
      setRevisionItems(snap.docs.map(d => ({ id: d.id, ...d.data() } as RevisionItem)));
    }, (error) => {
      console.error("Revision items listener error:", error);
    });
    const unsubS = onSnapshot(query(collection(db, "submissions"), where("studentId", "==", profile.uid)), (snap) => {
      setSubmissions(snap.docs.map(d => ({ id: d.id, ...d.data() } as Submission)));
    }, (error) => {
      console.error("Submissions listener error:", error);
    });
    const unsubC = onSnapshot(collection(db, "categories"), (snap) => {
      setCategories(snap.docs.map(d => ({ id: d.id, ...d.data() } as Category)));
    }, (error) => {
      console.error("Categories listener error:", error);
    });
    const unsubClasses = onSnapshot(collection(db, "classes"), (cSnap) => {
      const classesData = cSnap.docs.map(d => ({id: d.id, ...d.data()} as Class));
    }, (error) => {
      console.error("Classes listener error:", error);
    });

    const unsubL = onSnapshot(collection(db, "users"), (snap) => {
      const users = snap.docs.map(d => d.data() as UserProfile);
      
      // Filter leaderboard to only show classmates AND teachers (so they can see their rank if they award themselves points)
      const visibleUsers = users.filter(u => 
        (u.role === 'student' && u.classId === profile.classId) || 
        u.role === 'teacher'
      );
      setLeaderboard(visibleUsers.sort((a, b) => (b.points || 0) - (a.points || 0)).slice(0, 10));

      // Update teachers
      setTeachers(users.filter(u => u.role === 'teacher'));
    }, (error) => {
      console.error("Users listener error:", error);
    });

    const unsubT = onSnapshot(collection(db, "tests"), (snap) => {
      setTests(snap.docs.map(d => ({ id: d.id, ...d.data() } as Test)));
    }, (error) => {
      console.error("Tests listener error:", error);
    });

    return () => { 
      unsubN(); unsubA(); unsubS(); unsubC(); unsubL(); unsubT(); unsubR(); unsubClasses();
    };
  }, [profile.uid, profile.classId]);

  // Separate effect for class standings to avoid nested listeners
  useEffect(() => {
    if (!profile.uid) return;
    
    let classes: Class[] = [];
    let students: UserProfile[] = [];

    const updateStandings = () => {
      if (classes.length === 0) return;
      const standings = classes.map(c => {
         const classUsers = students.filter(u => u.classId === c.id);
         const userPoints = classUsers.reduce((sum, u) => sum + (u.points || 0), 0);
         return { id: c.id, name: c.name, points: userPoints };
      }).sort((a,b) => b.points - a.points);
      setClassStandings(standings);
    };

    const unsubU = onSnapshot(collection(db, "users"), (uSnap) => {
        students = uSnap.docs.map(d => d.data() as UserProfile).filter(u => u.role === 'student');
        updateStandings();
    }, (error) => {
        console.error("Users (standings) listener error:", error);
    });

    const unsubC = onSnapshot(collection(db, "classes"), (cSnap) => {
        classes = cSnap.docs.map(d => ({id: d.id, ...d.data()} as Class));
        updateStandings();
    }, (error) => {
        console.error("Classes (standings) listener error:", error);
    });

    return () => { unsubU(); unsubC(); };
  }, [profile.uid]);

  useEffect(() => {
    if (notificationRedirect && clearNotificationRedirect) {
      const msg = notificationRedirect.message.toLowerCase();
      const senderId = (notificationRedirect as any).senderId;

      if (msg.includes('message') || msg.includes('messaged')) {
        setActiveTab('messages');
        if (senderId) {
          const teacher = teachers.find(t => t.uid === senderId);
          if (teacher) setMessagingTeacher(teacher);
        }
      } else if (msg.includes('assignment')) {
        setActiveTab('dashboard');
      }
      clearNotificationRedirect();
    }
  }, [notificationRedirect, teachers, clearNotificationRedirect]);

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
    if (!profile.uid) return;
    const submissionId = `${profile.uid}_${assignment.id}`;
    const subRef = doc(db, "submissions", submissionId);
    
    try {
      const subSnap = await getDoc(subRef);
      const batch = writeBatch(db);
      
      const dueDate = new Date(assignment.dueDate);
      const now = new Date();
      const onTime = now <= dueDate;
      // ALWAYS use the pointsValue set by the teacher, ignore the default 5 for late if user wants it "according to amount set"
      const basePoints = assignment.pointsValue || 10;

      let shouldReward = false;
      
      if (!subSnap.exists()) {
        batch.set(subRef, {
          assignmentId: assignment.id,
          studentId: profile.uid,
          status: "completed",
          submittedAt: serverTimestamp(),
          pointsAwarded: basePoints,
          revisionCompleted: []
        });
        shouldReward = true;
      } else {
        const existingData = subSnap.data() as Submission;
        // Reward if not already completed or if status is pending/not_started
        if (existingData.status !== 'completed') {
          batch.update(subRef, {
            status: "completed",
            submittedAt: serverTimestamp(),
            pointsAwarded: basePoints
          });
          shouldReward = true;
        }
      }

      if (shouldReward) {
        batch.update(doc(db, "users", profile.uid), {
          points: increment(basePoints)
        });

        const notifRef = doc(collection(db, "notifications"));
        batch.set(notifRef, {
          userId: profile.uid,
          message: `🎉 AWESOME! You completed "${assignment.title}" and earned ${basePoints} Student Merits!`,
          read: false,
          createdAt: serverTimestamp(),
          type: 'achievement'
        });

        // Notify teacher
        const teacherNotifRef = doc(collection(db, "notifications"));
        batch.set(teacherNotifRef, {
          userId: assignment.teacherId,
          message: `📚 ${profile.name} completed: ${assignment.title}`,
          read: false,
          createdAt: serverTimestamp(),
          type: 'submission',
          studentId: profile.uid
        });

        await batch.commit();

        setLastPoints(basePoints);
        setShowCelebration(true);
        setTimeout(() => setShowCelebration(false), 4000);
        
        setShowToast({ message: `Level Up! +${basePoints} Merits`, points: basePoints });
        setTimeout(() => setShowToast(null), 5000);
      } else {
        // If already completed, just close modal
        alert("You have already completed this assignment!");
      }
      
      setSelectedAssignment(null);
    } catch (error: any) {
      console.error("Completion error details:", error);
      alert("Failed to mark as completed. " + (error.message || "Please check your connection."));
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
                onClick={() => setActiveTab('school')}
                className={cn(
                    "flex items-center gap-2 text-sm font-bold transition-colors",
                    activeTab === 'school' ? "text-indigo-600" : "text-gray-400 hover:text-gray-600"
                )}
            >
                <School size={18} />
                School Community
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
                <span className="text-sm font-black text-indigo-700">{profile.points || 0} <span className="text-[10px] text-indigo-400 font-bold">Merits</span></span>
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
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-900">Your Academic Calendar</h3>
              </div>
              
              <CalendarGrid 
                assignments={assignments}
                tests={tests}
                selectedDate={date}
                onSelectDate={setDate}
              />
              
              <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">{formatDate(date.toISOString())}</p>
                  {getEventsForDate(date).length === 0 ? (
                    <div className="py-8 text-center bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                        <p className="text-gray-400 text-sm italic">Nothing planned for this day.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {getEventsForDate(date).map((event: any) => (
                          <div key={event.id} className="p-4 bg-gray-50 rounded-2xl border border-gray-100 flex items-center gap-4 group hover:border-indigo-200 transition-all">
                            <div className={cn("w-1.5 h-12 rounded-full", 'subject' in event ? "bg-indigo-500" : "bg-rose-500")}></div>
                            <div className="flex-1">
                              <p className="font-bold text-gray-900">{event.title}</p>
                              <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-1">{event.subject || 'Test Event'}</p>
                            </div>
                            <button className="p-2 text-gray-300 group-hover:text-indigo-600 transition-colors">
                                <ChevronRight size={18} />
                            </button>
                          </div>
                        ))}
                    </div>
                  )}
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
                                        <p className="text-sm font-black text-indigo-600">+{sub?.pointsAwarded || 0} Merits</p>
                                        <p className="text-[10px] text-gray-400 font-bold uppercase">{sub?.status === 'completed' ? 'Graded' : 'Submitted'}</p>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
          </motion.div>
        ) : activeTab === 'messages' ? (
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
        ) : activeTab === 'school' ? (
          <motion.div
            key="school"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="lg:col-span-2 space-y-8"
          >
            <div className="bg-white p-6 rounded-3xl border border-indigo-100 shadow-sm">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-indigo-50 rounded-xl text-indigo-600">
                        <School size={24} />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-gray-900">Your Class</h3>
                        {profile.classId && (
                            <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">
                                {classStandings.find(c => c.id === profile.classId)?.name || "Current Class"}
                            </p>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Classmates */}
                    <div>
                        <h4 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">Classmates</h4>
                        <div className="space-y-3">
                            {classStandings.length > 0 ? (
                                // This is a hacky way since our leaderboard usually only shows top 10 classmates
                                // We might need to fetch all users in class properly
                                leaderboard
                                    .filter(u => u.role === 'student' && u.classId === profile.classId)
                                    .map(student => (
                                        <div key={student.uid} className="flex items-center gap-3 p-3 bg-gray-50 rounded-2xl border border-transparent">
                                            <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-lg border border-gray-100">
                                                {student.avatar || student.name.slice(0, 1).toUpperCase()}
                                            </div>
                                            <div>
                                                <p className="font-bold text-gray-900 text-sm">{student.name} {student.uid === profile.uid && "(You)"}</p>
                                                <p className="text-[10px] text-indigo-600 font-black">{student.points || 0} Merits</p>
                                            </div>
                                        </div>
                                    ))
                            ) : (
                                <p className="text-xs text-gray-400">No classmates found.</p>
                            )}
                        </div>
                    </div>
                    {/* Class Teachers */}
                    <div>
                        <h4 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">Teachers</h4>
                        <div className="space-y-3">
                            {teachers.map(teacher => (
                                <div key={teacher.uid} className="flex items-center justify-between p-3 bg-white rounded-2xl border border-gray-100 shadow-sm">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-lg border border-indigo-100">
                                            {teacher.avatar || "👨‍🏫"}
                                        </div>
                                        <div>
                                            <p className="font-bold text-gray-900 text-sm">{teacher.name}</p>
                                            <p className="text-[10px] text-gray-400 font-bold uppercase">{teacher.subjects?.join(", ") || "Faculty"}</p>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={() => setMessagingTeacher(teacher)}
                                        className="p-2 hover:bg-indigo-50 text-indigo-600 rounded-lg transition-colors"
                                    >
                                        <MessageSquare size={16} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
                <h3 className="text-xl font-bold text-gray-900 mb-6 font-space-grotesk">Global Hall of Fame</h3>
                <div className="space-y-4">
                    {leaderboard.map((user, idx) => (
                        <div key={user.uid} className="flex items-center justify-between p-4 bg-gray-50/50 rounded-2xl border border-transparent hover:border-indigo-100 transition-all">
                            <div className="flex items-center gap-4">
                                <span className={cn(
                                    "w-8 text-lg font-black",
                                    idx === 0 ? "text-amber-500" : idx === 1 ? "text-gray-400" : idx === 2 ? "text-amber-700" : "text-gray-200"
                                )}>#{idx + 1}</span>
                                <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center text-2xl border border-gray-100 relative">
                                    {user.avatar || user.name.slice(0, 1).toUpperCase()}
                                    {user.role === 'teacher' && <div className="absolute -top-1 -right-1 w-4 h-4 bg-indigo-600 rounded-full border-2 border-white ring-2 ring-indigo-50" />}
                                </div>
                                <div>
                                    <p className="font-bold text-gray-900">{user.name}</p>
                                    <p className="text-xs text-gray-400 font-bold">
                                        {user.role === 'teacher' ? 'Staff' : `Class ${classStandings.find(c => c.id === user.classId)?.name || "Student"}`}
                                    </p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-lg font-black text-indigo-600">{user.points || 0}</p>
                                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Merits</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
          </motion.div>
        ) : null}
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
      <AnimatePresence>
        {selectedAssignment && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-hidden">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setSelectedAssignment(null)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white max-w-2xl w-full rounded-3xl shadow-2xl overflow-hidden relative z-10"
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
                    {(() => {
                      const subStatus = getSubmissionStatus(selectedAssignment.id)?.status;
                      const canSubmit = !subStatus || subStatus === 'pending' || (subStatus as any) === 'not_started' || subStatus === 'late';
                      
                      if (canSubmit) {
                        return (
                          <motion.button 
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            disabled={isCompleting}
                            onClick={async () => {
                              setIsCompleting(true);
                              try {
                                await handleCompleteAssignment(selectedAssignment);
                              } catch (error: any) {
                                console.error("Button error:", error);
                              } finally {
                                setIsCompleting(false);
                              }
                            }}
                            className="bg-gradient-to-r from-indigo-600 to-indigo-700 text-white px-8 py-3 rounded-2xl font-black text-lg hover:from-indigo-700 hover:to-indigo-800 shadow-xl shadow-indigo-200 disabled:opacity-50 flex items-center gap-3 transition-all transform"
                          >
                            {isCompleting ? (
                              <>
                                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Marking...
                              </>
                            ) : (
                              <>
                                <CheckCircle2 size={24} />
                                Mark as Completed
                              </>
                            )}
                          </motion.button>
                        );
                      }
                      
                      return (
                        <div className="flex items-center gap-3 text-emerald-600 font-black bg-emerald-50 px-6 py-3 rounded-2xl border border-emerald-100 shadow-sm">
                          <Trophy size={20} className="text-amber-500 animate-bounce" />
                          {subStatus === 'completed' ? 'Graded & Points Awarded' : 'Submitted for Review'}
                        </div>
                      );
                    })()}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
      </AnimatePresence>

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
      {/* Celebration Overlay */}
      <AnimatePresence>
        {showCelebration && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 pointer-events-none z-[200] flex items-center justify-center overflow-hidden"
          >
             <div className="absolute inset-0 bg-white/20 backdrop-blur-[2px]" />
             <div className="relative">
                <motion.div
                  initial={{ scale: 0, rotate: -20 }}
                  animate={{ scale: 1.5, rotate: 0 }}
                  exit={{ scale: 0, opacity: 0 }}
                  className="bg-white p-12 rounded-[4rem] shadow-2xl border-4 border-indigo-100 flex flex-col items-center text-center"
                >
                   <div className="text-8xl mb-6 animate-bounce">🏆</div>
                   <h2 className="text-4xl font-black text-gray-900 mb-2">AMAZING WORK!</h2>
                   <p className="text-xl text-indigo-600 font-bold tracking-tight">You earned +{lastPoints} Student Merits!</p>
                   
                   {/* Abstract confetti shapes */}
                   {[...Array(12)].map((_, i) => (
                     <motion.div
                       key={i}
                       initial={{ x: 0, y: 0, opacity: 0 }}
                       animate={{ 
                         x: (Math.random() - 0.5) * 600, 
                         y: (Math.random() - 0.5) * 600,
                         opacity: [0, 1, 0],
                         rotate: Math.random() * 360
                       }}
                       transition={{ duration: 2, repeat: Infinity, delay: Math.random() * 0.5 }}
                       className={cn(
                         "absolute w-4 h-4 rounded-lg",
                         ["bg-indigo-500", "bg-amber-400", "bg-emerald-400", "bg-rose-400"][i % 4]
                       )}
                     />
                   ))}
                </motion.div>
             </div>
          </motion.div>
        )}
      </AnimatePresence>

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
                <p className="text-white/80 text-sm font-medium">You earned +{showToast.points} Merits!</p>
             </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
