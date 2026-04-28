const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /profile/:enrollment_no
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
        console.error(err);
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

module.exports = router;
