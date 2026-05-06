import { useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, getDoc, setDoc, onSnapshot, collection } from "firebase/firestore";
import { auth, db, loginWithGoogle } from "./firebase";
import { UserProfile, UserRole, Class } from "./types";
import Layout from "./components/Layout";
import TeacherDashboard from "./components/TeacherDashboard";
import StudentDashboard from "./components/StudentDashboard";
import { Loader2, GraduationCap, School } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState<Class[]>([]);
  const [pendingSelection, setPendingSelection] = useState<{ role: UserRole | null, classId?: string }>({ role: null });

  useEffect(() => {
    // Fetch all classes for selection
    const unsubClasses = onSnapshot(collection(db, "classes"), (snap) => {
      setClasses(snap.docs.map(d => ({ id: d.id, ...d.data() } as Class)));
    });

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        const docRef = doc(db, "users", firebaseUser.uid);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          setProfile(docSnap.data() as UserProfile);
        } else {
          setPendingSelection({ role: null });
        }
      } else {
        setUser(null);
        setProfile(null);
      }
      setLoading(false);
    });

    return () => { unsubscribe(); unsubClasses(); };
  }, []);

  const handleFinalizeOnboarding = async (role: UserRole, classId?: string) => {
    if (!user) return;
    
    const newProfile: UserProfile = {
      uid: user.uid,
      email: user.email!,
      name: user.displayName || "User",
      role,
      classId: classId || "",
      points: 0,
      createdAt: new Date().toISOString(),
    };

    await setDoc(doc(db, "users", user.uid), newProfile);
    setProfile(newProfile);
  };

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-gray-50 px-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-white p-8 rounded-3xl shadow-sm border border-gray-100 text-center"
        >
          <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <School className="text-white w-8 h-8" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">EduTrack</h1>
          <p className="text-gray-500 mb-8">Your modern school assistant</p>
          <button
            onClick={loginWithGoogle}
            className="w-full bg-indigo-600 text-white rounded-xl py-3 font-semibold hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
          >
            Sign in with Google
          </button>
        </motion.div>
      </div>
    );
  }

  if (!profile) {
    if (pendingSelection.role === null) {
      return (
        <div className="h-screen w-full flex items-center justify-center bg-gray-50 px-4">
          <div className="max-w-lg w-full text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-8">Choose your role</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                onClick={() => setPendingSelection({ role: "teacher" })}
                className="bg-white p-8 rounded-3xl border-2 border-transparent hover:border-indigo-600 transition-all shadow-sm flex flex-col items-center gap-4 group"
              >
                <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center group-hover:bg-indigo-600 transition-colors">
                  <School className="w-8 h-8 text-indigo-600 group-hover:text-white" />
                </div>
                <span className="font-bold text-xl text-gray-900">Teacher</span>
                <p className="text-gray-500 text-sm">Create classes and assignments</p>
              </button>
              <button
                onClick={() => setPendingSelection({ role: "student" })}
                className="bg-white p-8 rounded-3xl border-2 border-transparent hover:border-indigo-600 transition-all shadow-sm flex flex-col items-center gap-4 group"
              >
                <div className="w-16 h-16 bg-green-50 rounded-2xl flex items-center justify-center group-hover:bg-green-600 transition-colors">
                  <GraduationCap className="w-8 h-8 text-green-600 group-hover:text-white" />
                </div>
                <span className="font-bold text-xl text-gray-900">Student</span>
                <p className="text-gray-500 text-sm">Join your class and start learning</p>
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (pendingSelection.role === "student" && !pendingSelection.classId) {
      return (
        <div className="h-screen w-full flex items-center justify-center bg-gray-50 px-4">
          <div className="max-w-md w-full text-center bg-white p-10 rounded-3xl shadow-sm border border-gray-100">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Select your Class</h2>
            <p className="text-gray-500 mb-6 font-medium">To see your assignments, you need to be in a class.</p>
            <div className="space-y-3">
              {classes.length === 0 ? (
                <p className="text-amber-600 text-sm italic">Waiting for teachers to create classes...</p>
              ) : (
                classes.map(c => (
                  <button 
                    key={c.id} 
                    onClick={() => handleFinalizeOnboarding("student", c.id)}
                    className="w-full text-left p-4 rounded-2xl bg-gray-50 hover:bg-indigo-50 border border-gray-100 hover:border-indigo-200 transition-all font-bold text-gray-700"
                  >
                    Class {c.name}
                  </button>
                ))
              )}
              <button 
                onClick={() => setPendingSelection({ role: null })}
                className="w-full text-gray-400 text-sm mt-4 underline"
              >
                Go back
              </button>
            </div>
          </div>
        </div>
      );
    }

    // Teachers don't necessarily need a classId immediately
    if (pendingSelection.role === "teacher") {
      handleFinalizeOnboarding("teacher");
    }

    return (
      <div className="h-screen w-full flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  const userProfile = profile;

  return (
    <Layout profile={userProfile}>
      <AnimatePresence mode="wait">
        {userProfile.role === "teacher" ? (
          <TeacherDashboard profile={userProfile} />
        ) : (
          <StudentDashboard profile={userProfile} />
        )}
      </AnimatePresence>
    </Layout>
  );
}
