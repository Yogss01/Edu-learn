const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const session = require('express-session');
const passport = require('passport');
const { MongoClient } = require('mongodb');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;

const app = express();

const uri = "mongodb://localhost:27017/"; // Replace with your MongoDB connection string
const dbName = 'edu-learn'; // Replace with your database name

let client;
let sessions = {}; // Define the sessions object

async function connectToMongoDB() {
    try {
        client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });
        await client.connect();
        console.log('Connected to MongoDB');
    } catch (error) {
        console.error('Error connecting to MongoDB:', error);
    }
}

connectToMongoDB();

app.use(cors());
app.use(bodyParser.json());
app.use(session({ 
    secret: 'YOUR_SECRET', // Replace with your generated session secret
    resave: false, 
    saveUninitialized: true 
}));
app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, done) => {
    done(null, user);
});

passport.deserializeUser((user, done) => {
    done(null, user);
});

// Configure Google strategy
passport.use(new GoogleStrategy({
    clientID: 'GOOGLE_CLIENT_ID', // Replace with your Google Client ID
    clientSecret: 'GOOGLE_CLIENT_SECRET', // Replace with your Google Client Secret
    callbackURL: 'REDIRECT_URL'
}, async (token, tokenSecret, profile, done) => {
    try {
        const database = client.db('edu-learn');
        const users = database.collection('users');
        let user = await users.findOne({ googleId: profile.id });
        if (!user) {
            user = await users.insertOne({
                googleId: profile.id,
                displayName: profile.displayName,
                email: profile.emails[0].value
            });
        }
        return done(null, user);
    } catch (error) {
        return done(error, null);
    }
}));

app.post('/login', async (req, res) => {
    const { username, password, role } = req.body;
    console.log('Request body:', req.body);

    try {
        const database = client.db('edu-learn');
        const users = database.collection('users');

        const user = await users.findOne({ username, password, role });

        if (user) {
            const sessionToken = `${username}-${new Date().getTime()}`;
            sessions[sessionToken] = username;
            res.json({ success: true, message: 'Login successful', token: sessionToken, role: role });
        } else {
            res.status(401).json({ success: false, error: 'Invalid credentials' });
        }
    } catch (error) {
        console.error('Error during login:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

const authenticate = (req, res, next) => {
    const token = req.headers.authorization;
    if (sessions[token]) {
        next();
    } else {
        res.status(403).json({ error: 'Not authenticated' });
    }
};

// Logout endpoint
app.get('/logout', (req, res) => {
    req.logout((err) => {
        if (err) {
            console.error('Error logging out:', err);
            return res.status(500).json({ success: false, error: 'Failed to log out' });
        }
        req.session.destroy((err) => { // Destroy the session
            if (err) {
                console.error('Error destroying session:', err);
                return res.status(500).json({ success: false, error: 'Failed to log out' });
            }
            res.redirect('http://127.0.0.1:5500/index.html'); // Redirect to the googlelogout.html page
        });
    });
});

app.get('/resource1', authenticate, (req, res) => {
    res.sendFile(path.join(__dirname, 'resources', 'resource1.html'));
});

app.get('/resource2', authenticate, (req, res) => {
    res.sendFile(path.join(__dirname, 'resources', 'resource2.html'));
});

app.get('/resource3', authenticate, (req, res) => {
    res.sendFile(path.join(__dirname, 'resources', 'resource3.html'));
});

// Google authentication routes
app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

app.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: '/login' }), (req, res) => {
    res.redirect('/welcome');
});


app.get('/welcome', (req, res) => {
    if (!req.isAuthenticated()) return res.redirect('/login');
    res.send(`
        <h1>Welcome ${req.user.displayName}</h1>
        <a href="/logout">Logout</a>
    `);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
