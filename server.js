const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const session = require('express-session');
const passport = require('passport');
const { MongoClient } = require('mongodb');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const GitHubStrategy = require('passport-github2').Strategy;
const path = require('path');

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
    secret: 'SECRET_ID', // Replace with your generated session secret
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
    clientID: 'CLIENT_ID', // Replace with your Google Client ID
    clientSecret: 'CLIENT_SECRET_ID', // Replace with your Google Client Secret
    callbackURL: 'http://localhost:3000/auth/google/callback'
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

// Configure GitHub strategy
passport.use(new GitHubStrategy({
    clientID: 'GITHUB_CLIENT_ID', // Replace with your GitHub Client ID
    clientSecret: 'GITHUB_SECRET_ID', // Replace with your GitHub Client Secret
    callbackURL: 'http://localhost:3000/auth/github/callback'
}, async (accessToken, refreshToken, profile, done) => {
    console.log('GitHub profile:', profile); // Log profile for debugging
    
    try {
        const database = client.db('edu-learn');
        const users = database.collection('users');
        
        // Safely access profile.emails
        const email = (profile.emails && profile.emails.length > 0 && profile.emails[0].value) || 'no-email@example.com';
        
        let user = await users.findOne({ githubId: profile.id });
        if (!user) {
            const result = await users.insertOne({
                githubId: profile.id,
                displayName: profile.displayName,
                email: email
            });
            user = result.ops[0]; // Extract the inserted user
        }
        return done(null, user);
    } catch (error) {
        console.error('Error during GitHub authentication:', error);
        return done(error, null);
    }
}));

// Serve static files from the 'edu web' directory
app.use(express.static(path.join(__dirname, 'edu web')));

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
            res.redirect('http://127.0.0.1:5500/index.html'); // Redirect to the index.html page
        });
    });
});

app.get('/resource1', authenticate, (req, res) => {
    res.sendFile(path.join(__dirname, 'edu web/resources', 'resource1.html'));
});

app.get('/resource2', authenticate, (req, res) => {
    res.sendFile(path.join(__dirname, 'edu web/resources', 'resource2.html'));
});

app.get('/resource3', authenticate, (req, res) => {
    res.sendFile(path.join(__dirname, 'edu web/resources', 'resource3.html'));
});

// Google authentication routes
app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

app.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: '/login.html' }), (req, res) => {
    res.redirect('/welcome');
});

// GitHub authentication routes
app.get('/auth/github', passport.authenticate('github', { scope: ['user:email'] }));

app.get('/auth/github/callback', passport.authenticate('github', { failureRedirect: '/login.html' }), (req, res) => {
    res.redirect('/welcome');
});

app.get('/welcome', (req, res) => {
    if (!req.isAuthenticated()) return res.redirect('/login.html');
    
    // Access the user's information
    const user = req.user;
    
    // Determine the authentication provider
    let authProvider = 'Unknown';
    if (user.googleId) {
        authProvider = 'Google';
    } else if (user.githubId) {
        authProvider = 'GitHub';
    }

    // Generate the welcome message
    res.send(`
        <h1>Welcome ${user.displayName || 'User'}</h1>
        <p>You logged in with ${authProvider}.</p>
        <p>Email: ${user.email || 'No email provided'}</p>
        <a href="/logout">Logout</a>
    `);
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
