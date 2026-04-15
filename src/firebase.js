import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAZlxhuC5-6aSlcGTwgFYlgh4Oj7OP2Yls",
  authDomain: "maxservic-ventas.firebaseapp.com",
  projectId: "maxservic-ventas",
  storageBucket: "maxservic-ventas.firebasestorage.app",
  messagingSenderId: "470366033283",
  appId: "1:470366033283:web:406236e36b247a09c212b6"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
