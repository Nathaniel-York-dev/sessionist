var root = {
    "username": "admin",
    "password": "admin",
    "role": "admin",
    "token": ""
};
db = db.getSiblingDB('sessionist');
db.createCollection("users");
db.users.createIndex({ "username": 1 }, { unique: true });
db.users.insert(root);
