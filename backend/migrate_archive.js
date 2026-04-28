const db = require('./db');

async function migrate() {
    try {
        await db.execute('ALTER TABLE students ADD COLUMN archived_year VARCHAR(20) DEFAULT NULL');
        console.log("archived_year column added successfully!");
    } catch(e) {
        if (e.message.includes('Duplicate')) {
            console.log("Column already exists, skipping.");
        } else {
            console.error(e.message);
        }
    }
    process.exit(0);
}

migrate();
