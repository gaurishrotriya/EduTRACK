export type UserRole = "teacher" | "student";

export interface UserProfile {
  uid: string;
  email: string;
  name: string;
  role: UserRole;
  points?: number;
  classId?: string;
  createdAt: string;
}

export interface Class {
  id: string;
  name: string;
  teacherIds: string[];
  totalPoints: number;
}

export interface Assignment {
  id: string;
  title: string;
  description: string;
  subject: string;
  classId: string;
  dueDate: string;
  createdAt: string;
  teacherId: string;
  categoryId?: string;
  pointsValue: number;
}

export interface Category {
  id: string;
  name: string;
  teacherId: string;
}

export interface Submission {
  id: string;
  assignmentId: string;
  studentId: string;
  status: "pending" | "submitted" | "completed" | "late";
  pointsAwarded?: number;
  feedback?: string;
  submittedAt?: string;
  revisionCompleted?: string[];
}

export interface Test {
  id: string;
  title: string;
  subject: string;
  date: string;
  teacherId: string;
  description?: string;
}

export interface RevisionItem {
  id: string;
  parentId: string; // Assignment ID or Test ID
  content: string;
  order: number;
}

export interface Notification {
  id: string;
  userId: string;
  message: string;
  read: boolean;
  createdAt: string;
  type: string;
}

export interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  text: string;
  createdAt: string;
  participants: string[];
}
