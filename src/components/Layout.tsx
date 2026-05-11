import React, { useState, useEffect } from "react";
import { UserProfile, Notification } from "../types";
import { logout, db } from "../firebase";
import { collection, query, where, onSnapshot, doc, updateDoc, orderBy, limit } from "firebase/firestore";
import { LogOut, LayoutDashboard, User as UserIcon, Bell, X, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn, formatDate } from "../lib/utils";

interface LayoutProps {
  children: React.ReactNode;
  profile: UserProfile;
  onNotificationClick?: (notification: Notification) => void;
}

export default function Layout({ children, profile, onNotificationClick }: LayoutProps) {
  const [hasUnread, setHasUnread] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);

  useEffect(() => {
    const qUnread = query(collection(db, "notifications"), where("userId", "==", profile.uid), where("read", "==", false));
    const unsubUnread = onSnapshot(qUnread, (snap) => {
      setHasUnread(!snap.empty);
    });

    const qAll = query(
      collection(db, "notifications"), 
      where("userId", "==", profile.uid), 
      orderBy("createdAt", "desc"),
      limit(10)
    );
    const unsubAll = onSnapshot(qAll, (snap) => {
      setNotifications(snap.docs.map(d => ({ id: d.id, ...d.data() } as Notification)));
    });

    return () => {
      unsubUnread();
      unsubAll();
    };
  }, [profile.uid]);

  const markAsRead = async (notificationId: string) => {
    const ref = doc(db, "notifications", notificationId);
    await updateDoc(ref, { read: true });
  };

  const markAllAsRead = async () => {
    notifications.forEach(async (n) => {
      if (!n.read) {
        await markAsRead(n.id);
      }
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar - Desktop */}
      <aside className="hidden md:flex flex-col w-64 bg-white border-r border-gray-100 p-6 fixed h-full">
        <div className="flex items-center gap-3 mb-10 px-2">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center">
            <LayoutDashboard className="text-white w-6 h-6" />
          </div>
          <span className="font-bold text-xl text-gray-900">EduTrack</span>
        </div>

        <nav className="flex-1 space-y-2">
          <NavItem icon={<LayoutDashboard size={20} />} label="Dashboard" active />
          {/* Add more nav items as needed */}
        </nav>

        <div className="mt-auto pt-6 border-t border-gray-100">
          <div className="flex items-center gap-3 px-2 mb-6">
            <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center overflow-hidden border border-indigo-100 text-xl">
               {profile.avatar || profile.name.slice(0, 1).toUpperCase()}
            </div>
            <div className="flex-1 overflow-hidden">
               <p className="font-bold text-sm text-gray-900 truncate">{profile.name}</p>
               <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest truncate">
                 {profile.role === 'teacher' ? (profile.subjects?.[0] || 'Faculty') : `Age ${profile.age || '?'}`}
               </p>
            </div>
          </div>
          <button
            onClick={() => logout()}
            className="w-full flex items-center gap-3 px-3 py-2 text-red-600 hover:bg-red-50 rounded-xl transition-colors text-sm font-medium"
          >
            <LogOut size={18} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 md:ml-64 p-4 md:p-8 overflow-x-hidden">
        <header className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Welcome back, {profile.name.split(' ')[0]}!</h2>
            <p className="text-gray-500">Here's what's happening today.</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative">
              <button 
                onClick={() => setShowNotifications(!showNotifications)}
                className="p-2 text-gray-400 hover:bg-gray-100 rounded-full relative transition-colors"
                id="notification-bell"
              >
                <Bell size={24} />
                {hasUnread && (
                  <span className="absolute top-2.5 right-2.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>
                )}
              </button>

              <AnimatePresence>
                {showNotifications && (
                  <>
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="fixed inset-0 z-40" 
                      onClick={() => setShowNotifications(false)}
                    />
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute right-0 mt-2 w-80 bg-white rounded-3xl shadow-2xl border border-gray-100 z-50 overflow-hidden"
                    >
                      <div className="p-4 border-b border-gray-50 flex items-center justify-between">
                        <h4 className="font-bold text-gray-900">Notifications</h4>
                        {hasUnread && (
                          <button 
                            onClick={markAllAsRead}
                            className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700 uppercase tracking-widest"
                          >
                            Mark all as read
                          </button>
                        )}
                      </div>
                      <div className="max-h-96 overflow-y-auto">
                        {notifications.length === 0 ? (
                          <div className="p-8 text-center">
                            <Bell size={32} className="mx-auto text-gray-200 mb-2" />
                            <p className="text-xs text-gray-400 font-medium">No notifications yet</p>
                          </div>
                        ) : (
                          <div className="divide-y divide-gray-50">
                            {notifications.map((n) => (
                              <div 
                                key={n.id} 
                                className={cn(
                                  "p-4 hover:bg-gray-50 transition-colors cursor-pointer relative group",
                                  !n.read ? "bg-indigo-50/30" : ""
                                )}
                                onClick={() => {
                                  markAsRead(n.id);
                                  onNotificationClick?.(n);
                                  setShowNotifications(false);
                                }}
                              >
                                <div className="flex gap-3">
                                  <div className={cn(
                                    "w-2 h-2 rounded-full mt-1.5 shrink-0",
                                    !n.read ? "bg-indigo-600" : "bg-transparent"
                                  )} />
                                  <div className="space-y-1">
                                    <p className={cn(
                                      "text-sm leading-snug",
                                      !n.read ? "text-gray-900 font-semibold" : "text-gray-600"
                                    )}>
                                      {n.message}
                                    </p>
                                    <p className="text-[10px] text-gray-400 font-medium">
                                      {formatDate(n.createdAt)}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
            <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-2xl shadow-sm border border-gray-100">
               <span className="text-amber-500 font-bold">✨ {profile.points || 0} Merits</span>
            </div>
          </div>
        </header>

        <motion.div
           initial={{ opacity: 0, y: 10 }}
           animate={{ opacity: 1, y: 0 }}
           transition={{ duration: 0.3 }}
        >
          {children}
        </motion.div>
      </main>
    </div>
  );
}

function NavItem({ icon, label, active = false }: { icon: React.ReactNode; label: string; active?: boolean }) {
  return (
    <button
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
        active 
          ? "bg-indigo-50 text-indigo-600 font-bold shadow-sm" 
          : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
      }`}
    >
      {icon}
      <span className="text-sm">{label}</span>
    </button>
  );
}
