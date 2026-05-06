import React, { useState, useEffect } from "react";
import { UserProfile, Assignment, Submission, Class } from "../types";
import { db } from "../firebase";
import { collection, query, where, onSnapshot, doc, getDoc } from "firebase/firestore";
import { ArrowLeft, BookOpen, Clock, CheckCircle2, AlertCircle, MessageSquare, Award } from "lucide-react";
import { motion } from "framer-motion";
import { cn, formatDate } from "../lib/utils";

interface ProfileViewProps {
  student: UserProfile;
  classData?: Class;
  onClose: () => void;
  onMessage: (student: UserProfile) => void;
}

export default function StudentProfileView({ student, classData, onClose, onMessage }: ProfileViewProps) {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);

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

  const getStatus = (assignmentId: string) => {
    const sub = submissions.find(s => s.assignmentId === assignmentId);
    if (!sub) return "Pending";
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
        <div>
           <h2 className="text-2xl font-bold text-gray-900">{student.name}</h2>
           <p className="text-sm text-gray-500 font-medium">Class {classData?.name || 'Unassigned'} • Student Profile</p>
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
        <div className="md:col-span-2 space-y-4">
           <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">Assignments Log</h3>
              <span className="text-xs font-bold text-gray-400 underline">{assignments.length} Total</span>
           </div>

           <div className="space-y-3">
              {assignments.map(assignment => {
                const status = getStatus(assignment.id);
                const sub = submissions.find(s => s.assignmentId === assignment.id);

                return (
                  <div key={assignment.id} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between group hover:border-indigo-100 transition-all">
                     <div className="flex items-center gap-4">
                        <div className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center",
                          status === 'completed' ? "bg-green-50 text-green-600" : 
                          status === 'submitted' ? "bg-indigo-50 text-indigo-600" : "bg-gray-50 text-gray-400"
                        )}>
                          {status === 'completed' ? <CheckCircle2 size={20} /> : <BookOpen size={20} />}
                        </div>
                        <div>
                           <h4 className="font-bold text-gray-900 group-hover:text-indigo-600 transition-colors">{assignment.title}</h4>
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
                           "text-[10px] font-bold px-2 py-1 rounded-lg inline-block",
                           status === 'completed' ? "bg-green-100 text-green-700" :
                           status === 'submitted' ? "bg-indigo-100 text-indigo-700" : "bg-amber-50 text-amber-600 border border-amber-100"
                        )}>
                           {status === 'completed' ? `GRADED (${sub?.pointsAwarded} JP)` : 
                            status === 'submitted' ? "PENDING REVIEW" : "NOT SUBMITTED"}
                        </div>
                        {sub?.submittedAt && (
                          <p className="text-[8px] text-gray-400 mt-1 uppercase tracking-tighter">Sub: {formatDate(sub.submittedAt)}</p>
                        )}
                     </div>
                  </div>
                );
              })}

              {assignments.length === 0 && (
                <div className="text-center p-12 bg-gray-50 rounded-3xl border border-dashed border-gray-200">
                   <AlertCircle className="mx-auto text-gray-300 mb-2" size={32} />
                   <p className="text-sm text-gray-400">No assignments assigned to this student's class yet.</p>
                </div>
              )}
           </div>
        </div>
      </div>
    </div>
  );
}
