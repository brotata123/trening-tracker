// ============================================================
//  FIREBASE — KONFIGURACJA
//
//  Uzupełnij swoimi danymi z Firebase Console:
//  1. Wejdź na https://console.firebase.google.com
//  2. Utwórz nowy projekt (np. "trening-tracker")
//  3. Project settings → Your apps → Add app → Web
//  4. Skopiuj obiekt firebaseConfig i wklej poniżej
//
//  Firestore: Utwórz bazę danych w trybie "test mode"
//  (możesz zabezpieczyć reguły później)
// ============================================================

const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyCj9ODbWjzkVZZMe5fpAczY5Mo-Pdo-4Y4",
  authDomain:        "kalendarz-2e225.firebaseapp.com",
  projectId:         "kalendarz-2e225",
  storageBucket:     "kalendarz-2e225.firebasestorage.app",
  messagingSenderId: "886875628607",
  appId:             "1:886875628607:web:28551f147b8b1f40e8448a"
};

// ============================================================
//  STRUKTURA DANYCH FIRESTORE
//
//  users/{userId}/
//    workouts/{workoutId}   — zapisane treningi
//    plans/{planId}         — plany treningowe
//
//  Reguły Firestore (Firebase Console → Firestore → Rules):
//
//  rules_version = '2';
//  service cloud.firestore {
//    match /databases/{database}/documents {
//      match /users/{userId}/{document=**} {
//        allow read, write: if true;
//      }
//    }
//  }
// ============================================================
