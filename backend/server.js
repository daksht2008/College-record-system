const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const http = require('http');
const { Server } = require('socket.io');
const webpush = require('web-push');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const port = 3000;

// Import db
const db = require('./db');

// Middleware
app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, '..', 'web')));

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

// Ensure assignments uploads directory exists
const assignmentDir = path.join(uploadDir, 'assignments');
if (!fs.existsSync(assignmentDir)) {
    fs.mkdirSync(assignmentDir);
}

// Setup VAPID Keys for Web Push Notifications
const keysPath = path.join(__dirname, 'vapid-keys.json');
let vapidKeys;
if (fs.existsSync(keysPath)) {
    vapidKeys = JSON.parse(fs.readFileSync(keysPath, 'utf8'));
} else {
    vapidKeys = webpush.generateVAPIDKeys();
    fs.writeFileSync(keysPath, JSON.stringify(vapidKeys, null, 2), 'utf8');
}
webpush.setVapidDetails(
    'mailto:admin@edusync.com',
    vapidKeys.publicKey,
    vapidKeys.privateKey
);

// Push Notifications Routes
app.get('/api/push-vapid-key', (req, res) => {
    res.json({ publicKey: vapidKeys.publicKey });
});

app.post('/api/push-subscribe', async (req, res) => {
    try {
        const { subscription, enrollment_no, username } = req.body;
        const subJson = JSON.stringify(subscription);
        
        // Remove or update existing subscriptions to prevent duplicates
        const [existing] = await db.execute('SELECT id FROM push_subscriptions WHERE subscription_json = ?', [subJson]);
        if (existing.length > 0) {
            await db.execute('UPDATE push_subscriptions SET enrollment_no = ?, username = ? WHERE id = ?', [enrollment_no || null, username || null, existing[0].id]);
        } else {
            await db.execute('INSERT INTO push_subscriptions (enrollment_no, username, subscription_json) VALUES (?, ?, ?)', [enrollment_no || null, username || null, subJson]);
        }
        res.json({ success: true });
    } catch (err) {
        console.error('Subscription error:', err);
        res.status(500).json({ success: false });
    }
});

// Helper function to send push notification to a specific enrollment_no or admin username
const sendPushNotification = async (targetId, title, message) => {
    try {
        const [subs] = await db.execute(
            'SELECT subscription_json FROM push_subscriptions WHERE enrollment_no = ? OR username = ?',
            [targetId, targetId]
        );
        for (const sub of subs) {
            try {
                const subObj = JSON.parse(sub.subscription_json);
                await webpush.sendNotification(subObj, JSON.stringify({ title, message }));
            } catch (pushErr) {
                // If subscription has expired or is invalid, remove it
                if (pushErr.statusCode === 410 || pushErr.statusCode === 404) {
                    await db.execute('DELETE FROM push_subscriptions WHERE subscription_json = ?', [sub.subscription_json]);
                }
            }
        }
    } catch (err) {
        console.error('Push notification trigger error:', err);
    }
};

app.set('sendPushNotification', sendPushNotification);

// WebSockets Chat Setup
io.on('connection', (socket) => {
    console.log('Socket user connected:', socket.id);
    
    socket.on('join_room', async ({ division, name, id }) => {
        const room = `room_${division.toUpperCase()}`;
        socket.join(room);
        console.log(`${name} joined room: ${room}`);
        
        // Fetch and send message history (last 50 messages)
        try {
            const [messages] = await db.execute(
                'SELECT sender_name, sender_id, message, timestamp FROM chat_messages WHERE division = ? ORDER BY timestamp ASC LIMIT 50',
                [division.toUpperCase()]
            );
            socket.emit('chat_history', messages);
        } catch (historyErr) {
            console.error('Error fetching chat history:', historyErr);
        }
    });
    
    socket.on('send_message', async ({ division, sender_name, sender_id, message, send_email }) => {
        const room = `room_${division.toUpperCase()}`;
        try {
            // Save message in DB
            await db.execute(
                'INSERT INTO chat_messages (division, sender_name, sender_id, message) VALUES (?, ?, ?, ?)',
                [division.toUpperCase(), sender_name, sender_id, message]
            );
            
            // Broadcast message to room
            io.to(room).emit('receive_message', {
                sender_name,
                sender_id,
                message,
                timestamp: new Date().toISOString()
            });

            // Send email to current (active) students in the division if requested
            if (send_email) {
                const [students] = await db.execute(
                    "SELECT name, extra_info FROM students WHERE status = 'active' AND division = ?",
                    [division.toUpperCase()]
                );
                const emails = students
                    .map(s => {
                        try {
                            const extra = typeof s.extra_info === 'string' ? JSON.parse(s.extra_info || '{}') : (s.extra_info || {});
                            return extra['Email'] || extra['email'] || extra['Email ID'] || extra['EMAIL'];
                        } catch(e) { return null; }
                    })
                    .filter(e => e);

                if (emails.length > 0) {
                    const { sendEmail } = require('./mailer');
                    const subject = `Discussion Hub Announcement - Division ${division.toUpperCase()}`;
                    const text = `Hello Student,\n\nA new class announcement has been posted in the Discussion Hub by ${sender_name}:\n\n"${message}"\n\nPlease log in to the portal to view or reply.\n\nRegards,\nEduSync Admin`;
                    await sendEmail(emails, subject, text);
                }
            }
        } catch (sendErr) {
            console.error('Error saving or routing chat message:', sendErr);
        }
    });
    
    socket.on('disconnect', () => {
        console.log('Socket user disconnected:', socket.id);
    });
});

// Routes
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const studentRoutes = require('./routes/student');

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/student', studentRoutes);

// Fallback for browser routing
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'web', 'index.html'));
});

// Start the wrapped HTTP server instead of express server
server.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
