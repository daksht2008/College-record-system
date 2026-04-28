const express = require('express');
const router = express.Router();
const db = require('../db');
const multer = require('multer');
const path = require('path');
const xlsx = require('xlsx');
const pdfParse = require('pdf-parse');
const fs = require('fs');

// Configure Multer for File Uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        let folder = req.body.folderName ? req.body.folderName.replace(/[^a-zA-Z0-9_-]/g, '') : 'uncategorized';
        const dir = path.join('./uploads/', folder);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: function (req, file, cb) {
        cb(null, file.originalname);
    }
});
const upload = multer({ storage: storage });

// POST /registerStudents
router.post('/registerStudents', async (req, res) => {
    try {
        const { enrollments, division, academic_year } = req.body;
        const div = division || 'A';
        const year = academic_year || (new Date().getFullYear() + '-' + String(new Date().getFullYear() + 1).slice(2));
        if (!enrollments || enrollments.length === 0) {
            return res.status(400).json({ success: false, message: 'No enrollments provided' });
        }

        const results = [];
        
        for (let no of enrollments) {
            no = no.trim();
            if (!no) continue;
            
            const randomChars = Math.random().toString(36).substring(2, 7);
            const password = `s1${div.toUpperCase()}${randomChars}`;
            const fullEnrollment = div.toUpperCase() + '-' + no;
            
            try {
                await db.execute('INSERT INTO students (enrollment_no, password, name, division, archived_year) VALUES (?, ?, ?, ?, ?)', [fullEnrollment, password, 'Student ' + no, div, year]);
                results.push({ enrollment_no: no, password: password, status: 'Success' });
            } catch (e) {
                results.push({ enrollment_no: no, password: null, status: 'Failed or Duplicate' });
            }
        }
        
        res.json({ success: true, results });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// GET /getStudents (Active Only — kept for compatibility)
router.get('/getStudents', async (req, res) => {
    try {
        const [students] = await db.execute("SELECT id, enrollment_no, password, name, division, rank_no, extra_info, archived_year FROM students WHERE status = 'active' ORDER BY division ASC, CAST(SUBSTRING(enrollment_no, LOCATE('-', enrollment_no) + 1) AS UNSIGNED) ASC");
        const displayStudents = students.map(s => {
            let displayNo = s.enrollment_no;
            if (s.division && displayNo.startsWith(s.division + '-')) {
                displayNo = displayNo.substring(s.division.length + 1);
            }
            return { ...s, display_enrollment: displayNo };
        });
        res.json({ success: true, students: displayStudents });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// GET /getAllStudents (All students — grouped by year)
router.get('/getAllStudents', async (req, res) => {
    try {
        const [students] = await db.execute("SELECT id, enrollment_no, password, name, division, rank_no, extra_info, archived_year FROM students ORDER BY archived_year DESC, division ASC, CAST(SUBSTRING(enrollment_no, LOCATE('-', enrollment_no) + 1) AS UNSIGNED) ASC");
        const displayStudents = students.map(s => {
            let displayNo = s.enrollment_no;
            if (s.division && displayNo.startsWith(s.division + '-')) {
                displayNo = displayNo.substring(s.division.length + 1);
            }
            return { ...s, display_enrollment: displayNo };
        });
        res.json({ success: true, students: displayStudents });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// POST /markAttendance
router.post('/markAttendance', async (req, res) => {
    try {
        const { enrollment_no, date, status, division } = req.body;
        
        // Check if attendance already exists for this date
        const [existing] = await db.execute('SELECT id FROM attendance WHERE enrollment_no = ? AND date = ?', [enrollment_no, date]);
        
        if (existing.length > 0) {
            await db.execute('UPDATE attendance SET status = ? WHERE id = ?', [status, existing[0].id]);
        } else {
            await db.execute('INSERT INTO attendance (enrollment_no, date, status, division) VALUES (?, ?, ?, ?)', [enrollment_no, date, status, division || 'A']);
        }
        
        res.json({ success: true, message: 'Attendance marked successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// POST /syncAttendance (For Offline Sync from Android)
router.post('/syncAttendance', async (req, res) => {
    try {
        const { attendanceRecords } = req.body; // Array of { enrollment_no, date, status, division }
        
        if (!attendanceRecords || attendanceRecords.length === 0) {
            return res.json({ success: true, message: 'No records to sync' });
        }

        let syncedCount = 0;
        for (let record of attendanceRecords) {
            const { enrollment_no, date, status, division } = record;
            const [existing] = await db.execute('SELECT id FROM attendance WHERE enrollment_no = ? AND date = ?', [enrollment_no, date]);
            
            if (existing.length > 0) {
                await db.execute('UPDATE attendance SET status = ? WHERE id = ?', [status, existing[0].id]);
            } else {
                await db.execute('INSERT INTO attendance (enrollment_no, date, status, division) VALUES (?, ?, ?, ?)', [enrollment_no, date, status, division || 'A']);
            }
            syncedCount++;
        }
        
        res.json({ success: true, message: `Successfully synced ${syncedCount} records` });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// POST /uploadMuster (Sync from Excel/CSV/PDF)
router.post('/uploadMuster', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });

        let updated = 0;
        let inserted = 0;

        // PDF Handling
        if (req.file.originalname.toLowerCase().endsWith('.pdf')) {
            const dataBuffer = fs.readFileSync(req.file.path);
            const pdfData = await pdfParse(dataBuffer);
            const text = pdfData.text;
            
            let extractedDiv = 'A';
            let extractedSem = '1';
            
            const divMatch = text.match(/(?:div(?:ision)?|batch)\s*[-:]?\s*([a-z0-9]+)|([a-z0-9]+)\s*div/i);
            if (divMatch) extractedDiv = (divMatch[1] || divMatch[2]).toUpperCase().replace(/[0-9]/g, '');
            
            const semMatch = text.match(/sem(?:ester)?\s*[-:]?\s*(\d+)/i);
            if (semMatch) extractedSem = semMatch[1];
            
            const lines = text.split('\n');
            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed) continue;
                
                // Strategy 1: Find 12-digit enrollment (starting with 20-29)
                let actual_enrollment = null;
                let srNo = null;
                let name = null;

                let midsemMarks = null;
                const srEnrollMatch = trimmed.match(/^(\d{1,3})\s*(2[0-9]\d{10})/);
                if (srEnrollMatch) {
                    srNo = srEnrollMatch[1];
                    actual_enrollment = srEnrollMatch[2];
                    const restStr = trimmed.replace(srEnrollMatch[0], ' ');
                    
                    const nameMatch = restStr.match(/[A-Za-z][A-Za-z\s\.]{3,}/);
                    if (nameMatch) {
                        name = nameMatch[0].trim();
                        const marksStr = restStr.replace(nameMatch[0], '').trim();
                        const tokens = marksStr.split(/\s+/).filter(t => t);
                        if (tokens.length > 0) {
                            midsemMarks = tokens[tokens.length - 1]; // Extract final mark out of 30
                        }
                    } else {
                        const tokens = restStr.split(/\s+/).filter(t => t);
                        if (tokens.length > 0) {
                            midsemMarks = tokens[tokens.length - 1];
                        }
                    }
                } else {
                    // Strategy 2: No enrollment, just SR NO and Name
                    const fallbackMatch = trimmed.match(/^(\d{1,3})\s+([A-Za-z][A-Za-z\s\.]{3,})/);
                    if (fallbackMatch) {
                        srNo = fallbackMatch[1];
                        name = fallbackMatch[2].trim();
                    }
                }

                // Find email (regex for common email patterns)
                const emailMatch = trimmed.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
                const email = emailMatch ? emailMatch[0] : null;

                const raw_enrollment = actual_enrollment || srNo;
                if (!raw_enrollment) continue;
                
                // If it's just a number and there is no name and no 12-digit enrollment, skip it
                if (!actual_enrollment && !name) continue;

                const safeDivUpper = extractedDiv || 'A';
                const enrollment_no = safeDivUpper + '-' + raw_enrollment;
                const academic_year = req.body.academic_year || (new Date().getFullYear() + '-' + String(new Date().getFullYear() + 1).slice(2));
                    
                let extraInfoObj = {};
                if (actual_enrollment && srNo) {
                    extraInfoObj['Roll No / Sr No'] = srNo;
                }
                if (actual_enrollment) {
                    extraInfoObj['University Enrollment'] = actual_enrollment;
                }
                if (email) {
                    extraInfoObj['Email'] = email;
                }
                const extraInfoStr = JSON.stringify(extraInfoObj);

                const [exact] = await db.execute('SELECT id, name FROM students WHERE enrollment_no = ?', [enrollment_no]);
                    
                    let finalName = name;
                    if (!finalName) {
                        if (exact.length > 0 && exact[0].name && !exact[0].name.startsWith('Student ')) {
                            finalName = exact[0].name;
                        } else {
                            finalName = `Student ${raw_enrollment}`;
                        }
                    }
                    
                    if (exact.length > 0) {
                        await db.execute('UPDATE students SET name = ?, division = ?, extra_info = ?, archived_year = ? WHERE id = ?', [finalName, safeDivUpper, extraInfoStr, academic_year, exact[0].id]);
                        updated++;
                    } else {
                        const randomChars = Math.random().toString(36).substring(2, 7);
                        const password = `s${extractedSem}${safeDivUpper}${randomChars}`;
                        await db.execute('INSERT INTO students (enrollment_no, password, name, division, extra_info, archived_year) VALUES (?, ?, ?, ?, ?, ?)', [enrollment_no, password, finalName, safeDivUpper, extraInfoStr, academic_year]);
                        inserted++;
                    }
                    
                    if (midsemMarks !== null) {
                        await db.execute('INSERT INTO marks (enrollment_no, subject, marks) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE marks = ?', 
                            [enrollment_no, 'Midsem', String(midsemMarks), String(midsemMarks)]);
                    }
            }
            return res.json({ success: true, message: `PDF Processed successfully: ${inserted} New Students inserted, ${updated} Students updated.` });
        }

        // Excel/CSV Handling
        const workbook = xlsx.readFile(req.file.path);

        for (const sheetName of workbook.SheetNames) {
            const sheet = workbook.Sheets[sheetName];
            const rawData = xlsx.utils.sheet_to_json(sheet, { header: 1 });
            if (rawData.length === 0) continue;

            let extractedDiv = sheetName.split('_')[0].toUpperCase(); // E.g., 'R1' or 'R'
            let actualDiv = extractedDiv.replace(/[0-9]/g, ''); // Extract 'R' from 'R1'
            let actualBatch = sheetName.toLowerCase().includes('batch') ? extractedDiv : null; // 'R1'
            let extractedSem = '1';

            let headerRowIndex = -1;
            let headerMap = {};
            
            for (let i = 0; i < rawData.length; i++) {
                const row = rawData[i];
                if (!row) continue;
                
                // Look for division & semester in cells
                for (let j = 0; j < row.length; j++) {
                    const cellVal = String(row[j] || '').trim();
                    const divMatch = cellVal.match(/division\s*[-:]?\s*([a-z0-9]+)/i);
                    if (divMatch) {
                        actualDiv = divMatch[1].toUpperCase().replace(/[0-9]/g, '');
                    }
                    const semMatch = cellVal.match(/semester\s*[-:]?\s*(\d+)/i);
                    if (semMatch) {
                        extractedSem = semMatch[1];
                    }
                }

                // Look for header row (contains SR NO and NAME)
                let foundSrNo = -1;
                let foundName = -1;
                for (let j = 0; j < row.length; j++) {
                    const norm = String(row[j] || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
                    if (norm === 'srno' || norm === 'rollno' || norm === 'sr') foundSrNo = j;
                    if (norm.includes('name')) foundName = j;
                }

                if (foundSrNo !== -1 && foundName !== -1) {
                    headerRowIndex = i;
                    for (let j = 0; j < row.length; j++) {
                        headerMap[j] = String(row[j] || '').trim();
                    }
                    break;
                }
            }

            if (headerRowIndex === -1) continue;

            // Process students
            for (let i = headerRowIndex + 1; i < rawData.length; i++) {
                const row = rawData[i];
                if (!row || row.length === 0) continue;

                let rowObj = {};
                for (let j = 0; j < row.length; j++) {
                    if (headerMap[j] && row[j] !== undefined && row[j] !== null && String(row[j]).trim() !== '') {
                        rowObj[headerMap[j]] = row[j];
                    }
                }

                if (Object.keys(rowObj).length === 0) continue;

                let usedKeys = [];
                const getVal = (keyNames) => {
                    const key = Object.keys(rowObj).find(k => keyNames.some(kn => k.toLowerCase().replace(/[^a-z0-9]/g, '').includes(kn)));
                    if (key) {
                        usedKeys.push(key);
                        return rowObj[key];
                    }
                    return null;
                };

                const srNo = getVal(['srno', 'rollno', 'sr']);
                let actual_enrollment = getVal(['enrollmentno', 'enrollmentid', 'enrollment']);
                if (actual_enrollment) {
                    actual_enrollment = String(actual_enrollment).trim().replace(/\D/g, '').slice(-12);
                }
                const name = getVal(['name', 'student']);
                const email = getVal(['email', 'mail', 'emailid']);
                const rank = getVal(['rank']);

                const raw_enrollment = actual_enrollment || srNo;

                if (!raw_enrollment || String(raw_enrollment).trim() === '' || !name || String(name).trim() === '') continue;

                const rowDivision = getVal(['div', 'division', 'class', 'section']);
                const safeDiv = (rowDivision ? String(rowDivision).toUpperCase().replace(/[0-9]/g, '') : actualDiv) || 'A';
                const safeDivUpper = String(safeDiv).toUpperCase();
                
                const enrollment_no = safeDivUpper + '-' + String(raw_enrollment).trim();
                const safeName = name || `Student ${raw_enrollment}`;
                const safeRank = rank || null;

                let extraInfoObj = {};
                for (const key in rowObj) {
                    if (!usedKeys.includes(key)) {
                        extraInfoObj[key] = rowObj[key];
                    }
                }
                
                // Add the Sr No to extra info if we used the 12-digit enrollment as the main ID
                if (actual_enrollment && srNo) {
                    extraInfoObj['Roll No / Sr No'] = srNo;
                }

                // Add Batch if present
                if (actualBatch) {
                    extraInfoObj['Batch'] = actualBatch;
                }

                if (email) {
                    extraInfoObj['Email'] = email;
                }

                const extraInfoStr = JSON.stringify(extraInfoObj);
                const academic_year = req.body.academic_year || (new Date().getFullYear() + '-' + String(new Date().getFullYear() + 1).slice(2));

                const [exact] = await db.execute('SELECT id FROM students WHERE enrollment_no = ?', [enrollment_no]);
                
                if (exact.length > 0) {
                    await db.execute('UPDATE students SET name = ?, division = ?, rank_no = ?, extra_info = ?, archived_year = ? WHERE id = ?', [safeName, safeDivUpper, safeRank, extraInfoStr, academic_year, exact[0].id]);
                    updated++;
                } else {
                    const randomChars = Math.random().toString(36).substring(2, 7);
                    const password = `s${extractedSem}${safeDivUpper}${randomChars}`;
                    await db.execute('INSERT INTO students (enrollment_no, password, name, division, rank_no, extra_info, archived_year) VALUES (?, ?, ?, ?, ?, ?, ?)', [enrollment_no, password, safeName, safeDivUpper, safeRank, extraInfoStr, academic_year]);
                    inserted++;
                }
            }
        }

        res.json({ success: true, message: `Processed successfully: ${inserted} New Students inserted, ${updated} Students updated.` });
    } catch (err) {
        console.error("MUSTER UPLOAD ERROR:", err);
        res.status(500).json({ success: false, message: 'Server error processing file: ' + (err.message || err.toString()) });
    }
});

// POST /createFolder (Just returning success since it's logical)
router.post('/createFolder', async (req, res) => {
    try {
        const { folder_name } = req.body;
        // In this system, folders are just strings in the files table.
        // We just return success.
        res.json({ success: true, message: `Folder '${folder_name}' created logically.` });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// POST /uploadFile
router.post('/uploadFile', upload.single('file'), async (req, res) => {
    try {
        const { folder_name, visibility, uploaded_by, link_url } = req.body;
        
        if (!req.file && !link_url) {
            return res.status(400).json({ success: false, message: 'No file or link provided' });
        }

        const file_url = req.file ? `/uploads/${req.file.filename}` : link_url;
        const file_name = req.file ? req.file.originalname : link_url;

        await db.execute(
            'INSERT INTO files (file_name, file_url, folder_name, visibility, uploaded_by) VALUES (?, ?, ?, ?, ?)',
            [file_name, file_url, folder_name || 'root', visibility || 'public', uploaded_by || 'admin']
        );

        res.json({ success: true, message: 'Material added successfully', file_url });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// POST /archiveDivision
router.post('/archiveDivision', async (req, res) => {
    try {
        const { division, academic_year } = req.body;
        const year = academic_year || new Date().getFullYear().toString();
        
        if (division) {
            await db.execute("UPDATE students SET status = 'archived', archived_year = ? WHERE division = ? AND status = 'active'", [year, division.toUpperCase()]);
            res.json({ success: true, message: `All active students in Division ${division.toUpperCase()} archived under ${year}.` });
        } else {
            await db.execute("UPDATE students SET status = 'archived', archived_year = ? WHERE status = 'active'", [year]);
            res.json({ success: true, message: `All active students archived under ${year}.` });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// POST /updateMarks
router.post('/updateMarks', async (req, res) => {
    try {
        const { enrollment_no, subject, marks } = req.body;
        await db.execute('INSERT INTO marks (enrollment_no, subject, marks) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE marks = ?', [enrollment_no, subject, String(marks), String(marks)]);
        res.json({ success: true, message: 'Marks updated successfully' });
    } catch(err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// POST /bulkUpdateMarks
router.post('/bulkUpdateMarks', async (req, res) => {
    try {
        const { updates } = req.body;
        for (const u of updates) {
            await db.execute('INSERT INTO marks (enrollment_no, subject, marks) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE marks = ?', 
                [u.enrollment_no, u.subject, String(u.marks), String(u.marks)]);
        }
        res.json({ success: true });
    } catch(err) {
        console.error(err);
        res.status(500).json({ success: false });
    }
});

// GET /getMarksByDivision/:division
router.get('/getMarksByDivision/:division', async (req, res) => {
    try {
        const [marks] = await db.execute(`
            SELECT m.* FROM marks m
            JOIN students s ON m.enrollment_no = s.enrollment_no
            WHERE s.division = ?
        `, [req.params.division]);
        res.json({ success: true, marks });
    } catch(err) {
        res.status(500).json({ success: false });
    }
});

// GET /getArchivedStudents
router.get('/getArchivedStudents', async (req, res) => {
    try {
        const [students] = await db.execute("SELECT id, enrollment_no, name, division, extra_info, archived_year FROM students WHERE status = 'archived' ORDER BY archived_year DESC, division ASC, CAST(SUBSTRING(enrollment_no, LOCATE('-', enrollment_no) + 1) AS UNSIGNED) ASC");
        const displayStudents = students.map(s => {
            let displayNo = s.enrollment_no;
            if (s.division && s.enrollment_no.startsWith(s.division + '-')) {
                displayNo = s.enrollment_no.substring(s.division.length + 1);
            }
            return { ...s, display_enrollment: displayNo };
        });
        res.json({ success: true, students: displayStudents });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

module.exports = router;
