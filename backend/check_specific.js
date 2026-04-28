const db = require('./db');
async function check() {
    try {
        const [students] = await db.execute("SELECT * FROM students WHERE enrollment_no LIKE '%081' OR enrollment_no LIKE '%082'");
        console.log("Students 81/82:", students);
    } catch(e) {
        console.error(e);
    }
    process.exit(0);
}
check();
