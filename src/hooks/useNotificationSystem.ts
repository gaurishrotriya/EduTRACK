import { useEffect, useRef } from 'react';
import { collection, query, where, onSnapshot, limit, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { Notification as AppNotification } from '../types';

// A short "ping" sound as a data URI
const PING_SOUND = "data:audio/mpeg;base64,SUQzBAAAAAABAFRYWFgAAAASAAADbWFqb3JfYnJhbmQAZGFzaABUWFhYAAAAEgAAArptaW5vcl92ZXJzaW9uADBUWFhYAAAAHAAAA2NvbXBhdGlibGVfYnJhbmRzAGlzbzZtcDRhMQBUU0UAAAAKAAADbGF2ZjYwLjMuMTAwAAAAAAAAAAAAAAD/80BkAAAAAAAAAAAAAAAAAAAAAAAASW5mbwAAAA8AAAAKAAAIkABVUVVUVVFVUVVUVVFVUVVUVVFVUVVUVVFVUVVUVVFVUVVUVVFVUVVUVVFVUVVUVVFVUVVUVVFVUVVUVVFVUVVUVVFVUVVUVVFVUVVUVVFVUVVUVVFVUVVUVVFVUVVUVVFV//+6ZpYAAEgAAtUAAAAAEAAAfwAAAACu7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7v/zQGQYAAAyAD+IAAAAAIAAAfQAAAADu7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u//+6Zp4AApAAAtUAAAAAEAAAfwAAAACu7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7v/zQGQeAAAyAD+IAAAAAIAAAfQAAAADu7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u//+6Zp4AA0AAAtUAAAAAEAAAfwAAAACu7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7v/zQGQfAAAyAD+IAAAAAIAAAfQAAAADu7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u//+6Zp4AA8AAAtUAAAAAEAAAfwAAAACu7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7v/zQGQmAAAyAD+IAAAAAIAAAfQAAAADu7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u//+6Zp4ABKAAAtUAAAAAEAAAfwAAAACu7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7v/";

export function useNotificationSystem(userId: string | undefined) {
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);
  const isInitializedRef = useRef(false);
  const lastNotificationIdRef = useRef<string | null>(null);

  // Initialize audio on first click anywhere
  useEffect(() => {
    const initAudio = async () => {
      if (isInitializedRef.current) return;
      
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        const ctx = new AudioContextClass();
        audioContextRef.current = ctx;

        const base64Data = PING_SOUND.split(',')[1];
        const binaryString = window.atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        audioBufferRef.current = await ctx.decodeAudioData(bytes.buffer);
        
        isInitializedRef.current = true;
        
        // Remove listeners
        window.removeEventListener('click', initAudio);
        window.removeEventListener('touchstart', initAudio);
      } catch (err) {
        console.error("Failed to initialize audio:", err);
      }
    };

    window.addEventListener('click', initAudio);
    window.addEventListener('touchstart', initAudio);

    // Request notification permission
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }

    return () => {
      window.removeEventListener('click', initAudio);
      window.removeEventListener('touchstart', initAudio);
    };
  }, []);

  const playPing = () => {
    if (!audioContextRef.current || !audioBufferRef.current) return;
    
    try {
      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBufferRef.current;
      source.connect(audioContextRef.current.destination);
      source.start();
    } catch (err) {
      console.error("Error playing sound:", err);
    }
  };

  const showSystemNotification = (title: string, body: string) => {
    if ("Notification" in window && Notification.permission === "granted") {
      // Use Service Worker for notification if available, as it's more robust
      if (navigator.serviceWorker && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'NOTIFY',
          title,
          message: body
        });
      } else {
        new Notification(title, {
          body,
          icon: "/favicon.ico"
        });
      }
    }
  };

  useEffect(() => {
    if (!userId) return;

    const q = query(
      collection(db, "notifications"),
      where("userId", "==", userId),
      orderBy("createdAt", "desc"),
      limit(1)
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      if (snap.empty) return;
      
      const latest = { id: snap.docs[0].id, ...snap.docs[0].data() } as AppNotification;
      
      // If this is a new notification (not the one we saw on initial load or previous snapshot)
      if (lastNotificationIdRef.current && lastNotificationIdRef.current !== latest.id && !latest.read) {
        playPing();
        showSystemNotification("EduTrack Notification", latest.message);
      }
      
      lastNotificationIdRef.current = latest.id;
    }, (error) => {
      console.error("Notification listener error:", error);
    });

    return () => unsubscribe();
  }, [userId]);

  return { playPing };
}
