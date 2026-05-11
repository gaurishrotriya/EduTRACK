import React, { useState, useEffect } from "react";
import { UserProfile, Assignment, Category, Submission, Class } from "../types";
import { db } from "../firebase";
import { collection, onSnapshot, query, where, addDoc, getDocs, doc, deleteDoc, updateDoc, getDoc, increment, writeBatch } from "firebase/firestore";
import { Plus, BookOpen, Calendar, CheckSquare, Trash2, Edit2, Star, Award, Users, Search, MessageSquare, ChevronRight, LayoutDashboard, Trophy } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn, formatDate } from "../lib/utils";
import StudentProfileView from "./StudentProfileView";
import ChatWindow from "./ChatWindow";
import { User as UserIcon, Save } from "lucide-react";

function TeacherProfileEditor({ profile }: { profile: UserProfile }) {
  const [name, setName] = useState(profile.name);
  const [subjects, setSubjects] = useState(profile.subjects?.join(", ") || "");
  const [saving, setSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateDoc(doc(db, "users", profile.uid), {
        name,
        subjects: subjects.split(",").map(s => s.trim()).filter(s => s)
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
      <h3 className="text-2xl font-bold text-gray-900 mb-8">Profile Settings</h3>
      <form onSubmit={handleSave} className="space-y-6">
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
            <label className="text-sm font-bold text-gray-400 uppercase tracking-widest">Subjects (Comma separated)</label>
            <input 
              type="text" value={subjects} 
              onChange={(e) => setSubjects(e.target.value)}
              placeholder="e.g. Maths, Physics"
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

interface TeacherDashboardProps {
  profile: UserProfile;
  notificationRedirect?: AppNotification | null;
  clearNotificationRedirect?: () => void;
}

export default function TeacherDashboard({ profile, notificationRedirect, clearNotificationRedirect }: TeacherDashboardProps) {
  const [activeTab, setActiveTab] = useState<'assignments' | 'students' | 'classes' | 'profile' | 'leaderboard'>('assignments');
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [students, setStudents] = useState<UserProfile[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [leaderboard, setLeaderboard] = useState<UserProfile[]>([]);
  const [classStandings, setClassStandings] = useState<{id: string, name: string, points: number}[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [viewingAssignmentId, setViewingAssignmentId] = useState<string | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<UserProfile | null>(null);
  const [messagingUser, setMessagingUser] = useState<UserProfile | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Form State
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [classId, setClassId] = useState(""); // Targeted class
  const [description, setDescription] = useState("");
  const [revisionItemsInput, setRevisionItemsInput] = useState("");
  const [difficulty, setDifficulty] = useState<"Easy" | "Medium" | "Hard">("Medium");
  const [estimatedTime, setEstimatedTime] = useState("");
  const [pointsValue, setPointsValue] = useState(10);
  const [attachments, setAttachments] = useState<{ name: string, url: string, type: string }[]>([]);
  const [attachmentName, setAttachmentName] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState("");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newClassName, setNewClassName] = useState("");
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [showClassForm, setShowClassForm] = useState(false);

  useEffect(() => {
    const q = query(collection(db, "assignments"), where("teacherId", "==", profile.uid));
    const unsub = onSnapshot(q, (snapshot) => {
      setAssignments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Assignment)));
      setLoading(false);
    });

    const clsQ = query(collection(db, "classes"));
    const clsUnsub = onSnapshot(clsQ, (snapshot) => {
      setClasses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Class)));
    });

    const cQ = query(collection(db, "categories"), where("teacherId", "==", profile.uid));
    const cUnsub = onSnapshot(cQ, (snapshot) => {
      setCategories(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category)));
    });

    // Submissions
    const sUnsub = onSnapshot(collection(db, "submissions"), (snapshot) => {
      setSubmissions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Submission)));
    });

    const uQ = query(collection(db, "users"), where("role", "==", "student"));
    const uUnsub = onSnapshot(uQ, (snapshot) => {
      setStudents(snapshot.docs.map(doc => doc.data() as UserProfile));
    });

    const unsubL = onSnapshot(collection(db, "users"), (snap) => {
      const allUsers = snap.docs.map(d => d.data() as UserProfile);
      setLeaderboard(allUsers.sort((a, b) => (b.points || 0) - (a.points || 0)));

      const studentUsers = allUsers.filter(u => u.role === 'student');
      
      const unsubClasses = onSnapshot(collection(db, "classes"), (cSnap) => {
         const classesData = cSnap.docs.map(d => ({id: d.id, ...d.data()} as Class));
         const standings = classesData.map(c => {
            const classUsers = studentUsers.filter(u => u.classId === c.id);
            const userPoints = classUsers.reduce((sum, u) => sum + (u.points || 0), 0);
            return { id: c.id, name: c.name, points: userPoints };
         }).sort((a,b) => b.points - a.points);
         setClassStandings(standings);
      });
      return () => unsubClasses();
    });

    return () => { unsub(); cUnsub(); sUnsub(); clsUnsub(); uUnsub(); unsubL(); };
  }, [profile.uid]);

  useEffect(() => {
    if (notificationRedirect && clearNotificationRedirect) {
      const msg = notificationRedirect.message.toLowerCase();
      const senderId = (notificationRedirect as any).senderId;
      const studentId = (notificationRedirect as any).studentId;

      if (msg.includes('message') || msg.includes('messaged')) {
        setActiveTab('students');
        if (senderId) {
          const student = students.find(s => s.uid === senderId);
          if (student) setMessagingUser(student);
        }
      } else if (msg.includes('submitted') || msg.includes('completed')) {
        setActiveTab('assignments');
        if (studentId) {
          const student = students.find(s => s.uid === studentId);
          if (student) setSelectedStudent(student);
        }
      }
      clearNotificationRedirect();
    }
  }, [notificationRedirect, students, clearNotificationRedirect]);

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName) return;
    await addDoc(collection(db, "categories"), {
      name: newCategoryName,
      teacherId: profile.uid
    });
    setNewCategoryName("");
    setShowCategoryForm(false);
  };

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClassName) return;
    await addDoc(collection(db, "classes"), {
      name: newClassName,
      teacherIds: [profile.uid],
      totalPoints: 0,
      createdAt: new Date().toISOString()
    });
    setNewClassName("");
    setShowClassForm(false);
  };

  const handleAdjustPoints = async (studentId: string, amount: number, reason: string) => {
    const userRef = doc(db, "users", studentId);
    await updateDoc(userRef, { points: increment(amount) });

    // Create notification for student
    await addDoc(collection(db, "notifications"), {
      userId: studentId,
      message: `${amount > 0 ? 'Awarded' : 'Demerit'}: ${amount} points for ${reason}`,
      read: false,
      createdAt: new Date().toISOString(),
      type: 'points'
    });
  };

  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !subject || !dueDate || !classId) {
      alert("Please select a class!");
      return;
    }

    const docRef = await addDoc(collection(db, "assignments"), {
      title,
      subject,
      dueDate,
      description,
      categoryId,
      classId,
      difficulty,
      estimatedTime,
      attachments,
      teacherId: profile.uid,
      createdAt: new Date().toISOString(),
      pointsValue,
    });
    
    // Notify all students in the class
    const studentsInClass = students.filter(s => s.classId === classId);
    const batch = writeBatch(db);
    studentsInClass.forEach(student => {
      const notifRef = doc(collection(db, "notifications"));
      batch.set(notifRef, {
        userId: student.uid,
        message: `New Assignment: "${title}" by ${profile.name}`,
        read: false,
        createdAt: new Date().toISOString(),
        type: 'assignment',
        assignmentId: docRef.id
      });
    });
    await batch.commit();

    // Add revision items
    if (revisionItemsInput.trim()) {
      const items = revisionItemsInput.split(",").map(i => i.trim()).filter(i => i);
      for (let i = 0; i < items.length; i++) {
        await addDoc(collection(db, "revisionItems"), {
          parentId: docRef.id,
          content: items[i],
          order: i
        });
      }
    }

    setTitle(""); setSubject(""); setDueDate(""); setCategoryId(""); setClassId(""); setDescription(""); setRevisionItemsInput("");
    setDifficulty("Medium"); setEstimatedTime(""); setAttachments([]);
    setShowForm(false);
  };

  const addAttachment = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!attachmentName || !attachmentUrl) return;
    setAttachments([...attachments, { name: attachmentName, url: attachmentUrl, type: "file" }]);
    setAttachmentName("");
    setAttachmentUrl("");
  };

  const removeAttachment = (index: number) => {
    setAttachments(attachments.filter((_, i) => i !== index));
  };

  const handleDeleteAssignment = async (id: string) => {
    await deleteDoc(doc(db, "assignments", id));
  };

  const handleDeleteClass = async (id: string) => {
     // Check if students are in this class first? Or just allow delete.
     // In a real app we'd check. Here we'll just delete.
     await deleteDoc(doc(db, "classes", id));
  };

  const handleUpdateStudentClass = async (studentId: string, newClassId: string) => {
     const userRef = doc(db, "users", studentId);
     await updateDoc(userRef, { classId: newClassId });
     
     // Update local state if needed (onSnapshot usually handles it)
     if (selectedStudent && selectedStudent.uid === studentId) {
        setSelectedStudent({ ...selectedStudent, classId: newClassId });
     }
  };

  const handleDeleteStudent = async (uid: string) => {
    if (window.confirm("Are you sure you want to remove this student? This will delete their profile.")) {
      await deleteDoc(doc(db, "users", uid));
    }
  };

  const getSubmissionsForAssignment = (assignmentId: string) => {
    return submissions.filter(s => s.assignmentId === assignmentId);
  };

  const handleGradeSubmission = async (submissionId: string, studentId: string, points: number) => {
    const batch = writeBatch(db);
    const subRef = doc(db, "submissions", submissionId);
    batch.update(subRef, { status: "completed" });
    
    const userRef = doc(db, "users", studentId);
    batch.update(userRef, { points: increment(points) });
    
    await batch.commit();
  };

  return (
    <div className="space-y-8">
      {/* Navigation Tabs */}
      <div className="flex items-center gap-6 border-b border-gray-100 pb-4">
        <button 
          onClick={() => { setActiveTab('assignments'); setSelectedStudent(null); }}
          className={cn(
             "flex items-center gap-2 text-sm font-bold transition-colors",
             activeTab === 'assignments' ? "text-indigo-600" : "text-gray-400 hover:text-gray-600"
          )}
        >
          <LayoutDashboard size={18} />
          Assignments
        </button>
        <button 
          onClick={() => setActiveTab('students')}
          className={cn(
             "flex items-center gap-2 text-sm font-bold transition-colors",
             activeTab === 'students' ? "text-indigo-600" : "text-gray-400 hover:text-gray-600"
          )}
        >
          <Users size={18} />
          Students
        </button>
        <button 
          onClick={() => setActiveTab('classes')}
          className={cn(
             "flex items-center gap-2 text-sm font-bold transition-colors",
             activeTab === 'classes' ? "text-indigo-600" : "text-gray-400 hover:text-gray-600"
          )}
        >
          <Star size={18} />
          Classes
        </button>
        <button 
          onClick={() => setActiveTab('leaderboard')}
          className={cn(
             "flex items-center gap-2 text-sm font-bold transition-colors",
             activeTab === 'leaderboard' ? "text-indigo-600" : "text-gray-400 hover:text-gray-600"
          )}
        >
          <Trophy size={18} />
          Hall of Fame
        </button>
        <button 
          onClick={() => setActiveTab('profile')}
          className={cn(
             "flex items-center gap-2 text-sm font-bold transition-colors",
             activeTab === 'profile' ? "text-indigo-600" : "text-gray-400 hover:text-gray-600"
          )}
        >
          <UserIcon size={18} />
          Profile
        </button>
      </div>

      <AnimatePresence mode="wait">
        {selectedStudent ? (
          <motion.div
            key="profile"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <StudentProfileView 
              student={selectedStudent} 
              classData={classes.find(c => c.id === selectedStudent.classId)}
              classList={classes}
              onClose={() => setSelectedStudent(null)}
              onMessage={(s) => setMessagingUser(s)}
              onUpdateClass={handleUpdateStudentClass}
            />
          </motion.div>
        ) : activeTab === 'leaderboard' ? (
          <motion.div
            key="leaderboard"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="space-y-8"
          >
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Individual Rankings */}
              <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
                <div className="flex items-center gap-2 mb-6">
                  <Trophy className="text-amber-500" size={24} />
                  <h3 className="text-xl font-bold text-gray-900">Hall of Fame</h3>
                </div>
                <div className="space-y-4">
                  {leaderboard.slice(0, 10).map((user, idx) => (
                    <div key={user.uid} className="flex items-center justify-between p-3 rounded-2xl hover:bg-gray-50 transition-colors">
                      <div className="flex items-center gap-4">
                        <span className={cn(
                          "w-6 text-sm font-bold",
                          idx === 0 ? "text-amber-500" : idx === 1 ? "text-gray-400" : "text-gray-300"
                        )}>{idx + 1}</span>
                        <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center text-lg border border-gray-100 relative">
                          {user.avatar || user.name.slice(0, 1).toUpperCase()}
                          {user.role === 'teacher' && (
                            <div className="absolute -top-1 -right-1 w-3 h-3 bg-indigo-600 rounded-full border-2 border-white" title="Teacher" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-sm text-gray-900">{user.name}</p>
                            {user.role === 'teacher' && <span className="text-[8px] bg-indigo-50 text-indigo-600 px-1 rounded font-black uppercase">Staff</span>}
                          </div>
                          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{user.role}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-black text-gray-900">{user.points || 0}</p>
                        <p className="text-[10px] text-gray-400 font-bold uppercase">Merits</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Class Standings */}
              <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
                <div className="flex items-center gap-2 mb-6">
                  <Star className="text-indigo-500" size={24} />
                  <h3 className="text-xl font-bold text-gray-900">House Standings</h3>
                </div>
                <div className="space-y-4">
                  {classStandings.map((cls, idx) => (
                    <div key={cls.id} className="flex items-center justify-between p-4 rounded-2xl border border-gray-50">
                      <div className="flex items-center gap-4">
                        <span className="text-lg font-black text-gray-200">#0{idx + 1}</span>
                        <div>
                          <h4 className="font-bold text-gray-900">Class {cls.name}</h4>
                          <div className="h-1.5 w-32 bg-gray-100 rounded-full mt-2 overflow-hidden">
                             <motion.div 
                               initial={{ width: 0 }}
                               animate={{ width: `${(cls.points / (classStandings[0]?.points || 1)) * 100}%` }}
                               className="h-full bg-indigo-500"
                             />
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-black text-indigo-600">{cls.points}</p>
                        <p className="text-[10px] text-gray-400 font-bold uppercase">Total Merits</p>
                      </div>
                    </div>
                  ))}
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
            className="space-y-6"
          >
            <TeacherProfileEditor profile={profile} />
          </motion.div>
        ) : activeTab === 'students' ? (
          <motion.div
            key="students"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            <div className="flex items-center justify-between">
               <h3 className="text-xl font-bold text-gray-900">Student Directory</h3>
               <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <input 
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search students..."
                    className="bg-white border border-gray-200 rounded-xl pl-10 pr-4 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 w-64"
                  />
               </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
               {students
                .filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase()))
                .map(student => {
                 const studentClass = classes.find(c => c.id === student.classId);
                 return (
                   <motion.div 
                     layout
                     key={student.uid}
                     className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm hover:border-indigo-100 transition-all group flex items-center justify-between"
                   >
                      <div 
                        className="flex items-center gap-4 cursor-pointer flex-1"
                        onClick={() => setSelectedStudent(student)}
                      >
                         <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center font-bold text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors text-2xl border border-indigo-100">
                            {student.avatar || student.name.slice(0, 2).toUpperCase()}
                         </div>
                         <div>
                            <p className="font-bold text-gray-900">{student.name}</p>
                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">
                               {studentClass ? `Class ${studentClass.name}` : 'No Class'} • {student.points || 0} Merits
                            </p>
                         </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => handleDeleteStudent(student.uid)}
                          className="p-2 hover:bg-rose-50 text-gray-300 hover:text-rose-500 rounded-lg transition-colors"
                          title="Delete Student"
                        >
                          <Trash2 size={18} />
                        </button>
                        <button 
                          onClick={() => setMessagingUser(student)}
                          className="p-2 hover:bg-indigo-50 text-gray-400 hover:text-indigo-600 rounded-lg transition-colors"
                        >
                          <MessageSquare size={18} />
                        </button>
                        <ChevronRight className="text-gray-300" size={18} />
                      </div>
                   </motion.div>
                 );
               })}
            </div>
          </motion.div>
        ) : activeTab === 'classes' ? (
          <motion.div
            key="classes"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            <div className="flex items-center justify-between">
               <h3 className="text-xl font-bold text-gray-900">Manage Classes</h3>
               <button 
                  onClick={() => setShowClassForm(!showClassForm)}
                  className="bg-green-600 text-white px-4 py-2 rounded-xl flex items-center gap-2 hover:bg-green-700 transition-colors"
               >
                 <Plus size={20} />
                 New Class
               </button>
            </div>

            {showClassForm && (
              <motion.form 
                initial={{ opacity: 0, height: 0 }} 
                animate={{ opacity: 1, height: "auto" }}
                onSubmit={handleCreateClass}
                className="bg-white p-6 rounded-3xl border border-green-100 shadow-sm flex flex-col gap-4"
              >
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">Class Name</label>
                  <input 
                    type="text" value={newClassName}
                    onChange={(e) => setNewClassName(e.target.value)}
                    placeholder="e.g. Year 10 Computing"
                    className="w-full bg-gray-50 px-4 py-2 rounded-xl outline-none border border-gray-200 focus:border-green-300"
                  />
                </div>
                <div className="flex justify-end gap-2">
                   <button type="button" onClick={() => setShowClassForm(false)} className="px-4 py-2 text-sm text-gray-500 font-bold">Cancel</button>
                   <button type="submit" className="bg-green-600 text-white px-6 py-2 rounded-xl text-sm font-bold">Create Class</button>
                </div>
              </motion.form>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {classes.map(cls => (
                <div key={cls.id} className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4">
                  <div className="flex justify-between items-start">
                    <div className="w-12 h-12 rounded-2xl bg-green-50 flex items-center justify-center text-green-600">
                      <Star size={24} />
                    </div>
                    <button 
                      onClick={() => handleDeleteClass(cls.id)}
                      className="text-gray-300 hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                  <div>
                    <h4 className="text-xl font-bold text-gray-900">Class {cls.name}</h4>
                    <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-1">
                      {students.filter(s => s.classId === cls.id).length} Students Enrolled
                    </p>
                  </div>
                  <div className="pt-4 border-t border-gray-50 flex items-center justify-between">
                     <div className="text-xs font-bold text-gray-400 uppercase">Class Merits</div>
                     <div className="text-lg font-black text-green-600">{cls.totalPoints || 0}</div>
                  </div>
                </div>
              ))}
              
              {classes.length === 0 && (
                 <div className="col-span-full py-12 text-center bg-gray-50 rounded-3xl border border-dashed border-gray-200">
                    <p className="text-gray-400">No classes created yet. Create one to start assigning students!</p>
                 </div>
              )}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="assignments"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-8"
          >
            {/* Stats row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatCard 
                icon={<BookOpen className="text-indigo-600" />} 
                title="Active Assignments" 
                value={assignments.length} 
                color="bg-indigo-50"
              />
              <StatCard 
                icon={<Calendar className="text-amber-600" />} 
                title="Upcoming Deadlines" 
                value={assignments.filter(a => new Date(a.dueDate) > new Date()).length} 
                color="bg-amber-50"
              />
              <StatCard 
                icon={<Award className="text-green-600" />} 
                title="Submissions Reviewed" 
                value={submissions.filter(s => s.status === 'completed').length} 
                color="bg-green-50"
              />
              <StatCard 
                icon={<CheckSquare className="text-amber-600" />} 
                title="In Progress" 
                value={submissions.filter(s => s.status === 'pending').length} 
                color="bg-amber-50"
              />
            </div>

            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-900">Your Assignments</h3>
              <button
                onClick={() => setShowForm(!showForm)}
                className="bg-indigo-600 text-white px-4 py-2 rounded-xl flex items-center gap-2 hover:bg-indigo-700 transition-colors"
              >
                <Plus size={20} />
                {showForm ? "Cancel" : "New Assignment"}
              </button>
            </div>

            {/* Management Row */}
            <div className="flex gap-4 items-center overflow-x-auto pb-4 scrollbar-hide">
              <button 
                 onClick={() => setShowClassForm(!showClassForm)}
                 className="flex-shrink-0 px-4 py-2 rounded-xl bg-white border border-dashed border-gray-300 text-gray-600 text-sm hover:border-green-400 hover:text-green-600 transition-all flex items-center gap-2"
              >
                <Plus size={14} />
                Create Class
              </button>
              <button 
                 onClick={() => setShowCategoryForm(!showCategoryForm)}
                 className="flex-shrink-0 px-4 py-2 rounded-xl bg-white border border-dashed border-gray-300 text-gray-600 text-sm hover:border-indigo-400 hover:text-indigo-600 transition-all flex items-center gap-2"
              >
                <Plus size={14} />
                Add Category
              </button>

              <div className="h-6 w-px bg-gray-200 mx-2"></div>

              {classes.map(cls => (
                <div key={cls.id} className="flex-shrink-0 px-4 py-2 rounded-xl bg-green-50 border border-green-100 text-green-700 text-sm font-bold">
                  Class {cls.name}
                </div>
              ))}
              {categories.map(cat => (
                <div key={cat.id} className="flex-shrink-0 px-4 py-2 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-700 text-sm font-medium">
                  {cat.name}
                </div>
              ))}
            </div>

            {showClassForm && (
              <motion.form 
                initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                onSubmit={handleCreateClass}
                className="bg-white p-4 rounded-2xl border border-green-100 shadow-sm flex gap-2"
              >
                <input 
                  type="text" value={newClassName}
                  onChange={(e) => setNewClassName(e.target.value)}
                  placeholder="Class Name (e.g. 9A)"
                  className="flex-1 bg-gray-50 px-4 py-2 rounded-xl outline-none text-sm"
                />
                <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded-xl text-sm font-bold">Create Class</button>
              </motion.form>
            )}

            {showCategoryForm && (
              <motion.form 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                onSubmit={handleCreateCategory}
                className="bg-white p-4 rounded-2xl border border-indigo-100 shadow-sm flex gap-2"
              >
                <input 
                  type="text" 
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="Category name (e.g. Homework)"
                  className="flex-1 bg-gray-50 px-4 py-2 rounded-xl outline-none border border-transparent focus:border-indigo-300 text-sm"
                />
                <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-bold">Add</button>
              </motion.form>
            )}

            {showForm && (
              <motion.form 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4"
                onSubmit={handleCreateAssignment}
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-700">Assignment Title</label>
                    <input 
                      type="text" 
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                      placeholder="e.g. History of Rome"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-700">Subject</label>
                    <input 
                      type="text" 
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                      placeholder="e.g. History"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-700">Due Date</label>
                    <input 
                      type="date" 
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-700">Category (Optional)</label>
                    <select 
                      value={categoryId}
                      onChange={(e) => setCategoryId(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                    >
                      <option value="">No Category</option>
                      {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-700">Assign to Class</label>
                    <select 
                      required
                      value={classId}
                      onChange={(e) => setClassId(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                    >
                      <option value="">Select a Class</option>
                      {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-700">Difficulty</label>
                    <select 
                      value={difficulty}
                      onChange={(e) => setDifficulty(e.target.value as any)}
                      className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                    >
                      <option value="Easy">Easy</option>
                      <option value="Medium">Medium</option>
                      <option value="Hard">Hard</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-700">Merits for Completion</label>
                    <input 
                      type="number" 
                      value={pointsValue}
                      onChange={(e) => setPointsValue(parseInt(e.target.value))}
                      className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                      placeholder="e.g. 10"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-700">Estimated Time (e.g. 45m)</label>
                    <input 
                      type="text" 
                      value={estimatedTime}
                      onChange={(e) => setEstimatedTime(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                      placeholder="e.g. 1 hour, 30 mins"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">Description</label>
                  <textarea 
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none min-h-[80px]"
                    placeholder="What should students do?"
                  />
                </div>
                
                <div className="space-y-2">
                   <label className="text-sm font-medium text-gray-700">Attachments (Optional)</label>
                   <div className="flex gap-2">
                      <input 
                        type="text" value={attachmentName} onChange={(e) => setAttachmentName(e.target.value)}
                        placeholder="Link Name" className="flex-1 px-3 py-1 text-sm border border-gray-200 rounded-lg outline-none"
                      />
                      <input 
                        type="text" value={attachmentUrl} onChange={(e) => setAttachmentUrl(e.target.value)}
                        placeholder="URL (http...)" className="flex-1 px-3 py-1 text-sm border border-gray-200 rounded-lg outline-none"
                      />
                      <button onClick={addAttachment} className="bg-gray-100 text-gray-600 px-3 py-1 rounded-lg text-xs font-bold hover:bg-indigo-600 hover:text-white transition-all">Add</button>
                   </div>
                   {attachments.length > 0 && (
                     <div className="flex flex-wrap gap-2 mt-2">
                        {attachments.map((a, i) => (
                          <div key={i} className="flex items-center gap-2 bg-indigo-50 text-indigo-600 px-2 py-1 rounded-lg text-[10px] font-bold">
                             <span className="truncate max-w-[100px]">{a.name}</span>
                             <button onClick={(e) => { e.preventDefault(); removeAttachment(i); }} className="hover:text-red-500">×</button>
                          </div>
                        ))}
                     </div>
                   )}
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">Revision Checklist (Comma separated)</label>
                  <input 
                    type="text" 
                    value={revisionItemsInput}
                    onChange={(e) => setRevisionItemsInput(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder="e.g. Read Chapter 1, Complete Worksheet, Review Formulas"
                  />
                </div>
                <div className="flex justify-end">
                   <button type="submit" className="bg-indigo-600 text-white px-6 py-2 rounded-xl font-semibold">Assign to Class</button>
                </div>
              </motion.form>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {assignments.map((assignment) => {
                const subs = getSubmissionsForAssignment(assignment.id);
                return (
                  <motion.div 
                    layout
                    key={assignment.id} 
                    className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm relative group"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div 
                         className="flex-1 cursor-pointer"
                         onClick={() => setViewingAssignmentId(viewingAssignmentId === assignment.id ? null : assignment.id)}
                      >
                        <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider">{assignment.subject}</span>
                        <h4 className="text-lg font-bold text-gray-900 mt-1">{assignment.title}</h4>
                      </div>
                      <button 
                        onClick={() => handleDeleteAssignment(assignment.id)}
                        className="text-gray-400 hover:text-red-500 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                    <p className="text-gray-500 text-sm mb-6 line-clamp-2">{assignment.description}</p>
                    
                    <div className="flex items-center justify-between text-xs text-gray-400">
                      <div className="flex items-center gap-2">
                        <Calendar size={14} />
                        <span>Due: {formatDate(assignment.dueDate)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckSquare size={14} />
                        <span className="font-medium text-indigo-600">{subs.filter(s => s.status === 'submitted').length} Pending Review</span>
                      </div>
                    </div>

                    {/* Submission Review Quick View */}
                    {viewingAssignmentId === assignment.id && (
                      <div className="mt-6 pt-6 border-t border-gray-100 space-y-4">
                        <h5 className="text-sm font-bold text-gray-900">Student Submissions</h5>
                        {subs.length === 0 ? (
                          <p className="text-xs text-gray-400 italic">No submissions yet.</p>
                        ) : (
                          subs.map(s => (
                            <div key={s.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-2xl">
                               <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-[10px] font-bold text-indigo-700">
                                     {s.studentId.slice(0, 2).toUpperCase()}
                                  </div>
                                  <div>
                                     <p className="text-xs font-bold text-gray-900">
                                       {students.find(student => student.uid === s.studentId)?.name || `Student ${s.studentId.slice(0, 4)}`}
                                     </p>
                                     <p className={cn(
                                       "text-[10px] font-bold uppercase",
                                       s.status === 'submitted' ? "text-indigo-600" : 
                                       s.status === 'pending' ? "text-amber-600" : "text-green-600"
                                     )}>
                                       {s.status === 'pending' ? 'In Progress' : s.status}
                                     </p>
                                  </div>
                               </div>
                               {s.status === 'submitted' && (
                                 <div className="flex gap-2">
                                   <button 
                                     onClick={() => handleGradeSubmission(s.id, s.studentId, 10)}
                                     className="flex items-center gap-1 bg-green-100 text-green-700 px-3 py-1 rounded-lg text-xs font-bold hover:bg-green-200 transition-colors"
                                   >
                                      Approval
                                   </button>
                                   <button 
                                     onClick={() => handleAdjustPoints(s.studentId, 2, "Bonus Effort")}
                                     className="flex items-center gap-1 bg-amber-100 text-amber-700 px-3 py-1 rounded-lg text-xs font-bold hover:bg-amber-200 transition-colors"
                                   >
                                      Bonus
                                   </button>
                                 </div>
                               )}
                               {s.status === 'completed' && (
                                 <div className="flex gap-2">
                                    <span className="text-[10px] font-bold text-green-600 flex items-center gap-1">
                                      <CheckSquare size={12} /> Approved
                                    </span>
                                    <button 
                                      onClick={() => handleAdjustPoints(s.studentId, -5, "Misconduct")}
                                      className="text-[10px] font-bold text-red-600 hover:underline"
                                    >
                                      Demerit
                                    </button>
                                 </div>
                               )}
                            </div>
                          ))
                        )}
                      </div>
                    )}
                    
                    {!viewingAssignmentId && subs.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-gray-50">
                        <p className="text-xs font-semibold text-gray-400 uppercase mb-2">Submissions ({subs.length})</p>
                        <div className="flex flex-wrap gap-2">
                          {subs.map(s => (
                            <div 
                              key={s.id} 
                              className={cn(
                                "w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold border",
                                s.status === 'completed' ? "bg-green-50 border-green-200 text-green-700" : "bg-indigo-50 border-indigo-200 text-indigo-700"
                              )}
                              title={s.status}
                            >
                              {s.studentId.slice(0, 2).toUpperCase()}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {messagingUser && (
          <ChatWindow 
            currentUser={profile} 
            otherUser={{ uid: messagingUser.uid, name: messagingUser.name, role: messagingUser.role }} 
            onClose={() => setMessagingUser(null)} 
          />
        )}
      </AnimatePresence>
    </div>
  );
}


function StatCard({ icon, title, value, color }: { icon: React.ReactNode, title: string, value: number | string, color: string }) {
  return (
    <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex items-center gap-4">
      <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center", color)}>
        {icon}
      </div>
      <div>
        <p className="text-gray-500 text-sm font-medium">{title}</p>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
      </div>
    </div>
  );
}
