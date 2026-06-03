const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /profile/:enrollment_no
// Retrieves details of a specific student by enrollment number.
router.get('/profile/:enrollment_no', async (req, res) => {
    try {
        const { enrollment_no } = req.params;
        const [student] = await db.execute('SELECT name, enrollment_no, division, rank_no, extra_info FROM students WHERE enrollment_no = ?', [enrollment_no]);
        if (student.length > 0) {
            res.json({ success: true, profile: student[0] });
        } else {
            res.status(404).json({ success: false, message: 'Student not found' });
        }
    } catch (err) {
        console.error('Error fetching student profile:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// GET /getAttendance/:enrollment_no
router.get('/getAttendance/:enrollment_no', async (req, res) => {
    try {
        const { enrollment_no } = req.params;
        const [attendance] = await db.execute('SELECT * FROM attendance WHERE enrollment_no = ? ORDER BY date DESC', [enrollment_no]);
        
        // Calculate percentage
        const total = attendance.length;
        const present = attendance.filter(a => a.status === 'Present').length;
        const percentage = total === 0 ? 0 : Math.round((present / total) * 100);

        res.json({ success: true, attendance, percentage });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// GET /getMarks/:enrollment_no
router.get('/getMarks/:enrollment_no', async (req, res) => {
    try {
        const { enrollment_no } = req.params;
        const [marks] = await db.execute('SELECT * FROM marks WHERE enrollment_no = ?', [enrollment_no]);
        res.json({ success: true, marks });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// GET /getFiles
router.get('/getFiles', async (req, res) => {
    try {
        // Students can ONLY see public files
        const [files] = await db.execute("SELECT * FROM files WHERE visibility = 'public' ORDER BY id DESC");
        res.json({ success: true, files });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure Multer for Student Assignment Uploads
// Resolves uploads to backend/uploads/assignments dynamically using absolute pathing.
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const dir = path.join(__dirname, '..', 'uploads', 'assignments');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: function (req, file, cb) {
        // Prefix with timestamp to prevent duplicate filename clashes
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage: storage });

// POST /updateProfile
router.post('/updateProfile', async (req, res) => {
    try {
        const { enrollment_no, name, email } = req.body;
        
        const [student] = await db.execute('SELECT extra_info FROM students WHERE enrollment_no = ?', [enrollment_no]);
        if (student.length === 0) return res.status(404).json({ success: false, message: 'Student not found' });
        
        let extra = {};
        try {
            extra = typeof student[0].extra_info === 'string' ? JSON.parse(student[0].extra_info || '{}') : (student[0].extra_info || {});
        } catch(e) {}
        
        if (email) extra['Email'] = email;
        
        await db.execute('UPDATE students SET name = ?, extra_info = ? WHERE enrollment_no = ?', [name, JSON.stringify(extra), enrollment_no]);
        res.json({ success: true, message: 'Profile updated successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// POST /uploadAssignment
router.post('/uploadAssignment', upload.single('file'), async (req, res) => {
    try {
        const { enrollment_no, title } = req.body;
        if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });
        if (!title) return res.status(400).json({ success: false, message: 'Assignment title required' });
        
        const file_url = `/uploads/assignments/${req.file.filename}`;
        
        await db.execute(
            'INSERT INTO assignments (enrollment_no, title, file_url) VALUES (?, ?, ?)',
            [enrollment_no, title, file_url]
        );
        res.json({ success: true, message: 'Assignment submitted successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// GET /getAssignments/:enrollment_no
// Fetches all assignments submitted by a student, including any grading marks and comments.
router.get('/getAssignments/:enrollment_no', async (req, res) => {
    try {
        const { enrollment_no } = req.params;
        const [assignments] = await db.execute('SELECT * FROM assignments WHERE enrollment_no = ? ORDER BY submitted_at DESC', [enrollment_no]);
        res.json({ success: true, assignments });
    } catch (err) {
        console.error('Error fetching student assignments:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

module.exports = router;
