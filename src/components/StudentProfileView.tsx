import React, { useState, useEffect } from "react";
import { UserProfile, Assignment, Submission, Class } from "../types";
import { db } from "../firebase";
import { collection, query, where, onSnapshot, doc, getDoc, updateDoc, increment } from "firebase/firestore";
import { ArrowLeft, BookOpen, Clock, CheckCircle2, AlertCircle, MessageSquare, Award, Plus } from "lucide-react";
import { motion } from "framer-motion";
import { cn, formatDate } from "../lib/utils";

interface ProfileViewProps {
  student: UserProfile;
  classData?: Class;
  classList?: Class[];
  onClose: () => void;
  onMessage: (student: UserProfile) => void;
  onUpdateClass?: (studentId: string, newClassId: string) => void;
}

export default function StudentProfileView({ student, classData, classList = [], onClose, onMessage, onUpdateClass }: ProfileViewProps) {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditingClass, setIsEditingClass] = useState(false);

  useEffect(() => {
    if (!student.classId) return;

    // Fetch assignments for the student's class
    const qA = query(collection(db, "assignments"), where("classId", "==", student.classId));
    const unsubA = onSnapshot(qA, (snap) => {
      setAssignments(snap.docs.map(d => ({ id: d.id, ...d.data() } as Assignment)));
    });

    // Fetch student's submissions
    const qS = query(collection(db, "submissions"), where("studentId", "==", student.uid));
    const unsubS = onSnapshot(qS, (snap) => {
      setSubmissions(snap.docs.map(d => ({ id: d.id, ...d.data() } as Submission)));
      setLoading(false);
    });

    return () => { unsubA(); unsubS(); };
  }, [student.classId, student.uid]);

  const [showAwardPoints, setShowAwardPoints] = useState(false);
  const [awardAmount, setAwardAmount] = useState(10);
  const [awarding, setAwarding] = useState(false);

  const handleAwardPoints = async () => {
    setAwarding(true);
    try {
      const userRef = doc(db, "users", student.uid);
      await updateDoc(userRef, { points: increment(awardAmount) });
      setShowAwardPoints(false);
    } catch (error) {
      console.error("Error awarding points:", error);
    } finally {
      setAwarding(false);
    }
  };

  const getStatus = (assignmentId: string) => {
    const sub = submissions.find(s => s.assignmentId === assignmentId);
    if (!sub) return "not_started";
    return sub.status;
  };

  const completedCount = submissions.filter(s => s.status === 'completed').length;
  const progress = assignments.length > 0 ? (completedCount / assignments.length) * 100 : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 mb-8">
        <button 
           onClick={onClose}
           className="p-2 hover:bg-gray-100 rounded-xl transition-colors text-gray-400"
        >
          <ArrowLeft size={24} />
        </button>
        <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center text-4xl border border-indigo-100">
           {student.avatar || "🎓"}
        </div>
        <div>
           <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
             {student.name}
             <span className="text-xs bg-gray-100 px-2 py-1 rounded-lg text-gray-500 font-bold">Age {student.age || '15'}</span>
           </h2>
           <div className="flex items-center gap-2">
             {isEditingClass ? (
               <select 
                 className="text-sm bg-indigo-50 border border-indigo-200 rounded-lg px-2 py-1 outline-none text-indigo-600 font-bold"
                 value={student.classId}
                 onChange={(e) => {
                   onUpdateClass?.(student.uid, e.target.value);
                   setIsEditingClass(false);
                 }}
                 onBlur={() => setIsEditingClass(false)}
                 autoFocus
               >
                 <option value="">Move to Class...</option>
                 {classList.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
               </select>
             ) : (
               <p 
                 className="text-sm text-gray-500 font-medium cursor-pointer hover:text-indigo-600 transition-colors"
                 onClick={() => setIsEditingClass(true)}
               >
                 Class {classData?.name || 'Unassigned'} • Student Profile {onUpdateClass && <span className="text-[10px] bg-gray-100 px-1 rounded ml-1">Change</span>}
               </p>
             )}
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Stats Column */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
             <div className="flex items-center justify-between mb-6">
                <span className="text-xs font-bold text-indigo-600 uppercase tracking-widest">Performance</span>
                <Award className="text-amber-500" size={20} />
             </div>
             <div className="text-3xl font-black text-gray-900 mb-2">{student.points || 0} BP</div>
             <p className="text-xs text-gray-400 font-semibold mb-6 uppercase">Total Battle Points</p>
             
             {showAwardPoints ? (
               <div className="space-y-4 mb-6 p-4 bg-amber-50 rounded-2xl border border-amber-100">
                  <p className="text-xs font-bold text-amber-700 uppercase">Award Bonus Points</p>
                  <div className="flex gap-2">
                     <input 
                       type="number" 
                       value={awardAmount}
                       onChange={(e) => setAwardAmount(parseInt(e.target.value))}
                       className="w-full px-3 py-2 bg-white border border-amber-200 rounded-xl outline-none text-sm font-bold"
                     />
                     <button 
                       onClick={handleAwardPoints}
                       disabled={awarding}
                       className="bg-amber-500 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-amber-600 transition-all disabled:opacity-50"
                     >
                       {awarding ? '...' : 'Award'}
                     </button>
                  </div>
                  <button onClick={() => setShowAwardPoints(false)} className="text-[10px] text-amber-600 font-bold underline">Cancel</button>
               </div>
             ) : (
               <button 
                 onClick={() => setShowAwardPoints(true)}
                 className="w-full mb-6 p-3 bg-amber-50 text-amber-600 rounded-2xl text-xs font-bold hover:bg-amber-100 transition-all flex items-center justify-center gap-2"
               >
                 <Plus size={14} />
                 Special Award
               </button>
             )}

             <div className="space-y-4">
                <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                   <motion.div 
                     initial={{ width: 0 }}
                     animate={{ width: `${progress}%` }}
                     className="h-full bg-indigo-600"
                   />
                </div>
                <div className="flex justify-between text-xs font-bold">
                   <span className="text-gray-400">Assignment Completion</span>
                   <span className="text-indigo-600">{Math.round(progress)}%</span>
                </div>
             </div>
          </div>

          <button 
            onClick={() => onMessage(student)}
            className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white p-4 rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-md active:scale-95"
          >
            <MessageSquare size={20} />
            Message Student
          </button>
        </div>

        {/* Assignments Column */}
        <div className="md:col-span-2 space-y-8">
           {/* In Progress / Incomplete */}
           <div className="space-y-4">
              <div className="flex items-center justify-between">
                 <h3 className="text-lg font-bold text-gray-900 border-l-4 border-amber-400 pl-3">Incomplete Assignments</h3>
                 <span className="text-xs font-bold text-gray-400">
                    {assignments.filter(a => {
                      const status = getStatus(a.id);
                      return status !== 'completed' && status !== 'submitted';
                    }).length} Pending
                 </span>
              </div>
              <div className="space-y-3">
                 {assignments.filter(a => {
                   const status = getStatus(a.id);
                   return status !== 'completed' && status !== 'submitted';
                 }).map(assignment => {
                   const status = getStatus(assignment.id);
                   return (
                     <div key={assignment.id} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between group hover:border-amber-100 transition-all">
                        <div className="flex items-center gap-4">
                           <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-amber-50 text-amber-600">
                              <BookOpen size={20} />
                           </div>
                           <div>
                              <h4 className="font-bold text-gray-900">{assignment.title}</h4>
                              <div className="flex items-center gap-3 mt-1">
                                 <span className="text-[10px] px-2 py-0.5 bg-gray-100 text-gray-500 rounded font-bold uppercase">{assignment.subject}</span>
                                 <div className="flex items-center gap-1 text-[10px] text-gray-400">
                                   <Clock size={10} />
                                   {formatDate(assignment.dueDate)}
                                 </div>
                              </div>
                           </div>
                        </div>
                        <div className="text-right">
                           <div className={cn(
                              "text-[10px] font-bold px-2 py-1 rounded-lg inline-block text-center min-w-[100px]",
                              status === 'pending' ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-500"
                           )}>
                              {status === 'pending' ? "IN PROGRESS" : "NOT STARTED"}
                           </div>
                        </div>
                     </div>
                   );
                 })}
                 {assignments.filter(a => {
                   const status = getStatus(a.id);
                   return status !== 'completed' && status !== 'submitted';
                 }).length === 0 && (
                   <p className="text-sm text-gray-400 italic bg-gray-50 p-4 rounded-2xl text-center">No incomplete assignments!</p>
                 )}
              </div>
           </div>

           {/* Completed / Submitted */}
           <div className="space-y-4">
              <div className="flex items-center justify-between">
                 <h3 className="text-lg font-bold text-gray-900 border-l-4 border-green-400 pl-3">Completed Assignments</h3>
                 <span className="text-xs font-bold text-gray-400">
                    {assignments.filter(a => {
                      const status = getStatus(a.id);
                      return status === 'completed' || status === 'submitted';
                    }).length} Done
                 </span>
              </div>
              <div className="space-y-3">
                 {assignments.filter(a => {
                   const status = getStatus(a.id);
                   return status === 'completed' || status === 'submitted';
                 }).map(assignment => {
                   const status = getStatus(assignment.id);
                   const sub = submissions.find(s => s.assignmentId === assignment.id);
                   return (
                     <div key={assignment.id} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between group hover:border-green-100 transition-all opacity-80">
                        <div className="flex items-center gap-4">
                           <div className={cn(
                             "w-10 h-10 rounded-xl flex items-center justify-center",
                             status === 'completed' ? "bg-green-50 text-green-600" : "bg-indigo-50 text-indigo-600"
                           )}>
                              {status === 'completed' ? <CheckCircle2 size={20} /> : <BookOpen size={20} />}
                           </div>
                           <div>
                              <h4 className="font-bold text-gray-900">{assignment.title}</h4>
                              <div className="flex items-center gap-3 mt-1">
                                 <span className="text-[10px] px-2 py-0.5 bg-gray-100 text-gray-500 rounded font-bold uppercase">{assignment.subject}</span>
                              </div>
                           </div>
                        </div>
                        <div className="text-right">
                           <div className={cn(
                              "text-[10px] font-bold px-2 py-1 rounded-lg inline-block text-center min-w-[100px]",
                              status === 'completed' ? "bg-green-100 text-green-700" : "bg-indigo-100 text-indigo-700"
                           )}>
                              {status === 'completed' ? `GRADED (+${sub?.pointsAwarded} BP)` : "PENDING REVIEW"}
                           </div>
                           {sub?.submittedAt && (
                             <p className="text-[8px] text-gray-400 mt-1 uppercase tracking-tighter">Done: {formatDate(sub.submittedAt)}</p>
                           )}
                        </div>
                     </div>
                   );
                 })}
                 {assignments.filter(a => {
                   const status = getStatus(a.id);
                   return status === 'completed' || status === 'submitted';
                 }).length === 0 && (
                   <p className="text-sm text-gray-400 italic bg-gray-50 p-4 rounded-2xl text-center">No completed assignments yet.</p>
                 )}
              </div>
           </div>

           {assignments.length === 0 && (
             <div className="text-center p-12 bg-gray-50 rounded-3xl border border-dashed border-gray-200">
                <AlertCircle className="mx-auto text-gray-300 mb-2" size={32} />
                <p className="text-sm text-gray-400">No assignments assigned to this student's class yet.</p>
             </div>
           )}
        </div>
      </div>
    </div>
  );
}
