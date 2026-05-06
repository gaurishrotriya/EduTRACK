# Security Specification for EduTrack

## Data Invariants
1. A submission must reference a valid assignment and student.
2. Only teachers can award points for quality.
3. Students receive base points automatically upon "on-time" completion (can be handled by checking timestamp vs deadline).
4. Users cannot change their own roles in their profile.

## The Dirty Dozen Payloads (Rejection Tests)
1. **Identity Theft**: Student attempts to update another student's submission.
2. **Role Escalation**: Student attempts to set their profile `role` to 'teacher'.
3. **Point Injection**: Student attempts to award themselves quality points.
4. **Assignment Forgery**: Student attempts to create an assignment.
5. **Category Hijacking**: Student attempts to create a category.
6. **Notification Snooping**: User attempts to read another user's notifications.
7. **Deadline Bypass**: Student attempts to mark a late assignment as "on-time" by changing the submission status/timestamp.
8. **Test Leak**: Student tries to see a test before it's "released" (if we had a release field, but for now we'll assume they can see upcoming ones). Actually, let's say they can't delete tests.
9. **Shadow Fields**: Adding `isAdmin: true` to a user profile.
10. **Revision Manipulation**: Student attempts to edit a checklist item created by a teacher.
11. **Mass Delete**: Student attempts to delete the entire `assignments` collection.
12. **Id Poisoning**: Using a 1MB string as a document ID.

## Draft Rules Strategy
- `User`: `role` set on first creation, then immutable.
- `Submission`: Students can create if `studentId == request.auth.uid`. Update restricted to specific fields (status, revisionCompleted).
- `Assignment`: Teachers only.
- `Category`: Teachers only.
- `Notification`: Owner only.
