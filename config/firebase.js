const admin = require("firebase-admin");
const { getDatabase } = require("firebase-admin/database");

const serviceAccount = require("./serviceAccountKey.json");

let firebaseApp;
let firebase;

if (!admin.apps.length) {
  firebaseApp = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL:
      "https://comp1640-59a9c-default-rtdb.asia-southeast1.firebasedatabase.app",
  });
} else {
  firebaseApp = admin.app();
}

firebase = getDatabase(firebaseApp);

module.exports = {
  firebase,
  admin,
};
