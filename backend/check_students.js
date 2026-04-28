const db = require('./db');
async function check() {
    try {
        const [students] = await db.execute("SELECT id, enrollment_no FROM students LIMIT 10");
        console.log("Students:", students);
    } catch(e) {
        console.error(e);
    }
    process.exit(0);
}
check();
