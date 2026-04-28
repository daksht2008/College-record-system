const db = require('./db');
async function run() {
    try {
        await db.execute("ALTER TABLE marks MODIFY marks VARCHAR(10) NOT NULL");
        console.log("Marks modified to VARCHAR.");
        
        // Check if unique key exists, if not add it
        const [keys] = await db.execute("SHOW INDEX FROM marks WHERE Key_name = 'enrollment_subject_unique'");
        if (keys.length === 0) {
            await db.execute("ALTER TABLE marks ADD CONSTRAINT enrollment_subject_unique UNIQUE (enrollment_no, subject)");
            console.log("Unique constraint added.");
        }
    } catch(e) {
        console.error(e);
    }
    process.exit(0);
}
run();
