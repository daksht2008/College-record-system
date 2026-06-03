/**
 * Seed Script — Populate all students with random marks, attendance, and names.
 * Run: node seed_data.js
 */
const db = require('./db');

const FIRST_NAMES = [
    'Aarav','Vivaan','Aditya','Arjun','Sai','Reyansh','Ayaan','Ishaan','Kabir','Dhruv',
    'Ananya','Diya','Saanvi','Aanya','Isha','Meera','Riya','Priya','Pooja','Sneha',
    'Rohan','Krish','Vihaan','Atharva','Tanmay','Om','Yash','Harsh','Nikhil','Raj',
    'Sakshi','Tanvi','Shruti','Neha','Kavya','Avni','Riddhi','Siddhi','Nidhi','Aditi',
    'Parth','Mihir','Dev','Shaurya','Arnav','Rudra','Manav','Sahil','Jay','Kunal'
];

const LAST_NAMES = [
    'Sharma','Patel','Shah','Mehta','Joshi','Desai','Thakkar','Modi','Trivedi','Bhatt',
    'Chauhan','Parikh','Nair','Reddy','Kumar','Singh','Verma','Gupta','Mishra','Yadav',
    'Kulkarni','Patil','Iyer','Menon','Pillai','Rao','Das','Bose','Sen','Ghosh',
    'Malhotra','Kapoor','Khanna','Bhatia','Saxena','Agarwal','Bansal','Goel','Jain','Arora'
];

// Marks subjects with max marks
// Midsem = out of 30, internals (Lab Practical, Viva, Project, Self Learning) each out of 10-15
const MARKS_SUBJECTS = [
    { name: 'Midsem',        max: 30 },
    { name: 'Lab Practical', max: 15 },
    { name: 'Viva',          max: 10 },
    { name: 'Project',       max: 15 },
    { name: 'Self Learning', max: 10 },
];

// Attendance subjects with type (Theory / Lab / Tutorial)
// Maths uses Tutorial instead of Lab Practical
const ATTENDANCE_SESSIONS = [
    { subject: 'Physics',                  type: 'Theory' },
    { subject: 'Physics',                  type: 'Lab' },
    { subject: 'Maths',                    type: 'Theory' },
    { subject: 'Maths',                    type: 'Tutorial' },
    { subject: 'Basic Electrical Engg',    type: 'Theory' },
    { subject: 'Basic Electrical Engg',    type: 'Lab' },
    { subject: 'Mechanics',                type: 'Theory' },
    { subject: 'Mechanics',                type: 'Lab' },
    { subject: 'Computer Programming',     type: 'Theory' },
    { subject: 'Computer Programming',     type: 'Lab' },
    { subject: 'Engineering Graphics',     type: 'Theory' },
    { subject: 'Engineering Graphics',     type: 'Lab' },
];

function rand(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function generateName() {
    return pick(FIRST_NAMES) + ' ' + pick(LAST_NAMES);
}

async function ensureColumns() {
    // Add subject column to attendance if missing
    for (const col of [
        "ALTER TABLE attendance ADD COLUMN subject VARCHAR(100) DEFAULT NULL",
        "ALTER TABLE attendance ADD COLUMN type VARCHAR(50) DEFAULT NULL"
    ]) {
        try { await db.execute(col); } catch(e) {}
    }
}

async function seed() {
    console.log('Starting seed...');
    await new Promise(r => setTimeout(r, 2000));

    await ensureColumns();
    console.log('DB columns verified.');

    // Get all active students
    const [students] = await db.execute("SELECT enrollment_no, name, division FROM students WHERE status = 'active'");
    console.log(`Found ${students.length} active students.`);

    if (students.length === 0) {
        console.log('No students found. Register students first.');
        process.exit(0);
    }

    // --- 1. UPDATE NAMES ---
    console.log('Updating student names...');
    for (const s of students) {
        if (!s.name || s.name.startsWith('Student ')) {
            const newName = generateName();
            await db.execute('UPDATE students SET name = ? WHERE enrollment_no = ?', [newName, s.enrollment_no]);
        }
    }
    console.log('Names updated.');

    // --- 2. RANK — division-wise only ---
    console.log('Assigning division-wise ranks...');
    const divGroups = {};
    for (const s of students) {
        const div = s.division || 'A';
        if (!divGroups[div]) divGroups[div] = [];
        divGroups[div].push(s.enrollment_no);
    }
    for (const [div, enrollments] of Object.entries(divGroups)) {
        let rank = 1;
        for (const enrollment_no of enrollments) {
            await db.execute('UPDATE students SET rank_no = ? WHERE enrollment_no = ?', [String(rank++), enrollment_no]);
        }
        console.log(`  Division ${div}: ${enrollments.length} students ranked.`);
    }

    // --- 3. EXTRA INFO — roll number + university enrollment (no email) ---
    console.log('Updating extra info...');
    const rollCounter = {};
    for (const s of students) {
        const div = s.division || 'A';
        if (!rollCounter[div]) rollCounter[div] = 1;
        const rollNo = rollCounter[div]++;
        const extra = JSON.stringify({
            'Roll No / Sr No': rollNo,
            'University Enrollment': s.enrollment_no.replace(/^[A-Z]+-/, '')
        });
        await db.execute('UPDATE students SET extra_info = ? WHERE enrollment_no = ?', [extra, s.enrollment_no]);
    }
    console.log('Extra info updated (no emails).');

    // --- 4. INSERT MARKS ---
    console.log('Inserting random marks...');
    await db.execute('DELETE FROM marks');
    const courses = ['Physics', 'Maths', 'Basic Electrical Engg', 'Mechanics', 'Computer Programming', 'Engineering Graphics'];
    const marksValues = [];
    for (const s of students) {
        for (const course of courses) {
            for (const subj of MARKS_SUBJECTS) {
                const mark = rand(Math.floor(subj.max * 0.3), subj.max);
                marksValues.push([s.enrollment_no, course, subj.name, mark]);
            }
        }
    }
    for (let i = 0; i < marksValues.length; i += 100) {
        const chunk = marksValues.slice(i, i + 100);
        await db.execute(
            `INSERT INTO marks (enrollment_no, course, subject, marks) VALUES ${chunk.map(() => '(?,?,?,?)').join(',')}`,
            chunk.flat()
        );
    }
    console.log(`Inserted ${marksValues.length} marks records.`);

    // --- 5. INSERT ATTENDANCE (with subject + type) ---
    console.log('Inserting random attendance...');
    await db.execute('DELETE FROM attendance');

    // Generate last 30 working days
    const dates = [];
    const d = new Date();
    while (dates.length < 30) {
        d.setDate(d.getDate() - 1);
        if (d.getDay() !== 0 && d.getDay() !== 6) {
            dates.push(d.toISOString().slice(0, 10));
        }
    }
    dates.reverse();

    const attValues = [];
    for (const s of students) {
        const rate = rand(60, 97) / 100;
        for (const dateStr of dates) {
            const session = pick(ATTENDANCE_SESSIONS);
            const status = Math.random() < rate ? 'Present' : 'Absent';
            attValues.push([s.enrollment_no, dateStr, status, s.division || 'A', session.subject, session.type]);
        }
    }

    console.log(`Inserting ${attValues.length} attendance records...`);
    for (let i = 0; i < attValues.length; i += 500) {
        const chunk = attValues.slice(i, i + 500);
        await db.execute(
            `INSERT INTO attendance (enrollment_no, date, status, division, subject, type) VALUES ${chunk.map(() => '(?,?,?,?,?,?)').join(',')}`,
            chunk.flat()
        );
        process.stdout.write(`  ${Math.min(i + 500, attValues.length)}/${attValues.length}\r`);
    }

    console.log(`\n\n=== SEED COMPLETE ===`);
    console.log(`  Students   : ${students.length}`);
    console.log(`  Marks      : ${marksValues.length} records`);
    console.log(`  Attendance : ${attValues.length} records`);
    console.log(`  Subjects   : ${MARKS_SUBJECTS.map(s=>s.name).join(', ')}`);
    process.exit(0);
}

seed().catch(err => {
    console.error('Seed error:', err);
    process.exit(1);
});
