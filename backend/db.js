const mysql = require('mysql2');

// Configure database connection
// Make sure to replace 'password123' with your actual MySQL root password if it's different!
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'Daksh1003!', // !!! UPDATE THIS IF YOUR MYSQL PASSWORD IS DIFFERENT !!!
    database: 'college_records'
});

db.connect(async (err) => {
    if (err) {
        console.error('Error connecting to MySQL database: ', err.message);
        console.error('Please make sure MySQL is running, the password is correct, and the schema is imported.');
        return;
    }
    console.log('Successfully connected to MySQL database.');

    try {
        const columnsToAdd = [
            "ADD COLUMN extra_info TEXT DEFAULT NULL",
            "ADD COLUMN archived_year VARCHAR(50) DEFAULT NULL",
            "ADD COLUMN status ENUM('active', 'archived') DEFAULT 'active'",
            "ADD COLUMN face_descriptor TEXT DEFAULT NULL"
        ];

        for (const col of columnsToAdd) {
            try {
                await db.promise().execute(`ALTER TABLE students ${col}`);
            } catch (e) {
                if (e.code !== 'ER_DUP_FIELDNAME') {
                    console.error(`Error adding column ${col}:`, e.message);
                }
            }
        }
        
        // Add face_descriptor to admins table too
        try {
            await db.promise().execute('ALTER TABLE admins ADD COLUMN face_descriptor TEXT DEFAULT NULL');
        } catch(e) {
            if (e.code !== 'ER_DUP_FIELDNAME') {
                console.error('Error adding face_descriptor to admins:', e.message);
            }
        }
        
        // Add subject column to admins
        try {
            await db.promise().execute('ALTER TABLE admins ADD COLUMN subject VARCHAR(100) DEFAULT NULL');
        } catch(e) {
            if (e.code !== 'ER_DUP_FIELDNAME') {
                console.error('Error adding subject to admins:', e.message);
            }
        }
        
        // Add course column to marks
        try {
            await db.promise().execute('ALTER TABLE marks ADD COLUMN course VARCHAR(100) DEFAULT "Physics"');
        } catch(e) {
            if (e.code !== 'ER_DUP_FIELDNAME') {
                console.error('Error adding course to marks:', e.message);
            }
        }
        
        // Fix unique constraint for marks table
        try {
            await db.promise().execute('ALTER TABLE marks DROP INDEX enrollment_subject_unique');
        } catch(e) {
            // Ignore if index doesn't exist
        }
        try {
            await db.promise().execute('ALTER TABLE marks ADD UNIQUE INDEX enrollment_course_subject_unique (enrollment_no, course, subject)');
        } catch(e) {
            // Ignore if index already exists
        }
        
        await db.promise().execute(`CREATE TABLE IF NOT EXISTS assignments (
            id INT AUTO_INCREMENT PRIMARY KEY,
            enrollment_no VARCHAR(255) NOT NULL,
            title VARCHAR(255) NOT NULL,
            file_url VARCHAR(255) NOT NULL,
            submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (enrollment_no) REFERENCES students(enrollment_no) ON DELETE CASCADE
        )`);
        
        await db.promise().execute(`CREATE TABLE IF NOT EXISTS schedules (
            id INT AUTO_INCREMENT PRIMARY KEY,
            day VARCHAR(20) NOT NULL,
            time_slot VARCHAR(50) NOT NULL,
            subject VARCHAR(100) NOT NULL,
            type VARCHAR(50) NOT NULL,
            division VARCHAR(10) NOT NULL,
            color VARCHAR(150) DEFAULT NULL
        )`);
        
        try {
            await db.promise().execute('ALTER TABLE schedules MODIFY COLUMN color VARCHAR(150) DEFAULT NULL');
        } catch(e) {
            console.error('Error modifying schedules color column:', e.message);
        }

        // Add grading columns to assignments table
        try {
            await db.promise().execute('ALTER TABLE assignments ADD COLUMN grade VARCHAR(10) DEFAULT NULL');
        } catch (e) {
            if (e.code !== 'ER_DUP_FIELDNAME') console.error('Error adding grade column:', e.message);
        }
        try {
            await db.promise().execute('ALTER TABLE assignments ADD COLUMN feedback TEXT DEFAULT NULL');
        } catch (e) {
            if (e.code !== 'ER_DUP_FIELDNAME') console.error('Error adding feedback column:', e.message);
        }
        try {
            await db.promise().execute('ALTER TABLE assignments ADD COLUMN graded_by VARCHAR(255) DEFAULT NULL');
        } catch (e) {
            if (e.code !== 'ER_DUP_FIELDNAME') console.error('Error adding graded_by column:', e.message);
        }

        // Add tags column to files table
        try {
            await db.promise().execute('ALTER TABLE files ADD COLUMN tags VARCHAR(255) DEFAULT ""');
        } catch (e) {
            if (e.code !== 'ER_DUP_FIELDNAME') console.error('Error adding tags column:', e.message);
        }

        // Create chat messages table
        await db.promise().execute(`CREATE TABLE IF NOT EXISTS chat_messages (
            id INT AUTO_INCREMENT PRIMARY KEY,
            division VARCHAR(10) NOT NULL,
            sender_name VARCHAR(255) NOT NULL,
            sender_id VARCHAR(255) NOT NULL,
            message TEXT NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Create push subscriptions table
        await db.promise().execute(`CREATE TABLE IF NOT EXISTS push_subscriptions (
            id INT AUTO_INCREMENT PRIMARY KEY,
            enrollment_no VARCHAR(255) DEFAULT NULL,
            username VARCHAR(255) DEFAULT NULL,
            subscription_json TEXT NOT NULL
        )`);
        
        console.log('Verified students, assignments, schedules, chat, and push tables schema.');
        
        // Insert default admin accounts with subjects
        await db.promise().execute(
            'INSERT IGNORE INTO admins (name, username, password, subject) VALUES (?, ?, ?, ?), (?, ?, ?, ?), (?, ?, ?, ?), (?, ?, ?, ?), (?, ?, ?, ?), (?, ?, ?, ?)',
            [
                'Physics Admin', 'admin', 'admin123', 'Physics',
                'Maths Admin', 'admin2', 'admin456', 'Maths',
                'BEE Admin', 'admin3', 'admin789', 'Basic Electrical Engineering',
                'Mechanics Admin', 'admin4', 'admin123', 'Mechanics',
                'Programming Admin', 'admin5', 'admin123', 'Computer Programming',
                'Graphics Admin', 'admin6', 'admin123', 'Engineering Graphics'
            ]
        );
        
        // Update existing admins with subjects if they don't have one
        await db.promise().execute("UPDATE admins SET subject = 'Physics', name = 'Physics Admin' WHERE username = 'admin' AND (subject IS NULL OR subject = '')");
        await db.promise().execute("UPDATE admins SET subject = 'Maths', name = 'Maths Admin' WHERE username = 'admin2' AND (subject IS NULL OR subject = '')");
        
        console.log('Ensured default admin accounts exist with subjects.');
    } catch (schemaErr) {
        console.error('Error ensuring database schema:', schemaErr.message);
    }
});

// To use promises
module.exports = db.promise();
