const express = require('express');
const path = require('path');
const bcrypt = require('bcrypt');
const multer = require('multer');
const { User, Waiter } = require('./config');
const session = require('express-session');
const bodyParser = require('body-parser');
const QRCode = require('qrcode');
const fs = require('fs').promises;

const app = express();

// Session middleware
app.use(session({
    secret: '2003', // Replace with a strong secret key
    resave: false,
    saveUninitialized: true,
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
app.get('/', (req, res) => {
    res.render('welcome');
});

app.get('/login', (req, res) => {
    res.render('login');
});

app.get('/signup', (req, res) => {
    res.render('signup');
});

app.get('/contact', (req, res) => {
    res.render('contact');
});

app.get('/about', (req, res) => {
    res.render('about');
});


// Register user
app.post('/signup', async (req, res) => {
    const { username, password } = req.body;

    try {
        const existingUser = await User.findOne({ name: username });
        if (existingUser) {
            return res.send('User already exists. Please choose a different username');
        }

        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        const newUser = await User.create({
            name: username,
            password: hashedPassword,
        });

        //Generate qr code
        const qrCodePath = `/profile/${username}-qr.png`;
        const localIPAddress = 'http://192.168.154.75:5000';
        await QRCode.toFile(
            path.join(__dirname, '../public', qrCodePath),
            `${localIPAddress}/waiters?ownerId=${newUser._id}`
        );

        newUser.qrCodePath = qrCodePath;
        await newUser.save();

        res.redirect('/login');
    } catch (error) {
        console.error('Error creating user:', error);
        res.status(500).send('Failed to create user.');
    }
});

// Login user
app.post('/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        const user = await User.findOne({ name: username });

        if (!user) {
            return res.send('Username cannot be found');
        }

        const isPasswordMatch = await bcrypt.compare(password, user.password);

        if (isPasswordMatch) {
            req.session.user = user;
            res.redirect('/dashboard');
        } else {
            res.send('Wrong password');
        }
    } catch (error) {
        res.send('Wrong details');
    }
});

// Route to render profile
app.get('/profile', (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }

    const user = req.session.user;
    res.render('profile', { user: user });
});

// Add Waiter Form
app.get('/add-waiter', (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }
    res.render('add-waiter');
});

// Handle Waiter Addition
app.post('/add-waiter', upload.single('image'), async (req, res) => {
    const { name, upiId } = req.body;
    const image = req.file ? req.file.filename : null;

    try {
        if (!name || !upiId || !image) {
            throw new Error('All fields are required.');
        }

        const currentUser = req.session.user;

        await Waiter.create({
            name,
            upiId,
            image,
            addedBy: currentUser._id
        });

        res.redirect('/view-waiters');
    } catch (err) {
        console.error('Error adding waiter:', err);
        res.status(400).send(err.message || 'Failed to add waiter.');
    }
});

// View Waiters for logged-in user
app.get('/view-waiters', async (req, res) => {
    try {
        if (!req.session.user) {
            return res.redirect('/login');
        }

        const waiters = await Waiter.find({ addedBy: req.session.user._id });
        res.render('view-waiters', { waiters: waiters });
    } catch (err) {
        console.error('Error fetching waiters:', err);
        res.send('Failed to fetch waiters.');
    }
});

// Route to fetch waiters associated with a specific restaurant owner
app.get('/waiters', async (req, res) => {
    try {
        const ownerId = req.query.ownerId;
        const waiters = await Waiter.find({ addedBy: ownerId });
        res.render('waiters', { waiters: waiters });
    } catch (err) {
        console.error('Error fetching waiters:', err);
        res.status(500).send('Failed to fetch waiters.');
    }
});

// Handle waiter update
app.put('/edit-waiter/:id', upload.single('image'), async (req, res) => {
    try {
        const waiterId = req.params.id;
        const { name, upiId } = req.body;
        const image = req.file ? req.file.filename : null;

        const updatedWaiter = {
            name,
            upiId
        };

        if (image) {
            updatedWaiter.image = image;
        }

        await Waiter.findByIdAndUpdate(waiterId, updatedWaiter);

        res.status(200).send('Waiter updated successfully');
    } catch (err) {
        console.error('Error updating waiter:', err);
        res.status(500).send('Failed to update waiter.');
    }
});

// Handle waiter deletion
app.delete('/delete-waiter/:id', async (req, res) => {
    try {
        const waiterId = req.params.id;
        await Waiter.findByIdAndDelete(waiterId);
        res.status(200).send('Waiter deleted successfully');
    } catch (err) {
        console.error('Error deleting waiter:', err);
        res.status(500).send('Failed to delete waiter.');
    }
});

// Logout user
app.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            console.error('Error destroying session:', err);
            return res.status(500).send('Failed to logout');
        }
        res.redirect('/login');
    });
});

// Route to render dashboard
app.get('/dashboard', (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }
    res.render('dashboard');
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});

const port = 5000;
app.listen(port, () => {
    console.log(`Server running on port: ${port}`);
});
