// The developer's own Firebase user ID (Firebase console → Authentication → Users → "User UID").
// Only this account sees the owner-only tools (the New Players preview). It is a
// display switch, not a lock: real protection is in firestore.rules.
export const OWNER_UID = 'M8LqHZ0LwLXDHnMiLzOWZ5EsZFA3';
export const isOwner = u => !!u && !!OWNER_UID && u.uid === OWNER_UID;
