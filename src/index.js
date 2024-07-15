const express = require('express');
const path = require("path");
const bcrypt = require("bcrypt");
const multer = require('multer');
const { User, Waiter } = require("./config"); // Import User and Waiter from config
const session = require('express-session');
const bodyParser = require('body-parser');
const QRCode = require('qrcode');
const fs = require('fs').promises;


const app = express();

// Session middleware
app.use(session({
    secret: 'your-secret-key', // Replace with a strong secret key
    resave: false,
    saveUninitialized: true
}));

// Multer configuration for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, path.join(__dirname, '../public/uploads')); // Specify the uploads directory
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname); // Rename uploaded file if needed
    }
});

const upload = multer({ storage: storage });

// Middleware and other configurations
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.json());
app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, '../public')));

// Routes

app.get("/login", (req, res) => {
    res.render("login");
});

app.get("/signup", (req, res) => {
    res.render("signup");
});


// Register user
app.post("/signup", async (req, res) => {
    const { username, password } = req.body;

    try {
        const existingUser = await User.findOne({ name: username });

        if (existingUser) {
            return res.send("User already exists. Please choose a different username");
        }

        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // Example QR code generation using a library like qrcode
        const qrCodePath = `/profile/${username}-qr.png`; // Example path
        // Generate QR code and save it in the '/public/profile' directory
        // Example:
        // await generateQRCode(qrCodePath, username); // Function to generate QR code

        await User.create({
            name: username,
            password: hashedPassword,
            qrCodePath: qrCodePath // Store QR code path in user document
        });

        res.redirect("/login"); // Redirect to login page after successful signup
    } catch (error) {
        console.error('Error creating user:', error);
        res.status(500).send('Failed to create user.');
    }
});


// Login user
app.post("/login", async (req, res) => {
    const { username, password } = req.body;

    try {
        const user = await User.findOne({ name: username });

        if (!user) {
            return res.send("Username cannot be found");
        }

        const isPasswordMatch = await bcrypt.compare(password, user.password);

        if (isPasswordMatch) {
            // Store user info in session
            req.session.user = user;
            res.redirect("/dashboard"); // Redirect to profile page
        } else {
            res.send("Wrong password");
        }
    } catch (error) {
        res.send("Wrong details");
    }
});



// Route to render profile
app.get("/profile", (req, res) => {
    if (!req.session.user) {
        return res.redirect("/login"); // Redirect to login if not logged in
    }

    // Fetch user data including QR code path
    const user = req.session.user;
    res.render("profile", { user: user });
});






// Add Waiter Form
app.get("/add-waiter", (req, res) => {
    res.render("add-waiter");
});

// Handle Waiter Addition
app.post('/add-waiter', upload.single('image'), async (req, res) => {
    const { name, upiId } = req.body;
    const image = req.file ? req.file.filename : null; // Check if an image is uploaded

    try {
        if (!name || !upiId || !image) {
            throw new Error('All fields are required.'); // Throw error if any field is missing
        }

        await Waiter.create({
            name,
            upiId,
            image
        });

        res.redirect('/view-waiters');
    } catch (err) {
        console.error('Error adding waiter:', err);
        res.status(400).send(err.message || 'Failed to add waiter.');
    }
});

// View Waiters
app.get("/view-waiters", async (req, res) => {
    try {
        const waiters = await Waiter.find();
        res.render("view-waiters", { waiters: waiters });
    } catch (err) {
        console.error("Error fetching waiters:", err);
        res.send("Failed to fetch waiters.");
    }
});

// Route to render dashboard
app.get("/dashboard", (req, res) => {
    res.render("dashboard");
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});

const port = 5000;
app.listen(port, () => {
    console.log(`Server running on port : ${port}`);
});
