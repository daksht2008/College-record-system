const express = require('express');
const router = express.Router();
const db = require('../db');
const { sendEmail } = require('../mailer');

/**
 * POST /login — Smart Identification and Password Authentication Flow
 * Supports direct admin matching, exact student matching, and division-suffix matching.
 * This ensures students can log in using either their full ID (e.g., "A-12345")
 * or just their roll number suffix (e.g., "12345").
 */
router.post('/login', async (req, res) => {
    try {
        const { id, password, division } = req.body;
        
        if (!id || !password) {
            return res.status(400).json({ success: false, message: 'Please enter User ID and Password' });
        }

        // --- Step 1: Check Admin Table ---
        // Admins use unique usernames (e.g., "admin", "admin2").
        const [admins] = await db.execute('SELECT * FROM admins WHERE username = ? AND password = ?', [id, password]);
        if (admins.length > 0) {
            return res.json({ success: true, role: 'admin', message: 'Admin logged in', user: admins[0] });
        }

        // --- Step 2: Check by Full Enrollment ID (Direct Match) ---
        // E.g., student inputs "A-12345" directly. Works for active students only.
        const [exactStudents] = await db.execute(
            "SELECT * FROM students WHERE enrollment_no = ? AND password = ? AND status = 'active'",
            [id, password]
        );
        if (exactStudents.length > 0) {
            let s = { ...exactStudents[0] };
            // Parse display enrollment to hide division prefix if student logs in with it
            if (s.division && s.enrollment_no.startsWith(s.division + '-')) {
                s.display_enrollment = s.enrollment_no.substring(s.division.length + 1);
            } else {
                s.display_enrollment = s.enrollment_no;
            }
            return res.json({ success: true, role: 'student', message: 'Student logged in', user: s });
        }

        // --- Step 3: Check by Roll Number Suffix (Any Division) ---
        // If a division is explicitly specified in the request (e.g., due to previous division selection modal)
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

        // If no division was provided, scan all divisions for a suffix match (e.g., ending with "-12345")
        const [candidates] = await db.execute(
            "SELECT * FROM students WHERE enrollment_no LIKE ? AND password = ? AND status = 'active'",
            ['%-' + id, password]
        );

        // Scenario A: Exactly one student matches across all divisions
        if (candidates.length === 1) {
            let s = { ...candidates[0] };
            s.display_enrollment = id;
            return res.json({ success: true, role: 'student', message: 'Student logged in', user: s });
        }

        // Scenario B: Duplicate roll numbers across multiple divisions have the same password
        if (candidates.length > 1) {
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
        console.error('Login error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

/**
 * POST /forgotPassword — Retrieve password by checking enrollment and sending email notification
 * Safeguarded against null/empty extra_info fields to prevent TypeErrors.
 */
router.post('/forgotPassword', async (req, res) => {
    try {
        const { id } = req.body;
        if (!id) return res.status(400).json({ success: false, message: 'Please enter your Enrollment / User ID' });
        
        // Find student by either exact enrollment ID or suffix (division-agnostic)
        const [candidates] = await db.execute(
            "SELECT * FROM students WHERE (enrollment_no = ? OR enrollment_no LIKE ?) AND status = 'active'",
            [id, '%-' + id]
        );
        
        if (candidates.length === 0) {
            return res.json({ success: false, message: 'No student found with that ID.' });
        }
        
        // Use the first matching candidate
        const student = candidates[0];
        
        let hasEmail = false;
        let targetEmail = '';
        try {
            // Safely parse JSON or fallback to empty object if extra_info is null or parsing fails
            const extra = (typeof student.extra_info === 'string' ? JSON.parse(student.extra_info) : student.extra_info) || {};
            // Look for various keys that might store email address
            targetEmail = extra['Email'] || extra['email'] || extra['Email ID'] || extra['EMAIL'];
            hasEmail = !!targetEmail;
        } catch(e) {
            console.error('Error parsing extra_info in forgotPassword:', e);
        }
        
        if (!hasEmail) {
            return res.json({ success: false, message: 'No email registered. Please contact your admin or use "Complete Your Profile" after logging in.' });
        }
        
        const subject = 'EduSync - Password Recovery';
        const text = `Hello ${student.name || 'Student'},\n\nYour EduSync password is: ${student.password}\n\nPlease keep this secure.\n\nRegards,\nEduSync System`;
        
        // Send email using SMTP or print mock email to server console
        const emailSent = await sendEmail(targetEmail, subject, text);
        
        if (emailSent) {
            // Mask email address for user privacy (e.g., test@gmail.com -> te**@gmail.com)
            const maskedEmail = targetEmail.replace(/(.{2})(.*)(?=@)/, (gp1, gp2, gp3) => gp2 + '*'.repeat(gp3.length));
            return res.json({ success: true, message: `Password sent to your registered email: ${maskedEmail}` });
        } else {
            return res.json({ success: false, message: 'Failed to send email. Please check server configuration.' });
        }
        
    } catch (err) {
        console.error('ForgotPassword error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

/**
 * POST /registerFace — Register Face Descriptors (Euclidean Vectors) for Face ID Login
 * Accepts an array of 128 float values generated by face-api.js.
 */
router.post('/registerFace', async (req, res) => {
    try {
        const { id, role, descriptor } = req.body;
        if (!id || !descriptor) {
            return res.status(400).json({ success: false, message: 'ID and face descriptor required' });
        }
        
        const descriptorStr = JSON.stringify(descriptor);
        
        if (role === 'admin') {
            await db.execute('UPDATE admins SET face_descriptor = ? WHERE username = ?', [descriptorStr, id]);
        } else {
            // Locate the student (exact first, then fallback to suffix) and update descriptor
            const [exact] = await db.execute("SELECT enrollment_no FROM students WHERE enrollment_no = ? AND status = 'active'", [id]);
            if (exact.length > 0) {
                await db.execute('UPDATE students SET face_descriptor = ? WHERE enrollment_no = ?', [descriptorStr, id]);
            } else {
                const [suffix] = await db.execute("SELECT enrollment_no FROM students WHERE enrollment_no LIKE ? AND status = 'active'", ['%-' + id]);
                if (suffix.length > 0) {
                    await db.execute('UPDATE students SET face_descriptor = ? WHERE enrollment_no = ?', [descriptorStr, suffix[0].enrollment_no]);
                } else {
                    return res.json({ success: false, message: 'User not found' });
                }
            }
        }
        
        res.json({ success: true, message: 'Face registered successfully! You can now use Face Login.' });
    } catch (err) {
        console.error('RegisterFace error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

/**
 * POST /faceLogin — Authenticate User via Face Recognition (Descriptor Comparison)
 * Compares the request face vector against all registered vectors using Euclidean distance.
 * Best match below the THRESHOLD (0.6) is authenticated.
 */
router.post('/faceLogin', async (req, res) => {
    try {
        const { descriptor } = req.body;
        if (!descriptor) {
            return res.status(400).json({ success: false, message: 'Face descriptor required' });
        }
        
        const inputDesc = descriptor;
        const THRESHOLD = 0.6; // standard recognition distance threshold (lower is more strict)
        
        // Helper: Euclidean distance between two face descriptors (128-dimensional vectors)
        function euclideanDistance(a, b) {
            let sum = 0;
            for (let i = 0; i < a.length; i++) {
                sum += Math.pow(a[i] - b[i], 2);
            }
            return Math.sqrt(sum);
        }
        
        let allMatches = [];
        
        // --- Scan Admins ---
        const [admins] = await db.execute('SELECT * FROM admins WHERE face_descriptor IS NOT NULL');
        for (const admin of admins) {
            try {
                const storedDesc = JSON.parse(admin.face_descriptor);
                const dist = euclideanDistance(inputDesc, storedDesc);
                if (dist < THRESHOLD) {
                    allMatches.push({
                        role: 'admin',
                        user: admin,
                        distance: dist,
                        displayName: admin.name + (admin.subject ? ` (${admin.subject})` : ''),
                        id: admin.username
                    });
                }
            } catch(e) {}
        }
        
        // --- Scan Students ---
        const [students] = await db.execute("SELECT * FROM students WHERE face_descriptor IS NOT NULL AND status = 'active'");
        for (const student of students) {
            try {
                const storedDesc = JSON.parse(student.face_descriptor);
                const dist = euclideanDistance(inputDesc, storedDesc);
                if (dist < THRESHOLD) {
                    let s = { ...student };
                    if (s.division && s.enrollment_no.startsWith(s.division + '-')) {
                        s.display_enrollment = s.enrollment_no.substring(s.division.length + 1);
                    } else {
                        s.display_enrollment = s.enrollment_no;
                    }
                    allMatches.push({
                        role: 'student',
                        user: s,
                        distance: dist,
                        displayName: (s.name || s.display_enrollment) + ` (${s.display_enrollment})`,
                        id: s.enrollment_no
                    });
                }
            } catch(e) {}
        }
        
        // Sort matches from closest distance (best match) to farthest
        allMatches.sort((a, b) => a.distance - b.distance);
        
        if (allMatches.length === 0) {
            return res.json({ success: false, message: 'Face not recognized. Please register your face first or use password login.' });
        }
        
        if (allMatches.length === 1) {
            // Exactly one close candidate: log them in directly
            const match = allMatches[0];
            return res.json({ success: true, role: match.role, message: `${match.role === 'admin' ? 'Admin' : 'Student'} logged in via Face ID`, user: match.user, distance: match.distance });
        }
        
        // Multiple matches below threshold: return candidates list so user can choose their account
        const matchList = allMatches.map(m => ({
            role: m.role,
            displayName: m.displayName,
            id: m.id,
            distance: m.distance,
            user: m.user
        }));
        
        return res.json({ success: true, multiple: true, matches: matchList, message: 'Multiple accounts found for this face. Please select one.' });
        
    } catch (err) {
        console.error('FaceLogin error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

module.exports = router;
