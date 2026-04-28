const express = require('express');
const router = express.Router();
const db = require('../db');

// POST /login — Smart identification flow
router.post('/login', async (req, res) => {
    try {
        const { id, password, division } = req.body;
        
        if (!id || !password) {
            return res.status(400).json({ success: false, message: 'Please enter User ID and Password' });
        }

        // --- Step 1: Check Admin table ---
        const [admins] = await db.execute('SELECT * FROM admins WHERE username = ? AND password = ?', [id, password]);
        if (admins.length > 0) {
            return res.json({ success: true, role: 'admin', message: 'Admin logged in', user: admins[0] });
        }

        // --- Step 2: Check by full enrollment_no (direct match, any division prefix) ---
        // Try exact match first (e.g. "R-250280107081")
        const [exactStudents] = await db.execute(
            "SELECT * FROM students WHERE enrollment_no = ? AND password = ? AND status = 'active'",
            [id, password]
        );
        if (exactStudents.length > 0) {
            let s = { ...exactStudents[0] };
            if (s.division && s.enrollment_no.startsWith(s.division + '-')) {
                s.display_enrollment = s.enrollment_no.substring(s.division.length + 1);
            } else {
                s.display_enrollment = s.enrollment_no;
            }
            return res.json({ success: true, role: 'student', message: 'Student logged in', user: s });
        }

        // --- Step 3: Check by roll number (suffix match across all divisions) ---
        // Since passwords are unique per student, we can resolve directly
        
        // If a division was explicitly provided, try it
        if (division) {
            const fullId = division.toUpperCase() + '-' + id;
            const [divStudents] = await db.execute(
                "SELECT * FROM students WHERE enrollment_no = ? AND password = ? AND status = 'active'",
                [fullId, password]
            );
            if (divStudents.length > 0) {
                let s = { ...divStudents[0] };
                s.display_enrollment = id;
                return res.json({ success: true, role: 'student', message: 'Student logged in', user: s });
            }
            return res.status(401).json({ success: false, message: 'Invalid credentials for Division ' + division.toUpperCase() });
        }

        // No division provided — search all divisions for this roll number + password combo
        const [candidates] = await db.execute(
            "SELECT * FROM students WHERE enrollment_no LIKE ? AND password = ? AND status = 'active'",
            ['%-' + id, password]
        );

        if (candidates.length === 1) {
            let s = { ...candidates[0] };
            s.display_enrollment = id;
            return res.json({ success: true, role: 'student', message: 'Student logged in', user: s });
        }

        if (candidates.length > 1) {
            // Extremely rare: same roll number AND same password across divisions
            const divisions = candidates.map(s => s.division);
            return res.json({
                success: false,
                multiple: true,
                divisions: divisions,
                message: 'Multiple matches found. Please select your division.'
            });
        }

        return res.status(401).json({ success: false, message: 'Invalid credentials. Check your ID and password.' });

    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

module.exports = router;
