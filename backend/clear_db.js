const db = require('./db');
async function clear() {
    try {
        await db.execute("DELETE FROM attendance");
        await db.execute("DELETE FROM marks");
        await db.execute("DELETE FROM students");
        console.log("Cleared old student data to apply new prefix format safely.");
    } catch(e) {
        console.error(e);
    }
    process.exit(0);
}
clear();
