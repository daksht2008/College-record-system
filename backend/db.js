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
            "ADD COLUMN status ENUM('active', 'archived') DEFAULT 'active'"
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
        await db.promise().execute(`CREATE TABLE IF NOT EXISTS assignments (
            id INT AUTO_INCREMENT PRIMARY KEY,
            enrollment_no VARCHAR(255) NOT NULL,
            title VARCHAR(255) NOT NULL,
            file_url VARCHAR(255) NOT NULL,
            submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (enrollment_no) REFERENCES students(enrollment_no) ON DELETE CASCADE
        )`);
        console.log('Verified students and assignments table schema.');
        await db.promise().execute(
            'INSERT IGNORE INTO admins (name, username, password) VALUES (?, ?, ?), (?, ?, ?)',
            ['Admin User', 'admin', 'admin123', 'Assistant Admin', 'admin2', 'admin456']
        );
        console.log('Ensured default admin accounts exist.');
    } catch (schemaErr) {
        console.error('Error ensuring database schema:', schemaErr.message);
    }
});

// To use promises
module.exports = db.promise();
