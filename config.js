const mongoose = require('mongoose');

// MongoDB connection
mongoose.connect('mongodb://localhost:27017/tippme', {
})
.then(() => {
console.log("MongoDB connected");
})
.catch((err) => {
console.error("MongoDB connection error:", err);
});


// Schema for Login/Signup
const LoginSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    password: {
        type: String,
        required: true
    }
});

const User = mongoose.model('users', LoginSchema);

// Schema for Waiters
const waiterSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    upiId: {
        type: String,
        required: true
    },
    image: {
        type: String,
        required: true
    }
});

const Waiter = mongoose.model('waiters', waiterSchema);

module.exports = { User, Waiter }; // Export both User and Waiter models
